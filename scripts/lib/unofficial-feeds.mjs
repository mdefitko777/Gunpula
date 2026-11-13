// Unofficial announcement sources: a fan blog and hobby media that carry a
// reveal before, or instead of, the maker's own page. Read by
// scripts/fetch_bandai_announcements.mjs after the official sources; their
// records say `unofficial: true` and name the site, and an official record
// about the same product replaces them (dropUnofficialDuplicates). Their
// pictures stay links to the site's own copy: a third party's photo is not
// cached into this public repo (owner's decision, 2026-11-13).
//
// Checked 2026-11-13 with this bot's user agent, robots.txt first:
//   hamusuke.com       ok  only /wp/wp-admin/ disallowed. BEYBLADE X fan blog: a
//                          発売前情報 post per product the night the monthly
//                          embargo lifts, and a half-year schedule page it
//                          updates some hours earlier
//   hjweb.jp           ok  only /wp-admin/ disallowed. Hobby JAPAN Web: about ten
//                          posts a day (ten per feed page), show reports included
//   dengekionline.com  ok  empty Disallow. The ガンプラ tag page is server-rendered
//   figsoku.net        ok  "Disallow: /*?*" and Crawl-delay: 1, so no query
//                          strings; only the per-work tag feeds are read (the
//                          site-wide feed is about 45 posts a day, adult
//                          figures among them)
//   stds.jp            ok  "Allow: /" with Content-Signal search=yes, ai-train=no;
//                          a title, a link and one picture per post is an index
//                          entry. LEGO news in Japanese
// Left out: X, Instagram and the other social networks (no automated reading),
// 楽天ブックス (its terms forbid reading product pages by automated means),
// HOBBY Watch (asks not to link its pictures), 電撃ホビーウェブ (Disallow: /).
import {
  decodeHtml,
  franchiseForAnnouncement,
  shiftDay,
  stripTags,
} from "./bandai-announcements.mjs";
import { announcementRecord, normalizeProductKey, stableHash, statusFromTitle } from "./official-announcements.mjs";
import { japanDay, parseRssItems } from "./rss.mjs";
import { INTAKE_RECENT_DAYS, admitItems } from "./source-intake.mjs";

export const HAMUSUKE_SOURCE_ID = "hamusuke_beyblade";
export const HJWEB_SOURCE_ID = "hjweb_news";
export const DENGEKI_SOURCE_ID = "dengeki_gunpla";
export const FIGSOKU_SOURCE_ID = "figsoku_tags";
export const STDS_SOURCE_ID = "stds_lego";

/** An answer that is not the feed or list asked for: a bot check, a consent page, a new markup. */
export class UnexpectedPage extends Error {}

// `officialUrls`: the maker's own product pages the post links (makerPages),
// kept on the record so an official record of one of those pages can replace it.
function unofficialRecord({ officialUrls = [], ...fields }) {
  return {
    ...announcementRecord({ ...fields, confidence: "unofficial" }),
    unofficial: true,
    ...(officialUrls.length ? { official_urls: officialUrls } : {}),
  };
}

function feedItems(xml, url) {
  const items = parseRssItems(xml);
  if (!items) throw new UnexpectedPage(`${url} is not a feed`);
  return items;
}

// WordPress writes resized copies into srcset; the one nearest 800 px wide is
// plenty for a list thumbnail and stays under the fetcher's cache size limit.
function listSizeImage(tag, src) {
  const sized = [...(/\ssrcset="([^"]+)"/.exec(tag)?.[1] || "").matchAll(/(\S+)\s+(\d+)w/g)]
    .map((match) => ({ url: decodeHtml(match[1]), width: Number(match[2]) }))
    .filter((candidate) => candidate.width <= 800)
    .sort((a, b) => b.width - a.width)[0];
  return sized?.url || src;
}

/** The first picture under `prefix` (the site's own uploads) at least `minWidth` wide by its width attribute. */
function leadImage(html, prefix, { minWidth = 0 } = {}) {
  for (const [tag] of String(html || "").matchAll(/<img\b[^>]*>/g)) {
    const src = decodeHtml(/\ssrc="([^"]+)"/.exec(tag)?.[1] || "");
    if (!src.startsWith(prefix)) continue;
    if (Number(/\swidth="(\d+)"/.exec(tag)?.[1] || 0) < minWidth) continue;
    return listSizeImage(tag, src);
  }
  return null;
}

