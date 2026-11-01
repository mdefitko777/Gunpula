// Restock / resale (再販 · 재판매) events per kit — the rules behind scripts/build_restocks.mjs
// (data/atlas/restocks.json) and the `restock` items of scripts/atlas/build_notify_feed.mjs.
//
// An event: { kit_id, date, kind, source_url, announced_at, seen, source, title, quiet }
//   date          YYYY-MM shipping month, or YYYY-MM-DD store / announcement day
//   kind          pb_resale | retail_resale | tamashii_resale | lottery
//   announced_at  YYYY-MM-DD official date (PB order opening, news post), or null
//   seen          YYYY-MM-DD the day the pipeline first listed the event
//   source        sale_page | pb_news | tamashii_news | official_news | catalog
//   quiet         true = backlog (found on the first build, or the resale is already
//                 over): kept for the kit page, never a phone notification
//   date_estimated  true = the page names no month; date estimated from the PB item id
//
// Where they come from (all offline, from files the importers already write):
//   * data/sale-pages.json — Premium Bandai 【再販】/【２次：…発送】/【抽選販売】 pages and
//     Tamashii （YYYY年M月発送分） batch pages folded into the product they sell. The
//     product's own first sale is not an event; a page is one when it sells a later
//     month (≥ 2 months after the product's release) or says 再販 / 2次+ and ships later.
//   * data/announcements.json — Premium Bandai new items marked 【再販】 / N次 (PB item id →
//     folded page → product, else the product name), Tamashii 再販 topics (the twid ids
//     in the link are Tamashii pages → product), GUNDAM.INFO / BANDAI SPIRITS news with
//     再販 in the title (「product names」 matched on the catalog's product key; only a
//     single, older product counts).
//   * optional: a BANDAI SPIRITS kit whose release month moved ≥ 12 months later while
//     its old month was ≥ 6 months past (a retail restock the shop dates anew).
import { gundamGradeFromName, nfkc, productKey, resolveAlias } from "./catalog-cleanup.mjs";
import { monthOf } from "./sale-pages.mjs";

export const RESTOCK_KINDS = ["pb_resale", "retail_resale", "tamashii_resale", "lottery"];
export const HISTORY_MONTHS = 24;
/** A first-build event is still news when its official date is this recent. */
export const BASELINE_FRESH_DAYS = 14;

const RESALE_WORD = /再販|再生産|追加生産|再受注|再販売|再出荷/;
const LOTTERY_WORD = /抽選/;
const NOT_A_RESALE = /再販会議|選抜選挙|投票|アンケート|総選挙(?!.*再販)/;
const TAMASHII_GRADES = new Set(["ROBOT_SPIRITS", "METAL_BUILD", "METAL_ROBOT", "METAL_STRUCTURE", "GFF", "SH_FIGUARTS", "CHOGOKIN"]);

export function monthIndex(value) {
  const month = monthOf(value);
  if (!month) return null;
  const [year, m] = month.split("-").map(Number);
  return year * 12 + m;
}

