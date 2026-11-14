// 반다이남코코리아몰 and 아카데미과학 rules (lib/kr-pokemon-shops.mjs) on pages saved on 2026-11-14
// (scripts/fixtures/bnkr-*.html, academy-search-page.html), and the matching against catalog records.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  academyKind,
  academyReleaseDate,
  applyListings,
  bnkrKind,
  buildIndex,
  joinRecord,
  listingKey,
  matchAcademy,
  matchBnkr,
  moncolleParts,
  ownRecord,
  parseAcademyList,
  parseBnkrDetail,
  parseBnkrList,
  pokeplaKey,
  recordJan,
} from "./lib/kr-pokemon-shops.mjs";
import { THUMB_RULES, ruleThumb } from "./lib/thumbs.mjs";

const fixture = (name) => readFileSync(`scripts/fixtures/${name}`, "utf8");

// --- BNKR pages.
const bnkr = parseBnkrList(fixture("bnkr-search-page.html"));
assert.equal(bnkr.pages, 7);
const quick29 = bnkr.products.find((product) => product.gno === "8786335");
assert.deepEqual(quick29, {
  gno: "8786335",
  name: "포켓프라 컬렉션 QUICK!! 29 불꽃숭이",
  series: "포켓몬스터",
  price: 9400,
  image: "https://cdn.bnkrmall.co.kr/live/data/base/goods/middle/20261030/e7c19bd2b70447db9c61b4e2256e742e.jpg",
  listed: "2026-10-30",
});
assert.ok(bnkr.products.some((product) => product.name.includes("&") && !product.name.includes("&amp;")), "names decoded");
const detail = parseBnkrDetail(fixture("bnkr-detail-8786335.html"));
assert.deepEqual(detail, {
  jan: "4573102742957",
  maker: "BANDAI J",
  image: "https://cdn.bnkrmall.co.kr/live/data/base/goods/big/20261030/b246137048bf41d68dc1009fd07865d8.jpg",
});
assert.equal(ruleThumb(detail.image), `${detail.image}?resize=400&format=webp`, "the mall's CDN makes the thumbnail");
assert.ok(THUMB_RULES.length >= 2);

const kind = (name, series = "포켓몬스터") => bnkrKind({ name, series });
assert.deepEqual(kind("포켓프라 컬렉션 QUICK!! 29 불꽃숭이"), { grade: "POKEPLA", subline: "포켓프라" });
assert.deepEqual(kind("프라코로 탐험 박스 02 [단품]"), { grade: "POKEPLA", subline: "프라코로" });
assert.deepEqual(kind("나노블럭 포켓몬스터 꾸왁스", "나노블럭 시리즈"), { grade: "POKE_FIGURE", subline: "나노블럭" });
assert.equal(kind("(세트)깜짝에그 시리즈 포켓몬 스칼렛&바이올렛 피규어 콜렉션2(05입)"), null, "a box of five is the single product again");
assert.equal(kind("포켓몬 런 (6개입 박스)"), null);

// --- Pokepla keys: line and number, whatever the shop calls the line.
assert.equal(pokeplaKey("포켓프라 컬렉션 QUICK!! 29 불꽃숭이"), "quick-29");
assert.equal(pokeplaKey("포켓몬 프라모 컬렉션 퀵!! 29 불꽃숭이"), "quick-29");
assert.equal(pokeplaKey("포켓프라 콜렉션 QUICK!! 05 염버니 [KR]"), "quick-05");
assert.equal(pokeplaKey("포켓프라 No.62 가이오가"), "no-62");
assert.equal(pokeplaKey("포켓몬 프라모 컬렉션 62 셀렉트 시리즈 가이오가"), "no-62");
assert.equal(pokeplaKey("포켓프라 화석 포켓몬 시리즈 견고라스"), pokeplaKey("포켓몬 프라모 컬렉션 화석 포켓몬 시리즈 견고라스"));
assert.equal(pokeplaKey("포켓몬 프라모 컬렉션 No.36+No.38 셀렉트 시리즈 메가리자몽 X VS 메가리자몽 Y"), null, "a set of two kits has no single number");

