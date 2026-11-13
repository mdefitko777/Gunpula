// 魂ウェブ's monthly sales schedule → announcement records. The fixture is the
// answer of tamashiiweb.com/api/site-item/shcedule.php?month=2026-11 as read on
// 2026-11-13, cut to 11 of its 137 items (whole rows; one item has two rows).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsStoredAnnouncement, mergeAnnouncementRecords } from "./lib/bandai-announcements.mjs";
import {
  TAMASHII_REVEALS_SOURCE_ID,
  advanceStages,
  announcementRecord,
  dedupeAnnouncements,
  promoteRevealStages,
} from "./lib/official-announcements.mjs";
import {
  TAMASHII_SCHEDULE_SOURCE_ID,
  dropScheduleTwins,
  parseTamashiiSchedule,
  scheduleApiUrl,
  scheduleMonths,
  tamashiiKitsByItemId,
  tamashiiScheduleRecords,
} from "./lib/tamashii-schedule.mjs";

const TODAY = "2026-11-13";
const answer = JSON.parse(readFileSync(new URL("./fixtures/tamashii-schedule-2026-11.json", import.meta.url), "utf8"));

// Two months a run, by the site's own (misspelled) endpoint.
assert.equal(scheduleApiUrl("2026-11"), "https://tamashiiweb.com/api/site-item/shcedule.php?month=2026-11&group_by=day&area=japan");
assert.deepEqual(scheduleMonths("2026-11-13"), ["2026-11", "2026-12"]);
assert.deepEqual(scheduleMonths("2026-12-20"), ["2026-12", "2027-01"]);

// One item per id: バーニングミレニアムゴジラ has a preorder_start and a preorder_end row.
const parsed = parseTamashiiSchedule(answer);
assert.equal(parsed.rows, 12);
assert.equal(parsed.items.length, 11);
assert.equal(parsed.items.find((item) => item.tamashiiWebId === "16258").categoryName, "魂ウェブ商店販売商品");
// An answer that is not the schedule has no rows, which the fetcher reports.
assert.deepEqual(parseTamashiiSchedule({ error: "maintenance" }), { items: [], rows: 0 });
assert.deepEqual(parseTamashiiSchedule(null), { items: [], rows: 0 });

// Catalog ids carry the world for Fate and Madoka products.
const kitsByItemId = tamashiiKitsByItemId([
  { kit_id: "tamashii-16259", franchise: "gundam" },
  { kit_id: "tamashii-16254", franchise: "gundam" },
  { kit_id: "tamashii-fate-13377", franchise: "fate" },
  { kit_id: "bandai-hg-1", franchise: "gundam" },
]);
assert.deepEqual([...kitsByItemId.keys()], ["16259", "16254", "13377"]);

// First read: the app's worlds only, and only items published in the last 21 days.
const first = tamashiiScheduleRecords(parsed.items, { today: TODAY, kitsByItemId });
assert.deepEqual(first.records.map((record) => record.id).sort(), [
  "tamashii-schedule-16152", // GUNDAM UNIVERSE XARX-0 GUNDAM ZERO, published 10-30
  "tamashii-schedule-16188",
  "tamashii-schedule-16254",
  "tamashii-schedule-16258",
  "tamashii-schedule-16259",
  "tamashii-schedule-16271",
]);
// Left out for good: a resale published in June and a ＜SIDE MS＞ item of September.
assert.deepEqual(first.state.passed, { 15929: "2026-06-30", 16127: "2026-09-03" });
assert.equal(Object.keys(first.state.seen).length, 6);
// The brand alone is not the work: METAL BUILD イカルガ, METAL BUILD 仮面ライダーアークワン and a ゴジラ are nobody's.
for (const id of ["16088", "16181", "16252"]) {
  assert.ok(!(id in first.state.seen) && !(id in first.state.passed), id);
}

const byId = new Map(first.records.map((record) => [record.id, record]));
const kyrios = byId.get("tamashii-schedule-16258");
assert.equal(kyrios.names.ja, "METAL BUILD ガンダムキュリオス");
assert.equal(kyrios.franchise, "gundam");
assert.equal(kyrios.status, "preorder_open"); // its preorder opened on 11-13
assert.equal(kyrios.announced_at, "2026-11-13"); // the day 魂ウェブ published the item
assert.equal(kyrios.source_id, TAMASHII_SCHEDULE_SOURCE_ID);
assert.equal(kyrios.source_name, "TAMASHII WEB");
assert.equal(kyrios.source_url, "https://tamashiiweb.com/item/16258/");
assert.equal(kyrios.thumbnail_url, "https://tamashiiweb.com/storage/images/products/thumbnail/2a731f25-0af8-4d64-b273-53f98539b0a0.webp");
assert.equal(kyrios.notes, "予約 2026-11-13〜 / 発送 2027-06 / ¥38,500（税込） / 魂ウェブ商店販売商品");
assert.equal(kyrios.confidence, "official");
assert.equal(kyrios.unofficial, undefined);
assert.equal(kyrios.linked_kit_id, null); // not in the catalog yet
assert.equal(byId.get("tamashii-schedule-16259").linked_kit_id, "tamashii-16259");
// ＜SIDE MF＞ marks a mobile fighter; a store item is 発売, a web-shop item 発送.
assert.equal(byId.get("tamashii-schedule-16188").names.ja, "ROBOT魂 ＜SIDE MF＞ ボルトガンダム マーシャルアクション");
assert.equal(byId.get("tamashii-schedule-16188").notes, "予約 2026-11-12〜 / 発売 2027-06 / ¥9,900（税込） / 一般店頭販売商品");
assert.equal(byId.get("tamashii-schedule-16271").notes, "予約 2026-11-13〜 / 発送 2027-03 / ¥39,600（税込） / TAMASHII NATION開催記念商品 / 事後販売");
// No preorder at all (a store exclusive): product_confirmed, the stage 発売決定 titles get.
assert.equal(byId.get("tamashii-schedule-16254").status, "product_confirmed");
assert.equal(byId.get("tamashii-schedule-16254").notes, "発売 2026-11 / ¥33,000（税込） / その他限定商品");

