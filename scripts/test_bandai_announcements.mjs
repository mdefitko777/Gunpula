import assert from "node:assert/strict";
import {
  BANDAI_SPIRITS_TOPICS_URL,
  acceptsStoredAnnouncement,
  franchiseForAnnouncement,
  isBeybladeProductNews,
  isProductAnnouncement,
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBandaiYoutubeFeed,
  parseBeybladeNews,
  parseTamashiiNews,
  parseYoutubeFeed,
} from "./lib/bandai-announcements.mjs";
import {
  dedupeAnnouncements,
  kotobukiyaAnnouncement,
  parseBeybladeLineup,
  parseFriendaTopics,
  parseGundamBaseNews,
  parseGundamOfficialNews,
  parseKotobukiyaTitleGoods,
  parsePremiumBandaiCategoryTitles,
  parsePremiumBandaiNewItems,
  parseTakaraTomyPokemonNews,
} from "./lib/official-announcements.mjs";

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

// ---- Sources added 2026-11 -------------------------------------------------

// App tie-ins and corrections are not product news.
assert.equal(isProductAnnouncement("スマホアプリ「デジフィグ」に「ガンダムマルコシアス」が登場！"), false);
assert.equal(isProductAnnouncement("発売日表記の誤記についてお詫びと訂正"), false);

// BEYBLADE X posts its product news without Bandai-style reveal verbs.
for (const title of [
  "レアベイゲットバトルに新限定品「スコーピオスピア0-70Z メタルコート:マゼンタ」が追加",
  "【CX-00 スターター ティガレイジFT3-60T】追加受注生産販売に関するお知らせ",
  "BEYBLADE X商品 タカラトミーモールでの抽選販売実施に関するお知らせ",
]) {
  assert.equal(isBeybladeProductNews(title), true, `beyblade should keep: ${title}`);
}
for (const title of [
  "【重要】「レアベイ交換チケット ワルキューレボルトS4-70V」排出終了のお知らせ",
  "「ベイブレード」シリーズ非純正品に関するご注意",
  "【重要】スマートフォンアプリ「BEYBLADE X -ベイブレードエックス」におけるシュートジム仕様変更とクラウドマッチ終了のお知らせ",
]) {
  assert.equal(isBeybladeProductNews(title), false, `beyblade should drop: ${title}`);
}

// The all-categories Bandai Spirits topics page: ガンプラ-tagged cards default
// to Gundam, other cards must name a world.
const topics = parseBandaiHobbyNews(`
  <div class="m_cardA"><a href="https://1kuji.com/products/fgo" class="m_cardA__link"></a>
    <div class="m_cardA__date">2026年10月9日</div>
    <a class="m_cardA__tagLink s_color05" href="/products/topics/?category=4">一番くじ</a>
    <div class="m_cardA__title">「一番くじ Fate/Grand Order 〜カルデアピックアップメモリー〜」全ラインナップ公開!!</div></div>
  <div class="m_cardA"><a href="/news/1/" class="m_cardA__link"></a>
    <div class="m_cardA__date">2026年10月13日</div>
    <a class="m_cardA__tagLink s_color01" href="/products/topics/?category=1">ガンプラ</a>
    <div class="m_cardA__title">2026年10月一般店頭発売アイテム</div></div>
  <div class="m_cardA"><a href="/news/2/" class="m_cardA__link"></a>
    <div class="m_cardA__date">2026年10月16日</div>
    <a class="m_cardA__tagLink s_color02" href="/products/topics/?category=2">プラモデル</a>
    <div class="m_cardA__title">「RG スターガオガイガー」 10月16日(金) お申し込み受付スタート！</div></div>
`, BANDAI_SPIRITS_TOPICS_URL, { defaultFranchise: null });
assert.deepEqual(topics.map((record) => record.franchise), ["fate", "gundam"]);

