// Nintendo figures, model kits and prizes from the hobby makers.
//
// The nintendo franchise was built from store.nintendo.co.kr alone, so it held
// games, hardware, amiibo and goods but not a single figure or model kit. The
// makers below publish in Japanese only, which is why lib/nintendo-kr.mjs also
// matches Japanese now — otherwise every record here falls through to "other".
//
//   * 寿屋        — kotobukiya.co.jp title pages, read through the Wayback
//                   Machine: the live site answers 403 and the shop search
//                   lists in-stock items only, so the ゼノブレイド2 セイレーン
//                   and ゼノブレイドクロス フォーミュラ kits are invisible there.
//   * Good Smile  — goodsmile.com keyword search, one pass per work
//   * 一番くじ     — 1kuji.com title filters 332 マリオ · 377 スプラトゥーン ·
//                   410 星のカービィ · 454 ゼルダの伝説 · 513 どうぶつの森
//   * 魂ウェブ     — tamashiiweb.com character codes super_mario,
//                   legend_of_zelda, metroid_prime4_beyond
//   * バンプレスト — bsp-prize.jp title IP00002055 (星のカービィ)
//
// Checked and left out (2026-11-19): www.kotobukiya.co.jp answers 403 to
// scripts, ホビーサーチ (1999.co.jp) answers a Cloudflare challenge, AmiAmi and
// MyFigureCollection answer 403, and store-jp.nintendo.com renders its catalog
// in the browser only. Flat goods are not imported, same as the other
// franchises.
import { readFile, writeFile } from "node:fs/promises";
import { seriesFor } from "./lib/nintendo-kr.mjs";

const CATALOG_PATH = "data/kits.json";
const REQUEST_DELAY_MS = Number(process.env.NINTENDO_HOBBY_DELAY_MS || 250);
const ONLY = process.env.NINTENDO_HOBBY_ONLY || "";

const KOTO_WAYBACK = "https://web.archive.org/web/29991231id_/https://www.kotobukiya.co.jp/title";
const KOTO_SITE = "https://www.kotobukiya.co.jp";
const KOTO_TITLES = [["xenoblade2", "ゼノブレイド2"], ["xenobladex", "ゼノブレイドクロス"]];
const GSC_BASE = "https://www.goodsmile.com";
// Good Smile's own work filter, read off the checkboxes on /en/search
// (`id="title<N>"`). A keyword search drifts badly here — "Pikmin" returns
// Cinnamoroll and Pompompurin — and the result blocks carry no work of their
// own to check against, so the work has to come from the query itself.
// Pokémon titles are deliberately absent: they are their own franchise.
const GSC_TITLES = [
  [458, "どうぶつの森"],
  [379, "ファイアーエムブレム"], [901, "ファイアーエムブレム"], [756, "ファイアーエムブレム"],
  [890, "ファイアーエムブレム"], [920, "ファイアーエムブレム"], [1798, "ファイアーエムブレム"],
  [653, "星のカービィ"], [2843, "星のカービィ"], [1029, "星のカービィ"],
  [2414, "メトロイド"], [297, "メトロイド"], [1234, "メトロイド"],
  [2796, "ピクミン"],
  [1186, "スプラトゥーン"], [1517, "スプラトゥーン"],
  [510, "マリオ"],
  [940, "ゼルダの伝説"], [1182, "ゼルダの伝説"], [752, "ゼルダの伝説"], [199, "ゼルダの伝説"],
  [512, "ゼルダの伝説"], [1108, "ゼルダの伝説"], [2815, "ゼルダの伝説"],
  [1218, "ゼノブレイド"], [2511, "ゼノブレイド"], [1874, "ゼノブレイド"],
];
const KUJI_TITLES = [[332, "スーパーマリオブラザーズ"], [377, "スプラトゥーン"], [410, "星のカービィ"], [454, "ゼルダの伝説"], [513, "どうぶつの森"]];
const TAMASHII_BASE = "https://tamashiiweb.com";
const TAMASHII_CODES = [["super_mario", "マリオ"], ["legend_of_zelda", "ゼルダの伝説"], ["metroid_prime4_beyond", "メトロイド"]];
const BSP_TITLES = [["IP00002055", "星のカービィ"]];

