import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyZhNames } from "./apply_zh_names.mjs";
import { composedGlossaryName, exactGlossaryName, hasKana, loadGlossary, searchAliases, translateName } from "./lib/zh-names.mjs";
import { addSimplifiedNames, convertByChars, jpSetZh, learnCharMap, loadPokemonZh, titleZh } from "./atlas/pokemon_zh_names.mjs";
import { productSpelling } from "./atlas/build_gundam_ms.mjs";

const glossary = {
  kata: new Map([
    ["ガンダム", "高达"],
    ["サザビー", "沙扎比"],
    ["ジン", "吉恩"],
    ["ストライク", "强袭"],
    ["フリーダム", "自由"],
  ]),
  other: new Map([
    ["限定", "限定"],
    ["ぬいぐるみ", "毛绒玩偶"],
  ]),
  aliases: new Map([["サザビー", ["沙煲"]]]),
  maxOther: 5,
  maxKata: 6,
};

{
  const r = translateName("RG 1/144 サザビー", glossary);
  assert.equal(r.zh, "RG 1/144 沙扎比");
  assert.ok(r.complete);
  assert.deepEqual(searchAliases(r.matched, glossary), ["沙煲"]);
}
{
  // a katakana run is translated only when the glossary covers all of it
  const r = translateName("HG オリジン ジン", glossary);
  assert.equal(r.zh, "HG オリジン 吉恩");
  assert.equal(r.complete, false);
}
{
  const r = translateName("ストライクフリーダムガンダム【限定】", glossary);
  assert.equal(r.zh, "强袭自由高达【限定】");
  const dotted = translateName("ストライク・フリーダム", glossary);
  assert.equal(dotted.zh, "强袭·自由");
}
{
  // spaces around a glossary word are kept; full-width folds
  assert.equal(translateName("ＨＧ ぬいぐるみ サザビー", glossary).zh, "HG 毛绒玩偶 沙扎比");
}
{
  const kits = [
    { kit_id: "a", franchise: "gundam", names: { ja: "RG 1/144 サザビー", ko: "RG 사자비" } },
    { kit_id: "b", franchise: "gundam", names: { ja: "HG オリジン" } },
    { kit_id: "c", franchise: "gundam", names: { ja: "HG オリジン" } },
    { kit_id: "d", franchise: "lego", names: { en: "Millennium Falcon", zh: "Millennium Falcon" } },
  ];
  const curated = { c: { src: "HG オリジン", zh: "HG 起源" } };
  const { pending, fromCurated } = applyZhNames(kits, curated, () => glossary);
  assert.equal(kits[0].names.zh, "RG 1/144 沙扎比");
  assert.deepEqual(kits[0].search_zh, ["沙煲"]);
  assert.equal(kits[0].names.ko, "RG 사자비", "other languages untouched");
  assert.equal(kits[2].names.zh, "HG 起源");
  assert.equal(fromCurated, 1);
  assert.deepEqual(Object.keys(pending), ["b"]);
  assert.equal(kits[3].names.zh, "Millennium Falcon", "LEGO keeps its name");
}
// Gundam MS guide (scripts/atlas/build_gundam_ms.mjs): the glossary's whole-name entry, never a composition
{
  assert.equal(exactGlossaryName(glossary, "サザビー"), "沙扎比");
  assert.equal(exactGlossaryName(glossary, "ストライクフリーダム"), null, "parts are not composed into a name");
  assert.equal(exactGlossaryName(glossary, null, "ガンダム"), "高达", "the next Japanese name is tried");
  const gundam = loadGlossary("gundam");
  assert.equal(exactGlossaryName(gundam, "キュベレイ"), "京宝梵", "official product name, not G Gen's 卡碧尼");
  assert.match(exactGlossaryName(gundam, "ザクII"), /^扎古/, "扎古, not G Gen's 渣古");
}

