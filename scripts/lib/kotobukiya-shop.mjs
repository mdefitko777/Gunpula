import { decodeEntities } from "./html-entities.mjs";

export const KOTOBUKIYA_AC_PORTAL_URL = "https://www.kotobukiya.co.jp/title/armored-core/";
export const KOTOBUKIYA_AC_SHOP_URL =
  "https://shop.kotobukiya.co.jp/shop/goods/search.aspx?keyword=ARMORED%20CORE&search.x=on&ps=90";

function decodeHtml(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "));
}

// The shop repeats some names in brackets: "クレスト CR-C90U3 （クレスト CR-C90U3）",
// "キューポッシュ アヴェンジャー / ジャンヌ・ダルク〔オルタ〕 （アヴェンジャー / ジャンヌ・ダルク〔オルタ〕）"
// (8 products on 2026-11-11, and every language of the name doubled with them). The bracket
// goes when it only repeats the end of the name.
export function dropRepeatedName(title) {
  const match = /^(.+?)\s*[（(]([^()（）]+)[)）]$/.exec(title);
  if (!match) return title;
  const key = (value) => value.normalize("NFKC").replace(/\s+/g, "");
  const inner = key(match[2]);
  return inner.length >= 4 && key(match[1]).endsWith(inner) ? match[1].trim() : title;
}

function absoluteUrl(value, baseUrl) {
  return value ? new URL(decodeHtml(value), baseUrl).href : null;
}

function parseReleaseDate(value) {
  const match = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(stripTags(value));
  return match
    ? [match[1], match[2].padStart(2, "0"), match[3]?.padStart(2, "0")].filter(Boolean).join("-")
    : null;
}

function parsePrice(value) {
  const match = /([\d,]+)/.exec(stripTags(value));
  return match ? Number(match[1].replaceAll(",", "")) : null;
}

function definitionValue(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`<dt[^>]*>\\s*${escaped}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`).exec(html);
  return stripTags(match?.[1]);
}

export function decodeKotobukiyaShopHtml(buffer) {
  return new TextDecoder("shift_jis").decode(buffer);
}

export function parseKotobukiyaShopListings(html, pageUrl = KOTOBUKIYA_AC_SHOP_URL) {
  const listings = [];
  for (const match of html.matchAll(/<li class="tile_item[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const block = match[0];
    const href = /<a[^>]+href="([^"]+)"[^>]*>/.exec(block)?.[1];
    const titleAttribute = /<a[^>]+title="([^"]+)"/.exec(block)?.[1];
    const titleMarkup = /<div class="name">([\s\S]*?)<\/div>/.exec(block)?.[1];
    const image = /<img[^>]+data-original="([^"]+)"/.exec(block)?.[1]
      || /<img[^>]+src="([^"]+)"/.exec(block)?.[1];
    const detailUrl = absoluteUrl(href, pageUrl);
    const title = dropRepeatedName(decodeHtml(titleAttribute || stripTags(titleMarkup)));
    const productId = /\/shop\/g\/g([^/]+)\//.exec(detailUrl || "")?.[1];
    if (!detailUrl || !title || !productId) continue;
    listings.push({
      product_id: productId,
      title,
      detail_url: detailUrl,
      image_url: absoluteUrl(image, pageUrl),
      is_limited: /限定|特典/.test(`${title} ${block}`),
    });
  }
  return listings;
}

// The rows of the goods page's 商品仕様 box shown as the product's spec (the
// announcement's 「상품 소개」); カテゴリ, 価格帯 and 発売月 are search filters.
const SPEC_LABELS = ["作品名", "メーカー", "仕様", "スケール", "原型/設計", "サイズ", "仕様/素材", "版権表記"];

// The 商品説明 box: <br> breaks lines, an empty line between them starts a paragraph.
function goodsDescription(html) {
  const box = /<div class="goods_explain[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] || "";
  const body = box.replace(/<h3[^>]*>[\s\S]*?<\/h3>/, "");
  return body
    .split(/(?:<br\s*\/?>\s*){2,}|<\/p>/i)
    .map((paragraph) => paragraph.split(/<br\s*\/?>/i).map((line) => stripTags(line)).filter(Boolean).join("\n"))
    .filter(Boolean);
}

export function parseKotobukiyaShopDetail(html, detailUrl) {
  const category = stripTags(/<dl class="goods_category_">[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/.exec(html)?.[1]);
  const specification = definitionValue(html, "仕様");
  const gallery = [...new Set(
    [...html.matchAll(/<img[^>]+(?:src|data-original)="([^"]*\/img\/goods\/(?:L|[2-9])\/[^"]+)"/g)]
      .map((match) => absoluteUrl(match[1], detailUrl))
      .filter(Boolean),
  )];
  const priceMarkup = /<span class="price_num_">([\s\S]*?)<\/span>/.exec(html)?.[1];
  const releaseMarkup = /<dl class="goods_release_">[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/.exec(html)?.[1];
  const scaleText = definitionValue(html, "スケール");
  return {
    title: dropRepeatedName(stripTags(/<h1 class="goods_name_">([\s\S]*?)<\/h1>/.exec(html)?.[1])),
    category,
    specification,
    work_title: definitionValue(html, "作品名") || "Armored Core",
    series: definitionValue(html, "ブランド") || "Kotobukiya Armored Core",
    scale: /^NON/i.test(scaleText) ? "non-scale" : scaleText || "various",
    release_date: parseReleaseDate(releaseMarkup),
    release_text: stripTags(releaseMarkup) || null,
    price_jpy: parsePrice(priceMarkup),
    price_text: stripTags(/<p class="price">([\s\S]*?)<\/p>/.exec(html)?.[1]).replace(/\s+/g, "") || null,
    description: goodsDescription(html),
    spec_rows: SPEC_LABELS
      .map((label) => ({ label, value: definitionValue(html, label) }))
      .filter((row) => row.value),
    gallery,
    is_plastic_model: /プラモデル/.test(`${category} ${specification}`) && !/塗料|チャーム|完成品/.test(`${category} ${specification}`),
  };
}
