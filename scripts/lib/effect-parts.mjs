// General-purpose figure effect parts (franchise "effects", the 이펙트 channel): smoke, explosion,
// impact, wind, thunder, water, flame, aura and rock parts that belong to no single work. Read by
// scripts/import_effect_parts.mjs; the series rules are also used by localize_catalog.mjs and the
// channel's atlas groups by build_atlas_groups.mjs.
//
// Effect parts made for one kit or character (光の翼, フィン・ファンネルエフェクト, ver. A.N.I.M.E.
// effect sets, Builders Parts MSエフェクト, 水の呼吸エフェクトパーツSET …) stay in their work's
// channel: only the makers' general effect lines are read here.
//   - 魂EFFECT (Tamashii Web brand "tamashii_effect"): the 2014–2020 line and today's
//     "… for S.H.Figuarts" line, 38 products on 2026-11-15, all listed in the japan area.
//   - Good Smile Company on goodsmile.com: THE シンプルエフェクト and the MODEROID effect parts.
//   - BANDAI SPIRITS product search: カスタマイズエフェクト (plastic effect parts for any model kit,
//     8 products 2020–2021); the same search the Armored Core and Pokepla importers read.
import { decodeEntities } from "./html-entities.mjs";

export const FRANCHISE = "effects";
export const TAMASHII_SOURCE_ID = "tamashii_effect_jp";
export const GSC_SOURCE_ID = "good_smile_effects_jp";
// The existing BANDAI SPIRITS product search source (import_bandai_collectibles.mjs).
export const BANDAI_SPIRITS_SOURCE_ID = "bandai_spirits_products_jp";
export const BANDAI_SPIRITS_SEARCH_URL = "https://www.bandaispirits.co.jp/products/search/result.php?freeword=%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA%E3%82%A8%E3%83%95%E3%82%A7%E3%82%AF%E3%83%88";

export const TAMASHII_BASE = "https://tamashiiweb.com";
export const TAMASHII_BRAND_CODE = "tamashii_effect";
export const TAMASHII_BRAND_URL = `${TAMASHII_BASE}/item_brand/${TAMASHII_BRAND_CODE}/`;
// The search API takes the brand like the site's own item search (brandCode[]); one page holds 40.
// emea is read too: the importer for Gundam reads japan/asia/usa only, and an EMEA event item
// would be missed (none on 2026-11-15; every overseas item was also in the japan list).
export const TAMASHII_AREAS = ["japan", "asia", "usa", "emea"];

export const GSC_BASE = "https://www.goodsmile.com";
// One keyword search lists every effect product by name (10 hits on 2026-11-15); the name rules
// below keep the effect parts and leave out PROGENITOR EFFECT kits and "エフェクトカラーVer." figures.
export const GSC_KEYWORD = "エフェクト";
export const GSC_PAGE_SIZE = 60;

// ---------------------------------------------------------------------------
// Series: one per kind of effect (the channel's atlas groups). Checked in order, so
// "SHOCK IMPACT" is an impact and "SMOKE Burst" a smoke before the explosion words.
export const EFFECT_KINDS = [
  { id: "aura", pattern: /AURA|オーラ/i, labels: { ko: "오라", zh: "气场", en: "Aura", ja: "オーラ" } },
  { id: "flame", pattern: /FLAME|BURNING|FIRE|炎|フレイム|ファイア/i, labels: { ko: "불꽃", zh: "火焰", en: "Flame", ja: "炎" } },
  { id: "smoke", pattern: /SMOKE|スモーク|煙/i, labels: { ko: "연기", zh: "烟雾", en: "Smoke", ja: "スモーク" } },
  { id: "explosion", pattern: /EXPLOSION|エクスプロージョン|爆発/i, labels: { ko: "폭발", zh: "爆炸", en: "Explosion", ja: "爆発" } },
  { id: "impact", pattern: /IMPACT|インパクト|衝撃/i, labels: { ko: "임팩트", zh: "冲击", en: "Impact", ja: "インパクト" } },
  { id: "wind", pattern: /WIND|ウインド|ウィンド|風/i, labels: { ko: "바람", zh: "风", en: "Wind", ja: "ウインド" } },
  { id: "thunder", pattern: /THUNDER|LIGHTNING|サンダー|雷/i, labels: { ko: "번개", zh: "雷电", en: "Thunder", ja: "サンダー" } },
  { id: "water", pattern: /WATER|WAVE|SPLASH|ウォーター|ウエーブ|ウェーブ|水/i, labels: { ko: "물·파도", zh: "水·波浪", en: "Water & Wave", ja: "ウォーター・ウエーブ" } },
  { id: "rock", pattern: /ROCK|CRASH|CONCRETE|ロック|クラッシュ|岩/i, labels: { ko: "바위·파편", zh: "岩石·碎裂", en: "Rock & Crash", ja: "ロック・クラッシュ" } },
  // カスタマイズエフェクト: slash arcs, muzzle flashes and motion lines.
  { id: "slash", pattern: /SLASH|斬撃/i, labels: { ko: "참격", zh: "斩击", en: "Slash", ja: "斬撃" } },
  { id: "gunfire", pattern: /GUNFIRE|MUZZLE|銃撃/i, labels: { ko: "총격", zh: "枪击", en: "Gunfire", ja: "銃撃" } },
  { id: "action", pattern: /アクションイメージ|ACTION IMAGE/i, labels: { ko: "액션", zh: "动作", en: "Action", ja: "アクション" } },
];
const OTHER_KIND = { id: "other", labels: { ko: "기타", zh: "其他", en: "Other", ja: "その他" } };
const SERIES_SORT = 900;

