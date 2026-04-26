import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Module boundary mocks ──────────────────────────────────────────────
//
// The React-side checkout tests mock the fetch boundary so the UI doesn't
// touch the real API. The API-side analogue is to mock the @workspace/db
// boundary (so we don't touch Postgres) and the stripeClient / stripeDb
// boundaries (so we don't touch Stripe). Schema constants are passed
// through from the real module so drizzle helpers like eq() still produce
// SQL expressions — those expressions are captured by the chain stubs and
// never executed.

type ChainResolver = () => unknown;

function chainable(resolver: ChainResolver) {
  const obj: Record<string, unknown> = {};
  for (const m of [
    "from",
    "where",
    "set",
    "values",
    "returning",
    "innerJoin",
    "leftJoin",
    "orderBy",
    "limit",
  ]) {
    obj[m] = vi.fn(() => obj);
  }
  obj.then = (
    onFulfilled: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(resolver()).then(onFulfilled, onRejected);
  return obj as Record<string, ReturnType<typeof vi.fn>> & {
    then: PromiseLike<unknown>["then"];
  };
}

const dbMock = {
  selectQueue: [] as unknown[],
  insertQueue: [] as unknown[],
  updateQueue: [] as unknown[],
  deleteQueue: [] as unknown[],
  insertImpl: undefined as undefined | (() => unknown),

  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),

  reset() {
    this.selectQueue = [];
    this.insertQueue = [];
    this.updateQueue = [];
    this.deleteQueue = [];
    this.insertImpl = undefined;
    this.select.mockReset();
    this.insert.mockReset();
    this.update.mockReset();
    this.delete.mockReset();
    this.select.mockImplementation(() =>
      chainable(() => this.selectQueue.shift() ?? []),
    );
    this.insert.mockImplementation(() =>
      chainable(() => {
        if (this.insertImpl) return this.insertImpl();
        return this.insertQueue.shift() ?? [];
      }),
    );
    this.update.mockImplementation(() =>
      chainable(() => this.updateQueue.shift() ?? []),
    );
    this.delete.mockImplementation(() =>
      chainable(() => this.deleteQueue.shift() ?? []),
    );
  },
};
dbMock.reset();

vi.mock("@workspace/db", async () => {
  const actual =
    await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
  return {
    ...actual,
    db: dbMock,
  };
});

const stripeMock = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
};

vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: vi.fn(async () => stripeMock),
  getStripePublishableKey: vi.fn(async () => "pk_test_xyz"),
}));

const stripeDbMock = {
  getStripeProductSummaries: vi.fn(),
  getVariantsForProducts: vi.fn(),
};

vi.mock("../lib/stripeDb", () => ({
  getStripeProductSummaries: (...args: unknown[]) =>
    stripeDbMock.getStripeProductSummaries(...args),
  getVariantsForProducts: (...args: unknown[]) =>
    stripeDbMock.getVariantsForProducts(...args),
}));

// Imports that depend on the mocks above must come AFTER the vi.mock calls.
const { default: stripeRouter } = await import("./stripe");
const { signToken } = await import("../middlewares/auth");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", stripeRouter);
  return app;
}

const USER_ID = 42;
const userToken = signToken(USER_ID, false);

function resetAllMocks() {
  dbMock.reset();
  stripeMock.customers.create.mockReset();
  stripeMock.checkout.sessions.create.mockReset();
  stripeMock.checkout.sessions.retrieve.mockReset();
  stripeDbMock.getStripeProductSummaries.mockReset();
  stripeDbMock.getVariantsForProducts.mockReset();
}

// ─── /stripe/create-checkout-session ─────────────────────────────────────

