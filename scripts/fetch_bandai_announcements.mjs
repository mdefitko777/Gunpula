import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  BANDAI_HOBBY_NEWS_URL,
  BANDAI_HOBBY_YOUTUBE_FEED_URLS,
  BANDAI_SPIRITS_TOPICS_URL,
  BEYBLADE_X_NEWS_URL,
  TAMASHII_NEWS_URL,
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBandaiYoutubeFeed,
  parseBeybladeNews,
  parseTamashiiNews,
  parseYoutubeFeed,
} from "./lib/bandai-announcements.mjs";
import {
  BEYBLADE_X_LINEUP_URL,
  GUNDAM_BASE_NEWS_URL,
  GUNDAM_OFFICIAL_NEWS_URL,
  KOTOBUKIYA_SHOP_BASE,
  KOTOBUKIYA_TITLES,
  POKEMON_FRIENDA_URL,
  PREMIUM_BANDAI_NEW_ITEMS_URL,
  TAKARATOMY_POKEMON_URL,
  TAMASHII_TOPICS_ITEMS_URL,
  YOUTUBE_CHANNELS,
  dedupeAnnouncements,
  kotobukiyaAnnouncement,
  parseBeybladeLineup,
  parseFriendaTopics,
  parseGundamBaseNews,
  parseGundamOfficialNews,
  parseKotobukiyaTitleGoods,
  parsePremiumBandaiCategoryTitles,
  parsePremiumBandaiNewItems,
  parseTakaraTomyPokemonNews,
  youtubeFeedUrls,
} from "./lib/official-announcements.mjs";
import { parseKotobukiyaShopDetail } from "./lib/kotobukiya-shop.mjs";

const OUTPUT_PATH = "data/announcements.json";
const IMAGE_DIR = "app/assets/announcements";
const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
// At most about one request per second to any one host.
const HOST_GAP_MS = 1100;
// New records older than this are not added (stored history is kept as is).
const RECENT_DAYS = Number(process.env.ANNOUNCEMENT_RECENT_DAYS || 183);
// Bigger thumbnails stay hotlinked instead of being committed to the repo.
const MAX_CACHED_IMAGE_BYTES = 300 * 1024;
// Optional: write every raw response here (debugging, or replay with
// ANNOUNCEMENT_REPLAY=1 to rerun the parsers without touching the network).
const RAW_CACHE_DIR = process.env.ANNOUNCEMENT_RAW_CACHE_DIR || "";
const REPLAY = process.env.ANNOUNCEMENT_REPLAY === "1";

const lastRequestAt = new Map();

