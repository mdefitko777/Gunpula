// Merge the international edition (one serial space shared by EN/HK, TC/TW, KR, SC/CN) into
// mezastar-intl.json. Join key: printed serial (1-1-001, R-1-1); legacy and promo tags have no
// serial and are joined by (set, species) or kept per region with stable synthetic ids.
import { nfkc, pad3, sha8, uniq } from "./lib/util.mjs";

export const EDITION_INTL = {
  id: "mz-intl",
  name: { en: "Pokémon MEZASTAR (international, 2025-)", ko: "포켓몬태그스타", zh_hant: "寶可夢MEZASTAR", ja: "ポケモンメザスタ（海外版）" },
  regions: {
    EN: { label: "EN (HK/SG/MY/ID)", printed_suffix: "EN", lang: "en" },
    TC: { label: "TC (Taiwan)", printed_suffix: "TC", lang: "zh_hant" },
    KR: { label: "KR (Korea)", printed_suffix: "KR", lang: "ko" },
  },
  id_scheme: "mz-intl:<serial> for numbered tags (1-v-NNN, 2-v-NNN, R-s-n); mz-intl:L-s-v-n legacy (community code where known); mz-intl:P-<code> promos (community code, or P-TC-<image hash> for TW-only promos)",
};

const SERIES = { 1: "stardust", 2: "galaxy" };
const SERIES_EN = { stardust: "Stardust", galaxy: "Galaxy" };
const seriesSlug = (s) => SERIES[s] || `series${s}`;
const STD = /^(\d)-(\d)-(\d{3})$/;
const REG = /^R-(\d)-(\d)$/;
const KIND_ORDER = { standard: 0, regular: 1, legacy: 2, promo: 3 };
const REGION_LANG = { EN: "en", TC: "zh_hant", KR: "ko" };

function setKeyOf(rows) {
  const c = new Map();
  for (const r of rows) {
    const m = r.serial.match(STD);
    if (m) c.set(`${m[1]}-${m[2]}`, (c.get(`${m[1]}-${m[2]}`) || 0) + 1);
  }
  if (!c.size) return null;
  const [k] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  const [S, V] = k.split("-").map(Number);
  return { S, V, id: `mz-intl:${seriesSlug(S)}-${V}`, series: seriesSlug(S) };
}

function groupFromHeading(h) {
  const s = nfkc(h || "");
  if (/^superstar/i.test(s) || /슈퍼스타/.test(s)) return "superstar";
  if (/^star\b/i.test(s) || /^스타태그/.test(s)) return "star";
  if (/★\s*2\s*[~～〜-]\s*4/.test(s) || /^태그\s*\(★[234]\)/.test(s)) return "normal";
  if (/regular/i.test(s) || /레귤러/.test(s)) return "regular";
  if (/legacy|레거시|레전시|經典/i.test(s)) return "legacy";
  return null;
}
const gradeFromHeading = (h) => Number((nfkc(h || "").match(/★\s*(\d)\s*\)?$/) || [])[1]) || null;
const groupFromGrade = (g) => (g === 6 ? "superstar" : g === 5 ? "star" : g >= 2 && g <= 4 ? "normal" : null);
const imgHash = (url) => {
  const f = (url || "").split("/").pop().replace(/\.\w+$/, "");
  return /^[0-9a-f]{16,}$/i.test(f) ? f.slice(0, 8).toLowerCase() : sha8(url || "");
};

