// Product videos from a channel's upload list (the channel feeds are closed to
// this bot by robots.txt and are no longer read). The fixtures are the two
// upload lists test_live_streams.mjs uses, read on 2026-11-12: BANDAI SPIRITS
// (three videos of that day about other works, two Gundam product videos 10
// days and "2 週間" old) and THE GUNDAM BASE (a scheduled stream, club videos
// and a 3-month-old 結果発表 stream).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEW_VIDEO_DAYS, mergeAnnouncementRecords, productVideoRecords } from "./lib/bandai-announcements.mjs";
import { YOUTUBE_CHANNELS, dedupeAnnouncements } from "./lib/official-announcements.mjs";
import { parseRobots, robotsAllows } from "./lib/robots.mjs";
import {
  LIVE_CHANNELS,
  oncePerUrl,
  parseYoutubeListing,
  runYoutubeLiveSource,
  runYoutubeVideoSource,
  youtubeUploadsUrl,
  youtubeWatchUrl,
} from "./lib/live-streams.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const bandaiList = fixture("youtube-uploads-bandai-spirits.html");
const gundamBaseList = fixture("youtube-uploads-gundam-base.html");
const TODAY = "2026-11-12";

// The four product-video sources, with the record ids they always had; the
// stream source reads the same channels under the same ids and names.
assert.deepEqual(YOUTUBE_CHANNELS.map((channel) => [channel.id, channel.name, channel.idPrefix, channel.defaultFranchise]), [
  ["bandai_hobby_youtube", "BANDAI Hobby Site YouTube", "bandai-youtube", null],
  ["gundam_channel_youtube", "ガンダムチャンネル YouTube", "youtube", "gundam"],
  ["gundam_base_youtube", "THE GUNDAM BASE YouTube", "youtube", "gundam"],
  ["beyblade_youtube", "ベイチューブ YouTube", "youtube", "beyblade"],
]);
assert.deepEqual(
  LIVE_CHANNELS.slice(0, YOUTUBE_CHANNELS.length).map(({ channelId, name, idPrefix }) => [channelId, name, idPrefix]),
  YOUTUBE_CHANNELS.map(({ channelId, name, idPrefix }) => [channelId, name, idPrefix]),
);
const bandai = YOUTUBE_CHANNELS[0];
const gundamBase = YOUTUBE_CHANNELS[2];
// What the sources read is open to "*" in YouTube's robots.txt (2026-11-12); the feeds are not.
const youtubeRobots = parseRobots("User-agent: *\nDisallow: /feeds/videos.xml\nDisallow: /youtubei/\n");
for (const channel of YOUTUBE_CHANNELS) {
  assert.equal(robotsAllows(youtubeRobots, youtubeUploadsUrl(channel.channelId)), true);
  assert.equal(robotsAllows(youtubeRobots, `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`), false);
}

function fakeFetch(pages, log = []) {
  return async (url) => {
    log.push(url);
    if (!pages.has(url)) throw Object.assign(new Error(`${url} returned 404`), { status: 404 });
    return pages.get(url);
  };
}
const pages = new Map([
  [youtubeUploadsUrl(bandai.channelId), bandaiList],
  [youtubeUploadsUrl(gundamBase.channelId), gundamBaseList],
]);
const run = (channel, stored, { today = TODAY, source = pages } = {}) =>
  runYoutubeVideoSource({ channel, stored, today, fetchText: fakeFetch(source), robotsAllows: (url) => robotsAllows(youtubeRobots, url) });

// --- the first run after the switch ------------------------------------------
// Nothing stored: the lists hold three product videos by their titles (10 days,
// "2 週間", "3 か月" old). None is under a week old, so none is filed as today's news.
assert.deepEqual((await run(bandai, [])).records, []);
assert.deepEqual((await run(gundamBase, [])).records, []);

