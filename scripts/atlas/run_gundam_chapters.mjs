// Hobby Atlas Gundam chapters pipeline: fetch the three chapter sources politely, then build
// data/atlas/gundam-chapters.json (per-arc and per-episode MS lists).
//
//   node scripts/atlas/run_gundam_chapters.mjs          fetch all sources, then build
//   node scripts/atlas/run_gundam_chapters.mjs --build  build only (no network; committed snapshots)
//
// Run after run_gundam.mjs: MS ids come from data/atlas/gundam-ms.json and kit ids from
// data/atlas/gundam-kit-ms.json. Each fetch step runs in
// its own process and fails softly, keeping its previous snapshot
// (data/atlas/gundam-src-{episodes,gget-stages,official-episodes}.json). The build refuses to
// overwrite gundam-chapters.json when the number of MS links drops by more than 20%
// (ATLAS_MIN_CHAPTER_RATIO). Raw responses are cached in ATLAS_CACHE_DIR (never committed).
//
// Gundam Wiki (Fandom): robots.txt answers our bot with a Cloudflare challenge, so the episodes
// step is skipped unless a human confirmed the policy and set ATLAS_FANDOM_CONFIRMED=1 (see
// lib/policy.mjs); the build then uses the committed gundam-src-episodes.json snapshot.
//
// Environment: ATLAS_CACHE_DIR, ATLAS_GGET_STAGES=new|all|none, ATLAS_FANDOM_CONFIRMED=1,
// ATLAS_FANDOM_FALLBACK_DIR, ATLAS_STRICT=1, ATLAS_FORCE=1.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FANDOM_CONFIRMED } from "./lib/policy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const buildOnly = process.argv.includes("--build");
const steps = [
  ...(buildOnly
    ? []
    : [
        ...(FANDOM_CONFIRMED || process.env.ATLAS_OFFLINE === "1" ? [["Gundam Wiki episodes (gundam.fandom.com)", "import_gundamwiki_episodes.mjs"]] : []),
        ["G Gen ETERNAL stages (soshage.com)", "import_gget_stages.mjs"],
        ["Official episode subtitles (gundam-official.com)", "import_official_episodes.mjs"],
      ]),
  ["Build chapters", "build_gundam_chapters.mjs"],
];

if (!buildOnly && !FANDOM_CONFIRMED && process.env.ATLAS_OFFLINE !== "1") {
  console.log("Gundam Wiki episodes step skipped: Fandom robots/API policy not confirmed by a human (ATLAS_FANDOM_CONFIRMED unset); using the committed gundam-src-episodes.json snapshot.");
}
const results = [];
for (const [label, script] of steps) {
  console.log(`\n=== ${label} ===`);
  const started = Date.now();
  const res = spawnSync(process.execPath, [path.join(here, script)], { stdio: "inherit", env: process.env });
  results.push({ label, ok: res.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}
console.log("\n=== summary ===");
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.label} (${r.seconds}s)`);
process.exitCode = results.at(-1).ok ? 0 : 1;
