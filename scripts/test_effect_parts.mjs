// The 이펙트 channel rules (lib/effect-parts.mjs) on answers saved on 2026-11-15: the Tamashii search
// API filtered by the 魂EFFECT brand (four items, plus one effect set of another brand that the
// filter must drop), the goodsmile.com search for エフェクト (four cards) and one product page in
// Japanese and English (scripts/fixtures/tamashii-effect-*.json, gsc-effect-*.html, trimmed).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  customizeEffectRecord,
  effectGroups,
  effectKind,
  effectSeries,
  gscEffectGrade,
  gscEffectRecord,
  gscSearchUrl,
  gscStoredDetail,
  isCustomizeEffect,
  mergeEffects,
  mergeTamashiiAreas,
  parseGscCards,
  parseGscDetail,
  tamashiiEffectChanged,
  tamashiiEffectName,
  tamashiiEffectRecord,
  tamashiiEffectSearchUrl,
  tamashiiFirstRelease,
  tamashiiStoredDetail,
} from "./lib/effect-parts.mjs";

const fixture = (name) => readFileSync(`scripts/fixtures/${name}`, "utf8");

// --- Tamashii search: the brand filter, areas merged per id.
const url = new URL(tamashiiEffectSearchUrl("asia", 2));
assert.deepEqual(url.searchParams.getAll("brandCode[]"), ["tamashii_effect"]);
assert.deepEqual([url.searchParams.get("area"), url.searchParams.get("current_page")], ["asia", "2"]);
const listed = JSON.parse(fixture("tamashii-effect-search.json")).data;
const items = mergeTamashiiAreas([["japan", listed], ["asia", listed.filter((item) => item.tamashiiWebId === "15794")]]);
assert.deepEqual(items.map((item) => item.tamashiiWebId), ["10553", "11201", "14979", "15794"], "the METAL ROBOT魂 カルラ effect set (16192) is not a 魂EFFECT product");
assert.deepEqual(items.find((item) => item.tamashiiWebId === "15794").areas, ["japan", "asia"]);

// --- Names: the brand is part of the official name.
assert.equal(tamashiiEffectName("IMPACT Gray Ver. for S.H.Figuarts"), "魂EFFECT IMPACT Gray Ver. for S.H.Figuarts");
assert.equal(tamashiiEffectName("魂EFFECT WIND Violet Ver."), "魂EFFECT WIND Violet Ver.");

// --- A reissue keeps its first release date; the reissue goes in the notes.
const byId = (id) => items.find((item) => item.tamashiiWebId === id);
assert.equal(tamashiiFirstRelease(byId("10553")), "2014-03-29");
assert.equal(tamashiiFirstRelease(byId("15794")), null);
const impact = tamashiiEffectRecord(byId("10553"), { images: ["https://tamashiiweb.com/storage/images/products/main/a.webp"], release_date: "2016-07-16" });
assert.equal(impact.release_date, "2014-03-29");
assert.match(impact.notes, /Reissue shipping 2016-07-16; first release 2014-03-29\./);

