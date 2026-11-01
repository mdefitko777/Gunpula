// Unit checks for the restock rules (scripts/lib/restocks.mjs, scripts/lib/sale-pages.mjs). No network.
//   node scripts/test_restocks.mjs
import assert from "node:assert/strict";
import {
  buildRestockDoc,
  eventFromSalePage,
  eventsFromAnnouncements,
  eventsFromCatalogShift,
  matchProduct,
  mergeEvents,
  newsMonth,
  newsProductNames,
  pbShipEstimator,
  pbItemId,
  productIndex,
  saleTags,
  shiftMonth,
  tamashiiIds,
} from "./lib/restocks.mjs";
import { monthOf, salePageFromKit, upsertSalePage } from "./lib/sale-pages.mjs";

// ── sale tags: full-width PB names, Tamashii batch suffixes ──
assert.deepEqual(saleTags("ＨＧ 1/144 ガンダムローズ【再販】【３次：２０２７年１月発送】"), { resale: true, lottery: false, batch: 3, ship: "2027-01" });
assert.deepEqual(saleTags("【抽選販売】強化型ZZガンダム【3次：2027年6月発送分】"), { resale: false, lottery: true, batch: 3, ship: "2027-06" });
assert.deepEqual(saleTags("METAL BUILD ストライクフリーダムガンダム（2022年2月発送分）"), { resale: false, lottery: false, batch: null, ship: "2022-02" });
assert.equal(saleTags("ＭＧ 1/100 百式改【再販】").ship, null);
assert.equal(monthOf("２０２６年１２月"), "2026-12");
assert.equal(monthOf("2026-10-24"), "2026-10");
assert.equal(monthOf("2026"), null);
assert.equal(shiftMonth("2026-11", -24), "2024-11");
assert.equal(shiftMonth("2026-01", -1), "2025-12");

// ── ledger records ──
{
  const doc = { pages: {} };
  const page = salePageFromKit({
    kit_id: "pbandai-wb-1000260719",
    names: { ja: "ＭＧ 1/100 フルアーマー・ユニコーンガンダム（レッドカラーＶｅｒ.）" },
    premium_bandai: { listing_name: "ＭＧ 1/100 フルアーマー・ユニコーンガンダム（レッドカラーＶｅｒ.）【再販】【２次：２０２６年１２月発送】", order_opens_at: "2026-10-30" },
    release_date: "2026-12",
    price_jpy: 13200,
    source_refs: [{ source_id: "p_bandai_wayback", url: "https://p-bandai.jp/item/item-1000260719/" }],
  }, { to: "mg-fa-unicorn-red", firstSeen: "2026-11-02" });
  assert.equal(page.name.includes("【再販】"), true, "the listing name (with sale tags) is kept, not the tidied display name");
  assert.equal(page.ship, "2026-12");
  assert.equal(upsertSalePage(doc, "pbandai-wb-1000260719", page), true);
  assert.equal(upsertSalePage(doc, "pbandai-wb-1000260719", page), false, "same page twice: no change");
  assert.equal(upsertSalePage(doc, "pbandai-wb-1000260719", { ...page, first_seen: "2026-12-01", order_closes_at: "2026-11-05" }), true);
  assert.equal(doc.pages["pbandai-wb-1000260719"].first_seen, "2026-11-02", "first_seen keeps the earliest day");
  assert.equal(doc.pages["pbandai-wb-1000260719"].order_closes_at, "2026-11-05", "a later capture adds fields");
}

