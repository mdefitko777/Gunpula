import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { dropCachedOriginals } from "./lib/cached-originals.mjs";

const CATALOG_PATH = "data/kits.json";
const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);

const allImages = flags.has("--all");
const coversOnly = flags.has("--covers-only") || !flags.has("--gallery");
const rewriteCatalog = flags.has("--rewrite");
const repoAssets = flags.has("--repo-assets");
const premiumBandaiOnly = flags.has("--premium-bandai");
const franchiseFilter = options.franchise || process.env.IMAGE_CACHE_FRANCHISE || "";
const kitIdsPath = options["kit-ids"] || process.env.IMAGE_CACHE_KIT_IDS || "";
const maxItems = Number(options.limit || process.env.IMAGE_CACHE_LIMIT || 0);
const concurrency = Number(options.concurrency || process.env.IMAGE_CACHE_CONCURRENCY || 6);
const externalCacheRoot = path.resolve(process.env.IMAGE_CACHE_DIR || "../image-cache/catalog");
const assetRoot = path.resolve("app/assets/catalog");
// --polite: the crawling rules of the newer importers — the bot says who it is
// (no browser user-agent, no made-up Referer), robots.txt is read first and
// obeyed, each host gets one request at a time at least POLITE_GAP_MS apart,
// and a host that answers 403 / 429 / 503 or a non-image page (bot check) is
// left alone for the rest of the run; its covers are tried again next run.
// --host=a.example,b.example limits the run to covers on those hosts.
const polite = flags.has("--polite");
const hostFilter = new Set((options.host || "").split(",").map((host) => host.trim()).filter(Boolean));
const POLITE_GAP_MS = 1100;
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const userAgent = polite
  ? BOT_UA
  : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 GunpulaImageCache/1.0";

function shouldCacheUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const parsed = new URL(url);
  if (hostFilter.size && !hostFilter.has(parsed.hostname)) return false;
  return (
    allImages ||
    repoAssets ||
    parsed.searchParams.has("Expires") ||
    /cloudfront\.net|takaratomy\.co\.jp|bandai-a\.akamaihd\.net|bandai-hobby\.net|bandai\.co\.jp/i.test(parsed.hostname)
  );
}

function extensionFor(url, contentType = "") {
  const pathname = new URL(url).pathname;
  const existing = path.extname(pathname).toLowerCase().replace(".", "");
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(existing)) return existing === "jpeg" ? "jpg" : existing;
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  return "jpg";
}

function safeStem(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function cacheName(kit, url, index, contentType) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  return `${safeStem(kit.kit_id)}-${String(index + 1).padStart(2, "0")}-${hash}.${extensionFor(url, contentType)}`;
}

function cacheDirFor(kit) {
  return repoAssets ? path.join(assetRoot, kit.franchise) : path.join(externalCacheRoot, kit.franchise || "misc");
}

function publicUrlFor(kit, filename) {
  return repoAssets ? `./assets/catalog/${kit.franchise}/${filename}` : filename;
}

function isRepoAssetUrl(url) {
  return typeof url === "string" && url.startsWith("./assets/catalog/");
}

function imageCandidates(kit) {
  return [...new Set([kit.images?.box_art_url, ...(kit.gallery_image_urls || [])].filter(Boolean))];
}

function isPremiumBandaiKit(kit) {
  const text = [
    ...(kit.source_urls || []),
    ...(kit.source_refs || []).flatMap((ref) => [ref.source_id, ref.url]),
    ...(kit.tags || []),
    kit.sales_channel,
    kit.notes,
  ]
    .filter(Boolean)
    .join(" ");
  return /p-bandai\.jp|p_bandai_jp|premium\s*bandai|p-?bandai|プレミアムバンダイ|プレバン/i.test(text);
}

function refererFor(kit, url) {
  return kit.source_urls?.find((sourceUrl) => {
    try {
      return new URL(sourceUrl).hostname === new URL(url).hostname;
    } catch {
      return false;
    }
  }) || kit.source_urls?.[0] || new URL(url).origin;
}

