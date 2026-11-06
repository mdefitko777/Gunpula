// Hobby Atlas: data/atlas/notify-feed.json — every catalog change worth a phone notification, per feed date.
//
// Why: data/update-feed-lite.json keeps only the first 20 added + 20 changed items per date and
// data/update-feed.json only the first 120, sorted SEED/00 first, then by release date. On a busy
// day (2026-11-01: 312 new items) PB items, SEED/00 items and price / release changes of kits a
// user liked fall off the end, so the Hobby Atlas app could not notify about them.
//
// How: the same diff as scripts/build_update_feed.mjs, but between consecutive git versions of
// data/kits.json (git log -- data/kits.json), with no item cap. Only items an app would notify
// about are kept (new, or a change other than image / name / series / product line / metadata),
// in a trimmed shape the app already parses (same keys as update-feed items). Items already in
// data/update-feed.json are merged in too, so a run without git history still works (degraded to
// the 120 cap). Each run only diffs kits.json commits it has not seen; the previous output keeps
// the rest. No network. Output is compact JSON for phones.
//
// Restocks: events in data/atlas/restocks.json (scripts/build_restocks.mjs — PB 再販 / N次発送,
// Tamashii 発送分, BANDAI SPIRITS 再販 news) become "changed" items with change_reasons
// ["restock"] and a `restock` object { date, kind, url, announced_at }, filed under the first
// feed date on or after the day the event was first seen. They are not "added" items, are not
// counted in added_count / changed_count (restock_count instead), and the backfill rule does not
// apply to them: a restocked kit is old by nature. Events marked quiet (the first build's
// backlog, resales already over) are never items.
//
//   node scripts/atlas/build_notify_feed.mjs [--days=30] [--max-commits=60] [--rebuild] [--no-git]
//                                            [--report=path.json] [--output=data/atlas/notify-feed.json]
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CATALOG = "data/kits.json";
const FEED = "data/update-feed.json";
const MANIFEST = "data/split/manifest.json";
const OUTPUT = "data/atlas/notify-feed.json";
const RESTOCKS = "data/atlas/restocks.json";

/** Change reasons the app never notifies about (same list as hobby-atlas lib/notifications/feed_rules.dart). */
export const QUIET_REASONS = new Set(["image", "name", "series", "product_line", "metadata"]);

// ── Same rules as scripts/build_update_feed.mjs (copied: that script runs on import) ──
function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function stableKitFingerprint(kit) {
  return JSON.stringify({
    names: kit.names,
    franchise: kit.franchise,
    grade_code: kit.grade_code,
    subline: kit.subline,
    images: kit.images,
    gallery_image_urls: kit.gallery_image_urls,
    series_key: kit.series?.key,
    work_title: kit.work_title,
    universe: kit.universe,
    release_date: kit.release_date,
    price_jpy: kit.price_jpy,
    is_limited: kit.is_limited,
    scale: kit.scale,
    source_refs: kit.source_refs,
    source_urls: kit.source_urls,
    tags: kit.tags,
  });
}

