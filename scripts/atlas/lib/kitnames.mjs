// Kit-name cleaning and classification for Gundam catalogue records (names.ja).
import { nameKey, nfkc } from "./util.mjs";

// Brand / line prefixes that precede the mobile-suit name in kit titles (NFKC text).
const PREFIX = new RegExp(
  "^(?:" +
    [
      "HGUC", "HGCE", "HGAC", "HGAW", "HGBF", "HGBD:R", "HGBD", "HGBC", "HGBM", "HGIBO", "HGGTO", "HGFC", "HGAGE", "HGTB", "HGUC", "HG\\s*メカニクス", "HG",
      "MGEX", "MGSD", "MG", "RG", "PG\\s*UNLEASHED", "PG", "EG", "ENTRY\\s*GRADE", "RE\\s*/\\s*100", "FULL\\s*MECHANICS", "FM", "AG", "FG", "HY2M", "NG",
      "SDCS", "SDEX\\s*スタンダード\\s*\\d*", "SDEX", "EXスタンダード\\s*\\d*", "スタンダード\\s*\\d+", "LEGEND\\s*BB", "SDBD", "SDBF", "SDW\\s*HEROES", "SDガンダム\\s*クロスシルエット", "SDガンダム\\s*Gジェネレーション(?:\\s*-?\\d+)?", "SDガンダム", "BB戦士\\s*\\d*", "SD",
      "METAL\\s*BUILD(?:\\s*DRAGON\\s*SCALE)?", "METAL\\s*ROBOT魂(?:\\s*[（(][^)）]*[)）])?", "ROBOT魂(?:\\s*[（(][^)）]*[)）])?\\s*(?:<\\s*SIDE\\s*MS\\s*>)?", "METAL\\s*STRUCTURE\\s*解体匠機",
      "MOBILE\\s*SUIT\\s*ENSEMBLE\\s*(?:EX\\s*)?[\\d.]*", "FW\\s*GUNDAM\\s*CONVERGE\\s*(?::?\\s*CORE|EX\\s*\\d+|#?\\s*\\d+|SP\\s*\\d+|10周年\\s*[^\\s]*)?",
      "CONVERGE", "GフレームFA", "Gフレーム", "ガシャポン戦士\\s*f(?:orte)?\\s*(?:EX)?\\s*[\\d.]*", "ガンダムアーティファクト(?:PRO)?", "MSメカニカルバスト\\s*\\d*",
      "GUNDAM\\s*UNIVERSE", "超合金(?:魂)?", "ADVANCED\\s*GRADE", "HIGH\\s*GRADE", "MASTER\\s*GRADE", "REAL\\s*GRADE", "PERFECT\\s*GRADE",
      "MOBILITY\\s*JOINT\\s*GUNDAM(?:\\s*VOL\\.?\\s*\\d+)?", "S\\.H\\.Figuarts", "ちびロボ", "GUNDAM\\s*FIX\\s*FIGURATION(?:\\s*METAL\\s*COMPOSITE)?", "MS\\s*IN\\s*ACTION!*",
      "ガンプラ", "ガンダムデカール(?:DX)?\\s*\\d*", "1\\s*/\\s*\\d{2,4}(?:\\s*スケール)?", "R\\d{2}(?=\\s)", "HG\\s*BUILD\\s*CUSTOM", "BUILD\\s*CUSTOM", "メガサイズモデル", "EXモデル", "MSメカニカルバスト\\s*(?:DX|\\d+)?", "CAPSULE\\s*ACTION", "アルティメットルミナス", "EXCEED\\s*MODEL", "コスモフリート(?:スペシャル)?",
    ].join("|") +
    ")\\s*",
  "i",
);

