import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const LIST_URL = "https://www.goodsmile.info/en/fgo";
const SOURCE_ID = "good_smile_fate_en";
const CONCURRENCY = Number(process.env.GSC_FATE_CONCURRENCY || 5);
const DETAIL_LIMIT = Number(process.env.GSC_FATE_DETAIL_LIMIT || 0);

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function decodeHtml(value = "") {
  return String(value)
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

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " "));
}

function absoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return new URL(url, "https://www.goodsmile.info").href;
  return url;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Gunpula catalog importer (+https://github.com/mdefitko777/Gunpula)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit(items, limit, worker) {
  let next = 0;
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

function parseCards(html) {
  const cards = [];
  const anchorPattern = /<a\b[^>]*href="([^"]*\/en\/product\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?<span class="infosection">[\s\S]*?<\/span>[\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(anchorPattern)) {
    const [, href, productId, body] = match;
    if (!/matomeproduct/.test(body)) continue;
    const name =
      stripTags(/<span class="itemName">([\s\S]*?)<\/span>/i.exec(body)?.[1]) ||
      decodeHtml(/<img\b[^>]*alt="([^"]*)"/i.exec(body)?.[1]) ||
      null;
    if (!name) continue;
    const category =
      stripTags(/<span class="hitTypeName[^"]*">([\s\S]*?)<\/span>/i.exec(body)?.[1]).replace(/\s+\d+$/, "") ||
      decodeHtml(/matomeproduct\s+([a-z0-9_-]+)/i.exec(body)?.[1]) ||
      "Figure";
    const number = stripTags(/<span class="hitTypeNum">([\s\S]*?)<\/span>/i.exec(body)?.[1]) || null;
    const manufacturer = stripTags(/<span class="itemCmp">([\s\S]*?)<\/span>/i.exec(body)?.[1]) || "Good Smile Company";
    const image = absoluteUrl(/<img\b[^>]*src="([^"]*)"/i.exec(body)?.[1]);
    const releaseDate = stripTags(/Release Date:\s*([^<]+)/i.exec(body)?.[1]) || null;
    cards.push({
      productId,
      name,
      category,
      number,
      manufacturer,
      image,
      release_date: normalizeReleaseDate(releaseDate),
      url: absoluteUrl(href),
    });
  }

  const byId = new Map();
  for (const card of cards) {
    byId.set(card.productId, card);
  }
  return [...byId.values()];
}

function parseDetail(html) {
  const title = stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]) || null;
  const productName = fieldValue(html, "Product Name") || title;
  const series = fieldValue(html, "Series") || null;
  const manufacturer = fieldValue(html, "Manufacturer") || null;
  const category = fieldValue(html, "Category") || null;
  const priceText = fieldValue(html, "Price") || null;
  const release = fieldValue(html, "Release Date") || null;
  const images = [...html.matchAll(/<img\b[^>]*(?:data-src|src)="([^"]*(?:images\.goodsmile\.info|goodsmile\.global)[^"]*)"/gi)]
    .map((match) => absoluteUrl(match[1]))
    .filter((url) => url && !/\/logo|\/common|\/banner/i.test(url));
  return {
    productName,
    series,
    manufacturer,
    category,
    price_jpy: parsePrice(priceText),
    release_date: normalizeReleaseDate(release),
    images: [...new Set(images)],
  };
}

function fieldValue(html, label) {
  const patterns = [
    new RegExp(`<dt[^>]*>\\s*${label}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i"),
    new RegExp(`<th[^>]*>\\s*${label}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, "i"),
    new RegExp(`<span[^>]*class="[^"]*ttl[^"]*"[^>]*>\\s*${label}\\s*<\\/span>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>`, "i"),
  ];
  for (const pattern of patterns) {
    const value = stripTags(pattern.exec(html)?.[1] || "");
    if (value) return value;
  }
  return null;
}

