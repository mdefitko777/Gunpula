// When a preorder opens and closes (lib/preorder-times.mjs): titles, Premium
// Bandai's new-items list, 魂ウェブ's schedule, BEYBLADE X order notices, and the
// forward-only merge. Titles are real ones from data/announcements.json of
// 2026-11-13; the fixtures are pages read that day. Cases marked synthetic
// have no real example yet.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeAnnouncementRecords } from "./lib/bandai-announcements.mjs";
import {
  SOURCE_PAGE_LINK,
  TAMASHII_REVEALS_SOURCE_ID,
  announcementRecord,
  dedupeAnnouncements,
  linkSourcePageKits,
  parseGundamOfficialNews,
  parsePremiumBandaiNewItems,
  promoteRevealStages,
} from "./lib/official-announcements.mjs";
import {
  applyPreorder,
  beybladeOrderWindow,
  nearestYearDay,
  preorderFromTitle,
  scheduleWindows,
  twinPreorders,
  withScheduleWindows,
  withTitlePreorders,
} from "./lib/preorder-times.mjs";
import { parseTamashiiSchedule, tamashiiScheduleRecords } from "./lib/tamashii-schedule.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// --- Titles: [id, title, post day, expected { at?, date } or null].
const TITLES = [
  ["tamashii-news-2026-11-13-16258", "【機動戦士ガンダム00】「ガンダムキュリオス」がMETAL BUILDに登場！魂ウェブ商店にて11/13 18時より予約受付開始！", "2026-11-13", { at: "2026-11-13T18:00:00+09:00" }],
  ["tamashii-news-2026-11-12-16259", "【機動戦士ガンダム00】「METAL BUILD ガンダムデュナメス」が魂ウェブ商店にて11/13 12時より予約受付開始！", "2026-11-12", { at: "2026-11-13T12:00:00+09:00" }],
  ["tamashii-news-2026-08-26-16103", "【機動新世紀ガンダムX】「Gコントローラー」がPROPLICAに登場。魂ウェブ商店にて8/28 16時受付開始！", "2026-08-26", { at: "2026-08-28T16:00:00+09:00" }],
  ["tamashii-news-2026-05-21-15872", "【ガンダム】5月22日 16時受注開始！ROBOT魂より「ナイチンゲール ～Exclusive Edition～」が登場！", "2026-05-21", { at: "2026-05-22T16:00:00+09:00" }],
  ["gundam-official-pscrbpngr7xnr27g7cjh2qx1", "ガンプラ「HG ジム・スナイパー」「HG ジム・スナイパーII（リド・ウォルフ機）」「HG ジム・スナイパーII ホワイト・ディンゴ隊仕様」の追加予約が本日11月12日11時よりスタート！", "2026-11-12", { at: "2026-11-12T11:00:00+09:00" }],
  ["gundam-official-n1agc5frz15q2mljhrqaftm2", "「HG シュヴァルベグレイズ（ガエリオ機）」「HG グレイズリッター（マクギリス機）」ほか『鉄血のオルフェンズ』関連ガンプラの追加予約が本日11時よりスタート！", "2026-10-01", { at: "2026-10-01T11:00:00+09:00" }],
  ["gundam-official-to8wwz2mwq5i5azt7ukuomr0", "「MG スペルビア ジンクス」10月28日12時より予約開始！頭部・腰部・足部の特徴的な外装に加え「GNクナイ」を新規造形で再現！", "2026-10-27", { at: "2026-10-28T12:00:00+09:00" }],
  ["gundam-official-ywvmziohawgi2qtrud8lqp6b", "「METAL ROBOT魂（Ka signature）強化型ΖΖガンダム用フルアーマーパーツセット」9月18日17時より予約受付スタート！「強化型ΖΖガンダム」の2次予約も同日開始！", "2026-09-17", { at: "2026-09-18T17:00:00+09:00" }],
  ["gundam-official-i54ahpo5irdfm3tpdgli5t16", "格闘ポージングに特化したROBOT魂新シリーズ「マーシャルアクション」に「シャイニングガンダム」「ボルトガンダム」登場！本日11月12日より取り扱い店舗にて予約開始！", "2026-11-12", { date: "2026-11-12" }],
  ["gundam-official-cwp1nljulgwv1b9yjstzaugn", "新作アニメーション『機動戦士ガンダムRG XARX-ZERO』より「GUNDAM UNIVERSE XARX-0 GUNDAM ZERO」が2027年4月発売決定！11月2日より取り扱い店舗にて予約開始！", "2026-10-30", { date: "2026-11-02" }],
  ["tamashii-news-2026-11-12-16187", "【機動武闘伝Gガンダム】「シャイニングガンダム マーシャルアクション」がROBOT魂に登場！一般店頭にて11/12より予約受付開始！", "2026-11-12", { date: "2026-11-12" }],
  ["bandai-news-2026-09-29-wMDI1Nzg5NC8", "「SDガンダムBB戦士 VS闇軍団セット１」 9月29日(火) お申し込み受付開始！", "2026-09-29", { date: "2026-09-29" }],
  ["gundam-official-av4l23c6wkznttow3kigwzyl", "「RG ストライクフリーダムガンダム ディアクティブモード」「HG G-セルフ（大気圏用パック&宇宙用パック）（劇場版『Gのレコンギスタ』Ver.）」ほかガンプラ＆関連アイテムの追加予約が本日スタート！", "2026-10-30", { date: "2026-10-30" }],
  ["gundam-official-y3epyw9n944u32xm78ox5d7k", "「FW GUNDAM CONVERGE CORE フルアーマーΖΖガンダム【PB限定】」本日より再販予約受付スタート！特徴的な「ハイパー・ビーム・サーベル」も付属！", "2026-05-25", { date: "2026-05-25" }],
  // Not a preorder: votes, a forum opening, a release day, a ship month.
  ["gundam-official-ffam2yqmktkqgg6c4no44pmq", "ビルダーズノートにて「ガンプラ再販会議 2026冬シーズン 第3回選抜選挙」投票受付中！今回のテーマは「MG」と『機動戦士ガンダム』『機動戦士Ζガンダム』！", "2026-11-04", null],
  ["gundam-official-cs2eanjgtbqsjr1dfvy5e4z5", "ビルダーズノートにて「ガンプラ再販会議 2026秋シーズン 第2回選抜選挙」が本日よりスタート！今回の選抜選挙のテーマは『ガンダムビルドファイターズ』！", "2026-08-03", null],
  ["gundam-official-p8vwfbp62ds1i7s3iqor1c1b", "みんなの声を再販検討に活かす新しい取り組み！ビルダーズノート「ガンプラ再販会議」5月12日よりスタート！", "2026-05-07", null],
  ["gundam-official-hb1pf2pc3jlmfbmepl3vzfnt", "「MG ガンダムベース限定 ガンダムキュリオス（トランザムモード）［メタリックグロスインジェクション］」9月19日発売！", "2026-09-11", null],
  ["pbandai-1000260987", "HGUC 1/144 イフリート【再販】【２次：２０２７年４月発送】", "2026-11-10", null],
];
for (const [id, title, postDay, expected] of TITLES) {
  const found = preorderFromTitle(title, postDay);
  if (!expected) {
    assert.equal(found, null, id);
    continue;
  }
  assert.equal(found.basis, "title", id);
  assert.equal(found.at, expected.at, id);
  assert.equal(found.date, expected.date || expected.at.slice(0, 10), id);
}

