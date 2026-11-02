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
// Goods (non-model products)
// ---------------------------------------------------------------------------
//
// Blu-rays, CDs, books, tickets, apparel, mugs, card games … stay in the
// catalog as goods: clean_catalog.mjs sets `category: "goods"`, a `goods_kind`
// sub-category the apps label (티켓 · 의류 · 생활용품 · 블루레이 · 음반 · 책 …)
// and the franchise's goods grade. Only a record of the wrong franchise / IP
// is removed (a curated `excluded` entry in data/kit-aliases.json).
//
// goods_kind values (Hobby Atlas lib/data/gunpula.dart goodsKindLabels):
export const GOODS_KINDS = [
  "ticket",
  "apparel",
  "accessory",
  "household",
  "stationery",
  "acrylic",
  "media_video",
  "media_audio",
  "book",
  "pamphlet",
  "food",
  "video_game",
  "board_game",
  "card_game",
  "hobby_supply",
  "other",
];

// Words that mark a character good people collect (figures, plush, acrylic,
// keychains, badges, capsule toys). Apparel/household words next to them do not
// make the item a T-shirt or a mug: "ぬいぐるみポーチ", "인형 파우치", a gashapon
// "ラバーコースター".
const CHARACTER_GOODS =
  /ぬいぐるみ|ちびぐるみ|フィギュア|figure|アクリル|キーホルダー|キーチェーン|キーリング|マスコット|缶バッジ|バッジ|ピンズ|チャーム|ガシャポン|カプセル|コレクション|モンコレ|プラモ|ガンプラ|인형|피규어|키링|키홀더|뱃지|마스코트|아크릴/i;

// Media and other products that are goods even when they carry a character:
// these win over CHARACTER_GOODS ("Blu-ray【A-on 有償特典：アクリルパネル付き】"
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
  // A sales page for in-game currency ("聖晶石販売ページ") or a bulk-buy page.
  ["other", /販売ページ$|まとめ買い/],
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
  ["accessory", /サングラス|ネックレス|ペンダント|ブローチ|イヤリング|バレッタ/],
  [
    "apparel",
    /Tシャツ|T-shirt|シャツ|パーカー|ジャケット|ロゴトレーナー|スウェット|ジャージ|キャップ|ニット帽|ソックス|靴下|トートバッグ|ショルダーバッグ|STRICT-G.*バックパック|ヘルメットバッグ|リュック|ポーチ|PVCケース|SLEEPING BAG|ATTACHKIT|9FORTY|FLeeasy|티셔츠|셔츠|점퍼|바람막이|볼캡|모자|양말|토트백|에코백|파우치|백팩|복조리백|배스로브|슬리퍼|입는 담요|미니 백팩/i,
  ],
  ["stationery", /シャープペンシル|노트|볼펜|젤펜|메모패드|점착 메모|캘린더|투두리스트|책받침/],
  [
    "household",
    /マグカップ|グラス(?=$|[\s(（])|タンブラー|ジョッキ|ラバーコースター|バスタオル|タオル|マルチクロス|クッション|ブランケット|ホースリール|ハンディファン|텀블러|머그|유리컵|양치컵|보울|뚝배기|수세미|인덕션매트|러그|타월|바디필로우|테이블|우산|칫솔|샤워볼|아이스 트레이|벽시계|충전기|스피커|손거울|줄자|그립 홀더/i,
  ],
];

// Hobby supplies (decals, LED units) — tools for building kits. Plastic
// accessory kits are kits, not supplies: HGBC weapon/backpack sets, the
// オプションパーツセット ガンプラ line, ビルダーズパーツHD (MSバーニア, MSエフェクト,
// MSスパイク, MSハンド … injection-moulded detail parts, also sold as BPHD), the
// ガンダムベース限定 1/100 MSエフェクト / MSスパイク / MSバーニア kits and the
// ビルダーズパーツ システムベース action base. They stay kits, tagged accessory-kit.
const GUNDAM_HOBBY_SUPPLY = /ガンダムデカール|ガンプラLEDユニット|^(?:【[^】]*】\s*)*LEDユニット|ビルダーズパーツ(?! ?HD)(?!.*システムベース)/i;

