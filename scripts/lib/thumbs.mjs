// Small cover thumbnails for the app's tiles (scripts/build_thumbs.mjs makes them,
// scripts/publish_site.mjs publishes data/thumbs.json that maps an image URL to its thumbnail).
//
// Why (measured 2026-11-14 from Korea): the image hosts answer in 0.1–0.4 s, but the app draws
// 52–150 dp tiles from 560–2400 px originals (a 60-tile screen decodes 80–140 MB) and most feed
// covers sit on bandai-a.akamaihd.net with max-age=300 and no ETag, so they are downloaded again
// every few minutes. A 400 px WebP is 9–14 KB and lives on the image shards (ETag, stable names).
//
// Layout under app/assets/thumbs/ (published to the image shards, not the site):
//   repo/<dir>/<file>.webp   one per photo in app/assets/<dir> (made in the publish job, not committed)
//   web/<host>/<sha1(url) 16>-<sha1(webp) 8>.webp   remote covers (fetched daily by .github/workflows/thumbs.yml,
//                            committed); the ones copied before 2026-11-14 have no "-<sha1(webp) 8>"

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

export const THUMB_ROOT = "app/assets/thumbs";
export const REPO_THUMB_INDEX = `${THUMB_ROOT}/repo/index.json`;
export const WEB_THUMB_INDEX = `${THUMB_ROOT}/web/index.json`;
export const THUMB_MAX_SIDE = 400;
export const THUMB_QUALITY = 72;
// Changes whenever the Pillow recipe below changes, so --repo makes every thumbnail again.
export const THUMB_RECIPE = "webp-400-q72-srgb";
// Photos in these app/assets folders get a thumbnail. announcements is published with the site
// (../app/assets/announcements/… in announcements.json); its thumbnails still go to the shards.
export const REPO_SOURCE_DIRS = ["catalog", "kotobukiya-ac", "bbx", "announcements"];
export const SITE_BASE = "https://mdefitko777.github.io/Gunpula/";
// Hosts with their own thumbnails: no copy needed. Rebrickable: 250x250p is the size its own set
// lists use (2026-11-14: 104 KB for 31209-1, whose original is 4.25 MB / 2048x2160).
// 반다이남코코리아몰's CDN resizes any goods picture itself (2026-11-14: ?resize=400&format=webp
// gives a 400 px WebP of the 2176x1440 /big/ photo).
export const THUMB_RULES = [
  { prefix: "https://cdn.rebrickable.com/media/sets/", thumb_prefix: "https://cdn.rebrickable.com/media/thumbs/sets/", thumb_suffix: "/250x250p.jpg" },
  { prefix: "https://cdn.bnkrmall.co.kr/live/data/base/goods/", thumb_prefix: "https://cdn.bnkrmall.co.kr/live/data/base/goods/", thumb_suffix: "?resize=400&format=webp" },
];

const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp)$/i;

export function repoThumbRel(rel) {
  return `thumbs/repo/${rel}.webp`;
}

// With the thumbnail's bytes, the name also carries their hash. The app keeps a picture for 30
// days without asking again (hobby-atlas-v3 NetImageFiles.keepFor), so a thumbnail made again for
// the same cover needs a new name: on 2026-11-14 twenty web thumbnails showed another host's
// picture (BEYBLADE X UX-22 showed LEGO Yoshi, build_thumbs.mjs fetchHost), and a fix under the
// old name would have stayed on the phones for a month.
export function webThumbFile(url, thumbBytes = null) {
  const name = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const content = thumbBytes ? `-${createHash("sha1").update(thumbBytes).digest("hex").slice(0, 8)}` : "";
  return `${new URL(url).host}/${name}${content}.webp`;
}

/**
 * [{ url, digest }] → the urls whose thumbnail bytes (digest) equal a cover's on another host.
 * One host reuses a maker photo on two product pages (9 such groups on 2026-11-14), so those are
 * left alone. Two hosts can share one too (a maker's photo on its shop and its CDN), so this only
 * reads the thumbnails made before the fetchHost fix (build_thumbs.mjs --plan / --purge-twins).
 */
