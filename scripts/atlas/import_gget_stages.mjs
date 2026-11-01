// Import the SD Gundam G Generation ETERNAL story stages ("arcs") from soshage.com.
//
//   GET https://soshage.com/ggetapi/{en,ja,ko,zh-TW}/series/v2   series + scenario_stages (titles per language)
//   GET https://soshage.com/gget/ja/stage/<scenario_stage_id>/__data.json
//       SvelteKit devalue payload; battle maps at scenario.content[].stage.map.npcs[]
//       with npc.unit{id,name,models} and battle_side (1 ally/guest, 2 enemy, 3/4 third party)
//
// Each stage is named after the episode it adapts, so the build step can anchor it to an
// episode. Only normal-difficulty stages (stage_difficulty_type_index 1) are read; HARD stages
// reuse the same maps. Stage payloads hardly ever change, so by default only stages missing
// from the previous snapshot are fetched (ATLAS_GGET_STAGES=new); =all refetches every stage,
// =none fetches only the series lists.
//
// Output: data/atlas/gundam-src-gget-stages.json (pipeline snapshot, compact JSON). If soshage
// cannot be reached, the previous snapshot is kept (and per stage, the previous entry is kept
// when its fetch fails).
import path from "node:path";
import { politeJson, requestSummary } from "./lib/http.mjs";
import { decodeSvelteKitData } from "./lib/devalue.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const OUT = path.join(ATLAS_DATA, "gundam-src-gget-stages.json");
const API = "https://soshage.com/ggetapi";
const SITE = "https://soshage.com/gget";
const LANGS = [
  ["en", "en"],
  ["ja", "ja"],
  ["ko", "ko"],
  ["zh_tw", "zh-TW"],
];
const MODE = process.env.ATLAS_GGET_STAGES || "new";
const MAX_FAILURES = 15;

function stageUnits(scenario) {
  const units = new Map();
  let maps = 0;
  for (const c of scenario?.content || []) {
    const map = c?.stage?.map;
    if (!map) continue;
    maps++;
    for (const n of map.npcs || []) {
      const npc = n?.npc || {};
      const u = npc.unit || {};
      const id = npc.unit_id ?? u.id;
      if (!id) continue;
      const side = Number(n.battle_side) || 0;
      const key = `${id}|${side}`;
      const e = units.get(key) || { u: id, n: u.name || "", m: u.models || "", s: side, c: 0 };
      e.c++;
      if (n.is_story_event_boss) e.boss = 1;
      units.set(key, e);
    }
  }
  return { maps, units: [...units.values()] };
}

async function main() {
  const previous = await readJson(OUT, null);
  const prevStages = previous?.stages || {};

  // 1. Series + stage titles in every language.
  const seriesById = new Map();
  let stale = false;
  for (const [key, lang] of LANGS) {
    try {
      const res = await politeJson(`${API}/${lang}/series/v2`, { ttlHours: 24 * 5 });
      stale ||= res.stale;
      for (const s of res.json || []) {
        const stages = s.scenario_stages || [];
        if (!stages.length) continue;
        const e = seriesById.get(s.id) || { id: s.id, sort: s.sort, names: {}, stages: new Map() };
        if (s.name) e.names[key] = s.name;
        for (const st of stages) {
          const x = e.stages.get(st.id) || {
            id: st.id,
            no: st.stage_number,
            diff: st.stage_difficulty_type_index,
            titles: {},
          };
          if (st.is_boss_stage) x.boss = 1;
          if (st.movie_length) x.movie = st.movie_length;
          if (st.title) x.titles[key] = st.title;
          e.stages.set(st.id, x);
        }
        seriesById.set(s.id, e);
      }
    } catch (error) {
      if (key === "ja" || key === "en") throw error;
      console.warn(`[gget-stages] ${lang} series list unavailable: ${error.message}`);
    }
  }

  // A language list that failed this time keeps its titles from the previous snapshot.
  const prevTitles = new Map((previous?.series || []).flatMap((s) => s.stages.map((st) => [st.id, st.titles || {}])));
  const prevNames = new Map((previous?.series || []).map((s) => [s.id, s.names || {}]));
  for (const s of seriesById.values()) {
    s.names = { ...(prevNames.get(s.id) || {}), ...s.names };
    for (const st of s.stages.values()) st.titles = { ...(prevTitles.get(st.id) || {}), ...st.titles };
  }

  // 2. Stage payloads (ja: unit names are matched against Japanese MS names).
  const stages = {};
  let fetched = 0;
  let kept = 0;
  let failed = 0;
  const wanted = [...seriesById.values()].flatMap((s) => [...s.stages.values()].filter((st) => st.diff === 1));
  for (const st of wanted) {
    const prev = prevStages[st.id];
    const need = MODE === "all" || (MODE === "new" && !prev);
    if (!need || failed > MAX_FAILURES) {
      if (prev) {
        stages[st.id] = prev;
        kept++;
      }
      continue;
    }
    try {
      const res = await politeJson(`${SITE}/ja/stage/${st.id}/__data.json`, { ttlHours: 24 * 30 });
      const data = decodeSvelteKitData(res.json);
      const scenario = data?.scenario;
      if (!scenario) throw new Error("no scenario in payload");
      stages[st.id] = stageUnits(scenario);
      fetched++;
      if (fetched % 50 === 0) console.log(`[gget-stages] ${fetched} stages fetched`);
    } catch (error) {
      failed++;
      console.warn(`[gget-stages] stage ${st.id} failed: ${error.message}${prev ? " (keeping previous)" : ""}`);
      if (prev) stages[st.id] = prev;
      if (failed > MAX_FAILURES) console.warn("[gget-stages] too many failures; keeping previous data for the remaining stages");
    }
  }

  const series = [...seriesById.values()]
    .sort((a, b) => a.id - b.id)
    .map((s) => ({ id: s.id, sort: s.sort, names: s.names, stages: [...s.stages.values()].sort((a, b) => a.id - b.id) }));
  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "soshage.com SD Gundam G Generation ETERNAL database (story stages)",
        url: "https://soshage.com/gget/series",
        api: `${API}/{en,ja,ko,zh-TW}/series/v2 + ${SITE}/ja/stage/<id>/__data.json`,
        licence: "Fan database, no licence stated; game data © SOTSU・SUNRISE / BANDAI NAMCO Entertainment. Metadata only, personal use, attribution to soshage.com.",
        stale,
      },
    ],
    side_codes: { 1: "ally/guest", 2: "enemy", 3: "third party", 4: "third party" },
    series,
    stages,
  };
  if (previous && Object.keys(stages).length < 0.8 * Object.keys(prevStages).length) {
    console.warn(`[gget-stages] only ${Object.keys(stages).length} stages (previous ${Object.keys(prevStages).length}); keeping previous snapshot`);
    return;
  }
  const res = await writeCompactJson(OUT, doc);
  const withUnits = Object.values(stages).filter((s) => s.units.length).length;
  console.log(
    `[gget-stages] ${series.length} series, ${wanted.length} normal stages, ${Object.keys(stages).length} with payload ` +
      `(${withUnits} with units; ${fetched} fetched, ${kept} kept, ${failed} failed). ` +
      `${res.written ? "Wrote" : "Unchanged"} ${path.basename(OUT)} (${(res.bytes / 1024).toFixed(0)} KB)`,
  );
  console.log("[gget-stages] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[gget-stages] FAILED, previous snapshot kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
