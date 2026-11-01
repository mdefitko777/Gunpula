// Backup file format (settings › data › export/import collection backup).
//
// The cloud payload only carries the collection; the BBX owned parts, the BBX
// kit→top manual map, the Gundam guide cells lit by hand and the recent-viewed
// list live in this device's localStorage only. They travel under
// `local_state`, the same object Hobby Atlas reads in
// UserStore.previewImport (lib/data/user_store.dart ImportPreview.parse):
//   local_state.bbx_owned_parts  string[]  part_id
//   local_state.bbx_manual_map   {kit_id: base_set_id}
//   local_state.guide_manual_lit number[]  gget unit_id
//   local_state.recent_viewed    string[]  kit_id
// Secrets (github_token, sessions, sync config) are never written to the file.

const RECENT_VIEWED_LIMIT = 20;

function stringList(value) {
  return Array.isArray(value) ? [...new Set(value.filter((v) => typeof v === "string" && v))] : [];
}

function unitIdList(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  for (const v of value) {
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
    if (Number.isInteger(n)) ids.add(n);
  }
  return [...ids];
}

function stringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (key && (typeof v === "string" || typeof v === "number") && String(v)) out[key] = String(v);
  }
  return out;
}

// Iterables/Maps from app state → the plain JSON local_state object.
export function buildLocalState({ bbxOwnedParts, bbxManualMap, guideManualLit, recentViewed } = {}) {
  const manual = bbxManualMap instanceof Map ? Object.fromEntries(bbxManualMap) : bbxManualMap;
  return {
    bbx_owned_parts: stringList([...(bbxOwnedParts || [])]).sort(),
    bbx_manual_map: stringMap(manual),
    guide_manual_lit: unitIdList([...(guideManualLit || [])]).sort((a, b) => a - b),
    recent_viewed: stringList([...(recentViewed || [])]).slice(0, RECENT_VIEWED_LIMIT),
  };
}

export function buildBackupPayload({ exportedAt, app, cloud, localState }) {
  const payload = {
    exported_at: exportedAt,
    app,
    ...cloud,
    local_state: buildLocalState(localState),
  };
  delete payload.github_token;
  return payload;
}

// Reads local_state back from a backup (ours or Hobby Atlas'). Returns null
// when the file predates local_state so callers leave device data untouched.
export function parseBackupLocalState(payload) {
  const local = payload?.local_state;
  if (!local || typeof local !== "object" || Array.isArray(local)) return null;
  return {
    bbxOwnedParts: stringList(local.bbx_owned_parts),
    bbxManualMap: stringMap(local.bbx_manual_map),
    guideManualLit: unitIdList(local.guide_manual_lit),
    recentViewed: stringList(local.recent_viewed).slice(0, RECENT_VIEWED_LIMIT),
  };
}
