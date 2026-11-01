// Build the Hobby Atlas Gundam MS master and the kit <-> MS / kit <-> work tables.
//
// Inputs (all in the repo, no network):
//   data/kits.json                         Gunpula catalogue (names.ja is what we match on)
//   data/atlas/gundam-gget-roster.json     import_gget_roster.mjs
//   data/atlas/gundam-src-gundamwiki.json  import_gundamwiki_ms.mjs (canonical MS ids)
//   data/atlas/gundam-src-gunplapedia.json import_gunplapedia.mjs  (JAN -> "Model of")
//   data/atlas/gundam-src-manual.json      import_manual_works.mjs (official kit -> work)
//   data/atlas/gundam-overrides.json       human-maintained {kit_id: [ms ids]}
//
// Outputs (compact JSON):
//   data/atlas/gundam-ms.json            timelines, works, MS master
//   data/atlas/gundam-kit-ms.json        links {kit_id: [{ms, role, method, confidence}]}, kit_works, stats
//   data/atlas/gundam-review-queue.json  unmatched plastic kits with best candidates
//
// Matching cascade on NFKC names.ja: override -> JAN (Gunplapedia) -> Gunplapedia JA name ->
// exact cleaned name -> model number -> <pilot>専用<MS> split -> set split -> guarded contains.
// Ties are broken by the kit's work (WEB取説 / legacy series) and Origin/Thunderbolt/GQ pages
// are avoided unless the kit belongs to that work.
import path from "node:path";
import { buildWorks, eraTimeline, TIMELINES, wikiSeriesMatcher } from "./gundam_works.mjs";
import { classifyKit, cleanKitName, isSetName, janOf, kitJoinKey, splitPilotCustom, splitSet } from "./lib/kitnames.mjs";
import { ATLAS_DATA, countBy, hasJapanese, modelKey, nameKey, nfkc, pct, readJson, repoPath, today, uniq, writeCompactJson } from "./lib/util.mjs";

const P = (f) => path.join(ATLAS_DATA, f);
const MIN_LINK_RATIO = Number(process.env.ATLAS_MIN_LINK_RATIO || 0.8); // refuse to overwrite on a big drop

// Names too generic to be used for contains / truncated matching.
const GENERIC = new Set(
  ["ガンダム", "gundam", "ザク", "ザク2", "ジム", "グフ", "ドム", "ガンキャノン", "ガンタンク", "ゲルググ", "ギャン", "ズゴック", "ボール", "ジン", "ダガー", "ストライク", "フリーダム", "ジャスティス", "ウイング", "エクシア", "ユニコーン", "ガンダム改", "量産型", "試作", "専用", "カスタム", "コア", "ファイター", "コアファイター", "sd", "ms", "g", "x", "v", "z", "zz", "00"].map(nameKey),
);
const MODEL_RE = /(?<![A-Z0-9])([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9]+(?:[-\/.][A-Z0-9]+)*(?:\[[A-Z0-9]+\])?)/g;
const NOT_MODEL = /^(RE-?100|EX-?\d+|SD-?EX|HG-?\w*|MG-?\w*|RG-?\w*|PG-?\w*|EG-?\w*|VER-.*|NO-\d+|PB-\d+|SDW-.*|PART-\d+|TYPE-\w+|VOL-\d+|MK-?I+|MK-?V|MK-?IV|SIDE-F|S-\d+|A-\d+|B-\d+|G-\d+|C-\d+|F-\d+|EX-S|T-\d+|DX-?\d*|SP-?\d*|LED-?\w*|SET-\d+|U\.C\.\d+|UC-\d+|CE-\d+|AD-\d+|PG-UNLEASHED)$/;
// A model-number token: has a dash and a digit (RX-78-2, ZGMF-X56S/γ, GAT-X105+AQM/E-X01)
// or is letters followed by digits (F90, LM314V21).
const isModelToken = (t) => t.length <= 40 && !/\s/.test(t) && ((/-/.test(t) && /\d/.test(t)) || /^[A-Z]+\d+[A-Za-z0-9]*$/.test(t));

/** "RX-78-2 Gundam" -> {model, name}. */
function splitModelLabel(label) {
  const s = nfkc(label).trim();
  const i = s.indexOf(" ");
  if (i > 0 && isModelToken(s.slice(0, i))) return { model: s.slice(0, i), name: s.slice(i + 1).trim() };
  return { model: null, name: s };
}

/** Gundam Wiki kanji field: "AMX-004-2~Unit 1, AMX-004-3~Unit 2 キュベレイMk-II" -> {models[], name}. */
function parseKanji(kanji) {
  const s = nfkc(kanji).trim();
  const j = s.search(/[぀-ヿ一-鿿]/);
  let start = j < 0 ? s.length : s.lastIndexOf(" ", j) + 1;
  let modelPart = s.slice(0, start);
  // "MS-06R-1A高機動型ザクII": model glued to the name
  if (j > 0 && start === 0 && isModelToken(s.slice(0, j))) {
    modelPart = s.slice(0, j);
    start = j;
  }
  const name = j < 0 ? null : s.slice(start).trim();
  const models = modelPart
    .split(",")
    .map((t) => t.replace(/~.*$/, "").trim())
    .filter(isModelToken);
  return { models, name };
}

