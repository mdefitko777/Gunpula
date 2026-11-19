// The 닌텐도 channel's maker rules (lib/nintendo-makers.mjs) and the shop search's Shift_JIS keyword
// (lib/kotobukiya-shop.mjs) on pages saved on 2026-11-19: the goodsmile.com search of the ゼノブレイド2
// filter (four cards) and the ホムラ product page (scripts/fixtures/gsc-nintendo-*.html, trimmed), and
// the Kotobukiya goods page of the existing fixture (an FGO figure; a Nintendo copy is made from it).
//   node scripts/test_nintendo_makers.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseGscCards, parseGscDetail } from "./lib/effect-parts.mjs";
import { KOTOBUKIYA_AC_SHOP_URL, parseKotobukiyaShopDetail, parseKotobukiyaShopListings, shiftJisQuery } from "./lib/kotobukiya-shop.mjs";
import {
  findDuplicate,
  GSC_TITLES,
  gscGrade,
  gscProductName,
  gscRecord,
  gscStoredPages,
  gscTitleSearchUrl,
  gscWork,
  kotobukiyaFilterUrl,
  kotobukiyaGrade,
  kotobukiyaKeywordUrl,
  kotobukiyaManualRecord,
  kotobukiyaRecord,
  kotobukiyaStoredDetail,
  makerGoodsKind,
  makerSeries,
  mergeMakerRecords,
  parseGscSpec,
  rightsHolder,
} from "./lib/nintendo-makers.mjs";

const fixture = (name) => readFileSync(`scripts/fixtures/${name}`, "utf8");

// --- The shop search reads Shift_JIS: the same bytes as the hand-encoded まどか query, and back.
assert.equal(shiftJisQuery("まどか"), "%82%DC%82%C7%82%A9");
assert.ok(KOTOBUKIYA_AC_SHOP_URL.includes(`keyword=${shiftJisQuery("ARMORED CORE")}&`));
const encoded = shiftJisQuery("ゼノブレイド");
const bytes = Uint8Array.from(encoded.match(/%[0-9A-F]{2}|./g).map((part) => (part.length === 3 ? Number.parseInt(part.slice(1), 16) : part.charCodeAt(0))));
assert.equal(new TextDecoder("shift_jis").decode(bytes), "ゼノブレイド");
assert.match(kotobukiyaKeywordUrl("ゼルダ"), /keyword=%83%5B%83%8B%83_&search\.x=on&ps=90$/);
assert.equal(kotobukiyaFilterUrl(193), "https://shop.kotobukiya.co.jp/shop/goods/search.aspx?search_filter1=193&search.x=on&ps=90");

// --- Whose work: the copyright line first, Pokémon (also ©Nintendo) to the pokemon channel.
assert.equal(rightsHolder("©2017 Nintendo / MONOLITHSOFT"), "nintendo");
assert.equal(rightsHolder("©Nintendo / HAL Laboratory, Inc."), "nintendo");
assert.equal(rightsHolder("©Pokémon. ©Nintendo/Creatures Inc./GAME FREAK inc."), "pokemon");
assert.equal(rightsHolder("©TYPE-MOON / FGO7 ANIME PROJECT"), "other");
assert.equal(rightsHolder(""), null);
assert.equal(makerSeries("ゼノブレイド2", "セイレーン").key, "nintendo_xenoblade");
assert.equal(makerSeries("ファイアーエムブレム 風花雪月", "エーデルガルト").key, "nintendo_fire_emblem");
assert.equal(makerSeries("ゼノサーガ エピソードⅢ", "KOS-MOS"), null, "Xenosaga is Bandai Namco's");
assert.equal(makerSeries(null, "アクリルスタンドコレクション マリオン・ブライス"), null, "マリオン is not Mario");
assert.equal(makerSeries("ポケットモンスター", "ピカチュウ"), null, "Pokémon stays in its channel");

