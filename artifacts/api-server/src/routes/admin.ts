import { Router, type IRouter } from "express";
import { db, productVariantsTable } from "@workspace/db";
import { eq, lte, asc, sql } from "drizzle-orm";
import { RestockVariantBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth";
import { getStripeProductsByIds } from "../lib/stripeDb";
import { LOW_STOCK_THRESHOLD } from "../lib/inventory";

const router: IRouter = Router();

type VariantStatus = "low" | "out" | "ok";

interface LowStockVariantShape {
  id: number;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  size: string;
  color: string;
  stock: number;
  status: VariantStatus;
}

function classifyStatus(stock: number): VariantStatus {
  if (stock === 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

router.get("/admin/inventory", requireAdmin, async (_req, res): Promise<void> => {
  // Pull every variant at or below the low-stock threshold (which includes 0 = sold out).
  // Sort sold-out first (stock asc), then by product so the table is easy to scan.
  const rows = await db
    .select()
    .from(productVariantsTable)
    .where(lte(productVariantsTable.stock, LOW_STOCK_THRESHOLD))
    .orderBy(asc(productVariantsTable.stock), asc(productVariantsTable.productId));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const stripeProducts = await getStripeProductsByIds(productIds);
  const productMap = new Map(stripeProducts.map((p) => [p.id, p]));

  const items: LowStockVariantShape[] = rows.map((r) => {
    const product = productMap.get(r.productId);
    return {
      id: r.id,
      productId: r.productId,
      productName: product?.name ?? "Unknown product",
      productImageUrl:
        product && Array.isArray(product.images) && product.images.length > 0
          ? product.images[0]
          : null,
      size: r.size,
      color: r.color,
      stock: r.stock,
      status: classifyStatus(r.stock),
    };
  });

  res.json(items);
});

router.post(
  "/admin/variants/:id/restock",
  requireAdmin,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid variant id" });
      return;
    }

    const parsed = RestockVariantBody.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i: { message: string }) => i.message)
        .join("; ");
      res.status(400).json({ error: message || "Invalid restock amount" });
      return;
    }
    const { amount } = parsed.data;

    // Atomic increment so concurrent restocks don't lose updates.
    const [updated] = await db
      .update(productVariantsTable)
      .set({ stock: sql`${productVariantsTable.stock} + ${amount}` })
      .where(eq(productVariantsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Variant not found" });
      return;
    }

    // Hydrate product name/image so the client can update its row in place
    const stripeProducts = await getStripeProductsByIds([updated.productId]);
    const product = stripeProducts[0];

    const shape: LowStockVariantShape = {
      id: updated.id,
      productId: updated.productId,
      productName: product?.name ?? "Unknown product",
      productImageUrl:
        product && Array.isArray(product.images) && product.images.length > 0
          ? product.images[0]
          : null,
      size: updated.size,
      color: updated.color,
      stock: updated.stock,
      status: classifyStatus(updated.stock),
    };

    res.json(shape);
  },
);

export default router;
