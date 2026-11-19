# Architecture

## Overview

```
Browser ──► Next.js 16 (Vercel / Node)
             ├─ proxy.ts            locale redirect (/ → /ar), Supabase session cookie refresh
             ├─ Server Components   read data with the visitor's session (RLS applies)
             ├─ Server Actions      validate with Zod → write via RLS session or SECURITY DEFINER RPCs
             └─ Route handlers      /api/search, /api/uploads/{sign,complete}, /api/admin/{orders,newsletter} (CSV)
                     │
                     ▼
            Supabase: Postgres (RLS everywhere) · Auth (email/password) · Storage (3 buckets)
```

**Trust boundaries**

| Concern | Where it is enforced |
|---|---|
| Who can read/write which rows | Postgres RLS (`20261117000003_rls.sql`) — even if app code had a bug, the database refuses |
| Prices, discounts, delivery fees, stock | `quote_cart()` / `place_order()` in Postgres; the browser only sends variant/design ids and quantities |
| Overselling | `place_order()` locks the inventory rows (`FOR UPDATE`, stable order) inside one transaction; `CHECK (quantity >= 0)` as a backstop |
| Order status changes | `update_order_status()` — staff only, forward-only transitions, stock restoration on cancellation, history row, customer notification, audit log |
| Money / status columns | trigger `guard_order_update` blocks direct edits from browser roles |
| Stock edits | trigger `guard_inventory_update` forces `adjust_inventory()` (audited) |
| Roles | `protect_profile_role` trigger: only admins change roles; admins can't demote themselves |
| Admin pages | `requireStaff()` in the admin layout + RLS; settings/roles are admin-only in both app and DB |
| Uploads | signed one-time upload URL → server downloads the object, checks magic bytes, size, SVG safety → registers or deletes it |
| Abuse | Postgres-backed fixed-window rate limits (`check_rate_limit`) on checkout, quote, tracking, auth, uploads, forms |
| Service role key | only read in `src/lib/supabase/admin.ts` (`server-only`), never `NEXT_PUBLIC_` |

## Request flows

**Checkout.** `CheckoutForm` → `placeOrder` server action → Zod (`checkoutSchema`, Iraqi phone normalisation) → rate limit (IP + phone) → `rpc('place_order')` with the service role. The function locks stock and the discount code, re-runs `quote_cart`, validates, inserts the order + items, decrements stock with `inventory_transactions`, records discount usage, writes status history and an admin alert — all or nothing. After the response, `after()` sends customer/admin notifications.

**Designer.** Fabric.js canvas in a 600×700 artboard; each object carries its placement (`front/back/left_chest/sleeve`) and is clipped and clamped to that print area. Artwork is uploaded straight to the private `design-uploads` bucket via a signed URL, then verified by `/api/uploads/complete`. "Add to bag" renders front/back JPEG previews, sends the object list (positions, scale, rotation, text, font, colour, artwork ids) to `saveDesign`, which re-validates, **recomputes the price from `custom_garment_types` + `print_locations`**, stores previews privately and links the original artwork. The order item references the design; admins see previews, placement JSON and download originals via signed URLs.

**Bulk.** Public request (+ verified artwork) → admin pipeline (`new → contacted → quoted → approved/rejected`) → quotation builder (pre-filled from `bulk_pricing_rules`) → `convert_quotation_to_order()` creates a confirmed order with `source = 'bulk'`.

## Database (PostgreSQL)

Migrations in `supabase/migrations/`:

1. `…01_schema.sql` — tables, enums, constraints, indexes
2. `…02_functions.sql` — business functions, triggers, function grants
3. `…03_rls.sql` — RLS policies and guard triggers
4. `…04_storage.sql` — buckets and storage policies
5. `…05_catalog_search.sql` — `catalog_search()` (SECURITY INVOKER, so RLS still applies)
6. `…06_admin.sql` — `admin_customers()` (registered + guest buyers)

