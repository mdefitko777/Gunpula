// Build the Hobby Atlas Gundam MS master and the kit <-> MS / kit <-> work tables.
//
// Inputs (all in the repo, no network):
//   data/kits.json                         Gunpula catalogue (names.ja is what we match on)
//   data/atlas/gundam-gget-roster.json     import_gget_roster.mjs
//   data/atlas/gundam-src-gundamwiki.json  import_gundamwiki_ms.mjs (canonical MS ids)
//   data/atlas/gundam-src-gunplapedia.json import_gunplapedia.mjs  (JAN -> "Model of")
//   data/atlas/gundam-src-manual.json      import_manual_works.mjs (official kit -> work)
//   data/atlas/gundam-overrides.json       human-maintained {kits: {kit_id: [ms ids]}}
//
// Outputs (compact JSON):
//   data/atlas/gundam-ms.json            timelines, works, MS master
//   data/atlas/gundam-kit-ms.json        links {kit_id: [{ms, role, method, confidence}]}, kit_works, stats
//   data/atlas/gundam-review-queue.json  unmatched plastic kits, low-confidence links, GGET conflicts
//
// MS master: one record per Gundam Wiki page (overview/list pages such as "MS-06 Zaku II" or
// "RX-78 Gundam series" are folded into their main page). GGET units are attached to the page
// whose model number AND name agree; a unit whose name does not fit any page sharing its model
// number gets its own "gget:<id>" record instead of being folded into a sibling.
//
// Kit matching cascade on NFKC names.ja: override -> JAN (Gunplapedia) -> Gunplapedia JA name ->
// exact cleaned name -> set split (every member runs the cascade) -> model number (with model
// family, 改 and EW handling) -> truncated name -> <pilot>専用<MS> (pilot table, then pages
// naming the pilot) -> name prefix -> guarded contains -> name suffix. SD original characters (BB戦士 三国伝,
// 武者, 騎士, SDW HEROES) that only borrow an MS name link with role "sd_character".
//
// Debugging: ATLAS_EXPLAIN=<regex> prints how matching kits were matched,
// ATLAS_EXPLAIN_UNIT=<regex> prints the candidate scores of matching GGET units.
import path from "node:path";
import { buildWorks, eraTimeline, TIMELINES, wikiSeriesMatcher } from "./gundam_works.mjs";
import { classifyKit, cleanKitName, isSetName, janOf, kitJoinKey, sdOriginalWork, splitPilotCustom, splitSet } from "./lib/kitnames.mjs";
import { buildKoLexicon, transliterateKo } from "./lib/ko_translit.mjs";
import { withCrawlPolicy } from "./lib/policy.mjs";
import { ATLAS_DATA, countBy, hasJapanese, modelKey, nameKey, nfkc, pct, readJson, repoPath, today, uniq, writeCompactJson } from "./lib/util.mjs";

const P = (f) => path.join(ATLAS_DATA, f);
const MIN_LINK_RATIO = Number(process.env.ATLAS_MIN_LINK_RATIO || 0.8); // refuse to overwrite on a big drop
const MIN_NAME_RATIO = Number(process.env.ATLAS_MIN_NAME_RATIO || 0.8); // same for localized MS names
const EXPLAIN = process.env.ATLAS_EXPLAIN ? new RegExp(nfkc(process.env.ATLAS_EXPLAIN), "i") : null;
const EXPLAIN_UNIT = process.env.ATLAS_EXPLAIN_UNIT ? new RegExp(nfkc(process.env.ATLAS_EXPLAIN_UNIT), "i") : null;

// Names too generic to be used for contains / truncated matching.
const GENERIC = new Set(
  ["ガンダム", "gundam", "ザク", "ザク2", "ジム", "グフ", "ドム", "ガンキャノン", "ガンタンク", "ゲルググ", "ギャン", "ズゴック", "ボール", "ジン", "ダガー", "ストライク", "フリーダム", "ジャスティス", "ウイング", "エクシア", "ユニコーン", "ガンダム改", "量産型", "試作", "専用", "カスタム", "コア", "ファイター", "コアファイター", "sd", "ms", "g", "x", "v", "z", "zz", "00"].map(nameKey),
);
// Model numbers in kit names (upper-cased NFKC). Greek capitals belong to model numbers:
// RX-93-ν2, FA-93-ν2HWS, gMS-Ω, ZGMF-X56S/γ ("ν".toUpperCase() is "Ν").
const MODEL_RE = /(?<![A-Z0-9])([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9Α-Ω]+(?:[-\/.][A-Z0-9Α-Ω]+)*(?:\[[A-Z0-9]+\])?)/g;
const NOT_MODEL = /^(RE-?100|EX-?\d+|SD-?EX|HG-?\w*|MG-?\w*|RG-?\w*|PG-?\w*|EG-?\w*|HI-.*|VER-.*|NO-\d+|PB-\d+|SDW-.*|PART-\d+|TYPE-\w+|VOL-\d+|MK-?I+|MK-?V|MK-?IV|SIDE-F|S-\d+|A-\d+|B-\d+|G-\d+|C-\d+|F-\d+|EX-S|T-\d+|DX-?\d*|SP-?\d*|LED-?\w*|SET-\d+|U\.C\.\d+|UC-\d+|CE-\d+|AD-\d+|PG-UNLEASHED)$/;
// A model-number token: has a dash and a digit (RX-78-2, ZGMF-X56S/γ, GAT-X105+AQM/E-X01),
// letters followed by digits (F90, LM314V21), or letters + dash + Greek (gMS-Ω, gMS-κ).
// "Hi-ν" is a name, not a model number.
const isModelToken = (t) =>
  t.length <= 40 && !/\s/.test(t) && !/^hi-/i.test(t) && ((/-/.test(t) && /\d/.test(t)) || /^[A-Z]+\d+[A-Za-z0-9]*$/.test(t) || /^[A-Za-z]{2,6}-[Α-Ωα-ω]+$/.test(t));
