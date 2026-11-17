# TPAC — E-commerce platform

Production e-commerce platform for **TPAC**, an Iraqi streetwear and custom-printing brand (thetpac.com).
Arabic-first (RTL) with English, IQD pricing, cash on delivery across all 19 governorates, a live
garment designer, a university/bulk order system, and a full admin dashboard.

- **Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Framer Motion, Fabric.js 7, Supabase (Postgres, Auth, Storage), Zod.
- **Docs:** [Architecture & database](docs/ARCHITECTURE.md) · [Deployment & operations](docs/DEPLOYMENT.md) · [External integrations](docs/INTEGRATIONS.md)

---

## Features

**Storefront** (`/ar` default, `/en`)
- Editorial homepage: announcement bar, hero campaign, shop by category, new arrivals, featured collection, best sellers, custom-design and university sections, brand story, Instagram grid, newsletter. Every section is editable, re-orderable and hideable from the dashboard.
- Catalog with category / collection / size / colour / price / availability / new / best-seller filters, four sort orders, search with live suggestions, "load more" pagination.
- Product pages: colour-aware gallery with zoom lightbox and swipe on mobile, size × colour variants with their own price and stock, live stock messages, size guide, add to bag / buy now, favourites, reviews (moderated), related products, Product + Breadcrumb structured data.
- Cart drawer + cart page; quantities, discount codes, stock warnings. Prices, discounts, delivery fees and availability are **always calculated by the database** (`quote_cart`), never trusted from the browser. Carts persist in the browser and, for signed-in customers, in their account across devices.
- Checkout: guest or signed-in, Iraqi phone validation (any format incl. Arabic digits), governorate-based delivery (standard / express / pickup where available), saved addresses, cash on delivery. Orders are placed by one transactional Postgres function that locks stock rows — overselling is impossible, including under concurrent checkouts.
- Order tracking by order number **and** phone (both must match).
- Accounts: register, sign in, password reset, profile, addresses, order history with timeline, reorder, favourites, notifications.
- **Custom designer** (`/design`): T-shirt, oversized tee, hoodie, sweatshirt; garment colour and size; front / back / left chest / sleeve placements with physical print sizes; upload artwork (stored privately in original quality, verified server-side) and add Arabic/English text with fonts, colours and sizes; objects are constrained to the print area; live price; front & back previews rendered and saved with the full placement JSON and attached to the order for production.
- **Universities & bulk** (`/bulk`): quantity pricing tiers, request form with size breakdown and up to 5 artwork files (incl. PDF).

**Admin dashboard** (`/ar/admin`, staff & admins only)
- Overview: sales, realised revenue, orders by state, customers, bulk requests, daily sales chart, best sellers, low-stock alerts, recent activity.
- Orders: search by number / name / phone, filter by status and date, details with custom-design previews and original files, status workflow with history (cancellation restores stock), internal notes, payment status, printable invoice, CSV export, WhatsApp shortcut.
- Products (CRUD, bilingual content, SEO, images per colour, variants generator, per-variant price), categories, collections (with feature scheduling), colours & sizes, inventory (adjustments with reasons and full history), reviews moderation, designer pricing.
- Customers: registered and guest buyers merged by phone, repeat-customer flag, purchase history, addresses, role management (admin only).
- Bulk: request pipeline, quotation builder (pre-filled from pricing rules), approve → **convert to order**, pricing rules editor.
- Marketing: discount codes (percent / fixed / free shipping, limits, schedules), banners (announcement, hero, promo, scheduled), campaigns linking a collection + code + banner on one schedule, newsletter subscribers + CSV, homepage sections editor.
- Settings (admin only): brand, contact, social links, minimum order, delivery fees per governorate, language default, notification recipients and toggles, information pages, integration status. Notifications centre and full admin activity log.

---

## Quick start (local development)

Requirements: Node 20+ (tested on 22), a Supabase project (cloud) **or** the Supabase CLI with Docker.

```bash
npm install
cp .env.example .env.local     # fill in the Supabase values (see below)

# Option A — Supabase CLI (local Docker stack)
npx supabase init               # once; keep the provided supabase/ folder
npx supabase start
npx supabase db reset           # applies supabase/migrations/* and supabase/seed.sql

# Option B — hosted Supabase project
npx supabase link --project-ref <ref>
npx supabase db push            # applies the migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # optional starter catalog

npm run dev                     # http://localhost:3000 → redirects to /ar
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server-only.** Used for checkout, uploads, rate limiting, notifications. Never prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical URL, e.g. `https://thetpac.com` (sitemap, OG, auth redirects) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL` | optional | Email notifications (pending configuration) |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_ORDER_UPDATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `ADMIN_NOTIFICATION_WHATSAPP` | optional | WhatsApp Business notifications (pending configuration) |
| `PAYMENT_PROVIDER`, `PAYMENT_PROVIDER_SECRET` | optional | Reserved for an online-payment adapter (not implemented — see integrations doc) |

### Creating the first admin

1. Register normally at `/ar/account/register`.
2. In the Supabase SQL editor run:
   ```sql
   update public.customer_profiles set role = 'admin'
    where id = (select id from auth.users where email = 'you@thetpac.com');
   ```
3. Sign out and in again, then open `/ar/admin`. Further staff/admins can be promoted from **Admin → Customers → (customer) → Role**.
   `staff` can run orders, catalog, inventory, bulk and marketing; only `admin` can change settings, delivery fees and roles.

---

## Testing

```bash
npm run typecheck
npm run test:unit       # validation, phone numbers, status workflow, upload sniffing, garments
npm run test:db         # Postgres integration: RLS isolation, checkout, inventory, workflow, authz
```

`test:db` creates a throwaway PostgreSQL 16 cluster (`scripts/local-db.sh`, needs the `postgres` binaries)
with a tiny Supabase-compatible shim (`tests/db/supabase-shim.sql`), applies every migration and the seed,
then impersonates the `anon` / `authenticated` / `service_role` roles exactly like PostgREST does.

**Browser end-to-end** (`tests/e2e/`): `supabase-emulator.mjs` is a test-only stand-in for the Supabase
HTTP APIs (a PostgREST subset, email/password auth and storage) running on the same real database with RLS
enforced; `flows.mjs` drives the built app with Playwright through guest checkout + tracking, cart limits and
discounts, registration/account/reorder/favourites, the designer (upload, bounds, pricing, order), bulk
requests, upload verification, admin authorisation and the admin workflows. See `docs/DEPLOYMENT.md#e2e`.

---

## Project layout

```
src/
  app/[locale]/(store)/…   storefront routes (home, shop, product, design, bulk, cart, checkout, track, account, pages)
  app/[locale]/admin/…     admin dashboard
  app/api/…                search, uploads (sign/complete), admin CSV exports
  components/              UI (home, product, cart, designer, account, admin, layout)
  lib/                     data access, server actions, validation, i18n, notifications, payments, garments
  proxy.ts                 locale routing + Supabase session refresh
supabase/migrations/       schema, functions, RLS, storage, catalog search, admin helpers
supabase/seed.sql          starter catalog (generated by scripts/generate-seed.mjs)
scripts/                   seed + product-image generators, local test database
tests/                     unit, db (integration), e2e (browser)
```