const LIMITED = /(ガンダムベース(?:東京|福岡|サテライト[^\s]*)?|THE\s*GUNDAM\s*BASE|プレミアムバンダイ|プレバン|イベント|GUNDAM\s*SIDE-F|ホビーオンラインショップ|魂ウェブ商店|TAMASHII\s*NATIONS\s*STORE|ガンダムカフェ|ガンプラEXPO)\s*(?:限定|販売)?/gi;
const FINISH = /(スペシャル)?(ハーフメカニカルクリア|メカニカルクリア|プラスクリア外装|クリアカラー|メタリック(?:カラー|コーティング)?|メッキ|コーティング|エクストラフィニッシュ|リアルタイプカラー|リアルタイプ|ペインティングモデル|グロスインジェクション|パールグロス|チタニウムフィニッシュ|クリアパーツ付き|クリアパーツ|蓄光|クリア|ライトパッケージVer|アニメカラー|アニメーションカラー|最終決戦仕様|最終決戦イメージカラー|劇中カラー|リミテッドカラー|ゴールドインジェクション|レインボー|カラークリア|再販版?|再生産|初回限定|数量限定|期間限定|限定品?)/g;
// "<MS>用 <accessory>" (but not 専用): keep the MS, mark the kit as an accessory.
// "装備型" is a loadout of the MS itself (G-セルフ(大気圏用パック装備型)), not an accessory.
const ACCESSORY = /(?<!専)用\s*(?:の)?\s*[^\s]{0,16}?\s*(ミッションパック|フィン・ファンネル|拡張|オプション|エフェクト|武器|ウェポン|パーツ|フルアーマー|強化|ブースター|装備(?!型)|改造|カスタム|リペア|ディテールアップ|専用|水転写|デカール|マーキング|ベース|ディスプレイ|スタンド|LED|ユニット|セット|キット|アーマー|バックパック|アクション).*$/;
const ACCESSORY_WORDS = /(拡張パーツ|拡張セット|拡張ユニット|エフェクトユニット|エフェクトパーツ|エフェクトセット|ウェポンセット|武器セット|オプションパーツ|カスタマイズパーツ|カスタマイズキット|カスタマイズマテリアル|ディテールアップ|ミキシング|LEDユニット|ビルドパーツ|アクションベース|水転写式デカール|デカール)/;

export const PLASTIC_GRADES = new Set(["HG", "MG", "RG", "PG", "NG", "EG", "RE100", "FM", "MGSD", "MGEX", "SD", "SDW", "SDEX", "PGU", "AG", "FG", "HY2M"]);
export const FIGURE_GRADES = new Set(["ROBOT_SPIRITS", "METAL_BUILD", "METAL_ROBOT", "CONVERGE", "GFRAME", "MSE", "GSF", "MOBILITY", "ARTIFACT", "SH_FIGUARTS", "SUPERIOR"]);
const PLASTIC_NAME = /^(?:【[^】]*】|\[[^\]]*\]|\s)*(?:機動戦士[^\s]*\s+)?(?:HG(?:UC|CE|AC|AW|BF|BD:R|BD|BC|BM|IBO|GTO|FC|AGE|TB)?|MG(?:EX|SD)?|RG|PG|EG|ENTRY\s*GRADE|RE\s*\/\s*100|FULL\s*MECHANICS|BB戦士|SDガンダムBB戦士|メガサイズモデル|EXモデル|SDCS|SDW|SDEX|SDガンダム|SD\s|1\s*\/\s*(?:144|100|60|48|550|220|250|400|35|72))(?![A-Za-z])/i;
const FIGURE_NAME = /(ROBOT魂|METAL\s*BUILD|METAL\s*ROBOT|CONVERGE|Gフレーム|MOBILE\s*SUIT\s*ENSEMBLE|ガシャポン戦士|MOBILITY\s*JOINT|アーティファクト|超合金|S\.H\.Figuarts|FIX\s*FIGURATION|METAL\s*STRUCTURE|フィギュア|SDガンダム\s*(?:フルカラー|ガシャポン)|モビルスーツアンサンブル|MSメカニカルバスト|CAPSULE\s*ACTION|アルティメットルミナス|EXCEED\s*MODEL|コスモフリート)/i;
const NON_MODEL = /(トートバッグ|バッグ|ブローチ|Tシャツ|パーカー|マグカップ|タオル|キーホルダー|キーチェーン|アクリル|ステッカー|シール|缶バッジ|クリアファイル|ポスター|タンブラー|ネックレス|リング|財布|ウォレット|腕時計|ウォッチ|ペン|ぬいぐるみ|クッション|エアーマスコット|コンテナ|ポーチ|ケース|カード|コイン|ラバー|マスコット|ハンカチ|靴下|ソックス|キャップ|帽子|ジャケット|ブルゾン|スニーカー|サンダル|メガネ|食器|グラス|ボトル|ランプ|ライト|時計|ノート|手帳|塗料|マーカー|ニッパー|ヤスリ|ピンセット|モビルスタンド|ディスプレイ|スタンド|アクションベース|ブック|画集|設定資料|Blu-ray|DVD|CD|サウンドトラック|ゲーム|カレンダー|お菓子|ウエハース|チョコ|ガム|入浴剤|ゼリー|カプセル|プライズ)/;

