const LANGUAGE_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const OVERRIDE_KEY = "gunpula-catalog-overrides-v1";

const LANGUAGES = [
  { code: "zh", label: "中", htmlLang: "zh-CN" },
  { code: "ko", label: "한", htmlLang: "ko-KR" },
  { code: "en", label: "EN", htmlLang: "en" },
  { code: "ja", label: "日", htmlLang: "ja" },
];

const FRANCHISES = ["gundam", "armored_core", "pokemon"];

const FRANCHISE_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "ガンダム" },
  armored_core: { zh: "Armored Core", ko: "아머드 코어", en: "Armored Core", ja: "アーマード・コア" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
};

const NAME_FALLBACKS = {
  zh: ["zh", "ja", "en", "ko"],
  ko: ["ko", "ja", "en", "zh"],
  en: ["en", "ja", "zh", "ko"],
  ja: ["ja", "en", "zh", "ko"],
};

const GRADE_SHORT_LABELS = {
  METAL_BUILD: { zh: "MB", ko: "MB", en: "MB", ja: "MB" },
  METAL_ROBOT: { zh: "MR魂", ko: "MR魂", en: "MR", ja: "MR魂" },
  ROBOT_SPIRITS: { zh: "R魂", ko: "R魂", en: "RS", ja: "R魂" },
  GUNDAM_MERCH: { zh: "周边", ko: "굿즈", en: "Goods", ja: "グッズ" },
  POKE_GASHAPON: { zh: "扭蛋", ko: "가샤폰", en: "Gashapon", ja: "ガシャポン" },
  POKEPLA: { zh: "拼装", ko: "프라모델", en: "Model Kit", ja: "プラモ" },
  AC30MM: { zh: "30MM", ko: "30MM", en: "30MM", ja: "30MM" },
  ACVI: { zh: "V.I.", ko: "V.I.", en: "V.I.", ja: "V.I." },
};

