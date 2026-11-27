# TPAC as an app (PWA)

The store installs on a phone as an app, with an icon on the home screen. It opens full screen with no browser bar and receives notifications. It is the same website, so every deploy reaches the installed app at once. No app store is involved.

## What's included

| Piece | Where |
|---|---|
| App manifest: name, colours, normal and maskable icons, shortcuts (design, track, bag, account) | `src/app/manifest.ts`, `public/brand/icon-*.png` |
| Service worker | `public/sw.js` |
| Offline page | `public/offline.html` |
| "Get the app" (banner, menu, footer) | `src/components/pwa/install.tsx` |
| Phone notifications | `src/components/pwa/push-toggle.tsx`, `src/lib/notifications/push.ts`, `src/lib/actions/push.ts` |

### Service worker (`public/sw.js`)

- Pages always come from the network, so prices, stock and accounts are never stale.
- When the phone is offline, a friendly offline page shows instead.
- Build files are cached permanently, and photos are refreshed in the background.
- Nothing personal is cached: no API responses, no admin pages, no form posts.

### "Get the app"

- **Android:** the browser's own install dialog opens.
- **iPhone (Safari):** step-by-step instructions (Share → Add to Home Screen).
- **Inside Instagram, TikTok or Facebook:** the visitor is first told to open the page in their browser.
- **Where it appears:**
  - A small banner after 6 seconds on browsing pages, on phones only. "Not now" hides it for 14 days.
  - The menu and the footer.
- It is hidden once the app is installed.

### Phone notifications

| Who | When |
|---|---|
| Customers | Order received, confirmed, shipped, delivered or cancelled. Tapping opens order tracking. |
| Creators | Every creator notification: sale, completed order, design review, payout. |
| Staff (admin and staff roles) | Every new order. Tapping opens the order in the dashboard. |

- **Who can turn them on:** signed-in accounts only. The switch is on the account page, the creator notifications page, the admin overview, and the order success page.
- **iPhone:** web notifications only work from the installed app (iOS 16.4 or later), so the switch asks iPhone users to install the app first.

## Setup

1. Run `supabase/add-web-push.sql` in the Supabase SQL Editor. It creates:
   - `push_subscriptions`: one row per device.
   - `app_secrets`: the push signing keys.
   - `creator_notifications.pushed_at`.

   Both tables are server-only: RLS is on with no policies.
2. Nothing else is required. The push signing keys are created automatically on first use and stored in `app_secrets`.
   - To manage them yourself instead, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Vercel.
   - Never change them after people have subscribed, or their devices stop receiving notifications.

## Later: App Store / Google Play

Wrap the same site with Capacitor and add native features, for example sign-in with Face ID. Apple rejects apps that are only a website in a wrapper. The PWA work above carries over.
