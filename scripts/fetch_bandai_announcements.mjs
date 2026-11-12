import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  BANDAI_HOBBY_NEWS_URL,
  BANDAI_SPIRITS_TOPICS_URL,
  BEYBLADE_X_NEWS_URL,
  TAMASHII_NEWS_URL,
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBeybladeNews,
  parseTamashiiNews,
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
  TAMASHII_REVEAL_PAGES,
  TAMASHII_REVEALS_SOURCE_ID,
  TAMASHII_TOPICS_ITEMS_URL,
  YOUTUBE_CHANNELS,
  createHostStops,
  dedupeAnnouncements,
  kotobukiyaAnnouncement,
  linkRevealKits,
  parseBeybladeLineup,
  parseFriendaTopics,
  parseGundamBaseNews,
  parseGundamOfficialNews,
  parseKotobukiyaTitleGoods,
  parsePremiumBandaiCategoryTitles,
  parsePremiumBandaiNewItems,
  parseTakaraTomyPokemonNews,
  parseTamashiiRevealBanners,
  promoteRevealStages,
} from "./lib/official-announcements.mjs";
import { parseKotobukiyaShopDetail } from "./lib/kotobukiya-shop.mjs";
import {
  COROCORO_FRANCHISES,
  COROCORO_HOST,
  COROCORO_SOURCE_ID,
  COROCORO_SOURCE_NAME,
  dropMagazineDuplicates,
  emptyCoroCoroState,
  runCoroCoroSource,
} from "./lib/corocoro-news.mjs";
import {
  EVENT_LIVE_SOURCE_ID,
  TAMASHII_NATION_EVENT,
  YOUTUBE_LIVE_SOURCE_ID,
  eventInSeason,
  eventStreamHints,
  eventStreamRecords,
  isMissingS3File,
  oncePerUrl,
  parseEventStreams,
  runYoutubeLiveSource,
  runYoutubeVideoSource,
  settleLiveRecords,
  withLiveFields,
  youtubeUploadsUrl,
} from "./lib/live-streams.mjs";
import { loadRobots, robotsAllows } from "./lib/robots.mjs";

const OUTPUT_PATH = "data/announcements.json";
// Posts CoroCoro News already gave us, so each run reads only new ones.
const COROCORO_STATE_PATH = "data/announcements-corocoro.json";
// YouTube videos already checked for being a stream, so each watch page is
// read once (and again only while its stream is still to come).
const LIVE_STATE_PATH = "data/announcements-live.json";
const IMAGE_DIR = "app/assets/announcements";
const IMAGE_SKIPS_PATH = "data/announcements-image-skips.json";
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
// Optional: comma-separated source ids to run (trying one source without
// fetching all the others); the others keep their stored records.
const ONLY_SOURCES = new Set((process.env.ANNOUNCEMENT_SOURCES || "").split(",").map((id) => id.trim()).filter(Boolean));

const lastRequestAt = new Map();
// Several sources share a host (three on tamashiiweb.com); one that answered
// 403/429/503 gets no further request from any of them this run.
const hostStops = createHostStops();

async function waitForHost(url) {
  hostStops.check(url);
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

async function fetchText(url, accept = "text/html,application/atom+xml,application/xml;q=0.9,*/*;q=0.8") {
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
      accept,
      "accept-language": "ja-JP,ja;q=0.9,en;q=0.6",
    },
  });
  if (!response.ok) {
    hostStops.record(url, response.status);
    throw Object.assign(new Error(`${url} returned ${response.status}`), { status: response.status });
  }
  const text = decodeBody(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
  if (RAW_CACHE_DIR) {
    await mkdir(RAW_CACHE_DIR, { recursive: true });
    await writeFile(rawCachePath(url), text);
  }
  return text;
}