async function waitForHost(url) {
  const host = new URL(url).host;
  const wait = (lastRequestAt.get(host) || 0) + HOST_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

function rawCachePath(url) {
  return join(RAW_CACHE_DIR, url.replace(/^https?:\/\//, "").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 180));
}

function decodeBody(buffer, contentType) {
  const charset = /charset=([^;]+)/i.exec(contentType || "")?.[1]?.trim().toLowerCase() || "utf-8";
  const label = /shift_jis|sjis/.test(charset) ? "shift_jis" : charset === "utf8" ? "utf-8" : charset;
  try {
    return new TextDecoder(label).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function fetchText(url) {
  if (REPLAY && RAW_CACHE_DIR) {
    try {
      return await readFile(rawCachePath(url), "utf8");
    } catch {
      // Not cached; fall through to the network.
    }
  }
  await waitForHost(url);
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja-JP,ja;q=0.9,en;q=0.6",
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const text = decodeBody(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
  if (RAW_CACHE_DIR) {
    await mkdir(RAW_CACHE_DIR, { recursive: true });
    await writeFile(rawCachePath(url), text);
  }
  return text;
}

// YouTube's channel_id feed sometimes answers 404 for a day (BANDAI SPIRITS,
// 2026-11-01); the uploads-playlist feed of the same channel is the fallback.
async function fetchFirstOk(urls) {
  const errors = [];
  for (const url of urls) {
    try {
      return await fetchText(url);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(errors.join("; "));
}

function todayInJapan() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

function shiftDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Records written before source_id existed, keyed by their source_name.
const LEGACY_SOURCE_IDS = {
  "BANDAI SPIRITS": "bandai_hobby_news",
  "BANDAI Hobby Site YouTube": "bandai_hobby_youtube",
  "TAMASHII WEB": "tamashii_news",
  "BEYBLADE X": "beyblade_x_news",
};

async function readPrevious() {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    previous.announcements = (previous.announcements || [])
      .filter((record) =>
        record.source_url !== BANDAI_HOBBY_NEWS_URL
        && record.source_url !== "https://bandai-hobby.net/news/"
        && record.source_url !== "https://internal-preview.bandai-hobby.net/news/"
      )
      .map((record) => record.source_id || !LEGACY_SOURCE_IDS[record.source_name]
        ? record
        : { ...record, source_id: LEGACY_SOURCE_IDS[record.source_name] });
    return previous;
  } catch {
    return { announcements: [] };
  }
}

async function cacheAnnouncementImages(records) {
  await mkdir(IMAGE_DIR, { recursive: true });
  // A record whose image is already on disk (a rerun before the commit) is
  // relinked instead of downloaded again.
  const onDisk = new Map((await readdir(IMAGE_DIR)).map((filename) => [filename.replace(/\.[a-z]+$/i, ""), filename]));
  for (const record of records) {
    if (!/^https?:/i.test(record.thumbnail_url || "")) continue;
    const filenameBase = record.id.replace(/[^a-z0-9_-]/gi, "_");
    if (onDisk.has(filenameBase)) {
      record.thumbnail_url = `../app/assets/announcements/${onDisk.get(filenameBase)}`;
      continue;
    }
    try {
      await waitForHost(record.thumbnail_url);
      const response = await fetch(record.thumbnail_url, {
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": USER_AGENT },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      if (!/^image\//i.test(contentType)) throw new Error(`not an image (${contentType})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_CACHED_IMAGE_BYTES) continue;
      const extension = /png/i.test(contentType) ? "png" : /webp/i.test(contentType) ? "webp" : /gif/i.test(contentType) ? "gif" : "jpg";
      const filename = `${filenameBase}.${extension}`;
      await writeFile(`${IMAGE_DIR}/${filename}`, bytes);
      record.thumbnail_url = `../app/assets/announcements/${filename}`;
    } catch (error) {
      console.warn(`${record.id}: image cache failed (${error.message})`);
    }
  }
  const used = new Set(records
    .map((record) => record.thumbnail_url)
    .filter((url) => String(url || "").startsWith("../app/assets/announcements/"))
    .map((url) => basename(url)));
  for (const filename of await readdir(IMAGE_DIR)) {
    if (!used.has(filename)) await unlink(`${IMAGE_DIR}/${filename}`);
  }
}

const previous = await readPrevious();
const previousById = new Map(previous.announcements.map((record) => [record.id, record]));
const today = todayInJapan();
const cutoff = shiftDate(today, -RECENT_DAYS);

function latestStored(predicate) {
  return previous.announcements.filter(predicate).map((record) => record.announced_at).filter(Boolean).sort().at(-1) || null;
}

// Paged lists (newest first) are read until a page reaches what is already
// stored (minus a few days of overlap), or the recency cutoff on a first run.
async function readPages({ pageUrl, maxPages, parse, stopAt }) {
  const records = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { records: pageRecords, oldest, items } = parse(await fetchText(pageUrl(page)));
    records.push(...pageRecords);
    if (!items || !oldest || oldest < stopAt) break;
  }
  return records;
}

function pagedStopDate(predicate) {
  const latest = latestStored(predicate);
  return latest && shiftDate(latest, -3) > cutoff ? shiftDate(latest, -3) : cutoff;
}

const SOURCES = [
  {
    id: "tamashii_news",
    name: "TAMASHII WEB",
    url: TAMASHII_NEWS_URL,
    run: async () => parseTamashiiNews(await fetchText(TAMASHII_NEWS_URL)),
  },
  {
    // The product-only topic list (/topics/items/), paged; same record ids as
    // /news/, so a post seen on both merges.
    id: "tamashii_topics_items",
    name: "TAMASHII WEB",
    url: TAMASHII_TOPICS_ITEMS_URL,
    run: () => readPages({
      pageUrl: (page) => page === 1 ? TAMASHII_TOPICS_ITEMS_URL : `${TAMASHII_TOPICS_ITEMS_URL}?current_page=${page}`,
      maxPages: 30,
      stopAt: pagedStopDate((record) => record.source_id === "tamashii_topics_items"),
      parse: (html) => {
        const dates = [...html.matchAll(/<time datetime="(\d{4}-\d{2}-\d{2})"/g)].map((match) => match[1]).sort();
        return { records: parseTamashiiNews(html, TAMASHII_TOPICS_ITEMS_URL), oldest: dates[0] || null, items: dates.length };
      },
    }),
  },
  {
    id: "bandai_hobby_news",
    name: "BANDAI SPIRITS",
    url: BANDAI_HOBBY_NEWS_URL,
    run: async () => parseBandaiHobbyNews(await fetchText(BANDAI_HOBBY_NEWS_URL)),
  },
  {
    id: "bandai_spirits_topics",
    name: "BANDAI SPIRITS",
    url: BANDAI_SPIRITS_TOPICS_URL,
    run: async () => parseBandaiHobbyNews(await fetchText(BANDAI_SPIRITS_TOPICS_URL), BANDAI_SPIRITS_TOPICS_URL, { defaultFranchise: null }),
  },
  {
    id: "beyblade_x_news",
    name: "BEYBLADE X",
    url: BEYBLADE_X_NEWS_URL,
    run: async () => parseBeybladeNews(await fetchText(BEYBLADE_X_NEWS_URL)),
  },
  {
    id: "beyblade_x_lineup",
    name: "BEYBLADE X",
    url: BEYBLADE_X_LINEUP_URL,
    run: async () => parseBeybladeLineup(await fetchText(BEYBLADE_X_LINEUP_URL), { today }),
  },
  {
    id: "takaratomy_pokemon",
    name: "タカラトミー ポケモン",
    url: TAKARATOMY_POKEMON_URL,
    run: async () => parseTakaraTomyPokemonNews(await fetchText(TAKARATOMY_POKEMON_URL)),
  },
  {
    id: "pokemon_frienda",
    name: "ポケモンフレンダ",
    url: POKEMON_FRIENDA_URL,
    run: async () => parseFriendaTopics(await fetchText(POKEMON_FRIENDA_URL)),
  },
  {
    id: "gundam_base_news",
    name: "THE GUNDAM BASE",
    url: GUNDAM_BASE_NEWS_URL,
    run: async () => parseGundamBaseNews(await fetchText(GUNDAM_BASE_NEWS_URL)),
  },
  {
    id: "gundam_official_news",
    name: "GUNDAM.INFO",
    url: GUNDAM_OFFICIAL_NEWS_URL,
    run: () => readPages({
      pageUrl: (page) => page === 1 ? GUNDAM_OFFICIAL_NEWS_URL : `${GUNDAM_OFFICIAL_NEWS_URL}?page=${page}`,
      maxPages: 80,
      stopAt: pagedStopDate((record) => record.source_id === "gundam_official_news"),
      parse: parseGundamOfficialNews,
    }),
  },
  {
    id: "premium_bandai_new_items",
    name: "プレミアムバンダイ",
    url: PREMIUM_BANDAI_NEW_ITEMS_URL,
    run: async () => {
      // The newest Gunpla listings, for full names and to know what is Gunpla.
      const fullTitles = new Map();
      for (let page = 0; page < 3; page += 1) {
        const html = await fetchText(`https://p-bandai.jp/hobby/a0001/list-da20-n${page}/`);
        for (const [id, title] of parsePremiumBandaiCategoryTitles(html)) fullTitles.set(id, title);
      }
      return parsePremiumBandaiNewItems(await fetchText(PREMIUM_BANDAI_NEW_ITEMS_URL), {
        fullTitles,
        gunplaIds: new Set(fullTitles.keys()),
        now: new Date(`${today}T12:00:00+09:00`),
      });
    },
  },
  {
    id: "kotobukiya_shop",
    name: "コトブキヤショップ",
    url: `${KOTOBUKIYA_SHOP_BASE}/shop/pages/titlelist.aspx`,
    run: async () => {
      const records = [];
      for (const title of KOTOBUKIYA_TITLES) {
        const goods = parseKotobukiyaTitleGoods(await fetchText(`${KOTOBUKIYA_SHOP_BASE}/shop/r/${title.id}/`));
        // Newest releases first; only the first few can be upcoming. A goods
        // page already turned into a record is not fetched again.
        for (const item of goods.slice(0, 8)) {
          const stored = previousById.get(`kotobukiya-${item.code}`);
          if (stored) {
            records.push(stored);
            continue;
          }
          const detailHtml = await fetchText(item.url);
          const record = kotobukiyaAnnouncement({
            title,
            goods: item,
            detail: parseKotobukiyaShopDetail(detailHtml, item.url),
            detailHtml,
            today,
          });
          if (record) records.push(record);
        }
      }
      return records;
    },
  },
  {
    id: "bandai_hobby_youtube",
    name: "BANDAI Hobby Site YouTube",
    url: BANDAI_HOBBY_YOUTUBE_FEED_URLS[0],
    run: async () => parseBandaiYoutubeFeed(await fetchFirstOk(BANDAI_HOBBY_YOUTUBE_FEED_URLS)),
  },
  ...YOUTUBE_CHANNELS.map((channel) => ({
    id: channel.id,
    name: channel.name,
    url: youtubeFeedUrls(channel.channelId)[0],
    run: async () => parseYoutubeFeed(await fetchFirstOk(youtubeFeedUrls(channel.channelId)), {
      idPrefix: "youtube",
      sourceName: channel.name,
      sourceId: channel.id,
      defaultFranchise: channel.defaultFranchise,
      accept: channel.accept || null,
    }),
  })),
];

// Which copy of a reveal survives when several sources carry it: SOURCES
// order — the maker's own post first, then aggregators, store listings, videos.
const DEDUPE_PRIORITY = SOURCES.map((source) => source.id);

const errors = [];
const incoming = [];
for (const source of SOURCES) {
  try {
    const records = (await source.run())
      .map((record) => ({ ...record, source_id: record.source_id || source.id }))
      // Only recent news is added; a record that is already stored stays
      // whatever its age (it is still refreshed from the source).
      .filter((record) => previousById.has(record.id) || !record.announced_at || record.announced_at >= cutoff);
    incoming.push(...records);
    const byFranchise = records.reduce((acc, record) => ({ ...acc, [record.franchise]: (acc[record.franchise] || 0) + 1 }), {});
    console.log(`${source.id}: ${records.length} announcement records ${JSON.stringify(byFranchise)}`);
  } catch (error) {
    // One source failing (blocked, maintenance, markup change) must not stop
    // the others; its stored records stay as they are.
    errors.push({ source_id: source.id, message: error.message });
    console.warn(`${source.id}: ${error.message}`);
  }
}

// The same id can come from two sources (魂ウェブ /news/ and /topics/items/);
// the first one in SOURCES order wins.
const incomingById = new Map();
for (const record of incoming) if (!incomingById.has(record.id)) incomingById.set(record.id, record);

const merged = mergeAnnouncementRecords(previous.announcements, [...incomingById.values()]);
const { records: announcements, dropped } = dedupeAnnouncements(merged, DEDUPE_PRIORITY);
if (dropped.length) console.log(`Dropped ${dropped.length} cross-source duplicates.`);
await cacheAnnouncementImages(announcements);
await writeFile(OUTPUT_PATH, `${JSON.stringify({
  updated_at: new Date().toISOString(),
  sources: SOURCES.map((source) => ({ source_id: source.id, name: source.name, url: source.url })),
  fetch_errors: errors,
  announcements,
}, null, 2)}\n`);

console.log(`Wrote ${announcements.length} announcements to ${OUTPUT_PATH}`);
