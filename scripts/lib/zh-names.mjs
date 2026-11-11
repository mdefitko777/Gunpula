// Simplified Chinese product names from the glossaries in data/i18n/zh/ (official names first;
// fan names are search aliases only, never shown).
//
// At each position the longest glossary word that is not pure katakana is tried first
// (シャア専用ザク, ジャンヌ・ダルク〔オルタ〕, ガンダムMk-II, 限定, ぬいぐるみ). Such a word starts where a
// katakana run starts, never cuts a run of Latin letters and digits, and ends inside a kana run
// only where more glossary words follow (see endsCleanly). Until 2026-11-11 a word
// starting with katakana was never tried (338 Gundam, 162 Fate and 77 Pokémon words were dead),
// so シャア専用ザク came out as シャア + 専用 + ザク with ザク's fan name 绿扎.
// A katakana run is translated only when the glossary covers ALL of it (dynamic programming
// over the run), so a short term never fires inside a longer word it does not belong to
// (ジン inside オリジン, プル inside パープル — measured on the catalog 2026-11-11).
// What is left with kana is reported, and data/i18n/names-zh.json holds full-sentence
// translations for those (applied first, like names-ko.json).
//
// Search aliases: those of every matched term, plus the `aliases` of the shorter terms a
// matched term is made of (ザク in 量産型ザク → 渣古). `own_aliases` name exactly one term and
// are not passed on (绿扎 is the green mass-produced ザク, not シャア専用ザク; 白独角兽 is
// Unicorn unit 1, not ユニコーンガンダム2号機).

import { readFileSync } from "node:fs";
import path from "node:path";
import { decodeEntities } from "./html-entities.mjs";

const GLOSSARY_DIR = "data/i18n/zh";
const KATAKANA = /[゠-ヿㇰ-ㇿ]/;
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const CJK_OR_KANA = /[぀-ヿ㐀-鿿]/;
const HIRAGANA = /[ぁ-ゖ]/;
const ALNUM = /[A-Za-z0-9]/;
const KANJI = /[㐀-鿿]/;
// ・ separates words (カプ・コケコ); it is not kana that is left untranslated
const DOTS = /[・･]/g;
const NO_SKIP = new Set();

const FILES_BY_FRANCHISE = {
  gundam: ["gundam-ms.json", "gundam-words.json"],
  pokemon: ["pokemon.json"],
  fate: ["fate.json"],
  madoka: ["small.json"],
  beyblade: ["small.json"],
  armored_core: ["small.json"],
};
// small.json carries a franchise per term.
const SMALL_FRANCHISE = { madoka: "madoka", beyblade: "beyblade", armored_core: "armored_core" };

export function normKey(text) {
  return String(text || "").normalize("NFKC").replace(/[・･\s]/g, "").toLowerCase();
}

function loadJson(file, dir) {
  return JSON.parse(readFileSync(path.join(dir, file), "utf8"));
}

function aliasList(values, zh) {
  return (values || []).filter((alias) => typeof alias === "string" && alias.trim() && alias !== zh);
}

// { kata: Map(normKey -> zh), other: Map(normKey -> zh), maxOther, maxKata,
//   aliases: Map(normKey -> [aliases]), ownAliases: Map(normKey -> [aliases]) }
export function loadGlossary(franchise, dir = GLOSSARY_DIR) {
  const kata = new Map();
  const other = new Map();
  const aliases = new Map();
  const ownAliases = new Map();
  const files = FILES_BY_FRANCHISE[franchise] || [];
  const addAliases = (map, key, extra) => {
    if (extra.length) map.set(key, [...new Set([...(map.get(key) || []), ...extra])]);
  };
  const add = (entry, priority) => {
    if (!entry?.ja || !entry.zh) return;
    if (files.includes("small.json") && entry.franchise && entry.franchise !== SMALL_FRANCHISE[franchise]) return;
    const key = normKey(entry.ja);
    // a Latin-script key only when the entry asks for it ("latin": goodsmile.com's English
    // "Nendoroid …" names); HG, figma and the like stay as written
    if (!key || (!CJK_OR_KANA.test(key) && !entry.latin)) return;
    const target = [...key].every((ch) => KATAKANA.test(ch)) ? kata : other;
    if (target.has(key) && priority === "word") return; // a term beats a generic word
    target.set(key, entry.zh.normalize("NFKC") === entry.zh ? entry.zh : entry.zh.normalize("NFKC"));
    addAliases(aliases, key, aliasList(entry.aliases, entry.zh));
    addAliases(ownAliases, key, aliasList(entry.own_aliases, entry.zh));
  };
  for (const file of files) {
    let doc;
    try {
      doc = loadJson(file, dir);
    } catch {
      continue;
    }
    for (const entry of doc.words || []) add(entry, "word");
    for (const entry of doc.terms || []) add(entry, "term");
  }
  let maxOther = 0;
  for (const key of other.keys()) maxOther = Math.max(maxOther, key.length);
  let maxKata = 0;
  for (const key of kata.keys()) maxKata = Math.max(maxKata, key.length);
  return { kata, other, aliases, ownAliases, maxOther, maxKata };
}

