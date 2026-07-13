import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));

function nameFor(kit) {
  return kit.names?.ja || kit.names?.en || kit.names?.zh || kit.names?.ko || kit.kit_id;
}

function keyFor(kit) {
  return [kit.franchise, kit.grade_code, nameFor(kit)]
    .join(" ")
    .toLowerCase()
    .replace(/[【】\[\]()]/g, " ")
    .replace(/\b(ver|version)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const groups = new Map();
for (const kit of catalog.kits) {
  const key = keyFor(kit);
  if (key.length < 8) continue;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({
    kit_id: kit.kit_id,
    franchise: kit.franchise,
    grade_code: kit.grade_code,
    name: nameFor(kit),
    release_date: kit.release_date,
    source_urls: kit.source_urls,
  });
}

const candidates = [...groups.values()].filter((items) => items.length > 1).sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name, "ja"));
await writeFile("data/duplicate-candidates.json", `${JSON.stringify({ updated_at: new Date().toISOString(), count: candidates.length, candidates }, null, 2)}\n`, "utf8");
console.log(`Wrote ${candidates.length} duplicate candidate groups to data/duplicate-candidates.json.`);
