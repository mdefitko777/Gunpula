// The 닌텐도 channel rules (lib/nintendo-kr.mjs) on pages saved from store.nintendo.co.kr and
// www.nintendo.com/kr on 2026-11-14 (scripts/fixtures/nintendo-*.html, trimmed to a few cards).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NINTENDO_PRODUCT_LINES } from "./lib/catalog-cleanup.mjs";
import {
  buildRecords,
  classifyStoreProduct,
  parseAmiiboLineup,
  parseNintendoNews,
  parseSchedule,
  parseStoreDetail,
  parseStoreList,
  platformOf,
  seriesFor,
  splitName,
  titleKey,
} from "./lib/nintendo-kr.mjs";

const fixture = (name) => readFileSync(`scripts/fixtures/${name}`, "utf8");

// --- Store lists.
const physical = parseStoreList(fixture("nintendo-store-physical.html"));
const digital = parseStoreList(fixture("nintendo-store-digital.html"));
const byId = (list, id) => list.find((product) => product.entityId === id);
assert.equal(physical.length, 15);
assert.deepEqual(byId(physical, "18132"), {
  entityId: "18132",
  url: "https://store.nintendo.co.kr/nsj8a7abfkor",
  slug: "nsj8a7abfkor",
  name: "키홀더 론론 우유 젤다의 전설",
  price: 19000,
  image: byId(physical, "18132").image,
});
assert.match(byId(physical, "18132").image, /^https:\/\/store\.nintendo\.co\.kr\/media\/catalog\/product\/cache\//);
assert.equal(byId(physical, "12516").price, null, "platinum-point goods have no won price");
assert.equal(byId(digital, "17638").slug, "70010000135073", "download products are listed under their nsuid");

// --- What is kept, and as what.
const grade = (list, id) => classifyStoreProduct(byId(list, id));
assert.deepEqual(grade(physical, "14917"), { grade: "NIN_GAME" }, "hacp…: packaged game");
assert.deepEqual(grade(physical, "17515"), { grade: "NIN_GAME" }, "beep…: a Switch 2 package (Switch Sports Resort)");
assert.deepEqual(grade(physical, "17785"), { grade: "NIN_HW" });
assert.deepEqual(grade(physical, "3816"), { grade: "NIN_HW" }, "5002…: Nintendo Switch Online controllers are hardware, not a service");
assert.deepEqual(grade(physical, "18132"), { grade: "NIN_GOODS" });
assert.deepEqual(grade(physical, "18319"), { grade: "NIN_GOODS" }, "a lottery for the ocarina is the ocarina");
assert.deepEqual(grade(physical, "17392"), { skip: "spare part" }, "(벌크 제품)");
assert.deepEqual(grade(physical, "17373"), { skip: "dlc or bundle" }, "an expansion pass alone");
assert.deepEqual(grade(physical, "15359"), { skip: "dlc or bundle" }, "hacj…: DLC in a box");
assert.deepEqual(grade(physical, "2023"), { skip: "service" }, "a promotion page");
assert.deepEqual(grade(digital, "17638"), { grade: "NIN_GAME" });
assert.deepEqual(grade(digital, "16727"), { skip: "dlc or bundle" }, "7005: upgrade pass");
assert.deepEqual(grade(digital, "17982"), { skip: "dlc or bundle" }, "7007: game + pass bundle");
assert.deepEqual(grade(digital, "541"), { skip: "service" }, "7008: Nintendo Switch Online");
assert.deepEqual(grade(digital, "880"), { skip: "service" }, "3000…: prepaid number");
assert.deepEqual(grade(digital, "15758"), { skip: "service" }, "Nintendo Classics apps");

assert.equal(platformOf("beeapssabkor", "Nintendo Switch 2 휴대용 케이스"), "switch2");
assert.equal(platformOf("hacpbgw5akor", "메트로이드 프라임 4 비욘드"), "switch");
assert.equal(platformOf("", "메트로이드 래버너스", "switch2"), "switch2", "the schedule's hardware for a download product");
assert.deepEqual(splitName("Super Mario Bros. Wonder(슈퍼 마리오브라더스 원더)"), { ko: "슈퍼 마리오브라더스 원더", en: "Super Mario Bros. Wonder" });
assert.deepEqual(
  splitName("Nintendo Switch 2 휴대용 케이스 젤다의 전설 40주년 애니버서리 에디션 (화면 보호 필름 포함)").en,
  null,
  "a note in brackets is not a Korean title",
);
assert.equal(splitName("[추첨 판매 응모] 시간의 오카리나 젤다의 전설 [12/17(목) 당첨 발표]").ko, "시간의 오카리나 젤다의 전설");
assert.equal(titleKey("「Pokémon Champions」 + 스타터 팩"), titleKey("Pokémon Champions+스타터 팩"));

// --- Series: the first world named wins.
assert.equal(seriesFor("amiibo 링크 (슈퍼 스매시브라더스 시리즈)").key, "nintendo_smash");
assert.equal(seriesFor("요시와 신기한 도감").key, "nintendo_yoshi");
assert.equal(seriesFor("Pokémon LEGENDS Z-A".normalize("NFD")).key, "nintendo_pokemon", "a decomposed é still reads as Pokémon");
assert.equal(seriesFor("닌텐도 사운드 클록 Alarmo").key, "nintendo_other");

// --- Product page, schedule, amiibo.
assert.deepEqual(parseStoreDetail(fixture("nintendo-store-detail.html")), {
  releaseDate: "2025-12-04",
  maker: "Nintendo",
  sku: "5003660",
  images: ["https://store.nintendo.co.kr/media/catalog/product/cache/69fca11704444074de0ecc4f2e43f422/_/-/_-_-4-_.jpg"],
});
const schedule = parseSchedule(fixture("nintendo-kr-schedule.html"));
const kirby = schedule.find((item) => item.title === "별의 커비 월드 비욘드");
assert.equal(schedule.length, 5);
assert.deepEqual([kirby.releaseDate, kirby.nsuid, kirby.platform, kirby.publisher], ["2027", "70010000135067", "switch2", "한국닌텐도"], "\"2027 봄\" is the year");
assert.equal(schedule.find((item) => item.title === "메트로이드 래버너스").releaseDate, "2027-01-28");
assert.equal(schedule.find((item) => item.title === "Xenoblade Genesis").nsuid, null, "nsuid 0 is none");
const amiibo = parseAmiiboLineup(fixture("nintendo-kr-amiibo.html"));
assert.deepEqual(amiibo.map((item) => [item.id, item.name, item.series, item.releaseDate]), [
  ["350", "소라", "슈퍼 스매시브라더스 시리즈", "2024-02-16"],
  ["349", "노아", "제노블레이드 시리즈", "2024-01-19"],
  ["348", "미오", "제노블레이드 시리즈", "2024-01-19"],
]);

// --- Records.
const details = {
  14917: { releaseDate: "2025-12-04", maker: "Nintendo", images: ["https://store.nintendo.co.kr/media/a.jpg"] },
  17515: { releaseDate: "2026-07-23", maker: "Nintendo", images: [] },
  17720: { releaseDate: "2026-03-05", maker: "Mojang", images: [] },
  11818: { releaseDate: "2023-10-20", maker: "Nintendo", images: [] },
  17638: { releaseDate: "2027-01-28", maker: "Nintendo", images: [] },
  18128: { releaseDate: "2026-10-29", maker: "Nintendo", images: [] },
  18127: { releaseDate: "2026-10-29", maker: "Nintendo", images: [] },
};
const metroidDownload = { entityId: "14916", url: "https://store.nintendo.co.kr/70010000099997", slug: "70010000099997", name: "메트로이드 프라임 4 비욘드", price: 74800, image: null };
details[14916] = { releaseDate: "2025-12-04", maker: "Nintendo", images: ["https://store.nintendo.co.kr/media/b.jpg"] };
const built = buildRecords({ physical, digital: [...digital, metroidDownload], details, schedule, amiibo });
const record = (id) => built.records.find((kit) => kit.kit_id === id);
const metroid = record("nintendo-kr-14917");
assert.equal(metroid.grade_code, "NIN_GAME");
assert.deepEqual(metroid.nintendo_kr, { platform: "switch", formats: ["package", "download"], nsuid: "70010000099997", code: "hacpbgw5akor" }, "package and download version are one record");
assert.equal(built.records.filter((kit) => kit.names.ko === "메트로이드 프라임 4 비욘드").length, 1);
assert.deepEqual([metroid.release_date, metroid.price_krw, metroid.price_jpy, metroid.series.key, metroid.work_title], ["2025-12-04", 74800, null, "nintendo_metroid", "Metroid"]);
assert.deepEqual(metroid.gallery_image_urls, ["https://store.nintendo.co.kr/media/a.jpg", "https://store.nintendo.co.kr/media/b.jpg"]);
assert.equal(record("nintendo-kr-17720"), undefined, "Minecraft (another publisher's package) is left out");
assert.equal(built.skipped["other publisher"], 1);
assert.deepEqual(built.pending.sort(), ["17640"], "a game whose page is not read yet waits");
assert.deepEqual([record("nintendo-kr-11818").names.ko, record("nintendo-kr-11818").names.en], ["슈퍼 마리오브라더스 원더", "Super Mario Bros. Wonder"]);
const shirts = built.records.filter((kit) => kit.names.ko.startsWith("긴팔T셔츠"));
assert.deepEqual(shirts.map((kit) => [kit.kit_id, kit.names.ko]), [["nintendo-kr-18127", "긴팔T셔츠 젤다의 전설 티어스 오브 더 킹덤"]], "one record per shirt, not per size");
const keyholder = record("nintendo-kr-18132");
assert.deepEqual([keyholder.grade_code, keyholder.category, keyholder.goods_kind, keyholder.subline], ["NIN_GOODS", "goods", "accessory", "닌텐도 스토어"]);
const points = record("nintendo-kr-12516");
assert.deepEqual([points.subline, points.price_krw, points.nintendo_kr.points], ["마이 닌텐도 플래티넘 포인트", null, true]);
const caseRecord = record("nintendo-kr-17785");
assert.deepEqual([caseRecord.grade_code, caseRecord.subline, caseRecord.category], ["NIN_HW", "Nintendo Switch 2", undefined]);
assert.ok(NINTENDO_PRODUCT_LINES.has(caseRecord.grade_code), "clean_catalog never turns a console case into household goods");
// The schedule: a store product gets nothing new; an announced game not in the store gets a record.
assert.equal(record("nintendo-kr-17638").nintendo_kr.platform, "switch2", "the schedule says Switch 2");
const kirbyRecord = record("nintendo-kr-ns-70010000135067");
assert.deepEqual([kirbyRecord.release_date, kirbyRecord.source_refs[0].source_id, kirbyRecord.series.key], ["2027", "nintendo_kr", "nintendo_kirby"]);
assert.ok(built.records.some((kit) => /^nintendo-kr-sch-[0-9a-f]{10}$/.test(kit.kit_id) && kit.names.ko === "Xenoblade Genesis"));
assert.equal(built.records.some((kit) => kit.names.ko === "Industria"), false, "other publishers' schedule items are left out");
assert.equal(record("nintendo-kr-amiibo-350").names.ko, "amiibo 소라 (슈퍼 스매시브라더스 시리즈)");
for (const kit of built.records) {
  assert.equal(kit.franchise, "nintendo");
  assert.ok(["NIN_GAME", "NIN_HW", "NIN_AMIIBO", "NIN_GOODS"].includes(kit.grade_code), kit.kit_id);
  assert.match(kit.kit_id, /^[a-z0-9]+[a-z0-9-]*$/);
}

// Ids stay: an announced game later sold in the store keeps the id it was published with.
{
  const later = buildRecords({
    digital: [{ entityId: "18500", url: "https://store.nintendo.co.kr/70010000135067", slug: "70010000135067", name: "별의 커비 월드 비욘드", price: 74800, image: null }],
    details: { 18500: { releaseDate: "2027-04-01", maker: "Nintendo", images: [] } },
    previous: [kirbyRecord],
  });
  assert.deepEqual(later.records.map((kit) => kit.kit_id), ["nintendo-kr-ns-70010000135067"]);
  assert.equal(later.records[0].release_date, "2027-04-01");
}

// --- News: product posts only, and only Nintendo's.
const news = parseNintendoNews(fixture("nintendo-kr-news.html"));
assert.deepEqual(news.map((item) => [item.announced_at, item.status]), [
  ["2026-11-12", "released"],
  ["2026-11-12", "product_confirmed"],
  ["2026-11-05", "released"],
]);
assert.ok(news.every((item) => item.franchise === "nintendo" && item.source_id === "nintendo_kr_news" && item.names.ko === item.names.ja));
assert.match(news[0].thumbnail_url, /^https:\/\/images\.ctfassets\.net\/.*\?w=400&fm=webp$/, "&amp; decoded");
assert.equal(news.some((item) => /피크민 in 잠실|판매량/.test(item.names.ko)), false, "events and sales milestones are not products");

console.log("test_nintendo_korea: ok");
