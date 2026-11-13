// When a preorder opens and closes, as optional announcement fields the app
// shows and reminds by (Hobby Atlas, like live_at for streams):
//
//   preorder_at       "2026-11-13T18:00:00+09:00"  only when a source gives a clock
//   preorder_date     "2026-11-13"                 the opening day (JST), whenever known
//   preorder_end_at   / preorder_end_date          the closing instant / last day
//   preorder_basis    manual | store_list | post_body | title | schedule
//
// A day without a clock is never written as 00:00: the app would remind at
// midnight. On 2026-11-13 the clock was only in the Japanese title for 99 of
// 210 preorder_open records (「魂ウェブ商店にて11/13 18時より予約受付開始！」),
// in Premium Bandai's new-items list ("開始：11/13 12時") for the rest of its
// own, and in the post body for BEYBLADE X's 受注生産 notices. Every clock seen
// was JST and on the hour. Pure functions; the fetcher
// (scripts/fetch_bandai_announcements.mjs) and the merge call them.
import { shiftDay, stripTags } from "./bandai-announcements.mjs";

export const PREORDER_KEYS = ["preorder_at", "preorder_date", "preorder_end_at", "preorder_end_date", "preorder_basis"];

// Which evidence wins. A clock always beats a day; among clocks the store's
// own list beats a post body, which beats a title. The 魂ウェブ schedule has
// days only, and the most reliable ones.
const CLOCK_RANK = { title: 1, post_body: 2, store_list: 3, manual: 9 };
const DAY_RANK = { title: 1, post_body: 2, store_list: 3, schedule: 4, manual: 9 };

function pad(value) {
  return String(value).padStart(2, "0");
}

