// Hobby Atlas: official cover images for the Atlas group cards and the channel headers.
//
// Each cover is an official image (game box art, light-novel / visual-novel cover, series
// logo, or FGO's own quest-board chapter banner) taken from:
//   - English Wikipedia: the infobox image of the work's article (official box art / logo,
//     uploaded there as non-free fair-use files). Article HTML is read from /wiki/ pages,
//     which robots.txt allows (the /w/api.php endpoint is disallowed, so it is not used).
//   - Atlas Academy static assets for the FGO chapter banners (official game assets).
//   - Product-line covers (the "종류별 도감" cards: HG / MG / ROBOT魂 / MONCOLLE / BX …): the line's
//     logo picked from the static HTML of the maker's own brand page, as listed in
//     scripts/atlas/lib/line_covers.mjs. robots.txt of every page and image host is checked first;
//     images are cropped / flattened / shrunk to <= 80 KB (Python + Pillow) and saved as
//     line-<franchise>-<code>.png|jpg.
// The image is downloaded once into app/assets/atlas/covers/ (served by GitHub Pages next to the
// catalog images) so the app never hotlinks; data/atlas/atlas-covers.json records the local
// path, the original image URL and the page it came from.
//
// Run by hand or weekly (`npm run atlas:covers`); existing files are not downloaded again
// unless --refresh is passed. The daily data refresh only reads atlas-covers.json.
import { copyFileSync, existsSync, renameSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { politeFetch, throttle, USER_AGENT } from "./lib/http.mjs";
import { LINE_COVER_SOURCES, lineFileStem, lineKind, lineSelector, OFFICIAL_LINE_HOSTS, parseRobots, pickLineImage, robotsAllows } from "./lib/line_covers.mjs";
import { ATLAS_DATA, REPO_ROOT, readJson, today, writeCompactJson } from "./lib/util.mjs";

const REFRESH = process.argv.includes("--refresh");
const OUT = path.join(ATLAS_DATA, "atlas-covers.json");
// Image paths are written like the catalog images ("./assets/…", relative to app/).
const APP_DIR = path.join(REPO_ROOT, "app");
const ASSET_DIR = path.join(APP_DIR, "assets", "atlas", "covers");
const wiki = (title) => `https://en.wikipedia.org/wiki/${title}`;

// key -> source. `wiki`: article whose infobox image is the cover. `url`: direct official image.
export const COVER_SOURCES = {
  // Channel headers (series logos / key art).
  "channel:gundam": { url: "https://gundam-official.com/assets/ogp-default.png", page: "https://gundam-official.com/", note: "GUNDAM official portal share image (logo)" },
  "channel:beyblade": { url: "https://beyblade.takaratomy.co.jp/bbx_portal.png", page: "https://beyblade.takaratomy.co.jp/", note: "BEYBLADE X official site share image (logo)" },
  "channel:pokemon": { wiki: wiki("Pok%C3%A9mon"), note: "International Pokémon logo" },
  "channel:fate": { url: "https://www.fate-go.jp/images/fate_ogp_3500.png", page: "https://www.fate-go.jp/", note: "Fate/Grand Order official site key visual (most Fate goods are FGO)" },
  "channel:armored_core": { url: "https://www.armoredcore.net/resources/images/common/ogp/ogp_image.png", page: "https://www.armoredcore.net/", note: "ARMORED CORE official site share image (AC VI logo)" },
  // Pokémon: one cover per generation = the generation's paired games.
  "pokemon:gen1": { wiki: wiki("Pok%C3%A9mon_Red_and_Blue") },
  "pokemon:gen2": { wiki: wiki("Pok%C3%A9mon_Gold_and_Silver") },
  "pokemon:gen3": { wiki: wiki("Pok%C3%A9mon_Ruby_and_Sapphire") },
  "pokemon:gen4": { wiki: wiki("Pok%C3%A9mon_Diamond_and_Pearl") },
  "pokemon:gen5": { wiki: wiki("Pok%C3%A9mon_Black_and_White") },
  "pokemon:gen6": { wiki: wiki("Pok%C3%A9mon_X_and_Y") },
  "pokemon:gen7": { wiki: wiki("Pok%C3%A9mon_Sun_and_Moon") },
  "pokemon:gen8": { wiki: wiki("Pok%C3%A9mon_Sword_and_Shield") },
  "pokemon:gen9": { wiki: wiki("Pok%C3%A9mon_Scarlet_and_Violet") },
  // Armored Core: one cover per game era (the era's first title).
  "armored_core:ac1": { wiki: wiki("Armored_Core_(video_game)") },
  "armored_core:ac2": { wiki: wiki("Armored_Core_2") },
  "armored_core:ac3": { wiki: wiki("Armored_Core_3") },
  "armored_core:ac4": { wiki: wiki("Armored_Core_4") },
  "armored_core:acv": { wiki: wiki("Armored_Core_V") },
  "armored_core:ac6": { wiki: wiki("Armored_Core_VI:_Fires_of_Rubicon") },
  // Fate works.
  "fate:fgo": { wiki: wiki("Fate/Grand_Order"), flatten: "#ffffff" },
  "fate:stay_night": { wiki: wiki("Fate/stay_night") },
  "fate:hollow_ataraxia": { wiki: wiki("Fate/hollow_ataraxia") },
  "fate:zero": { wiki: wiki("Fate/Zero") },
  "fate:apocrypha": { wiki: wiki("Fate/Apocrypha") },
  "fate:extra": { wiki: wiki("Fate/Extra") },
  "fate:prisma": { wiki: wiki("Fate/kaleid_liner_Prisma_Illya") },
  "fate:strange_fake": { wiki: wiki("Fate/strange_Fake") },
  "fate:el_melloi": { wiki: wiki("The_Case_Files_of_Lord_El-Melloi_II") },
  "fate:samurai_remnant": { wiki: wiki("Fate/Samurai_Remnant") },
  "fate:prototype": { wiki: wiki("Fate/Prototype") },
  "fate:tsukihime": { wiki: wiki("Tsukihime") },
  "fate:kara_no_kyoukai": { wiki: wiki("The_Garden_of_Sinners") },
  "fate:mahoyo": { wiki: wiki("Witch_on_the_Holy_Night") },
  "fate:type_moon": { wiki: wiki("Type-Moon"), flatten: "#ffffff" },
};

async function fateChapterSources() {
  const roster = await readJson(path.join(ATLAS_DATA, "fate-roster.json"), null);
  const out = {};
  for (const chapter of roster?.chapters || []) out[`fate:${chapter.id}`] = { url: chapter.image, page: "https://atlasacademy.io/", note: "FGO quest board banner (official game asset) via Atlas Academy" };
  return out;
}

// Same per-host clock as politeFetch, so page and image requests together stay >= 1.1 s apart.
async function fetchBinary(url) {
  await throttle(new URL(url).host);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "image/*" }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type}) for ${url}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), type };
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** First infobox image of a Wikipedia article: {image, file_page, width, height}. */
async function infoboxImage(pageUrl) {
  const res = await politeFetch(pageUrl, { ttlHours: 24 * 30, accept: "text/html" });
  const html = res.body;
  const box = html.match(/<table class="infobox[\s\S]*?<\/table>/);
  if (!box) throw new Error(`no infobox on ${pageUrl}`);
  const img = box[0].match(/<img [^>]*>/);
  if (!img) throw new Error(`no infobox image on ${pageUrl}`);
  const attr = (name) => decode(img[0].match(new RegExp(`${name}="([^"]*)"`))?.[1] || "");
  const filePage = attr("resource") || "";
  const src = attr("src");
  const srcset = attr("srcset");
  const width = Number(attr("data-file-width")) || 0;
  const height = Number(attr("data-file-height")) || 0;
  const big = srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean).pop() || src;
  const clean = (u) => `https:${u.startsWith("//") ? u : u.replace(/^https?:/, "")}`.replace(/\?.*$/, "");
  // Original file URL = thumbnail URL without /thumb/ and the size suffix.
  const thumb = clean(big);
  const original = thumb.replace("//thumb.wikimedia.org/", "//upload.wikimedia.org/").replace("/thumb/", "/").replace(/\/[^/]+$/, "");
  const isSvg = /\.svg$/i.test(original);
  const useOriginal = !isSvg && width > 0 && width <= 900 && /\/thumb\//.test(thumb);
  return { image: useOriginal ? original : thumb, original, file_page: filePage, width, height };
}