// The year is the one nearest the post (synthetic: the corpus runs May to November).
assert.equal(preorderFromTitle("「サンプル」魂ウェブ商店にて1/5 16時より予約受付開始！", "2026-12-28").at, "2027-01-05T16:00:00+09:00");
assert.equal(nearestYearDay(12, 27, "2027-01-03"), "2026-12-27");
assert.equal(nearestYearDay(2, 30, "2026-02-01"), null);
// A record dated by first sight has no post day for 本日 (synthetic).
assert.equal(preorderFromTitle("「サンプル」の追加予約が本日11時よりスタート！", "2026-11-14", { firstSeen: true }), null);
assert.equal(preorderFromTitle("「サンプル」11月20日12時より予約開始！", "2026-11-14", { firstSeen: true }).at, "2026-11-20T12:00:00+09:00");
// A scale is not a date, and a result far from the post is a misreading (synthetic).
assert.equal(preorderFromTitle("「1/12スケール サンプル」予約受付開始！", "2026-11-14"), null);
assert.equal(preorderFromTitle("「サンプル」3月20日より予約開始！", "2026-11-14"), null);
// A closing is not an opening (synthetic: no title in the corpus names one).
assert.equal(preorderFromTitle("「サンプル」11月20日まで予約受付中！", "2026-11-14"), null);
assert.equal(preorderFromTitle("「サンプル」11月20日23時59分に予約受付終了！", "2026-11-14"), null);
assert.equal(preorderFromTitle("「サンプル」11月20日23:59受注締切！", "2026-11-14"), null);
assert.equal(preorderFromTitle("「サンプル」11/13 18時より予約受付開始！11/20 23時まで", "2026-11-12").at, "2026-11-13T18:00:00+09:00");

