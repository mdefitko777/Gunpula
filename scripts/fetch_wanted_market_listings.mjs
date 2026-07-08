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
  nameOverrides: "data/market_name_overrides.json",
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

// Tokens shared by nearly every marketplace listing (grade codes, brand words,
// scale fractions, seller boilerplate). Matching on these alone attaches
// unrelated products to the wrong kit, so they never count as evidence.
const GENERIC_MATCH_TOKENS = new Set([
  "hg", "hguc", "hgce", "hgbf", "hgbd", "hgbdr", "hgac", "hgtb", "mg", "mgex", "mgsd",
  "rg", "pg", "sd", "sdcs", "sdex", "bb", "re", "fm", "eg", "hirm",
  "gundam", "건담", "ガンダム", "高达", "高達", "bandai", "반다이", "バンダイ", "万代",
  "gunpla", "건프라", "프라모델", "플라모델", "프라", "모형", "피규어", "프라모형",
  "144", "100", "60", "1/144", "1/100", "1/60",
  "ver", "버전", "정품", "새상품", "미개봉", "당일발송", "무료배송", "기동전사", "기동", "전사",
  // Beyblade franchise boilerplate: present in every Beyblade listing, so it
  // can never identify a specific top — the product code (CX-07...) does that.
  "베이블레이드", "베이블레이드x", "beyblade", "타카라토미", "takara", "tomy",
  "스타터", "부스터", "랜덤부스터", "덱세트", "세트",
]);

// A token identifies a specific kit only if it is not boilerplate and not a
// bare number / scale fraction such as "144" or "1/144".
function isDistinctive(token) {
  if (GENERIC_MATCH_TOKENS.has(token)) return false;
  if (/^[\d\s./-]+$/.test(token)) return false;
  return true;
}

// A candidate listing must share at least one DISTINCTIVE token with the kit's
// name so we never attach an unrelated search result to the wrong kit, and must
// not contain junk terms (decal-only, parts-only, sticker, etc.) from the shared
// exclude list used by the search index builder. A kit with no distinctive
// tokens matches nothing: no data is better than wrong data.
function isLikelyMatch(kitTokens, title, excludeTerms) {
  const lowerTitle = title.toLowerCase();
  if (excludeTerms.some((term) => term && lowerTitle.includes(term.toLowerCase()))) return false;
  const titleTokens = new Set(tokenize(title));
  const distinctive = kitTokens.filter(isDistinctive);
  if (!distinctive.length) return false;
  return distinctive.some((token) => titleTokens.has(token));
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
        // Cache the wishlist into the repo so environments where the Supabase
        // secrets are unavailable (e.g. misconfigured CI) still fetch prices
        // for the last-known wanted kits instead of silently doing nothing.
        await writeJson(DATA.watchList, {
          updated_at: now,
          source: "supabase-cache",
          kit_ids: wanted,
        });
        return wanted;
      }
      console.log("Shared workspace has no wanted kits yet.");
    } catch (error) {
      console.warn(`Supabase wanted-list lookup failed: ${error.message}. Falling back to data/market_watch_list.json.`);
    }
  } else {
    console.warn("Supabase env vars missing; falling back to cached data/market_watch_list.json.");
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

// Korean marketplaces (Naver/Bunjang/Joongna) return real hits only for Korean-language
// queries. Many catalog names still carry untranslated Japanese kana, so a verified
// Korean alias from market_name_overrides.json (nameOverride.ko) is preferred when present.
function buildKoreanQuery(kit, nameOverride) {
  const ko = nameOverride?.ko || kit.names?.ko;
  if (!ko) return buildQuery(kit);
  return [kit.grade_code, cleanName(ko)].filter(Boolean).join(" ").trim();
}

function kitMatchTokens(kit, nameOverride) {
  const names = [kit.names?.en, kit.names?.ja, kit.names?.zh, kit.names?.ko, nameOverride?.ko, nameOverride?.zh].filter(Boolean);
  return [...new Set(names.flatMap(tokenize))];
}

async function fetchNaver(query) {
  const { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } = process.env;
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return [];
  // sort=sim (relevance) surfaces the actual kit; sort=asc buries it under
  // unrelated cheap accessories that the match filter then rejects.
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=sim`;
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
  // Naver is a Korean marketplace: Korean queries return real hits where
  // English/kana queries come back empty even for popular kits.
  { id: "naver_shop", fetch: fetchNaver, buildQuery: buildKoreanQuery },
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
  // MARKET_LINE_EXCLUDES: completed-figure product lines that share kit names
  // (Robot Spirits boosters, Metal Build, figma...) but are not model kits.
  // Kept local to market fetching so the shared search-index excludes are untouched.
  const MARKET_LINE_EXCLUDES = ["로봇혼", "로봇 영혼", "robot혼", "robot spirits", "메탈빌드", "metal build", "넨도로이드", "nendoroid", "피그마", "figma", "s.h.figuarts", "피규어아츠"];
  const excludeTerms = [...(overridesDoc.global_exclude_terms || []), ...MARKET_LINE_EXCLUDES];
  const nameOverridesDoc = await readJson(DATA.nameOverrides, { overrides: {} });
  const nameOverrides = nameOverridesDoc.overrides || {};
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
    const nameOverride = nameOverrides[kitId];
    const matchTokens = kitMatchTokens(kit, nameOverride);
    for (const source of SOURCE_FETCHERS) {
      stats[source.id].attempted += 1;
      const query = source.buildQuery(kit, nameOverride);
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

  // Never let a barren run (missing secrets, network outage, blocked runner)
  // clobber previously captured listings: stale prices beat vanished prices.
  if (!listings.length) {
    const previous = await readJson(DATA.autoListings, null);
    if (previous?.listings?.length) {
      console.warn(`Captured 0 listings but previous file has ${previous.listings.length}; keeping previous data.`);
      return;
    }
  }

  await writeJson(DATA.autoListings, {
    schema_version: 1,
    updated_at: now,
    generated_by: "scripts/fetch_wanted_market_listings.mjs",
    watched_kit_count: watchedIds.length,
    env_status: {
      naver: Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SYNC_WORKSPACE_ID && process.env.SYNC_WORKSPACE_SECRET),
    },
    source_stats: stats,
    listings,
  });

  console.log(`Auto market fetch done: ${watchedIds.length} watched kit(s), ${listings.length} listing(s) captured.`);
  for (const [id, stat] of Object.entries(stats)) {
    console.log(`  ${id}: attempted=${stat.attempted} matched_kits=${stat.matched} errors=${stat.errors}`);
  }
}

await main();
