# External integrations

| Integration | Status | What is built | To enable |
|---|---|---|---|
| Supabase (DB, Auth, Storage) | **Required** | Everything | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Email — Resend | Pending configuration | `src/lib/notifications/email.ts` (REST API), dispatch + delivery log | `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), optional `ADMIN_NOTIFICATION_EMAIL` |
| WhatsApp Business Cloud API (Meta) | Pending configuration | `src/lib/notifications/whatsapp.ts` (template messages via Graph API v21) | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_ORDER_UPDATE`, `WHATSAPP_TEMPLATE_LANGUAGE` |
| Online payments | **Not implemented** | Provider interface in `src/lib/payments.ts`; checkout hides the option until a provider is available | Implement an adapter + credentials (see below) |
| Instagram feed | Curated | Homepage grid from `homepage_sections.data.images` (falls back to product images) linking to the profile | Live feed would need the Instagram Graph API (business account + token) |

## Notifications

Events: order received / confirmed / shipped / delivered / cancelled (customer: email if provided + WhatsApp), new order, new custom-design order, new bulk request, new inquiry, low stock (admin: in-app always; email/WhatsApp when recipients are set in Admin → Settings).

In-app admin alerts are written by database triggers/functions, so they exist even if the app is offline when the event happens. External sends happen after the response (`after()`), are logged in `notifications` with `sent`, `failed` (with the provider error) or `skipped` (`provider_not_configured`).

### WhatsApp template
Business-initiated WhatsApp messages require an **approved template**. Create one named e.g. `order_update` (Arabic) with three body variables, for example:

> مرحباً {{1}}، طلبك رقم {{2}} من TPAC: {{3}}. شكراً لتسوقك معنا.

The app fills `{{1}}` name, `{{2}}` order number, `{{3}}` status text. Admin alerts reuse the same template with (`TPAC`, title, details) — create a separate template and adjust `src/lib/notifications/index.ts` if preferred.

## Online payments (to do)

Iraqi gateways (ZainCash, FIB — First Iraqi Bank, Qi Card / NassWallet, AsiaPay) each need merchant onboarding and sandbox credentials, so none is wired up and the storefront never shows a non-working payment option. To add one:

1. Implement `PaymentProvider` (`createPayment`, `verifyCallback`) in `src/lib/payments.ts` and register it in `providers`.
2. After `place_order` with `payment_method = 'online'` (orders start as `payment_status = 'pending'`), redirect to `createPayment().redirectUrl`.
3. Add a callback route that calls `verifyCallback`, then sets `payment_status = 'paid'` (service role) and confirms the order.
4. Set `PAYMENT_PROVIDER` + `PAYMENT_PROVIDER_SECRET`; the option appears at checkout automatically.
5. Unpaid online orders hold stock: add a scheduled job to cancel them after N minutes via `update_order_status`.

## Known limitations

- The root URL always redirects to Arabic for first-time visitors; the "default language" setting is stored but not yet read by `proxy.ts`.
- Low-stock filter in Admin → Inventory uses a fixed ≤ 5 view; the dashboard alert list uses each variant's own threshold.
- `npm audit` reports a `tar` advisory inside Fabric's optional Node `canvas` dependency; it is not used in the browser build.
