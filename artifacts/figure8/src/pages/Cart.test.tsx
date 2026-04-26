import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Render Link as a real anchor so we can assert on hrefs (e.g. /checkout, /login).
vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock the generated cart hooks at the same module boundary the checkout
// tests use. mutate spies are reset between tests so each case can assert on
// exactly the call(s) it triggered.
const updateMutate = vi.fn();
const removeMutate = vi.fn();
const moveToSavedMutate = vi.fn();
const moveToCartMutate = vi.fn();
const removeSavedMutate = vi.fn();
let mockCart:
  | { items: Array<Record<string, unknown>>; total: number }
  | undefined;
let mockSaved: { items: Array<Record<string, unknown>> } | undefined;
let mockCartLoading = false;
let mockSavedLoading = false;
let updateIsPending = false;
let removeIsPending = false;
let moveToSavedIsPending = false;
let moveToCartIsPending = false;
let removeSavedIsPending = false;

vi.mock("@workspace/api-client-react", () => ({
  useGetCart: () => ({ data: mockCart, isLoading: mockCartLoading }),
  getGetCartQueryKey: () => ["/api/cart"],
  useUpdateCartItem: () => ({ mutate: updateMutate, isPending: updateIsPending }),
  useRemoveFromCart: () => ({ mutate: removeMutate, isPending: removeIsPending }),
  useGetSavedCart: () => ({ data: mockSaved, isLoading: mockSavedLoading }),
  getGetSavedCartQueryKey: () => ["/api/saved-cart"],
  useMoveCartItemToSaved: () => ({
    mutate: moveToSavedMutate,
    isPending: moveToSavedIsPending,
  }),
  useMoveSavedItemToCart: () => ({
    mutate: moveToCartMutate,
    isPending: moveToCartIsPending,
  }),
  useRemoveSavedItem: () => ({
    mutate: removeSavedMutate,
    isPending: removeSavedIsPending,
  }),
}));

let mockUser: { email: string; name: string } | null = {
  email: "alex@example.com",
  name: "Alex Doe",
};
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, isLoading: false }),
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

// ProductImage hits a network endpoint; stub it out so the tests don't try to fetch.
vi.mock("@/components/ProductImage", () => ({
  ProductImage: () => <span data-testid="product-image" />,
}));

import { Cart } from "./Cart";

const sampleCart = {
  total: 89.5,
  items: [
    {
      product: { id: "prod_1", name: "Linen Shirt", price: 49.5, imageUrl: "" },
      size: "M",
      color: "Black",
      quantity: 1,
    },
    {
      product: { id: "prod_2", name: "Cotton Pants", price: 20, imageUrl: "" },
      size: "L",
      color: "",
      quantity: 2,
    },
  ],
};

function renderCart() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Cart />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockCart = sampleCart;
  mockSaved = { items: [] };
  mockCartLoading = false;
  mockSavedLoading = false;
  updateIsPending = false;
  removeIsPending = false;
  moveToSavedIsPending = false;
  moveToCartIsPending = false;
  removeSavedIsPending = false;
  mockUser = { email: "alex@example.com", name: "Alex Doe" };
  updateMutate.mockReset();
  removeMutate.mockReset();
  moveToSavedMutate.mockReset();
  moveToCartMutate.mockReset();
  removeSavedMutate.mockReset();
  toastMock.mockReset();
});

