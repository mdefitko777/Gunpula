import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  decodeKotobukiyaShopHtml,
  KOTOBUKIYA_AC_PORTAL_URL,
  KOTOBUKIYA_AC_SHOP_URL,
  parseKotobukiyaShopDetail,
  parseKotobukiyaShopListings,
} from "./lib/kotobukiya-shop.mjs";
import { KIT_ALIASES_PATH, carryCleanupFields, gundamGradeFromName, nfkc, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import { buildSpeciesIndex, pokeplaIdentity, pokeplaNames, pokeplaSpeciesKey, pokeplaSubline } from "./lib/pokepla.mjs";
import { readSalePages, salePageFromKit, seoulToday, upsertSalePage, writeSalePages } from "./lib/sale-pages.mjs";
import { extractTamashiiGalleryImages } from "./lib/tamashii-images.mjs";

const CANDY_BASE_URL = "https://www.bandai.co.jp";
const GASHAPON_BASE_URL = "https://gashapon.jp";
const CANDY_SOURCE_ID = "bandai_candy_gundam_jp";
const GASHAPON_SOURCE_ID = "bandai_gashapon_gundam_jp";
const GASHAPON_PRODUCTS_SOURCE_ID = "bandai_gashapon_products_jp";
const POKEMON_HOBBY_SOURCE_ID = "bandai_hobby_pokemon_satellite";
const POKEPLA_SOURCE_ID = "bandai_spirits_pokepla_jp";
const KOTOBUKIYA_AC_SOURCE_ID = "kotobukiya_armored_core_jp";
const BANDAI_SPIRITS_SOURCE_ID = "bandai_spirits_products_jp";
const TAMASHII_SOURCE_ID = "tamashii_web_jp";
const TAKARA_TOMY_BEYBLADE_X_SOURCE_ID = "takara_tomy_beyblade_x_jp";

const POKEMON_MODEL_KIT_URL = "https://satellite.bandai-hobby.net/characters/pokemon.php";
// Official BANDAI SPIRITS product search: プラモデル category, keyword ポケモン,
// newest first, 60 a page (the largest page size the form offers). See
// scripts/lib/pokepla.mjs for why this replaced global.bandai-hobby.net.
const POKEPLA_SEARCH_URL =
  "https://www.bandaispirits.co.jp/products/search/result.php?freeword=%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3&category=2&dsp_cnt=60&sort=salesdate&order=desc";
const POKEPLA_PAGE_SIZE = 60;
const POKEPLA_MAX_PAGES = 6;
// One request at a time to bandaispirits.co.jp, a little over a second apart.
const POKEPLA_REQUEST_GAP_MS = 1100;
// Detail pages only add the gallery, so they are read for new products and for
// records that have no BANDAI SPIRITS gallery yet.
const POKEPLA_DETAIL_BUDGET = Number(process.env.POKEPLA_DETAIL_BUDGET || 120);
const BANDAI_AC_SEARCH_URL = "https://www.bandaispirits.co.jp/products/search/result.php?freeword=ARMORED%20CORE&category=2";
const TAMASHII_BASE_URL = "https://tamashiiweb.com";
const BEYBLADE_X_LINEUP_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";

const CANDY_BRANDS = [
  { code: "CONVERGE", slug: "converge", label: "FW GUNDAM CONVERGE" },
  { code: "GFRAME", slug: "gframe", label: "Mobile Suit Gundam G Frame FA" },
  { code: "MOBILITY", slug: "mobilityJoint", label: "MOBILITY JOINT GUNDAM" },
  { code: "ARTIFACT", slug: "artifact", label: "Gundam Artifact" },
  { code: "SUPERIOR", slug: "superiordefine", label: "Gundam Superior Define" },
];

// Every Tamashii brand with a Gundam item is read through one characterCode
// query per sales area. Until 2026-11 only four brands in the japan area were
// read, so GFF METAL COMPOSITE, GUNDAM UNIVERSE, NXEDGE STYLE, SDX, 超合金,
// METAL STRUCTURE … (about 240 items) and the Gundam Base / overseas-event
// ROBOT魂 that are only listed in the asia area never reached the catalog.
const TAMASHII_AREAS = ["japan", "asia", "usa"];
const TAMASHII_BRAND_GRADES = [
  [/^METAL BUILD/i, "METAL_BUILD"],
  [/^METAL ROBOT魂/i, "METAL_ROBOT"],
  [/^ROBOT魂/i, "ROBOT_SPIRITS"],
  [/^S\.H\.Figuarts/i, "SH_FIGUARTS"],
  [/^Figuarts mini/i, "FIGUARTS_MINI"],
  [/^GUNDAM FIX FIGURATION/i, "GFF"],
  [/^GUNDAM UNIVERSE/i, "GUNDAM_UNIVERSE"],
  [/^NXEDGE STYLE/i, "NXEDGE"],
  [/^SDX$/i, "SDX"],
  [/^元祖SDガンダムワールド/, "GANSO_SD"],
  [/^METAL STRUCTURE/i, "METAL_STRUCTURE"],
  [/超合金/, "CHOGOKIN"],
];
// Display stands, not figures.
const TAMASHII_SKIP_BRANDS = /^魂STAGE$/;
// Lines whose item titles are only a character or series name, so two different
// products share one title ("Figuarts mini キラ・ヤマト" 2024 and 2026).
const TAMASHII_GENERIC_TITLE_BRANDS = /^(?:Figuarts mini|超合金の塊)$/;
// Detail pages are fetched one at a time, about one a second, and only for items
// the catalog does not have yet (or has without images/price/date).
const TAMASHII_DETAIL_BUDGET = Number(process.env.TAMASHII_DETAIL_BUDGET || 300);
const TAMASHII_DETAIL_GAP_MS = 1100;
// Detail pages re-read each day even when nothing in the listing changed, so a
// moved release day or a corrected price on the detail page is picked up within
// about a month (1,000+ records / 40 a day).
const TAMASHII_DETAIL_REFRESH_PER_DAY = Number(process.env.TAMASHII_DETAIL_REFRESH || 40);
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";

const HTML_ENTITY_MAP = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  nu: "ν",
  xi: "Ξ",
  zeta: "Ζ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  times: "×",
};