// ── sale page → event: the product's own first sale is not one ──
{
  const retail = { kit_id: "hg-rose", release_date: "2012-03-24" };
  const lottery = eventFromSalePage("pbandai-wb-1", { name: "【抽選販売】ＨＧ 1/144 ガンダムローズ", ship: "2026-12", url: "https://p-bandai.jp/item/item-1/" }, retail);
  assert.equal(lottery.kind, "lottery");
  assert.equal(lottery.date, "2026-12");
  const resale = eventFromSalePage("pbandai-wb-2", { name: "ＨＧ 1/144 ガンダムローズ【再販】【３次：２０２７年１月発送】", first_seen: "2026-10-30" }, retail);
  assert.equal(resale.kind, "pb_resale");
  assert.equal(resale.date, "2027-01", "shipping month from the listing name");
  const pbItem = { kit_id: "pbandai-wb-100", release_date: "2024-06" };
  assert.equal(eventFromSalePage("pbandai-wb-101", { name: "ＨＧ 1/144 ジム改 高機動型", ship: "2024-06" }, pbItem), null, "same month, no marker: a duplicate page of the first sale");
  assert.equal(eventFromSalePage("pbandai-wb-102", { name: "ＨＧ 1/144 ジム改 高機動型", ship: "2024-07" }, pbItem), null, "one month later without a marker is still the first sale");
  assert.equal(eventFromSalePage("pbandai-wb-103", { name: "ＨＧ 1/144 ジム改 高機動型【２次：２０２４年７月発送】", ship: "2024-07" }, pbItem)?.kind, "pb_resale", "a 2nd batch is a resale");
  assert.equal(eventFromSalePage("pbandai-wb-104", { name: "ＨＧ 1/144 ジム改 高機動型", ship: "2025-03" }, pbItem)?.kind, "pb_resale", "a later shipping month is a resale");
  const tamashii = eventFromSalePage("tamashii-16171", { source: "tamashii_web_jp", name: "強化型ZZガンダム（2027年6月発送分）", ship: "2027-06" }, { kit_id: "tamashii-15000", release_date: "2026-12" });
  assert.equal(tamashii.kind, "tamashii_resale");
  assert.equal(eventFromSalePage("x", { name: "a", ship: "2027-01" }, null), null);
}

// ── announcement parsing helpers ──
assert.deepEqual(newsProductNames("ROBOT魂 ver. A.N.I.M.E.「ガンダム」「シャア専用ザク」「量産型ザク」2027年4月再販決定！"), [
  "ROBOT魂 ver. A.N.I.M.E. ガンダム",
  "ROBOT魂 ver. A.N.I.M.E. シャア専用ザク",
  "ROBOT魂 ver. A.N.I.M.E. 量産型ザク",
]);
assert.deepEqual(newsProductNames("「METAL ROBOT魂 νガンダム」2027年3月より再販決定！"), ["METAL ROBOT魂 νガンダム"]);
assert.equal(newsMonth("「METAL ROBOT魂 νガンダム」2027年3月より再販決定！", "2026-09-01"), "2027-03");
assert.equal(newsMonth("「GGGシリーズ クリスチーナ」10月下旬再販！", "2026-10-20"), "2026-10");
assert.equal(newsMonth("「X」2月より再販！", "2026-11-20"), "2027-02", "a month before the post is next year");
assert.equal(newsMonth("再販決定！", "2026-11-20"), null);
assert.deepEqual(tamashiiIds("https://tamashiiweb.com/item/?twid=16100,16101,16102"), ["16100", "16101", "16102"]);
assert.deepEqual(tamashiiIds("https://tamashiiweb.com/item/16049/"), ["16049"]);
assert.equal(pbItemId("https://p-bandai.jp/item/item-1000260719/"), "1000260719");

// ── product matching: one older product only ──
{
  const kits = [
    { kit_id: "hg-maxter", grade_code: "HG", names: { ja: "HGFC 1/144 ガンダムマックスター" }, release_date: "2012-08" },
    { kit_id: "rg-sf", grade_code: "RG", names: { ja: "RG 1/144 ストライクフリーダムガンダム" }, release_date: "2013-08" },
    { kit_id: "rg-sf-2", grade_code: "RG", names: { ja: "RG 1/144 ZGMF-X20A ストライクフリーダムガンダム" }, release_date: "2013-08" },
    { kit_id: "hg-new", grade_code: "HG", names: { ja: "HG 1/144 ハイドラガンダム" }, release_date: "2026-11" },
  ];
  const index = productIndex(kits);
  assert.equal(matchProduct(index, "ＨＧ 1/144 ガンダムマックスター【再販】【３次：２０２７年１月発送】", { beforeMonth: "2026-10" })?.kit_id, "hg-maxter", "HGFC kit, PB writes plain ＨＧ");
  assert.equal(matchProduct(index, "ＲＧ 1/144 ストライクフリーダムガンダム", { beforeMonth: "2026-10" })?.kit_id, "rg-sf", "two candidates: the one whose full key matches");
  assert.equal(matchProduct(index, "HG 1/144 ハイドラガンダム【再販】", { beforeMonth: "2026-11" }), null, "a product released this month is not resold");
  assert.equal(matchProduct(index, "ガンダムマックスター", { beforeMonth: "2026-10" }), null, "no grade in the name, no match");
}

