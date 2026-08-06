export const BANDAI_HOBBY_NEWS_URL =
  "https://www.bandaispirits.co.jp/products/topics/?category=1";
export const BANDAI_HOBBY_YOUTUBE_CHANNEL_ID = "UCuxB1suCoCqAKiljh_0xE4A";
export const BANDAI_HOBBY_YOUTUBE_FEED_URL =
  `https://www.youtube.com/feeds/videos.xml?channel_id=${BANDAI_HOBBY_YOUTUBE_CHANNEL_ID}`;
export const TAMASHII_NEWS_URL = "https://tamashiiweb.com/news/";
export const BEYBLADE_X_NEWS_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/news/";

function decodeHtml(value) {
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

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

function absoluteUrl(value, base) {
  if (!String(value || "").trim()) return null;
  try {
    return new URL(decodeHtml(value), base).href;
  } catch {
    return null;
  }
}

function japaneseDate(value) {
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
  ["pokemon", /ポケモン|ポケプラ|POKEMON|POK[EÉ]MON|ピカチュウ/i],
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
const NOT_PRODUCT_NEWS = /アンケート|キャンペーン|POP-?UP|開催|展示会|イベント|大会|抽選|試遊|来場/i;
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

export function parseBandaiHobbyNews(html, pageUrl = BANDAI_HOBBY_NEWS_URL) {
  const records = [];
  const seen = new Set();
  const cards = String(html || "").split(/<div class="m_cardA">/).slice(1);
  for (const card of cards) {
    const linkTag = /<a\b[^>]*class="[^"]*\bm_cardA__link\b[^"]*"[^>]*>/i.exec(card)?.[0];
    const title = stripTags(/<div class="m_cardA__title">([\s\S]*?)<\/div>/i.exec(card)?.[1]);
    const announcedAt = japaneseDate(/<div class="m_cardA__date">([\s\S]*?)<\/div>/i.exec(card)?.[1]);
    const url = absoluteUrl(/href="([^"]+)"/i.exec(linkTag || "")?.[1], pageUrl);
    const thumbnailUrl = absoluteUrl(/<img\b[^>]*src="([^"]+)"/i.exec(card)?.[1], pageUrl);
    // This page is the ガンプラ category, so every product post on it is Gundam
    // even when the title never says so ("2026年8月一般店頭発売アイテム").
    if (!url || !announcedAt || !isProductAnnouncement(title)) continue;
    const id = `bandai-news-${announcedAt}-${Buffer.from(url).toString("base64url").slice(-12)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise: franchiseForAnnouncement(title, "gundam"),
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

export function parseBandaiYoutubeFeed(xml) {
  const records = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const videoId = stripTags(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/.exec(entry)?.[1]);
    const title = stripTags(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]);
    const published = stripTags(/<published>([\s\S]*?)<\/published>/.exec(entry)?.[1]);
    // The channel covers every Bandai line, so a video only counts when its
    // title names one of the app's worlds.
    const franchise = franchiseForAnnouncement(title);
    if (!videoId || !title || !franchise || !isProductAnnouncement(title)) continue;
    records.push({
      id: `bandai-youtube-${videoId}`,
      franchise,
      names: { ja: title, zh: null, ko: null, en: null },
      status: "announced",
      announced_at: published ? published.slice(0, 10) : null,
      source_type: "youtube",
      source_name: "BANDAI Hobby Site YouTube",
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

// 魂ウェブ (tamashiiweb.com/news/) — the Bandai Spirits collectible-figure feed.
// Titles are prefixed with the work in brackets (【機動戦士ガンダムSEED FREEDOM】),
// which is what decides the franchise; it carries every Bandai line, so posts
// without one of the app's worlds are dropped.
export function parseTamashiiNews(html, pageUrl = TAMASHII_NEWS_URL) {
  const records = [];
  const seen = new Set();
  for (const chunk of String(html || "").split(/<li class="topicList__item/).slice(1)) {
    const block = chunk.split("</li>")[0];
    const title = stripTags(/<h3 class="itemList__title">([\s\S]*?)<\/h3>/i.exec(block)?.[1]);
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
    if (!title || !href || !announcedAt || !isProductAnnouncement(title)) continue;
    const iso = `${announcedAt[1]}-${announcedAt[2].padStart(2, "0")}-${announcedAt[3].padStart(2, "0")}`;
    const url = absoluteUrl(href, pageUrl);
    const id = `beyblade-news-${iso}-${Buffer.from(href).toString("base64url").slice(-8)}`;
    if (!url || seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise: "beyblade",
      names: { ja: title, zh: null, ko: null, en: null },
      status: /受付|予約/.test(title) ? "preorder_open" : "product_confirmed",
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

export function mergeAnnouncementRecords(previous = [], incoming = []) {
  const incomingIds = new Set(incoming.map((item) => item.id));
  // Stored records outlive the source listing on purpose — a post scrolls off
  // the first page long before it stops being real news. But that also meant a
  // record accepted by a too-loose filter could never be removed again, so a
  // record the source no longer offers is re-checked against today's rules.
  // Anything reviewed in the CMS is left alone.
  const records = new Map(
    previous
      .filter((item) => incomingIds.has(item.id) || item.reviewed_at || isProductAnnouncement(item.names?.ja || ""))
      .map((item) => [item.id, item]),
  );
  for (const item of incoming) {
    const old = records.get(item.id) || {};
    records.set(item.id, {
      ...old,
      ...item,
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
