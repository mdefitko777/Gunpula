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
//   tamashiiweb.com/topics/items/  ok   same markup as /topics/, paged by current_page
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
//   tamashiiweb.com work pages     ok   (2026-11-12) reveal banners in the key-visual slider
//   pokemonkorea.co.kr/goods       ok   (2026-11-14) no robots.txt (its home page answers); goods banners
import { createHash } from "node:crypto";
import {
  BANDAI_HOBBY_YOUTUBE_CHANNEL_ID,
  absoluteUrl,
  decodeHtml,
  franchiseForAnnouncement,
  isGundamBaseProductNews,
  isProductAnnouncement,
  japaneseDate,
  shiftDay,
  stripTags,
} from "./bandai-announcements.mjs";
import { applyPreorder, japanDayOf, japanInstant, nearestYearDay, preorderCandidate } from "./preorder-times.mjs";

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
export const POKEMON_KOREA_GOODS_URL = "https://pokemonkorea.co.kr/goods";
export const POKEMON_KOREA_GOODS_SOURCE_ID = "pokemon_korea_goods";
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

// The channels read for product videos, one source each; a record's id is
// <idPrefix>-<videoId>. BANDAI SPIRITS covers every Bandai line, so it has no
// default franchise: the title has to name one of the app's worlds.
export const YOUTUBE_CHANNELS = [
  {
    id: "bandai_hobby_youtube",
    name: "BANDAI Hobby Site YouTube",
    channelId: BANDAI_HOBBY_YOUTUBE_CHANNEL_ID,
    idPrefix: "bandai-youtube",
    defaultFranchise: null,
  },
  {
    id: "gundam_channel_youtube",
    name: "ガンダムチャンネル YouTube",
    channelId: "UC7wu64jFsV02bbu6UHUd7JA",
    idPrefix: "youtube",
    defaultFranchise: "gundam",
  },
  {
    id: "gundam_base_youtube",
    name: "THE GUNDAM BASE YouTube",
    channelId: "UCMt6mbBNDPwyNGvJKvhCYuA",
    idPrefix: "youtube",
    defaultFranchise: "gundam",
    accept: /限定品情報/,
  },
  {
    id: "beyblade_youtube",
    name: "ベイチューブ YouTube",
    channelId: "UCuG_D_8QZmHTfbJfsz8-J_A",
    idPrefix: "youtube",
    defaultFranchise: "beyblade",
  },
];

/**
 * The fetcher's per-run stop list: a host that answered 403/429/503 (blocked,
 * slow down, maintenance) gets no further request this run, from any source.
 * `record(url, status)` after a response; `stop(url, what)` for a bot-check or
 * consent page that came with a 200; `check(url)` throws for a stopped host.
 */
export function createHostStops(statuses = [403, 429, 503]) {
  const stopped = new Map();
  return {
    record(url, status) {
      if (statuses.includes(status)) stopped.set(new URL(url).host, status);
    },
    stop(url, what) {
      stopped.set(new URL(url).host, what);
    },
    check(url) {
      const host = new URL(url).host;
      if (stopped.has(host)) throw new Error(`${host} answered ${stopped.get(host)} earlier; stopped for this run`);
    },
  };
}

/**
 * The sources of a light run (ANNOUNCEMENT_LIGHT=1, refresh-announcements.yml):
 * the makers' own news lists, about 35 requests (robots.txt included) and 30 s. In the
 * posts of 2026-10-09..11-13, 90 of 118 timed preorders were announced on the day they
 * opened (69 GUNDAM.INFO, 17 Premium Bandai, 4 魂ウェブ), most of them between
 * 10:00 and 19:00 JST. Left for the daily run: コトブキヤショップ and the BEYBLADE X
 * lineup (release dates, not preorder posts), CoroCoro and the fan and media
 * sites (scoops days ahead), YouTube and the event site.
 */
