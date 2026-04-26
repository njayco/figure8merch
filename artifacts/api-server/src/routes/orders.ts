import { Router, type IRouter } from "express";
import { db, ordersTable, cartItemsTable, usersTable, productVariantsTable } from "@workspace/db";
import { eq, desc, sql, and, gt, lte } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin, type AuthRequest } from "../middlewares/auth";
import {
  getStripeProductSummaries,
  countActiveStripeProducts,
  getStripeProductImagesByIds,
} from "../lib/stripeDb";
import { LOW_STOCK_THRESHOLD } from "../lib/inventory";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { sendShippedEmail, sendDeliveredEmail } from "../lib/orderEmails";

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

const VALID_ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;
type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

const DEFAULT_DELIVERY_WINDOW_DAYS = 5;

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
    trackingNumber: order.trackingNumber ?? null,
    carrier: order.carrier ?? null,
    shippedAt: order.shippedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    estimatedDeliveryAt: order.estimatedDeliveryAt ?? null,
    createdAt: order.createdAt,
  };
}

function toAdminOrderShape(
  order: typeof ordersTable.$inferSelect,
  user: typeof usersTable.$inferSelect,
  imageMap?: Map<string, string | null>,
  currentPriceMap?: Map<string, number | null>,
) {
  const items = order.items.map((item) => {
    const next: Record<string, unknown> = { ...item };
    if (imageMap) next.imageUrl = imageMap.get(item.productId) ?? null;
    if (currentPriceMap) {
      // Default to null when the lookup didn't find a current price (e.g. the
      // product was archived) so the admin UI can render "—" instead of
      // crashing or pretending it matches.
      next.currentPrice = currentPriceMap.has(item.productId)
        ? currentPriceMap.get(item.productId) ?? null
        : null;
    }
    return next;
  });
  return {
    id: order.id,
    userId: order.userId,
    customerName: user.name,
    customerEmail: user.email,
    items,
    total: Number(order.total),
    status: order.status,
    shippingAddress: order.shippingAddress,
    trackingNumber: order.trackingNumber ?? null,
    carrier: order.carrier ?? null,
    shippedAt: order.shippedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    estimatedDeliveryAt: order.estimatedDeliveryAt ?? null,
    createdAt: order.createdAt,
  };
}

async function buildOrderImageMap(
  orders: Array<typeof ordersTable.$inferSelect>,
): Promise<Map<string, string | null>> {
  const productIds = new Set<string>();
  for (const o of orders) {
    for (const item of o.items) {
      if (item.productId) productIds.add(item.productId);
    }
  }
  // Use the unfiltered images-by-id lookup so historical orders that reference
  // products that have since been deactivated/archived in Stripe still show
  // their photo in the admin orders table — admins triaging past orders need
  // the visual cue regardless of current product status.
  return getStripeProductImagesByIds([...productIds]);
}

// Build a productId -> current sticker price (in dollars) map for every
// product referenced by the given orders. This powers the "charged $X / now $Y"
// diff in the admin orders view: getStripeProductSummaries only returns
// currently active products, so anything missing from the map (archived
// products, products whose canonical price couldn't be resolved) becomes a
// null entry and the UI renders "—" rather than misleadingly matching.
async function buildOrderCurrentPriceMap(
  orders: Array<typeof ordersTable.$inferSelect>,
): Promise<Map<string, number | null>> {
  const productIds = new Set<string>();
  for (const o of orders) {
    for (const item of o.items) {
      if (item.productId) productIds.add(item.productId);
    }
  }
  const map = new Map<string, number | null>();
  if (productIds.size === 0) return map;
  for (const id of productIds) map.set(id, null);
  const summaries = await getStripeProductSummaries([...productIds]);
  for (const s of summaries) {
    map.set(s.id, s.unit_amount != null ? s.unit_amount / 100 : null);
  }
  return map;
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
        color: r.color ?? "",
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

  const orderList = rows.map((r) => r.order);
  const [imageMap, currentPriceMap] = await Promise.all([
    buildOrderImageMap(orderList),
    buildOrderCurrentPriceMap(orderList),
  ]);
  res.json(
    rows.map((r) => toAdminOrderShape(r.order, r.user, imageMap, currentPriceMap)),
  );
});

