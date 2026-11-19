// Checks for the Atlas group classifiers (scripts/atlas/lib/atlas_groups.mjs) against the
// committed rosters. Run: node scripts/atlas/test_atlas_groups.mjs
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { armoredCoreClassifier, fateClassifier, madokaClassifier, pokemonClassifier } from "./lib/atlas_groups.mjs";
import { APP_DERIVED_CODES, isAllowedLineHost, LINE_COVER_GAPS, LINE_COVER_KINDS, LINE_COVER_SOURCES, LINE_ICON_KINDS, LINE_ICONS, OFFICIAL_LINE_HOSTS, parseRobots, pickLineImage, robotsAllows, WIKIMEDIA_HOSTS } from "./lib/line_covers.mjs";
import { buildMatcher, compactKey } from "./lib/textmatch.mjs";
import { FATE_WORKS } from "./fate_works.mjs";

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
// Aniplex+ event goods: the event folder (/items/event/<event>/fgo/…) or the booth file name
// ("…/C100/notes/C100notes5_fgo_600.jpg") says FGO, so they are FGO event goods.
const cachedFrom = (path) => ({ images: { box_art_url: "./assets/catalog/fate/x.jpg", cached_from: [`https://online.aniplex.co.jp/on/demandware.static/-/Sites-all-master-catalog/ja_JP/dw0/items/event/${path}`] } });
expectGroup(fate, "AnimeJapan2023 SDミニアクリルマスコット（全13種）", "fgo_events", cachedFrom("aj2023/fgo/fgo_SDac00_600.jpg"));
expectGroup(fate, "AGF2021 ダンミル描き下ろしメモリアルイラスト キャラファイングラフ", "fgo_events", cachedFrom("agf2021/fgo/cfg_600.jpg"));
expectGroup(fate, "【復刻】コン もちもちスクイーズマスコット（全3種ランダム）", "fgo_events", cachedFrom("kyomaf2022/FGO/kon1_600.jpg"));
expectGroup(fate, "C100 アクリルパネル -ピエタ-", "fgo_events", cachedFrom("C100/notes/C100notes5_fgo_600.jpg"));
// a booth file without "fgo" in its name says nothing; a named work still wins over the folder
expectGroup(fate, "C100 アクリルパネル", "fate_general", cachedFrom("C100/notes/C100notes4_tsukihime_600.jpg"));
expectGroup(fate, "Fate / strange Fake アクリルスタンド", "strange_fake", cachedFrom("aj2026/fake/acst.jpg"));

// 魔法少女まどか☆マギカ: one group per character; Bebe / the Sweets Witch are Nagisa.
const madoka = madokaClassifier().classify;
expectGroup(madoka, "叛逆の物語 Magiccraft HQぬいぐるみ べべ", "nagisa");
expectGroup(madoka, "お菓子の魔女BIGぬいぐるみ", "nagisa");
expectGroup(madoka, "Fluffy Puffy～キュゥべえ＆べべ～", "madoka_ensemble");
expectGroup(madoka, "スーパーDXぬいぐるみ～キュゥべえ＆お菓子の魔女～", "madoka_ensemble");
expectGroup(madoka, "劇場版 魔法少女まどか☆マギカ キュゥべえ ぬいぐるみ", "kyubey");

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
// Lazy-loaded images: the file is only in data-srcset (pokemon.co.jp) or data-pc (nintendo.com)
const lazy = `<img class="lazyload" data-srcset="/ss/logo_main01.png, /ss/logo_main01@2x.png 2x" alt="ソード シールド">
  <img data-njs="image" data-pc="top/img/top/logo.png" data-sp="top/img/top/logo-sp.png" alt="">`;