// --- Matching against the catalog.
const catalog = [
  { kit_id: "pokepla-01-7148", franchise: "pokemon", grade_code: "POKEPLA", names: { ko: "포켓몬 프라모 컬렉션 퀵!! 29 불꽃숭이" }, source_urls: ["https://www.bandaispirits.co.jp/products/search/detail.php?prd_id=4573102742957000&grp_id=5325"], source_refs: [{ source_id: "bandai_spirits_pokepla_jp" }] },
  { kit_id: "pokepla-01-7038", franchise: "pokemon", grade_code: "POKEPLA", names: { ko: "포켓몬 프라모 컬렉션 62 셀렉트 시리즈 가이오가" }, source_refs: [] },
  { kit_id: "pokepla-jp-4573102720214", franchise: "pokemon", grade_code: "POKEPLA", names: { ko: "포켓몬 프라모 컬렉션 화석 포켓몬 시리즈 견고라스" }, source_refs: [] },
  { kit_id: "moncolle-y", franchise: "pokemon", grade_code: "POKE_MONCOLLE", number: null, names: { ko: "메가라이츄Y" }, source_refs: [] },
  { kit_id: "moncolle-ms-26", franchise: "pokemon", grade_code: "POKE_MONCOLLE", number: "MS-26", names: { ko: "팬텀" }, source_refs: [] },
  { kit_id: "moncolle-ml-20", franchise: "pokemon", grade_code: "POKE_MONCOLLE", number: "ML-20", names: { ko: "뮤츠" }, source_refs: [] },
  { kit_id: "moncolle-ms-01", franchise: "pokemon", grade_code: "POKE_MONCOLLE", number: "MS-01", names: { ko: "피카츄" }, source_refs: [] },
  { kit_id: "moncolle-mc-0", franchise: "pokemon", grade_code: "POKE_MONCOLLE", number: null, names: { ko: "피카츄" }, source_refs: [] },
  { kit_id: "pokemon-kr-1", franchise: "pokemon", grade_code: "POKE_PLUSH", jan: "4521329000001", names: { ko: "피카츄 인형" }, price_krw: 30000, source_refs: [{ source_id: "pokemon_store_kr", fields: ["price_krw"] }] },
  { kit_id: "bnkr-5", franchise: "pokemon", grade_code: "POKEPLA", names: { ko: "포켓프라 컬렉션 QUICK!! 29 불꽃숭이" }, source_refs: [] },
];
const index = buildIndex(catalog);
assert.equal(matchBnkr(index, quick29, null).kit.kit_id, "pokepla-01-7148", "by line and number; the shop's own records are never candidates");
assert.equal(matchBnkr(index, { name: "포켓프라 No.62 가이오가" }, null).kit.kit_id, "pokepla-01-7038");
assert.equal(matchBnkr(index, { name: "포켓프라 화석 포켓몬 시리즈 견고라스" }, null).kit.kit_id, "pokepla-jp-4573102720214");
assert.equal(matchBnkr(index, { name: "나노블럭 피카츄" }, "4521329000001").by, "jan");
assert.equal(matchBnkr(index, { name: "포켓프라 No.11 엔테이" }, null), null);
assert.equal(listingKey({ name: "포켓프라 컬렉션 QUICK!! 17 꼬부기 [KR]" }, "4570000000001"), listingKey({ name: "포켓프라 컬렉션 QUICK!! 17 꼬부기" }, "4573102662910"), "the Korean edition is the same product");

