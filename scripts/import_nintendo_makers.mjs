// Kotobukiya and Good Smile Company products of Nintendo games for the 닌텐도 channel (franchise
// "nintendo"; rules in lib/nintendo-makers.mjs). The owner asked on 2026-11-19 for the channel to
// hold other makers' goods of Nintendo games too, starting from the missing ゼノブレイド2 セイレーン.
//
//   node scripts/import_nintendo_makers.mjs        (npm run import:nintendo-makers)
//
// One run reads the Kotobukiya online shop search (3 work filters and 13 keywords, Shift_JIS) and
// the goodsmile.com search by 28 Nintendo work filters, then the product pages of products the
// catalog does not have from this importer yet: on the first run (2026-11-19) the goodsmile.com
// pages of every product in Japanese and English; later only new products. Bot user agent,
// robots.txt first, one request at a time per host at least 1.1 s apart (lib/polite-fetch.mjs); a
// 403 / 429 / 503 or a bot check stops that host for the run and its records stay as they are.
// Sold-out Kotobukiya kits the shop no longer lists come from data/nintendo/kotobukiya-manual.json.
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { parseGscDetail, parseGscCards } from "./lib/effect-parts.mjs";
import { parseKotobukiyaShopDetail, parseKotobukiyaShopListings } from "./lib/kotobukiya-shop.mjs";
import {
  findDuplicate,
  GSC_BASE,
  GSC_PAGE_SIZE,
  GSC_SOURCE_ID,
  GSC_TITLES,
  gscKitId,
  gscRecord,
  gscStoredPages,
  gscTitleSearchUrl,
  KOTOBUKIYA_KEYWORDS,
  KOTOBUKIYA_SOURCE_ID,
  KOTOBUKIYA_WORK_FILTERS,
  kotobukiyaFilterUrl,
  kotobukiyaKeywordUrl,
  kotobukiyaKitId,
  kotobukiyaManualRecord,
  kotobukiyaRecord,
  kotobukiyaStoredDetail,
  mergeMakerRecords,
  parseGscSpec,
} from "./lib/nintendo-makers.mjs";
import { createPoliteFetcher } from "./lib/polite-fetch.mjs";

const CATALOG_PATH = "data/kits.json";
const MANUAL_PATH = "data/nintendo/kotobukiya-manual.json";
const MAX_GSC_OFFSET = 600;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const fetcher = createPoliteFetcher({ language: "ja,en;q=0.8" });
const notes = [];
const skipped = [];

async function readKotobukiyaListings() {
  const byId = new Map();
  const searches = [
    ...KOTOBUKIYA_WORK_FILTERS.map(([id, work]) => ({ url: kotobukiyaFilterUrl(id), work })),
    ...KOTOBUKIYA_KEYWORDS.map((keyword) => ({ url: kotobukiyaKeywordUrl(keyword), work: null })),
  ];
  for (const search of searches) {
    const listings = parseKotobukiyaShopListings(await fetcher.text(search.url, { encoding: "shift_jis" }), search.url);
    if (listings.length >= 90) notes.push(`${KOTOBUKIYA_SOURCE_ID}: ${search.url} filled a whole page; read the next one`);
    for (const listing of listings) {
      // A work filter's hit keeps its work even when a keyword found it first.
      const known = byId.get(listing.product_id);
      if (!known || (search.work && !known.work)) byId.set(listing.product_id, { ...listing, work: search.work });
    }
  }
  return [...byId.values()];
}

async function importKotobukiya(existingById, manual) {
  const listings = await readKotobukiyaListings();
  const manualByJan = new Map(manual.map((entry) => [entry.jan, entry]));
  const records = [];
  let read = 0;
  let stopped = null;
  for (const listing of listings) {
    const existing = existingById.get(kotobukiyaKitId(listing.product_id));
    let detail = kotobukiyaStoredDetail(existing);
    if (!detail && !stopped) {
      try {
        detail = parseKotobukiyaShopDetail(await fetcher.text(listing.detail_url, { encoding: "shift_jis" }), listing.detail_url);
        read += 1;
      } catch (error) {
        stopped = error.message;
      }
    }
    if (!detail && existing) {
      records.push(existing);
      continue;
    }
    const record = kotobukiyaRecord(listing, detail, manualByJan.get(listing.product_id));
    if (record.skip) skipped.push(`kotobukiya ${listing.product_id} ${listing.title}: ${record.skip}`);
    else records.push(record);
  }
  // Sold-out kits the shop no longer lists.
  const listed = new Set(records.map((kit) => kit.jan).filter(Boolean));
  const fromFile = manual.filter((entry) => !listed.has(entry.jan)).map(kotobukiyaManualRecord);
  if (stopped) notes.push(`${KOTOBUKIYA_SOURCE_ID}: goods pages stopped (${stopped})`);
  console.log(`${KOTOBUKIYA_SOURCE_ID}: ${listings.length} shop listings, ${records.length} Nintendo products; ${read} goods pages read; ${fromFile.length} from ${MANUAL_PATH}.`);
  return [...records, ...fromFile];
}

