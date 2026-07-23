// Takara Tomy モンコレ (Moncolle) figures — the mainline Pokemon figure range,
// which the catalog previously missed entirely. The lineup page renders every
// product as one <a> block, so a single fetch covers the whole range:
//   <a href="ms02/"><div><img src="./ms02/images/img00.png" alt="イーブイ"></div>
//     <div class="pokemon_txt_box"><div class="number_flex">
//       <div class="number">MS-02</div><div class="new_sale">8月発売</div>
//     </div><div class="name">イーブイ</div></div></a>
import { readFile, writeFile } from "node:fs/promises";

const CATALOG_PATH = "data/kits.json";
const SOURCE_ID = "takara_tomy_pokemon_jp";
const BASE_URL = "https://www.takaratomy.co.jp/products/pokemon/moncolle_ex/lineup/";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/<wbr\s*\/?>/gi, "")
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function absolute(href, base) {
  try {
    return new URL(String(href).replace(/^\.\//, ""), base).toString();
  } catch {
    return "";
  }
}

// "8月発売" carries no year; anchor it to the next occurrence of that month so
// upcoming items sort sensibly instead of collapsing to an empty date.
function releaseDateFrom(text) {
  const match = /(\d{4})年\s*(\d{1,2})月/.exec(text) || /(\d{1,2})月/.exec(text);
  if (!match) return null;
  if (match.length === 3) {
    return `${match[1]}-${String(match[2]).padStart(2, "0")}`;
  }
  const month = Number(match[1]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const now = new Date();
  const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-${String(month).padStart(2, "0")}`;
}

function slugify(value, fallback) {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function parseLineup(html) {
  const products = [];
  const blocks = html.match(/<a\s+href="[^"]*"[^>]*>[\s\S]*?<\/a>/gi) || [];
  for (const block of blocks) {
    if (!/class="name"/.test(block)) continue;
    const href = /<a\s+href="([^"]+)"/i.exec(block)?.[1] || "";
    const name = decodeHtml(/<div class="name">([\s\S]*?)<\/div>/i.exec(block)?.[1] || "");
    if (!name) continue;
    const image = /<img[^>]+src="([^"]+)"/i.exec(block)?.[1] || "";
    const number = decodeHtml(/<div class="number">([\s\S]*?)<\/div>/i.exec(block)?.[1] || "");
    const sale = decodeHtml(/<div class="new_sale">([\s\S]*?)<\/div>/i.exec(block)?.[1] || "");
    products.push({
      name,
      number: number || null,
      url: href ? absolute(href, BASE_URL) : BASE_URL,
      image: image ? absolute(image.split("?")[0], BASE_URL) : "",
      release_date: releaseDateFrom(sale),
    });
  }
  // The page repeats some products across themed sections; keep the first hit.
  const seen = new Set();
  return products.filter((product) => {
    const key = `${product.number || ""}|${product.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toKit(product, index) {
  const idBase = product.number ? slugify(product.number, `mc-${index}`) : slugify(product.name, `mc-${index}`);
  return {
    kit_id: `moncolle-${idBase}`,
    franchise: "pokemon",
    grade_code: "POKE_MONCOLLE",
    subline: "モンコレ",
    number: product.number,
    scale: "non-scale",
    names: { ja: product.name, en: product.name, zh: product.name, ko: product.name },
    images: {
      box_art_url: product.image || null,
      box_art_source_id: product.image ? SOURCE_ID : null,
    },
    gallery_image_urls: product.image ? [product.image] : [],
    series: { key: "pokemon", sort: 400, labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" } },
    universe: "Pokemon",
    work_title: "Pokemon",
    release_date: product.release_date,
    price_jpy: null,
    is_limited: false,
    data_status: "verified",
    source_urls: [product.url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: product.url,
        fields: ["names", "images", "grade_code", "number", "release_date"],
        confidence: "high",
      },
    ],
    tags: ["pokemon", "takara tomy", "moncolle", "figure"],
    notes: "Imported from the Takara Tomy Moncolle lineup page.",
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

const html = await fetchText(BASE_URL);
const products = parseLineup(html);
if (!products.length) {
  console.error("No Moncolle products parsed — the lineup markup may have changed; leaving the catalog untouched.");
  process.exit(1);
}
const importedKits = products.map(toKit);
const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const before = catalog.kits.filter((kit) => kit.grade_code === "POKE_MONCOLLE").length;
const merged = mergeCatalog(catalog.kits, importedKits);
await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: merged }, null, 2)}\n`, "utf8");
console.log(`Moncolle: parsed ${products.length} products (catalog had ${before}); catalog now ${merged.filter((k) => k.grade_code === "POKE_MONCOLLE").length}.`);
