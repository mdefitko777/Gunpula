// Checks for the Atlas group classifiers (scripts/atlas/lib/atlas_groups.mjs) against the
// committed rosters. Run: node scripts/atlas/test_atlas_groups.mjs
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { armoredCoreClassifier, fateClassifier, pokemonClassifier } from "./lib/atlas_groups.mjs";
import { LINE_COVER_GAPS, LINE_COVER_KINDS, LINE_COVER_SOURCES, OFFICIAL_LINE_HOSTS, parseRobots, pickLineImage, robotsAllows } from "./lib/line_covers.mjs";
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
// Mega form named in Japanese and Korean: one Pokémon, the form's generation
expectGroup(pokemon, "ポケモンプラモコレクション 61 セレクトシリーズ メガレックウザ", "gen6", {
  names: { ja: "ポケモンプラモコレクション 61 セレクトシリーズ メガレックウザ", ko: "포켓몬 프라모 컬렉션 61 셀렉트 시리즈 메가레쿠쟈" },
});
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

// Product-line covers: picking from static HTML and robots.txt rules (no network).
const page = "https://example.jp/brand/";
const html = `<meta property="og:image" content="/og.png">
  <img src="/categories/1.jpeg" alt="HG"/><img src="/categories/5.jpeg" alt="HGUC"/>
  <img src="/categories/232.jpeg" alt="メガサイズモデル"/>
  <img class="lazy" data-original="/img/ac_logo.png" alt="">
  <img src="_image/pict17.png" srcset="_image/pict17.png 1x,_image/pict17@2x.png 2x" alt="BX">`;
assert.equal(pickLineImage(html, page, { img: { alt: "HG" } }), "https://example.jp/categories/1.jpeg");
assert.equal(pickLineImage(html, page, { img: { alt: "メガサイズモデル" } }), "https://example.jp/categories/232.jpeg");
assert.equal(pickLineImage(html, page, { img: { src: "ac_logo.png" } }), "https://example.jp/img/ac_logo.png");
assert.equal(pickLineImage(html, page, { img: { alt: "BX" } }), "https://example.jp/brand/_image/pict17@2x.png");
assert.equal(pickLineImage(html, page, { og: true }), "https://example.jp/og.png");
assert.equal(pickLineImage(html, page, { img: { alt: "RG" } }), "");
const robots = parseRobots("User-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nDisallow: /common/\nAllow: /common/ok/\nDisallow: /*.json$\n");
assert.equal(robotsAllows(robots, "/candy/gundam/"), true);
assert.equal(robotsAllows(robots, "/common/x.png"), false);
assert.equal(robotsAllows(robots, "/common/ok/x.png"), true);
assert.equal(robotsAllows(robots, "/a/products.json"), false);
assert.equal(robotsAllows(parseRobots("User-agent: HobbyAtlasDataBot\nDisallow: /x/\n\nUser-agent: *\nDisallow: /\n"), "/y"), true);
assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow:\n"), "/anything"), true);
checks += 12;

// Product-line covers in the generated file: shape, official sources, files present and small,
// every code a real line of that franchise, and in step with the curated list.
const gradesDoc = await json("data/grades.json");
const grades = new Set((gradesDoc.grades || gradesDoc).map((g) => g.code));
const codesByFranchise = {};
for (const franchise of ["gundam", "armored_core", "pokemon", "fate", "beyblade"]) {
  const split = await json(`data/split/kits-${franchise}.json`);
  codesByFranchise[franchise] = new Set((split.kits || []).map((k) => k.grade_code));
}
const BBX_LINES = new Set(["BX", "UX", "CX"]);
const lineCovers = groups.line_covers;
assert.ok(lineCovers && typeof lineCovers === "object", "line_covers map");
const seenLines = new Set();
for (const [franchise, byCode] of Object.entries(lineCovers)) {
  assert.ok(codesByFranchise[franchise], `line_covers franchise ${franchise}`);
  for (const [code, c] of Object.entries(byCode)) {
    const where = `line_covers.${franchise}.${code}`;
    seenLines.add(`${franchise}:${code}`);
    assert.deepEqual(Object.keys(c).sort(), ["cover_source", "image", "image_remote", "kind"], `${where} keys`);
    if (franchise === "beyblade") assert.ok(BBX_LINES.has(code), `${where}: BEYBLADE X lines are BX / UX / CX`);
    else {
      assert.ok(grades.has(code), `${where}: not a grade code in data/grades.json`);
      for (const [other, codes] of Object.entries(codesByFranchise)) assert.ok(other === franchise || !codes.has(code), `${where}: code belongs to ${other}`);
    }
    assert.ok(LINE_COVER_KINDS.has(c.kind), `${where} kind ${c.kind}`);
    assert.match(c.image, new RegExp(`^\\./assets/atlas/covers/line-${franchise}-[a-z0-9_]+\\.(png|jpg)$`), `${where} image path`);
    const file = new URL(`../../app/${c.image.slice(2)}`, import.meta.url);
    assert.ok(existsSync(file), `${where}: ${c.image} missing`);
    assert.ok(statSync(file).size <= 100 * 1024, `${where}: ${c.image} is over 100 KB`);
    assert.ok(OFFICIAL_LINE_HOSTS.has(new URL(c.image_remote).host), `${where}: image_remote host`);
    assert.ok(OFFICIAL_LINE_HOSTS.has(new URL(c.cover_source).host), `${where}: cover_source host`);
    assert.ok(LINE_COVER_SOURCES[`${franchise}:${code}`], `${where} is not in LINE_COVER_SOURCES`);
    assert.ok(!LINE_COVER_GAPS[`${franchise}:${code}`], `${where} is also listed as a gap`);
    checks++;
  }
}
for (const key of Object.keys(LINE_COVER_SOURCES)) assert.ok(!LINE_COVER_GAPS[key], `${key} both curated and a gap`);
assert.ok(seenLines.size >= 30, `only ${seenLines.size} line covers`);
for (const line of ["gundam:HG", "gundam:MG", "gundam:RG", "gundam:PG", "gundam:METAL_BUILD", "gundam:ROBOT_SPIRITS", "beyblade:BX", "beyblade:UX", "beyblade:CX", "pokemon:POKE_MONCOLLE"]) {
  assert.ok(seenLines.has(line), `line cover ${line} missing`);
}
checks += 2;

console.log(`atlas groups: ${checks} checks passed`);
