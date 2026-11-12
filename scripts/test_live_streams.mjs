// Official livestream schedules → "live" announcement records. The fixtures are
// real answers read on 2026-11-12 (cut down, see the note at the top of each):
// two channel upload lists and a streams tab, the watch pages of a stream two
// hours before it started (THE GUNDAM BASE) and of a premiere that had ended
// (TAMASHII NEWS NETWORK), and the TAMASHII NATION 2026 site's two stream lists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsStoredAnnouncement, mergeAnnouncementRecords, productVideoRecords } from "./lib/bandai-announcements.mjs";
import { createHostStops, dedupeAnnouncements } from "./lib/official-announcements.mjs";
import { parseRobots, robotsAllows } from "./lib/robots.mjs";
import {
  EVENT_LIVE_SOURCE_ID,
  LIVE_CHANNELS,
  YOUTUBE_LIVE_SOURCE_ID,
  clockLiveState,
  eventInSeason,
  eventStreamHints,
  eventStreamRecords,
  isMissingS3File,
  japanIso,
  listedAgeDays,
  liveCandidate,
  liveFranchise,
  parseEventStreams,
  parseYoutubeListing,
  parseYoutubeWatch,
  runYoutubeLiveSource,
  settleLiveRecords,
  TAMASHII_NATION_EVENT,
  withLiveFields,
  youtubeEmbeddedJson,
  youtubeUploadsUrl,
  youtubeWatchUrl,
} from "./lib/live-streams.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const gundamBaseList = fixture("youtube-uploads-gundam-base.html");
const bandaiList = fixture("youtube-uploads-bandai-spirits.html");
const watchUpcoming = fixture("youtube-watch-upcoming.html");
const watchEnded = fixture("youtube-watch-ended.html");

const bandai = LIVE_CHANNELS.find((channel) => channel.idPrefix === "bandai-youtube");
const gundamBase = LIVE_CHANNELS.find((channel) => channel.name === "THE GUNDAM BASE YouTube");
const takaraTomy = LIVE_CHANNELS.find((channel) => channel.name === "タカラトミー YouTube");

// YouTube's robots.txt as read on 2026-11-12 (the rules that matter here): the
// channel feeds are closed to "*", the pages this source reads are not.
const youtubeRobots = parseRobots("User-agent: *\nDisallow: /feeds/videos.xml\nDisallow: /watch_ajax\nDisallow: /watch_popup\nDisallow: /youtubei/\n");
assert.equal(robotsAllows(youtubeRobots, "https://www.youtube.com/feeds/videos.xml?channel_id=UCMt6mbBNDPwyNGvJKvhCYuA"), false);
assert.equal(robotsAllows(youtubeRobots, youtubeUploadsUrl(gundamBase.channelId)), true);
assert.equal(robotsAllows(youtubeRobots, youtubeWatchUrl("c3M7UKldpEA")), true);
assert.equal(youtubeUploadsUrl("UCMt6mbBNDPwyNGvJKvhCYuA"), "https://www.youtube.com/playlist?list=UUMt6mbBNDPwyNGvJKvhCYuA");

