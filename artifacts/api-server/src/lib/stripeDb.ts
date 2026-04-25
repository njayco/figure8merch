import { db, productVariantsTable } from "@workspace/db";
import { sql, SQL, inArray, eq } from "drizzle-orm";

export interface StripeProductRow {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string> | null;
  images: string[] | null;
  created: number | null;
  price_id: string | null;
  unit_amount: number | null;
}

export interface VariantRow {
  size: string;
  color: string;
  stock: number;
}

export interface StripeProductSummary {
  id: string;
  name: string;
  unit_amount: number | null;
  price_id: string | null;
}

async function executeRaw<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

// Picks exactly one canonical price per product:
// prefers the product's default_price, otherwise the most recently created active price.
const canonicalPriceJoin = sql`
  LEFT JOIN LATERAL (
    SELECT id, unit_amount
    FROM stripe.prices
    WHERE product = p.id AND active = true
    ORDER BY (id = p.default_price) DESC, created DESC
    LIMIT 1
  ) pr ON true
`;

export async function listStripeProducts(filters?: {
  category?: string;
  featured?: string;
  search?: string;
}): Promise<StripeProductRow[]> {
  const conditions: SQL[] = [sql`p.active = true`, sql`pr.id IS NOT NULL`];

  if (filters?.category) {
    conditions.push(sql`p.metadata->>'category' = ${filters.category}`);
  }
  if (filters?.featured === "true") {
    conditions.push(sql`p.metadata->>'featured' = 'true'`);
  }
  if (filters?.search) {
    conditions.push(sql`p.name ILIKE ${"%" + filters.search + "%"}`);
  }

  const whereClause = conditions.reduce(
    (acc, cond, i) => (i === 0 ? cond : sql`${acc} AND ${cond}`),
  );

  return executeRaw<StripeProductRow>(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.metadata,
      p.images,
      p.created,
      pr.id AS price_id,
      pr.unit_amount
    FROM stripe.products p
    ${canonicalPriceJoin}
    WHERE ${whereClause}
    ORDER BY p.created DESC
  `);
}

export async function getStripeProduct(id: string): Promise<StripeProductRow | null> {
  const rows = await executeRaw<StripeProductRow>(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.metadata,
      p.images,
      p.created,
      pr.id AS price_id,
      pr.unit_amount
    FROM stripe.products p
    ${canonicalPriceJoin}
    WHERE p.id = ${id} AND p.active = true AND pr.id IS NOT NULL
  `);
  return rows[0] ?? null;
}

export async function getStripeProductsByIds(ids: string[]): Promise<StripeProductRow[]> {
  if (ids.length === 0) return [];
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  return executeRaw<StripeProductRow>(sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.metadata,
      p.images,
      p.created,
      pr.id AS price_id,
      pr.unit_amount
    FROM stripe.products p
    ${canonicalPriceJoin}
    WHERE p.id IN (${idList}) AND p.active = true AND pr.id IS NOT NULL
  `);
}

export async function getStripeProductSummaries(ids: string[]): Promise<StripeProductSummary[]> {
  if (ids.length === 0) return [];
  const idList = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  return executeRaw<StripeProductSummary>(sql`
    SELECT
      p.id,
      p.name,
      pr.id AS price_id,
      pr.unit_amount
    FROM stripe.products p
    ${canonicalPriceJoin}
    WHERE p.id IN (${idList}) AND p.active = true AND pr.id IS NOT NULL
  `);
}

export async function countActiveStripeProducts(): Promise<number> {
  const rows = await executeRaw<{ count: string }>(sql`
    SELECT COUNT(*) AS count
    FROM stripe.products p
    ${canonicalPriceJoin}
    WHERE p.active = true AND pr.id IS NOT NULL
  `);
  return Number(rows[0]?.count ?? 0);
}

function parseList(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function getVariantsForProducts(
  ids: string[],
): Promise<Map<string, VariantRow[]>> {
  const map = new Map<string, VariantRow[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select()
    .from(productVariantsTable)
    .where(inArray(productVariantsTable.productId, ids));
  for (const r of rows) {
    const arr = map.get(r.productId) ?? [];
    arr.push({ size: r.size, color: r.color, stock: r.stock });
    map.set(r.productId, arr);
  }
  return map;
}

export async function getVariantsForProduct(id: string): Promise<VariantRow[]> {
  const rows = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, id));
  return rows.map((r) => ({ size: r.size, color: r.color, stock: r.stock }));
}

export function toProductShape(p: StripeProductRow, variants: VariantRow[] = []) {
  const totalStock =
    variants.length === 0 ? null : variants.reduce((s, v) => s + v.stock, 0);
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: p.unit_amount != null ? p.unit_amount / 100 : 0,
    imageUrl: Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : "",
    category: p.metadata?.category ?? "other",
    sizes: parseList(p.metadata?.sizes),
    colors: parseList(p.metadata?.colors),
    variants,
    totalStock,
    isFeatured: p.metadata?.featured === "true",
    createdAt: p.created ? new Date(p.created * 1000) : new Date(),
    stripePriceId: p.price_id ?? "",
  };
}

export const toCartProductShape = toProductShape;
