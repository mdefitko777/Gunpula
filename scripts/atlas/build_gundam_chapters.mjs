// Build "what is in each chapter" for Gundam works: per-arc (G Gen stage) and per-episode
// mobile weapon lists, keyed by the MS ids of data/atlas/gundam-ms.json (= Gundam Wiki titles).
//
// Inputs (repo only, no network):
//   data/atlas/gundam-ms.json                  works[] + MS master (ids, model numbers, names)
//   data/atlas/gundam-gget-roster.json         GGET unit names (to map stage NPC units)
//   data/atlas/gundam-kit-ms.json              kit links (stats only)
//   data/atlas/gundam-src-gundamwiki.json      wiki Mobile Weapon pages (unit types, extra_ms names)
//   data/atlas/gundam-src-episodes.json        import_gundamwiki_episodes.mjs
//   data/atlas/gundam-src-gget-stages.json     import_gget_stages.mjs
//   data/atlas/gundam-src-official-episodes.json import_official_episodes.mjs
//   data/atlas/gundam-chapter-overrides.json   human fixes (optional)
//   scripts/atlas/gundam_chapter_works.mjs     work -> seasons / films table
//
// Outputs (compact JSON):
//   data/atlas/gundam-chapters.json          {schema, updated_at, sources, roles, unit_types,
//       extra_ms, works{work_id: {kind, arcs[{id, order, title{ja,en,ko,zh_tw}, episode_from,
//       episode_to, anchor_episode, gget_stage_id, ms[{ms, side}]}], episodes[{no, title_ja,
//       title_en, ms[{ms, role, source, side?, note?}]}]}}, stats}
//   data/atlas/gundam-chapters-review.json   unresolved wiki titles / NPC units / unanchored and
//       skipped stages / GGET links overridden / official subtitles not merged
//
// Alignment: a G Gen stage is named after the episode it adapts. Its JP title is matched to the
// official JP subtitle (NFKC, punctuation-insensitive), then its EN title to the Gundam Wiki EN
// title, then by containment; anchors must increase through the stage list. An arc covers its
// anchor episode up to the episode before the next anchor (the first arc also covers the
// episodes before its anchor). Cutscene-only stages are skipped and multi-part stages
// ("…1/2/3") fold into one arc. Film works: one episode per film.
// MS ids: master ids, or Gundam Wiki Mobile Weapon titles the master drops (listed in extra_ms).
import path from "node:path";
import { gzipSync } from "node:zlib";
import { CHAPTER_WORKS } from "./gundam_chapter_works.mjs";
import { ATLAS_DATA, modelKey, nameKey, nfkc, pct, readJson, today, uniq, writeCompactJson } from "./lib/util.mjs";

const P = (f) => path.join(ATLAS_DATA, f);
const MIN_RATIO = Number(process.env.ATLAS_MIN_CHAPTER_RATIO || 0.8);

const SIDE = { 1: "ally", 2: "enemy", 3: "third", 4: "third" };
const SIDE_ORDER = { ally: 0, enemy: 1, third: 2 };
const ROLES = {
  debut: "first appearance (Gundam Wiki note, or first listed episode of an MS that debuts in this work when the work's episode data is near complete)",
  ally: "on the protagonists' side (G Gen stage battle_side 1: ally / guest), taken from the nearest arc that has this MS",
  enemy: "opposing side (G Gen battle_side 2), nearest arc",
  third: "third party (G Gen battle_side 3/4), nearest arc",
  flashback: "only in a flashback / recap (Gundam Wiki note)",
  appears: "appears; side unknown (no G Gen stage data for this MS in this work). debut / flashback entries carry the side separately in 'side' when known",
};