function textForWatch(kit) {
  return [
    kit.kit_id,
    kit.grade_code,
    kit.subline,
    kit.work_title,
    kit.universe,
    kit.series?.key,
    ...Object.values(kit.names || {}),
    ...Object.values(kit.series?.labels || {}),
    ...(kit.tags || []),
    kit.notes,
    ...(kit.source_urls || []),
    ...(kit.source_refs || []).flatMap((ref) => [ref.source_id, ref.url]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isPremiumBandaiKit(kit) {
  if (kit.is_premium_bandai === true) return true;
  return /p-bandai\.jp|p_bandai_jp|premium\s*bandai|p-?bandai|プレミアムバンダイ|プレバン|pb\s*限定|pb限定/i.test(textForWatch(kit));
}

export function watchTagsFor(kit) {
  const tags = new Set();
  const text = textForWatch(kit);
  if (kit.series?.key === "seed" || /\bseed\b|destiny|freedom|astray|stargazer|eclipse|cosmic era/.test(text)) tags.add("seed");
  if (kit.series?.key === "double_o" || /\b00\b|double[\s-]?o|ダブルオー|더블오/.test(text)) tags.add("00");
  return [...tags];
}

export function changeReasons(beforeKit, kit) {
  if (!beforeKit) return ["new"];
  const reasons = new Set();
  if (!sameJson(beforeKit.names, kit.names)) reasons.add("name");
  if (!sameJson(beforeKit.images, kit.images) || !sameJson(beforeKit.gallery_image_urls, kit.gallery_image_urls)) reasons.add("image");
  if (beforeKit.release_date !== kit.release_date) reasons.add("release");
  if (beforeKit.price_jpy !== kit.price_jpy) reasons.add("price");
  if (beforeKit.grade_code !== kit.grade_code || beforeKit.subline !== kit.subline || beforeKit.scale !== kit.scale) reasons.add("product_line");
  if (beforeKit.series?.key !== kit.series?.key || beforeKit.work_title !== kit.work_title || beforeKit.universe !== kit.universe) reasons.add("series");
  if (beforeKit.is_limited !== kit.is_limited) reasons.add("limited");
  if (!sameJson(beforeKit.source_refs, kit.source_refs) || !sameJson(beforeKit.source_urls, kit.source_urls) || !sameJson(beforeKit.tags, kit.tags)) reasons.add("source");
  return reasons.size ? [...reasons] : ["metadata"];
}

/** Would the app notify about this? New items, or a change with at least one non-quiet reason. */
export function notifiable(changeType, reasons) {
  return changeType === "added" || (reasons || []).some((r) => !QUIET_REASONS.has(r));
}

function koName(names, fallback) {
  const n = names || {};
  return n.ko || n.ja || n.en || n.zh || fallback;
}

/**
 * Trimmed item: the keys hobby-atlas FeedItem.fromJson reads, empty / false values left out.
 * (names / series_labels keep only Korean, which the app shows first.)
 */
export function compactItem({ kit_id, change_type, franchise, series_key, names, series_label, release_date, price_jpy, is_limited, is_premium_bandai, watch_tags, change_reasons }) {
  const out = { kit_id, change_type, franchise: franchise || "" };
  if (series_key) out.series_key = series_key;
  out.names = { ko: koName(names, kit_id) };
  if (series_label) out.series_labels = { ko: series_label };
  if (release_date) out.release_date = release_date;
  if (typeof price_jpy === "number") out.price_jpy = price_jpy;
  if (is_limited === true) out.is_limited = true;
  if (is_premium_bandai === true) out.is_premium_bandai = true;
  if (watch_tags?.length) out.watch_tags = [...watch_tags];
  out.change_reasons = [...(change_reasons || [])];
  return out;
}

/** kits.json kit → trimmed item */
export function itemFromKit(kit, changeType, reasons) {
  return compactItem({
    kit_id: kit.kit_id,
    change_type: changeType,
    franchise: kit.franchise,
    series_key: kit.series?.key,
    names: kit.names,
    series_label: koName(kit.series?.labels, ""),
    release_date: kit.release_date,
    price_jpy: kit.price_jpy,
    is_limited: kit.is_limited,
    is_premium_bandai: isPremiumBandaiKit(kit),
    watch_tags: watchTagsFor(kit),
    change_reasons: reasons,
  });
}

/** update-feed.json item → trimmed item */
export function itemFromFeed(item) {
  return compactItem({ ...item, series_label: koName(item.series_labels, "") });
}

/**
 * Adds what the app's own notification conditions match on (channel · work or character · line):
 * `grade_code` and `groups` (the data/atlas-groups.json groups the kit is in, e.g. a Madoka
 * character). Taken from the current catalog, so items cached from older runs get them too.
 */
export function annotateItems(doc, kits, atlas) {
  // The app's product type (종류) comes from grade_code corrected by the
  // Japanese name and the subline (lib/data/gunpula.dart correctedCode /
  // lineLabel), so condition alerts get both to compute the same type.
  const byId = new Map(kits.map((k) => [k.kit_id, k]));
  const groups = new Map();
  for (const list of Object.values(atlas?.franchises || {})) {
    for (const g of Array.isArray(list) ? list : []) {
      for (const id of g.kit_ids || []) (groups.get(id) || groups.set(id, []).get(id)).push(g.id);
    }
  }
  for (const entry of doc.entries || []) {
    for (const item of [...(entry.added || []), ...(entry.changed || [])]) {
      const kit = byId.get(item.kit_id);
      if (kit?.grade_code) item.grade_code = kit.grade_code;
      if (kit?.subline) item.subline = kit.subline;
      if (kit?.names?.ja) item.name_ja = kit.names.ja;
      const ids = groups.get(item.kit_id);
      if (ids?.length) item.groups = [...ids];
    }
  }
  return doc;
}

/** Same rule as build_update_feed.mjs: a newly found record released more than this long ago is a backfill, not news. */
export const BACKFILL_AGE_MONTHS = 12;

function monthNumber(value) {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(String(value || ""));
  return match ? Number(match[1]) * 12 + Number(match[2] || 1) : null;
}

/** Was this newly found kit released long before [date]? (old records filled in by a coverage fix — the app must not notify) */
export function isBackfill(kit, date) {
  const released = monthNumber(kit?.release_date);
  const feed = monthNumber(date);
  return released != null && feed != null && released < feed - BACKFILL_AGE_MONTHS;
}

/** Two kits.json documents → notifiable items + full counts (same rule as build_update_feed.mjs, no cap).
 *  [date] = the after-document's date; newly found kits released more than 12 months earlier are counted as backfilled, not notified. */
export function diffCatalogs(beforeDoc, afterDoc, date = afterDoc?.updated_at) {
  const before = new Map((beforeDoc?.kits || []).map((k) => [k.kit_id, k]));
  const items = [];
  let added = 0;
  let changed = 0;
  let backfilled = 0;
  for (const kit of afterDoc?.kits || []) {
    if (!kit?.kit_id) continue;
    const old = before.get(kit.kit_id);
    if (!old && isBackfill(kit, date)) {
      backfilled += 1;
    } else if (!old) {
      added += 1;
      items.push(itemFromKit(kit, "added", ["new"]));
    } else if (stableKitFingerprint(old) !== stableKitFingerprint(kit)) {
      changed += 1;
      const reasons = changeReasons(old, kit);
      if (notifiable("changed", reasons)) items.push(itemFromKit(kit, "changed", reasons));
    }
  }
  return { items, added, changed, backfilled };
}

/** One kit per date: "added" wins over "changed", reasons are merged, the later version's fields win. */
export function mergeItem(map, item) {
  const prev = map.get(item.kit_id);
  if (!prev) {
    map.set(item.kit_id, item);
    return;
  }
  const changeType = prev.change_type === "added" || item.change_type === "added" ? "added" : "changed";
  const reasons = changeType === "added" ? ["new"] : [...new Set([...(prev.change_reasons || []), ...(item.change_reasons || [])])];
  map.set(item.kit_id, { ...prev, ...item, change_type: changeType, change_reasons: reasons });
}

/** restocks.json event → restock object of a notify item (the keys the app reads) */
export function restockInfo(event) {
  const out = { date: event.date, kind: event.kind };
  if (event.source_url) out.url = event.source_url;
  if (event.announced_at) out.announced_at = event.announced_at;
  return out;
}

/** kits.json kit + restocks.json event → notify item (change_type "changed", reason "restock") */
export function restockItem(kit, event) {
  return { ...itemFromKit(kit, "changed", ["restock"]), restock: restockInfo(event) };
}

/**
 * Restock items per feed date: every event that is not quiet, filed under the first of [dates]
 * (newest first) on or after its `seen` day — or the newest date when it is newer than all of
 * them. Events seen before the oldest date are outside the window. One item per kit and date:
 * the event with the latest restock date.
 */
export function restockItemsByDate(restocks, kitsById, dates) {
  const byDate = new Map();
  const ascending = [...dates].sort();
  if (!ascending.length) return byDate;
  for (const event of restocks?.events || []) {
    if (event.quiet || !event.seen || event.seen < ascending[0]) continue;
    const kit = kitsById.get(event.kit_id);
    if (!kit) continue;
    const date = ascending.find((d) => d >= event.seen) || ascending.at(-1);
    const map = byDate.get(date) ?? byDate.set(date, new Map()).get(date);
    const prev = map.get(event.kit_id);
    if (!prev || String(event.date).localeCompare(String(prev.date)) > 0) map.set(event.kit_id, event);
  }
  return new Map([...byDate].map(([date, map]) => [date, [...map.values()].map((event) => restockItem(kitsById.get(event.kit_id), event))]));
}

function sortItems(items) {
  return items.sort((a, b) => (a.change_type === b.change_type ? a.kit_id.localeCompare(b.kit_id) : a.change_type === "added" ? -1 : 1));
}

// ── git ──
function git(args, { maxBuffer = 16 * 1024 * 1024 } = {}) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer, stdio: ["ignore", "pipe", "pipe"] });
}