export const ACCESSORY_KIT =
  /オプションパーツセット ?ガンプラ|MS(?:エフェクト|スパイク|バーニア)\d|^(?:【[^】]*】\s*)*(?:ガンダムベース限定 )?HGBC\b|ビルダーズパーツ ?HD|^BPHD\b|ビルダーズパーツ.*システムベース/i;

/**
 * The goods_kind of a record that is not a model kit / figure, or null.
 * `kit` needs names (and franchise for the Gundam-only hobby-supply rule).
 */
export function goodsKind(kit) {
  // The store's own title when the name carries a campaign prefix, so a campaign
  // such as 「… ART WORKS …」 does not make a tapestry a book.
  const name = kit?.source_name ? nfkc(kit.source_name) : kitNameText(kit);
  if (!name) return null;
  for (const [kind, pattern] of MEDIA_RULES) {
    if (pattern.test(name)) return kind;
  }
  if ((kit.franchise || "gundam") === "gundam" && GUNDAM_HOBBY_SUPPLY.test(name)) return "hobby_supply";
  if (CHARACTER_GOODS.test(name)) return null;
  for (const [kind, pattern] of GOODS_RULES) {
    if (pattern.test(name)) return kind;
  }
  return null;
}

// Grade a goods record gets in its franchise. Prize, kuji, gashapon and goods
// lines already say how the item is sold and keep their grade.
export const GOODS_GRADE = { gundam: "GUNDAM_MERCH", fate: "FATE_GOODS", pokemon: "POKE_GOODS" };
export const KEEPS_GRADE_AS_GOODS = /MERCH|GOODS|PRIZE|KUJI|GASHAPON/;

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
  // Tamashii brands Premium Bandai also sells; option parts of a 解体匠機
  // figure belong to the METAL STRUCTURE line.
  [/GUNDAM FIX FIGURATION/i, "GFF"],
  [/METAL STRUCTURE|解体匠機/i, "METAL_STRUCTURE"],
  // Plastic accessory kits whose names carry no grade token.
  [/オプションパーツセット ?ガンプラ|MS(?:エフェクト|スパイク|バーニア)\d|システムベース|ビルダーズパーツ ?HD|^BPHD\b/, "NG"],
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
// shipping month 【２０２１年４月】 mark a sale too, and so do 【イベント受け取り】
// pages and Tamashii's "（2022年2月発送分）" batch suffix.
const SALE_TAG =
  /【(?:[^】]*(?:抽選|発送|再販|事後販売|受注販売|受注生産|予約|送料|販売|プレバン|プレミアムバンダイ|PB限定|PBの日|開催記念|会場|受け取り|受取|限定品オンライン|特別再販|お届け|総選挙|ご購入の権利|特典|\d+次|\d{4}年\s*\d{1,2}月)[^】]*)】|※会場受け取り|ご購入の権利|\(\d+月お届け分[^)]*\)|\(\s*\d{4}年\s*\d{1,2}月(?:[上中下]旬)?発送分?\s*\)/g;

export function stripSaleTags(name) {
  return nfkc(name).replace(SALE_TAG, " ").replace(/\s+/g, " ").trim();
}

// Sale tags as they appear in a display name (full-width, not NFKC'd), so a
// live record's name loses 【抽選販売】【２次：２０１７年２月発送】 but keeps the
// rest of its original spelling.
const DISPLAY_SALE_TAG = new RegExp(
  SALE_TAG.source
    .replace(/\\\(/g, "[(（]")
    .replace(/\\\)/g, "[)）]")
    .replace(/\\d/g, "[0-9０-９]")
    .replace(/\\s/g, "[\\s　]")
    .replace(/PB/g, "[PＰ][BＢ]"),
  "g",
);

/** A display name without its sale-batch tags (null and empty stay as they are). */
export function stripDisplaySaleTags(name) {
  if (typeof name !== "string" || !name) return name;
  const stripped = name.replace(DISPLAY_SALE_TAG, " ").replace(/[\s　]+/g, " ").trim();
  return stripped || name;
}

