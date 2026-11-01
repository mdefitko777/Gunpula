// Consistency check for data/atlas/gundam-chapters.json against the MS master and the kit links
// it was built from (offline; exit 1 on any problem):
//   node scripts/atlas/check_gundam_chapters.mjs
// - every chapter unit id is a gundam-ms.json id or listed in extra_ms (never both)
// - ms_kits keys are master ids used by some chapter; every kit id exists in data/kits.json and
//   gundam-kit-ms.json links it to that MS with role main / set_member / figure
// - every master MS used by a chapter that has such a link is present in ms_kits
// - arcs: episode_from <= episode_to, anchor inside the range, orders 1..n; episodes ascending
import path from "node:path";
import { ATLAS_DATA, readJson } from "./lib/util.mjs";

const KIT_ROLES = new Set(["main", "set_member", "figure"]);
const P = (f) => path.join(ATLAS_DATA, f);
const [doc, msDoc, kitDoc, kitsDoc] = await Promise.all([
  readJson(P("gundam-chapters.json")),
  readJson(P("gundam-ms.json")),
  readJson(P("gundam-kit-ms.json")),
  readJson(path.join(ATLAS_DATA, "..", "kits.json")),
]);

const errors = [];
const fail = (msg) => errors.length < 50 && errors.push(msg);
const master = new Set(msDoc.ms.map((m) => m.id));
const kitIds = new Set((kitsDoc.kits || []).map((k) => k.kit_id));
const linked = new Map(); // ms -> Set(kit)
for (const [kit, links] of Object.entries(kitDoc.links || {})) {
  for (const l of links) if (KIT_ROLES.has(l.role)) (linked.get(l.ms) || linked.set(l.ms, new Set()).get(l.ms)).add(kit);
}

for (const id of Object.keys(doc.extra_ms || {})) if (master.has(id)) fail(`extra_ms ${id} is a master id`);
const used = new Set();
for (const [workId, w] of Object.entries(doc.works || {})) {
  const checkUnit = (where, u) => {
    used.add(u.ms);
    if (!master.has(u.ms) && !doc.extra_ms?.[u.ms]) fail(`${workId} ${where}: unknown ms id ${u.ms}`);
  };
  w.arcs.forEach((a, i) => {
    if (a.order !== i + 1) fail(`${workId} arc ${a.id}: order ${a.order} != ${i + 1}`);
    if (a.episode_from !== null && !(a.episode_from <= a.episode_to)) fail(`${workId} arc ${a.id}: range ${a.episode_from}-${a.episode_to}`);
    if (a.anchor_episode !== null && !(a.anchor_episode >= a.episode_from && a.anchor_episode <= a.episode_to)) fail(`${workId} arc ${a.id}: anchor ${a.anchor_episode} outside ${a.episode_from}-${a.episode_to}`);
    for (const u of a.ms) {
      checkUnit(`arc ${a.id}`, u);
      if (!["ally", "enemy", "third"].includes(u.side)) fail(`${workId} arc ${a.id}: side ${u.side}`);
    }
  });
  let prev = -Infinity;
  for (const e of w.episodes) {
    if (!(e.no > prev)) fail(`${workId} episode ${e.no} not ascending`);
    prev = e.no;
    for (const u of e.ms) {
      checkUnit(`episode ${e.no}`, u);
      if (!doc.roles?.[u.role]) fail(`${workId} episode ${e.no}: role ${u.role}`);
    }
  }
}

for (const [ms, kits] of Object.entries(doc.ms_kits || {})) {
  if (!master.has(ms)) fail(`ms_kits ${ms}: not a master id`);
  if (!used.has(ms)) fail(`ms_kits ${ms}: not used by any chapter`);
  if (!kits.length) fail(`ms_kits ${ms}: empty list`);
  if (new Set(kits).size !== kits.length) fail(`ms_kits ${ms}: duplicate kit ids`);
  for (const k of kits) {
    if (!kitIds.has(k)) fail(`ms_kits ${ms}: kit ${k} not in data/kits.json`);
    if (!linked.get(ms)?.has(k)) fail(`ms_kits ${ms}: kit ${k} not linked to it in gundam-kit-ms.json`);
  }
  if (linked.get(ms) && linked.get(ms).size !== kits.length) fail(`ms_kits ${ms}: ${kits.length} kits, gundam-kit-ms.json has ${linked.get(ms).size}`);
}
for (const ms of used) if (master.has(ms) && linked.get(ms)?.size && !doc.ms_kits?.[ms]) fail(`ms ${ms} has kits but no ms_kits entry`);

if (errors.length) {
  console.error(`[check-chapters] ${errors.length} problem(s):\n  ${errors.join("\n  ")}`);
  process.exitCode = 1;
} else {
  const t = doc.stats?._totals || {};
  console.log(`[check-chapters] ok: ${Object.keys(doc.works).length} works, ${used.size} MS ids (${Object.keys(doc.ms_kits || {}).length} with kits), ${t.arcs} arcs, ${t.episodes} episodes`);
}
