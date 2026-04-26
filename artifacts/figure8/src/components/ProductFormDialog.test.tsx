import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Product } from "@workspace/api-client-react";
import { toast } from "sonner";

const updateMutate = vi.fn();
const createMutate = vi.fn();

vi.mock("@workspace/api-client-react", async () => {
  return {
    useUpdateProduct: () => ({
      mutate: updateMutate,
      isPending: false,
    }),
    useCreateProduct: () => ({
      mutate: createMutate,
      isPending: false,
    }),
    getListProductsQueryKey: () => ["/api/products"],
    getGetProductQueryKey: (id: string) => [`/api/products/${id}`],
    getGetAdminStatsQueryKey: () => ["/api/admin/stats"],
  };
});

import { ProductFormDialog } from "./ProductFormDialog";

const baseProduct: Product = {
  id: "prod_1",
  name: "Linen Shirt",
  description: "A lovely linen shirt.",
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
  // The component only reads the fields above, but Product may carry extras.
  // Cast through unknown so we don't have to mirror the full server schema.
} as unknown as Product;

function renderDialog(product: Product = baseProduct) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductFormDialog mode="edit" product={product} />
    </QueryClientProvider>,
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByTestId(`button-edit-product-${baseProduct.id}`),
  );
  return await screen.findByTestId("dialog-edit-product");
}

describe("ProductFormDialog price-change confirmation flow", () => {
  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("warns about a price change, asks for confirmation, lets the user cancel back to edit, and then save with the new price", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    // No warning until the price actually changes.
    expect(
      within(dialog).queryByTestId("text-price-change-warning"),
    ).not.toBeInTheDocument();

    const priceInput = within(dialog).getByTestId(
      "input-product-price",
    ) as HTMLInputElement;
    await user.clear(priceInput);
    await user.type(priceInput, "59.99");

    // Inline warning shows up underneath the price field.
    expect(
      within(dialog).getByTestId("text-price-change-warning"),
    ).toBeInTheDocument();

    // The primary footer button is still the regular submit button.
    const submitButton = within(dialog).getByTestId("button-submit-product");
    await user.click(submitButton);

    // Confirmation panel appears, mutation has NOT been called yet.
    const confirmPanel = await within(dialog).findByTestId(
      "dialog-confirm-price-change",
    );
    expect(confirmPanel).toBeInTheDocument();
    expect(confirmPanel).toHaveTextContent("$49.99");
    expect(confirmPanel).toHaveTextContent("$59.99");
    expect(updateMutate).not.toHaveBeenCalled();

    // The footer buttons swap to confirm/cancel-price-change variants.
    expect(
      within(dialog).getByTestId("button-confirm-price-change"),
    ).toBeInTheDocument();
    const cancelPriceButton = within(dialog).getByTestId(
      "button-cancel-price-change",
    );

    // Cancelling closes the confirmation and returns the user to the edit form.
    await user.click(cancelPriceButton);
    expect(
      within(dialog).queryByTestId("dialog-confirm-price-change"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByTestId("button-submit-product"),
    ).toBeInTheDocument();
    // Price field still holds the new value, and the warning is still shown.
    expect(priceInput.value).toBe("59.99");
    expect(
      within(dialog).getByTestId("text-price-change-warning"),
    ).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();

    // Resubmit and this time confirm the price change.
    await user.click(within(dialog).getByTestId("button-submit-product"));
    const confirmButton = await within(dialog).findByTestId(
      "button-confirm-price-change",
    );
    await user.click(confirmButton);

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables).toMatchObject({
      id: baseProduct.id,
      data: expect.objectContaining({
        name: baseProduct.name,
        price: 59.99,
        category: baseProduct.category,
      }),
    });
  });

  it("saves immediately without a confirmation step when the price is unchanged", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    // Make a non-price edit so we know the mutation is exercising the form.
    const nameInput = within(dialog).getByTestId(
      "input-product-name",
    ) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Linen Shirt v2");

    // Price is untouched, so no warning is shown.
    expect(
      within(dialog).queryByTestId("text-price-change-warning"),
    ).not.toBeInTheDocument();

    await user.click(within(dialog).getByTestId("button-submit-product"));

    // No confirmation panel ever appears, mutation is called straight away.
    expect(
      within(dialog).queryByTestId("dialog-confirm-price-change"),
    ).not.toBeInTheDocument();
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables).toMatchObject({
      id: baseProduct.id,
      data: expect.objectContaining({
        name: "Linen Shirt v2",
        price: baseProduct.price,
      }),
    });
  });
});

