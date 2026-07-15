export function updateFeedEntries(updateFeed) {
  return Array.isArray(updateFeed?.entries) ? [...updateFeed.entries].sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
}

export function updateEntryItems(entry, franchise = null) {
  const matchesFranchise = (item) => !franchise || item.franchise === franchise;
  return {
    added: (entry?.added || []).filter(matchesFranchise),
    changed: (entry?.changed || []).filter(matchesFranchise),
    removed: (entry?.removed || []).filter(matchesFranchise),
  };
}

export function updateEntryTotal(entry, franchise = null) {
  if (!franchise) {
    return Number(entry?.added_count || 0) + Number(entry?.changed_count || 0);
  }
  const items = updateEntryItems(entry, franchise);
  return items.added.length + items.changed.length;
}

export function itemIsPremiumBandai(item) {
  const text = [
    item?.is_premium_bandai,
    item?.kit_id,
    item?.grade_code,
    item?.subline,
    ...Object.values(item?.names || {}),
    ...(item?.source_urls || []),
  ]
    .filter(Boolean)
    .join(" ");
  return item?.is_premium_bandai === true || /p-bandai\.jp|premium\s*bandai|p-?bandai|プレミアムバンダイ|プレバン|pb\s*限定|pb限定/i.test(text);
}

export function updateEntryPremiumBandaiTotal(entry, franchise = null) {
  if (!franchise && Number.isFinite(Number(entry?.premium_bandai_count))) {
    return Number(entry.premium_bandai_count || 0);
  }
  const items = updateEntryItems(entry, franchise);
  const seen = new Set();
  let count = 0;
  for (const item of [...items.added, ...items.changed]) {
    if (!item?.kit_id || seen.has(item.kit_id) || !itemIsPremiumBandai(item)) continue;
    seen.add(item.kit_id);
    count += 1;
  }
  return count;
}

