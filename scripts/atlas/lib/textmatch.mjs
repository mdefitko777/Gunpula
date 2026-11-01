// Name matching for the Atlas group builder (Fate characters, Pokémon species, AC titles).
//
// Product titles mix Japanese, Korean, English and Chinese, write the same name with or
// without middle dots / spaces / full-width letters, and put several names in one title.
// The matcher therefore works on a "compact" form (NFKC, no diacritics, lower case, all
// punctuation and spaces removed) and remembers where the original text had a separator,
// so short names can demand a word boundary:
//
// - Latin names always need a boundary on both sides ("BB" must not match inside "abba").
// - Short kana names (<= 3 characters) and kanji names (<= 2) need a boundary or a change of
//   script on both sides ("翡翠" but not "翡翠色"); 2-syllable Hangul names only on the left.
// - Longer names match anywhere. At each position the longest name wins, so "ミュウツー"
//   beats "ミュウ" and "ジークフリート" beats "ジーク".

const SEP_RE = /[\s　・･·•.,，、。:：;；/\\|()（）[\]［］{}｛｝【】〔〕〖〗「」『』<>＜＞《》〈〉!！?？☆★♪♡♥~～〜"'’‘“”=＝+＋#＃*＊…_\-–—‐−&＆]/u;

const LATIN_ACCENTS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]+`, "g");

export function fold(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .normalize("NFD")
    .replace(LATIN_ACCENTS, "") // Latin accents only; keeps Japanese dakuten (U+3099/309A)
    .normalize("NFC")
    .toLowerCase();
}

const scriptOf = (ch) => {
  if (!ch) return "";
  if (/[a-z0-9]/.test(ch)) return "latin";
  if (/[぀-ゟ]/.test(ch)) return "hira";
  if (/[゠-ヿㇰ-ㇿ]/.test(ch)) return "kata";
  if (/[가-힯ᄀ-ᇿ㄰-㆏]/.test(ch)) return "hangul";
  if (/[一-鿿㐀-䶿]/.test(ch)) return "han";
  return "other";
};

/** Compact form plus word-start flags: `starts[i]` is true when a separator preceded char i. */
export function compact(text) {
  const folded = fold(text);
  let out = "";
  const starts = [];
  let pendingSep = true;
  for (const ch of folded) {
    if (SEP_RE.test(ch)) {
      pendingSep = true;
      continue;
    }
    out += ch;
    starts.push(pendingSep);
    pendingSep = false;
  }
  starts.push(true); // end of text counts as a boundary
  return { text: out, starts };
}

export const compactKey = (text) => compact(text).text;

// Which sides of a name need a word boundary (see the header comment). Korean particles
// attach to the noun ("빠모와", "피카츄의"), so Hangul names never demand one on the right,
// and names of 3+ syllables ("커트로토무") none at all.
function needsBoundary(key) {
  const chars = [...key];
  if (chars.length === 1) return { left: true, right: true }; // "뮤" (Mew) only as a word of its own
  const scripts = new Set(chars.map(scriptOf));
  if (scripts.has("latin")) return { left: true, right: true };
  if (scripts.size === 1 && scripts.has("hangul")) return { left: chars.length <= 2, right: false };
  if (scripts.has("han") && !scripts.has("kata") && !scripts.has("hira")) return chars.length <= 2 ? { left: true, right: true } : null;
  return chars.length <= 3 ? { left: true, right: true } : null;
}

/**
 * Build a matcher. `entries` = [{ key: string (any form, compacted here), ref: any }].
 * Several refs may share one key (e.g. the same servant name in three classes).
 */
export function buildMatcher(entries, { minLength = 1 } = {}) {
  const byKey = new Map();
  for (const { key, ref } of entries) {
    const k = compactKey(key);
    if ([...k].length < minLength) continue;
    if (!byKey.has(k)) byKey.set(k, { key: k, refs: [], boundary: needsBoundary(k) });
    const slot = byKey.get(k);
    if (!slot.refs.includes(ref)) slot.refs.push(ref);
  }
  const byHead = new Map();
  for (const slot of byKey.values()) {
    const head = slot.key.slice(0, 2);
    if (!byHead.has(head)) byHead.set(head, []);
    byHead.get(head).push(slot);
  }
  for (const list of byHead.values()) list.sort((a, b) => b.key.length - a.key.length);

  /** All non-overlapping matches, left to right, longest first at each position. */
  function findAll(text) {
    const { text: t, starts } = compact(text);
    const hits = [];
    let i = 0;
    while (i < t.length) {
      const list = [...(byHead.get(t.slice(i, i + 2)) || []), ...(byHead.get(t[i]) || [])];
      let hit = null;
      if (list.length) {
        for (const slot of list) {
          if (!t.startsWith(slot.key, i)) continue;
          const end = i + slot.key.length;
          if (slot.boundary) {
            const leftOk = !slot.boundary.left || starts[i] || scriptOf(t[i - 1]) !== scriptOf(t[i]);
            const rightOk = !slot.boundary.right || starts[end] || scriptOf(t[end - 1]) !== scriptOf(t[end]);
            if (!leftOk || !rightOk) continue;
          }
          hit = { key: slot.key, refs: slot.refs, start: i, end, before: t.slice(Math.max(0, i - 14), i), after: t.slice(end, end + 10) };
          break;
        }
      }
      if (hit) {
        hits.push(hit);
        i = hit.end;
      } else {
        i += 1;
      }
    }
    return hits;
  }
  return { findAll, size: byKey.size };
}

/** True when any of the patterns (any form) occurs in the text, compared in compact form. */
export function containsAny(text, patterns) {
  const t = compactKey(text);
  return patterns.some((p) => {
    const k = compactKey(p);
    return k && t.includes(k);
  });
}
