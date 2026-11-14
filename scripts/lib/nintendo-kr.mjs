// Rules behind scripts/import_nintendo_korea.mjs (franchise "nintendo"): what the official Korean
// Nintendo sites list, which of it becomes a record, its grade, series and release date. Pure
// functions over saved pages, so scripts/test_nintendo_korea.mjs can run them on fixtures.
//
// Sources, read 2026-11-14 (robots.txt of both hosts allows everything for this bot):
//   store.nintendo.co.kr  Magento 2, server-rendered. /physical/physical-all (125 products: games,
//                         consoles, accessories, goods, amiibo cards, platinum-point goods) and
//                         /digital/digital-all?publisher=14 (196 Nintendo download products).
//                         A product page has 발매일 and 메이커; no JAN.
//   www.nintendo.com/kr   Next.js; the release schedule (/kr/schedule) and the amiibo lineup
//                         (/kr/amiibo/lineup, only the newest 20) are in the server-rendered
//                         flight data; the news list (/kr/news) is plain HTML.
// Not used: search.nintendo.jp (robots.txt disallows everything) and store-jp.nintendo.com (every
// product page redirects to a Queue-it waiting room), see docs/source-plan.md.
import { createHash } from "node:crypto";
import { goodsKind, goodsRuleKind } from "./catalog-cleanup.mjs";
import { decodeEntities } from "./html-entities.mjs";
import { announcementRecord, extractNextFlight } from "./official-announcements.mjs";

export const SOURCE_ID = "nintendo_store_kr";
export const SITE_SOURCE_ID = "nintendo_kr";
export const NEWS_SOURCE_ID = "nintendo_kr_news";
export const STORE = "https://store.nintendo.co.kr";
export const SITE = "https://www.nintendo.com";
export const PHYSICAL_LIST = `${STORE}/physical/physical-all`;
// publisher=14 is Nintendo; the whole download shop (10,249 products) is mostly other publishers.
export const DIGITAL_LIST = `${STORE}/digital/digital-all?publisher=14`;
export const SCHEDULE_URL = `${SITE}/kr/schedule`;
export const AMIIBO_URL = `${SITE}/kr/amiibo/lineup`;
export const NEWS_URL = `${SITE}/kr/news`;
export const LIST_LIMIT = 48;

const ID_PREFIX = "nintendo-kr-";

// One series per Nintendo world; the first match wins, so a Smash Bros. amiibo of Link is Smash
// and "요시와 신기한 도감" is Yoshi, not Mario. Labels: official names (zh: Nintendo's Chinese titles).
export const NINTENDO_SERIES = [
  { id: "smash", pattern: /스매시브라더스|대난투|Smash Bros/i, labels: { ko: "대난투 스매시브라더스", zh: "任天堂明星大乱斗", en: "Super Smash Bros.", ja: "大乱闘スマッシュブラザーズ" } },
  { id: "pokemon", pattern: /포켓몬|Pokémon|Pokemon|피카츄|이브이|Pokopia/i, labels: { ko: "포켓몬", zh: "宝可梦", en: "Pokémon", ja: "ポケモン" } },
  { id: "zelda", pattern: /젤다|하이랄|Zelda|시간의 오카리나|론론|마스터 소드|코로그|무쥬라/i, labels: { ko: "젤다의 전설", zh: "塞尔达传说", en: "The Legend of Zelda", ja: "ゼルダの伝説" } },
  { id: "kirby", pattern: /커비|Kirby/i, labels: { ko: "별의 커비", zh: "星之卡比", en: "Kirby", ja: "星のカービィ" } },
  { id: "splatoon", pattern: /스플래툰|Splatoon/i, labels: { ko: "스플래툰", zh: "斯普拉遁", en: "Splatoon", ja: "スプラトゥーン" } },
  { id: "animal_crossing", pattern: /동물의 숲|Animal Crossing/i, labels: { ko: "동물의 숲", zh: "动物森友会", en: "Animal Crossing", ja: "どうぶつの森" } },
  { id: "pikmin", pattern: /피크민|Pikmin/i, labels: { ko: "피크민", zh: "皮克敏", en: "Pikmin", ja: "ピクミン" } },
  { id: "metroid", pattern: /메트로이드|Metroid/i, labels: { ko: "메트로이드", zh: "密特罗德", en: "Metroid", ja: "メトロイド" } },
  { id: "xenoblade", pattern: /제노블레이드|Xenoblade/i, labels: { ko: "제노블레이드", zh: "异度神剑", en: "Xenoblade", ja: "ゼノブレイド" } },
  { id: "fire_emblem", pattern: /파이어 ?엠블렘|Fire Emblem/i, labels: { ko: "파이어 엠블렘", zh: "火焰纹章", en: "Fire Emblem", ja: "ファイアーエムブレム" } },
  { id: "donkey_kong", pattern: /동키콩|Donkey Kong/i, labels: { ko: "동키콩", zh: "大金刚", en: "Donkey Kong", ja: "ドンキーコング" } },
  { id: "yoshi", pattern: /요시|Yoshi/i, labels: { ko: "요시", zh: "耀西", en: "Yoshi", ja: "ヨッシー" } },
  { id: "mario", pattern: /마리오|루이지|피치|와리오|수다쟁이 꽃|Mario|Luigi|Peach|Wario/i, labels: { ko: "마리오", zh: "马力欧", en: "Mario", ja: "マリオ" } },
  { id: "other", pattern: /$^/, labels: { ko: "기타", zh: "其他", en: "Other", ja: "その他" } },
];
const SERIES_SORT = 700;

