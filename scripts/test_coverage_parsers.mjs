// Fixture tests for the Gundam coverage parsers and classifiers: the
// ja.wikipedia table reader, the Premium Bandai category-list cards, the
// BANDAI SPIRITS grade/scale/date rules, the Tamashii brand grades and listing
// checks, and the shared cleanup rules.
import assert from "node:assert/strict";
import { inferGrade, inferScale, parseReleaseDate } from "./import_bandai_spirits_gunpla.mjs";
import { tamashiiGradeCode, tamashiiListingChanged, tamashiiReleaseDate } from "./import_bandai_collectibles.mjs";
import { isDateLike } from "./lib/catalog.mjs";
import {
  ACCESSORY_KIT,
  bandaiImageId,
  carryCleanupFields,
  gundamGradeFromName,
  hasSaleTag,
  nfkc,
  nonCollectibleReason,
  productKey,
  publicBandaiImageUrl,
  scaleFromName,
  stripSaleTags,
} from "./lib/catalog-cleanup.mjs";
import { listingNameMonth, parseListingCards } from "./lib/pb-listing.mjs";
import { parseWikiTables } from "./lib/wiki-tables.mjs";

// --- ja.wikipedia tables with rowspan --------------------------------------
{
  const wikitext = [
    "== 概要 ==",
    "=== SIDE MS ===",
    "==== 機動戦士ガンダム00 ====",
    '{| class="wikitable"',
    "! No. !! 商品名 !! 発売日 !! 備考",
    "|-",
    '| rowspan="2" | 001 || [[ガンダムエクシア]] || 2008年10月 || ',
    "|-",
    "| ガンダムエクシア（リペア）<ref>魂ウェブ</ref> || 2009年3月 || 魂ウェブ商店限定",
    "|-",
    "| 002 || アドヴァンスドジンクス || 2009年9月<br />（再販 2010年1月） || {{0}}イベント限定",
    "|}",
    "=== SIDE AB ===",
    '{| class="wikitable"',
    "|-",
    "| 001 || ダンバイン || 2010年 || ",
    "|}",
  ].join("\n");
  const rows = parseWikiTables(wikitext, /^=== SIDE MS ===/, /^=== SIDE (?!MS)/);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].cells.slice(0, 3), ["001", "ガンダムエクシア", "2008年10月"]);
  // The rowspan No. cell is carried down to the next row.
  assert.deepEqual(rows[1].cells.slice(0, 4), ["001", "ガンダムエクシア（リペア）", "2009年3月", "魂ウェブ商店限定"]);
  assert.equal(rows[1].heading, "機動戦士ガンダム00");
  assert.equal(rows[2].cells[2], "2009年9月\n（再販 2010年1月）");
  assert.equal(rows[2].cells[3], "イベント限定");
}

// --- Premium Bandai category-list cards -------------------------------------
{
  const card = (id, name, price, icons) => `<div class="article_area">
<div class="article_photo_s"><a href="/item/item-${id}/"><img src="https://bandai-a.akamaihd.net/bc/img/model/m/${id}_1.jpg" alt="${name}" width="90" height="90" /></a></div>
<div class="article_txt"><ul class="icon">${icons}</ul>
<p class="article_title"><a href="/item/item-${id}/">${name}</a></p>
<p class="price">${price}円（税込）</p></div></div>`;
  const html = [
    "<html><body>",
    card(
      "1000249106",
      "HG 1/144 ガンダムジリウス【再販】",
      "2,970",
      '<li><img src="https://bandai-a.akamaihd.net/bc/img/icon/ITEM_OUT_OF_STOCK.gif" alt="在庫無し" /></li><li><img src="//bandai-a.akamaihd.net/bc/img/icon/RESERVE_202605.gif" alt="配送" /></li>',
    ),
    card("1000137080", "ＭＧ 1/100 ガンダムＦ９０ 【３次：２０１９年１１月発送】", "4,400", ""),
    "</body></html>",
  ].join("\n");
  const cards = parseListingCards(html);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].item_url, "https://p-bandai.jp/item/item-1000249106/");
  assert.equal(cards[0].price_jpy, 2970);
  assert.equal(cards[0].availability, "sold_out");
  assert.equal(cards[0].release_date, "2026-05");
  assert.equal(cards[0].image, "https://bandai-a.akamaihd.net/bc/img/model/b/1000249106_1.jpg");
  // No shipping icon: the month comes from the full-width name.
  assert.equal(cards[1].release_date, "2019-11");
  assert.equal(listingNameMonth("【１次受付：２０１３年１月発送分】"), "2013-01");
  assert.equal(listingNameMonth("HG ビギニングガンダム"), null);
}

