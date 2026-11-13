// 魔法少女まどか☆マギカ figures (TV, the movies incl. 叛逆の物語 and
// ワルプルギスの廻天, マギアレコード, side works) from the official stores and
// maker catalogs. Figures only: scale / POP UP PARADE, ねんどろいど, figma and
// other action figures, prizes and 一番くじ, small / trading figures and plush.
// Flat goods (acrylic stands, badges, apparel, tapestries, discs, books …) are
// left out on purpose.
//
//   * Aniplex+            — online.aniplex.co.jp search grid (q=まどか, マギアレコード)
//   * Good Smile (legacy) — www.goodsmile.info search; frozen since ~2024-06 but
//                           holds every older GSC / Max Factory / FREEing item
//   * Good Smile (global) — www.goodsmile.com; in maintenance (503) since
//                           2026-10-23, so it is tried and reported, nothing more
//   * 魂ウェブ            — tamashiiweb.com search_item.php, character madoka-magica
//   * 一番くじ            — 1kuji.com title filter 85 (魔法少女まどか☆マギカ)
//   * バンプレスト景品     — bsp-prize.jp title IP00004703 (search listing; its
//                           thumbnails, lib/bsp-prize.mjs)
//   * 寿屋                — shop.kotobukiya.co.jp keyword search (Shift-JIS)
//   * ALTER              — alter-web.jp keyword search + product pages
//   * FuRyu (hobby)       — furyu-hm.com (FURYU HOBBY MALL) products.json, Madoka tag
//   * MEDICOS             — medicos-e.net WordPress "gallery" REST search
//   * タイトープライズ     — taito.co.jp prize JSON (Crawl-delay 20 is honoured)
//   * セガプライズ         — segaplaza.jp prize table (read from its script chunk as data)
//   * フリュープライズ     — furyuprize.com /api/search
//
// Checked and left out (2026-11): myethos.com is a parked domain, myethos.cn
// does not connect and myethos.jp renders its catalog in the browser only;
// www.kotobukiya.co.jp answers 403; bellfine.co.jp answers its REST search
// with 403; union-creative.jp, medicomtoy.co.jp and quesq.net list no Madoka
// products. ホビーサーチ (1999.co.jp) answers GitHub's runners with a Cloudflare
// challenge since 2026-11 (a home line gets the page): an IP block, so it is
// not read at all; it never returned a Madoka record.
//
// Crawling rules (non-negotiable): every request identifies as
// HobbyAtlasDataBot, each host's robots.txt is fetched first and obeyed, and
// each host gets at most one request per second (requests to one host are
// strictly sequential). A 403 / 429 / 503 or a bot-check page marks the source
// "refused" and the importer moves on — nothing tries to get around it.
//
// Each source is fetched independently. A source that fails keeps its previous
// records (the catalog merge only adds and replaces ids), and data/kits.json is
// written once, at the end.
import { readFile, writeFile } from "node:fs/promises";
import {
  decodeKotobukiyaShopHtml,
  parseKotobukiyaShopDetail,
  parseKotobukiyaShopListings,
} from "./lib/kotobukiya-shop.mjs";
import { KIT_ALIASES_PATH, resolveAlias, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { scaleFor } from "./lib/fate-grades.mjs";
import { aliasPublishedFolds } from "./lib/fold-aliases.mjs";
import { banprestoCover } from "./lib/bsp-prize.mjs";
import { absoluteHtmlUrl } from "./lib/html-url.mjs";

const CATALOG_PATH = "data/kits.json";
const FIRST_SEEN_PATH = "data/kit-first-seen.json";
const REPORT_PATH = process.env.MADOKA_REPORT_PATH || "";
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const BOT_TOKEN = "hobbyatlasdatabot";
// Gap between two requests to the same host, measured from the end of one
// response to the start of the next. Never below one second.
const HOST_INTERVAL_MS = Math.max(1000, Number(process.env.MADOKA_HOST_INTERVAL_MS || 1100));
const REQUEST_TIMEOUT_MS = 30000;

const FRANCHISE = "madoka";
const UNIVERSE = "Madoka";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&yen;/g, "¥")
    .replace(/&times;/g, "×")
    .replace(/&reg;/g, "®")
    .replace(/&eacute;/g, "é")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

// Attribute values are HTML-escaped ("saihan_musashi&amp;miniCu/M1.jpg"); decoded first.
function absolute(href, base) {
  return absoluteHtmlUrl(href, base);
}

// "2026年08月29日(土)より順次発売予定" / "2026年7月" / "2022/06".
function releaseDateFrom(text) {
  const value = String(text || "");
  const full = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(value);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const month = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(value);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}`;
  const iso = /(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?/.exec(value);
  if (iso) return [iso[1], iso[2].padStart(2, "0"), iso[3]?.padStart(2, "0")].filter(Boolean).join("-");
  return null;
}

function parseYen(text) {
  const match = /([\d,]+)/.exec(String(text || "").replace(/[^\d,]/g, " "));
  if (!match) return null;
  const price = Number(match[1].replace(/,/g, ""));
  return Number.isInteger(price) && price > 0 ? price : null;
}

function slugify(value, fallback) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

// NFKC, but circled numbers stay out of it (see lib/fate-grades.mjs).
const nf = (value) => String(value || "").replace(/[①-⓿❶-➓]/g, " ").normalize("NFKC");

// ------------------------------------------------------------ polite fetching

class RefusedError extends Error {
  constructor(message, status = null) {
    super(message);
    this.refused = true;
    this.status = status;
  }
}

class RobotsDisallowedError extends Error {
  constructor(url) {
    super(`robots.txt disallows ${url}`);
    this.robotsDisallowed = true;
  }
}

// Per host: a promise chain that serialises requests, the time the next one
// may start, the parsed robots.txt, and a sticky refusal once the host has
// answered with a bot check.
const hosts = new Map();

function hostState(host) {
  if (!hosts.has(host)) {
    hosts.set(host, { chain: Promise.resolve(), nextAt: 0, robots: null, robotsStatus: null, refused: null, requests: 0 });
  }
  return hosts.get(host);
}

// Bot-check interstitials. Deliberately not "captcha" (ordinary pages embed
// reCAPTCHA for contact forms) nor "challenge-platform" (Cloudflare's passive
// /cdn-cgi/challenge-platform/scripts/jsd beacon sits on every bsp-prize.jp page).
const CHALLENGE_PATTERN = /_cf_chl_opt|cf-challenge-running|<title>Just a moment\.\.\.<\/title>|Attention Required! \| Cloudflare/i;

async function rawRequest(url, { encoding } = {}) {
  const state = hostState(new URL(url).host);
  const run = async () => {
    const wait = state.nextAt - Date.now();
    if (wait > 0) await sleep(wait);
    state.requests += 1;
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { "User-Agent": BOT_UA, "Accept-Language": "ja,en;q=0.8" },
      });
      const buffer = new Uint8Array(await response.arrayBuffer());
      const text = encoding === "shift_jis" ? decodeKotobukiyaShopHtml(buffer) : new TextDecoder("utf-8").decode(buffer);
      return { status: response.status, ok: response.ok, url: response.url, text, type: response.headers.get("content-type") || "" };
    } finally {
      state.nextAt = Date.now() + Math.max(HOST_INTERVAL_MS, (state.robots?.crawlDelay || 0) * 1000);
    }
  };
  const result = state.chain.then(run, run);
  state.chain = result.catch(() => {});
  return result;
}

// RFC 9309: groups of user-agent lines followed by allow / disallow rules.
// A group naming this bot wins over "*"; the longest matching rule wins and an
// allow wins a tie.
function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value) current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay > 0) current.crawlDelay = delay;
    }
  }
  const own = groups.filter((group) => group.agents.includes(BOT_TOKEN));
  const chosen = own.length ? own : groups.filter((group) => group.agents.includes("*"));
  return {
    rules: chosen.flatMap((group) => group.rules),
    crawlDelay: Math.max(0, ...chosen.map((group) => group.crawlDelay || 0)),
    group: own.length ? BOT_TOKEN : chosen.length ? "*" : "none",
  };
}

function robotsRuleRegex(path) {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function robotsAllows(robots, url) {
  if (robots.disallowAll) return false;
  const { pathname, search } = new URL(url);
  // Rules are matched against the raw path, and percent-encoded or not.
  const targets = [`${pathname}${search}`];
  try {
    targets.push(decodeURIComponent(`${pathname}${search}`));
  } catch {
    // Malformed escapes: match the raw form only.
  }
  let best = null;
  for (const rule of robots.rules) {
    const regex = robotsRuleRegex(rule.path);
    if (!targets.some((target) => regex.test(target))) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

async function ensureRobots(host) {
  const state = hostState(host);
  if (!state.robotsPromise) {
    state.robotsPromise = (async () => {
      try {
        const response = await rawRequest(`https://${host}/robots.txt`);
        if (response.ok && !CHALLENGE_PATTERN.test(response.text)) {
          state.robots = parseRobots(response.text);
          state.robotsStatus = `200 (rules for ${state.robots.group}: ${state.robots.rules.filter((rule) => !rule.allow).length} disallow, crawl-delay ${state.robots.crawlDelay || "none"})`;
        } else if (response.status === 401 || response.status === 403 || response.status === 429 || CHALLENGE_PATTERN.test(response.text)) {
          state.robots = { rules: [], disallowAll: true, crawlDelay: 0 };
          state.robotsStatus = `${response.status} (bot refused)`;
          state.refused = `robots.txt answered HTTP ${response.status}${CHALLENGE_PATTERN.test(response.text) ? " with a bot check" : ""}`;
        } else if (response.status >= 400 && response.status < 500) {
          // RFC 9309 §2.3.1.3: an unavailable robots.txt allows everything.
          state.robots = { rules: [], crawlDelay: 0 };
          state.robotsStatus = `${response.status} (no robots.txt: all allowed)`;
        } else {
          // §2.3.1.4: unreachable (5xx) means assume complete disallow.
          state.robots = { rules: [], disallowAll: true, crawlDelay: 0 };
          state.robotsStatus = `${response.status} (unreachable: treated as disallow all)`;
          state.refused = `host unavailable (robots.txt HTTP ${response.status})`;
        }
      } catch (error) {
        state.robots = { rules: [], disallowAll: true, crawlDelay: 0 };
        state.robotsStatus = `error (${error.message}): treated as disallow all`;
        state.refused = `robots.txt unreachable: ${error.message}`;
      }
    })();
  }
  await state.robotsPromise;
  return state;
}

