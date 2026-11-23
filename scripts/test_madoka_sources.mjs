// The Madoka importer's Good Smile rules (scripts/import_madoka_sources.mjs) on goodsmile.com pages
// saved on 2026-11-23 (scripts/fixtures/gsc-madoka-detail-*.html, trimmed): space-insensitive
// character names, Huggy Good Smile / Huggy Doll / finger puppets, the product-page fallback for
// cards without a figure word, マギアレコード characters, sealed boxes and goodsmile.info ids.
//   node scripts/test_madoka_sources.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classify,
  dedupe,
  gscBoxOf,
  gscGlobalWithDetail,
  gscLegacyId,
  isMadoka,
  isMadokaCharacter,
  workTitleFor,
} from "./import_madoka_sources.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const GLOBAL = "good_smile_madoka_global";
const TV = "魔法少女まどか☆マギカ";
const MAGIA_RECORD = "マギアレコード 魔法少女まどか☆マギカ外伝";
const REBELLION = "劇場版 魔法少女まどか☆マギカ［新編］叛逆の物語";

// goodsmile.com writes "巴 マミ"; every other page "巴マミ".
assert.equal(isMadokaCharacter("POP UP PARADE 巴 マミ"), true);
assert.equal(isMadokaCharacter("ねんどろいど ホーリーマミ"), true);
assert.equal(isMadoka("魔法少女 まどか ☆ マギカ ポータブル"), true);
// 神浜コウジ (KING OF PRISM) turns up in the マギアレコード search; 神浜 is no Madoka name.
assert.equal(isMadokaCharacter("ねんどろいどこ～で 神浜コウジ"), false);
assert.equal(isMadoka("ねんどろいどこ～で 神浜コウジ"), false);

// Huggy Good Smile is a small painted figure, Huggy Doll and the finger puppets are plush.
assert.deepEqual(classify({ name: "Huggy Good Smile 鹿目まどか" }, GLOBAL), { grade: "MADOKA_MINI" });
assert.deepEqual(classify({ name: "劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 Huggy Doll 鹿目まどか/暁美ほむら" }, GLOBAL), {
  grade: "MADOKA_PLUSH",
});
assert.deepEqual(classify({ name: "POP UP PARADE 巴 マミ" }, GLOBAL), { grade: "MADOKA_SCALE", subline: "POP UP PARADE" });
// ねんどろいどもあ parts sets are ねんどろいど, as in the Fate / Nintendo / Pokémon catalogs.
assert.deepEqual(classify({ name: "ねんどろいどもあ ホーリーマミ マスケット銃パーツセット" }, GLOBAL), {
  grade: "NENDOROID",
  subline: "ねんどろいどもあ",
});
// A bag is goods once its page says so; by its name alone it is only uncertain.
assert.equal(classify({ name: "劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 COSBAG" }, GLOBAL).exclude, "uncertain");
assert.equal(classify({ name: "劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 COSBAG", category: "グッズ" }, GLOBAL).exclude, "goods");

// Product page fallback: a moved goodsmile.info scale figure whose name has no figure word.
const homuraCard = {
  key: "g1626",
  name: "暁美ほむら you are not alone.",
  url: "https://www.goodsmile.com/ja/product/1626/x",
  image: "https://www.goodsmile.com/gsc-webrevo-sdk-storage-prd/product/image/product/20121220/3797/22095/large/ca793307b9227fff1ca88b5b8290414e.jpg",
  price_jpy: 9428,
  release_date: null,
};
assert.equal(classify(homuraCard, GLOBAL).exclude, "uncertain");
assert.equal(gscLegacyId(homuraCard.image), "3797");
const homura = gscGlobalWithDetail(homuraCard, fixture("gsc-madoka-detail-1626.html"));
assert.equal(homura.name, "暁美ほむら you are not alone.");
assert.equal(homura.category, "1/8スケールフィギュア");
assert.equal(homura.work, TV);
assert.equal(homura.is_figure, true);
assert.equal(homura.price_jpy, 9428);
assert.ok(homura.gallery.length >= 2 && homura.gallery.every((url) => gscLegacyId(url) === "3797"), "own pictures only");
assert.deepEqual(classify(homura, GLOBAL), { grade: "MADOKA_SCALE" });
assert.equal(workTitleFor(homura), TV);