// m is a more specific member of the model family f: MS-06 -> MS-06F, MS-06R -> MS-06R-1A,
// RXF-91 -> RXF-91A, AGE-1 -> AGE-1S. The family must not continue with a digit (RX-7 vs RX-78).
const extendsModel = (m, f) => m !== f && m.startsWith(f) && /^[-A-ZΑ-Ω\[\/(]/.test(m.slice(f.length));
// Typos in GGET model numbers (AGW-G-64 for ASW-G-64, ZMS-S06S for ZM-S06S).
const fixUnitModel = (m) => m.replace(/^AGW-G-/, "ASW-G-").replace(/^ZMS-S/, "ZM-S");

// Famous pilot customs whose MS is a different variant from the base name printed on the box.
// Used for kits ("<pilot>専用<MS>") and GGET units ("<MS>(<pilot>専用機)"), never for kits or
// units that name a retelling (ORIGIN, Thunderbolt, GQ), whose versions differ.
const ZAKU2 = /(?<!旧)ザク(?!I(?!I))(?!.*(?:ゲルググ|ドム|グフ))/; // Zaku II, not Zaku I / 旧ザク
const PILOT_MS = [
  [/シン・?マツナガ/, ZAKU2, "MS-06R-1A Zaku II High Mobility Type"],
  [/ジョニー・?ライデン/, ZAKU2, "MS-06R-2 Zaku II High Mobility Type"],
  [/ジョニー・?ライデン/, /ゲルググ(?!.*改)/, "MS-14B Gelgoog High Mobility Type"],
  [/黒い三連星|ガイア|オルテガ|マッシュ/, ZAKU2, "MS-06R-1A Zaku II High Mobility Type"],
  [/ブシドー|グラハム/, /アヘッド/, "GNX-704T/AC Ahead Sakigake"],
  [/シャア|ガトー/, /リック・?ドム(?!II|ツヴァイ)/, "MS-09RS Rick Dom"],
  [/シャア/, /ゲルググ/, "MS-14S Gelgoog Commander Type"],
  [/シャア/, /ズゴック/, "MSM-07S Z'Gok Commander Type"],
  [/シャア/, ZAKU2, "MS-06S Zaku II Commander Type"],
  [/キャスバル/, /ガンダム/, "RX-78/C.A. Casval's Gundam"],
];

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

// Works that only retell or re-imagine the UC original (their pages share UC model numbers).
const ALT_WORKS = new Set(["origin", "cucuruz-doans-island", "thunderbolt", "gquuuuuux"]);

// Which "alternative version" a wiki page is, if any.
function variantWorkOf(rec) {
  const t = `${rec.id} ${rec.era || ""}`;
  if (/\/Origin|\(Origin\)|The Origin/i.test(t)) return "origin";
  if (/Thunderbolt/i.test(t)) return "thunderbolt";
  // GQuuuuuuX designations are "gMS-..." (the wiki title upper-cases them: "GMS-01 Gelgoog")
  if (/\(GQ\)|GQuuuuuuX|Universal Century \(GQ\)/.test(t) || /^GMS-/.test(rec.id)) return "gquuuuuux";
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
const isEw = (s) => /(?<![A-Za-z])EW(?![A-Za-z])|EW版|エンドレスワルツ|Endless Waltz|ゼロカスタム/i.test(nfkc(s));
const pageIsEw = (rec) => /(?<![A-Za-z])EW(?![A-Za-z])/.test(rec.id);

// Trailing qualifiers on GGET unit names: "(ユニコーンモード)", "【阿頼耶識リミッター解除/半壊】", "(EX)".
// ("[ヘイズル]" in "ガンダムTR-1[ヘイズル]" is the nickname and stays.)
const UNIT_TAIL = /\s*(?:[(（][^()（）]*[)）]|【[^】]*】)\s*$/;
const exSuffix = (n) => nfkc(n).replace(/\s*[(（](EX|EXA|SP|ULT|ULTIMATE)[)）]\s*$/i, "").trim();
function stripTails(n) {
  let s = exSuffix(n);
  for (let i = 0; i < 4; i++) {
    const t = s.replace(UNIT_TAIL, "").trim();
    if (t === s || !t) break;
    s = t;
  }
  return s.replace(/\s+Ver\.\s*.*$/i, "").trim();
}
// A parenthetical that names a form or mode of the same MS (kept out of localized MS names).
const FORM_QUALIFIER = /形態|モード|Mode|起動時|覚醒|使用時|発動/i;

/** How well a query name fits a set of page names (0 = unrelated, 100 = identical). */
function nameAffinity(qFull, qBase, keys) {
  let best = 0;
  for (const k of keys) {
    if (!k || k.length < 2) continue;
    if (k === qFull) best = Math.max(best, 100);
    else if (k === qBase) best = Math.max(best, 90);
    else if (qBase.length >= 3 && k.endsWith(qBase)) best = Math.max(best, 60 + (10 * qBase.length) / k.length); // バンシィ ⊂ ユニコーンガンダム2号機バンシィ
    else if (qBase.length >= 4 && k.startsWith(qBase)) best = Math.max(best, 58 + (10 * qBase.length) / k.length); // ガンダム試作1号機 ⊂ ガンダム試作1号機ゼフィランサス
    else if (k.length >= 3 && qBase.includes(k)) best = Math.max(best, 20 + (20 * k.length) / qBase.length); // ダークダガーL ⊃ ダガーL
    else if (qBase.length >= 3 && k.includes(qBase)) best = Math.max(best, 15 + (10 * qBase.length) / k.length);
  }
  return best;
}

// Clean a Korean catalogue name down to the MS name. The Gunpula ko names are partly machine
// translated ("건담ナイオン"), so only fully Hangul/Latin results are used.
const KO_NOISE = /(건담\s*베이스|건담베이스|프리미엄\s*반다이|한정판?|재판|재생산|발송|버전|클리어\s*컬러|클리어|컬러|코팅|메탈릭|도금|티타늄\s*피니시|리얼\s*타입)/g;
function koMsName(raw) {
  let s = nfkc(raw).replace(/【[^】]*】|\[[^\]]*\]|<[^>]*>|＜[^＞]*＞|[(（][^)）]*[)）]/g, " ");
  s = s.replace(KO_NOISE, " ").replace(/BB\s*전사\s*\d*/g, " ");
  const { core } = cleanKitName(s, []);
  const t = nfkc(core).replace(/\s+/g, " ").trim();
  if (!/[가-힣]/.test(t) || /[぀-ヿ一-鿿]/.test(t)) return null;
  if (!/^[가-힣A-Za-z0-9Α-Ωα-ω\s\-·.:+&'’!]+$/.test(t)) return null;
  if (t.length < 2 || /^(건담|자쿠|짐)$/.test(t)) return null;
  return t;
}
const majority = (values) => {
  const c = countBy(values.filter(Boolean), (v) => v);
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0]?.[0] || null;
};

async function main() {
  const [catalog, roster, wiki, gp, manual, overridesRaw, previousLinks, previousMs] = await Promise.all([
    readJson(repoPath("data", "kits.json")),
    readJson(P("gundam-gget-roster.json")),
    readJson(P("gundam-src-gundamwiki.json")),
    readJson(P("gundam-src-gunplapedia.json")),
    readJson(P("gundam-src-manual.json"), null),
    readJson(P("gundam-overrides.json"), {}),
    readJson(P("gundam-kit-ms.json"), null),
    readJson(P("gundam-ms.json"), null),
  ]);
  const overrides = Object.fromEntries(Object.entries(overridesRaw.kits || overridesRaw).filter(([k, v]) => !k.startsWith("_") && Array.isArray(v)));
  const unitOverrides = overridesRaw.units || {}; // {gget unit id: MS id}
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
    const rec = { id: w.t, models: new Set(), aliasModels: new Set(), names: { ja: [], en: [] }, wikiJa: null, era: w.era, arch: w.arch, gget: [], works: [], src: "gundamwiki", noInfobox: Boolean(w.no_infobox), hasSeries: Boolean(w.series?.length || w.debut) };
    for (const label of [w.t, w.en].filter(Boolean)) {
      const { model, name } = splitModelLabel(label);
      if (model) rec.models.add(modelKey(model));
      rec.names.en.push(name);
    }
    if (w.ja) {
      const { models, name } = parseKanji(w.ja);
      for (const m of models) rec.models.add(modelKey(m));
      if (name && hasJapanese(name)) {
        rec.names.ja.push(name);
        rec.wikiJa = name;
        // "ゲルググJ（イェーガー）", "ガンダムNT-1(アレックス)": the box name drops a bracketed
        // katakana reading (not a version such as "（ダイキVer.）" or "（北米戦仕様）")
        const rb = name.match(/^(.*?[A-Za-z0-9])\s*[(（]([ァ-ヶー・]+)[)）]\s*$/);
        if (rb && !/カラー$/.test(rb[2]) && nameKey(rb[1]).length >= 3) rec.names.ja.push(rb[1]);
      }
    }
    // A page with no "Series" list but a "Debut" (215 pages: GQuuuuuuX -Beginning-, SEED FREEDOM,
    // Thunderbolt …) belongs to its debut work; without this ZGMF-MM07 ズゴック had no work at all
    // and the SEED FREEDOM kit fell back to the 0079 ズゴック.
    // ("Mobile Suit Variation" as a debut names where the design was drawn, not where the suit
    // appears — ザク・マリンタイプ is in the TV series — so it is not used this way.)
    const debutOnly = w.debut && !/^Mobile Suit Variation$/i.test(w.debut) ? [w.debut] : [];
    const seriesWorks = uniq(((w.series || []).length ? w.series : debutOnly).map(matchWikiSeries));
    rec.works = seriesWorks;
    rec.debut = seriesWorks[0] || null;
    rec.timeline = eraTimeline(w.era) || (rec.debut ? workById.get(rec.debut)?.timeline : null) || null;
    rec.variantWork = variantWorkOf(rec);
    ms.set(rec.id, rec);
  }

  // Overview pages are not mobile suits. "MS-06 Zaku II" (no infobox), "RX-78 Gundam series",
  // "MS-14 Gelgoog" (infobox without kanji/series) redirect to the main page with the same name
  // in that model family (MS-06F Zaku II, RX-78-2 Gundam, MS-14A Gelgoog); list pages go away.
  const msRedirects = {};
  const enKeyOf = (rec) => nameKey((rec.names.en[0] || "").replace(/\s+series$/i, ""));
  // Among same-name family members, the one Gunplapedia kits cite most is the main page
  // (MS-07 Gouf -> MS-07B, MS-05 Zaku I -> MS-05B, RX-78 Gundam series -> RX-78-2).
  const gpRefs = countBy(gp.kits.flatMap((k) => k.model_of || []), (t) => t);
  for (const rec of [...ms.values()]) {
    const looksOverview = rec.noInfobox || (!rec.wikiJa && !rec.hasSeries && rec.models.size > 0);
    if (!looksOverview) continue;
    const en = enKeyOf(rec);
    const fam = [...rec.models];
    const targets = en && fam.length
      ? [...ms.values()]
          .filter((r) => r !== rec && !r.noInfobox && !r.variantWork && enKeyOf(r) === en && [...r.models].some((m) => fam.some((f) => extendsModel(m, f))))
          .sort((a, b) => (gpRefs[b.id] || 0) - (gpRefs[a.id] || 0) || [...a.models][0].localeCompare([...b.models][0]))
      : [];
    if (!targets.length && !rec.noInfobox) continue; // a real page that just lacks kanji
    ms.delete(rec.id);
    if (targets.length) {
      msRedirects[rec.id] = targets[0].id;
      for (const m of rec.models) targets[0].aliasModels.add(m);
    }
  }
  const resolveId = (id) => (ms.has(id) ? id : msRedirects[id] && ms.has(msRedirects[id]) ? msRedirects[id] : null);
  const allModels = (rec) => [...rec.models, ...rec.aliasModels];
  const hasModel = (rec, m) => rec.models.has(m) || rec.aliasModels.has(m);
  // The page's model number is the box model or a more specific member of its family
  // ("AGE-1" on the box, AGE-1S page).
  const inFamily = (rec, m) => allModels(rec).some((x) => x === m || extendsModel(x, m));

  const loose = (m) => m.replace(/-/g, ""); // RX-78GP01Fb vs RX-78GP01-Fb
  const wikiByModel = new Map();
  for (const rec of ms.values()) for (const m of allModels(rec)) for (const k of uniq([m, loose(m)])) (wikiByModel.get(k) || wikiByModel.set(k, []).get(k)).push(rec);
  const wikiByJa = new Map();
  const wikiByEn = new Map();
  for (const rec of ms.values()) {
    for (const n of rec.names.ja) {
      const k = nameKey(n);
      if (k) (wikiByJa.get(k) || wikiByJa.set(k, []).get(k)).push(rec);
    }
    for (const n of rec.names.en) {
      const k = nameKey(n);
      if (k.length >= 3) (wikiByEn.get(k) || wikiByEn.set(k, []).get(k)).push(rec);
    }
  }
  const recKeys = (rec) => ({ ja: uniq(rec.names.ja.map(nameKey)), en: uniq(rec.names.en.map(nameKey)) });

  // ---------------------------------------------------------------- GGET units -> MS
  // Candidates: pages sharing a model number, plus pages whose JA/EN name equals the unit's base
  // name. A unit is attached by model + name, or by an identical name; with no name evidence it
  // is attached only when its model number has exactly one usable page ("weak": icon/names are
  // not folded from it). Otherwise it gets a GGET-only record.
  const unitToMs = new Map();
  const ggetOnly = new Map();
  const weakLinks = [];
  let linkedByModel = 0;
  let linkedByName = 0;
  for (const u of roster.units) {
    const jaFull = exSuffix(u.names.ja || "");
    const jaBase = stripTails(u.names.ja || "");
    const enFull = exSuffix(u.names.en || "");
    const enBase = stripTails(u.names.en || "");
    const q = { jaFull: nameKey(jaFull), jaBase: nameKey(jaBase), enFull: nameKey(enFull), enBase: nameKey(enBase) };
    const uWorks = uniq(u.series.map((s) => workOfGget.get(s)));
    const uVariant = kitVariantSignal(u.names.ja || "");
    const uEw = isEw(`${u.names.ja} ${u.names.en}`);
    const keys = uniq(u.models.map(modelKey));
    let modelCands = keys.flatMap((m) => wikiByModel.get(m) || []);
    let modelHow = "model";
    if (!modelCands.length) modelCands = uniq(keys.map(fixUnitModel)).flatMap((m) => wikiByModel.get(m) || []);
    if (!modelCands.length) {
      modelCands = uniq(keys.map((m) => loose(fixUnitModel(m)))).flatMap((m) => wikiByModel.get(m) || []);
      modelHow = "loose";
    }
    modelCands = [...new Set(modelCands)];
    const nameCands = [...new Set([q.jaFull, q.jaBase].flatMap((k) => wikiByJa.get(k) || []).concat([q.enFull, q.enBase].flatMap((k) => (k.length >= 3 ? wikiByEn.get(k) || [] : []))))];
    // "高機動型ザクⅡ(ジョニー・ライデン専用)": a famous pilot names the variant (MS-06R-2)
    const uJa = nfkc(u.names.ja || "");
    const pilotHit = !uVariant && !uWorks.some((w) => ALT_WORKS.has(w)) ? PILOT_MS.find(([pr, mr, id]) => pr.test(uJa) && mr.test(uJa.replace(pr, "")) && ms.has(id)) : null;
    const cands = [...new Set([...modelCands, ...nameCands, ...(pilotHit ? [ms.get(pilotHit[2])] : [])])];
    // A page found by name whose model number is a sibling of the unit's (MS-06R-1A vs the
    // unit's MS-06R-2) is another MS with a shortened name; a more specific member is fine.
    const siblingConflict = (rec) =>
      keys.some((k0) => {
        const k = fixUnitModel(k0);
        return allModels(rec).some((m) => m !== k && !extendsModel(m, k) && !extendsModel(k, m) && m.split("-").slice(0, 2).join("-") === k.split("-").slice(0, 2).join("-") && m.length > 4);
      });
    const forced = unitOverrides[u.id] && ms.get(unitOverrides[u.id]);
    if (forced && !cands.includes(forced)) cands.push(forced);
    const scored = cands.map((rec) => {
      const k = recKeys(rec);
      let name = Math.max(nameAffinity(q.jaFull, q.jaBase, k.ja), nameAffinity(q.enFull, q.enBase, k.en));
      if (name > 0) name += uEw ? (pageIsEw(rec) ? 15 : 0) : pageIsEw(rec) ? -15 : 0;
      if (pilotHit && rec.id === pilotHit[2]) name = Math.max(name, 95);
      const inModel = modelCands.includes(rec);
      let s = name + (inModel ? (modelHow === "model" ? 30 : 25) : 0) + (rec.works.some((w) => uWorks.includes(w)) ? 5 : 0) - (rec.id.includes("(") ? 1 : 0);
      if (!inModel && keys.length && siblingConflict(rec) && !(pilotHit && rec.id === pilotHit[2])) s -= 50;
      if (forced === rec) [name, s] = [Math.max(name, 90), 1000];
      if (rec.variantWork === "media") s -= rec.works.some((w) => uWorks.includes(w)) ? 0 : 20;
      else if (rec.variantWork) s += uVariant === rec.variantWork || uWorks.includes(rec.variantWork) ? 10 : -40;
      // "グフ(サンダーボルト版)": the unit names its version, so other versions lose
      if (uVariant && rec.variantWork !== uVariant) s -= 25;
      return { rec, name, inModel, s };
    });
    scored.sort((a, b) => b.s - a.s || a.rec.id.length - b.rec.id.length || a.rec.id.localeCompare(b.rec.id));
    const best = scored[0];
    const usableModel = scored.filter((x) => x.inModel && x.s > 0);
    let target = null;
    let strength = null;
    let fit = best?.name || 0;
    // A page sharing the unit's model number whose name clearly fits (prefix/tail/exact) beats a
    // page found by name alone ("ジム・コマンド" with RGM-79GS -> "ジム・コマンド宇宙戦仕様"),
    // unless only the name-found page is the version the unit names.
    const bestModel = scored.find((x) => x.inModel);
    const versionOk = (x) => !x.rec.variantWork || x.rec.variantWork === "media" || x.rec.variantWork === uVariant || uWorks.includes(x.rec.variantWork);
    const bestVersioned = best && best.rec.variantWork && best.rec.variantWork !== "media" && versionOk(best);
    if (best && !best.inModel && bestModel && bestModel.name >= 50 && bestModel.s >= best.s - 25 && versionOk(bestModel) && !bestVersioned) [target, strength, fit] = [bestModel.rec, "strong", bestModel.name];
    else if (best && best.inModel && best.name >= 15) [target, strength] = [best.rec, "strong"];
    else if (best && best.name >= 90) [target, strength] = [best.rec, "strong"];
    else if (usableModel.length === 1) [target, strength] = [usableModel[0].rec, "weak"];
    // Only a retelling's page carries the unit's name ("MS-06S Char's Zaku II" is THE ORIGIN;
    // the anime unit is "MS-06S Zaku II Commander Type"): move to the original-version page that
    // shares the model number when exactly one of them fits best.
    if (target && strength === "strong" && target.variantWork && target.variantWork !== "media" && uVariant !== target.variantWork && !uWorks.includes(target.variantWork)) {
      const uc = scored.filter((x) => x.inModel && !x.rec.variantWork);
      if (uc.length && (uc.length === 1 || uc[0].s > uc[1].s)) {
        target = uc[0].rec;
        fit = Math.min(best.name, 90);
      }
    }
    if (EXPLAIN_UNIT?.test(nfkc(u.names.ja))) console.log("[unit]", u.id, u.names.ja, u.models, "->", target?.id || "(gget-only)", strength, scored.slice(0, 5).map((x) => `${x.rec.id}:${x.s.toFixed(1)}/${x.name.toFixed(0)}${x.inModel ? "m" : ""}`).join(" | "));
    if (target) {
      if (best.inModel || strength === "weak") linkedByModel++;
      else linkedByName++;
      if (strength === "weak") weakLinks.push({ unit: u.id, name: u.names.ja, ms: target.id });
    } else {
      const key = `${keys.join("/")}|${q.jaBase}`;
      target = ggetOnly.get(key);
      if (!target) {
        target = { id: `gget:${u.id}`, models: new Set(keys), aliasModels: new Set(), names: { ja: [], en: [] }, wikiJa: null, era: null, gget: [], works: [], src: "gget" };
        ggetOnly.set(key, target);
        ms.set(target.id, target);
      }
      strength = "strong";
    }
    target.gget.push({ u, strength, name: target.src === "gget" ? 100 : fit, jaBase, enBase });
    unitToMs.set(u.id, target.id);
  }

  // Fold GGET data into MS records: icon and localized names from the best-fitting unit, names
  // and models only from units whose name really is this MS.
  const ggetConflicts = [];
  for (const rec of ms.values()) {
    if (!rec.gget.length) continue;
    const isEx = (g) => /[(（](EX|EXA|SP)[)）]/.test(g.u.names.ja || "");
    const hasParen = (g) => nfkc(g.u.names.ja || "") !== g.jaBase;
    const ranked = [...rec.gget].sort((a, b) => (b.strength === "strong") - (a.strength === "strong") || b.name - a.name || hasParen(a) - hasParen(b) || isEx(a) - isEx(b) || a.u.id - b.u.id);
    const primary = ranked[0];
    // A weakly attached unit (same model number, unrelated name) gives its picture only to a
    // record that has no better unit; its names are never shown (see fromUnit below).
    if (primary.strength === "strong" || !rec.gget.some((g) => g.strength === "strong")) rec.icon = primary.u.icon;
    rec.primaryUnit = primary;
    // Localized names come from the best unit. A form, mode or pilot qualifier of that unit
    // ("(第1形態)", "(アナベル・ガトー専用)") is dropped when the record is the plain MS; a
    // version the record itself is about ("(EW版)" on an EW page, "グエル専用機") stays.
    const formTail = exSuffix(primary.u.names.ja || "").slice(primary.jaBase.length).trim();
    const tailCore = formTail.replace(/[()（）【】]/g, "");
    const stripQualifier =
      formTail &&
      !pageIsEw(rec) &&
      // a form / pilot tail, or any tail when the page itself is the bare name ("デビルガンダム(アルティメットガンダム)" on Devil Gundam)
      (FORM_QUALIFIER.test(formTail) || /専用|機$|仕様|カラー/.test(tailCore) || (rec.wikiJa && nameKey(rec.wikiJa) === nameKey(primary.jaBase))) &&
      !(rec.wikiJa && nameKey(rec.wikiJa).includes(nameKey(tailCore)));
    const dropForm = (v) => stripTails(v).replace(/\s*(?:제\s*\d+\s*형태|第\s*\d+\s*(?:型态|形態|形态|型態)|\d+(?:st|nd|rd|th)\s*Form)\s*$/i, "").trim();
    rec.gget_names = Object.fromEntries(Object.entries(primary.u.names).map(([k, v]) => [k, stripQualifier ? dropForm(v) || exSuffix(v) : exSuffix(v)]));
    // Names: strong units whose name is this MS give their full and base names; weakly attached
    // units only their full name. A name that is another page's own wiki name is never folded
    // ("高機動型ザクII" of a Johnny Ridden unit stays with MS-06R-1A), and a unit's model number
    // is only added when no other page carries it (GGET's "ジム・コマンド" says RGM-79GS).
    // (pages of a retelling do not count: "ザクII" is also the Thunderbolt page's kanji)
    const ownedElsewhere = (n, map) => (map.get(nameKey(n)) || []).some((r) => r !== rec && !r.variantWork);
    for (const g of rec.gget) {
      const u = g.u;
      // the unit is this MS: name fits (exact / base / tail / prefix), or it is the record's best
      // unit ("105ダガー" on "GAT-01A1 Dagger"); "ダークダガーL" next to "ダガーL" is not
      const strongName = g.strength === "strong" && (g.name >= 60 || g === primary);
      if (!strongName && g.strength !== "weak") continue;
      for (const m of u.models) {
        const k = fixUnitModel(modelKey(m));
        if (!(wikiByModel.get(k) || []).some((r) => r !== rec)) rec.models.add(k);
      }
      const full = [exSuffix(u.names.ja || ""), u.short_names?.ja && exSuffix(u.short_names.ja)];
      const fullEn = [exSuffix(u.names.en || "")];
      // full names of strong units always fold; base names and weak units' names only when no
      // other original-version page owns that name
      for (const n of full) if (n && (strongName || !ownedElsewhere(n, wikiByJa))) rec.names.ja.push(n);
      for (const n of fullEn) if (n && (strongName || !ownedElsewhere(n, wikiByEn))) rec.names.en.push(n);
      if (strongName && !ownedElsewhere(g.jaBase, wikiByJa)) rec.names.ja.push(g.jaBase);
      if (strongName && g.enBase && !ownedElsewhere(g.enBase, wikiByEn)) rec.names.en.push(g.enBase);
    }
    rec.names.ja = uniq(rec.names.ja.filter((n) => nameKey(n).length >= 2));
    rec.names.en = uniq(rec.names.en.filter((n) => nameKey(n).length >= 2));
    const trusted = rec.gget.filter((g) => g.strength === "strong");
    const ggetWorks = uniq(trusted.flatMap((g) => g.u.series.map((s) => workOfGget.get(s))));
    rec.works = uniq([...rec.works, ...ggetWorks]);
    // GGET lists a unit under its own work first; trust that over the wiki series order
    // (which often starts with a manga or the ORIGIN retelling).
    const primaryWork = primary.strength === "strong" ? workOfGget.get(primary.u.series[0]) : null;
    if (primaryWork && !rec.variantWork) rec.debut = primaryWork;
    else if (!rec.debut) rec.debut = (rec.variantWork && rec.works.includes(rec.variantWork) ? rec.variantWork : [...ggetWorks].sort((a, b) => workOrder(a) - workOrder(b))[0]) || null;
    if (!rec.timeline && rec.debut) rec.timeline = workById.get(rec.debut)?.timeline || null;
    // Check: units folded into one record must share a base name (one may extend the other).
    const bases = uniq(trusted.map((g) => nameKey(g.jaBase)));
    const clash = bases.filter((a) => !bases.every((b) => a === b || a.includes(b) || b.includes(a)));
    if (clash.length) ggetConflicts.push({ ms: rec.id, units: trusted.map((g) => ({ id: g.u.id, name: g.u.names.ja })) });
  }
  if (ggetConflicts.length) console.warn(`[build] ${ggetConflicts.length} MS records hold GGET units with different base names (see review queue)`);

  // ---------------------------------------------------------------- indices for kit matching
  const byModel = new Map();
  const byName = new Map();
  const add = (map, k, id) => {
    if (!k) return;
    (map.get(k) || map.set(k, new Set()).get(k)).add(id);
  };
  for (const rec of ms.values()) {
    for (const m of allModels(rec)) {
      add(byModel, m, rec.id);
      add(byModel, loose(m), rec.id);
      // Kits say "ガンダムGP02A" / "GP-01" for RX-78GP02A / RX-78GP01
      const gpm = m.match(/^RX-78(GP)-?(\d+)-?([A-Z0-9]*)$/);
      if (gpm) {
        add(byModel, `GP${gpm[2]}${gpm[3]}`, rec.id);
        add(byModel, `GP-${gpm[2]}${gpm[3]}`, rec.id);
        if (gpm[3]) add(byModel, `GP${gpm[2]}-${gpm[3]}`, rec.id);
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
  const modelKeysSorted = [...byModel.keys()].sort();
  const modelLookup = (m) => [...(byModel.get(m) || byModel.get(loose(m)) || [])];
  // Pages in the model family of m that are more specific (RXF-91 -> RXF-91A, AGE-1 -> AGE-1S).
  const familyLookup = (m) => uniq(modelKeysSorted.filter((k) => extendsModel(k, m)).flatMap((k) => [...byModel.get(k)]));
  const containsKeys = [...byName.keys()]
    .filter((k) => !GENERIC.has(k) && (hasJapanese(k) ? k.length >= 4 : k.length >= 6))
    .sort((a, b) => b.length - a.length);
  const suffixKeys = [...byName.keys()].filter((k) => hasJapanese(k) && k.length >= 6);
  // Same MS in another version: "MS-09R Rick Dom" <-> "MS-09 Rick Dom (GQ)" (same English name).
  const siblingIndex = new Map();
  for (const rec of ms.values()) {
    if (!rec.variantWork) continue;
    const en = nameKey(splitModelLabel(rec.id.replace(/\s*\((?:GQ|Thunderbolt Ver\.|Origin)\)$|\/Origin$/i, "")).name);
    add(siblingIndex, `${rec.variantWork}|${en}`, rec.id);
  }

  // ---------------------------------------------------------------- Gunplapedia + WEB取説 indices
  const titleToMs = (t) => resolveId(t) || (wiki.redirects?.[t] ? resolveId(wiki.redirects[t]) : null);
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
  const altOnly = (r) => r.works.length > 0 && r.works.every((w) => ALT_WORKS.has(w));

  // A work named in the box name — "ズゴック（SEED FREEDOM Ver.）", "ガンダム (GQuuuuuuX Ver.)" —
  // tells which of several same-named pages is meant; the series bucket only knows "SEED".
  const TITLE_HINTS = [
    [/SEED\s*FREEDOM(?!\s*ZERO)/i, "seed-freedom"],
    [/SEED\s*DESTINY/i, "seed-destiny"],
    [/GQuuuuuuX|ジークアクス/i, "gquuuuuux"],
    [/水星の魔女|Witch\s*from\s*Mercury/i, "witch-from-mercury"],
    [/鉄血のオルフェンズ/, "orphans"],
    [/閃光のハサウェイ/, "hathaway"],
  ].filter(([, id]) => workById.has(id));
  function titleHintWorks(text) {
    return TITLE_HINTS.filter(([re]) => re.test(text)).map(([, id]) => id);
  }

  function pick(ids, ctx, { max = 1 } = {}) {
    // A variant page found alone competes with its base page (kits are rarely the alt version),
    // and a kit that names a version ("(GQ)") also sees that version of each candidate.
    let expanded = uniq([...ids].flatMap((id) => [id, baseOf(id)]));
    const wantVariant = ctx.variant || ctx.works.find((w) => ALT_WORKS.has(w));
    if (wantVariant) {
      expanded = uniq([
        ...expanded,
        ...expanded.flatMap((id) => {
          const r = ms.get(id);
          return r ? [...(siblingIndex.get(`${wantVariant}|${nameKey(splitModelLabel(id).name)}`) || [])] : [];
        }),
      ]);
    }
    const recs = expanded.map((id) => ms.get(id)).filter(Boolean);
    if (recs.length <= 1) return { ids: recs.map((r) => r.id), ambiguous: false };
    const score = (r) =>
      (ctx.works.length && r.works.some((w) => ctx.works.includes(w)) ? 3 : 0) +
      (ctx.models.some((m) => hasModel(r, m)) ? 2 : 0) +
      // main page of an overview ("MS-06R Zaku II High Mobility Type" -> MS-06R-1A)
      (ctx.models.some((m) => r.aliasModels.has(m)) ? 1.5 : 0) +
      (r.variantWork && r.variantWork !== "media" && !ctx.works.includes(r.variantWork) && ctx.variant !== r.variantWork ? -4 : 0) +
      (r.variantWork === "media" ? -2 : 0) +
      // the kit title naming the version ("サンダーボルト版", "(GQ)") beats catalogue work tags
      (ctx.variant && r.variantWork === ctx.variant ? 6 : 0) +
      (ctx.variant && r.variantWork && r.variantWork !== ctx.variant ? -3 : 0) +
      // pages that only exist in a retelling lose to the UC page unless the kit is from it
      (!r.variantWork && altOnly(r) && !r.works.some((w) => ctx.works.includes(w) || w === ctx.variant) ? -1.5 : 0) +
      (ctx.ew && pageIsEw(r) ? 4 : !ctx.ew && pageIsEw(r) ? -1.5 : 0) +
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

  const modelsIn = (upper0) => {
    // "RX-78 / C.A.", "TMF / A-803": a slash between Latin tokens belongs to the model number
    const upper = upper0.replace(/([A-Z0-9.])\s*\/\s*([A-Z0-9])/g, "$1/$2");
    const found = uniq([
      ...[...upper.matchAll(MODEL_RE)].map((m) => modelKey(m[1])).filter((m) => !NOT_MODEL.test(m)),
      // dash-less model numbers (LM312V04, F91) count only when the MS master knows them
      ...[...upper.matchAll(/(?<![A-Z0-9-])([A-Z]{1,4}\d{2,}[A-Z0-9]*)(?![A-Z0-9-])/g)].map((m) => m[1]).filter((m) => (byModel.has(m) || (/^GP\d/.test(m) && familyLookup(m).length === 1)) && !/^(HG|MG|RG|PG|EG|SD|BB|EX|R)\d+$/.test(m)),
    ]);
    // "MS-06F/J" (two types in one kit) is unknown as a whole: use its first model
    for (const m of [...found]) if (m.includes("/") && !byModel.has(m) && byModel.has(m.split("/")[0])) found.push(m.split("/")[0]);
    // "RX-78ガンダムGP01": the GP number is the model, RX-78 is only its prefix
    return found.some((m) => /^GP-?\d/.test(m)) ? found.filter((m) => m !== "RX-78") : found;
  };

  // Model-number step: exact model pages, but "RXF-91改" means the 改 member of the family.
  function modelStep(models, upper, ctx) {
    let hits = uniq(models.flatMap(modelLookup));
    // "ガンダムGP04" -> RX-78GP04G: no page for the bare number, exactly one in its family
    if (!hits.length) for (const m of models) if (familyLookup(m).length === 1) hits.push(...familyLookup(m));
    for (const m of models) {
      if (!upper.includes(`${m}改`)) continue;
      const kai = familyLookup(m).filter((id) => ms.get(id).names.ja.some((n) => /改$/.test(nfkc(n))));
      if (kai.length) hits = kai;
    }
    return hits.length ? pick(hits, ctx) : null;
  }

  // <pilot>専用<MS>: pilot table, then a page/unit naming that pilot, else the base MS (review).
  function pilotStep(cleaned, ctx) {
    // "<pilot>専用<MS>", or "<MS> <pilot>機" / "<MS> <pilot>専用機" (ゲルググ ボカタ機, ガザC ハマーン専用機)
    const tail = nfkc(cleaned).match(/^(\S.*?)\s+(\S{1,12}?)(?:専用機|専用|機)$/);
    const pc = splitPilotCustom(cleaned) || (tail && nameKey(tail[1]).length >= 2 && !/^[\d０-９]|号$/.test(tail[2]) ? { pilot: tail[2], ms: tail[1] } : null);
    if (!pc) return null;
    const retelling = ctx.variant || ctx.works.some((w) => ALT_WORKS.has(w));
    for (const [pilotRe, msRe, id] of retelling ? [] : PILOT_MS) {
      if (pilotRe.test(pc.pilot) && msRe.test(pc.ms) && ms.has(id)) return { method: "pilot_custom", confidence: 0.85, ids: [id], variant: `${pc.pilot}専用` };
    }
    const pilotKey = nameKey(pc.pilot.replace(/^ミスター・?/, ""));
    const v = cleanKitName(pc.ms, []).variants;
    const msKey = nameKey(cleanKitName(pc.ms, []).core);
    if (pilotKey.length >= 2 && msKey.length >= 2) {
      const named = uniq([...byName.keys()].filter((k) => k.includes(pilotKey) && k.includes(msKey)).flatMap((k) => [...byName.get(k)]));
      if (named.length) {
        const p = pick(named, { ...ctx, ck: nameKey(cleaned) });
        if (!p.ambiguous) return { method: "pilot_custom", confidence: 0.8, ids: p.ids, variant: `${pc.pilot}専用` };
      }
    }
    const hit = exactName(v, ctx);
    if (hit) return { method: "pilot_custom", confidence: 0.6, ids: hit.ids, variant: `${pc.pilot}専用`, review: "pilot custom linked to its base MS; no page for this pilot's version" };
    return null;
  }

  // The name cascade (everything after the JAN / Gunplapedia joins). `top` = whole kit name.
  function cascade(text, baseCtx, { top = true, sd = false } = {}) {
    const n = nfkc(text);
    const upper = n.toUpperCase();
    const models = modelsIn(upper);
    const { cleaned, core, variants, accessory } = cleanKitName(text, top ? workPrefixes : []);
    const ctx = { ...baseCtx, models, ck: nameKey(cleaned), ew: baseCtx.ew || isEw(n) };
    const out = (method, confidence, ids, extra = {}) => ({ method, confidence, ids, cleaned, core, accessory, models, ...extra });
    if (!variants.length) return out("none", 0, []);
    const modelHits = models.flatMap(modelLookup);
    // 2. exact cleaned name (untruncated). A model number printed on the box wins over a bare
    // name that belongs to another model ("MS-06S ザクII" is Char's Zaku, not the MS-06F named
    // "ザクII"), unless the name is a more specific member of that model's family (AGE-1 スパロー).
    const exact = exactName(variants, ctx, { allowTrunc: false });
    const agrees = !exact || !modelHits.length || exact.ids.some((id) => models.some((m) => inFamily(ms.get(id), m)));
    if (exact && (agrees || sd)) return out("name_exact", exact.ambiguous ? 0.75 : 0.88, exact.ids, { exactKey: exact.key });
    // 3. sets: every member runs the cascade
    if (top) {
      const parts = splitSet(cleaned);
      if (parts) {
        const ids = [];
        for (const part of parts) {
          const r = cascade(part, { ...baseCtx, ew: false }, { top: false, sd });
          if (r.ids.length) ids.push(...r.ids);
        }
        if (ids.length) return out("set_split", 0.75, uniq(ids), { set: uniq(ids).length > 1 });
      }
    }
    // 4. model number in the name
    if (modelHits.length || models.some((m) => upper.includes(`${m}改`) || familyLookup(m).length === 1)) {
      const p = modelStep(models, upper, ctx);
      if (p?.ids.length) return out("model", p.ambiguous ? 0.78 : 0.9, p.ids);
    }
    // 5. truncated exact name
    const trunc = exactName(variants, ctx);
    if (trunc) return out("name_exact", 0.8, trunc.ids, { truncated: true });
    // 6. <pilot>専用<MS>
    const pc = pilotStep(cleaned, ctx);
    if (pc) return out(pc.method, pc.confidence, pc.ids, pc);
    const ck = nameKey(core || cleaned);
    // 7a. long box name = start of a full MS name ("ユニコーンガンダム2号機" -> "...2号機・バンシィ")
    if (ck.length >= 8 && hasJapanese(ck) && !GENERIC.has(ck)) {
      const heads = suffixKeys.filter((k) => k.length > ck.length && k.startsWith(ck) && ck.length / k.length >= 0.75);
      const ids = uniq(heads.flatMap((k) => [...byName.get(k)]));
      if (ids.length && ids.length <= 2) {
        const p = pick(ids, ctx);
        return out("name_prefix", 0.6, p.ids, { key: ck });
      }
    }
    // 7. guarded contains: longest specific key inside the cleaned name
    const hitKey = containsKeys.find((k) => ck.includes(k) && (k.length / ck.length >= 0.45 || ck.startsWith(k)));
    if (hitKey) {
      const p = pick(byName.get(hitKey), ctx);
      return out("name_contains", Math.round((0.55 + 0.3 * Math.min(1, hitKey.length / ck.length)) * 100) / 100, p.ids, { key: hitKey });
    }
    // 8. short box name = tail of a full MS name ("バンシィ・ノルン" -> "ユニコーンガンダム2号機 バンシィ・ノルン")
    if (ck.length >= 5 && hasJapanese(ck) && !GENERIC.has(ck)) {
      const tails = suffixKeys.filter((k) => k.length > ck.length && k.endsWith(ck) && ck.length / k.length >= 0.4);
      const ids = uniq(tails.flatMap((k) => [...byName.get(k)]));
      if (ids.length && ids.length <= 3) {
        const p = pick(ids, ctx);
        return out("name_suffix", 0.65, p.ids, { key: ck });
      }
    }
    return out("none", 0, []);
  }

  function matchKit(kit, cls) {
    const name = kit.names?.ja || "";
    const n = nfkc(name);
    const joinKey = kitJoinKey(name);
    const manualTitles = manualIndex.get(joinKey) || [];
    const hintWorks = uniq([
      ...manualTitles.map((t) => workOfManual.get(t)),
      ...titleHintWorks(n),
      workOfLegacy.get(kit.series?.key),
    ]);
    const cleanedTop = cleanKitName(name, workPrefixes);
    const sdWork = sdOriginalWork(kit, cleanedTop.cleaned);
    const baseCtx = { works: hintWorks, variant: kitVariantSignal(name), ew: isEw(n) };
    const models = modelsIn(n.toUpperCase());
    const base = { manualTitles, hintWorks, sdWork, cleaned: cleanedTop.cleaned, core: cleanedTop.core, accessory: cleanedTop.accessory, models };

    // 0. human overrides
    if (overrides[kit.kit_id]) {
      const ids = overrides[kit.kit_id].map(resolveId).filter(Boolean);
      if (ids.length) return { ...base, method: "override", confidence: 1, ids };
    }
    // 1. JAN -> Gunplapedia "Model of"; 1b. whole-name join with Gunplapedia's Japanese kit name
    const jan = janOf(kit);
    let joined = null;
    if (jan && janIndex.has(jan)) joined = { method: "jan", ...janIndex.get(jan) };
    else {
      const gpHits = gpNameIndex.get(joinKey);
      if (gpHits?.length === 1) joined = { method: "gunplapedia_name", ...gpHits[0] };
    }
    if (joined) {
      let ids = [...joined.ids];
      // Media retellings ("RX-78 Gundam (Evolve)") listed next to the real MS are dropped.
      const nonMedia = ids.filter((id) => ms.get(id)?.variantWork !== "media");
      if (nonMedia.length && nonMedia.length < ids.length) ids = nonMedia;
      // A set member or bracket qualifier that names a sibling MS replaces the family member
      // Gunplapedia listed instead ("G3ガンダム＋シャア専用リックドム" lists RX-78-2).
      const parts = splitSet(cleanedTop.cleaned) || [cleanedTop.cleaned];
      for (const part of parts) {
        const v = cleanKitName(part, []).variants.filter((x) => x.kind === "full" && x.key.length >= 4 && !GENERIC.has(x.key));
        const hit = exactName(v, { works: hintWorks, models: [], ck: nameKey(part), variant: baseCtx.variant, ew: baseCtx.ew }, { allowTrunc: false });
        if (!hit || hit.ambiguous || ids.includes(hit.ids[0])) continue;
        const h = ms.get(hit.ids[0]);
        // the same MS in another version ("Zaku II" vs "Zaku II (Thunderbolt Ver.)") is not a sibling
        const enOf = (id) => nameKey(splitModelLabel(id.replace(/\s*\((?:GQ|Thunderbolt Ver\.|Origin)\)$|\/Origin$/i, "")).name);
        if (ids.some((id) => enOf(id) === enOf(h.id))) continue;
        const root = (r) => allModels(r).map((m) => m.split("-").slice(0, 2).join("-"));
        // a sibling shares the family root but not the model number itself (RX-78-3 vs RX-78-2;
        // "RX-105 Ξ Gundam (HF)" is the same RX-105 and is not swapped in)
        const sib = ids.findIndex((id) => ms.get(id) && root(ms.get(id)).some((x) => root(h).includes(x)) && !allModels(ms.get(id)).some((m) => hasModel(h, m)));
        if (sib >= 0) ids[sib] = h.id;
      }
      // Cross-check with a model number printed on the box; if Gunplapedia disagrees, the box wins.
      const boxHits = models.flatMap(modelLookup);
      if (boxHits.length && !ids.some((id) => models.some((m) => inFamily(ms.get(id), m)))) {
        return { ...base, method: joined.method, confidence: 0.9, ids: uniq([...pick(boxHits, { ...baseCtx, models, ck: nameKey(cleanedTop.cleaned) }).ids, ...ids]), gp: joined.title };
      }
      return { ...base, method: joined.method, confidence: joined.method === "jan" ? 0.98 : 0.95, ids: uniq(ids), gp: joined.title };
    }
    const r = cascade(name, baseCtx, { top: true, sd: Boolean(sdWork) });
    return { ...base, ...r, manualTitles, hintWorks, sdWork };
  }

  // Does any name of the MS equal the kit's cleaned name? (decides SD originals' role)
  // ("機兵伝説 騎士ガンダム", "LEGEND BB 武者頑駄無": the SD line label is not part of the name)
  const SD_LABEL = /機兵伝説|LEGEND\s*BB|SDW\s*HEROES|SD\s*CS/gi;
  const namesKit = (rec, r) => {
    const ks = new Set([r.cleaned, r.core, nfkc(r.cleaned || "").replace(SD_LABEL, " "), nfkc(r.core || "").replace(SD_LABEL, " ")].map((s) => nameKey(s || "")).filter(Boolean));
    return rec ? uniq([...rec.names.ja, ...rec.names.en]).some((nm) => ks.has(nameKey(nm))) : false;
  };
  // An MS record that is itself an SD original (Musha Gundam Mk-II, Shin Musha Gundam, Knight Gundam).
  // (Musha Gundam Mk-II is a Build Fighters Try suit, but its name already says 武者)
  const isSdRecord = (rec) =>
    Boolean(rec && (rec.timeline === "SD" || (rec.works.length && rec.works.every((w) => workById.get(w)?.timeline === "SD")) || [...rec.names.ja, ...rec.names.en].some((n) => /武者|頑駄無|騎士|Musha|Knight/i.test(n))));

  function roleFor(kit, cls, result, msId) {
    if (cls === "figure") return "figure";
    if (result.accessory) return "accessory_for";
    const sdTarget = isSdRecord(ms.get(msId)) && ["jan", "gunplapedia_name", "name_exact"].includes(result.method);
    if (result.sdWork && !sdTarget && result.method !== "override" && result.method !== "name_suffix" && !namesKit(ms.get(msId), result)) return "sd_character";
    if (result.ids.length > 1) {
      if (result.set || isSetName(kit.names?.ja || "")) return "set_member";
      // A model number printed on the box names the main MS ("MG MS-06S ザクII" lists MS-06F too).
      const boxed = result.ids.filter((id) => result.models.some((m) => hasModel(ms.get(id), m)));
      if (boxed.length === 1) return boxed[0] === msId ? "main" : "set_member";
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
    const r = cls === "merch" ? { method: "skipped", ids: [], hintWorks: [], manualTitles: [], models: [] } : matchKit(kit, cls);
    if (cls === "merch" && overrides[kit.kit_id]) Object.assign(r, { method: "override", confidence: 1, ids: overrides[kit.kit_id].map(resolveId).filter(Boolean), cleaned: "" });
    rows.push({ kit, cls, r });
    if (r.ids.length) {
      links[kit.kit_id] = r.ids.slice(0, 8).map((id) => {
        const link = { ms: id, role: roleFor(kit, cls, r, id), method: r.method, confidence: r.confidence };
        if (r.variant) link.variant = r.variant;
        return link;
      });
    }
    if (EXPLAIN?.test(nfkc(kit.names?.ja || ""))) console.log("[kit]", kit.kit_id, kit.names.ja, "|", r.cleaned, "| models", r.models, "| sd", r.sdWork || "-", "|", r.method, "->", (links[kit.kit_id] || []).map((l) => `${l.ms} [${l.role}]`).join(" ; "));
    // kit -> work: WEB取説 > SD original line > matched MS debut > legacy series bucket
    const official = uniq((r.manualTitles || []).map((t) => workOfManual.get(t)));
    if (official.length) {
      kitWorks[kit.kit_id] = official;
      kitWorkSource[kit.kit_id] = "manual";
    } else if (r.sdWork && workById.has(r.sdWork)) {
      kitWorks[kit.kit_id] = [r.sdWork];
      kitWorkSource[kit.kit_id] = "sd_line";
    } else {
      const debut = uniq(r.ids.map((id) => ms.get(id)?.debut));
      // A plain "ザク" box linked by name to the GQuuuuuuX page "MS-06 Zaku" (a page that only got
      // its work from "Debut" on 2026-11-09) is not a GQuuuuuuX kit: when the only debut is
      // GQuuuuuuX and the kit gives no sign of it, its own series wins. (THE ORIGIN, Thunderbolt and
      // Doan's Island pages are left as they were: their kits name the version.)
      const legacy = workOfLegacy.get(kit.series?.key);
      const retellingOnly =
        debut.length &&
        debut.every((w) => w === "gquuuuuux") &&
        legacy &&
        !debut.includes(legacy) &&
        !(r.hintWorks || []).some((w) => debut.includes(w));
      if (debut.length && !retellingOnly) {
        kitWorks[kit.kit_id] = debut.slice(0, 3);
        kitWorkSource[kit.kit_id] = "ms_debut";
      } else if (workOfLegacy.get(kit.series?.key)) {
        kitWorks[kit.kit_id] = [workOfLegacy.get(kit.series.key)];
        kitWorkSource[kit.kit_id] = "legacy_series";
      }
    }
  }

  // ---------------------------------------------------------------- names from kits
  // Wiki pages without kanji and MS without a GGET Korean name take the majority name of the
  // kits that are clearly that MS (single main link by override / JAN / exact name / model).
  const derivedJa = new Map();
  const derivedKo = new Map();
  for (const x of rows) {
    const ls = links[x.kit.kit_id];
    if (!ls || ls.length !== 1 || ls[0].role !== "main" || !["override", "jan", "gunplapedia_name", "name_exact", "model"].includes(x.r.method) || x.r.truncated) continue;
    const id = ls[0].ms;
    const core = nfkc(x.r.core || "").replace(/\s+/g, " ").trim();
    if (hasJapanese(core) && core.length >= 2) (derivedJa.get(id) || derivedJa.set(id, []).get(id)).push(core);
    const ko = koMsName(x.kit.names?.ko || "");
    if (ko) (derivedKo.get(id) || derivedKo.set(id, []).get(id)).push(ko);
  }

  // ---------------------------------------------------------------- stats
  const plastic = rows.filter((x) => x.cls === "plastic");
  const figures = rows.filter((x) => x.cls === "figure");
  const modelRows = rows.filter((x) => x.cls !== "merch");
  const matched = (arr) => arr.filter((x) => x.r.ids.length).length;
  const rowById = new Map(rows.map((x) => [x.kit.kit_id, x]));
  const msKits = new Map();
  for (const [kitId, ls] of Object.entries(links)) {
    const cls = rowById.get(kitId)?.cls;
    for (const l of ls) {
      const e = msKits.get(l.ms) || { plastic: 0, any: 0 };
      e.any++;
      if (cls === "plastic" && l.role !== "accessory_for" && l.role !== "sd_character") e.plastic++;
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
  const realPlastic = plastic.filter((x) => !x.r.sdWork);
  const sdPlastic = plastic.filter((x) => x.r.sdWork);
  const stats = {
    kits_total: rows.length,
    kits_model: modelRows.length,
    kits_merch_skipped: rows.length - modelRows.length,
    plastic: { total: plastic.length, matched: matched(plastic), pct: pct(matched(plastic), plastic.length) },
    plastic_excl_sd_originals: { total: realPlastic.length, matched: matched(realPlastic), pct: pct(matched(realPlastic), realPlastic.length) },
    sd_original_plastic: { total: sdPlastic.length, linked_as_sd_character_or_main: matched(sdPlastic) },
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
      weak_model_only: weakLinks.length,
      gget_only_records: ggetOnly.size,
      name_conflicts: ggetConflicts.length,
      with_plastic_kit: roster.units.filter((u) => unitHasKit(u)).length,
      with_any_kit: roster.units.filter((u) => unitHasKit(u, "any")).length,
    },
    gget_series: {
      "10 Mobile Suit Gundam": seriesCoverage(10),
      "3000 SEED": seriesCoverage(3000),
      "3700 00": seriesCoverage(3700),
      "5010 Witch from Mercury": seriesCoverage(5010),
    },
    ms_internal: ms.size,
    ms_overview_pages_folded: Object.keys(msRedirects).length,
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
  const queue = realPlastic
    .filter((x) => !x.r.ids.length)
    .map((x) => ({ kit_id: x.kit.kit_id, name: x.kit.names.ja, grade: x.kit.grade_code, cleaned: x.r.cleaned, work: (kitWorks[x.kit.kit_id] || [])[0] || null, candidates: candidates(x.r) }));
  const checks = rows
    .filter((x) => x.r.review && x.r.ids.length)
    .map((x) => ({ kit_id: x.kit.kit_id, name: x.kit.names.ja, ms: x.r.ids, reason: x.r.review }));

  // ---------------------------------------------------------------- outputs
  const sourcesOf = (doc) => (doc?.sources || []).map((s) => withCrawlPolicy({ ...s, snapshot: doc.updated_at }));
  const sources = [
    ...sourcesOf(wiki),
    ...sourcesOf(gp),
    ...sourcesOf(roster),
    ...sourcesOf(manual),
    { name: "Gunpula catalogue (data/kits.json)", url: "https://github.com/mdefitko777/Gunpula", licence: "Project data; product names © BANDAI SPIRITS. Korean/Japanese MS names marked names_src 'kit' are taken from these product names. names_src 'translit' marks an unofficial Korean reading generated from the Japanese name (lexicon learned from GGET's official Korean names).", snapshot: catalog.updated_at },
    { name: "Hobby Atlas kit overrides (data/atlas/gundam-overrides.json)", url: "https://github.com/mdefitko777/Gunpula/blob/main/data/atlas/gundam-overrides.json", licence: "Hand-maintained by the project" },
  ];
  const keep = (rec) => rec.gget.length || msKits.has(rec.id) || rec.works.length;
  // Lexicon of official Korean MS words learned from GGET's ja/ko unit names.
  const koLexicon = buildKoLexicon(roster.units.filter((u) => u.names.ja && u.names.ko).map((u) => ({ ja: u.names.ja, ko: u.names.ko })));
  const msOut = [...ms.values()]
    .filter(keep)
    .sort((a, b) => (a.src === b.src ? a.id.localeCompare(b.id) : a.src === "gundamwiki" ? -1 : 1))
    .map((rec) => {
      const o = { id: rec.id, model_numbers: [...rec.models] };
      const names = {};
      const namesSrc = {};
      let ja = rec.wikiJa || (rec.primaryUnit?.strength === "strong" ? rec.gget_names?.ja : null);
      // EW pages often share the TV kanji: keep GGET's "ウイングガンダムゼロ(EW版)" so both are told apart
      if (rec.wikiJa && pageIsEw(rec) && !isEw(rec.wikiJa) && rec.primaryUnit?.strength === "strong" && isEw(rec.gget_names?.ja || "")) ja = rec.gget_names.ja;
      if (ja) names.ja = ja;
      else if (majority(derivedJa.get(rec.id) || [])) {
        names.ja = majority(derivedJa.get(rec.id));
        namesSrc.ja = "kit";
      }
      const en = rec.src === "gundamwiki" ? rec.names.en[0] : rec.gget_names?.en;
      if (en) names.en = en;
      const fromUnit = rec.primaryUnit?.strength === "strong";
      if (fromUnit && rec.gget_names?.ko) names.ko = rec.gget_names.ko;
      else if (majority(derivedKo.get(rec.id) || [])) {
        names.ko = majority(derivedKo.get(rec.id));
        namesSrc.ko = "kit";
      }
      // last resort for MS that have kits: a Korean reading of the Japanese name (unofficial)
      if (!names.ko && names.ja && msKits.has(rec.id)) {
        const t = transliterateKo(names.ja, koLexicon);
        if (t) {
          names.ko = t;
          namesSrc.ko = "translit";
        }
      }
      if (fromUnit && rec.gget_names?.zh) names.zh = rec.gget_names.zh;
      o.names = names;
      if (Object.keys(namesSrc).length) o.names_src = namesSrc;
      if (rec.gget.length) o.gget_ids = rec.gget.map((g) => g.u.id);
      if (rec.icon) o.icon = rec.icon;
      if (rec.works.length) o.works = rec.works;
      if (rec.debut) o.debut_work = rec.debut;
      if (rec.timeline) o.timeline = rec.timeline;
      if (rec.variantWork && rec.variantWork !== "media") o.variant_of_work = rec.variantWork;
      return o;
    });

  // Guards: refuse to overwrite on a large drop in linked kits or localized names.
  const linkCount = Object.keys(links).length;
  const prevCount = previousLinks ? Object.keys(previousLinks.links || {}).length : 0;
  const nameCount = (list, lang) => (list || []).filter((m) => m.names?.[lang]).length;
  const drops = [];
  if (prevCount && linkCount < MIN_LINK_RATIO * prevCount) drops.push(`linked kits ${prevCount} -> ${linkCount}`);
  for (const lang of ["ko", "zh", "ja"]) {
    const before = nameCount(previousMs?.ms, lang);
    const after = nameCount(msOut, lang);
    if (before && after < MIN_NAME_RATIO * before) drops.push(`MS with names.${lang} ${before} -> ${after}`);
  }
  if (drops.length && process.env.ATLAS_FORCE !== "1") {
    console.error(`[build] ${drops.join("; ")}; refusing to overwrite (set ATLAS_FORCE=1 to accept)`);
    process.exitCode = 1;
    return;
  }

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
    ms_redirects: msRedirects,
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
      model: "model number in the kit name (RXF-91改 -> the 改 member of the family)",
      pilot_custom: "<pilot>専用<MS>: pilot table or a page naming the pilot (variant noted); base MS when neither exists (listed in the review queue)",
      set_split: "set name split into members; each member runs the name cascade",
      name_contains: "longest specific MS name contained in the kit name",
      name_suffix: "short box name that ends a full MS name (e.g. バンシィ・ノルン)",
      name_prefix: "long box name that starts a full MS name (e.g. ユニコーンガンダム2号機 -> ...2号機・バンシィ)",
    },
    roles: {
      main: "the kit is this MS",
      set_member: "one of several MS in the kit",
      accessory_for: "parts / effects / weapons for this MS",
      figure: "finished figure (ROBOT魂, METAL BUILD, MSE ...) of this MS",
      sd_character: "SD original character (BB戦士 三国伝, 武者, 騎士, SDW HEROES) whose design borrows this MS",
    },
    links,
    kit_works: kitWorks,
    stats,
  };
  const queueDoc = {
    schema: 1,
    updated_at: today(),
    sources,
    count: queue.length,
    note: "Unmatched plastic kits (SD original characters excluded). Fix by adding {kit_id: [ms id]} to gundam-overrides.json 'kits'. 'checks' are low-confidence links, 'gget_conflicts' are MS records holding GGET units with different base names, 'gget_weak_links' are units attached by model number alone.",
    kits: queue,
    checks,
    gget_conflicts: ggetConflicts,
    gget_weak_links: weakLinks,
  };

  const outs = await Promise.all([
    writeCompactJson(P("gundam-ms.json"), msDoc),
    writeCompactJson(P("gundam-kit-ms.json"), linkDoc),
    writeCompactJson(P("gundam-review-queue.json"), queueDoc),
  ]);
  for (const o of outs) console.log(`[build] ${o.written ? "wrote" : "unchanged"} ${path.basename(o.path)} ${(o.bytes / 1024).toFixed(0)} KB`);
  console.log(JSON.stringify(stats, null, 1));

  if (process.env.ATLAS_DEBUG_FILE) {
    const dbg = rows.map((x) => ({ id: x.kit.kit_id, g: x.kit.grade_code, cls: x.cls, name: x.kit.names.ja, cleaned: x.r.cleaned, m: x.r.method, ms: x.r.ids, roles: (links[x.kit.kit_id] || []).map((l) => l.role), works: kitWorks[x.kit.kit_id], hint: x.r.hintWorks, sd: x.r.sdWork || undefined }));
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