// ── announcements → events ──
{
  const kits = [
    { kit_id: "hg-maxter", grade_code: "HG", names: { ja: "HGFC 1/144 ガンダムマックスター" }, release_date: "2012-08" },
    { kit_id: "pbandai-wb-9", grade_code: "MG", names: { ja: "ＭＧ 1/100 百式改" }, release_date: "2019-03" },
    { kit_id: "tamashii-15472", grade_code: "METAL_ROBOT", names: { ja: "METAL ROBOT魂 νガンダム" }, release_date: "2025-03" },
    { kit_id: "pbandai-wb-55", grade_code: "HG", names: { ja: "HG 1/144 新作" }, release_date: "2026-12" },
  ];
  const kitsById = new Map(kits.map((kit) => [kit.kit_id, kit]));
  const aliases = { "pbandai-wb-1000260241": "pbandai-wb-9", "tamashii-16049": "tamashii-15472" };
  const records = [
    { source_id: "premium_bandai_new_items", announced_at: "2026-10-30", source_url: "https://p-bandai.jp/item/item-1000260727/", names: { ja: "ＨＧ 1/144 ガンダムマックスター【再販】【３次：２０２７年１月発送】" } },
    { source_id: "premium_bandai_new_items", announced_at: "2026-10-28", source_url: "https://p-bandai.jp/item/item-1000260241/", names: { ja: "ＭＧ 1/100 百式改【再販】" } },
    { source_id: "premium_bandai_new_items", announced_at: "2026-10-28", source_url: "https://p-bandai.jp/item/item-55/", names: { ja: "HG 1/144 新作【２０２６年１２月発送】" } },
    { source_id: "tamashii_topics_items", announced_at: "2026-08-31", source_url: "https://tamashiiweb.com/item/16049/", names: { ja: "【逆襲のシャア】METAL ROBOT魂より「νガンダム」の再販が決定！" } },
    { source_id: "gundam_official_news", announced_at: "2026-10-19", source_url: "https://gundam-official.com/news/x", names: { ja: "「ガンプラ再販会議 2026冬シーズン」投票受付中！" } },
  ];
  const events = eventsFromAnnouncements(records, { kitsById, aliases, index: productIndex(kits), salePages: {} });
  assert.deepEqual(events.map((e) => [e.kit_id, e.kind, e.date, e.source]), [
    ["hg-maxter", "pb_resale", "2027-01", "pb_news"],
    ["pbandai-wb-9", "pb_resale", "2026-10-28", "pb_news"],
    ["tamashii-15472", "tamashii_resale", "2026-08-31", "tamashii_news"],
  ]);
}

// ── catalog shift (conservative) ──
{
  const ref = [{ source_id: "bandai_spirits_products_jp" }];
  const before = [
    { kit_id: "a", release_date: "2015-03-28", source_refs: ref },
    { kit_id: "b", release_date: "2026-08", source_refs: ref },
    { kit_id: "c", release_date: "2015-03", source_refs: [] },
  ];
  const after = [
    { kit_id: "a", release_date: "2026-12-13", source_refs: ref, source_urls: ["u"] },
    { kit_id: "b", release_date: "2027-09", source_refs: ref },
    { kit_id: "c", release_date: "2026-12", source_refs: [] },
  ];
  const events = eventsFromCatalogShift(before, after, "2026-11-02");
  assert.deepEqual(events.map((e) => [e.kit_id, e.kind, e.date]), [["a", "retail_resale", "2026-12-13"]], "old month long past, BANDAI SPIRITS record only");
}

// ── merge + document: one event per kit · month · kind, seen kept, backlog quiet ──
{
  const kitsById = new Map([["k", { kit_id: "k" }], ["j", { kit_id: "j" }]]);
  const events = [
    { kit_id: "k", date: "2027-01", kind: "pb_resale", source: "pb_news", announced_at: "2026-10-30", source_url: "news", page_id: "pbandai-wb-5" },
    { kit_id: "k", date: "2027-01", kind: "pb_resale", source: "sale_page", announced_at: null, source_url: "page", page_id: "pbandai-wb-5", title: "t" },
    { kit_id: "j", date: "2025-01", kind: "lottery", source: "sale_page", source_url: "old" },
    { kit_id: "gone", date: "2027-01", kind: "pb_resale", source: "sale_page" },
    { kit_id: "j", date: "2022-01", kind: "pb_resale", source: "sale_page" },
  ];
  assert.equal(mergeEvents(events).length, 4);
  const first = buildRestockDoc({ events, previous: null, today: "2026-11-02", kitsById, now: new Date("2026-11-02T00:00:00Z") });
  assert.equal(first.baseline, "2026-11-02");
  assert.deepEqual(first.events.map((e) => [e.kit_id, e.date, e.source, e.source_url, e.announced_at, e.quiet === true]), [
    ["k", "2027-01", "sale_page", "page", "2026-10-30", false],
    ["j", "2025-01", "sale_page", "old", null, true],
  ], "kits not in the catalog and events older than 24 months are dropped; recent official news is not backlog");
  assert.deepEqual(first.by_kit, { k: [0], j: [1] });
  assert.equal(first.counts.pb_resale, 1);
  // Next day: a new event is news, the old ones keep their seen day.
  const next = buildRestockDoc({
    events: [...events, { kit_id: "j", date: "2027-02", kind: "pb_resale", source: "sale_page", source_url: "new" }],
    previous: first,
    today: "2026-11-03",
    kitsById,
  });
  const byKey = new Map(next.events.map((e) => [`${e.kit_id}|${e.date}`, e]));
  assert.equal(byKey.get("k|2027-01").seen, "2026-11-02");
  assert.equal(byKey.get("j|2027-02").seen, "2026-11-03");
  assert.equal(byKey.get("j|2027-02").quiet, undefined, "found after the first build: notify");
  assert.equal(next.baseline, "2026-11-02");
}

