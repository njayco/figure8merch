import { Router, type IRouter } from "express";
import { db, wishlistTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/wishlist", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const rows = await db
    .select()
    .from(wishlistTable)
    .innerJoin(productsTable, eq(wishlistTable.productId, productsTable.id))
    .where(eq(wishlistTable.userId, req.userId!));

  const products = rows.map((r) => ({
    id: r.products.id,
    name: r.products.name,
    description: r.products.description,
    price: Number(r.products.price),
    imageUrl: r.products.imageUrl,
    category: r.products.category,
    sizes: r.products.sizes,
    isFeatured: r.products.isFeatured,
    stock: r.products.stock,
    createdAt: r.products.createdAt,
  }));

  res.json(products);
});

router.post("/wishlist/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  const existing = await db
    .select()
    .from(wishlistTable)
    .where(and(eq(wishlistTable.userId, req.userId!), eq(wishlistTable.productId, productId)));

  if (existing.length === 0) {
    await db.insert(wishlistTable).values({ userId: req.userId!, productId });
  }

  res.json({ message: "Added to wishlist" });
});

router.delete("/wishlist/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  await db.delete(wishlistTable).where(
    and(eq(wishlistTable.userId, req.userId!), eq(wishlistTable.productId, productId))
  );

  res.json({ message: "Removed from wishlist" });
});

export default router;
