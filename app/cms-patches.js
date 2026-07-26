const PREVIEW_KEY = "gunpula-cms-preview-v1";
const PUBLISHED_CACHE_KEY = "gunpula-cms-published-cache-v1";

function cachedPublishedState() {
  try {
    return JSON.parse(localStorage.getItem(PUBLISHED_CACHE_KEY) || "null");
  } catch {
    return null;
  }
}

function mergeObjects(base, patch) {
  const output = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeObjects(output[key], value);
    } else {
      output[key] = structuredClone(value);
    }
  }
  return output;
}

export async function loadCmsPublishedState(config = {}) {
  if (new URLSearchParams(location.search).get("cms-preview") === "1") {
    try {
      const preview = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "null");
      if (preview?.payload) return preview;
    } catch {
      // Ignore a malformed local preview and continue with the public release.
    }
  }
  if (!config.url || !config.anonKey) return cachedPublishedState();
  try {
    const response = await fetch(`${String(config.url).replace(/\/+$/, "")}/rest/v1/rpc/gunpula_cms_get_published`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!response.ok) return cachedPublishedState();
    const published = await response.json();
    localStorage.setItem(PUBLISHED_CACHE_KEY, JSON.stringify(published));
    return published;
  } catch {
    return cachedPublishedState();
  }
}

export function applyCmsCatalog(baseKits, payload = {}) {
  const records = new Map((baseKits || []).map((kit) => [kit.kit_id, kit]));
  for (const [id, kit] of Object.entries(payload.added || {})) {
    records.set(id, { ...kit, kit_id: id });
  }
  return [...records.entries()]
    .filter(([id]) => !payload.merges?.[id])
    .map(([id, kit]) => mergeObjects(kit, payload.products?.[id]));
}

export function cmsSeriesLabelOverrides(payload = {}) {
  const overrides = {};
  for (const category of Object.values(payload.categories || {})) {
    if (category?.key && category?.labels && (!category.kind || ["series", "product_line"].includes(category.kind))) {
      overrides[category.key] = { ...category.labels };
    }
  }
  return overrides;
}

export function applyCmsAtlasGroups(atlasGroups = {}, payload = {}) {
  const next = structuredClone(atlasGroups || {});
  const sourceKeys = {
    gundam: "gundam_timeline",
    armored_core: "armored_core",
    pokemon: "pokemon",
    fate: "fate",
  };
  for (const category of Object.values(payload.categories || {})) {
    const groups = next[sourceKeys[category?.franchise]];
    if (!Array.isArray(groups)) continue;

    if (category.id?.startsWith("gundam:work:")) {
      const workId = Number(category.linked_work_id || category.id.split(":").at(-1));
      const work = groups.flatMap((group) => group.works || []).find((item) => Number(item.work_id) === workId);
      if (!work) continue;
      if (category.labels) work.labels = mergeObjects(work.labels, category.labels);
      if (category.cover_url) work.image = category.cover_url;
      if (category.sort != null) work.cms_sort = Number(category.sort);
      continue;
    }

    const group = groups.find((item) => item.id === category.key);
    if (!group) continue;
    if (category.labels) group.labels = mergeObjects(group.labels, category.labels);
    if (category.subtitle) group.subtitle = mergeObjects(group.subtitle, category.subtitle);
    if (category.cover_url) group.image = category.cover_url;
    if (category.aliases) group.aliases = [...category.aliases];
    if (category.sort != null) group.cms_sort = Number(category.sort);
  }
  const productRelations = { ...(payload.products || {}), ...(payload.added || {}) };
  for (const [kitId, product] of Object.entries(productRelations)) {
    for (const relation of product.taxonomy_ids || []) {
      const parts = String(relation).split(":");
      if (parts[1] !== "atlas") continue;
      const groups = next[sourceKeys[parts[0]]];
      const group = Array.isArray(groups) ? groups.find((item) => item.id === parts.slice(2).join(":")) : null;
      if (!group) continue;
      group.kit_ids = [...new Set([...(group.kit_ids || []), kitId])];
      group.count = group.kit_ids.length;
    }
  }
  for (const groups of Object.values(next)) {
    if (!Array.isArray(groups)) continue;
    groups.sort((a, b) => Number(a.cms_sort ?? Number.MAX_SAFE_INTEGER) - Number(b.cms_sort ?? Number.MAX_SAFE_INTEGER));
    for (const group of groups) {
      if (Array.isArray(group.works)) {
        group.works.sort((a, b) => Number(a.cms_sort ?? Number.MAX_SAFE_INTEGER) - Number(b.cms_sort ?? Number.MAX_SAFE_INTEGER));
      }
    }
  }
  return next;
}

export function resolveCmsMerge(kitId, payload = {}) {
  let current = kitId;
  const seen = new Set();
  while (payload.merges?.[current] && !seen.has(current)) {
    seen.add(current);
    current = payload.merges[current];
  }
  return current;
}
