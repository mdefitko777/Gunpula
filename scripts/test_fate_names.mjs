import assert from "node:assert/strict";
import { aniplexCampaign, campaignLabel, lacksContext, nameKey, needsQualifier, qualifiedName, sameName } from "./lib/fate-names.mjs";

// Names with nothing but the product type.
for (const name of [
  "メインビジュアル B2タペストリー",
  "B2タペストリー",
  "プレミアムチケットホルダー",
  "デスクラバーマット",
  "アクリルスタンド<A>(全40種)",
  "サーヴァント別 描き下ろしイラスト A4クリアファイル B（全5種）",
  "オフィシャルTシャツA （全3色）",
  "トートバッグ",
]) {
  assert.equal(lacksContext(name), true, name);
}
// A work, quoted title or character is context enough.
for (const name of [
  "Fate / Grand Order アクリルスタンド（全6種）",
  "「劇場版 Fate / Grand Order -神聖円卓領域キャメロット-」クリアファイルセット",
  "藤丸立香はわからない 人形劇マスコット",
  "メリュジーヌ カクテルグラス",
  "SNOW FIELD STRANGE トートバッグ",
  "CONCEPT2",
]) {
  assert.equal(lacksContext(name), false, name);
}

const counts = new Map([[nameKey("Fate / Grand Order アクリルスタンド（全6種）"), 4]]);
assert.equal(sameName("Fate / stay night パンフレット", "Fate/stay night パンフレット"), true);
assert.equal(needsQualifier("Fate / Grand Order アクリルスタンド（全6種）", counts), true);
assert.equal(needsQualifier("藤丸立香はわからない 人形劇マスコット", counts), false);

assert.equal(campaignLabel("「Fate/Grand Order Fes. 2024 9th Anniversary」オリジナルグッズ通販"), "Fate/Grand Order Fes. 2024 9th Anniversary");
assert.equal(campaignLabel("「FGO MART」グッズ事後通販"), "FGO MART");
assert.equal(campaignLabel("『Fate/stay night』20周年記念コンサート Finale グッズ事後通販"), "『Fate/stay night』20周年記念コンサート Finale");
assert.equal(campaignLabel("TYPE-MOON展Fate/stay night-15年の軌跡- ＜イベント事後通販＞"), "TYPE-MOON展Fate/stay night-15年の軌跡-");
assert.equal(campaignLabel("AnimeJapan2026 Fate/Grand Order オフィシャルグッズ"), "AnimeJapan2026 Fate/Grand Order");
assert.equal(campaignLabel("Fate/Grand Order カルデア・サテライトステーション 2021-2022"), "Fate/Grand Order カルデア・サテライトステーション 2021-2022");
assert.equal(
  campaignLabel("Fate/Grand Order 10th Anniversary &ldquo;OVER THE SAME SKY&quot; オフィシャルグッズ通販"),
  'Fate/Grand Order 10th Anniversary "OVER THE SAME SKY"',
);

assert.equal(
  qualifiedName("「Fate/Grand Order Fes. 2024 9th Anniversary」オリジナルグッズ通販", "メインビジュアル B2タペストリー"),
  "Fate/Grand Order Fes. 2024 9th Anniversary メインビジュアル B2タペストリー",
);
assert.equal(qualifiedName(null, "B2タペストリー"), "B2タペストリー");

const html = `<nav class="breadcrumb-nav"><ol class="breadcrumb-nav__list">
  <li class="breadcrumb-nav__item"><a href="https://online.aniplex.co.jp/" class="link-under">TOP</a></li>
  <li class="breadcrumb-nav__item"><span class="ellipses"></span></li>
  <li class="breadcrumb-nav__item"><a href="/WVWcbumi" class="link-under">
    Fate/Grand Order カルデア・サテライトステーション 2021-2022
  </a></li></ol></nav>`;
assert.equal(aniplexCampaign(html), "Fate/Grand Order カルデア・サテライトステーション 2021-2022");
assert.equal(aniplexCampaign('<ol class="breadcrumb-nav__list"><li><a href="/">TOP</a></li></ol>'), null);

console.log("fate-names: ok");
