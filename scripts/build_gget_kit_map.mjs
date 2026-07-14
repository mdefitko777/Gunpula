import { readFile, writeFile } from "node:fs/promises";

// Link the G Generation 图鉴 to the catalog: for each mobile-suit unit (in the seeded
// works) list the catalog kit_ids that depict it, so a unit lights up when any matching
// kit is marked owned/wanted. Starts with the three series the users actually collect —
// Gundam 00, SEED, and The Witch from Mercury — because a full 1:1 map is impractical.
const GGET_PATH = "data/gget-units.json";
const CATALOG_PATH = "data/kits.json";
const OUTPUT_PATH = "data/gget-kit-map.json";

const TARGET_WORK = /Gundam 00(?!8)|Gundam SEED|Witch from Mercury/i;
const TARGET_SERIES_KEYS = new Set(["double_o", "seed", "witch"]);

// Grade / scale / packaging noise that appears around the mobile-suit name in kit titles.
const NOISE = [
  /\bMGSD\b/gi, /\bMGEX\b/gi, /\bRE\s?100\b/gi, /\bMG\b/gi, /\bHG(CE|UC|BF)?\b/gi, /\bRG\b/gi, /\bPG\b/gi,
  /\bEG\b/gi, /\bFM\b/gi, /\bSDW?\b/gi, /\bSDEX\b/gi, /\bNG\b/gi, /\bGFRAME\b/gi, /\bG\s?フレーム(FA)?\b/gi,
  /\bMETAL\s?BUILD\b/gi, /\bMETAL\s?ROBOT\b/gi, /\bROBOT\s?SPIRITS\b/gi, /\bSH\s?FIGUARTS\b/gi,
  /\bFW\b/gi, /\bGUNDAM\s?CONVERGE\b/gi, /\bCONVERGE\b/gi,
  /\b1\s*\/\s*\d{2,3}\b/g, /\bMobile Suit\b/gi,
];

function normalizeName(raw) {
  let s = String(raw || "");
  // Drop bracketed / angled / dashed qualifiers: [..] (..) <..> （..） -..- and Ver. notes.
  s = s.replace(/[\[【（(][^\])】）]*[\])】）]/g, " ").replace(/<[^>]*>/g, " ").replace(/-[^-]+-/g, " ");
  s = s.replace(/\(EX\)|METEOR|Revival Ver\.?|Ver\.?|Custom|Final Battle|CLIMAX BATTLE|CONCEPT\s*\d*/gi, " ");
  for (const re of NOISE) s = s.replace(re, " ");
  // Keep latin + digits only (drops Japanese, which we can't reliably align to English unit names).
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return s;
}

async function main() {
  const gget = JSON.parse(await readFile(GGET_PATH, "utf8"));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));

  const works = gget.works.filter((w) => TARGET_WORK.test(w.name));
  const workIds = new Set(works.map((w) => w.work_id));
  const units = gget.units.filter((u) => u.work_ids.some((id) => workIds.has(id)));

  // Group units by normalized suit name (variants like EX / Meteor collapse together).
  const unitsByKey = new Map();
  for (const unit of units) {
    const key = normalizeName(unit.name);
    if (!key) continue;
    if (!unitsByKey.has(key)) unitsByKey.set(key, []);
    unitsByKey.get(key).push(unit);
  }

  const kits = catalog.kits.filter((k) => k.franchise === "gundam" && TARGET_SERIES_KEYS.has(k.series?.key));

  const map = {}; // unit_id -> [kit_id]
  let matchedKits = 0;
  for (const kit of kits) {
    const kitKey = normalizeName(kit.names?.en || kit.names?.ja);
    if (!kitKey) continue;
    // Match when a unit's suit-name key is contained in the kit key (kits embed the suit
    // name plus extras). Prefer the longest unit key to avoid "gundam" over-matching.
    let best = null;
    for (const [key, unitList] of unitsByKey) {
      if (key.length < 5) continue;
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
