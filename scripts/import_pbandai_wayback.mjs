// Premium Bandai Japan via the Wayback Machine.
//
// p-bandai.jp is geo-blocked: every path (including robots.txt and sitemap.xml)
// answers non-Japanese IPs with the same ~2.2KB「アクセス制限」page, so the
// direct crawler can never run from CI. archive.org is not on that block list
// and holds real Japanese product pages — snapshots stay current to within days
// — so the catalog reads Premium Bandai through the archive instead.
//
// Two passes:
//   1. enrich  — for PB links already recovered from BANDAI SPIRITS pages, pull
//                the fields only the PB page carries (price, order window,
//                shipping month, availability).
//   2. discover — list recently archived item pages via the CDX API and import
//                the ones belonging to a franchise this catalog tracks.
//
// Both passes are incremental and budgeted: archive.org is a free service, so a
// daily run touches a bounded number of snapshots and records what it saw.
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const INDEX_PATH = "data/premium-bandai-wayback-index.json";
const SOURCE_ID = "p_bandai_wayback";
const PB_ITEM_RE = /^https?:\/\/p-bandai\.jp\/item\/item-(\d+)\/?$/;

// The archived block page is ~2.2KB; real product pages run 90KB+. Anything
// small is a capture made while archive.org itself got redirected.
const MIN_REAL_PAGE_BYTES = 20000;

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const limit = Number(args.get("limit") || 200);
const discoverDays = Number(args.get("discover-days") || 45);
const concurrency = Math.max(1, Math.min(4, Number(args.get("concurrency") || 3)));
const force = args.get("force") === "true";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapLimit(items, workers, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index], index);
        // Stay a polite guest on a free archive.
        await sleep(250);
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Wayback access
// ---------------------------------------------------------------------------

