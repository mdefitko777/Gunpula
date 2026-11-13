// Unofficial announcement sources: the feed reader, the intake rules, the five
// sites and the rules by which an official record replaces theirs. Fixtures
// are what each site answered this bot on 2026-11-13, cut down: a few items
// each, post bodies cut after the lead picture.
//   hamusuke-feed.xml          4 of 10 items of hamusuke.com/feed/
//   hamusuke-schedule.html     the November and December sections of its schedule page
//   hjweb-feed.xml, -page2     3 + 4 of the 10 items of hjweb.jp/feed/ and ?paged=2
//   dengeki-gunpla-tag.html    5 of 47 cards of the ガンプラ tag, and one ranking card
//   figsoku-fate-feed.xml      6 of 10 items of figsoku.net/tag/fate/feed
//   stds-newsets-feed.xml      6 of 8 items of stds.jp/tag/newsets/feed/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsStoredAnnouncement, mergeAnnouncementRecords, thumbnailStaysRemote } from "./lib/bandai-announcements.mjs";
import { coroCoroRecords, dropMagazineDuplicates, emptyCoroCoroState } from "./lib/corocoro-news.mjs";
import { advanceStages, announcementRecord, dedupeAnnouncements } from "./lib/official-announcements.mjs";
import { parseRobots, robotsAllows } from "./lib/robots.mjs";
import { japanDay, parseRssItems } from "./lib/rss.mjs";
import { INTAKE_MAX_NEW, INTAKE_RECENT_DAYS, admitItems } from "./lib/source-intake.mjs";
import {
  DENGEKI_SOURCE_ID,
  DENGEKI_TAG_URL,
  FIGSOKU_SOURCE_ID,
  FIGSOKU_TAGS,
  HAMUSUKE_FEED_URL,
  HAMUSUKE_SOURCE_ID,
  HJWEB_FEED_URL,
  HJWEB_SOURCE_ID,
  STDS_FEED_URL,
  STDS_SOURCE_ID,
  UNOFFICIAL_SOURCES,
  UnexpectedPage,
  dengekiCandidates,
  dropUnofficialDuplicates,
  figsokuCandidates,
  figsokuFeedUrl,
  hamusukeCandidates,
  hamusukeScheduleUrl,
  hjwebCandidates,
  keepsApart,
  makerPages,
  parseDengekiTagPage,
  parseHamusukePost,
  parseHamusukeSchedule,
  quoteProducts,
  quotedProducts,
  runUnofficialSource,
  stdsCandidates,
  unofficialSource,
} from "./lib/unofficial-feeds.mjs";

const TODAY = "2026-11-13";
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const SCHEDULE_URL = "https://hamusuke.com/beybladex-schedule-202607-12-sales/";

// A reader over canned pages; anything else is a 404, as the fetcher reports one.
function cannedFetch(pages, asked = []) {
  return async (url) => {
    asked.push(url);
    if (!(url in pages)) throw Object.assign(new Error(`${url} returned 404`), { status: 404 });
    return pages[url];
  };
}

// ---------------------------------------------------------------------------
// The feed reader.

const hamusukeItems = parseRssItems(fixture("hamusuke-feed.xml"));
assert.equal(hamusukeItems.length, 4);
assert.equal(hamusukeItems[0].title, "【ベイブレードX】UX-22 バニッシュルシファーWW 発売前情報！");
assert.equal(hamusukeItems[0].link, "https://hamusuke.com/baybladex-ux22-vanishlucifer-report/");
assert.equal(hamusukeItems[0].guid, "https://hamusuke.com/?p=25329");
assert.ok(hamusukeItems[0].categories.includes("新商品情報"));
assert.match(hamusukeItems[0].html, /^<p>こんにちは/);
// Posted 23:42 UTC on the 12th: the 13th in Japan.
assert.equal(hamusukeItems[1].publishedAt, "2026-11-12T23:42:38.000Z");
assert.equal(hamusukeItems[1].date, "2026-11-13");
assert.equal(japanDay("2026-11-12T14:59:59Z"), "2026-11-12");
assert.equal(japanDay("not a date"), null);
// A page that is not a feed (a bot check, an error page) is told apart from an empty feed.
assert.equal(parseRssItems("<html><body>Just a moment...</body></html>"), null);
assert.deepEqual(parseRssItems('<rss version="2.0"><channel><title>x</title></channel></rss>'), []);

// ---------------------------------------------------------------------------
// Intake: the last 21 days, twelve new items at most, and once is enough.

assert.equal(INTAKE_RECENT_DAYS, 21);
assert.equal(INTAKE_MAX_NEW, 12);
const listed = Array.from({ length: 30 }, (_, index) => ({ key: `p${index}`, date: `2026-11-${String(index + 1).padStart(2, "0")}` }));
const firstRead = admitItems(listed, {}, { today: "2026-11-30" });
// 11-09 and later are inside the window (18 items); the newest twelve are taken.
assert.deepEqual(firstRead.admitted.map((item) => item.key), listed.slice(18).reverse().map((item) => item.key));
assert.equal(Object.keys(firstRead.state.passed).length, 18);
// The next day: one new post is taken, the passed ones are not offered again.
const nextRead = admitItems([...listed, { key: "p30", date: "2026-12-01" }], firstRead.state, { today: "2026-12-01" });
assert.equal(nextRead.admitted.length, 13);
assert.equal(nextRead.admitted.at(-1).key, "p30");
// A taken item keeps the date it was first given, and is taken as long as it is listed.
const moved = admitItems([{ key: "p29", date: "2026-12-24" }], nextRead.state, { today: "2026-12-25" });
assert.deepEqual(moved.admitted, [{ key: "p29", date: "2026-11-30" }]);
// A record already in the data is followed even without state (a lost state file).
assert.equal(admitItems([{ key: "old", date: "2026-01-01" }], {}, { today: TODAY, isStored: () => true }).admitted.length, 1);
// An item the source cannot date is held back on a first read.
assert.deepEqual(admitItems([{ key: "row", date: TODAY, hold: true }], {}, { today: TODAY }).state.passed, { row: TODAY });

// ---------------------------------------------------------------------------
// ハムすけの備忘録: 発売前情報 posts and the schedule page.

