import assert from "node:assert/strict";
import { applyZhNames } from "./apply_zh_names.mjs";
import { searchAliases, translateName } from "./lib/zh-names.mjs";

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
console.log("zh names: ok");
