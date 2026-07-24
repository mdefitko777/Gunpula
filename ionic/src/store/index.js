import { reactive, computed } from "vue";
import { TRANSLATIONS } from "@app/i18n.js";
import { FRANCHISES, kitDisplayNameFor, franchiseShortLabelFor, gradeShortLabelFor } from "@app/catalog-display.js";
import { WORLD_THEME_CONFIG, localizedWorldText } from "@app/world-themes.js";
import { getString, setString, getJson, setJson } from "@app/storage.js";
import { normalizeCollection, mergeCollectionState } from "@app/collection-store.js";
import { recentFeedKits, releaseItemsForMonth, defaultReleaseMonth, validReleaseMonth } from "@app/update-feed.js";
import { loadFranchise, loadUpdateFeed, loadAtlasGroups, loadBbxDatabase } from "../services/catalog";

const LANG_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const COLLECTION_KEY = "gunpula-catalog-collection-v1";
const THEME_KEY = "gunpula-catalog-theme-v1";
const LANGS = ["zh", "ko", "en", "ja"];
const THEMES = ["auto", "light", "dark"];

function initialTheme() {
  const saved = getString(THEME_KEY);
  return THEMES.includes(saved) ? saved : "auto";
}

// Toggle Ionic's dark palette class on <html>. auto follows the system.
export function applyTheme() {
  const theme = initialTheme();
  const dark = theme === "dark" || (theme === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("ion-palette-dark", dark);
}
// Local self member matches the vanilla app's default so an existing local
// collection carries over untouched. Sync/login overrides this later.
const SELF = "member";

function initialLang() {
  const saved = getString(LANG_KEY);
  return LANGS.includes(saved) ? saved : "zh";
}

function initialFranchise() {
  const saved = getString(FRANCHISE_KEY);
  return FRANCHISES.includes(saved) ? saved : "gundam";
}

// One shared reactive store for the whole app (Vue reactive — no Pinia needed
// for this size). Holds language, current world, and a per-franchise catalog
// cache filled lazily.
const state = reactive({
  language: initialLang(),
  franchise: initialFranchise(),
  catalogByFranchise: {},
  collection: normalizeCollection(getJson(COLLECTION_KEY, {}), { self: SELF }),
  updateFeed: null,
  atlasGroups: null,
  bbx: null,
  releaseMonth: "",
  theme: initialTheme(),
  // View state the gestures can drive, so radial/swipe and the on-screen
  // segments stay in sync.
  recentMode: "recent",
  collectionTab: "wanted",
  filters: { series: "", grade: "", year: "", limited: "", priceMin: null, priceMax: null },
  syncRevision: 0,
  loading: false,
  error: null,
});

const RECENT_MODES = ["recent", "month", "all"];
const COLLECTION_TABS = ["wanted", "owned"];

// --- Catalog filters ------------------------------------------------------
function emptyFilters() {
  return { series: "", grade: "", year: "", limited: "", priceMin: null, priceMax: null };
}

function setFilter(key, value) {
  if (!(key in state.filters)) return;
  state.filters[key] = value === "" || value === null || value === undefined ? emptyFilters()[key] : value;
}

function clearFilters() {
  Object.assign(state.filters, emptyFilters());
}

function activeFilterCount() {
  const f = state.filters;
  return [f.series, f.grade, f.year, f.limited].filter(Boolean).length
    + (Number.isFinite(f.priceMin) ? 1 : 0)
    + (Number.isFinite(f.priceMax) ? 1 : 0);
}

function kitSeriesKey(kit) {
  return kit.series?.key || kit.work_title || "";
}

function kitSeriesLabel(kit) {
  const labels = kit.series?.labels;
  return (labels && (labels[state.language] || labels.zh || labels.en)) || kit.work_title || "";
}

function kitYear(kit) {
  const y = String(kit.release_date || "").slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "";
}

// Apply the active filters to a list of kits.
function applyFilters(kits) {
  const f = state.filters;
  return kits.filter((kit) => {
    if (f.series && kitSeriesKey(kit) !== f.series) return false;
    if (f.grade && kit.grade_code !== f.grade) return false;
    if (f.year && kitYear(kit) !== f.year) return false;
    if (f.limited === "limited" && !kit.is_limited) return false;
    if (f.limited === "regular" && kit.is_limited) return false;
    const price = Number(kit.price_jpy);
    if (Number.isFinite(f.priceMin) && !(price >= f.priceMin)) return false;
    if (Number.isFinite(f.priceMax) && !(price <= f.priceMax)) return false;
    return true;
  });
}

// Option lists with counts, derived from the current world's kits.
function filterOptions(kits) {
  const count = (fn) => {
    const map = new Map();
    for (const kit of kits) {
      const v = fn(kit);
      if (!v) continue;
      map.set(v, (map.get(v) || 0) + 1);
    }
    return map;
  };
  const seriesCounts = count(kitSeriesKey);
  const seriesLabels = new Map();
  for (const kit of kits) {
    const key = kitSeriesKey(kit);
    if (key && !seriesLabels.has(key)) seriesLabels.set(key, kitSeriesLabel(kit));
  }
  return {
    series: [...seriesCounts.entries()]
      .map(([value, n]) => ({ value, label: seriesLabels.get(value) || value, count: n }))
      .sort((a, b) => b.count - a.count),
    grade: [...count((k) => k.grade_code).entries()]
      .map(([value, n]) => ({ value, label: helpers.gradeLabel(value), count: n }))
      .sort((a, b) => b.count - a.count),
    year: [...count(kitYear).entries()]
      .map(([value, n]) => ({ value, label: value, count: n }))
      .sort((a, b) => b.value.localeCompare(a.value)),
    limited: [
      { value: "limited", label: t("limitedOnly"), count: kits.filter((k) => k.is_limited).length },
      { value: "regular", label: t("regularOnly"), count: kits.filter((k) => !k.is_limited).length },
    ],
  };
}

function setRecentMode(mode) {
  if (RECENT_MODES.includes(mode)) state.recentMode = mode;
}

function setCollectionTab(tab) {
  if (COLLECTION_TABS.includes(tab)) state.collectionTab = tab;
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  state.theme = theme;
  setString(THEME_KEY, theme);
  applyTheme();
}

// --- 图鉴 (Atlas groups) --------------------------------------------------
// Each world keys into a different atlas bucket; gundam's is the timeline.
const ATLAS_KEY_BY_FRANCHISE = {
  gundam: "gundam_timeline",
  pokemon: "pokemon",
  fate: "fate",
  armored_core: "armored_core",
};

async function ensureAtlasGroups() {
  if (state.atlasGroups) return state.atlasGroups;
  state.atlasGroups = await loadAtlasGroups();
  return state.atlasGroups;
}

async function ensureBbx() {
  if (state.bbx) return state.bbx;
  state.bbx = await loadBbxDatabase();
  return state.bbx;
}

// Beyblade X has no atlas groups, so synthesize the same shape from its own
// database: complete beys plus one group per part category (陀螺 / 部品).
const BBX_PART_LABELS = {
  blade: { zh: "刃", ko: "블레이드", en: "Blade", ja: "ブレード" },
  ratchet: { zh: "齿轮", ko: "래칫", en: "Ratchet", ja: "ラチェット" },
  bit: { zh: "轴尖", ko: "비트", en: "Bit", ja: "ビット" },
  assist_blade: { zh: "辅助刃", ko: "어시스트 블레이드", en: "Assist Blade", ja: "アシストブレード" },
  lock_chip: { zh: "锁片", ko: "락 칩", en: "Lock Chip", ja: "ロックチップ" },
  main_blade: { zh: "主刃", ko: "메인 블레이드", en: "Main Blade", ja: "メインブレード" },
  metal_blade: { zh: "金属刃", ko: "메탈 블레이드", en: "Metal Blade", ja: "メタルブレード" },
  over_blade: { zh: "上刃", ko: "오버 블레이드", en: "Over Blade", ja: "オーバーブレード" },
};

function bbxGroups() {
  const db = state.bbx;
  if (!db) return [];
  const partsLabel = { zh: "部品", ko: "부품", en: "Parts", ja: "パーツ" };
  const groups = [];
  if (Array.isArray(db.series) && db.series.length) {
    groups.push({
      id: "bbx-series",
      labels: { zh: "完成品陀螺", ko: "완성 베이", en: "Complete Beys", ja: "完成ベイ" },
      subtitle: { zh: "整机", ko: "완성", en: "Complete", ja: "完成" },
      count: db.series.length,
      items: db.series,
    });
  }
  for (const [key, list] of Object.entries(db.parts || {})) {
    if (!Array.isArray(list) || !list.length) continue;
    groups.push({
      id: `bbx-${key}`,
      labels: BBX_PART_LABELS[key] || { zh: key, ko: key, en: key, ja: key },
      subtitle: partsLabel,
      count: list.length,
      items: list,
    });
  }
  return groups;
}

function guideGroups(franchise = state.franchise) {
  if (franchise === "beyblade") return bbxGroups();
  const key = ATLAS_KEY_BY_FRANCHISE[franchise];
  return (key && state.atlasGroups?.franchises?.[key]) || [];
}

// Lit = how many of a group's kits are already owned or wanted.
function guideGroupProgress(group) {
  const ids = group.kit_ids || [];
  const owned = new Set(state.collection.owned || []);
  const wanted = new Set(state.collection.wanted || []);
  const lit = ids.filter((id) => owned.has(id) || wanted.has(id)).length;
  return { lit, total: ids.length || group.count || (group.works || []).length };
}

// --- Recent / releases feed ----------------------------------------------
async function ensureUpdateFeed() {
  if (state.updateFeed) return state.updateFeed;
  state.updateFeed = await loadUpdateFeed();
  return state.updateFeed;
}

// 最近添加 (recently added by the daily pipeline), scoped to the current world.
function recentAddedKits(days = 3) {
  if (!state.updateFeed) return [];
  return recentFeedKits(state.updateFeed, { days, displayKitById: kitById })
    .filter((kit) => kit.franchise === state.franchise);
}

// 本月发售 for the current world (only needs kits + release_date).
function releaseMonthKits(month = state.releaseMonth) {
  const kits = state.catalogByFranchise[state.franchise] || [];
  return releaseItemsForMonth(kits, { month, nameForSort: (k) => helpers.name(k) });
}

function defaultMonth() {
  return defaultReleaseMonth(state.catalogByFranchise[state.franchise] || []);
}

function setReleaseMonth(month) {
  state.releaseMonth = validReleaseMonth(month) || defaultMonth();
}

// --- Collection (owned / wanted) -----------------------------------------
// The store owns the self member's items; toggling rebuilds member_items and
// re-normalizes so owned/wanted arrays stay in sync, then persists.
function collectionStatus(kitId) {
  return state.collection.items?.[kitId]?.status || null;
}

function setCollectionStatus(kitId, status) {
  const now = new Date().toISOString();
  const members = structuredCloneSafe(state.collection.member_items || {});
  members[SELF] = members[SELF] || {};
  if (status === null) {
    delete members[SELF][kitId];
  } else {
    const prev = members[SELF][kitId] || {};
    members[SELF][kitId] = { ...prev, status, quantity: prev.quantity || 1, updated_at: now, updated_by: SELF };
  }
  state.collection = normalizeCollection({ member_items: members }, { self: SELF });
  setJson(COLLECTION_KEY, { member_items: state.collection.member_items });
}

// --- Account sync ---------------------------------------------------------
// Same payload shape as the vanilla build, so both clients round-trip cleanly.
function syncRevision() {
  return state.syncRevision || 0;
}

function cloudPayload() {
  return {
    schema_version: 1,
    collection: normalizeCollection(state.collection, { self: SELF }),
  };
}

// Merge the remote collection into the local one (last-write-wins per entry,
// handled by mergeCollectionState) and persist the result.
function syncPull(remote) {
  const stateObject = Array.isArray(remote) ? remote[0] : remote;
  if (!stateObject) return;
  state.syncRevision = Number(stateObject.revision || 0);
  const remoteCollection = stateObject.payload?.collection;
  if (!remoteCollection) return;
  const merged = mergeCollectionState(state.collection, remoteCollection, { self: SELF });
  state.collection = normalizeCollection(merged, { self: SELF });
  setJson(COLLECTION_KEY, { member_items: state.collection.member_items });
}

async function syncPush() {
  const { pushState } = await import("../services/sync");
  const result = await pushState(cloudPayload(), syncRevision(), "ionic");
  const stateObject = Array.isArray(result) ? result[0] : result;
  if (stateObject?.revision) state.syncRevision = Number(stateObject.revision);
  return result;
}

// Toggle: tapping the current status clears it, otherwise sets it.
function toggleCollectionStatus(kitId, status) {
  setCollectionStatus(kitId, collectionStatus(kitId) === status ? null : status);
}

function structuredCloneSafe(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

// Mirror the vanilla app's translator: current language, fall back to zh, then
// the raw key; interpolate {placeholders}.
function t(key, params = {}) {
  const template = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ""));
}