function monthFromIndex(index) {
  const year = Math.floor((index - 1) / 12);
  const month = index - year * 12;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(month, delta) {
  const index = monthIndex(month);
  return index == null ? null : monthFromIndex(index + delta);
}

function shiftDay(day, days) {
  const date = new Date(`${String(day).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * What a sale page name says: 再販, 抽選, the batch number (２次 → 2) and the shipping month
 * (【２０２７年１月発送】, 【３次：２０２７年１月発送】, （2027年5月発送分）).
 */
export function saleTags(name) {
  const text = nfkc(name);
  const ship = /(\d{4})年\s*(\d{1,2})月[^】)]{0,6}?発送/.exec(text);
  const batch = /(\d+)次/.exec(text);
  return {
    resale: RESALE_WORD.test(text),
    lottery: LOTTERY_WORD.test(text),
    batch: batch ? Number(batch[1]) : null,
    ship: ship && Number(ship[2]) >= 1 && Number(ship[2]) <= 12 ? `${ship[1]}-${ship[2].padStart(2, "0")}` : null,
  };
}

function isTamashiiKit(kit) {
  return /^tamashii-/.test(kit?.kit_id || "") || TAMASHII_GRADES.has(kit?.grade_code);
}

/**
 * Shipping month of a Premium Bandai page that does not say it, from its item id: PB numbers
 * items in listing order, so the median shipping month of the ten nearest item ids that do say
 * it is the estimate (checked against 1,127 pages that say it: within 1 month for 80%, within 3
 * months for 95%). Null when the neighbours are too few or too far apart (> 6 months).
 */
export function pbShipEstimator(pages) {
  const points = Object.entries(pages || {})
    .filter(([id, page]) => /^pbandai-wb-\d+$/.test(id) && monthIndex(page.ship) != null)
    .map(([id, page]) => [Number(id.slice("pbandai-wb-".length)), monthIndex(page.ship)])
    .sort((a, b) => a[0] - b[0]);
  return (pageId) => {
    const match = /^pbandai-wb-(\d+)$/.exec(pageId || "");
    if (!match || points.length < 4) return null;
    const id = Number(match[1]);
    let lo = 0;
    let hi = points.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid][0] < id) lo = mid + 1;
      else hi = mid;
    }
    const near = points.slice(Math.max(0, lo - 5), lo + 5).filter(([other]) => other !== id).map(([, month]) => month).sort((a, b) => a - b);
    if (near.length < 4 || near.at(-1) - near[0] > 6) return null;
    return monthFromIndex(near[Math.floor(near.length / 2)]);
  };
}

/**
 * Event of one folded sale page, or null when the page is the product's own first sale.
 * [keeper] is the catalog record the page now belongs to; [estimate] = pbShipEstimator(…) for
 * pages that name no shipping month (the event then carries date_estimated: true).
 */
export function eventFromSalePage(pageId, page, keeper, estimate = null) {
  if (!page || !keeper) return null;
  const tags = saleTags(page.name);
  const ship = page.ship || tags.ship;
  const original = monthIndex(keeper.release_date);
  const shipIndex = monthIndex(ship);
  const explicit = tags.resale || (tags.batch != null && tags.batch >= 2);
  const later = shipIndex != null && original != null && shipIndex - original >= 2;
  const isEvent = later || (explicit && (shipIndex == null || original == null || shipIndex > original));
  if (!isEvent) return null;
  const tamashiiPage = /^tamashii-/.test(pageId) || page.source === "tamashii_web_jp";
  const kind = tags.lottery && !tags.resale ? "lottery" : tamashiiPage ? "tamashii_resale" : "pb_resale";
  const known = ship || monthOf(page.order_opens_at);
  const date = known || estimate?.(pageId) || monthOf(page.first_seen);
  if (!date) return null;
  // Without a month of its own, a page that ships no later than the product is not a resale.
  if (!known && original != null && monthIndex(date) <= original) return null;
  return {
    ...(known ? {} : { date_estimated: true }),
    kit_id: keeper.kit_id,
    date,
    kind,
    source_url: page.url || null,
    announced_at: page.order_opens_at || null,
    seen: page.first_seen || null,
    source: "sale_page",
    title: page.name || null,
    page_id: pageId,
  };
}

/** Product-key index of the live catalog: `${grade}|${key without model codes}` → kits */
export function productIndex(kits) {
  const index = new Map();
  for (const kit of kits) {
    const name = kit.names?.ja;
    if (!name || kit.category === "goods") continue;
    const key = `${kit.grade_code}|${productKey(name, { keepCodes: false })}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(kit);
  }
  return index;
}

/**
 * The one older catalog product a news / PB name means, or null (none, or more than one).
 * Only products released at least 2 months before [beforeMonth] count (the news is a resale
 * of something that already sold). [gradeHint] is used when the name carries no grade token.
 */
export function matchProduct(index, name, { beforeMonth = null, gradeHint = null } = {}) {
  const grade = gundamGradeFromName(name) || gradeHint;
  if (!grade) return null;
  const bare = productKey(name, { keepCodes: false });
  if (!bare || bare.length < 3) return null;
  const full = productKey(name);
  const limit = monthIndex(beforeMonth);
  const candidates = (index.get(`${grade}|${bare}`) || []).filter((kit) => {
    if (limit == null) return true;
    const released = monthIndex(kit.release_date);
    return released != null && released <= limit - 2;
  });
  if (candidates.length === 1) return candidates[0];
  const exact = candidates.filter((kit) => productKey(kit.names?.ja) === full);
  return exact.length === 1 ? exact[0] : null;
}

// 「GGGシリーズ … -INTO THE SKY-」10月下旬再販！ / ROBOT魂 ver. A.N.I.M.E.「ガンダム」「シャア専用ザク」2027年4月再販決定！
// → product names; a short Latin brand in front of the first 「 is prepended to each.
export function newsProductNames(title) {
  const text = nfkc(title);
  const quoted = [...text.matchAll(/「([^」]{2,80})」/g)].map((match) => match[1].trim());
  if (!quoted.length) return [];
  const lead = text.slice(0, text.indexOf("「")).trim();
  const brand = /^[A-Za-z0-9魂 .\-/]{2,32}$/.test(lead) ? lead : "";
  return quoted.map((name) => (brand && !name.startsWith(brand) ? `${brand} ${name}` : name));
}

/** Month a news title names: "2027年4月", or "10月下旬" / "8月1日" in the year after [announcedAt]. */
export function newsMonth(title, announcedAt) {
  const text = nfkc(title);
  const full = monthOf(text);
  if (full) return full;
  const bare = /(?<![\d年])(\d{1,2})月(?:\s*(?:\d{1,2}日|[上中下]旬|より|に|から|発売|発送|再販))/.exec(text);
  const announced = monthOf(announcedAt);
  if (!bare || !announced) return null;
  const month = Number(bare[1]);
  if (month < 1 || month > 12) return null;
  let year = Number(announced.slice(0, 4));
  if (month < Number(announced.slice(5, 7)) - 1) year += 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Tamashii page ids in a Tamashii link (…/item/16049/, …/item/?twid=16100,16101). */
export function tamashiiIds(url) {
  const text = String(url || "");
  const twid = /[?&]twid=([\d,]+)/.exec(text)?.[1];
  if (twid) return twid.split(",").filter(Boolean);
  const item = /tamashiiweb\.com\/item\/(\d+)/.exec(text)?.[1];
  return item ? [item] : [];
}

/** Premium Bandai item id in a p-bandai.jp item link */
export function pbItemId(url) {
  return /p-bandai\.jp\/item\/item-(\d{10})/.exec(String(url || ""))?.[1] || null;
}

/**
 * Events from data/announcements.json records.
 *  ctx = { kitsById, aliases, index, salePages }
 */
export function eventsFromAnnouncements(records, { kitsById, aliases, index, salePages = {} }) {
  const live = (id) => {
    const kit = kitsById.get(resolveAlias(aliases, id));
    return kit || null;
  };
  const events = [];
  for (const record of records || []) {
    const title = record.names?.ja || "";
    const announcedAt = record.announced_at || null;
    if (!title || !announcedAt || NOT_A_RESALE.test(nfkc(title))) continue;
    const tags = saleTags(title);
    const announcedMonth = monthOf(announcedAt);
    if (record.source_id === "premium_bandai_new_items") {
      const explicit = tags.resale || (tags.batch != null && tags.batch >= 2);
      if (!explicit && !tags.lottery) continue;
      const itemId = pbItemId(record.source_url);
      const pageId = itemId ? `pbandai-wb-${itemId}` : null;
      let kit = pageId ? live(pageId) : null;
      // The page's own record (never folded: the catalog has no older product) is not a resale of anything.
      if (kit && kit.kit_id === pageId) kit = null;
      if (!kit) kit = matchProduct(index, title, { beforeMonth: announcedMonth });
      if (!kit) continue;
      const original = monthIndex(kit.release_date);
      // A lottery is a restock only for a product that already sold.
      if (!explicit && (original == null || original > monthIndex(announcedMonth) - 2)) continue;
      const ship = tags.ship || (pageId && salePages[pageId]?.ship) || null;
      events.push({
        kit_id: kit.kit_id,
        date: ship || announcedAt,
        kind: tags.lottery && !tags.resale ? "lottery" : "pb_resale",
        source_url: record.source_url || null,
        announced_at: announcedAt,
        seen: null,
        source: "pb_news",
        title,
        page_id: pageId,
      });
      continue;
    }
    if (!tags.resale) continue;
    if (/^tamashii_/.test(record.source_id || "")) {
      const kits = new Map();
      for (const id of tamashiiIds(record.source_url)) {
        const pageId = `tamashii-${id}`;
        const kit = live(pageId);
        // A topic often links the new figure next to the resold one ("「Zガンダム」登場！
        // Mk-II も再販決定"): a page that is its own, recent product is the new figure.
        const released = monthIndex(kit?.release_date);
        if (kit && kit.kit_id === pageId && (released == null || released > monthIndex(announcedMonth) - 2)) continue;
        if (kit) kits.set(kit.kit_id, { kit, pageId });
      }
      for (const { kit, pageId } of kits.values()) {
        const ship = salePages[pageId]?.ship || newsMonth(title, announcedAt);
        events.push({
          kit_id: kit.kit_id,
          date: ship || announcedAt,
          kind: tags.lottery ? "lottery" : "tamashii_resale",
          source_url: record.source_url || null,
          announced_at: announcedAt,
          seen: null,
          source: "tamashii_news",
          title,
          page_id: pageId,
        });
      }
      continue;
    }
    if (!["gundam_official_news", "bandai_spirits_topics", "bandai_hobby_news", "gundam_base_news"].includes(record.source_id)) continue;
    const month = newsMonth(title, announcedAt);
    const matched = new Map();
    for (const name of newsProductNames(title)) {
      const kit = matchProduct(index, name, { beforeMonth: announcedMonth });
      if (kit) matched.set(kit.kit_id, kit);
    }
    for (const kit of matched.values()) {
      events.push({
        kit_id: kit.kit_id,
        date: month || announcedAt,
        kind: isTamashiiKit(kit) ? "tamashii_resale" : "retail_resale",
        source_url: record.source_url || null,
        announced_at: announcedAt,
        seen: null,
        source: "official_news",
        title,
      });
    }
  }
  return events;
}

/** BANDAI SPIRITS kits whose release month moved ≥ 12 months later while the old month was ≥ 6 months past. */
export function eventsFromCatalogShift(beforeKits, afterKits, today) {
  const before = new Map((beforeKits || []).map((kit) => [kit.kit_id, kit]));
  const now = monthIndex(today);
  const events = [];
  for (const kit of afterKits || []) {
    const old = before.get(kit.kit_id);
    if (!old || !(kit.source_refs || []).some((ref) => ref.source_id === "bandai_spirits_products_jp")) continue;
    const from = monthIndex(old.release_date);
    const to = monthIndex(kit.release_date);
    if (from == null || to == null || now == null) continue;
    if (to - from < 12 || from > now - 6 || to < now - 1) continue;
    events.push({
      kit_id: kit.kit_id,
      date: kit.release_date,
      kind: "retail_resale",
      source_url: (kit.source_urls || [])[0] || null,
      announced_at: null,
      seen: null,
      source: "catalog",
      title: kit.names?.ja || null,
      previous_date: old.release_date,
    });
  }
  return events;
}

export function eventId(event) {
  return `${event.kit_id}|${monthOf(event.date) || event.date}|${event.kind}`;
}

/**
 * One event per kit · month · kind. The sale page wins over news (it has the item page and
 * the shipping month); the earliest official date and the earliest `seen` are kept.
 */
export function mergeEvents(events) {
  const rank = { sale_page: 0, pb_news: 1, tamashii_news: 1, official_news: 2, catalog: 3 };
  const byId = new Map();
  // A PB page in the ledger and the PB news of the same item are one event even if
  // one of them has no shipping month: fold news into the page's event by page id.
  const byPage = new Map();
  for (const event of [...events].sort((a, b) => (rank[a.source] ?? 9) - (rank[b.source] ?? 9))) {
    const samePage = event.page_id && byPage.get(`${event.kit_id}|${event.page_id}`);
    const id = samePage || eventId(event);
    const prev = byId.get(id);
    if (event.page_id && !byPage.has(`${event.kit_id}|${event.page_id}`)) byPage.set(`${event.kit_id}|${event.page_id}`, id);
    if (!prev) {
      byId.set(id, { ...event });
      continue;
    }
    const earliest = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
    byId.set(id, {
      ...prev,
      announced_at: earliest(prev.announced_at, event.announced_at),
      seen: earliest(prev.seen, event.seen),
      date: prev.date.length >= event.date.length || !String(event.date).startsWith(prev.date) ? prev.date : event.date,
    });
  }
  return [...byId.values()];
}

/**
 * Final document. [previous] = last restocks.json (keeps `seen` / `quiet` and the baseline).
 * Events older than [HISTORY_MONTHS] (by date) are dropped.
 */
export function buildRestockDoc({ events, previous = null, today, kitsById, now = new Date() }) {
  const baseline = previous?.baseline || today;
  const prevById = new Map((previous?.events || []).map((event) => [eventId(event), event]));
  const cutoff = shiftMonth(today, -HISTORY_MONTHS);
  const merged = mergeEvents(events).filter((event) => kitsById.has(event.kit_id) && (monthOf(event.date) || "") >= cutoff);
  const out = merged.map((event) => {
    const prev = prevById.get(eventId(event));
    // `seen` is the day this event first reached restocks.json, so the notify feed files it
    // under a date the app has not read yet.
    const seen = prev?.seen || today;
    let quiet = prev ? prev.quiet === true : null;
    if (quiet == null) {
      const month = monthIndex(event.date);
      const over = month != null && month < monthIndex(seen) - 1;
      const fresh = event.announced_at && event.announced_at >= shiftDay(seen, -BASELINE_FRESH_DAYS);
      quiet = over || (seen === baseline && !fresh) || (event.announced_at != null && !fresh && event.source !== "sale_page");
    }
    const compact = {
      kit_id: event.kit_id,
      date: event.date,
      kind: event.kind,
      source_url: event.source_url || null,
      announced_at: event.announced_at || null,
      seen,
      source: event.source,
    };
    if (event.title) compact.title = event.title;
    if (event.previous_date) compact.previous_date = event.previous_date;
    if (event.date_estimated) compact.date_estimated = true;
    if (quiet) compact.quiet = true;
    return compact;
  });
  out.sort((a, b) => b.date.localeCompare(a.date) || a.kit_id.localeCompare(b.kit_id) || a.kind.localeCompare(b.kind));
  const byKit = {};
  out.forEach((event, i) => (byKit[event.kit_id] ||= []).push(i));
  const counts = Object.fromEntries(RESTOCK_KINDS.map((kind) => [kind, out.filter((event) => event.kind === kind).length]));
  return {
    schema: 1,
    updated_at: today,
    generated_at: now.toISOString(),
    baseline,
    history_months: HISTORY_MONTHS,
    kinds: {
      pb_resale: "Premium Bandai sells the item again (【再販】, 【２次：…発送】, a later shipping month)",
      retail_resale: "BANDAI SPIRITS ships the kit to shops again (official news / a new store month)",
      tamashii_resale: "Tamashii Nations sells the figure again (（YYYY年M月発送分） batch, 再販 news)",
      lottery: "A lottery sale (抽選販売) of a product that already sold",
    },
    counts,
    sources: [
      { id: "sale_page", name: "Folded Premium Bandai / Tamashii sale pages (data/sale-pages.json)" },
      { id: "pb_news", name: "Premium Bandai new items marked 再販 (data/announcements.json)" },
      { id: "tamashii_news", name: "TAMASHII WEB 再販 topics (data/announcements.json)" },
      { id: "official_news", name: "GUNDAM.INFO / BANDAI SPIRITS news with 再販 in the title (data/announcements.json)" },
      { id: "catalog", name: "BANDAI SPIRITS release month moved a year or more later (data/kits.json)" },
    ],
    events: out,
    by_kit: byKit,
  };
}

/** Same content as before (ignoring generated_at)? */
export function sameRestockContent(a, b) {
  if (!a || !b) return false;
  const strip = ({ generated_at: _g, updated_at: _u, ...rest }) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/** The event a notify feed item carries for [kitId] among [events] seen on one feed date: the latest restock. */
export function pickNotifyEvent(events) {
  return [...events].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
}