// The day before, キュリオス was listed with its preorder still to come.
const before = tamashiiScheduleRecords(parsed.items, { today: "2026-11-12", kitsByItemId });
assert.equal(before.records.find((record) => record.id === kyrios.id).status, "product_confirmed");

// Later runs: what was taken is taken again (the record follows the source),
// what was passed over stays out, whatever the day.
const later = tamashiiScheduleRecords(parsed.items, { today: "2026-12-20", state: first.state, kitsByItemId });
assert.deepEqual(later.records.map((record) => record.id).sort(), first.records.map((record) => record.id).sort());
assert.equal(later.records.find((record) => record.id === kyrios.id).announced_at, "2026-11-13");
assert.deepEqual(later.state.passed, first.state.passed);

// A first read on a crowded day takes the newest twelve and no more.
const crowd = Array.from({ length: 15 }, (_, index) => ({
  ...parsed.items.find((item) => item.tamashiiWebId === "16258"),
  tamashiiWebId: String(20000 + index),
  publishDate: `2026-11-${String(index + 1).padStart(2, "0")} 10:00:00`,
}));
const crowded = tamashiiScheduleRecords(crowd, { today: "2026-11-15" });
assert.equal(crowded.records.length, 12);
assert.deepEqual(Object.keys(crowded.state.passed), ["20000", "20001", "20002"]);

// Stored records stay when the item leaves the schedule: its name has no reveal verb.
assert.ok(acceptsStoredAnnouncement(kyrios));
assert.equal(mergeAnnouncementRecords([kyrios], []).length, 1);

// The merge keeps a stored status, so the schedule moves its own record
// forward: never backwards, never a record reviewed in the CMS.
const storedKyrios = { ...before.records.find((record) => record.id === kyrios.id) };
const merged = mergeAnnouncementRecords([storedKyrios], [kyrios]);
assert.equal(merged[0].status, "product_confirmed");
const advanced = advanceStages(merged, [kyrios]);
assert.equal(advanced.records[0].status, "preorder_open");
assert.deepEqual(advanced.advanced, [{ id: kyrios.id, from: "product_confirmed", to: "preorder_open" }]);
assert.deepEqual(advanceStages([kyrios], [storedKyrios]).advanced, []);
assert.deepEqual(advanceStages([{ ...storedKyrios, reviewed_at: "2026-11-13" }], [kyrios]).advanced, []);

// --- One record per piece of news.
function topicPost({ id, title, date, url, status = "preorder_open", sourceId = "tamashii_news", sourceName = "TAMASHII WEB" }) {
  return announcementRecord({ id, sourceId, franchise: "gundam", title, status, announcedAt: date, sourceName, sourceUrl: url });
}
const reveal = announcementRecord({
  id: "tamashii-reveal-0abb669c96",
  sourceId: TAMASHII_REVEALS_SOURCE_ID,
  franchise: "gundam",
  title: "METAL BUILD ガンダムキュリオス",
  status: "product_confirmed",
  announcedAt: "2026-11-12",
  announcedAtBasis: "first_seen",
  sourceName: "TAMASHII WEB",
  sourceUrl: "https://tamashiiweb.com/item_character/gundam_series/",
  notes: "魂ウェブ banner: 【機動戦士ガンダム00】「ガンダムキュリオス」がMETAL BUILDより商品化決定！ Announcement date = first seen by the bot.",
});
const dynamesPost = topicPost({
  id: "tamashii-news-2026-11-12-16259",
  title: "【機動戦士ガンダム00】「METAL BUILD ガンダムデュナメス」が魂ウェブ商店にて11/13 12時より予約受付開始！",
  date: "2026-11-12",
  url: "https://tamashiiweb.com/item/16259/",
});
const voltPost = topicPost({
  id: "tamashii-news-2026-11-12-16188",
  title: "【機動武闘伝Gガンダム】「ボルトガンダムマーシャルアクション」がROBOT魂に登場！一般店頭にて11/12より予約受付開始！",
  date: "2026-11-12",
  url: "https://tamashiiweb.com/item/16188/",
});
const zeroNews = topicPost({
  id: "gundam-official-cwp1nljulgwv1b9yjstzaugn",
  sourceId: "gundam_official_news",
  sourceName: "GUNDAM.INFO",
  title: "新作アニメーション『機動戦士ガンダムRG XARX-ZERO』より「GUNDAM UNIVERSE XARX-0 GUNDAM ZERO」が2027年4月発売決定！11月2日より取り扱い店舗にて予約開始！",
  date: "2026-10-30",
  url: "https://gundam-official.com/news/01_23456.html",
});
const all = [...first.records, reveal, dynamesPost, voltPost, zeroNews];