// Cover a katakana run completely with glossary keys (fewest pieces). Returns [keys] or null.
function segmentRun(run, glossary, skip) {
  const n = run.length;
  const best = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < n; i += 1) {
    if (!best[i]) continue;
    for (let len = Math.min(glossary.maxKata, n - i); len >= 1; len -= 1) {
      const piece = run.slice(i, i + len);
      if (!glossary.kata.has(piece) || skip.has(piece)) continue;
      const next = [...best[i], piece];
      if (!best[i + len] || best[i + len].length > next.length) best[i + len] = next;
    }
  }
  return best[n];
}

function isKatakana(ch) {
  return Boolean(ch) && KATAKANA.test(ch) && ch !== "・";
}

// A non-katakana glossary word ending at text[j] may not cut a Latin / digit run (Mk-II in Mk-III).
// It ends inside a katakana run only when the rest of the run is glossary words too
// (1/7スケール + フィギュア, 缶バッジ + セット; not 量産型ザク + レロ), and before more hiragana only
// before the particle の or where a glossary word starts (色違い + の, もふもふ + ぬいぐるみ; not
// ミニぬい + ぐるみ, のみ + がわり).
function endsCleanly(text, j, glossary, skip) {
  const next = text[j + 1] || "";
  if (isKatakana(text[j]) && isKatakana(next)) {
    let k = j + 1;
    while (k < text.length && isKatakana(text[k])) k += 1;
    // a long-vowel mark used as a dash ("フィギュアー暁美ほむらー") is not a word
    const rest = text.slice(j + 1, k).replace(/^ー+|ー+$/g, "");
    return !rest || Boolean(segmentRun(rest, glossary, skip));
  }
  if (HIRAGANA.test(text[j]) && HIRAGANA.test(next)) return next === "の" || wordsAt(text, j + 1, glossary, skip).length > 0;
  return !(ALNUM.test(text[j]) && ALNUM.test(next));
}

// Non-katakana glossary words starting at text[i], shortest first: [{ len, key }].
function wordsAt(text, i, glossary, skip) {
  const hits = [];
  if (/[\s・･]/.test(text[i])) return hits;
  // a word that starts with katakana starts a katakana run
  if (isKatakana(text[i]) && isKatakana(text[i - 1])) return hits;
  // and a Latin-script word starts a word
  const midWord = ALNUM.test(text[i]) && ALNUM.test(text[i - 1] || "");
  let key = "";
  for (let j = i; j < text.length; j += 1) {
    const ch = text[j];
    // keys ignore spaces and ・, but a match must not swallow the space around it
    if (/[\s・･]/.test(ch)) continue;
    key += ch.toLowerCase();
    if (key.length > glossary.maxOther) break;
    if (j === i || !glossary.other.has(key) || skip.has(key) || !endsCleanly(text, j, glossary, skip)) continue;
    if (midWord && !CJK_OR_KANA.test(key)) continue;
    // "…Ver." is not the start of the source's version number (グロスインジェクション Ver.2.0)
    if (key.endsWith("ver.") && /^\s*\d/.test(text.slice(j + 1))) continue;
    hits.push({ len: j - i + 1, key });
  }
  return hits;
}

// The shorter glossary terms the term matched at text[start, end) is made of: its own translation
// with the term left out (量産型ザク → 量産型, ザク), and every other word that starts inside it,
// also one running past its end (ザクII in 量産型ザクII, where 量産型ザク is the longest match).
function innerTerms(text, start, end, key, glossary, skip) {
  const without = new Set([...skip, key]);
  const sub = translate(text.slice(start, end), glossary, without);
  const words = [];
  for (let i = start; i < end; i += 1) for (const hit of wordsAt(text, i, glossary, without)) words.push(hit.key);
  return [...sub.matched, ...sub.inner, ...words];
}

// A glossary word ending in 版 before the source's own Ver. (スペシャルコーティング + Ver. read
// 特别涂层版Ver. until 2026-11-11) drops its 版. Kept: a version number after it (版 Ver.2.0) and
// a 版 the source wrote itself (劇場版ver.).
function beforeVer(zh, rest) {
  return zh.endsWith("版") && /^\s*Ver\.(?!\s*\d)/i.test(rest) ? zh.slice(0, -1) : zh;
}

