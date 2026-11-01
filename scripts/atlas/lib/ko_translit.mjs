// Japanese MS name -> Korean reading, for MS records that have kits but no Korean name from GGET
// or the catalogue. Korean MS names are mostly transliterations (often of the English origin), so
// this is a best guess: a word lexicon learned from GGET's official ja/ko unit names (건담, 자쿠,
// 어스트레이 ...) first, then mora-by-mora katakana -> Hangul with Korean loanword habits
// (ク -> 크, ト at the end of a word -> 트, ン before b/p/m -> ㅁ, ッ -> ㄱ/ㅅ batchim).
// Names with kanji the lexicon does not know are left alone (null). Results are marked
// names_src.ko = "translit" in gundam-ms.json so the app can label them as unofficial.
import { nfkc } from "./util.mjs";

// Kanji words that recur in MS names (Korean reads them Sino-Korean).
const KANJI = [
  ["高機動型", "고기동형"], ["量産型", "양산형"], ["陸戦型", "육전형"], ["指揮官用", "지휘관용"], ["指揮官", "지휘관"], ["試作", "시작"],
  ["偵察型", "정찰형"], ["重装型", "중장형"], ["寒冷地仕様", "한랭지 사양"], ["寒冷地", "한랭지"], ["宇宙用", "우주용"], ["地上用", "지상용"],
  ["地上型", "지상형"], ["宇宙型", "우주형"], ["水中型", "수중형"], ["砂漠", "사막"], ["先行量産型", "선행 양산형"], ["強化型", "강화형"], ["完成型", "완성형"],
  ["初期型", "초기형"], ["後期型", "후기형"], ["前期型", "전기형"], ["最終決戦仕様", "최종 결전 사양"], ["最終", "최종"], ["決戦", "결전"],
  ["専用機", "전용기"], ["専用", "전용"], ["号機", "호기"], ["仕様", "사양"], ["装備", "장비"], ["形態", "형태"], ["部隊", "부대"], ["百式", "백식"],
  ["改", "개"], ["型", "형"], ["機", "기"], ["用", "용"], ["式", "식"], ["隊", "대"], ["旧", "구"], ["真", "진"], ["新", "신"], ["弐", "2"], ["参", "3"],
];

