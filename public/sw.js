/* TPAC app service worker.
 * - Pages always come from the network (prices, stock and accounts are never stale); offline, a friendly page shows instead.
 * - Built files (/_next/static, hashed) are cached for good; photos are cached and refreshed in the background.
 * - Nothing personal is cached: no account pages, no API, no admin, no form posts.
 * - Push notifications: shows them and opens the right page on tap.
 */
const VERSION = "tpac-v1";
const STATIC = `${VERSION}-static`;
const IMAGES = `${VERSION}-images`;
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/brand/icon-192.png", "/brand/icon-96.png", "/brand/tpac-logo-white.png"];
const MAX_IMAGES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

const isImage = (url) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname) || url.pathname.startsWith("/_next/image");

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || /^\/(ar|en)\/(admin|auth)(\/|$)/.test(url.pathname)) return;

  // pages: network first; offline → the offline page
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        return preload || (await fetch(req));
      } catch {
        return (await caches.match(OFFLINE)) || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
      }
    })());
    return;
  }

  // hashed build files never change
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // photos: show the saved copy at once, refresh it in the background
  if (isImage(url)) {
    event.respondWith(caches.open(IMAGES).then(async (c) => {
      const hit = await c.match(req);
      const refresh = fetch(req).then((res) => {
        if (res.ok) c.put(req, res.clone()).then(() => trim(IMAGES, MAX_IMAGES));
        return res;
      }).catch(() => hit);
      return hit || refresh;
    }));
  }
});

/* ---------------------------------------------------------------- push notifications */

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "TPAC", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "TPAC";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/brand/icon-192.png",
    badge: "/brand/icon-96.png",
    tag: data.tag || undefined,
    lang: data.lang || "ar",
    dir: data.lang === "en" ? "ltr" : "rtl",
    data: { url: typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/ar" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/ar", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url === target && "focus" in w) return w.focus();
    }
    const any = wins.find((w) => "navigate" in w);
    if (any) { await any.navigate(target); return any.focus(); }
    return self.clients.openWindow(target);
  })());
});
