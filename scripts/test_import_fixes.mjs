// Importer fixes of 2026-11-11: escaped image URLs, Hobby Search cards, the Gashapon Senshi f
// 1.5 heading, BEYBLADE X ids and limited flags, aliases for folded records, market health.
import assert from "node:assert/strict";
import { healthSummary, httpError, sourceStatus } from "./fetch_wanted_market_listings.mjs";
import {
  beybladeCanonicalId,
  beybladeDatabasePages,
  beybladeIsLimited,
  beybladeKitId,
  forteSetTitle,
  parseForteEntries,
  uniqueBeybladeIds,
} from "./import_bandai_collectibles.mjs";
import { aliasPublishedFolds, strandedPublishedIds } from "./lib/fold-aliases.mjs";
import { cleanHobbySearchName, hobbySearchListPrice, parseHobbySearch, tidyStoredHobbySearchKits } from "./lib/hobby-search.mjs";
import { HTML_ENTITY_IN_URL, absoluteHtmlUrl, decodeHtmlAttr } from "./lib/html-url.mjs";

// ---------------------------------------------------------------- escaped image URLs
const ANIPLEX = "https://online.aniplex.co.jp";
assert.equal(
  absoluteHtmlUrl("/on/demandware.static/-/x/items/title-H/fgo/saihan_musashi&amp;miniCu/M1.jpg", ANIPLEX),
  "https://online.aniplex.co.jp/on/demandware.static/-/x/items/title-H/fgo/saihan_musashi&miniCu/M1.jpg",
);
assert.equal(
  absoluteHtmlUrl("/items/title-H/fgo/600&times;600_newcoupon20261104.png", ANIPLEX),
  "https://online.aniplex.co.jp/items/title-H/fgo/600%C3%97600_newcoupon20261104.png",
);
assert.equal(absoluteHtmlUrl("//cdn.example.jp/a.jpg?x=1&amp;y=2", ANIPLEX), "https://cdn.example.jp/a.jpg?x=1&y=2");
assert.equal(absoluteHtmlUrl("", ANIPLEX), "");
assert.equal(decodeHtmlAttr("a&#39;b&#x41;&unknown;"), "a'bA&unknown;");
assert.equal(HTML_ENTITY_IN_URL.test("https://x/600&times;600.png"), true);
assert.equal(HTML_ENTITY_IN_URL.test("https://x/a&b/M1.jpg"), false);

// ---------------------------------------------------------------- Hobby Search
assert.equal(cleanHobbySearchName("マシュ・キリエライト (フィギュア)"), "マシュ・キリエライト");
assert.equal(cleanHobbySearchName("★特価品 POP UP PARADE セイバー (フィギュア)"), "POP UP PARADE セイバー");
assert.equal(cleanHobbySearchName("【特価品】PalVerse Fate / Grand Order vol.1 (6個セット) (フィギュア)"), "PalVerse Fate / Grand Order vol.1 (6個セット)");
assert.equal(cleanHobbySearchName("セイバー / アルトリア・ペンドラゴン(第二再臨) (フィギュア)"), "セイバー / アルトリア・ペンドラゴン(第二再臨)");
assert.equal(hobbySearchListPrice("<span>22,770円</span>"), null, "the bare card price is the shop's discount");
assert.equal(hobbySearchListPrice("定価 <s>26,180円</s> 22,253円"), 26180);
assert.equal(hobbySearchListPrice("メーカー希望小売価格：25,300円(税込)"), 25300);

const card = (code, title, price, img = "") =>
  `<div class="c-product-list__item"><div ItemCode="${code}">${img}<div class="c-card__title">${title}</div>` +
  `<div class="c-card__price-element">${price}</div></div></div></div>`;
const hobbyHtml =
  card("11442155", "Fate / Grand Order アヴェンジャー / 謎の蘭丸X (フィギュア)", "定価 26,180円 22,253円", '<img data-src="/itbig11/11442155.jpg" src="/img/dummy.gif">') +
  card("11336822", "★特価品 POP UP PARADE セイバー &amp; マスター (フィギュア)", "5,000円") +
  card("11000001", "Dr. FATE (フィギュア)", "9,000円");
