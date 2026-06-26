import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
const args = process.argv.slice(2);
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);
const flags = new Set(args.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
const limit = Number(options.limit || process.env.IMAGE_CHECK_LIMIT || 0);
const franchiseFilter = options.franchise || process.env.IMAGE_CHECK_FRANCHISE || "";
const concurrency = Number(options.concurrency || process.env.IMAGE_CHECK_CONCURRENCY || 8);
const localOnly = flags.has("--local") || flags.has("--local-only") || process.env.IMAGE_CHECK_LOCAL_ONLY === "1";
const includeLocal = localOnly || process.env.IMAGE_CHECK_LOCAL === "1";
const outputPath = options.output || process.env.IMAGE_HEALTH_OUTPUT || "data/image-health.json";
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 GunpulaImageHealth/1.0";

function imageCandidates(kit) {
  return [...new Set([kit.images?.box_art_url, ...(kit.gallery_image_urls || [])].filter(Boolean))];
}

function shouldCheck(url) {
  if (url.startsWith("./")) return includeLocal;
  if (localOnly) return false;
  if (/^https?:\/\//i.test(url)) return true;
  return false;
}

function localFilePath(url) {
  return path.resolve("app", url.replace(/^\.\/?/, ""));
}

async function checkRemote(item) {
  try {
    const response = await fetch(item.url, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
    });
    return {
      ...item,
      ok: response.ok,
      status: response.status,
      content_type: response.headers.get("content-type"),
    };
  } catch (error) {
    return { ...item, ok: false, status: 0, error: error.message };
  }
}

async function checkLocal(item) {
  try {
    const file = await readFile(localFilePath(item.url));
    return { ...item, ok: file.length > 0, status: file.length > 0 ? 200 : 0, content_type: "local-file", bytes: file.length };
  } catch (error) {
    return { ...item, ok: false, status: 0, error: error.message };
  }
}

async function check(item) {
  return item.url.startsWith("./") ? checkLocal(item) : checkRemote(item);
}

async function mapLimit(items, mapper) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index]);
      }
    }),
  );
  return results;
}

const selectedKits = catalog.kits
  .filter((kit) => !franchiseFilter || kit.franchise === franchiseFilter)
  .slice(0, limit > 0 ? limit : undefined);

const checks = [];
for (const kit of selectedKits) {
  imageCandidates(kit)
    .filter(shouldCheck)
    .forEach((url, index) => {
      checks.push({
        kit_id: kit.kit_id,
        franchise: kit.franchise,
        name: kit.names?.ja || kit.names?.en || kit.kit_id,
        role: index === 0 ? "cover" : "fallback",
        url,
      });
    });
}

const results = await mapLimit(checks, check);
const byKit = new Map();
for (const result of results) {
  if (!byKit.has(result.kit_id)) {
    byKit.set(result.kit_id, []);
  }
  byKit.get(result.kit_id).push(result);
}

const broken = results.filter((item) => !item.ok);
const kitsWithoutWorkingImage = [];
for (const kit of selectedKits) {
  const kitResults = byKit.get(kit.kit_id) || [];
  if (!kitResults.length || kitResults.every((item) => !item.ok)) {
    kitsWithoutWorkingImage.push({
      kit_id: kit.kit_id,
      franchise: kit.franchise,
      name: kit.names?.ja || kit.names?.en || kit.kit_id,
      urls: imageCandidates(kit),
    });
  }
}

const byFranchise = {};
for (const kit of selectedKits) {
  byFranchise[kit.franchise] ||= { checked_kits: 0, broken_urls: 0, kits_without_working_image: 0 };
  byFranchise[kit.franchise].checked_kits += 1;
}
for (const item of broken) {
  byFranchise[item.franchise] ||= { checked_kits: 0, broken_urls: 0, kits_without_working_image: 0 };
  byFranchise[item.franchise].broken_urls += 1;
}
for (const item of kitsWithoutWorkingImage) {
  byFranchise[item.franchise] ||= { checked_kits: 0, broken_urls: 0, kits_without_working_image: 0 };
  byFranchise[item.franchise].kits_without_working_image += 1;
}

const report = {
  updated_at: new Date().toISOString(),
  checked_kits: selectedKits.length,
  checked_urls: results.length,
  broken_urls: broken.length,
  working_kits: selectedKits.length - kitsWithoutWorkingImage.length,
  kits_without_working_image: kitsWithoutWorkingImage.length,
  by_franchise: byFranchise,
  broken: broken.slice(0, 300),
  kits_without_working_image_items: kitsWithoutWorkingImage.slice(0, 300),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Checked ${results.length} image URLs for ${selectedKits.length} kits. Broken URLs: ${broken.length}. Kits without working image: ${kitsWithoutWorkingImage.length}.`);
console.log(`Wrote ${outputPath}.`);
for (const item of broken.slice(0, 80)) {
  console.log(`${item.status} ${item.kit_id} ${item.role} ${item.url}`);
}
if (kitsWithoutWorkingImage.length) {
  process.exitCode = 1;
}