export const LIGHT_SOURCE_IDS = [
  "tamashii_news",
  "tamashii_topics_items",
  "tamashii_reveals",
  "tamashii_schedule",
  "bandai_hobby_news",
  "bandai_spirits_topics",
  "beyblade_x_news",
  "takaratomy_pokemon",
  "pokemon_frienda",
  "gundam_base_news",
  "gundam_official_news",
  "premium_bandai_new_items",
];

/**
 * fetch_errors after a run of only some sources (`onlySources`, a Set): the other
 * sources' last errors stay, this run's replace those of the sources it read. The
 * product-text step ("announcement_details") runs every time, so its old error goes
 * too; kept, every failing light run (eight a day) added one more copy of it.
 */
export function carryFetchErrors(previousErrors, errors, onlySources) {
  if (!onlySources.size) return errors;
  const ranThisRun = (id) => onlySources.has(id) || id === "announcement_details";
  return [...(previousErrors || []).filter((error) => !ranThisRun(error.source_id)), ...errors];
}

/**
 * announcements.json as written: `next` with the previous `updated_at` when
 * nothing else changed, else with `now`. A fresh stamp on every run made each
 * run a commit, a site publish and a new file hash, so the app downloaded the
 * same announcements again (with light runs, eight times a day).
 */
export function stampAnnouncements(previous, next, now) {
  const { updated_at: previousStamp, ...before } = previous || {};
  const unchanged = Boolean(previousStamp) && JSON.stringify(before) === JSON.stringify(next);
  return { updated_at: unchanged ? previousStamp : now, ...next };
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

export function balancedObjectAfter(text, key) {
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
    // displayDatetime is UTC ("2026-11-12T01:45:00.000Z" = 10:45 in Japan); the
    // day is Japan's, which 「本日11時より」 in the title refers to.
    const posted = Date.parse(news.displayDatetime || "");
    const date = Number.isFinite(posted) ? japanDayOf(new Date(posted)) : String(news.displayDatetime || "").slice(0, 10);
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
    // "開始：11/13 12時": the hour was dropped until 2026-11-14; every one of the
    // 440 listings that day had it, none had minutes.
    const start = /開始：\s*(\d{1,2})\/(\d{1,2})(?:\s*(\d{1,2})時(?:(\d{1,2})分)?)?/.exec(block);
    if (!itemId || !listed || !start) continue;
    // The page shows no year; listings are at most a few weeks old.
    const date = nearestYearDay(Number(start[1]), Number(start[2]), japanDayOf(now));
    if (!date) continue;
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
    const preorder = /予約|抽選/.test(badge) || /予約|抽選/.test(title);
    const record = announcementRecord({
      id: `pbandai-${itemId}`,
      sourceId: "premium_bandai_new_items",
      franchise,
      title,
      status: preorder ? "preorder_open" : "product_confirmed",
      announcedAt: date,
      sourceName: "プレミアムバンダイ",
      sourceUrl: `https://p-bandai.jp/item/item-${itemId}/`,
      thumbnailUrl: absoluteUrl(image, "https://p-bandai.jp/"),
      notes: fullTitle ? null : "Name truncated by the Premium Bandai new-items list.",
    });
    // 開始 is when the preorder opened only for a 予約 / 抽選 listing; for the
    // others it is when the item went on sale (pbandai-1000261240 PG ユニコーン, 8時).
    if (preorder) {
      const hour = start[3] == null ? null : Number(start[3]);
      const minute = Number(start[4] || 0);
      const at = hour != null && hour <= 23 && minute <= 59 ? japanInstant(date, hour, minute) : null;
      Object.assign(record, { ...(at ? { preorder_at: at } : {}), preorder_date: date, preorder_basis: "store_list" });
    }
    records.push(record);
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
// 포켓몬코리아 (pokemonkorea.co.kr/goods, read 2026-11-14): the slider at the top carries
// the Korean goods news (CU × Pokopia, Pokopia 몬콜레, LEGO 포켓몬, FC서울 collaboration …),
// each a title, a picture and a link to whoever sells it. The slides have no date; the
// picture's upload path has one (/s3.php?key=…newdata/2026/10/2026-10-07_18-26-33-….jpg).
// The licensee list further down stopped in 2024-11 and 「새로운 소식」 lists Kakao
// emoticons, so neither is read. The links (Instagram, Naver smartstore, Kyobo …) are
// kept for the app and never fetched.

// Emoticons and other digital releases are not goods.
const POKEMON_KOREA_NOT_GOODS = /이모티콘|모바일 ?게임|애니메이션 방영|극장판/;

function koreanStatus(title) {
  if (/예약|사전 ?판매/.test(title)) return "preorder_open";
  if (/출시|발매|만나보세요|판매/.test(title)) return "released";
  return "product_confirmed";
}

/** The upload day in a pokemonkorea.co.kr picture URL, or null. */
export function pokemonKoreaImageDate(url) {
  let key = String(url || "");
  try {
    key = decodeURIComponent(key);
  } catch {
    // keep the raw form
  }
  return /newdata\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})_/.exec(key)?.[1] || null;
}

