import { readFile, writeFile } from "node:fs/promises";

const OUTPUT_PATH = "data/source-health.json";
const PB_INDEX_PATH = "data/premium-bandai-jp-index.json";
const P_BANDAI_URL = "https://p-bandai.jp/hobby/a0001/list-da20-n3/";
const BBX_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";

const CHECKS = [
  { source_id: "bandai_spirits_products_jp", url: "https://bandai-hobby.net/site/gunpla.html", expected: /ガンプラ|GUNPLA|BANDAI/i },
  { source_id: "bandai_candy_gundam_jp", url: "https://www.bandai.co.jp/candy/gundam/", expected: /GUNDAM|ガンダム|CONVERGE/i },
  { source_id: "bandai_gashapon_products_jp", url: "https://gashapon.jp/products/result.php?free=%E3%82%AC%E3%83%B3%E3%83%80%E3%83%A0", expected: /ガンダム|GUNDAM|商品/i },
  { source_id: "tamashii_web_jp", url: "https://tamashiiweb.com/item_character/gundam_series/", expected: /METAL BUILD|ROBOT魂|ガンダム/i },
  { source_id: "kotobukiya_armored_core_jp", url: "https://www.kotobukiya.co.jp/title/armored-core/", expected: /ARMORED CORE|アーマード・コア/i },
  { source_id: "bandai_hobby_pokemon_global", url: "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/products/?category=select", expected: /Pokemon|Pokémon|Gyarados/i },
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
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    final_url: response.url,
    duration_ms: Date.now() - started,
    text,
  };
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
    await checkPremiumBandai(),
    await checkBeyblade(catalog),
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