// Glossary fallback agrees with the curated names (Chinese names quality check 2026-11-11, section B)
{
  const gundam = loadGlossary("gundam");
  const zhOf = (name, g = gundam) => translateName(name, g).zh;
  assert.equal(zhOf("HG 1 / 144 高機動型ザク “サイコ・ザク”"), "HG 1 / 144 高机动型扎古 “精神感应扎古”", "サイコ = 精神感应, as サイコガンダム");
  assert.equal(zhOf("RG 1 / 144 ガンダムエクシア エクストラフィニッシュVer."), "RG 1 / 144 能天使高达 特别处理Ver.", "not 特别处理版Ver.");
  assert.equal(zhOf("MG 1 / 100 ギャン エクストラフィニッシュバージョン"), "MG 1 / 100 强人 特别处理Ver.");
  assert.equal(zhOf("PG 1 / 60 ガンダムカスタムセット#1"), "PG 1 / 60 高达改装套装#1", "a custom set is not a 特装型 suit");
  assert.equal(zhOf("ジムカスタム"), "吉姆特装型");
  assert.equal(zhOf("30MM オプションパーツセット WEAPON SET 01", loadGlossary("armored_core")), "30MM 配件包 WEAPON SET 01");
  assert.equal(zhOf("コレキャラ！ ポケモン4", loadGlossary("pokemon")), "COLLE CHARA! 宝可梦4");
  assert.equal(translateName("ABC Ver. Ver.", glossary).zh, "ABC Ver.", "a doubled Ver. collapses");
  assert.equal(translateName("ABC Ver. Ver.2.0", glossary).zh, "ABC Ver. Ver.2.0", "a version number after it is not eaten");
  const curated = JSON.parse(readFileSync("data/i18n/names-zh.json", "utf8")).names;
  const ef = Object.values(curated).filter((e) => /エクストラフィニッシュ/.test(e.src));
  assert.ok(ef.length >= 18 && ef.every((e) => e.zh.includes("特别处理Ver.") && !/特别处理版/.test(e.zh)), "one rendering of エクストラフィニッシュ");
  assert.ok(!Object.values(curated).some((e) => /精神力扎古|挂件 钥匙圈|COLLE CHARA 迷你公仔！|^30MM 配件套组/.test(e.zh)));
}

