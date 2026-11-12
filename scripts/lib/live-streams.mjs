// Official livestream schedules for the announcement feed: when a stream starts
// and where to watch it. Read by scripts/fetch_bandai_announcements.mjs.
//
// A live record is an ordinary announcement record (status "announced") with
// two more optional fields:
//   live_at     start, ISO 8601 with Japan's offset ("2026-11-13T21:00:00+09:00"),
//               or null while the source gives a day but no time
//   live_state  "upcoming" | "live" | "ended", as of the run that wrote it. The
//               feed is rebuilt about once a day, so a reader compares live_at
//               with its own clock instead of trusting "upcoming".
// A YouTube stream has source_type "youtube" and video_id; a stream on another
// site (Premium Bandai live shopping) has source_type "news" and that page as
// source_url. A product video that is also a stream keeps its own record and
// gains the two fields. Ended streams stay 14 days (the archive is worth a
// link), then go.
//
// The channels' product-video sources read the same upload lists
// (runYoutubeVideoSource, at the end of the YouTube part): one request per
// channel a run serves both.
//
// Measured 2026-11-12 with this bot's user-agent (KR IP):
//   www.youtube.com/robots.txt  "*" may not read /feeds/videos.xml (the channel
//                               feeds: not used; the product-video sources read
//                               them until this day, and GitHub's runners got 404
//                               from them on and off since 11-01) but may read
//                               /playlist, /watch and /oembed
//   /playlist?list=UU<channel>  the channel's ~100 newest uploads (videos,
//                               premieres, streams) in one page, ~300 kB gzipped;
//                               the data is in "var ytInitialData = {…}" or, on
//                               some answers, in <script id="yt-initial-data">.
//                               A scheduled stream has the badge 配信予定 instead
//                               of a length and "2026/11/12 1:00 に公開予定" — US
//                               Pacific time with no zone — so the time is never
//                               taken from the list. Other rows give an age
//                               ("5 時間前", "8 日前", "2 週間前"), never a date
//   /watch?v=<id>               ytInitialPlayerResponse: liveBroadcastDetails
//                               { isLiveNow, startTimestamp, endTimestamp } for
//                               streams and premieres, plus scheduledStartTime
//                               (epoch seconds) while upcoming
//   /oembed                     title and channel only, no time
//   tamashii-nation.tamashiiweb.com  static pages on S3. robots.txt answers S3's
//                               403 AccessDenied XML (its "no such file", see
//                               isMissingS3File): none published; pages are 200.
//                               Any other 403 there stops the host for the run
// Not measured: GitHub's runners. YouTube may answer them with a sign-in bot
// check; the source then stops for the run, stored streams keep the time they
// have, and a newly listed one is recorded without a time (live_at null).
import { absoluteUrl, franchiseForAnnouncement, productVideoRecords, shiftDay, stripTags } from "./bandai-announcements.mjs";
import { YOUTUBE_CHANNELS, announcementRecord, balancedObjectAfter, stableHash } from "./official-announcements.mjs";

export const YOUTUBE_LIVE_SOURCE_ID = "youtube_live";
export const EVENT_LIVE_SOURCE_ID = "tamashii_nation_live";
export const LIVE_SOURCE_IDS = new Set([YOUTUBE_LIVE_SOURCE_ID, EVENT_LIVE_SOURCE_ID]);
// How long an ended stream stays in the feed. A finished stream a channel list
// already calls "2 週間前" (14 to 20 days) is past it and is not looked at.
export const LIVE_KEEP_DAYS = 14;
// Watch pages per run: the streams still to come first, then new finds.
export const MAX_WATCH_PAGES = 8;
// A YouTube stream still marked upcoming or live this long after its start was
// not refreshed (or never started); the longest archive seen was 3 h 49 min.
const STALE_HOURS = 12;
// A stream on a page that gives only a start time. Premium Bandai's
// live-shopping archives run 44 min to 2 h 08 min.
const ASSUMED_LIVE_HOURS = 2;
// Checked videos are remembered this long: a list offers a finished stream for
// two weeks, and a watch page read once must not be read again in that time.
const CHECKED_KEEP_DAYS = 30;

