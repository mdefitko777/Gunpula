// Hobby Atlas "종류별 도감" (picture book by product line): every cell shows one kind of picture.
// A brand / product line shows its official logo (LINE_COVER_SOURCES → line_covers); a line that is
// only a kind of product with no brand of its own (goods, plush, prize, game …) gets a line icon the
// app draws (LINE_ICONS → line_icons). A grade code is in exactly one of the two, and never shows a
// photo of one particular product (owner's decision, 2026-11-19).
//
// LINE_COVER_SOURCES is the curated list. Every entry names the official page that shows the
// image and how to pick it from that page's static HTML (no JS is run):
//   img: { alt }      first <img>/<source> whose alt text is exactly this
//   img: { src }      first <img>/<source> whose src (or data-original / data-src / data-pc /
//                     srcset / data-srcset) contains this
//   og: true          the page's og:image
// optional:
//   crop: [l, t, r, b]  pixel box cut out of the downloaded image (BEYBLADE X line marks sit in
//                       the corner of an official explainer graphic)
//   background: "#…"    colour put behind transparent pixels; only for white logos, the others
//                       keep their transparency (logos are stored as-is, wide, never squared)
//   join: { alt | src }  a second image of the same page, set to the right of the first at the
//                       same height (a paired release whose site has one logo per title)
//   kind: "logo" | "key_visual"
// build_atlas_covers.mjs downloads each picked image into app/assets/atlas/covers/line-*.png|jpg
// and records it in data/atlas/atlas-covers.json under "line:<franchise>:<code>";
// build_atlas_groups.mjs copies those into data/atlas-groups.json → line_covers.
//
// A brand line whose logo we could not reach (LINE_COVER_GAPS says why: bandai-hobby.net brand
// pages answer every request from a non-browser with a 404 page; global.bandai-hobby.net 403;
// figma.jp / maxfactory.jp disallow bots in robots.txt; logos only as SVG, which Pillow cannot
// draw) is also in LINE_ICONS, so the app shows an icon rather than a product photo.

const MANUAL = "https://manual.bandai-hobby.net/"; // Bandai Spirits WEB取説: brand filter logos
const SATELLITE = "https://satellite.bandai-hobby.net/characters/"; // Bandai Hobby Site Satellite
const SATELLITE_GUNDAM = `${SATELLITE}gundam_list.php`; // transparent grade logos (WEB取説 has them on white tiles)
const TAMASHII = "https://tamashiiweb.com/item_brand/"; // TAMASHII NATIONS brand pages
const CANDY_GUNDAM = "https://www.bandai.co.jp/candy/gundam/"; // Bandai Candy Gundam shokugan portal
const BBX_GUIDE = "https://beyblade.takaratomy.co.jp/beyblade-x/guide/";
// Good Smile's own Nendoroid logo sits on cf.goodsmile.jp, whose robots.txt could not be read
// (2026-11-19), so the logo comes from Wikipedia's Nendoroid article (Wikimedia Commons file).
const NENDOROID = "https://en.wikipedia.org/wiki/Nendoroid";

const WHITE_LOGO_BG = "#16181d";

