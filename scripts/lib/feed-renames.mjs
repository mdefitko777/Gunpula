// A record that is "new" to data/kits.json is not always a new product. On 2026-11-10 nine
// BEYBLADE X records got new ids (beyblade-x-bx-00-116 -> beyblade-x-bx00-drgs ...): the old ids
// went into kit-aliases.json and update-feed.json listed them under `merged`, yet the new ids were
// "added" with reason "new", so the app pushed nine "새 상품" notifications for kits first seen on
// 2026-07-08. Shared by scripts/build_update_feed.mjs and scripts/atlas/build_notify_feed.mjs.

/**
 * Ids that a catalog diff of [date] folded into another id: `before` ids gone from `after`
 * whose alias points at a record that is there. Returns the set of surviving (target) ids.
 */
export function mergeTargets(beforeIds, afterIds, aliases) {
  const targets = new Set();
  for (const id of beforeIds) {
    const to = aliases?.[id];
    if (to && !afterIds.has(id) && afterIds.has(to)) targets.add(to);
  }
  return targets;
}

/**
 * Is an "added" kit of [date] a rename or a relisting rather than news? Yes when the
 * first-seen ledger (data/kit-first-seen.json) dates the id before [date] (the id was
 * published earlier, or the folding script carried the old id's date over), or when an
 * id merged into it on the same day ([targets], from mergeTargets or update-feed `merged`).
 */
export function isRenamed(kitId, date, { firstSeen = {}, targets = new Set() } = {}) {
  if (targets.has(kitId)) return true;
  const seen = firstSeen?.[kitId];
  return Boolean(seen && date && seen < date);
}

/** update-feed.json entry → ids merged into another record that day (its `merged[].merged_into`) */
export function entryMergeTargets(entry) {
  return new Set((entry?.merged || []).map((item) => item?.merged_into).filter(Boolean));
}