const WORK_RULES = [
  { title: "Mobile Suit Gundam SEED Freedom", universe: "CE", pattern: /ライジングフリーダム|イモータルジャスティス|マイティーストライクフリーダム|ブラックナイトスコード|ゲルググメナース|ギャンシュトローム|デスティニーガンダムSpecII|SEED FREEDOM/i },
  { title: "Mobile Suit Gundam SEED C.E.73 Stargazer", universe: "CE", pattern: /スターゲイザー|ストライクノワール|ヴェルデバスター|ブルデュエル|ドレッドノート|105ダガー|スローターダガー|ケルベロスバクゥ|ストライクE/i },
  { title: "Mobile Suit Gundam SEED Destiny", universe: "CE", pattern: /デスティニー|インパルス|ストライクフリーダム|インフィニットジャスティス|セイバーガンダム|ガイアガンダム|アビスガンダム|カオスガンダム|レジェンドガンダム|アカツキ|ムラサメ|ウィンダム|DESTINY/i },
  { title: "Mobile Suit Gundam SEED Astray", universe: "CE", pattern: /アストレイ|ASTRAY|レッドフレーム|ブルーフレーム|ゴールドフレーム/i },
  { title: "Mobile Suit Gundam SEED", universe: "CE", pattern: /エールストライク|ストライクガンダム|ストライクルージュ|イージス|デュエル|バスター|ブリッツ|フリーダムガンダム|ジャスティスガンダム|プロヴィデンス|カラミティ|フォビドゥン|レイダー|ラゴゥ|バクゥ|シグー|モビルジン|ゲイツ|SEED/i },
  { title: "Mobile Suit Gundam 00", universe: "AD", pattern: /ダブルオー|ガンダム00(?![0-9])|00クアンタ|クアンタ|エクシア|デュナメス|キュリオス|ヴァーチェ|ナドレ|アストレア|ケルディム|アリオス|セラヴィー|セラフィム|オーライザー|ジンクス|ティエレン|スサノオ|フラッグ|スローネ|アルケー|アヘッド|ガデッサ|ガラッゾ|リボーンズ|ブレイヴ/i },
  { title: "Mobile Suit Gundam: The Witch from Mercury", universe: "Ad Stella", pattern: /水星の魔女|エアリアル|ルブリス|キャリバーン|ファラクト|ディランザ|デミ|ベギル|ミカエリス|シュバルゼッテ|ガンヴォルヴァ|ザウォート|ダリルバルデ/i },
  { title: "Mobile Suit Gundam GQuuuuuuX", universe: "unknown", pattern: /GQuuuuuuX|ジークアクス|白いガンダム|赤いガンダム|軽キャノン|GFreD/i },
  { title: "Mobile Suit Gundam: Iron-Blooded Orphans", universe: "Post Disaster", pattern: /鉄血|バルバトス|グシオン|キマリス|グレイズ|フラウロス|バエル|ヴィダール|百里|百錬|マンロディ|ロディ|マルコシアス|アスタロト|ダンタリオン|レギンレイズ|グリムゲルデ/i },
  { title: "Mobile Suit Gundam AGE", universe: "AG", pattern: /ガンダムAGE|AGE-|ガフラン|ゼダス|Gエグゼス|ジェノアス|ダナジン|レギルス|ギラーガ|ゼイドラ|ファルシア|クランシェ|アデル/i },
  { title: "Mobile Suit Gundam Wing Endless Waltz", universe: "AC", pattern: /Endless Waltz|\bEW\b|ウイングガンダムゼロ|Wガンダムゼロ|デスサイズヘル|サーペント/i },
  { title: "Mobile Suit Gundam Wing G-Unit", universe: "AC", pattern: /ガンダムジェミナス|G-UNIT/i },
  { title: "Mobile Suit Gundam Wing", universe: "AC", pattern: /ウイングガンダム|デスサイズ|ヘビーアームズ|サンドロック|シェンロン|アルトロンガンダム|トールギス|エピオン|リーオー|マグアナック|ヴァイエイト|メリクリウス|エアリーズ/i },
  { title: "Mobile Fighter G Gundam", universe: "FC", pattern: /Gガンダム|ゴッドガンダム|シャイニングガンダム|マスターガンダム|ノーベルガンダム|ドラゴンガンダム|ガンダムローズ|マックスター|デビルガンダム|風雲再起/i },
  { title: "After War Gundam X", universe: "AW", pattern: /ガンダムX|ガンダムダブルエックス|エアマスター|レオパルド|ベルティゴ|ヴァサーゴ|Gファルコン/i },
  { title: "Turn A Gundam", universe: "CC", pattern: /∀|ターンエー|ターンX|スモー|カプル/i },
  { title: "Gundam Reconguista in G", universe: "Regild Century", pattern: /Gのレコンギスタ|G-セルフ|G-アルケイン|G-ルシファー|グリモア|マックナイフ|ジャハナム|カバカーリー/i },
  { title: "Gundam Build Series", universe: "Build", pattern: /ビルド|ダイバー|コアガンダム|アースリィ|ユーラヴェン|ベアッガイ|プチッガイ|ふみな|トライオン|アメイジング|フェニーチェ|スクランブル|ラーガンダム|プルタイン|ティフォエウス/i },
  { title: "Advance of Zeta", universe: "UC", pattern: /A\.O\.Z|TR-1|TR-6|ヘイズル|ウーンドウォート|ハイゼンスレイ|フルドド/i },
  { title: "Mobile Suit Gundam Narrative", universe: "UC", pattern: /ナラティブガンダム|ガンダムNT(?!-?1)/i },
  { title: "Mobile Suit Moon Gundam", universe: "UC", pattern: /ムーンガンダム|バルギル/i },
  { title: "Gundam Sentinel", universe: "UC", pattern: /Sガンダム|Ex-S|FAZZ|Zプラス|ゼータプラス|ディープストライカー|ガンダムMk-V|ゼク・アイン|ネロ/i },
  { title: "Mobile Suit Crossbone Gundam", universe: "UC", pattern: /クロスボーン|ゴーストガンダム|ファントムガンダム|アンカーガンダム|鋼鉄の7人/i },
  { title: "Mobile Suit Gundam Hathaway", universe: "UC", pattern: /閃光のハサウェイ|Ξガンダム|クスィーガンダム|ペーネロペー|メッサー/i },
  { title: "Gundam Thunderbolt", universe: "UC", pattern: /サンダーボルト|フルアーマー・ガンダム|サイコ・ザク|アトラスガンダム/i },
  { title: "Mobile Suit Gundam: The Origin", universe: "UC", pattern: /THE ORIGIN|オリジン|局地型ガンダム|ブグ/i },
  { title: "Mobile Suit Gundam Unicorn", universe: "UC", pattern: /ユニコーン|バンシィ|フェネクス|シナンジュ|クシャトリヤ|ジェスタ|リゼル|デルタプラス|デルタガンダム|シルヴァ・バレト|ローゼン・ズール|ギラ・ズール|ネェル・アーガマ|バイアラン・カスタム/i },
  { title: "Mobile Suit Gundam: Char's Counterattack", universe: "UC", pattern: /逆襲のシャア|ベルトーチカ・チルドレン|νガンダム|Hi-ν|サザビー|ナイチンゲール|サイコ・ドーガ|ヤクト・ドーガ|ギラ・ドーガ|α・アジール|リ・ガズィ|ジェガン/i },
  { title: "Mobile Suit Gundam F91", universe: "UC", pattern: /F91|ビギナ・ギナ|デナン|ベルガ|ヘビーガン/i },
  { title: "Mobile Suit V Gundam", universe: "UC", pattern: /Vガンダム|Ｖダッシュ|Vダッシュ|ヴィクトリー|V2|セカンドV|ガンイージ/i },
  { title: "Mobile Suit Gundam 0083: Stardust Memory", universe: "UC", pattern: /0083|GP01|GP02|GP03|ガーベラ|デンドロビウム|ステイメン|ノイエ・ジール|ドラッツェ|ザメル/i },
  { title: "Mobile Suit Gundam 0080: War in the Pocket", universe: "UC", pattern: /0080|アレックス|NT-1|ケンプファー|ハイゴッグ|ズゴックE|ザクII改/i },
  { title: "Mobile Suit Gundam: The 08th MS Team", universe: "UC", pattern: /08小隊|Ez-8|陸戦型|グフカスタム/i },
  { title: "Mobile Suit Gundam ZZ", universe: "UC", pattern: /ZZ|ダブルゼータ|ゲーマルク|ゲー・ドライ|ハンマ・ハンマ|キュベレイ|ドーベン・ウルフ|ザクIII|バウ|クィン・マンサ|ドライセン|ズサ/i },
  { title: "Mobile Suit Z Gundam", universe: "UC", pattern: /Zガンダム|Ζ|ゼータガンダム|ZII|スーパーガンダム|Gディフェンサー|ガンダムMk-II|ボリノーク・サマーン|百式|リック・ディアス|メタス|ネモ|ハイザック|マラサイ|バーザム|アッシマー|ギャプラン|ジ・O|ディジェ|ガルバルディ/i },
  { title: "Mobile Suit Gundam Side Story: The Blue Destiny", universe: "UC", pattern: /ブルーディスティニー|イフリート改/i },
  { title: "Gundam EXA", universe: "unknown", pattern: /エクストリームガンダム|type-レオス/i },
  { title: "Mobile Suit Gundam MSV", universe: "UC", pattern: /G-3ガンダム|フルアーマーガンダム|パーフェクトガンダム|ジョニー・ライデン|シン・マツナガ|高機動型ザク/i },
  { title: "Mobile Suit Gundam", universe: "UC", pattern: /RX-78|ガンダム\(アニメカラー|ガンダム\(ロールアウト|ガンダム\(ハードポイント|ガンダム Ver\.|＜SIDE MS＞\s*ガンダム$|Gファイター|ホワイトベース|マゼラ・アタック|ガンキャノン|ガンタンク|シャア専用|ザク|グフ|ドム|ズゴック|ゲルググ|ジオング|アッガイ|ゾック|ギャン|ジム|ボール|ララァ専用/i },
  { title: "SD Gundam", universe: "SD", pattern: /SD|BB戦士|武者|頑駄無|騎士ガンダム|ナイトガンダム|サタンガンダム|コマンドガンダム|関羽ガンダム|孫権ガンダム|曹操ガンダム|劉備ガンダム|三国創傑伝|フェニックスガンダム/i },
];

const SKIP_INDIVIDUAL_ITEM_PATTERN = /台座セット|スタンドセット/i;

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => HTML_ENTITY_MAP[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "));
}

function extract(regex, text) {
  const match = regex.exec(text);
  return match ? match[1] : null;
}

function absoluteUrl(value, baseUrl) {
  return new URL(value, baseUrl).href;
}

function parseReleaseDate(value) {
  const text = stripTags(value);
  const dotted = /(\d{4})[./](\d{1,2})(?:[./](\d{1,2}))?/.exec(text);
  if (dotted) {
    return [dotted[1], dotted[2].padStart(2, "0"), dotted[3]?.padStart(2, "0")].filter(Boolean).join("-");
  }

  const yearMonth = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(text);
  if (yearMonth) {
    return [yearMonth[1], yearMonth[2].padStart(2, "0"), yearMonth[3]?.padStart(2, "0")].filter(Boolean).join("-");
  }

  return null;
}

function parsePrice(value) {
  const text = stripTags(value);
  const yen = /[￥¥]?\s*([\d,]+)\s*円/.exec(text) || /[￥¥]\s*([\d,]+)/.exec(text);
  const jpy = /JPY\s*([\d,]+)/i.exec(text);
  const englishYen = /([\d,]+)\s*Yen/i.exec(text);
  const price = yen || jpy || englishYen;
  return price ? Number(price[1].replace(/,/g, "")) : null;
}

function slugify(value, fallback = "item") {
  const ascii = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56)
    .replace(/-+$/g, "");
  return ascii || fallback;
}

function inferWork(...values) {
  const title = values.filter(Boolean).join(" ");
  for (const rule of WORK_RULES) {
    if (rule.pattern.test(title)) {
      return { work_title: rule.title, universe: rule.universe };
    }
  }
  return { work_title: null, universe: null };
}

function fallbackWork(title, gradeCode, subline) {
  const text = [title, subline].filter(Boolean).join(" ");
  if (/武器セット|武装セット|オプション|パーツセット|バックパックセット|台座|スタンド|ファンネル|シルエット/i.test(text)) {
    return { work_title: "Accessory / Option Set", universe: "Accessory" };
  }
  if (
    ["CONVERGE", "GFRAME", "MOBILITY", "ARTIFACT", "SUPERIOR", "MSE", "GSF", "METAL_BUILD", "METAL_ROBOT", "ROBOT_SPIRITS"].includes(gradeCode) &&
    /#|＃|♯|VOL\.?|No\.|第\d|SELECTION|MEMORIAL|OPERATION|REVIVE|SET|セット|GOLD EDITION|Ver\.GFT|SP\d*|EX\d*|Gフレーム\s*\d+|GフレームFA\s*\d+|CONVERGE\s*\d+|[ 　]\d{1,2}(?:[ 　]|$)/i.test(text)
  ) {
    return { work_title: "Mixed Gundam Works", universe: "Mixed" };
  }
  return { work_title: null, universe: null };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function candySubline(title, brand) {
  if (brand.code === "CONVERGE") {
    if (/CORE/i.test(title)) return "FW GUNDAM CONVERGE CORE";
    if (/\bSB\b/i.test(title)) return "FW GUNDAM CONVERGE SB";
    if (/\bSP\b/i.test(title)) return "FW GUNDAM CONVERGE SP";
    if (/#|♯/.test(title)) return "FW GUNDAM CONVERGE #";
  }
  return brand.label;
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": BOT_UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ja,en-US;q=0.8,en;q=0.7",
        },
      });
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * (String(lastError?.message ?? "").includes("403") ? 2200 : 600));
  }
  throw lastError;
}

// BEYBLADE X pages (and, until 2026-11, Bandai Hobby Global). Until 2026-11 this sent a
// Chrome user-agent and a made-up referer; every source now gets the same
// plain, self-identifying request (a failed source keeps its previous data).
async function fetchBrowserText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": BOT_UA,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        },
      });
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * (String(lastError?.message ?? "").includes("403") ? 2200 : 600));
  }
  throw lastError;
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": BOT_UA,
          accept: "application/json",
          "accept-language": "ja,en-US;q=0.8,en;q=0.7",
        },
      });
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * 600);
  }
  throw lastError;
}

