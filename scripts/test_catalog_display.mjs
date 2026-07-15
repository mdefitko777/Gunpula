import assert from "node:assert/strict";
import {
  expandedSearchTerms,
  franchiseLabelFor,
  gradeShortLabelFor,
  itemTypeKeyForCategory,
  kitDisplayNameFor,
  kitSeriesKey,
  kitShortNameFor,
  numericFilterValue,
} from "../app/catalog-display.js";

assert.equal(franchiseLabelFor("gundam", "zh"), "高达");
assert.equal(gradeShortLabelFor("METAL_BUILD", "ko"), "MB");
assert.equal(itemTypeKeyForCategory("core"), "plastic_model");
assert.equal(numericFilterValue("¥12,100"), 12100);
assert.equal(kitSeriesKey({ series: { key: "seed" } }), "seed");
assert.ok(expandedSearchTerms("freedom").includes("自由"));

const kit = {
  kit_id: "test-kit",
  names: {
    ja: "機動戦士ガンダムSEED フリーダム",
    en: "Mobile Suit Gundam SEED Freedom",
  },
};

assert.equal(kitDisplayNameFor(kit, "zh"), "Mobile Suit 高达 SEED Freedom");
assert.equal(kitShortNameFor(kit, "en"), "SEED Freedom");

console.log("catalog-display tests OK");