const TITLE_PREFIX_PATTERNS = [
  /^FW\s+(?:GUNDAM|高达|건담)\s+CONVERGE(?:[:：]CORE| CORE| EX\d+| #)?\s*/i,
  /^MOBILE SUIT ENSEMBLE(?:\s+mecha)?\s*/i,
  /^机动战士高达\s*/i,
  /^機動戦士ガンダム\s*/i,
  /^기동전사 건담\s*/i,
  /^Mobile Suit Gundam\s*/i,
  /^SDW HEROES\s*/i,
  /^BB戦士\d*\s*/i,
];

const TRANSLATIONS = {
  zh: {
    appTitle: "模型库",
    searchPlaceholder: "搜索名字 / 系列 / 产品线",
    filters: "筛选",
    productLine: "产品线",
    workSource: "系列",
    catalogList: "目录",
    officialPage: "官方商品页",
    manualCorrection: "手动更正",
    nameZh: "中文名",
    nameKo: "韩文名",
    nameEn: "英文名",
    nameJa: "日文名",
    subline: "子系列",
    universe: "宇宙 / 纪年",
    saveCorrection: "保存更正",
    clearCorrection: "清除本条",
    exportCorrections: "导出更正",
    closeDetail: "关闭详情",
    allProductLines: "全部产品线",
    allWorks: "全部系列",
    pending: "待补",
    noMatches: "没有匹配的记录。",
    records: "{count} 条",
    results: "{count} 条",
    summary: "{total} 条记录 · {parts} · 更新 {date}",
    detailsFor: "查看 {name} 详情",
    boxArtAlt: "{name} 封面图",
    imageAlt: "{name} 展示图 {index}",
    mainImageAlt: "{name} 主图",
    galleryImage: "展示图 {index}",
    franchise: "分类",
    scale: "比例",
    release: "发售",
    price: "定价",
    correctionStatus: "更正状态",
    corrected: "已手动更正",
    imported: "官方导入",
  },
  ko: {
    appTitle: "모델 DB",
    searchPlaceholder: "이름 / 시리즈 / 라인 검색",
    filters: "필터",
    productLine: "제품 라인",
    workSource: "시리즈",
    catalogList: "목록",
    officialPage: "공식 상품 페이지",
    manualCorrection: "수동 수정",
    nameZh: "중국어 이름",
    nameKo: "한국어 이름",
    nameEn: "영어 이름",
    nameJa: "일본어 이름",
    subline: "하위 시리즈",
    universe: "세계관 / 연표",
    saveCorrection: "수정 저장",
    clearCorrection: "이 항목 초기화",
    exportCorrections: "수정 내보내기",
    closeDetail: "상세 닫기",
    allProductLines: "전체 제품 라인",
    allWorks: "전체 시리즈",
    pending: "보완 필요",
    noMatches: "일치하는 기록이 없습니다.",
    records: "{count}개",
    results: "{count}개",
    summary: "{total}개 기록 · {parts} · 업데이트 {date}",
    detailsFor: "{name} 상세 보기",
    boxArtAlt: "{name} 박스 아트",
    imageAlt: "{name} 이미지 {index}",
    mainImageAlt: "{name} 메인 이미지",
    galleryImage: "이미지 {index}",
    franchise: "분류",
    scale: "스케일",
    release: "발매",
    price: "가격",
    correctionStatus: "수정 상태",
    corrected: "수동 수정됨",
    imported: "공식 가져오기",
  },
  en: {
    appTitle: "Model DB",
    searchPlaceholder: "Search name / series / line",
    filters: "Filters",
    productLine: "Product line",
    workSource: "Series",
    catalogList: "Catalog",
    officialPage: "Official product page",
    manualCorrection: "Manual correction",
    nameZh: "Chinese name",
    nameKo: "Korean name",
    nameEn: "English name",
    nameJa: "Japanese name",
    subline: "Subline",
    universe: "Universe / era",
    saveCorrection: "Save correction",
    clearCorrection: "Clear item",
    exportCorrections: "Export corrections",
    closeDetail: "Close detail",
    allProductLines: "All product lines",
    allWorks: "All series",
    pending: "Pending",
    noMatches: "No matching records.",
    records: "{count} records",
    results: "{count} records",
    summary: "{total} records · {parts} · updated {date}",
    detailsFor: "View {name} details",
    boxArtAlt: "{name} box art",
    imageAlt: "{name} image {index}",
    mainImageAlt: "{name} main image",
    galleryImage: "Image {index}",
    franchise: "Franchise",
    scale: "Scale",
    release: "Release",
    price: "Price",
    correctionStatus: "Correction status",
    corrected: "Manually corrected",
    imported: "Official import",
  },
  ja: {
    appTitle: "モデルDB",
    searchPlaceholder: "名前 / シリーズ / ラインで検索",
    filters: "絞り込み",
    productLine: "商品ライン",
    workSource: "シリーズ",
    catalogList: "一覧",
    officialPage: "公式商品ページ",
    manualCorrection: "手動修正",
    nameZh: "中国語名",
    nameKo: "韓国語名",
    nameEn: "英語名",
    nameJa: "日本語名",
    subline: "サブシリーズ",
    universe: "世界観 / 年代",
    saveCorrection: "修正を保存",
    clearCorrection: "この項目をクリア",
    exportCorrections: "修正を出力",
    closeDetail: "詳細を閉じる",
    allProductLines: "すべての商品ライン",
    allWorks: "すべてのシリーズ",
    pending: "未確認",
    noMatches: "一致する記録がありません。",
    records: "{count} 件",
    results: "{count} 件",
    summary: "{total} 件 · {parts} · 更新 {date}",
    detailsFor: "{name} の詳細を見る",
    boxArtAlt: "{name} パッケージ画像",
    imageAlt: "{name} 画像 {index}",
    mainImageAlt: "{name} メイン画像",
    galleryImage: "画像 {index}",
    franchise: "分類",
    scale: "スケール",
    release: "発売",
    price: "価格",
    correctionStatus: "修正状態",
    corrected: "手動修正済み",
    imported: "公式インポート",
  },
};

const state = {
  rawKits: [],
  kits: [],
  grades: [],
  sources: [],
  overrides: {},
  updatedAt: null,
  query: "",
  franchise: localStorage.getItem(FRANCHISE_KEY) || "gundam",
  language: localStorage.getItem(LANGUAGE_KEY) || "zh",
  grade: "all",
  series: "all",
  selectedKit: null,
  selectedImageIndex: 0,
};

const elements = {
  datasetSummary: document.querySelector("#datasetSummary"),
  searchInput: document.querySelector("#searchInput"),
  filterSummary: document.querySelector("#filterSummary"),
  franchiseList: document.querySelector("#franchiseList"),
  languageList: document.querySelector("#languageList"),
  seriesTabs: document.querySelector("#seriesTabs"),
  gradeSelect: document.querySelector("#gradeSelect"),
  seriesSelect: document.querySelector("#seriesSelect"),
  resultCount: document.querySelector("#resultCount"),
  kitGrid: document.querySelector("#kitGrid"),
  cardTemplate: document.querySelector("#kitCardTemplate"),
  detailDialog: document.querySelector("#detailDialog"),
  detailClose: document.querySelector("#detailClose"),
  detailMainImage: document.querySelector("#detailMainImage"),
  detailThumbs: document.querySelector("#detailThumbs"),
  detailKicker: document.querySelector("#detailKicker"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubtitle: document.querySelector("#detailSubtitle"),
  detailMeta: document.querySelector("#detailMeta"),
  detailOfficialLink: document.querySelector("#detailOfficialLink"),
  editToggle: document.querySelector("#editToggle"),
  correctionForm: document.querySelector("#correctionForm"),
  editNameZh: document.querySelector("#editNameZh"),
  editNameKo: document.querySelector("#editNameKo"),
  editNameEn: document.querySelector("#editNameEn"),
  editNameJa: document.querySelector("#editNameJa"),
  editGradeCode: document.querySelector("#editGradeCode"),
  editSubline: document.querySelector("#editSubline"),
  editWorkTitle: document.querySelector("#editWorkTitle"),
  editUniverse: document.querySelector("#editUniverse"),
  saveCorrection: document.querySelector("#saveCorrection"),
  clearCorrection: document.querySelector("#clearCorrection"),
  exportCorrections: document.querySelector("#exportCorrections"),
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function init() {
  const [gradesDoc, kitsDoc, sourcesDoc] = await Promise.all([
    loadJson("../data/grades.json"),
    loadJson("../data/kits.json"),
    loadJson("../data/sources.json"),
  ]);

  state.grades = gradesDoc.grades;
  state.rawKits = kitsDoc.kits;
  state.sources = sourcesDoc.sources;
  state.overrides = loadOverrides();
  state.updatedAt = kitsDoc.updated_at;
  refreshKits();
  normalizeState();

  bindEvents();
  render();
}

function normalizeState() {
  if (!FRANCHISES.includes(state.franchise)) {
    state.franchise = "gundam";
  }
  if (!LANGUAGES.some((language) => language.code === state.language)) {
    state.language = "zh";
  }
}

function loadOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveOverrides() {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(state.overrides, null, 2));
}

function refreshKits() {
  state.kits = state.rawKits.map((kit) => applyOverride(kit));
}

function applyOverride(kit) {
  const override = state.overrides[kit.kit_id];
  if (!override) {
    return normalizeKit(kit);
  }

  const normalized = normalizeKit(kit);
  const names = { ...normalized.names };
  for (const code of ["zh", "ko", "en", "ja"]) {
    const key = `name_${code}`;
    if (Object.hasOwn(override, key)) {
      names[code] = override[key];
    }
  }

  return {
    ...normalized,
    names,
    grade_code: Object.hasOwn(override, "grade_code") ? override.grade_code : normalized.grade_code,
    subline: Object.hasOwn(override, "subline") ? override.subline : normalized.subline,
    work_title: Object.hasOwn(override, "work_title") ? override.work_title : normalized.work_title,
    universe: Object.hasOwn(override, "universe") ? override.universe : normalized.universe,
    local_override: override,
  };
}

function normalizeKit(kit) {
  const names = kit.names || {};
  const series = kit.series && typeof kit.series === "object" ? kit.series : null;
  return {
    ...kit,
    franchise: kit.franchise || "gundam",
    series,
    names: {
      ja: names.ja ?? null,
      en: names.en ?? null,
      zh: names.zh ?? null,
      ko: names.ko ?? null,
    },
  };
}

function rawKitById(kitId) {
  return state.rawKits.find((kit) => kit.kit_id === kitId);
}

function displayKitById(kitId) {
  return state.kits.find((kit) => kit.kit_id === kitId);
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderKits();
  });
  elements.seriesSelect.addEventListener("change", (event) => {
    state.series = event.target.value;
    renderSeriesControls();
    renderGradeSelect();
    renderFilterSummary();
    renderKits();
  });
  elements.gradeSelect.addEventListener("change", (event) => {
    state.grade = event.target.value;
    renderGradeSelect();
    renderFilterSummary();
    renderKits();
  });

  elements.detailClose.addEventListener("click", closeDetail);
  elements.editToggle.addEventListener("click", () => {
    elements.correctionForm.hidden = !elements.correctionForm.hidden;
  });
  elements.saveCorrection.addEventListener("click", saveCurrentCorrection);
  elements.clearCorrection.addEventListener("click", clearCurrentCorrection);
  elements.exportCorrections.addEventListener("click", exportCorrections);
  elements.detailDialog.addEventListener("click", (event) => {
    if (event.target === elements.detailDialog) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.detailDialog.open) {
      closeDetail();
    }
  });

  populateGradeSelect();
}

