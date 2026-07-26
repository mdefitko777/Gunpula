import assert from "node:assert/strict";
import {
  applyDrafts,
  categoryRecords,
  materializeCatalog,
  resolveMerge,
  validateProduct,
} from "../admin/cms-model.js";

const base = [
  { kit_id: "a", franchise: "gundam", names: { zh: "甲" }, data_status: "verified", series: { key: "seed", labels: { zh: "SEED" } } },
  { kit_id: "b", franchise: "gundam", names: { zh: "乙" }, data_status: "verified", series: { key: "seed" } },
];
const state = applyDrafts({}, [
  { id: 1, status: "draft", entity_type: "product", entity_id: "a", operation: "edit", patch: { names: { zh: "甲改" } } },
  { id: 2, status: "draft", entity_type: "merge", entity_id: "b", operation: "merge", patch: { target_id: "a" } },
]);
const kits = materializeCatalog(base, state);
assert.equal(kits.length, 1);
assert.equal(kits[0].names.zh, "甲改");
assert.equal(resolveMerge("b", state.merges), "a");
assert.equal(categoryRecords(kits, state)[0].count, 1);
const categories = categoryRecords(kits, state, {
  franchises: {
    pokemon: [{ id: "gen1", labels: { zh: "第一世代" }, kit_ids: ["p1", "p2"] }],
    fate: [{ id: "fgo_100", labels: { zh: "特异点 F" }, kit_ids: ["f1"] }],
    armored_core: [{ id: "ac6", labels: { zh: "装甲核心 6" }, count: 4 }],
  },
});
assert.equal(categories.find((item) => item.id === "pokemon:atlas:gen1").kind, "generation");
assert.equal(categories.find((item) => item.id === "fate:atlas:fgo_100").kind, "chapter");
assert.equal(categories.find((item) => item.id === "armored_core:atlas:ac6").kind, "game");
assert.deepEqual(validateProduct({ ...base[0], kit_id: "Bad ID" }), ["商品 ID 只能使用小写字母、数字和连字符"]);
console.log("admin/cms-model.js: tests OK");
