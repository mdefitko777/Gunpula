// Official kit -> work (作品) tags from the Bandai Hobby WEB取説 catalogue
// (manual.bandai-hobby.net). Every listing card carries the kit name (JA, often EN),
// brand icon(s) /images/categories/<id>.jpeg and work icon(s) /images/titles/<id>.jpeg;
// the id -> name maps come from the alt text on the search form.
//
// Pages: https://manual.bandai-hobby.net/?page=N (20 cards per page, newest first).
// Incremental: when the previous snapshot is younger than 30 days we stop at the first
// page that contains no unseen kit; otherwise (or with ATLAS_MANUAL_FULL=1) every page is read.
// Metadata only (names, ids); no manual PDFs or images are stored.
//
// Output: data/atlas/gundam-src-manual.json
import path from "node:path";
import { politeFetch, requestSummary } from "./lib/http.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const BASE = "https://manual.bandai-hobby.net";
const OUT = path.join(ATLAS_DATA, "gundam-src-manual.json");
const MAX_PAGES = 400;

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseMaps(html) {
  const titles = {};
  const brands = {};
  for (const m of html.matchAll(/\/images\/(titles|categories)\/(\d+)\.jpeg"\s+alt="([^"]*)"/g)) {
    (m[1] === "titles" ? titles : brands)[m[2]] = decode(m[3]);
  }
  return { titles, brands };
}

function parseCards(html) {
  const cards = [];
  const blocks = html.split(/<div class="bl_result_item">/).slice(1);
  for (const block of blocks) {
    const id = block.match(/href="\/menus\/detail\/(\d+)"/)?.[1];
    if (!id) continue;
    const nameHtml = block.match(/<div class="bl_result_name">([\s\S]*?)<\/div>/)?.[1] || "";
    const en = decode(nameHtml.match(/<span class="bl_result_name_en">([\s\S]*?)<\/span>/)?.[1] || "");
    const ja = decode(nameHtml.replace(/<span[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, ""));
    const titles = [...block.matchAll(/\/images\/titles\/(\d+)\.jpeg/g)].map((m) => Number(m[1]));
    const brands = [...block.matchAll(/\/images\/categories\/(\d+)\.jpeg/g)].map((m) => Number(m[1]));
    const date = block.match(/<dd>\s*(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/);
    const card = { id: Number(id), ja, titles: [...new Set(titles)], brands: [...new Set(brands)] };
    if (en) card.en = en;
    if (date) card.release = `${date[1]}-${date[2].padStart(2, "0")}${date[3] ? `-${date[3].padStart(2, "0")}` : ""}`;
    cards.push(card);
  }
  const total = Number((html.match(/([\d,]+)件の結果/)?.[1] || "0").replace(/,/g, ""));
  return { cards, total };
}

async function main() {
  const previous = await readJson(OUT, null);
  const prevAgeDays = previous?.full_refresh_at ? (Date.now() - Date.parse(previous.full_refresh_at)) / 864e5 : Infinity;
  const full = process.env.ATLAS_MANUAL_FULL === "1" || !previous || prevAgeDays > 30;
  const known = new Map((previous?.kits || []).map((k) => [k.id, k]));
  const seen = new Map();
  let maps = previous ? { titles: previous.titles, brands: previous.brands } : { titles: {}, brands: {} };
  let total = 0;
  let pages = 0;
  let stale = false;
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await politeFetch(`${BASE}/?page=${page}`, { ttlHours: 24 * 5, accept: "text/html" });
      stale ||= res.stale;
      pages++;
      if (page === 1) {
        const m = parseMaps(res.body);
        if (Object.keys(m.titles).length) maps = m;
      }
      const { cards, total: t } = parseCards(res.body);
      total ||= t;
      if (!cards.length) break;
      let fresh = 0;
      for (const c of cards) {
        if (!known.has(c.id) && !seen.has(c.id)) fresh++;
        seen.set(c.id, c);
      }
      if (!full && fresh === 0) break;
      if (total && seen.size >= total) break;
      if (page % 25 === 0) console.log(`[manual] page ${page}, ${seen.size}/${total} cards`);
    }
  } catch (error) {
    console.warn(`[manual] fetch failed after ${pages} pages: ${error.message}`);
    if (!seen.size) {
      console.warn("[manual] keeping previous snapshot");
      return;
    }
  }
  const merged = new Map(known);
  for (const [id, c] of seen) merged.set(id, c);
  const kits = [...merged.values()].sort((a, b) => b.id - a.id);
  if (previous && kits.length < 0.8 * previous.kits.length) {
    console.warn(`[manual] only ${kits.length} kits (previous ${previous.kits.length}); keeping previous snapshot`);
    return;
  }
  const doc = {
    schema: 1,
    updated_at: today(),
    full_refresh_at: full && !stale ? new Date().toISOString() : previous?.full_refresh_at || null,
    sources: [
      {
        name: "BANDAI SPIRITS Bandai Hobby WEB取説 (manual.bandai-hobby.net)",
        url: `${BASE}/`,
        licence: "© BANDAI SPIRITS. Names and work/brand ids only (metadata), personal use; no manuals or images stored.",
        stale,
      },
    ],
    total_reported: total || null,
    titles: maps.titles,
    brands: maps.brands,
    kits,
  };
  const res = await writeCompactJson(OUT, doc);
  console.log(`[manual] ${kits.length} kits (${seen.size} seen on ${pages} pages, site reports ${total}); ${Object.keys(maps.titles).length} work ids. ${res.written ? "Wrote" : "Unchanged"} ${(res.bytes / 1024).toFixed(0)} KB`);
  console.log("[manual] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[manual] FAILED, previous data kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