// The product-video channels under the same record ids and names
// (bandai-youtube-<id>, youtube-<id>), so a video is one record whichever
// source saw it. 魂ネイションズ has no channel of its own: tamashiiweb.com
// links the "TAMASHII STATION" playlist of the BANDAI SPIRITS channel.
// タカラトミー: linked from beyblade.takaratomy.co.jp next to ベイチューブ.
export const LIVE_CHANNELS = [
  ...YOUTUBE_CHANNELS.map(({ channelId, name, idPrefix, defaultFranchise }) => ({ channelId, name, idPrefix, defaultFranchise })),
  { channelId: "UClVgBLXWrw3TV4Wm0d7qrFQ", name: "タカラトミー YouTube", idPrefix: "youtube", defaultFranchise: null },
];

// TAMASHII NATION, the yearly 魂ネイションズ show in Akihabara (2026: 11/13–15,
// streams 11/12–14, announced on the site on 11/6). The site is read only
// around the show, from mid-October to the end of November.
export const TAMASHII_NATION_EVENT = {
  name: "TAMASHII NATION",
  pages: ["https://tamashii-nation.tamashiiweb.com/", "https://tamashii-nation.tamashiiweb.com/live/"],
  // Every Bandai line shows there. Filed under Gundam on the owner's request
  // (2026-11-12): METAL BUILD ガンダムキュリオス was revealed on its stream.
  franchise: "gundam",
  season: { from: "10-15", to: "11-30" },
};

export function eventInSeason(event, today) {
  const monthDay = String(today).slice(5);
  return monthDay >= event.season.from && monthDay <= event.season.to;
}

/**
 * Is this answer S3 saying "no such file"? A bucket that visitors may read but
 * not list answers 403 AccessDenied for a key that does not exist, where another
 * server says 404. Only this exact answer is read as "no robots.txt"; any other
 * 403 is the site turning the bot away.
 */
export function isMissingS3File({ status, server, body }) {
  return status === 403
    && String(server || "").trim() === "AmazonS3"
    && String(body || "").includes("<Error><Code>AccessDenied</Code>");
}

export function youtubeUploadsUrl(channelId) {
  return `https://www.youtube.com/playlist?list=UU${channelId.slice(2)}`;
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** "2026-11-12T18:00:00+09:00" for an instant, cut to the minute (a stream that went live reports 18:00:09). */
export function japanIso(ms) {
  if (!Number.isFinite(ms)) return null;
  return `${new Date(ms + 9 * 3600000).toISOString().slice(0, 16)}:00+09:00`;
}

function japanDate(ms) {
  return Number.isFinite(ms) ? new Date(ms + 9 * 3600000).toISOString().slice(0, 10) : null;
}

// ---------------------------------------------------------------------------
// YouTube pages. Nothing is run: the pages carry their data as JSON text.

/** The object a YouTube page embeds as `name` ("ytInitialData", "ytInitialPlayerResponse"), or null. */
export function youtubeEmbeddedJson(html, name) {
  const text = String(html || "");
  const element = name === "ytInitialData"
    ? /<script[^>]*\bid="yt-initial-data"[^>]*>([\s\S]*?)<\/script>/.exec(text)?.[1]
    : null;
  try {
    return JSON.parse(element || balancedObjectAfter(text, `${name} = `));
  } catch {
    return null;
  }
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node);
  for (const child of Object.values(node)) walk(child, visit);
}

const VIDEO_LENGTH = /^\d+(?::\d{2})+$/;
const AGE_UNITS = [
  [/(\d+)\s*(?:秒|分|時間)\s*前|(\d+)\s*(?:second|minute|hour)s?\s+ago/i, 0],
  [/(\d+)\s*日\s*前|(\d+)\s*days?\s+ago/i, 1],
  [/(\d+)\s*週間\s*前|(\d+)\s*weeks?\s+ago/i, 7],
  [/(\d+)\s*[かヶ]月\s*前|(\d+)\s*months?\s+ago/i, 30],
  [/(\d+)\s*年\s*前|(\d+)\s*years?\s+ago/i, 365],
];

/** "2 週間前 に配信済み" → 14; null when the row gives no age (a scheduled stream). */
export function listedAgeDays(text) {
  for (const [pattern, days] of AGE_UNITS) {
    const match = pattern.exec(String(text || ""));
    if (match) return Number(match[1] || match[2]) * days;
  }
  return null;
}

