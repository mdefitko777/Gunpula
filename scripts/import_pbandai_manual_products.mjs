import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const MANUAL_PATH = "data/pbandai_manual_products.json";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function mergeCatalog(existingKits, importedKits) {
  const byId = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  for (const kit of importedKits) {
    const previous = byId.get(kit.kit_id);
    byId.set(kit.kit_id, previous ? { ...previous, ...kit } : kit);
  }
  return [...byId.values()].sort((a, b) => {
    const franchiseCompare = String(a.franchise).localeCompare(String(b.franchise));
    if (franchiseCompare) return franchiseCompare;
    return String(b.release_date || "").localeCompare(String(a.release_date || "")) || String(a.kit_id).localeCompare(String(b.kit_id));
  });
}

function toKit(item) {
  return {
    kit_id: item.kit_id,
    franchise: item.franchise,
    grade_code: item.grade_code,
    subline: item.subline,
    number: item.number ?? null,
    scale: item.scale || "non-scale",
    names: item.names,
    images: {
      box_art_url: item.image_urls?.[0] || null,
      box_art_source_id: item.image_urls?.[0] ? item.source_refs?.find((ref) => ref.source_id !== "p_bandai_jp")?.source_id || "p_bandai_jp" : null,
    },
    gallery_image_urls: item.image_urls || [],
    universe: item.universe,
    work_title: item.work_title,
    release_date: item.release_date,
    price_jpy: item.price_jpy,
    is_limited: Boolean(item.is_limited),
    data_status: "verified",
    source_urls: item.source_urls || [],
    source_refs: item.source_refs || [],
    tags: item.tags || [],
    notes: item.notes || null,
  };
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const manual = JSON.parse(await readFile(MANUAL_PATH, "utf8"));
const importedKits = (manual.items || []).map(toKit);

await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: mergeCatalog(catalog.kits, importedKits) }, null, 2)}\n`, "utf8");
console.log(`Manual Premium Bandai products: imported ${importedKits.length} records.`);
