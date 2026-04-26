# Figure 8 Athleisure E-Commerce

## Overview

Full-stack premium athleisure e-commerce platform for the "Figure 8" brand. Luxury cream/beige/brown aesthetic.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + TailwindCSS v4 + shadcn/ui
- **Auth**: JWT (bcryptjs), stored in localStorage as `f8_token`

## Features

- Homepage with hero (brand photo), featured products, split section, newsletter CTA
- Shop with category filters (sidebar) and product grid
- Product detail page with size selection, add to cart, wishlist toggle
- Shopping cart with quantity update, remove (with confirmation), **Save for Later** (move cart line into a server-persisted saved-for-later list shown beneath the cart, with Move to Cart / Remove actions; survives sign-out/sign-in via `saved_cart_items` table), NYC same-day delivery message (orders > $150)
- Checkout with real Stripe Payments (Stripe Elements / PaymentIntent flow)
- JWT Auth (login/register/logout)
- Wishlist (heart icon on product cards)
- Order history with shipping status, 4-step progress indicator (Order Placed → Processing → Shipped → Delivered), tracking carrier/number, and estimated delivery
- Email popup (3s delay, 10% off code `F8FIRST`, controlled by `f8_has_seen_modal` localStorage)
- Admin dashboard (stats: revenue, orders, customers, products; orders table with per-row status dropdown that auto-stamps `shippedAt`/`deliveredAt`/`estimatedDeliveryAt`)
- Admin product management: create, **edit (PUT /api/products/:id, full update with Stripe + variants atomic w/ rollback)**, and **per-(size,color) quick stock adjust (PATCH /api/products/:id/variant)** via `ProductFormDialog` (mode=create|edit) and `StockQuickEditDialog`. Stripe prices are immutable, so price edits create a new price and deactivate the old one (best-effort).
- **Admin price-history visibility**: the Edit Product dialog shows a "Price history" note (`section-price-history` testid) listing every Stripe price for the product (current + archived), each with the formatted amount, an active/archived badge, and a creation date. Powered by `GET /api/admin/products/:id/price-history` which queries `stripe.prices` ordered by `created DESC` and flags the entry matching `stripe.products.default_price` as `isCurrent`. The admin Orders table also shows a small ↑/↓ badge in the corner of an order item thumbnail when `currentPrice !== price` (the charged-at-time price); the tooltip shows "Charged $X · Now $Y (±$Z)" for that item. `currentPrice` is derived from a per-request `getStripeProductSummaries` lookup in `routes/orders.ts` (no schema changes).
- About/FAQ page with contact info (F8merch@gmail.com, 786-967-9149)

## Admin Credentials

Stored as environment secrets: `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
Set via Replit Secrets before running the seed script.

## Packages

- `artifacts/figure8` — React/Vite frontend, served at `/`
- `artifacts/api-server` — Express API server
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`)
- `lib/api-client-react` — Orval-generated React Query hooks + custom fetch with JWT auth
- `lib/db` — Drizzle ORM schemas and migrations

## Database Schema

Tables: `users`, `products` (legacy), `cart_items`, `wishlist`, `orders`, `order_items`, `email_signups`

`orders` includes `notified_shipped_at` / `notified_delivered_at` flags used to
dedupe transactional shipping emails (see "Transactional Email" below).
Stripe sync schema: `stripe.products`, `stripe.prices`, `stripe.customers`, etc. (managed by `stripe-replit-sync`)

**Product data source**: Shop reads from `stripe.products` + `stripe.prices` tables (not local `products` table).
Product IDs are Stripe product IDs (strings like `prod_xxx`). `cart_items.product_id` and `wishlist.product_id` are `text` (no FK to products table).

Stripe products: The Signature Set ($148), The Elevated Legging ($88), The Studio Bra ($68), The Butter Short ($72), The Café Cardigan ($112), The Seamless Top ($62)
Categories: sets, tops, bottoms, outerwear

## Brand Assets

- Hero photo: `attached_assets/Main_Profile_Photo_1776194361813.jpg`
- Detail photo: `attached_assets/f8arm_1776194361813.JPG`
- Vite alias `@assets` → `../../attached_assets`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run test` — run every package's `test` script (currently just `@workspace/figure8`'s Vitest suite); skips packages without one
- `pnpm run build` — typecheck + test + build all packages (a failing test blocks the build the same way a failing typecheck does)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/figure8 run test` — run frontend component tests (Vitest + React Testing Library, jsdom)

## Frontend Tests

Vitest + React Testing Library, jsdom environment. Config at
`artifacts/figure8/vitest.config.ts`, setup at `artifacts/figure8/src/test/setup.ts`
(adds `@testing-library/jest-dom` matchers, jsdom polyfills for Radix pointer
APIs, and a default `sonner` toast mock). Test files live next to the
component as `*.test.tsx` and are excluded from `tsc` typecheck via the
artifact's `tsconfig.json`. Mock generated API hooks (`useUpdateProduct`,
etc.) at the module level — they're plain React Query mutations so a stub
returning `{ mutate, isPending: false }` is enough.

The suite runs automatically on every change: the root `pnpm run build`
chain is `typecheck && test && per-package build`, so a failing test
fails the deploy build the same way a failing typecheck does today.

To add a new test suite to another package, give that package a `test`
script — the root `pnpm run test` discovers it automatically via
`pnpm -r --if-present run test`.

## Transactional Email

Powered by Resend (Replit connector). The `PATCH /api/admin/orders/:id` route
sends two transactional emails on real status transitions:
- "Your order has shipped" — when status flips to `shipped` (with carrier,
  tracking #, tracking link if recognized carrier, and ETA)
- "Your order has arrived" — when status flips to `delivered`

Idempotency is enforced via `orders.notified_shipped_at` /
`notified_delivered_at` (stamped only on successful send, so a transient
failure can be retried by re-applying the status). Re-saving the same status
does not send a duplicate.

Setup: the store owner must verify their sending domain in the Resend
dashboard (domain comes from the connector's configured `from_email`).
Until verified, sends will fail with a 403 and the notification flag stays
`NULL`; everything else (status updates, ETA stamping) still works.

Code: `artifacts/api-server/src/lib/resendClient.ts`,
`artifacts/api-server/src/lib/orderEmails.ts`.

## Important Notes

- After running codegen, must rebuild api-client-react types: `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
- The `@workspace/api-client-react` package only exports `.` (index); no subpath imports
- Wishlist/Cart mutations use `{ productId: string }` as path param variable name (NOT `id`)
- Product.id is now a `string` (Stripe product ID like `prod_xxx`), not a number
- `useGetCart/useGetWishlist/useGetMe` hooks take `{ query: { enabled, queryKey } }` options
- bcrypt: uses `bcryptjs` (pure JS) NOT `bcrypt` (native)
- Color theme: cream/beige/brown — `--primary: 28 40% 30%` (deep brown), `--background: 40 33% 98%` (cream)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