assert.equal(pickLineImage(lazy, page, { img: { alt: "ソード シールド" } }), "https://example.jp/ss/logo_main01@2x.png");
assert.equal(pickLineImage(lazy, page, { img: { src: "top/logo.png" } }), "https://example.jp/brand/top/img/top/logo.png");
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
const gradeList = gradesDoc.grades || gradesDoc;
const grades = new Set(gradeList.map((g) => g.code));
const codesByFranchise = {};
for (const franchise of ["gundam", "armored_core", "pokemon", "fate", "beyblade", "madoka", "nintendo", "effects", "lego"]) {
  const split = await json(`data/split/kits-${franchise}.json`);
  codesByFranchise[franchise] = new Set((split.kits || []).map((k) => k.grade_code));
}
const BBX_LINES = new Set(["BX", "UX", "CX"]);
// Grade codes two channels share on purpose (Good Smile's Nendoroid is one line in Fate and Madoka).
const SHARED_CODES = new Set(["NENDOROID"]);
const lineCovers = groups.line_covers;
assert.ok(lineCovers && typeof lineCovers === "object", "line_covers map");
const seenLines = new Set();
for (const [franchise, byCode] of Object.entries(lineCovers)) {
  assert.ok(codesByFranchise[franchise], `line_covers franchise ${franchise}`);
  for (const [code, c] of Object.entries(byCode)) {
    const where = `line_covers.${franchise}.${code}`;
    seenLines.add(`${franchise}:${code}`);
    // The app reads line_covers.<channel>.<code>.image; the rest is extra (old apps ignore it).
    assert.equal(typeof c.image, "string", `${where}.image is a path string`);
    for (const key of Object.keys(c)) assert.ok(["cover_source", "image", "image_remote", "kind", "width", "height"].includes(key), `${where} key ${key}`);
    if (c.width !== undefined) assert.ok(Number.isInteger(c.width) && Number.isInteger(c.height) && c.width > 0 && c.height > 0, `${where} size`);
    if (franchise === "beyblade") assert.ok(BBX_LINES.has(code) || code === "BEYBLADE_X", `${where}: BEYBLADE X lines are BX / UX / CX`);
    else {
      assert.ok(grades.has(code), `${where}: not a grade code in data/grades.json`);
      for (const [other, codes] of Object.entries(codesByFranchise)) assert.ok(other === franchise || SHARED_CODES.has(code) || !codes.has(code), `${where}: code belongs to ${other}`);
    }
    assert.ok(LINE_COVER_KINDS.has(c.kind), `${where} kind ${c.kind}`);
    assert.match(c.image, new RegExp(`^\\./assets/atlas/covers/line-${franchise}-[a-z0-9_]+\\.(png|jpg)$`), `${where} image path`);
    const file = new URL(`../../app/${c.image.slice(2)}`, import.meta.url);
    assert.ok(existsSync(file), `${where}: ${c.image} missing`);
    assert.ok(statSync(file).size <= 100 * 1024, `${where}: ${c.image} is over 100 KB`);
    assert.ok(isAllowedLineHost(new URL(c.image_remote).host), `${where}: image_remote host`);
    assert.ok(isAllowedLineHost(new URL(c.cover_source).host), `${where}: cover_source host`);
    const source = LINE_COVER_SOURCES[`${franchise}:${code}`];
    assert.ok(source, `${where} is not in LINE_COVER_SOURCES`);
    // Wikimedia only when the maker's own site has no usable logo, and the entry says why.
    if (WIKIMEDIA_HOSTS.has(new URL(c.cover_source).host)) assert.ok(source.note, `${where}: Wikimedia source without a note`);
    assert.ok(!LINE_COVER_GAPS[`${franchise}:${code}`], `${where} is also listed as a gap`);
    assert.ok(!groups.line_icons?.[franchise]?.[code], `${where} is also a line icon`);
    checks++;
  }
}
for (const key of Object.keys(LINE_COVER_SOURCES)) {
  assert.ok(!LINE_COVER_GAPS[key], `${key} both curated and a gap`);
  assert.ok(!LINE_ICONS[key], `${key} both a logo and an icon`);
  assert.ok(OFFICIAL_LINE_HOSTS.has(new URL(LINE_COVER_SOURCES[key].page).host) || LINE_COVER_SOURCES[key].note, `${key}: non-official page without a note`);
}
for (const key of Object.keys(LINE_COVER_GAPS)) assert.ok(LINE_ICONS[key], `gap ${key} has no line icon`);
assert.ok(seenLines.size >= 40, `only ${seenLines.size} line covers`);
for (const line of ["gundam:HG", "gundam:MG", "gundam:RG", "gundam:PG", "gundam:METAL_BUILD", "gundam:ROBOT_SPIRITS", "beyblade:BX", "beyblade:UX", "beyblade:CX", "pokemon:POKE_MONCOLLE", "armored_core:AC30MM", "nintendo:NIN_AMIIBO", "effects:TAMASHII_EFFECT", "fate:NENDOROID"]) {
  assert.ok(seenLines.has(line), `line cover ${line} missing`);
}
checks += 2;

