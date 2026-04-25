import { Router, type IRouter } from "express";
import { db, cartItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AddToCartBody, UpdateCartItemBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import {
  getStripeProduct,
  getStripeProductsByIds,
  toCartProductShape,
  getVariantsForProducts,
  getVariantsForProduct,
} from "../lib/stripeDb";

const router: IRouter = Router();

async function getCartForUser(userId: number) {
  const cartRows = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.userId, userId));

  const productIds = [...new Set(cartRows.map((r) => r.productId))];
  const stripeProducts = await getStripeProductsByIds(productIds);
  const productMap = new Map(stripeProducts.map((p) => [p.id, p]));
  const variants = await getVariantsForProducts(productIds);

  const items = cartRows.map((r) => {
    const p = productMap.get(r.productId);
    return {
      product: p
        ? toCartProductShape(p, variants.get(r.productId) ?? [])
        : {
            id: r.productId,
            name: "Unknown Product",
            description: "",
            price: 0,
            imageUrl: "",
            category: "other",
            sizes: [],
            colors: [],
            variants: [],
            totalStock: null,
            isFeatured: false,
            createdAt: new Date(),
            stripePriceId: "",
          },
      quantity: r.quantity,
      size: r.size,
      color: r.color ?? "",
    };
  });

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, total, itemCount };
}

function pickColor(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

router.get("/cart", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const cart = await getCartForUser(req.userId!);
    res.json(cart);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch cart";
    res.status(500).json({ error: message });
  }
});

router.post("/cart", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { productId, quantity, size } = parsed.data;
    const color = pickColor((req.body as { color?: unknown }).color);

    const product = await getStripeProduct(productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // If product has variants configured, validate the chosen combo exists and is in stock.
    const productVariants = await getVariantsForProduct(productId);
    if (productVariants.length > 0) {
      const variant = productVariants.find((v) => v.size === size && v.color === color);
      if (!variant) {
        res.status(400).json({
          error: `That size/color combination is not available for this product.`,
        });
        return;
      }
      if (variant.stock <= 0) {
        res.status(400).json({ error: `${product.name} (${size}, ${color}) is out of stock.` });
        return;
      }
    }

    const existing = await db
      .select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.userId, req.userId!),
          eq(cartItemsTable.productId, productId),
          eq(cartItemsTable.size, size),
          eq(cartItemsTable.color, color),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(cartItemsTable)
        .set({ quantity: existing[0].quantity + quantity })
        .where(eq(cartItemsTable.id, existing[0].id));
    } else {
      await db
        .insert(cartItemsTable)
        .values({ userId: req.userId!, productId, quantity, size, color });
    }

    const cart = await getCartForUser(req.userId!);
    res.json(cart);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add to cart";
    res.status(500).json({ error: message });
  }
});

router.put("/cart/:productId/:size", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const size = Array.isArray(req.params.size) ? req.params.size[0] : req.params.size;
  const color = pickColor(req.query.color);

  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { quantity } = parsed.data;

    if (quantity <= 0) {
      await db.delete(cartItemsTable).where(
        and(
          eq(cartItemsTable.userId, req.userId!),
          eq(cartItemsTable.productId, productId),
          eq(cartItemsTable.size, size),
          eq(cartItemsTable.color, color),
        ),
      );
    } else {
      await db.update(cartItemsTable).set({ quantity }).where(
        and(
          eq(cartItemsTable.userId, req.userId!),
          eq(cartItemsTable.productId, productId),
          eq(cartItemsTable.size, size),
          eq(cartItemsTable.color, color),
        ),
      );
    }

    const cart = await getCartForUser(req.userId!);
    res.json(cart);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update cart";
    res.status(500).json({ error: message });
  }
});

router.delete("/cart/:productId/:size", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const size = Array.isArray(req.params.size) ? req.params.size[0] : req.params.size;
  const color = pickColor(req.query.color);

  try {
    await db.delete(cartItemsTable).where(
      and(
        eq(cartItemsTable.userId, req.userId!),
        eq(cartItemsTable.productId, productId),
        eq(cartItemsTable.size, size),
        eq(cartItemsTable.color, color),
      ),
    );

    const cart = await getCartForUser(req.userId!);
    res.json(cart);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove from cart";
    res.status(500).json({ error: message });
  }
});

export { getCartForUser };
export default router;
