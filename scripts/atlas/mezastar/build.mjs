#!/usr/bin/env node
// Build data/atlas/mezastar-intl.json and data/atlas/mezastar-jp.json (Hobby Atlas, Pokémon MEZASTAR).
//
//   node scripts/atlas/mezastar/build.mjs [--edition=all|intl|jp] [--kr-popups=new|all|none]
//                                         [--out=data/atlas] [--report=<file>] [--reassign-ids]
//
// Env: ATLAS_CACHE_DIR (raw response cache, default tmp/atlas-cache/mezastar, never committed),
//      ATLAS_OFFLINE=1 (cache only), ATLAS_BULBA_SEED_DIR (snapshot used if Bulbapedia is blocked).
// A source that fails (blocked / down / suspiciously small) never wipes data: its contribution is
// carried over from the previous output file and its status is recorded in "sources".
// Ids are stable (lib/ids.mjs): the previous file is the id registry, re-keys become "aliases",
// and the build refuses to write a file with duplicate ids or with a published id that no longer
// resolves. --reassign-ids ignores the previous ids (only for files that were never published).

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { CACHE_DIR, BlockedError, backoffReport, blockedHosts, hostOldest, hostReport, USER_AGENT } from "./lib/http.mjs";
import { prune, readJsonMaybe, uniq, writeCompactJson } from "./lib/util.mjs";
import { checkOutput, finaliseIds, makeRegistry } from "./lib/ids.mjs";
import { loadPokeApi, POKEAPI_SOURCE } from "./lib/pokeapi.mjs";
import { fetchTW, TW_SOURCE } from "./sources/tw.mjs";
import { fetchHK, HK_SOURCE } from "./sources/hk.mjs";
import { fetchKR, KR_SOURCE, mergeSupport } from "./sources/kr.mjs";
import { fetchCN, CN_SOURCE } from "./sources/cn.mjs";
import { fetchJP, JP_SOURCE } from "./sources/jp.mjs";
import { fetchBulba, BULBA_SOURCE, bulbaStatus } from "./sources/bulba.mjs";
import { loadMezastarDex, MD_SOURCE, MD_BULBA_SOURCE } from "./sources/mezastardex.mjs";
import { mergeIntl, EDITION_INTL } from "./merge-intl.mjs";
import { mergeJp, EDITION_JP } from "./merge-jp.mjs";
import { addSimplifiedNames } from "../pokemon_zh_names.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const EDITIONS = (args.edition || "all") === "all" ? ["intl", "jp"] : [args.edition];
const OUT = path.resolve(args.out || "data/atlas");
const FILES = { intl: path.join(OUT, "mezastar-intl.json"), jp: path.join(OUT, "mezastar-jp.json") };
const REASSIGN = args["reassign-ids"] === "1";
const now = new Date().toISOString();
const log = (...a) => console.error("[mezastar]", ...a);

