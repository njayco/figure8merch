import { Router, type IRouter } from "express";
import { db, ordersTable, cartItemsTable, productsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { CreateOrderBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function toOrderShape(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    total: Number(order.total),
    status: order.status,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
  };
}

router.get("/orders", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, req.userId!))
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(toOrderShape));
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order || order.userId !== req.userId) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(toOrderShape(order));
});

router.post("/orders", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cartRows = await db
    .select()
    .from(cartItemsTable)
    .innerJoin(productsTable, eq(cartItemsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.userId, req.userId!));

  if (cartRows.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  const items = cartRows.map((r) => ({
    productId: r.products.id,
    productName: r.products.name,
    price: Number(r.products.price),
    quantity: r.cart_items.quantity,
    size: r.cart_items.size,
  }));

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const [order] = await db.insert(ordersTable).values({
    userId: req.userId!,
    items,
    total: String(total),
    status: "pending",
    shippingAddress: parsed.data.shippingAddress,
  }).returning();

  await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, req.userId!));

  res.status(201).json(toOrderShape(order));
});

router.get("/admin/orders", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      order: ordersTable,
      user: usersTable,
    })
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .orderBy(desc(ordersTable.createdAt));

  const orders = rows.map((r) => ({
    id: r.order.id,
    userId: r.order.userId,
    customerName: r.user.name,
    customerEmail: r.user.email,
    items: r.order.items,
    total: Number(r.order.total),
    status: r.order.status,
    shippingAddress: r.order.shippingAddress,
    createdAt: r.order.createdAt,
  }));

  res.json(orders);
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.total}::numeric), 0)` }).from(ordersTable);
  const [totalOrders] = await db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable);
  const [totalCustomers] = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable);
  const [totalProducts] = await db.select({ count: sql<number>`COUNT(*)` }).from(productsTable);

  const recentRows = await db
    .select({ order: ordersTable, user: usersTable })
    .from(ordersTable)
    .innerJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

  const recentOrders = recentRows.map((r) => ({
    id: r.order.id,
    userId: r.order.userId,
    customerName: r.user.name,
    customerEmail: r.user.email,
    items: r.order.items,
    total: Number(r.order.total),
    status: r.order.status,
    shippingAddress: r.order.shippingAddress,
    createdAt: r.order.createdAt,
  }));

  res.json({
    totalRevenue: Number(totalRevenue?.total ?? 0),
    totalOrders: Number(totalOrders?.count ?? 0),
    totalCustomers: Number(totalCustomers?.count ?? 0),
    totalProducts: Number(totalProducts?.count ?? 0),
    recentOrders,
    topProducts: [],
  });
});

router.get("/admin/customers", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
  })));
});

export default router;