| Table | Purpose |
|---|---|
| `auth.users` (Supabase) | accounts — the spec's *users* |
| `customer_profiles` | name, phone (E.164 without +), role `customer/staff/admin`, locale, marketing opt-in |
| `addresses` | saved delivery addresses (one default per user) |
| `categories`, `collections`, `product_collections` | taxonomy; collections support featured scheduling |
| `products` | bilingual content, base/compare price, flags (published, featured, new, limited, customisable), SEO, sales count |
| `product_images` | ordered images, optionally tied to a colour |
| `colors`, `sizes` | attribute dictionaries |
| `product_variants` | SKU, size × colour (unique), price override, active |
| `inventory`, `inventory_transactions` | stock per variant (≥ 0), threshold, full audit trail with reason/order/user |
| `carts`, `cart_items` | account carts (guests keep theirs in localStorage) |
| `orders`, `order_items`, `order_status_history`, `order_notes` | orders with snapshot line data, timestamped history, internal notes |
| `custom_garment_types`, `print_locations`, `custom_designs`, `uploaded_artwork` | designer pricing and saved designs/files |
| `bulk_order_requests`, `bulk_pricing_rules`, `quotations` | university/corporate pipeline |
| `discount_codes`, `discount_usage` | percent / fixed / free shipping, global and per-customer (user or phone) limits, schedules |
| `delivery_zones` | per-governorate standard/express/pickup fees, ETA, free-shipping threshold |
| `reviews`, `favorites`, `newsletter_subscribers`, `contact_inquiries` | engagement |
| `promo_banners`, `campaigns`, `homepage_sections`, `website_settings` | CMS & configuration (no secrets) |
| `notifications` | in-app alerts + email/WhatsApp delivery log (`pending/sent/failed/skipped`) |
| `admin_activity_logs`, `rate_limits` | audit and abuse protection |

Key functions: `quote_cart`, `place_order`, `update_order_status`, `adjust_inventory`, `track_order`, `catalog_search`, `bulk_unit_price`, `convert_quotation_to_order`, `admin_dashboard_stats`, `admin_customers`, `check_rate_limit`, `log_admin_activity`, `normalize_iraqi_phone`, `is_staff`, `is_admin`.

### Stock policy
Stock is **committed when the order is placed** (not at confirmation) so two customers can never buy the same last unit. Cancelling before the order ships restores it automatically (`cancellation` transaction). Cancelling after shipping does not restore stock — record returns with an inventory adjustment (`return`).

### Product printing configuration (`add-product-printing-1.sql + -2.sql`)

Admin-controlled templates that decide how every product is shown and where it may be printed — new kinds of
product are added from the dashboard, no code change needed.

| Table | Purpose |
|---|---|
| `product_types` | Hoodie, T-shirt, long sleeve… (code, names, default price / sizes / colours / category, optional built-in vector fallback) |
| `product_type_views` | Angles of a type (front, back, side…), each with its blank mockup photo, its pixel size, and optional per-colour mockups (`color_mockups` jsonb) |
| `product_print_areas` | Printable rectangles on a view — position/size as **fractions of the mockup**, plus `max_width_cm` / `max_height_cm` |
| `product_designs` | The official artwork the **admin** placed for a product — position/size as **fractions of its area** (CHECK: never outside the area) |
| `products.product_type_id / print_enabled / disabled_print_area_ids` | Template of a product and per-product switches |
| `product_images.view_id / is_generated` | Card/cart photos rendered from mockup + artwork; replaced (not duplicated) on every save |

* Print size in cm = design fraction × area max cm, so a design can never exceed the printable dimensions.
* Mockup choice: colour mockup → default photo → built-in vector garment (tinted).
* RLS: templates and artwork are public-read (artwork only for published products) and staff-write only;
  official artwork lives in the public `product-images` bucket under `products/<id>/art/`, mockups under `mockups/<type>/`.
* Admin UI: Dashboard → Product types & printing (mockups + visual area editor), New product → type picker → studio,
  product edit page → "Printing & mockup". Storefront: live layered mockups per angle/colour + print details.
* `website_settings.designer.customer_uploads` switches the customer print studio (customers' OWN artwork) on/off;
  enforced in `/api/uploads/sign` and `saveDesign`.

## Frontend

- `src/app/[locale]/(store)` storefront, `src/app/[locale]/admin` dashboard; `ar` is RTL, `en` LTR; `<html lang dir>` per locale.
- Dictionaries: `src/lib/i18n/dictionaries/{ar,en}.ts` (storefront); admin uses inline bilingual strings (`adminT`).
- Design tokens in `src/app/globals.css` (`@theme`): ink/paper/bone + TPAC amber `#E3963C` and pine `#376352` from the logo; Alexandria (display) + IBM Plex Sans Arabic (text).
- Product imagery shipped in `public/products` is generated from vector garments (`scripts/render-product-images.mjs`) as a starter set — replace with photography from Admin → Products.
- SEO: per-page metadata with `hreflang` alternates and canonicals, filtered catalog permutations `noindex`, Product/Breadcrumb/Organization JSON-LD, `sitemap.xml` (bilingual alternates), `robots.txt`, web manifest, OG image.
