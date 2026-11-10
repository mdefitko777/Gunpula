import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

// scripts/build_update_feed.mjs (runs on import, so it is run in a scratch folder: all its paths are relative)
{
  const dir = mkdtempSync(join(tmpdir(), "update-feed-"));
  try {
    mkdirSync(join(dir, "data"));
    const shop = { source_id: "bandai_hobby", url: "https://bandai-hobby.net/item/a/" };
    const wayback = { source_id: "p_bandai_wayback", url: "https://p-bandai.jp/item/item-1000142431/", fields: ["names"], confidence: "medium" };
    const base = (id, extra = {}) => ({ kit_id: id, franchise: "gundam", grade_code: "HG", names: { ja: `ja-${id}`, ko: `ko-${id}` }, release_date: "2026-11", source_refs: [shop], ...extra });
    const before = { updated_at: "2026-11-10", kits: [base("arch"), base("src"), base("both"), base("named")] };
    const current = {
      updated_at: "2026-11-11",
      kits: [
        base("arch", { source_refs: [shop, wayback] }),
        base("src", { source_refs: [shop, { source_id: "p_bandai_jp", url: "https://p-bandai.jp/item/item-1/" }] }),
        base("both", { source_refs: [shop, wayback], price_jpy: 3300 }),
        base("named", { names: { ja: "ガンプラＬＥＤユニット２個セット（緑）", ko: "건프라 LED 유닛 2개 세트 (초록)" }, series: { key: "tools", labels: { ko: "건프라 툴" } } }),
      ],
    };
    const stale = { kit_id: "named", change_type: "added", franchise: "gundam", series_key: "seed", series_labels: { ko: "건담 SEED" }, names: { ja: "ガンプラＬＥＤユニット２個セット（緑）", ko: "ガンプラＬＥＤユニット２個세트（緑）" }, change_reasons: ["new"] };
    const gone = { kit_id: "gone", change_type: "added", franchise: "gundam", names: { ko: "옛 이름" }, change_reasons: ["new"] };
    writeFileSync(join(dir, "before.json"), JSON.stringify(before));
    writeFileSync(join(dir, "data/kits.json"), JSON.stringify(current));
    writeFileSync(join(dir, "data/update-feed.json"), JSON.stringify({ entries: [{ date: "2026-11-01", added: [stale, gone], changed: [], removed: [], watched: [] }] }));
    execFileSync(process.execPath, [fileURLToPath(new URL("./build_update_feed.mjs", import.meta.url)), "--before=before.json"], { cwd: dir, stdio: "pipe" });
    for (const file of ["data/update-feed.json", "data/update-feed-lite.json"]) {
      const out = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const today = out.entries.find((e) => e.date === "2026-11-11");
      const reasons = Object.fromEntries(today.changed.map((i) => [i.kit_id, i.change_reasons]));
      assert.deepEqual(reasons.arch, ["archive"], `${file}: a new archive.org copy is not a source change`);
      assert.deepEqual(reasons.src, ["source"], `${file}: a new shop source still is`);
      assert.deepEqual(reasons.both, ["price", "archive"]);
      const old = out.entries.find((e) => e.date === "2026-11-01");
      assert.equal(old.added[0].names.ko, "건프라 LED 유닛 2개 세트 (초록)", `${file}: older items take the current Korean name`);
      assert.deepEqual(old.added[0].series_labels, { ko: "건프라 툴" });
      assert.equal(old.added[0].series_key, "tools", `${file}: the series key moves with its label`);
      assert.equal(old.added[1].names.ko, "옛 이름", `${file}: a kit no longer in the catalog keeps its stored name`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Renamed / relisted ids are not "added" (2026-11-10: nine BEYBLADE X ids got new ids, first seen 2026-07-08)
{
  const dir = mkdtempSync(join(tmpdir(), "update-feed-"));
  try {
    mkdirSync(join(dir, "data"));
    const base = (id) => ({ kit_id: id, franchise: "beyblade", grade_code: "BX", names: { ja: `ja-${id}`, ko: `ko-${id}` }, release_date: "2026-11" });
    const before = { updated_at: "2026-11-11", kits: [base("beyblade-x-bx-00-116"), base("stay")] };
    const current = { updated_at: "2026-11-11", kits: [base("beyblade-x-bx00-drgs"), base("relisted"), base("fresh"), base("stay")] };
    const oldAdded = (id) => ({ kit_id: id, change_type: "added", franchise: "beyblade", names: { ko: id }, change_reasons: ["new"] });
    writeFileSync(join(dir, "before.json"), JSON.stringify(before));
    writeFileSync(join(dir, "data/kits.json"), JSON.stringify(current));
    writeFileSync(join(dir, "data/kit-aliases.json"), JSON.stringify({ aliases: { "beyblade-x-bx-00-116": "beyblade-x-bx00-drgs", "old-cx": "beyblade-x-cx10" } }));
    writeFileSync(join(dir, "data/kit-first-seen.json"), JSON.stringify({ dates: { "beyblade-x-bx-00-116": "2026-07-08", relisted: "2026-07-21", stay: "2026-07-08", "beyblade-x-cx10": "2026-11-10", "new-1110": "2026-11-10", "old-1110": "2026-07-08" } }));
    writeFileSync(
      join(dir, "data/update-feed.json"),
      JSON.stringify({
        entries: [{
          date: "2026-11-10", added_count: 3, merged_count: 1,
          added: [oldAdded("beyblade-x-cx10"), oldAdded("new-1110"), oldAdded("old-1110")],
          changed: [], removed: [], watched: [], merged: [{ kit_id: "old-cx", merged_into: "beyblade-x-cx10" }],
        }],
      }),
    );
    execFileSync(process.execPath, [fileURLToPath(new URL("./build_update_feed.mjs", import.meta.url)), "--before=before.json"], { cwd: dir, stdio: "pipe" });
    for (const file of ["data/update-feed.json", "data/update-feed-lite.json"]) {
      const out = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const today = out.entries.find((e) => e.date === "2026-11-11");
      assert.deepEqual(today.added.map((i) => i.kit_id), ["fresh"], `${file}: only the id never seen before is new`);
      assert.deepEqual(today.renamed.map((i) => i.kit_id).sort(), ["beyblade-x-bx00-drgs", "relisted"]);
      assert.equal(today.renamed_count, 2);
      assert.equal(today.added_count, 1);
      const old = out.entries.find((e) => e.date === "2026-11-10");
      assert.deepEqual(old.added.map((i) => i.kit_id), ["new-1110"], `${file}: an earlier entry loses its merge target and relisted id`);
      assert.equal(old.added_count, 1);
      assert.deepEqual(old.renamed.map((i) => i.change_type), ["renamed", "renamed"]);
    }
    const ledger = JSON.parse(readFileSync(join(dir, "data/kit-first-seen.json"), "utf8")).dates;
    assert.equal(ledger.fresh, "2026-11-11");
    assert.equal(ledger.relisted, "2026-07-21", "first-seen dates are never rewritten");
    // A rerun on the same date with nothing new keeps the counts (items over the cap live only there)
    const feedPath = join(dir, "data/update-feed.json");
    const first = JSON.parse(readFileSync(feedPath, "utf8"));
    first.entries.find((e) => e.date === "2026-11-11").changed_count = 237;
    writeFileSync(feedPath, JSON.stringify(first));
    execFileSync(process.execPath, [fileURLToPath(new URL("./build_update_feed.mjs", import.meta.url))], { cwd: dir, stdio: "pipe" });
    const rerun = JSON.parse(readFileSync(feedPath, "utf8")).entries.find((e) => e.date === "2026-11-11");
    assert.equal(rerun.changed_count, 237);
    assert.equal(rerun.added_count, 1);
    assert.equal(rerun.renamed_count, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log("update-feed tests OK");
