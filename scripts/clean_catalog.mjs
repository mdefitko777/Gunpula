// Tidies the catalog after every import (run_importers.mjs), so whatever an
// importer brings back is classified and folded again on the next daily run:
//
//   * goods: Blu-ray, CD, books, tickets, apparel, household goods, card games …
//     stay in the catalog with `category: "goods"`, a `goods_kind` the apps
//     label (티켓 · 의류 · 생활용품 · 블루레이 · 음반 · 책 …) and the franchise's
//     goods grade. data/goods-kinds.json holds hand-checked kinds for records
//     whose name does not say what they are (Aniplex+ disc titles);
//   * the real grade of Premium Bandai / Gashapon kits imported as GUNDAM_MERCH;
//   * sale pages of a product the catalog already has: Premium Bandai lottery /
//     resale / 2次発送 pages, Tamashii Web 【抽選販売】/【2次：…発送分】 pages,
//     Gashapon 【箱売】 box-sale cards of a capsule wave the catalog has;
//   * anything listed in data/kit-aliases.json: `aliases` (duplicates and
//     everything this script folded on earlier runs) and `excluded` (curated:
//     only records of the wrong franchise / IP, e.g. a 超宇宙刑事ギャバン Blu-ray
//     that matched Armored Core).
//
// kit_ids are never renamed. A folded id is recorded in data/kit-aliases.json
// (`aliases` maps it to the record that survives); split_catalog.mjs publishes
// the map next to the split files and the apps move saved entries with it.
// When the app already shows a Premium Bandai record and BANDAI SPIRITS lists
// the same kit under a new id, the published id stays and takes the BANDAI
// SPIRITS product data.
//
// When a Premium Bandai page is folded into another record, what the page knew
// moves with it: its source ref, a price/date the survivor lacks, the earliest
// shipping month, and the Premium Bandai / limited flags only when the pages
// show a PB exclusive (premiumBandaiExclusiveEvidence) — a lottery or rerun
// page of a retail kit only adds the premium-bandai-sale tag.
//
//   node scripts/clean_catalog.mjs            rewrite data/kits.json + kit-aliases.json
//   node scripts/clean_catalog.mjs --check    report only, exit 1 if anything would change
import { readFile, writeFile } from "node:fs/promises";
import {
  ACCESSORY_KIT,
  GOODS_GRADE,
  GOODS_KINDS,
  KEEPS_GRADE_AS_GOODS,
  KIT_ALIASES_PATH,
  NINTENDO_PRODUCT_LINES,
  bandaiImageId,
  emptyAliases,
  goodsKind,
  gundamGradeFromName,
  hasModelCode,
  hasSaleTag,
  kitNameText,
  nfkc,
  premiumBandaiExclusiveEvidence,
  productKey,
  resolveAlias,
  scaleFromName,
  stripDisplaySaleTags,
  stripSaleTags,
} from "./lib/catalog-cleanup.mjs";
import { readSalePages, salePageFromKit, upsertSalePage, writeSalePages } from "./lib/sale-pages.mjs";

const CATALOG_PATH = "data/kits.json";
const FIRST_SEEN_PATH = "data/kit-first-seen.json";
const GOODS_KINDS_PATH = "data/goods-kinds.json";
const BANDAI_SPIRITS_SOURCE = "bandai_spirits_products_jp";
const checkOnly = process.argv.includes("--check");
const verbose = process.argv.includes("--verbose");

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

const catalogText = await readFile(CATALOG_PATH, "utf8");
const catalog = JSON.parse(catalogText);
const before = JSON.stringify(catalog.kits);
const aliasDoc = { ...emptyAliases(), ...(await readJson(KIT_ALIASES_PATH, emptyAliases())) };
const aliases = { ...aliasDoc.aliases };
const excluded = { ...aliasDoc.excluded };
const goodsOverrides = (await readJson(GOODS_KINDS_PATH, { overrides: {} })).overrides || {};
// Ids the app has already published (build_update_feed.mjs stamps every new id
// after the cleanup). An id missing here was created by this very run.
const firstSeen = (await readJson(FIRST_SEEN_PATH, { dates: {} })).dates || {};
const kitsById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
const log = { aliased: [], relabelled: [], tagged: [], flagged: [], goods: [], adopted: [], renamed: [] };

