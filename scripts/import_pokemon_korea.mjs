// Korean Pokemon merchandise from the official 포켓몬스토어 online shop:
// plush, figures and, since 2026-11-14, the goods (문구, 리빙, 패션 …).
//
//   node scripts/import_pokemon_korea.mjs        (npm run import:pokemon-kr)
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
//
// One run reads the category tree once and the whole store (2,603 products in 27
// pages on 2026-11-14), one request at a time 1.1 s apart; the card game and
// Nintendo products are left out (lib/pokemon-store-kr.mjs). shop-api.e-ncp.com
// publishes no robots.txt (404) and pokemonstore.co.kr allows everything; the
// shop's terms forbid only commercial reuse of its content.
import { readFile, writeFile } from "node:fs/promises";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { SOURCE_ID, categoryIndex, mergeCatalog, toKit } from "./lib/pokemon-store-kr.mjs";
import { loadRobots, robotsAllows } from "./lib/robots.mjs";

const CATALOG_PATH = "data/kits.json";
const API = "https://shop-api.e-ncp.com";
// Public storefront key the shop's own scripts send with every request.
const CLIENT_ID = process.env.POKEMON_KR_CLIENT_ID || "HJGfZ5jPHZk3/PEOkm+/Qw==";
const PAGE_SIZE = 100;
const MAX_PAGES = 60;
const REQUEST_DELAY_MS = Math.max(1100, Number(process.env.POKEMON_KR_DELAY_MS || 1100));
// A run that sees far fewer products than the catalog holds read a broken answer.
const MIN_SHARE_OF_PREVIOUS = 0.5;

// Until 2026-11-14 the requests also carried an Origin and a Referer of the
// storefront; the API answers the same without them, and a made-up Referer is
// not sent any more.
const USER_AGENT = "Mozilla/5.0 (compatible; GunpulaCatalog/1.0; +https://github.com/mdefitko777/Gunpula)";
const HEADERS = {
  "User-Agent": USER_AGENT,
  "Content-type": "application/json",
  Version: "1.0",
  clientId: CLIENT_ID,
  platform: "PC",
};

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastRequestAt = 0;

async function fetchJson(url) {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25000) });
  // 403 / 429 / 503 is the shop asking us to stop: no retry, the run ends here.
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchAllProducts() {
  const products = new Map();
  let total = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url =
      `${API}/products/search?filter.saleStatus=ALL_CONDITIONS&filter.soldout=true` +
      `&pageNumber=${page}&pageSize=${PAGE_SIZE}&order.by=RECENT_PRODUCT&order.direction=DESC`;
    const payload = await fetchJson(url);
    const items = payload?.items || [];
    total ??= payload?.totalCount ?? null;
    for (const item of items) {
      if (item?.productNo) products.set(item.productNo, item);
    }
    if (items.length < PAGE_SIZE || (total != null && page * PAGE_SIZE >= total)) break;
  }
  return { products: [...products.values()], total };
}

async function main() {
  const robots = await loadRobots(new URL(API).host, { userAgent: USER_AGENT });
  // robots.txt was a request to the same host: the category tree waits its turn after it.
  lastRequestAt = Date.now();
  if (!robotsAllows(robots, `${API}/products/search`)) {
    throw new Error(`${API} is disallowed by robots.txt (${robots.status})`);
  }
  const index = categoryIndex(await fetchJson(`${API}/categories`));
  if (!index.size) throw new Error("The category tree came back empty.");
  const { products, total } = await fetchAllProducts();

  let retired = new Set();
  try {
    retired = retiredKitIds(JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8")));
  } catch {
    // No alias file yet.
  }
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const previousById = new Map(catalog.kits.filter((kit) => kit.kit_id.startsWith("pokemon-kr-")).map((kit) => [kit.kit_id, kit]));

  const imported = [];
  let excluded = 0;
  for (const product of products) {
    const kit = toKit(product, index, previousById.get(`pokemon-kr-${product.productNo}`));
    if (!kit) {
      excluded += 1;
      continue;
    }
    if (!retired.has(kit.kit_id)) imported.push(kit);
  }

  if (imported.length < previousById.size * MIN_SHARE_OF_PREVIOUS) {
    throw new Error(`Only ${imported.length} products parsed (the catalog has ${previousById.size}); leaving the catalog untouched.`);
  }

  const merged = mergeCatalog(catalog.kits, imported);
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
  const byGrade = imported.reduce((acc, kit) => ({ ...acc, [kit.grade_code]: (acc[kit.grade_code] || 0) + 1 }), {});
  console.log(
    `${SOURCE_ID}: ${products.length} of ${total ?? "?"} products read, ${excluded} card game / Nintendo left out; ` +
      `${imported.length} records ${JSON.stringify(byGrade)}, ${imported.filter((kit) => !previousById.has(kit.kit_id)).length} new; ` +
      `catalog now ${merged.filter((kit) => kit.franchise === "pokemon").length} Pokemon records.`,
  );
}

if (/(^|[\\/])import_pokemon_korea\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`${SOURCE_ID}: ${error.message}`);
    process.exit(1);
  });
}