const [vanishPost, boosterPost, reviewPost, setPost] = hamusukeItems.map(parseHamusukePost);
assert.deepEqual(vanishPost, {
  code: "UX-22",
  name: "バニッシュルシファーWW",
  kind: "スターター",
  rare: null,
  release: "2026-12-26",
  price: 2500,
  // The 1100 px product render at list size; not the emoji or the 110 px shop icon before it.
  image: "https://hamusuke.com/wp/wp-content/uploads/2026/11/HW7wPW3bgAAySPt-768x768.jpg",
  link: "https://hamusuke.com/baybladex-ux22-vanishlucifer-report/",
  postId: "25329",
  date: "2026-11-13",
});
assert.equal(boosterPost.name, "ランダムブースターVol.12");
assert.equal(boosterPost.rare, "ホルスシャッター3-85MO");
assert.equal(boosterPost.price, 1600);
assert.equal(reviewPost, null, "開封レビュー is not a reveal");
assert.equal(setPost.kind, "カスタマイズセット");
assert.equal(setPost.release, "2026-11-21");
// The schedule page changes address every half year; the posts link the current one.
assert.equal(hamusukeScheduleUrl(hamusukeItems), SCHEDULE_URL);
assert.equal(hamusukeScheduleUrl([]), null);

const schedulePage = parseHamusukeSchedule(fixture("hamusuke-schedule.html"), { today: TODAY });
assert.equal(schedulePage.months, 2);
assert.deepEqual(schedulePage.rows.map((row) => `${row.release} ${row.code} ${row.kind} ${row.name}`), [
  "2026-11-21 CX-20 セット カスタマイズセットC",
  "2026-11-21 BX-54 ブースター ジークスペリオン0-70LP",
  "2026-12-26 UX-22 スターター バニッシュルシファーWW",
  "2026-12-26 BX-55 ブースター ランダムブースター",
]);
assert.equal(schedulePage.rows[2].image, "https://hamusuke.com/wp/wp-content/uploads/2026/11/HW7wPXCbQAArQIU.jpg");
// What is already out is not news; a page without the monthly sections is not the schedule.
assert.equal(parseHamusukeSchedule(fixture("hamusuke-schedule.html"), { today: "2026-11-22" }).rows.length, 2);
assert.deepEqual(parseHamusukeSchedule("<html><body>Just a moment...</body></html>", { today: TODAY }), { rows: [], months: 0 });

// Titles in the shape the CoroCoro records use; one record per product code.
const beyTitles = Object.fromEntries(hamusukeCandidates([vanishPost, boosterPost, setPost], schedulePage.rows, { today: TODAY })
  .map((candidate) => [candidate.key, candidate.record.names.ja]));
assert.deepEqual(beyTitles, {
  "hamusuke-ux-22": "UX-22 スターター「バニッシュルシファーWW」",
  "hamusuke-bx-55": "BX-55 ランダムブースターVol.12「ホルスシャッター3-85MO」",
  "hamusuke-cx-20": "「CX-20 カスタマイズセットC」",
  "hamusuke-bx-54": "BX-54 ブースター「ジークスペリオン0-70LP」", // on the page only
});
// "-00" is every limited item: told apart by the post, never taken from a row.
const limitedPost = { ...vanishPost, code: "BX-00", name: "ドランソード3-60F バージョン2", postId: "25245" };
assert.deepEqual(
  hamusukeCandidates([limitedPost], [{ code: "CX-00", kind: "セット", name: "エヴァンゲリオンデッキセット", release: "2026-12-01", image: null }], { today: TODAY }).map((candidate) => candidate.key),
  ["hamusuke-p25245"],
);

const hamusuke = unofficialSource(HAMUSUKE_SOURCE_ID);
const hamusukePages = { [HAMUSUKE_FEED_URL]: fixture("hamusuke-feed.xml"), [SCHEDULE_URL]: fixture("hamusuke-schedule.html") };
const asked = [];
const logLines = [];
const hamusukeRun = await runUnofficialSource(hamusuke, { today: TODAY, fetchText: cannedFetch(hamusukePages, asked), log: (line) => logLines.push(line) });
assert.deepEqual(asked, [HAMUSUKE_FEED_URL, SCHEDULE_URL]);
// The two December beys; the October set is older than the window, and a row
// without a post has no date on a first read.
assert.deepEqual(hamusukeRun.records.map((record) => record.id).sort(), ["hamusuke-bx-55", "hamusuke-ux-22"]);
assert.deepEqual(hamusukeRun.state.passed, { "hamusuke-bx-54": TODAY, "hamusuke-cx-20": "2026-10-15" });
assert.equal(hamusukeRun.state.schedule_url, SCHEDULE_URL);
const vanish = hamusukeRun.records.find((record) => record.id === "hamusuke-ux-22");
assert.equal(vanish.names.ja, "UX-22 スターター「バニッシュルシファーWW」");
assert.equal(vanish.franchise, "beyblade");
assert.equal(vanish.status, "announced");
assert.equal(vanish.announced_at, "2026-11-13");
assert.equal(vanish.unofficial, true);
assert.equal(vanish.confidence, "unofficial");
assert.equal(vanish.source_id, HAMUSUKE_SOURCE_ID);
assert.equal(vanish.source_name, "ハムすけの備忘録");
assert.equal(vanish.source_url, "https://hamusuke.com/baybladex-ux22-vanishlucifer-report/");
assert.equal(vanish.thumbnail_url, "https://hamusuke.com/wp/wp-content/uploads/2026/11/HW7wPW3bgAAySPt-768x768.jpg");
assert.match(vanish.notes, /^2026年12月26日発売 \/ 2,500円 \/ スターター\. Fan blog post/);
assert.deepEqual(vanish.names, { ja: vanish.names.ja, zh: null, ko: null, en: null }, "no guessed translations");
assert.deepEqual(logLines, ["hamusuke_beyblade: 4 posts fit, 2 records"]);

