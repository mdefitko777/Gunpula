import assert from "node:assert/strict";
import { fetchList, matchManuals, nameKey, parseManualList } from "./import_bandai_manuals.mjs";

const html = `
<div class="bl_result_item"> <a href="/menus/detail/5019"> <div class="bl_result_img"> <img src="https://bandai-hobby.net/images/2825388.jpg"> </div>
<div class="bl_result_detail"> <div class="bl_result_icon"> <img src="/images/categories/1.jpeg" > </div>
<div class="bl_result_name"> HG Newクルルロボ <span class="bl_result_name_en">HG New KULULU ROBO</span> </div>
<dl class="bl_result_caption"> <dt>発売日</dt> <dd>2026年10月31日発売</dd> </dl> </div> </a> </div>
<div class="bl_result_item"> <a href="/menus/detail/2234"> <div class="bl_result_name"> ＭＧ 1/100 アナベル・ガトー専用ザクＩＩ Ｖｅｒ．２．０ </div>
<dl class="bl_result_caption"> <dt>発売日</dt> <dd>2013年8月発売</dd> </dl> </a> </div>`;
const list = parseManualList(html);
assert.deepEqual(list[0], { id: 5019, name: "HG Newクルルロボ", name_en: "HG New KULULU ROBO", date: "2026-10-31", code: "2825388", category: "1" });
assert.equal(list[1].date, "2013-08");
assert.equal(list[1].name_en, null);

assert.equal(nameKey("ＭＧ 1/100 アナベル・ガトー専用ザクＩＩ Ｖｅｒ．２．０"), nameKey("MG 1 / 100 アナベル・ガトー専用ザクII Ver.2.0"));

const manuals = [
  { id: 1, name: "HG 1/144 レジェンドガンダム", date: "2005-10" },
  { id: 2, name: "HG 1/144 レジェンドガンダム", date: "2026-01-31" },
  { id: 3, name: "MG 1/100 アナベル・ガトー専用ザクII Ver.2.0", date: "2013-08" },
];
const kits = [
  { kit_id: "old", names: { ja: "HG 1 / 144 レジェンドガンダム" }, release_date: "2005-10-21" },
  { kit_id: "new", names: { ja: "HG 1 / 144 レジェンドガンダム" }, release_date: "2026-01-31" },
  { kit_id: "gato", names: { ja: "MG 1/100 アナベル・ガトー専用ザクII Ver.2.0" }, release_date: "2013-08" },
  { kit_id: "none", names: { ja: "HG 1/144 ガンダムエアリアル" }, release_date: "2022-10" },
];
const m = matchManuals(kits, manuals);
assert.equal(m.get("old"), 1, "the release month picks the manual of the same-named kit");
assert.equal(m.get("new"), 2);
assert.equal(m.get("gato"), 3);
assert.equal(m.has("none"), false, "no manual, no button");

// colour variants use the base kit's manual
const v = matchManuals(
  [
    { kit_id: "clear", names: { ja: "HG 1 / 144 デスティニーガンダム [クリアカラー]" }, release_date: "2019-07" },
    { kit_id: "gold", names: { ja: "HG 1 / 144 ユニコーンガンダム3号機 フェネクス(ユニコーンモード) ゴールドコーティングVer." } },
    { kit_id: "base-limited", names: { ja: "HG 1/144 ガンダムベース限定 シャア専用ザクII [メタリック]" } },
  ],
  [
    { id: 10, name: "HGCE 1/144 デスティニーガンダム", date: "2018-10" },
    { id: 11, name: "HG 1/144 デスティニーガンダム", date: "2004-12" },
    { id: 12, name: "HG 1/144 ユニコーンガンダム3号機 フェネクス(ユニコーンモード)", date: "2015-07" },
    { id: 13, name: "HG 1/144 シャア専用ザクII", date: "2007-01" },
    { id: 14, name: "HG 1/144 シャア専用ザクII [クリアカラー]", date: "2019-01" },
  ],
);
assert.equal(v.get("clear"), 11);
assert.equal(v.get("gold"), 12);
assert.equal(v.get("base-limited"), 13, "a plain manual, not another variant's");

