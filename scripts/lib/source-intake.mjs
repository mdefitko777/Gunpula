// Which of the items a source lists become announcement records on a run. The
// sources added on 2026-11-13 (魂ウェブ's schedule, the unofficial feeds) list
// weeks of posts, so the first read must not file all of them as news: only
// recent items are taken, a few per run, and an item passed over once is not
// offered again on a later run. The state (per source: { seen, passed }, item
// key → date) lives in data/announcements-*.json next to the other source states.
import { shiftDay } from "./bandai-announcements.mjs";

/** A new item older than this is not news any more. */
export const INTAKE_RECENT_DAYS = 21;
/** At most this many new items per source and run, newest first. */
export const INTAKE_MAX_NEW = 12;
// Entries leave the state this long after the item was last listed.
const INTAKE_KEEP_DAYS = 120;

function sortedByKey(entries) {
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * items: [{ key, date, … }] as the source lists them today. Returns
 * { admitted, state }: the items to make records from, each with the date it
 * was first taken on, and the next state.
 * An item taken before (in `state.seen`, or `isStored(item)`: its record is in
 * the data) is taken again, so the record follows the source. A new one is
 * taken when it is recent and among the `maxNew` newest; the others go to
 * `state.passed` for good, and so does a new item marked `hold` (one the
 * source cannot date).
 */
export function admitItems(items, state = {}, {
  today,
  isStored = () => false,
  recentDays = INTAKE_RECENT_DAYS,
  maxNew = INTAKE_MAX_NEW,
} = {}) {
  const seen = new Map(Object.entries(state.seen || {}));
  const passed = new Map(Object.entries(state.passed || {}));
  const since = shiftDay(today, -recentDays);
  const listed = new Set(items.map((item) => item.key));
  const fresh = [];
  const admitted = [];
  for (const item of items) {
    if (seen.has(item.key)) admitted.push({ ...item, date: seen.get(item.key) });
    else if (isStored(item)) admitted.push(item);
    else if (!passed.has(item.key)) fresh.push(item);
  }
  fresh.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let taken = 0;
  for (const item of fresh) {
    if (!item.hold && String(item.date) >= since && taken < maxNew) {
      taken += 1;
      admitted.push(item);
    } else {
      passed.set(item.key, item.date);
    }
  }
  for (const item of admitted) if (!seen.has(item.key)) seen.set(item.key, item.date);
  const keepSince = shiftDay(today, -INTAKE_KEEP_DAYS);
  const live = ([key, date]) => listed.has(key) || String(date) >= keepSince;
  return {
    admitted,
    state: { seen: sortedByKey([...seen].filter(live)), passed: sortedByKey([...passed].filter(live)) },
  };
}
