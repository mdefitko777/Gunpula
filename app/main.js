const state = {
  kits: [],
  grades: [],
  sources: [],
  grade: "all",
  status: "all",
  query: "",
  view: "kits",
};

const elements = {
  datasetSummary: document.querySelector("#datasetSummary"),
  gradeList: document.querySelector("#gradeList"),
  kitCount: document.querySelector("#kitCount"),
  gradeCount: document.querySelector("#gradeCount"),
  sourceCount: document.querySelector("#sourceCount"),
  missingOfficialCount: document.querySelector("#missingOfficialCount"),
  kitGrid: document.querySelector("#kitGrid"),
  resultCount: document.querySelector("#resultCount"),
  gradesTable: document.querySelector("#gradesTable"),
  gradeResultCount: document.querySelector("#gradeResultCount"),
  sourceList: document.querySelector("#sourceList"),
  sourceResultCount: document.querySelector("#sourceResultCount"),
  coverageGaps: document.querySelector("#coverageGaps"),
  searchInput: document.querySelector("#searchInput"),
  statusFilter: document.querySelector("#statusFilter"),
  cardTemplate: document.querySelector("#kitCardTemplate"),
  navTabs: [...document.querySelectorAll(".nav-tab")],
  views: [...document.querySelectorAll(".view")],
};

const sourceTypeClass = {
  official: "is-official",
  official_store: "is-official",
  review_catalog: "is-review",
  retail_catalog: "is-review",
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
  state.kits = kitsDoc.kits;
  state.sources = sourcesDoc.sources;

  bindEvents();
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderKits();
  });

  elements.statusFilter.addEventListener("change", (event) => {
    state.status = event.target.value;
    renderKits();
  });

  for (const tab of elements.navTabs) {
    tab.addEventListener("click", () => {
      state.view = tab.dataset.view;
      renderView();
    });
  }
}

function render() {
  renderSummary();
  renderGradeFilters();
  renderKits();
  renderGrades();
  renderSources();
  renderView();
}

function sourceById() {
  return new Map(state.sources.map((source) => [source.source_id, source]));
}

function gradeByCode() {
  return new Map(state.grades.map((grade) => [grade.code, grade]));
}

function kitDisplayName(kit) {
  return kit.names.en || kit.names.zh || kit.names.ja || kit.kit_id;
}

function hasOfficialSource(kit) {
  const sources = sourceById();
  return (kit.source_refs || []).some((sourceRef) => {
    const source = sources.get(sourceRef.source_id);
    return source?.type === "official" || source?.type === "official_store";
  });
}

function hasVisualCatalogSource(kit) {
  return (kit.source_refs || []).some((sourceRef) =>
    ["dalong", "hobby_search", "hlj"].includes(sourceRef.source_id),
  );
}

