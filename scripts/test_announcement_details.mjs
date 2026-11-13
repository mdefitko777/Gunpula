// The product text behind announcements (lib/announcement-details.mjs →
// data/announcement-details.json). Fixtures are 魂ウェブ item pages and a
// コトブキヤショップ goods page read on 2026-11-13, trimmed to the product part.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DETAIL_PAGES_PER_HOST,
  EXTRACTOR_VERSION,
  detailSource,
  hasDetailContent,
  kotobukiyaDetailsFromHtml,
  mergeDetails,
  parseTamashiiItemDetails,
  planDetailFetches,
} from "./lib/announcement-details.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const TODAY = "2026-11-14";

// --- METAL BUILD ガンダムキュリオス: a 魂ウェブ商店 item, shipped in a month.
const kyrios = parseTamashiiItemDetails(fixture("tamashii-item-16258.html"), "https://tamashiiweb.com/item/16258/").entry;
assert.equal(kyrios.price_jpy, 38500);
assert.equal(kyrios.price_text, "¥38,500（税込 / 送料・手数料別）");
assert.equal(kyrios.sale_period_from, "2026-11-13");
assert.equal(kyrios.sale_period_to, null);
assert.equal(kyrios.sale_period_text, "2026年11月13日～");
assert.equal(kyrios.release_kind, "ship");
assert.equal(kyrios.release_month, "2027-06");
assert.equal(kyrios.release_text, "2027年6月発送予定");
assert.deepEqual(kyrios.spec, [
  { label: "商品サイズ", value: "全高：約190mm" },
  { label: "商品素材", value: "ABS、ダイキャスト、PVC製" },
]);
assert.equal(kyrios.contents.length, 12);
assert.equal(kyrios.contents[0], "本体");
assert.equal(kyrios.contents.at(-1), "専用台座一式");
assert.match(kyrios.lead, /^メカデザイナー柳瀬敬之氏監修の下/);
assert.equal(kyrios.description.length, 1);
assert.ok(kyrios.description.join("").includes("「GNアームズTYPE-K」（2026年12月予約開始予定）"));
assert.equal(kyrios.sale_channel, "魂ウェブ商店販売商品");
assert.ok(kyrios.gallery.length > 0 && kyrios.gallery.length <= 12);
assert.ok(kyrios.gallery.every((url) => url.startsWith("https://tamashiiweb.com/storage/images/products/")));
// The LP banners (web1 272 KB, web2 2.3 MB) are left out.
assert.ok(!kyrios.gallery.some((url) => url.includes("/assets/item/")));
assert.equal(kyrios.store_url, "https://p-bandai.jp/item/item-1000258243/");
assert.deepEqual(kyrios.notes, ["※本商品の対象年齢は15才以上です。"]);
// The page gives days only: the 18時 is in the post title, never made up here.
assert.ok(!JSON.stringify(kyrios).includes("18:00"));

// デュナメス: a one-day window.
const dynames = parseTamashiiItemDetails(fixture("tamashii-item-16259.html"), "https://tamashiiweb.com/item/16259/").entry;
assert.equal(dynames.sale_period_from, "2026-11-13");
assert.equal(dynames.sale_period_to, "2026-11-13");
assert.equal(dynames.release_month, "2027-01");
assert.equal(dynames.price_jpy, 33000);
assert.ok(dynames.spec.some((row) => row.value === "全高：約180mm"));

// シャイニングガンダム: a store item, 発売月 and メーカー希望小売価格, no store link.
const shining = parseTamashiiItemDetails(fixture("tamashii-item-16187.html"), "https://tamashiiweb.com/item/16187/").entry;
assert.equal(shining.release_kind, "release");
assert.equal(shining.release_month, "2027-05");
assert.equal(shining.release_text, "2027年5月発売予定");
assert.equal(shining.price_jpy, 7700);
assert.equal(shining.sale_channel, "一般店頭販売商品");
assert.equal(shining.store_url, null);
assert.equal(shining.contents[0], "本体");

// A page without the product block is an error, and a bot check stops the host.
assert.deepEqual(parseTamashiiItemDetails("<html><title>メンテナンス中 | 魂ウェブ</title></html>", "https://tamashiiweb.com/item/1/"), { error: "no product block", challenge: false });
assert.equal(parseTamashiiItemDetails("<html><title></title><script src=\"/_bm/bm-verify.js\"></script></html>", "https://tamashiiweb.com/item/1/").challenge, true);

// --- コトブキヤショップ: description and the 商品仕様 rows.
const solomon = kotobukiyaDetailsFromHtml(fixture("kotobukiya-goods-4580787175222.html"), "https://shop.kotobukiya.co.jp/shop/g/g4580787175222/").entry;
assert.ok(solomon.description.join("\n").includes("魔術王ソロモン"));
assert.ok(solomon.spec.some((row) => row.label === "スケール" && row.value === "1/7"));
assert.ok(solomon.spec.some((row) => row.label === "サイズ" && row.value.startsWith("約 H334")));
assert.ok(!solomon.spec.some((row) => row.label === "価格帯" || row.label === "カテゴリ"));
assert.equal(solomon.price_jpy, 38500);
assert.equal(solomon.release_kind, "release");
assert.equal(solomon.release_month, "2026-11");
assert.equal(solomon.gallery[0], "https://shop.kotobukiya.co.jp/img/goods/L/4580787175222_FGO_Solomon_01.jpg");
assert.equal(kotobukiyaDetailsFromHtml("<html>Access Denied</html>", "https://shop.kotobukiya.co.jp/shop/g/g1/").challenge, true);

