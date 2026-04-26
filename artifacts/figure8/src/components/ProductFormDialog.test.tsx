import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Product } from "@workspace/api-client-react";

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
