// ブシロードクリエイティブ (bushiroad-creative.com) figures, for the Fate importer.
//
// The maker's own catalog (BUSHIROAD THE BOX, コレクションフィギュアRICH …), the line
// that only ホビーサーチ carried until 1999.co.jp started answering GitHub's runners with
// a Cloudflare challenge (2026-11). WordPress REST, read as data (2026-11-14):
//   /wp-json/wp/v2/items?goodsc=46   every figure (goods class 46 "figure"), 174 in two
//                                    pages of 100; acf has the title, price, date, picture
//   /wp-json/wp/v2/media/<id>        the picture's file URL
// robots.txt disallows only /wordpress/wp-admin/ and one plugin file.
import { decodeEntities } from "./html-entities.mjs";

export const BUSHIROAD_CREATIVE_HOST = "bushiroad-creative.com";
const BASE = `https://${BUSHIROAD_CREATIVE_HOST}`;
const FIGURE_CLASS = 46;
// The site's title "Fateシリーズ" (/titles/fate/); TYPE-MOON in the copyright line
// catches a Fate product filed under another title id.
const FATE_TITLE_ID = 3146;
const TYPE_MOON = /TYPE-MOON/i;

/** One page (from 1) of the figure list, 100 items, only the fields used. */
export function bushiroadFiguresUrl(page) {
  return `${BASE}/wp-json/wp/v2/items?goodsc=${FIGURE_CLASS}&per_page=100&page=${page}&_fields=id,link,title,acf`;
}

export function bushiroadMediaUrl(mediaId) {
  return `${BASE}/wp-json/wp/v2/media/${mediaId}?_fields=id,source_url`;
}

// "2026年10月下旬発売予定" → "2026-10"; the list's i_sortdate puts 下旬 on the 30th,
// a day nobody announced, so only the month is kept.
function releaseMonth(text) {
  const match = /(\d{4})\s*年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/.exec(String(text || ""));
  if (!match) return null;
  const month = `${match[1]}-${match[2].padStart(2, "0")}`;
  return match[3] ? `${month}-${match[3].padStart(2, "0")}` : month;
}

function plainText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** The figure list (parsed JSON) → the Fate products, with the picture's media id. */
export function parseBushiroadFigures(items) {
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const acf = item?.acf || {};
    if (acf.i_title !== FATE_TITLE_ID && !TYPE_MOON.test(acf.i_copyright || "")) continue;
    const name = plainText(item.title?.rendered);
    if (!item.id || !name) continue;
    const price = Number(String(acf.i_price || "").replace(/[^\d]/g, ""));
    out.push({
      key: String(item.id),
      name,
      series: "",
      line: /BUSHIROAD THE BOX/i.test(name) ? "BUSHIROAD THE BOX" : "ブシロードクリエイティブ",
      url: item.link || `${BASE}/items/${item.id}/`,
      media_id: acf.i_thumbnail || acf.i_imgs?.[0]?.i_img || null,
      // Tax included (i_tax "税込"); a blind-box price is per pack (i_eachinprice).
      price_jpy: Number.isInteger(price) && price > 0 ? price : null,
      release_date: releaseMonth(acf.i_displaydate),
      is_limited: false,
    });
  }
  return out;
}

/** /wp-json/wp/v2/media/<id> (parsed JSON) → the picture's URL, or "". */
export function bushiroadMediaSource(media) {
  const url = String(media?.source_url || "");
  return url.startsWith(`${BASE}/`) ? url : "";
}
