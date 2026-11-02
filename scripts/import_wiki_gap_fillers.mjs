// Gap filler: Gundam products the official catalogs no longer list, read from a
// pinned revision of a Japanese Wikipedia list article (CC BY-SA 4.0).
//
// The official Tamashii Web item database has no 魂ウェブ商店 web exclusive
// before 2012-02 and almost none of the 2009-2011 event / magazine limiteds, so
// about 46 ROBOT魂 <SIDE MS> products (アドヴァンスドジンクス, レグナント, ガッデス,
// ヤークトアルケーガンダム, ROBOT魂 デスティニーガンダム …) exist nowhere in the
// official sources this catalog reads. The ja.wikipedia 「ROBOT魂」 article lists
// them with release month and sales channel.
//
// Rules for a gap-filler record:
//   * only rows that match no record already in the catalog (same normaliser and
//     matching passes as the coverage audit, plus a short curated override list);
//   * facts only (name, month, channel), data_status needs_review, confidence low,
//     source_refs cite the article revision (attribution, CC BY-SA 4.0);
//   * no price or JAN, because the article has none;
//   * the cover and gallery come from the product's Premium Bandai 魂ウェブ商店
//     page (2009-2012 web exclusives and lotteries were sold there), found in
//     the Wayback Machine and listed in PB_PAGES below. The pictures themselves
//     are still served by the official PB image host;
//   * cancelled rows are skipped;
//   * when an official record for the same product appears later, the gap-filler
//     record is dropped and aliased to it in data/kit-aliases.json.
//
// The revision is pinned so the row set, and so the kit_ids, only change when
// this file is edited after a review of the newer revision.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { KIT_ALIASES_PATH, emptyAliases, nfkc, productKey, resolveAlias, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { parseWikiTables } from "./lib/wiki-tables.mjs";

const CATALOG_PATH = "data/kits.json";
const SOURCE_ID = "ja_wikipedia";
const UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";

const ARTICLES = [
  {
    title: "ROBOT魂",
    revid: 111558337, // 2026-10-29
    // ROBOT魂 <SIDE MS> tables run from "=== SIDE MS ===" to the next "=== SIDE" section.
    start: /^=== SIDE MS ===/,
    end: /^=== SIDE (?!MS)/,
    idPrefix: "robot-spirits-jawiki",
    // Rows the automatic matching gets wrong, decided by hand (catalog id, or null
    // for "not in the catalog" when a look-alike would otherwise match).
    overrides: {
      "ギラ・ズール（アンジェロ・サウパー機）": "tamashii-1411", // Tamashii spells it ザウパー専用機
      "ジム・スナイパーII ver. A.N.I.M.E.": "tamashii-12721", // listed under its 2024 reissue month
      "ランチャーストライカー&ソードストライカーセット": "tamashii-11828", // only the 2nd order is on Tamashii Web
      "トールギスII": null, // the 2012 web ROBOT魂, not the 2023 METAL ROBOT魂 トールギスⅡ
      "MS-06 量産型ザクII ver. A.N.I.M.E. 〜リアルタイプカラー〜": "tamashii-12271", // Tamashii lists the lottery page
      "陸戦型ガンダム ver. A.N.I.M.E.": "tamashii-13692", // "RX-79(G)" prefix, reissue month
      "陸戦型ジム ver. A.N.I.M.E.": "tamashii-13792",
      "デスティニーガンダム": "tamashii-1419", // Tamashii spells it デスティ二ー (kanji 二)
    },
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function fetchRevision(article) {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "query", prop: "revisions", revids: String(article.revid), rvprop: "content|ids|timestamp", rvslots: "main", format: "json", formatversion: "2" });
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const revision = (await response.json())?.query?.pages?.[0]?.revisions?.[0];
      if (!revision?.slots?.main?.content) throw new Error("revision has no content");
      return { content: revision.slots.main.content, timestamp: revision.timestamp };
    } catch (error) {
      lastError = error;
      await sleep(2000 * attempt);
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Matching against the catalog
// ---------------------------------------------------------------------------

function normalizeName(value) {
  return nfkc(value)
    .replace(/<\s*SIDE MS\s*>/gi, " ")
    .replace(/ROBOT魂|\(Ka signature\)/gi, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/〜|~/g, "～")
    .replace(/ll(?=\s|$|[^a-z])/g, "II")
    .replace(/ディスティニー/g, "デスティニー")
    .replace(/クリアー/g, "クリア")
    .replace(/バージョン/g, "Ver.")
    .replace(/一般作業型/g, "一般作業用")
    .replace(/Ζ/g, "Z")
    .replace(/ヴィクトリーガンダム/g, "Vガンダム")
    .replace(/\s*Special ver\.?$/i, "");
}

const nameKey = (value) => productKey(normalizeName(value), { keepCodes: false });
const baseKey = (value) => nameKey(normalizeName(value).replace(/[（(][^）)]*[）)]/g, ""));
const hasParen = (value) => /[（(]/.test(normalizeName(value));

function monthIndex(value) {
  const match = /(\d{4})\D{1,3}(\d{1,2})/.exec(nfkc(value || ""));
  return match ? Number(match[1]) * 12 + Number(match[2]) : null;
}

function bigrams(value) {
  const grams = new Set();
  for (let i = 0; i < value.length - 1; i += 1) grams.add(value.slice(i, i + 2));
  return grams;
}

function similarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  let shared = 0;
  for (const gram of A) if (B.has(gram)) shared += 1;
  return (2 * shared) / (A.size + B.size || 1);
}

