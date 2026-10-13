// Traqen service worker — caches immutable static assets for fast launches.
// HTML, RSC payloads, and Supabase API calls are never cached because they can
// contain private, user-specific data.

const CACHE_NAME = "traqen-static-v2";

self.addEventListener("install", (event) => {
  // Precache nothing specific; static assets are cached on first visit.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch Supabase/auth traffic — always fresh.
  if (
    url.pathname.startsWith("/auth") ||
    url.pathname.includes("supabase") ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // Only cache immutable/static assets. HTML and RSC payloads contain
  // user-specific data and must never be reused across auth sessions.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|woff2?|png|svg|ico)$/.test(url.pathname);
  if (!isStaticAsset) return;

  // Static assets: cache-first with a network refresh on misses.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return Response.error();
        })
      )
  );
});
