// Which products go on the Korean to-do list (data/i18n/names-ko-pending.json), scripts/apply_ko_names.mjs.
//   node scripts/test_ko_names.mjs
import assert from "node:assert/strict";
import { isPendingKorean, needsKorean } from "./apply_ko_names.mjs";

const storeRef = (sourceId) => [{ source_id: sourceId, fields: ["names", "images"] }];
const kit = (ko, extra = {}) => ({ kit_id: "x", franchise: "nintendo", names: { ja: ko, ko }, ...extra });

// ・ is punctuation, kana and kanji are not
assert.equal(needsKorean("포켓몬센터 봉제인형 미네랄사이다・리프레쉬 푸린"), false);
assert.equal(needsKorean("기동전사 건담 수성의 마녀 はぐキャラコレクション"), true);
assert.equal(needsKorean("HG 1/144 流星号(그레이즈改参)"), true);
assert.equal(needsKorean("기동전사 건담 ROBOT魂 미니어처 컬렉션"), false);
assert.equal(needsKorean(""), true);

// A Korean store's own English title is its Korean name
assert.equal(isPendingKorean(kit("Nintendo Switch Sports", { source_refs: storeRef("nintendo_store_kr") })), false);
assert.equal(isPendingKorean(kit("Pokémon LEGENDS Z-A", { source_refs: storeRef("nintendo_kr") })), false);
// … but not an English name from anywhere else, nor one the store did not name
assert.equal(isPendingKorean(kit("Nintendo Switch Sports")), true);
assert.equal(isPendingKorean(kit("Splatoon 2", { source_refs: [{ source_id: "nintendo_store_kr", fields: ["images"] }] })), true);
assert.equal(isPendingKorean(kit("Fire Station", { franchise: "lego" })), false);
assert.equal(isPendingKorean(kit("젤다의 전설 시간의 오카리나")), false);
console.log("ko names: ok");
