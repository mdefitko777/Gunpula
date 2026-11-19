import { spawn } from "node:child_process";
import { appendFile, readFile, rm, writeFile } from "node:fs/promises";
import { pauseAction, splitReport } from "./lib/import-report.mjs";

// Runs every import step behind `npm run import:data`, in order, and keeps going
// when one fails. This used to be a single `&&` chain, so goodsmile answering 503
// from 2026-10-23 stopped every later source, the update feed, the split and the
// commit, and the published data froze for over a week.
//
// Each importer only writes its output after its fetches succeed, so a failed step
// leaves that source's previous data in place and the run can still commit the rest.
//
// kind "source": fetches from a site; failing is tolerated and reported.
// kind "derive": rebuilds local files from what the sources wrote; also tolerated,
//                the previous derived file stays.
// kind "required": a data-integrity guard; failing fails the run so broken data is
//                  never committed (check:sources fails when a source drops to zero).
// pause: { since, host, reason }: the host refuses GitHub runners on every run (a home line reads
//        it), so there the step runs once a week and is listed once as "paused (known)"
//        (lib/import-report.mjs); local runs are not paused. Remove it once a weekly try answers.
const STEPS = [
  { script: "import:bandai", kind: "source" },
  { script: "import:collectibles", kind: "source" },
  { script: "import:pokemon-center", kind: "source" },
  { script: "import:pokemon-kr", kind: "source" },
  { script: "import:takaratomy-pokemon", kind: "source" },
  { script: "import:pokemon-extra", kind: "source" },
  // Korean releases sold by the Japanese makers' Korean partners; after the Japanese and the
  // 포켓몬스토어 importers (MonColle comes from import:takaratomy-pokemon), so a listing of a
  // product the catalog has joins that record the same day.
  {
    script: "import:bnkr-pokemon",
    kind: "source",
    // No runner run ever read it: robots.txt without a "*" group and a search page without
    // products (F5 cookies), while a home line reads 40 products a page. 2026-11-14 records stay.
    pause: { since: "2026-11-14", host: "www.bnkrmall.co.kr", reason: "GitHub runners get a page that is not the mall" },
  },
  { script: "import:academy-pokemon", kind: "source" },
  { script: "import:fate", kind: "source" },
  { script: "import:fate-extra", kind: "source" },
  { script: "import:madoka", kind: "source" },
  // The 닌텐도 channel (store.nintendo.co.kr, nintendo.com/kr); about 6 minutes the first time.
  {
    script: "import:nintendo-kr",
    kind: "source",
    // No runner run ever read it: HTTP 202 for robots.txt and the lists (AWS WAF challenge), while
    // a home line gets the store. 2026-11-14 records stay.
    pause: { since: "2026-11-14", host: "store.nintendo.co.kr", reason: "GitHub runners get an HTTP 202 bot check" },
  },
  { script: "import:nintendo-hobby", kind: "source" },
  // Kotobukiya and Good Smile products of Nintendo games; product pages only for new products.
  { script: "import:nintendo-makers", kind: "source" },
  // The 이펙트 channel (魂EFFECT on Tamashii Web, Good Smile effect parts, BANDAI SPIRITS
  // カスタマイズエフェクト); about 12 requests a day once the product pages are read.
  { script: "import:effects", kind: "source" },
  // Rebrickable allows downloading its catalog archives at most once a day; the script skips
  // the download when data/lego/rebrickable-fetch.json already has today's date.
  { script: "import:lego", kind: "source" },
  { script: "import:bbx-db", kind: "source" },
  { script: "import:gget", kind: "source" },
  { script: "map:gget", kind: "derive" },
  { script: "atlas:groups", kind: "derive" },
  { script: "import:pbandai-manual", kind: "derive" },
  { script: "import:pb", kind: "source" },
  { script: "import:pb:wayback", kind: "source" },
  // CC BY-SA list articles (pinned revisions) for products no official source
  // lists any more; after the official importers so it only fills real gaps.
  { script: "import:wiki-gaps", kind: "source" },
  { script: "import:announcements", kind: "source" },
  { script: "cache:bbx-images", kind: "source" },
  // After every importer: drops non-collectibles and duplicate sale pages,
  // fixes GUNDAM_MERCH grades, records dropped ids in data/kit-aliases.json.
  { script: "clean:catalog", kind: "derive" },
  // Restock / resale events (data/atlas/restocks.json) from the sale pages clean:catalog
  // just folded (data/sale-pages.json), the announcements and, with RESTOCK_BEFORE_PATH,
  // the release months that moved. Offline.
  { script: "atlas:restocks", kind: "derive" },
  { script: "relink:images", kind: "derive" },
  // Hand-picked official covers for products whose source has none (data/manual-images.json).
  { script: "images:manual", kind: "derive" },
  // Release dates read earlier from product pages (data/release-dates.json); offline.
  { script: "dates:apply", kind: "derive" },
  // Premium Bandai photos 2..n counted earlier on the Bandai CDN (data/pb-image-counts.json); offline.
  { script: "pb:gallery", kind: "derive" },
  // Rewrites kits.json in place (series, compact work titles, four-language names). If it
  // crashes, kits.json is the importers' raw output with no series, so nothing is committed.
  // A batch of series moves is not a crash: those records keep their published series and
  // the step leaves a note (IMPORT_NOTES_PATH) for the failure report.
  { script: "localize", kind: "required" },
  // Official assembly manuals (data/manuals.json, list read weekly) → manual_id; offline.
  // After localize, so it matches the same localized names (decoded entities, names.en)
  // as the re-match in manuals:fetch; before, the two gave different links on some days.
  { script: "manuals", kind: "derive" },
  { script: "check:sources", kind: "required" },
];