// --- the upload list -------------------------------------------------------
const gundamBaseItems = parseYoutubeListing(gundamBaseList);
assert.deepEqual(gundamBaseItems.map((item) => item.videoId), ["84y0tlUcsl8", "c3M7UKldpEA", "h7sPzXYh3jc", "xKnudne4UmU", "yB7g_ZUtRKo"]);
const byId = (items, id) => items.find((item) => item.videoId === id);
// 配信予定 where a finished video has its length; no age in the row.
assert.deepEqual(byId(gundamBaseItems, "c3M7UKldpEA"), {
  videoId: "c3M7UKldpEA",
  title: "【HG ガンダムアシュタロン/ENTRY GRADEガンダムベース限定 ビルドストライク エクシードギャラクシー [プラフスキーパーティクルクリア]】教えて!ガンプラコンシェルジュ!! # 283",
  scheduled: true,
  streamed: false,
  ageDays: null,
});
assert.deepEqual(
  gundamBaseItems.map(({ scheduled, streamed, ageDays }) => [scheduled, streamed, ageDays]),
  [[false, false, 1], [true, false, null], [false, false, 8], [false, true, 14], [false, true, 90]],
);
// The other embedding (a JSON script element) reads the same way.
const streamsTab = parseYoutubeListing(fixture("youtube-streams-bandai-spirits.html"));
assert.deepEqual(streamsTab.map((item) => item.videoId), ["5lbtxiLTYlY", "Oue51vX6i0o", "ao4BIYKbmyw"]);
assert.ok(streamsTab.every((item) => item.streamed && !item.scheduled && item.ageDays > 200));
// A consent or bot-check page has no list.
assert.deepEqual(parseYoutubeListing("<html><body><form action=\"https://consent.youtube.com/save\"></form></body></html>"), []);

assert.equal(listedAgeDays("3.6万 5 時間前"), 0);
assert.equal(listedAgeDays("42万 2 週間前 に配信済み"), 14);
assert.equal(listedAgeDays("Streamed 3 weeks ago"), 21);
assert.equal(listedAgeDays("4 人が待機中 2026/11/12 1:00 に公開予定"), null);

// Which listed videos get their watch page read.
// Only the scheduled stream: "2 週間前 に配信済み" is already past the 14 days a stream is kept.
assert.deepEqual(
  gundamBaseItems.map((item) => liveCandidate(item, gundamBase)?.why || null),
  [null, "scheduled", null, null, null],
);
assert.equal(liveCandidate({ ...byId(gundamBaseItems, "xKnudne4UmU"), ageDays: 6 }, gundamBase).why, "streamed");
// BANDAI SPIRITS covers every line: only the show's programme and Gundam
// titles pass, and of those only what the list or the title calls a broadcast.
const bandaiItems = parseYoutubeListing(bandaiList);
assert.deepEqual(
  bandaiItems.map((item) => [item.videoId, liveCandidate(item, bandai)?.why || null]),
  [["iERQVLp98aI", null], ["9aO4kfhmSh4", null], ["la8pjjZx3jQ", "title"], ["GadAifkSCoU", null], ["o3XjvzUu7Vs", null]],
);
assert.equal(liveCandidate(byId(bandaiItems, "la8pjjZx3jQ"), bandai).franchise, "gundam");
assert.equal(liveFranchise("【TAMASHII NEWS NETWORK】「TAMASHII NATION 2026」ONE PIECE、鬼滅の刃、仮面ライダー、初解禁！"), "gundam");
// The brand is not the show.
assert.equal(liveFranchise("【大阪に完成品フィギュアの新店舗オープン！】TAMASHII NATIONS STORE OSAKA　プロモーションムービー"), null);
assert.equal(liveFranchise("[TAMASHII NATIONS] -Anime Character Product Announcement- 「魂ネイションズ」アニメキャラ 新ラインナップ発表会"), null);
assert.equal(liveFranchise("【#プレバンのライブショッピング 】CSMアクセルドライバー&トライアルメモリver.2を大紹介！"), null);
assert.equal(liveFranchise("10月11日「BEYBLADE X GP 2026 TOKYO」準決勝〜決勝戦 LIVE配信【BEYBLADE X】"), "beyblade");
assert.equal(liveCandidate({ videoId: "x", title: "リカちゃん 生配信", scheduled: true, streamed: false, ageDays: null }, takaraTomy), null);