// --- BANDAI SPIRITS grade, scale and date rules -----------------------------
{
  const grade = (title) => inferGrade(title)?.grade_code ?? null;
  assert.equal(grade("ＨＧ 1/144 ガンダムエアリアル"), "HG"); // full-width prefix
  assert.equal(inferGrade("HGBF 1/144 煌式（GILLA-SHIKI）").subline, "HGBF");
  assert.equal(grade("ＢＢ戦士 三国伝 劉備ガンダム"), "SD");
  assert.equal(grade("SD三国創傑伝 劉備ユニコーンガンダム"), "SDW");
  assert.equal(grade("1/48 メガサイズモデル ガンダム"), "MEGA");
  assert.equal(inferScale("1/48 メガサイズモデル ガンダム", "MEGA"), "1/48");
  assert.equal(grade("U.C.ハードグラフ ジオン公国軍 機動偵察セット"), "UCHG");
  assert.equal(inferScale("U.C.ハードグラフ ジオン公国軍 機動偵察セット", "UCHG"), "1/35");
  assert.equal(grade("HG 1/144 ガンダム用 拡張パーツ ウェポンズ"), null); // add-on weapon pack
  assert.equal(grade("ENTRY GRADE 1/144 ストライクガンダム (フルウェポンセット)"), "EG"); // a kit
  assert.equal(grade("ガンダムデカール No.120"), null);
  assert.equal(grade("HGBC 1/144 ライトニングバックウェポンシステムMk-II"), "HG"); // accessory kit
  assert.equal(grade("ガンダムベース限定 1/100 MSエフェクト01"), "NG");
  assert.equal(inferScale("SD RX-78-2 ガンダム Ver.G30th REAL GRADE 1/1 GUNDAM PROJECT", "SD"), "non-scale");
  assert.equal(parseReleaseDate("2016年70月日"), "2016");
  assert.equal(parseReleaseDate("2016年7月日"), "2016-07");
  assert.equal(parseReleaseDate("2021年3月3日"), "2021-03-03");
}

// --- Tamashii ----------------------------------------------------------------
{
  assert.equal(tamashiiGradeCode("ROBOT魂"), "ROBOT_SPIRITS");
  assert.equal(tamashiiGradeCode("METAL ROBOT魂"), "METAL_ROBOT");
  assert.equal(tamashiiGradeCode("GUNDAM FIX FIGURATION METAL COMPOSITE"), "GFF");
  assert.equal(tamashiiGradeCode("超合金の塊"), "CHOGOKIN");
  assert.equal(tamashiiGradeCode("魂ネイションズ"), "TAMASHII_OTHER");
  const item = { releaseDateData: "2027-04", releaseMonth: "2027-04", price: 5500 };
  assert.equal(tamashiiReleaseDate(item, { release_date: "2027-04-15" }), "2027-04-15");
  assert.equal(tamashiiReleaseDate(item, { release_date: "2027-02-20" }), "2027-04"); // the month moved
  assert.equal(tamashiiListingChanged(item, { release_date: "2027-02-20", price_jpy: 5500 }), true);
  assert.equal(tamashiiListingChanged(item, { release_date: "2027-04-15", price_jpy: 5500 }), false);
  assert.equal(tamashiiListingChanged(item, { release_date: "2027-04", price_jpy: 4950 }), true);
}