describe("ProductFormDialog size and color management", () => {
  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("adds a new size and grows the stock grid with a row for it", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    // Existing sizes from baseProduct render as S and M rows in the grid.
    expect(within(dialog).getByTestId("input-stock-S-Black")).toBeInTheDocument();
    expect(within(dialog).getByTestId("input-stock-M-Black")).toBeInTheDocument();
    expect(
      within(dialog).queryByTestId("input-stock-L-Black"),
    ).not.toBeInTheDocument();

    // Add a new size "L" — it should normalize to upper-case and appear in the grid.
    const sizeInput = within(dialog).getByTestId("input-size");
    await user.type(sizeInput, "l");
    await user.click(within(dialog).getByTestId("button-add-size"));

    expect(within(dialog).getByTestId("input-stock-L-Black")).toBeInTheDocument();
    // The badge appears in the sizes list for removal.
    const sizesList = within(dialog).getByTestId("list-sizes");
    expect(within(sizesList).getByText("L")).toBeInTheDocument();
  });

  it("removes an existing size and drops its row from the stock grid", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    expect(within(dialog).getByTestId("input-stock-M-Black")).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Remove size M"));

    expect(
      within(dialog).queryByTestId("input-stock-M-Black"),
    ).not.toBeInTheDocument();
    // The other size's row is preserved.
    expect(within(dialog).getByTestId("input-stock-S-Black")).toBeInTheDocument();
  });

  it("adds a new color and grows the stock grid with a column for it", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    expect(
      within(dialog).queryByTestId("input-stock-S-Olive"),
    ).not.toBeInTheDocument();

    const colorInput = within(dialog).getByTestId("input-color");
    await user.type(colorInput, "Olive");
    await user.click(within(dialog).getByTestId("button-add-color"));

    expect(within(dialog).getByTestId("input-stock-S-Olive")).toBeInTheDocument();
    expect(within(dialog).getByTestId("input-stock-M-Olive")).toBeInTheDocument();
    const colorsList = within(dialog).getByTestId("list-colors");
    expect(within(colorsList).getByText("Olive")).toBeInTheDocument();
  });

  it("removes a color and drops its column from the stock grid, including stock entries", async () => {
    const user = userEvent.setup();
    // Start from a product with two colors so we can prove the OTHER one survives.
    const product = {
      ...baseProduct,
      colors: ["Black", "Olive"],
      variants: [
        { size: "S", color: "Black", stock: 5 },
        { size: "M", color: "Black", stock: 3 },
        { size: "S", color: "Olive", stock: 1 },
        { size: "M", color: "Olive", stock: 2 },
      ],
    } as unknown as Product;
    renderDialog(product);
    const dialog = await openDialog(user);

    expect(within(dialog).getByTestId("input-stock-S-Olive")).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText("Remove color Olive"));

    expect(
      within(dialog).queryByTestId("input-stock-S-Olive"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByTestId("input-stock-M-Olive"),
    ).not.toBeInTheDocument();
    // Black column is preserved with original stock values intact.
    const blackS = within(dialog).getByTestId(
      "input-stock-S-Black",
    ) as HTMLInputElement;
    expect(blackS.value).toBe("5");

    // Submit and verify the Olive variants are NOT in the body.
    await user.click(within(dialog).getByTestId("button-submit-product"));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables.data.colors).toEqual(["Black"]);
    expect(variables.data.variants).toEqual([
      { size: "S", color: "Black", stock: 5 },
      { size: "M", color: "Black", stock: 3 },
    ]);
  });

  it("ignores duplicate sizes and clears the input", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    const sizeInput = within(dialog).getByTestId("input-size") as HTMLInputElement;
    await user.type(sizeInput, "s");
    await user.click(within(dialog).getByTestId("button-add-size"));

    // Still only one S row in the grid (no duplicate created).
    expect(within(dialog).getAllByTestId("input-stock-S-Black")).toHaveLength(1);
    expect(sizeInput.value).toBe("");
  });
});

