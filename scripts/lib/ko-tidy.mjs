// Last touch on the Korean display names (names.ko), run by apply_ko_names.mjs
// after the dictionary and the curated names. Idempotent: running it again on
// its own output changes nothing.
//
//   * spaces just inside brackets:   "아카츠키건담( 오오와시 장비)" → "아카츠키건담(오오와시 장비)"
//   * scales and work titles:         "1 / 144" → "1/144", "Fate / Grand Order" → "Fate/Grand Order"
//   * shop campaign tags dropped:     "【무료 배송 캠페인 대상】…", "【무료 배송!】"
//   * reissue tags in one form:       "【재판】" · "※재판" · "（재판）" → "(재판)" at the end
//   * full-width letters, digits and signs: "ＭＧ Ｖｅｒ．Ｋａ ［Ｕ.Ｃ.００８８］" → "MG Ver.Ka ［U.C.0088］"
//     (the full-width brackets （）［］｛｝＜＞ stay: the names use them as CJK brackets)
//   * HTML entities left by a store:  "Pikachu&apos;s" → "Pikachu's"
//   * Bandai brand words left in kanji: "ROBOT魂" → "ROBOT혼", "超合金(の塊)" → "초합금 (덩어리)"
//   * same name, different products:  two records of one franchise and grade with the same
//     Korean name but different release years get the year: "HG 1/144 레전드 건담 (2026년)"
//     (not LEGO: the app puts the set number in front of every LEGO name)

import { decodeEntities } from "./html-entities.mjs";

// U+FF01–FF5E is ASCII 0x21–0x7E shifted by 0xFEE0; U+3000 is the ideographic space.
const FULL_WIDTH_ASCII = /[\uFF01-\uFF5E\u3000]/g;
const KEEP_FULL_WIDTH = new Set("（）［］｛｝＜＞");

/**
 * Full-width ASCII to half width (searchable as "ver.ka", "0088", "mk-iii"), full-width brackets kept.
 * "\uff0f" becomes " / ", the form localize_catalog.mjs gives every slash, so the next refresh keeps it.
 */
export function foldFullWidth(value) {
  return value.replace(FULL_WIDTH_ASCII, (ch) =>
    ch === "\u3000" ? " " : ch === "\uff0f" ? " / " : KEEP_FULL_WIDTH.has(ch) ? ch : String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

const REISSUE = /\s*(?:【재판】|［재판］|\[재판\]|（재판）|\(재판\)|※\s*재판)\s*/g;
const YEAR_SUFFIX = / \((?:19|20)\d{2}년\)$/;

/** One Korean name, on its own (no knowledge of other records; the year suffix is left to tidyKoNames). */
export function tidyKo(name) {
  // &nbsp; decodes to U+00A0; names keep a plain space, as before the shared table
  let ko = foldFullWidth(decodeEntities(String(name || "")).replace(/\u00a0/g, " ")).replace(YEAR_SUFFIX, "");
  ko = ko.replace(/【[^】]*(?:무료\s*배송|캠페인|送料無料)[^】]*】/g, " ");
  const reissue = ko.replace(REISSUE, " ") !== ko;
  ko = ko.replace(REISSUE, " ");
  ko = ko
    .replace(/([(（\[［【「『<〈])\s+/g, "$1")
    .replace(/\s+([)）\]］】」』>〉])/g, "$1")
    .replace(/(\d)\s+\/\s+(\d)/g, "$1/$2")
    .replace(/\bFate\s+\/\s+/g, "Fate/")
    .replace(/ROBOT\s*魂/g, "ROBOT혼")
    .replace(/超合金の塊/g, "초합금 덩어리")
    .replace(/超合金/g, "초합금")
    .replace(/\s{2,}/g, " ")
    .trim();
  return reissue ? `${ko} (재판)` : ko;
}

/**
 * Tidies every record's names.ko in place and tells look-alike products apart
 * by year. Returns how many names changed.
 */
export function tidyKoNames(kits) {
  let changed = 0;
  const base = new Map();
  for (const kit of kits) {
    if (!kit.names?.ko) continue;
    const ko = tidyKo(kit.names.ko);
    base.set(kit, ko);
  }
  // Same franchise, grade and Korean name: different products the list cannot tell apart.
  const groups = new Map();
  for (const [kit, ko] of base) {
    const key = `${kit.franchise}|${kit.grade_code}|${ko}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(kit);
  }
  for (const [kit, ko] of base) {
    const group = groups.get(`${kit.franchise}|${kit.grade_code}|${ko}`);
    const years = new Set(group.map((other) => String(other.release_date || "").slice(0, 4)));
    const year = String(kit.release_date || "").slice(0, 4);
    // LEGO names carry their set number in the app ("75192 Millennium Falcon"), so no year there.
    const tell = kit.franchise !== "lego" && group.length > 1 && years.size > 1 && /^\d{4}$/.test(year);
    const next = tell ? `${ko} (${year}년)` : ko;
    if (next !== kit.names.ko) {
      kit.names.ko = next;
      changed += 1;
    }
  }
  return changed;
}
