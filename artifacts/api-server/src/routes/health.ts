import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getStripeStatus } from "../lib/stripeStatus";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const base = HealthCheckResponse.parse({ status: "ok" });
  const stripe = getStripeStatus();
  const isHealthy = stripe.status === "ready" || stripe.status === "initializing";

  const body = {
    ...base,
    stripe: {
      status: stripe.status,
      ...(stripe.error ? { error: stripe.error } : {}),
    },
  };

  res.status(isHealthy ? 200 : 503).json(body);
});

export default router;