// A product counts as Nintendo when its text names one of the works. The Good
// Smile keyword search in particular drifts well past the exact matches.
const NINTENDO_TEXT =
  /ゼルダ|ハイラル|ムジュラ|コログ|Zelda|マリオ|ルイージ|ピーチ|ワリオ|クッパ|キノピオ|Mario|Luigi|Peach|スプラトゥーン|Splatoon|カービィ|Kirby|ゼノブレイド|セイレーン|フォーミュラ|ホムラ|ヒカリ|Xenoblade|Pyra|Mythra|ピクミン|Pikmin|メトロイド|Metroid|サムス|Samus|ファイアー?エムブレム|Fire Emblem|どうぶつの森|Animal Crossing|ドンキーコング|Donkey Kong|ヨッシー|Yoshi|スマッシュブラザーズ|Smash Bros/i;
// Good Smile's search matches these on substrings ("carbonia" holds "nia").
const NINTENDO_DROP = /carbonia|babylonia|lonsdaleite|chitocerium|Mariage|marionette/i;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&yen;/g, "¥")
    .replace(/&times;/g, "×")
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRaw(url, extraHeaders = {}, timeoutMs = 30000) {
  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "ja,en;q=0.8",
      ...extraHeaders,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response;
}

const fetchText = (url, headers, timeoutMs) => fetchRaw(url, headers, timeoutMs).then((r) => r.text());
const fetchJson = (url, headers) => fetchRaw(url, { accept: "application/json", ...headers }).then((r) => r.json());

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