// --- Grades.
assert.equal(gscGrade({ category: "1/7スケールフィギュア", name: "ホムラ" }), "NIN_SCALE");
assert.equal(gscGrade({ category: "POP UP PARADE", name: "POP UP PARADE カービィ" }), "NIN_SCALE");
assert.equal(gscGrade({ category: "figma", name: "figma リンク ティアーズ オブ ザ キングダムver." }), "NIN_ACTION");
assert.equal(gscGrade({ category: "ねんどろいど", name: "ねんどろいど ワドルディ" }), "NIN_ACTION");
assert.equal(gscGrade({ name: "コロコロイド 星のカービィ コレクションフィギュア" }), "NIN_MINI");
assert.equal(gscGrade({ name: "星のカービィ へんしんラバーストラップ" }), "NIN_GOODS");
assert.equal(gscGrade({ category: "グッズ", name: "ころころいど カービィ" }), "NIN_MINI", "goodsmile.com writes it in hiragana");
assert.equal(gscGrade({ name: "星のカービィ ワークシャツ デニム/ツイル" }), "NIN_GOODS");
assert.equal(gscGrade({ category: "プラモデル", name: "MODEROID なにか" }), "NIN_PLAMO");
assert.equal(gscGrade({ category: "スケールフィギュア", spec: "塗装済み完成品（一部組み立て）", name: "x" }), "NIN_SCALE", "partly assembled is not a kit");
assert.equal(kotobukiyaGrade({ category: "プラモデル本体", specification: "組み立て式プラモデル" }), "NIN_PLAMO");
assert.equal(kotobukiyaGrade({ category: "スケールフィギュア", specification: "塗装済み完成品フィギュア" }), "NIN_SCALE");
assert.equal(kotobukiyaGrade({ category: "キャラグッズ", specification: "アクリルスタンド" }), "NIN_GOODS");

// --- Kotobukiya: a goods page of another work is left out; the same page of a Nintendo kit is a record.
const fgoUrl = "https://shop.kotobukiya.co.jp/shop/g/g4580787175222/";
const fgoPage = fixture("kotobukiya-goods-4580787175222.html");
const [listing] = parseKotobukiyaShopListings(`
  <li class="tile_item normal">
    <a href="/shop/g/g4580787175222/" title="魔術王ソロモン">
      <img class="lazy" data-original="/img/goods/S/4580787175222_FGO_Solomon_eye.jpg">
      <div class="name">魔術王ソロモン</div>
    </a>
  </li>`, kotobukiyaKeywordUrl("マリオ"));
assert.deepEqual(kotobukiyaRecord({ ...listing, work: null }, parseKotobukiyaShopDetail(fgoPage, fgoUrl)), { skip: "not a Nintendo work (版権表記)" });
assert.deepEqual(kotobukiyaRecord({ ...listing, work: null }, { title: "x", spec_rows: [] }), { skip: "no 作品名 to tell the work by" }, "a keyword hit needs a work");
const armsDetail = { title: "x", spec_rows: [{ label: "作品名", value: "ARMS" }, { label: "版権表記", value: "©Nintendo" }] };
assert.equal(kotobukiyaRecord({ ...listing, work: null }, armsDetail).series.key, "nintendo_other", "©Nintendo decides when the work has no series");

const ninPage = fgoPage
  .replaceAll("Fate/Grand Order -終局特異点 冠位時間神殿ソロモン-", "ゼノブレイド2")
  .replace("&#169;TYPE-MOON / FGO7 ANIME PROJECT", "&#169;2017 Nintendo / MONOLITHSOFT");
