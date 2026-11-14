// Rules behind scripts/import_bnkr_pokemon.mjs (반다이남코코리아몰) and scripts/import_academy_pokemon.mjs
// (아카데미과학): the Korean releases of Bandai's and Takara Tomy's Pokémon products. Pure functions
// over saved pages, so scripts/test_kr_pokemon_shops.mjs runs them on fixtures.
//
// Both shops sell mostly products the catalog already has from the Japanese makers (Pokepla,
// MonColle). Such a listing does not become a second record: it joins the existing one (a source
// reference, the won price, the JAN: `jan` when it is the record's own, else `jan_kr`), and only a
// product no record matches gets its own record.
// Matching, in this order, and only when exactly one record fits:
//   1. JAN: the BNKR product page's 모델명, against a record's `jan`, a JAN in its kit_id
//      (pokepla-jp-<JAN>, pokemon-center-<JAN>) or the `jan_kr` an earlier run kept;
//   2. Pokepla: line and number ("QUICK!! 29" = "퀵!! 29", "No.62" = "62 셀렉트 시리즈"), else the name
//      without the line words;
//   3. MonColle: the Pokémon's Korean name and, when both sides say it, the size (MS / MM / ML …;
//      Academy's "EMC시리즈" is MS and "EHP시리즈" is ML). "피카츄" alone fits many records and is
//      never merged.
// The other way round too: of several listings that fit one record, only a single one under the
// current label joins it (applyListings).
import { goodsKind, goodsRuleKind } from "./catalog-cleanup.mjs";
import { decodeEntities } from "./html-entities.mjs";

export const BNKR_SOURCE_ID = "bnkrmall_kr";
export const ACADEMY_SOURCE_ID = "academy_kr";
export const BNKR_BASE = "https://www.bnkrmall.co.kr";
export const ACADEMY_BASE = "https://academy.co.kr";
// "포켓몬" over the whole mall: 259 products on 2026-11-14 (the 포켓몬스터 series page lists 74).
export const BNKR_SEARCH = `${BNKR_BASE}/goods/search.do?sword=%ED%8F%AC%EC%BC%93%EB%AA%AC&searchType=allTotal`;
export const ACADEMY_SEARCH = `${ACADEMY_BASE}/product/search.html?keyword=%ED%8F%AC%EC%BC%93%EB%AA%AC`;

const text = (value) => decodeEntities(String(value || "")).normalize("NFC").replace(/\s+/g, " ").trim();
const https = (url) => (url ? (url.startsWith("//") ? `https:${url}` : url) : null);

// ---------------------------------------------------------------------------
// Pages

/** BNKR search page → { products: [{ gno, name, series, price, image, listed }], pages }. */
export function parseBnkrList(html) {
  const page = String(html || "");
  const products = [];
  for (const card of page.split('<a class="thumb" href="../goods/detail.do?gno=').slice(1)) {
    const gno = /^(\d+)/.exec(card)?.[1];
    const name = text(/<h5 class="font-15">([^<]*)/.exec(card)?.[1]);
    if (!gno || !name) continue;
    const image = /background-image:url\('([^'?]+)/.exec(card)?.[1];
    const price = Number((/<span class="num[^>]*>([\d,]+)/.exec(card)?.[1] || "").replace(/,/g, ""));
    const listed = /\/goods\/middle\/(\d{4})(\d{2})(\d{2})\//.exec(image || "");
    products.push({
      gno,
      name,
      series: text(/<p class="font-13 caption">([^<]*)/.exec(card)?.[1]) || null,
      price: price > 0 ? price : null,
      image: https(image),
      listed: listed ? `${listed[1]}-${listed[2]}-${listed[3]}` : null,
    });
  }
  const pages = Math.max(1, ...[...page.matchAll(/pageLink\('(\d+)'\)/g)].map((match) => Number(match[1])));
  return { products, pages };
}

/** BNKR product page → { jan, maker, image }. 발매년월 is commented out in the spec table. */
export function parseBnkrDetail(html) {
  const page = String(html || "");
  const cell = (label) => text(new RegExp(`<th>${label}</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`).exec(page)?.[1]?.replace(/<[^>]+>/g, " "));
  const model = cell("모델명");
  return {
    jan: /^\d{13}$/.test(model) ? model : null,
    maker: cell("제조사/매입처") || null,
    image: /<meta property="og:image" content="([^"]+)"/.exec(page)?.[1] || null,
  };
}

