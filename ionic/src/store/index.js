import { reactive, computed } from "vue";
import { TRANSLATIONS } from "@app/i18n.js";
import { FRANCHISES, kitDisplayNameFor, franchiseShortLabelFor, gradeShortLabelFor } from "@app/catalog-display.js";
import { WORLD_THEME_CONFIG, localizedWorldText } from "@app/world-themes.js";
import { getString, setString } from "@app/storage.js";
import { loadFranchise } from "../services/catalog";

const LANG_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const LANGS = ["zh", "ko", "en", "ja"];

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
  loading: false,
  error: null,
});

// Mirror the vanilla app's translator: current language, fall back to zh, then
// the raw key; interpolate {placeholders}.
function t(key, params = {}) {
  const template = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ""));
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
    franchises: FRANCHISES,
    currentKits: computed(() => state.catalogByFranchise[state.franchise] || []),
    ...helpers,
  };
}
