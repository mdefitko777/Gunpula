// Importers that fold one source's record into another's (import_madoka_sources.mjs:
// goodsmile.com pages into the goodsmile.info / Aniplex+ records) must leave an alias
// behind for every folded id the apps have already seen, or saved likes / owned marks,
// share links and notification payloads that carry the old id lose their product. On
// 2026-11-07 ten goodsmile.com Madoka records published the day before were folded
// without one.

/**
 * Adds `from → to` to aliasDoc.aliases for each fold whose `from` was published (a date in
 * data/kit-first-seen.json) and is gone from the catalog while `to` is in it. Existing
 * aliases and excluded ids are left as they are. Returns the added pairs as text.
 */
export function aliasPublishedFolds(aliasDoc, folded, { published, liveIds }) {
  const added = [];
  aliasDoc.aliases = aliasDoc.aliases || {};
  const excluded = aliasDoc.excluded || {};
  for (const { from, to } of folded) {
    if (from === to || !published(from) || liveIds.has(from) || !liveIds.has(to)) continue;
    if (aliasDoc.aliases[from] || excluded[from]) continue;
    aliasDoc.aliases[from] = to;
    added.push(`${from} → ${to}`);
  }
  return added;
}

/**
 * Published ids (data/kit-first-seen.json) that are neither in the catalog nor in
 * kit-aliases.json (aliases / excluded): saved entries pointing at them are stranded.
 */
export function strandedPublishedIds(firstSeenDates, liveIds, aliasDoc) {
  const aliases = aliasDoc?.aliases || {};
  const excluded = aliasDoc?.excluded || {};
  return Object.keys(firstSeenDates || {}).filter((id) => !liveIds.has(id) && !aliases[id] && !excluded[id]);
}
