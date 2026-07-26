import assert from "node:assert/strict";
import {
  applyCmsAtlasGroups,
  applyCmsCatalog,
  cmsSeriesLabelOverrides,
  resolveCmsMerge,
} from "../app/cms-patches.js";

const payload = {
  products: { a: { names: { zh: "修改后" }, taxonomy_ids: ["pokemon:atlas:gen1"] } },
  added: { c: { franchise: "pokemon", names: { zh: "新增" } } },
  merges: { b: "a" },
  categories: {
    "pokemon:atlas:gen1": {
      id: "pokemon:atlas:gen1",
      franchise: "pokemon",
      key: "gen1",
      labels: { zh: "关都世代" },
      subtitle: { zh: "红 / 绿 / 蓝" },
      cover_url: "./cover.webp",
      sort: 1,
    },
  },
};

const catalog = applyCmsCatalog([
  { kit_id: "a", names: { zh: "原名" } },
  { kit_id: "b", names: { zh: "重复" } },
], payload);
assert.deepEqual(catalog.map((item) => item.kit_id), ["a", "c"]);
assert.equal(catalog[0].names.zh, "修改后");
assert.equal(resolveCmsMerge("b", payload), "a");
assert.equal(cmsSeriesLabelOverrides(payload).gen1.zh, "关都世代");

const groups = applyCmsAtlasGroups({
  pokemon: [
    { id: "gen2", labels: { zh: "第二世代" } },
    { id: "gen1", labels: { zh: "第一世代" }, subtitle: {}, image: "" },
  ],
}, payload);
assert.equal(groups.pokemon[0].id, "gen1");
assert.equal(groups.pokemon[0].labels.zh, "关都世代");
assert.equal(groups.pokemon[0].subtitle.zh, "红 / 绿 / 蓝");
assert.equal(groups.pokemon[0].image, "./cover.webp");
assert.deepEqual(groups.pokemon[0].kit_ids, ["a"]);

console.log("app/cms-patches.js: tests OK");
