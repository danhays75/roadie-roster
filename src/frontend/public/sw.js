/*
 * Roadie service worker.
 *
 * Strategy:
 *  - Precache only the app shell (the HTML entry and the web manifest).
 *  - Cache hashed build assets (Vite emits /assets/<name>-<hash>.<ext>) at runtime.
 *  - Never cache API calls, non-GET requests, cross-origin requests, or non-OK responses.
 *  - Version the cache name per build so a new deploy evicts the previous shell.
 */
const CACHE_VERSION = "roadie-shell-2026-11-01";
const CACHE = CACHE_VERSION;
const SHELL = ["/", "/manifest.webmanifest"];

// Vite fingerprints emitted assets with a content hash, e.g. /assets/index-a1b2c3d4.js
const HASHED_ASSET = /\/assets\/.+-[0-9a-zA-Z_-]{8,}\.(?:js|mjs|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|avif|ico)$/;

function isCacheableAsset(url) {
  return HASHED_ASSET.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only same-origin GET requests are eligible.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Hashed build assets: cache-first, then network; only OK responses are stored.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        });
      }),
    );
    return;
  }

  // Everything else (API calls, manifest, icons, uncached routes): network only.
});
