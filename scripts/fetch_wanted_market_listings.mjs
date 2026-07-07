import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const now = new Date().toISOString();
const REQUEST_DELAY_MS = 1500;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const DATA = {
  kits: "data/kits.json",
  watchList: "data/market_watch_list.json",
  autoListings: "data/market_auto_listings.json",
  keywordOverrides: "data/market_keyword_overrides.json",
  localSecrets: "data/market_secrets.local.json",
};

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/[＜＞<>()（）\[\]【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  return cleanName(value)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

// A candidate listing must share at least one token with the kit's grade/name
// so we never attach an unrelated search result to the wrong kit, and must not
// contain junk terms (decal-only, parts-only, sticker, etc.) from the shared
// exclude list used by the search index builder.
function isLikelyMatch(kitTokens, title, excludeTerms) {
  const lowerTitle = title.toLowerCase();
  if (excludeTerms.some((term) => term && lowerTitle.includes(term.toLowerCase()))) return false;
  const titleTokens = new Set(tokenize(title));
  return kitTokens.some((token) => titleTokens.has(token));
}

// Load credentials from a local, git-ignored file into process.env so a
// non-technical user can just paste keys into data/market_secrets.local.json
// instead of setting shell environment variables. Real environment variables
// (e.g. GitHub Actions secrets) always win over the file.
async function loadLocalSecrets() {
  const doc = await readJson(DATA.localSecrets, {});
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("_")) continue; // allow "_comment" style notes in the file
    if (value && !process.env[key]) process.env[key] = String(value);
  }
}

async function getWatchedKits() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_WORKSPACE_ID, SYNC_WORKSPACE_SECRET } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SYNC_WORKSPACE_ID && SYNC_WORKSPACE_SECRET) {
    try {
      const baseUrl = SUPABASE_URL.trim().replace(/\/+$/, "");
      const accessHash = sha256Hex(`${SYNC_WORKSPACE_ID.trim()}:${SYNC_WORKSPACE_SECRET.trim()}`);
      const response = await fetch(`${baseUrl}/rest/v1/rpc/gunpula_get_state`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_workspace_id: SYNC_WORKSPACE_ID.trim(), p_access_hash: accessHash }),
      });
      if (!response.ok) throw new Error(`Supabase RPC ${response.status}`);
      const data = await response.json();
      const row = Array.isArray(data) ? data[0] : data;
      const wanted = row?.payload?.collection?.wanted;
      if (Array.isArray(wanted) && wanted.length) {
        console.log(`Loaded ${wanted.length} wanted kit(s) from shared Supabase workspace.`);
        return wanted;
      }
      console.log("Shared workspace has no wanted kits yet.");
    } catch (error) {
      console.warn(`Supabase wanted-list lookup failed: ${error.message}. Falling back to data/market_watch_list.json.`);
    }
  }
  const watchDoc = await readJson(DATA.watchList, { kit_ids: [] });
  return Array.isArray(watchDoc.kit_ids) ? watchDoc.kit_ids : [];
}

function buildQuery(kit) {
  const name = cleanName(kit.names?.en || kit.names?.ja || kit.names?.zh || kit.names?.ko || kit.kit_id);
  const grade = kit.grade_code || "";
  const alreadyHasGrade = grade && name.toLowerCase().startsWith(grade.toLowerCase());
  return (alreadyHasGrade ? name : [grade, name].filter(Boolean).join(" ")).trim();
}

// Korean C2C marketplaces (Bunjang/Joongna) mostly return real hits for Korean-language
// queries; an English grade+name query often comes back empty even for popular kits.
function buildKoreanQuery(kit) {
  if (!kit.names?.ko) return buildQuery(kit);
  return [kit.grade_code, cleanName(kit.names.ko)].filter(Boolean).join(" ").trim();
}

function kitMatchTokens(kit) {
  const names = [kit.names?.en, kit.names?.ja, kit.names?.zh, kit.names?.ko].filter(Boolean);
  return [...new Set(names.flatMap(tokenize))];
}

async function fetchNaver(query) {
  const { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } = process.env;
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=5&sort=asc`;
  const response = await fetch(url, {
    headers: { "X-Naver-Client-Id": NAVER_CLIENT_ID, "X-Naver-Client-Secret": NAVER_CLIENT_SECRET },
  });
  if (!response.ok) throw new Error(`Naver API ${response.status}`);
  const data = await response.json();
  return (data.items || []).map((item) => ({
    title: cleanName(item.title.replace(/<\/?b>/g, "")),
    price: Number(item.lprice || 0),
    currency: "KRW",
    url: item.link,
  }));
}

async function fetchBunjang(query) {
  const url = `https://api.bunjang.co.kr/api/1/find_v2.json?q=${encodeURIComponent(query)}&order=score&page=0&stat_device=w&n=10`;
  const response = await fetch(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } });
  if (!response.ok) throw new Error(`Bunjang API ${response.status}`);
  const data = await response.json();
  return (data.list || []).map((item) => ({
    title: item.name,
    price: Number(item.price || 0),
    currency: "KRW",
    url: `https://m.bunjang.co.kr/products/${item.pid}`,
  }));
}