export function effectKind(name) {
  const text = String(name || "").normalize("NFKC");
  return EFFECT_KINDS.find((kind) => kind.pattern.test(text)) || OTHER_KIND;
}

/** The series of an effects record. No work and no universe: an effect part belongs to none. */
export function effectSeries(kit) {
  const kind = effectKind([kit.names?.ja, kit.names?.en].filter(Boolean).join(" "));
  const index = EFFECT_KINDS.indexOf(kind);
  return { key: `effects_${kind.id}`, sort: SERIES_SORT + (index < 0 ? EFFECT_KINDS.length : index), labels: kind.labels, universe: null };
}

// ---------------------------------------------------------------------------
// Helpers

const text = (value) => decodeEntities(String(value ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const absolute = (url, base) => (url ? new URL(url, base).href : null);

function yen(value) {
  const match = /([\d,]+)/.exec(String(value ?? ""));
  const price = match ? Number(match[1].replaceAll(",", "")) : NaN;
  return Number.isInteger(price) && price > 0 ? price : null;
}

function japaneseDate(value) {
  const match = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(String(value || ""));
  return match ? [match[1], match[2].padStart(2, "0"), match[3]?.padStart(2, "0")].filter(Boolean).join("-") : null;
}

function baseRecord({ kitId, grade, subline, ja, en, image, gallery, releaseDate, priceJpy, isLimited, sourceId, urls, tags, notes, extra = {} }) {
  return {
    kit_id: kitId,
    franchise: FRANCHISE,
    grade_code: grade,
    subline,
    number: null,
    scale: "non-scale",
    // ko / zh come from data/i18n/names-ko.json and names-zh.json (apply_ko_names / apply_zh_names).
    names: { ja, en: en || ja, zh: null, ko: null },
    images: { box_art_url: image || null, box_art_source_id: image ? sourceId : null },
    gallery_image_urls: unique([image, ...gallery]),
    universe: null,
    work_title: null,
    release_date: releaseDate || null,
    price_jpy: priceJpy ?? null,
    is_limited: Boolean(isLimited),
    ...extra,
    data_status: "needs_review",
    source_urls: unique(urls),
    source_refs: [
      {
        source_id: sourceId,
        url: urls[0] ?? null,
        fields: ["franchise", "names", "grade_code", "subline", "release_date", "price_jpy", "images", "gallery_image_urls"],
        confidence: "high",
      },
    ],
    tags,
    notes,
  };
}

// ---------------------------------------------------------------------------
// 魂EFFECT (Tamashii Web)

export function tamashiiEffectSearchUrl(area, page = 1) {
  const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE);
  url.searchParams.append("brandCode[]", TAMASHII_BRAND_CODE);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("current_page", String(page));
  url.searchParams.set("sort", "1");
  url.searchParams.set("area", area);
  return url.href;
}

/** Listings of several areas → one item per Tamashii id with the areas it is listed in. */
export function mergeTamashiiAreas(listsByArea) {
  const byId = new Map();
  for (const [area, items] of listsByArea) {
    for (const item of items || []) {
      if (!item?.tamashiiWebId || item.brandCode !== TAMASHII_BRAND_CODE) continue;
      const known = byId.get(item.tamashiiWebId);
      if (known) known.areas.push(area);
      else byId.set(item.tamashiiWebId, { ...item, areas: [area] });
    }
  }
  return [...byId.values()].sort((a, b) => Number(a.tamashiiWebId) - Number(b.tamashiiWebId));
}

// The 2014–2016 titles carry the brand ("魂EFFECT WIND Green Ver."), the later ones do not
// ("ROCK Beige Ver.", "SMOKE White Ver. for S.H.Figuarts"); the official full name has it.
export function tamashiiEffectName(title) {
  const name = text(title);
  return /^魂EFFECT/i.test(name.normalize("NFKC")) ? name : `魂EFFECT ${name}`;
}

// A reissue keeps its Tamashii page: the listing date is the reissue's, "初回発売日：2014年3月29日発売"
// the first release. The catalog dates a product by its first release (12391 IMPACT Gray would
// otherwise read 2016-07-16); the reissue goes in the notes.
export function tamashiiFirstRelease(item) {
  return /初回発売日/.test(item?.releaseDateNote || "") ? japaneseDate(item.releaseDateNote) : null;
}

function tamashiiListedDate(item) {
  return item.releaseDateData || item.releaseMonth || null;
}

/** A Tamashii listing (+ the parsed product page, or the values an earlier run stored) → record. */
export function tamashiiEffectRecord(item, detail = {}) {
  const url = `${TAMASHII_BASE}/item/${item.tamashiiWebId}/`;
  const ja = tamashiiEffectName(detail.title || item.title);
  const image = absolute(item.thumbnailImg, TAMASHII_BASE);
  const listed = tamashiiListedDate(item);
  const first = tamashiiFirstRelease(item);
  // The product page only adds the day within the listed month.
  const pageDate = detail.release_date && listed && String(detail.release_date).slice(0, 7) === String(listed).slice(0, 7) ? detail.release_date : null;
  const reissue = first ? pageDate || listed : null;
  const areaTags = item.areas?.includes("japan") ? [] : (item.areas || []).map((area) => `tamashii-${area}-only`);
  const categoryText = [item.category, item.categoryData?.long_name, ...(item.salesAttributeList || [])].filter(Boolean).join(" ");
  const notes = [
    "Imported from the official Tamashii Web 魂EFFECT catalog and product detail page.",
    reissue ? `Reissue shipping ${reissue}; first release ${first}.` : "",
    areaTags.length ? `Listed only in the ${item.areas.join("/")} sales area (event or overseas exclusive).` : "",
  ].filter(Boolean).join(" ");
  return baseRecord({
    kitId: `tamashii-${item.tamashiiWebId}`,
    grade: "TAMASHII_EFFECT",
    subline: "魂EFFECT",
    ja,
    en: ja.replace(/^魂EFFECT/, "TAMASHII EFFECT"),
    image,
    gallery: detail.images || [],
    releaseDate: first || pageDate || listed,
    priceJpy: yen(item.price) ?? detail.price_jpy ?? null,
    isLimited: /限定|抽選|魂ウェブ商店|TAMASHII NATION|魂ストア|web/i.test(categoryText),
    sourceId: TAMASHII_SOURCE_ID,
    urls: [url, TAMASHII_BRAND_URL],
    tags: ["effects", "tamashii nations", "effect parts", "tamashii-effect", ...(/S\.H\.Figuarts/i.test(ja) ? ["s.h.figuarts"] : []), ...areaTags],
    notes,
  });
}

/** What an earlier run read from a product page, so the page is not read again every day. */
export function tamashiiStoredDetail(kit) {
  if (!kit || !(kit.gallery_image_urls?.length > 1)) return null;
  return { title: kit.names?.ja || null, images: kit.gallery_image_urls.slice(1), price_jpy: kit.price_jpy, release_date: kit.release_date };
}

// The listing moved the month or changed the price: the product page is read again. Not the Gundam
// importer's tamashiiListingChanged: a reissue's listed month is never its first release date, and
// that check would read the five reissued products' pages every day.
export function tamashiiEffectChanged(item, kit) {
  if (!kit) return false;
  const rebuilt = tamashiiEffectRecord(item, tamashiiStoredDetail(kit) || {});
  return rebuilt.release_date !== kit.release_date || rebuilt.price_jpy !== kit.price_jpy;
}

// ---------------------------------------------------------------------------
// Good Smile Company (goodsmile.com)

export function gscEffectGrade(name) {
  const value = String(name || "").normalize("NFKC");
  if (/シンプルエフェクト|SIMPLE EFFECT/i.test(value)) return "GSC_SIMPLE_EFFECT";
  if (/^MODEROID\s.*エフェクト$/.test(value)) return "MODEROID_EFFECT";
  return null;
}

export function gscSearchUrl(offset = 0, keyword = GSC_KEYWORD) {
  const filter = {
    search_keyword: keyword,
    search_over18: false,
    search_category: [],
    search_maker: [],
    search_title: [],
    search_status: "0",
    release_date_from: "",
    release_date_to: "",
    search_bonus: false,
    search_exclusive: false,
    search_sale: false,
    search_sales_origin: false,
    tag: [],
  };
  return `${GSC_BASE}/ja/search/list?filter=${encodeURIComponent(JSON.stringify(filter))}&orderBy=1&limit=${GSC_PAGE_SIZE}&offset=${offset}&couponId=null&searchIndex=-1`;
}

/** goodsmile.com search list (HTML fragment) → [{ productId, name, url, image, price_jpy }]. */
export function parseGscCards(html) {
  const byId = new Map();
  for (const match of String(html).matchAll(/<a class="p-product-list__link" href="(\/ja\/product\/(\d+)[^"]*)">([\s\S]*?)<\/a>/g)) {
    const [, href, productId, body] = match;
    const name = text(/<h2 class="c-title[^"]*">([\s\S]*?)<\/h2>/.exec(body)?.[1]);
    if (!name || byId.has(productId)) continue;
    byId.set(productId, {
      productId,
      name,
      url: absolute(href, GSC_BASE),
      image: absolute(/src="([^"]*gsc-webrevo-sdk-storage-prd\/product\/image\/[^"]*)"/.exec(body)?.[1], GSC_BASE),
      price_jpy: yen(text(/<span class="c-price__main">([\s\S]*?)<\/span>/.exec(body)?.[1])),
    });
  }
  return [...byId.values()];
}

