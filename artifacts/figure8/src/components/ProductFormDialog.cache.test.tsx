import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Product } from "@workspace/api-client-react";

const updateMutate = vi.fn();
const createMutate = vi.fn();
let nextSavedProduct: Product | null = null;
let nextError: Error | null = null;

vi.mock("@workspace/api-client-react", async () => {
  return {
    useUpdateProduct: () => ({
      mutate: (
        variables: { id: string; data: unknown },
        opts?: { onSuccess?: (saved: Product) => void; onError?: (err: Error) => void },
      ) => {
        updateMutate(variables, opts);
        if (nextError && opts?.onError) {
          opts.onError(nextError);
          return;
        }
        if (nextSavedProduct && opts?.onSuccess) {
          opts.onSuccess(nextSavedProduct);
        }
      },
      isPending: false,
    }),
    useCreateProduct: () => ({
      mutate: (
        variables: { data: unknown },
        opts?: { onSuccess?: (saved: Product) => void; onError?: (err: Error) => void },
      ) => {
        createMutate(variables, opts);
        if (nextError && opts?.onError) {
          opts.onError(nextError);
          return;
        }
        if (nextSavedProduct && opts?.onSuccess) {
          opts.onSuccess(nextSavedProduct);
        }
      },
      isPending: false,
    }),
    getListProductsQueryKey: (
      params?: { category?: string; search?: string; featured?: boolean },
    ) => ["/api/products", ...(params ? [params] : [])] as const,
    getGetProductQueryKey: (id: string) => [`/api/products/${id}`] as const,
    getGetAdminStatsQueryKey: () => ["/api/admin/stats"] as const,
  };
});

import { ProductFormDialog } from "./ProductFormDialog";

const baseProduct: Product = {
  id: "prod_1",
  name: "Linen Shirt",
  description: "A breezy linen shirt.",
  price: 49.99,
  imageUrl: "",
  category: "tops",
  sizes: ["S", "M"],
  colors: ["Black"],
  variants: [
    { size: "S", color: "Black", stock: 5 },
    { size: "M", color: "Black", stock: 3 },
  ],
  isFeatured: false,
} as unknown as Product;

const otherProduct: Product = {
  id: "prod_other",
  name: "Cotton Tee",
  description: "Soft cotton tee.",
  price: 19.99,
  imageUrl: "",
  category: "tops",
  sizes: ["M"],
  colors: ["White"],
  variants: [{ size: "M", color: "White", stock: 7 }],
  isFeatured: false,
} as unknown as Product;

const bottomsProduct: Product = {
  id: "prod_bottoms",
  name: "Wide Trousers",
  description: "Drapey trousers.",
  price: 89.99,
  imageUrl: "",
  category: "bottoms",
  sizes: ["M"],
  colors: ["Black"],
  variants: [{ size: "M", color: "Black", stock: 2 }],
  isFeatured: true,
} as unknown as Product;

type ListParams =
  | undefined
  | { category?: string; search?: string; featured?: boolean };

function listKey(params?: ListParams) {
  return ["/api/products", ...(params ? [params] : [])] as const;
}

function productKey(id: string) {
  return [`/api/products/${id}`] as const;
}

const adminStatsKey = ["/api/admin/stats"] as const;

interface SeededCaches {
  noFilter: ReturnType<typeof listKey>;
  byCategoryTops: ReturnType<typeof listKey>;
  byCategoryBottoms: ReturnType<typeof listKey>;
  featured: ReturnType<typeof listKey>;
  searchLinen: ReturnType<typeof listKey>;
}

function seedCaches(client: QueryClient): SeededCaches {
  const noFilter = listKey();
  const byCategoryTops = listKey({ category: "tops" });
  const byCategoryBottoms = listKey({ category: "bottoms" });
  const featured = listKey({ featured: true });
  const searchLinen = listKey({ search: "linen" });

  // Unfiltered list contains all products in `created DESC` order.
  client.setQueryData<Product[]>(noFilter, [
    baseProduct,
    otherProduct,
    bottomsProduct,
  ]);
  // Category=tops contains both tops products.
  client.setQueryData<Product[]>(byCategoryTops, [baseProduct, otherProduct]);
  // Category=bottoms contains only the trousers.
  client.setQueryData<Product[]>(byCategoryBottoms, [bottomsProduct]);
  // Featured contains only the featured trousers.
  client.setQueryData<Product[]>(featured, [bottomsProduct]);
  // Search "linen" matches the linen shirt only.
  client.setQueryData<Product[]>(searchLinen, [baseProduct]);

  // Also seed an existing per-product cache so we can assert it was overwritten.
  client.setQueryData<Product>(productKey(baseProduct.id), baseProduct);

  return {
    noFilter,
    byCategoryTops,
    byCategoryBottoms,
    featured,
    searchLinen,
  };
}