/**
 * The videos a channel or playlist page lists, newest first:
 * { videoId, title, scheduled, streamed, ageDays }. `scheduled`: the thumbnail
 * carries a badge (配信予定, ライブ) where a finished video has its length.
 * An empty list means the page is not a video list (consent page, bot check,
 * new markup).
 */
export function parseYoutubeListing(html) {
  const items = [];
  const seen = new Set();
  walk(youtubeEmbeddedJson(html, "ytInitialData"), (node) => {
    const video = node.lockupViewModel;
    if (!video?.contentId || video.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO" || seen.has(video.contentId)) return;
    seen.add(video.contentId);
    const badges = [];
    walk(video.contentImage, (part) => {
      if (part.thumbnailBadgeViewModel?.text) badges.push(part.thumbnailBadgeViewModel.text);
    });
    const rows = [];
    walk(video.metadata?.lockupMetadataViewModel?.metadata, (part) => {
      if (typeof part.content === "string") rows.push(part.content);
    });
    const text = rows.join(" ");
    items.push({
      videoId: video.contentId,
      title: String(video.metadata?.lockupMetadataViewModel?.title?.content || "").trim(),
      scheduled: !badges.some((badge) => VIDEO_LENGTH.test(badge)),
      streamed: /配信済み|streamed/i.test(text),
      ageDays: listedAgeDays(text),
    });
  });
  return items;
}

// A premiere that already ran looks like any other video in the list, so the
// title has to say it was a broadcast.
const BROADCAST_TITLE = /生配信|生放送|ライブ配信|LIVE配信|プレミア公開|NEWS\s*NETWORK|発表会|特番/i;
// The show's own programmes name whichever works headline that year
// ("【TAMASHII NEWS NETWORK】…ONE PIECE、鬼滅の刃、仮面ライダー、初解禁！" was
// where METAL BUILD ガンダムキュリオス was revealed), so they are not judged by
// the works in the title. Not the brand (TAMASHII NATIONS, 魂ネイションズ).
const TAMASHII_NATION_PROGRAMME = /TAMASHII\s*NATION(?!S)|TAMASHII\s*NEWS\s*NETWORK|魂ネイション(?!ズ)/i;

export function liveFranchise(title, defaultFranchise = null) {
  return franchiseForAnnouncement(title, defaultFranchise)
    || (TAMASHII_NATION_PROGRAMME.test(title) ? TAMASHII_NATION_EVENT.franchise : null);
}

/**
 * Should this listed video's watch page be read? → { videoId, title, franchise, why }
 * or null. Streams about works the app does not cover are left out before any
 * request is made.
 */
export function liveCandidate(item, channel) {
  if (!item?.videoId || /#shorts/i.test(item.title)) return null;
  const franchise = liveFranchise(item.title, channel.defaultFranchise);
  if (!franchise) return null;
  const candidate = { videoId: item.videoId, title: item.title, franchise };
  if (item.scheduled) return { ...candidate, why: "scheduled" };
  if (item.ageDays === null || item.ageDays >= LIVE_KEEP_DAYS) return null;
  if (item.streamed) return { ...candidate, why: "streamed" };
  return BROADCAST_TITLE.test(item.title) ? { ...candidate, why: "title" } : null;
}

/**
 * A watch page →
 *   { outcome: "stream", videoId, title, channelId, channelName, publishedAt, liveAt, liveState }
 *   { outcome: "video", … }    an ordinary upload
 *   { outcome: "gone", reason }     removed or made private
 *   { outcome: "blocked", reason }  no player data: a bot check, a consent page or new markup
 */
export function parseYoutubeWatch(html) {
  const player = youtubeEmbeddedJson(html, "ytInitialPlayerResponse");
  const status = player?.playabilityStatus?.status || "";
  const reason = player?.playabilityStatus?.reason || status || "no player data in the page";
  const micro = player?.microformat?.playerMicroformatRenderer;
  if (!micro) {
    // Only what YouTube says outright is believed; every other page without
    // video data (sign-in walls included) counts as a bot check.
    return { outcome: status === "ERROR" || /非公開|private/i.test(reason) ? "gone" : "blocked", reason };
  }
  const details = player.videoDetails || {};
  const base = {
    videoId: micro.externalVideoId || details.videoId || null,
    title: String(micro.title?.simpleText || details.title || "").trim(),
    channelId: micro.externalChannelId || details.channelId || null,
    channelName: micro.ownerChannelName || details.author || null,
    publishedAt: japanDate(Date.parse(micro.publishDate || "")),
  };
  const broadcast = micro.liveBroadcastDetails;
  if (!broadcast) return { outcome: "video", ...base };
  const slate = player.playabilityStatus?.liveStreamability?.liveStreamabilityRenderer?.offlineSlate?.liveStreamOfflineSlateRenderer;
  const scheduled = Number(slate?.scheduledStartTime) * 1000;
  const liveState = broadcast.isLiveNow
    ? "live"
    : !broadcast.endTimestamp && (details.isUpcoming || status === "LIVE_STREAM_OFFLINE") ? "upcoming" : "ended";
  return {
    outcome: "stream",
    ...base,
    liveAt: japanIso(scheduled || Date.parse(broadcast.startTimestamp || "")),
    liveState,
  };
}

// A stream reports its real start once it is live (18:00 scheduled, 18:03
// started); the scheduled time people were told stays.
function steadyLiveAt(storedAt, liveAt) {
  if (!storedAt || !liveAt) return liveAt || storedAt || null;
  return Math.abs(Date.parse(storedAt) - Date.parse(liveAt)) <= 15 * 60000 ? storedAt : liveAt;
}

/**
 * The record for a stream as its watch page describes it (or its list entry:
 * then liveAt is null). `stored`: the record this video already has, if any.
 * One from a product-video source is kept as it is and only gains the time.
 */
export function liveStreamRecord({ stream, channel, franchise, stored = null, today }) {
  const live = { live_at: steadyLiveAt(stored?.live_at, stream.liveAt), live_state: stream.liveState };
  if (stored && !LIVE_SOURCE_IDS.has(stored.source_id)) return { ...stored, ...live };
  return {
    ...announcementRecord({
      id: `${channel.idPrefix || "youtube"}-${stream.videoId}`,
      sourceId: YOUTUBE_LIVE_SOURCE_ID,
      franchise,
      title: stream.title,
      status: "announced",
      // The day the stream page went up; it moves to the stream's own day once
      // it has run, so the first value is kept.
      announcedAt: stored?.announced_at || stream.publishedAt || today,
      announcedAtBasis: stored?.announced_at_basis || (stream.publishedAt ? null : "first_seen"),
      sourceType: "youtube",
      sourceName: channel.name,
      sourceUrl: youtubeWatchUrl(stream.videoId),
      thumbnailUrl: `https://i.ytimg.com/vi/${stream.videoId}/hqdefault.jpg`,
      videoId: stream.videoId,
    }),
    ...live,
  };
}

// The statuses the fetcher stops a host for (createHostStops).
const saidStop = (error) => [403, 429, 503].includes(error?.status);

/**
 * A channel's upload list → { url, items, stopped }: `stopped` says why
 * YouTube must not be asked again this run. A failed request throws.
 */
async function readUploads(channel, { fetchText, robotsAllows }) {
  const url = youtubeUploadsUrl(channel.channelId);
  if (!robotsAllows(url)) return { url, items: [], stopped: `${url} is disallowed by robots.txt` };
  const items = parseYoutubeListing(await fetchText(url));
  return { url, items, stopped: items.length ? null : `${url} has no video list (a consent or bot-check page, or new markup)` };
}

/**
 * Reads the channels' upload lists and the watch pages of the streams found
 * there, at most `maxWatchPages` of them: streams already stored as upcoming or
 * live first (their time or state may have moved), then scheduled ones, then
 * recent finished ones. A video is read again only while it is still to come.
 * A scheduled stream whose watch page could not be read (bot check, the cap)
 * is recorded from the list alone, without a time, until a later run reads it;
 * it ends when the list stops calling it scheduled.
 *   hints   [{ videoId, franchise }] streams an official page links (event sites)
 *   stored  last run's announcement records
 *   state   { videos: { <videoId>: { checked_at } } } — settled videos
 * → { records, gone, state, stopped, problems }: `gone` are ids of stored
 * streams that were taken down; `stopped` is set when YouTube must not be asked
 * again this run.
 */
export async function runYoutubeLiveSource({
  channels = LIVE_CHANNELS,
  hints = [],
  stored = [],
  state = {},
  today,
  fetchText,
  robotsAllows = () => true,
  maxWatchPages = MAX_WATCH_PAGES,
  log = () => {},
}) {
  const checked = new Map(Object.entries(state?.videos || {}));
  const storedByVideo = new Map(stored.filter((record) => record.video_id).map((record) => [record.video_id, record]));
  const channelById = new Map(channels.map((channel) => [channel.channelId, channel]));
  const listed = new Map();
  const queue = new Map();
  const enqueue = (entry) => {
    if (!queue.has(entry.videoId)) queue.set(entry.videoId, entry);
  };
  const problems = [];
  let stopped = null;

  const pending = stored
    .filter((record) => record.video_id && (record.live_state === "upcoming" || record.live_state === "live"))
    .sort((a, b) => String(a.live_at || "").localeCompare(String(b.live_at || "")));
  for (const record of pending) enqueue({ videoId: record.video_id, franchise: record.franchise, rank: 0 });

  for (const channel of channels) {
    if (stopped) break;
    try {
      const { items, stopped: why } = await readUploads(channel, { fetchText, robotsAllows });
      if (why) {
        stopped = why;
        break;
      }
      for (const item of items) listed.set(item.videoId, item);
      const found = items
        .map((item) => liveCandidate(item, channel))
        .filter((candidate) => candidate && !checked.has(candidate.videoId));
      for (const candidate of found) enqueue({ ...candidate, channel, rank: candidate.why === "scheduled" ? 1 : 2 });
      log(`${YOUTUBE_LIVE_SOURCE_ID}: ${channel.name}: ${items.length} uploads listed, ${found.length} to check`);
    } catch (error) {
      if (saidStop(error)) stopped = error.message;
      else problems.push(`${channel.name}: ${error.message}`);
    }
  }
  for (const hint of hints) {
    if (!checked.has(hint.videoId)) enqueue({ videoId: hint.videoId, franchise: hint.franchise, rank: 1 });
  }

  const records = [];
  const gone = [];
  const answered = new Set();
  const order = [...queue.values()].sort((a, b) => a.rank - b.rank);
  let read = 0;
  for (const entry of order) {
    if (stopped) break;
    if (read >= maxWatchPages) {
      log(`${YOUTUBE_LIVE_SOURCE_ID}: ${queue.size - read} more videos left for the next run`);
      break;
    }
    const url = youtubeWatchUrl(entry.videoId);
    if (!robotsAllows(url)) {
      stopped = `${url} is disallowed by robots.txt`;
      break;
    }
    read += 1;
    let watch;
    try {
      watch = parseYoutubeWatch(await fetchText(url));
    } catch (error) {
      if (saidStop(error)) stopped = error.message;
      else problems.push(`${entry.videoId}: ${error.message}`);
      continue;
    }
    if (watch.outcome === "blocked") {
      stopped = `${url} has no video data (${watch.reason})`;
      break;
    }
    answered.add(entry.videoId);
    const known = storedByVideo.get(entry.videoId) || null;
    const settle = () => checked.set(entry.videoId, { checked_at: today });
    if (watch.outcome === "gone") {
      // A scheduled stream that was cancelled or made private.
      if (known && LIVE_SOURCE_IDS.has(known.source_id)) gone.push(known.id);
      settle();
      continue;
    }
    const channel = entry.channel || channelById.get(watch.channelId)
      || { name: `${watch.channelName || "YouTube"} YouTube`, idPrefix: "youtube", defaultFranchise: null };
    const franchise = known?.franchise || entry.franchise || liveFranchise(watch.title, channel.defaultFranchise);
    if (watch.outcome !== "stream" || !franchise) {
      settle();
      continue;
    }
    records.push(liveStreamRecord({ stream: watch, channel, franchise, stored: known, today }));
    if (watch.liveState === "ended") settle();
  }
  for (const entry of order) {
    if (entry.why !== "scheduled" || answered.has(entry.videoId) || storedByVideo.has(entry.videoId)) continue;
    const stream = { videoId: entry.videoId, title: entry.title, publishedAt: null, liveAt: null, liveState: "upcoming" };
    records.push(liveStreamRecord({ stream, channel: entry.channel, franchise: entry.franchise, today }));
  }
  // Such a record has no time for the clock to end it by. Once its row shows a
  // length instead of the badge, the stream has run.
  for (const record of pending) {
    if (record.live_at || answered.has(record.video_id) || !LIVE_SOURCE_IDS.has(record.source_id)) continue;
    const item = listed.get(record.video_id);
    if (item && !item.scheduled) records.push({ ...record, live_state: "ended" });
  }

  const keepFrom = shiftDay(today, -CHECKED_KEEP_DAYS);
  const videos = Object.fromEntries([...checked]
    .filter(([, entry]) => String(entry?.checked_at || "") >= keepFrom)
    .sort(([a], [b]) => a.localeCompare(b)));
  return { records, gone, state: { videos }, stopped, problems };
}

// ---------------------------------------------------------------------------
// Product videos, from the same lists.

/**
 * A fetchText that asks for each URL once and hands every later caller the
 * same answer, or the same failure. The fetcher reads YouTube through one, so
 * a channel's upload list is a single request per run for its product-video
 * source and the stream source together.
 */
export function oncePerUrl(fetchText) {
  const answers = new Map();
  return (url) => {
    if (!answers.has(url)) answers.set(url, fetchText(url));
    return answers.get(url);
  };
}

/**
 * A channel's product videos as its upload list shows them (the title rules
 * and the dating are productVideoRecords in bandai-announcements.mjs).
 *   channel  an entry of YOUTUBE_CHANNELS
 *   stored   last run's announcement records
 * → { records, stopped }: `stopped` is set when YouTube must not be asked
 * again this run. A failed request throws, as in any other source.
 */
export async function runYoutubeVideoSource({
  channel,
  stored = [],
  today,
  fetchText,
  robotsAllows = () => true,
  log = () => {},
}) {
  const { url, items, stopped } = await readUploads(channel, { fetchText, robotsAllows });
  if (stopped) return { records: [], stopped };
  // Every upload that has run carries its age. A list where none does is one
  // this parser cannot read (another language, new markup), and new could not
  // be told from old.
  if (!items.some((item) => item.ageDays !== null)) throw new Error(`${url} gives no video an age (another language, or new markup)`);
  const storedById = new Map(stored.map((record) => [record.id, record]));
  const records = productVideoRecords(items, {
    idPrefix: channel.idPrefix,
    sourceName: channel.name,
    sourceId: channel.id,
    defaultFranchise: channel.defaultFranchise,
    accept: channel.accept || null,
    stored: storedById,
    today,
  });
  const added = records.filter((record) => !storedById.has(record.id)).length;
  log(`${channel.id}: ${items.length} uploads listed, ${records.length} product videos, ${added} of them new`);
  return { records, stopped: null };
}

// ---------------------------------------------------------------------------
// Event sites.

function youtubeVideoId(url) {
  return /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(String(url || ""))?.[1] || null;
}

/**
 * The streams an event page announces (TAMASHII NATION's top page and its
 * /live/ page share the markup family: liveConts__item, liveList__item) →
 * { year, items, streams: [{ title, liveAt, videoId, url, thumbnailUrl }] }.
 * Times on the page are Japan time ("11/13(金) 21:00～"); liveAt is null when
 * the page gives a day only. An item linking further into the same site is a
 * pointer to the schedule, not a stream.
 */
export function parseEventStreams(html, { pageUrl, today }) {
  const text = String(html || "");
  const year = /TAMASHII\s*NATION\s*(\d{4})/.exec(/<title>([\s\S]*?)<\/title>/i.exec(text)?.[1] || "")?.[1] || String(today).slice(0, 4);
  const blocks = text.split(/<li class="live(?:Conts|List)__item\b/).slice(1).map((chunk) => chunk.split("</li>")[0]);
  const streams = [];
  for (const block of blocks) {
    const title = stripTags(String(/<h3 class="live(?:List__title|Conts__title2)">([\s\S]*?)<\/h3>/.exec(block)?.[1] || "").replace(/<br\s*\/?>/gi, " "));
    const url = absoluteUrl(/<a\s+href="([^"]+)"/.exec(block)?.[1], pageUrl);
    if (!title || !url || new URL(url).host === new URL(pageUrl).host) continue;
    const when = /(\d{1,2})\/(\d{1,2})\s*[(（][^)）]*[)）]\s*(\d{1,2}):(\d{2})/.exec(stripTags(/<p class="liveList__date">([\s\S]*?)<\/p>/.exec(block)?.[1]));
    streams.push({
      title,
      liveAt: when ? `${year}-${when[1].padStart(2, "0")}-${when[2].padStart(2, "0")}T${when[3].padStart(2, "0")}:${when[4]}:00+09:00` : null,
      videoId: youtubeVideoId(url),
      url,
      thumbnailUrl: absoluteUrl(/<img\b[^>]*src="([^"]+)"/.exec(block)?.[1], pageUrl),
    });
  }
  return { year, items: blocks.length, streams };
}

