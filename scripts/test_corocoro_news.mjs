// CoroCoro News scoops → one announcement per product. Fixtures are real posts
// read from the WordPress REST API on 2026-11-12 (images and long disclaimers
// cut), plus a made-up issue preview with a retail starter and a booster bey.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptsStoredAnnouncement } from "./lib/bandai-announcements.mjs";
import {
  COROCORO_SOURCE_ID,
  articleLines,
  canonicalBeyName,
  coroCoroRecords,
  dropMagazineDuplicates,
  extractCoroCoroProducts,
  findPrice,
  findRelease,
  runCoroCoroSource,
} from "./lib/corocoro-news.mjs";

const posts = JSON.parse(readFileSync(new URL("./fixtures/corocoro-news-posts.json", import.meta.url), "utf8"));
const post = (id) => posts.find((item) => item.id === id);
const extract = (item) => extractCoroCoroProducts({ title: item.title.rendered, content: item.content.rendered, date: item.date });

// 402790: the mail-order bey. The 商品概要 box (10月15日 / 770円) is the issue,
// not the bey; the bey's price is the 2600円 in the disclaimer.
const kid = extract(post(402790));
assert.equal(kid.length, 1);
assert.equal(kid[0].name, "キッドハントK4-70TK メタルコート:ホワイト");
assert.equal(kid[0].franchise, "beyblade");
assert.equal(kid[0].kind, "応募者全員有料サービス");
assert.equal(kid[0].price, 2600);
assert.equal(kid[0].release, null, "the issue's release date is not the bey's");
assert.ok(!articleLines(post(402790).content.rendered).some((line) => /770円/.test(line)), "the issue's box is cut");

// 401960: the headline shortens the name; the body's full edition name wins.
const clock = extract(post(401960));
assert.deepEqual(clock.map((item) => item.name), ["クロックミラージュ4-55S メタルコート:ブラック 運命の巻戻士ver."]);
assert.equal(clock[0].kind, "応募者全員有料サービス");
assert.equal(clock[0].price, 2600);

// 402047: a notice naming the bey only in its (unquoted) title.
const notice = extract(post(402047));
assert.deepEqual(notice.map((item) => item.key), [clock[0].key], "same product as the scoop, by key");

// 402892: an issue preview with manga, cards and a BEYBLADE newspaper — no bey.
assert.deepEqual(extract(post(402892)), []);

// Made-up preview: a retail starter whose ratchet and bit are not public yet,
// a random-booster bey, an old bey mentioned in passing, and things that are
// not products (a sticker in 「」, a manga in 『』, the issue's own date and price).
const synthetic = extractCoroCoroProducts({
  title: "【月コロ1月号特報】『BEYBLADE X』最新ベイ情報を大紹介!!",
  date: "2026-11-13T11:00:00",
  content: `
    <p>『月刊コロコロコミック 1月号』は、本日11月13日（金）発売!!</p>
    <p>UX-22 スターター「バニッシュルシファー WW」が12月26日（土）ごろ発売予定！ 価格は2500円（税込）だ!!</p>
    <p>さらに、ランダムブースターVol.12にはホルスシャッター3-85MOが収録！ こちらも12月26日発売予定!!</p>
    <p>まんが『ベイトレーナー キバ』ではドランソード3-60Fが大活躍！ ふろく「ベイ必勝ステッカー」もついてくるぞ!!</p>
    <h6>商品概要</h6>
    <p><strong>『月刊コロコロコミック 1月号』</strong><br />■発売日：11月13日（金）ごろ<br />■価格：770円（税込）</p>`,
});
const byName = new Map(synthetic.map((item) => [item.name, item]));
assert.deepEqual([...byName.keys()].sort(), ["ドランソード3-60F", "バニッシュルシファー WW", "ホルスシャッター3-85MO"].sort());
assert.deepEqual(
  { code: byName.get("バニッシュルシファー WW").code, kind: byName.get("バニッシュルシファー WW").kind },
  { code: "UX-22", kind: "スターター" },
);
assert.deepEqual(byName.get("バニッシュルシファー WW").release, { iso: "2026-12-26", text: "2026年12月26日ごろ" });
assert.equal(byName.get("バニッシュルシファー WW").price, 2500);
assert.equal(byName.get("ホルスシャッター3-85MO").kind, "ランダムブースターVol.12");
assert.equal(byName.get("ホルスシャッター3-85MO").release.iso, "2026-12-26");
assert.equal(byName.get("ホルスシャッター3-85MO").price, null, "the starter's price is not the booster's");

