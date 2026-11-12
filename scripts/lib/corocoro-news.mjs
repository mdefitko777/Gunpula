// CoroCoro News (corocoro-news.jp, Shogakukan's WordPress site for 月刊コロコロ
// and コロコロイチバン!) as an announcement source. The magazine scoops BEYBLADE
// X products — mail-order beys (応募者全員有料サービス), prize beys, new
// starters and random-booster contents — weeks before Takara Tomy's lineup page
// lists them. Read by scripts/fetch_bandai_announcements.mjs.
//
// Checked 2026-11-12: corocoro.jp/robots.txt redirects to corocoro-news.jp,
// whose robots.txt only disallows /wp-admin/. The WordPress REST API answers
// without a bot check, so the post list and post bodies are read as JSON
// (/wp-json/wp/v2/posts) instead of scraping the themed pages.
//
// Articles are about the magazine issue, not about one product: the 商品概要
// box at the end is the issue's own release date and price, and one article
// can name several beys. So records are made per product (bey name), not per
// post, and a product named again in a later post stays one record.
import { createHash } from "node:crypto";
import { decodeHtml, stripTags } from "./bandai-announcements.mjs";
import { announcementRecord, normalizeProductKey, productKeys } from "./official-announcements.mjs";

export const COROCORO_HOST = "corocoro-news.jp";
export const COROCORO_API = `https://${COROCORO_HOST}/wp-json/wp/v2`;
export const COROCORO_SOURCE_ID = "corocoro_news";
export const COROCORO_SOURCE_NAME = "コロコロコミック";
// Both spellings: scoop titles say 『BEYBLADE X』, issue previews and older
// posts say ベイブレード. WordPress search also matches post bodies.
export const COROCORO_SEARCHES = ["BEYBLADE", "ベイブレード"];
// The magazine scoops about one issue (a month) ahead; four months of posts
// cover a product from scoop to release.
export const COROCORO_RECENT_DAYS = 120;
// Posts stay in the state file this long, so a product named again months
// later keeps its first post's date.
const COROCORO_KEEP_DAYS = 400;
// Bumped when extraction changes: posts stored by an older extractor are read
// again (only those still in the post list), so a parser fix reaches them.
export const COROCORO_EXTRACTOR_VERSION = 1;

// Bey names: katakana blade name, optional assist-blade letters, ratchet and
// bit ("キッドハントK4-70TK", "メテオドラグーン 3-70J", "ホルスシャッター3-85MO"),
// then an optional colour/edition suffix ("メタルコート：ホワイト",
// "運命の巻戻士ver.", "バージョン2.0").
const BEY_SUFFIX = String.raw`(?:\s?(?:メタルコート\s?[：:]\s?[^\s「」『』、。!！?？（）()]+|クリア\s?[Vv]er\.?|[^\s「」『』、。!！?？（）()]{0,12}[Vv]er\.?|バージョン\d+(?:\.\d+)?))*`;
const BEY_CODE = String.raw`[A-Z]{0,2}(?:\d{1,2}|[A-Z])-\d{2,3}[A-Z][A-Za-z]{0,2}(?![A-Za-z0-9])`;
const BEY_NAME = new RegExp(String.raw`[ァ-ヺー]{3,}\s?${BEY_CODE}${BEY_SUFFIX}`, "g");
// The whole of a 「」 name, edition words possibly before the code: some posts
// write "キッドハント メタルコート：ホワイトK4-70TK".
const WHOLE_BEY_NAME = new RegExp(String.raw`^([ァ-ヺー]{3,})\s?([^「」『』]{0,20}?)\s?(${BEY_CODE})(.*)$`);

/**
 * A bey name in the order the official lineup uses ("キッドハントK4-70TK
 * メタルコート:ホワイト"), or null when `text` is not one bey name.
 */