/**
 * A goodsmile.com product page (ja or en) → { name, price_jpy, jan, images, release_date }.
 * The page shows no release date once the product has shipped (2026-11-15: THE シンプルエフェクト
 * only says the order deadline); "Shipping 01/2027" / "2025/11" is read when it is there.
 */
export function parseGscDetail(html, productId) {
  let product = null;
  for (const match of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.["@type"] === "Product") product = parsed;
    } catch {
      // Not the product block; the markup below still has the name and price.
    }
  }
  const main = absolute((Array.isArray(product?.image) ? product.image[0] : product?.image) || /property="og:image" content="([^"]*)"/.exec(html)?.[1], GSC_BASE);
  // Products moved over from goodsmile.info keep image/product/<date>/<legacy id>/ paths.
  const legacyId = /product\/image\/product\/\d{8}\/(\d+)\//.exec(main || "")?.[1] || null;
  const gallery = [...String(html).matchAll(/(?:https:\/\/www\.goodsmile\.com)?\/gsc-webrevo-sdk-storage-prd\/product\/image\/(?:(\d+)|product\/\d{8}\/(\d+))\/[^"'\\\s)<]+/g)]
    .filter((match) => match[1] === String(productId) || (legacyId && match[2] === legacyId))
    .map((match) => absolute(match[0], GSC_BASE))
    // Image paths without an extension are the page's lazy-load placeholders.
    .filter((url) => /\.(?:jpe?g|png|webp|gif)$/i.test(url));
  const shipping = /(?:Shipping|出荷時期|発売時期)[^0-9<]{0,20}(?:(\d{1,2})\/(\d{4})|(\d{4})\/(\d{1,2}))/i.exec(html);
  const releaseDate = shipping ? (shipping[3] ? `${shipping[3]}-${shipping[4].padStart(2, "0")}` : `${shipping[2]}-${shipping[1].padStart(2, "0")}`) : null;
  const gtin = String(product?.gtin || "").replace(/\D/g, "");
  return {
    name: text(product?.name) || text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]) || null,
    price_jpy: yen(product?.offers?.price) ?? yen(text(/<span class="c-price__main">([\s\S]*?)<\/span>/.exec(html)?.[1])),
    jan: /^\d{13}$/.test(gtin) ? gtin : null,
    images: unique([main, ...gallery]),
    release_date: releaseDate,
  };
}