// --- Shared cleanup rules ----------------------------------------------------
{
  assert.equal(gundamGradeFromName("MG サザビーVer.Ka & RE/100 ナイチンゲール用 エフェクトセット"), "MG");
  assert.equal(gundamGradeFromName("FULL MECHANICS 1/100 ガンダムバルバトスルプス"), "FM");
  assert.equal(gundamGradeFromName("HGCC 1/144 ∀ガンダム用 月光蝶エフェクトユニット"), "HG");
  assert.equal(gundamGradeFromName("HY2M 1/60 ガンダム"), "HY2M");
  assert.equal(gundamGradeFromName("ＲＥ／１００ ナイチンゲール"), "RE100");
  assert.equal(gundamGradeFromName("機動戦士ガンダム ROBOT魂 ミニチュアコレクション"), null);
  assert.equal(scaleFromName("1/48 メガサイズモデル ガンダム RG1/1ガンダムプロジェクトＶｅｒ．"), "1/48");
  assert.equal(stripSaleTags("ＭＧ 1/100 ガンダムMk-V(連邦カラー)【２次】"), "MG 1/100 ガンダムMk-V(連邦カラー)");
  assert.equal(stripSaleTags("ＨＧ 1/144 赤い三巨星チームセット【特典対象】"), "HG 1/144 赤い三巨星チームセット");
  assert.equal(hasSaleTag("HGUC 1/144 リバウ 【２次：２０１４年１月発送】"), true);
  assert.equal(hasSaleTag("HGUC 1/144 リバウ"), false);
  assert.equal(productKey("ＨＧ 1/144 リック・ディアス【再販】"), productKey("HG 1/144 リック・ディアス"));
  // Plastic accessory kits are kits; decals and LED units are supplies.
  for (const name of ["ＨＧＢＣ 1/144 ライトニングバックウェポンシステムMk-II", "オプションパーツセット ガンプラ 16 (メテオホッパー)", "ガンダムベース限定 1/100 MSスパイク01"]) {
    assert.equal(nonCollectibleReason({ franchise: "gundam", names: { ja: name } }), null, name);
    assert.ok(ACCESSORY_KIT.test(nfkc(name)), name);
  }
  assert.equal(nonCollectibleReason({ franchise: "gundam", names: { ja: "ガンダムデカール No.120" } }), "hobby_supply");
  assert.equal(bandaiImageId("https://bandai-a.akamaihd.net/bc/img/model/b/1000130551_1.jpg"), "1000130551");
  assert.equal(publicBandaiImageUrl("http://internal-pbn/bc/img/model/b/1000094473_1.jpg"), null);
  assert.equal(publicBandaiImageUrl("https://bandai-a.akamaihd.net/bc/img/model/b/1_1.jpg"), "https://bandai-a.akamaihd.net/bc/img/model/b/1_1.jpg");
  // A re-import keeps the PB refs, flags and cleanup tags clean_catalog folded in.
  const previous = {
    kit_id: "rg-x",
    is_limited: true,
    is_premium_bandai: true,
    premium_bandai: { availability: "sold_out" },
    source_refs: [{ source_id: "bandai_spirits_products_jp", url: "a" }, { source_id: "p_bandai_wayback", url: "b" }],
    tags: ["gunpla", "premium-bandai-sale", "old-tag"],
  };
  const fresh = { kit_id: "rg-x", is_limited: false, source_refs: [{ source_id: "bandai_spirits_products_jp", url: "a2" }], tags: ["gunpla"] };
  const merged = carryCleanupFields(previous, fresh);
  assert.equal(merged.is_limited, true);
  assert.equal(merged.is_premium_bandai, true);
  assert.deepEqual(merged.premium_bandai, { availability: "sold_out" });
  assert.deepEqual(merged.source_refs.map((ref) => ref.url), ["a2", "b"]);
  assert.deepEqual(merged.tags, ["gunpla", "premium-bandai-sale"]);
  assert.equal(carryCleanupFields(null, fresh), fresh);
}

// --- Release dates -------------------------------------------------------------
assert.equal(isDateLike("2016-70"), false);
assert.equal(isDateLike("2016-12-31"), true);
assert.equal(isDateLike("2016-00"), false);

console.log("coverage parser tests passed");