export function canonicalBeyName(text) {
  const match = WHOLE_BEY_NAME.exec(String(text || "").trim());
  if (!match) return null;
  const [, blade, before, code, after] = match;
  const edition = [before, after].map((part) => part.trim()).filter(Boolean).join(" ");
  return `${blade}${code}${edition ? ` ${edition}` : ""}`;
}
const PRODUCT_CODE = /\b([BUC]X-\d{2,3})\b/g;
// 「…」 that are not products: manga, bound-in books, posters, stickers, cards.
const NOT_A_PRODUCT_NAME = /BOOK|ブック|ポスター|ステッカー|カード|パック|新聞|アートボード|まんが|マンガ|コミック|ミッション|ハガキ|ふろく|図鑑|絵巻|グッズ|ぬいぐるみ|ゲーム|アニメ|大会|ロードマップ/;

// Kind words, nearest to the product name wins. 「ふろくではありません」 is the
// mail-order disclaimer, so ふろく itself is not a kind.
const KINDS = [
  { pattern: /ランダムブースター\s?(?:Vol\.?\s?\d+)?/, label: (text) => text.replace(/\s/g, "").replace(/Vol(\d)/, "Vol.$1") },
  { pattern: /応募者全員有料サービス|全員サービス/, label: () => "応募者全員有料サービス", offer: true },
  { pattern: /銀はがし|\d+名プレゼント/, label: () => "誌上プレゼント", offer: true },
  { pattern: /(?:デッキ|カスタマイズ|オールインワン|バトル|エントリー)?セット/, label: (text) => text },
  { pattern: /スターター/, label: () => "スターター" },
  { pattern: /ブースター/, label: () => "ブースター" },
];
const RETAIL_KINDS = /スターター|ブースター|セット/;
// Words that make a bare bey name a reveal ("新ベイ「…」が大公開"), not a bey
// a manga character or a tournament report mentions in passing.
const NEW_PRODUCT_WORDS = /新ベイ|新作|最新ベイ|初公開|大公開|初出し|発覚|爆誕|新発売|新登場|参戦|先行/;

// One franchise for now; another magazine line (e.g. ポケモン) would add its own
// name pattern here.
export const COROCORO_FRANCHISES = [
  { franchise: "beyblade", article: /BEYBLADE|ベイブレード|ベイ/i, name: BEY_NAME, canonical: canonicalBeyName },
];

function hashId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

// NFKC: CoroCoro writes "メタルコート：ホワイト" and "１２月", the official lineup
// "メタルコート:ブルー".
function textLine(html) {
  return stripTags(html).normalize("NFKC");
}

/** Post body HTML → text lines, without the issue's own 商品概要 box. */
export function articleLines(html) {
  const lines = String(html || "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(?:p|h\d|li|div|tr|td|th|blockquote|table)>/gi, "\n")
    .split("\n")
    .map(textLine)
    .filter(Boolean);
  // 商品概要 / 『月刊コロコロコミック 11月号』 / ■発売日 / ■価格 is the magazine.
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] === "商品概要" && /コロコロ|号』/.test(lines[i + 1] || "")) {
      i += 1;
      while (i + 1 < lines.length && /^■/.test(lines[i + 1])) i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out;
}

function magazineClause(text, index, length) {
  // "『月刊コロコロコミック 11月号』は、本日10月15日（木）発売" and
  // "2026年8月12日頃発売予定の、月刊コロコロコミック９月号" date the issue. Only
  // the words right next to it count: a product line may start with
  // "コロコロ12月号で発表！".
  const around = text.slice(Math.max(0, index - 12), index + length + 12);
  return /コロコロ|イチバン|号』|\d月号/.test(around);
}

function inferYear(month, postDate) {
  const postYear = Number(postDate.slice(0, 4));
  const postMonth = Number(postDate.slice(5, 7));
  // A December post naming "1月" means next January.
  return month < postMonth - 3 ? postYear + 1 : postYear;
}