export function parsePokemonKoreaGoodsBanners(html, { pageUrl = POKEMON_KOREA_GOODS_URL, today } = {}) {
  const slider = /<section class="sect-visual[\s\S]*?<\/section>/.exec(String(html || ""))?.[0] || "";
  const slides = slider.split(/<div class="swiper-slide">/).slice(1);
  const records = [];
  const seen = new Set();
  for (const slide of slides) {
    const title = stripTags(String(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(slide)?.[1] || ""));
    const href = /<a\s[^>]*href="([^"]+)"/.exec(slide)?.[1]?.trim();
    const image = /<img\b[^>]*src="([^"]+)"/.exec(slide)?.[1];
    if (!title || POKEMON_KOREA_NOT_GOODS.test(title)) continue;
    const uploaded = pokemonKoreaImageDate(image);
    const announcedAt = uploaded || today;
    if (!announcedAt) continue;
    // By title, so a banner whose picture is replaced stays one record.
    const id = `pokemonkorea-goods-${stableHash(title)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const record = announcementRecord({
      id,
      sourceId: POKEMON_KOREA_GOODS_SOURCE_ID,
      franchise: "pokemon",
      title,
      status: koreanStatus(title),
      announcedAt,
      ...(uploaded ? {} : { announcedAtBasis: "first_seen" }),
      sourceName: "포켓몬코리아",
      sourceUrl: absoluteUrl(href, pageUrl) || pageUrl,
      thumbnailUrl: absoluteUrl(image, pageUrl),
      notes: "Banner on pokemonkorea.co.kr/goods; the date is the day its picture was uploaded.",
    });
    // A Korean title: the app shows names.ko first; names.ja keeps the title for the
    // dedupe keys, as on the 포켓몬스토어 records.
    records.push({ ...record, names: { ja: title, zh: null, ko: title, en: null } });
  }
  return { records, slides: slides.length };
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
// `separate(a, b)` names pairs that are not twins whatever they share (see
// keepsApart in unofficial-feeds.mjs). A record that stays without a picture
// takes its dropped twin's (the 魂ウェブ reveal banner has one before the topic
// post may), but never an unofficial site's: those are not copied into the
// repo (owner's decision, 2026-11-13).

export function normalizeProductKey(value) {
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

// A link made by matching the source page (linkSourcePageKits) says which
// product a post is about, not that someone chose this record, so it does not
// shield a twin from the dedupe.
function pinnedRecord(record) {
  return Boolean(record.reviewed_at || (record.linked_kit_id && record.linked_kit_basis !== SOURCE_PAGE_LINK));
}

export function dedupeAnnouncements(records, priority = [], { separate = () => false } = {}) {
  const rank = (record) => {
    if (pinnedRecord(record)) return -1;
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
  // preorder) are both news, so twins must differ in source_name. A 魂ウェブ
  // reveal banner linking an item page its topic post also links is that post
  // again, though both say TAMASHII WEB.
  const isReveal = (record) => record.source_id === TAMASHII_REVEALS_SOURCE_ID;
  const near = (record) => (twin) =>
    (twin.source_name !== record.source_name || isReveal(twin) !== isReveal(record))
    && daysBetween(twin.announced_at, record.announced_at) <= 10
    && !separate(record, twin);
  const remember = (map, key, record) => map.set(key, [...(map.get(key) || []), record]);
  const pictures = new Map();
  for (const record of sorted) {
    // A scheduled stream is not a product reveal: its title quotes the event
    // ("「TAMASHII NATION 2026」…") like every news post about that event does,
    // and it must neither be dropped as their twin nor drop them.
    if (record.live_state) {
      kept.push(record);
      continue;
    }
    const url = String(record.source_url || "").replace(/#.*$/, "").replace(/\/$/, "");
    const keys = productKeys(record.names?.ja).map((key) => `${record.franchise}|${key}`);
    const twin = (url ? byUrl.get(url) || [] : []).find(near(record))
      || keys.flatMap((key) => byKey.get(key) || []).find(near(record));
    if (twin && !pinnedRecord(record)) {
      dropped.push({ id: record.id, kept: twin.id });
      if (!twin.thumbnail_url && record.thumbnail_url && !record.unofficial && !pictures.has(twin.id)) {
        pictures.set(twin.id, record.thumbnail_url);
      }
      continue;
    }
    kept.push(record);
    if (url) remember(byUrl, url, record);
    for (const key of keys) remember(byKey, key, record);
  }
  const out = kept.map((record) => pictures.has(record.id) ? { ...record, thumbnail_url: pictures.get(record.id) } : record);
  out.sort((a, b) =>
    String(b.announced_at || "").localeCompare(String(a.announced_at || ""))
    || String(a.id).localeCompare(String(b.id)));
  return { records: out, dropped };
}

// ---------------------------------------------------------------------------
// Replaced records. The app keeps follows (알림 받는 예고) by announcement id, so
// a record dropped as another one's twin took its followers with it
// (2026-11-13: the 魂ウェブ reveal of METAL BUILD ガンダムキュリオス, dropped as the
// twin of its preorder post). data/announcements.json says where each one
// went: "replaced" (dropped id → id that stays) and "replaced_at" (the day).

export const REPLACED_KEEP_DAYS = 120;

/**
 * This run's { replaced, replaced_at }. `replaced` / `replacedAt`: last run's
 * maps; `drops`: this run's [{ id, kept }] from the dedupe steps (a drop
 * without `kept`, a scoop the catalog took over, has nowhere to point);
 * `publishedIds`: the ids of last run's file, as a record first seen and
 * dropped on the same run was never shown and nobody follows it; `keptIds`: the
 * ids written this run. Chains collapse (a → b and b → c give a → c, also
 * through a record that was never published), and an entry goes once it is
 * older than REPLACED_KEEP_DAYS, when its own record is back, or when the
 * record it would point at is gone.
 */
export function carryReplaced({ replaced = {}, replacedAt = {}, drops = [], publishedIds = new Set(), keptIds = new Set(), today }) {
  const since = shiftDay(today, -REPLACED_KEEP_DAYS);
  const entries = new Map();
  for (const [id, target] of Object.entries(replaced || {})) {
    const day = (replacedAt || {})[id] || today;
    if (day >= since) entries.set(id, { target, day });
  }
  const next = new Map([...entries].map(([id, { target }]) => [id, target]));
  for (const { id, kept } of drops) {
    if (!kept || kept === id) continue;
    next.set(id, kept);
    if (publishedIds.has(id)) entries.set(id, { target: kept, day: today });
  }
  const resolve = (id) => {
    const seen = new Set([id]);
    let target = next.get(id);
    while (!keptIds.has(target) && next.has(target) && !seen.has(target)) {
      seen.add(target);
      target = next.get(target);
    }
    return target;
  };
  const out = { replaced: {}, replaced_at: {} };
  for (const [id, { day }] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    const target = resolve(id);
    if (keptIds.has(id) || !keptIds.has(target)) continue;
    out.replaced[id] = target;
    out.replaced_at[id] = day;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 魂ウェブ reveal banners. A 商品化決定 reveal (TAMASHII NATION, the TAMASHII NEWS
// NETWORK livestream) gets no topic post and no item page until its preorder
// opens; until then it exists only as a slide in the key-visual slider of the
// work's page. On 2026-11-12 "【機動戦士ガンダム00】「ガンダムキュリオス」が
// METAL BUILDより商品化決定！" was on /item_character/gundam_series/ (and the
// METAL BUILD brand page) and nowhere else on the site; not on the top page,
// /topics/, the TAMASHII NATION 2026 event site or gundam-official.com. The
// other slides link item pages, which the topic sources already cover.

export const TAMASHII_REVEALS_SOURCE_ID = "tamashii_reveals";
export const TAMASHII_REVEAL_PAGES = [
  { url: "https://tamashiiweb.com/item_character/gundam_series/", franchise: "gundam" },
];
const REVEAL_WORDING = /商品化(?:が)?決定|開発(?:が)?決定/;
// The brand stands after が ("…」がMETAL BUILDより商品化決定") or in front of the
// quote ("METAL BUILD「…」商品化決定").
const BRAND_AFTER_QUOTE = /」\s*(?:が|も)\s*([^「」【】]{2,40}?)\s*(?:より|から|にて|で|に|として)/;
// Reveals are made at an event or on a livestream, and banners may say so
// ("「TAMASHII NATION 2026」にて「…」が…", "TNNにて…"); those words are where,
// not what or which brand.
const NOT_A_BRAND = /TAMASHII\s*NATIONS?|TNN|NEWS\s*NETWORK|イベント|会場|配信|生放送|[にでがはをのと、。!！]$/i;
// A quote is a product when the sentence goes on with it: が/も, a list
// separator, the next quote, or the reveal itself. "「イベント名」にて" is not.
const PRODUCT_QUOTE_FOLLOWER = /^\s*(?:が|も|と|、|・|「|の?(?:商品化|開発)|[!！]*$)/;
// Without a quote the text before 商品化決定 is the name, unless it is a
// round-up ("ガンダムシリーズ新商品の商品化決定").
const NOT_A_NAME = /新商品|新作|続々|ラインナップ|情報|アイテム|多数/;

/** "【機動戦士ガンダム00】「ガンダムキュリオス」がMETAL BUILDより商品化決定！" → ["METAL BUILD ガンダムキュリオス"]. */
export function revealProductNames(title) {
  const text = stripTags(String(title || "").replace(/<br\s*\/?>/gi, " "));
  if (!REVEAL_WORDING.test(text)) return [];
  // 【…】 holds the work, or sometimes the brand; the work is not part of a name.
  const body = text.replace(/【[^】]*】/g, " ").trim();
  const quoted = [...body.matchAll(/「([^」]+)」/g)]
    .filter((match) => PRODUCT_QUOTE_FOLLOWER.test(body.slice(match.index + match[0].length)))
    .map((match) => match[1].trim())
    .filter(Boolean);
  if (!body.includes("「")) {
    const name = body.split(REVEAL_WORDING)[0].replace(/[!！\s]+$/, "").replace(/[のがも]$/, "").trim();
    return name && !NOT_A_NAME.test(name) && !NOT_A_BRAND.test(name) ? [name] : [];
  }
  const after = BRAND_AFTER_QUOTE.exec(body)?.[1]?.trim();
  const before = body.slice(0, body.indexOf("「")).trim().replace(/の$/, "");
  const brand = [after, before].find((candidate) => candidate && !REVEAL_WORDING.test(candidate) && !NOT_A_BRAND.test(candidate)) || "";
  return quoted.map((name) =>
    !brand || normalizeProductKey(name).startsWith(normalizeProductKey(brand)) ? name : `${brand} ${name}`);
}

export function stableHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

/**
 * One record per product a reveal slide names, dated by when the bot first saw
 * it (the slide has no date). `slides` counts every slide, so the fetcher can
 * tell an empty day from a page whose markup changed.
 */
export function parseTamashiiRevealBanners(html, { pageUrl, franchise = null, today }) {
  const records = [];
  const blocks = String(html || "").split(/<li class="swiper-slide kvSlide__item/).slice(1);
  for (const chunk of blocks) {
    const block = chunk.split("</li>")[0];
    const title = stripTags(String(/<span class="kvSlide__name">([\s\S]*?)<\/span>/.exec(block)?.[1] || "").replace(/<br\s*\/?>/gi, " "));
    const href = /<a\s+href="([^"]+)"/.exec(block)?.[1];
    const recordFranchise = franchiseForAnnouncement(title, franchise);
    if (!href || !recordFranchise) continue;
    for (const name of revealProductNames(title)) {
      records.push(announcementRecord({
        // By name, so the same reveal on another day (or on another page) is
        // one record.
        id: `tamashii-reveal-${stableHash(normalizeProductKey(name))}`,
        sourceId: TAMASHII_REVEALS_SOURCE_ID,
        franchise: recordFranchise,
        title: name,
        status: "product_confirmed", // the banner says 商品化決定 — same stage the news rules give 商品化 titles
        announcedAt: today,
        announcedAtBasis: "first_seen",
        sourceName: "TAMASHII WEB",
        sourceUrl: absoluteUrl(href, pageUrl),
        // The phone-size banner (1578×888); the desktop one is the same picture, larger.
        thumbnailUrl: absoluteUrl(/<img\b[^>]*src="([^"]+)"/.exec(block)?.[1], pageUrl),
        notes: `魂ウェブ banner: ${title} Announcement date = first seen by the bot.`,
      }));
    }
  }
  const seen = new Set();
  return { records: records.filter((record) => !seen.has(record.id) && seen.add(record.id)), slides: blocks.length };
}

const STAGES = ["announced", "product_confirmed", "preorder_open", "released"];

// Does an official record's title name the revealed product? Its 「…」 or its
// whole title equals the reveal's name, or equals the name without the brand
// while the brand is elsewhere in the title ("「ガンダムキュリオス」がMETAL
// BUILDに登場！…予約受付開始！").
export function namesRevealedProduct(record, revealKey) {
  const title = normalizeProductKey(record.names?.ja);
  const keys = [...productKeys(record.names?.ja), title];
  return keys.some((key) => key === revealKey
    || (key.length >= 4 && revealKey.endsWith(key) && title.includes(revealKey.slice(0, revealKey.length - key.length))));
}

/**
 * Moves a reveal forward when an official post about the same product follows
 * it (its preorder opening → preorder_open), so people following the reveal in
 * the app get the stage change, and the reveal takes the post's preorder time
 * when it has none. The merge keeps a stored status, so this only ever moves
 * forward. Records reviewed in the CMS are left alone.
 */
export function promoteRevealStages(records) {
  const others = records.filter((record) => record.source_id !== TAMASHII_REVEALS_SOURCE_ID && record.confidence === "official");
  const promoted = [];
  const out = records.map((record) => {
    if (record.source_id !== TAMASHII_REVEALS_SOURCE_ID || record.reviewed_at) return record;
    const key = normalizeProductKey(record.names?.ja);
    // The reveal is dated by first sight; allow a week for a missed run.
    const since = new Date(Date.parse(`${record.announced_at}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);
    const tellers = others
      .filter((other) => other.franchise === record.franchise && String(other.announced_at || "") >= since)
      .filter((other) => namesRevealedProduct(other, key));
    // A clock first (the topic post's 「18時より」), then a day.
    const timed = tellers.find((other) => other.preorder_at) || tellers.find((other) => other.preorder_date);
    const next = timed ? applyPreorder(record, preorderCandidate(timed), { fillOnly: true }) : record;
    const best = tellers
      .map((other) => other.status)
      .filter((status) => STAGES.indexOf(status) > STAGES.indexOf(record.status))
      .sort((a, b) => STAGES.indexOf(b) - STAGES.indexOf(a))[0];
    if (!best) return next;
    promoted.push({ id: record.id, from: record.status, to: best });
    return { ...next, status: best };
  });
  return { records: out, promoted };
}

