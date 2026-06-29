import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const FEED_PATH = "data/update-feed.json";
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
    ...(kit.source_urls || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

function summarizeKit(kit, changeType) {
  const watch_tags = watchTagsFor(kit);
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
    watch_tags,
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
    byKey.set(`${item.change_type}:${item.kit_id}`, item);
  }
  return sortItems([...byKey.values()]);
}

function mergeSameDateEntry(previous, next) {
  if (!previous) {
    return next;
  }

  const added = mergeUniqueItems(previous.added || [], next.added || []);
  const changed = mergeUniqueItems(previous.changed || [], next.changed || []);
  const removed = mergeUniqueItems(previous.removed || [], next.removed || []);
  const watched = mergeUniqueItems(previous.watched || [], next.watched || []);

  return {
    ...previous,
    ...next,
    total_before: previous.total_before ?? next.total_before,
    total_after: next.total_after ?? previous.total_after,
    added_count: added.length,
    changed_count: changed.length,
    removed_count: removed.length,
    watched_count: watched.length,
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

const date = currentDoc.updated_at || today();
const beforeById = byId(beforeDoc.kits);
const currentById = byId(currentDoc.kits);

const added = [];
const changed = [];
const removed = [];

for (const kit of currentDoc.kits || []) {
  const beforeKit = beforeById.get(kit.kit_id);
  if (!beforeKit) {
    added.push(summarizeKit(kit, "added"));
  } else if (stableKitFingerprint(beforeKit) !== stableKitFingerprint(kit)) {
    changed.push(summarizeKit(kit, "changed"));
  }
}

for (const kit of beforeDoc.kits || []) {
  if (!currentById.has(kit.kit_id)) {
    removed.push(summarizeKit(kit, "removed"));
  }
}

const entryItems = sortItems([...added, ...changed]);
const watched = entryItems.filter((item) => item.watch_tags?.length);
const entry = {
  date,
  generated_at: new Date().toISOString(),
  total_before: beforeDoc.kits?.length ?? 0,
  total_after: currentDoc.kits?.length ?? 0,
  added_count: added.length,
  changed_count: changed.length,
  removed_count: removed.length,
  watched_count: watched.length,
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
  entries,
};

await writeFile(feedPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${feedPath}: +${entry.added_count}, changed ${entry.changed_count}, removed ${entry.removed_count}, watched ${entry.watched_count}.`,
);