// A non-JSON answer (a bot-check page) throws a SyntaxError.
async function fetchJson(url) {
  return JSON.parse(await fetchText(url, "application/json"));
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
  // Images over the size limit stay remote links. Remember them: until 2026-11-12 every run
  // downloaded about 180 of them again (178 from gundam-official.com, 3 min 20 s) only to drop them.
  const oversize = (await readJson(IMAGE_SKIPS_PATH, {})).oversize || {};
  const stillOversize = {};
  for (const record of records) {
    if (!/^https?:/i.test(record.thumbnail_url || "")) continue;
    if (oversize[record.thumbnail_url]) {
      stillOversize[record.thumbnail_url] = oversize[record.thumbnail_url];
      continue;
    }
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
      if (!response.ok) {
        hostStops.record(record.thumbnail_url, response.status);
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!/^image\//i.test(contentType)) throw new Error(`not an image (${contentType})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_CACHED_IMAGE_BYTES) {
        stillOversize[record.thumbnail_url] = bytes.length;
        continue;
      }
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
  const sorted = Object.fromEntries(Object.keys(stillOversize).sort().map((url) => [url, stillOversize[url]]));
  const skips = { note: "Announcement thumbnails over the cache size limit (bytes): left as remote links, not downloaded again.", oversize: sorted };
  await writeFile(IMAGE_SKIPS_PATH, `${JSON.stringify(skips, null, 1)}\n`);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function runCoroCoro() {
  // robots.txt first (2026-11-12: only /wp-admin/ is disallowed).
  await waitForHost(`https://${COROCORO_HOST}/robots.txt`);
  const robots = await loadRobots(COROCORO_HOST, { userAgent: USER_AGENT });
  console.log(`${COROCORO_SOURCE_ID}: robots.txt ${robots.status}`);
  const { state, records, stopped } = await runCoroCoroSource({
    state: await readJson(COROCORO_STATE_PATH, emptyCoroCoroState()),
    today,
    fetchJson,
    robotsAllows: (url) => robotsAllows(robots, url),
    log: (line) => console.log(line),
  });
  // Saved even when the site stopped us halfway: posts already read are not
  // fetched again tomorrow.
  await writeFile(COROCORO_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  if (stopped) {
    errors.push({ source_id: COROCORO_SOURCE_ID, message: stopped });
    console.warn(`${COROCORO_SOURCE_ID}: ${stopped}`);
  }
  return records;
}

// Robots first (2026-11-12: tamashiiweb.com has no robots.txt, a 404), then one
// work page per day.
async function runTamashiiReveals() {
  const host = new URL(TAMASHII_REVEAL_PAGES[0].url).host;
  await waitForHost(`https://${host}/robots.txt`);
  const robots = await loadRobots(host, { userAgent: USER_AGENT });
  console.log(`${TAMASHII_REVEALS_SOURCE_ID}: robots.txt ${robots.status}`);
  hostStops.record(`https://${host}/robots.txt`, Number.parseInt(robots.status, 10));
  const records = [];
  for (const page of TAMASHII_REVEAL_PAGES) {
    if (!robotsAllows(robots, page.url)) throw new Error(`${page.url} is disallowed by robots.txt`);
    const parsed = parseTamashiiRevealBanners(await fetchText(page.url), { pageUrl: page.url, franchise: page.franchise, today });
    // A page without the slider is a markup change or a bot check, not a quiet day.
    if (!parsed.slides) throw new Error(`${page.url} has no key-visual slides`);
    records.push(...parsed.records);
  }
  return records;
}

// YouTube streams the event site links; read by the YouTube source after it.
const linkedStreams = [];
// Stored streams YouTube no longer has (cancelled, made private).
const goneStreamIds = new Set();

// The show's site, only around the show. Its robots.txt is S3's 403 for a
// missing file (2026-11-12): none published. Any other 403 there stops the
// host, as a 403 from a page would.
async function runTamashiiNationLive() {
  if (!eventInSeason(TAMASHII_NATION_EVENT, today)) return [];
  const host = new URL(TAMASHII_NATION_EVENT.pages[0]).host;
  const robotsUrl = `https://${host}/robots.txt`;
  await waitForHost(robotsUrl);
  let missingFile = false;
  const robots = await loadRobots(host, {
    userAgent: USER_AGENT,
    fetchImpl: async (url, options) => {
      const response = await fetch(url, options);
      if (response.status !== 403) return response;
      // loadRobots does not read a 4xx body; it is read here and handed on.
      const body = await response.text();
      missingFile = isMissingS3File({ status: response.status, server: response.headers.get("server"), body });
      return new Response(body, { status: response.status });
    },
  });
  console.log(`${EVENT_LIVE_SOURCE_ID}: robots.txt ${robots.status}${missingFile ? " (S3: no such file)" : ""}`);
  if (!missingFile) hostStops.record(robotsUrl, Number.parseInt(robots.status, 10));
  const records = [];
  for (const url of TAMASHII_NATION_EVENT.pages) {
    if (!robotsAllows(robots, url)) throw new Error(`${url} is disallowed by robots.txt`);
    const parsed = parseEventStreams(await fetchText(url), { pageUrl: url, today });
    console.log(`${EVENT_LIVE_SOURCE_ID}: ${url}: ${parsed.streams.length} streams in ${parsed.items} items`);
    records.push(...eventStreamRecords(parsed, { today, now }));
    linkedStreams.push(...eventStreamHints(parsed));
  }
  return records;
}

const YOUTUBE_HOST = "www.youtube.com";
// A YouTube page is asked for once a run: a channel's upload list serves its
// product-video source and the stream source.
const fetchYoutube = oncePerUrl(fetchText);
let youtubeRobots = null;

// robots.txt once a run, before the first YouTube page. Upload lists and watch
// pages only: it keeps "*" out of /feeds/videos.xml (see lib/live-streams.mjs).
function loadYoutubeRobots() {
  youtubeRobots ||= (async () => {
    await waitForHost(`https://${YOUTUBE_HOST}/robots.txt`);
    const robots = await loadRobots(YOUTUBE_HOST, { userAgent: USER_AGENT });
    console.log(`${YOUTUBE_HOST}: robots.txt ${robots.status}`);
    // A 403 here reads as "no robots.txt"; from YouTube it is the bot being turned away.
    hostStops.record(`https://${YOUTUBE_HOST}/robots.txt`, Number.parseInt(robots.status, 10));
    return robots;
  })();
  return youtubeRobots;
}

// A page without its data is a bot check until shown otherwise.
function stopYoutube() {
  hostStops.stop(`https://${YOUTUBE_HOST}/`, "a page without video data");
}

async function runYoutubeVideos(channel) {
  const robots = await loadYoutubeRobots();
  const { records, stopped } = await runYoutubeVideoSource({
    channel,
    stored: previous.announcements,
    today,
    fetchText: fetchYoutube,
    robotsAllows: (url) => robotsAllows(robots, url),
    log: (line) => console.log(line),
  });
  if (stopped) {
    stopYoutube();
    throw new Error(stopped);
  }
  return records;
}

async function runYoutubeLive() {
  const robots = await loadYoutubeRobots();
  const result = await runYoutubeLiveSource({
    hints: linkedStreams,
    stored: previous.announcements,
    state: await readJson(LIVE_STATE_PATH, {}),
    today,
    fetchText: fetchYoutube,
    robotsAllows: (url) => robotsAllows(robots, url),
    log: (line) => console.log(line),
  });
  await writeFile(LIVE_STATE_PATH, `${JSON.stringify(result.state, null, 2)}\n`);
  for (const id of result.gone) goneStreamIds.add(id);
  if (result.stopped) stopYoutube();
  for (const message of [result.stopped, ...result.problems].filter(Boolean)) {
    errors.push({ source_id: YOUTUBE_LIVE_SOURCE_ID, message });
    console.warn(`${YOUTUBE_LIVE_SOURCE_ID}: ${message}`);
  }
  return result.records;
}

// Catalog products per franchise, for telling a magazine scoop of a new bey
// from an old one mentioned again and for linking a reveal to its product.
// The split files are last run's catalog.
async function readCatalogKits(franchises) {
  const byFranchise = new Map();
  for (const franchise of franchises) {
    byFranchise.set(franchise, (await readJson(`data/split/kits-${franchise}.json`, {}))?.kits || []);
  }
  return byFranchise;
}

const previous = await readPrevious();
const previousById = new Map(previous.announcements.map((record) => [record.id, record]));
const now = new Date();
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
    // 商品化決定 reveals that exist only as a slider banner until the preorder
    // opens (see parseTamashiiRevealBanners).
    id: TAMASHII_REVEALS_SOURCE_ID,
    name: "TAMASHII WEB",
    url: TAMASHII_REVEAL_PAGES[0].url,
    run: runTamashiiReveals,
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
    // Magazine scoops; after the makers' own pages and stores, so an official
    // post about the same product wins.
    id: COROCORO_SOURCE_ID,
    name: COROCORO_SOURCE_NAME,
    url: `https://${COROCORO_HOST}/`,
    run: runCoroCoro,
  },
  // Product videos, from each channel's upload list.
  ...YOUTUBE_CHANNELS.map((channel) => ({
    id: channel.id,
    name: channel.name,
    url: youtubeUploadsUrl(channel.channelId),
    run: () => runYoutubeVideos(channel),
  })),
  // When official streams start. Last: a video a source above already
  // reports keeps that record and only gains live_at / live_state. The YouTube
  // one reads the same upload lists (once a run, see fetchYoutube).
  {
    id: EVENT_LIVE_SOURCE_ID,
    name: TAMASHII_NATION_EVENT.name,
    url: TAMASHII_NATION_EVENT.pages[0],
    run: runTamashiiNationLive,
  },
  {
    id: YOUTUBE_LIVE_SOURCE_ID,
    name: "YouTube ライブ配信",
    url: "https://www.youtube.com/",
    run: runYoutubeLive,
  },
];

// Which copy of a reveal survives when several sources carry it: SOURCES
// order — the maker's own post first, then aggregators, store listings, videos.
const DEDUPE_PRIORITY = SOURCES.map((source) => source.id);

const errors = [];
const incoming = [];
for (const source of SOURCES) {
  if (ONLY_SOURCES.size && !ONLY_SOURCES.has(source.id)) continue;
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
// the first one in SOURCES order wins, and takes the stream time when the
// later one is the same video seen as a stream.
const incomingById = new Map();
for (const record of incoming) {
  const first = incomingById.get(record.id);
  incomingById.set(record.id, first ? withLiveFields(first, record) : record);
}

// Streams follow the clock and leave two weeks after they ran.
const live = settleLiveRecords(
  mergeAnnouncementRecords(previous.announcements, [...incomingById.values()])
    .filter((record) => !goneStreamIds.has(record.id) || record.reviewed_at),
  now,
);
if (goneStreamIds.size || live.dropped.length) console.log(`Dropped ${goneStreamIds.size} cancelled and ${live.dropped.length} past streams.`);
const merged = live.records;
// Magazine records an official source or the catalog already covers go first;
// the stored copy is dropped too, not only today's.
const magazine = dropMagazineDuplicates(merged, await readCatalogKits(COROCORO_FRANCHISES.map(({ franchise }) => franchise)));
if (magazine.dropped.length) console.log(`Dropped ${magazine.dropped.length} CoroCoro records covered by official sources or the catalog.`);
// A reveal follows its product: linked once the catalog has it, moved to
// preorder_open once an official post opens the preorder. Before the dedupe, so
// a post it drops still counts.
const stages = promoteRevealStages(linkRevealKits(
  magazine.records,
  await readCatalogKits([...new Set(TAMASHII_REVEAL_PAGES.map((page) => page.franchise))]),
));
for (const { id, from, to } of stages.promoted) console.log(`${id}: ${from} -> ${to}`);
const { records: announcements, dropped } = dedupeAnnouncements(stages.records, DEDUPE_PRIORITY);
if (dropped.length) console.log(`Dropped ${dropped.length} cross-source duplicates.`);
await cacheAnnouncementImages(announcements);
await writeFile(OUTPUT_PATH, `${JSON.stringify({
  updated_at: new Date().toISOString(),
  sources: SOURCES.map((source) => ({ source_id: source.id, name: source.name, url: source.url })),
  // A partial run (ANNOUNCEMENT_SOURCES) keeps the other sources' last errors.
  fetch_errors: ONLY_SOURCES.size
    ? [...(previous.fetch_errors || []).filter((error) => !ONLY_SOURCES.has(error.source_id)), ...errors]
    : errors,
  announcements,
}, null, 2)}\n`);

console.log(`Wrote ${announcements.length} announcements to ${OUTPUT_PATH}`);
