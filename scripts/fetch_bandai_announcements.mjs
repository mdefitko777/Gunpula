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
  thumbnailStaysRemote,
} from "./lib/bandai-announcements.mjs";
import {
  BEYBLADE_X_LINEUP_URL,
  GUNDAM_BASE_NEWS_URL,
  GUNDAM_OFFICIAL_NEWS_URL,
  KOTOBUKIYA_SHOP_BASE,
  KOTOBUKIYA_TITLES,
  LIGHT_SOURCE_IDS,
  POKEMON_FRIENDA_URL,
  POKEMON_KOREA_GOODS_SOURCE_ID,
  POKEMON_KOREA_GOODS_URL,
  PREMIUM_BANDAI_NEW_ITEMS_URL,
  TAKARATOMY_POKEMON_URL,
  TAMASHII_REVEAL_PAGES,
  TAMASHII_REVEALS_SOURCE_ID,
  TAMASHII_TOPICS_ITEMS_URL,
  YOUTUBE_CHANNELS,
  advanceStages,
  carryReplaced,
  createHostStops,
  dedupeAnnouncements,
  kotobukiyaAnnouncement,
  linkRevealKits,
  linkSourcePageKits,
  parseBeybladeLineup,
  parseFriendaTopics,
  parseGundamBaseNews,
  parseGundamOfficialNews,
  parseKotobukiyaTitleGoods,
  parsePremiumBandaiCategoryTitles,
  parsePokemonKoreaGoodsBanners,
  parsePremiumBandaiNewItems,
  parseTakaraTomyPokemonNews,
  parseTamashiiRevealBanners,
  carryFetchErrors,
  promoteRevealStages,
  stampAnnouncements,
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
import {
  TAMASHII_SCHEDULE_PAGE_URL,
  TAMASHII_SCHEDULE_SOURCE_ID,
  dropScheduleTwins,
  parseTamashiiSchedule,
  scheduleApiUrl,
  scheduleMonths,
  tamashiiKitsByItemId,
  tamashiiScheduleRecords,
} from "./lib/tamashii-schedule.mjs";
import {
  FIGSOKU_SOURCE_ID,
  HAMUSUKE_SOURCE_ID,
  UNOFFICIAL_SOURCES,
  UnexpectedPage,
  dropUnofficialDuplicates,
  keepsApart,
  runUnofficialSource,
  unofficialSource,
} from "./lib/unofficial-feeds.mjs";
import { loadRobots, robotsAllows } from "./lib/robots.mjs";
import {
  BEYBLADE_ORDER_TITLE,
  applyPreorder,
  beybladeOrderWindow,
  scheduleWindows,
  twinPreorders,
  withScheduleWindows,
  withTitlePreorders,
} from "./lib/preorder-times.mjs";
import {
  DETAILS_SCHEMA,
  EXTRACTOR_VERSION,
  LIGHT_RUN_DETAILS,
  kotobukiyaDetailsFromHtml,
  mergeDetails,
  parseTamashiiItemDetails,
  planDetailFetches,
} from "./lib/announcement-details.mjs";

const OUTPUT_PATH = "data/announcements.json";
// The product text behind announcements (lib/announcement-details.mjs), apart
// from the records the app reads on every refresh.
const DETAILS_PATH = "data/announcement-details.json";
// BEYBLADE X order notices whose body is read for the order window, at most per run.
const BEYBLADE_BODIES_PER_RUN = 2;
// Posts CoroCoro News already gave us, so each run reads only new ones.
const COROCORO_STATE_PATH = "data/announcements-corocoro.json";
// Reveals from the printed magazine that CoroCoro News has not written up (hand-entered).
const COROCORO_PRINT_PATH = "data/announcements-corocoro-print.json";
// YouTube videos already checked for being a stream, so each watch page is
// read once (and again only while its stream is still to come).
const LIVE_STATE_PATH = "data/announcements-live.json";
// What 魂ウェブ's schedule and the unofficial sites already offered, taken or
// passed over (lib/source-intake.mjs), so a first read does not file weeks of
// items as news.
const SCHEDULE_STATE_PATH = "data/announcements-tamashii-schedule.json";
const UNOFFICIAL_STATE_PATH = "data/announcements-unofficial.json";
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
// ANNOUNCEMENT_LIGHT=1: the announcements-only run of refresh-announcements.yml,
// several times a day, so a preorder posted in the morning gets its reminder
// before it opens. Only the makers' own lists (LIGHT_SOURCE_IDS), and product
// text only for new records (LIGHT_RUN_DETAILS); YouTube, the shop and the
// unofficial sites wait for the daily run.
const LIGHT = process.env.ANNOUNCEMENT_LIGHT === "1";
// Optional: comma-separated source ids to run (trying one source without
// fetching all the others); the others keep their stored records.
const ONLY_SOURCES = new Set(
  (process.env.ANNOUNCEMENT_SOURCES || (LIGHT ? LIGHT_SOURCE_IDS.join(",") : "")).split(",").map((id) => id.trim()).filter(Boolean),
);
// Optional, once after a parser fix: preorder times that have passed may be
// read again (they are frozen otherwise, lib/preorder-times.mjs).
const PREORDER_REPARSE = process.env.PREORDER_REPARSE === "1";

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
  // robots.txt before a host's first page. Until 2026-11-14 only the 魂ウェブ,
  // unofficial, CoroCoro, YouTube and event hosts were checked; GUNDAM.INFO,
  // p-bandai.jp, bandai-hobby.net and the Takara Tomy sites were read without it.
  const robots = await hostRobots(new URL(url).host);
  if (!robotsAllows(robots, url)) throw Object.assign(new Error(`${url} is disallowed by robots.txt`), { status: "robots" });
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
    if (!/^https?:/i.test(record.thumbnail_url || "") || thumbnailStaysRemote(record)) continue;
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
  const robots = await hostRobots(COROCORO_HOST);
  const { state, records, stopped } = await runCoroCoroSource({
    state: await readJson(COROCORO_STATE_PATH, emptyCoroCoroState()),
    printPosts: (await readJson(COROCORO_PRINT_PATH, {})).posts || [],
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

// robots.txt once a run per host, before its first page; sources that share a
// host (魂ウェブ's banners and its schedule) share the answer. A 403 there reads
// as "no robots.txt" but is the bot being turned away, so it stops the host
// like a 403 from a page. `load` is for a host whose answer needs reading
// differently (the event site, below).
const robotsByHost = new Map();
function hostRobots(host, load = loadHostRobots) {
  if (!robotsByHost.has(host)) robotsByHost.set(host, load(host));
  return robotsByHost.get(host);
}

async function loadHostRobots(host) {
  const url = `https://${host}/robots.txt`;
  await waitForHost(url);
  const robots = await loadRobots(host, { userAgent: USER_AGENT });
  console.log(`${host}: robots.txt ${robots.status}`);
  hostStops.record(url, Number.parseInt(robots.status, 10));
  return robots;
}

// Robots first (2026-11-12: tamashiiweb.com has no robots.txt, a 404), then one
// work page per day.
async function runTamashiiReveals() {
  const robots = await hostRobots(new URL(TAMASHII_REVEAL_PAGES[0].url).host);
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

// 魂ウェブ item id → preorder window from the schedule (lib/preorder-times.mjs).
const preorderWindows = new Map();
// Record id → goods-page HTML a source already read this run (コトブキヤ), for its product text.
const detailPages = new Map();

// The month in progress and the next: two requests a run (lib/tamashii-schedule.mjs).
async function runTamashiiSchedule() {
  const robots = await hostRobots(new URL(TAMASHII_SCHEDULE_PAGE_URL).host);
  const [thisMonth, nextMonth] = scheduleMonths(today);
  const items = new Map();
  for (const month of [thisMonth, nextMonth]) {
    const url = scheduleApiUrl(month);
    if (!robotsAllows(robots, url)) throw new Error(`${url} is disallowed by robots.txt`);
    const parsed = parseTamashiiSchedule(await fetchJson(url));
    // The month in progress always lists something; an answer without rows is not the schedule.
    if (!parsed.rows && month === thisMonth) throw new Error(`${url} lists no items`);
    console.log(`${TAMASHII_SCHEDULE_SOURCE_ID}: ${month}: ${parsed.rows} rows, ${parsed.items.length} items`);
    for (const item of parsed.items) if (!items.has(item.tamashiiWebId)) items.set(item.tamashiiWebId, item);
  }
  // Every listed item's window, also for the posts of items it files no record for.
  for (const [itemId, window] of scheduleWindows([...items.values()])) preorderWindows.set(itemId, window);
  // 魂ウェブ products are in the catalog for these worlds ("tamashii-16259", "tamashii-fate-13377").
  const kits = await readCatalogKits(["gundam", "fate", "madoka"]);
  const { records, state } = tamashiiScheduleRecords([...items.values()], {
    today,
    state: await readJson(SCHEDULE_STATE_PATH, {}),
    kitsByItemId: tamashiiKitsByItemId([...kits.values()].flat()),
    stored: previousById,
  });
  await writeFile(SCHEDULE_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
  return records;
}

// One file for all unofficial sources: source id → what the site already offered.
let unofficialState = null;

// Fan blogs and hobby media (lib/unofficial-feeds.mjs): robots.txt first, then
// the feed or list page, and nothing more for the run once a site answers with
// something other than what was asked for.
async function runUnofficial(source) {
  const robots = await hostRobots(source.host);
  unofficialState ||= await readJson(UNOFFICIAL_STATE_PATH, {});
  try {
    const { records, state } = await runUnofficialSource(source, {
      state: unofficialState[source.id] || {},
      today,
      stored: previousById,
      fetchText,
      robotsAllows: (url) => robotsAllows(robots, url),
      // A picture can sit on another host (電撃オンライン's image server), with its own robots.txt.
      imageAllowed: async (url) => robotsAllows(await hostRobots(new URL(url).host), url),
      log: (line) => console.log(line),
    });
    unofficialState = { ...unofficialState, [source.id]: state };
    await writeFile(UNOFFICIAL_STATE_PATH, `${JSON.stringify(unofficialState, null, 2)}\n`);
    return records;
  } catch (error) {
    // A page that came with a 200 but is not the feed is a bot check until shown otherwise.
    if (error instanceof UnexpectedPage) hostStops.stop(`https://${source.host}/`, "an unexpected page");
    throw error;
  }
}

function unofficialEntry(id) {
  const source = unofficialSource(id);
  return { id: source.id, name: source.name, url: source.url, run: () => runUnofficial(source) };
}

// YouTube streams the event site links; read by the YouTube source after it.
const linkedStreams = [];
// Stored streams YouTube no longer has (cancelled, made private).
const goneStreamIds = new Set();

// The show's site, only around the show. Its robots.txt is S3's 403 for a
// missing file (2026-11-12): none published. Any other 403 there stops the
// host, as a 403 from a page would.
async function loadEventRobots(host) {
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
  // S3's missing-file answer is a 403; logged as what it is, so a search of the
  // run log for 403s finds only real refusals.
  console.log(`${host}: robots.txt ${missingFile ? "none published (S3 missing file): all allowed" : robots.status}`);
  if (!missingFile) hostStops.record(robotsUrl, Number.parseInt(robots.status, 10));
  return robots;
}

async function runTamashiiNationLive() {
  if (!eventInSeason(TAMASHII_NATION_EVENT, today)) return [];
  const robots = await hostRobots(new URL(TAMASHII_NATION_EVENT.pages[0]).host, loadEventRobots);
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

// robots.txt once a run, before the first YouTube page. Upload lists and watch
// pages only: it keeps "*" out of /feeds/videos.xml (see lib/live-streams.mjs).
function loadYoutubeRobots() {
  return hostRobots(YOUTUBE_HOST);
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

// One page after the lists: robots.txt first, and a host that stopped the run
// (403/429/503 or a bot check) is skipped. Returns the HTML, or
// { status } / { stopped } when there is none.
async function readPage(url) {
  try {
    hostStops.check(url);
  } catch {
    return { stopped: true };
  }
  const robots = await hostRobots(new URL(url).host);
  if (!robotsAllows(robots, url)) return { status: "robots" };
  try {
    return { html: await fetchText(url) };
  } catch (error) {
    return [403, 429, 503].includes(error.status) ? { stopped: true } : { status: error.status || error.message };
  }
}

// BEYBLADE X 受注生産 / 抽選販売 notices: the order window is only in the body
// (lib/preorder-times.mjs). Each is read once; `bodiesRead`: id → day read.
async function readBeybladeBodies(records, bodiesRead) {
  const due = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) => record.source_id === "beyblade_x_news" && BEYBLADE_ORDER_TITLE.test(record.names?.ja || "")
      && !record.preorder_at && !bodiesRead[record.id])
    .slice(0, BEYBLADE_BODIES_PER_RUN);
  for (const { record, index } of due) {
    const page = await readPage(record.source_url);
    if (page.stopped) break;
    if (!page.html) {
      console.warn(`${record.id}: body not read (${page.status})`);
      // A page that is gone or off limits would otherwise take one of the two
      // places every run and keep the next notice waiting.
      if ([404, 410, "robots"].includes(page.status)) bodiesRead[record.id] = today;
      continue;
    }
    bodiesRead[record.id] = today;
    const window = beybladeOrderWindow(page.html);
    console.log(`${record.id}: order window ${window ? `${window.at} - ${window.end_at || "?"}` : "not in the body"}`);
    records[index] = applyPreorder(record, window, preorderOptions);
  }
}

// The product text behind the announcements (lib/announcement-details.mjs):
// at most a few pages per host and run; data/announcement-details.json.
async function readDetails(records, previousDetails) {
  const plan = planDetailFetches(records, previousDetails, today, {
    preloaded: new Set(detailPages.keys()),
    ...(LIGHT ? LIGHT_RUN_DETAILS : {}),
  });
  const results = new Map();
  let ok = 0;
  for (const { id, url, source, reason } of plan) {
    const page = detailPages.has(id) ? { html: detailPages.get(id) } : await readPage(url);
    if (page.stopped) continue;
    if (!page.html) {
      results.set(id, { url, error: page.status === 404 ? "gone" : `HTTP ${page.status}`, gone: page.status === 404 });
      continue;
    }
    const parsed = source === "tamashii" ? parseTamashiiItemDetails(page.html, url) : kotobukiyaDetailsFromHtml(page.html, url);
    if (parsed.challenge) {
      hostStops.stop(url, "a page that is not the product page");
      continue;
    }
    results.set(id, parsed.entry ? { url, entry: parsed.entry } : { url, error: parsed.error });
    if (parsed.entry) ok += 1;
    else console.warn(`${id}: ${parsed.error} (${reason})`);
  }
  console.log(`announcement details: planned ${plan.length}, read ${results.size}, ok ${ok}`);
  return mergeDetails(previousDetails, results, new Set(records.map((record) => record.id)), today);
}

async function readPostBodiesAndDetails(records) {
  const previousDetails = await readJson(DETAILS_PATH, {});
  const bodiesRead = { ...(previousDetails.bodies_read || {}) };
  await readBeybladeBodies(records, bodiesRead);
  const details = await readDetails(records, previousDetails.details || {});
  const liveIds = new Set(records.map((record) => record.id));
  const bodies = Object.fromEntries(Object.entries(bodiesRead).filter(([id]) => liveIds.has(id)).sort(([a], [b]) => a.localeCompare(b)));
  const unchanged = JSON.stringify(details) === JSON.stringify(previousDetails.details || {})
    && JSON.stringify(bodies) === JSON.stringify(previousDetails.bodies_read || {})
    && previousDetails.extractor_version === EXTRACTOR_VERSION;
  if (unchanged) return;
  await writeFile(DETAILS_PATH, `${JSON.stringify({
    schema: DETAILS_SCHEMA,
    updated_at: new Date().toISOString(),
    extractor_version: EXTRACTOR_VERSION,
    details,
    // Order notices whose body was read (id → day): each is read once.
    bodies_read: bodies,
  }, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(details).length} announcement details to ${DETAILS_PATH}`);
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
    // The monthly sales schedule: preorder windows, release months, and items
    // no topic post announces (resales, later lottery batches, store exclusives).
    id: TAMASHII_SCHEDULE_SOURCE_ID,
    name: "TAMASHII WEB",
    url: TAMASHII_SCHEDULE_PAGE_URL,
    run: runTamashiiSchedule,
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
    // Korean goods news (collaborations, Korean releases), 1–4 banners a month: the daily
    // run is enough, so it is not a light source.
    id: POKEMON_KOREA_GOODS_SOURCE_ID,
    name: "포켓몬코리아",
    url: POKEMON_KOREA_GOODS_URL,
    run: async () => {
      const parsed = parsePokemonKoreaGoodsBanners(await fetchText(POKEMON_KOREA_GOODS_URL), { today });
      // A page without the slider is a markup change, not a quiet day.
      if (!parsed.slides) throw new Error(`${POKEMON_KOREA_GOODS_URL} has no banner slides`);
      return parsed.records;
    },
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
          // Read once: the product text comes from the same page.
          detailPages.set(`kotobukiya-${item.code}`, detailHtml);
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
  // Unofficial from here on, after the makers' own pages and stores, so an
  // official post about the same product wins. The bey blog stands before the
  // magazine: of two records of one bey, the one with the product code, the
  // release day and the product picture stays.
  unofficialEntry(HAMUSUKE_SOURCE_ID),
  {
    // Magazine scoops.
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
  // Hobby media and figure news, in the order their records win over each
  // other when two sites report one product.
  ...UNOFFICIAL_SOURCES.filter((source) => source.id !== HAMUSUKE_SOURCE_ID).map((source) => unofficialEntry(source.id)),
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

// A renamed source would silently drop out of the light runs.
const unknownSources = [...ONLY_SOURCES].filter((id) => !DEDUPE_PRIORITY.includes(id));
if (unknownSources.length) throw new Error(`Unknown announcement sources: ${unknownSources.join(", ")}`);

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

// Preorder times only move forward; what moved and what disagrees is logged.
const preorderOptions = { now, reparse: PREORDER_REPARSE, log: (line) => console.log(line) };
// Streams follow the clock and leave two weeks after they ran.
const live = settleLiveRecords(
  mergeAnnouncementRecords(previous.announcements, [...incomingById.values()], preorderOptions)
    .filter((record) => !goneStreamIds.has(record.id) || record.reviewed_at),
  now,
);
if (goneStreamIds.size || live.dropped.length) console.log(`Dropped ${goneStreamIds.size} cancelled and ${live.dropped.length} past streams.`);
// When each preorder opens: the title's 「11/13 18時より」 (stored history too),
// then the 魂ウェブ schedule's window for the posts of its items.
const timed = withScheduleWindows(withTitlePreorders(live.records, preorderOptions), preorderWindows, preorderOptions);
// The merge keeps a stored status; listings that report the stage themselves
// (the schedule once a preorder opens, fig速's 【予約開始】) move their record on.
const STAGE_SOURCE_IDS = new Set([TAMASHII_SCHEDULE_SOURCE_ID, FIGSOKU_SOURCE_ID]);
const staged = advanceStages(timed, [...incomingById.values()].filter((record) => STAGE_SOURCE_IDS.has(record.source_id)));
for (const { id, from, to } of staged.advanced) console.log(`${id}: ${from} -> ${to}`);
// Magazine and fan-blog records an official source or the catalog already
// covers go first; the stored copy is dropped too, not only today's.
const magazine = dropMagazineDuplicates(
  staged.records,
  await readCatalogKits(COROCORO_FRANCHISES.map(({ franchise }) => franchise)),
  { sourceIds: [COROCORO_SOURCE_ID, HAMUSUKE_SOURCE_ID] },
);
if (magazine.dropped.length) console.log(`Dropped ${magazine.dropped.length} CoroCoro and fan-blog records covered by official sources or the catalog.`);
// So do media and figure posts whose products official records already name.
const media = dropUnofficialDuplicates(magazine.records);
if (media.dropped.length) console.log(`Dropped ${media.dropped.length} media records covered by official sources.`);
// A reveal follows its product: linked once the catalog has it, moved to
// preorder_open once an official post opens the preorder. Before the dedupe, so
// a post it drops still counts.
const stages = promoteRevealStages(linkRevealKits(
  media.records,
  await readCatalogKits([...new Set(TAMASHII_REVEAL_PAGES.map((page) => page.franchise))]),
));
for (const { id, from, to } of stages.promoted) console.log(`${id}: ${from} -> ${to}`);
// After the reveals: a schedule row may move one to preorder_open before a
// post, or the reveal itself, replaces the row.
const schedule = dropScheduleTwins(stages.records);
if (schedule.dropped.length) console.log(`Dropped ${schedule.dropped.length} schedule records other official records already tell.`);
// A fan-blog post and a magazine scoop of one bey are twins, the blog first
// (keepsApart): it has the product picture.
const deduped = dedupeAnnouncements(schedule.records, DEDUPE_PRIORITY, { separate: keepsApart() });
const { dropped } = deduped;
if (dropped.length) console.log(`Dropped ${dropped.length} cross-source duplicates.`);
// A record that stays for a dropped twin takes the twin's preorder time when
// it has none (the reveal or the topic post of キュリオス, whichever stays).
const twinPool = new Map([...staged.records, ...stages.records].map((record) => [record.id, record]));
const twinTimes = twinPreorders(twinPool, [...magazine.dropped, ...media.dropped, ...schedule.dropped, ...dropped], preorderOptions);
// Then each record linked to the catalog product whose own page it is.
const sourceLinks = linkSourcePageKits(
  deduped.records.map((record) => applyPreorder(record, twinTimes.get(record.id), { ...preorderOptions, fillOnly: true })),
  [...(await readCatalogKits(["gundam", "pokemon", "fate", "beyblade", "armored_core", "madoka"])).values()].flat(),
);
if (sourceLinks.linked.length) console.log(`Linked ${sourceLinks.linked.length} records to the catalog product of their page.`);
const announcements = sourceLinks.records;
// Where each published record dropped above went, so a follow in the app moves with it.
const replacements = carryReplaced({
  replaced: previous.replaced,
  replacedAt: previous.replaced_at,
  drops: [...magazine.dropped, ...media.dropped, ...schedule.dropped, ...dropped],
  publishedIds: new Set(previousById.keys()),
  keptIds: new Set(announcements.map((record) => record.id)),
  today,
});
for (const [id, kept] of Object.entries(replacements.replaced)) {
  if (!previous.replaced?.[id]) console.log(`${id}: replaced by ${kept}`);
}
await cacheAnnouncementImages(announcements);
// Pages read after the lists: BEYBLADE X order windows and the product text.
// A failure here leaves both as they were and never stops the write below.
try {
  await readPostBodiesAndDetails(announcements);
} catch (error) {
  errors.push({ source_id: "announcement_details", message: error.message });
  console.warn(`announcement_details: ${error.message}`);
}
// The file as it is on disk (`previous` was tidied on reading), for the stamp.
await writeFile(OUTPUT_PATH, `${JSON.stringify(stampAnnouncements(await readJson(OUTPUT_PATH, null), {
  sources: SOURCES.map((source) => ({ source_id: source.id, name: source.name, url: source.url })),
  // A partial run (ANNOUNCEMENT_SOURCES, a light run) keeps the other sources' last errors.
  fetch_errors: carryFetchErrors(previous.fetch_errors, errors, ONLY_SOURCES),
  ...replacements,
  announcements,
}, new Date().toISOString()), null, 2)}\n`);

console.log(`Wrote ${announcements.length} announcements to ${OUTPUT_PATH}`);
