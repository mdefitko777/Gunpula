export const EMPTY_CMS_STATE = Object.freeze({
  revision: 0,
  products: {},
  added: {},
  categories: {},
  merges: {},
  sources: {},
  image_tasks: {},
  reviews: {},
});

export function cloneCmsState(value = EMPTY_CMS_STATE) {
  return {
    revision: Number(value.revision || 0),
    products: structuredClone(value.products || {}),
    added: structuredClone(value.added || {}),
    categories: structuredClone(value.categories || {}),
    merges: structuredClone(value.merges || {}),
    sources: structuredClone(value.sources || {}),
    image_tasks: structuredClone(value.image_tasks || {}),
    reviews: structuredClone(value.reviews || {}),
  };
}

export function mergeObjects(base, patch) {
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

export function applyChange(state, change) {
  const next = cloneCmsState(state);
  const type = change.entity_type;
  const id = change.entity_id;
  const patch = change.patch || {};
  if (!id) return next;

  if (type === "product") {
    if (change.operation === "add") {
      next.added[id] = mergeObjects(next.added[id], patch);
    } else {
      next.products[id] = mergeObjects(next.products[id], patch);
    }
  } else if (type === "category") {
    next.categories[id] = mergeObjects(next.categories[id], patch);
  } else if (type === "merge") {
    next.merges[id] = String(patch.target_id || "");
  } else if (type === "source") {
    next.sources[id] = mergeObjects(next.sources[id], patch);
  } else if (type === "image_task") {
    next.image_tasks[id] = mergeObjects(next.image_tasks[id], patch);
  } else if (type === "review") {
    next.reviews[id] = mergeObjects(next.reviews[id], patch);
  }
  return next;
}

export function applyDrafts(published, drafts = []) {
  return drafts
    .filter((change) => change.status === "draft")
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .reduce(applyChange, cloneCmsState(published));
}

export function applyProductPatch(product, patch = {}) {
  return mergeObjects(product, patch);
}

export function resolveMerge(id, merges = {}) {
  let current = id;
  const seen = new Set();
  while (merges[current] && !seen.has(current)) {
    seen.add(current);
    current = merges[current];
  }
  return current;
}

export function materializeCatalog(baseKits, cmsState, options = {}) {
  const state = cloneCmsState(cmsState);
  const base = new Map((baseKits || []).map((kit) => [kit.kit_id, kit]));
  for (const [id, record] of Object.entries(state.added)) {
    base.set(id, { ...record, kit_id: id });
  }
  return [...base.entries()]
    .filter(([id]) => resolveMerge(id, state.merges) === id)
    .map(([id, kit]) => applyProductPatch(kit, state.products[id]))
    .filter((kit) => options.includeHidden || kit.data_status !== "hidden");
}

export function displayName(product, language = "zh") {
  const fallbacks = {
    zh: ["zh", "ja", "en", "ko"],
    ko: ["ko", "ja", "en", "zh"],
    en: ["en", "ja", "zh", "ko"],
    ja: ["ja", "en", "zh", "ko"],
  }[language] || ["zh", "ja", "en", "ko"];
  for (const code of fallbacks) {
    if (product?.names?.[code]) return product.names[code];
  }
  return product?.kit_id || "Untitled";
}

export function imageUrl(product) {
  return product?.images?.box_art_url || product?.gallery_image_urls?.[0] || "";
}

export function seriesKey(product) {
  return product?.series?.key || product?.series_key || product?.work_title || "unclassified";
}

export function validateProduct(product, existingIds = new Set(), originalId = "") {
  const errors = [];
  const id = String(product?.kit_id || "").trim();
  if (!/^[a-z0-9]+[a-z0-9-]*$/.test(id)) errors.push("商品 ID 只能使用小写字母、数字和连字符");
  if (id !== originalId && existingIds.has(id)) errors.push("商品 ID 已存在");
  if (!["gundam", "armored_core", "pokemon", "beyblade", "fate"].includes(product?.franchise)) errors.push("请选择主题");
  if (!Object.values(product?.names || {}).some(Boolean)) errors.push("至少填写一种语言名称");
  if (product?.release_date && !/^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(product.release_date)) errors.push("发售日期格式应为 YYYY、YYYY-MM 或 YYYY-MM-DD");
  if (product?.price_jpy != null && (!Number.isInteger(Number(product.price_jpy)) || Number(product.price_jpy) < 0)) errors.push("日元定价必须是非负整数");
  return errors;
}

export function productPatchFromForm(values, original) {
  const patch = {
    franchise: values.franchise,
    names: {
      zh: values.name_zh || null,
      ko: values.name_ko || null,
      en: values.name_en || null,
      ja: values.name_ja || null,
    },
    grade_code: values.grade_code || "OTHER",
    subline: values.subline || null,
    universe: values.universe || null,
    work_title: values.work_title || null,
    series: {
      ...(original?.series || {}),
      key: values.series_key || "unclassified",
    },
    release_date: values.release_date || null,
    price_jpy: values.price_jpy === "" ? null : Number(values.price_jpy),
    is_limited: Boolean(values.is_limited),
    data_status: values.data_status || "needs_review",
    tags: String(values.tags || "").split(",").map((value) => value.trim()).filter(Boolean),
    taxonomy_ids: Array.isArray(values.taxonomy_ids) ? values.taxonomy_ids.filter(Boolean) : [],
    images: {
      ...(original?.images || {}),
      box_art_url: values.cover_url || null,
      box_art_source_id: original?.images?.box_art_source_id || null,
    },
    gallery_image_urls: String(values.gallery_urls || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    source_urls: String(values.source_urls || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    notes: values.notes || null,
  };
  return patch;
}

function atlasCategory(franchise, group, index, kind) {
  return {
    id: `${franchise}:atlas:${group.id}`,
    franchise,
    key: group.id,
    kind,
    labels: { ...(group.labels || {}) },
    subtitle: { ...(group.subtitle || {}) },
    sort: (index + 1) * 10,
    cover_url: group.image || "",
    aliases: [...(group.aliases || [])],
    linked_kit_ids: [...(group.kit_ids || [])],
    count: group.kit_ids?.length ?? group.count ?? 0,
  };
}

function atlasCategories(atlasGroups = {}) {
  const franchises = atlasGroups.franchises || {};
  const records = [];

  for (const [index, group] of (franchises.pokemon || []).entries()) {
    records.push(atlasCategory("pokemon", group, index, "generation"));
  }
  for (const [index, group] of (franchises.fate || []).entries()) {
    records.push(atlasCategory("fate", group, index, group.id.startsWith("fgo_") ? "chapter" : "work"));
  }
  for (const [index, group] of (franchises.armored_core || []).entries()) {
    records.push(atlasCategory("armored_core", group, index, "game"));
  }
  for (const [index, group] of (franchises.gundam_timeline || []).entries()) {
    const parent = atlasCategory("gundam", group, index, "timeline");
    parent.count = group.works?.length || group.count || 0;
    records.push(parent);
    for (const [workIndex, work] of (group.works || []).entries()) {
      const name = String(work.name || `Work ${work.work_id}`);
      records.push({
        id: `gundam:work:${work.work_id}`,
        franchise: "gundam",
        key: `work_${work.work_id}`,
        kind: "work",
        labels: { zh: name, ko: name, en: name, ja: name },
        subtitle: { zh: "高达作品", ko: "건담 작품", en: "Gundam work", ja: "ガンダム作品" },
        sort: (index + 1) * 1000 + workIndex,
        cover_url: work.image || "",
        aliases: [],
        parent_id: parent.id,
        linked_work_id: work.work_id,
        count: 0,
      });
    }
  }
  return records;
}

export function categoryRecords(kits, cmsState, atlasGroups = {}) {
  const records = new Map();
  for (const kit of kits || []) {
    if (!["gundam", "beyblade"].includes(kit.franchise)) continue;
    const key = seriesKey(kit);
    const id = `${kit.franchise}:${key}`;
    const existing = records.get(id) || {
      id,
      franchise: kit.franchise,
      key,
      kind: kit.franchise === "beyblade" ? "product_line" : "series",
      labels: { zh: key, ko: key, en: key, ja: key },
      sort: kit.series?.sort ?? 999,
      cover_url: imageUrl(kit),
      count: 0,
    };
    existing.count += 1;
    for (const code of ["zh", "ko", "en", "ja"]) {
      existing.labels[code] = kit.series?.labels?.[code] || existing.labels[code];
    }
    records.set(id, existing);
  }
  for (const category of atlasCategories(atlasGroups)) {
    records.set(category.id, category);
  }
  for (const [id, patch] of Object.entries(cmsState?.categories || {})) {
    records.set(id, mergeObjects(records.get(id) || { id, count: 0 }, patch));
  }
  for (const kit of kits || []) {
    for (const relation of kit.taxonomy_ids || []) {
      const category = records.get(relation)
        || records.get(`${kit.franchise}:atlas:${relation}`)
        || records.get(`${kit.franchise}:${relation}`);
      if (!category) continue;
      const linked = new Set(category.linked_kit_ids || []);
      linked.add(kit.kit_id);
      category.linked_kit_ids = [...linked];
      category.count = linked.size;
    }
  }
  return [...records.values()].sort((a, b) => (
    a.franchise.localeCompare(b.franchise)
    || String(a.kind || "").localeCompare(String(b.kind || ""))
    || Number(a.sort || 999) - Number(b.sort || 999)
  ));
}
