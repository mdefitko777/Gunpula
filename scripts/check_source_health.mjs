import { readFile, writeFile } from "node:fs/promises";
import {
  KOTOBUKIYA_AC_PORTAL_URL,
  KOTOBUKIYA_AC_SHOP_URL,
  parseKotobukiyaShopListings,
} from "./lib/kotobukiya-shop.mjs";

const OUTPUT_PATH = "data/source-health.json";
const PB_INDEX_PATH = "data/premium-bandai-jp-index.json";
const P_BANDAI_URL = "https://p-bandai.jp/hobby/a0001/list-da20-n3/";
const BBX_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";

const CHECKS = [
  { source_id: "bandai_spirits_products_jp", url: "https://bandai-hobby.net/site/gunpla.html", expected: /ガンプラ|GUNPLA|BANDAI/i },
  { source_id: "bandai_candy_gundam_jp", url: "https://www.bandai.co.jp/candy/gundam/", expected: /GUNDAM|ガンダム|CONVERGE/i },
  { source_id: "bandai_gashapon_products_jp", url: "https://gashapon.jp/products/result.php?free=%E3%82%AC%E3%83%B3%E3%83%80%E3%83%A0", expected: /ガンダム|GUNDAM|商品/i },
  { source_id: "tamashii_web_jp", url: "https://tamashiiweb.com/item_character/gundam_series/", expected: /METAL BUILD|ROBOT魂|ガンダム/i },
  { source_id: "bandai_hobby_pokemon_global", url: "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/products/?category=select", expected: /Pokemon|Pokémon|Gyarados/i },
  { source_id: "pokemon_center_jp", url: "https://www.pokemoncenter-online.com/plush-toys/", expected: /ぬいぐるみ|プラッシー|plush|商品/i },
  { source_id: "takara_tomy_pokemon_jp", url: "https://www.takaratomy.co.jp/products/pokemon/moncolle_ex/lineup/", expected: /モンコレ|MONCOLLE|ポケモン/i },
  { source_id: "ichiban_kuji_jp", url: "https://1kuji.com/products/search?index_master_search=47", expected: /一番くじ|itemName|ポケモン/i },
  { source_id: "banpresto_prize_jp", url: "https://bsp-prize.jp/title/IP00002054/", expected: /products_item|products_name|ポケモン/i },
];

// Sources that must be represented in the catalog. A source silently dropping to
// zero records is the signature of an import failure, and is exactly how 40
// Pokemon Center plush records vanished on 2026-07-28 while every reachability
// check still said "ok". Coverage is therefore checked against kits.json itself,
// independent of whether the site happens to answer this runner.
const CATALOG_SOURCES = [
  { source_id: "bandai_spirits_products_jp", label: "BANDAI SPIRITS Gunpla" },
  { source_id: "kotobukiya_armored_core_jp", label: "Kotobukiya Armored Core" },
  { source_id: "takara_tomy_beyblade_x_jp", label: "Takara Tomy BEYBLADE X" },
  { source_id: "pokemon_center_jp", label: "Pokemon Center plush" },
  { source_id: "takara_tomy_pokemon_jp", label: "Takara Tomy Moncolle" },
  { source_id: "ichiban_kuji_jp", label: "Ichiban Kuji" },
  { source_id: "banpresto_prize_jp", label: "Banpresto prize" },
  { source_id: "good_smile_global", label: "Good Smile (Pokemon)" },
  { source_id: "p_bandai_wayback", label: "Premium Bandai (Wayback)" },
  { source_id: "aniplex_plus_fate_jp", label: "Aniplex+ (Fate)" },
  { source_id: "ichiban_kuji_fate_jp", label: "Ichiban Kuji (Fate)" },
  { source_id: "banpresto_prize_fate_jp", label: "Banpresto prize (Fate)" },
  { source_id: "kotobukiya_fate_jp", label: "Kotobukiya (Fate)" },
  { source_id: "tamashii_web_fate_jp", label: "Tamashii Web (Fate)" },
];

function nowIso() {
  return new Date().toISOString();
}

async function fetchText(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeoutMs || 20000),
    headers: {
      "user-agent": options.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": options.language || "ja-JP,ja;q=0.9,en-US;q=0.6,en;q=0.4",
      ...(options.referer ? { referer: options.referer } : {}),
    },
  });
  const text = new TextDecoder(options.encoding || "utf-8").decode(await response.arrayBuffer());
  return {
    ok: response.ok,
    status: response.status,
    final_url: response.url,
    duration_ms: Date.now() - started,
    text,
  };
}

