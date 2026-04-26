import { Router, type IRouter } from "express";
import { CreateProductBody, UpdateProductVariantStockBody } from "@workspace/api-zod";
import { db, productVariantsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  listStripeProducts,
  getStripeProduct,
  toProductShape,
  countActiveStripeProducts,
  getVariantsForProduct,
  getVariantsForProducts,
  type VariantRow,
} from "../lib/stripeDb";
import { requireAdmin } from "../middlewares/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import type Stripe from "stripe";

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

interface ValidatedProductBody {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  sizes: string[];
  colors: string[];
  variants: Array<{ size: string; color: string; stock: number }>;
  isFeatured: boolean;
}

function validateProductBody(
  body: unknown,
): { ok: true; data: ValidatedProductBody } | { ok: false; error: string } {
  const parsed = CreateProductBody.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i: { message: string }) => i.message).join("; ");
    return { ok: false, error: message || "Invalid product data" };
  }

  const { name, description, price, imageUrl, category, sizes, colors, variants, isFeatured } =
    parsed.data;

  if (!name.trim() || !description.trim() || !category.trim()) {
    return { ok: false, error: "Name, description, and category are required" };
  }
  if (price <= 0) {
    return { ok: false, error: "Price must be positive" };
  }
  if (sizes.length === 0 || colors.length === 0 || variants.length === 0) {
    return { ok: false, error: "At least one size, color, and variant is required" };
  }
  for (const v of variants) {
    if (!Number.isInteger(v.stock) || v.stock < 0) {
      return { ok: false, error: `Invalid stock for ${v.size}/${v.color}` };
    }
  }

  const sizeSet = new Set(sizes);
  const colorSet = new Set(colors);
  for (const v of variants) {
    if (!sizeSet.has(v.size) || !colorSet.has(v.color)) {
      return {
        ok: false,
        error: `Variant ${v.size}/${v.color} does not match the configured sizes/colors`,
      };
    }
  }

  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.size}::${v.color}`;
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate variant ${v.size}/${v.color}` };
    }
    seen.add(key);
  }

  return {
    ok: true,
    data: {
      name,
      description,
      price,
      imageUrl: imageUrl ?? "",
      category,
      sizes,
      colors,
      variants,
      isFeatured: !!isFeatured,
    },
  };
}