async function ensureAllFranchises() {
  await Promise.all(FRANCHISES.map((f) => ensureFranchise(f)));
}

// Resolve a kit id against every loaded franchise (a collection can hold kits
// from any world).
function kitById(kitId) {
  for (const list of Object.values(state.catalogByFranchise)) {
    const hit = list.find((k) => k.kit_id === kitId);
    if (hit) return hit;
  }
  return null;
}

async function ensureFranchise(franchise = state.franchise) {
  if (state.catalogByFranchise[franchise]) return state.catalogByFranchise[franchise];
  state.loading = true;
  state.error = null;
  try {
    const kits = await loadFranchise(franchise);
    state.catalogByFranchise[franchise] = kits;
    return kits;
  } catch (e) {
    state.error = String(e.message || e);
    state.catalogByFranchise[franchise] = [];
    return [];
  } finally {
    state.loading = false;
  }
}

function setLanguage(lang) {
  if (!LANGS.includes(lang)) return;
  state.language = lang;
  setString(LANG_KEY, lang);
}

function setFranchise(franchise) {
  if (!FRANCHISES.includes(franchise)) return;
  state.franchise = franchise;
  setString(FRANCHISE_KEY, franchise);
}

// Atlas labels/subtitles are {zh,ko,en,ja} objects (or plain strings).
function atlasLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[state.language] || value.zh || value.en || value.ja || value.ko || "";
}