function t(key, params = {}) {
  const template = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
}

function translateStaticText() {
  document.documentElement.lang = LANGUAGES.find((language) => language.code === state.language)?.htmlLang ?? "zh-CN";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
}

function populateGradeSelect() {
  elements.editGradeCode.innerHTML = "";
  for (const grade of [...state.grades].sort((a, b) => a.code.localeCompare(b.code))) {
    const option = document.createElement("option");
    option.value = grade.code;
    option.textContent = `${grade.code} · ${gradeLabel(grade)}`;
    elements.editGradeCode.append(option);
  }
}

function fillCorrectionForm(kit) {
  const rawKit = normalizeKit(rawKitById(kit.kit_id) || kit);
  elements.editNameZh.value = kit.names?.zh || "";
  elements.editNameKo.value = kit.names?.ko || "";
  elements.editNameEn.value = kit.names?.en || "";
  elements.editNameJa.value = kit.names?.ja || "";
  elements.editGradeCode.value = kit.grade_code;
  elements.editSubline.value = kit.subline || "";
  elements.editWorkTitle.value = kit.work_title || "";
  elements.editUniverse.value = kit.universe || "";
  elements.clearCorrection.disabled = !state.overrides[kit.kit_id];
  elements.correctionForm.dataset.rawNameZh = rawKit.names?.zh || "";
  elements.correctionForm.dataset.rawNameKo = rawKit.names?.ko || "";
  elements.correctionForm.dataset.rawNameEn = rawKit.names?.en || "";
  elements.correctionForm.dataset.rawNameJa = rawKit.names?.ja || "";
  elements.correctionForm.dataset.rawGradeCode = rawKit.grade_code || "";
  elements.correctionForm.dataset.rawSubline = rawKit.subline || "";
  elements.correctionForm.dataset.rawWorkTitle = rawKit.work_title || "";
  elements.correctionForm.dataset.rawUniverse = rawKit.universe || "";
}

