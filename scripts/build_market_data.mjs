import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const now = new Date().toISOString();

const DATA = {
  kits: "data/kits.json",
  marketSources: "data/market_sources.json",
  manualLinks: "data/market_manual_links.json",
  autoListings: "data/market_auto_listings.json",
  keywordOverrides: "data/market_keyword_overrides.json",
  searchIndex: "data/search-index.json",
  searchManifest: "data/search/manifest.json",
  exchangeRates: "data/exchange-rates.json",
  marketPrices: "data/market-prices.json",
  imageAssets: "data/image-assets.json",
  androidPackage: "data/android-package.json",
};

const CURRENCY_SYMBOLS = ["KRW", "JPY", "CNY", "USD", "EUR"];
const IMAGE_ROOTS = ["app/assets/catalog", "app/assets/kotobukiya-ac"];
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(join(rootDir, path), "utf8"));
  } catch (error) {
    if (fallback !== null && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(path, payload) {
  const absolute = join(rootDir, path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function pathExists(path) {
  try {
    await stat(join(rootDir, path));
    return true;
  } catch {
    return false;
  }
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[<>【】\[\]{}()（）"'“”‘’・·:：/\\|,，.!！?？#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactName(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeTokens(kit) {
  return unique([kit.grade_code, kit.subline, kit.scale].flatMap((value) => String(value || "").split(/[ /]+/)));
}

function aliasTerms(text, aliases) {
  const haystack = normalize(text);
  const out = [];
  for (const [needle, values] of Object.entries(aliases || {})) {
    if (haystack.includes(normalize(needle)) || values.some((value) => haystack.includes(normalize(value)))) {
      out.push(needle, ...values);
    }
  }
  return out;
}

function buildKitKeywords(kit, overrides) {
  const names = kit.names || {};
  const baseNames = unique([names.zh, names.ko, names.en, names.ja].map(compactName));
  const seriesLabels = unique([kit.series?.labels?.zh, kit.series?.labels?.ko, kit.series?.labels?.en, kit.series?.labels?.ja, kit.series?.key, kit.work_title]);
  const lineTokens = gradeTokens(kit);
  const allText = [...baseNames, ...seriesLabels, ...lineTokens, kit.franchise].join(" ");
  const aliases = aliasTerms(allText, overrides.aliases);
  const kitOverride = overrides.kit_overrides?.[kit.kit_id] || {};
  const include = unique([...(kitOverride.include || []), ...aliases, ...baseNames, ...seriesLabels, ...lineTokens, kit.franchise]);
  const exclude = unique([...(overrides.global_exclude_terms || []), ...(kitOverride.exclude || [])]);
  const primaryName = baseNames.find((name) => /[A-Za-z0-9가-힣\u4e00-\u9fff]/.test(name)) || kit.kit_id;
  const primaryQuery = unique([kit.grade_code, kit.scale, primaryName].filter(Boolean)).join(" ");
  const querySeeds = unique([
    primaryQuery,
    `${kit.grade_code || ""} ${names.en || primaryName}`,
    `${kit.grade_code || ""} ${names.zh || primaryName}`,
    `${kit.grade_code || ""} ${names.ko || primaryName}`,
    `${kit.grade_code || ""} ${names.ja || primaryName}`,
    ...aliases.map((alias) => `${kit.grade_code || ""} ${alias}`),
  ]).slice(0, 8);

  return {
    kit_id: kit.kit_id,
    franchise: kit.franchise,
    series_key: kit.series?.key || "unknown",
    product_line: kit.grade_code || "unknown",
    display_name: primaryName,
    keywords: include,
    negative_keywords: exclude,
    queries: querySeeds,
    search_blob: normalize([kit.kit_id, ...include].join(" ")),
  };
}

async function fetchExchangeRates(previousRates) {
  try {
    const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=KRW,JPY,CNY,USD");
    if (!response.ok) throw new Error(`Frankfurter ${response.status}`);
    const data = await response.json();
    const rates = data.rates || {};
    if (!rates.KRW) throw new Error("Frankfurter response missing KRW");
    const toKrw = { KRW: 1 };
    for (const currency of CURRENCY_SYMBOLS) {
      if (currency === "KRW") continue;
      if (currency === "EUR") {
        toKrw.EUR = rates.KRW;
      } else if (rates[currency]) {
        toKrw[currency] = rates.KRW / rates[currency];
      }
    }
    return {
      base: "KRW",
      provider: "Frankfurter",
      provider_url: "https://frankfurter.dev/",
      date: data.date,
      fetched_at: now,
      rates_to_krw: toKrw,
      fetch_status: "ok",
    };
  } catch (error) {
    if (previousRates?.rates_to_krw) {
      return { ...previousRates, fetched_at: now, fetch_status: "cached", error_message: error.message };
    }
    return {
      base: "KRW",
      provider: "Frankfurter",
      provider_url: "https://frankfurter.dev/",
      date: null,
      fetched_at: now,
      rates_to_krw: { KRW: 1 },
      fetch_status: "error",
      error_message: error.message,
    };
  }
}

function convertToKrw(amount, currency, rates) {
  const value = Number(amount);
  const rate = rates.rates_to_krw?.[currency];
  if (!Number.isFinite(value) || !Number.isFinite(rate)) return null;
  return Math.round(value * rate);
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function summarizeListings(kits, sources, manualDoc, autoDoc, rates, taxProfiles) {
  const kitIds = new Set(kits.map((kit) => kit.kit_id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const listings = [];
  const byKit = {};
  const sourceStats = new Map(sources.map((source) => [source.id, { source: source.id, samples: 0, matched: 0 }]));
  const combinedRaw = [...(manualDoc.listings || []), ...(autoDoc.listings || [])];

  for (const raw of combinedRaw) {
    if (!kitIds.has(raw.kit_id) || !sourceById.has(raw.source)) continue;
    const source = sourceById.get(raw.source);
    const currency = raw.currency || source.currency || "KRW";
    const subtotal = Number(raw.price || 0) + Number(raw.shipping_price || 0);
    const krw = convertToKrw(subtotal, currency, rates);
    const profile = taxProfiles[source.tax_profile] || taxProfiles.normal || { vat_rate: 0, international_fee_rate: 0 };
    const normalKrw = krw;
    const conservativeKrw = krw === null ? null : Math.round(krw * (1 + Number(profile.vat_rate || 0) + Number(profile.international_fee_rate || 0)));
    const item = {
      id: `${raw.source}:${raw.kit_id}:${Buffer.from(String(raw.url || raw.title || Date.now())).toString("base64url").slice(0, 14)}`,
      kit_id: raw.kit_id,
      source: raw.source,
      title: raw.title || "",
      url: raw.url || "",
      condition: raw.condition || "unknown",
      status: raw.status || "active",
      price: Number(raw.price || 0),
      shipping_price: Number(raw.shipping_price || 0),
      currency,
      price_krw: normalKrw,
      conservative_krw: conservativeKrw,
      captured_at: raw.captured_at || now,
      confidence: raw.confidence || "manual",
      notes: raw.notes || "",
    };
    listings.push(item);
    if (!byKit[item.kit_id]) {
      byKit[item.kit_id] = { kit_id: item.kit_id, samples: 0, sources: {}, min_krw: null, median_krw: null, conservative_median_krw: null, updated_at: now };
    }
    const bucket = byKit[item.kit_id];
    bucket.samples += 1;
    bucket.sources[item.source] = (bucket.sources[item.source] || 0) + 1;
    sourceStats.get(item.source).samples += 1;
    sourceStats.get(item.source).matched += 1;
  }

  for (const bucket of Object.values(byKit)) {
    const ownListings = listings.filter((listing) => listing.kit_id === bucket.kit_id);
    const prices = ownListings.map((listing) => listing.price_krw).filter(Number.isFinite);
    const conservative = ownListings.map((listing) => listing.conservative_krw).filter(Number.isFinite);
    bucket.min_krw = prices.length ? Math.min(...prices) : null;
    bucket.median_krw = median(prices);
    bucket.conservative_median_krw = median(conservative);
  }

  return {
    listings,
    byKit,
    source_stats: [...sourceStats.values()],
  };
}

function sourceStatuses(sources) {
  return sources.map((source) => {
    const missing = (source.api_env || []).filter((name) => !process.env[name]);
    const ready =
      source.mode === "api" ? missing.length === 0 : source.mode === "low_frequency_cache" || source.mode === "manual_or_vps_cache" ? "cache" : "manual";
    return {
      id: source.id,
      label: source.label,
      market: source.market,
      currency: source.currency,
      mode: source.mode,
      priority: source.priority,
      ready,
      missing_env: missing,
      search_url_template: source.search_url_template,
      tax_profile: source.tax_profile,
      notes: source.notes,
    };
  });
}

async function walkImages(dir) {
  const root = join(rootDir, dir);
  const files = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(root, entry.name);
      const child = `${dir}/${entry.name}`.replace(/\\/g, "/");
      if (entry.isDirectory()) {
        files.push(...(await walkImages(child)));
      } else if (IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const info = await stat(absolute);
        files.push({ path: child, bytes: info.size });
      }
    }
  } catch {
    return files;
  }
  return files;
}

async function buildImageAssets(kits) {
  const files = (await Promise.all(IMAGE_ROOTS.map(walkImages))).flat();
  const byRoot = {};
  let bytes = 0;
  for (const file of files) {
    bytes += file.bytes;
    const root = IMAGE_ROOTS.find((prefix) => file.path.startsWith(prefix)) || "other";
    byRoot[root] = (byRoot[root] || 0) + 1;
  }
  const localImageKits = kits.filter((kit) => JSON.stringify(kit.images || []).includes("app/assets") || JSON.stringify(kit.images || []).includes("./assets")).length;
  return {
    updated_at: now,
    image_files: files.length,
    total_bytes: bytes,
    total_mb: Number((bytes / 1024 / 1024).toFixed(2)),
    roots: byRoot,
    catalog_records_with_local_images: localImageKits,
    catalog_records: kits.length,
  };
}

function marketSummary({ sources, listings, byKit, rates, searchIndex, imageAssets }) {
  return {
    updated_at: now,
    sources_total: sources.length,
    api_ready: sources.filter((source) => source.ready === true).length,
    manual_ready: sources.filter((source) => source.ready === "manual" || source.ready === "cache").length,
    listing_samples: listings.length,
    priced_kits: Object.keys(byKit).length,
    keyword_records: searchIndex.length,
    exchange_status: rates.fetch_status,
    exchange_date: rates.date,
    image_files: imageAssets.image_files,
    image_total_mb: imageAssets.total_mb,
  };
}

async function writeSearchSplits(records) {
  const groups = new Map();
  for (const record of records.map((item) => ({
    kit_id: item.kit_id,
    franchise: item.franchise,
    series_key: item.series_key,
    product_line: item.product_line,
    display_name: item.display_name,
    queries: item.queries,
    search_blob: item.search_blob,
  }))) {
    const franchise = String(record.franchise || "unknown");
    groups.set(franchise, [...(groups.get(franchise) || []), record]);
  }
  const manifest = {
    schema_version: 1,
    updated_at: now,
    total: records.length,
    franchises: Object.fromEntries([...groups.entries()].map(([franchise, items]) => [franchise, items.length])),
  };
  await writeJson(DATA.searchManifest, manifest);
  for (const [franchise, items] of groups) {
    await writeJson(`data/search/search-${franchise}.json`, { schema_version: 1, updated_at: now, franchise, records: items });
  }
}

async function buildAndroidPackageStatus() {
  const capacitorConfig = await readJson("capacitor.config.json", {});
  const androidProjectPresent = await pathExists("android");
  const appVersion = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8")).version || null;
  return {
    updated_at: now,
    capacitor_config_present: Boolean(capacitorConfig?.appId),
    android_project_present: androidProjectPresent,
    app_version: appVersion ? `v${appVersion}` : null,
    app_id: capacitorConfig?.appId || null,
    app_name: capacitorConfig?.appName || null,
    web_dir: capacitorConfig?.webDir || "app",
    package_mode: "debug",
    release_build_supported: Boolean(process.env.ANDROID_KEYSTORE_BASE64 && process.env.ANDROID_KEYSTORE_PASSWORD && process.env.ANDROID_KEY_ALIAS && process.env.ANDROID_KEY_PASSWORD),
    debug_download_url: "https://github.com/mdefitko777/Gunpula/releases/download/android-latest/gunpula-debug.apk",
    release_download_url: "https://github.com/mdefitko777/Gunpula/releases/download/android-latest/gunpula-release.apk",
    commands: androidProjectPresent ? ["npm run android:sync", "npm run android:build"] : ["npm run android:add", "npm run android:sync", "npm run android:build"],
    notes: androidProjectPresent
      ? "Android project exists; run sync and build on a machine with Android Studio/JDK."
      : "Run npm run android:add once, then sync/build on a machine with Android Studio/JDK.",
  };
}

const kitsDoc = await readJson(DATA.kits);
const marketSourcesDoc = await readJson(DATA.marketSources);
const manualLinksDoc = await readJson(DATA.manualLinks, { listings: [] });
const autoListingsDoc = await readJson(DATA.autoListings, { listings: [] });
const keywordOverrides = await readJson(DATA.keywordOverrides, {});
const previousRates = await readJson(DATA.exchangeRates, {});
const sources = marketSourcesDoc.sources || [];
const sourceStatus = sourceStatuses(sources);
const rates = await fetchExchangeRates(previousRates);
const searchIndex = kitsDoc.kits.map((kit) => buildKitKeywords(kit, keywordOverrides));
const imageAssets = await buildImageAssets(kitsDoc.kits);
const androidPackage = await buildAndroidPackageStatus();
const market = summarizeListings(kitsDoc.kits, sources, manualLinksDoc, autoListingsDoc, rates, marketSourcesDoc.tax_profiles || {});

const marketPrices = {
  schema_version: 1,
  updated_at: now,
  sources: sourceStatus,
  tax_profiles: marketSourcesDoc.tax_profiles || {},
  exchange_rates: rates,
  summary: marketSummary({ sources: sourceStatus, listings: market.listings, byKit: market.byKit, rates, searchIndex, imageAssets }),
  source_stats: market.source_stats,
  listings: market.listings,
  by_kit: market.byKit,
};

await writeJson(DATA.exchangeRates, rates);
await writeJson(DATA.searchIndex, { schema_version: 1, updated_at: now, records: searchIndex });
await writeSearchSplits(searchIndex);
await writeJson(DATA.imageAssets, imageAssets);
await writeJson(DATA.androidPackage, androidPackage);
await writeJson(DATA.marketPrices, marketPrices);

console.log(`Market data built: ${searchIndex.length} keyword records, ${market.listings.length} price samples, ${imageAssets.image_files} cached images.`);