const extOf = (type, url) => {
  if (/webp/.test(type)) return "webp";
  if (/png/.test(type)) return "png";
  if (/jpe?g/.test(type)) return "jpg";
  if (/gif/.test(type)) return "gif";
  return (url.match(/\.(\w{3,4})$/)?.[1] || "img").toLowerCase();
};

// Big or transparent images are turned into an opaque JPEG (max 960 px wide) when Python with
// Pillow is available; otherwise the downloaded file is kept as is.
const OPTIMISE_ABOVE_BYTES = 350 * 1024;
const PY = String.raw`
import sys
from PIL import Image
src, dst, bg = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src)
im.load()
if im.mode in ("RGBA", "LA", "P"):
    im = im.convert("RGBA")
    base = Image.new("RGBA", im.size, bg)
    base.alpha_composite(im)
    im = base
im = im.convert("RGB")
if im.width > 960:
    im = im.resize((960, round(im.height * 960 / im.width)), Image.LANCZOS)
im.save(dst, "JPEG", quality=86, optimize=True, progressive=True)
`;
function optimise(file, bg) {
  const out = file.replace(/\.[^.]+$/, ".jpg");
  for (const py of ["python3", "python"]) {
    const res = spawnSync(py, ["-I", "-c", PY, file, `${out}.tmp`, bg], { encoding: "utf8" });
    if (res.status === 0) {
      if (out !== file) rmSync(file, { force: true });
      renameSync(`${out}.tmp`, out);
      return out;
    }
  }
  rmSync(`${out}.tmp`, { force: true });
  return file;
}