// The 03:20 JST run comes between the page update and the posts: the rows are
// taken from the page, dated that day, and the posts fill them in a day later.
const withoutPosts = fixture("hamusuke-feed.xml").replace(/<item>[\s\S]*?<\/item>\s*<item>[\s\S]*?<\/item>/, "");
assert.equal(parseRssItems(withoutPosts).length, 2);
const seenBefore = { seen: {}, passed: { "hamusuke-bx-54": "2026-10-15", "hamusuke-cx-20": "2026-10-15" } };
const early = await runUnofficialSource(hamusuke, {
  today: TODAY,
  state: seenBefore,
  fetchText: cannedFetch({ ...hamusukePages, [HAMUSUKE_FEED_URL]: withoutPosts }),
});
assert.deepEqual(early.records.map((record) => `${record.announced_at} ${record.names.ja} ${record.source_url}`).sort(), [
  `2026-11-13 UX-22 スターター「バニッシュルシファーWW」 ${SCHEDULE_URL}`,
  `2026-11-13 「BX-55 ランダムブースター」 ${SCHEDULE_URL}`,
]);
const dayAfter = await runUnofficialSource(hamusuke, {
  today: "2026-11-14",
  state: early.state,
  stored: new Map(early.records.map((record) => [record.id, record])),
  fetchText: cannedFetch(hamusukePages),
});
const booster = dayAfter.records.find((record) => record.id === "hamusuke-bx-55");
assert.equal(booster.names.ja, "BX-55 ランダムブースターVol.12「ホルスシャッター3-85MO」");
assert.equal(booster.announced_at, "2026-11-13");
assert.equal(booster.source_url, "https://hamusuke.com/beybladex-bx55-randombooster12-report/");
assert.equal(dayAfter.records.length, 2);

// robots.txt is asked per URL, and a page that is not the feed stops the source.
await assert.rejects(
  runUnofficialSource(hamusuke, { today: TODAY, fetchText: cannedFetch(hamusukePages), robotsAllows: () => false }),
  /disallowed by robots\.txt/,
);
await assert.rejects(
  runUnofficialSource(hamusuke, { today: TODAY, fetchText: async () => "<html><title>Just a moment...</title></html>" }),
  UnexpectedPage,
);
await assert.rejects(
  runUnofficialSource(hamusuke, { today: TODAY, fetchText: cannedFetch({ ...hamusukePages, [SCHEDULE_URL]: "<html>Access denied</html>" }) }),
  UnexpectedPage,
);
// A picture robots.txt keeps the bot from is left out; the record stays.
const noPictures = await runUnofficialSource(hamusuke, { today: TODAY, fetchText: cannedFetch(hamusukePages), imageAllowed: async () => false });
assert.deepEqual(noPictures.records.map((record) => record.thumbnail_url), [null, null]);

// ---------------------------------------------------------------------------
// Hobby JAPAN Web: show reports and reveal news of the app's worlds.

const hjwebPages = [fixture("hjweb-feed.xml"), fixture("hjweb-feed-page2.xml")].map(parseRssItems);
// Page 1 of the fixture: a ONE PIECE figure, a ボトムズ prototype, a スーパー戦隊 reveal. None is ours.
assert.deepEqual(hjwebCandidates(hjwebPages[0]), []);
// Page 2: three TAMASHII NATION reports on Gundam; the カービィ reveal is not ours.
const hjweb = hjwebCandidates(hjwebPages[1]);
assert.deepEqual(hjweb.map((candidate) => `${candidate.record.id} ${candidate.record.status} ${candidate.date}`), [
  "hjweb-2884735 product_confirmed 2026-11-12", // …初展示！「GNアームズ TYPE-K オプションセット」の商品化も決定
  "hjweb-2884580 announced 2026-11-12", // …参考展示
  "hjweb-2884578 announced 2026-11-12",
]);
const report = hjweb[0].record;
assert.equal(report.names.ja, "【ガンダム00】METAL BUILD「ガンダムデュナメス」「ガンダムキュリオス」が初展示！「GNアームズ TYPE-K オプションセット」の商品化も決定【TAMASHII NATION 2026 レポート】");
assert.equal(report.franchise, "gundam");
assert.equal(report.source_name, "Hobby JAPAN Web");
assert.equal(report.source_url, "https://hjweb.jp/article/2884735/");
assert.equal(report.thumbnail_url, "https://hjweb.jp/wp-content/uploads/2026/11/ae46b1f460ee46f789c27b264a6cb421-4-1024x683.jpg");
assert.equal(report.unofficial, true);
// The work can stand in the categories alone ("【Ka signature】METAL ROBOT魂「百式」…" + 機動戦士Zガンダム).
assert.match(hjweb[1].record.names.ja, /^【Ka signature】METAL ROBOT魂「百式」/);
// Build logs and magazine previews are not reveals, whatever else the title says
// (a title from the site's ガンダム feed of the same day).
const preview = {
  ...hjwebPages[1][1],
  title: "【試し読み】2色の塗り重ねによる“清水筆塗りメソッド”「VAKIT ギラ・ドーガ」塗装！作例のカラーレシピと迷彩塗装の基本をご紹介【筆塗りトライブ】",
  categories: ["機動戦士ガンダム 逆襲のシャア"],
};
assert.deepEqual(hjwebCandidates([preview]), []);
// "新作プラモデル" means Gundam on Bandai's own feeds, not in a hobby magazine.
assert.deepEqual(hjwebCandidates([{ ...hjwebPages[1][1], title: "新作プラモデル「30MM エグザビークル」が登場", categories: ["30MM"] }]), []);

// Paging: back to the newest post of the last run less a day, four pages at most.
const hjwebSource = unofficialSource(HJWEB_SOURCE_ID);
const emptyFeed = '<rss version="2.0"><channel><title>Hobby JAPAN Web</title></channel></rss>';
const feedPages = { [HJWEB_FEED_URL]: fixture("hjweb-feed.xml"), [`${HJWEB_FEED_URL}?paged=2`]: fixture("hjweb-feed-page2.xml"), [`${HJWEB_FEED_URL}?paged=3`]: emptyFeed };
const hjwebAsked = [];
const hjwebRun = await runUnofficialSource(hjwebSource, { today: TODAY, fetchText: cannedFetch(feedPages, hjwebAsked) });
assert.deepEqual(hjwebAsked, [HJWEB_FEED_URL, `${HJWEB_FEED_URL}?paged=2`, `${HJWEB_FEED_URL}?paged=3`]);
assert.equal(hjwebRun.records.length, 3);
assert.equal(hjwebRun.state.read_until, "2026-11-13T03:00:00.000Z");
// The next run stops at the page that reaches a day before that post.
const hjwebAgain = [];
const secondRun = await runUnofficialSource(hjwebSource, { today: "2026-11-14", state: hjwebRun.state, fetchText: cannedFetch(feedPages, hjwebAgain) });
assert.deepEqual(hjwebAgain, [HJWEB_FEED_URL, `${HJWEB_FEED_URL}?paged=2`]);
assert.equal(secondRun.records.length, 3);
// Never more than four pages, however far back the feed goes.
const endless = [];
await runUnofficialSource(hjwebSource, { today: TODAY, fetchText: async (url) => (endless.push(url), fixture("hjweb-feed-page2.xml")) });
assert.equal(endless.length, 4);