// --- the watch page --------------------------------------------------------
const upcoming = parseYoutubeWatch(watchUpcoming);
assert.deepEqual(upcoming, {
  outcome: "stream",
  videoId: "c3M7UKldpEA",
  title: "【HG ガンダムアシュタロン/ENTRY GRADEガンダムベース限定 ビルドストライク エクシードギャラクシー [プラフスキーパーティクルクリア]】教えて!ガンプラコンシェルジュ!! # 283",
  channelId: "UCMt6mbBNDPwyNGvJKvhCYuA",
  channelName: "THE GUNDAM BASE TOKYO",
  publishedAt: "2026-11-07",
  // scheduledStartTime 1794474000; the page itself says "11月12日 18:00 GMT+9".
  liveAt: "2026-11-12T18:00:00+09:00",
  liveState: "upcoming",
});
const ended = parseYoutubeWatch(watchEnded);
assert.equal(ended.outcome, "stream");
assert.equal(ended.channelId, bandai.channelId);
// Started 01:00:09 UTC: cut to the minute.
assert.equal(ended.liveAt, "2026-11-12T10:00:00+09:00");
assert.equal(ended.liveState, "ended");
assert.equal(ended.publishedAt, "2026-11-12");
assert.equal(japanIso(Date.parse("2026-11-12T15:30:59Z")), "2026-11-13T00:30:00+09:00");

// The same pages with the fields YouTube changes (no such page was caught on
// 2026-11-12): the stream on air, the stream over, and an ordinary upload.
const playerPage = (player) => `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};</script>`;
function editedWatch(html, { status = "OK", broadcast }) {
  const player = youtubeEmbeddedJson(html, "ytInitialPlayerResponse");
  player.playabilityStatus = { status };
  delete player.videoDetails.isUpcoming;
  const micro = player.microformat.playerMicroformatRenderer;
  if (broadcast) micro.liveBroadcastDetails = broadcast;
  else delete micro.liveBroadcastDetails;
  return playerPage(player);
}
const watchOnAir = editedWatch(watchUpcoming, { broadcast: { isLiveNow: true, startTimestamp: "2026-11-12T09:03:10+00:00" } });
const watchRan = editedWatch(watchUpcoming, { broadcast: { isLiveNow: false, startTimestamp: "2026-11-12T09:03:10+00:00", endTimestamp: "2026-11-12T10:05:00+00:00" } });
const watchPlainVideo = editedWatch(watchEnded, {});
assert.equal(parseYoutubeWatch(watchOnAir).liveState, "live");
assert.equal(parseYoutubeWatch(watchRan).liveState, "ended");
assert.equal(parseYoutubeWatch(watchRan).liveAt, "2026-11-12T18:03:00+09:00");
assert.equal(parseYoutubeWatch(watchPlainVideo).outcome, "video");
// No video data: removed and private videos are gone, anything else stops the source.
const statusPage = (status) => playerPage({ playabilityStatus: status });
assert.equal(parseYoutubeWatch(statusPage({ status: "ERROR", reason: "この動画は利用できません" })).outcome, "gone");
assert.equal(parseYoutubeWatch(statusPage({ status: "LOGIN_REQUIRED", reason: "この動画は非公開です" })).outcome, "gone");
assert.equal(parseYoutubeWatch(statusPage({ status: "LOGIN_REQUIRED", reason: "Sign in to confirm you’re not a bot" })).outcome, "blocked");
assert.equal(parseYoutubeWatch("<html><body>Before you continue to YouTube</body></html>").outcome, "blocked");