// --- The record shape the app reads.
const record = tamashiiEffectRecord(byId("15794"), { images: ["https://tamashiiweb.com/storage/images/products/main/b.webp"], release_date: "2026-10-17", price_jpy: 3300 });
assert.deepEqual(
  {
    kit_id: record.kit_id,
    franchise: record.franchise,
    grade_code: record.grade_code,
    subline: record.subline,
    names: record.names,
    work_title: record.work_title,
    universe: record.universe,
    release_date: record.release_date,
    price_jpy: record.price_jpy,
    is_limited: record.is_limited,
  },
  {
    kit_id: "tamashii-15794",
    franchise: "effects",
    grade_code: "TAMASHII_EFFECT",
    subline: "魂EFFECT",
    names: { ja: "魂EFFECT IMPACT Gray Ver. for S.H.Figuarts", en: "TAMASHII EFFECT IMPACT Gray Ver. for S.H.Figuarts", zh: null, ko: null },
    work_title: null,
    universe: null,
    release_date: "2026-10-17",
    price_jpy: 3300,
    is_limited: false,
  },
);
assert.deepEqual(record.gallery_image_urls, [
  "https://tamashiiweb.com/storage/images/products/thumbnail/5d2d07f5-279c-4bbd-b3d3-f5720086ca07.webp",
  "https://tamashiiweb.com/storage/images/products/main/b.webp",
]);
assert.deepEqual(record.source_urls, ["https://tamashiiweb.com/item/15794/", "https://tamashiiweb.com/item_brand/tamashii_effect/"]);
assert.ok(record.tags.includes("s.h.figuarts"));
assert.equal(tamashiiEffectRecord(byId("11201")).is_limited, true, "魂ウェブ商店 only");
assert.deepEqual(tamashiiStoredDetail(record)?.images, ["https://tamashiiweb.com/storage/images/products/main/b.webp"], "a record with its page pictures is not read again");
assert.equal(tamashiiStoredDetail(tamashiiEffectRecord(byId("11201"))), null, "a listing-only record reads its page next time");
// A reissue's listed month differs from its first release, which is no change; a moved month or price is.
assert.equal(tamashiiEffectChanged(byId("10553"), impact), false);
assert.equal(tamashiiEffectChanged(byId("15794"), record), false);
assert.equal(tamashiiEffectChanged({ ...byId("15794"), releaseDateData: null, releaseMonth: "2026-12" }, record), true);
assert.equal(tamashiiEffectChanged({ ...byId("15794"), price: 3520 }, record), true);
// Only in an overseas area: tagged and noted like the Gundam Tamashii records.
const overseas = tamashiiEffectRecord({ ...byId("15794"), areas: ["usa"] });
assert.ok(overseas.tags.includes("tamashii-usa-only"));
assert.match(overseas.notes, /Listed only in the usa sales area/);

// --- Kinds of effect: series and atlas groups.
assert.equal(effectKind("魂EFFECT SHOCK IMPACT Yellow Ver. for S.H.Figuarts").id, "impact");
assert.equal(effectKind("魂EFFECT SMOKE Burst Ver. for S.H.Figuarts").id, "smoke");
assert.equal(effectKind("魂EFFECT Concrete Crash for S.H.Figuarts").id, "rock");
assert.equal(effectKind("魂EFFECT ENERGY AURA Red Ver.").id, "aura");
assert.equal(effectKind("THE シンプルエフェクト《炎》RED").id, "flame");
assert.equal(effectKind("MODEROID ウエーブエフェクト").id, "water");
assert.equal(effectKind("Something new").id, "other");
assert.deepEqual(effectSeries({ names: { ja: "魂EFFECT SMOKE White Ver. for S.H.Figuarts" } }), {
  key: "effects_smoke",
  sort: 902,
  labels: { ko: "연기", zh: "烟雾", en: "Smoke", ja: "スモーク" },
  universe: null,
});
const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });
const groups = effectGroups(
  [
    { kit_id: "a", franchise: "effects", names: { ja: "魂EFFECT SMOKE White Ver." }, images: { box_art_url: "https://x/a.jpg" }, release_date: "2015" },
    { kit_id: "b", franchise: "effects", names: { ja: "魂EFFECT SMOKE Burst Ver." }, images: { box_art_url: "https://x/b.jpg" }, release_date: "2026-04-25" },
    { kit_id: "c", franchise: "effects", names: { ja: "Something new" }, images: {} },
    { kit_id: "d", franchise: "effects", names: { ja: "魂EFFECT WIND Green Ver." }, images: {} },
    { kit_id: "g", franchise: "gundam", names: { ja: "エフェクトパーツセット ver. A.N.I.M.E." }, images: {} },
  ],
  lang,
);
assert.deepEqual(groups.map((group) => [group.id, group.count]), [["effects_smoke", 2], ["effects_wind", 1], ["effects_other", 1]]);
assert.equal(groups[0].image, "https://x/b.jpg", "the newest product is the cover");
assert.deepEqual(groups[0].labels, { zh: "烟雾", ko: "연기", en: "Smoke", ja: "スモーク" });

