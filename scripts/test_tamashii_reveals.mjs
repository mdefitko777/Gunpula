// 魂ウェブ 商品化決定 banners → one announcement per revealed product. The fixture
// is the key-visual slider of tamashiiweb.com/item_character/gundam_series/ as
// read on 2026-11-12 (4 of its 20 slides kept): two item slides, the
// METAL BUILD ガンダムキュリオス reveal and a "RENEWAL版が登場" banner.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsStoredAnnouncement, mergeAnnouncementRecords, parseTamashiiNews } from "./lib/bandai-announcements.mjs";
import {
  TAMASHII_REVEALS_SOURCE_ID,
  createHostStops,
  dedupeAnnouncements,
  linkRevealKits,
  parseTamashiiRevealBanners,
  promoteRevealStages,
  revealProductNames,
} from "./lib/official-announcements.mjs";

const PAGE_URL = "https://tamashiiweb.com/item_character/gundam_series/";
const html = readFileSync(new URL("./fixtures/tamashii-gundam-series-kv.html", import.meta.url), "utf8");

// Only the reveal slide becomes a record, named "<brand> <product>".
const parsed = parseTamashiiRevealBanners(html, { pageUrl: PAGE_URL, franchise: "gundam", today: "2026-11-12" });
assert.equal(parsed.slides, 4);
assert.equal(parsed.records.length, 1);
const [kyrios] = parsed.records;
assert.equal(kyrios.names.ja, "METAL BUILD ガンダムキュリオス");
assert.equal(kyrios.status, "product_confirmed");
assert.equal(kyrios.franchise, "gundam");
assert.equal(kyrios.source_id, TAMASHII_REVEALS_SOURCE_ID);
assert.equal(kyrios.source_name, "TAMASHII WEB");
assert.equal(kyrios.source_url, PAGE_URL);
assert.equal(kyrios.announced_at, "2026-11-12");
assert.equal(kyrios.announced_at_basis, "first_seen");
assert.equal(kyrios.confidence, "official");
assert.equal(kyrios.thumbnail_url, "https://tamashiiweb.com/storage/images/kvbanners/sp/38049bb8-2650-4801-954c-fc67bf7a7f09.webp");
assert.match(kyrios.id, /^tamashii-reveal-[0-9a-f]{10}$/);
assert.match(kyrios.notes, /「ガンダムキュリオス」がMETAL BUILDより商品化決定/);

// The id comes from the name, so the banner seen again tomorrow (or on the
// METAL BUILD brand page) is the same record, and keeps its first-seen date.
const tomorrow = parseTamashiiRevealBanners(html, { pageUrl: "https://tamashiiweb.com/item_brand/metal_build/", franchise: "gundam", today: "2026-11-13" });
assert.equal(tomorrow.records[0].id, kyrios.id);
assert.equal(mergeAnnouncementRecords([kyrios], tomorrow.records)[0].announced_at, "2026-11-12");

// Gone from the slider (its preorder opened), the stored record stays: its
// title has no reveal verb, so the news-title filter must not judge it.
assert.ok(acceptsStoredAnnouncement(kyrios));
assert.equal(mergeAnnouncementRecords([kyrios], []).length, 1);

// A page without the slider (markup change, bot check) is told apart from a quiet day.
assert.deepEqual(parseTamashiiRevealBanners("<html><body>Access denied</body></html>", { pageUrl: PAGE_URL, franchise: "gundam", today: "2026-11-12" }), { records: [], slides: 0 });

// Banner wordings.
assert.deepEqual(revealProductNames("【機動戦士ガンダム00】「ガンダムキュリオス」がMETAL BUILDより商品化決定！"), ["METAL BUILD ガンダムキュリオス"]);
assert.deepEqual(revealProductNames("METAL BUILD ガンダムデュナメス 商品化決定"), ["METAL BUILD ガンダムデュナメス"]);
assert.deepEqual(revealProductNames("METAL BUILD「ガンダムキュリオス」商品化決定！"), ["METAL BUILD ガンダムキュリオス"]);
assert.deepEqual(revealProductNames("「METAL ROBOT魂 ＜SIDE MS＞ Ξガンダム」商品化決定!!"), ["METAL ROBOT魂 ＜SIDE MS＞ Ξガンダム"]);
assert.deepEqual(
  revealProductNames("【機動戦士ガンダム00】「ガンダムキュリオス」「ガンダムヴァーチェ」がMETAL BUILDより商品化が決定！"),
  ["METAL BUILD ガンダムキュリオス", "METAL BUILD ガンダムヴァーチェ"],
);
assert.deepEqual(revealProductNames("【GUNDAM UNIVERSE】「シャア専用ザクⅡ」のRENEWAL版が登場！"), []);
assert.deepEqual(revealProductNames("「シャイニングガンダム マーシャルアクション」がROBOT魂に登場！一般店頭にて11/12より予約受付開始！"), []);
// Where it was revealed is neither a product nor a brand; a round-up names nothing.
assert.deepEqual(revealProductNames("「TAMASHII NATION 2026」にて「νガンダム」がMETAL BUILDより商品化決定！"), ["METAL BUILD νガンダム"]);
assert.deepEqual(revealProductNames("TAMASHII NATION 2026にて「νガンダム」商品化決定！"), ["νガンダム"]);
assert.deepEqual(revealProductNames("「νガンダム」がTNNにて商品化決定！"), ["νガンダム"]);
assert.deepEqual(revealProductNames("METAL BUILDの「ガンダムキュリオス」商品化決定"), ["METAL BUILD ガンダムキュリオス"]);
assert.deepEqual(revealProductNames("【機動戦士ガンダム】ガンダムシリーズ新商品の商品化決定！"), []);