function buildAbsoluteImageUrl(req: { headers: Record<string, unknown> }, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http")) return trimmed;
  const proto = req.headers["x-forwarded-proto"] as string | undefined;
  const host = req.headers["host"] as string | undefined;
  const origin = proto ? `${proto.split(",")[0]}://${host}` : `https://${host}`;
  return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

router.post("/products", requireAdmin, async (req, res): Promise<void> => {
  const validated = validateProductBody(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  const { name, description, price, imageUrl, category, sizes, colors, variants, isFeatured } =
    validated.data;

  const absoluteImageUrl = buildAbsoluteImageUrl(req, imageUrl);

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

    try {
      await db.insert(productVariantsTable).values(
        variants.map((v) => ({
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

router.put("/products/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const validated = validateProductBody(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  const { name, description, price, imageUrl, category, sizes, colors, variants, isFeatured } =
    validated.data;

  const absoluteImageUrl = buildAbsoluteImageUrl(req, imageUrl);

  const stripe = await getUncachableStripeClient();

  // Fetch existing product so we can roll back fields on failure.
  let existing: Stripe.Product;
  try {
    existing = await stripe.products.retrieve(id);
  } catch {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  if (!existing || existing.deleted || existing.active === false) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const oldName = existing.name;
  const oldDescription = existing.description ?? null;
  const oldImages: string[] = Array.isArray(existing.images) ? existing.images : [];
  const oldMetadata: Record<string, string> = (existing.metadata ?? {}) as Record<string, string>;
  const oldDefaultPriceId =
    typeof existing.default_price === "string"
      ? existing.default_price
      : existing.default_price?.id ?? null;

  let oldUnitAmount: number | null = null;
  if (oldDefaultPriceId) {
    try {
      const cp = await stripe.prices.retrieve(oldDefaultPriceId);
      oldUnitAmount = cp.unit_amount ?? null;
    } catch {
      oldUnitAmount = null;
    }
  }

  const oldVariants = await getVariantsForProduct(id);

  const newUnitAmount = Math.round(price * 100);
  const priceChanged = newUnitAmount !== oldUnitAmount;

  // Stripe metadata.update merges keys, so include every key we manage with explicit values
  // (empty string deletes a key).
  const newMetadata: Record<string, string> = {
    category,
    sizes: sizes.join(","),
    colors: colors.join(","),
    featured: isFeatured ? "true" : "false",
  };
  // Preserve any metadata keys we don't manage by including them too.
  for (const [k, v] of Object.entries(oldMetadata)) {
    if (!(k in newMetadata)) newMetadata[k] = v;
  }

  let stripeProductUpdated = false;
  let stripeDefaultPriceUpdated = false;
  let newPriceId: string | null = null;
  let dbReplaced = false;

  const restoreStripeProduct = async () => {
    try {
      await stripe.products.update(id, {
        name: oldName,
        description: oldDescription ?? undefined,
        images: oldImages,
        metadata: oldMetadata,
        ...(stripeDefaultPriceUpdated && oldDefaultPriceId
          ? { default_price: oldDefaultPriceId }
          : {}),
      });
    } catch {
      // best-effort rollback
    }
  };

  const restoreDb = async () => {
    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(productVariantsTable)
          .where(eq(productVariantsTable.productId, id));
        if (oldVariants.length > 0) {
          await tx.insert(productVariantsTable).values(
            oldVariants.map((v: VariantRow) => ({
              productId: id,
              size: v.size,
              color: v.color,
              stock: v.stock,
            })),
          );
        }
      });
    } catch {
      // best-effort
    }
  };

  try {
    const updateParams: Stripe.ProductUpdateParams = {
      name,
      description,
      metadata: newMetadata,
      images: absoluteImageUrl ? [absoluteImageUrl] : [],
    };
    await stripe.products.update(id, updateParams);
    stripeProductUpdated = true;

    let effectivePriceId = oldDefaultPriceId ?? "";
    if (priceChanged) {
      const newPrice = await stripe.prices.create({
        product: id,
        unit_amount: newUnitAmount,
        currency: "usd",
      });
      newPriceId = newPrice.id;
      effectivePriceId = newPrice.id;
      await stripe.products.update(id, { default_price: newPrice.id });
      stripeDefaultPriceUpdated = true;
      // Deactivate old price (best-effort) so it stops appearing in lists.
      if (oldDefaultPriceId) {
        try {
          await stripe.prices.update(oldDefaultPriceId, { active: false });
        } catch {
          // ignore
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(productVariantsTable)
        .where(eq(productVariantsTable.productId, id));
      await tx.insert(productVariantsTable).values(
        variants.map((v) => ({
          productId: id,
          size: v.size,
          color: v.color,
          stock: v.stock,
        })),
      );
    });
    dbReplaced = true;

    const dbVariants = await getVariantsForProduct(id);

    res.json(
      toProductShape(
        {
          id,
          name,
          description,
          metadata: newMetadata,
          images: absoluteImageUrl ? [absoluteImageUrl] : [],
          created: existing.created ?? null,
          price_id: effectivePriceId || null,
          unit_amount: newUnitAmount,
        },
        dbVariants,
      ),
    );
  } catch (err: unknown) {
    if (dbReplaced) {
      await restoreDb();
    }
    if (newPriceId) {
      try {
        await stripe.prices.update(newPriceId, { active: false });
      } catch {
        // ignore
      }
    }
    if (priceChanged && oldDefaultPriceId && newPriceId) {
      try {
        await stripe.prices.update(oldDefaultPriceId, { active: true });
      } catch {
        // ignore
      }
    }
    if (stripeProductUpdated) {
      await restoreStripeProduct();
    }
    const message = err instanceof Error ? err.message : "Failed to update product";
    res.status(500).json({ error: message });
  }
});

router.patch(
  "/products/:id/variant",
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = UpdateProductVariantStockBody.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i: { message: string }) => i.message)
        .join("; ");
      res.status(400).json({ error: message || "Invalid variant data" });
      return;
    }
    const { size, color, stock } = parsed.data;
    if (!Number.isInteger(stock) || stock < 0) {
      res.status(400).json({ error: "Stock must be a non-negative whole number" });
      return;
    }

    try {
      const updated = await db
        .update(productVariantsTable)
        .set({ stock })
        .where(
          and(
            eq(productVariantsTable.productId, id),
            eq(productVariantsTable.size, size),
            eq(productVariantsTable.color, color),
          ),
        )
        .returning();

      if (updated.length === 0) {
        res
          .status(404)
          .json({ error: `No variant found for ${size}/${color} on this product` });
        return;
      }

      res.json({
        size: updated[0].size,
        color: updated[0].color,
        stock: updated[0].stock,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update variant";
      res.status(500).json({ error: message });
    }
  },
);

router.delete("/products/:id", requireAdmin, async (_req, res): Promise<void> => {
  res
    .status(400)
    .json({ error: "Use the Stripe Dashboard to manage products. Changes sync automatically." });
});

export { countActiveStripeProducts };
export default router;
