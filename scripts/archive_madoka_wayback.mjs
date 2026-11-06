// Madoka figures from official sites that no longer exist, read once from the
// Wayback Machine and saved to data/madoka/archive-products.json.
//
// The live importer (import_madoka_sources.mjs) only sees what the makers'
// current sites list, and their prize sites keep a few years at most: every
// Banpresto / SEGA / FuRyu prize from 2011–2022 was missing. Those years were
// on the retired official sites, which archive.org still holds:
//
//   * とるナビ (www.prizebp.jp, Banpresto prizes until 2015) — character page
//     /chara/85/ (魔法少女まどか☆マギカ), its month pages and item pages.
//
// This script is run by hand (npm run archive:madoka), not by the daily job:
// the archived pages never change, so the result is committed and the live
// importer reads the file without touching archive.org. archive.org is a free
// service, so requests are strictly one at a time, at least 1.5 s apart, with
// the HobbyAtlasDataBot user agent; a 429 / 5xx waits and retries a few times,
// then that page is skipped. Only the "id_" (unmodified) form of each snapshot
// is fetched. Product images point at their archived copy ("im_" form).
//
// Output entries are raw products ({ key, name, work, line, url, image,
// release_date }); the live importer classifies them (figure / plush / goods)
// with the same rules as its other sources.
import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUT_PATH = "data/madoka/archive-products.json";
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const GAP_MS = 1500;
const WAYBACK = "https://web.archive.org";

let lastRequest = 0;
let requests = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wait = lastRequest + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    requests += 1;
    let response;
    try {
      response = await fetch(url, { headers: { "user-agent": BOT_UA }, signal: AbortSignal.timeout(60000) });
    } catch (error) {
      console.warn(`  ${url}: ${error.message}`);
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      console.warn(`  ${url}: HTTP ${response.status}, waiting`);
      await sleep(10000 * (attempt + 1));
      continue;
    }
    if (!response.ok) return null;
    lastRequest = Date.now();
    return Buffer.from(await response.arrayBuffer()).toString("utf8");
  }
  return null;
}

async function cdx(params) {
  const text = await get(`${WAYBACK}/cdx/search/cdx?${new URLSearchParams({ output: "json", ...params })}`);
  if (!text) return [];
  const rows = JSON.parse(text);
  const [head, ...body] = rows;
  return body.map((row) => Object.fromEntries(head.map((key, index) => [key, row[index]])));
}

function decode(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/g, " ");
}

function textOf(html) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// "2013年01月中旬登場" → 2013-01; "2014年12月26日（金）より順次登場" → 2014-12-26
function dateFrom(text) {
  const day = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (day) return `${day[1]}-${day[2].padStart(2, "0")}-${day[3].padStart(2, "0")}`;
  const month = text.match(/(20\d{2})年\s*(\d{1,2})月/);
  return month ? `${month[1]}-${month[2].padStart(2, "0")}` : null;
}

// ------------------------------------------------------------- とるナビ

const PRIZEBP_CHARA = "www.prizebp.jp/chara/85/";

function prizebpItemId(url) {
  const match = url.match(/\/chara\/85\/(?:\d{6}\/)?(\d{5})\/?$/);
  return match ? match[1] : null;
}

async function prizebp() {
  const rows = await cdx({ url: PRIZEBP_CHARA, matchType: "prefix", filter: "statuscode:200", fl: "original,timestamp" });
  const items = new Map(); // id → [{ url, timestamp }] (oldest first)
  const listings = [];
  for (const row of rows) {
    const id = prizebpItemId(row.original);
    if (id) {
      if (!items.has(id)) items.set(id, []);
      items.get(id).push({ url: row.original, timestamp: row.timestamp });
    } else listings.push(row);
  }
  // Month and top pages name items whose own page may never have been saved
  // under /chara/85/ — those are tried through the archive's nearest snapshot.
  const seenListing = new Set();
  for (const row of listings) {
    const key = row.original.replace(/:80/, "").replace(/\/$/, "");
    if (seenListing.has(key)) continue;
    seenListing.add(key);
    const html = await get(`${WAYBACK}/web/${row.timestamp}id_/${row.original}`);
    if (!html) continue;
    for (const match of html.matchAll(/href="(?:https?:\/\/www\.prizebp\.jp)?(\/chara\/85\/(?:\d{6}\/)?(\d{5})\/?)"/g)) {
      if (!items.has(match[2])) items.set(match[2], [{ url: `http://www.prizebp.jp${match[1]}`, timestamp: row.timestamp }]);
    }
  }
  console.log(`prizebp: ${items.size} items from ${rows.length} archived URLs`);

  const products = [];
  for (const [id, snapshots] of [...items].sort()) {
    snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let found = null;
    // Some captures are the site's 404 page or an empty template; up to three
    // snapshots of the item are tried, oldest first (closest to the release).
    for (const snapshot of snapshots.slice(0, 3)) {
      const html = await get(`${WAYBACK}/web/${snapshot.timestamp}id_/${snapshot.url}`);
      const name = decode(html?.match(/<title>\s*とるナビ\s*\|\s*([^<]*?)\s*<\/title>/)?.[1] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (name) {
        found = { html, name, snapshot };
        break;
      }
    }
    if (!found) {
      console.warn(`  prizebp ${id}: no readable snapshot`);
      continue;
    }
    const { html, name, snapshot } = found;
    const text = textOf(html);
    // "… > NAME 2013年04月上旬登場 NAME サイズ:約21cm …" — the first 登場 date
    // and サイズ on the page are the item's own (related items carry neither).
    const release = text.match(/(20\d{2}年\s*\d{1,2}月(?:\s*\d{1,2}日)?)[^ ]{0,20}登場/)?.[1];
    const size = text.match(/サイズ\s*[:：]\s*([^ ]+)/)?.[1] || "";
    const image = html.match(/(https?:\/\/img\.prizebp\.jp\/trn_prize\/top_image\/\d+\/[A-Za-z0-9]+\.jpg)/)?.[1] || "";
    products.push({
      source: "prizebp",
      key: `prizebp-${id}`,
      name: /まどか|マギカ/.test(name) ? name : `魔法少女まどか☆マギカ ${name}`,
      line: "バンプレスト景品",
      spec: size ? `サイズ:${size}` : "",
      url: `${WAYBACK}/web/${snapshot.timestamp}/${snapshot.url}`,
      image: image ? `${WAYBACK}/web/${snapshot.timestamp}im_/${image}` : "",
      release_date: release ? dateFrom(release) : null,
    });
  }
  return products;
}

// ------------------------------------------------------------------ main

const only = process.argv.slice(2);
const runners = { prizebp };
let previous = { products: [] };
try {
  previous = JSON.parse(await readFile(OUT_PATH, "utf8"));
} catch {
  // first run
}
const bySource = new Map();
for (const product of previous.products || []) {
  if (!bySource.has(product.source)) bySource.set(product.source, []);
  bySource.get(product.source).push(product);
}
for (const [name, run] of Object.entries(runners)) {
  if (only.length && !only.includes(name)) continue;
  const products = await run();
  // An archive that answers nothing keeps what an earlier run read.
  if (products.length) bySource.set(name, products);
}
const products = [...bySource.values()].flat().sort((a, b) => a.key.localeCompare(b.key));
await mkdir("data/madoka", { recursive: true });
await writeFile(
  OUT_PATH,
  `${JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), note: "Read from web.archive.org by scripts/archive_madoka_wayback.mjs", products }, null, 2)}\n`,
  "utf8",
);
console.log(`archive: ${products.length} products (${requests} requests) → ${OUT_PATH}`);