// ---------------------------------------------------------------------------
// 電撃オンライン, ガンプラ tag.

const tagPage = parseDengekiTagPage(fixture("dengeki-gunpla-tag.html"));
// Five cards of the list; the ranking card after </main> is not one of them.
assert.deepEqual(tagPage.cards.map((card) => card.id), ["92349", "92136", "91540", "91010", "91001"]);
assert.deepEqual(tagPage.cards[0], {
  id: "92349",
  url: "https://dengekionline.com/article/202610/92349",
  title: "【ガンダムX】ガンプラ『HG 1/144 ガンダムヴァサーゴ』が10/31発売。メガソニック砲発射シーンを描いたパッケージが目印！",
  date: "2026-10-28",
  image: "https://cimg.kgl-systems.io/camion/files/92349/thumbnail_UVdf.jpg",
});
// Kept: a kit's details and preorder, a teaser. Not kept: a release-day
// reminder, the shop's maintenance notice, a retailer's restock.
const dengeki = dengekiCandidates(tagPage.cards);
assert.deepEqual(dengeki.map((candidate) => candidate.record.id), ["dengeki-91010", "dengeki-91001"]);
assert.equal(dengeki[0].record.names.ja, "ガンプラ「HG ガンダムZERO」の詳細判明＆本日より順次予約開始。ガンダム最新作『アレックスゼロ』主役機、初の6色イロプラで劇中でのしなやかなアクションを再現可能");
assert.equal(dengeki[0].record.status, "preorder_open");
assert.equal(dengeki[0].record.franchise, "gundam");
assert.equal(dengeki[0].record.source_name, "電撃オンライン");
assert.equal(dengeki[1].record.names.ja, "【ガンプラ】ガンダム最新作『ガンダムZERO』より《新商品A（仮）》が2027年4月発売決定＆本日より順次予約開始");
// 『…』 with a grade or a scale is a kit; a work's title stays as it is.
assert.equal(quoteProducts("『MGSD デスティニーガンダム』と『機動戦士ガンダムSEED』"), "「MGSD デスティニーガンダム」と『機動戦士ガンダムSEED』");
assert.equal(quoteProducts("『1/100 フルアーマーZZガンダム』"), "「1/100 フルアーマーZZガンダム」");
// Other titles of the tag page that day. Box art for a kit a week from its
// release is no reveal, nor are a music single and a card-game deck; the first
// picture of a package not shown before is.
const dengekiTitled = (title) => dengekiCandidates([{ ...tagPage.cards[3], title }]).length;
assert.equal(dengekiTitled("2/21発売のガンプラ『MG 1/100 フルアーマーZZガンダム Ver.Ka』のパッケージ画像公開。鈍重な印象を過去のものにする新解釈のプロポーションは必見！【機動戦士ガンダムZZ】"), 0);
assert.equal(dengekiTitled("ガンプラ『MGSD デスティニーガンダム』のパッケージ画像公開（2/21発売）。光の翼を背にアロンダイトを構えるド迫力のSDアートを見よ！【機動戦士ガンダムSEED DESTINY】"), 0);
assert.equal(dengekiTitled("LINKL PLANETのガンプラ45周年記念シングル『胸にいつもガンプラを』が3月19日発売決定。限定盤にはガンプラ“RX-78-3 G-3”が付属"), 0);
assert.equal(dengekiTitled("【ガンプラ×TCG】7/12発売の『ガンダムカードゲーム スタートデッキ ガンダムアッセンブルセット』（全4種）が予約開始。アナタが選ぶ作品／陣営は？"), 0);
assert.equal(dengekiTitled("【ガンプラ】ENTRY GRADE 浮世絵パッケージVer.3種のパッケージ画像が初公開。『RX-78-2 ガンダム』『ストライクガンダム』『ウイングガンダム』が和柄シール付きで8月29日発売"), 1);
assert.equal(dengekiTitled("ガンプラ『MGSDクシャトリヤ』がお披露目。SDガンダムのフォルムにMGの技術を集約！【静岡ホビーショー】"), 1);

const dengekiSource = unofficialSource(DENGEKI_SOURCE_ID);
// On 2026-11-13 the newest kept card was four weeks old: nothing is news.
const dengekiRun = await runUnofficialSource(dengekiSource, { today: TODAY, fetchText: cannedFetch({ [DENGEKI_TAG_URL]: fixture("dengeki-gunpla-tag.html") }) });
assert.deepEqual(dengekiRun.records, []);
assert.deepEqual(Object.keys(dengekiRun.state.passed), ["91001", "91010"]);
// Read the day the two posts went up, both are.
const october = await runUnofficialSource(dengekiSource, { today: "2026-10-16", fetchText: cannedFetch({ [DENGEKI_TAG_URL]: fixture("dengeki-gunpla-tag.html") }) });
assert.equal(october.records.length, 2);
// The tag always lists articles: none is a new markup or a bot check.
await assert.rejects(runUnofficialSource(dengekiSource, { today: TODAY, fetchText: async () => "<html><main>「ガンプラ」の記事一覧</main></html>" }), UnexpectedPage);

// ---------------------------------------------------------------------------
// fig速: one tag feed per work, never a query string (robots.txt: Disallow: /*?*).

