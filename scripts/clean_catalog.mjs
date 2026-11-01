// Removes records that should not be in the published catalog and fixes the
// GUNDAM_MERCH grade on Premium Bandai / Gashapon kits. Runs after every import
// (run_importers.mjs), so a record an importer brings back is dropped again.
//
//   * non-collectibles (Blu-ray, CD, books, tickets, apparel, household …)
//   * sale pages of a product the catalog already has: Premium Bandai lottery /
//     resale / 2次発送 pages, Tamashii Web 【抽選販売】/【2次：…発送分】 pages,
//     Gashapon 【箱売】 box-sale cards of a capsule wave the catalog has
//   * anything listed in data/kit-aliases.json (curated duplicates and
//     exclusions, plus everything this script found on earlier runs)
//
// kit_ids are never renamed. A removed id is recorded in data/kit-aliases.json:
// `aliases` maps a duplicate to the record that survives, `excluded` says why a
// record was dropped. split_catalog.mjs publishes the alias map next to the
// split files (data/split/kit-aliases.json) and the app moves saved collection
// entries with it.
//
// When a Premium Bandai page is folded into another record, what the page knew
// moves with it: its source ref, price/date when the survivor has none, and the
// Premium Bandai / limited flags (step 6).
//
//   node scripts/clean_catalog.mjs            rewrite data/kits.json + kit-aliases.json
//   node scripts/clean_catalog.mjs --check    report only, exit 1 if anything would change
import { readFile, writeFile } from "node:fs/promises";
import {
  ACCESSORY_KIT,
  KIT_ALIASES_PATH,
  bandaiImageId,
  emptyAliases,
  gundamGradeFromName,
  hasModelCode,
  hasSaleTag,
  kitNameText,
  nfkc,
  nonCollectibleReason,
  productKey,
  resolveAlias,
  scaleFromName,
  stripSaleTags,
} from "./lib/catalog-cleanup.mjs";

const CATALOG_PATH = "data/kits.json";
const FIRST_SEEN_PATH = "data/kit-first-seen.json";
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

const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
const aliasDoc = { ...emptyAliases(), ...(await readJson(KIT_ALIASES_PATH, emptyAliases())) };
const aliases = { ...aliasDoc.aliases };
const excluded = { ...aliasDoc.excluded };
// Ids the app has already published (build_update_feed.mjs stamps every new id
// after the cleanup). An id missing here was created by this very run.
const firstSeen = (await readJson(FIRST_SEEN_PATH, { dates: {} })).dates || {};
const kitsById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
const log = { excluded: [], aliased: [], relabelled: [], tagged: [], flagged: [] };

function addAlias(fromId, toId, why) {
  if (fromId === toId || aliases[fromId] || excluded[fromId]) return;
  if (resolveAlias(aliases, toId) === fromId) return; // never create a cycle
  aliases[fromId] = toId;
  log.aliased.push({ kit_id: fromId, to: toId, why });
}

function addExcluded(kitId, reason) {
  if (aliases[kitId] || excluded[kitId]) return;
  excluded[kitId] = reason;
  log.excluded.push({ kit_id: kitId, reason });
}

function addTag(kit, tag) {
  const tags = Array.isArray(kit.tags) ? kit.tags : [];
  if (tags.includes(tag)) return false;
  kit.tags = [...tags, tag];
  log.tagged.push({ kit_id: kit.kit_id, tag });
  return true;
}

const isLive = (kit) => !aliases[kit.kit_id] && !excluded[kit.kit_id];
const isPbPage = (kit) => kit.kit_id.startsWith("pbandai-wb-");
const pbItemId = (kit) => (isPbPage(kit) ? kit.kit_id.slice("pbandai-wb-".length) : null);
const imageId = (kit) => bandaiImageId(kit.images?.box_art_url);
const published = (kit) => Boolean(firstSeen[kit.kit_id]);
const priceClose = (a, b) => !Number.isFinite(a) || !Number.isFinite(b) || Math.max(a, b) / Math.max(1, Math.min(a, b)) <= 1.6;
const priceEqual = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(a, b) * 0.03;
const monthIndex = (date) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(date || ""));
  return match ? Number(match[1]) * 12 + Number(match[2]) : null;
};

// 1. Non-collectibles, in every franchise.
for (const kit of catalog.kits) {
  if (!isLive(kit)) continue;
  const reason = nonCollectibleReason(kit);
  if (reason) addExcluded(kit.kit_id, reason);
}