function releaseDateFrom(text) {
  const value = String(text || "");
  const full = /(\d{4})\s*[年.\/-]\s*(\d{1,2})\s*[月.\/-]\s*(\d{1,2})/.exec(value);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const month = /(\d{4})\s*[年.\/-]\s*(\d{1,2})/.exec(value);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}`;
  return null;
}

function parseYen(text) {
  const match = /([\d,]+)/.exec(String(text || "").replace(/[^\d,]/g, " "));
  if (!match) return null;
  const price = Number(match[1].replace(/,/g, ""));
  return Number.isInteger(price) && price > 0 ? price : null;
}

function slugify(value, fallback) {
  const slug = String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug || fallback;
}

function isNintendo(product) {
  const text = `${product.name || ""} ${product.work || ""} ${product.line || ""}`;
  return NINTENDO_TEXT.test(text) && !NINTENDO_DROP.test(text);
}

// The name decides when it says what the product is. Good Smile's scale
// figures are titled with nothing but the character ("Pyra", "KOS-MOS"), so
// the fallback is the source's own main line rather than a guess from the
// text — otherwise those land as trading figures.
function gradeForProduct(product, fallbackGrade) {
  const text = `${product.name || ""} ${product.line || ""} ${product.category || ""}`;
  if (/プラモデル|プラモ|plastic model|模型/i.test(text)) return "NIN_PLAMO";
  if (/ぬいぐるみ|plush|ちびぐるみ|マスコット/i.test(text)) return "NIN_PLUSH";
  if (/一番くじ|プライズ|景品|prize/i.test(text)) return "NIN_PRIZE";
  if (/ねんどろいど|Nendoroid|figma|S\.H\.Figuarts|フィギュアーツ|アクションフィギュア/i.test(text)) return "NIN_ACTION";
  if (/ガシャポン|カプセル|トレーディング|trading|ミニフィギュア/i.test(text)) return "NIN_MINI";
  if (/1\/\d|スケール|scale|POP UP PARADE|フィギュア|figure/i.test(text)) return "NIN_SCALE";
  return fallbackGrade;
}

function scaleFor(name) {
  return /(1\/(?:3|4|6|7|8|10|12|20))/.exec(String(name || ""))?.[1] || "non-scale";
}

// --------------------------------------------------------------------- 寿屋

function parseKotobukiyaTitle(html, pageUrl, work) {
  const out = [];
  for (const chunk of String(html || "").split('<li class="productList_item">').slice(1)) {
    const block = chunk.split("</li>")[0];
    const name = decodeHtml(/<p class="productList_title">([\s\S]*?)<\/p>/.exec(block)?.[1]);
    if (!name) continue;
    const href = /<a href="([^"]+)" class="overMask"/.exec(block)?.[1];
    const image = /<img src="([^"]+)"/.exec(block)?.[1];
    out.push({
      key: href ? href.replace(/\W+/g, "") : slugify(name, "koto"),
      name,
      work,
      line: "寿屋",
      category: decodeHtml(/<p class="productList_category">([\s\S]*?)<\/p>/.exec(block)?.[1]),
      url: href ? absolute(href, KOTO_SITE) : pageUrl,
      image: image ? absolute(image, KOTO_SITE) : "",
      release_date: releaseDateFrom(decodeHtml(/<time class="date">([\s\S]*?)<\/time>/.exec(block)?.[1])),
      price_jpy: null,
      is_limited: /限定/.test(name),
    });
  }
  return out;
}

async function fetchKotobukiya() {
  const out = [];
  for (const [slug, work] of KOTO_TITLES) {
    try {
      const html = await fetchText(`${KOTO_WAYBACK}/${slug}/`, {}, 60000);
      out.push(...parseKotobukiyaTitle(html, `${KOTO_SITE}/title/${slug}/`, work));
    } catch (error) {
      console.warn(`  kotobukiya ${slug}: ${error.message}`);
    }
  }
  return out;
}

// --------------------------------------------------------------- Good Smile

function gscFilter(titleId) {
  return encodeURIComponent(JSON.stringify({
    search_keyword: "", search_over18: false, search_category: [], search_maker: [],
    search_title: [titleId], search_status: "0", release_date_from: "", release_date_to: "",
    search_bonus: false, search_exclusive: false, search_sale: false, search_sales_origin: false, tag: [],
  }));
}

async function fetchGoodSmile() {
  const byKey = new Map();
  for (const [titleId, work] of GSC_TITLES) {
    for (let offset = 0; offset <= 240; offset += 60) {
      let html;
      try {
        html = await fetchText(`${GSC_BASE}/en/search/list?filter=${gscFilter(titleId)}&orderBy=1&limit=60&offset=${offset}&couponId=null&searchIndex=-1`);
      } catch (error) {
        console.warn(`  good smile title ${titleId}: ${error.message}`);
        break;
      }
      const blocks = html.split('<div class="p-product-list__item">').slice(1);
      for (const block of blocks) {
        const id = /href="\/en\/product\/(\d+)"/.exec(block)?.[1];
        const name = decodeHtml(/<h2 class="c-title[^"]*">([\s\S]*?)<\/h2>/.exec(block)?.[1]);
        if (!id || !name) continue;
        const image = /(?:src)="([^"]*gsc-webrevo-sdk-storage-prd\/product\/image\/[^"]*)"/.exec(block)?.[1];
        byKey.set(id, {
          key: id, name, work, line: "Good Smile Company", category: "",
          url: `${GSC_BASE}/en/product/${id}`,
          image: image ? absolute(image, GSC_BASE) : "",
          release_date: null,
          price_jpy: parseYen(decodeHtml(/<span class="c-price__main">([\s\S]*?)<\/span>/.exec(block)?.[1])),
          is_limited: /Exclusive|Limited|限定/i.test(name),
        });
      }
      if (blocks.length < 60) break;
    }
  }
  return [...byKey.values()];
}

// ----------------------------------------------------------------- 一番くじ

async function fetchIchibanKuji() {
  const out = [];
  for (const [id, work] of KUJI_TITLES) {
    try {
      const pageUrl = `https://1kuji.com/products/search?index_master_search=${id}`;
      const html = await fetchText(pageUrl);
      for (const block of html.match(/<a href="\/products\/[a-zA-Z0-9_-]+"[\s\S]{0,900}?<\/a>/g) || []) {
        const name = decodeHtml(/<p class="itemName">([\s\S]*?)<\/p>/.exec(block)?.[1]);
        if (!name) continue;
        const slug = /<a href="\/products\/([a-zA-Z0-9_-]+)"/.exec(block)?.[1] || "";
        out.push({
          key: slug, name, work, line: "一番くじ", category: "一番くじ",
          url: absolute(`/products/${slug}`, pageUrl),
          image: /<img src="([^"]+)"/.exec(block)?.[1] || "",
          release_date: releaseDateFrom(decodeHtml(/<p class="date">([\s\S]*?)<\/p>/.exec(block)?.[1])),
          price_jpy: null,
          is_limited: true,
        });
      }
    } catch (error) {
      console.warn(`  ichiban kuji ${work}: ${error.message}`);
    }
  }
  return out;
}

