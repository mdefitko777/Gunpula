import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const CATALOG_PATH = "data/kits.json";
const INDEX_PATH = "data/premium-bandai-jp-index.json";
const PB_CACHE_PATH = "data/pbandai.json";
const SOURCE_ID = "p_bandai_jp";
const BANDai_SPIRITS_SOURCE_ID = "bandai_spirits_products_jp";
const DEFAULT_SCAN_LIMIT = 240;
const DEFAULT_CONCURRENCY = 6;
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);
const flags = new Set(args.filter((arg) => arg.startsWith("--") && !arg.includes("=")));

const fullScan = flags.has("--full") || process.env.PB_SCAN_FULL === "true";
const forceScan = flags.has("--force");
const scanLimit = fullScan ? Number.POSITIVE_INFINITY : Number(options.scanLimit || process.env.PB_SCAN_LIMIT || DEFAULT_SCAN_LIMIT);
const concurrency = Number(options.concurrency || process.env.PB_SCAN_CONCURRENCY || DEFAULT_CONCURRENCY);
const detailTimeoutMs = Number(options.timeoutMs || process.env.PB_DETAIL_TIMEOUT_MS || 8000);

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function nowIso() {
  return new Date().toISOString();
}

function localDateKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(date);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isBandaiSpiritsPremiumCandidate(kit) {
  return ["gundam", "armored_core"].includes(kit.franchise) && (kit.source_refs || []).some((ref) => ref.source_id === BANDai_SPIRITS_SOURCE_ID);
}

function bandaiSpiritsDetailUrl(kit) {
  return (
    (kit.source_refs || []).find((ref) => ref.source_id === BANDai_SPIRITS_SOURCE_ID && /\/products\/search\/detail\.php/.test(ref.url))?.url ||
    (kit.source_urls || []).find((url) => /bandaispirits\.co\.jp\/products\/search\/detail\.php/.test(url)) ||
    null
  );
}

function pBandaiUrlsFromHtml(html) {
  return unique(
    [...html.matchAll(/https?:\/\/p-bandai\.jp\/item\/item-\d+\/?/g)]
      .map((match) => match[0].replace(/[?#].*$/, "").replace(/\/?$/, "/")),
  );
}

async function fetchText(url) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      String(Math.ceil(detailTimeoutMs / 1000)),
      "--user-agent",
      "Gunpula catalog importer (+https://github.com/mdefitko777/Gunpula)",
      "--header",
      "Accept: text/html,application/xhtml+xml",
      url,
    ],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  if (!stdout) {
    throw new Error("empty response");
  }
  return stdout;
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index], index);
      }
    }),
  );
}

function normalizeIndex(index) {
  const entries = Array.isArray(index?.entries) ? index.entries : [];
  return {
    schema_version: 1,
    generated_at: index?.generated_at || null,
    updated_at: index?.updated_at || null,
    direct_p_bandai_status: index?.direct_p_bandai_status || "blocked",
    scan_mode: index?.scan_mode || "incremental",
    entries,
  };
}

async function scanPremiumBandaiLinks(candidates, previousIndex) {
  const previousByUrl = new Map(previousIndex.entries.map((entry) => [entry.detail_url, entry]));
  const selected = [];
  for (const candidate of candidates) {
    const previous = previousByUrl.get(candidate.detail_url);
    if (!candidate.inScanWindow) {
      continue;
    }
    if (!forceScan && previous && candidate.inScanWindow && localDateKey(previous.scanned_at) === today()) {
      continue;
    }
    selected.push(candidate);
  }

  const results = [];
  let failed = 0;
  await mapLimit(selected, concurrency, async (candidate) => {
    try {
      const html = await fetchText(candidate.detail_url);
      results.push({
        kit_id: candidate.kit.kit_id,
        detail_url: candidate.detail_url,
        title: candidate.kit.names?.ja || candidate.kit.kit_id,
        p_bandai_urls: pBandaiUrlsFromHtml(html),
        scanned_at: nowIso(),
      });
    } catch (error) {
      failed += 1;
      results.push({
        kit_id: candidate.kit.kit_id,
        detail_url: candidate.detail_url,
        title: candidate.kit.names?.ja || candidate.kit.kit_id,
        p_bandai_urls: previousByUrl.get(candidate.detail_url)?.p_bandai_urls || [],
        scanned_at: previousByUrl.get(candidate.detail_url)?.scanned_at || null,
        last_error: error.message,
      });
    }
  });

  const merged = new Map(previousIndex.entries.map((entry) => [entry.detail_url, entry]));
  for (const result of results) {
    merged.set(result.detail_url, result);
  }

  return {
    index: {
      schema_version: 1,
      generated_at: nowIso(),
      updated_at: today(),
      direct_p_bandai_status: "blocked",
      scan_mode: fullScan ? "full" : "incremental",
      scan_limit: Number.isFinite(scanLimit) ? scanLimit : null,
      scanned_this_run: selected.length,
      failed_this_run: failed,
      hit_count: [...merged.values()].filter((entry) => entry.p_bandai_urls?.length).length,
      entries: [...merged.values()].sort((a, b) => String(b.scanned_at || "").localeCompare(String(a.scanned_at || ""))),
    },
    scanned: selected.length,
    failed,
  };
}