function addAlias(fromId, toId, why) {
  if (fromId === toId || aliases[fromId] || excluded[fromId]) return false;
  if (resolveAlias(aliases, toId) === fromId) return false; // never create a cycle
  aliases[fromId] = toId;
  log.aliased.push({ kit_id: fromId, to: toId, why });
  return true;
}

function addTag(kit, tag) {
  const tags = Array.isArray(kit.tags) ? kit.tags : [];
  if (tags.includes(tag)) return false;
  kit.tags = [...tags, tag];
  log.tagged.push({ kit_id: kit.kit_id, tag });
  return true;
}

const unique = (values) => [...new Set(values.filter(Boolean))];
const isLive = (kit) => !aliases[kit.kit_id] && !excluded[kit.kit_id];
const isGoods = (kit) => kit.category === "goods";
const isPbPage = (kit) => kit.kit_id.startsWith("pbandai-wb-");
const isBandaiSpirits = (kit) => (kit.source_refs || []).some((ref) => ref.source_id === BANDAI_SPIRITS_SOURCE);
const pbItemId = (kit) => (isPbPage(kit) ? kit.kit_id.slice("pbandai-wb-".length) : null);
// A PB record that took over a BANDAI SPIRITS kit (step 6a) is that kit now:
// the duplicate pass treats it like the BANDAI SPIRITS record, not like a page.
const isPbOnlyPage = (kit) => isPbPage(kit) && !isBandaiSpirits(kit);
// A PB record's name as Premium Bandai listed it (【抽選販売】, 【再販】 …): step 7
// tidies the display name and keeps the listing name in premium_bandai.listing_name.
const listingName = (kit) => kit.premium_bandai?.listing_name || kitNameText(kit);
const asListedPage = (kit) => ({ kit_id: kit.kit_id, names: { ja: listingName(kit) } });
const imageId = (kit) => bandaiImageId(kit.images?.box_art_url);
const published = (kit) => Boolean(firstSeen[kit.kit_id]);
const priceClose = (a, b) => !Number.isFinite(a) || !Number.isFinite(b) || Math.max(a, b) / Math.max(1, Math.min(a, b)) <= 1.6;
const priceEqual = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(a, b) * 0.03;
const monthIndex = (date) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(date || ""));
  return match ? Number(match[1]) * 12 + Number(match[2]) : null;
};

// 1. Goods, in every franchise. A curated kind (data/goods-kinds.json) wins,
//    then the name rules; a record classified on an earlier run keeps its kind.
//    Nintendo's games, hardware and amiibo say what they are by their grade: the goods
//    words would make a console case "household" (lib/nintendo-kr.mjs).
for (const kit of catalog.kits) {
  if (!isLive(kit) || NINTENDO_PRODUCT_LINES.has(kit.grade_code)) continue;
  const curated = GOODS_KINDS.includes(goodsOverrides[kit.kit_id]) ? goodsOverrides[kit.kit_id] : null;
  const kind = curated || goodsKind(kit) || (GOODS_KINDS.includes(kit.goods_kind) ? kit.goods_kind : null);
  if (!kind) continue;
  const grade = GOODS_GRADE[kit.franchise] && !KEEPS_GRADE_AS_GOODS.test(kit.grade_code || "") ? GOODS_GRADE[kit.franchise] : kit.grade_code;
  if (kit.category !== "goods" || kit.goods_kind !== kind || kit.grade_code !== grade || kit.scale !== "non-scale") {
    log.goods.push({ kit_id: kit.kit_id, kind, from: kit.grade_code, to: grade });
  }
  kit.category = "goods";
  kit.goods_kind = kind;
  kit.grade_code = grade;
  // Ticket dates ("1/24 公演") are not scales.
  kit.scale = "non-scale";
  if (Array.isArray(kit.tags)) kit.tags = kit.tags.filter((tag) => tag !== "accessory-kit");
}

// 1b. Plastic accessory kits (HGBC, オプションパーツセット ガンプラ, ビルダーズパーツHD,
//     ガンダムベース MSエフェクト …) are kits, tagged so the app can tell them apart.
for (const kit of catalog.kits) {
  if (isLive(kit) && !isGoods(kit) && kit.franchise === "gundam" && ACCESSORY_KIT.test(kitNameText(kit))) addTag(kit, "accessory-kit");
}

