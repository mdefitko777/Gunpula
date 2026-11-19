// Rules behind scripts/import_nintendo_makers.mjs: Kotobukiya and Good Smile Company products of
// Nintendo games for the 닌텐도 channel (franchise "nintendo"). Pure functions over saved pages, so
// scripts/test_nintendo_makers.mjs can run them on fixtures.
//
// Sources, read 2026-11-19:
//   shop.kotobukiya.co.jp  Shift_JIS. The search has a 作品名 filter (search_filter1) for three
//                          Nintendo works (193 ゼノブレイド2, 50 ゼノブレイドクロス, 93 星のカービィ);
//                          other works only by keyword. It lists products on sale only: on
//                          2026-11-19 every Nintendo query found nothing and the goods pages of
//                          セイレーン and フォーミュラ said 販売終了. A sold-out product the owner asked
//                          for stays through data/nintendo/kotobukiya-manual.json.
//   www.goodsmile.com      /ja/search/list by the site's own 作品名 filter (title ids read off the
//                          checkboxes on /ja/search, 2026-11-19); a product page has the JAN, the
//                          作品名, the 仕様, the 販売 / 再販 months and the copyright line.
// Not used: www.kotobukiya.co.jp answers 403 to this bot (its detail URL is only written as a
// source reference), and a keyword search on goodsmile.com ("Pikmin" also returns Sanrio plush).
import { decodeEntities } from "./html-entities.mjs";
import { kotobukiyaShopSearchUrl } from "./kotobukiya-shop.mjs";
import { seriesFor } from "./nintendo-kr.mjs";

export const FRANCHISE = "nintendo";
export const KOTOBUKIYA_SOURCE_ID = "kotobukiya_nintendo_jp";
export const GSC_SOURCE_ID = "good_smile_nintendo_jp";
export const GSC_BASE = "https://www.goodsmile.com";
export const GSC_PAGE_SIZE = 60;
const KOTOBUKIYA_SHOP = "https://shop.kotobukiya.co.jp";

// ---------------------------------------------------------------------------
// Which works count

// The shop's 作品名 filter ids for Nintendo works, and keywords for the works it has no filter
// for. Pokémon is left out on purpose (the pokemon channel), so is ゼノサーガ (Bandai Namco).
export const KOTOBUKIYA_WORK_FILTERS = [[193, "ゼノブレイド2"], [50, "ゼノブレイドクロス"], [93, "星のカービィ"]];
export const KOTOBUKIYA_KEYWORDS = [
  "ゼノブレイド", "ゼルダ", "スプラトゥーン", "ファイアーエムブレム", "メトロイド", "カービィ", "ピクミン",
  "スマブラ", "大乱闘", "マリオ", "どうぶつの森", "ドンキーコング", "パルテナ",
];

// goodsmile.com 作品名 filter ids (2026-11-19). Not taken: ベヨネッタ (Sega's), ブレイブリーデフォルト
// (Square Enix's), ゼノサーガ (Bandai Namco's), ARMS NOTE (not Nintendo's ARMS) and the Pokémon ids.
export const GSC_TITLES = [
  [1874, "ゼノブレイド ディフィニティブ・エディション"], [1218, "ゼノブレイド2"], [2511, "ゼノブレイド3"],
  [940, "ゼルダの伝説 神々のトライフォース2"], [1182, "ゼルダの伝説 ブレス オブ ザ ワイルド"], [752, "ゼルダの伝説 ムジュラの仮面 3D"],
  [199, "ゼルダの伝説 スカイウォードソード"], [512, "ゼルダの伝説 風のタクトHD"], [1108, "ゼルダの伝説 トワイライトプリンセス"],
  [2815, "ゼルダの伝説 ティアーズ オブ ザ キングダム"],
  [379, "ファイアーエムブレム"], [890, "ファイアーエムブレム 新・紋章の謎"], [920, "ファイアーエムブレム 新・紋章の謎 ～光と影の英雄～"],
  [756, "ファイアーエムブレム 覚醒"], [901, "ファイアーエムブレムif"], [1798, "ファイアーエムブレム 風花雪月"],
  [653, "星のカービィ"], [1029, "星のカービィ ロボボプラネット"], [2843, "カービィカフェ"],
  [2414, "METROID DREAD"], [297, "METROID Other M"], [1234, "METROID PRIME 3 CORRUPTION"],
  [1186, "スプラトゥーン"], [1517, "スプラトゥーン/スプラトゥーン2"],
  [510, "スーパーマリオ"], [458, "とびだせ どうぶつの森"], [2796, "ピクミン"], [250, "パルテナの鏡"],
];