async function politeFetch(url, options = {}) {
  const host = new URL(url).host;
  const state = await ensureRobots(host);
  if (state.refused) throw new RefusedError(`${host}: ${state.refused}`);
  if (!robotsAllows(state.robots, url)) throw new RobotsDisallowedError(url);
  const response = await rawRequest(url, options);
  if (response.status === 403 || response.status === 429 || response.status === 503 || CHALLENGE_PATTERN.test(response.text)) {
    const reason = `HTTP ${response.status}${CHALLENGE_PATTERN.test(response.text) ? " bot-check page" : ""}`;
    state.refused = reason;
    throw new RefusedError(`${host}: ${reason}`, response.status);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

async function fetchText(url, options) {
  return (await politeFetch(url, options)).text;
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

// ------------------------------------------------- works, characters, grades

// A product belongs to the catalog when its work line names a Madoka work.
// (GSC files the PSP game as "魔法少女まどかマギカ ポータブル", without the ☆.)
const MADOKA_WORK = /まどか\s*☆?\s*マギカ|まどマギ|マギアレコード|マギレコ|Magia\s*Record|Magia\s*Exedra|おりこ☆マギカ|かずみ☆マギカ|たると☆マギカ|Madoka\s*Magica/i;
// Character names (full names only: a bare まどか also finds 結城まどか of
// 創彩少女庭園 and 京乃まどか of 輪廻のラグランジェ). Only used when the
// source gives no work line at all.
const MADOKA_CHARACTER =
  /鹿目まどか|暁美ほむら|悪魔ほむら|アルティメットまどか|円環の理|巴マミ|美樹さやか|佐倉杏子|百江なぎさ|キュゥべえ|環いろは|七海やちよ|由比鶴乃|深月フェリシア|二葉さな|アリナ・グレイ|里見灯花|柊ねむ|環うい|梓みふゆ|黒江|お菓子の魔女|シャルロッテ|ワルプルギスの夜|美国織莉子|呉キリカ|和紗ミチル/;

function isMadoka(...texts) {
  return MADOKA_WORK.test(nf(texts.filter(Boolean).join(" ")));
}

// Canonical work titles, so one work groups together however a store spaces
// its brackets. The detail page's 作品名 is checked first, then the name.
const WORK_TITLES = [
  [/ワルプルギスの廻天/, "劇場版 魔法少女まどか☆マギカ〈ワルプルギスの廻天〉"],
  [/叛逆の物語|新編/, "劇場版 魔法少女まどか☆マギカ［新編］叛逆の物語"],
  [/始まりの物語|永遠の物語|\[前編\]|\[後編\]/, "劇場版 魔法少女まどか☆マギカ［前編］始まりの物語／［後編］永遠の物語"],
  [/マギアレコード|マギレコ|Magia\s*Record/i, "マギアレコード 魔法少女まどか☆マギカ外伝"],
  [/Magia\s*Exedra|マギアエクセドラ/i, "魔法少女まどか☆マギカ Magia Exedra"],
  [/おりこ☆マギカ/, "魔法少女おりこ☆マギカ"],
  [/かずみ☆マギカ/, "魔法少女かずみ☆マギカ"],
  [/たると☆マギカ/, "魔法少女たると☆マギカ"],
];

function canonicalWork(text) {
  for (const [pattern, title] of WORK_TITLES) if (pattern.test(text)) return title;
  return null;
}

function workTitleFor(product) {
  // A Madoka 作品名 is the source's own statement of the work and wins over
  // whatever the product name mentions.
  const work = nf(product.work);
  if (work && MADOKA_WORK.test(work)) return canonicalWork(work) || "魔法少女まどか☆マギカ";
  return canonicalWork(nf(product.name)) || canonicalWork(nf(product.series)) || "魔法少女まどか☆マギカ";
}

// Flat goods. Checked against the name (and the store category), never the
// spec text, which mentions bases and boxes.
const GOODS_PATTERN = new RegExp(
  [
    "アクリル", "缶バッジ", "バッジ", "ピンズ", "キーホルダー", "キーチェーン", "ストラップ", "チャーム", "タペストリー",
    "ポスター", "クリアファイル", "ファイル", "Tシャツ", "パーカー", "ジャケット", "ジャージ", "スカジャン", "タオル",
    "ブランケット", "マグカップ", "タンブラー", "グラス", "ステッカー", "シール", "ポストカード", "カード", "ノート",
    "ボールペン", "しおり", "クッション", "ポーチ", "バッグ", "巾着", "ケース", "ラバー", "ネイル", "ポニーフック",
    "リング", "ブローチ", "ネックレス", "アクセサリー", "イヤホン", "デカール", "腕時計", "ウォッチ", "懐中時計",
    "Zippo", "キーボード", "ヘッドセット", "ウォークマン", "Blu-ray", "DVD", "CD", "アナログレコード", "サウンドトラック",
    "Music Collection", "パンフレット", "ブック", "BOOK", "画集", "ムック", "フィギュアJAPAN", "チケット", "マグネット",
    "メモ(?!リアル)", "カレンダー", "購入セット", "スリッポン", "キャラファイン", "ミストグラフ", "レイヤードグラフ", "キャンバス", "チェスセット",
    "PROPLICA", "プロップリカ", "ソウルジェム", "グリーフシード", "ボイスマスコット", "ボイス付き", "スリーブ",
    "ブースター", "TCG", "等身大", "洗濯ネット", "ロールペーパー", "レターセット", "バスタオル",
    "サイクルシリーズ", "サイクルジャージ", "グッズセット", "ねんどろいどもあ", "グラフィグ", "ペーパークラフト",
    "パズル", "スタンド(?!.*フィギュア)", "バルーン", "ボトル", "食器", "皿", "ランチ", "傘", "扇子", "靴下", "マスク",
    "コースター", "ミラー", "ハンカチ", "手ぬぐい", "風呂敷", "プレート", "フレーム", "色紙", "複製原画", "アートボード",
  ].join("|"),
  "i",
);
const GOODS_CATEGORY = /グッズ|雑貨|アパレル|ステーショナリー|デカール|書籍|アクセサリー|ファッション/;

const PLUSH_PATTERN = /ぬいぐるみ|ちびぐるみ|Fluffy\s*Puffy|プラッシュ|Plush|もちころりん|ぬいもーじゅ|めちゃもふ|めちゃでか|てちぬい/i;
// Plush that is really a bag charm or a cushion: not a figure, but close
// enough to list as uncertain rather than drop silently.
const PLUSH_ACCESSORY = /チャーム|キーホルダー|ストラップ|ポーチ|バッグ|クッション|ケース|ポシェット|リュック|ペンケース/;
const NENDOROID_PATTERN = /ねんどろいど|ネンドロイド|Nendoroid/i;
const MINI_PATTERN =
  /Figuarts\s*mini|フィギュアーツ\s*mini|ぺたん娘|ぷちきゃら|トレーディングフィギュア|ちょこのせ|HELLO!\s*GOOD\s*SMILE|Q\s*posket|デフォルメ|きゅんキャラ|ソフビ|ソフトビニール|SOFT\s*VINYL|BE@RBRICK|るかっぷ|ワールドコレクタブル|ミニフィギュア|コレクションフィギュア|ガシャポン|カプセル|ガチャ|ぷちぴっと|minissimo|ころんぷてぃ|ちびっこ|ぴのこ|ぷちらま|ちょびるめ|ミニッチュ|るかっぷ|ねむらせ隊|トルソー|キューティーフィギュア|ぺたっとおすわり|Half\s*Age|Twinkle\s*Dolly|PalVerse|食玩|マスコット(?!.*ラバー)/i;
const ACTION_PATTERN = /figma|S\.H\.?\s*Figuarts|フィギュアーツ|Figuarts|BUZZmod|アクションフィギュア|可動フィギュア|キューポッシュ|ACT MODE|Pop Mart|超像可動|30MP|30\s*MINUTES/i;
const PRIZE_PATTERN = /一番くじ|プライズ|景品|EVOLVE|Serenus\s*couture|ESPRESTO|GLITTER\s*&\s*GLAMOURS|Luminasta|TENITOL|SPM|ちょこのせプレミアム/i;
const SCALE_FIGURE_PATTERN =
  /(?<![\d/])1\s?\/\s?(3|4|5|6|7|8|10|12)(?![\d(（])|スケール|フィギュア|POP UP PARADE|完成品|日本人形|figFIX|スタチュー|Statue|ARTFX|美少女/i;

const PRIZE_SOURCES = new Set([
  "banpresto_prize_madoka_jp",
  "banpresto_archive_madoka_jp",
  "sk_japan_madoka_jp",
  "ichiban_kuji_madoka_jp",
  "taito_prize_madoka_jp",
  "sega_prize_madoka_jp",
  "furyu_prize_madoka_jp",
]);

/**
 * Figure grade for a product, or { exclude } with the reason.
 * product: { name, line, category, spec, is_figure }
 */
function classify(product, sourceId) {
  const name = nf(product.name);
  const label = nf(`${product.name || ""} ${product.line || ""} ${product.category || ""}`);
  if (PLUSH_PATTERN.test(label)) {
    if (PLUSH_ACCESSORY.test(name)) return { exclude: "uncertain", reason: "plush charm / accessory" };
    return { grade: "MADOKA_PLUSH" };
  }
  if (GOODS_PATTERN.test(name) || GOODS_CATEGORY.test(nf(product.category))) return { exclude: "goods" };
  if (NENDOROID_PATTERN.test(label)) {
    const subline = /ぷち|Petite|Petit/i.test(label) ? "ねんどろいどぷち" : /どーる|Doll/i.test(label) ? "ねんどろいどどーる" : "ねんどろいど";
    return { grade: "NENDOROID", subline };
  }
  if (/Figuarts\s*mini|フィギュアーツ\s*mini/i.test(label)) return { grade: "MADOKA_MINI", subline: "Figuarts mini" };
  if (MINI_PATTERN.test(label)) return { grade: "MADOKA_MINI" };
  if (ACTION_PATTERN.test(label)) {
    if (/figma/i.test(label)) return { grade: "MADOKA_ACTION", subline: "figma" };
    if (/BUZZmod/i.test(label)) return { grade: "MADOKA_ACTION", subline: "BUZZmod." };
    if (/30MP|30\s*MINUTES/i.test(label)) return { grade: "MADOKA_ACTION", subline: "30MP" };
    if (/Figuarts|フィギュアーツ/i.test(label)) return { grade: "MADOKA_ACTION", subline: "S.H.Figuarts" };
    return { grade: "MADOKA_ACTION" };
  }
  if (PRIZE_SOURCES.has(sourceId) || PRIZE_PATTERN.test(label)) {
    if (PRIZE_SOURCES.has(sourceId) || SCALE_FIGURE_PATTERN.test(label)) return { grade: "MADOKA_PRIZE" };
  }
  if (/POP UP PARADE/i.test(label)) return { grade: "MADOKA_SCALE", subline: "POP UP PARADE" };
  if (product.is_figure || SCALE_FIGURE_PATTERN.test(label)) return { grade: "MADOKA_SCALE" };
  return { exclude: "uncertain", reason: "no figure keyword" };
}

// ---------------------------------------------------------------- Aniplex+

const ANIPLEX_BASE = "https://online.aniplex.co.jp";
const ANIPLEX_GRID = `${ANIPLEX_BASE}/on/demandware.store/Sites-ANX-Site/ja_JP/Search-UpdateGrid`;
const ANIPLEX_PAGE_SIZE = 48;
const ANIPLEX_MAX_PAGES = Number(process.env.MADOKA_ANIPLEX_MAX_PAGES || 30);
const ANIPLEX_QUERIES = ["まどか", "マギアレコード"];
// Figures listed under the character name alone ("深月フェリシア") only show
// what they are on the product page; anything this pricey gets looked at.
const ANIPLEX_DETAIL_PRICE = 10000;

function parseAniplexGrid(html) {
  const out = [];
  for (const chunk of html.split("<article").slice(1)) {
    const block = chunk.split("</article>")[0];
    if (!block || !block.includes("/item")) continue;
    const pid = /name="pid" value="([^"]+)"/.exec(block)?.[1];
    const name = decodeHtml(/<h3 class="c-mid-tile__title">([\s\S]*?)<\/h3>/.exec(block)?.[1] || "");
    if (!pid || !name) continue;
    const href = /class="c-mid-tile__link[^"]*"\s+href="([^"]+)"/.exec(block)?.[1] || `/${pid}.html`;
    const image = /<img src="([^"]+)"/.exec(block)?.[1] || "";
    out.push({
      key: pid,
      name,
      series: decodeHtml(/class="c-product-mid-tile__shoulder">([\s\S]*?)<\/p>/.exec(block)?.[1] || ""),
      url: absolute(href, ANIPLEX_BASE),
      image: image ? absolute(image, ANIPLEX_BASE) : "",
      price_jpy: parseYen(decodeHtml(/class="c-product-mid-tile__price">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
      release_date: null,
      is_limited: /c-product-mid-tile__badge[^"]*limited/.test(block),
    });
  }
  return out;
}

function parseAniplexDetail(html) {
  const release =
    /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?\s*発売予定/.exec(html) ||
    /お届け時期[\s\S]{0,200}?(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(html);
  let structured = null;
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.["@type"] === "Product") structured = parsed;
    } catch {
      // Ignore malformed structured data and keep the grid values.
    }
  }
  // The product's own description block starts at 作品名; the rest of the
  // page is navigation and recommendation tiles, which name other figures
  // ("…スケールフィギュア") on every page.
  const at = html.indexOf("作品名");
  const spec = at >= 0 ? decodeHtml(html.slice(at, at + 2500)) : "";
  return {
    release_date: release
      ? [release[1], release[2].padStart(2, "0"), release[3]?.padStart(2, "0")].filter(Boolean).join("-")
      : null,
    is_figure: /塗装済み?完成品|完成品フィギュア/.test(spec),
    spec,
    category: /カテゴリー\s*[:：]\s*(\S+)/.exec(spec)?.[1] || "",
    images: (Array.isArray(structured?.image) ? structured.image : [structured?.image])
      .filter(Boolean)
      .map((url) => absolute(url, ANIPLEX_BASE)),
    work: decodeHtml(/作品名[\s\S]{0,80}?[:：]\s*([^<]{2,60})/.exec(html)?.[1] || "") || null,
  };
}

function aniplexNeedsDetail(product) {
  const name = nf(product.name);
  if (PLUSH_PATTERN.test(name) && !PLUSH_ACCESSORY.test(name)) return true;
  if (GOODS_PATTERN.test(name)) return false;
  return (
    NENDOROID_PATTERN.test(name) ||
    MINI_PATTERN.test(name) ||
    ACTION_PATTERN.test(name) ||
    SCALE_FIGURE_PATTERN.test(name) ||
    (product.price_jpy || 0) >= ANIPLEX_DETAIL_PRICE
  );
}

async function fetchAniplex(ctx) {
  const byKey = new Map();
  for (const query of ANIPLEX_QUERIES) {
    for (let page = 0; page < ANIPLEX_MAX_PAGES; page += 1) {
      const html = await fetchText(`${ANIPLEX_GRID}?q=${encodeURIComponent(query)}&start=${page * ANIPLEX_PAGE_SIZE}&sz=${ANIPLEX_PAGE_SIZE}`);
      const products = parseAniplexGrid(html);
      for (const product of products) byKey.set(product.key, product);
      if (products.length < ANIPLEX_PAGE_SIZE) break;
    }
  }
  ctx.listed = byKey.size;

  const out = [];
  for (const product of byKey.values()) {
    // The keyword search also returns other IPs' tiles (ビルディバイド, シャフト50周年展):
    // a tile with a series line has to name a Madoka work there.
    if (product.series && !isMadoka(product.series)) {
      ctx.offWork.push(`${product.series} | ${product.name}`);
      continue;
    }
    // ~90% of the storefront is flat goods with no figure word in the name and
    // a goods price; those are counted, not looked up.
    if (!aniplexNeedsDetail(product)) {
      const name = nf(product.name);
      const plushAccessory = PLUSH_PATTERN.test(name) && PLUSH_ACCESSORY.test(name);
      ctx.excluded.push({
        kind: plushAccessory ? "uncertain" : "goods",
        name: product.name,
        url: product.url,
        reason: plushAccessory ? "plush charm / accessory" : "goods",
      });
      continue;
    }
    try {
      const detail = parseAniplexDetail(await fetchText(product.url));
      Object.assign(product, {
        release_date: detail.release_date || product.release_date,
        is_figure: detail.is_figure,
        spec: detail.spec,
        category: detail.category,
        work: detail.work,
      });
      if (detail.images.length) {
        product.image = detail.images[0];
        product.gallery = detail.images;
      }
    } catch (error) {
      if (error.refused) throw error;
      // A detail failure downgrades the record rather than losing it.
      console.warn(`aniplex_plus_madoka_jp detail ${product.key}: ${error.message}`);
    }
    out.push(product);
  }
  // A tile without a series line counts when its name (or 作品名) names the
  // work, or — no work anywhere — a Madoka character by full name.
  return out.filter((product) => {
    if (isMadoka(product.series, product.name, product.work)) return true;
    if (!product.work && MADOKA_CHARACTER.test(nf(product.name))) return true;
    ctx.offWork.push(`${product.work || "(no work)"} | ${product.name}`);
    return false;
  });
}

// ------------------------------------------------- Good Smile (goodsmile.info)

const GSC_INFO_BASE = "https://www.goodsmile.info";
const GSC_INFO_QUERIES = ["まどか", "マギカ", "マギアレコード"];

function parseGscInfoSearch(html) {
  const out = [];
  for (const match of html.matchAll(
    /<a href="\/ja\/product\/(\d+)\/">\s*<img data-original="([^"]*)"[\s\S]*?<span class="hitTtl">\s*<span>([\s\S]*?)<\/span>/g,
  )) {
    out.push({ key: match[1], name: decodeHtml(match[3]), image: absolute(match[2], GSC_INFO_BASE) });
  }
  return out;
}