// 2. Gundam grade from the product name. Premium Bandai Wayback and the Gashapon
//    search import every record as GUNDAM_MERCH; most are HG/MG/RG kits,
//    ROBOT魂, METAL BUILD, MOBILE SUIT ENSEMBLE … The relabel runs before the
//    duplicate passes so they compare like with like.
for (const kit of catalog.kits) {
  if (!isLive(kit) || isGoods(kit) || kit.franchise !== "gundam" || kit.grade_code !== "GUNDAM_MERCH") continue;
  const grade = gundamGradeFromName(kitNameText(kit));
  if (!grade) continue;
  const scale = scaleFromName(kitNameText(kit));
  log.relabelled.push({ kit_id: kit.kit_id, from: kit.grade_code, to: grade });
  kit.grade_code = grade;
  if (scale && kit.scale === "non-scale") kit.scale = scale;
}

// 3. Tamashii Web opens a new item page for every sales batch of one figure
//    (【抽選販売】, 【2次：2027年5月発送分】, 【事後販売】, "…（2022年2月発送分）") and
//    for straight reissues, sometimes with the brand repeated in the title
//    ("METAL STRUCTURE 解体匠機 …"). Same brand line + same name without sale
//    tags and brand = same product. The page the app already shows stays, then
//    the oldest page (lowest Tamashii id).
{
  const BRAND_PREFIX = /^(?:METAL STRUCTURE\s*(?:解体匠機)?|METAL ROBOT魂|ROBOT魂|METAL BUILD|GUNDAM FIX FIGURATION(?:\s*METAL COMPOSITE)?|超合金)\s*/i;
  const groups = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !/^tamashii-\d+$/.test(kit.kit_id)) continue;
    // localize_catalog.mjs drops the "＜SIDE MS＞" category tag from names, so
    // the key ignores it too (otherwise the grouping changes after localize).
    const name = stripSaleTags(kitNameText(kit))
      .replace(/^[<＜]\s*SIDE MS\s*[>＞]\s*/i, "")
      .replace(BRAND_PREFIX, "");
    const key = `${kit.subline}|${name.replace(/\s+/g, "")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(kit);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => (published(b) ? 1 : 0) - (published(a) ? 1 : 0) || Number(a.kit_id.slice(9)) - Number(b.kit_id.slice(9)));
    for (const kit of members.slice(1)) addAlias(kit.kit_id, members[0].kit_id, "tamashii sale batch / reissue page");
  }
}

// 4. Gashapon. A line card ("MOBILE SUIT ENSEMBLE 06", "ガシャポン戦士フォルテ09")
//    is the record of the whole wave; importEnsemble / importForte add the
//    figures one by one next to it, so the card stays (tagged gashapon-wave)
//    and passes its capsule price to figures that have none. 【箱売】 box-sale
//    cards of a wave the catalog has are folded into the wave card.
{
  const volumeKey = (text) =>
    nfkc(text)
      .replace(/.*(?:MOBILE SUIT ENSEMBLE|ガシャポン戦士(?:フォルテ|f))\s*/i, "")
      .replace(/[~～]?Ver\.\s*FUKUOKA[~～]?/i, "fukuoka")
      .replace(/[~～]?初音ミク color Ver\.[~～]?/i, "hatsunemiku")
      .replace(/^ガンダムメカ$/, "mecha")
      .replace(/\s+/g, "")
      .toLowerCase();
  const figureLines = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !["MSE", "GSF"].includes(kit.grade_code) || !/^(?:mse|gsf)-/.test(kit.kit_id)) continue;
    const key = `${kit.grade_code}|${volumeKey(kit.subline)}`;
    if (!figureLines.has(key)) figureLines.set(key, kit.subline);
  }
  const plainName = (kit) => nfkc(kit.names?.ja).replace(/【[^】]*】/g, "").replace(/\s+/g, "");
  const lineByName = new Map();
  for (const kit of catalog.kits) {
    if (isLive(kit) && kit.kit_id.startsWith("gundam-merch-") && !/【箱売】/.test(kit.names?.ja || "")) lineByName.set(plainName(kit), kit);
  }
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !kit.kit_id.startsWith("gundam-merch-")) continue;
    const name = nfkc(kit.names?.ja);
    if (/【箱売】/.test(name)) {
      const line = lineByName.get(plainName(kit));
      if (line && line.kit_id !== kit.kit_id) addAlias(kit.kit_id, line.kit_id, "gashapon box-sale card of a wave card");
      continue;
    }
    if (!["MSE", "GSF"].includes(kit.grade_code)) continue;
    const subline = figureLines.get(`${kit.grade_code}|${volumeKey(name.replace(/【[^】]*】/g, "").trim())}`);
    if (!subline) continue;
    addTag(kit, "gashapon-wave");
    // Per-figure records carry no price; the wave card has the capsule price.
    if (Number.isFinite(kit.price_jpy)) {
      for (const sibling of catalog.kits) {
        if (sibling.grade_code === kit.grade_code && sibling.subline === subline && sibling.price_jpy == null) sibling.price_jpy = kit.price_jpy;
      }
    }
  }
}

// 5. Premium Bandai Wayback pages of a product the catalog already has: lottery
//    and resale pages of BANDAI SPIRITS kits, PB pages of Tamashii figures, and
//    repeat PB pages (再販, 2次/3次発送) of the same PB item.
//
//    Two ways to be the same product:
//      * the same Bandai product photo: a BANDAI SPIRITS card of a PB kit shows
//        the PB item's own image (model/b/<PB item id>_1.jpg), and PB repeat
//        pages often reuse the photo of the first page;
//      * same grade + same product key + a compatible price.
//    Which record stays: a non-PB record (the image-linked one, then equal
//    price, matching model code, nearest month), else the PB page the app has
//    already published, then the one without sale tags, then the oldest item id.
//    Exception: a BANDAI SPIRITS record new in this run never replaces a PB
//    record the app already shows; it is folded into that record instead
//    (step 6 moves its product data over), so saved collections keep their id.
//    Gashapon figure records (mse-/gsf-) are never the target of a PB page: a PB
//    line card sells the whole wave.
const adopted = new Set(); // PB records that take a folded BANDAI SPIRITS record's data
{
  const kaSignature = (kit) => /Ka signature/i.test(`${kit.subline || ""} ${kitNameText(kit)}`);
  const isFigureRecord = (kit) => /^(?:mse|gsf)-/.test(kit.kit_id);
  const groups = new Map();
  const byImage = new Map();
  const entries = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || kit.franchise !== "gundam" || isFigureRecord(kit)) continue;
    if (kit.grade_code === "GUNDAM_MERCH" && !isPbPage(kit)) continue;
    const name = kitNameText(kit);
    const bare = productKey(name, { keepCodes: false });
    if (!bare) continue;
    const entry = { kit, full: productKey(name), coded: hasModelCode(name), tagged: hasSaleTag(isPbPage(kit) ? listingName(kit) : name), month: monthIndex(kit.release_date) };
    entries.set(kit.kit_id, entry);
    const key = `${kit.grade_code}|${isGoods(kit) ? `goods:${kit.goods_kind}` : ""}|${kaSignature(kit) ? "ka" : ""}|${bare}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
    entry.group = groups.get(key);
    const image = imageId(kit);
    if (image) {
      if (!byImage.has(image)) byImage.set(image, []);
      byImage.get(image).push(entry);
    }
  }
  // Grouped on the key without model codes; within a group two records match
  // when their keys with codes agree, or when one of them names no code at all
  // (so "RG ガンダム Ver.2.0" never meets "RG G-3 ガンダム Ver.2.0").
  const sameProduct = (a, b) => a.full === b.full || !a.coded || !b.coded;
  const compare = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] === b[i]) continue;
      if (typeof a[i] === "number" && typeof b[i] === "number") return a[i] - b[i];
      return String(a[i]).localeCompare(String(b[i]), "en", { numeric: true });
    }
    return 0;
  };
  const pbRank = (entry) => [published(entry.kit) ? 0 : 1, entry.tagged ? 1 : 0, Number(pbItemId(entry.kit))];
  for (const member of entries.values()) {
    if (!isPbOnlyPage(member.kit) || !isLive(member.kit)) continue;
    const linked = new Set([...(byImage.get(pbItemId(member.kit)) || []), ...(byImage.get(imageId(member.kit)) || [])]);
    const candidates = new Set();
    // Goods only meet goods of the same kind.
    const compatible = (other) => other !== member && isGoods(other.kit) === isGoods(member.kit) && priceClose(member.kit.price_jpy, other.kit.price_jpy);
    for (const other of linked) if (compatible(other)) candidates.add(other);
    for (const other of member.group) if (compatible(other) && sameProduct(member, other)) candidates.add(other);
    if (!candidates.size) continue;
    const rank = (entry) => {
      if (isPbOnlyPage(entry.kit)) return [1, ...pbRank(entry)];
      const months = member.month != null && entry.month != null ? Math.abs(member.month - entry.month) : 9999;
      return [
        0,
        linked.has(entry) ? 0 : 1,
        priceEqual(member.kit.price_jpy, entry.kit.price_jpy) ? 0 : 1,
        member.full === entry.full ? 0 : 1,
        months,
        published(entry.kit) ? 0 : 1,
        entry.kit.kit_id,
      ];
    };
    const pool = [member, ...candidates];
    const keeper = pool.reduce((best, entry) => (compare(rank(entry), rank(best)) < 0 ? entry : best));
    if (keeper === member) continue;
    const publishedPb = pool.filter((entry) => isPbOnlyPage(entry.kit) && published(entry.kit) && isLive(entry.kit));
    if (!isPbPage(keeper.kit) && !published(keeper.kit) && isBandaiSpirits(keeper.kit) && publishedPb.length && isLive(keeper.kit)) {
      const pbKeeper = publishedPb.reduce((best, entry) => (compare(pbRank(entry), pbRank(best)) < 0 ? entry : best));
      if (addAlias(keeper.kit.kit_id, pbKeeper.kit.kit_id, "new BANDAI SPIRITS id of a Premium Bandai record the app already shows")) {
        adopted.add(pbKeeper.kit.kit_id);
      }
      if (pbKeeper !== member) addAlias(member.kit.kit_id, pbKeeper.kit.kit_id, "Premium Bandai page of a product already in the catalog");
      continue;
    }
    const target = resolveAlias(aliases, keeper.kit.kit_id);
    if (target !== member.kit.kit_id) addAlias(member.kit.kit_id, target, "Premium Bandai page of a product already in the catalog");
  }
}

