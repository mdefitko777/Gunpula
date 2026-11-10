import { existsSync, readFileSync } from "node:fs";
import { GOODS_KINDS } from "./lib/catalog-cleanup.mjs";
import { isDateLike, kitName, loadCatalog } from "./lib/catalog.mjs";
import { strandedPublishedIds } from "./lib/fold-aliases.mjs";
import { HTML_ENTITY_IN_URL } from "./lib/html-url.mjs";

// Same rule as import_bandai_collectibles.mjs (MISFORMED_BEYBLADE_ID); not imported from
// there because that module pulls in the whole importer.
const MISFORMED_BEYBLADE_ID = /^beyblade-x-(?:bx|ux|cx)-\d/;

const { grades, kits, sources, gradeByCode, sourceById } = loadCatalog();
const errors = [];
const warnings = [];

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function requireType(context, field, value, expectedType) {
  if (typeof value !== expectedType) {
    addError(`${context}: ${field} must be ${expectedType}`);
  }
}

const gradeCodes = new Set();
for (const grade of grades) {
  if (gradeCodes.has(grade.code)) {
    addError(`grade ${grade.code}: duplicate grade code`);
  }
  gradeCodes.add(grade.code);

  if (grade.parent_code && !gradeByCode.has(grade.parent_code)) {
    addError(`grade ${grade.code}: unknown parent_code ${grade.parent_code}`);
  }
}

const sourceIds = new Set();
for (const source of sources) {
  if (sourceIds.has(source.source_id)) {
    addError(`source ${source.source_id}: duplicate source_id`);
  }
  sourceIds.add(source.source_id);
}

const kitIds = new Set();
for (const kit of kits) {
  const context = `kit ${kit.kit_id ?? "(missing kit_id)"}`;

  requireType(context, "kit_id", kit.kit_id, "string");
  if (typeof kit.kit_id === "string" && !/^[a-z0-9]+[a-z0-9-]*$/.test(kit.kit_id)) {
    addError(`${context}: kit_id must be lowercase slug text`);
  }
  if (kitIds.has(kit.kit_id)) {
    addError(`${context}: duplicate kit_id`);
  }
  kitIds.add(kit.kit_id);

  requireType(context, "franchise", kit.franchise, "string");
  if (!["gundam", "armored_core", "pokemon", "beyblade", "fate", "madoka", "lego"].includes(kit.franchise)) {
    addError(`${context}: franchise is invalid`);
  }

  requireType(context, "grade_code", kit.grade_code, "string");
  const grade = gradeByCode.get(kit.grade_code);
  if (!grade) {
    addError(`${context}: unknown grade_code ${kit.grade_code}`);
  }

  requireType(context, "scale", kit.scale, "string");
  if (grade && !grade.typical_scale.includes("various") && !grade.typical_scale.includes(kit.scale)) {
    addWarning(`${context}: scale ${kit.scale} is not in typical scales for ${kit.grade_code}`);
  }

  if (!kit.names || typeof kit.names !== "object") {
    addError(`${context}: names must be an object`);
  } else if (!kit.names.en && !kit.names.zh && !kit.names.ko && !kit.names.ja) {
    addError(`${context}: at least one localized name is required`);
  }

  if (!kit.images || typeof kit.images !== "object") {
    addError(`${context}: images must be an object`);
  } else {
    if (kit.images.box_art_url !== null && typeof kit.images.box_art_url !== "string") {
      addError(`${context}: images.box_art_url must be string or null`);
    }
    if (kit.images.box_art_source_id !== null && !sourceById.has(kit.images.box_art_source_id)) {
      addError(`${context}: unknown images.box_art_source_id ${kit.images.box_art_source_id}`);
    }
    if (kit.images.box_art_url && !kit.images.box_art_source_id) {
      addWarning(`${context}: box art URL has no source id`);
    }
  }

  if (kit.gallery_image_urls !== undefined) {
    if (!Array.isArray(kit.gallery_image_urls)) {
      addError(`${context}: gallery_image_urls must be an array when present`);
    } else if (kit.gallery_image_urls.some((url) => typeof url !== "string")) {
      addError(`${context}: gallery_image_urls entries must be strings`);
    }
  }

  if (!isDateLike(kit.release_date)) {
    addError(`${context}: release_date must be null, YYYY, YYYY-MM, or YYYY-MM-DD`);
  }

  if (kit.price_jpy !== null && (!Number.isInteger(kit.price_jpy) || kit.price_jpy < 0)) {
    addError(`${context}: price_jpy must be null or a non-negative integer`);
  }

  if (typeof kit.is_limited !== "boolean") {
    addError(`${context}: is_limited must be boolean`);
  }

  if (!["seed", "needs_review", "verified", "retired"].includes(kit.data_status)) {
    addError(`${context}: data_status is invalid`);
  }

  if (!Array.isArray(kit.source_urls)) {
    addError(`${context}: source_urls must be an array`);
  } else if (kit.source_urls.length === 0 && kit.data_status !== "seed") {
    addWarning(`${context}: non-seed record has no source_urls`);
  }

  if (!Array.isArray(kit.source_refs)) {
    addError(`${context}: source_refs must be an array`);
  } else {
    for (const sourceRef of kit.source_refs) {
      if (!sourceRef || typeof sourceRef !== "object") {
        addError(`${context}: source_refs entries must be objects`);
        continue;
      }

      if (!sourceById.has(sourceRef.source_id)) {
        addError(`${context}: unknown source_ref source_id ${sourceRef.source_id}`);
      }
      if (sourceRef.url !== null && typeof sourceRef.url !== "string") {
        addError(`${context}: source_ref url must be string or null`);
      }
      if (!Array.isArray(sourceRef.fields) || sourceRef.fields.length === 0) {
        addError(`${context}: source_ref fields must be a non-empty array`);
      }
      if (!["low", "medium", "high"].includes(sourceRef.confidence)) {
        addError(`${context}: source_ref confidence must be low, medium, or high`);
      }
    }

    const hasNonSeedSource = kit.source_refs.some((sourceRef) => sourceRef.source_id !== "manual_seed");
    if (kit.data_status !== "seed" && !hasNonSeedSource) {
      addWarning(`${context}: non-seed record has no external source_refs`);
    }
  }

  if (!Array.isArray(kit.tags)) {
    addError(`${context}: tags must be an array`);
  }

  // Goods (clean_catalog.mjs): category "goods" and a goods_kind the apps label.
  if (kit.goods_kind !== undefined || kit.category !== undefined) {
    if (kit.category !== "goods") addError(`${context}: category must be "goods" when present`);
    if (!GOODS_KINDS.includes(kit.goods_kind)) addError(`${context}: goods_kind ${kit.goods_kind} is not one of ${GOODS_KINDS.join(", ")}`);
  }
}

