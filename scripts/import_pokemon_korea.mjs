// Korean Pokemon merchandise from the official 포켓몬스토어 online shop.
//
// Every Pokemon source in this catalog was Japanese, so Korea-exclusive goods
// (and the Korean names and prices for the ones sold in both markets) were
// missing entirely.
//
// The storefront is client-rendered on NHN Commerce's "shopby" platform, but it
// talks to a public REST API. Two things about that API are easy to get wrong,
// and both fail silently by returning the 4-product default instead of an
// error: the search filters need a `filter.` prefix (`filter.keywords`, not
// `keywords`), while the category filter is the bare `categoryNos`.
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const SOURCE_ID = "pokemon_store_kr";
const API = "https://shop-api.e-ncp.com";
const STORE = "https://pokemonstore.co.kr";
// Public storefront key the shop's own scripts send with every request.
const CLIENT_ID = process.env.POKEMON_KR_CLIENT_ID || "HJGfZ5jPHZk3/PEOkm+/Qw==";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = Number(process.env.POKEMON_KR_DELAY_MS || 150);

// Collectible categories only. The shop also sells 패션 (560), 문구 (255),
// 리빙 (224), 카드 게임 (197) and 닌텐도 게임 (13) — apparel, stationery,
// homeware, TCG and game software, none of which this catalog tracks.
const CATEGORIES = [
  { no: 488335, label: "봉제인형", grade_code: "POKE_PLUSH" },
  { no: 488337, label: "피규어", grade_code: "POKE_FIGURE" },
  { no: 488329, label: "포켓몬 스토어 오리지널", grade_code: "POKE_GOODS" },
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; GunpulaCatalog/1.0; +https://github.com/mdefitko777/Gunpula)",
  "Content-type": "application/json",
  Version: "1.0",
  clientId: CLIENT_ID,
  platform: "PC",
  Origin: STORE,
  Referer: `${STORE}/`,
};

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

function absoluteImage(url) {
  const value = String(url || "").trim();
  if (!value) return null;
  return value.startsWith("//") ? `https:${value}` : value;
}

function releaseDateFrom(product) {
  // saleStartYmdt is when it goes on sale; registerYmdt is the fallback for
  // long-listed products whose sale start was never set.
  const value = product.saleStartYmdt || product.registerYmdt || "";
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

async function fetchCategory(category) {
  const products = new Map();
  for (let page = 1; page <= 60; page += 1) {
    const url =
      `${API}/products/search?filter.saleStatus=ALL_CONDITIONS&filter.soldout=true` +
      `&categoryNos=${category.no}&pageNumber=${page}&pageSize=${PAGE_SIZE}` +
      `&order.by=RECENT_PRODUCT&order.direction=DESC`;
    const payload = await fetchJson(url);
    const items = payload?.items || [];
    for (const item of items) {
      if (item?.productNo) products.set(item.productNo, item);
    }
    if (items.length < PAGE_SIZE) break;
  }
  return [...products.values()];
}

function toKit(product, category) {
  const name = String(product.productName || "").replace(/\s+/g, " ").trim();
  const image = absoluteImage((product.listImageUrls || product.imageUrls || [])[0]);
  const url = `${STORE}/pages/product/product-detail.html?productNo=${product.productNo}`;
  const price = Number.isInteger(product.salePrice) ? product.salePrice : null;
  return {
    kit_id: `pokemon-kr-${product.productNo}`,
    franchise: "pokemon",
    grade_code: category.grade_code,
    subline: category.label,
    number: null,
    scale: "non-scale",
    // Korean listings carry only a Korean name; the localizer fills the rest.
    names: { ko: name, ja: name, zh: name, en: name },
    images: {
      box_art_url: image,
      box_art_source_id: image ? SOURCE_ID : null,
    },
    gallery_image_urls: image ? [image] : [],
    series: { key: "pokemon", sort: 400, labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" } },
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: releaseDateFrom(product),
    // The shop prices in won. Converting to yen would invent a number that
    // changes with the exchange rate, so the won price is kept as its own field
    // and price_jpy stays null.
    price_jpy: null,
    price_krw: price,
    is_limited: /한정|限定|예약|스토어 오리지널/.test(`${name} ${category.label}`),
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
    tags: [...new Set(["pokemon", "korea", "pokemon store", category.grade_code.toLowerCase()])],
    notes: "Imported from the official Korean Pokemon Store online shop (pokemonstore.co.kr).",
  };
}

function mergeCatalog(existingKits, importedKits) {
  const byId = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  for (const kit of importedKits) {
    const previous = byId.get(kit.kit_id);
    byId.set(kit.kit_id, previous ? { ...previous, ...kit } : kit);
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

const imported = new Map();
const report = [];
for (const category of CATEGORIES) {
  try {
    const products = await fetchCategory(category);
    for (const product of products) {
      // A product can sit in several categories; the first one listed here wins
      // so plush never gets relabelled as generic goods.
      if (!imported.has(product.productNo)) imported.set(product.productNo, toKit(product, category));
    }
    report.push(`${category.label} ${products.length}`);
  } catch (error) {
    console.warn(`${SOURCE_ID} ${category.label}: ${error.message}`);
    report.push(`${category.label} FAILED`);
  }
}

if (!imported.size) {
  console.error("No products parsed from the Korean Pokemon Store; leaving the catalog untouched.");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const merged = mergeCatalog(catalog.kits, [...imported.values()]);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
console.log(
  `Pokemon Store Korea — ${report.join(", ")}; ${imported.size} unique products; ` +
    `catalog now ${merged.filter((kit) => kit.franchise === "pokemon").length} Pokemon records.`,
);
