import { readFile, writeFile } from "node:fs/promises";

const SOURCE_ID = "p_bandai_jp";
const LISTING_URLS = [
  "https://p-bandai.jp/hobby/a0001/list-da20-n3/",
  "https://p-bandai.jp/hobby/a0040/list-da20-n1/",
  "https://p-bandai.jp/hobby/list-da20-n6/",
];

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

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

function extract(pattern, value) {
  return pattern.exec(value)?.[1] ?? null;
}

function absoluteUrl(value, baseUrl) {
  return new URL(decodeHtml(value), baseUrl).href;
}

function slugify(value, fallback = "item") {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || fallback;
}

function parsePrice(value) {
  const match = /([\d,]+)\s*円|¥\s*([\d,]+)/.exec(stripTags(value));
  const raw = match?.[1] || match?.[2];
  return raw ? Number(raw.replace(/,/g, "")) : null;
}

function parseReleaseDate(value) {
  const text = stripTags(value);
  const jp = /(\d{4})年\s*(\d{1,2})月/.exec(text);
  if (jp) return `${jp[1]}-${jp[2].padStart(2, "0")}`;
  const iso = /(\d{4})[./-](\d{1,2})/.exec(text);
  return iso ? `${iso[1]}-${iso[2].padStart(2, "0")}` : null;
}

function inferGrade(title) {
  const normalized = String(title ?? "").toUpperCase();
  if (/\bRG\b|リアルグレード/.test(normalized)) return { grade_code: "RG", subline: "Real Grade" };
  if (/\bMGEX\b/.test(normalized)) return { grade_code: "MGEX", subline: "Master Grade Extreme" };
  if (/\bMG\b|マスターグレード/.test(normalized)) return { grade_code: "MG", subline: "Master Grade" };
  if (/\bHG\b|ハイグレード/.test(normalized)) return { grade_code: "HG", subline: "High Grade" };
  if (/\bPG\b|パーフェクトグレード/.test(normalized)) return { grade_code: "PG", subline: "Perfect Grade" };
  if (/\bRE\/100\b|\bRE100\b/.test(normalized)) return { grade_code: "RE100", subline: "RE/100" };
  if (/\bSD\b|SDW|SDガンダム|BB戦士/.test(normalized)) return { grade_code: "SDEX", subline: "SD Gundam" };
  if (/METAL BUILD/i.test(title)) return { grade_code: "METAL_BUILD", subline: "METAL BUILD" };
  if (/ROBOT魂/.test(title)) return { grade_code: "ROBOT_SPIRITS", subline: "ROBOT魂" };
  return { grade_code: "HG", subline: "Premium Bandai Gundam" };
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.6,en;q=0.4",
      referer: "https://p-bandai.jp/",
    },
  });
  const text = await response.text();
  return { url: response.url, ok: response.ok, status: response.status, text };
}

function isGlobalRedirect(result) {
  return /global_newpc\.html/.test(result.url) || /Premium Bandai is International|SELECT YOUR REGION/i.test(result.text);
}

function parseListing(html, pageUrl) {
  const records = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*href="([^"]*\/item\/item-[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  for (const match of html.matchAll(anchorPattern)) {
    const detailUrl = absoluteUrl(match[1], pageUrl).replace(/[?#].*$/, "");
    if (seen.has(detailUrl)) continue;
    const block = match[2];
    const image = extract(/<img[^>]+(?:data-src|src)="([^"]+)"/, block);
    const title =
      stripTags(extract(/alt="([^"]+)"/, block)) ||
      stripTags(extract(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/, block)) ||
      stripTags(extract(/class="[^"]*(?:ttl|title|name)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i, block));
    if (!title || !/ガンダム|GUNDAM|ザク|ジム|シャア|SEED|ダブルオー|METAL BUILD|ROBOT魂/i.test(title)) {
      continue;
    }
    seen.add(detailUrl);
    records.push({
      title,
      detail_url: detailUrl,
      image_url: image ? absoluteUrl(image, pageUrl) : null,
      price_jpy: parsePrice(block),
      release_date: parseReleaseDate(block),
    });
  }
  return records;
}

function buildKit(record) {
  const grade = inferGrade(record.title);
  const itemId = /\/item\/(item-[^/?#]+)/.exec(record.detail_url)?.[1] ?? slugify(record.title);
  return {
    kit_id: `pb-${slugify(itemId, slugify(record.title))}`,
    franchise: "gundam",
    grade_code: grade.grade_code,
    subline: grade.subline,
    number: null,
    scale: /\b1\/\d+/.exec(record.title)?.[0] ?? null,
    names: { ja: record.title, en: null, zh: null, ko: null },
    images: {
      box_art_url: record.image_url,
      box_art_source_id: record.image_url ? SOURCE_ID : null,
    },
    gallery_image_urls: record.image_url ? [record.image_url] : [],
    universe: null,
    work_title: null,
    release_date: record.release_date,
    price_jpy: record.price_jpy,
    is_limited: true,
    data_status: "needs_review",
    source_urls: [record.detail_url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: record.detail_url,
        fields: ["names", "grade_code", "subline", "release_date", "price_jpy", "images"],
        confidence: "high",
      },
    ],
    tags: ["premium bandai", "p-bandai", "premium bandai jp", "limited"],
    notes: "Imported from the official Japanese Premium Bandai site when the Japan storefront is reachable.",
  };
}

function mergeKits(existingDoc, imported) {
  const byId = new Map((existingDoc.kits || []).map((kit) => [kit.kit_id, kit]));
  for (const kit of imported) {
    byId.set(kit.kit_id, kit);
  }
  const kits = [...byId.values()].sort((a, b) => {
    const dateCompare = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""));
    if (dateCompare) return dateCompare;
    return String(a.names?.ja ?? a.kit_id).localeCompare(String(b.names?.ja ?? b.kit_id), "ja");
  });
  return { ...existingDoc, updated_at: today(), kits };
}

async function main() {
  const imported = [];
  const blocked = [];

  for (const url of LISTING_URLS) {
    const result = await fetchText(url);
    if (!result.ok || isGlobalRedirect(result)) {
      blocked.push({ url, final_url: result.url, status: result.status });
      continue;
    }
    imported.push(...parseListing(result.text, url).map(buildKit));
  }

  const unique = new Map(imported.map((kit) => [kit.kit_id, kit]));
  const kits = [...unique.values()];

  if (!kits.length) {
    const message = blocked.length
      ? `Premium Bandai Japan returned the international redirect for ${blocked.length}/${LISTING_URLS.length} listing pages; no PB records imported.`
      : "Premium Bandai Japan returned no matching records.";
    console.warn(message);
    return;
  }

  const existingDoc = JSON.parse(await readFile("data/kits.json", "utf8"));
  const merged = mergeKits(existingDoc, kits);
  await writeFile("data/kits.json", `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Imported ${kits.length} Premium Bandai Japan records. Catalog now has ${merged.kits.length} records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