export function crossHostTwins(entries) {
  const hostsByDigest = new Map();
  for (const { url, digest } of entries) {
    if (!digest) continue;
    if (!hostsByDigest.has(digest)) hostsByDigest.set(digest, new Set());
    hostsByDigest.get(digest).add(new URL(url).host);
  }
  return new Set(entries.filter(({ digest }) => digest && hostsByDigest.get(digest).size > 1).map(({ url }) => url));
}

export function ruleThumb(url, rules = THUMB_RULES) {
  const rule = rules.find((entry) => url.startsWith(entry.prefix));
  return rule ? `${rule.thumb_prefix}${url.slice(rule.prefix.length)}${rule.thumb_suffix}` : null;
}

// Android refuses cleartext (no usesCleartextTraffic in the app), so an http:// image never
// shows; the hosts seen in the data (image.toast.com, images.goodsmile.info) serve the same
// files over https (checked 2026-11-14).
export function httpsImageUrl(url) {
  return typeof url === "string" && /^http:\/\//i.test(url) ? `https://${url.slice(7)}` : url;
}

// Upgrades every quoted http:// image URL in a JSON text; links to pages stay as they are.
export function upgradeCleartextImages(text) {
  let upgraded = 0;
  const out = text.replace(/"http:\/\/([^"\\\s]+?\.(?:jpe?g|png|gif|webp)(?:\?[^"\\\s]*)?)"/gi, (whole, rest) => {
    upgraded += 1;
    return `"https://${rest}"`;
  });
  return { text: out, upgraded };
}

// Same as the app's deadImage (hobby-atlas-v3 lib/data/gunpula.dart): never shown, never fetched.
export function deadImage(url) {
  return ["internal-pbn", "Expires=", "bandai-hobby.net", "pokemon.hgodo.com"].some((part) => url.includes(part));
}

// The tile image the app picks for a kit (pickCover in lib/data/gunpula.dart): Gundam box art
// unless it is only a "maybe", else box_art_url, else the first gallery photo.
export function coverOf(kit, boxart) {
  const box = kit.images?.box_art_url || "";
  const gallery = kit.gallery_image_urls || [];
  const art = boxart?.[kit.kit_id];
  if (art?.url && art.kind !== "maybe" && !deadImage(art.url)) return art.url;
  if (box && !deadImage(box)) return box;
  return gallery[0] || "";
}

// A remote cover worth a copy: https (after the upgrade), a picture, not one of ours, not
// covered by a rule.
export function wantsWebThumb(url) {
  if (!/^https?:\/\//i.test(url || "") || deadImage(url)) return false;
  const secure = httpsImageUrl(url);
  const parsed = new URL(secure);
  // An http:// URL stays http:// in the published JSON unless it looks like a picture
  // (upgradeCleartextImages), so a thumbnail keyed by its https form would never be looked up.
  if (secure !== url && !IMAGE_EXT.test(parsed.pathname)) return false;
  if (parsed.host.endsWith(".github.io") || parsed.host === "raw.githubusercontent.com") return false;
  if (ruleThumb(secure)) return false;
  return IMAGE_EXT.test(parsed.pathname) || /\/(?:img|image|images|media|uploads?)\//i.test(parsed.pathname);
}

// Every kit_id mentioned anywhere in a feed document.
export function feedKitIds(doc, ids = new Set()) {
  if (Array.isArray(doc)) for (const item of doc) feedKitIds(item, ids);
  else if (doc && typeof doc === "object") {
    if (typeof doc.kit_id === "string") ids.add(doc.kit_id);
    for (const value of Object.values(doc)) if (value && typeof value === "object") feedKitIds(value, ids);
  }
  return ids;
}

const DAY = 24 * 60 * 60 * 1000;

// Remote images to copy, most visible first: announcement tiles and the notify / update feeds,
// then kits new in the last 30 days or released from 30 days ago to 120 days ahead (the home
// rows), then restocks, then the rest of the catalog newest first.
export function thumbCandidates({ kits, boxart = {}, firstSeen = {}, feedIds = new Set(), restockIds = new Set(), announcements = [], today = new Date() }) {
  const now = today.getTime();
  const daysFrom = (value) => {
    const time = Date.parse(String(value || "").length === 7 ? `${value}-15` : value || "");
    return Number.isNaN(time) ? null : (time - now) / DAY;
  };
  const scored = [];
  announcements.forEach((item, index) => scored.push({ url: item.thumbnail_url, tier: 0, order: index }));
  for (const kit of kits) {
    const url = coverOf(kit, boxart);
    const seen = daysFrom(firstSeen[kit.kit_id]);
    const release = daysFrom(kit.release_date);
    let tier = 3;
    if (feedIds.has(kit.kit_id)) tier = 0;
    else if ((seen !== null && seen >= -30) || (release !== null && release >= -30 && release <= 120)) tier = 1;
    else if (restockIds.has(kit.kit_id)) tier = 2;
    scored.push({ url, tier, order: -(seen ?? -1e6) });
  }
  scored.sort((a, b) => a.tier - b.tier || a.order - b.order);
  const out = [];
  const seenUrls = new Set();
  for (const { url } of scored) {
    if (!wantsWebThumb(url)) continue;
    const secure = httpsImageUrl(url);
    if (seenUrls.has(secure)) continue;
    seenUrls.add(secure);
    out.push(secure);
  }
  return out;
}

// data/thumbs.json as published. repoIndex: { "<dir>/<file>": sha } (thumbs made in this job),
// webIndex: { "<remote url>": "<host>/<file>.webp" }. urlForAsset(rel under app/assets) gives
// the published URL of a shard file, or null when no live shard holds it; a thumbnail without
// one is left out, so the map never points at raw.githubusercontent.com.
// No generated_at: the manifest hashes this file and the app downloads it again when the hash
// changes, and a timestamp would change it on every publish (about 20 a day) for nothing.
export function buildThumbMap({ repoIndex = {}, webIndex = {}, originalUrl, thumbUrl }) {
  const thumbs = {};
  for (const rel of Object.keys(repoIndex).sort()) {
    const original = originalUrl(rel);
    const thumb = thumbUrl(repoThumbRel(rel));
    if (original && thumb) thumbs[original] = thumb;
  }
  for (const url of Object.keys(webIndex).sort()) {
    const thumb = thumbUrl(`thumbs/web/${webIndex[url]}`);
    if (thumb) thumbs[url] = thumb;
  }
  return { schema: "gunpula-thumbs-v1", max_side: THUMB_MAX_SIDE, rules: THUMB_RULES, thumbs };
}

// The small picture for an image URL as published: its data/thumbs.json entry, else a host rule.
// Never the URL itself (full size) and never raw.githubusercontent.com (a file no shard holds yet).
export function smallImageOf(url, map) {
  if (!url) return null;
  const thumb = map.thumbs?.[url] || ruleThumb(url, map.rules || THUMB_RULES);
  return thumb && thumb !== url && !thumb.includes("raw.githubusercontent.com") ? thumb : null;
}

// The feeds the app's inbox reads (hobby-atlas-v3 lib/notifications/feed_rules.dart: added[] and
// changed[] of each entry). Their published copies carry "thumb" per item: the app prefetches new
// items' pictures (lib/background/image_prefetch.dart) before its cached catalog has those kits, and
// the feeds have no image URLs. The repo copies stay without it: shard URLs are only known at publish
// time, and the notify feed would otherwise change whenever a photo moves shard.
export const FEED_THUMB_FILES = ["atlas/notify-feed.json", "update-feed-lite.json"];
const FEED_THUMB_LISTS = ["added", "changed"];

// Sets item.thumb on every added / changed item whose kit has a small cover. kitsById and boxart
// must be the published (path-rewritten) data, so coverOf gives the URL the app loads.
export function addFeedThumbs(doc, { kitsById, boxart = {}, aliases = {}, map }) {
  let items = 0;
  let withThumb = 0;
  for (const entry of doc?.entries || []) {
    for (const list of FEED_THUMB_LISTS) {
      for (const item of entry?.[list] || []) {
        if (!item || typeof item.kit_id !== "string") continue;
        items += 1;
        const kit = kitsById.get(item.kit_id) || kitsById.get(aliases[item.kit_id]);
        const thumb = kit ? smallImageOf(coverOf(kit, boxart), map) : null;
        if (thumb) {
          item.thumb = thumb;
          withThumb += 1;
        } else delete item.thumb;
      }
    }
  }
  return { items, withThumb };
}

// Pillow (the same Python the atlas cover step uses; no npm image library is installed).
// One process per batch: reads {"src","dst"} lines, writes {"dst","ok"|"error"} lines in the same
// order. Threads, because Pillow lets go of the GIL while decoding, resizing and encoding.
// Colour: a WebP without a profile is shown as sRGB, so photos tagged with another profile are
// converted (2026-11-14: 82 Adobe RGB, 1 Display P3, 1 Japan Color CMYK and a few monitor
// profiles among the 7,497 repo photos; copied as they were, the tiles looked washed out).
const PY_THUMBS = String.raw`
import io, json, os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageCms, ImageOps
side, quality = int(sys.argv[1]), int(sys.argv[2])
SRGB = ImageCms.createProfile("sRGB")

def to_srgb(im, icc, mode):
    try:
        profile = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        if "sRGB" in ImageCms.getProfileDescription(profile):
            return im
        return ImageCms.profileToProfile(im, profile, SRGB, outputMode=mode)
    except Exception:
        return im

def make(job):
    tmp = job["dst"] + ".tmp"
    try:
        im = Image.open(job["src"])
        # JPEG: decode straight at 1/2..1/8 scale (big box art is 2000+ px), never below side.
        im.draft("RGB", (side, side))
        im = ImageOps.exif_transpose(im)
        icc = im.info.get("icc_profile")
        alpha = "A" in im.getbands() or "transparency" in im.info
        mode = "RGBA" if alpha else "RGB"
        if im.mode not in (mode, "CMYK"):
            im = im.convert(mode)
        im.thumbnail((side, side), Image.LANCZOS)
        if icc and im.mode in ("RGB", "RGBA", "CMYK"):
            im = to_srgb(im, icc, mode)
        if im.mode != mode:
            im = im.convert(mode)
        os.makedirs(os.path.dirname(job["dst"]), exist_ok=True)
        im.save(tmp, "WEBP", quality=quality, method=4)
        os.replace(tmp, job["dst"])
        return {"dst": job["dst"], "ok": True, "width": im.width, "height": im.height}
    except Exception as error:
        if os.path.exists(tmp):
            os.remove(tmp)
        return {"dst": job["dst"], "error": str(error)[:200]}

jobs = [json.loads(line) for line in sys.stdin if line.strip()]
with ThreadPoolExecutor(max_workers=min(8, os.cpu_count() or 2)) as pool:
    for result in pool.map(make, jobs):
        print(json.dumps(result), flush=True)
`;

// First interpreter whose Pillow writes WebP and has LittleCMS (on Windows "python3" may be a
// Store stub; importing WebPImagePlugin alone succeeds even without libwebp).
const PY_CHECK = "from PIL import ImageCms, features; assert features.check('webp')";
let pillowPython;
export function pythonWithPillow() {
  if (pillowPython === undefined) {
    pillowPython = ["python3", "python"].find((py) => spawnSync(py, ["-I", "-c", PY_CHECK], { encoding: "utf8" }).status === 0) || null;
  }
  return pillowPython;
}

export function makeThumbs(jobs, { side = THUMB_MAX_SIDE, quality = THUMB_QUALITY } = {}) {
  if (!jobs.length) return [];
  const py = pythonWithPillow();
  if (!py) throw new Error("Python with Pillow (WebP, LittleCMS) is needed: pip install pillow");
  const input = jobs.map((job) => JSON.stringify(job)).join("\n");
  const res = spawnSync(py, ["-I", "-c", PY_THUMBS, String(side), String(quality)], { input: `${input}\n`, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`thumbnail batch failed: ${(res.stderr || res.error?.message || "").trim().split("\n").pop()}`);
  return res.stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