describe("ProductFormDialog stock validation", () => {
  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("errors and skips the mutation when a stock cell is left empty", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    const stockCell = within(dialog).getByTestId(
      "input-stock-S-Black",
    ) as HTMLInputElement;
    await user.clear(stockCell);

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Stock for S/Black"),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("errors and skips the mutation when a stock cell is a non-integer value", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    const stockCell = within(dialog).getByTestId(
      "input-stock-S-Black",
    ) as HTMLInputElement;
    await user.clear(stockCell);
    await user.type(stockCell, "1.5");

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Stock for S/Black"),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("errors and skips the mutation when a stock cell is negative", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    const stockCell = within(dialog).getByTestId(
      "input-stock-S-Black",
    ) as HTMLInputElement;
    await user.clear(stockCell);
    // Number inputs strip the leading minus sign typed via keyboard, so
    // assign the value directly and dispatch an input event the way React expects.
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(stockCell, "-1");
    stockCell.dispatchEvent(new Event("input", { bubbles: true }));

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Stock for S/Black"),
    );
    expect(updateMutate).not.toHaveBeenCalled();
  });
});

describe("ProductFormDialog required-field validation", () => {
  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("errors when there are no sizes and does not call the mutation", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    // Remove every size badge.
    await user.click(within(dialog).getByLabelText("Remove size S"));
    await user.click(within(dialog).getByLabelText("Remove size M"));

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).toHaveBeenCalledWith("Add at least one size");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("errors when there are no colors and does not call the mutation", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByLabelText("Remove color Black"));

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).toHaveBeenCalledWith("Add at least one color");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("submits successfully even when no photo has been uploaded", async () => {
    const user = userEvent.setup();
    // baseProduct already has imageUrl: "" — confirm the form lets you save without it.
    renderDialog();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(toast.error).not.toHaveBeenCalled();
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables.data.imageUrl).toBe("");
  });
});

