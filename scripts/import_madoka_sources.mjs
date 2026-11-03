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
//   * バンプレスト景品     — bsp-prize.jp title IP00004703 (search listing)
//   * 寿屋                — shop.kotobukiya.co.jp keyword search (Shift-JIS)
//   * ホビーサーチ         — 1999.co.jp figure search (answers the bot with a
//                           Cloudflare challenge as of 2026-11; reported as refused)
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
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { scaleFor } from "./lib/fate-grades.mjs";

const CATALOG_PATH = "data/kits.json";
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

function absolute(href, base) {
  if (!href) return "";
  try {
    return new URL(href.startsWith("//") ? `https:${href}` : href, base).toString();
  } catch {
    return "";
  }
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

const PLUSH_PATTERN = /ぬいぐるみ|ちびぐるみ|Fluffy\s*Puffy|プラッシュ|Plush|もちころりん|ぬいもーじゅ|めちゃもふ|めちゃでか/i;
// Plush that is really a bag charm or a cushion: not a figure, but close
// enough to list as uncertain rather than drop silently.
const PLUSH_ACCESSORY = /チャーム|キーホルダー|ストラップ|ポーチ|バッグ|クッション|ケース|ポシェット|リュック|ペンケース/;
const NENDOROID_PATTERN = /ねんどろいど|ネンドロイド|Nendoroid/i;
const MINI_PATTERN =
  /Figuarts\s*mini|フィギュアーツ\s*mini|ぺたん娘|ぷちきゃら|トレーディングフィギュア|ちょこのせ|HELLO!\s*GOOD\s*SMILE|Q\s*posket|デフォルメ|きゅんキャラ|ソフビ|ソフトビニール|SOFT\s*VINYL|BE@RBRICK|るかっぷ|ワールドコレクタブル|ミニフィギュア|コレクションフィギュア|ガシャポン|カプセル|ガチャ|ぷちぴっと|minissimo|ころんぷてぃ|ちびっこ|ぴのこ|ぷちらま|ちょびるめ|ミニッチュ/i;
const ACTION_PATTERN = /figma|S\.H\.?\s*Figuarts|フィギュアーツ|Figuarts|BUZZmod|アクションフィギュア|可動フィギュア|キューポッシュ|ACT MODE|Pop Mart/i;
const PRIZE_PATTERN = /一番くじ|プライズ|景品|EVOLVE|Serenus\s*couture|ESPRESTO|GLITTER\s*&\s*GLAMOURS|Luminasta|TENITOL|SPM|ちょこのせプレミアム/i;
const SCALE_FIGURE_PATTERN =
  /(?<![\d/])1\s?\/\s?(3|4|5|6|7|8|10|12)(?![\d(（])|スケール|フィギュア|POP UP PARADE|完成品|日本人形|figFIX|スタチュー|Statue|ARTFX|美少女/i;

const PRIZE_SOURCES = new Set(["banpresto_prize_madoka_jp", "ichiban_kuji_madoka_jp"]);

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
  };
}

// Prize figure lines on 1kuji.com, plus plush. "着ぐるみキュゥべえ" (Magiccraft
// III) is a plush in costume but says so nowhere: it is reported as uncertain.
const KUJI_FIGURE_PRIZE =
  /フィギュア|MASTERLISE|Dioramique|SOFVICS|GLITTER|EXQ|きゅんキャラ|ぬいぐるみ|ちびぐるみ|ワールドコレクタブル|ワーコレ|ちょこのせ|デフォルメ|ソフビ|Q\s*posket|ぷちぴっと/i;
const KUJI_UNCERTAIN_PRIZE = /着ぐるみ|マスコット/;

