// Fate / TYPE-MOON merchandise from the vendors Good Smile does not cover.
//
// Until now the whole Fate catalog came from goodsmile.info + goodsmile.com,
// so every figure released by another maker was simply missing. These five
// sources all render their listings server-side (or expose a JSON endpoint),
// so one request per page is enough:
//
//   * Aniplex+        — online.aniplex.co.jp, Salesforce Commerce search grid
//   * 一番くじ        — 1kuji.com, "Fate関連作品" title filter (id 444)
//   * バンプレスト景品 — bsp-prize.jp, Fate シリーズ title page (IP00004797)
//   * 寿屋            — shop.kotobukiya.co.jp keyword search (Shift-JIS)
//   * 魂ウェブ        — tamashiiweb.com search_item.php, Fate character codes
//
// Aniplex+ is by far the largest: its keyword search drifts into unrelated
// products past the exact matches, so results are kept only when the tile's
// series line (or, when that is blank, the title) names a Fate/TYPE-MOON work.
import { readFile, writeFile } from "node:fs/promises";
import {
  decodeKotobukiyaShopHtml,
  parseKotobukiyaShopDetail,
  parseKotobukiyaShopListings,
} from "./lib/kotobukiya-shop.mjs";

const CATALOG_PATH = "data/kits.json";
const REQUEST_DELAY_MS = Number(process.env.FATE_EXTRA_DELAY_MS || 150);
const ANIPLEX_MAX_PAGES = Number(process.env.FATE_ANIPLEX_MAX_PAGES || 40);
const ANIPLEX_PAGE_SIZE = 48;
const ANIPLEX_BASE = "https://online.aniplex.co.jp";
const ANIPLEX_GRID = `${ANIPLEX_BASE}/on/demandware.store/Sites-ANX-Site/ja_JP/Search-UpdateGrid`;
const TAMASHII_BASE = "https://tamashiiweb.com";

// Character codes on 魂ウェブ that map to Fate works.
const TAMASHII_CHARACTER_CODES = ["fate_series", "fate_zero"];

// A tile belongs to the catalog when its series line names a Fate/TYPE-MOON
// work. Aniplex+ also sells other IPs whose text happens to contain "fate".
const FATE_WORK_PATTERN =
  /Fate|TYPE[-\s]?MOON|型月|Fate\/|FGO|月姫|Tsukihime|空の境界|Kara no Kyoukai|魔法使いの夜|Mahoutsukai|カルデア|サーヴァント|霊基/i;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&yen;/g, "¥")
    // Collaboration titles use &times; ("崩壊：スターレイル&times;Fate/stay night").
    .replace(/&times;/g, "×")
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRaw(url, extraHeaders = {}) {
  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GunpulaCatalog/1.0; +https://github.com/mdefitko777/Gunpula)",
        "Accept-Language": "ja,en;q=0.8",
        ...extraHeaders,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, extraHeaders) {
  return (await fetchRaw(url, extraHeaders)).text();
}

async function fetchJson(url, extraHeaders) {
  return (await fetchRaw(url, { accept: "application/json", ...extraHeaders })).json();
}

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