function renderWith(client: QueryClient, product: Product = baseProduct) {
  return render(
    <QueryClientProvider client={client}>
      <ProductFormDialog mode="edit" product={product} />
    </QueryClientProvider>,
  );
}

function renderCreate(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <ProductFormDialog mode="create" />
    </QueryClientProvider>,
  );
}

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  productId: string = baseProduct.id,
) {
  await user.click(screen.getByTestId(`button-edit-product-${productId}`));
  return await screen.findByTestId("dialog-edit-product");
}

async function openCreateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("button-new-product"));
  return await screen.findByTestId("dialog-new-product");
}

async function fillCreateForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: {
    name: string;
    description: string;
    price: string;
    category: string;
    sizes: string[];
    colors: string[];
    stock: Record<string, string>;
    featured?: boolean;
  },
) {
  await user.type(within(dialog).getByTestId("input-product-name"), values.name);
  await user.type(
    within(dialog).getByTestId("input-product-description"),
    values.description,
  );
  await user.type(
    within(dialog).getByTestId("input-product-category"),
    values.category,
  );
  await user.type(
    within(dialog).getByTestId("input-product-price"),
    values.price,
  );

  for (const size of values.sizes) {
    await user.clear(within(dialog).getByTestId("input-size"));
    await user.type(within(dialog).getByTestId("input-size"), size);
    await user.click(within(dialog).getByTestId("button-add-size"));
  }
  for (const color of values.colors) {
    await user.clear(within(dialog).getByTestId("input-color"));
    await user.type(within(dialog).getByTestId("input-color"), color);
    await user.click(within(dialog).getByTestId("button-add-color"));
  }
  for (const [key, stock] of Object.entries(values.stock)) {
    const [size, color] = key.split("::");
    await user.clear(
      within(dialog).getByTestId(`input-stock-${size}-${color}`),
    );
    await user.type(
      within(dialog).getByTestId(`input-stock-${size}-${color}`),
      stock,
    );
  }
  if (values.featured) {
    await user.click(within(dialog).getByTestId("checkbox-product-featured"));
  }
}