function findMatch(row, candidates) {
  const key = nameKey(row.name);
  const base = baseKey(row.name);
  const month = monthIndex(row.date);
  const near = (candidate) => month && candidate.month && Math.abs(candidate.month - month) <= 2;
  return (
    candidates.find((candidate) => candidate.key === key) ||
    // "ガデッサ（リヴァイヴ機）" is Tamashii's plain "ガデッサ" of the same month.
    candidates.find((candidate) => base.length >= 2 && candidate.base === base && near(candidate) && !(hasParen(row.name) && hasParen(candidate.name))) ||
    candidates.find((candidate) => near(candidate) && similarity(key, candidate.key) >= 0.8) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

function firstDate(text) {
  const value = nfkc(text);
  const full = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(value);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const month = /(\d{4})年\s*(\d{1,2})月/.exec(value);
  return month ? `${month[1]}-${month[2].padStart(2, "0")}` : null;
}

const LIMITED = /限定|抽選|会場|魂ウェブ商店|魂フィーチャーズ|魂ネイション|TAMASHII NATION|魂フェスティバル|キャラホビ|ホビージャパン|電撃ホビー/;

function channelSummary(row) {
  const text = nfkc(`${row.date}\n${row.note}`);
  const channels = [];
  if (/魂ウェブ商店/.test(text)) channels.push(/抽選/.test(text) ? "魂ウェブ商店 (lottery)" : "魂ウェブ商店 web exclusive");
  if (/TAMASHII NATION|魂ネイション/.test(text)) channels.push("TAMASHII NATION event");
  if (/魂フィーチャーズ/.test(text)) channels.push("魂フィーチャーズ event");
  if (/魂フェスティバル/.test(text)) channels.push("魂フェスティバル event");
  if (/キャラホビ/.test(text)) channels.push("キャラホビ event");
  if (/ホビージャパン|電撃ホビー|SIDE BOOK/.test(text)) channels.push("magazine mail order");
  return channels.length ? channels.join(", ") : "general retail";
}

function kitIdFor(article, row) {
  const digest = createHash("sha1").update(nfkc(row.name)).digest("hex").slice(0, 10);
  return `${article.idPrefix}-${digest}`;
}

function sublineFor(name) {
  if (/ver\.\s*A\.N\.I\.M\.E\./i.test(name)) return "ROBOT魂 ver. A.N.I.M.E.";
  if (/Ka signature/i.test(name)) return "ROBOT魂（Ka signature）";
  return "ROBOT魂";
}

// Premium Bandai item page of each gap-filler product (row name -> [PB item id,
// number of product pictures on the page]). Read from archive.org captures of
// p-bandai.jp/tamashiiwebshouten/…/item-<id>/ in 2026-11 and matched by hand
// (name, sales channel, shipping month). Rows missing here had no PB page: the
// event-only and magazine mail-order items (ダブルオーガンダム トランザムクリア
// バージョン, ガンダムアストレア, アドヴァンスドジンクス（デボラ機）) and the two
// 2012 セラヴィーガンダムGNHW/3G sets, whose page was never archived.
const PB_IMAGE_BASE = "https://bandai-a.akamaihd.net/bc/img/model/b";
const PB_PAGES = {
  "ジンクス": ["1000007245", 1],
  "デナン・ゲー(ブラック・バンガード仕様)": ["1000007593", 4],
  "ガンダムF91(残像Ver.)": ["1000005607", 4],
  "トールギスII": ["1000012033", 1],
  "ダブルオークアンタ(クアンタムバーストver.)": ["1000010000", 5],
  "ガンダムF91(ハリソン・マディン機)": ["1000006526", 1],
  "ジムスナイパーII(ホワイト・ディンゴ隊仕様機)": ["1000007601", 5],
  "ストライクフリーダムガンダム用 ウイングエフェクトパーツ&スタンドセット": ["1000005679", 1],
  "GNソードIII": ["1000003972", 1],
  "ヤークトアルケーガンダム": ["1000009622", 5],
  "ダブルオーライザー 〔粒子貯蔵タンク型〕": ["1000007768", 2],
  "∀ガンダムシリーズ用 武器セット": ["1000005121", 2],
  "スサノオ (トランザムVer.)": ["1000004692", 4],
  "ガッデス": ["1000003312", 1],
  "オーガンダム": ["1000003751", 4],
  "レグナント": ["1000002467", 9],
  "ウァッド": ["1000005117", 2],
  "ダブルオークアンタ(クアンタムバーストver.) ブラックライト台座セット": ["1000010034", 7],
  "アドヴァンスドジンクス": ["1000002929", 3],
  "ガガ トランザムセット": ["1000003749", 3],
  "ターンエーガンダム / ターンX用 月光蝶エフェクトパーツ&スタンドセット": ["1000004508", 2],
  "ブレイヴ一般用試験機": ["1000009489", 1],
  "プロトタイプガンダム": ["1000010850", 2],
  "ウイングガンダム(EW版)": ["1000010849", 2],
  "デナン・ゾン(ブラック・バンガード仕様)": ["1000007594", 4],
  "Vダッシュガンダム& Vガンダムヘキサ パーツセット": ["1000007598", 5],
  "ギラ・ズール(親衛隊機)": ["1000007596", 5],
  "ガガ": ["1000003750", 2],
  "ガンダムエクシア リペアII 換装パーツ": ["1000002717", 2],
  "ガンダムエクシア リペア": ["1000003453", 5],
  "G-3ガンダム(メタリックコート仕様)": ["1000012053", 1],
  "コレン専用カプル": ["1000006527", 1],
  "ジンクスIV(指揮官機)": ["1000011842", 5],
  "ターンX 月光蝶Ver.": ["1000003681", 1],
  "ダブルオーガンダム トランザムライザー": ["1000003958", 7],
  "ガデッサ / ガラッゾ / ガッデス用 ブースター": ["1000003350", 1],
  "ターンエーガンダムvs.ターンX 月光蝶対決セット": ["1000004507", 2],
  "ガンダムアストレア(タイプF)": ["1000008187", 6],
  "ガンダムエクシア トランザムクリアVer.": ["1000007244", 1],
  "ターンエーガンダム(月光蝶Ver.)": ["1000004506", 1],
};

function pbPage(name) {
  // Spaces differ between the article and the localized catalog name ("ガデッサ / ガラッゾ").
  const bare = (value) => normalizeName(value).replace(/\s+/g, "");
  const key = Object.keys(PB_PAGES).find((candidate) => bare(candidate) === bare(name));
  if (!key) return null;
  const [itemId, pictures] = PB_PAGES[key];
  return {
    url: `https://p-bandai.jp/item/item-${itemId}/`,
    images: Array.from({ length: pictures }, (_, index) => `${PB_IMAGE_BASE}/${itemId}_${index + 1}.jpg`),
  };
}

const PB_WEB_SHOP_FROM = 2013;

function toKit(article, row, permalink) {
  const name = nfkc(row.name).replace(/\s+/g, " ").trim();
  const channels = channelSummary(row);
  const webShop = /魂ウェブ商店/.test(row.note + row.date);
  const pb = pbPage(name);
  return {
    kit_id: kitIdFor(article, row),
    franchise: "gundam",
    grade_code: "ROBOT_SPIRITS",
    subline: sublineFor(name),
    number: /^\d+$/.test(row.no) ? row.no : null,
    scale: "non-scale",
    names: { ja: name, en: null, zh: null, ko: null },
    images: { box_art_url: pb?.images[0] || null, box_art_source_id: pb ? "p_bandai_wayback" : null },
    gallery_image_urls: pb?.images || [],
    universe: null,
    work_title: row.heading || null,
    release_date: firstDate(row.date),
    price_jpy: null,
    is_limited: LIMITED.test(`${row.date} ${row.note}`),
    // 魂ウェブ商店 sold through Premium Bandai only from 2013; the 2009-2012
    // web exclusives are limited, but not Premium Bandai items.
    ...(webShop && Number(String(firstDate(row.date) || "").slice(0, 4)) >= PB_WEB_SHOP_FROM ? { is_premium_bandai: true } : {}),
    data_status: "needs_review",
    source_urls: [permalink, ...(pb ? [pb.url] : [])],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: permalink,
        fields: ["names", "release_date", "is_limited", "work_title"],
        confidence: "low",
      },
      ...(pb ? [{ source_id: "p_bandai_wayback", url: pb.url, fields: ["images"], confidence: "medium" }] : []),
    ],
    tags: ["gundam", "tamashii nations", "collectible figure", "robot-spirits", "gap-fill", "wikipedia", ...(webShop ? ["tamashii-web-shop"] : [])],
    notes:
      `Not in the official Tamashii Web item database. Facts (name, ROBOT魂 No. ${row.no || "-"}, month, sales channel: ${channels}) ` +
      `from the Japanese Wikipedia article 「${article.title}」, revision ${article.revid}, licensed CC BY-SA 4.0. ` +
      (pb ? `Pictures from the archived Premium Bandai 魂ウェブ商店 page ${pb.url}; price unknown.` : "Price and images unknown."),
  };
}

