import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const kitsPath = resolve(rootDir, "data/kits.json");
const splitDir = resolve(rootDir, "data/split");

const doc = JSON.parse(await readFile(kitsPath, "utf8"));
const kits = doc.kits || [];

const groups = new Map();
for (const kit of kits) {
  const franchise = String(kit.franchise || "unknown");
  if (!groups.has(franchise)) {
    groups.set(franchise, []);
  }
  groups.get(franchise).push(kit);
}

await mkdir(splitDir, { recursive: true });

const manifest = {
  updated_at: doc.updated_at || null,
  total: kits.length,
  franchises: {},
};

for (const [franchise, franchiseKits] of groups) {
  manifest.franchises[franchise] = franchiseKits.length;
  const payload = {
    updated_at: doc.updated_at || null,
    franchise,
    kits: franchiseKits,
  };
  await writeFile(resolve(splitDir, `kits-${franchise}.json`), JSON.stringify(payload));
}

await writeFile(resolve(splitDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Split ${kits.length} kits into ${groups.size} franchise files under data/split/.`);
for (const [franchise, franchiseKits] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  kits-${franchise}.json: ${franchiseKits.length} records`);
}