assert.equal(figsokuFeedUrl("fate"), "https://figsoku.net/tag/fate/feed");
const figsokuRobots = parseRobots("User-agent: *\nCrawl-delay: 1\nDisallow: /*?*\n");
for (const { tag } of FIGSOKU_TAGS) {
  assert.ok(!figsokuFeedUrl(tag).includes("?"));
  assert.ok(robotsAllows(figsokuRobots, figsokuFeedUrl(tag)), tag);
}
assert.ok(!robotsAllows(figsokuRobots, "https://figsoku.net/feed?paged=2"));

const fateItems = parseRssItems(fixture("figsoku-fate-feed.xml"));
assert.equal(fateItems.length, 6);
// 【近日予約開始】, 【予約開始】 and 【16日予約開始】 are reveals; 【本日発売】, a
// lottery's 【オンライン販売開始】 and a show's 【…情報まとめ】 are not.
const figures = figsokuCandidates(fateItems, "fate");
assert.deepEqual(figures.map((candidate) => `${candidate.key} ${candidate.date} ${candidate.record.status}`), [
  "532525 2026-10-27 product_confirmed",
  "530734 2026-10-16 preorder_open",
  "529947 2026-10-09 product_confirmed",
]);
const illya = figures[0].record;
assert.equal(illya.names.ja, "【プリズマ☆イリヤ】デザインココ「イリヤスフィール・フォン・アインツベルン」フィギュア【近日予約開始】");
assert.equal(illya.franchise, "fate");
assert.equal(illya.source_name, "fig速");
assert.equal(illya.source_url, "https://figsoku.net/blog-entry-532525.html");
// The full picture, not the 200×150 crop the text shows.
assert.equal(illya.thumbnail_url, "https://figsoku.net/wp-content/wonfes/reserve/fig_20261027_1793106030090.jpg");
assert.match(illya.id, /^figsoku-[0-9a-f]{10}$/);
// Adult figures are never taken.
assert.deepEqual(figsokuCandidates([{ ...fateItems[2], categories: [...fateItems[2].categories, "アダルト"] }], "fate"), []);
// Titles of the other tag feeds that day: a retailer's preorder is open, and a
// restock is not a reveal, wherever the title says it.
const titled = (title, categories = []) => figsokuCandidates([{ ...fateItems[2], title, categories }], "armored_core");
assert.equal(titled("【アーマード・コア】V.I.シリーズ「ミラージュ C01-GAEA レッドメタルVer.」プラモデル【Amazon予約開始】")[0].record.status, "preorder_open");
assert.equal(titled("【食玩】ポケモンスケールワールド「ミアレシティセット」【プレバン受注開始】")[0].record.status, "preorder_open");
assert.equal(titled("【ポケモンBW】コトブキヤ「トウヤ with ビクティニ」フィギュア 彩色原型公開【20日予約開始】")[0].record.status, "product_confirmed");
assert.deepEqual(titled("【まどかマギカ】グッスマ「アルティメットまどか」フィギュア 再販決定！【Amazon予約開始】"), []);
assert.deepEqual(titled("【アーマード・コア】V.I.シリーズ「クレスト CR-C75U2 デルタVer.」プラモデル【Amazon予約開始】", ["コトブキヤ", "再販"]), []);
assert.deepEqual(titled("【アーマード・コア】食玩SMP「AAP07: BALTEUS」プラモデル【本日予約締切】"), []);
// The maker's product pages a post links go on the record (the links of the
// ポケモンスケールワールド post of 11-08): each once, without the query string; a
// shop's affiliate link or the store's front page is not one.
const scaleWorldLinks = '<a href="https://p-bandai.jp/item/item-1000259827/?orgurl=http%3A%2F%2Fp-bandai.jp%3A8443%2Fcandytoy%2Fitem-1000259827%2F" target="_blank">「プレミアムバンダイ」で見る</a>'
  + '<a target="_blank" href="https://p-bandai.jp/item/item-1000259828/">x</a><a href="https://p-bandai.jp/item/item-1000259827/">x</a>'
  + '<a href="https://p-bandai.jp/">x</a><a href="https://hb.afl.rakuten.co.jp/hgc/1/?pc=https%3A%2F%2Fp-bandai.jp%2Fitem%2Fitem-1%2F">x</a>';
assert.deepEqual(makerPages(scaleWorldLinks), ["https://p-bandai.jp/item/item-1000259827/", "https://p-bandai.jp/item/item-1000259828/"]);
assert.deepEqual(makerPages('<a href="https://shop.kotobukiya.co.jp/shop/g/g4934054088706">x</a><a href="https://tamashiiweb.com/item/16259/#spec">x</a>'), [
  "https://shop.kotobukiya.co.jp/shop/g/g4934054088706/",
  "https://tamashiiweb.com/item/16259/",
]);
const scaleWorld = figsokuCandidates([{
  ...fateItems[2],
  title: "【食玩】ポケモンスケールワールド「 ピュール&メガズルズキン&ギルガルド(シールドフォルム)」「ヨーギラス&サナギラス&バンギラス&メガバンギラス」【プレバン受注開始】",
  html: `${fateItems[2].html}${scaleWorldLinks}`,
}], "pokemon")[0].record;
assert.deepEqual(scaleWorld.official_urls, ["https://p-bandai.jp/item/item-1000259827/", "https://p-bandai.jp/item/item-1000259828/"]);
assert.ok(!("official_urls" in illya), "a post that links no maker page has no such field");

// The same product comes back with its next state: one record, the first
// post's date, the newest post's title and link, and the stage moves on.
// (The later post is the real one with the state the site writes next.)
const openedPost = {
  ...fateItems[2],
  title: fateItems[2].title.replace("【近日予約開始】", "【予約開始】"),
  link: "https://figsoku.net/blog-entry-533900.html",
  guid: "https://figsoku.net/?p=533900",
  date: "2026-11-06",
};
const bothStates = figsokuCandidates([openedPost, fateItems[2]], "fate");
assert.equal(bothStates[0].record.id, bothStates[1].record.id);
assert.notEqual(bothStates[0].key, bothStates[1].key);

