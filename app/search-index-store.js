export function ingestSearchIndex(target, doc, franchise = null) {
  const records = doc?.records || [];
  if (!target.searchIndex) {
    target.searchIndex = { schema_version: 1, updated_at: doc?.updated_at || null, records: [] };
  }
  const byId = new Map((target.searchIndex.records || []).map((record) => [record.kit_id, record]));
  for (const record of records) {
    byId.set(record.kit_id, record);
    target.searchIndexByKit.set(record.kit_id, record);
  }
  target.searchIndex.records = [...byId.values()];
  target.searchIndex.updated_at = doc?.updated_at || target.searchIndex.updated_at;
  if (franchise) target.loadedSearchFranchises.add(franchise);
}
