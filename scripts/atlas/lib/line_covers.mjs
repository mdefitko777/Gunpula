// Hobby Atlas "종류별 도감" (picture book by product line): one official image per product line,
// the line's own logo or brand key visual — never a photo of one particular product.
//
// LINE_COVER_SOURCES is the curated list. Every entry names the official page that shows the
// image and how to pick it from that page's static HTML (no JS is run):
//   img: { alt }      first <img>/<source> whose alt text is exactly this
//   img: { src }      first <img>/<source> whose src (or data-original / srcset) contains this
//   og: true          the page's og:image
// optional:
//   crop: [l, t, r, b]  pixel box cut out of the downloaded image (BEYBLADE X line marks sit in
//                       the corner of an official explainer graphic)
//   background: "#…"    colour behind transparent pixels (default white; dark for white logos)
//   kind: "logo" | "key_visual"
// build_atlas_covers.mjs downloads each picked image into app/assets/atlas/covers/line-*.png|jpg
// and records it in data/atlas/atlas-covers.json under "line:<franchise>:<code>";
// build_atlas_groups.mjs copies those into data/atlas-groups.json → line_covers.
//
// Lines that are not listed fall back to a kit photo in the app. Left out on purpose (see the
// notes in LINE_COVER_GAPS): sites that refuse our bot (bandai-hobby.net brand pages answer every
// request from a non-browser with a 404 page; global.bandai-hobby.net 403; kotobukiya.co.jp
// Cloudflare challenge), Good Smile (goodsmile.com / maxfactory.jp in maintenance when checked),
// catch-all codes that are not a product line, and lines without an official logo we could find.

const MANUAL = "https://manual.bandai-hobby.net/"; // Bandai Spirits WEB取説: brand filter logos
const SATELLITE = "https://satellite.bandai-hobby.net/characters/"; // Bandai Hobby Site Satellite
const TAMASHII = "https://tamashiiweb.com/item_brand/"; // TAMASHII NATIONS brand pages
const CANDY_GUNDAM = "https://www.bandai.co.jp/candy/gundam/"; // Bandai Candy Gundam shokugan portal
const BBX_GUIDE = "https://beyblade.takaratomy.co.jp/beyblade-x/guide/";

const WHITE_LOGO_BG = "#16181d";

export const LINE_COVER_SOURCES = {
  // ── Gundam: Gunpla grades (Bandai Spirits) ──
  "gundam:HG": { page: MANUAL, img: { alt: "HG" } },
  "gundam:EG": { page: MANUAL, img: { alt: "ENTRY GRADE" } },
  "gundam:FM": { page: MANUAL, img: { alt: "FULL MECHANICS" } },
  "gundam:MG": { page: MANUAL, img: { alt: "MG" } },
  "gundam:MGEX": { page: MANUAL, img: { alt: "MGEX" } },
  "gundam:MGSD": { page: MANUAL, img: { alt: "MGSD" } },
  "gundam:PG": { page: MANUAL, img: { alt: "PG" } },
  "gundam:RG": { page: MANUAL, img: { alt: "RG" } },
  "gundam:SDEX": { page: MANUAL, img: { alt: "SDEX" } },
  "gundam:SDCS": { page: MANUAL, img: { alt: "SDガンダム クロスシルエット" } },
  "gundam:RE100": { page: MANUAL, img: { alt: "RE/100" } },
  "gundam:MEGA": { page: MANUAL, img: { alt: "メガサイズモデル" } },
  "gundam:HIRM": { page: `${SATELLITE}gundam_list.php`, img: { src: "gundam/list/logo_hirm.png" }, background: WHITE_LOGO_BG },
  "gundam:SD": { page: `${SATELLITE}gundam_list.php`, img: { src: "gundam/list/logo_sd.png" }, note: "Bandai Hobby 'SD' category mark (SD Gundam brand logos)" },
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
  "gundam:SDX": { page: `${TAMASHII}sdx/`, og: true },
  // ── Gundam: shokugan (Bandai Candy) and gashapon (Bandai) ──
  "gundam:CONVERGE": { page: CANDY_GUNDAM, img: { src: "converge/images/logoS.2501.png" } },
  "gundam:GFRAME": { page: CANDY_GUNDAM, img: { src: "gframe/images/logoS.2204.png" } },
  "gundam:MOBILITY": { page: CANDY_GUNDAM, img: { src: "mobilityJoint/images/logoS.png" } },
  "gundam:ARTIFACT": { page: CANDY_GUNDAM, img: { src: "artifact/images/logoS.png" } },
  "gundam:SUPERIOR": { page: CANDY_GUNDAM, img: { src: "superiordefine/images/logoS.png" } },
  "gundam:MSE": { page: "https://gashapon.jp/ensemble/", img: { src: "images/common/logo_main.png" } },
  "gundam:GSF": { page: "https://gashapon.jp/gundam/", img: { src: "images/top/btn_item_ensemble_03.jpg" }, crop: [60, 6, 360, 79], note: "ガシャポン戦士f logo from the official Gundam gashapon menu button" },
  "gundam:GUNDAM_MERCH": { page: "https://gashapon.jp/gundam/", og: true, crop: [250, 170, 950, 410], note: "GASHAPON GUNDAM SERIES logo (share image of the official Gundam gashapon site)" },
  // ── Armored Core ──
  "armored_core:ACVI": { page: "https://shop.kotobukiya.co.jp/shop/r/r100000/", img: { src: "/cmnpc/ac_logo_pc.png" }, note: "Kotobukiya ARMORED CORE Variable Infinity (V.I.) series logo" },
  "armored_core:AC_SMP": { page: "https://www.bandai.co.jp/candy/brand/smp/index.html", img: { src: "/cms_files/smp.png" }, note: "SMP [SHOKUGAN MODELING PROJECT] logo" },
  // ── Pokémon ──
  "pokemon:POKEPLA": { page: MANUAL, img: { alt: "ポケモンプラモコレクション" } },
  "pokemon:POKE_MONCOLLE": { page: "https://www.takaratomy.co.jp/products/pokemon/moncolle_ex/lineup/", img: { src: "images/moncolle_logo.png" } },
  "pokemon:POKE_GASHAPON": { page: "https://gashapon.jp/pokemon/", og: true, crop: [240, 90, 960, 510], note: "share image of the official Pokémon gashapon page (Pokémon logo)" },
  "pokemon:POKE_KUJI": { page: "https://1kuji.com/", img: { src: "/images/common/logo_1kuji.png" }, note: "一番くじ logo (BANDAI SPIRITS official 一番くじ site)" },
  // ── BEYBLADE X: the three product-line marks ──
  "beyblade:BX": { page: BBX_GUIDE, img: { alt: "BX" }, crop: [12, 20, 248, 224], note: "BX ベーシックライン mark from the official beginner guide" },
  "beyblade:UX": { page: BBX_GUIDE, img: { alt: "UX" }, crop: [12, 20, 248, 224], note: "UX ユニークライン mark from the official beginner guide" },
  "beyblade:CX": { page: BBX_GUIDE, img: { alt: "CX" }, crop: [12, 20, 248, 224], note: "CX カスタムライン mark from the official beginner guide" },
};

