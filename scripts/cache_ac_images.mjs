import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const kitsPath = path.join(repoRoot, "data", "kits.json");
const assetDir = path.join(repoRoot, "app", "assets", "kotobukiya-ac");
const assetUrlPrefix = "./assets/kotobukiya-ac";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function extensionFrom(contentType, url) {
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("gif")) return "gif";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  const clean = new URL(url).pathname.toLowerCase();
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".gif")) return "gif";
  return "jpg";
}

function isKotobukiyaImage(url) {
  return typeof url === "string" && /^https:\/\/(?:www|shop)\.kotobukiya\.co\.jp\//.test(url);
}

function localAssetUrl(fileName) {
  return `${assetUrlPrefix}/${fileName}`;
}

async function downloadImage(url, referer, fileStem) {
  const response = await fetch(url, {
    headers: {
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Referer": referer,
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const extension = extensionFrom(response.headers.get("content-type"), url);
  const fileName = `${fileStem}.${extension}`;
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path.join(assetDir, fileName), buffer);
  return localAssetUrl(fileName);
}

async function mapWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function safeStem(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const kitsDoc = JSON.parse(await readFile(kitsPath, "utf8"));
await mkdir(assetDir, { recursive: true });

const tasks = [];
for (const kit of kitsDoc.kits) {
  if (kit.franchise !== "armored_core") {
    continue;
  }

  const referer = kit.source_urls?.find((url) => /kotobukiya\.co\.jp\/(?:product\/detail|shop\/g\/)/.test(url))
    || "https://shop.kotobukiya.co.jp/";
  const urls = [kit.images?.box_art_url, ...(kit.gallery_image_urls || [])].filter(isKotobukiyaImage);
  urls.forEach((url, index) => {
    tasks.push({
      kit,
      url,
      referer,
      fileStem: `${safeStem(kit.kit_id)}-${String(index + 1).padStart(2, "0")}`,
    });
  });
}

const urlMap = new Map();
let failed = 0;
await mapWithConcurrency(tasks, 5, async (task) => {
  try {
    urlMap.set(task.url, await downloadImage(task.url, task.referer, task.fileStem));
  } catch (error) {
    failed += 1;
    console.warn(`Failed to cache ${task.url}: ${error.message}`);
  }
});

let updatedKits = 0;
for (const kit of kitsDoc.kits) {
  if (kit.franchise !== "armored_core") {
    continue;
  }
  const nextBoxArt = urlMap.get(kit.images?.box_art_url) || kit.images?.box_art_url || null;
  const nextGallery = (kit.gallery_image_urls || []).map((url) => urlMap.get(url) || url);
  if (nextBoxArt !== kit.images?.box_art_url || nextGallery.some((url, index) => url !== kit.gallery_image_urls?.[index])) {
    kit.images = {
      ...(kit.images || {}),
      box_art_url: nextBoxArt,
    };
    kit.gallery_image_urls = [...new Set(nextGallery.filter(Boolean))];
    updatedKits += 1;
  }
}

await writeFile(kitsPath, `${JSON.stringify(kitsDoc, null, 2)}\n`);
console.log(`Cached ${urlMap.size}/${tasks.length} Armored Core images into ${path.relative(repoRoot, assetDir)}.`);
console.log(`Updated ${updatedKits} Armored Core records. Failed downloads: ${failed}.`);