// Line icons: fixed vocabulary; every grade code with kits is a logo or an icon, never both and
// never neither (owner's decision 2026-11-19: no product photos in the 종류 grid).
const lineIcons = groups.line_icons;
assert.ok(lineIcons && typeof lineIcons === "object", "line_icons map");
for (const [key, kind] of Object.entries(LINE_ICONS)) assert.ok(LINE_ICON_KINDS.has(kind), `${key}: icon kind ${kind}`);
for (const [franchise, byCode] of Object.entries(lineIcons)) {
  for (const [code, kind] of Object.entries(byCode)) {
    assert.ok(LINE_ICON_KINDS.has(kind), `line_icons.${franchise}.${code} = ${kind}`);
    assert.ok(codesByFranchise[franchise]?.has(code) || APP_DERIVED_CODES.has(`${franchise}:${code}`), `line_icons.${franchise}.${code}: no such line`);
    checks++;
  }
}
for (const [franchise, codes] of Object.entries(codesByFranchise)) {
  for (const code of codes) {
    const logo = Boolean(lineCovers[franchise]?.[code]);
    const icon = Boolean(lineIcons[franchise]?.[code]);
    assert.ok(logo !== icon, `${franchise}:${code} is ${logo ? "both a logo and an icon" : "neither a logo nor an icon"}`);
    checks++;
  }
}
assert.equal(lineIcons.pokemon.POKE_PLUSH, "plush");
assert.equal(lineIcons.nintendo.NIN_GAME, "game");
assert.equal(lineIcons.gundam.NG, "plamo");
checks += 3;

// 세대 groups say whether their picture is a title logo; switched works point at a logo.
for (const [franchise, list] of Object.entries(groups.franchises)) {
  for (const g of list) assert.ok(["logo", "picture"].includes(g.cover_kind), `${franchise}/${g.id} cover_kind ${g.cover_kind}`);
}
const groupById = (franchise, id) => groups.franchises[franchise].find((g) => g.id === id);
for (const [franchise, id] of [["pokemon", "gen9"], ["fate", "apocrypha"], ["armored_core", "ac6"], ["nintendo", "nintendo_kirby"], ["lego", "lego_star_wars"]]) {
  assert.equal(groupById(franchise, id)?.cover_kind, "logo", `${franchise}/${id} should show its title logo`);
  checks++;
}

// Every grade has a Korean line name; the Nintendo plush / prize / plamo lines share the
// category of the Fate / Madoka / Pokémon lines of the same kind (the app names those by name_ko).
for (const g of gradeList) assert.ok(String(g.name_ko || "").trim(), `grade ${g.code} without name_ko`);
for (const g of gradeList) assert.ok(!/\?\?/.test(JSON.stringify([g.name_zh, g.name_ko, g.aliases])), `grade ${g.code} has "??" (wrong encoding)`);
const category = (code) => gradeList.find((g) => g.code === code)?.category;
assert.equal(category("NIN_PLUSH"), category("MADOKA_PLUSH"));
assert.equal(category("NIN_PRIZE"), category("POKE_PRIZE"));
assert.equal(category("NIN_PLAMO"), category("POKEPLA"));
checks += 3;

// Official Simplified title (B站《埃尔梅罗二世事件簿》), not 埃尔梅罗伊
{
  const work = FATE_WORKS.find((w) => w.id === "el_melloi");
  assert.equal(work.labels.zh, "君主·埃尔梅罗二世事件簿");
  assert.equal(work.chars[0][2], "埃尔梅罗二世");
  checks += 2;
}

// Chinese labels (second check 2026-11-11): LEGO themes from data/lego/theme-labels-zh.json,
// BEYBLADE X team subtitles from data/atlas/atlas-zh-overrides.json, never the Japanese
{
  const lego = groups.franchises.lego;
  assert.equal(lego.find((g) => g.labels.en === "Star Wars")?.labels.zh, "星球大战");
  assert.equal(lego.find((g) => g.labels.en === "Ninjago")?.labels.zh, "幻影忍者");
  const kana = /[぀-ヿ]/;
  for (const g of groups.franchises.beyblade) assert.ok(!kana.test(g.subtitle?.zh || ""), `${g.id}: ${g.subtitle?.zh}`);
  assert.equal(groups.franchises.beyblade.find((g) => g.subtitle?.ja === "ゲームオリジナル（BEYBLADE X XONE）")?.subtitle.zh, "游戏原创（BEYBLADE X XONE）");
  checks += 4;
}

console.log(`atlas groups: ${checks} checks passed`);