describe("Cart empty / signed-out / loading states", () => {
  it("prompts the user to sign in when no user is logged in", () => {
    mockUser = null;
    renderCart();

    expect(
      screen.getByRole("heading", { name: /Your Cart$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please log in to view your cart/i),
    ).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: /Sign In/i });
    expect(signIn).toHaveAttribute("href", "/login");
    // The cart items / order summary should not render when signed out.
    expect(
      screen.queryByRole("heading", { name: /Shopping Cart/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a spinner while the cart is loading", () => {
    mockCartLoading = true;
    mockCart = undefined;

    const { container } = renderCart();
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Shopping Cart/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty-cart state with a Shop Now link when the cart has no items", () => {
    mockCart = { items: [], total: 0 };
    renderCart();

    expect(
      screen.getByRole("heading", { name: /Your Cart is Empty/i }),
    ).toBeInTheDocument();
    const shopNow = screen.getByRole("link", { name: /Shop Now/i });
    expect(shopNow).toHaveAttribute("href", "/shop");
    // Order summary should not render in the empty state.
    expect(screen.queryByText(/Order Summary/i)).not.toBeInTheDocument();
  });

  it("treats a missing cart payload (no data) the same as an empty cart", () => {
    mockCart = undefined;
    renderCart();

    expect(
      screen.getByRole("heading", { name: /Your Cart is Empty/i }),
    ).toBeInTheDocument();
  });
});

describe("Cart line item rendering", () => {
  it("renders one row per cart item with name, size, color and line total", () => {
    renderCart();

    expect(
      screen.getByRole("heading", { name: /Shopping Cart/i }),
    ).toBeInTheDocument();

    // Line for the first item (with a color).
    const firstRow = screen.getByTestId("cart-item-prod_1-M-Black");
    expect(within(firstRow).getByText("Linen Shirt")).toBeInTheDocument();
    expect(within(firstRow).getByText(/Size: M/i)).toBeInTheDocument();
    expect(within(firstRow).getByText(/Color: Black/i)).toBeInTheDocument();
    // 49.50 * 1 = 49.50
    expect(within(firstRow).getByText("$49.50")).toBeInTheDocument();

    // Line for the second item (no color → no Color: label).
    const secondRow = screen.getByTestId("cart-item-prod_2-L-");
    expect(within(secondRow).getByText("Cotton Pants")).toBeInTheDocument();
    expect(within(secondRow).getByText(/Size: L/i)).toBeInTheDocument();
    expect(within(secondRow).queryByText(/Color:/i)).not.toBeInTheDocument();
    // 20 * 2 = 40.00
    expect(within(secondRow).getByText("$40.00")).toBeInTheDocument();
  });
});

describe("Cart quantity controls", () => {
  it("calls useUpdateCartItem with quantity + 1 when the increase button is clicked", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Increase quantity/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_1",
      size: "M",
      data: { quantity: 2 },
      params: { color: "Black" },
    });
  });

  it("calls useUpdateCartItem with quantity - 1 when the decrease button is clicked", async () => {
    const user = userEvent.setup();
    renderCart();

    // prod_2 starts at quantity 2 so the decrease button is enabled.
    const row = screen.getByTestId("cart-item-prod_2-L-");
    await user.click(within(row).getByRole("button", { name: /Decrease quantity/i }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [variables] = updateMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_2",
      size: "L",
      data: { quantity: 1 },
      // No color → no `params` object passed to the API.
      params: undefined,
    });
  });

  it("disables the decrease button when the line quantity is 1 so we never send quantity 0", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    const decrease = within(row).getByRole("button", { name: /Decrease quantity/i });
    expect(decrease).toBeDisabled();

    // Even if a click sneaks through (e.g. via fireEvent), the handler bails on quantity < 1.
    await user.click(decrease);
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("disables both quantity buttons while an update is in flight", () => {
    updateIsPending = true;
    renderCart();

    const row = screen.getByTestId("cart-item-prod_2-L-");
    expect(
      within(row).getByRole("button", { name: /Increase quantity/i }),
    ).toBeDisabled();
    expect(
      within(row).getByRole("button", { name: /Decrease quantity/i }),
    ).toBeDisabled();
  });
});