async function fetchTamashiiDetailText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      // A plain, self-identifying request: no browser user-agent, no forged referer.
      const response = await fetch(url, {
        headers: {
          "user-agent": BOT_UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ja,en-US;q=0.8,en;q=0.7",
        },
      });
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * (String(lastError?.message ?? "").includes("403") ? 5000 : 1000));
  }
  throw lastError;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function parseCandyListings(html, listingUrl, brand) {
  const records = [];
  const seen = new Set();
  const anchorPattern = /<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(anchorPattern)) {
    const url = absoluteUrl(match[1], listingUrl);
    const path = new URL(url).pathname;
    const brandPath = `/candy/gundam/${brand.slug}/`;
    const block = match[2];

    if (!path.startsWith(brandPath) || path === brandPath || seen.has(url) || !/title fontBold/.test(block)) {
      continue;
    }

    const titleBlock = extract(/<p class="title fontBold">([\s\S]*?)<\/p>/, block);
    const title = stripTags(extract(/<span class="textJp">([\s\S]*?)<\/span>/, titleBlock ?? "") ?? titleBlock);
    const image = extract(/<img src="([^"]+)"/, block);
    if (!title || !image) {
      continue;
    }

    seen.add(url);
    records.push({
      url,
      path,
      title,
      image_url: absoluteUrl(image, listingUrl),
      release_date: parseReleaseDate(extract(/tagDate[^>]*>([^<]+)</, block)),
      is_limited: /限定|PB|プレミアムバンダイ/.test(block) || /限定|プレミアムバンダイ/.test(title),
    });
  }
  return records;
}

function parseCandyDetail(html, detailUrl) {
  const imageBlock = extract(/<article class="itemImagesBlock[\s\S]*?>([\s\S]*?)<article class="itemSpecBlock">/, html) ?? "";
  const specBlock = extract(/<article class="itemSpecBlock">([\s\S]*?)<article class="itemInfoBlock/, html) ?? html;
  const images = unique([...imageBlock.matchAll(/<img src="([^"]+)"/g)].map((match) => absoluteUrl(match[1], detailUrl)));

  return {
    images,
    price_jpy: parsePrice(extract(/<p class="itemPrice">([\s\S]*?)<\/p>/, specBlock)),
    release_date: parseReleaseDate(extract(/<p class="itemRelease">([\s\S]*?)<\/p>/, specBlock)),
  };
}

function sameImageDirectory(url, referenceUrl) {
  const path = new URL(url).pathname;
  const referencePath = new URL(referenceUrl).pathname;
  const referenceDir = referencePath.slice(0, referencePath.lastIndexOf("/") + 1);
  return path.startsWith(referenceDir);
}

function parseGashaponProductDetail(html) {
  const images = unique([...html.matchAll(/<img[^>]+src="(https:\/\/bandai-a\.akamaihd\.net\/bc\/img\/model\/xl\/[^"]+)"/g)].map((match) => match[1]));
  const releaseDate = parseReleaseDate(extract(/<dd class="pg-detailDefinition__detail --releaseDate">([\s\S]*?)<\/dd>/, html));
  let priceJpy = null;

  for (const block of html.matchAll(/<dl class="pg-detailDefinition">([\s\S]*?)<\/dl>/g)) {
    const label = stripTags(extract(/<dt[^>]*>([\s\S]*?)<\/dt>/, block[1]));
    const value = stripTags(extract(/<dd[^>]*>([\s\S]*?)<\/dd>/, block[1]));
    if (/価格|値段|価\s*格/.test(label)) {
      priceJpy = parsePrice(value);
    }
  }

  return { images, release_date: releaseDate, price_jpy: priceJpy };
}

function buildKit({
  kitId,
  franchise = "gundam",
  gradeCode,
  subline,
  title,
  names = {},
  boxArtUrl,
  galleryUrls,
  releaseDate,
  priceJpy,
  isLimited,
  sourceId,
  sourceUrls,
  tags,
  notes,
  workContext = [],
  workOverride = null,
  universeOverride = null,
  scale = "non-scale",
}) {
  const inferredWork = inferWork(title, ...workContext);
  const work =
    workOverride || universeOverride
      ? { work_title: workOverride, universe: universeOverride }
      : inferredWork.work_title
        ? inferredWork
        : fallbackWork(title, gradeCode, subline);
  return {
    kit_id: kitId,
    franchise,
    grade_code: gradeCode,
    subline,
    number: null,
    scale,
    names: {
      ja: Object.hasOwn(names, "ja") ? names.ja : title,
      en: names.en ?? null,
      zh: names.zh ?? null,
      ko: names.ko ?? null,
    },
    images: {
      box_art_url: boxArtUrl,
      box_art_source_id: boxArtUrl ? sourceId : null,
    },
    gallery_image_urls: unique(galleryUrls),
    universe: work.universe,
    work_title: work.work_title,
    release_date: releaseDate,
    price_jpy: priceJpy,
    is_limited: Boolean(isLimited),
    data_status: "needs_review",
    source_urls: unique(sourceUrls),
    source_refs: [
      {
        source_id: sourceId,
        url: sourceUrls[0] ?? null,
        fields: ["franchise", "names", "grade_code", "subline", "scale", "release_date", "price_jpy", "images", "gallery_image_urls", "work_title", "universe"],
        confidence: "high",
      },
    ],
    tags,
    notes,
  };
}

function parseEnglishMonthRelease(value) {
  const match = /(\d{4})\s*\/\s*([A-Za-z]{3,})/.exec(String(value ?? ""));
  if (!match) {
    return parseReleaseDate(value);
  }

  const months = new Map(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map((month, index) => [month, String(index + 1).padStart(2, "0")]),
  );
  const month = months.get(match[2].slice(0, 3).toLowerCase());
  return month ? `${match[1]}-${month}` : match[1];
}

function parsePokemonModelKitListings(html, pageUrl) {
  const galleryByGroup = new Map();
  for (const match of html.matchAll(/href="([^"]+)"\s+data-fancybox="([^"]+)"/g)) {
    const url = absoluteUrl(match[1], pageUrl);
    const group = match[2];
    galleryByGroup.set(group, unique([...(galleryByGroup.get(group) ?? []), url]));
  }

  const records = [];
  const itemPattern = /<a class="item scrollA" href="([^"]+)" data-fancybox="([^"]+)" data-caption="([^"]+)"[\s\S]*?<p class="summary">([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(itemPattern)) {
    const group = match[2];
    const title = stripTags(match[3]);
    const summary = match[4];
    const releaseText = stripTags(extract(/<span class="release">([\s\S]*?)<\/span>/, summary));
    const priceText = stripTags(extract(/<span class="price">([\s\S]*?)<\/span>/, summary));
    const images = galleryByGroup.get(group) ?? [absoluteUrl(match[1], pageUrl)];

    if (!title || !images.length) {
      continue;
    }

    records.push({
      title,
      images,
      release_date: parseEnglishMonthRelease(releaseText),
      price_jpy: parsePrice(priceText),
    });
  }

  return records;
}

async function importPokemonModelKits() {
  const html = await fetchText(POKEMON_MODEL_KIT_URL);
  const listings = parsePokemonModelKitListings(html, POKEMON_MODEL_KIT_URL);
  console.log(`Found ${listings.length} Pokemon Model Kit listings.`);

  return listings.map((listing, index) =>
    buildKit({
      kitId: `pokepla-${String(index + 1).padStart(2, "0")}-${slugify(listing.title, "pokemon")}`,
      franchise: "pokemon",
      gradeCode: "POKEPLA",
      subline: /^Pokémon Model Kit Quick!!/i.test(listing.title) ? "Pokemon Model Kit Quick!!" : "Pokemon Model Kit",
      title: listing.title,
      names: { ja: null, en: listing.title, zh: null, ko: null },
      boxArtUrl: listing.images[0],
      galleryUrls: listing.images,
      releaseDate: listing.release_date,
      priceJpy: listing.price_jpy,
      isLimited: false,
      sourceId: POKEMON_HOBBY_SOURCE_ID,
      sourceUrls: [POKEMON_MODEL_KIT_URL],
      tags: ["pokemon", "bandai hobby", "plastic model", "pokepla"],
      notes: "Imported from the official Bandai Hobby Site Satellite Pokemon Model Kit page.",
      workOverride: "Pokemon",
      universeOverride: "Pokemon",
    }),
  );
}

function bandaiSpiritsHitCount(html) {
  const count = /m_resultData__text"><span class="s_num">([\d,]+)<\/span>/.exec(html)?.[1];
  return count ? Number(count.replace(/,/g, "")) : null;
}

function bandaiSpiritsProductId(url) {
  return /prd_id=(\d+)/.exec(String(url ?? ""))?.[1] ?? null;
}

// prd_id is the JAN code followed by three zeros (4573102742957000).
function pokeplaKitId(productId) {
  return `pokepla-jp-${productId.length === 16 && productId.endsWith("000") ? productId.slice(0, 13) : productId}`;
}

function isBandaiSpiritsModelImage(url) {
  return /^https:\/\/bandai-a\.akamaihd\.net\/bc\/img\/model\//.test(String(url ?? ""));
}

/**
 * Every Pokémon plastic model kit in the official BANDAI SPIRITS product search.
 * A product the catalog already has under an older id (the global/satellite
 * Bandai Hobby pages, or a previous run) keeps that id, so collections that
 * reference it stay intact. Overseas satellite records of the same product are
 * added to `absorbedOverseas` and not imported separately any more.
 */
async function importPokeplaBandaiSpirits(existingKits = [], overseasKits = [], absorbedOverseas = new Set()) {
  const taxonomy = await readJsonFile("data/atlas-source-taxonomy.json", {});
  const speciesIndex = buildSpeciesIndex(taxonomy.pokemon || []);

  const cards = new Map();
  let total = null;
  for (let page = 1; page <= POKEPLA_MAX_PAGES; page += 1) {
    if (page > 1) await sleep(POKEPLA_REQUEST_GAP_MS);
    const html = await fetchText(`${POKEPLA_SEARCH_URL}&paging=${page}`);
    total ??= bandaiSpiritsHitCount(html);
    const pageCards = parseBandaiSpiritProductCards(html, POKEPLA_SEARCH_URL);
    for (const card of pageCards) {
      const productId = bandaiSpiritsProductId(card.source_url);
      if (productId && /ポケモン/.test(card.title)) cards.set(productId, { ...card, product_id: productId });
    }
    if (pageCards.length < POKEPLA_PAGE_SIZE || (total && page * POKEPLA_PAGE_SIZE >= total)) break;
  }
  if (!cards.size) throw new Error("BANDAI SPIRITS search returned no Pokemon plastic model listings");
  console.log(`Found ${cards.size} BANDAI SPIRITS Pokemon plastic model listings (search reported ${total ?? "?"}).`);

  const cardList = [...cards.values()].map((card) => ({
    ...card,
    identity: pokeplaIdentity(card.title, speciesIndex),
    species_key: pokeplaSpeciesKey(card.title, speciesIndex),
  }));
  const speciesKeyCount = new Map();
  for (const card of cardList) {
    if (card.species_key) speciesKeyCount.set(card.species_key, (speciesKeyCount.get(card.species_key) || 0) + 1);
  }
  // An unnumbered overseas title ("Pokémon Model Kit GENGAR") matches the one
  // Japanese product with the same line, Pokémon and variant ("45 セレクトシリーズ ゲンガー").
  const sameProduct = (title, card) => {
    const identity = pokeplaIdentity(title, speciesIndex);
    if (identity === card.identity) return true;
    if (!identity.includes(":-:")) return false;
    const speciesKey = pokeplaSpeciesKey(title, speciesIndex);
    return Boolean(speciesKey && speciesKey === card.species_key && speciesKeyCount.get(speciesKey) === 1);
  };

  // Which existing record each product continues: first the record this source
  // wrote before, then a record from the Bandai Hobby global/satellite pages.
  const pokeplaKits = existingKits.filter((kit) => kit.grade_code === "POKEPLA");
  const byProduct = new Map();
  for (const kit of pokeplaKits) {
    for (const ref of kit.source_refs || []) {
      const productId = ref.source_id === POKEPLA_SOURCE_ID ? bandaiSpiritsProductId(ref.url) : null;
      if (productId && !byProduct.has(productId)) byProduct.set(productId, kit);
    }
  }
  const unclaimed = pokeplaKits.filter((kit) => !(kit.source_refs || []).some((ref) => ref.source_id === POKEPLA_SOURCE_ID));
  const sourceTitle = (kit) => kit.names?.en || kit.names?.ja || "";
  const claimed = new Set();
  for (const card of cardList) {
    let existing = byProduct.get(card.product_id) ?? null;
    if (!existing) existing = unclaimed.find((kit) => !claimed.has(kit.kit_id) && sameProduct(sourceTitle(kit), card)) ?? null;
    if (existing) claimed.add(existing.kit_id);
    card.existing = existing;
    card.kit_id = existing?.kit_id ?? pokeplaKitId(card.product_id);
    card.overseas = overseasKits.filter((kit) => kit.kit_id === card.kit_id || sameProduct(sourceTitle(kit), card));
    for (const kit of card.overseas) absorbedOverseas.add(kit.kit_id);
  }

  let detailCount = 0;
  const imported = [];
  for (const card of cardList) {
    // cached_from: originals of photos the gallery now shows as local copies (lib/cached-originals.mjs)
    const previousGallery = [...(card.existing?.gallery_image_urls || []), ...(card.existing?.images?.cached_from || [])].filter(isBandaiSpiritsModelImage);
    let detailImages = previousGallery;
    if (!previousGallery.length && detailCount < POKEPLA_DETAIL_BUDGET) {
      await sleep(POKEPLA_REQUEST_GAP_MS);
      detailCount += 1;
      try {
        detailImages = parseBandaiSpiritProductDetail(await fetchText(card.source_url), card.image_url).images;
      } catch (error) {
        console.warn(`BANDAI SPIRITS detail fetch failed for ${card.source_url}: ${error.message}`);
      }
    }
    // Satellite images are plain files; global.bandai-hobby.net ones are signed links that expire.
    const overseasImages = card.overseas
      .flatMap((kit) => kit.gallery_image_urls || [])
      .filter((url) => /^https:\/\//.test(url) && !/[?&]Expires=/.test(url));
    const names = pokeplaNames(card.title, speciesIndex);
    imported.push(
      buildKit({
        kitId: card.kit_id,
        franchise: "pokemon",
        gradeCode: "POKEPLA",
        subline: pokeplaSubline(card.title),
        title: names.ja,
        names,
        boxArtUrl: card.image_url,
        galleryUrls: [card.image_url, ...detailImages, ...overseasImages],
        releaseDate: card.release_date,
        priceJpy: card.price_jpy,
        isLimited: /限定/.test(card.title),
        sourceId: POKEPLA_SOURCE_ID,
        sourceUrls: [card.source_url, POKEPLA_SEARCH_URL],
        tags: ["pokemon", "bandai hobby", "plastic model", "pokepla"],
        notes: "Imported from the official BANDAI SPIRITS product search (Pokémon PLAMO COLLECTION / ポケプラ).",
        workOverride: "Pokemon",
        universeOverride: "Pokemon",
      }),
    );
  }

  console.log(
    `Imported ${imported.length} Pokepla records (${claimed.size} continue an existing record, ${absorbedOverseas.size} overseas satellite records folded in, ${detailCount} detail pages read).`,
  );
  return imported;
}

function parseGashaponSearchListings(html, resultUrl) {
  const records = [];
  const blocks = html.split(/<div class="c-card__list[^"]*"[^>]*>/).slice(1);

  for (const block of blocks) {
    const href = extract(/<a href="([^"]+)" class="c-card__link"/, block);
    const title = stripTags(extract(/<p class="c-card__name">([\s\S]*?)<\/p>/, block));
    const image = extract(/<img[^>]+src="([^"]+)"/, block);
    const priceBlock = extract(/<p class="c-card__price">([\s\S]*?)<\/p>/, block);
    if (!href || !title) {
      continue;
    }

    const detailUrl = absoluteUrl(href, resultUrl);
    records.push({
      detail_url: detailUrl,
      jan_code: new URL(detailUrl).searchParams.get("jan_code"),
      title,
      image_url: image ? absoluteUrl(image, resultUrl) : null,
      price_jpy: parsePrice(priceBlock),
    });
  }

  return records;
}