// Which "alternative version" a wiki page is, if any.
function variantWorkOf(rec) {
  const t = `${rec.id} ${rec.era || ""}`;
  if (/\/Origin|\(Origin\)|The Origin/i.test(t)) return "origin";
  if (/Thunderbolt/i.test(t)) return "thunderbolt";
  if (/\(GQ\)|GQuuuuuuX|Universal Century \(GQ\)/.test(t)) return "gquuuuuux";
  if (/\(Manga\)|\(Novel\)|\(Game\)|\(Evolve\)|\(Wing Zero\)|The Other Side/i.test(t)) return "media";
  // Pages like "MS-06S Char's Zaku II" that only appear in an alternative-version work
  // while sharing the model number of a UC original.
  const w = rec.works || [];
  if (w.length && w.every((x) => x === "origin" || x === "cucuruz-doans-island") && /Origin/i.test(rec.arch || "")) return "origin";
  if (w.length && w.every((x) => x === "thunderbolt") && /Thunderbolt/i.test(rec.arch || "")) return "thunderbolt";
  return null;
}
function kitVariantSignal(name) {
  const n = nfkc(name);
  if (/ORIGIN|オリジン/i.test(n)) return "origin";
  if (/サンダーボルト|THUNDERBOLT/i.test(n)) return "thunderbolt";
  if (/\(GQ\)|（GQ）|GQuuuuuuX|ジークアクス/i.test(n)) return "gquuuuuux";
  return null;
}

