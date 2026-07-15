import assert from "node:assert/strict";
import { normalizeFilterStateValue, viewStateUrl } from "../app/view-state.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {
  location: { pathname: "/Gunpula/app/", search: "" },
};

assert.equal(normalizeFilterStateValue(["HG", "RG", "HG", "all"]), "HG,RG");
assert.equal(normalizeFilterStateValue("all"), "all");
assert.equal(normalizeFilterStateValue(" HG, RG ,, all "), "HG,RG");

const url = viewStateUrl(
  {
    language: "zh",
    franchise: "gundam",
    series: "seed,00",
    grade: "all",
    itemType: "plastic_model",
    view: "catalog",
    kit: "hg-001",
  },
  "view-state-test",
);

assert.equal(url, "/Gunpula/app/#lang=zh&franchise=gundam&series=seed%2C00&type=plastic_model&kit=hg-001");
assert.equal(JSON.parse(storage.get("view-state-test")).kit, "hg-001");

console.log("view-state tests OK");
