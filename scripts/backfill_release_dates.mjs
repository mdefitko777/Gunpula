import { readFile, writeFile } from "node:fs/promises";

// Release dates for products whose source list has none (2026-11: 2079 Aniplex+ Fate
// goods, ~430 gashapon items). The importers rebuild every record on each refresh, so a
// date read from a product page is kept in data/release-dates.json and put back on the
// record by this script (`npm run dates:apply`, an offline derive step of import:data).
//
// `--fetch` (npm run dates:backfill) also reads product pages of records still without
// a date, politely: this bot's own user-agent, robots.txt first, one request per
// 1.1 s per host, a 403 / 429 / 503 stops that host for the run, at most --limit pages
// (default 300) so the daily refresh fills the gap over a few days. A page that shows
// no date is not asked again for 30 days.
//
// A date that appears for the first time is a quiet change in the update and notify
// feeds ("release_found"), so the backfill does not reach the phones as news.

const CATALOG_PATH = "data/kits.json";
const STORE_PATH = "data/release-dates.json";
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const GAP_MS = 1100;
const RECHECK_DAYS = 30;

const args = process.argv.slice(2);
const fetchPages = args.includes("--fetch");
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) || 300);

/** Product pages this script can read, by host: which source URL, and where the date is. */
export const PAGES = [
  {
    host: "online.aniplex.co.jp",
    url: /^https:\/\/online\.aniplex\.co\.jp\/item[A-Za-z0-9]+\.html$/,
    // <p class="salesStartDate__txt">2021年2月下旬以降より順次お届け予定</p>
    date: (html) => /<p class="salesStartDate__txt">([^<]+)<\/p>/.exec(html)?.[1],
  },
  {
    host: "gashapon.jp",
    url: /^https:\/\/gashapon\.jp\/products\/detail\.php\?jan_code=\d+$/,
    // <dd class="pg-detailDefinition__detail --releaseDate"> 2014年04月下旬 </dd> · 2021年11月 第5週 <br />
    date: (html) => /--releaseDate">\s*([^<]+)/.exec(html)?.[1]?.trim(),
  },
];

/** "2026年7月3日(金)より順次お届け" → "2026-07-03", "2014年04月下旬" → "2014-04". */
export function parseJapaneseDate(text) {
  const m = /((?:19|20)\d{2})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(String(text || ""));
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const ym = `${m[1]}-${String(month).padStart(2, "0")}`;
  const day = m[3] ? Number(m[3]) : 0;
  return day >= 1 && day <= 31 ? `${ym}-${String(day).padStart(2, "0")}` : ym;
}

/** The page of this record that a PAGES entry can read, or null. */
export function pageFor(kit) {
  for (const url of kit.source_urls || []) {
    const page = PAGES.find((p) => p.url.test(url));
    if (page) return { page, url };
  }
  return null;
}

/** Puts stored dates on records without one. Returns how many records got a date. */
export function applyStoredDates(kits, store) {
  let applied = 0;
  for (const kit of kits) {
    const found = store.dates?.[kit.kit_id];
    if (!kit.release_date && found?.date) {
      kit.release_date = found.date;
      applied += 1;
    }
  }
  return applied;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** robots.txt path rule → RegExp: `*` = any characters, `$` at the end = end of the path. */
export function robotsPattern(rule) {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

async function robotsDisallows(host) {
  try {
    const response = await fetch(`https://${host}/robots.txt`, { headers: { "User-Agent": BOT_UA }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return [];
    const rules = [];
    let applies = false;
    for (const line of (await response.text()).split(/\r?\n/)) {
      const [key, ...rest] = line.replace(/#.*/, "").split(":");
      const value = rest.join(":").trim();
      if (/^user-agent$/i.test(key.trim())) applies = value === "*" || /hobbyatlasdatabot/i.test(value);
      else if (applies && /^disallow$/i.test(key.trim()) && value) rules.push(robotsPattern(value));
    }
    return rules;
  } catch {
    return []; // unreachable robots.txt: treated as missing
  }
}

async function readHost(host, jobs, store, today, budget) {
  const disallowed = await robotsDisallows(host);
  let read = 0;
  let found = 0;
  for (const { kit, page, url } of jobs) {
    if (budget.left <= 0) break;
    const { pathname, search } = new URL(url);
    if (disallowed.some((rule) => rule.test(`${pathname}${search}`))) continue;
    budget.left -= 1;
    await sleep(GAP_MS);
    let html = "";
    try {
      const response = await fetch(url, { headers: { "User-Agent": BOT_UA }, signal: AbortSignal.timeout(30000) });
      if ([403, 429, 503].includes(response.status)) {
        console.warn(`${host}: ${response.status} — stopping this host for today.`);
        break;
      }
      if (!response.ok) {
        store.misses[kit.kit_id] = today;
        continue;
      }
      html = await response.text();
    } catch (error) {
      console.warn(`${host}: ${url} ${error.message}`);
      continue;
    }
    read += 1;
    const date = parseJapaneseDate(page.date(html));
    if (date) {
      store.dates[kit.kit_id] = { date, url, read: today };
      delete store.misses[kit.kit_id];
      found += 1;
    } else {
      store.misses[kit.kit_id] = today;
    }
  }
  console.log(`${host}: read ${read} pages, ${found} dates.`);
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const store = JSON.parse(await readFile(STORE_PATH, "utf8").catch(() => "{}"));
  store.schema = 1;
  store.note =
    "Release dates read from official product pages for records whose source list has none (scripts/backfill_release_dates.mjs). misses: pages that showed no date, by the day they were read.";
  store.dates ||= {};
  store.misses ||= {};
  const today = new Date().toISOString().slice(0, 10);

  if (fetchPages) {
    const recheckAfter = new Date(Date.now() - RECHECK_DAYS * 86400000).toISOString().slice(0, 10);
    const byHost = new Map();
    for (const kit of catalog.kits) {
      if (kit.release_date || store.dates[kit.kit_id]) continue;
      if (store.misses[kit.kit_id] && store.misses[kit.kit_id] > recheckAfter) continue;
      const hit = pageFor(kit);
      if (!hit) continue;
      if (!byHost.has(hit.page.host)) byHost.set(hit.page.host, []);
      byHost.get(hit.page.host).push({ kit, ...hit });
    }
    // One shared budget, hosts read side by side (each at its own pace).
    const budget = { left: limit };
    await Promise.all([...byHost].map(([host, jobs]) => readHost(host, jobs, store, today, budget)));
    store.updated_at = today;
    store.dates = Object.fromEntries(Object.entries(store.dates).sort(([a], [b]) => a.localeCompare(b)));
    store.misses = Object.fromEntries(Object.entries(store.misses).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(STORE_PATH, `${JSON.stringify(store, null, 1)}\n`, "utf8");
  }

  const applied = applyStoredDates(catalog.kits, store);
  if (applied) await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  const stillMissing = catalog.kits.filter((kit) => !kit.release_date && kit.franchise !== "lego").length;
  console.log(`Release dates: ${Object.keys(store.dates).length} stored, applied ${applied}; ${stillMissing} non-LEGO records still without a date.`);
}

// Run as a script (the test imports the helpers only).
if (process.argv[1]?.endsWith("backfill_release_dates.mjs")) await main();
