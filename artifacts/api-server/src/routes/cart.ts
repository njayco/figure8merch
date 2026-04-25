import { Router, type IRouter } from "express";
import { db, cartItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AddToCartBody, UpdateCartItemBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getStripeProduct, getStripeProductsByIds, toCartProductShape } from "../lib/stripeDb";

const router: IRouter = Router();

async function getCartForUser(userId: number) {
  const cartRows = await db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.userId, userId));

  const productIds = [...new Set(cartRows.map((r) => r.productId))];
  const stripeProducts = await getStripeProductsByIds(productIds);
  const productMap = new Map(stripeProducts.map((p) => [p.id, p]));

  const items = cartRows.map((r) => {
    const p = productMap.get(r.productId);
    return {
      product: p
        ? toCartProductShape(p)
        : {
            id: r.productId,
            name: "Unknown Product",
            description: "",
            price: 0,
            imageUrl: "",
            category: "other",
            sizes: [],
            isFeatured: false,
            stock: 0,
            createdAt: new Date(),
            stripePriceId: "",
          },
      quantity: r.quantity,
      size: r.size,
    };
  });

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, total, itemCount };
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

    const product = await getStripeProduct(productId);
    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const existing = await db
      .select()
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.userId, req.userId!),
          eq(cartItemsTable.productId, productId),
          eq(cartItemsTable.size, size)
        )
      );

    if (existing.length > 0) {
      await db
        .update(cartItemsTable)
        .set({ quantity: existing[0].quantity + quantity })
        .where(eq(cartItemsTable.id, existing[0].id));
    } else {
      await db.insert(cartItemsTable).values({ userId: req.userId!, productId, quantity, size });
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
          eq(cartItemsTable.size, size)
        )
      );
    } else {
      await db.update(cartItemsTable).set({ quantity }).where(
        and(
          eq(cartItemsTable.userId, req.userId!),
          eq(cartItemsTable.productId, productId),
          eq(cartItemsTable.size, size)
        )
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

  try {
    await db.delete(cartItemsTable).where(
      and(
        eq(cartItemsTable.userId, req.userId!),
        eq(cartItemsTable.productId, productId),
        eq(cartItemsTable.size, size)
      )
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
