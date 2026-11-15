// Gashapon records that repeat a product the catalog lists figure by figure (2026-11-15):
// line cards of the product search, box-set figures and EX single figures fold into the
// figure records; the Gashapon Senshi f importer gives an EX set the photos of its figures.
import assert from "node:assert/strict";
import { collapseForteEntries } from "./import_bandai_collectibles.mjs";
import { carryCleanupFields, gashaponDuplicates, gashaponSetParts, gashaponVolumeKey } from "./lib/catalog-cleanup.mjs";

const F = "機動戦士ガンダム ガシャポン戦士f";
const figure = (kitId, subline, name, photo, extra = {}) => ({
  kit_id: kitId,
  grade_code: "GSF",
  subline,
  names: { ja: `${subline} ${name}` },
  images: { box_art_url: `https://gashapon.jp/forte/images/items/${photo}` },
  ...extra,
});
const card = (kitId, name, grade = "GSF") => ({ kit_id: kitId, grade_code: grade, subline: "Gundam Gashapon Merchandise", names: { ja: name }, images: {} });

// ---------------------------------------------------------------- keys
assert.equal(gashaponVolumeKey("機動戦士ガンダム ガシャポン戦士フォルテ09"), "09");
assert.equal(gashaponVolumeKey(`${F} 09`), "09");
assert.equal(gashaponVolumeKey("機動戦士ガンダム ガシャポン戦士フォルテ1.5"), "1.5");
assert.equal(gashaponVolumeKey("機動戦士ガンダム MOBILE SUIT ENSEMBLE～Ver. FUKUOKA～"), "fukuoka");
assert.deepEqual(gashaponSetParts("将頑駄無&ハリマオ"), ["将頑駄無", "ハリマオ"]);
assert.deepEqual(gashaponSetParts("フルアーマー騎士ガンダム＆モンスターブラックドラゴン"), ["フルアーマー騎士ガンダム", "モンスターブラックドラゴン"]);
assert.deepEqual(gashaponSetParts("ペーネロペー"), []);

// ---------------------------------------------------------------- folds
const kits = [
  figure("gsf-gallery-f16-1-item", `${F} 16`, "ガンダム・エアリアル", "16/img_101.jpg"),
  figure("gsf-gallery-f16-2-item", `${F} 16`, "ダリルバルデ", "16/img_102.jpg"),
  figure("gsf-gallery-f16-10-item", `${F} 16`, "ミカエリス", "16/img_110.jpg"),
  figure("gsf-gallery-f16pb-1-item", `${F} 16 10個入セット`, "ガンダム・エアリアル", "16_pb/img_101.jpg"),
  // The box-set page named F102 before it was shown; the photo number still matches.
  figure("gsf-gallery-f16pb-2-item", `${F} 16 10個入セット`, "？？？", "16_pb/img_102.jpg?ver2"),
  figure("gsf-gallery-1-hi", `${F} 01`, "Hi-νガンダム", "01/img_001.png"),
  figure("gsf-gallery-f01-5-1-hi", `${F} 1.5`, "Hi-νガンダム", "01_5/img_038.png"),
  figure("gsf-gallery-ex07-1-item", `${F} EX07`, "将頑駄無&ハリマオ", "ex007/img_ex07_01.png"),
  figure("gsf-gallery-ex07-2-item", `${F} EX07`, "将頑駄無", "ex007/img_ex07_02.png"),
  figure("gsf-gallery-ex07-5-item", `${F} EX07`, "ハリマオ", "ex007/img_ex07_05.png"),
  figure("gsf-gallery-ex01-1-item", `${F} EX001`, "ペーネロペー", "ex001/img_ex001.png"),
  card("gundam-merch-4549660792031000", "機動戦士ガンダム ガシャポン戦士フォルテ16"),
  card("gundam-merch-4549660270751000", "機動戦士ガンダム ガシャポン戦士フォルテ1.5"),
  // Lines without figure records (ガシャポン戦士NEXT, DASH, ZERO) keep their cards.
  card("gundam-merch-4582769936081000", "機動戦士ガンダム ガシャポン戦士ZERO 01", "GUNDAM_MERCH"),
  card("gundam-merch-4549660096405999", "機動戦士ガンダム ガシャポン戦士フォルテ99"),
  { ...figure("mse-18-1-item", "MOBILE SUIT ENSEMBLE 18", "プロトタイプガンダム", "x.png"), grade_code: "MSE" },
  { ...figure("mse-18-5-1-item", "MOBILE SUIT ENSEMBLE 18.5", "プロトタイプガンダム", "y.png"), grade_code: "MSE" },
  card("gundam-merch-4549660653912000", "機動戦士ガンダム MOBILE SUIT ENSEMBLE 18", "MSE"),
];
const folds = Object.fromEntries(gashaponDuplicates(kits).map(({ from, to }) => [from, to]));
assert.deepEqual(folds, {
  "gundam-merch-4549660792031000": "gsf-gallery-f16-1-item",
  "gundam-merch-4549660270751000": "gsf-gallery-f01-5-1-hi",
  "gundam-merch-4549660653912000": "mse-18-1-item",
  "gsf-gallery-f16pb-1-item": "gsf-gallery-f16-1-item",
  "gsf-gallery-f16pb-2-item": "gsf-gallery-f16-2-item",
  "gsf-gallery-ex07-2-item": "gsf-gallery-ex07-1-item",
  "gsf-gallery-ex07-5-item": "gsf-gallery-ex07-1-item",
});