function correctionValue(inputValue, rawValue) {
  const normalizedInput = inputValue.trim();
  const normalizedRaw = String(rawValue ?? "").trim();
  if (normalizedInput === normalizedRaw) {
    return undefined;
  }
  return normalizedInput || null;
}

function saveCurrentCorrection() {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }

  const form = elements.correctionForm.dataset;
  const override = {
    name_zh: correctionValue(elements.editNameZh.value, form.rawNameZh),
    name_ko: correctionValue(elements.editNameKo.value, form.rawNameKo),
    name_en: correctionValue(elements.editNameEn.value, form.rawNameEn),
    name_ja: correctionValue(elements.editNameJa.value, form.rawNameJa),
    grade_code: correctionValue(elements.editGradeCode.value, form.rawGradeCode),
    subline: correctionValue(elements.editSubline.value, form.rawSubline),
    work_title: correctionValue(elements.editWorkTitle.value, form.rawWorkTitle),
    universe: correctionValue(elements.editUniverse.value, form.rawUniverse),
  };

  for (const key of Object.keys(override)) {
    if (override[key] === undefined) {
      delete override[key];
    }
  }

  if (Object.keys(override).length) {
    state.overrides[kit.kit_id] = {
      ...override,
      updated_at: new Date().toISOString(),
    };
  } else {
    delete state.overrides[kit.kit_id];
  }

  saveOverrides();
  refreshAfterOverride(kit.kit_id);
}

