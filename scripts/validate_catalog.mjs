import { isDateLike, kitName, loadCatalog } from "./lib/catalog.mjs";

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
  } else if (!kit.names.en && !kit.names.zh && !kit.names.ja) {
    addError(`${context}: at least one localized name is required`);
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
