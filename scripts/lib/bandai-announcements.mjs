export const BANDAI_HOBBY_NEWS_URL =
  "https://www.bandaispirits.co.jp/products/topics/?category=1";
export const BANDAI_HOBBY_YOUTUBE_CHANNEL_ID = "UCuxB1suCoCqAKiljh_0xE4A";
export const BANDAI_HOBBY_YOUTUBE_FEED_URL =
  `https://www.youtube.com/feeds/videos.xml?channel_id=${BANDAI_HOBBY_YOUTUBE_CHANNEL_ID}`;

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
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

function isGundamAnnouncement(title) {
  const gundam = /ガンプラ|GUNPLA|ガンダム|GUNDAM/i.test(title)
    && /新商品|新作|商品化|発表|発売|予約|配信|ライブ|HOBBY|NEXT/i.test(title);
  const officialRevealProgram =
    /HOBBY\s*(NEW ITEM INFO|NEXT PHASE)|新商品(?:情報|発表)|新作プラモデル/i.test(title);
  return gundam || officialRevealProgram;
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
    if (!url || !announcedAt || !isGundamAnnouncement(title)) continue;
    const id = `bandai-news-${announcedAt}-${Buffer.from(url).toString("base64url").slice(-12)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    records.push({
      id,
      franchise: "gundam",
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
    if (!videoId || !title || !isGundamAnnouncement(title)) continue;
    records.push({
      id: `bandai-youtube-${videoId}`,
      franchise: "gundam",
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

export function mergeAnnouncementRecords(previous = [], incoming = []) {
  const records = new Map(previous.map((item) => [item.id, item]));
  for (const item of incoming) {
    const old = records.get(item.id) || {};
    records.set(item.id, {
      ...old,
      ...item,
      names: { ...(item.names || {}), ...(old.names || {}) },
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