export function seriesFor(text) {
  const value = String(text || "").normalize("NFC");
  const found = NINTENDO_SERIES.find((series) => series.pattern.test(value)) || NINTENDO_SERIES.at(-1);
  return { key: `nintendo_${found.id}`, sort: SERIES_SORT, labels: found.labels, universe: "Nintendo" };
}

/** The series of a record (localize_catalog.mjs runs this on every nintendo record). */
export function seriesOfKit(kit) {
  return seriesFor([kit.names?.ko, kit.source_name, kit.subline, kit.nintendo_kr?.amiibo_series].filter(Boolean).join(" "));
}

// NFC: the store writes some "Pokémon" with a combining accent.
const text = (value) => decodeEntities(String(value || "")).normalize("NFC").replace(/\s+/g, " ").trim();
const sha = (value) => createHash("sha1").update(String(value)).digest("hex");

// ---------------------------------------------------------------------------
// store.nintendo.co.kr

/** A Magento category page → [{ entityId, url, slug, name, price, image }]. */
export function parseStoreList(html) {
  const products = [];
  for (const card of String(html || "").split('<div class="product-item-info" id="product-item-info_').slice(1)) {
    const entityId = /^(\d+)/.exec(card)?.[1];
    const url = /class="product-item-link"\s+href="([^"]+)"/.exec(card)?.[1];
    const name = text(/class="product-item-link"[^>]*>([\s\S]*?)<\/a>/.exec(card)?.[1]);
    if (!entityId || !url || !name) continue;
    const price = Number(/data-price-amount="([\d.]+)"/.exec(card)?.[1]);
    const image = /class="product-image-photo"[\s\S]*?src="([^"]+)"/.exec(card)?.[1] || null;
    products.push({ entityId, url, slug: decodeURIComponent(new URL(url).pathname.slice(1)), name, price: Number.isFinite(price) && price > 0 ? Math.round(price) : null, image });
  }
  return products;
}

/** A product page → { releaseDate, maker, sku, images[] }. */
export function parseStoreDetail(html) {
  const page = String(html || "");
  const attribute = (name) => text(new RegExp(`class="product-attribute ${name}[^"]*">[\\s\\S]*?<div class="product-attribute-val">([\\s\\S]*?)</div>\\s*</div>`).exec(page)?.[1]?.replace(/<[^>]+>/g, " "));
  const date = /(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/.exec(attribute("release_date"));
  const gallery = /"data":\s*(\[\{"thumb"[\s\S]*?\}\])\s*,\s*"options"/.exec(page)?.[1];
  let images = [];
  try {
    images = JSON.parse(gallery || "[]").map((item) => item.img || item.full).filter(Boolean);
  } catch {
    // markup change: no gallery, the list picture stays the cover
  }
  return {
    releaseDate: date ? `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}` : null,
    maker: attribute("publisher") || null,
    sku: /data-product-sku="([^"]+)"/.exec(page)?.[1] || null,
    images,
  };
}

