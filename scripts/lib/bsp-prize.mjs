// バンプレスト景品 (bsp-prize.jp) pictures, for the prize importers.
//
// A listing tile carries a 250px thumbnail (/files_thumbnail/<path>/250w_250h.jpg); the
// item page links the full-size pictures (/files/<path>). The full-size ones answer this
// bot 403 (Cloudflare, empty body, no challenge page) on GitHub's runners since 2026-11-07
// and from a home line too (2026-11-14), and the app could not load them before that;
// Wayback's own crawler sees the same mix (2026-03: 1643 answers 200, 954 answer 403). The
// thumbnails answer 200 (2026-11-14), and the Fate and Pokémon prize covers were already
// taken from them. So records use the thumbnail, and a full-size URL is never published
// as a cover or in a gallery: the app shows its placeholder instead of a broken picture.

const FULL_SIZE = /^https?:\/\/bsp-prize\.jp\/files\//i;

/** Is this a full-size bsp-prize.jp picture (not loadable by the bot or the app)? */
export function isBspFullSize(url) {
  return FULL_SIZE.test(String(url || ""));
}

/**
 * A listing tile's cover: its thumbnail, unless the stored record already has a copy of
 * the full-size picture in the repo (three Madoka covers were copied on 2026-11-07/09
 * before the refusals); then that picture's URL, which relink_cached_images.mjs turns
 * back into the copy, so the better picture stays.
 */
export function banprestoCover(thumbnail, storedKit) {
  const copied = /^\.\/assets\//.test(storedKit?.images?.box_art_url || "");
  const copiedFrom = (storedKit?.images?.cached_from || []).find(isBspFullSize);
  return copied && copiedFrom ? copiedFrom : thumbnail || "";
}