// Second check 2026-11-11: glossary words that start with katakana, aliases of the terms inside a
// matched term, HTML entities, ・, 版Ver., English Nendoroid names
{
  const gundam = loadGlossary("gundam");
  const fate = loadGlossary("fate");
  const run = (name, g = gundam) => {
    const r = translateName(name, g);
    return { ...r, words: searchAliases(r.matched, g, r.inner) };
  };
  const char = run("HG 1/144 シャア専用ザク(GQ)");
  assert.equal(char.zh, "HG 1/144 夏亚专用扎古(GQ)");
  assert.deepEqual(char.matched, ["シャア専用ザク"], "the whole term, not シャア + 専用 + ザク");
  assert.ok(char.words.includes("红扎") && char.words.includes("渣古"), "its own nickname and ザク's other spelling");
  assert.ok(!char.words.includes("绿扎"), "绿扎 is the green mass-produced ザク only");
  const mp = run("MG 1/100 量産型ザク Ver.2.0");
  assert.ok(mp.words.includes("绿扎") && mp.words.includes("渣古"));
  assert.ok(run("HGUC 量産型ザクII").words.includes("扎古2"), "ザクII inside 量産型ザクII");
  // the plain green ザクII keeps 绿扎 (lost by 107 kits in the first pass of this fix); custom ones do not
  assert.ok(run("HG 1/144 ザクII").words.includes("绿扎"));
  assert.ok(!run("HGUC MS-06S シャア専用ザクII").words.includes("绿扎"));
  assert.ok(run("HGUC ガンダムMk-II(エゥーゴ仕様)").words.includes("马克兔"));
  assert.ok(!run("HGUC ガンダムMk-III").matched.includes("ガンダムmk-ii"), "Mk-II is not cut out of Mk-III");
  assert.equal(run("量産型ザクレロ").zh, "量产型扎古雷罗", "量産型ザク does not end inside ザクレロ");
  assert.ok(run("HGUC キュベレイ").words.includes("卡碧尼"));
  for (const name of ["RG ユニコーンガンダム2号機 バンシィ・ノルン", "RG ユニコーンガンダム3号機 フェネクス", "HGUC ユニコーンガンダム 2号機バンシィ(デストロイモード)"]) {
    assert.ok(!run(name).words.includes("白独角兽"), `${name}: unit 1's nickname`);
  }
  assert.ok(run("RG ユニコーンガンダム").words.includes("白独角兽"));
  assert.ok(run("HG 1 / 144 ザク・ハーフキャノン").words.includes("渣古"), "a word the ・ sets apart");
  assert.ok(!run("HGUC ガンダムエクシア").words.includes("钢弹"), "ガンダム's spellings stay on ガンダム");

  const alter = run("アヴェンジャー / ジャンヌ・ダルク〔オルタ〕 私服ver.", fate);
  assert.equal(alter.zh, "Avenger / 贞德〔Alter〕 便服ver.");
  assert.ok(alter.words.includes("黑贞") && !alter.words.includes("白贞"), "Jeanne Alter is not the Ruler");
  assert.ok(run("ルーラー / ジャンヌ・ダルク", fate).words.includes("白贞"));

  // a word may end inside a katakana or hiragana run only before more glossary words
  assert.equal(run("Fate / Grand Order ムーンキャンサー / 玉兎 1 / 7スケールフィギュア", fate).zh, "Fate / Grand Order MoonCancer / 玉兔 1/7比例手办");
  assert.equal(run("【事後通販限定】ミニぬいぐるみ（全15種）", fate).zh.includes("ぐるみ"), false, "not ミニぬい + ぐるみ");
  assert.equal(run("SDEXスタンダード009 デスティニーガンダム").zh, "SDEX-STANDARD009 命运高达");

  // a glossary 版 before the source's own Ver.; the source's own 版 stays
  assert.equal(run("ＲＧ 1 / 144 トランザムライザー グロスインジェクションＶｅｒ．").zh, "RG 1 / 144 TRANS-AM强化模组 光泽注塑Ver.");
  assert.equal(run("MG 1/100 パーフェクトストライクガンダム スペシャルコーティングVer.").zh, "MG 1/100 完美强袭高达 特别涂层Ver.");
  assert.equal(run("MG ガンダム グロスインジェクション Ver.2.0").zh, "MG 高达 光泽注塑版 Ver.2.0");
  assert.equal(run("美樹さやか 劇場版ver.", loadGlossary("madoka")).zh, "美树沙耶香 劇場版ver.");

  // HTML entities and the katakana middle dot
  const pokemon = loadGlossary("pokemon");
  const koko = run("785 ぬいぐるみ Pok&eacute;mon fit カプ・コケコ", pokemon);
  assert.equal(koko.zh, "785 毛绒玩偶 Pokémon fit 卡璞·鸣鸣");
  assert.ok(koko.complete);
  assert.equal(hasKana("卡璞・鸣鸣"), false, "・ separates words, it is not kana left over");
  assert.equal(hasKana("卡璞・コケコ"), true);

  // goodsmile.com's English line names
  assert.equal(run("Nendoroid Doll Saber: Casual Outfit Ver.", fate).zh, "粘土人Doll Saber: Casual Outfit Ver.");
  assert.equal(run("Nendoroid Surprise Fate / stay night", fate).zh, "粘土人Surprise Fate / stay night");
  assert.equal(run("XNendoroid", fate).zh, "XNendoroid", "a Latin key is a whole word");
  const kits = [
    { kit_id: "n1", franchise: "fate", grade_code: "NENDOROID", names: { ja: "Nendoroid Rin Tohsaka" } },
    { kit_id: "n2", franchise: "fate", grade_code: "NENDOROID", names: { ja: "Rin Tohsaka Face Parts" } },
  ];
  applyZhNames(kits, {}, (franchise) => loadGlossary(franchise));
  assert.equal(kits[0].names.zh, "粘土人 Rin Tohsaka");
  assert.ok(kits[1].search_zh.includes("粘土人"), "a Nendoroid product answers 粘土人 whatever its name says");
  const curated = JSON.parse(readFileSync("data/i18n/names-zh.json", "utf8")).names;
  assert.ok(!Object.values(curated).some((e) => /\bNendoroid\b/.test(e.zh)), "curated names say 粘土人");
  // curated names match the decoded source name, and the new Pokémon Center fit plush has one
  const withEntity = [{ kit_id: "pokemon-center-4521329427874", franchise: "pokemon", names: { ja: "785 ぬいぐるみ Pok&eacute;mon fit カプ・コケコ" } }];
  applyZhNames(withEntity, curated, () => pokemon);
  assert.equal(withEntity[0].names.zh, "785 毛绒玩偶 宝可梦 fit 卡璞·鸣鸣");
}