describe("Cart remove button", () => {
  it("opens a confirmation dialog instead of removing immediately when Remove is clicked", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    // The confirm step should not have called the API yet.
    expect(removeMutate).not.toHaveBeenCalled();

    // The dialog should be visible with details about which line is being removed.
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Remove this item\?/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Linen Shirt/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Size: M/i),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Color: Black/i),
    ).toBeInTheDocument();
  });

  it("calls useRemoveFromCart with the line's product / size / color when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/i }));

    expect(removeMutate).toHaveBeenCalledTimes(1);
    const [variables] = removeMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_1",
      size: "M",
      params: { color: "Black" },
    });
  });

  it("omits the color params when confirming removal of a line that has no color", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_2-L-");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    const dialog = await screen.findByRole("alertdialog");
    // The dialog description should not mention a color when the line has none.
    expect(within(dialog).queryByText(/Color:/i)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/i }));

    expect(removeMutate).toHaveBeenCalledTimes(1);
    const [variables] = removeMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_2",
      size: "L",
      params: undefined,
    });
  });

  it("does not remove the item when the customer cancels the confirmation", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /Cancel/i }));

    expect(removeMutate).not.toHaveBeenCalled();
    // Dialog closes after cancel.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("disables every Remove trigger button while a remove request is in flight", () => {
    removeIsPending = true;
    renderCart();

    // Only the row-level trigger buttons should exist (no dialog open), and all should be disabled.
    for (const button of screen.getAllByRole("button", { name: /Remove/i })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("Cart order summary and checkout handoff", () => {
  it("renders subtotal and total based on cart.total", () => {
    renderCart();

    expect(screen.getByText(/Subtotal/i)).toBeInTheDocument();
    // Subtotal + Total both render the same total value.
    expect(screen.getAllByText("$89.50").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Calculated at checkout/i)).toBeInTheDocument();
  });

  it("links the Proceed to Checkout button to /checkout", () => {
    renderCart();

    const checkoutLink = screen.getByRole("link", {
      name: /Proceed to Checkout/i,
    });
    expect(checkoutLink).toHaveAttribute("href", "/checkout");
  });

  it("does NOT show the free-shipping callout when the subtotal is at or below $150", () => {
    mockCart = { ...sampleCart, total: 150 };
    renderCart();
    expect(
      screen.queryByText(/Free NYC Same-Day Delivery/i),
    ).not.toBeInTheDocument();
  });

  it("shows the free-shipping callout once the subtotal crosses the $150 threshold", () => {
    mockCart = { ...sampleCart, total: 150.01 };
    renderCart();
    expect(
      screen.getByText(/Free NYC Same-Day Delivery/i),
    ).toBeInTheDocument();
  });
});

describe("Cart error toasts", () => {
  it("shows a destructive toast with the server message when updating quantity fails", async () => {
    // Make the update mutation invoke its onError callback with a real Error,
    // mirroring how Checkout surfaces server errors via toast().
    updateMutate.mockImplementation((_vars, options) => {
      options?.onError?.(new Error("Item is out of stock"));
    });

    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Increase quantity/i }));

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't update item",
        description: "Item is out of stock",
      }),
    );
  });

  it("falls back to a generic message when the update error is not an Error instance", async () => {
    updateMutate.mockImplementation((_vars, options) => {
      options?.onError?.("network blip");
    });

    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_2-L-");
    await user.click(within(row).getByRole("button", { name: /Increase quantity/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't update item",
        description: "Unable to update item quantity",
      }),
    );
  });

  it("shows a destructive toast with the server message when removing an item fails", async () => {
    removeMutate.mockImplementation((_vars, options) => {
      options?.onError?.(new Error("Item no longer in cart"));
    });

    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    // The row Remove button only opens the confirmation dialog; the mutation
    // (and therefore the toast) is only triggered after the user confirms.
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/i }));

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't remove item",
        description: "Item no longer in cart",
      }),
    );
  });

  it("falls back to a generic message when the remove error is not an Error instance", async () => {
    removeMutate.mockImplementation((_vars, options) => {
      options?.onError?.({ unexpected: true });
    });

    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_2-L-");
    await user.click(within(row).getByRole("button", { name: /Remove/i }));

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        title: "Couldn't remove item",
        description: "Unable to remove item from cart",
      }),
    );
  });
});

