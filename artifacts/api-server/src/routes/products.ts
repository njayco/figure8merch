import { Router, type IRouter } from "express";
import { CreateProductBody } from "@workspace/api-zod";
import { db, productVariantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listStripeProducts,
  getStripeProduct,
  toProductShape,
  countActiveStripeProducts,
  getVariantsForProduct,
  getVariantsForProducts,
} from "../lib/stripeDb";
import { requireAdmin } from "../middlewares/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

router.get("/products/featured", async (_req, res): Promise<void> => {
  try {
    const rows = await listStripeProducts({ featured: "true" });
    const variants = await getVariantsForProducts(rows.map((r) => r.id));
    res.json(rows.map((r) => toProductShape(r, variants.get(r.id) ?? [])));
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
    const variants = await getVariantsForProducts(rows.map((r) => r.id));
    res.json(rows.map((r) => toProductShape(r, variants.get(r.id) ?? [])));
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
    const variants = await getVariantsForProduct(id);
    res.json(toProductShape(row, variants));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch product";
    res.status(500).json({ error: message });
  }
});

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i: { message: string }) => i.message).join("; ");
    res.status(400).json({ error: message || "Invalid product data" });
    return;
  }

  const { name, description, price, imageUrl, category, sizes, colors, variants, isFeatured } =
    parsed.data;

  if (!name.trim() || !description.trim() || !category.trim()) {
    res.status(400).json({ error: "Name, description, and category are required" });
    return;
  }
  if (price <= 0) {
    res.status(400).json({ error: "Price must be positive" });
    return;
  }
  if (sizes.length === 0 || colors.length === 0 || variants.length === 0) {
    res
      .status(400)
      .json({ error: "At least one size, color, and variant is required" });
    return;
  }
  for (const v of variants) {
    if (!Number.isInteger(v.stock) || v.stock < 0) {
      res.status(400).json({ error: `Invalid stock for ${v.size}/${v.color}` });
      return;
    }
  }

  // Validate every (size, color) variant matches one of the listed sizes and colors.
  const sizeSet = new Set(sizes);
  const colorSet = new Set(colors);
  for (const v of variants) {
    if (!sizeSet.has(v.size) || !colorSet.has(v.color)) {
      res.status(400).json({
        error: `Variant ${v.size}/${v.color} does not match the configured sizes/colors`,
      });
      return;
    }
  }

  // Reject duplicate variant combos in the request.
  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.size}::${v.color}`;
    if (seen.has(key)) {
      res.status(400).json({ error: `Duplicate variant ${v.size}/${v.color}` });
      return;
    }
    seen.add(key);
  }

  // Build absolute image URL for Stripe (Stripe rejects relative paths).
  const trimmedImageUrl = (imageUrl ?? "").trim();
  let absoluteImageUrl = "";
  if (trimmedImageUrl) {
    const requestOrigin =
      (req.headers["x-forwarded-proto"] as string | undefined)
        ? `${(req.headers["x-forwarded-proto"] as string).split(",")[0]}://${req.headers.host}`
        : `https://${req.headers.host}`;
    absoluteImageUrl = trimmedImageUrl.startsWith("http")
      ? trimmedImageUrl
      : `${requestOrigin}${trimmedImageUrl.startsWith("/") ? "" : "/"}${trimmedImageUrl}`;
  }

  let stripeProductId: string | null = null;
  try {
    const stripe = await getUncachableStripeClient();

    const stripeProduct = await stripe.products.create({
      name,
      description,
      ...(absoluteImageUrl ? { images: [absoluteImageUrl] } : {}),
      metadata: {
        category,
        sizes: sizes.join(","),
        colors: colors.join(","),
        featured: isFeatured ? "true" : "false",
      },
    });
    stripeProductId = stripeProduct.id;

    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(price * 100),
      currency: "usd",
    });

    await stripe.products.update(stripeProduct.id, { default_price: stripePrice.id });

    // Insert variant rows. If this fails, we deactivate the Stripe product to roll back.
    try {
      await db.insert(productVariantsTable).values(
        variants.map((v: { size: string; color: string; stock: number }) => ({
          productId: stripeProduct.id,
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
      );
    } catch (variantErr) {
      try {
        await stripe.products.update(stripeProduct.id, { active: false });
      } catch {
        // ignore rollback failure; surface original error below
      }
      // Also clean any partial variant rows
      await db
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.productId, stripeProduct.id));
      throw variantErr;
    }

    const dbVariants = await getVariantsForProduct(stripeProduct.id);

    res.status(201).json(
      toProductShape(
        {
          id: stripeProduct.id,
          name: stripeProduct.name,
          description: stripeProduct.description ?? null,
          metadata: (stripeProduct.metadata ?? null) as Record<string, string> | null,
          images: stripeProduct.images ?? null,
          created: stripeProduct.created ?? null,
          price_id: stripePrice.id,
          unit_amount: stripePrice.unit_amount ?? null,
        },
        dbVariants,
      ),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create product";
    res.status(500).json({ error: message });
  }
});

router.put("/products/:id", requireAdmin, async (_req, res): Promise<void> => {
  res
    .status(400)
    .json({ error: "Use the Stripe Dashboard to update products. Changes sync automatically." });
});

router.delete("/products/:id", requireAdmin, async (_req, res): Promise<void> => {
  res
    .status(400)
    .json({ error: "Use the Stripe Dashboard to manage products. Changes sync automatically." });
});

export { countActiveStripeProducts };
export default router;