// --- Which records, and how many pages a run.
const record = (id, sourceUrl, announcedAt = "2026-11-13", extra = {}) => ({ id, source_url: sourceUrl, announced_at: announcedAt, confidence: "official", ...extra });
assert.equal(detailSource(record("a", "https://tamashiiweb.com/item/16258/")), "tamashii");
assert.equal(detailSource(record("b", "https://shop.kotobukiya.co.jp/shop/g/g4580787175222/")), "kotobukiya");
assert.equal(detailSource(record("c", "https://p-bandai.jp/item/item-1000258243/")), null); // a JavaScript challenge, never read
assert.equal(detailSource(record("d", "https://tamashiiweb.com/item_character/gundam_series/")), null);
assert.equal(detailSource(record("e", "https://tamashiiweb.com/item/16258/", "2026-11-13", { unofficial: true, confidence: "unofficial" })), null);

const many = Array.from({ length: 9 }, (_, index) => record(`t${index}`, `https://tamashiiweb.com/item/${16200 + index}/`, `2026-11-${String(index + 1).padStart(2, "0")}`));
const fresh = { page_url: "https://tamashiiweb.com/item/9/", fetched_at: "2026-10-20", extractor_version: EXTRACTOR_VERSION, release_month: "2027-06", price_jpy: 1 };
const records = [
  ...many,
  record("k1", "https://shop.kotobukiya.co.jp/shop/g/g1/"),
  record("k2", "https://shop.kotobukiya.co.jp/shop/g/g2/"),
  record("refresh", "https://tamashiiweb.com/item/9/", "2026-10-01"),
  record("shipped", "https://tamashiiweb.com/item/8/", "2026-10-01"),
  record("waiting", "https://tamashiiweb.com/item/7/"),
];
const previous = {
  refresh: fresh,
  shipped: { ...fresh, page_url: "https://tamashiiweb.com/item/8/", release_month: "2026-10" },
  waiting: { page_url: "https://tamashiiweb.com/item/7/", fetched_at: "2026-11-10", extractor_version: EXTRACTOR_VERSION, error: "HTTP 500", retry_after: "2026-11-17" },
};
const plan = planDetailFetches(records, previous, TODAY, { preloaded: new Set(["k2"]) });
const tamashiiPlan = plan.filter((item) => item.host === "tamashiiweb.com");
assert.equal(tamashiiPlan.length, DETAIL_PAGES_PER_HOST);
// New pages first, newest record first; the refresh waits for a quieter run.
assert.deepEqual(tamashiiPlan.map((item) => item.id), ["t8", "t7", "t6", "t5", "t4", "t3"]);
// A page the run already has costs nothing.
assert.deepEqual(plan.filter((item) => item.source === "kotobukiya").map((item) => item.id), ["k1", "k2"]);
const quiet = planDetailFetches([records.find((item) => item.id === "refresh"), records.find((item) => item.id === "shipped"), records.at(-1)], previous, TODAY);
assert.deepEqual(quiet.map((item) => [item.id, item.reason]), [["refresh", "refresh"]]); // shipped: no; waiting: not before retry_after
assert.deepEqual(planDetailFetches([records.at(-1)], previous, "2026-11-17").map((item) => item.reason), ["retry"]);
// Older than 90 days: no more refreshes.
assert.deepEqual(planDetailFetches([{ ...records.find((item) => item.id === "refresh"), announced_at: "2026-08-01" }], previous, TODAY), []);

// --- The file: pruned to today's records; a failed refresh keeps the text.
const results = new Map([
  ["tamashii-news-2026-11-13-16258", { url: "https://tamashiiweb.com/item/16258/", entry: kyrios }],
  ["refresh", { url: "https://tamashiiweb.com/item/9/", error: "HTTP 500" }],
  ["gone", { url: "https://tamashiiweb.com/item/6/", error: "gone", gone: true }],
]);
const next = mergeDetails({ ...previous, orphan: fresh }, results, new Set(["tamashii-news-2026-11-13-16258", "refresh", "gone", "waiting"]), TODAY);
assert.deepEqual(Object.keys(next), ["gone", "refresh", "tamashii-news-2026-11-13-16258", "waiting"]);
const written = next["tamashii-news-2026-11-13-16258"];
assert.equal(written.page_url, "https://tamashiiweb.com/item/16258/");
assert.equal(written.fetched_at, TODAY);
assert.equal(written.extractor_version, EXTRACTOR_VERSION);
assert.equal(written.lang, "ja");
assert.equal(written.error, null);
assert.equal(written.price_jpy, 38500);
assert.deepEqual(next.refresh, { ...fresh, error: "HTTP 500", retry_after: "2026-11-21" });
assert.equal(hasDetailContent(next.refresh), true);
assert.deepEqual(next.gone, { page_url: "https://tamashiiweb.com/item/6/", fetched_at: TODAY, extractor_version: EXTRACTOR_VERSION, error: "gone", retry_after: "2026-12-14" });
assert.equal(hasDetailContent(next.gone), false);
assert.deepEqual(next.waiting, previous.waiting);
// Details never carry the announcement's own fields.
assert.ok(!/"preorder_|"unofficial"/.test(JSON.stringify(next)));

console.log("announcement details: ok");
