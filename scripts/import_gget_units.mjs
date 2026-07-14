import { writeFile } from "node:fs/promises";

// SD Gundam G Generation ETERNAL unit roster, used as the backbone of the in-app
// "图鉴" (picture-book): every mobile suit is one cell, grouped by work/series.
//
// soshage.com renders the list with SvelteKit and inlines its server-side `fetch`
// responses into the page HTML as `{"status":200,...,"body":"<json string>"}`
// <script> blocks. The two largest such blocks are the full unit array and the work
// (series) master; we parse both and join them. No public JSON endpoint is needed.
const SOURCE_URL = "https://soshage.com/gget/api/unit";
const IMAGE_BASE = "https://img.kusoge.xyz/ggenet/thumb";
const OUTPUT_PATH = "data/gget-units.json";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      accept: "text/html",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function extractPayloadArrays(html) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const arrays = [];
  for (const script of scripts) {
    const trimmed = script.trim();
    if (!trimmed.startsWith('{"status"')) continue;
    try {
      const envelope = JSON.parse(trimmed);
      const body = JSON.parse(envelope.body);
      if (Array.isArray(body) && body.length) arrays.push(body);
    } catch {
      // Not a JSON fetch-cache payload; skip.
    }
  }
  return arrays.sort((a, b) => b.length - a.length);
}

function normalizeRole(role) {
  return { 1: "attacker", 2: "defender", 3: "shooter" }[role] || String(role ?? "");
}

async function main() {
  const html = await fetchHtml(SOURCE_URL);
  const arrays = extractPayloadArrays(html);
  const units = arrays.find((arr) => arr[0] && arr[0].icon && arr[0].name);
  const works = arrays.find((arr) => arr[0] && arr[0].world_id !== undefined && arr[0].name);
  if (!units || !works) {
    throw new Error(`Could not locate unit (${units?.length}) or work (${works?.length}) payload in page`);
  }

  const workById = new Map(works.map((work) => [work.id, work.name]));
  const usedWorkIds = new Set();
  let unresolved = 0;

  const normalizedUnits = units.map((unit) => {
    const workIds = [...new Set((unit.series_set || []).map((entry) => entry.series_id).filter((id) => workById.has(id)))];
    if (!workIds.length) unresolved += 1;
    for (const id of workIds) usedWorkIds.add(id);
    return {
      unit_id: unit.id,
      icon: unit.icon,
      name: unit.name,
      rarity: unit.rarity,
      role: normalizeRole(unit.role),
      ult: Boolean(unit.ult),
      work_id: workIds[0] ?? null,
      work: workIds[0] != null ? workById.get(workIds[0]) : null,
      work_ids: workIds,
      image_url: `${IMAGE_BASE}/thum_${unit.icon}.webp`,
    };
  });

  const normalizedWorks = works
    .filter((work) => usedWorkIds.has(work.id))
    .map((work) => ({ work_id: work.id, world_id: work.world_id, name: work.name }))
    .sort((a, b) => a.work_id - b.work_id);

  const doc = {
    source: "soshage.com/gget — SD Gundam G Generation ETERNAL",
    source_url: SOURCE_URL,
    image_base: IMAGE_BASE,
    updated_at: today(),
    works: normalizedWorks,
    units: normalizedUnits.sort((a, b) => a.unit_id - b.unit_id),
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(
    `G Generation units: ${normalizedUnits.length} units across ${normalizedWorks.length} works ` +
      `(${unresolved} without a work). Wrote ${OUTPUT_PATH}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