// Tags clean_catalog.mjs adds; importers keep them when they re-import a kit.
export const CLEANUP_TAGS = ["accessory-kit", "premium-bandai-sale", "gashapon-wave"];

// ---------------------------------------------------------------------------
// Premium Bandai exclusives
// ---------------------------------------------------------------------------
//
// A BANDAI SPIRITS record does not say whether a kit was a Premium Bandai
// exclusive, and a PB page folded into it does not prove it either: Premium
// Bandai also runs lotteries (【抽選販売】), reruns (【２０２４年５月発送】,
// 【再販】【２次：…】) and plain shop pages for retail kits, and its item ids share
// the Bandai product id space, so even a PB page with the record's own photo id
// can be the shop page of a retail kit (NG 1/144 リ・ガズィ, 1987).
//
// What tells them apart is the BANDAI SPIRITS release date. A retail kit gets
// its shop day ("2014年04月26日", nearly always a Saturday, never pinned to the
// 1st); a PB item keeps the shipping month ("2015年06月予定") or the first of
// that month ("2020年06月01日"). So the evidence that counts:
//   * a page name that says プレミアムバンダイ限定 / プレバン限定 / PB限定;
//   * otherwise only for a record dated by month (or the 1st), 2012 or later
//     (2008-2011 retail kits are often listed by month too):
//       - its original PB listing (the page whose item id is the record's own
//         product photo id), even a lottery: the item was never sold elsewhere;
//       - any other PB sale page that is not a lottery (再販, Nth batch,
//         shipping month, plain shop page): PB reselling its own item.
//   A lottery page with a new item id is how PB sells scarce retail kits.
const EXPLICIT_PB_EXCLUSIVE = /プレミアムバンダイ限定|プレバン限定|PB限定/;
const LOTTERY_TAG = /抽選/;

function monthIndexOf(date) {
  const match = /^(\d{4})-(\d{2})/.exec(String(date || ""));
  return match ? Number(match[1]) * 12 + Number(match[2]) : null;
}

export const EXACT_RELEASE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a BANDAI SPIRITS date that is a retail shop day (an exact day other than the 1st). */
export function isGeneralReleaseDay(date) {
  const text = String(date || "");
  return EXACT_RELEASE_DAY.test(text) && !text.endsWith("-01");
}

/**
 * Whether the PB pages folded into `keeper` show it was a Premium Bandai
 * exclusive. `pages` are the pbandai-wb records ({ kit_id, names }).
 * Returns the reason, or null.
 */
export function premiumBandaiExclusiveEvidence(keeper, pages) {
  const names = pages.map((page) => nfkc(kitNameText(page)));
  if (names.some((name) => EXPLICIT_PB_EXCLUSIVE.test(name))) return "page says PB limited";
  if (isGeneralReleaseDay(keeper.release_date)) return null;
  const released = monthIndexOf(keeper.release_date);
  if (released == null || released < 2012 * 12 + 1) return null;
  const ownImage = bandaiImageId(keeper.images?.box_art_url);
  if (ownImage && pages.some((page) => page.kit_id === `pbandai-wb-${ownImage}`)) return "original PB listing";
  if (names.some((name) => !LOTTERY_TAG.test(name))) return "PB sale page of a kit without a shop day";
  return null;
}

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
    // Goods classification (clean_catalog.mjs) survives a re-import too.
    ...(previous.goods_kind && !kit.goods_kind ? { category: "goods", goods_kind: previous.goods_kind } : {}),
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
    // Every HG line prefix (HGUC, HGBF, HGBD:R …): Premium Bandai reruns of an
    // HGBF kit are named plain "ＨＧ".
    .replace(new RegExp(`${P}(?:HG[A-Z]{0,4}(?::R)?|MGSD|MGEX|MG|RG|PG UNLEASHED|PG|RE ?/ ?100|EG)(?=\\s)`), " ")
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