// The 7001… / 7005… download numbers (nsuid): 7001 game, 7005 upgrade pass or DLC, 7007 bundle of
// game and DLC, 7008 Nintendo Switch Online ticket; 3000… prepaid numbers. The 5002… products are
// the Nintendo Switch Online controllers (hardware).
const NSUID = /^\d{14}$/;
const GAME_NSUID = /^7001\d{10}$/;
const SERVICE_NSUID = /^(?:700[578]|300)\d+$/;
// An expansion or upgrade pass sold on its own (also boxed: hacj…, "Pokémon Pokopia 익스팬션 패스");
// a game sold together with its pass ("… + 익스팬션 패스") stays.
const ADD_ON = /^(?!.*\+).*(?:익스팬션 패스|업그레이드 패스)/;
const NOT_A_PRODUCT = /체험판|선불 번호|이용권|Nintendo Classics|Nintendo Switch Online|다운로드 번호|발매 중!$/;
// Spare parts sold unboxed, cables and memory cards are not what the channel is for.
const NOT_COLLECTED = /벌크 제품|microSD|HDMI|케이블|AC ?어댑터/i;
const LOTTERY = /^\s*\[추첨 판매 응모\]\s*|\s*\[[^\]]*당첨 발표\]\s*$/g;
const NINTENDO_MAKER = /Nintendo|닌텐도|Pokémon|포켓몬|Pokemon/i;

/** "Super Mario Bros. Wonder(슈퍼 마리오브라더스 원더)" → { ko: Korean part, en: English part }. */
export function splitName(name) {
  const clean = text(name).replace(LOTTERY, "").trim();
  const both = /^([A-Za-z0-9][^()가-힣]*?)\s*\(([^()]*[가-힣][^()]*)\)$/.exec(clean);
  return both ? { ko: both[2].trim(), en: both[1].trim() } : { ko: clean, en: null };
}

/** Grade of a store product, or null when it is left out (the reason in `skip`). */
export function classifyStoreProduct(product) {
  const code = product.slug.toLowerCase();
  const name = text(product.name);
  if (SERVICE_NSUID.test(code)) return { skip: /^700[57]/.test(code) ? "dlc or bundle" : "service" };
  if (/^hacj/.test(code) || ADD_ON.test(name)) return { skip: "dlc or bundle" };
  if (NOT_A_PRODUCT.test(name)) return { skip: "service" };
  if (NOT_COLLECTED.test(name)) return { skip: "spare part" };
  if (/amiibo/i.test(name) || /^nvl/.test(code)) return { grade: "NIN_AMIIBO" };
  if (/^(?:nsj8|mns8|ppsp|tafs)/.test(code) || /추첨 판매/.test(name)) return { grade: "NIN_GOODS" };
  // hac p / bee p / nxs / pot: packaged games; hac r / bee r / pot r: a game sold with its pass,
  // controller or strap (링 피트 어드벤처, Dagdan Collection).
  if (GAME_NSUID.test(code) || /^(?:(?:hac|bee)[pr]|nxs|pot)/.test(code)) return { grade: "NIN_GAME" };
  return { grade: "NIN_HW" };
}

/** "switch2" | "switch" | null from the product code and name. */
export function platformOf(code, name, hint = null) {
  if (/Nintendo Switch 2|Joy-Con 2/i.test(name) || /^(?:bee|nxs|pot)/.test(code)) return "switch2";
  if (hint === "switch2" || hint === "switch") return hint;
  if (/^(?:hac|had|heg)/.test(code) || /Nintendo Switch|Joy-Con/i.test(name)) return "switch";
  return null;
}
const PLATFORM_LABEL = { switch2: "Nintendo Switch 2", switch: "Nintendo Switch" };

// Goods words the shared rules leave to the importer (a keyholder sold next to plush is a
// collectible in Japan; here it is goods).
const CHARACTER_KINDS = [
  ["acrylic", /아크릴/],
  ["accessory", /키 ?홀더|키 ?체인|키링|배지|뱃지|펜던트|카드 ?홀더|카드케이스|스트랩/],
  ["household", /고무코스터|코스터|머그|블랭킷|키친크로스|손수건|오카리나|사운드 클록/],
  ["stationery", /형광펜|파일|편지지/],
];