// Gundam MS guide: a derived MS gets the word-by-word name its kits carry; GGET's spelling else
{
  const gundam = loadGlossary("gundam");
  assert.equal(composedGlossaryName(gundam, "シャア専用ザクI"), "夏亚专用扎古I");
  assert.equal(composedGlossaryName(gundam, "量産型キュベレイ"), "量产型京宝梵");
  assert.equal(composedGlossaryName(gundam, "AEUイナクト指揮官型"), null, "指揮官型 would stay Japanese");
  assert.equal(composedGlossaryName(gundam, "Ex-S"), null, "no glossary word: nothing composed");
  assert.equal(productSpelling("渣古IIF2型"), "扎古IIF2型");
  assert.equal(productSpelling("咒术士卡碧尼"), "咒术士京宝梵");
  assert.equal(productSpelling("高达"), null);
  const ms = JSON.parse(readFileSync("data/atlas/gundam-ms.json", "utf8")).ms;
  assert.ok(!ms.some((m) => /渣古|卡碧尼/.test(m.names.zh || "")), "MS names use the product spelling");
  assert.deepEqual(ms.find((m) => m.names.ja === "シャア専用ザクI")?.name_aliases, { zh: ["夏亚专用渣古I"] }, "GGET's name stays searchable");
}

// MEZASTAR Japan sets: no zh_hant to convert, a Chinese title per series
{
  assert.equal(jpSetZh({ id: "mz-jp:supertag-1", series: "supertag", names: { ja: "スーパータッグ1弾" } }), "超级搭档第1弹");
  assert.equal(jpSetZh({ id: "mz-jp:gorgeousstar-5", series: "gorgeousstar", names: { ja: "ゴージャススター5弾" } }), "华丽之星第5弹");
  assert.equal(jpSetZh({ id: "mz-jp:base-2", series: "base", names: { ja: "2弾" } }), "第2弹");
  assert.equal(jpSetZh({ id: "mz-intl:stardust-1", series: "stardust", names: { en: "Stardust Version 1" } }), null);
  const jp = JSON.parse(readFileSync("data/atlas/mezastar-jp.json", "utf8"));
  assert.ok(jp.sets.every((set) => set.names.zh && !hasKana(set.names.zh)), "every Japanese set has a Chinese title");
}

