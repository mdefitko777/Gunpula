import assert from "node:assert/strict";
import {
  clampCollectionQuantity,
  mergeCollectionState,
  mergeTimestampedMap,
  normalizeCollection,
  remapKitEntries,
  resolveKitAlias,
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

// Entries saved on a retired kit_id move to the record that replaced it.
{
  const kitAliases = { "pbandai-wb-1": "rg-banshee", "tamashii-2": "tamashii-1", "tamashii-1": "tamashii-0" };
  assert.equal(resolveKitAlias(kitAliases, "tamashii-2"), "tamashii-0");
  assert.equal(resolveKitAlias(kitAliases, "unknown"), "unknown");
  assert.equal(resolveKitAlias({ a: "b", b: "a" }, "a"), "a"); // a cycle cannot hang the app
  const remapped = normalizeCollection(
    {
      member_items: {
        me: {
          "pbandai-wb-1": { status: "owned", updated_at: "2026-03-01T00:00:00Z" },
          "rg-banshee": { status: "wanted", updated_at: "2026-01-01T00:00:00Z" },
          "tamashii-2": { status: "wanted", quantity: 2, updated_at: "2026-01-01T00:00:00Z" },
        },
      },
    },
    { ...options, kitAliases },
  );
  assert.deepEqual(Object.keys(remapped.member_items.me).sort(), ["rg-banshee", "tamashii-0"]);
  assert.equal(remapped.member_items.me["rg-banshee"].status, "owned"); // the newer entry wins
  assert.equal(remapped.member_items.me["tamashii-0"].quantity, 2);
  assert.deepEqual(remapped.owned, ["rg-banshee"]);
  assert.deepEqual(Object.keys(remapKitEntries({ "tamashii-2": { status: "owned" } }, kitAliases)), ["tamashii-0"]);
}