/** "12月26日（土）ごろ発売予定" → { iso: "2026-12-26", text: "2026年12月26日ごろ" }. */
export function findRelease(text, postDate) {
  const patterns = [
    /(?:(\d{4})年\s?)?(\d{1,2})月\s?(\d{1,2})日\s?(?:[（(][^）)]{1,3}[）)])?\s?(ごろ|頃)?\s?(?:より|に)?\s?(?:発売|登場予定|お届け)/g,
    /■?発売(?:日|予定日)?\s?[：:]\s?(?:(\d{4})年\s?)?(\d{1,2})月\s?(\d{1,2})日\s?(?:[（(][^）)]{1,3}[）)])?\s?(ごろ|頃)?/g,
    /(?:(\d{4})年\s?)?(\d{1,2})月(上旬|中旬|下旬)?\s?(ごろ|頃)?\s?発売/g,
  ];
  const source = String(text || "");
  for (const [index, pattern] of patterns.entries()) {
    for (const match of source.matchAll(pattern)) {
      if (magazineClause(source, match.index, match[0].length)) continue;
      const month = Number(match[2]);
      if (month < 1 || month > 12) continue;
      const year = match[1] ? Number(match[1]) : inferYear(month, postDate);
      const mm = String(month).padStart(2, "0");
      if (index < 2) {
        const day = Number(match[3]);
        const approx = match[4] ? "ごろ" : "";
        return { iso: `${year}-${mm}-${String(day).padStart(2, "0")}`, text: `${year}年${month}月${day}日${approx}` };
      }
      return { iso: `${year}-${mm}`, text: `${year}年${month}月${match[3] || ""}${match[4] ? "ごろ" : ""}` };
    }
  }
  return null;
}

/** "2,600円（税・送料・作業費込）" → 2600; the issue's price is skipped. */
export function findPrice(text) {
  const source = String(text || "");
  for (const match of source.matchAll(/(\d{1,3}(?:,\d{3})+|\d{3,6})\s?円/g)) {
    if (magazineClause(source, match.index, match[0].length)) continue;
    const yen = Number(match[1].replace(/,/g, ""));
    if (yen >= 100) return yen;
  }
  return null;
}

function nearestKind(line, at, length) {
  let best = null;
  for (const kind of KINDS) {
    for (const match of line.matchAll(new RegExp(kind.pattern.source, "g"))) {
      // Words inside the name itself ("…セレクト") do not count.
      if (match.index >= at && match.index < at + length) continue;
      const distance = match.index < at ? at - (match.index + match[0].length) : match.index - (at + length);
      if (!best || distance < best.distance) best = { distance, label: kind.label(match[0]) };
    }
  }
  return best && best.distance <= 40 ? best.label : null;
}

// Only the offer kinds: a whole article about one mail-order or prize bey says
// so somewhere, but a stray "セット" elsewhere says nothing about the bey.
function offerKindIn(text) {
  for (const kind of KINDS.filter((item) => item.offer)) {
    const match = kind.pattern.exec(text);
    if (match) return kind.label(match[0]);
  }
  return null;
}

function newWordNear(line, at, length) {
  return NEW_PRODUCT_WORDS.test(line.slice(Math.max(0, at - 40), at + length + 40));
}

function codeBefore(line, at) {
  const before = line.slice(Math.max(0, at - 30), at);
  return [...before.matchAll(PRODUCT_CODE)].at(-1)?.[1] || null;
}

function tidyName(name) {
  return decodeHtml(name).replace(/\s+/g, " ").trim();
}