const hobby = parseHobbySearch(hobbyHtml);
assert.equal(hobby.length, 2, "Dr. FATE is DC, not Fate");
assert.equal(hobby[0].name, "Fate / Grand Order アヴェンジャー / 謎の蘭丸X");
assert.equal(hobby[0].source_name, "Fate / Grand Order アヴェンジャー / 謎の蘭丸X (フィギュア)");
assert.equal(hobby[0].price_jpy, 26180);
assert.equal(hobby[0].image, "https://www.1999.co.jp/itbig11/11442155.jpg", "lazy-loaded card picture");
assert.equal(hobby[1].name, "POP UP PARADE セイバー & マスター");
assert.equal(hobby[1].price_jpy, null);

const stored = [
  { kit_id: "hobbysearch-fate-11251490", names: { ja: "マシュ・キリエライト (フィギュア)", en: "マシュ・キリエライト (フィギュア)", zh: "マシュ・キリエライト (フィギュア)", ko: "마슈 키리에라이트 (피규어)" }, price_jpy: 35200 },
  { kit_id: "hobbysearch-fate-11442155", source_name: "謎の蘭丸X (フィギュア)", names: { ja: "謎の蘭丸X", ko: "수수께끼의 란마루 X" }, price_jpy: 26180 },
  { kit_id: "aniplex-fate-item", names: { ja: "X (フィギュア)" }, price_jpy: 1000 },
];
assert.equal(tidyStoredHobbySearchKits(stored), 1);
assert.deepEqual(stored[0].names, { ja: "マシュ・キリエライト", en: "マシュ・キリエライト", zh: "マシュ・キリエライト", ko: "마슈 키리에라이트" });
assert.equal(stored[0].source_name, "マシュ・キリエライト (フィギュア)");
assert.equal(stored[0].price_jpy, null);
assert.equal(stored[1].price_jpy, 26180, "a record written by the new parser keeps its list price");
assert.equal(stored[2].names.ja, "X (フィギュア)", "other sources are left alone");
assert.equal(tidyStoredHobbySearchKits(stored), 0, "idempotent");

// ---------------------------------------------------------------- Gashapon Senshi f 1.5
const heading = (file, alt) => `<h3><img src="../images/items/${file}" width="960" height="231" alt="${alt}"></h3>`;
assert.equal(forteSetTitle(heading("stit_f-01_5.png", "機動戦士ガンダム ガシャポン戦士f 06"), ""), "機動戦士ガンダム ガシャポン戦士f 1.5");
assert.equal(forteSetTitle(heading("stit_f-06.png", "機動戦士ガンダム ガシャポン戦士f 06"), ""), "機動戦士ガンダム ガシャポン戦士f 06");
assert.equal(forteSetTitle(heading("stit_f-02_5.png", "機動戦士ガンダム ガシャポン戦士f 2.5"), ""), "機動戦士ガンダム ガシャポン戦士f 2.5");
assert.equal(forteSetTitle(heading("stit_f-16_pb.png", "機動戦士ガンダム ガシャポン戦士f 16 10個入セット"), ""), "機動戦士ガンダム ガシャポン戦士f 16 10個入セット");
assert.equal(forteSetTitle(heading("stit_f-01.png?ver=02", "機動戦士ガンダム ガシャポン戦士f 01"), ""), "機動戦士ガンダム ガシャポン戦士f 01");
assert.equal(forteSetTitle(heading("stit_ex-006.png", "機動戦士ガンダム ガシャポン戦士f EX006"), ""), "機動戦士ガンダム ガシャポン戦士f EX006");
const forte = parseForteEntries(
  `${heading("stit_f-01_5.png", "機動戦士ガンダム ガシャポン戦士f 06")}` +
    `<a href="https://gashapon.jp/products/detail.html?jan_code=4549660270751000">` +
    `<area class="fancybox-frame" href="../images/items/f01_5_01.jpg" data-fancybox-group="gallery-f01_5" alt="Hi-νガンダム">`,
  "https://gashapon.jp/forte/items/",
);
assert.equal(forte[0].set_title, "機動戦士ガンダム ガシャポン戦士f 1.5");