// --- Academy.
const academy = parseAcademyList(fixture("academy-search-page.html")).products;
const byNo = (no) => academy.find((product) => product.productNo === no);
assert.deepEqual(byNo("2179"), {
  productNo: "2179",
  code: "S26061",
  name: "몬콜레 MM 메가라이츄Y",
  price: 14000,
  soldOut: false,
  image: "https://academy.co.kr/web/product/medium/202610/6dcb4f9846225f2db8a5321cc1135a70.jpg",
  url: "https://academy.co.kr/product/detail.html?product_no=2179",
});
assert.deepEqual(moncolleParts("몬콜레 MS-50 님피아"), { size: "MS", name: "님피아" });
assert.deepEqual(moncolleParts("포코피아 몬콜레 MS 메타몽(망나뇽 변신)"), { size: "MS", name: "메타몽망나뇽변신" });
assert.equal(matchAcademy(index, byNo("2179")).kit.kit_id, "moncolle-y", "MM 메가라이츄Y: the catalog record says no size");
assert.equal(matchAcademy(index, byNo("2158")).kit.kit_id, "moncolle-ms-26");
assert.equal(matchAcademy(index, byNo("2078")).kit.kit_id, "moncolle-ml-20", "an old S81… code still matches by name");
assert.equal(matchAcademy(index, { name: "몬콜레 MS 피카츄" }), null, "피카츄 fits two records: never merged");
assert.equal(matchAcademy(index, byNo("1526")), null, "sets stay records of their own");
// Academy's old EX labels on the MS / ML figures (2026-11-14: 57 such listings had records of their own).
assert.deepEqual(matchAcademy(index, { name: "EMC시리즈 팬텀" }), { kit: catalog[4], by: "moncolle-legacy" }, "EMC is MS");
assert.equal(matchAcademy(index, { name: "EHP시리즈 뮤츠" }).kit.kit_id, "moncolle-ml-20", "EHP is ML");
assert.equal(matchAcademy(index, { name: "EHP시리즈 팬텀" }), null, "EHP is not MS: the big figure is another product");
assert.equal(matchAcademy(index, { name: "ESP시리즈 팬텀" }), null, "ESP fits only a record without a size");
assert.equal(matchAcademy(index, { name: "ESP시리즈 메가라이츄Y" }).kit.kit_id, "moncolle-y");
assert.equal(matchAcademy(index, byNo("957")), null, "EMC시리즈 파이리: no record");
assert.equal(matchAcademy(index, byNo("2158")).by, "moncolle");
assert.deepEqual(academyKind(byNo("2179")), { grade: "POKE_MONCOLLE", subline: "몬콜레" });
assert.deepEqual(academyKind(byNo("957")), { grade: "POKE_MONCOLLE", subline: "몬콜레" }, "EMC시리즈 is the old MonColle line");
assert.deepEqual(academyKind(byNo("2170")), { grade: "POKE_PLUSH", subline: "포켓피스" });
assert.deepEqual(academyKind(byNo("2182")), { grade: "POKE_FIGURE", subline: "말랑콕콕" });
assert.equal(academyReleaseDate(byNo("2179")), "2026-10");
assert.equal(academyReleaseDate({ code: "S25086", image: "https://academy.co.kr/web/product/medium/202601/a.jpg" }), "2025", "a picture of another year: the year only");
assert.equal(academyReleaseDate(byNo("957")), null, "S81…: the old numbering has no year");

// --- Joining a record: never a new kit_id; the 포켓몬스토어 price wins.
{
  const joined = joinRecord(catalog[0], { sourceId: "bnkrmall_kr", url: "https://www.bnkrmall.co.kr/goods/detail.do?gno=8786335", price: 9400, jan: "4573102742957", name: "포켓프라 컬렉션 QUICK!! 29 불꽃숭이" });
  assert.equal(joined.kit_id, "pokepla-01-7148");
  assert.deepEqual([joined.price_krw, joined.jan, joined.names.ko], [9400, "4573102742957", "포켓몬 프라모 컬렉션 퀵!! 29 불꽃숭이"]);
  assert.deepEqual(joined.source_refs.at(-1), { source_id: "bnkrmall_kr", url: "https://www.bnkrmall.co.kr/goods/detail.do?gno=8786335", fields: ["price_krw", "jan"], confidence: "high" });
  assert.equal(joinRecord(joined, { sourceId: "bnkrmall_kr", url: joined.source_refs.at(-1).url, price: 9900 }).source_refs.length, joined.source_refs.length, "a second run replaces its reference");
  assert.equal(joinRecord(catalog[8], { sourceId: "bnkrmall_kr", url: "u", price: 25000 }).price_krw, 30000);
}

