// Gunplapedia (gunpla.fandom.com) kit pages -> JAN, "Model of" (Gundam Wiki MS titles),
// Japanese name, grade line and lineup number. MediaWiki API, lead section only.
//
// Output: data/atlas/gundam-src-gunplapedia.json (pipeline snapshot, CC BY-SA 3.0 derived).
// If the API refuses us, the previous snapshot is kept. With no previous snapshot,
// ATLAS_FANDOM_FALLBACK_DIR may point at a research dump (<dir>/gunplapedia/all-pages.json).
import { existsSync } from "node:fs";
import path from "node:path";
import { requestSummary } from "./lib/http.mjs";
import { cleanWiki, extractTemplate, pageText, queryAll, templateParams } from "./lib/mediawiki.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const HOST = "gunpla.fandom.com";
const OUT = path.join(ATLAS_DATA, "gundam-src-gunplapedia.json");
const INFOBOX = /(?:Plamo|Gunpla)[ _]Infobox/;

function parseKit(title, wikitext) {
  const body = extractTemplate(wikitext, INFOBOX);
  if (!body) return null;
  const ib = templateParams(body);
  const list = (v) =>
    cleanWiki(v)
      .split(/\s*[;,]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  const kit = {
    title,
    grade: cleanWiki(ib.classification) || undefined,
    no: cleanWiki(ib["lineup no."]) || undefined,
    scale: cleanWiki(ib.scale) || undefined,
    franchise: cleanWiki(ib.franchise) || undefined,
    release: cleanWiki(ib["release date"]) || undefined,
    jan: [...new Set(String(ib["jan/isbn"] || "").match(/\d{13}/g) || [])],
    model_of: list(ib["model of"]),
    ja: cleanWiki(ib["japanese name"]) || undefined,
    variant_of: cleanWiki(ib["variant of"]) || undefined,
  };
  if (!kit.jan.length) delete kit.jan;
  if (!kit.model_of.length) delete kit.model_of;
  return kit;
}

async function fromApi() {
  const kits = [];
  let pages = 0;
  const { requests, stale } = await queryAll(
    HOST,
    {
      generator: "allpages",
      gapnamespace: "0",
      gaplimit: "50",
      gapfilterredir: "nonredirects",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      rvsection: "0",
    },
    (json) => {
      for (const p of json.query?.pages || []) {
        pages++;
        const kit = parseKit(p.title, pageText(p));
        if (kit) kits.push(kit);
      }
    },
    { label: "gunplapedia", maxRequests: 300 },
  );
  return { kits, pages, requests, stale, via: "api" };
}

async function fromDump(dir) {
  const raw = await readJson(path.join(dir, "gunplapedia", "all-pages.json"));
  const kits = raw.map((p) => parseKit(p.title, p.wikitext)).filter(Boolean);
  return { kits, pages: raw.length, requests: 0, stale: true, via: "research-dump" };
}

async function main() {
  let result;
  try {
    result = await fromApi();
    if (result.kits.length < 1000) throw new Error(`only ${result.kits.length} kit pages parsed`);
  } catch (error) {
    console.warn(`[gunplapedia] API failed: ${error.message}`);
    if (existsSync(OUT)) {
      console.warn("[gunplapedia] keeping previous snapshot");
      return;
    }
    const dir = process.env.ATLAS_FANDOM_FALLBACK_DIR;
    if (!dir) throw error;
    result = await fromDump(dir);
  }
  result.kits.sort((a, b) => a.title.localeCompare(b.title));
  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "Gunplapedia (Fandom)",
        url: `https://${HOST}/`,
        licence: "CC BY-SA 3.0 (text and data derived from wiki articles); attribution: Gunplapedia contributors",
        via: result.via,
        stale: result.stale,
      },
    ],
    stats: {
      pages: result.pages,
      kits: result.kits.length,
      with_jan: result.kits.filter((k) => k.jan).length,
      with_model_of: result.kits.filter((k) => k.model_of).length,
      with_ja: result.kits.filter((k) => k.ja).length,
    },
    kits: result.kits,
  };
  const res = await writeCompactJson(OUT, doc);
  console.log(`[gunplapedia] ${JSON.stringify(doc.stats)} via ${result.via} (${result.requests} requests). ${res.written ? "Wrote" : "Unchanged"} ${(res.bytes / 1024).toFixed(0)} KB`);
  console.log("[gunplapedia] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[gunplapedia] FAILED, previous data kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
