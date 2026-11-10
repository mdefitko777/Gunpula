// Simplified Chinese display names (names.zh) and Chinese search words (search_zh) for
// data/kits.json, the Chinese UI of Hobby Atlas and the zh web catalog.
//
// names.zh, in order: a curated sentence from data/i18n/names-zh.json (applies while the
// product's source name is still the one that was translated, like names-ko.json), else the
// glossary translation (scripts/lib/zh-names.mjs). LEGO keeps its English name.
// search_zh: fan / other-region names of every glossary term in the name (沙煲 for サザビー,
// 海牛 for Hi-ν …) — search only, never shown.
// Products whose Chinese name still has kana and no curated entry go to
// data/i18n/names-zh-pending.json (the to-do list for the next translation pass).
//
// Runs in the daily refresh after apply_ko_names.mjs. Idempotent.

import { readFile, writeFile } from "node:fs/promises";
import { hasKana, loadGlossary, searchAliases, translateName } from "./lib/zh-names.mjs";

const KITS_PATH = "data/kits.json";
const NAMES_PATH = "data/i18n/names-zh.json";
const PENDING_PATH = "data/i18n/names-zh-pending.json";

export function sourceName(kit) {
  return (kit.names?.ja || kit.names?.en || "").trim();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export function applyZhNames(kits, curated, glossaryFor) {
  const pending = {};
  let fromCurated = 0;
  let fromGlossary = 0;
  for (const kit of kits) {
    if (kit.franchise === "lego") continue;
    const src = sourceName(kit);
    if (!src) continue;
    const glossary = glossaryFor(kit.franchise);
    const auto = translateName(src, glossary);
    const entry = curated[kit.kit_id];
    let zh = auto.zh;
    if (entry?.zh && entry.src === src) {
      zh = entry.zh;
      fromCurated += 1;
    } else {
      fromGlossary += 1;
      if (!auto.complete) pending[kit.kit_id] = { src, auto: auto.zh };
    }
    kit.names = { ...kit.names, zh };
    const words = searchAliases(auto.matched, glossary).filter((word) => !zh.includes(word));
    if (words.length) kit.search_zh = words;
    else delete kit.search_zh;
  }
  return { pending, fromCurated, fromGlossary };
}

async function main() {
  const raw = await readFile(KITS_PATH, "utf8");
  const doc = JSON.parse(raw);
  const curated = (await readJson(NAMES_PATH, { names: {} })).names || {};
  const cache = new Map();
  const glossaryFor = (franchise) => {
    if (!cache.has(franchise)) cache.set(franchise, loadGlossary(franchise));
    return cache.get(franchise);
  };
  const { pending, fromCurated, fromGlossary } = applyZhNames(doc.kits, curated, glossaryFor);
  const out = `${JSON.stringify(doc, null, 2)}\n`;
  if (out !== raw) await writeFile(KITS_PATH, out);
  const ids = Object.keys(pending).sort();
  await writeFile(
    PENDING_PATH,
    `${JSON.stringify({ note: "Products whose Chinese name still has kana; translate them into data/i18n/names-zh.json.", count: ids.length, names: Object.fromEntries(ids.map((id) => [id, pending[id]])) }, null, 1)}\n`,
  );
  const leftKana = doc.kits.filter((kit) => kit.franchise !== "lego" && hasKana(kit.names?.zh)).length;
  console.log(`Chinese names: ${fromCurated} curated, ${fromGlossary} from the glossary, ${ids.length} still with kana (${leftKana} in total).`);
}

if (/(^|[\\/])apply_zh_names\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
