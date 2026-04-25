import app from "./app";
import { logger } from "./lib/logger";
import { initAdmin } from "./lib/initAdmin";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, resetStripeSync } from "./lib/stripeClient";
import { setStripeStatus } from "./lib/stripeStatus";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe init");
    setStripeStatus("failed", "DATABASE_URL not set");
    if (process.env.NODE_ENV === "production") {
      logger.error("Exiting: Stripe cannot initialize without DATABASE_URL in production");
      process.exit(1);
    }
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: 'stripe' });
    logger.info("Stripe schema ready");

    // Reset singleton so getStripeSync() picks up freshly migrated tables
    resetStripeSync();
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    setStripeStatus("ready");

    // Sync existing data in the background (don't block startup)
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: any) => logger.error({ err }, "Stripe backfill error"));
  } catch (err: any) {
    const message = err?.message ?? String(err);
    logger.error({ err }, "Failed to initialize Stripe");
    setStripeStatus("failed", message);
    if (process.env.NODE_ENV === "production") {
      logger.error("Exiting: Stripe initialization failed in production");
      process.exit(1);
    }
  }
}

// Ensure admin user exists with current credentials from environment secrets
await initAdmin();

// Initialize Stripe schema and sync
await initStripe();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
