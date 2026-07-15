import { getJson, getString, setJson } from "./storage.js";

export function normalizeFilterStateValue(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "all")
        .split(",")
        .map((item) => item.trim());
  const filtered = [...new Set(values.filter((item) => item && item !== "all"))];
  return filtered.length ? filtered.join(",") : "all";
}

export function preferredLanguage(languageKey, languages) {
  const language = getString(languageKey);
  return languages.some((item) => item.code === language) ? language : null;
}

export function loadSavedViewState({ viewStateKey, languageKey, languages }) {
  const parsed = getJson(viewStateKey, {});
  const stored = parsed && typeof parsed === "object" ? parsed : {};
  const storedLanguage = preferredLanguage(languageKey, languages) || stored.language;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  if (!hash) return { ...stored, language: storedLanguage };

  return {
    language: params.get("lang") || params.get("language") || storedLanguage || stored.language,
    franchise: params.get("franchise") || stored.franchise,
    series: params.get("series") || "all",
    grade: params.get("grade") || "all",
    itemType: params.get("type") || "all",
    releaseYear: params.get("year") || "all",
    limited: params.get("limited") || "all",
    priceMin: params.get("min") || "",
    priceMax: params.get("max") || "",
    query: params.get("q") || params.get("query") || "",
    kit: params.has("kit") ? params.get("kit") : null,
    view: params.get("view") || "catalog",
    modal: params.get("modal") || null,
  };
}

export function viewStateUrl(viewState, viewStateKey) {
  setJson(viewStateKey, viewState);
  const params = new URLSearchParams();
  if (viewState.language) params.set("lang", viewState.language);
  if (viewState.franchise) params.set("franchise", viewState.franchise);
  if (viewState.series && viewState.series !== "all") params.set("series", viewState.series);
  if (viewState.grade && viewState.grade !== "all") params.set("grade", viewState.grade);
  if (viewState.itemType && viewState.itemType !== "all") params.set("type", viewState.itemType);
  if (viewState.releaseYear && viewState.releaseYear !== "all") params.set("year", viewState.releaseYear);
  if (viewState.limited && viewState.limited !== "all") params.set("limited", viewState.limited);
  if (viewState.priceMin) params.set("min", viewState.priceMin);
  if (viewState.priceMax) params.set("max", viewState.priceMax);
  if (viewState.query) params.set("q", viewState.query);
  if (viewState.kit) params.set("kit", viewState.kit);
  if (viewState.view && viewState.view !== "catalog") params.set("view", viewState.view);
  if (viewState.modal) params.set("modal", viewState.modal);
  const nextHash = params.toString();
  return `${window.location.pathname}${window.location.search}${nextHash ? `#${nextHash}` : ""}`;
}