// Non-kit goods that still start with a grade or scale ("HG ... デカール"); kept narrow on purpose.
const NON_KIT = /(デカール|Tシャツ|トートバッグ|ブローチ|ポスター|キーホルダー|アクリルスタンド|ステッカー|マグカップ|タオル|塗料|ニッパー|ヤスリ|ガンダムマーカー)/;

/** Classify a gundam catalogue record: plastic | figure | merch. */
export function classifyKit(kit) {
  const name = nfkc(kit.names?.ja || "");
  if (PLASTIC_GRADES.has(kit.grade_code)) return "plastic";
  if (FIGURE_GRADES.has(kit.grade_code)) return "figure";
  if (PLASTIC_NAME.test(name) && !NON_KIT.test(name.replace(/【[^】]*】/g, ""))) return "plastic";
  if (FIGURE_NAME.test(name) && !NON_MODEL.test(name.replace(/【[^】]*】/g, ""))) return "figure";
  return "merch";
}

/** Strip trailing/bracketed tags but keep grade + scale: used for whole-name joins. */
export function kitJoinKey(raw) {
  let s = nfkc(raw);
  s = s.replace(/【[^】]*】|<[^>]*>|＜[^＞]*＞/g, " ");
  s = s.replace(/[(（]\s*(再販|再生産|送料無料!?|送料0円.*?)\s*[)）]/g, " ").replace(/\[\s*再販\s*\]/g, " ");
  s = s.replace(LIMITED, " ");
  s = s.replace(/送料無料!?|送料0円/g, " ");
  return nameKey(s);
}

/**
 * Clean a kit title down to the mobile-suit name. Returns {cleaned, variants[], accessory,
 * workPrefix?}. `variants` are progressively looser spellings to try for exact matching.
 */