// Display helpers bound to the current language.
const helpers = {
  name: (kit) => kitDisplayNameFor(kit, state.language),
  franchiseLabel: (franchise) => franchiseShortLabelFor(franchise, state.language),
  gradeLabel: (code) => gradeShortLabelFor(code, state.language),
  worldText: (value) => localizedWorldText(value, state.language),
  worldConfig: (franchise = state.franchise) => WORLD_THEME_CONFIG[franchise] || WORLD_THEME_CONFIG.gundam,
};

export function useStore() {
  return {
    state,
    t,
    setLanguage,
    setTheme,
    setRecentMode,
    setCollectionTab,
    setFilter,
    clearFilters,
    activeFilterCount,
    applyFilters,
    filterOptions,
    recentModes: RECENT_MODES,
    collectionTabs: COLLECTION_TABS,
    languages: LANGS,
    themes: THEMES,
    setFranchise,
    ensureFranchise,
    ensureAllFranchises,
    ensureUpdateFeed,
    ensureAtlasGroups,
    ensureBbx,
    guideGroups,
    guideGroupProgress,
    atlasLabel,
    recentAddedKits,
    releaseMonthKits,
    defaultMonth,
    setReleaseMonth,
    kitById,
    collectionStatus,
    setCollectionStatus,
    toggleCollectionStatus,
    syncPull,
    syncPush,
    ownedIds: computed(() => state.collection.owned || []),
    wantedIds: computed(() => state.collection.wanted || []),
    franchises: FRANCHISES,
    currentKits: computed(() => state.catalogByFranchise[state.franchise] || []),
    ...helpers,
  };
}