/**
 * Moves a record forward when its own source now reports a later stage (the
 * 魂ウェブ schedule once the preorder opens, fig速's 【予約開始】 after
 * 【近日予約開始】). The merge keeps a stored status, so without this a listing
 * could never report the next stage; never backwards, and never a record
 * reviewed in the CMS. `incoming`: this run's records of those sources.
 */
export function advanceStages(records, incoming) {
  const reported = new Map(incoming.map((record) => [record.id, record.status]));
  const advanced = [];
  const out = records.map((record) => {
    const status = reported.get(record.id);
    if (record.reviewed_at || STAGES.indexOf(status) <= STAGES.indexOf(record.status)) return record;
    advanced.push({ id: record.id, from: record.status, to: status });
    return { ...record, status };
  });
  return { records: out, advanced };
}

/**
 * Links a reveal to its catalog product once the catalog has it: 魂ウェブ kits
 * carry the brand in `subline` and the bare name in names.ja. Released kits are
 * skipped (an old METAL BUILD with the same name is not this reveal).
 * `kitsByFranchise`: Map franchise → kits.
 */
export function linkRevealKits(records, kitsByFranchise = new Map()) {
  return records.map((record) => {
    if (record.source_id !== TAMASHII_REVEALS_SOURCE_ID || record.linked_kit_id) return record;
    const key = normalizeProductKey(record.names?.ja);
    const month = String(record.announced_at || "").slice(0, 7);
    const kit = (kitsByFranchise.get(record.franchise) || []).find((candidate) => {
      const name = normalizeProductKey(candidate.names?.ja);
      const full = normalizeProductKey(`${candidate.subline || ""}${candidate.names?.ja || ""}`);
      const release = String(candidate.release_date || "");
      return name && (full === key || name === key) && (!release || release.slice(0, 7) >= month);
    });
    return kit ? { ...record, linked_kit_id: kit.kit_id } : record;
  });
}