function clearCurrentCorrection() {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  delete state.overrides[kit.kit_id];
  saveOverrides();
  refreshAfterOverride(kit.kit_id);
}

function refreshAfterOverride(kitId) {
  refreshKits();
  const nextKit = displayKitById(kitId);
  state.selectedKit = nextKit;
  renderFranchiseFilters();
  renderGradeFilters();
  renderWorkFilters();
  renderFilterSummary();
  renderKits();
  if (nextKit && elements.detailDialog.open) {
    renderDetail(nextKit);
  }
}

function exportCorrections() {
  const payload = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    overrides: state.overrides,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gunpula-corrections.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function render() {
  translateStaticText();
  populateGradeSelect();
  elements.datasetSummary.textContent = datasetSummary();
  renderLanguageControls();
  renderFranchiseFilters();
  renderSeriesControls();
  renderGradeSelect();
  renderFilterSummary();
  renderKits();
}

function datasetSummary() {
  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.franchise, (counts.get(kit.franchise) || 0) + 1);
  }
  const parts = FRANCHISES.map((franchise) => `${franchiseLabel(franchise)} ${counts.get(franchise) || 0}`).join(" / ");
  return t("summary", {
    total: state.kits.length,
    parts,
    date: state.updatedAt ?? "unknown",
  });
}

function gradeByCode() {
  return new Map(state.grades.map((grade) => [grade.code, grade]));
}

function franchiseLabel(franchise) {
  return FRANCHISE_LABELS[franchise]?.[state.language] ?? FRANCHISE_LABELS[franchise]?.en ?? franchise;
}

function gradeLabel(grade) {
  if (!grade) {
    return t("pending");
  }
  if (state.language === "zh") {
    return grade.name_zh || grade.name_en || grade.code;
  }
  return grade.name_en || grade.name_zh || grade.code;
}

function gradeShortLabel(kit) {
  return GRADE_SHORT_LABELS[kit.grade_code]?.[state.language] ?? GRADE_SHORT_LABELS[kit.grade_code]?.en ?? kit.grade_code;
}

function kitSeriesKey(kit) {
  return kit.series?.key || "other";
}

function kitSeriesSort(kit) {
  return Number.isFinite(kit.series?.sort) ? kit.series.sort : 999;
}

function seriesLabelFromKit(kit) {
  return kit.series?.labels?.[state.language] ?? kit.series?.labels?.zh ?? kit.series?.labels?.en ?? kit.work_title ?? t("pending");
}