// ─────────────── Product-line covers (scripts/atlas/lib/line_covers.mjs) ───────────────

// robots.txt per origin, read once per run. 404/410 or an HTML "not found" page = no rules;
// any other failure (403, 5xx, bot challenge) = treat the whole host as off limits.
const robotsCache = new Map();
async function robotsRules(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules;
  try {
    await throttle(new URL(origin).host);
    const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT, accept: "text/plain" }, redirect: "follow" });
    const text = await res.text();
    if (res.status === 404 || res.status === 410) rules = [];
    else if (!res.ok) rules = null;
    else rules = /^\s*</.test(text) ? [] : parseRobots(text);
  } catch {
    rules = null;
  }
  robotsCache.set(origin, rules);
  return rules;
}
async function assertRobotsAllow(url) {
  const u = new URL(url);
  const rules = await robotsRules(u.origin);
  if (rules === null) throw new Error(`robots.txt of ${u.host} could not be read; skipped`);
  if (!robotsAllows(rules, `${u.pathname}${u.search}`)) throw new Error(`robots.txt of ${u.host} disallows ${u.pathname}`);
}

// Crop (optional), put transparent pixels on a solid background, cap the width at 640 px and keep
// the file small: PNG for logos (palette PNG if needed), JPEG for key visuals or when PNG is too
// big. A small JPEG that needs no change is kept byte for byte (prints KEEP).
const LINE_MAX_BYTES = 80 * 1024;
const PY_LINE = String.raw`
import json, os, sys
from PIL import Image
src, stem, crop, bg, kind, limit = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], int(sys.argv[6])
im = Image.open(src)
fmt = im.format
im.load()
if fmt == "JPEG" and not crop and im.width <= 640 and os.path.getsize(src) <= limit:
    print("KEEP")
    sys.exit(0)
if crop:
    im = im.crop(tuple(json.loads(crop)))
im = im.convert("RGBA")
base = Image.new("RGBA", im.size, bg)
base.alpha_composite(im)
im = base.convert("RGB")
if im.width > 640:
    im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
if kind == "logo" and fmt != "JPEG":
    out = stem + ".png"
    im.save(out, "PNG", optimize=True)
    if os.path.getsize(out) <= limit:
        print(out)
        sys.exit(0)
    im.quantize(256).save(out, "PNG", optimize=True)
    if os.path.getsize(out) <= limit:
        print(out)
        sys.exit(0)
    os.remove(out)
out = stem + ".jpg"
for q in (88, 82, 75, 68, 60):
    im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= limit:
        break
print(out)
`;
// First interpreter that can import Pillow (on Windows "python3" may be a Store stub).
let pillowPython;
function pythonWithPillow() {
  if (pillowPython === undefined) {
    pillowPython = ["python3", "python"].find((py) => spawnSync(py, ["-I", "-c", "import PIL"], { encoding: "utf8" }).status === 0) || null;
  }
  return pillowPython;
}

function processLine(raw, stem, source) {
  const args = [raw, stem, source.crop ? JSON.stringify(source.crop) : "", source.background || "#ffffff", lineKind(source), String(LINE_MAX_BYTES)];
  const py = pythonWithPillow();
  if (py) {
    const res = spawnSync(py, ["-I", "-c", PY_LINE, ...args], { encoding: "utf8" });
    if (res.status !== 0) throw new Error(`image processing failed: ${(res.stderr || res.error?.message || "").trim().split("\n").pop()}`);
    const said = res.stdout.trim().split("\n").pop();
    if (said === "KEEP") {
      copyFileSync(raw, `${stem}.jpg`);
      return `${stem}.jpg`;
    }
    return said;
  }
  // No Python + Pillow: only a small, uncropped PNG/JPEG may be used as downloaded.
  const ext = path.extname(raw).slice(1);
  if (source.crop || !["png", "jpg"].includes(ext) || statSync(raw).size > LINE_MAX_BYTES) throw new Error("needs Python with Pillow to crop / shrink this image");
  copyFileSync(raw, `${stem}.${ext}`);
  return `${stem}.${ext}`;
}

