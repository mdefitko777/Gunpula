// Unit checks for the Korean Pokémon sources: the 포켓몬스토어 rules (lib/pokemon-store-kr.mjs),
// its restock events (lib/restocks.mjs) and the pokemonkorea.co.kr goods banners. Real answers
// saved on 2026-11-14 in scripts/fixtures/. No network.
//   node scripts/test_pokemon_korea.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { goodsKind } from "./lib/catalog-cleanup.mjs";
import { parsePokemonKoreaGoodsBanners, pokemonKoreaImageDate } from "./lib/official-announcements.mjs";
import { categoryIndex, mergeCatalog, productName, releaseDateFor, toKit } from "./lib/pokemon-store-kr.mjs";
import { eventsFromCatalogShift, koreanStoreRestocks } from "./lib/restocks.mjs";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const index = categoryIndex(JSON.parse(fixture("pokemon-store-kr-categories.json")));
const products = new Map(JSON.parse(fixture("pokemon-store-kr-products.json")).items.map((item) => [item.productNo, item]));
const kit = (no, previous) => toKit(products.get(no), index, previous);
const line = (no) => {
  const record = kit(no);
  return record && [record.grade_code, record.goods_kind || null];
};

// ── category tree: a product names only its deepest category ──
assert.deepEqual(index.get(846757), [488343, 846756, 846757], "패션 > 전국도감 메탈참 > 관동지방");
assert.deepEqual(index.get(488675), [488343, 488389, 488675], "패션 > 액세서리 > 아크릴참");

// ── left out: the card game and Nintendo ──
assert.equal(kit(136570884), null, "포켓몬 카드 게임 확장팩");
assert.equal(kit(131910389), null, "스타터 세트 under 카드 게임 > 구축덱");
assert.equal(kit(114166591), null, "Nintendo Switch");

// ── the three old categories keep their grades ──
assert.deepEqual(line(137702286), ["POKE_PLUSH", null], "봉제인형 category");
assert.equal(kit(137702286).subline, "봉제인형");
assert.deepEqual(line(136632498), ["POKE_GOODS", "media_audio"], "스토어 오리지널 OST album");
assert.deepEqual(line(136647510), ["POKE_FIGURE", null], "스토어 오리지널 「빗속의 고라파덕」 대형 피규어 was goods");

// ── plush / figures outside those categories, by name ──
assert.deepEqual(line(132360164), ["POKE_PLUSH", null], "Holiday Blessings 가디안, campaign category only");
assert.deepEqual(line(133826321), ["POKE_PLUSH", null], "마스코트 키링 with displayCategoryNos \"0\"");
assert.deepEqual(line(133772972), ["POKE_FIGURE", null], "클리어 피규어 Invisible to Me");
assert.deepEqual(line(114168621), ["POKE_GASHAPON", null], "캡슐토이 미니 백팩 (랜덤 상품)");

// ── goods: name rules first, then the shop's category ──
assert.deepEqual(line(137676452), ["POKE_GOODS", "stationery"], "A4 클리어파일 filed under 패션 > 키링");
assert.deepEqual(line(128831109), ["POKE_GOODS", "accessory"], "전국도감 메탈참 (only 관동지방 + campaigns listed)");
assert.deepEqual(line(118529118), ["POKE_GOODS", "acrylic"], "아크릴 콜렉션 in 아크릴참");
assert.deepEqual(line(132447647), ["POKE_GOODS", "apparel"], "봉제인형 가방 is a bag");
assert.deepEqual(line(133772964), ["POKE_GOODS", "stationery"], "포토카드 세트 is not a card game");
assert.deepEqual(line(133772969), ["POKE_GOODS", "household"], "아이스 트레이");
assert.deepEqual(line(137676459), ["POKE_GOODS", "stationery"], "스티커 세트 in 문구");
assert.equal(kit(137676459).subline, "문구");
assert.equal(kit(137676459).category, "goods");
assert.equal(kit(137702286).category, undefined, "plush is not goods");

// clean_catalog.mjs runs goodsKind on source_name every day: it agrees with the importer,
// and leaves a character name (인형, 키링) to the importer's kind.
for (const no of [137676452, 133772964, 133772969, 137676459]) {
  assert.equal(goodsKind(kit(no)), kit(no).goods_kind, `goodsKind agrees for ${no}`);
}
assert.equal(goodsKind(kit(132447647)), null, "봉제인형 가방: the character word leaves the kind to the importer");
// The Korean words match Korean names only.
assert.equal(goodsKind({ franchise: "lego", names: { ja: "Albus Dumbledore Metal Key Chain" } }), null);
assert.equal(goodsKind({ franchise: "lego", names: { ja: "Minecraft Trading Cards Series 1 - Sealed Box" } }), null);

// ── record fields ──
const wedding = kit(137702286);
assert.equal(wedding.kit_id, "pokemon-kr-137702286");
assert.equal(wedding.price_krw, 58000);
assert.equal(wedding.jan, "4521329419633");
assert.equal(wedding.release_date, "2026-11-11");
assert.deepEqual(wedding.pokemon_store_kr, { sale_start: "2026-11-11", sold_out: true });
assert.match(wedding.images.box_art_url, /^https:\/\/shopby-images\.cdn-nhncommerce\.com\/.+\.jpg$/);
assert.ok(wedding.gallery_image_urls.length > 1 && wedding.gallery_image_urls.length <= 6);
assert.equal(wedding.gallery_image_urls[0], wedding.images.box_art_url);
assert.equal(productName({ productName: "[구매권 추첨] Pikachu&apos;s Sweet  Delivery" }), "Pikachu's Sweet Delivery");

