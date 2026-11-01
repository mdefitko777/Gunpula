// Parsers for the official announcement sources added after the original four
// (Bandai Spirits ガンプラ topics, the Bandai Spirits YouTube channel, 魂ウェブ,
// BEYBLADE X news — see bandai-announcements.mjs). Every parser is pure (HTML or
// XML in, records out) and emits the same record shape, so the fetcher can merge
// and dedupe them uniformly. Reachability notes from 2026-11-02 (KR IP):
//
//   gundam-official.com/news       ok   Next.js page; the list is in the RSC payload
//   gundam-base.net/news           ok   static HTML
//   p-bandai.jp list pages         ok   Shift_JIS; item detail pages are an Akamai
//                                       bot-check page, so only list pages are read
//   tamashiiweb.com/topics/items/  ok   same markup as /news/, paged by current_page
//   beyblade.takaratomy.co.jp      ok   lineup page carries release dates
//   takaratomy.co.jp/products/pokemon/  ok   "お知らせ" box
//   pokemonfrienda.com             ok   topics carousel
//   shop.kotobukiya.co.jp          ok   title pages + goods pages (search.aspx is
//                                       robots-disallowed and not used)
//   www.kotobukiya.co.jp           blocked (Cloudflare managed challenge)
//   www.goodsmile.com              503 maintenance page since ~2026-10-23
//   bandai-hobby.net               every URL answers its 404 page from outside Japan
//   www.pokemoncenter-online.com   redirects to a virtual waiting room
//   www.pokemon.co.jp news/goods   rendered by scripts under robots-disallowed /js/
//   Pokémon Mezastar               service ended (稼動終了); site is static
import {
  absoluteUrl,
  decodeHtml,
  franchiseForAnnouncement,
  isGundamBaseProductNews,
  isProductAnnouncement,
  japaneseDate,
  stripTags,
} from "./bandai-announcements.mjs";

export const GUNDAM_OFFICIAL_NEWS_URL = "https://gundam-official.com/news";
export const GUNDAM_BASE_NEWS_URL = "https://www.gundam-base.net/news";
export const PREMIUM_BANDAI_NEW_ITEMS_URL = "https://p-bandai.jp/new_itemlist/";
// Hobby shop → ガンプラ, newest first. Gives full product names for the
// truncated ones on the new-items page, and marks which items are Gunpla.
export const PREMIUM_BANDAI_GUNPLA_LIST_URL = "https://p-bandai.jp/hobby/a0001/list-da10-n0/";
export const TAMASHII_TOPICS_ITEMS_URL = "https://tamashiiweb.com/topics/items/";
export const BEYBLADE_X_LINEUP_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";
export const TAKARATOMY_POKEMON_URL = "https://www.takaratomy.co.jp/products/pokemon/";
export const POKEMON_FRIENDA_URL = "https://pokemonfrienda.com/";
export const KOTOBUKIYA_SHOP_BASE = "https://shop.kotobukiya.co.jp";
// shop.kotobukiya.co.jp/shop/pages/titlelist.aspx ids. Title pages list goods
// newest release first.
export const KOTOBUKIYA_TITLES = [
  { id: "r100000", franchise: "armored_core", label: "ARMORED CORE" },
  { id: "r1157", franchise: "fate", label: "Fate シリーズ" },
  { id: "r1746", franchise: "fate", label: "Fate/Grand Order" },
  { id: "r1744", franchise: "fate", label: "Fate/strange Fake" },
  { id: "r100089", franchise: "pokemon", label: "『ポケットモンスター』シリーズ" },
];

export const YOUTUBE_CHANNELS = [
  {
    id: "gundam_channel_youtube",
    name: "ガンダムチャンネル YouTube",
    channelId: "UC7wu64jFsV02bbu6UHUd7JA",
    defaultFranchise: "gundam",
  },
  {
    id: "gundam_base_youtube",
    name: "THE GUNDAM BASE YouTube",
    channelId: "UCMt6mbBNDPwyNGvJKvhCYuA",
    defaultFranchise: "gundam",
    accept: /限定品情報/,
  },
  {
    id: "beyblade_youtube",
    name: "ベイチューブ YouTube",
    channelId: "UCuG_D_8QZmHTfbJfsz8-J_A",
    defaultFranchise: "beyblade",
  },
];