// withTitlePreorders writes the fields; status stays as it is.
const [nightingale] = withTitlePreorders([announcementRecord({
  id: "tamashii-news-2026-05-21-15872",
  sourceId: "tamashii_news",
  franchise: "gundam",
  title: "【ガンダム】5月22日 16時受注開始！ROBOT魂より「ナイチンゲール ～Exclusive Edition～」が登場！",
  status: "product_confirmed",
  announcedAt: "2026-05-21",
  sourceName: "TAMASHII WEB",
  sourceUrl: "https://tamashiiweb.com/item/15872/",
})], { now: new Date("2026-11-14T00:00:00Z") });
assert.equal(nightingale.status, "product_confirmed");
assert.equal(nightingale.preorder_at, "2026-05-22T16:00:00+09:00");
assert.equal(nightingale.preorder_date, "2026-05-22");
assert.equal(nightingale.preorder_basis, "title");
assert.equal(nightingale.preorder_end_at, undefined);

// --- Premium Bandai's new-items list: the hour, for 予約 listings only.
// The ガンプラ category list (read beside it) is what marks the truncated ボールK型 as Gunpla.
const listed = parsePremiumBandaiNewItems(fixture("pbandai-new-itemlist-items.html"), {
  gunplaIds: new Set(["1000260986"]),
  now: new Date("2026-11-13T12:00:00+09:00"),
});
const pb = new Map(listed.map((record) => [record.id, record]));
assert.equal(pb.get("pbandai-1000258239").preorder_at, "2026-11-13T12:00:00+09:00");
assert.equal(pb.get("pbandai-1000258239").preorder_date, "2026-11-13");
assert.equal(pb.get("pbandai-1000258239").preorder_basis, "store_list");
assert.equal(pb.get("pbandai-1000260986").preorder_at, "2026-11-10T11:00:00+09:00");
assert.equal(pb.get("pbandai-1000260986").announced_at, "2026-11-10");
// PG ユニコーン went on sale at 8時; no 予約 badge, so no preorder fields.
assert.equal(pb.get("pbandai-1000261240").status, "product_confirmed");
assert.equal(pb.get("pbandai-1000261240").preorder_at, undefined);
assert.equal(pb.get("pbandai-1000261240").preorder_date, undefined);

