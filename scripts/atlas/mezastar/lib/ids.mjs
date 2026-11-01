// Stable ids. The app stores tag and printing ids in the user's collection, so an id, once
// published, must keep pointing at the same physical tag:
//
// - Rule-based ids never depend on counts, list positions or image hashes (see README).
// - Ids that come from a heuristic (synthetic legacy ids, promo joins, numbered TW promos) are
//   sticky: the previous output acts as the registry (matched by image URL), so a re-run keeps them.
// - When a tag is re-keyed (e.g. a synthetic legacy id gets its community code), the old ids go to
//   the top-level "aliases" map {old id: new id}; aliases are kept forever.
// - An id from the previous output that is neither produced again nor aliased is carried over
//   with "delisted": true instead of disappearing.
// - checkOutput() fails the build on duplicate or malformed ids.
import { slug } from "./util.mjs";

const imgKey = (region, url) => `${region}|${url}`;

/** Registry built from the previous output file (empty when reassign is set or there is none). */
export function makeRegistry(prev, { reassign = false } = {}) {
  const reg = { enabled: !!prev && !reassign, tagByImg: new Map(), printingByImg: new Map(), printingOfImg: new Map(), prevTags: new Map(), aliases: {} };
  if (!reg.enabled) return reg;
  reg.aliases = { ...(prev.aliases || {}) };
  for (const t of prev.tags || []) {
    reg.prevTags.set(t.id, t);
    for (const p of t.printings || []) {
      for (const u of [p.img_front, p.img_back]) if (u) { reg.tagByImg.set(imgKey(p.region, u), t.id); reg.printingOfImg.set(imgKey(p.region, u), p.id); }
      if (p.img_front) reg.printingByImg.set(`${t.id}|${imgKey(p.region, p.img_front)}`, p.id);
    }
  }
  return reg;
}

/** Previous tag id of an official printing (by front, then back image), or null. */
export function stickyTag(reg, region, ...urls) {
  if (!reg?.enabled) return null;
  for (const u of urls) if (u && reg.tagByImg.has(imgKey(region, u))) return reg.tagByImg.get(imgKey(region, u));
  return null;
}

/**
 * Give every printing of one tag an id: <tag>@<region>[:<set>][:<variant>].
 * setSuffix(p) returns the set part for tags that span several sets (regular tags: always, so the
 * id does not change when a second printing appears). The previous id of the same image is reused.
 * Printings must be in their canonical order (first one of a region gets the shortest id).
 */
export function assignPrintingIds(tagId, printings, { setSuffix = () => null, reg = null } = {}) {
  const used = new Set();
  for (const p of printings) {
    const prevId = reg?.enabled && p.img_front ? reg.printingByImg.get(`${tagId}|${imgKey(p.region, p.img_front)}`) : null;
    if (prevId && !used.has(prevId) && prevId.startsWith(`${tagId}@${p.region}`)) { p.id = prevId; used.add(prevId); }
  }
  for (const p of printings) {
    if (p.id) continue;
    const v = p.variant ? `:${slug(p.variant)}` : "";
    const s = setSuffix(p);
    let id = `${tagId}@${p.region}${s ? `:${s}` : ""}${v}`;
    // a second printing of a single-set tag: name it after its set, then count
    if (used.has(id) && !s && p.set_hint) id = `${tagId}@${p.region}:${p.set_hint}${v}`;
    const base = id;
    for (let n = 2; used.has(id); n++) id = `${base}~${n}`;
    p.id = id;
    used.add(id);
  }
  return printings;
}

function allIds(out) {
  const tags = new Set(), printings = new Set();
  for (const t of out.tags) { tags.add(t.id); for (const p of t.printings) printings.add(p.id); }
  return { tags, printings };
}

/**
 * Aliases + carry-over against the previous output. Mutates `out` (adds tags/printings marked
 * delisted, sets out.aliases). Returns a summary for the build report.
 */
