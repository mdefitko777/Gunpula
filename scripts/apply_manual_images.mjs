// Covers for products whose own source has no picture we can use (Hobby
// Search is behind a bot check, Wikipedia lists have none, event items have no
// maker page): an official image found by hand on the maker's site, kept in
// data/manual-images.json as { kit_id: { url, page } }.
//
// Runs in run_importers.mjs after the importers (which reset images every day)
// and before localize. A product that has a cover again from its own source is
// left alone; an entry whose product is gone is reported.
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const MANUAL_PATH = "data/manual-images.json";

const manual = JSON.parse(await readFile(MANUAL_PATH, "utf8")).images || {};
const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const byId = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));

let applied = 0;
const missing = [];
for (const [kitId, entry] of Object.entries(manual)) {
  const kit = byId.get(kitId);
  if (!kit) {
    missing.push(kitId);
    continue;
  }
  if (kit.images?.box_art_url) continue;
  kit.images = { ...(kit.images || {}), box_art_url: entry.url, box_art_source_id: "manual_image" };
  kit.gallery_image_urls = [...new Set([entry.url, ...(kit.gallery_image_urls || [])])];
  const refs = kit.source_refs || [];
  if (!refs.some((ref) => ref.source_id === "manual_image")) {
    kit.source_refs = [...refs, { source_id: "manual_image", url: entry.page, fields: ["images"], confidence: "medium" }];
  }
  applied += 1;
}

if (applied) await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Manual covers: applied ${applied} of ${Object.keys(manual).length}${missing.length ? `; products gone: ${missing.join(", ")}` : ""}`);
