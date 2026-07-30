import {
  authState,
  loadBootstrap,
  logout,
  publishChanges,
  saveChange,
  saveChanges,
  sendCode,
  undoChange,
  updateReleaseNote,
  verifyCode,
} from "./cms-api.js";
import {
  applyDrafts,
  categoryRecords,
  displayName,
  imageUrl,
  materializeCatalog,
  productPatchFromForm,
  seriesKey,
  validateProduct,
} from "./cms-model.js";

const FRANCHISES = [
  ["gundam", "高达"],
  ["armored_core", "Armored Core"],
  ["pokemon", "宝可梦"],
  ["beyblade", "Beyblade X"],
  ["fate", "Fate / FGO"],
];
const FRANCHISE_LABELS = Object.fromEntries(FRANCHISES);
const PAGE_SIZE = 100;
const DEFAULT_PRODUCT_FILTERS = {
  query: "",
  franchise: "all",
  category: "all",
  grade: "all",
  source: "all",
  releaseYear: "all",
  limited: "all",
  status: "all",
  image: "all",
};
const sectionMeta = {
  overview: ["OPERATIONS", "总览"],
  products: ["CATALOG", "商品目录"],
  taxonomy: ["TAXONOMY", "分类体系"],
  media: ["ASSETS", "图片资产"],
  harvest: ["INGESTION", "抓取中心"],
  announcements: ["ANNOUNCEMENTS", "官方预告"],
  duplicates: ["QUALITY", "重复处理"],
  changes: ["AUDIT LOG", "变更记录"],
  releases: ["RELEASES", "发布版本"],
};

const state = {
  section: "overview",
  bootstrap: null,
  baseKits: [],
  kits: [],
  kitById: new Map(),
  categories: [],
  grades: [],
  sources: [],
  duplicates: [],
  sourceHealth: null,
  imageHealth: null,
  imageAssets: null,
  pbandai: null,
  seriesAudit: null,
  atlasGroups: null,
  announcementDoc: null,
  announcements: [],
  cms: null,
  selectedIds: new Set(),
  selectedProductId: "",
  selectedCategoryId: "",
  productPage: 1,
  productFilters: { ...DEFAULT_PRODUCT_FILTERS },
  taxonomyFranchise: "gundam",
  taxonomyKind: "series",
  mediaMode: "all",
  announcementStatus: "all",
  loginEmail: "",
};

const elements = {
  authScreen: document.querySelector("#authScreen"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authCode: document.querySelector("#authCode"),
  authSubmit: document.querySelector("#authSubmit"),
  authStatus: document.querySelector("#authStatus"),
  codeLabel: document.querySelector("#codeLabel"),
  cmsShell: document.querySelector("#cmsShell"),
  mainNav: document.querySelector("#mainNav"),
  pageEyebrow: document.querySelector("#pageEyebrow"),
  pageTitle: document.querySelector("#pageTitle"),
  globalSearch: document.querySelector("#globalSearch"),
  workspaceLayout: document.querySelector("#workspaceLayout"),
  workspace: document.querySelector("#workspace"),
  inspector: document.querySelector("#inspector"),
  navProductCount: document.querySelector("#navProductCount"),
  navDuplicateCount: document.querySelector("#navDuplicateCount"),
  navAnnouncementCount: document.querySelector("#navAnnouncementCount"),
  navDraftCount: document.querySelector("#navDraftCount"),
  publishCount: document.querySelector("#publishCount"),
  adminName: document.querySelector("#adminName"),
  adminEmail: document.querySelector("#adminEmail"),
  logoutButton: document.querySelector("#logoutButton"),
  undoLatest: document.querySelector("#undoLatest"),
  previewButton: document.querySelector("#previewButton"),
  publishButton: document.querySelector("#publishButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmTitle: document.querySelector("#confirmTitle"),
  confirmMessage: document.querySelector("#confirmMessage"),
  publishDialog: document.querySelector("#publishDialog"),
  publishForm: document.querySelector("#publishForm"),
  publishSummary: document.querySelector("#publishSummary"),
  publishNote: document.querySelector("#publishNote"),
  publishConfirm: document.querySelector("#publishConfirm"),
  toast: document.querySelector("#toast"),
};

function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^(?:https?:|\.{0,2}\/)/i.test(url) ? url : "";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function productStatus(product) {
  if (product.data_status === "hidden") return ["已隐藏", "error"];
  if (product.data_status === "verified") return ["已核对", "ok"];
  if (product.data_status === "needs_review") return ["待核对", "warning"];
  return [product.data_status || "种子", ""];
}

async function fetchJson(path, fallback = null) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  } catch {
    return fallback;
  }
}

async function loadCatalogData() {
  const [catalog, grades, sources, duplicates, sourceHealth, imageHealth, imageAssets, pbandai, seriesAudit, atlasGroups, announcementDoc] = await Promise.all([
    fetchJson("../data/kits.json", { kits: [] }),
    fetchJson("../data/grades.json", { grades: [] }),
    fetchJson("../data/sources.json", { sources: [] }),
    fetchJson("../data/duplicate-candidates.json", { candidates: [] }),
    fetchJson("../data/source-health.json", { checks: [] }),
    fetchJson("../data/image-health.json", { broken: [], kits_without_working_image_items: [] }),
    fetchJson("../data/image-assets.json", {}),
    fetchJson("../data/pbandai.json", {}),
    fetchJson("../data/series-audit.json", {}),
    fetchJson("../data/atlas-groups.json", { franchises: {} }),
    fetchJson("../data/announcements.json", { announcements: [] }),
  ]);
  state.baseKits = catalog.kits || [];
  state.grades = grades.grades || [];
  state.sources = sources.sources || [];
  state.duplicates = duplicates.candidates || [];
  state.sourceHealth = sourceHealth;
  state.imageHealth = imageHealth;
  state.imageAssets = imageAssets;
  state.pbandai = pbandai;
  state.seriesAudit = seriesAudit;
  state.atlasGroups = atlasGroups;
  state.announcementDoc = announcementDoc;
}

function materializeAnnouncements() {
  const records = new Map((state.announcementDoc?.announcements || []).map((item) => [item.id, structuredClone(item)]));
  for (const [key, patch] of Object.entries(state.cms?.sources || {})) {
    if (!key.startsWith("announcement:")) continue;
    const id = key.slice("announcement:".length);
    records.set(id, { ...(records.get(id) || { id, franchise: "gundam" }), ...patch, names: { ...(records.get(id)?.names || {}), ...(patch.names || {}) } });
  }
  return [...records.values()].sort((a, b) => String(b.announced_at || "").localeCompare(String(a.announced_at || "")));
}

function refreshDerived() {
  const published = state.bootstrap?.published?.payload || {};
  state.cms = applyDrafts(published, state.bootstrap?.drafts || []);
  state.kits = materializeCatalog(state.baseKits, state.cms, { includeHidden: true });
  state.kitById = new Map(state.kits.map((kit) => [kit.kit_id, kit]));
  state.categories = categoryRecords(state.kits, state.cms, state.atlasGroups);
  state.announcements = materializeAnnouncements();
  for (const id of [...state.selectedIds]) {
    if (!state.kitById.has(id)) state.selectedIds.delete(id);
  }
}

async function reloadBackend() {
  state.bootstrap = await loadBootstrap();
  refreshDerived();
  render();
}

