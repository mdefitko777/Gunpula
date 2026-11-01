import { spawn } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";

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
const STEPS = [
  { script: "import:bandai", kind: "source" },
  { script: "import:collectibles", kind: "source" },
  { script: "import:pokemon-center", kind: "source" },
  { script: "import:pokemon-kr", kind: "source" },
  { script: "import:takaratomy-pokemon", kind: "source" },
  { script: "import:pokemon-extra", kind: "source" },
  { script: "import:fate", kind: "source" },
  { script: "import:fate-extra", kind: "source" },
  { script: "import:bbx-db", kind: "source" },
  { script: "import:gget", kind: "source" },
  { script: "map:gget", kind: "derive" },
  { script: "atlas:groups", kind: "derive" },
  { script: "import:pbandai-manual", kind: "derive" },
  { script: "import:pb", kind: "source" },
  { script: "import:pb:wayback", kind: "source" },
  { script: "import:announcements", kind: "source" },
  { script: "cache:bbx-images", kind: "source" },
  // After every importer: drops non-collectibles and duplicate sale pages,
  // fixes GUNDAM_MERCH grades, records dropped ids in data/kit-aliases.json.
  { script: "clean:catalog", kind: "derive" },
  { script: "relink:images", kind: "derive" },
  { script: "localize", kind: "derive" },
  { script: "check:sources", kind: "required" },
];

// The slowest healthy step (import:fate) takes about 11 minutes. A source that hangs
// instead of erroring would otherwise eat the whole job timeout.
const STEP_TIMEOUT_MS = Number(process.env.IMPORT_STEP_TIMEOUT_MINUTES || 15) * 60 * 1000;
// One line per failed step, read by the workflow to comment on the failure issue.
const FAILURES_PATH = process.env.IMPORT_FAILURES_PATH || "";

const isWindows = process.platform === "win32";
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

const results = [];
for (const step of STEPS) {
  const result = { ...step, ...(await runStep(step.script)) };
  results.push(result);
  if (!result.ok) console.error(`\n${step.script} failed (${result.reason}); continuing with the next step.\n`);
}

const failed = results.filter((result) => !result.ok);
const sources = results.filter((result) => result.kind === "source");
const allSourcesFailed = sources.every((result) => !result.ok);
const requiredFailed = failed.some((result) => result.kind === "required");

console.log("\nImport summary:");
for (const result of results) {
  console.log(`  ${result.ok ? "ok  " : "FAIL"}  ${result.script.padEnd(26)} ${String(result.seconds).padStart(4)}s  ${result.reason}`);
}
console.log(`${results.length - failed.length}/${results.length} steps ok, ${sources.length - sources.filter((r) => !r.ok).length}/${sources.length} sources ok.`);

if (FAILURES_PATH) {
  await writeFile(FAILURES_PATH, failed.map((result) => `${result.script} (${result.reason})\n`).join(""), "utf8");
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((result) => `| ${result.ok ? "ok" : "**FAIL**"} | \`${result.script}\` | ${result.kind} | ${result.seconds}s | ${result.reason} |`);
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    ["### Import steps", "", "| | Step | Kind | Time | Reason |", "|---|---|---|---|---|", ...rows, ""].join("\n"),
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