async function importGashaponSearch({ label, resultUrl, franchise, gradeCode, subline, idPrefix, tags, fallbackWork, fallbackUniverse, fetchDetails = true }) {
  let html = "";
  try {
    html = await fetchText(resultUrl);
  } catch (error) {
    console.warn(`Gashapon listing fetch failed for ${label}: ${error.message}`);
    return [];
  }
  // A 【箱売】 card sells a whole box of a capsule line that has its own card.
  // Goods (towels, card packs …) stay: clean_catalog.mjs gives them a goods_kind.
  const parsed = parseGashaponSearchListings(html, resultUrl);
  const lineTitles = new Set(parsed.filter((listing) => !/【箱売】/.test(listing.title)).map((listing) => listing.title.replace(/【[^】]*】/g, "").replace(/\s+/g, "")));
  const listings = parsed.filter(
    (listing) => !(/【箱売】/.test(listing.title) && lineTitles.has(listing.title.replace(/【[^】]*】/g, "").replace(/\s+/g, ""))),
  );
  const imported = [];

  console.log(`Found ${listings.length} ${label} Gashapon search listings.`);

  let detailCount = 0;
  for (const listing of listings) {
    let detail = { images: [], release_date: null, price_jpy: null };
    if (fetchDetails) {
      await sleep(120);
      try {
        detail = parseGashaponProductDetail(await fetchText(listing.detail_url));
        detailCount += 1;
      } catch (error) {
        console.warn(`Gashapon detail fetch failed for ${listing.detail_url}: ${error.message}`);
      }
    }

    const inferred = inferWork(listing.title);
    imported.push(
      buildKit({
        kitId: `${idPrefix}-${listing.jan_code ?? slugify(listing.title, "item")}`,
        franchise,
        // Line cards of MOBILE SUIT ENSEMBLE / ガシャポン戦士フォルテ are not merch.
        gradeCode: (franchise === "gundam" && gundamGradeFromName(listing.title)) || gradeCode,
        subline,
        title: listing.title,
        boxArtUrl: detail.images[0] ?? listing.image_url,
        galleryUrls: [listing.image_url, ...detail.images],
        releaseDate: detail.release_date,
        priceJpy: detail.price_jpy ?? listing.price_jpy,
        isLimited: /限定|プレミアム|PREMIUM/i.test(listing.title),
        sourceId: GASHAPON_PRODUCTS_SOURCE_ID,
        sourceUrls: [listing.detail_url, resultUrl],
        tags,
        notes: `Imported from the official Bandai Gashapon product search for ${label}.`,
        workOverride: inferred.work_title ?? fallbackWork,
        universeOverride: inferred.universe ?? fallbackUniverse,
      }),
    );
  }

  console.log(fetchDetails ? `Fetched ${detailCount}/${listings.length} ${label} Gashapon detail pages.` : `Used ${listings.length} ${label} Gashapon listing images without detail-page fetches.`);
  return imported;
}

function tamashiiSearchUrl(area, currentPage = 1) {
  const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE_URL);
  url.searchParams.append("characterCode[]", "gundam_series");
  // The API answers 40 per page whatever per_page says; the loop follows lastPage.
  url.searchParams.set("per_page", "100");
  url.searchParams.set("current_page", String(currentPage));
  url.searchParams.set("sort", "1");
  url.searchParams.set("area", area);
  return url.href;
}

function tamashiiBrandPageUrl(brandCode) {
  return `${TAMASHII_BASE_URL}/item_brand/${brandCode}/?character=gundam_series&ck1=1&ck2=1&ck3=1&number=100&order=new`;
}

function tamashiiItemUrl(item) {
  return `${TAMASHII_BASE_URL}/item/${item.tamashiiWebId}/`;
}

async function fetchTamashiiAreaItems(area) {
  const firstPage = await fetchJson(tamashiiSearchUrl(area, 1));
  const items = [...(firstPage.data ?? [])];
  const lastPage = firstPage.pagination?.lastPage ?? 1;

  for (let page = 2; page <= lastPage; page += 1) {
    // About one request a second (~55 pages a run over three areas).
    await sleep(1000);
    const pageData = await fetchJson(tamashiiSearchUrl(area, page));
    items.push(...(pageData.data ?? []));
  }

  console.log(`Found ${items.length} Gundam Tamashii listings in the ${area} area.`);
  return items;
}

