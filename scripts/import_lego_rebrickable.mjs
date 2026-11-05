// Imports every official LEGO set from Rebrickable's daily catalog dump into data/kits.json
// as franchise "lego".
//
// Source: https://rebrickable.com/downloads/ — "Free for personal and commercial use, provided
// you acknowledge Rebrickable as your data source", and "You may automate downloading these
// archives at most once a day. Scraping our web pages is strictly against our Terms". So this
// script only fetches the two published CSV archives (sets, themes) from their CDN, at most once
// per UTC day (data/lego/rebrickable-fetch.json records the day), and never touches a web page.
// The app credits Rebrickable as the data source.
//
// Grades by top-level theme: Gear → LEGO_GEAR (merch), Books → LEGO_BOOK, Collectible
// Minifigures → LEGO_MINIFIG, Service Packs / Bulk Bricks → LEGO_PARTS, everything else LEGO_SET.
// work_title = top-level theme, subline = the set's own (sub-)theme. Names stay as published
// (English); top-level theme labels are translated in localize_catalog.mjs.
//
// A failed download keeps the previous lego records (exit 1 so run_importers reports it).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";

const CATALOG_PATH = "data/kits.json";
const STAMP_PATH = "data/lego/rebrickable-fetch.json";
const BASE = "https://cdn.rebrickable.com/media/downloads/";
const SOURCE_ID = "rebrickable_lego";
const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";

const GRADE_BY_TOP_THEME = {
  Gear: "LEGO_GEAR",
  Books: "LEGO_BOOK",
  "Collectible Minifigures": "LEGO_MINIFIG",
  "Service Packs": "LEGO_PARTS",
  "Bulk Bricks": "LEGO_PARTS",
};

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCsv(name) {
  const response = await fetch(`${BASE}${name}.csv.gz`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${name}.csv.gz: HTTP ${response.status}`);
  return gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8");
}

/** RFC 4180 CSV (quoted fields may hold commas, quotes and newlines) → array of objects */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

export function kitIdFor(setNum) {
  return `lego-${String(setNum).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

export function toKits(sets, themes) {
  const byId = new Map(themes.map((t) => [t.id, t]));
  const topOf = (id) => {
    let t = byId.get(id);
    for (let guard = 0; t?.parent_id && guard < 10; guard += 1) t = byId.get(t.parent_id);
    return t;
  };
  const seen = new Set();
  const kits = [];
  for (const s of sets) {
    const kitId = kitIdFor(s.set_num);
    if (!s.set_num || seen.has(kitId)) continue;
    seen.add(kitId);
    const theme = byId.get(s.theme_id);
    const top = topOf(s.theme_id);
    const topName = top?.name || "Other";
    const pieces = Number(s.num_parts) || 0;
    const url = `https://rebrickable.com/sets/${s.set_num}/`;
    const name = s.name || s.set_num;
    kits.push({
      kit_id: kitId,
      franchise: "lego",
      grade_code: GRADE_BY_TOP_THEME[topName] || "LEGO_SET",
      subline: theme && theme.id !== top?.id ? theme.name : topName,
      number: s.set_num.replace(/-1$/, ""),
      scale: "non-scale",
      // kept small: ~28k records (no gallery copy of the box art, no notes)
      images: { box_art_url: s.img_url || null, box_art_source_id: SOURCE_ID },
      universe: "LEGO",
      work_title: topName,
      release_date: /^\d{4}$/.test(s.year) ? s.year : null,
      price_jpy: null,
      is_limited: false,
      data_status: "verified",
      source_urls: [url],
      source_refs: [{ source_id: SOURCE_ID, url, fields: ["names", "images", "release_date"], confidence: "high" }],
      tags: ["lego", ...(pieces ? [`pieces:${pieces}`] : [])],
      names: { en: name, ja: name, zh: name, ko: name },
    });
  }
  return kits;
}

const today = new Date().toISOString().slice(0, 10);
const stamp = await readJson(STAMP_PATH, {});
if (stamp.date === today && !process.argv.includes("--force")) {
  console.log(`Rebrickable already fetched today (${today}); keeping the current lego records.`);
  process.exit(0);
}

let setsText;
let themesText;
try {
  setsText = await fetchCsv("sets");
  await sleep(1000);
  themesText = await fetchCsv("themes");
} catch (error) {
  console.error(`Rebrickable download failed (${error.message}); keeping the previous lego records.`);
  process.exit(1);
}

const kits = toKits(parseCsv(setsText), parseCsv(themesText));
if (kits.length < 1000) {
  console.error(`Rebrickable gave only ${kits.length} sets; keeping the previous lego records.`);
  process.exit(1);
}

const retired = retiredKitIds(await readJson(KIT_ALIASES_PATH, {}));
const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const previous = new Map(catalog.kits.filter((k) => k.franchise === "lego").map((k) => [k.kit_id, k]));
const fresh = kits
  .filter((k) => !retired.has(k.kit_id))
  // keep what later steps derived (names.ko, series, goods_kind …) so a re-import doesn't churn
  .map((k) => {
    const old = previous.get(k.kit_id);
    if (!old) return k;
    const names = old.names?.en === k.names.en ? old.names : k.names;
    return { ...old, ...k, names, series: old.series, category: old.category, goods_kind: old.goods_kind };
  });
const others = catalog.kits.filter((k) => k.franchise !== "lego");
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, kits: [...others, ...fresh] }, null, 2)}\n`, "utf8");
await mkdir("data/lego", { recursive: true });
await writeFile(STAMP_PATH, `${JSON.stringify({ date: today, sets: fresh.length, source: `${BASE}sets.csv.gz` }, null, 2)}\n`, "utf8");

const byGrade = {};
for (const k of fresh) byGrade[k.grade_code] = (byGrade[k.grade_code] || 0) + 1;
console.log(`LEGO: ${fresh.length} records (${previous.size} before) — ${JSON.stringify(byGrade)}`);