const BASE = {
  ア: "아", イ: "이", ウ: "우", エ: "에", オ: "오", カ: "카", キ: "키", ク: "크", ケ: "케", コ: "코", ガ: "가", ギ: "기", グ: "그", ゲ: "게", ゴ: "고",
  サ: "사", シ: "시", ス: "스", セ: "세", ソ: "소", ザ: "자", ジ: "지", ズ: "즈", ゼ: "제", ゾ: "조", タ: "타", チ: "치", ツ: "츠", テ: "테", ト: "토",
  ダ: "다", ヂ: "지", ヅ: "즈", デ: "데", ド: "도", ナ: "나", ニ: "니", ヌ: "누", ネ: "네", ノ: "노", ハ: "하", ヒ: "히", フ: "프", ヘ: "헤", ホ: "호",
  バ: "바", ビ: "비", ブ: "브", ベ: "베", ボ: "보", パ: "파", ピ: "피", プ: "프", ペ: "페", ポ: "포", マ: "마", ミ: "미", ム: "무", メ: "메", モ: "모",
  ヤ: "야", ユ: "유", ヨ: "요", ラ: "라", リ: "리", ル: "루", レ: "레", ロ: "로", ワ: "와", ヲ: "오", ヴ: "브",
  ァ: "아", ィ: "이", ゥ: "우", ェ: "에", ォ: "오", ャ: "야", ュ: "유", ョ: "요",
};
const COMBO = {
  キャ: "캬", キュ: "큐", キョ: "쿄", ギャ: "갸", ギュ: "규", ギョ: "교", シャ: "샤", シュ: "슈", ショ: "쇼", シェ: "셰", ジャ: "자", ジュ: "주", ジョ: "조", ジェ: "제",
  チャ: "차", チュ: "추", チョ: "초", チェ: "체", ニャ: "냐", ニュ: "뉴", ニョ: "뇨", ヒャ: "햐", ヒュ: "휴", ヒョ: "효", ビャ: "뱌", ビュ: "뷰", ビョ: "뵤",
  ピャ: "퍄", ピュ: "퓨", ピョ: "표", ミャ: "먀", ミュ: "뮤", ミョ: "묘", リャ: "랴", リュ: "류", リョ: "료", ファ: "파", フィ: "피", フェ: "페", フォ: "포", フュ: "퓨",
  ティ: "티", ディ: "디", トゥ: "투", ドゥ: "두", デュ: "듀", テュ: "튜", ウィ: "위", ウェ: "웨", ウォ: "워", ヴァ: "바", ヴィ: "비", ヴェ: "베", ヴォ: "보",
  ツァ: "차", ツィ: "치", ツェ: "체", ツォ: "초", イェ: "예", クァ: "콰", クィ: "퀴", クェ: "퀘", クォ: "쿼", グァ: "과", スィ: "시", ズィ: "지", クゥ: "쿠",
};
const CODA_INDEX = { "ㄱ": 1, "ㄴ": 4, "ㄹ": 8, "ㅁ": 16, "ㅂ": 17, "ㅅ": 19, "ㅇ": 21 };
const addCoda = (syl, coda) => {
  const c = syl.charCodeAt(0) - 0xac00;
  if (c < 0 || c > 11171 || c % 28) return null; // not a Hangul syllable or already has a final
  return String.fromCharCode(0xac00 + c + CODA_INDEX[coda]);
};
const kataOf = (s) => s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
const VOWEL_START = /^[アイウエオァィゥェォヤユヨャュョ]/;

/** Mora-by-mora katakana -> Hangul for one katakana run (no lexicon). */
function kanaRun(run) {
  const morae = [];
  for (let i = 0; i < run.length; ) {
    const two = run.slice(i, i + 2);
    if (COMBO[two]) {
      morae.push({ k: two, h: COMBO[two] });
      i += 2;
    } else {
      morae.push({ k: run[i], h: BASE[run[i]] ?? null });
      i += 1;
    }
  }
  let out = "";
  const A_ROW = /[アカガサザタダナハバパマヤラワャァ]$/;
  for (let i = 0; i < morae.length; i++) {
    const { k, h } = morae[i];
    const next = morae[i + 1]?.k || "";
    const last = i === morae.length - 1;
    const prevSyl = out.slice(-1);
    if (k === "ー") {
      // a word-final "aー" is English "-er": セイバー -> 세이버, ブースター -> 부스터, マイヤー -> 마이어
      if (last && i > 0 && A_ROW.test(morae[i - 1].k) && morae.length > 2) {
        const c = prevSyl.charCodeAt(0) - 0xac00;
        if (c >= 0 && c <= 11171 && c % 28 === 0 && Math.floor((c % 588) / 28) === 0) out = out.slice(0, -1) + String.fromCharCode(0xac00 + c + 4 * 28);
      }
      continue;
    }
    if (k === "ッ") {
      const nextLast = i + 1 === morae.length - 1;
      // ネック -> 넥, ショップ -> 숍 (the closing kana becomes the final consonant)
      if (nextLast && /^[クグ]$/.test(next) && addCoda(prevSyl, "ㄱ")) {
        out = out.slice(0, -1) + addCoda(prevSyl, "ㄱ");
        i++;
        continue;
      }
      if (nextLast && /^[プブ]$/.test(next) && addCoda(prevSyl, "ㅂ")) {
        out = out.slice(0, -1) + addCoda(prevSyl, "ㅂ");
        i++;
        continue;
      }
      if (nextLast && /^[トド]$/.test(next)) continue; // ゾロアット -> 조로아트
      const coda = /^[カキクケコガギグゲゴ]/.test(next) ? "ㄱ" : next ? "ㅅ" : null;
      const w = coda && addCoda(prevSyl, coda);
      if (w) out = out.slice(0, -1) + w;
      continue;
    }
    if (k === "ン") {
      // English -ing: ビギニング -> 비기닝, フライングアーマー -> 플라잉아머 (but ハイングラ -> 하인그라)
      if (next === "グ" && !/^[ラリルレロ]/.test(morae[i + 2]?.k || "") && addCoda(prevSyl, "ㅇ")) {
        out = out.slice(0, -1) + addCoda(prevSyl, "ㅇ");
        i++;
        continue;
      }
      const coda = /^[バビブベボパピプペポマミムメモ]/.test(next) ? "ㅁ" : "ㄴ";
      const w = addCoda(prevSyl, coda);
      out = w ? out.slice(0, -1) + w : out + "은";
      continue;
    }
    // ル / ム closing a syllable: バルバトス -> 발바토스, ゲルググ -> 겔구그, ドム -> 돔
    if ((k === "ル" || k === "ム") && prevSyl && !VOWEL_START.test(next) && next !== "ー") {
      const w = addCoda(prevSyl, k === "ル" ? "ㄹ" : "ㅁ");
      if (w) {
        out = out.slice(0, -1) + w;
        continue;
      }
    }
    if (h == null) return null;
    let syl = h;
    // ト / ド closing a word or before r: ハウンド -> 하운드, テトラ -> 테트라, ストライク
    if ((k === "ト" || k === "ド") && ((i > 0 && last) || /^[ラリルレロ]/.test(next))) syl = k === "ト" ? "트" : "드";
    out += syl;
  }
  return out;
}