function gscField(html, label) {
  const match = new RegExp(`<dt[^>]*>\\s*${label}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i").exec(html);
  return decodeHtml(match?.[1] || "");
}

function parseGscInfoDetail(html, productId) {
  // Own images only (their path carries the product id); thumb and large are
  // the same picture, so one url per media id, the large one when present.
  const byMedia = new Map();
  for (const match of html.matchAll(
    new RegExp(`//images\\.goodsmile\\.info/cgm/images/product/\\d+/${productId}/(\\d+)/(large|big|thumb)/[0-9a-f]+\\.(?:jpg|png|jpeg)`, "gi"),
  )) {
    const [url, media, size] = match;
    const previous = byMedia.get(media);
    if (!previous || (previous.size === "thumb" && size !== "thumb")) byMedia.set(media, { url: `https:${url}`, size });
  }
  return {
    name: decodeHtml(/<h1[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] || "") || null,
    work: gscField(html, "作品名") || null,
    maker: gscField(html, "メーカー") || null,
    category: gscField(html, "カテゴリー") || null,
    price_jpy: parseYen(gscField(html, "価格")),
    release_date: releaseDateFrom(gscField(html, "発売時期")),
    spec: gscField(html, "仕様"),
    images: [...byMedia.values()].map((entry) => entry.url),
  };
}

async function fetchGoodSmileInfo(ctx) {
  const cards = new Map();
  for (const query of GSC_INFO_QUERIES) {
    for (let page = 1; page <= 20; page += 1) {
      const html = await fetchText(`${GSC_INFO_BASE}/ja/products/search?search%5Bquery%5D=${encodeURIComponent(query)}&page=${page}`);
      const found = parseGscInfoSearch(html);
      for (const card of found) if (!cards.has(card.key)) cards.set(card.key, card);
      if (!found.length || !html.includes(`page=${page + 1}`)) break;
    }
  }
  ctx.listed = cards.size;
  const out = [];
  for (const card of cards.values()) {
    const url = `${GSC_INFO_BASE}/ja/product/${card.key}/`;
    let detail;
    try {
      detail = parseGscInfoDetail(await fetchText(url), card.key);
    } catch (error) {
      if (error.refused) throw error;
      console.warn(`good_smile_madoka_en detail ${card.key}: ${error.message}`);
      // Without the 作品名 the product cannot be told apart from another
      // work's character of the same name, so only an explicit title is kept.
      if (!isMadoka(card.name)) continue;
      detail = {};
    }
    if (!isMadoka(detail.work, detail.work ? "" : card.name)) {
      ctx.offWork.push(`${detail.work || "(no work)"} | ${card.name}`);
      continue;
    }
    out.push({
      key: card.key,
      name: detail.name || card.name,
      work: detail.work,
      line: detail.category || "",
      category: detail.category || "",
      maker: detail.maker,
      spec: detail.spec,
      is_figure: /塗装済み?完成品/.test(detail.spec || ""),
      url,
      image: detail.images?.[0] || card.image,
      gallery: [...(detail.images || []), card.image].filter(Boolean),
      price_jpy: detail.price_jpy ?? null,
      release_date: detail.release_date || null,
      is_limited: /限定|特典|WonFes|ワンフェス|イベント/.test(`${detail.name || card.name} ${detail.category || ""}`),
    });
  }
  return out;
}

// --------------------------------------------- Good Smile (goodsmile.com)

// The current store. In maintenance (HTTP 503 everywhere, robots.txt too)
// since 2026-10-23: the robots check stops it before any search request, and
// the source is reported as refused. When the store returns, its search grid
// is read with the same markup the Fate importer parses.
const GSC_GLOBAL_BASE = "https://www.goodsmile.com";
const GSC_GLOBAL_PAGE_SIZE = 60;

function parseGscGlobalCards(html) {
  const cards = [];
  for (const match of html.matchAll(/<a class="p-product-list__link" href="(\/ja\/product\/(\d+)[^"]*)">([\s\S]*?)<\/a>/g)) {
    const [, href, productId, body] = match;
    const name = decodeHtml(/<h2 class="c-title[^"]*">([\s\S]*?)<\/h2>/i.exec(body)?.[1] || "");
    if (!name) continue;
    const image = /(?:src)="([^"]*gsc-webrevo-sdk-storage-prd\/product\/image\/[^"]*)"/i.exec(body)?.[1];
    cards.push({
      key: `g${productId}`,
      name,
      url: absolute(href, GSC_GLOBAL_BASE),
      image: image ? absolute(image, GSC_GLOBAL_BASE) : "",
      price_jpy: parseYen(decodeHtml(/<span class="c-price__main">([\s\S]*?)<\/span>/i.exec(body)?.[1] || "")),
      release_date: null,
      is_limited: /限定|特典|Exclusive/i.test(body),
    });
  }
  return cards;
}

async function fetchGoodSmileGlobal(ctx) {
  const filter = encodeURIComponent(
    JSON.stringify({
      search_keyword: "魔法少女まどか☆マギカ",
      search_over18: false,
      search_category: [],
      search_maker: [],
      search_title: [],
      search_status: "0",
      release_date_from: "",
      release_date_to: "",
      search_bonus: false,
      search_exclusive: false,
      search_sale: false,
      search_sales_origin: false,
      tag: [],
    }),
  );
  const byKey = new Map();
  for (let offset = 0; offset <= 1200; offset += GSC_GLOBAL_PAGE_SIZE) {
    const page = parseGscGlobalCards(
      await fetchText(`${GSC_GLOBAL_BASE}/ja/search/list?filter=${filter}&orderBy=1&limit=${GSC_GLOBAL_PAGE_SIZE}&offset=${offset}&couponId=null&searchIndex=-1`),
    );
    for (const card of page) byKey.set(card.key, card);
    if (page.length < GSC_GLOBAL_PAGE_SIZE) break;
  }
  ctx.listed = byKey.size;
  return [...byKey.values()].filter((card) => isMadoka(card.name) || MADOKA_CHARACTER.test(nf(card.name)));
}

// --------------------------------------------------------------- 魂ウェブ

const TAMASHII_BASE = "https://tamashiiweb.com";
const TAMASHII_CHARACTER_CODES = ["madoka-magica"];

async function fetchTamashii(ctx) {
  const byKey = new Map();
  for (const characterCode of TAMASHII_CHARACTER_CODES) {
    for (let page = 1; page <= 20; page += 1) {
      const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE);
      url.searchParams.append("characterCode[]", characterCode);
      url.searchParams.set("per_page", "40");
      url.searchParams.set("current_page", String(page));
      const payload = await fetchJson(url.href);
      for (const item of payload?.data || []) {
        if (!item?.tamashiiWebId) continue;
        byKey.set(item.tamashiiWebId, {
          key: String(item.tamashiiWebId),
          name: item.title,
          // Titles are bare character names; the character filter is the work.
          series: "魔法少女まどか☆マギカ",
          line: item.mainBrandName || "魂ウェブ",
          url: `${TAMASHII_BASE}/item/${item.tamashiiWebId}/`,
          image: item.thumbnailImg ? absolute(item.thumbnailImg, payload.asset_base_url || TAMASHII_BASE) : "",
          price_jpy: Number.isInteger(item.price) ? item.price : null,
          release_date: item.releaseDateData || item.releaseMonth || null,
          is_limited: item.categoryData?.code !== "M",
        });
      }
      const pagination = payload?.pagination;
      if (!pagination || pagination.currentPage >= pagination.lastPage) break;
    }
  }
  ctx.listed = byKey.size;
  return [...byKey.values()];
}

// ---------------------------------------------------------------- 一番くじ

const KUJI_BASE = "https://1kuji.com";
// 85 is 魔法少女まどか☆マギカ in the 1kuji.com title filter (covers the
// movies and マギアレコード too).
const KUJI_LIST_URL = `${KUJI_BASE}/products/search?index_master_search=85`;