function toast(message, type = "ok") {
  elements.toast.textContent = message;
  elements.toast.className = `toast is-visible${type === "error" ? " is-error" : ""}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    elements.toast.className = "toast";
  }, 3200);
}

async function startCms() {
  elements.authStatus.textContent = "正在载入目录和管理员数据…";
  try {
    await Promise.all([
      loadCatalogData(),
      loadBootstrap().then((bootstrap) => {
        state.bootstrap = bootstrap;
      }),
    ]);
    refreshDerived();
    elements.authScreen.hidden = true;
    elements.cmsShell.hidden = false;
    render();
  } catch (error) {
    elements.authStatus.textContent = error.message.includes("administrator")
      ? "这个账号没有管理员权限。请先运行 docs/supabase-cms.sql，或在管理员表中启用该账号。"
      : `无法进入后台：${error.message}`;
    elements.authStatus.style.color = "var(--danger)";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = elements.authEmail.value.trim();
  const code = elements.authCode.value.trim();
  elements.authSubmit.disabled = true;
  try {
    if (!elements.codeLabel.hidden) {
      await verifyCode(state.loginEmail || email, code);
      await startCms();
      return;
    }
    await sendCode(email);
    state.loginEmail = email;
    elements.codeLabel.hidden = false;
    elements.authEmail.readOnly = true;
    elements.authSubmit.textContent = "登录";
    elements.authStatus.textContent = "验证码已发送，请检查邮箱。";
  } catch (error) {
    elements.authStatus.textContent = error.message;
    elements.authStatus.style.color = "var(--danger)";
  } finally {
    elements.authSubmit.disabled = false;
  }
}

function render() {
  const [eyebrow, title] = sectionMeta[state.section];
  elements.pageEyebrow.textContent = eyebrow;
  elements.pageTitle.textContent = title;
  elements.mainNav.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button.dataset.section === state.section));
  elements.navProductCount.textContent = state.kits.length;
  elements.navDuplicateCount.textContent = visibleDuplicateGroups().length;
  elements.navAnnouncementCount.textContent = state.announcements.filter((item) => item.status === "announced").length;
  elements.navDraftCount.textContent = state.bootstrap?.drafts?.length || 0;
  elements.publishCount.textContent = state.bootstrap?.drafts?.length || 0;
  elements.publishButton.disabled = !state.bootstrap?.drafts?.length;
  elements.undoLatest.disabled = !state.bootstrap?.drafts?.length;
  elements.adminName.textContent = state.bootstrap?.admin?.display_name || "Administrator";
  elements.adminEmail.textContent = state.bootstrap?.admin?.email || "";
  elements.globalSearch.value = state.productFilters.query;
  closeInspector(false);
  const renderers = {
    overview: renderOverview,
    products: renderProducts,
    taxonomy: renderTaxonomy,
    media: renderMedia,
    harvest: renderHarvest,
    announcements: renderAnnouncements,
    duplicates: renderDuplicates,
    changes: renderChanges,
    releases: renderReleases,
  };
  renderers[state.section]();
  bindWorkspaceControls();
  attachImageFallbacks();
}

function sectionToolbar(title, description, actions = "") {
  return `<header class="section-toolbar"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><div class="toolbar-actions">${actions}</div></header>`;
}

function renderOverview() {
  const counts = Object.fromEntries(FRANCHISES.map(([key]) => [key, state.kits.filter((kit) => kit.franchise === key && kit.data_status !== "hidden").length]));
  const warnings = (state.sourceHealth?.checks || []).filter((check) => check.status !== "ok");
  const missingImages = state.kits.filter((kit) => kit.data_status !== "hidden" && !imageUrl(kit)).length;
  const drafts = state.bootstrap?.drafts || [];
  const max = Math.max(...Object.values(counts), 1);
  elements.workspace.innerHTML = `
    ${sectionToolbar("目录运行状态", "抓取基础层、人工变更层和正式发布层的统一视图。")}
    <div class="metric-strip">
      <div class="metric"><span>有效商品</span><strong>${state.kits.filter((kit) => kit.data_status !== "hidden").length}</strong><small>五个主题</small></div>
      <div class="metric"><span>待发布变更</span><strong>${drafts.length}</strong><small>Revision ${state.bootstrap?.published?.revision || 0}</small></div>
      <div class="metric"><span>来源告警</span><strong>${warnings.length}</strong><small>${state.sourceHealth?.updated_at || "未检查"}</small></div>
      <div class="metric"><span>缺少封面</span><strong>${missingImages}</strong><small>需要修复</small></div>
      <div class="metric"><span>重复候选</span><strong>${visibleDuplicateGroups().length}</strong><small>人工确认</small></div>
    </div>
    <div class="overview-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>主题目录</h2><p>当前正式目录与草稿叠加后的数量</p></div><button class="quiet-button" data-go="products">打开目录</button></div>
        <div class="theme-bars">
          ${FRANCHISES.map(([key, label]) => `<div class="theme-bar"><strong>${escapeHtml(label)}</strong><i style="--bar:${Math.max(2, (counts[key] / max) * 100)}%"></i><span>${counts[key]}</span></div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>最近变更</h2><p>所有操作都可以在发布前撤销</p></div><button class="quiet-button" data-go="changes">查看全部</button></div>
        <div class="activity-list">${activityMarkup((state.bootstrap?.history || []).slice(0, 7))}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>来源健康</h2><p>失败和区域限制优先显示</p></div><button class="quiet-button" data-go="harvest">抓取中心</button></div>
        <div class="source-list">${sourceRows(warnings.slice(0, 7)) || emptyInline("目前没有来源告警")}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h2>发布状态</h2><p>正式 App 当前读取的 CMS 版本</p></div></div>
        <div class="theme-bars">
          <div class="theme-bar"><strong>Revision</strong><i style="--bar:100%"></i><span>${state.bootstrap?.published?.revision || 0}</span></div>
          <div class="theme-bar"><strong>更新时间</strong><i style="--bar:${state.bootstrap?.published?.updated_at ? "100" : "4"}%"></i><span>${state.bootstrap?.published?.updated_at ? "已发布" : "未发布"}</span></div>
        </div>
      </section>
    </div>`;
}

function emptyInline(text) {
  return `<div class="activity-item"><span class="activity-icon">${icon("check")}</span><div><strong>${escapeHtml(text)}</strong><small>无需处理</small></div></div>`;
}

function activityMarkup(changes) {
  if (!changes.length) return emptyInline("还没有人工变更");
  return changes.map((change) => `
    <div class="activity-item">
      <span class="activity-icon">${icon(change.status === "undone" ? "undo" : change.entity_type === "merge" ? "copy" : "edit")}</span>
      <div><strong>${escapeHtml(changeLabel(change))}</strong><small>${escapeHtml(change.entity_id)} · ${formatDate(change.created_at)}</small></div>
      <span class="status-badge ${change.status === "draft" ? "is-warning" : change.status === "published" ? "is-ok" : ""}">${escapeHtml(change.status)}</span>
    </div>`).join("");
}

function changeLabel(change) {
  const operations = { add: "新增", edit: "修改", move: "移动", hide: "隐藏", merge: "合并", repair: "修复", ignore: "忽略" };
  const entities = { product: "商品", category: "分类", merge: "重复记录", source: "来源", image_task: "图片任务", review: "审核项" };
  const entity = change.entity_type === "source" && String(change.entity_id).startsWith("announcement:")
    ? "官方预告"
    : entities[change.entity_type] || change.entity_type;
  return `${operations[change.operation] || change.operation} ${entity}`;
}

function filteredProducts() {
  const query = state.productFilters.query.trim().toLowerCase();
  return state.kits.filter((kit) => {
    if (state.productFilters.franchise !== "all" && kit.franchise !== state.productFilters.franchise) return false;
    if (state.productFilters.category !== "all") {
      const category = state.categories.find((item) => item.id === state.productFilters.category);
      if (!category?.linked_kit_ids?.includes(kit.kit_id)) return false;
    }
    if (state.productFilters.grade !== "all" && kit.grade_code !== state.productFilters.grade) return false;
    if (state.productFilters.releaseYear !== "all" && !String(kit.release_date || "").startsWith(state.productFilters.releaseYear)) return false;
    if (state.productFilters.limited === "yes" && !kit.is_limited) return false;
    if (state.productFilters.limited === "no" && kit.is_limited) return false;
    const sourceIds = (kit.source_refs || []).map((source) => source.source_id).filter(Boolean);
    if (state.productFilters.source !== "all" && !sourceIds.includes(state.productFilters.source)) return false;
    if (state.productFilters.status !== "all" && kit.data_status !== state.productFilters.status) return false;
    const hasImage = Boolean(imageUrl(kit));
    if (state.productFilters.image === "missing" && hasImage) return false;
    if (state.productFilters.image === "present" && !hasImage) return false;
    if (!query) return true;
    return [
      kit.kit_id,
      ...Object.values(kit.names || {}),
      kit.work_title,
      kit.universe,
      kit.grade_code,
      kit.subline,
      ...(kit.tags || []),
      ...sourceIds,
      ...(kit.source_urls || []),
    ].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
}

function renderProducts() {
  const products = filteredProducts();
  const pages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  state.productPage = Math.min(state.productPage, pages);
  const start = (state.productPage - 1) * PAGE_SIZE;
  const page = products.slice(start, start + PAGE_SIZE);
  const scoped = state.productFilters.franchise === "all"
    ? state.kits
    : state.kits.filter((kit) => kit.franchise === state.productFilters.franchise);
  const gradeOptions = [...new Set(scoped.map((kit) => kit.grade_code).filter(Boolean))].sort().map((value) => [value, value]);
  const yearOptions = [...new Set(scoped.map((kit) => String(kit.release_date || "").slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))].sort().reverse().map((value) => [value, value]);
  const sourceOptions = [...new Set(scoped.flatMap((kit) => (kit.source_refs || []).map((source) => source.source_id)).filter(Boolean))]
    .sort()
    .map((value) => [value, state.sources.find((source) => source.source_id === value)?.name || value]);
  const categoryOptions = state.categories
    .filter((category) => state.productFilters.franchise === "all" || category.franchise === state.productFilters.franchise)
    .map((category) => [category.id, `${FRANCHISE_LABELS[category.franchise]} · ${categoryKindLabel(category.kind || "series")} · ${category.labels?.zh || category.key}`]);
  const allChecked = page.length && page.every((kit) => state.selectedIds.has(kit.kit_id));
  const bulk = state.selectedIds.size ? `
    <div class="bulk-bar">
      <strong>已选择 ${state.selectedIds.size} 条</strong>
      <select id="bulkField" aria-label="批量修改字段">
        <option value="franchise">移动主题</option><option value="series">移动系列</option><option value="grade_code">修改产品线</option><option value="data_status">修改状态</option>
      </select>
      <select id="bulkValue" aria-label="目标值"></select>
      <button class="primary-button" id="applyBulk" type="button">${icon("edit")}应用</button>
      <button class="danger-button" id="hideSelected" type="button">${icon("trash")}隐藏</button>
      <button class="quiet-button" id="clearSelection" type="button">取消选择</button>
    </div>` : "";
  elements.workspace.innerHTML = `
    ${sectionToolbar("全部商品", `当前显示 ${products.length} / ${state.kits.length} 条。勾选后可以批量移动或隐藏。`, `<button class="primary-button" id="addProduct" type="button">${icon("plus")}新增商品</button>`)}
    <div class="filter-toolbar">
      <label class="search-inline">${icon("search")}<input id="productQuery" type="search" placeholder="名称 / ID / 作品 / 标签" value="${escapeHtml(state.productFilters.query)}" /></label>
      <select id="productFranchise">${optionMarkup([["all", "全部主题"], ...FRANCHISES], state.productFilters.franchise)}</select>
      <select id="productCategory">${optionMarkup([["all", "全部分类"], ...categoryOptions], state.productFilters.category)}</select>
      <select id="productGrade">${optionMarkup([["all", "全部产品线"], ...gradeOptions], state.productFilters.grade)}</select>
      <select id="productSource">${optionMarkup([["all", "全部来源"], ...sourceOptions], state.productFilters.source)}</select>
      <select id="productReleaseYear">${optionMarkup([["all", "全部发售年份"], ...yearOptions], state.productFilters.releaseYear)}</select>
      <select id="productLimited">${optionMarkup([["all", "全部限定状态"], ["yes", "仅限定"], ["no", "仅通常"]], state.productFilters.limited)}</select>
      <select id="productStatus">${optionMarkup([["all", "全部状态"], ["verified", "已核对"], ["needs_review", "待核对"], ["seed", "种子"], ["retired", "已退役"], ["hidden", "已隐藏"]], state.productFilters.status)}</select>
      <select id="productImage">${optionMarkup([["all", "全部图片状态"], ["present", "有封面"], ["missing", "缺少封面"]], state.productFilters.image)}</select>
      <button class="quiet-button" id="resetProductFilters" type="button">${icon("filter")}重置</button>
    </div>
    ${bulk}
    <div class="table-wrap">
      <table class="data-table">
        <colgroup><col style="width:42px"><col style="width:34%"><col style="width:12%"><col style="width:16%"><col style="width:11%"><col style="width:10%"><col></colgroup>
        <thead><tr><th><input id="selectPage" type="checkbox" ${allChecked ? "checked" : ""}></th><th>商品</th><th>主题</th><th>系列 / 作品</th><th>产品线</th><th>发售</th><th>状态</th></tr></thead>
        <tbody>${page.map(productRow).join("")}</tbody>
      </table>
    </div>
    <div class="pagination"><span>第 ${start + 1}-${Math.min(start + PAGE_SIZE, products.length)} 条，共 ${products.length} 条</span><div class="toolbar-actions"><button class="quiet-button" id="prevPage" ${state.productPage <= 1 ? "disabled" : ""}>上一页</button><span>${state.productPage} / ${pages}</span><button class="quiet-button" id="nextPage" ${state.productPage >= pages ? "disabled" : ""}>下一页</button></div></div>`;
}

function productRow(product) {
  const [status, statusClass] = productStatus(product);
  const cover = safeUrl(imageUrl(product));
  return `<tr data-product-id="${escapeHtml(product.kit_id)}" class="${state.selectedIds.has(product.kit_id) ? "is-selected" : ""}">
    <td><input class="row-check" type="checkbox" data-id="${escapeHtml(product.kit_id)}" ${state.selectedIds.has(product.kit_id) ? "checked" : ""}></td>
    <td><div class="cell-product">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<span class="media-thumb"></span>`}<div><strong>${escapeHtml(displayName(product))}</strong><small>${escapeHtml(product.kit_id)}</small></div></div></td>
    <td>${escapeHtml(FRANCHISE_LABELS[product.franchise] || product.franchise)}</td>
    <td><strong>${escapeHtml(seriesKey(product))}</strong><div class="muted">${escapeHtml(product.work_title || product.universe || "未分类")}</div></td>
    <td>${escapeHtml(product.grade_code || "—")}<div class="muted">${escapeHtml(product.subline || "")}</div></td>
    <td>${escapeHtml(product.release_date || "—")}</td>
    <td><span class="status-badge ${statusClass ? `is-${statusClass}` : ""}">${escapeHtml(status)}</span></td>
  </tr>`;
}

function optionMarkup(options, selected) {
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function categoryOptionMarkup(franchise, selectedValues = [], options = {}) {
  const selected = new Set(Array.isArray(selectedValues) ? selectedValues : [selectedValues]);
  const allowedKinds = options.kinds ? new Set(options.kinds) : null;
  const groups = new Map();
  const available = new Set();
  for (const category of state.categories) {
    if (category.franchise !== franchise || (allowedKinds && !allowedKinds.has(category.kind || "series"))) continue;
    const kind = category.kind || "series";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(category);
    available.add(options.useId ? category.id : category.key);
  }
  const missing = [...selected].filter((value) => value && !available.has(value));
  const fallback = missing.map((value) => `<option value="${escapeHtml(value)}" selected>当前值 · ${escapeHtml(value)}</option>`).join("");
  if (!groups.size) return fallback || `<option value="unclassified">未分类</option>`;
  return fallback + [...groups.entries()].map(([kind, categories]) => `
    <optgroup label="${escapeHtml(categoryKindLabel(kind))}">
      ${categories.map((category) => {
        const value = options.useId ? category.id : category.key;
        return `<option value="${escapeHtml(value)}" ${selected.has(value) || selected.has(category.id) ? "selected" : ""}>${escapeHtml(category.labels?.zh || category.key)}</option>`;
      }).join("")}
    </optgroup>`).join("");
}

function renderTaxonomy() {
  const franchiseCategories = state.categories.filter((item) => item.franchise === state.taxonomyFranchise);
  const kinds = [...new Set(franchiseCategories.map((item) => item.kind || "series"))];
  if (!kinds.includes(state.taxonomyKind)) state.taxonomyKind = kinds[0] || "series";
  const categories = franchiseCategories.filter((item) => (item.kind || "series") === state.taxonomyKind);
  const counts = Object.fromEntries(FRANCHISES.map(([key]) => [key, state.categories.filter((item) => item.franchise === key).length]));
  elements.workspace.innerHTML = `
    ${sectionToolbar("分类体系", "维护作品、世代、章节和产品线的四语名称、排序、封面与关联关系。", `<button class="primary-button" id="addCategory" type="button">${icon("plus")}新增分类</button>`)}
    <div class="taxonomy-layout">
      <aside class="theme-index">${FRANCHISES.map(([key, label]) => `<button data-taxonomy-franchise="${key}" class="${state.taxonomyFranchise === key ? "is-active" : ""}"><span>${escapeHtml(label)}</span><strong>${counts[key]}</strong></button>`).join("")}</aside>
      <div class="taxonomy-content">
        <div class="kind-tabs">${kinds.map((kind) => `<button type="button" data-taxonomy-kind="${escapeHtml(kind)}" class="${state.taxonomyKind === kind ? "is-active" : ""}">${escapeHtml(categoryKindLabel(kind))}<strong>${franchiseCategories.filter((item) => (item.kind || "series") === kind).length}</strong></button>`).join("")}</div>
        <div class="category-grid">${categories.map(categoryRow).join("") || emptyState("tree", "还没有分类", "点击“新增分类”建立第一条分类。")}</div>
      </div>
    </div>`;
}

function categoryKindLabel(kind) {
  return {
    series: "系列",
    timeline: "时间线",
    work: "作品",
    generation: "世代",
    chapter: "FGO 章节",
    game: "游戏",
    product_line: "产品线",
  }[kind] || kind;
}

function categoryRow(category) {
  const cover = safeUrl(category.cover_url);
  return `<button class="category-row" data-category-id="${escapeHtml(category.id)}">
    ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<span class="category-art"></span>`}
    <div><strong>${escapeHtml(category.labels?.zh || category.key)}</strong><small>${escapeHtml(categoryKindLabel(category.kind || "series"))} · ${escapeHtml(category.key)} · sort ${category.sort ?? 999}</small></div>
    <span>${category.count || 0}</span>
  </button>`;
}

function mediaProducts() {
  const queued = state.cms?.image_tasks || {};
  return state.kits.filter((kit) => {
    const url = imageUrl(kit);
    if (state.mediaMode === "missing") return !url;
    if (state.mediaMode === "remote") return /^https?:/i.test(url);
    if (state.mediaMode === "local") return url && !/^https?:/i.test(url);
    if (state.mediaMode === "queued") return Boolean(queued[kit.kit_id]);
    return true;
  });
}

function renderMedia() {
  const products = mediaProducts().slice(0, 240);
  const missing = state.kits.filter((kit) => !imageUrl(kit)).length;
  const remote = state.kits.filter((kit) => /^https?:/i.test(imageUrl(kit))).length;
  const local = state.kits.filter((kit) => imageUrl(kit) && !/^https?:/i.test(imageUrl(kit))).length;
  elements.workspace.innerHTML = `
    ${sectionToolbar("图片资产库", "检查封面、替换图片 URL，并把远程图片加入缓存队列。缓存任务会进入发布记录。")}
    <div class="metric-strip">
      <div class="metric"><span>目录图片</span><strong>${state.imageAssets?.image_files || state.kits.length - missing}</strong><small>${state.imageAssets?.total_mb || "—"} MB</small></div>
      <div class="metric"><span>本地缓存</span><strong>${local}</strong><small>稳定资产</small></div>
      <div class="metric"><span>远程链接</span><strong>${remote}</strong><small>建议缓存</small></div>
      <div class="metric"><span>缺少封面</span><strong>${missing}</strong><small>需要修复</small></div>
      <div class="metric"><span>缓存队列</span><strong>${Object.keys(state.cms?.image_tasks || {}).length}</strong><small>待工作流处理</small></div>
    </div>
    <div class="filter-toolbar" style="margin-top:18px">
      <select id="mediaMode">${optionMarkup([["all", "全部图片"], ["missing", "缺少封面"], ["remote", "远程链接"], ["local", "本地缓存"], ["queued", "缓存队列"]], state.mediaMode)}</select>
    </div>
    <div class="media-grid">${products.map(mediaItem).join("") || emptyState("image", "没有匹配的图片记录", "换一个图片状态继续检查。")}</div>`;
}

function mediaItem(product) {
  const cover = safeUrl(imageUrl(product));
  const queued = state.cms?.image_tasks?.[product.kit_id];
  return `<button class="media-item" data-product-id="${escapeHtml(product.kit_id)}">
    ${cover ? `<img class="media-thumb" src="${escapeHtml(cover)}" alt="">` : `<span class="media-thumb"></span>`}
    <div><strong>${escapeHtml(displayName(product))}</strong><small>${cover ? (/^https?:/.test(cover) ? "远程图片" : "本地缓存") : "缺少封面"}</small></div>
    <span class="status-badge ${queued ? "is-warning" : cover ? "is-ok" : "is-error"}">${queued ? "已排队" : cover ? "可用" : "缺失"}</span>
  </button>`;
}

function sourceRows(checks) {
  return (checks || []).map((check) => `<div class="source-row">
    <div><strong>${escapeHtml(check.source_id || "unknown")}</strong><small>${escapeHtml(check.final_url || check.url || "")}</small></div>
    <span class="status-badge ${check.status === "ok" ? "is-ok" : check.status === "blocked" || check.status === "warning" ? "is-warning" : "is-error"}">${escapeHtml(check.status || "unknown")}</span>
    <code>${check.http_status || "—"} · ${check.duration_ms || "—"}ms</code>
    <p>${escapeHtml(check.message || "")}</p>
  </div>`).join("");
}

function renderHarvest() {
  const checks = state.sourceHealth?.checks || [];
  const ok = checks.filter((check) => check.status === "ok").length;
  const blocked = checks.filter((check) => check.status === "blocked").length;
  const failed = checks.length - ok - blocked;
  elements.workspace.innerHTML = `
    ${sectionToolbar("抓取与错误中心", "这里展示每日工作流的来源状态。数据抓取仍由 GitHub Actions 和日本环境脚本执行。", `<a class="quiet-button" href="https://github.com/mdefitko777/Gunpula/actions" target="_blank" rel="noreferrer">${icon("external")}打开 Actions</a>`)}
    <div class="metric-strip">
      <div class="metric"><span>检查来源</span><strong>${checks.length}</strong><small>${state.sourceHealth?.updated_at || "—"}</small></div>
      <div class="metric"><span>正常</span><strong>${ok}</strong><small>可抓取</small></div>
      <div class="metric"><span>区域限制</span><strong>${blocked}</strong><small>使用恢复链路</small></div>
      <div class="metric"><span>警告 / 失败</span><strong>${failed}</strong><small>需要检查</small></div>
      <div class="metric"><span>PB 日本记录</span><strong>${state.pbandai?.items?.length || state.pbandai?.products?.length || 0}</strong><small>缓存数据</small></div>
    </div>
    <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>来源检查</h2><p>区域限制不会被当作普通网络失败</p></div></div><div class="source-list">${sourceRows(checks)}</div></section>`;
}

function announcementStatusLabel(status) {
  return {
    announced: "已官宣",
    product_confirmed: "商品化确定",
    preorder_open: "预约开放",
    dismissed: "已排除",
  }[status] || status || "待确认";
}

function renderAnnouncements() {
  const records = state.announcements.filter((item) => state.announcementStatus === "all" || item.status === state.announcementStatus);
  elements.workspace.innerHTML = `
    ${sectionToolbar("官方预告中心", "直播和官网公开后先进入这里；确认正式商品前不会进入发售目录。", `<button class="primary-button" id="addAnnouncement" type="button">${icon("plus")}手动记录直播预告</button>`)}
    <div class="metric-strip">
      <div class="metric"><span>预告记录</span><strong>${state.announcements.length}</strong><small>${state.announcementDoc?.updated_at ? formatDate(state.announcementDoc.updated_at) : "等待首次抓取"}</small></div>
      <div class="metric"><span>待确认</span><strong>${state.announcements.filter((item) => item.status === "announced").length}</strong><small>直播与自动候选</small></div>
      <div class="metric"><span>已关联商品</span><strong>${state.announcements.filter((item) => item.linked_kit_id).length}</strong><small>保留官宣历史</small></div>
      <div class="metric"><span>抓取错误</span><strong>${state.announcementDoc?.fetch_errors?.length || 0}</strong><small>官方新闻 / YouTube</small></div>
    </div>
    <div class="filter-toolbar" style="margin-top:18px">
      <select id="announcementStatus" aria-label="预告状态">${optionMarkup([
        ["all", "全部状态"],
        ["announced", "已官宣 / 待确认"],
        ["product_confirmed", "商品化确定"],
        ["preorder_open", "预约开放"],
        ["dismissed", "已排除"],
      ], state.announcementStatus)}</select>
    </div>
    <div class="announcement-grid">${records.map((item) => `
      <button type="button" class="announcement-card" data-announcement-id="${escapeHtml(item.id)}">
        <span class="announcement-art">${safeUrl(item.thumbnail_url) ? `<img src="${escapeHtml(safeUrl(item.thumbnail_url))}" alt="">` : icon("bell")}</span>
        <span class="announcement-copy">
          <small>${escapeHtml(item.announced_at || "日期待补")} · ${escapeHtml(item.source_name || "人工录入")}</small>
          <strong>${escapeHtml(displayName(item))}</strong>
          <em>${escapeHtml([item.grade_code, item.series_key !== "unclassified" ? item.series_key : null, item.linked_kit_id].filter(Boolean).join(" · ") || "产品信息待确认")}</em>
        </span>
        <span class="status-badge ${item.status === "preorder_open" ? "is-ok" : item.status === "dismissed" ? "is-error" : "is-warning"}">${escapeHtml(announcementStatusLabel(item.status))}</span>
      </button>`).join("") || emptyState("bell", "没有匹配的预告", "自动抓取每天运行，也可以手动记录直播中的新品。")}</div>`;
}

function duplicateReviewKey(group) {
  return `duplicate:${group.map((item) => item.kit_id).sort().join("|")}`;
}

function visibleDuplicateGroups() {
  return state.duplicates.filter((group) => !state.cms?.reviews?.[duplicateReviewKey(group)]?.ignored && group.some((item) => state.kitById.has(item.kit_id)));
}

function renderDuplicates() {
  const groups = visibleDuplicateGroups();
  elements.workspace.innerHTML = `
    ${sectionToolbar("重复数据对比", `剩余 ${groups.length} 组候选。合并只隐藏被合并 ID，并把它映射到保留记录。`)}
    <div class="duplicate-list">${groups.slice(0, 100).map(duplicateGroup).join("") || emptyState("check", "重复候选已经处理完", "新的抓取结果会继续进入这里。")}</div>`;
}

function duplicateGroup(group) {
  const products = group.map((item) => state.kitById.get(item.kit_id) || item).slice(0, 2);
  if (products.length < 2) return "";
  const [first, second] = products;
  return `<section class="duplicate-group" data-review-key="${escapeHtml(duplicateReviewKey(group))}">
    <header class="duplicate-head"><strong>${escapeHtml(displayName(first))}</strong><span>${escapeHtml(first.franchise || "")} · ${escapeHtml(first.grade_code || "")}</span></header>
    <div class="compare-grid">
      ${products.map((product) => `<button type="button" class="compare-product" data-product-id="${escapeHtml(product.kit_id)}">
        ${imageUrl(product) ? `<img src="${escapeHtml(safeUrl(imageUrl(product)))}" alt="">` : `<span class="media-thumb"></span>`}
        <span><strong>${escapeHtml(displayName(product))}</strong><small>${escapeHtml(product.kit_id)}</small><small>${escapeHtml(product.work_title || product.universe || "作品未知")} · ${escapeHtml(product.release_date || "日期未知")}</small><small>${escapeHtml(product.grade_code || "产品线未知")} · ${escapeHtml((product.source_urls || []).length)} 个来源 · 点击查看完整资料</small></span>
      </button>`).join("")}
      <div class="compare-actions">
        <button class="primary-button merge-button" data-keep="${escapeHtml(first.kit_id)}" data-lose="${escapeHtml(second.kit_id)}">保留左侧并合并</button>
        <button class="primary-button merge-button" data-keep="${escapeHtml(second.kit_id)}" data-lose="${escapeHtml(first.kit_id)}">保留右侧并合并</button>
        <button class="quiet-button ignore-duplicate" data-key="${escapeHtml(duplicateReviewKey(group))}">不是重复</button>
      </div>
    </div>
  </section>`;
}

function renderChanges() {
  const drafts = state.bootstrap?.drafts || [];
  const publishedHistory = (state.bootstrap?.history || []).filter((item) => item.status !== "draft").slice(0, 120);
  elements.workspace.innerHTML = `
    ${sectionToolbar("变更记录", "同一批操作会一起撤销；已发布操作可以恢复为修改前并形成新草稿。")}
    <section class="panel">
      <div class="panel-head"><div><h2>待发布</h2><p>${drafts.length} 条变更</p></div></div>
      <div class="activity-list">${drafts.length ? drafts.slice().reverse().map((change) => `
        <div class="activity-item"><span class="activity-icon">${icon(change.entity_type === "merge" ? "copy" : "edit")}</span><div><strong>${escapeHtml(changeLabel(change))}</strong><small>${escapeHtml(change.entity_id)} · ${formatDate(change.created_at)}</small></div><button class="quiet-button undo-change" data-id="${change.id}">${icon("undo")}撤销</button></div>`).join("") : emptyInline("没有待发布变更")}</div>
    </section>
    <section class="panel" style="margin-top:16px">
      <div class="panel-head"><div><h2>历史</h2><p>已发布与已撤销操作</p></div></div>
      <div class="activity-list">${publishedHistory.length ? publishedHistory.map((change) => `
        <div class="activity-item">
          <span class="activity-icon">${icon(change.entity_type === "merge" ? "copy" : "history")}</span>
          <div><strong>${escapeHtml(changeLabel(change))}</strong><small>${escapeHtml(change.entity_id)} · ${escapeHtml(change.status)} · ${formatDate(change.created_at)}</small></div>
          ${change.status === "published" ? `<button class="quiet-button revert-change" data-id="${change.id}">${icon("undo")}恢复修改前</button>` : ""}
        </div>`).join("") : emptyInline("还没有历史变更")}</div>
    </section>`;
}

function renderReleases() {
  const releases = state.bootstrap?.releases || [];
  elements.workspace.innerHTML = `
    ${sectionToolbar("发布版本", "版本号和快照保持不变；这里只允许修正版本说明。")}
    <section class="panel"><div class="release-list">${releases.length ? releases.map((release) => `
      <form class="release-row release-note-form" data-revision="${release.revision}">
        <strong>r${release.revision}</strong>
        <label><span>版本说明</span><input name="note" maxlength="2000" value="${escapeHtml(release.note || "")}" placeholder="补充这次发布做了什么"></label>
        <small>${escapeHtml(release.change_count)} 条变更 · ${formatDate(release.published_at)}</small>
        <button class="quiet-button" type="submit">${icon("check")}保存说明</button>
      </form>`).join("") : emptyInline("还没有 CMS 发布版本")}</div></section>`;
}

function emptyState(iconName, title, body) {
  return `<div class="empty-state">${icon(iconName)}<h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></div>`;
}

function announcementPatch(form, item) {
  const values = Object.fromEntries(new FormData(form).entries());
  return {
    kind: "announcement",
    franchise: "gundam",
    names: { zh: values.name_zh || null, ko: values.name_ko || null, en: values.name_en || null, ja: values.name_ja || null },
    status: values.status,
    announced_at: values.announced_at || null,
    source_type: item.source_type || "manual",
    source_name: values.source_name || null,
    source_url: values.source_url || null,
    thumbnail_url: values.thumbnail_url || null,
    video_id: item.video_id || null,
    video_timestamp_seconds: values.video_timestamp_seconds === "" ? null : Number(values.video_timestamp_seconds),
    series_key: values.series_key || "unclassified",
    grade_code: values.grade_code || null,
    linked_kit_id: values.linked_kit_id || null,
    confidence: item.confidence || "manual",
    notes: values.notes || null,
  };
}

function announcementProduct(item, kitId) {
  return {
    kit_id: kitId,
    franchise: "gundam",
    names: item.names,
    grade_code: item.grade_code || "OTHER",
    subline: null,
    number: null,
    scale: "various",
    universe: item.series_key,
    work_title: item.series_key,
    series: { key: item.series_key || "unclassified" },
    release_date: null,
    price_jpy: null,
    is_limited: false,
    data_status: "needs_review",
    tags: ["official announcement"],
    images: { box_art_url: item.thumbnail_url, box_art_source_id: "bandai_official_announcement" },
    gallery_image_urls: item.thumbnail_url ? [item.thumbnail_url] : [],
    source_urls: item.source_url ? [item.source_url] : [],
    source_refs: [{ source_id: "bandai_official_announcement", url: item.source_url, fields: ["names", "grade_code", "series", "images"], confidence: "medium" }],
    notes: `Created from official announcement; release date and price require confirmation.`,
  };
}

function showAnnouncementInspector(announcement = null) {
  const isNew = !announcement;
  const item = announcement || {
    id: `manual-${crypto.randomUUID()}`,
    names: { zh: "", ko: "", en: "", ja: "" },
    status: "announced",
    announced_at: new Date().toISOString().slice(0, 10),
    source_type: "manual",
    source_name: "BANDAI official live",
    source_url: "",
    thumbnail_url: "",
    video_timestamp_seconds: null,
    series_key: "unclassified",
    grade_code: "",
    linked_kit_id: null,
    confidence: "manual",
    notes: "",
  };
  elements.inspector.hidden = false;
  elements.workspaceLayout.classList.add("has-inspector");
  elements.inspector.innerHTML = `
    <header class="inspector-head"><div><strong>${isNew ? "记录直播预告" : escapeHtml(displayName(item))}</strong><small>${escapeHtml(item.id)}</small></div><button id="closeInspector" type="button" aria-label="关闭">${icon("x")}</button></header>
    <form class="editor-form" id="announcementEditor">
      <div class="editor-cover" id="announcementCover">${safeUrl(item.thumbnail_url) ? `<img src="${escapeHtml(safeUrl(item.thumbnail_url))}" alt="">` : icon("bell")}</div>
      <section class="form-section">
        <h3>预告状态</h3>
        <label class="field">状态<select name="status">${optionMarkup([["announced", "已官宣 / 待确认"], ["product_confirmed", "商品化确定"], ["preorder_open", "预约开放"], ["dismissed", "不属于商品预告"]], item.status)}</select></label>
        <label class="field">官宣日期<input type="date" name="announced_at" value="${escapeHtml(item.announced_at || "")}"></label>
        <label class="field">产品线<input name="grade_code" value="${escapeHtml(item.grade_code || "")}" placeholder="HG / MG / RG"></label>
        <label class="field">系列<input name="series_key" value="${escapeHtml(item.series_key || "")}" placeholder="SEED / 00"></label>
        <label class="field is-wide">正式商品 ID<input name="linked_kit_id" value="${escapeHtml(item.linked_kit_id || "")}" placeholder="已有 ID 直接关联；新 ID 会创建商品草稿"></label>
      </section>
      <section class="form-section">
        <h3>四语暂定名称</h3>
        <label class="field is-wide">中文<input name="name_zh" value="${escapeHtml(item.names?.zh || "")}"></label>
        <label class="field is-wide">한국어<input name="name_ko" value="${escapeHtml(item.names?.ko || "")}"></label>
        <label class="field is-wide">English<input name="name_en" value="${escapeHtml(item.names?.en || "")}"></label>
        <label class="field is-wide">日本語<input name="name_ja" value="${escapeHtml(item.names?.ja || "")}"></label>
      </section>
      <section class="form-section">
        <h3>直播与出处</h3>
        <label class="field is-wide">官方链接<input name="source_url" value="${escapeHtml(item.source_url || "")}"></label>
        <label class="field">来源名称<input name="source_name" value="${escapeHtml(item.source_name || "")}"></label>
        <label class="field">直播时间点（秒）<input type="number" min="0" name="video_timestamp_seconds" value="${item.video_timestamp_seconds ?? ""}"></label>
        <label class="field is-wide">截图 / 封面 URL<input name="thumbnail_url" value="${escapeHtml(item.thumbnail_url || "")}"></label>
        <label class="field is-wide">备注<textarea rows="4" name="notes">${escapeHtml(item.notes || "")}</textarea></label>
      </section>
    </form>
    <footer class="inspector-actions">
      ${!isNew && safeUrl(item.source_url) ? `<a class="quiet-button" href="${escapeHtml(safeUrl(item.source_url))}" target="_blank" rel="noreferrer">${icon("external")}打开官方出处</a>` : ""}
      ${!isNew && item.status !== "dismissed" ? `<button class="quiet-button" id="promoteAnnouncement" type="button">${icon("package")}关联 / 创建正式商品</button>` : ""}
      <button class="primary-button" type="submit" form="announcementEditor">${icon("check")}保存草稿</button>
    </footer>`;
  const form = elements.inspector.querySelector("#announcementEditor");
  elements.inspector.querySelector("#closeInspector")?.addEventListener("click", () => closeInspector());
  form?.querySelector('[name="thumbnail_url"]')?.addEventListener("input", (event) => {
    const url = safeUrl(event.target.value);
    elements.inspector.querySelector("#announcementCover").innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : icon("bell");
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await saveChange({ entity_type: "source", entity_id: `announcement:${item.id}`, operation: isNew ? "add" : "edit", patch: announcementPatch(form, item), before_value: isNew ? {} : item });
      toast("预告已保存为草稿");
      await reloadBackend();
      state.section = "announcements";
      render();
    } catch (error) {
      toast(error.message, "error");
    }
  });
  elements.inspector.querySelector("#promoteAnnouncement")?.addEventListener("click", async () => {
    const patch = announcementPatch(form, item);
    const kitId = String(patch.linked_kit_id || "").trim();
    if (!/^[a-z0-9]+[a-z0-9-]*$/.test(kitId)) {
      toast(kitId ? "商品 ID 只能使用小写字母、数字和连字符" : "先填写正式商品 ID", "error");
      form.querySelector('[name="linked_kit_id"]')?.focus();
      return;
    }
    const changes = [{
      entity_type: "source",
      entity_id: `announcement:${item.id}`,
      operation: "edit",
      patch: { ...patch, status: patch.status === "preorder_open" ? "preorder_open" : "product_confirmed", reviewed_at: new Date().toISOString() },
      before_value: item,
    }];
    if (!state.kitById.has(kitId)) {
      changes.push({ entity_type: "product", entity_id: kitId, operation: "add", patch: announcementProduct(patch, kitId), before_value: {} });
    }
    try {
      await saveChanges(changes);
      toast(state.kitById.has(kitId) ? "已关联现有商品" : "已创建商品草稿并保留官宣记录");
      await reloadBackend();
      state.section = "products";
      state.productFilters = { ...DEFAULT_PRODUCT_FILTERS, query: kitId };
      render();
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function showProductInspector(productId = "", isNew = false) {
  const product = isNew
    ? {
        kit_id: "",
        franchise: "gundam",
        names: { zh: "", ko: "", en: "", ja: "" },
        grade_code: "OTHER",
        subline: null,
        number: null,
        scale: "non-scale",
        universe: null,
        work_title: null,
        series: { key: "unclassified" },
        release_date: null,
        price_jpy: null,
        is_limited: false,
        data_status: "needs_review",
        tags: [],
        images: { box_art_url: null, box_art_source_id: null },
        gallery_image_urls: [],
        source_urls: [],
        source_refs: [],
        notes: null,
      }
    : state.kitById.get(productId);
  if (!product) return;
  state.selectedProductId = isNew ? "__new__" : product.kit_id;
  elements.inspector.hidden = false;
  elements.workspaceLayout.classList.add("has-inspector");
  elements.inspector.innerHTML = productEditorMarkup(product, isNew);
  bindInspectorControls(product, isNew);
}

function productEditorMarkup(product, isNew) {
  const cover = safeUrl(imageUrl(product));
  const gallery = [...new Set([cover, ...(product.gallery_image_urls || []).map(safeUrl)].filter(Boolean))].slice(0, 12);
  const linkedCategoryIds = new Set(product.taxonomy_ids || []);
  for (const category of state.categories) {
    if (category.franchise === product.franchise && category.linked_kit_ids?.includes(product.kit_id)) linkedCategoryIds.add(category.id);
  }
  const seriesKinds = product.franchise === "beyblade" ? ["product_line", "series"] : ["series"];
  const gradeOptions = [...new Set([product.grade_code, ...state.grades.map((grade) => grade.code || grade.grade_code).filter(Boolean)])].map((code) => [code, code]);
  return `
    <header class="inspector-head"><div><strong>${isNew ? "新增商品" : escapeHtml(displayName(product))}</strong><small>${escapeHtml(product.kit_id || "填写稳定 ID")}</small></div><button id="closeInspector" type="button" aria-label="关闭">${icon("x")}</button></header>
    <form class="editor-form" id="productEditor">
      <div class="editor-cover" id="editorCover">${cover ? `<img src="${escapeHtml(cover)}" alt="">` : icon("image")}</div>
      ${gallery.length > 1 ? `<div class="editor-gallery">${gallery.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(url)}" alt=""></a>`).join("")}</div>` : ""}
      <section class="form-section">
        <h3>标识与分类</h3>
        <label class="field is-wide">商品 ID<input name="kit_id" value="${escapeHtml(product.kit_id)}" ${isNew ? "" : "readonly"} required></label>
        <label class="field">主题<select name="franchise">${optionMarkup(FRANCHISES, product.franchise)}</select></label>
        <label class="field">系列<select name="series_key">${categoryOptionMarkup(product.franchise, seriesKey(product), { kinds: seriesKinds })}</select></label>
        <label class="field">产品线<select name="grade_code">${optionMarkup(gradeOptions, product.grade_code)}</select></label>
        <label class="field">子产品线<input name="subline" value="${escapeHtml(product.subline || "")}"></label>
        <label class="field">宇宙 / 世代<input name="universe" value="${escapeHtml(product.universe || "")}"></label>
        <label class="field">作品<input name="work_title" value="${escapeHtml(product.work_title || "")}"></label>
        <label class="field is-wide">关联分类<select name="taxonomy_ids" multiple size="6">${categoryOptionMarkup(product.franchise, [...linkedCategoryIds], { useId: true })}</select><small>按 Ctrl / Shift 多选作品、世代、章节或游戏</small></label>
      </section>
      <section class="form-section">
        <h3>四语名称</h3>
        <label class="field is-wide">中文<input name="name_zh" value="${escapeHtml(product.names?.zh || "")}"></label>
        <label class="field is-wide">한국어<input name="name_ko" value="${escapeHtml(product.names?.ko || "")}"></label>
        <label class="field is-wide">English<input name="name_en" value="${escapeHtml(product.names?.en || "")}"></label>
        <label class="field is-wide">日本語<input name="name_ja" value="${escapeHtml(product.names?.ja || "")}"></label>
      </section>
      <section class="form-section">
        <h3>发售信息</h3>
        <label class="field">发售日期<input name="release_date" value="${escapeHtml(product.release_date || "")}" placeholder="YYYY-MM-DD"></label>
        <label class="field">定价（日元）<input name="price_jpy" type="number" min="0" value="${product.price_jpy ?? ""}"></label>
        <label class="field">状态<select name="data_status">${optionMarkup([["verified", "已核对"], ["needs_review", "待核对"], ["seed", "种子"], ["retired", "已退役"], ["hidden", "已隐藏"]], product.data_status)}</select></label>
        <label class="check-field"><input name="is_limited" type="checkbox" ${product.is_limited ? "checked" : ""}>限定商品</label>
        <label class="field is-wide">标签（逗号分隔）<input name="tags" value="${escapeHtml((product.tags || []).join(", "))}"></label>
      </section>
      <section class="form-section">
        <h3>图片与来源</h3>
        <label class="field is-wide">封面 URL<input name="cover_url" value="${escapeHtml(cover)}"></label>
        <label class="field is-wide">展示图 URL（每行一个）<textarea name="gallery_urls" rows="4">${escapeHtml((product.gallery_image_urls || []).join("\n"))}</textarea></label>
        <label class="field is-wide">来源 URL（每行一个）<textarea name="source_urls" rows="4">${escapeHtml((product.source_urls || []).join("\n"))}</textarea></label>
        <label class="field is-wide">备注<textarea name="notes" rows="3">${escapeHtml(product.notes || "")}</textarea></label>
      </section>
    </form>
    <footer class="inspector-actions">
      ${!isNew && /^https?:/i.test(cover) ? `<button class="quiet-button" id="queueImage" type="button">${icon("image")}缓存图片</button>` : ""}
      ${!isNew ? `<button class="danger-button" id="hideProduct" type="button">${icon("trash")}${product.data_status === "hidden" ? "取消隐藏" : "隐藏商品"}</button>` : ""}
      <button class="primary-button" id="saveProduct" type="submit" form="productEditor">${icon("check")}保存草稿</button>
    </footer>`;
}

function bindInspectorControls(product, isNew) {
  elements.inspector.querySelector("#closeInspector")?.addEventListener("click", () => closeInspector());
  const form = elements.inspector.querySelector("#productEditor");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    values.is_limited = formData.has("is_limited");
    values.taxonomy_ids = formData.getAll("taxonomy_ids");
    const patch = productPatchFromForm(values, product);
    const next = { ...product, ...patch, kit_id: values.kit_id };
    const errors = validateProduct(next, new Set(state.kits.map((kit) => kit.kit_id)), isNew ? "" : product.kit_id);
    if (errors.length) {
      toast(errors[0], "error");
      return;
    }
    try {
      await saveChange({
        entity_type: "product",
        entity_id: next.kit_id,
        operation: isNew ? "add" : "edit",
        patch: isNew ? next : patch,
        before_value: isNew ? {} : product,
      });
      toast(isNew ? "商品已加入草稿" : "修改已保存为草稿");
      await reloadBackend();
      showProductInspector(next.kit_id);
    } catch (error) {
      toast(error.message, "error");
    }
  });
  form?.querySelector('[name="cover_url"]')?.addEventListener("input", (event) => {
    const cover = elements.inspector.querySelector("#editorCover");
    const url = safeUrl(event.target.value);
    cover.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : icon("image");
  });
  form?.querySelector('[name="franchise"]')?.addEventListener("change", (event) => {
    const categorySelect = form.querySelector('[name="series_key"]');
    const seriesKinds = event.target.value === "beyblade" ? ["product_line", "series"] : ["series"];
    categorySelect.innerHTML = categoryOptionMarkup(event.target.value, "unclassified", { kinds: seriesKinds });
    form.querySelector('[name="taxonomy_ids"]').innerHTML = categoryOptionMarkup(event.target.value, [], { useId: true });
  });
  elements.inspector.querySelector("#hideProduct")?.addEventListener("click", async () => {
    const isHidden = product.data_status === "hidden";
    const restoredStatus = state.baseKits.find((item) => item.kit_id === product.kit_id)?.data_status || "needs_review";
    const nextStatus = isHidden ? restoredStatus : "hidden";
    const title = isHidden ? "取消隐藏" : "隐藏商品";
    const message = isHidden
      ? `确认让“${displayName(product)}”重新出现在正式目录中？`
      : `确认隐藏“${displayName(product)}”？收藏记录不会删除。`;
    if (!await confirmAction(title, message)) return;
    await saveChange({ entity_type: "product", entity_id: product.kit_id, operation: "hide", patch: { data_status: nextStatus }, before_value: { data_status: product.data_status } });
    toast(isHidden ? "商品已恢复显示" : "商品已隐藏，发布前仍可撤销");
    await reloadBackend();
  });
  elements.inspector.querySelector("#queueImage")?.addEventListener("click", () => queueImageTask(product));
}

function showCategoryInspector(category = null) {
  const item = category || {
    id: `${state.taxonomyFranchise}:new-category`,
    franchise: state.taxonomyFranchise,
    key: "new-category",
    kind: "series",
    labels: { zh: "", ko: "", en: "", ja: "" },
    sort: 999,
    cover_url: "",
    aliases: [],
    parent_id: "",
    count: 0,
  };
  const isNew = !category;
  const linkedProducts = (item.linked_kit_ids || []).map((id) => state.kitById.get(id)).filter(Boolean);
  state.selectedCategoryId = isNew ? "__new__" : item.id;
  elements.inspector.hidden = false;
  elements.workspaceLayout.classList.add("has-inspector");
  elements.inspector.innerHTML = `
    <header class="inspector-head"><div><strong>${isNew ? "新增分类" : escapeHtml(item.labels?.zh || item.key)}</strong><small>${escapeHtml(item.id)}</small></div><button id="closeInspector" type="button">${icon("x")}</button></header>
    <form class="editor-form" id="categoryEditor">
      <div class="editor-cover">${item.cover_url ? `<img src="${escapeHtml(safeUrl(item.cover_url))}" alt="">` : icon("tree")}</div>
      <section class="form-section">
        <h3>分类结构</h3>
        <label class="field">主题${isNew
          ? `<select name="franchise">${optionMarkup(FRANCHISES, item.franchise)}</select>`
          : `<select disabled>${optionMarkup(FRANCHISES, item.franchise)}</select><input type="hidden" name="franchise" value="${escapeHtml(item.franchise)}">`}
        </label>
        <label class="field">分类类型<select name="kind">${optionMarkup([
          ["series", "系列"],
          ["timeline", "时间线"],
          ["work", "作品"],
          ["generation", "世代"],
          ["chapter", "FGO 章节"],
          ["game", "游戏"],
          ["product_line", "产品线"],
        ], item.kind || "series")}</select></label>
        <label class="field">稳定键<input name="key" value="${escapeHtml(item.key)}" ${isNew ? "" : "readonly"}></label>
        <label class="field">排序<input name="sort" type="number" value="${Number(item.sort ?? 999)}"></label>
        <label class="field">父分类<input name="parent_id" value="${escapeHtml(item.parent_id || "")}" placeholder="可留空"></label>
      </section>
      <section class="form-section">
        <h3>四语名称</h3>
        ${["zh", "ko", "en", "ja"].map((code) => `<label class="field is-wide">${code.toUpperCase()}<input name="label_${code}" value="${escapeHtml(item.labels?.[code] || "")}"></label>`).join("")}
        ${["zh", "ko", "en", "ja"].map((code) => `<label class="field is-wide">${code.toUpperCase()} 副标题<input name="subtitle_${code}" value="${escapeHtml(item.subtitle?.[code] || "")}"></label>`).join("")}
      </section>
      <section class="form-section">
        <h3>展示与匹配</h3>
        <label class="field is-wide">封面 URL<input name="cover_url" value="${escapeHtml(item.cover_url || "")}"></label>
        <label class="field is-wide">别名（每行一个）<textarea name="aliases" rows="5">${escapeHtml((item.aliases || []).join("\n"))}</textarea></label>
      </section>
      ${isNew ? "" : `<section class="category-members">
        <div class="category-members-head"><div><h3>分类中的商品</h3><small>${linkedProducts.length} 条，可点开查看完整资料</small></div><button class="quiet-button" id="openCategoryProducts" type="button">${icon("package")}去商品目录批量处理</button></div>
        <div class="category-member-list">${linkedProducts.slice(0, 160).map((product) => {
          const cover = safeUrl(imageUrl(product));
          return `<button type="button" class="category-member" data-category-product-id="${escapeHtml(product.kit_id)}">
            ${cover ? `<img src="${escapeHtml(cover)}" alt="">` : `<span class="media-thumb"></span>`}
            <span><strong>${escapeHtml(displayName(product))}</strong><small>${escapeHtml(product.kit_id)} · ${escapeHtml(product.grade_code || "—")} · ${escapeHtml(product.release_date || "日期未知")}</small></span>
            ${icon("eye")}
          </button>`;
        }).join("") || `<p class="category-member-empty">这个分类还没有关联商品。</p>`}</div>
        ${linkedProducts.length > 160 ? `<small class="muted">此处先显示 160 条；商品目录可查看全部。</small>` : ""}
      </section>`}
    </form>
    <footer class="inspector-actions"><button class="primary-button" type="submit" form="categoryEditor">${icon("check")}保存分类</button></footer>`;
  elements.inspector.querySelector("#closeInspector")?.addEventListener("click", () => closeInspector());
  elements.inspector.querySelectorAll("[data-category-product-id]").forEach((button) => button.addEventListener("click", () => showProductInspector(button.dataset.categoryProductId)));
  elements.inspector.querySelector("#openCategoryProducts")?.addEventListener("click", () => {
    state.productFilters = { ...DEFAULT_PRODUCT_FILTERS, franchise: item.franchise, category: item.id };
    state.productPage = 1;
    state.section = "products";
    render();
  });
  elements.inspector.querySelector("#categoryEditor")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const id = isNew ? `${values.franchise}:${values.key.trim()}` : item.id;
    if (!values.key.trim() || !values.label_zh.trim()) {
      toast("稳定键和中文名称不能为空", "error");
      return;
    }
    const patch = {
      id,
      franchise: values.franchise,
      key: values.key.trim(),
      kind: values.kind,
      labels: { zh: values.label_zh.trim(), ko: values.label_ko.trim(), en: values.label_en.trim(), ja: values.label_ja.trim() },
      subtitle: { zh: values.subtitle_zh.trim(), ko: values.subtitle_ko.trim(), en: values.subtitle_en.trim(), ja: values.subtitle_ja.trim() },
      sort: Number(values.sort || 999),
      parent_id: values.parent_id.trim() || null,
      cover_url: values.cover_url.trim(),
      aliases: values.aliases.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    };
    try {
      await saveChange({ entity_type: "category", entity_id: id, operation: isNew ? "add" : "edit", patch, before_value: isNew ? {} : item });
      toast("分类修改已保存为草稿");
      await reloadBackend();
      state.taxonomyFranchise = values.franchise;
      state.section = "taxonomy";
      render();
      showCategoryInspector(state.categories.find((entry) => entry.id === id));
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function closeInspector(clear = true) {
  elements.inspector.hidden = true;
  elements.inspector.innerHTML = "";
  elements.workspaceLayout.classList.remove("has-inspector");
  if (clear) {
    state.selectedProductId = "";
    state.selectedCategoryId = "";
  }
}

function bulkValueOptions(field) {
  if (field === "franchise") return FRANCHISES;
  if (field === "series") {
    const selectedFranchises = new Set([...state.selectedIds].map((id) => state.kitById.get(id)?.franchise).filter(Boolean));
    return state.categories.filter((category) => selectedFranchises.size !== 1 || selectedFranchises.has(category.franchise)).map((category) => [category.key, `${FRANCHISE_LABELS[category.franchise]} · ${category.labels?.zh || category.key}`]);
  }
  if (field === "grade_code") return [...new Set(state.grades.map((grade) => grade.code || grade.grade_code).filter(Boolean))].map((code) => [code, code]);
  return [["verified", "已核对"], ["needs_review", "待核对"], ["seed", "种子"], ["retired", "已退役"], ["hidden", "已隐藏"]];
}

async function applyBulkChanges() {
  const field = elements.workspace.querySelector("#bulkField")?.value;
  const value = elements.workspace.querySelector("#bulkValue")?.value;
  if (!field || !value) return;
  const changes = [...state.selectedIds].map((id) => {
    const product = state.kitById.get(id);
    const patch = field === "series" ? { series: { ...(product.series || {}), key: value } } : { [field]: value };
    const beforeValue = field === "series" ? { series: product.series || null } : { [field]: product[field] ?? null };
    return { entity_type: "product", entity_id: id, operation: "move", patch, before_value: beforeValue };
  });
  try {
    await saveChanges(changes);
    toast(`${changes.length} 条商品已加入批量变更`);
    state.selectedIds.clear();
    await reloadBackend();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function hideSelected() {
  const count = state.selectedIds.size;
  if (!await confirmAction("批量隐藏", `确认隐藏选中的 ${count} 条商品？发布前可以在变更记录中撤销。`)) return;
  const changes = [...state.selectedIds].map((id) => ({ entity_type: "product", entity_id: id, operation: "hide", patch: { data_status: "hidden" }, before_value: { data_status: state.kitById.get(id)?.data_status || null } }));
  try {
    await saveChanges(changes);
    state.selectedIds.clear();
    toast(`${count} 条商品已隐藏`);
    await reloadBackend();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function queueImageTask(product) {
  try {
    await saveChange({
      entity_type: "image_task",
      entity_id: product.kit_id,
      operation: "repair",
      patch: { status: "queued", source_url: imageUrl(product), franchise: product.franchise, requested_at: new Date().toISOString() },
      before_value: state.cms?.image_tasks?.[product.kit_id] || {},
    });
    toast("图片已加入缓存队列");
    await reloadBackend();
    if (state.section === "media") render();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function mergeProducts(keepId, loseId) {
  const keep = state.kitById.get(keepId);
  const lose = state.kitById.get(loseId);
  if (!keep || !lose) return;
  if (!await confirmAction("合并重复记录", `保留“${displayName(keep)}”，并把 ${loseId} 映射到 ${keepId}？`)) return;
  try {
    await saveChange({ entity_type: "merge", entity_id: loseId, operation: "merge", patch: { target_id: keepId }, before_value: { target_id: null } });
    toast("合并关系已保存，收藏中的旧 ID 会解析到保留记录");
    await reloadBackend();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function ignoreDuplicate(key) {
  try {
    await saveChange({ entity_type: "review", entity_id: key, operation: "ignore", patch: { ignored: true, reviewed_at: new Date().toISOString() }, before_value: {} });
    toast("该候选已标记为不是重复");
    await reloadBackend();
  } catch (error) {
    toast(error.message, "error");
  }
}

function bindWorkspaceControls() {
  elements.workspace.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => switchSection(button.dataset.go)));
  elements.workspace.querySelector("#addProduct")?.addEventListener("click", () => showProductInspector("", true));
  elements.workspace.querySelector("#addCategory")?.addEventListener("click", () => showCategoryInspector());
  elements.workspace.querySelectorAll("[data-product-id]").forEach((row) => row.addEventListener("click", (event) => {
    if (event.target.closest("input")) return;
    showProductInspector(row.dataset.productId);
  }));
  elements.workspace.querySelectorAll(".row-check").forEach((checkbox) => checkbox.addEventListener("change", () => {
    if (checkbox.checked) state.selectedIds.add(checkbox.dataset.id);
    else state.selectedIds.delete(checkbox.dataset.id);
    renderProducts();
    bindWorkspaceControls();
  }));
  elements.workspace.querySelector("#selectPage")?.addEventListener("change", (event) => {
    const pageIds = [...elements.workspace.querySelectorAll(".row-check")].map((input) => input.dataset.id);
    for (const id of pageIds) event.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
    renderProducts();
    bindWorkspaceControls();
  });
  const filterBindings = [
    ["productQuery", "query"],
    ["productFranchise", "franchise"],
    ["productCategory", "category"],
    ["productGrade", "grade"],
    ["productSource", "source"],
    ["productReleaseYear", "releaseYear"],
    ["productLimited", "limited"],
    ["productStatus", "status"],
    ["productImage", "image"],
  ];
  for (const [id, key] of filterBindings) {
    elements.workspace.querySelector(`#${id}`)?.addEventListener(id === "productQuery" ? "input" : "change", (event) => {
      state.productFilters[key] = event.target.value;
      if (key === "franchise") state.productFilters.category = "all";
      state.productPage = 1;
      clearTimeout(bindWorkspaceControls.filterTimer);
      bindWorkspaceControls.filterTimer = setTimeout(() => {
        renderProducts();
        bindWorkspaceControls();
        attachImageFallbacks();
      }, id === "productQuery" ? 120 : 0);
    });
  }
  elements.workspace.querySelector("#resetProductFilters")?.addEventListener("click", () => {
    state.productFilters = { ...DEFAULT_PRODUCT_FILTERS };
    state.productPage = 1;
    renderProducts();
    bindWorkspaceControls();
  });
  elements.workspace.querySelector("#prevPage")?.addEventListener("click", () => {
    state.productPage -= 1;
    renderProducts();
    bindWorkspaceControls();
  });
  elements.workspace.querySelector("#nextPage")?.addEventListener("click", () => {
    state.productPage += 1;
    renderProducts();
    bindWorkspaceControls();
  });
  const bulkField = elements.workspace.querySelector("#bulkField");
  const bulkValue = elements.workspace.querySelector("#bulkValue");
  const updateBulk = () => {
    if (bulkField && bulkValue) bulkValue.innerHTML = optionMarkup(bulkValueOptions(bulkField.value), "");
  };
  bulkField?.addEventListener("change", updateBulk);
  updateBulk();
  elements.workspace.querySelector("#applyBulk")?.addEventListener("click", applyBulkChanges);
  elements.workspace.querySelector("#hideSelected")?.addEventListener("click", hideSelected);
  elements.workspace.querySelector("#clearSelection")?.addEventListener("click", () => {
    state.selectedIds.clear();
    renderProducts();
    bindWorkspaceControls();
  });
  elements.workspace.querySelectorAll("[data-taxonomy-franchise]").forEach((button) => button.addEventListener("click", () => {
    state.taxonomyFranchise = button.dataset.taxonomyFranchise;
    state.taxonomyKind = "";
    renderTaxonomy();
    bindWorkspaceControls();
    attachImageFallbacks();
  }));
  elements.workspace.querySelectorAll("[data-taxonomy-kind]").forEach((button) => button.addEventListener("click", () => {
    state.taxonomyKind = button.dataset.taxonomyKind;
    renderTaxonomy();
    bindWorkspaceControls();
    attachImageFallbacks();
  }));
  elements.workspace.querySelectorAll("[data-category-id]").forEach((button) => button.addEventListener("click", () => showCategoryInspector(state.categories.find((item) => item.id === button.dataset.categoryId))));
  elements.workspace.querySelector("#mediaMode")?.addEventListener("change", (event) => {
    state.mediaMode = event.target.value;
    renderMedia();
    bindWorkspaceControls();
    attachImageFallbacks();
  });
  elements.workspace.querySelector("#announcementStatus")?.addEventListener("change", (event) => {
    state.announcementStatus = event.target.value;
    renderAnnouncements();
    bindWorkspaceControls();
    attachImageFallbacks();
  });
  elements.workspace.querySelector("#addAnnouncement")?.addEventListener("click", () => showAnnouncementInspector());
  elements.workspace.querySelectorAll("[data-announcement-id]").forEach((button) => button.addEventListener("click", () => {
    showAnnouncementInspector(state.announcements.find((item) => item.id === button.dataset.announcementId));
  }));
  elements.workspace.querySelectorAll(".merge-button").forEach((button) => button.addEventListener("click", () => mergeProducts(button.dataset.keep, button.dataset.lose)));
  elements.workspace.querySelectorAll(".ignore-duplicate").forEach((button) => button.addEventListener("click", () => ignoreDuplicate(button.dataset.key)));
  elements.workspace.querySelectorAll(".undo-change").forEach((button) => button.addEventListener("click", () => undoDraft(Number(button.dataset.id))));
  elements.workspace.querySelectorAll(".revert-change").forEach((button) => button.addEventListener("click", () => revertPublishedChange(Number(button.dataset.id))));
  elements.workspace.querySelectorAll(".release-note-form").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await updateReleaseNote(Number(form.dataset.revision), new FormData(form).get("note"));
      toast(`r${form.dataset.revision} 的版本说明已更新`);
      await reloadBackend();
      state.section = "releases";
      render();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  }));
}