export const LINE_COVER_SOURCES = {
  // ── Gundam: Gunpla grades (Bandai Spirits) ──
  "gundam:HG": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_hg.png" } },
  "gundam:EG": { page: MANUAL, img: { alt: "ENTRY GRADE" } },
  "gundam:FM": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_fullmechanics.png" } },
  "gundam:MG": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_mg.png" } },
  // Satellite's MGEX logo is the "MGEX Ver.Ka" one, so MGEX keeps the WEB取説 tile.
  "gundam:MGEX": { page: MANUAL, img: { alt: "MGEX" } },
  "gundam:MGSD": { page: MANUAL, img: { alt: "MGSD" } },
  "gundam:PG": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_pg.png" } },
  "gundam:RG": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_rg.png" } },
  "gundam:SDEX": { page: MANUAL, img: { alt: "SDEX" } },
  "gundam:SDCS": { page: MANUAL, img: { alt: "SDガンダム クロスシルエット" } },
  "gundam:RE100": { page: MANUAL, img: { alt: "RE/100" } },
  "gundam:MEGA": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_mega.png" } },
  "gundam:HIRM": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_hirm.png" }, background: WHITE_LOGO_BG },
  "gundam:SD": { page: SATELLITE_GUNDAM, img: { src: "gundam/list/logo_sd.png" }, note: "Bandai Hobby 'SD' category mark (SD Gundam brand logos)" },
  "gundam:SDW": { page: `${SATELLITE}gundam_sd.php`, img: { src: "gundam/sd/logo_h.png" }, note: "SD GUNDAM WORLD HEROES logo" },
  // ── Gundam: TAMASHII NATIONS figure brands ──
  "gundam:METAL_BUILD": { page: TAMASHII, img: { src: "/brand-logo/metal_build.webp" } },
  "gundam:METAL_ROBOT": { page: TAMASHII, img: { src: "/brand-logo/metal_robot_tamashii.webp" } },
  "gundam:ROBOT_SPIRITS": { page: TAMASHII, img: { src: "/brand-logo/robot_tamashii.webp" } },
  "gundam:GUNDAM_UNIVERSE": { page: TAMASHII, img: { src: "/brand-logo/gundam_universe.webp" } },
  "gundam:CHOGOKIN": { page: TAMASHII, img: { src: "/brand-logo/chogokin.webp" } },
  "gundam:SH_FIGUARTS": { page: TAMASHII, img: { src: "/brand-logo/shfiguarts.webp" } },
  "gundam:NXEDGE": { page: `${TAMASHII}nxedge/`, img: { src: "/header/logo_nxedge.webp" } },
  "gundam:FIGUARTS_MINI": { page: `${TAMASHII}figuarts_mini/`, img: { src: "/header/logo_figuarts_mini.webp" } },
  "gundam:GFF": { page: `${TAMASHII}gundam_fix_figuration_metal/`, img: { src: "/header/logo_gundam_fix_figuration_metal.webp" }, note: "GUNDAM FIX FIGURATION METAL COMPOSITE logo (most GFF items in the catalog are GFFMC)" },
  "gundam:METAL_STRUCTURE": { page: `${TAMASHII}kaitai_shou_ki/`, img: { src: "/header/logo_kaitai_shou_ki.webp" } },
  "gundam:SDX": { page: `${TAMASHII}sdx/`, og: true, crop: [290, 225, 910, 405], note: "SDX logo cut from the brand page's share image" },
  // ── Gundam: shokugan (Bandai Candy) and gashapon (Bandai) ──
  "gundam:CONVERGE": { page: CANDY_GUNDAM, img: { src: "converge/images/logoS.2501.png" } },
  "gundam:GFRAME": { page: CANDY_GUNDAM, img: { src: "gframe/images/logoS.2204.png" } },
  "gundam:MOBILITY": { page: CANDY_GUNDAM, img: { src: "mobilityJoint/images/logoS.png" } },
  "gundam:ARTIFACT": { page: CANDY_GUNDAM, img: { src: "artifact/images/logoS.png" } },
  "gundam:SUPERIOR": { page: CANDY_GUNDAM, img: { src: "superiordefine/images/logoS.png" } },
  "gundam:MSE": { page: "https://gashapon.jp/ensemble/", img: { src: "images/common/logo_main.png" } },
  "gundam:GSF": { page: "https://gashapon.jp/gundam/", img: { src: "images/top/btn_item_ensemble_03.jpg" }, crop: [60, 6, 360, 79], note: "ガシャポン戦士f logo from the official Gundam gashapon menu button" },
  // The app shows this one on its "가샤폰" card (the code holds the gashapon and goods records).
  "gundam:GUNDAM_MERCH": { page: "https://gashapon.jp/gundam/", og: true, crop: [250, 170, 950, 410], note: "GASHAPON GUNDAM SERIES logo (share image of the official Gundam gashapon site)" },
  // ── Armored Core ──
  "armored_core:ACVI": { page: "https://shop.kotobukiya.co.jp/shop/r/r100000/", img: { src: "/cmnpc/ac_logo_pc.png" }, note: "Kotobukiya ARMORED CORE Variable Infinity (V.I.) series logo" },
  "armored_core:AC_SMP": { page: "https://www.bandai.co.jp/candy/brand/smp/index.html", img: { src: "/cms_files/smp.png" }, note: "SMP [SHOKUGAN MODELING PROJECT] logo" },
  "armored_core:AC30MM": { page: MANUAL, img: { alt: "30 MINUTES MISSIONS" }, note: "30 MINUTES MISSIONS title logo of the WEB取説 title filter" },
  // ── Pokémon ──
  "pokemon:POKEPLA": { page: MANUAL, img: { alt: "ポケモンプラモコレクション" } },
  "pokemon:POKE_MONCOLLE": { page: "https://www.takaratomy.co.jp/products/pokemon/moncolle_ex/lineup/", img: { src: "images/moncolle_logo.png" } },
  // The page's share image shows only the Pokémon logos, so the line takes the ガシャポン mark of the
  // same page (like GUNDAM_MERCH, the app shows it on the "가샤폰" card).
  "pokemon:POKE_GASHAPON": { page: "https://gashapon.jp/pokemon/", img: { src: "images/common/logo_gashapon.png" }, note: "ガシャポン logo of the official Pokémon gashapon page" },
  "pokemon:POKE_KUJI": { page: "https://1kuji.com/", img: { src: "/images/common/logo_1kuji.png" }, note: "一番くじ logo (BANDAI SPIRITS official 一番くじ site)" },
  // ── Good Smile: Nendoroid (Fate and Madoka keep the same grade code) ──
  "fate:NENDOROID": { page: NENDOROID, img: { src: "Nendoroid-Series.png" }, note: "Nendoroid logo (Wikimedia Commons); cf.goodsmile.jp robots.txt unreadable" },
  "madoka:NENDOROID": { page: NENDOROID, img: { src: "Nendoroid-Series.png" }, note: "Nendoroid logo (Wikimedia Commons); cf.goodsmile.jp robots.txt unreadable" },
  // ── BEYBLADE X: the brand, then the three product-line marks ──
  "beyblade:BEYBLADE_X": { page: "https://beyblade.takaratomy.co.jp/", og: true, crop: [140, 220, 1060, 420], note: "BEYBLADE X logo cut from the portal's share image (the page's own logo is SVG only)" },
  "beyblade:BX": { page: BBX_GUIDE, img: { alt: "BX" }, crop: [12, 20, 248, 224], note: "BX ベーシックライン mark from the official beginner guide" },
  "beyblade:UX": { page: BBX_GUIDE, img: { alt: "UX" }, crop: [12, 20, 248, 224], note: "UX ユニークライン mark from the official beginner guide" },
  "beyblade:CX": { page: BBX_GUIDE, img: { alt: "CX" }, crop: [12, 20, 248, 224], note: "CX カスタムライン mark from the official beginner guide" },
  // ── Nintendo ──
  "nintendo:NIN_AMIIBO": { page: "https://ja.wikipedia.org/wiki/Amiibo", img: { src: "Amiibo.svg" }, note: "amiibo logo (Wikimedia Commons PNG rendering); nintendo.com has it only as SVG" },
  // ── Effects ──
  "effects:TAMASHII_EFFECT": { page: `${TAMASHII}tamashii_effect/`, img: { src: "/header/logo_tamashii_effect.webp" } },
};