export function cleanKitName(raw, workPrefixes = []) {
  let s = nfkc(raw);
  s = s.replace(/【[^】]*】|<[^>]*>|＜[^＞]*＞|〈[^〉]*〉|《[^》]*》/g, " ");
  // "RX-78 / C.A. キャスバル専用ガンダム", "TMF / A-803 ラゴゥ": rejoin model numbers split by " / "
  s = s.replace(/([A-Za-z0-9.])\s+\/\s*([A-Za-z0-9])|([A-Za-z0-9.])\s*\/\s+([A-Za-z0-9])/g, (m0, a, b, c, d) => `${a || c}/${b || d}`);
  // [..] holds both tags ([クリアカラー]) and MS names (TR-6[ウーンドウォート], RX-79[G]): mark it, decide later.
  s = s.replace(/\[([^\]]*)\]/g, " ⟦$1⟧ ").replace(/^\s*(⟦[^⟧]*⟧\s*)+/, "");
  s = s.replace(/～[^～]*～|~[^~]*~/g, " ");
  s = s.replace(LIMITED, " ").replace(/送料無料!?|送料0円/g, " ");
  let workPrefix = null;
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/^\s+/, "");
    for (const wp of workPrefixes) {
      if (s.startsWith(wp)) {
        workPrefix ||= wp;
        s = s.slice(wp.length);
        break;
      }
    }
    s = s.replace(/^\s+/, "").replace(PREFIX, "");
    if (s === before) break;
  }
  s = s.replace(/\b1\s*\/\s*\d{2,4}\b/g, " ");
  s = s.replace(/\bver\.?\s*(?:A\.N\.I\.M\.E\.|[\w.]+)(?:\s+(?:Ka|EVOLVE|GFT|SP|ONE\s*YEAR\s*WAR\s*0079))?/gi, " ");
  s = s.replace(/\b(REVIVE|Revive|リバイブ|BEYOND\s*GLOBAL|Ver\.Ka|Ka\s*signature)\b/g, " ");
  let accessory = false;
  if (ACCESSORY.test(s)) {
    accessory = true;
    s = s.replace(ACCESSORY, " ");
  } else if (ACCESSORY_WORDS.test(s)) {
    accessory = true;
  }
  s = s.replace(FINISH, " ");
  // Trailing colour / edition words after the MS name: "ジム改 スタンダードカラー", "Zガンダム バージョン".
  // A word glued to the next set member keeps the member: "スタンダードカラー＆ボール改修型" -> "＆ボール改修型".
  const TAIL_WORD = /カラー|バージョン|ver\.?$|エディション|edition|仕様$|^版$|Ver$/i;
  const dropTail = (t) => {
    const words = t.replace(/\s+/g, " ").trim().split(" ");
    const out = [];
    words.forEach((w, i) => {
      const glued = i > 0 && w.match(/^(.*?)([&＆+＋])(.+)$/);
      if (glued && TAIL_WORD.test(glued[1]) && !/パーツ|セット|ユニット|エフェクト/.test(glued[3])) out.push(`${glued[2]}${glued[3]}`);
      else if (i === 0 || !TAIL_WORD.test(w)) out.push(w);
    });
    return out.join(" ");
  };
  const keepB = (t) => t.replace(/[⟦⟧]/g, " ");
  const dropB = (t) => t.replace(/⟦[^⟧]*⟧/g, " ");
  const stripParens = (t) => t.replace(/[(（][^)）]*[)）]/g, " ");
  const withParens = dropTail(dropB(s));
  const noParens = dropTail(stripParens(dropB(s)));
  const variants = [];
  const push = (v, kind) => {
    const k = nameKey(v);
    if (k && !variants.some((x) => x.key === k)) variants.push({ text: v, key: k, kind });
  };
  if (s.includes("⟦")) {
    push(dropTail(keepB(s)), "full");
    push(dropTail(stripParens(keepB(s))), "full");
  }
  push(withParens, "full");
  // Short Latin qualifier in brackets names the MS: "ガンダム(G3)" is the G-3 Gundam.
  const qual = dropB(s).match(/^(.+?)\s*[(（]\s*([A-Za-z][A-Za-z0-9-]{0,5})\s*[)）]\s*$/);
  if (qual) push(`${qual[2]}${dropTail(qual[1])}`, "full");
  push(noParens, "full");
  // Quoted nicknames: 高機動型ザク“サイコ・ザク”, ザクI“旧ザク”
  const q = noParens.match(/^(.*?)\s*[“"”]([^“"”]+)[”"]\s*(.*)$/);
  if (q) {
    // the nickname is the more specific name: 高機動型ザク“サイコ・ザク” is the Psycho Zaku
    push(q[2], "full");
    push(`${q[1]} ${q[3]}`.trim(), "full");
  }
  // "MS-06F ザク・マインレイヤー" -> "ザク・マインレイヤー" (the model step handles the number)
  const lead = noParens.match(/^([A-Za-z0-9][A-Za-z0-9\-\/\[\].+νΞ]*-[A-Za-z0-9\-\/\[\].+νΞ]*)\s*(.+)$/);
  const core = lead && /\d/.test(lead[1]) ? lead[2] : noParens;
  if (core !== noParens) push(core, "full");
  // "量産型ズゴック" -> "ズゴック", "ガンキャノン量産型" -> "量産型ガンキャノン"
  const ck = nameKey(core);
  if (/^量産型.{3,}/.test(ck)) push(core.replace(/^\s*量産型\s*/, ""), "full");
  if (/.{3,}量産型$/.test(ck)) push(`量産型${core.replace(/\s*量産型\s*$/, "")}`, "full");
  // Drop trailing qualifiers one at a time ("ガンダムヘビーアームズ改 EW" -> "ガンダムヘビーアームズ改").
  const words = noParens.split(" ");
  for (let n = words.length - 1; n >= 1; n--) push(words.slice(0, n).join(" "), "trunc");
  return { cleaned: noParens, core, variants, accessory, workPrefix };
}

/** "<pilot>専用<MS>" -> {pilot, ms} or null. */
export function splitPilotCustom(text) {
  const m = nfkc(text).match(/^(.{1,20}?)専用(?:機)?\s*(.{2,})$/);
  if (!m || /^[\s・]*$/.test(m[2])) return null;
  return { pilot: m[1].trim(), ms: m[2].trim() };
}

