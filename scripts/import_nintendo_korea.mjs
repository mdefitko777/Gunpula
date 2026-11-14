// Nintendo games, hardware, amiibo and goods from the official Korean Nintendo sites (franchise
// "nintendo", the 닌텐도 channel; rules in lib/nintendo-kr.mjs).
//
//   node scripts/import_nintendo_korea.mjs        (npm run import:nintendo-kr)
//
// Asked for on 2026-11-14: Nintendo's own products, not only the Pokémon ones. One run reads the
// store's two lists (about 3 + 5 pages of 48), the release schedule and the amiibo lineup, and the
// product page of every product it has not seen yet (발매일, 메이커, pictures; about 280 pages the
// first time, then the new ones and, once a week, the ones not released yet). Bot user agent,
// robots.txt first, one request at a time per host at least 1.1 s apart (lib/polite-fetch.mjs).
// 403 / 429 / 503 or a page that is not the store on a list stops the run and leaves the catalog
// as it was; on a product page it stops the product pages, and the products whose page was read
// are written (the others wait for the next run).
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import {
  AMIIBO_URL,
  buildRecords,
  classifyStoreProduct,
  DIGITAL_LIST,
  LIST_LIMIT,
  parseAmiiboLineup,
  parseSchedule,
  parseStoreDetail,
  parseStoreList,
  PHYSICAL_LIST,
  SCHEDULE_URL,
  SOURCE_ID,
} from "./lib/nintendo-kr.mjs";
import { createPoliteFetcher } from "./lib/polite-fetch.mjs";
import { mergeCatalog } from "./lib/pokemon-store-kr.mjs";

const CATALOG_PATH = "data/kits.json";
// Product page details by store entity id: { release_date, maker, images, read_at }.
const DETAILS_PATH = "data/nintendo/store-details.json";
const MAX_LIST_PAGES = 12;
// The first run reads ~280 product pages (about 6 minutes); later runs only new and upcoming ones.
const MAX_DETAILS = Number(process.env.NINTENDO_KR_MAX_DETAILS || 320);
const RECHECK_DAYS = 7;
const MIN_SHARE_OF_PREVIOUS = 0.5;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const fetcher = createPoliteFetcher();
const fetchText = (url) => fetcher.text(url);

async function readList(base) {
  const products = new Map();
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const url = `${base}${base.includes("?") ? "&" : "?"}product_list_limit=${LIST_LIMIT}&p=${page}`;
    const found = parseStoreList(await fetchText(url));
    if (page === 1 && !found.length) throw new Error(`${url} lists no products (markup change or not the store)`);
    // Past the last page Magento shows the last page again.
    const fresh = found.filter((product) => !products.has(product.entityId));
    for (const product of fresh) products.set(product.entityId, product);
    if (!fresh.length || found.length < LIST_LIMIT) break;
  }
  return [...products.values()];
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

async function main() {
  const date = today();
  const physical = await readList(PHYSICAL_LIST);
  const digital = await readList(DIGITAL_LIST);
  const schedule = parseSchedule(await fetchText(SCHEDULE_URL));
  const amiibo = parseAmiiboLineup(await fetchText(AMIIBO_URL));
  if (!schedule.length) console.warn(`${SCHEDULE_URL}: no schedule items found (markup change?)`);

  const store = await readJson(DETAILS_PATH, { details: {} });
  const details = store.details || {};
  const wanted = [...physical, ...digital].filter((product) => classifyStoreProduct(product).grade);
  const stale = (entry) =>
    !entry || entry.failed || ((!entry.release_date || entry.release_date >= date) && daysBetween(entry.read_at, date) >= RECHECK_DAYS);
  // A page that stopped an earlier run goes last, so one refused page never holds up the others.
  const toRead = wanted
    .filter((product) => stale(details[product.entityId]))
    .sort((a, b) => Number(Boolean(details[a.entityId]?.failed)) - Number(Boolean(details[b.entityId]?.failed)))
    .slice(0, MAX_DETAILS);
  let read = 0;
  let stopped = null;
  for (const product of toRead) {
    try {
      const detail = parseStoreDetail(await fetchText(product.url));
      details[product.entityId] = { release_date: detail.releaseDate, maker: detail.maker, images: detail.images, read_at: date };
      read += 1;
    } catch (error) {
      // 2026-11-14: the 238th product page (ARMS) answered 403. No further page this run; the lists
      // are already read, so the products whose page was read are written and the rest wait.
      stopped = error.message;
      details[product.entityId] = { ...details[product.entityId], failed: error.message, read_at: date };
      break;
    }
  }
  // What was read stays read, also when the store stopped the run halfway.
  await mkdir(path.dirname(DETAILS_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(details).sort(([a], [b]) => Number(a) - Number(b)));
  await writeFile(DETAILS_PATH, `${JSON.stringify({ note: "store.nintendo.co.kr product pages read by scripts/import_nintendo_korea.mjs (release date, maker, pictures), by store entity id.", details: sorted }, null, 1)}\n`);
  if (stopped) {
    console.warn(`${SOURCE_ID}: product pages stopped (${stopped}); ${toRead.length - read} wait for the next run.`);
    if (process.env.IMPORT_NOTES_PATH) await appendFile(process.env.IMPORT_NOTES_PATH, `import:nintendo-kr stopped reading product pages: ${stopped}\n`, "utf8");
  }

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const previous = catalog.kits.filter((kit) => kit.franchise === "nintendo");
  const asDetails = Object.fromEntries(
    Object.entries(details)
      .filter(([, entry]) => entry.maker !== undefined)
      .map(([id, entry]) => [id, { releaseDate: entry.release_date, maker: entry.maker, images: entry.images || [] }]),
  );
  const { records, skipped, pending } = buildRecords({ physical, digital, details: asDetails, schedule, amiibo, previous });

  let retired = new Set();
  try {
    retired = retiredKitIds(JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8")));
  } catch {
    // No alias file yet.
  }
  const imported = records.filter((kit) => !retired.has(kit.kit_id));
  if (imported.length < previous.length * MIN_SHARE_OF_PREVIOUS) {
    throw new Error(`Only ${imported.length} records built (the catalog has ${previous.length}); leaving the catalog untouched.`);
  }
  const merged = mergeCatalog(catalog.kits, imported);
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: date, kits: merged }, null, 2)}\n`, "utf8");
  const byGrade = imported.reduce((acc, kit) => ({ ...acc, [kit.grade_code]: (acc[kit.grade_code] || 0) + 1 }), {});
  const known = new Set(previous.map((kit) => kit.kit_id));
  console.log(
    `${SOURCE_ID}: ${physical.length} packaged + ${digital.length} download products, ${schedule.length} schedule items, ` +
      `${amiibo.length} amiibo; ${read} product pages read; left out ${JSON.stringify(skipped)}` +
      `${pending.length ? `, ${pending.length} games wait for their page` : ""}; ` +
      `${imported.length} records ${JSON.stringify(byGrade)}, ${imported.filter((kit) => !known.has(kit.kit_id)).length} new.`,
  );
}

if (/(^|[\\/])import_nintendo_korea\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`${SOURCE_ID}: ${error.message}`);
    process.exit(1);
  });
}
