import { readFile, writeFile } from "node:fs/promises";

// Link the G Generation 图鉴 to the catalog: for each mobile-suit unit list the
// catalog kit_ids that depict it, so a unit lights up when any matching kit is
// marked owned/wanted. This intentionally covers every GGET work instead of only
// the early SEED/00/Witch subset.
const GGET_PATH = "data/gget-units.json";
const CATALOG_PATH = "data/kits.json";
const OUTPUT_PATH = "data/gget-kit-map.json";

// Grade / scale / packaging noise that appears around the mobile-suit name in kit titles.
const NOISE = [
  /\bMGSD\b/gi, /\bMGEX\b/gi, /\bRE\s?100\b/gi, /\bMG\b/gi, /\bHG(CE|UC|BF)?\b/gi, /\bRG\b/gi, /\bPG\b/gi,
  /\bEG\b/gi, /\bFM\b/gi, /\bSDW?\b/gi, /\bSDEX\b/gi, /\bNG\b/gi, /\bGFRAME\b/gi, /\bG\s?フレーム(FA)?\b/gi,
  /\bMETAL\s?BUILD\b/gi, /\bMETAL\s?ROBOT\b/gi, /\bROBOT\s?SPIRITS\b/gi, /\bSH\s?FIGUARTS\b/gi,
  /\bFW\b/gi, /\bGUNDAM\s?CONVERGE\b/gi, /\bCONVERGE\b/gi,
  /\b1\s*\/\s*\d{2,3}\b/g, /\bMobile Suit\b/gi, /\bOption Parts?\b/gi, /\bWeapon Set\b/gi,
  /\bExpansion Set\b/gi, /\bParts Set\b/gi, /\bEffect Parts?\b/gi,
];

function normalizeName(raw) {
  let s = String(raw || "");
  s = s
    .replace(/ν/g, " Nu ")
    .replace(/Ν/g, " Nu ")
    .replace(/Ξ/g, " Xi ")
    .replace(/Ζ/g, " Zeta ")
    .replace(/∀/g, " Turn A ")
    .replace(/Ⅱ/g, " II ")
    .replace(/Ⅲ/g, " III ")
    .replace(/＆/g, " and ");
  // Drop bracketed / angled / dashed qualifiers: [..] (..) <..> （..） -..- and Ver. notes.
  s = s.replace(/[\[【（(][^\])】）]*[\])】）]/g, " ").replace(/<[^>]*>/g, " ").replace(/-[^-]+-/g, " ");
  s = s.replace(/\(EX\)|METEOR|Revival Ver\.?|Ver\.?|Custom|Final Battle|CLIMAX BATTLE|CONCEPT\s*\d*|Re:?Coordinate|SpecII/gi, " ");
  for (const re of NOISE) s = s.replace(re, " ");
  // Keep latin + digits only (drops Japanese, which we can't reliably align to English unit names).
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return s;
}

function kitSearchText(kit) {
  return [
    kit.names?.en,
    kit.names?.ja,
    kit.names?.zh,
    kit.names?.ko,
    kit.work_title,
    kit.subline,
    kit.number,
    kit.grade_code,
  ].filter(Boolean).join(" ");
}

function usefulUnitKey(key) {
  if (!key || key.length < 6) return false;
  if (/^(gundam|zaku|gm|gelgoog|gouf|dom|rickdom|zakuii|gmii|guncannon)$/.test(key)) return false;
  return true;
}

async function main() {
  const gget = JSON.parse(await readFile(GGET_PATH, "utf8"));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));

  const works = gget.works;
  const workIds = new Set(works.map((w) => w.work_id));
  const units = gget.units.filter((u) => u.work_ids.some((id) => workIds.has(id)));

  // Group units by normalized suit name (variants like EX / Meteor collapse together).
  const unitsByKey = new Map();
  for (const unit of units) {
    const key = normalizeName(unit.name);
    if (!usefulUnitKey(key)) continue;
    if (!unitsByKey.has(key)) unitsByKey.set(key, []);
    unitsByKey.get(key).push(unit);
  }

  const kits = catalog.kits.filter((k) => k.franchise === "gundam" && k.data_status !== "hidden");

  const map = {}; // unit_id -> [kit_id]
  let matchedKits = 0;
  for (const kit of kits) {
    const kitKey = normalizeName(kitSearchText(kit));
    if (!kitKey) continue;
    // Match when a unit's suit-name key is contained in the kit key (kits embed the suit
    // name plus extras). Prefer the longest unit key to avoid "gundam" over-matching.
    let best = null;
    for (const [key, unitList] of unitsByKey) {
      if (kitKey.includes(key) && (!best || key.length > best.key.length)) best = { key, unitList };
    }
    if (!best) continue;
    matchedKits += 1;
    for (const unit of best.unitList) {
      (map[unit.unit_id] = map[unit.unit_id] || []).push(kit.kit_id);
    }
  }

  const matchedUnits = Object.keys(map).length;
  const doc = {
    updated_at: gget.updated_at,
    works: works.map((w) => ({ work_id: w.work_id, name: w.name })),
    unit_kits: map,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(
    `gget map: ${matchedKits}/${kits.length} kits matched to ${matchedUnits}/${units.length} units ` +
      `across ${works.length} works. Wrote ${OUTPUT_PATH}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