/** Split a set name into member names ("A&B", "A+B", "A・Bセット"). */
export function splitSet(text) {
  let t = nfkc(text).replace(/(\d+\s*(?:機|体))?\s*セット$/, "").trim();
  // "+" and "/" inside model numbers are not set separators: GAT-X105+AQM/E-X01, MS-09F/TROP
  const MODEL_JOIN = /(?<![A-Za-z0-9-])([A-Z0-9][A-Za-z0-9-]*\d[A-Za-z0-9-]*|[A-Z][A-Z0-9-]*)\s*([+\/])\s*([A-Z0-9][A-Za-z0-9-]*)(?=$|\s|[^A-Za-z0-9-])/;
  for (let i = 0; i < 6 && MODEL_JOIN.test(t); i++) t = t.replace(MODEL_JOIN, (_, a, op, b) => `${a}${op === "+" ? "\u0001" : "\u0002"}${b}`);
  const restore = (p) => p.replace(/\u0001/g, "+").replace(/\u0002/g, "/");
  // "vs" also appears without spaces between Japanese names (νガンダムvsサザビー)
  const raw = t.split(/\s*(?:&|＆|\+|＋|\/|(?<![A-Za-z])vs\.?(?![A-Za-z])|\s+VS\s+)\s*/i).map((p) => restore(p.trim()));
  // "ユニコーンガンダム1号機&2号機": a bare unit number continues the previous member's name
  const parts = [];
  for (const p of raw) {
    const prev = parts[parts.length - 1];
    if (prev && /^\d+号機$/.test(p) && /\d+号機$/.test(prev)) parts.push(prev.replace(/\d+号機$/, p));
    else parts.push(p);
  }
  const kept = parts.filter((p) => nameKey(p).length >= 2);
  return kept.length >= 2 ? kept : null;
}

export const isSetName = (text) => /セット|&|＆|\+|＋|\d\s*機|\d\s*体/.test(nfkc(text));

export function janOf(kit) {
  const urls = (kit.source_urls || []).join(" ");
  const m = urls.match(/(?:prd_id|jan_code|jan)=(\d{13})/) || String(kit.kit_id).match(/(?:^|-)(\d{13})000$/);
  return m ? m[1] : null;
}

// Kanji that start real MS names; anything else glued in front of an MS name on a BB戦士 box is
// a 三国伝 general (司馬懿サザビー, 孔明νガンダム, 天翔竜 孔明νガンダム).
const MS_KANJI_PREFIX = /^(量産型|陸戦型|高機動型|試作|先行|指揮官|重装|局地|水中|百式|旧|強化型|完成型|偵察型|宇宙用|地上用|砂漠|寒冷地|真|新|改|獅電|百錬|漏影|辟邪|雷電)/;

/**
 * SD original characters reuse a real MS name but are not that MS. Returns the SD work id the
 * kit belongs to (sd-sangokuden, sd-sengokuden, sd-gundam-gaiden, sd-gundam-world-heroes,
 * sd-gundam-world-soketsuden) or null for ordinary kits (BB戦士 ユニコーンガンダム is a real MS).
 */
export function sdOriginalWork(kit, cleaned = "") {
  const n = nfkc(kit.names?.ja || "");
  const sdLine = kit.grade_code === "SD" || kit.grade_code === "SDW" || /BB戦士|SDガンダム|SDW|SDCS|SDEX|LEGEND\s*BB/i.test(n);
  if (kit.grade_code === "SDW" || /SDW\s*HEROES/i.test(n)) return "sd-gundam-world-heroes";
  if (/創傑伝/.test(n)) return "sd-gundam-world-soketsuden";
  if (/武者|頑駄無|戦国伝|戦国アストレイ|機兵伝説|大将軍|闇将軍/.test(n)) return "sd-sengokuden";
  if (/騎士|ナイトガンダム|SDガンダム外伝|剣士ゼータ|闘士/.test(n)) return "sd-gundam-gaiden";
  if (sdLine && /三国伝|三国/.test(n)) return "sd-sangokuden";
  // 戦国伝 characters (蒼天丸, 超将軍闘我, 少年法師霧丸) and 三国伝 troops / mounts (部隊兵, 白銀流星馬)
  if (sdLine && /BB戦士/.test(n) && /丸|将軍|法師|導師|軍師|剣豪|精太/.test(nfkc(cleaned))) return "sd-sengokuden";
  if (sdLine && /BB戦士/.test(n) && /^[一-鿿]{2,}$/.test(nfkc(cleaned).replace(/\s+/g, ""))) return "sd-sangokuden";
  if (sdLine && /BB戦士/.test(n)) {
    const m = nfkc(cleaned).match(/^(?:[一-鿿]{1,5}\s+)?([一-鿿]{1,4})\s*(?=[ァ-ヶA-Za-zΑ-Ωα-ω0-9])/);
    if (m && !MS_KANJI_PREFIX.test(m[1])) return "sd-sangokuden";
  }
  return null;
}
