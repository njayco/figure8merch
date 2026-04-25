import { Router, type IRouter } from "express";
import { db, wishlistTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getStripeProductsByIds, getStripeProductSummaries, toProductShape } from "../lib/stripeDb";

const router: IRouter = Router();

router.get("/wishlist", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(wishlistTable)
      .where(eq(wishlistTable.userId, req.userId!));

    const productIds = rows.map((r) => r.productId);
    const stripeProducts = await getStripeProductsByIds(productIds);
    const productMap = new Map(stripeProducts.map((p) => [p.id, p]));

    const products = rows
      .map((r) => {
        const p = productMap.get(r.productId);
        return p ? toProductShape(p) : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    res.json(products);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch wishlist";
    res.status(500).json({ error: message });
  }
});

router.post("/wishlist/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  try {
    // Validate that the product exists and has an active price before adding
    const [product] = await getStripeProductSummaries([productId]);
    if (!product) {
      res.status(404).json({ error: "Product not found or no longer available" });
      return;
    }

    const existing = await db
      .select()
      .from(wishlistTable)
      .where(and(eq(wishlistTable.userId, req.userId!), eq(wishlistTable.productId, productId)));

    if (existing.length === 0) {
      await db.insert(wishlistTable).values({ userId: req.userId!, productId });
    }

    res.json({ message: "Added to wishlist" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add to wishlist";
    res.status(500).json({ error: message });
  }
});

router.delete("/wishlist/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;

  try {
    await db.delete(wishlistTable).where(
      and(eq(wishlistTable.userId, req.userId!), eq(wishlistTable.productId, productId))
    );

    res.json({ message: "Removed from wishlist" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove from wishlist";
    res.status(500).json({ error: message });
  }
});

export default router;