// --- 魂ウェブ's schedule: days only, never publishDate's 08:00.
const scheduleItems = parseTamashiiSchedule(JSON.parse(fixture("tamashii-schedule-2026-11.json"))).items;
const windows = scheduleWindows(scheduleItems);
assert.deepEqual(windows.get("16252"), { date: "2026-11-04", end_date: "2026-11-29", basis: "schedule" });
assert.deepEqual(windows.get("16127"), { date: "2026-09-04", end_date: "2026-11-01", basis: "schedule" });
assert.deepEqual(windows.get("16258"), { date: "2026-11-13", basis: "schedule" });
assert.equal(windows.has("16254"), false); // a store exclusive with no preorder
const scheduled = tamashiiScheduleRecords(scheduleItems, { today: "2026-11-13" }).records;
const scheduledKyrios = scheduled.find((record) => record.id === "tamashii-schedule-16258");
assert.equal(scheduledKyrios.preorder_date, "2026-11-13");
assert.equal(scheduledKyrios.preorder_at, undefined);
assert.equal(scheduledKyrios.preorder_basis, "schedule");

const kyriosPost = announcementRecord({
  id: "tamashii-news-2026-11-13-16258",
  sourceId: "tamashii_news",
  franchise: "gundam",
  title: TITLES[0][1],
  status: "preorder_open",
  announcedAt: "2026-11-13",
  sourceName: "TAMASHII WEB",
  sourceUrl: "https://tamashiiweb.com/item/16258/",
});
const zockPost = { ...kyriosPost, id: "tamashii-news-2026-09-03-16127", names: { ja: "【機動戦士ガンダム】「MSM-10 ゾック」がROBOT魂 ver. A.N.I.M.E.より登場！魂ウェブ商店にて9/4 16時より予約受付開始！" }, announced_at: "2026-09-03", source_url: "https://tamashiiweb.com/item/16127/" };
const oldPost = { ...kyriosPost, id: "tamashii-news-2026-05-01-16258", names: { ja: "「ガンダムキュリオス」" }, announced_at: "2026-05-01" };
const NOV14 = { now: new Date("2026-11-14T03:00:00Z") };
const withWindows = withScheduleWindows(withTitlePreorders([kyriosPost, zockPost, oldPost], NOV14), windows, NOV14);
// The title's clock stays; the schedule adds the closing day.
assert.equal(withWindows[0].preorder_at, "2026-11-13T18:00:00+09:00");
assert.equal(withWindows[0].preorder_basis, "title");
assert.equal(withWindows[1].preorder_at, "2026-09-04T16:00:00+09:00");
assert.equal(withWindows[1].preorder_end_date, "2026-11-01");
// A post months before the window is other news.
assert.equal(withWindows[2].preorder_date, undefined);

// --- BEYBLADE X: the window is in the body, with year and minutes.
assert.deepEqual(beybladeOrderWindow(fixture("beyblade-news-261014.html")), {
  at: "2026-10-15T10:00:00+09:00",
  date: "2026-10-15",
  end_at: "2026-10-28T23:59:00+09:00",
  end_date: "2026-10-28",
  basis: "post_body",
});
// The lottery notice explains the system and gives no window.
assert.equal(beybladeOrderWindow(fixture("beyblade-news-260622-2.html")), null);