async function fetchJoongna(query) {
  const url = `https://web.joongna.com/search/${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
  if (!response.ok) throw new Error(`Joongna ${response.status}`);
  const html = await response.text();
  const results = [];
  // The search results are embedded as a JSON string inside a Next.js <script> payload,
  // so quotes appear as literal backslash-quote sequences in the raw response text.
  const itemPattern = /\\"seq\\":(\d+),\\"productPositionNo\\":\d+,\\"platformType\\":\d+,\\"price\\":(\d+)[\s\S]*?\\"title\\":\\"(.*?)\\",/g;
  let match;
  while ((match = itemPattern.exec(html)) && results.length < 10) {
    const [, seq, price, rawTitle] = match;
    results.push({
      title: JSON.parse(`"${rawTitle}"`),
      price: Number(price),
      currency: "KRW",
      url: `https://web.joongna.com/product/${seq}`,
    });
  }
  return results;
}

async function fetchAmazon(query) {
  const url = `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "ja-JP,ja;q=0.9" },
  });
  if (!response.ok) throw new Error(`Amazon ${response.status}`);
  const html = await response.text();
  const results = [];
  const cardPattern = /data-asin="([A-Z0-9]{6,})"[\s\S]{0,2000}?<\/div>\s*<\/div>\s*<\/div>/g;
  const wholePattern = /a-price-whole">([\d,]+)</;
  const titlePattern = /<h2[^>]*>[\s\S]*?<span[^>]*>([^<]{5,200})<\/span>/;
  let match;
  while ((match = cardPattern.exec(html)) && results.length < 10) {
    const asin = match[1];
    const block = match[0];
    const priceMatch = wholePattern.exec(block);
    const titleMatch = titlePattern.exec(block);
    if (!priceMatch || !titleMatch || !asin) continue;
    results.push({
      title: cleanName(titleMatch[1]),
      price: Number(priceMatch[1].replace(/,/g, "")),
      currency: "JPY",
      url: `https://www.amazon.co.jp/dp/${asin}`,
    });
  }
  return results;
}

const SOURCE_FETCHERS = [
  { id: "naver_shop", fetch: fetchNaver, buildQuery },
  { id: "bunjang", fetch: fetchBunjang, buildQuery: buildKoreanQuery },
  { id: "joongna", fetch: fetchJoongna, buildQuery: buildKoreanQuery },
  { id: "amazon", fetch: fetchAmazon, buildQuery },
];

async function main() {
  await loadLocalSecrets();
  const naverReady = Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
  console.log(`Naver Shop API: ${naverReady ? "credentials found, will query" : "no credentials, skipping (Bunjang/Joongna still run)"}.`);
  const watchedIds = [...new Set(await getWatchedKits())];
  const kitsDoc = await readJson(DATA.kits);
  const kitById = new Map(kitsDoc.kits.map((kit) => [kit.kit_id, kit]));
  const overridesDoc = await readJson(DATA.keywordOverrides, {});
  const excludeTerms = overridesDoc.global_exclude_terms || [];
  const listings = [];
  const stats = Object.fromEntries(SOURCE_FETCHERS.map((source) => [source.id, { attempted: 0, matched: 0, errors: 0 }]));

  if (!watchedIds.length) {
    console.log("No watched kits found (empty shared wanted list and empty data/market_watch_list.json). Writing empty auto-listings file.");
  }

  for (const kitId of watchedIds) {
    const kit = kitById.get(kitId);
    if (!kit) {
      console.warn(`Skipping unknown kit_id in watch list: ${kitId}`);
      continue;
    }
    const matchTokens = kitMatchTokens(kit);
    for (const source of SOURCE_FETCHERS) {
      stats[source.id].attempted += 1;
      const query = source.buildQuery(kit);
      try {
        const candidates = await source.fetch(query);
        const matched = candidates.filter((candidate) => candidate.price > 0 && isLikelyMatch(matchTokens, candidate.title, excludeTerms));
        for (const candidate of matched.slice(0, 3)) {
          listings.push({
            kit_id: kitId,
            source: source.id,
            title: candidate.title,
            price: candidate.price,
            currency: candidate.currency,
            url: candidate.url,
            condition: "unknown",
            status: "active",
            shipping_price: 0,
            captured_at: now,
            confidence: "auto",
            notes: `Auto-fetched via ${source.id} search for "${query}".`,
          });
        }
        if (matched.length) stats[source.id].matched += 1;
      } catch (error) {
        stats[source.id].errors += 1;
        console.warn(`[${source.id}] ${kitId}: ${error.message}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  await writeJson(DATA.autoListings, {
    schema_version: 1,
    updated_at: now,
    generated_by: "scripts/fetch_wanted_market_listings.mjs",
    watched_kit_count: watchedIds.length,
    source_stats: stats,
    listings,
  });

  console.log(`Auto market fetch done: ${watchedIds.length} watched kit(s), ${listings.length} listing(s) captured.`);
  for (const [id, stat] of Object.entries(stats)) {
    console.log(`  ${id}: attempted=${stat.attempted} matched_kits=${stat.matched} errors=${stat.errors}`);
  }
}

await main();
