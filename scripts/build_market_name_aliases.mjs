// Generates verified Korean market-search aliases for kits whose catalog names
// still contain Japanese kana, scoped to SEED / Gundam 00 / Beyblade X.
//
// Pipeline per kit:
//   1. Build a candidate Korean alias
//      - gundam: dictionary-based katakana->hangul term translation of names.ko
//        (greedy longest-match segmentation; kits with untranslatable kana are
//        skipped rather than guessed)
//      - beyblade: the product code (CX-07 / BX-35 / UX-05...) IS the alias —
//        Korean sellers list tops by code, no translation needed.
//   2. Verify the alias against the live Naver Shopping API: accepted only if
//      at least one returned listing title shares a distinctive alias token.
//      Unverifiable aliases are dropped so wrong prices can never attach.
//   3. Merge accepted aliases into data/market_name_overrides.json.
//      Existing (hand-written) entries always win and are never overwritten.
//
// Run locally: node scripts/build_market_name_aliases.mjs
// Requires NAVER_CLIENT_ID/SECRET via env or data/market_secrets.local.json.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const KITS_PATH = "data/kits.json";
const OVERRIDES_PATH = "data/market_name_overrides.json";
const SECRETS_PATH = "data/market_secrets.local.json";
const REQUEST_DELAY_MS = 200;
const TARGET_SERIES = new Set(["seed", "double_o"]);

const KANA_RE = /[぀-ゟ゠-ヿ]/;

// Katakana term -> established Korean fan/marketplace spelling. Longest-match
// greedy segmentation lets compounds like ストライクフリーダム resolve to
// 스트라이크 프리덤. A kana run that cannot be fully segmented fails the kit.
const TERM_DICT = {
  // shared
  "ガンダム": "건담", "リマスター": "리마스터", "スペシャル": "스페셜", "エディション": "에디션",
  "カスタム": "커스텀", "パック": "팩", "セット": "세트", "クリア": "클리어",
  "ゴールド": "골드", "シルバー": "실버", "レッド": "레드", "ブルー": "블루", "グリーン": "그린",
  "ブラック": "블랙", "ホワイト": "화이트", "パール": "펄", "コーティング": "코팅",
  "タイプ": "타입", "フル": "풀", "アーマー": "아머", "プロトタイプ": "프로토타입", "ゼロ": "제로",
  // SEED
  "ストライクフリーダム": "스트라이크 프리덤", "インフィニットジャスティス": "인피니트 저스티스",
  "ストライク": "스트라이크", "ルージュ": "루즈", "エール": "에일", "ソード": "소드",
  "ランチャー": "런처", "パーフェクト": "퍼펙트", "グランドスラム": "그랜드슬램",
  "デュエル": "듀얼", "アサルト": "어설트", "シュラウド": "슈라우드", "バスター": "버스터",
  "ブリッツ": "블리츠", "イージス": "이지스", "スカイ": "스카이", "グラスパー": "그래스퍼",
  "メビウス": "메비우스", "ジン": "진", "シグー": "시구", "ディン": "딘", "バクゥ": "바쿠",
  "ラゴゥ": "라고", "ゲイツ": "게이츠", "プロヴィデンス": "프로비던스", "フリーダム": "프리덤",
  "ジャスティス": "저스티스", "カラミティ": "칼라미티", "フォビドゥン": "포비든",
  "レイダー": "레이더", "ドレッドノート": "드레드노트", "テスタメント": "테스타먼트",
  "リジェネレイト": "리제네레이트", "ハイペリオン": "하이페리온", "アストレイ": "아스트레이",
  "フレーム": "프레임", "ミラージュ": "미라주", "セカンド": "세컨드", "リバイ": "리바이",
  "アウト": "아웃", "ターン": "턴", "インパルス": "임펄스", "セイバー": "세이버",
  "カオス": "카오스", "ガイア": "가이아", "アビス": "어비스", "ブレイズ": "블레이즈",
  "ガナー": "거너", "スラッシュ": "슬래시", "ウィザード": "위저드", "ザク": "자쿠",
  "ウォーリア": "워리어", "ファントム": "팬텀", "グフ": "구프", "イグナイテッド": "이그나이티드",
  "ドム": "돔", "トルーパー": "트루퍼", "ムラサメ": "무라사메", "アカツキ": "아카츠키",
  "オオワシ": "오오와시", "シラヌイ": "시라누이", "デスティニー": "데스티니",
  "レジェンド": "레전드", "インフィニット": "인피니트", "ミーティア": "미티어",
  "スターゲイザー": "스타게이저", "ヴェルデ": "베르데", "ネロ": "네로", "ノワール": "느와르",
  "ライトニング": "라이트닝", "ダガー": "대거", "ウィンダム": "윈덤", "ジェット": "제트",
  "ストライカー": "스트라이커", "フォース": "포스", "ブラスト": "블라스트",
  "ミネルバ": "미네르바", "エターナル": "이터널", "アークエンジェル": "아크엔젤",
  "ドミニオン": "도미니언", "ザウート": "자우트", "ゲルズゲー": "겔즈게", "ゾノ": "조노",
  "アッシュ": "애쉬", "ケルベロス": "케르베로스", "シビリアン": "시빌리언", "カーボン": "카본",
  "天ミナ": "아마츠 미나", "天": "아마츠", "ミナ": "미나",
  // Gundam 00
  "エクシア": "엑시아", "リペア": "리페어", "デュナメス": "듀나메스", "キュリオス": "큐리오스",
  "ヴァーチェ": "버체", "ナドレ": "나드레", "アストレア": "아스트레아", "サダルスード": "사달수드",
  "アブルホール": "아불홀", "プルトーネ": "플루토네", "ラジエル": "라지엘", "スローネ": "스로네",
  "アイン": "아인", "ツヴァイ": "츠바이", "ドライ": "드라이", "セラヴィー": "세라비",
  "セラフィム": "세라핌", "ケルディム": "켈딤", "アリオス": "아리오스", "アヘッド": "어헤드",
  "ダブルオー": "더블오", "ライザー": "라이저", "クアンタ": "퀀타", "ガデッサ": "가데사",
  "ガラッゾ": "가랏조", "ガッデス": "가데스", "ジンクス": "진엑스", "リボーンズ": "리본즈",
  "リボンズ": "리본즈", "ガガ": "가가", "ラファエル": "라파엘", "サバーニャ": "사바냐",
  "ハルート": "하루트", "ブレイヴ": "브레이브", "スサノオ": "스사노오", "マスラオ": "마스라오",
  "フラッグ": "플래그", "オーバー": "오버", "イナクト": "이낙트", "ティエレン": "티에렌",
  "タオツー": "타오쯔", "アルヴァトーレ": "알바토레", "アルヴァアロン": "알바아론",
  "トリロバイト": "트릴로바이트", "オーライザー": "오라이저", "トランザム": "트랜스암",
  "ヒリング": "힐링", "ケア": "케어", "デヴァイズ": "디바이즈", "ザンライザー": "잔라이저",
  "セブン": "세븐", "アヴァランチ": "아발란치", "ダッシュ": "대시", "ダーク": "다크",
  "マター": "매터", "サキガケ": "사키가케", "スペルビア": "스페르비아", "レグナント": "레그난트",
};
const DICT_KEYS = Object.keys(TERM_DICT).sort((a, b) => b.length - a.length);