describe("Cart Save for Later action", () => {
  it("calls useMoveCartItemToSaved with product / size / color when Save for Later is clicked", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_1-M-Black");
    await user.click(within(row).getByRole("button", { name: /Save for Later/i }));

    expect(moveToSavedMutate).toHaveBeenCalledTimes(1);
    const [variables] = moveToSavedMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_1",
      size: "M",
      params: { color: "Black" },
    });
  });

  it("omits the color params when saving a line that has no color", async () => {
    const user = userEvent.setup();
    renderCart();

    const row = screen.getByTestId("cart-item-prod_2-L-");
    await user.click(within(row).getByRole("button", { name: /Save for Later/i }));

    expect(moveToSavedMutate).toHaveBeenCalledTimes(1);
    const [variables] = moveToSavedMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_2",
      size: "L",
      params: undefined,
    });
  });

  it("disables every Save for Later button while a save is in flight", () => {
    moveToSavedIsPending = true;
    renderCart();
    for (const button of screen.getAllByRole("button", { name: /Save for Later/i })) {
      expect(button).toBeDisabled();
    }
  });
});

describe("Saved-for-later section", () => {
  const savedItems = {
    items: [
      {
        product: { id: "prod_3", name: "Wool Coat", price: 199, imageUrl: "" },
        size: "S",
        color: "Cream",
        quantity: 1,
      },
    ],
  };

  it("does not render the Saved for Later section when there are no saved items", () => {
    mockSaved = { items: [] };
    renderCart();
    expect(
      screen.queryByTestId("saved-for-later-section"),
    ).not.toBeInTheDocument();
  });

  it("renders saved items beneath the cart with name, size, color and price", () => {
    mockSaved = savedItems;
    renderCart();

    const section = screen.getByTestId("saved-for-later-section");
    expect(within(section).getByText(/Saved for Later/i)).toBeInTheDocument();

    const row = screen.getByTestId("saved-item-prod_3-S-Cream");
    expect(within(row).getByText("Wool Coat")).toBeInTheDocument();
    expect(within(row).getByText(/Size: S/i)).toBeInTheDocument();
    expect(within(row).getByText(/Color: Cream/i)).toBeInTheDocument();
    expect(within(row).getByText("$199.00")).toBeInTheDocument();
  });

  it("calls useMoveSavedItemToCart with the line's product / size / color when Move to Cart is clicked", async () => {
    const user = userEvent.setup();
    mockSaved = savedItems;
    renderCart();

    const row = screen.getByTestId("saved-item-prod_3-S-Cream");
    await user.click(within(row).getByRole("button", { name: /Move to Cart/i }));

    expect(moveToCartMutate).toHaveBeenCalledTimes(1);
    const [variables] = moveToCartMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_3",
      size: "S",
      params: { color: "Cream" },
    });
  });

  it("calls useRemoveSavedItem when the Remove button is clicked on a saved row", async () => {
    const user = userEvent.setup();
    mockSaved = savedItems;
    renderCart();

    const row = screen.getByTestId("saved-item-prod_3-S-Cream");
    await user.click(within(row).getByRole("button", { name: /Remove from saved/i }));

    expect(removeSavedMutate).toHaveBeenCalledTimes(1);
    const [variables] = removeSavedMutate.mock.calls[0];
    expect(variables).toEqual({
      productId: "prod_3",
      size: "S",
      params: { color: "Cream" },
    });
  });

  it("still shows the Saved for Later section when the active cart is empty but saved items exist", () => {
    mockCart = { items: [], total: 0 };
    mockSaved = savedItems;
    renderCart();

    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
    expect(screen.getByTestId("saved-for-later-section")).toBeInTheDocument();
    expect(screen.getByTestId("saved-item-prod_3-S-Cream")).toBeInTheDocument();
  });

  it("treats both empty cart and empty saved list as the global empty-cart state", () => {
    mockCart = { items: [], total: 0 };
    mockSaved = { items: [] };
    renderCart();

    expect(
      screen.getByRole("heading", { name: /Your Cart is Empty/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("saved-for-later-section"),
    ).not.toBeInTheDocument();
  });
});
