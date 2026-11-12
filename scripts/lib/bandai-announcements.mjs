export const BANDAI_HOBBY_NEWS_URL =
  "https://www.bandaispirits.co.jp/products/topics/?category=1";
export const BANDAI_HOBBY_YOUTUBE_CHANNEL_ID = "UCuxB1suCoCqAKiljh_0xE4A";
export const BANDAI_HOBBY_YOUTUBE_FEED_URL =
  `https://www.youtube.com/feeds/videos.xml?channel_id=${BANDAI_HOBBY_YOUTUBE_CHANNEL_ID}`;
// /news/ answers 301 to http://tamashiiweb.com/topics/ (2026-11-12), the same list
// and markup, so /topics/ is read directly instead of through an http hop.
export const TAMASHII_NEWS_URL = "https://tamashiiweb.com/topics/";
export const BEYBLADE_X_NEWS_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/news/";

export function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    // Gundam names carry Greek letters as entities ("RX-93 &nu;ガンダム").
    .replace(/&nu;/g, "ν")
    .replace(/&times;/g, "×")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

export function absoluteUrl(value, base) {
  if (!String(value || "").trim()) return null;
  try {
    return new URL(decodeHtml(value), base).href;
  } catch {
    return null;
  }
}

export function japaneseDate(value) {
  const match = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(stripTags(value));
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : null;
}

// Which of the app's five worlds an announcement belongs to. Multi-IP feeds
// (the YouTube channel, 魂ウェブ) carry every Bandai line, so the work has to
// come from the title; single-IP feeds pass a defaultFranchise instead.
const FRANCHISE_PATTERNS = [
  // "HOBBY NEW ITEM INFO." / "NEXT PHASE" are Bandai's Gunpla reveal programs;
  // their titles never say ガンダム but that is exactly what they announce.
  [
    "gundam",
    /ガンプラ|GUNPLA|ガンダム|GUNDAM|ジオン|ザク|SDW\s*HEROES|ガンダムベース|HOBBY\s*(?:NEW ITEM INFO|NEXT PHASE)|新作プラモデル/i,
  ],
  // ポケピース / モンコレ / メザスタ / フレンダ are Pokémon-only lines whose
  // product names often skip the word ポケモン.
  ["pokemon", /ポケモン|ポケプラ|POKEMON|POK[EÉ]MON|ピカチュウ|ポケピース|モンコレ|メザスタ|フレンダ/i],
  ["fate", /Fate|フェイト|FGO|TYPE[-\s]?MOON|型月|月姫|空の境界|魔法使いの夜/i],
  ["beyblade", /ベイブレード|BEYBLADE|ベイバトル/i],
  ["armored_core", /アーマード[・\s]?コア|ARMORED\s*CORE/i],
];

export function franchiseForAnnouncement(title, defaultFranchise = null) {
  for (const [franchise, pattern] of FRANCHISE_PATTERNS) {
    if (pattern.test(title)) return franchise;
  }
  return defaultFranchise;
}

// Surveys, store events and tie-in campaigns are not product news, and they
// are the bulk of what these feeds publish. Exclusions win over inclusions:
// "『水星の魔女』×ガンプラキャンペーン ... 開始！" reads like a reveal but is a
// campaign.
// App tie-ins ("スマホアプリ「デジフィグ」に…が登場"), apologies/corrections and
// price revisions read like product posts but announce nothing new to collect.
const NOT_PRODUCT_NEWS =
  /アンケート|キャンペーン|POP-?UP|開催|展示会|イベント|大会|抽選|試遊|来場|スマホアプリ|スマートフォンアプリ|アプリ「|お詫び|誤記|価格改定|排出終了|非純正/i;
// 決定 only counts when it resolves a product verb. On its own it also covers
// "ふるさと納税返礼品に決定" and "スタジアムの先行貸出しが決定" — announcements
// about a tax-gift listing and a karaoke-chain rental, not about merchandise.
const PRODUCT_NEWS =
  /商品化|新商品|新作|発表|発売|予約|受付|お申[しこ]?込み|登場|ラインナップ|再販|追加生産|(?:販売|受注|入荷)(?:が|を|は)?決定|HOBBY\s*(?:NEW ITEM INFO|NEXT PHASE)/i;

export function isProductAnnouncement(title) {
  const text = String(title || "");
  if (NOT_PRODUCT_NEWS.test(text)) return false;
  return PRODUCT_NEWS.test(text);
}

// The unfiltered topics page (all categories: ガンプラ, プラモデル, フィギュア,
// 一番くじ). Same card markup and same ids as the ガンプラ-only page, so a post
// on both merges into one record.
export const BANDAI_SPIRITS_TOPICS_URL = "https://www.bandaispirits.co.jp/products/topics/";

