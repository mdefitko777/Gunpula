// Fixture tests for the Gundam coverage parsers and classifiers: the
// ja.wikipedia table reader, the Premium Bandai category-list cards, the
// BANDAI SPIRITS grade/scale/date rules, the Tamashii brand grades and listing
// checks, and the shared cleanup rules.
import assert from "node:assert/strict";
import { inferGrade, inferScale, parseReleaseDate, toKit } from "./import_bandai_spirits_gunpla.mjs";
import { tamashiiGradeCode, tamashiiListingChanged, tamashiiReleaseDate } from "./import_bandai_collectibles.mjs";
import { isDateLike } from "./lib/catalog.mjs";
import {
  ACCESSORY_KIT,
  bandaiImageId,
  carryCleanupFields,
  gundamGradeFromName,
  goodsKind,
  hasSaleTag,
  nfkc,
  premiumBandaiExclusiveEvidence,
  productKey,
  publicBandaiImageUrl,
  scaleFromName,
  stripDisplaySaleTags,
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
  for (const name of [
    "ＨＧＢＣ 1/144 ライトニングバックウェポンシステムMk-II",
    "オプションパーツセット ガンプラ 16 (メテオホッパー)",
    "ガンダムベース限定 1/100 MSスパイク01",
    "ビルダーズパーツHD-04 1/144 MSバーニア01",
    "ビルダーズパーツHD-02 1/144 MSハンド01（連邦系）",
    "BPHD 1/144 MSエフェクト01(イエロー)",
  ]) {
    assert.equal(goodsKind({ franchise: "gundam", names: { ja: name } }), null, name);
    assert.ok(ACCESSORY_KIT.test(nfkc(name)), name);
  }
  assert.equal(gundamGradeFromName("ビルダーズパーツHD-02 1/144 MSハンド01（連邦系）"), "NG");
  // Goods keep a kind the app labels; decals and LED units are hobby supplies.
  const kind = (ja, franchise = "gundam") => goodsKind({ franchise, names: { ja } });
  assert.equal(kind("ガンダムデカール No.120"), "hobby_supply");
  assert.equal(kind("ＬＥＤユニット１個セット(黄) 【２０２６年９月発送】"), "hobby_supply");
  assert.equal(kind("【Blu-ray】Vシネクスト『超宇宙刑事ギャバン インフィニティVSライヤ』", "armored_core"), "media_video");
  assert.equal(kind("Fate / Grand Order 10th Anniversary ALBUM", "fate"), "book");
  assert.equal(kind("ガンダムカードゲーム ブースターパック Dual Impact[GD02]"), "card_game");
  assert.equal(kind("機動戦士ガンダム 水星の魔女 Tシャツ"), "apparel");
  assert.equal(kind("ネックレス シャア・アズナブル"), "accessory");
  assert.equal(kind("포켓몬 볼펜 세트", "pokemon"), "stationery");
  assert.equal(kind("マグカップ ガンダム"), "household");
  assert.equal(kind("ぬいぐるみポーチ ピカチュウ", "pokemon"), null); // plush stays a collectible
  assert.equal(kind("HGPG プチッガイ ソーダポップブルー&アイスキャンディー"), null);
  assert.equal(gundamGradeFromName("GUNDAM FIX FIGURATION METAL COMPOSITE Oガンダム"), "GFF");
  assert.equal(gundamGradeFromName("METAL STRUCTURE 解体匠機 RX-93 νガンダム専用オプションパーツ"), "METAL_STRUCTURE");
  // Premium Bandai renames HGBF reruns plain "ＨＧ".
  assert.equal(productKey("ＨＧ 1/144 アメイジングズゴック 【再販】【２次：２０２５年３月発送】"), productKey("HGBF 1/144 アメイジングズゴック"));
  assert.equal(stripSaleTags("【イベント受け取り】ＭＧ 1/100 リ・ガズィ・カスタム"), "MG 1/100 リ・ガズィ・カスタム");
  assert.equal(stripSaleTags("【特別抽選販売】ストライクガンダム -METAL BUILD 10th Ver.-（2022年2月発送分）"), "ストライクガンダム -METAL BUILD 10th Ver.-");
  // Display names keep their full-width spelling, without the sale tags.
  assert.equal(stripDisplaySaleTags("ＭＧ RMS-179 ジムＩＩ 【２次：２０１７年２月発送】"), "ＭＧ RMS-179 ジムＩＩ");
  assert.equal(stripDisplaySaleTags("【抽選販売】ＲＧ 1 / 144 νガンダム"), "ＲＧ 1 / 144 νガンダム");
  assert.equal(stripDisplaySaleTags("超合金の塊 ガンダムシリーズ （2016年11月発売）"), "超合金の塊 ガンダムシリーズ （2016年11月発売）");
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

// --- Premium Bandai exclusives --------------------------------------------------
{
  const keeper = (date, photo) => ({ release_date: date, images: { box_art_url: photo ? `https://bandai-a.akamaihd.net/bc/img/model/b/${photo}_1.jpg` : null } });
  const page = (id, ja, date = null) => ({ kit_id: `pbandai-wb-${id}`, names: { ja }, release_date: date });
  // Retail kits: a shop day on BANDAI SPIRITS, PB lottery / rerun pages years later.
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2014-04-26", "1000087927"), [page("1000250001", "【抽選販売】ＲＧ 1 / 144 ガンダムエクシア")]), null);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2020-05-23", "1000150000"), [page("1000210000", "ＨＧ 1/144 ウィンダム【２０２４年５月発送】")]), null);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("1987-12", "1000125963"), [page("1000125963", "1/144 リ・ガズィ")]), null);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2026-12", "1"), [page("1000260000", "【抽選販売】HG 1/144 ガンダムX")]), null);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2002-06", "1"), [page("1000250002", "ＨＧ メカニクス 1 / 550 ヴァル・ヴァロ")]), null);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2018-08-04", "1"), [page("1000257314", "ＨＧ 1/144 陸戦型ガンダム（パラシュート・パック仕様）【再販】")]), null);
  // PB exclusives: no shop day on BANDAI SPIRITS (a month, or the 1st) and a PB page.
  const sale = "PB sale page of a kit without a shop day";
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2021-03", "1000150001"), [page("1000150001", "ＭＧ 1/100 ガンダムＦ９０ ２号機")]), "original PB listing");
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2025-08", "1000226427"), [page("1000226427", "【抽選販売】RG 1 / 144 MS-06S ザクII [初音ミクVer.]")]), "original PB listing");
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2012-09", "1"), [page("1000220000", "ＨＧ 1/144 ダナジン（紫カラー）【再販】【２次：２０２２年２月発送】")]), sale);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2015-04", "1"), [page("1000099999", "HGUC 1/144 ペイルライダー（陸戦重装備仕様）【３次：２０１５年６月発送】")]), sale);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2020-06-01", "1"), [page("1000254488", "ＭＧ 1/100 RGM-89D ジェガン Ｄ型（先行配備機）【再販】")]), sale);
  assert.equal(premiumBandaiExclusiveEvidence(keeper("2019-08-10", "1"), [page("1000140000", "【プレミアムバンダイ限定】ＨＧ 1/144 ザク")]), "page says PB limited");
  // A BANDAI SPIRITS card never flags itself as a PB exclusive.
  const card = { source_url: "https://www.bandaispirits.co.jp/products/search/detail.php?prd_id=4573102591234", image_url: "https://bandai-a.akamaihd.net/bc/img/model/b/1000125963_1.jpg", title: "1/144 リ・ガズィ", release_text: "1987年12月15日", price_text: "880円" };
  assert.equal(toKit(card).is_limited, false);
  assert.equal(toKit(card).is_premium_bandai, undefined);
}

// --- Release dates -------------------------------------------------------------
assert.equal(isDateLike("2016-70"), false);
assert.equal(isDateLike("2016-12-31"), true);
assert.equal(isDateLike("2016-00"), false);

console.log("coverage parser tests passed");
