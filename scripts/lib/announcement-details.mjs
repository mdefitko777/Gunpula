// The product text behind an announcement (Hobby Atlas: 예고 → 「상품 소개」): the
// maker's description, spec, set contents, price, preorder period, release or
// ship month and gallery, in Japanese exactly as published (no translation).
// Written by scripts/fetch_bandai_announcements.mjs to data/announcement-details.json,
// keyed by announcement id, apart from announcements.json, which the app reads
// on every refresh. Pure functions; the fetcher does the requests.
//
// Sources (2026-11-13/14): 魂ウェブ item pages carry all of it in plain HTML (the
// schedule and search APIs have no text); コトブキヤショップ goods pages carry
// the description and spec. Premium Bandai item pages are an Akamai JavaScript
// challenge and are never requested; their store links are kept, not fetched.
// The long LP banners (/assets/item/…_webN.webp, up to 2.3 MB) and videos are
// left out.
import { decodeEntities } from "./html-entities.mjs";
import { shiftDay } from "./bandai-announcements.mjs";
import { extractTamashiiGalleryImages } from "./tamashii-images.mjs";
import { parseKotobukiyaShopDetail } from "./kotobukiya-shop.mjs";

export const DETAILS_SCHEMA = 1;
// Raised when a parser learns a field, so every entry is read again (spread
// over runs by the per-host cap).
export const EXTRACTOR_VERSION = 1;
export const MAX_GALLERY = 12;
// Detail pages per host and run: the backfill of ~50 pages spreads over about a week.
export const DETAIL_PAGES_PER_HOST = 6;
// A preorder's price and ship month can still change: entries are read again
// this often while the record is this young and the product has not shipped.
const REFRESH_DAYS = 14;
const REFRESH_WHILE_DAYS = 90;
const RETRY_DAYS = 7;
const GONE_RETRY_DAYS = 30;

const TAMASHII_ITEM = /^https:\/\/tamashiiweb\.com\/item\/\d+\/?$/;
const KOTOBUKIYA_GOODS = /^https:\/\/shop\.kotobukiya\.co\.jp\/shop\/g\/g\d+\/?$/;
// 魂ウェブ's line under every product, about other countries.
const TAMASHII_BOILERPLATE = /記載の情報は日本での発売情報です/;

/** Which parser reads the record's page: "tamashii", "kotobukiya" or null. */
export function detailSource(record) {
  if (!record || record.unofficial || record.confidence === "unofficial") return null;
  const url = String(record.source_url || "");
  if (TAMASHII_ITEM.test(url)) return "tamashii";
  if (KOTOBUKIYA_GOODS.test(url)) return "kotobukiya";
  return null;
}

