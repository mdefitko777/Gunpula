// Self-test for scripts/atlas/build_notify_feed.mjs (no network, no git):
//   node scripts/atlas/test_notify_feed.mjs
import assert from "node:assert/strict";
import { buildDoc, changeReasons, compactItem, diffCatalogs, isBackfill, itemFromFeed, mergeItem, notifiable, sameContent, windowStart } from "./build_notify_feed.mjs";

const kit = (id, extra = {}) => ({
  kit_id: id,
  franchise: "gundam",
  grade_code: "HG",
  names: { ja: `ja-${id}`, ko: `ko-${id}` },
  series: { key: "uc", labels: { ko: "UC" } },
  release_date: "2026-11",
  price_jpy: 2200,
  is_limited: false,
  images: [`https://example.invalid/${id}.jpg`],
  source_urls: [`https://bandai-hobby.net/item/${id}/`],
  ...extra,
});

// ── reasons: same rule as scripts/build_update_feed.mjs ──
assert.deepEqual(changeReasons(null, kit("a")), ["new"]);
assert.deepEqual(changeReasons(kit("a"), kit("a", { price_jpy: 2420 })), ["price"]);
assert.deepEqual(changeReasons(kit("a"), kit("a", { images: ["x"] })), ["image"]);
assert.deepEqual(changeReasons(kit("a"), kit("a", { release_date: "2026-12", is_limited: true })), ["release", "limited"]);
assert.equal(notifiable("changed", ["image", "name"]), false);
assert.equal(notifiable("changed", ["image", "price"]), true);
assert.equal(notifiable("added", ["new"]), true);

// ── diff: no cap, image-only changes dropped, counts are full ──
{
  const before = { kits: [kit("keep"), kit("img"), kit("price"), ...Array.from({ length: 150 }, (_, i) => kit(`old${i}`))] };
  const after = {
    kits: [
      kit("keep"),
      kit("img", { images: ["new.jpg"] }),
      kit("price", { price_jpy: 2640 }),
      ...Array.from({ length: 150 }, (_, i) => kit(`old${i}`)),
      ...Array.from({ length: 200 }, (_, i) => kit(`new${i}`, { franchise: "pokemon", series: null })),
      kit("pb", { source_urls: ["https://p-bandai.jp/item/item-1000/"] }),
      kit("seed", { series: { key: "seed", labels: { ko: "SEED" } } }),
    ],
  };
  const d = diffCatalogs(before, after);
  assert.equal(d.added, 202, "every new item counted (update-feed keeps 120, lite 20)");
  assert.equal(d.changed, 2);
  assert.equal(d.items.length, 203, "202 new + 1 price change; the image-only change is not notifiable");
  const byId = new Map(d.items.map((i) => [i.kit_id, i]));
  assert.equal(byId.has("img"), false);
  assert.deepEqual(byId.get("price"), {
    kit_id: "price",
    change_type: "changed",
    franchise: "gundam",
    series_key: "uc",
    names: { ko: "ko-price" },
    series_labels: { ko: "UC" },
    release_date: "2026-11",
    price_jpy: 2640,
    change_reasons: ["price"],
  });
  assert.equal(byId.get("pb").is_premium_bandai, true, "PB from the p-bandai.jp source URL");
  assert.deepEqual(byId.get("seed").watch_tags, ["seed"]);
  assert.equal(byId.get("new0").series_key, undefined, "empty fields are left out");
  assert.equal(byId.get("new0").is_limited, undefined);
}

// ── trimmed item keeps only the keys the app reads ──
{
  const fromFeed = itemFromFeed({
    kit_id: "f1",
    change_type: "changed",
    franchise: "beyblade",
    grade_code: "BX",
    subline: null,
    series_key: null,
    series_labels: null,
    names: { ja: "ドランソード", zh: "x", ko: "드란소드", en: "Dran Sword" },
    release_date: null,
    price_jpy: 1980,
    is_limited: true,
    is_premium_bandai: false,
    watch_tags: [],
    interest_tags: ["beyblade", "bbx"],
    change_reasons: ["limited", "image"],
    source_ids: ["takaratomy"],
    source_urls: ["https://beyblade.takaratomy.co.jp/x"],
  });
  assert.deepEqual(fromFeed, {
    kit_id: "f1",
    change_type: "changed",
    franchise: "beyblade",
    names: { ko: "드란소드" },
    price_jpy: 1980,
    is_limited: true,
    change_reasons: ["limited", "image"],
  });
  assert.deepEqual(compactItem({ kit_id: "n", change_type: "added", names: { ja: "名前" } }).names, { ko: "名前" }, "Korean first, then Japanese");
}

// ── one kit per date: added wins, reasons merge, later fields win ──
{
  const m = new Map();
  mergeItem(m, { kit_id: "k", change_type: "changed", change_reasons: ["price"], price_jpy: 1 });
  mergeItem(m, { kit_id: "k", change_type: "changed", change_reasons: ["release"], price_jpy: 2 });
  assert.deepEqual(m.get("k").change_reasons, ["price", "release"]);
  assert.equal(m.get("k").price_jpy, 2);
  mergeItem(m, { kit_id: "k", change_type: "added", change_reasons: ["new"] });
  assert.equal(m.get("k").change_type, "added");
  assert.deepEqual(m.get("k").change_reasons, ["new"]);
}

