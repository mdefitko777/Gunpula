// Import the SD Gundam G Generation ETERNAL (GGET) unit roster from the soshage.com fan
// database JSON API, keeping everything the old importer threw away: model numbers,
// Japanese/Korean/Chinese names, work (series) membership, tags and transform forms.
//
//   GET https://soshage.com/ggetapi/{ja,en,ko,zh-CN,zh-TW}/unit       full roster per language
//   GET https://soshage.com/ggetapi/{ja,en,ko,zh-CN,zh-TW}/series/v2  work master per language
//   GET https://soshage.com/ggetapi/ja/unit/<id>                      transform_to / transform_from
//
// The list endpoint has no transform data, so per-unit details are fetched only for units
// that are new since the previous roster (ATLAS_GGET_DETAILS=new, default), for every unit
// (=all) or not at all (=none). Output: data/atlas/gundam-gget-roster.json (compact JSON).
// If soshage cannot be reached the previous roster is left untouched and the step fails
// softly (exit code 0 with a warning) so later steps keep working on the previous data.
// If only a localized list (ko / zh-CN / zh-TW) is missing or comes back untranslated, that
// language's names are carried over from the previous roster instead of being dropped.
//
// Republished fields are limited to what Hobby Atlas needs to identify a unit and link it to
// an MS: id, icon id, names, model numbers, work (series) membership and transform forms.
// Game statistics (rarity, role, body type, tags) are not kept; images are hotlinked through
// thumb_template, never stored.
import path from "node:path";
import { politeJson, requestSummary } from "./lib/http.mjs";
import { ATLAS_DATA, readJson, today, uniq, writeCompactJson } from "./lib/util.mjs";

const BASE = "https://soshage.com/ggetapi";
const THUMB = "https://img.kusoge.xyz/ggenet/thumb";
const OUT = path.join(ATLAS_DATA, "gundam-gget-roster.json");
const LANGS = [
  ["ja", "ja"],
  ["en", "en"],
  ["ko", "ko"],
  ["zh", "zh-CN"],
  ["zh_tw", "zh-TW"],
];
const DETAILS = process.env.ATLAS_GGET_DETAILS || "new";

// "/" belongs to many model numbers (RX-9/A, ZGMF-X56S/γ), so only "," "、" and " / " separate.
const splitModels = (m) =>
  String(m || "")
    .split(/\s*[,、，]\s*|\s+[\/／]\s+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "-" && s !== "－");
const formOf = (u) => ({ id: u.id, icon: u.icon, name: u.name, models: splitModels(u.models) });