const figsokuSource = unofficialSource(FIGSOKU_SOURCE_ID);
const figsokuAsked = [];
const figsokuLog = [];
const figsokuRun = await runUnofficialSource(figsokuSource, {
  today: TODAY,
  fetchText: cannedFetch({ [figsokuFeedUrl("fate")]: fixture("figsoku-fate-feed.xml") }, figsokuAsked),
  log: (line) => figsokuLog.push(line),
});
// One request per work; a tag the site no longer has does not cost the others theirs.
assert.deepEqual(figsokuAsked, FIGSOKU_TAGS.map(({ tag }) => figsokuFeedUrl(tag)));
assert.equal(figsokuLog.filter((line) => line.includes("is gone (404)")).length, 3);
// Only the post of 10-27 is inside the 21 days.
assert.deepEqual(figsokuRun.records.map((record) => record.id), [illya.id]);
assert.equal(figsokuRun.records[0].status, "product_confirmed");
// Any other failure (a 403, a bot check) is not swallowed.
await assert.rejects(
  runUnofficialSource(figsokuSource, { today: TODAY, fetchText: async (url) => { throw Object.assign(new Error(`${url} returned 403`), { status: 403 }); } }),
  /returned 403/,
);
const stored = new Map(figsokuRun.records.map((record) => [record.id, record]));
const reopened = await runUnofficialSource(figsokuSource, {
  today: "2026-11-07",
  state: figsokuRun.state,
  stored,
  fetchText: async (url) => {
    if (url !== figsokuFeedUrl("fate")) throw Object.assign(new Error("404"), { status: 404 });
    const feed = fixture("figsoku-fate-feed.xml");
    const [head] = feed.split("<item>");
    const item = `<item><title>${openedPost.title}</title><link>${openedPost.link}</link><pubDate>Fri, 06 Nov 2026 03:00:00 +0000</pubDate><guid isPermaLink="false">${openedPost.guid}</guid><description><![CDATA[x]]></description></item>`;
    return `${head}${item}${feed.slice(head.length)}`;
  },
});
assert.equal(reopened.records.length, 1);
assert.equal(reopened.records[0].id, illya.id);
assert.equal(reopened.records[0].status, "preorder_open");
assert.equal(reopened.records[0].source_url, openedPost.link);
assert.equal(reopened.records[0].announced_at, "2026-10-27");
// The merge keeps the stored stage; advanceStages moves it on.
const mergedFigure = mergeAnnouncementRecords([...stored.values()], reopened.records);
assert.equal(mergedFigure[0].status, "product_confirmed");
assert.equal(advanceStages(mergedFigure, reopened.records).records[0].status, "preorder_open");

// ---------------------------------------------------------------------------
// スタッズ: LEGO news.

const legoItems = parseRssItems(fixture("stds-newsets-feed.xml"));
assert.equal(legoItems.length, 6);
// Kept: the January sets, a teaser picture. Not kept: the pinned year list, a
// fans' reaction round-up, a LEGO Ideas review result, a gift-with-purchase promo.
const lego = stdsCandidates(legoItems);
assert.deepEqual(lego.map((candidate) => `${candidate.record.id} ${candidate.date} ${candidate.record.names.ja}`), [
  "stds-75875 2026-11-12 懐かしのポスターに最大のサプライズまで、レゴ(R)スター・ウォーズ新作2027年1月1日発売",
  "stds-78316 2026-11-09 レゴ(R)スーパーマリオ ヨッシーの予告画像、Nintendo TODAY アプリで公開",
]);
assert.equal(lego[0].record.franchise, "lego");
assert.equal(lego[0].record.source_name, "スタッズ");
assert.equal(lego[0].record.source_url, "https://stds.jp/lego-starwars-january-2027-new-sets/");
assert.equal(lego[0].record.thumbnail_url, "https://stds.jp/wp-content/uploads/2026/11/lego-starwars-january-2027-new-sets_title_.webp");
assert.equal(lego[0].record.status, "product_confirmed");
assert.equal(lego[1].record.status, "announced");
const stdsRun = await runUnofficialSource(unofficialSource(STDS_SOURCE_ID), { today: TODAY, fetchText: cannedFetch({ [STDS_FEED_URL]: fixture("stds-newsets-feed.xml") }) });
assert.equal(stdsRun.records.length, 2);

// ---------------------------------------------------------------------------
// Every record says where it is from, and stays once its post has scrolled off the feed.

assert.deepEqual(UNOFFICIAL_SOURCES.map((source) => source.id), [HAMUSUKE_SOURCE_ID, HJWEB_SOURCE_ID, DENGEKI_SOURCE_ID, FIGSOKU_SOURCE_ID, STDS_SOURCE_ID]);
const everyRecord = [...hamusukeRun.records, ...hjwebRun.records, ...october.records, ...figsokuRun.records, ...stdsRun.records];
for (const record of everyRecord) {
  assert.equal(record.unofficial, true, record.id);
  assert.equal(record.source_name, unofficialSource(record.source_id).name, record.id);
  assert.ok(["announced", "product_confirmed", "preorder_open"].includes(record.status), record.id);
  // 参考展示 and 予告画像 have no reveal verb the news-title filter knows.
  assert.ok(acceptsStoredAnnouncement(record), record.id);
}
assert.equal(mergeAnnouncementRecords(everyRecord, []).length, everyRecord.length);

// ---------------------------------------------------------------------------
// Official wins: beys.

const official = ({ id, title, date, franchise = "beyblade", sourceId = "beyblade_x_lineup", sourceName = "BEYBLADE X" }) =>
  announcementRecord({ id, sourceId, franchise, title, status: "product_confirmed", announcedAt: date, sourceName, sourceUrl: `https://example.invalid/${id}` });
const BEY_SOURCES = { sourceIds: ["corocoro_news", HAMUSUKE_SOURCE_ID] };
// The two beys as hand-entered from the printed December issue (data/announcements-corocoro-print.json).
const printPosts = [{
  id: -202612,
  date: "2026-11-13",
  link: "https://corocoro-news.jp/news/403084/",
  title: "月刊コロコロコミック 2026年12月号（誌面）",
  image_url: "https://corocoro-news.jp/wp-content/uploads/2026/11/a03c32f5f6a6e4251530f13f8f51591c.jpg",
  items: [
    { name: "バニッシュルシファー WW", key: "バニッシュルシファーww", franchise: "beyblade", code: null, kind: "スターター", release: { iso: "2026-12-26", text: "2026年12月26日" }, price: 2500, fresh: true },
    { name: "ホルスシャッター3-85MO", key: "ホルスシャッター385mo", franchise: "beyblade", code: null, kind: "ランダムブースターVol.12", release: { iso: "2026-12-26", text: "2026年12月26日" }, price: 1600, fresh: true },
  ],
}];
const printRecords = coroCoroRecords(emptyCoroCoroState(), printPosts);
assert.equal(printRecords.length, 2);

