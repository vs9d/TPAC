# TPAC Creators

A marketplace for designers on top of the existing store. Creators sell designs printed on TPAC's own garments. No second order or payment system exists: every creator listing is an ordinary `products` row, so it goes through the same cart, `quote_cart`, `place_order`, delivery and order statuses as the rest of the store.

## Enabling it in production

1. Run `supabase/add-creators.sql` in the Supabase SQL Editor. It is the same file as `migrations/20261128000026_creators.sql`.
2. Go to Admin → TPAC Creators → Settings and switch on the garments that creators may use (`product_types.creator_enabled`). Each garment can also have its own maximum markup and commission.
3. Review the platform rules on the same page: commission, minimum withdrawal, return window (hold days), mandatory review, maximum markup and payout methods.

## Analysis of the existing store (what is reused)

| Existing piece | How Creators use it |
|---|---|
| `products`, `product_variants`, `product_images`, `product_designs` | A listing is a product with `creator_id`. It has variants (colour × size, print on demand) and generated mockup images. |
| `product_types` + print areas + official mockup photos | The creator places artwork in the admin-defined print areas only. ProductStudio is reused with `uploader` and `areasOnly`. |
| Cart, `quote_cart`, `place_order`, orders, delivery | Unchanged. The server prices everything, as it already did. |
| `website_settings` | Platform rules are stored under the key `creators`. |
| `product-images` bucket | Creator files are written through signed upload URLs, restricted to the creator's own paths. |

The store's design and existing flows are unchanged. The additions are a "Designed by" chip on creator products, a filter that hides inactive variants on the product page, and links in the footer and mobile menu.

## Data model

- `creators`: profile, @username, socials, `status` (pending / approved / rejected / suspended), and an optional per-creator commission.
- `creator_products`: links a listing to its product. Stores `base_price` and `markup`, and the review status: draft / pending / approved / rejected / changes_requested / hidden.
- `creator_earnings`: one row per sold `order_items` line. It is **written only by database triggers**. It stores a snapshot of the commission mode and value, the markup, the quantity and the amount. Its status is pending → cleared (after delivery, and available after `hold_days`) or void (cancelled or returned).
- `creator_withdrawals`: requested → approved → paid, or rejected.
- `creator_notifications`, `creator_stats_daily` (page and product views), `creator_follows`.

### Earnings

- Price shown to the customer = `product_types.default_price` + markup, computed on the server.
- The markup is capped by the garment's `creator_max_markup`, or else by the platform's `max_markup`.
- Commission priority: the creator's own rule → the garment's rule → the platform rule.
- A **percent** rule pays `round(markup × pct / 100) × qty`. A **fixed** rule pays `value × qty`.
- The trigger `creator_earning_on_item` (AFTER INSERT on `order_items`) snapshots the rule in force at the moment of the sale. Later changes to the rules never change historical earnings.
- The trigger `creator_earning_on_status` handles order status changes:
  - delivered → cleared;
  - cancelled → void;
  - leaving delivered → back to pending.
- An admin can void a single earning as returned.
- Balance = cleared earnings whose `available_at` has passed, minus withdrawals that are paid or requested.

## Security

- All creator tables have RLS on with **no policies**. Browsers cannot read or write them at all; only server code (service role) can.
- Every creator action calls `assertCreator()` (approved only) and filters by the session's own `user_id`. A creator cannot reach another creator's rows.
- Prices, markups and earnings are never accepted from the browser.
  - `saveCreatorDesign` recomputes the price.
  - Colours and sizes are validated against the garment's defaults.
  - Earnings exist only through triggers.
- Uploads go through signed URLs, limited to `creators/<uid>/…` and `products/<own listing>/(art|gen)/<uuid>.(png|jpg|webp)`.
- With mandatory review on, `products.is_published` becomes true only when staff approve the design. Suspending a creator unpublishes all of their listings.
- Creators see only an order's number and status, never the customer's name, phone or address. This is enforced in `creatorEarnings()`, and the e2e suite checks it.
- Financial CSV exports (`/api/admin/creators/earnings`) are staff only, and cells are escaped against formulas.

## Pages

- **Public:**
  - `/creators` (landing)
  - `/creators/join` (application)
  - `/creators/top` (ranking by month or all time)
  - `/creator/<username>` (profile, Open Graph, follow, share, products)
- **Creator** (`/creator-studio`):
  - overview with charts
  - designs (new, edit, mockups, markup and net earning per piece)
  - orders
  - wallet and withdrawals
  - notifications
  - profile
- **Admin** (`/admin/creators`):
  - creators (approve, suspend, commission, earnings, void)
  - design review
  - withdrawals
  - settings (platform rules, garments, broadcast)
  - CSV reports

## Phase 2 (not built yet)

- Creator discount codes (approved by admin).
- Monthly contests and challenges with prizes.
- Email and WhatsApp notifications for creators. Today, creators are notified in the dashboard only.
