// Hobby Atlas: official cover images for the Atlas group cards and the channel headers.
//
// Each cover is an official image: the work's title logo where one could be reached (owner's
// decision 2026-11-19: the 세대 / 종류 screens show logos, box art only where no logo exists),
// otherwise game box art, a light-novel / visual-novel cover, or FGO's own quest-board chapter
// banner. Sources:
//   - The title logo picked from the static HTML of the work's official site (`page` + `img` / `og`,
//     same picking rules as the product lines). Tried first for every logo.
//   - English / Japanese Wikipedia: the infobox image of the work's article (official logo or box
//     art, uploaded there as non-free fair-use files; SVG logos come as Wikimedia PNG renderings).
//     A logo is taken from here only when the official site has none we may read as a raster image,
//     and the entry's note says what the official site had. Article HTML is read from /wiki/ pages,
//     which robots.txt allows (the /w/api.php endpoint is disallowed, so it is not used).
//   - Atlas Academy static assets for the FGO chapter banners (official game assets).
//   - Product-line covers (the "종류별 도감" cards: HG / MG / ROBOT魂 / MONCOLLE / BX …): the line's
//     logo picked from the static HTML of the maker's own brand page, as listed in
//     scripts/atlas/lib/line_covers.mjs. robots.txt of every page and image host is checked first.
// Logos are cropped (only where a source says so) and shrunk to <= 640 px wide / 80 KB with Python +
// Pillow, keeping their transparency and their own wide shape; they are saved as PNG.
// The image is downloaded once into app/assets/atlas/covers/ (served by GitHub Pages next to the
// catalog images) so the app never hotlinks; data/atlas/atlas-covers.json records the local
// path, the original image URL, the page it came from, the kind (logo or picture) and the size.
//
// Every run also gives each cover its tile colours `bg` / `fg` / `bg_from` from the cached file
// (lib/cover_colors.mjs, hand-picked ones in data/atlas/brand-colors.json); `--colors-only` does
// just that, without any network.
// Run by hand or weekly (`npm run atlas:covers`); existing files are not downloaded again
// unless --refresh (everything) or --refresh=<key prefix> (e.g. --refresh=line:) is passed.
// The daily data refresh only reads atlas-covers.json.
import { copyFileSync, existsSync, renameSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { coverFileColors } from "./lib/cover_colors.mjs";
import { politeFetch, throttle, USER_AGENT } from "./lib/http.mjs";
import { isAllowedLineHost, LINE_COVER_SOURCES, lineFileStem, lineKind, lineSelector, parseRobots, pickLineImage, robotsAllows } from "./lib/line_covers.mjs";
import { ATLAS_DATA, REPO_ROOT, readJson, today, writeCompactJson } from "./lib/util.mjs";

const REFRESH_ARG = process.argv.find((a) => a === "--refresh" || a.startsWith("--refresh="));
const refreshes = (key) => Boolean(REFRESH_ARG) && (REFRESH_ARG === "--refresh" || key.startsWith(REFRESH_ARG.slice(10)));
const COLORS_ONLY = process.argv.includes("--colors-only");
const OUT = path.join(ATLAS_DATA, "atlas-covers.json");
const BRAND_COLORS = path.join(ATLAS_DATA, "brand-colors.json");
// Image paths are written like the catalog images ("./assets/…", relative to app/).
const APP_DIR = path.join(REPO_ROOT, "app");
const ASSET_DIR = path.join(APP_DIR, "assets", "atlas", "covers");
const wiki = (title) => `https://en.wikipedia.org/wiki/${title}`;
const LOGO = "logo";
const POKEMON_JP = "https://www.pokemon.co.jp";

// Why a logo comes from Wikipedia although the work has an official site (checked 2026-11-19).
const POKEMON_LOGO_NOTE = "International Pokémon logo; pokemon.co.jp keeps its logo under /img/, which its robots.txt disallows";
const LEGO_COM_NOTE = "lego.com theme pages load their logos from assets.lego.com, whose robots.txt answers 403";

// key -> source. `wiki`: article whose infobox image is the cover. `url`: direct official image.
// `page` + `img` | `og`: image picked from an official page (see line_covers.mjs).
// `kind: "logo"` marks a title logo (kept transparent, shown as a logo by the app); anything else
// is a picture (box art, key visual, banner).
export const COVER_SOURCES = {
  // Channel headers (series logos / key art).
  "channel:gundam": { url: "https://gundam-official.com/assets/ogp-default.png", page: "https://gundam-official.com/", note: "GUNDAM official portal share image (logo)" },
  "channel:beyblade": { url: "https://beyblade.takaratomy.co.jp/bbx_portal.png", page: "https://beyblade.takaratomy.co.jp/", note: "BEYBLADE X official site share image (logo)" },
  "channel:pokemon": { wiki: wiki("Pok%C3%A9mon"), kind: LOGO, note: POKEMON_LOGO_NOTE },
  "channel:fate": { url: "https://www.fate-go.jp/images/fate_ogp_3500.png", page: "https://www.fate-go.jp/", note: "Fate/Grand Order official site key visual (most Fate goods are FGO)" },
  "channel:nintendo": { url: "https://www.nintendo.co.kr/sns.png", page: "https://www.nintendo.co.kr/", note: "Nintendo Korea official site share image (logo)" },
  // Most of the channel is 魂EFFECT; Good Smile has no share image for its effect lines.
  "channel:effects": { url: "https://tamashiiweb.com/storage/images/brands/imported/og_tamashii_effect.jpg", page: "https://tamashiiweb.com/item_brand/tamashii_effect/", note: "Tamashii Web 魂EFFECT brand page share image" },
  "channel:armored_core": { url: "https://www.armoredcore.net/resources/images/common/ogp/ogp_image.png", page: "https://www.armoredcore.net/", note: "ARMORED CORE official site share image (AC VI logo)" },
  // A share banner ("PORTAL SITE" on white), so a picture, not a title logo: the portal's own logo
  // is SVG only, its PNG logos are of Magia Exedra and ワルプルギスの廻天, and Wikipedia's infobox is a
  // Blu-ray cover (checked 2026-11-19).
  "channel:madoka": { page: "https://www.madoka-magica.com/", og: true, note: "まどか☆マギカ portal share image (no raster title logo on the official site)" },
  "channel:lego": { wiki: wiki("Lego"), kind: LOGO, note: `LEGO logo; ${LEGO_COM_NOTE}` },
  // Pokémon: one cover per generation = the generation's paired games. Title logos from the
  // games' official sites where the site still has one; gen 1–4 pages show only key art, so
  // those keep the box art of Wikipedia's infobox.
  "pokemon:gen1": { wiki: wiki("Pok%C3%A9mon_Red_and_Blue") },
  "pokemon:gen2": { wiki: wiki("Pok%C3%A9mon_Gold_and_Silver") },
  "pokemon:gen3": { wiki: wiki("Pok%C3%A9mon_Ruby_and_Sapphire") },
  "pokemon:gen4": { wiki: wiki("Pok%C3%A9mon_Diamond_and_Pearl") },
  // gen 5: the B/W site's logo.gif is disallowed by pokemon.co.jp's robots.txt (checked 2026-11-19).
  "pokemon:gen5": { wiki: wiki("Pok%C3%A9mon_Black_and_White") },
  "pokemon:gen6": { page: `${POKEMON_JP}/ex/xy/`, img: { src: "images/logo_xy.png" }, kind: LOGO },
  // Sun / Moon and Scarlet / Violet have one logo per title on their sites: both, side by side.
  "pokemon:gen7": { page: `${POKEMON_JP}/ex/sun_moon/`, img: { src: "shared/logo-sun.png" }, join: { src: "shared/logo-moon.png" }, kind: LOGO, note: "サン and ムーン logos side by side" },
  "pokemon:gen8": { page: `${POKEMON_JP}/ex/sword_shield/`, img: { alt: "ポケットモンスター ソード ポケットモンスター シールド" }, kind: LOGO },
  "pokemon:gen9": { page: `${POKEMON_JP}/ex/sv/ja/`, img: { src: "toppage/ja/title_scarlet.png" }, join: { src: "toppage/ja/title_violet.png" }, kind: LOGO, note: "スカーレット and バイオレット logos side by side" },
  // Armored Core: one cover per game era (the era's first title). Only AC VI has a logo on an
  // official site; the older eras keep their box art.
  "armored_core:ac1": { wiki: wiki("Armored_Core_(video_game)") },
  "armored_core:ac2": { wiki: wiki("Armored_Core_2") },
  "armored_core:ac3": { wiki: wiki("Armored_Core_3") },
  "armored_core:ac4": { wiki: wiki("Armored_Core_4") },
  "armored_core:acv": { wiki: wiki("Armored_Core_V") },
  "armored_core:ac6": { page: "https://www.armoredcore.net/", img: { src: "menu/ac-logo2.png" }, kind: LOGO, background: "#16181d", note: "ARMORED CORE VI logo of the official site menu (white)" },
  "armored_core:series": { wiki: wiki("Armored_Core"), kind: LOGO, note: "ARMORED CORE series logo; armoredcore.net shows only the AC VI logo" },
  // Fate works: title logos of the official anime / game sites; the works whose sites are gone
  // or refuse bots keep the light-novel / visual-novel cover.
  "fate:fgo": { page: "https://www.fate-go.jp/", img: { src: "top/main/slide01/logo.png" }, kind: LOGO },
  // The original visual novel's logo for the whole work: fate-sn.com is the Heaven's Feel films'
  // site, and the REMASTERED logo sits on cache.typemoon.com, whose robots.txt cannot be read.
  "fate:stay_night": { page: "http://www.fate-sn.jp/", img: { src: "images/top/logo.png" }, crop: [112, 0, 413, 249], kind: LOGO, background: "#16181d", note: "Fate/stay night [Réalta Nua] logo (white)" },
  "fate:hollow_ataraxia": { wiki: wiki("Fate/hollow_ataraxia") },
  "fate:zero": { wiki: wiki("Fate/Zero") },
  "fate:apocrypha": { page: "https://fate-apocrypha.com/", img: { src: "assets/img/top/logo.png" }, kind: LOGO },
  "fate:extra": { wiki: wiki("Fate/Extra") },
  // anime.prisma-illya.jp opens the FINALE page; the series title is cut out of its logo, without
  // the FINALE line (the Prisma☆Phantasm logo named one short film, not the series).
  "fate:prisma": { page: "https://anime.prisma-illya.jp/finale/", img: { src: "img/common/logo.png" }, crop: [0, 0, 1131, 177], kind: LOGO, note: "Fate/kaleid liner プリズマ☆イリヤ title of the series site's logo" },
  "fate:strange_fake": { wiki: wiki("Fate/strange_Fake") },
  "fate:el_melloi": { wiki: wiki("The_Case_Files_of_Lord_El-Melloi_II") },
  "fate:samurai_remnant": { page: "https://www.gamecity.ne.jp/fate-sr/", img: { alt: "Fate/Samurai Remnant" }, kind: LOGO },
  "fate:prototype": { wiki: wiki("Fate/Prototype") },
  "fate:tsukihime": { wiki: wiki("Tsukihime") },
  "fate:kara_no_kyoukai": { page: "https://www.karanokyoukai.com/", img: { src: "img/logo_main.png" }, kind: LOGO, background: "#16181d", note: "劇場版 空の境界 logo (white)" },
  "fate:mahoyo": { page: "https://mahoyo-movie.com/", img: { src: "kv/logo_ttl.png" }, kind: LOGO, background: "#16181d", note: "劇場版 魔法使いの夜 logo (white)" },
  "fate:type_moon": { wiki: wiki("Type-Moon"), kind: LOGO, note: "TYPE-MOON logo; typemoon.com shows it only as a 26 px header mark" },
  // Nintendo worlds: series logos from Wikipedia's infobox. What the official sites had
  // (2026-11-19): robots.txt of mario.nintendo.com, zelda.com and animal-crossing.com answers 403;
  // nintendo.com/jp/character/mario/ and kirby.jp show only their portal marks; pikmin.nintendo.com
  // has its logo as SVG only; metroid.nintendo.com, smashbros.com and nintendo.co.jp/fe/ have only a
  // share image; splatoon.nintendo.com is a script-only page; no Nintendo site for Xenoblade, Yoshi
  // or Donkey Kong was found.
  "nintendo:mario": { wiki: wiki("Super_Mario"), kind: LOGO, note: "series logo; Nintendo's Mario pages show only the MARIO PORTAL mark" },
  "nintendo:kirby": { wiki: wiki("Kirby_(series)"), kind: LOGO, note: "series logo; kirby.jp shows only its 星のカービィポータル mark" },
  "nintendo:zelda": { wiki: wiki("The_Legend_of_Zelda"), kind: LOGO, note: "series logo; zelda.com's robots.txt answers 403" },
  "nintendo:splatoon": { wiki: wiki("Splatoon"), kind: LOGO, note: "series logo; splatoon.nintendo.com has no static HTML" },
  "nintendo:fire_emblem": { wiki: wiki("Fire_Emblem"), kind: LOGO, note: "series logo; nintendo.co.jp/fe/ has only a share image" },
  "nintendo:pokemon": { wiki: wiki("Pok%C3%A9mon"), kind: LOGO, note: POKEMON_LOGO_NOTE },
  "nintendo:animal_crossing": { wiki: wiki("Animal_Crossing"), kind: LOGO, note: "series logo; animal-crossing.com's robots.txt answers 403" },
  "nintendo:xenoblade": { wiki: wiki("Xenoblade_Chronicles"), kind: LOGO, note: "series logo; no series site of Nintendo's found" },
  "nintendo:pikmin": { wiki: wiki("Pikmin"), kind: LOGO, note: "series logo; pikmin.nintendo.com has it as SVG only" },
  "nintendo:metroid": { wiki: wiki("Metroid"), kind: LOGO, note: "series logo; metroid.nintendo.com has only a share image" },
  "nintendo:smash": { wiki: wiki("Super_Smash_Bros."), kind: LOGO, note: "series logo; smashbros.com has only a share image" },
  "nintendo:yoshi": { wiki: wiki("Yoshi_(franchise)"), kind: LOGO, note: "series logo; no series site of Nintendo's found" },
  "nintendo:donkey_kong": { wiki: wiki("Donkey_Kong"), kind: LOGO, note: "series logo; no series site of Nintendo's found" },
  // LEGO themes (key = the group id without "lego_"): theme logos from Wikipedia's infobox. The
  // current themes' lego.com pages show a logo, but it is on assets.lego.com, whose robots.txt
  // answers 403 (and most are SVG); retired themes have no lego.com page. Themes without a logo on
  // Wikipedia keep the newest set picture.
  ...Object.fromEntries(
    Object.entries({
      duplo: "Lego_Duplo",
      star_wars: "Lego_Star_Wars",
      city: "Lego_City",
      collectible_minifigures: "Lego_Minifigures_(theme)",
      friends: "Lego_Friends",
      ninjago: "Lego_Ninjago",
      creator: "Lego_Creator",
      technic: "Lego_Technic",
      bionicle: "Bionicle",
      disney: "Lego_Disney",
      castle: "Lego_Castle",
      harry_potter: "Lego_Harry_Potter",
      minecraft: "Lego_Minecraft",
      brickheadz: "Lego_BrickHeadz",
      super_mario: "Lego_Super_Mario",
      legends_of_chima: "Legends_of_Chima",
      mixels: "Mixels",
      hero_factory: "Hero_Factory",
      nexo_knights: "Nexo_Knights",
      lego_ideas_and_cuusoo: "Lego_Ideas",
      fabuland: "Fabuland",
      speed_champions: "Lego_Speed_Champions",
      pirates: "Lego_Pirates",
      architecture: "Lego_Architecture",
      atlantis: "Lego_Atlantis",
      alpha_team: "Lego_Alpha_Team",
      lego_art: "Lego_Art",
      vidiyo: "Lego_Vidiyo",
      rock_raiders: "Lego_Rock_Raiders",
      juniors: "Lego_Juniors",
      adventurers: "Lego_Adventurers",
      monkie_kid: "Lego_Monkie_Kid",
      dreamzzz: "Lego_Dreamzzz",
      elves: "Lego_Elves",
      exo_force: "Exo-Force",
      power_miners: "Lego_Power_Miners",
      super_heroes_marvel: "Lego_Marvel",
    }).map(([id, article]) => [`lego:${id}`, { wiki: wiki(article), kind: LOGO, note: `theme logo; ${LEGO_COM_NOTE}` }]),
  ),
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

// Big or transparent pictures (box art, key visuals) are turned into an opaque JPEG (max 960 px
// wide) when Python with Pillow is available; otherwise the downloaded file is kept as is.
// Logos go through processLogo instead and keep their transparency.
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

// ─────────────── Picked images: product lines (line_covers.mjs) and title logos ───────────────

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

// Join (optional: a second logo set to the right, both at their own size), crop (optional) and
// cap the width at 640 px. A logo stays transparent and is saved as PNG
// (palette PNG if needed); only a white logo gets the `background` colour behind it. Key visuals,
// and logos still too big as PNG, become JPEG on the background (white by default). A small
// JPEG that needs no change is kept byte for byte. Prints "<file> <width> <height>".
const LINE_MAX_BYTES = 80 * 1024;
const PY_LINE = String.raw`
import json, os, sys
from PIL import Image
src, stem, crop, bg, kind, limit, join = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], int(sys.argv[6]), sys.argv[7]
im = Image.open(src)
fmt = im.format
im.load()
if fmt == "JPEG" and not crop and not join and im.width <= 640 and os.path.getsize(src) <= limit:
    print("KEEP", im.width, im.height)
    sys.exit(0)
if join:
    first, second = im.convert("RGBA"), Image.open(join).convert("RGBA")
    height = max(first.height, second.height)
    gap = round(height * 0.15)
    im = Image.new("RGBA", (first.width + gap + second.width, height), (0, 0, 0, 0))
    im.alpha_composite(first, (0, (height - first.height) // 2))
    im.alpha_composite(second, (first.width + gap, (height - second.height) // 2))
if crop:
    im = im.crop(tuple(json.loads(crop)))
im = im.convert("RGBA")
if bg:
    base = Image.new("RGBA", im.size, bg)
    base.alpha_composite(im)
    im = base
if im.width > 640:
    im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
if kind == "logo" and fmt != "JPEG":
    out = stem + ".png"
    flat = im if im.getextrema()[3][0] < 255 else im.convert("RGB")
    flat.save(out, "PNG", optimize=True)
    if os.path.getsize(out) <= limit:
        print(out, im.width, im.height)
        sys.exit(0)
    flat.quantize(256, method=Image.Quantize.FASTOCTREE).save(out, "PNG", optimize=True)
    if os.path.getsize(out) <= limit:
        print(out, im.width, im.height)
        sys.exit(0)
    os.remove(out)
base = Image.new("RGBA", im.size, bg or "#ffffff")
base.alpha_composite(im)
im = base.convert("RGB")
out = stem + ".jpg"
for q in (88, 82, 75, 68, 60):
    im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= limit:
        break
print(out, im.width, im.height)
`;
// First interpreter that can import Pillow (on Windows "python3" may be a Store stub).
let pillowPython;
function pythonWithPillow() {
  if (pillowPython === undefined) {
    pillowPython = ["python3", "python"].find((py) => spawnSync(py, ["-I", "-c", "import PIL"], { encoding: "utf8" }).status === 0) || null;
  }
  return pillowPython;
}

/** Downloaded logo / line image (and the `join` image) → final file next to `stem`: {file, width, height}. */
function processLogo(raw, stem, source, joinRaw = "") {
  const args = [raw, stem, source.crop ? JSON.stringify(source.crop) : "", source.background || "", lineKind(source), String(LINE_MAX_BYTES), joinRaw];
  const py = pythonWithPillow();
  if (py) {
    const res = spawnSync(py, ["-I", "-c", PY_LINE, ...args], { encoding: "utf8" });
    if (res.status !== 0) throw new Error(`image processing failed: ${(res.stderr || res.error?.message || "").trim().split("\n").pop()}`);
    const [said, width, height] = res.stdout.trim().split("\n").pop().split(" ");
    if (said === "KEEP") {
      copyFileSync(raw, `${stem}.jpg`);
      return { file: `${stem}.jpg`, width: Number(width), height: Number(height) };
    }
    return { file: said, width: Number(width), height: Number(height) };
  }
  // No Python + Pillow: only a small, uncropped PNG/JPEG may be used as downloaded.
  const ext = path.extname(raw).slice(1);
  if (source.crop || joinRaw || !["png", "jpg"].includes(ext) || statSync(raw).size > LINE_MAX_BYTES) throw new Error("needs Python with Pillow to crop / join / shrink this image");
  copyFileSync(raw, `${stem}.${ext}`);
  return { file: `${stem}.${ext}` };
}

/** Download a picked image to a temporary file next to `stem`. */
async function download(stem, imageUrl, label) {
  await assertRobotsAllow(imageUrl);
  const { bytes, type } = await fetchBinary(imageUrl);
  const raw = `${stem}.${label}.${extOf(type, imageUrl)}`;
  await writeFile(raw, bytes);
  return raw;
}

/** Download `imageUrl` (and `joinUrl`), process it as a logo and put it at <stem>.png|jpg (replacing prevImage). */
async function saveLogo(stem, imageUrl, source, prevImage, joinUrl = "") {
  // Work on temporary names so a failure leaves the previous cover in place.
  const raws = [];
  let fresh;
  try {
    raws.push(await download(stem, imageUrl, "download"));
    if (joinUrl) raws.push(await download(stem, joinUrl, "join"));
    fresh = processLogo(raws[0], `${stem}.new`, source, raws[1] || "");
  } finally {
    for (const raw of raws) rmSync(raw, { force: true });
  }
  const file = `${stem}${path.extname(fresh.file)}`;
  const prevFile = prevImage ? path.join(APP_DIR, prevImage.replace(/^\.\//, "")) : "";
  for (const old of [prevFile, `${stem}.png`, `${stem}.jpg`]) if (old && path.resolve(old) !== path.resolve(file)) rmSync(old, { force: true });
  renameSync(fresh.file, file);
  return { image: `./assets/atlas/covers/${path.basename(file)}`, width: fresh.width, height: fresh.height, bytes: statSync(file).size };
}

/** Image picked from an official page (`page` + `img` | `og`). */
async function pickedCover(stem, source, prev) {
  await assertRobotsAllow(source.page);
  const pageRes = await politeFetch(source.page, { ttlHours: 24 * 30, accept: "text/html", retries: 1 });
  const image = pickLineImage(pageRes.body, source.page, source);
  const joinImage = source.join ? pickLineImage(pageRes.body, source.page, { img: source.join }) : "";
  if (!image || (source.join && !joinImage)) throw new Error(`no matching image on ${source.page}`);
  for (const picked of [image, joinImage].filter(Boolean)) {
    const host = new URL(picked).host;
    if (!isAllowedLineHost(host) && host !== new URL(source.page).host) throw new Error(`picked image is on ${host}, not the page's or an allowed host`);
  }
  const saved = await saveLogo(stem, image, source, prev?.image, joinImage);
  return {
    image: saved.image,
    image_remote: image,
    join_remote: joinImage || undefined,
    source_page: source.page,
    kind: lineKind(source),
    selector: lineSelector(source),
    note: source.note,
    width: saved.width,
    height: saved.height,
    bytes: saved.bytes,
  };
}

/** Line covers keep the official-host rule of line_covers.mjs (or Wikimedia, noted). */
async function lineCover(key, source, prev) {
  const [franchise, code] = key.split(":");
  const host = new URL(source.page).host;
  if (!isAllowedLineHost(host)) throw new Error(`${source.page} is not an official line host`);
  return pickedCover(path.join(ASSET_DIR, lineFileStem(franchise, code)), source, prev);
}

/**
 * bg / fg / bg_from of every cover from its cached file. A cover this machine cannot decode (a JPEG
 * without Pillow) keeps the colours it had, so a run without Python does not drop them.
 */
async function addTileColors(covers) {
  const brand = (await readJson(BRAND_COLORS, { colors: {} })).colors || {};
  const python = pythonWithPillow();
  const missed = [];
  for (const [key, c] of Object.entries(covers)) {
    const colors = c.image ? coverFileColors(path.join(APP_DIR, c.image.replace(/^\.\//, "")), brand[key]?.bg || "", python) : null;
    if (colors) Object.assign(c, colors);
    else missed.push(key);
  }
  if (missed.length) console.warn(`tile colours not computed (kept as they were): ${missed.join(", ")}`);
}

const isFresh = (prev, file) => prev && existsSync(file);
// A cover that is not downloaded again still takes the source's current note (why it comes from there).
const keep = (prev, source) => ({ ...prev, note: source.note });

async function main() {
  const previous = (await readJson(OUT, null))?.covers || {};
  const sources = { ...COVER_SOURCES, ...(await fateChapterSources()) };
  await mkdir(ASSET_DIR, { recursive: true });
  const covers = {};
  const failures = [];
  for (const [key, source] of Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))) {
    const base = key.replace(":", "-").replace(/[^a-z0-9_-]/gi, "_");
    const prev = previous[key];
    const sourceUrl = source.wiki || source.url || source.page;
    const prevFile = prev?.image ? path.join(APP_DIR, prev.image.replace(/^\.\//, "")) : "";
    const kind = source.kind || "picture";
    if (COLORS_ONLY) {
      if (prev) covers[key] = prev;
      continue;
    }
    try {
      if (source.page && !source.url) {
        if (isFresh(prev, prevFile) && !refreshes(key) && prev.source_page === source.page && prev.selector === lineSelector(source) && prev.kind === kind) {
          covers[key] = keep(prev, source);
          continue;
        }
        covers[key] = await pickedCover(path.join(ASSET_DIR, base), { ...source, kind }, prev);
        console.log(`${key}: ${path.basename(covers[key].image)} (${covers[key].bytes} bytes) <- ${covers[key].image_remote} [${source.page}]`);
        continue;
      }
      if (isFresh(prev, prevFile) && !refreshes(key) && prev.source_page === (source.wiki || source.page) && (source.wiki || prev.image_remote === source.url) && (prev.kind || "picture") === kind) {
        covers[key] = keep(prev, source);
        continue;
      }
      const found = source.wiki ? await infoboxImage(source.wiki) : { image: source.url, file_page: "" };
      let saved;
      if (kind === LOGO) {
        saved = await saveLogo(path.join(ASSET_DIR, base), found.image, source, prev?.image);
      } else {
        const { bytes, type } = await fetchBinary(found.image);
        let file = path.join(ASSET_DIR, `${base}.${extOf(type, found.image)}`);
        await writeFile(file, bytes);
        if (source.flatten || bytes.length > OPTIMISE_ABOVE_BYTES) file = optimise(file, source.flatten || "#ffffff");
        if (prevFile && path.resolve(prevFile) !== path.resolve(file)) rmSync(prevFile, { force: true });
        saved = { image: `./assets/atlas/covers/${path.basename(file)}`, bytes: statSync(file).size };
      }
      covers[key] = {
        image: saved.image,
        image_remote: found.image,
        source_page: source.wiki || source.page,
        file_page: found.file_page || undefined,
        kind,
        note: source.note,
        width: saved.width,
        height: saved.height,
        bytes: saved.bytes,
      };
      console.log(`${key}: ${path.basename(saved.image)} (${saved.bytes} bytes) <- ${found.image} [${sourceUrl}]`);
    } catch (error) {
      failures.push(`${key}: ${error.message || error}`);
      if (prev) covers[key] = prev;
    }
  }
  for (const [lineKey, source] of Object.entries(LINE_COVER_SOURCES).sort(([a], [b]) => a.localeCompare(b))) {
    const key = `line:${lineKey}`;
    const prev = previous[key];
    const prevFile = prev?.image ? path.join(APP_DIR, prev.image.replace(/^\.\//, "")) : "";
    if (COLORS_ONLY) {
      if (prev) covers[key] = prev;
      continue;
    }
    try {
      if (isFresh(prev, prevFile) && !refreshes(key) && prev.source_page === source.page && prev.selector === lineSelector(source) && prev.kind === lineKind(source)) {
        covers[key] = keep(prev, source);
        continue;
      }
      covers[key] = await lineCover(lineKey, source, prev);
      console.log(`${key}: ${path.basename(covers[key].image)} (${covers[key].bytes} bytes) <- ${covers[key].image_remote} [${source.page}]`);
    } catch (error) {
      failures.push(`${key}: ${error.message || error}`);
      if (prev && existsSync(prevFile)) covers[key] = prev;
    }
  }
  await addTileColors(covers);
  const out = {
    updated_at: today(),
    note: "Official cover images for Atlas group cards, channel headers and product lines (keys line:<franchise>:<code>). image = copy in this repo; image_remote = where it was downloaded from (join_remote = the second logo set beside it); source_page = the page that shows it as the official cover/logo; kind = logo (title / line logo, transparent PNG) or picture (box art, key visual, banner); width / height in pixels when known; bg = tile colour of the app's full-bleed tiles (#RRGGBB), fg = light | dark (white or black text reads better on bg), bg_from = edge | mean | brand | tint (how bg was chosen, scripts/atlas/lib/cover_colors.mjs).",
    covers,
  };
  const res = await writeCompactJson(OUT, out);
  console.log(`atlas covers: ${Object.keys(covers).length} -> ${res.written ? "written" : "unchanged"}`);
  if (failures.length) {
    console.warn(`failed:\n  ${failures.join("\n  ")}`);
    process.exitCode = Object.keys(covers).length ? 0 : 1;
  }
}

if (/(^|[\\/])build_atlas_covers\.mjs$/.test(process.argv[1] || "")) await main();