beforeEach(() => {
  updateMutate.mockReset();
  createMutate.mockReset();
  nextSavedProduct = null;
  nextError = null;
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("ProductFormDialog cache sync after edit", () => {
  it("updates the saved product in place across every list cache that still matches the filter", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Saved product: same category & still matching all current caches, just
    // a renamed product. Keeps category=tops, isFeatured=false, name still
    // contains "linen".
    const saved: Product = {
      ...baseProduct,
      name: "Linen Shirt v2",
      description: "Updated description.",
    };
    nextSavedProduct = saved;

    renderWith(client);
    const dialog = await openDialog(user);

    const nameInput = within(dialog).getByTestId(
      "input-product-name",
    ) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Linen Shirt v2");

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);

    // Unfiltered list: same length, same order, renamed entry in place.
    const noFilter = client.getQueryData<Product[]>(keys.noFilter);
    expect(noFilter).toHaveLength(3);
    expect(noFilter?.[0]).toEqual(saved);
    expect(noFilter?.[1]).toEqual(otherProduct);
    expect(noFilter?.[2]).toEqual(bottomsProduct);

    // Category=tops list: still both tops products, linen shirt updated in place.
    const tops = client.getQueryData<Product[]>(keys.byCategoryTops);
    expect(tops).toHaveLength(2);
    expect(tops?.[0]).toEqual(saved);
    expect(tops?.[1]).toEqual(otherProduct);

    // Category=bottoms list: untouched (saved product never matched it).
    expect(client.getQueryData<Product[]>(keys.byCategoryBottoms)).toEqual([
      bottomsProduct,
    ]);

    // Featured list: untouched (saved product is not featured).
    expect(client.getQueryData<Product[]>(keys.featured)).toEqual([
      bottomsProduct,
    ]);

    // Search "linen": matches still, updated in place.
    const search = client.getQueryData<Product[]>(keys.searchLinen);
    expect(search).toEqual([saved]);
  });

  it("removes the saved product from filtered caches it no longer matches (category change)", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Saved product moved from "tops" to "bottoms" and renamed so it no
    // longer matches the search="linen" filter either.
    const saved: Product = {
      ...baseProduct,
      name: "Wide Linen Trousers",
      category: "bottoms",
    };
    // Make the name no longer contain "linen" to also exercise the search filter.
    saved.name = "Wide Trousers";
    nextSavedProduct = saved;

    renderWith(client);
    const dialog = await openDialog(user);

    const categoryInput = within(dialog).getByTestId(
      "input-product-category",
    ) as HTMLInputElement;
    await user.clear(categoryInput);
    await user.type(categoryInput, "bottoms");

    const nameInput = within(dialog).getByTestId(
      "input-product-name",
    ) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Wide Trousers");

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);

    // Unfiltered list: still includes the product (no filter to fail), updated in place.
    const noFilter = client.getQueryData<Product[]>(keys.noFilter);
    expect(noFilter).toHaveLength(3);
    expect(noFilter?.find((p) => p.id === saved.id)).toEqual(saved);

    // Category=tops cache: product is removed, otherProduct survives.
    const tops = client.getQueryData<Product[]>(keys.byCategoryTops);
    expect(tops).toEqual([otherProduct]);

    // Category=bottoms cache: product newly matches, inserted at the top.
    const bottoms = client.getQueryData<Product[]>(keys.byCategoryBottoms);
    expect(bottoms).toHaveLength(2);
    expect(bottoms?.[0]).toEqual(saved);
    expect(bottoms?.[1]).toEqual(bottomsProduct);

    // Search "linen" cache: product no longer matches the search term, removed.
    expect(client.getQueryData<Product[]>(keys.searchLinen)).toEqual([]);

    // Featured cache: untouched (saved still isn't featured).
    expect(client.getQueryData<Product[]>(keys.featured)).toEqual([
      bottomsProduct,
    ]);
  });

  it("inserts the saved product at the top of caches it newly matches (now featured)", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Saved product is now featured; should be inserted at the top of the
    // featured cache (which previously only had the trousers).
    const saved: Product = {
      ...baseProduct,
      isFeatured: true,
    };
    nextSavedProduct = saved;

    renderWith(client);
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByTestId("checkbox-product-featured"));
    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);

    // Featured cache: saved product inserted at the top (created DESC ordering).
    const featured = client.getQueryData<Product[]>(keys.featured);
    expect(featured).toHaveLength(2);
    expect(featured?.[0]).toEqual(saved);
    expect(featured?.[1]).toEqual(bottomsProduct);

    // Unfiltered list: in-place update (already present).
    const noFilter = client.getQueryData<Product[]>(keys.noFilter);
    expect(noFilter).toHaveLength(3);
    expect(noFilter?.find((p) => p.id === saved.id)).toEqual(saved);

    // Tops & search caches: still match, updated in place.
    expect(
      client
        .getQueryData<Product[]>(keys.byCategoryTops)
        ?.find((p) => p.id === saved.id),
    ).toEqual(saved);
    expect(client.getQueryData<Product[]>(keys.searchLinen)).toEqual([saved]);

    // Bottoms cache: untouched.
    expect(client.getQueryData<Product[]>(keys.byCategoryBottoms)).toEqual([
      bottomsProduct,
    ]);
  });

  it("updates the per-product cache and invalidates the admin stats query", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    seedCaches(client);

    // Prime the admin stats cache as "fresh" data (not invalidated). With no
    // observers attached, invalidateQueries should leave isInvalidated=true
    // (no immediate refetch happens) so we can assert on it directly.
    client.setQueryData(adminStatsKey, { count: 0 });
    const initialStatsState = client.getQueryState(adminStatsKey);
    expect(initialStatsState?.isInvalidated).toBe(false);

    const saved: Product = {
      ...baseProduct,
      description: "A new description.",
    };
    nextSavedProduct = saved;

    renderWith(client);
    const dialog = await openDialog(user);

    const description = within(dialog).getByTestId(
      "input-product-description",
    ) as HTMLTextAreaElement;
    await user.clear(description);
    await user.type(description, "A new description.");

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);

    // Per-product cache: overwritten with the canonical saved product.
    expect(client.getQueryData<Product>(productKey(saved.id))).toEqual(saved);

    // Admin stats cache: marked as invalidated so it'll refetch on next mount.
    await waitFor(() => {
      const state = client.getQueryState(adminStatsKey);
      expect(state?.isInvalidated).toBe(true);
    });
  });

  it("leaves caches that have not been seeded alone (does not create empty list entries)", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Only seed the unfiltered list. Other filter shapes have never been
    // rendered, so their caches should remain undefined.
    const noFilter = listKey();
    client.setQueryData<Product[]>(noFilter, [baseProduct, otherProduct]);

    nextSavedProduct = { ...baseProduct, name: "Linen Shirt v2" };

    renderWith(client);
    const dialog = await openDialog(user);

    const nameInput = within(dialog).getByTestId(
      "input-product-name",
    ) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Linen Shirt v2");

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);

    // Seeded cache updated.
    const updatedList = client.getQueryData<Product[]>(noFilter);
    expect(updatedList?.[0].name).toBe("Linen Shirt v2");

    // Caches that weren't seeded should remain undefined — the optimistic
    // update must never invent list data the UI never asked for.
    expect(
      client.getQueryData<Product[]>(listKey({ category: "tops" })),
    ).toBeUndefined();
    expect(
      client.getQueryData<Product[]>(listKey({ featured: true })),
    ).toBeUndefined();
    expect(
      client.getQueryData<Product[]>(listKey({ search: "linen" })),
    ).toBeUndefined();
  });
});