// The preorder post for the same product moves the reveal to preorder_open
// (the real 魂ウェブ topic markup, with Kyrios in place of Dynames). The
// merge keeps the stored status, so the move sticks.
const topicHtml = `<li class="topicList__item"><a href="/item/16300/"><img src="/x.webp"><time datetime="2026-12-10">2026年12月10日</time><h3 class="itemList__title">【機動戦士ガンダム00】「METAL BUILD ガンダムキュリオス」が魂ウェブ商店にて12/11 12時より予約受付開始！</h3></a></li>`;
const preorder = parseTamashiiNews(topicHtml, "https://tamashiiweb.com/topics/");
assert.equal(preorder[0].status, "preorder_open");
const promoted = promoteRevealStages([kyrios, ...preorder]);
assert.deepEqual(promoted.promoted, [{ id: kyrios.id, from: "product_confirmed", to: "preorder_open" }]);
assert.equal(promoted.records.find((record) => record.id === kyrios.id).status, "preorder_open");
assert.equal(mergeAnnouncementRecords(promoted.records, [kyrios]).find((record) => record.id === kyrios.id).status, "preorder_open");

// The brand may sit outside the quote: "「ガンダムキュリオス」がMETAL BUILDに登場！…予約受付開始！".
const split = { ...preorder[0], id: "tamashii-news-2026-12-10-16301", names: { ja: "【機動戦士ガンダム00】「ガンダムキュリオス」がMETAL BUILDに登場！一般店頭にて12/10より予約受付開始！" } };
assert.equal(promoteRevealStages([kyrios, split]).records[0].status, "preorder_open");

// Not moved by: another brand's Kyrios, an option set for it, a post from
// before the reveal, or a reviewed record.
const other = (ja, extra = {}) => ({ ...preorder[0], id: `x-${ja}`, names: { ja }, ...extra });
for (const record of [
  other("「ROBOT魂 ＜SIDE MS＞ ガンダムキュリオス」が登場！予約受付開始！"),
  other("「METAL BUILD ガンダムキュリオス オプションセット」予約受付開始！"),
  other("「METAL BUILD ガンダムキュリオス」予約受付開始！", { announced_at: "2026-10-01" }),
]) assert.equal(promoteRevealStages([kyrios, record]).promoted.length, 0, record.names.ja);
assert.equal(promoteRevealStages([{ ...kyrios, reviewed_at: "2026-11-12" }, ...preorder]).promoted.length, 0);

// Linked to the catalog kit once the catalog has it (魂ウェブ kits: brand in
// subline, bare name in names.ja); a released kit of the same name is not it.
const kits = new Map([["gundam", [
  { kit_id: "tamashii-9000", subline: "METAL BUILD", names: { ja: "ガンダムキュリオス" }, release_date: "2012-03" },
  { kit_id: "tamashii-16300", subline: "METAL BUILD", names: { ja: "ガンダムキュリオス" }, release_date: "2027-05" },
]]]);
assert.equal(linkRevealKits([kyrios], kits)[0].linked_kit_id, "tamashii-16300");
assert.equal(linkRevealKits([kyrios], new Map([["gundam", kits.get("gundam").slice(0, 1)]]))[0].linked_kit_id, null);

// Two reveals share the banner's link (the work page); both survive the dedupe.
const virtue = parseTamashiiRevealBanners(
  html.replace("「ガンダムキュリオス」", "「ガンダムヴァーチェ」"),
  { pageUrl: PAGE_URL, franchise: "gundam", today: "2026-11-12" },
).records[0];
assert.equal(dedupeAnnouncements([kyrios, virtue], [TAMASHII_REVEALS_SOURCE_ID]).records.length, 2);

// A reveal banner that links an item page its topic post also links is that
// post again: the topic post stays, the banner copy goes, though both say TAMASHII WEB.
const itemReveal = { ...kyrios, id: "tamashii-reveal-item", source_url: "https://tamashiiweb.com/item/16300/" };
const itemTopic = { ...preorder[0], source_id: "tamashii_news", announced_at: "2026-11-14" };
const deduped = dedupeAnnouncements([itemReveal, itemTopic], ["tamashii_news", TAMASHII_REVEALS_SOURCE_ID]);
assert.deepEqual(deduped.records.map((record) => record.id), [itemTopic.id]);
assert.deepEqual(deduped.dropped, [{ id: itemReveal.id, kept: itemTopic.id }]);

// The fetcher's stop list: a host that answered 403/429/503 gets nothing more this run.
const stops = createHostStops();
stops.record("https://tamashiiweb.com/topics/", 404);
assert.doesNotThrow(() => stops.check("https://tamashiiweb.com/item_character/gundam_series/"));
stops.record("https://tamashiiweb.com/topics/", 429);
assert.throws(() => stops.check("https://tamashiiweb.com/item_character/gundam_series/"), /tamashiiweb\.com answered 429/);
assert.doesNotThrow(() => stops.check("https://gundam-official.com/news"));

console.log("tamashii reveal tests passed");
