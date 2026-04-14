# figure 8.

**Premium Athleisure E-Commerce Platform**

A full-stack luxury athleisure brand built for Figure 8 — featuring an editorial aesthetic in cream, beige, and brown tones.

---

## Features

- **Editorial Splash Screen** — animated curtain reveal with serif logo
- **Interactive 4-Panel Hero** — hover to preview, click to navigate (New Arrivals, About, Community)
- **Shop** — product catalog with category filters and search
- **Product Detail** — size selection, wishlist, add to cart
- **Cart & Checkout** — simulated checkout flow with order summary
- **JWT Authentication** — login, register, protected routes
- **Wishlist** — save favourites across sessions
- **Email Popup** — 10% off with code `F8FIRST`
- **About Us** — editorial brand story page
- **Community Page** — brand community hub with Instagram link
- **Admin Dashboard** — full CRUD for products, image upload, order management
- **NYC Same-Day Delivery** — messaging integrated throughout checkout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS, inline editorial styles |
| Routing | Wouter |
| State | TanStack Query (React Query) |
| Backend | Node.js, Express, Fastify |
| Database | PostgreSQL (Drizzle ORM) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Monorepo | pnpm workspaces |

---

## Project Structure

```
artifacts/
  figure8/          # React + Vite frontend
    src/
      components/   # Navbar, SplashScreen, LandingHero, EmailModal, Footer...
      pages/        # Home, Shop, ProductDetail, Cart, Checkout, About, Community, Admin...
      hooks/        # useAuth
      contexts/     # AuthContext
  api-server/       # Express API server
    src/
      routes/       # products, cart, auth, orders, admin, wishlist
      db/           # Drizzle schema + migrations
lib/
  api-client-react/ # Generated React Query hooks
  api-zod/          # Zod schemas from OpenAPI spec
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/figure8 run dev
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |

---

## Admin Access

- **Email:** `admin@figure8.com`
- **Password:** `figure8admin`

---

## Contact

- Email: F8merch@gmail.com
- Phone: 786-967-9149

---

*Built with React + Node.js on Replit*
