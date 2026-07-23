import { reactive, computed } from "vue";
import { TRANSLATIONS } from "@app/i18n.js";
import { FRANCHISES, kitDisplayNameFor, franchiseShortLabelFor, gradeShortLabelFor } from "@app/catalog-display.js";
import { WORLD_THEME_CONFIG, localizedWorldText } from "@app/world-themes.js";
import { getString, setString, getJson, setJson } from "@app/storage.js";
import { normalizeCollection } from "@app/collection-store.js";
import { recentFeedKits, releaseItemsForMonth, defaultReleaseMonth, validReleaseMonth } from "@app/update-feed.js";
import { loadFranchise, loadUpdateFeed } from "../services/catalog";

const LANG_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const COLLECTION_KEY = "gunpula-catalog-collection-v1";
const LANGS = ["zh", "ko", "en", "ja"];
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
  releaseMonth: "",
  loading: false,
  error: null,
});

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
    setFranchise,
    ensureFranchise,
    ensureAllFranchises,
    ensureUpdateFeed,
    recentAddedKits,
    releaseMonthKits,
    defaultMonth,
    setReleaseMonth,
    kitById,
    collectionStatus,
    setCollectionStatus,
    toggleCollectionStatus,
    ownedIds: computed(() => state.collection.owned || []),
    wantedIds: computed(() => state.collection.wanted || []),
    franchises: FRANCHISES,
    currentKits: computed(() => state.catalogByFranchise[state.franchise] || []),
    ...helpers,
  };
}