// Name order and shortened names, as written in live posts: 402538/402774 put
// the edition before the code; 401996 says "クロックミラージュ4-55S" one line
// above the full name.
assert.equal(canonicalBeyName("キッドハント メタルコート:ホワイトK4-70TK"), "キッドハントK4-70TK メタルコート:ホワイト");
assert.equal(canonicalBeyName("メテオドラグーン 3-70J メタルコート:ホワイト"), "メテオドラグーン3-70J メタルコート:ホワイト");
assert.equal(canonicalBeyName("ベイ上達ロードマップ"), null);
const swapped = extractCoroCoroProducts({
  title: "『月刊コロコロコミック 11月号』予告!!",
  date: "2026-09-17T12:00:03",
  content: `<p>●『BEYBLADE X』応募者全員有料サービス「キッドハント メタルコート：ホワイトK4-70TK」</p>
    <p>●『BEYBLADE X』×『運命の巻戻士』応募者全員有料サービス「クロックミラージュ4-55S」が手に入る!!</p>
    <p>コラボしたベイ、「クロックミラージュ4-55S メタルコート：ブラック 運命の巻戻士ver.」が大爆誕！</p>`,
});
assert.deepEqual(swapped.map((item) => item.name), [
  "キッドハントK4-70TK メタルコート:ホワイト",
  "クロックミラージュ4-55S メタルコート:ブラック 運命の巻戻士ver.",
]);
assert.equal(swapped[1].kind, "応募者全員有料サービス", "the short mention's kind carries over");
// Two editions of one bey are two products; the bare name stays its own.
assert.equal(extractCoroCoroProducts({
  title: "BEYBLADE X",
  date: "2026-09-17",
  content: "<p>「ドランソード3-60F メタルコート:ブルー」</p><p>「ドランソード3-60F メタルコート:レッド」</p><p>ドランソード3-60Fも!</p>",
}).length, 3);
// 402184 (コロコロイチバン!): Pokémon furoku in 「」 next to "セット" are not beys.
assert.deepEqual(extractCoroCoroProducts({
  title: "『コロコロイチバン！』10・11月号は本日発売!!",
  date: "2026-08-21",
  content: "<p>『BEYBLADE X』の最新情報も!</p><p>『プラコロ』おあそびセット「ピカチュウ」&amp;「ミュウ」など、超注目ふろくがいっぱいだ!!</p>",
}), []);

// Dates: the issue's own date is skipped; a month-only date and a January
// date in a November post (next year) are read.
assert.equal(findRelease("『月刊コロコロコミック 11月号』は、本日10月15日(木)発売!!", "2026-10-15"), null);
assert.equal(findRelease("2026年8月12日頃発売予定の、月刊コロコロコミック9月号で実施", "2026-08-08"), null);
assert.deepEqual(findRelease("新スターターが12月発売予定!", "2026-11-13"), { iso: "2026-12", text: "2026年12月" });
assert.equal(findRelease("1月24日発売!", "2026-11-13").iso, "2027-01-24");
assert.equal(findPrice("価格:770円の『月刊コロコロコミック 12月号』"), null);
assert.equal(findPrice("有料サービスです。2,600円(税・送料・作業費込)"), 2600);

// Records: one per product across posts. The scoop (402435, 9/16) dates it and
// gives the link; the 10/15 post with the order details fills in the rest.
const state = {
  posts: [
    { id: 402790, date: "2026-10-15T11:00:29", link: post(402790).link, title: "11月号特報", image_url: "https://corocoro-news.jp/a.jpg", items: kid },
    { id: 402435, date: "2026-09-16T12:00:50", link: "https://corocoro-news.jp/x/402435/", title: "10月号特報", image_url: "https://corocoro-news.jp/b.jpg", items: [{ ...kid[0], kind: null, price: null }] },
    { id: 999001, date: "2026-11-13T11:00:00", link: "https://corocoro-news.jp/x/999001/", title: "1月号特報", image_url: null, items: synthetic },
  ],
};
const records = coroCoroRecords(state);
// ドランソード3-60F (a manga scene: no kind, date, price or reveal word) is
// found but makes no record.
assert.equal(records.length, 3);
assert.ok(!records.some((record) => record.names.ja.includes("ドランソード")), "a bey mentioned in passing is no announcement");
const kidRecord = records.find((record) => record.names.ja.includes("キッドハント"));
assert.equal(kidRecord.announced_at, "2026-09-16");
assert.equal(kidRecord.source_url, "https://corocoro-news.jp/x/402435/");
assert.equal(kidRecord.thumbnail_url, "https://corocoro-news.jp/b.jpg");
assert.equal(kidRecord.names.ja, "コロコロ応募者全員有料サービス「キッドハントK4-70TK メタルコート:ホワイト」");
assert.match(kidRecord.notes, /2,600円/);
assert.deepEqual(
  { status: kidRecord.status, confidence: kidRecord.confidence, source_id: kidRecord.source_id, source_name: kidRecord.source_name, source_type: kidRecord.source_type },
  { status: "announced", confidence: "magazine", source_id: COROCORO_SOURCE_ID, source_name: "コロコロコミック", source_type: "news" },
);
assert.match(kidRecord.id, /^corocoro-[0-9a-f]{10}$/);
const vanish = records.find((record) => record.names.ja.includes("バニッシュ"));
assert.equal(vanish.names.ja, "UX-22 スターター「バニッシュルシファー WW」");
assert.match(vanish.notes, /^2026年12月26日ごろ発売 \/ 2,500円 \/ スターター\./);
assert.equal(coroCoroRecords(state)[0].id, records[0].id, "ids are stable");
// A later post with the fuller name renames the record but keeps its id.
const grown = coroCoroRecords({
  posts: [
    { id: 1, date: "2026-07-17", link: "https://corocoro-news.jp/news/1/", title: "a", items: [{ ...clock[0], name: "クロックミラージュ4-55S", key: "クロックミラージュ455s" }] },
    { id: 2, date: "2026-08-12", link: "https://corocoro-news.jp/news/2/", title: "b", items: clock },
  ],
});
assert.equal(grown.length, 1);
assert.equal(grown[0].id, coroCoroRecords({ posts: [{ id: 1, date: "2026-07-17", link: "x", title: "a", items: [{ ...clock[0], name: "クロックミラージュ4-55S", key: "クロックミラージュ455s" }] }] })[0].id);
assert.match(grown[0].names.ja, /運命の巻戻士ver\.」$/);
assert.equal(grown[0].announced_at, "2026-07-17");
// Stored records survive a day the site cannot be read (no reveal verb in the title).
assert.equal(acceptsStoredAnnouncement(vanish), true);

