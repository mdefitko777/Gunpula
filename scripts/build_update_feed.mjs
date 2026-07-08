import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const FEED_PATH = "data/update-feed.json";
const SOURCE_HEALTH_PATH = "data/source-health.json";
const HISTORY_LIMIT = 90;
const ITEM_LIMIT = 120;

const args = process.argv.slice(2);
const options = Object.fromEntries(
  args
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.slice(2).split("=");
      return [key, rest.join("=")];
    }),
);
const flags = new Set(args.filter((arg) => arg.startsWith("--") && !arg.includes("=")));

const beforePath = options.before || process.env.UPDATE_FEED_BEFORE;
const currentPath = options.current || process.env.UPDATE_FEED_CURRENT || CATALOG_PATH;
const feedPath = options.output || process.env.UPDATE_FEED_OUTPUT || FEED_PATH;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function byId(kits = []) {
  return new Map(kits.map((kit) => [kit.kit_id, kit]));
}

function nameFor(kit) {
  return {
    ja: kit.names?.ja ?? null,
    zh: kit.names?.zh ?? kit.names?.ja ?? kit.names?.en ?? kit.kit_id,
    ko: kit.names?.ko ?? kit.names?.ja ?? kit.names?.en ?? kit.kit_id,
    en: kit.names?.en ?? kit.names?.ja ?? kit.names?.zh ?? kit.kit_id,
  };
}