// 6. Fold what the dropped duplicate knew into the record that stays: its
//    source_refs (so the PB price/page or the Pokemon Center JAN is not lost),
//    any price/date the survivor lacks, and, for Premium Bandai pages, the
//    shipping month and the PB / limited flags (below).
//    A folded sale page (PB Wayback page, Tamashii page) is written to
//    data/sale-pages.json first: its listing name, shipping month and URL are the
//    resale signal scripts/build_restocks.mjs reads once the page is gone.
const pbPagesByKeeper = new Map();
const bandaiSpiritsByPbKeeper = new Map();
const salePages = await readSalePages();
let salePagesChanged = false;
const isSalePage = (kit) => isPbPage(kit) || /^tamashii-\d+$/.test(kit.kit_id);
for (const [fromId, toIdRaw] of Object.entries(aliases)) {
  const toId = resolveAlias(aliases, toIdRaw);
  aliases[fromId] = toId;
  const from = kitsById.get(fromId);
  const to = kitsById.get(toId);
  if (!from || !to || from === to) continue;
  if (isSalePage(from) && upsertSalePage(salePages, fromId, salePageFromKit(from, { to: toId, firstSeen: firstSeen[fromId] || today() }))) {
    salePagesChanged = true;
  }
  const refs = to.source_refs || [];
  const seen = new Set(refs.map((ref) => `${ref.source_id}|${ref.url}`));
  const extra = (from.source_refs || []).filter((ref) => !seen.has(`${ref.source_id}|${ref.url}`));
  if (extra.length) to.source_refs = [...refs, ...extra.map((ref) => ({ ...ref, confidence: ref.confidence === "high" ? "medium" : ref.confidence }))];
  if (to.price_jpy == null && Number.isInteger(from.price_jpy) && !/【箱売】/.test(from.names?.ja || "")) to.price_jpy = from.price_jpy;
  if (!to.release_date && from.release_date) to.release_date = from.release_date;
  if (isPbPage(from)) {
    if (!pbPagesByKeeper.has(toId)) pbPagesByKeeper.set(toId, []);
    pbPagesByKeeper.get(toId).push(from);
  }
  if (isPbPage(to) && !isPbPage(from) && isBandaiSpirits(from)) bandaiSpiritsByPbKeeper.set(toId, from);
}