// ---- shared helpers (mirrors fetch_wanted_market_listings.mjs semantics) ----
function cleanName(value) {
  return String(value ?? "")
    .replace(/[＜＞<>()（）\[\]【】・]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenize(value) {
  return cleanName(value).toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
}
const GENERIC = new Set([
  "hg", "hguc", "hgce", "mg", "rg", "pg", "sd", "bb", "re", "fm", "eg",
  "gundam", "건담", "ガンダム", "高达", "bandai", "반다이", "バンダイ",
  "gunpla", "건프라", "프라모델", "프라", "모형", "피규어",
  "144", "100", "60", "1/144", "1/100", "1/60", "ver", "버전", "정품", "새상품", "미개봉",
  "기동전사", "기동", "전사", "베이블레이드", "베이블레이드x", "beyblade", "타카라토미",
  "스타터", "부스터", "랜덤부스터", "세트",
]);
function isDistinctive(token) {
  if (GENERIC.has(token)) return false;
  if (/^[\d\s./-]+$/.test(token)) return false;
  return true;
}

// Translate one contiguous kana run via greedy longest-match; null when stuck.
function translateKanaRun(run) {
  const out = [];
  let pos = 0;
  while (pos < run.length) {
    if (run[pos] === "ー" || run[pos] === "・" || run[pos] === " ") { pos += 1; continue; }
    const hit = DICT_KEYS.find((key) => run.startsWith(key, pos));
    if (!hit) return null;
    out.push(TERM_DICT[hit]);
    pos += hit.length;
  }
  return out.join(" ");
}

// Build the Korean alias candidate for a gundam kit from its ko name.
function buildGundamAlias(kit) {
  let base = cleanName(kit.names?.ko || "");
  if (!base) return null;
  const grade = (kit.grade_code || "").toLowerCase();
  base = base
    .replace(/\b1\s*\/\s*(144|100|60)\b/g, " ")
    .split(/\s+/)
    .filter((tok) => tok && tok.toLowerCase() !== grade)
    .join(" ");
  // split into kana runs vs everything else, translating each kana run
  const segments = base.match(/[぀-ゟ゠-ヿー・]+|[^぀-ゟ゠-ヿー・]+/g) || [];
  const out = [];
  for (const seg of segments) {
    if (KANA_RE.test(seg)) {
      const translated = translateKanaRun(seg.replace(/\s+/g, ""));
      if (translated === null) return null;
      out.push(translated);
    } else {
      out.push(seg.trim());
    }
  }
  const alias = cleanName(out.filter(Boolean).join(" "));
  return alias && !KANA_RE.test(alias) ? alias : null;
}

// Beyblade: the leading product code is the alias.
function buildBeybladeAlias(kit) {
  const name = cleanName(kit.names?.ko || kit.names?.ja || "");
  const code = name.match(/^(BX|UX|CX)-\d+\w*/i);
  return code ? `베이블레이드 ${code[0].toUpperCase()}` : null;
}

async function loadSecrets() {
  try {
    const doc = JSON.parse(await readFile(join(rootDir, SECRETS_PATH), "utf8"));
    for (const [k, v] of Object.entries(doc)) {
      if (!k.startsWith("_") && v && !process.env[k]) process.env[k] = String(v);
    }
  } catch { /* env-only mode */ }
}

async function naverTitles(query) {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=sim`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Naver API ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((i) => cleanName(i.title.replace(/<\/?b>/g, "")));
}

function aliasVerified(alias, titles) {
  const aliasTokens = tokenize(alias).filter(isDistinctive);
  if (!aliasTokens.length) return false;
  return titles.some((title) => {
    const titleTokens = new Set(tokenize(title));
    return aliasTokens.some((t) => titleTokens.has(t));
  });
}

async function main() {
  await loadSecrets();
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    console.error("Naver credentials are required (env or data/market_secrets.local.json).");
    process.exit(1);
  }
  const kits = JSON.parse(await readFile(join(rootDir, KITS_PATH), "utf8")).kits;
  const overridesDoc = JSON.parse(await readFile(join(rootDir, OVERRIDES_PATH), "utf8"));
  const overrides = overridesDoc.overrides || {};

  const targets = kits.filter((kit) => {
    if (overrides[kit.kit_id]) return false; // hand-written entries win
    const ko = kit.names?.ko || "";
    if (!KANA_RE.test(ko)) return false; // already searchable in Korean
    if (kit.franchise === "beyblade") return true;
    return kit.franchise === "gundam" && TARGET_SERIES.has(kit.series?.key);
  });
  console.log(`Targets: ${targets.length} kits (SEED/00/Beyblade with kana names).`);

  const stats = { accepted: 0, untranslatable: 0, unverified: 0, api_errors: 0 };
  let processed = 0;
  for (const kit of targets) {
    processed += 1;
    const alias = kit.franchise === "beyblade" ? buildBeybladeAlias(kit) : buildGundamAlias(kit);
    if (!alias) { stats.untranslatable += 1; continue; }
    const grade = kit.grade_code === "BEYBLADE_X" ? "" : (kit.grade_code || "");
    const query = [grade, alias].filter(Boolean).join(" ");
    try {
      const titles = await naverTitles(query);
      if (aliasVerified(alias, titles)) {
        overrides[kit.kit_id] = { ko: alias, via: "auto-naver-verified" };
        stats.accepted += 1;
      } else {
        stats.unverified += 1;
      }
    } catch (error) {
      stats.api_errors += 1;
      if (stats.api_errors <= 3) console.warn(`[naver] ${kit.kit_id}: ${error.message}`);
      if (stats.api_errors > 20) { console.error("Too many API errors; stopping early."); break; }
    }
    if (processed % 100 === 0) console.log(`  ...${processed}/${targets.length} (accepted ${stats.accepted})`);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  overridesDoc.overrides = overrides;
  overridesDoc.updated_at = new Date().toISOString().slice(0, 10);
  await writeFile(join(rootDir, OVERRIDES_PATH), `${JSON.stringify(overridesDoc, null, 2)}\n`, "utf8");
  console.log(`Done. accepted=${stats.accepted} untranslatable=${stats.untranslatable} unverified=${stats.unverified} api_errors=${stats.api_errors}`);
  console.log(`Total aliases in file: ${Object.keys(overrides).length}`);
}

await main();
