// Simplified Chinese product names from the glossaries in data/i18n/zh/ (official names first;
// fan names are search aliases only, never shown).
//
// A katakana run is translated only when the glossary covers ALL of it (dynamic programming
// over the run), so a short term never fires inside a longer word it does not belong to
// (ジン inside オリジン, プル inside パープル — measured on the catalog 2026-11-11). Other
// glossary words (kanji / hiragana, e.g. 限定, ぬいぐるみ) are replaced by longest match.
// What is left with kana is reported, and data/i18n/names-zh.json holds full-sentence
// translations for those (applied first, like names-ko.json).

import { readFileSync } from "node:fs";
import path from "node:path";

const GLOSSARY_DIR = "data/i18n/zh";
const KATAKANA = /[゠-ヿㇰ-ㇿ]/;
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;
const CJK_OR_KANA = /[぀-ヿ㐀-鿿]/;

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

// { kata: Map(normKey -> zh), other: Map(normKey -> zh), maxOther, aliases: Map(normKey -> [aliases]) }
export function loadGlossary(franchise, dir = GLOSSARY_DIR) {
  const kata = new Map();
  const other = new Map();
  const aliases = new Map();
  const files = FILES_BY_FRANCHISE[franchise] || [];
  const add = (entry, priority) => {
    if (!entry?.ja || !entry.zh) return;
    if (files.includes("small.json") && entry.franchise && entry.franchise !== SMALL_FRANCHISE[franchise]) return;
    const key = normKey(entry.ja);
    if (!key || !CJK_OR_KANA.test(key)) return;
    const target = [...key].every((ch) => KATAKANA.test(ch)) ? kata : other;
    if (target.has(key) && priority === "word") return; // a term beats a generic word
    target.set(key, entry.zh.normalize("NFKC") === entry.zh ? entry.zh : entry.zh.normalize("NFKC"));
    const extra = (entry.aliases || []).filter((a) => typeof a === "string" && a.trim() && a !== entry.zh);
    if (extra.length) aliases.set(key, [...new Set([...(aliases.get(key) || []), ...extra])]);
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
  return { kata, other, aliases, maxOther, maxKata };
}

// Cover a katakana run completely with glossary keys (fewest pieces). Returns [keys] or null.
function segmentRun(run, glossary) {
  const n = run.length;
  const best = new Array(n + 1).fill(null);
  best[0] = [];
  for (let i = 0; i < n; i += 1) {
    if (!best[i]) continue;
    for (let len = Math.min(glossary.maxKata, n - i); len >= 1; len -= 1) {
      const piece = run.slice(i, i + len);
      if (!glossary.kata.has(piece)) continue;
      const next = [...best[i], piece];
      if (!best[i + len] || best[i + len].length > next.length) best[i + len] = next;
    }
  }
  return best[n];
}

// -> { zh, matched: [normKey], complete: boolean }
export function translateName(name, glossary) {
  const text = String(name || "").normalize("NFKC");
  const out = [];
  const matched = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (KATAKANA.test(ch) && ch !== "・" && ch !== "ー") {
      // the run, with ・ inside it (names write ガンダム・バルバトス and ガンダムバルバトス alike)
      let j = i;
      while (j < text.length && (KATAKANA.test(text[j]) || text[j] === "･")) j += 1;
      const raw = text.slice(i, j);
      const words = raw.split(/[・･]/).filter(Boolean);
      const parts = [];
      let ok = true;
      for (const word of words) {
        const pieces = segmentRun(word, glossary);
        if (!pieces) {
          ok = false;
          break;
        }
        parts.push(pieces.map((p) => glossary.kata.get(p)).join(""));
        matched.push(...pieces);
      }
      if (!ok) {
        // whole run as one key (glossary keys drop the ・)
        const whole = normKey(raw);
        const pieces = segmentRun(whole, glossary);
        if (pieces) {
          out.push(pieces.map((p) => glossary.kata.get(p)).join(""));
          matched.push(...pieces);
        } else out.push(raw);
      } else out.push(parts.join("·"));
      i = j;
      continue;
    }
    let hit = null;
    for (let len = Math.min(glossary.maxOther, text.length - i); len >= 2; len -= 1) {
      const slice = text.slice(i, i + len);
      // keys ignore spaces, but a match must not swallow the space around it
      if (slice.trim() !== slice) continue;
      const key = normKey(slice);
      if (glossary.other.has(key)) {
        hit = { len, key };
        break;
      }
    }
    if (hit) {
      out.push(glossary.other.get(hit.key));
      matched.push(hit.key);
      i += hit.len;
      continue;
    }
    out.push(ch === "・" ? "·" : ch);
    i += 1;
  }
  const zh = out
    .join("")
    // a glossary word ending in "Ver." followed by the source's own Ver. (エクストラフィニッシュVer.
    // read 特别处理版Ver. until 2026-11-11); a version number after it (Ver. Ver.2.0) is kept
    .replace(/(Ver\.)\s*Ver\.(?![\p{L}\p{N}])/giu, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { zh, matched, complete: !KANA.test(zh) };
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

// Fan / other-region names of every glossary term found in the name (search only).
export function searchAliases(matched, glossary) {
  const set = new Set();
  for (const key of matched) for (const alias of glossary.aliases.get(key) || []) set.add(alias);
  return [...set];
}

export function hasKana(text) {
  return KANA.test(String(text || ""));
}
