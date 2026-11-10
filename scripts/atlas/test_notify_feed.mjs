// Self-test for scripts/atlas/build_notify_feed.mjs (no network, no git):
//   node scripts/atlas/test_notify_feed.mjs
import assert from "node:assert/strict";
import {
  QUIET_REASONS,
  annotateItems,
  buildDoc,
  changeReasons,
  compactItem,
  diffCatalogs,
  isBackfill,
  itemNames,
  itemSeriesLabels,
  itemFromFeed,
  mergeItem,
  notifiable,
  sameContent,
  sourceReason,
  windowStart,
} from "./build_notify_feed.mjs";
import { isRenamed } from "../lib/feed-renames.mjs";

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
// a date seen for the first time (backfilled from the product page) is not news
assert.deepEqual(changeReasons(kit("a", { release_date: null }), kit("a")), ["release_found"]);
assert.equal(notifiable("changed", ["release_found"]), false);
assert.equal(notifiable("changed", ["image", "name"]), false);
assert.equal(notifiable("changed", ["image", "price"]), true);
assert.equal(notifiable("added", ["new"]), true);
// an archive.org copy of a PB page (p_bandai_wayback) coming or going is "archive", which is quiet
{
  const shop = { source_id: "bandai_hobby", url: "https://bandai-hobby.net/item/a/" };
  const wayback = { source_id: "p_bandai_wayback", url: "https://p-bandai.jp/item/item-1000142431/", fields: ["names"], confidence: "medium" };
  const base = kit("a", { source_refs: [shop] });
  assert.deepEqual(changeReasons(base, kit("a", { source_refs: [shop, wayback] })), ["archive"]);
  assert.deepEqual(changeReasons(kit("a", { source_refs: [shop, wayback] }), base), ["archive"]);
  assert.equal(sourceReason(base, kit("a", { source_refs: [shop] })), null);
  assert.equal(notifiable("changed", ["archive"]), false);
  assert.equal(QUIET_REASONS.has("archive"), true);
  // real source changes stay "source"
  assert.deepEqual(changeReasons(base, kit("a", { source_refs: [shop, wayback, { source_id: "p_bandai_jp", url: "https://p-bandai.jp/item/item-1/" }] })), ["source"]);
  assert.deepEqual(changeReasons(base, kit("a", { source_refs: [shop, wayback], source_urls: ["https://p-bandai.jp/item/item-1/"] })), ["source"]);
  assert.deepEqual(changeReasons(base, kit("a", { source_refs: [shop, wayback], tags: ["limited"] })), ["source"]);
  // archive + a real change: still notifiable through the real one
  assert.deepEqual(changeReasons(base, kit("a", { source_refs: [shop, wayback], is_limited: true })), ["limited", "archive"]);
  assert.equal(notifiable("changed", ["limited", "archive"]), true);
  const d = diffCatalogs({ kits: [base] }, { kits: [kit("a", { source_refs: [shop, wayback] })] });
  assert.equal(d.changed, 1);
  assert.equal(d.items.length, 0, "an archive-only change is not a phone notification");
}

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
    names: { ko: "ko-price", ja: "ja-price" },
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
    names: { ko: "드란소드", zh: "x", ja: "ドランソード", en: "Dran Sword" },
    price_jpy: 1980,
    is_limited: true,
    change_reasons: ["limited", "image"],
  });
  assert.deepEqual(compactItem({ kit_id: "n", change_type: "added", names: { ja: "名前" } }).names, { ko: "名前", ja: "名前" }, "Korean first, then Japanese");
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

