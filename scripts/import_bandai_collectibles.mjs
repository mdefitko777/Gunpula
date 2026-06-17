import { readFile, writeFile } from "node:fs/promises";
import { extractTamashiiGalleryImages } from "./lib/tamashii-images.mjs";

const CANDY_BASE_URL = "https://www.bandai.co.jp";
const GASHAPON_BASE_URL = "https://gashapon.jp";
const CANDY_SOURCE_ID = "bandai_candy_gundam_jp";
const GASHAPON_SOURCE_ID = "bandai_gashapon_gundam_jp";
const GASHAPON_PRODUCTS_SOURCE_ID = "bandai_gashapon_products_jp";
const POKEMON_HOBBY_SOURCE_ID = "bandai_hobby_pokemon_satellite";
const POKEMON_GLOBAL_SOURCE_ID = "bandai_hobby_pokemon_global";
const KOTOBUKIYA_AC_SOURCE_ID = "kotobukiya_armored_core_jp";
const BANDAI_SPIRITS_SOURCE_ID = "bandai_spirits_products_jp";
const TAMASHII_SOURCE_ID = "tamashii_web_jp";
const TAKARA_TOMY_BEYBLADE_X_SOURCE_ID = "takara_tomy_beyblade_x_jp";

const POKEMON_MODEL_KIT_URL = "https://satellite.bandai-hobby.net/characters/pokemon.php";
const POKEMON_GLOBAL_PRODUCTS_URLS = [
  "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/products/?category=quick",
  "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/products/?category=select",
  "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/products/?category=big",
];
const BANDAI_AC_SEARCH_URL = "https://www.bandaispirits.co.jp/products/search/result.php?freeword=ARMORED%20CORE&category=2";
const KOTOBUKIYA_AC_URL = "https://www.kotobukiya.co.jp/title/armored-core/";
const TAMASHII_BASE_URL = "https://tamashiiweb.com";
const BEYBLADE_X_LINEUP_URL = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";

const CANDY_BRANDS = [
  { code: "CONVERGE", slug: "converge", label: "FW GUNDAM CONVERGE" },
  { code: "GFRAME", slug: "gframe", label: "Mobile Suit Gundam G Frame FA" },
  { code: "MOBILITY", slug: "mobilityJoint", label: "MOBILITY JOINT GUNDAM" },
  { code: "ARTIFACT", slug: "artifact", label: "Gundam Artifact" },
  { code: "SUPERIOR", slug: "superiordefine", label: "Gundam Superior Define" },
];

const TAMASHII_GUNDAM_BRANDS = [
  { brandCode: "metal_build", label: "METAL BUILD" },
  { brandCode: "metal_robot_tamashii", label: "METAL ROBOT魂" },
  { brandCode: "robot_tamashii", label: "ROBOT魂" },
  { brandCode: "shfiguarts", label: "S.H.Figuarts" },
];

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
          "user-agent": "Gunpula catalog importer (+https://github.com/mdefitko777/Gunpula)",
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

async function fetchBrowserText(url, referer = null) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ja,en-US;q=0.9,en;q=0.8",
          ...(referer ? { referer } : {}),
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
          "user-agent": "Gunpula catalog importer (+https://github.com/mdefitko777/Gunpula)",
          accept: "application/json",
          "accept-language": "ja,en-US;q=0.8,en;q=0.7",
          "x-requested-with": "XMLHttpRequest",
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
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ja,en-US;q=0.9,en;q=0.8",
          referer: `${TAMASHII_BASE_URL}/item_character/gundam_series/`,
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

