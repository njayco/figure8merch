import { Router, type IRouter } from "express";
import { db, ordersTable, cartItemsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { CreateOrderBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import { getStripeProductSummaries, countActiveStripeProducts } from "../lib/stripeDb";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

const STRIPE_REVENUE_CACHE_TTL_MS = 60_000;
let stripeRevenueCache: { value: number; expiresAt: number } | null = null;

async function fetchStripeRevenue(): Promise<number> {
  const now = Date.now();
  if (stripeRevenueCache && stripeRevenueCache.expiresAt > now) {
    return stripeRevenueCache.value;
  }

  const stripe = await getUncachableStripeClient();
  let totalCents = 0;
  let startingAfter: string | undefined = undefined;
  const pageSize = 100;

  while (true) {
    const params: { limit: number; starting_after?: string } = { limit: pageSize };
    if (startingAfter) params.starting_after = startingAfter;
    const page = await stripe.paymentIntents.list(params);

    for (const pi of page.data) {
      if (pi.status === "succeeded") {
        totalCents += pi.amount_received ?? 0;
      }
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  const revenue = totalCents / 100;
  stripeRevenueCache = { value: revenue, expiresAt: Date.now() + STRIPE_REVENUE_CACHE_TTL_MS };
  return revenue;
}

function toOrderShape(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    total: Number(order.total),
    status: order.status,
    shippingAddress: order.shippingAddress,
    stripePaymentStatus: order.stripePaymentStatus ?? null,
    cardLast4: order.cardLast4 ?? null,
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
  // Block direct order creation unless explicitly opted in via ALLOW_SIMULATED_CHECKOUT=true.
  // This prevents payment bypass: orders must go through /stripe/create-checkout-session
  // → /stripe/complete-order so Stripe verifies funds before the order is created.
  const simulatedAllowed = process.env.ALLOW_SIMULATED_CHECKOUT === "true";
  if (!simulatedAllowed) {
    res.status(400).json({
      error: "Direct order creation is disabled. Please complete payment through Stripe Checkout.",
    });
    return;
  }

  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const cartRows = await db
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.userId, req.userId!));

    if (cartRows.length === 0) {
      res.status(400).json({ error: "Cart is empty" });
      return;
    }

    const productIds = [...new Set(cartRows.map((r) => r.productId))];
    const stripeProducts = await getStripeProductSummaries(productIds);
    const productMap = new Map(stripeProducts.map((p) => [p.id, p]));

    const items = cartRows.map((r) => {
      const p = productMap.get(r.productId);
      return {
        productId: r.productId,
        productName: p?.name ?? "Unknown Product",
        stripePriceId: p?.price_id ?? "",
        price: p?.unit_amount != null ? p.unit_amount / 100 : 0,
        quantity: r.quantity,
        size: r.size,
      };
    });

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create order";
    res.status(500).json({ error: message });
  }
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
  const totalProducts = await countActiveStripeProducts();

  // Top 5 products by total units sold, computed by expanding the order items JSONB array.
  // Revenue is summed as price * quantity per line item.
  const topProductsRows = await db.execute<{
    product_id: string;
    product_name: string;
    total_sold: string | number;
    revenue: string | number;
  }>(sql`
    SELECT
      item->>'productId' AS product_id,
      MAX(item->>'productName') AS product_name,
      SUM((item->>'quantity')::int) AS total_sold,
      SUM((item->>'price')::numeric * (item->>'quantity')::int) AS revenue
    FROM ${ordersTable},
      jsonb_array_elements(${ordersTable.items}) AS item
    WHERE item->>'productId' IS NOT NULL
    GROUP BY item->>'productId'
    ORDER BY total_sold DESC, revenue DESC
    LIMIT 5
  `);

  const topProducts = topProductsRows.rows.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    totalSold: Number(r.total_sold ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));

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

  // Fetch actual revenue from Stripe by summing all succeeded payment intents.
  // Paginates through every page so revenue stays accurate beyond 100 transactions;
  // result is cached briefly to keep this endpoint responsive.
  let stripeRevenue = 0;
  try {
    stripeRevenue = await fetchStripeRevenue();
  } catch {
    stripeRevenue = Number(totalRevenue?.total ?? 0);
  }

  res.json({
    totalRevenue: Number(totalRevenue?.total ?? 0),
    stripeRevenue,
    totalOrders: Number(totalOrders?.count ?? 0),
    totalCustomers: Number(totalCustomers?.count ?? 0),
    totalProducts,
    recentOrders,
    topProducts,
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