const ninDetail = parseKotobukiyaShopDetail(ninPage, fgoUrl);
const kit = kotobukiyaRecord({ ...listing, work: null }, ninDetail);
assert.equal(kit.kit_id, "kotobukiya-nin-4580787175222");
assert.equal(kit.franchise, "nintendo");
assert.equal(kit.grade_code, "NIN_SCALE");
assert.equal(kit.series.key, "nintendo_xenoblade");
assert.equal(kit.work_title, "Xenoblade", "the work the channel's records use (series label, English)");
assert.equal(kit.universe, "Nintendo");
assert.equal(kit.jan, "4580787175222");
assert.equal(kit.price_jpy, 38500);
assert.equal(kit.scale, "1/7");
assert.deepEqual(kit.source_urls, [fgoUrl, "https://www.kotobukiya.co.jp/product/detail/p4580787175222/"]);
assert.equal(kit.gallery_image_urls.length, 9);
// A record read once is rebuilt the same from what it stored (no goods page the next day).
assert.deepEqual(kotobukiyaRecord({ ...listing, work: null }, kotobukiyaStoredDetail(kit)), kit);

// --- Sold-out kits from data/nintendo/kotobukiya-manual.json: the Siren the owner asked for.
const manual = JSON.parse(fixture("../../data/nintendo/kotobukiya-manual.json")).products;
const manualKits = manual.map(kotobukiyaManualRecord);
const siren = manualKits.find((record) => record.jan === "4934054045389");
assert.equal(siren.kit_id, "kotobukiya-nin-4934054045389");
assert.equal(siren.names.ja, "セイレーン");
assert.equal(siren.names.en, "Siren");
assert.equal(siren.number, "KP349R");
assert.equal(siren.grade_code, "NIN_PLAMO");
assert.equal(siren.price_jpy, 13200);
assert.equal(siren.release_date, "2025-05");
assert.equal(siren.series.key, "nintendo_xenoblade");
assert.deepEqual(siren.source_urls, ["https://www.kotobukiya.co.jp/product/detail/p4934054045389/"]);
assert.ok(manualKits.every((record) => record.series.key === "nintendo_xenoblade"));
// A shop listing of the same JAN takes the file's 品番 along.
const relisted = kotobukiyaRecord({ ...listing, product_id: "4934054045389", work: "ゼノブレイド2", title: "セイレーン" }, null, manual[0]);
assert.equal(relisted.kit_id, siren.kit_id);
assert.equal(relisted.number, "KP349R");
assert.equal(relisted.price_jpy, 13200);

// --- Good Smile: the work filter, the product page, the record.
const search = new URL(gscTitleSearchUrl(1218, 60));
assert.deepEqual(JSON.parse(search.searchParams.get("filter")).search_title, [1218]);
assert.equal(search.searchParams.get("offset"), "60");
const titleIds = GSC_TITLES.map(([id]) => id);
for (const notNintendo of [559, 1875, 271, 198, 1438, 2232]) assert.ok(!titleIds.includes(notNintendo), `title ${notNintendo} is not taken`);
assert.equal(new Set(titleIds).size, titleIds.length);

const cards = parseGscCards(fixture("gsc-nintendo-search.html")).map((card) => ({ ...card, work: "ゼノブレイド2" }));
assert.deepEqual(cards.map((card) => card.name), ["ニア", "ホムラ", "ヒカリ", "KOS-MOS Re:"]);
const page = fixture("gsc-nintendo-detail-ja.html");
const spec = parseGscSpec(page);
assert.deepEqual(spec, {
  work: "ゼノブレイド2",
  spec: "ABS&PVC 塗装済み完成品・1/7スケール・専用台座付属・全高：約210mm",
  copyright: "©2017 Nintendo / MONOLITHSOFT",
  category: "1/7スケールフィギュア",
  first_release: "2018-12",
  reissues: ["2021-06", "2022-09", "2022-10"],
});
const homura = gscRecord(cards[1], parseGscDetail(page, "4687"), { name: "Pyra" }, spec);
assert.equal(homura.kit_id, "goodsmile-nin-4687", "the id of the morning import stays");
assert.deepEqual([homura.names.ja, homura.names.en], ["ホムラ", "Pyra"]);
assert.deepEqual([homura.grade_code, homura.scale, homura.release_date, homura.price_jpy, homura.jan], ["NIN_SCALE", "1/7", "2018-12", 20166, "4580416940504"]);
assert.equal(homura.series.key, "nintendo_xenoblade");
assert.equal(homura.work_title, "Xenoblade");
assert.equal(homura.gallery_image_urls.length, 3);
assert.match(homura.notes, /Reissued 2021-06, 2022-09, 2022-10\./);
assert.deepEqual(gscRecord(cards[1], ...Object.values(gscStoredPages(homura))), homura, "stored pages rebuild the same record");
assert.equal(homura.category, undefined, "a figure is no goods");