// The finger puppet's page files it under グッズ; the name still makes it plush.
const puppetCard = {
  key: "g1143792",
  name: "劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 トレーディング指人形",
  url: "https://www.goodsmile.com/ja/product/1143792/x",
  image: "",
  price_jpy: 1320,
  release_date: null,
};
const puppet = gscGlobalWithDetail(puppetCard, fixture("gsc-madoka-detail-1143792.html"));
assert.equal(puppet.category, "グッズ");
assert.equal(puppet.is_figure, false);
assert.match(puppet.image, /\/product\/image\/1143792\//);
assert.deepEqual(classify(puppet, GLOBAL), { grade: "MADOKA_PLUSH" });
assert.equal(workTitleFor(puppet), REBELLION);

// The 5-pack is the sealed box of the blind-packed single listed beside it.
const listed = new Set([puppetCard.name, "劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 トレーディング指人形(5個入)"]);
assert.equal(gscBoxOf("劇場版 魔法少女まどか☆マギカ[新編]叛逆の物語 トレーディング指人形（5個入）", listed), puppetCard.name);
assert.equal(gscBoxOf("ころころいど カービィ デラックス（8個入）", listed), null, "a box sold alone stays");

// マギアレコード characters alone mean マギアレコード; a 作品名 or a work in the name wins.
assert.equal(workTitleFor({ name: "ねんどろいど ホーリーマミ" }), MAGIA_RECORD);
assert.equal(workTitleFor({ name: "アリナ・グレイ" }), MAGIA_RECORD);
assert.equal(workTitleFor({ name: "ねんどろいど 鹿目まどか" }), TV);
assert.equal(workTitleFor({ name: "ねんどろいど ホーリーマミ", work: "魔法少女まどか☆マギカ Magia Exedra" }), "魔法少女まどか☆マギカ Magia Exedra");
assert.equal(workTitleFor({ name: "劇場版 魔法少女まどか☆マギカ〈ワルプルギスの廻天〉 環いろは" }), "劇場版 魔法少女まどか☆マギカ〈ワルプルギスの廻天〉");
// A stored goodsmile.com record carries the localized title; reused, it keeps its work.
assert.equal(workTitleFor({ name: "COSBAG", series: "Rebellion" }), REBELLION);

// A goodsmile.com record of a product moved from goodsmile.info folds into the stored
// goodsmile.info record by the id in its picture paths, even when the names differ and the
// goodsmile.info page is gone.
function kit(kitId, sourceId, name, image) {
  return {
    kit_id: kitId,
    grade_code: "MADOKA_SCALE",
    scale: "1/8",
    names: { ja: name },
    images: { box_art_url: image },
    gallery_image_urls: [image],
    work_title: TV,
    price_jpy: null,
    release_date: null,
    source_urls: [`https://example.test/${kitId}`],
    source_refs: [{ source_id: sourceId, url: `https://example.test/${kitId}` }],
    tags: [],
  };
}
const stored = kit("goodsmile-madoka-3797", "good_smile_madoka_en", "暁美ほむら you are not alone. 1/8", "https://images.goodsmile.info/x.jpg");
const fresh = kit("goodsmile-madoka-g1626", GLOBAL, "暁美ほむら", homuraCard.image);
const result = dedupe([fresh], [stored]);
assert.deepEqual(result.kits, []);
assert.deepEqual(result.folded, [{ from: "goodsmile-madoka-g1626", to: "goodsmile-madoka-3797" }]);
assert.ok(stored.source_refs.some((ref) => ref.source_id === GLOBAL));
// Without a stored record the goodsmile.com one stands.
assert.deepEqual(dedupe([kit("goodsmile-madoka-g1626", GLOBAL, "暁美ほむら", homuraCard.image)], []).kits.map((entry) => entry.kit_id), [
  "goodsmile-madoka-g1626",
]);

console.log("Madoka sources: ok");