// --- a run -----------------------------------------------------------------
const pages = new Map([
  [youtubeUploadsUrl(bandai.channelId), bandaiList],
  [youtubeUploadsUrl(gundamBase.channelId), gundamBaseList],
  [youtubeWatchUrl("c3M7UKldpEA"), watchUpcoming],
  [youtubeWatchUrl("la8pjjZx3jQ"), watchEnded],
  [youtubeWatchUrl("iERQVLp98aI"), watchPlainVideo],
]);
function fakeFetch(log) {
  return async (url) => {
    log.push(url);
    if (!pages.has(url)) throw Object.assign(new Error(`${url} returned 404`), { status: 404 });
    return pages.get(url);
  };
}
// A product video the channel's product-video source stored earlier.
const [storedProductVideo] = productVideoRecords(
  [{ videoId: "la8pjjZx3jQ", title: "ガンプラ新商品発表", scheduled: false, streamed: false, ageDays: 0 }],
  { idPrefix: bandai.idPrefix, sourceName: bandai.name, sourceId: "bandai_hobby_youtube", today: "2026-11-12" },
);
const requests = [];
const first = await runYoutubeLiveSource({
  channels: [bandai, gundamBase],
  // An official page links a video that turns out to be an ordinary upload.
  hints: [{ videoId: "iERQVLp98aI", franchise: "gundam" }],
  stored: [{ ...storedProductVideo, source_id: "bandai_hobby_youtube", thumbnail_url: "../app/assets/announcements/bandai-youtube-la8pjjZx3jQ.jpg" }],
  state: {},
  today: "2026-11-12",
  fetchText: fakeFetch(requests),
  robotsAllows: (url) => robotsAllows(youtubeRobots, url),
});
assert.equal(first.stopped, null);
assert.deepEqual(first.problems, []);
// Two lists, then the scheduled stream and the linked video before the finished one.
assert.deepEqual(requests, [
  youtubeUploadsUrl(bandai.channelId),
  youtubeUploadsUrl(gundamBase.channelId),
  youtubeWatchUrl("c3M7UKldpEA"),
  youtubeWatchUrl("iERQVLp98aI"),
  youtubeWatchUrl("la8pjjZx3jQ"),
]);
const stream = first.records.find((record) => record.video_id === "c3M7UKldpEA");
assert.deepEqual(stream, {
  id: "youtube-c3M7UKldpEA",
  franchise: "gundam",
  names: { ja: upcoming.title, zh: null, ko: null, en: null },
  status: "announced",
  announced_at: "2026-11-07",
  source_type: "youtube",
  source_name: "THE GUNDAM BASE YouTube",
  source_id: YOUTUBE_LIVE_SOURCE_ID,
  source_url: "https://www.youtube.com/watch?v=c3M7UKldpEA",
  thumbnail_url: "https://i.ytimg.com/vi/c3M7UKldpEA/hqdefault.jpg",
  video_id: "c3M7UKldpEA",
  video_timestamp_seconds: null,
  series_key: "unclassified",
  grade_code: null,
  linked_kit_id: null,
  confidence: "official",
  notes: null,
  live_at: "2026-11-12T18:00:00+09:00",
  live_state: "upcoming",
});
// The stored product video keeps its record (id, source, cached picture) and gains the time.
const enriched = first.records.find((record) => record.video_id === "la8pjjZx3jQ");
assert.equal(enriched.id, "bandai-youtube-la8pjjZx3jQ");
assert.equal(enriched.source_id, "bandai_hobby_youtube");
assert.equal(enriched.names.ja, "ガンプラ新商品発表");
assert.equal(enriched.thumbnail_url, "../app/assets/announcements/bandai-youtube-la8pjjZx3jQ.jpg");
assert.equal(enriched.live_at, "2026-11-12T10:00:00+09:00");
assert.equal(enriched.live_state, "ended");
assert.equal(first.records.length, 2);
// Finished streams and ordinary uploads are settled; the stream to come is not.
assert.deepEqual(first.state, { videos: { iERQVLp98aI: { checked_at: "2026-11-12" }, la8pjjZx3jQ: { checked_at: "2026-11-12" } } });