// A far-future timestamp makes Wayback serve the most recent capture, so the
// importer never has to page through the full CDX history of one item.
async function fetchSnapshot(itemUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://web.archive.org/web/29991231id_/${itemUrl}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "GunpulaCatalog/2.0 (+https://github.com/mdefitko777/Gunpula)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_REAL_PAGE_BYTES) throw new Error(`snapshot too small (${buffer.length}B)`);
    // PB serves Shift-JIS; the charset only shows up in the archived headers.
    const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") || "")?.[1] || "shift_jis";
    let html;
    try {
      html = new TextDecoder(charset).decode(buffer);
    } catch {
      html = new TextDecoder("shift_jis").decode(buffer);
    }
    if (/アクセス制限|global_newpc/.test(html)) throw new Error("archived copy is the geo-block page");
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRecentItemUrls(sinceDate) {
  const query = new URLSearchParams({
    url: "p-bandai.jp/item/item-*",
    fl: "original,timestamp,length",
    filter: "statuscode:200",
    collapse: "urlkey",
    from: sinceDate,
    limit: String(Math.max(limit * 8, 2000)),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`https://web.archive.org/cdx/search/cdx?${query}`, {
      signal: controller.signal,
      headers: { "User-Agent": "GunpulaCatalog/2.0 (+https://github.com/mdefitko777/Gunpula)" },
    });
    if (!response.ok) throw new Error(`CDX HTTP ${response.status}`);
    const text = await response.text();
    const urls = [];
    for (const line of text.split("\n")) {
      const [original, , length] = line.trim().split(/\s+/);
      if (!original) continue;
      // Skip captures taken while archive.org itself was served the block page.
      if (Number(length) && Number(length) < MIN_REAL_PAGE_BYTES / 4) continue;
      const normalized = normalizeItemUrl(original);
      if (normalized) urls.push(normalized);
    }
    return [...new Set(urls)];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItemUrl(raw) {
  const cleaned = String(raw).replace(/[?#].*$/, "").replace(/\/?$/, "/").replace(/^http:/, "https:");
  return PB_ITEM_RE.test(cleaned) ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function plainText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // A malformed block must not lose the rest of the page.
    }
  }
  return blocks;
}

function findProduct(blocks) {
  for (const block of blocks.flatMap((b) => (Array.isArray(b) ? b : [b]))) {
    if (block && block["@type"] === "Product") return block;
  }
  return null;
}

function findBreadcrumbs(blocks) {
  for (const block of blocks.flatMap((b) => (Array.isArray(b) ? b : [b]))) {
    if (block && block["@type"] === "BreadcrumbList") {
      return (block.itemListElement || []).map((entry) => decodeEntities(entry?.name || "")).filter(Boolean);
    }
  }
  return [];
}

// "2026年10月発送予定" / "2026年10月下旬発送予定" -> 2026-10
function shippingMonth(text) {
  const match = /(\d{4})年\s*(\d{1,2})月[^。]{0,6}?発送/.exec(text);
  return match ? `${match[1]}-${String(match[2]).padStart(2, "0")}` : null;
}

// "予約受付開始 2026年7月19日(日) 10時" -> 2026-07-19
// `label` carries alternations, so it has to be wrapped: without the
// non-capturing group the first branch matches with no capture groups at all
// and the result reads "undefined-undefined-undefined".
function dateAfter(text, label) {
  const match = new RegExp(`(?:${label})[^0-9]{0,12}(\\d{4})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日`).exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function availabilityLabel(availability = "") {
  if (/PreOrder/i.test(availability)) return "preorder";
  if (/InStock/i.test(availability)) return "in_stock";
  if (/SoldOut|OutOfStock/i.test(availability)) return "sold_out";
  return null;
}

function parseSnapshot(html, itemUrl) {
  const blocks = jsonLdBlocks(html);
  const product = findProduct(blocks);
  if (!product?.name) return null;
  const text = plainText(html);
  const crumbs = findBreadcrumbs(blocks);
  const price = Number(product.offers?.price);
  return {
    item_url: itemUrl,
    item_id: PB_ITEM_RE.exec(itemUrl)?.[1] || null,
    name: decodeEntities(product.name),
    description: decodeEntities(product.description || ""),
    image: typeof product.image === "string" ? product.image : product.image?.[0] || null,
    price_jpy: Number.isFinite(price) && price > 0 ? price : null,
    availability: availabilityLabel(product.offers?.availability || ""),
    // crumbs[0] is HOME; the middle entry is the work/character shop.
    work_title: crumbs.length > 2 ? crumbs[1] : null,
    release_date: shippingMonth(text),
    order_opens_at: dateAfter(text, "予約受付開始|受注開始|販売開始"),
    order_closes_at: dateAfter(text, "予約受付終了|受注締切|販売終了"),
  };
}

// ---------------------------------------------------------------------------
// Franchise matching — PB Japan sells far beyond this catalog's five worlds, so
// discovery only keeps items that clearly belong to one of them.
// ---------------------------------------------------------------------------
const FRANCHISE_RULES = [
  { franchise: "gundam", grade_code: "GUNDAM_MERCH", universe: "Gundam", test: /ガンダム|GUNDAM|ザク|ZAKU|シャア|ジオン|機動戦士|ガンプラ/i },
  { franchise: "armored_core", grade_code: "AC_SMP", universe: "Armored Core", test: /アーマード・?コア|ARMORED CORE|ネクスト|RUBICON/i },
  { franchise: "pokemon", grade_code: "POKE_FIGURE", universe: "Pokemon", test: /ポケモン|ポケットモンスター|POKEMON|POKÉMON|ピカチュウ/i },
  { franchise: "fate", grade_code: "FATE_GOODS", universe: "Fate", test: /Fate\/|フェイト\/|型月|Grand Order|セイバー|FGO/i },
  { franchise: "beyblade", grade_code: "BEYBLADE_X", universe: "Beyblade X", test: /ベイブレード|BEYBLADE|ベイバトル/i },
];

function matchFranchise(product) {
  const haystack = `${product.name} ${product.work_title || ""} ${product.description}`;
  return FRANCHISE_RULES.find((rule) => rule.test.test(haystack)) || null;
}

function slugifyId(itemId) {
  return `pbandai-wb-${itemId}`;
}

function toKit(product, rule) {
  return {
    kit_id: slugifyId(product.item_id),
    franchise: rule.franchise,
    grade_code: rule.grade_code,
    subline: "プレミアムバンダイ",
    scale: "non-scale",
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: {
      box_art_url: product.image || null,
      box_art_source_id: product.image ? SOURCE_ID : null,
    },
    gallery_image_urls: product.image ? [product.image] : [],
    universe: rule.universe,
    work_title: product.work_title || rule.universe,
    release_date: product.release_date,
    price_jpy: product.price_jpy,
    is_limited: true,
    is_premium_bandai: true,
    premium_bandai: {
      availability: product.availability,
      order_opens_at: product.order_opens_at,
      order_closes_at: product.order_closes_at,
      captured_via: "wayback",
    },
    data_status: "needs_review",
    source_urls: [product.item_url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: product.item_url,
        fields: ["names", "images", "price_jpy", "release_date"],
        confidence: "medium",
      },
    ],
    tags: ["premium bandai", "wayback"],
    notes: "Imported from an archive.org snapshot of the Premium Bandai Japan product page.",
  };
}

// PB-only fields layered onto a kit the catalog already knows about. The name,
// grade and franchise stay as the primary source set them.
function enrichKit(kit, product) {
  const next = { ...kit };
  if (product.price_jpy && !Number.isFinite(kit.price_jpy)) next.price_jpy = product.price_jpy;
  if (product.release_date && !kit.release_date) next.release_date = product.release_date;
  if (!kit.images?.box_art_url && product.image) {
    next.images = { ...kit.images, box_art_url: product.image, box_art_source_id: SOURCE_ID };
  }
  next.is_premium_bandai = true;
  next.premium_bandai = {
    ...(kit.premium_bandai || {}),
    availability: product.availability,
    order_opens_at: product.order_opens_at,
    order_closes_at: product.order_closes_at,
    captured_via: "wayback",
  };
  const refs = kit.source_refs || [];
  if (!refs.some((ref) => ref.source_id === SOURCE_ID && ref.url === product.item_url)) {
    next.source_refs = [
      ...refs,
      {
        source_id: SOURCE_ID,
        url: product.item_url,
        fields: ["price_jpy", "release_date", "availability"],
        confidence: "medium",
      },
    ];
  }
  return next;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const index = await readJson(INDEX_PATH, { schema_version: 1, entries: {} });
index.entries = index.entries || {};

const kitsByPbUrl = new Map();
for (const kit of catalog.kits) {
  for (const url of kit.source_urls || []) {
    const normalized = normalizeItemUrl(url);
    if (normalized) kitsByPbUrl.set(normalized, kit);
  }
}

// Pass 1: known PB links that have not been enriched yet (or are stale).
const enrichTargets = [...kitsByPbUrl.keys()].filter((url) => force || !index.entries[url]);

// Pass 2: recently archived item pages the catalog has never seen.
const sinceDate = new Date(Date.now() - discoverDays * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
let discovered = [];
try {
  const recent = await fetchRecentItemUrls(sinceDate);
  discovered = recent.filter((url) => !kitsByPbUrl.has(url) && (force || !index.entries[url]));
  console.log(`CDX: ${recent.length} archived item pages since ${sinceDate}, ${discovered.length} new to the catalog.`);
} catch (error) {
  // Discovery is the optional half; enrichment still runs if CDX is unhappy.
  console.warn(`CDX listing failed: ${error.message}`);
}

const budget = Math.max(0, limit);
const targets = [
  ...enrichTargets.slice(0, Math.ceil(budget / 2)).map((url) => ({ url, mode: "enrich" })),
  ...discovered.slice(0, Math.floor(budget / 2)).map((url) => ({ url, mode: "discover" })),
];

if (!targets.length) {
  console.log("Nothing to fetch; every known Premium Bandai link is already enriched.");
  process.exit(0);
}

const kitsById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
let enriched = 0;
let added = 0;
let skipped = 0;
let failed = 0;

await mapLimit(targets, concurrency, async ({ url, mode }) => {
  try {
    const product = parseSnapshot(await fetchSnapshot(url), url);
    if (!product) {
      index.entries[url] = { checked_at: nowIso(), status: "unparsed" };
      skipped += 1;
      return;
    }
    if (mode === "enrich") {
      const kit = kitsByPbUrl.get(url);
      kitsById.set(kit.kit_id, enrichKit(kitsById.get(kit.kit_id) || kit, product));
      enriched += 1;
      index.entries[url] = { checked_at: nowIso(), status: "enriched", kit_id: kit.kit_id };
      return;
    }
    const rule = matchFranchise(product);
    if (!rule) {
      // Most PB stock is outside this catalog's worlds; remember it so the same
      // page is not fetched again tomorrow.
      index.entries[url] = { checked_at: nowIso(), status: "off_catalog" };
      skipped += 1;
      return;
    }
    const kit = toKit(product, rule);
    if (!kitsById.has(kit.kit_id)) added += 1;
    kitsById.set(kit.kit_id, { ...(kitsById.get(kit.kit_id) || {}), ...kit });
    index.entries[url] = { checked_at: nowIso(), status: "imported", kit_id: kit.kit_id };
  } catch (error) {
    failed += 1;
    index.entries[url] = { checked_at: nowIso(), status: "error", message: String(error.message).slice(0, 120) };
  }
});

if (!enriched && !added) {
  console.log(`Premium Bandai (Wayback): nothing usable this run (${skipped} skipped, ${failed} failed); catalog untouched.`);
  await writeFile(INDEX_PATH, `${JSON.stringify({ ...index, updated_at: nowIso() }, null, 2)}\n`, "utf8");
  process.exit(0);
}

const merged = [...kitsById.values()].sort((a, b) => String(a.kit_id).localeCompare(String(b.kit_id)));
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
await writeFile(
  INDEX_PATH,
  `${JSON.stringify(
    {
      schema_version: 1,
      updated_at: nowIso(),
      direct_p_bandai_status: "blocked",
      access_method: "wayback_machine",
      entries: index.entries,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `Premium Bandai (Wayback): enriched ${enriched}, added ${added}, skipped ${skipped}, failed ${failed}; catalog now ${merged.length} records.`,
);
