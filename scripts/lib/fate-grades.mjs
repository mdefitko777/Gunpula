// Grade rules for the extra Fate sources (Aniplex+, 一番くじ, Banpresto,
// Kotobukiya, Hobby Search, Tamashii Web). Mirrors the Good Smile importer's
// categories so items from different vendors land in the same buckets.

// A scale in a product name: "1/7スケール", "1/8". Not a session date such as
// "≪1/6(水)≫" (a digit or "(" follows) and not "1/1" (prop replicas).
const SCALE_PATTERN = /(?<![\d/])1\s?\/\s?(3|4|5|6|7|8|10|12)(?![\d(（])/;

// NFKC, but circled numbers stay out of it: "九州・沖縄①／8種入り" is not 1/8.
const normalize = (value) => String(value || "").replace(/[①-⓿❶-➓]/g, " ").normalize("NFKC");

export function scaleFor(name) {
  const match = SCALE_PATTERN.exec(normalize(name));
  return match ? `1/${match[1]}` : "non-scale";
}

/**
 * product: { name, line, series, is_figure } — is_figure comes from a detail
 * page that says 塗装済み完成品 for a figure whose tile name is only the character.
 */
export function gradeForProduct(product) {
  const text = normalize(`${product.name || ""} ${product.line || ""} ${product.series || ""}`);
  if (/ねんどろいど|ネンドロイド|Nendoroid/i.test(text)) return "NENDOROID";
  // Tamashii lines: フィギュアーツZERO is a statue, PROPLICA a prop replica,
  // Figuarts mini / 超合金 / アーマーガールズプロジェクト are action figures.
  if (/PROPLICA|プロップリカ/i.test(text)) return "FATE_GOODS";
  if (/フィギュアーツZERO|Figuarts\s*ZERO/i.test(text)) return "FATE_SCALE";
  if (/figma|アクションフィギュア|S\.H\.Figuarts|フィギュアーツ|Figuarts|超合金|アーマーガールズ|キューポッシュ/i.test(text)) return "FATE_ACTION";
  if (/ガシャポン|カプセル|ガチャ/i.test(text)) return "FATE_GASHAPON";
  // Store plush (ぬいぐるみ) is retail goods; prizes are what a prize/lottery line sells.
  if (/一番くじ|プライズ|景品|ちびぐるみ/i.test(text)) return "FATE_PRIZE";
  // Goods that only mention a figure: a carry case for one, a manga volume with one.
  if (/キャリーバッグ|付き限定版/.test(text)) return "FATE_GOODS";
  if (product.is_figure) return "FATE_SCALE";
  if (SCALE_PATTERN.test(text) || /スケール|フィギュア|Figure|POP UP PARADE|ARTFX|美少女|ConoFig|スタチュー|キャストドール/i.test(text)) {
    return "FATE_SCALE";
  }
  return "FATE_GOODS";
}
