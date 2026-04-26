import { Router, type IRouter } from "express";
import { db, savedCartItemsTable, cartItemsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import {
  getStripeProductsByIds,
  toCartProductShape,
  getVariantsForProducts,
} from "../lib/stripeDb";
import { getCartForUser } from "./cart";

const router: IRouter = Router();

function pickColor(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

async function getSavedCartForUser(userId: number) {
  const rows = await db
    .select()
    .from(savedCartItemsTable)
    .where(eq(savedCartItemsTable.userId, userId));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const stripeProducts = await getStripeProductsByIds(productIds);
  const productMap = new Map(stripeProducts.map((p) => [p.id, p]));
  const variants = await getVariantsForProducts(productIds);

  const items = rows.map((r) => {
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

  return { items };
}

router.get("/saved-cart", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const saved = await getSavedCartForUser(req.userId!);
    res.json(saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch saved-for-later";
    res.status(500).json({ error: message });
  }
});

// Move a cart line into the saved-for-later list (atomic).
router.post(
  "/cart/:productId/:size/save-for-later",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId;
    const size = Array.isArray(req.params.size) ? req.params.size[0] : req.params.size;
    const color = pickColor(req.query.color);
    const userId = req.userId!;

    try {
      const [cartLine] = await db
        .select()
        .from(cartItemsTable)
        .where(
          and(
            eq(cartItemsTable.userId, userId),
            eq(cartItemsTable.productId, productId),
            eq(cartItemsTable.size, size),
            eq(cartItemsTable.color, color),
          ),
        );

      if (!cartLine) {
        res.status(404).json({ error: "Cart item not found" });
        return;
      }

      const [existingSaved] = await db
        .select()
        .from(savedCartItemsTable)
        .where(
          and(
            eq(savedCartItemsTable.userId, userId),
            eq(savedCartItemsTable.productId, productId),
            eq(savedCartItemsTable.size, size),
            eq(savedCartItemsTable.color, color),
          ),
        );

      if (existingSaved) {
        await db
          .update(savedCartItemsTable)
          .set({ quantity: existingSaved.quantity + cartLine.quantity })
          .where(eq(savedCartItemsTable.id, existingSaved.id));
      } else {
        await db.insert(savedCartItemsTable).values({
          userId,
          productId,
          size,
          color,
          quantity: cartLine.quantity,
        });
      }

      await db.delete(cartItemsTable).where(eq(cartItemsTable.id, cartLine.id));

      const [cart, saved] = await Promise.all([
        getCartForUser(userId),
        getSavedCartForUser(userId),
      ]);
      res.json({ cart, saved });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save item for later";
      res.status(500).json({ error: message });
    }
  },
);

// Move a saved-for-later line back into the active cart.
router.post(
  "/saved-cart/:productId/:size/move-to-cart",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId;
    const size = Array.isArray(req.params.size) ? req.params.size[0] : req.params.size;
    const color = pickColor(req.query.color);
    const userId = req.userId!;

    try {
      const [savedLine] = await db
        .select()
        .from(savedCartItemsTable)
        .where(
          and(
            eq(savedCartItemsTable.userId, userId),
            eq(savedCartItemsTable.productId, productId),
            eq(savedCartItemsTable.size, size),
            eq(savedCartItemsTable.color, color),
          ),
        );

      if (!savedLine) {
        res.status(404).json({ error: "Saved item not found" });
        return;
      }

      const [existingCart] = await db
        .select()
        .from(cartItemsTable)
        .where(
          and(
            eq(cartItemsTable.userId, userId),
            eq(cartItemsTable.productId, productId),
            eq(cartItemsTable.size, size),
            eq(cartItemsTable.color, color),
          ),
        );

      if (existingCart) {
        await db
          .update(cartItemsTable)
          .set({ quantity: existingCart.quantity + savedLine.quantity })
          .where(eq(cartItemsTable.id, existingCart.id));
      } else {
        await db.insert(cartItemsTable).values({
          userId,
          productId,
          size,
          color,
          quantity: savedLine.quantity,
        });
      }

      await db.delete(savedCartItemsTable).where(eq(savedCartItemsTable.id, savedLine.id));

      const [cart, saved] = await Promise.all([
        getCartForUser(userId),
        getSavedCartForUser(userId),
      ]);
      res.json({ cart, saved });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to move item to cart";
      res.status(500).json({ error: message });
    }
  },
);

router.delete(
  "/saved-cart/:productId/:size",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const productId = Array.isArray(req.params.productId)
      ? req.params.productId[0]
      : req.params.productId;
    const size = Array.isArray(req.params.size) ? req.params.size[0] : req.params.size;
    const color = pickColor(req.query.color);
    const userId = req.userId!;

    try {
      await db.delete(savedCartItemsTable).where(
        and(
          eq(savedCartItemsTable.userId, userId),
          eq(savedCartItemsTable.productId, productId),
          eq(savedCartItemsTable.size, size),
          eq(savedCartItemsTable.color, color),
        ),
      );

      const saved = await getSavedCartForUser(userId);
      res.json(saved);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove saved item";
      res.status(500).json({ error: message });
    }
  },
);

export { getSavedCartForUser };
export default router;