function filteredKits() {
  const query = state.query.trim().toLowerCase();
  return state.kits.filter((kit) => {
    if (state.grade !== "all" && kit.grade_code !== state.grade) {
      return false;
    }
    if (state.status !== "all" && kit.data_status !== state.status) {
      return false;
    }
    if (!query) {
      return true;
    }

    const haystack = [
      kit.kit_id,
      kit.grade_code,
      kit.subline,
      kit.scale,
      kit.names.ja,
      kit.names.en,
      kit.names.zh,
      kit.universe,
      kit.work_title,
      ...(kit.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

function renderSummary() {
  const missingOfficial = state.kits.filter((kit) => !hasOfficialSource(kit));
  elements.datasetSummary.textContent = `${state.kits.length} kits, ${state.grades.length} grades, ${state.sources.length} sources`;
  elements.kitCount.textContent = state.kits.length;
  elements.gradeCount.textContent = state.grades.length;
  elements.sourceCount.textContent = state.sources.length;
  elements.missingOfficialCount.textContent = missingOfficial.length;
}

function renderGradeFilters() {
  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.grade_code, (counts.get(kit.grade_code) || 0) + 1);
  }

  const orderedCodes = ["all", ...[...counts.keys()].sort()];
  elements.gradeList.innerHTML = "";

  for (const code of orderedCodes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `grade-filter${state.grade === code ? " is-active" : ""}`;
    button.dataset.grade = code;
    button.innerHTML = `<span>${code === "all" ? "全部" : code}</span><span class="grade-filter-count">${
      code === "all" ? state.kits.length : counts.get(code)
    }</span>`;
    button.addEventListener("click", () => {
      state.grade = code;
      renderGradeFilters();
      renderKits();
    });
    elements.gradeList.append(button);
  }
}

function renderKits() {
  const kits = filteredKits();
  elements.resultCount.textContent = `${kits.length} results`;
  elements.kitGrid.innerHTML = "";

  if (!kits.length) {
    elements.kitGrid.innerHTML = `<div class="empty">没有匹配的模型。</div>`;
    return;
  }

  const sources = sourceById();
  for (const kit of kits) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const emblem = card.querySelector(".grade-emblem");
    const status = card.querySelector(".status-pill");

    emblem.textContent = kit.grade_code;
    emblem.classList.add(`is-${kit.grade_code.toLowerCase()}`);
    card.querySelector("h3").textContent = kitDisplayName(kit);
    status.textContent = kit.data_status;
    status.classList.add(`is-${kit.data_status}`);
    card.querySelector(".kit-meta").innerHTML = [
      `子系列：${kit.subline || "未填"}`,
      `比例：${kit.scale}`,
      `作品：${kit.work_title || "未填"}`,
      `发售：${kit.release_date || "未填"}`,
    ]
      .map((line) => `<div>${escapeHtml(line)}</div>`)
      .join("");

    const tagWrap = card.querySelector(".kit-tags");
    for (const tag of kit.tags || []) {
      tagWrap.insertAdjacentHTML("beforeend", `<span class="tag">${escapeHtml(tag)}</span>`);
    }

    const sourceStrip = card.querySelector(".source-strip");
    if (!hasOfficialSource(kit)) {
      sourceStrip.insertAdjacentHTML("beforeend", `<span class="source-chip">缺官方来源</span>`);
    }
    if (!hasVisualCatalogSource(kit)) {
      sourceStrip.insertAdjacentHTML("beforeend", `<span class="source-chip">缺目录/实物来源</span>`);
    }
    for (const sourceRef of kit.source_refs || []) {
      const source = sources.get(sourceRef.source_id);
      const className = sourceTypeClass[source?.type] || "";
      sourceStrip.insertAdjacentHTML(
        "beforeend",
        `<span class="source-chip ${className}">${escapeHtml(sourceRef.source_id)}</span>`,
      );
    }

    elements.kitGrid.append(card);
  }
}

function renderGrades() {
  const gradeCounts = new Map();
  for (const kit of state.kits) {
    gradeCounts.set(kit.grade_code, (gradeCounts.get(kit.grade_code) || 0) + 1);
  }

  elements.gradeResultCount.textContent = `${state.grades.length} grades`;
  elements.gradesTable.innerHTML = "";
  for (const grade of state.grades) {
    const count = gradeCounts.get(grade.code) || 0;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(grade.code)}</strong><br><span class="muted">${count} kits</span></td>
      <td>${escapeHtml(grade.name_zh)}</td>
      <td>${escapeHtml(grade.name_en)}</td>
      <td>${escapeHtml(grade.category)}</td>
      <td>${escapeHtml(grade.typical_scale.join(", "))}</td>
      <td>${escapeHtml(grade.status)}</td>
    `;
    elements.gradesTable.append(row);
  }
}

function renderSources() {
  const counts = new Map();
  for (const kit of state.kits) {
    for (const sourceRef of kit.source_refs || []) {
      counts.set(sourceRef.source_id, (counts.get(sourceRef.source_id) || 0) + 1);
    }
  }

  elements.sourceResultCount.textContent = `${state.sources.length} sources`;
  elements.sourceList.innerHTML = "";
  for (const source of state.sources) {
    const item = document.createElement("article");
    item.className = "source-item";
    item.innerHTML = `
      <h3>${escapeHtml(source.name)} <span class="muted">(${escapeHtml(source.source_id)})</span></h3>
      <p>${escapeHtml(source.notes)}</p>
      <div class="kit-tags">
        <span class="tag">${escapeHtml(source.type)}</span>
        <span class="tag">${counts.get(source.source_id) || 0} refs</span>
      </div>
    `;
    elements.sourceList.append(item);
  }

  const missingOfficial = state.kits.filter((kit) => !hasOfficialSource(kit));
  const missingVisual = state.kits.filter((kit) => !hasVisualCatalogSource(kit));
  elements.coverageGaps.innerHTML = `
    <div class="gap-list">
      <div class="gap-item"><strong>${missingOfficial.length} 条缺官方来源</strong><span>${gapNames(
        missingOfficial,
      )}</span></div>
      <div class="gap-item"><strong>${missingVisual.length} 条缺目录/实物来源</strong><span>${gapNames(
        missingVisual,
      )}</span></div>
    </div>
  `;
}

function gapNames(kits) {
  if (!kits.length) {
    return "无";
  }
  return kits.map((kit) => kit.kit_id).join(", ");
}

function renderView() {
  for (const tab of elements.navTabs) {
    tab.classList.toggle("is-active", tab.dataset.view === state.view);
  }
  for (const view of elements.views) {
    view.classList.toggle("is-active", view.id === `${state.view}View`);
  }
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
  document.body.innerHTML = `<main class="main"><div class="empty">${escapeHtml(error.message)}</div></main>`;
});