// Jamo skeleton for comparing a learned pair with its plain reading (rejects misaligned pairs
// such as アストレイ -> 레드).
const JAMO_I = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const jamo = (s) =>
  [...s]
    .map((ch) => {
      const c = ch.charCodeAt(0) - 0xac00;
      return c >= 0 && c <= 11171 ? JAMO_I[Math.floor(c / 588)] + String.fromCharCode(0x3131 + ((c % 588) / 28 | 0)) + (c % 28 ? "_" + (c % 28) : "") : ch;
    })
    .join("");
function similarity(a, b) {
  const x = jamo(a);
  const y = jamo(b);
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length, 1);
}

/** Build a ja-word -> ko-word lexicon from official name pairs [{ja, ko}]. */
export function buildKoLexicon(pairs) {
  const strip = (x) => nfkc(x).replace(/[(（【\[［][^)）】\]］]*[)）】\]］]/g, " ").replace(/\s+/g, " ").trim();
  const items = pairs.map((p) => ({ ja: strip(p.ja).split(/[・\s]+/).filter(Boolean).map(kataOf), ko: strip(p.ko).split(/\s+/).filter(Boolean) }));
  let lex = new Map();
  for (let pass = 0; pass < 3; pass++) {
    const votes = new Map();
    const vote = (j, k) => {
      if (!j || !k || !/^[ァ-ヶー]+$/.test(j) || !/^[가-힣]+$/.test(k)) return;
      const plain = kanaRun(j);
      if (!plain || similarity(plain, k) < 0.5) return;
      const m = votes.get(j) || votes.set(j, new Map()).get(j);
      m.set(k, (m.get(k) || 0) + 1);
    };
    for (const it of items) {
      const ja = it.ja.length === it.ko.length || !pass ? it.ja : it.ja.flatMap((w) => splitKnown(w, lex));
      if (ja.length === it.ko.length) ja.forEach((w, i) => vote(w, it.ko[i]));
    }
    lex = finalize(votes);
  }
  return lex;
}
function finalize(votes) {
  const lex = new Map();
  for (const [j, m] of votes) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
    if (best && j.length >= 2) lex.set(j, best[0]);
  }
  return lex;
}
function splitKnown(w, lex) {
  for (let cut = w.length - 2; cut >= 2; cut--) {
    const a = w.slice(0, cut);
    const b = w.slice(cut);
    if (lex.has(a) && b.length >= 2) return [a, ...splitKnown(b, lex)];
    if (lex.has(b) && a.length >= 2) return [...splitKnown(a, lex), b];
  }
  return [w];
}