function attachImageFallbacks() {
  document.querySelectorAll("img").forEach((image) => {
    if (image.dataset.fallbackBound) return;
    image.dataset.fallbackBound = "1";
    image.addEventListener("error", () => {
      image.style.visibility = "hidden";
      image.parentElement?.classList.add("is-image-missing");
    }, { once: true });
  });
}

function switchSection(section) {
  if (!sectionMeta[section]) return;
  state.section = section;
  state.selectedProductId = "";
  state.selectedCategoryId = "";
  render();
}

async function undoDraft(id) {
  try {
    await undoChange(id);
    toast("变更已撤销");
    await reloadBackend();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function revertPublishedChange(id) {
  const change = (state.bootstrap?.history || []).find((item) => Number(item.id) === Number(id));
  if (!change || change.status !== "published") return;
  if (!await confirmAction("恢复修改前", "这不会改写旧版本，而是创建一条新的恢复草稿。预览确认后再发布。")) return;
  let patch = change.before_value || {};
  let entityType = change.entity_type;
  let operation = "edit";
  if (change.operation === "add" && entityType === "product") {
    patch = { data_status: "hidden" };
    operation = "hide";
  } else if (entityType === "merge") {
    patch = { target_id: change.before_value?.target_id || "" };
    operation = "merge";
  } else if (entityType === "review") {
    patch = { ignored: null, reviewed_at: null };
    operation = "ignore";
  } else if (entityType === "image_task" && !Object.keys(patch).length) {
    patch = { status: "cancelled" };
    operation = "repair";
  }
  try {
    await saveChange({
      entity_type: entityType,
      entity_id: change.entity_id,
      operation,
      patch,
      before_value: change.patch || {},
    });
    toast("已生成恢复草稿，请预览后发布");
    await reloadBackend();
    state.section = "changes";
    render();
  } catch (error) {
    toast(error.message, "error");
  }
}

function confirmAction(title, message) {
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmDialog.returnValue = "";
  elements.confirmDialog.showModal();
  return new Promise((resolve) => {
    elements.confirmDialog.addEventListener("close", () => resolve(elements.confirmDialog.returnValue === "confirm"), { once: true });
  });
}

function renderPublishSummary() {
  const drafts = state.bootstrap?.drafts || [];
  const count = (type) => drafts.filter((change) => change.entity_type === type).length;
  elements.publishSummary.innerHTML = `
    <div><strong>${drafts.length}</strong><span>全部变更</span></div>
    <div><strong>${count("product")}</strong><span>商品</span></div>
    <div><strong>${count("category")}</strong><span>分类</span></div>
    <div><strong>${count("merge") + count("image_task")}</strong><span>合并 / 图片</span></div>`;
}

async function handlePublish(event) {
  event.preventDefault();
  elements.publishConfirm.disabled = true;
  try {
    const release = await publishChanges(elements.publishNote.value.trim());
    elements.publishDialog.close();
    elements.publishNote.value = "";
    localStorage.removeItem("gunpula-cms-preview-v1");
    toast(`Revision ${release.revision} 已发布`);
    await reloadBackend();
    state.section = "releases";
    render();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    elements.publishConfirm.disabled = false;
  }
}

function previewApp() {
  localStorage.setItem("gunpula-cms-preview-v1", JSON.stringify({ revision: "draft", payload: state.cms, updated_at: new Date().toISOString() }));
  window.open("../app/?cms-preview=1", "_blank", "noopener");
  toast("已打开草稿预览，不会影响正式用户");
}

function bindStaticEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.mainNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-section]");
    if (button) switchSection(button.dataset.section);
  });
  elements.logoutButton.addEventListener("click", () => {
    logout();
    location.reload();
  });
  elements.undoLatest.addEventListener("click", () => {
    const latest = state.bootstrap?.drafts?.at(-1);
    if (latest) undoDraft(latest.id);
  });
  elements.previewButton.addEventListener("click", previewApp);
  elements.publishButton.addEventListener("click", () => {
    renderPublishSummary();
    elements.publishDialog.showModal();
  });
  elements.publishForm.addEventListener("submit", handlePublish);
  elements.globalSearch.addEventListener("input", (event) => {
    state.productFilters.query = event.target.value;
    state.productPage = 1;
    clearTimeout(bindStaticEvents.timer);
    bindStaticEvents.timer = setTimeout(() => {
      if (state.section !== "products") state.section = "products";
      render();
    }, 160);
  });
}

bindStaticEvents();
const auth = authState();
if (auth.signedIn || auth.localDevelopment) {
  startCms();
}
