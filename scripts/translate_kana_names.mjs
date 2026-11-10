// Rewrites kana-polluted Korean display names (names.ko) in data/kits.json for
// Gundam and Beyblade X kits, using the shared curated dictionary (written for
// SEED / 00 first; a name it cannot cover fully stays as it is, see below).
// All-or-nothing per name: a name whose kana can't fully translate stays
// unchanged, so the catalog never shows half-translated hybrids.
//
// Runs in the daily refresh workflow right after the imports/localize step so
// re-imported names get re-translated every day. Idempotent.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KANA_RE, translateDisplayName } from "./lib/kana_ko_dict.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const KITS_PATH = join(rootDir, "data/kits.json");
// Every Gundam series: a SEED / 00-only filter left "V2アサルト버스터건담" (Victory) half Japanese.
function isTarget(kit) {
  return kit.franchise === "beyblade" || kit.franchise === "gundam";
}

const doc = JSON.parse(await readFile(KITS_PATH, "utf8"));
let translated = 0;
let skipped = 0;
let already = 0;

for (const kit of doc.kits) {
  if (!isTarget(kit)) continue;
  const ko = kit.names?.ko;
  if (!ko || !KANA_RE.test(ko)) { already += 1; continue; }
  const next = translateDisplayName(ko);
  if (next) {
    kit.names.ko = next;
    translated += 1;
  } else {
    skipped += 1;
  }
}

await writeFile(KITS_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`Korean display names: translated=${translated} skipped(uncovered)=${skipped} alreadyKorean=${already}`);