console.log("restock rules: ok");

// A Tamashii topic that links a new figure next to the resold one only marks the resold one
{
  const kits = [
    { kit_id: "tamashii-15915", grade_code: "ROBOT_SPIRITS", names: { ja: "MSZ-006 Zガンダム ver. A.N.I.M.E." }, release_date: "2026-12" },
    { kit_id: "tamashii-14946", grade_code: "ROBOT_SPIRITS", names: { ja: "RX-178 ガンダムMk-Ⅱ（エゥーゴ仕様） ver. A.N.I.M.E." }, release_date: "2024-10-19" },
  ];
  const events = eventsFromAnnouncements(
    [{ source_id: "tamashii_topics_items", announced_at: "2026-06-30", source_url: "https://tamashiiweb.com/item/?twid=15915,15929", names: { ja: "「MSZ-006 Zガンダム」がROBOT魂 ver. A.N.I.M.E.より登場！ RX-178 ガンダムMk-Ⅱ（エゥーゴ仕様）も再販決定！" } }],
    { kitsById: new Map(kits.map((kit) => [kit.kit_id, kit])), aliases: { "tamashii-15929": "tamashii-14946" }, index: productIndex(kits), salePages: { "tamashii-15929": { ship: "2026-11" } } },
  );
  assert.deepEqual(events.map((e) => [e.kit_id, e.date]), [["tamashii-14946", "2026-11"]], "shipping month from the folded batch page");
}
console.log("restock rules (tamashii topics): ok");

// A PB page that names no shipping month: estimated from the item id (neighbours' months)
{
  const pages = {};
  [["1000100000", "2019-01"], ["1000100010", "2019-02"], ["1000100020", "2019-02"], ["1000100030", "2019-03"], ["1000100040", "2019-03"]].forEach(([id, ship]) => (pages[`pbandai-wb-${id}`] = { ship }));
  const estimate = pbShipEstimator(pages);
  assert.equal(estimate("pbandai-wb-1000100025"), "2019-02");
  assert.equal(pbShipEstimator({ ...pages, "pbandai-wb-1000200000": { ship: "2023-06" }, "pbandai-wb-1000200001": { ship: "2023-07" } })("pbandai-wb-1000150000"), null, "neighbours more than 6 months apart");
  assert.equal(estimate("tamashii-1"), null);
  assert.equal(estimate("pbandai-wb-1000999999"), undefined, "newer than every dated page");
  assert.equal(eventFromSalePage("pbandai-wb-1000000001", { name: "ＭＧ 1/100 古い 【再販】", first_seen: "2026-11-02" }, { kit_id: "mg-old", release_date: "2010-01" }, () => null), null, "no estimate inside the dated range: no made-up date");
  assert.equal(eventFromSalePage("pbandai-wb-1000999999", { name: "ＭＧ 1/100 新しい 【再販】", first_seen: "2026-11-02" }, { kit_id: "mg-new", release_date: "2010-01" }, estimate).date, "2026-11", "a current listing: the day it was first seen");
  const event = eventFromSalePage("pbandai-wb-1000100025", { name: "ＭＧ 1/100 マ・クベ専用グフ 【再販】", first_seen: "2026-11-02" }, { kit_id: "mg-gouf", release_date: "2014-08" }, estimate);
  assert.equal(event.date, "2019-02");
  assert.equal(event.date_estimated, true);
  assert.equal(eventFromSalePage("pbandai-wb-1000100025", { name: "ＭＧ 1/100 X 【再販】" }, { kit_id: "mg-x", release_date: "2019-05" }, estimate), null, "an estimate before the product's own release is no resale");
}
console.log("restock rules (PB month estimate): ok");
