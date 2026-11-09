import { createHash } from "node:crypto";

// A cached copy is saved as app/assets/catalog/<franchise>/<kit>-<slot>-<sha1(url) 10>.<ext>
// (cache_catalog_images.mjs). The remote URL it was copied from used to stay in the
// gallery as well, so the app showed the same photo twice: the copy, then the original.
const CACHED = /^\.\/assets\/catalog\/[^/]+\/.+-\d{2}-([0-9a-f]{10})\.[a-z0-9]+$/i;

export function urlHash(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 10);
}

/** Drops remote gallery URLs that a local copy in the same gallery was made from. Returns how many. */
export function dropCachedOriginals(kit) {
  const gallery = kit.gallery_image_urls || [];
  const copied = new Set(gallery.map((url) => CACHED.exec(url || "")?.[1]).filter(Boolean));
  if (!copied.size) return 0;
  const kept = gallery.filter((url) => !(/^https?:\/\//i.test(url || "") && copied.has(urlHash(url))));
  const dropped = gallery.length - kept.length;
  if (dropped) kit.gallery_image_urls = kept;
  return dropped;
}