// Japanese release copy: "2026年08月29日(土)より順次発売予定" / "2026年7月".
function releaseDateFrom(text) {
  const value = String(text || "");
  const full = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(value);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const month = /(\d{4})\s*年\s*(\d{1,2})\s*月/.exec(value);
  if (month) return `${month[1]}-${month[2].padStart(2, "0")}`;
  const iso = /(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(value);
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

function isFateProduct(product) {
  return FATE_WORK_PATTERN.test(`${product.series || ""} ${product.name || ""}`);
}

// Mirrors the classification the Good Smile importer uses so items from
// different vendors land in the same catalog categories.
function gradeForProduct(product) {
  const text = `${product.name || ""} ${product.line || ""} ${product.series || ""}`;
  if (/ねんどろいど|ネンドロイド|Nendoroid/i.test(text)) return "NENDOROID";
  if (/figma|アクションフィギュア|S\.H\.Figuarts|フィギュアーツ/i.test(text)) return "FATE_ACTION";
  if (/ガシャポン|カプセル|ガチャ/i.test(text)) return "FATE_GASHAPON";
  if (/一番くじ|プライズ|景品|ちびぐるみ|ぬいぐるみ/i.test(text)) return "FATE_PRIZE";
  if (/1\/\d|スケール|フィギュア|Figure|POP UP PARADE|ARTFX|美少女/i.test(text)) return "FATE_SCALE";
  return "FATE_GOODS";
}

function scaleFor(name) {
  return /(1\/(?:3|4|6|7|8|10|12))/.exec(String(name || ""))?.[1] || "non-scale";
}

function workTitleFor(product) {
  const text = `${product.series || ""} ${product.name || ""}`;
  if (/Grand Order|FGO/i.test(text)) return "Fate/Grand Order";
  if (/stay night|Heaven'?s Feel|Unlimited Blade Works|UBW/i.test(text)) return "Fate/stay night";
  if (/Zero/i.test(text)) return "Fate/Zero";
  if (/EXTRA|EXTELLA/i.test(text)) return "Fate/EXTRA";
  if (/Apocrypha/i.test(text)) return "Fate/Apocrypha";
  if (/strange Fake/i.test(text)) return "Fate/strange Fake";
  if (/Samurai Remnant/i.test(text)) return "Fate/Samurai Remnant";
  if (/Prisma|kaleid|イリヤ/i.test(text)) return "Fate/kaleid liner";
  if (/月姫|Tsukihime|空の境界|Kara no Kyoukai|魔法使いの夜|TYPE-MOON|型月/i.test(text)) return "TYPE-MOON";
  return product.series || "Fate";
}

// ---------------------------------------------------------------- Aniplex+

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

// The Aniplex+ Fate search returns ~1700 products, but ~96% of them are flat
// goods (缶バッジ, クリアファイル, アクリルスタンド) whose grid tiles carry no
// release date at all. Importing those would bury the figures this catalog is
// about — and contribute nothing to the release timeline. Set
// FATE_ANIPLEX_INCLUDE_GOODS=1 to take the whole storefront instead.
const ANIPLEX_FIGURE_PATTERN =
  /フィギュア|スケール|ねんどろいど|ネンドロイド|figma|POP UP PARADE|ARTFX|完成品|ドール|ガレージキット|Figure/i;
const ANIPLEX_INCLUDE_GOODS = process.env.FATE_ANIPLEX_INCLUDE_GOODS === "1";

function parseAniplexDetail(html) {
  // "2027年7月発売予定" sits right under the product title; the お届け時期 block
  // repeats it. Both are distinct from the 予約受付期間 order window, which is
  // why a bare year-month search over the page is not good enough.
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
  return {
    release_date: release
      ? [release[1], release[2].padStart(2, "0"), release[3]?.padStart(2, "0")].filter(Boolean).join("-")
      : null,
    images: (Array.isArray(structured?.image) ? structured.image : [structured?.image])
      .filter(Boolean)
      .map((url) => absolute(url, ANIPLEX_BASE)),
    work_title: decodeHtml(/作品名[\s\S]{0,80}?[:：]\s*([^<]{2,60})/.exec(html)?.[1] || "") || null,
  };
}

async function fetchAniplex() {
  const byKey = new Map();
  for (let page = 0; page < ANIPLEX_MAX_PAGES; page += 1) {
    const start = page * ANIPLEX_PAGE_SIZE;
    const html = await fetchText(`${ANIPLEX_GRID}?q=Fate&start=${start}&sz=${ANIPLEX_PAGE_SIZE}`, {
      "X-Requested-With": "XMLHttpRequest",
    });
    const products = parseAniplexGrid(html);
    for (const product of products) {
      if (!isFateProduct(product)) continue;
      if (!ANIPLEX_INCLUDE_GOODS && !ANIPLEX_FIGURE_PATTERN.test(product.name)) continue;
      byKey.set(product.key, product);
    }
    if (products.length < ANIPLEX_PAGE_SIZE) break;
  }

  // Only the kept products get a detail fetch, for the release date and the
  // full gallery. A detail failure downgrades the record rather than losing it.
  for (const product of byKey.values()) {
    try {
      const detail = parseAniplexDetail(await fetchText(product.url));
      product.release_date = detail.release_date || product.release_date;
      product.series = detail.work_title || product.series;
      if (detail.images.length) {
        product.image = detail.images[0];
        product.gallery = detail.images;
      }
    } catch (error) {
      console.warn(`aniplex_plus_fate_jp detail ${product.key}: ${error.message}`);
    }
  }
  return [...byKey.values()];
}

// ---------------------------------------------------------------- 一番くじ

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
      image: /<img src="([^"]+)"/.exec(block)?.[1] || "",
      release_date: releaseDateFrom(decodeHtml(/<p class="date">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
      is_limited: true,
    });
  }
  return out;
}