function normalizeReleaseDate(value) {
  const text = String(value || "").trim();
  const match = /(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?/.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  return day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : `${year}-${month.padStart(2, "0")}`;
}

function parsePrice(value) {
  const match = /(?:¥|JPY)?\s*([\d,]+)/.exec(String(value || ""));
  if (!match) return null;
  const price = Number(match[1].replace(/,/g, ""));
  return Number.isInteger(price) ? price : null;
}

function gradeForCategory(category, name) {
  const text = `${category || ""} ${name || ""}`;
  if (/Nendoroid/i.test(text)) return "NENDOROID";
  if (/figma|action/i.test(text)) return "FATE_ACTION";
  if (/Goods|Accessory|Apparel|Stationery|Keychain|Acrylic|Plush|Doll/i.test(text)) return "FATE_GOODS";
  if (/Prize/i.test(text)) return "FATE_PRIZE";
  return "FATE_SCALE";
}

function scaleFor(name) {
  return /(1\/(?:4|6|7|8|10|12))/.exec(name)?.[1] || "non-scale";
}

function seriesKeyFor(series, name) {
  const text = `${series || ""} ${name || ""}`;
  if (/Grand Order|FGO/i.test(text)) return "Fate/Grand Order";
  if (/stay night|Heaven'?s Feel|Unlimited Blade Works/i.test(text)) return "Fate/stay night";
  if (/Zero/i.test(text)) return "Fate/Zero";
  if (/EXTRA|EXTELLA/i.test(text)) return "Fate/EXTRA";
  if (/Apocrypha/i.test(text)) return "Fate/Apocrypha";
  if (/Kara no Kyoukai|Garden of Sinners|Mahoutsukai|Tsukihime|TYPE-MOON/i.test(text)) return "TYPE-MOON";
  return series || "Fate";
}

function toKit(card, detail = {}) {
  const name = detail.productName || card.name;
  const category = detail.category || card.category;
  const manufacturer = detail.manufacturer || card.manufacturer || "Good Smile Company";
  const imageUrls = [...new Set([card.image, ...(detail.images || [])].filter(Boolean))];
  const workTitle = seriesKeyFor(detail.series, name);
  const gradeCode = gradeForCategory(category, name);
  return {
    kit_id: `goodsmile-fate-${card.productId}`,
    franchise: "fate",
    grade_code: gradeCode,
    subline: category || gradeCode,
    number: card.number,
    scale: scaleFor(name),
    names: {
      ja: name,
      en: name,
      zh: name,
      ko: name,
    },
    images: {
      box_art_url: imageUrls[0] || null,
      box_art_source_id: imageUrls[0] ? SOURCE_ID : null,
    },
    gallery_image_urls: imageUrls,
    universe: "Fate",
    work_title: workTitle,
    release_date: detail.release_date || card.release_date,
    price_jpy: detail.price_jpy ?? null,
    is_limited: /Exclusive|Limited|特典|限定|WonFes|Event/i.test(`${name} ${category}`),
    data_status: "verified",
    source_urls: [card.url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: card.url,
        fields: ["names", "grade_code", "subline", "release_date", "price_jpy", "images", "work_title"],
        confidence: "high",
      },
    ],
    tags: [...new Set(["fate", "fgo", "good smile", manufacturer, category, workTitle].filter(Boolean).map((value) => String(value).toLowerCase()))],
    notes: "Imported from Good Smile Company official Fate/FGO catalog.",
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

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const html = await fetchText(LIST_URL);
  const cards = parseCards(html);
  const detailCards = DETAIL_LIMIT > 0 ? cards.slice(0, DETAIL_LIMIT) : cards;
  const details = new Map();
  let detailErrors = 0;

  await mapLimit(detailCards, CONCURRENCY, async (card) => {
    try {
      details.set(card.productId, parseDetail(await fetchText(card.url)));
    } catch (error) {
      detailErrors += 1;
      details.set(card.productId, { error_message: error.message });
    }
  });

  const importedKits = cards.map((card) => toKit(card, details.get(card.productId) || {}));
  const nextCatalog = {
    ...catalog,
    updated_at: today(),
    kits: mergeCatalog(catalog.kits, importedKits),
  };
  await writeFile(CATALOG_PATH, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
  console.log(`Good Smile Fate: imported ${importedKits.length} products, detail errors ${detailErrors}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
