// 魂ウェブ's monthly sales schedule (tamashiiweb.com/schedule/) as an announcement
// source. The page draws a JSON list of every item whose preorder opens, whose
// preorder closes or which goes on sale that month, so it carries what the
// topic posts leave out: the exact preorder window and release month, and items
// that get no post at all (resales, later lottery batches, 事後販売, GUNDAM
// UNIVERSE, GUNDAM BASE LIMITED). Read by scripts/fetch_bandai_announcements.mjs.
//
// Checked 2026-11-13: tamashiiweb.com publishes no robots.txt (404). The list
// for 2026-11 had 140 rows for 137 items, 21 of them Gundam; an item appears up
// to three times a month, once per stage. `asset_base_url` is empty: pictures
// resolve against the site itself.
import { franchiseForAnnouncement, shiftDay } from "./bandai-announcements.mjs";
import { SOURCE_PAGE_LINK, announcementRecord, namesRevealedProduct, normalizeProductKey } from "./official-announcements.mjs";
import { scheduleWindows } from "./preorder-times.mjs";
import { admitItems } from "./source-intake.mjs";

export const TAMASHII_SCHEDULE_SOURCE_ID = "tamashii_schedule";
export const TAMASHII_SCHEDULE_PAGE_URL = "https://tamashiiweb.com/schedule/";
const TAMASHII_BASE = "https://tamashiiweb.com";
// Brands that are Gundam whatever the item is called ("XARX-0 GUNDAM ZERO" says
// so, "METAL ROBOT魂（Ka signature） 百式" does not).
const GUNDAM_BRANDS = /GUNDAM UNIVERSE|Ka signature/i;
// ROBOT魂's mobile-suit lines mark their items ＜SIDE MS＞ / ＜SIDE MF＞.
const GUNDAM_SIDE = /[<＜]\s*SIDE\s*M[SF]\s*[>＞]/i;

/** The schedule's own endpoint; the misspelling is the site's. */
export function scheduleApiUrl(month) {
  return `${TAMASHII_BASE}/api/site-item/shcedule.php?month=${month}&group_by=day&area=japan`;
}

/** "2026-12-20" → ["2026-12", "2027-01"]: this month and the next. */
export function scheduleMonths(today) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return [today.slice(0, 7), next];
}

/**
 * One month's answer → { items, rows }: one item per tamashiiWebId (the rows of
 * its stages carry the same fields) with the category's long name. `rows` is 0
 * for an answer that is not the schedule, so the fetcher can tell it from a
 * quiet month.
 */
export function parseTamashiiSchedule(json) {
  const groups = json && typeof json.data === "object" && json.data ? Object.values(json.data) : [];
  const categories = json?.product_category_list || {};
  const items = new Map();
  let rows = 0;
  for (const group of groups) {
    for (const row of Array.isArray(group) ? group : []) {
      rows += 1;
      if (!row.tamashiiWebId || items.has(String(row.tamashiiWebId))) continue;
      items.set(String(row.tamashiiWebId), { ...row, categoryName: categories[row.category]?.long_name || null });
    }
  }
  return { items: [...items.values()], rows };
}

function oneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function scheduleTitle(item) {
  return oneLine(`${item.mainBrandName || ""} ${item.title || ""}`);
}

// The catalog product first; then the words. The brand alone does not say the
// work: METAL BUILD also makes イカルガ and 仮面ライダー.
function scheduleFranchise(item, kit) {
  if (kit?.franchise) return kit.franchise;
  const title = scheduleTitle(item);
  const named = franchiseForAnnouncement(title);
  if (named) return named;
  return GUNDAM_SIDE.test(title) || GUNDAM_BRANDS.test(item.mainBrandName || "") ? "gundam" : null;
}

// Same stages the title rules give: preorder_open once the preorder has opened,
// product_confirmed before that.
function scheduleStatus(item, today) {
  return item.reserveStartDate && item.reserveStartDate <= today ? "preorder_open" : "product_confirmed";
}

/** "予約 2026-11-13〜2026-11-29 / 発送 2027-06 / ¥33,000（税込） / 魂ウェブ商店販売商品 / 再販" */
function scheduleNotes(item) {
  const parts = [];
  if (item.reserveStartDate) parts.push(`予約 ${item.reserveStartDate}〜${item.reserveEndDate || ""}`);
  const release = item.releaseMonth ? `${item.releaseMonth}${item.releaseDay ? `-${String(item.releaseDay).padStart(2, "0")}` : ""}` : null;
  // Web-shop items are shipped in a month, store items go on sale on a day.
  if (release) parts.push(`${item.displayType === "shipping" ? "発送" : "発売"} ${release}`);
  if (item.priceText) parts.push(oneLine(item.priceText));
  if (item.categoryName) parts.push(item.categoryName);
  parts.push(...(item.salesAttributeList || []));
  return parts.join(" / ") || null;
}

