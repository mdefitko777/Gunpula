import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
const args = new Set(process.argv.slice(2));
const allImages = args.has("--all");
const cacheRoot = path.resolve(process.env.IMAGE_CACHE_DIR || "../image-cache/catalog");

function fragileImageUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const parsed = new URL(url);
  return (
    allImages ||
    parsed.searchParams.has("Expires") ||
    /cloudfront\.net|takaratomy\.co\.jp|bandai-a\.akamaihd\.net/i.test(parsed.hostname)
  );
}

function extensionFor(url, contentType = "") {
  const pathname = new URL(url).pathname;
  const existing = path.extname(pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(existing)) return existing;
  if (/png/i.test(contentType)) return ".png";
  if (/webp/i.test(contentType)) return ".webp";
  if (/gif/i.test(contentType)) return ".gif";
  return ".jpg";
}

function cacheName(kitId, url, contentType) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 12);
  return `${kitId}-${hash}${extensionFor(url, contentType)}`;
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Gunpula image cache (+https://github.com/mdefitko777/Gunpula)",
      accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "",
  };
}

await mkdir(cacheRoot, { recursive: true });

const manifest = [];
let cached = 0;
let skipped = 0;
let failed = 0;

for (const kit of catalog.kits) {
  const url = kit.images?.box_art_url;
  if (!fragileImageUrl(url)) {
    skipped += 1;
    continue;
  }

  try {
    const image = await fetchImage(url);
    const filename = cacheName(kit.kit_id, url, image.contentType);
    const filePath = path.join(cacheRoot, filename);
    await writeFile(filePath, image.bytes);
    manifest.push({
      kit_id: kit.kit_id,
      franchise: kit.franchise,
      source_url: url,
      cache_file: filename,
      bytes: image.bytes.length,
    });
    cached += 1;
  } catch (error) {
    failed += 1;
    console.warn(`Failed to cache ${kit.kit_id}: ${error.message}`);
  }
}

await writeFile(path.join(cacheRoot, "image-cache-manifest.json"), `${JSON.stringify({ updated_at: new Date().toISOString(), cached, skipped, failed, items: manifest }, null, 2)}\n`, "utf8");
console.log(`Cached ${cached} images to ${cacheRoot}. Skipped ${skipped}. Failed ${failed}.`);
