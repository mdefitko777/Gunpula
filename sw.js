const APP_CACHE = "gunpula-app-v42";
const DATA_CACHE = "gunpula-data-v1";
const IMAGE_CACHE = "gunpula-images-v1";
const NOTIFICATION_CACHE = "gunpula-notifications-v1";
const UPDATE_SYNC_TAG = "gunpula-update-check";

const APP_ASSETS = [
  "./app/",
  "./app/index.html",
  "./app/styles.css",
  "./app/main.js",
  "./app/i18n.js",
  "./app/auth.js",
  "./app/sync-config.js",
  "./app/manifest.webmanifest",
  "./app/icons/icon-192.png",
  "./app/icons/icon-512.png",
  "./app/icons/icon.svg",
  "./data/grades.json",
  "./data/split/manifest.json",
  "./data/sources.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => ![APP_CACHE, DATA_CACHE, IMAGE_CACHE, NOTIFICATION_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  if (url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, APP_CACHE));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./app/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const appClient = clients.find((client) => client.url.includes("/app/"));
        if (appClient) {
          appClient.focus();
          return appClient.navigate(targetUrl);
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SHOW_UPDATE_NOTIFICATION") {
    return;
  }
  event.waitUntil(self.registration.showNotification(event.data.title, event.data.options || {}));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === UPDATE_SYNC_TAG) {
    event.waitUntil(checkCatalogUpdates());
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw new Error("Offline and no cached response is available.");
  }
}

async function checkCatalogUpdates() {
  const response = await fetch("./data/update-feed-lite.json", { cache: "no-store" });
  if (!response.ok) {
    return;
  }
  const feed = await response.json();
  const entry = feed?.entries?.[0];
  const total = Number(entry?.added_count || 0) + Number(entry?.changed_count || 0) + Number(entry?.removed_count || 0);
  const priority = Number(entry?.watched_count || 0) + Number(entry?.premium_bandai_count || 0) + Number(entry?.bbx_count || 0);
  if (!entry || total <= 0 || priority <= 0) {
    return;
  }

  const signature = [entry.date, entry.added_count || 0, entry.changed_count || 0, entry.removed_count || 0, entry.watched_count || 0, entry.premium_bandai_count || 0, entry.bbx_count || 0].join(":");
  const cache = await caches.open(NOTIFICATION_CACHE);
  const marker = new Request("./notification-state/latest-update");
  const cached = await cache.match(marker);
  if ((await cached?.text()) === signature) {
    return;
  }
  await cache.put(marker, new Response(signature));
  await self.registration.showNotification("模型库有新更新", {
    body: `${entry.date} · 新增 ${entry.added_count || 0} · 变更 ${entry.changed_count || 0}`,
    tag: `gunpula-update-${entry.date}`,
    icon: "./app/icons/icon-192.png",
    badge: "./app/icons/icon-192.png",
    data: { url: "./app/#view=updates" },
  });
}