// A product page's copyright line names the rights holder: "©2017 Nintendo / MONOLITHSOFT",
// "© Nintendo / HAL Laboratory, Inc.". Pokémon carries Nintendo too, so it is checked first.
const POKEMON_RIGHTS = /Pok[eé]mon|ポケモン|Creatures|GAME ?FREAK/i;
const NINTENDO_RIGHTS = /Nintendo|任天堂/i;
// Text that names a Nintendo work by accident: マリオン, マリオネット, ゼノサーガ, ゼノギアス.
const NOT_NINTENDO = /マリオン|マリオネット|Marion|ゼノサーガ|ゼノギアス|Xenosaga|Xenogears/i;

/** "nintendo" | "pokemon" | "other" | null (nothing to tell by) from a copyright line. */
export function rightsHolder(copyright) {
  const value = String(copyright || "");
  if (!value.trim()) return null;
  if (POKEMON_RIGHTS.test(value)) return "pokemon";
  return NINTENDO_RIGHTS.test(value) ? "nintendo" : "other";
}

/** The channel's series for a work and name; null when neither names a Nintendo world. */
export function makerSeries(work, name) {
  for (const value of [work, name]) {
    if (!value || NOT_NINTENDO.test(value)) continue;
    const series = seriesFor(value);
    if (series.key === "nintendo_pokemon") return null;
    if (series.key !== "nintendo_other") return series;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Grades (the codes the hobby importer already uses; data/grades.json)

const GOODS_WORDS = /グッズ|ストラップ|キーホルダー|キーチェーン|アクリル|缶バッジ|バッジ|トート|バッグ|ソックス|靴下|シャツ|パーカー|タオル|マグ|クッション|ポーチ|ステッカー|ステーショナリー|ブランケット|Strap|Tote|Socks|T-Shirt|Keychain|Acrylic/i;

/** Grade of a Good Smile product from its category (ld+json), 仕様 and name. */
export function gscGrade({ category = "", spec = "", name = "" } = {}) {
  const text = `${category} ${name}`;
  if (/プラモデル|PLAMATEA|MODEROID/i.test(`${text} ${spec}`)) return "NIN_PLAMO";
  if (/ぬいぐるみ|Plush/i.test(text)) return "NIN_PLUSH";
  // goodsmile.com writes ころころいど in hiragana (2026-11-19: ころころいど カービィ fell through to NIN_SCALE).
  if (/コロコロイド|ころころいど|Corocoroid|トレーディング|Trading/i.test(text)) return "NIN_MINI";
  if (GOODS_WORDS.test(text)) return "NIN_GOODS";
  if (/ねんどろいど|Nendoroid|figma|アクションフィギュア/i.test(text)) return "NIN_ACTION";
  return "NIN_SCALE";
}

/** Grade of a Kotobukiya shop product from its カテゴリ / 仕様. */
export function kotobukiyaGrade({ category = "", specification = "", title = "" } = {}) {
  const text = `${category} ${specification} ${title}`;
  if (/プラモデル/.test(text) && !/塗料|オプションパーツ/.test(text)) return "NIN_PLAMO";
  if (/ぬいぐるみ/.test(text)) return "NIN_PLUSH";
  if (/可動/.test(text)) return "NIN_ACTION";
  if (/トレーディング|ミニフィギュア/.test(text)) return "NIN_MINI";
  if (/フィギュア|ARTFX/i.test(text)) return "NIN_SCALE";
  return "NIN_GOODS";
}

// ---------------------------------------------------------------------------
// Helpers

const text = (value) => decodeEntities(String(value ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const absolute = (url, base) => (url ? new URL(url, base).href : null);

function yen(value) {
  const match = /([\d,]+)/.exec(String(value ?? ""));
  const price = match ? Number(match[1].replaceAll(",", "")) : NaN;
  return Number.isInteger(price) && price > 0 ? price : null;
}

function monthOf(value) {
  const match = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(String(value || ""));
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : null;
}

export function scaleOf(value) {
  return /(1\/\d{1,2})(?!\d)/.exec(String(value || "").normalize("NFKC"))?.[1] || "non-scale";
}

/** The official kotobukiya.co.jp page of a JAN (written as a reference; the host is not read). */
export function kotobukiyaOfficialUrl(jan) {
  return /^\d{13}$/.test(String(jan || "")) ? `https://www.kotobukiya.co.jp/product/detail/p${jan}/` : null;
}

function record({ kitId, grade, subline, number = null, ja, en, scale, image, gallery, series, releaseDate, priceJpy, isLimited, jan, sourceId, urls, fields, tags, notes }) {
  return {
    kit_id: kitId,
    franchise: FRANCHISE,
    grade_code: grade,
    subline,
    number,
    scale: scale || "non-scale",
    // ko / zh come from data/i18n/names-ko.json and names-zh.json (apply_ko_names / apply_zh_names).
    names: { ja, en: en || ja, zh: ja, ko: ja },
    images: { box_art_url: image || null, box_art_source_id: image ? sourceId : null },
    gallery_image_urls: unique([image, ...(gallery || [])]),
    series: { key: series.key, sort: series.sort, labels: series.labels },
    universe: "Nintendo",
    // The work as the store records say it (series label, English), like the rest of the channel.
    work_title: series.labels.en,
    release_date: releaseDate || null,
    price_jpy: priceJpy ?? null,
    is_limited: Boolean(isLimited),
    ...(jan ? { jan } : {}),
    // Read from the maker's own pages (or the owner's reading of one), like the rest of the channel.
    data_status: "verified",
    source_urls: unique(urls),
    source_refs: [{ source_id: sourceId, url: urls[0] ?? null, fields, confidence: "high" }],
    tags,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Kotobukiya

export function kotobukiyaFilterUrl(filterId) {
  return `${KOTOBUKIYA_SHOP}/shop/goods/search.aspx?search_filter1=${filterId}&search.x=on&ps=90`;
}

export function kotobukiyaKeywordUrl(keyword) {
  return kotobukiyaShopSearchUrl(keyword);
}

export const kotobukiyaKitId = (productId) => `kotobukiya-nin-${productId}`;

const specValue = (detail, label) => detail?.spec_rows?.find((row) => row.label === label)?.value || "";

/**
 * Is a shop product a Nintendo work's? The 版権表記 decides when the page has one, then the
 * 作品名, then the filter or keyword that found it (filter: yes; keyword: only with a work).
 * → { series } or { skip: reason }.
 */
export function kotobukiyaWork(listing, detail) {
  const rights = rightsHolder(specValue(detail, "版権表記"));
  if (rights === "pokemon") return { skip: "Pokémon (pokemon channel)" };
  if (rights === "other") return { skip: "not a Nintendo work (版権表記)" };
  const work = specValue(detail, "作品名") || listing.work || "";
  // ©Nintendo on a work the series rules do not know (ARMS, F-ZERO …) is still the channel's.
  const series = makerSeries(work, listing.work ? listing.title : "") || (rights === "nintendo" ? seriesFor("") : null);
  if (series) return { series, work };
  return { skip: work ? `not a Nintendo work (${work})` : "no 作品名 to tell the work by" };
}

/** A shop listing (+ its goods page, or what an earlier run stored) → record or { skip }. */
export function kotobukiyaRecord(listing, detail = null, manual = null) {
  const found = kotobukiyaWork(listing, detail);
  if (found.skip) return found;
  const jan = /^\d{13}$/.test(listing.product_id) ? listing.product_id : manual?.jan || null;
  const images = unique([listing.image_url, ...(detail?.gallery || [])]);
  const grade = detail ? kotobukiyaGrade(detail) : manual?.grade || kotobukiyaGrade({ title: listing.title });
  return record({
    kitId: kotobukiyaKitId(listing.product_id),
    grade,
    subline: "寿屋",
    number: manual?.number || null,
    ja: detail?.title || listing.title,
    en: manual?.en || null,
    scale: detail?.scale && detail.scale !== "various" ? detail.scale : scaleOf(detail?.specification),
    image: images[0] || manual?.image,
    gallery: images.slice(1),
    series: found.series,
    // A reissue (再生産) keeps its goods page and JAN: the same record, the month the shop lists.
    releaseDate: detail?.release_date || manual?.release_date || null,
    priceJpy: detail?.price_jpy ?? manual?.price_jpy ?? null,
    isLimited: listing.is_limited,
    jan,
    sourceId: KOTOBUKIYA_SOURCE_ID,
    urls: [listing.detail_url, kotobukiyaOfficialUrl(jan)],
    fields: ["names", "grade_code", "release_date", "price_jpy", "images", "gallery_image_urls", "jan"],
    tags: ["nintendo", "kotobukiya", grade.toLowerCase()],
    notes: "Imported from the Kotobukiya online shop (Nintendo work filter and keyword search); the official product page is kept as a reference.",
  });
}

/**
 * A product of data/nintendo/kotobukiya-manual.json: sold out, so the shop no longer lists it
 * and www.kotobukiya.co.jp does not answer this bot. The facts come from that file.
 */
export function kotobukiyaManualRecord(entry) {
  const series = makerSeries(entry.work, entry.ja);
  if (!series) throw new Error(`kotobukiya-manual ${entry.jan}: ${entry.work} is not a Nintendo work`);
  const official = kotobukiyaOfficialUrl(entry.jan);
  return record({
    kitId: kotobukiyaKitId(entry.jan),
    grade: entry.grade,
    subline: "寿屋",
    number: entry.number || null,
    ja: entry.ja,
    en: entry.en || null,
    scale: entry.scale || "non-scale",
    image: entry.image || null,
    gallery: [],
    series,
    releaseDate: entry.release_date || null,
    priceJpy: entry.price_jpy ?? null,
    isLimited: false,
    jan: entry.jan,
    sourceId: KOTOBUKIYA_SOURCE_ID,
    urls: [official],
    fields: ["names", "grade_code", "release_date", "price_jpy", "jan", ...(entry.image ? ["images"] : [])],
    tags: ["nintendo", "kotobukiya", entry.grade.toLowerCase()],
    notes: entry.notes,
  });
}

/** What an earlier run read from a goods page (stored on the record), so it is not read daily. */
export function kotobukiyaStoredDetail(kit) {
  if (!kit || !kit.source_refs?.[0]?.fields?.includes("gallery_image_urls")) return null;
  return {
    title: kit.names?.ja || null,
    gallery: kit.gallery_image_urls?.slice(1) || [],
    release_date: kit.release_date,
    price_jpy: kit.price_jpy,
    scale: kit.scale,
    category: { NIN_PLAMO: "プラモデル", NIN_PLUSH: "ぬいぐるみ", NIN_ACTION: "可動", NIN_MINI: "トレーディング", NIN_SCALE: "フィギュア" }[kit.grade_code] || "",
    specification: "",
    // The record was written after its 版権表記 said Nintendo; a work without a series of its own
    // (work_title "Other") would otherwise be dropped the next day.
    spec_rows: [{ label: "作品名", value: kit.work_title }, { label: "版権表記", value: "©Nintendo" }],
  };
}

// ---------------------------------------------------------------------------
// Good Smile Company

export function gscTitleSearchUrl(titleId, offset = 0) {
  const filter = {
    search_keyword: "",
    search_over18: false,
    search_category: [],
    search_maker: [],
    search_title: [titleId],
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

export const gscKitId = (productId) => `goodsmile-nin-${productId}`;

/** The 作品名 / 仕様 rows, the copyright line, the category and the 販売 months of a product page. */
export function parseGscSpec(html) {
  const page = String(html || "");
  const rows = {};
  for (const match of page.matchAll(/<dl class="b-outline-table__detail">([\s\S]*?)<\/dl>/g)) {
    const label = text(/<dt[^>]*>([\s\S]*?)<\/dt>/.exec(match[1])?.[1]);
    const value = text(/<dd[^>]*>([\s\S]*?)<\/dd>/.exec(match[1])?.[1]);
    if (!value) continue;
    // The copyright row has no label.
    if (!label && /[©Ⓒ]|\(C\)/i.test(value)) rows.copyright = value;
    else if (label && !rows[label]) rows[label] = value;
  }
  // The 【販売：…】【再販：…】【三次再販：…】 history sits under 再販 on some pages and 関連情報 on
  // others (2026-11-19: ホムラ / figma サムス・アラン).
  const history = Object.values(rows).find((value) => /【販売：/.test(value)) || rows["販売"] || "";
  const first = /【販売：\s*(\d{4}\s*年\s*\d{1,2}\s*月)/.exec(history)?.[1] || /^(\d{4}\s*年\s*\d{1,2}\s*月)/.exec(rows["発売時期"] || rows["販売"] || "")?.[1];
  const reissues = [...history.matchAll(/【[^【】：]*再販[^【】：]*：\s*(\d{4}\s*年\s*\d{1,2}\s*月)】/g)].map((match) => monthOf(match[1]));
  let category = null;
  for (const match of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.["@type"] === "Product") category = text(parsed.category) || null;
    } catch {
      // Not the product block.
    }
  }
  return {
    work: rows["作品名"] || null,
    spec: rows["仕様"] || null,
    copyright: rows.copyright || null,
    category,
    first_release: first ? monthOf(first) : null,
    reissues: unique(reissues),
  };
}

/**
 * Is a Good Smile product a Nintendo work's? The copyright line decides; without one the
 * 作品名 filter that found it does (the filter is the site's own statement of the work).
 */
export function gscWork(card, spec = {}) {
  const rights = rightsHolder(spec.copyright);
  if (rights === "pokemon") return { skip: "Pokémon (pokemon channel)" };
  if (rights === "other") return { skip: `not a Nintendo work (${spec.copyright})` };
  const series = makerSeries(spec.work, null) || makerSeries(card.work, card.name) || (rights === "nintendo" ? seriesFor("") : null);
  return series ? { series } : { skip: `not a Nintendo work (${spec.work || card.work})` };
}

// A reissue renames the same product page: "【三次再販】 figma サムス・アラン" / "Rerelease [figma Samus
// Aran]". A product sold in variants names the one the page opened on after a full-width colon:
// "星のカービィ ACIMOV 靴下 black Ver./blue Ver.：星のカービィ ACIMOV 靴下 blue Ver." (en ":" + the
// same Japanese, no space). The record keeps the product's own name.
export function gscProductName(name) {
  const value = String(name || "")
    .replace(/^【[^】]*再販】\s*/, "")
    .replace(/^Rerelease \[(.+)\]$/, "$1")
    .replace(/\s*(?:：|:(?=[぀-ヿ㐀-鿿])).*$/, "");
  return value.trim() || null;
}

/** A search card + the parsed ja / en product pages (or what an earlier run stored) → record or { skip }. */
export function gscRecord(card, detail = {}, english = {}, spec = {}) {
  const found = gscWork(card, spec);
  if (found.skip) return found;
  const name = gscProductName(detail.name || card.name);
  const grade = gscGrade({ category: spec.category, spec: spec.spec, name });
  const images = detail.images?.length ? detail.images : [card.image];
  const reissues = (spec.reissues || []).filter((month) => month !== spec.first_release);
  return record({
    kitId: gscKitId(card.productId),
    grade,
    subline: "Good Smile Company",
    ja: name,
    en: gscProductName(english.name),
    scale: scaleOf(`${spec.spec || ""} ${spec.category || ""}`),
    image: images[0],
    gallery: images.slice(1),
    series: found.series,
    // The catalog dates a product by its first release; reissues of the same product id are
    // the same record (the months go in the notes).
    releaseDate: spec.first_release || detail.release_date || english.release_date || null,
    priceJpy: card.price_jpy ?? detail.price_jpy ?? null,
    isLimited: /限定|Exclusive/i.test(name),
    jan: detail.jan || null,
    sourceId: GSC_SOURCE_ID,
    urls: [`${GSC_BASE}/ja/product/${card.productId}`, `${GSC_BASE}/en/product/${card.productId}`],
    fields: ["names", "grade_code", "scale", "release_date", "price_jpy", "images", "gallery_image_urls", "jan"],
    tags: ["nintendo", "good smile", grade.toLowerCase()],
    notes: [
      "Imported from the Good Smile Company official shop (goodsmile.com work filter and product pages).",
      reissues.length ? `Reissued ${reissues.join(", ")}.` : "",
    ].filter(Boolean).join(" "),
  });
}

/** What an earlier run read from the product pages; null for records written before 2026-11-19. */
export function gscStoredPages(kit) {
  if (!kit || !kit.source_refs?.[0]?.fields?.includes("gallery_image_urls")) return null;
  const reissues = /Reissued ([\d\-, ]+)\./.exec(kit.notes || "")?.[1]?.split(/,\s*/) || [];
  return {
    detail: { name: kit.names?.ja || null, images: kit.gallery_image_urls || [], jan: kit.jan || null, release_date: kit.release_date || null, price_jpy: kit.price_jpy ?? null },
    english: { name: kit.names?.en && kit.names.en !== kit.names.ja ? kit.names.en : null },
    spec: {
      work: kit.work_title,
      spec: kit.scale !== "non-scale" ? kit.scale : null,
      // Stored only after the copyright line said Nintendo (see kotobukiyaStoredDetail).
      copyright: "©Nintendo",
      category: { NIN_PLAMO: "プラモデル", NIN_PLUSH: "ぬいぐるみ", NIN_MINI: "トレーディング", NIN_GOODS: "グッズ", NIN_ACTION: "figma" }[kit.grade_code] || null,
      first_release: kit.release_date,
      reissues,
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog

/** Existing records keep their place (and the fields later steps added); new ones follow. */
export function mergeMakerRecords(existingKits, imported) {
  const byId = new Map(imported.map((kit) => [kit.kit_id, kit]));
  const merged = existingKits.map((kit) => (byId.has(kit.kit_id) ? { ...kit, ...byId.get(kit.kit_id), names: keepNames(kit, byId.get(kit.kit_id)) } : kit));
  const known = new Set(existingKits.map((kit) => kit.kit_id));
  return [...merged, ...imported.filter((kit) => !known.has(kit.kit_id))];
}

// The ko / zh names the name steps wrote stay while the Japanese name is the same.
function keepNames(previous, next) {
  if (previous.names?.ja !== next.names.ja) return next.names;
  return { ...next.names, ko: previous.names?.ko || next.names.ko, zh: previous.names?.zh || next.names.zh };
}

/** A JAN or name already in the catalog under another id (another franchise or importer). */
export function findDuplicate(kits, record) {
  const key = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  return kits.find((kit) => kit.kit_id !== record.kit_id && (
    (record.jan && kit.jan === record.jan)
    || (kit.franchise === FRANCHISE && kit.subline === record.subline && key(kit.names?.ja) === key(record.names.ja) && kit.grade_code === record.grade_code)
  )) || null;
}
