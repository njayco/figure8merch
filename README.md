# figure 8.

**Premium Athleisure E-Commerce Platform**

A full-stack luxury athleisure storefront for Figure 8 — featuring an editorial aesthetic in cream, beige, and brown tones, real Stripe payments, and a full admin dashboard for product and order management.

---

## Features

### Storefront
- **Editorial splash screen** — animated curtain reveal with serif logo
- **Interactive 4-panel hero** — hover to preview, click to navigate (New Arrivals, About, Community)
- **Shop** — product catalog backed by Stripe, with category filters and search
- **Product detail** — size/color selection, wishlist, add to cart
- **Cart** — quantity update, confirm-before-remove, NYC same-day delivery message on orders over $150
- **Checkout** — real Stripe payments via Stripe Elements / PaymentIntents
- **Order history** — 4-step progress (Placed → Processing → Shipped → Delivered) with carrier, tracking number, and estimated delivery
- **Wishlist** — heart icon on product cards, persisted server-side
- **Email popup** — 3s delay, 10% off code `F8FIRST`
- **About / FAQ** and **Community** pages with brand contact info

### Admin dashboard
- **Stats** — revenue, orders, customers, products
- **Orders table** — per-row status dropdown that auto-stamps `shippedAt` / `deliveredAt` / `estimatedDeliveryAt`, plus carrier and tracking number fields
- **Product CRUD** — create and edit products with image upload, sizes, colors, and per-variant stock
- **Per-variant stock quick edit** — adjust stock for a single (size, color) pair without opening the full edit dialog
- **Price-history visibility** — the Edit Product dialog lists every Stripe price for the product (current + archived) with active/archived badges and creation dates; the Orders table flags items whose current Stripe price differs from the price the customer was charged
- **Transactional emails** — automatic "Your order has shipped" and "Your order has arrived" emails via Resend, with idempotency flags so the same status change can't double-send

### Auth & accounts
- JWT login / register / logout (token stored as `f8_token` in `localStorage`)
- Protected routes for cart, checkout, orders, wishlist, and admin
- Admin role gated by env-configured credentials

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.9 |
| Styling | Tailwind CSS v4, shadcn/ui (Radix primitives) |
| Routing | Wouter |
| Data | TanStack Query + Orval-generated hooks from OpenAPI |
| Backend | Node.js 24, Express 5 |
| Database | PostgreSQL via Drizzle ORM |
| Validation | Zod (`zod/v4`), `drizzle-zod` |
| Payments | Stripe (Stripe Elements + `stripe-replit-sync`) |
| Email | Resend (Replit connector) |
| Auth | JWT (`jsonwebtoken` + `bcryptjs`) |
| Build | esbuild (api-server bundle), Vite (frontends) |
| Tests | Vitest + React Testing Library (jsdom) on the web app; Vitest + supertest on the api-server |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
artifacts/
  figure8/           # React + Vite storefront (preview path: /)
    src/
      components/    # Navbar, SplashScreen, LandingHero, EmailModal, Footer,
                     # ProductCard, ProductFormDialog, StockQuickEditDialog, ...
      pages/         # Home, Shop, ProductDetail, Cart, Checkout, OrderSuccess,
                     # Orders, Wishlist, Login, Register, About, Community, Admin, ...
      hooks/         # useAuth, ...
      contexts/      # AuthContext
      test/          # Vitest setup (jsdom, jest-dom, sonner mock)
  api-server/        # Express API (preview path: /api)
    src/
      routes/        # products, cart, auth, orders, admin, wishlist,
                     # email, upload, stripe, health
      lib/           # resendClient, orderEmails, ...
      middlewares/
      seed.ts        # seeds admin user + base catalog
      test/          # Vitest setup
  mockup-sandbox/    # Internal design canvas (preview path: /__mockup)

lib/
  api-spec/          # OpenAPI 3.1 spec + Orval config
  api-client-react/  # Generated React Query hooks + JWT-aware fetch
  api-zod/           # Zod schemas generated from the OpenAPI spec
  db/                # Drizzle schema (users, products, cart_items, wishlist,
                     # orders, order_items, email_signups, product_variants,
                     # checkout_snapshots) + drizzle-kit config
```

---

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Push the database schema (dev only)
pnpm --filter @workspace/db run push

# 3. Seed the admin user + base catalog
pnpm --filter @workspace/api-server run seed

# 4. Start the API server
pnpm --filter @workspace/api-server run dev

# 5. Start the storefront (in another shell)
pnpm --filter @workspace/figure8 run dev
```

### Useful root commands

| Command | What it does |
|---|---|
| `pnpm run typecheck` | Typecheck every package |
| `pnpm run test` | Run every package's `test` script (Vitest in `figure8` and `api-server`) |
| `pnpm run build` | `typecheck && test && per-package build` — a failing test blocks the build |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks and Zod schemas from the OpenAPI spec |

After running codegen, rebuild the api-client-react types:

```bash
pnpm --filter @workspace/api-client-react exec tsc -p tsconfig.json
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `ADMIN_EMAIL` | Email for the seeded admin account |
| `ADMIN_PASSWORD` | Password for the seeded admin account |
| `STRIPE_SECRET_KEY` | Stripe API key (server) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (storefront) |

The Resend, Stripe, and GitHub integrations are wired through Replit connectors, so their credentials are managed by the connector rather than as raw env vars.

---

## Admin Access

Admin credentials are stored as environment secrets (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
Set them before running the seed script — the seed creates the admin user with that email/password and grants the admin role.

---

## Contact

- Email: F8merch@gmail.com
- Phone: 786-967-9149

---

*Built with React + Node.js on Replit.*