// ---------------------------------------------------------------- BEYBLADE X
const LINEUP = "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/";
const pages = beybladeDatabasePages({
  products: [
    { product_id: "BXG20", names: { ja: "BX-00 ロックレオーネ6-80GN" }, url: `${LINEUP}bx00-rl.html` },
    { product_id: "BXG54", names: { ja: "UX-00 サムライセイバー5-60K メタルコート:サムライブルー サッカー日本代表Ver." }, url: `${LINEUP}ux00-samurai.html` },
    { product_id: "BXA03", names: { ja: "BX-00 マーベル キャプテン・アメリカ＆レッドハルク マルチパック" }, url: "" },
  ],
});
const card0 = (code, name, href = null) => ({
  code,
  title: `${code} ${name}`,
  detail_url: href ? `${LINEUP}${href}.html` : LINEUP,
  href_slug: href || `${code.toLowerCase()}-87`,
});
assert.equal(beybladeCanonicalId(card0("CX-09", "ソルエクリプスD5-70TK"), pages), "beyblade-x-cx09");
assert.equal(beybladeCanonicalId(card0("BX-44", "トリケラプレスM-85BS"), pages), "beyblade-x-bx44");
assert.equal(beybladeCanonicalId(card0("BX-100", "Future"), pages), "beyblade-x-bx100");
assert.equal(beybladeCanonicalId(card0("BX-28", "ストリングランチャー ホワイトVer.", "bx28"), pages), "beyblade-x-bx28");
assert.equal(beybladeCanonicalId(card0("BX-00", "ロックレオーネ6-80GN"), pages), "beyblade-x-bx00-rl");
assert.equal(beybladeCanonicalId(card0("UX-00", "サムライセイバー5-60K メタルコート:サムライブルー サッカー日本代表Ver."), pages), "beyblade-x-ux00-samurai");
assert.match(beybladeCanonicalId(card0("BX-00", "未知の限定品"), pages), /^beyblade-x-bx00-[0-9a-f]{8}$/);
assert.equal(beybladeCanonicalId(card0("BX-00", "ビットセット", "bx00-bit_silver_white"), pages), "beyblade-x-bx00-bit-silver-white");

const byTitle = new Map([
  ["CX-09ソルエクリプスD5-70TK", "beyblade-x-cx-09-106"],
  ["BX-28ストリングランチャーホワイトVer.", "beyblade-x-bx28"],
  ["BX-00ドランソード3-60Fバージョン2.0", "beyblade-x-bx00-ds-v2"],
  ["CX-10ウルフハントF0-60DB", "beyblade-x-cx-10-110"],
]);
assert.deepEqual(beybladeKitId(card0("CX-09", "ソルエクリプスD5-70TK"), byTitle, pages, new Set()), { id: "beyblade-x-cx09", movedFrom: "beyblade-x-cx-09-106" });
assert.deepEqual(beybladeKitId(card0("BX-28", "ストリングランチャー ホワイトVer.", "bx28"), byTitle, pages), { id: "beyblade-x-bx28" });
assert.deepEqual(
  beybladeKitId(card0("BX-00", "ドランソード3-60F バージョン2.0"), byTitle, pages),
  { id: "beyblade-x-bx00-ds-v2" },
  "a well-formed id is kept even when the card loses its link",
);
assert.deepEqual(
  beybladeKitId(card0("CX-10", "ウルフハントF0-60DB"), byTitle, pages, new Set(["beyblade-x-cx10"])),
  { id: "beyblade-x-cx-10-110" },
  "never moved onto another record",
);
assert.deepEqual(beybladeKitId(card0("CX-16", "新製品"), byTitle, pages), { id: "beyblade-x-cx16" });

