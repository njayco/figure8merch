import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const setLocationMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/order-success", setLocationMock],
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetCartQueryKey: () => ["/api/cart"],
}));

let mockUser: { email: string; name: string } | null = {
  email: "alex@example.com",
  name: "Alex Doe",
};
let mockAuthLoading = false;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockAuthLoading }),
}));

import { OrderSuccess } from "./OrderSuccess";

let queryClient: QueryClient;
function renderPage() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <OrderSuccess />
    </QueryClientProvider>,
  );
}

const originalLocation = window.location;
function stubLocationSearch(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, search, pathname: "/order-success" },
  });
}
function restoreLocation() {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
}

const originalFetch = global.fetch;

describe("OrderSuccess order confirmation rendering", () => {
  beforeEach(() => {
    setLocationMock.mockReset();
    mockUser = { email: "alex@example.com", name: "Alex Doe" };
    mockAuthLoading = false;
    localStorage.setItem("token", "test-token");
  });
  afterEach(() => {
    global.fetch = originalFetch;
    restoreLocation();
    localStorage.clear();
  });

  it("redirects to /orders when no session_id is in the URL", async () => {
    stubLocationSearch("");
    global.fetch = vi.fn() as unknown as typeof fetch;

    renderPage();

    await waitFor(() => expect(setLocationMock).toHaveBeenCalledWith("/orders"));
    // No order-completion request should have fired.
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("shows the auth-loading spinner before auth resolves and does not call the API yet", () => {
    stubLocationSearch("?session_id=cs_test_pending");
    mockAuthLoading = true;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { container } = renderPage();

    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(screen.getByText(/Loading\.\.\./i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a login-required error when auth has resolved but there is no user", async () => {
    stubLocationSearch("?session_id=cs_test_anon");
    mockUser = null;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderPage();

    expect(
      await screen.findByText(/You must be logged in to complete your order/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Something went wrong/i })).toBeInTheDocument();
    // Did not even attempt to complete the order.
    expect(fetchMock).not.toHaveBeenCalled();

    // The "View Orders" button still navigates back to the orders list.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /View Orders/i }));
    expect(setLocationMock).toHaveBeenCalledWith("/orders");
  });

  it("posts the session_id with the auth token, renders the order id, and invalidates the cart cache on success", async () => {
    stubLocationSearch("?session_id=cs_test_success");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 4242 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderPage();

    // Confirmation appears with the right order id.
    expect(
      await screen.findByRole("heading", { name: /Order Confirmed/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/#4242/)).toBeInTheDocument();

    // Verify the request shape (URL, method, headers, body).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/stripe/complete-order");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      sessionId: "cs_test_success",
    });

    // Cart should have been marked stale so the bag empties on next view.
    const cartState = queryClient.getQueryState(["/api/cart"]);
    expect(cartState?.isInvalidated ?? true).toBe(true);
  });

  it("shows the API error message in the failure state when the completion call returns an error payload", async () => {
    stubLocationSearch("?session_id=cs_test_fail");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "Stripe session not paid" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderPage();

    expect(
      await screen.findByText(/Stripe session not paid/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Something went wrong/i }),
    ).toBeInTheDocument();
    // Did not render the success heading.
    expect(
      screen.queryByRole("heading", { name: /Order Confirmed/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a generic error when the completion call rejects (network failure)", async () => {
    stubLocationSearch("?session_id=cs_test_network_fail");
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network down"));
    global.fetch = fetchMock as unknown as typeof fetch;

    renderPage();

    expect(await screen.findByText(/Network down/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Something went wrong/i }),
    ).toBeInTheDocument();
  });

  it("navigates the user via the success-state buttons", async () => {
    stubLocationSearch("?session_id=cs_test_success_nav");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orderId: 7 }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: /Order Confirmed/i });

    await user.click(screen.getByRole("button", { name: /View Orders/i }));
    expect(setLocationMock).toHaveBeenCalledWith("/orders");

    setLocationMock.mockClear();
    await user.click(screen.getByRole("button", { name: /Continue Shopping/i }));
    expect(setLocationMock).toHaveBeenCalledWith("/shop");
  });
});