export function tamashiiGradeCode(brandName) {
  const name = nfkc(brandName);
  for (const [pattern, code] of TAMASHII_BRAND_GRADES) {
    if (pattern.test(name)) return code;
  }
  return "TAMASHII_OTHER";
}

function tamashiiSubline(title, brandName) {
  if (/S\.H\.Figuarts/i.test(brandName)) {
    return "S.H.Figuarts";
  }
  if (!/ROBOT魂/.test(brandName)) {
    return brandName || "Tamashii Nations";
  }
  if (/METAL ROBOT/i.test(brandName)) {
    return brandName;
  }
  if (/ROBOT魂/.test(brandName) && /ver\.\s*A\.N\.I\.M\.E\./i.test(title)) {
    return "ROBOT魂 ver. A.N.I.M.E.";
  }
  return brandName || "ROBOT魂";
}

function parseTamashiiInfoValue(html, labelPattern) {
  for (const match of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)) {
    const label = stripTags(match[1]);
    if (labelPattern.test(label)) {
      return match[2];
    }
  }
  return null;
}

function parseTamashiiProductDetail(html, detailUrl) {
  const title = stripTags(extract(/<span class="productMain__name">([\s\S]*?)<\/span>/, html));
  const brandName = stripTags(extract(/<span class="productMain__brand">[\s\S]*?<img[^>]+alt="([^"]+)"/, html));
  const gallery = extractTamashiiGalleryImages(html, detailUrl).slice(0, 24);
  const priceBlock = parseTamashiiInfoValue(html, /販売価格|価格/);
  const releaseBlock = parseTamashiiInfoValue(html, /発売日|発送月|発売時期/);
  const workTitle = stripTags(parseTamashiiInfoValue(html, /登場作品/));
  const releaseTime = extract(/datetime="([^"]+)"/, releaseBlock ?? "");

  return {
    title,
    brandName,
    images: gallery,
    price_jpy: parsePrice(priceBlock),
    release_date: parseReleaseDate(releaseTime ?? releaseBlock),
    work_title: workTitle || null,
  };
}

// The search listing is read on every run; the detail page (and the values an
// earlier run stored from it) only now and then. The listing month wins when
// the two disagree, the detail page only adds the day within that month.
export function tamashiiReleaseDate(item, detail) {
  const listed = item.releaseDateData || item.releaseMonth || null;
  const stored = detail?.release_date || null;
  if (listed && stored && String(stored).slice(0, 7) !== String(listed).slice(0, 7)) return listed;
  return stored ?? listed ?? null;
}