// Channel-specific reveal wording on a single-IP channel.
const baseVideos = parseYoutubeFeed(`
  <entry><yt:videoId>gb1</yt:videoId><title>【ガンダムベース限定品情報】MG 1/100 ガンダムキュリオス</title><published>2026-09-12T10:00:00Z</published></entry>
  <entry><yt:videoId>gb2</yt:videoId><title>【夜のガンプラ倶楽部】本日のおすすめアイテム！</title><published>2026-09-13T10:00:00Z</published></entry>
`, { sourceName: "THE GUNDAM BASE YouTube", sourceId: "gundam_base_youtube", defaultFranchise: "gundam", accept: /限定品情報/ });
assert.deepEqual(baseVideos.map((record) => record.id), ["youtube-gb1"]);
assert.equal(baseVideos[0].source_id, "gundam_base_youtube");
assert.equal(acceptsStoredAnnouncement(baseVideos[0]), true, "re-check uses the channel's own rule");

// gundam-official.com: the list lives in the Next.js flight payload.
const flight = JSON.stringify(`6:["$","$L24",null,{"newsResponse":{"data":[${[
  { documentId: "a1", title: "「HG ガンダムヴァサーゴ」10月31日発売！", displayDatetime: "2026-10-30T03:00:00.000Z", thumbnail: { url: "https://gundam-official.com/media/a.jpg" }, url: "https://gundam-official.com/news/a1", categories: [{ name: "ガンプラ" }] },
  { documentId: "a2", title: "焼肉グリル「やきまる」ザクIIモデルが発売中！", displayDatetime: "2026-10-29T03:00:00.000Z", thumbnail: null, url: "https://gundam-official.com/news/a2", categories: [{ name: "トイ・グッズ" }] },
  { documentId: "a3", title: "「HJメカニクス28」本日発売！", displayDatetime: "2026-10-28T03:00:00.000Z", thumbnail: null, url: "https://gundam-official.com/news/a3", categories: [{ name: "書籍・コミック" }, { name: "ガンプラ" }] },
].map((item) => JSON.stringify(item)).join(",")}],"pageCount":2487}}]`).slice(1, -1);
const official = parseGundamOfficialNews(`<script>self.__next_f.push([1,"${flight}"])</script>`);
assert.equal(official.items, 3);
assert.equal(official.oldest, "2026-10-28");
assert.deepEqual(official.records.map((record) => record.id), ["gundam-official-a1"]);
assert.equal(official.records[0].thumbnail_url, "https://gundam-official.com/media/a.jpg");

const gundamBase = parseGundamBaseNews(`
  <li class="itemBoxCol"><a href="https://www.gundam-base.net/news/81618.html"><img src="https://www.gundam-base.net/images/contents/2026/09/x.jpg">
    <p class="date">2026年09月17日</p><h3 class="name">MG 1/100 ガンダムベース限定 ガンダムキュリオス 商品詳細公開!</h3></a></li>
  <li class="itemBoxCol"><a href="https://www.gundam-base.net/news/82189.html">
    <p class="date">2026年10月30日</p><h3 class="name">11月のガンダムカフェキッチンカー メニューも登場中！！</h3></a></li>
`);
assert.deepEqual(gundamBase.map((record) => record.announced_at), ["2026-09-17"]);

// Premium Bandai: truncated names on the new-items page are completed from the
// Gunpla list; apparel is dropped; HG 1/72 is not Gunpla.
const pbTitles = parsePremiumBandaiCategoryTitles(`
  <a href="/item/item-1000260719/"><span>ＭＧ 1/100 フルアーマー・ユニコーンガンダム（レッドカラーＶｅｒ.）【再販】</span></a>
`);
const pbBox = (id, name, start, badge = "予約") => `<!-- ITEM BOX --><li><a href="/item/item-${id}/"><img src="https://bandai-a.akamaihd.net/bc/img/model/m/${id}_1.jpg" alt="${name}"></a>
  <span class="hassou"><img src="//x/RESERVE.gif" alt="${badge}" /></span><p class="itemslist_name"><a href="/item/item-${id}/"><span>${name}</span>
  <span class="price">1円</span><span class="start">開始：${start}時</span></a></p></li>`;
