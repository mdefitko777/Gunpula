const state = {
  kits: [],
  grades: [],
  query: "",
  grade: "all",
};

const elements = {
  datasetSummary: document.querySelector("#datasetSummary"),
  searchInput: document.querySelector("#searchInput"),
  gradeList: document.querySelector("#gradeList"),
  resultCount: document.querySelector("#resultCount"),
  kitGrid: document.querySelector("#kitGrid"),
  cardTemplate: document.querySelector("#kitCardTemplate"),
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function init() {
  const [gradesDoc, kitsDoc] = await Promise.all([
    loadJson("../data/grades.json"),
    loadJson("../data/kits.json"),
  ]);

  state.grades = gradesDoc.grades;
  state.kits = kitsDoc.kits;

  bindEvents();
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderKits();
  });
}

function render() {
  elements.datasetSummary.textContent = `${state.kits.length} kits · ${state.grades.length} series`;
  renderGradeFilters();
  renderKits();
}

function gradeByCode() {
  return new Map(state.grades.map((grade) => [grade.code, grade]));
}

function kitDisplayName(kit) {
  return kit.names.en || kit.names.zh || kit.names.ja || kit.kit_id;
}

function kitSeries(kit) {
  const gradeMap = gradeByCode();
  const grade = gradeMap.get(kit.grade_code);
  const line = kit.subline && kit.subline !== kit.grade_code ? `${kit.grade_code} · ${kit.subline}` : kit.grade_code;
  const work = kit.work_title ? ` · ${kit.work_title}` : "";
  return `${line}${work || (grade ? ` · ${grade.name_en}` : "")}`;
}

function filteredKits() {
  const query = state.query.trim().toLowerCase();
  return state.kits.filter((kit) => {
    if (state.grade !== "all" && kit.grade_code !== state.grade) {
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
    button.className = `grade-chip${state.grade === code ? " is-active" : ""}`;
    button.textContent = code === "all" ? `全部 ${state.kits.length}` : `${code} ${counts.get(code)}`;
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

  for (const kit of kits) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const boxArt = card.querySelector(".box-art");
    const imageUrl = kit.images?.box_art_url;

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
    elements.kitGrid.append(card);
  }
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
