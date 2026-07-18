import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DB_PATH = "data/bbx-database.json";
const OUT_DIR = "app/assets/bbx";
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
const limit = Number(options.limit || process.env.BBX_IMAGE_CACHE_LIMIT || 0);
const concurrency = Number(options.concurrency || process.env.BBX_IMAGE_CACHE_CONCURRENCY || 8);
const includeParts = flags.has("--parts") || process.env.BBX_IMAGE_CACHE_PARTS === "true";
const userAgent = "Mozilla/5.0 GunpulaBBXImageCache/1.0";

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

function extFor(url, contentType = "") {
  const ext = path.extname(new URL(url).pathname).toLowerCase().replace(".", "");
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  return "jpg";
}

function safeStem(value) {
  return String(value || "bbx")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sourceUrl(record, field) {
  const current = record?.[field];
  if (/^https?:\/\//i.test(current || "")) return current;
  if (field === "image" && /^https?:\/\//i.test(record?.image_remote || "")) return record.image_remote;
  return "";
}

function collectTasks(db) {
  const tasks = [];
  const add = (record, field, ownerId) => {
    const url = sourceUrl(record, field);
    if (!url) return;
    tasks.push({ record, field, ownerId, url });
  };
  for (const product of db.products || []) add(product, "image", product.product_id || product.base_set_id);
  if (includeParts) {
    for (const list of Object.values(db.parts || {})) {
      for (const part of list || []) {
        add(part, "image", part.part_id);
        add(part, "image_fallback", part.part_id);
      }
    }
  }
  const seen = new Set();
  return tasks.filter((task) => {
    const key = `${task.field}:${task.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Referer": "https://beyblade.phstudy.org/",
      "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !/^image\//i.test(contentType)) throw new Error(`unexpected content-type ${contentType}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType };
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

const db = JSON.parse(await readFile(DB_PATH, "utf8"));
await mkdir(OUT_DIR, { recursive: true });
const tasks = collectTasks(db).slice(0, limit > 0 ? limit : undefined);
const urlMap = new Map();
let cached = 0;
let skipped = 0;
let failed = 0;

await mapLimit(tasks, async (task) => {
  const hash = createHash("sha1").update(task.url).digest("hex").slice(0, 10);
  let filename = `${safeStem(task.ownerId)}-${hash}.${extFor(task.url)}`;
  let file = path.join(OUT_DIR, filename);
  let publicUrl = `./assets/bbx/${filename}`;
  try {
    if (!(await exists(file))) {
      const image = await fetchImage(task.url);
      filename = `${safeStem(task.ownerId)}-${hash}.${extFor(task.url, image.contentType)}`;
      file = path.join(OUT_DIR, filename);
      publicUrl = `./assets/bbx/${filename}`;
      if (!(await exists(file))) await writeFile(file, image.bytes);
      cached += 1;
    } else {
      skipped += 1;
    }
    urlMap.set(task.url, publicUrl);
  } catch (error) {
    failed += 1;
    console.warn(`Failed to cache ${task.ownerId}: ${error.message} ${task.url}`);
  }
});

let rewritten = 0;
for (const task of tasks) {
  const local = urlMap.get(task.url);
  if (!local || task.record[task.field] === local) continue;
  if (task.field === "image" && !task.record.image_remote) task.record.image_remote = task.url;
  task.record[task.field] = local;
  rewritten += 1;
}

db.updated_at = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
await writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
await writeFile(
  path.join(OUT_DIR, "image-cache-manifest.json"),
  `${JSON.stringify({ updated_at: new Date().toISOString(), cached, skipped, failed, rewritten, include_parts: includeParts }, null, 2)}\n`,
  "utf8",
);
console.log(`BBX images: cached ${cached}, skipped ${skipped}, failed ${failed}, rewritten ${rewritten}.`);
