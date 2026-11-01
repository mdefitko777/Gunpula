import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { buildBackupPayload, buildLocalState, parseBackupLocalState } from "../app/backup-format.js";

// Shape Hobby Atlas reads (lib/data/user_store.dart ImportPreview.parse):
// top-level collection/overrides/series_label_overrides + local_state.{bbx_owned_parts,
// bbx_manual_map, guide_manual_lit, recent_viewed}.
const cloud = {
  schema_version: 1,
  collection: {
    owned: ["kit-a"],
    wanted: ["kit-b"],
    items: {
      "kit-a": { status: "owned", updated_at: "2026-10-01T00:00:00.000Z", quantity: 1 },
      "kit-b": { status: "wanted", updated_at: "2026-10-02T00:00:00.000Z" },
    },
    member_items: {
      me: {
        "kit-a": { status: "owned", updated_at: "2026-10-01T00:00:00.000Z", quantity: 1 },
        "kit-b": { status: "wanted", updated_at: "2026-10-02T00:00:00.000Z" },
      },
    },
  },
  overrides: {},
  series_label_overrides: {},
  appearance: { theme: "default", app_icon: "", home_covers: {} },
  // A stray secret in the cloud object must still never reach the file.
  github_token: "ghp_should_not_leak",
};

const payload = buildBackupPayload({
  exportedAt: "2026-11-02T00:00:00.000Z",
  app: "test",
  cloud,
  localState: {
    bbxOwnedParts: new Set(["bx-01-blade", "bx-01-ratchet", "", 7]),
    bbxManualMap: new Map([["kit-event-1", "BX-01"], ["kit-event-2", 42]]),
    guideManualLit: new Set([1001000200, 1001000100, "1001000150", "x", 1.5]),
    recentViewed: ["kit-a", "kit-a", "kit-b"],
  },
});

assert.equal("github_token" in payload, false);
assert.equal(JSON.stringify(payload).includes("ghp_"), false);
assert.deepEqual(payload.collection, cloud.collection);
assert.equal(payload.exported_at, "2026-11-02T00:00:00.000Z");
assert.deepEqual(Object.keys(payload.local_state).sort(), [
  "bbx_manual_map",
  "bbx_owned_parts",
  "guide_manual_lit",
  "recent_viewed",
]);
assert.deepEqual(payload.local_state.bbx_owned_parts, ["bx-01-blade", "bx-01-ratchet"]);
assert.deepEqual(payload.local_state.bbx_manual_map, { "kit-event-1": "BX-01", "kit-event-2": "42" });
// gget unit_ids stay JSON numbers (Hobby Atlas keeps them as Set<int>).
assert.deepEqual(payload.local_state.guide_manual_lit, [1001000100, 1001000150, 1001000200]);
assert.deepEqual(payload.local_state.recent_viewed, ["kit-a", "kit-b"]);

// Round-trip through JSON text, as the file does.
const reread = parseBackupLocalState(JSON.parse(JSON.stringify(payload)));
assert.deepEqual(reread, {
  bbxOwnedParts: ["bx-01-blade", "bx-01-ratchet"],
  bbxManualMap: { "kit-event-1": "BX-01", "kit-event-2": "42" },
  guideManualLit: [1001000100, 1001000150, 1001000200],
  recentViewed: ["kit-a", "kit-b"],
});

// Older backups: no local_state → null (device data untouched); github_token
// in old files is simply ignored by this parser.
assert.equal(parseBackupLocalState({ collection: {}, github_token: "ghp_old" }), null);
assert.equal(parseBackupLocalState({ local_state: [] }), null);
assert.equal(parseBackupLocalState(null), null);
// Partial/malformed local_state degrades to empty fields.
assert.deepEqual(parseBackupLocalState({ local_state: { bbx_owned_parts: "nope", bbx_manual_map: ["x"] } }), {
  bbxOwnedParts: [],
  bbxManualMap: {},
  guideManualLit: [],
  recentViewed: [],
});
// Empty state still exports every key so the importer sees a stable shape.
assert.deepEqual(buildLocalState(), { bbx_owned_parts: [], bbx_manual_map: {}, guide_manual_lit: [], recent_viewed: [] });

const sampleOut = process.env.BACKUP_SAMPLE_OUT;
if (sampleOut) {
  await writeFile(sampleOut, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`sample backup written to ${sampleOut}`);
}

console.log("backup format tests passed");
