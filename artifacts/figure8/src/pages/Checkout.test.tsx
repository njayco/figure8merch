import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const setLocationMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/checkout", setLocationMock],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useGetCart and getGetCartQueryKey are the only api-client-react exports
// the checkout page touches; mocking at this boundary mirrors how
// ProductFormDialog.test mocks the generated API hooks.
let mockCart: { items: Array<Record<string, unknown>>; total: number } | undefined;
let mockCartLoading = false;
vi.mock("@workspace/api-client-react", () => ({
  useGetCart: () => ({ data: mockCart, isLoading: mockCartLoading }),
  getGetCartQueryKey: () => ["/api/cart"],
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

// ProductImage hits a network endpoint to look up images by productId; stub it
// out so the tests don't try to fetch and so we don't need to assert image markup.
vi.mock("@/components/ProductImage", () => ({
  ProductImage: () => <span data-testid="product-image" />,
}));

import { Checkout } from "./Checkout";

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

function renderCheckout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Checkout />
    </QueryClientProvider>,
  );
}

// Replace window.location with a stub so the page's `window.location.href = ...`
// redirect is observable without jsdom complaining about navigation.
let hrefSetterSpy: ReturnType<typeof vi.fn>;
const originalLocation = window.location;
function stubLocation() {
  hrefSetterSpy = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      origin: "https://test.example.com",
      search: "",
      pathname: "/checkout",
      get href() {
        return "";
      },
      set href(value: string) {
        hrefSetterSpy(value);
      },
    },
  });
}
function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
}

const originalFetch = global.fetch;

describe("Checkout cart-to-checkout handoff", () => {
  beforeEach(() => {
    mockCart = sampleCart;
    mockCartLoading = false;
    mockUser = { email: "alex@example.com", name: "Alex Doe" };
    setLocationMock.mockReset();
    toastMock.mockReset();
    stubLocation();
    localStorage.setItem("token", "test-token");
  });
  afterEach(() => {
    global.fetch = originalFetch;
    restoreLocation();
    localStorage.clear();
  });

  it("shows a spinner while the cart is loading", () => {
    mockCartLoading = true;
    // Stripe config will resolve, but the spinner should already be on screen.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test" }),
    }) as unknown as typeof fetch;

    const { container } = renderCheckout();
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(screen.queryByText(/Checkout$/i)).not.toBeInTheDocument();
  });

  it("redirects to the cart page when the cart is empty", async () => {
    mockCart = { items: [], total: 0 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test" }),
    }) as unknown as typeof fetch;

    renderCheckout();
    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/cart"));
    expect(screen.queryByRole("heading", { name: /Checkout/i })).not.toBeInTheDocument();
  });

  it("renders the cart summary, total, and a per-item breakdown when ready", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test" }),
    }) as unknown as typeof fetch;

    renderCheckout();
    expect(await screen.findByRole("heading", { name: /Checkout/i })).toBeInTheDocument();
    // Item names from the cart appear in the order summary.
    expect(screen.getByText("Linen Shirt")).toBeInTheDocument();
    expect(screen.getByText("Cotton Pants")).toBeInTheDocument();
    // Line totals: 49.5 * 1 = 49.50, 20 * 2 = 40.00
    expect(screen.getByText("$49.50")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toBeInTheDocument();
    // Cart total appears on the totals row and on the submit button.
    const totals = screen.getAllByText("$89.50");
    expect(totals.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /Continue to Payment — \$89\.50/i }),
    ).toBeInTheDocument();
  });

  it("pre-fills the contact form with the signed-in user's email and split name", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test" }),
    }) as unknown as typeof fetch;

    renderCheckout();
    const email = await screen.findByLabelText(/Email/i);
    expect((email as HTMLInputElement).value).toBe("alex@example.com");
    expect((screen.getByLabelText(/First Name/i) as HTMLInputElement).value).toBe("Alex");
    expect((screen.getByLabelText(/Last Name/i) as HTMLInputElement).value).toBe("Doe");
  });
});

