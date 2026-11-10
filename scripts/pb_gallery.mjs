import { readFile, writeFile } from "node:fs/promises";
import { loadRobots, robotsAllows } from "./lib/robots.mjs";

// Premium Bandai photos, counted on the Bandai CDN where an item's photos are numbered
// bandai-a.akamaihd.net/bc/img/model/<size>/<item id>_<n>.jpg:
//   * records from archived P-Bandai pages (p_bandai_wayback) had one cover
//     (2026-11: 456 records; HG Gundam Naion has 9 photos on the CDN);
//   * PB records from the BANDAI SPIRITS search had photos _1 … _10 guessed — about a
//     third did not exist, and items with more than ten lost the rest.
//
// `--fetch` (npm run pb:gallery:fetch) counts the photos of items not counted yet with
// HEAD requests on the 100 px size (galloping: 2, 4, 8 … then halving), politely: this
// bot's user-agent, the CDN's robots.txt first (lib/robots.mjs: a disallowed photo path is
// not asked, a 5xx / unreachable robots.txt skips the run), one request per 1.1 s,
// a 403 / 429 / 503 stops the run, at most
// --limit items (default 40). Counts go to data/pb-image-counts.json and are re-checked
// after 90 days (P-Bandai adds photos while an item is on sale).
//
// Without --fetch (npm run pb:gallery, an offline derive step of import:data) the
// gallery is made to match the count (missing photos added, non-existent ones dropped).

const CATALOG_PATH = "data/kits.json";
const STORE_PATH = "data/pb-image-counts.json";
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const CDN = "https://bandai-a.akamaihd.net/bc/img/model";
const GAP_MS = 1100;
const RECHECK_DAYS = 90;
const MAX_PHOTOS = 32;

const AKAMAI_RE = /bandai-a\.akamaihd\.net\/+bc\/img\/model\/(?:xl|b|m|s)\/(\d+)_\d+\.jpg/;

export const photoUrl = (id, n, size = "b") => `${CDN}/${size}/${id}_${n}.jpg`;

/**
 * The Bandai CDN item id whose photos belong to this record, or null. Records from
 * archived P-Bandai pages (one cover) and Premium Bandai records from the BANDAI SPIRITS
 * search (whose importer guesses photos _1 … _10: some do not exist, some items have more).
 */
export function pbItemId(kit) {
  const archived = kit.images?.box_art_source_id === "p_bandai_wayback";
  if (!archived && !kit.is_premium_bandai) return null;
  for (const url of [kit.images?.box_art_url, ...(kit.images?.cached_from || []), ...(kit.gallery_image_urls || [])]) {
    const m = AKAMAI_RE.exec(String(url || ""));
    if (m) return m[1];
  }
  return archived ? (/^pbandai-wb-(\d{10})$/.exec(kit.kit_id)?.[1] ?? null) : null;
}

/**
 * Makes the record's CDN photos match the count: photos past n go (they do not exist),
 * missing photos 2..n are added after the gallery. Other photos (local copies, other
 * hosts) stay in place. Returns how many records changed.
 */
export function applyCounts(kits, store) {
  let changed = 0;
  for (const kit of kits) {
    const id = pbItemId(kit);
    const n = id ? store.counts?.[id]?.n || 0 : 0;
    if (n < 1) continue;
    const gallery = kit.gallery_image_urls || [];
    const kept = gallery.filter((url) => {
      const m = /bandai-a\.akamaihd\.net\/+bc\/img\/model\/(?:xl|b|m|s)\/(\d+)_(\d+)\.jpg/.exec(String(url || ""));
      return !(m && m[1] === id && Number(m[2]) > n);
    });
    const have = new Set([...kept, ...(kit.images?.cached_from || [])]);
    const extra = [];
    for (let i = 2; i <= n; i += 1) {
      const url = photoUrl(id, i);
      if (!have.has(url)) extra.push(url);
    }
    if (!extra.length && kept.length === gallery.length) continue;
    kit.gallery_image_urls = [...kept, ...extra];
    changed += 1;
  }
  return changed;
}

/** Galloping count of consecutive photos 1..n; `exists(i)` → true / false / null (stop). */
export async function countPhotos(exists) {
  let lo = 1;
  let hi = 2;
  for (;;) {
    const e = await exists(hi);
    if (e === null) return null;
    if (!e) break;
    lo = hi;
    hi *= 2;
    if (hi > MAX_PHOTOS) return lo;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const e = await exists(mid);
    if (e === null) return null;
    if (e) lo = mid;
    else hi = mid;
  }
  return lo;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const args = process.argv.slice(2);
  const fetchCounts = args.includes("--fetch");
  const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) || 40);
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const store = JSON.parse(await readFile(STORE_PATH, "utf8").catch(() => "{}"));
  store.schema = 1;
  store.note =
    "Photo counts of Premium Bandai items on the Bandai CDN (model/<size>/<id>_<n>.jpg), for records from archived P-Bandai pages (scripts/pb_gallery.mjs).";
  store.counts ||= {};

  const robots = fetchCounts ? await loadRobots(new URL(CDN).host, { userAgent: BOT_UA }) : null;
  if (robots?.disallowAll) console.warn(`Bandai CDN robots.txt ${robots.status}; no photos counted this run.`);
  if (fetchCounts && !robots.disallowAll) {
    const today = new Date().toISOString().slice(0, 10);
    const recheckAfter = new Date(Date.now() - RECHECK_DAYS * 86400000).toISOString().slice(0, 10);
    const ids = [...new Set(catalog.kits.map(pbItemId).filter(Boolean))].filter((id) => !(store.counts[id]?.read > recheckAfter));
    let refused = "";
    let counted = 0;
    let requests = 0;
    let disallowed = 0;
    for (const id of ids.slice(0, limit)) {
      let blocked = false;
      const n = await countPhotos(async (i) => {
        // A photo path robots.txt disallows is never asked; the item stays uncounted.
        if (!robotsAllows(robots, photoUrl(id, i, "s"))) {
          blocked = true;
          return null;
        }
        await sleep(GAP_MS);
        requests += 1;
        try {
          const response = await fetch(photoUrl(id, i, "s"), { method: "HEAD", headers: { "User-Agent": BOT_UA }, signal: AbortSignal.timeout(20000) });
          if ([403, 429, 503].includes(response.status)) {
            refused = String(response.status);
            return null;
          }
          return response.ok && /^image\//.test(response.headers.get("content-type") || "");
        } catch (error) {
          console.warn(`${id}_${i}: ${error.message}`);
          return null;
        }
      });
      if (refused) break;
      if (n === null) {
        if (blocked) disallowed += 1;
        continue;
      }
      store.counts[id] = { n, read: today };
      counted += 1;
    }
    if (refused) console.warn(`Bandai CDN answered ${refused}; the rest is left for the next run.`);
    if (disallowed) console.warn(`Bandai CDN robots.txt disallows the photos of ${disallowed} items; left uncounted.`);
    console.log(`PB photos: counted ${counted} items with ${requests} requests (${ids.length} were due).`);
    store.updated_at = today;
    store.counts = Object.fromEntries(Object.entries(store.counts).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(STORE_PATH, `${JSON.stringify(store, null, 1)}\n`, "utf8");
  }

  const grown = applyCounts(catalog.kits, store);
  if (grown) await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`PB photos: ${Object.keys(store.counts).length} items counted; ${grown} records got more photos.`);
}

// Run as a script (the test imports the helpers only).
if (/(^|[\\/])pb_gallery\.mjs$/.test(process.argv[1] || "")) await main();
