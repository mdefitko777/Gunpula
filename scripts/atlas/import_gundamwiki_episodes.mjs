// Import per-episode mobile weapon lists from The Gundam Wiki (gundam.fandom.com).
//
// 1. Semantic MediaWiki `action=ask`:
//      [[Concept:Episodes]] |?Series |?Episode number |?English Title          -> episode list
//      [[Mobile Weapon::+]] |?Mobile Weapon |?Note |?-Has subobject=parent    -> every
//        {{mecha|p=...|note=...}} subobject of episode and film infoboxes
// 2. Episode (and film) wikitext, 50 pages per request: links under "Mobile Weapons" /
//    "Mechanics" / "Mecha" / "Ships & Vehicles" headings fill gaps where the infobox is empty.
// 3. Linked titles that are not Mobile Weapon page titles are resolved through redirects.
//
// Descriptive User-Agent (lib/http.mjs), ~1 request/second, responses cached in ATLAS_CACHE_DIR.
// Output: data/atlas/gundam-src-episodes.json (pipeline snapshot; CC BY-SA 3.0 derived facts).
// If the wiki refuses us, the previous snapshot is kept; with none, ATLAS_FANDOM_FALLBACK_DIR
// may point at a research dump (<dir>/gundam_chapters/fandom/{smw_all_episodes,
// smw_all_episode_mecha,all_episode_wikitext}.json) and the snapshot records via=research-dump.
import path from "node:path";
import { fandomFilmPages } from "./gundam_chapter_works.mjs";
import { politeJson, requestSummary } from "./lib/http.mjs";
import { pageText, resolveRedirects } from "./lib/mediawiki.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const HOST = "gundam.fandom.com";
const API = `https://${HOST}/api.php`;
const OUT = path.join(ATLAS_DATA, "gundam-src-episodes.json");
const WIKI_MS = path.join(ATLAS_DATA, "gundam-src-gundamwiki.json");
const TTL = 24 * 6;

const SECTION = /^(=+)\s*(Mobile Weapons?|Mechanics?|Mecha|Mobile Suits?|Mobile Armou?rs?|Ships?(?: (?:&|and) Vehicles)?|Vehicles|Mobile Weapons? (?:&|and) Vehicles|Gunpla|Gunpla Used)\s*\1\s*$/gim;
const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const INFOBOX_MECHA = /\{\{\s*mecha\s*\|\s*p\s*=\s*([^|}\n]+)(?:\|\s*note\s*=\s*([^}\n]*))?/gi;

const normTitle = (t) => {
  const s = String(t || "").replace(/_/g, " ").replace(/#.*$/, "").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};
const cleanNote = (n) =>
  String(n || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

async function askAll(query, label) {
  const out = [];
  let offset = 0;
  let requests = 0;
  let stale = false;
  for (;;) {
    const qs = new URLSearchParams({ action: "ask", format: "json", query: `${query}|limit=500|offset=${offset}` });
    const res = await politeJson(`${API}?${qs}`, { ttlHours: TTL });
    stale ||= res.stale;
    requests++;
    if (res.json.error) throw new Error(`${label}: ${res.json.error.code} ${res.json.error.info}`);
    const results = res.json.query?.results;
    const rows = results && !Array.isArray(results) ? Object.entries(results) : [];
    out.push(...rows);
    const next = res.json["query-continue-offset"];
    if (!next || !rows.length) break;
    offset = Number(next);
    if (requests > 60) throw new Error(`${label}: too many pages`);
  }
  console.log(`[episodes] ${label}: ${out.length} rows in ${requests} requests`);
  return { rows: out, stale };
}

// Links under mecha headings. Returns {sec, fb, gp}: fb = links under a "Flashback" sub-heading,
// gp = links under a "Gunpla" heading (Build series episodes list the kits used; on other
// pages that heading lists kit releases, so the build only uses gp for Build works).
function sectionLinks(text) {
  const out = { sec: new Set(), fb: new Set(), gp: new Set() };
  SECTION.lastIndex = 0;
  let processedEnd = -1;
  let m;
  while ((m = SECTION.exec(text))) {
    if (m.index < processedEnd) continue; // nested heading already read with its parent
    const level = m[1].length;
    const kind = /^gunpla/i.test(m[2]) ? "gp" : "sec";
    const start = m.index + m[0].length;
    const next = new RegExp(`^={1,${level}}[^=].*?=+\\s*$`, "m").exec(text.slice(start));
    const end = next ? start + next.index : text.length;
    processedEnd = end;
    const stack = [];
    for (const line of text.slice(start, end).split("\n")) {
      const h = line.match(/^(=+)\s*(.*?)\s*\1\s*$/);
      if (h) {
        while (stack.length && stack[stack.length - 1].level >= h[1].length) stack.pop();
        stack.push({ level: h[1].length, flash: /flashback|recap|memor|hallucination/i.test(h[2]) });
        continue;
      }
      const flash = stack.some((x) => x.flash);
      for (const l of line.matchAll(LINK)) {
        const t = normTitle(l[1]);
        if (!t || /^(File|Image|Category|Template|wikipedia|wikia|w):/i.test(t)) continue;
        (flash ? out.fb : out[kind]).add(t);
      }
    }
  }
  for (const t of out.sec) out.fb.delete(t);
  for (const t of [...out.sec, ...out.fb]) out.gp.delete(t);
  return { sec: [...out.sec], fb: [...out.fb], gp: [...out.gp] };
}

// Official Japanese title from the episode infobox (`|kanji=`).
function infoboxKanji(text) {
  const m = String(text || "").match(/^\|\s*kanji\s*=\s*(.+)$/m);
  if (!m) return null;
  const v = m[1]
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .trim();
  return v && v.length <= 80 ? v : null;
}

function infoboxLinks(text) {
  const out = [];
  for (const m of String(text || "").matchAll(INFOBOX_MECHA)) out.push([normTitle(m[1]), cleanNote(m[2])]);
  return out;
}

async function fetchWikitext(titles) {
  const texts = new Map();
  let stale = false;
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "revisions", rvprop: "content", rvslots: "main", redirects: "1", titles: chunk.join("|") });
    const res = await politeJson(`${API}?${qs}`, { ttlHours: TTL });
    stale ||= res.stale;
    const q = res.json.query || {};
    const back = new Map();
    for (const n of q.normalized || []) back.set(n.to, n.from);
    for (const r of q.redirects || []) back.set(r.to, back.get(r.from) || r.from);
    for (const p of q.pages || []) {
      const text = pageText(p);
      if (!text) continue;
      texts.set(p.title, text);
      if (back.has(p.title)) texts.set(back.get(p.title), text);
    }
  }
  return { texts, stale };
}