export function goodsKindFor(name) {
  const byName = goodsKind({ franchise: "nintendo", source_name: name });
  if (byName) return byName;
  const character = CHARACTER_KINDS.find(([, pattern]) => pattern.test(name));
  if (character) return character[0];
  return goodsRuleKind(name) || "other";
}

/** The key two listings of one game share: the package and the download version. */
export function titleKey(name) {
  return splitName(name).ko.normalize("NFKC").toLowerCase().replace(/세트$/, "").replace(/[\s「」『』:：·・\-–—!！+＋,.()]/g, "");
}

// T-shirts come in one product per size; the record is the shirt.
const SIZE = /\s*\((?:XS|S|M|L|XL|XXL|2XL|3XL|FREE)\)\s*/i;

// ---------------------------------------------------------------------------
// www.nintendo.com/kr

// The schedule's imageHeroOrg is the original key visual on Contentful (2026-11-14: 638 KB for
// 별의 커비 월드 비욘드); Contentful's image API gives an 800 px WebP of it (51 KB). The amiibo and
// news pictures already come with their own size.
export function sizedContentfulImage(url, width = 800) {
  if (!url || !url.startsWith("https://images.ctfassets.net/") || url.includes("?")) return url || null;
  return `${url}?w=${width}&fm=webp`;
}