async function lineCover(key, source, prev) {
  const [franchise, code] = key.split(":");
  const stem = path.join(ASSET_DIR, lineFileStem(franchise, code));
  await assertRobotsAllow(source.page);
  const pageRes = await politeFetch(source.page, { ttlHours: 24 * 30, accept: "text/html", retries: 1 });
  const image = pickLineImage(pageRes.body, source.page, source);
  if (!image) throw new Error(`no matching image on ${source.page}`);
  const host = new URL(image).host;
  if (!OFFICIAL_LINE_HOSTS.has(host)) throw new Error(`picked image is on ${host}, not an official host`);
  await assertRobotsAllow(image);
  const { bytes, type } = await fetchBinary(image);
  // Work on temporary names so a failure leaves the previous cover in place.
  const raw = `${stem}.download.${extOf(type, image)}`;
  await writeFile(raw, bytes);
  let fresh;
  try {
    fresh = processLine(raw, `${stem}.new`, source);
  } finally {
    rmSync(raw, { force: true });
  }
  const file = `${stem}${path.extname(fresh)}`;
  const prevFile = prev?.image ? path.join(APP_DIR, prev.image.replace(/^\.\//, "")) : "";
  for (const old of [prevFile, `${stem}.png`, `${stem}.jpg`]) if (old && path.resolve(old) !== path.resolve(file)) rmSync(old, { force: true });
  renameSync(fresh, file);
  return {
    image: `./assets/atlas/covers/${path.basename(file)}`,
    image_remote: image,
    source_page: source.page,
    kind: lineKind(source),
    selector: lineSelector(source),
    note: source.note,
    bytes: statSync(file).size,
  };
}

async function main() {
  const previous = (await readJson(OUT, null))?.covers || {};
  const sources = { ...COVER_SOURCES, ...(await fateChapterSources()) };
  await mkdir(ASSET_DIR, { recursive: true });
  const covers = {};
  const failures = [];
  for (const [key, source] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
    const base = key.replace(":", "-").replace(/[^a-z0-9_-]/gi, "_");
    const prev = previous[key];
    const sourceUrl = source.wiki || source.url;
    const prevFile = prev ? path.join(APP_DIR, prev.image.replace(/^\.\//, "")) : "";
    try {
      if (prev && !REFRESH && prev.source_page === (source.wiki || source.page) && (source.wiki || prev.image_remote === source.url) && existsSync(prevFile)) {
        covers[key] = prev;
        continue;
      }
      const found = source.wiki ? await infoboxImage(source.wiki) : { image: source.url, file_page: "" };
      const { bytes, type } = await fetchBinary(found.image);
      let file = path.join(ASSET_DIR, `${base}.${extOf(type, found.image)}`);
      await writeFile(file, bytes);
      if (source.flatten || bytes.length > OPTIMISE_ABOVE_BYTES) file = optimise(file, source.flatten || "#ffffff");
      if (prevFile && path.resolve(prevFile) !== path.resolve(file)) rmSync(prevFile, { force: true });
      const size = statSync(file).size;
      covers[key] = {
        image: `./assets/atlas/covers/${path.basename(file)}`,
        image_remote: found.image,
        source_page: source.wiki || source.page,
        file_page: found.file_page || undefined,
        note: source.note,
        bytes: size,
      };
      console.log(`${key}: ${path.basename(file)} (${size} bytes) <- ${found.image} [${sourceUrl}]`);
    } catch (error) {
      failures.push(`${key}: ${error.message || error}`);
      if (prev) covers[key] = prev;
    }
  }
  for (const [lineKey, source] of Object.entries(LINE_COVER_SOURCES).sort(([a], [b]) => a.localeCompare(b))) {
    const key = `line:${lineKey}`;
    const prev = previous[key];
    const prevFile = prev?.image ? path.join(APP_DIR, prev.image.replace(/^\.\//, "")) : "";
    try {
      if (prev && !REFRESH && prev.source_page === source.page && prev.selector === lineSelector(source) && prev.kind === lineKind(source) && existsSync(prevFile)) {
        covers[key] = prev;
        continue;
      }
      covers[key] = await lineCover(lineKey, source, prev);
      console.log(`${key}: ${path.basename(covers[key].image)} (${covers[key].bytes} bytes) <- ${covers[key].image_remote} [${source.page}]`);
    } catch (error) {
      failures.push(`${key}: ${error.message || error}`);
      if (prev && existsSync(prevFile)) covers[key] = prev;
    }
  }
  const out = {
    updated_at: today(),
    note: "Official cover images for Atlas group cards, channel headers and product lines (keys line:<franchise>:<code>). image = copy in this repo; image_remote = where it was downloaded from; source_page = the page that shows it as the official cover/logo.",
    covers,
  };
  const res = await writeCompactJson(OUT, out);
  console.log(`atlas covers: ${Object.keys(covers).length} -> ${res.written ? "written" : "unchanged"}`);
  if (failures.length) {
    console.warn(`failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = Object.keys(covers).length ? 0 : 1;
  }
}

await main();