const pb = parsePremiumBandaiNewItems([
  pbBox("1000260719", "ＭＧ 1/100 フルアーマー・ユニ...", "10/30 11"),
  pbBox("1000260650", "STRICT-G『機動戦士ガンダムSEED...", "10/30 13"),
  pbBox("1000260812", "HG 1/72 ダンバイン【再販】【２...", "10/30 11"),
  pbBox("1000253253", "ポケモンスケールワールド シン...", "10/23 8", "販売"),
].join("\n"), { fullTitles: pbTitles, gunplaIds: new Set(pbTitles.keys()), now: new Date("2026-11-02T12:00:00+09:00") });
assert.deepEqual(pb.map((record) => [record.franchise, record.announced_at, record.status]), [
  ["gundam", "2026-10-30", "preorder_open"],
  ["pokemon", "2026-10-23", "product_confirmed"],
]);
assert.match(pb[0].names.ja, /レッドカラー/);
assert.equal(pb[1].names.ja, "ポケモンスケールワールド シン…");

// BEYBLADE X lineup: upcoming releases only, dated by first sighting, and a
// refetch keeps the first-seen date.
const lineupHtml = `
  <li class="mix booster seriesbx bx" data-release-date="200"><a href="bx54.html"><img src="_image/BX54_list.png">
    <b>BX-54<span>ジークスペリオン0-70LP</span></b><p class="category"><span>ブースター</span></p>
    <i>¥1,650（税込）</i> <i class="red">2026.11.21発売</i></a></li>
  <li class="mix starter seriesbx bx" data-release-date="1"><a href="bx01.html"><b>BX-01<span>ドランソード3-60F</span></b>
    <i class="red">2023.7.15発売</i></a></li>`;
const lineup = parseBeybladeLineup(lineupHtml, { today: "2026-11-02" });
assert.equal(lineup.length, 1);
assert.equal(lineup[0].names.ja, "BX-54 ジークスペリオン0-70LP ブースター");
assert.equal(lineup[0].announced_at_basis, "first_seen");
const relisted = parseBeybladeLineup(lineupHtml, { today: "2026-11-09" });
assert.equal(mergeAnnouncementRecords(lineup, relisted)[0].announced_at, "2026-11-02");
// Store listings are products by construction and survive the title re-check.
assert.equal(acceptsStoredAnnouncement(lineup[0]), true);

const ttPokemon = parseTakaraTomyPokemonNews(`<h2 class="txt_ttl">お知らせ</h2><div class="new_box">
  <a href="moncolle_ex/lineup/tsuzuku_pikachu/"><span>2026.10.31 更新</span><div><figure><img src="images/new.jpg" alt=""></figure></div>
  <p>12月発売予定<br>
  つづくピカチュウ</p></a>
  <a href="popup/"><span>2026.9.18 更新</span><div><figure><img src="images/p.jpg"></figure></div><p>Pokémon 30th POP-UP PARK 池袋 最終開催</p></a>
</div></div>`);
assert.deepEqual(ttPokemon.map((record) => [record.announced_at, record.names.ja]), [["2026-10-31", "つづくピカチュウ（12月発売予定）"]]);
assert.equal(ttPokemon[0].source_url, "https://www.takaratomy.co.jp/products/pokemon/moncolle_ex/lineup/tsuzuku_pikachu/");

const frienda = parseFriendaTopics(`
  <article class="topics__item img--shadow swiper-slide "><a class="slideUp" href="/goods/"><picture><img src="/assets/topics/a.webp" alt=""></picture>
    <p class="topics__txt">11月26日（木）発売予定！「フレンダフォルダーセットDX2」の情報をチェックしよう！<time datetime="2026-10-15">2026.10.15</time></p></a></article>
  <article class="topics__item"><a href="/event/"><p class="topics__txt">店頭大会「キャプテンにちょうせん！」が開催されるぞ！<time datetime="2026-10-02">2026.10.02</time></p></a></article>
`);
assert.deepEqual(frienda.map((record) => record.announced_at), ["2026-10-15"]);

const kotoGoods = parseKotobukiyaTitleGoods(`<ul class="cat_goods grid3"><li class="tile_item normal">
  <a href="/shop/g/g4934054088706/" title="ミラージュ C01-GAEA レッドメタルVer.">
  <div class="img"><img class="lazy" data-original="/img/goods/S/VI104_eye.jpg" alt="ミラージュ C01-GAEA レッドメタルVer." src="/img/sys/loading.gif"></div>
  <div class="desc"><div class="name">ミラージュ C01-GAEA レッドメタルVer. </div><div class="price">4,180円 税込</div></div></a></li></ul>`);
