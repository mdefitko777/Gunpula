import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyZhNames } from "./apply_zh_names.mjs";
import { exactGlossaryName, loadGlossary, searchAliases, translateName } from "./lib/zh-names.mjs";
import { addSimplifiedNames, convertByChars, learnCharMap, loadPokemonZh, titleZh } from "./atlas/pokemon_zh_names.mjs";

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