/**
 * Brand lines that have kits but no logo we could reach, and why (kept here so the report and the
 * code agree). Each is also in LINE_ICONS, so the cell shows a line icon until a logo is found.
 */
export const LINE_COVER_GAPS = {
  "gundam:PGU": "PG UNLEASHED logo only on bandai-hobby.net, which serves bots a 404 page",
  "gundam:AG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:FG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:EX": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:BMC": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:HY2M": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:HAROPLA": "HAROPLA logo only on bandai-hobby.net (blocked); WEB取説 has only ハロプラLite",
  "gundam:UCHG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:GANSO_SD": "no TAMASHII brand page or logo for 元祖SDガンダムワールド",
  "fate:FATE_ACTION": "mostly figma: figma.jp and maxfactory.jp disallow bots, goodsmile.com shows no figma logo",
  "madoka:MADOKA_ACTION": "mostly figma: figma.jp and maxfactory.jp disallow bots, goodsmile.com shows no figma logo",
  "effects:MODEROID_EFFECT": "goodsmile.com has no MODEROID brand page with a logo",
  "effects:GSC_SIMPLE_EFFECT": "no logo for THE シンプルエフェクト on goodsmile.com",
  "effects:CUSTOMIZE_EFFECT": "カスタマイズエフェクト pages are on bandai-hobby.net (blocked)",
};

