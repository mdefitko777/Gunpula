import { readFile, writeFile } from "node:fs/promises";

const SOURCE_URL = "https://soshage.com/gget/series";
const SECTIONS_PATH = "data/gget-series-sections.json";
const OUTPUT_PATH = "data/gget-series-pages.json";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "text/html",
    },
  });
  return { status: response.status, text: await response.text() };
}

function compact(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function main() {
  const sections = JSON.parse(await readFile(SECTIONS_PATH, "utf8"));
  const index = await fetchText(SOURCE_URL);
  if (index.status !== 200) throw new Error(`HTTP ${index.status} for ${SOURCE_URL}`);
  const pageIds = new Set([...index.text.matchAll(/href="\.\/series\/(\d+)"/g)].map((match) => Number(match[1])));
  const worksById = new Map((sections.works || []).map((work) => [Number(work.work_id), work]));
  const pages = [];
  for (const id of [...pageIds].sort((a, b) => a - b)) {
    const url = `https://soshage.com/gget/series/${id}`;
    const work = worksById.get(id);
    const page = await fetchText(url);
    const ok = page.status === 200;
    const expected = compact(work?.name || "");
    const matched = ok && expected ? compact(page.text).includes(expected.slice(0, Math.min(16, expected.length))) : false;
    pages.push({
      work_id: id,
      name: work?.name || null,
      section: work?.section || "unknown",
      url,
      fetch_status: ok ? "ok" : "error",
      http_status: page.status,
      name_checked: Boolean(expected),
      name_match: Boolean(matched),
    });
  }
  const doc = {
    source: "soshage.com/gget series pages",
    source_url: SOURCE_URL,
    updated_at: today(),
    total_pages: pages.length,
    matched_pages: pages.filter((page) => page.name_match).length,
    pages,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`GGET series pages: ${doc.matched_pages}/${doc.total_pages} checked → ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
