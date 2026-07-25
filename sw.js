// Legacy root service worker — now a kill switch.
//
// The app was rewritten to Ionic Vue, which registers its own worker scoped to
// /Gunpula/app/. This old worker was scoped to /Gunpula/ and would otherwise
// keep serving the previous cached shell to returning PWA users. On its next
// update check the browser fetches this file, which clears every cache it made,
// unregisters itself, and reloads open clients so they load the new app fresh
// and register the new worker.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        await caches.delete(key);
      }
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});

// While active (briefly, before unregistering), pass everything through to the
// network so no stale response is served.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