describe("Checkout payment intent / Stripe session creation", () => {
  beforeEach(() => {
    mockCart = sampleCart;
    mockCartLoading = false;
    mockUser = { email: "alex@example.com", name: "Alex Doe" };
    setLocationMock.mockReset();
    toastMock.mockReset();
    stubLocation();
    localStorage.setItem("token", "test-token");
  });
  afterEach(() => {
    global.fetch = originalFetch;
    restoreLocation();
    localStorage.clear();
  });

  it("disables the submit button and shows a warning when Stripe is not configured", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: null }),
    }) as unknown as typeof fetch;

    renderCheckout();
    const submit = await screen.findByRole("button", { name: /Payment Unavailable/i });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Stripe is not configured/i)).toBeInTheDocument();
  });

  it("treats a network failure on the config probe as Stripe-unavailable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;

    renderCheckout();
    const submit = await screen.findByRole("button", { name: /Payment Unavailable/i });
    expect(submit).toBeDisabled();
  });

  it("posts the shipping address and redirect URLs, then redirects to the Stripe checkout url", async () => {
    const stripeUrl = "https://checkout.stripe.com/c/pay/cs_test_123";
    const fetchMock = vi
      .fn()
      // 1) config probe
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publishableKey: "pk_test_abc" }),
      })
      // 2) create-checkout-session
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: stripeUrl }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderCheckout();

    // Fill the shipping form (email + name come pre-filled from the user).
    await user.type(await screen.findByLabelText(/Street Address/i), "123 Main St");
    await user.type(screen.getByLabelText(/City/i), "Brooklyn");
    await user.type(screen.getByLabelText(/State/i), "NY");
    await user.type(screen.getByLabelText(/Zip Code/i), "11201");

    await user.click(
      screen.getByRole("button", { name: /Continue to Payment — \$89\.50/i }),
    );

    // Wait for the redirect call (the second fetch).
    await waitFor(() => expect(hrefSetterSpy).toHaveBeenCalledWith(stripeUrl));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/stripe/create-checkout-session");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string);
    expect(body.shippingAddress).toBe(
      "Alex Doe, 123 Main St, Brooklyn, NY 11201",
    );
    expect(body.successUrl).toBe(
      "https://test.example.com/order-success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(body.cancelUrl).toBe("https://test.example.com/checkout");

    // Mid-redirect the button label should swap to "Redirecting...".
    expect(
      screen.getByRole("button", { name: /Redirecting to payment/i }),
    ).toBeDisabled();
  });

  it("shows an error toast and re-enables the button when the session creation request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publishableKey: "pk_test_abc" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Cart out of stock" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderCheckout();

    await user.type(await screen.findByLabelText(/Street Address/i), "123 Main St");
    await user.type(screen.getByLabelText(/City/i), "Brooklyn");
    await user.type(screen.getByLabelText(/State/i), "NY");
    await user.type(screen.getByLabelText(/Zip Code/i), "11201");

    await user.click(
      screen.getByRole("button", { name: /Continue to Payment/i }),
    );

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Checkout Error",
          description: "Cart out of stock",
        }),
      ),
    );
    expect(hrefSetterSpy).not.toHaveBeenCalled();
    // Button has been re-enabled and shows the original CTA again.
    const submit = await screen.findByRole("button", {
      name: /Continue to Payment — \$89\.50/i,
    });
    expect(submit).not.toBeDisabled();
  });

  it("blocks submission and skips the Stripe call when required shipping fields are missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test_abc" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderCheckout();

    // Submit immediately without filling address / city / state / zip.
    await user.click(
      await screen.findByRole("button", { name: /Continue to Payment/i }),
    );

    // Validation errors render via FormMessage — at least one should appear.
    await waitFor(() => {
      expect(screen.getByText(/Address required/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/City required/i)).toBeInTheDocument();

    // No second fetch — the config probe is the only call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/stripe/config");
    expect(hrefSetterSpy).not.toHaveBeenCalled();
  });

  it("blocks submission when the email field is invalid", async () => {
    mockUser = { email: "", name: "" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publishableKey: "pk_test_abc" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderCheckout();

    const email = await screen.findByLabelText(/Email/i);
    await user.type(email, "not-an-email");
    await user.type(screen.getByLabelText(/First Name/i), "Sam");
    await user.type(screen.getByLabelText(/Last Name/i), "Smith");
    await user.type(screen.getByLabelText(/Street Address/i), "1 Way");
    await user.type(screen.getByLabelText(/City/i), "Queens");
    await user.type(screen.getByLabelText(/State/i), "NY");
    await user.type(screen.getByLabelText(/Zip Code/i), "11375");

    await user.click(
      screen.getByRole("button", { name: /Continue to Payment/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
    });
    // Only the config probe should have happened.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hrefSetterSpy).not.toHaveBeenCalled();
  });
});