// Covered elsewhere: an official lineup record naming the bey drops the
// magazine copy; a catalog bey released before the post is an old one; a
// catalog product not out yet is linked.
const lineup = { id: "beyblade-lineup-x", source_id: "beyblade_x_lineup", franchise: "beyblade", announced_at: "2026-11-20", names: { ja: "BX-58 ランダムブースターVol.12 ホルスシャッター3-85MOセレクト ブースター" } };
const kits = new Map([["beyblade", [
  { kit_id: "beyblade-x-bx01", names: { ja: "BX-01 ドランソード3-60F" }, release_date: "2023-07-15" },
  { kit_id: "beyblade-x-ux17", names: { ja: "UX-17 メテオドラグーン3-70J" }, release_date: "2025-12-27" },
  // The catalog writes the full name once it is public; the code still matches.
  { kit_id: "beyblade-x-ux22", names: { ja: "UX-22 バニッシュルシファーW3-60WW" }, release_date: "2026-12-26" },
]]]);
const oldBey = coroCoroRecords({
  posts: [{ id: 5, date: "2026-11-13", link: "x", title: "t", items: [{ name: "ドランソード3-60F", key: "ドランソード360f", franchise: "beyblade", kind: "スターター" }] }],
})[0];
const { records: kept, dropped } = dropMagazineDuplicates([...records, oldBey, lineup], kits);
assert.deepEqual(dropped.map((item) => item.reason).sort(), ["catalog", "official"]);
assert.ok(kept.includes(lineup));
assert.equal(kept.find((record) => record.id === vanish.id).linked_kit_id, "beyblade-x-ux22");
assert.equal(kept.find((record) => record.id === kidRecord.id).linked_kit_id, null);
// The lineup lists the new starter under its full name: the code (or the blade
// name) matches. An official record from long before the scoop that shares
// the blade name, or a "-00" code shared by every limited item, does not.
const vanishLineup = { id: "l2", source_id: "beyblade_x_lineup", franchise: "beyblade", announced_at: "2026-12-01", names: { ja: "UX-22 バニッシュルシファーW3-60WW スターター" } };
// `kept` names the record that stays, for data/announcements.json "replaced".
assert.deepEqual(dropMagazineDuplicates([vanish, vanishLineup]).dropped, [{ id: vanish.id, reason: "official", kept: "l2" }]);
const bladeOnly = { ...vanishLineup, names: { ja: "BX-60 バニッシュルシファーW3-60WW スターター" } };
assert.equal(dropMagazineDuplicates([vanish, bladeOnly]).dropped.length, 1, "the blade name alone matches near the scoop");
assert.equal(dropMagazineDuplicates([vanish, { ...bladeOnly, announced_at: "2025-05-01" }]).dropped.length, 0);
const limited = { ...vanish, id: "corocoro-x", names: { ja: "CX-00 「アプリ限定 新ベイ」" } };
assert.equal(dropMagazineDuplicates([limited, { ...vanishLineup, names: { ja: "CX-00 ワルキューレボルトS4-70V ガンメタVer." } }]).dropped.length, 0);
// A record reviewed in the CMS is never dropped.
assert.equal(dropMagazineDuplicates([{ ...records.find((record) => record.names.ja.includes("ホルス")), reviewed_at: "2026-11-21" }, lineup], kits).records.length, 2);

