# Deployment & operations

## 1. Supabase

1. Create a project (region close to Iraq, e.g. Frankfurt `eu-central-1`).
2. Apply the schema:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push              # runs supabase/migrations in order
   ```
   Or paste each migration file into the SQL editor in order.
3. Optional starter catalog: run `supabase/seed.sql` (SQL editor or `psql`). It creates categories, collections, 16 products with variants/stock, delivery fees for all 19 governorates, designer pricing, bulk tiers, discount codes `WELCOME10`, `TPAC5000`, `FREESHIP`, banners, homepage sections and settings. Product image URLs point to `/products/*.webp`, which ship with the app.
4. **Auth settings** (Dashboard → Authentication):
   - Site URL: `https://thetpac.com`
   - Redirect URLs: `https://thetpac.com/ar/auth/callback`, `https://thetpac.com/en/auth/callback`
   - Email confirmation: on (recommended). Configure custom SMTP for production email deliverability.
   - Minimum password length: 8.
5. Storage buckets are created by migration 4 (`product-images` public, `site-media` public, `design-uploads` private).

## 2. Vercel (recommended)

1. Import the repository; framework preset Next.js; Node 20+.
2. Environment variables (Production + Preview): see the table in the README. `SUPABASE_SERVICE_ROLE_KEY` must be marked **sensitive** and must not have a `NEXT_PUBLIC_` prefix.
3. Domain: add `thetpac.com` and `www.thetpac.com` (redirect www → apex). Set `NEXT_PUBLIC_SITE_URL=https://thetpac.com`.
4. Deploy. Visiting `/` redirects to `/ar` (or the visitor's last language).

Self-hosting works too: `npm ci && npm run build && npm start` behind a reverse proxy that sets `X-Forwarded-For` (used by rate limiting).

## 3. After the first deploy

- Create the first admin (README → *Creating the first admin*).
- Admin → Settings: contact phone/WhatsApp/email, social links, notification recipients, delivery fees, minimum order.
- Admin → Products: upload real photography (1200×1500 recommended) and remove the generated starter images.
- Admin → Homepage / Banners: set the hero image and campaign copy.
- Search Console: submit `https://thetpac.com/sitemap.xml`.

## 4. Operations

- **Backups:** enable Supabase PITR (Pro plan) or schedule `pg_dump`.
- **Order handling:** new orders arrive as `received` and show a badge in the admin sidebar. Typical flow: confirm by phone → `confirmed` → `preparing` → (`printing` → `quality_check` for printed/custom items) → `ready_to_ship` → `shipped` → `delivered` (COD is marked paid automatically on delivery).
- **Notifications:** every external message is logged in Admin → Notifications with its status. With no provider configured they are `skipped` — nothing is pretended to have been sent.
- **Rate limits** live in `public.rate_limits`; it can be truncated safely at any time.

## 5. Tests

```bash
npm run typecheck && npm run test:unit && npm run test:db
```
`test:db` needs PostgreSQL 16 server binaries (`/usr/lib/postgresql/16/bin`, override with `PGBIN`).

<a id="e2e"></a>
### Browser end-to-end (local)

```bash
bash scripts/local-db.sh                          # fresh DB + migrations + seed (port 54329)
node tests/e2e/supabase-emulator.mjs &            # prints ANON_KEY / SERVICE_KEY (port 54321)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY> SUPABASE_SERVICE_ROLE_KEY=<SERVICE_KEY> \
NEXT_PUBLIC_SITE_URL=http://localhost:3100 ALLOW_LOCAL_IMAGES=1 \
  sh -c 'npx next build && npx next start -p 3100' &
node tests/e2e/flows.mjs                          # Playwright flows
```
The emulator is a **test-only** stand-in for Supabase's HTTP APIs (where its Docker images are unavailable); it runs requests on the real database with `SET LOCAL ROLE` and JWT claims so RLS is exercised. Before launch, also run the flows once against a real Supabase staging project.