describe("POST /api/stripe/create-checkout-session", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .send({ shippingAddress: "x" });

    expect(res.status).toBe(401);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates a Stripe session, persists the cart snapshot with shipping address, and returns the session url", async () => {
    // 1) user lookup, 2) cart rows
    dbMock.selectQueue.push([
      {
        id: USER_ID,
        email: "alex@example.com",
        name: "Alex Doe",
        stripeCustomerId: "cus_existing",
      },
    ]);
    dbMock.selectQueue.push([
      {
        userId: USER_ID,
        productId: "prod_a",
        quantity: 2,
        size: "M",
        color: "Black",
      },
      {
        userId: USER_ID,
        productId: "prod_b",
        quantity: 1,
        size: "L",
        color: "",
      },
      // Same price as prod_a, different size — should aggregate quantities by price_id.
      {
        userId: USER_ID,
        productId: "prod_a",
        quantity: 3,
        size: "S",
        color: "Black",
      },
    ]);

    stripeDbMock.getStripeProductSummaries.mockResolvedValue([
      { id: "prod_a", name: "Shirt", price_id: "price_a", unit_amount: 1000 },
      { id: "prod_b", name: "Pants", price_id: "price_b", unit_amount: 2000 },
    ]);
    stripeDbMock.getVariantsForProducts.mockResolvedValue(new Map());

    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/cs_test_1",
    });

    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .set("Authorization", `Bearer ${userToken}`)
      .set("origin", "https://app.example.com")
      .send({
        shippingAddress: "Alex Doe, 123 Main St, NYC",
        successUrl: "https://app.example.com/success",
        cancelUrl: "https://app.example.com/cancel",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: "https://checkout.stripe.com/c/cs_test_1",
      sessionId: "cs_test_1",
    });

    // Stripe was called with aggregated line items keyed by price_id and the
    // verified redirect URLs.
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    const createArg = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(createArg).toMatchObject({
      mode: "payment",
      customer: "cus_existing",
      success_url: "https://app.example.com/success",
      cancel_url: "https://app.example.com/cancel",
      metadata: { userId: String(USER_ID) },
    });
    // line_items aggregation: prod_a had 2 + 3 = 5 units on price_a, prod_b had 1 on price_b.
    const byPrice = new Map(
      (createArg.line_items as Array<{ price: string; quantity: number }>).map(
        (l) => [l.price, l.quantity],
      ),
    );
    expect(byPrice.get("price_a")).toBe(5);
    expect(byPrice.get("price_b")).toBe(1);

    // No new Stripe customer was created — user already had one.
    expect(stripeMock.customers.create).not.toHaveBeenCalled();

    // Snapshot row was persisted with shipping address and JSON cart.
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const insertChain = dbMock.insert.mock.results[0].value as ReturnType<
      typeof chainable
    >;
    expect(insertChain.values).toHaveBeenCalledTimes(1);
    const insertedSnapshot = insertChain.values.mock.calls[0][0] as {
      sessionId: string;
      userId: number;
      shippingAddress: string;
      items: string;
    };
    expect(insertedSnapshot.sessionId).toBe("cs_test_1");
    expect(insertedSnapshot.userId).toBe(USER_ID);
    expect(insertedSnapshot.shippingAddress).toBe(
      "Alex Doe, 123 Main St, NYC",
    );
    const snapshotItems = JSON.parse(insertedSnapshot.items);
    expect(snapshotItems).toHaveLength(3);
    expect(snapshotItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "prod_a",
          quantity: 2,
          size: "M",
          color: "Black",
          stripePriceId: "price_a",
          price: 10,
        }),
        expect.objectContaining({
          productId: "prod_b",
          quantity: 1,
          size: "L",
          color: "",
          stripePriceId: "price_b",
          price: 20,
        }),
      ]),
    );
  });

  it("creates a Stripe customer on the fly when the user has none", async () => {
    dbMock.selectQueue.push([
      {
        id: USER_ID,
        email: "newcustomer@example.com",
        name: "New",
        stripeCustomerId: null,
      },
    ]);
    dbMock.selectQueue.push([
      { userId: USER_ID, productId: "prod_a", quantity: 1, size: "M", color: "Black" },
    ]);
    stripeDbMock.getStripeProductSummaries.mockResolvedValue([
      { id: "prod_a", name: "Shirt", price_id: "price_a", unit_amount: 1500 },
    ]);
    stripeDbMock.getVariantsForProducts.mockResolvedValue(new Map());

    stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_2",
      url: "https://checkout.stripe.com/c/cs_test_2",
    });

    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .set("Authorization", `Bearer ${userToken}`)
      .set("origin", "https://app.example.com")
      .send({ shippingAddress: "" });

    expect(res.status).toBe(200);
    expect(stripeMock.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "newcustomer@example.com",
        metadata: { userId: String(USER_ID) },
      }),
    );
    // The user row should have been updated with the new Stripe customer id.
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    const updateChain = dbMock.update.mock.results[0].value as ReturnType<
      typeof chainable
    >;
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ stripeCustomerId: "cus_new" }),
    );
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new" }),
    );
  });

  it("returns 400 when the cart is empty and never calls Stripe", async () => {
    dbMock.selectQueue.push([
      { id: USER_ID, email: "u@example.com", name: "U", stripeCustomerId: "cus_x" },
    ]);
    dbMock.selectQueue.push([]); // empty cart

    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .set("Authorization", `Bearer ${userToken}`)
      .set("origin", "https://app.example.com")
      .send({ shippingAddress: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cart is empty/i);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects redirect URLs that don't match the request origin", async () => {
    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .set("Authorization", `Bearer ${userToken}`)
      .set("origin", "https://app.example.com")
      .send({
        shippingAddress: "x",
        successUrl: "https://evil.example.com/take-the-money",
        cancelUrl: "https://app.example.com/cancel",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/successUrl/);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("returns 400 with the offending product names when a cart line has no active price", async () => {
    dbMock.selectQueue.push([
      { id: USER_ID, email: "u@example.com", name: "U", stripeCustomerId: "cus_x" },
    ]);
    dbMock.selectQueue.push([
      { userId: USER_ID, productId: "prod_a", quantity: 1, size: "M", color: "Black" },
    ]);
    stripeDbMock.getStripeProductSummaries.mockResolvedValue([
      // price_id is null — this product is no longer purchasable.
      { id: "prod_a", name: "Stale Shirt", price_id: null, unit_amount: null },
    ]);

    const res = await request(buildApp())
      .post("/api/stripe/create-checkout-session")
      .set("Authorization", `Bearer ${userToken}`)
      .set("origin", "https://app.example.com")
      .send({ shippingAddress: "x" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Stale Shirt/);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

// ─── /stripe/complete-order ──────────────────────────────────────────────

describe("POST /api/stripe/complete-order", () => {
  beforeEach(() => {
    resetAllMocks();
  });

  function paidSession(overrides: Record<string, unknown> = {}) {
    return {
      id: "cs_done",
      payment_status: "paid",
      amount_total: 8950,
      metadata: { userId: String(USER_ID) },
      payment_intent: {
        status: "succeeded",
        payment_method: { type: "card", card: { last4: "4242" } },
      },
      ...overrides,
    };
  }

  function snapshotRow(items: unknown[]) {
    return {
      sessionId: "cs_done",
      userId: USER_ID,
      shippingAddress: "Alex Doe, 123 Main St, NYC",
      items: JSON.stringify(items),
    };
  }

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(401);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing sessionId/);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });

  it("writes the order, clears the cart, deletes the snapshot, and records payment status on the happy path", async () => {
    const items = [
      {
        productId: "prod_a",
        productName: "Shirt",
        stripePriceId: "price_a",
        price: 49.5,
        quantity: 1,
        size: "M",
        color: "Black",
      },
      {
        productId: "prod_b",
        productName: "Pants",
        stripePriceId: "price_b",
        price: 20,
        quantity: 2,
        size: "L",
        color: "",
      },
    ];

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(paidSession());

    // 1) checkout snapshot lookup
    dbMock.selectQueue.push([snapshotRow(items)]);

    // No tracked variants for either product — skip the stock guard updates.
    stripeDbMock.getVariantsForProducts.mockResolvedValue(new Map());

    // insert ordersTable .returning()
    dbMock.insertQueue.push([
      {
        id: 777,
        userId: USER_ID,
        items,
        total: "89.50",
        status: "processing",
        shippingAddress: "Alex Doe, 123 Main St, NYC",
        stripeCheckoutSessionId: "cs_done",
        stripePaymentStatus: "succeeded",
        cardLast4: "4242",
      },
    ]);

    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orderId: 777 });

    // Stripe was asked for the session with the payment_method expanded.
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith(
      "cs_done",
      expect.objectContaining({
        expand: expect.arrayContaining(["payment_intent.payment_method"]),
      }),
    );

    // Order insert captured the snapshot data + Stripe payment metadata.
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const insertChain = dbMock.insert.mock.results[0].value as ReturnType<
      typeof chainable
    >;
    const inserted = insertChain.values.mock.calls[0][0] as {
      userId: number;
      items: unknown[];
      total: string;
      status: string;
      shippingAddress: string;
      stripeCheckoutSessionId: string;
      stripePaymentStatus: string;
      cardLast4: string | null;
    };
    expect(inserted.userId).toBe(USER_ID);
    expect(inserted.total).toBe("89.5");
    expect(inserted.status).toBe("processing");
    expect(inserted.shippingAddress).toBe("Alex Doe, 123 Main St, NYC");
    expect(inserted.stripeCheckoutSessionId).toBe("cs_done");
    expect(inserted.stripePaymentStatus).toBe("succeeded");
    expect(inserted.cardLast4).toBe("4242");
    expect(inserted.items).toEqual(items);

    // Cart was cleared and snapshot was deleted (two delete chains).
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
  });

  it("rejects an unpaid session with 400 and writes nothing", async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(
      paidSession({ payment_status: "unpaid" }),
    );

    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Payment not completed/i);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("rejects a session that belongs to a different user with 403", async () => {
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(
      paidSession({ metadata: { userId: "999" } }),
    );

    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(403);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns the existing order id without double-inserting when the snapshot is replayed", async () => {
    const items = [
      {
        productId: "prod_a",
        productName: "Shirt",
        stripePriceId: "price_a",
        price: 49.5,
        quantity: 1,
        size: "M",
        color: "Black",
      },
    ];

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(paidSession());
    // 1) snapshot lookup, 2) existing-order lookup after the unique-violation catch
    dbMock.selectQueue.push([snapshotRow(items)]);
    dbMock.selectQueue.push([{ id: 555 }]);

    stripeDbMock.getVariantsForProducts.mockResolvedValue(new Map());

    // Force the order insert to throw a Postgres unique-violation. The route's
    // catch block looks for the unique constraint name and falls back to
    // returning the already-existing order — so we never double-create.
    dbMock.insertImpl = () => {
      throw new Error(
        'duplicate key value violates unique constraint "orders_stripe_session_unique"',
      );
    };

    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ orderId: 555, alreadyCreated: true });
    // We tried exactly one insert — no retry.
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    // We did NOT clear the cart on the replayed call: that already happened
    // when the order was first created.
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("aborts with 409 when a tracked variant has sold out before payment is finalized", async () => {
    const items = [
      {
        productId: "prod_a",
        productName: "Shirt",
        stripePriceId: "price_a",
        price: 49.5,
        quantity: 1,
        size: "M",
        color: "Black",
      },
    ];

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(paidSession());
    dbMock.selectQueue.push([snapshotRow(items)]);

    // Variants exist for prod_a — that triggers the guarded UPDATE.
    stripeDbMock.getVariantsForProducts.mockResolvedValue(
      new Map([["prod_a", [{ size: "M", color: "Black", stock: 0 }]]]),
    );
    // The guarded UPDATE returns no rows — sold out.
    dbMock.updateQueue.push([]);

    const res = await request(buildApp())
      .post("/api/stripe/complete-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ sessionId: "cs_done" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/sold out/i);
    // No order was inserted and the cart was NOT cleared.
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});