function seriesLabelFromKey(key) {
  if (key === "all") {
    return t("allWorks");
  }
  const sample = state.kits.find((kit) => kitSeriesKey(kit) === key);
  return sample ? seriesLabelFromKit(sample) : key;
}

function kitDisplayName(kit) {
  const names = kit.names || {};
  for (const code of NAME_FALLBACKS[state.language] ?? NAME_FALLBACKS.zh) {
    if (names[code]) {
      return names[code];
    }
  }
  return kit.kit_id;
}

function kitShortName(kit) {
  let name = kitDisplayName(kit);
  for (const pattern of TITLE_PREFIX_PATTERNS) {
    name = name.replace(pattern, "");
  }
  return name.trim() || kitDisplayName(kit);
}

function kitSeries(kit) {
  return `${seriesLabelFromKit(kit)} · ${gradeShortLabel(kit)}`;
}

function kitsForCurrentFranchise() {
  return state.kits.filter((kit) => kit.franchise === state.franchise);
}

function filteredKits() {
  const query = state.query.trim().toLowerCase();
  return kitsForCurrentFranchise().filter((kit) => {
    if (state.grade !== "all" && kit.grade_code !== state.grade) {
      return false;
    }
    if (state.series !== "all" && kitSeriesKey(kit) !== state.series) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = [
      kit.kit_id,
      kit.franchise,
      kit.grade_code,
      kit.subline,
      kit.names.ja,
      kit.names.en,
      kit.names.zh,
      kit.names.ko,
      seriesLabelFromKit(kit),
      kit.series?.key,
      kit.work_title,
      kit.universe,
      kit.release_date,
      kit.price_jpy,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderLanguageControls() {
  elements.languageList.innerHTML = "";
  for (const language of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${state.language === language.code ? " is-active" : ""}`;
    button.textContent = language.label;
    button.addEventListener("click", () => {
      state.language = language.code;
      localStorage.setItem(LANGUAGE_KEY, state.language);
      render();
      if (state.selectedKit && elements.detailDialog.open) {
        renderDetail(state.selectedKit);
      }
    });
    elements.languageList.append(button);
  }
}

function renderFranchiseFilters() {
  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.franchise, (counts.get(kit.franchise) || 0) + 1);
  }

  elements.franchiseList.innerHTML = "";
  for (const franchise of FRANCHISES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${state.franchise === franchise ? " is-active" : ""}`;
    button.textContent = `${franchiseLabel(franchise)} ${counts.get(franchise) || 0}`;
    button.addEventListener("click", () => {
      state.franchise = franchise;
      state.grade = "all";
      state.series = "all";
      localStorage.setItem(FRANCHISE_KEY, state.franchise);
      render();
    });
    elements.franchiseList.append(button);
  }
}

function seriesCountsForCurrentFranchise() {
  const kits = kitsForCurrentFranchise();
  const counts = new Map();
  for (const kit of kits) {
    const key = kitSeriesKey(kit);
    const current = counts.get(key) || { count: 0, sort: kitSeriesSort(kit), label: seriesLabelFromKit(kit) };
    current.count += 1;
    current.sort = Math.min(current.sort, kitSeriesSort(kit));
    counts.set(key, current);
  }
  return counts;
}

function renderSeriesControls() {
  const kits = kitsForCurrentFranchise();
  const counts = seriesCountsForCurrentFranchise();
  if (state.series !== "all" && !counts.has(state.series)) {
    state.series = "all";
  }

  const seriesEntries = [...counts.entries()].sort((a, b) => a[1].sort - b[1].sort || b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));

  elements.seriesTabs.innerHTML = "";
  elements.seriesTabs.append(makeSeriesTab("all", `${t("allWorks")} ${kits.length}`));
  for (const [key, entry] of seriesEntries) {
    elements.seriesTabs.append(makeSeriesTab(key, `${entry.label} ${entry.count}`));
  }

  elements.seriesSelect.innerHTML = "";
  elements.seriesSelect.append(makeOption("all", `${t("allWorks")} (${kits.length})`));
  for (const [key, entry] of seriesEntries) {
    elements.seriesSelect.append(makeOption(key, `${entry.label} (${entry.count})`));
  }
  elements.seriesSelect.value = state.series;
}

function makeSeriesTab(key, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `series-tab${state.series === key ? " is-active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", () => {
    state.series = key;
    renderSeriesControls();
    renderGradeSelect();
    renderFilterSummary();
    renderKits();
  });
  return button;
}

function makeOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderGradeSelect() {
  const kits = kitsForCurrentFranchise().filter((kit) => state.series === "all" || kitSeriesKey(kit) === state.series);
  const counts = new Map();
  for (const kit of kits) {
    counts.set(kit.grade_code, (counts.get(kit.grade_code) || 0) + 1);
  }
  if (state.grade !== "all" && !counts.has(state.grade)) {
    state.grade = "all";
  }

  const codes = [...counts.keys()].sort();
  elements.gradeSelect.innerHTML = "";
  elements.gradeSelect.append(makeOption("all", `${t("allProductLines")} (${kits.length})`));
  for (const code of codes) {
    const sample = kits.find((kit) => kit.grade_code === code);
    const label = sample ? gradeShortLabel(sample) : code;
    elements.gradeSelect.append(makeOption(code, `${label} (${counts.get(code)})`));
  }
  elements.gradeSelect.value = state.grade;
}

function renderGradeFilters() {
  renderGradeSelect();
}

function renderWorkFilters() {
  renderSeriesControls();
}

function renderFilterSummary() {
  const gradeMap = gradeByCode();
  const gradeLabelText =
    state.grade === "all"
      ? t("allProductLines")
      : gradeLabel(gradeMap.get(state.grade)) || state.grade;
  const seriesLabel = seriesLabelFromKey(state.series);
  elements.filterSummary.textContent = `${franchiseLabel(state.franchise)} · ${seriesLabel} · ${gradeLabelText}`;
}

function renderKits() {
  const kits = filteredKits();
  elements.resultCount.textContent = t("results", { count: kits.length });
  elements.kitGrid.innerHTML = "";

  if (!kits.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noMatches");
    elements.kitGrid.append(empty);
    return;
  }

  for (const kit of kits) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const boxArt = card.querySelector(".box-art");
    const imageUrl = kit.images?.box_art_url;
    const fullName = kitDisplayName(kit);
    const name = kitShortName(kit);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", t("detailsFor", { name: fullName }));

    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = t("boxArtAlt", { name: fullName });
      img.loading = "lazy";
      img.addEventListener("error", () => showPlaceholder(boxArt, kit.grade_code));
      boxArt.append(img);
    } else {
      showPlaceholder(boxArt, kit.grade_code);
    }

    const badges = card.querySelector(".kit-badges");
    for (const label of [seriesLabelFromKit(kit), gradeShortLabel(kit)]) {
      const badge = document.createElement("span");
      badge.textContent = label;
      badges.append(badge);
    }
    card.querySelector("h3").textContent = name;
    card.querySelector("p").textContent = kitSeries(kit);
    card.addEventListener("click", () => openDetail(kit));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(kit);
      }
    });
    elements.kitGrid.append(card);
  }
}

function openDetail(kit) {
  state.selectedKit = kit;
  state.selectedImageIndex = 0;

  renderDetail(kit);
  elements.detailDialog.showModal();
}

function renderDetail(kit) {
  elements.detailKicker.textContent = `${seriesLabelFromKit(kit)} · ${gradeShortLabel(kit)}${kit.scale ? ` · ${kit.scale}` : ""}`;
  elements.detailTitle.textContent = kitShortName(kit);
  elements.detailSubtitle.textContent = [kit.release_date, formatPrice(kit.price_jpy)].filter((value) => value && value !== t("pending")).join(" · ");
  renderDetailMeta(kit);
  renderDetailGallery(kit);
  fillCorrectionForm(kit);

  const officialUrl = kit.source_urls?.[0];
  if (officialUrl) {
    elements.detailOfficialLink.href = officialUrl;
    elements.detailOfficialLink.hidden = false;
  } else {
    elements.detailOfficialLink.hidden = true;
  }
}

function closeDetail() {
  elements.detailDialog.close();
  state.selectedKit = null;
}

function renderDetailMeta(kit) {
  const rows = [
    [t("franchise"), franchiseLabel(kit.franchise)],
    [t("workSource"), seriesLabelFromKit(kit)],
    [t("nameZh"), kit.names.zh || t("pending")],
    [t("nameKo"), kit.names.ko || t("pending")],
    [t("nameEn"), kit.names.en || t("pending")],
    [t("nameJa"), kit.names.ja || t("pending")],
    [t("universe"), kit.universe || t("pending")],
    [t("productLine"), kit.subline && kit.subline !== kit.grade_code ? `${kit.grade_code} / ${kit.subline}` : kit.grade_code],
    [t("scale"), kit.scale || t("pending")],
    [t("release"), kit.release_date || t("pending")],
    [t("price"), formatPrice(kit.price_jpy)],
    [t("correctionStatus"), state.overrides[kit.kit_id] ? t("corrected") : t("imported")],
  ];

  elements.detailMeta.innerHTML = "";
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    elements.detailMeta.append(dt, dd);
  }
}

function renderDetailGallery(kit) {
  const urls = detailImages(kit);
  elements.detailThumbs.innerHTML = "";
  selectDetailImage(urls, 0);

  urls.forEach((url, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `thumb-button${index === state.selectedImageIndex ? " is-active" : ""}`;
    button.setAttribute("aria-label", t("galleryImage", { index: index + 1 }));
    const img = document.createElement("img");
    img.src = url;
    img.alt = t("imageAlt", { name: kitDisplayName(kit), index: index + 1 });
    img.loading = "lazy";
    img.addEventListener("error", () => {
      button.remove();
    });
    button.append(img);
    button.addEventListener("click", () => selectDetailImage(urls, index));
    elements.detailThumbs.append(button);
  });
}

function selectDetailImage(urls, index) {
  elements.detailMainImage.classList.remove("is-placeholder");
  elements.detailMainImage.innerHTML = "";
  if (!urls.length) {
    showPlaceholder(elements.detailMainImage, state.selectedKit?.grade_code || "?");
    return;
  }

  const url = urls[index] || urls[0];
  state.selectedImageIndex = index;
  const img = document.createElement("img");
  img.src = url;
  img.alt = t("mainImageAlt", { name: kitDisplayName(state.selectedKit) });
  img.addEventListener("error", () => {
    img.remove();
    if (urls[index + 1]) {
      selectDetailImage(urls, index + 1);
    } else {
      showPlaceholder(elements.detailMainImage, state.selectedKit?.grade_code || "?");
    }
  });
  elements.detailMainImage.append(img);

  for (const [thumbIndex, thumb] of [...elements.detailThumbs.children].entries()) {
    thumb.classList.toggle("is-active", thumbIndex === index);
  }
}

function detailImages(kit) {
  const urls = [...(kit.gallery_image_urls || []), kit.images?.box_art_url].filter(Boolean);
  return [...new Set(urls)];
}

function formatPrice(value) {
  return Number.isInteger(value) ? `¥${value.toLocaleString("ja-JP")}` : t("pending");
}

function showPlaceholder(container, gradeCode) {
  container.classList.add("is-placeholder");
  container.innerHTML = `<span>${escapeHtml(gradeCode)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[char];
  });
}

init().catch((error) => {
  document.body.innerHTML = `<main class="catalog-page"><div class="empty">${escapeHtml(error.message)}</div></main>`;
});
