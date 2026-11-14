// Rules behind scripts/import_pokemon_korea.mjs (the official 포켓몬스토어, pokemonstore.co.kr):
// which shop products become records, their grade, goods_kind and release date. Pure
// functions over the shop API's product objects, so scripts/test_pokemon_korea.mjs can
// run them on saved answers.
//
// Until 2026-11-14 only three categories were read (봉제인형, 피규어, 스토어 오리지널). The
// whole-store search also finds the goods (문구, 리빙, 패션) and the ~350 products listed only
// under campaign categories (NEW ARRIVAL, BEST …) or under none at all (displayCategoryNos
// "0"): about 220 plush and 14 figures were among them.
import { goodsKind, goodsRuleKind } from "./catalog-cleanup.mjs";
import { decodeEntities } from "./html-entities.mjs";
import { deadImage, httpsImageUrl } from "./thumbs.mjs";

export const SOURCE_ID = "pokemon_store_kr";
export const STORE = "https://pokemonstore.co.kr";

// Top categories (depth 1) of the shop's category tree, GET /categories, read 2026-11-14.
export const TOP = {
  ORIGINAL: 488329,
  NEW_ARRIVAL: 488333,
  BEST: 488331,
  PICKS: 1171704,
  PLUSH: 488335,
  FIGURE: 488337,
  CARD_GAME: 488339,
  STATIONERY: 488341,
  FASHION: 488343,
  LIVING: 488345,
  NINTENDO: 488347,
};

// The owner tracks character goods, not the trading card game or Nintendo hardware and
// software (no Pokémon card product is in the catalog from any source).
const EXCLUDED_TOPS = new Set([TOP.CARD_GAME, TOP.NINTENDO]);
const EXCLUDED_NAME = /포켓몬 카드 게임|확장팩|구축덱|스타트 ?덱|Nintendo Switch|닌텐도 스위치|익스팬션 패스|Pokémon GO Plus|몬스터볼 Plus/i;

// Categories that say what a goods product is, the first match wins (아크릴참 sits under
// 액세서리). The shop sometimes files a product in the wrong one ("A4 클리어파일 Pokopia"
// under 패션 > 키링), so the name rules in catalog-cleanup.mjs come first and these only
// fill in.
const SUBCATEGORY_KINDS = [
  [488675, "acrylic"], // 패션 > 액세서리 > 아크릴참
  [488389, "accessory"], // 패션 > 액세서리 (키링, 스트랩, 목걸이 …, 뱃지)
  [846756, "accessory"], // 패션 > 전국도감 메탈참
  [488385, "apparel"], // 패션 > 가방, 파우치, 지갑
  [488387, "apparel"], // 패션 > 의류
  [488391, "apparel"], // 패션 > 패션 잡화
  [1101461, "board_game"], // NEW ARRIVAL > 보드게임
  [TOP.STATIONERY, "stationery"],
  [TOP.LIVING, "household"],
];
const CAPSULE_TOY = 850690; // NEW ARRIVAL > 캡슐토이

const SUBLINES = {
  [TOP.PLUSH]: "봉제인형",
  [TOP.FIGURE]: "피규어",
  [TOP.ORIGINAL]: "포켓몬 스토어 오리지널",
  [TOP.STATIONERY]: "문구",
  [TOP.LIVING]: "리빙",
  [TOP.FASHION]: "패션",
};

// Plush and figures outside the 봉제인형 / 피규어 categories ("Holiday Blessings 가디안
// 봉제인형", "POKEMON DOLLS 피카츄", "클리어 피규어 Invisible to Me"); a plush pouch, case or
// bag is a bag.
const PLUSH_NAME = /봉제인형|마스코트|손가락인형|손인형|니트인형|POKEMON DOLLS|MOFUGUTTO|모푸굿토/i;
const NOT_PLUSH = /파우치|케이스|가방|백팩|쿠션/;
const FIGURE_NAME = /피규어|디오라마|프라모델|포켓프라|드림토미카/;
const NOT_FIGURE = /키링|키홀더|스탠드/;