// Restocks: data/atlas/restocks.json events → "changed" items with reason "restock" (never "added",
// not counted in added_count / changed_count, not dropped by the backfill rule)
{
  const old = kit("hg-rose", { release_date: "2012-03-24", source_urls: ["https://p-bandai.jp/item/item-1000260724/"] });
  const kitsById = new Map([[old.kit_id, old], ["mg-x", kit("mg-x", { release_date: "2015-01" })], ["quiet", kit("quiet")]]);
  const restocks = {
    schema: 1,
    events: [
      { kit_id: "hg-rose", date: "2027-01", kind: "pb_resale", source_url: "https://p-bandai.jp/item/item-1000260724/", announced_at: "2026-10-30", seen: "2026-11-02", source: "sale_page" },
      { kit_id: "hg-rose", date: "2026-12", kind: "lottery", source_url: "https://p-bandai.jp/item/item-1/", announced_at: null, seen: "2026-11-02", source: "sale_page" },
      { kit_id: "mg-x", date: "2026-12-13", kind: "retail_resale", source_url: "https://gundam-official.com/news/a", announced_at: "2026-10-24", seen: "2026-10-24", source: "official_news" },
      { kit_id: "quiet", date: "2025-01", kind: "pb_resale", seen: "2026-11-02", source: "sale_page", quiet: true },
      { kit_id: "gone", date: "2027-01", kind: "pb_resale", seen: "2026-11-02", source: "sale_page" },
      { kit_id: "mg-x", date: "2026-01", kind: "pb_resale", seen: "2026-09-01", source: "sale_page" },
    ],
  };
  const feed = {
    updated_at: "2026-11-02",
    entries: [
      { date: "2026-11-02", total_after: 10, added_count: 0, changed_count: 0, added: [], changed: [] },
      { date: "2026-10-23", total_after: 9, added_count: 1, changed_count: 0, added: [{ kit_id: "n1", change_type: "added", franchise: "gundam", names: { ko: "n1" }, change_reasons: ["new"] }], changed: [] },
    ],
  };
  const manifest = { updated_at: "2026-11-02", total: 10 };
  const doc = buildDoc({ feed, manifest, prev: null, pairs: [], commits: [], days: 2, since: "2026-10-23", gitOk: false, restocks, kitsById });
  const [top, older] = doc.entries;
  assert.deepEqual(top.added, [], "a restock is never an added item");
  assert.equal(top.added_count, 0);
  assert.equal(top.changed_count, 0, "restocks are not counted as catalog changes");
  assert.equal(top.restock_count, 2);
  const rose = top.changed.find((i) => i.kit_id === "hg-rose");
  assert.deepEqual(rose, {
    kit_id: "hg-rose",
    change_type: "changed",
    franchise: "gundam",
    series_key: "uc",
    names: { ko: "ko-hg-rose", ja: "ja-hg-rose" },
    series_labels: { ko: "UC" },
    release_date: "2012-03-24",
    price_jpy: 2200,
    is_premium_bandai: true,
    change_reasons: ["restock"],
    restock: { date: "2027-01", kind: "pb_resale", url: "https://p-bandai.jp/item/item-1000260724/", announced_at: "2026-10-30" },
  }, "one item per kit and date: the latest restock; a 2012 kit is not a backfill here");
  assert.equal(notifiable(rose.change_type, rose.change_reasons), true, "the app's rule: restock is not a quiet reason");
  // seen 2026-10-24 → first feed date on or after it (2026-11-02); seen before the window → dropped
  assert.deepEqual(top.changed.map((i) => i.kit_id).sort(), ["hg-rose", "mg-x"]);
  assert.equal(top.changed.find((i) => i.kit_id === "mg-x").restock.kind, "retail_resale");
  assert.equal(older.restock_count, undefined);
  assert.deepEqual(older.changed, []);
  // A price change of the same kit on the same date merges into one item with both reasons
  const withPrice = buildDoc({
    feed: { ...feed, entries: [{ ...feed.entries[0], changed_count: 1, changed: [{ kit_id: "hg-rose", change_type: "changed", franchise: "gundam", names: { ko: "x" }, price_jpy: 2420, change_reasons: ["price"] }] }, feed.entries[1]] },
    manifest, prev: null, pairs: [], commits: [], days: 2, since: "2026-10-23", gitOk: false, restocks, kitsById,
  });
  const merged = withPrice.entries[0].changed.find((i) => i.kit_id === "hg-rose");
  assert.deepEqual(merged.change_reasons, ["price", "restock"]);
  assert.equal(merged.restock.date, "2027-01");
  // No restocks file → unchanged behaviour
  const none = buildDoc({ feed, manifest, prev: null, pairs: [], commits: [], days: 2, since: "2026-10-23", gitOk: false });
  assert.deepEqual(none.entries[0].changed, []);
  assert.equal(none.entries[0].restock_count, undefined);
}
console.log("notify feed restocks: ok");

