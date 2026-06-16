import { countBy, loadCatalog, printTable } from "./lib/catalog.mjs";

const { kits, sourceById } = loadCatalog();

const sourceRows = countBy(
  kits.flatMap((kit) => kit.source_refs ?? []),
  (sourceRef) => sourceRef.source_id,
).map(([sourceId, count]) => [sourceId, sourceById.get(sourceId)?.type ?? "unknown", count]);

const missingOfficial = kits.filter(
  (kit) => !(kit.source_refs ?? []).some((sourceRef) => sourceById.get(sourceRef.source_id)?.type?.includes("official")),
);

const missingVisual = kits.filter(
  (kit) =>
    !(kit.source_refs ?? []).some((sourceRef) =>
      ["bandai_spirits_products_jp", "p_bandai_jp", "the_gundam_base_jp", "bandai_candy_gundam_jp", "bandai_gashapon_gundam_jp", "hobby_search_jp", "amiami_jp"].includes(
        sourceRef.source_id,
      ),
    ),
);

console.log(`Kits: ${kits.length}`);
console.log("\nSources used");
printTable(["Source", "Type", "Count"], sourceRows);

console.log("\nKits without official source");
printTable(["Kit ID", "Grade", "Status"], missingOfficial.map((kit) => [kit.kit_id, kit.grade_code, kit.data_status]));

console.log("\nKits without Japanese product/catalog source");
printTable(["Kit ID", "Grade", "Status"], missingVisual.map((kit) => [kit.kit_id, kit.grade_code, kit.data_status]));
