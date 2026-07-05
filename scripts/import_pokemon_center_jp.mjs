import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const SOURCE_ID = "pokemon_center_jp";
const CATEGORY_URL = "https://www.pokemoncenter-online.com/plush-toys/";

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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseProducts(html) {
  const products = [];
  const pattern = /<li class="product" data-pid="([^"]+)">([\s\S]*?)<\/li>/g;
  for (const match of html.matchAll(pattern)) {
    const [, pid, body] = match;
    const href = /<p class="txt">\s*<a href="([^"]+)">/i.exec(body)?.[1] || `/${pid}.html`;
    const name = stripTags(/<p class="txt">\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(body)?.[1]);
    const image = /<img[^>]*src="([^"]+)"/i.exec(body)?.[1] || null;
    const price = Number((stripTags(/<p class="price[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/i.exec(body)?.[1]).match(/\d[\d,]*/) || [""])[0].replace(/,/g, ""));
    if (!pid || !name) continue;
    products.push({
      pid,
      name,
      url: new URL(href, "https://www.pokemoncenter-online.com").href,
      image,
      price_jpy: Number.isInteger(price) ? price : null,
    });
  }
  return products;
}

function gradeForProduct(name) {
  if (/ぬいぐるみ|マスコット|Plush/i.test(name)) return "POKE_PLUSH";
  return "POKE_GOODS";
}

function toKit(product) {
  const gradeCode = gradeForProduct(product.name);
  return {
    kit_id: `pokemon-center-${product.pid}`,
    franchise: "pokemon",
    grade_code: gradeCode,
    subline: gradeCode === "POKE_PLUSH" ? "Pokemon Center Plush" : "Pokemon Center Goods",
    number: product.pid,
    scale: "non-scale",
    names: {
      ja: product.name,
      en: product.name,
      zh: product.name,
      ko: product.name,
    },
    images: {
      box_art_url: product.image,
      box_art_source_id: product.image ? SOURCE_ID : null,
    },
    gallery_image_urls: product.image ? [product.image] : [],
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: null,
    price_jpy: product.price_jpy,
    is_limited: false,
    data_status: "verified",
    source_urls: [product.url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: product.url,
        fields: ["names", "price_jpy", "images", "grade_code"],
        confidence: "high",
      },
    ],
    tags: ["pokemon", "pokemon center", gradeCode.toLowerCase()],
    notes: "Imported from Pokemon Center Online Japan category page.",
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

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const html = await fetchText(CATEGORY_URL);
const importedKits = parseProducts(html).map(toKit);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: mergeCatalog(catalog.kits, importedKits) }, null, 2)}\n`, "utf8");
console.log(`Pokemon Center Japan: imported ${importedKits.length} products from plush/toys category page.`);
