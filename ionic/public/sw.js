// Gunpula (Ionic build) service worker.
//
// App shell is precached on install and served cache-first so the app opens
// offline; catalog JSON uses stale-while-revalidate so it renders instantly and
// refreshes in the background; images are cached opportunistically.
const APP_CACHE = "gunpula-ionic-app-v1";
const DATA_CACHE = "gunpula-ionic-data-v1";
const IMAGE_CACHE = "gunpula-ionic-images-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(["./", "./index.html", "./manifest.webmanifest"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([APP_CACHE, DATA_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Navigations: serve the shell so deep links work offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html", { ignoreSearch: true })),
    );
    return;
  }
  if (url.origin !== self.location.origin) {
    if (request.destination === "image") event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }
  if (/\/data\/.*\.json$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }
  if (/\.(js|css|woff2?|png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  }
});
