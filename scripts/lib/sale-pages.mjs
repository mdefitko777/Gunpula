// data/sale-pages.json — what each folded sale page said before it left the catalog.
//
// clean_catalog.mjs folds Premium Bandai 【再販】/【２次：…発送】/【抽選販売】 pages and
// Tamashii （2027年5月発送分） batch pages into the product they sell, and the
// importers skip every folded (retired) id afterwards. The page itself is the resale
// signal, so its listing name, shipping month, order window and URL are kept here:
// clean_catalog.mjs writes the pages it folds, import_pbandai_wayback.mjs and
// import_bandai_collectibles.mjs the retired pages they meet again (a later batch on
// the same page, a new shipping month). scripts/build_restocks.mjs turns the ledger
// into restock events (data/atlas/restocks.json).
//
// Shape: { schema: 1, updated_at, description, pages: { <page kit_id>: page } }
//   page = { source, url, name, ship, price_jpy, order_opens_at, order_closes_at,
//            first_seen, to }  (null / empty fields are left out)
//   ship       YYYY-MM shipping / release month the page sold
//   first_seen YYYY-MM-DD the bot first wrote the page down (or first published it)
//   to         kit_id the page was folded into when it was written (the builder follows
//              data/kit-aliases.json for later moves)
import { readFile, writeFile } from "node:fs/promises";

export const SALE_PAGES_PATH = "data/sale-pages.json";

const FIELDS = ["source", "url", "name", "ship", "price_jpy", "order_opens_at", "order_closes_at", "first_seen", "to"];

export function emptySalePages() {
  return { schema: 1, updated_at: null, pages: {} };
}

export function seoulToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** "2026-10" from "2026-10", "2026-10-24", "2026年10月" (NFKC) … else null */
export function monthOf(value) {
  const text = String(value ?? "").normalize("NFKC");
  let match = /^(\d{4})-(\d{2})/.exec(text);
  if (!match) match = /(\d{4})年\s*(\d{1,2})月/.exec(text);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${String(month).padStart(2, "0")}` : null;
}

function compact(page) {
  const out = {};
  for (const field of FIELDS) {
    const value = page[field];
    if (value != null && value !== "") out[field] = value;
  }
  return out;
}

/**
 * Ledger record of a catalog record (a PB Wayback page or a Tamashii page), or of an
 * importer's card/product ({ name, release_date, price_jpy, order_opens_at, … }).
 */
export function salePageFromKit(kit, { to = null, firstSeen = null, source = null } = {}) {
  const ref = (kit.source_refs || [])[0] || {};
  return compact({
    source: source || ref.source_id || null,
    url: ref.url || (kit.source_urls || [])[0] || null,
    // A PB page that already lost its sale tags in the display name keeps them here.
    name: kit.premium_bandai?.listing_name || kit.names?.ja || null,
    ship: monthOf(kit.release_date),
    price_jpy: Number.isFinite(kit.price_jpy) ? kit.price_jpy : null,
    order_opens_at: kit.premium_bandai?.order_opens_at || null,
    order_closes_at: kit.premium_bandai?.order_closes_at || null,
    first_seen: firstSeen,
    to,
  });
}

/**
 * Adds or updates one page. Fields already known stay unless the new value is set
 * (a later capture can add the order window or move the shipping month); first_seen
 * keeps the earliest date. Returns true when the ledger changed.
 */
export function upsertSalePage(doc, kitId, page) {
  if (!kitId || !page) return false;
  const pages = doc.pages || (doc.pages = {});
  const before = pages[kitId];
  const next = compact({ ...(before || {}), ...compact(page) });
  if (before?.first_seen && (!next.first_seen || before.first_seen < next.first_seen)) next.first_seen = before.first_seen;
  if (JSON.stringify(before) === JSON.stringify(next)) return false;
  pages[kitId] = next;
  return true;
}

export async function readSalePages(path = SALE_PAGES_PATH) {
  try {
    const doc = JSON.parse(await readFile(path, "utf8"));
    return { ...emptySalePages(), ...doc, pages: doc.pages || {} };
  } catch {
    return emptySalePages();
  }
}

/** Writes the ledger (keys sorted) when [changed]; updated_at moves only then. */
export async function writeSalePages(doc, { changed = true, path = SALE_PAGES_PATH, today = seoulToday() } = {}) {
  if (!changed) return false;
  const entries = Object.entries(doc.pages || {}).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
  const description =
    "Sale pages (Premium Bandai 再販 / N次発送 / 抽選販売 pages, Tamashii 発送分 batches) folded into another catalog record by clean_catalog.mjs, kept so scripts/build_restocks.mjs can list resale events. Keyed by the folded page's kit_id; `to` is the record it was folded into.";
  // One page per line: small diffs when the daily run adds a page.
  const lines = entries.map(([id, page]) => `  ${JSON.stringify(id)}: ${JSON.stringify(page)}`);
  const text = `{\n "schema": 1,\n "updated_at": ${JSON.stringify(today)},\n "description": ${JSON.stringify(description)},\n "pages": {\n${lines.join(",\n")}\n }\n}\n`;
  await writeFile(path, text, "utf8");
  return true;
}
