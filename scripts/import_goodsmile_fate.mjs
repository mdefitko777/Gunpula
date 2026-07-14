import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const LIST_URL = "https://www.goodsmile.info/en/fgo";
const SOURCE_ID = "good_smile_fate_en";
const GLOBAL_BASE = "https://www.goodsmile.com";
const GLOBAL_SOURCE_ID = "good_smile_fate_global";
const CONCURRENCY = Number(process.env.GSC_FATE_CONCURRENCY || 5);
const DETAIL_LIMIT = Number(process.env.GSC_FATE_DETAIL_LIMIT || 0);
const REQUEST_DELAY_MS = Number(process.env.GSC_FATE_DELAY_MS || 150);
const GLOBAL_PAGE_SIZE = 60;
const GLOBAL_MAX_OFFSET = 6000;

// Title ids from the goodsmile.com search filter for Fate / TYPE-MOON works.
const GLOBAL_TITLE_IDS = [
  7, 82, 83, 84, 85, 86, 87, 107, 288, 372, 405, 420, 431, 791, 883, 1053, 1121, 1170, 1531, 1588, 1639, 1648, 1713, 1790,
  1845, 2025, 2105, 2182, 2256, 2295, 2925, 3172,
];

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
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

function parseDetail(html, productId = null) {
  const title = stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]) || null;
  const productName = fieldValue(html, "Product Name") || title;
  const series = fieldValue(html, "Series") || null;
  const manufacturer = fieldValue(html, "Manufacturer") || null;
  const category = fieldValue(html, "Category") || null;
  const priceText = fieldValue(html, "Price") || null;
  const release = fieldValue(html, "Release Date") || null;
  const allImages = [...html.matchAll(/<img\b[^>]*(?:data-src|src)="([^"]*(?:images\.goodsmile\.info|goodsmile\.global)[^"]*)"/gi)]
    .map((match) => absoluteUrl(match[1]))
    .filter((url) => url && !/\/logo|\/common|\/banner/i.test(url));
  // Detail pages also embed related-product thumbnails; keep only this product's own
  // images (their path contains the product id) when that filter yields anything.
  const ownImages = productId ? allImages.filter((url) => url.includes(`/${productId}/`)) : [];
  const images = ownImages.length ? ownImages : allImages;
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

function globalFilterParam() {
  return encodeURIComponent(
    JSON.stringify({
      search_keyword: "",
      search_over18: false,
      search_category: [],
      search_maker: [],
      search_title: GLOBAL_TITLE_IDS,
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
}

function absoluteGlobalUrl(url) {
  if (!url) return null;
  return new URL(url, GLOBAL_BASE).href;
}

function parseGlobalCards(html) {
  const cards = [];
  const itemPattern = /<a class="p-product-list__link" href="(\/en\/product\/(\d+)[^"]*)">([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(itemPattern)) {
    const [, href, productId, body] = match;
    const name = stripTags(/<h2 class="c-title[^"]*">([\s\S]*?)<\/h2>/i.exec(body)?.[1]) || null;
    if (!name) continue;
    const image = absoluteGlobalUrl(/(?:src)="([^"]*gsc-webrevo-sdk-storage-prd\/product\/image\/[^"]*)"/i.exec(body)?.[1]);
    const price = parsePrice(stripTags(/<span class="c-price__main">([\s\S]*?)<\/span>/i.exec(body)?.[1]));
    const labels = [...body.matchAll(/<li class="c-label[\s\S]*?">([\s\S]*?)<\/li>/g)].map((label) => stripTags(label[1]));
    cards.push({
      productId,
      name,
      image,
      price_jpy: price,
      labels,
      url: absoluteGlobalUrl(href),
    });
  }
  const byId = new Map();
  for (const card of cards) {
    byId.set(card.productId, card);
  }
  return [...byId.values()];
}

async function fetchGlobalCards() {
  const cards = [];
  for (let offset = 0; offset <= GLOBAL_MAX_OFFSET; offset += GLOBAL_PAGE_SIZE) {
    const url = `${GLOBAL_BASE}/en/search/list?filter=${globalFilterParam()}&orderBy=1&limit=${GLOBAL_PAGE_SIZE}&offset=${offset}&couponId=null&searchIndex=-1`;
    const page = parseGlobalCards(await fetchText(url));
    cards.push(...page);
    if (page.length < GLOBAL_PAGE_SIZE) break;
  }
  const byId = new Map();
  for (const card of cards) {
    byId.set(card.productId, card);
  }
  return [...byId.values()];
}

async function fetchGlobalDetail(card) {
  let html = await fetchText(`${GLOBAL_BASE}/en/product/${card.productId}`);
  const redirect = /<title>Redirecting to (https?:\/\/[^<\s]+)/i.exec(html)?.[1];
  if (redirect) {
    html = await fetchText(decodeHtml(redirect));
  }
  return parseGlobalDetail(html, card.productId);
}