async function fetchIchibanKuji(ctx) {
  const listed = parseIchibanKuji(await fetchText(KUJI_LIST_URL), KUJI_LIST_URL);
  ctx.listed = listed.length;
  const out = [];
  for (const kuji of listed) {
    if (!isMadoka(kuji.name)) {
      ctx.offWork.push(kuji.name);
      continue;
    }
    let detail = { prizes: [] };
    try {
      detail = parseKujiDetail(await fetchText(kuji.url));
    } catch (error) {
      if (error.refused) throw error;
      console.warn(`ichiban_kuji_madoka_jp detail ${kuji.key}: ${error.message}`);
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

function parseBanprestoDetail(html, id) {
  // Full-size pictures are linked from the gallery; the listing only has a
  // 250px thumbnail.
  const images = [
    ...new Set(
      [...html.matchAll(/href="(\/files\/[^"]+\.(?:jpg|jpeg|png))"/gi)]
        .map((match) => absolute(match[1], BSP_BASE))
        .filter((url) => url.includes(id)),
    ),
  ];
  return { images };
}

async function fetchBanpresto(ctx) {
  const html = await fetchText(BSP_LIST_URL);
  const listed = parseBanpresto(html, BSP_LIST_URL);
  ctx.listed = listed.length;
  const total = Number(/(\d+)\s*件あります/.exec(decodeHtml(html))?.[1] || 0);
  if (total > listed.length) console.warn(`banpresto_prize_madoka_jp: listing shows ${listed.length} of ${total} items`);
  const out = [];
  for (const product of listed) {
    if (!isMadoka(product.name)) {
      ctx.offWork.push(product.name);
      continue;
    }
    if (classify(product, "banpresto_prize_madoka_jp").exclude) {
      out.push(product);
      continue;
    }
    try {
      const detail = parseBanprestoDetail(await fetchText(product.url), product.key);
      if (detail.images.length) {
        // The item's own picture ("<id>a.jpg") first, then the group shots.
        detail.images.sort((a, b) => Number(!a.includes(`${product.key}a.`)) - Number(!b.includes(`${product.key}a.`)));
        product.image = detail.images[0];
        product.gallery = detail.images;
      }
    } catch (error) {
      if (error.refused) throw error;
      console.warn(`banpresto_prize_madoka_jp detail ${product.key}: ${error.message}`);
    }
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

// ------------------------------------------------------- ホビーサーチ (1999.co.jp)

// Carries the makers whose own sites are not reachable. As of 2026-11 every
// search answers this bot with a Cloudflare challenge (HTTP 403), so the
// source reports "refused"; the parser is the Fate importer's.
const HOBBY_SEARCH_BASE = "https://www.1999.co.jp";
const HOBBY_SEARCH_KEYWORDS = ["まどか☆マギカ", "マギアレコード"];

function parseHobbySearch(html) {
  const out = [];
  for (const chunk of String(html || "").split('<div class="c-product-list__item">').slice(1)) {
    const block = chunk.split("</div></div></div>")[0];
    const code = /ItemCode="(\d+)"/.exec(block)?.[1];
    const name = decodeHtml(/<div class="c-card__title">([\s\S]*?)<\/div>/.exec(block)?.[1] || "");
    if (!code || !name) continue;
    const image = /<img[^>]*src="([^"]*itbig[^"]*)"/i.exec(block)?.[1];
    out.push({
      key: code,
      name,
      series: "",
      line: "ホビーサーチ",
      url: `${HOBBY_SEARCH_BASE}/${code}`,
      image: image ? absolute(image, HOBBY_SEARCH_BASE) : "",
      price_jpy: parseYen(decodeHtml(/<div class="c-card__price-element">([\s\S]*?)<\/div>/.exec(block)?.[1] || "")),
      release_date: null,
      is_limited: /限定|特典/.test(name),
    });
  }
  return out;
}

async function fetchHobbySearch(ctx) {
  const byKey = new Map();
  for (const keyword of HOBBY_SEARCH_KEYWORDS) {
    for (let page = 1; page <= 12; page += 1) {
      const html = await fetchText(
        `${HOBBY_SEARCH_BASE}/search?typ1_c=101&cat=figure&sold=1&searchkey=${encodeURIComponent(keyword)}&spage=${page}`,
      );
      for (const product of parseHobbySearch(html)) byKey.set(product.key, product);
      if (html.split('<div class="c-product-list__item">').length - 1 < 60) break;
    }
  }
  ctx.listed = byKey.size;
  return [...byKey.values()].filter((product) => {
    if (isMadoka(product.name) || MADOKA_CHARACTER.test(nf(product.name))) return true;
    ctx.offWork.push(product.name);
    return false;
  });
}

// --------------------------------------------------------------------------

// Order is also the merge priority for the same product in two sources: the
// maker's own record wins over a store listing.
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
    source_id: "hobby_search_madoka_jp",
    idPrefix: "hobbysearch-madoka",
    subline: "ホビーサーチ",
    tags: ["madoka", "hobby search"],
    fetchAll: fetchHobbySearch,
    notes: "Imported from the Hobby Search figure listing (Madoka keyword search).",
  },
  {
    source_id: "aniplex_plus_madoka_jp",
    idPrefix: "aniplex-madoka",
    subline: "Aniplex+",
    tags: ["madoka", "aniplex plus", "aniplex"],
    fetchAll: fetchAniplex,
    notes: "Imported from the Aniplex+ official store (Madoka keyword search).",
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
  const kept = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Previous records rank first within a source rank so they are never the
    // one folded away.
    group.sort((a, b) => sourceRank(a) - sourceRank(b) || Number(!previousIds.has(a.kit_id)) - Number(!previousIds.has(b.kit_id)));
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
      merges.push(`${kit.kit_id} → ${winner.kit_id} (${winner.names.ja})`);
    }
  }
  return { kits: imported.filter((kit) => !dropped.has(kit.kit_id)), merges, kept };
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
try {
  retired = retiredKitIds(JSON.parse(await readFile(KIT_ALIASES_PATH, "utf8")));
} catch {
  // No alias file yet.
}

// Sources run side by side; each host still sees one request at a time.
const results = await Promise.all(SOURCES.map(runSource));
const imported = results.flatMap((result) => result.kits).filter((kit) => !retired.has(kit.kit_id));
const { kits: deduped, merges, kept: keptPairs } = dedupe(imported, previousMadoka);

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
console.log(`Madoka: imported ${deduped.length} records; catalog now ${merged.filter((kit) => kit.franchise === FRANCHISE).length} Madoka records.`);
