import { createHash } from "node:crypto";

// A cached copy is saved as app/assets/catalog/<franchise>/<kit>-<slot>-<sha1(url) 10>.<ext>
// (cache_catalog_images.mjs). The remote URL it was copied from used to stay in the
// gallery as well, so the app showed the same photo twice: the copy, then the original.
const CACHED = /^\.\/assets\/catalog\/[^/]+\/.+-\d{2}-([0-9a-f]{10})\.[a-z0-9]+$/i;

export function urlHash(url) {
  return createHash("sha1").update(url).digest("hex").slice(0, 10);
}

/**
 * Drops remote gallery URLs that a local copy in the same gallery was made from and
 * keeps them in images.cached_from (not shown by the app): the URL itself carries
 * information, e.g. Aniplex+ catalogue folders (title-H/fgo/nazomaru/…) that file FGO
 * goods under events / Fes. in the atlas. Returns how many were dropped.
 */
export function dropCachedOriginals(kit) {
  const gallery = kit.gallery_image_urls || [];
  const copied = new Set(gallery.map((url) => CACHED.exec(url || "")?.[1]).filter(Boolean));
  if (!copied.size) return 0;
  const isOriginal = (url) => /^https?:\/\//i.test(url || "") && copied.has(urlHash(url));
  const originals = gallery.filter(isOriginal);
  if (!originals.length) return 0;
  kit.gallery_image_urls = gallery.filter((url) => !isOriginal(url));
  kit.images = { ...(kit.images || {}), cached_from: [...new Set([...(kit.images?.cached_from || []), ...originals])] };
  return originals.length;
}