// Maintenance commits (data/atlas/notify-quiet.json) and dates newer than the catalog are not news
{
  const manifest = { updated_at: "2026-11-01", total: 2 };
  const item = (id) => ({ kit_id: id, change_type: "added", franchise: "gundam", names: { ko: id }, change_reasons: ["new"] });
  const doc = buildDoc({
    feed: { entries: [{ date: "2026-11-02", added: [item("local-run")], changed: [], added_count: 1, changed_count: 0 }] },
    manifest,
    prev: null,
    pairs: [
      { date: "2026-11-01", at: "2026-11-01T10:00:00Z", sha: "aaaa1111", items: [item("maintenance")], added: 1, changed: 0, total: 2 },
      { date: "2026-11-01", at: "2026-11-01T11:00:00Z", sha: "bbbb2222", items: [item("real-news")], added: 1, changed: 0, total: 2 },
    ],
    commits: [{ sha: "aaaa1111", date: "2026-11-01" }, { sha: "bbbb2222", date: "2026-11-01" }],
    quiet: { commits: ["aaaa1111"], feed_dates: [] },
  });
  assert.equal(doc.entries[0].date, "2026-11-01", "no entry newer than the catalog");
  assert.deepEqual(doc.entries[0].added.map((i) => i.kit_id), ["real-news"]);
}
console.log("notify feed quiet maintenance: ok");

// date_quiet_reasons: source-only churn on a maintenance date is dropped, real changes stay
{
  const manifest = { updated_at: "2026-11-02", total: 3 };
  const it = (id, reasons, type = "changed") => ({ kit_id: id, change_type: type, franchise: "gundam", names: { ko: id }, change_reasons: reasons });
  const doc = buildDoc({
    feed: null,
    manifest,
    prev: null,
    pairs: [{ date: "2026-11-02", at: "2026-11-02T01:00:00Z", sha: "cccc3333", items: [it("churn", ["source", "product_line"]), it("price", ["source", "price"]), it("new", ["new"], "added")], added: 1, changed: 2, total: 3 }],
    commits: [{ sha: "cccc3333", date: "2026-11-02" }],
    quiet: { date_quiet_reasons: { "2026-11-02": ["source", "product_line"] } },
  });
  const ids = [...doc.entries[0].added, ...doc.entries[0].changed].map((i) => i.kit_id).sort();
  assert.deepEqual(ids, ["new", "price"]);
}
console.log("notify feed date_quiet_reasons: ok");

// annotateItems: line and atlas groups for the app's own notification conditions
{
  const doc = { entries: [{ added: [{ kit_id: "m1" }], changed: [{ kit_id: "g1" }] }] };
  annotateItems(doc, [{ kit_id: "m1", grade_code: "NENDOROID", subline: "ねんどろいどぷち", names: { ja: "ねんどろいどぷち 暁美ほむら" } }, { kit_id: "g1", grade_code: "HG" }], {
    franchises: { madoka: [{ id: "homura", kit_ids: ["m1"] }] },
  });
  assert.equal(doc.entries[0].added[0].grade_code, "NENDOROID");
  assert.deepEqual(doc.entries[0].added[0].groups, ["homura"]);
  assert.equal(doc.entries[0].changed[0].grade_code, "HG");
  assert.equal(doc.entries[0].changed[0].groups, undefined);
  assert.equal(doc.entries[0].added[0].subline, "ねんどろいどぷち");
  assert.equal(doc.entries[0].added[0].name_ja, "ねんどろいどぷち 暁美ほむら");
  assert.equal(doc.entries[0].changed[0].subline, undefined);
  console.log("notify feed annotate: ok");
}

