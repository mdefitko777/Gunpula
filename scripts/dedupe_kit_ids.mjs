// Drops repeated kit_ids from data/kits.json, keeping the first record.
// A refresh run that rebases with -X theirs onto a concurrently updated main
// can merge two copies of a newly added record; validate_catalog.mjs rejects
// duplicate ids. Run by the refresh workflow after its rebase. Idempotent.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const KITS_PATH = join(rootDir, "data/kits.json");

const doc = JSON.parse(await readFile(KITS_PATH, "utf8"));
const seen = new Set();
const kits = doc.kits.filter((kit) => {
  if (seen.has(kit.kit_id)) return false;
  seen.add(kit.kit_id);
  return true;
});
const dropped = doc.kits.length - kits.length;
if (dropped) {
  await writeFile(KITS_PATH, `${JSON.stringify({ ...doc, kits }, null, 2)}\n`, "utf8");
}
console.log(`Duplicate kit_ids dropped: ${dropped}`);