// The next day only the stream still marked upcoming is read again; it went
// live three minutes late and keeps the time people were told.
const stored = mergeAnnouncementRecords([], first.records);
pages.set(youtubeWatchUrl("c3M7UKldpEA"), watchRan);
const secondRequests = [];
const second = await runYoutubeLiveSource({
  channels: [bandai, gundamBase],
  stored,
  state: first.state,
  today: "2026-11-13",
  fetchText: fakeFetch(secondRequests),
});
assert.deepEqual(secondRequests.filter((url) => url.includes("/watch")), [youtubeWatchUrl("c3M7UKldpEA")]);
assert.equal(second.records.length, 1);
assert.equal(second.records[0].live_state, "ended");
assert.equal(second.records[0].live_at, "2026-11-12T18:00:00+09:00");
assert.equal(second.records[0].announced_at, "2026-11-07");
assert.ok(second.state.videos.c3M7UKldpEA);
// Settled videos are forgotten after a month.
const muchLater = await runYoutubeLiveSource({ channels: [], stored: [], state: second.state, today: "2026-12-20", fetchText: fakeFetch([]) });
assert.deepEqual(muchLater.state, { videos: {} });
// Merged over the stored record, the stream is one record with the new state.
const afterSecond = mergeAnnouncementRecords(stored, second.records);
assert.equal(afterSecond.filter((record) => record.video_id === "c3M7UKldpEA").length, 1);
assert.equal(afterSecond.find((record) => record.video_id === "c3M7UKldpEA").live_state, "ended");

// A stream an official page links is read even when no list shows it, under
// the page's franchise; one that was taken down leaves.
const oldStreamsOnly = new Map([
  [youtubeUploadsUrl(bandai.channelId), fixture("youtube-streams-bandai-spirits.html")],
  [youtubeWatchUrl("la8pjjZx3jQ"), watchEnded],
]);
const hinted = await runYoutubeLiveSource({
  channels: [bandai],
  hints: [{ videoId: "la8pjjZx3jQ", franchise: "gundam" }],
  stored: [],
  state: {},
  today: "2026-11-12",
  fetchText: async (url) => oldStreamsOnly.get(url),
});
assert.equal(hinted.records.length, 1);
assert.equal(hinted.records[0].id, "bandai-youtube-la8pjjZx3jQ");
assert.equal(hinted.records[0].source_name, "BANDAI Hobby Site YouTube");
assert.equal(hinted.records[0].source_id, YOUTUBE_LIVE_SOURCE_ID);
assert.equal(hinted.records[0].franchise, "gundam");
pages.set(youtubeWatchUrl("c3M7UKldpEA"), statusPage({ status: "ERROR", reason: "この動画は利用できません" }));
const cancelled = await runYoutubeLiveSource({ channels: [], stored: first.records, state: {}, today: "2026-11-12", fetchText: fakeFetch([]) });
assert.deepEqual(cancelled.gone, ["youtube-c3M7UKldpEA"]);
assert.deepEqual(cancelled.records, []);