// ------------------------------------------------------- バンプレスト景品

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

// ------------------------------------------------------------------- 寿屋

const KOTOBUKIYA_SHOP_URL = "https://shop.kotobukiya.co.jp/shop/goods/search.aspx?keyword=Fate&search.x=on&ps=90";

async function fetchKotobukiyaHtml(url) {
  const response = await fetchRaw(url);
  return decodeKotobukiyaShopHtml(new Uint8Array(await response.arrayBuffer()));
}

async function fetchKotobukiya() {
  const listings = parseKotobukiyaShopListings(await fetchKotobukiyaHtml(KOTOBUKIYA_SHOP_URL), KOTOBUKIYA_SHOP_URL);
  const products = [];
  for (const listing of listings) {
    // The shop's listing tiles carry no price or release date, so each of the
    // (few) Fate products needs its detail page. A detail failure downgrades
    // the record rather than dropping it.
    let detail = {};
    try {
      detail = parseKotobukiyaShopDetail(await fetchKotobukiyaHtml(listing.detail_url), listing.detail_url);
    } catch (error) {
      console.warn(`kotobukiya_fate_jp detail ${listing.product_id}: ${error.message}`);
    }
    products.push({
      key: listing.product_id,
      name: detail.title || listing.title,
      // parseKotobukiyaShopDetail defaults work_title to Armored Core, so the
      // Fate importer only trusts the field when it does not say that.
      series: /Armored Core/i.test(detail.work_title || "") ? "" : detail.work_title || "",
      line: detail.category || "寿屋",
      url: listing.detail_url,
      image: (detail.gallery || [])[0] || listing.image_url || "",
      price_jpy: detail.price_jpy ?? null,
      release_date: detail.release_date || null,
      is_limited: Boolean(listing.is_limited),
    });
  }
  return products;
}

// --------------------------------------------------------------- 魂ウェブ