async function attempt(name, fn) {
  const t0 = Date.now();
  try {
    const data = await fn();
    log(`${name}: ok${data?.stale ? " (stale cache)" : ""} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return { ok: true, data, status: data?.stale ? "stale-cache" : "ok" };
  } catch (e) {
    const blocked = e instanceof BlockedError || /blocked|challenge/i.test(e.message);
    log(`${name}: ${blocked ? "BLOCKED" : "FAILED"} ${e.message}`);
    return { ok: false, data: null, status: blocked ? "blocked" : "failed", error: e.message.slice(0, 300) };
  }
}

const src = (meta, res, extra = {}) => prune({
  name: meta.name, url: meta.url, licence: meta.licence, role: meta.role, status: res ? res.status : "ok", error: res?.error,
  // oldest raw response used for this source (cached responses keep their original fetch time)
  fetched_at: res && res.ok && !/seed|vendored/.test(res.status) ? hostOldest(meta.fetch_host || new URL(meta.url).hostname) || now : undefined,
  ...extra,
});

// Test hook: ATLAS_SIMULATE_FAIL=TC,KR makes those sources fail (checks the keep-previous-data path).
const SIMULATE_FAIL = new Set((process.env.ATLAS_SIMULATE_FAIL || "").split(",").filter(Boolean));

// ---------------------------------------------------------------- shared helpers
function recount(sets, tags, regions) {
  for (const s of sets) {
    const inSet = tags.filter((t) => t.sets.includes(s.id));
    const c = { total: inSet.length };
    for (const t of inSet) c[t.kind] = (c[t.kind] || 0) + 1;
    c.by_region = {};
    for (const r of regions) {
      const n = inSet.filter((t) => t.printings.some((p) => p.region === r && (!p.sets || p.sets.includes(s.id)))).length;
      if (n) c.by_region[r] = n;
    }
    s.counts = c;
  }
}

function sortTags(sets, tags, kindOrder) {
  const ord = new Map(sets.map((s) => [s.id, s.ordinal]));
  const key = (t) => [Math.min(...t.sets.map((s) => ord.get(s) ?? 999)), kindOrder[t.kind] ?? 9, /^\d-\d-\d{3}$/.test(t.serial || "") ? Number(t.serial.slice(-3)) : 0, t.id];
  return tags
    .map((t) => [key(t), t])
    .sort((a, b) => { for (let i = 0; i < 4; i++) if (a[0][i] !== b[0][i]) return a[0][i] < b[0][i] ? -1 : 1; return 0; })
    .map(([, t]) => t);
}

/** Carry over the contribution of failed regions / grade sources from the previous output. */
function overlayPrevious(prev, cur, failed) {
  const notes = [];
  if (!prev || !failed.size) return notes;
  const curSets = new Map(cur.sets.map((s) => [s.id, s]));
  for (const ps of prev.sets || []) {
    let cs = curSets.get(ps.id);
    if (!cs) {
      if (!ps.releases.some((r) => failed.has(r.region))) continue;
      cs = structuredClone(ps);
      cs.releases = ps.releases.filter((r) => failed.has(r.region));
      cur.sets.push(cs);
      curSets.set(cs.id, cs);
      notes.push(`set ${ps.id} kept from previous run`);
      continue;
    }
    for (const r of ps.releases) if (failed.has(r.region) && !cs.releases.some((x) => x.region === r.region)) cs.releases.push(r);
    for (const [lang, reg] of [["zh_hant", "TC"], ["ko", "KR"], ["en", "EN"]]) if (failed.has(reg) && ps.names?.[lang] && !cs.names?.[lang]) cs.names[lang] = ps.names[lang];
  }
  const curTags = new Map(cur.tags.map((t) => [t.id, t]));
  let kept = 0, keptTags = 0;
  for (const pt of prev.tags || []) {
    const keep = pt.printings.filter((p) => failed.has(p.region));
    let ct = curTags.get(pt.id);
    if (!ct) {
      if (!keep.length) continue;
      ct = structuredClone(pt);
      ct.printings = keep;
      cur.tags.push(ct);
      curTags.set(ct.id, ct);
      keptTags++;
      continue;
    }
    for (const p of keep) if (!ct.printings.some((x) => x.id === p.id)) { ct.printings.push(p); kept++; }
    ct.sets = uniq([...ct.sets, ...(keep.length ? pt.sets : [])]);
    for (const [reg, lang] of [["TC", "zh_hant"], ["KR", "ko"], ["EN", "en"]]) {
      // the previous name came from that region's official printing -> restore it
      const official = pt.printings.some((p) => p.region === reg && !p.src && p.name === pt.names?.[lang]);
      if (failed.has(reg) && official) {
        ct.names[lang] = pt.names[lang];
        ct.names_derived = (ct.names_derived || []).filter((l) => l !== lang);
        if (!ct.names_derived.length) delete ct.names_derived;
      }
    }
    if (failed.has("EN") && pt.form && !pt.form_src) {
      // the form (and the form-specific types) came from the official EN name
      if (!ct.form || ct.form === pt.form) { ct.form = pt.form; delete ct.form_src; ct.types = pt.types; }
    }
    for (const reg of ["TC", "KR"]) {
      // the form came from that region's official name ("武道熊師（連擊流）"): restore it with the
      // form-specific types and the form-aware fallback names
      if (!failed.has(reg) || pt.form_src !== `${reg} name` || (ct.form && ct.form !== pt.form)) continue;
      const was = ct.form;
      ct.form = pt.form;
      ct.form_src = pt.form_src;
      if (was !== pt.form) {
        ct.types = pt.types;
        for (const l of pt.names_derived || []) if ((ct.names_derived || []).includes(l)) ct.names[l] = pt.names[l];
      }
    }
    const lost = (pt.anomalies || []).filter((a) => [...failed].some((r) => a.startsWith(`${r} `)) && !(ct.anomalies || []).includes(a));
    if (lost.length) ct.anomalies = [...(ct.anomalies || []), ...lost];
    const gradeFailed = (failed.has("KR") && pt.grade_src?.startsWith("KR")) || (failed.has("CN") && pt.grade_src?.startsWith("CN"));
    if (gradeFailed && ct.grade_src !== "KR" && pt.grade) { ct.grade = pt.grade; ct.grade_src = pt.grade_src; ct.grade_group ||= pt.grade_group; }
    if (failed.has("TC") && pt.orientation && !ct.orientation) ct.orientation = pt.orientation;
  }
  if (kept || keptTags) notes.push(`${kept} printings and ${keptTags} tags kept from previous run for ${[...failed].join(",")}`);
  return notes;
}

// Change detection ignores timestamps and free-text error messages (a source's status still counts).
const stableJson = (o) => JSON.stringify({ ...o, updated_at: null, sources: (o.sources || []).map(({ fetched_at, error, seed_snapshot_at, ...s }) => s) });

async function writeIfChanged(file, out, prev, idCheckPrev) {
  // names.zh (Simplified) next to the sources' zh_hant, before comparing with the previous file
  const zh = addSimplifiedNames(out);
  if (zh.missing.length) log(`${path.basename(file)}: no Simplified name for ${zh.missing.length}: ${zh.missing.slice(0, 10).join(", ")}`);
  const errors = checkOutput(out, idCheckPrev);
  if (errors.length) {
    for (const e of errors.slice(0, 20)) log(`${path.basename(file)}: ID CHECK FAILED: ${e}`);
    log(`${path.basename(file)}: not written (previous file kept)`);
    process.exitCode = 1;
    return { changed: false, id_check_failed: errors, ...(prev ? await sizeOf(prev) : {}) };
  }
  if (prev && stableJson(prev) === stableJson(out)) {
    log(`${path.basename(file)}: unchanged`);
    return { changed: false, ...(await sizeOf(prev)) };
  }
  const r = await writeCompactJson(file, out);
  log(`${path.basename(file)}: written ${r.bytes} bytes (gzip ${r.gzip})`);
  return { changed: true, ...r };
}
async function sizeOf(o) {
  const { gzipSync } = await import("node:zlib");
  const t = JSON.stringify(o);
  return { bytes: Buffer.byteLength(t) + 1, gzip: gzipSync(t).length };
}

function metrics(out, regions) {
  const m = { sets: [], tags: out.tags.length, by_kind: {}, missing_names: {}, derived_names: {}, images: {}, anomalies: { tags_with: 0, total: 0, by_type: {} } };
  for (const s of out.sets) m.sets.push({ id: s.id, ordinal: s.ordinal, releases: Object.fromEntries(s.releases.map((r) => [r.region, `${r.local_name} @ ${r.date || "?"}`])), counts: s.counts });
  for (const t of out.tags) {
    m.by_kind[t.kind] = (m.by_kind[t.kind] || 0) + 1;
    for (const l of ["ko", "ja", "en", "zh_hant"]) {
      if (!t.names?.[l]) m.missing_names[l] = (m.missing_names[l] || 0) + 1;
      if ((t.names_derived || []).includes(l)) m.derived_names[l] = (m.derived_names[l] || 0) + 1;
    }
    if (t.anomalies?.length) {
      m.anomalies.tags_with++;
      m.anomalies.total += t.anomalies.length;
      for (const a of t.anomalies) {
        const k = a.replace(/'[^']*'/g, "'…'").replace(/#\d+/g, "#n").replace(/★\d/g, "★n").replace(/\b\d-\d-\d{3}G?\b|R-\d-\d/g, "<serial>").replace(/[A-Za-z]+\/[A-Za-z]+(\/[A-Za-z]+)?/g, "<types>").slice(0, 70);
        m.anomalies.by_type[k] = (m.anomalies.by_type[k] || 0) + 1;
      }
    }
  }
  for (const s of out.sets) if (s.anomalies?.length) m.anomalies.set_level = (m.anomalies.set_level || 0) + s.anomalies.length;
  for (const r of regions) {
    const ps = out.tags.flatMap((t) => t.printings.filter((p) => p.region === r));
    m.images[r] = { printings: ps.length, front: ps.filter((p) => p.img_front).length, back: ps.filter((p) => p.img_back).length, thumb: ps.filter((p) => p.img_thumb).length };
  }
  m.with_stats = out.tags.filter((t) => t.stats).length;
  m.with_types = out.tags.filter((t) => t.types?.length).length;
  m.with_dex = out.tags.filter((t) => t.dex).length;
  m.with_grade = out.tags.filter((t) => t.grade).length;
  return m;
}

// ---------------------------------------------------------------- main
const report = { started_at: now, user_agent: USER_AGENT, cache_dir: CACHE_DIR, editions: {} };
const prev = { intl: await readJsonMaybe(FILES.intl), jp: await readJsonMaybe(FILES.jp) };

const pokeRes = await attempt("pokeapi", loadPokeApi);
if (!pokeRes.ok) {
  log("PokeAPI unavailable: keeping previous files untouched");
  process.exit(0);
}
const poke = pokeRes.data;
const md = await loadMezastarDex();
const bul = await attempt("bulbapedia", fetchBulba);
const bulStatus = bul.ok ? (bulbaStatus.seed ? (bulbaStatus.live ? "partly-seed" : "blocked-used-seed-snapshot") : bul.status) : bul.status;
const bulExtra = bulbaStatus.seed ? { error: bulbaStatus.error?.slice(0, 200), seed_snapshot_at: bulbaStatus.seededAt } : {};

if (EDITIONS.includes("intl")) {
  const known = new Map();
  for (const t of prev.intl?.tags || []) for (const p of t.printings) {
    const idx = Number((p.url || "").match(/idx=(\d+)/)?.[1]);
    if (p.region === "KR" && idx) known.set(idx, { img_front: p.img_front, img_back: p.img_back });
  }
  const res = {
    TC: await attempt("tw", fetchTW),
    EN: await attempt("hk", fetchHK),
    KR: await attempt("kr", () => fetchKR({ known, popups: args["kr-popups"] || "new" })),
    CN: await attempt("cn", fetchCN),
  };
  for (const k of SIMULATE_FAIL) if (res[k]) Object.assign(res[k], { ok: false, data: null, status: "failed", error: "simulated failure (ATLAS_SIMULATE_FAIL)" });
  // Guard against silent layout changes: a region that suddenly yields far fewer rows counts as failed.
  for (const [reg, r] of Object.entries(res)) {
    if (!r.ok || reg === "CN" || !prev.intl) continue;
    const before = prev.intl.tags.reduce((n, t) => n + t.printings.filter((p) => p.region === reg && !p.src).length, 0);
    const rows = r.data.rows.length;
    if (before && rows < before * 0.6) { r.ok = false; r.status = "failed"; r.error = `only ${rows} rows vs ${before} printings before (layout change?)`; log(`${reg}: ${r.error}`); }
  }
  const reg = makeRegistry(prev.intl, { reassign: REASSIGN });
  const merged = mergeIntl({
    tw: res.TC.ok ? res.TC.data : null, hk: res.EN.ok ? res.EN.data : null, kr: res.KR.ok ? res.KR.data : null, cn: res.CN.ok ? res.CN.data : null,
    md, poke, launch: bul.ok ? bul.data.launch : {}, reg,
  });
  const failed = new Set(Object.entries(res).filter(([, r]) => !r.ok).map(([k]) => k));
  const carried = overlayPrevious(prev.intl, merged, failed);
  const ids = finaliseIds(merged, prev.intl, reg, { reassign: REASSIGN });
  // EN launch day of Stardust 1 comes from Bulbapedia; keep the previous value if it is unavailable
  if (!bul.ok && prev.intl) for (const s of merged.sets) for (const r of s.releases) if (!r.date) r.date = prev.intl.sets.find((x) => x.id === s.id)?.releases.find((x) => x.region === r.region)?.date || null;
  // deterministic ordinals (a set carried over from the previous run keeps its place)
  const SR = { stardust: 1, galaxy: 2 };
  const rank = (s) => { const m = s.id.match(/^mz-intl:([a-z]+?)(\d*)-(\d+)$/); return s.series === "promo" ? [1e9, 0] : [SR[s.series] ?? (Number(m?.[2]) || 50), Number(m?.[3]) || 0]; };
  merged.sets.sort((a, b) => rank(a)[0] - rank(b)[0] || rank(a)[1] - rank(b)[1]);
  merged.sets.forEach((s, i) => (s.ordinal = s.series === "promo" ? 100 : i + 1));
  const ordIdx = new Map(merged.sets.map((s) => [s.id, s.ordinal]));
  for (const t of merged.tags) {
    t.sets.sort((a, b) => ordIdx.get(a) - ordIdx.get(b));
    for (const p of t.printings) if (p.sets) p.sets.sort((a, b) => ordIdx.get(a) - ordIdx.get(b));
    const RO = { KR: 0, TC: 1, EN: 2 };
    const first = (p) => ordIdx.get((p.sets || t.sets)[0]) ?? 999;
    t.printings.sort((a, b) => RO[a.region] - RO[b.region] || first(a) - first(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  const tags = sortTags(merged.sets, merged.tags, { standard: 0, regular: 1, legacy: 2, promo: 3 });
  for (const s of merged.sets) {
    s.releases.sort((a, b) => ({ KR: 0, TC: 1, EN: 2 })[a.region] - ({ KR: 0, TC: 1, EN: 2 })[b.region]);
    // fixed key order, so a name restored from the previous run does not count as a change
    s.names = Object.fromEntries(["en", "zh_hant", "ko", "ja"].filter((l) => s.names?.[l]).map((l) => [l, s.names[l]]));
  }
  recount(merged.sets, tags, ["KR", "TC", "EN"]);
  const out = prune({
    schema: 1,
    updated_at: now,
    edition: { ...EDITION_INTL, notes: [...merged.setAnomalies, ...carried].length ? [...merged.setAnomalies, ...carried] : undefined },
    sources: [
      src(TW_SOURCE, res.TC), src(HK_SOURCE, res.EN), src(KR_SOURCE, res.KR), src(CN_SOURCE, res.CN),
      src(MD_SOURCE, { ok: true, status: "vendored" }), src(POKEAPI_SOURCE, pokeRes),
      src({ ...BULBA_SOURCE, role: "Stardust Version 1 EN (HK) launch date" }, { ...bul, status: bulStatus }, bulExtra),
    ],
    sets: merged.sets,
    tags,
    aliases: merged.aliases,
    // 서포트 포켓몬 티켓: the KR site's current list (kept from the previous run when unreadable) + the
    // curated earlier tickets, with move / type / dex from scripts/atlas/mezastar/support-kr.json
    support_tickets: mergeSupport(
      (res.KR.ok && res.KR.data.support?.length ? res.KR.data.support : prev.intl?.support_tickets?.filter((t) => t.status === "current")) || [],
      JSON.parse(await readFile(new URL("./support-kr.json", import.meta.url), "utf8")).tickets,
    ),
  });
  out.updated_at = now;
  const w = await writeIfChanged(FILES.intl, out, prev.intl, REASSIGN ? null : prev.intl);
  report.editions.intl = { file: FILES.intl, ...w, kr_popups: res.KR.ok ? res.KR.data.popups : null, sources: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.status + (r.error ? `: ${r.error}` : "")])), carried, ids, metrics: metrics(out, ["KR", "TC", "EN"]) };
}

if (EDITIONS.includes("jp")) {
  // The JP edition is frozen and cannot be rebuilt without Bulbapedia: do not even fetch the
  // archive (20 pages) when Bulbapedia is unavailable and a previous file exists.
  const jpRes = !bul.ok && prev.jp ? { ok: false, status: "not fetched (Bulbapedia unavailable)" } : await attempt("jp-archive", fetchJP);
  const usable = jpRes.ok && bul.ok;
  if (!usable && prev.jp) {
    log("JP: a required source is unavailable; previous mezastar-jp.json kept unchanged (edition is frozen)");
    report.editions.jp = { file: FILES.jp, changed: false, kept_previous: true, sources: { archive: jpRes.status, bulbapedia: bulStatus }, metrics: metrics(prev.jp, ["JA"]), ...(await sizeOf(prev.jp)) };
  } else if (!jpRes.ok) {
    log("JP: official archive unavailable and no previous file; skipping");
    report.editions.jp = { skipped: true, error: jpRes.error };
  } else {
    const reg = makeRegistry(prev.jp, { reassign: REASSIGN });
    const merged = mergeJp({ jp: jpRes.data, bulba: bul.ok ? bul.data : null, md, poke, reg });
    const ids = finaliseIds(merged, prev.jp, reg, { reassign: REASSIGN });
    const tags = sortTags(merged.sets, merged.tags, { standard: 0, gorgeous: 1, legacy: 2, promo: 3 });
    recount(merged.sets, tags, ["JA"]);
    const out = prune({
      schema: 1,
      updated_at: now,
      edition: EDITION_JP,
      sources: [
        src(JP_SOURCE, jpRes), src(BULBA_SOURCE, { ...bul, status: bulStatus }, bulExtra), src(MD_BULBA_SOURCE, { ok: true, status: "vendored" }), src(POKEAPI_SOURCE, pokeRes),
      ],
      sets: merged.sets,
      tags,
      aliases: merged.aliases,
    });
    out.updated_at = now;
    const w = await writeIfChanged(FILES.jp, out, prev.jp, REASSIGN ? null : prev.jp);
    report.editions.jp = { file: FILES.jp, ...w, sources: { archive: jpRes.status, bulbapedia: bulStatus }, ids, metrics: metrics(out, ["JA"]) };
  }
}

report.blocked_hosts = blockedHosts();
report.backoff = backoffReport();
report.hosts = hostReport();
report.bulbapedia = { status: bulStatus, ...bulbaStatus };
const reportFile = args.report || path.join(CACHE_DIR, "report.json");
await mkdir(path.dirname(reportFile), { recursive: true });
await writeFile(reportFile, JSON.stringify(report, null, 1));
log(`report: ${reportFile}`);
log(`blocked hosts: ${report.blocked_hosts.join(", ") || "none"}`);