// data/kit-aliases.json lists kit_ids removed from the catalog. A listed id must
// not be back in kits.json, and an alias must lead to a record that exists.
const aliasDoc = existsSync("data/kit-aliases.json") ? JSON.parse(readFileSync("data/kit-aliases.json", "utf8")) : null;
if (aliasDoc) {
  for (const [from, to] of Object.entries(aliasDoc.aliases || {})) {
    if (kitIds.has(from)) addError(`kit-aliases: ${from} is aliased to ${to} but is still in the catalog`);
    if (!kitIds.has(to)) addError(`kit-aliases: ${from} is aliased to ${to}, which is not in the catalog`);
  }
  for (const [id, reason] of Object.entries(aliasDoc.excluded || {})) {
    if (kitIds.has(id)) addError(`kit-aliases: ${id} is excluded but still in the catalog`);
    // Goods stay in the catalog; only another franchise's / IP's records are removed.
    if (!/^wrong_franchise\b/.test(String(reason))) addError(`kit-aliases: ${id} is excluded for "${reason}"; only wrong_franchise records may be removed`);
  }
}

// Image URLs read from HTML must be decoded: "600&times;600.png" / "a&amp;b/M1.jpg" answer 404.
// BEYBLADE X ids follow data/bbx-database.json (beyblade-x-cx09, not beyblade-x-cx-09-106),
// which the apps join on for parts and bladers. Both are warnings until the next import
// has rewritten the records written before the fix (import_fate_extra_sources.mjs,
// import_bandai_collectibles.mjs).
for (const kit of kits) {
  const urls = [kit.images?.box_art_url, ...(Array.isArray(kit.gallery_image_urls) ? kit.gallery_image_urls : [])];
  const escaped = [...new Set(urls.filter((url) => typeof url === "string" && HTML_ENTITY_IN_URL.test(url)))];
  if (escaped.length) addWarning(`kit ${kit.kit_id}: image URL still HTML-escaped (${escaped[0]})`);
  if (kit.franchise === "beyblade" && MISFORMED_BEYBLADE_ID.test(kit.kit_id)) {
    addWarning(`kit ${kit.kit_id}: BEYBLADE X id is not beyblade-x-<product id> (e.g. beyblade-x-cx09)`);
  }
}

// A published id (data/kit-first-seen.json) that leaves the catalog needs an alias (or a
// wrong_franchise exclusion), or saved entries, share links and notifications pointing
// at it are stranded. Products that a source stopped listing also show up here, so this
// is a warning, summed up by id prefix.
const firstSeenDoc = existsSync("data/kit-first-seen.json") ? JSON.parse(readFileSync("data/kit-first-seen.json", "utf8")) : null;
if (firstSeenDoc) {
  const stranded = strandedPublishedIds(firstSeenDoc.dates, kitIds, aliasDoc);
  if (stranded.length) {
    const byPrefix = {};
    for (const id of stranded) {
      const prefix = /^[a-z0-9]+(?:-[a-z]+(?=-|$))?/.exec(id)?.[0] || id;
      byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
    }
    const top = Object.entries(byPrefix)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([prefix, count]) => `${prefix} ${count}`)
      .join(", ");
    addWarning(`${stranded.length} published kit_ids are gone without an alias in data/kit-aliases.json (${top}; e.g. ${stranded[0]})`);
  }
}

console.log(`Validated ${grades.length} grades, ${sources.length} sources, and ${kits.length} kits.`);

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (errors.length) {
  console.log("\nErrors:");
  for (const error of errors) {
    console.log(`- ${error}`);
  }
  process.exit(1);
}

console.log("\nCatalog OK.");
