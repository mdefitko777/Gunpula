import assert from "node:assert/strict";
import {
  itemIsPremiumBandai,
  localDateKey,
  recentFeedKits,
  releaseItemsForMonth,
  updateEntryPremiumBandaiTotal,
  updateFeedStats,
  validReleaseMonth,
  weekOnSaleKits,
} from "../app/update-feed.js";

const feed = {
  updated_at: "2026-07-16",
  entries: [
    {
      date: "2026-07-16",
      added_count: 2,
      changed_count: 1,
      added: [
        { kit_id: "pb-1", franchise: "gundam", names: { ja: "PB限定" }, source_urls: ["https://p-bandai.jp/item/1"] },
        { kit_id: "bbx-1", franchise: "beyblade", names: { en: "BX" } },
      ],
      changed: [{ kit_id: "seed-1", franchise: "gundam", watch_tags: ["seed"] }],
    },
  ],
};

assert.equal(validReleaseMonth("2026-07"), "2026-07");
assert.equal(validReleaseMonth("2026-07-11"), "");
assert.equal(localDateKey(new Date(2026, 6, 5)), "2026-07-05");
assert.equal(itemIsPremiumBandai(feed.entries[0].added[0]), true);
assert.equal(updateEntryPremiumBandaiTotal(feed.entries[0], "gundam"), 1);

const stats = updateFeedStats(feed, { today: new Date(2026, 6, 16) });
assert.equal(stats.today.count, 3);
assert.equal(stats.today.premium, 1);

const kits = [
  { kit_id: "old", franchise: "gundam", release_date: "2026-06-01" },
  { kit_id: "new", franchise: "gundam", release_date: "2026-07-16" },
  { kit_id: "seen", franchise: "pokemon" },
];

assert.deepEqual(releaseItemsForMonth(kits, { month: "2026-07", firstSeen: { seen: "2026-07-03" } }).map((kit) => kit.kit_id), ["seen", "new"]);
assert.deepEqual(weekOnSaleKits(kits, { today: new Date(2026, 6, 16) }).map((kit) => kit.kit_id), ["new"]);
assert.deepEqual(recentFeedKits(feed, { days: 3, displayKitById: (id) => kits.find((kit) => kit.kit_id === id) || { kit_id: id } }).map((kit) => kit.kit_id), [
  "pb-1",
  "bbx-1",
  "seed-1",
]);

console.log("update-feed tests OK");