// The slowest healthy step (import:fate) takes about 11 minutes. A source that hangs
// instead of erroring would otherwise eat the whole job timeout.
const STEP_TIMEOUT_MS = Number(process.env.IMPORT_STEP_TIMEOUT_MINUTES || 15) * 60 * 1000;
// One line per failed step, read by the workflow to comment on the failure issue.
const FAILURES_PATH = process.env.IMPORT_FAILURES_PATH || "";
// Steps that succeeded but held something back append a line here (read into the report).
const NOTES_PATH = FAILURES_PATH ? `${FAILURES_PATH}.notes` : "";
if (NOTES_PATH) {
  await rm(NOTES_PATH, { force: true });
  process.env.IMPORT_NOTES_PATH = NOTES_PATH;
}

const isWindows = process.platform === "win32";
const CI = process.env.GITHUB_ACTIONS === "true";
// Pause days are counted in Korean dates, like the importers' updated_at.
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
let current = null;

function npmCommand(script) {
  // Under `npm run`, npm_execpath points at npm's own CLI, so it can be run with this
  // node directly (no shell, and the timeout can kill the whole step).
  if (process.env.npm_execpath) return { command: process.execPath, args: [process.env.npm_execpath, "run", script] };
  return { command: "npm", args: ["run", script] };
}

function killStep(child) {
  try {
    if (isWindows) spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGKILL");
  } catch {
    // Already gone.
  }
}

function runStep(script) {
  return new Promise((resolve) => {
    const started = Date.now();
    const { command, args } = npmCommand(script);
    // Its own process group on POSIX, so a timeout also kills the node process npm started.
    const child = spawn(command, args, { stdio: "inherit", shell: isWindows && command === "npm", detached: !isWindows });
    current = child;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`\n${script} exceeded ${STEP_TIMEOUT_MS / 60000} minutes; stopping it.`);
      killStep(child);
    }, STEP_TIMEOUT_MS);
    const finish = (code, error) => {
      clearTimeout(timer);
      current = null;
      const seconds = Math.round((Date.now() - started) / 1000);
      const reason = timedOut ? "timed out" : error ? error.message : code === 0 ? "" : `exit ${code}`;
      resolve({ script, ok: !timedOut && !error && code === 0, reason, seconds });
    };
    child.once("error", (error) => finish(null, error));
    child.once("exit", (code, signal) => finish(code ?? signal));
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (current) killStep(current);
    process.exit(130);
  });
}

function statusOf(result) {
  if (result.action === "skip" || (result.action === "try" && !result.ok)) return "paused";
  return result.ok ? "ok" : "FAIL";
}

const results = [];
for (const step of STEPS) {
  const action = pauseAction(step, TODAY, { ci: CI });
  if (action === "skip") {
    results.push({ ...step, action, ok: true, reason: `paused (${step.pause.host})`, seconds: 0 });
    console.log(`\n${step.script}: paused on GitHub runners since ${step.pause.since} (${step.pause.reason}); skipped.\n`);
    continue;
  }
  const result = { ...step, action, ...(await runStep(step.script)) };
  results.push(result);
  if (!result.ok) console.error(`\n${step.script} failed (${result.reason}); continuing with the next step.\n`);
}

// A paused step failing its weekly try is expected, not a failed step.
const failed = results.filter((result) => statusOf(result) === "FAIL");
const sources = results.filter((result) => result.kind === "source");
const allSourcesFailed = sources.every((result) => !result.ok);
const requiredFailed = failed.some((result) => result.kind === "required");

console.log("\nImport summary:");
for (const result of results) {
  console.log(`  ${statusOf(result).padEnd(6)} ${result.script.padEnd(26)} ${String(result.seconds).padStart(4)}s  ${result.reason}`);
}
console.log(`${results.length - failed.length}/${results.length} steps ok, ${sources.length - sources.filter((r) => !r.ok).length}/${sources.length} sources ok.`);

const notes = NOTES_PATH ? (await readFile(NOTES_PATH, "utf8").catch(() => "")).split("\n") : [];
const report = splitReport(results, notes, TODAY);
if (FAILURES_PATH) {
  // The workflow comments the failures on the issue and adds the known lines to them as one line.
  await writeFile(FAILURES_PATH, report.failures.map((line) => `${line}\n`).join(""), "utf8");
  await writeFile(`${FAILURES_PATH}.known`, report.known.map((line) => `${line}\n`).join(""), "utf8");
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((result) => `| ${statusOf(result) === "FAIL" ? "**FAIL**" : statusOf(result)} | \`${result.script}\` | ${result.kind} | ${result.seconds}s | ${result.reason} |`);
  const known = report.known.length ? ["", "Paused (known):", "", ...report.known.map((line) => `- ${line}`)] : [];
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    ["### Import steps", "", "| | Step | Kind | Time | Reason |", "|---|---|---|---|---|", ...rows, ...known, ""].join("\n"),
    "utf8",
  );
}

if (allSourcesFailed) {
  console.error("Every source importer failed; nothing new to publish.");
  process.exit(1);
}
if (requiredFailed) {
  console.error("A required check failed; not continuing to the commit.");
  process.exit(1);
}