/** Commits that changed data/kits.json, newest first: [{sha, at}] (first-parent, so merges don't double up) */
export function kitsCommits(limit) {
  const out = git(["log", "--first-parent", `-n${limit}`, "--format=%H %cI", "--", CATALOG]).trim();
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [sha, at] = line.trim().split(" ");
    return { sha, at };
  });
}

function readKitsAt(sha) {
  return JSON.parse(git(["show", `${sha}:${CATALOG}`], { maxBuffer: 512 * 1024 * 1024 }));
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Builds the document.
 *  feed      : data/update-feed.json
 *  manifest  : data/split/manifest.json (the app compares its updated_at · total with this file's)
 *  prev      : previous output (null = start over)
 *  pairs     : [{date, at, sha, items, added, changed}] diffs of kits.json commits not yet in prev
 *  commits   : [{sha, date}] kits.json commits whose diff is in the result (prev + pairs)
 *  edgeDates : dates whose first kits.json commit could not be diffed (oldest commit in the window)
 *  since     : oldest date kept (windowStart of the feed dates); empty = the newest [days] dates
 *  restocks  : data/atlas/restocks.json (null = no restock items) · kitsById: the current catalog
 */
export function buildDoc({ feed, manifest, prev, pairs, commits, edgeDates = new Set(), days = 30, since = "", gitOk = true, now = new Date(), restocks = null, kitsById = new Map(), quiet = null }) {
  // Maintenance (data/atlas/notify-quiet.json): their kits.json diffs and update-feed dates are not news
  const quietCommits = (quiet?.commits || []).filter(Boolean);
  const quietFeedDates = new Set(quiet?.feed_dates || []);
  // date → reasons that are noise on that date (an item is dropped when every one of its reasons is listed)
  const quietReasons = new Map(Object.entries(quiet?.date_quiet_reasons || {}).map(([d, r]) => [d, new Set(r)]));
  const isQuietPair = (p) => quietCommits.some((q) => String(p.sha || "").startsWith(q) || q.startsWith(String(p.sha || "x")));
  const feedEntries = new Map((feed?.entries || []).filter((e) => !quietFeedDates.has(e.date)).map((e) => [e.date, e]));
  const prevEntries = new Map((prev?.entries || []).map((e) => [e.date, e]));
  const pairDates = new Map();
  for (const p0 of pairs) {
    const p = isQuietPair(p0) ? { ...p0, items: [], added: 0, changed: 0, quiet: true } : p0;
    (pairDates.get(p.date) ?? pairDates.set(p.date, []).get(p.date)).push(p);
  }
  // A kits.json commit outside the daily refresh (cached images) can carry its own date, so the window is
  // "on or after [since]" rather than a fixed count: the same window main() walks the git history for.
  const all = [...new Set([...feedEntries.keys(), ...prevEntries.keys(), ...pairDates.keys(), manifest?.updated_at])]
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""))
    // a feed date can't be newer than the catalog it describes (a run stamped with a local date)
    .filter((d) => !manifest?.updated_at || d <= manifest.updated_at)
    .sort((a, b) => b.localeCompare(a));
  const dates = since ? all.filter((d) => d >= since) : all.slice(0, days);
  const diffedDates = new Set(commits.map((c) => c.date));
  const restockDates = restockItemsByDate(restocks, kitsById, dates);

  const entries = dates.map((date) => {
    const fe = feedEntries.get(date);
    const pe = prevEntries.get(date);
    const ps = (pairDates.get(date) || []).sort((a, b) => a.at.localeCompare(b.at)); // older first: the later version wins
    const map = new Map();
    // restock items are placed again below from restocks.json — don't carry the previous output's copy (it may sit on an older date)
    for (const it of [...(pe?.added || []), ...(pe?.changed || [])]) {
      if (!(it.change_reasons || []).includes("restock")) mergeItem(map, it);
    }
    for (const it of [...(fe?.added || []), ...(fe?.changed || [])]) {
      if (notifiable(it.change_type, it.change_reasons)) mergeItem(map, itemFromFeed(it));
    }
    for (const p of ps) for (const it of p.items) mergeItem(map, it);
    for (const it of restockDates.get(date) || []) mergeItem(map, it);
    const noise = quietReasons.get(date);
    const items = sortItems(
      [...map.values()].filter((i) => !noise || !(i.change_reasons || []).length || !i.change_reasons.every((r) => noise.has(r))),
    );
    const restockCount = items.filter((i) => i.change_reasons.includes("restock")).length;
    const feedComplete = !!fe && (fe.added || []).length >= (fe.added_count || 0) && (fe.changed || []).length >= (fe.changed_count || 0);
    const gitComplete = gitOk && diffedDates.has(date) && !edgeDates.has(date);
    const addedCount = Math.max(fe?.added_count || 0, pe?.added_count || 0, ps.reduce((n, p) => n + p.added, 0));
    const changedCount = Math.max(fe?.changed_count || 0, pe?.changed_count || 0, ps.reduce((n, p) => n + p.changed, 0));
    const lastPair = ps.at(-1);
    return {
      date,
      generated_at: fe?.generated_at || pe?.generated_at || lastPair?.at || null,
      total_after: (date === manifest?.updated_at ? manifest?.total : null) ?? fe?.total_after ?? pe?.total_after ?? lastPair?.total ?? null,
      added_count: addedCount,
      changed_count: changedCount,
      complete: feedComplete || gitComplete || pe?.complete === true,
      ...(restockCount ? { restock_count: restockCount } : {}),
      added: items.filter((i) => i.change_type === "added"),
      changed: items.filter((i) => i.change_type === "changed"),
    };
  });

  const oldest = since || dates.at(-1) || "";
  return {
    schema: 1,
    updated_at: manifest?.updated_at ?? feed?.updated_at ?? null,
    total: manifest?.total ?? null,
    generated_at: now.toISOString(),
    days,
    quiet_reasons: [...QUIET_REASONS],
    sources: [
      {
        id: "gunpula_catalog",
        name: "Gunpula catalog — data/kits.json history + data/update-feed.json",
        url: "https://github.com/mdefitko777/Gunpula",
        method:
          "Diff of consecutive git versions of data/kits.json (same rule as scripts/build_update_feed.mjs, no item cap), merged with data/update-feed.json. Only new items and price / release / limited / source changes are kept. Restock items (reason restock) come from data/atlas/restocks.json.",
        licence:
          "Product facts (names, prices, release dates) collected by Gunpula from the official shops named in each kit's source_refs (BANDAI SPIRITS, Premium Bandai, Pokémon Center, Takara Tomy, Good Smile and others). Names and trademarks belong to their owners. No images are included.",
      },
    ],
    commits: commits.filter((c) => c.date >= oldest).map((c) => [c.sha, c.date]),
    entries,
  };
}

