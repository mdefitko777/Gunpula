// Series rules of scripts/localize_catalog.mjs (run from the repository root: it reads data/).
import assert from "node:assert/strict";
import { localizeKit, SERIES, SERIES_OVERRIDES } from "./localize_catalog.mjs";

let n = 0;
const kit = (franchise, ja, extra = {}) => ({ kit_id: `test-${(n += 1)}`, franchise, names: { ja, en: ja, zh: ja, ko: ja }, ...extra });
const seriesOf = (record) => localizeKit(record).series.key;
const check = (franchise, ja, want, extra) => assert.equal(seriesOf(kit(franchise, ja, extra)), want, ja);

// ── Fate: the work, not the "fgo" tag the Good Smile importer used to put on everything ──
const gsc = (work) => ({ tags: ["fate", "fgo", "good smile", "nendoroid", work] });
check("fate", "Nendoroid Saber : Zero Ver.", "fate_zero", gsc("fate/zero"));
check("fate", 'Nendoroid Saber of "Red"', "fate_apocrypha", gsc("fate/apocrypha"));
check("fate", "Nendoroid Lazy Sakura", "fate_hollow_ataraxia", gsc("fate/hollow ataraxia"));
check("fate", "Nendoroid Chloe von Einzbern", "fate_prisma", gsc("fate/kaleid liner prisma illya"));
check("fate", "figma Rin Tohsaka 2.0", "fate_stay_night", gsc("fate/stay night"));
check("fate", "Nendoroid Arcueid Brunestud", "type_moon", gsc("type-moon"));
check("fate", "Nendoroid Mash Kyrielight", "fate_fgo", gsc("fate/grand order"));
// "Fate / stay night" with spaces, and a bare セイバー that is not FGO's
check("fate", "劇場版 Fate / stay night [Heaven's Feel] セイバーオルタ 1 / 7スケールフィギュア", "fate_stay_night");
check("fate", "Fate / strange Fake Blu-ray Disc BOX【完全生産限定版】", "fate_strange_fake");
check("fate", "「Fate / Zero」武内崇イラスト B2タペストリー＜セイバー＆ギルガメッシュ＞", "fate_zero");
check("fate", "Fate / Samurai Remnant＜Switch＞", "fate_samurai_remnant");
check("fate", "Fate / Prototype 蒼銀のフラグメンツ トートバッグ", "fate_prototype");
check("fate", "「ロード・エルメロイII世の事件簿」アクリルスタンド", "fate_el_melloi");
// FGO stays FGO, also with a stay night servant in it and with no work at all
check("fate", "Fate/Grand Order セイバー / アルトリア・ペンドラゴン 1 / 7スケールフィギュア", "fate_fgo");
check("fate", "Fate/Accel Zero Order コラボ アクリルスタンド", "fate_fgo");
check("fate", "AnimeJapan2023 SDミニアクリルマスコット（全13種）", "fate_fgo");
// The app shows the series label from the data: every Fate key has all four labels
for (const series of SERIES.filter((s) => /^fate_|^type_moon$/.test(s.key))) {
  assert.ok(["zh", "en", "ja", "ko"].every((lang) => series.labels[lang]), series.key);
}

// ── Gundam: look-alike words ──
check("gundam", "1 / 100 V2バスターガンダム", "victory");
check("gundam", "HG 1 / 144 V2アサルトバスターガンダム [クリアカラー]", "victory");
check("gundam", "ＭＧ 1 / 100 Ｖ２アサルトバスターガンダム Ver．Ka", "victory");
check("gundam", "HG 1 / 144 バスターガンダム", "seed");
check("gundam", "HGUC 1 / 144 メッサーラ", "zeta");
check("gundam", "HG 1 / 144 メッサーF01型", "hathaway");
check("gundam", "1 / 144 HG ドムトルーパー", "seed");
check("gundam", "HG 1 / 144 軍警ザク", "gqux");
check("gundam", "HGUC 1 / 144 バウンド・ドック", "zeta");

// ── Gundam: UC suits the One Year War words (ジム, ザク, ドム …) filed under 0079 ──
check("gundam", "HGUC 1 / 144 ズゴックＥ", "0080");
check("gundam", "HGUC 1 / 144 ジム・スナイパーII", "0080");
check("gundam", "HGUC 1 / 144 ジム・コマンド(宇宙仕様)", "0080");
check("gundam", "HGUC 1 / 144 ゲルググJ", "0080");
check("gundam", "HGUC 1 / 144 RGM-79C ジム改", "0083");
check("gundam", "MG 1 / 100 RGM-79N ジムカスタム", "0083");
check("gundam", "ＭＧ 1 / 100 MS-06F-2 ザクＩＩ Ｆ２型（ノイエン・ビッター機）", "0083");
check("gundam", "HGUC 1 / 144 MS-14F ゲルググマリーネ", "0083");
check("gundam", "HGUC 1 / 144 グフ・フライトタイプ", "08ms");
check("gundam", "HGUC 1 / 144 ジムII", "zeta");
check("gundam", "ＨＧ 1 / 144 アクト・ザク", "zeta");
check("gundam", "HGUC 1 / 144 ジムIII", "zz");
check("gundam", "HGUC 1 / 144 ザク・マリナー", "zz");
check("gundam", "HGUC 1 / 144 ジムII・セミストライカー", "unicorn");
check("gundam", "HGUC 1 / 144 ネオ・ジオング", "unicorn");
check("gundam", "FW GUNDAM CONVERGE EX27 セカンドネオジオング", "narrative");
check("gundam", "1 / 100 ガンタンクR-44", "f91");
// …but the One Year War suits themselves, and a work the title names, stay
check("gundam", "HGUC 1 / 144 ジム", "uc_first");
check("gundam", "HGUC 1 / 144 ザクII", "uc_first");
check("gundam", "HGUC 1 / 144 ゲルググ", "uc_first");
check("gundam", "HGUC 1 / 144 ザクＩＩ改 Ｂタイプ（ユニコーンＶｅｒ．）", "unicorn");
check("gundam", "HGUC 1 / 144 ザクＩＩＩ改 （Twilight AXIS Ver．）", "uc_side");
check("gundam", "HGUC 1 / 144 ザクＩＩＩ改", "zz");
// …and so do a hand fix and an earlier result
assert.equal(SERIES_OVERRIDES["hg-hg-1-144-ii-iii-4573102653901000"], "uc_first");
assert.equal(
  seriesOf({ ...kit("gundam", "HG 1 / 144 ガンダムベース限定 ジム / ジムII / ジムIII セット"), kit_id: "hg-hg-1-144-ii-iii-4573102653901000" }),
  "uc_first",
);
const published = { ...kit("gundam", "HGUC 1 / 144 RGM-79C ジム改"), series: { key: "uc_first" }, work_title: "0079" };
assert.equal(seriesOf(published), "uc_first", "an earlier result is kept (series-overrides.json moves it)");

// Every hand fix names a known series
for (const [kitId, key] of Object.entries(SERIES_OVERRIDES)) assert.ok(SERIES.some((series) => series.key === key), `${kitId} → ${key}`);

// ── Korean names: no kana left in V2アサルトバスター ──
const v2 = localizeKit(kit("gundam", "HGUC 1 / 144 V2アサルトバスターガンダム"));
assert.equal(v2.names.ko, "HGUC 1 / 144 V2 어설트 버스터건담");
assert.equal(v2.names.en, "HGUC 1 / 144 V2 Assault Buster Gundam");

console.log("localize series: ok");
