// Kill switch for the (reverted) Ionic build's service worker.
//
// The app briefly shipped an Ionic version that registered this worker at
// /Gunpula/app/. The app has been rolled back to the vanilla build, so any
// client still controlled by that worker must be released: on its next update
// check the browser fetches this file, which clears the Ionic caches,
// unregisters itself, and reloads open clients so they load the vanilla app
// (which registers the root /Gunpula/sw.js instead).
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

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