// Goods carry category and goods_kind, also where the shared rules see a character good.
const goods = (productId, name) => gscRecord({ productId, name, work: "星のカービィ", price_jpy: 770 }, { name, images: ["https://www.goodsmile.com/g.jpg"] }, {}, { work: "星のカービィ", copyright: "© Nintendo / HAL Laboratory, Inc." });
const strap = goods("4243", "星のカービィ へんしんラバーストラップ ビームVer./ファイアVer./アイスVer./ソードVer./ドクターVer./スリープVer.");
assert.deepEqual([strap.grade_code, strap.category, strap.goods_kind], ["NIN_GOODS", "goods", "accessory"]);
assert.deepEqual(gscRecord({ productId: "4243", name: strap.names.ja, work: "星のカービィ", price_jpy: 770 }, ...Object.values(gscStoredPages(strap))), strap, "stored pages keep the kind");
assert.equal(goods("4244", "星のカービィ トートバッグ").goods_kind, "apparel");
assert.equal(makerGoodsKind("星のカービィ アクリルスタンド"), "acrylic");
assert.equal(makerGoodsKind("星のカービィ グッズセット"), "other");

// A reissue is the same product page renamed; the record keeps the first month and the product's name.
assert.equal(gscProductName("【三次再販】 figma サムス・アラン"), "figma サムス・アラン");
assert.equal(gscProductName("Rerelease [figma Link: Tears of the Kingdom ver. DX Edition]"), "figma Link: Tears of the Kingdom ver. DX Edition");
assert.equal(gscProductName("figma Samus Aran: DREAD ver."), "figma Samus Aran: DREAD ver.");
assert.equal(gscProductName("星のカービィ ACIMOV 靴下 black Ver./blue Ver.：星のカービィ ACIMOV 靴下 blue Ver."), "星のカービィ ACIMOV 靴下 black Ver./blue Ver.");
assert.equal(gscProductName("Kirby ACIMOV Socks (black Ver. / blue Ver.):星のカービィ ACIMOV 靴下 blue Ver."), "Kirby ACIMOV Socks (black Ver. / blue Ver.)");
const samusPage = `
  <dl class="b-outline-table__detail"><dt>作品名</dt><dd>METROID Other M</dd></dl>
  <dl class="b-outline-table__detail"><dt>関連情報</dt><dd>【販売：2012年06月】【三次再販：2026年01月】</dd></dl>
  <dl class="b-outline-table__detail"><dt></dt><dd>©2010 Nintendo Codeveloped by TECMO / Team NINJA</dd></dl>`;
const samusSpec = parseGscSpec(samusPage);
assert.deepEqual([samusSpec.first_release, samusSpec.reissues], ["2012-06", ["2026-01"]], "the history under 関連情報 (figma サムス・アラン, 2026-11-19)");
const samus = gscRecord({ productId: "1281", name: "【三次再販】 figma サムス・アラン", work: "METROID Other M", price_jpy: 9800 }, { name: "【三次再販】 figma サムス・アラン", images: ["https://www.goodsmile.com/a.jpg"] }, { name: "Rerelease [figma Samus Aran]" }, samusSpec);
assert.deepEqual([samus.names.ja, samus.names.en, samus.release_date, samus.series.key], ["figma サムス・アラン", "figma Samus Aran", "2012-06", "nintendo_metroid"]);
assert.match(samus.notes, /Reissued 2026-01\./);
assert.equal(samus.data_status, "verified", "like the rest of the 닌텐도 channel");

