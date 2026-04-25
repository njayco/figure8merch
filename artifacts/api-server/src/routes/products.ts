import { Router, type IRouter } from "express";
import { listStripeProducts, getStripeProduct, toProductShape, countActiveStripeProducts } from "../lib/stripeDb";
import { requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/products/featured", async (_req, res): Promise<void> => {
  try {
    const rows = await listStripeProducts({ featured: "true" });
    res.json(rows.map(toProductShape));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch featured products";
    res.status(500).json({ error: message });
  }
});

router.get("/products", async (req, res): Promise<void> => {
  try {
    const { category, featured, search } = req.query as {
      category?: string;
      featured?: string;
      search?: string;
    };
    const rows = await listStripeProducts({ category, featured, search });
    res.json(rows.map(toProductShape));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch products";
    res.status(500).json({ error: message });
  }
});

router.get("/products/:id", async (req, res): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const row = await getStripeProduct(id);
    if (!row) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    res.json(toProductShape(row));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch product";
    res.status(500).json({ error: message });
  }
});

router.post("/products", requireAdmin, async (_req, res): Promise<void> => {
  res.status(400).json({ error: "Use the Stripe Dashboard to create products. Changes sync automatically." });
});

router.put("/products/:id", requireAdmin, async (_req, res): Promise<void> => {
  res.status(400).json({ error: "Use the Stripe Dashboard to update products. Changes sync automatically." });
});

router.delete("/products/:id", requireAdmin, async (_req, res): Promise<void> => {
  res.status(400).json({ error: "Use the Stripe Dashboard to manage products. Changes sync automatically." });
});

export { countActiveStripeProducts };
export default router;
