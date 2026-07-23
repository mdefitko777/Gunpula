// Thin data layer for the rewrite. During development it reads the published
// catalog JSON from GitHub Pages so the Ionic app can run without a local copy
// of the data pipeline; once merged, this points at the co-located ./data.
const DATA_BASE = import.meta.env.DEV ? "https://mdefitko777.github.io/Gunpula/data" : "../data";

export async function loadFranchise(franchise) {
  const res = await fetch(`${DATA_BASE}/split/kits-${franchise}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${franchise}`);
  const data = await res.json();
  return data.kits || [];
}

// The daily "recently added" feed. Prefer the lite build; fall back to the full
// one. Never throws — recent-added is a convenience over the month view.
export async function loadUpdateFeed() {
  for (const name of ["update-feed-lite.json", "update-feed.json"]) {
    try {
      const res = await fetch(`${DATA_BASE}/${name}`);
      if (res.ok) return await res.json();
    } catch {
      // try next
    }
  }
  return { entries: [] };
}