// Pokémon tag / pick atlases: names.zh (Simplified) next to the sources' zh_hant (data/i18n/zh/pokemon.json)
{
  const ctx = loadPokemonZh();
  const doc = {
    edition: { name: { ja: "ポケモンメザスタ（海外版）", zh_hant: "寶可夢MEZASTAR" } },
    sets: [{ id: "mz-intl:stardust-1", names: { en: "Stardust Version 1", zh_hant: "星塵第1彈" } }],
    tags: [
      { id: "a", dex: 150, names: { ja: "ミュウツー", zh_hant: "超夢" } },
      { id: "b", dex: 38, names: { ja: "アローラキュウコン", zh_hant: "阿羅拉九尾" } },
      { id: "c", dex: 38, names: { ja: "アローラキュウコン", zh_hant: "九尾 (阿羅拉的樣子)" } },
      { id: "d", dex: 29, names: { ja: "ニドラン♀", zh_hant: "尼多蘭" } },
      { id: "e", dex: 892, names: { ja: "ウーラオス", zh_hant: "武道熊師(一擊流)" } },
      { id: "f", dex: 25, ja: "キャプテンピカチュウ", names: { zh_hant: "隊長皮卡丘" } },
      { id: "g", dex: 1017, names: { ja: "オーガポン", zh_hant: "厄鬼椪" } },
      { id: "h", dex: 6, names: { ja: "メガリザードンY", zh_hant: "超級噴火龍Ｙ" } },
      { id: "i", dex: 720, names: { ja: "フーパ", zh_hant: "解放胡帕" } },
    ],
  };
  const { missing } = addSimplifiedNames(doc, ctx);
  const zh = Object.fromEntries(doc.tags.map((t) => [t.id, t.names.zh]));
  assert.equal(doc.edition.name.zh, "宝可梦MEZASTAR");
  assert.equal(doc.sets[0].names.zh, "星尘第1弹");
  assert.equal(zh.a, "超梦");
  assert.equal(zh.b, "阿罗拉九尾");
  assert.equal(zh.c, "九尾 (阿罗拉的样子)", "the printed form is converted, not replaced by another wording");
  assert.equal(zh.d, "尼多兰", "the species by dex when the Japanese name is not in the glossary");
  assert.equal(zh.e, "武道熊师(一击流)", "a printed form the Japanese name leaves out is kept");
  assert.equal(zh.f, "队长皮卡丘", "隊長皮卡丘 is not shortened to the species");
  assert.equal(zh.g, "厄诡椪", "official Simplified name, not a character conversion");
  assert.equal(zh.h, "超级喷火龙Y");
  assert.equal(zh.i, undefined, "a printed name that matches nothing gets no guess");
  assert.deepEqual(missing, ["解放胡帕"]);
  assert.deepEqual(Object.keys(doc.tags[0].names), ["ja", "zh_hant", "zh"], "zh_hant is kept, zh follows it");
  assert.equal(titleZh("某某第1彈") , "某某第1弹");
  assert.equal(titleZh("寶可夢傳說"), null, "a Traditional character outside the map: no zh");
  assert.equal(convertByChars("九尾龍", learnCharMap([["九尾", "九尾"]])), null);
  // one species printed many times under an official name that is not a conversion teaches nothing
  const pangoro = Array(4).fill(["流氓熊貓", "霸道熊猫"]);
  assert.equal(convertByChars("武道熊師(連擊流)", learnCharMap([...pangoro, ["武道熊師", "武道熊师"], ["武道熊師(一擊流)", "武道熊师(一击流)"]], [["連擊流", "连击流"]])), "武道熊师(连击流)");
  assert.equal(convertByChars("夜盜", learnCharMap([["狐大盜", "猾大狐"], ["夜盜火蜥", "夜盗火蜥"]])), null, "one name each way: no guess");
  addSimplifiedNames(doc, ctx);
  assert.equal(doc.tags[0].names.zh, "超梦", "idempotent");
}
console.log("zh names: ok");

// Curated names survive a shop respelling the source (Pokémon Center: Pok&eacute;mon → ポケモン, 2026-11-11)
{
  const { sameSource } = await import("./lib/source-key.mjs");
  assert.ok(sameSource("424 ぬいぐるみ Pokémon fit エテボース", "424 ぬいぐるみ ポケモン fit エテボース"));
  assert.ok(sameSource("424 ぬいぐるみ Pok&eacute;mon fit エテボース", "424 ぬいぐるみ Pokémon fit エテボース"));
  assert.ok(sameSource("ＨＧ 1/144 ザク", "HG 1 / 144 ザク"));
  assert.ok(!sameSource("HG 1/144 ザク", "HG 1/144 ザクII"), "a real rename still counts");
  console.log("source key: ok");
}