// ------------------------------------------------------------ バンプレスト

async function fetchBanpresto() {
  const out = [];
  for (const [id, work] of BSP_TITLES) {
    try {
      const pageUrl = `https://bsp-prize.jp/title/${id}/`;
      const html = await fetchText(pageUrl);
      for (const block of html.match(/<div class="products_item">[\s\S]{0,900}?<\/div>/g) || []) {
        const name = decodeHtml(/<p class="products_name">([\s\S]*?)<\/p>/.exec(block)?.[1]);
        if (!name) continue;
        const itemId = /<a href="\/item\/(\d+)\/?"/.exec(block)?.[1] || "";
        const image = /<img src="([^"]+)"/.exec(block)?.[1] || "";
        out.push({
          key: itemId, name, work, line: "バンプレスト景品", category: "景品",
          url: absolute(`/item/${itemId}/`, pageUrl),
          image: image ? absolute(image, pageUrl) : "",
          release_date: releaseDateFrom(decodeHtml(/<p class="products_date">([\s\S]*?)<\/p>/.exec(block)?.[1])),
          price_jpy: null,
          is_limited: true,
        });
      }
    } catch (error) {
      console.warn(`  banpresto ${work}: ${error.message}`);
    }
  }
  return out;
}

// ------------------------------------------------------------------ 魂ウェブ

async function fetchTamashii() {
  const byKey = new Map();
  for (const [code, work] of TAMASHII_CODES) {
    for (let page = 1; page <= 20; page += 1) {
      const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE);
      url.searchParams.append("characterCode[]", code);
      url.searchParams.set("per_page", "40");
      url.searchParams.set("current_page", String(page));
      let payload;
      try {
        payload = await fetchJson(url.href, { referer: `${TAMASHII_BASE}/item_character/${code}/` });
      } catch (error) {
        console.warn(`  tamashii ${code}: ${error.message}`);
        break;
      }
      for (const item of payload?.data || []) {
        if (!item?.tamashiiWebId) continue;
        byKey.set(item.tamashiiWebId, {
          key: item.tamashiiWebId,
          name: item.title,
          // Product titles here are bare character names, so the work comes
          // from the character filter that found them.
          work,
          line: item.mainBrandName || "魂ウェブ",
          category: item.mainBrandName || "",
          url: `${TAMASHII_BASE}/item/${item.tamashiiWebId}/`,
          image: item.thumbnailImg ? absolute(item.thumbnailImg, payload.asset_base_url || TAMASHII_BASE) : "",
          release_date: item.releaseDateData || item.releaseMonth || null,
          price_jpy: Number.isInteger(item.price) ? item.price : null,
          is_limited: item.categoryData?.code !== "M",
        });
      }
      const pagination = payload?.pagination;
      if (!pagination || pagination.currentPage >= pagination.lastPage) break;
    }
  }
  return [...byKey.values()];
}

// --------------------------------------------------------------------------

