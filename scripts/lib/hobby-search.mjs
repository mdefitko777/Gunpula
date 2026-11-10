// ホビーサーチ (www.1999.co.jp) search cards, shared by the Fate importer and its test.
//
// Three things the card is not: the product's name (the shop appends its own category,
// "マシュ・キリエライト (フィギュア)", and puts sale banners in front, "★特価品 POP UP
// PARADE …"), the maker's price (the card shows the shop's discounted price, e.g.
// 22,770 for a 25,300 yen figure, 22,253 for a 26,180 yen one) or a release date (a
// fuzzy "9月下旬 発売予定" with no year). So the name is cleaned, a price is kept only
// when the card labels it as the list price, and the date stays unset.
import { absoluteHtmlUrl, decodeHtmlAttr } from "./html-url.mjs";

export const HOBBY_SEARCH_BASE = "https://www.1999.co.jp";
const HOBBY_SEARCH_TITLE =
  /Fate|フェイト|FGO|セイバー|アルトリア|マシュ|ジャンヌ|ギルガメッシュ|エミヤ|遠坂|イリヤ|型月|月姫|空の境界|カルデア|サーヴァント/i;
// "Dr. FATE" is a DC character; MAFEX releases it and it matches on "FATE".
const HOBBY_SEARCH_EXCLUDE = /Dr\.?\s*FATE/i;

// The shop's category suffix: "(フィギュア)", "（完成品）", "(ドール)" …
const SHOP_CATEGORY_SUFFIX =
  /\s*[(（]\s*(?:フィギュア|完成品|完成品フィギュア|ドール|プラモデル|ガレージキット|トレーディングフィギュア|キャラクターグッズ|ホビー|食玩|ぬいぐるみ)\s*[)）]\s*$/;
// Sale banners in front of the name: "★特価品", "【特価品】", "★お買い得品".
const SHOP_SALE_PREFIX = /^\s*(?:[★☆]\s*)?(?:【\s*)?(?:特価品|特価|お買い得品|セール品|アウトレット)(?:\s*】)?\s*/;

function decodeText(value = "") {
  return decodeHtmlAttr(
    String(value)
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Card title → the product's own name (shop category suffix and sale banners removed). */
export function cleanHobbySearchName(name) {
  let text = String(name || "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(SHOP_SALE_PREFIX, "").replace(SHOP_CATEGORY_SUFFIX, "").replace(/^[★☆]\s*/, "").trim();
    if (next === text) break;
    text = next;
  }
  return text;
}

/**
 * The maker's list price from a card's price block, or null. Only a price the card
 * labels as such (定価 / メーカー希望小売価格 / 希望小売価格) counts; the bare shop
 * price is a discount and would undercut the official price by 10–20 %.
 */
export function hobbySearchListPrice(priceHtml) {
  const text = decodeText(priceHtml);
  const match = /(?:メーカー希望小売価格|希望小売価格|定価)[^\d]{0,20}([\d,]+)\s*円?/.exec(text);
  if (!match) return null;
  const price = Number(match[1].replace(/,/g, ""));
  return Number.isInteger(price) && price > 0 ? price : null;
}

/** One search result page → products (Fate titles only). */
export function parseHobbySearch(html) {
  const out = [];
  for (const chunk of String(html || "").split('<div class="c-product-list__item">').slice(1)) {
    const block = chunk.split("</div></div></div>")[0];
    const code = /ItemCode="(\d+)"/.exec(block)?.[1];
    const rawName = decodeText(/<div class="c-card__title">([\s\S]*?)<\/div>/.exec(block)?.[1] || "");
    if (!code || !rawName) continue;
    if (!HOBBY_SEARCH_TITLE.test(rawName) || HOBBY_SEARCH_EXCLUDE.test(rawName)) continue;
    // Cards below the fold load their picture lazily (data-src / data-original).
    const image = /<img[^>]*?(?:data-src|data-original|src)="([^"]*itbig[^"]*)"/i.exec(block)?.[1];
    const priceHtml = [...block.matchAll(/<div class="c-card__price[^"]*">([\s\S]*?)(?=<\/div>|<div|$)/g)].map((m) => m[1]).join(" ");
    out.push({
      key: code,
      name: cleanHobbySearchName(rawName),
      source_name: rawName,
      series: "",
      line: "ホビーサーチ",
      url: `${HOBBY_SEARCH_BASE}/${code}`,
      image: image ? absoluteHtmlUrl(image, HOBBY_SEARCH_BASE) : "",
      price_jpy: hobbySearchListPrice(priceHtml),
      // The card shows a fuzzy Japanese release phrase ("9月下旬 発売予定") with
      // no year, so it is left unset rather than guessed at.
      release_date: null,
      is_limited: /限定|特典/.test(rawName),
    });
  }
  return out;
}

/**
 * Hobby Search answers the bot with a bot check since 2026-11, so its stored records
 * are not refreshed. Records written before these rules (no source_name: the card title
 * was stored as the name) are tidied in place: the clean name, the card title kept as
 * source_name, and no price (it was the discounted card price). Returns how many changed.
 */
export function tidyStoredHobbySearchKits(kits, { idPrefix = "hobbysearch-fate-" } = {}) {
  let changed = 0;
  for (const kit of kits) {
    if (!String(kit.kit_id).startsWith(idPrefix) || kit.source_name) continue;
    const listed = kit.names?.ja || kit.names?.en || "";
    const names = { ...(kit.names || {}) };
    for (const lang of ["ja", "en", "zh"]) {
      if (names[lang]) names[lang] = cleanHobbySearchName(names[lang]);
    }
    // names.ko (names-ko.json / localize) carries the translated suffix "(피규어)".
    if (names.ko) names.ko = names.ko.replace(/\s*[(（]\s*피규어\s*[)）]\s*$/, "").trim();
    kit.names = names;
    if (listed) kit.source_name = listed;
    kit.price_jpy = null;
    changed += 1;
  }
  return changed;
}