function parseGlobalDetail(html, productId) {
  const fields = {};
  const fieldPattern = /<dt class="b-outline-table__term">[\s\S]*?<h3[^>]*>([^<]*)<\/h3>[\s\S]*?<\/dt>\s*<dd class="b-outline-table__desc">([\s\S]*?)<\/dd>/g;
  for (const match of html.matchAll(fieldPattern)) {
    fields[match[1].trim().toLowerCase()] = stripTags(match[2]);
  }
  const productName = stripTags(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]) || null;
  // Shipping month appears as either "Shipping 01/2027" or "Shipping 2025/11".
  const shipping = /Shipping\s*(?:(\d{1,2})\/(\d{4})|(\d{4})\/(\d{1,2}))/i.exec(html);
  const releaseDate = shipping
    ? shipping[3]
      ? `${shipping[3]}-${shipping[4].padStart(2, "0")}`
      : `${shipping[2]}-${shipping[1].padStart(2, "0")}`
    : normalizeReleaseDate(fields["release date"]);

  let structured = null;
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed["@type"] === "Product") structured = parsed;
    } catch {
      // Ignore malformed structured data and fall back to markup scraping.
    }
  }
  const structuredImages = (Array.isArray(structured?.image) ? structured.image : [structured?.image]).filter(Boolean);
  const mainImage = absoluteGlobalUrl(structuredImages[0] || /property="og:image" content="([^"]*)"/i.exec(html)?.[1]);

  // Gallery images use two url shapes: products created on goodsmile.com use
  // product/image/{productId}/{hash}, while records migrated from goodsmile.info keep
  // product/image/product/{date}/{legacyId}/... — match the legacy id via the main image.
  const legacyId = /product\/image\/product\/\d{8}\/(\d+)\//.exec(mainImage || "")?.[1] || null;
  const anyImagePattern = /(?:https:\/\/www\.goodsmile\.com)?\/gsc-webrevo-sdk-storage-prd\/product\/image\/(?:(\d+)|product\/\d{8}\/(\d+))\/[^"'\\\s)<]+/g;
  const galleryImages = [...html.matchAll(anyImagePattern)]
    .filter((match) => match[1] === String(productId) || (legacyId && match[2] === legacyId))
    .map((match) => absoluteGlobalUrl(match[0]));
  const images = [...new Set([mainImage, ...galleryImages].filter(Boolean))];

  return {
    productName: structured?.name || productName,
    series: fields.series || null,
    category: structured?.category || null,
    manufacturer:
      fields.manufacturer ||
      fields["distributed by"] ||
      (typeof structured?.brand === "string" ? structured.brand : structured?.brand?.name) ||
      null,
    price_jpy: parsePrice(/<span class="c-price__main">([\s\S]*?)<\/span>/i.exec(html)?.[1]) ?? parsePrice(structured?.offers?.price),
    release_date: releaseDate,
    images,
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

function lineNameFor(name) {
  const text = String(name || "");
  if (/Nendoroid Doll/i.test(text)) return "Nendoroid Doll";
  if (/Nendoroid/i.test(text)) return "Nendoroid";
  if (/figma/i.test(text)) return "figma";
  if (/POP UP PARADE/i.test(text)) return "POP UP PARADE";
  if (/MODEROID/i.test(text)) return "MODEROID";
  if (/PLAMAX/i.test(text)) return "PLAMAX";
  if (/Plushie|Plush/i.test(text)) return "Plushie";
  if (/1\/(?:4|6|7|8|10|12)/.test(text)) return "Scale Figure";
  return null;
}

function toGlobalKit(card, detail = {}) {
  const name = detail.productName || card.name;
  const line = lineNameFor(name) || detail.category || null;
  const manufacturer = detail.manufacturer || "Good Smile Company";
  const imageUrls = [...new Set([...(detail.images || []), card.image].filter(Boolean))];
  const workTitle = seriesKeyFor(detail.series, name);
  const gradeCode = gradeForCategory(`${detail.category || ""} ${line || ""}`, name);
  const labelText = (card.labels || []).join(" ");
  return {
    kit_id: `goodsmile-fate-g${card.productId}`,
    franchise: "fate",
    grade_code: gradeCode,
    subline: line || gradeCode,
    number: null,
    scale: scaleFor(name),
    names: {
      ja: name,
      en: name,
      zh: name,
      ko: name,
    },
    images: {
      box_art_url: imageUrls[0] || null,
      box_art_source_id: imageUrls[0] ? GLOBAL_SOURCE_ID : null,
    },
    gallery_image_urls: imageUrls,
    universe: "Fate",
    work_title: workTitle,
    release_date: detail.release_date || null,
    price_jpy: detail.price_jpy ?? card.price_jpy ?? null,
    is_limited: /Exclusive|Limited|特典|限定|WonFes|Event/i.test(`${name} ${labelText}`),
    data_status: "verified",
    source_urls: [card.url],
    source_refs: [
      {
        source_id: GLOBAL_SOURCE_ID,
        url: card.url,
        fields: ["names", "grade_code", "subline", "release_date", "price_jpy", "images", "work_title"],
        confidence: "high",
      },
    ],
    tags: [...new Set(["fate", "fgo", "good smile", manufacturer, line, workTitle].filter(Boolean).map((value) => String(value).toLowerCase()))],
    notes: "Imported from Good Smile Company official global store (goodsmile.com).",
  };
}

function nameKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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

  // Legacy goodsmile.info FGO listing (frozen around 2024, still hosts working images).
  const html = await fetchText(LIST_URL);
  const cards = parseCards(html);
  const detailCards = DETAIL_LIMIT > 0 ? cards.slice(0, DETAIL_LIMIT) : cards;
  const details = new Map();
  let detailErrors = 0;

  await mapLimit(detailCards, CONCURRENCY, async (card) => {
    try {
      details.set(card.productId, parseDetail(await fetchText(card.url), card.productId));
    } catch (error) {
      detailErrors += 1;
      details.set(card.productId, { error_message: error.message });
    }
  });

  const importedKits = cards.map((card) => toKit(card, details.get(card.productId) || {}));
  let kits = mergeCatalog(catalog.kits, importedKits);

  // Current goodsmile.com global store: covers products announced after the legacy
  // listing stopped updating. Product ids live in a different namespace, so new kits
  // use a `g` prefix and products already known from the legacy list are matched by name.
  const globalCards = await fetchGlobalCards();
  const fateByName = new Map();
  for (const kit of kits) {
    if (kit.franchise === "fate") fateByName.set(nameKey(kit.names?.en), kit);
  }
  const knownCards = [];
  const newCards = [];
  const refreshCards = [];
  for (const card of globalCards) {
    const kit = fateByName.get(nameKey(card.name));
    if (!kit) {
      newCards.push(card);
    } else if (
      kit.kit_id === `goodsmile-fate-g${card.productId}` &&
      (!kit.images?.box_art_url || (kit.gallery_image_urls || []).length < 2)
    ) {
      // A kit we previously imported from the global store but with incomplete media —
      // re-fetch its detail page instead of only patching the card image. (Release dates
      // are not a trigger: long-released products often have none on the page at all.)
      refreshCards.push(card);
    } else {
      knownCards.push(card);
    }
  }

  for (const card of knownCards) {
    const kit = fateByName.get(nameKey(card.name));
    if (!kit.images?.box_art_url && card.image) {
      kit.images = { box_art_url: card.image, box_art_source_id: GLOBAL_SOURCE_ID };
    }
    if (card.image && !(kit.gallery_image_urls || []).includes(card.image)) {
      kit.gallery_image_urls = [...(kit.gallery_image_urls || []), card.image];
    }
    if (kit.price_jpy == null && card.price_jpy != null) kit.price_jpy = card.price_jpy;
    if (!(kit.source_urls || []).includes(card.url)) {
      kit.source_urls = [...(kit.source_urls || []), card.url];
    }
  }

  const detailTargets = [...newCards, ...refreshCards];
  const globalDetailCards = DETAIL_LIMIT > 0 ? detailTargets.slice(0, DETAIL_LIMIT) : detailTargets;
  const globalDetails = new Map();
  let globalDetailErrors = 0;
  await mapLimit(globalDetailCards, CONCURRENCY, async (card) => {
    try {
      globalDetails.set(card.productId, await fetchGlobalDetail(card));
    } catch (error) {
      globalDetailErrors += 1;
      globalDetails.set(card.productId, { error_message: error.message });
    }
  });
  const globalKits = globalDetailCards.map((card) => {
    const kit = toGlobalKit(card, globalDetails.get(card.productId) || {});
    const previous = fateByName.get(nameKey(card.name));
    if (previous) {
      if (!kit.release_date && previous.release_date) kit.release_date = previous.release_date;
      if (kit.price_jpy == null && previous.price_jpy != null) kit.price_jpy = previous.price_jpy;
      if (!kit.images.box_art_url && previous.images?.box_art_url) {
        kit.images = { ...previous.images };
        kit.gallery_image_urls = [...new Set([...(previous.gallery_image_urls || []), ...kit.gallery_image_urls])];
      }
    }
    return kit;
  });
  kits = mergeCatalog(kits, globalKits);

  const nextCatalog = {
    ...catalog,
    updated_at: today(),
    kits,
  };
  await writeFile(CATALOG_PATH, `${JSON.stringify(nextCatalog, null, 2)}\n`, "utf8");
  const withBoxArt = globalKits.filter((kit) => kit.images.box_art_url).length;
  console.log(
    `Good Smile Fate: legacy ${importedKits.length} products (detail errors ${detailErrors}); ` +
      `global store ${globalCards.length} products, matched ${knownCards.length}, refreshed ${refreshCards.length}, new ${newCards.length} ` +
      `(${withBoxArt}/${globalKits.length} detail-fetched kits with box art, detail errors ${globalDetailErrors}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