function tamashiiListedPrice(item) {
  const price = Number(item.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function buildTamashiiKit(item, detail) {
  const detailUrl = tamashiiItemUrl(item);
  // Listing titles carry the "＜SIDE MS＞" category tag that detail-page titles do not.
  let title = detail.title || stripTags(item.title).replace(/^\s*[＜<]\s*SIDE MS\s*[＞>]\s*/i, "");
  const brandName = detail.brandName || item.mainBrandName || "ROBOT魂";
  if (item.titleSuffix && !title.endsWith(item.titleSuffix)) title = `${title} ${item.titleSuffix}`;
  // "ガンダムシリーズ" alone names nothing; the official title is
  // "超合金の塊 ガンダムシリーズ" (and "Figuarts mini キラ・ヤマト").
  if (TAMASHII_GENERIC_TITLE_BRANDS.test(nfkc(brandName)) && !nfkc(title).startsWith(nfkc(brandName))) title = `${brandName} ${title}`;
  const areaTags = item.areas?.includes("japan") ? [] : (item.areas || []).map((area) => `tamashii-${area}-only`);
  const gradeCode = tamashiiGradeCode(brandName);
  const inferred = inferWork(title, detail.work_title);
  const categoryText = [item.category, item.categoryData?.long_name, item.salesAttributeList?.join(" "), title].filter(Boolean).join(" ");
  const imageUrl = absoluteUrl(item.thumbnailImg, TAMASHII_BASE_URL);

  return buildKit({
    kitId: `tamashii-${item.tamashiiWebId}`,
    franchise: "gundam",
    gradeCode,
    subline: tamashiiSubline(title, brandName),
    title,
    boxArtUrl: imageUrl,
    galleryUrls: [imageUrl, ...detail.images],
    releaseDate: tamashiiReleaseDate(item, detail),
    priceJpy: tamashiiListedPrice(item) ?? detail.price_jpy ?? parsePrice(item.priceTaxStr ?? item.priceText),
    isLimited: /限定|抽選|魂ウェブ商店|TAMASHII NATION|魂ストア/i.test(categoryText),
    sourceId: TAMASHII_SOURCE_ID,
    sourceUrls: [detailUrl, tamashiiBrandPageUrl(item.brandCode || "robot_tamashii")],
    names: item.areas?.includes("japan") || /[ぁ-んァ-ヶ一-龠]/.test(title) ? {} : { en: title },
    tags: ["gundam", "tamashii nations", "collectible figure", gradeCode.toLowerCase().replace(/_/g, "-"), ...areaTags],
    notes: item.areas?.includes("japan")
      ? `Imported from the official Tamashii Web Gundam ${brandName} catalog and product detail page.`
      : `Imported from the official Tamashii Web Gundam ${brandName} catalog. Listed only in the ${item.areas.join("/")} sales area (event or overseas exclusive).`,
    workContext: [detail.work_title],
    workOverride: inferred.work_title ?? detail.work_title,
    universeOverride: inferred.universe,
  });
}

// The listing (search API) says when Tamashii moved a release month or changed
// a price; the stored detail values are stale then.
export function tamashiiListingChanged(item, kit) {
  if (!kit) return false;
  const listedMonth = String(item.releaseDateData || item.releaseMonth || "").slice(0, 7);
  const storedMonth = String(kit.release_date || "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(listedMonth) && storedMonth && listedMonth !== storedMonth) return true;
  const listedPrice = Number(item.price);
  return Number.isFinite(listedPrice) && listedPrice > 0 && Number.isFinite(kit.price_jpy) && listedPrice !== kit.price_jpy;
}

// Day-based rotation over the Tamashii ids: each id comes up once every
// ceil(n / perDay) days.
function tamashiiRefreshDue(webId, index, total, perDay, day = Math.floor(Date.now() / 86400000)) {
  if (perDay <= 0 || total <= 0) return false;
  const cycle = Math.max(1, Math.ceil(total / perDay));
  return index % cycle === day % cycle;
}

// What an earlier run already read from a detail page, so the page is not
// fetched again every day.
function tamashiiDetailFromExisting(kit) {
  if (!kit || !(kit.gallery_image_urls?.length > 1) || kit.price_jpy == null || !kit.release_date) return null;
  return {
    title: kit.names?.ja || null,
    brandName: null,
    images: kit.gallery_image_urls.slice(1),
    price_jpy: kit.price_jpy,
    release_date: kit.release_date,
    work_title: kit.work_title || null,
  };
}

async function importTamashiiGundamFigures(existingKits = []) {
  const byWebId = new Map();

  for (const area of TAMASHII_AREAS) {
    let listings;
    try {
      listings = await fetchTamashiiAreaItems(area);
    } catch (error) {
      // japan carries almost everything; a failed overseas area only loses its exclusives.
      if (area === "japan") throw error;
      console.warn(`Tamashii ${area} area skipped: ${error.message}`);
      continue;
    }
    for (const item of listings) {
      if (!item.tamashiiWebId) continue;
      const known = byWebId.get(item.tamashiiWebId);
      if (known) {
        known.areas.push(area);
        continue;
      }
      byWebId.set(item.tamashiiWebId, { ...item, areas: [area] });
    }
  }

  const listings = [...byWebId.values()].filter(
    (item) => item.thumbnailImg && item.title && !TAMASHII_SKIP_BRANDS.test(nfkc(item.mainBrandName || "")),
  );
  // Same brand + same plain title on different products: keep them apart by month.
  const titleCounts = new Map();
  const titleKey = (item) => `${item.mainBrandName}|${nfkc(stripTags(item.title))}`;
  for (const item of listings) {
    if (TAMASHII_GENERIC_TITLE_BRANDS.test(nfkc(item.mainBrandName || ""))) titleCounts.set(titleKey(item), (titleCounts.get(titleKey(item)) || 0) + 1);
  }
  for (const item of listings) {
    if ((titleCounts.get(titleKey(item)) || 0) > 1 && item.releaseMonth) {
      const [year, month] = item.releaseMonth.split("-");
      item.titleSuffix = `（${year}年${Number(month)}月発売）`;
    }
  }

  const existingById = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  const emptyDetail = { title: null, brandName: null, images: [], price_jpy: null, release_date: null, work_title: null };
  let detailCount = 0;
  let reusedCount = 0;
  let budget = TAMASHII_DETAIL_BUDGET;
  const imported = [];
  let changedCount = 0;
  let refreshCount = 0;
  const order = [...listings].sort((a, b) => Number(a.tamashiiWebId) - Number(b.tamashiiWebId));
  const rotation = new Map(order.map((item, index) => [item.tamashiiWebId, index]));
  // Changed listings first, so a moved month always wins the budget.
  const queue = [...listings].sort(
    (a, b) =>
      Number(tamashiiListingChanged(b, existingById.get(`tamashii-${b.tamashiiWebId}`))) -
      Number(tamashiiListingChanged(a, existingById.get(`tamashii-${a.tamashiiWebId}`))),
  );
  for (const item of queue) {
    const detailUrl = tamashiiItemUrl(item);
    const existing = existingById.get(`tamashii-${item.tamashiiWebId}`);
    let detail = tamashiiDetailFromExisting(existing);
    const changed = Boolean(detail) && tamashiiListingChanged(item, existing);
    const due = Boolean(detail) && !changed && refreshCount < TAMASHII_DETAIL_REFRESH_PER_DAY &&
      tamashiiRefreshDue(item.tamashiiWebId, rotation.get(item.tamashiiWebId), order.length, TAMASHII_DETAIL_REFRESH_PER_DAY);
    if (detail && (changed || due) && budget > 0) {
      if (changed) changedCount += 1;
      else refreshCount += 1;
      const stored = detail;
      detail = null;
      budget -= 1;
      try {
        detail = parseTamashiiProductDetail(await fetchTamashiiDetailText(detailUrl), detailUrl);
        detailCount += 1;
      } catch (error) {
        console.warn(`Tamashii detail fetch failed for ${detailUrl}: ${error.message}`);
        // The listing month and price are current; the stored detail values are not.
        detail = changed ? { ...stored, release_date: null, price_jpy: null } : stored;
      }
      await sleep(TAMASHII_DETAIL_GAP_MS);
    } else if (detail) {
      reusedCount += 1;
    } else if (budget > 0) {
      budget -= 1;
      try {
        detail = parseTamashiiProductDetail(await fetchTamashiiDetailText(detailUrl), detailUrl);
        detailCount += 1;
      } catch (error) {
        console.warn(`Tamashii detail fetch failed for ${detailUrl}: ${error.message}`);
      }
      await sleep(TAMASHII_DETAIL_GAP_MS);
    }
    if (!detail && existing) {
      // Keep what the catalog has rather than overwrite it with listing-only data.
      imported.push(existing);
      continue;
    }
    imported.push(buildTamashiiKit(item, detail || emptyDetail));
  }

  console.log(
    `Fetched ${detailCount} Tamashii detail pages (${changedCount} for a changed listing month/price, ${refreshCount} scheduled re-checks), reused ${reusedCount} from the catalog (budget ${TAMASHII_DETAIL_BUDGET}).`,
  );
  console.log(`Imported ${imported.length} Tamashii Gundam figure records.`);
  return imported;
}

function parseBandaiSpiritProductCards(html, listingUrl) {
  return html
    .split('<div class="m_panel__listItem">')
    .slice(1)
    .map((block) => {
      const href = extract(/href="([^"]*\/products\/search\/detail\.php[^"]+)"/, block);
      const imageUrl = extract(/<img src="([^"]+)"/, block);
      const title = stripTags(extract(/<div class="m_cardA__title">([\s\S]*?)<\/div>/, block));
      const releaseText = stripTags(extract(/<div class="m_cardA__date">([\s\S]*?)<\/div>/, block));
      const priceText = stripTags(extract(/<div class="m_cardA__price">([\s\S]*?)<\/div>/, block));

      if (!href || !title) {
        return null;
      }

      return {
        source_url: absoluteUrl(href, listingUrl),
        image_url: imageUrl ? absoluteUrl(imageUrl, listingUrl) : null,
        title,
        release_date: parseReleaseDate(releaseText),
        price_jpy: parsePrice(priceText),
      };
    })
    .filter(Boolean);
}

function bandaiImageSeriesId(url) {
  const file = new URL(url).pathname.split("/").at(-1) ?? "";
  return /^(.+?)_\d+\.[a-z0-9]+$/i.exec(file)?.[1] ?? null;
}

function sameBandaiImageSeries(url, referenceUrl) {
  const id = bandaiImageSeriesId(url);
  const referenceId = bandaiImageSeriesId(referenceUrl);
  return Boolean(id && referenceId && id === referenceId);
}

function parseBandaiSpiritProductDetail(html, referenceImageUrl) {
  const images = unique([...html.matchAll(/https:\/\/bandai-a\.akamaihd\.net\/bc\/img\/model\/[^"')\s<>]+/g)].map((match) => match[0]));
  return {
    images: referenceImageUrl ? images.filter((url) => sameBandaiImageSeries(url, referenceImageUrl)) : images,
  };
}

async function importBandaiArmoredCore() {
  const html = await fetchText(BANDAI_AC_SEARCH_URL);
  const cards = parseBandaiSpiritProductCards(html, BANDAI_AC_SEARCH_URL).filter((card) => /ARMORED CORE/i.test(card.title));
  const imported = [];

  console.log(`Found ${cards.length} BANDAI SPIRITS Armored Core plastic model listings.`);

  for (const card of cards) {
    let detail = { images: [] };
    try {
      detail = parseBandaiSpiritProductDetail(await fetchText(card.source_url), card.image_url);
    } catch (error) {
      console.warn(`BANDAI SPIRITS detail fetch failed for ${card.source_url}: ${error.message}`);
    }

    imported.push(
      buildKit({
        kitId: `ac30mm-${card.source_url.match(/prd_id=(\d+)/)?.[1] ?? slugify(card.title, "item")}`,
        franchise: "armored_core",
        gradeCode: "AC30MM",
        subline: /オプションパーツ|WEAPON SET/i.test(card.title) ? "30MM Armored Core Option Parts" : "30MM Armored Core VI",
        title: card.title,
        boxArtUrl: card.image_url,
        galleryUrls: [card.image_url, ...detail.images],
        releaseDate: card.release_date,
        priceJpy: card.price_jpy,
        isLimited: /限定|プレミアム/.test(card.title),
        sourceId: BANDAI_SPIRITS_SOURCE_ID,
        sourceUrls: [card.source_url, BANDAI_AC_SEARCH_URL],
        tags: ["armored core", "30mm", "bandai spirits", "plastic model"],
        notes: "Imported from the official BANDAI SPIRITS product search for Armored Core 30MM plastic models.",
        workOverride: "Armored Core VI: Fires of Rubicon",
        universeOverride: "Armored Core",
      }),
    );
  }

  return imported;
}

async function importKotobukiyaArmoredCore() {
  const html = await fetchKotobukiyaShopText(KOTOBUKIYA_AC_SHOP_URL);
  const listings = parseKotobukiyaShopListings(html);
  console.log(`Found ${listings.length} Kotobukiya Armored Core official shop listings.`);
  let detailCount = 0;
  const imported = await mapLimit(listings, 5, async (listing) => {
    let detail = null;
    try {
      detail = parseKotobukiyaShopDetail(await fetchKotobukiyaShopText(listing.detail_url), listing.detail_url);
      detailCount += 1;
    } catch (error) {
      console.warn(`Kotobukiya detail fetch failed for ${listing.detail_url}: ${error.message}`);
    }
    const fallbackModel = !/カラー|塗料|チャーム|DECOCTION|完成品フィギュア/i.test(listing.title);
    if (!(detail?.is_plastic_model ?? fallbackModel)) return null;

    return buildKit({
        kitId: `acvi-${listing.product_id}`,
        franchise: "armored_core",
        gradeCode: "ACVI",
        subline: detail?.series || "Kotobukiya Armored Core",
        title: detail?.title || listing.title,
        boxArtUrl: listing.image_url,
        galleryUrls: [listing.image_url, ...(detail?.gallery || [])],
        releaseDate: detail?.release_date,
        priceJpy: detail?.price_jpy,
        isLimited: listing.is_limited,
        sourceId: KOTOBUKIYA_AC_SOURCE_ID,
        sourceUrls: [listing.detail_url, KOTOBUKIYA_AC_SHOP_URL, KOTOBUKIYA_AC_PORTAL_URL],
        tags: ["armored core", "kotobukiya", "plastic model"],
        notes: "Imported from the official Kotobukiya Japan online shop; the public product portal is retained as a reference.",
        workOverride: detail?.work_title || "Armored Core",
        universeOverride: "Armored Core",
        scale: detail?.scale || "various",
      });
  });

  console.log(`Fetched ${detailCount}/${listings.length} Kotobukiya Armored Core detail pages.`);
  return imported.filter(Boolean);
}

function parseBeybladeXListings(html, pageUrl) {
  const records = [];
  const itemPattern = /<li class="mix[\s\S]*?<\/li>/g;
  let index = 0;

  for (const match of html.matchAll(itemPattern)) {
    const block = match[0];
    const titleMatch = /<b>\s*([^<]+)<span>([\s\S]*?)<\/span><\/b>/.exec(block);
    if (!titleMatch || !/^(?:BX|UX|CX)-/i.test(titleMatch[1])) {
      continue;
    }

    const code = stripTags(titleMatch[1]);
    const name = stripTags(titleMatch[2]);
    const title = `${code} ${name}`.trim();
    const href = extract(/<a href="([^"]+\.html)"/, block);
    const image = extract(/<img\s+src="([^"]+)"/, block);
    const category = stripTags(extract(/<p class="category"><span>([\s\S]*?)<\/span><\/p>/, block));
    const priceText = stripTags(extract(/<i>([\s\S]*?)<\/i>/, block));
    const releaseText = stripTags(extract(/<i class="red">([\s\S]*?)<\/i>/, block));
    const detailUrl = href ? absoluteUrl(href, pageUrl) : pageUrl;
    const hrefSlug = href ? href.replace(/\.html(?:[?#].*)?$/i, "") : `${code.toLowerCase()}-${index + 1}`;

    records.push({
      code,
      name,
      title,
      detail_url: detailUrl,
      href_slug: hrefSlug,
      image_url: image ? absoluteUrl(image, pageUrl) : null,
      category,
      release_date: parseReleaseDate(releaseText),
      price_jpy: parsePrice(priceText),
      is_limited: /限定|イベント|B4ストア|タカラトミーモール|メタルコート|Ver\./.test(block) || /限定|メタルコート|Ver\./.test(title),
      index: index + 1,
    });
    index += 1;
  }

  return records;
}

function parseBeybladeXDetail(html, detailUrl, code) {
  const imageKey = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  // The 「パーツ詳細」 pop-up: one picture of the blade, ratchet and bit with
  // their descriptions and stats (_image/detail_BX54.png). Sets can have one
  // per bey (detail_BX00_xx …).
  const parts = unique(
    [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)]
      .map((match) => match[1])
      .filter((src) => {
        const fileName = new URL(src, detailUrl).pathname.split("/").at(-1)?.toUpperCase() ?? "";
        return fileName.startsWith(`DETAIL_${imageKey}`);
      })
      .map((src) => absoluteUrl(src, detailUrl)),
  );
  const images = unique(
    [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)]
      .map((match) => match[1])
      .filter((src) => {
        const fileName = new URL(src, detailUrl).pathname.split("/").at(-1)?.toUpperCase() ?? "";
        return fileName.startsWith(imageKey) && !/_LIST\./i.test(fileName);
      })
      .map((src) => absoluteUrl(src, detailUrl)),
  );

  return { images, parts };
}

function beybladeCategoryLabel(category) {
  if (/スターター/.test(category)) return "BEYBLADE X Starter";
  if (/ランダムブースター/.test(category)) return "BEYBLADE X Random Booster";
  if (/ブースター/.test(category)) return "BEYBLADE X Booster";
  if (/セット/.test(category)) return "BEYBLADE X Set";
  if (/ツール/.test(category)) return "BEYBLADE X Tool";
  return "BEYBLADE X";
}

function beybladeSeriesTags(listing) {
  const prefix = listing.code.split("-")[0]?.toLowerCase();
  const tags = ["beyblade", "beyblade x", "takara tomy", "battle toy"];
  if (["bx", "ux", "cx"].includes(prefix)) {
    tags.push(prefix);
  }
  if (listing.is_limited) {
    tags.push("limited");
  }
  return tags;
}

// A lineup card without a detail link used to get `${code}-${position}` as its id,
// and the id changed whenever the card moved or gained its link, leaving a stale
// twin behind. A card that matches an existing record by title keeps that
// record's id; a new card without a link gets an id from its code and title.
const beybladeTitleKey = (title) => nfkc(title).replace(/\s+/g, "");

function beybladeKitId(listing, existingByTitle) {
  const existing = existingByTitle.get(beybladeTitleKey(listing.title));
  if (existing) return existing;
  if (listing.detail_url !== BEYBLADE_X_LINEUP_URL) {
    return `beyblade-x-${slugify(listing.href_slug, `${String(listing.index).padStart(3, "0")}-${listing.code.toLowerCase()}`)}`;
  }
  const titleHash = createHash("sha1").update(listing.title).digest("hex").slice(0, 8);
  return `beyblade-x-${slugify(listing.code, "bx")}-${titleHash}`;
}

async function importBeybladeX(existingKits = []) {
  const retired = retiredKitIds(await readJsonFile(KIT_ALIASES_PATH, null));
  const existingByTitle = new Map(
    existingKits
      .filter((kit) => kit.franchise === "beyblade" && !retired.has(kit.kit_id))
      .map((kit) => [beybladeTitleKey(kit.names?.ja), kit.kit_id]),
  );
  const html = await fetchBrowserText(BEYBLADE_X_LINEUP_URL);
  const listings = parseBeybladeXListings(html, BEYBLADE_X_LINEUP_URL);
  console.log(`Found ${listings.length} Takara Tomy BEYBLADE X listings.`);

  const details = await mapLimit(listings, 6, async (listing) => {
    if (listing.detail_url === BEYBLADE_X_LINEUP_URL) {
      return { images: [], parts: [] };
    }
    try {
      return parseBeybladeXDetail(await fetchBrowserText(listing.detail_url), listing.detail_url, listing.code);
    } catch (error) {
      console.warn(`BEYBLADE X detail fetch failed for ${listing.detail_url}: ${error.message}`);
      return { images: [], parts: [] };
    }
  });

  return listings.map((listing, index) => {
    // Cover first (the lineup card), then the parts detail picture, then the product shots.
    const images = unique([listing.image_url, ...details[index].parts, ...details[index].images].filter(Boolean));
    return buildKit({
      kitId: beybladeKitId(listing, existingByTitle),
      franchise: "beyblade",
      gradeCode: "BEYBLADE_X",
      subline: beybladeCategoryLabel(listing.category),
      title: listing.title,
      names: {
        ja: listing.title,
        en: listing.title,
        zh: listing.title,
        ko: listing.title,
      },
      // Never the parts picture as the cover, even when the card has no image.
      boxArtUrl: listing.image_url || details[index].images[0] || null,
      galleryUrls: images,
      releaseDate: listing.release_date,
      priceJpy: listing.price_jpy,
      isLimited: listing.is_limited,
      sourceId: TAKARA_TOMY_BEYBLADE_X_SOURCE_ID,
      sourceUrls: [listing.detail_url, BEYBLADE_X_LINEUP_URL],
      tags: beybladeSeriesTags(listing),
      notes: "Imported from the official Takara Tomy BEYBLADE X lineup and product detail pages.",
      workOverride: "BEYBLADE X",
      universeOverride: "BEYBLADE X",
    });
  });
}

async function importCandy() {
  const imported = [];

  for (const brand of CANDY_BRANDS) {
    const listingUrl = `${CANDY_BASE_URL}/candy/gundam/${brand.slug}/`;
    const html = await fetchText(listingUrl);
    const listings = parseCandyListings(html, listingUrl, brand);
    console.log(`Found ${listings.length} ${brand.label} listings.`);

    let detailCount = 0;
    for (const listing of listings) {
      let detail = { images: [], release_date: null, price_jpy: null };
      try {
        detail = parseCandyDetail(await fetchText(listing.url), listing.url);
        detailCount += 1;
      } catch (error) {
        console.warn(`Detail fetch failed for ${listing.url}: ${error.message}`);
      }

      const url = new URL(listing.url);
      const pathPart = listing.path.replace(`/candy/gundam/${brand.slug}/`, "").replace(/\/$/g, "");
      const urlPart = slugify(`${url.search} ${url.hash}`, "");
      const identity = urlPart ? `${pathPart}-${urlPart}` : pathPart;
      const detailImages = detail.images.filter((url) => sameImageDirectory(url, listing.image_url));
      imported.push(
        buildKit({
          kitId: `${brand.code.toLowerCase()}-${slugify(identity, slugify(listing.title, "item"))}`,
          gradeCode: brand.code,
          subline: candySubline(listing.title, brand),
          title: listing.title,
          boxArtUrl: listing.image_url,
          galleryUrls: [listing.image_url, ...detailImages],
          releaseDate: detail.release_date ?? listing.release_date,
          priceJpy: detail.price_jpy,
          isLimited: listing.is_limited,
          sourceId: CANDY_SOURCE_ID,
          sourceUrls: [listing.url, listingUrl],
          tags: ["bandai candy", "shokugan", brand.slug],
          notes: `Imported from the official Bandai Candy Gundam ${brand.label} lineup.`,
        }),
      );
    }

    console.log(`Fetched ${detailCount}/${listings.length} ${brand.label} detail pages.`);
  }

  return imported;
}

function parseEnsembleEntries(html, detailUrl) {
  const entries = [];
  const pattern = /<li>\s*<p class="name">([\s\S]*?)<\/p>\s*<div class="img">\s*<img src="([^"]+)"/g;
  let index = 0;
  for (const match of html.matchAll(pattern)) {
    const jaName = stripTags(match[1].split(/<br\s*\/?>/i)[0]);
    if (!jaName || SKIP_INDIVIDUAL_ITEM_PATTERN.test(jaName)) {
      continue;
    }
    index += 1;
    entries.push({
      index,
      name: jaName,
      image_url: absoluteUrl(match[2], detailUrl),
    });
  }
  return entries;
}

function ensembleSetLabel(html, fallback) {
  const setNo = stripTags(extract(/<span class="fontL">([\s\S]*?)<\/span>/, html));
  return setNo ? `MOBILE SUIT ENSEMBLE ${setNo}` : `MOBILE SUIT ENSEMBLE ${fallback}`;
}

async function importEnsemble() {
  const listUrl = `${GASHAPON_BASE_URL}/ensemble/items/`;
  const html = await fetchText(listUrl);
  const ids = unique([...html.matchAll(/href="\.\.\/items\/detail\.php\?p=([^"]+)"/g)].map((match) => decodeHtml(match[1])));
  const imported = [];
  const productCache = new Map();

  console.log(`Found ${ids.length} Mobile Suit Ensemble detail pages.`);

  for (const id of ids) {
    const detailUrl = `${GASHAPON_BASE_URL}/ensemble/items/detail.php?p=${encodeURIComponent(id)}`;
    let detailHtml;
    try {
      detailHtml = await fetchText(detailUrl);
    } catch (error) {
      console.warn(`Ensemble detail fetch failed for ${detailUrl}: ${error.message}`);
      continue;
    }

    const entries = parseEnsembleEntries(detailHtml, detailUrl);
    if (!entries.length) {
      continue;
    }

    const productUrl = extract(/https:\/\/gashapon\.jp\/products\/detail\.html\?jan_code=\d+/, detailHtml);
    let product = { images: [], release_date: parseReleaseDate(detailHtml), price_jpy: null };
    if (productUrl) {
      if (!productCache.has(productUrl)) {
        try {
          productCache.set(productUrl, parseGashaponProductDetail(await fetchText(productUrl)));
        } catch (error) {
          console.warn(`Gashapon product fetch failed for ${productUrl}: ${error.message}`);
          productCache.set(productUrl, product);
        }
      }
      product = productCache.get(productUrl);
    }

    const subline = ensembleSetLabel(detailHtml, id);
    for (const entry of entries) {
      const title = `${subline} ${entry.name}`;
      imported.push(
        buildKit({
          kitId: `mse-${slugify(id, "set")}-${entry.index}-${slugify(entry.name, "item")}`,
          gradeCode: "MSE",
          subline,
          title,
          boxArtUrl: entry.image_url,
          galleryUrls: [entry.image_url, ...product.images],
          releaseDate: product.release_date ?? parseReleaseDate(detailHtml),
          priceJpy: product.price_jpy,
          isLimited: /限定|PB|EX|GOLD/.test(subline),
          sourceId: GASHAPON_SOURCE_ID,
          sourceUrls: [detailUrl, productUrl].filter(Boolean),
          tags: ["bandai gashapon", "mobile suit ensemble"],
          notes: "Imported from the official Mobile Suit Ensemble archive and linked Gashapon product detail page.",
          workContext: [entry.name],
        }),
      );
    }
  }

  console.log(`Imported ${imported.length} Mobile Suit Ensemble individual entries.`);
  return imported;
}

function parseForteEntries(html, listUrl) {
  const entries = [];
  const tokenPattern = /<h3[\s\S]*?<\/h3>|<a href="(https:\/\/gashapon\.jp\/products\/detail\.html\?jan_code=\d+)"[^>]*>|<area class="fancybox-frame"[^>]+>/g;
  let currentSetTitle = "機動戦士ガンダム ガシャポン戦士f";
  let currentProductUrl = null;
  let index = 0;

  for (const match of html.matchAll(tokenPattern)) {
    const token = match[0];
    if (token.startsWith("<h3")) {
      currentSetTitle = stripTags(extract(/alt="([^"]+)"/, token)) || stripTags(token) || currentSetTitle;
      index = 0;
      continue;
    }
    if (match[1]) {
      currentProductUrl = match[1];
      continue;
    }
    const name = stripTags(extract(/alt="([^"]+)"/, token));
    const image = extract(/href="([^"]+)"/, token);
    const group = extract(/data-fancybox-group="([^"]+)"/, token) || "set";
    if (!name || !image || SKIP_INDIVIDUAL_ITEM_PATTERN.test(name)) {
      continue;
    }
    index += 1;
    entries.push({
      set_title: currentSetTitle,
      product_url: currentProductUrl,
      index,
      group,
      name,
      image_url: absoluteUrl(image, listUrl),
    });
  }

  return entries;
}

async function fetchKotobukiyaShopText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": BOT_UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "ja-JP,ja;q=0.9,en;q=0.6",
        },
      });
      if (response.ok) return decodeKotobukiyaShopHtml(await response.arrayBuffer());
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(attempt * 600);
  }
  throw lastError;
}

