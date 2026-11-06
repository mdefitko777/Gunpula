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

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tidyKoNames } from "./lib/ko-tidy.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const KITS_PATH = join(rootDir, "data/kits.json");
const NAMES_PATH = join(rootDir, "data/i18n/names-ko.json");
const PENDING_PATH = join(rootDir, "data/i18n/names-ko-pending.json");

const KANA_RE = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const KANJI_RE = /[㐀-䶿一-鿿]/;
// brand names that are written with kanji in Korean too
const BRAND_RE = /METAL ROBOT魂|ROBOT魂|超合金魂|超合金の塊|超合金/g;

export function needsKorean(ko) {
  if (!ko) return true;
  const rest = ko.replace(BRAND_RE, "");
  return KANA_RE.test(rest) || KANJI_RE.test(rest);
}

export function sourceName(kit) {
  return (kit.names?.ja || kit.names?.en || "").trim();
}

const doc = JSON.parse(await readFile(KITS_PATH, "utf8"));
const curated = JSON.parse(await readFile(NAMES_PATH, "utf8")).names ?? {};

let applied = 0;
let stale = 0;
const pending = [];
for (const kit of doc.kits) {
  const entry = curated[kit.kit_id];
  const src = sourceName(kit);
  if (entry && entry.src === src) {
    if (kit.names.ko !== entry.ko) applied += 1;
    kit.names.ko = entry.ko;
    continue;
  }
  if (entry) stale += 1;
  // Still Japanese, or (outside LEGO, whose names are English on purpose) no Korean at all.
  const ko = kit.names?.ko || "";
  const untranslated = kit.franchise !== "lego" && /[A-Za-z]{3}/.test(ko) && !/[가-힣]/.test(ko);
  if (needsKorean(ko) || untranslated) pending.push({ kit_id: kit.kit_id, franchise: kit.franchise, src });
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