// --- The merge only moves forward.
const BEFORE = { now: new Date("2026-11-10T00:00:00Z") };
const AFTER = { now: new Date("2026-11-21T00:00:00Z") };
const listedRow = { ...kyriosPost, id: "pbandai-1", preorder_at: "2026-11-20T12:00:00+09:00", preorder_date: "2026-11-20", preorder_basis: "store_list" };
const titleRow = { ...kyriosPost, id: "t-1", preorder_at: "2026-11-20T12:00:00+09:00", preorder_date: "2026-11-20", preorder_basis: "title" };
// A row the list no longer shows keeps its time.
assert.equal(mergeAnnouncementRecords([listedRow], [{ ...listedRow, preorder_at: undefined, preorder_date: undefined, preorder_basis: undefined }])[0].preorder_at, "2026-11-20T12:00:00+09:00");
assert.equal(mergeAnnouncementRecords([listedRow], [])[0].preorder_at, "2026-11-20T12:00:00+09:00");
// Before it opens, the same or a stronger source may move it, and that is logged.
const lines = [];
const moved = applyPreorder(titleRow, { at: "2026-11-21T13:00:00+09:00", basis: "store_list" }, { ...BEFORE, log: (line) => lines.push(line) });
assert.equal(moved.preorder_at, "2026-11-21T13:00:00+09:00");
assert.equal(moved.preorder_date, "2026-11-21");
assert.equal(moved.preorder_basis, "store_list");
assert.match(lines[0], /^preorder moved t-1: /);
assert.equal(mergeAnnouncementRecords([titleRow], [{ ...titleRow, preorder_at: "2026-11-20T13:00:00+09:00" }], BEFORE)[0].preorder_at, "2026-11-20T13:00:00+09:00");
// Once open it is frozen, except for a one-off reparse.
assert.equal(applyPreorder(titleRow, { at: "2026-11-20T13:00:00+09:00", basis: "title" }, AFTER).preorder_at, "2026-11-20T12:00:00+09:00");
assert.equal(applyPreorder(titleRow, { at: "2026-11-20T13:00:00+09:00", basis: "title" }, { ...AFTER, reparse: true }).preorder_at, "2026-11-20T13:00:00+09:00");
// A weaker source never replaces a stronger one; a day never replaces a clock.
const mismatches = [];
assert.equal(applyPreorder(listedRow, { at: "2026-11-20T18:00:00+09:00", basis: "title" }, { ...BEFORE, log: (line) => mismatches.push(line) }).preorder_at, "2026-11-20T12:00:00+09:00");
assert.match(mismatches[0], /^preorder mismatch pbandai-1: store_list 2026-11-20T12:00:00\+09:00 vs title/);
assert.equal(applyPreorder(titleRow, { date: "2026-11-21", basis: "schedule" }, BEFORE).preorder_at, "2026-11-20T12:00:00+09:00");
// A clock beats a day whatever its source.
const dayOnly = { ...kyriosPost, id: "d-1", preorder_date: "2026-11-20", preorder_basis: "schedule" };
assert.equal(applyPreorder(dayOnly, { at: "2026-11-20T16:00:00+09:00", date: "2026-11-20", basis: "title" }, BEFORE).preorder_basis, "title");
// A manual value is never touched.
assert.equal(applyPreorder({ ...titleRow, preorder_basis: "manual" }, { at: "2026-11-20T13:00:00+09:00", basis: "store_list" }, BEFORE).preorder_at, "2026-11-20T12:00:00+09:00");
// The schedule may push a closing day out while the window runs.
const window = { ...dayOnly, preorder_end_date: "2026-11-29" };
assert.equal(applyPreorder(window, { date: "2026-11-20", end_date: "2026-12-06", basis: "schedule" }, BEFORE).preorder_end_date, "2026-12-06");

// --- Twins: the キュリオス reveal and its topic post carry 18:00 whichever stays.
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
});
const [timedPost] = withTitlePreorders([kyriosPost], NOV14);
const pool = new Map([[reveal.id, reveal], [timedPost.id, timedPost]]);
assert.equal(twinPreorders(pool, [{ id: timedPost.id, kept: reveal.id }]).get(reveal.id).at, "2026-11-13T18:00:00+09:00");
assert.equal(twinPreorders(pool, [{ id: reveal.id, kept: timedPost.id }]).size, 0); // the post keeps its own
// A chain a → b → c ends at c.
const middle = { ...reveal, id: "tamashii-schedule-16258" };
const chained = twinPreorders(new Map([...pool, [middle.id, middle]]), [{ id: timedPost.id, kept: middle.id }, { id: middle.id, kept: reveal.id }]);
assert.equal(chained.get(reveal.id).at, "2026-11-13T18:00:00+09:00");
// A reveal kept beside the post it is promoted by takes the post's time too.
const promoted = promoteRevealStages([reveal, timedPost]).records.find((record) => record.id === reveal.id);
assert.equal(promoted.status, "preorder_open");
assert.equal(promoted.preorder_at, "2026-11-13T18:00:00+09:00");