// Two cards of one run never share an id.
{
  const twins = [card0("CX-21", "ブレードA"), card0("CX-21", "ブレードB"), card0("CX-21", "ブレードA"), card0("CX-09", "ソルエクリプスD5-70TK")];
  const unique = uniqueBeybladeIds(twins, [
    { id: "beyblade-x-cx21" },
    { id: "beyblade-x-cx21" },
    { id: "beyblade-x-cx21" },
    { id: "beyblade-x-cx21", movedFrom: "beyblade-x-cx-09-106" },
  ]);
  assert.equal(unique[0].id, "beyblade-x-cx21");
  assert.match(unique[1].id, /^beyblade-x-cx21-[0-9a-f]{8}$/, "a second title on the same id gets a hash");
  assert.equal(unique[2].id, "beyblade-x-cx21", "the same title again keeps the id");
  assert.deepEqual(unique[3], { id: "beyblade-x-cx-09-106" }, "a move that would collide is not made");
}

for (const title of ["BX-28 ストリングランチャー ホワイトVer.", "BX-43 ギアケース ホワイトVer.", "BX-57 3on3デッキケース ブラックVer.", "BX-00 ストームペガシス3-70RA"]) {
  assert.equal(beybladeIsLimited("", title), false, title);
}
for (const title of [
  "BX-00 【B4ストア限定】 ドランソード3-60F バージョン2.0",
  "UX-00 サムライセイバー5-60K メタルコート:サムライブルー サッカー日本代表Ver.",
  "CX-00 【アプリ・イベント限定】 ワルキューレボルトS4-70V ガンメタVer.",
]) {
  assert.equal(beybladeIsLimited("", title), true, title);
}

// ---------------------------------------------------------------- aliases for folded records
const aliasDoc = { aliases: { "old-a": "kept" }, excluded: { "gone-x": "wrong_franchise" } };
const added = aliasPublishedFolds(
  aliasDoc,
  [
    { from: "goodsmile-madoka-g10018", to: "goodsmile-madoka-12330" },
    { from: "goodsmile-madoka-new", to: "goodsmile-madoka-12330" },
    { from: "old-a", to: "other" },
    { from: "gone-x", to: "goodsmile-madoka-12330" },
    { from: "goodsmile-madoka-g2419", to: "missing-target" },
  ],
  {
    published: (id) => ["goodsmile-madoka-g10018", "old-a", "gone-x", "goodsmile-madoka-g2419"].includes(id),
    liveIds: new Set(["goodsmile-madoka-12330", "kept", "other"]),
  },
);
assert.deepEqual(added, ["goodsmile-madoka-g10018 → goodsmile-madoka-12330"]);
assert.deepEqual(aliasDoc.aliases, { "old-a": "kept", "goodsmile-madoka-g10018": "goodsmile-madoka-12330" });
assert.deepEqual(
  strandedPublishedIds({ a: "2026-11-06", b: "2026-11-06", c: "2026-11-06", d: "2026-11-06" }, new Set(["a"]), { aliases: { b: "a" }, excluded: { c: "wrong_franchise" } }),
  ["d"],
);

// ---------------------------------------------------------------- market source health
assert.equal(sourceStatus({ attempted: 9, matched: 0, errors: 9 }), "failing");
assert.equal(sourceStatus({ attempted: 9, matched: 0, errors: 4 }), "partial");
assert.equal(sourceStatus({ attempted: 9, matched: 1, errors: 0 }), "ok");
assert.equal(sourceStatus({ attempted: 0, matched: 0, errors: 0, skipped: "disallowed" }), "disallowed");
assert.equal(sourceStatus({ attempted: 2, matched: 0, errors: 1, refused: true }), "refused");
assert.equal(sourceStatus({ attempted: 0, matched: 0, errors: 0 }), "idle");
assert.match(healthSummary({ naver_shop: { attempted: 9, matched: 0, errors: 9, last_error: "Naver API 404 (SE05 a|b)" } }), /\| naver_shop \| failing \| 9 \| 0 \| 9 \| Naver API 404 \(SE05 a\/b\) \|/);
const naver404 = await httpError("Naver API", new Response(JSON.stringify({ errorMessage: "Invalid search api", errorCode: "SE05" }), { status: 404 }));
assert.equal(naver404.message, "Naver API 404 (SE05 Invalid search api)");
assert.equal(naver404.refused, false);
const busy = await httpError("Amazon", new Response("<html><title>Service Unavailable</title></html>", { status: 503 }));
assert.equal(busy.message, "Amazon 503 (Service Unavailable)");
assert.equal(busy.refused, true);

console.log("import fixes ok");
