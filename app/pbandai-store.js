export function pbandaiItems(pbandaiDoc) {
  const items = Array.isArray(pbandaiDoc) ? pbandaiDoc : Array.isArray(pbandaiDoc?.items) ? pbandaiDoc.items : [];
  return items
    .filter((item) => item && item.url)
    .slice()
    .sort((a, b) => {
      const aRank = a.fetch_status === "ok" ? 0 : 1;
      const bRank = b.fetch_status === "ok" ? 0 : 1;
      return aRank - bRank || String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
}

export function pbandaiFranchiseForItem(item) {
  if (item?.franchise) {
    return item.franchise === "gunpla" ? "gundam" : item.franchise;
  }
  if (item?.category === "gunpla") {
    return "gundam";
  }
  return item?.category || "gundam";
}

export function pbandaiFranchises(pbandaiDoc, allowedFranchises) {
  return [...new Set(pbandaiItems(pbandaiDoc).map(pbandaiFranchiseForItem).filter((franchise) => allowedFranchises.includes(franchise)))];
}

export function pbandaiItemsForFranchise(pbandaiDoc, franchise) {
  return pbandaiItems(pbandaiDoc).filter((item) => pbandaiFranchiseForItem(item) === franchise);
}

export function safePBandaiImageUrl(item) {
  const candidates = [item?.image, item?.image_url, item?.thumbnail, item?.thumb, ...(item?.images || [])].filter(Boolean);
  return candidates.find((url) => /^https?:\/\//.test(String(url))) || "";
}