function translate(text, glossary, skip) {
  const out = [];
  const matched = [];
  const inner = [];
  let literal = ""; // kanji copied as written
  let i = 0;
  while (i < text.length) {
    const hit = wordsAt(text, i, glossary, skip).at(-1);
    if (hit) {
      out.push(beforeVer(glossary.other.get(hit.key), text.slice(i + hit.len)));
      matched.push(hit.key);
      inner.push(...innerTerms(text, i, i + hit.len, hit.key, glossary, skip));
      i += hit.len;
      continue;
    }
    const ch = text[i];
    if (KATAKANA.test(ch) && ch !== "・" && ch !== "ー") {
      // the run, with ・ inside it (names write ガンダム・バルバトス and ガンダムバルバトス alike)
      let j = i;
      while (j < text.length && (KATAKANA.test(text[j]) || text[j] === "･")) j += 1;
      const raw = text.slice(i, j);
      const words = raw.split(/[・･]/).filter(Boolean).map((word) => segmentRun(word, glossary, skip));
      const allWords = words.every(Boolean);
      // else the whole run as one key (glossary keys drop the ・)
      const whole = allWords ? null : segmentRun(normKey(raw), glossary, skip);
      const pieceLists = allWords ? words : whole ? [whole] : null;
      if (pieceLists) {
        out.push(beforeVer(pieceLists.map((pieces) => pieces.map((p) => glossary.kata.get(p)).join("")).join("·"), text.slice(j)));
        for (const piece of pieceLists.flat()) {
          matched.push(piece);
          inner.push(...innerTerms(piece, 0, piece.length, piece, glossary, skip));
        }
      } else out.push(raw);
      // A word the ・ sets apart is a word of the name, also inside a whole-run term (ザク in
      // ザク・ハーフキャノン) and in a run left untranslated (ポケモン in ポケモン・ザ・ムービー, サーヴァント
      // in サーヴァント・サマーキャンプ: 神奇宝贝 and 英灵 were lost that way on 2026-11-11). Search only.
      if (!allWords) for (const piece of words.filter(Boolean).flat()) inner.push(piece, ...innerTerms(piece, 0, piece.length, piece, glossary, skip));
      i = j;
      continue;
    }
    if (KANJI.test(ch)) literal += ch;
    out.push(ch === "・" ? "·" : ch);
    i += 1;
  }
  return { out, matched, inner, literal };
}

// -> { zh, matched: [normKey], inner: [normKey], literal: kanji left as written, complete: no kana left }
export function translateName(name, glossary) {
  // Pokémon Center names came with "Pok&eacute;mon" until 2026-11-11
  const text = decodeEntities(String(name || "")).normalize("NFKC");
  const { out, matched, inner, literal } = translate(text, glossary, NO_SKIP);
  const zh = out
    .join("")
    // a glossary word ending in "Ver." followed by the source's own Ver. (エクストラフィニッシュVer.
    // read 特别处理版Ver. until 2026-11-11); a version number after it (Ver. Ver.2.0) is kept
    .replace(/(Ver\.)\s*Ver\.(?![\p{L}\p{N}])/giu, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { zh, matched, inner, literal, complete: !hasKana(zh) };
}

// The glossary's name for exactly this Japanese name (no composition), or null: the first of
// [names] the glossary has as a whole term (ザクⅡ → 扎古Ⅱ, not a translation of its parts).
export function exactGlossaryName(glossary, ...names) {
  for (const name of names) {
    const key = normKey(name);
    if (!key) continue;
    const zh = glossary.kata.get(key) ?? glossary.other.get(key);
    if (zh) return zh;
  }
  return null;
}

// The word-by-word translation of the first of [names] the glossary covers completely (no kana
// and no kanji left as written, at least one glossary word), or null: シャア専用ザクI → 夏亚专用扎古I;
// not AEUイナクト指揮官型 (指揮官型 would stay Japanese).
// Word-by-word suit names read oddly in a few fixed spots (checked on the 345 composed MS names,
// 2026-11-11): 装备 twice (シルエット装備型), シルエット as 轮廓 where products say 魅影, and
// タイプ ダーク → 「型 暗黑」 instead of 「暗黑型」.
export function tidyComposed(zh) {
  return zh
    .replace(/轮廓装备/g, "魅影装备")
    .replace(/装备装备/g, "装备")
    .replace(/ 型 (\S+)$/, " $1型");
}

export function composedGlossaryName(glossary, ...names) {
  for (const name of names) {
    if (!name) continue;
    const { zh, matched, literal, complete } = translateName(name, glossary);
    if (complete && !literal && matched.length) return tidyComposed(zh);
  }
  return null;
}

// Fan / other-region names of every glossary term found in the name (search only): all aliases
// of the matched terms, and the passed-on ones of the terms inside them.
export function searchAliases(matched, glossary, inner = []) {
  const set = new Set();
  for (const key of matched) {
    for (const alias of glossary.aliases.get(key) || []) set.add(alias);
    for (const alias of glossary.ownAliases?.get(key) || []) set.add(alias);
  }
  for (const key of inner) for (const alias of glossary.aliases.get(key) || []) set.add(alias);
  return [...set];
}

export function hasKana(text) {
  return KANA.test(String(text || "").replace(DOTS, ""));
}
