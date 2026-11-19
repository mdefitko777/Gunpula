// What the daily import run (scripts/run_importers.mjs) tells the failure issue, and which steps
// it leaves out on GitHub runners.
//
// Paused steps: a host that refuses GitHub runners on every run while a home line reads it fine
// (www.bnkrmall.co.kr, store.nintendo.co.kr since 2026-11-14) is not asked every day
// (AGENTS.md, Crawling). On a runner the step runs once every PAUSE_TRY_DAYS days counted from
// `pause.since` and is skipped on the others; its stored records stay as they are.
//
// Known lines: a paused step (skipped, or failing its weekly try) and a host under maintenance
// (www.goodsmile.com 2026-10-23 and 2026-11-19, notes saying "under maintenance") are listed once
// per report as "paused (known)", not as failures, so the issue is not commented on every day for
// the same thing. A paused step that answers again is a plain note, so the pause gets removed.

export const PAUSE_TRY_DAYS = 7;
// Words the importers' notes use for a site that is down for everyone, not refusing us.
const MAINTENANCE_NOTE = /\bunder maintenance\b/i;

const DAY_MS = 86400000;
const addDays = (date, days) => new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

/** "run" (no pause, or not on a runner), "try" (the weekly try of a paused step) or "skip". */
export function pauseAction(step, date, { ci = false } = {}) {
  if (!step.pause || !ci) return "run";
  const days = Math.round((Date.parse(date) - Date.parse(step.pause.since)) / DAY_MS);
  return days > 0 && days % PAUSE_TRY_DAYS === 0 ? "try" : "skip";
}

/** The date of the next weekly try after `date`. */
export function nextTry(step, date) {
  const days = Math.max(0, Math.round((Date.parse(date) - Date.parse(step.pause.since)) / DAY_MS));
  return addDays(step.pause.since, (Math.floor(days / PAUSE_TRY_DAYS) + 1) * PAUSE_TRY_DAYS);
}

/** The one line a paused step gets in the report. */
export function pausedLine(step, date, outcome) {
  const { since, host, reason } = step.pause;
  return `${step.script} paused since ${since} (${host}: ${reason}); ${outcome}, next try ${nextTry(step, date)}`;
}

/**
 * results: [{ script, ok, reason, pause?, action }] from the run; notes: lines the steps appended.
 * → { failures: [lines for the issue], known: [lines listed once as paused (known)] }
 */
export function splitReport(results, notes, date) {
  const failures = [];
  const known = [];
  for (const result of results) {
    if (result.action === "skip") known.push(pausedLine(result, date, "skipped today"));
    else if (result.action === "try" && !result.ok) known.push(pausedLine(result, date, `weekly try failed (${result.reason})`));
    else if (result.action === "try") failures.push(`${result.script} answered again on its weekly try; remove its pause in scripts/run_importers.mjs`);
    else if (!result.ok) failures.push(`${result.script} (${result.reason})`);
  }
  for (const note of notes) {
    if (!note.trim()) continue;
    (MAINTENANCE_NOTE.test(note) ? known : failures).push(note.trim());
  }
  return { failures, known };
}