/** A search card + the ja and en product pages (or what an earlier run stored) → record. */
export function gscEffectRecord(card, detail = {}, english = {}) {
  const grade = gscEffectGrade(card.name);
  const images = detail.images?.length ? detail.images : [card.image];
  return baseRecord({
    kitId: `goodsmile-effects-g${card.productId}`,
    grade,
    subline: grade === "MODEROID_EFFECT" ? "MODEROID" : "THE シンプルエフェクト",
    ja: detail.name || card.name,
    en: english.name || null,
    image: images[0],
    gallery: images.slice(1),
    releaseDate: detail.release_date || english.release_date || null,
    priceJpy: card.price_jpy ?? detail.price_jpy ?? null,
    isLimited: false,
    sourceId: GSC_SOURCE_ID,
    urls: [card.url],
    tags: ["effects", "good smile company", "effect parts", grade.toLowerCase().replace(/_/g, "-")],
    notes: "Imported from the Good Smile Company official shop (goodsmile.com) search list and product pages.",
    extra: detail.jan ? { jan: detail.jan } : {},
  });
}

/** What an earlier run read from the product pages. */
export function gscStoredDetail(kit) {
  if (!kit) return null;
  return {
    // The price too: a sold-out product's search card has none (MODEROID フレイムエフェクト, 2026-11-15).
    detail: { name: kit.names?.ja || null, images: kit.gallery_image_urls || [], jan: kit.jan || null, release_date: kit.release_date || null, price_jpy: kit.price_jpy ?? null },
    english: { name: kit.names?.en && kit.names.en !== kit.names.ja ? kit.names.en : null },
  };
}

