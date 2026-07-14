import { writeFile } from "node:fs/promises";

// Beyblade X parts / series / products database, mirrored from the community site
// beyblade.phstudy.org (which serves clean public JSON). Powers the BBX 图鉴: each
// "陀螺" (Series) lists its component parts, parts know which product ships them, so
// the app can show a top's parts and recommend which product to buy for missing ones.
const BASE = "https://beyblade.phstudy.org";
const MAIN_URL = `${BASE}/data/main.json`;
const PRODUCTS_URL = `${BASE}/data/products_multilang.json`;
const WEIGHTS_URL = `${BASE}/data/part_weights.json`;
const OUTPUT_PATH = "data/bbx-database.json";

// phstudy locale -> our four app languages.
const LANGS = { zh: "zh-TW", ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const PART_TYPES = {
  BeybladePartsBlade: "blade",
  BeybladePartsRatchet: "ratchet",
  BeybladePartsBit: "bit",
  BeybladePartsAssistBlade: "assist_blade",
  BeybladePartsLockChip: "lock_chip",
  BeybladePartsMainBlade: "main_blade",
  BeybladePartsMetalBlade: "metal_blade",
  BeybladePartsOverBlade: "over_blade",
};

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "Gunpula catalog importer" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function names(multilang = {}) {
  const out = {};
  for (const [lang, key] of Object.entries(LANGS)) out[lang] = multilang[key] || multilang["en-US"] || "";
  return out;
}

function cleanTitle(value = "") {
  // Series/part catalog_title carries Unity rich-text sizing tags and stray newlines.
  return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanNames(multilang = {}) {
  const out = names(multilang);
  for (const lang of Object.keys(out)) out[lang] = cleanTitle(out[lang]);
  return out;
}

async function main() {
  const [main, products, weights] = await Promise.all([getJson(MAIN_URL), getJson(PRODUCTS_URL), getJson(WEIGHTS_URL)]);

  const parts = {};
  for (const [category, type] of Object.entries(PART_TYPES)) {
    const bucket = main.data[category] || {};
    parts[type] = Object.entries(bucket).map(([id, part]) => ({
      part_id: id,
      type,
      base_set_id: part.base_set_id || "",
      names: cleanNames(part.catalog_title),
      color: part.color || "",
      stats: part.defaultStatus || null,
      weight_g: weights[id]?.weight_g ?? null,
      collection_order: part.collection_order ?? null,
    }));
  }

  const series = Object.values(main.data.BeybladeSeries || {})
    .filter((s) => !s.invalid)
    .map((s) => ({
      series_id: s.id,
      base_set_id: s.base_set_id || "",
      names: cleanNames(s.name || s.catalog_title),
      model_name: s.model_name || s.en_name || "",
      blade_id: s.blade_id || "",
      ratchet_id: s.ratchet_id || "",
      bit_id: s.bit_id || "",
      assist_blade_id: s.assist_blade_id || "",
      lock_chip_id: s.lock_chip_id || "",
      main_blade_id: s.main_blade_id || "",
      metal_blade_id: s.metal_blade_id || "",
      over_blade_id: s.over_blade_id || "",
      tags: Array.isArray(s.tags) ? s.tags : [],
      collection_order: s.collection_order ?? null,
    }));

  const cleanProducts = products.map((p) => ({
    product_id: p.product_id,
    base_set_id: p.base_set_id || "",
    names: names(p.name),
    price: p.price || "",
    release_date: p.release_date || "",
    url: p.url || "",
    youtube: p.youtube || "",
    image: Array.isArray(p.images) && p.images[0] ? `${BASE}/${p.images[0]}` : null,
  }));

  const doc = {
    source: "beyblade.phstudy.org",
    image_base: `${BASE}/images`,
    updated_at: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()),
    products: cleanProducts,
    series,
    parts,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  const partCount = Object.values(parts).reduce((n, list) => n + list.length, 0);
  console.log(`BBX database: ${cleanProducts.length} products, ${series.length} series, ${partCount} parts → ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
