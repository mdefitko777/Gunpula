// Removes records that should not be in the published catalog and fixes the
// GUNDAM_MERCH grade on Premium Bandai / Gashapon kits. Runs after every import
// (run_importers.mjs), so a record an importer brings back is dropped again.
//
//   * non-collectibles (Blu-ray, CD, books, tickets, apparel, household …)
//   * sale pages of a product the catalog already has: Premium Bandai lottery /
//     resale / 2次発送 pages, Tamashii Web 【抽選販売】/【2次：…発送分】 pages,
//     Gashapon line and 【箱売】 cards whose figures are imported one by one
//   * anything listed in data/kit-aliases.json (curated duplicates and
//     exclusions, plus everything this script found on earlier runs)
//
// kit_ids are never renamed. A removed id is recorded in data/kit-aliases.json:
// `aliases` maps a duplicate to the record that survives, `excluded` says why a
// record was dropped. Apps read it to move saved collection entries.
//
//   node scripts/clean_catalog.mjs            rewrite data/kits.json + kit-aliases.json
//   node scripts/clean_catalog.mjs --check    report only, exit 1 if anything would change
import { readFile, writeFile } from "node:fs/promises";
import {
  KIT_ALIASES_PATH,
  emptyAliases,
  gundamGradeFromName,
  kitNameText,
  nfkc,
  nonCollectibleReason,
  hasModelCode,
  productKey,
  resolveAlias,
  scaleFromName,
  stripSaleTags,
} from "./lib/catalog-cleanup.mjs";

const CATALOG_PATH = "data/kits.json";
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
const kitsById = new Map(catalog.kits.map((kit) => [kit.kit_id, kit]));
const log = { excluded: [], aliased: [], relabelled: [] };

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

const isLive = (kit) => !aliases[kit.kit_id] && !excluded[kit.kit_id];
const sourceIds = (kit) => new Set((kit.source_refs || []).map((ref) => ref.source_id));
const priceClose = (a, b) => !Number.isFinite(a) || !Number.isFinite(b) || Math.max(a, b) / Math.max(1, Math.min(a, b)) <= 1.6;

