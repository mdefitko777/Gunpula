// Bulbapedia (CC BY-NC-SA 2.5) via the MediaWiki API: JP set lists (EN species, types, exact grade,
// Gorgeous/Ultra Beast/Legacy rows), JP promo list, set release dates, and the regional launch dates.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fetchJson } from "../lib/http.mjs";
import { enDate, findTemplates, nfkc, stripTags } from "../lib/util.mjs";

const API = "https://bulbapedia.bulbagarden.net/w/api.php";
export const BULBA_SOURCE = {
  name: "Bulbapedia — Pokémon Mezastar set lists",
  url: "https://bulbapedia.bulbagarden.net/wiki/Category:Mezastar_expansion_sets",
  licence: "CC BY-NC-SA 2.5 (Bulbapedia contributors); attribution required, non-commercial",
  role: "JP: English species, types, exact grade, Gorgeous/Ultra Beast/Legacy rows, promo campaigns, release dates; regional launch dates",
};

const FALLBACK_TITLES = [
  ...[1, 2, 3, 4].map((v) => `Set ${v} (Mezastar)`),
  ...[1, 2, 3, 4, 5].map((v) => `Super Tag set ${v} (Mezastar)`),
  ...[1, 2, 3, 4, 5].map((v) => `Double Chain set ${v} (Mezastar)`),
  ...[1, 2, 3, 4, 5].map((v) => `Gorgeous Star set ${v} (Mezastar)`),
];

export function titleToSet(title) {
  const t = title.replace(/_/g, " ");
  let m;
  if ((m = t.match(/^Set (\d) \(Mezastar\)$/))) return { series: "base", version: Number(m[1]) };
  if ((m = t.match(/^Super Tag set (\d) \(Mezastar\)$/i))) return { series: "supertag", version: Number(m[1]) };
  if ((m = t.match(/^Double Chain set (\d) \(Mezastar\)$/i))) return { series: "doublechain", version: Number(m[1]) };
  if ((m = t.match(/^Gorgeous Star set (\d) \(Mezastar\)$/i))) return { series: "gorgeousstar", version: Number(m[1]) };
  return null;
}

// Optional local snapshot of earlier, polite API responses (one JSON per page, MediaWiki
// formatversion 1 or 2), used only when the live API is unreachable or challenge-blocked.
// File name: "Set 1 (Mezastar)" -> Set_1_Mezastar.json; "Pokémon Mezastar" -> mezastar_main.json.
const SEED_DIR = process.env.ATLAS_BULBA_SEED_DIR || null;
const seedFile = (title) => (title === "Pokémon Mezastar" ? "mezastar_main.json" : title.replace(/ \(Mezastar\)$/, "_Mezastar").replace(/ /g, "_") + ".json");
export const bulbaStatus = { live: 0, seed: 0, error: null };

async function fromSeed(title) {
  if (!SEED_DIR) return null;
  try {
    const f = path.join(SEED_DIR, seedFile(title));
    const j = JSON.parse(await readFile(f, "utf8"));
    const w = j.parse?.wikitext;
    const text = typeof w === "string" ? w : w?.["*"];
    if (!text) return null;
    return { text, seededAt: (await stat(f)).mtime.toISOString() };
  } catch {
    return null;
  }
}

async function wikitext(title) {
  const url = `${API}?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&maxlag=5&page=${encodeURIComponent(title)}`;
  const pageUrl = `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  try {
    const r = await fetchJson(url, { maxAgeMs: 7 * 86400e3 });
    if (r.json.error) throw new Error(`Bulbapedia ${title}: ${r.json.error.code}`);
    bulbaStatus.live++;
    return { text: r.json.parse.wikitext, stale: r.stale, url: pageUrl };
  } catch (e) {
    bulbaStatus.error ||= e.message;
    const seed = await fromSeed(title);
    if (!seed) throw new Error(bulbaStatus.error || e.message);
    bulbaStatus.seed++;
    bulbaStatus.seededAt = seed.seededAt;
    return { text: seed.text, stale: true, url: pageUrl, seeded: true };
  }
}

function parseEntries(text) {
  const rows = [];
  for (const a of findTemplates(text, "MezastarExpansionList/entry")) {
    const no = nfkc(a[0] || "");
    let species = stripTags(a[1] || ""), page = null;
    const obp = (a[1] || "").match(/\{\{OBP\|([^|}]*)\|([^}]*)\}\}/);
    if (obp) { species = nfkc(obp[1]); page = nfkc(obp[2]); }
    const type1 = nfkc(a[2] || "") || null, type2 = nfkc(a[3] || "") || null;
    const grade = nfkc(a[4] || "");
    rows.push({ no, species, page, types: [type1, type2].filter(Boolean), grade: /^\d$/.test(grade) ? Number(grade) : null, extra: a.slice(5).filter(Boolean).join("|") || null });
  }
  return rows;
}

export async function fetchBulba() {
  let stale = false;
  let titles = [];
  try {
    const url = `${API}?action=query&format=json&formatversion=2&list=categorymembers&cmtitle=${encodeURIComponent("Category:Mezastar expansion sets")}&cmlimit=100&maxlag=5`;
    const r = await fetchJson(url, { maxAgeMs: 7 * 86400e3 });
    titles = (r.json.query?.categorymembers || []).map((m) => m.title).filter((t) => titleToSet(t));
  } catch (e) {
    bulbaStatus.error ||= e.message;
    titles = [];
  }
  if (titles.length < FALLBACK_TITLES.length) titles = [...new Set([...titles, ...FALLBACK_TITLES])];
  const sets = [];
  for (const title of titles) {
    const key = titleToSet(title);
    const w = await wikitext(title);
    stale ||= w.stale;
    const intro = w.text.replace(/\{\{[^{}]*\}\}/g, " ");
    const m = intro.match(/released (?:in Japan )?on ([A-Z][a-z]+ \d{1,2}, \d{4})/);
    const rows = parseEntries(w.text);
    const seen = new Set();
    const dedup = rows.filter((r) => {
      const k = `${r.no}|${r.species}|${r.page}|${r.types.join("/")}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    sets.push({ title, url: w.url, ...key, date: m ? enDate(m[1]) : null, rows: dedup, duplicate_rows: rows.length - dedup.length });
  }
  const promo = await wikitext("Promotional tags (Mezastar)");
  stale ||= promo.stale;
  const main = await wikitext("Pokémon Mezastar");
  stale ||= main.stale;
  const launch = {};
  for (const m of main.text.matchAll(/\|release_date_(\w+)=([^\n|]+)/g)) launch[m[1]] = enDate(m[2]);
  return { sets, promo: { url: promo.url, rows: parseEntries(promo.text) }, launch, main_url: main.url, stale };
}
