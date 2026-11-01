// Parsers for archived Premium Bandai Japan pages (import_pbandai_wayback.mjs),
// kept apart from the importer so the unit tests can load them without a run.

export function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

// "【２次：２０１９年７月発送】" / "【2026年10月発送】" in a card name -> 2019-07.
export function listingNameMonth(name) {
  const match = /(\d{4})年\s*(\d{1,2})月[^】]{0,4}?発送/.exec(String(name).normalize("NFKC"));
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}`;
}

// One card of the category list: item id, name, price, shipping month, image.
export function parseListingCards(html) {
  const cards = [];
  for (const block of html.split('<div class="article_area">').slice(1)) {
    const itemId = /\/item\/item-(\d{10})\//.exec(block)?.[1];
    const name = decodeEntities(/<p class="article_title"><a[^>]*>([\s\S]*?)<\/a>/.exec(block)?.[1]?.replace(/<[^>]+>/g, "") || "");
    if (!itemId || !name) continue;
    const price = Number(/<p class="price">([\d,]+)円/.exec(block)?.[1]?.replace(/,/g, ""));
    const ship = /RESERVE_(\d{4})(\d{2})\.gif/.exec(block);
    const thumb = /<img src="((?:https?:)?\/\/bandai-a\.akamaihd\.net\/bc\/img\/model\/[a-z]\/\d+_1\.jpg)"/.exec(block)?.[1];
    const icons = [...block.matchAll(/icon\/[A-Z_0-9]+\.gif" alt="([^"]*)"/g)].map((match) => match[1]);
    cards.push({
      item_url: `https://p-bandai.jp/item/item-${itemId}/`,
      item_id: itemId,
      name,
      description: "",
      // The list shows the 90px thumbnail (model/m); model/b is the same photo full size.
      image: thumb ? thumb.replace(/^\/\//, "https://").replace("/model/m/", "/model/b/") : null,
      price_jpy: Number.isFinite(price) && price > 0 ? price : null,
      availability: icons.includes("在庫無し") ? "sold_out" : icons.includes("予約") ? "preorder" : null,
      work_title: null,
      // Older cards have no shipping icon, but the name often says
      // "【２次：２０１９年７月発送】".
      release_date: ship ? `${ship[1]}-${ship[2]}` : listingNameMonth(name),
      order_opens_at: null,
      order_closes_at: null,
    });
  }
  return cards;
}
