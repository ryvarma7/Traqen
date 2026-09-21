// Traqen service worker — caches the app shell for fast launches.
// Supabase API calls are never cached (always network-first) so data stays fresh.

const CACHE_NAME = "traqen-shell-v1";

self.addEventListener("install", (event) => {
  // Precache nothing specific; pages get cached on first visit (see fetch).
  self.skipWaiting();
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

  // Navigation + static assets: network-first, fall back to cache when offline.
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
          // Offline fallback for navigations: serve the cached home page.
          if (request.mode === "navigate") {
            return caches.match("/");
          }
          return Response.error();
        })
      )
  );
});
