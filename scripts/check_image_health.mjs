import { readFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
const limit = Number(process.env.IMAGE_CHECK_LIMIT || 400);
const urls = catalog.kits
  .map((kit) => ({ kit_id: kit.kit_id, url: kit.images?.box_art_url }))
  .filter((item) => item.url && /^https?:\/\//i.test(item.url))
  .slice(0, limit);

async function check(item) {
  try {
    const response = await fetch(item.url, {
      method: "GET",
      headers: {
        "user-agent": "Gunpula image health check (+https://github.com/mdefitko777/Gunpula)",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
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

async function mapLimit(items, concurrency, mapper) {
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

const results = await mapLimit(urls, 8, check);
const broken = results.filter((item) => !item.ok);
console.log(`Checked ${results.length} remote cover images. Broken: ${broken.length}.`);
for (const item of broken.slice(0, 80)) {
  console.log(`${item.status} ${item.kit_id} ${item.url}`);
}
if (broken.length) {
  process.exitCode = 1;
}