/** Oldest date to keep: the [days]-th newest of [dates] (feed dates + manifest date) */
export function windowStart(dates, days) {
  const sorted = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "")))].sort((a, b) => b.localeCompare(a));
  return sorted.length ? sorted[Math.min(days, sorted.length) - 1] : "";
}

/** Same content as before (ignoring generated_at)? — keeps the file byte-identical when nothing changed */
export function sameContent(a, b) {
  if (!a || !b) return false;
  const strip = ({ generated_at: _g, ...rest }) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

async function main() {
  const args = process.argv.slice(2);
  const opt = Object.fromEntries(args.filter((a) => a.startsWith("--") && a.includes("=")).map((a) => a.slice(2).split(/=(.*)/s).slice(0, 2)));
  const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
  const days = Number(opt.days || 30);
  const maxCommits = Number(opt["max-commits"] || 60);
  const output = opt.output || OUTPUT;

  const feed = await readJson(FEED, { entries: [] });
  const manifest = await readJson(MANIFEST, null);
  const prev = flags.has("--rebuild") ? null : await readJson(output, null);
  const done = new Map((prev?.schema === 1 ? prev.commits || [] : []).map(([sha, date]) => [sha, date]));
  const prevOk = prev?.schema === 1 ? prev : null;
  const restocks = await readJson(RESTOCKS, null);
  const quiet = await readJson("data/atlas/notify-quiet.json", null);
  const kitsById = new Map();
  if (restocks?.events?.length) {
    const wanted = new Set(restocks.events.filter((e) => !e.quiet).map((e) => e.kit_id));
    for (const kit of (await readJson(CATALOG, { kits: [] })).kits || []) if (wanted.has(kit.kit_id)) kitsById.set(kit.kit_id, kit);
  }

  // Oldest date the output holds: the [days]-th newest feed date (the feed keeps 90)
  const cutoff = windowStart([...(feed.entries || []).map((e) => e.date), manifest?.updated_at], days);

  const pairs = [];
  const commits = [];
  const edgeDates = new Set();
  let gitOk = !flags.has("--no-git");
  let gitNote = "";
  if (gitOk) {
    try {
      const list = kitsCommits(maxCommits + 1);
      let afterDoc = null; // parsed kits.json of list[i] (reused as the "before" of the next newer pair)
      for (let i = 0; i < list.length; i += 1) {
        const c = list[i];
        if (done.has(c.sha)) {
          if (done.get(c.sha) < cutoff) break;
          commits.push({ sha: c.sha, date: done.get(c.sha) });
          afterDoc = null;
          continue;
        }
        const after = afterDoc ?? readKitsAt(c.sha);
        const date = after.updated_at || c.at.slice(0, 10);
        if (date < cutoff) break;
        const parent = list[i + 1];
        if (!parent) {
          edgeDates.add(date); // the window starts in the middle of this date: its first diff is unknown
          gitNote = `history ends at ${c.sha.slice(0, 8)} (${date})`;
          break;
        }
        const before = readKitsAt(parent.sha);
        const d = diffCatalogs(before, after, date);
        pairs.push({ date, at: c.at, sha: c.sha, total: (after.kits || []).length, ...d });
        commits.push({ sha: c.sha, date });
        afterDoc = before;
        process.stdout.write(`  ${c.sha.slice(0, 8)} ${date}: +${d.added} ~${d.changed} -> ${d.items.length} notifiable\n`);
      }
      if (!list.length) {
        gitOk = false;
        gitNote = "no git history for data/kits.json (shallow clone?) — update-feed.json only";
      }
    } catch (e) {
      gitOk = false;
      gitNote = `git failed (${String(e.message || e).split("\n")[0]}) — update-feed.json only`;
    }
  }

  const doc = annotateItems(
    buildDoc({ feed, manifest, prev: prevOk, pairs, commits, edgeDates, days, since: cutoff, gitOk, restocks, kitsById, quiet }),
    (await readJson(CATALOG, { kits: [] })).kits || [],
    await readJson("data/atlas-groups.json", null),
  );
  const changed = !sameContent(prevOk, doc);
  if (!changed) doc.generated_at = prevOk.generated_at;
  const text = `${JSON.stringify(doc)}\n`;
  if (changed) {
    await mkdir(dirname(resolve(ROOT, output)), { recursive: true });
    await writeFile(resolve(ROOT, output), text, "utf8");
  }

  const items = doc.entries.reduce((n, e) => n + e.added.length + e.changed.length, 0);
  const report = {
    changed,
    bytes: Buffer.byteLength(text),
    entries: doc.entries.length,
    items,
    incomplete: doc.entries.filter((e) => !e.complete).map((e) => e.date),
    restocks: doc.entries.reduce((n, e) => n + (e.restock_count || 0), 0),
    new_pairs: pairs.length,
    commits: doc.commits.length,
    git: gitOk ? "ok" : "off",
    git_note: gitNote,
    newest: doc.entries[0] ? { date: doc.entries[0].date, added: doc.entries[0].added.length, changed: doc.entries[0].changed.length, added_count: doc.entries[0].added_count } : null,
  };
  if (opt.report) await writeFile(resolve(ROOT, opt.report), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`${changed ? "Wrote" : "Unchanged"} ${output}: ${doc.entries.length} dates, ${items} items, ${report.bytes} bytes; ${pairs.length} new kits.json diffs${gitNote ? ` (${gitNote})` : ""}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
