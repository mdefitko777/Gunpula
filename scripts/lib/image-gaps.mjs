// Records known to have no picture we may use (data/image-gaps.json), read by
// scripts/check_image_health.mjs. Each one is listed by hand with the reason, like the line covers'
// LINE_COVER_GAPS: the check still fails for any other record without a working picture, so a cache
// that breaks or a new source that drops its pictures shows up, while a product whose shop has
// only dead or refused links does not fail the weekly run forever.
import { readFile } from "node:fs/promises";

export const IMAGE_GAPS_PATH = "data/image-gaps.json";

/** { kit_id: reason text } from the file; an absent file lists nothing. */
export async function loadImageGaps(file = IMAGE_GAPS_PATH) {
  let data;
  try {
    data = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
  const reasons = data.reasons || {};
  return Object.fromEntries(Object.entries(data.kits || {}).map(([kitId, key]) => [kitId, reasons[key] || key]));
}

/**
 * Splits the records without a working picture into the ones that fail the check and the listed
 * gaps, and names the listed records that have a working picture again (`recovered`, can come off
 * the list) or are no longer in the catalog (`gone`).
 */
export function sortImageGaps({ missing, checkedIds, catalogIds, gaps }) {
  const missingIds = new Set(missing.map((item) => item.kit_id));
  const failing = missing.filter((item) => !gaps[item.kit_id]);
  const known = missing.filter((item) => gaps[item.kit_id]).map((item) => ({ ...item, reason: gaps[item.kit_id] }));
  const listed = Object.keys(gaps);
  return {
    failing,
    known,
    recovered: listed.filter((kitId) => checkedIds.has(kitId) && !missingIds.has(kitId)),
    gone: listed.filter((kitId) => !catalogIds.has(kitId)),
  };
}
