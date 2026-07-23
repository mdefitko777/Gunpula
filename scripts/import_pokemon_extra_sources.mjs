// Extra official Pokemon merchandise lines the catalog was missing:
//   * 一番くじ (Ichiban Kuji) — 1kuji.com, filtered to the Pokemon title id
//   * バンプレスト景品 (Banpresto prize) — bsp-prize.jp, Pokemon title page
// Both render products as plain server-side HTML blocks, so one fetch per
// listing page is enough. Bandai Candy and Re-ment were evaluated too but
// render their catalogues client-side, so they are not scrapable this way.
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";

const SOURCES = [
  {
    source_id: "ichiban_kuji_jp",
    grade_code: "POKE_KUJI",
    subline: "一番くじ",
    tags: ["pokemon", "ichiban kuji", "prize"],
    idPrefix: "ichibankuji",
    pages: ["https://1kuji.com/products/search?index_master_search=47"],
    parse: parseIchibanKuji,
    notes: "Imported from the Ichiban Kuji official lineup (Pokemon title filter).",
  },
  {
    source_id: "banpresto_prize_jp",
    grade_code: "POKE_PRIZE",
    subline: "バンプレスト景品",
    tags: ["pokemon", "banpresto", "prize"],
    idPrefix: "banpresto",
    pages: ["https://bsp-prize.jp/title/IP00002054/"],
    parse: parseBanpresto,
    notes: "Imported from the Banpresto prize-figure site (Pokemon title page).",
  },
  {
    source_id: "good_smile_global",
    grade_code: "POKE_FIGURE",
    subline: "Good Smile / Nendoroid",
    tags: ["pokemon", "good smile", "nendoroid", "figure"],
    idPrefix: "gsc-pokemon",
    // Same storefront API the Fate importer uses; 559 is the Pokemon title id.
    pages: [
      `https://www.goodsmile.com/en/search/list?filter=${encodeURIComponent(JSON.stringify({ search_title: [559] }))}&orderBy=1&limit=60&offset=0&couponId=null&searchIndex=-1`,
    ],
    parse: parseGoodSmile,
    notes: "Imported from the Good Smile Company global storefront (Pokemon title filter).",
  },
];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GunpulaCatalog/1.0; +https://github.com/mdefitko777/Gunpula)",
        "Accept-Language": "ja,en;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function absolute(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return "";
  }
}

// Japanese release copy: "2026年08月29日(土)より順次発売予定" / "2026年7月" .
function releaseDateFrom(text) {
  const full = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/.exec(text);
  if (full) return `${full[1]}-${String(full[2]).padStart(2, "0")}-${String(full[3]).padStart(2, "0")}`;
  const month = /(\d{4})年\s*(\d{1,2})月/.exec(text);
  if (month) return `${month[1]}-${String(month[2]).padStart(2, "0")}`;
  return null;
}

function slugify(value, fallback) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function parseIchibanKuji(html, pageUrl) {
  const out = [];
  for (const block of html.match(/<a href="\/products\/[a-zA-Z0-9_-]+"[\s\S]{0,900}?<\/a>/g) || []) {
    const name = decodeHtml(/<p class="itemName">([\s\S]*?)<\/p>/.exec(block)?.[1] || "");
    if (!name) continue;
    const slug = /<a href="\/products\/([a-zA-Z0-9_-]+)"/.exec(block)?.[1] || "";
    out.push({
      key: slug,
      name,
      url: absolute(`/products/${slug}`, pageUrl),
      image: /<img src="([^"]+)"/.exec(block)?.[1] || "",
      release_date: releaseDateFrom(decodeHtml(/<p class="date">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
    });
  }
  return out;
}

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
      url: absolute(`/item/${id}/`, pageUrl),
      image: image ? absolute(image, pageUrl) : "",
      release_date: releaseDateFrom(decodeHtml(/<p class="products_date">([\s\S]*?)<\/p>/.exec(block)?.[1] || "")),
    });
  }
  return out;
}

function parseGoodSmile(html, pageUrl) {
  const out = [];
  // The card puts the number before the title and the price after it, so the
  // block has to span the whole item, not stop at </h2>.
  for (const block of html.split('<div class="p-product-list__item">').slice(1)) {
    const name = decodeHtml(/<h2 class="c-title[^"]*">([\s\S]*?)<\/h2>/.exec(block)?.[1] || "");
    if (!name) continue;
    const id = /href="\/en\/product\/(\d+)"/.exec(block)?.[1] || "";
    const image = /<img src="([^"]+)"[^>]*loading="lazy"/.exec(block)?.[1] || "";
    const price = /<span class="c-price__main">[^\d]*([\d,]+)/.exec(block)?.[1] || "";
    out.push({
      key: id,
      name,
      url: absolute(`/en/product/${id}`, pageUrl),
      image: image && !/logo_/.test(image) ? absolute(image, pageUrl) : "",
      release_date: null,
      price_jpy: price ? Number(price.replace(/,/g, "")) : null,
      number: decodeHtml(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/.exec(block)?.[1] || "") || null,
    });
  }
  return out;
}

function toKit(product, source, index) {
  const id = slugify(product.key || product.name, String(index));
  return {
    kit_id: `${source.idPrefix}-${id}`,
    franchise: "pokemon",
    grade_code: source.grade_code,
    subline: source.subline,
    number: product.number ?? null,
    scale: "non-scale",
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: {
      box_art_url: product.image || null,
      box_art_source_id: product.image ? source.source_id : null,
    },
    gallery_image_urls: product.image ? [product.image] : [],
    series: { key: "pokemon", sort: 400, labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" } },
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: product.release_date,
    price_jpy: product.price_jpy ?? null,
    is_limited: source.grade_code !== "POKE_FIGURE",
    data_status: "verified",
    source_urls: [product.url],
    source_refs: [
      {
        source_id: source.source_id,
        url: product.url,
        fields: ["names", "images", "grade_code", "release_date"],
        confidence: "high",
      },
    ],
    tags: source.tags,
    notes: source.notes,
  };
}

function mergeCatalog(existingKits, importedKits) {
  const byId = new Map(existingKits.map((kit) => [kit.kit_id, kit]));
  for (const kit of importedKits) {
    const previous = byId.get(kit.kit_id);
    byId.set(kit.kit_id, previous ? { ...previous, ...kit } : kit);
  }
  return [...byId.values()].sort((a, b) => String(a.kit_id).localeCompare(String(b.kit_id)));
}

const imported = [];
const report = [];
for (const source of SOURCES) {
  let products = [];
  for (const page of source.pages) {
    try {
      products = products.concat(source.parse(await fetchText(page), page));
    } catch (error) {
      // One dead source must never take the whole daily refresh down.
      console.warn(`${source.source_id}: ${error.message}`);
    }
  }
  const seen = new Set();
  const unique = products.filter((p) => (seen.has(p.key) ? false : seen.add(p.key)));
  imported.push(...unique.map((p, i) => toKit(p, source, i)));
  report.push(`${source.source_id}: ${unique.length}`);
}

if (!imported.length) {
  console.error("No products parsed from any extra Pokemon source; leaving the catalog untouched.");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const merged = mergeCatalog(catalog.kits, imported);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
console.log(`Extra Pokemon sources — ${report.join(", ")}; catalog now ${merged.filter((k) => k.franchise === "pokemon").length} Pokemon records.`);