// The schedule row is what tells that the revealed キュリオス can now be ordered.
const promoted = promoteRevealStages(all);
assert.deepEqual(promoted.promoted, [{ id: reveal.id, from: "product_confirmed", to: "preorder_open" }]);

// Then a row another official record already tells goes: the topic post of the
// same item page, a post naming the product, the reveal of the same name
// (the records are those of the first real run, 2026-11-13).
const settled = dropScheduleTwins(promoted.records);
assert.deepEqual([...settled.dropped].sort((a, b) => a.id.localeCompare(b.id)), [
  { id: "tamashii-schedule-16152", kept: zeroNews.id },
  { id: "tamashii-schedule-16188", kept: voltPost.id },
  { id: "tamashii-schedule-16258", kept: reveal.id },
  { id: "tamashii-schedule-16259", kept: dynamesPost.id },
]);
// What stays is what no post announced: the 事後販売 lot and the store exclusive.
assert.deepEqual(
  settled.records.filter((record) => record.source_id === TAMASHII_SCHEDULE_SOURCE_ID).map((record) => record.id).sort(),
  ["tamashii-schedule-16254", "tamashii-schedule-16271"],
);
// The post that stays gains what only the schedule knew.
const keptPost = settled.records.find((record) => record.id === dynamesPost.id);
assert.equal(keptPost.notes, "予約 2026-11-13〜 / 発送 2027-01 / ¥33,000（税込） / 魂ウェブ商店販売商品");
assert.equal(keptPost.linked_kit_id, "tamashii-16259");
// A record that has notes of its own keeps them.
assert.match(settled.records.find((record) => record.id === reveal.id).notes, /^魂ウェブ banner/);
assert.equal(settled.records.find((record) => record.id === reveal.id).status, "preorder_open");

// A post months earlier is other news (the first sale; this row is the resale).
const oldPost = { ...dynamesPost, id: "tamashii-news-2026-05-01-16259", announced_at: "2026-05-01" };
assert.deepEqual(dropScheduleTwins([byId.get("tamashii-schedule-16259"), oldPost]).dropped, []);
// A row reviewed in the CMS is left alone, and so is an unofficial report of the same product.
assert.deepEqual(dropScheduleTwins([{ ...byId.get("tamashii-schedule-16259"), reviewed_at: "2026-11-13" }, dynamesPost]).dropped, []);
assert.deepEqual(dropScheduleTwins([byId.get("tamashii-schedule-16259"), { ...dynamesPost, confidence: "unofficial", unofficial: true }]).dropped, []);

// The cross-source dedupe leaves the two survivors alone (same site, no shared page).
const deduped = dedupeAnnouncements(settled.records, ["tamashii_news", TAMASHII_REVEALS_SOURCE_ID, TAMASHII_SCHEDULE_SOURCE_ID, "gundam_official_news"]);
assert.deepEqual(deduped.dropped, []);

// 魂ウェブ's own post gets the row before the BANDAI SPIRITS card of the same
// page, and the catalog link it gains (matched by item id) does not put it
// ahead of anyone in the dedupe (2026-11-14: the card took the link and with
// it the place of the キュリオス post).
const card = topicPost({
  id: "bandai-news-2026-11-12-lbS8xNjI1OS8",
  sourceId: "bandai_spirits_topics",
  sourceName: "BANDAI SPIRITS",
  title: dynamesPost.names.ja,
  date: "2026-11-12",
  url: "https://tamashiiweb.com/item/16259/",
});
const linkedRow = byId.get("tamashii-schedule-16259");
assert.equal(linkedRow.linked_kit_basis, "source_page");
const sameSite = dropScheduleTwins([card, dynamesPost, linkedRow]);
assert.deepEqual(sameSite.dropped, [{ id: linkedRow.id, kept: dynamesPost.id }]);
assert.equal(sameSite.records.find((record) => record.id === dynamesPost.id).linked_kit_basis, "source_page");
assert.deepEqual(
  dedupeAnnouncements(sameSite.records, ["tamashii_news", "bandai_spirits_topics"]).dropped,
  [{ id: card.id, kept: dynamesPost.id }],
);

console.log("tamashii schedule: ok");
