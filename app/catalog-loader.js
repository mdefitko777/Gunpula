const REMOTE_DATA_BASE = "https://mdefitko777.github.io/Gunpula/";

export function isNativeShell() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

export async function loadJson(path) {
  if (isNativeShell() && path.startsWith("../")) {
    try {
      return await fetchJson(`${REMOTE_DATA_BASE}${path.slice(3)}`);
    } catch {
      // Offline or Pages unreachable: use the bundled snapshot below.
    }
  }
  return fetchJson(path);
}

export async function loadOptionalJson(path) {
  try {
    return await loadJson(path);
  } catch {
    return null;
  }
}

export async function loadInitialKitsDoc(activeFranchise) {
  const manifest = await loadOptionalJson("../data/split/manifest.json");
  const franchises = Object.keys(manifest?.franchises || {});
  if (!franchises.length) {
    return { doc: await loadJson("../data/kits.json"), pendingFranchises: [] };
  }
  const first = franchises.includes(activeFranchise) ? activeFranchise : franchises.includes("gundam") ? "gundam" : franchises[0];
  const doc = await loadOptionalJson(`../data/split/kits-${first}.json`);
  if (!doc?.kits) {
    return { doc: await loadJson("../data/kits.json"), pendingFranchises: [] };
  }
  return { doc, pendingFranchises: franchises.filter((franchise) => franchise !== first) };
}