async function readGscCards() {
  const byId = new Map();
  for (const [titleId, work] of GSC_TITLES) {
    for (let offset = 0; offset <= MAX_GSC_OFFSET; offset += GSC_PAGE_SIZE) {
      const page = parseGscCards(await fetcher.text(gscTitleSearchUrl(titleId, offset)));
      for (const card of page) if (!byId.has(card.productId)) byId.set(card.productId, { ...card, work });
      if (page.length < GSC_PAGE_SIZE) break;
    }
  }
  return [...byId.values()];
}

const isMissing = (error) => /HTTP (?:404|410) /.test(error.message);

// Some products have no English page (2026-11-19: /en/product/6465 answered 404); the record
// then has the Japanese name only.
async function readEnglish(productId) {
  try {
    return parseGscDetail(await fetcher.text(`${GSC_BASE}/en/product/${productId}`), productId);
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

async function importGoodSmile(existingById) {
  const cards = await readGscCards();
  const records = [];
  let read = 0;
  let stopped = null;
  for (const card of cards) {
    const existing = existingById.get(gscKitId(card.productId));
    let pages = gscStoredPages(existing);
    if (!pages && !stopped) {
      try {
        // ja: name, JAN, 作品名, 仕様, 販売 months, copyright, pictures; en: the English name.
        const html = await fetcher.text(`${GSC_BASE}/ja/product/${card.productId}`);
        read += 1;
        pages = { detail: parseGscDetail(html, card.productId), english: await readEnglish(card.productId), spec: parseGscSpec(html) };
      } catch (error) {
        // A missing page is that product's problem; a refusal stops the host for the run.
        if (isMissing(error)) skipped.push(`goodsmile ${card.productId} ${card.name}: ${error.message}`);
        else stopped = error.message;
      }
    }
    if (!pages) {
      // A record of the 2026-11-19 morning import stays until its pages are read.
      if (existing) records.push(existing);
      continue;
    }
    const record = gscRecord(card, pages.detail, pages.english, pages.spec);
    if (record.skip) skipped.push(`goodsmile ${card.productId} ${card.name}: ${record.skip}`);
    else records.push(record);
  }
  if (stopped) notes.push(`${GSC_SOURCE_ID}: product pages stopped (${stopped})`);
  console.log(`${GSC_SOURCE_ID}: ${cards.length} products in ${GSC_TITLES.length} work filters, ${records.length} Nintendo products; ${read} product pages read.`);
  return records;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const manual = JSON.parse(await readFile(MANUAL_PATH, "utf8")).products || [];
  const existingById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
  const imported = [];
  // Each maker on its own: one that fails keeps yesterday's records.
  for (const [label, run] of [["Kotobukiya", () => importKotobukiya(existingById, manual)], ["goodsmile.com", () => importGoodSmile(existingById)]]) {
    try {
      imported.push(...(await run()));
    } catch (error) {
      notes.push(`${label}: ${error.message}`);
    }
  }
  for (const note of notes) console.warn(note);
  for (const line of skipped) console.log(`  skipped ${line}`);
  if (process.env.IMPORT_NOTES_PATH && notes.length) await appendFile(process.env.IMPORT_NOTES_PATH, notes.map((note) => `import:nintendo-makers ${note}\n`).join(""), "utf8");
  if (!imported.length) throw new Error("nothing read; the catalog is left as it was");

  let retired = new Set();
  try {
    retired = retiredKitIds(JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8")));
  } catch {
    // No alias file yet.
  }
  const records = [];
  for (const kit of imported) {
    if (retired.has(kit.kit_id)) continue;
    // The same product under another id (a Pokémon item, another importer): that record stays.
    const duplicate = existingById.has(kit.kit_id) ? null : findDuplicate(catalog.kits.filter((other) => !retired.has(other.kit_id)), kit);
    if (duplicate) {
      skipped.push(`${kit.kit_id}: already in the catalog as ${duplicate.kit_id}`);
      console.log(`  skipped ${kit.kit_id}: already in the catalog as ${duplicate.kit_id}`);
      continue;
    }
    records.push(kit);
  }
  const merged = mergeMakerRecords(catalog.kits, records);
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
  const count = (list, key) => list.reduce((acc, kit) => ({ ...acc, [key(kit)]: (acc[key(kit)] || 0) + 1 }), {});
  console.log(`nintendo makers: ${records.length} records ${JSON.stringify(count(records, (kit) => kit.grade_code))}, ${records.filter((kit) => !existingById.has(kit.kit_id)).length} new.`);
  console.log(`  by maker / series: ${JSON.stringify(count(records, (kit) => `${kit.subline} ${kit.series?.key}`))}`);
}

if (/(^|[\\/])import_nintendo_makers\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`import:nintendo-makers: ${error.message}`);
    process.exit(1);
  });
}