// ---------------------------------------------------------------- text keys
// Furigana in brackets ("宇宙(そら)") is dropped before comparing.
const jaKey = (s) => nfkc(s).toLowerCase().replace(/[(（][ぁ-ゖー]+[)）]/g, "").replace(/[\s!！?？・･、。,，.．「」『』【】〈〉《》()（）\[\]［］〜~～ー\-‐－―:：;；'"“”‘’…/／]/g, "");
const enKey = (s) =>
  nfkc(s)
    .toLowerCase()
    .replace(/\s*\((episode|film|movie|ova|[^)]*episode[^)]*)\)\s*$/i, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
// "/" belongs to many model numbers, so only "," "、" and " / " separate (as in import_gget_roster).
const splitModels = (m) =>
  String(m || "")
    .split(/\s*[,、，]\s*|\s+[\/／]\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^[-－ー—]+$/.test(s));
const baseName = (n) => nfkc(n).replace(/\s*[(（](EX|EXA|SP|ULT|ULTIMATE|NPC)[)）]\s*$/i, "").trim();
const loose = (m) => m.replace(/-/g, "");
// "キラ編「混沌の幕開け」2" / "The Dawn of Chaos 2" -> {base, n}; "遭遇戦-2" (separate encounter stages) is not a part.
const partOf = (t) => {
  const m = String(t || "").match(/^(.*?[^\s\d\-－:：])\s*(\d{1,2})$/);
  return m ? { base: m[1].trim(), n: Number(m[2]) } : null;
};

function addTo(map, key, value) {
  if (!key) return;
  const list = map.get(key) || map.set(key, []).get(key);
  if (!list.includes(value)) list.push(value);
}

// ---------------------------------------------------------------- note -> role
function noteRole(note) {
  const n = String(note || "");
  if (/first\s*appear|debut/i.test(n)) return "debut";
  if (/flashback|recap|memory|hallucination/i.test(n)) return "flashback";
  return null;
}
// Notes that add information beyond the role (destroyed, wreckage, image only, remaster only...).
function keepNote(note) {
  const n = String(note || "")
    .split(/\s*;\s*/)
    .filter((x) => x && !/^(first\s*appear\w*|first appearace|flashback\(?s?\)?(\s*only)?|in flashback\(s\))$/i.test(x.trim()))
    .join("; ");
  return n ? n.slice(0, 48) : null;
}

async function main() {
  const [msDoc, roster, kitDoc, epiDoc, stageDoc, offDoc, overridesRaw, previous, wikiMs] = await Promise.all([
    readJson(P("gundam-ms.json")),
    readJson(P("gundam-gget-roster.json"), { units: [] }),
    readJson(P("gundam-kit-ms.json"), { links: {} }),
    readJson(P("gundam-src-episodes.json"), null),
    readJson(P("gundam-src-gget-stages.json"), null),
    readJson(P("gundam-src-official-episodes.json"), null),
    readJson(P("gundam-chapter-overrides.json"), {}),
    readJson(P("gundam-chapters.json"), null),
    readJson(P("gundam-src-gundamwiki.json"), { ms: [] }),
  ]);
  // Gundam Wiki unit type (Suit / Armor / Ship / Vehicle / Fighter ...); GGET-only records are units.
  const unitType = new Map((wikiMs.ms || []).filter((m) => m.type).map((m) => [m.t, m.type]));
  const isSuit = (id) => id.startsWith("gget:") || ["Suit", "Armor", "Man-Machine", "Doll"].includes(unitType.get(id) || "Suit");
  const typeRank = (id) => (isSuit(id) ? 0 : { Fighter: 1, Ship: 2 }[unitType.get(id)] ?? 3);
  if (!epiDoc && !stageDoc) throw new Error("no chapter sources (run the import steps first)");
  const overrides = {
    wiki: overridesRaw.wiki_title || {},
    npc: overridesRaw.gget_npc || {},
    anchors: overridesRaw.stage_anchor || {},
  };

  // ---------------------------------------------------------------- MS indices
  const msById = new Map(msDoc.ms.map((m) => [m.id, m]));
  const msLower = new Map(msDoc.ms.map((m) => [m.id.toLowerCase(), m.id]));
  const rosterById = new Map((roster.units || []).map((u) => [u.id, u]));
  const byGget = new Map();
  const byModel = new Map();
  const byName = new Map();
  for (const m of msDoc.ms) {
    for (const g of m.gget_ids || []) byGget.set(g, m.id);
    for (const mk of m.model_numbers || []) {
      addTo(byModel, modelKey(mk), m.id);
      addTo(byModel, loose(modelKey(mk)), m.id);
    }
    const names = [m.names?.ja, m.names?.en];
    for (const g of m.gget_ids || []) {
      const u = rosterById.get(g);
      if (u) names.push(u.names?.ja, u.short_names?.ja, u.names?.en);
    }
    for (const n of uniq(names.map((x) => (x ? baseName(x) : null)))) {
      const k = nameKey(n);
      if (k.length >= 2) addTo(byName, k, m.id);
    }
  }
  const unresolvedWiki = new Map();
  const wikiRedirects = { ...(wikiMs.redirects || {}), ...(epiDoc?.redirects || {}) };
  // Gundam Wiki Mobile Weapon pages that the MS master leaves out (no work, kit or GGET link):
  // still valid ids (same key space: wiki page title), described in the output's extra_ms.
  const wikiPage = new Map((wikiMs.ms || []).map((m) => [m.t, m]));
  const extraUsed = new Map(); // id -> link count
  const known = (id) => msById.has(id) || wikiPage.has(id);
  const useId = (id) => {
    if (!msById.has(id)) extraUsed.set(id, (extraUsed.get(id) || 0) + 1);
    return id;
  };
  function resolveWiki(title) {
    const t = String(title || "").trim().replace(/\]+$/, "").trim();
    if (!t) return null;
    const o = overrides.wiki[t];
    if (o !== undefined) return o && known(o) ? useId(o) : null;
    if (msById.has(t)) return t;
    const r = wikiRedirects[t];
    if (r && msById.has(r)) return r;
    const l = msLower.get(t.toLowerCase());
    if (l) return l;
    if (wikiPage.has(t)) return useId(t);
    if (r && wikiPage.has(r)) return useId(r);
    unresolvedWiki.set(t, (unresolvedWiki.get(t) || 0) + 1);
    return null;
  }
  // SMW sometimes stores two pages in one value ("Oni Dom;Oni Dom (red color variant)").
  const splitTitles = (title) =>
    String(title || "")
      .split(/\s*;\s*/)
      .map((x) => x.trim())
      .filter(Boolean);

  const unmatchedNpc = new Map();
  const ggetDisagreements = [];
  const npcCache = new Map();
  function resolveNpc(unit, workId) {
    const ck = `${unit.u}|${workId}`;
    if (npcCache.has(ck)) return npcCache.get(ck);
    let id = null;
    const o = overrides.npc[String(unit.u)];
    if (o !== undefined) id = o && known(o) ? useId(o) : null;
    else if (byGget.has(unit.u)) {
      id = byGget.get(unit.u);
      // The master folds some GGET forms into one MS ("ガンダム・バルバトス(第1形態)" ->
      // Barbatos Lupus). When the unit name (without its form / mode tag) is exactly the name
      // of another MS with the same model number that belongs to this work, use that one.
      const n0 = baseName(unit.n);
      const keys = uniq([n0, n0.replace(/【[^】]*】/g, "").replace(/\s*[(（][^)）]*[)）]\s*$/, "").trim()].map(nameKey));
      const named = (msId) => [msById.get(msId)?.names?.ja, msById.get(msId)?.names?.en].some((x) => x && keys.includes(nameKey(baseName(x))));
      if (!named(id)) {
        const models = uniq(splitModels(unit.m).map(modelKey));
        const alt = uniq(models.flatMap((mk) => byModel.get(mk) || [])).filter((x) => {
          const m = msById.get(x);
          return x !== id && named(x) && (!m.variant_of_work || m.variant_of_work === workId);
        });
        if (alt.length === 1) {
          ggetDisagreements.push({ unit: unit.u, name: unit.n, work: workId, master: id, used: alt[0] });
          id = alt[0];
        }
      }
    } else {
      const nk = nameKey(baseName(unit.n));
      const score = (msId) => {
        const m = msById.get(msId);
        const names = [m.names?.ja, m.names?.en, ...(m.gget_ids || []).flatMap((g) => [rosterById.get(g)?.names?.ja, rosterById.get(g)?.short_names?.ja])];
        return (
          (names.some((x) => x && nameKey(baseName(x)) === nk) ? 4 : 0) +
          ((m.works || []).includes(workId) ? 2 : 0) +
          (m.debut_work === workId ? 1 : 0) -
          (m.variant_of_work && m.variant_of_work !== workId ? 6 : 0) -
          (m.id.includes("(") ? 0.5 : 0) -
          (m.id.startsWith("gget:") ? 0.25 : 0)
        );
      };
      const models = uniq(splitModels(unit.m).map(modelKey));
      let cands = uniq(models.flatMap((mk) => byModel.get(mk) || []));
      if (!cands.length) cands = uniq(models.flatMap((mk) => byModel.get(loose(mk)) || []));
      if (!cands.length) {
        // Name variants: as written; without a form tag (【MA形態】, (第2形態)) or an
        // equipment / affiliation qualifier ((ブースター装備), (袖付き), (石動機)); ships as "<name>級".
        const n0 = baseName(unit.n);
        const noForm = n0.replace(/【[^】]*(形態|モード|MODE)[^】]*】/g, "").trim();
        const noQual = noForm.replace(/\s*[(（][^)）]*[)）]\s*$/, "").trim();
        const shipBase = noQual.includes("級") ? noQual.slice(0, noQual.indexOf("級") + 1) : null;
        const keys = uniq([n0, noForm, noQual, shipBase, shipBase ? null : `${noQual}級`].map((x) => (x ? nameKey(x) : null))).filter((k) => k.length >= 2);
        for (const k of keys) {
          cands = [...(byName.get(k) || [])];
          if (cands.length) break;
        }
      }
      if (cands.length) id = [...cands].sort((a, b) => score(b) - score(a) || a.length - b.length)[0];
    }
    if (!id) {
      const k = `${unit.u} ${unit.n} [${unit.m}]`;
      unmatchedNpc.set(k, (unmatchedNpc.get(k) || 0) + 1);
    }
    npcCache.set(ck, id);
    return id;
  }

  // ---------------------------------------------------------------- source indices
  const fandomBySeries = new Map();
  for (const e of epiDoc?.episodes || []) if (e.s) addTo(fandomBySeries, e.s, e);
  const fandomByTitle = new Map((epiDoc?.episodes || []).map((e) => [e.t, e]));
  const films = epiDoc?.films || {};
  const officialBySlug = new Map((offDoc?.series || []).map((s) => [s.slug, s]));
  const stageSeries = new Map((stageDoc?.series || []).map((s) => [s.id, s]));
  const stagePayload = stageDoc?.stages || {};
  const configById = new Map(CHAPTER_WORKS.map((w) => [w.id, w]));

  // Fandom record -> [{ms, note, source}]
  // Section links: sec = mecha headings, fb = under a "Flashback" sub-heading, gp = "Gunpla"
  // headings (only meaningful for Build series episodes, where they list the kits used).
  function fandomMs(rec, { gunpla = false } = {}) {
    const out = [];
    const seen = new Set();
    const add = (title, note, source) => {
      for (const t of splitTitles(title)) {
        const id = resolveWiki(t);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ ms: id, note: note || null, source });
      }
    };
    for (const [title, note] of rec?.mw || []) add(title, note, "fandom_infobox");
    for (const title of rec?.sec || []) add(title, null, "fandom_section");
    if (gunpla) for (const title of rec?.gp || []) add(title, null, "fandom_section");
    for (const title of rec?.fb || []) add(title, "Flashback", "fandom_section");
    return out;
  }

  // ---------------------------------------------------------------- per work
  const works = {};
  const stats = {};
  const unanchored = [];
  const skippedStages = [];
  const droppedOfficial = [];
  const usedNonSuits = new Map();
  const kitCount = new Map();
  for (const links of Object.values(kitDoc.links || {})) for (const l of links) kitCount.set(l.ms, (kitCount.get(l.ms) || 0) + 1);

  for (const work of msDoc.works) {
    const cfg = configById.get(work.id) || {};
    const isFilm = Boolean(cfg.films?.length);
    const msOpts = { gunpla: work.timeline === "BUILD" };

    // 1. Episodes: official subtitles + Gundam Wiki titles and MS.
    const eps = new Map(); // no -> {no, title_ja, title_en, wiki, raw[]}
    const ep = (no) => eps.get(no) || eps.set(no, { no, title_ja: null, title_en: null, wiki: null, raw: [] }).get(no);
    if (isFilm) {
      cfg.films.forEach((f, i) => {
        const e = ep(i + 1);
        const off = f.official ? officialBySlug.get(f.official) : null;
        if (off?.title) e.title_ja = off.title;
        if (f.fandom_page) {
          e.title_en = f.fandom_page;
          e.wiki = f.fandom_page;
          e.raw = fandomMs(films[f.fandom_page], msOpts);
        }
      });
    } else {
      // 1a. Gundam Wiki episodes (canonical numbering: original broadcast order).
      const official = []; // {no, ja}
      let lastMax = null;
      for (const season of cfg.seasons || []) {
        for (const series of [season.fandom].flat().filter(Boolean)) {
          for (const rec of fandomBySeries.get(series) || []) {
            if (!Number.isFinite(rec.n)) continue;
            const e = ep(rec.n + (season.fandom_offset || 0));
            if (e.wiki) continue; // first page wins (duplicate numbering on the wiki)
            e.title_en = rec.en || rec.t;
            e.kanji = rec.ja || null;
            e.wiki = rec.t;
            e.raw = fandomMs(rec, msOpts);
          }
        }
        if (season.official) {
          const off = officialBySlug.get(season.official);
          (off?.seasons || []).forEach((list, i) => {
            if (!list.length) return;
            const min = Math.min(...list.map((x) => x.n));
            let base = 0;
            if (i === 0 && Number.isFinite(season.offset)) base = season.offset;
            else if (lastMax !== null && min <= lastMax) base = lastMax;
            for (const x of list) official.push({ no: base + x.n, ja: x.ja || null });
            lastMax = Math.max(...list.map((x) => base + x.n));
          });
        }
      }
      for (const [no, page] of Object.entries(cfg.episode_pages || {})) {
        const e = ep(Number(no));
        const rec = films[page] || fandomByTitle.get(page);
        e.wiki ||= page;
        e.title_en ||= rec?.en || page;
        e.kanji ||= rec?.ja || null;
        if (!e.raw.length) e.raw = fandomMs(rec, msOpts);
      }
      // 1b. Official subtitles: matched to wiki episodes by Japanese title first (the official
      //     site can use remaster numbering, e.g. SEED HD has 48 episodes vs 50 broadcast), then
      //     by number when the matched pairs show the two numberings agree.
      const byKanji = new Map();
      for (const e of eps.values()) if (e.kanji) addTo(byKanji, jaKey(e.kanji), e);
      const taken = new Set();
      const leftovers = [];
      let sameNo = 0;
      let matched = 0;
      const pairs = []; // {no: official no, d: wiki no - official no}
      for (const o of official) {
        const cands = (byKanji.get(jaKey(o.ja)) || []).filter((e) => !taken.has(e.no));
        const hit = cands.sort((a, b) => Math.abs(a.no - o.no) - Math.abs(b.no - o.no))[0];
        if (hit && o.ja) {
          hit.title_ja = o.ja;
          taken.add(hit.no);
          pairs.push({ no: o.no, d: hit.no - o.no });
          matched++;
          if (hit.no === o.no) sameNo++;
        } else leftovers.push(o);
      }
      const numberingAgrees = !matched || sameNo >= 0.9 * matched;
      // Local numbering offset: when the nearest title-matched official episodes on both sides
      // agree on (wiki no - official no), an unmatched subtitle belongs to that wiki episode
      // (remaster renumbering; spelling variants such as おだやかな日に / 穏やかな日に).
      pairs.sort((a, b) => a.no - b.no);
      const localOffset = (no) => {
        const before = pairs.filter((p) => p.no < no).at(-1);
        const after = pairs.find((p) => p.no > no);
        return before && after && before.d === after.d ? before.d : null;
      };
      for (const o of leftovers) {
        const d = localOffset(o.no);
        const target = d !== null ? eps.get(o.no + d) : null;
        const e = eps.get(o.no);
        if (target && o.ja && !taken.has(target.no)) {
          target.title_ja = o.ja;
          taken.add(target.no);
        } else if (!e && d === null) {
          ep(o.no).title_ja = o.ja;
          taken.add(o.no);
        } else if (e && numberingAgrees && !taken.has(o.no)) {
          e.title_ja = o.ja;
          taken.add(o.no);
        } else droppedOfficial.push({ work: work.id, no: o.no, ja: o.ja });
      }
      for (const e of eps.values()) e.title_ja ||= e.kanji || null;
    }
    const episodes = [...eps.values()].sort((a, b) => a.no - b.no);
    const lastEpisode = episodes.length ? episodes[episodes.length - 1].no : null;

    // 2. Arcs: G Gen normal stages of every G Gen series folded into the work.
    const ggetIds = work.gget_series_ids || (work.gget_series_id ? [work.gget_series_id] : []);
    const arcs = [];
    const addUnits = (units, payload) => {
      for (const u of payload?.units || []) {
        const id = resolveNpc(u, work.id);
        if (!id) continue;
        const side = SIDE[u.s] || "third";
        const k = `${id}|${side}`;
        const e = units.get(k) || { ms: id, side, c: 0, first: units.size };
        e.c += u.c || 1;
        units.set(k, e);
      }
    };
    for (const sid of ggetIds) {
      const series = stageSeries.get(sid);
      // Bases shared by two or more stages of this series mark multi-part stages.
      const baseCount = new Map();
      for (const st of series?.stages || []) {
        const b = st.diff === 1 ? partOf(st.titles?.ja)?.base : null;
        if (b) baseCount.set(b, (baseCount.get(b) || 0) + 1);
      }
      let last = null;
      for (const st of series?.stages || []) {
        if (st.diff !== 1) continue;
        const payload = stagePayload[st.id];
        // Cutscene-only stages (no battle map, no units) are not chapters of their own.
        if (payload && !payload.maps && !(payload.units || []).length) {
          skippedStages.push({ work: work.id, stage: st.id, ja: st.titles?.ja || null, reason: "movie_only" });
          continue;
        }
        const title = { ja: st.titles?.ja || null, en: st.titles?.en || null, ko: st.titles?.ko || null, zh_tw: st.titles?.zh_tw || null };
        // Multi-part stages ("キラ編「混沌の幕開け」1/2/3") fold into one arc.
        const pj = partOf(title.ja);
        const pe = partOf(title.en);
        const part = pj && pe && pj.n === pe.n && baseCount.get(pj.base) > 1 ? { ja: pj.base, en: pe.base, n: pj.n } : null;
        if (last && part && last.part && part.ja === last.part.ja && part.en === last.part.en && part.n > last.part.n) {
          last.stages.push(st);
          last.part.n = part.n;
          addUnits(last.units, payload);
          continue;
        }
        const arc = {
          id: `gget-${st.id}`,
          gget_series_id: sid,
          stage: st,
          stages: [st],
          title,
          units: new Map(),
          part,
        };
        addUnits(arc.units, payload);
        arcs.push(arc);
        last = arc;
      }
    }
    for (const a of arcs) {
      if (a.part) for (const k of Object.keys(a.title)) a.title[k] = a.title[k] ? a.title[k].replace(/\s*\d{1,2}$/, "") || a.title[k] : null;
      a.ms = [...a.units.values()].sort((x, y) => SIDE_ORDER[x.side] - SIDE_ORDER[y.side] || x.first - y.first);
    }

    // 3. Anchor arcs to episodes.
    if (arcs.length && episodes.length) {
      if (isFilm) {
        for (const a of arcs) {
          const film = cfg.gget_film?.[a.gget_series_id] || 1;
          a.anchor = film;
          a.from = film;
          a.to = film;
        }
      } else {
        const jaIdx = episodes.map((e) => ({ no: e.no, ja: jaKey(e.title_ja), ja2: jaKey(e.kanji), en: enKey(e.title_en) }));
        let prev = -Infinity;
        for (const a of arcs) {
          const o = overrides.anchors[String(a.stage.id)];
          if (o !== undefined) {
            a.anchor = o === null ? null : Number(o);
            a.method = "override";
            if (a.anchor !== null) prev = a.anchor;
            continue;
          }
          const sj = jaKey(a.title.ja);
          const se = enKey(a.title.en);
          const tests = [
            ["ja", (e) => sj && (e.ja === sj || e.ja2 === sj)],
            ["en", (e) => se && e.en === se],
            ["ja_contains", (e) => sj && e.ja && Math.min(sj.length, e.ja.length) >= 3 && (sj.includes(e.ja) || e.ja.includes(sj))],
            ["en_contains", (e) => se && e.en && Math.min(se.length, e.en.length) >= 6 && (se.includes(e.en) || e.en.includes(se))],
          ];
          a.anchor = null;
          for (const [method, test] of tests) {
            const hit = jaIdx.find((e) => e.no >= prev && test(e));
            if (hit) {
              a.anchor = hit.no;
              a.method = method;
              prev = hit.no;
              break;
            }
          }
        }
        const isAnchored = (a) => a.anchor !== null && a.anchor !== undefined;
        const anchored = arcs.filter(isAnchored);
        for (const a of anchored) {
          const next = anchored.find((b) => b.anchor > a.anchor);
          a.from = a.anchor;
          a.to = next ? next.anchor - 1 : lastEpisode;
        }
        // Story mode starts at the beginning: the first anchored arc also covers the episodes
        // before its anchor (SEED's first stage is named after episode 2). A prologue (no 0)
        // is only included when the arc itself is anchored there.
        const first = anchored[0];
        if (first && first.gget_series_id === ggetIds[0]) {
          const start = episodes.find((e) => e.no >= Math.min(1, first.anchor))?.no;
          if (start !== undefined && start < first.from) first.from = start;
        }
        // Unanchored stages: a configured range for their G Gen series, else the gap between
        // the neighbouring anchored stages of the same G Gen series (flagged as inferred).
        arcs.forEach((a, i) => {
          if (isAnchored(a)) return;
          const range = cfg.gget_range?.[a.gget_series_id];
          if (range) {
            [a.from, a.to] = range;
            a.inferred = true;
            return;
          }
          const same = (b) => b.gget_series_id === a.gget_series_id && isAnchored(b);
          const prevA = arcs.slice(0, i).reverse().find(same);
          const nextA = arcs.slice(i + 1).find(same);
          if (!prevA && !nextA) return;
          const lo = prevA ? Math.min(prevA.anchor + 1, nextA ? Math.max(nextA.anchor - 1, prevA.anchor) : Infinity) : episodes[0].no;
          const hi = nextA ? Math.max(nextA.anchor - 1, lo) : lastEpisode;
          if (!(lo <= hi) || lo > lastEpisode) return;
          a.from = lo;
          a.to = hi;
          a.inferred = true;
        });
      }
    }
    // Arcs with neither units nor an episode range carry no information (side-story stages
    // whose NPC units are all unmapped, e.g. IBO "スープパーティ").
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      if (!a.ms.length && (a.from === null || a.from === undefined)) {
        skippedStages.push({ work: work.id, stage: a.stage.id, ja: a.title.ja, reason: "no_units_no_range" });
        arcs.splice(i, 1);
      }
    }
    for (const a of arcs) if (a.anchor === null || a.anchor === undefined) unanchored.push({ work: work.id, stage: a.stage.id, ja: a.title.ja, en: a.title.en, range: a.from != null ? [a.from, a.to] : null });

    // 4. Episode roles: wiki note -> debut / flashback; else the side the MS has in the nearest
    //    arc (by episode distance; 0 = the arc covering the episode) that contains it, so a unit
    //    that changes sides (Buster: enemy early in SEED, ally later) gets the side of its era;
    //    else its most common side across the work's unplaced stages.
    const workSide = new Map();
    for (const a of arcs) for (const u of a.ms) {
      const s = workSide.get(u.ms) || workSide.set(u.ms, {}).get(u.ms);
      s[u.side] = (s[u.side] || 0) + u.c;
    }
    const topSide = (counts) => Object.entries(counts || {}).sort((a, b) => b[1] - a[1] || SIDE_ORDER[a[0]] - SIDE_ORDER[b[0]])[0]?.[0] || null;
    const placed = (a) => a.from !== undefined && a.from !== null;
    const nearestSide = (msId, no) => {
      let best = Infinity;
      let counts = {};
      for (const a of arcs) {
        if (!placed(a)) continue;
        const d = no < a.from ? a.from - no : no > a.to ? no - a.to : 0;
        if (d > best) continue;
        const hits = a.ms.filter((u) => u.ms === msId);
        if (!hits.length) continue;
        if (d < best) [best, counts] = [d, {}];
        for (const u of hits) counts[u.side] = (counts[u.side] || 0) + u.c;
      }
      return topSide(counts);
    };
    const coverage = episodes.length ? episodes.filter((e) => e.raw.length).length / episodes.length : 0;
    const explicitDebut = new Set(episodes.flatMap((e) => e.raw.filter((r) => noteRole(r.note) === "debut").map((r) => r.ms)));
    const derivedDebutSeen = new Set();
    const outEpisodes = episodes.map((e) => {
      const ms = e.raw.map((r) => {
        let role = noteRole(r.note);
        if (!role && !isFilm && coverage >= 0.8 && !explicitDebut.has(r.ms) && msById.get(r.ms)?.debut_work === work.id && !derivedDebutSeen.has(r.ms)) role = "debut";
        if (role === "debut") derivedDebutSeen.add(r.ms);
        const side = nearestSide(r.ms, e.no) || topSide(workSide.get(r.ms));
        role ||= side || "appears";
        const o = { ms: r.ms, role, source: r.source };
        // debut / flashback entries still say which side the unit fights on, when known.
        if (side && side !== role) o.side = side;
        const note = keepNote(r.note);
        if (note) o.note = note;
        return o;
      });
      // Mobile suits / armors first, then fighters, ships, other vehicles (stable within groups).
      ms.sort((a, b) => typeRank(a.ms) - typeRank(b.ms));
      for (const r of e.raw) derivedDebutSeen.add(r.ms);
      const o = { no: e.no, title_ja: e.title_ja, title_en: e.title_en };
      if (e.wiki && e.wiki !== e.title_en) o.wiki = e.wiki;
      o.ms = ms;
      return o;
    });

    if (!arcs.length && !outEpisodes.length) continue;
    const outArcs = arcs.map((a, i) => ({
      id: a.id,
      order: i + 1,
      title: a.title,
      episode_from: a.from ?? null,
      episode_to: a.to ?? null,
      anchor_episode: a.anchor ?? null,
      ...(a.inferred ? { range_inferred: true } : {}),
      gget_stage_id: a.stage.id,
      ...(a.stages.length > 1 ? { gget_stage_ids: a.stages.map((s) => s.id) } : {}),
      ...(ggetIds.length > 1 ? { gget_series_id: a.gget_series_id } : {}),
      ms: a.ms.map((u) => ({ ms: u.ms, side: u.side })),
    }));
    works[work.id] = { kind: isFilm ? "films" : "series", arcs: outArcs, episodes: outEpisodes };

    // 5. Stats.
    const distinct = new Set([...outEpisodes.flatMap((e) => e.ms.map((x) => x.ms)), ...outArcs.flatMap((a) => a.ms.map((x) => x.ms))]);
    const withKit = [...distinct].filter((id) => kitCount.get(id) > 0).length;
    const suits = [...distinct].filter(isSuit);
    const suitsWithKit = suits.filter((id) => kitCount.get(id) > 0).length;
    for (const id of distinct) if (!isSuit(id)) usedNonSuits.set(id, unitType.get(id));
    const epWithMs = outEpisodes.filter((e) => e.ms.length).length;
    const epWithArc = outEpisodes.filter((e) => e.ms.length || outArcs.some((a) => a.episode_from !== null && e.no >= a.episode_from && e.no <= a.episode_to && a.ms.length)).length;
    stats[work.id] = {
      episodes: outEpisodes.length,
      episodes_with_ms: epWithMs,
      episodes_with_ms_or_arc: epWithArc,
      episode_links: outEpisodes.reduce((n, e) => n + e.ms.length, 0),
      arcs: outArcs.length,
      arcs_anchored: outArcs.filter((a) => a.episode_from !== null && !a.range_inferred).length,
      arcs_with_range: outArcs.filter((a) => a.episode_from !== null).length,
      distinct_ms: distinct.size,
      distinct_ms_not_in_master: [...distinct].filter((id) => !msById.has(id)).length,
      ms_with_kit: withKit,
      ms_with_kit_pct: pct(withKit, distinct.size),
      distinct_suits: suits.length,
      suits_with_kit: suitsWithKit,
      suits_with_kit_pct: pct(suitsWithKit, suits.length),
    };
  }

  // ---------------------------------------------------------------- outputs
  const totals = Object.values(stats).reduce(
    (t, s) => ({
      works: t.works + 1,
      episodes: t.episodes + s.episodes,
      episodes_with_ms: t.episodes_with_ms + s.episodes_with_ms,
      episode_links: t.episode_links + s.episode_links,
      arcs: t.arcs + s.arcs,
      arcs_anchored: t.arcs_anchored + s.arcs_anchored,
    }),
    { works: 0, episodes: 0, episodes_with_ms: 0, episode_links: 0, arcs: 0, arcs_anchored: 0 },
  );
  const prevLinks = previous?.stats?._totals ? previous.stats._totals.episode_links + (previous.stats._totals.arc_links || 0) : 0;
  const arcLinks = Object.values(works).reduce((n, w) => n + w.arcs.reduce((m, a) => m + a.ms.length, 0), 0);
  totals.arc_links = arcLinks;
  if (prevLinks && totals.episode_links + arcLinks < MIN_RATIO * prevLinks && process.env.ATLAS_FORCE !== "1") {
    console.error(`[chapters] links dropped ${prevLinks} -> ${totals.episode_links + arcLinks}; refusing to overwrite (ATLAS_FORCE=1 to accept)`);
    process.exitCode = 1;
    return;
  }
  const snap = (doc) => (doc?.sources || []).map((s) => ({ ...s, snapshot: doc.updated_at }));
  const sources = [
    ...snap(epiDoc),
    ...snap(stageDoc),
    ...snap(offDoc),
    ...snap(wikiMs).map((s) => ({ ...s, used_for: "extra_ms (wiki Mobile Weapon pages not in the MS master)" })),
    { name: "Hobby Atlas Gundam MS master (data/atlas/gundam-ms.json; ids = Gundam Wiki page titles)", url: "https://github.com/mdefitko777/Gunpula/blob/main/data/atlas/gundam-ms.json", licence: "Derived from The Gundam Wiki (CC BY-SA 3.0) and soshage.com; see that file's sources", snapshot: msDoc.updated_at },
  ];
  // Ids used above that the MS master does not contain (wiki pages without a work, kit or
  // GGET link). They carry no kits by construction; the app shows them by name only.
  const usedIds = new Set(Object.values(works).flatMap((w) => [...w.episodes.flatMap((e) => e.ms.map((x) => x.ms)), ...w.arcs.flatMap((a) => a.ms.map((x) => x.ms))]));
  const extraMs = Object.fromEntries(
    [...usedIds]
      .filter((id) => !msById.has(id))
      .sort()
      .map((id) => {
        const p = wikiPage.get(id) || {};
        const names = { en: p.en || id };
        if (p.ja) names.ja = p.ja;
        return [id, { names, ...(p.type ? { type: p.type } : {}) }];
      }),
  );
  totals.extra_ms = Object.keys(extraMs).length;
  const doc = {
    schema: 1,
    updated_at: today(),
    sources,
    wiki_page_url: "https://gundam.fandom.com/wiki/{wiki or title_en}",
    roles: ROLES,
    unit_types_note: "Gundam Wiki unit type for every id used here that is not a mobile suit / armor (Ship, Vehicle, Fighter, Pod, ...); ids not listed are suits.",
    sources_legend: {
      fandom_infobox: "Gundam Wiki episode / film infobox (Semantic MediaWiki Mobile Weapon subobject)",
      fandom_section: "link under the page's Mobile Weapons / Mechanics / Gunpla section",
    },
    unit_types: Object.fromEntries([...usedNonSuits].sort()),
    extra_ms_note: "Ids used in works{} that are not in data/atlas/gundam-ms.json: Gundam Wiki Mobile Weapon page titles (same key space) that the MS master drops because they have no work, kit or G Gen link. Names only; no kits.",
    extra_ms: extraMs,
    works,
    stats: { ...stats, _totals: totals },
  };
  const review = {
    schema: 1,
    updated_at: today(),
    note: "Fix with data/atlas/gundam-chapter-overrides.json: wiki_title {title: ms id|null}, gget_npc {unit id: ms id|null}, stage_anchor {stage id: episode no|null}.",
    unresolved_wiki_titles: [...unresolvedWiki].sort((a, b) => b[1] - a[1]).map(([t, n]) => ({ title: t, links: n })),
    unmatched_gget_npc: [...unmatchedNpc].sort((a, b) => b[1] - a[1]).map(([u, n]) => ({ unit: u, works: n })),
    unanchored_stages: unanchored,
    skipped_stages: skippedStages,
    gget_id_disagreements_note: "G Gen NPC units whose gundam-ms.json gget_ids link was overridden here by an exact name + model match within the work (candidates to fix in the MS master).",
    gget_id_disagreements: ggetDisagreements,
    official_episodes_not_merged: droppedOfficial,
    extra_ms_by_links: [...extraUsed].filter(([id]) => usedIds.has(id)).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, type: wikiPage.get(id)?.type || null, links: n })),
  };
  const [res, rev] = await Promise.all([writeCompactJson(P("gundam-chapters.json"), doc), writeCompactJson(P("gundam-chapters-review.json"), review)]);
  const gz = gzipSync(JSON.stringify(doc)).length;
  console.log(`[chapters] ${res.written ? "wrote" : "unchanged"} gundam-chapters.json ${(res.bytes / 1024).toFixed(0)} KB (gzip ${(gz / 1024).toFixed(0)} KB); review ${(rev.bytes / 1024).toFixed(0)} KB`);
  console.log(`[chapters] totals ${JSON.stringify(totals)}`);
  console.log(`[chapters] unresolved wiki titles ${unresolvedWiki.size} (${[...unresolvedWiki.values()].reduce((a, b) => a + b, 0)} links), unmatched NPC units ${unmatchedNpc.size}, unanchored stages ${unanchored.length}, skipped stages ${skippedStages.length}, extra (non-master) ids ${totals.extra_ms}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