// ---------------------------------------------------------------- importer: EX set photos
const entry = (index, name, image, group = "gallery-ex07") => ({ set_title: `${F} EX07`, product_url: null, index, group, name, image_url: image });
const collapsed = collapseForteEntries([
  entry(1, "将頑駄無&ハリマオ", "ex07_01.png"),
  entry(2, "将頑駄無", "ex07_02.png"),
  entry(3, "将頑駄無", "ex07_04.png"),
  entry(4, "ハリマオ", "ex07_05.png"),
  entry(1, "ガンダム", "f01.png", "gallery-f01"),
  entry(2, "ガンダム&コアファイター", "f02.png", "gallery-f01"),
]);
assert.deepEqual(
  collapsed.map((item) => [item.name, item.images]),
  [
    ["将頑駄無&ハリマオ", ["ex07_01.png", "ex07_02.png", "ex07_04.png", "ex07_05.png"]],
    ["ガンダム", ["f01.png"]],
    ["ガンダム&コアファイター", ["f02.png"]],
  ],
  "only an EX gallery folds its single figures into the set",
);

// ---------------------------------------------------------------- re-import keeps a folded price
assert.equal(carryCleanupFields({ kit_id: "mse-18-1-item", price_jpy: 500 }, { kit_id: "mse-18-1-item", price_jpy: null }).price_jpy, 500);
assert.equal(carryCleanupFields({ kit_id: "mse-18-1-item", price_jpy: 500 }, { kit_id: "mse-18-1-item", price_jpy: 600 }).price_jpy, 600);
assert.equal(carryCleanupFields({ kit_id: "gsf-15-3-item", price_jpy: 500 }, { kit_id: "gsf-15-3-item", price_jpy: null }).price_jpy, 500);
// Any other re-import that comes back without a price (オープン価格, dropped) still clears it.
assert.equal(carryCleanupFields({ kit_id: "hg-rx-78-2", price_jpy: 1650 }, { kit_id: "hg-rx-78-2", price_jpy: null }).price_jpy, null);
assert.equal(carryCleanupFields({ kit_id: "gundam-merch-4570117912345", price_jpy: 500 }, { kit_id: "gundam-merch-4570117912345", price_jpy: null }).price_jpy, null);

console.log("gashapon duplicate tests passed");