// 6a. A PB record that absorbed a new BANDAI SPIRITS id takes that record's
//     product data (official name, grade, release day, photos); its kit_id stays.
const ADOPTED_FIELDS = ["names", "grade_code", "subline", "scale", "number", "release_date", "price_jpy", "images", "gallery_image_urls", "universe", "work_title"];
for (const [toId, from] of bandaiSpiritsByPbKeeper) {
  const to = kitsById.get(toId);
  if (!to || !isLive(to)) continue;
  if (!to.premium_bandai?.listing_name) to.premium_bandai = { ...(to.premium_bandai || {}), listing_name: to.names?.ja || null };
  for (const field of ADOPTED_FIELDS) {
    if (from[field] == null || (Array.isArray(from[field]) && !from[field].length)) continue;
    if (field === "names") {
      // localize_catalog.mjs fills the other languages; only a new Japanese name resets them.
      if (nfkc(from.names?.ja) && nfkc(from.names.ja) !== nfkc(to.names?.ja)) to.names = { ...from.names };
      continue;
    }
    to[field] = from[field];
  }
  to.source_urls = unique([...(from.source_urls || []), ...(to.source_urls || [])]);
  to.tags = unique([...(to.tags || []), ...(from.tags || [])]);
  to.is_limited = Boolean(from.is_limited);
  log.adopted.push({ kit_id: toId, from: from.kit_id });
}