function stableKitFingerprint(kit) {
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

function isPremiumBandaiKit(kit) {
  const text = textForWatch(kit);
  return /p-bandai\.jp|p_bandai_jp|premium\s*bandai|p-?bandai|プレミアムバンダイ|プレバン|pb\s*限定|pb限定/i.test(text);
}

function interestTagsFor(kit) {
  const tags = new Set([kit.franchise].filter(Boolean));
  if (isPremiumBandaiKit(kit)) tags.add("premium_bandai");
  if (kit.franchise === "beyblade") {
    tags.add("bbx");
    for (const tag of kit.tags || []) {
      if (["bx", "cx", "ux", "limited"].includes(tag)) tags.add(`bbx_${tag}`);
    }
    if (kit.series?.key) tags.add(kit.series.key);
  }
  for (const tag of watchTagsFor(kit)) tags.add(tag);
  return [...tags];
}

function watchTagsFor(kit) {
  const tags = new Set();
  const text = textForWatch(kit);
  if (kit.series?.key === "seed" || /\bseed\b|destiny|freedom|astray|stargazer|eclipse|cosmic era/.test(text)) {
    tags.add("seed");
  }
  if (kit.series?.key === "double_o" || /\b00\b|double[\s-]?o|ダブルオー|더블오/.test(text)) {
    tags.add("00");
  }
  return [...tags];
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function changeReasons(beforeKit, kit, changeType) {
  if (changeType === "added") return ["new"];
  if (changeType === "removed") return ["removed"];
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

function summarizeKit(kit, changeType, reasons = []) {
  const watch_tags = watchTagsFor(kit);
  const is_premium_bandai = isPremiumBandaiKit(kit);
  const source_ids = [...new Set((kit.source_refs || []).map((ref) => ref.source_id).filter(Boolean))];
  return {
    kit_id: kit.kit_id,
    change_type: changeType,
    franchise: kit.franchise,
    grade_code: kit.grade_code,
    subline: kit.subline ?? null,
    series_key: kit.series?.key ?? null,
    series_labels: kit.series?.labels ?? null,
    names: nameFor(kit),
    release_date: kit.release_date ?? null,
    price_jpy: kit.price_jpy ?? null,
    is_limited: kit.is_limited === true,
    is_premium_bandai,
    watch_tags,
    interest_tags: interestTagsFor(kit),
    change_reasons: reasons,
    source_ids,
    source_urls: (kit.source_urls || []).slice(0, 2),
  };
}

function sortItems(items) {
  return items.sort((a, b) => {
    const watched = Number(b.watch_tags?.length > 0) - Number(a.watch_tags?.length > 0);
    if (watched) return watched;
    const date = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""));
    if (date) return date;
    return String(a.names?.ja ?? a.kit_id).localeCompare(String(b.names?.ja ?? b.kit_id), "ja");
  });
}

function mergeUniqueItems(...groups) {
  const byKey = new Map();
  for (const item of groups.flat()) {
    if (!item?.kit_id) continue;
    const key = `${item.change_type}:${item.kit_id}`;
    const previous = byKey.get(key);
    byKey.set(
      key,
      previous
        ? {
            ...previous,
            ...item,
            watch_tags: [...new Set([...(previous.watch_tags || []), ...(item.watch_tags || [])])],
            interest_tags: [...new Set([...(previous.interest_tags || []), ...(item.interest_tags || [])])],
            change_reasons: [...new Set([...(previous.change_reasons || []), ...(item.change_reasons || [])])],
            source_ids: [...new Set([...(previous.source_ids || []), ...(item.source_ids || [])])],
            source_urls: [...new Set([...(previous.source_urls || []), ...(item.source_urls || [])])].slice(0, 2),
          }
        : item,
    );
  }
  return sortItems([...byKey.values()]);
}

function countBy(items, getter) {
  const counts = {};
  for (const item of items) {
    const keys = getter(item);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function entryStats(added, changed, removed) {
  const active = [...added, ...changed];
  return {
    franchise_counts: countBy(active, (item) => item.franchise),
    reason_counts: countBy([...added, ...changed, ...removed], (item) => item.change_reasons || []),
    interest_tags: [...new Set(active.flatMap((item) => item.interest_tags || []))],
    premium_bandai_count: active.filter((item) => item.is_premium_bandai).length,
    bbx_count: active.filter((item) => item.franchise === "beyblade").length,
  };
}

function mergeSameDateEntry(previous, next) {
  if (!previous) {
    return next;
  }

  const added = mergeUniqueItems(previous.added || [], next.added || []);
  const changed = mergeUniqueItems(previous.changed || [], next.changed || []);
  const removed = mergeUniqueItems(previous.removed || [], next.removed || []);
  const watched = mergeUniqueItems(previous.watched || [], next.watched || []);
  const stats = entryStats(added, changed, removed);

  return {
    ...previous,
    ...next,
    total_before: previous.total_before ?? next.total_before,
    total_after: next.total_after ?? previous.total_after,
    added_count: added.length,
    changed_count: changed.length,
    removed_count: removed.length,
    watched_count: watched.length,
    premium_bandai_count: stats.premium_bandai_count,
    bbx_count: stats.bbx_count,
    franchise_counts: stats.franchise_counts,
    reason_counts: stats.reason_counts,
    interest_tags: stats.interest_tags,
    watch_tags: [...new Set([...(previous.watch_tags || []), ...(next.watch_tags || [])])],
    added: added.slice(0, ITEM_LIMIT),
    changed: changed.slice(0, ITEM_LIMIT),
    removed: removed.slice(0, ITEM_LIMIT),
    watched: watched.slice(0, ITEM_LIMIT),
  };
}

const beforeDoc = beforePath ? await readJson(beforePath, { kits: [] }) : { kits: [] };
const currentDoc = await readJson(currentPath, { kits: [] });
const previousFeed = flags.has("--reset") ? { entries: [] } : await readJson(feedPath, { entries: [] });
const sourceHealth = await readJson(SOURCE_HEALTH_PATH, null);

const date = currentDoc.updated_at || today();
const beforeById = byId(beforeDoc.kits);
const currentById = byId(currentDoc.kits);

const added = [];
const changed = [];
const removed = [];

for (const kit of currentDoc.kits || []) {
  const beforeKit = beforeById.get(kit.kit_id);
  if (!beforeKit) {
    added.push(summarizeKit(kit, "added", changeReasons(null, kit, "added")));
  } else if (stableKitFingerprint(beforeKit) !== stableKitFingerprint(kit)) {
    changed.push(summarizeKit(kit, "changed", changeReasons(beforeKit, kit, "changed")));
  }
}

for (const kit of beforeDoc.kits || []) {
  if (!currentById.has(kit.kit_id)) {
    removed.push(summarizeKit(kit, "removed", changeReasons(kit, null, "removed")));
  }
}

const entryItems = sortItems([...added, ...changed]);
const watched = entryItems.filter((item) => item.watch_tags?.length);
const stats = entryStats(added, changed, removed);
const entry = {
  date,
  generated_at: new Date().toISOString(),
  total_before: beforeDoc.kits?.length ?? 0,
  total_after: currentDoc.kits?.length ?? 0,
  added_count: added.length,
  changed_count: changed.length,
  removed_count: removed.length,
  watched_count: watched.length,
  premium_bandai_count: stats.premium_bandai_count,
  bbx_count: stats.bbx_count,
  franchise_counts: stats.franchise_counts,
  reason_counts: stats.reason_counts,
  interest_tags: stats.interest_tags,
  watch_tags: [...new Set(watched.flatMap((item) => item.watch_tags))],
  added: sortItems(added).slice(0, ITEM_LIMIT),
  changed: sortItems(changed).slice(0, ITEM_LIMIT),
  removed: sortItems(removed).slice(0, ITEM_LIMIT),
  watched: watched.slice(0, ITEM_LIMIT),
};

const previousEntries = previousFeed.entries || [];
const sameDateEntry = previousEntries.find((item) => item.date === date);
const entries = [
  mergeSameDateEntry(sameDateEntry, entry),
  ...previousEntries.filter((item) => item.date !== date),
]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  .slice(0, HISTORY_LIMIT);

const feed = {
  schema_version: 1,
  updated_at: date,
  generated_at: entry.generated_at,
  watch_tags: ["seed", "00"],
  interest_tags: ["premium_bandai", "bbx", "gundam", "armored_core", "pokemon", "fate", "beyblade"],
  source_health: sourceHealth
    ? {
        generated_at: sourceHealth.generated_at,
        blocked_count: (sourceHealth.checks || []).filter((check) => check.status === "blocked").length,
        error_count: (sourceHealth.checks || []).filter((check) => check.status === "error").length,
      }
    : null,
  entries,
};

await writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");

// First-seen ledger: records the date each kit_id first appeared in the
// catalog. The app uses it as a display/filter fallback for kits without an
// official release_date (e.g. many Pokemon items), per "no release date ->
// count by upload date". Dates are stamped once and never rewritten.
const FIRST_SEEN_PATH = "data/kit-first-seen.json";
const ledger = (await readJson(FIRST_SEEN_PATH, { dates: {} })) || { dates: {} };
ledger.dates = ledger.dates || {};
let stamped = 0;
for (const kit of currentDoc.kits || []) {
  if (!ledger.dates[kit.kit_id]) {
    ledger.dates[kit.kit_id] = date;
    stamped += 1;
  }
}
ledger.schema_version = 1;
ledger.updated_at = date;
await writeFile(FIRST_SEEN_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${feedPath}: +${entry.added_count}, changed ${entry.changed_count}, removed ${entry.removed_count}, watched ${entry.watched_count}. First-seen ledger: +${stamped} stamped.`,
);
