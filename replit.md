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
- Shopping cart with quantity update, remove, NYC same-day delivery message (orders > $150)
- Checkout with real Stripe Payments (Stripe Elements / PaymentIntent flow)
- JWT Auth (login/register/logout)
- Wishlist (heart icon on product cards)
- Order history
- Email popup (3s delay, 10% off code `F8FIRST`, controlled by `f8_has_seen_modal` localStorage)
- Admin dashboard (stats: revenue, orders, customers, products; orders table)
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
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- After running codegen, must rebuild api-client-react types: `pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json`
- The `@workspace/api-client-react` package only exports `.` (index); no subpath imports
- Wishlist/Cart mutations use `{ productId: string }` as path param variable name (NOT `id`)
- Product.id is now a `string` (Stripe product ID like `prod_xxx`), not a number
- `useGetCart/useGetWishlist/useGetMe` hooks take `{ query: { enabled, queryKey } }` options
- bcrypt: uses `bcryptjs` (pure JS) NOT `bcrypt` (native)
- Color theme: cream/beige/brown — `--primary: 28 40% 30%` (deep brown), `--background: 40 33% 98%` (cream)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
