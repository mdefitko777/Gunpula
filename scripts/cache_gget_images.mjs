import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

// Download the SD Gundam G Generation unit art for the mapped works into repo assets,
// so the 图鉴 renders local images (dimmed for un-owned) instead of hotlinking the CDN.
const GGET_PATH = "data/gget-units.json";
const OUT_DIR = "app/assets/gget";
const TARGET_WORK = /Gundam 00(?!8)|Gundam SEED|Witch from Mercury/i;
const DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const gget = JSON.parse(await readFile(GGET_PATH, "utf8"));
  const workIds = new Set(gget.works.filter((w) => TARGET_WORK.test(w.name)).map((w) => w.work_id));
  const units = gget.units.filter((u) => u.work_ids.some((id) => workIds.has(id)));
  await mkdir(OUT_DIR, { recursive: true });

  let cached = 0;
  let skipped = 0;
  let failed = 0;
  for (const unit of units) {
    const file = path.join(OUT_DIR, `${unit.icon}.webp`);
    if (await exists(file)) {
      skipped += 1;
      continue;
    }
    try {
      await sleep(DELAY_MS);
      const res = await fetch(unit.image_url, {
        headers: { "user-agent": "Mozilla/5.0", referer: "https://soshage.com/" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      cached += 1;
    } catch (error) {
      failed += 1;
      console.error(`fail ${unit.icon}: ${error.message}`);
    }
  }
  console.log(`gget images: cached ${cached}, skipped ${skipped}, failed ${failed} (of ${units.length} units) → ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