// ── document: feed (capped) + git diffs (full) + previous output, window, complete flags ──
{
  const feedItem = (id, type, reasons) => ({ kit_id: id, change_type: type, franchise: "gundam", names: { ko: id }, change_reasons: reasons });
  const feed = {
    updated_at: "2026-11-01",
    entries: [
      { date: "2026-11-01", generated_at: "2026-11-01T04:34:54.746Z", total_after: 9165, added_count: 3, changed_count: 1, added: [feedItem("a1", "added", ["new"])], changed: [feedItem("img", "changed", ["image"])] },
      { date: "2026-10-23", generated_at: "2026-10-22T22:09:31.413Z", total_after: 8853, added_count: 1, changed_count: 0, added: [feedItem("b1", "added", ["new"])], changed: [] },
      { date: "2026-09-01", total_after: 8000, added_count: 0, changed_count: 0, added: [], changed: [] },
    ],
  };
  const manifest = { updated_at: "2026-11-01", total: 9165 };
  const pairs = [
    {
      date: "2026-11-01",
      at: "2026-11-01T04:35:02+00:00",
      sha: "c1",
      total: 9165,
      added: 3,
      changed: 1,
      items: [
        { kit_id: "a1", change_type: "added", franchise: "gundam", names: { ko: "a1" }, change_reasons: ["new"] },
        { kit_id: "a2", change_type: "added", franchise: "gundam", names: { ko: "a2" }, change_reasons: ["new"], is_premium_bandai: true },
        { kit_id: "a3", change_type: "added", franchise: "pokemon", names: { ko: "a3" }, change_reasons: ["new"] },
      ],
    },
  ];
  const prev = {
    schema: 1,
    entries: [{ date: "2026-10-23", generated_at: "2026-10-22T22:09:31.413Z", total_after: 8853, added_count: 1, changed_count: 0, complete: true, added: [{ kit_id: "b1", change_type: "added", franchise: "gundam", names: { ko: "b1" }, change_reasons: ["new"] }], changed: [] }],
  };
  const since = windowStart(["2026-11-01", "2026-10-23", "2026-09-01"], 2);
  assert.equal(since, "2026-10-23");
  const doc = buildDoc({ feed, manifest, prev, pairs, commits: [{ sha: "c1", date: "2026-11-01" }, { sha: "c0", date: "2026-10-23" }], days: 2, since, now: new Date("2026-11-01T05:00:00Z") });
  assert.equal(doc.schema, 1);
  assert.equal(doc.updated_at, "2026-11-01");
  assert.equal(doc.total, 9165);
  assert.ok(Array.isArray(doc.sources) && doc.sources[0].licence, "sources carry attribution / licence");
  assert.deepEqual(doc.entries.map((e) => e.date), ["2026-11-01", "2026-10-23"], "window = on or after since");
  const top = doc.entries[0];
  assert.deepEqual(top.added.map((i) => i.kit_id), ["a1", "a2", "a3"], "git diff fills what the feed cut off");
  assert.deepEqual(top.changed, [], "image-only feed change dropped");
  assert.equal(top.total_after, 9165, "newest entry total = manifest total (the app's freshness check)");
  assert.equal(top.complete, true, "git diffed every commit of the date");
  assert.equal(top.added_count, 3);
  assert.deepEqual(doc.entries[1].added.map((i) => i.kit_id), ["b1"], "previous output kept");
  assert.deepEqual(doc.commits, [["c1", "2026-11-01"], ["c0", "2026-10-23"]]);

  // Without git: feed only, and a capped date is marked incomplete
  const noGit = buildDoc({ feed, manifest, prev: null, pairs: [], commits: [], days: 2, since, gitOk: false });
  assert.deepEqual(noGit.entries[0].added.map((i) => i.kit_id), ["a1"]);
  assert.equal(noGit.entries[0].complete, false, "feed listed 1 of 3 new items");
  assert.equal(noGit.entries[1].complete, true);

  // The oldest kits.json commit in the window could not be diffed → its date is not complete from git
  const edge = buildDoc({ feed, manifest, prev: null, pairs, commits: [{ sha: "c1", date: "2026-11-01" }], edgeDates: new Set(["2026-11-01"]), days: 2, since });
  assert.equal(edge.entries[0].complete, false);

  // Same content → byte-identical apart from generated_at
  const again = buildDoc({ feed, manifest, prev, pairs, commits: [{ sha: "c1", date: "2026-11-01" }, { sha: "c0", date: "2026-10-23" }], days: 2, since, now: new Date("2026-11-02T00:00:00Z") });
  assert.equal(sameContent(doc, again), true);
  assert.equal(sameContent(doc, noGit), false);
}

console.log("build_notify_feed self-test passed");

// Backfill: old records filled in by a coverage fix are not news
{
  const before = { kits: [] };
  const after = { updated_at: "2026-11-02", kits: [
    { kit_id: "old-hg", franchise: "gundam", names: { ja: "HG 旧" }, release_date: "2014-04" },
    { kit_id: "new-hg", franchise: "gundam", names: { ja: "HG 新" }, release_date: "2026-12" },
  ] };
  const d = diffCatalogs(before, after);
  assert.equal(d.added, 1);
  assert.equal(d.backfilled, 1);
  assert.deepEqual(d.items.map((i) => i.kit_id), ["new-hg"]);
  assert.equal(isBackfill({ release_date: "2025-12" }, "2026-11-02"), false);
  assert.equal(isBackfill({ release_date: "2025-10" }, "2026-11-02"), true);
  assert.equal(isBackfill({}, "2026-11-02"), false);
}
console.log("notify feed backfill: ok");