/** Academy search page → { products: [{ productNo, code, name, price, soldOut, image, url }], pages }. */
export function parseAcademyList(html, base = ACADEMY_BASE) {
  const page = String(html || "");
  const products = [];
  for (const card of page.split('<div id="anchorBoxId_').slice(1)) {
    const productNo = /^(\d+)/.exec(card)?.[1];
    const full = text(/<div class="prd_name[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>/.exec(card)?.[1]);
    if (!productNo || !full) continue;
    const code = /^(S\d{5})\s+/.exec(full)?.[1] || null;
    const price = Number((/([\d,]+)원/.exec(card)?.[1] || "").replace(/,/g, ""));
    products.push({
      productNo,
      code,
      name: code ? full.slice(code.length).trim() : full,
      price: price > 0 ? price : null,
      soldOut: /<div class="soldout_ico/.test(card) && !/<div class="displaynone soldout_ico/.test(card),
      image: https(/<img src="([^"]+)"/.exec(card)?.[1]),
      // The canonical page; the slug link changes with the name.
      url: `${base}/product/detail.html?product_no=${productNo}`,
    });
  }
  const pages = Math.max(1, ...[...page.matchAll(/[?&]page=(\d+)/g)].map((match) => Number(match[1])));
  return { products, pages };
}

// ---------------------------------------------------------------------------
// What a listing is

// Boxes of a capsule or candy toy ("(세트)… (05입)", "포켓몬 런 (6개입 박스)") repeat the single product.
const BULK = /^\(세트\)|\(\d+개?입(?: 박스| 세트)?\)|\d+개입 박스/;
const PLUSH = /인형|봉제|보들보들|마스코트/;

export function bnkrKind(product) {
  const name = product.name;
  if (BULK.test(name)) return null;
  if (/포켓프라|포켓몬 프라모/.test(name)) return { grade: "POKEPLA", subline: "포켓프라" };
  if (/프라코로/.test(name)) return { grade: "POKEPLA", subline: "프라코로" };
  if (/나노블럭/.test(`${name} ${product.series || ""}`)) return { grade: "POKE_FIGURE", subline: "나노블럭" };
  if (/스케일 월드/.test(`${name} ${product.series || ""}`)) return { grade: "POKE_FIGURE", subline: "포켓몬 스케일 월드" };
  if (/깜짝에그/.test(name)) return { grade: "POKE_FIGURE", subline: "깜짝에그" };
  if (/포켓몬 체인지/.test(name)) return { grade: "POKE_FIGURE", subline: "포켓몬 체인지" };
  if (PLUSH.test(name)) return { grade: "POKE_PLUSH", subline: "봉제인형" };
  return { grade: "POKE_FIGURE", subline: "피규어" };
}

const MONCOLLE_LINE = /몬콜레|몬스터콜렉션|EMC|EHP|ESP|몬스터볼시리즈|스페셜시리즈|GET시리즈/;

export function academyKind(product) {
  const name = product.name;
  if (/포켓피스/.test(name)) return { grade: PLUSH.test(name) ? "POKE_PLUSH" : "POKE_FIGURE", subline: "포켓피스" };
  if (MONCOLLE_LINE.test(name)) return { grade: "POKE_MONCOLLE", subline: "몬콜레" };
  if (PLUSH.test(name)) return { grade: "POKE_PLUSH", subline: "봉제인형" };
  if (/말랑콕콕/.test(name)) return { grade: "POKE_FIGURE", subline: "말랑콕콕" };
  if (/포코피아/.test(name)) return { grade: "POKE_FIGURE", subline: "포코피아" };
  const kind = goodsKind({ franchise: "pokemon", source_name: name }) || goodsRuleKind(name);
  if (kind) return { grade: "POKE_GOODS", subline: "아카데미과학", goodsKind: kind };
  return { grade: "POKE_FIGURE", subline: "완구" };
}

/**
 * Academy's product code S{YY}{nnn} carries the year (S26077 → 2026); the S81… range is the old
 * EMC numbering. With the picture's upload month of the same year: "YYYY-MM", else "YYYY".
 */
export function academyReleaseDate(product) {
  const year = /^S(2\d)\d{3}$/.exec(product.code || "")?.[1];
  if (!year) return null;
  const month = /\/(20\d{2})(\d{2})\//.exec(product.image || "");
  return month && month[1] === `20${year}` ? `${month[1]}-${month[2]}` : `20${year}`;
}