// ── release date: a relisting does not move it ──
// 봉제인형 브케인: listed 2024-01-16, sale start moved to 2026-11-12 22:00.
assert.equal(kit(116046339).release_date, "2024-01-16");
assert.equal(kit(116046339).pokemon_store_kr.sale_start, "2026-11-12");
assert.equal(releaseDateFor({ saleStartYmdt: "2026-11-11 12:00:00", registerYmdt: "2026-11-10 17:52:36" }), "2026-11-11");
assert.equal(releaseDateFor({ saleStartYmdt: "2025-09-17 00:00:00", registerYmdt: "2025-07-11 11:52:43" }), "2025-09-17", "68 days: listed ahead");
assert.equal(releaseDateFor({ saleStartYmdt: "2026-12-01 00:00:00", registerYmdt: "2026-11-30 10:00:00" }, "2025-03-14"), "2025-03-14", "never later than before");
assert.equal(releaseDateFor({ saleStartYmdt: null, registerYmdt: "2023-09-21 11:27:08" }), "2023-09-21");

// ── merge: a field the importer drops is removed, the rest of the record stays ──
const [merged] = mergeCatalog(
  [{ kit_id: "pokemon-kr-137702286", franchise: "pokemon", category: "goods", goods_kind: "other", search_zh: "x" }],
  [wedding],
);
assert.equal(merged.category, undefined);
assert.equal(merged.goods_kind, undefined);
assert.equal(merged.search_zh, "x");

// ── restocks: back on sale, or a sale start moved forward ──
const store = (sale_start, sold_out) => ({ kit_id: "pokemon-kr-1", names: { ko: "봉제인형 브케인" }, source_urls: ["u"], pokemon_store_kr: { sale_start, sold_out } });
assert.equal(koreanStoreRestocks(store("2024-01-16", true), store("2024-01-16", false), "2026-11-14").date, "2026-11-14", "sold out → on sale");
assert.deepEqual(
  (({ date, kind, previous_date }) => ({ date, kind, previous_date }))(koreanStoreRestocks(store("2024-01-16", false), store("2026-11-12", false), "2026-11-14")),
  { date: "2026-11-12", kind: "retail_resale", previous_date: "2024-01-16" },
);
assert.equal(koreanStoreRestocks(store("2026-11-11", false), store("2026-11-12", false), "2026-11-14"), null, "a day later is not a new sale");
assert.equal(koreanStoreRestocks(store("2024-01-16", true), store("2026-11-12", true), "2026-11-14"), null, "still sold out");
assert.equal(koreanStoreRestocks(undefined, store("2026-11-12", false), "2026-11-14"), null, "new product");
assert.equal(koreanStoreRestocks({ kit_id: "pokemon-kr-1" }, store("2026-11-12", false), "2026-11-14"), null, "first run with the field");
assert.deepEqual(
  eventsFromCatalogShift([store("2024-01-16", true)], [store("2024-01-16", false)], "2026-11-14").map((event) => [event.kit_id, event.source]),
  [["pokemon-kr-1", "catalog"]],
);

// ── pokemonkorea.co.kr goods banners ──
const banners = parsePokemonKoreaGoodsBanners(fixture("pokemonkorea-goods-banners.html"), { today: "2026-11-14" });
assert.equal(banners.slides, 7);
assert.deepEqual(
  banners.records.map((record) => [record.names.ko, record.announced_at, record.status]),
  [
    ["어서오세요! 포켓몬카페 피카 브이의 섞어 섞어 아라모드~ 반짝반짝 쿠킹!~ 출시!!", "2026-11-09", "released"],
    ["CU에서 포코피아 신상품을 만나보세요!!", "2026-09-30", "released"],
    ["Pokémon Pokopia 몬콜레 상품 출시!!", "2026-10-07", "released"],
    ["조립하는 즐거움! 레고® 포켓몬™", "2026-07-14", "product_confirmed"],
    ["FC서울×포켓몬 콜라보 상품 발매!", "2026-06-04", "released"],
    ["포켓몬 30주년 기념 상품 출시!!", "2026-02-27", "released"],
  ],
  "the Kakao emoticon banner is left out",
);
const cu = banners.records[1];
assert.equal(cu.franchise, "pokemon");
assert.equal(cu.source_id, "pokemon_korea_goods");
assert.equal(cu.source_url, "https://www.instagram.com/p/DdnaCB9k9zg/?stkn=MW0zZ2J1ZnRuZ3M2Mw==");
assert.match(cu.thumbnail_url, /^https:\/\/pokemonkorea\.co\.kr\/s3\.php\?key=/);
assert.equal(new Set(banners.records.map((record) => record.id)).size, banners.records.length, "titles that end alike keep their own ids");
assert.equal(pokemonKoreaImageDate("/s3.php?key=home%2Fdata%2Fdata1_www%2Fnewdata%2F2026%2F02%2F2026-02-27_10-11-02-18015.png"), "2026-02-27");
assert.equal(pokemonKoreaImageDate("/s3.php?key=home%2Fdata%2Fdata1_www%2Fpki-editor-webp%2F6b5d.webp"), null);
assert.equal(parsePokemonKoreaGoodsBanners("<html><body>점검 중</body></html>", { today: "2026-11-14" }).slides, 0);

console.log("pokemon korea tests passed");