function forteEntryIdentity(entry) {
  const isExGallery = /(^|-)ex\d+/i.test(entry.group || "") || /\bEX\d{3}\b/i.test(entry.set_title || "");
  if (!isExGallery) {
    return `${entry.group}:${entry.index}:${entry.name}`;
  }
  return `${entry.group}:${entry.name.replace(/\s+/g, " ").trim()}`;
}

function collapseForteEntries(entries) {
  const byIdentity = new Map();
  for (const entry of entries) {
    const key = forteEntryIdentity(entry);
    const current = byIdentity.get(key);
    if (!current) {
      byIdentity.set(key, { ...entry, images: [entry.image_url] });
      continue;
    }
    current.images = unique([...(current.images || []), entry.image_url]);
  }
  return [...byIdentity.values()];
}

async function importForte() {
  const listUrl = `${GASHAPON_BASE_URL}/forte/items/`;
  const html = await fetchText(listUrl);
  const entries = collapseForteEntries(parseForteEntries(html, listUrl));
  const productCache = new Map();
  const imported = [];

  console.log(`Found ${entries.length} Gashapon Senshi f individual entries.`);

  for (const entry of entries) {
    let product = { images: [], release_date: null, price_jpy: null };
    if (entry.product_url) {
      if (!productCache.has(entry.product_url)) {
        try {
          productCache.set(entry.product_url, parseGashaponProductDetail(await fetchText(entry.product_url)));
        } catch (error) {
          console.warn(`Gashapon product fetch failed for ${entry.product_url}: ${error.message}`);
          productCache.set(entry.product_url, product);
        }
      }
      product = productCache.get(entry.product_url);
    }

    const title = `${entry.set_title} ${entry.name}`;
    imported.push(
      buildKit({
        kitId: `gsf-${slugify(entry.group, "set")}-${entry.index}-${slugify(entry.name, "item")}`,
        gradeCode: "GSF",
        subline: entry.set_title,
        title,
        boxArtUrl: entry.images?.[0] || entry.image_url,
        galleryUrls: [...(entry.images || [entry.image_url]), ...product.images],
        releaseDate: product.release_date,
        priceJpy: product.price_jpy,
        isLimited: /限定|PB|EX/.test(entry.set_title),
        sourceId: GASHAPON_SOURCE_ID,
        sourceUrls: [listUrl, entry.product_url].filter(Boolean),
        tags: ["bandai gashapon", "gashapon senshi f"],
        notes: "Imported from the official Gashapon Senshi f archive and linked Gashapon product detail page.",
        workContext: [entry.name],
      }),
    );
  }

  return imported;
}

