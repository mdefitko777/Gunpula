// General-purpose figure effect parts for the 이펙트 channel (franchise "effects"; rules in
// lib/effect-parts.mjs): every 魂EFFECT product on Tamashii Web, Good Smile Company's
// THE シンプルエフェクト / MODEROID effect parts on goodsmile.com and BANDAI SPIRITS'
// カスタマイズエフェクト from its product search.
//
//   node scripts/import_effect_parts.mjs        (npm run import:effects)
//
// Asked for on 2026-11-15. One run reads the 魂EFFECT brand list of the Tamashii search API in four
// sales areas (one page each), the goodsmile.com search for エフェクト and the BANDAI SPIRITS search
// for カスタマイズエフェクト (one page each), and the product pages of products the catalog does not
// have yet: 56 pages on the first run (1 min 23 s), none on the next one, later only new products
// and 魂EFFECT products whose listed month or price moved. Bot user agent, robots.txt first, one
// request at a time per host at least 1.1 s apart (lib/polite-fetch.mjs). A list that fails leaves
// that maker's records as they are; 403 / 429 / 503 or a bot check stops the host for the run. A
// product whose page was not read keeps its stored record; a new 魂EFFECT or カスタマイズエフェクト
// product is written from its listing (its page is read on the next run), a new Good Smile one waits.
import { appendFile, readFile, writeFile } from "node:fs/promises";
import {
  parseBandaiSpiritProductCards,
  parseBandaiSpiritProductDetail,
  parseTamashiiProductDetail,
} from "./import_bandai_collectibles.mjs";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import {
  BANDAI_SPIRITS_SEARCH_URL,
  customizeEffectRecord,
  FRANCHISE,
  GSC_BASE,
  GSC_PAGE_SIZE,
  GSC_SOURCE_ID,
  gscEffectGrade,
  gscEffectRecord,
  gscSearchUrl,
  gscStoredDetail,
  isCustomizeEffect,
  mergeEffects,
  mergeTamashiiAreas,
  parseGscCards,
  parseGscDetail,
  TAMASHII_AREAS,
  TAMASHII_BASE,
  TAMASHII_SOURCE_ID,
  tamashiiEffectChanged,
  tamashiiEffectRecord,
  tamashiiEffectSearchUrl,
  tamashiiStoredDetail,
} from "./lib/effect-parts.mjs";
import { createPoliteFetcher } from "./lib/polite-fetch.mjs";

const CATALOG_PATH = "data/kits.json";
const MAX_LIST_PAGES = 5;
const MAX_GSC_OFFSET = 600;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const fetcher = createPoliteFetcher({ language: "ja,en;q=0.8" });
const notes = [];

async function readTamashiiArea(area) {
  const items = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const payload = JSON.parse(await fetcher.text(tamashiiEffectSearchUrl(area, page)));
    items.push(...(payload.data || []));
    if (!payload.pagination || payload.pagination.currentPage >= payload.pagination.lastPage) break;
  }
  return items;
}

async function importTamashii(existingById) {
  const lists = [];
  for (const area of TAMASHII_AREAS) {
    try {
      lists.push([area, await readTamashiiArea(area)]);
    } catch (error) {
      // japan lists every product; a failed overseas area only loses its exclusives.
      if (area === "japan") throw error;
      console.warn(`${TAMASHII_SOURCE_ID}: ${area} area skipped (${error.message})`);
    }
  }
  const items = mergeTamashiiAreas(lists);
  if (!items.length) throw new Error("the 魂EFFECT list is empty (markup change or not the API)");
  const records = [];
  let read = 0;
  let stopped = null;
  for (const item of items) {
    const existing = existingById.get(`tamashii-${item.tamashiiWebId}`);
    let detail = tamashiiStoredDetail(existing);
    if ((!detail || tamashiiEffectChanged(item, existing)) && !stopped) {
      const url = `${TAMASHII_BASE}/item/${item.tamashiiWebId}/`;
      try {
        detail = parseTamashiiProductDetail(await fetcher.text(url), url);
        read += 1;
      } catch (error) {
        stopped = error.message;
      }
    }
    if (!detail && existing) {
      records.push(existing);
      continue;
    }
    records.push(tamashiiEffectRecord(item, detail || {}));
  }
  if (stopped) notes.push(`${TAMASHII_SOURCE_ID}: product pages stopped (${stopped})`);
  console.log(`${TAMASHII_SOURCE_ID}: ${items.length} 魂EFFECT products (${lists.map(([area, list]) => `${area} ${list.length}`).join(", ")}); ${read} product pages read.`);
  return records;
}

