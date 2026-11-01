// The Gundam Wiki (gundam.fandom.com) Mobile Weapons master: one page per mobile weapon,
// titled "<model number> <name>" (the canonical MS id used across Hobby Atlas).
// Reads Category:Mobile_Weapons via the MediaWiki API (lead section only) and parses
// {{Infobox/Mobile Weapon}}: english, kanji (JA name with model number), era, debut, series.
// Also resolves Gunplapedia "Model of" titles that are redirects on the Gundam Wiki.
//
// Output: data/atlas/gundam-src-gundamwiki.json (pipeline snapshot, CC BY-SA 3.0 derived).
// Fetching is off until a human confirms Fandom's robots/API policy (lib/policy.mjs,
// ATLAS_FANDOM_CONFIRMED=1); until then this step keeps the committed snapshot.
// On API failure the previous snapshot is kept; with none, ATLAS_FANDOM_FALLBACK_DIR may point
// at a research dump (<dir>/fandom/mobile-weapons.json).
import { existsSync } from "node:fs";
import path from "node:path";
import { requestSummary } from "./lib/http.mjs";
import { cleanWiki, extractTemplate, pageText, queryAll, resolveRedirects, templateParams } from "./lib/mediawiki.mjs";
import { FANDOM_POLICY } from "./lib/policy.mjs";
import { ATLAS_DATA, readJson, today, writeCompactJson } from "./lib/util.mjs";

const HOST = "gundam.fandom.com";
const OUT = path.join(ATLAS_DATA, "gundam-src-gundamwiki.json");
const GUNPLAPEDIA = path.join(ATLAS_DATA, "gundam-src-gunplapedia.json");

function parseMs(title, wikitext) {
  const body = extractTemplate(wikitext, /Infobox\/Mobile[ _]Weapon/);
  const ib = body ? templateParams(body) : {};
  const series = String(ib.series || "")
    .replace(/<br\s*\/?>/gi, ",")
    .split(/\s*,\s*|\n+/)
    .map((s) => cleanWiki(s.replace(/~.*$/, "")).replace(/\s*\(\s*$/, "").trim())
    .filter((s) => s && s.length < 120);
  const tabs = String(ib.tabs || "")
    .split(/\s*,\s*/)
    .map((t) => t.split(";")[1]?.trim())
    .filter(Boolean);
  const ms = { t: title };
  const english = cleanWiki(ib.english);
  if (english && english !== title) ms.en = english;
  const kanji = cleanWiki(ib.kanji);
  if (kanji) ms.ja = kanji;
  const era = cleanWiki(ib.era);
  if (era) ms.era = era;
  const debut = cleanWiki(ib.debut);
  if (debut) ms.debut = debut;
  if (series.length) ms.series = [...new Set(series)];
  const type = cleanWiki(ib.type);
  if (type) ms.type = type;
  const arch = cleanWiki(ib.archetype);
  if (arch) ms.arch = arch;
  if (tabs.length > 1) ms.tabs = tabs;
  if (!body) ms.no_infobox = true;
  return ms;
}

async function fromApi() {
  const ms = new Map();
  const { requests, stale } = await queryAll(
    HOST,
    {
      generator: "categorymembers",
      gcmtitle: "Category:Mobile_Weapons",
      gcmnamespace: "0",
      gcmlimit: "50",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      rvsection: "0",
    },
    (json) => {
      for (const p of json.query?.pages || []) {
        const text = pageText(p);
        if (!text && ms.has(p.title)) continue;
        ms.set(p.title, parseMs(p.title, text));
      }
    },
    { label: "gundamwiki", maxRequests: 400 },
  );
  return { ms: [...ms.values()], requests, stale, via: "api" };
}

async function fromDump(dir) {
  const raw = await readJson(path.join(dir, "fandom", "mobile-weapons.json"));
  return { ms: raw.map((p) => parseMs(p.title, p.wikitext)), requests: 0, stale: true, via: "research-dump" };
}

async function main() {
  const previous = await readJson(OUT, null);
  let result;
  try {
    result = await fromApi();
    if (result.ms.length < 2000) throw new Error(`only ${result.ms.length} pages`);
  } catch (error) {
    console.warn(`[gundamwiki] API failed: ${error.message}`);
    if (previous) {
      console.warn("[gundamwiki] keeping previous snapshot");
      return;
    }
    const dir = process.env.ATLAS_FANDOM_FALLBACK_DIR;
    if (!dir) throw error;
    result = await fromDump(dir);
  }
  const titles = new Set(result.ms.map((m) => m.t));

  // Resolve Gunplapedia "Model of" values that are not MS page titles (redirects / renames).
  let redirects = previous?.redirects || {};
  if (existsSync(GUNPLAPEDIA) && result.via === "api") {
    const gp = await readJson(GUNPLAPEDIA);
    const unknown = [...new Set(gp.kits.flatMap((k) => k.model_of || []))].filter((t) => !titles.has(t));
    try {
      const { redirects: map } = await resolveRedirects(HOST, unknown);
      redirects = Object.fromEntries([...map].filter(([, to]) => titles.has(to)).sort());
      console.log(`[gundamwiki] ${unknown.length} Gunplapedia model_of titles not in the MS category; ${Object.keys(redirects).length} resolved through redirects`);
    } catch (error) {
      console.warn(`[gundamwiki] redirect resolution failed (${error.message}); keeping previous map`);
    }
  }

  result.ms.sort((a, b) => a.t.localeCompare(b.t));
  const doc = {
    schema: 1,
    updated_at: today(),
    sources: [
      {
        name: "The Gundam Wiki (Fandom), Category:Mobile Weapons",
        url: `https://${HOST}/wiki/Category:Mobile_Weapons`,
        licence: "CC BY-SA 3.0; attribution: The Gundam Wiki contributors",
        via: result.via,
        stale: result.stale,
        crawl_policy: FANDOM_POLICY,
      },
    ],
    stats: {
      pages: result.ms.length,
      with_infobox: result.ms.filter((m) => !m.no_infobox).length,
      with_kanji: result.ms.filter((m) => m.ja).length,
      with_series: result.ms.filter((m) => m.series).length,
    },
    ms: result.ms,
    redirects,
  };
  const res = await writeCompactJson(OUT, doc);
  console.log(`[gundamwiki] ${JSON.stringify(doc.stats)} via ${result.via} (${result.requests} requests). ${res.written ? "Wrote" : "Unchanged"} ${(res.bytes / 1024).toFixed(0)} KB`);
  console.log("[gundamwiki] requests", JSON.stringify(requestSummary()));
}

main().catch((error) => {
  console.error(`[gundamwiki] FAILED, previous data kept: ${error.stack || error.message}`);
  process.exitCode = process.env.ATLAS_STRICT === "1" ? 1 : 0;
});
