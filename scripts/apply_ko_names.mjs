// Applies curated full-sentence Korean display names (data/i18n/names-ko.json)
// to data/kits.json. The word-by-word kana dictionary (translate_kana_names.mjs)
// only covers some series and leaves hybrids like 「샤아 전용ズゴック」; these
// entries replace names.ko for the whole product.
//
// An entry applies only while the kit's source name (names.ja, else names.en)
// is still the one that was translated, so a renamed product falls back to the
// automatic name until it is translated again. Kits whose Korean name still
// contains kana/kanji and have no applicable entry are written to
// data/i18n/names-ko-pending.json (the to-do list for the next translation pass).
//
// Runs in the daily refresh workflow after translate_kana_names.mjs. Idempotent.
//   node scripts/apply_ko_names.mjs

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeEntities } from "./lib/html-entities.mjs";
import { tidyKoNames } from "./lib/ko-tidy.mjs";
import { sameSource } from "./lib/source-key.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const KITS_PATH = join(rootDir, "data/kits.json");
const NAMES_PATH = join(rootDir, "data/i18n/names-ko.json");
const PENDING_PATH = join(rootDir, "data/i18n/names-ko-pending.json");

const KANA_RE = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const KANJI_RE = /[㐀-䶿一-鿿]/;
// brand names that are written with kanji in Korean too
const BRAND_RE = /METAL ROBOT魂|ROBOT魂|超合金魂|超合金の塊|超合金/g;
// ・ is punctuation, not kana left over: the Korean stores write "미네랄사이다・리프레쉬" and
// "스칼렛・바이올렛", which kept 13 fully Korean names on the to-do list until 2026-11-20.
const DOTS_RE = /[・･]/g;
// Official Korean stores: their name is the Korean name, also when it is English. Nintendo Korea
// sells "Nintendo Switch Sports", "Pokémon LEGENDS Z-A", "ARMS" … under those titles (32 products
// on the to-do list on 2026-11-20 that had nothing to translate).
const KOREAN_NAME_SOURCES = new Set(["nintendo_store_kr", "nintendo_kr", "pokemon_store_kr", "academy_kr", "bnkrmall_kr"]);

export function needsKorean(ko) {
  if (!ko) return true;
  const rest = ko.replace(BRAND_RE, "").replace(DOTS_RE, "");
  return KANA_RE.test(rest) || KANJI_RE.test(rest);
}

// Decoded, so an entry keeps applying when an importer starts decoding a reference it used to
// keep ("Pok&eacute;mon fit" → "Pokémon fit", Pokémon Center 2026-11-11).
export function sourceName(kit) {
  return decodeEntities(kit.names?.ja || kit.names?.en || "").trim();
}

function namedByKoreanStore(kit) {
  return (kit.source_refs || []).some((ref) => KOREAN_NAME_SOURCES.has(ref.source_id) && (ref.fields || []).includes("names"));
}

// Still Japanese, or (outside LEGO, whose names are English on purpose, and the Korean stores'
// own English titles) no Korean at all.
export function isPendingKorean(kit) {
  const ko = kit.names?.ko || "";
  if (needsKorean(ko)) return true;
  if (kit.franchise === "lego" || /[가-힣]/.test(ko) || !/[A-Za-z]{3}/.test(ko)) return false;
  return !(namedByKoreanStore(kit) && sameSource(ko, sourceName(kit)));
}

async function main() {
  const doc = JSON.parse(await readFile(KITS_PATH, "utf8"));
  const curated = JSON.parse(await readFile(NAMES_PATH, "utf8")).names ?? {};

  let applied = 0;
  let stale = 0;
  const pending = [];
  for (const kit of doc.kits) {
    const entry = curated[kit.kit_id];
    const src = sourceName(kit);
    if (entry && sameSource(entry.src, src)) {
      if (kit.names.ko !== entry.ko) applied += 1;
      kit.names.ko = entry.ko;
      continue;
    }
    if (entry) stale += 1;
    if (isPendingKorean(kit)) pending.push({ kit_id: kit.kit_id, franchise: kit.franchise, src });
  }

  // Brackets, scales, shop tags, reissue tags, look-alike names (scripts/lib/ko-tidy.mjs)
  const tidied = tidyKoNames(doc.kits);

  await writeFile(KITS_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  await writeFile(
    PENDING_PATH,
    `${JSON.stringify({ count: pending.length, note: "Kits whose Korean name still has kana/kanji and no curated entry in names-ko.json", kits: pending }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Curated Korean names: applied=${applied} stale(source renamed)=${stale} pending=${pending.length} tidied=${tidied}`);
}

if (/(^|[\\/])apply_ko_names\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