// Product pages of the makers' own stores, in the form the official sources
// store as source_url. 2026-11-13: fig速 links the product's page in most posts
// (Premium Bandai for ポケモンスケールワールド, コトブキヤ for V.I.シリーズ), and the
// Premium Bandai list cuts names short ("ポケモンスケールワールド ミア…"), so a
// name cannot match. Not read from Hobby JAPAN Web, where a link in the text
// may be any related product.
const MAKER_PAGE = /^https:\/\/(?:p-bandai\.jp\/item\/item-\d+|tamashiiweb\.com\/item\/\d+|shop\.kotobukiya\.co\.jp\/shop\/g\/g\d+)$/;

function pageKey(url) {
  return String(url || "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

/** The makers' product pages a post links, each once, without query string. */
export function makerPages(html) {
  const pages = [...String(html || "").matchAll(/\shref="([^"]+)"/g)]
    .map((match) => pageKey(decodeHtml(match[1])))
    .filter((url) => MAKER_PAGE.test(url));
  return [...new Set(pages)].map((url) => `${url}/`);
}

function wordpressPostId(item) {
  return /[?&]p=(\d+)/.exec(item.guid || "")?.[1] || null;
}

// ---------------------------------------------------------------------------
// ハムすけの備忘録 (hamusuke.com): BEYBLADE X. The 03:20 JST run sees the schedule
// page a day before the posts (2026-11-13: page updated 00:49 JST, the two
// posts 08:42 and 09:09), so both are read and a product is one record by its
// product code.

export const HAMUSUKE_FEED_URL = "https://hamusuke.com/feed/";
const HAMUSUKE_UPLOADS = "https://hamusuke.com/wp/wp-content/uploads/";
const HAMUSUKE_PREVIEW_TITLE = /^【ベイブレードX】\s*((?:BX|UX|CX)-\d{2,3})\s+(.+?)\s*発売前情報/;
const BEY_KIND = String.raw`ランダムブースター|スターター|ブースター|[ァ-ヺー]*セット|ツール`;
// A set or a random booster is the product itself, not a bey of that name.
const NAMED_BY_KIND = /セット|ランダムブースター/;

/** One feed item → what a 発売前情報 post says about its product, or null for any other post. */
export function parseHamusukePost(item) {
  const title = HAMUSUKE_PREVIEW_TITLE.exec(String(item.title || "").normalize("NFKC"));
  if (!title || !item.categories.includes("新商品情報")) return null;
  const [, code, name] = title;
  const text = stripTags(item.html).normalize("NFKC");
  const release = /発売日\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(text);
  const price = /価格\s*(\d[\d,]*)\s*円/.exec(text);
  return {
    code,
    name,
    // The title has no kind word; the shop link in the post does ("UX-22 スターター バニッシュルシファー WW").
    kind: new RegExp(`${code}\\s*(${BEY_KIND})`).exec(text)?.[1] || null,
    // A random booster is known by its rare bey: 今回のレア枠は”ホルスシャッター3-85MO”で….
    rare: /レア枠は\s*[”“"「『]([^”“"」』]{3,40})[”“"」』]/.exec(text)?.[1] || null,
    release: release ? `${release[1]}-${release[2].padStart(2, "0")}-${release[3].padStart(2, "0")}` : null,
    price: price ? Number(price[1].replace(/,/g, "")) : null,
    // The product render (1100 px in the sample), not the emoji, the 110 px shop icon or a link-card avatar.
    image: leadImage(item.html, HAMUSUKE_UPLOADS, { minWidth: 400 }),
    link: item.link,
    postId: wordpressPostId(item),
    date: item.date,
  };
}

/** The half-year schedule page the posts link ("…/beybladex-schedule-202607-12-sales"); the newest one. */
export function hamusukeScheduleUrl(items) {
  const slugs = items.flatMap((item) => [...String(item.html || "").matchAll(/hamusuke\.com\/(beybladex-schedule-\d{6}-\d{2}-sales)/g)].map((match) => match[1]));
  const newest = [...new Set(slugs)].sort().at(-1);
  return newest ? `https://hamusuke.com/${newest}/` : null;
}

/**
 * Schedule page → { rows, months }: the products still to come, from the
 * 「YYYY年M月発売予定 ラインナップ」 sections and their 「M/D(曜) CODE 種別 名称」
 * headings. `months` counts the sections, so a page without them is told from
 * a page with nothing left to release.
 */
export function parseHamusukeSchedule(html, { today }) {
  const rows = [];
  const sections = String(html || "").split(/<h2\b/).slice(1)
    // The heading is cut up by nested anchor spans ("2026年12" + "月発売予定…"), hence no spaces.
    .map((chunk) => ({ chunk, month: /^(\d{4})年(\d{1,2})月発売予定/.exec(stripTags(`<h2${chunk.split("</h2>")[0]}`).normalize("NFKC").replace(/\s+/g, "")) }))
    .filter((section) => section.month);
  for (const { chunk, month } of sections) {
    for (const block of chunk.split(/<h3\b/).slice(1)) {
      const heading = stripTags(`<h3${block.split("</h3>")[0]}`).normalize("NFKC");
      const row = new RegExp(`^(\\d{1,2})/(\\d{1,2})\\s*\\([^)]*\\)\\s*((?:BX|UX|CX)-\\d{2,3})\\s*(${BEY_KIND})?\\s*(.+)$`).exec(heading);
      if (!row) continue;
      const release = `${month[1]}-${row[1].padStart(2, "0")}-${row[2].padStart(2, "0")}`;
      if (release < today) continue;
      // The row's own table only: after the last row the page goes on with link cards and the sidebar.
      rows.push({ code: row[3], kind: row[4] || null, name: row[5].trim(), release, image: leadImage(block.split("</table>")[0], HAMUSUKE_UPLOADS) });
    }
  }
  return { rows, months: sections.length };
}

/** "UX-22 スターター「バニッシュルシファーWW」", "BX-55 ランダムブースターVol.12「ホルスシャッター3-85MO」", "「CX-20 カスタマイズセットC」" — the shape the CoroCoro records use. */
function beyTitle({ code, kind, name, rare }) {
  if (NAMED_BY_KIND.test(name)) return rare ? `${code} ${name}「${rare}」` : `「${code} ${name}」`;
  return `${[code, kind].filter(Boolean).join(" ")}「${name}」`;
}

function beyNotes({ release, price, kind }) {
  const parts = [];
  if (release) parts.push(`${Number(release.slice(0, 4))}年${Number(release.slice(5, 7))}月${Number(release.slice(8, 10))}日発売`);
  if (price) parts.push(`${price.toLocaleString("en-US")}円`);
  if (kind) parts.push(kind);
  const facts = parts.length ? `${parts.join(" / ")}. ` : "";
  return `${facts}Fan blog post (ハムすけの備忘録), written when the monthly embargo lifts; not on the official lineup when first seen.`;
}

/**
 * Posts and schedule rows → candidates, one per product. "-00" is every
 * limited item, so those are told apart by their post and a row without a post
 * is skipped. A row without a post has no date of its own: it is dated by the
 * day it is first seen, and on a first read (`firstRead`) it is held back, as
 * it may have stood on the page for weeks.
 */
export function hamusukeCandidates(posts, rows, { today, firstRead = false } = {}) {
  const limited = (code) => /-0+$/.test(code);
  const idOf = (product) => limited(product.code) ? `hamusuke-p${product.postId}` : `hamusuke-${product.code.toLowerCase()}`;
  const candidates = new Map();
  for (const post of posts) {
    if (!post.date || (limited(post.code) && !post.postId)) continue;
    candidates.set(idOf(post), { date: post.date, product: post, sourceUrl: post.link });
  }
  for (const row of rows) {
    if (limited(row.code)) continue;
    const known = candidates.get(idOf(row));
    // The page has the kind word and sometimes the picture a post lacks.
    if (known) known.product = { ...known.product, kind: known.product.kind || row.kind, image: known.product.image || row.image };
    else candidates.set(idOf(row), { date: today, product: { ...row, price: null, rare: null }, sourceUrl: null, hold: firstRead });
  }
  return [...candidates].map(([id, { date, product, sourceUrl, hold }]) => ({
    key: id,
    date,
    ...(hold ? { hold } : {}),
    record: unofficialRecord({
      id,
      sourceId: HAMUSUKE_SOURCE_ID,
      franchise: "beyblade",
      title: beyTitle(product),
      status: "announced",
      announcedAt: date,
      sourceName: "ハムすけの備忘録",
      sourceUrl,
      thumbnailUrl: product.image,
      notes: beyNotes(product),
    }),
  }));
}

async function readHamusuke({ today, state, read }) {
  const items = feedItems(await read(HAMUSUKE_FEED_URL), HAMUSUKE_FEED_URL);
  const posts = items.map(parseHamusukePost).filter(Boolean);
  // The page changes address every half year; the posts link the current one.
  const scheduleUrl = hamusukeScheduleUrl(items) || state.schedule_url || null;
  let rows = [];
  if (scheduleUrl) {
    const page = parseHamusukeSchedule(await read(scheduleUrl), { today });
    if (!page.months) throw new UnexpectedPage(`${scheduleUrl} has no monthly lineup`);
    rows = page.rows;
  }
  const candidates = hamusukeCandidates(posts, rows, { today, firstRead: !state.seen })
    .map((candidate) => candidate.record.source_url ? candidate : { ...candidate, record: { ...candidate.record, source_url: scheduleUrl } });
  return { candidates, extra: { schedule_url: scheduleUrl } };
}

// ---------------------------------------------------------------------------
// Hobby JAPAN Web (hjweb.jp): show-floor reports and reveal news. One record
// per post, the full title as its name.

export const HJWEB_FEED_URL = "https://hjweb.jp/feed/";
// Ten posts a page; a show day brings more than twenty.
const HJWEB_MAX_PAGES = 4;
const HJWEB_REVEAL = /商品化(?:が|も)?決定|発売決定|立体化|初展示|初公開|参考展示|参考出品|試作品|新製品|ラインナップ|登場|予約開始|予約受付/;
// Build logs, how-tos, magazine previews, reviews, contests, interviews, giveaways.
const HJWEB_NOISE = /作例|How to|試し読み|オラザク|筆塗り|連載|レビュー|コンテスト|インタビュー|プレゼント/i;
const MADOKA = /まどか☆?マギカ|マギアレコード|まどマギ/;

// franchiseForAnnouncement reads "新作プラモデル" as Gundam, which holds on
// Bandai's own feeds only: a hobby magazine says it of any kit.
function mediaFranchise(text) {
  return franchiseForAnnouncement(text.replace(/新作プラモデル/g, " ")) || (MADOKA.test(text) ? "madoka" : null);
}

/** Feed items → candidates: posts about one of the app's worlds (by title or category) with reveal wording. */
export function hjwebCandidates(items) {
  const candidates = [];
  for (const item of items) {
    const id = /\/article\/(\d+)/.exec(item.link || "")?.[1];
    // The categories carry the work when the title only says "METAL ROBOT魂「百式」".
    const labelled = `${item.title} ${item.categories.join(" ")}`;
    const franchise = mediaFranchise(labelled);
    if (!id || !item.date || !franchise || !HJWEB_REVEAL.test(item.title) || HJWEB_NOISE.test(labelled)) continue;
    candidates.push({
      key: id,
      date: item.date,
      record: unofficialRecord({
        id: `hjweb-${id}`,
        sourceId: HJWEB_SOURCE_ID,
        franchise,
        title: item.title,
        announcedAt: item.date,
        sourceName: "Hobby JAPAN Web",
        sourceUrl: item.link,
        thumbnailUrl: leadImage(item.html, "https://hjweb.jp/wp-content/uploads/"),
      }),
    });
  }
  return candidates;
}

// Pages are read back to the newest post of the last run (a day of overlap for
// posts published out of order), on a first read back to the intake window.
async function readHjweb({ today, state, read }) {
  const overlap = state.read_until ? new Date(Date.parse(state.read_until) - 86400000).toISOString() : null;
  const since = shiftDay(today, -INTAKE_RECENT_DAYS);
  const items = [];
  for (let page = 1; page <= HJWEB_MAX_PAGES; page += 1) {
    const url = page === 1 ? HJWEB_FEED_URL : `${HJWEB_FEED_URL}?paged=${page}`;
    const pageItems = feedItems(await read(url), url);
    items.push(...pageItems);
    const oldest = pageItems.map((item) => item.publishedAt).filter(Boolean).sort()[0];
    if (!oldest || (overlap && oldest <= overlap) || japanDay(oldest) < since) break;
  }
  const newest = items.map((item) => item.publishedAt).filter(Boolean).sort().at(-1);
  return { candidates: hjwebCandidates(items), extra: { read_until: newest || state.read_until || null } };
}

// ---------------------------------------------------------------------------
// 電撃オンライン, ガンプラ tag (dengekionline.com). Much of the tag restates
// official posts, which then replace these records; what stays is what the
// official feeds did not have (2026-10: 「ムラサメ改」, a 《新商品A（仮）》 teaser).

export const DENGEKI_TAG_URL = `https://dengekionline.com/tag/${encodeURIComponent("ガンプラ")}/page/1`;
const DENGEKI_REVEAL = /発売決定|商品化|立体化|ガンプラ化|公開|お披露目|登場|判明|予約開始|NEW ITEM INFO|ホビーショー/;
// Restocks, lotteries, auctions, the scan service, apps, store openings, shop maintenance, streams, retailer stock.
// And what else the tag page of 2026-11-13 held (47 cards back to 2025-01):
// nine box-art posts for kits a week from release ("2/21発売の…のパッケージ画像公開"),
// a music single and a card-game deck. 「パッケージ画像が初公開」 of a kit not
// shown before stays.
const DENGEKI_NOISE = /再版|再販|抽選|オークション|スキャン|アプリ|オープン|メンテナンス|配信|楽天|Amazon|パッケージ画像公開|シングル|カードゲーム|TCG/;
// A grade or scale inside 『…』 marks a kit name; 『ガンダムSEED FREEDOM』 is a work.
const KIT_NAME_TOKEN = /(?<![A-Za-z])(?:HG[A-Z]{0,2}|MG(?:SD|EX)?|RG|PG|ENTRY GRADE)(?![a-z])|1\/(?:144|100|60)(?!\d)/;

/** 『HG 1/144 ガンダムヴァサーゴ』 → 「HG 1/144 ガンダムヴァサーゴ」: the dedupe reads product names from 「…」. */
export function quoteProducts(title) {
  return String(title || "").replace(/『([^『』]*)』/g, (whole, inner) => KIT_NAME_TOKEN.test(inner.normalize("NFKC")) ? `「${inner}」` : whole);
}

/**
 * Tag page → { cards }: the article list under the 「ガンプラ」の記事一覧 heading.
 * The class names are build hashes, so nothing is matched on them; the ranking
 * sidebars use the same anchors and start after </main>.
 */
export function parseDengekiTagPage(html, pageUrl = DENGEKI_TAG_URL) {
  const text = String(html || "");
  const start = text.indexOf("の記事一覧");
  const list = start < 0 ? "" : text.slice(start).split("</main>")[0];
  const cards = [];
  for (const match of list.matchAll(/<a\b[^>]*href="(\/article\/\d{6}\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g)) {
    const [, href, id, inner] = match;
    const title = stripTags(/<p\b[^>]*>([\s\S]*?)<\/p>/.exec(inner)?.[1]);
    const date = /<time\b[^>]*>\s*(\d{4}-\d{2}-\d{2})/.exec(inner)?.[1];
    if (!title || !date) continue;
    cards.push({ id, url: new URL(href, pageUrl).href, title, date, image: decodeHtml(/<img\b[^>]*\ssrc="(https:[^"]+)"/.exec(inner)?.[1] || "") || null });
  }
  return { cards };
}

export function dengekiCandidates(cards) {
  return cards
    .filter((card) => DENGEKI_REVEAL.test(card.title) && !DENGEKI_NOISE.test(card.title))
    .map((card) => ({
      key: card.id,
      date: card.date,
      record: unofficialRecord({
        id: `dengeki-${card.id}`,
        sourceId: DENGEKI_SOURCE_ID,
        franchise: "gundam",
        title: quoteProducts(card.title),
        announcedAt: card.date,
        sourceName: "電撃オンライン",
        sourceUrl: card.url,
        thumbnailUrl: card.image,
      }),
    }));
}

async function readDengeki({ read }) {
  const { cards } = parseDengekiTagPage(await read(DENGEKI_TAG_URL));
  // The tag always has a page of articles; none is a markup change or a bot check.
  if (!cards.length) throw new UnexpectedPage(`${DENGEKI_TAG_URL} lists no articles`);
  return { candidates: dengekiCandidates(cards) };
}

// ---------------------------------------------------------------------------
// fig速 (figsoku.net): figure news, one tag feed per work. Titles follow one
// grammar, 【work】maker「product」type【state】, and the same product comes back
// with each new state, so a record is one product and its id comes from the
// product, not from the post.

// 2026-11-13: the まどかマギカ feed's newest reveal is of 2024; it is read for the day one comes.
export const FIGSOKU_TAGS = [
  { tag: "fate", franchise: "fate" },
  { tag: "アーマード・コア", franchise: "armored_core" },
  { tag: "ポケモン", franchise: "pokemon" },
  { tag: "まどかマギカ", franchise: "madoka" },
];
const FIGSOKU_TITLE = /^【([^】]+)】\s*(.*?)「([^」]+)」\s*(.*?)【([^】]+)】\s*$/;
const FIGSOKU_REVEAL = /商品化決定|フィギュア化決定|立体化決定|予約開始|彩色原型公開|原型公開|情報解禁|受注開始/;
// Release days, deadlines, shipping notes, store sales, and round-ups (which name a maker, not a product).
const FIGSOKU_NOISE = /本日発売|予約締切|出荷情報|販売開始|設置開始|情報まとめ/;
// A restock says so before the state ("…フィギュア 再販決定！【Amazon予約開始】") or only in its categories.
const FIGSOKU_RESTOCK = /再販/;
const ADULT = /アダルト|R-?18|成人向け/i;

export function figsokuFeedUrl(tag) {
  return `https://figsoku.net/tag/${encodeURIComponent(tag)}/feed`;
}

/** One tag feed's items → candidates for that work. */
export function figsokuCandidates(items, franchise) {
  const candidates = [];
  for (const item of items) {
    const title = FIGSOKU_TITLE.exec(item.title || "");
    const postId = wordpressPostId(item) || /blog-entry-(\d+)/.exec(item.link || "")?.[1];
    if (!title || !postId || !item.date) continue;
    const [, , maker, product, , state] = title;
    const labelled = `${item.title} ${item.categories.join(" ")}`;
    if (!FIGSOKU_REVEAL.test(state) || FIGSOKU_NOISE.test(state) || FIGSOKU_RESTOCK.test(labelled) || ADULT.test(labelled)) continue;
    // The picture in the text is a 200×150 crop; the same name without the size is the full one.
    const image = leadImage(item.html, "https://figsoku.net/wp-content/")?.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1") || null;
    candidates.push({
      key: postId,
      date: item.date,
      record: unofficialRecord({
        id: `figsoku-${stableHash(`${franchise}|${normalizeProductKey(maker)}|${normalizeProductKey(product)}`)}`,
        sourceId: FIGSOKU_SOURCE_ID,
        franchise,
        title: item.title,
        // 【近日予約開始】 and 【16日予約開始】 are not open yet; 【Amazon予約開始】 and 【プレバン受注開始】 are.
        status: /(?:予約|受注)開始/.test(state) && !/近日|\d+日/.test(state) ? "preorder_open" : "product_confirmed",
        announcedAt: item.date,
        sourceName: "fig速",
        sourceUrl: item.link,
        thumbnailUrl: image,
        officialUrls: makerPages(item.html),
      }),
    });
  }
  return candidates;
}

async function readFigsoku({ read, log }) {
  const candidates = [];
  for (const { tag, franchise } of FIGSOKU_TAGS) {
    const url = figsokuFeedUrl(tag);
    try {
      candidates.push(...figsokuCandidates(feedItems(await read(url), url), franchise));
    } catch (error) {
      // A tag the site has dropped or renamed must not cost the other works their feed.
      if (error.status !== 404) throw error;
      log(`${FIGSOKU_SOURCE_ID}: ${url} is gone (404)`);
    }
  }
  return { candidates };
}

// ---------------------------------------------------------------------------
// スタッズ (stds.jp): LEGO news in Japanese, the 新作 tag. Its rumour tag
// (lego-leaks-news) is not read: a guess at next year's sets is not a reveal.

export const STDS_FEED_URL = "https://stds.jp/tag/newsets/feed/";
// Sales, gift-with-purchase promos, fan reactions, the pinned year list, LEGO Ideas review rounds.
const STDS_NOISE = /セール・キャンペーン情報|購入特典|購入者プレゼント|SNSの反応|新商品一覧リスト|レビュー進出/;

export function stdsCandidates(items) {
  const candidates = [];
  for (const item of items) {
    const postId = wordpressPostId(item);
    if (!postId || !item.date || !item.title || STDS_NOISE.test(item.categories.join(" "))) continue;
    candidates.push({
      key: postId,
      date: item.date,
      record: unofficialRecord({
        id: `stds-${postId}`,
        sourceId: STDS_SOURCE_ID,
        franchise: "lego",
        title: item.title,
        announcedAt: item.date,
        sourceName: "スタッズ",
        sourceUrl: item.link,
        thumbnailUrl: leadImage(item.html, "https://stds.jp/wp-content/uploads/"),
      }),
    });
  }
  return candidates;
}

async function readStds({ read }) {
  return { candidates: stdsCandidates(feedItems(await read(STDS_FEED_URL), STDS_FEED_URL)) };
}

// ---------------------------------------------------------------------------

/** id, the site's own name, its host (for robots.txt) and the address shown as the source. */
export const UNOFFICIAL_SOURCES = [
  { id: HAMUSUKE_SOURCE_ID, name: "ハムすけの備忘録", host: "hamusuke.com", url: "https://hamusuke.com/", read: readHamusuke },
  { id: HJWEB_SOURCE_ID, name: "Hobby JAPAN Web", host: "hjweb.jp", url: "https://hjweb.jp/", read: readHjweb },
  { id: DENGEKI_SOURCE_ID, name: "電撃オンライン", host: "dengekionline.com", url: DENGEKI_TAG_URL, read: readDengeki },
  { id: FIGSOKU_SOURCE_ID, name: "fig速", host: "figsoku.net", url: "https://figsoku.net/", read: readFigsoku },
  { id: STDS_SOURCE_ID, name: "スタッズ", host: "stds.jp", url: STDS_FEED_URL, read: readStds },
];

export function unofficialSource(id) {
  return UNOFFICIAL_SOURCES.find((source) => source.id === id);
}

/**
 * Reads one source and returns { records, state }. `fetchText(url)` is the
 * fetcher's polite reader, `robotsAllows(url)` the host's robots.txt,
 * `imageAllowed(url)` (async) the same for a picture, which may sit on another
 * host; `stored` is last run's records by id, `state` this source's part of
 * data/announcements-unofficial.json.
 */
export async function runUnofficialSource(source, {
  state = {},
  today,
  stored = new Map(),
  fetchText,
  robotsAllows = () => true,
  imageAllowed = async () => true,
  log = () => {},
}) {
  const read = async (url) => {
    if (!robotsAllows(url)) throw new Error(`${url} is disallowed by robots.txt`);
    return fetchText(url);
  };
  const { candidates, extra = {} } = await source.read({ today, state, read, log });
  const { admitted, state: intake } = admitItems(candidates, state, {
    today,
    isStored: (candidate) => stored.has(candidate.record.id),
  });
  // Several posts can tell of one product (fig速's states): the newest post
  // gives the record, the first one its date. A stored record keeps its date.
  const byId = new Map();
  for (const { record, date } of [...admitted].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const first = byId.get(record.id);
    byId.set(record.id, { ...record, announced_at: stored.get(record.id)?.announced_at || first?.announced_at || date });
  }
  const records = [];
  for (const record of byId.values()) {
    const allowed = !record.thumbnail_url || await imageAllowed(record.thumbnail_url);
    records.push(allowed ? record : { ...record, thumbnail_url: null });
  }
  log(`${source.id}: ${candidates.length} posts fit, ${records.length} records`);
  return { records, state: { ...extra, ...intake } };
}

// ---------------------------------------------------------------------------
// Official wins. The bey blog is judged with the magazine scoops
// (dropMagazineDuplicates in corocoro-news.mjs, by name, product code or blade
// name); media and figure posts here, by the products their titles quote.

const MEDIA_SOURCE_IDS = new Set([HJWEB_SOURCE_ID, DENGEKI_SOURCE_ID, FIGSOKU_SOURCE_ID, STDS_SOURCE_ID]);
// A brand or grade right before the quote is part of the name: METAL BUILD「ガンダムデュナメス」.
const BRAND_BEFORE_QUOTE = /(METAL BUILD|METAL ROBOT魂|ROBOT魂|MGSD|HG[A-Z]{0,2}|MG|RG|PG)\s*$/i;
// Quoted, but where or when, not what: 「TAMASHII NATION 2026」にて….
const NOT_A_PRODUCT_QUOTE = /TAMASHII\s*NATIONS?|ホビーショー|ワンダーフェスティバル|ワンフェス|EXPO|フェス|イベント|キャンペーン/i;
// An official post this long before or after tells the same news; a preorder
// post months after a show report is news of its own, and both stay.
const OFFICIAL_DAYS_BEFORE = 14;
const OFFICIAL_DAYS_AFTER = 30;

// "HG 1/144 ガンダムヴァサーゴ" and "HG ガンダムヴァサーゴ" are one kit.
function matchKey(text) {
  return normalizeProductKey(String(text || "").normalize("NFKC").replace(/1\/\d{2,3}(?!\d)/g, " "));
}

/** The products a media title quotes: [{ key, brand }]; the brand carries over a list of quotes. */
export function quotedProducts(title) {
  const text = quoteProducts(title).normalize("NFKC");
  const products = [];
  let last = null;
  for (const match of text.matchAll(/「([^「」]+)」/g)) {
    const listed = last && /^[\s、・,&と]*$/.test(text.slice(last.end, match.index));
    const brand = listed ? last.brand : BRAND_BEFORE_QUOTE.exec(text.slice(0, match.index))?.[1] || null;
    last = { end: match.index + match[0].length, brand };
    if (!NOT_A_PRODUCT_QUOTE.test(match[1])) products.push({ key: matchKey(match[1]), brand });
  }
  return products;
}

/**
 * Drops a media or figure record when official records of about the same days
 * name every product its title quotes (with the brand, where the title puts
 * one before the quote). One product without an official record keeps it: the
 * HJ report 「METAL BUILD「ガンダムデュナメス」「ガンダムキュリオス」が初展示！「GNアームズ
 * TYPE-K オプションセット」の商品化も決定」 stays for the option set. A title that
 * quotes nothing is never dropped by its names, nor is a record reviewed in
 * the CMS.
 * The same goes for the makers' product pages the post links (`official_urls`):
 * when each of them is the page of an official record of those days, the post
 * tells nothing more. Only this matches a Premium Bandai record, whose name
 * the list cuts short.
 */
export function dropUnofficialDuplicates(records) {
  const official = new Map();
  const officialPages = new Map();
  for (const record of records) {
    if (record.unofficial || record.confidence === "magazine" || record.live_state) continue;
    const date = String(record.announced_at || "");
    const list = official.get(record.franchise) || [];
    list.push({ id: record.id, date, text: matchKey(record.names?.ja) });
    official.set(record.franchise, list);
    const page = pageKey(record.source_url);
    if (MAKER_PAGE.test(page)) officialPages.set(page, [...(officialPages.get(page) || []), { id: record.id, date }]);
  }
  const dropped = [];
  const kept = records.filter((record) => {
    if (!MEDIA_SOURCE_IDS.has(record.source_id) || record.reviewed_at) return true;
    const products = quotedProducts(record.names?.ja);
    const from = shiftDay(record.announced_at, -OFFICIAL_DAYS_BEFORE);
    const to = shiftDay(record.announced_at, OFFICIAL_DAYS_AFTER);
    const nearby = (official.get(record.franchise) || []).filter((other) => other.date >= from && other.date <= to);
    // A short name ("百式") only counts next to its brand.
    const teller = ({ key, brand }) => key.length >= (brand ? 2 : 6)
      ? nearby.find((other) => other.text.includes(key) && (!brand || other.text.includes(matchKey(brand))))
      : undefined;
    const pages = record.official_urls || [];
    const lister = (page) => (officialPages.get(pageKey(page)) || []).find(({ date }) => date >= from && date <= to);
    const byName = products.length > 0 && products.every(teller);
    const byPage = pages.length > 0 && pages.every(lister);
    if (!byName && !byPage) return true;
    // The record that stays for it (data/announcements.json "replaced"): the one of its first product or page.
    dropped.push({ id: record.id, reason: "official", kept: (byPage ? lister(pages[0]) : teller(products[0])).id });
    return false;
  });
  return { records: kept, dropped };
}

/**
 * For dedupeAnnouncements: pairs it must not treat as twins. An official and
 * an unofficial record were settled by the rules above (sharing one of several
 * quoted names is not enough). An unofficial post and a magazine scoop of one
 * product are twins, the hand-entered print reveals included: the owner wants
 * the product picture the blog has, not the magazine cover (2026-11-13), and
 * the blog stands first in the fetcher's order. Two unofficial sites are twins too.
 */
export function keepsApart() {
  return (a, b) => {
    if (Boolean(a.unofficial) === Boolean(b.unofficial)) return false;
    return (a.unofficial ? b : a).confidence !== "magazine";
  };
}