/** upcoming before the start, live for `hours` after it, ended from then on. */
export function clockLiveState(liveAt, now, hours = ASSUMED_LIVE_HOURS) {
  const start = Date.parse(liveAt);
  if (now < start) return "upcoming";
  return now < start + hours * 3600000 ? "live" : "ended";
}

/**
 * Records for an event page's streams that are not on YouTube and have a time
 * (a YouTube link goes through its watch page instead — see eventStreamHints).
 * Dated by when the bot first saw them.
 */
export function eventStreamRecords(parsed, { event = TAMASHII_NATION_EVENT, today, now = new Date() }) {
  return parsed.streams
    .filter((stream) => !stream.videoId && stream.liveAt)
    .map((stream) => ({
      ...announcementRecord({
        id: `live-${stableHash(stream.url)}`,
        sourceId: EVENT_LIVE_SOURCE_ID,
        franchise: event.franchise,
        title: stream.title,
        status: "announced",
        announcedAt: today,
        announcedAtBasis: "first_seen",
        sourceName: `${event.name} ${parsed.year}`,
        sourceUrl: stream.url,
        thumbnailUrl: stream.thumbnailUrl,
        notes: "Livestream outside YouTube; start time from the event site, end assumed two hours later. Announcement date = first seen by the bot.",
      }),
      live_at: stream.liveAt,
      live_state: clockLiveState(stream.liveAt, now.getTime()),
    }));
}

