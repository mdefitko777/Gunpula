// Display names for Aniplex+ Fate goods.
//
// Aniplex+ titles event and campaign goods with the bare product type:
// 「メインビジュアル B2タペストリー」 is sold by ten different campaigns (FGO Fes.
// 2021 … 2026, Winter Festival, the stay night 20th concert …), and
// 「サーヴァント別 描き下ろしイラスト A4クリアファイル B（全5種）」 says nothing
// about which event drew the servants. In the app those records cannot be told
// apart, so the importer qualifies such a name with the campaign the product page
// files it under (the last breadcrumb, e.g. 「Fate/Grand Order Fes. 2024 9th
// Anniversary」オリジナルグッズ通販) and keeps the store's own title in
// `source_name`.

const nfkc = (value) => String(value || "").normalize("NFKC");

// A Fate / TYPE-MOON work, or a quoted title, already in the name is context enough.
const WORK_CONTEXT = /Fate|TYPE[-\s]?MOON|型月|FGO|月姫|空の境界|魔法使いの夜|カルデア|[「『]/i;

// Labels Aniplex+ puts in front of campaign artwork goods.
const GENERIC_PREFIX = /^(?:メインビジュアル|イメージアート|キービジュアル|ご当地イラスト|地域イラスト|サーヴァント別|オフィシャル|ピックアップ)/;

// Product-type words, sizes, counts and punctuation. A name made of nothing
// else ("B2タペストリー", "アクリルスタンド<A>(全40種)", "トートバッグ") names
// no work, event or character.
const GOODS_WORDS = new RegExp(
  [
    "メインビジュアル|イメージアート|描き下ろしイラスト|イラスト|オフィシャル|ピックアップ|ランダム|グリッター|プレミアム",
    "ビッグ|ミニ|ロング|スケルトン|ステーショナリー|コンプリート|トラベル|ストラップ付|ジャンボ",
    "アクリル(?:スタンド|マスコット|チャーム|ブロック|プレート|キーホルダー)?|缶バッジ|バッジ|ピンズ",
    "クリアファイル|ファイル|クリアカード|カード|タペストリー|ポスター|半裁|キャラファイングラフ|色紙|複製",
    "Tシャツ|シャツ|マフラータオル|ハンドタオル|タオル|パーカー|キャップ|トートバッグ|トート|バッグ|リュックサック|ポーチ",
    "パンフレット|チケットホルダー|トレカホルダー|フォトホルダー|ホルダー|ポートレイト|ラバー|デスク|マット|コースター",
    "ハンカチーフ|オペラグラス|マルチケース|ハードケース|ケース|ステッカー|シール|オルゴール|竹うちわ|うちわ|扇子|掛け軸風",
    "カラビナ|サーモボトル|マグカップ|プラ|クリア|ブランケット|クッション|ブックカバー|マスキングテープ|メモ|ノート|ペン",
    "プチ缶コレクション|パタパタメモ|ポロ|SD|セット|ロゴ|個|枚|入り|付き",
    "全\\s*\\d+\\s*(?:種|色|グループ)(?:ランダム)?|\\d+",
    "[ABS]\\d",
  ].join("|"),
  "g",
);
const SINGLE_LETTER = /(?<![A-Za-z])[A-Z](?![A-Za-z])/g;
const PUNCTUATION = /[\s&＆・/\-_()（）［］[\]〈〉<>＜＞【】]/g;

// localize_catalog.mjs respaces names ("Fate/stay night" → "Fate / stay night"),
// so a stored name and a freshly scraped one are compared without spaces.
export const nameKey = (value) => nfkc(value).replace(/\s+/g, "");

export function sameName(a, b) {
  return nameKey(a) === nameKey(b);
}

export function lacksContext(name) {
  const value = nfkc(name);
  if (WORK_CONTEXT.test(value)) return false;
  if (GENERIC_PREFIX.test(value)) return true;
  return value.replace(GOODS_WORDS, "").replace(SINGLE_LETTER, "").replace(PUNCTUATION, "") === "";
}

/**
 * Names that need a campaign prefix: shared by another Fate record, or with no
 * work, event or character in them. `nameCounts` maps each nameKey() to the
 * number of Fate records (every source) that use it.
 */
export function needsQualifier(name, nameCounts) {
  return (nameCounts.get(nameKey(name)) || 0) > 1 || lacksContext(name);
}

const decode = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&times;/g, "×")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&rdquo;|&ldquo;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;|&mdash;/g, "-")
    .replace(/&hellip;/g, "…")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

// Last breadcrumb of an Aniplex+ product page: the campaign page it is sold under.
export function aniplexCampaign(html) {
  const nav = /<ol class="breadcrumb-nav__list">([\s\S]*?)<\/ol>/.exec(String(html || ""))?.[1] || "";
  const crumbs = [...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) => decode(match[1])).filter(Boolean);
  const last = crumbs.at(-1) || "";
  return last && last !== "TOP" ? last : null;
}

// Sales wording around the campaign title, which says nothing about the product.
const SALES_SUFFIX =
  /\s*(?:[<＜≪(（]\s*)?(?:イベント)?(?:オリジナル|オフィシャル)?(?:グッズ)?(?:事後|一般|会場)?(?:通販|販売|受注)(?:\s*[>＞≫)）])?\s*$|\s*(?:オリジナル|オフィシャル)グッズ\s*$/;

export function campaignLabel(campaign) {
  let label = decode(campaign).trim();
  // 「Fate/Grand Order Fes. 2024 9th Anniversary」オリジナルグッズ通販 → the quoted title.
  const quoted = /^[「『](.+?)[」』]\s*(.*)$/.exec(label);
  // Only when nothing but sales wording follows: 『Fate/stay night』20周年記念コンサート Finale … keeps the whole title.
  if (quoted && !` ${quoted[2]}`.replace(SALES_SUFFIX, "").trim()) label = quoted[1];
  for (let i = 0; i < 3; i += 1) label = label.replace(SALES_SUFFIX, "").trim();
  return label.replace(/\s+/g, " ").trim() || null;
}

export function qualifiedName(campaign, name) {
  const label = campaignLabel(campaign);
  const value = String(name || "").trim();
  if (!label) return value;
  // The campaign is already in the name (a few stay night concert goods repeat it).
  const bare = (text) => nfkc(text).replace(/[\s「」『』]/g, "");
  if (bare(value).includes(bare(label))) return value;
  return `${label} ${value}`;
}
