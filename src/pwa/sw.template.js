/* SchoolSpec service worker — hand-written, no bundler plugin (Next 16 builds
 * with Turbopack, so we own this file outright). scripts/stamp-sw.mjs copies
 * it to public/sw.js at build time with __SW_VERSION__ filled in from the
 * commit — a new deploy = a new worker = the in-app "update ready" toast.
 *
 * Strategy (see docs/CONNECTIONS.md for the ops side):
 *   /_next/static/*        cache-first, immutable (hashed filenames)
 *   images, fonts          stale-while-revalidate
 *   page navigations       network-first → last cached copy → /offline
 *   RSC / API / actions    network only (never cached; Next falls back to a
 *                          full navigation when they fail, which we DO handle)
 */
const VERSION = "__SW_VERSION__";
const STATIC = `ss-static-${VERSION}`;
const PAGES = `ss-pages-${VERSION}`;
const MEDIA = `ss-media-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-72.png"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    await cache.addAll(PRECACHE);
    // the offline page must render even if it was never opened online: pull
    // the chunks it references into the cache alongside its HTML
    try {
      const html = await (await cache.match(OFFLINE_URL)).text();
      const chunks = [...new Set(html.match(/\/_next\/static\/[^"'\s>]+/g) || [])];
      await Promise.allSettled(chunks.map((u) => cache.add(u)));
    } catch { /* still have the HTML */ }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, PAGES, MEDIA]);
    for (const k of await caches.keys()) if (k.startsWith("ss-") && !keep.has(k)) await caches.delete(k);
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch { /* optional */ }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const t = event.data && event.data.type;
  if (t === "SKIP_WAITING") self.skipWaiting();
  if (t === "GET_VERSION" && event.source) event.source.postMessage({ type: "VERSION", version: VERSION });
  if (t === "CLEAR_PAGES") caches.delete(PAGES);
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/");
const isMedia = (url, req) =>
  req.destination === "image" || req.destination === "font" ||
  url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/splash/") || url.pathname.startsWith("/shots/") ||
  /\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname) ||
  url.hostname === "fonts.gstatic.com";

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const refresh = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || refresh;
}

async function pageNetworkFirst(event) {
  const req = event.request;
  const cache = await caches.open(PAGES);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const res = preload || await fetch(req);
    // only remember real pages: redirects to sign-in and errors are not "the page"
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const offline = await (await caches.open(STATIC)).match(OFFLINE_URL);
    return offline || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    // signing out must not leave the last pages behind on a shared device
    if (new URL(req.url).pathname.includes("/api/auth/sign-out")) event.waitUntil(caches.delete(PAGES));
    return;
  }
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (req.mode === "navigate") { event.respondWith(pageNetworkFirst(event)); return; }
  if (!sameOrigin && url.hostname !== "fonts.gstatic.com" && url.hostname !== "fonts.googleapis.com") return;
  // Next's RSC payloads, prefetches and API calls: always live
  if (req.headers.get("RSC") || req.headers.get("Next-Router-Prefetch") || url.pathname.startsWith("/api/")) return;

  if (isStatic(url)) { event.respondWith(cacheFirst(req, STATIC)); return; }
  if (isMedia(url, req) || url.hostname === "fonts.googleapis.com") { event.respondWith(staleWhileRevalidate(req, MEDIA)); return; }
});

/* ── push notifications ─────────────────────────────────────────────────── */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "SchoolSpec";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/" },
    vibrate: [60, 30, 60],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data && event.notification.data.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url === url && "focus" in c) return c.focus();
    }
    if (all.length && "navigate" in all[0]) { await all[0].focus(); return all[0].navigate(url); }
    return self.clients.openWindow(url);
  })());
});