/** "2026-11-13", 18, 0 → "2026-11-13T18:00:00+09:00" (the live_at format). */
export function japanInstant(day, hour, minute = 0) {
  return `${day}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

/** The JST calendar day of a Date. */
export function japanDayOf(now) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

function validDay(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * A month and day without a year → the one of `refDay`'s year −1, 0, +1 nearest
 * to it (a 12-28 post saying 「1/5 16時より」 means next January). Premium
 * Bandai's list and the titles share this rule.
 */
export function nearestYearDay(month, day, refDay) {
  const year = Number(refDay.slice(0, 4));
  const ref = Date.parse(`${refDay}T00:00:00Z`);
  return [year - 1, year, year + 1]
    .map((candidate) => validDay(candidate, month, day))
    .filter(Boolean)
    .sort((a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - ref) - Math.abs(Date.parse(`${b}T00:00:00Z`) - ref))[0] || null;
}

// ---------------------------------------------------------------------------
// Titles.

function halfWidth(text) {
  return String(text || "").replace(/[０-９：／]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

// 「11/13 18時より」「本日11月12日11時より」「5月22日 16時受注開始」「本日11時より」.
// m/d is not a scale ("1/144", "1/12スケール").
const DATE = String.raw`(?:(?:(?<y>\d{4})年)?(?<m>\d{1,2})月(?<d>\d{1,2})日|(?<!\d)(?<m2>\d{1,2})\/(?<d2>\d{1,2})(?!\d|\s*(?:スケール|scale)))(?:\s*[（(][月火水木金土日](?:・祝)?[）)])?`;
const TIME = String.raw`(?:(?<ampm>午前|午後)?(?<!\d)(?<h>\d{1,2})時(?:(?<min>\d{1,2})分|(?<half>半))?|(?<!\d)(?<h2>\d{1,2}):(?<min2>\d{2})(?!\d))`;
const TOKEN = new RegExp(String.raw`(?<today>本日)?\s*(?:${DATE})?\s*(?:${TIME})?\s*(?<from>より|から|～|〜)?`, "g");
// The opening verb has to follow in the same clause, within 28 characters.
const ORDER_VERB = /^[^！!。、「」]{0,28}?(?:予約|受注|お?申し?込み)/;
const RECEPTION = /^[^！!。、「」]{0,28}?受付/;
const START = /^[^！!。、「」]{0,28}?(?:スタート|開始)/;
// A 受付 can be a vote (ガンプラ再販会議's 「選抜選挙」投票受付中, 4 rows tagged
// preorder_open on 2026-11-13); スタート alone opened a vote and a forum.
const VOTE = /投票|選挙/;
const ORDER_WORD = /予約|受注|申込|申し込/;
// A date followed by these is a release, a shipment or a broadcast, not the
// preorder ("11月2日より順次発売", but 「再販予約」 is a preorder).
const NOT_OPENING = /^\s*(?:に|より|から)?\s*(?:順次)?(?:発売|発送|再販(?!予約)|登場|出荷|公開|配信|放送|開催)/;
// A result further than this from the post is a misreading, not a preorder.
const DAYS_BEFORE_POST = 1;
const DAYS_AFTER_POST = 60;

function sentenceAround(text, start, end) {
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf("！"), before.lastIndexOf("!"), before.lastIndexOf("。")) + 1;
  const rest = text.slice(end).search(/[！!。]/);
  return text.slice(from, rest < 0 ? text.length : end + rest);
}

function opensHere(after, sentence) {
  if (NOT_OPENING.test(after)) return false;
  if (ORDER_VERB.test(after)) return true;
  if (RECEPTION.test(after) && !VOTE.test(sentence)) return true;
  return START.test(after) && ORDER_WORD.test(sentence);
}

/**
 * A title's preorder opening → { at?, date, basis: "title" } or null. `postDay`
 * is the post's JST day (announced_at); 本日 and a bare clock mean that day,
 * except for a record dated by when the bot first saw it (`firstSeen`).
 */
export function preorderFromTitle(title, postDay, { firstSeen = false } = {}) {
  if (!postDay) return null;
  const text = halfWidth(title);
  const hits = [];
  for (const match of text.matchAll(TOKEN)) {
    const groups = match.groups;
    if (!match[0].trim() || (!groups.today && !groups.m && !groups.m2 && !groups.h && !groups.h2)) continue;
    const end = match.index + match[0].length;
    if (!opensHere(text.slice(end), sentenceAround(text, match.index, end))) continue;
    const month = Number(groups.m || groups.m2) || null;
    const day = Number(groups.d || groups.d2) || null;
    let hour = groups.h ?? groups.h2;
    hour = hour == null ? null : Number(hour) + (groups.ampm === "午後" && Number(hour) < 12 ? 12 : 0);
    const minute = hour == null ? null : Number(groups.min ?? groups.min2 ?? (groups.half ? 30 : 0));
    if (hour != null && (hour > 23 || minute > 59)) continue;
    let date = null;
    if (month) {
      date = groups.y ? validDay(Number(groups.y), month, day) : nearestYearDay(month, day, postDay);
    } else if (!firstSeen) {
      date = postDay;
    }
    if (!date || date < shiftDay(postDay, -DAYS_BEFORE_POST) || date > shiftDay(postDay, DAYS_AFTER_POST)) continue;
    hits.push({ date, hour, minute, explicit: Boolean(month) });
  }
  // A clock first, then a written date, then the first.
  hits.sort((a, b) => Number(b.hour != null) - Number(a.hour != null) || Number(b.explicit) - Number(a.explicit));
  const best = hits[0];
  if (!best) return null;
  return {
    ...(best.hour != null ? { at: japanInstant(best.date, best.hour, best.minute) } : {}),
    date: best.date,
    basis: "title",
  };
}

// ---------------------------------------------------------------------------
// BEYBLADE X 受注生産 / 抽選販売 notices: the window is in the body, with year
// and minutes (news261014: 「受注開始日時 2026年10月15日（木）10:00 受注終了日時
// 2026年10月28日（水）23:59 終了」). The general notices about the system have no
// window and give nothing.

export const BEYBLADE_ORDER_TITLE = /受注生産販売|抽選販売/;

function labelledInstant(text, label) {
  const match = new RegExp(`${label}[^0-9]{0,12}(\\d{4})年(\\d{1,2})月(\\d{1,2})日[^0-9]{0,8}(\\d{1,2}):(\\d{2})`).exec(text);
  if (!match) return null;
  const day = validDay(Number(match[1]), Number(match[2]), Number(match[3]));
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return day && hour <= 23 && minute <= 59 ? japanInstant(day, hour, minute) : null;
}

/** A BEYBLADE X news page → { at, date, end_at?, end_date?, basis: "post_body" } or null. */
export function beybladeOrderWindow(html) {
  const text = halfWidth(stripTags(String(html || "").replace(/<br\s*\/?>/gi, " ")));
  const at = labelledInstant(text, "受注開始日時") || labelledInstant(text, "抽選受付開始日時");
  if (!at) return null;
  const endAt = labelledInstant(text, "受注終了日時") || labelledInstant(text, "抽選受付終了日時");
  return {
    at,
    date: at.slice(0, 10),
    ...(endAt ? { end_at: endAt, end_date: endAt.slice(0, 10) } : {}),
    basis: "post_body",
  };
}

// ---------------------------------------------------------------------------
// Merging. A refetch only moves these fields forward: nothing is removed (a
// Premium Bandai row that scrolled off the list keeps its time), an instant is
// never replaced by a day, a weaker basis never replaces a stronger one, and a
// time that has passed is frozen, so a parser change cannot rewrite history
// unless run once with PREORDER_REPARSE=1. A manual value is never touched.

/** The preorder fields a record carries, as a candidate for applyPreorder, or null. */
export function preorderCandidate(record) {
  if (!record?.preorder_at && !record?.preorder_date && !record?.preorder_end_at && !record?.preorder_end_date) return null;
  return {
    ...(record.preorder_at ? { at: record.preorder_at } : {}),
    ...(record.preorder_date ? { date: record.preorder_date } : {}),
    ...(record.preorder_end_at ? { end_at: record.preorder_end_at } : {}),
    ...(record.preorder_end_date ? { end_date: record.preorder_end_date } : {}),
    basis: record.preorder_basis || "title",
  };
}

/** The record without its preorder fields. */
export function withoutPreorder(record) {
  return Object.fromEntries(Object.entries(record || {}).filter(([key]) => !PREORDER_KEYS.includes(key)));
}

/** Only the record's preorder fields. */
export function preorderFields(record) {
  return Object.fromEntries(Object.entries(record || {}).filter(([key, value]) => PREORDER_KEYS.includes(key) && value));
}

/** A day not after `today` (JST): the opening day has come. */
function dayReached(day, today) {
  return String(day) <= today;
}

/**
 * `record` with `candidate` ({ at?, date?, end_at?, end_date?, basis }) merged
 * in by the rules above. `fillOnly`: only fill what the record lacks (a twin's
 * fields go to the record that stays, which keeps its own). `log(line)` hears
 * every moved value and every disagreement.
 */
export function applyPreorder(record, candidate, { now = new Date(), reparse = false, fillOnly = false, log = () => {} } = {}) {
  if (!candidate || record.preorder_basis === "manual") return record;
  const out = { ...record };
  const today = japanDayOf(now);
  const stored = record.preorder_basis || "title";
  const date = candidate.date || candidate.at?.slice(0, 10) || null;
  const mismatch = (what, mine, theirs) =>
    log(`preorder mismatch ${record.id}: ${stored} ${mine} vs ${candidate.basis} ${theirs}${what ? ` (${what})` : ""}`);
  const setStart = (at, day) => {
    if (at) out.preorder_at = at;
    else delete out.preorder_at;
    out.preorder_date = day;
    out.preorder_basis = candidate.basis;
  };

  if (candidate.at) {
    if (!record.preorder_at) {
      if (record.preorder_date && record.preorder_date !== date) mismatch("clock wins", record.preorder_date, candidate.at);
      setStart(candidate.at, date);
    } else if (record.preorder_at !== candidate.at && !fillOnly) {
      const passed = Date.parse(record.preorder_at) <= now.getTime();
      if (CLOCK_RANK[candidate.basis] >= CLOCK_RANK[stored] && (!passed || reparse)) {
        log(`preorder moved ${record.id}: ${record.preorder_at} -> ${candidate.at} (${candidate.basis})`);
        setStart(candidate.at, date);
      } else {
        mismatch(passed ? "kept, passed" : "kept", record.preorder_at, candidate.at);
      }
    }
  } else if (date) {
    if (record.preorder_at) {
      if (record.preorder_at.slice(0, 10) !== date) mismatch("instant kept", record.preorder_at, date);
    } else if (!record.preorder_date) {
      setStart(null, date);
    } else if (record.preorder_date !== date && !fillOnly) {
      if (DAY_RANK[candidate.basis] >= DAY_RANK[stored] && (!dayReached(record.preorder_date, today) || reparse)) {
        log(`preorder moved ${record.id}: ${record.preorder_date} -> ${date} (${candidate.basis})`);
        setStart(null, date);
      } else {
        mismatch("kept", record.preorder_date, date);
      }
    }
  }

  const endDate = candidate.end_date || candidate.end_at?.slice(0, 10) || null;
  if (candidate.end_at) {
    if (!record.preorder_end_at) {
      out.preorder_end_at = candidate.end_at;
      out.preorder_end_date = endDate;
    } else if (record.preorder_end_at !== candidate.end_at && !fillOnly
      && (Date.parse(record.preorder_end_at) > now.getTime() || reparse)) {
      log(`preorder end moved ${record.id}: ${record.preorder_end_at} -> ${candidate.end_at}`);
      out.preorder_end_at = candidate.end_at;
      out.preorder_end_date = endDate;
    }
  } else if (endDate && !record.preorder_end_at) {
    if (!record.preorder_end_date) {
      out.preorder_end_date = endDate;
    } else if (record.preorder_end_date !== endDate && !fillOnly && (record.preorder_end_date >= today || reparse)) {
      // The schedule extends a window (抽選 batches, 2次 lots) while it runs.
      log(`preorder end moved ${record.id}: ${record.preorder_end_date} -> ${endDate}`);
      out.preorder_end_date = endDate;
    }
  }
  return out;
}

/**
 * Every record's title read again (a pure function of the title and the post
 * day, so the first run fills the stored history too), merged in by
 * applyPreorder.
 */
export function withTitlePreorders(records, options = {}) {
  return records.map((record) => {
    const candidate = preorderFromTitle(record.names?.ja, record.announced_at, {
      firstSeen: record.announced_at_basis === "first_seen",
    });
    return applyPreorder(record, candidate, options);
  });
}

/**
 * The record that stays for a dropped twin takes the twin's preorder fields
 * when it has none of its own (2026-11-13: the 魂ウェブ reveal of キュリオス and
 * its topic post with 「11/13 18時より」 were one product; either may stay).
 * `pool`: Map id → record before the drops (titles already read); `drops`:
 * [{ id, kept }] in the order the steps dropped them, so a chain a → b → c
 * ends at c. Returns Map id → preorder candidate for the records that gained.
 */
export function twinPreorders(pool, drops, options = {}) {
  const records = new Map(pool);
  const gained = new Map();
  for (const { id, kept } of drops) {
    const dropped = records.get(id);
    const survivor = records.get(kept);
    if (!dropped || !survivor || !kept) continue;
    const next = applyPreorder(survivor, preorderCandidate(dropped), { ...options, fillOnly: true });
    if (next === survivor || PREORDER_KEYS.every((key) => next[key] === survivor[key])) continue;
    records.set(kept, next);
    gained.set(kept, preorderCandidate(next));
  }
  return gained;
}

/**
 * Preorder windows from 魂ウェブ's schedule (parseTamashiiSchedule items) →
 * Map item id → { date, end_date?, basis: "schedule" }. Days only: its one
 * clock, publishDate, is when the page went up (キュリオス: 08:00, preorder 18:00).
 */
export function scheduleWindows(items) {
  const windows = new Map();
  for (const item of items || []) {
    if (!item.tamashiiWebId || !/^\d{4}-\d{2}-\d{2}$/.test(item.reserveStartDate || "")) continue;
    windows.set(String(item.tamashiiWebId), {
      date: item.reserveStartDate,
      ...(/^\d{4}-\d{2}-\d{2}$/.test(item.reserveEndDate || "") ? { end_date: item.reserveEndDate } : {}),
      basis: "schedule",
    });
  }
  return windows;
}

/**
 * Records that link a 魂ウェブ item page get its schedule window, when the
 * window opens near the post (the same page, months later, is a resale with a
 * window of its own).
 */
export function withScheduleWindows(records, windows, options = {}) {
  if (!windows?.size) return records;
  return records.map((record) => {
    const itemId = /^https:\/\/tamashiiweb\.com\/item\/(\d+)\/?$/.exec(record.source_url || "")?.[1];
    const window = itemId && windows.get(itemId);
    if (!window || !record.announced_at) return record;
    if (window.date < shiftDay(record.announced_at, -DAYS_BEFORE_POST) || window.date > shiftDay(record.announced_at, DAYS_AFTER_POST)) {
      return record;
    }
    return applyPreorder(record, window, options);
  });
}
