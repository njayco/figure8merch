import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import {
  db,
  usersTable,
  cartItemsTable,
  ordersTable,
  checkoutSnapshotsTable,
  productVariantsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";
import { getStripeProductSummaries, getVariantsForProducts } from "../lib/stripeDb";

const router: IRouter = Router();

router.get("/stripe/config", async (_req, res): Promise<void> => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    res.status(500).json({ error: "Stripe not configured" });
  }
});

interface CartLineSnapshot {
  productId: string;
  productName: string;
  stripePriceId: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
}

router.post("/stripe/create-checkout-session", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { shippingAddress, successUrl, cancelUrl } = req.body as {
      shippingAddress?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    // Validate redirect URLs match the request origin to prevent open-redirect misuse
    const requestOrigin = req.headers.origin ?? `https://${req.headers.host}`;
    for (const [label, url] of [["successUrl", successUrl], ["cancelUrl", cancelUrl]] as const) {
      if (url) {
        try {
          const parsed = new URL(url);
          const allowed = new URL(requestOrigin);
          if (parsed.origin !== allowed.origin) {
            res.status(400).json({ error: `${label} must be on the same origin as this request.` });
            return;
          }
        } catch {
          res.status(400).json({ error: `${label} is not a valid URL.` });
          return;
        }
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

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

    const missingPrices = cartRows.filter((r) => {
      const p = productMap.get(r.productId);
      return !p || !p.price_id;
    });
    if (missingPrices.length > 0) {
      const names = missingPrices.map((r) => productMap.get(r.productId)?.name ?? r.productId);
      res.status(400).json({
        error: `Some cart items no longer have an active price: ${names.join(", ")}. Please remove them and try again.`,
      });
      return;
    }

    const cartSnapshot: CartLineSnapshot[] = cartRows.map((r) => {
      const p = productMap.get(r.productId)!;
      return {
        productId: r.productId,
        productName: p.name,
        stripePriceId: p.price_id!,
        price: p.unit_amount != null ? p.unit_amount / 100 : 0,
        size: r.size,
        color: r.color ?? "",
        quantity: r.quantity,
      };
    });

    // Pre-flight: ensure variant inventory exists for any products that have variants configured.
    // This rejects checkout up front so the user never reaches Stripe with a stale combo.
    const variantMap = await getVariantsForProducts(productIds);
    const insufficient: string[] = [];
    for (const line of cartSnapshot) {
      const variants = variantMap.get(line.productId);
      if (!variants || variants.length === 0) continue; // legacy product, no per-variant stock
      const v = variants.find((x) => x.size === line.size && x.color === line.color);
      if (!v || v.stock < line.quantity) {
        insufficient.push(`${line.productName} (${line.size}, ${line.color || "—"})`);
      }
    }
    if (insufficient.length > 0) {
      res.status(400).json({
        error: `Some items are out of stock or unavailable: ${insufficient.join(", ")}.`,
      });
      return;
    }

    // Aggregate quantities per price_id for Stripe line_items
    const lineItemMap = new Map<string, number>();
    for (const line of cartSnapshot) {
      lineItemMap.set(line.stripePriceId, (lineItemMap.get(line.stripePriceId) ?? 0) + line.quantity);
    }
    const lineItems = Array.from(lineItemMap.entries()).map(([price, quantity]) => ({ price, quantity }));

    const stripe = await getUncachableStripeClient();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db.update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: lineItems,
      success_url: successUrl ?? `${req.headers.origin}/`,
      cancel_url: cancelUrl ?? `${req.headers.origin}/`,
      // Only minimal fields in metadata — cart snapshot stored server-side in checkout_snapshots
      metadata: {
        userId: String(user.id),
      },
    });

    // Persist the cart snapshot in the DB keyed by Stripe session ID.
    // complete-order reads this instead of Stripe metadata (avoids 500-char Stripe limit).
    await db.insert(checkoutSnapshotsTable).values({
      sessionId: session.id,
      userId: req.userId!,
      shippingAddress: shippingAddress ?? "",
      items: JSON.stringify(cartSnapshot),
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    res.status(500).json({ error: message });
  }
});

router.post("/stripe/complete-order", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.payment_method"],
    });

    if (session.payment_status !== "paid") {
      res.status(400).json({ error: `Payment not completed. Status: ${session.payment_status}` });
      return;
    }

    const userId = Number(session.metadata?.userId);
    if (!userId || userId !== req.userId) {
      res.status(403).json({ error: "Session does not belong to this user" });
      return;
    }

    // Load the immutable cart snapshot from the DB (stored at session creation time)
    const [snapshot] = await db
      .select()
      .from(checkoutSnapshotsTable)
      .where(eq(checkoutSnapshotsTable.sessionId, sessionId));

    if (!snapshot) {
      res.status(400).json({ error: "Checkout snapshot not found. Contact support." });
      return;
    }

    // Defense-in-depth: snapshot userId must also match the authenticated user
    if (snapshot.userId !== req.userId) {
      res.status(403).json({ error: "Session does not belong to this user" });
      return;
    }

    let cartSnapshot: CartLineSnapshot[] = [];
    try {
      cartSnapshot = JSON.parse(snapshot.items);
    } catch {
      res.status(400).json({ error: "Checkout snapshot corrupted. Contact support." });
      return;
    }

    const total = (session.amount_total ?? 0) / 100;

    // Extract payment details from the expanded payment intent/payment method.
    // session.payment_intent is string | PaymentIntent; we requested expand so it's an object.
    const paymentIntent: Stripe.PaymentIntent | null =
      typeof session.payment_intent === "object" && session.payment_intent !== null
        ? (session.payment_intent as Stripe.PaymentIntent)
        : null;
    const stripePaymentStatus = paymentIntent?.status ?? "succeeded";
    // payment_method is string | PaymentMethod after expand; cast to expanded type.
    const paymentMethod: Stripe.PaymentMethod | null =
      paymentIntent && typeof paymentIntent.payment_method === "object" && paymentIntent.payment_method !== null
        ? (paymentIntent.payment_method as Stripe.PaymentMethod)
        : null;
    const cardLast4 = paymentMethod?.type === "card" ? (paymentMethod.card?.last4 ?? null) : null;

    try {
      // Decrement variant stock atomically. We use a guarded UPDATE so we never go negative.
      // If a row is missing (no variants configured for this product), we skip it — that's
      // the legacy "no inventory tracked" path. If a guarded update affects zero rows, we
      // know we ran out of stock and we abort the order.
      const productIdsInOrder = [...new Set(cartSnapshot.map((l) => l.productId))];
      const variantsByProduct = await getVariantsForProducts(productIdsInOrder);

      for (const line of cartSnapshot) {
        const tracked = variantsByProduct.get(line.productId);
        if (!tracked || tracked.length === 0) continue;
        const result = await db
          .update(productVariantsTable)
          .set({ stock: sql`${productVariantsTable.stock} - ${line.quantity}` })
          .where(
            and(
              eq(productVariantsTable.productId, line.productId),
              eq(productVariantsTable.size, line.size),
              eq(productVariantsTable.color, line.color),
              sql`${productVariantsTable.stock} >= ${line.quantity}`,
            ),
          )
          .returning({ id: productVariantsTable.id });
        if (result.length === 0) {
          res.status(409).json({
            error: `Sorry, ${line.productName} (${line.size}, ${line.color || "—"}) sold out before your order could be finalized. Please contact support to arrange a refund.`,
          });
          return;
        }
      }

      const [order] = await db.insert(ordersTable).values({
        userId,
        items: cartSnapshot,
        total: String(total),
        status: "processing",
        shippingAddress: snapshot.shippingAddress,
        stripeCheckoutSessionId: sessionId,
        stripePaymentStatus,
        cardLast4,
      }).returning();

      await db.delete(cartItemsTable).where(eq(cartItemsTable.userId, userId));

      // Clean up the snapshot now that the order is persisted
      await db.delete(checkoutSnapshotsTable).where(eq(checkoutSnapshotsTable.sessionId, sessionId));

      res.json({ orderId: order.id });
    } catch (insertErr: unknown) {
      const message = insertErr instanceof Error ? insertErr.message : "";
      if (message.includes("orders_stripe_session_unique") || message.includes("unique constraint")) {
        const [existing] = await db
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.stripeCheckoutSessionId, sessionId));
        if (existing) {
          res.json({ orderId: existing.id, alreadyCreated: true });
          return;
        }
      }
      throw insertErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to complete order";
    res.status(500).json({ error: message });
  }
});

export default router;