const SOURCES = [
  { source_id: "kotobukiya_nintendo_jp", defaultGrade: "NIN_PLAMO", idPrefix: "kotobukiya-nin", subline: "寿屋", tags: ["nintendo", "kotobukiya"], fetchAll: fetchKotobukiya,
    notes: "Imported from the Kotobukiya title pages (Xenoblade), read through the Wayback Machine because the live site answers 403." },
  { source_id: "good_smile_nintendo_jp", defaultGrade: "NIN_SCALE", idPrefix: "goodsmile-nin", subline: "Good Smile Company", tags: ["nintendo", "good smile"], fetchAll: fetchGoodSmile,
    notes: "Imported from the Good Smile Company official store (per-work keyword search)." },
  { source_id: "ichiban_kuji_nintendo_jp", defaultGrade: "NIN_PRIZE", idPrefix: "ichibankuji-nin", subline: "一番くじ", tags: ["nintendo", "ichiban kuji", "prize"], fetchAll: fetchIchibanKuji,
    notes: "Imported from the Ichiban Kuji official lineup (Nintendo title filters)." },
  { source_id: "banpresto_prize_nintendo_jp", defaultGrade: "NIN_PRIZE", idPrefix: "banpresto-nin", subline: "バンプレスト景品", tags: ["nintendo", "banpresto", "prize"], fetchAll: fetchBanpresto,
    notes: "Imported from the Banpresto prize site (Nintendo title pages)." },
  { source_id: "tamashii_web_nintendo_jp", defaultGrade: "NIN_ACTION", idPrefix: "tamashii-nin", subline: "魂ウェブ", tags: ["nintendo", "tamashii", "bandai spirits"], fetchAll: fetchTamashii,
    notes: "Imported from the Tamashii Web catalog (Nintendo character filters)." },
];

function toKit(product, source, index) {
  const id = slugify(product.key || product.name, String(index));
  const image = product.image || null;
  const gradeCode = gradeForProduct(product, source.defaultGrade);
  const series = seriesFor(`${product.name} ${product.work || ""}`);
  return {
    kit_id: `${source.idPrefix}-${id}`,
    franchise: "nintendo",
    grade_code: gradeCode,
    subline: product.line || source.subline,
    number: null,
    scale: scaleFor(product.name),
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: { box_art_url: image, box_art_source_id: image ? source.source_id : null },
    gallery_image_urls: image ? [image] : [],
    series,
    universe: "Nintendo",
    work_title: series.labels?.en || "Other",
    release_date: product.release_date || null,
    price_jpy: product.price_jpy ?? null,
    is_limited: Boolean(product.is_limited),
    data_status: "verified",
    source_urls: [product.url],
    source_refs: [{ source_id: source.source_id, url: product.url, fields: ["names", "images", "grade_code", "release_date", "price_jpy"], confidence: "high" }],
    tags: [...new Set([...source.tags, gradeCode.toLowerCase()])],
    notes: source.notes,
  };
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
    return String(b.release_date || "").localeCompare(String(a.release_date || "")) || String(a.kit_id).localeCompare(String(b.kit_id));
  });
}

const imported = [];
const report = [];
for (const source of SOURCES) {
  if (ONLY && source.source_id !== ONLY) continue;
  let products = [];
  try {
    products = await source.fetchAll();
  } catch (error) {
    console.warn(`${source.source_id}: ${error.message}`);
    report.push(`${source.source_id} FAILED`);
    continue;
  }
  const seen = new Set();
  const kept = products.filter((product) => {
    if (!product.key || seen.has(product.key) || !isNintendo(product)) return false;
    seen.add(product.key);
    return true;
  });
  imported.push(...kept.map((product, index) => toKit(product, source, index)));
  report.push(`${source.source_id} ${kept.length}/${products.length}`);
}

if (!imported.length) {
  console.error("No Nintendo hobby products parsed; leaving the catalog untouched.");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const merged = mergeCatalog(catalog.kits, imported);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
console.log(`Nintendo hobby — ${report.join(", ")}; catalog now ${merged.filter((kit) => kit.franchise === "nintendo").length} Nintendo records.`);