// Network: only new or edited posts are read; the issue preview stores an
// empty item list so it is not read again; 429 stops the run but keeps what
// was read.
const listed = [
  { id: 402790, date: "2026-10-15T11:00:29", modified: "2026-10-15T11:00:29", link: post(402790).link, title: { rendered: "x" }, featured_media: 402791 },
  { id: 402892, date: "2026-10-17T12:00:11", modified: "2026-10-17T12:00:11", link: post(402892).link, title: { rendered: "x" }, featured_media: 402899 },
];
const requested = [];
const fakeFetch = (fail) => async (url) => {
  requested.push(url);
  if (fail && fail(url)) throw Object.assign(new Error(`${url} returned 429`), { status: 429 });
  if (/\/posts\?/.test(url)) return /search=BEYBLADE/.test(url) ? listed : [listed[0]];
  const id = Number(/\/posts\/(\d+)/.exec(url)?.[1]);
  if (id) return { ...post(id), modified: listed.find((item) => item.id === id).modified };
  if (/\/media\/402791/.test(url)) return { source_url: "https://corocoro-news.jp/wp-content/uploads/2026/10/kid.jpg" };
  throw new Error(`unexpected ${url}`);
};
const first = await runCoroCoroSource({ state: { posts: [] }, today: "2026-11-12", fetchJson: fakeFetch() });
assert.equal(first.stopped, null);
assert.deepEqual(first.state.posts.map((item) => [item.id, item.items.length]), [[402892, 0], [402790, 1]]);
assert.equal(first.records.length, 1);
assert.equal(first.records[0].thumbnail_url, "https://corocoro-news.jp/wp-content/uploads/2026/10/kid.jpg");
assert.ok(requested.every((url) => !/media\/402899/.test(url)), "no picture for a post without products");
assert.ok(requested.some((url) => /after=2026-07-15T00/.test(url) && /orderby=date/.test(url)), "last 120 days, newest first");
requested.length = 0;
const second = await runCoroCoroSource({ state: first.state, today: "2026-11-13", fetchJson: fakeFetch() });
assert.deepEqual(requested.filter((url) => !/\/posts\?/.test(url)), [], "nothing new: only the lists are read");
assert.deepEqual(second.records.map((record) => record.id), first.records.map((record) => record.id));
const blocked = await runCoroCoroSource({ state: first.state, today: "2026-11-13", fetchJson: fakeFetch((url) => /\/posts\?/.test(url)) });
assert.match(blocked.stopped, /HTTP 429/);
assert.equal(blocked.records.length, 1, "stored posts still give their records");
// A state written by an older extractor: every listed post is read again.
requested.length = 0;
const upgraded = await runCoroCoroSource({ state: { ...first.state, extractor: 0 }, today: "2026-11-13", fetchJson: fakeFetch() });
assert.deepEqual(requested.filter((url) => /\/posts\/\d+/.test(url)).length, 2);
assert.ok(requested.every((url) => !/\/media\//.test(url)), "the stored picture is kept");
assert.equal(upgraded.state.extractor, first.state.extractor);
const disallowed = await runCoroCoroSource({ state: { posts: [] }, today: "2026-11-13", fetchJson: fakeFetch(), robotsAllows: () => false });
assert.match(disallowed.stopped, /robots\.txt/);

console.log("corocoro-news tests OK");

// Print-only reveals (data/announcements-corocoro-print.json) become records like crawled ones
{
  const { coroCoroRecords: records } = await import("./lib/corocoro-news.mjs");
  const { readFileSync } = await import("node:fs");
  const print = JSON.parse(readFileSync("data/announcements-corocoro-print.json", "utf8")).posts;
  const out = records({ posts: [] }, print);
  const lucifer = out.find((r) => r.names.ja.includes("バニッシュルシファー"));
  const horus = out.find((r) => r.names.ja.includes("ホルスシャッター3-85MO"));
  assert.ok(lucifer && horus, "both December-issue beys");
  assert.equal(lucifer.source_id, "corocoro_news");
  assert.equal(lucifer.confidence, "magazine");
  assert.equal(lucifer.announced_at, "2026-11-13");
  assert.match(lucifer.notes, /2026年12月26日発売 \/ 2,500円 \/ スターター/);
  assert.match(horus.notes, /1,600円 \/ ランダムブースターVol\.12/);
  // the same product read from the site later is the same record (id from the name)
  const both = records({ posts: [{ id: 1, date: "2026-11-14", link: "https://corocoro-news.jp/news/1/", title: "t", items: [{ ...print[0].items[0] }] }] }, print);
  assert.equal(both.filter((r) => r.names.ja.includes("バニッシュルシファー")).length, 1);
  console.log("corocoro print reveals: ok");
}