// On a refresh only the fields this source owns change; the English, Chinese
// and Korean names and the universe localize_catalog.mjs filled in stay, so the
// catalog is not rewritten every day for nothing.
function mergeOwnedFields(previous, kit) {
  if (!previous) return kit;
  return {
    ...previous,
    ...kit,
    names: { ...(previous.names || {}), ja: kit.names.ja },
    universe: previous.universe ?? kit.universe,
    work_title: previous.work_title ?? kit.work_title ?? null,
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const aliasDoc = { ...emptyAliases(), ...(await readJson(KIT_ALIASES_PATH, emptyAliases())) };
const retired = retiredKitIds(aliasDoc);
const kitsById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
let added = 0;
let updated = 0;
let superseded = 0;
let skipped = 0;
let failedArticles = 0;

for (const article of ARTICLES) {
  let revision;
  try {
    revision = await fetchRevision(article);
  } catch (error) {
    failedArticles += 1;
    console.warn(`ja.wikipedia ${article.title} (oldid ${article.revid}) not read: ${error.message}`);
    continue;
  }
  const permalink = `https://ja.wikipedia.org/w/index.php?title=${encodeURIComponent(article.title)}&oldid=${article.revid}`;
  const rows = parseWikiTables(revision.content, article.start, article.end)
    .map(({ heading, cells: [no = "", name = "", date = "", note = ""] }) => ({ heading, no: no.trim(), name: name.replace(/\n/g, " ").trim(), date, note }))
    .filter((row) => row.name);
  const ownPrefix = `${article.idPrefix}-`;
  const candidates = catalog.kits
    .filter((kit) => kit.franchise === "gundam" && !kit.kit_id.startsWith(ownPrefix) && kitsById.has(kit.kit_id))
    .filter((kit) => {
      const name = nfkc(kit.names?.ja || "");
      return kit.grade_code === "ROBOT_SPIRITS" || (/ROBOT魂/.test(name) && !/METAL ROBOT魂/.test(name));
    })
    .map((kit) => ({ id: kit.kit_id, name: kit.names?.ja || "", key: nameKey(kit.names?.ja || ""), base: baseKey(kit.names?.ja || ""), month: monthIndex(kit.release_date) }));

  for (const row of rows) {
    const id = kitIdFor(article, row);
    if (/発売中止|販売中止|中止となった|未発売/.test(`${row.date} ${row.note}`)) {
      skipped += 1;
      continue;
    }
    const overrideKey = Object.keys(article.overrides).find((name) => normalizeName(name) === normalizeName(row.name));
    const override = overrideKey === undefined ? undefined : article.overrides[overrideKey];
    // An override id counts as a match even when cleanup later aliased it away.
    const match = override === undefined ? findMatch(row, candidates)?.id : override ? resolveAlias(aliasDoc.aliases, override) : null;
    if (match) {
      if (kitsById.has(id)) {
        // An official record for this product exists now; the gap filler steps aside.
        kitsById.delete(id);
        aliasDoc.aliases[id] = match;
        superseded += 1;
      }
      continue;
    }
    if (retired.has(id)) {
      skipped += 1;
      continue;
    }
    const kit = toKit(article, row, permalink);
    if (kitsById.has(id)) updated += 1;
    else added += 1;
    kitsById.set(id, mergeOwnedFields(kitsById.get(id), kit));
  }
  console.log(`ja.wikipedia ${article.title} oldid ${article.revid}: ${rows.length} rows.`);
}

if (failedArticles === ARTICLES.length) {
  console.error("No gap-filler article could be read; catalog untouched.");
  process.exit(1);
}

const kits = [...kitsById.values()];
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits }, null, 2)}\n`, "utf8");
if (superseded) {
  await writeFile(KIT_ALIASES_PATH, `${JSON.stringify({ ...aliasDoc, updated_at: today() }, null, 2)}\n`, "utf8");
}
console.log(`Wikipedia gap fillers: ${added} added, ${updated} refreshed, ${superseded} superseded by official records, ${skipped} skipped; catalog now ${kits.length} records.`);