/** Markup → text, <br> kept as line breaks, spaces collapsed per line. */
export function textOf(html) {
  return decodeEntities(String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.replace(/[ \t\r\f\v ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function oneLine(html) {
  return textOf(html).replace(/\n/g, " ").trim();
}

function pairs(dlHtml) {
  return [...String(dlHtml || "").matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd([^>]*)>([\s\S]*?)<\/dd>/g)]
    .map((match) => ({ label: oneLine(match[1]), attributes: match[2], html: match[3] }));
}

function times(html) {
  return [...String(html || "").matchAll(/<time[^>]*datetime="([^"]+)"/g)].map((match) => match[1]);
}

// A page that came with a 200 but is not the product page: a bot check stops the host.
const CHALLENGE = /bm-verify|_abck|JavaScript\s*を\s*有効|captcha/i;

/**
 * A 魂ウェブ item page → { entry } or { error, challenge }. Checked against
 * 16258 (web shop, 発送月), 16259 (a one-day window) and 16187 (store item, 発売月).
 */
export function parseTamashiiItemDetails(html, url) {
  const page = String(html || "");
  const info = /<dl class="productInfoList">([\s\S]*?)<\/dl>/.exec(page)?.[1];
  if (!info) {
    const title = /<title>([\s\S]*?)<\/title>/.exec(page)?.[1] || "";
    return { error: "no product block", challenge: CHALLENGE.test(page) || !/魂ウェブ/.test(title) };
  }
  const entry = {
    lead: oneLine(/<h2 class="detailSec__lead">([\s\S]*?)<\/h2>/.exec(page)?.[1]) || null,
    description: [...page.matchAll(/<p class="detailSec__txt">([\s\S]*?)<\/p>/g)].map((match) => textOf(match[1])).filter(Boolean),
    spec: [],
    contents: [],
    price_jpy: null,
    price_text: null,
    sale_period_text: null,
    sale_period_from: null,
    sale_period_to: null,
    release_kind: null,
    release_month: null,
    release_text: null,
    sale_channel: oneLine(/<p class="productMain__category[^"]*">([\s\S]*?)<\/p>/.exec(page)?.[1]) || null,
    gallery: [],
    store_url: /href="(https:\/\/p-bandai\.jp\/item\/item-\d+\/?)"/.exec(page)?.[1] || null,
    notes: [],
  };
  const specList = /<dl class="productSpecList">([\s\S]*?)<\/dl>/.exec(page)?.[1] || "";
  for (const item of specList.split(/<div class="productSpecList__item">/).slice(1)) {
    const label = oneLine(/<dt[^>]*>([\s\S]*?)<\/dt>/.exec(item)?.[1]);
    const value = /<dd[^>]*>([\s\S]*?)<\/dd>/.exec(item)?.[1];
    if (!label || value == null) continue;
    // セット内容 is its own list (구성품), not a spec row shown twice.
    if (/セット内容/.test(label)) {
      entry.contents = textOf(value).split("\n").map((line) => line.replace(/^[・･]\s*/, "").trim()).filter(Boolean);
    } else if (oneLine(value)) {
      entry.spec.push({ label, value: oneLine(value) });
    }
  }
  for (const { label, attributes, html: value } of pairs(info)) {
    if (/_price/.test(attributes) || /価格/.test(label)) {
      const amount = /<em>([\s\S]*?)<\/em>/.exec(value)?.[1];
      const digits = oneLine(amount || value).replace(/[^\d]/g, "");
      entry.price_jpy = digits ? Number(digits) : null;
      entry.price_text = oneLine(value) || null;
    } else if (/予約期間/.test(label)) {
      const [from = null, to = null] = times(value);
      entry.sale_period_from = from;
      entry.sale_period_to = to;
      entry.sale_period_text = oneLine(value).replace(/\s*([～〜])\s*/g, "$1") || null;
    } else if (/発送|発売/.test(label)) {
      entry.release_kind = /発送/.test(label) ? "ship" : "release";
      entry.release_month = times(value)[0]?.slice(0, 7) || null;
      entry.release_text = oneLine(value).replace(/\s+/g, "") || null;
    }
  }
  entry.gallery = extractTamashiiGalleryImages(page, url)
    .filter((image) => !/\/assets\/item\//.test(image))
    .slice(0, MAX_GALLERY);
  const notes = /<ul class="productArea__note[^"]*">([\s\S]*?)<\/ul>/.exec(page)?.[1] || "";
  entry.notes = [...notes.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((match) => oneLine(match[1]))
    .filter((note) => note && !TAMASHII_BOILERPLATE.test(note));
  return { entry };
}

/** A コトブキヤショップ goods page (already decoded from Shift_JIS) → { entry } or { error, challenge }. */
export function kotobukiyaDetailsFromHtml(html, url) {
  const page = String(html || "");
  if (!/<h1 class="goods_name_">/.test(page)) {
    return { error: "no product block", challenge: CHALLENGE.test(page) || !/コトブキヤ/.test(page) };
  }
  const detail = parseKotobukiyaShopDetail(page, url);
  const release = detail.release_date || null;
  return {
    entry: {
      lead: null,
      description: detail.description || [],
      spec: detail.spec_rows || [],
      contents: [],
      price_jpy: detail.price_jpy ?? null,
      price_text: detail.price_text || null,
      sale_period_text: null,
      sale_period_from: null,
      sale_period_to: null,
      release_kind: release ? "release" : null,
      release_month: release ? release.slice(0, 7) : null,
      release_text: detail.release_text || null,
      sale_channel: null,
      gallery: (detail.gallery || []).slice(0, MAX_GALLERY),
      store_url: null,
      notes: [],
    },
  };
}

/** Does the entry have something to show (the app shows no button otherwise)? */
export function hasDetailContent(entry) {
  return Boolean(entry && (entry.description?.length || entry.spec?.length || entry.contents?.length
    || entry.price_jpy || entry.gallery?.length));
}

function daysSince(day, today) {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
}

/** Why the record's page should be read this run, or null. */
export function detailFetchReason(record, entry, today) {
  if (!entry) return "new";
  if (entry.page_url !== record.source_url) return "new";
  if ((entry.extractor_version || 0) < EXTRACTOR_VERSION) return "version";
  if (entry.error) return entry.retry_after && today >= entry.retry_after ? "retry" : null;
  const young = String(record.announced_at || "") >= shiftDay(today, -REFRESH_WHILE_DAYS);
  const unshipped = !entry.release_month || entry.release_month >= today.slice(0, 7);
  return young && unshipped && daysSince(entry.fetched_at, today) >= REFRESH_DAYS ? "refresh" : null;
}

const REASON_ORDER = ["new", "version", "retry", "refresh"];

/**
 * The pages to read this run: [{ id, url, source, host, reason }], new pages
 * first (newest record first), then retries and refreshes, at most `perHost`
 * per host. A page whose HTML the run already has (`preloaded`: Set of ids, a
 * new コトブキヤ goods page) costs nothing and is not counted.
 */
export function planDetailFetches(records, previous = {}, today, { perHost = DETAIL_PAGES_PER_HOST, preloaded = new Set() } = {}) {
  const wanted = [];
  for (const record of records) {
    const source = detailSource(record);
    if (!source) continue;
    const reason = detailFetchReason(record, previous[record.id], today);
    if (!reason) continue;
    wanted.push({ id: record.id, url: record.source_url, source, host: new URL(record.source_url).host, reason, announcedAt: record.announced_at || "" });
  }
  wanted.sort((a, b) => REASON_ORDER.indexOf(a.reason) - REASON_ORDER.indexOf(b.reason)
    || b.announcedAt.localeCompare(a.announcedAt)
    || a.id.localeCompare(b.id));
  const used = new Map();
  const plan = [];
  for (const item of wanted) {
    const free = preloaded.has(item.id);
    if (!free && (used.get(item.host) || 0) >= perHost) continue;
    if (!free) used.set(item.host, (used.get(item.host) || 0) + 1);
    const { announcedAt, ...rest } = item;
    plan.push(rest);
  }
  return plan;
}

/**
 * The next `details` map. `results`: Map id → { url, entry } (parsed),
 * { url, error, gone } (404) or { url, error } (any other failure); a host
 * that stopped the run gives no result and its entries stay as they were.
 * `liveIds`: the ids written to announcements.json; other entries go. A failed
 * refresh keeps the old text and only says when to try again.
 */
export function mergeDetails(previous = {}, results = new Map(), liveIds = new Set(), today) {
  const next = {};
  for (const id of [...new Set([...Object.keys(previous), ...results.keys()])].sort()) {
    if (!liveIds.has(id)) continue;
    const old = previous[id];
    const result = results.get(id);
    if (!result) {
      if (old) next[id] = old;
      continue;
    }
    if (result.entry) {
      next[id] = {
        page_url: result.url,
        fetched_at: today,
        extractor_version: EXTRACTOR_VERSION,
        lang: "ja",
        ...result.entry,
        error: null,
        retry_after: null,
      };
      continue;
    }
    const retryAfter = shiftDay(today, result.gone ? GONE_RETRY_DAYS : RETRY_DAYS);
    next[id] = hasDetailContent(old) && old.page_url === result.url
      ? { ...old, error: result.error, retry_after: retryAfter }
      : { page_url: result.url, fetched_at: today, extractor_version: EXTRACTOR_VERSION, error: result.error, retry_after: retryAfter };
  }
  return next;
}