// ---------------------------------------------------------------------------
// Matching

const squash = (value) => text(value).normalize("NFKC").toLowerCase().replace(/[\s&＆·・,!！.()（）[\]「」'"~〜-]/g, "");

/** Pokepla key: "quick-29", "no-62", or "name-<rest>" (null for sets of several kits). */
export function pokeplaKey(name) {
  let rest = text(name)
    .normalize("NFKC")
    .replace(/\[(?:단품|KR)\]/g, " ")
    .replace(/콜렉션/g, "컬렉션")
    .replace(/QUICK/gi, "퀵")
    .replace(/진화세트/g, "진화 세트")
    .replace(/자세\)/g, "포즈)");
  rest = rest.replace(/포켓몬 ?프라모(?:델)? ?컬렉션|포켓프라 ?컬렉션|포켓프라|포켓몬 ?프라모델/g, " ").trim();
  if (/\+/.test(rest)) return null;
  const quick = /퀵!*\s*(\d{1,2})(?!\d)/.exec(rest);
  if (quick) return `quick-${quick[1].padStart(2, "0")}`;
  const number = /^(?:No\.?\s*)?(\d{1,3})(?!\d)/i.exec(rest);
  if (number) return `no-${number[1].padStart(2, "0")}`;
  const key = squash(rest);
  return key ? `name-${key}` : null;
}

const MONCOLLE_SIZE = /\b(MS|MM|ML|MC|MB|EMC|EHP|ESP)\s*-?\s*\d*/;

/** { size, name } of a MonColle product name ("몬콜레 MS 팬텀" → MS / 팬텀; "몬콜레 MS-50 님피아" → MS / 님피아). */
export function moncolleParts(name) {
  const clean = text(name).normalize("NFKC");
  const size = MONCOLLE_SIZE.exec(clean)?.[1] || null;
  const rest = clean
    .replace(/포켓몬 30주년 기념|포코 아 포켓몬 컬렉션|포코피아|포켓몬|몬콜레|몬스터콜렉션|시리즈/g, " ")
    .replace(new RegExp(MONCOLLE_SIZE.source, "g"), " ");
  return { size, name: squash(rest) };
}

function catalogJan(kit) {
  if (/^\d{13}$/.test(kit.jan || "")) return kit.jan;
  return /-(\d{13})$/.exec(kit.kit_id)?.[1] || null;
}

// Same as the app's findJan (hobby-atlas-v3 lib/data/gunpula.dart): a 45… / 49… EAN-13 with a
// valid check digit, sometimes followed by "000" in Bandai picture names.
const JAN_IN_TEXT = /(?<!\d)(4[59]\d{11})(?:000)?(?!\d)/g;

function eanOk(code) {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(code[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/**
 * The record's own barcode as the app reads it: `jan`, else the first JAN in its id, source URLs,
 * number, box art or cached originals (Pokepla pictures are often named after it).
 */
export function recordJan(kit) {
  if (/^\d{13}$/.test(kit.jan || "") && eanOk(kit.jan)) return kit.jan;
  const texts = [kit.kit_id, ...(kit.source_urls || []), kit.number, kit.images?.box_art_url, ...(kit.images?.cached_from || [])];
  for (const value of texts) {
    for (const match of String(value || "").matchAll(JAN_IN_TEXT)) if (eanOk(match[1])) return match[1];
  }
  return null;
}

function moncolleSize(kit) {
  return /^(MS|ML|MB|MM|MC)-/.exec(kit.number || "")?.[1] || /^moncolle-(ms|ml|mb|mm)-/.exec(kit.kit_id)?.[1]?.toUpperCase() || moncolleParts(kit.names?.ko).size;
}

/** The catalog's Pokémon records (not the shops' own) → lookup tables. */
export function buildIndex(kits, ownPrefixes = ["bnkr-", "academy-"]) {
  const byJan = new Map();
  const pokepla = new Map();
  const moncolle = new Map();
  const add = (map, key, kit) => key && (map.get(key) || map.set(key, []).get(key)).push(kit);
  for (const kit of kits) {
    if (kit.franchise !== "pokemon" || ownPrefixes.some((prefix) => kit.kit_id.startsWith(prefix))) continue;
    add(byJan, catalogJan(kit), kit);
    // The Korean edition's JAN a join kept (joinRecord), so the listing keeps matching by JAN.
    if (kit.jan_kr && kit.jan_kr !== catalogJan(kit)) add(byJan, kit.jan_kr, kit);
    if (kit.grade_code === "POKEPLA") add(pokepla, pokeplaKey(kit.names?.ko), kit);
    if (kit.grade_code === "POKE_MONCOLLE") add(moncolle, moncolleParts(kit.names?.ko).name, kit);
  }
  return { byJan, pokepla, moncolle };
}

const only = (list) => (list?.length === 1 ? list[0] : null);

/** The catalog record a BNKR listing is (or null). */
export function matchBnkr(index, product, jan) {
  if (jan) {
    const byJan = only(index.byJan.get(jan));
    if (byJan) return { kit: byJan, by: "jan" };
  }
  if (/포켓프라|포켓몬 프라모/.test(product.name)) {
    const kit = only(index.pokepla.get(pokeplaKey(product.name)));
    if (kit) return { kit, by: "pokepla" };
  }
  return null;
}

// Academy still sells the MS / ML figures under the old MonColle EX labels: "EMC시리즈 리자몽"
// (S20007) has the picture of MS-15 リザードン, "EMC시리즈 나오하" (S22046) is MS-03 ニャオハ, a
// figure first sold in 2022, long after the EX line. Until 2026-11-14 these names were never
// matched and 57 of them became academy-… records next to the catalog's own. ESP (special) has
// no counterpart and only fits a record that names no size (the Mega figures). Such a match is
// "moncolle-legacy": a weaker claim than a listing under the current label (applyListings).
const ACADEMY_LINE_SIZE = { EMC: "MS", EHP: "ML" };
const ACADEMY_OLD_LINES = new Set(["EMC", "EHP", "ESP"]);

/** The catalog record an Academy listing is (or null): MonColle only (no other line overlaps, 2026-11-14). */
export function matchAcademy(index, product) {
  if (!/몬콜레|몬스터콜렉션|(?:EMC|EHP|ESP) ?시리즈/.test(product.name) || /세트|트레이너|플레이맵|GET/.test(product.name)) return null;
  const parts = moncolleParts(product.name);
  const size = ACADEMY_LINE_SIZE[parts.size] || parts.size;
  const { name } = parts;
  if (!name) return null;
  const candidates = (index.moncolle.get(name) || []).filter((kit) => {
    const own = moncolleSize(kit);
    return !size || !own || own === size || (size === "MM" && own === "MC");
  });
  const kit = only(candidates);
  return kit ? { kit, by: ACADEMY_OLD_LINES.has(parts.size) ? "moncolle-legacy" : "moncolle" } : null;
}

// ---------------------------------------------------------------------------
// Records

const SERIES = { key: "pokemon", sort: 400, labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" } };

/** A record of the shop's own, for a product no catalog record matches. */
export function ownRecord({ kitId, sourceId, kind, name, image, releaseDate, price, jan, url, tags, notes }) {
  const goods = kind.grade === "POKE_GOODS";
  return {
    kit_id: kitId,
    franchise: "pokemon",
    grade_code: kind.grade,
    subline: kind.subline,
    number: null,
    scale: "non-scale",
    ...(goods ? { category: "goods", goods_kind: kind.goodsKind || "other" } : {}),
    // Korean listings carry only a Korean name; the localizer fills the rest.
    names: { ko: name, ja: name, zh: name, en: name },
    source_name: name,
    images: { box_art_url: image || null, box_art_source_id: image ? sourceId : null },
    gallery_image_urls: image ? [image] : [],
    series: SERIES,
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: releaseDate || null,
    // The shops price in won; price_jpy stays null rather than a converted guess.
    price_jpy: null,
    price_krw: price ?? null,
    is_limited: /한정|\[KR\]/.test(name),
    ...(jan ? { jan } : {}),
    data_status: "verified",
    source_urls: [url],
    source_refs: [{ source_id: sourceId, url, fields: ["names", "images", "grade_code", "price_krw"], confidence: "high" }],
    tags: [...new Set(["pokemon", "korea", kind.grade.toLowerCase(), ...tags])],
    notes,
  };
}

/**
 * The shop's listing on an existing record: its source reference and URL, the won price (unless
 * the 포켓몬스토어 prices it), the JAN and a Korean name when the record has none. Never the kit_id.
 *
 * `jan` stays the record's own barcode: the shop's JAN is written there only when the record
 * already carries the same one (in its id, URLs or pictures); any other is the Korean edition's
 * and goes to `jan_kr`. The app reads `jan` before the JAN in the id and pairs Korean and Japanese
 * records by it, and on 2026-11-14 the first run gave 17 Pokepla records (pokepla-jp-4549660144823
 * …) the Korean 4573102… JAN in place of their own. A `jan` an earlier run of this shop wrote is
 * decided again.
 */
export function joinRecord(kit, { sourceId, url, price, jan, name }) {
  const refs = (kit.source_refs || []).filter((ref) => !(ref.source_id === sourceId && ref.url === url));
  const fields = ["price_krw"];
  const next = { ...kit };
  const otherKrw = refs.some((ref) => ref.source_id === "pokemon_store_kr" && (ref.fields || []).includes("price_krw"));
  if (price && !otherKrw) next.price_krw = price;
  const wroteJan = (kit.source_refs || []).some((ref) => ref.source_id === sourceId && (ref.fields || []).includes("jan"));
  const shopJan = jan || (wroteJan ? kit.jan : null);
  if (wroteJan) delete next.jan;
  if (shopJan) {
    if (recordJan(next) === shopJan) {
      if (!next.jan) {
        next.jan = shopJan;
        fields.push("jan");
      }
    } else {
      next.jan_kr = shopJan;
      fields.push("jan_kr");
    }
  }
  if (name && !/[가-힣]/.test(kit.names?.ko || "")) {
    next.names = { ...kit.names, ko: name };
    fields.push("names");
  }
  next.source_refs = [...refs, { source_id: sourceId, url, fields, confidence: "high" }];
  next.source_urls = [...new Set([...(kit.source_urls || []), url])];
  return next;
}

/** Listings of one product in a shop (BNKR has "QUICK!! 17 꼬부기" and "… [KR]") share a key. */
export function listingKey(product, jan) {
  // The two can carry different JANs (the Korean edition has its own), so Pokepla goes by number.
  const pokepla = /포켓프라|포켓몬 프라모/.test(product.name) ? pokeplaKey(product.name) : null;
  if (pokepla) return `pokepla-${pokepla}`;
  if (jan) return `jan-${jan}`;
  return `name-${squash(product.name.replace(/\[(?:단품|KR)\]/g, ""))}`;
}

/**
 * The shop's listings over the catalog. entries: [{ ownId, match (catalog record | null), weak
 * (an old-label match), record (own record), join }]. A product that earlier got a record of its
 * own and now matches a catalog record moves there: { from: ownId, to: match } goes into `aliases`
 * (data/kit-aliases.json), so saved likes and owned entries follow.
 */
export function applyListings(kits, entries, { retired = new Set() } = {}) {
  const byId = new Map(kits.map((kit) => [kit.kit_id, kit]));
  const aliases = {};
  let joined = 0;
  let own = 0;
  // Two products of the shop cannot both be one record. When several listings fit a record, the
  // one strong match joins it ("몬콜레 MS 팬텀" S26037 over "EMC시리즈 팬텀" S81340, entry.weak);
  // with no single strong one, none does ("EMC시리즈 피카츄" is listed twice, S81329 and S81336).
  const claimants = new Map();
  for (const entry of entries) if (entry.match) (claimants.get(entry.match.kit_id) || claimants.set(entry.match.kit_id, []).get(entry.match.kit_id)).push(entry);
  const joining = new Set();
  for (const list of claimants.values()) {
    const strong = list.filter((entry) => !entry.weak);
    const winner = strong.length === 1 ? strong[0] : !strong.length && list.length === 1 ? list[0] : null;
    if (winner) joining.add(winner);
  }
  for (const entry of entries) {
    if (joining.has(entry)) {
      const current = byId.get(entry.match.kit_id) || entry.match;
      byId.set(current.kit_id, joinRecord(current, entry.join));
      joined += 1;
      if (byId.has(entry.ownId)) {
        byId.delete(entry.ownId);
        aliases[entry.ownId] = current.kit_id;
      }
      continue;
    }
    if (retired.has(entry.ownId)) continue;
    const previous = byId.get(entry.ownId);
    byId.set(entry.ownId, previous ? { ...previous, ...entry.record } : entry.record);
    own += 1;
  }
  return { kits: [...byId.values()], aliases, joined, own };
}