function scheduleRecord(item, { kit, franchise, today, announcedAt }) {
  return {
    ...announcementRecord({
      id: `tamashii-schedule-${item.tamashiiWebId}`,
      sourceId: TAMASHII_SCHEDULE_SOURCE_ID,
      franchise,
      title: scheduleTitle(item),
      status: scheduleStatus(item, today),
      announcedAt,
      sourceName: "TAMASHII WEB",
      // The form the topic posts and the catalog use, so a post about the item shares the URL.
      sourceUrl: `${TAMASHII_BASE}/item/${item.tamashiiWebId}/`,
      thumbnailUrl: item.thumbnailImg ? new URL(item.thumbnailImg, TAMASHII_BASE).href : null,
      notes: scheduleNotes(item),
    }),
    linked_kit_id: kit?.kit_id || null,
    // Matched by item id, like linkSourcePageKits: it names the product and
    // does not keep the record from the dedupe.
    ...(kit ? { linked_kit_basis: SOURCE_PAGE_LINK } : {}),
    // Days only (lib/preorder-times.mjs): the window's clock is in the topic post's title.
    ...windowFields(scheduleWindows([item]).get(String(item.tamashiiWebId))),
  };
}

function windowFields(window) {
  if (!window) return {};
  return {
    preorder_date: window.date,
    ...(window.end_date ? { preorder_end_date: window.end_date } : {}),
    preorder_basis: window.basis,
  };
}

/** Catalog kits → Map 魂ウェブ item id → kit ("tamashii-16259", "tamashii-fate-13377"). */
export function tamashiiKitsByItemId(kits) {
  const byItemId = new Map();
  for (const kit of kits || []) {
    const itemId = /^tamashii-(?:[a-z_]+-)?(\d+)$/.exec(kit.kit_id || "")?.[1];
    if (itemId) byItemId.set(itemId, kit);
  }
  return byItemId;
}

/**
 * Schedule items → announcement records for the app's worlds, through the
 * intake rules (recent items only, a few new ones per run). An item is dated
 * by the day 魂ウェブ published it. `kitsByItemId`: tamashiiKitsByItemId of the
 * catalog, `stored`: Map record id → last run's record.
 */
export function tamashiiScheduleRecords(items, { today, state = {}, kitsByItemId = new Map(), stored = new Map() } = {}) {
  const candidates = [];
  for (const item of items) {
    const kit = kitsByItemId.get(String(item.tamashiiWebId)) || null;
    const franchise = scheduleFranchise(item, kit);
    const date = String(item.publishDate || "").slice(0, 10);
    if (!franchise || !date || !item.title) continue;
    candidates.push({ key: String(item.tamashiiWebId), date, item, kit, franchise });
  }
  const { admitted, state: next } = admitItems(candidates, state, {
    today,
    isStored: (candidate) => stored.has(`tamashii-schedule-${candidate.key}`),
  });
  const records = admitted.map(({ item, kit, franchise, date }) => scheduleRecord(item, { kit, franchise, today, announcedAt: date }));
  return { records, state: next };
}

// ＜SIDE MS＞ is the schedule's line marker, not part of what a post calls the item.
function scheduleNameKey(record) {
  return normalizeProductKey(String(record.names?.ja || "").replace(/[<＜][^<>＜＞]*[>＞]/g, " "));
}

function sameItemUrl(a, b) {
  const clean = (url) => String(url || "").replace(/#.*$/, "").replace(/\/$/, "");
  return Boolean(clean(a)) && clean(a) === clean(b);
}

/**
 * Drops a schedule record another official record already tells: a topic post
 * linking the same item page, or a post or reveal banner naming the product,
 * at most ten days apart (a resale months later is news of its own). What only
 * the schedule knows, the preorder window in its notes and the catalog link,
 * goes to the record that stays when it has none. Records reviewed in the CMS
 * are left alone.
 */
export function dropScheduleTwins(records) {
  const others = records.filter((record) =>
    record.source_id !== TAMASHII_SCHEDULE_SOURCE_ID && record.confidence === "official" && !record.live_state);
  const gains = new Map();
  const dropped = [];
  const kept = records.filter((record) => {
    if (record.source_id !== TAMASHII_SCHEDULE_SOURCE_ID || record.reviewed_at) return true;
    const key = scheduleNameKey(record);
    const from = shiftDay(record.announced_at, -10);
    const to = shiftDay(record.announced_at, 10);
    const near = others.filter((other) =>
      other.franchise === record.franchise && String(other.announced_at || "") >= from && String(other.announced_at || "") <= to);
    // The topic post of the item page first: it is the record that stays when
    // a news site repeats it, and so the one to carry the notes. 魂ウェブ's own
    // before the BANDAI SPIRITS card linking the same page (2026-11-14: the
    // card took the キュリオス notes and catalog link, and with the link the
    // place of 魂ウェブ's post).
    const samePage = near.filter((other) => sameItemUrl(other.source_url, record.source_url));
    const twin = samePage.find((other) => other.source_name === record.source_name) || samePage[0]
      || near.find((other) => namesRevealedProduct(other, key));
    if (!twin) return true;
    dropped.push({ id: record.id, kept: twin.id });
    const gain = gains.get(twin.id) || {};
    gains.set(twin.id, {
      notes: gain.notes || record.notes,
      linked_kit_id: gain.linked_kit_id || record.linked_kit_id,
      linked_kit_basis: gain.linked_kit_basis || record.linked_kit_basis,
    });
    return false;
  });
  return {
    records: kept.map((record) => {
      const gain = gains.get(record.id);
      if (!gain) return record;
      if (record.linked_kit_id || !gain.linked_kit_id) return { ...record, notes: record.notes || gain.notes };
      return {
        ...record,
        notes: record.notes || gain.notes,
        linked_kit_id: gain.linked_kit_id,
        ...(gain.linked_kit_basis ? { linked_kit_basis: gain.linked_kit_basis } : {}),
      };
    }),
    dropped,
  };
}