const LATIN = /[A-Za-z0-9Α-Ωα-ωⅠ-Ⅻ\-+./()（）\[\]［］']/;

/**
 * Split one word into lexicon words, kanji words, Latin runs and kana runs. Lexicon words may sit
 * next to kana runs only when they are long (3+) and the kana run is not a single mora, so
 * "マゼラ" is not read as "マ" + lexicon "ゼラ". Fewest kana characters wins, then fewest pieces.
 */
function segment(w, lex) {
  const memo = new Map();
  const best = (i, prevKana) => {
    if (i === w.length) return { cost: 0, parts: [] };
    const key = `${i}|${prevKana}`;
    if (memo.has(key)) return memo.get(key);
    let res = null;
    const consider = (cost, part, j, kana) => {
      const rest = best(j, kana);
      if (!rest) return;
      const c = cost + rest.cost;
      if (kana && rest.parts[0]?.lexLen && rest.parts[0].lexLen < 3) return; // short lexicon word after kana
      if (part.lexLen && part.lexLen < 3 && rest.parts[0]?.kana) return; // ... or before it ("ハイ" + "ドラ")
      if (!res || c < res.cost) res = { cost: c, parts: [part, ...rest.parts] };
    };
    if (LATIN.test(w[i])) {
      let j = i;
      while (j < w.length && LATIN.test(w[j])) j++;
      consider(0.1, { t: w.slice(i, j), latin: true }, j, false);
    } else {
      const kj = KANJI.find(([k]) => w.startsWith(k, i));
      if (kj) consider(0.1, { t: kj[1], kanji: true }, i + kj[0].length, false);
      for (let j = w.length; j > i + 1; j--) {
        const piece = w.slice(i, j);
        if (lex.has(piece) && !(prevKana && piece.length < 3)) consider(0.1, { t: lex.get(piece), lexLen: piece.length }, j, false);
      }
      if (/[ァ-ヶー]/.test(w[i])) {
        for (let j = i + 1; j <= w.length && /[ァ-ヶー]/.test(w[j - 1]); j++) {
          const run = w.slice(i, j);
          if (run.length === 1 && (i > 0 || j < w.length) && run !== "ー") continue; // lone mora next to a word
          const h = kanaRun(run);
          if (h == null) continue;
          consider(run.length + 0.1, { t: h, kana: true }, j, true);
        }
      }
    }
    memo.set(key, res);
    return res;
  };
  return best(0, false)?.parts || null;
}

/** Korean reading of a Japanese MS name, or null when part of it cannot be read. */
export function transliterateKo(ja, lex) {
  const s = kataOf(nfkc(ja)).replace(/[“”"]/g, "").trim();
  if (!s) return null;
  const outWords = [];
  for (const w of s.split(/[・\s]+/).filter(Boolean)) {
    const parts = segment(w, lex);
    if (!parts) return null; // unknown kanji or symbol
    // Korean spacing: a space between words, none before a kanji suffix (양산형, 1호기) or a
    // Latin part glued to a word (Z건담, V2어설트)
    let o = "";
    parts.forEach((p, n) => {
      if (n && !p.kanji && !p.latin && !parts[n - 1].latin) o += " ";
      o += p.t;
    });
    outWords.push(o);
  }
  const out = outWords.join(" ").replace(/\s+/g, " ").trim();
  return /[가-힣]/.test(out) ? out : null;
}
