const state = {
  rawKits: [],
  kits: [],
  grades: [],
  sources: [],
  overrides: {},
  updatedAt: null,
  query: "",
  grade: "all",
  work: "all",
  selectedKit: null,
  selectedImageIndex: 0,
};

const elements = {
  datasetSummary: document.querySelector("#datasetSummary"),
  searchInput: document.querySelector("#searchInput"),
  filterSummary: document.querySelector("#filterSummary"),
  gradeList: document.querySelector("#gradeList"),
  workList: document.querySelector("#workList"),
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
  editNameJa: document.querySelector("#editNameJa"),
  editGradeCode: document.querySelector("#editGradeCode"),
  editSubline: document.querySelector("#editSubline"),
  editWorkTitle: document.querySelector("#editWorkTitle"),
  editUniverse: document.querySelector("#editUniverse"),
  saveCorrection: document.querySelector("#saveCorrection"),
  clearCorrection: document.querySelector("#clearCorrection"),
  exportCorrections: document.querySelector("#exportCorrections"),
};

const OVERRIDE_KEY = "gunpula-catalog-overrides-v1";

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

  bindEvents();
  render();
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
    return kit;
  }

  const names = { ...kit.names };
  if (Object.hasOwn(override, "name_ja")) {
    names.ja = override.name_ja;
  }

  return {
    ...kit,
    names,
    grade_code: Object.hasOwn(override, "grade_code") ? override.grade_code : kit.grade_code,
    subline: Object.hasOwn(override, "subline") ? override.subline : kit.subline,
    work_title: Object.hasOwn(override, "work_title") ? override.work_title : kit.work_title,
    universe: Object.hasOwn(override, "universe") ? override.universe : kit.universe,
    local_override: override,
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

function populateGradeSelect() {
  elements.editGradeCode.innerHTML = "";
  for (const grade of [...state.grades].sort((a, b) => a.code.localeCompare(b.code))) {
    const option = document.createElement("option");
    option.value = grade.code;
    option.textContent = `${grade.code} · ${grade.name_zh || grade.name_en}`;
    elements.editGradeCode.append(option);
  }
}

function fillCorrectionForm(kit) {
  const rawKit = rawKitById(kit.kit_id) || kit;
  elements.editNameJa.value = kit.names?.ja || "";
  elements.editGradeCode.value = kit.grade_code;
  elements.editSubline.value = kit.subline || "";
  elements.editWorkTitle.value = kit.work_title || "";
  elements.editUniverse.value = kit.universe || "";
  elements.clearCorrection.disabled = !state.overrides[kit.kit_id];
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
  elements.datasetSummary.textContent = `${state.kits.length} 条记录 · ${state.grades.length} 个产品线 · 更新 ${state.updatedAt ?? "unknown"}`;
  renderGradeFilters();
  renderWorkFilters();
  renderFilterSummary();
  renderKits();
}

function gradeByCode() {
  return new Map(state.grades.map((grade) => [grade.code, grade]));
}

function sourceById() {
  return new Map(state.sources.map((source) => [source.source_id, source]));
}

function kitDisplayName(kit) {
  return kit.names.ja || kit.names.en || kit.names.zh || kit.kit_id;
}

function kitSeries(kit) {
  const gradeMap = gradeByCode();
  const grade = gradeMap.get(kit.grade_code);
  const line = kit.subline && kit.subline !== kit.grade_code ? kit.subline : grade?.name_zh || grade?.name_en || kit.grade_code;
  const work = kit.work_title || "出处待补";
  return `${line} · ${work}`;
}

function filteredKits() {
  const query = state.query.trim().toLowerCase();
  return state.kits.filter((kit) => {
    if (state.grade !== "all" && kit.grade_code !== state.grade) {
      return false;
    }
    if (state.work !== "all" && (kit.work_title || "unknown") !== state.work) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = [
      kit.kit_id,
      kit.grade_code,
      kit.subline,
      kit.names.ja,
      kit.names.en,
      kit.names.zh,
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

function renderGradeFilters() {
  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.grade_code, (counts.get(kit.grade_code) || 0) + 1);
  }

  const codes = ["all", ...[...counts.keys()].sort()];
  elements.gradeList.innerHTML = "";

  for (const code of codes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.grade === code ? " is-active" : ""}`;
    button.textContent = code === "all" ? `全部 ${state.kits.length}` : `${code} ${counts.get(code)}`;
    button.addEventListener("click", () => {
      state.grade = code;
      renderGradeFilters();
      renderFilterSummary();
      renderKits();
    });
    elements.gradeList.append(button);
  }
}

function renderWorkFilters() {
  const counts = new Map();
  for (const kit of state.kits) {
    const work = kit.work_title || "unknown";
    counts.set(work, (counts.get(work) || 0) + 1);
  }

  const works = [...counts.keys()].sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return counts.get(b) - counts.get(a) || a.localeCompare(b);
  });

  elements.workList.innerHTML = "";
  const allButton = makeWorkButton("all", `全部 ${state.kits.length}`);
  elements.workList.append(allButton);

  for (const work of works) {
    elements.workList.append(makeWorkButton(work, `${work === "unknown" ? "出处待补" : work} ${counts.get(work)}`));
  }
}

function makeWorkButton(work, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `filter-chip${state.work === work ? " is-active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", () => {
    state.work = work;
    renderWorkFilters();
    renderFilterSummary();
    renderKits();
  });
  return button;
}

function renderFilterSummary() {
  const gradeMap = gradeByCode();
  const gradeLabel =
    state.grade === "all"
      ? "全部产品线"
      : gradeMap.get(state.grade)?.name_zh || gradeMap.get(state.grade)?.name_en || state.grade;
  const workLabel = state.work === "all" ? "全部出处" : state.work === "unknown" ? "出处待补" : state.work;
  elements.filterSummary.textContent = `${gradeLabel} · ${workLabel}`;
}

function renderKits() {
  const kits = filteredKits();
  elements.resultCount.textContent = `${kits.length} results`;
  elements.kitGrid.innerHTML = "";

  if (!kits.length) {
    elements.kitGrid.innerHTML = `<div class="empty">没有匹配的模型。</div>`;
    return;
  }

  for (const kit of kits) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const boxArt = card.querySelector(".box-art");
    const imageUrl = kit.images?.box_art_url;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看 ${kitDisplayName(kit)} 详情`);

    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = `${kitDisplayName(kit)} box art`;
      img.loading = "lazy";
      img.addEventListener("error", () => showPlaceholder(boxArt, kit.grade_code));
      boxArt.append(img);
    } else {
      showPlaceholder(boxArt, kit.grade_code);
    }

    card.querySelector("h3").textContent = kitDisplayName(kit);
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
  elements.detailKicker.textContent = `${kit.grade_code}${kit.scale ? ` · ${kit.scale}` : ""}`;
  elements.detailTitle.textContent = kitDisplayName(kit);
  elements.detailSubtitle.textContent = kit.work_title || "作品出处待补";
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
    ["作品出处", kit.work_title || "待补"],
    ["宇宙/纪年", kit.universe || "待补"],
    ["产品线", kit.subline && kit.subline !== kit.grade_code ? `${kit.grade_code} / ${kit.subline}` : kit.grade_code],
    ["比例", kit.scale || "待补"],
    ["发售", kit.release_date || "待补"],
    ["定价", formatPrice(kit.price_jpy)],
    ["更正状态", state.overrides[kit.kit_id] ? "已手动更正" : "官方导入"],
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
    button.setAttribute("aria-label", `展示图 ${index + 1}`);
    const img = document.createElement("img");
    img.src = url;
    img.alt = `${kitDisplayName(kit)} image ${index + 1}`;
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
  const url = urls[index] || urls[0];
  state.selectedImageIndex = index;
  elements.detailMainImage.innerHTML = "";
  const img = document.createElement("img");
  img.src = url;
  img.alt = `${kitDisplayName(state.selectedKit)} main image`;
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
  return Number.isInteger(value) ? `¥${value.toLocaleString("ja-JP")}` : "待补";
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