// List read (no network: a fake fetch serves robots.txt and the list pages, newest first)
const listPage = (ids) => ids.map((id) => `<a href="/menus/detail/${id}"><div class="bl_result_name">HG manual ${id}</div></a>`).join("\n");
const site = ({ pages, robots = { status: 404 }, fail = {} }) => {
  const asked = [];
  const fetchImpl = async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === "/robots.txt") {
      if (robots.throws) throw new TypeError("fetch failed");
      return new Response(robots.body || "", { status: robots.status });
    }
    const page = Number(searchParams.get("page"));
    asked.push(page);
    if (fail[page] === "throw") throw new TypeError("fetch failed");
    if (fail[page]) return new Response("", { status: fail[page] });
    if (page > pages.length) return new Response(null, { status: 302, headers: { location: "/" } });
    return new Response(listPage(pages[page - 1]), { status: 200 });
  };
  return { fetchImpl, asked, gapMs: 0 };
};
const stored = (ids, readAt) => ({ read_at: readAt, manuals: ids.map((id) => ({ id, name: `HG manual ${id}` })) });
const ids = (result) => [...result.manuals.keys()].sort((a, b) => b - a);

// first read (no read_at): every page, up to the redirect past the last one
let s = site({ pages: [[6, 5], [4, 3], [2, 1]] });
let r = await fetchList(stored([2, 1]), s);
assert.deepEqual([r.pages, r.complete, s.asked], [3, true, [1, 2, 3, 4]]);
assert.deepEqual(ids(r), [6, 5, 4, 3, 2, 1]);

// weekly read after a complete one: stops at the first page that is all known
s = site({ pages: [[8, 7], [6, 5], [4, 3], [2, 1]] });
r = await fetchList(stored([6, 5, 4, 3, 2, 1], "2026-11-03"), s);
assert.deepEqual([r.pages, r.complete, s.asked], [2, true, [1, 2]], "page 2 is all known");
assert.deepEqual(ids(r), [8, 7, 6, 5, 4, 3, 2, 1]);
s = site({ pages: [[8, 7], [6, 5], [4, 3], [2, 1]] });
r = await fetchList(stored([6, 5, 4, 3, 2, 1], "2026-11-03"), { ...s, full: true });
assert.deepEqual(s.asked, [1, 2, 3, 4, 5], "--full reads every page");

// a failed request keeps the pages read before it
s = site({ pages: [[6, 5], [4, 3], [2, 1]], fail: { 2: "throw" } });
r = await fetchList(stored([]), s);
assert.deepEqual([r.pages, r.complete, ids(r)], [1, false, [6, 5]]);
s = site({ pages: [[6, 5], [4, 3], [2, 1]], fail: { 3: 500 } });
r = await fetchList(stored([1]), s);
assert.deepEqual([r.pages, r.complete, ids(r)], [2, false, [6, 5, 4, 3, 1]], "a 500 is not the end of the list");
s = site({ pages: [[6, 5], [4, 3]], fail: { 2: 429 } });
r = await fetchList(stored([]), s);
assert.deepEqual([r.pages, r.complete], [1, false]);

// two days: day 1 stops at page 2 (ids 10, 9 added = pending), day 2 must not stop at them
// but read on to the frontier of the last complete read (4 … 1)
s = site({ pages: [[10, 9], [8, 7], [6, 5], [4, 3], [2, 1]], fail: { 2: "throw" } });
r = await fetchList(stored([4, 3, 2, 1], "2026-11-03"), s);
assert.deepEqual([r.pages, r.complete, ids(r)], [1, false, [10, 9, 4, 3, 2, 1]]);
const day2 = { ...stored([10, 9, 4, 3, 2, 1], "2026-11-03"), pending_ids: [10, 9] };
s = site({ pages: [[12, 11], [10, 9], [8, 7], [6, 5], [4, 3], [2, 1]] });
r = await fetchList(day2, s);
assert.deepEqual([r.complete, s.asked, ids(r)], [true, [1, 2, 3, 4, 5], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]], "pending ids are not known");

// a time limit keeps what was read
s = site({ pages: [[6, 5], [4, 3]] });
r = await fetchList(stored([]), { ...s, deadlineMs: -1 });
assert.deepEqual([r.pages, r.complete], [0, false]);

// robots.txt: unreachable or 5xx = nothing read; a rule on the list pages = nothing read
for (const robots of [{ throws: true }, { status: 503 }, { status: 200, body: "User-agent: *\nDisallow: /*?page=\n" }]) {
  s = site({ pages: [[6, 5]], robots });
  r = await fetchList(stored([1], "2026-11-03"), s);
  assert.deepEqual([r.pages, r.complete, s.asked, ids(r)], [0, false, [], [1]], JSON.stringify(robots));
}
s = site({ pages: [[6, 5]], robots: { status: 200, body: "User-agent: *\nDisallow: /menus/pdf\n" } });
r = await fetchList(stored([]), s);
assert.deepEqual([r.pages, r.complete], [1, true], "rules for other paths do not stop the list");

console.log("bandai manuals: ok");