// 6b. A Premium Bandai record that absorbed later pages of the same PB item
//     (再販, 2次/3次発送) keeps the earliest shipping month: that is the release.
for (const [toId, pages] of pbPagesByKeeper) {
  const to = kitsById.get(toId);
  if (!to || !isLive(to) || !isPbPage(to) || bandaiSpiritsByPbKeeper.has(toId)) continue;
  const earliest = pages.map((page) => page.release_date).filter((date) => monthIndex(date) != null).sort()[0];
  if (earliest && (monthIndex(to.release_date) == null || monthIndex(earliest) < monthIndex(to.release_date))) to.release_date = earliest;
}

// 6c. Premium Bandai / limited flags. A BANDAI SPIRITS or Tamashii record does
//     not say whether the product was a PB exclusive, and a PB page folded into
//     it is not proof either (lotteries, reruns and shop pages of retail kits
//     carry sale tags too): premiumBandaiExclusiveEvidence decides. Otherwise
//     PB is a sales channel: tag premium-bandai-sale, flags untouched.
//     A Tamashii figure counts as limited only when Tamashii itself says so
//     (魂ウェブ商店 / event). A PB record that took over a BANDAI SPIRITS kit
//     is judged the same way, its own page counting as one of the PB pages.
for (const toId of new Set([...pbPagesByKeeper.keys(), ...bandaiSpiritsByPbKeeper.keys()])) {
  const to = kitsById.get(toId);
  if (!to || !isLive(to) || (isPbPage(to) && !bandaiSpiritsByPbKeeper.has(toId))) continue;
  const pages = (pbPagesByKeeper.get(toId) || []).filter((page) => page !== to).map(asListedPage);
  const evidencePages = isPbPage(to) ? [asListedPage(to), ...pages] : pages;
  const evidence = to.kit_id.startsWith("tamashii-") ? (to.is_limited ? "Tamashii limited" : null) : premiumBandaiExclusiveEvidence(to, evidencePages);
  if (!evidence) {
    addTag(to, "premium-bandai-sale");
    continue;
  }
  if (to.is_premium_bandai !== true || to.is_limited !== true || !to.premium_bandai) {
    const latest = [...evidencePages].map((page) => kitsById.get(page.kit_id)).sort((a, b) => Number(pbItemId(b)) - Number(pbItemId(a)))[0];
    to.is_premium_bandai = true;
    to.is_limited = true;
    to.premium_bandai = to.premium_bandai || { ...(latest?.premium_bandai || {}), captured_via: latest?.premium_bandai?.captured_via || "wayback" };
    log.flagged.push({ kit_id: toId, pages: evidencePages.length, evidence });
  }
}

