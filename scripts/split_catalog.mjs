import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const kitsPath = resolve(rootDir, "data/kits.json");
const splitDir = resolve(rootDir, "data/split");
const aliasesPath = resolve(rootDir, "data/kit-aliases.json");

async function readOptionalJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

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

const payloads = new Map();
for (const [franchise, franchiseKits] of groups) {
  manifest.franchises[franchise] = franchiseKits.length;
  const payload = JSON.stringify({
    updated_at: doc.updated_at || null,
    franchise,
    kits: franchiseKits,
  });
  payloads.set(franchise, payload);
  await writeFile(resolve(splitDir, `kits-${franchise}.json`), payload);
}

// Fingerprint of everything an app downloads from here (manifest.content_hash). The app
// compared only updated_at and total, so a same-day change that kept the total
// (2026-11-10: manual_id added to 2005 records) never reached a device that had already
// refreshed that day. Fed in a fixed order (franchises by name, then the aliases), each
// part exactly as written to disk.
const contentHash = createHash("sha256");
const hashPart = (name, json) => {
  contentHash.update(`${name}\0`);
  contentHash.update(json);
  contentHash.update("\0");
};
for (const franchise of [...payloads.keys()].sort()) hashPart(franchise, payloads.get(franchise));

// Retired kit_id -> surviving kit_id, chains resolved and only towards records
// that are published, so an app can move saved entries in one lookup. Excluded
// ids (not collectibles) are listed so an app can tell "removed" from "unknown".
const aliasDoc = await readOptionalJson(aliasesPath);
const liveIds = new Set(kits.map((kit) => kit.kit_id));
const resolveAlias = (id) => {
  let current = id;
  for (let hops = 0; hops < 20 && aliasDoc?.aliases?.[current]; hops += 1) current = aliasDoc.aliases[current];
  return current;
};
const publishedAliases = {};
for (const id of Object.keys(aliasDoc?.aliases || {}).sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
  const target = resolveAlias(id);
  if (target !== id && liveIds.has(target) && !liveIds.has(id)) publishedAliases[id] = target;
}
const publishedExcluded = Object.keys(aliasDoc?.excluded || {})
  .filter((id) => !liveIds.has(id))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const aliasesPayload = JSON.stringify({ updated_at: aliasDoc?.updated_at || null, aliases: publishedAliases, excluded: publishedExcluded });
hashPart("kit-aliases.json", aliasesPayload);
await writeFile(resolve(splitDir, "kit-aliases.json"), aliasesPayload);
manifest.kit_aliases = { file: "kit-aliases.json", aliases: Object.keys(publishedAliases).length, excluded: publishedExcluded.length };
manifest.content_hash = contentHash.digest("hex").slice(0, 16);

await writeFile(resolve(splitDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Split ${kits.length} kits into ${groups.size} franchise files under data/split/.`);
console.log(`  kit-aliases.json: ${Object.keys(publishedAliases).length} retired ids with a successor, ${publishedExcluded.length} removed`);
for (const [franchise, franchiseKits] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  kits-${franchise}.json: ${franchiseKits.length} records`);
}