// defaultFranchise: the ガンプラ category page is all Gundam even when a title
// never says so ("2026年8月一般店頭発売アイテム"). On the all-categories page
// (defaultFranchise null) only cards tagged ガンプラ (category=1) get that
// default; everything else has to name one of the app's worlds.
export function parseBandaiHobbyNews(html, pageUrl = BANDAI_HOBBY_NEWS_URL, { defaultFranchise = "gundam" } = {}) {
  const records = [];
  const seen = new Set();
  const cards = String(html || "").split(/<div class="m_cardA">/).slice(1);
  for (const card of cards) {
    const linkTag = /<a\b[^>]*class="[^"]*\bm_cardA__link\b[^"]*"[^>]*>/i.exec(card)?.[0];
    const title = stripTags(/<div class="m_cardA__title">([\s\S]*?)<\/div>/i.exec(card)?.[1]);
    const announcedAt = japaneseDate(/<div class="m_cardA__date">([\s\S]*?)<\/div>/i.exec(card)?.[1]);
    const url = absoluteUrl(/href="([^"]+)"/i.exec(linkTag || "")?.[1], pageUrl);
    const thumbnailUrl = absoluteUrl(/<img\b[^>]*src="([^"]+)"/i.exec(card)?.[1], pageUrl);
    const cardDefault = defaultFranchise || (/m_cardA__tagLink[^>]*href="[^"]*[?&]category=1"/.test(card) ? "gundam" : null);
    const franchise = franchiseForAnnouncement(title, cardDefault);
    if (!url || !announcedAt || !franchise || !isProductAnnouncement(title)) continue;
    const id = `bandai-news-${announcedAt}-${Buffer.from(url).toString("base64url").slice(-12)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise,
      names: { ja: title, zh: null, ko: null, en: null },
      status: /受付|予約/.test(title) ? "preorder_open" : /商品化|新商品|発売/.test(title) ? "product_confirmed" : "announced",
      announced_at: announcedAt,
      source_type: "news",
      source_name: "BANDAI SPIRITS",
      source_url: url,
      thumbnail_url: thumbnailUrl,
      video_id: null,
      video_timestamp_seconds: null,
      series_key: "unclassified",
      grade_code: null,
      linked_kit_id: null,
      confidence: "official",
      notes: null,
    });
  }
  return records;
}

// Any official channel's Atom feed. defaultFranchise is for single-IP channels
// (ガンダムチャンネル, ベイチューブ); `accept` lets a channel add its own reveal
// wording on top of isProductAnnouncement (THE GUNDAM BASE posts
// "【ガンダムベース限定品情報】…" with no product verb).
export function parseYoutubeFeed(xml, {
  idPrefix = "youtube",
  sourceName,
  sourceId = null,
  defaultFranchise = null,
  accept = null,
} = {}) {
  const records = [];
  for (const match of String(xml || "").matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const videoId = stripTags(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/.exec(entry)?.[1]);
    const title = stripTags(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]);
    const published = stripTags(/<published>([\s\S]*?)<\/published>/.exec(entry)?.[1]);
    // Multi-IP channels cover every line, so a video only counts when its
    // title names one of the app's worlds.
    const franchise = franchiseForAnnouncement(title, defaultFranchise);
    const accepted = isProductAnnouncement(title) || Boolean(accept?.test(title) && !NOT_PRODUCT_NEWS.test(title));
    if (!videoId || !title || !franchise || !accepted) continue;
    records.push({
      id: `${idPrefix}-${videoId}`,
      franchise,
      names: { ja: title, zh: null, ko: null, en: null },
      status: "announced",
      announced_at: published ? published.slice(0, 10) : null,
      source_type: "youtube",
      source_name: sourceName,
      ...(sourceId ? { source_id: sourceId } : {}),
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      video_id: videoId,
      video_timestamp_seconds: null,
      series_key: "unclassified",
      grade_code: null,
      linked_kit_id: null,
      confidence: "candidate",
      notes: "Official video detected automatically. Confirm individual product reveals in CMS.",
    });
  }
  return records;
}

// BANDAI SPIRITS' own channel (UCuxB1suCoCqAKiljh_0xE4A). Its channel_id feed
// answered 404 on 2026-11-01 and 200 the next day, so the fetcher retries via
// the same channel's uploads playlist (UU…) — see BANDAI_HOBBY_YOUTUBE_FEED_URLS.
export const BANDAI_HOBBY_YOUTUBE_FEED_URLS = [
  BANDAI_HOBBY_YOUTUBE_FEED_URL,
  `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${BANDAI_HOBBY_YOUTUBE_CHANNEL_ID.slice(2)}`,
];

export function parseBandaiYoutubeFeed(xml) {
  return parseYoutubeFeed(xml, { idPrefix: "bandai-youtube", sourceName: "BANDAI Hobby Site YouTube" });
}

// 魂ウェブ (tamashiiweb.com/topics/, formerly /news/) — the Bandai Spirits collectible-figure feed.
// Titles are prefixed with the work in brackets (【機動戦士ガンダムSEED FREEDOM】),
// which is what decides the franchise; it carries every Bandai line, so posts
// without one of the app's worlds are dropped.
export function parseTamashiiNews(html, pageUrl = TAMASHII_NEWS_URL) {
  const records = [];
  const seen = new Set();
  for (const chunk of String(html || "").split(/<li class="topicList__item/).slice(1)) {
    const block = chunk.split("</li>")[0];
    // External links carry an accessibility suffix inside the title.
    const title = stripTags(/<h3 class="itemList__title">([\s\S]*?)<\/h3>/i.exec(block)?.[1])
      .replace(/\s*[(（]新しいタブで開きます[)）]\s*$/, "");
    const href = /<a\s+href="([^"]+)"/i.exec(block)?.[1];
    const announcedAt = /<time datetime="(\d{4}-\d{2}-\d{2})"/i.exec(block)?.[1] || null;
    const franchise = franchiseForAnnouncement(title);
    if (!title || !href || !announcedAt || !franchise || !isProductAnnouncement(title)) continue;
    const url = absoluteUrl(href, pageUrl);
    const id = `tamashii-news-${announcedAt}-${/\/item\/(\d+)/.exec(href)?.[1] || Buffer.from(href).toString("base64url").slice(-8)}`;
    if (!url || seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise,
      names: { ja: title, zh: null, ko: null, en: null },
      status: /受付|予約/.test(title) ? "preorder_open" : /決定|登場|商品化|発売/.test(title) ? "product_confirmed" : "announced",
      announced_at: announcedAt,
      source_type: "news",
      source_name: "TAMASHII WEB",
      source_url: url,
      thumbnail_url: absoluteUrl(/<img\b[^>]*src="([^"]+)"/i.exec(block)?.[1], pageUrl),
      video_id: null,
      video_timestamp_seconds: null,
      series_key: "unclassified",
      grade_code: null,
      linked_kit_id: null,
      confidence: "official",
      notes: null,
    });
  }
  return records;
}

// BEYBLADE X product posts rarely use a Bandai-style reveal verb: new limited
// beys are "レアベイゲットバトルに新限定品「…」が追加", restocks are
// "【CX-00 …】追加受注生産販売に関するお知らせ". 抽選販売 here is a mall lottery
// sale of a product, not a prize draw.
const BEYBLADE_PRODUCT_NEWS = /受注生産|抽選販売|新限定品|新レアベイ|限定品|追加生産|新商品|【[A-Z]{2}-\d{2,3}\b/;
const BEYBLADE_NOT_PRODUCT = /キャンペーン|開催|大会|イベント|お詫び|誤記|排出終了|非純正|仕様変更|アプリ/;

export function isBeybladeProductNews(title) {
  const text = String(title || "");
  if (BEYBLADE_NOT_PRODUCT.test(text)) return false;
  return isProductAnnouncement(text) || BEYBLADE_PRODUCT_NEWS.test(text);
}

// BEYBLADE X official news. The list mixes product posts with tournaments and
// store events, but the <li> class says which is which, so events are dropped
// before the title is even read.
export function parseBeybladeNews(html, pageUrl = BEYBLADE_X_NEWS_URL) {
  const records = [];
  const seen = new Set();
  for (const match of String(html || "").matchAll(/<li class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)) {
    const [, classNames, block] = match;
    // "mix news" is a product post; "mix event ..." and "campaign" are not.
    if (!/(^|\s)news(\s|$)/.test(classNames)) continue;
    const title = stripTags(/<b>([\s\S]*?)<\/b>/i.exec(block)?.[1]);
    const href = /<a\s+href="([^"]+)"/i.exec(block)?.[1];
    const dateText = stripTags(/<i>([\s\S]*?)<\/i>/i.exec(block)?.[1]);
    const announcedAt = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(dateText);
    if (!title || !href || !announcedAt || !isBeybladeProductNews(title)) continue;
    const iso = `${announcedAt[1]}-${announcedAt[2].padStart(2, "0")}-${announcedAt[3].padStart(2, "0")}`;
    const url = absoluteUrl(href, pageUrl);
    const id = `beyblade-news-${iso}-${Buffer.from(href).toString("base64url").slice(-8)}`;
    if (!url || seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise: "beyblade",
      names: { ja: title, zh: null, ko: null, en: null },
      status: /受付|予約|受注|抽選販売/.test(title) ? "preorder_open" : "product_confirmed",
      announced_at: iso,
      source_type: "news",
      source_name: "BEYBLADE X",
      source_url: url,
      thumbnail_url: absoluteUrl(/<img\b[^>]*src="([^"]+)"/i.exec(block)?.[1], pageUrl),
      video_id: null,
      video_timestamp_seconds: null,
      series_key: "unclassified",
      grade_code: null,
      linked_kit_id: null,
      confidence: "official",
      notes: null,
    });
  }
  return records;
}

// Store listings (Premium Bandai, Kotobukiya, the BEYBLADE X lineup, Takara
// Tomy's Pokémon page) and the per-product CoroCoro records are products by
// construction, so their titles carry no reveal verb and must not be
// re-checked against the news-title filter. So are the 魂ウェブ reveal banners,
// stored under the product name alone once read, and scheduled livestreams
// (live-streams.mjs), whose titles are programme names; those leave by age.
const LISTING_SOURCE_IDS = new Set([
  "premium_bandai_new_items",
  "kotobukiya_shop",
  "beyblade_x_lineup",
  "takaratomy_pokemon",
  "corocoro_news",
  "tamashii_reveals",
  "tamashii_nation_live",
  "youtube_live",
]);
// Sources with their own title rule; everything else uses isProductAnnouncement.
const SOURCE_TITLE_RULES = {
  beyblade_x_news: isBeybladeProductNews,
};

export function acceptsStoredAnnouncement(item) {
  if (LISTING_SOURCE_IDS.has(item.source_id)) return true;
  const title = item.names?.ja || "";
  // Records written before source_id existed are matched by their source name.
  const rule = SOURCE_TITLE_RULES[item.source_id]
    || (item.source_name === "BEYBLADE X" ? isBeybladeProductNews : null)
    || (item.source_id === "gundam_base_news" || item.source_id === "gundam_base_youtube" ? isGundamBaseProductNews : null);
  return rule ? rule(title) : isProductAnnouncement(title);
}

// THE GUNDAM BASE reveals store exclusives as "…商品詳細公開!" or
// "【ガンダムベース限定品情報】…" — no Bandai reveal verb in either.
const GUNDAM_BASE_PRODUCT = /限定品情報|商品詳細公開|ガンダムベース限定|販売方法のご案内/;

export function isGundamBaseProductNews(title) {
  const text = String(title || "");
  if (NOT_PRODUCT_NEWS.test(text)) return false;
  return isProductAnnouncement(text) || GUNDAM_BASE_PRODUCT.test(text);
}

export function mergeAnnouncementRecords(previous = [], incoming = []) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  // Stored records outlive the source listing on purpose — a post scrolls off
  // the first page long before it stops being real news. But that also meant a
  // record accepted by a too-loose filter could never be removed again, so a
  // record the source no longer offers is re-checked against today's rules.
  // Anything reviewed in the CMS is left alone.
  const records = new Map(
    previous
      .filter((item) => incomingIds.has(item.id) || item.reviewed_at || acceptsStoredAnnouncement(item))
      .map((item) => [item.id, item]),
  );
  for (const item of incoming) {
    const old = records.get(item.id) || {};
    records.set(item.id, {
      ...old,
      ...item,
      // Listings without a post date are dated by when the bot first saw them
      // (announced_at_basis "first_seen"); a refetch must not move that date.
      announced_at: item.announced_at_basis === "first_seen" && old.announced_at ? old.announced_at : item.announced_at,
      // An image already cached in the repo is kept: the feed's URL may be a
      // signed CloudFront link that expires (bandaispirits.co.jp), and
      // re-downloading every thumbnail daily gains nothing.
      thumbnail_url: String(old.thumbnail_url || "").startsWith("../app/assets/announcements/")
        ? old.thumbnail_url
        : item.thumbnail_url,
      // Curated translations (zh/ko/en, edited in the CMS) survive a refetch,
      // but `ja` is scraped, so the feed stays authoritative for it — otherwise
      // a title fixed upstream, or a decoding fix here, could never land.
      names: {
        ...(item.names || {}),
        ...Object.fromEntries(Object.entries(old.names || {}).filter(([code, value]) => value && code !== "ja")),
      },
      status: old.status || item.status,
      linked_kit_id: old.linked_kit_id || item.linked_kit_id,
      reviewed_at: old.reviewed_at || null,
    });
  }
  return [...records.values()].sort((a, b) =>
    String(b.announced_at || "").localeCompare(String(a.announced_at || ""))
    || String(a.id).localeCompare(String(b.id))
  );
}
