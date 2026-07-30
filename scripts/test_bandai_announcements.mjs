import assert from "node:assert/strict";
import {
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBandaiYoutubeFeed,
} from "./lib/bandai-announcements.mjs";

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

const merged = mergeAnnouncementRecords(
  [{ ...videos[0], status: "product_confirmed", names: { ...videos[0].names, zh: "中文名" } }],
  [{ ...videos[0], status: "announced" }],
);
assert.equal(merged[0].status, "product_confirmed");
assert.equal(merged[0].names.zh, "中文名");

console.log("bandai-announcements tests OK");