/**
 * Fixed vocabulary of the app's line icons (data/atlas-groups.json → line_icons; documented in
 * docs/data-model.md). The app is built against this list, so a new kind needs an app release.
 */
export const LINE_ICON_KINDS = new Set(["goods", "plush", "figure", "prize", "game", "hardware", "card", "apparel", "food", "capsule", "plamo", "misc"]);

/**
 * Lines drawn as an icon: product kinds with no brand of their own, catch-all codes, and the
 * brand lines of LINE_COVER_GAPS. "<channel>:<grade code>" → kind.
 */
export const LINE_ICONS = {
  // ── Gundam ──
  "gundam:NG": "plamo", // catch-all for kits outside the grade system
  "gundam:TAMASHII_OTHER": "figure", // catch-all of several small TAMASHII brands
  "gundam:PGU": "plamo",
  "gundam:AG": "plamo",
  "gundam:FG": "plamo",
  "gundam:EX": "plamo",
  "gundam:BMC": "plamo",
  "gundam:HY2M": "plamo",
  "gundam:HAROPLA": "plamo",
  "gundam:UCHG": "plamo",
  "gundam:GANSO_SD": "figure",
  // ── Armored Core ──
  "armored_core:AC_SHOKUGAN": "food",
  // ── Pokémon ──
  "pokemon:POKE_PLUSH": "plush",
  "pokemon:POKE_GOODS": "goods",
  "pokemon:POKE_FIGURE": "figure", // several makers and toy lines
  "pokemon:POKE_PRIZE": "prize",
  // ── Fate ──
  "fate:FATE_ACTION": "figure",
  "fate:FATE_SCALE": "figure",
  "fate:FATE_PRIZE": "prize",
  "fate:FATE_GOODS": "goods",
  // ── Madoka ──
  "madoka:MADOKA_ACTION": "figure",
  "madoka:MADOKA_SCALE": "figure",
  "madoka:MADOKA_MINI": "figure",
  "madoka:MADOKA_PRIZE": "prize",
  "madoka:MADOKA_PLUSH": "plush",
  // ── Nintendo ──
  "nintendo:NIN_GAME": "game",
  "nintendo:NIN_HW": "hardware",
  "nintendo:NIN_GOODS": "goods",
  "nintendo:NIN_SCALE": "figure",
  "nintendo:NIN_ACTION": "figure",
  "nintendo:NIN_MINI": "capsule",
  "nintendo:NIN_PLUSH": "plush",
  "nintendo:NIN_PRIZE": "prize",
  "nintendo:NIN_PLAMO": "plamo",
  // ── Effects ──
  "effects:MODEROID_EFFECT": "plamo",
  "effects:CUSTOMIZE_EFFECT": "plamo",
  "effects:GSC_SIMPLE_EFFECT": "misc",
  // ── LEGO ──
  "lego:LEGO_SET": "plamo",
  "lego:LEGO_MINIFIG": "figure",
  "lego:LEGO_GEAR": "goods",
  "lego:LEGO_BOOK": "misc",
  "lego:LEGO_PARTS": "misc",
  // Codes the app gives records by their name (hobby-atlas-v3 correctedCode: builders parts out
  // of No Grade, mini figures and plush out of the Fate catch-alls, flat goods out of BEYBLADE X).
  "gundam:OPTION_PARTS": "plamo",
  "fate:FATE_MINI": "figure",
  "fate:FATE_PLUSH": "plush",
  "beyblade:BEYBLADE_GOODS": "goods",
};

/** line_icons codes that are not grade codes in the data (see the comment above). */
export const APP_DERIVED_CODES = new Set(["gundam:OPTION_PARTS", "fate:FATE_MINI", "fate:FATE_PLUSH", "beyblade:BEYBLADE_GOODS"]);

export const LINE_COVER_KINDS = new Set(["logo", "key_visual"]);