/** Lines with kits but no cover, and why (kept here so the report and the code agree). */
export const LINE_COVER_GAPS = {
  "gundam:PGU": "PG UNLEASHED logo only on bandai-hobby.net, which serves bots a 404 page",
  "gundam:AG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:FG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:EX": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:BMC": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:HY2M": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:HAROPLA": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:UCHG": "no official line logo reachable (bandai-hobby.net blocked)",
  "gundam:NG": "catch-all for kits outside the grade system; no line logo exists",
  "gundam:GANSO_SD": "no TAMASHII brand page or logo for 元祖SDガンダムワールド",
  "gundam:TAMASHII_OTHER": "catch-all of several TAMASHII brands",
  "armored_core:AC30MM": "30MM brand pages are on bandai-hobby.net (blocked); Satellite 30MM page has no logo",
  "armored_core:AC_SHOKUGAN": "no official logo found for the ARMORED CORE VI Assemble Collection",
  "pokemon:POKE_PLUSH": "catch-all (Pokémon Center / Pokémon Store plush), not one product line",
  "pokemon:POKE_GOODS": "catch-all goods",
  "pokemon:POKE_FIGURE": "mixed makers (Nendoroid, Premium Bandai, Pokémon Store)",
  "pokemon:POKE_PRIZE": "Banpresto prize site shows only its small navi-site logo, no line logo",
  "fate:NENDOROID": "goodsmile.com was in maintenance (HTTP 503) when checked",
  "fate:FATE_ACTION": "figma: goodsmile.com / maxfactory.jp were in maintenance (HTTP 503) when checked",
  "fate:FATE_SCALE": "scale figures from many makers, not one product line",
  "fate:FATE_PRIZE": "mix of Banpresto prizes and 一番くじ, not one product line",
  "fate:FATE_GOODS": "catch-all goods (mostly Aniplex+)",
};

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

export const lineKind = (source) => source.kind || "logo";

/** Stable text of how an entry is picked; a change makes the builder fetch it again. */
export const lineSelector = (source) =>
  JSON.stringify({ img: source.img || null, og: Boolean(source.og), crop: source.crop || null, background: source.background || null });

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
    const src = (a.src || a["data-original"] || "").trim();
    const best = bestOfSrcset(a.srcset);
    // NFKC: some pages write カ + combining dakuten (U+3099) instead of ガ.
    if (want.alt !== undefined && (a.alt || "").normalize("NFKC").trim() !== want.alt.normalize("NFKC")) continue;
    if (want.src && ![src, a["data-original"], a.srcset].some((v) => v && v.includes(want.src))) continue;
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