// Neither is official word for the other, so the magazine step keeps both; the
// cross-source dedupe then sees one bey twice and keeps the blog post, which
// shows the product where the print record shows the magazine cover (owner's
// decision, 2026-11-13). The same goes for a scoop CoroCoro News wrote up on the web.
const beys = [...printRecords, ...hamusukeRun.records];
assert.deepEqual(dropMagazineDuplicates(beys, new Map(), BEY_SOURCES).dropped, []);
const apart = keepsApart();
const beyTwins = dedupeAnnouncements(beys, [HAMUSUKE_SOURCE_ID, "corocoro_news"], { separate: apart });
assert.deepEqual(beyTwins.records.map((record) => record.id).sort(), ["hamusuke-bx-55", "hamusuke-ux-22"]);
assert.deepEqual(
  Object.fromEntries(beyTwins.dropped.map(({ id, kept }) => [printRecords.find((record) => record.id === id).names.ja, kept])),
  { "スターター「バニッシュルシファー WW」": "hamusuke-ux-22", "ランダムブースターVol.12「ホルスシャッター3-85MO」": "hamusuke-bx-55" },
);
// The blog's picture stays a link to the blog, and the cover is not copied
// onto it (it has its own), nor ever onto a record without one.
assert.equal(beyTwins.records.find((record) => record.id === "hamusuke-ux-22").thumbnail_url, vanish.thumbnail_url);
const bare = dedupeAnnouncements([printRecords[0], { ...vanish, thumbnail_url: null }], [HAMUSUKE_SOURCE_ID, "corocoro_news"], { separate: apart });
assert.equal(bare.records[0].thumbnail_url, printRecords[0].thumbnail_url, "an official or magazine picture moves to the record that stays");
const blogFirst = dedupeAnnouncements([vanish, { ...printRecords[0], thumbnail_url: null }], ["corocoro_news", HAMUSUKE_SOURCE_ID], { separate: apart });
assert.equal(blogFirst.records[0].thumbnail_url, null, "an unofficial site's picture is never copied onto another record");

// The official lineup replaces both, by the product code: it names the starter
// with ratchet and bit, and the booster without its rare bey.
const lineup = [
  official({ id: "beyblade-lineup-ux22", title: "UX-22 バニッシュルシファーW3-60WW スターター", date: "2026-11-20" }),
  official({ id: "beyblade-lineup-bx55", title: "BX-55 ランダムブースターVol.12 ブースター", date: "2026-11-20" }),
];
const afterLineup = dropMagazineDuplicates([...beys, ...lineup], new Map(), BEY_SOURCES);
assert.deepEqual(afterLineup.dropped.map((item) => item.id).sort(), ["hamusuke-bx-55", "hamusuke-ux-22", printRecords[0].id].sort());
// (The print booster has neither code nor a name the lineup repeats; the
// catalog kit takes it over, as before.)
assert.deepEqual(afterLineup.records.map((record) => record.id).sort(), [...lineup.map((record) => record.id), printRecords[1].id].sort());
// An old lineup entry with the same code prefix is not this product, and a
// record reviewed in the CMS stays.
assert.deepEqual(dropMagazineDuplicates([vanish, { ...lineup[0], announced_at: "2026-09-01" }], new Map(), BEY_SOURCES).dropped, []);
assert.deepEqual(dropMagazineDuplicates([{ ...vanish, reviewed_at: "2026-11-14" }, lineup[0]], new Map(), BEY_SOURCES).dropped, []);
// An unofficial record is nobody's official word: the blog does not replace the magazine.
assert.deepEqual(dropMagazineDuplicates([printRecords[0], vanish]).dropped, []);
// A catalog bey released before the post is an old bey mentioned again; one still to come is linked.
const kits = new Map([["beyblade", [{ kit_id: "beyblade-x-ux22", names: { ja: "UX-22 バニッシュルシファーWW" }, release_date: "2026-12-26" }]]]);
assert.equal(dropMagazineDuplicates([vanish], kits, BEY_SOURCES).records[0].linked_kit_id, "beyblade-x-ux22");

// ---------------------------------------------------------------------------
// Official wins: media and figure posts, by the products their titles quote.

assert.deepEqual(quotedProducts(report.names.ja), [
  { key: "ガンダムデュナメス", brand: "METAL BUILD" },
  { key: "ガンダムキュリオス", brand: "METAL BUILD" }, // the brand carries over a list of quotes
  { key: "gnアームズtypekオプションセット", brand: null },
]);
// 「TAMASHII NATION 2026」 is where, not what.
assert.deepEqual(quotedProducts("「TAMASHII NATION 2026」にてROBOT魂「ドーベンウルフ」が参考展示"), [{ key: "ドーベンウルフ", brand: "ROBOT魂" }]);