assert.deepEqual(kotoGoods, [{
  code: "4934054088706",
  url: "https://shop.kotobukiya.co.jp/shop/g/g4934054088706/",
  name: "ミラージュ C01-GAEA レッドメタルVer.",
  image: "https://shop.kotobukiya.co.jp/img/goods/S/VI104_eye.jpg",
}]);
const acTitle = { franchise: "armored_core", label: "ARMORED CORE" };
const kotoRecord = kotobukiyaAnnouncement({ title: acTitle, goods: kotoGoods[0], detail: { title: kotoGoods[0].name, release_date: "2027-04", gallery: [] }, detailHtml: "予約受付中！", today: "2026-11-02" });
assert.equal(kotoRecord.franchise, "armored_core");
assert.equal(kotoRecord.status, "preorder_open");
assert.equal(kotobukiyaAnnouncement({ title: acTitle, goods: kotoGoods[0], detail: { title: "x", release_date: "2025-04", gallery: [] }, detailHtml: "", today: "2026-11-02" }), null, "released goods are catalog, not announcements");

// Cross-source dedupe: a shared URL, or the same 「product」 within ten days in
// the same world, keeps the higher-priority source's record.
const xarx = [
  { id: "bs", source_id: "bandai_spirits_topics", source_name: "BANDAI SPIRITS", franchise: "gundam", announced_at: "2026-10-30", source_url: "https://tamashiiweb.com/item/16214/", names: { ja: "【GUNDAM UNIVERSE】「XARX-0 GUNDAM ZERO」が登場！" } },
  { id: "tw", source_id: "tamashii_news", source_name: "TAMASHII WEB", franchise: "gundam", announced_at: "2026-10-30", source_url: "https://tamashiiweb.com/item/16214", names: { ja: "【GUNDAM UNIVERSE】「XARX-0 GUNDAM ZERO」が登場！" } },
  { id: "go", source_id: "gundam_official_news", source_name: "GUNDAM.INFO", franchise: "gundam", announced_at: "2026-10-31", source_url: "https://gundam-official.com/news/x", names: { ja: "新作より「XARX-0 GUNDAM ZERO」が2027年4月発売決定！" } },
  { id: "go-old", source_id: "gundam_official_news", source_name: "GUNDAM.INFO", franchise: "gundam", announced_at: "2026-06-01", source_url: "https://gundam-official.com/news/y", names: { ja: "「XARX-0 GUNDAM ZERO」再販決定！" } },
];
const priority = ["tamashii_news", "bandai_spirits_topics", "gundam_official_news"];
assert.deepEqual(dedupeAnnouncements(xarx, priority).records.map((record) => record.id).sort(), ["go-old", "tw"]);
// A record reviewed in the CMS is never the one dropped.
const reviewed = { id: "reviewed", source_id: "gundam_official_news", source_name: "GUNDAM.INFO", franchise: "gundam", announced_at: "2026-10-31", reviewed_at: "2026-11-01", source_url: "https://gundam-official.com/news/z", names: { ja: "「XARX-0 GUNDAM ZERO」予約開始" } };
// (go is a second GUNDAM.INFO post, so it is not a twin of the reviewed one.)
assert.deepEqual(dedupeAnnouncements([...xarx, reviewed], priority).records.map((record) => record.id).sort(), ["go", "go-old", "reviewed"]);
// One site's reveal and its preorder post a week later are both kept.
assert.equal(dedupeAnnouncements([
  { id: "t1", source_id: "tamashii_topics_items", source_name: "TAMASHII WEB", franchise: "gundam", announced_at: "2026-08-26", source_url: "https://tamashiiweb.com/item/1/", names: { ja: "「聖竜騎士ゼロガンダム」が登場！" } },
  { id: "t2", source_id: "tamashii_news", source_name: "TAMASHII WEB", franchise: "gundam", announced_at: "2026-09-03", source_url: "https://tamashiiweb.com/item/2/", names: { ja: "「聖竜騎士ゼロガンダム」予約受付開始！" } },
], priority).records.length, 2);

console.log("bandai-announcements tests OK");