// Character-goods words: catalog-cleanup's goodsKind leaves these to the importer, as a
// Japanese キーホルダー sold next to plush is a collectible. The Korean shop files them
// under 패션 > 액세서리, so they are goods here.
const CHARACTER_KINDS = [
  ["acrylic", /아크릴/],
  ["accessory", /키링|키 ?홀더|키체인|열쇠 케이스|뱃지|배지|메탈참|백참|(?:^|\s)참(?:[\s(]|$)|스트랩|그립톡|브로치|핀즈/],
];

// "[구매권 추첨] …" is the lottery for the right to buy a product, listed at 0 won.
const LOTTERY_PREFIX = /^\s*\[구매권 추첨\]\s*/;

// A sale start further than this after the listing date is a relisting or a restock: the
// shop moved 315 sale starts to 2026-11-12 (봉제인형 브케인 was listed on 2024-01-16), and
// the release date followed every time. 313 of them lie more than 90 days after the
// listing; 358 other products open sales 32–90 days after it, which can be a product listed
// ahead of its announced release, so those keep their sale start.
const RELIST_GAP_DAYS = 90;

/**
 * GET /categories → Map(categoryNo → [top, …, categoryNo]) over every depth. A product
 * names only its deepest categories (a 메탈참 sits in "관동지방", not in 전국도감 메탈참).
 */
export function categoryIndex(tree) {
  const index = new Map();
  const walk = (list, path) => {
    for (const category of list || []) {
      const own = [...path, category.categoryNo];
      index.set(category.categoryNo, own);
      walk(category.children, own);
    }
  };
  walk(tree?.multiLevelCategories || [], []);
  return index;
}

/** displayCategoryNos "488349|1137832" → [488349, 1137832] ("0" = none). */
export function categoryNos(product) {
  return String(product?.displayCategoryNos || "")
    .split("|")
    .map(Number)
    .filter((no) => Number.isInteger(no) && no > 0);
}

/** Every category of the product and the ones above them, and the tops among them. */
function placement(product, index) {
  const paths = categoryNos(product).map((no) => index.get(no) || [no]);
  return { nos: new Set(paths.flat()), tops: new Set(paths.map((path) => path[0])) };
}

export function productName(product) {
  // The API sends names HTML-escaped ("Pikachu&apos;s Sweet Delivery").
  return decodeEntities(product?.productName || "").replace(LOTTERY_PREFIX, "").replace(/\s+/g, " ").trim();
}

export function isExcluded(product, index) {
  const { tops } = placement(product, index);
  return [...tops].some((top) => EXCLUDED_TOPS.has(top)) || EXCLUDED_NAME.test(productName(product));
}

/**
 * { grade_code, subline } of a product. The three categories read before 2026-11-14 decide
 * first, in the old order, so the records imported then keep their grade.
 */
export function gradeFor(product, index) {
  const name = productName(product);
  const { nos, tops } = placement(product, index);
  if (tops.has(TOP.PLUSH)) return { grade_code: "POKE_PLUSH", subline: SUBLINES[TOP.PLUSH] };
  if (tops.has(TOP.FIGURE)) return { grade_code: "POKE_FIGURE", subline: SUBLINES[TOP.FIGURE] };
  const figure = FIGURE_NAME.test(name) && !NOT_FIGURE.test(name);
  if (tops.has(TOP.ORIGINAL)) {
    // "「빗속의 고라파덕」 피카츄 대형 피규어" was a goods record until 2026-11-14.
    const grade = /봉제인형|마스코트/.test(name) ? "POKE_PLUSH" : figure ? "POKE_FIGURE" : "POKE_GOODS";
    return { grade_code: grade, subline: SUBLINES[TOP.ORIGINAL] };
  }
  if (PLUSH_NAME.test(name) && !NOT_PLUSH.test(name)) return { grade_code: "POKE_PLUSH", subline: SUBLINES[TOP.PLUSH] };
  if (figure) return { grade_code: "POKE_FIGURE", subline: SUBLINES[TOP.FIGURE] };
  if (nos.has(CAPSULE_TOY)) return { grade_code: "POKE_GASHAPON", subline: "캡슐토이" };
  const top = [TOP.STATIONERY, TOP.LIVING, TOP.FASHION].find((no) => tops.has(no));
  return { grade_code: "POKE_GOODS", subline: SUBLINES[top] || "포켓몬 스토어" };
}

/**
 * goods_kind of a POKE_GOODS product: the shared name rules (the same ones clean_catalog.mjs
 * runs every day, so the two agree), then character-goods words, then the shop's category,
 * else "other". Every goods record gets one: without it the app files a 포토카드 under 카드.
 */
export function goodsKindFor(product, index) {
  const name = productName(product);
  const byName = goodsKind({ franchise: "pokemon", source_name: name });
  if (byName) return byName;
  const character = CHARACTER_KINDS.find(([, pattern]) => pattern.test(name));
  if (character) return character[0];
  // "봉제인형 가방", "인형 볼펜": the character word kept goodsKind from reading the rest.
  const byWords = goodsRuleKind(name);
  if (byWords) return byWords;
  const { nos } = placement(product, index);
  return SUBCATEGORY_KINDS.find(([no]) => nos.has(no))?.[1] || "other";
}

const ymd = (value) => /(\d{4}-\d{2}-\d{2})/.exec(String(value || ""))?.[1] || null;
const dayIndex = (date) => Date.parse(`${date}T00:00:00Z`) / 86400000;

/** The day the shop opened sales (saleStartYmdt), "YYYY-MM-DD" or null. */
export function saleStart(product) {
  return ymd(product?.saleStartYmdt);
}

/**
 * Release date: the sale start, unless it lies more than RELIST_GAP_DAYS after the listing date
 * (a relisting or restock, then the listing date). Never later than the date the record
 * already had, so a sale start that moves forward does not move the release (it is a
 * restock event instead, lib/restocks.mjs).
 */
export function releaseDateFor(product, previousDate = null) {
  const start = saleStart(product);
  const listed = ymd(product?.registerYmdt);
  let date = start && listed && dayIndex(start) - dayIndex(listed) > RELIST_GAP_DAYS ? listed : start || listed;
  const previous = ymd(previousDate);
  if (previous && (!date || previous < date)) date = previous;
  return date;
}

// 2026-11-14: 134 covers sat on http://image.toast.com (Android shows no cleartext picture;
// the same files answer over https), and the 28 products of the old Godo mall still point at
// pokemon.hgodo.com, which redirects every picture to a service-ended page (the shop's own
// product page shows them broken too). Those are left out rather than written as covers.
function absoluteImage(url) {
  const value = String(url || "").trim();
  if (!value) return null;
  const absolute = httpsImageUrl(value.startsWith("//") ? `https:${value}` : value);
  return deadImage(absolute) ? null : absolute;
}

// The CDN serves 860–1500 px JPEGs and answers 400 to every resize parameter tried on
// 2026-11-14 (?RS=300x300, ?type=w&w=300, ?w=300), so tiles use the cached copies.
const MAX_GALLERY = 6;

/** A JAN / EAN-13 (2,139 of 2,603 products carry Pokémon Center Japan's 4521329…). */
export function janOf(product) {
  const code = String(product?.productManagementCd || "").trim();
  return /^\d{13}$/.test(code) ? code : null;
}

export function productUrl(productNo) {
  return `${STORE}/pages/product/product-detail.html?productNo=${productNo}`;
}

/** Shop product → catalog record (null for the card game and Nintendo products). */
export function toKit(product, index, previous = null) {
  if (!product?.productNo || isExcluded(product, index)) return null;
  const name = productName(product);
  if (!name) return null;
  const { grade_code: gradeCode, subline } = gradeFor(product, index);
  const kind = gradeCode === "POKE_GOODS" ? goodsKindFor(product, index) : null;
  const gallery = [...new Set([product.listImageUrls?.[0], ...(product.imageUrls || [])].map(absoluteImage).filter(Boolean))].slice(0, MAX_GALLERY);
  const cover = gallery[0] || null;
  const url = productUrl(product.productNo);
  const price = Number.isInteger(product.salePrice) && product.salePrice > 0 ? product.salePrice : null;
  const { tops } = placement(product, index);
  const jan = janOf(product);
  return {
    kit_id: `pokemon-kr-${product.productNo}`,
    franchise: "pokemon",
    grade_code: gradeCode,
    subline,
    number: null,
    scale: "non-scale",
    ...(kind ? { category: "goods", goods_kind: kind } : { category: undefined, goods_kind: undefined }),
    // Korean listings carry only a Korean name; the localizer fills the rest.
    names: { ko: name, ja: name, zh: name, en: name },
    // The shop's own title, for the goods rules (names.ja gets glossary words mixed in).
    source_name: name,
    images: {
      box_art_url: cover,
      box_art_source_id: cover ? SOURCE_ID : null,
    },
    gallery_image_urls: gallery,
    series: { key: "pokemon", sort: 400, labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" } },
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: releaseDateFor(product, previous?.release_date),
    // The shop prices in won. Converting to yen would invent a number that
    // changes with the exchange rate, so the won price is kept as its own field
    // and price_jpy stays null.
    price_jpy: null,
    price_krw: price,
    is_limited: /한정|限定|예약/.test(name) || tops.has(TOP.ORIGINAL),
    ...(jan ? { jan } : { jan: undefined }),
    // Read by lib/restocks.mjs: a sale start that moves forward, or a sold-out product
    // back on sale, is a restock.
    pokemon_store_kr: { sale_start: saleStart(product), sold_out: product.isSoldOut === true },
    data_status: "verified",
    source_urls: [url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url,
        fields: ["names", "images", "grade_code", "release_date", "price_krw"],
        confidence: "high",
      },
    ],
    tags: [...new Set(["pokemon", "korea", "pokemon store", gradeCode.toLowerCase()])],
    notes: "Imported from the official Korean Pokemon Store online shop (pokemonstore.co.kr).",
  };
}

/** Imported records over the catalog; undefined fields of a record remove the old value. */
export function mergeCatalog(existingKits, importedKits) {
  const byId = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  for (const kit of importedKits) {
    const merged = { ...(byId.get(kit.kit_id) || {}), ...kit };
    for (const [key, value] of Object.entries(merged)) if (value === undefined) delete merged[key];
    byId.set(kit.kit_id, merged);
  }
  return [...byId.values()].sort((a, b) => {
    const franchiseCompare = String(a.franchise).localeCompare(String(b.franchise));
    if (franchiseCompare) return franchiseCompare;
    return (
      String(b.release_date || "").localeCompare(String(a.release_date || "")) ||
      String(a.kit_id).localeCompare(String(b.kit_id))
    );
  });
}