describe("ProductFormDialog photo upload", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a file larger than 10MB with an error toast and never issues a fetch", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderDialog();
    const dialog = await openDialog(user);

    // 11MB > 10MB cap. Backed by a real ArrayBuffer so .size is accurate.
    const bigFile = new File(
      [new ArrayBuffer(11 * 1024 * 1024)],
      "huge.jpg",
      { type: "image/jpeg" },
    );

    const fileInput = within(dialog).getByTestId(
      "input-product-image",
    ) as HTMLInputElement;
    await user.upload(fileInput, bigFile);

    expect(toast.error).toHaveBeenCalledWith("Image must be 10MB or smaller");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();

    // Button still says "Upload photo" because no image has been set.
    expect(
      within(dialog).getByTestId("button-upload-image"),
    ).toHaveTextContent(/Upload photo/i);
    // No preview image has been added.
    expect(
      within(dialog).queryByAltText("Preview"),
    ).not.toBeInTheDocument();
  });

  it("sets the preview image and shows a success toast when the upload succeeds", async () => {
    const user = userEvent.setup();
    const uploadedUrl = "https://cdn.example.com/uploads/new-photo.png";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: uploadedUrl }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderDialog();
    const dialog = await openDialog(user);

    // baseProduct has imageUrl: "" so the button starts as "Upload photo".
    const uploadButton = within(dialog).getByTestId(
      "button-upload-image",
    ) as HTMLButtonElement;
    expect(uploadButton).toHaveTextContent(/Upload photo/i);
    expect(within(dialog).queryByAltText("Preview")).not.toBeInTheDocument();

    const file = new File(["hello"], "photo.png", { type: "image/png" });
    const fileInput = within(dialog).getByTestId(
      "input-product-image",
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    // fetch was called with a FormData body containing the file.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBeInstanceOf(File);

    // Preview image renders with the returned URL.
    const preview = await within(dialog).findByAltText("Preview");
    expect(preview).toHaveAttribute("src", uploadedUrl);

    // Success toast and the button now reads "Replace photo".
    expect(toast.success).toHaveBeenCalledWith("Photo uploaded");
    expect(toast.error).not.toHaveBeenCalled();
    expect(uploadButton).toHaveTextContent(/Replace photo/i);
  });

  it("shows an error toast and leaves imageUrl unchanged when fetch returns a non-2xx response", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "File rejected by server" }),
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    // Start with a product that already has a photo so we can prove it
    // was NOT replaced by the failed upload.
    const productWithPhoto = {
      ...baseProduct,
      imageUrl: "https://cdn.example.com/existing.png",
    } as unknown as Product;
    renderDialog(productWithPhoto);
    const dialog = await openDialog(user);

    const preview = within(dialog).getByAltText("Preview") as HTMLImageElement;
    expect(preview.src).toBe("https://cdn.example.com/existing.png");

    const file = new File(["x"], "photo.png", { type: "image/png" });
    await user.upload(
      within(dialog).getByTestId("input-product-image") as HTMLInputElement,
      file,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("File rejected by server");
    expect(toast.success).not.toHaveBeenCalled();

    // The original photo is still there — submitting the form proves
    // imageUrl was not overwritten.
    const stillPreview = within(dialog).getByAltText(
      "Preview",
    ) as HTMLImageElement;
    expect(stillPreview.src).toBe("https://cdn.example.com/existing.png");

    await user.click(within(dialog).getByTestId("button-submit-product"));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables.data.imageUrl).toBe("https://cdn.example.com/existing.png");
  });

  it("shows an error toast and leaves imageUrl unchanged when fetch throws", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockRejectedValue(new Error("Network down"));
    global.fetch = fetchSpy as unknown as typeof fetch;

    const productWithPhoto = {
      ...baseProduct,
      imageUrl: "https://cdn.example.com/existing.png",
    } as unknown as Product;
    renderDialog(productWithPhoto);
    const dialog = await openDialog(user);

    const file = new File(["x"], "photo.png", { type: "image/png" });
    await user.upload(
      within(dialog).getByTestId("input-product-image") as HTMLInputElement,
      file,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Network down");
    expect(toast.success).not.toHaveBeenCalled();

    const preview = within(dialog).getByAltText("Preview") as HTMLImageElement;
    expect(preview.src).toBe("https://cdn.example.com/existing.png");
  });

  it("disables the upload button while an upload is in flight and re-enables it after", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: { ok: boolean; json: () => Promise<unknown> }) => void = () => {};
    const fetchPromise = new Promise<{ ok: boolean; json: () => Promise<unknown> }>(
      (resolve) => {
        resolveFetch = resolve;
      },
    );
    const fetchSpy = vi.fn().mockReturnValue(fetchPromise);
    global.fetch = fetchSpy as unknown as typeof fetch;

    renderDialog();
    const dialog = await openDialog(user);

    const uploadButton = within(dialog).getByTestId(
      "button-upload-image",
    ) as HTMLButtonElement;
    expect(uploadButton).not.toBeDisabled();

    const file = new File(["x"], "photo.png", { type: "image/png" });
    await user.upload(
      within(dialog).getByTestId("input-product-image") as HTMLInputElement,
      file,
    );

    // Mid-flight: button should be disabled, label still "Upload photo".
    expect(uploadButton).toBeDisabled();
    expect(uploadButton).toHaveTextContent(/Upload photo/i);

    // Resolve the upload and wait for the post-upload state to settle.
    resolveFetch({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/done.png" }),
    });
    await within(dialog).findByAltText("Preview");

    expect(uploadButton).not.toBeDisabled();
    expect(uploadButton).toHaveTextContent(/Replace photo/i);
  });
});

describe("ProductFormDialog featured checkbox", () => {
  beforeEach(() => {
    updateMutate.mockReset();
    createMutate.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
  });

  it("includes isFeatured: true in the submitted body when the checkbox is toggled on", async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog(user);

    const checkbox = within(dialog).getByTestId(
      "checkbox-product-featured",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(true);

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables.data.isFeatured).toBe(true);
  });

  it("includes isFeatured: false in the submitted body when the checkbox is toggled off", async () => {
    const user = userEvent.setup();
    const featuredProduct = {
      ...baseProduct,
      isFeatured: true,
    } as unknown as Product;
    renderDialog(featuredProduct);
    const dialog = await openDialog(user);

    const checkbox = within(dialog).getByTestId(
      "checkbox-product-featured",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    await user.click(checkbox);
    expect(checkbox.checked).toBe(false);

    await user.click(within(dialog).getByTestId("button-submit-product"));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables.data.isFeatured).toBe(false);
  });
});