describe("ProductFormDialog cache sync after create", () => {
  it("inserts the newly-created product at the top of every matching list cache and skips ones that don't match", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Saved (canonical) product returned by the API after create. It's a
    // tops product, not featured, with "linen" in the name — so it should
    // appear in: noFilter, byCategoryTops, searchLinen. It must NOT appear
    // in: byCategoryBottoms, featured.
    const saved: Product = {
      id: "prod_new",
      name: "Linen Blazer",
      description: "A crisp linen blazer.",
      price: 129.99,
      imageUrl: "",
      category: "tops",
      sizes: ["M"],
      colors: ["Sand"],
      variants: [{ size: "M", color: "Sand", stock: 4 }],
      isFeatured: false,
    } as unknown as Product;
    nextSavedProduct = saved;

    renderCreate(client);
    const dialog = await openCreateDialog(user);
    await fillCreateForm(user, dialog, {
      name: "Linen Blazer",
      description: "A crisp linen blazer.",
      price: "129.99",
      category: "tops",
      sizes: ["M"],
      colors: ["Sand"],
      stock: { "M::Sand": "4" },
    });

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).not.toHaveBeenCalled();

    // Unfiltered list: saved inserted at the top (created DESC).
    const noFilter = client.getQueryData<Product[]>(keys.noFilter);
    expect(noFilter).toHaveLength(4);
    expect(noFilter?.[0]).toEqual(saved);
    expect(noFilter?.slice(1)).toEqual([
      baseProduct,
      otherProduct,
      bottomsProduct,
    ]);

    // Category=tops list: saved (a tops product) inserted at the top.
    const tops = client.getQueryData<Product[]>(keys.byCategoryTops);
    expect(tops).toHaveLength(3);
    expect(tops?.[0]).toEqual(saved);
    expect(tops?.slice(1)).toEqual([baseProduct, otherProduct]);

    // Category=bottoms list: untouched (saved is a tops product).
    expect(client.getQueryData<Product[]>(keys.byCategoryBottoms)).toEqual([
      bottomsProduct,
    ]);

    // Featured list: untouched (saved is not featured).
    expect(client.getQueryData<Product[]>(keys.featured)).toEqual([
      bottomsProduct,
    ]);

    // Search "linen" cache: saved matches (name contains "linen"), inserted
    // at the top.
    const search = client.getQueryData<Product[]>(keys.searchLinen);
    expect(search).toHaveLength(2);
    expect(search?.[0]).toEqual(saved);
    expect(search?.[1]).toEqual(baseProduct);
  });

  it("inserts a featured creation into the featured cache and a bottoms creation into the bottoms cache", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Saved is a featured bottoms product whose name doesn't contain "linen".
    // Should appear in: noFilter, byCategoryBottoms, featured.
    // Should be skipped from: byCategoryTops, searchLinen.
    const saved: Product = {
      id: "prod_new_featured",
      name: "Wool Trousers",
      description: "Heavy wool trousers.",
      price: 149.99,
      imageUrl: "",
      category: "bottoms",
      sizes: ["L"],
      colors: ["Charcoal"],
      variants: [{ size: "L", color: "Charcoal", stock: 2 }],
      isFeatured: true,
    } as unknown as Product;
    nextSavedProduct = saved;

    renderCreate(client);
    const dialog = await openCreateDialog(user);
    await fillCreateForm(user, dialog, {
      name: "Wool Trousers",
      description: "Heavy wool trousers.",
      price: "149.99",
      category: "bottoms",
      sizes: ["L"],
      colors: ["Charcoal"],
      stock: { "L::Charcoal": "2" },
      featured: true,
    });

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(createMutate).toHaveBeenCalledTimes(1);

    // Unfiltered list: saved at the top.
    const noFilter = client.getQueryData<Product[]>(keys.noFilter);
    expect(noFilter?.[0]).toEqual(saved);
    expect(noFilter).toHaveLength(4);

    // Category=tops: untouched (saved is bottoms).
    expect(client.getQueryData<Product[]>(keys.byCategoryTops)).toEqual([
      baseProduct,
      otherProduct,
    ]);

    // Category=bottoms: saved inserted at the top.
    const bottoms = client.getQueryData<Product[]>(keys.byCategoryBottoms);
    expect(bottoms).toHaveLength(2);
    expect(bottoms?.[0]).toEqual(saved);
    expect(bottoms?.[1]).toEqual(bottomsProduct);

    // Featured: saved inserted at the top.
    const featured = client.getQueryData<Product[]>(keys.featured);
    expect(featured).toHaveLength(2);
    expect(featured?.[0]).toEqual(saved);
    expect(featured?.[1]).toEqual(bottomsProduct);

    // Search "linen": untouched (name doesn't contain "linen").
    expect(client.getQueryData<Product[]>(keys.searchLinen)).toEqual([
      baseProduct,
    ]);
  });

  it("seeds the per-product cache and invalidates the admin stats query on create", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    seedCaches(client);

    // Prime the admin stats cache as fresh so we can assert it gets invalidated.
    client.setQueryData(adminStatsKey, { count: 3 });
    const initialStatsState = client.getQueryState(adminStatsKey);
    expect(initialStatsState?.isInvalidated).toBe(false);

    const saved: Product = {
      id: "prod_brand_new",
      name: "Cashmere Scarf",
      description: "Soft cashmere scarf.",
      price: 79.99,
      imageUrl: "",
      category: "accessories",
      sizes: ["OS"],
      colors: ["Cream"],
      variants: [{ size: "OS", color: "Cream", stock: 6 }],
      isFeatured: false,
    } as unknown as Product;
    nextSavedProduct = saved;

    // Per-product cache for the new id should not exist yet.
    expect(client.getQueryData<Product>(productKey(saved.id))).toBeUndefined();

    renderCreate(client);
    const dialog = await openCreateDialog(user);
    await fillCreateForm(user, dialog, {
      name: "Cashmere Scarf",
      description: "Soft cashmere scarf.",
      price: "79.99",
      category: "accessories",
      sizes: ["OS"],
      colors: ["Cream"],
      stock: { "OS::Cream": "6" },
    });

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(createMutate).toHaveBeenCalledTimes(1);

    // Per-product cache: seeded with the canonical saved product so an open
    // detail view picks it up immediately.
    expect(client.getQueryData<Product>(productKey(saved.id))).toEqual(saved);

    // Admin stats cache: marked invalidated so it'll refetch on next mount.
    await waitFor(() => {
      const state = client.getQueryState(adminStatsKey);
      expect(state?.isInvalidated).toBe(true);
    });
  });

  it("does not invent list caches that have never been seeded when creating", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // Only the unfiltered list has ever been rendered.
    const noFilter = listKey();
    client.setQueryData<Product[]>(noFilter, [baseProduct, otherProduct]);

    const saved: Product = {
      id: "prod_unseeded",
      name: "Linen Tunic",
      description: "Loose linen tunic.",
      price: 89.99,
      imageUrl: "",
      category: "tops",
      sizes: ["M"],
      colors: ["White"],
      variants: [{ size: "M", color: "White", stock: 3 }],
      isFeatured: true,
    } as unknown as Product;
    nextSavedProduct = saved;

    renderCreate(client);
    const dialog = await openCreateDialog(user);
    await fillCreateForm(user, dialog, {
      name: "Linen Tunic",
      description: "Loose linen tunic.",
      price: "89.99",
      category: "tops",
      sizes: ["M"],
      colors: ["White"],
      stock: { "M::White": "3" },
      featured: true,
    });

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(createMutate).toHaveBeenCalledTimes(1);

    // Seeded cache: saved inserted at the top.
    const updatedList = client.getQueryData<Product[]>(noFilter);
    expect(updatedList).toHaveLength(3);
    expect(updatedList?.[0]).toEqual(saved);

    // Caches that were never seeded must remain undefined — the optimistic
    // create must not invent list data the UI never asked for.
    expect(
      client.getQueryData<Product[]>(listKey({ category: "tops" })),
    ).toBeUndefined();
    expect(
      client.getQueryData<Product[]>(listKey({ category: "bottoms" })),
    ).toBeUndefined();
    expect(
      client.getQueryData<Product[]>(listKey({ featured: true })),
    ).toBeUndefined();
    expect(
      client.getQueryData<Product[]>(listKey({ search: "linen" })),
    ).toBeUndefined();
  });
});