// パルテナの鏡 has no series of its own (nintendo_other, work_title "Other" after localize); the
// next day's rebuild from the stored record keeps it instead of dropping it as not Nintendo's.
const pitCard = { productId: "1623", name: "figma ピット", work: "パルテナの鏡", price_jpy: 3981 };
const pit = gscRecord(pitCard, { name: "figma ピット", images: ["https://www.goodsmile.com/p.jpg"] }, { name: "figma Pit" }, { work: "パルテナの鏡", copyright: "©Nintendo", first_release: "2013-04", reissues: [] });
assert.equal(pit.series.key, "nintendo_other");
assert.deepEqual(gscRecord(pitCard, ...Object.values(gscStoredPages({ ...pit, work_title: "Other" }))), pit);

// The Kotobukiya records of the first hobby import (kit_id from the official page URL) moved to
// kotobukiya-nin-<JAN>; saved likes and owned entries follow the alias.
const aliases = JSON.parse(fixture("../../data/kit-aliases.json")).aliases;
assert.equal(aliases["kotobukiya-nin-productdetailp4934054045389"], "kotobukiya-nin-4934054045389");
assert.equal(aliases["kotobukiya-nin-productdetailp4934054073962"], "kotobukiya-nin-4934054073962");

assert.deepEqual(gscWork(cards[0], { copyright: "©Pokémon. ©Nintendo/Creatures Inc./GAME FREAK inc." }), { skip: "Pokémon (pokemon channel)" });
assert.match(gscWork(cards[3], { copyright: "©BANDAI NAMCO Entertainment Inc.", work: "ゼノサーガ エピソードⅢ" }).skip, /not a Nintendo work/);
assert.equal(gscWork(cards[3], {}).series.key, "nintendo_xenoblade", "without a copyright line the work filter decides");

// --- Catalog: records keep their place and the names the name steps wrote.
const old = { kit_id: "goodsmile-nin-4687", names: { ja: "ホムラ", en: "Pyra", ko: "호무라", zh: "焰" }, extra: 1 };
const merged = mergeMakerRecords([{ kit_id: "a" }, old, { kit_id: "b" }], [homura, siren]);
assert.deepEqual(merged.map((record) => record.kit_id), ["a", "goodsmile-nin-4687", "b", "kotobukiya-nin-4934054045389"]);
assert.deepEqual([merged[1].names.ko, merged[1].names.zh, merged[1].extra], ["호무라", "焰", 1]);
const renamed = mergeMakerRecords([{ ...old, names: { ...old.names, ja: "Pyra" } }], [homura]);
assert.equal(renamed[0].names.ko, "ホムラ", "a new Japanese name drops the old translation");
assert.equal(findDuplicate([{ kit_id: "pokemon-x", franchise: "pokemon", jan: "4580416940504", names: { ja: "x" } }], homura)?.kit_id, "pokemon-x");
assert.equal(findDuplicate([{ kit_id: "goodsmile-nin-4687", jan: "4580416940504", names: { ja: "ホムラ" } }], homura), null, "itself is no duplicate");
// The capsule-machine run of a trading figure (own page, own JAN) is the same lineup.
const corocoroid = { kit_id: "goodsmile-nin-4801", franchise: "nintendo", subline: "Good Smile Company", grade_code: "NIN_MINI", jan: "4580590180857", names: { ja: "ころころいど カービィ トレーディングフィギュア" } };
const capsule = { kit_id: "goodsmile-nin-5099", franchise: "nintendo", subline: "Good Smile Company", grade_code: "NIN_MINI", jan: "4571368446701", names: { ja: "ころころいど カービィ" } };
assert.equal(findDuplicate([corocoroid], capsule)?.kit_id, "goodsmile-nin-4801");
assert.equal(findDuplicate([corocoroid], { ...capsule, names: { ja: "ころころいど カービィ02" } }), null, "the second lineup is another product");
// Saved before the rule: the capsule ids follow the trading-figure records.
assert.equal(aliases["goodsmile-nin-5099"], "goodsmile-nin-4801");
assert.equal(aliases["goodsmile-nin-5722"], "goodsmile-nin-5458");

console.log("nintendo makers tests OK");
