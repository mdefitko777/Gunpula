import assert from "node:assert/strict";
import { translateDisplayName } from "./lib/kana_ko_dict.mjs";
import { foldFullWidth, tidyKo, tidyKoNames } from "./lib/ko-tidy.mjs";

assert.equal(tidyKo("RG 1 / 144 아카츠키건담( 오오와시 장비)"), "RG 1/144 아카츠키건담(오오와시 장비)");
assert.equal(tidyKo("아카츠키（ 시라누이 장비 ） SEED FREEDOM Ver."), "아카츠키（시라누이 장비） SEED FREEDOM Ver.");
assert.equal(tidyKo("Fate / Grand Order 세이버 / 알트리아 펜드래곤 1 / 7 스케일 피규어"), "Fate/Grand Order 세이버 / 알트리아 펜드래곤 1/7 스케일 피규어");
assert.equal(tidyKo("【무료 배송 캠페인 대상】A4 클리어 파일 세트"), "A4 클리어 파일 세트");
assert.equal(tidyKo("【재판】치비 오베론 미니 봉제인형 참"), "치비 오베론 미니 봉제인형 참 (재판)");
assert.equal(tidyKo("페탓토 앉은 자세 피규어 ※재판"), "페탓토 앉은 자세 피규어 (재판)");
assert.equal(tidyKo("포켓몬센터 봉제인형 Pikachu&apos;s Sweet Delivery"), "포켓몬센터 봉제인형 Pikachu's Sweet Delivery");
// Run twice: same result
for (const name of ["치비 오베론 (재판)", "HG 1/144 레전드 건담 (2026년)", "A (재판) (2025년)"]) {
  assert.equal(tidyKo(tidyKo(name)), tidyKo(name));
}

// Look-alike names: the year tells them apart, only when the years differ
const kits = [
  { kit_id: "a", franchise: "gundam", grade_code: "HG", release_date: "2026-03", names: { ko: "HG 1 / 144 레전드 건담" } },
  { kit_id: "b", franchise: "gundam", grade_code: "HG", release_date: "2005-01", names: { ko: "HG 1/144 레전드 건담" } },
  { kit_id: "c", franchise: "gundam", grade_code: "MG", release_date: "2010", names: { ko: "HG 1/144 레전드 건담" } },
  { kit_id: "d", franchise: "pokemon", grade_code: "POKE_GOODS", release_date: "2025-01", names: { ko: "마스코트 이브이" } },
  { kit_id: "e", franchise: "pokemon", grade_code: "POKE_GOODS", release_date: "2025-06", names: { ko: "마스코트 이브이" } },
  { kit_id: "f", franchise: "lego", grade_code: "LEGO_SET", release_date: "2019", names: { ko: "Fire Station" } },
  { kit_id: "g", franchise: "lego", grade_code: "LEGO_SET", release_date: "2024", names: { ko: "Fire Station" } },
];
tidyKoNames(kits);
assert.deepEqual(
  kits.map((kit) => kit.names.ko),
  ["HG 1/144 레전드 건담 (2026년)", "HG 1/144 레전드 건담 (2005년)", "HG 1/144 레전드 건담", "마스코트 이브이", "마스코트 이브이", "Fire Station", "Fire Station"],
);
assert.equal(tidyKoNames(kits), 0, "second run changes nothing");
assert.equal(tidyKo("기동전사 건담 ROBOT魂 미니어처 컬렉션"), "기동전사 건담 ROBOT혼 미니어처 컬렉션");
assert.equal(tidyKo("超合金の塊 건담 시리즈"), "초합금 덩어리 건담 시리즈");
assert.equal(tidyKo("EXPO2025 超合金 RX-78F00 / E 건담"), "EXPO2025 초합금 RX-78F00 / E 건담");
// Full-width letters, digits and signs to half width (searchable); full-width brackets stay
assert.equal(tidyKo("ＭＧ 1 / 100 ν건담 ＨＷＳ Ｖｅｒ．Ｋａ"), "MG 1/100 ν건담 HWS Ver.Ka");
assert.equal(tidyKo("ＨＧ 1 / 144 제타건담［Ｕ.Ｃ.００８８］"), "HG 1/144 제타건담［U.C.0088］");
assert.equal(tidyKo("ＨＧ 1 / 144 건담Ｍｋ－ＩＩＩ"), "HG 1/144 건담Mk-III");
assert.equal(tidyKo("ＨＧ　１／１４４ 짐 ［재판］"), "HG 1/144 짐 (재판)");
assert.equal(foldFullWidth("Ｂ２ 태피스트리＜이리야＞【한정】「세이버」（재판）"), "B2 태피스트리＜이리야＞【한정】「세이버」（재판）");
assert.equal(tidyKo(tidyKo("ＲＧ １／１４４ Ｈｉ－ν")), "RG 1/144 Hi-ν");
// "／" takes the spaced form localize_catalog.mjs gives every slash, so a refresh does not flip it
assert.equal(tidyKo("퍼펙트 스트라이크건담／스트라이크 루즈"), "퍼펙트 스트라이크건담 / 스트라이크 루즈");

// V2アサルトバスター (Victory): the kana dictionary covers it
assert.equal(translateDisplayName("HGUC 1/144 V2アサルト버스터건담"), "HGUC 1/144 V2 어설트 버스터건담");
console.log("ko tidy: ok");
