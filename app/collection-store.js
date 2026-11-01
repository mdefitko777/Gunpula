const normalizedCollections = new WeakSet();

// The catalog retires duplicate kit_ids (a Premium Bandai resale page folded
// into the BANDAI SPIRITS kit, a Tamashii lottery page into the figure …) and
// publishes old id -> surviving id in data/split/kit-aliases.json. Saved
// entries follow the alias, so nothing a member owns or wants goes missing.
export function resolveKitAlias(aliases, kitId) {
  if (!aliases || typeof aliases !== "object") return kitId;
  let current = kitId;
  for (let hops = 0; hops < 20 && Object.prototype.hasOwnProperty.call(aliases, current); hops += 1) {
    const next = aliases[current];
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

/** A kit_id -> entry map with retired ids moved to their surviving id (newer entry wins). */
export function remapKitEntries(items = {}, aliases = null) {
  if (!aliases || !items || typeof items !== "object") return items;
  const remapped = {};
  for (const [kitId, entry] of Object.entries(items)) {
    const target = resolveKitAlias(aliases, kitId);
    remapped[target] = remapped[target] ? newerByTimestamp(remapped[target], entry) : entry;
  }
  return remapped;
}

export function safeMemberName(value) {
  return String(value || "member").trim() || "member";
}

export function clampCollectionQuantity(value) {
  const quantity = Math.trunc(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.min(quantity, 99);
}

export function timestampMs(...values) {
  for (const value of values) {
    const time = Date.parse(value || "");
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

export function newerByTimestamp(left, right, fields = ["updated_at"]) {
  const leftTime = timestampMs(...fields.map((field) => left?.[field]));
  const rightTime = timestampMs(...fields.map((field) => right?.[field]));
  return leftTime >= rightTime ? left : right;
}

function numericValue(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCollectionEntry(entry, options = {}) {
  const statuses = options.statuses || ["owned", "wanted", "deleted"];
  const now = options.now || new Date().toISOString();
  const member = safeMemberName(options.member);
  const normalized = {
    status: statuses.includes(entry?.status) ? entry.status : "wanted",
    updated_at: entry?.updated_at || now,
    updated_by: entry?.updated_by || member,
    quantity: clampCollectionQuantity(entry?.quantity ?? entry?.wanted_quantity ?? 1),
  };
  if (entry?.note) normalized.note = String(entry.note);
  if (entry?.storage) normalized.storage = String(entry.storage);
  const purchasePrice = numericValue(entry?.purchase_price);
  if (purchasePrice !== null) normalized.purchase_price = Math.round(purchasePrice);
  return normalized;
}

export function normalizeCollection(collection = {}, options = {}) {
  if (collection && typeof collection === "object" && normalizedCollections.has(collection)) return collection;
  const statuses = options.statuses || ["owned", "wanted", "deleted"];
  const self = safeMemberName(options.self);
  const droppedMembers = options.droppedMembers || new Set();
  const kitAliases = options.kitAliases || null;
  const memberMerges = options.memberMerges || {};
  const legacyItems = collection.items && typeof collection.items === "object" ? { ...collection.items } : {};
  const memberItems = collection.member_items && typeof collection.member_items === "object" ? structuredClone(collection.member_items) : {};
  const now = new Date().toISOString();

  for (const kitId of Array.isArray(collection.owned) ? collection.owned : []) {
    legacyItems[kitId] ||= { status: "owned", updated_at: now, updated_by: "local" };
  }
  for (const kitId of Array.isArray(collection.wanted) ? collection.wanted : []) {
    legacyItems[kitId] ||= { status: "wanted", quantity: 1, updated_at: now, updated_by: "local" };
  }

  if (Object.keys(memberItems).length === 0) {
    for (const [kitId, entry] of Object.entries(legacyItems)) {
      if (!entry?.status) continue;
      memberItems[self] ||= {};
      memberItems[self][kitId] = entry;
    }
  }

  const normalizedMemberItems = {};
  for (const [member, memberMap] of Object.entries(memberItems)) {
    let memberKey = safeMemberName(member);
    if (!memberKey || !memberMap || typeof memberMap !== "object" || droppedMembers.has(memberKey)) continue;
    const mergeTarget = memberMerges[memberKey];
    if (mergeTarget && memberKey !== self) memberKey = safeMemberName(mergeTarget);
    for (const [savedKitId, entry] of Object.entries(memberMap)) {
      if (!entry?.status || !statuses.includes(entry.status)) continue;
      const kitId = resolveKitAlias(kitAliases, savedKitId);
      const normalizedEntry = normalizeCollectionEntry(entry, { statuses, now, member: memberKey });
      normalizedMemberItems[memberKey] ||= {};
      const existing = normalizedMemberItems[memberKey][kitId];
      normalizedMemberItems[memberKey][kitId] = existing ? newerByTimestamp(existing, normalizedEntry) : normalizedEntry;
    }
  }

  const owned = [];
  const wanted = [];
  const normalizedItems = {};
  for (const [kitId, entry] of Object.entries(normalizedMemberItems[self] || {})) {
    normalizedItems[kitId] = entry;
    if (entry.status === "owned") owned.push(kitId);
    if (entry.status === "wanted") wanted.push(kitId);
  }
  const result = { owned: [...new Set(owned)], wanted: [...new Set(wanted)], items: normalizedItems, member_items: normalizedMemberItems };
  normalizedCollections.add(result);
  return result;
}

export function mergeCollectionState(localCollection, remoteCollection, options = {}) {
  const local = normalizeCollection(localCollection || {}, options);
  const remote = normalizeCollection(remoteCollection || {}, options);
  const merged = { member_items: {} };
  const members = new Set([...Object.keys(local.member_items || {}), ...Object.keys(remote.member_items || {})]);
  for (const member of members) {
    const kitIds = new Set([...Object.keys(local.member_items?.[member] || {}), ...Object.keys(remote.member_items?.[member] || {})]);
    for (const kitId of kitIds) {
      const next = newerByTimestamp(local.member_items?.[member]?.[kitId], remote.member_items?.[member]?.[kitId]);
      if (!next) continue;
      merged.member_items[member] ||= {};
      merged.member_items[member][kitId] = next;
    }
  }
  return normalizeCollection(merged, options);
}

export function mergeTimestampedMap(localMap = {}, remoteMap = {}) {
  const merged = {};
  for (const key of new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})])) {
    const next = newerByTimestamp(localMap?.[key], remoteMap?.[key], ["updated_at", "hidden_at", "reviewed_at"]);
    if (next && Object.keys(next).length) merged[key] = next;
  }
  return merged;
}
