// Shared catalog-cleanup rules: what is not a collectible, which records are
// sale pages of a product the catalog already has, and which real grade a
// Premium Bandai / Gashapon record hides behind GUNDAM_MERCH.
//
// Importers use these before they create a record, and clean_catalog.mjs runs
// them over the whole catalog after every import, so a record that slipped in
// once is dropped again on the next daily run. Every dropped kit_id is written to
// data/kit-aliases.json: apps key saved collections on kit_id, so they need to
// know whether a vanished id moved to another record or was removed on purpose.
//
// All matching runs on NFKC-normalised text. Premium Bandai and BANDAI SPIRITS
// write grade prefixes and scales in full-width (ＨＧ, ＲＧ, １／１４４), which a
// plain /^HG\b/ never sees.

export const KIT_ALIASES_PATH = "data/kit-aliases.json";

export function nfkc(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function kitNameText(kit) {
  const names = kit?.names || {};
  return nfkc(names.ja || names.ko || names.en || names.zh || "");
}

// ---------------------------------------------------------------------------
// Non-collectibles
// ---------------------------------------------------------------------------

// Words that mark a character good people collect (figures, plush, acrylic,
// keychains, badges, capsule toys). Apparel/household words next to them do not
// make the item a T-shirt or a mug: "ぬいぐるみポーチ", "인형 파우치", a gashapon
// "ラバーコースター".
const CHARACTER_GOODS =
  /ぬいぐるみ|ちびぐるみ|フィギュア|figure|アクリル|キーホルダー|キーチェーン|キーリング|マスコット|缶バッジ|バッジ|ピンズ|チャーム|ガシャポン|カプセル|コレクション|モンコレ|プラモ|ガンプラ|인형|피규어|키링|키홀더|뱃지|마스코트|아크릴/i;

// Media and other things that are not collectible goods even when they carry a
// character: these win over CHARACTER_GOODS ("Blu-ray【A-on 有償特典：アクリルパネル付き】"
// is still a Blu-ray).
const MEDIA_RULES = [
  ["media_video", /Blu-?ray|ブルーレイ|\bDVD\b|BD[ -]?Box|4Kリマスター\s*BOX/i],
  [
    "media_audio",
    /Drama CD|ドラマCD|\bCD(?!ケース)(?:\d|[ 枚]|$|&)|Original Soundtrack|サウンドトラック|Live Album|アナログレコード|\+\s*OST\b|\bOST\s*(?:앨범|album)|OST 앨범|\bLP\b/i,
  ],
  ["video_game", /PlayStation|<\s*(?:PS[345]|Nintendo Switch\s*2?|Switch\s*2?)\s*>|\bXbox\b/i],
  ["board_game", /ボードゲーム|Board Game/i],
  ["ticket", /チケット\s*(?:≪|<<|抽選|リセール)|(?:入場|観覧|参加)券(?!付)/],
  // Bulk-buy pages ("【６個まとめ買い】") sell n copies of a kit the catalog has.
  ["sales_page", /販売ページ$|まとめ買い/],
  [
    "book",
    /画集(?!表紙|描き下ろし)|ART ?WORKS|図録|記録全集|MEMORIAL BOOK|Anniversary ALBUM|Trailer's Trail|advertising works|設定資料集|お疲れ様本|^CONCEPT ?\d$/i,
  ],
  ["pamphlet", /パンフレット/],
  [
    "card_game",
    /(?<!ジャンボ)カードダス|カードゲーム(?!.*(?:アクリル|チャーム))|BOOSTER PACK|ブースターパック|SDコマンド戦記 ミッションボックス|^(?:新約)?SDガンダム外伝(?!.*(?:BB戦士|SDX|フィギュア|ガシャポン))/i,
  ],
  // "HGPG プチッガイ ソーダポップブルー&アイスキャンディー" is a kit colour name.
  ["food", /(?<!プチッガイ.*)(?:クッキー|グミ(?!ュ)|キャンディ|お菓子|焼き菓子)/],
];

const GOODS_RULES = [
  [
    "apparel",
    /Tシャツ|T-shirt|シャツ|パーカー|ジャケット|ロゴトレーナー|スウェット|ジャージ|キャップ|ニット帽|ソックス|靴下|サングラス|ネックレス|ペンダント|ブローチ|イヤリング|バレッタ|トートバッグ|ショルダーバッグ|STRICT-G.*バックパック|ヘルメットバッグ|リュック|ポーチ|PVCケース|SLEEPING BAG|ATTACHKIT|9FORTY|FLeeasy|티셔츠|셔츠|점퍼|바람막이|볼캡|모자|양말|토트백|에코백|파우치|백팩|복조리백|배스로브|슬리퍼|입는 담요|미니 백팩/i,
  ],
  [
    "household",
    /マグカップ|グラス(?=$|[\s(（])|タンブラー|ジョッキ|ラバーコースター|バスタオル|タオル|マルチクロス|クッション|ブランケット|ホースリール|ハンディファン|シャープペンシル|텀블러|머그|유리컵|양치컵|보울|뚝배기|수세미|인덕션매트|러그|타월|바디필로우|테이블|우산|칫솔|샤워볼|아이스 트레이|벽시계|충전기|스피커|손거울|줄자|노트|볼펜|젤펜|메모패드|점착 메모|캘린더|투두리스트|책받침|그립 홀더/i,
  ],
];

// Hobby supplies (decals, LED units, builders parts) — tools for building kits,
// which import_bandai_spirits_gunpla.mjs already leaves out of the catalog.
// Plastic accessory kits are not supplies: HGBC weapon/backpack sets, the
// オプションパーツセット ガンプラ line, the ガンダムベース限定 1/100 MSエフェクト /
// MSスパイク / MSバーニア kits and the ビルダーズパーツ システムベース action base
// are injection-moulded Gunpla, often PB or Gundam Base limiteds. They stay,
// tagged accessory-kit (ACCESSORY_KIT).
const GUNDAM_HOBBY_SUPPLY = /ガンダムデカール|ガンプラLEDユニット|^LEDユニット|ビルダーズパーツ(?!.*システムベース)/i;

export const ACCESSORY_KIT =
  /オプションパーツセット ?ガンプラ|MS(?:エフェクト|スパイク|バーニア)\d|^(?:【[^】]*】\s*)*(?:ガンダムベース限定 )?HGBC\b|ビルダーズパーツ.*システムベース/i;

/**
 * Why a record is not a collectible, or null when it is one.
 * `kit` needs names (and franchise for the Gundam-only hobby-supply rule).
 */
export function nonCollectibleReason(kit) {
  const name = kitNameText(kit);
  if (!name) return null;
  for (const [reason, pattern] of MEDIA_RULES) {
    if (pattern.test(name)) return reason;
  }
  if ((kit.franchise || "gundam") === "gundam" && GUNDAM_HOBBY_SUPPLY.test(name)) return "hobby_supply";
  if (CHARACTER_GOODS.test(name)) return null;
  for (const [reason, pattern] of GOODS_RULES) {
    if (pattern.test(name)) return reason;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gundam grade detection from product names
// ---------------------------------------------------------------------------

const P = "(?:^|[\\s】\\]』)])"; // start of name or after a 【tag】
const GUNDAM_GRADE_RULES = [
  // Anchored, so a gashapon "機動戦士ガンダム ROBOT魂 ミニチュアコレクション" stays merch.
  [/^(?:【[^】]*】\s*)*(?:EXPO\d+ )?METAL ROBOT魂/i, "METAL_ROBOT"],
  [/^(?:【[^】]*】\s*)*METAL BUILD/i, "METAL_BUILD"],
  [/^(?:【[^】]*】\s*)*(?:EXPO\d+ )?ROBOT魂/i, "ROBOT_SPIRITS"],
  [/S\.H\.Figuarts/i, "SH_FIGUARTS"],
  [/GUNDAM CONVERGE/i, "CONVERGE"],
  [/Gフレーム/, "GFRAME"],
  [/MOBILE SUIT ENSEMBLE/i, "MSE"],
  [/ガシャポン戦士(?:フォルテ|f\b)/i, "GSF"],
  [/メガサイズ/, "MEGA"],
  [new RegExp(`${P}EXモデル`), "EX"],
  [/SDガンダム ?クロスシルエット|SDCS/, "SDCS"],
  [/SDガンダム ?EXスタンダード/, "SDEX"],
  // SD三国創傑伝 (2019-) is SD Gundam World; the 2010 BB戦士 三国伝 stays SD.
  [/SDW ?HEROES|SD(?:ガンダム)? ?(?:ワールド ?)?三国創傑伝/, "SDW"],
  [/BB戦士|LEGEND ?BB/, "SD"],
  [/ハイレゾリューションモデル|Hi-Resolution Model/i, "HIRM"],
  [/ENTRY GRADE/i, "EG"],
  [/FULL MECHANICS/i, "FM"],
  [/^(?:【[^】]*】\s*)*HY2M\b/, "HY2M"],
  // Plastic accessory kits whose names carry no grade token.
  [/オプションパーツセット ?ガンプラ|MS(?:エフェクト|スパイク|バーニア)\d|システムベース/, "NG"],
];

// Grade tokens: the one that comes first in the name wins, so "MG サザビー
// Ver.Ka & RE/100 ナイチンゲール用 エフェクトセット" is an MG set, not an RE/100 kit.
const GRADE_TOKENS = [
  [new RegExp(`${P}MGSD(?=\\s)`), "MGSD"],
  [new RegExp(`${P}MGEX(?=\\s)`), "MGEX"],
  [new RegExp(`${P}PG ?UNLEASHED(?=\\s)`, "i"), "PGU"],
  [new RegExp(`${P}RE ?/ ?100(?=\\s)`), "RE100"],
  // HGCC (the 月光蝶 effect unit) and HGBC (Build Custom parts) are HG lines too.
  [new RegExp(`${P}HG(?:UC|CE|AC|FC|BF|BD|BC|CC|IBO|GTO|BD:R)?(?=\\s)`), "HG"],
  [new RegExp(`${P}MG(?=\\s)`), "MG"],
  [new RegExp(`${P}RG(?=\\s)`), "RG"],
  [new RegExp(`${P}PG(?=\\s)`), "PG"],
  [new RegExp(`${P}EG(?=\\s)`), "EG"],
  [new RegExp(`${P}FM(?=\\s)`), "FM"],
];

// A plain scale with no grade line is the No Grade (NG) range, e.g. the
// After War "1/100 ガンダムヴァサーゴ HG" reruns (HG there is the old 1/100 HG).
const NO_GRADE = /^(?:【[^】]*】\s*)*1 ?\/ ?(?:48|60|100|144|220|550)\s/;

export function gundamGradeFromName(name) {
  const text = nfkc(name);
  for (const [pattern, code] of GUNDAM_GRADE_RULES) {
    if (pattern.test(text)) return code;
  }
  let best = null;
  for (const [pattern, code] of GRADE_TOKENS) {
    const match = pattern.exec(text);
    if (match && (!best || match.index < best.index)) best = { index: match.index, code };
  }
  if (best) return best.code;
  return NO_GRADE.test(text) ? "NG" : null;
}

// "RG1/1ガンダムプロジェクトVer." and "REAL GRADE 1/1 GUNDAM PROJECT" name the
// 1/1 statue in Odaiba, not the scale of the kit.
export const REAL_GRADE_1_1 = /(?:REAL GRADE|RG) ?1 ?\/ ?1(?!\d)|1 ?\/ ?1 ?(?:GUNDAM PROJECT|ガンダムプロジェクト)/gi;

export function scaleFromName(name) {
  const match = /(?:^|[^\d/])1 ?\/ ?(24|35|48|60|72|100|144|200|220|250|550|1700)(?![\d])/.exec(nfkc(name).replace(REAL_GRADE_1_1, " "));
  return match ? `1/${match[1]}` : null;
}

/** Image id of a Bandai product photo (bandai-a.akamaihd.net/bc/img/model/b/<id>_1.jpg). */
export function bandaiImageId(url) {
  return /\/bc\/img\/model\/[a-z]\/(\d{10})_\d+\./.exec(String(url || ""))?.[1] || null;
}

/**
 * BANDAI SPIRITS cards occasionally point at the CMS-internal host
 * (http://internal-pbn/bc/img/…), which no browser can reach; the same path on
 * bandai-a.akamaihd.net answered 404 when checked (2026-11-02). Such a URL is
 * dropped rather than shipped as a broken image.
 */
export function publicBandaiImageUrl(url) {
  if (!url) return url;
  return /^https?:\/\/internal-pbn\//i.test(String(url)) ? null : String(url);
}

// ---------------------------------------------------------------------------
// Sale-batch / resale pages
// ---------------------------------------------------------------------------

// 【抽選販売】, 【2次：2027年5月発送分】, 【再販】, 【事後販売】, 【受注販売】,
// 【2026年11月発送】 … mark a sale of a product, not a different product.
// 【２次】 (NFKC turns the digits ASCII), 【特典対象】, 【特典付】 and a bare
// shipping month 【２０２１年４月】 mark a sale too.
const SALE_TAG =
  /【(?:[^】]*(?:抽選|発送|再販|事後販売|受注販売|受注生産|予約|送料|販売|プレバン|プレミアムバンダイ|PB限定|PBの日|開催記念|会場|限定品オンライン|特別再販|お届け|総選挙|ご購入の権利|特典|\d+次|\d{4}年\s*\d{1,2}月)[^】]*)】|※会場受け取り|ご購入の権利|\(\d+月お届け分[^)]*\)/g;

export function stripSaleTags(name) {
  return nfkc(name).replace(SALE_TAG, " ").replace(/\s+/g, " ").trim();
}

// Tags clean_catalog.mjs adds; importers keep them when they re-import a kit.
export const CLEANUP_TAGS = ["accessory-kit", "premium-bandai-sale", "gashapon-wave"];

/**
 * Re-import of `previous` as `kit` without losing what clean_catalog.mjs folded
 * into it: source refs of other sources (the PB pages it absorbed), the Premium
 * Bandai flags and order window, and the cleanup tags. Importers overwrite
 * every field they own, so without this the next daily run wiped the PB refs
 * and flags again.
 */
export function carryCleanupFields(previous, kit) {
  if (!previous) return kit;
  const own = new Set((kit.source_refs || []).map((ref) => ref.source_id));
  const foreignRefs = (previous.source_refs || []).filter((ref) => !own.has(ref.source_id));
  const pbFlagged = previous.is_premium_bandai === true || kit.is_premium_bandai === true;
  const tags = [...(kit.tags || []), ...(previous.tags || []).filter((tag) => CLEANUP_TAGS.includes(tag) && !(kit.tags || []).includes(tag))];
  return {
    ...kit,
    is_limited: Boolean(kit.is_limited) || (previous.is_premium_bandai === true && previous.is_limited === true),
    ...(pbFlagged ? { is_premium_bandai: true } : {}),
    ...(previous.premium_bandai && !kit.premium_bandai ? { premium_bandai: previous.premium_bandai } : {}),
    source_refs: [...(kit.source_refs || []), ...foreignRefs],
    tags,
  };
}

/** True when the name carries a sale tag (resale, lottery, Nth batch, shipping month …). */
export function hasSaleTag(name) {
  return new RegExp(SALE_TAG.source).test(nfkc(name));
}

// Model codes such as RX-78-2, ZGMF-X10A, RX-78GP01Fb, GN-0000+GNR-010. Premium
// Bandai often leaves them out of a name that BANDAI SPIRITS writes with one.
const MODEL_CODE = /\b[A-Z]{1,5}-[A-Za-z0-9]+(?:\s?[-/+]\s?[A-Za-z0-9]+)*\b/g;

export function hasModelCode(name) {
  return new RegExp(MODEL_CODE.source).test(stripSaleTags(name));
}

// Comparison key for "same product": sale tags, line prefix, scale, punctuation
// and spaces removed. With keepCodes=false the model codes go too.
export function productKey(name, { keepCodes = true } = {}) {
  let text = stripSaleTags(name)
    .replace(/<SIDE MS>|〈SIDE MS〉/gi, " ")
    // "(RFV)" is how Premium Bandai abbreviates 復讐のレクイエム.
    .replace(/\bRFV\b/g, "復讐のレクイエム")
    .replace(/^(?:METAL ROBOT魂|ROBOT魂|METAL BUILD)\s*(?:\((?:Ka signature)\))?/i, " ")
    .replace(new RegExp(`${P}(?:HGUC|HGCE|HGAC|HGFC|HG|MGSD|MGEX|MG|RG|PG UNLEASHED|PG|RE ?/ ?100|EG)(?=\\s)`), " ")
    // After War reruns: "1/100 ガンダムヴァサーゴ HG" is the 1996 1/100 HG kit.
    .replace(/^(1 ?\/ ?100 .+?)\s+HG$/, "$1")
    .replace(/1 ?\/ ?\d{2,4}/g, " ");
  if (!keepCodes) text = text.replace(MODEL_CODE, " ");
  return text.replace(/[\s・·()（）［］\[\]「」『』〔〕<>〈〉~～\-‐－—_/.,、。:：&＆!！?？'"“”+]/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// kit-aliases.json
// ---------------------------------------------------------------------------

export function emptyAliases() {
  return { schema: 1, updated_at: null, aliases: {}, excluded: {} };
}

/** Follow alias chains (a→b, b→c) to the surviving record. */
export function resolveAlias(aliases, kitId) {
  let current = kitId;
  const seen = new Set();
  while (aliases[current] && !seen.has(current)) {
    seen.add(current);
    current = aliases[current];
  }
  return current;
}

/** Ids an importer must not create again (aliased away or excluded). */
export function retiredKitIds(doc) {
  return new Set([...Object.keys(doc?.aliases || {}), ...Object.keys(doc?.excluded || {})]);
}
