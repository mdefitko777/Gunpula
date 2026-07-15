const DISPLAYED_MARKET_SOURCES = new Set(["naver_shop", "bunjang", "joongna"]);

export function marketSources(marketPrices) {
  return [...(marketPrices?.sources || [])]
    .filter((source) => DISPLAYED_MARKET_SOURCES.has(source.id))
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));
}

export function marketRecordForKit(marketPrices, kit) {
  return kit?.kit_id ? marketPrices?.by_kit?.[kit.kit_id] || null : null;
}

export function marketListingsForKit(marketPrices, kit) {
  if (!kit?.kit_id) return [];
  return (marketPrices?.listings || []).filter((listing) => listing.kit_id === kit.kit_id);
}

export function marketSourceStatusClass(source) {
  if (source.ready === true) return "is-ready";
  if (source.ready === "manual") return "is-manual";
  if (source.ready === "cache") return "is-cache";
  return "is-missing";
}

export function formatKrw(value, pendingLabel = "") {
  return Number.isFinite(Number(value)) ? `₩${Number(value).toLocaleString("ko-KR")}` : pendingLabel;
}

export function formatMarketDate(value, pendingLabel = "") {
  return String(value || pendingLabel).slice(0, 10);
}

export function marketSearchUrl(source, query) {
  const template = source?.search_url_template;
  if (!template || !query) return "";
  return template.replace("{query}", encodeURIComponent(query));
}

export function marketSearchLinksForKit(sources, query, limit = 8) {
  return sources
    .map((source) => ({ source, url: marketSearchUrl(source, query) }))
    .filter((item) => item.url)
    .slice(0, limit);
}