// Products named in one line: bey names (in 「」 or bare), 「names」 next to a
// kind word, and product codes with no bey name after them ("UX-18 カスタマイズセットD").
function mentionsInLine(line, franchise) {
  const found = [];
  const taken = [];
  const overlaps = (start, end) => taken.some(([a, b]) => start < b && end > a);
  // 「グラードン」 next to "おあそびセット" in a Pokémon line is not a bey.
  const franchiseLine = franchise.article.test(line) || new RegExp(PRODUCT_CODE.source).test(line);
  for (const match of line.matchAll(/「([^「」]{3,60})」/g)) {
    const inner = tidyName(match[1]);
    const start = match.index + 1;
    const whole = franchise.canonical(inner);
    const kind = nearestKind(line, match.index, match[0].length);
    if (whole) {
      found.push({ name: whole, at: start, length: match[1].length });
    } else if (!new RegExp(franchise.name.source).test(inner) && franchiseLine && kind && RETAIL_KINDS.test(kind)
      && /^[ァ-ヺー]{3,}/.test(inner) && !NOT_A_PRODUCT_NAME.test(inner)) {
      // A new bey whose ratchet and bit are not public yet: 「バニッシュルシファー WW」.
      found.push({ name: inner, at: start, length: match[1].length });
    } else {
      // Not a name on its own (「新ベイ ドランソード3-60F」): a bey inside is
      // still found by the bare-name pass below.
      continue;
    }
    taken.push([match.index, match.index + match[0].length]);
  }
  for (const match of line.matchAll(new RegExp(franchise.name.source, "g"))) {
    if (overlaps(match.index, match.index + match[0].length)) continue;
    found.push({ name: franchise.canonical(tidyName(match[0])) || tidyName(match[0]), at: match.index, length: match[0].length });
    taken.push([match.index, match.index + match[0].length]);
  }
  for (const match of line.matchAll(PRODUCT_CODE)) {
    const rest = line.slice(match.index + match[0].length);
    const tail = /^\s?([^「」『』、。!！?？（(]{2,30}?)(?=\s?(?:が|は|を|の|も|\d{1,2}月|発売|[、。!！?？（(「]|$))/.exec(rest);
    const end = match.index + match[0].length + (tail ? tail[0].length : 0);
    if (!tail || overlaps(match.index, end + 2) || !RETAIL_KINDS.test(tail[1])) continue;
    found.push({ name: tidyName(`${match[1]} ${tail[1]}`), at: match.index, length: end - match.index, coded: true });
    taken.push([match.index, end]);
  }
  return found;
}

/**
 * One CoroCoro post → the products it names, each with what the post says
 * about it: { name, key, code, kind, release, price }.
 * post = { title, content (HTML), date (YYYY-MM-DD…) }.
 */
export function extractCoroCoroProducts(post) {
  const date = String(post.date || "").slice(0, 10);
  const lines = [textLine(post.title), ...articleLines(post.content)];
  const fullText = lines.join("\n");
  const products = new Map();
  for (const franchise of COROCORO_FRANCHISES) {
    if (!franchise.article.test(fullText)) continue;
    const mentions = lines.map((line) => mentionsInLine(line, franchise));
    for (const [lineIndex, lineMentions] of mentions.entries()) {
      for (const mention of lineMentions) {
        const key = normalizeProductKey(mention.name);
        if (key.length < 5) continue;
        const line = lines[lineIndex];
        // What follows the mention, up to the next line naming another product.
        const context = [line.slice(mention.at)];
        for (let next = lineIndex + 1; next < lines.length && next <= lineIndex + 8; next += 1) {
          if (mentions[next].some((other) => normalizeProductKey(other.name) !== key)) break;
          context.push(lines[next]);
        }
        const contextText = context.join("\n");
        const entry = products.get(key)
          || { name: mention.name, key, franchise: franchise.franchise, code: null, kind: null, release: null, price: null, fresh: false };
        entry.code ||= mention.coded ? null : codeBefore(line, mention.at);
        entry.kind ||= mention.coded ? nearestKind(mention.name, mention.name.length, 0) : nearestKind(line, mention.at, mention.length);
        entry.release ||= findRelease(contextText, date);
        entry.price ||= findPrice(contextText);
        entry.fresh ||= newWordNear(line, mention.at, mention.length);
        products.set(key, entry);
      }
    }
    // Late fallback: the kind said anywhere in a one-product article
    // ("…応募者全員有料サービス" in the title, the name only in the body).
    if (products.size === 1) {
      const only = [...products.values()][0];
      only.kind ||= offerKindIn(fullText);
    }
  }
  // Headlines and first mentions shorten names: "クロックミラージュ4-55S" is
  // "クロックミラージュ4-55S メタルコート：ブラック 運命の巻戻士ver." further down.
  const all = [...products.values()];
  const canonical = fullerKeys(all);
  const kept = all.filter((product) => canonical.get(product.key) === product.key);
  for (const product of all) {
    const target = kept.find((other) => other.key === canonical.get(product.key));
    if (target !== product) for (const field of PRODUCT_FIELDS) target[field] ||= product[field];
  }
  return kept;
}

const PRODUCT_FIELDS = ["code", "kind", "release", "price", "fresh"];

// A product the posts say something about. A bare name with no kind, date,
// price, code or reveal word is a bey mentioned in passing (a manga scene, a
// tournament winner), often an old one inside a deck set or random booster
// that the catalog lists under another name.
function isRevealed(product) {
  return Boolean(product.code || product.kind || product.release || product.price || product.fresh);
}

/**
 * key → the fuller key naming the same product: a key another key extends
 * maps to the longest one, unless two different editions extend it
 * ("…メタルコートホワイト" and "…メタルコートブラック"), when it stays its own.
 * Products in different franchises never merge.
 */
function fullerKeys(products) {
  const map = new Map();
  for (const product of products) {
    const longer = products
      .filter((other) => other.franchise === product.franchise && other.key !== product.key && other.key.startsWith(product.key))
      .map((other) => other.key)
      .sort((a, b) => b.length - a.length);
    const chain = longer.length > 0 && longer.every((key) => longer[0].startsWith(key));
    map.set(product.key, chain ? longer[0] : product.key);
  }
  return map;
}

// ---------------------------------------------------------------------------
// State: data/announcements-corocoro.json remembers every post read (with the
// products found in it, possibly none), so a daily run fetches only new or
// edited posts. Records are rebuilt from it every run.

export function emptyCoroCoroState() {
  return { updated_at: null, extractor: COROCORO_EXTRACTOR_VERSION, posts: [] };
}

function productTitle(product) {
  if (/^[BUC]X-\d/.test(product.name)) return `「${product.name}」`;
  const kind = product.kind === "応募者全員有料サービス" ? "コロコロ応募者全員有料サービス" : product.kind;
  const prefix = [product.code, kind].filter(Boolean).join(" ");
  return `${prefix}「${product.name}」`;
}

function productNotes(product, postTitle) {
  const parts = [];
  if (product.release) parts.push(`${product.release.text}発売`);
  if (product.price) parts.push(`${product.price.toLocaleString("en-US")}円`);
  if (product.kind) parts.push(product.kind);
  const facts = parts.length ? `${parts.join(" / ")}. ` : "";
  return `${facts}Magazine scoop (CoroCoro News: ${postTitle}); not on the official lineup when first seen.`;
}

/**
 * State posts → announcement records, one per product. The first post naming a
 * product dates the record and gives its link and picture; later posts fill
 * in what the first one did not say (date, price, kind).
 */
export function coroCoroRecords(state, printPosts = []) {
  // printPosts: reveals from the printed magazine that the site has not written up
  // (data/announcements-corocoro-print.json) — same shape, same rules.
  const posts = [...(state.posts || []), ...printPosts].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  const canonical = fullerKeys(posts.flatMap((post) => post.items || []));
  const byKey = new Map();
  for (const post of posts) {
    for (const item of post.items || []) {
      const group = `${item.franchise}|${canonical.get(item.key)}`;
      const entry = byKey.get(group);
      if (!entry) {
        // The id comes from the name as first seen, so a fuller name in a
        // later post does not turn the product into a new record.
        byKey.set(group, { id: `corocoro-${hashId(`${item.franchise}|${item.key}`)}`, post, product: { ...item } });
        continue;
      }
      // Newer posts know more (the price is given when orders open).
      for (const field of PRODUCT_FIELDS) entry.product[field] = item[field] || entry.product[field];
      if (item.key.length > entry.product.key.length) Object.assign(entry.product, { name: item.name, key: item.key });
    }
  }
  return [...byKey.values()].filter(({ product }) => isRevealed(product)).map(({ id, post, product }) => announcementRecord({
    id,
    sourceId: COROCORO_SOURCE_ID,
    franchise: product.franchise,
    title: productTitle(product),
    status: "announced",
    announcedAt: String(post.date).slice(0, 10),
    sourceName: COROCORO_SOURCE_NAME,
    sourceUrl: post.link,
    thumbnailUrl: post.image_url || null,
    confidence: "magazine",
    notes: productNotes(product, post.title),
  }));
}

/**
 * Drops magazine records the rest of the data already covers: a product an
 * official source (lineup, news) also names, or a catalog product released
 * before the article (an old bey mentioned again). A catalog product that is
 * not out yet is linked instead. Records reviewed in the CMS are left alone.
 * `kitsByFranchise`: Map franchise → kits ({ kit_id, names, release_date }).
 */
export function dropMagazineDuplicates(records, kitsByFranchise = new Map()) {
  const official = records.filter((record) => record.source_id !== COROCORO_SOURCE_ID);
  const officialText = new Map();
  for (const record of official) {
    const list = officialText.get(record.franchise) || [];
    const raw = String(record.names?.ja || "").normalize("NFKC");
    list.push({ record, raw, text: normalizeProductKey(raw) });
    officialText.set(record.franchise, list);
  }
  const kitText = new Map([...kitsByFranchise].map(([franchise, kits]) => [
    franchise,
    kits.map((kit) => {
      const raw = String(kit.names?.ja || kit.name || "").normalize("NFKC");
      return { kit, raw, text: normalizeProductKey(raw) };
    }),
  ]));
  const dropped = [];
  const kept = [];
  for (const record of records) {
    if (record.source_id !== COROCORO_SOURCE_ID || record.reviewed_at) {
      kept.push(record);
      continue;
    }
    const keys = productKeys(record.names?.ja);
    const posted = String(record.announced_at || "");
    const loose = looseMatch(record);
    const twin = (officialText.get(record.franchise) || []).some(({ record: other, raw, text }) =>
      keys.some((key) => text.includes(key))
      || (loose && String(other.announced_at || "") >= loose.since && loose.matches(raw)));
    if (twin) {
      dropped.push({ id: record.id, reason: "official" });
      continue;
    }
    const kits = (kitText.get(record.franchise) || [])
      .filter(({ kit, raw, text }) => keys.some((key) => text.includes(key))
        || (loose && (!kit.release_date || String(kit.release_date) >= posted) && loose.matches(raw)))
      .map(({ kit }) => kit);
    const releasedBefore = (kit) => {
      const release = String(kit.release_date || "");
      if (!release) return false;
      return release.length >= 10 ? release < posted : release < posted.slice(0, 7);
    };
    if (kits.some(releasedBefore)) {
      dropped.push({ id: record.id, reason: "catalog" });
      continue;
    }
    kept.push(kits.length && !record.linked_kit_id ? { ...record, linked_kit_id: kits[0].kit_id } : record);
  }
  return { records: kept, dropped };
}

/**
 * A record naming a bey before its ratchet and bit are public ("UX-22
 * スターター「バニッシュルシファー WW」") or a coded product ("UX-22
 * カスタマイズセットD"): the lineup will write another name, so it also matches
 * on its product code or its blade name, but only official records and kits
 * from about the time of the scoop, as an old bey can share a blade name.
 * Null for a full bey name, which the name match already handles.
 */
function looseMatch(record) {
  const title = String(record.names?.ja || "").normalize("NFKC");
  const inner = /「([^」]+)」/.exec(title)?.[1] || "";
  if (!inner || canonicalBeyName(inner)) return null;
  // "-00" is every limited item (BX-00, CX-00 …), not one product.
  const codes = [...title.matchAll(PRODUCT_CODE)].map((match) => match[1]).filter((code) => !/-0+$/.test(code));
  const blade = /^[ァ-ヺー]{5,}/.exec(inner)?.[0] || null;
  if (!codes.length && !blade) return null;
  const since = new Date(`${String(record.announced_at || "").slice(0, 10) || "1970-01-01"}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 30);
  return {
    since: since.toISOString().slice(0, 10),
    matches: (raw) => codes.some((code) => new RegExp(`(?<![A-Z0-9])${code}(?![0-9])`).test(raw)) || Boolean(blade && raw.includes(blade)),
  };
}

// ---------------------------------------------------------------------------
// Network side. `fetchJson(url)` is the fetcher's polite JSON reader (one host
// gap, this bot's user agent); it throws with `.status` on HTTP errors.

export class CoroCoroStop extends Error {}

// 403/429/503 or a non-JSON answer (a bot-check page) ends this source's run.
function stopOn(error, url) {
  if ([403, 429, 503].includes(error.status) || error instanceof SyntaxError) {
    return new CoroCoroStop(`${url}: ${error.status ? `HTTP ${error.status}` : "not JSON (bot check?)"}; stopped for this run`);
  }
  return error;
}

export function postListUrl(search, after, page = 1) {
  const params = new URLSearchParams({
    search,
    after: `${after}T00:00:00`,
    orderby: "date",
    order: "desc",
    per_page: "100",
    page: String(page),
    _fields: "id,date,modified,link,title,featured_media",
  });
  return `${COROCORO_API}/posts?${params}`;
}

/**
 * Reads new or edited posts into `state` and returns { state, records, stopped }.
 * `robotsAllows(url)` says whether robots.txt lets this bot read a URL.
 */
export async function runCoroCoroSource({ state, today, fetchJson, robotsAllows = () => true, recentDays = COROCORO_RECENT_DAYS, log = () => {}, printPosts = [] }) {
  const after = new Date(`${today}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() - recentDays);
  const afterIso = after.toISOString().slice(0, 10);
  const known = new Map((state.posts || []).map((post) => [post.id, post]));
  const reread = state.extractor !== COROCORO_EXTRACTOR_VERSION;
  const call = async (url) => {
    if (!robotsAllows(url)) throw new CoroCoroStop(`${url}: disallowed by robots.txt`);
    try {
      return await fetchJson(url);
    } catch (error) {
      throw stopOn(error, url);
    }
  };
  let stopped = null;
  try {
    const listed = new Map();
    for (const search of COROCORO_SEARCHES) {
      for (let page = 1; page <= 3; page += 1) {
        const posts = await call(postListUrl(search, afterIso, page));
        if (!Array.isArray(posts)) throw new CoroCoroStop(`post list for ${search} is not a list`);
        for (const post of posts) listed.set(post.id, post);
        if (posts.length < 100) break;
      }
    }
    const fresh = [...listed.values()].filter((post) => reread || known.get(post.id)?.modified !== post.modified);
    log(`corocoro_news: ${listed.size} posts listed, ${fresh.length} ${reread ? "to read (new extractor)" : "new or edited"}`);
    for (const listedPost of fresh) {
      const post = await call(`${COROCORO_API}/posts/${listedPost.id}?_fields=id,date,modified,link,title,content,featured_media`);
      const title = stripTags(post.title?.rendered);
      const items = extractCoroCoroProducts({ title, content: post.content?.rendered, date: post.date });
      let imageUrl = known.get(post.id)?.image_url || null;
      // Only posts that name a product need their picture.
      if (items.length && post.featured_media && !imageUrl) {
        try {
          const media = await call(`${COROCORO_API}/media/${post.featured_media}?_fields=source_url`);
          imageUrl = media?.source_url || null;
        } catch (error) {
          if (error instanceof CoroCoroStop) throw error;
          log(`corocoro_news: no picture for post ${post.id} (${error.message})`);
        }
      }
      known.set(post.id, {
        id: post.id,
        date: post.date,
        modified: post.modified,
        link: post.link,
        title,
        image_url: imageUrl,
        items: items.map(({ name, key, franchise, code, kind, release, price, fresh }) => ({ name, key, franchise, code, kind, release, price, fresh })),
      });
    }
  } catch (error) {
    if (!(error instanceof CoroCoroStop)) throw error;
    stopped = error.message;
  }
  // Older posts are dropped from the state; their records stay in
  // data/announcements.json like every other stored announcement.
  const keep = new Date(`${today}T00:00:00Z`);
  keep.setUTCDate(keep.getUTCDate() - COROCORO_KEEP_DAYS);
  const keepIso = keep.toISOString().slice(0, 10);
  const posts = [...known.values()]
    .filter((post) => String(post.date).slice(0, 10) >= keepIso)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id);
  // A run stopped halfway keeps the old version, so the rest are read next time.
  const extractor = stopped && reread ? state.extractor ?? null : COROCORO_EXTRACTOR_VERSION;
  const next = { updated_at: new Date().toISOString(), extractor, posts };
  return { state: next, records: coroCoroRecords(next, printPosts), stopped };
}
