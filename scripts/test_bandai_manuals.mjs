import assert from "node:assert/strict";
import { matchManuals, nameKey, parseManualList } from "./import_bandai_manuals.mjs";

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

console.log("bandai manuals: ok");
