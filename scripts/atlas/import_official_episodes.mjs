// Import official Japanese episode subtitles from the GUNDAM Official Website.
//
//   GET https://gundam-official.com/series/<slug>    (apex domain; www. does not exist)
//
// The page is a Next.js app-router page; its data travels in `self.__next_f.push([1,"..."])`
// RSC chunks. Joined, they contain the series object with
//   title, slug, episodes_connection.nodes[{episodeNumber, documentId, subtile}],
//   addSeasons[{episodes_connection: {...}}]   (later seasons kept on the same page, e.g. 00)
// Only names and numbers are stored (no synopsis, no images).
//
// Output: data/atlas/gundam-src-official-episodes.json (pipeline snapshot). A slug that fails
// keeps its previous entry; if the host is unreachable the previous snapshot is kept.
import path from "node:path";
import { officialSlugs } from "./gundam_chapter_works.mjs";
import { politeFetch, requestSummary } from "./lib/http.mjs";
import { parseSeries, rscText } from "./lib/official_rsc.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const OUT = path.join(ATLAS_DATA, "gundam-src-official-episodes.json");
const HOST = "https://gundam-official.com";

async function main() {
  const previous = await readJson(OUT, null);
  const prevBySlug = new Map((previous?.series || []).map((s) => [s.slug, s]));
  const out = [];
  let ok = 0;
  let failed = 0;
  let stale = false;
  for (const slug of officialSlugs()) {
    try {
      const res = await politeFetch(`${HOST}/series/${slug}`, { ttlHours: 24 * 6, accept: "text/html" });
      stale ||= res.stale;
      const text = rscText(res.body);
      if (!text) throw new Error("no RSC payload");
      const { title, seasons } = parseSeries(text, slug);
      out.push({ slug, title, seasons });
      ok++;
    } catch (error) {
      failed++;
      const prev = prevBySlug.get(slug);
      console.warn(`[official] ${slug} failed: ${error.message}${prev ? " (keeping previous)" : ""}`);
      if (prev) out.push(prev);
    }
  }
  if (!ok && previous) {
    console.warn("[official] no series page could be read; keeping previous snapshot");
    return;
  }
  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "GUNDAM Official Website (series pages)",
        url: `${HOST}/series`,
        licence: "© 創通・サンライズ. Official site without a reuse licence: episode numbers and official subtitles stored as facts only; no text or images copied.",
        stale,
      },
    ],
    series: out,
  };
  const res = await writeCompactJson(OUT, doc);
  const eps = out.reduce((n, s) => n + s.seasons.reduce((m, x) => m + x.length, 0), 0);
  console.log(`[official] ${out.length} series (${ok} read, ${failed} failed), ${eps} episodes. ${res.written ? "Wrote" : "Unchanged"} ${path.basename(OUT)} (${(res.bytes / 1024).toFixed(0)} KB)`);
  for (const s of out) console.log(`  ${s.slug}: ${s.title || "?"} — ${s.seasons.map((x) => x.length).join("+") || 0} episodes`);
  console.log("[official] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[official] FAILED, previous snapshot kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