// 1b. Plastic accessory kits (HGBC, オプションパーツセット ガンプラ, ガンダムベース
//     MSエフェクト …) stay in the catalog, tagged so the app can tell them apart.
for (const kit of catalog.kits) {
  if (isLive(kit) && kit.franchise === "gundam" && ACCESSORY_KIT.test(kitNameText(kit))) addTag(kit, "accessory-kit");
}

// 2. Gundam grade from the product name. Premium Bandai Wayback and the Gashapon
//    search import every record as GUNDAM_MERCH; most are HG/MG/RG kits,
//    ROBOT魂, METAL BUILD, MOBILE SUIT ENSEMBLE … The relabel runs before the
//    duplicate passes so they compare like with like.
for (const kit of catalog.kits) {
  if (!isLive(kit) || kit.franchise !== "gundam" || kit.grade_code !== "GUNDAM_MERCH") continue;
  const grade = gundamGradeFromName(kitNameText(kit));
  if (!grade) continue;
  const scale = scaleFromName(kitNameText(kit));
  log.relabelled.push({ kit_id: kit.kit_id, from: kit.grade_code, to: grade });
  kit.grade_code = grade;
  if (scale && kit.scale === "non-scale") kit.scale = scale;
}

// 3. Tamashii Web opens a new item page for every sales batch of one figure
//    (【抽選販売】, 【2次：2027年5月発送分】, 【事後販売】 …) and for straight
//    reissues, sometimes with the brand repeated in the title ("METAL STRUCTURE
//    解体匠機 …"). Same brand line + same name without sale tags and brand =
//    same product; the oldest page (lowest Tamashii id) is the record that stays.
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
    members.sort((a, b) => Number(a.kit_id.slice(9)) - Number(b.kit_id.slice(9)));
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
//    Gashapon figure records (mse-/gsf-) are never the target of a PB page: a PB
//    line card sells the whole wave.
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
    const entry = { kit, full: productKey(name), coded: hasModelCode(name), tagged: hasSaleTag(name), month: monthIndex(kit.release_date) };
    entries.set(kit.kit_id, entry);
    const key = `${kit.grade_code}|${kaSignature(kit) ? "ka" : ""}|${bare}`;
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
  for (const member of entries.values()) {
    if (!isPbPage(member.kit)) continue;
    const linked = new Set([...(byImage.get(pbItemId(member.kit)) || []), ...(byImage.get(imageId(member.kit)) || [])]);
    const candidates = new Set();
    for (const other of linked) if (other !== member && priceClose(member.kit.price_jpy, other.kit.price_jpy)) candidates.add(other);
    for (const other of member.group) {
      if (other !== member && sameProduct(member, other) && priceClose(member.kit.price_jpy, other.kit.price_jpy)) candidates.add(other);
    }
    if (!candidates.size) continue;
    const rank = (entry) => {
      if (isPbPage(entry.kit)) return [1, published(entry.kit) ? 0 : 1, entry.tagged ? 1 : 0, Number(pbItemId(entry.kit))];
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
    const keeper = [member, ...candidates].reduce((best, entry) => (compare(rank(entry), rank(best)) < 0 ? entry : best)).kit;
    if (keeper !== member.kit) addAlias(member.kit.kit_id, keeper.kit_id, "Premium Bandai page of a product already in the catalog");
  }
}

// 6. Fold what the dropped duplicate knew into the record that stays: its
//    source_refs (so the PB price/page or the Pokemon Center JAN is not lost),
//    any price/date the survivor lacks, and, for Premium Bandai pages, the PB
//    and limited flags.
const pbPagesByKeeper = new Map();
for (const [fromId, toIdRaw] of Object.entries(aliases)) {
  const toId = resolveAlias(aliases, toIdRaw);
  aliases[fromId] = toId;
  const from = kitsById.get(fromId);
  const to = kitsById.get(toId);
  if (!from || !to || from === to) continue;
  const refs = to.source_refs || [];
  const seen = new Set(refs.map((ref) => `${ref.source_id}|${ref.url}`));
  const extra = (from.source_refs || []).filter((ref) => !seen.has(`${ref.source_id}|${ref.url}`));
  if (extra.length) to.source_refs = [...refs, ...extra.map((ref) => ({ ...ref, confidence: ref.confidence === "high" ? "medium" : ref.confidence }))];
  if (to.price_jpy == null && Number.isInteger(from.price_jpy) && !/【箱売】/.test(from.names?.ja || "")) to.price_jpy = from.price_jpy;
  if (!to.release_date && from.release_date) to.release_date = from.release_date;
  if (isPbPage(from) && !isPbPage(to)) {
    if (!pbPagesByKeeper.has(toId)) pbPagesByKeeper.set(toId, []);
    pbPagesByKeeper.get(toId).push(from);
  }
}

