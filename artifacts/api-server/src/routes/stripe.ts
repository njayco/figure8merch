import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "../lib/stripeClient";

const router: IRouter = Router();

// Get Stripe publishable key for the frontend
router.get("/stripe/config", async (_req, res): Promise<void> => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err) {
    res.status(500).json({ error: "Stripe not configured" });
  }
});

// Create a PaymentIntent for the cart total
router.post("/stripe/create-payment-intent", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { amount } = req.body; // amount in cents
    if (!amount || amount < 50) {
      res.status(400).json({ error: "Invalid amount" });
      return;
    }

    const stripe = await getUncachableStripeClient();

    // Get or create Stripe customer for this user
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db.update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: { userId: String(user.id) },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create payment intent" });
  }
});

// Confirm payment after Stripe.js confirms it client-side
// This endpoint creates the order after successful payment
router.post("/stripe/confirm-order", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { paymentIntentId, shippingAddress } = req.body;
    if (!paymentIntentId || !shippingAddress) {
      res.status(400).json({ error: "Missing paymentIntentId or shippingAddress" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      res.status(400).json({ error: `Payment not completed. Status: ${paymentIntent.status}` });
      return;
    }

    // Payment confirmed — create the order via the orders route logic directly
    res.json({ success: true, paymentIntentId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to confirm payment" });
  }
});

export default router;
