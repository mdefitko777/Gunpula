import { readFile, writeFile } from "node:fs/promises";

const CANDY_BASE_URL = "https://www.bandai.co.jp";
const GASHAPON_BASE_URL = "https://gashapon.jp";
const CANDY_SOURCE_ID = "bandai_candy_gundam_jp";
const GASHAPON_SOURCE_ID = "bandai_gashapon_gundam_jp";

const CANDY_BRANDS = [
  { code: "CONVERGE", slug: "converge", label: "FW GUNDAM CONVERGE" },
  { code: "GFRAME", slug: "gframe", label: "Mobile Suit Gundam G Frame FA" },
  { code: "MOBILITY", slug: "mobilityJoint", label: "MOBILITY JOINT GUNDAM" },
  { code: "ARTIFACT", slug: "artifact", label: "Gundam Artifact" },
  { code: "SUPERIOR", slug: "superiordefine", label: "Gundam Superior Define" },
];

const WORK_RULES = [
  { title: "Mobile Suit Gundam SEED Freedom", universe: "CE", pattern: /ライジングフリーダム|イモータルジャスティス|マイティーストライクフリーダム|ブラックナイトスコード|ゲルググメナース|ギャンシュトローム|デスティニーガンダムSpecII|SEED FREEDOM/i },
  { title: "Mobile Suit Gundam SEED C.E.73 Stargazer", universe: "CE", pattern: /スターゲイザー|ストライクノワール|ヴェルデバスター|ブルデュエル|ドレッドノート|105ダガー|スローターダガー|ケルベロスバクゥ|ストライクE/i },
  { title: "Mobile Suit Gundam SEED Destiny", universe: "CE", pattern: /デスティニー|インパルス|ストライクフリーダム|インフィニットジャスティス|セイバーガンダム|ガイアガンダム|アビスガンダム|カオスガンダム|レジェンドガンダム|アカツキ|ムラサメ|ウィンダム|DESTINY/i },
  { title: "Mobile Suit Gundam SEED Astray", universe: "CE", pattern: /アストレイ|ASTRAY|レッドフレーム|ブルーフレーム|ゴールドフレーム/i },
  { title: "Mobile Suit Gundam SEED", universe: "CE", pattern: /エールストライク|ストライクガンダム|ストライクルージュ|イージス|デュエル|バスター|ブリッツ|フリーダムガンダム|ジャスティスガンダム|プロヴィデンス|カラミティ|フォビドゥン|レイダー|ラゴゥ|バクゥ|シグー|モビルジン|ゲイツ|SEED/i },
  { title: "Mobile Suit Gundam 00", universe: "AD", pattern: /ダブルオー|ガンダム00|00クアンタ|クアンタ|エクシア|デュナメス|キュリオス|ヴァーチェ|ナドレ|アストレア|ケルディム|アリオス|セラヴィー|セラフィム|オーライザー|ジンクス|ティエレン|スサノオ|フラッグ|スローネ|アルケー|アヘッド|ガデッサ|ガラッゾ|リボーンズ|ブレイヴ/i },
  { title: "Mobile Suit Gundam: The Witch from Mercury", universe: "Ad Stella", pattern: /水星の魔女|エアリアル|ルブリス|キャリバーン|ファラクト|ディランザ|デミ|ベギル|ミカエリス|シュバルゼッテ|ガンヴォルヴァ|ザウォート|ダリルバルデ/i },
  { title: "Mobile Suit Gundam GQuuuuuuX", universe: "unknown", pattern: /GQuuuuuuX|ジークアクス|白いガンダム|赤いガンダム|軽キャノン|GFreD/i },
  { title: "Mobile Suit Gundam: Iron-Blooded Orphans", universe: "Post Disaster", pattern: /鉄血|バルバトス|グシオン|キマリス|グレイズ|フラウロス|バエル|ヴィダール|百里|百錬|マンロディ|ロディ|マルコシアス|アスタロト|ダンタリオン|レギンレイズ|グリムゲルデ/i },
  { title: "Mobile Suit Gundam AGE", universe: "AG", pattern: /ガンダムAGE|AGE-|ガフラン|ゼダス|Gエグゼス|ジェノアス|ダナジン|レギルス|ギラーガ|ゼイドラ|ファルシア|クランシェ|アデル/i },
  { title: "Mobile Suit Gundam Wing Endless Waltz", universe: "AC", pattern: /Endless Waltz|\bEW\b|ウイングガンダムゼロ|Wガンダムゼロ|デスサイズヘル|サーペント/i },
  { title: "Mobile Suit Gundam Wing", universe: "AC", pattern: /ウイングガンダム|デスサイズ|ヘビーアームズ|サンドロック|シェンロン|トールギス|エピオン|リーオー|マグアナック/i },
  { title: "Mobile Fighter G Gundam", universe: "FC", pattern: /Gガンダム|ゴッドガンダム|シャイニングガンダム|マスターガンダム|ノーベルガンダム|ドラゴンガンダム|ガンダムローズ|マックスター|デビルガンダム/i },
  { title: "After War Gundam X", universe: "AW", pattern: /ガンダムX|ガンダムダブルエックス|エアマスター|レオパルド|ベルティゴ/i },
  { title: "Turn A Gundam", universe: "CC", pattern: /∀|ターンエー|ターンX|スモー|カプル/i },
  { title: "Gundam Reconguista in G", universe: "Regild Century", pattern: /Gのレコンギスタ|G-セルフ|G-アルケイン|G-ルシファー|グリモア|マックナイフ|ジャハナム|カバカーリー/i },
  { title: "Gundam Build Series", universe: "Build", pattern: /ビルド|ダイバー|コアガンダム|アースリィ|ユーラヴェン|ベアッガイ|プチッガイ|ふみな|トライオン|アメイジング|フェニーチェ|スクランブル|ラーガンダム|プルタイン|ティフォエウス/i },
  { title: "Advance of Zeta", universe: "UC", pattern: /A\.O\.Z|TR-1|TR-6|ヘイズル|ウーンドウォート|ハイゼンスレイ|フルドド/i },
  { title: "Mobile Suit Gundam Narrative", universe: "UC", pattern: /ナラティブガンダム|ガンダムNT/i },
  { title: "Mobile Suit Moon Gundam", universe: "UC", pattern: /ムーンガンダム|バルギル/i },
  { title: "Gundam Sentinel", universe: "UC", pattern: /Sガンダム|Ex-S|FAZZ|Zプラス|ゼータプラス|ディープストライカー|ゼク・アイン|ネロ/i },
  { title: "Mobile Suit Crossbone Gundam", universe: "UC", pattern: /クロスボーン|ゴーストガンダム|ファントムガンダム|鋼鉄の7人/i },
  { title: "Mobile Suit Gundam Hathaway", universe: "UC", pattern: /閃光のハサウェイ|Ξガンダム|ペーネロペー|メッサー/i },
  { title: "Gundam Thunderbolt", universe: "UC", pattern: /サンダーボルト|フルアーマー・ガンダム|サイコ・ザク|アトラスガンダム/i },
  { title: "Mobile Suit Gundam: The Origin", universe: "UC", pattern: /THE ORIGIN|オリジン|局地型ガンダム|ブグ/i },
  { title: "Mobile Suit Gundam Unicorn", universe: "UC", pattern: /ユニコーン|バンシィ|フェネクス|シナンジュ|クシャトリヤ|ジェスタ|リゼル|デルタプラス|デルタガンダム|シルヴァ・バレト|ローゼン・ズール|ギラ・ズール|ネェル・アーガマ/i },
  { title: "Mobile Suit Gundam: Char's Counterattack", universe: "UC", pattern: /逆襲のシャア|νガンダム|Hi-ν|サザビー|ナイチンゲール|ヤクト・ドーガ|ギラ・ドーガ|α・アジール|リ・ガズィ|ジェガン/i },
  { title: "Mobile Suit Gundam F91", universe: "UC", pattern: /F91|ビギナ・ギナ|デナン|ベルガ|ヘビーガン/i },
  { title: "Mobile Suit V Gundam", universe: "UC", pattern: /Vガンダム|ヴィクトリー|V2|セカンドV|ガンイージ/i },
  { title: "Mobile Suit Gundam 0083: Stardust Memory", universe: "UC", pattern: /0083|GP01|GP02|GP03|ガーベラ|デンドロビウム|ステイメン|ノイエ・ジール|ドラッツェ/i },
  { title: "Mobile Suit Gundam 0080: War in the Pocket", universe: "UC", pattern: /0080|アレックス|NT-1|ケンプファー|ハイゴッグ|ズゴックE|ザクII改/i },
  { title: "Mobile Suit Gundam: The 08th MS Team", universe: "UC", pattern: /08小隊|Ez-8|陸戦型|グフカスタム/i },
  { title: "Mobile Suit Gundam ZZ", universe: "UC", pattern: /ZZ|ダブルゼータ|ハンマ・ハンマ|キュベレイ|ドーベン・ウルフ|ザクIII|バウ|クィン・マンサ|ドライセン|ズサ/i },
  { title: "Mobile Suit Z Gundam", universe: "UC", pattern: /Zガンダム|Ζ|ゼータガンダム|ZII|ガンダムMk-II|百式|リック・ディアス|メタス|ネモ|ハイザック|マラサイ|バーザム|アッシマー|ギャプラン|ジ・O|ディジェ|ガルバルディ/i },
  { title: "Mobile Suit Gundam MSV", universe: "UC", pattern: /G-3ガンダム|フルアーマーガンダム|パーフェクトガンダム|ジョニー・ライデン|シン・マツナガ|高機動型ザク/i },
  { title: "Mobile Suit Gundam", universe: "UC", pattern: /RX-78|ガンダム\(アニメカラー|ガンダム\(ロールアウト|ガンダム Ver\.|Gファイター|ガンキャノン|ガンタンク|シャア専用|ザク|グフ|ドム|ズゴック|ゲルググ|ジオング|アッガイ|ゾック|ギャン|ジム|ボール|ララァ専用/i },
  { title: "SD Gundam", universe: "SD", pattern: /SD|BB戦士|武者|頑駄無|騎士ガンダム|ナイトガンダム|サタンガンダム|コマンドガンダム/i },
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
  if (!yen) {
    return null;
  }
  return Number(yen[1].replace(/,/g, ""));
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
    ["CONVERGE", "GFRAME", "MOBILITY", "ARTIFACT", "SUPERIOR", "MSE", "GSF"].includes(gradeCode) &&
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
        },
      });
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw lastError;
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
  gradeCode,
  subline,
  title,
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
}) {
  const inferredWork = inferWork(title, ...workContext);
  const work = inferredWork.work_title ? inferredWork : fallbackWork(title, gradeCode, subline);
  return {
    kit_id: kitId,
    grade_code: gradeCode,
    subline,
    number: null,
    scale: "non-scale",
    names: {
      ja: title,
      en: null,
      zh: null,
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
        fields: ["names", "grade_code", "subline", "scale", "release_date", "price_jpy", "images", "gallery_image_urls", "work_title", "universe"],
        confidence: "high",
      },
    ],
    tags,
    notes,
  };
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
  const byId = new Map(existingDoc.kits.map((kit) => [kit.kit_id, kit]));
  for (const kit of imported) {
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
      "Individual Gunpla kit and Bandai official Gundam collectible catalog imported from Japanese official BANDAI SPIRITS, Bandai Candy, and Bandai Gashapon sources. Records are needs_review until field-level human checks are complete.",
    kits,
  };
}

async function main() {
  const existingDoc = JSON.parse(await readFile("data/kits.json", "utf8"));
  const imported = [
    ...(await importCandy()),
    ...(await importEnsemble()),
    ...(await importForte()),
  ];

  const merged = mergeKits(existingDoc, imported);
  await writeFile("data/kits.json", `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Merged ${imported.length} collectible records. Catalog now has ${merged.kits.length} records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
