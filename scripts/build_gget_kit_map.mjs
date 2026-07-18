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

function workFamily(name) {
  const s = String(name || "").toLowerCase();
  if (s.includes("seed")) return "seed";
  if (s.includes("gundam 00") || s.includes("celestial being")) return "double_o";
  if (s.includes("wing")) return "w";
  if (s.includes("iron-blooded")) return "iron_blooded";
  if (s.includes("witch from mercury")) return "witch";
  if (s.includes("gquuuuuux")) return "gquuuuuux";
  if (s.includes("age")) return "age";
  if (s.includes("build") || s.includes("gunpla builders")) return "build";
  if (s.includes("sd ") || s.includes("sengokuden") || s.includes("sangoku")) return "sd";
  if (s.includes("fighter g gundam")) return "g";
  if (s.includes("gundam x")) return "x";
  if (s.includes("turn a")) return "turn_a";
  if (s.includes("reconguista")) return "g_reco";
  if (s.includes("g generation") || s.includes("extreme vs") || s.includes("battle master")) return "game";
  if (/\b(0079|0080|0081|0083|0087|0093|f90|f91|uc|cca|msv|zeta|zz|unicorn|narrative|hathaway|crossbone|sentinel|igloo|blue destiny|lost war|missing link|thunderbolt|advance of zeta|char|v gundam|origin|mobile suit gundam)\b/.test(s)) return "uc";
  return "other";
}

function kitFamily(kit) {
  const key = kit.series?.key || "";
  const map = {
    seed: "seed",
    double_o: "double_o",
    w: "w",
    iron_blooded: "iron_blooded",
    witch: "witch",
    gquuuuuux: "gquuuuuux",
    age: "age",
    build: "build",
    sd: "sd",
    sangoku: "sd",
    g: "g",
    x: "x",
    turn_a: "turn_a",
    g_reco: "g_reco",
  };
  if (map[key]) return map[key];
  if (/^(0079|0080|0083|z|zz|cca|uc|f90|f91|v|msv|origin|thunderbolt|hathaway|crossbone|sentinel|blue_destiny|0081|igloo|narrative)$/.test(key)) return "uc";
  return workFamily([kit.work_title, kit.universe, kit.subline, kit.names?.en, kit.names?.ja].filter(Boolean).join(" "));
}

function familyCompatible(kit, unit) {
  const kFamily = kitFamily(kit);
  const families = unit.families || new Set(["other"]);
  return families.has(kFamily) || families.has("other") || kFamily === "other";
}

function accessoryOnly(kit) {
  const text = kitSearchText(kit);
  return /\b(option parts?|weapon set|effect parts?|expansion set|parts set|display stand|water slide decal|decal)\b/i.test(text);
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
  const workNameById = new Map(works.map((work) => [work.work_id, work.name]));
  const workIds = new Set(works.map((w) => w.work_id));
  const units = gget.units
    .filter((u) => u.work_ids.some((id) => workIds.has(id)))
    .map((unit) => ({
      ...unit,
      families: new Set((unit.work_ids || []).map((id) => workNameById.get(id)).filter(Boolean).map(workFamily)),
    }));

  // Group units by normalized suit name (variants like EX / Meteor collapse together).
  const unitsByKey = new Map();
  for (const unit of units) {
    const key = normalizeName(unit.name);
    if (!usefulUnitKey(key)) continue;
    if (!unitsByKey.has(key)) unitsByKey.set(key, []);
    unitsByKey.get(key).push(unit);
  }

  const kits = catalog.kits.filter((k) => k.franchise === "gundam" && k.data_status !== "hidden" && !accessoryOnly(k));

  const map = {}; // unit_id -> Set<kit_id>
  let matchedKits = 0;
  for (const kit of kits) {
    const kitKey = normalizeName(kitSearchText(kit));
    if (!kitKey) continue;
    // Match when a unit's suit-name key is contained in the kit key (kits embed the suit
    // name plus extras). Prefer the longest unit key to avoid "gundam" over-matching.
    let best = null;
    for (const [key, unitList] of unitsByKey) {
      const compatibleUnits = unitList.filter((unit) => familyCompatible(kit, unit));
      if (compatibleUnits.length && kitKey.includes(key) && (!best || key.length > best.key.length)) best = { key, unitList: compatibleUnits };
    }
    if (!best) continue;
    matchedKits += 1;
    for (const unit of best.unitList) {
      (map[unit.unit_id] = map[unit.unit_id] || new Set()).add(kit.kit_id);
    }
  }

  const unitKits = Object.fromEntries(Object.entries(map).map(([unitId, kitIds]) => [unitId, [...kitIds].sort()]));
  const matchedUnits = Object.keys(unitKits).length;
  const doc = {
    updated_at: gget.updated_at,
    works: works.map((w) => ({ work_id: w.work_id, name: w.name })),
    unit_kits: unitKits,
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