async function fromApi() {
  const eps = await askAll("[[Concept:Episodes]]|?Series|?Episode number|?English Title", "Concept:Episodes");
  const subs = await askAll("[[Mobile Weapon::+]]|?Mobile Weapon|?Note|?-Has subobject=parent", "Mobile Weapon subobjects");
  const episodes = new Map();
  for (const [title, v] of eps.rows) {
    const po = v.printouts || {};
    episodes.set(title, {
      t: title,
      s: po.Series?.[0]?.fulltext || null,
      n: Number.isFinite(po["Episode number"]?.[0]) ? po["Episode number"][0] : null,
      en: po["English Title"]?.[0] || null,
    });
  }
  const byParent = new Map();
  for (const [, v] of subs.rows) {
    const po = v.printouts || {};
    const parent = po.parent?.[0]?.fulltext;
    const mw = po["Mobile Weapon"]?.[0]?.fulltext;
    if (!parent || !mw) continue;
    const list = byParent.get(parent) || byParent.set(parent, []).get(parent);
    const note = cleanNote((po.Note || []).join("; "));
    list.push(note ? [normTitle(mw), note] : [normTitle(mw)]);
  }
  const films = fandomFilmPages();
  const pagesToRead = [...new Set([...episodes.keys(), ...films])].filter((t) => !/^(File|Gundam Wiki|Category):/.test(t));
  const wt = await fetchWikitext(pagesToRead);
  return { episodes, byParent, films, texts: wt.texts, stale: eps.stale || subs.stale || wt.stale, via: "api" };
}

async function fromDump(dir) {
  const base = path.join(dir, "gundam_chapters", "fandom");
  const eps = await readJson(path.join(base, "smw_all_episodes.json"));
  const subs = await readJson(path.join(base, "smw_all_episode_mecha.json"));
  const wt = await readJson(path.join(base, "all_episode_wikitext.json"), {});
  const episodes = new Map();
  for (const [title, v] of Object.entries(eps)) {
    const po = v.printouts || {};
    episodes.set(title, { t: title, s: po.Series?.[0]?.fulltext || null, n: po["Episode number"]?.[0] ?? null, en: po["English Title"]?.[0] || null });
  }
  const byParent = new Map();
  for (const v of Object.values(subs)) {
    const po = v.printouts || {};
    const parent = po.ep?.[0]?.fulltext;
    const mw = po["Mobile Weapon"]?.[0]?.fulltext;
    if (!parent || !mw) continue;
    const note = cleanNote((po.Note || []).join("; "));
    (byParent.get(parent) || byParent.set(parent, []).get(parent)).push(note ? [normTitle(mw), note] : [normTitle(mw)]);
  }
  return { episodes, byParent, films: [], texts: new Map(Object.entries(wt)), stale: true, via: "research-dump" };
}

