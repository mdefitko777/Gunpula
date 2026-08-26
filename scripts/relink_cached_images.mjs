import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CATALOG_PATH = "data/kits.json";
const checkOnly = process.argv.includes("--check");

function safeStem(value) {
  return String(value || "image")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function urlExtension(url) {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase().replace(".", "");
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) return extension === "jpeg" ? "jpg" : extension;
  } catch {
    // A malformed remote URL has no reusable cache entry.
  }
  return "jpg";
}

async function directoryFiles(directory, cache) {
  if (cache.has(directory)) return cache.get(directory);
  let files = [];
  try {
    files = await readdir(directory);
  } catch {
    // The franchise has no local cache yet.
  }
  cache.set(directory, files);
  return files;
}

async function existingCatalogAsset(kit, url, index, fileCache) {
  if (!/^https?:\/\//i.test(url || "")) return "";
  const directory = path.join("app", "assets", "catalog", kit.franchise || "misc");
  const files = await directoryFiles(directory, fileCache);
  const stem = safeStem(kit.kit_id);
  const slot = String(index + 1).padStart(2, "0");
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  const exact = `${stem}-${slot}-${hash}.${urlExtension(url)}`;
  const filename = files.includes(exact)
    ? exact
    : files.find((file) => file.startsWith(`${stem}-${slot}-${hash}.`))
      || files.find((file) => file.startsWith(`${stem}-${slot}-`));
  return filename ? `./assets/catalog/${kit.franchise}/${filename}` : "";
}

async function existingArmoredCoreAsset(kit, index, fileCache) {
  if (kit.franchise !== "armored_core") return "";
  const directory = path.join("app", "assets", "kotobukiya-ac");
  const files = await directoryFiles(directory, fileCache);
  const prefix = `${safeStem(kit.kit_id)}-${String(index + 1).padStart(2, "0")}.`;
  const filename = files.find((file) => file.startsWith(prefix));
  return filename ? `./assets/kotobukiya-ac/${filename}` : "";
}

async function cachedAsset(kit, url, index, fileCache) {
  return (await existingCatalogAsset(kit, url, index, fileCache))
    || (await existingArmoredCoreAsset(kit, index, fileCache));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const fileCache = new Map();
let relinkedCovers = 0;
let relinkedGalleryImages = 0;

for (const kit of catalog.kits || []) {
  const originalCover = kit.images?.box_art_url || "";
  if (!/^https?:\/\//i.test(originalCover)) continue;

  const originalGallery = unique([originalCover, ...(kit.gallery_image_urls || [])]);
  const localGallery = [];
  for (const [index, url] of originalGallery.entries()) {
    const local = await cachedAsset(kit, url, index, fileCache);
    if (local) {
      localGallery.push(local);
      relinkedGalleryImages += 1;
    }
  }
  const localCover = localGallery[0] || "";
  if (!localCover) continue;

  kit.images = { ...(kit.images || {}), box_art_url: localCover };
  kit.gallery_image_urls = unique([localCover, ...localGallery, ...originalGallery]);
  relinkedCovers += 1;
}

console.log(`Reusable local images: ${relinkedCovers} covers, ${relinkedGalleryImages} gallery files.`);
if (checkOnly) {
  if (relinkedCovers) {
    console.error("Catalog contains remote covers that already have local cache files. Run npm run relink:images.");
    process.exitCode = 1;
  }
} else if (relinkedCovers) {
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Updated ${CATALOG_PATH}.`);
}