// --- GUNDAM.INFO dates are Japan's day (synthetic payload: a post at 08:30 JST).
const flight = (response) => `<script>self.__next_f.push([1,${JSON.stringify(`"newsResponse":${JSON.stringify(response)}`)}])</script>`;
const early = parseGundamOfficialNews(flight({
  data: [{
    documentId: "sample",
    displayDatetime: "2026-11-11T23:30:00.000Z",
    title: "「サンプル」の追加予約が本日11時よりスタート！",
    url: "https://gundam-official.com/news/sample",
    categories: [{ name: "ガンプラ" }],
  }],
}));
assert.equal(early.records[0].announced_at, "2026-11-12");
assert.equal(early.oldest, "2026-11-12");

// --- Links to the catalog product whose own page an announcement is.
const kits = [
  { kit_id: "tamashii-16258", source_urls: ["https://tamashiiweb.com/item/16258/", "https://tamashiiweb.com/item_brand/metal_build/"] },
  { kit_id: "tamashii-16259", source_urls: ["https://tamashiiweb.com/item_brand/metal_build/"] },
  { kit_id: "pbandai-wb-1000256700", source_urls: ["https://p-bandai.jp/item/item-1000256700/", "https://p-bandai.jp/item/item-1000260727/"] },
];
const pbRow = { ...kyriosPost, id: "pbandai-1000260727", source_id: "premium_bandai_new_items", source_name: "プレミアムバンダイ", source_url: "https://p-bandai.jp/item/item-1000260727/" };
const brandRow = { ...kyriosPost, id: "brand", source_url: "https://tamashiiweb.com/item_brand/metal_build/" };
const dynamesRow = { ...kyriosPost, id: "tamashii-news-2026-11-12-16259", source_url: "https://tamashiiweb.com/item/16259/" };
const unofficialRow = { ...kyriosPost, id: "media", unofficial: true, confidence: "unofficial" };
const links = linkSourcePageKits([kyriosPost, pbRow, brandRow, dynamesRow, unofficialRow], kits);
assert.deepEqual(links.linked, [
  { id: kyriosPost.id, kit_id: "tamashii-16258" },
  { id: pbRow.id, kit_id: "pbandai-wb-1000256700" },
  { id: dynamesRow.id, kit_id: "tamashii-16259" }, // by its 魂ウェブ item id
]);
assert.equal(links.records[0].linked_kit_basis, SOURCE_PAGE_LINK);
assert.equal(links.records[2].linked_kit_id, null); // a page two kits share names neither
assert.equal(links.records[4].linked_kit_id, null);
// Such a link does not keep a twin from the dedupe or put it first; a CMS link still does.
const gundamInfo = announcementRecord({
  id: "gundam-official-x",
  sourceId: "gundam_official_news",
  franchise: "gundam",
  title: "「METAL BUILD ガンダムキュリオス」本日11月13日18時より予約受付スタート！",
  announcedAt: "2026-11-13",
  sourceName: "GUNDAM.INFO",
  sourceUrl: "https://gundam-official.com/news/x",
});
const twins = [{ ...gundamInfo, names: { ja: "「ガンダムキュリオス」本日11月13日18時より予約受付スタート！" } }, links.records[0]];
assert.deepEqual(dedupeAnnouncements(twins, ["tamashii_news", "gundam_official_news"]).dropped, [{ id: gundamInfo.id, kept: kyriosPost.id }]);
const cmsLinked = { ...twins[0], linked_kit_id: "tamashii-16258" };
assert.deepEqual(dedupeAnnouncements([cmsLinked, links.records[0]], ["tamashii_news", "gundam_official_news"]).dropped, [{ id: kyriosPost.id, kept: gundamInfo.id }]);

console.log("preorder times: ok");