// A BANDAI SPIRITS or Tamashii record does not say whether the product was a
// Premium Bandai exclusive; the PB pages folded into it do:
//   * a PB page whose item id is the record's own product photo id is the
//     product's original PB listing;
//   * resale / lottery / Nth-batch pages (【再販】【２次：…発送】) are repeat PB
//     sales, which Premium Bandai runs for its own items;
//   * an untagged PB page with its own photo is a retail kit Premium Bandai
//     also sells (the current PB Gunpla shop lists retail reruns). That is a
//     sales channel, not a limited: tag premium-bandai-sale only.
// A Tamashii figure counts as limited only when Tamashii itself says so
// (魂ウェブ商店 / event); otherwise PB is a sales channel there too.
for (const [toId, pages] of pbPagesByKeeper) {
  const to = kitsById.get(toId);
  if (!to || !isLive(to)) continue;
  const ownImage = imageId(to);
  const original = Boolean(ownImage) && pages.some((page) => pbItemId(page) === ownImage || imageId(page) === ownImage);
  const repeatSale = pages.some((page) => hasSaleTag(kitNameText(page)));
  const exclusive = to.kit_id.startsWith("tamashii-") ? Boolean(to.is_limited) : original || repeatSale;
  if (!exclusive) {
    addTag(to, "premium-bandai-sale");
    continue;
  }
  if (to.is_premium_bandai !== true || to.is_limited !== true || !to.premium_bandai) {
    const latest = [...pages].sort((a, b) => Number(pbItemId(b)) - Number(pbItemId(a)))[0];
    to.is_premium_bandai = true;
    to.is_limited = true;
    to.premium_bandai = to.premium_bandai || { ...(latest.premium_bandai || {}), captured_via: latest.premium_bandai?.captured_via || "wayback" };
    log.flagged.push({ kit_id: toId, pages: pages.length, original });
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
console.log(
  `Catalog cleanup: ${removed} records removed (${log.excluded.length} newly excluded ${JSON.stringify(byFranchise(log.excluded))}, ` +
    `${log.aliased.length} newly aliased ${JSON.stringify(byFranchise(log.aliased))}), ${log.relabelled.length} grades relabelled, ` +
    `${log.flagged.length} records given the Premium Bandai / limited flags of their PB pages, ${log.tagged.length} tags added; ` +
    `${kept.length} records remain. kit-aliases.json: ${Object.keys(aliases).length} aliases, ${Object.keys(excluded).length} excluded.`,
);
if (verbose) {
  for (const entry of log.excluded) console.log(`  excluded ${entry.kit_id} (${entry.reason}) ${kitNameText(kitsById.get(entry.kit_id))}`);
  for (const entry of log.aliased) console.log(`  alias    ${entry.kit_id} -> ${entry.to} (${entry.why})`);
  for (const entry of log.relabelled) console.log(`  grade    ${entry.kit_id} ${entry.from} -> ${entry.to}`);
  for (const entry of log.flagged) console.log(`  pb       ${entry.kit_id} (${entry.pages} PB pages${entry.original ? ", original listing" : ""})`);
  for (const entry of log.tagged) console.log(`  tag      ${entry.kit_id} ${entry.tag}`);
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
const aliasesChanged =
  JSON.stringify(sortKeys(aliases)) !== JSON.stringify(sortKeys(aliasDoc.aliases)) ||
  JSON.stringify(sortKeys(excluded)) !== JSON.stringify(sortKeys(aliasDoc.excluded));
const changed = removed > 0 || log.relabelled.length > 0 || log.flagged.length > 0 || log.tagged.length > 0 || aliasesChanged;

if (checkOnly) {
  if (changed) {
    console.error("Catalog has records the cleanup rules would remove or relabel. Run node scripts/clean_catalog.mjs.");
    process.exitCode = 1;
  }
} else if (changed) {
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, kits: kept }, null, 2)}\n`, "utf8");
  if (aliasesChanged) {
    const doc = {
      schema: 1,
      updated_at: today(),
      description:
        "kit_ids removed from data/kits.json. aliases: duplicate id -> id of the record that replaced it (move saved entries there). excluded: id -> why the record was dropped (not a collectible, wrong franchise …).",
      aliases: sortKeys(aliases),
      excluded: sortKeys(excluded),
    };
    await writeFile(KIT_ALIASES_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }
}