// annotateItems: the push title (names.ko) follows the catalog's current Korean name
{
  const doc = {
    entries: [
      {
        added: [{ kit_id: "pb1", series_key: "seed", names: { ko: "ガンプラＬＥＤユニット２個세트（緑）" }, series_labels: { ko: "旧" } }],
        changed: [
          { kit_id: "gone", series_key: "seed", names: { ko: "kept" }, series_labels: { ko: "건담 SEED" } },
          { kit_id: "noname", series_key: "seed", names: { ko: "kept too" } },
        ],
      },
    ],
  };
  annotateItems(
    doc,
    [
      { kit_id: "pb1", names: { ja: "ガンプラＬＥＤユニット２個セット（緑）", ko: "건프라 LED 유닛 2개 세트 (초록)" }, series: { key: "tools", labels: { ko: "건프라 툴" } } },
      { kit_id: "noname", names: {} },
    ],
    null,
  );
  assert.deepEqual(doc.entries[0].added[0].names, { ko: "건프라 LED 유닛 2개 세트 (초록)", ja: "ガンプラＬＥＤユニット２個セット（緑）" });
  assert.deepEqual(doc.entries[0].added[0].series_labels, { ko: "건프라 툴" });
  assert.equal(doc.entries[0].added[0].series_key, "tools", "the series key moves with its label (app series: conditions, SEED / 00)");
  assert.deepEqual(doc.entries[0].changed[0].names, { ko: "kept" }, "a kit no longer in the catalog keeps its stored name");
  assert.equal(doc.entries[0].changed[0].series_key, "seed");
  assert.deepEqual(doc.entries[0].changed[0].series_labels, { ko: "건담 SEED" });
  assert.deepEqual(doc.entries[0].changed[1].names, { ko: "kept too" }, "a catalog kit without names keeps the stored one");
  assert.equal(doc.entries[0].changed[1].series_key, "seed", "a catalog kit without a series keeps the stored one");
  console.log("notify feed name refresh: ok");
}

// Chinese UI: items carry names ko · zh · ja · en and series_labels ko · zh from the current catalog
{
  const zhKit = kit("z1", { names: { ja: "ドランソード", ko: "드란소드", zh: "龙剑", en: "Dran Sword", fr: "x" }, series: { key: "bx", labels: { ko: "BX", zh: "BX 系列", ja: "BX", en: "BX" } } });
  const d = diffCatalogs({ kits: [] }, { updated_at: "2026-11-11", kits: [zhKit] });
  assert.deepEqual(d.items[0].names, { ko: "드란소드", zh: "龙剑", ja: "ドランソード", en: "Dran Sword" }, "only the four languages the app reads");
  assert.deepEqual(d.items[0].series_labels, { ko: "BX", zh: "BX 系列" });
  const doc = { entries: [{ added: [{ kit_id: "z1", names: { ko: "옛 이름" }, series_labels: { ko: "옛" } }], changed: [] }] };
  annotateItems(doc, [zhKit], null);
  assert.deepEqual(doc.entries[0].added[0].names, { ko: "드란소드", zh: "龙剑", ja: "ドランソード", en: "Dran Sword" }, "cached items get zh too");
  assert.deepEqual(doc.entries[0].added[0].series_labels, { ko: "BX", zh: "BX 系列" });
  assert.deepEqual(itemSeriesLabels({ ko: "UC" }), { ko: "UC" });
  assert.equal(itemSeriesLabels(null), null);
  assert.deepEqual(itemNames(null, "id-only"), { ko: "id-only" });
  assert.deepEqual(itemNames({ ja: "BX-01", en: "BX-01", ko: "BX-01 드란소드" }), { ko: "BX-01 드란소드", ja: "BX-01" }, "en equal to ja is left out (the app reads ja first)");
  console.log("notify feed zh names: ok");
}