// --- goodsmile.com: the search keeps the effect lines only.
assert.match(decodeURIComponent(gscSearchUrl(60)), /"search_keyword":"エフェクト".*&offset=60&/);
const cards = parseGscCards(fixture("gsc-effect-search.html"));
assert.deepEqual(cards.map((card) => [card.productId, gscEffectGrade(card.name)]), [
  ["1139373", "GSC_SIMPLE_EFFECT"],
  ["9022", "MODEROID_EFFECT"],
  ["11278", null],
  ["10678", null],
]);
assert.equal(cards[0].price_jpy, 1700);
const detail = parseGscDetail(fixture("gsc-effect-detail-ja.html"), "1139373");
const english = parseGscDetail(fixture("gsc-effect-detail-en.html"), "1139373");
assert.deepEqual([detail.name, detail.price_jpy, detail.jan, detail.release_date], ["THE シンプルエフェクト《炎》RED", 1700, "4580828660786", null]);
assert.equal(detail.images[0], "https://www.goodsmile.com/gsc-webrevo-sdk-storage-prd/product/image/1139373/7nbRS0j8NY2EZfBQetvdw5cuVzDP1rMk.jpg", "the structured data's picture first");
assert.ok(detail.images.length >= 5 && detail.images.every((image) => image.includes("/product/image/1139373/")));
assert.equal(english.name, "THE SIMPLE EFFECT Flames: Red");
assert.deepEqual(parseGscDetail('<span>Shipping 01/2027</span>', "1").release_date, "2027-01");
const flames = gscEffectRecord(cards[0], detail, english);
assert.deepEqual(
  [flames.kit_id, flames.franchise, flames.grade_code, flames.names.ja, flames.names.en, flames.jan, flames.price_jpy, flames.work_title],
  ["goodsmile-effects-g1139373", "effects", "GSC_SIMPLE_EFFECT", "THE シンプルエフェクト《炎》RED", "THE SIMPLE EFFECT Flames: Red", "4580828660786", 1700, null],
);
// A stored record is not read again and gives the same record back.
const stored = gscStoredDetail(flames);
assert.deepEqual(gscEffectRecord(cards[0], stored.detail, stored.english), flames);
assert.equal(gscEffectRecord({ ...cards[0], price_jpy: null }, stored.detail, stored.english).price_jpy, 1700, "a card without a price keeps the page's");

// --- カスタマイズエフェクト (a BANDAI SPIRITS product search card as parseBandaiSpiritProductCards gives it).
const card = {
  source_url: "https://www.bandaispirits.co.jp/products/search/detail.php?prd_id=4573102606945000&grp_id=5325",
  image_url: "https://bandai-a.akamaihd.net/bc/img/model/b/1000148826_1.jpg",
  title: "カスタマイズエフェクト (爆発イメージVer.) [グレー]",
  release_date: "2020-08-08",
  price_jpy: 550,
};
assert.ok(isCustomizeEffect(card.title));
assert.ok(!isCustomizeEffect("HG 1/144 ストライクフリーダムガンダム弐式&光の翼エフェクトセット"), "a kit's own effect set stays with its work");
const customize = customizeEffectRecord(card, { images: ["https://bandai-a.akamaihd.net/bc/img/model/b/1000148826_2.jpg"] });
assert.deepEqual(
  [customize.kit_id, customize.grade_code, customize.jan, customize.release_date, customize.price_jpy, customize.images.box_art_source_id, effectSeries(customize).key],
  ["bandai-effect-4573102606945000", "CUSTOMIZE_EFFECT", "4573102606945", "2020-08-08", 550, "bandai_spirits_products_jp", "effects_explosion"],
);
assert.equal(effectKind("カスタマイズエフェクト (斬撃イメージVer.) [ブルー]").id, "slash");
assert.equal(effectKind("カスタマイズエフェクト (銃撃イメージVer.) [イエロー]").id, "gunfire");
assert.equal(effectKind("カスタマイズエフェクト (アクションイメージVer.) [レッド]").id, "action");

// --- Merge: records keep their place and what later steps added; new ones follow.
const merged = mergeEffects(
  [{ kit_id: "x", franchise: "gundam" }, { kit_id: "tamashii-15794", franchise: "effects", series: { key: "effects_impact" }, price_jpy: 3000 }],
  [{ kit_id: "tamashii-15794", franchise: "effects", price_jpy: 3300 }, { kit_id: "goodsmile-effects-g1", franchise: "effects" }],
);
assert.deepEqual(merged.map((kit) => kit.kit_id), ["x", "tamashii-15794", "goodsmile-effects-g1"]);
assert.deepEqual([merged[1].price_jpy, merged[1].series.key], [3300, "effects_impact"]);

console.log("effect parts: ok");