// 1. Non-collectibles, in every franchise.
for (const kit of catalog.kits) {
  if (!isLive(kit)) continue;
  const reason = nonCollectibleReason(kit);
  if (reason) addExcluded(kit.kit_id, reason);
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
//    reissues. Same brand line + same name without the sale tags = same product;
//    the oldest page (lowest Tamashii id) is the record that stays.
{
  const groups = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !/^tamashii-\d+$/.test(kit.kit_id)) continue;
    const key = `${kit.subline}|${stripSaleTags(kitNameText(kit)).replace(/\s+/g, "")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(kit);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => Number(a.kit_id.slice(9)) - Number(b.kit_id.slice(9)));
    for (const kit of members.slice(1)) addAlias(kit.kit_id, members[0].kit_id, "tamashii sale batch / reissue page");
  }
}

// 4. Gashapon: line cards ("MOBILE SUIT ENSEMBLE 06", "ガシャポン戦士フォルテ09")
//    whose figures importEnsemble / importForte already import one by one, and
//    【箱売】 box-sale cards of a capsule line already in the catalog.
{
  const volumeKey = (text) =>
    nfkc(text)
      .replace(/.*(?:MOBILE SUIT ENSEMBLE|ガシャポン戦士(?:フォルテ|f))\s*/i, "")
      .replace(/[~～]?Ver\.\s*FUKUOKA[~～]?/i, "fukuoka")
      .replace(/[~～]?初音ミク color Ver\.[~～]?/i, "hatsunemiku")
      .replace(/^ガンダムメカ$/, "mecha")
      .replace(/\s+/g, "")
      .toLowerCase();
  const firstFigure = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !["MSE", "GSF"].includes(kit.grade_code) || !/^(?:mse|gsf)-/.test(kit.kit_id)) continue;
    const key = `${kit.grade_code}|${volumeKey(kit.subline)}`;
    const current = firstFigure.get(key);
    if (!current || kit.kit_id.localeCompare(current.kit_id, "en", { numeric: true }) < 0) firstFigure.set(key, kit);
  }
  const lineByName = new Map();
  for (const kit of catalog.kits) {
    if (isLive(kit) && kit.kit_id.startsWith("gundam-merch-") && !/【箱売】/.test(kit.names?.ja || "")) {
      lineByName.set(nfkc(kit.names?.ja).replace(/【[^】]*】/g, "").replace(/\s+/g, ""), kit);
    }
  }
  for (const kit of catalog.kits) {
    if (!isLive(kit) || !kit.kit_id.startsWith("gundam-merch-")) continue;
    const name = nfkc(kit.names?.ja);
    const plain = name.replace(/【[^】]*】/g, "").trim();
    if (["MSE", "GSF"].includes(kit.grade_code)) {
      const figure = firstFigure.get(`${kit.grade_code}|${volumeKey(plain)}`);
      if (figure) {
        addAlias(kit.kit_id, figure.kit_id, "gashapon line card of per-figure records");
        // Per-figure records carry no price; the line card has the capsule price.
        if (!/【箱売】/.test(name) && Number.isFinite(kit.price_jpy)) {
          for (const sibling of catalog.kits) {
            if (sibling.grade_code === kit.grade_code && sibling.subline === figure.subline && sibling.price_jpy == null) {
              sibling.price_jpy = kit.price_jpy;
            }
          }
        }
        continue;
      }
    }
    if (/【箱売】/.test(name)) {
      const line = lineByName.get(plain.replace(/\s+/g, ""));
      if (line && line.kit_id !== kit.kit_id) addAlias(kit.kit_id, line.kit_id, "gashapon box-sale card");
    }
  }
}

// 5. Premium Bandai Wayback pages of a product the catalog already has: lottery
//    and resale pages of BANDAI SPIRITS kits, PB pages of Tamashii figures, and
//    repeat PB pages (再販, 2次/3次発送) of the same PB item. Same grade + same
//    product key + a compatible price; a non-PB record wins, then the PB page
//    without sale tags, then the oldest PB item id.
{
  const isPbWayback = (kit) => kit.kit_id.startsWith("pbandai-wb-");
  const kaSignature = (kit) => /Ka signature/i.test(`${kit.subline || ""} ${kitNameText(kit)}`);
  const rank = (kit) => [isPbWayback(kit) ? 1 : 0, stripSaleTags(kitNameText(kit)) === kitNameText(kit) ? 0 : 1, kit.kit_id];
  const better = (a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i += 1) {
      if (ra[i] !== rb[i]) return String(ra[i]).localeCompare(String(rb[i]), "en", { numeric: true }) < 0;
    }
    return false;
  };
  // Grouped on the key without model codes; within a group two records match
  // when their keys with codes agree, or when one of them names no code at all
  // (so "RG ガンダム Ver.2.0" never meets "RG G-3 ガンダム Ver.2.0").
  const groups = new Map();
  for (const kit of catalog.kits) {
    if (!isLive(kit) || kit.franchise !== "gundam") continue;
    if (kit.grade_code === "GUNDAM_MERCH" && !isPbWayback(kit)) continue;
    const name = kitNameText(kit);
    const bare = productKey(name, { keepCodes: false });
    if (!bare) continue;
    const key = `${kit.grade_code}|${kaSignature(kit) ? "ka" : ""}|${bare}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ kit, full: productKey(name), coded: hasModelCode(name) });
  }
  const sameProduct = (a, b) => a.full === b.full || !a.coded || !b.coded;
  for (const members of groups.values()) {
    if (members.length < 2 || !members.some((m) => isPbWayback(m.kit))) continue;
    for (const member of members) {
      if (!isPbWayback(member.kit)) continue;
      const candidates = members.filter((other) => other !== member && sameProduct(member, other) && priceClose(member.kit.price_jpy, other.kit.price_jpy));
      if (!candidates.length) continue;
      const keeper = [member, ...candidates].reduce((best, m) => (better(m.kit, best.kit) ? m : best)).kit;
      if (keeper !== member.kit) addAlias(member.kit.kit_id, keeper.kit_id, "Premium Bandai page of a product already in the catalog");
    }
  }
}

// 6. Fold what the dropped duplicate knew into the record that stays: its
//    source_refs (so the PB price/page or the Pokemon Center JAN is not lost) and
//    any price/date the survivor lacks.
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
    `${log.aliased.length} newly aliased ${JSON.stringify(byFranchise(log.aliased))}), ${log.relabelled.length} grades relabelled; ` +
    `${kept.length} records remain. kit-aliases.json: ${Object.keys(aliases).length} aliases, ${Object.keys(excluded).length} excluded.`,
);
if (verbose) {
  for (const entry of log.excluded) console.log(`  excluded ${entry.kit_id} (${entry.reason}) ${kitNameText(kitsById.get(entry.kit_id))}`);
  for (const entry of log.aliased) console.log(`  alias    ${entry.kit_id} -> ${entry.to} (${entry.why})`);
  for (const entry of log.relabelled) console.log(`  grade    ${entry.kit_id} ${entry.from} -> ${entry.to}`);
}

const sortKeys = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })));
const aliasesChanged =
  JSON.stringify(sortKeys(aliases)) !== JSON.stringify(sortKeys(aliasDoc.aliases)) ||
  JSON.stringify(sortKeys(excluded)) !== JSON.stringify(sortKeys(aliasDoc.excluded));
const changed = removed > 0 || log.relabelled.length > 0 || aliasesChanged;

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