async function checkKotobukiyaArmoredCore(catalog) {
  try {
    const result = await fetchText(KOTOBUKIYA_AC_SHOP_URL, {
      encoding: "shift_jis",
      referer: "https://shop.kotobukiya.co.jp/",
    });
    const listings = parseKotobukiyaShopListings(result.text);
    const catalogCount = (catalog.kits || []).filter((kit) =>
      kit.franchise === "armored_core"
      && (kit.source_refs || []).some((source) => source.source_id === "kotobukiya_armored_core_jp")
    ).length;
    return {
      source_id: "kotobukiya_armored_core_jp",
      url: KOTOBUKIYA_AC_PORTAL_URL,
      status: result.ok && listings.length > 0 ? "ok" : "warning",
      http_status: result.status,
      final_url: result.final_url,
      duration_ms: result.duration_ms,
      item_count: listings.length,
      catalog_count: catalogCount,
      access_method: "kotobukiya_official_shop_jp",
      message: `Official Japanese shop returned ${listings.length} Armored Core listings; catalog currently has ${catalogCount} Kotobukiya records`,
    };
  } catch (error) {
    return {
      source_id: "kotobukiya_armored_core_jp",
      url: KOTOBUKIYA_AC_PORTAL_URL,
      status: "error",
      access_method: "kotobukiya_official_shop_jp",
      message: error.message,
    };
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function classifyBbx(title) {
  const code = /(?:^|\s)((?:BX|UX|CX)-\d+)/i.exec(title)?.[1]?.slice(0, 2).toLowerCase();
  if (/限定|イベント|B4ストア|タカラトミーモール|アプリ|メタルコート|Ver\./.test(title)) return "limited";
  return ["bx", "ux", "cx"].includes(code) ? code : "unknown";
}

function parseBbx(html) {
  const products = [];
  const itemPattern = /<li class="mix[\s\S]*?<\/li>/g;
  for (const match of html.matchAll(itemPattern)) {
    const block = match[0];
    const titleMatch = /<b>\s*([^<]+)<span>([\s\S]*?)<\/span><\/b>/.exec(block);
    if (!titleMatch || !/^(?:BX|UX|CX)-/i.test(titleMatch[1])) continue;
    const title = `${titleMatch[1].replace(/<[^>]+>/g, "").trim()} ${titleMatch[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`;
    products.push({ title, bucket: classifyBbx(`${title} ${block}`) });
  }
  const buckets = products.reduce((acc, item) => {
    acc[item.bucket] = (acc[item.bucket] || 0) + 1;
    return acc;
  }, {});
  return { count: products.length, buckets };
}

function catalogStats(catalog) {
  const kits = catalog.kits || [];
  const byFranchise = {};
  const bySeries = {};
  for (const kit of kits) {
    byFranchise[kit.franchise] = (byFranchise[kit.franchise] || 0) + 1;
    if (kit.franchise === "beyblade") {
      const key = kit.series?.key || "unknown";
      bySeries[key] = (bySeries[key] || 0) + 1;
    }
  }
  return { byFranchise, bySeries };
}

// How many catalog records carry each source_id. This is the silent-loss
// detector: reachability alone said "ok" while the catalog held none of the
// records, which is what let the Pokemon Center and Kotobukiya gaps sit unnoticed.
function checkCatalogCoverage(catalog) {
  const counts = new Map(CATALOG_SOURCES.map((source) => [source.source_id, 0]));
  for (const kit of catalog.kits || []) {
    for (const ref of kit.source_refs || []) {
      if (counts.has(ref.source_id)) counts.set(ref.source_id, counts.get(ref.source_id) + 1);
    }
  }
  const sources = CATALOG_SOURCES.map((source) => ({
    source_id: source.source_id,
    label: source.label,
    catalog_count: counts.get(source.source_id) || 0,
  }));
  const empty = sources.filter((source) => source.catalog_count === 0);
  return {
    source_id: "catalog_coverage",
    status: empty.length ? "error" : "ok",
    sources,
    message: empty.length
      ? `${empty.length} source(s) have no catalog records: ${empty.map((s) => s.source_id).join(", ")}`
      : `all ${sources.length} tracked sources are represented in the catalog`,
  };
}

async function checkGeneric(check) {
  try {
    const result = await fetchText(check.url);
    const matched = check.expected.test(result.text);
    return {
      source_id: check.source_id,
      url: check.url,
      status: result.ok && matched ? "ok" : "warning",
      http_status: result.status,
      final_url: result.final_url,
      duration_ms: result.duration_ms,
      message: matched ? "reachable" : "reachable but expected product markers were not found",
    };
  } catch (error) {
    return {
      source_id: check.source_id,
      url: check.url,
      status: "error",
      message: error.message,
    };
  }
}

async function checkPremiumBandai() {
  try {
    const result = await fetchText(P_BANDAI_URL, { referer: "https://p-bandai.jp/" });
    const redirected = /global_newpc\.html/.test(result.final_url) || /Premium Bandai is International|SELECT YOUR REGION/i.test(result.text);
    const itemCount = [...result.text.matchAll(/\/item\/item-[^"'<\s]+/g)].length;
    const index = await readJson(PB_INDEX_PATH, { entries: [] });
    const indexedCount = (index.entries || []).filter((entry) => entry.p_bandai_urls?.length).length;
    return {
      source_id: "p_bandai_jp",
      url: P_BANDAI_URL,
      status: redirected ? "blocked" : result.ok && itemCount > 0 ? "ok" : "warning",
      http_status: result.status,
      final_url: result.final_url,
      duration_ms: result.duration_ms,
      item_count: redirected ? indexedCount : itemCount,
      direct_status: redirected ? "blocked" : "ok",
      access_method: redirected && indexedCount > 0 ? "bandai_spirits_product_buttons" : "direct",
      message:
        redirected && indexedCount > 0
          ? `Direct Japanese Premium Bandai storefront is redirected, but ${indexedCount} official PB Japan item links were recovered from BANDAI SPIRITS product pages`
          : redirected
            ? "Japanese Premium Bandai storefront redirected this runner to the international region page"
            : `Japanese Premium Bandai returned ${itemCount} item links`,
    };
  } catch (error) {
    const index = await readJson(PB_INDEX_PATH, { entries: [] });
    const indexedCount = (index.entries || []).filter((entry) => entry.p_bandai_urls?.length).length;
    return {
      source_id: "p_bandai_jp",
      url: P_BANDAI_URL,
      status: indexedCount > 0 ? "blocked" : "error",
      item_count: indexedCount,
      access_method: indexedCount > 0 ? "bandai_spirits_product_buttons" : "direct",
      message: indexedCount > 0 ? `Direct PB check failed, but ${indexedCount} official PB Japan item links are indexed` : error.message,
    };
  }
}

async function checkBeyblade(catalog) {
  try {
    const result = await fetchText(BBX_URL, { referer: "https://beyblade.takaratomy.co.jp/" });
    const parsed = parseBbx(result.text);
    const catalogCount = (catalog.kits || []).filter((kit) => kit.franchise === "beyblade").length;
    return {
      source_id: "takara_tomy_beyblade_x_jp",
      url: BBX_URL,
      status: result.ok && parsed.count > 0 ? "ok" : "warning",
      http_status: result.status,
      final_url: result.final_url,
      duration_ms: result.duration_ms,
      item_count: parsed.count,
      catalog_count: catalogCount,
      buckets: parsed.buckets,
      message: `Official lineup parsed ${parsed.count} BBX products; catalog currently has ${catalogCount}`,
    };
  } catch (error) {
    return {
      source_id: "takara_tomy_beyblade_x_jp",
      url: BBX_URL,
      status: "error",
      message: error.message,
    };
  }
}

async function main() {
  const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
  const checks = [
    checkCatalogCoverage(catalog),
    await checkPremiumBandai(),
    await checkBeyblade(catalog),
    await checkKotobukiyaArmoredCore(catalog),
    ...(await Promise.all(CHECKS.map(checkGeneric))),
  ];
  const report = {
    schema_version: 1,
    generated_at: nowIso(),
    updated_at: catalog.updated_at,
    catalog: catalogStats(catalog),
    checks,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const failed = checks.filter((check) => ["blocked", "error"].includes(check.status));
  console.log(`Wrote ${OUTPUT_PATH}: ${checks.length} checks, ${failed.length} blocked/error.`);

  // A source with zero catalog records means the data is actually broken, so fail
  // the run: that makes the daily workflow's "Report failure" step open an issue.
  // Without this the report was only ever written to a file nobody reads, which is
  // why 40 Pokemon Center records could vanish unnoticed.
  //
  // Reachability problems deliberately do NOT fail the run. p_bandai_jp is
  // permanently "blocked" by design (geo-locked, read through other routes) and
  // sites like Kotobukiya answer 403 to cloud IPs while the data is still fine —
  // failing on those would train everyone to ignore a red build.
  const coverage = checks.find((check) => check.source_id === "catalog_coverage");
  if (coverage?.status === "error") {
    console.error(`Catalog coverage failure: ${coverage.message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