// 7. Display names of Premium Bandai and Tamashii records lose their sale tags
//    (【抽選販売】, 【再販】【２次：２０１７年２月発送】, "（2022年2月発送分）").
for (const kit of catalog.kits) {
  if (!isLive(kit) || !(isPbPage(kit) || kit.kit_id.startsWith("tamashii-")) || !kit.names) continue;
  const names = Object.fromEntries(Object.entries(kit.names).map(([lang, value]) => [lang, stripDisplaySaleTags(value)]));
  if (JSON.stringify(names) !== JSON.stringify(kit.names)) {
    if (isPbPage(kit) && !kit.premium_bandai?.listing_name) kit.premium_bandai = { ...(kit.premium_bandai || {}), listing_name: kit.names.ja };
    log.renamed.push({ kit_id: kit.kit_id, from: kit.names.ja, to: names.ja });
    kit.names = names;
  }
}

// An alias must end at a record that is still published.
for (const [fromId, toId] of Object.entries(aliases)) {
  if (excluded[toId]) {
    delete aliases[fromId];
    excluded[fromId] = excluded[fromId] || excluded[toId];
  }
}

const kept = catalog.kits.filter((kit) => !aliases[kit.kit_id] && !excluded[kit.kit_id]);
const removed = catalog.kits.length - kept.length;

const byFranchise = (entries) =>
  entries.reduce((acc, entry) => {
    const franchise = kitsById.get(entry.kit_id)?.franchise || "unknown";
    acc[franchise] = (acc[franchise] || 0) + 1;
    return acc;
  }, {});
const goodsCount = kept.filter(isGoods).length;
console.log(
  `Catalog cleanup: ${removed} records removed (${log.aliased.length} newly aliased ${JSON.stringify(byFranchise(log.aliased))}), ` +
    `${log.goods.length} records classified as goods (${goodsCount} goods in total), ${log.relabelled.length} grades relabelled, ` +
    `${log.flagged.length} records given the Premium Bandai / limited flags of their PB pages, ${log.adopted.length} PB records took BANDAI SPIRITS data, ` +
    `${log.renamed.length} names lost sale tags, ${log.tagged.length} tags added; ` +
    `${kept.length} records remain. kit-aliases.json: ${Object.keys(aliases).length} aliases, ${Object.keys(excluded).length} excluded.`,
);
if (verbose) {
  for (const entry of log.goods) console.log(`  goods    ${entry.kit_id} ${entry.kind} (${entry.from} -> ${entry.to}) ${kitNameText(kitsById.get(entry.kit_id))}`);
  for (const entry of log.aliased) console.log(`  alias    ${entry.kit_id} -> ${entry.to} (${entry.why})`);
  for (const entry of log.relabelled) console.log(`  grade    ${entry.kit_id} ${entry.from} -> ${entry.to}`);
  for (const entry of log.flagged) console.log(`  pb       ${entry.kit_id} (${entry.pages} PB pages: ${entry.evidence})`);
  for (const entry of log.adopted) console.log(`  adopt    ${entry.kit_id} <- ${entry.from}`);
  for (const entry of log.renamed) console.log(`  name     ${entry.kit_id} ${entry.from} -> ${entry.to}`);
  for (const entry of log.tagged) console.log(`  tag      ${entry.kit_id} ${entry.tag}`);
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
const aliasesChanged =
  JSON.stringify(sortKeys(aliases)) !== JSON.stringify(sortKeys(aliasDoc.aliases)) ||
  JSON.stringify(sortKeys(excluded)) !== JSON.stringify(sortKeys(aliasDoc.excluded));
const changed = JSON.stringify(kept) !== before || aliasesChanged;

if (checkOnly) {
  if (changed) {
    console.error("Catalog has records the cleanup rules would change. Run node scripts/clean_catalog.mjs.");
    process.exitCode = 1;
  }
} else {
  if (await writeSalePages(salePages, { changed: salePagesChanged, today: today() })) console.log(`data/sale-pages.json: ${Object.keys(salePages.pages).length} folded sale pages.`);
}
if (!checkOnly && changed) {
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, kits: kept }, null, 2)}\n`, "utf8");
  if (aliasesChanged) {
    const doc = {
      schema: 1,
      updated_at: today(),
      description:
        "kit_ids removed from data/kits.json. aliases: duplicate id -> id of the record that replaced it (move saved entries there). excluded: id -> why the record was dropped (only records of another franchise / IP; goods stay in the catalog with a goods_kind).",
      aliases: sortKeys(aliases),
      excluded: sortKeys(excluded),
    };
    await writeFile(KIT_ALIASES_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }
}