async function importGoodSmile(existingById) {
  const cards = [];
  for (let offset = 0; offset <= MAX_GSC_OFFSET; offset += GSC_PAGE_SIZE) {
    const page = parseGscCards(await fetcher.text(gscSearchUrl(offset)));
    cards.push(...page);
    if (page.length < GSC_PAGE_SIZE) break;
  }
  const wanted = cards.filter((card) => gscEffectGrade(card.name));
  const records = [];
  let read = 0;
  let stopped = null;
  for (const card of wanted) {
    const existing = existingById.get(`goodsmile-effects-g${card.productId}`);
    let pages = existing ? gscStoredDetail(existing) : null;
    if (!pages && !stopped) {
      try {
        // ja: name, JAN, price, pictures; en: the English name (and a shipping month while announced).
        const detail = parseGscDetail(await fetcher.text(`${GSC_BASE}/ja/product/${card.productId}`), card.productId);
        const english = parseGscDetail(await fetcher.text(`${GSC_BASE}/en/product/${card.productId}`), card.productId);
        pages = { detail, english };
        read += 2;
      } catch (error) {
        stopped = error.message;
      }
    }
    if (!pages) continue;
    records.push(gscEffectRecord(card, pages.detail, pages.english));
  }
  if (stopped) notes.push(`${GSC_SOURCE_ID}: product pages stopped (${stopped})`);
  console.log(`${GSC_SOURCE_ID}: ${cards.length} search results, ${wanted.length} effect products; ${read} product pages read.`);
  return records;
}

async function importBandaiSpirits(existingById) {
  const cards = parseBandaiSpiritProductCards(await fetcher.text(BANDAI_SPIRITS_SEARCH_URL), BANDAI_SPIRITS_SEARCH_URL).filter((card) => isCustomizeEffect(card.title));
  if (!cards.length) throw new Error("the カスタマイズエフェクト search lists nothing (markup change?)");
  const records = [];
  let read = 0;
  let stopped = null;
  for (const card of cards) {
    const existing = existingById.get(customizeEffectRecord(card).kit_id);
    let detail = existing?.gallery_image_urls?.length > 1 ? { images: existing.gallery_image_urls.slice(1) } : null;
    if (!detail && !stopped) {
      try {
        detail = parseBandaiSpiritProductDetail(await fetcher.text(card.source_url), card.image_url);
        read += 1;
      } catch (error) {
        stopped = error.message;
      }
    }
    records.push(customizeEffectRecord(card, detail || {}));
  }
  if (stopped) notes.push(`BANDAI SPIRITS: product pages stopped (${stopped})`);
  console.log(`BANDAI SPIRITS: ${cards.length} カスタマイズエフェクト products; ${read} product pages read.`);
  return records;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const existingById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
  const imported = [];
  // Each maker on its own: one that fails keeps yesterday's records.
  for (const [label, run] of [["Tamashii Web", importTamashii], ["goodsmile.com", importGoodSmile], ["BANDAI SPIRITS", importBandaiSpirits]]) {
    try {
      imported.push(...(await run(existingById)));
    } catch (error) {
      notes.push(`${label}: ${error.message}`);
    }
  }
  for (const note of notes) console.warn(note);
  if (process.env.IMPORT_NOTES_PATH && notes.length) await appendFile(process.env.IMPORT_NOTES_PATH, notes.map((note) => `import:effects ${note}\n`).join(""), "utf8");
  if (!imported.length) throw new Error("nothing read; the catalog is left as it was");

  let retired = new Set();
  try {
    retired = retiredKitIds(JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8")));
  } catch {
    // No alias file yet.
  }
  // A Tamashii id filed under another franchise stays there (a work's own effect set).
  const records = imported.filter((kit) => !retired.has(kit.kit_id) && (existingById.get(kit.kit_id)?.franchise ?? FRANCHISE) === FRANCHISE);
  const merged = mergeEffects(catalog.kits, records);
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
  const byGrade = records.reduce((acc, kit) => ({ ...acc, [kit.grade_code]: (acc[kit.grade_code] || 0) + 1 }), {});
  console.log(`effects: ${records.length} records ${JSON.stringify(byGrade)}, ${records.filter((kit) => !existingById.has(kit.kit_id)).length} new.`);
}

if (/(^|[\\/])import_effect_parts\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`import:effects: ${error.message}`);
    process.exit(1);
  });
}