export function mergeIntl({ tw, hk, kr, cn, md, poke, launch = {} }) {
  const sets = new Map(); // id -> set
  const tags = new Map(); // id -> tag
  const setAnoms = new Map();
  const anomalyOfSet = (sid, a) => { if (!setAnoms.has(sid)) setAnoms.set(sid, []); setAnoms.get(sid).push(a); };

  const ensureSet = (key) => {
    if (!sets.has(key.id)) {
      sets.set(key.id, {
        id: key.id, series: key.series, S: key.S, V: key.V,
        names: key.series === "promo" ? { en: "Promo tags", zh_hant: "MEZASTAR活動卡匣" } : { en: `${SERIES_EN[key.series] || `Series ${key.S}`} Version ${key.V}` },
        releases: [],
      });
    }
    return sets.get(key.id);
  };
  const PROMO_KEY = { id: "mz-intl:promo", series: "promo", S: 99, V: 0 };

  const ensureTag = (id, init) => {
    if (!tags.has(id)) tags.set(id, { id, sets: new Set(), printings: [], anomalies: [], ev: { grade: {}, dex: [] }, names: {}, ...init });
    return tags.get(id);
  };
  const addPrinting = (tag, setId, p) => {
    tag.sets.add(setId);
    const same = tag.printings.find((x) => x.region === p.region && (x.img_front || "") === (p.img_front || "") && (x.variant || "") === (p.variant || ""));
    if (same) { same.sets.add(setId); return same; }
    const np = { ...p, sets: new Set([setId]) };
    tag.printings.push(np);
    return np;
  };

  // ---- pages -> sets (+ releases) ------------------------------------------------------
  const pageSet = { TC: new Map(), EN: new Map(), KR: new Map() };
  if (tw) {
    for (const s of tw.seasons) {
      const rows = tw.rows.filter((r) => r.page === s.id);
      const key = setKeyOf(rows) || (rows.length && rows.every((r) => /^[PＰ]$/.test(r.serial)) ? PROMO_KEY : null);
      if (!key) { anomalyOfSet("_", `TW season ${s.id} (${s.title}) could not be mapped to a set`); continue; }
      const set = ensureSet(key);
      pageSet.TC.set(s.id, set.id);
      if (key !== PROMO_KEY) set.names.zh_hant = s.title_raw;
      set.releases.push({ region: "TC", local_name: s.title_raw, date: s.date, url: s.url, checklist: s.pdf });
    }
  }
  if (hk) {
    const launches = hk.events.filter((e) => e.kind === "launch");
    for (const p of hk.pages) {
      const rows = hk.rows.filter((r) => r.page === (p.pageId || "current"));
      const key = setKeyOf(rows);
      if (!key) { anomalyOfSet("_", `HK page ${p.pageId || "current"} (${p.label}) could not be mapped to a set`); continue; }
      const set = ensureSet(key);
      pageSet.EN.set(p.pageId || "current", set.id);
      const ev = launches.find((e) => e.series === key.series && e.version === key.V);
      let date = ev ? ev.date : null, dateUrl = ev ? ev.url : null;
      if (!date && key.S === 1 && key.V === 1 && launch.hk) date = launch.hk; // launch day (Bulbapedia infobox)
      set.releases.push({ region: "EN", local_name: p.label || p.switcher_label, date, url: p.url, news: dateUrl });
    }
  }
  if (kr) {
    for (const s of kr.sets) {
      const rows = kr.rows.filter((r) => r.page === s.cate);
      const key = setKeyOf(rows);
      if (!key) { anomalyOfSet("_", `KR cate=${s.cate} (${s.label}) could not be mapped to a set`); continue; }
      const set = ensureSet(key);
      pageSet.KR.set(s.cate, set.id);
      set.names.ko = s.label;
      set.releases.push({ region: "KR", local_name: s.label, date: s.date, url: s.url, checklist: s.list_img });
    }
  }
  // HK legacy events -> EN release of the set that was current at the time
  if (hk) {
    for (const e of hk.events.filter((x) => x.kind === "legacy")) {
      let target = null;
      if (e.series) target = [...sets.values()].find((s) => s.series === e.series && s.V === e.version);
      if (!target) {
        target = [...sets.values()]
          .map((s) => ({ s, d: s.releases.find((r) => r.region === "EN")?.date }))
          .filter((x) => x.d && x.d <= e.date)
          .sort((a, b) => (a.d < b.d ? 1 : -1))[0]?.s;
      }
      const rel = target && target.releases.find((r) => r.region === "EN");
      if (rel) { rel.legacy_date = e.date; rel.legacy_news = e.url; }
    }
  }

  // ---- numbered tags -----------------------------------------------------------------
  const numberedKind = (serial) => (STD.test(serial) ? "standard" : REG.test(serial) ? "regular" : null);
  const unnumbered = []; // {region, setId, row}
  const regionRows = [
    ...(tw ? tw.rows.map((r) => ({ ...r, setId: pageSet.TC.get(r.page) })) : []),
    ...(hk ? hk.rows.map((r) => ({ ...r, setId: pageSet.EN.get(r.page) })) : []),
    ...(kr ? kr.rows.map((r) => ({ ...r, setId: pageSet.KR.get(r.page) })) : []),
  ];
  const krSeen = new Set();
  for (const r of regionRows) {
    if (!r.setId) continue;
    if (r.region === "KR") {
      // the KR page repeats some tags in a "recommended" block; keep only rows under grade headings
      const g = groupFromHeading(r.heading);
      if (!g) {
        if (!regionRows.some((x) => x.region === "KR" && x.idx === r.idx && groupFromHeading(x.heading))) anomalyOfSet(r.setId, `KR idx=${r.idx} '${r.serial} ${r.name}' under unknown heading '${r.heading}'`);
        continue;
      }
      if (krSeen.has(`${r.page}|${r.idx}`)) continue;
      krSeen.add(`${r.page}|${r.idx}`);
    }
    const kind = numberedKind(r.serial);
    if (!kind) { unnumbered.push(r); continue; }
    const tag = ensureTag(`mz-intl:${r.serial}`, { serial: r.serial, kind });
    if (r.region === "TC") {
      tag.orientation ||= r.orientation;
      addPrinting(tag, r.setId, { region: "TC", name: r.name, img_front: r.img_front, img_back: r.img_back });
    } else if (r.region === "EN") {
      const g = groupFromHeading(r.heading);
      if (g) tag.ev.group_en = g;
      else if (r.heading) tag.anomalies.push(`EN heading '${r.heading}' not recognised`);
      const fileSerial = (r.img_front || "").match(/pm_en_(R-\d-\d|\d-\d-\d{3})_f\./);
      if (fileSerial && fileSerial[1] !== r.serial) tag.anomalies.push(`EN image file is named ${fileSerial[1]} but the tag is listed as ${r.serial}`);
      addPrinting(tag, r.setId, { region: "EN", name: r.name, img_front: r.img_front });
    } else if (r.region === "KR") {
      const g = groupFromHeading(r.heading);
      tag.ev.group_kr = g;
      const kg = gradeFromHeading(r.heading);
      if (kg) tag.ev.grade.KR = kg;
      addPrinting(tag, r.setId, { region: "KR", name: r.name, img_front: r.img_front || r.img_thumb, img_back: r.img_back, img_thumb: r.img_thumb, url: r.url });
    }
  }

  // ---- CN rows (exact grade); assigned to tags after species resolution ---------------
  const cnRows = cn ? cn.rows.filter((r) => r.serial) : [];

  // ---- unnumbered: legacy + promo -----------------------------------------------------
  const mdLegacy = [...md.intl.entries()].filter(([k]) => k.startsWith("L-"));
  const mdPromo = [...md.intl.entries()].filter(([k]) => k.startsWith("P-"));
  const dexOfEn = (n) => poke.resolveEn(n)?.dex || null;
  const dexOfLocal = (n, lang) => poke.resolveLocal(n, lang)?.dex || null;
  const legacyRows = unnumbered.filter((r) => /經典|legacy|레거시|레전시/i.test(r.serial + " " + (r.heading || "")));
  const promoRows = unnumbered.filter((r) => /^[PＰ]$/.test(r.serial));
  for (const r of unnumbered) if (!legacyRows.includes(r) && !promoRows.includes(r)) anomalyOfSet(r.setId, `${r.region} entry '${r.serial_raw}' '${r.name}' has an unrecognised serial`);

  const legacyCounter = new Map();
  for (const r of legacyRows) {
    const set = sets.get(r.setId);
    const dex = dexOfLocal(r.name, REGION_LANG[r.region]) || dexOfEn(r.name);
    // existing legacy tag in this set with the same species (another region already created it)?
    let tag = [...tags.values()].find((t) => t.kind === "legacy" && t.sets.has(r.setId) && t.ev.dex.some((d) => d.dex === dex));
    if (!tag) {
      const code = mdLegacy.find(([k, v]) => k.startsWith(`L-${set.S}-${set.V}-`) && dexOfEn(v.name) === dex);
      let id;
      if (code) id = `mz-intl:${code[0]}`;
      else {
        const used = new Set([...tags.keys()].filter((k) => k.startsWith(`mz-intl:L-${set.S}-${set.V}-`)));
        for (const [k] of mdLegacy) if (k.startsWith(`L-${set.S}-${set.V}-`)) used.add(`mz-intl:${k}`);
        let n = (legacyCounter.get(set.id) || 0) + 1;
        while (used.has(`mz-intl:L-${set.S}-${set.V}-${n}`)) n++;
        legacyCounter.set(set.id, n);
        id = `mz-intl:L-${set.S}-${set.V}-${n}`;
      }
      tag = ensureTag(id, { serial: null, kind: "legacy", code: code ? code[1].md_id : null, code_source: code ? "mezastar-dex" : "synthetic (TW order)" });
      if (!code) tag.anomalies.push("no community code known; id synthesised from the TW list order");
    }
    if (dex) tag.ev.dex.push({ src: r.region, dex });
    tag.orientation ||= r.orientation;
    addPrinting(tag, r.setId, { region: r.region, name: r.name, img_front: r.img_front || r.img_thumb, img_back: r.img_back, img_thumb: r.img_thumb, url: r.url });
  }
  // community legacy codes without an official listing -> EN printing (community data)
  for (const [k, v] of mdLegacy) {
    const m = k.match(/^L-(\d)-(\d)-(\d+)$/);
    const key = { S: Number(m[1]), V: Number(m[2]), id: `mz-intl:${seriesSlug(Number(m[1]))}-${m[2]}`, series: seriesSlug(Number(m[1])) };
    const set = ensureSet(key);
    const tag = ensureTag(`mz-intl:${k}`, { serial: null, kind: "legacy", code: v.md_id, code_source: "mezastar-dex" });
    addPrinting(tag, set.id, { region: "EN", name: v.name, src: "community" });
  }

  const promoSet = ensureSet(PROMO_KEY);
  for (const r of promoRows) {
    const id = `mz-intl:P-${r.region}-${imgHash(r.img_front)}`;
    const tag = ensureTag(id, { serial: "P", kind: "promo", code_source: "synthetic (official image hash)" });
    tag.orientation ||= r.orientation;
    if (r.serial_raw !== "P") tag.anomalies.push(`${r.region} serial printed as '${r.serial_raw}'`);
    addPrinting(tag, r.setId || promoSet.id, { region: r.region, name: r.name, img_front: r.img_front, img_back: r.img_back });
  }
  for (const [k, v] of mdPromo) {
    const tag = ensureTag(`mz-intl:${k}`, { serial: "P", kind: "promo", code: v.md_id, code_source: "mezastar-dex" });
    tag.promo_variant = (v.rarity.match(/\(([^)]+)\)/) || [])[1] || null;
    addPrinting(tag, promoSet.id, { region: "EN", name: v.name, src: "community" });
  }

  // ---- per-tag enrichment: dex, names, grade, types, stats ---------------------------
  for (const tag of tags.values()) {
    const pr = (region) => tag.printings.find((p) => p.region === region && p.src !== "community");
    const en = pr("EN")?.name, tc = pr("TC")?.name, ko = pr("KR")?.name;
    const local = tag.id.replace(/^mz-intl:/, "");
    const mdx = md.intl.get(local);
    const enC = tag.printings.find((p) => p.region === "EN")?.name || mdx?.name;
    const cands = [];
    if (en) { const r = poke.resolveEn(en); if (r) cands.push({ src: "EN", ...r }); else tag.anomalies.push(`EN name '${en}' not found in PokeAPI`); }
    if (tc) { const r = poke.resolveLocal(tc, "zh_hant"); if (r) cands.push({ src: "TC", dex: r.dex }); else tag.anomalies.push(`TC name '${tc}' not found in PokeAPI`); }
    if (ko) { const r = poke.resolveLocal(ko, "ko"); if (r) cands.push({ src: "KR", dex: r.dex }); else tag.anomalies.push(`KR name '${ko}' not found in PokeAPI`); }
    if (!en && enC) { const r = poke.resolveEn(enC); if (r) cands.push({ src: "community", ...r }); }
    const pick = cands[0] || null;
    tag.dex = pick ? pick.dex : null;
    // Official EN names often omit the form ("Zacian" on a Crowned Sword tag); take it from the
    // community name when that resolves to the same species.
    const mdRes = mdx?.name ? poke.resolveEn(mdx.name) : null;
    const offForm = cands.find((c) => c.form && c.src !== "community")?.form || null;
    tag.form = offForm || (mdRes && mdRes.dex === (pick && pick.dex) ? mdRes.form : null) || null;
    if (tag.form && !offForm) tag.form_src = "mezastar-dex";
    const dexes = uniq(cands.map((c) => c.dex));
    if (dexes.length > 1) tag.anomalies.push(`regions disagree on the species: ${cands.map((c) => `${c.src}=#${c.dex}`).join(", ")}`);
    if (!tag.dex) tag.anomalies.push("species not resolved");

    // names: official per region first, PokeAPI species name as fallback
    const name = (lang, official) => official || (tag.dex ? poke.name(tag.dex, lang) : null);
    tag.names = { ko: name("ko", ko), ja: name("ja", null), en: en || enC || name("en", null), zh_hant: name("zh_hant", tc) };
    tag.names_derived = ["ko", "ja", "en", "zh_hant"].filter((l) => tag.names[l] && !(l === "ko" ? ko : l === "en" ? en || enC : l === "zh_hant" ? tc : null));

    // validate every official printing name against PokeAPI
    if (tag.dex) {
      for (const p of tag.printings) {
        const lang = REGION_LANG[p.region];
        if (p.name && !poke.nameAgrees(tag.dex, lang, p.name)) tag.anomalies.push(`${p.region} name '${p.name}' does not contain PokeAPI ${lang} '${poke.name(tag.dex, lang)}'`);
      }
      if (mdx && mdx.name && poke.resolveEn(mdx.name)?.dex && poke.resolveEn(mdx.name).dex !== tag.dex) tag.anomalies.push(`mezastar-dex has '${mdx.name}' for this id`);
    }

  }

  // ---- CN: exact grade. Rows are keyed by serial; a serial listed twice (CN data-entry error) is
  // resolved by species: the row whose zh-Hans name matches the tag stays, the other one is moved to
  // the tag of the same set that CN does not list and whose species matches.
  const cnBySerial = new Map();
  for (const r of cnRows) {
    if (!cnBySerial.has(r.serial)) cnBySerial.set(r.serial, []);
    cnBySerial.get(r.serial).push(r);
  }
  const cnAssigned = new Map(); // tag id -> row
  for (const [serial, rows] of cnBySerial) {
    const tag = tags.get(`mz-intl:${serial}`);
    if (!tag) continue; // SC-only rows are not emitted
    const fits = (r) => tag.dex && poke.nameAgrees(tag.dex, "zh_hans", r.name);
    const primary = rows.length > 1 ? rows.find(fits) || rows[0] : rows[0];
    cnAssigned.set(tag.id, primary);
    for (const r of rows.filter((x) => x !== primary)) {
      const prefix = serial.slice(0, 4);
      const dex = poke.resolveLocal(r.name, "zh_hans")?.dex;
      const target = [...tags.values()].find((t) => t.kind === "standard" && t.serial.startsWith(prefix) && !cnBySerial.has(t.serial) && !cnAssigned.has(t.id) && t.dex === dex);
      if (target) {
        cnAssigned.set(target.id, r);
        target.anomalies.push(`CN lists this tag under serial ${serial} ('${r.code_raw}' ${r.name}); reassigned by species`);
        tag.anomalies.push(`CN lists serial ${serial} twice; the '${r.name}' row belongs to ${target.serial}`);
      } else tag.anomalies.push(`CN lists serial ${serial} twice ('${rows.map((x) => x.name).join("' / '")}')`);
    }
  }
  for (const tag of tags.values()) {
    const c = cnAssigned.get(tag.id);
    if (!c) continue;
    if (c.grade) tag.ev.grade.CN = c.grade;
    if (!c.code_clean && c.serial === tag.serial) tag.anomalies.push(`CN codeNumber '${c.code_raw}' is malformed (normalised to ${c.serial})`);
    if (tag.dex && !poke.nameAgrees(tag.dex, "zh_hans", c.name)) tag.anomalies.push(`CN name '${c.name}' differs from PokeAPI zh-Hans '${poke.name(tag.dex, "zh_hans")}'`);
  }

  for (const tag of tags.values()) {
    const local = tag.id.replace(/^mz-intl:/, "");
    const mdx = md.intl.get(local);
    // grade + grade group
    if (mdx?.grade) tag.ev.grade.MD = mdx.grade;
    const G = tag.ev.grade;
    if (tag.kind === "standard") {
      tag.grade = G.KR ?? G.CN ?? G.MD ?? null;
      tag.grade_src = G.KR ? "KR" : G.CN ? "CN" : G.MD ? "mezastar-dex" : null;
      const vals = Object.entries(G).filter(([, v]) => v);
      if (uniq(vals.map(([, v]) => v)).length > 1) tag.anomalies.push(`grade sources disagree: ${vals.map(([k, v]) => `${k}=★${v}`).join(", ")}`);
      const grp = tag.ev.group_en || tag.ev.group_kr || groupFromGrade(tag.grade);
      if (!tag.grade && (grp === "superstar" || grp === "star")) { tag.grade = grp === "superstar" ? 6 : 5; tag.grade_src = "grade group"; }
      tag.grade_group = grp;
      if (tag.grade && groupFromGrade(tag.grade) !== grp) tag.anomalies.push(`grade ★${tag.grade} does not fit grade group '${grp}'`);
    } else {
      tag.grade = null;
      tag.grade_group = tag.kind;
    }

    // types: curated pool.json, else PokeAPI form-aware types
    const pool = md.poolTypes.get(local);
    // Mega / Gigantamax / Dynamax / Primal are in-battle changes: the tag keeps the base types
    // (same convention as Bulbapedia's JP set lists).
    const typeForm = /^(mega( [xy])?|gigantamax|dynamax|primal)$/i.test(tag.form || "") ? null : tag.form;
    const api = tag.dex ? poke.typesFor(tag.dex, typeForm) : [];
    tag.types = pool && pool.length ? uniq(pool) : api;
    tag.types_src = pool && pool.length ? "mezastar-dex pool" : api.length ? "PokeAPI" : null;
    if (pool && pool.length && api.length && uniq(pool).join("/") !== api.join("/") && !poke.typeCombos(tag.dex).includes(uniq(pool).join("/")))
      tag.anomalies.push(`types: pool.json ${uniq(pool).join("/")} vs PokeAPI ${api.join("/")}`);

    if (mdx) {
      tag.stats = mdx.stats;
      tag.move = mdx.move;
      tag.move2 = mdx.move2;
      tag.gimmick = mdx.gimmick || null;
    }
  }

  // ---- finalise sets ------------------------------------------------------------------
  const ordered = [...sets.values()].sort((a, b) => a.S - b.S || a.V - b.V);
  ordered.forEach((s, i) => (s.ordinal = s.series === "promo" ? 100 : i + 1));
  const REG_ORDER = { KR: 0, TC: 1, EN: 2 };
  const outSets = ordered.map((s) => {
    const inSet = [...tags.values()].filter((t) => t.sets.has(s.id));
    const byKind = {};
    for (const t of inSet) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
    const byRegion = {};
    for (const reg of ["KR", "TC", "EN"]) {
      const n = inSet.filter((t) => t.printings.some((p) => p.region === reg && p.sets.has(s.id))).length;
      if (n) byRegion[reg] = n;
    }
    return {
      id: s.id, ordinal: s.ordinal, series: s.series, names: s.names,
      releases: s.releases.sort((a, b) => REG_ORDER[a.region] - REG_ORDER[b.region]),
      counts: { total: inSet.length, ...byKind, by_region: byRegion },
      anomalies: setAnoms.get(s.id),
    };
  });

  const ordOf = new Map(ordered.map((s) => [s.id, s.ordinal]));
  const outTags = [...tags.values()]
    .map((t) => {
      const setsSorted = [...t.sets].sort((a, b) => ordOf.get(a) - ordOf.get(b));
      // printing ids: <tag>@<region>[:<first set of that printing>][:variant]
      const perRegion = {};
      for (const p of t.printings) perRegion[p.region] = (perRegion[p.region] || 0) + 1;
      const printings = t.printings
        .sort((a, b) => REG_ORDER[a.region] - REG_ORDER[b.region] || ordOf.get([...a.sets][0]) - ordOf.get([...b.sets][0]))
        .map((p) => {
          const pSets = [...p.sets].sort((a, b) => ordOf.get(a) - ordOf.get(b));
          const suffix = perRegion[p.region] > 1 ? `:${pSets[0].replace(/^mz-intl:/, "")}` : "";
          return {
            id: `${t.id}@${p.region}${suffix}`,
            region: p.region, name: p.name, img_front: p.img_front, img_back: p.img_back, img_thumb: p.img_thumb && p.img_thumb !== p.img_front ? p.img_thumb : undefined,
            sets: setsSorted.length > 1 ? pSets : undefined, url: p.url, src: p.src,
          };
        });
      return {
        id: t.id, serial: t.serial, code: t.code, kind: t.kind, grade: t.grade, grade_src: t.grade_src, grade_group: t.grade_group,
        dex: t.dex, form: t.form, form_src: t.form_src, types: t.types, orientation: t.orientation, names: t.names, names_derived: t.names_derived,
        sets: setsSorted, printings, stats: t.stats, move: t.move, move2: t.move2, gimmick: t.gimmick, promo_variant: t.promo_variant,
        code_source: t.code_source, anomalies: uniq(t.anomalies),
        _sort: [ordOf.get(setsSorted[0]) ?? 999, KIND_ORDER[t.kind], t.serial && STD.test(t.serial) ? Number(t.serial.slice(-3)) : 0, t.id],
      };
    })
    .sort((a, b) => {
      for (let i = 0; i < 4; i++) if (a._sort[i] !== b._sort[i]) return a._sort[i] < b._sort[i] ? -1 : 1;
      return 0;
    })
    .map(({ _sort, ...t }) => t);

  return { sets: outSets, tags: outTags, setAnomalies: setAnoms.get("_") || [] };
}

export const _test = { setKeyOf, groupFromHeading, gradeFromHeading, imgHash, pad3 };