const tamashii = (id, title, date) => official({ id, title, date, franchise: "gundam", sourceId: "tamashii_news", sourceName: "TAMASHII WEB" });
const dynames = tamashii("tamashii-news-2026-11-12-16259", "【機動戦士ガンダム00】「METAL BUILD ガンダムデュナメス」が魂ウェブ商店にて11/13 12時より予約受付開始！", "2026-11-12");
const kyrios = tamashii("tamashii-reveal-0abb669c96", "METAL BUILD ガンダムキュリオス", "2026-11-12");
// The show report stays: nothing official tells of the GNアームズ option set.
assert.deepEqual(dropUnofficialDuplicates([report, dynames, kyrios]).dropped, []);
// Once every product it quotes has an official record, it goes.
const gnArms = tamashii("tamashii-news-2026-11-20-16300", "【機動戦士ガンダム00】「GNアームズ TYPE-K オプションセット」がMETAL BUILDに登場！", "2026-11-20");
assert.deepEqual(dropUnofficialDuplicates([report, dynames, kyrios, gnArms]).dropped, [{ id: report.id, reason: "official", kept: dynames.id }]);
// The brand before a quote has to be in the official title too: a ROBOT魂
// キュリオス is another product. And a post from months before is other news.
const robotKyrios = tamashii("tamashii-news-2026-11-12-1", "ROBOT魂 ガンダムキュリオス", "2026-11-12");
assert.deepEqual(dropUnofficialDuplicates([report, dynames, robotKyrios, gnArms]).dropped, []);
assert.deepEqual(dropUnofficialDuplicates([report, dynames, { ...kyrios, announced_at: "2026-06-01" }, gnArms]).dropped, []);
// A kit named in 『…』 by 電撃 matches the maker's 「HG 1/144 …」.
const zero = official({ id: "bandai-news-1", title: "「HG 1/144 ガンダムZERO」10月15日より予約開始", date: "2026-10-15", franchise: "gundam", sourceId: "bandai_hobby_news", sourceName: "BANDAI SPIRITS" });
assert.deepEqual(dropUnofficialDuplicates([...october.records, zero]).dropped, [{ id: "dengeki-91010", reason: "official", kept: zero.id }]);
// A title that quotes no product is never dropped (the 《新商品A（仮）》 teaser), nor
// is a record reviewed in the CMS, nor one judged against another site's report.
assert.ok(dropUnofficialDuplicates([...october.records, zero]).records.some((record) => record.id === "dengeki-91001"));
assert.deepEqual(dropUnofficialDuplicates([{ ...october.records.find((record) => record.id === "dengeki-91010"), reviewed_at: "2026-10-16" }, zero]).dropped, []);
assert.deepEqual(dropUnofficialDuplicates([report, { ...dynames, unofficial: true }, { ...kyrios, unofficial: true }, { ...gnArms, unofficial: true }]).dropped, []);
// Another world's record does not count.
assert.deepEqual(dropUnofficialDuplicates([illya, official({ id: "x", title: "「イリヤスフィール・フォン・アインツベルン」フィギュア 予約開始", date: "2026-10-28", franchise: "gundam" })]).dropped, []);
assert.equal(dropUnofficialDuplicates([illya, official({ id: "x", title: "「イリヤスフィール・フォン・アインツベルン」フィギュア 予約開始", date: "2026-10-28", franchise: "fate", sourceId: "kotobukiya_shop", sourceName: "コトブキヤショップ" })]).dropped.length, 1);

// Official wins by the product page too. Premium Bandai's list cuts the name
// ("ポケモンスケールワールド ミア…", the record of 11-06), so only the page the
// fig速 post links can match it. The post of 11-08 tells of two sets and the
// data has the page of one: it stays until the other page has a record too.
const pbandai = (itemId, date) => ({
  ...official({ id: `pbandai-${itemId}`, title: "ポケモンスケールワールド ミア…", date, franchise: "pokemon", sourceId: "premium_bandai_new_items", sourceName: "プレミアムバンダイ" }),
  source_url: `https://p-bandai.jp/item/item-${itemId}/`,
});
const firstSet = pbandai("1000259827", "2026-11-06");
assert.deepEqual(dropUnofficialDuplicates([scaleWorld, firstSet]).dropped, []);
assert.deepEqual(dropUnofficialDuplicates([scaleWorld, firstSet, pbandai("1000259828", "2026-11-09")]).dropped, [{ id: scaleWorld.id, reason: "official", kept: firstSet.id }]);
// Not a page from months before (a resale's preorder is news of its own), not
// another unofficial record's page, and not a record reviewed in the CMS.
assert.deepEqual(dropUnofficialDuplicates([scaleWorld, firstSet, pbandai("1000259828", "2026-06-01")]).dropped, []);
assert.deepEqual(dropUnofficialDuplicates([scaleWorld, firstSet, { ...pbandai("1000259828", "2026-11-09"), unofficial: true }]).dropped, []);
assert.deepEqual(dropUnofficialDuplicates([{ ...scaleWorld, reviewed_at: "2026-11-09" }, firstSet, pbandai("1000259828", "2026-11-09")]).dropped, []);
// The links survive the merge with the stored record, like the rest of the post.
assert.deepEqual(mergeAnnouncementRecords([{ ...scaleWorld, official_urls: undefined }], [scaleWorld])[0].official_urls, scaleWorld.official_urls);
// An unofficial site's picture stays a link to the site (the fetcher does not
// cache it), and a copy cached before that rule gives way to the feed's link
// on the next read; an official record keeps its cached copy.
assert.equal(thumbnailStaysRemote(vanish), true);
assert.equal(thumbnailStaysRemote(dynames), false);
assert.equal(mergeAnnouncementRecords([{ ...vanish, thumbnail_url: "../app/assets/announcements/hamusuke-ux-22.jpg" }], [vanish])[0].thumbnail_url, vanish.thumbnail_url);
assert.equal(
  mergeAnnouncementRecords([{ ...dynames, thumbnail_url: "../app/assets/announcements/x.webp" }], [{ ...dynames, thumbnail_url: "https://tamashiiweb.com/x.webp" }])[0].thumbnail_url,
  "../app/assets/announcements/x.webp",
);

// In the cross-source dedupe an official and an unofficial record are never
// twins (the rules above settled them: sharing one of several quoted names is
// not enough), while two sites reporting one product still are.
const priority = ["tamashii_news", HJWEB_SOURCE_ID, DENGEKI_SOURCE_ID];
const dynamesQuoted = { ...dynames, names: { ...dynames.names, ja: "「ガンダムデュナメス」がMETAL BUILDに登場！" } };
assert.deepEqual(dedupeAnnouncements([report, dynamesQuoted], priority, { separate: apart }).dropped, []);
assert.equal(dedupeAnnouncements([report, dynamesQuoted], priority).dropped.length, 1);
const dengekiReport = { ...report, id: "dengeki-99999", source_id: DENGEKI_SOURCE_ID, source_name: "電撃オンライン", source_url: "https://dengekionline.com/article/202611/99999" };
assert.deepEqual(dedupeAnnouncements([dengekiReport, report], priority, { separate: apart }).dropped, [{ id: "dengeki-99999", kept: report.id }]);

console.log("unofficial feeds: ok");