async function main() {
  const [catalog, roster, wiki, gp, manual, overridesRaw, previousLinks] = await Promise.all([
    readJson(repoPath("data", "kits.json")),
    readJson(P("gundam-gget-roster.json")),
    readJson(P("gundam-src-gundamwiki.json")),
    readJson(P("gundam-src-gunplapedia.json")),
    readJson(P("gundam-src-manual.json"), null),
    readJson(P("gundam-overrides.json"), {}),
    readJson(P("gundam-kit-ms.json"), null),
  ]);
  const overrides = Object.fromEntries(Object.entries(overridesRaw).filter(([k]) => !k.startsWith("_")));
  const kits = catalog.kits.filter((k) => k.franchise === "gundam");

  // ---------------------------------------------------------------- works
  const unitsPerSeries = countBy(roster.units.flatMap((u) => u.series), (s) => s);
  const works = buildWorks(roster.series.map((s) => ({ ...s, units: unitsPerSeries[s.id] || 0 })));
  const workById = new Map(works.map((w) => [w.id, w]));
  const workOfGget = new Map();
  for (const w of works) for (const g of w.gget) if (!workOfGget.has(g)) workOfGget.set(g, w.id);
  const workOfManual = new Map();
  for (const w of works) for (const t of w.manual) workOfManual.set(t, w.id);
  const workOfLegacy = new Map();
  for (const w of works) for (const l of w.legacy) if (!workOfLegacy.has(l)) workOfLegacy.set(l, w.id);
  const matchWikiSeries = wikiSeriesMatcher(works);
  const workOrder = (id) => workById.get(id)?.order ?? 9999;
  const workPrefixes = uniq(works.flatMap((w) => [w.names.ja].filter(Boolean).map((n) => nfkc(n)))).sort((a, b) => b.length - a.length);

  // ---------------------------------------------------------------- MS master
  const ms = new Map(); // id -> rec
  for (const w of wiki.ms) {
    const rec = { id: w.t, models: new Set(), names: { ja: [], en: [] }, era: w.era, arch: w.arch, gget: [], works: [], src: "gundamwiki" };
    for (const label of [w.t, w.en].filter(Boolean)) {
      const { model, name } = splitModelLabel(label);
      if (model) rec.models.add(modelKey(model));
      rec.names.en.push(name);
    }
    if (w.ja) {
      const { models, name } = parseKanji(w.ja);
      for (const m of models) rec.models.add(modelKey(m));
      if (name && hasJapanese(name)) rec.names.ja.push(name);
    }
    const seriesWorks = uniq((w.series || []).map(matchWikiSeries));
    rec.works = seriesWorks;
    rec.debut = seriesWorks[0] || null;
    rec.timeline = eraTimeline(w.era) || (rec.debut ? workById.get(rec.debut)?.timeline : null) || null;
    rec.variantWork = variantWorkOf(rec);
    ms.set(rec.id, rec);
  }
  const wikiByModel = new Map();
  const loose = (m) => m.replace(/-/g, ""); // RX-78GP01Fb vs RX-78GP01-Fb
  for (const rec of ms.values()) for (const m of rec.models) for (const k of uniq([m, loose(m)])) (wikiByModel.get(k) || wikiByModel.set(k, []).get(k)).push(rec);
  const wikiByJa = new Map();
  for (const rec of ms.values()) for (const n of rec.names.ja) {
    const k = nameKey(n);
    if (k) (wikiByJa.get(k) || wikiByJa.set(k, []).get(k)).push(rec);
  }

  // GGET units -> wiki MS (model number, then name), else a GGET-only MS record.
  const baseName = (n) => nfkc(n).replace(/\s*[(（](EX|EXA|SP|ULT|ULTIMATE)[)）]\s*$/i, "").trim();
  const unitToMs = new Map();
  const ggetOnly = new Map();
  let linkedByModel = 0;
  let linkedByName = 0;
  for (const u of roster.units) {
    const ja = baseName(u.names.ja || "");
    const jaKey = nameKey(ja);
    const uWorks = uniq(u.series.map((s) => workOfGget.get(s)));
    const score = (rec) =>
      (rec.names.ja.some((n) => nameKey(n) === jaKey) ? 4 : 0) +
      (rec.works.some((w) => uWorks.includes(w)) ? 2 : 0) -
      (rec.variantWork && !uWorks.includes(rec.variantWork) ? 6 : 0) -
      (rec.id.includes("(") ? 0.5 : 0);
    let target = null;
    let cands = uniq(u.models.map(modelKey)).flatMap((m) => wikiByModel.get(m) || []);
    if (!cands.length) cands = uniq(u.models.map((m) => loose(modelKey(m)))).flatMap((m) => wikiByModel.get(m) || []);
    if (cands.length) {
      target = [...new Set(cands)].sort((a, b) => score(b) - score(a) || a.id.length - b.id.length)[0];
      linkedByModel++;
    } else if (wikiByJa.get(jaKey)?.length) {
      target = wikiByJa.get(jaKey).sort((a, b) => score(b) - score(a))[0];
      linkedByName++;
    }
    if (!target) {
      const key = `${u.models.map(modelKey).join("/")}|${jaKey}`;
      target = ggetOnly.get(key);
      if (!target) {
        target = { id: `gget:${u.id}`, models: new Set(u.models.map(modelKey)), names: { ja: [], en: [] }, era: null, gget: [], works: [], src: "gget" };
        ggetOnly.set(key, target);
        ms.set(target.id, target);
      }
    }
    target.gget.push(u);
    unitToMs.set(u.id, target.id);
  }
  // Fold GGET data into MS records: names, icon, works, debut.
  for (const rec of ms.values()) {
    if (!rec.gget.length) continue;
    const primary = [...rec.gget].sort((a, b) => /\(EX\)|（EX）/.test(a.names.ja) - /\(EX\)|（EX）/.test(b.names.ja) || a.id - b.id)[0];
    rec.icon = primary.icon;
    rec.gget_names = primary.names;
    for (const u of rec.gget) {
      for (const m of u.models) rec.models.add(modelKey(m));
      rec.names.ja.push(baseName(u.names.ja || ""));
      if (u.short_names?.ja) rec.names.ja.push(baseName(u.short_names.ja));
      if (u.names.en) rec.names.en.push(baseName(u.names.en));
    }
    const ggetWorks = uniq(rec.gget.flatMap((u) => u.series.map((s) => workOfGget.get(s))));
    rec.works = uniq([...rec.works, ...ggetWorks]);
    // GGET lists a unit under its own work first; trust that over the wiki series order
    // (which often starts with a manga or the ORIGIN retelling).
    const primaryWork = workOfGget.get(primary.series[0]);
    if (primaryWork && !rec.variantWork) rec.debut = primaryWork;
    else if (!rec.debut) rec.debut = [...ggetWorks].sort((a, b) => workOrder(a) - workOrder(b))[0] || null;
    if (!rec.timeline && rec.debut) rec.timeline = workById.get(rec.debut)?.timeline || null;
  }

  // Indices for kit matching.
  const byModel = new Map();
  const byName = new Map();
  const add = (map, k, id) => {
    if (!k) return;
    (map.get(k) || map.set(k, new Set()).get(k)).add(id);
  };
  for (const rec of ms.values()) {
    for (const m of rec.models) {
      add(byModel, m, rec.id);
      add(byModel, loose(m), rec.id);
      // Kits say "ガンダムGP02A" / "GP-01" for RX-78GP02A / RX-78GP01
      const gp = m.match(/^RX-78(GP)-?(\d+[A-Z0-9]*)$/);
      if (gp) {
        add(byModel, `GP${gp[2]}`, rec.id);
        add(byModel, `GP-${gp[2]}`, rec.id);
      }
    }
    for (const n of uniq([...rec.names.ja, ...rec.names.en])) {
      const k = nameKey(n);
      if (k.length >= 2) add(byName, k, rec.id);
      // Kit boxes often drop the "II" of Zaku II (量産型ザク, シャア専用ザク, 高機動型ザク).
      if (/ザク2$/.test(k) && k.length >= 6) add(byName, k.slice(0, -1), rec.id);
      // "ΖプラスC1型" is sold as "ゼータプラスC1"
      if (/[a-z0-9]型$/.test(k) && k.length >= 5) add(byName, k.slice(0, -1), rec.id);
    }
  }
  const modelLookup = (m) => [...(byModel.get(m) || byModel.get(loose(m)) || [])];
  const containsKeys = [...byName.keys()]
    .filter((k) => !GENERIC.has(k) && (hasJapanese(k) ? k.length >= 4 : k.length >= 6))
    .sort((a, b) => b.length - a.length);
  const suffixKeys = [...byName.keys()].filter((k) => hasJapanese(k) && k.length >= 6);

  // ---------------------------------------------------------------- Gunplapedia + WEB取説 indices
  const titleToMs = (t) => (ms.has(t) ? t : wiki.redirects?.[t] && ms.has(wiki.redirects[t]) ? wiki.redirects[t] : null);
  const janIndex = new Map();
  const gpNameIndex = new Map();
  for (const k of gp.kits) {
    const ids = uniq((k.model_of || []).map(titleToMs));
    if (!ids.length) continue;
    for (const j of k.jan || []) if (!janIndex.has(j)) janIndex.set(j, { ids, title: k.title });
    if (k.ja) {
      const key = kitJoinKey(k.ja);
      if (key.length >= 6) (gpNameIndex.get(key) || gpNameIndex.set(key, []).get(key)).push({ ids, title: k.title });
    }
  }
  const manualIndex = new Map();
  for (const m of manual?.kits || []) {
    const key = kitJoinKey(m.ja);
    if (!key) continue;
    const prev = manualIndex.get(key) || [];
    manualIndex.set(key, uniq([...prev, ...m.titles]));
  }

  // ---------------------------------------------------------------- matcher
  // Longest MS name contained in the cleaned kit name (helps choose within one model number).
  function nameBonus(rec, ck) {
    if (!ck) return 0;
    let best = 0;
    for (const nm of uniq([...rec.names.ja, ...rec.names.en])) {
      const k = nameKey(nm);
      if (k.length >= 2 && ck.includes(k)) best = Math.max(best, k.length);
    }
    return best ? 2 + best / 10 : 0;
  }

  // "X (Thunderbolt Ver.)" / "X/Origin" / "X (GQ)" -> "X" when that page exists.
  const baseOf = (id) => {
    const b = id.replace(/\s*\((?:Thunderbolt Ver\.|Thunderbolt|GQ|Origin(?: ver\.)?)\)$|\/Origin$/i, "").trim();
    return b !== id && ms.has(b) ? b : null;
  };

  function pick(ids, ctx, { max = 1 } = {}) {
    // A variant page found alone competes with its base page (kits are rarely the alt version).
    const expanded = uniq([...ids].flatMap((id) => [id, baseOf(id)]));
    const recs = expanded.map((id) => ms.get(id)).filter(Boolean);
    if (recs.length <= 1) return { ids: recs.map((r) => r.id), ambiguous: false };
    const score = (r) =>
      (ctx.works.length && r.works.some((w) => ctx.works.includes(w)) ? 3 : 0) +
      (ctx.models.some((m) => r.models.has(m)) ? 2 : 0) +
      (r.variantWork && r.variantWork !== "media" && !ctx.works.includes(r.variantWork) && ctx.variant !== r.variantWork ? -4 : 0) +
      (r.variantWork === "media" ? -2 : 0) +
      // the kit title naming the version ("サンダーボルト版", "(GQ)") beats catalogue work tags
      (ctx.variant && r.variantWork === ctx.variant ? 6 : 0) +
      (ctx.variant && r.variantWork && r.variantWork !== ctx.variant ? -3 : 0) +
      (r.gget.length ? 1 : 0) +
      (r.src === "gundamwiki" ? 0.5 : 0) +
      nameBonus(r, ctx.ck);
    const ranked = recs.map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s || a.r.id.length - b.r.id.length || a.r.id.localeCompare(b.r.id));
    const ambiguous = ranked.length > 1 && ranked[0].s === ranked[1].s;
    return { ids: ranked.slice(0, max).map((x) => x.r.id), ambiguous };
  }

  function exactName(variants, ctx, { allowTrunc = true } = {}) {
    const fullKey = variants.filter((v) => v.kind === "full").pop()?.key || variants[0]?.key || "";
    for (const v of variants) {
      if (v.kind === "trunc") {
        if (!allowTrunc) break;
        // truncated spellings must stay specific and cover most of the name
        if (GENERIC.has(v.key) || v.key.length < 4 || v.key.length / Math.max(fullKey.length, 1) < 0.6) continue;
      }
      const hit = byName.get(v.key);
      if (hit) return { ...pick(hit, ctx), key: v.key, truncated: v.kind === "trunc" };
    }
    return null;
  }

  function matchKit(kit, cls) {
    const name = kit.names?.ja || "";
    const n = nfkc(name);
    const joinKey = kitJoinKey(name);
    const manualTitles = manualIndex.get(joinKey) || [];
    const hintWorks = uniq([...manualTitles.map((t) => workOfManual.get(t)), workOfLegacy.get(kit.series?.key)]);
    const upper = n.toUpperCase();
    const models = uniq([
      ...[...upper.matchAll(MODEL_RE)].map((m) => modelKey(m[1])).filter((m) => !NOT_MODEL.test(m)),
      // dash-less model numbers (LM312V04, F91) count only when the MS master knows them
      ...[...upper.matchAll(/(?<![A-Z0-9-])([A-Z]{1,4}\d{2,}[A-Z0-9]*)(?![A-Z0-9-])/g)].map((m) => m[1]).filter((m) => byModel.has(m) && !/^(HG|MG|RG|PG|EG|SD|BB|EX|R)\d+$/.test(m)),
    ]);
    const { cleaned, core, variants, accessory } = cleanKitName(name, workPrefixes);
    const ctx = { works: hintWorks, models, variant: kitVariantSignal(name), ck: nameKey(cleaned) };
    const sdOriginal = kit.grade_code === "SDW" || /SDW\s*HEROES|三国|創傑伝/i.test(n);
    const base = { manualTitles, hintWorks, cleaned, core, accessory };

    // 0. human overrides
    if (overrides[kit.kit_id]) {
      const ids = overrides[kit.kit_id].filter((id) => ms.has(id));
      if (ids.length) return { ...base, method: "override", confidence: 1, ids };
    }
    // 1. JAN -> Gunplapedia "Model of"
    const jan = janOf(kit);
    if (jan && janIndex.has(jan)) {
      const janIds = janIndex.get(jan).ids;
      // Cross-check with a model number printed on the box; if Gunplapedia disagrees, the box wins.
      const boxHits = models.flatMap(modelLookup);
      if (boxHits.length && !janIds.some((id) => models.some((m) => ms.get(id)?.models.has(m)))) {
        return { ...base, method: "jan", confidence: 0.9, ids: uniq([...pick(boxHits, ctx).ids, ...janIds]), gp: janIndex.get(jan).title };
      }
      return { ...base, method: "jan", confidence: 0.98, ids: janIds, gp: janIndex.get(jan).title };
    }
    // 1b. whole-name join with Gunplapedia's Japanese kit name
    const gpHits = gpNameIndex.get(joinKey);
    if (gpHits?.length === 1) return { ...base, method: "gunplapedia_name", confidence: 0.95, ids: gpHits[0].ids, gp: gpHits[0].title };
    if (!variants.length) return { ...base, method: "none", ids: [] };
    // 2. exact cleaned name (untruncated first)
    const exact = exactName(variants, ctx, { allowTrunc: false });
    const modelHits = models.flatMap(modelLookup);
    // A model number printed on the box wins over a bare name that belongs to another model
    // ("MS-06S ザクII" is Char's Zaku, not the MS-06F named "ザクII").
    const exactAgreesWithModel = !exact || !modelHits.length || exact.ids.some((id) => models.some((m) => ms.get(id)?.models.has(m)));
    if (exact && (exactAgreesWithModel || sdOriginal)) return { ...base, method: "name_exact", confidence: exact.ambiguous ? 0.75 : 0.88, ids: exact.ids };
    // 3. model number in the name
    if (modelHits.length && !sdOriginal) {
      // prefer a name hit inside the model's family, else the best-scoring page for the model
      const p = pick(modelHits, ctx);
      return { ...base, method: "model", confidence: p.ambiguous ? 0.78 : 0.9, ids: p.ids };
    }
    // 4. truncated exact name
    const trunc = exactName(variants, ctx);
    if (trunc) return { ...base, method: "name_exact", confidence: 0.8, ids: trunc.ids };
    // 5. <pilot>専用<MS>
    const pc = splitPilotCustom(cleaned);
    if (pc) {
      const v = cleanKitName(pc.ms, []).variants;
      const hit = exactName(v, ctx);
      if (hit) return { ...base, method: "pilot_custom", confidence: 0.72, ids: hit.ids, variant: `${pc.pilot}専用` };
    }
    // 6. sets: "A&B", "A+B"
    const parts = splitSet(cleaned);
    if (parts) {
      const ids = [];
      for (const part of parts) {
        const v = cleanKitName(part, []).variants;
        const hit = exactName(v, ctx) || (() => {
          const pm = uniq([...nfkc(part).toUpperCase().matchAll(MODEL_RE)].map((m) => modelKey(m[1])));
          const h = pm.flatMap((m) => [...(byModel.get(m) || [])]);
          return h.length ? pick(h, ctx) : null;
        })();
        if (hit) ids.push(...hit.ids);
      }
      if (ids.length) return { ...base, method: "set_split", confidence: 0.75, ids: uniq(ids), set: true };
    }
    // 7. guarded contains: longest specific key inside the cleaned name
    const ck = nameKey(core || cleaned);
    const hitKey = sdOriginal ? null : containsKeys.find((k) => ck.includes(k) && (k.length / ck.length >= 0.45 || ck.startsWith(k)));
    if (hitKey) {
      const p = pick(byName.get(hitKey), ctx);
      return { ...base, method: "name_contains", confidence: Math.round((0.55 + 0.3 * Math.min(1, hitKey.length / ck.length)) * 100) / 100, ids: p.ids, key: hitKey };
    }
    // 8. short box name = tail of a full MS name ("バンシィ・ノルン" -> "ユニコーンガンダム2号機 バンシィ・ノルン")
    if (!sdOriginal && ck.length >= 5 && hasJapanese(ck) && !GENERIC.has(ck)) {
      const tails = suffixKeys.filter((k) => k.length > ck.length && k.endsWith(ck) && ck.length / k.length >= 0.4);
      const ids = uniq(tails.flatMap((k) => [...byName.get(k)]));
      if (ids.length && ids.length <= 3) {
        const p = pick(ids, ctx);
        return { ...base, method: "name_suffix", confidence: 0.65, ids: p.ids, key: ck };
      }
    }
    return { ...base, method: "none", ids: [] };
  }

  function roleFor(kit, cls, result, msId) {
    if (cls === "figure") return "figure";
    if (result.accessory) return "accessory_for";
    if (result.ids.length > 1) {
      if (result.set || isSetName(kit.names?.ja || "")) return "set_member";
      // JAN "Model of" lists base suits too: the MS whose name best matches the kit title is main.
      const ck = nameKey(result.core || result.cleaned || "");
      const fit = (id) => {
        const rec = ms.get(id);
        let best = 0;
        for (const nm of rec ? uniq([...rec.names.ja, ...rec.names.en]) : []) {
          const k = nameKey(nm);
          if (k.length < 2) continue;
          if (k === ck) best = Math.max(best, 1000);
          else if (ck.includes(k) || k.endsWith(ck)) best = Math.max(best, Math.min(k.length, ck.length));
        }
        return best;
      };
      const scores = result.ids.map(fit);
      const top = Math.max(...scores);
      if (top === 0) return result.ids[0] === msId ? "main" : "set_member";
      return fit(msId) === top ? "main" : "set_member";
    }
    return "main";
  }

  // ---------------------------------------------------------------- run
  const links = {};
  const kitWorks = {};
  const kitWorkSource = {};
  const rows = [];
  for (const kit of kits) {
    const cls = classifyKit(kit);
    const r = cls === "merch" ? { method: "skipped", ids: [], hintWorks: [], manualTitles: [] } : matchKit(kit, cls);
    if (cls === "merch" && overrides[kit.kit_id]) Object.assign(r, { method: "override", confidence: 1, ids: overrides[kit.kit_id].filter((id) => ms.has(id)), cleaned: "" });
    rows.push({ kit, cls, r });
    if (r.ids.length) {
      links[kit.kit_id] = r.ids.slice(0, 8).map((id) => {
        const link = { ms: id, role: roleFor(kit, cls, r, id), method: r.method, confidence: r.confidence };
        if (r.variant) link.variant = r.variant;
        return link;
      });
    }
    // kit -> work: WEB取説 > matched MS debut > legacy series bucket
    const official = uniq(r.manualTitles.map((t) => workOfManual.get(t)));
    if (official.length) {
      kitWorks[kit.kit_id] = official;
      kitWorkSource[kit.kit_id] = "manual";
    } else {
      const debut = uniq(r.ids.map((id) => ms.get(id)?.debut));
      if (debut.length) {
        kitWorks[kit.kit_id] = debut.slice(0, 3);
        kitWorkSource[kit.kit_id] = "ms_debut";
      } else if (workOfLegacy.get(kit.series?.key)) {
        kitWorks[kit.kit_id] = [workOfLegacy.get(kit.series.key)];
        kitWorkSource[kit.kit_id] = "legacy_series";
      }
    }
  }

  // ---------------------------------------------------------------- stats
  const plastic = rows.filter((x) => x.cls === "plastic");
  const figures = rows.filter((x) => x.cls === "figure");
  const modelRows = rows.filter((x) => x.cls !== "merch");
  const matched = (arr) => arr.filter((x) => x.r.ids.length).length;
  const msKits = new Map();
  for (const [kitId, ls] of Object.entries(links)) {
    const cls = rows.find((x) => x.kit.kit_id === kitId)?.cls;
    for (const l of ls) {
      const e = msKits.get(l.ms) || { plastic: 0, any: 0 };
      e.any++;
      if (cls === "plastic" && l.role !== "accessory_for") e.plastic++;
      msKits.set(l.ms, e);
    }
  }
  const unitHasKit = (u, field = "plastic") => (msKits.get(unitToMs.get(u.id))?.[field] || 0) > 0;
  const seriesCoverage = (sid) => {
    const us = roster.units.filter((u) => u.series.includes(sid));
    return { units: us.length, with_plastic_kit: us.filter((u) => unitHasKit(u)).length, with_any_kit: us.filter((u) => unitHasKit(u, "any")).length };
  };
  const byGrade = {};
  for (const x of rows) {
    const g = (byGrade[x.kit.grade_code] ||= { total: 0, matched: 0 });
    g.total++;
    if (x.r.ids.length) g.matched++;
  }
  const stats = {
    kits_total: rows.length,
    kits_model: modelRows.length,
    kits_merch_skipped: rows.length - modelRows.length,
    plastic: { total: plastic.length, matched: matched(plastic), pct: pct(matched(plastic), plastic.length) },
    figures: { total: figures.length, matched: matched(figures), pct: pct(matched(figures), figures.length) },
    all_records: { total: rows.length, matched: matched(rows), pct: pct(matched(rows), rows.length) },
    all_model_records: { total: modelRows.length, matched: matched(modelRows), pct: pct(matched(modelRows), modelRows.length) },
    methods_plastic: countBy(plastic, (x) => x.r.method),
    methods_all: countBy(modelRows, (x) => x.r.method),
    roles: countBy(Object.values(links).flat(), (l) => l.role),
    kit_work_sources: countBy(Object.values(kitWorkSource), (s) => s),
    by_grade: byGrade,
    gget_units: {
      total: roster.units.length,
      linked_to_wiki: roster.units.filter((u) => !unitToMs.get(u.id).startsWith("gget:")).length,
      linked_by_model: linkedByModel,
      linked_by_name: linkedByName,
      with_plastic_kit: roster.units.filter((u) => unitHasKit(u)).length,
      with_any_kit: roster.units.filter((u) => unitHasKit(u, "any")).length,
    },
    gget_series: {
      "10 Mobile Suit Gundam": seriesCoverage(10),
      "3000 SEED": seriesCoverage(3000),
      "3700 00": seriesCoverage(3700),
      "5010 Witch from Mercury": seriesCoverage(5010),
    },
    ms_total: ms.size,
    ms_with_kit: [...msKits.keys()].length,
  };

  // ---------------------------------------------------------------- review queue
  const candidateKeys = [...byName.keys()].filter((k) => k.length >= 3 && !GENERIC.has(k));
  function candidates(r) {
    const ck = nameKey(r.cleaned || "");
    if (!ck) return [];
    const scored = [];
    for (const k of candidateKeys) {
      let s = 0;
      if (ck.includes(k)) s = k.length / ck.length;
      else if (k.includes(ck) && ck.length >= 3) s = (ck.length / k.length) * 0.9;
      if (s >= 0.25) for (const id of byName.get(k)) scored.push({ id, s, k });
    }
    const best = new Map();
    for (const c of scored.sort((a, b) => b.s - a.s)) if (!best.has(c.id)) best.set(c.id, c);
    return [...best.values()].slice(0, 3).map((c) => ({ ms: c.id, score: Math.round(c.s * 100) / 100, name: ms.get(c.id).names.ja[0] || ms.get(c.id).names.en[0] }));
  }
  const queue = plastic
    .filter((x) => !x.r.ids.length)
    .map((x) => ({ kit_id: x.kit.kit_id, name: x.kit.names.ja, grade: x.kit.grade_code, cleaned: x.r.cleaned, work: (kitWorks[x.kit.kit_id] || [])[0] || null, candidates: candidates(x.r) }));

  // ---------------------------------------------------------------- outputs
  const linkCount = Object.keys(links).length;
  const prevCount = previousLinks ? Object.keys(previousLinks.links || {}).length : 0;
  if (prevCount && linkCount < MIN_LINK_RATIO * prevCount && process.env.ATLAS_FORCE !== "1") {
    console.error(`[build] linked kits dropped ${prevCount} -> ${linkCount}; refusing to overwrite (set ATLAS_FORCE=1 to accept)`);
    process.exitCode = 1;
    return;
  }

  const srcInfo = (doc) => (doc?.sources || []).map((s) => ({ ...s, snapshot: doc.updated_at }));
  const sources = [
    ...srcInfo(wiki),
    ...srcInfo(gp),
    ...srcInfo(roster),
    ...srcInfo(manual),
    { name: "Gunpula catalogue (data/kits.json)", url: "https://github.com/mdefitko777/Gunpula", licence: "Project data; product names © BANDAI SPIRITS", snapshot: catalog.updated_at },
  ];
  const keep = (rec) => rec.gget.length || msKits.has(rec.id) || rec.works.length;
  const msOut = [...ms.values()]
    .filter(keep)
    .sort((a, b) => (a.src === b.src ? a.id.localeCompare(b.id) : a.src === "gundamwiki" ? -1 : 1))
    .map((rec) => {
      const o = { id: rec.id, model_numbers: [...rec.models] };
      const names = {};
      const ja = rec.src === "gundamwiki" ? rec.names.ja[0] : rec.gget_names?.ja;
      if (ja || rec.names.ja[0]) names.ja = ja || rec.names.ja[0];
      const en = rec.src === "gundamwiki" ? rec.names.en[0] : rec.gget_names?.en;
      if (en) names.en = en;
      if (rec.gget_names?.ko) names.ko = rec.gget_names.ko;
      if (rec.gget_names?.zh) names.zh = rec.gget_names.zh;
      o.names = names;
      if (rec.gget.length) o.gget_ids = rec.gget.map((u) => u.id);
      if (rec.icon) o.icon = rec.icon;
      if (rec.works.length) o.works = rec.works;
      if (rec.debut) o.debut_work = rec.debut;
      if (rec.timeline) o.timeline = rec.timeline;
      if (rec.variantWork && rec.variantWork !== "media") o.variant_of_work = rec.variantWork;
      return o;
    });

  const msDoc = {
    schema: 1,
    updated_at: today(),
    sources,
    icon_template: roster.thumb_template,
    timelines: TIMELINES.map((t) => ({ id: t.id, names: t.names })),
    works: works.map((w) => {
      const o = { id: w.id, names: w.names, timeline: w.timeline, order: w.order };
      if (w.gget.length) {
        o.gget_series_id = w.gget[0];
        if (w.gget.length > 1) o.gget_series_ids = w.gget;
      }
      if (w.manual.length) o.manual_title_ids = w.manual;
      return o;
    }),
    ms: msOut,
  };
  const linkDoc = {
    schema: 1,
    updated_at: today(),
    sources,
    methods: {
      override: "data/atlas/gundam-overrides.json (human)",
      jan: "JAN -> Gunplapedia kit page 'Model of' -> Gundam Wiki title",
      gunplapedia_name: "whole kit name = Gunplapedia 'Japanese Name'",
      name_exact: "cleaned kit name = MS name (Gundam Wiki kanji / GGET)",
      model: "model number in the kit name",
      pilot_custom: "<pilot>専用<MS> -> MS (variant noted)",
      set_split: "set name split into members",
      name_contains: "longest specific MS name contained in the kit name",
      name_suffix: "short box name that ends a full MS name (e.g. バンシィ・ノルン)",
    },
    links,
    kit_works: kitWorks,
    stats,
  };
  const queueDoc = { schema: 1, updated_at: today(), sources, count: queue.length, note: "Unmatched plastic kits. Fix by adding {kit_id: [ms id]} to gundam-overrides.json.", kits: queue };

  const outs = await Promise.all([
    writeCompactJson(P("gundam-ms.json"), msDoc),
    writeCompactJson(P("gundam-kit-ms.json"), linkDoc),
    writeCompactJson(P("gundam-review-queue.json"), queueDoc),
  ]);
  for (const o of outs) console.log(`[build] ${o.written ? "wrote" : "unchanged"} ${path.basename(o.path)} ${(o.bytes / 1024).toFixed(0)} KB`);
  console.log(JSON.stringify(stats, null, 1));

  if (process.env.ATLAS_DEBUG_FILE) {
    const dbg = rows.map((x) => ({ id: x.kit.kit_id, g: x.kit.grade_code, cls: x.cls, name: x.kit.names.ja, cleaned: x.r.cleaned, m: x.r.method, ms: x.r.ids, works: kitWorks[x.kit.kit_id], hint: x.r.hintWorks }));
    await writeCompactJson(process.env.ATLAS_DEBUG_FILE, dbg, { skipIfSame: false });
  }
  if (process.env.ATLAS_SAMPLES) {
    const sampleRows = rows.filter((x) => x.r.ids.length && x.cls === "plastic");
    const n = Number(process.env.ATLAS_SAMPLES) || 15;
    let seed = Number(process.env.ATLAS_SEED || 20261101);
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const picks = new Set();
    while (picks.size < Math.min(n, sampleRows.length)) picks.add(Math.floor(rand() * sampleRows.length));
    console.log("SAMPLES");
    for (const i of picks) {
      const x = sampleRows[i];
      console.log(`  ${x.kit.names.ja}  =>  ${links[x.kit.kit_id].map((l) => `${l.ms} [${l.method}/${l.role}]`).join(" | ")}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
