import assert from "node:assert/strict";
import {
  franchiseForAnnouncement,
  isProductAnnouncement,
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBandaiYoutubeFeed,
  parseBeybladeNews,
  parseTamashiiNews,
} from "./lib/bandai-announcements.mjs";

// Titles taken verbatim from the live feeds. The old Gundam-only gate required
// both a Gundam word and an action word, so it dropped every preorder-open
// post ("受付" was missing from the action list) and every retail-item list
// (no Gundam word in the title at all) — 12 of the 15 posts on the page.
for (const title of [
  "2026年8月一般店頭発売アイテム",
  "RG 1/144 RX-178 ガンダムMk-II(ケロロ仕様) 7月24日(金) お申込み受付スタート！",
  "「SDW HEROES 復活輝羅鋼 DXセット [スペシャルコーティング]」 7月10日(金) お申し込み受付スタート",
  "RG 1/144 RX-178 ガンダムMk-Ⅱ(ケロロ仕様)商品化決定！",
  "2026年10月～12月発売予定の新商品を掲載！「HOBBY NEW ITEM INFO.」",
]) {
  assert.equal(isProductAnnouncement(title), true, `should keep: ${title}`);
}
for (const title of [
  "ガンプラユーザーアンケートキャンペーン！",
  "『水星の魔女』×ガンプラキャンペーン 8月1日（土）より一般店頭およびガンダムベースで開始！",
  "THE GUNDAM BASE POP-UP in EHIME 開催！",
  "愛媛県にて「THE GUNDAM BASE POP-UP in EHIME」開催決定！",
]) {
  assert.equal(isProductAnnouncement(title), false, `should drop: ${title}`);
}

assert.equal(franchiseForAnnouncement("【機動戦士ガンダムSEED FREEDOM】が登場。"), "gundam");
assert.equal(franchiseForAnnouncement("ポケモンプラモコレクション クイック!! 28 ニャース"), "pokemon");
assert.equal(franchiseForAnnouncement("Fate/Grand Order 新作フィギュア"), "fate");
assert.equal(franchiseForAnnouncement("ベイブレードX 新商品"), "beyblade");
assert.equal(franchiseForAnnouncement("【僕のヒーローアカデミア】黒デク"), null);
assert.equal(franchiseForAnnouncement("2026年8月一般店頭発売アイテム", "gundam"), "gundam");

const news = parseBandaiHobbyNews(`
  <div class="m_cardA">
    <a href="/news/detail/123/" class="m_cardA__link"></a>
    <div class="m_cardA__image"><img src="/images/reveal.jpg" alt=""></div>
    <div class="m_cardA__date">2026年7月30日</div>
    <div class="m_cardA__title">ガンプラ新商品発表</div>
  </div>
  <div class="m_cardA">
    <a href="/news/detail/other/" class="m_cardA__link"></a>
    <div class="m_cardA__date">2026年7月29日</div>
    <div class="m_cardA__title">工具のお知らせ</div>
  </div>
`);
assert.equal(news.length, 1);
assert.equal(news[0].announced_at, "2026-07-30");
assert.equal(news[0].source_url, "https://www.bandaispirits.co.jp/news/detail/123/");
assert.equal(news[0].thumbnail_url, "https://www.bandaispirits.co.jp/images/reveal.jpg");

const videos = parseBandaiYoutubeFeed(`
  <entry><yt:videoId>abc123</yt:videoId><title>ガンプラ新商品発表ライブ</title><published>2026-07-30T10:00:00Z</published></entry>
  <entry><yt:videoId>other</yt:videoId><title>フィギュア紹介</title><published>2026-07-29T10:00:00Z</published></entry>
`);
assert.equal(videos.length, 1);
assert.equal(videos[0].thumbnail_url, "https://i.ytimg.com/vi/abc123/hqdefault.jpg");

const revealProgram = parseBandaiYoutubeFeed(`
  <entry><yt:videoId>reveal123</yt:videoId><title>HOBBY NEW ITEM INFO. 2026 SUMMER</title><published>2026-07-30T10:00:00Z</published></entry>
`);
assert.equal(revealProgram.length, 1);

const tamashii = parseTamashiiNews(`
  <li class="topicList__item itemList__item"><article>
    <a href="/item/16011/">
    <h3 class="itemList__title">【機動戦士ガンダムSEED FREEDOM】「キャバリアーアイフリッド」がMETAL ROBOT魂に登場。</h3>
    <div class="itemList__thumb"><img src="/storage/images/topics/a.webp"></div>
    <div class="itemList__meta"><p class="itemList__date"><time datetime="2026-08-04">2026年8月4日</time></p></div>
    </a>
  </article></li>
  <li class="topicList__item itemList__item"><article>
    <a href="/item/16065/">
    <h3 class="itemList__title">【僕のヒーローアカデミア】S.H.Figuartsより「黒デク」の2次販売が決定。</h3>
    <div class="itemList__meta"><p class="itemList__date"><time datetime="2026-08-05">2026年8月5日</time></p></div>
    </a>
  </article></li>
`);
assert.equal(tamashii.length, 1, "only the Gundam post belongs to one of the app's worlds");
assert.equal(tamashii[0].franchise, "gundam");
assert.equal(tamashii[0].announced_at, "2026-08-04");
assert.equal(tamashii[0].source_url, "https://tamashiiweb.com/item/16011/");
assert.equal(tamashii[0].thumbnail_url, "https://tamashiiweb.com/storage/images/topics/a.webp");

const beyblade = parseBeybladeNews(`
  <li class="mix news" data-release-date="442">
    <img src="/beyblade-x/news/_image/news260805_thumb@2x.webp" alt="">
    <b>【BX-00 ブースター ドランソード3-60F バージョン2.0】追加生産に関するお知らせ</b>
    <i>2026.08.05</i> <a href="/beyblade-x/news/news260805.html"></a>
  </li>
  <li class="mix event etc_event enjoy" data-release-date="441">
    <b>エクストリームカップ 開催のお知らせ</b>
    <i>2026.08.03</i> <a href="/beyblade-x/news/news260803.html"></a>
  </li>
`);
assert.equal(beyblade.length, 1, "tournament posts are events, not product news");
assert.equal(beyblade[0].franchise, "beyblade");
assert.equal(beyblade[0].announced_at, "2026-08-05");
assert.equal(beyblade[0].source_url, "https://beyblade.takaratomy.co.jp/beyblade-x/news/news260805.html");

const merged = mergeAnnouncementRecords(
  [{ ...videos[0], status: "product_confirmed", names: { ...videos[0].names, zh: "中文名" } }],
  [{ ...videos[0], status: "announced" }],
);
assert.equal(merged[0].status, "product_confirmed");
assert.equal(merged[0].names.zh, "中文名");

// A stored record the source no longer offers is re-checked against today's
// filter, so tightening a rule actually removes what it wrongly let in —
// unless someone reviewed it in the CMS.
const stale = {
  id: "beyblade-news-2025-09-12-x",
  franchise: "beyblade",
  names: { ja: "BEYBLADE X が葛飾区のふるさと納税返礼品に決定", zh: null, ko: null, en: null },
  announced_at: "2025-09-12",
};
assert.equal(mergeAnnouncementRecords([stale], []).length, 0);
assert.equal(mergeAnnouncementRecords([{ ...stale, reviewed_at: "2026-08-01" }], []).length, 1);
// History that still passes the filter survives even when it is off the page.
assert.equal(
  mergeAnnouncementRecords([{ ...stale, names: { ...stale.names, ja: "BX-99 ブースター 発売決定" } }], []).length,
  1,
);

console.log("bandai-announcements tests OK");
