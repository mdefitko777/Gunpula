// Hobby Atlas Gundam pipeline: fetch every source politely, then build the MS master and
// the kit <-> MS / kit <-> work tables in data/atlas/.
//
//   node scripts/atlas/run_gundam.mjs            fetch all sources, then build
//   node scripts/atlas/run_gundam.mjs --build    build only (no network; uses committed snapshots)
//
// Each fetch step runs in its own process and fails softly: if a host is down, refuses us or
// shows a bot challenge, that step keeps its previous snapshot (data/atlas/gundam-src-*.json,
// gundam-gget-roster.json) and the build continues on it. The build refuses to overwrite the
// outputs when linked kits drop by more than 20% (ATLAS_MIN_LINK_RATIO), so a bad source never
// wipes good data. Raw HTTP responses are cached in ATLAS_CACHE_DIR (never committed).
//
// Fandom (Gunplapedia, Gundam Wiki): robots.txt on both hosts answers with a Cloudflare challenge,
// so the crawl policy is unverified and those two steps are skipped unless a human has confirmed
// it and set ATLAS_FANDOM_CONFIRMED=1 (see lib/policy.mjs). The build then uses the committed
// Fandom snapshots.
//
// Environment: ATLAS_CACHE_DIR, ATLAS_GGET_DETAILS=new|all|none, ATLAS_MANUAL_FULL=1,
// ATLAS_FANDOM_CONFIRMED=1, ATLAS_FANDOM_FALLBACK_DIR (research dump used only when no snapshot
// exists), ATLAS_STRICT=1.
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
        ["GGET roster (soshage.com)", "import_gget_roster.mjs"],
        ...(FANDOM_CONFIRMED || process.env.ATLAS_OFFLINE === "1"
          ? [
              ["Gunplapedia kits (gunpla.fandom.com)", "import_gunplapedia.mjs"],
              ["Gundam Wiki MS master (gundam.fandom.com)", "import_gundamwiki_ms.mjs"],
            ]
          : []),
        ["WEB取説 work tags (manual.bandai-hobby.net)", "import_manual_works.mjs"],
      ]),
  ["Build MS master + kit links", "build_gundam_ms.mjs"],
];

if (!buildOnly && !FANDOM_CONFIRMED && process.env.ATLAS_OFFLINE !== "1") {
  console.log("Fandom steps skipped: robots/API policy not confirmed by a human (ATLAS_FANDOM_CONFIRMED unset); using the committed Gunplapedia / Gundam Wiki snapshots.");
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
// Only the build decides the exit code: fetch steps already fell back to previous snapshots.
process.exitCode = results.at(-1).ok ? 0 : 1;