/** Every picked image must come from one of these official hosts. */
export const OFFICIAL_LINE_HOSTS = new Set([
  "manual.bandai-hobby.net",
  "satellite.bandai-hobby.net",
  "tamashiiweb.com",
  "www.bandai.co.jp",
  "gashapon.jp",
  "shop.kotobukiya.co.jp",
  "www.takaratomy.co.jp",
  "beyblade.takaratomy.co.jp",
  "1kuji.com",
]);

/**
 * Wikipedia / Wikimedia Commons, only for a logo the maker's own site does not have as a raster
 * image (an entry taken from here says so in its note).
 */
export const WIKIMEDIA_HOSTS = new Set(["en.wikipedia.org", "ja.wikipedia.org", "commons.wikimedia.org", "upload.wikimedia.org", "thumb.wikimedia.org"]);

export const isAllowedLineHost = (host) => OFFICIAL_LINE_HOSTS.has(host) || WIKIMEDIA_HOSTS.has(host);

export const lineKind = (source) => source.kind || "logo";

/** Stable text of how an entry is picked; a change makes the builder fetch it again. */
export const lineSelector = (source) =>
  JSON.stringify({
    img: source.img || null,
    og: Boolean(source.og),
    crop: source.crop || null,
    background: source.background || null,
    // Only when set, so the selectors already saved in atlas-covers.json stay the same.
    ...(source.join ? { join: source.join } : {}),
  });

/** File name stem for a line cover: line-<franchise>-<code in lower case>. */
export const lineFileStem = (franchise, code) => `line-${franchise}-${code.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? "");
  return out;
}

/** Highest-density candidate of a srcset ("a.png 1x, a@2x.png 2x" → a@2x.png). */
function bestOfSrcset(srcset) {
  const parts = String(srcset || "")
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .filter((p) => p[0]);
  if (!parts.length) return "";
  const weight = (d) => Number(String(d || "1x").replace(/[^\d.]/g, "")) || 1;
  return parts.reduce((best, p) => (weight(p[1]) > weight(best[1]) ? p : best))[0];
}

/**
 * Pick the image of one line from a page's HTML. Returns an absolute URL or "".
 * The highest-density srcset candidate wins over src when the matched tag has one.
 */
export function pickLineImage(html, pageUrl, source) {
  if (source.og) {
    const meta = [...html.matchAll(/<meta\s[^>]*>/gi)].map((m) => attrs(m[0])).find((a) => /^og:image$/i.test(a.property || a.name || ""));
    return meta?.content ? new URL(meta.content.trim(), pageUrl).href : "";
  }
  const want = source.img || {};
  for (const m of html.matchAll(/<(?:img|source)\s[^>]*>/gi)) {
    const a = attrs(m[0]);
    // Lazy-loading pages keep the real file in data-src / data-srcset (pokemon.co.jp) or
    // data-pc (nintendo.com), filled in by their JS, which is never run here.
    const src = (a.src || a["data-original"] || a["data-src"] || a["data-pc"] || "").trim();
    const srcset = a.srcset || a["data-srcset"];
    const best = bestOfSrcset(srcset);
    // NFKC: some pages write カ + combining dakuten (U+3099) instead of ガ.
    if (want.alt !== undefined && (a.alt || "").normalize("NFKC").trim() !== want.alt.normalize("NFKC")) continue;
    if (want.src && ![src, a["data-original"], srcset].some((v) => v && v.includes(want.src))) continue;
    const chosen = best || src;
    if (chosen) return new URL(chosen, pageUrl).href;
  }
  return "";
}

/** robots.txt → rule list for our bot (its own group if present, otherwise "*"). */
export function parseRobots(text, agent = "hobbyatlasdatabot") {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") current.rules.push({ allow: key === "allow", path: value });
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules).filter((r) => r.path || !r.allow);
}

/** Longest matching rule wins (Allow on a tie); "*" and "$" are supported. */
export function robotsAllows(rules, pathAndQuery) {
  let best = null;
  for (const rule of rules) {
    if (!rule.path) continue; // "Disallow:" (empty) allows everything
    const anchored = rule.path.endsWith("$");
    const body = (anchored ? rule.path.slice(0, -1) : rule.path).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const re = new RegExp(`^${body}${anchored ? "$" : ""}`);
    if (!re.test(pathAndQuery)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}