// Renames: 2026-11-10 beyblade-x-bx-00-116 -> beyblade-x-bx00-drgs (first seen 2026-07-08) was pushed as a new item
{
  const aliases = { "beyblade-x-bx-00-116": "beyblade-x-bx00-drgs", "old-fold": "fold-target" };
  const firstSeen = { "beyblade-x-bx00-drgs": "2026-07-08", relisted: "2026-07-21", fresh: "2026-11-10", "fold-target": "2026-11-10" };
  const before = { kits: [kit("beyblade-x-bx-00-116"), kit("old-fold"), kit("stay")] };
  const after = { updated_at: "2026-11-10", kits: [kit("beyblade-x-bx00-drgs"), kit("fold-target"), kit("relisted"), kit("fresh"), kit("stay"), kit("unseen")] };
  const d = diffCatalogs(before, after, "2026-11-10", { aliases, firstSeen });
  assert.deepEqual(d.items.map((i) => i.kit_id).sort(), ["fresh", "unseen"], "renamed, merge-target and relisted ids are not news");
  assert.equal(d.added, 2);
  assert.equal(d.renamed, 3);
  assert.deepEqual(d.targets.sort(), ["beyblade-x-bx00-drgs", "fold-target"]);
  assert.equal(isRenamed("fresh", "2026-11-10", { firstSeen }), false, "first seen on the entry date = new");
  assert.equal(isRenamed("unseen", "2026-11-10", { firstSeen }), false, "not in the ledger yet = new");

  // update-feed.json and the previous output written before the rule still list them as added
  const added = (id) => ({ kit_id: id, change_type: "added", franchise: "beyblade", names: { ko: id }, change_reasons: ["new"] });
  const feed = {
    entries: [{
      date: "2026-11-10", added_count: 4, changed_count: 0,
      added: [added("beyblade-x-bx00-drgs"), added("fold-target"), added("fresh"), added("relisted")], changed: [],
      merged: [{ kit_id: "old-fold", merged_into: "fold-target" }],
    }],
  };
  const prev = { schema: 1, entries: [{ date: "2026-11-10", added_count: 4, changed_count: 0, complete: true, added: feed.entries[0].added, changed: [] }] };
  const doc = buildDoc({ feed, manifest: { updated_at: "2026-11-10", total: 6 }, prev, pairs: [], commits: [], days: 1, gitOk: false, firstSeen: { ...firstSeen, "fold-target": "2026-11-10" } });
  assert.deepEqual(doc.entries[0].added.map((i) => i.kit_id), ["fresh"], "cached renames are dropped too");
  assert.equal(doc.entries[0].added_count, 1, "the count follows");
  // a same-day price change of a renamed kit is still news: the cached "added" copy must not swallow it
  const changedToo = buildDoc({
    feed: { entries: [{ ...feed.entries[0], changed_count: 1, changed: [{ ...added("beyblade-x-bx00-drgs"), change_type: "changed", change_reasons: ["price"] }] }] },
    manifest: { updated_at: "2026-11-10", total: 6 }, prev: null, pairs: [], commits: [], days: 1, gitOk: false, firstSeen,
  });
  assert.deepEqual(changedToo.entries[0].changed.map((i) => [i.kit_id, i.change_reasons]), [["beyblade-x-bx00-drgs", ["price"]]]);
  assert.equal(changedToo.entries[0].added_count, 1, "the update-feed count loses only its own renames");
}
console.log("notify feed renames: ok");
