import { readFile, writeFile } from "node:fs/promises";
import { cleanTamashiiGalleryUrls } from "./lib/tamashii-images.mjs";

const DATA_PATH = "data/kits.json";
const checkOnly = process.argv.includes("--check");

function removedReason(url, kitId) {
  const expectedId = kitId.replace(/^tamashii-/, "");
  const importedMatch = String(url).match(/\/products\/imported\/item_(\d+)_/i);
  if (/\.pdf(?:$|[?#])/i.test(url)) return "pdf";
  if (importedMatch && Number(importedMatch[1]) !== Number(expectedId)) return "related";
  return "other";
}

const doc = JSON.parse(await readFile(DATA_PATH, "utf8"));
const stats = {
  affected: 0,
  removed: 0,
  related: 0,
  pdf: 0,
  other: 0,
  samples: [],
};

for (const kit of doc.kits ?? []) {
  if (!/^tamashii-\d+$/.test(kit.kit_id ?? "")) continue;
  const before = kit.gallery_image_urls ?? [];
  const after = cleanTamashiiGalleryUrls(before, kit.kit_id);
  if (after.length === before.length && after.every((url, index) => url === before[index])) continue;

  const afterSet = new Set(after);
  const removed = before.filter((url) => !afterSet.has(url));
  stats.affected += 1;
  stats.removed += removed.length;
  for (const url of removed) {
    const reason = removedReason(url, kit.kit_id);
    stats[reason] += 1;
  }
  if (stats.samples.length < 8) {
    stats.samples.push({ kit_id: kit.kit_id, removed: removed.length, kept: after.length });
  }
  kit.gallery_image_urls = after;
}

if (!checkOnly && stats.removed > 0) {
  await writeFile(DATA_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

console.log(
  JSON.stringify(
    {
      mode: checkOnly ? "check" : "write",
      ...stats,
    },
    null,
    2
  )
);

if (checkOnly && stats.removed > 0) {
  process.exitCode = 1;
}