function parseIchibanKuji(html, pageUrl) {
  const out = [];
  for (const block of html.match(/<a href="\/products\/[a-zA-Z0-9_-]+"[\s\S]{0,900}?<\/a>/g) || []) {
    const name = decodeHtml(/<p class="itemName">([\s\S]*?)<\/p>/.exec(block)?.[1] || "");
    if (!name) continue;
    const slug = /<a href="\/products\/([a-zA-Z0-9_-]+)"/.exec(block)?.[1] || "";
    out.push({
      key: slug,
      name,
      series: "",
      line: "一番くじ",
      url: absolute(`/products/${slug}`, pageUrl),
      image: absolute(/<img src="([^"]+)"/.exec(block)?.[1] || "", pageUrl),
      release_date: releaseDateFrom(decodeHtml(/<p class="date">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
      is_limited: true,
    });
  }
  return out;
}

function parseKujiDetail(html) {
  const text = decodeHtml(html);
  let prizes = [
    ...new Set([...html.matchAll(/class="name pc">([^<]*)/g)].map((match) => decodeHtml(match[1])).filter(Boolean)),
  ];
  // Older pages (FIGURE SPIRITS KUJI) have no prize-name markup; their prizes
  // only appear in running text ("A賞 ブルーベリーマカロンver.暁美ほむら フィギュア").
  if (!prizes.length) {
    prizes = [...new Set([...text.matchAll(/(?:[A-Z]|ラストワン)賞\s+([^。、「」"]{2,50}?(?:フィギュア|ぬいぐるみ|きゅんキャラ))/g)].map((match) => match[0].trim()))];
  }
  return {
    prizes,
    price_jpy: parseYen(/希望小売価格[：:]\s*1回\s*([\d,]+)\s*円/.exec(text)?.[1]),
    // Used for the old campaigns, which the title filter no longer lists.
    name: decodeHtml(/<title>([^<｜]*)/.exec(html)?.[1] || ""),
    release_date: releaseDateFrom(/(\d{4}年\s*\d{1,2}月[^ ]{0,8}?)発売/.exec(text)?.[1] || ""),
    image: /(https:\/\/assets\.1kuji\.com\/uploads\/product\/top_banner\/[^"]+\.(?:jpg|png))/.exec(html)?.[1] || "",
  };
}

// 2011–2016 campaigns: still served by 1kuji.com, but no longer in the title
// filter or the keyword search, so their pages are read by slug.
// (madomagi1 and magireco4 do not exist.)
const KUJI_OLD_SLUGS = ["madomagi", "madomagi2", "madomagi3", "madomagi4", "madomagi5", "madomagi6", "madomagi7", "madomagi8", "madomagi9", "madomagi10"];

// Prize figure lines on 1kuji.com, plus plush. "着ぐるみキュゥべえ" (Magiccraft
// III) is a plush in costume but says so nowhere: it is reported as uncertain.
const KUJI_FIGURE_PRIZE =
  /フィギュア|MASTERLISE|Dioramique|SOFVICS|GLITTER|EXQ|きゅんキャラ|ぬいぐるみ|ちびぐるみ|ワールドコレクタブル|ワーコレ|ちょこのせ|デフォルメ|ソフビ|Q\s*posket|ぷちぴっと/i;
const KUJI_UNCERTAIN_PRIZE = /着ぐるみ|マスコット/;

async function fetchIchibanKuji(ctx) {
  const listed = parseIchibanKuji(await fetchText(KUJI_LIST_URL), KUJI_LIST_URL);
  for (const slug of KUJI_OLD_SLUGS) {
    if (listed.some((kuji) => kuji.key === slug)) continue;
    listed.push({ key: slug, name: "", series: "", line: "一番くじ", url: `${KUJI_BASE}/products/${slug}`, image: "", release_date: null, is_limited: true, old: true });
  }
  ctx.listed = listed.length;
  const out = [];
  for (const kuji of listed) {
    if (kuji.old) {
      let page;
      try {
        page = parseKujiDetail(await fetchText(kuji.url));
      } catch (error) {
        if (error.refused) throw error;
        console.warn(`ichiban_kuji_madoka_jp ${kuji.key}: ${error.message}`);
        continue;
      }
      Object.assign(kuji, { name: page.name, release_date: page.release_date, image: page.image, detail: page });
      delete kuji.old;
    }
    if (!isMadoka(kuji.name)) {
      ctx.offWork.push(kuji.name);
      continue;
    }
    let detail = kuji.detail || { prizes: [] };
    delete kuji.detail;
    if (!detail.prizes.length) {
      try {
        detail = parseKujiDetail(await fetchText(kuji.url));
      } catch (error) {
        if (error.refused) throw error;
        console.warn(`ichiban_kuji_madoka_jp detail ${kuji.key}: ${error.message}`);
      }
    }
    const figurePrizes = detail.prizes.filter((prize) => KUJI_FIGURE_PRIZE.test(nf(prize)));
    if (detail.prizes.length && !figurePrizes.length) {
      const maybe = detail.prizes.filter((prize) => KUJI_UNCERTAIN_PRIZE.test(nf(prize)) && !/アクリル|ラバー/.test(prize));
      ctx.excluded.push(
        maybe.length
          ? { kind: "uncertain", name: kuji.name, url: kuji.url, reason: `possible plush prize: ${maybe.join(" / ")}` }
          : { kind: "goods", name: kuji.name, url: kuji.url, reason: "no figure or plush prize in the lineup" },
      );
      continue;
    }
    if (!detail.prizes.length) {
      ctx.excluded.push({ kind: "uncertain", name: kuji.name, url: kuji.url, reason: "prize lineup not readable" });
      continue;
    }
    out.push({
      ...kuji,
      price_jpy: detail.price_jpy,
      figure_prizes: figurePrizes,
      force_grade: "MADOKA_PRIZE",
    });
  }
  return out;
}

// ------------------------------------------------------- バンプレスト景品

const BSP_BASE = "https://bsp-prize.jp";
// IP00004703 is 魔法少女まどか☆マギカ シリーズ. The title page shows only the
// latest items; the title search lists every one.
const BSP_LIST_URL = `${BSP_BASE}/search/?ref=title&title=IP00004703`;

function parseBanpresto(html, pageUrl) {
  const out = [];
  for (const block of html.match(/<div class="products_item">[\s\S]{0,900}?<\/div>/g) || []) {
    const name = decodeHtml(/<p class="products_name">([\s\S]*?)<\/p>/.exec(block)?.[1] || "");
    if (!name) continue;
    const id = /<a href="\/item\/(\d+)\/?"/.exec(block)?.[1] || "";
    const image = /<img src="([^"]+)"/.exec(block)?.[1] || "";
    out.push({
      key: id,
      name,
      series: "",
      line: "バンプレスト景品",
      url: absolute(`/item/${id}/`, pageUrl),
      image: image ? absolute(image, pageUrl) : "",
      release_date: releaseDateFrom(decodeHtml(/<p class="products_date">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
      is_limited: true,
    });
  }
  return out;
}

// One request: the listing's thumbnails are the pictures (lib/bsp-prize.mjs). Until
// 2026-11-14 each item page was read for its full-size pictures, which the bot and
// the app are refused, so 24 covers and 89 gallery pictures never showed.
async function fetchBanpresto(ctx) {
  const html = await fetchText(BSP_LIST_URL);
  const listed = parseBanpresto(html, BSP_LIST_URL);
  ctx.listed = listed.length;
  const total = Number(/(\d+)\s*件あります/.exec(decodeHtml(html))?.[1] || 0);
  if (total > listed.length) console.warn(`banpresto_prize_madoka_jp: listing shows ${listed.length} of ${total} items`);
  const stored = new Map(previousMadoka.map((kit) => [kit.kit_id, kit]));
  const out = [];
  for (const product of listed) {
    if (!isMadoka(product.name)) {
      ctx.offWork.push(product.name);
      continue;
    }
    product.image = banprestoCover(product.image, stored.get(`banpresto-madoka-${slugify(product.key, "")}`));
    out.push(product);
  }
  return out;
}

// ------------------------------------------------------------------- 寿屋

// Shift-JIS keyword "まどか". The shop has no Madoka products as of 2026-11;
// the keyword finds 結城まどか (創彩少女庭園), which the work filter drops.
const KOTOBUKIYA_SHOP_URL = "https://shop.kotobukiya.co.jp/shop/goods/search.aspx?keyword=%82%DC%82%C7%82%A9&search.x=on&ps=90";

async function fetchKotobukiya(ctx) {
  const listings = parseKotobukiyaShopListings(await fetchText(KOTOBUKIYA_SHOP_URL, { encoding: "shift_jis" }), KOTOBUKIYA_SHOP_URL);
  ctx.listed = listings.length;
  const products = [];
  for (const listing of listings) {
    if (!isMadoka(listing.title) && !MADOKA_CHARACTER.test(nf(listing.title))) {
      ctx.offWork.push(listing.title);
      continue;
    }
    let detail = {};
    try {
      detail = parseKotobukiyaShopDetail(await fetchText(listing.detail_url, { encoding: "shift_jis" }), listing.detail_url);
    } catch (error) {
      if (error.refused) throw error;
      console.warn(`kotobukiya_madoka_jp detail ${listing.product_id}: ${error.message}`);
    }
    products.push({
      key: listing.product_id,
      name: detail.title || listing.title,
      // parseKotobukiyaShopDetail defaults work_title to Armored Core.
      work: /Armored Core/i.test(detail.work_title || "") ? "" : detail.work_title || "",
      line: detail.category || "寿屋",
      category: detail.category || "",
      spec: detail.specification || "",
      is_figure: /完成品/.test(detail.specification || ""),
      url: listing.detail_url,
      image: (detail.gallery || [])[0] || listing.image_url || "",
      gallery: detail.gallery || [],
      price_jpy: detail.price_jpy ?? null,
      release_date: detail.release_date || null,
      is_limited: Boolean(listing.is_limited),
    });
  }
  return products;
}

// ------------------------------------------------------- タイトープライズ

// www.taito.co.jp asks for Crawl-delay: 20, which politeFetch honours (each
// request here waits 20 s). The TAITO prize pages are AngularJS templates fed
// by JSON under /api/ (read as data; no page script is run). The current
// lineup (/api/PrizeProduct, aspMemberID 0000000002 = タイトープライズ) only
// reaches back a few weeks, while each original brand (Coreful, AMP+, てちぬい …)
// keeps its full history in /api/TaitoPrizeSeriesProductModel. Brand ids come
// from the brand index (category 0000000036), so a new brand is picked up.
// IP "series" (category 0000000035) are not read: none is a Madoka work, and
// each would cost another 20 s.
const TAITO_BASE = "https://www.taito.co.jp";
const TAITO_MEMBER = "0000000002";

function taitoDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(String(value || ""));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function taitoProduct(item, line) {
  const images = [];
  if (item.ImageFullPathName01 && item.ImageName01) images.push(`https://${item.ImageFullPathName01}`);
  for (const key of ["ImageName02", "ImageName03", "ImageName04", "ImageName05"]) {
    if (item[key] && item.ImagePath) images.push(`https://${item.ImagePath}${item[key]}`);
  }
  return {
    key: String(item.ProductID),
    name: nf(item.ProductName).replace(/\s+/g, " ").trim(),
    series: "",
    line: line ? `タイトープライズ ${line}` : "タイトープライズ",
    url: `${TAITO_BASE}/taito-prize/${item.ProductID}`,
    image: images[0] || "",
    gallery: images,
    price_jpy: null,
    release_date: taitoDate(item.ReleaseDate),
    is_limited: true,
  };
}

async function fetchTaitoPrize(ctx) {
  const byKey = new Map();
  const current = await fetchJson(
    `${TAITO_BASE}/api/PrizeProduct/?aspMemberID=${TAITO_MEMBER}&offset=0&limit=1000&sortName=TaitoPrizeNew&isDesc=true`,
  );
  for (const item of Array.isArray(current) ? current : []) byKey.set(String(item.ProductID), taitoProduct(item, ""));
  const brands = await fetchJson(
    `${TAITO_BASE}/api/PrizeProduct/?aspMemberID=${TAITO_MEMBER}&offset=0&limit=100&sortName=&isDesc=true&isParents=true&category=0000000036&lang=ja`,
  );
  for (const brand of Array.isArray(brands) ? brands : []) {
    const items = await fetchJson(
      `${TAITO_BASE}/api/TaitoPrizeSeriesProductModel/?aspMemberID=${TAITO_MEMBER}&limit=1000&offset=0&isDesc=true&sortName=&productID=${brand.ProductID}&lang=ja`,
    );
    const line = nf(brand.ProductName).replace(/フィギュア$/, "").trim();
    for (const item of Array.isArray(items) ? items : []) byKey.set(String(item.ProductID), taitoProduct(item, line));
  }
  ctx.listed = byKey.size;
  // Names carry the work in front ("劇場版 魔法少女まどか☆マギカ〈…〉 てちぬい vol.1").
  return [...byKey.values()].filter((product) => isMadoka(product.name));
}

// --------------------------------------------------------- セガプライズ

// segaplaza.jp is a Nuxt site whose search runs in the browser over a prize
// table compiled into one of its script chunks (~4 MB, every prize on the
// site). The chunk name changes with each build, so it is found from the
// search page: the chunks /search/ preloads that /title/ does not, read as
// text until one holds the "prizeId" table. Nothing is executed — the
// objects are cut out and parsed as JSON. Each Madoka figure-class prize then
// gets its prerendered page for the official pictures (JSON-LD "image").
const SEGA_BASE = "https://segaplaza.jp";

function chunkUrls(html) {
  return [...new Set([...html.matchAll(/\/_nuxt\/[A-Za-z0-9_-]+\.js/g)].map((match) => match[0]))];
}

// Every top-level {"prizeId": …} object literal in the chunk.
function segaPrizeObjects(text) {
  const out = [];
  let index = 0;
  while ((index = text.indexOf('{"prizeId":', index)) >= 0) {
    let depth = 0;
    let end = index;
    let inString = false;
    for (; end < text.length; end += 1) {
      const char = text[end];
      if (inString) {
        if (char === "\\") end += 1;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) break;
    }
    try {
      out.push(JSON.parse(text.slice(index, end + 1)));
    } catch {
      // A literal that is not plain JSON (none is Madoka as of 2026-11).
    }
    index = end + 1;
  }
  return out;
}

function segaImages(html) {
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        const images = Array.isArray(entry?.image) ? entry.image : entry?.image ? [entry.image] : [];
        const own = images.filter((url) => typeof url === "string" && url.includes("/images-v3/prize/"));
        if (own.length) return own;
      }
    } catch {
      // Ignore malformed structured data.
    }
  }
  return [...new Set([...html.matchAll(/\/images-v3\/prize\/[^"']+\/large\/[^"']+\.webp/g)].map((match) => absolute(match[0], SEGA_BASE)))];
}

async function fetchSegaPrize(ctx) {
  const searchChunks = chunkUrls(await fetchText(`${SEGA_BASE}/search/`));
  const titleChunks = new Set(chunkUrls(await fetchText(`${SEGA_BASE}/title/`)));
  let prizes = [];
  for (const chunk of searchChunks.filter((url) => !titleChunks.has(url))) {
    const text = await fetchText(absolute(chunk, SEGA_BASE));
    if (!text.includes('{"prizeId":')) continue;
    prizes = segaPrizeObjects(text);
    break;
  }
  if (!prizes.length) throw new Error("prize table not found in the search page chunks");
  ctx.listed = prizes.length;
  const out = [];
  for (const prize of prizes) {
    // 【改行】 marks a display line break: "…マギカ【改行】[新編]叛逆の物語".
    const name = nf(String(prize.name || "").replace(/【改行】(?=[[［〈])/g, "").replace(/【改行】/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    const keywords = (prize.keywords || []).join(" ");
    if (!isMadoka(name, keywords)) {
      // Only near misses are worth listing (a Madoka title id, other name).
      if (/madoka|magia/i.test(prize.productId || "")) ctx.offWork.push(`${prize.productId} | ${name}`);
      continue;
    }
    const product = {
      key: String(prize.prizeId),
      name,
      // The work as the site files it (first keyword), for 叛逆の物語 vs TV.
      work: (prize.keywords || []).find((keyword) => isMadoka(keyword)) || "",
      series: "",
      line: "セガプライズ",
      spec: prize.size || "",
      url: `${SEGA_BASE}/prize/${prize.prizeId}/`,
      image: "",
      gallery: [],
      price_jpy: null,
      release_date: releaseDateFrom(prize.releaseDate),
      is_limited: true,
    };
    if (!classify(product, "sega_prize_madoka_jp").exclude) {
      try {
        const images = segaImages(await fetchText(product.url));
        product.image = images[0] || "";
        product.gallery = images;
      } catch (error) {
        if (error.refused) throw error;
        console.warn(`sega_prize_madoka_jp detail ${product.key}: ${error.message}`);
      }
    }
    out.push(product);
  }
  return out;
}

// ------------------------------------------------------------------ ALTER

// alter-web.jp keyword search covers the 作品名 too ("マギカ" finds 五十鈴れん);
// each product page has a 作品名 / 発売月 / 価格 / サイズ table.
const ALTER_BASE = "https://alter-web.jp";
const ALTER_QUERIES = ["まどか", "マギカ", "マギアレコード"];

function alterCell(html, label) {
  return decodeHtml(new RegExp(`<th>\\s*${label}\\s*<\\/th>\\s*<td>([\\s\\S]*?)<\\/td>`).exec(html)?.[1] || "");
}

function parseAlterDetail(html) {
  const images = [
    ...new Set(
      [...html.matchAll(/<img[^>]*src="(\/uploads\/products\/[^"]+)"/g)].map((match) => absolute(match[1], ALTER_BASE)),
    ),
  ];
  const spec = `${alterCell(html, "サイズ")} ${decodeHtml(/<p class="spec[^"]*">([\s\S]*?)<\/p>/.exec(html)?.[1] || "")}`.trim();
  return {
    // The page's first <h1> is the site logo; the product name is the
    // hl06 heading (the <title> minus " | ALTER" as a fallback).
    name:
      decodeHtml(/<h1 class="hl\d+[^"]*">([\s\S]*?)<\/h1>/.exec(html)?.[1] || "") ||
      decodeHtml(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] || "").replace(/\s*\|\s*ALTER\s*$/, ""),
    work: alterCell(html, "作品名"),
    release_date: releaseDateFrom(alterCell(html, "発売月")),
    price_jpy: parseYen(alterCell(html, "価格")),
    spec,
    images,
  };
}

async function fetchAlter(ctx) {
  const ids = new Set();
  for (const query of ALTER_QUERIES) {
    const html = await fetchText(`${ALTER_BASE}/search/?keyword=${encodeURIComponent(query)}`);
    for (const match of html.matchAll(/href="\/products\/(\d+)\/"/g)) ids.add(match[1]);
  }
  ctx.listed = ids.size;
  const out = [];
  for (const id of ids) {
    const url = `${ALTER_BASE}/products/${id}/`;
    const detail = parseAlterDetail(await fetchText(url));
    if (!isMadoka(detail.work)) {
      ctx.offWork.push(`${detail.work || "(no work)"} | ${detail.name}`);
      continue;
    }
    out.push({
      key: id,
      name: detail.name,
      work: detail.work,
      line: "ALTER",
      spec: detail.spec,
      is_figure: /完成品/.test(detail.spec),
      url,
      image: detail.images[0] || "",
      gallery: detail.images,
      price_jpy: detail.price_jpy,
      release_date: detail.release_date,
      is_limited: /限定/.test(detail.name),
    });
  }
  return out;
}

// ---------------------------------------------------------------- MEDICOS

// medicos-e.net is WordPress; its product pages are the "gallery" post type,
// searched through the public REST API. As of 2026-11 Medicos' Madoka
// releases are Don Quijote collaboration goods only (news posts), so this
// finds nothing; it is kept for a future 超像可動 or figure.
const MEDICOS_BASE = "https://www.medicos-e.net";
const MEDICOS_QUERIES = ["まどか", "マギカ", "マギアレコード"];

async function fetchMedicos(ctx) {
  const byKey = new Map();
  for (const query of MEDICOS_QUERIES) {
    const posts = await fetchJson(
      `${MEDICOS_BASE}/wp-json/wp/v2/gallery?search=${encodeURIComponent(query)}&per_page=100&_fields=id,date,link,title,content`,
    );
    for (const post of Array.isArray(posts) ? posts : []) byKey.set(String(post.id), post);
  }
  ctx.listed = byKey.size;
  const out = [];
  for (const post of byKey.values()) {
    const name = decodeHtml(post.title?.rendered || "");
    const content = post.content?.rendered || "";
    const text = decodeHtml(content);
    if (!isMadoka(name, text.slice(0, 600))) {
      ctx.offWork.push(name);
      continue;
    }
    const images = [...new Set([...content.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => absolute(match[1], MEDICOS_BASE)))];
    out.push({
      key: String(post.id),
      name,
      work: /『([^』]+)』/.exec(text)?.[1] || "",
      line: "MEDICOS",
      spec: text.slice(0, 1500),
      is_figure: /完成品/.test(text),
      url: post.link,
      image: images[0] || "",
      gallery: images,
      price_jpy: parseYen(/価格[^0-9]{0,20}([\d,]+)\s*円/.exec(text)?.[1]),
      release_date: releaseDateFrom(/発売[^0-9]{0,20}(\d{4}\s*年\s*\d{1,2}\s*月)/.exec(text)?.[1]),
      is_limited: /限定/.test(name),
    });
  }
  return out;
}

// ------------------------------------------------------- フリュープライズ

// furyuprize.com (charahiroba.com redirects here) lists the current and
// upcoming FuRyu prizes; its search grid is fed by /api/search (JSON).
// Older prizes drop off the site, so earlier runs' records are kept.
const FURYU_PRIZE_BASE = "https://furyuprize.com";
const FURYU_PRIZE_QUERIES = ["まどか", "マギカ", "マギアレコード"];

async function fetchFuryuPrize(ctx) {
  const byKey = new Map();
  for (const query of FURYU_PRIZE_QUERIES) {
    for (let page = 1; page <= 20; page += 1) {
      const payload = await fetchJson(`${FURYU_PRIZE_BASE}/api/search?keyword=${encodeURIComponent(query)}&page=${page}`);
      for (const item of payload?.items || []) if (item?.code) byKey.set(String(item.code), item);
      if (!payload?.last_page || page >= payload.last_page) break;
    }
  }
  ctx.listed = byKey.size;
  const out = [];
  for (const item of byKey.values()) {
    const work = nf(item.name_group || item.character_name || "");
    const itemName = nf(item.name_item || "").trim();
    if (!isMadoka(work, itemName)) {
      ctx.offWork.push(`${work || "(no work)"} | ${itemName}`);
      continue;
    }
    const url = `${FURYU_PRIZE_BASE}/item/${item.code}`;
    const product = {
      key: String(item.code),
      // The item page titles it "<作品> <item>"; the grid has the two apart.
      name: isMadoka(itemName) ? itemName : `${work} ${itemName}`.trim(),
      work,
      series: "",
      line: "フリュープライズ",
      url,
      image: item.img_item_main ? absolute(`/files/images${item.img_item_main}`, FURYU_PRIZE_BASE) : "",
      gallery: [],
      price_jpy: null,
      release_date: releaseDateFrom(item.release_month),
      is_limited: true,
    };
    if (!classify(product, "furyu_prize_madoka_jp").exclude) {
      try {
        const html = await fetchText(url);
        const images = [
          ...new Set(
            [...html.matchAll(/\/files\/images\/prz\/pi-(?:main|sub\d+)-\d+\.(?:webp|jpg|png)/g)]
              .map((match) => absolute(match[0], FURYU_PRIZE_BASE))
              .filter((src) => src.includes(`-${item.code}.`)),
          ),
        ];
        if (images.length) {
          product.image = images[0];
          product.gallery = images;
        }
      } catch (error) {
        if (error.refused) throw error;
        console.warn(`furyu_prize_madoka_jp detail ${item.code}: ${error.message}`);
      }
    }
    out.push(product);
  }
  return out;
}

// ------------------------------------------------- FURYU HOBBY MALL (F:NEX)

// FuRyu's own hobby store (furyu-hm.com, Shopify) for F:NEX and TENITOL;
// furyu-hobby.com no longer resolves. The storefront's public products.json
// pages (250 a page) carry title, type, tags, price and images; a product is
// Madoka when a tag or its title names the work. These are retail figures, so
// TENITOL (a prize word elsewhere) is graded as a scale figure here.
const FURYU_HM_BASE = "https://furyu-hm.com";
const FURYU_HM_MAX_PAGES = Number(process.env.MADOKA_FURYU_HM_MAX_PAGES || 30);

async function fetchFuryuHobby(ctx) {
  const products = [];
  for (let page = 1; page <= FURYU_HM_MAX_PAGES; page += 1) {
    const payload = await fetchJson(`${FURYU_HM_BASE}/products.json?limit=250&page=${page}`);
    const batch = payload?.products || [];
    products.push(...batch);
    if (batch.length < 250) break;
  }
  ctx.listed = products.length;
  const out = [];
  for (const item of products) {
    const tags = (item.tags || []).join(" ");
    const title = nf(item.title || "").replace(/\s+/g, " ").trim();
    if (!isMadoka(tags, title)) continue;
    const body = decodeHtml(item.body_html || "");
    const work = (body.match(/『([^』]+)』/g) || []).map((text) => text.slice(1, -1)).find((text) => isMadoka(text)) ||
      (item.tags || []).find((tag) => isMadoka(tag)) || "";
    const price = Number(item.variants?.[0]?.price);
    const release = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(?:上旬|中旬|下旬|頃)?\s*(?:発売|発送|お届け|出荷)/.exec(body);
    const images = (item.images || []).map((image) => image.src).filter(Boolean);
    const product = {
      key: String(item.handle),
      name: title,
      work,
      line: nf(item.vendor || "FuRyu"),
      category: nf(item.product_type || ""),
      spec: `${nf(item.product_type || "")} ${body.slice(0, 600)}`,
      is_figure: /フィギュア/.test(item.product_type || ""),
      url: `${FURYU_HM_BASE}/products/${item.handle}`,
      image: images[0] || "",
      gallery: images,
      price_jpy: Number.isFinite(price) && price > 0 ? Math.round(price) : null,
      release_date: release ? `${release[1]}-${release[2].padStart(2, "0")}` : null,
      is_limited: /限定/.test(`${title} ${tags}`),
    };
    const grade = classify(product, "furyu_madoka_jp");
    if (grade.grade === "MADOKA_PRIZE") product.force_grade = "MADOKA_SCALE";
    out.push(product);
  }
  return out;
}

// --------------------------------------------------------------------------

// Order is also the merge priority for the same product in two sources: the
// maker's own record wins over a store listing. The maker sites added in
// 2026-11 (TAITO … FuRyu) come after the original sources so a product that
// is already in the catalog keeps its record and the new site's listing is
// folded into it as an extra source ref (existing kit ids never move).
// ------------------------------------------------ smaller makers (2026-11)
//
// Makers whose own sites list a handful of Madoka figures each. All render
// their pages server-side (Claynel answers its listing as JSON).

const ogMeta = (html, property) =>
  decodeHtml(new RegExp(`<meta[^>]+property="og:${property}"[^>]+content="([^"]*)"`, "i").exec(html)?.[1] || "");

// One page of plain text, scripts and styles left out.
const pageText = (html) => decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "));

// SK JAPAN (prize plush and figures): character page, then each item page.
const SKJ_BASE = "https://www.sk-japan.co.jp";
const SKJ_LIST_URL = `${SKJ_BASE}/charatoru/charas/madoka-magica`;

async function fetchSkJapan(ctx) {
  const urls = new Set();
  for (let page = 1; page <= 10; page += 1) {
    const listUrl = page === 1 ? SKJ_LIST_URL : `${SKJ_LIST_URL}/page/${page}`;
    let html;
    try {
      html = await fetchText(listUrl);
    } catch (error) {
      if (error.refused || page === 1) throw error;
      break;
    }
    const before = urls.size;
    for (const match of html.matchAll(/href="(https:\/\/www\.sk-japan\.co\.jp\/charatoru\/chara\/madoka-magica\/amgoods-\d+)\/?"/g)) {
      urls.add(match[1]);
    }
    if (urls.size === before || !html.includes(`/page/${page + 1}`)) break;
  }
  ctx.listed = urls.size;
  const out = [];
  for (const url of urls) {
    const html = await fetchText(url);
    const name = decodeHtml(
      /<p class="[^"]*title_l[^"]*">([\s\S]*?)<\/p>/.exec(html)?.[1] || /<title>([^<|]*?)\s*プライズの情報サイト/.exec(html)?.[1] || "",
    );
    if (!name) continue;
    const cell = (label) => decodeHtml(new RegExp(`<h2>${label}</h2></th>\\s*<td>([\\s\\S]*?)</td>`).exec(html)?.[1] || "");
    const images = [...html.matchAll(/<ul id="bxslider">[\s\S]*?<\/ul>/g)].flatMap((block) =>
      [...block[0].matchAll(/<img src="([^"]+)"/g)].map((match) => match[1]),
    );
    out.push({
      key: url.split("/").pop(),
      name: /まどか|マギカ/.test(name) ? name : `魔法少女まどか☆マギカ ${name}`,
      work: "魔法少女まどか☆マギカ",
      line: "SK JAPAN",
      spec: cell("詳細"),
      url,
      image: images[0] || "",
      gallery: images,
      price_jpy: null,
      release_date: releaseDateFrom(cell("発売日")),
      is_limited: false,
    });
  }
  return out;
}

// クレーネル (Claynel, Aniplex group; BUZZmod.): JSON listing of every title's
// products, 12 a page. Titles carry character names only, so candidates are
// picked by name and kept when the item page's 作品名 is a Madoka work.
const CLAYNEL_BASE = "https://www.claynel.jp";

async function fetchClaynel(ctx) {
  const candidates = [];
  let total = Infinity;
  for (let page = 1; (page - 1) * 12 < total && page <= 20; page += 1) {
    const data = await fetchJson(`${CLAYNEL_BASE}/products/data.html?page=${page}`);
    total = Number(data.items?.total || 0);
    for (const item of data.items?.articles || []) {
      if (MADOKA_CHARACTER.test(nf(item.title))) candidates.push(item);
    }
  }
  ctx.listed = candidates.length;
  const out = [];
  for (const item of candidates) {
    const url = `${CLAYNEL_BASE}/products/?item_id=${item.id}`;
    const html = await fetchText(url);
    const block = (cap) =>
      decodeHtml(new RegExp(`name-cap">${cap}</div>\\s*<div class="p-works_detail__name-desc">([\\s\\S]*?)</div>`).exec(html)?.[1] || "");
    const work = block("作品名");
    if (!isMadoka(work)) {
      ctx.offWork.push(`${work || "(no work)"} | ${item.title}`);
      continue;
    }
    const text = pageText(html);
    const images = [
      ...new Set([...html.matchAll(/SYS\/CONTENTS\/goods_\d+_(?:main|photo_\d+)/g)].map((match) => `${CLAYNEL_BASE}/${match[0]}`)),
    ];
    out.push({
      key: String(item.id),
      name: decodeHtml(/p-works_detail__name-name">([\s\S]*?)<\/div>/.exec(html)?.[1] || item.title),
      work,
      line: "クレーネル",
      // Claynel's pages give no scale; BUZZmod. is a 1/12 line (as Aniplex+
      // lists it), which lets the cross-source dedupe match the two.
      spec: `${/BUZZmod/i.test(item.title) ? "1/12 " : ""}${/商品形態\s*(.{0,60})/.exec(text)?.[1] || ""}`,
      is_figure: /フィギュア|BUZZmod/.test(item.title),
      url,
      image: images.find((image) => image.endsWith("_main")) || images[0] || "",
      gallery: images,
      price_jpy: parseYen(block("商品価格")),
      release_date: releaseDateFrom(/発売(?:日|時期|予定)?\s*(\d{4}年\s*\d{1,2}月(?:\s*\d{1,2}日)?)/.exec(text)?.[1] || ""),
      is_limited: false,
    });
  }
  return out;
}

// メガハウス (megahobby.jp): keyword search, then item pages.
const MEGAHOBBY_BASE = "https://www.megahobby.jp";
const MEGAHOBBY_QUERIES = ["まどか☆マギカ", "マギアレコード"];

async function fetchMegaHouse(ctx) {
  const ids = new Set();
  for (const query of MEGAHOBBY_QUERIES) {
    const html = await fetchText(`${MEGAHOBBY_BASE}/search/?s=${encodeURIComponent(query)}`);
    for (const match of html.matchAll(/href="[^"]*\/products\/item\/(\d+)\/?"/g)) ids.add(match[1]);
  }
  ctx.listed = ids.size;
  const out = [];
  for (const id of ids) {
    const url = `${MEGAHOBBY_BASE}/products/item/${id}/`;
    const html = await fetchText(url);
    // The item heading names the line ("キューティーフィギュアマスコット …"); the
    // og:title of older items is only a category ("その他コレクションアイテム …").
    const name = decodeHtml(/<h2 class="ttl">([\s\S]*?)<\/h2>/.exec(html)?.[1] || "") || ogMeta(html, "title");
    const keywords = /<meta name="keywords" content="([^"]*)"/.exec(html)?.[1] || "";
    if (!isMadoka(name, keywords)) {
      ctx.offWork.push(name);
      continue;
    }
    const after = (alt) => decodeHtml(new RegExp(`alt="${alt}"[^>]*>\\s*(?:</dt>\\s*<dd>)?([^<]*)`).exec(html)?.[1] || "");
    out.push({
      key: id,
      name,
      work: isMadoka(name) ? name : "魔法少女まどか☆マギカ",
      line: "MegaHouse",
      is_figure: /フィギュア|figure/i.test(keywords),
      url,
      image: absolute(ogMeta(html, "image"), url),
      price_jpy: parseYen(after("希望小売価格")),
      release_date: releaseDateFrom(after("発売日")),
      is_limited: /限定/.test(name),
    });
  }
  return out;
}

// バンダイ キャンディ (食玩): site search, back to 2012.
const CANDY_SEARCH_URL = "https://www.bandai.co.jp/candy/search/result.html";
const CANDY_QUERIES = ["まどか", "マギカ"];

async function fetchBandaiCandy(ctx) {
  const urls = new Set();
  for (const query of CANDY_QUERIES) {
    const html = await fetchText(`${CANDY_SEARCH_URL}?q=${encodeURIComponent(query)}`);
    for (const match of html.matchAll(/href="(https:\/\/www\.bandai\.co\.jp\/candy\/products\/\d{4}\/\d+\.html)"/g)) urls.add(match[1]);
  }
  ctx.listed = urls.size;
  const out = [];
  for (const url of urls) {
    const html = await fetchText(url);
    const title = ogMeta(html, "title");
    const name = title.split("｜")[0].trim();
    if (!isMadoka(name)) {
      ctx.offWork.push(name);
      continue;
    }
    const text = pageText(html);
    out.push({
      key: url.match(/(\d+)\.html$/)[1],
      name,
      work: name,
      line: "バンダイ キャンディ 食玩",
      // Only the figure lines count; wafers, gum, ice cream … are sweets with a
      // card or sticker.
      category: /フィギュア|コレクション|COLLECTION|マスコット|Dolly|ドール/i.test(name) ? "" : "グッズ",
      url,
      image: ogMeta(html, "image"),
      price_jpy: parseYen(/税込\s*([\d,]+)\s*円/.exec(text)?.[1]),
      release_date: releaseDateFrom(/発売日[：:]\s*([^｜]+)/.exec(title)?.[1] || ""),
      is_limited: false,
    });
  }
  return out;
}

// ムービック (movic.jp): store search; only the plush line (goods code
// group 00700: ぬいパル and other ぬいぐるみ) counts here.
const MOVIC_BASE = "https://www.movic.jp";

async function fetchMovic(ctx) {
  const cards = new Map();
  for (let page = 1; page <= 12; page += 1) {
    const html = await fetchText(
      `${MOVIC_BASE}/shop/goods/search.aspx?search=x&keyword=${encodeURIComponent("まどか☆マギカ")}&p=${page}&ps=50`,
    );
    let found = 0;
    for (const match of html.matchAll(/href="(\/shop\/g\/g([0-9-]+)\/)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const name = decodeHtml(match[3]).replace(/\s*在庫[\s\S]*$/, "").trim();
      if (!name) continue;
      found += 1;
      const price = parseYen(/在庫[\s\S]*?([\d,]+)円/.exec(decodeHtml(match[3]))?.[1]);
      if (/-00700-/.test(match[2]) && !cards.has(match[2])) cards.set(match[2], { id: match[2], name, price, url: `${MOVIC_BASE}${match[1]}` });
    }
    if (!found) break;
  }
  ctx.listed = cards.size;
  const out = [];
  for (const card of cards.values()) {
    if (!isMadoka(card.name)) continue;
    const html = await fetchText(card.url);
    const text = pageText(html);
    out.push({
      key: card.id,
      name: card.name,
      work: card.name,
      line: "ムービック",
      category: "ぬいぐるみ",
      url: card.url,
      image: ogMeta(html, "image"),
      price_jpy: card.price,
      release_date: releaseDateFrom(/(\d{4}年\d{1,2}月(?:\d{1,2}日)?)頃?発売/.exec(text)?.[1] || ""),
      is_limited: /受注生産|限定/.test(card.name),
    });
  }
  return out;
}

// SHIBUYA SCRAMBLE FIGURE (eStream): brand store category; cards carry the
// work and the price, the item page the product outline and images.
const SSF_BASE = "https://ec.shibuya-scramble-figure.com";

async function fetchShibuyaScramble(ctx) {
  const cards = new Map();
  for (let page = 1; page <= 10; page += 1) {
    const html = await fetchText(`${SSF_BASE}/shop/product_categories/ssf?page=${page}`);
    let found = 0;
    for (const match of html.matchAll(/href="(\/shop\/products\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g)) {
      found += 1;
      const text = decodeHtml(match[3]);
      if (isMadoka(text) && !cards.has(match[2])) cards.set(match[2], { id: match[2], text, url: `${SSF_BASE}${match[1]}` });
    }
    if (!found || !html.includes(`page=${page + 1}`)) break;
  }
  ctx.listed = cards.size;
  const out = [];
  for (const card of cards.values()) {
    const html = await fetchText(card.url);
    const text = pageText(html);
    const outline = text.slice(text.lastIndexOf("商品概要 商品名"));
    const field = (label) =>
      new RegExp(`${label}\\s+(.+?)\\s+(?:商品名|作品名|原型|彩色|仕様|サイズ|素材|販売元|発売元|お届け|購入特典|注意事項|$)`).exec(outline)?.[1] || "";
    const work = field("作品名") || /「([^」]*マギカ[^」]*)」/.exec(card.text)?.[1] || "魔法少女まどか☆マギカ";
    const spec = field("仕様");
    const images = [
      ...new Set(
        [...html.matchAll(/(https:\/\/[a-z0-9]+\.cloudfront\.net\/ecshibuyascrambl\/ec_assets\/[0-9a-f]+-original\.(?:jpg|png))/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    // "鹿目 まどか" + "1/7スケール PVC製…" → "魔法少女まどか☆マギカ 鹿目まどか 1/7スケールフィギュア"
    const name = (field("商品名") || card.text.replace(/^.*」\s*/, "").replace(/¥.*$/, "")).replace(/\s+/g, "").trim();
    const scale = /1\s*\/\s*\d+\s*スケール/.exec(spec)?.[0].replace(/\s+/g, "") || "";
    out.push({
      key: card.id,
      name: `魔法少女まどか☆マギカ ${name} ${scale}フィギュア`,
      work,
      line: "SHIBUYA SCRAMBLE FIGURE",
      spec,
      is_figure: true,
      url: card.url,
      image: images[0] || "",
      gallery: images,
      price_jpy: parseYen(/([\d,]+)\s*（税込）/.exec(card.text)?.[1]),
      release_date: releaseDateFrom(/お届け(?:期間|予定)?\s*(\d{4}年\s*\d{1,2}月)/.exec(text)?.[1] || ""),
      is_limited: true,
    });
  }
  return out;
}

// Prime 1 Studio: the Madoka series page only (robots.txt forbids query
// strings and the search).
const PRIME1_SERIES_URL = "https://www.prime1studio.co.jp/series/puellamagimadokamagica.html";

async function fetchPrime1(ctx) {
  const html = await fetchText(PRIME1_SERIES_URL);
  const urls = [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/www\.prime1studio\.co\.jp\/([a-z0-9-]+)\.html)"/g)]
        .filter((match) => /\d/.test(match[2]))
        .map((match) => match[1]),
    ),
  ];
  ctx.listed = urls.length;
  const out = [];
  for (const url of urls) {
    const page = await fetchText(url);
    const name = ogMeta(page, "title");
    if (!isMadoka(name)) {
      ctx.offWork.push(name);
      continue;
    }
    const text = pageText(page);
    out.push({
      key: url.match(/\/([a-z0-9-]+)\.html$/)[1],
      name,
      work: name,
      line: "Prime 1 Studio",
      is_figure: /完成品|スタチュー|フィギュア/.test(name),
      url,
      image: ogMeta(page, "image"),
      price_jpy: parseYen(/([\d,]{5,})\s*円/.exec(text)?.[1]),
      release_date: releaseDateFrom(/発売(?:予定|時期)?[^0-9]{0,6}(\d{4}年\s*\d{1,2}月)/.exec(text)?.[1] || ""),
      is_limited: /限定|ボーナス版/.test(name),
    });
  }
  return out;
}

// BANDAI SPIRITS product search: the figures and model kits that are neither
// prizes (bsp-prize.jp) nor 一番くじ (1kuji.com) — 30MP, Figuarts mini,
// Half Age Characters …
const BSPIRITS_BASE = "https://www.bandaispirits.co.jp";
const BSPIRITS_SEARCH_URL = `${BSPIRITS_BASE}/products/search/result.php`;

async function fetchBandaiSpirits(ctx) {
  const ids = new Map();
  // The search splits words: "まどか☆マギカ" finds less than "まどか" does.
  for (const query of ["まどか", "マギアレコード"]) {
    const html = await fetchText(`${BSPIRITS_SEARCH_URL}?freeword=${encodeURIComponent(query)}&dsp_cnt=60`);
    for (const match of html.matchAll(/detail\.php\?prd_id=([^&"]+)&(?:amp;)?grp_id=(\d+)/g)) {
      if (match[2] === "10000" || match[2] === "9999") continue; // prizes, 一番くじ
      ids.set(match[1], match[2]);
    }
  }
  ctx.listed = ids.size;
  const out = [];
  for (const [id, group] of ids) {
    const url = `${BSPIRITS_BASE}/products/search/detail.php?prd_id=${encodeURIComponent(id)}&grp_id=${group}`;
    const html = await fetchText(url);
    const name = ogMeta(html, "title");
    const text = pageText(html);
    if (!isMadoka(name, /作品名\s*(.{0,60})/.exec(text)?.[1] || "", /(?:魔法少女まどか☆マギカ|マギアレコード)[^ ]{0,30}/.exec(text)?.[0] || "")) {
      ctx.offWork.push(name);
      continue;
    }
    const images = [
      ...new Set(
        [...html.matchAll(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"/gi)]
          .map((match) => absolute(match[1], url))
          .filter((src) => !/\/assets\/img\//.test(src) && !/logo|icon|banner|btn_/i.test(src)),
      ),
    ];
    out.push({
      key: id,
      name: isMadoka(name) ? name : `魔法少女まどか☆マギカ ${name}`,
      work: "魔法少女まどか☆マギカ",
      line: "BANDAI SPIRITS",
      url,
      image: images[0] || "",
      gallery: images,
      price_jpy: parseYen(/([\d,]+)\s*円\s*[（(]税込/.exec(text)?.[1]),
      release_date: releaseDateFrom(/(\d{4}年\s*\d{1,2}月(?:\s*\d{1,2}日)?)/.exec(text)?.[1] || ""),
      is_limited: false,
    });
  }
  return out;
}

// ガシャポン (gashapon.jp): keyword search, about two years deep.
const GASHAPON_BASE = "https://gashapon.jp";

async function fetchGashapon(ctx) {
  const ids = new Set();
  for (const query of ["まどか☆マギカ", "マギアレコード"]) {
    const html = await fetchText(`${GASHAPON_BASE}/products/result.php?free=${encodeURIComponent(query)}`);
    for (const match of html.matchAll(/detail\.php\?jan_code=(\d+)/g)) ids.add(match[1]);
  }
  ctx.listed = ids.size;
  const out = [];
  for (const id of ids) {
    const url = `${GASHAPON_BASE}/products/detail.php?jan_code=${id}`;
    const html = await fetchText(url);
    const name = (ogMeta(html, "title") || decodeHtml(/<title>([^<]*)/.exec(html)?.[1] || "")).split(/[|｜]/)[0].trim();
    if (!isMadoka(name)) {
      ctx.offWork.push(name);
      continue;
    }
    const text = pageText(html);
    out.push({
      key: id,
      name,
      work: name,
      line: "ガシャポン",
      url,
      image: ogMeta(html, "image"),
      price_jpy: parseYen(/([\d,]+)\s*円/.exec(/価格[^円]{0,30}円/.exec(text)?.[0] || "")?.[1]),
      release_date: releaseDateFrom(/発売(?:日|時期|予定)?[^0-9]{0,6}(\d{4}年\s*\d{1,2}月)/.exec(text)?.[1] || ""),
      is_limited: false,
    });
  }
  return out;
}

// Retired official sites (とるナビ / prizebp.jp …), read once from the Wayback
// Machine by scripts/archive_madoka_wayback.mjs and committed. No network here.
const ARCHIVE_PATH = "data/madoka/archive-products.json";

async function fetchArchive(ctx) {
  let data;
  try {
    data = JSON.parse(await readFile(ARCHIVE_PATH, "utf8"));
  } catch {
    return [];
  }
  ctx.listed = data.products.length;
  return data.products.map((product) => ({ ...product, work: product.work || product.name }));
}

const SOURCES = [
  {
    source_id: "good_smile_madoka_en",
    idPrefix: "goodsmile-madoka",
    subline: "Good Smile Company",
    tags: ["madoka", "good smile"],
    fetchAll: fetchGoodSmileInfo,
    notes: "Imported from the Good Smile Company product database (goodsmile.info, Madoka keyword search).",
  },
  {
    source_id: "good_smile_madoka_global",
    idPrefix: "goodsmile-madoka",
    subline: "Good Smile Company",
    tags: ["madoka", "good smile"],
    fetchAll: fetchGoodSmileGlobal,
    notes: "Imported from the Good Smile Company official store (goodsmile.com, Madoka keyword search).",
  },
  {
    source_id: "tamashii_web_madoka_jp",
    idPrefix: "tamashii-madoka",
    subline: "魂ウェブ",
    tags: ["madoka", "tamashii", "bandai spirits"],
    fetchAll: fetchTamashii,
    notes: "Imported from the Tamashii Web catalog (魔法少女まどか☆マギカ character filter).",
  },
  {
    source_id: "kotobukiya_madoka_jp",
    idPrefix: "kotobukiya-madoka",
    subline: "寿屋",
    tags: ["madoka", "kotobukiya"],
    fetchAll: fetchKotobukiya,
    notes: "Imported from the Kotobukiya online shop (Madoka keyword search).",
  },
  {
    source_id: "banpresto_prize_madoka_jp",
    idPrefix: "banpresto-madoka",
    subline: "バンプレスト景品",
    tags: ["madoka", "banpresto", "prize"],
    fetchAll: fetchBanpresto,
    notes: "Imported from the Banpresto prize site (魔法少女まどか☆マギカ シリーズ title).",
  },
  {
    source_id: "ichiban_kuji_madoka_jp",
    idPrefix: "ichibankuji-madoka",
    subline: "一番くじ",
    tags: ["madoka", "ichiban kuji", "prize"],
    fetchAll: fetchIchibanKuji,
    notes: "Imported from the Ichiban Kuji official lineup (魔法少女まどか☆マギカ title filter).",
  },
  {
    source_id: "aniplex_plus_madoka_jp",
    idPrefix: "aniplex-madoka",
    subline: "Aniplex+",
    tags: ["madoka", "aniplex plus", "aniplex"],
    fetchAll: fetchAniplex,
    notes: "Imported from the Aniplex+ official store (Madoka keyword search).",
  },
  {
    source_id: "alter_madoka_jp",
    idPrefix: "alter-madoka",
    subline: "ALTER",
    tags: ["madoka", "alter"],
    fetchAll: fetchAlter,
    notes: "Imported from the ALTER official product catalog (alter-web.jp, Madoka keyword search).",
  },
  {
    source_id: "furyu_madoka_jp",
    idPrefix: "furyu-madoka",
    subline: "FuRyu",
    tags: ["madoka", "furyu"],
    fetchAll: fetchFuryuHobby,
    notes: "Imported from FuRyu's official hobby store (FURYU HOBBY MALL, F:NEX / TENITOL, Madoka tag).",
  },
  {
    source_id: "medicos_madoka_jp",
    idPrefix: "medicos-madoka",
    subline: "MEDICOS",
    tags: ["madoka", "medicos"],
    fetchAll: fetchMedicos,
    notes: "Imported from the MEDICOS ENTERTAINMENT product gallery (medicos-e.net, Madoka keyword search).",
  },
  {
    source_id: "taito_prize_madoka_jp",
    idPrefix: "taito-madoka",
    subline: "タイトープライズ",
    tags: ["madoka", "taito", "prize"],
    fetchAll: fetchTaitoPrize,
    notes: "Imported from the TAITO prize site (taito.co.jp, current lineup and original brand archives).",
  },
  {
    source_id: "sega_prize_madoka_jp",
    idPrefix: "sega-madoka",
    subline: "セガプライズ",
    tags: ["madoka", "sega", "prize"],
    fetchAll: fetchSegaPrize,
    notes: "Imported from the SEGA prize site (segaplaza.jp prize table, Madoka works).",
  },
  {
    source_id: "furyu_prize_madoka_jp",
    idPrefix: "furyuprize-madoka",
    subline: "フリュープライズ",
    tags: ["madoka", "furyu", "prize"],
    fetchAll: fetchFuryuPrize,
    notes: "Imported from the FuRyu prize site (furyuprize.com, Madoka keyword search).",
  },
  {
    source_id: "bandai_spirits_madoka_jp",
    idPrefix: "bspirits-madoka",
    subline: "BANDAI SPIRITS",
    tags: ["madoka", "bandai spirits"],
    fetchAll: fetchBandaiSpirits,
    notes: "Imported from the BANDAI SPIRITS product search (Madoka keyword; prizes and 一番くじ come from their own sites).",
  },
  {
    source_id: "claynel_madoka_jp",
    idPrefix: "claynel-madoka",
    subline: "クレーネル",
    tags: ["madoka", "claynel", "aniplex"],
    fetchAll: fetchClaynel,
    notes: "Imported from the Claynel official product list (claynel.jp, Madoka works).",
  },
  {
    source_id: "shibuya_scramble_madoka_jp",
    idPrefix: "ssf-madoka",
    subline: "SHIBUYA SCRAMBLE FIGURE",
    tags: ["madoka", "shibuya scramble figure", "estream"],
    fetchAll: fetchShibuyaScramble,
    notes: "Imported from the SHIBUYA SCRAMBLE FIGURE official store (eStream).",
  },
  {
    source_id: "prime1_madoka_jp",
    idPrefix: "prime1-madoka",
    subline: "Prime 1 Studio",
    tags: ["madoka", "prime 1 studio"],
    fetchAll: fetchPrime1,
    notes: "Imported from the Prime 1 Studio Madoka series page.",
  },
  {
    source_id: "megahouse_madoka_jp",
    idPrefix: "megahouse-madoka",
    subline: "MegaHouse",
    tags: ["madoka", "megahouse"],
    fetchAll: fetchMegaHouse,
    notes: "Imported from the MegaHouse hobby site (megahobby.jp, Madoka keyword search).",
  },
  {
    source_id: "bandai_candy_madoka_jp",
    idPrefix: "candy-madoka",
    subline: "バンダイ キャンディ",
    tags: ["madoka", "bandai candy", "shokugan"],
    fetchAll: fetchBandaiCandy,
    notes: "Imported from the Bandai Candy official site (食玩, Madoka keyword search).",
  },
  {
    source_id: "gashapon_madoka_jp",
    idPrefix: "gashapon-madoka",
    subline: "ガシャポン",
    tags: ["madoka", "gashapon", "bandai"],
    fetchAll: fetchGashapon,
    notes: "Imported from the Gashapon official site (gashapon.jp, Madoka keyword search).",
  },
  {
    source_id: "sk_japan_madoka_jp",
    idPrefix: "skjapan-madoka",
    subline: "SK JAPAN",
    tags: ["madoka", "sk japan", "prize"],
    fetchAll: fetchSkJapan,
    notes: "Imported from the SK JAPAN prize site (キャラとる, 魔法少女まどか☆マギカ page).",
  },
  {
    source_id: "movic_madoka_jp",
    idPrefix: "movic-madoka",
    subline: "ムービック",
    tags: ["madoka", "movic"],
    fetchAll: fetchMovic,
    notes: "Imported from the Movic official store (plush only, Madoka keyword search).",
  },
  {
    source_id: "banpresto_archive_madoka_jp",
    idPrefix: "prizebp-madoka",
    subline: "バンプレスト景品",
    tags: ["madoka", "banpresto", "prize", "archive"],
    fetchAll: fetchArchive,
    notes: "Banpresto prize from the retired とるナビ site (www.prizebp.jp), read through the Internet Archive's Wayback Machine.",
  },
];

function toKit(product, source, grade, index) {
  const id = slugify(product.key || product.name, String(index));
  const gallery = [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))];
  const image = gallery[0] || null;
  const gradeCode = grade.grade;
  const prizeNote = product.figure_prizes?.length ? ` Figure / plush prizes: ${product.figure_prizes.join(" / ")}.` : "";
  return {
    kit_id: `${source.idPrefix}-${id}`,
    franchise: FRANCHISE,
    grade_code: gradeCode,
    subline: grade.subline || product.line || source.subline,
    number: null,
    scale: scaleFor(`${product.name} ${product.spec || ""}`),
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: {
      box_art_url: image,
      box_art_source_id: image ? source.source_id : null,
    },
    gallery_image_urls: gallery,
    universe: UNIVERSE,
    work_title: workTitleFor(product),
    release_date: product.release_date || null,
    price_jpy: product.price_jpy ?? null,
    is_limited: Boolean(product.is_limited),
    data_status: "verified",
    source_urls: [product.url],
    source_refs: [
      {
        source_id: source.source_id,
        url: product.url,
        fields: ["names", "images", "grade_code", "release_date", "price_jpy", "work_title"],
        confidence: "high",
      },
    ],
    tags: [
      ...new Set(
        [...source.tags, gradeCode.toLowerCase(), grade.subline, product.maker].filter(Boolean).map((tag) => String(tag).toLowerCase()),
      ),
    ],
    notes: `${source.notes}${prizeNote}`,
  };
}

// ------------------------------------------------------- cross-source dedupe

// Store listings repeat the maker's product with the work in front and the
// scale behind ("劇場版 … ねんどろいど 暁美ほむら 晴着Ver." ⇔ "ねんどろいど 暁美ほむら
// 晴着Ver."). Two records of different sources are one product when core
// name, scale and grade agree and either the work or the price does too. The
// work / price condition is on purpose: "鹿目まどか" 1/8 exists for both the TV
// series (GSC, 2012) and マギアレコード (Phat!), while Aniplex+ files the 始まりの
// 物語 scale figures under 叛逆の物語 at the maker's exact price. Two records
// of one source are never merged (GSC has two 1/8 "暁美ほむら").
function coreKey(kit) {
  const core = nf(kit.names.ja)
    .replace(/劇場版|魔法少女まどか☆マギカ外伝|魔法少女まどか☆マギカ|まどか☆マギカ|マギアレコード|\[新編\]|［新編］|新編|叛逆の物語|ワルプルギスの廻天|〈|〉/g, " ")
    .replace(/(?<![\d/])1\s?\/\s?\d+/g, " ")
    .replace(/ノンスケールフィギュア|スケールフィギュア|完成品フィギュア|フィギュア|スケール|【[^】]*】|再生産|再販/g, " ")
    .replace(/[\s・·()（）［］[\]「」『』〔〕<>~～\-‐－—_/.,、。:：&＆!！?？'"“”+]/g, "")
    .toLowerCase();
  return `${core}|${kit.scale}|${kit.grade_code}`;
}

function sameProduct(a, b) {
  // A stored record that already absorbed this very page is the same product.
  const urlsA = new Set((a.source_refs || []).map((ref) => ref.url));
  if ((b.source_refs || []).length && b.source_refs.every((ref) => urlsA.has(ref.url))) return true;
  const sourcesA = new Set((a.source_refs || []).map((ref) => ref.source_id));
  if ((b.source_refs || []).some((ref) => sourcesA.has(ref.source_id))) return false;
  return a.work_title === b.work_title || (a.price_jpy != null && a.price_jpy === b.price_jpy);
}

function sourceRank(kit) {
  const id = kit.source_refs?.[0]?.source_id;
  const index = SOURCES.findIndex((source) => source.source_id === id);
  return index < 0 ? SOURCES.length : index;
}

function absorb(winner, loser) {
  winner.source_urls = [...new Set([...(winner.source_urls || []), ...(loser.source_urls || [])])];
  const refs = new Map((winner.source_refs || []).map((ref) => [`${ref.source_id} ${ref.url}`, ref]));
  for (const ref of loser.source_refs || []) refs.set(`${ref.source_id} ${ref.url}`, ref);
  winner.source_refs = [...refs.values()];
  if (winner.price_jpy == null && loser.price_jpy != null) winner.price_jpy = loser.price_jpy;
  if (!winner.release_date && loser.release_date) winner.release_date = loser.release_date;
  if (!winner.images?.box_art_url && loser.images?.box_art_url) winner.images = { ...loser.images };
  winner.gallery_image_urls = [...new Set([...(winner.gallery_image_urls || []), ...(loser.gallery_image_urls || [])])];
  winner.is_limited = Boolean(winner.is_limited || loser.is_limited);
  winner.tags = [...new Set([...(winner.tags || []), ...(loser.tags || [])])];
}

// New records that repeat another source's product fold into the higher
// ranked one. Records already in the catalog are never removed here (a saved
// collection may point at them); a pair of those is only reported.
function dedupe(imported, previousMadoka) {
  const importedIds = new Set(imported.map((kit) => kit.kit_id));
  const pool = [...imported, ...previousMadoka.filter((kit) => !importedIds.has(kit.kit_id))];
  const previousIds = new Set(previousMadoka.map((kit) => kit.kit_id));
  const groups = new Map();
  for (const kit of pool) {
    const key = coreKey(kit);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(kit);
  }
  const dropped = new Set();
  const merges = [];
  const folded = [];
  const kept = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Records already in the catalog come first, so a source that appears
    // later (goodsmile.com back from maintenance) is folded into the record
    // people already have instead of standing beside it; then source rank.
    group.sort((a, b) => Number(!previousIds.has(a.kit_id)) - Number(!previousIds.has(b.kit_id)) || sourceRank(a) - sourceRank(b));
    const winners = [];
    for (const kit of group) {
      const winner = winners.find((candidate) => sameProduct(candidate, kit));
      if (!winner) {
        winners.push(kit);
        continue;
      }
      if (previousIds.has(kit.kit_id)) {
        kept.push(`${kit.kit_id} ≈ ${winner.kit_id}`);
        winners.push(kit);
        continue;
      }
      absorb(winner, kit);
      dropped.add(kit.kit_id);
      folded.push({ from: kit.kit_id, to: winner.kit_id });
      merges.push(`${kit.kit_id} → ${winner.kit_id} (${winner.names.ja})`);
    }
  }
  // goodsmile.com lists the products goodsmile.info and Aniplex+ already have,
  // but without the work or (for action figures) the scale, and at today's
  // price, so the rule above cannot match them. A goodsmile.com record is the
  // product of the one other record with the same core name and grade.
  const coreName = (kit) => coreKey(kit).split("|")[0];
  const live = pool.filter((kit) => !dropped.has(kit.kit_id));
  for (const kit of live) {
    if (kit.source_refs?.[0]?.source_id !== "good_smile_madoka_global" || previousIds.has(kit.kit_id)) continue;
    const others = live.filter(
      (other) =>
        other !== kit &&
        !dropped.has(other.kit_id) &&
        other.grade_code === kit.grade_code &&
        coreName(other) === coreName(kit) &&
        !(other.source_refs || []).some((ref) => ref.source_id === "good_smile_madoka_global" && ref.url !== kit.source_refs[0].url),
    );
    if (others.length !== 1) continue;
    absorb(others[0], kit);
    dropped.add(kit.kit_id);
    folded.push({ from: kit.kit_id, to: others[0].kit_id });
    merges.push(`${kit.kit_id} → ${others[0].kit_id} (${others[0].names.ja}, goodsmile.com)`);
  }
  return { kits: imported.filter((kit) => !dropped.has(kit.kit_id)), merges, folded, kept };
}

// Possible duplicates left apart (same core name and scale across sources,
// different work and price); listed so a person can check them.
function nearDuplicates(kits) {
  const byCore = new Map();
  for (const kit of kits) {
    const [core, scale] = coreKey(kit).split("|");
    const key = `${core}|${scale}`;
    if (!byCore.has(key)) byCore.set(key, []);
    byCore.get(key).push(kit);
  }
  return [...byCore.values()]
    .filter((group) => group.length > 1 && new Set(group.map((kit) => kit.source_refs[0].source_id)).size > 1)
    .map((group) => group.map((kit) => `${kit.kit_id} [${kit.work_title}] ${kit.names.ja}`).join("  ≈  "));
}

function mergeCatalog(existingKits, importedKits) {
  const byId = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  for (const kit of importedKits) {
    const previous = byId.get(kit.kit_id);
    byId.set(kit.kit_id, previous ? { ...previous, ...kit } : kit);
  }
  return [...byId.values()].sort((a, b) => {
    const franchiseCompare = String(a.franchise).localeCompare(String(b.franchise));
    if (franchiseCompare) return franchiseCompare;
    return (
      String(b.release_date || "").localeCompare(String(a.release_date || "")) ||
      String(a.kit_id).localeCompare(String(b.kit_id))
    );
  });
}

// ------------------------------------------------------------------- main

async function runSource(source) {
  const ctx = { listed: 0, offWork: [], excluded: [], error: null, refused: null };
  const kits = [];
  try {
    const products = await source.fetchAll(ctx);
    const seen = new Set();
    products.forEach((product, index) => {
      if (!product.key || seen.has(product.key)) return;
      seen.add(product.key);
      const grade = product.force_grade ? { grade: product.force_grade } : classify(product, source.source_id);
      if (grade.exclude) {
        ctx.excluded.push({ kind: grade.exclude, name: product.name, url: product.url, reason: grade.reason || "goods" });
        return;
      }
      kits.push(toKit(product, source, grade, index));
    });
  } catch (error) {
    // One dead vendor never takes the run down; its previous records stay.
    if (error.refused) ctx.refused = error.message;
    else ctx.error = error.message;
    kits.length = 0;
  }
  return { source, ctx, kits };
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const previousMadoka = catalog.kits.filter((kit) => kit.franchise === FRANCHISE);
let retired = new Set();
let aliasDoc = null;
try {
  aliasDoc = JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8"));
  retired = retiredKitIds(aliasDoc);
} catch {
  // No alias file yet.
}

// Sources run side by side; each host still sees one request at a time.
// MADOKA_ONLY=a,b runs only those sources (for trying a vendor by hand).
const ONLY = new Set((process.env.MADOKA_ONLY || "").split(",").filter(Boolean));
const results = await Promise.all(SOURCES.filter((source) => !ONLY.size || ONLY.has(source.source_id)).map(runSource));
const fetchedAll = results.flatMap((result) => result.kits);
const imported = fetchedAll.filter((kit) => !retired.has(kit.kit_id));
const { kits: deduped, merges, folded, kept: keptPairs } = dedupe(imported, previousMadoka);
// A page folded away on an earlier run (now an alias) still lends its source ref, price
// and date to the record it went into, so the alias costs nothing on the next import.
{
  const byId = new Map([...previousMadoka, ...deduped].map((kit) => [kit.kit_id, kit]));
  for (const kit of fetchedAll) {
    const target = retired.has(kit.kit_id) ? byId.get(resolveAlias(aliasDoc?.aliases || {}, kit.kit_id)) : null;
    if (target && target !== kit) absorb(target, kit);
  }
}

const lines = [];
const reportJson = { generated_at: new Date().toISOString(), hosts: {}, sources: [], merges, kept_duplicate_pairs: keptPairs };
for (const [host, state] of hosts) reportJson.hosts[host] = { robots: state.robotsStatus, requests: state.requests, refused: state.refused };
const dedupedIds = new Set(deduped.map((kit) => kit.kit_id));
for (const { source, ctx, kits } of results) {
  const fetched = kits.filter((kit) => dedupedIds.has(kit.kit_id));
  const freshIds = new Set(kits.map((kit) => kit.kit_id));
  const keptPrevious = previousMadoka.filter(
    (kit) => kit.source_refs?.[0]?.source_id === source.source_id && !freshIds.has(kit.kit_id),
  ).length;
  const grades = {};
  for (const kit of fetched) grades[kit.grade_code] = (grades[kit.grade_code] || 0) + 1;
  const goods = ctx.excluded.filter((entry) => entry.kind === "goods").length;
  const uncertain = ctx.excluded.filter((entry) => entry.kind === "uncertain");
  const status = ctx.refused ? `refused (${ctx.refused})` : ctx.error ? `failed (${ctx.error})` : "ok";
  lines.push(
    `${source.source_id}: ${status}; listed ${ctx.listed}, fetched ${fetched.length}` +
      `${kits.length > fetched.length ? ` (+${kits.length - fetched.length} merged into other sources)` : ""}, kept ${keptPrevious}` +
      `, goods skipped ${goods}, uncertain ${uncertain.length}, other works ${ctx.offWork.length}` +
      `${Object.keys(grades).length ? ` — ${Object.entries(grades).map(([grade, count]) => `${grade} ${count}`).join(", ")}` : ""}`,
  );
  reportJson.sources.push({
    source_id: source.source_id,
    status,
    listed: ctx.listed,
    fetched: fetched.length,
    merged_away: kits.length - fetched.length,
    kept: keptPrevious,
    grades,
    excluded: ctx.excluded,
    other_works: ctx.offWork,
  });
}
reportJson.near_duplicates = nearDuplicates(deduped);

console.log("Madoka sources:");
for (const [host, state] of hosts) console.log(`  robots ${host}: ${state.robotsStatus}; ${state.requests} requests${state.refused ? `; refused: ${state.refused}` : ""}`);
for (const line of lines) console.log(`  ${line}`);
if (merges.length) console.log(`  merged ${merges.length} cross-source duplicates`);
if (keptPairs.length) console.log(`  ${keptPairs.length} duplicate pairs already in the catalog were kept: ${keptPairs.join("; ")}`);
if (REPORT_PATH) await writeFile(REPORT_PATH, `${JSON.stringify(reportJson, null, 2)}\n`, "utf8");

if (!deduped.length) {
  console.error("No Madoka products parsed from any source; leaving the catalog untouched.");
  process.exit(1);
}

const merged = mergeCatalog(catalog.kits, deduped);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
if (folded.length) {
  let firstSeen = {};
  try {
    firstSeen = JSON.parse(await readFile(FIRST_SEEN_PATH, "utf8")).dates || {};
  } catch {
    // No ledger yet: nothing was published.
  }
  const doc = aliasDoc || { schema: 1, updated_at: null, aliases: {}, excluded: {} };
  const added = aliasPublishedFolds(doc, folded, {
    published: (id) => Boolean(firstSeen[id]),
    liveIds: new Set(merged.map((kit) => kit.kit_id)),
  });
  if (added.length) {
    doc.updated_at = today();
    await writeFile(KIT_ALIASES_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    console.log(`  aliased ${added.length} published records that were folded: ${added.join("; ")}`);
  }
}
console.log(`Madoka: imported ${deduped.length} records; catalog now ${merged.filter((kit) => kit.franchise === FRANCHISE).length} Madoka records.`);