export function youtubeFeedUrls(channelId) {
  return [
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
    `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${channelId.slice(2)}`,
  ];
}

function hashTail(value, length = 10) {
  return Buffer.from(String(value)).toString("base64url").slice(-length);
}

export function statusFromTitle(title, fallback = "announced") {
  const text = String(title || "");
  if (/受付|予約|申込|お申し込み|受注|抽選販売/.test(text)) return "preorder_open";
  if (/決定|登場|商品化|発売|新商品|追加|再販/.test(text)) return "product_confirmed";
  return fallback;
}

export function announcementRecord({
  id,
  sourceId,
  franchise,
  title,
  status,
  announcedAt,
  announcedAtBasis = null,
  sourceType = "news",
  sourceName,
  sourceUrl,
  thumbnailUrl = null,
  videoId = null,
  confidence = "official",
  notes = null,
}) {
  return {
    id,
    franchise,
    names: { ja: title, zh: null, ko: null, en: null },
    status: status || statusFromTitle(title),
    announced_at: announcedAt,
    ...(announcedAtBasis ? { announced_at_basis: announcedAtBasis } : {}),
    source_type: sourceType,
    source_name: sourceName,
    source_id: sourceId,
    source_url: sourceUrl,
    thumbnail_url: thumbnailUrl,
    video_id: videoId,
    video_timestamp_seconds: null,
    series_key: "unclassified",
    grade_code: null,
    linked_kit_id: null,
    confidence,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Next.js flight data (gundam-official.com renders its news list server-side
// into self.__next_f.push([1,"…"]) chunks, not into the HTML).

export function extractNextFlight(html) {
  const marker = 'self.__next_f.push([1,"';
  let out = "";
  for (const part of String(html || "").split(marker).slice(1)) {
    const end = part.indexOf('"])');
    if (end < 0) continue;
    try {
      out += JSON.parse(`"${part.slice(0, end)}"`);
    } catch {
      // A chunk that is not a plain JSON string; skip it.
    }
  }
  return out;
}

function balancedObjectAfter(text, key) {
  const at = text.indexOf(key);
  if (at < 0) return null;
  const start = text.indexOf("{", at + key.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// gundam-official.com tags every post with categories. These are the ones that
// announce things the app collects. トイ・グッズ is left out: it is mostly
// tableware, bags and appliances (a ザク yakiniku grill). A post that is also
// tagged with a blocked category (a Gunpla book, a Gunpla tournament) is dropped.
const GUNDAM_OFFICIAL_CATEGORIES = new Set([
  "ガンプラ",
  "プラモデル",
  "フィギュア",
  "食玩・お菓子",
  "トイ・カード・グッズ",
  "ガシャポン",
  "一番くじ",
]);
const GUNDAM_OFFICIAL_BLOCKED = new Set(["書籍・コミック", "イベント", "ファッション・アクセサリー", "カード", "話題・キャンペーン"]);

export function parseGundamOfficialNews(html) {
  const flight = extractNextFlight(html);
  const json = balancedObjectAfter(flight, '"newsResponse":');
  if (!json) return { records: [], items: 0, oldest: null };
  const response = JSON.parse(json);
  const records = [];
  let oldest = null;
  for (const news of response.data || []) {
    const date = String(news.displayDatetime || "").slice(0, 10);
    if (date && (!oldest || date < oldest)) oldest = date;
    const categories = (news.categories || []).map((category) => category.name);
    const title = decodeHtml(news.title);
    if (!date || !title || !news.url) continue;
    if (!categories.some((category) => GUNDAM_OFFICIAL_CATEGORIES.has(category))) continue;
    if (categories.some((category) => GUNDAM_OFFICIAL_BLOCKED.has(category))) continue;
    // Magazines, the weekly "SDガンダムいんふぉ" video column and snack tins are
    // tagged ガンプラ/食玩 but are not products to collect.
    if (!isProductAnnouncement(title) || /ホビージャパン|月刊|いんふぉ|クッキー|ムック/.test(title)) continue;
    records.push(announcementRecord({
      id: `gundam-official-${news.documentId}`,
      sourceId: "gundam_official_news",
      // Every post on this site is a Gundam post; a crossover still belongs here.
      franchise: "gundam",
      title,
      announcedAt: date,
      sourceName: "GUNDAM.INFO",
      sourceUrl: news.url,
      thumbnailUrl: news.thumbnail?.url || null,
      notes: categories.length ? `gundam-official.com: ${categories.join(" / ")}` : null,
    }));
  }
  return { records, items: (response.data || []).length, oldest, pageCount: response.pageCount || null };
}

// ---------------------------------------------------------------------------

export function parseGundamBaseNews(html, pageUrl = GUNDAM_BASE_NEWS_URL) {
  const records = [];
  for (const block of String(html || "").split(/<li class="itemBoxCol">/).slice(1)) {
    const href = /<a href="([^"]+)"/.exec(block)?.[1];
    const title = stripTags(/<h3 class="name">([\s\S]*?)<\/h3>/.exec(block)?.[1]);
    const date = japaneseDate(/<p class="date">([\s\S]*?)<\/p>/.exec(block)?.[1]);
    // Café kitchen-car menus "登場中" and opening-hours notices are store news.
    if (!href || !title || !date || !isGundamBaseProductNews(title) || /カフェ|キッチンカー|メニュー|営業/.test(title)) continue;
    const url = absoluteUrl(href, pageUrl);
    const image = absoluteUrl(/<img\b[^>]*src="([^"]+)"/.exec(block)?.[1], pageUrl);
    records.push(announcementRecord({
      id: `gundam-base-${date}-${/(\d+)\.html/.exec(href)?.[1] || hashTail(href)}`,
      sourceId: "gundam_base_news",
      franchise: "gundam",
      title,
      status: statusFromTitle(title, "product_confirmed"),
      announcedAt: date,
      sourceName: "THE GUNDAM BASE",
      sourceUrl: url,
      // The generic logo tile says nothing about the product.
      thumbnailUrl: /thumb_logo|\/news\.jpg$/.test(image || "") ? null : image,
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------
// Premium Bandai. /new_itemlist/ is the store-wide "新着商品" page: two weeks of
// new listings with their sale-start time ("開始：10/30 11時") but truncated names
// ("ＭＧ 1/100 フルアーマー・ユニ..."). The ガンプラ category list has the full
// names, so it is read too and joined on the item id.

// HG/RG/MG/PG/RE at 1/144, 1/100 or 1/60 is Gunpla; HG 1/72 (AMAIM, Dunbine)
// and HG 1/35 (Code Geass) or "HG スコープドッグ…" are other Bandai kits.
const PB_GUNDAM_TITLE = /^(?:HG|RG|MG|PG|RE|EG|MGSD|MGEX|SD)\s*(?:1\/(?:144|100|60)\b)|ガンダム|ガンプラ|GUNDAM|ザク|ジオン/i;
// Apparel, tableware and accessories share the listing with hobby items.
const PB_NOT_COLLECTIBLE = /STRICT-G|Tシャツ|パーカー|ジャケット|スウェット|キャップ|バッグ|ポーチ|タオル|湯呑|マグ|ネックレス|リング|ピアス|財布|パジャマ|ソックス|ウォッチ|腕時計|カードゲーム|ブースターパック|チョコ|缶|ボトルホルダ|ホロライブ/i;

function decodeFullWidthDigits(value) {
  return String(value || "").replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

export function parsePremiumBandaiCategoryTitles(html) {
  const titles = new Map();
  for (const match of String(html || "").matchAll(/<a[^>]*href="[^"]*\/item\/item-(\d+)\/?"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = stripTags(match[2]);
    if (text && !/\.\.\.$/.test(text) && !titles.has(match[1]) && text.length > 4) titles.set(match[1], text);
  }
  return titles;
}

export function parsePremiumBandaiNewItems(html, {
  fullTitles = new Map(),
  gunplaIds = new Set(),
  now = new Date(),
} = {}) {
  const records = [];
  const seenNames = new Set();
  for (const block of String(html || "").split("<!-- ITEM BOX -->").slice(1)) {
    const itemId = /\/item\/item-(\d+)\//.exec(block)?.[1];
    const listed = stripTags(/<p class="itemslist_name">[\s\S]*?<span>([\s\S]*?)<\/span>/.exec(block)?.[1]);
    const start = /開始：\s*(\d{1,2})\/(\d{1,2})/.exec(block);
    if (!itemId || !listed || !start) continue;
    const month = Number(start[1]);
    // The page shows no year; listings are at most a few weeks old.
    const year = month > now.getMonth() + 2 ? now.getFullYear() - 1 : now.getFullYear();
    const date = `${year}-${String(month).padStart(2, "0")}-${start[2].padStart(2, "0")}`;
    const fullTitle = fullTitles.get(itemId);
    const title = fullTitle || listed.replace(/\.\.\.$/, "…");
    if (PB_NOT_COLLECTIBLE.test(title)) continue;
    const franchise = gunplaIds.has(itemId) || PB_GUNDAM_TITLE.test(String(title).normalize("NFKC"))
      ? franchiseForAnnouncement(title, "gundam") === "armored_core" ? "armored_core" : "gundam"
      : franchiseForAnnouncement(title);
    if (!franchise) continue;
    // Box and single-pack listings of the same thing share one truncated name.
    const nameKey = `${date}|${listed}`;
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    const badge = /<span class="hassou">[\s\S]*?alt="([^"]*)"/.exec(block)?.[1] || "";
    const image = /<img src="([^"]+)"/.exec(block)?.[1];
    records.push(announcementRecord({
      id: `pbandai-${itemId}`,
      sourceId: "premium_bandai_new_items",
      franchise,
      title,
      status: /予約|抽選/.test(badge) || /予約|抽選/.test(title) ? "preorder_open" : "product_confirmed",
      announcedAt: date,
      sourceName: "プレミアムバンダイ",
      sourceUrl: `https://p-bandai.jp/item/item-${itemId}/`,
      thumbnailUrl: absoluteUrl(image, "https://p-bandai.jp/"),
      notes: fullTitle ? null : "Name truncated by the Premium Bandai new-items list.",
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------
// BEYBLADE X lineup: every product with its release date, no post date. Only
// items not yet released (or released in the last couple of weeks) count as
// announcements; they are dated by when this bot first saw them.

export function parseBeybladeLineup(html, { today, pageUrl = BEYBLADE_X_LINEUP_URL, graceDays = 14 } = {}) {
  const records = [];
  const floor = new Date(`${today}T00:00:00Z`);
  floor.setUTCDate(floor.getUTCDate() - graceDays);
  const floorIso = floor.toISOString().slice(0, 10);
  for (const match of String(html || "").matchAll(/<li class="([^"]*)"[^>]*data-release-date[^>]*>([\s\S]*?)<\/li>/g)) {
    const block = match[2];
    const href = /<a href="([^"]+)"/.exec(block)?.[1];
    const code = stripTags(/<b>([^<]*)/.exec(block)?.[1]);
    const name = stripTags(/<b>[^<]*<span>([\s\S]*?)<\/span>/.exec(block)?.[1]);
    const kind = stripTags(/<p class="category">([\s\S]*?)<\/p>/.exec(block)?.[1]);
    const release = /(\d{4})\.(\d{1,2})\.(\d{1,2})発売/.exec(stripTags(block));
    if (!href || !code || !name || !release) continue;
    const releaseIso = `${release[1]}-${release[2].padStart(2, "0")}-${release[3].padStart(2, "0")}`;
    if (releaseIso < floorIso) continue;
    const title = `${code} ${name}${kind ? ` ${kind}` : ""}`;
    records.push(announcementRecord({
      id: `beyblade-lineup-${hashTail(href, 12)}`,
      sourceId: "beyblade_x_lineup",
      franchise: "beyblade",
      title,
      status: "product_confirmed",
      announcedAt: today,
      announcedAtBasis: "first_seen",
      sourceName: "BEYBLADE X",
      sourceUrl: absoluteUrl(href, pageUrl),
      thumbnailUrl: absoluteUrl(/<img\b[^>]*src="([^"]+)"/.exec(block)?.[1], pageUrl),
      notes: `${release[1]}年${release[2]}月${release[3]}日発売 (official lineup). Announcement date = first seen by the bot.`,
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------

export function parseTakaraTomyPokemonNews(html, pageUrl = TAKARATOMY_POKEMON_URL) {
  const box = /<div class="new_box">([\s\S]*?)<\/div>\s*<\/div>|<div class="new_box">([\s\S]*)/.exec(String(html || ""));
  const section = box ? box[1] || box[2] : "";
  const records = [];
  for (const match of section.matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)) {
    const [, href, block] = match;
    const date = /(\d{4})\.(\d{1,2})\.(\d{1,2})\s*更新/.exec(block);
    const text = stripTags(String(/<p>([\s\S]*?)<\/p>/.exec(block)?.[1] || "").replace(/<br\s*\/?>/gi, " "));
    if (!date || !text) continue;
    // "12月発売予定 つづくピカチュウ" → "つづくピカチュウ（12月発売予定）"
    const due = /^(\d{1,2}月(?:[上中下]旬)?発売予定)\s*(.+)$/.exec(text);
    const title = due ? `${due[2]}（${due[1]}）` : text;
    if (/POP-?UP|開催|イベント/.test(title)) continue;
    const iso = `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`;
    records.push(announcementRecord({
      id: `takaratomy-pokemon-${iso}-${hashTail(href)}`,
      sourceId: "takaratomy_pokemon",
      franchise: "pokemon",
      title,
      status: "product_confirmed",
      announcedAt: iso,
      sourceName: "タカラトミー ポケモン",
      sourceUrl: absoluteUrl(href, pageUrl),
      thumbnailUrl: absoluteUrl(/<img\b[^>]*src="([^"]+)"/.exec(block)?.[1], pageUrl),
    }));
  }
  return records;
}

export function parseFriendaTopics(html, pageUrl = POKEMON_FRIENDA_URL) {
  const records = [];
  const seen = new Set();
  for (const block of String(html || "").split(/<article class="topics__item/).slice(1)) {
    const article = block.split("</article>")[0];
    const href = /<a[^>]*href="([^"]+)"/.exec(article)?.[1];
    const date = /<time datetime="(\d{4}-\d{2}-\d{2})"/.exec(article)?.[1];
    const title = stripTags(String(/<p class="topics__txt">([\s\S]*?)<time/.exec(article)?.[1] || ""));
    if (!href || !date || !title || !isProductAnnouncement(title)) continue;
    const id = `frienda-${date}-${hashTail(`${href}|${title}`)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const image = /<img\b[^>]*src="([^"]+)"/.exec(article)?.[1];
    records.push(announcementRecord({
      id,
      sourceId: "pokemon_frienda",
      franchise: "pokemon",
      title,
      announcedAt: date,
      sourceName: "ポケモンフレンダ",
      sourceUrl: absoluteUrl(href, pageUrl),
      thumbnailUrl: absoluteUrl(image, pageUrl),
    }));
  }
  return records;
}

// ---------------------------------------------------------------------------
// Kotobukiya shop title pages list goods newest-release first, with name and
// image but no dates; the goods page has 発売月 and whether preorders are open.

export function parseKotobukiyaTitleGoods(html, pageUrl = KOTOBUKIYA_SHOP_BASE) {
  const goods = [];
  const seen = new Set();
  // Only the goods grid (<li class="tile_item">); the page header also links
  // ranking and "new arrivals" goods from every title.
  const grid = String(html || "").split(/<ul class="cat_goods/).slice(1).join("");
  for (const match of grid.matchAll(/<a[^>]*href="((?:https:\/\/shop\.kotobukiya\.co\.jp)?\/shop\/g\/g(\d+)\/)"([^>]*)>([\s\S]*?)<\/a>/g)) {
    const [, href, code, attributes, inner] = match;
    if (seen.has(code)) continue;
    const name = decodeHtml(/title="([^"]+)"/.exec(attributes)?.[1])
      || stripTags(/<div class="name">([\s\S]*?)<\/div>/.exec(inner)?.[1])
      || decodeHtml(/alt="([^"]+)"/.exec(inner)?.[1]);
    const image = /<img[^>]+data-original="([^"]+)"/.exec(inner)?.[1] || /<img[^>]+src="([^"]+)"/.exec(inner)?.[1];
    if (!name) continue;
    seen.add(code);
    goods.push({ code, url: absoluteUrl(href, pageUrl), name: name || null, image: absoluteUrl(image, pageUrl) });
  }
  return goods;
}

export function kotobukiyaAnnouncement({ title: titleInfo, goods, detail, detailHtml, today }) {
  // The goods page <h1> repeats the name with a subtitle in brackets; the
  // listing's title attribute is the clean name.
  const name = goods.name || detail?.title;
  if (!name) return null;
  const release = detail?.release_date || null;
  // Only upcoming products are announcements; the rest is the catalog's job.
  if (!release || release.slice(0, 7) < today.slice(0, 7)) return null;
  const preorder = /予約受付中|予約する/.test(String(detailHtml || ""));
  const [year, month, day] = release.split("-");
  return announcementRecord({
    id: `kotobukiya-${goods.code}`,
    sourceId: "kotobukiya_shop",
    franchise: titleInfo.franchise,
    title: name,
    status: preorder ? "preorder_open" : "product_confirmed",
    announcedAt: today,
    announcedAtBasis: "first_seen",
    sourceName: "コトブキヤショップ",
    sourceUrl: goods.url,
    thumbnailUrl: detail?.gallery?.[0] || goods.image || null,
    notes: `${year}年${Number(month)}月${day ? `${Number(day)}日` : ""}発売予定 (${titleInfo.label}). Announcement date = first seen by the bot.`,
  });
}

// ---------------------------------------------------------------------------
// Cross-source dedupe. The same reveal shows up on several official sites:
// 魂ウェブ's post is also a card on the Bandai Spirits topics page (same URL),
// and gundam-official.com rewrites it in its own words. Records sharing a URL
// are the same post; records in the same world naming the same 「product」
// within ten days are the same reveal. The earlier source in `priority` wins,
// but a record someone reviewed or linked in the CMS is never dropped.

function normalizeProductKey(value) {
  return decodeFullWidthDigits(String(value || ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・･·\-‐－—_/／()（）［］\[\]【】「」『』"'”“!！?？.,、。:：]/g, "");
}

export function productKeys(title) {
  const keys = [];
  for (const match of String(title || "").matchAll(/「([^」]{3,})」/g)) keys.push(normalizeProductKey(match[1]));
  // Short keys ("ガンプラ") are words, not product names.
  return keys.filter((key) => key.length >= 6);
}

function daysBetween(a, b) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 86400000);
}

export function dedupeAnnouncements(records, priority = []) {
  const rank = (record) => {
    if (record.reviewed_at || record.linked_kit_id) return -1;
    const byId = priority.indexOf(record.source_id);
    if (byId >= 0) return byId;
    const byName = priority.indexOf(record.source_name);
    return byName >= 0 ? byName : priority.length;
  };
  const sorted = [...records].sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));
  const kept = [];
  const byUrl = new Map();
  const byKey = new Map();
  const dropped = [];
  // Both checks also need the dates to be close: 魂ウェブ links a resale post
  // to the same item page as the original reveal months earlier, and that
  // is news of its own. The query string stays in the URL (YouTube's ?v=…).
  // Only across sites: one site's two posts about one product (reveal, then
  // preorder) are both news, so twins must differ in source_name.
  const near = (record) => (twin) =>
    twin.source_name !== record.source_name && daysBetween(twin.announced_at, record.announced_at) <= 10;
  const remember = (map, key, record) => map.set(key, [...(map.get(key) || []), record]);
  for (const record of sorted) {
    const url = String(record.source_url || "").replace(/#.*$/, "").replace(/\/$/, "");
    const keys = productKeys(record.names?.ja).map((key) => `${record.franchise}|${key}`);
    const twin = (url ? byUrl.get(url) || [] : []).find(near(record))
      || keys.flatMap((key) => byKey.get(key) || []).find(near(record));
    if (twin && !(record.reviewed_at || record.linked_kit_id)) {
      dropped.push({ id: record.id, kept: twin.id });
      continue;
    }
    kept.push(record);
    if (url) remember(byUrl, url, record);
    for (const key of keys) remember(byKey, key, record);
  }
  kept.sort((a, b) =>
    String(b.announced_at || "").localeCompare(String(a.announced_at || ""))
    || String(a.id).localeCompare(String(b.id)));
  return { records: kept, dropped };
}