// linked_kit_basis of a link made by linkSourcePageKits.
export const SOURCE_PAGE_LINK = "source_page";

function pageKey(url) {
  return String(url || "").trim().replace(/^http:/, "https:").replace(/#.*$/, "").replace(/\/$/, "");
}

/**
 * Links an announcement to the catalog product whose own page it is: the same
 * 魂ウェブ item page, Premium Bandai item, コトブキヤショップ goods page (its JAN)
 * or lineup page in the kit's source_urls, or a 魂ウェブ item id that is the kit's
 * ("tamashii-16258"). On 2026-11-13 only 6 of 421 records were linked and 65
 * pointed at a kit's own page; the app fills the gallery, price and its
 * 「이 예고의 상품」 from the link. No request, no guess by name: unofficial
 * sites and streams are left alone. `kits`: every catalog kit.
 */
export function linkSourcePageKits(records, kits = []) {
  const byPage = new Map();
  for (const kit of kits) {
    for (const url of kit.source_urls || []) {
      const key = pageKey(url);
      // A page two kits share (a list, a brand page) names neither.
      if (key) byPage.set(key, byPage.has(key) && byPage.get(key) !== kit.kit_id ? null : kit.kit_id);
    }
  }
  const byTamashiiItem = new Map();
  for (const kit of kits) {
    const itemId = /^tamashii-(?:[a-z_]+-)?(\d+)$/.exec(kit.kit_id || "")?.[1];
    if (itemId) byTamashiiItem.set(itemId, kit.kit_id);
  }
  const linked = [];
  const out = records.map((record) => {
    if (record.linked_kit_id || record.unofficial || record.confidence === "unofficial" || record.live_state) return record;
    const page = pageKey(record.source_url);
    const itemId = /^https:\/\/tamashiiweb\.com\/item\/(\d+)$/.exec(page)?.[1];
    const kitId = byPage.get(page) || (itemId && byTamashiiItem.get(itemId)) || null;
    if (!kitId) return record;
    linked.push({ id: record.id, kit_id: kitId });
    return { ...record, linked_kit_id: kitId, linked_kit_basis: SOURCE_PAGE_LINK };
  });
  return { records: out, linked };
}