async function main() {
  const previous = await readJson(OUT, null);
  let r;
  try {
    r = await fromApi();
    if (r.episodes.size < 500) throw new Error(`only ${r.episodes.size} episodes`);
  } catch (error) {
    console.warn(`[episodes] Gundam Wiki API failed: ${error.message}`);
    if (previous) {
      console.warn("[episodes] keeping previous snapshot");
      return;
    }
    const dir = process.env.ATLAS_FANDOM_FALLBACK_DIR;
    if (!dir) throw error;
    r = await fromDump(dir);
  }

  const record = (title, base) => {
    const text = r.texts.get(title) || "";
    const mw = r.byParent.get(title) || [];
    const known = new Set(mw.map((x) => x[0]));
    // Infobox entries missing from SMW (pages not yet re-indexed).
    for (const [t, note] of infoboxLinks(text)) if (t && !known.has(t)) (mw.push(note ? [t, note] : [t]), known.add(t));
    const links = sectionLinks(text);
    const out = { ...base };
    const ja = infoboxKanji(text);
    if (ja) out.ja = ja;
    if (mw.length) out.mw = mw;
    for (const key of ["sec", "fb", "gp"]) {
      const list = links[key].filter((t) => !known.has(t));
      if (list.length) out[key] = list;
    }
    return out;
  };
  const episodes = [...r.episodes.values()].map((e) => record(e.t, e)).sort((a, b) => String(a.s).localeCompare(String(b.s)) || (a.n ?? 0) - (b.n ?? 0) || a.t.localeCompare(b.t));
  const films = {};
  for (const page of r.films) films[page] = record(page, { t: page });
  // Non-episode parents that carry subobjects (films, OVAs, compilation pages) for reference.
  const otherParents = [...r.byParent.keys()].filter((p) => !r.episodes.has(p) && !films[p]).sort();

  // Resolve linked titles that are not Mobile Weapon page titles through wiki redirects.
  const wiki = await readJson(WIKI_MS, null);
  const msTitles = new Set((wiki?.ms || []).map((m) => m.t));
  const linked = new Set();
  for (const e of [...episodes, ...Object.values(films)]) {
    for (const [t] of e.mw || []) linked.add(t);
    for (const t of [...(e.sec || []), ...(e.fb || []), ...(e.gp || [])]) linked.add(t);
  }
  let redirects = previous?.redirects || {};
  const unknown = [...linked].filter((t) => !msTitles.has(t));
  if (r.via === "api" && msTitles.size) {
    try {
      const { redirects: map } = await resolveRedirects(HOST, unknown, { ttlHours: 24 * 30 });
      redirects = Object.fromEntries([...map].filter(([, to]) => msTitles.has(normTitle(to))).map(([f, to]) => [f, normTitle(to)]).sort());
    } catch (error) {
      console.warn(`[episodes] redirect resolution failed (${error.message}); keeping previous map`);
    }
  }
  // Section links that are neither MS pages nor redirects to one are dropped from the snapshot.
  for (const e of [...episodes, ...Object.values(films)]) {
    for (const key of ["sec", "fb", "gp"]) {
      if (!e[key]) continue;
      e[key] = e[key].filter((t) => msTitles.has(t) || redirects[t]);
      if (!e[key].length) delete e[key];
    }
  }

  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "The Gundam Wiki (Fandom): episode pages (Semantic MediaWiki subobjects + Mobile Weapons sections)",
        url: `https://${HOST}/wiki/Category:Episodes`,
        licence: "CC BY-SA 3.0; attribution: The Gundam Wiki contributors",
        via: r.via,
        stale: r.stale,
      },
    ],
    stats: {
      episodes: episodes.length,
      with_infobox_mecha: episodes.filter((e) => e.mw).length,
      with_section_mecha: episodes.filter((e) => e.sec || e.fb).length,
      with_gunpla_section: episodes.filter((e) => e.gp).length,
      subobject_parents_not_episodes: otherParents.length,
    },
    episodes,
    films,
    other_parents: otherParents,
    redirects,
  };
  const res = await writeCompactJson(OUT, doc);
  console.log(`[episodes] ${JSON.stringify(doc.stats)} via ${r.via}; ${Object.keys(redirects).length} redirects. ${res.written ? "Wrote" : "Unchanged"} ${path.basename(OUT)} (${(res.bytes / 1024).toFixed(0)} KB)`);
  console.log("[episodes] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[episodes] FAILED, previous snapshot kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