// --- The record's own JAN stays in jan; the Korean edition's other JAN goes to jan_kr.
{
  assert.equal(recordJan(catalog[0]), "4573102742957", "from the product page URL (prd_id=<JAN>000)");
  assert.equal(recordJan({ kit_id: "pokepla-jp-4549660144823" }), "4549660144823");
  assert.equal(recordJan({ kit_id: "x", jan: "4549660144824" }), null, "a bad check digit is no JAN");
  const old = { kit_id: "pokepla-jp-4549660144823", franchise: "pokemon", grade_code: "POKEPLA", names: { ko: "피카츄" }, source_refs: [{ source_id: "bandai_spirits_pokepla_jp" }] };
  const join = { sourceId: "bnkrmall_kr", url: "https://www.bnkrmall.co.kr/goods/detail.do?gno=1", price: 9400, jan: "4573102558961" };
  const joined = joinRecord(old, join);
  assert.deepEqual([joined.jan, joined.jan_kr], [undefined, "4573102558961"]);
  assert.deepEqual(joined.source_refs.at(-1).fields, ["price_krw", "jan_kr"]);
  // What the first run wrote (jan = the Korean JAN, "jan" in its reference) is moved on the next run.
  const firstRun = { ...old, jan: "4573102558961", source_refs: [...old.source_refs, { source_id: "bnkrmall_kr", url: join.url, fields: ["price_krw", "jan"], confidence: "high" }] };
  for (const again of [joinRecord(firstRun, join), joinRecord(firstRun, { ...join, jan: null })]) {
    assert.deepEqual([again.jan, again.jan_kr, again.source_refs.length], [undefined, "4573102558961", 2]);
  }
  const index = buildIndex([joined]);
  assert.equal(matchBnkr(index, { name: "나노블럭 피카츄" }, "4573102558961").kit.kit_id, old.kit_id, "jan_kr still matches the listing");
  assert.equal(matchBnkr(index, { name: "나노블럭 피카츄" }, "4549660144823").kit.kit_id, old.kit_id);
  const same = joinRecord({ ...firstRun, kit_id: "pokepla-01-7148", jan: "4573102742957", source_urls: catalog[0].source_urls }, { ...join, jan: "4573102742957" });
  assert.deepEqual([same.jan, same.jan_kr], ["4573102742957", undefined], "the same JAN stays in jan");
}

// --- A product with a record of its own that the catalog later has moves there, with an alias.
{
  const own = ownRecord({ kitId: "bnkr-5", sourceId: "bnkrmall_kr", kind: { grade: "POKEPLA", subline: "포켓프라" }, name: "x", image: null, releaseDate: "2026-10", price: 9400, jan: null, url: "u", tags: [], notes: "" });
  assert.deepEqual([own.franchise, own.price_krw, own.price_jpy, own.release_date, own.series.key], ["pokemon", 9400, null, "2026-10", "pokemon"]);
  const result = applyListings(catalog, [
    { ownId: "bnkr-5", match: catalog[0], join: { sourceId: "bnkrmall_kr", url: "u", price: 9400 }, record: own },
    { ownId: "bnkr-6", match: null, join: null, record: { ...own, kit_id: "bnkr-6" } },
    { ownId: "bnkr-7", match: null, join: null, record: { ...own, kit_id: "bnkr-7" } },
  ], { retired: new Set(["bnkr-7"]) });
  assert.deepEqual(result.aliases, { "bnkr-5": "pokepla-01-7148" });
  const ids = new Set(result.kits.map((kit) => kit.kit_id));
  assert.ok(!ids.has("bnkr-5") && ids.has("bnkr-6") && !ids.has("bnkr-7"));
  assert.deepEqual([result.joined, result.own], [1, 1]);
}

// --- Two listings for one record: the single strong match joins it, otherwise none does.
{
  const own = (id) => ownRecord({ kitId: id, sourceId: "academy_kr", kind: { grade: "POKE_MONCOLLE", subline: "몬콜레" }, name: id, image: null, releaseDate: null, price: 9000, jan: null, url: id, tags: [], notes: "" });
  const entry = (id, match, weak) => ({ ownId: id, match, weak, join: { sourceId: "academy_kr", url: id, price: 9000 }, record: own(id) });
  const result = applyListings(catalog, [
    entry("academy-2158", catalog[4], false), // 몬콜레 MS 팬텀
    entry("academy-982", catalog[4], true), // EMC시리즈 팬텀
    entry("academy-981", catalog[6], true), // EMC시리즈 피카츄 (S81336)
    entry("academy-988", catalog[6], true), // EMC시리즈 피카츄 (S81329)
    entry("academy-1093", catalog[5], true), // EHP시리즈 뮤츠, the only listing of ML-20
  ]);
  const ids = new Set(result.kits.map((kit) => kit.kit_id));
  assert.deepEqual([...ids].filter((id) => id.startsWith("academy-")).sort(), ["academy-981", "academy-982", "academy-988"]);
  assert.deepEqual(result.kits.find((kit) => kit.kit_id === "moncolle-ms-26").source_refs.map((ref) => ref.url), ["academy-2158"]);
  assert.equal(result.kits.find((kit) => kit.kit_id === "moncolle-ms-01").source_refs.length, 0, "피카츄 listed twice: neither joins");
  assert.ok(result.kits.find((kit) => kit.kit_id === "moncolle-ml-20").source_refs.some((ref) => ref.url === "academy-1093"));
  assert.deepEqual([result.joined, result.own], [2, 3]);
}

console.log("test_kr_pokemon_shops: ok");