/** The YouTube streams an event page links, for runYoutubeLiveSource. */
export function eventStreamHints(parsed, { event = TAMASHII_NATION_EVENT } = {}) {
  return parsed.streams.filter((stream) => stream.videoId).map((stream) => ({ videoId: stream.videoId, franchise: event.franchise }));
}

// ---------------------------------------------------------------------------
// The whole feed.

/** Two sources returned the same record id: the first keeps its fields and gains the stream's time. */
export function withLiveFields(record, stream) {
  return stream?.live_state ? { ...record, live_at: stream.live_at ?? record.live_at ?? null, live_state: stream.live_state } : record;
}

/**
 * Brings every live record up to `now` and drops the ones that are over:
 *   * a stream with only a clock (no video) follows the clock;
 *   * a YouTube stream still "upcoming" or "live" 12 hours after its start is ended;
 *   * a live-source record leaves 14 days after its start (after its
 *     announcement when it never got a time), unless someone reviewed or linked it.
 * A product video with stream fields stays; its source decides how long.
 * → { records, dropped: [ids] }
 */
export function settleLiveRecords(records, now = new Date()) {
  const nowMs = now.getTime();
  const kept = [];
  const dropped = [];
  for (const record of records) {
    if (!record.live_state) {
      kept.push(record);
      continue;
    }
    const start = Date.parse(record.live_at || "");
    let state = record.live_state;
    if (Number.isFinite(start)) {
      if (!record.video_id) state = clockLiveState(record.live_at, nowMs);
      else if (state !== "ended" && nowMs - start > STALE_HOURS * 3600000) state = "ended";
    }
    const since = Number.isFinite(start) ? start : Date.parse(`${record.announced_at}T00:00:00+09:00`);
    const over = (state === "ended" || !Number.isFinite(start)) && nowMs - since > LIVE_KEEP_DAYS * 86400000;
    if (over && LIVE_SOURCE_IDS.has(record.source_id) && !record.reviewed_at && !record.linked_kit_id) {
      dropped.push(record.id);
      continue;
    }
    kept.push(state === record.live_state ? record : { ...record, live_state: state });
  }
  return { records: kept, dropped };
}
