import assert from "node:assert/strict";
import {
  aliasVariants,
  createSearchDocument,
  groupSearchResults,
  normalizeSearchText,
  parseSearchQuery,
  searchDocuments,
} from "../app/search-engine.js";

const kits = [
  {
    kit_id: "bandai-mg-strike-freedom-20",
    franchise: "gundam",
    grade_code: "MG",
    scale: "1/100",
    work_title: "Mobile Suit Gundam SEED Destiny",
    is_limited: false,
    number: "5061608",
    names: {
      zh: "MG 1/100 强袭自由高达 Ver.2.0",
      ko: "MG 1/100 스트라이크 프리덤 건담 Ver.2.0",
      en: "MG 1/100 Strike Freedom Gundam Ver.2.0",
      ja: "MG 1/100 ストライクフリーダムガンダム Ver.2.0",
    },
    series: { key: "seed", labels: { zh: "SEED", ko: "SEED", en: "SEED", ja: "SEED" } },
    tags: ["gunpla"],
  },
  {
    kit_id: "koto-ac-white-glint",
    franchise: "armored_core",
    grade_code: "VI",
    scale: "1/72",
    work_title: "ARMORED CORE for Answer",
    is_limited: true,
    names: { zh: "白色闪光", ko: "화이트 글린트", en: "White Glint", ja: "ホワイト・グリント" },
    series: { key: "acfa", labels: { zh: "ACFA", en: "ACFA" } },
  },
  {
    kit_id: "bandai-rg-rx-78-2",
    franchise: "gundam",
    grade_code: "RG",
    number: "RX-78-2",
    names: { zh: "RX-78-2 高达", ko: "RX-78-2 건담", en: "RX-78-2 Gundam", ja: "RX-78-2 ガンダム" },
    series: { key: "uc_first", labels: { zh: "初代", en: "0079" } },
  },
];

const documents = kits.map((kit) => createSearchDocument(kit));

assert.equal(normalizeSearchText("ＭＧ 1 ／ 100 Pokémon"), "mg 1/100 pokemon");
assert(aliasVariants("强自").includes("strike freedom"));
assert(aliasVariants("白闪").includes("white glint"));
assert(!aliasVariants("GSF").includes("strike freedom"));

const intent = parseSearchQuery("对方想要 AC6 MG");
assert.equal(intent.owner, "other");
assert.equal(intent.collection, "wanted");
assert(intent.productLines.includes("mg"));
assert(intent.tokens.includes("ac6"));
assert.equal(parseSearchQuery("我的 MG SEED").collection, "owned");

assert.equal(searchDocuments(documents, "强自").results[0].item.kit_id, kits[0].kit_id);
assert.equal(searchDocuments(documents, "SF").results[0].item.kit_id, kits[0].kit_id);
assert.equal(searchDocuments(documents, "프리덤 MG SEED").results[0].item.kit_id, kits[0].kit_id);
assert.equal(searchDocuments(documents, "MG SEED 自由 2.0").results[0].item.kit_id, kits[0].kit_id);
assert.equal(searchDocuments(documents, "5061608").results[0].item.kit_id, kits[0].kit_id);
assert.equal(searchDocuments(documents, "RX 78 2").results[0].item.kit_id, kits[2].kit_id);
assert.equal(searchDocuments(documents, "白闪").results[0].item.kit_id, kits[1].kit_id);
assert.equal(searchDocuments(documents, "white glnit").results[0].item.kit_id, kits[1].kit_id);
assert.equal(searchDocuments(documents, "限定 白闪").results[0].item.kit_id, kits[1].kit_id);
assert.equal(searchDocuments(documents, "限定 强自").total, 0);
assert.equal(searchDocuments(documents, "completely unknown query").total, 0);

const grouped = groupSearchResults(searchDocuments(documents, "gundam").results);
assert(grouped.length >= 2);

console.log("search-engine: all assertions passed");
