// lib/import-report.mjs: paused steps on GitHub runners (skipped, tried once a week) and which
// lines of a run go to the failure issue as failures and which once as "paused (known)".
//   node scripts/test_import_report.mjs
import assert from "node:assert/strict";
import { nextTry, pauseAction, splitReport } from "./lib/import-report.mjs";

const bnkr = { script: "import:bnkr-pokemon", kind: "source", pause: { since: "2026-11-14", host: "www.bnkrmall.co.kr", reason: "not the mall" } };
const plain = { script: "import:academy-pokemon", kind: "source" };

// Only on a runner, and there once every 7 days from `since`.
assert.equal(pauseAction(bnkr, "2026-11-20", { ci: false }), "run", "a local run is never paused");
assert.equal(pauseAction(plain, "2026-11-20", { ci: true }), "run");
assert.equal(pauseAction(bnkr, "2026-11-14", { ci: true }), "skip");
assert.equal(pauseAction(bnkr, "2026-11-20", { ci: true }), "skip");
assert.equal(pauseAction(bnkr, "2026-11-21", { ci: true }), "try");
assert.equal(pauseAction(bnkr, "2026-11-28", { ci: true }), "try");
assert.equal(nextTry(bnkr, "2026-11-20"), "2026-11-21");
assert.equal(nextTry(bnkr, "2026-11-21"), "2026-11-28");

// A skipped step and a failed weekly try are known lines; a new failure stays a failure.
{
  const results = [
    { ...bnkr, action: "skip", ok: true, reason: "paused" },
    { ...plain, action: "run", ok: false, reason: "exit 1" },
    { script: "import:lego", kind: "source", action: "run", ok: true, reason: "" },
  ];
  const notes = [
    "import:fate good_smile_fate_global: www.goodsmile.com/robots.txt 503 (under maintenance: disallow all)",
    "import:effects good_smile_effect: www.goodsmile.com stopped this run (www.goodsmile.com is under maintenance (HTTP 503 for …))",
    "import:nintendo-makers good_smile_nintendo: HTTP 403 for https://www.goodsmile.com/ja/product/1",
    "",
  ];
  const report = splitReport(results, notes, "2026-11-20");
  assert.deepEqual(report.failures, ["import:academy-pokemon (exit 1)", "import:nintendo-makers good_smile_nintendo: HTTP 403 for https://www.goodsmile.com/ja/product/1"]);
  assert.equal(report.known.length, 3);
  assert.equal(report.known[0], "import:bnkr-pokemon paused since 2026-11-14 (www.bnkrmall.co.kr: not the mall); skipped today, next try 2026-11-21");
  assert.match(report.known[1], /^import:fate .*under maintenance/);
}
{
  const failedTry = splitReport([{ ...bnkr, action: "try", ok: false, reason: "exit 1" }], [], "2026-11-21");
  assert.deepEqual(failedTry.failures, []);
  assert.match(failedTry.known[0], /weekly try failed \(exit 1\), next try 2026-11-28$/);
  // Answering again is worth a line in the issue: the pause can go.
  const answered = splitReport([{ ...bnkr, action: "try", ok: true, reason: "" }], [], "2026-11-21");
  assert.deepEqual(answered.known, []);
  assert.match(answered.failures[0], /^import:bnkr-pokemon answered again on its weekly try/);
}

console.log("test_import_report: ok");