function mergeKits(existingDoc, imported) {
  const normalizedExisting = existingDoc.kits.map((kit) => normalizeKit(kit)).filter((kit) => kit.kit_id !== "acvi-roduct");
  const normalizedImported = imported.map((kit) => normalizeKit(kit));
  const byId = new Map(normalizedExisting.map((kit) => [kit.kit_id, kit]));
  for (const kit of normalizedImported) {
    // PB refs, PB flags and cleanup tags folded into a record survive the re-import.
    byId.set(kit.kit_id, carryCleanupFields(byId.get(kit.kit_id), kit));
  }

  const kits = [...byId.values()].sort((a, b) => {
    const dateCompare = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""));
    if (dateCompare) return dateCompare;
    const gradeCompare = String(a.grade_code).localeCompare(String(b.grade_code));
    if (gradeCompare) return gradeCompare;
    return String(a.names?.ja ?? a.kit_id).localeCompare(String(b.names?.ja ?? b.kit_id), "ja");
  });

  return {
    ...existingDoc,
    updated_at: today(),
    scope:
      "Individual model kit and official collectible catalog imported from Japanese official BANDAI SPIRITS, Bandai Candy, Bandai Gashapon, Bandai Hobby, Tamashii Web, Kotobukiya, and Takara Tomy sources. Covers Gundam, Armored Core, Pokemon, and BEYBLADE X records. Records are needs_review until field-level human checks are complete.",
    kits,
  };
}

function normalizeKit(kit) {
  const { kit_id: kitId, names = {}, franchise, ...rest } = kit;
  return {
    kit_id: kitId,
    franchise: franchise ?? "gundam",
    ...rest,
    names: {
      ja: names.ja ?? null,
      en: names.en ?? null,
      zh: names.zh ?? null,
      ko: names.ko ?? null,
    },
  };
}

async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

// `--only=<regex>` runs just the matching sources (e.g. --only=Tamashii), for
// re-importing one source without touching the others.
const ONLY = (() => {
  const arg = process.argv.find((value) => value.startsWith("--only="));
  return arg ? new RegExp(arg.slice("--only=".length), "i") : null;
})();

async function importOptional(label, importer) {
  if (ONLY && !ONLY.test(label)) return [];
  try {
    return await importer();
  } catch (error) {
    console.warn(`${label} import skipped: ${error.message}`);
    return [];
  }
}

async function main() {
  const existingDoc = JSON.parse(await readFile("data/kits.json", "utf8"));
  const pokemonModelKits = await importOptional("Pokemon model kits", importPokemonModelKits);
  const absorbedOverseasPokepla = new Set();
  const pokeplaOwnedIds = new Set(
    existingDoc.kits.filter((kit) => (kit.source_refs || []).some((ref) => ref.source_id === POKEPLA_SOURCE_ID)).map((kit) => kit.kit_id),
  );
  const pokeplaKits = await importOptional("BANDAI SPIRITS Pokemon model kits", () =>
    importPokeplaBandaiSpirits(existingDoc.kits, pokemonModelKits, absorbedOverseasPokepla),
  );
  const imported = [
    ...(await importOptional("Bandai Candy", importCandy)),
    ...(await importOptional("Mobile Suit Ensemble", importEnsemble)),
    ...(await importOptional("Gashapon Senshi f", importForte)),
    // Satellite (overseas) records the Japanese source covers are folded into it,
    // also on a day the BANDAI SPIRITS search fails (the record keeps its data).
    ...pokemonModelKits.filter((kit) => !absorbedOverseasPokepla.has(kit.kit_id) && !pokeplaOwnedIds.has(kit.kit_id)),
    ...pokeplaKits,
    ...(await importOptional("Pokemon Gashapon", () =>
      importGashaponSearch({
        label: "Pokemon",
        resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=${encodeURIComponent("ポケモン")}`,
        franchise: "pokemon",
        gradeCode: "POKE_GASHAPON",
        subline: "Pokemon Gashapon",
        idPrefix: "poke-gashapon",
        tags: ["pokemon", "bandai gashapon", "capsule toy", "mascot"],
        fallbackWork: "Pokemon",
        fallbackUniverse: "Pokemon",
        fetchDetails: false,
      }),
    )),
    ...(await importOptional("Gundam official gashapon", () =>
      importGashaponSearch({
        label: "Gundam official gashapon",
        resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=${encodeURIComponent("ガンダム")}`,
        franchise: "gundam",
        gradeCode: "GUNDAM_MERCH",
        subline: "Gundam Gashapon Merchandise",
        idPrefix: "gundam-merch",
        tags: ["gundam", "bandai gashapon", "capsule toy", "merchandise"],
        fallbackWork: "Mixed Gundam Works",
        fallbackUniverse: "Mixed",
        fetchDetails: false,
      }),
    )),
    ...(await importOptional("Gundam SEED merchandise Gashapon", () =>
      importGashaponSearch({
        label: "Gundam SEED merchandise",
        resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=SEED`,
        franchise: "gundam",
        gradeCode: "GUNDAM_MERCH",
        subline: "Gundam SEED Gashapon Merchandise",
        idPrefix: "gundam-merch",
        tags: ["gundam", "seed", "bandai gashapon", "merchandise"],
        fallbackWork: "Mobile Suit Gundam SEED",
        fallbackUniverse: "CE",
      }),
    )),
    ...(await importOptional("Gundam 00 merchandise Gashapon", () =>
      importGashaponSearch({
        label: "Gundam 00 merchandise",
        resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=${encodeURIComponent("ガンダム00")}`,
        franchise: "gundam",
        gradeCode: "GUNDAM_MERCH",
        subline: "Gundam 00 Gashapon Merchandise",
        idPrefix: "gundam-merch",
        tags: ["gundam", "00", "bandai gashapon", "merchandise"],
        fallbackWork: "Mobile Suit Gundam 00",
        fallbackUniverse: "AD",
      }),
    )),
    ...(await importOptional("Tamashii Gundam figures", () => importTamashiiGundamFigures(existingDoc.kits))),
    ...(await importOptional("Bandai Armored Core", importBandaiArmoredCore)),
    ...(await importOptional("Kotobukiya Armored Core", importKotobukiyaArmoredCore)),
    ...(await importOptional("BEYBLADE X", () => importBeybladeX(existingDoc.kits))),
  ];

  // Ids clean_catalog.mjs retired (duplicates, non-collectibles) are not re-added.
  const retired = retiredKitIds(await readJsonFile(KIT_ALIASES_PATH, null));
  // A retired Tamashii page is a sale batch / reissue page folded into the figure it
  // sells; what it says now (shipping month, batch) is the resale signal kept in
  // data/sale-pages.json for scripts/build_restocks.mjs.
  const salePages = await readSalePages();
  let salePagesChanged = false;
  for (const kit of imported) {
    if (!/^tamashii-\d+$/.test(kit.kit_id) || !retired.has(kit.kit_id)) continue;
    if (upsertSalePage(salePages, kit.kit_id, salePageFromKit(kit, { firstSeen: seoulToday() }))) salePagesChanged = true;
  }
  await writeSalePages(salePages, { changed: salePagesChanged });
  const merged = mergeKits(existingDoc, imported.filter((kit) => !retired.has(kit.kit_id)));
  await writeFile("data/kits.json", `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Merged ${imported.length} collectible records. Catalog now has ${merged.kits.length} records.`);
}

// The unit tests import the Tamashii helpers; only a direct run imports data.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