async function fetchTamashii() {
  const byKey = new Map();
  for (const characterCode of TAMASHII_CHARACTER_CODES) {
    for (let page = 1; page <= 20; page += 1) {
      const url = new URL("/api/site-item/search_item.php", TAMASHII_BASE);
      url.searchParams.append("characterCode[]", characterCode);
      url.searchParams.set("per_page", "40");
      url.searchParams.set("current_page", String(page));
      const payload = await fetchJson(url.href, { referer: `${TAMASHII_BASE}/item_character/${characterCode}/` });
      const items = payload?.data || [];
      for (const item of items) {
        if (!item?.tamashiiWebId) continue;
        byKey.set(item.tamashiiWebId, {
          key: item.tamashiiWebId,
          name: item.title,
          // Product titles here are bare character names ("花の魔術師マーリン"),
          // so the work can only come from the character filter that found
          // them — and `fate_series` is the catch-all, so it stays generic.
          series: characterCode === "fate_zero" ? "Fate/Zero" : "Fate",
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
  return [...byKey.values()];
}

// --------------------------------------------------------------------------

const SOURCES = [
  {
    source_id: "aniplex_plus_fate_jp",
    idPrefix: "aniplex-fate",
    subline: "Aniplex+",
    tags: ["fate", "aniplex plus", "aniplex"],
    fetchAll: fetchAniplex,
    notes: "Imported from the Aniplex+ official store (Fate keyword search).",
  },
  {
    source_id: "ichiban_kuji_fate_jp",
    idPrefix: "ichibankuji-fate",
    subline: "一番くじ",
    tags: ["fate", "ichiban kuji", "prize"],
    // 444 is the "Fate関連作品" title in the 1kuji.com search filter.
    pages: ["https://1kuji.com/products/search?index_master_search=444"],
    parse: parseIchibanKuji,
    notes: "Imported from the Ichiban Kuji official lineup (Fate title filter).",
  },
  {
    source_id: "banpresto_prize_fate_jp",
    idPrefix: "banpresto-fate",
    subline: "バンプレスト景品",
    tags: ["fate", "banpresto", "prize"],
    pages: ["https://bsp-prize.jp/title/IP00004797/"],
    parse: parseBanpresto,
    notes: "Imported from the Banpresto prize-figure site (Fate title page).",
  },
  {
    source_id: "kotobukiya_fate_jp",
    idPrefix: "kotobukiya-fate",
    subline: "寿屋",
    tags: ["fate", "kotobukiya", "figure"],
    fetchAll: fetchKotobukiya,
    notes: "Imported from the Kotobukiya online shop (Fate keyword search).",
  },
  {
    source_id: "tamashii_web_fate_jp",
    idPrefix: "tamashii-fate",
    subline: "魂ウェブ",
    tags: ["fate", "tamashii", "bandai spirits", "figure"],
    fetchAll: fetchTamashii,
    notes: "Imported from the Tamashii Web catalog (Fate character filter).",
  },
];

function toKit(product, source, index) {
  const id = slugify(product.key || product.name, String(index));
  const gallery = [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))];
  const image = gallery[0] || null;
  const gradeCode = gradeForProduct(product);
  return {
    kit_id: `${source.idPrefix}-${id}`,
    franchise: "fate",
    grade_code: gradeCode,
    subline: product.line || source.subline,
    number: null,
    scale: scaleFor(product.name),
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: {
      box_art_url: image,
      box_art_source_id: image ? source.source_id : null,
    },
    gallery_image_urls: gallery,
    universe: "Fate",
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
    return (
      String(b.release_date || "").localeCompare(String(a.release_date || "")) ||
      String(a.kit_id).localeCompare(String(b.kit_id))
    );
  });
}

const imported = [];
const report = [];
for (const source of SOURCES) {
  let products = [];
  try {
    if (source.fetchAll) {
      products = await source.fetchAll();
    } else {
      for (const page of source.pages) {
        products = products.concat(source.parse(await fetchText(page), page));
      }
    }
  } catch (error) {
    // One dead vendor must never take the whole daily refresh down; the
    // silent-loss check in check_source_health.mjs reports the empty source.
    console.warn(`${source.source_id}: ${error.message}`);
  }
  const seen = new Set();
  const unique = products.filter((product) => {
    if (!product.key || seen.has(product.key)) return false;
    seen.add(product.key);
    return true;
  });
  imported.push(...unique.map((product, index) => toKit(product, source, index)));
  report.push(`${source.source_id} ${unique.length}`);
}

if (!imported.length) {
  console.error("No products parsed from any extra Fate source; leaving the catalog untouched.");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const merged = mergeCatalog(catalog.kits, imported);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
console.log(
  `Extra Fate sources — ${report.join(", ")}; catalog now ${merged.filter((kit) => kit.franchise === "fate").length} Fate records.`,
);