router.patch("/admin/orders/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }

  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, trackingNumber, carrier, estimatedDeliveryAt } = parsed.data;

  if (!VALID_ORDER_STATUSES.includes(status as OrderStatus)) {
    res.status(400).json({ error: "Invalid status value" });
    return;
  }

  const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const now = new Date();
  const updates: Partial<typeof ordersTable.$inferInsert> = { status };

  if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
  if (carrier !== undefined) updates.carrier = carrier;

  // Decide whether to send a transactional email. The notifiedShippedAt /
  // notifiedDeliveredAt flags are our sole idempotency check: stamped only
  // after a successful send, so re-saving the same status after a successful
  // send is a no-op (no duplicate), but re-saving after a failed send WILL
  // retry — which is what the admin would expect when fixing a transient
  // delivery problem.
  const shouldSendShipped = status === "shipped" && !existing.notifiedShippedAt;
  const shouldSendDelivered = status === "delivered" && !existing.notifiedDeliveredAt;

  // Auto-stamp shipped/delivered timestamps when transitioning into those states
  if (status === "shipped" && !existing.shippedAt) {
    updates.shippedAt = now;
    if (!existing.estimatedDeliveryAt && estimatedDeliveryAt === undefined) {
      const eta = new Date(now);
      eta.setDate(eta.getDate() + DEFAULT_DELIVERY_WINDOW_DAYS);
      updates.estimatedDeliveryAt = eta;
    }
  }
  if (status === "delivered" && !existing.deliveredAt) {
    updates.deliveredAt = now;
    if (!existing.shippedAt) {
      updates.shippedAt = now;
    }
  }
  if (estimatedDeliveryAt !== undefined) {
    updates.estimatedDeliveryAt = estimatedDeliveryAt;
  }

  const [updated] = await db
    .update(ordersTable)
    .set(updates)
    .where(eq(ordersTable.id, id))
    .returning();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId));
  if (!user) {
    res.status(500).json({ error: "Order user not found" });
    return;
  }

  // Fire-and-await transactional emails on real transitions only. We mark the
  // notified-at flag only after a successful send so a transient email failure
  // can be retried by re-applying the same status from the dashboard.
  if (shouldSendShipped) {
    const sent = await sendShippedEmail(
      {
        id: updated.id,
        total: updated.total,
        trackingNumber: updated.trackingNumber,
        carrier: updated.carrier,
        shippedAt: updated.shippedAt,
        estimatedDeliveryAt: updated.estimatedDeliveryAt,
        shippingAddress: updated.shippingAddress,
        items: updated.items,
      },
      { email: user.email, name: user.name },
    );
    if (sent) {
      const [stamped] = await db
        .update(ordersTable)
        .set({ notifiedShippedAt: new Date() })
        .where(eq(ordersTable.id, id))
        .returning();
      res.json(toAdminOrderShape(stamped, user));
      return;
    }
  }

  if (shouldSendDelivered) {
    const sent = await sendDeliveredEmail(
      {
        id: updated.id,
        total: updated.total,
        trackingNumber: updated.trackingNumber,
        carrier: updated.carrier,
        shippedAt: updated.shippedAt,
        estimatedDeliveryAt: updated.estimatedDeliveryAt,
        shippingAddress: updated.shippingAddress,
        items: updated.items,
      },
      { email: user.email, name: user.name },
    );
    if (sent) {
      const [stamped] = await db
        .update(ordersTable)
        .set({ notifiedDeliveredAt: new Date() })
        .where(eq(ordersTable.id, id))
        .returning();
      res.json(toAdminOrderShape(stamped, user));
      return;
    }
  }

  res.json(toAdminOrderShape(updated, user));
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(${ordersTable.total}::numeric), 0)` }).from(ordersTable);
  const [totalOrders] = await db.select({ count: sql<number>`COUNT(*)` }).from(ordersTable);
  const [totalCustomers] = await db.select({ count: sql<number>`COUNT(*)` }).from(usersTable);
  const totalProducts = await countActiveStripeProducts();

  // Inventory health: count variants that are running low (1..threshold) or already out
  const [lowStockRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(productVariantsTable)
    .where(
      and(
        gt(productVariantsTable.stock, 0),
        lte(productVariantsTable.stock, LOW_STOCK_THRESHOLD),
      ),
    );
  const [outOfStockRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.stock, 0));

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

  const recentOrders = await (async () => {
    const orderList = recentRows.map((r) => r.order);
    const [imageMap, currentPriceMap] = await Promise.all([
      buildOrderImageMap(orderList),
      buildOrderCurrentPriceMap(orderList),
    ]);
    return recentRows.map((r) =>
      toAdminOrderShape(r.order, r.user, imageMap, currentPriceMap),
    );
  })();

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
    lowStockCount: Number(lowStockRow?.count ?? 0),
    outOfStockCount: Number(outOfStockRow?.count ?? 0),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
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