function pokemonModelIdentity(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, " ")
    .toLowerCase()
    .replace(/pokemon|pok mon|plamo|collection|model|kit|series|select|fossil|quick|big/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pokemonSublineFromTitle(title, category) {
  const text = `${title} ${category}`;
  if (/fossil/i.test(text)) return "Pokemon Fossil Pokemon Series";
  if (/big/i.test(text)) return "Pokemon Model Kit BIG";
  if (/quick/i.test(text)) return "Pokemon Model Kit Quick!!";
  if (/select/i.test(text)) return "Pokemon PLAMO COLLECTION SELECT SERIES";
  return "Pokemon Model Kit";
}

function parsePokemonGlobalProductList(html, pageUrl) {
  const records = [];
  const itemPattern =
    /<li class="p-products__listItem[^"]*">[\s\S]*?<a href="([^"]*\/item\/01_[^"]+)"[\s\S]*?<img src="([^"]+)" alt="([^"]*)"[\s\S]*?<p class="p-item__category[^"]*">([\s\S]*?)<\/p>[\s\S]*?<h3 class="p-item__text">([\s\S]*?)<\/h3>/g;

  for (const match of html.matchAll(itemPattern)) {
    const sourceUrl = absoluteUrl(match[1], pageUrl);
    const productId = sourceUrl.match(/\/item\/([^/]+)\//)?.[1]?.replace("_", "-") ?? slugify(sourceUrl, "pokemon");
    const category = stripTags(match[4]);
    const name = stripTags(match[5]);
    const title = stripTags(match[3]) || [category, name].filter(Boolean).join(" ");
    if (!title || !sourceUrl) {
      continue;
    }

    records.push({
      product_id: productId,
      source_url: sourceUrl,
      list_image_url: absoluteUrl(match[2], pageUrl),
      title,
      category,
      name,
      subline: pokemonSublineFromTitle(title, category),
    });
  }

  return records;
}

function parsePokemonGlobalDetail(html, detailUrl) {
  const title = stripTags(extract(/<h1 class="p-heading__h1-product">([\s\S]*?)<\/h1>/, html));
  const productBlock = extract(/<div class="pg-pg-products__Wrap">([\s\S]*?)<section class="p-section">/, html) ?? html;
  const sliderBlock = extract(/<div class="js-swiper__main pg-products__sliderMain">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="pg-products__contentLeft">/, productBlock) ?? productBlock;
  const images = unique([...sliderBlock.matchAll(/<a href="([^"]+)"\s+data-fancybox="images"/g)].map((match) => absoluteUrl(match[1], detailUrl)));
  const priceText = extract(/<dt class="pg-products__label"><span class="pg-products__labelInner">Price<\/span><\/dt>\s*<dd class="pg-products__labelTxt">([\s\S]*?)<\/dd>/, productBlock);
  const releaseText = extract(/<dt class="pg-products__label"><span class="pg-products__labelInner">Launch date<\/span><\/dt>\s*<dd class="pg-products__labelTxt">([\s\S]*?)<\/dd>/, productBlock);

  return {
    title: title || null,
    images,
    price_jpy: parsePrice(priceText),
    release_date: parseEnglishMonthRelease(releaseText),
  };
}

async function importPokemonGlobalModelKits(legacyModelKits = []) {
  const legacyIdentities = new Set(legacyModelKits.map((kit) => pokemonModelIdentity(kit.names?.en || kit.names?.ja || kit.kit_id)).filter(Boolean));
  const byUrl = new Map();

  for (const pageUrl of POKEMON_GLOBAL_PRODUCTS_URLS) {
    const html = await fetchBrowserText(pageUrl, "https://global.bandai-hobby.net/en-others/site/pokemon/pokepla/");
    for (const listing of parsePokemonGlobalProductList(html, pageUrl)) {
      if (!legacyIdentities.has(pokemonModelIdentity(listing.title))) {
        byUrl.set(listing.source_url, listing);
      }
    }
  }

  const listings = [...byUrl.values()];
  console.log(`Found ${listings.length} additional Bandai Hobby Global Pokemon Model Kit listings.`);

  const details = await mapLimit(listings, 4, async (listing) => {
    try {
      return parsePokemonGlobalDetail(await fetchBrowserText(listing.source_url, "https://global.bandai-hobby.net/en-others/series/pokemon/"), listing.source_url);
    } catch (error) {
      console.warn(`Bandai Hobby Global Pokemon detail fetch failed for ${listing.source_url}: ${error.message}`);
      return { title: null, images: [], release_date: null, price_jpy: null };
    }
  });

  return listings.map((listing, index) => {
    const detail = details[index];
    const title = detail.title || listing.title;
    const images = unique([...detail.images, listing.list_image_url]);
    return buildKit({
      kitId: `pokepla-${listing.product_id}`,
      franchise: "pokemon",
      gradeCode: "POKEPLA",
      subline: listing.subline,
      title,
      names: { ja: null, en: title, zh: null, ko: null },
      boxArtUrl: images[0] ?? listing.list_image_url,
      galleryUrls: images,
      releaseDate: detail.release_date,
      priceJpy: detail.price_jpy,
      isLimited: false,
      sourceId: POKEMON_GLOBAL_SOURCE_ID,
      sourceUrls: [listing.source_url, ...POKEMON_GLOBAL_PRODUCTS_URLS],
      tags: ["pokemon", "bandai hobby", "plastic model", "pokepla"],
      notes: "Imported from the official Bandai Hobby Global Pokemon PLAMO COLLECTION product pages.",
      workOverride: "Pokemon",
      universeOverride: "Pokemon",
    });
  });
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
  const listings = parseGashaponSearchListings(html, resultUrl);
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
        gradeCode,
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

function tamashiiSearchUrl(brandCode, currentPage = 1) {
  const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE_URL);
  url.searchParams.append("brandCode[]", brandCode);
  url.searchParams.append("characterCode[]", "gundam_series");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("current_page", String(currentPage));
  url.searchParams.set("sort", "1");
  url.searchParams.set("area", "japan");
  return url.href;
}

function tamashiiBrandPageUrl(brandCode) {
  return `${TAMASHII_BASE_URL}/item_brand/${brandCode}/?character=gundam_series&ck1=1&ck2=1&ck3=1&number=100&order=new`;
}

function tamashiiItemUrl(item) {
  return `${TAMASHII_BASE_URL}/item/${item.tamashiiWebId}/`;
}

async function fetchTamashiiBrandItems(brand) {
  const firstPage = await fetchJson(tamashiiSearchUrl(brand.brandCode, 1));
  const items = [...(firstPage.data ?? [])];
  const lastPage = firstPage.pagination?.lastPage ?? 1;

  for (let page = 2; page <= lastPage; page += 1) {
    const pageData = await fetchJson(tamashiiSearchUrl(brand.brandCode, page));
    items.push(...(pageData.data ?? []));
  }

  console.log(`Found ${items.length} ${brand.label} Gundam Tamashii listings.`);
  return items;
}

function tamashiiGradeCode(brandName) {
  if (/METAL BUILD/i.test(brandName)) {
    return "METAL_BUILD";
  }
  if (/METAL ROBOT/i.test(brandName)) {
    return "METAL_ROBOT";
  }
  if (/S\.H\.Figuarts/i.test(brandName)) {
    return "SH_FIGUARTS";
  }
  return "ROBOT_SPIRITS";
}

function tamashiiSubline(title, brandName) {
  if (/S\.H\.Figuarts/i.test(brandName)) {
    return "S.H.Figuarts";
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

function buildTamashiiKit(item, detail) {
  const detailUrl = tamashiiItemUrl(item);
  const title = detail.title || stripTags(item.title);
  const brandName = detail.brandName || item.mainBrandName || "ROBOT魂";
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
    releaseDate: detail.release_date ?? item.releaseDateData ?? item.releaseMonth ?? null,
    priceJpy: detail.price_jpy ?? item.price ?? parsePrice(item.priceTaxStr ?? item.priceText),
    isLimited: /限定|抽選|魂ウェブ商店|TAMASHII NATION|魂ストア/i.test(categoryText),
    sourceId: TAMASHII_SOURCE_ID,
    sourceUrls: [detailUrl, tamashiiBrandPageUrl(item.brandCode || "robot_tamashii")],
    tags: ["gundam", "tamashii nations", "collectible figure", gradeCode.toLowerCase().replace(/_/g, "-")],
    notes: `Imported from the official Tamashii Web Gundam ${brandName} catalog and product detail page.`,
    workContext: [detail.work_title],
    workOverride: inferred.work_title ?? detail.work_title,
    universeOverride: inferred.universe,
  });
}

async function importTamashiiGundamFigures() {
  const byWebId = new Map();

  for (const brand of TAMASHII_GUNDAM_BRANDS) {
    const listings = await fetchTamashiiBrandItems(brand);
    for (const item of listings) {
      if (!item.tamashiiWebId || byWebId.has(item.tamashiiWebId)) {
        continue;
      }
      byWebId.set(item.tamashiiWebId, item);
    }
  }

  const listings = [...byWebId.values()].filter((item) => item.thumbnailImg && item.title);
  let detailCount = 0;
  const failedDetails = [];
  const imported = await mapLimit(listings, 4, async (item, itemIndex) => {
    const detailUrl = tamashiiItemUrl(item);
    let detail = { title: null, brandName: null, images: [], price_jpy: null, release_date: null, work_title: null };
    try {
      detail = parseTamashiiProductDetail(await fetchTamashiiDetailText(detailUrl), detailUrl);
      detailCount += 1;
    } catch (error) {
      failedDetails.push({ item, itemIndex, detailUrl, error });
    }

    return buildTamashiiKit(item, detail);
  });

  if (failedDetails.length) {
    console.log(`Retrying ${failedDetails.length} Tamashii detail pages after cooldown.`);
    await sleep(10000);
    for (const failure of failedDetails) {
      try {
        const detail = parseTamashiiProductDetail(await fetchTamashiiDetailText(failure.detailUrl), failure.detailUrl);
        imported[failure.itemIndex] = buildTamashiiKit(failure.item, detail);
        detailCount += 1;
      } catch (error) {
        console.warn(`Tamashii detail fetch failed for ${failure.detailUrl}: ${error.message}`);
      }
      await sleep(1500);
    }
  }

  console.log(`Fetched ${detailCount}/${listings.length} Tamashii Gundam detail pages.`);
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

function parseKotobukiyaACListings(html, pageUrl) {
  const listBlock = extract(/<div class="productList[\s\S]*?<ul class="productList_list">([\s\S]*?)<\/ul>\s*<\/div><!-- \/.productList -->/, html) ?? "";
  const items = listBlock.split('<li class="productList_item">').slice(1);
  const records = [];

  for (const item of items) {
    const title = stripTags(extract(/<p class="productList_title">([\s\S]*?)<\/p>/, item));
    const category = stripTags(extract(/<p class="productList_category">([\s\S]*?)<\/p>/, item));
    const href = extract(/<a href="([^"]+)" class="overMask"/, item);
    const image = extract(/<img src="([^"]+)"/, item);
    const releaseText = stripTags(extract(/<time class="date">([\s\S]*?)<\/time>/, item));

    if (!title || !href || !/プラモデル/.test(category)) {
      continue;
    }

    records.push({
      title,
      category,
      detail_url: absoluteUrl(href, pageUrl),
      image_url: image ? absoluteUrl(image, pageUrl) : null,
      release_date: parseReleaseDate(releaseText),
      is_limited: /限定品|badge-limited/.test(item) || /限定/.test(title),
    });
  }

  return records;
}

function parseSpecValue(html, label) {
  const pattern = new RegExp(`<th>${label}</th>\\s*<td>([\\s\\S]*?)</td>`);
  return stripTags(extract(pattern, html));
}

function parseKotobukiyaACDetail(html, detailUrl) {
  const gallery = unique([
    ...[...html.matchAll(/data-src="([^"]+)"/g)].map((match) => absoluteUrl(match[1], detailUrl)),
    ...[...html.matchAll(/<div class="detailSlider_thumbs">[\s\S]*?<img src="([^"]+)"/g)].map((match) => absoluteUrl(match[1], detailUrl)),
  ]);
  const releaseDate = parseReleaseDate(extract(/detailHeader_set-release[\s\S]*?<dd>([\s\S]*?)<\/dd>/, html));
  const priceJpy = parsePrice(extract(/detailHeader_price-taxIn">([\s\S]*?)<\/span>/, html));
  const scaleText = parseSpecValue(html, "スケール");
  const scale = /^NON/i.test(scaleText) ? "non-scale" : scaleText || "various";
  const series = parseSpecValue(html, "シリーズ") || "Armored Core plastic model";

  return { gallery, release_date: releaseDate, price_jpy: priceJpy, scale, series };
}

async function importKotobukiyaArmoredCore() {
  const html = await fetchText(KOTOBUKIYA_AC_URL);
  const listings = parseKotobukiyaACListings(html, KOTOBUKIYA_AC_URL);
  const imported = [];

  console.log(`Found ${listings.length} Kotobukiya Armored Core plastic model listings.`);

  let detailCount = 0;
  for (const listing of listings) {
    let detail = { gallery: [], release_date: null, price_jpy: null, scale: "various", series: "Armored Core plastic model" };
    try {
      detail = parseKotobukiyaACDetail(await fetchText(listing.detail_url), listing.detail_url);
      detailCount += 1;
    } catch (error) {
      console.warn(`Kotobukiya detail fetch failed for ${listing.detail_url}: ${error.message}`);
    }

    imported.push(
      buildKit({
        kitId: `acvi-${listing.detail_url.match(/\/product\/detail\/p([^/]+)\//)?.[1] ?? slugify(listing.title, "item")}`,
        franchise: "armored_core",
        gradeCode: "ACVI",
        subline: detail.series,
        title: listing.title,
        boxArtUrl: listing.image_url,
        galleryUrls: [listing.image_url, ...detail.gallery],
        releaseDate: detail.release_date ?? listing.release_date,
        priceJpy: detail.price_jpy,
        isLimited: listing.is_limited,
        sourceId: KOTOBUKIYA_AC_SOURCE_ID,
        sourceUrls: [listing.detail_url, KOTOBUKIYA_AC_URL],
        tags: ["armored core", "kotobukiya", "plastic model"],
        notes: "Imported from the official Kotobukiya Armored Core product list and detail pages.",
        workOverride: "Armored Core",
        universeOverride: "Armored Core",
        scale: detail.scale,
      }),
    );
  }

  console.log(`Fetched ${detailCount}/${listings.length} Kotobukiya Armored Core detail pages.`);
  return imported;
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
      is_limited: /限定|イベント|B4ストア|タカラトミーモール/.test(block) || /限定/.test(title),
      index: index + 1,
    });
    index += 1;
  }

  return records;
}

function parseBeybladeXDetail(html, detailUrl, code) {
  const imageKey = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const images = unique(
    [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)]
      .map((match) => match[1])
      .filter((src) => {
        const fileName = new URL(src, detailUrl).pathname.split("/").at(-1)?.toUpperCase() ?? "";
        return fileName.startsWith(imageKey) && !/_LIST\./i.test(fileName);
      })
      .map((src) => absoluteUrl(src, detailUrl)),
  );

  return { images };
}

function beybladeCategoryLabel(category) {
  if (/スターター/.test(category)) return "BEYBLADE X Starter";
  if (/ランダムブースター/.test(category)) return "BEYBLADE X Random Booster";
  if (/ブースター/.test(category)) return "BEYBLADE X Booster";
  if (/セット/.test(category)) return "BEYBLADE X Set";
  if (/ツール/.test(category)) return "BEYBLADE X Tool";
  return "BEYBLADE X";
}

async function importBeybladeX() {
  const html = await fetchBrowserText(BEYBLADE_X_LINEUP_URL, "https://beyblade.takaratomy.co.jp/");
  const listings = parseBeybladeXListings(html, BEYBLADE_X_LINEUP_URL);
  console.log(`Found ${listings.length} Takara Tomy BEYBLADE X listings.`);

  const details = await mapLimit(listings, 6, async (listing) => {
    if (listing.detail_url === BEYBLADE_X_LINEUP_URL) {
      return { images: [] };
    }
    try {
      return parseBeybladeXDetail(await fetchBrowserText(listing.detail_url, BEYBLADE_X_LINEUP_URL), listing.detail_url, listing.code);
    } catch (error) {
      console.warn(`BEYBLADE X detail fetch failed for ${listing.detail_url}: ${error.message}`);
      return { images: [] };
    }
  });

  return listings.map((listing, index) => {
    const images = unique([listing.image_url, ...details[index].images]);
    return buildKit({
      kitId: `beyblade-x-${slugify(listing.href_slug, `${String(listing.index).padStart(3, "0")}-${listing.code.toLowerCase()}`)}`,
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
      boxArtUrl: images[0] ?? null,
      galleryUrls: images,
      releaseDate: listing.release_date,
      priceJpy: listing.price_jpy,
      isLimited: listing.is_limited,
      sourceId: TAKARA_TOMY_BEYBLADE_X_SOURCE_ID,
      sourceUrls: [listing.detail_url, BEYBLADE_X_LINEUP_URL],
      tags: ["beyblade", "beyblade x", "takara tomy", "battle toy"],
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

async function importForte() {
  const listUrl = `${GASHAPON_BASE_URL}/forte/items/`;
  const html = await fetchText(listUrl);
  const entries = parseForteEntries(html, listUrl);
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
        boxArtUrl: entry.image_url,
        galleryUrls: [entry.image_url, ...product.images],
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
    byId.set(kit.kit_id, kit);
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

async function main() {
  const existingDoc = JSON.parse(await readFile("data/kits.json", "utf8"));
  const pokemonModelKits = await importPokemonModelKits();
  const imported = [
    ...(await importCandy()),
    ...(await importEnsemble()),
    ...(await importForte()),
    ...pokemonModelKits,
    ...(await importPokemonGlobalModelKits(pokemonModelKits)),
    ...(await importGashaponSearch({
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
    })),
    ...(await importGashaponSearch({
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
    })),
    ...(await importGashaponSearch({
      label: "Gundam SEED merchandise",
      resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=SEED`,
      franchise: "gundam",
      gradeCode: "GUNDAM_MERCH",
      subline: "Gundam SEED Gashapon Merchandise",
      idPrefix: "gundam-merch",
      tags: ["gundam", "seed", "bandai gashapon", "merchandise"],
      fallbackWork: "Mobile Suit Gundam SEED",
      fallbackUniverse: "CE",
    })),
    ...(await importGashaponSearch({
      label: "Gundam 00 merchandise",
      resultUrl: `${GASHAPON_BASE_URL}/products/result.php?free=${encodeURIComponent("ガンダム00")}`,
      franchise: "gundam",
      gradeCode: "GUNDAM_MERCH",
      subline: "Gundam 00 Gashapon Merchandise",
      idPrefix: "gundam-merch",
      tags: ["gundam", "00", "bandai gashapon", "merchandise"],
      fallbackWork: "Mobile Suit Gundam 00",
      fallbackUniverse: "AD",
    })),
    ...(await importTamashiiGundamFigures()),
    ...(await importBandaiArmoredCore()),
    ...(await importKotobukiyaArmoredCore()),
    ...(await importBeybladeX()),
  ];

  const merged = mergeKits(existingDoc, imported);
  await writeFile("data/kits.json", `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Merged ${imported.length} collectible records. Catalog now has ${merged.kits.length} records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
