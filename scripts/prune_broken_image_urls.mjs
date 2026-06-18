import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const REPORT_PATH = "data/image-health.json";

const args = process.argv.slice(2);
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);

const franchiseFilter = options.franchise || "";
const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const report = JSON.parse(await readFile(options.report || REPORT_PATH, "utf8"));
const brokenUrls = new Set((report.broken || []).map((item) => item.url).filter(Boolean));

let changedKits = 0;
let removedUrls = 0;
let repairedCovers = 0;

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isLocalAsset(url) {
  return typeof url === "string" && url.startsWith("./assets/catalog/");
}

for (const kit of catalog.kits) {
  if (franchiseFilter && kit.franchise !== franchiseFilter) {
    continue;
  }

  const originalCover = kit.images?.box_art_url || "";
  const originalGallery = kit.gallery_image_urls || [];
  const gallery = [];
  for (const url of originalGallery) {
    if (brokenUrls.has(url)) {
      removedUrls += 1;
    } else {
      gallery.push(url);
    }
  }

  if (brokenUrls.has(originalCover)) {
    const replacement = gallery.find(isLocalAsset) || gallery.find((url) => !brokenUrls.has(url)) || null;
    if (replacement) {
      kit.images = { ...(kit.images || {}), box_art_url: replacement };
      repairedCovers += 1;
    }
  }

  const nextGallery = unique([kit.images?.box_art_url, ...gallery]);
  if (nextGallery.join("\n") !== originalGallery.join("\n")) {
    kit.gallery_image_urls = nextGallery;
    changedKits += 1;
  }
}

if (changedKits || repairedCovers) {
  catalog.updated_at = new Date().toISOString().slice(0, 10);
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

console.log(`Pruned ${removedUrls} broken image URLs from ${changedKits} kits. Repaired covers: ${repairedCovers}.`);