describe("ProductFormDialog leaves caches untouched when saving fails", () => {
  function snapshotCaches(client: QueryClient, keys: SeededCaches) {
    return {
      noFilter: client.getQueryData<Product[]>(keys.noFilter),
      byCategoryTops: client.getQueryData<Product[]>(keys.byCategoryTops),
      byCategoryBottoms: client.getQueryData<Product[]>(keys.byCategoryBottoms),
      featured: client.getQueryData<Product[]>(keys.featured),
      searchLinen: client.getQueryData<Product[]>(keys.searchLinen),
    };
  }

  function assertCachesUnchanged(
    client: QueryClient,
    keys: SeededCaches,
    before: ReturnType<typeof snapshotCaches>,
  ) {
    // Reference equality: setQueryData was never invoked on any list cache,
    // so the array references must be identical to the pre-submit snapshot.
    expect(client.getQueryData<Product[]>(keys.noFilter)).toBe(before.noFilter);
    expect(client.getQueryData<Product[]>(keys.byCategoryTops)).toBe(
      before.byCategoryTops,
    );
    expect(client.getQueryData<Product[]>(keys.byCategoryBottoms)).toBe(
      before.byCategoryBottoms,
    );
    expect(client.getQueryData<Product[]>(keys.featured)).toBe(before.featured);
    expect(client.getQueryData<Product[]>(keys.searchLinen)).toBe(
      before.searchLinen,
    );

    // Deep equality for an extra layer of confidence — the underlying arrays
    // must not have been mutated in place either.
    expect(client.getQueryData<Product[]>(keys.noFilter)).toEqual([
      baseProduct,
      otherProduct,
      bottomsProduct,
    ]);
    expect(client.getQueryData<Product[]>(keys.byCategoryTops)).toEqual([
      baseProduct,
      otherProduct,
    ]);
    expect(client.getQueryData<Product[]>(keys.byCategoryBottoms)).toEqual([
      bottomsProduct,
    ]);
    expect(client.getQueryData<Product[]>(keys.featured)).toEqual([
      bottomsProduct,
    ]);
    expect(client.getQueryData<Product[]>(keys.searchLinen)).toEqual([
      baseProduct,
    ]);
  }

  it("leaves every list, per-product, and admin stats cache untouched when an edit fails, and shows an error toast", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    // Prime the admin stats cache as fresh — a successful edit would
    // invalidate it, so a failed edit must leave it fresh.
    client.setQueryData(adminStatsKey, { count: 0 });
    expect(client.getQueryState(adminStatsKey)?.isInvalidated).toBe(false);

    const before = snapshotCaches(client, keys);
    const beforeProduct = client.getQueryData<Product>(productKey(baseProduct.id));
    const beforeStats = client.getQueryData<{ count: number }>(adminStatsKey);

    nextError = new Error("Stripe is down");

    renderWith(client);
    const dialog = await openDialog(user);

    // Make changes that, on success, would have touched every list cache.
    const nameInput = within(dialog).getByTestId(
      "input-product-name",
    ) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Linen Shirt v2");

    const categoryInput = within(dialog).getByTestId(
      "input-product-category",
    ) as HTMLInputElement;
    await user.clear(categoryInput);
    await user.type(categoryInput, "bottoms");

    await user.click(within(dialog).getByTestId("checkbox-product-featured"));

    await user.click(within(dialog).getByTestId("button-submit-product"));

    // Mutation was attempted.
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(createMutate).not.toHaveBeenCalled();

    // Error toast was shown with the server's message; success toast was not.
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Stripe is down");
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();

    // Every list cache: same reference and same contents as before.
    assertCachesUnchanged(client, keys, before);

    // Per-product cache: identical reference to the pre-submit snapshot.
    expect(client.getQueryData<Product>(productKey(baseProduct.id))).toBe(
      beforeProduct,
    );
    expect(client.getQueryData<Product>(productKey(baseProduct.id))).toEqual(
      baseProduct,
    );

    // Admin stats cache: still fresh, never invalidated.
    expect(client.getQueryData<{ count: number }>(adminStatsKey)).toBe(
      beforeStats,
    );
    expect(client.getQueryState(adminStatsKey)?.isInvalidated).toBe(false);
  });

  it("leaves every list, per-product, and admin stats cache untouched when a create fails, and shows an error toast", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const keys = seedCaches(client);

    client.setQueryData(adminStatsKey, { count: 3 });
    expect(client.getQueryState(adminStatsKey)?.isInvalidated).toBe(false);

    const before = snapshotCaches(client, keys);
    const beforeBaseProduct = client.getQueryData<Product>(
      productKey(baseProduct.id),
    );
    const beforeStats = client.getQueryData<{ count: number }>(adminStatsKey);

    nextError = new Error("Validation failed");

    renderCreate(client);
    const dialog = await openCreateDialog(user);
    await fillCreateForm(user, dialog, {
      name: "Linen Blazer",
      description: "A crisp linen blazer.",
      price: "129.99",
      category: "tops",
      sizes: ["M"],
      colors: ["Sand"],
      stock: { "M::Sand": "4" },
      featured: true,
    });

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(createMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Validation failed");
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();

    // Every list cache: untouched reference and contents.
    assertCachesUnchanged(client, keys, before);

    // The pre-existing per-product cache for baseProduct must be untouched.
    expect(client.getQueryData<Product>(productKey(baseProduct.id))).toBe(
      beforeBaseProduct,
    );

    // No new per-product cache should have been seeded for the failed create.
    // We can't predict the would-be id, but we can confirm the only product
    // cache present in the client is the one we seeded.
    const productCaches = client
      .getQueryCache()
      .getAll()
      .filter((q) => {
        const k = q.queryKey;
        return (
          Array.isArray(k) &&
          typeof k[0] === "string" &&
          k[0].startsWith("/api/products/")
        );
      });
    expect(productCaches.map((q) => q.queryKey[0])).toEqual([
      `/api/products/${baseProduct.id}`,
    ]);

    // Admin stats: still fresh, never invalidated.
    expect(client.getQueryData<{ count: number }>(adminStatsKey)).toBe(
      beforeStats,
    );
    expect(client.getQueryState(adminStatsKey)?.isInvalidated).toBe(false);
  });

});
