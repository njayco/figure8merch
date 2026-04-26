import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Product } from "@workspace/api-client-react";

const updateMutate = vi.fn();
const createMutate = vi.fn();
let nextSavedProduct: Product | null = null;

vi.mock("@workspace/api-client-react", async () => {
  return {
    useUpdateProduct: () => ({
      mutate: (
        variables: { id: string; data: unknown },
        opts?: { onSuccess?: (saved: Product) => void; onError?: (err: Error) => void },
      ) => {
        updateMutate(variables, opts);
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

async function openDialog(
  user: ReturnType<typeof userEvent.setup>,
  productId: string = baseProduct.id,
) {
  await user.click(screen.getByTestId(`button-edit-product-${productId}`));
  return await screen.findByTestId("dialog-edit-product");
}

beforeEach(() => {
  updateMutate.mockReset();
  createMutate.mockReset();
  nextSavedProduct = null;
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
