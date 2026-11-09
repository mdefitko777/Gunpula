import assert from "node:assert/strict";
import { applyStoredDates, PAGES, pageFor, parseJapaneseDate, robotsPattern } from "./backfill_release_dates.mjs";

assert.equal(parseJapaneseDate("2026年7月3日(金)より順次お届け"), "2026-07-03");
assert.equal(parseJapaneseDate("2021年2月下旬以降より順次お届け予定"), "2021-02");
assert.equal(parseJapaneseDate(" 2014年04月下旬 "), "2014-04");
assert.equal(parseJapaneseDate("近日発売"), null);
assert.equal(parseJapaneseDate(undefined), null);

const aniplex = PAGES.find((p) => p.host === "online.aniplex.co.jp");
assert.equal(
  aniplex.date('<div class="salesStartDate">\n  <p class="salesStartDate__txt">2021年2月下旬以降より順次お届け予定</p>'),
  "2021年2月下旬以降より順次お届け予定",
);
const gashapon = PAGES.find((p) => p.host === "gashapon.jp");
assert.equal(
  gashapon.date('<dd class="pg-detailDefinition__detail --releaseDate">\n      2014年04月下旬      </dd>'),
  "2014年04月下旬",
);

assert.equal(
  gashapon.date('<dd class="pg-detailDefinition__detail --releaseDate">\n   2021年11月 第5週 <br />\n </dd>'),
  "2021年11月 第5週",
);
assert.equal(parseJapaneseDate("2021年11月 第5週"), "2021-11");

// robots.txt: Aniplex+ has "Disallow: /*reminder*" — a wildcard, not "everything under /"
assert.equal(robotsPattern("/*reminder*").test("/itemDcBbdEvv.html"), false);
assert.equal(robotsPattern("/*reminder*").test("/mypage/reminder-list"), true);
assert.equal(robotsPattern("/member/*").test("/member/login"), true);
assert.equal(robotsPattern("/cart").test("/cart?x=1"), true);
assert.equal(robotsPattern("/a.html$").test("/a.html?x"), false);

assert.equal(pageFor({ source_urls: ["https://online.aniplex.co.jp/itemDcBbdEvv.html"] }).page, aniplex);
assert.equal(
  pageFor({ source_urls: ["https://gashapon.jp/products/result.php?free=x", "https://gashapon.jp/products/detail.php?jan_code=4543112850942000"] }).url,
  "https://gashapon.jp/products/detail.php?jan_code=4543112850942000",
);
assert.equal(pageFor({ source_urls: ["https://www.goodsmile.com/en/product/102"] }), null);

const kits = [{ kit_id: "a", release_date: null }, { kit_id: "b", release_date: "2020-01" }, { kit_id: "c" }];
const store = { dates: { a: { date: "2021-02" }, b: { date: "1999-01" } } };
assert.equal(applyStoredDates(kits, store), 1);
assert.deepEqual(kits.map((k) => k.release_date), ["2021-02", "2020-01", undefined], "a source date is never overwritten");

console.log("release dates: ok");