// The records the feed source stored keep everything they have: the publish
// date (no basis), the cached picture, the CMS's work.
const feedRecord = (videoId, title, announcedAt) => ({
  id: `bandai-youtube-${videoId}`,
  franchise: "gundam",
  names: { ja: title, zh: null, ko: "재판 회의", en: null },
  status: "announced",
  announced_at: announcedAt,
  source_type: "youtube",
  source_name: "BANDAI Hobby Site YouTube",
  source_url: youtubeWatchUrl(videoId),
  thumbnail_url: `../app/assets/announcements/bandai-youtube-${videoId}.jpg`,
  video_id: videoId,
  video_timestamp_seconds: null,
  series_key: "unclassified",
  grade_code: null,
  linked_kit_id: null,
  confidence: "candidate",
  notes: "Official video detected automatically. Confirm individual product reveals in CMS.",
  source_id: "bandai_hobby_youtube",
  reviewed_at: null,
});
const stored = [
  feedRecord("GadAifkSCoU", "【公式】ビルダーズノート ガンプラ再販会議 2026冬 第3回選抜選挙『MG 機動戦士ガンダム・Zガンダム選抜選挙』", "2026-11-02"),
  feedRecord("o3XjvzUu7Vs", "GUNDAM FIGURE SEED PROJECT！新商品続々登場！", "2026-10-23"),
  // No longer among the listed uploads.
  feedRecord("nO5UjCREUaQ", "「ポケモンプラモコレクション セレクトシリーズ 黒いメガレックウザ」登場!", "2026-09-03"),
];
const switched = await run(bandai, stored);
assert.equal(switched.stopped, null);
assert.deepEqual(switched.records.map((record) => [record.id, record.announced_at, record.announced_at_basis]), [
  ["bandai-youtube-GadAifkSCoU", "2026-11-02", undefined],
  ["bandai-youtube-o3XjvzUu7Vs", "2026-10-23", undefined],
]);
assert.equal(switched.records[0].source_id, "bandai_hobby_youtube");
assert.equal(switched.records[0].source_name, "BANDAI Hobby Site YouTube");
assert.equal(switched.records[0].source_url, "https://www.youtube.com/watch?v=GadAifkSCoU");
assert.equal(switched.records[0].confidence, "candidate");
const afterSwitch = mergeAnnouncementRecords(stored, switched.records);
assert.deepEqual(afterSwitch.map((record) => [record.id, record.announced_at]), stored.map((record) => [record.id, record.announced_at]));
assert.ok(afterSwitch.every((record) => !("announced_at_basis" in record)));
assert.equal(afterSwitch[0].thumbnail_url, "../app/assets/announcements/bandai-youtube-GadAifkSCoU.jpg");
assert.equal(afterSwitch[0].names.ko, "재판 회의");
// The title is still read from YouTube (the fixture has the full one).
assert.equal(afterSwitch[1].names.ja, "GUNDAM FIGURE SEED PROJECT！新商品続々登場！SEEDシリーズまとめ");

// --- a new video ---------------------------------------------------------------
// Up to a week old by the list: taken, dated by today less that age.
const aged = (list, from, to) => {
  assert.ok(list.includes(`"content":"${from}"`));
  return list.replace(`"content":"${from}"`, `"content":"${to}"`);
};
const withAge = (age) => new Map([[youtubeUploadsUrl(bandai.channelId), aged(bandaiList, "10 日前", age)]]);
assert.equal(NEW_VIDEO_DAYS, 7);
for (const [age, taken] of [["2 時間前", true], ["6 日前", true], ["7 日前", true], ["1 週間前", true], ["8 日前", false], ["2 週間前", false], ["1 か月前", false]]) {
  const { records } = await run(bandai, [], { source: withAge(age) });
  assert.deepEqual(records.map((record) => record.id), taken ? ["bandai-youtube-GadAifkSCoU"] : [], age);
}
// Seen on its day (the daily run): today.
assert.equal((await run(bandai, [], { source: withAge("2 時間前") })).records[0].announced_at, TODAY);
// Seen after six days the bot could not read YouTube: the day it went up.
const fresh = (await run(bandai, [], { source: withAge("6 日前") })).records;
assert.deepEqual(fresh, [{
  id: "bandai-youtube-GadAifkSCoU",
  franchise: "gundam",
  names: { ja: stored[0].names.ja, zh: null, ko: null, en: null },
  status: "announced",
  announced_at: "2026-11-06",
  announced_at_basis: "first_seen",
  source_type: "youtube",
  source_name: "BANDAI Hobby Site YouTube",
  source_id: "bandai_hobby_youtube",
  source_url: "https://www.youtube.com/watch?v=GadAifkSCoU",
  thumbnail_url: "https://i.ytimg.com/vi/GadAifkSCoU/hqdefault.jpg",
  video_id: "GadAifkSCoU",
  video_timestamp_seconds: null,
  series_key: "unclassified",
  grade_code: null,
  linked_kit_id: null,
  confidence: "candidate",
  notes: "Official video detected automatically. Confirm individual product reveals in CMS.",
}]);
// Stored now, so it stays however old the list calls it, with the first date.
const firstSeen = mergeAnnouncementRecords([], fresh);
const weeksLater = await run(bandai, firstSeen, { today: "2026-11-30", source: withAge("3 週間前") });
assert.deepEqual(weeksLater.records.map((record) => [record.id, record.announced_at, record.announced_at_basis]), [
  ["bandai-youtube-GadAifkSCoU", "2026-11-06", "first_seen"],
]);
assert.equal(mergeAnnouncementRecords(firstSeen, weeksLater.records)[0].announced_at, "2026-11-06");