export function finaliseIds(out, prev, reg, { reassign = false } = {}) {
  const summary = { aliases_added: [], delisted_carried: [], dropped: [] };
  const cur = allIds(out);
  const aliases = { ...(reg.enabled ? reg.aliases : {}) };
  if (prev && reg.enabled) {
    // re-keyed official printings: same image, different id
    for (const t of out.tags) for (const p of t.printings) {
      for (const u of [p.img_front, p.img_back]) {
        // the printing itself (also when its image moved to another, still existing tag)
        const oldPr = u && reg.printingOfImg.get(imgKey(p.region, u));
        if (oldPr && oldPr !== p.id && !cur.printings.has(oldPr) && !aliases[oldPr]) aliases[oldPr] = p.id;
        const oldTag = u && reg.tagByImg.get(imgKey(p.region, u));
        if (!oldTag || oldTag === t.id || cur.tags.has(oldTag)) continue;
        aliases[oldTag] = t.id;
        for (const op of reg.prevTags.get(oldTag)?.printings || []) {
          if (cur.printings.has(op.id) || aliases[op.id]) continue;
          const same = t.printings.filter((x) => x.region === op.region && (x.variant || "") === (op.variant || ""));
          const hit = same.find((x) => op.img_front && x.img_front === op.img_front) || (same.length === 1 ? same[0] : null);
          if (hit) aliases[op.id] = hit.id;
        }
      }
    }
  }
  // collapse chains, drop aliases that point nowhere or shadow a live id
  const resolve = (id, seen = new Set()) => (aliases[id] && !seen.has(id) ? (seen.add(id), resolve(aliases[id], seen)) : id);
  for (const k of Object.keys(aliases)) {
    const target = resolve(k);
    if (cur.tags.has(k) || cur.printings.has(k) || (!cur.tags.has(target) && !cur.printings.has(target))) delete aliases[k];
    else aliases[k] = target;
  }
  if (prev) {
    const prevAliases = reg.enabled ? reg.aliases : {};
    for (const k of Object.keys(aliases)) if (!(k in prevAliases)) summary.aliases_added.push(`${k} -> ${aliases[k]}`);
    // vanished ids: carry over (delisted) unless --reassign-ids
    const byId = new Map(out.tags.map((t) => [t.id, t]));
    for (const pt of prev.tags || []) {
      const ct = byId.get(pt.id);
      if (!ct) {
        if (aliases[pt.id]) continue;
        if (reassign) { summary.dropped.push(pt.id); continue; }
        const keep = structuredClone(pt);
        keep.delisted = true;
        keep.printings = keep.printings.filter((p) => !aliases[p.id]);
        for (const p of keep.printings) p.delisted = true;
        out.tags.push(keep);
        byId.set(keep.id, keep);
        summary.delisted_carried.push(pt.id);
        continue;
      }
      for (const pp of pt.printings || []) {
        if (cur.printings.has(pp.id) || aliases[pp.id]) continue;
        if (reassign) { summary.dropped.push(pp.id); continue; }
        ct.printings.push({ ...pp, delisted: true });
        summary.delisted_carried.push(pp.id);
      }
    }
  }
  const sorted = Object.fromEntries(Object.keys(aliases).sort().map((k) => [k, aliases[k]]));
  out.aliases = Object.keys(sorted).length ? sorted : undefined;
  return summary;
}

/** Hard checks run before any file is written. Returns a list of problems (empty = ok). */
export function checkOutput(out, prev = null) {
  const errors = [];
  const tagIds = new Map(), prIds = new Map();
  for (const t of out.tags || []) {
    tagIds.set(t.id, (tagIds.get(t.id) || 0) + 1);
    for (const p of t.printings || []) {
      prIds.set(p.id, (prIds.get(p.id) || 0) + 1);
      if (!p.id || !p.id.startsWith(`${t.id}@${p.region}`)) errors.push(`printing id '${p.id}' does not start with '${t.id}@${p.region}'`);
    }
    if (!t.printings?.length) errors.push(`tag ${t.id} has no printing`);
  }
  for (const [id, n] of tagIds) if (n > 1) errors.push(`tag id ${id} appears ${n} times`);
  for (const [id, n] of prIds) if (n > 1) errors.push(`printing id ${id} appears ${n} times`);
  for (const [k, v] of Object.entries(out.aliases || {})) {
    if (tagIds.has(k) || prIds.has(k)) errors.push(`alias ${k} shadows a live id`);
    if (!tagIds.has(v) && !prIds.has(v)) errors.push(`alias ${k} -> ${v} points to no id`);
  }
  if (prev) {
    // every id published before must still resolve (live, delisted or aliased)
    const live = new Set([...tagIds.keys(), ...prIds.keys(), ...Object.keys(out.aliases || {})]);
    const lost = [];
    for (const t of prev.tags || []) { if (!live.has(t.id)) lost.push(t.id); for (const p of t.printings || []) if (!live.has(p.id)) lost.push(p.id); }
    if (lost.length) errors.push(`${lost.length} previously published ids no longer resolve: ${lost.slice(0, 10).join(", ")}${lost.length > 10 ? ", ..." : ""}`);
  }
  return errors;
}