const kitIdFilter = kitIdsPath
  ? new Set(
      (await readFile(kitIdsPath, "utf8"))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
  : new Set();

// Polite mode: per-host queue, robots.txt, refusal stops the host.
const hostState = new Map();

function politeHost(host) {
  if (!hostState.has(host)) hostState.set(host, { chain: Promise.resolve(), nextAt: 0, robots: undefined, refused: null });
  return hostState.get(host);
}

// Disallow rules for "*" or this bot ("hobbyatlasdatabot"); a robots.txt that
// is missing or not plain text (a soft-404 page) allows everything.
async function robotsDisallows(host) {
  const state = politeHost(host);
  if (state.robots === undefined) {
    state.robots = [];
    try {
      const response = await fetch(`https://${host}/robots.txt`, { headers: { "User-Agent": BOT_UA } });
      const text = response.ok && /text\/plain/i.test(response.headers.get("content-type") || "") ? await response.text() : "";
      let applies = false;
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.replace(/#.*/, "").trim();
        const [key, ...rest] = line.split(":");
        const value = rest.join(":").trim();
        if (/^user-agent$/i.test(key)) applies = value === "*" || /hobbyatlasdatabot/i.test(value);
        else if (applies && /^disallow$/i.test(key) && value) state.robots.push(value);
      }
    } catch {
      // unreachable robots.txt: treated as missing
    }
    state.nextAt = Date.now() + POLITE_GAP_MS;
  }
  return state.robots;
}

async function politeFetch(url) {
  const { host, pathname } = new URL(url);
  const state = politeHost(host);
  const run = async () => {
    if (state.refused) throw new Error(`host refused earlier: ${state.refused}`);
    const rules = await robotsDisallows(host);
    if (rules.some((rule) => pathname.startsWith(rule))) throw new Error("robots.txt disallows");
    const wait = state.nextAt - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const response = await fetch(url, { headers: { "User-Agent": BOT_UA, Accept: "image/*" } });
      const type = response.headers.get("content-type") || "";
      if ([403, 429, 503].includes(response.status) || (response.ok && !/^image\//i.test(type))) {
        state.refused = `HTTP ${response.status} ${type}`;
      }
      return response;
    } finally {
      state.nextAt = Date.now() + POLITE_GAP_MS;
    }
  };
  const result = state.chain.then(run, run);
  state.chain = result.catch(() => {});
  return result;
}

async function fetchImage(kit, url) {
  const response = polite
    ? await politeFetch(url)
    : await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          "Referer": refererFor(kit, url),
          "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        },
      });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/^image\//i.test(contentType)) {
    throw new Error(`unexpected content-type ${contentType}`);
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

async function mapLimit(items, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index], index);
      }
    }),
  );
}

const selectedKits = catalog.kits
  .filter((kit) => !franchiseFilter || kit.franchise === franchiseFilter)
  .filter((kit) => !premiumBandaiOnly || isPremiumBandaiKit(kit))
  .filter((kit) => !kitIdsPath || kitIdFilter.has(kit.kit_id))
  .slice(0, maxItems > 0 ? maxItems : undefined);

const tasks = [];
for (const kit of selectedKits) {
  if (coversOnly && repoAssets && rewriteCatalog && isRepoAssetUrl(kit.images?.box_art_url)) {
    continue;
  }
  const urls = imageCandidates(kit)
    .map((url, index) => ({ url, index }))
    .filter((entry) => shouldCacheUrl(entry.url));
  if (urls.length) {
    tasks.push({ kit, urls });
  }
}

const urlMap = new Map();
const coverMap = new Map();
const manifest = [];
let cached = 0;
let skipped = selectedKits.length - tasks.length;
let failed = 0;

await mapLimit(tasks, async (task) => {
  let cachedForKit = false;
  for (const entry of task.urls) {
    try {
      const image = await fetchImage(task.kit, entry.url);
      const filename = cacheName(task.kit, entry.url, entry.index, image.contentType);
      const cacheDir = cacheDirFor(task.kit);
      await mkdir(cacheDir, { recursive: true });
      await writeFile(path.join(cacheDir, filename), image.bytes);
      const publicUrl = publicUrlFor(task.kit, filename);
      urlMap.set(entry.url, publicUrl);
      manifest.push({
        kit_id: task.kit.kit_id,
        franchise: task.kit.franchise,
        source_url: entry.url,
        cached_url: publicUrl,
        bytes: image.bytes.length,
      });
      cached += 1;
      cachedForKit = true;
      if (coversOnly && !coverMap.has(task.kit.kit_id)) {
        coverMap.set(task.kit.kit_id, {
          sourceUrl: entry.url,
          cachedUrl: publicUrl,
        });
        break;
      }
    } catch (error) {
      failed += 1;
      console.warn(`Failed to cache ${task.kit.kit_id}: ${error.message} ${entry.url}`);
    }
  }
  if (!cachedForKit) {
    skipped += 1;
  }
});

let updatedKits = 0;
if (rewriteCatalog && repoAssets) {
  for (const kit of catalog.kits) {
    if (franchiseFilter && kit.franchise !== franchiseFilter) continue;
    const cover = coverMap.get(kit.kit_id);
    const cachedCover = cover?.cachedUrl || urlMap.get(kit.images?.box_art_url);
    if (!cachedCover) continue;

    const gallery = [
      cachedCover,
      kit.images?.box_art_url,
      cover?.sourceUrl,
      ...(kit.gallery_image_urls || []).map((url) => urlMap.get(url) || url),
    ];
    kit.images = {
      ...(kit.images || {}),
      box_art_url: cachedCover,
    };
    kit.gallery_image_urls = [...new Set(gallery.filter(Boolean))];
    dropCachedOriginals(kit);
    updatedKits += 1;
  }
  catalog.updated_at = new Date().toISOString().slice(0, 10);
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}

const manifestRoot = repoAssets ? assetRoot : externalCacheRoot;
await mkdir(manifestRoot, { recursive: true });
await writeFile(
  path.join(manifestRoot, "image-cache-manifest.json"),
  `${JSON.stringify({ updated_at: new Date().toISOString(), cached, skipped, failed, repo_assets: repoAssets, covers_only: coversOnly, items: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Cached ${cached}/${tasks.length} images. Skipped ${skipped}. Failed ${failed}.`);
console.log(`Cache root: ${repoAssets ? path.relative(process.cwd(), assetRoot) : externalCacheRoot}`);
if (rewriteCatalog) {
  console.log(`Updated ${updatedKits} catalog records.`);
}