async function main() {
  const previous = await readJson(OUT, null);
  const prevById = new Map((previous?.units || []).map((u) => [u.id, u]));

  // 1. Unit lists and series lists per language.
  const unitLists = {};
  const seriesLists = {};
  let stale = false;
  for (const [key, lang] of LANGS) {
    try {
      const u = await politeJson(`${BASE}/${lang}/unit`, { ttlHours: 24 * 5, timeoutMs: 300000 });
      const s = await politeJson(`${BASE}/${lang}/series/v2`, { ttlHours: 24 * 5 });
      stale ||= u.stale || s.stale;
      if (!Array.isArray(u.json) || !u.json.length) throw new Error(`empty unit list for ${lang}`);
      unitLists[key] = u.json;
      seriesLists[key] = s.json;
    } catch (error) {
      if (key === "ja" || key === "en") throw error; // ja + en are required
      console.warn(`[gget] ${lang} unavailable: ${error.message}`);
    }
  }

  const byLang = Object.fromEntries(Object.entries(unitLists).map(([k, list]) => [k, new Map(list.map((u) => [u.id, u]))]));
  const ja = unitLists.ja;

  // Sanity check: the localized lists must really be localized (soshage falls back to EN).
  for (const key of ["ko", "zh", "zh_tw"]) {
    const sample = byLang[key]?.get(ja[0].id)?.name;
    if (sample && sample === byLang.en.get(ja[0].id)?.name) {
      console.warn(`[gget] ${key} list looks untranslated; using the previous roster's ${key} names`);
      delete byLang[key];
      delete seriesLists[key];
    }
  }
  // 2. Languages the previous roster had but this run could not get: carry them over.
  const carried = (previous?.languages || []).filter((k) => !byLang[k]);
  const prevSeriesById = new Map((previous?.series || []).map((x) => [x.id, x]));
  if (carried.length) console.warn(`[gget] carrying ${carried.join("/")} names from the previous roster (${previous.updated_at})`);

  // 3. Series master.
  const seriesById = new Map();
  for (const [key, list] of Object.entries(seriesLists)) {
    for (const s of list || []) {
      const e = seriesById.get(s.id) || { id: s.id, world_id: s.world_id, sort: s.sort, stages: (s.scenario_stages || []).length, names: {} };
      if (s.name) e.names[key] = s.name;
      seriesById.set(s.id, e);
    }
  }
  for (const e of seriesById.values()) for (const k of carried) if (!e.names[k] && prevSeriesById.get(e.id)?.names?.[k]) e.names[k] = prevSeriesById.get(e.id).names[k];

  // 4. Transform details (incremental).
  const details = new Map();
  const wantDetail = (u) => {
    if (DETAILS === "none") return false;
    if (DETAILS === "all") return true;
    return !prevById.get(u.id)?.transforms_checked;
  };
  let fetched = 0;
  let failed = 0;
  for (const u of ja) {
    if (!wantDetail(u)) continue;
    try {
      const d = await politeJson(`${BASE}/ja/unit/${u.id}`, { ttlHours: 24 * 60 });
      details.set(u.id, d.json);
      fetched++;
      if (fetched % 100 === 0) console.log(`[gget] details ${fetched}`);
    } catch (error) {
      failed++;
      console.warn(`[gget] detail ${u.id} failed: ${error.message}`);
      if (failed > 20) {
        console.warn("[gget] too many detail failures; keeping previous transform data for the rest");
        break;
      }
    }
  }

  // 5. Assemble units.
  const units = ja.map((u) => {
    const names = {};
    const shortNames = {};
    for (const [key, map] of Object.entries(byLang)) {
      const lu = map.get(u.id);
      if (lu?.name) names[key] = lu.name;
      if (lu?.short_name && lu.short_name !== lu.name) shortNames[key] = lu.short_name;
    }
    const prev = prevById.get(u.id);
    for (const k of carried) {
      if (prev?.names?.[k]) names[k] = prev.names[k];
      if (prev?.short_names?.[k]) shortNames[k] = prev.short_names[k];
    }
    const d = details.get(u.id);
    let transforms = prev?.transforms;
    let checked = Boolean(prev?.transforms_checked);
    if (d) {
      const to = (d.transform_to || []).filter((x) => x && x.id !== u.id).map(formOf);
      const from = (d.transform_from || []).filter((x) => x && x.id !== u.id).map(formOf);
      transforms = to.length || from.length ? { ...(to.length ? { to } : {}), ...(from.length ? { from } : {}) } : undefined;
      checked = true;
    }
    const series = [...(u.series_set || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((s) => s.series_id);
    const out = { id: u.id, icon: u.icon, names, models: splitModels(u.models), series: uniq(series) };
    if (Object.keys(shortNames).length) out.short_names = shortNames;
    if (transforms) out.transforms = transforms;
    if (checked) out.transforms_checked = true;
    return out;
  });

  const usedSeries = new Set(units.flatMap((u) => u.series));
  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "soshage.com SD Gundam G Generation ETERNAL database",
        url: "https://soshage.com/gget/",
        api: `${BASE}/{ja,en,ko,zh-CN,zh-TW}/unit`,
        licence: "Fan database, no licence stated; game data © SOTSU・SUNRISE / BANDAI NAMCO Entertainment. Only identifying metadata is kept (names, model numbers, work membership, forms); no game statistics. Attribution to soshage.com.",
        images: `Hotlinked from ${THUMB} via thumb_template (not rehosted).`,
        stale,
        ...(carried.length ? { carried_languages: carried, carried_from: previous.updated_at } : {}),
      },
    ],
    thumb_template: `${THUMB}/thum_{icon}.webp`,
    languages: uniq([...Object.keys(byLang), ...carried.filter((k) => units.some((u) => u.names[k]))]),
    series: [...seriesById.values()].filter((s) => usedSeries.has(s.id) || s.stages).sort((a, b) => a.id - b.id),
    units: units.sort((a, b) => a.id - b.id),
  };
  const res = await writeCompactJson(OUT, doc);
  const withTransforms = units.filter((u) => u.transforms).length;
  console.log(
    `[gget] ${units.length} units, ${doc.series.length} series, languages ${doc.languages.join("/")}, ` +
      `${withTransforms} with transforms (${fetched} details fetched, ${failed} failed). ` +
      `${res.written ? "Wrote" : "Unchanged"} ${path.relative(process.cwd(), OUT)} (${(res.bytes / 1024).toFixed(0)} KB)`,
  );
  console.log("[gget] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[gget] FAILED, previous roster kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
