import { Router, type IRouter } from "express";
import { db, cartItemsTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { AddToCartBody, UpdateCartItemBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

async function getCartForUser(userId: number) {
  const rows = await db
    .select()
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.userId, userId));

  const items = rows.map((r) => ({
    product: {
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
    },
    quantity: r.cart_items.quantity,
    size: r.cart_items.size,
  }));

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return { items, total, itemCount };
}

router.get("/cart", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

router.post("/cart", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { productId, quantity, size } = parsed.data;

  const existing = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId), eq(cartItemsTable.size, size)));

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
});

router.put("/cart/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { quantity, size } = parsed.data;

  if (quantity <= 0) {
    await db.delete(cartItemsTable).where(
      and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
    );
  } else {
    const updateData: Partial<{ quantity: number; size: string }> = { quantity };
    if (size !== undefined) updateData.size = size;
    await db.update(cartItemsTable).set(updateData).where(
      and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
    );
  }

  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

router.delete("/cart/:productId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);

  await db.delete(cartItemsTable).where(
    and(eq(cartItemsTable.userId, req.userId!), eq(cartItemsTable.productId, productId))
  );

  const cart = await getCartForUser(req.userId!);
  res.json(cart);
});

export default router;