/** Release schedule → [{ title, nsuid, releaseDate ("YYYY-MM-DD" | "YYYY-MM" | "YYYY"), platform, formats, publisher, image, link }]. */
export function parseSchedule(html) {
  const flight = extractNextFlight(html);
  const items = [];
  for (const match of flight.matchAll(/\{"sysId":"[^"]+".*?"rating":[^}]*\}/g)) {
    let item;
    try {
      item = JSON.parse(match[0]);
    } catch {
      continue;
    }
    const exact = !item.isTbd && /^(\d{4})-(\d{2})-(\d{2})/.exec(item.releaseDate || "");
    const year = /^(\d{4})/.exec(item.releaseDateStr || item.releaseDate || "")?.[1];
    items.push({
      sysId: item.sysId,
      title: text(item.title),
      nsuid: NSUID.test(item.nsuid || "") ? item.nsuid : null,
      releaseDate: exact ? `${exact[1]}-${exact[2]}-${exact[3]}` : year || null,
      platform: item.hardware === "switch2" ? "switch2" : item.hardware === "switch" ? "switch" : null,
      formats: [...(item.category || []).includes("패키지 버전") ? ["package"] : [], ...(item.category || []).includes("다운로드 버전") ? ["download"] : []],
      publisher: text(item.publisher),
      image: sizedContentfulImage(item.imageHeroOrg?.url),
      link: item.link ? new URL(item.link, SITE).href : null,
    });
  }
  return items;
}

export const isNintendoPublisher = (publisher) => /한국닌텐도|^Nintendo$|닌텐도|Pokémon|포켓몬/.test(publisher || "");

/** amiibo lineup → [{ id, name, series, releaseDate, image }] (only the newest 20 are in the page). */
export function parseAmiiboLineup(html) {
  const flight = extractNextFlight(html);
  const items = [];
  for (const match of flight.matchAll(/\{"sys":\{"id":"[^"]+"\},"name":"[^"]*","id":"\d+".*?"series":\{"sys":\{"id":"[^"]+"\},"id":"[^"]*","name":"[^"]*"/g)) {
    const chunk = match[0];
    const name = /"name":"([^"]*)"/.exec(chunk)?.[1];
    const id = /"name":"[^"]*","id":"(\d+)"/.exec(chunk)?.[1];
    const date = /"releaseDate":"(\d{4}-\d{2}-\d{2})/.exec(chunk)?.[1] || null;
    const image = /"amiiboImg":\{"url":"([^"]+)"/.exec(chunk)?.[1] || null;
    const series = /"series":\{"sys":\{"id":"[^"]+"\},"id":"[^"]*","name":"([^"]*)"/.exec(chunk)?.[1] || null;
    if (name && id) items.push({ id, name: text(name), series: text(series) || null, releaseDate: date, image });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Records

function kitBase({ kitId, grade, subline, names, sourceName, series, image, gallery, releaseDate, priceKrw, sourceId, url, fields, extra, tags }) {
  return {
    kit_id: kitId,
    franchise: "nintendo",
    grade_code: grade,
    subline,
    number: null,
    scale: "non-scale",
    // Korean listings carry only a Korean name (and sometimes an English one); the localizer fills the rest.
    names: { ko: names.ko, ja: names.ko, zh: names.ko, en: names.en || names.ko },
    source_name: sourceName,
    images: { box_art_url: image || null, box_art_source_id: image ? sourceId : null },
    gallery_image_urls: gallery,
    series: { key: series.key, sort: series.sort, labels: series.labels },
    universe: series.universe,
    work_title: series.labels.en,
    release_date: releaseDate || null,
    // Korean prices in won; converting to yen would invent a number that moves with the rate.
    price_jpy: null,
    price_krw: priceKrw ?? null,
    is_limited: /한정|추첨|에디션|Edition/i.test(sourceName) && grade !== "NIN_GAME",
    nintendo_kr: extra,
    data_status: "verified",
    source_urls: [url],
    source_refs: [{ source_id: sourceId, url, fields, confidence: "high" }],
    tags: [...new Set(["nintendo", "korea", grade.toLowerCase(), ...tags])],
    notes: "Imported from the official Korean Nintendo sites (store.nintendo.co.kr, nintendo.com/kr).",
  };
}

const pokemonTag = (series) => (series.key === "nintendo_pokemon" ? ["pokemon"] : []);

/**
 * Store products (physical and download), their page details and the release schedule → records.
 * `previous` (the catalog's nintendo records) keeps ids stable: a game listed again under another
 * product, or first seen in the schedule and later in the store, keeps the id it was published with.
 */
export function buildRecords({ physical = [], digital = [], details = {}, schedule = [], amiibo = [], previous = [] }) {
  const idByKey = new Map();
  const idByNsuid = new Map();
  for (const kit of previous) {
    if (kit.grade_code === "NIN_GAME") idByKey.set(titleKey(kit.source_name || kit.names?.ko), kit.kit_id);
    if (kit.nintendo_kr?.nsuid) idByNsuid.set(kit.nintendo_kr.nsuid, kit.kit_id);
  }
  const records = new Map();
  const skipped = {};
  const games = new Map();
  const pending = [];

  const listings = [...physical.map((p) => ({ ...p, format: "package" })), ...digital.map((p) => ({ ...p, format: "download" }))];
  const sizes = new Map();
  for (const product of listings) {
    const verdict = classifyStoreProduct(product);
    if (verdict.skip) {
      skipped[verdict.skip] = (skipped[verdict.skip] || 0) + 1;
      continue;
    }
    const detail = details[product.entityId] || null;
    const { ko, en } = splitName(product.name);
    const code = product.slug.toLowerCase();
    if (verdict.grade === "NIN_GAME") {
      // A packaged game of another publisher (Minecraft, 저스트 댄스 …) is not Nintendo's; that needs its page.
      if (!detail) {
        pending.push(product.entityId);
        continue;
      }
      if (product.format === "package" && !NINTENDO_MAKER.test(detail.maker || "")) {
        skipped["other publisher"] = (skipped["other publisher"] || 0) + 1;
        continue;
      }
      const key = titleKey(product.name);
      const game = games.get(key) || { key, listings: [] };
      game.listings.push({ product, detail, ko, en, code });
      games.set(key, game);
      continue;
    }
    // Sizes of one shirt: the first listed (lowest id) stands for the shirt.
    const sizeless = ko.replace(SIZE, " ").replace(/\s+/g, " ").trim();
    if (SIZE.test(ko)) {
      const known = sizes.get(sizeless);
      if (known && Number(known) < Number(product.entityId)) continue;
      if (known) records.delete(`${ID_PREFIX}${known}`);
      sizes.set(sizeless, product.entityId);
    }
    const series = seriesFor(`${sizeless} ${en || ""}`);
    const points = /^(?:mns8|ppsp)/.test(code);
    const grade = verdict.grade;
    const platform = grade === "NIN_HW" ? platformOf(code, product.name) : null;
    const subline = grade === "NIN_HW" ? PLATFORM_LABEL[platform] || null
      : grade === "NIN_AMIIBO" ? "amiibo 카드"
      : points ? "마이 닌텐도 플래티넘 포인트" : "닌텐도 스토어";
    const gallery = detail?.images?.length ? detail.images.slice(0, 6) : [product.image].filter(Boolean);
    const kit = kitBase({
      kitId: `${ID_PREFIX}${product.entityId}`,
      grade,
      subline,
      names: { ko: sizeless, en },
      sourceName: sizeless,
      series,
      image: gallery[0],
      gallery,
      releaseDate: detail?.releaseDate,
      priceKrw: product.price,
      sourceId: SOURCE_ID,
      url: product.url,
      fields: ["names", "images", "grade_code", "release_date", "price_krw"],
      extra: { platform, formats: ["package"], code: NSUID.test(code) ? null : code, ...(points ? { points: true } : {}) },
      tags: pokemonTag(series),
    });
    if (grade === "NIN_GOODS") Object.assign(kit, { category: "goods", goods_kind: goodsKindFor(sizeless) });
    records.set(kit.kit_id, kit);
  }

  // Games: one record per title, package and download version together.
  const scheduleByNsuid = new Map(schedule.filter((item) => item.nsuid).map((item) => [item.nsuid, item]));
  const scheduleByKey = new Map(schedule.map((item) => [titleKey(item.title), item]));
  const usedSchedule = new Set();
  for (const game of games.values()) {
    const packaged = game.listings.find((listing) => listing.product.format === "package");
    const download = game.listings.find((listing) => listing.product.format === "download");
    const main = packaged || download;
    const nsuid = download?.code || null;
    const planned = (nsuid && scheduleByNsuid.get(nsuid)) || scheduleByKey.get(game.key) || null;
    if (planned) usedSchedule.add(planned.sysId);
    const id = idByKey.get(game.key) || (nsuid && idByNsuid.get(nsuid)) || `${ID_PREFIX}${main.product.entityId}`;
    const series = seriesFor(`${main.ko} ${main.en || ""}`);
    const platform = platformOf(packaged?.code || "", main.product.name, planned?.platform);
    const dates = game.listings.map((listing) => listing.detail.releaseDate).filter(Boolean).sort();
    const gallery = [...new Set(game.listings.flatMap((listing) => listing.detail.images || []))].slice(0, 6);
    if (!gallery.length && main.product.image) gallery.push(main.product.image);
    records.set(id, kitBase({
      kitId: id,
      grade: "NIN_GAME",
      subline: PLATFORM_LABEL[platform] || null,
      names: { ko: main.ko, en: main.en },
      sourceName: main.ko,
      series,
      image: gallery[0],
      gallery,
      releaseDate: dates[0] || planned?.releaseDate,
      priceKrw: packaged?.product.price ?? download?.product.price ?? null,
      sourceId: SOURCE_ID,
      url: main.product.url,
      fields: ["names", "images", "grade_code", "release_date", "price_krw"],
      extra: {
        platform,
        formats: [...new Set([...(packaged ? ["package"] : []), ...(download ? ["download"] : []), ...(planned?.formats || [])])].sort().reverse(),
        ...(nsuid ? { nsuid } : {}),
        ...(packaged && !NSUID.test(packaged.code) ? { code: packaged.code } : {}),
      },
      tags: pokemonTag(series),
    }));
  }

  // Announced games the store does not sell yet.
  for (const item of schedule) {
    if (usedSchedule.has(item.sysId) || !isNintendoPublisher(item.publisher) || !item.title) continue;
    const key = titleKey(item.title);
    if (games.has(key)) continue;
    const id = idByKey.get(key) || (item.nsuid && idByNsuid.get(item.nsuid)) || (item.nsuid ? `${ID_PREFIX}ns-${item.nsuid}` : `${ID_PREFIX}sch-${sha(item.sysId).slice(0, 10)}`);
    const series = seriesFor(item.title);
    const url = item.link || SCHEDULE_URL;
    records.set(id, kitBase({
      kitId: id,
      grade: "NIN_GAME",
      subline: PLATFORM_LABEL[item.platform] || null,
      names: { ko: item.title, en: null },
      sourceName: item.title,
      series,
      image: item.image,
      gallery: [item.image].filter(Boolean),
      releaseDate: item.releaseDate,
      priceKrw: null,
      sourceId: SITE_SOURCE_ID,
      url,
      fields: ["names", "images", "release_date"],
      extra: { platform: item.platform, formats: item.formats, ...(item.nsuid ? { nsuid: item.nsuid } : {}) },
      tags: pokemonTag(series),
    }));
  }

  for (const item of amiibo) {
    const name = `amiibo ${item.name}${item.series ? ` (${item.series})` : ""}`;
    const series = seriesFor(`${item.name} ${item.series || ""}`);
    const kit = kitBase({
      kitId: `${ID_PREFIX}amiibo-${item.id}`,
      grade: "NIN_AMIIBO",
      subline: item.series || "amiibo",
      names: { ko: name, en: null },
      sourceName: name,
      series,
      image: item.image,
      gallery: [item.image].filter(Boolean),
      releaseDate: item.releaseDate,
      priceKrw: null,
      sourceId: SITE_SOURCE_ID,
      url: AMIIBO_URL,
      fields: ["names", "images", "release_date"],
      extra: { platform: null, formats: ["package"], amiibo_series: item.series },
      tags: pokemonTag(series),
    });
    records.set(kit.kit_id, kit);
  }
  return { records: [...records.values()], skipped, pending };
}

// ---------------------------------------------------------------------------
// News (announcements.json): product news only, not events, updates or broadcasts.

const PRODUCT_NEWS = /발매|예약|출시|판매|amiibo|에디션|Edition|굿즈|세트/i;
const NOT_PRODUCT_NEWS = /업데이트|개최|이벤트|대회|방송|Direct|다이렉트|점검|공지|체험회|캠페인|당첨|서비스 종료|판매량|돌파/;
// Other publishers' games are announced on the same list (Stellar Blade™ 컴플리트 에디션): a post
// counts when it names a Nintendo series or Nintendo hardware.
const NINTENDO_HARDWARE_NEWS = /amiibo|주변기기|본체|세트|Joy-Con|컨트롤러/i;

function newsStatus(title) {
  if (/발매 ?결정|발매일 ?결정|발표/.test(title)) return "product_confirmed";
  if (/예약/.test(title)) return "preorder_open";
  if (/발매|출시|판매 (?:개시|시작)|오늘/.test(title)) return "released";
  return "product_confirmed";
}

export function parseNintendoNews(html, pageUrl = NEWS_URL) {
  const records = [];
  for (const match of String(html || "").matchAll(/<a href="(\/kr\/news\/article\/([A-Za-z0-9]+))" class="ncmn-u-linkbox">([\s\S]*?)<\/a>/g)) {
    const [, href, articleId, inner] = match;
    const title = text(/class="ncmn-softUnit__name">([\s\S]*?)<\/div>/.exec(inner)?.[1]?.replace(/<[^>]+>/g, " "));
    const date = /class="ncmn-softUnit__release">(\d{4})\.(\d{1,2})\.(\d{1,2})</.exec(inner);
    const image = /background-image:url\(([^)]+)\)/.exec(inner)?.[1];
    if (!title || !date || !PRODUCT_NEWS.test(title) || NOT_PRODUCT_NEWS.test(title)) continue;
    if (seriesFor(title).key === "nintendo_other" && !NINTENDO_HARDWARE_NEWS.test(title)) continue;
    const record = announcementRecord({
      id: `nintendo-kr-news-${articleId.toLowerCase()}`,
      sourceId: NEWS_SOURCE_ID,
      franchise: "nintendo",
      title,
      status: newsStatus(title),
      announcedAt: `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`,
      sourceName: "한국닌텐도",
      sourceUrl: new URL(href, pageUrl).href,
      thumbnailUrl: image ? decodeEntities(image) : null,
    });
    // A Korean title: the app shows names.ko first; names.ja keeps it for the dedupe keys.
    records.push({ ...record, names: { ja: title, zh: null, ko: title, en: null } });
  }
  return records;
}