export function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dayDiff(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  if (!from || !to) return Infinity;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function updateFeedStats(updateFeed, { franchise = null, updatedAt = null, today = new Date() } = {}) {
  const entries = updateFeedEntries(updateFeed);
  const anchorDate = localDateKey(today);
  const monthKey = anchorDate.slice(0, 7);
  const sumFor = (predicate) =>
    entries.filter(predicate).reduce(
      (total, entry) => {
        const items = updateEntryItems(entry, franchise);
        total.count += updateEntryTotal(entry, franchise);
        total.added += items.added.length;
        total.changed += items.changed.length;
        total.watched += [...items.added, ...items.changed].filter((item) => item.watch_tags?.length).length;
        total.premium += updateEntryPremiumBandaiTotal(entry, franchise);
        return total;
      },
      { count: 0, added: 0, changed: 0, watched: 0, premium: 0 },
    );

  return {
    latestDate: entries[0]?.date || updateFeed?.updated_at || updatedAt,
    today: sumFor((entry) => entry.date === anchorDate),
    week: sumFor((entry) => dayDiff(entry.date, anchorDate) >= 0 && dayDiff(entry.date, anchorDate) <= 6),
    month: sumFor((entry) => String(entry.date || "").startsWith(monthKey)),
  };
}

export function updateEntryPreviewItems(entry, { limit = 8, franchise = null } = {}) {
  const byKey = new Map();
  const items = updateEntryItems(entry, franchise);
  const watched = [...items.added, ...items.changed].filter((item) => item.watch_tags?.length);
  const premium = [...items.added, ...items.changed].filter(itemIsPremiumBandai);
  for (const item of [...watched, ...premium, ...items.added, ...items.changed]) {
    byKey.set(`${item.change_type}:${item.kit_id}`, item);
  }
  return [...byKey.values()].slice(0, limit);
}

export function validReleaseMonth(value) {
  const match = /^\d{4}-\d{2}$/.exec(String(value || ""));
  return match ? match[0] : "";
}

export function effectiveKitDate(kit, firstSeen = {}) {
  return kit?.release_date || firstSeen?.[kit?.kit_id] || null;
}

export function releaseMonthForKit(kit, firstSeen = {}) {
  return validReleaseMonth(String(effectiveKitDate(kit, firstSeen) || "").slice(0, 7));
}

export function defaultReleaseMonth(kits, firstSeen = {}, today = new Date()) {
  const current = localDateKey(today).slice(0, 7);
  const months = [...new Set(kits.map((kit) => releaseMonthForKit(kit, firstSeen)).filter(Boolean))].sort();
  return months.find((month) => month >= current) || months.at(-1) || current;
}

export function releaseItemsForMonth(kits, { month, firstSeen = {}, franchise = null, nameForSort = () => "" } = {}) {
  const target = validReleaseMonth(month) || defaultReleaseMonth(kits, firstSeen);
  return kits
    .filter((kit) => releaseMonthForKit(kit, firstSeen) === target && (!franchise || kit.franchise === franchise))
    .sort((a, b) => {
      const date = String(a.release_date || "").localeCompare(String(b.release_date || ""));
      if (date) return date;
      return nameForSort(a).localeCompare(nameForSort(b));
    });
}

export function kitIsPremiumBandai(kit) {
  return itemIsPremiumBandai({
    kit_id: kit?.kit_id,
    grade_code: kit?.grade_code,
    subline: kit?.subline,
    names: kit?.names,
    source_urls: kit?.source_urls,
    is_premium_bandai: kit?.is_premium_bandai,
  });
}

export function releaseMonthStats(kits, { month, firstSeen = {}, franchise = null, seriesKey = () => "" } = {}) {
  const items = releaseItemsForMonth(kits, { month, firstSeen, franchise });
  return {
    count: items.length,
    premium: items.filter(kitIsPremiumBandai).length,
    watched: items.filter((kit) => ["seed", "double_o"].includes(seriesKey(kit))).length,
    franchises: new Set(items.map((kit) => kit.franchise)).size,
  };
}

export function weekOnSaleKits(kits, { firstSeen = {}, days = 7, today = new Date() } = {}) {
  const end = localDateKey(today);
  const start = localDateKey(new Date(today.getTime() - (days - 1) * 86400000));
  return kits
    .filter((kit) => {
      const date = String(effectiveKitDate(kit, firstSeen) || "").slice(0, 10);
      return date.length === 10 && date >= start && date <= end;
    })
    .sort((a, b) => String(effectiveKitDate(b, firstSeen) || "").localeCompare(String(effectiveKitDate(a, firstSeen) || "")));
}

export function recentFeedKits(updateFeed, { days, displayKitById } = {}) {
  const entries = updateFeedEntries(updateFeed);
  if (!entries.length) return [];
  const newestMs = Date.parse(`${entries[0].date}T00:00:00`);
  const cutoffMs = newestMs - (days - 1) * 86400000;
  const seen = new Set();
  const results = [];
  for (const entry of entries) {
    const entryMs = Date.parse(`${entry.date}T00:00:00`);
    if (!Number.isFinite(entryMs) || entryMs < cutoffMs) break;
    const items = updateEntryItems(entry);
    for (const item of [...items.added, ...items.changed]) {
      if (!item?.kit_id || seen.has(item.kit_id)) continue;
      seen.add(item.kit_id);
      const kit = displayKitById(item.kit_id);
      if (kit) results.push(kit);
    }
  }
  return results;
}

export function recentUpdateItems(updateFeed, { limit = 6, franchise = null } = {}) {
  const seen = new Set();
  const items = [];
  for (const entry of updateFeedEntries(updateFeed)) {
    for (const item of updateEntryPreviewItems(entry, { limit: 16, franchise })) {
      if (!item?.kit_id || seen.has(item.kit_id)) continue;
      seen.add(item.kit_id);
      items.push({ ...item, date: entry.date });
      if (items.length >= limit) return items;
    }
  }
  return items;
}