// ---------------------------------------------------------------------------
// カスタマイズエフェクト (BANDAI SPIRITS product search)

export function isCustomizeEffect(title) {
  return /^カスタマイズエフェクト/.test(String(title || "").normalize("NFKC"));
}

/** A product search card (parseBandaiSpiritProductCards) + its page's pictures → record. */
export function customizeEffectRecord(card, detail = {}) {
  const productId = /prd_id=(\d+)/.exec(card.source_url)?.[1] || null;
  // prd_id is the JAN with three zeros (4573102613226000).
  const jan = /^(\d{13})000$/.exec(productId || "")?.[1] || null;
  return baseRecord({
    kitId: `bandai-effect-${productId}`,
    grade: "CUSTOMIZE_EFFECT",
    subline: "カスタマイズエフェクト",
    ja: card.title,
    en: null,
    image: card.image_url,
    gallery: detail.images || [],
    releaseDate: card.release_date,
    priceJpy: card.price_jpy,
    isLimited: /限定|プレミアム/.test(card.title),
    sourceId: BANDAI_SPIRITS_SOURCE_ID,
    urls: [card.source_url, BANDAI_SPIRITS_SEARCH_URL],
    tags: ["effects", "bandai spirits", "effect parts", "plastic model", "customize-effect"],
    notes: "Imported from the official BANDAI SPIRITS product search (カスタマイズエフェクト).",
    extra: jan ? { jan } : {},
  });
}

// ---------------------------------------------------------------------------
// Catalog

/** Existing records keep their place (and the fields later steps added); new ones follow. */
export function mergeEffects(existingKits, imported) {
  const byId = new Map(imported.map((kit) => [kit.kit_id, kit]));
  const merged = existingKits.map((kit) => (byId.has(kit.kit_id) ? { ...kit, ...byId.get(kit.kit_id) } : kit));
  const known = new Set(existingKits.map((kit) => kit.kit_id));
  return [...merged, ...imported.filter((kit) => !known.has(kit.kit_id))];
}

/** The channel's atlas groups: one per kind of effect, bigger kinds first, "기타" last. */
export function effectGroups(kits, lang) {
  const byKey = new Map();
  for (const kit of kits.filter((k) => k.franchise === FRANCHISE)) {
    const key = kit.series?.key || effectSeries(kit).key;
    (byKey.get(key) || byKey.set(key, []).get(key)).push(kit);
  }
  return [...byKey.entries()]
    .map(([key, list]) => {
      const labels = list[0].series?.labels || effectSeries(list[0]).labels;
      // The newest product with a picture as the cover.
      const newest = [...list].filter((k) => k.images?.box_art_url).sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")))[0];
      return {
        id: key,
        kind: "series",
        labels: lang(labels.zh, labels.ko, labels.en, labels.ja),
        subtitle: lang("", "", "", ""),
        image: newest?.images.box_art_url || "",
        cover_source: "newest product picture (Tamashii Web / goodsmile.com)",
        kit_ids: list.map((k) => k.kit_id),
        count: list.length,
      };
    })
    .sort((a, b) => Number(a.id === "effects_other") - Number(b.id === "effects_other") || b.count - a.count || a.id.localeCompare(b.id));
}