// A video that repeats a news post is dropped as its twin on every run, so it
// is never stored and the list offers it as new all week. Its date holds still
// meanwhile: dated by the run, it was 11 days from the post on the last day
// (the twin check allows 10) and came back as a second record.
const post = {
  id: "bandai-news-2026-11-01-kyrios",
  franchise: "gundam",
  names: { ja: "「MG 1/100 ガンダムキュリオス」発売決定!", zh: null, ko: null, en: null },
  status: "product_confirmed",
  announced_at: "2026-11-01",
  source_type: "news",
  source_name: "BANDAI SPIRITS",
  source_id: "bandai_hobby_news",
  source_url: "https://www.bandaispirits.co.jp/news/detail/1/",
};
let published = [post];
for (const [today, ageDays] of [["2026-11-05", 0], ["2026-11-08", 3], ["2026-11-12", 7]]) {
  const repeats = productVideoRecords(
    [{ videoId: "twin1", title: "「MG 1/100 ガンダムキュリオス」新商品紹介", scheduled: false, streamed: false, ageDays }],
    { idPrefix: bandai.idPrefix, sourceName: bandai.name, sourceId: bandai.id, stored: new Map(published.map((record) => [record.id, record])), today },
  );
  assert.deepEqual(repeats.map((record) => [record.id, record.announced_at]), [["bandai-youtube-twin1", "2026-11-05"]], today);
  published = dedupeAnnouncements(mergeAnnouncementRecords(published, [post, ...repeats]), ["bandai_hobby_news", bandai.id]).records;
  assert.deepEqual(published.map((record) => record.id), [post.id], today);
}

// A premiere or stream still to come has a badge and no age: taken at once,
// under the channel's own title rule (限定品情報 has no product verb).
const scheduledReveal = new Map([[
  youtubeUploadsUrl(gundamBase.channelId),
  gundamBaseList.replace("教えて!ガンプラコンシェルジュ!! # 283", "【ガンダムベース限定品情報】 # 283"),
]]);
const premiere = (await run(gundamBase, [], { source: scheduledReveal })).records;
assert.deepEqual(premiere.map((record) => [record.id, record.source_id, record.franchise, record.announced_at, record.announced_at_basis]), [
  ["youtube-c3M7UKldpEA", "gundam_base_youtube", "gundam", TODAY, "first_seen"],
]);
// A row with neither a length nor an age the parser knows is not "new".
assert.deepEqual(productVideoRecords(
  [{ videoId: "x1", title: "ガンプラ新商品発表", scheduled: false, streamed: false, ageDays: null }],
  { sourceName: "x", sourceId: "x", defaultFranchise: "gundam", today: TODAY },
), []);

// --- one request per channel ---------------------------------------------------
// The product-video sources run first; the stream source then finds the lists
// already read and asks only for what nobody read yet.
const requests = [];
const fetchOnce = oncePerUrl(fakeFetch(pages, requests));
for (const channel of [bandai, gundamBase]) await runYoutubeVideoSource({ channel, stored, today: TODAY, fetchText: fetchOnce });
assert.deepEqual(requests, [youtubeUploadsUrl(bandai.channelId), youtubeUploadsUrl(gundamBase.channelId)]);
const liveChannels = LIVE_CHANNELS.filter((channel) => [bandai.channelId, gundamBase.channelId].includes(channel.channelId));
const live = await runYoutubeLiveSource({ channels: liveChannels, stored, state: {}, today: TODAY, fetchText: fetchOnce, maxWatchPages: 0 });
assert.equal(live.stopped, null);
assert.deepEqual(requests.filter((url) => url.includes("/playlist")), [youtubeUploadsUrl(bandai.channelId), youtubeUploadsUrl(gundamBase.channelId)]);
// The scheduled stream the second list shows was found in the shared copy.
assert.deepEqual(live.records.map((record) => record.id), ["youtube-c3M7UKldpEA"]);
// A list that could not be read is not asked for twice either.
const failed = [];
const failOnce = oncePerUrl(fakeFetch(new Map(), failed));
await assert.rejects(runYoutubeVideoSource({ channel: bandai, stored, today: TODAY, fetchText: failOnce }), /returned 404/);
const liveAfterFailure = await runYoutubeLiveSource({ channels: liveChannels.slice(0, 1), stored, state: {}, today: TODAY, fetchText: failOnce });
assert.deepEqual(failed, [youtubeUploadsUrl(bandai.channelId)]);
assert.match(liveAfterFailure.problems[0], /returned 404/);

// --- when YouTube does not answer with a list ----------------------------------
const consent = await run(bandai, stored, { source: new Map([[youtubeUploadsUrl(bandai.channelId), "<html><body><form action=\"https://consent.youtube.com/save\"></form></body></html>"]]) });
assert.match(consent.stopped, /has no video list/);
assert.deepEqual(consent.records, []);
const closedRequests = [];
const closed = await runYoutubeVideoSource({ channel: bandai, stored, today: TODAY, fetchText: fakeFetch(pages, closedRequests), robotsAllows: () => false });
assert.match(closed.stopped, /disallowed by robots\.txt/);
assert.deepEqual(closedRequests, []);
// Ages in a language the parser does not read: an error, and nothing is added
// (every video would otherwise look either old or scheduled).
const unreadable = new Map([[youtubeUploadsUrl(bandai.channelId), bandaiList.replace(/(\d+) (時間|日|週間)前/g, "vor $1 Tagen")]]);
assert.ok(parseYoutubeListing(unreadable.get(youtubeUploadsUrl(bandai.channelId))).every((item) => item.ageDays === null));
await assert.rejects(run(bandai, stored, { source: unreadable }), /gives no video an age/);
// The stored records are untouched by a failed run.
assert.equal(mergeAnnouncementRecords(stored, []).length, stored.length);

console.log("youtube product video tests passed");
