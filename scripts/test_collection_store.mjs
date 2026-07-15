import assert from "node:assert/strict";
import {
  clampCollectionQuantity,
  mergeCollectionState,
  mergeTimestampedMap,
  normalizeCollection,
  safeMemberName,
} from "../app/collection-store.js";

const options = {
  statuses: ["owned", "wanted", "deleted"],
  self: "me",
  droppedMembers: new Set(["drop-me"]),
  memberMerges: { member: "me" },
};

assert.equal(safeMemberName("  "), "member");
assert.equal(clampCollectionQuantity("0"), 1);
assert.equal(clampCollectionQuantity("120"), 99);

const normalized = normalizeCollection(
  {
    owned: ["kit-a"],
    wanted: ["kit-b"],
    member_items: {
      "drop-me": { "kit-x": { status: "owned" } },
      member: { "kit-c": { status: "wanted", quantity: 2, updated_at: "2026-01-01T00:00:00Z" } },
    },
  },
  options,
);

assert.deepEqual(normalized.owned, []);
assert.deepEqual(normalized.wanted, ["kit-c"]);
assert.equal(normalized.member_items["drop-me"], undefined);
assert.equal(normalized.member_items.me["kit-c"].quantity, 2);

const merged = mergeCollectionState(
  { member_items: { me: { "kit-a": { status: "wanted", updated_at: "2026-01-01T00:00:00Z" } } } },
  { member_items: { me: { "kit-a": { status: "owned", updated_at: "2026-02-01T00:00:00Z" } } } },
  options,
);
assert.equal(merged.member_items.me["kit-a"].status, "owned");

assert.deepEqual(
  mergeTimestampedMap(
    { a: { value: 1, updated_at: "2026-01-01T00:00:00Z" } },
    { a: { value: 2, updated_at: "2025-01-01T00:00:00Z" } },
  ),
  { a: { value: 1, updated_at: "2026-01-01T00:00:00Z" } },
);

console.log("collection-store tests OK");
