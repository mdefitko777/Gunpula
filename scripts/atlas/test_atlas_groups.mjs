// Checks for the Atlas group classifiers (scripts/atlas/lib/atlas_groups.mjs) against the
// committed rosters. Run: node scripts/atlas/test_atlas_groups.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { armoredCoreClassifier, fateClassifier, pokemonClassifier } from "./lib/atlas_groups.mjs";
import { buildMatcher, compactKey } from "./lib/textmatch.mjs";

const json = async (file) => JSON.parse(await readFile(new URL(`../../${file}`, import.meta.url), "utf8"));
const roster = await json("data/atlas/fate-roster.json");
const taxonomy = await json("data/atlas-source-taxonomy.json");
const groups = await json("data/atlas-groups.json");

const kit = (ja, extra = {}) => ({ names: { ja }, tags: [], ...extra });
let checks = 0;
const expectGroup = (classify, title, group, extra) => {
  const got = classify(kit(title, extra));
  assert.equal(got.group, group, `${title} → ${got.group} (${got.reason}), expected ${group}`);
  checks++;
};

// Text matching: Japanese voiced kana survive, short names need a boundary, longest wins.
assert.equal(compactKey("バーゲスト"), "バーゲスト");
assert.equal(compactKey("Mélusine"), "melusine");
const m = buildMatcher([
  { key: "ミュウ", ref: 151 },
  { key: "ミュウツー", ref: 150 },
  { key: "BB", ref: "bb" },
  { key: "翡翠", ref: "hisui" },
]);
assert.deepEqual(m.findAll("ミュウツー と ミュウ").map((h) => h.refs[0]), [150, 151]);
assert.deepEqual(m.findAll("abba BB").map((h) => h.start), [4]);
assert.equal(m.findAll("翡翠色のグラス").length, 0);
assert.equal(m.findAll("POP UP PARADE 翡翠").length, 1);
checks += 6;

// Fate: work named in the title, FGO chapter from servants, event servants, FGO-wide goods.
const fate = fateClassifier(roster).classify;
expectGroup(fate, "Fate / Grand Order ランサー / メリュジーヌ 1/7スケールフィギュア", "fgo_308");
expectGroup(fate, "Nendoroid Lancer / Mélusine", "fgo_308", { tags: ["fate/grand order"] });
expectGroup(fate, "Saber / Barghest", "fgo_308", { tags: ["fate/grand order"] });
expectGroup(fate, "figma Shielder / Mash Kyrielight", "fgo_100", { tags: ["fate/grand order"] });
expectGroup(fate, "Saber / Souji Okita", "fgo_event", { tags: ["fate/grand order"] });
expectGroup(fate, "Fate / Grand Order -絶対魔獣戦線バビロニア- ギルガメッシュ キャストドール", "fgo_107");
expectGroup(fate, "【東京】Fate / Grand Order×リアル脱出ゲーム「謎特異点 FINAL 無間冤罪地獄からの脱出」チケット", "fgo_events");
expectGroup(fate, "Fate / Grand Order Original Soundtrack Ⅲ", "fgo_media");
expectGroup(fate, "ランダムマグネット（全9種）", "fgo_fes", { gallery_image_urls: ["https://online.aniplex.co.jp/x/items/title-H/fgo/fgofes2024/01.jpg"] });
expectGroup(fate, "Fate/Accel Zero Order キャンペーン ネロ・クラウディウス", "fgo_102");
expectGroup(fate, "劇場版「Fate/stay night [Heaven's Feel]」 B2タペストリー", "stay_night");
expectGroup(fate, "「衛宮さんちの今日のごはん」TAaイラスト B2タペストリー〈セイバー・遠坂凛〉", "stay_night", { gallery_image_urls: ["https://online.aniplex.co.jp/x/items/title-H/fgo/fgofes2021_kadokawa/01.jpg"] });
expectGroup(fate, "ねんどろいど セイバー 私服Ver.", "stay_night");
expectGroup(fate, "キューポッシュ アヴェンジャー/ジャンヌ・ダルク〔オルタ〕", "fgo_101");
expectGroup(fate, "POP UP PARADE Hisui", "tsukihime", { tags: ["type-moon"] });
expectGroup(fate, "Fate/strange Fake アクリルスタンド", "strange_fake");
expectGroup(fate, "SDミニアクリルマスコット（全13種）", "fate_general");

// Pokémon: species → generation, regional forms, games/regions, multi-generation, none.
const pokemon = pokemonClassifier(taxonomy.pokemon).classify;
expectGroup(pokemon, "ポケモンセンター ぬいぐるみ ピカチュウ", "gen1");
expectGroup(pokemon, "포켓몬센터 봉제인형 ポケモン fit 턱지충이", "gen7");
expectGroup(pokemon, "ロコン（アローラのすがた） ぬいぐるみ", "gen7");
expectGroup(pokemon, "ポケプラ No.47 ゲッコウガ", "gen6");
expectGroup(pokemon, "ポケットモンスター スカーレット・バイオレット アクリルスイング", "gen9");
expectGroup(pokemon, "ポケットモンスター もふぐっとぬいぐるみ～ミュウ・サケブシッポ～", "pokemon_general");
expectGroup(pokemon, "ポケットモンスター ポケモンラバーマスコット12", "pokemon_common");
expectGroup(pokemon, "figma Marnie", "gen8");
expectGroup(pokemon, "포켓몬 스토어 Lucky for you 마스킹 스티커", "pokemon_common");

// Armored Core: title first, then machines / corporations of one era.
const ac = armoredCoreClassifier().classify;
expectGroup(ac, "30MM ARMORED CORE VI FIRES OF RUBICON BALAM INDUSTRIES BD-011 MELANDER", "ac6");
expectGroup(ac, "ラインアーク ホワイト・グリント＆V.O.Bセット", "ac4");
expectGroup(ac, "ナインボール ARMORED CORE Ver.", "ac1");
expectGroup(ac, "KT-104 / PERUN ハングドマン 再戦ver.", "acv");
expectGroup(ac, "ミラージュ C01-GAEA レッドメタルVer.", "ac3");

// Generated file: shape the app reads, no empty groups, every kit in exactly one group.
for (const franchise of ["pokemon", "fate", "armored_core"]) {
  const list = groups.franchises[franchise];
  assert.ok(Array.isArray(list) && list.length, `${franchise} groups`);
  const seen = new Set();
  for (const g of list) {
    assert.ok(g.id && g.labels?.ko && g.labels?.ja && g.labels?.en && g.labels?.zh, `${franchise}/${g.id} labels`);
    assert.ok(Array.isArray(g.kit_ids) && g.kit_ids.length === g.count && g.count > 0, `${franchise}/${g.id} kit_ids`);
    assert.ok(g.image, `${franchise}/${g.id} image`);
    for (const id of g.kit_ids) {
      assert.ok(!seen.has(id), `${id} in two ${franchise} groups`);
      seen.add(id);
    }
    checks++;
  }
}
for (const channel of ["gundam", "beyblade", "pokemon", "fate", "armored_core"]) {
  assert.ok(groups.channels?.[channel]?.image, `channel ${channel} image`);
  checks++;
}
const fateGroups = groups.franchises.fate;
const total = fateGroups.reduce((n, g) => n + g.count, 0);
const unsorted = fateGroups.find((g) => g.id === "fate_general")?.count || 0;
assert.ok(unsorted / total <= 0.1, `Fate catch-all ${unsorted}/${total} is over 10%`);
checks++;

console.log(`atlas groups: ${checks} checks passed`);