function applyPremiumLinks(catalog, index) {
  const byDetailUrl = new Map(index.entries.map((entry) => [entry.detail_url, entry]));
  let changed = 0;
  let linked = 0;

  const kits = catalog.kits.map((kit) => {
    const detailUrl = bandaiSpiritsDetailUrl(kit);
    const entry = detailUrl ? byDetailUrl.get(detailUrl) : null;
    const pBandaiUrls = unique(entry?.p_bandai_urls || []);
    if (!pBandaiUrls.length) {
      return kit;
    }

    linked += 1;
    const before = JSON.stringify({
      source_urls: kit.source_urls,
      source_refs: kit.source_refs,
      tags: kit.tags,
      notes: kit.notes,
    });

    const source_urls = unique([...(kit.source_urls || []), ...pBandaiUrls]);
    const existingRefs = kit.source_refs || [];
    const pBandaiRefs = pBandaiUrls
      .filter((url) => !existingRefs.some((ref) => ref.source_id === SOURCE_ID && ref.url === url))
      .map((url) => ({
        source_id: SOURCE_ID,
        url,
        fields: ["source_urls", "sales_channel"],
        confidence: "high",
      }));
    const tags = unique([...(kit.tags || []), "premium bandai jp", "p-bandai jp", "official store"]);
    const note = "Premium Bandai Japan official store link recovered from the Japanese BANDAI SPIRITS product page.";
    const notes = kit.notes?.includes(note) ? kit.notes : [kit.notes, note].filter(Boolean).join(" ");

    const updated = {
      ...kit,
      source_urls,
      source_refs: [...existingRefs, ...pBandaiRefs],
      tags,
      notes,
    };

    const after = JSON.stringify({
      source_urls: updated.source_urls,
      source_refs: updated.source_refs,
      tags: updated.tags,
      notes: updated.notes,
    });
    if (before !== after) {
      changed += 1;
    }
    return updated;
  });

  return {
    catalog: changed ? { ...catalog, updated_at: today(), kits } : catalog,
    changed,
    linked,
  };
}

function formatPrice(price) {
  return Number.isInteger(price) ? `¥${price.toLocaleString("ja-JP")}` : "";
}

function categoryForKit(kit) {
  if (kit.franchise === "armored_core") return "armored_core";
  if (kit.franchise === "pokemon") return "pokemon";
  if (kit.franchise === "fate") return "fate";
  return "gunpla";
}

function premiumBandaiCache(catalog, previousCache) {
  const previousManual = (previousCache.items || []).filter((item) => item.manual || item.fetch_status === "blocked");
  const generated = [];
  for (const kit of catalog.kits || []) {
    const urls = unique([
      ...(kit.source_urls || []),
      ...(kit.source_refs || []).filter((ref) => ref.source_id === SOURCE_ID).map((ref) => ref.url),
    ]).filter((url) => /p-bandai\.jp\/item\/item-\d+\/?/i.test(url));
    for (const url of urls) {
      const id = /item-(\d+)/i.exec(url)?.[1] ? `item-${/item-(\d+)/i.exec(url)[1]}` : kit.kit_id;
      generated.push({
        id,
        kit_id: kit.kit_id,
        title: kit.names?.ja || kit.names?.en || kit.names?.zh || kit.kit_id,
        price: formatPrice(kit.price_jpy),
        status: kit.is_limited ? "Premium Bandai" : "",
        image: kit.images?.box_art_url || kit.gallery_image_urls?.[0] || "",
        url,
        source: "premium_bandai_jp",
        category: categoryForKit(kit),
        franchise: kit.franchise,
        updated_at: new Date().toISOString(),
        fetch_status: "ok",
        error_message: "",
      });
    }
  }

  const byKey = new Map();
  for (const item of [...previousManual, ...generated]) {
    byKey.set(item.url || item.id, item);
  }
  return {
    schema_version: 1,
    source: "premium_bandai_jp",
    updated_at: new Date().toISOString(),
    items: [...byKey.values()].sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.title).localeCompare(String(b.title), "ja")),
  };
}

async function main() {
  const catalog = await readJson(CATALOG_PATH, { kits: [] });
  const previousIndex = normalizeIndex(await readJson(INDEX_PATH, null));
  const previousCache = await readJson(PB_CACHE_PATH, { items: [] });

  const candidates = catalog.kits
    .filter(isBandaiSpiritsPremiumCandidate)
    .map((kit) => ({ kit, detail_url: bandaiSpiritsDetailUrl(kit) }))
    .filter((item) => item.detail_url)
    .sort((a, b) => String(b.kit.release_date || "").localeCompare(String(a.kit.release_date || "")))
    .map((candidate, index) => ({ ...candidate, inScanWindow: fullScan || index < scanLimit }));

  const { index, scanned, failed } = await scanPremiumBandaiLinks(candidates, previousIndex);
  const { catalog: updatedCatalog, changed, linked } = applyPremiumLinks(catalog, index);

  await writeFile(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  if (changed) {
    await writeFile(CATALOG_PATH, `${JSON.stringify(updatedCatalog, null, 2)}\n`, "utf8");
  }
  await writeFile(PB_CACHE_PATH, `${JSON.stringify(premiumBandaiCache(updatedCatalog, previousCache), null, 2)}\n`, "utf8");

  console.log(
    `Premium Bandai Japan: scanned ${scanned}, failed ${failed}, index hits ${index.hit_count}, linked ${linked}, changed ${changed}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