// A bot check stops the source at once; a list without data does too.
pages.set(youtubeWatchUrl("c3M7UKldpEA"), statusPage({ status: "LOGIN_REQUIRED", reason: "Sign in to confirm you’re not a bot" }));
const blockedRequests = [];
const blocked = await runYoutubeLiveSource({ channels: [bandai, gundamBase], stored: [], state: {}, today: "2026-11-12", fetchText: fakeFetch(blockedRequests) });
assert.match(blocked.stopped, /no video data \(Sign in to confirm/);
assert.equal(blockedRequests.at(-1), youtubeWatchUrl("c3M7UKldpEA"));
// The list still says a stream is scheduled: recorded without a time, dated by first sight.
assert.equal(blocked.records.length, 1);
const [timeless] = blocked.records;
assert.equal(timeless.id, "youtube-c3M7UKldpEA");
assert.equal(timeless.names.ja, upcoming.title);
assert.equal(timeless.live_at, null);
assert.equal(timeless.live_state, "upcoming");
assert.equal(timeless.announced_at, "2026-11-12");
assert.equal(timeless.announced_at_basis, "first_seen");
assert.deepEqual(blocked.state, { videos: {} });
// Still blocked the next day: nothing new while the list calls it scheduled;
// once its row shows a length the stream has run, time or no time.
const stillBlocked = await runYoutubeLiveSource({ channels: [gundamBase], stored: blocked.records, state: {}, today: "2026-11-13", fetchText: fakeFetch([]) });
assert.match(stillBlocked.stopped, /no video data/);
assert.deepEqual(stillBlocked.records, []);
pages.set(youtubeUploadsUrl(gundamBase.channelId), gundamBaseList.replace("\"text\":\"配信予定\"", "\"text\":\"1:02:33\""));
const ranUnseen = await runYoutubeLiveSource({ channels: [gundamBase], stored: blocked.records, state: {}, today: "2026-11-13", fetchText: fakeFetch([]) });
assert.match(ranUnseen.stopped, /no video data/);
assert.deepEqual(ranUnseen.records, [{ ...timeless, live_state: "ended" }]);
pages.set(youtubeUploadsUrl(gundamBase.channelId), gundamBaseList);
// Once the watch page answers, the same record gets its time and keeps its date.
pages.set(youtubeWatchUrl("c3M7UKldpEA"), watchUpcoming);
const unblocked = await runYoutubeLiveSource({ channels: [gundamBase], stored: blocked.records, state: {}, today: "2026-11-13", fetchText: fakeFetch([]) });
assert.equal(unblocked.records.length, 1);
assert.equal(unblocked.records[0].id, timeless.id);
assert.equal(unblocked.records[0].live_at, "2026-11-12T18:00:00+09:00");
assert.equal(unblocked.records[0].announced_at, "2026-11-12");
assert.equal(unblocked.records[0].announced_at_basis, "first_seen");
const consent = await runYoutubeLiveSource({ channels: [bandai, gundamBase], stored: [], state: {}, today: "2026-11-12", fetchText: async () => "<html>consent</html>" });
assert.match(consent.stopped, /has no video list/);
// robots.txt closing a path stops it before the request.
const closed = await runYoutubeLiveSource({ channels: [bandai], stored: [], state: {}, today: "2026-11-12", fetchText: fakeFetch([]), robotsAllows: () => false });
assert.match(closed.stopped, /disallowed by robots\.txt/);
// 429 on a list: the fetcher has stopped the host, nothing more is asked.
const limitedRequests = [];
const limited = await runYoutubeLiveSource({
  channels: [bandai, gundamBase],
  stored: first.records,
  state: {},
  today: "2026-11-12",
  fetchText: async (url) => {
    limitedRequests.push(url);
    throw Object.assign(new Error(`${url} returned 429`), { status: 429 });
  },
});
assert.equal(limitedRequests.length, 1);
assert.match(limited.stopped, /returned 429/);
// At most maxWatchPages watch pages in a run.
const cappedRequests = [];
const capped = await runYoutubeLiveSource({ channels: [bandai, gundamBase], stored: [], state: {}, today: "2026-11-12", fetchText: fakeFetch(cappedRequests), maxWatchPages: 1 });
assert.deepEqual(cappedRequests.filter((url) => url.includes("/watch")), [youtubeWatchUrl("c3M7UKldpEA")]);
assert.equal(capped.records.length, 1);

const stops = createHostStops();
stops.stop("https://www.youtube.com/", "a page without video data");
assert.throws(() => stops.check("https://www.youtube.com/watch?v=c3M7UKldpEA"), /www\.youtube\.com answered a page without video data earlier/);
stops.check("https://i.ytimg.com/vi/c3M7UKldpEA/hqdefault.jpg");

// --- the event site --------------------------------------------------------
const TOP_URL = TAMASHII_NATION_EVENT.pages[0];
const LIVE_URL = TAMASHII_NATION_EVENT.pages[1];
const top = parseEventStreams(fixture("tamashii-nation-2026-top.html"), { pageUrl: TOP_URL, today: "2026-11-12" });
// Two items: the YouTube programme, and a pointer to /live/ (not a stream). The promo-video embed is neither.
assert.equal(top.items, 2);
assert.equal(top.year, "2026");
assert.deepEqual(top.streams, [{
  title: "TAMASHII NEWS NETWORK",
  liveAt: null,
  videoId: "la8pjjZx3jQ",
  url: "https://www.youtube.com/watch?v=la8pjjZx3jQ",
  thumbnailUrl: null,
}]);
assert.deepEqual(eventStreamHints(top), [{ videoId: "la8pjjZx3jQ", franchise: "gundam" }]);
assert.deepEqual(eventStreamRecords(top, { today: "2026-11-12", now: new Date("2026-11-12T07:00:00Z") }), []);

const livePage = parseEventStreams(fixture("tamashii-nation-2026-live.html"), { pageUrl: LIVE_URL, today: "2026-11-12" });
assert.deepEqual(livePage.streams.map(({ title, liveAt, url }) => [title, liveAt, url]), [
  ["TAMASHII NATION 2026 Live Stream from AKIHABARA DAY1", "2026-11-13T21:00:00+09:00", "https://p-bandai.jp/contents/liveshopping20261113"],
  ["TAMASHII NATION 2026 Live Stream from AKIHABARA DAY2", "2026-11-14T21:00:00+09:00", "https://p-bandai.jp/contents/liveshopping20261114"],
]);
const shopping = eventStreamRecords(livePage, { today: "2026-11-12", now: new Date("2026-11-13T12:30:00Z") });
assert.equal(shopping.length, 2);
const [day1, day2] = shopping;
assert.match(day1.id, /^live-[0-9a-f]{10}$/);
assert.notEqual(day1.id, day2.id);
assert.equal(day1.franchise, "gundam");
assert.equal(day1.status, "announced");
assert.equal(day1.source_type, "news");
assert.equal(day1.source_id, EVENT_LIVE_SOURCE_ID);
assert.equal(day1.source_name, "TAMASHII NATION 2026");
assert.equal(day1.source_url, "https://p-bandai.jp/contents/liveshopping20261113");
assert.equal(day1.thumbnail_url, "https://tamashii-nation.tamashiiweb.com/t2026/img/live/thumb_live_01.webp");
assert.equal(day1.video_id, null);
assert.equal(day1.announced_at, "2026-11-12");
assert.equal(day1.announced_at_basis, "first_seen");
// 21:30 on the 13th in Japan: day 1 is on, day 2 is tomorrow.
assert.deepEqual(shopping.map((record) => [record.live_at, record.live_state]), [
  ["2026-11-13T21:00:00+09:00", "live"],
  ["2026-11-14T21:00:00+09:00", "upcoming"],
]);
assert.equal(clockLiveState("2026-11-13T21:00:00+09:00", Date.parse("2026-11-13T11:59:00Z")), "upcoming");
assert.equal(clockLiveState("2026-11-13T21:00:00+09:00", Date.parse("2026-11-13T14:00:00Z")), "ended");
// Seen again the next day: the same records, still dated by the first sight.
const nextDay = eventStreamRecords(livePage, { today: "2026-11-13", now: new Date("2026-11-13T22:00:00Z") });
assert.equal(mergeAnnouncementRecords(shopping, nextDay).find((record) => record.id === day1.id).announced_at, "2026-11-12");
// The site is read only around the show.
assert.equal(eventInSeason(TAMASHII_NATION_EVENT, "2026-11-12"), true);
assert.equal(eventInSeason(TAMASHII_NATION_EVENT, "2026-10-14"), false);
assert.equal(eventInSeason(TAMASHII_NATION_EVENT, "2027-02-01"), false);
// The site's robots.txt as answered on 2026-11-12: S3's 403 for a file that is
// not there. A 403 from anything else, or with another body, is a refusal.
const s3Missing = {
  status: 403,
  server: "AmazonS3",
  body: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>",
};
assert.equal(isMissingS3File(s3Missing), true);
assert.equal(isMissingS3File({ ...s3Missing, server: "AkamaiGHost" }), false);
assert.equal(isMissingS3File({ ...s3Missing, server: null }), false);
assert.equal(isMissingS3File({ ...s3Missing, body: "<html><title>403 Forbidden</title></html>" }), false);
assert.equal(isMissingS3File({ ...s3Missing, status: 404 }), false);

// --- in the feed -----------------------------------------------------------
// Stream titles are programme names; the news-title filter must not drop them
// once the source stops listing them.
assert.ok(acceptsStoredAnnouncement(day1));
assert.ok(acceptsStoredAnnouncement(stream));
assert.equal(mergeAnnouncementRecords([day1, stream], []).length, 2);

// A product video and the same video seen as a stream in one run: one record.
const productVideo = { ...storedProductVideo, source_id: "bandai_hobby_youtube" };
const asStream = { ...productVideo, source_id: YOUTUBE_LIVE_SOURCE_ID, live_at: "2026-11-12T10:00:00+09:00", live_state: "ended" };
assert.deepEqual(withLiveFields(productVideo, asStream), { ...productVideo, live_at: "2026-11-12T10:00:00+09:00", live_state: "ended" });
assert.equal(withLiveFields(productVideo, { ...productVideo, source_id: "other" }), productVideo);

// A stream quoting the show's name is not a twin of the news posts that quote it.
const eventNews = {
  ...day1,
  id: "tamashii-news-2026-11-10-1",
  source_id: "tamashii_news",
  source_name: "TAMASHII WEB",
  source_url: "https://tamashiiweb.com/item/1/",
  names: { ja: "【機動戦士ガンダム】「TAMASHII NATION 2026」開催記念商品の予約受付開始！" },
  announced_at: "2026-11-10",
  live_at: undefined,
  live_state: undefined,
};
const tnn = { ...stream, id: "bandai-youtube-la8pjjZx3jQ", names: { ja: "【TAMASHII NEWS NETWORK】「TAMASHII NATION 2026」ONE PIECE、鬼滅の刃、仮面ライダー、初解禁！" }, announced_at: "2026-11-12" };
const deduped = dedupeAnnouncements([eventNews, tnn], ["tamashii_news", YOUTUBE_LIVE_SOURCE_ID]);
assert.deepEqual(deduped.dropped, []);
assert.equal(deduped.records.length, 2);

// The clock: a page-scheduled stream follows it, a YouTube stream nobody
// refreshed ends after 12 hours, and streams leave 14 days after they ran.
const later = (iso) => new Date(iso);
const settledSameNight = settleLiveRecords([day1, day2, stream], later("2026-11-13T15:30:00Z"));
assert.deepEqual(settledSameNight.records.map((record) => record.live_state), ["ended", "upcoming", "ended"]);
assert.deepEqual(settledSameNight.dropped, []);
assert.equal(settleLiveRecords([stream], later("2026-11-12T12:00:00Z")).records[0], stream);
const twoWeeks = settleLiveRecords([day1, day2, stream, enriched, eventNews], later("2026-11-28T00:00:00Z"));
// Day 2 (11/14 21:00) has a few hours left; the product video stays whatever its age.
assert.deepEqual(twoWeeks.dropped, [day1.id, stream.id]);
assert.deepEqual(twoWeeks.records.map((record) => record.id), [day2.id, enriched.id, eventNews.id]);
// Reviewed in the CMS: kept.
assert.deepEqual(settleLiveRecords([{ ...day1, reviewed_at: "2026-11-14" }], later("2026-12-24T00:00:00Z")).dropped, []);
// A stream that never got a time leaves 14 days after it was announced.
assert.deepEqual(settleLiveRecords([timeless], later("2026-11-25T00:00:00Z")).dropped, []);
assert.deepEqual(settleLiveRecords([timeless], later("2026-11-27T00:00:00Z")).dropped, [timeless.id]);

console.log("live stream tests passed");
