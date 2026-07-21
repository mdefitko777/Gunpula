import { TRANSLATIONS } from "./i18n.js";
import { SYNC_BACKEND } from "./sync-config.js";
import {
  authBackend,
  authConfigured,
  configureAuth,
  currentUserEmail,
  getAccessToken,
  isSignedIn,
  requestEmailCode,
  signOut,
  verifyEmailCode,
} from "./auth.js";
import { isNativeShell, loadInitialKitsDoc as loadInitialCatalogSlice, loadJson, loadOptionalJson } from "./catalog-loader.js";
import { closeDialog, openDialog } from "./dialogs.js";
import { appendImageWithFallback as appendImageUrlsWithFallback, setImageFallbackChain as chainImageFallbacks } from "./image-utils.js";
import {
  clampCollectionQuantity as storeClampCollectionQuantity,
  mergeCollectionState as storeMergeCollectionState,
  mergeTimestampedMap as storeMergeTimestampedMap,
  newerByTimestamp as storeNewerByTimestamp,
  normalizeCollection as storeNormalizeCollection,
  normalizeCollectionEntry as storeNormalizeCollectionEntry,
  safeMemberName as storeSafeMemberName,
  timestampMs as storeTimestampMs,
} from "./collection-store.js";
import { escapeHtml as escapeHtmlValue } from "./dom-utils.js";
import {
  FRANCHISES,
  LANGUAGES,
  NAME_FALLBACKS,
  SETTINGS_PANELS,
  baseSeriesLabelFor as displayBaseSeriesLabelFor,
  cleanDisplayName,
  expandedSearchTerms,
  franchiseLabelFor,
  franchiseShortLabelFor,
  gradeLabelFor,
  gradeShortLabelFor,
  itemTypeKeyForCategory,
  itemTypeLabelFor,
  kitDisplayNameFor,
  kitDisplayNameForLanguage,
  kitSeriesKey,
  kitSeriesSort,
  kitShortNameFor,
  numericFilterValue,
  seriesLabelForSeries as displaySeriesLabelForSeries,
} from "./catalog-display.js";
import {
  defaultReleaseMonth as feedDefaultReleaseMonth,
  effectiveKitDate as feedEffectiveKitDate,
  itemIsPremiumBandai,
  kitIsPremiumBandai as feedKitIsPremiumBandai,
  localDateKey,
  recentFeedKits as feedRecentFeedKits,
  recentUpdateItems as feedRecentUpdateItems,
  releaseItemsForMonth as feedReleaseItemsForMonth,
  releaseMonthForKit as feedReleaseMonthForKit,
  releaseMonthStats as feedReleaseMonthStats,
  updateEntryItems as feedUpdateEntryItems,
  updateEntryPremiumBandaiTotal as feedUpdateEntryPremiumBandaiTotal,
  updateEntryPreviewItems as feedUpdateEntryPreviewItems,
  updateEntryTotal as feedUpdateEntryTotal,
  updateFeedEntries as feedUpdateFeedEntries,
  updateFeedStats as feedUpdateFeedStats,
  validReleaseMonth,
  weekOnSaleKits as feedWeekOnSaleKits,
} from "./update-feed.js";
import {
  pbandaiFranchiseForItem,
  pbandaiFranchises as readPBandaiFranchises,
  pbandaiItems as readPBandaiItems,
  pbandaiItemsForFranchise as readPBandaiItemsForFranchise,
  safePBandaiImageUrl,
} from "./pbandai-store.js";
import {
  formatKrw as formatKrwValue,
  formatMarketDate as formatMarketDateValue,
  marketListingsForKit as readMarketListingsForKit,
  marketRecordForKit as readMarketRecordForKit,
  marketSearchLinksForKit as buildMarketSearchLinksForKit,
  marketSourceStatusClass,
  marketSources as readMarketSources,
} from "./market-data.js";
import { ingestSearchIndex as ingestSearchIndexState } from "./search-index-store.js";
import { getJson, getString, removeValue, setJson, setString } from "./storage.js";
import {
  loadSavedViewState as readSavedViewState,
  normalizeFilterStateValue as normalizeViewFilterStateValue,
  preferredLanguage as readPreferredLanguage,
  viewStateUrl as buildViewStateUrl,
} from "./view-state.js";

const LANGUAGE_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const OVERRIDE_KEY = "gunpula-catalog-overrides-v1";
const SERIES_LABEL_OVERRIDE_KEY = "gunpula-catalog-series-labels-v1";
const VIEW_STATE_KEY = "gunpula-catalog-view-state-v1";
const CONSOLE_MODE_KEY = "gunpula-catalog-console-mode-v1";
const COLLECTION_KEY = "gunpula-catalog-collection-v1";
const SYNC_CONFIG_KEY = "gunpula-catalog-sync-config-v1";
const SYNC_META_KEY = "gunpula-catalog-sync-meta-v1";
const SYNC_HISTORY_KEY = "gunpula-catalog-sync-history-v1";
const ACTIVE_VIEW_KEY = "gunpula-catalog-active-view-v1";
const GITHUB_TOKEN_KEY = "gunpula-github-dispatch-token-v1";
const COLLECTION_HOME_VISIBILITY_KEY = "gunpula-catalog-home-collection-visibility-v1";
const COLLECTION_HOME_COLLAPSE_KEY = "gunpula-catalog-home-collection-collapse-v1";
const COLLECTION_MEMBER_VIEW_KEY = "gunpula-catalog-collection-member-view-v1";
const COLLECTION_FILTER_KEY = "gunpula-catalog-collection-filter-v1";
const UPDATE_NOTIFICATION_KEY = "gunpula-catalog-update-notifications-v1";
const UPDATE_NOTIFICATION_LAST_KEY = "gunpula-catalog-update-notified-v1";
const UPDATE_NOTIFICATION_FILTER_KEY = "gunpula-catalog-update-notification-filters-v1";
const THEME_KEY = "gunpula-catalog-theme-v1";
const APP_ICON_KEY = "gunpula-catalog-app-icon-v1";
const HOME_COVER_KEY = "gunpula-catalog-home-covers-v1";
const RELEASE_MONTH_KEY = "gunpula-catalog-release-month-v1";
const SETTINGS_PANEL_KEY = "gunpula-catalog-settings-panel-v1";
const RECENT_VIEWED_KEY = "gunpula-catalog-recent-viewed-v1";
const ONBOARDING_DONE_KEY = "gunpula-catalog-onboarding-done-v1";
const SYNC_POLL_INTERVAL_MS = 15000;
const SYNC_SAVE_DEBOUNCE_MS = 700;
const SYNC_HISTORY_LIMIT = 20;
const KIT_RENDER_BATCH = 160;
const RECENT_UPDATE_DAYS = 3;
const UPDATES_MODE_KEY = "gunpula-updates-mode-v1";
const RADIAL_HOLD_MS = 850;
const RADIAL_SCROLL_CANCEL_DISTANCE = 10;
const RADIAL_CANCEL_DISTANCE = 18;
const RADIAL_SELECT_DISTANCE = 28;
const PAGER_START_DISTANCE = 18;
const DRAWER_EDGE_ZONE = 96;
const DRAWER_OPEN_DISTANCE = 44;
const COLLECTION_SWIPE_DISTANCE = 46;
const SWIPE_ZONE_TOP_RATIO = 0.42;
const PAGER_THRESHOLD_RATIO = 0.28;
const PAGER_MIN_THRESHOLD = 92;
const PAGER_ANIMATION_MS = 220;
const APP_VERSION_LABEL = "v2.0.0";
const WORLD_COPY = {
  gundam: {
    title: { zh: "高达宇宙档案", ko: "건담 유니버스", en: "Gundam Universe", ja: "ガンダム宇宙" },
    lead: { zh: "按宇宙纪年、作品和产品线去逛，不再只是一张商品表。", ko: "연표, 작품, 제품 라인으로 탐색합니다.", en: "Browse by timeline, work, and product line instead of a flat list.", ja: "年表、作品、商品ラインで辿る図鑑です。" },
    mode: "timeline",
    guideTab: "timeline",
  },
  armored_core: {
    title: { zh: "AC 机库", ko: "AC 격납고", en: "AC Hangar", ja: "AC ハンガー" },
    lead: { zh: "按游戏世代看机体、V.I.、30MM 和周边。", ko: "게임 세대별로 기체와 프라모델을 봅니다.", en: "Browse machines, V.I., 30MM, and goods by game era.", ja: "ゲーム世代ごとに機体と商品を閲覧します。" },
    mode: "atlas",
    guideTab: "armored_core",
  },
  pokemon: {
    title: { zh: "宝可梦世代图鉴", ko: "포켓몬 세대 도감", en: "Pokemon Generations", ja: "ポケモン世代図鑑" },
    lead: { zh: "用世代和地区进入，像翻游戏图鉴一样找拼装、扭蛋和玩偶。", ko: "세대와 지방으로 프라모델, 가샤폰, 인형을 찾습니다.", en: "Enter by generation and region, then browse model kits, gashapon, and plush.", ja: "世代と地方からプラモ、ガシャポン、ぬいぐるみを探します。" },
    mode: "atlas",
    guideTab: "pokemon",
  },
  fate: {
    title: { zh: "Fate / FGO 长卷", ko: "Fate / FGO 타임라인", en: "Fate / FGO Chronicle", ja: "Fate / FGO クロニクル" },
    lead: { zh: "FGO 已经是一条十年以上的长线，按作品和章节去看角色周边。", ko: "작품과 장별로 캐릭터 굿즈를 봅니다.", en: "Follow works and FGO chapters as a long collectible timeline.", ja: "作品とFGO章ごとにグッズを辿ります。" },
    mode: "timeline",
    guideTab: "fate",
  },
  beyblade: {
    title: { zh: "Beyblade X 装备台", ko: "BBX 덱 스테이션", en: "Beyblade X Deck", ja: "ベイブレードX デッキ" },
    lead: { zh: "按 BX / UX / CX / 限定和部件拆开看，适合补齐和配装。", ko: "BX / UX / CX / 한정과 부품별로 봅니다.", en: "Browse by BX, UX, CX, limited items, and parts.", ja: "BX / UX / CX / 限定とパーツで整理します。" },
    mode: "bbx",
    guideTab: "bbx",
  },
};

const WORLD_ACTIONS = [
  { key: "catalog", label: { zh: "目录", ko: "카탈로그", en: "Catalog", ja: "カタログ" }, view: "catalog" },
  { key: "guide", label: { zh: "图鉴", ko: "도감", en: "Atlas", ja: "図鑑" }, view: "guide" },
  { key: "updates", label: { zh: "最近", ko: "최근", en: "Updates", ja: "最近" }, view: "updates" },
  { key: "collection", label: { zh: "收藏", ko: "컬렉션", en: "Collection", ja: "コレクション" }, view: "collection" },
];
const HELP_TEXT = {
  homeSection: {
    zh: "首页是入口页。点分类卡片进入对应目录；点“我的收藏”里的已购买/想要会进入自己的收藏，不会跟随朋友视图变化；封面图可在卡片上更换。",
    ko: "홈은 시작 화면입니다. 분류 카드를 누르면 해당 카탈로그로 이동합니다. 내 컬렉션은 항상 내 계정 기준으로 표시되며 친구 보기와 섞이지 않습니다.",
    en: "Home is the entry page. Tap a franchise card to browse it. My collection always uses your own account, not the currently viewed friend.",
    ja: "ホームは入口です。分類カードで各カタログへ移動します。マイコレクションは常に自分のアカウント基準で表示されます。",
  },
  updatesSection: {
    zh: "最近更新按发售日和新收录查看。你在个人喜好里选择的分类/系列会排在前面；顶部小字会提示关注系列最近新增多少。",
    ko: "최근 업데이트는 발매일과 신규 등록 기준으로 봅니다. 내 취향에서 선택한 분류와 시리즈가 먼저 표시됩니다.",
    en: "Recent updates are sorted by release/addition date. Favorite franchises and series float to the top.",
    ja: "最近更新は発売日/追加日で確認します。お気に入りの分類とシリーズが優先表示されます。",
  },
  pbandaiSection: "这里显示 Premium Bandai JP 的缓存数据。网页不会直接爬 PB，更新来自后台抓取后的 JSON。",
  collectionSection: "已购买和想要按当前成员显示，可在详情页标记，也可以在这里批量删除。",
  kitSection: {
    zh: "目录用于找商品。搜索会匹配多语言名称、系列和产品线；你关注的系列会优先显示，筛选只影响当前列表。",
    ko: "카탈로그는 상품을 찾는 곳입니다. 검색은 여러 언어 이름, 시리즈, 라인을 함께 찾고 관심 시리즈를 먼저 보여줍니다.",
    en: "Catalog is for finding products. Search matches multilingual names, series, and product lines; favorites are shown first.",
    ja: "カタログは商品検索用です。多言語名・シリーズ・ラインを検索し、お気に入りが優先表示されます。",
  },
  settingsDialog: {
    zh: "设置分为账号、外观、数据、更新、关于和控制台。普通用户只需要账号/外观/更新；数据修正和抓取都在控制台。",
    ko: "설정은 계정, 외관, 데이터, 업데이트, 정보, 콘솔로 나뉩니다. 일반 사용은 계정/외관/업데이트만 보면 됩니다.",
    en: "Settings are split into Account, Appearance, Data, Updates, About, and Console. Normal use mainly needs Account, Appearance, and Updates.",
    ja: "設定はアカウント、外観、データ、更新、情報、コンソールに分かれています。通常はアカウント/外観/更新を使います。",
  },
  guideDialog: {
    zh: "图鉴先按高达作品系列显示大图和点亮数。点系列进入机体列表；已点亮会排前面，点机体可查看关联商品或手动点亮。",
    ko: "도감은 먼저 작품 시리즈 큰 이미지와 점등 수를 보여줍니다. 시리즈를 누르면 기체 목록이 열리고 점등된 항목이 먼저 나옵니다.",
    en: "Picture Book first shows series cards with lit counts. Open a series to see units; lit units appear first.",
    ja: "図鑑は作品シリーズカードと点灯数を先に表示します。シリーズを開くと機体一覧が出て、点灯済みが先に並びます。",
  },
  userDialog: {
    zh: "个人页用来看自己和共享成员。点头像/名字进入个人详情；喜好、好友、设置都会以小窗口打开，返回键会逐层关闭。",
    ko: "개인 페이지에서는 나와 공유 멤버를 봅니다. 아바타나 이름을 누르면 상세 프로필이 열리고, 취향/친구/설정은 작은 창으로 열립니다.",
    en: "The user page shows you and shared members. Tap the avatar/name for profile details; favorites, friends, and settings open as small layered panels.",
    ja: "個人ページでは自分と共有メンバーを確認できます。アイコン/名前で詳細プロフィールへ進み、好み・友達・設定は小ウィンドウで開きます。",
  },
  memberDialog: {
    zh: "个人详情显示头像、背景、喜好、图鉴点亮、已购买和想要。点头像/背景/名字/标签会弹出操作菜单；好友页只能查看。",
    ko: "상세 프로필은 아바타, 배경, 취향, 도감 점등, 구매함/원함을 보여줍니다. 아바타/배경/이름/태그를 누르면 메뉴가 열립니다.",
    en: "Profile details show avatar, cover, favorites, lit guide series, owned, and wanted items. Tap avatar/cover/name/tags for actions; friend profiles are view-only.",
    ja: "プロフィール詳細にはアイコン、背景、好み、図鑑点灯、購入済み/欲しい物を表示します。アイコン/背景/名前/タグで操作メニューが開きます。",
  },
  language: "切换界面语言，不会改动商品数据。",
  appearance: "设置主题、App 图标和首页收藏显示方式。",
  homeDisplay: "控制首页收藏区、首页封面和入口展示方式；这些属于外观，不影响收藏数据。",
  accountSync: "用邮箱验证码登录后，可以创建共享空间或输入邀请码加入对方空间。",
  dataBackup: "迁移或换手机前先导出备份；恢复会覆盖当前本地收藏和更正。",
  appUpdate: "检查更新会清理程序缓存并重新加载最新版，不会删除收藏。",
  aboutApp: "查看当前版本、APK 状态和安装信息。",
  recentUpdates: "按发售日期查看新品；个人喜好里的分类和系列会优先排在前面。",
  premiumBandaiProducts: "PB 商品只展示后台缓存，点卡片先看详情，官方链接在详情页打开。",
  catalogList: "目录优先显示关注系列，仍可用搜索、筛选和分类入口精确缩小范围。",
  ownedList: "已购买按成员独立记录，可以查看自己或朋友的收藏。",
  wantedList: "想要按成员独立记录，数量可在详情页调整。",
  myFavorites: "选择你关注的分类和系列，它会影响首页、最近更新、目录和图鉴排序。",
  workspaceFriends: "共享空间成员可以互相查看收藏、想要和图鉴点亮进度。",
  appHealth: "这里是维护视角的问题列表，普通使用时不用看。",
  updateLog: "后台更新记录，用来确认每天抓取新增、变更和删除了什么。",
  reviewWorkbench: "待确认工作台放归类、图片、数据质量问题，适合集中手动处理。",
  imageHealth: "图片健康检查显示缺图和失效图，方便决定哪些要本地化。",
  sourceHealth: "来源健康显示官网抓取是否正常、被拦截或数量异常。",
  imageAssetLibrary: "图片资产库统计本地缓存图和远程图比例。",
  duplicateWorkbench: "疑似重复可合并、隐藏或标记不是重复，改动会进入共享更正。",
  dataFetch: "触发 GitHub Actions 后台抓取目录、PB、市场价和更新数据。",
  seriesAdmin: "在这里改系列名，只改显示名称，不改商品本身来源。",
};

const COLLECTION_TYPES = ["owned", "wanted"];
const COLLECTION_ENTRY_STATUSES = [...COLLECTION_TYPES, "deleted"];

// Workspace data cleanup: the "냐아" bucket is abandoned and unwanted, and items
// recorded under the pre-sign-in placeholder "member" belong to ttungyimungyi.
// (The fold is skipped while actually signed out, when "member" is the live self bucket.)
const DROPPED_COLLECTION_MEMBERS = new Set(["냐아"]);
const COLLECTION_MEMBER_MERGES = { member: "ttungyimungyi" };
const THEMES = [
  { code: "atlas", label: { zh: "默认", ko: "기본", en: "Default", ja: "デフォルト" } },
  { code: "classic", label: { zh: "经典", ko: "클래식", en: "Classic", ja: "クラシック" } },
];
const CORRECTION_FIELD_KEYS = ["name_zh", "name_ko", "name_en", "name_ja", "grade_code", "subline", "series_key", "universe", "cover_image_url"];

const DEFAULT_NOTIFICATION_FILTERS = {
  premium_bandai: true,
  seed_00: true,
  bbx: true,
  gundam: false,
  armored_core: false,
  pokemon: false,
  fate: false,
};

const INITIAL_VIEW_STATE = loadSavedViewState();

const state = {
  rawKits: [],
  kits: [],
  grades: [],
  sources: [],
  imageHealth: null,
  updateFeed: null,
  pbandai: null,
  sourceHealth: null,
  seriesAudit: null,
  marketPrices: null,
  searchIndex: null,
  searchIndexByKit: new Map(),
  loadedSearchFranchises: new Set(),
  imageAssets: null,
  androidPackage: null,
  atlasGroups: null,
  overrides: {},
  seriesLabelOverrides: {},
  collection: { owned: [], wanted: [] },
  homeCollectionVisibility: loadHomeCollectionVisibility(),
  homeCollectionCollapsed: loadHomeCollectionCollapsed(),
  collectionMemberView: localStorage.getItem(COLLECTION_MEMBER_VIEW_KEY) || "self",
  lastCollectionTab: COLLECTION_TYPES.includes(INITIAL_VIEW_STATE.view || localStorage.getItem(ACTIVE_VIEW_KEY))
    ? INITIAL_VIEW_STATE.view || localStorage.getItem(ACTIVE_VIEW_KEY)
    : "wanted",
  collectionFilter: loadCollectionFilter(),
  updateNotifications: localStorage.getItem(UPDATE_NOTIFICATION_KEY) === "true",
  updateNotificationFilters: loadUpdateNotificationFilters(),
  collectionSelection: { owned: new Set(), wanted: new Set() },
  theme: loadTheme(),
  appIcon: loadAppIcon(),
  homeCovers: loadHomeCovers(),
  recentViewed: loadRecentViewed(),
  releaseMonth: localStorage.getItem(RELEASE_MONTH_KEY) || "",
  updatesMode: localStorage.getItem(UPDATES_MODE_KEY) === "month" ? "month" : "recent",
  radial: { timer: null, active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, touchId: null, selected: null, target: null, suppressClick: false },
  pager: { active: false, touchId: null, startX: 0, startY: 0, deltaX: 0, target: null, settling: false, suppressClick: false, blockedByTarget: false },
  syncConfig: loadSyncConfig(),
  syncMeta: loadSyncMeta(),
  syncHistory: loadSyncHistory(),
  sync: {
    enabled: false,
    canEdit: true,
    status: "local",
    message: "",
    timer: null,
    saveTimer: null,
    inFlight: false,
    lastPulledAt: null,
    suppress: false,
    workspace: null,
  },
  activeView: INITIAL_VIEW_STATE.view || localStorage.getItem(ACTIVE_VIEW_KEY) || "home",
  settingsPanel: SETTINGS_PANELS.includes(localStorage.getItem(SETTINGS_PANEL_KEY)) ? localStorage.getItem(SETTINGS_PANEL_KEY) : "home",
  activeModal: INITIAL_VIEW_STATE.modal || null,
  activeMemberProfile: null,
  guideUnitBack: null,
  guideSeriesFilters: loadGuideSeriesFilters(),
  returnToUserDrawer: false,
  installPrompt: null,
  updatedAt: null,
  query: INITIAL_VIEW_STATE.query || "",
  franchise: INITIAL_VIEW_STATE.franchise || localStorage.getItem(FRANCHISE_KEY) || "gundam",
  language: INITIAL_VIEW_STATE.language || localStorage.getItem(LANGUAGE_KEY) || "zh",
  grade: INITIAL_VIEW_STATE.grade || "all",
  series: INITIAL_VIEW_STATE.series || "all",
  itemType: INITIAL_VIEW_STATE.itemType || "all",
  releaseYear: INITIAL_VIEW_STATE.releaseYear || "all",
  limited: INITIAL_VIEW_STATE.limited || "all",
  priceMin: INITIAL_VIEW_STATE.priceMin || "",
  priceMax: INITIAL_VIEW_STATE.priceMax || "",
  pendingKitId: INITIAL_VIEW_STATE.kit || null,
  seriesAdminKey: null,
  seriesAdminLanguage: INITIAL_VIEW_STATE.language || localStorage.getItem(LANGUAGE_KEY) || "zh",
  consoleMode: loadConsoleMode(),
  selectedKit: null,
  selectedImageIndex: 0,
  pendingHomeCoverFranchise: null,
  renderLimit: KIT_RENDER_BATCH,
  renderSignature: "",
  swipeStartX: null,
  swipeStartY: null,
};

upgradeLegacyFilterDom();

const elements = {
  brandMark: document.querySelector("#brandMark"),
  brandVersion: document.querySelector("#brandVersion"),
  datasetSummary: document.querySelector("#datasetSummary"),
  sectionTitle: document.querySelector("#sectionTitle"),
  bottomNav: document.querySelector("#bottomNav"),
  settingsOpen: document.querySelector("#settingsOpen"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsClose: document.querySelector("#settingsClose"),
  settingsTabs: document.querySelector("#settingsTabs"),
  settingsBack: document.querySelector("#settingsBack"),
  settingsTitle: document.querySelector("#settingsTitle"),
  themeList: document.querySelector("#themeList"),
  appIconInput: document.querySelector("#appIconInput"),
  resetAppIcon: document.querySelector("#resetAppIcon"),
  consoleModeToggle: document.querySelector("#consoleModeToggle"),
  showOwnedOnHome: document.querySelector("#showOwnedOnHome"),
  showWantedOnHome: document.querySelector("#showWantedOnHome"),
  syncState: document.querySelector("#syncState"),
  syncStatusText: document.querySelector("#syncStatusText"),
  accountSignedOut: document.querySelector("#accountSignedOut"),
  accountSignedIn: document.querySelector("#accountSignedIn"),
  accountEmail: document.querySelector("#accountEmail"),
  accountSendCode: document.querySelector("#accountSendCode"),
  accountCodeRow: document.querySelector("#accountCodeRow"),
  accountCode: document.querySelector("#accountCode"),
  accountVerify: document.querySelector("#accountVerify"),
  accountHint: document.querySelector("#accountHint"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountEmailLabel: document.querySelector("#accountEmailLabel"),
  accountSignOut: document.querySelector("#accountSignOut"),
  memberNameRow: document.querySelector("#memberNameRow"),
  memberDisplayNameInput: document.querySelector("#memberDisplayNameInput"),
  saveMemberDisplayName: document.querySelector("#saveMemberDisplayName"),
  workspaceNone: document.querySelector("#workspaceNone"),
  workspaceCreate: document.querySelector("#workspaceCreate"),
  workspaceInviteInput: document.querySelector("#workspaceInviteInput"),
  workspaceJoin: document.querySelector("#workspaceJoin"),
  workspacePanel: document.querySelector("#workspacePanel"),
  workspaceNameLabel: document.querySelector("#workspaceNameLabel"),
  workspaceInviteWrap: document.querySelector("#workspaceInviteWrap"),
  workspaceInviteCode: document.querySelector("#workspaceInviteCode"),
  workspaceCopyInvite: document.querySelector("#workspaceCopyInvite"),
  workspaceMembers: document.querySelector("#workspaceMembers"),
  workspaceLeave: document.querySelector("#workspaceLeave"),
  workspaceHint: document.querySelector("#workspaceHint"),
  migrateV1: document.querySelector("#migrateV1"),
  migrateV1Hint: document.querySelector("#migrateV1Hint"),
  exportBackup: document.querySelector("#exportBackup"),
  importBackupButton: document.querySelector("#importBackupButton"),
  importBackupInput: document.querySelector("#importBackupInput"),
  backupStatus: document.querySelector("#backupStatus"),
  syncSupabaseUrl: document.querySelector("#syncSupabaseUrl"),
  syncAnonKey: document.querySelector("#syncAnonKey"),
  syncWorkspaceId: document.querySelector("#syncWorkspaceId"),
  syncWorkspaceSecret: document.querySelector("#syncWorkspaceSecret"),
  syncEditorSecret: document.querySelector("#syncEditorSecret"),
  syncMemberName: document.querySelector("#syncMemberName"),
  saveSyncConfig: document.querySelector("#saveSyncConfig"),
  syncNow: document.querySelector("#syncNow"),
  disconnectSync: document.querySelector("#disconnectSync"),
  syncHint: document.querySelector("#syncHint"),
  installApp: document.querySelector("#installApp"),
  refreshAppCache: document.querySelector("#refreshAppCache"),
  refreshAppStatus: document.querySelector("#refreshAppStatus"),
  updateNotificationToggle: document.querySelector("#updateNotificationToggle"),
  updateNotificationStatus: document.querySelector("#updateNotificationStatus"),
  notificationRules: document.querySelector("#notificationRules"),
  issueSyncStatus: document.querySelector("#issueSyncStatus"),
  updateLog: document.querySelector("#updateLog"),
  imageHealthLog: document.querySelector("#imageHealthLog"),
  sourceHealthLog: document.querySelector("#sourceHealthLog"),
  reviewWorkbench: document.querySelector("#reviewWorkbench"),
  duplicateSummary: document.querySelector("#duplicateSummary"),
  duplicateWorkbench: document.querySelector("#duplicateWorkbench"),
  hiddenRecords: document.querySelector("#hiddenRecords"),
  updatesSection: document.querySelector("#updatesSection"),
  updatesSubtitle: document.querySelector("#updatesSubtitle"),
  updatesOpenSettings: document.querySelector("#updatesOpenSettings"),
  updatesDateInput: document.querySelector("#updatesDateInput"),
  updatesRecentButton: document.querySelector("#updatesRecentButton"),
  updatesWeekButton: document.querySelector("#updatesWeekButton"),
  avatarInput: document.querySelector("#avatarInput"),
  profileFavorites: document.querySelector("#profileFavorites"),
  favoriteFranchises: document.querySelector("#favoriteFranchises"),
  favoriteSeries: document.querySelector("#favoriteSeries"),
  userChip: document.querySelector("#userChip"),
  userDialog: document.querySelector("#userDialog"),
  userDialogClose: document.querySelector("#userDialogClose"),
  userDialogHead: document.querySelector("#userDialogHead"),
  userDialogCover: document.querySelector("#userDialogCover"),
  userDialogAvatar: document.querySelector("#userDialogAvatar"),
  userDialogName: document.querySelector("#userDialogName"),
  userDialogMeta: document.querySelector("#userDialogMeta"),
  userRowOwned: document.querySelector("#userRowOwned"),
  userRowWanted: document.querySelector("#userRowWanted"),
  userOwnedCount: document.querySelector("#userOwnedCount"),
  userWantedCount: document.querySelector("#userWantedCount"),
  userInviteLine: document.querySelector("#userInviteLine"),
  userInviteCode: document.querySelector("#userInviteCode"),
  userCopyInvite: document.querySelector("#userCopyInvite"),
  userMembers: document.querySelector("#userMembers"),
  userRowSettings: document.querySelector("#userRowSettings"),
  userRowSignOut: document.querySelector("#userRowSignOut"),
  userRowGuide: document.querySelector("#userRowGuide"),
  userGuideValue: document.querySelector("#userGuideValue"),
  userPanelDialog: document.querySelector("#userPanelDialog"),
  userPanelClose: document.querySelector("#userPanelClose"),
  userPanelTitle: document.querySelector("#userPanelTitle"),
  userPanelBody: document.querySelector("#userPanelBody"),
  guideDialog: document.querySelector("#guideDialog"),
  guideClose: document.querySelector("#guideClose"),
  guideColorToggle: document.querySelector("#guideColorToggle"),
  guideUserChip: document.querySelector("#guideUserChip"),
  guideUserAvatar: document.querySelector("#guideUserAvatar"),
  guideUserName: document.querySelector("#guideUserName"),
  guideTabs: document.querySelector("#guideTabs"),
  guideSummary: document.querySelector("#guideSummary"),
  guideBody: document.querySelector("#guideBody"),
  bbxTopDialog: document.querySelector("#bbxTopDialog"),
  bbxTopClose: document.querySelector("#bbxTopClose"),
  bbxTopArt: document.querySelector("#bbxTopArt"),
  bbxTopName: document.querySelector("#bbxTopName"),
  bbxTopMeta: document.querySelector("#bbxTopMeta"),
  bbxTopParts: document.querySelector("#bbxTopParts"),
  bbxTopRecommend: document.querySelector("#bbxTopRecommend"),
  bbxTopKits: document.querySelector("#bbxTopKits"),
  bbxPartDialog: document.querySelector("#bbxPartDialog"),
  bbxPartClose: document.querySelector("#bbxPartClose"),
  bbxPartArt: document.querySelector("#bbxPartArt"),
  bbxPartName: document.querySelector("#bbxPartName"),
  bbxPartMeta: document.querySelector("#bbxPartMeta"),
  bbxPartStats: document.querySelector("#bbxPartStats"),
  bbxPartTops: document.querySelector("#bbxPartTops"),
  guideUnitDialog: document.querySelector("#guideUnitDialog"),
  guideUnitClose: document.querySelector("#guideUnitClose"),
  guideUnitArt: document.querySelector("#guideUnitArt"),
  guideUnitName: document.querySelector("#guideUnitName"),
  guideUnitMeta: document.querySelector("#guideUnitMeta"),
  guideUnitVariants: document.querySelector("#guideUnitVariants"),
  guideUnitKits: document.querySelector("#guideUnitKits"),
  memberDialog: document.querySelector("#memberDialog"),
  memberDialogClose: document.querySelector("#memberDialogClose"),
  memberDialogHead: document.querySelector("#memberDialogHead"),
  memberDialogCover: document.querySelector("#memberDialogCover"),
  memberDialogAvatar: document.querySelector("#memberDialogAvatar"),
  memberDialogName: document.querySelector("#memberDialogName"),
  memberDialogMeta: document.querySelector("#memberDialogMeta"),
  memberEditPanel: document.querySelector("#memberEditPanel"),
  memberDialogNameInput: document.querySelector("#memberDialogNameInput"),
  memberDialogSaveName: document.querySelector("#memberDialogSaveName"),
  memberDialogChangeAvatar: document.querySelector("#memberDialogChangeAvatar"),
  memberDialogChangeBackground: document.querySelector("#memberDialogChangeBackground"),
  profileBackgroundInput: document.querySelector("#profileBackgroundInput"),
  memberDialogFavorites: document.querySelector("#memberDialogFavorites"),
  memberDialogStats: document.querySelector("#memberDialogStats"),
  memberGuideTitle: document.querySelector("#memberGuideTitle"),
  memberGuideManage: document.querySelector("#memberGuideManage"),
  memberGuideSeries: document.querySelector("#memberGuideSeries"),
  memberDialogOwned: document.querySelector("#memberDialogOwned"),
  memberDialogWanted: document.querySelector("#memberDialogWanted"),
  memberActionDialog: document.querySelector("#memberActionDialog"),
  memberActionViewBackground: document.querySelector("#memberActionViewBackground"),
  memberActionViewAvatar: document.querySelector("#memberActionViewAvatar"),
  memberActionChangeBackground: document.querySelector("#memberActionChangeBackground"),
  memberActionChangeAvatar: document.querySelector("#memberActionChangeAvatar"),
  memberActionRename: document.querySelector("#memberActionRename"),
  memberActionTags: document.querySelector("#memberActionTags"),
  memberActionCancel: document.querySelector("#memberActionCancel"),
  profileImageDialog: document.querySelector("#profileImageDialog"),
  profileImageClose: document.querySelector("#profileImageClose"),
  profileImageTitle: document.querySelector("#profileImageTitle"),
  profileImagePreview: document.querySelector("#profileImagePreview"),
  homeUpdateSummary: document.querySelector("#homeUpdateSummary"),
  sourceHealthStrip: document.querySelector("#sourceHealthStrip"),
  homeUpdateList: document.querySelector("#homeUpdateList"),
  homeSection: document.querySelector("#homeSection"),
  homeCoverInput: document.querySelector("#homeCoverInput"),
  worldSection: document.querySelector("#worldSection"),
  homeGrid: document.querySelector("#homeGrid"),
  homeTotal: document.querySelector("#homeTotal"),
  homeCollectionTotal: document.querySelector("#homeCollectionTotal"),
  homeCollectionOverview: document.querySelector("#homeCollectionOverview"),
  homeRecentViewed: document.querySelector("#homeRecentViewed"),
  pbandaiSection: document.querySelector("#pbandaiSection"),
  pbandaiSubtitle: document.querySelector("#pbandaiSubtitle"),
  pbandaiFranchiseTabs: document.querySelector("#pbandaiFranchiseTabs"),
  pbandaiList: document.querySelector("#pbandaiList"),
  marketSection: document.querySelector("#marketSection"),
  marketSubtitle: document.querySelector("#marketSubtitle"),
  marketSummary: document.querySelector("#marketSummary"),
  marketSourceGrid: document.querySelector("#marketSourceGrid"),
  keywordPreview: document.querySelector("#keywordPreview"),
  imageAssetSummary: document.querySelector("#imageAssetSummary"),
  androidPackageSummary: document.querySelector("#androidPackageSummary"),
  appVersionLabel: document.querySelector("#appVersionLabel"),
  onboardingDialog: document.querySelector("#onboardingDialog"),
  onboardingLanguageList: document.querySelector("#onboardingLanguageList"),
  onboardingOpenAccount: document.querySelector("#onboardingOpenAccount"),
  onboardingImport: document.querySelector("#onboardingImport"),
  onboardingDone: document.querySelector("#onboardingDone"),
  collectionSection: document.querySelector("#collectionSection"),
  ownedPanel: document.querySelector("#ownedPanel"),
  wantedPanel: document.querySelector("#wantedPanel"),
  ownedCount: document.querySelector("#ownedCount"),
  wantedCount: document.querySelector("#wantedCount"),
  ownedCollapse: document.querySelector("#ownedCollapse"),
  wantedCollapse: document.querySelector("#wantedCollapse"),
  ownedStrip: document.querySelector("#ownedStrip"),
  wantedStrip: document.querySelector("#wantedStrip"),
  collectionManagement: document.querySelector("#collectionManagement"),
  collectionHub: document.querySelector("#collectionHub"),
  collectionTypeTabs: document.querySelector("#collectionTypeTabs"),
  collectionMemberRow: document.querySelector("#collectionMemberRow"),
  collectionFilterButton: document.querySelector("#collectionFilterButton"),
  collectionFilterSheet: document.querySelector("#collectionFilterSheet"),
  collectionGroupSummary: document.querySelector("#collectionGroupSummary"),
  collectionSelectAll: document.querySelector("#collectionSelectAll"),
  collectionSelectionSummary: document.querySelector("#collectionSelectionSummary"),
  deleteSelectedCollection: document.querySelector("#deleteSelectedCollection"),
  clearCollectionView: document.querySelector("#clearCollectionView"),
  searchInput: document.querySelector("#searchInput"),
  filterSummary: document.querySelector("#filterSummary"),
  franchiseList: document.querySelector("#franchiseList"),
  languageList: document.querySelector("#languageList"),
  seriesTabs: document.querySelector("#seriesTabs"),
  filterBody: document.querySelector("#filterBody"),
  gradeFilter: document.querySelector("#gradeFilter"),
  seriesFilter: document.querySelector("#seriesFilter"),
  itemTypeFilter: document.querySelector("#itemTypeFilter"),
  releaseYearFilter: document.querySelector("#releaseYearFilter"),
  limitedFilter: document.querySelector("#limitedFilter"),
  priceMinInput: document.querySelector("#priceMinInput"),
  priceMaxInput: document.querySelector("#priceMaxInput"),
  clearFilters: document.querySelector("#clearFilters"),
  resultCount: document.querySelector("#resultCount"),
  kitGrid: document.querySelector("#kitGrid"),
  cardTemplate: document.querySelector("#kitCardTemplate"),
  detailDialog: document.querySelector("#detailDialog"),
  detailClose: document.querySelector("#detailClose"),
  detailMainImage: document.querySelector("#detailMainImage"),
  galleryPrev: document.querySelector("#galleryPrev"),
  galleryNext: document.querySelector("#galleryNext"),
  detailThumbs: document.querySelector("#detailThumbs"),
  detailKicker: document.querySelector("#detailKicker"),
  detailTitle: document.querySelector("#detailTitle"),
  detailSubtitle: document.querySelector("#detailSubtitle"),
  toggleOwned: document.querySelector("#toggleOwned"),
  toggleWanted: document.querySelector("#toggleWanted"),
  wantedQuantityControl: document.querySelector("#wantedQuantityControl"),
  wantedQuantityInput: document.querySelector("#wantedQuantityInput"),
  wantedQuantityMinus: document.querySelector("#wantedQuantityMinus"),
  wantedQuantityPlus: document.querySelector("#wantedQuantityPlus"),
  collectionDetailPanel: document.querySelector("#collectionDetailPanel"),
  collectionQuantityInput: document.querySelector("#collectionQuantityInput"),
  purchasePriceInput: document.querySelector("#purchasePriceInput"),
  storageLocationInput: document.querySelector("#storageLocationInput"),
  collectionNoteInput: document.querySelector("#collectionNoteInput"),
  saveCollectionDetails: document.querySelector("#saveCollectionDetails"),
  detailMeta: document.querySelector("#detailMeta"),
  detailBbxLink: document.querySelector("#detailBbxLink"),
  detailMarketPanel: document.querySelector("#detailMarketPanel"),
  detailMarketBody: document.querySelector("#detailMarketBody"),
  openMarketFromDetail: document.querySelector("#openMarketFromDetail"),
  openMarketFromSettings: document.querySelector("#openMarketFromSettings"),
  githubTokenInput: document.querySelector("#githubTokenInput"),
  marketFetchStart: document.querySelector("#marketFetchStart"),
  marketFetchStatus: document.querySelector("#marketFetchStatus"),
  manualFetchStart: document.querySelector("#manualFetchStart"),
  manualFetchStatus: document.querySelector("#manualFetchStatus"),
  detailOfficialLink: document.querySelector("#detailOfficialLink"),
  correctionPanel: document.querySelector(".correction-panel"),
  editToggle: document.querySelector("#editToggle"),
  correctionForm: document.querySelector("#correctionForm"),
  editNameZh: document.querySelector("#editNameZh"),
  editNameKo: document.querySelector("#editNameKo"),
  editNameEn: document.querySelector("#editNameEn"),
  editNameJa: document.querySelector("#editNameJa"),
  editGradeCode: document.querySelector("#editGradeCode"),
  editSubline: document.querySelector("#editSubline"),
  editSeriesKey: document.querySelector("#editSeriesKey"),
  editUniverse: document.querySelector("#editUniverse"),
  editCoverImageUrl: document.querySelector("#editCoverImageUrl"),
  saveCorrection: document.querySelector("#saveCorrection"),
  markVerified: document.querySelector("#markVerified"),
  clearCorrection: document.querySelector("#clearCorrection"),
  exportCorrections: document.querySelector("#exportCorrections"),
  seriesAdminPanel: document.querySelector("#seriesAdminPanel"),
  seriesAdminSummary: document.querySelector("#seriesAdminSummary"),
  seriesAdminSeries: document.querySelector("#seriesAdminSeries"),
  seriesAdminLanguage: document.querySelector("#seriesAdminLanguage"),
  seriesAdminLabel: document.querySelector("#seriesAdminLabel"),
  saveSeriesLabel: document.querySelector("#saveSeriesLabel"),
  clearSeriesLabel: document.querySelector("#clearSeriesLabel"),
  exportSeriesLabels: document.querySelector("#exportSeriesLabels"),
  pagerPreview: document.querySelector("#pagerPreview"),
  gestureOverlay: document.querySelector("#gestureOverlay"),
  radialMenu: document.querySelector("#radialMenu"),
};

function upgradeLegacyFilterDom() {
  const body = document.querySelector("#filterBody") || document.querySelector(".filter-body");
  if (!body) {
    return;
  }
  body.id = "filterBody";

  const filters = [
    ["seriesSelect", "seriesFilter", "workSource", "series-select-filter"],
    ["gradeSelect", "gradeFilter", "productLine", ""],
    ["itemTypeSelect", "itemTypeFilter", "itemType", ""],
    ["releaseYearSelect", "releaseYearFilter", "releaseYear", ""],
    ["limitedSelect", "limitedFilter", "limitedStatus", ""],
  ];

  for (const [selectId, filterId, labelKey, extraClass] of filters) {
    if (document.querySelector(`#${filterId}`)) {
      continue;
    }
    const select = document.querySelector(`#${selectId}`);
    const wrapper = select?.closest("label") || select?.parentElement;
    if (!wrapper) {
      continue;
    }
    const section = document.createElement("section");
    section.className = `multi-filter ${extraClass}`.trim();
    section.hidden = wrapper.hidden;
    const label = wrapper.querySelector("span")?.cloneNode(true) || document.createElement("span");
    label.dataset.i18n = label.dataset.i18n || labelKey;
    const options = document.createElement("div");
    options.className = "filter-options";
    options.id = filterId;
    section.append(label, options);
    wrapper.replaceWith(section);
  }
}

// The APK shell stamps its version into the user agent (GunpulaShell/N) and
// the live site publishes app/shell-version.json. When the published shell is
// newer than the installed one, show a one-tap download banner — Android
// never allows silent sideload installs, so one tap is the floor.
async function checkShellUpdate() {
  const match = /GunpulaShell\/(\d+)/.exec(navigator.userAgent);
  if (!match) {
    return;
  }
  const installed = Number(match[1]);
  const info = await loadOptionalJson("./shell-version.json");
  if (!info || Number(info.shell || 0) <= installed || !info.apk_url) {
    return;
  }
  const banner = document.createElement("div");
  banner.className = "shell-update-banner";
  const text = document.createElement("span");
  text.textContent = t("shellUpdateAvailable");
  const action = document.createElement("a");
  action.href = info.apk_url;
  action.target = "_blank";
  action.rel = "noreferrer";
  action.textContent = t("shellUpdateAction");
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", t("closeSettings"));
  close.addEventListener("click", () => banner.remove());
  banner.append(text, action, close);
  document.body.append(banner);
}

// Startup loads only the active franchise's catalog slice; the rest streams in
// after first render. Falls back to the monolithic kits.json when split files
// are unavailable (e.g. older deployments or partial offline caches).
let catalogCompletion = null;
const searchIndexPromises = new Map();

async function loadInitialKitsDoc() {
  return loadInitialCatalogSlice(state.franchise);
}

async function ensureCatalogComplete() {
  if (catalogCompletion) {
    await catalogCompletion;
    return;
  }
  const manifest = await loadOptionalJson("../data/split/manifest.json");
  const franchises = Object.keys(manifest?.franchises || {}).filter((franchise) => !state.rawKits.some((kit) => kit.franchise === franchise));
  if (franchises.length) {
    completeCatalogInBackground(franchises);
    if (catalogCompletion) await catalogCompletion;
  }
}

function completeCatalogInBackground(pendingFranchises) {
  if (!pendingFranchises?.length || catalogCompletion) {
    return;
  }
  catalogCompletion = (async () => {
    const docs = await Promise.all(pendingFranchises.map((franchise) => loadOptionalJson(`../data/split/kits-${franchise}.json`)));
    if (docs.some((doc) => !doc?.kits)) {
      const fullDoc = await loadJson("../data/kits.json");
      state.rawKits = fullDoc.kits;
      state.updatedAt = fullDoc.updated_at || state.updatedAt;
    } else {
      state.rawKits = state.rawKits.concat(...docs.map((doc) => doc.kits));
    }
    refreshKits();
    renderCatalogDataChanged();
  })().catch(() => {
    catalogCompletion = null;
  });
}

function ingestSearchIndex(doc, franchise = null) {
  ingestSearchIndexState(state, doc, franchise);
}

function ensureSearchIndex(franchise = state.franchise) {
  if (franchise && state.loadedSearchFranchises.has(franchise)) {
    return Promise.resolve(state.searchIndex);
  }
  const key = franchise || "all";
  if (!searchIndexPromises.has(key)) {
    const promise = loadOptionalJson(franchise ? `../data/search/search-${franchise}.json` : "../data/search/search-gundam.json")
      .then((doc) => {
        if (!doc?.records) {
          searchIndexPromises.delete(key);
          return null;
        }
        ingestSearchIndex(doc, franchise || "gundam");
        if (state.query.trim()) {
          renderKits();
        }
        if (state.selectedKit && elements.detailDialog.open) {
          renderDetailMarketPanel(state.selectedKit);
        }
        renderMarketCenter();
        return state.searchIndex;
      })
      .catch(() => {
        searchIndexPromises.delete(key);
        return null;
      });
    searchIndexPromises.set(key, promise);
  }
  return searchIndexPromises.get(key);
}

function normalizeFilterStateValue(value) {
  return normalizeViewFilterStateValue(value);
}

function selectedFilterValues(key) {
  return normalizeFilterStateValue(state[key]).split(",").filter((item) => item && item !== "all");
}

function filterIsAll(key) {
  return selectedFilterValues(key).length === 0;
}

function filterHas(key, value) {
  const values = selectedFilterValues(key);
  return !values.length || values.includes(value);
}

function setFilterValues(key, values) {
  state[key] = normalizeFilterStateValue(values);
}

function toggleFilterValue(key, value) {
  if (value === "all") {
    state[key] = "all";
    return;
  }
  const next = new Set(selectedFilterValues(key));
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  setFilterValues(key, [...next]);
}

function pruneFilterValues(key, allowedValues) {
  const allowed = new Set(allowedValues);
  setFilterValues(
    key,
    selectedFilterValues(key).filter((value) => allowed.has(value)),
  );
}

function preferredLanguage() {
  return readPreferredLanguage(LANGUAGE_KEY, LANGUAGES);
}

function loadSavedViewState() {
  return readSavedViewState({ viewStateKey: VIEW_STATE_KEY, languageKey: LANGUAGE_KEY, languages: LANGUAGES });
}

function currentViewState() {
  return {
    language: state.language,
    franchise: state.franchise,
    series: normalizeFilterStateValue(state.series),
    grade: normalizeFilterStateValue(state.grade),
    itemType: normalizeFilterStateValue(state.itemType),
    releaseYear: normalizeFilterStateValue(state.releaseYear),
    limited: normalizeFilterStateValue(state.limited),
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    query: state.query,
    kit: state.selectedKit?.kit_id || null,
    view: state.activeView,
    modal: state.activeModal,
  };
}

function viewStateUrl(viewState) {
  return buildViewStateUrl(viewState, VIEW_STATE_KEY);
}

function persistViewState(options = {}) {
  const viewState = options.viewState || currentViewState();
  const nextUrl = viewStateUrl(viewState);
  if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    return;
  }
  if (options.mode === "push") {
    window.history.pushState(null, "", nextUrl);
  } else {
    window.history.replaceState(null, "", nextUrl);
  }
}

function seedInitialOverlayHistory() {
  const viewState = currentViewState();
  if (!viewState.kit && !viewState.modal) {
    persistViewState({ mode: "replace", viewState });
    return;
  }

  const baseState = { ...viewState, kit: null, modal: null };
  window.history.replaceState(null, "", viewStateUrl(baseState));
  window.history.pushState(null, "", viewStateUrl(viewState));
}

function applyViewState(viewState) {
  const closingSettings = state.activeModal === "settings" && viewState.modal !== "settings";
  const savedLanguage = preferredLanguage();
  state.language = closingSettings && savedLanguage ? savedLanguage : viewState.language || state.language;
  state.seriesAdminLanguage = state.language;
  state.franchise = viewState.franchise || state.franchise;
  state.series = normalizeFilterStateValue(viewState.series);
  state.grade = normalizeFilterStateValue(viewState.grade);
  state.itemType = normalizeFilterStateValue(viewState.itemType);
  state.releaseYear = normalizeFilterStateValue(viewState.releaseYear);
  state.limited = normalizeFilterStateValue(viewState.limited);
  state.priceMin = viewState.priceMin || "";
  state.priceMax = viewState.priceMax || "";
  state.query = viewState.query || "";
  state.activeView = viewState.view || "catalog";
  state.activeModal = viewState.modal || null;
  state.selectedKit = viewState.kit ? displayKitById(viewState.kit) : null;
  normalizeState();
  localStorage.setItem(LANGUAGE_KEY, state.language);
  render();
  if (state.selectedKit) {
    renderDetail(state.selectedKit);
    openDialog(elements.detailDialog);
  } else if (elements.detailDialog.open) {
    closeDialog(elements.detailDialog);
  }
  if (state.activeModal === "settings") {
    renderSettings();
    openDialog(elements.settingsDialog);
  } else if (elements.settingsDialog.open) {
    closeDialog(elements.settingsDialog);
  }
  persistViewState();
}

async function init() {
  const [
    gradesDoc,
    initialCatalog,
    sourcesDoc,
    imageHealthDoc,
    updateFeedDoc,
    pbandaiDoc,
    sourceHealthDoc,
    seriesAuditDoc,
    marketPricesDoc,
    imageAssetsDoc,
    androidPackageDoc,
    firstSeenDoc,
  ] = await Promise.all([
    loadJson("../data/grades.json"),
    loadInitialKitsDoc(),
    loadJson("../data/sources.json"),
    loadOptionalJson("../data/image-health.json"),
    loadOptionalJson("../data/update-feed-lite.json").then((doc) => doc || loadOptionalJson("../data/update-feed.json")),
    loadOptionalJson("../data/pbandai.json"),
    loadOptionalJson("../data/source-health.json"),
    loadOptionalJson("../data/series-audit.json"),
    loadOptionalJson("../data/market-prices.json"),
    loadOptionalJson("../data/image-assets.json"),
    loadOptionalJson("../data/android-package.json"),
    loadOptionalJson("../data/kit-first-seen.json"),
  ]);

  state.grades = gradesDoc.grades;
  state.rawKits = initialCatalog.doc.kits;
  state.sources = sourcesDoc.sources;
  state.imageHealth = imageHealthDoc;
  state.updateFeed = updateFeedDoc;
  state.pbandai = pbandaiDoc;
  state.sourceHealth = sourceHealthDoc;
  state.seriesAudit = seriesAuditDoc;
  state.marketPrices = marketPricesDoc;
  state.imageAssets = imageAssetsDoc;
  state.androidPackage = androidPackageDoc;
  state.kitFirstSeen = firstSeenDoc?.dates || {};
  state.overrides = loadOverrides();
  state.seriesLabelOverrides = loadSeriesLabelOverrides();
  state.collection = loadCollection();
  state.updatedAt = initialCatalog.doc.updated_at;
  refreshKits();
  normalizeState();
  state.releaseMonth = validReleaseMonth(state.releaseMonth) || defaultReleaseMonth();
  state.selectedKit = state.pendingKitId ? displayKitById(state.pendingKitId) : null;

  bindEvents();
  registerPwa();
  registerUpdatePeriodicSync();
  configureAuth(SYNC_BACKEND.url && SYNC_BACKEND.anonKey ? SYNC_BACKEND : { url: state.syncConfig.supabaseUrl, anonKey: state.syncConfig.anonKey });
  if (syncActive()) {
    await connectSync({ silent: true });
  }
  render();
  if (state.selectedKit) {
    renderDetail(state.selectedKit);
    openDialog(elements.detailDialog);
  }
  if (state.activeModal === "settings") {
    renderSettings();
    openDialog(elements.settingsDialog);
  }
  seedInitialOverlayHistory();
  completeCatalogInBackground(initialCatalog.pendingFranchises);
  if (state.query.trim()) {
    ensureSearchIndex();
  }
  showOnboardingIfNeeded();
  checkShellUpdate();
}

function normalizeState() {
  if (!FRANCHISES.includes(state.franchise)) {
    state.franchise = "gundam";
  }
  if (!LANGUAGES.some((language) => language.code === state.language)) {
    state.language = "zh";
  }
  if (!LANGUAGES.some((language) => language.code === state.seriesAdminLanguage)) {
    state.seriesAdminLanguage = state.language;
  }
  if (state.activeView === "collection") {
    state.activeView = "wanted";
  }
  if (state.activeView === "market") {
    state.activeView = "catalog";
  }
  if (!["home", "catalog", "updates", "pbandai", "owned", "wanted", "guide"].includes(state.activeView)) {
    state.activeView = "home";
  }
  if (!THEMES.some((theme) => theme.code === state.theme)) {
    state.theme = "atlas";
  }
  state.series = normalizeFilterStateValue(state.series);
  state.grade = normalizeFilterStateValue(state.grade);
  state.itemType = normalizeFilterStateValue(state.itemType);
  state.releaseYear = normalizeFilterStateValue(state.releaseYear);
  pruneFilterValues("limited", ["limited", "regular"]);
  if (state.activeModal && state.activeModal !== "settings") {
    state.activeModal = null;
  }
}

function loadOverrides() {
  const parsed = getJson(OVERRIDE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function loadSeriesLabelOverrides() {
  const parsed = getJson(SERIES_LABEL_OVERRIDE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function loadConsoleMode() {
  return getString(CONSOLE_MODE_KEY) === "true";
}

function loadCollectionFilter() {
  const parsed = getJson(COLLECTION_FILTER_KEY, {});
  return {
    franchise: FRANCHISES.includes(parsed?.franchise) ? parsed.franchise : "all",
    series: parsed?.series || "all",
    grade: parsed?.grade || "all",
  };
}

function saveCollectionFilter() {
  setJson(COLLECTION_FILTER_KEY, state.collectionFilter);
}

function loadTheme() {
  const theme = getString(THEME_KEY);
  return THEMES.some((item) => item.code === theme) ? theme : "atlas";
}

function saveTheme() {
  setString(THEME_KEY, state.theme);
}

function loadAppIcon() {
  return getString(APP_ICON_KEY);
}

function saveAppIcon() {
  if (state.appIcon) {
    setString(APP_ICON_KEY, state.appIcon);
  } else {
    removeValue(APP_ICON_KEY);
  }
}

function loadHomeCovers() {
  return normalizeHomeCovers(getJson(HOME_COVER_KEY, {}));
}

function normalizeHomeCovers(value) {
  const covers = {};
  if (!value || typeof value !== "object") {
    return covers;
  }
  for (const franchise of FRANCHISES) {
    const cover = value[franchise];
    if (typeof cover === "string" && cover) {
      covers[franchise] = cover;
    }
  }
  return covers;
}

function saveHomeCovers() {
  const covers = normalizeHomeCovers(state.homeCovers);
  state.homeCovers = covers;
  if (Object.keys(covers).length) {
    setJson(HOME_COVER_KEY, covers);
  } else {
    removeValue(HOME_COVER_KEY);
  }
}

function saveAppearance(options = {}) {
  saveTheme();
  saveAppIcon();
  saveHomeCovers();
  if (!options.skipSync) {
    scheduleCloudSave("appearance");
  }
}

function loadUpdateNotificationFilters() {
  const parsed = getJson(UPDATE_NOTIFICATION_FILTER_KEY, {});
  return { ...DEFAULT_NOTIFICATION_FILTERS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
}

function saveUpdateNotificationFilters() {
  setJson(UPDATE_NOTIFICATION_FILTER_KEY, state.updateNotificationFilters);
}

function loadHomeCollectionVisibility() {
  const parsed = getJson(COLLECTION_HOME_VISIBILITY_KEY, {});
  return {
    owned: parsed.owned !== false,
    wanted: parsed.wanted !== false,
  };
}

function saveHomeCollectionVisibility() {
  setJson(COLLECTION_HOME_VISIBILITY_KEY, state.homeCollectionVisibility);
}

function loadHomeCollectionCollapsed() {
  const parsed = getJson(COLLECTION_HOME_COLLAPSE_KEY, {});
  return {
    owned: parsed.owned === true,
    wanted: parsed.wanted === true,
  };
}

function saveHomeCollectionCollapsed() {
  setJson(COLLECTION_HOME_COLLAPSE_KEY, state.homeCollectionCollapsed);
}

function loadCollection() {
  return normalizeCollection(getJson(COLLECTION_KEY, {}));
}

function clampCollectionQuantity(value) {
  return storeClampCollectionQuantity(value);
}

function collectionStoreOptions() {
  return {
    statuses: COLLECTION_ENTRY_STATUSES,
    self: memberName(),
    droppedMembers: DROPPED_COLLECTION_MEMBERS,
    memberMerges: COLLECTION_MEMBER_MERGES,
  };
}

function normalizeCollection(collection = {}) {
  return storeNormalizeCollection(collection, collectionStoreOptions());
}

function safeMemberName(value) {
  return storeSafeMemberName(value);
}

function normalizeCollectionEntry(entry, now = new Date().toISOString(), member = "member") {
  return storeNormalizeCollectionEntry(entry, { statuses: COLLECTION_ENTRY_STATUSES, now, member });
}

function loadSyncConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}");
    return {
      supabaseUrl: String(parsed.supabaseUrl || ""),
      anonKey: String(parsed.anonKey || ""),
      workspaceId: String(parsed.workspaceId || ""),
      workspaceSecret: String(parsed.workspaceSecret || ""),
      editorSecret: String(parsed.editorSecret || ""),
      memberName: String(parsed.memberName || ""),
    };
  } catch {
    return { supabaseUrl: "", anonKey: "", workspaceId: "", workspaceSecret: "", editorSecret: "", memberName: "" };
  }
}

function loadSyncMeta() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_META_KEY) || "{}");
    return {
      revision: Number(parsed.revision || 0),
      updatedAt: parsed.updatedAt || null,
      updatedBy: parsed.updatedBy || null,
    };
  } catch {
    return { revision: 0, updatedAt: null, updatedBy: null };
  }
}

function loadSyncHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYNC_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, SYNC_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function loadRecentViewed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_VIEWED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveRecentViewed() {
  localStorage.setItem(RECENT_VIEWED_KEY, JSON.stringify(state.recentViewed.slice(0, 20)));
}

function saveOverrides(options = {}) {
  setJson(OVERRIDE_KEY, state.overrides);
  if (!options.skipSync) {
    scheduleCloudSave("overrides");
  }
}

function saveSeriesLabelOverrides(options = {}) {
  setJson(SERIES_LABEL_OVERRIDE_KEY, state.seriesLabelOverrides);
  if (!options.skipSync) {
    scheduleCloudSave("series");
  }
}

function saveConsoleMode() {
  setString(CONSOLE_MODE_KEY, state.consoleMode);
}

function saveCollection(options = {}) {
  state.collection = normalizeCollection(state.collection);
  setJson(COLLECTION_KEY, state.collection);
  if (!options.skipSync) {
    scheduleCloudSave("collection");
  }
}

function saveSyncConfig() {
  setJson(SYNC_CONFIG_KEY, state.syncConfig);
}

function saveSyncMeta() {
  setJson(SYNC_META_KEY, state.syncMeta);
}

function saveSyncHistory() {
  setJson(SYNC_HISTORY_KEY, state.syncHistory.slice(0, SYNC_HISTORY_LIMIT));
}

function snapshotJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function recordSyncHistory(reason, remote = null) {
  const hasLocalData =
    collectionIds("owned").length ||
    collectionIds("wanted").length ||
    Object.keys(state.overrides || {}).length ||
    Object.keys(state.seriesLabelOverrides || {}).length;
  if (!hasLocalData) {
    return;
  }
  state.syncHistory = [
    {
      saved_at: new Date().toISOString(),
      reason,
      local_revision: state.syncMeta.revision || 0,
      incoming_revision: remote?.revision || null,
      updated_by: state.syncMeta.updatedBy || memberName(),
      collection: snapshotJson(normalizeCollection(state.collection)),
      overrides: snapshotJson(state.overrides),
      series_label_overrides: snapshotJson(state.seriesLabelOverrides),
    },
    ...state.syncHistory,
  ].slice(0, SYNC_HISTORY_LIMIT);
  saveSyncHistory();
}

function refreshKits() {
  state.kits = state.rawKits.map((kit) => applyOverride(kit)).filter((kit) => kit.data_status !== "hidden");
}

function rawSeriesTemplateByKey(key) {
  if (!key) {
    return null;
  }
  for (const rawKit of state.rawKits) {
    const series = normalizeKit(rawKit).series;
    if (series?.key === key) {
      return structuredClone(series);
    }
  }
  return {
    key,
    sort: 999,
    labels: { zh: key, en: key, ja: key, ko: key },
  };
}

function applyOverride(kit) {
  const override = state.overrides[kit.kit_id];
  if (!override) {
    return normalizeKit(kit);
  }

  const normalized = normalizeKit(kit);
  const names = { ...normalized.names };
  let series = normalized.series;
  const images = { ...(normalized.images || {}) };
  let galleryImageUrls = [...(normalized.gallery_image_urls || [])];
  for (const code of ["zh", "ko", "en", "ja"]) {
    const key = `name_${code}`;
    if (Object.hasOwn(override, key)) {
      names[code] = override[key];
    }
  }
  if (Object.hasOwn(override, "series_key")) {
    series = rawSeriesTemplateByKey(override.series_key);
  }
  if (Object.hasOwn(override, "cover_image_url") || Object.hasOwn(override, "image_url")) {
    const coverImageUrl = String(override.cover_image_url ?? override.image_url ?? "").trim();
    images.box_art_url = coverImageUrl || null;
    galleryImageUrls = [...new Set([coverImageUrl, ...galleryImageUrls].filter(Boolean))];
  }
  if (Array.isArray(override.gallery_image_urls)) {
    galleryImageUrls = [...new Set([...galleryImageUrls, ...override.gallery_image_urls].filter(Boolean))];
  }

  return {
    ...normalized,
    names,
    series,
    images,
    gallery_image_urls: galleryImageUrls,
    grade_code: Object.hasOwn(override, "grade_code") ? override.grade_code : normalized.grade_code,
    subline: Object.hasOwn(override, "subline") ? override.subline : normalized.subline,
    universe: Object.hasOwn(override, "universe") ? override.universe : normalized.universe,
    data_status: Object.hasOwn(override, "data_status") ? override.data_status : normalized.data_status,
    source_urls: Array.isArray(override.source_urls) ? [...new Set([...(normalized.source_urls || []), ...override.source_urls].filter(Boolean))] : normalized.source_urls,
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

function openSettings(panel = null) {
  // Settings opens on its vertical menu unless a caller jumps to a panel directly.
  state.settingsPanel = typeof panel === "string" && SETTINGS_PANELS.includes(panel) ? panel : "home";
  state.consoleMode = state.settingsPanel === "console";
  localStorage.setItem(SETTINGS_PANEL_KEY, state.settingsPanel);
  state.activeModal = "settings";
  renderSettings();
  renderConsoleMode();
  openDialog(elements.settingsDialog);
  persistViewState({ mode: "push" });
}

function closeSettings(options = {}) {
  if (options.navigate !== false && state.activeModal === "settings") {
    window.history.back();
    return;
  }
  closeDialog(elements.settingsDialog);
  state.activeModal = null;
  persistViewState({ mode: "replace" });
}

function bindEvents() {
  elements.settingsOpen.addEventListener("click", openUserPage);
  elements.settingsClose.addEventListener("click", closeSettings);
  elements.settingsTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-settings-tab]");
    if (!button) {
      return;
    }
    state.settingsPanel = button.dataset.settingsTab;
    state.consoleMode = state.settingsPanel === "console";
    saveConsoleMode();
    localStorage.setItem(SETTINGS_PANEL_KEY, state.settingsPanel);
    renderSettingsTabs();
    renderSettingsPanels();
    renderConsoleMode();
  });
  elements.settingsBack?.addEventListener("click", () => {
    if (state.settingsPanel === "home") {
      closeSettings();
      return;
    }
    state.settingsPanel = "home";
    state.consoleMode = false;
    saveConsoleMode();
    localStorage.setItem(SETTINGS_PANEL_KEY, state.settingsPanel);
    renderSettingsTabs();
    renderSettingsPanels();
    renderConsoleMode();
  });
  elements.homeCoverInput?.addEventListener("change", handleHomeCoverUpload);
  elements.appIconInput.addEventListener("change", handleAppIconUpload);
  elements.resetAppIcon.addEventListener("click", () => {
    if (!canEditSharedData()) {
      setSyncStatus("readonly", t("readOnlyHint"));
      return;
    }
    state.appIcon = "";
    saveAppearance();
    elements.appIconInput.value = "";
    applyAppearance();
  });
  elements.showOwnedOnHome.addEventListener("change", (event) => {
    state.homeCollectionVisibility.owned = event.target.checked;
    saveHomeCollectionVisibility();
    renderSettings();
    renderCollections();
  });
  elements.showWantedOnHome.addEventListener("change", (event) => {
    state.homeCollectionVisibility.wanted = event.target.checked;
    saveHomeCollectionVisibility();
    renderSettings();
    renderCollections();
  });
  bindCollectionPanelNavigation(elements.ownedPanel, "owned");
  bindCollectionPanelNavigation(elements.wantedPanel, "wanted");
  elements.ownedCollapse.addEventListener("click", () => toggleHomeCollectionCollapsed("owned"));
  elements.wantedCollapse.addEventListener("click", () => toggleHomeCollectionCollapsed("wanted"));
  elements.bottomNav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-view]");
    if (!button) {
      return;
    }
    let nextView = button.dataset.view;
    if (nextView === "settings") {
      openSettings();
      return;
    }
    if (nextView === "me") {
      openUserPage();
      renderBottomNav();
      return;
    }
    if (nextView === "collection") {
      // Merged collection entry: reopen whichever tab (wanted/owned) was last active.
      nextView = COLLECTION_TYPES.includes(state.lastCollectionTab) ? state.lastCollectionTab : "wanted";
    }
    state.activeView = nextView;
    if (COLLECTION_TYPES.includes(nextView)) {
      state.lastCollectionTab = nextView;
      state.query = "";
    }
    state.selectedKit = null;
    state.activeModal = null;
    localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
    persistViewState({ mode: "push" });
    render();
  });
  elements.collectionSelectAll.addEventListener("change", toggleVisibleCollectionSelection);
  elements.deleteSelectedCollection.addEventListener("click", deleteSelectedCollectionItems);
  elements.clearCollectionView.addEventListener("click", clearActiveCollectionView);
  elements.collectionTypeTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-collection-type]");
    if (!button || button.dataset.collectionType === state.activeView) {
      return;
    }
    switchToView(button.dataset.collectionType);
  });
  elements.collectionFilterButton?.addEventListener("click", () => {
    if (!elements.collectionFilterSheet) {
      return;
    }
    elements.collectionFilterSheet.hidden = !elements.collectionFilterSheet.hidden;
    renderCollectionFilterButton();
  });
  elements.saveSyncConfig.addEventListener("click", saveAndConnectSync);
  elements.syncNow.addEventListener("click", () => pullSync({ force: true }));
  elements.disconnectSync.addEventListener("click", disconnectSync);
  elements.accountSendCode.addEventListener("click", accountSendCode);
  elements.accountVerify.addEventListener("click", accountVerifyCode);
  elements.accountEmail.addEventListener("keydown", (event) => {
    if (event.key === "Enter") accountSendCode();
  });
  elements.accountCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") accountVerifyCode();
  });
  elements.accountSignOut.addEventListener("click", confirmAndSignOut);
  elements.saveMemberDisplayName?.addEventListener("click", saveMemberDisplayNameNow);
  elements.memberDisplayNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveMemberDisplayNameNow();
  });
  elements.workspaceCreate.addEventListener("click", workspaceCreateNow);
  elements.workspaceJoin.addEventListener("click", workspaceJoinNow);
  elements.workspaceCopyInvite.addEventListener("click", copyInviteCode);
  elements.workspaceLeave?.addEventListener("click", workspaceLeaveNow);
  elements.migrateV1.addEventListener("click", migrateFromV1Now);
  elements.installApp.addEventListener("click", installPwa);
  elements.exportBackup?.addEventListener("click", exportCollectionBackup);
  elements.importBackupButton?.addEventListener("click", () => elements.importBackupInput?.click());
  elements.importBackupInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      importCollectionBackup(file);
    }
  });
  elements.onboardingOpenAccount?.addEventListener("click", () => {
    finishOnboarding();
    openSettings("account");
  });
  elements.onboardingImport?.addEventListener("click", () => {
    finishOnboarding();
    elements.importBackupInput?.click();
  });
  elements.onboardingDone?.addEventListener("click", finishOnboarding);
  elements.onboardingDialog?.addEventListener("cancel", finishOnboarding);
  elements.onboardingDialog?.addEventListener("click", (event) => {
    if (event.target === elements.onboardingDialog) {
      finishOnboarding();
    }
  });
  elements.refreshAppCache.addEventListener("click", refreshAppCache);
  elements.updateNotificationToggle.addEventListener("change", toggleUpdateNotifications);
  elements.updatesOpenSettings?.addEventListener("click", () => {
    openSettings();
    requestAnimationFrame(() => elements.updateLog?.scrollIntoView({ block: "start", behavior: "smooth" }));
  });
  elements.updatesDateInput?.addEventListener("change", (event) => {
    state.releaseMonth = event.target.value || defaultReleaseMonth();
    localStorage.setItem(RELEASE_MONTH_KEY, state.releaseMonth);
    setUpdatesMode("month");
  });
  elements.updatesRecentButton?.addEventListener("click", () => {
    setUpdatesMode("recent");
  });
  elements.updatesWeekButton?.addEventListener("click", () => {
    setUpdatesMode("week");
  });
  elements.accountAvatar?.addEventListener("click", () => {
    if (syncModeV2() && state.sync.workspace) {
      elements.avatarInput?.click();
    }
  });
  elements.avatarInput?.addEventListener("change", handleAvatarChange);
  elements.memberDialogClose?.addEventListener("click", () => closeDialog(elements.memberDialog));
  elements.memberDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(elements.memberDialog);
  });
  elements.memberDialog?.addEventListener("click", (event) => {
    if (event.target === elements.memberDialog) closeDialog(elements.memberDialog);
  });
  elements.memberDialogChangeAvatar?.addEventListener("click", () => elements.avatarInput?.click());
  elements.memberDialogAvatar?.addEventListener("click", () => {
    openMemberActionSheet();
  });
  elements.memberDialogChangeBackground?.addEventListener("click", () => openMemberActionSheet());
  elements.memberDialogHead?.addEventListener("click", (event) => {
    if (event.target.closest("button, input, textarea, select, a")) return;
    openMemberActionSheet();
  });
  elements.memberDialogHead?.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openMemberActionSheet();
  });
  elements.memberDialogName?.addEventListener("click", () => openMemberActionSheet());
  elements.memberDialogFavorites?.addEventListener("click", () => openMemberActionSheet());
  elements.memberDialogSaveName?.addEventListener("click", () => saveMemberDisplayNameValue(elements.memberDialogNameInput?.value, elements.memberDialogSaveName));
  elements.memberDialogNameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveMemberDisplayNameValue(elements.memberDialogNameInput.value, elements.memberDialogSaveName);
  });
  elements.profileBackgroundInput?.addEventListener("change", handleProfileBackgroundChange);
  elements.profileImageClose?.addEventListener("click", () => closeDialog(elements.profileImageDialog));
  elements.profileImageDialog?.addEventListener("click", (event) => {
    if (event.target === elements.profileImageDialog) closeDialog(elements.profileImageDialog);
  });
  elements.profileImageDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(elements.profileImageDialog);
  });
  elements.memberActionCancel?.addEventListener("click", () => closeDialog(elements.memberActionDialog));
  elements.memberActionDialog?.addEventListener("click", (event) => {
    if (event.target === elements.memberActionDialog) closeDialog(elements.memberActionDialog);
  });
  elements.memberActionDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(elements.memberActionDialog);
  });
  elements.memberActionViewBackground?.addEventListener("click", () => viewMemberProfileImage("background"));
  elements.memberActionViewAvatar?.addEventListener("click", () => viewMemberProfileImage("avatar"));
  elements.memberActionChangeBackground?.addEventListener("click", () => {
    closeDialog(elements.memberActionDialog);
    if (memberProfileEditable()) elements.profileBackgroundInput?.click();
  });
  elements.memberActionChangeAvatar?.addEventListener("click", () => {
    closeDialog(elements.memberActionDialog);
    if (memberProfileEditable()) elements.avatarInput?.click();
  });
  elements.memberActionRename?.addEventListener("click", () => renameFromMemberActionSheet());
  elements.memberActionTags?.addEventListener("click", () => {
    closeDialog(elements.memberActionDialog);
    if (memberProfileEditable()) openUserPanelDialog("favorites");
  });
  elements.userChip?.addEventListener("click", () => {
    if (syncModeV2()) {
      openUserPage();
    } else {
      openSettings("account");
    }
  });
  elements.userDialogClose?.addEventListener("click", () => closeUserPage());
  elements.userDialog?.addEventListener("click", (event) => {
    if (event.target === elements.userDialog) {
      closeUserPage();
    }
  });
  // Left-swipe on the open drawer closes it (mirrors the left-edge right-swipe that opens it).
  let drawerSwipeX = null;
  elements.userDialog?.addEventListener(
    "touchstart",
    (event) => {
      drawerSwipeX = event.touches.length === 1 ? event.touches[0].clientX : null;
    },
    { passive: true },
  );
  elements.userDialog?.addEventListener(
    "touchend",
    (event) => {
      if (drawerSwipeX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? drawerSwipeX;
      if (endX - drawerSwipeX < -55) {
        closeUserPage();
      }
      drawerSwipeX = null;
    },
    { passive: true },
  );
  elements.userDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeUserPage();
  });
  elements.userDialogAvatar?.addEventListener("click", () => openMemberProfile(currentMember()));
  elements.userDialogHead?.addEventListener("click", (event) => {
    if (event.target.closest("button, input, textarea, select, a")) return;
    openMemberProfile(currentMember());
  });
  elements.userDialogName?.addEventListener("click", () => openMemberProfile(currentMember()));
  elements.userPanelClose?.addEventListener("click", () => closeDialog(elements.userPanelDialog));
  elements.userPanelDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog(elements.userPanelDialog);
  });
  elements.userPanelDialog?.addEventListener("click", (event) => {
    if (event.target === elements.userPanelDialog) closeDialog(elements.userPanelDialog);
  });
  document.querySelectorAll(".user-menu-details > summary").forEach((summary, index) => {
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      openUserPanelDialog(index === 0 ? "favorites" : "friends");
    });
  });
  elements.userRowOwned?.addEventListener("click", () => {
    closeUserPage();
    state.returnToUserDrawer = true;
    state.collectionMemberView = "self";
    localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
    switchToView("owned");
  });
  elements.userRowWanted?.addEventListener("click", () => {
    closeUserPage();
    state.returnToUserDrawer = true;
    state.collectionMemberView = "self";
    localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
    switchToView("wanted");
  });
  elements.userRowSettings?.addEventListener("click", () => {
    closeUserPage();
    state.returnToUserDrawer = true;
    openSettings();
  });
  elements.userRowGuide?.addEventListener("click", () => {
    closeUserPage();
    state.returnToUserDrawer = true;
    openGuide();
  });
  elements.guideClose?.addEventListener("click", () => switchToView("home"));
  elements.guideColorToggle?.addEventListener("click", toggleGuideFullColor);
  elements.guideTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-guide-tab]");
    if (!button || button.dataset.guideTab === state.guideTab) return;
    switchGuideTab(button.dataset.guideTab);
  });
  bindGuideSwipe();
  elements.bbxTopClose?.addEventListener("click", () => closeDialog(elements.bbxTopDialog));
  elements.bbxTopDialog?.addEventListener("click", (event) => {
    if (event.target === elements.bbxTopDialog) closeDialog(elements.bbxTopDialog);
  });
  elements.bbxPartClose?.addEventListener("click", () => closeDialog(elements.bbxPartDialog));
  elements.bbxPartDialog?.addEventListener("click", (event) => {
    if (event.target === elements.bbxPartDialog) closeDialog(elements.bbxPartDialog);
  });
  elements.guideUnitClose?.addEventListener("click", () => closeGuideUnitLayer());
  elements.guideUnitDialog?.addEventListener("click", (event) => {
    if (event.target === elements.guideUnitDialog) closeGuideUnitLayer();
  });
  elements.userRowSignOut?.addEventListener("click", () => {
    if (!window.confirm(t("signOutConfirm"))) {
      return;
    }
    closeUserPage();
    accountSignOutNow();
  });
  elements.userCopyInvite?.addEventListener("click", async () => {
    const code = state.sync.workspace?.inviteCode || "";
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      elements.userCopyInvite.textContent = t("workspaceCopied");
      setTimeout(() => {
        elements.userCopyInvite.textContent = t("workspaceCopy");
      }, 1600);
    } catch {
      // Clipboard unavailable: the code stays visible to copy by hand.
    }
  });
  elements.searchInput.addEventListener("focus", () => ensureSearchIndex(), { once: false });
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    ensureSearchIndex();
    persistViewState();
    renderSearchTarget();
  });
  elements.filterBody?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter-key][data-filter-value]");
    if (!button) {
      return;
    }
    toggleFilterValue(button.dataset.filterKey, button.dataset.filterValue);
    renderSeriesControls();
    renderGradeSelect();
    renderAdvancedFilters();
    renderSeriesAdmin();
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  for (const input of [elements.priceMinInput, elements.priceMaxInput].filter(Boolean)) {
    input.addEventListener("change", () => {
      state.priceMin = elements.priceMinInput?.value.trim() || "";
      state.priceMax = elements.priceMaxInput?.value.trim() || "";
      renderFilterSummary();
      persistViewState({ mode: "push" });
      renderKits();
    });
  }
  elements.clearFilters.addEventListener("click", clearFilters);

  elements.detailClose.addEventListener("click", closeDetail);
  elements.galleryPrev.addEventListener("click", () => selectAdjacentImage(-1));
  elements.galleryNext.addEventListener("click", () => selectAdjacentImage(1));
  elements.detailMainImage.addEventListener("pointerdown", handleImagePointerStart);
  elements.detailMainImage.addEventListener("pointerup", handleImagePointerEnd);
  elements.detailMainImage.addEventListener("pointercancel", clearImagePointer);
  elements.toggleOwned.addEventListener("click", () => toggleKitCollection("owned"));
  elements.toggleWanted.addEventListener("click", () => toggleKitCollection("wanted"));
  elements.wantedQuantityMinus.addEventListener("click", () => updateSelectedWantedQuantity(selectedWantedQuantity() - 1));
  elements.wantedQuantityPlus.addEventListener("click", () => updateSelectedWantedQuantity(selectedWantedQuantity() + 1));
  elements.wantedQuantityInput.addEventListener("change", (event) => updateSelectedWantedQuantity(event.target.value));
  elements.saveCollectionDetails.addEventListener("click", saveSelectedCollectionDetails);
  if (elements.githubTokenInput) {
    elements.githubTokenInput.value = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  }
  const dispatchWorkflow = async (workflowFile, statusEl, okKey) => {
    const token = elements.githubTokenInput?.value.trim() || "";
    const status = (text) => {
      if (statusEl) statusEl.textContent = text;
    };
    if (!token) {
      status(t("manualFetchNeedToken"));
      return;
    }
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
    status(t("manualFetchRunning"));
    try {
      const response = await fetch(`https://api.github.com/repos/mdefitko777/Gunpula/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      });
      status(response.status === 204 ? t(okKey) : `${t("manualFetchFail")} (HTTP ${response.status})`);
    } catch {
      status(t("manualFetchFail"));
    }
  };
  elements.marketFetchStart?.addEventListener("click", () => dispatchWorkflow("market-prices.yml", elements.marketFetchStatus, "marketFetchOk"));
  elements.manualFetchStart?.addEventListener("click", () => dispatchWorkflow("refresh-catalog.yml", elements.manualFetchStatus, "manualFetchOk"));
  elements.editToggle.addEventListener("click", () => {
    elements.correctionForm.hidden = !elements.correctionForm.hidden;
  });
  elements.saveCorrection.addEventListener("click", saveCurrentCorrection);
  elements.markVerified.addEventListener("click", markCurrentVerified);
  elements.clearCorrection.addEventListener("click", clearCurrentCorrection);
  elements.exportCorrections.addEventListener("click", exportCorrections);
  elements.detailOfficialLink.addEventListener("click", persistViewState);
  elements.seriesAdminSeries.addEventListener("change", () => {
    state.seriesAdminKey = elements.seriesAdminSeries.value;
    updateSeriesAdminLabelField();
  });
  elements.seriesAdminLanguage.addEventListener("change", () => {
    state.seriesAdminLanguage = elements.seriesAdminLanguage.value;
    updateSeriesAdminLabelField();
  });
  elements.saveSeriesLabel.addEventListener("click", saveCurrentSeriesLabel);
  elements.clearSeriesLabel.addEventListener("click", clearCurrentSeriesLabel);
  elements.exportSeriesLabels.addEventListener("click", exportSeriesLabels);
  elements.detailDialog.addEventListener("click", (event) => {
    if (event.target === elements.detailDialog) {
      closeDetail();
    }
  });
  elements.detailDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDetail();
  });
  elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) {
      closeSettings();
    }
  });
  elements.settingsDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSettings();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.detailDialog.open) {
      closeDetail();
    }
    if (event.key === "Escape" && elements.settingsDialog.open) {
      closeSettings();
    }
    if (elements.detailDialog.open && event.key === "ArrowLeft") {
      selectAdjacentImage(-1);
    }
    if (elements.detailDialog.open && event.key === "ArrowRight") {
      selectAdjacentImage(1);
    }
  });
  window.addEventListener("hashchange", () => {
    applyViewState(loadSavedViewState());
  });
  window.addEventListener("popstate", () => {
    if (closeTopLayerForBack()) {
      persistViewState({ mode: "replace" });
      return;
    }
    applyViewState(loadSavedViewState());
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && syncConfigComplete()) {
      pullSync({ silent: true });
    }
  });
  bindRadialMenu();
  registerNativeBackButton();

  populateGradeSelect();
}

function registerNativeBackButton() {
  const appPlugin = window.Capacitor?.Plugins?.App;
  if (!isNativeShell() || !appPlugin?.addListener) {
    return;
  }
  appPlugin.addListener("backButton", () => {
    if (closeTopLayerForBack()) {
      return;
    }
    if (state.returnToUserDrawer) {
      state.returnToUserDrawer = false;
      openUserPage();
      return;
    }
    if (state.activeView !== "home") {
      state.activeView = "home";
      state.selectedKit = null;
      state.activeModal = null;
      localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
      render();
      persistViewState({ mode: "replace" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    appPlugin.minimizeApp?.();
  });
}

function closeTopLayerForBack() {
  if (elements.onboardingDialog?.open) {
    finishOnboarding();
    return true;
  }
  if (elements.bbxPartDialog?.open) {
    closeDialog(elements.bbxPartDialog);
    return true;
  }
  if (elements.bbxTopDialog?.open) {
    closeDialog(elements.bbxTopDialog);
    return true;
  }
  if (elements.guideUnitDialog?.open) {
    closeGuideUnitLayer();
    return true;
  }
  if (elements.profileImageDialog?.open) {
    closeDialog(elements.profileImageDialog);
    return true;
  }
  if (elements.memberActionDialog?.open) {
    closeDialog(elements.memberActionDialog);
    return true;
  }
  if (elements.userPanelDialog?.open) {
    closeDialog(elements.userPanelDialog);
    return true;
  }
  if (elements.memberDialog?.open) {
    closeDialog(elements.memberDialog);
    return true;
  }
  if (elements.userDialog?.open) {
    closeUserPage({ immediate: true });
    return true;
  }
  if (elements.detailDialog?.open || state.selectedKit) {
    closeDetail({ navigate: false });
    return true;
  }
  if (elements.settingsDialog?.open || state.activeModal === "settings") {
    if (state.settingsPanel && state.settingsPanel !== "home") {
      state.settingsPanel = "home";
      renderSettingsPanels();
    } else {
      closeSettings({ navigate: false });
      if (state.returnToUserDrawer) {
        state.returnToUserDrawer = false;
        openUserPage();
      }
    }
    return true;
  }
  return false;
}

async function handleAppIconUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    event.target.value = "";
    return;
  }
  try {
    state.appIcon = await imageDataUrlFromFile(file, { width: 256, height: 256, fit: "contain", format: "image/png" });
    saveAppearance();
    applyAppearance();
  } finally {
    event.target.value = "";
  }
}

async function handleHomeCoverUpload(event) {
  const file = event.target.files?.[0];
  const franchise = state.pendingHomeCoverFranchise;
  state.pendingHomeCoverFranchise = null;
  if (!file || !FRANCHISES.includes(franchise)) {
    event.target.value = "";
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    event.target.value = "";
    return;
  }
  try {
    state.homeCovers[franchise] = await imageDataUrlFromFile(file, { width: 720, height: 450, fit: "cover", format: "image/jpeg", quality: 0.86 });
    saveAppearance();
    renderHome();
  } finally {
    event.target.value = "";
  }
}

function imageDataUrlFromFile(file, options = {}) {
  const targetWidth = options.width || 256;
  const targetHeight = options.height || targetWidth;
  const fit = options.fit || "contain";
  const format = options.format || "image/png";
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, targetWidth, targetHeight);
      const scale = fit === "cover" ? Math.max(targetWidth / image.width, targetHeight / image.height) : Math.min(targetWidth / image.width, targetHeight / image.height);
      const drawWidth = Math.max(1, Math.round(image.width * scale));
      const drawHeight = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL(format, options.quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(image.src);
      reject(new Error("image load failed"));
    };
    image.src = URL.createObjectURL(file);
  });
}

function bindRadialMenu() {
  if (!elements.radialMenu || !elements.gestureOverlay) {
    return;
  }
  document.addEventListener("touchstart", startTouchGesture, { capture: true, passive: false });
  document.addEventListener("touchmove", moveTouchGesture, { capture: true, passive: false });
  document.addEventListener("touchend", endTouchGesture, { capture: true, passive: false });
  document.addEventListener("touchcancel", cancelTouchGesture, { capture: true, passive: false });
  document.addEventListener(
    "click",
    (event) => {
      if (!state.radial.suppressClick && !state.pager.suppressClick) {
        return;
      }
      state.radial.suppressClick = false;
      state.pager.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  document.addEventListener(
    "dragstart",
    (event) => {
      if (state.radial.touchId !== null || state.pager.active) {
        event.preventDefault();
      }
    },
    true,
  );
  document.addEventListener("contextmenu", (event) => {
    if (state.radial.active || state.radial.touchId !== null) {
      event.preventDefault();
    }
  });
}

function gestureTargetAllowed(target) {
  if (
    elements.detailDialog.open ||
    elements.settingsDialog.open ||
    elements.memberDialog?.open ||
    elements.memberActionDialog?.open ||
    elements.userDialog?.open ||
    elements.guideUnitDialog?.open ||
    elements.profileImageDialog?.open ||
    elements.bbxTopDialog?.open ||
    elements.bbxPartDialog?.open
  ) {
    return false;
  }
  if (!(target instanceof Element)) {
    return false;
  }
  const dialog = target.closest("dialog");
  if (dialog && dialog !== elements.guideDialog) {
    return false;
  }
  return !target.closest("input, textarea, select, option");
}

function swipeZoneAllowed(y) {
  const height = window.innerHeight || document.documentElement.clientHeight || 1;
  return y >= height * SWIPE_ZONE_TOP_RATIO;
}

// The page swipe must not fire from controls that scroll or pan horizontally
// themselves (franchise tabs, series tabs, filter chips, collection strips…),
// otherwise scrolling a filter row keeps flipping to another franchise.
function pagerBlockedByTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest(".page-header")) {
    return true;
  }
  let node = target;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 1) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function startTouchGesture(event) {
  if (event.touches.length !== 1 || state.pager.settling || !gestureTargetAllowed(event.target)) {
    return;
  }
  const touch = event.changedTouches[0];
  cancelRadialPress();
  resetPagerGesture();
  state.radial = {
    timer: setTimeout(() => showRadialMenu(state.radial.lastX, state.radial.lastY), RADIAL_HOLD_MS),
    active: false,
    startX: touch.clientX,
    startY: touch.clientY,
    lastX: touch.clientX,
    lastY: touch.clientY,
    touchId: touch.identifier,
    selected: null,
    target: event.target,
    suppressClick: state.radial.suppressClick,
  };
  state.pager.touchId = touch.identifier;
  state.pager.startX = touch.clientX;
  state.pager.startY = touch.clientY;
  state.pager.deltaX = 0;
  state.pager.blockedByTarget = pagerBlockedByTarget(event.target);
}

function moveTouchGesture(event) {
  const touch = trackedTouch(event.touches);
  if (!touch) {
    return;
  }
  state.radial.lastX = touch.clientX;
  state.radial.lastY = touch.clientY;

  if (state.radial.active) {
    if (event.cancelable) event.preventDefault();
    updateRadialSelection(touch.clientX, touch.clientY);
    return;
  }

  if (state.pager.active) {
    if (event.cancelable) event.preventDefault();
    updatePagerGesture(touch.clientX - state.pager.startX);
    return;
  }

  const deltaX = touch.clientX - state.radial.startX;
  const deltaY = touch.clientY - state.radial.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  // A left-edge swipe to the right slides the personal drawer out, QQ-style.
  // This runs before catalog paging so catalog/guide can still open the drawer.
  if (
    state.radial.startX <= DRAWER_EDGE_ZONE &&
    swipeZoneAllowed(state.radial.startY) &&
    deltaX > DRAWER_OPEN_DISTANCE &&
    absX > absY * 1.15 &&
    !elements.userDialog?.open
  ) {
    clearTimeout(state.radial.timer);
    state.radial.timer = null;
    state.radial.touchId = null;
    state.radial.suppressClick = true;
    resetPagerGesture();
    if (event.cancelable) event.preventDefault();
    openUserPage();
    return;
  }
  if (
    state.activeView === "catalog" &&
    swipeZoneAllowed(state.pager.startY) &&
    !state.pager.blockedByTarget &&
    absX > COLLECTION_SWIPE_DISTANCE &&
    absX > absY * 1.3
  ) {
    clearTimeout(state.radial.timer);
    state.radial.timer = null;
    state.radial.touchId = null;
    state.pager.touchId = null;
    state.radial.suppressClick = true;
    const target = adjacentFranchise(deltaX < 0 ? 1 : -1);
    if (target) {
      openFranchiseCatalog(target);
    }
    if (event.cancelable) event.preventDefault();
    return;
  }
  if (
    state.activeView === "updates" &&
    swipeZoneAllowed(state.pager.startY) &&
    !state.pager.blockedByTarget &&
    absX > COLLECTION_SWIPE_DISTANCE &&
    absX > absY * 1.3
  ) {
    clearTimeout(state.radial.timer);
    state.radial.timer = null;
    state.radial.touchId = null;
    state.pager.touchId = null;
    state.radial.suppressClick = true;
    const target = deltaX < 0 ? "week" : "recent";
    if (state.updatesMode !== target) {
      if (event.cancelable) event.preventDefault();
      setUpdatesMode(target);
    }
    return;
  }
  // Inside the merged collection view, a horizontal swipe flips between the
  // wanted and owned tabs. blockedByTarget already excludes the scrollable member
  // avatar row and collection strips, so this only fires on the card grid / body.
  if (
    COLLECTION_TYPES.includes(state.activeView) &&
    swipeZoneAllowed(state.pager.startY) &&
    !state.pager.blockedByTarget &&
    absX > COLLECTION_SWIPE_DISTANCE &&
    absX > absY * 1.3
  ) {
    clearTimeout(state.radial.timer);
    state.radial.timer = null;
    state.radial.touchId = null;
    state.pager.touchId = null;
    state.radial.suppressClick = true;
    const target = deltaX < 0 ? "owned" : "wanted";
    if (state.activeView !== target) {
      if (event.cancelable) event.preventDefault();
      switchToView(target);
    }
    return;
  }
  // Vertical movement should stay a normal page scroll. The radial menu only
  // arms while the finger is nearly still, then takes over after it appears.
  if (absY > RADIAL_SCROLL_CANCEL_DISTANCE && absY > absX * 1.15) {
    cancelRadialPress();
    return;
  }
  // Any real movement (either axis) is a scroll or swipe, not a hold.
  if (absX > RADIAL_CANCEL_DISTANCE || absY > RADIAL_CANCEL_DISTANCE) {
    cancelRadialPress();
  }
}

function endTouchGesture(event) {
  const touch = trackedTouch(event.changedTouches);
  if (!touch) {
    return;
  }
  if (state.radial.active) {
    finishRadialTouch(event, touch);
    return;
  }
  if (state.pager.active) {
    finishPagerGesture(event, touch);
    return;
  }
  cancelRadialPress();
  resetPagerGesture(true);
}

function cancelTouchGesture(event) {
  if (!trackedTouch(event.changedTouches)) {
    return;
  }
  cancelRadialPress();
  resetPagerGesture(true);
}

function trackedTouch(list) {
  const touchId = state.radial.touchId ?? state.pager.touchId;
  if (touchId === null || touchId === undefined) {
    return null;
  }
  return [...list].find((touch) => touch.identifier === touchId) || null;
}

function finishRadialTouch(event, touch) {
  state.radial.lastX = touch.clientX;
  state.radial.lastY = touch.clientY;
  updateRadialSelection(touch.clientX, touch.clientY);
  const selected = state.radial.active ? state.radial.selected : null;
  cancelRadialPress();
  if (selected) {
    state.radial.suppressClick = true;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    activateRadialSelection(selected);
  }
}

function cancelRadialPress() {
  clearTimeout(state.radial.timer);
  state.radial.timer = null;
  state.radial.active = false;
  state.radial.touchId = null;
  state.radial.selected = null;
  state.radial.target = null;
  state.radial.items = [];
  if (elements.gestureOverlay) {
    elements.gestureOverlay.hidden = true;
  }
  document.body.classList.remove("is-radial-active");
  if (elements.radialMenu) {
    elements.radialMenu.hidden = true;
    elements.radialMenu.innerHTML = "";
  }
}

function showRadialMenu(x, y) {
  const items = radialMenuItems();
  if (!items.length) return;
  const centerX = Math.min(Math.max(x, 112), window.innerWidth - 112);
  const centerY = Math.min(Math.max(y, 112), window.innerHeight - 112);
  state.radial.active = true;
  state.radial.items = items;
  state.radial.startX = centerX;
  state.radial.startY = centerY;
  elements.gestureOverlay.hidden = false;
  document.body.classList.add("is-radial-active");
  elements.radialMenu.hidden = false;
  elements.radialMenu.style.left = `${centerX}px`;
  elements.radialMenu.style.top = `${centerY}px`;
  elements.radialMenu.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "radial-ring");
  svg.setAttribute("viewBox", "0 0 220 220");
  svg.setAttribute("aria-hidden", "true");
  const labels = document.createElement("div");
  labels.className = "radial-labels";
  const step = 360 / items.length;
  items.forEach((item, index) => {
    const centerAngle = -90 + index * step;
    const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
    segment.setAttribute("class", "radial-segment");
    segment.dataset.radialId = item.id;
    segment.setAttribute("d", donutSegmentPath(110, 110, 104, 42, centerAngle - step / 2 + 2, centerAngle + step / 2 - 2));
    svg.append(segment);

    const angle = centerAngle;
    const radian = (angle * Math.PI) / 180;
    const label = document.createElement("span");
    label.className = "radial-label";
    label.dataset.radialId = item.id;
    label.style.left = `${110 + Math.cos(radian) * 74}px`;
    label.style.top = `${110 + Math.sin(radian) * 74}px`;
    label.textContent = item.label;
    labels.append(label);
  });
  const center = document.createElement("div");
  center.className = "radial-center-hole";
  elements.radialMenu.append(svg, labels, center);
  updateRadialSelection(state.radial.lastX, state.radial.lastY);
}

function updateRadialSelection(x, y) {
  const dx = x - state.radial.startX;
  const dy = y - state.radial.startY;
  const items = state.radial.items || [];
  if (Math.hypot(dx, dy) < RADIAL_SELECT_DISTANCE) {
    state.radial.selected = null;
  } else if (items.length) {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const step = 360 / items.length;
    const index = Math.floor(((angle - (-90 - step / 2) + 360) % 360) / step);
    state.radial.selected = items[index]?.id || null;
  }
  elements.radialMenu.querySelectorAll(".radial-segment, .radial-label").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.radialId === state.radial.selected);
  });
}

function radialMenuItems() {
  if (state.activeView === "home") {
    return [
      { id: "view:updates", label: t("discoverNav") },
      { id: "view:guide", label: t("pictureBook") },
      { id: "view:collection", label: t("collectionNav") },
      { id: "view:me", label: t("myNav") },
    ];
  }
  if (COLLECTION_TYPES.includes(state.activeView)) {
    return [
      { id: "collection:wanted", label: t("wantedList") },
      { id: "collection:owned", label: t("ownedList") },
    ];
  }
  if (state.activeView === "guide") {
    return [
      { id: "guide:gundam", label: t("guideTabGundam") },
      { id: "guide:bbx", label: t("guideTabBbx") },
      { id: "guide:parts", label: t("guideTabParts") },
    ];
  }
  const franchises = state.activeView === "pbandai" ? pbandaiFranchises() : FRANCHISES;
  return franchises.map((franchise) => ({ id: `franchise:${franchise}`, label: franchiseShortLabel(franchise) }));
}

function activateRadialSelection(id) {
  const [type, value] = String(id).split(":");
  if (type === "view") {
    if (value === "me") {
      openUserPage();
      return;
    }
    switchToView(value === "collection" ? (COLLECTION_TYPES.includes(state.lastCollectionTab) ? state.lastCollectionTab : "wanted") : value);
  } else if (type === "collection") {
    switchToView(value);
  } else if (type === "guide") {
    openGuide(value);
  } else if (type === "franchise") {
    selectFranchiseForActiveView(value);
  }
}

function selectFranchiseForActiveView(franchise) {
  if (!FRANCHISES.includes(franchise)) return;
  if (state.activeView === "catalog") {
    openFranchiseCatalog(franchise);
  } else if (state.activeView === "pbandai") {
    navigateToPBandai(franchise);
  } else {
    state.franchise = franchise;
    localStorage.setItem(FRANCHISE_KEY, state.franchise);
    render();
    persistViewState({ mode: "push" });
  }
}

function startPagerGesture(deltaX) {
  const target = adjacentFranchise(deltaX < 0 ? 1 : -1);
  if (!target || !elements.pagerPreview) {
    return;
  }
  state.pager.active = true;
  state.pager.target = target;
  state.pager.suppressClick = true;
  cancelRadialPress();
  document.body.classList.add("is-paging");
  showPagerPreview(target);
}

function updatePagerGesture(deltaX) {
  if (!state.pager.active || !elements.pagerPreview) {
    return;
  }
  const width = window.innerWidth || 1;
  const clamped = Math.max(-width, Math.min(width, deltaX));
  const target = adjacentFranchise(clamped < 0 ? 1 : -1);
  if (target && target !== state.pager.target) {
    state.pager.target = target;
    showPagerPreview(target);
  }
  state.pager.deltaX = clamped;
  document.body.style.setProperty("--pager-drag-x", `${clamped}px`);
  const previewX = clamped < 0 ? width + clamped : -width + clamped;
  elements.pagerPreview.style.transform = `translateX(${previewX}px)`;
}

function finishPagerGesture(event, touch) {
  const deltaX = touch.clientX - state.pager.startX;
  updatePagerGesture(deltaX);
  const width = window.innerWidth || 1;
  const threshold = Math.max(PAGER_MIN_THRESHOLD, width * PAGER_THRESHOLD_RATIO);
  const target = state.pager.target;
  const shouldSwitch = target && Math.abs(state.pager.deltaX) >= threshold;
  state.pager.settling = true;
  document.body.classList.add("is-pager-settling");
  if (shouldSwitch) {
    document.body.style.setProperty("--pager-drag-x", `${state.pager.deltaX < 0 ? -width : width}px`);
    elements.pagerPreview.style.transform = "translateX(0)";
  } else {
    document.body.style.setProperty("--pager-drag-x", "0px");
    const previewX = state.pager.deltaX < 0 ? width : -width;
    elements.pagerPreview.style.transform = `translateX(${previewX}px)`;
  }
  window.setTimeout(() => {
    const next = shouldSwitch ? target : null;
    resetPagerGesture(true);
    if (next) {
      openFranchiseCatalog(next);
    }
  }, PAGER_ANIMATION_MS);
  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
}

function resetPagerGesture(force = false) {
  if (state.pager.settling && !force) {
    return;
  }
  document.body.classList.remove("is-paging", "is-pager-settling");
  document.body.style.removeProperty("--pager-drag-x");
  if (elements.pagerPreview) {
    elements.pagerPreview.hidden = true;
    elements.pagerPreview.innerHTML = "";
    elements.pagerPreview.style.transform = "";
  }
  state.pager.active = false;
  state.pager.settling = false;
  state.pager.touchId = null;
  state.pager.target = null;
  state.pager.deltaX = 0;
  state.pager.blockedByTarget = false;
}

function adjacentFranchise(offset) {
  const index = FRANCHISES.indexOf(state.franchise);
  if (index < 0) {
    return null;
  }
  return FRANCHISES[(index + offset + FRANCHISES.length) % FRANCHISES.length];
}

function kitCountsByFranchise() {
  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.franchise, (counts.get(kit.franchise) || 0) + 1);
  }
  return counts;
}

function showPagerPreview(franchise) {
  elements.pagerPreview.hidden = false;
  elements.pagerPreview.innerHTML = "";
  const counts = kitCountsByFranchise();
  const card = document.createElement("div");
  card.className = "pager-preview-card";
  const media = document.createElement("div");
  media.className = "pager-preview-media";
  for (const kit of homeImageKits(franchise).slice(0, 3)) {
    const slot = document.createElement("span");
    appendImageWithFallback(slot, kit, { alt: kitDisplayName(kit) });
    media.append(slot);
  }
  if (!media.children.length) {
    const fallback = document.createElement("span");
    fallback.className = "pager-preview-fallback";
    fallback.textContent = franchiseShortLabel(franchise);
    media.append(fallback);
  }
  const body = document.createElement("div");
  body.className = "pager-preview-body";
  body.innerHTML = `<span>${escapeHtml(t("franchise"))}</span><strong>${escapeHtml(franchiseLabel(franchise))}</strong><em>${escapeHtml(t("records", { count: counts.get(franchise) || 0 }))}</em>`;
  card.append(media, body);
  elements.pagerPreview.append(card);
}

function donutSegmentPath(cx, cy, outerRadius, innerRadius, startDeg, endDeg) {
  const point = (radius, deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius];
  };
  const [outerStartX, outerStartY] = point(outerRadius, startDeg);
  const [outerEndX, outerEndY] = point(outerRadius, endDeg);
  const [innerEndX, innerEndY] = point(innerRadius, endDeg);
  const [innerStartX, innerStartY] = point(innerRadius, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}`,
    "Z",
  ].join(" ");
}

function bindCollectionPanelNavigation(panel, type) {
  panel.addEventListener("click", (event) => {
    if (state.activeView !== "catalog" || event.target.closest(".collection-item, .collection-collapse")) {
      return;
    }
    navigateToCollectionView(type);
  });
  panel.addEventListener("keydown", (event) => {
    if (state.activeView !== "catalog" || event.target !== panel || !["Enter", " "].includes(event.key)) {
      return;
    }
    event.preventDefault();
    navigateToCollectionView(type);
  });
}

function navigateToCollectionView(type) {
  if (!COLLECTION_TYPES.includes(type)) {
    return;
  }
  state.activeView = type;
  state.query = "";
  state.selectedKit = null;
  state.activeModal = null;
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  persistViewState({ mode: "push" });
  render();
  maybeShowUpdateNotification();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleHomeCollectionCollapsed(type) {
  if (!COLLECTION_TYPES.includes(type)) {
    return;
  }
  state.homeCollectionCollapsed[type] = !state.homeCollectionCollapsed[type];
  saveHomeCollectionCollapsed();
  renderCollections();
}

function registerPwa() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(new URL("../sw.js", window.location.href), { scope: "../" }).catch(() => {});
    });
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    renderSettings();
  });
}

async function installPwa() {
  if (!state.installPrompt) {
    return;
  }
  const promptEvent = state.installPrompt;
  state.installPrompt = null;
  await promptEvent.prompt();
  renderSettings();
}

async function refreshAppCache() {
  elements.refreshAppCache.disabled = true;
  elements.refreshAppStatus.textContent = t("refreshAppBusy");

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("gunpula-")).map((key) => caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.filter((registration) => window.location.href.startsWith(registration.scope)).map((registration) => registration.unregister()));
    }
    elements.refreshAppStatus.textContent = t("refreshAppDone");
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("app-refresh", Date.now().toString());
    window.location.replace(nextUrl.href);
  } catch {
    elements.refreshAppCache.disabled = false;
    elements.refreshAppStatus.textContent = t("refreshAppError");
  }
}

function latestUpdateEntry() {
  return updateFeedEntries()[0] || null;
}

function updateNotificationSignature(entry = latestUpdateEntry()) {
  if (!entry) {
    return "";
  }
  return [entry.date, entry.added_count || 0, entry.changed_count || 0, entry.removed_count || 0, entry.watched_count || 0, entry.premium_bandai_count || 0].join(":");
}

function renderUpdateNotificationStatus() {
  if (!elements.updateNotificationStatus) {
    return;
  }
  if (!("Notification" in window)) {
    elements.updateNotificationStatus.textContent = t("notificationUnsupported");
  } else if (Notification.permission === "denied") {
    elements.updateNotificationStatus.textContent = t("notificationDenied");
  } else if (state.updateNotifications && Notification.permission === "granted") {
    elements.updateNotificationStatus.textContent = t("notificationEnabled");
  } else {
    elements.updateNotificationStatus.textContent = t("notificationDisabled");
  }
}

function renderNotificationRules() {
  if (!elements.notificationRules) {
    return;
  }
  const options = [
    ["premium_bandai", t("notifyPremiumBandai")],
    ["seed_00", t("notifySeed00")],
    ["bbx", t("notifyBbx")],
    ["gundam", t("notifyGundam")],
    ["armored_core", t("notifyAc")],
    ["pokemon", t("notifyPokemon")],
    ["fate", t("notifyFate")],
  ];
  elements.notificationRules.innerHTML = `<strong>${escapeHtml(t("notificationRules"))}</strong>`;
  for (const [key, label] of options) {
    const item = document.createElement("label");
    item.className = "mini-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.updateNotificationFilters[key] !== false;
    input.addEventListener("change", () => {
      state.updateNotificationFilters[key] = input.checked;
      saveUpdateNotificationFilters();
      maybeShowUpdateNotification();
    });
    item.append(document.createTextNode(label), input);
    elements.notificationRules.append(item);
  }
}

async function toggleUpdateNotifications(event) {
  const wantsEnabled = event.target.checked;
  if (!("Notification" in window)) {
    state.updateNotifications = false;
    localStorage.setItem(UPDATE_NOTIFICATION_KEY, "false");
    renderSettings();
    return;
  }

  if (wantsEnabled && Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      state.updateNotifications = false;
      localStorage.setItem(UPDATE_NOTIFICATION_KEY, "false");
      renderSettings();
      return;
    }
  }

  state.updateNotifications = wantsEnabled;
  localStorage.setItem(UPDATE_NOTIFICATION_KEY, String(state.updateNotifications));
  renderSettings();
  registerUpdatePeriodicSync();
  maybeShowUpdateNotification();
}

function updateEntryInterestTags(entry) {
  const itemTags = [...(entry.added || []), ...(entry.changed || [])].flatMap((item) => item.interest_tags || []);
  const tags = new Set([...(entry.interest_tags || []), ...itemTags]);
  if ((entry.premium_bandai_count || 0) > 0) tags.add("premium_bandai");
  if ((entry.bbx_count || 0) > 0) tags.add("bbx");
  if ((entry.watched_count || 0) > 0 || (entry.watch_tags || []).length) tags.add("seed_00");
  for (const item of [...(entry.added || []), ...(entry.changed || [])]) {
    if (item.franchise && DEFAULT_NOTIFICATION_FILTERS[item.franchise] !== undefined) {
      tags.add(item.franchise);
    }
  }
  return tags;
}

function updateEntryMatchesNotificationFilters(entry) {
  const tags = updateEntryInterestTags(entry);
  const filters = state.updateNotificationFilters;
  return (
    (filters.premium_bandai && tags.has("premium_bandai")) ||
    (filters.seed_00 && (tags.has("seed_00") || tags.has("seed") || tags.has("00"))) ||
    (filters.bbx && (tags.has("bbx") || tags.has("beyblade"))) ||
    (filters.gundam && tags.has("gundam")) ||
    (filters.armored_core && tags.has("armored_core")) ||
    (filters.pokemon && tags.has("pokemon")) ||
    (filters.fate && tags.has("fate"))
  );
}

function entryHasPriorityInterest(entry) {
  const tags = updateEntryInterestTags(entry);
  return tags.has("premium_bandai") || tags.has("bbx") || tags.has("beyblade");
}

async function maybeShowUpdateNotification() {
  const entry = latestUpdateEntry();
  if (!state.updateNotifications || !entry || updateEntryTotal(entry) <= 0 || !updateEntryMatchesNotificationFilters(entry) || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const signature = updateNotificationSignature(entry);
  if (!signature || localStorage.getItem(UPDATE_NOTIFICATION_LAST_KEY) === signature) {
    return;
  }

  const watched = Number(entry.watched_count || 0);
  const title = watched > 0 ? t("notificationSeedTitle") : entryHasPriorityInterest(entry) ? t("notificationPriorityTitle") : t("notificationUpdateTitle");
  const body = t("notificationUpdateBody", {
    date: entry.date,
    added: entry.added_count || 0,
    changed: entry.changed_count || 0,
  });
  const options = {
    body,
    tag: `gunpula-update-${entry.date}`,
    icon: new URL("./icons/icon-192.png", window.location.href).href,
    badge: new URL("./icons/icon-192.png", window.location.href).href,
    data: { url: new URL("./", window.location.href).href },
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    localStorage.setItem(UPDATE_NOTIFICATION_LAST_KEY, signature);
  } catch {
    localStorage.setItem(UPDATE_NOTIFICATION_LAST_KEY, signature);
  }
}

function syncConfigComplete(config = state.syncConfig) {
  return Boolean(config.supabaseUrl && config.anonKey && config.workspaceId && config.workspaceSecret);
}

// v2 sync = signed-in account against the configured backend.
// Legacy v1 (manual keys) keeps working until the user migrates.
function syncModeV2() {
  return authConfigured() && isSignedIn();
}

function syncActive() {
  return syncModeV2() || syncConfigComplete();
}

function cleanSupabaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function memberName() {
  return state.syncConfig.memberName.trim() || "member";
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function syncAccessHash() {
  const secret = state.syncConfig.editorSecret || state.syncConfig.workspaceSecret;
  return sha256Hex(`${state.syncConfig.workspaceId}:${secret}`);
}

async function syncReadHash() {
  return sha256Hex(`${state.syncConfig.workspaceId}:${state.syncConfig.workspaceSecret}`);
}

async function syncEditHash() {
  const secret = state.syncConfig.editorSecret || state.syncConfig.workspaceSecret;
  return sha256Hex(`${state.syncConfig.workspaceId}:${secret}`);
}

function setSyncStatus(status, message = "") {
  state.sync.status = status;
  state.sync.message = message;
  renderSyncStatus();
}

async function supabaseRpc(functionName, body) {
  const baseUrl = cleanSupabaseUrl(state.syncConfig.supabaseUrl);
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: state.syncConfig.anonKey,
      Authorization: `Bearer ${state.syncConfig.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || response.statusText || t("syncError");
    throw new Error(message.includes("gunpula") ? message : `${message}. ${t("cloudSetupMissing")}`);
  }
  return data;
}

async function supabaseRpcV2(functionName, body = {}) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error(t("accountSessionExpired"));
  }
  const { url, anonKey } = authBackend();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || response.statusText || t("syncError");
    throw new Error(message);
  }
  return data;
}

function cloudPayload() {
  return {
    schema_version: 1,
    collection: normalizeCollection(state.collection),
    overrides: state.overrides,
    series_label_overrides: state.seriesLabelOverrides,
    appearance: {
      theme: state.theme,
      app_icon: state.appIcon,
      home_covers: normalizeHomeCovers(state.homeCovers),
    },
  };
}

function timestampMs(...values) {
  return storeTimestampMs(...values);
}

function newerByTimestamp(left, right, fields = ["updated_at"]) {
  return storeNewerByTimestamp(left, right, fields);
}

function mergeCollectionState(localCollection, remoteCollection) {
  return storeMergeCollectionState(localCollection, remoteCollection, collectionStoreOptions());
}

function mergeTimestampedMap(localMap = {}, remoteMap = {}) {
  return storeMergeTimestampedMap(localMap, remoteMap);
}

function mergeCloudPayload(localPayload, remotePayload = {}) {
  return {
    ...remotePayload,
    collection: mergeCollectionState(localPayload.collection, remotePayload.collection),
    overrides: mergeTimestampedMap(localPayload.overrides, remotePayload.overrides),
    series_label_overrides: {
      ...(remotePayload.series_label_overrides || {}),
      ...(localPayload.series_label_overrides || {}),
    },
  };
}

function normalizeCloudState(result) {
  if (!result) {
    return null;
  }
  const stateObject = Array.isArray(result) ? result[0] : result;
  if (!stateObject) {
    return null;
  }
  return {
    payload: stateObject.payload || {},
    revision: Number(stateObject.revision || 0),
    updatedAt: stateObject.updated_at || stateObject.updatedAt || null,
    updatedBy: stateObject.updated_by || stateObject.updatedBy || null,
    canEdit: Boolean(stateObject.can_edit ?? stateObject.canEdit),
    workspace: stateObject.workspace_name
      ? {
          id: stateObject.workspace_id || "",
          name: stateObject.workspace_name || "",
          inviteCode: stateObject.invite_code || "",
          role: stateObject.role || "",
          members: Array.isArray(stateObject.members) ? stateObject.members : [],
        }
      : null,
  };
}

async function readRemoteState() {
  if (syncModeV2()) {
    const result = await supabaseRpcV2("gunpula_v2_get_state");
    return normalizeCloudState(result);
  }
  const result = await supabaseRpc("gunpula_get_state", {
    p_workspace_id: state.syncConfig.workspaceId.trim(),
    p_access_hash: await syncAccessHash(),
  });
  return normalizeCloudState(result);
}

async function writeRemoteState(reason = "manual") {
  if (!syncActive() || state.sync.inFlight) {
    return;
  }
  if (syncModeV2() && !state.sync.workspace) {
    setSyncStatus("noworkspace", t("syncNoWorkspace"));
    return;
  }
  state.sync.inFlight = true;
  setSyncStatus("saving", t("syncSaving"));
  try {
    const result = syncModeV2()
      ? await supabaseRpcV2("gunpula_v2_save_state", {
          p_payload: cloudPayload(),
          p_base_revision: state.syncMeta.revision || 0,
          p_reason: reason,
        })
      : await supabaseRpc("gunpula_save_state", {
          p_workspace_id: state.syncConfig.workspaceId.trim(),
          p_read_hash: await syncReadHash(),
          p_edit_hash: await syncEditHash(),
          p_member_name: memberName(),
          p_payload: cloudPayload(),
          p_base_revision: state.syncMeta.revision || 0,
          p_reason: reason,
        });
    const remote = normalizeCloudState(result);
    applyRemoteState(remote, { skipSave: true });
    setSyncStatus(state.sync.canEdit ? "connected" : "readonly", t("syncSaved"));
  } catch (error) {
    setSyncStatus("error", error.message);
  } finally {
    state.sync.inFlight = false;
  }
}

function scheduleCloudSave(reason) {
  if (state.sync.suppress || !syncActive()) {
    return;
  }
  if (!state.sync.canEdit) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  clearTimeout(state.sync.saveTimer);
  state.sync.saveTimer = setTimeout(() => {
    writeRemoteState(reason);
  }, SYNC_SAVE_DEBOUNCE_MS);
}

async function connectSync(options = {}) {
  if (!syncActive()) {
    state.sync.enabled = false;
    state.sync.canEdit = true;
    setSyncStatus("local", t("syncLocal"));
    return;
  }
  state.sync.enabled = true;
  setSyncStatus("connecting", t("syncConnecting"));
  clearInterval(state.sync.timer);
  try {
    const remote = await readRemoteState();
    if (remote) {
      applyRemoteState(remote);
      setSyncStatus(remote.canEdit ? "connected" : "readonly", remote.canEdit ? t("syncConnected") : t("syncReadOnly"));
    } else if (syncModeV2()) {
      state.sync.canEdit = true;
      state.sync.workspace = null;
      setSyncStatus("noworkspace", t("syncNoWorkspace"));
    } else {
      state.sync.canEdit = true;
      await writeRemoteState("create-workspace");
    }
    state.sync.timer = setInterval(() => pullSync({ silent: true }), SYNC_POLL_INTERVAL_MS);
  } catch (error) {
    if (!options.silent) {
      setSyncStatus("error", error.message);
    } else {
      state.sync.status = "error";
      state.sync.message = error.message;
    }
  }
}

async function pullSync(options = {}) {
  if (!syncActive()) {
    setSyncStatus("local", t("syncLocal"));
    return;
  }
  if (!options.silent) {
    setSyncStatus("connecting", t("syncConnecting"));
  }
  try {
    const remote = await readRemoteState();
    if (!remote) {
      if (syncModeV2()) {
        state.sync.workspace = null;
        setSyncStatus("noworkspace", t("syncNoWorkspace"));
        return;
      }
      await writeRemoteState("create-workspace");
      return;
    }
    if (options.force || remote.revision !== state.syncMeta.revision) {
      applyRemoteState(remote);
    }
    setSyncStatus(remote.canEdit ? "connected" : "readonly", remote.canEdit ? t("syncConnected") : t("syncReadOnly"));
  } catch (error) {
    setSyncStatus("error", error.message);
  }
}

function applyRemoteState(remote, options = {}) {
  if (!remote) {
    return;
  }
  const localPayload = cloudPayload();
  const payload = options.skipSave ? remote.payload || {} : mergeCloudPayload(localPayload, remote.payload || {});
  const shouldPushMerged = !options.skipSave && JSON.stringify(payload) !== JSON.stringify(remote.payload || {});
  if (!options.skipHistory && remote.revision !== state.syncMeta.revision) {
    recordSyncHistory("before-remote-apply", remote);
  }
  state.sync.suppress = true;
  state.collection = normalizeCollection(payload.collection || {});
  state.overrides = payload.overrides && typeof payload.overrides === "object" ? payload.overrides : {};
  state.seriesLabelOverrides =
    payload.series_label_overrides && typeof payload.series_label_overrides === "object"
      ? payload.series_label_overrides
      : {};
  if (payload.appearance && typeof payload.appearance === "object") {
    const nextTheme = payload.appearance.theme;
    if (THEMES.some((theme) => theme.code === nextTheme)) {
      state.theme = nextTheme;
    }
    state.appIcon = String(payload.appearance.app_icon || "");
    state.homeCovers = normalizeHomeCovers(payload.appearance.home_covers);
    saveAppearance({ skipSync: true });
  }
  state.syncMeta = {
    revision: remote.revision,
    updatedAt: remote.updatedAt,
    updatedBy: remote.updatedBy,
  };
  state.sync.canEdit = remote.canEdit;
  state.sync.workspace = remote.workspace || null;
  saveCollection({ skipSync: true });
  saveOverrides({ skipSync: true });
  saveSeriesLabelOverrides({ skipSync: true });
  saveSyncMeta();
  refreshKits();
  state.sync.suppress = false;
  if (!options.skipSave) {
    render();
    if (state.selectedKit && elements.detailDialog.open) {
      state.selectedKit = displayKitById(state.selectedKit.kit_id);
      renderDetail(state.selectedKit);
    }
  }
  if (shouldPushMerged && state.sync.canEdit) {
    scheduleCloudSave("merge-remote");
  }
}

function saveAndConnectSync() {
  state.syncConfig = {
    supabaseUrl: cleanSupabaseUrl(elements.syncSupabaseUrl.value),
    anonKey: elements.syncAnonKey.value.trim(),
    workspaceId: elements.syncWorkspaceId.value.trim(),
    workspaceSecret: elements.syncWorkspaceSecret.value,
    editorSecret: elements.syncEditorSecret.value,
    memberName: elements.syncMemberName.value.trim(),
  };
  saveSyncConfig();
  connectSync();
  renderSettings();
}

function disconnectSync() {
  clearInterval(state.sync.timer);
  clearTimeout(state.sync.saveTimer);
  state.syncConfig = { supabaseUrl: "", anonKey: "", workspaceId: "", workspaceSecret: "", editorSecret: "", memberName: "" };
  state.syncMeta = { revision: 0, updatedAt: null, updatedBy: null };
  state.sync.enabled = false;
  state.sync.canEdit = true;
  saveSyncConfig();
  saveSyncMeta();
  setSyncStatus("local", t("syncLocal"));
  render();
}

function canEditSharedData() {
  return !syncActive() || state.sync.canEdit;
}

function accountDisplayName() {
  return state.syncConfig.memberName?.trim() || currentUserEmail().split("@")[0] || "";
}

function selfWorkspaceMember() {
  return (state.sync.workspace?.members || []).find((member) => member.is_self) || null;
}

function currentWorkspaceMemberName() {
  return selfWorkspaceMember()?.name || accountDisplayName();
}

async function accountSendCode() {
  const email = elements.accountEmail.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    elements.accountHint.textContent = t("accountEmailInvalid");
    return;
  }
  elements.accountSendCode.disabled = true;
  elements.accountHint.textContent = t("accountSending");
  try {
    await requestEmailCode(email);
    elements.accountCodeRow.hidden = false;
    elements.accountHint.textContent = t("accountCodeSent");
    elements.accountCode.focus();
  } catch (error) {
    elements.accountHint.textContent = error.message;
  } finally {
    elements.accountSendCode.disabled = false;
  }
}

async function accountVerifyCode() {
  const email = elements.accountEmail.value.trim();
  const code = elements.accountCode.value.trim();
  if (!code) {
    elements.accountHint.textContent = t("accountCodeInvalid");
    return;
  }
  elements.accountVerify.disabled = true;
  try {
    await verifyEmailCode(email, code);
    elements.accountCode.value = "";
    elements.accountCodeRow.hidden = true;
    await connectSync();
    renderSettings();
  } catch (error) {
    elements.accountHint.textContent = error.message;
  } finally {
    elements.accountVerify.disabled = false;
  }
}

function confirmAndSignOut() {
  if (!window.confirm(t("signOutConfirm"))) {
    return;
  }
  accountSignOutNow();
}

function accountSignOutNow() {
  signOut();
  clearInterval(state.sync.timer);
  clearTimeout(state.sync.saveTimer);
  state.sync.workspace = null;
  state.syncMeta = { revision: 0, updatedAt: null, updatedBy: null };
  saveSyncMeta();
  if (syncConfigComplete()) {
    connectSync({ silent: true });
  } else {
    state.sync.enabled = false;
    state.sync.canEdit = true;
    setSyncStatus("local", t("syncLocal"));
  }
  renderSettings();
}

function renameCollectionMember(oldName, newName) {
  const from = safeMemberName(oldName);
  const to = safeMemberName(newName);
  if (!from || !to || from === to) {
    return false;
  }
  state.collection = normalizeCollection(state.collection);
  const memberItems = state.collection.member_items || {};
  if (!memberItems[from]) {
    return false;
  }
  memberItems[to] = { ...(memberItems[from] || {}), ...(memberItems[to] || {}) };
  delete memberItems[from];
  if (state.collectionMemberView === from) {
    state.collectionMemberView = to;
    localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
  }
  refreshLegacyCollectionItems();
  return true;
}

async function saveMemberDisplayNameNow() {
  const input = elements.memberDisplayNameInput;
  if (!input) {
    return;
  }
  const nextName = input.value.trim();
  if (!nextName) {
    input.focus();
    return;
  }
  await saveMemberDisplayNameValue(nextName, elements.saveMemberDisplayName);
}

async function workspaceLeaveNow() {
  if (!syncModeV2() || !state.sync.workspace) {
    return;
  }
  if (!window.confirm(t("workspaceLeaveConfirm"))) {
    return;
  }
  elements.workspaceLeave.disabled = true;
  try {
    await supabaseRpcV2("gunpula_v2_leave_workspace");
    clearInterval(state.sync.timer);
    clearTimeout(state.sync.saveTimer);
    state.sync.workspace = null;
    state.sync.enabled = true;
    state.sync.canEdit = true;
    state.syncMeta = { revision: 0, updatedAt: null, updatedBy: null };
    saveSyncMeta();
    setSyncStatus("noworkspace", t("workspaceLeft"));
    render();
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    elements.workspaceLeave.disabled = false;
  }
}

async function workspaceCreateNow() {
  elements.workspaceCreate.disabled = true;
  try {
    const result = await supabaseRpcV2("gunpula_v2_create_workspace", {
      p_name: "",
      p_display_name: accountDisplayName(),
    });
    const remote = normalizeCloudState(result);
    state.sync.workspace = remote.workspace;
    state.sync.canEdit = true;
    state.sync.enabled = true;
    state.syncMeta = { revision: remote.revision, updatedAt: remote.updatedAt, updatedBy: remote.updatedBy };
    saveSyncMeta();
    // The fresh workspace is empty; push this device's data up as revision 1.
    await writeRemoteState("create-workspace");
    clearInterval(state.sync.timer);
    state.sync.timer = setInterval(() => pullSync({ silent: true }), SYNC_POLL_INTERVAL_MS);
    renderSettings();
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    elements.workspaceCreate.disabled = false;
  }
}

async function workspaceJoinNow() {
  const code = elements.workspaceInviteInput.value.trim();
  if (!code) {
    return;
  }
  elements.workspaceJoin.disabled = true;
  try {
    const result = await supabaseRpcV2("gunpula_v2_join_workspace", {
      p_invite_code: code,
      p_display_name: accountDisplayName(),
    });
    recordSyncHistory("before-join-workspace", { revision: state.syncMeta.revision });
    applyRemoteState(normalizeCloudState(result));
    state.sync.enabled = true;
    setSyncStatus(state.sync.canEdit ? "connected" : "readonly", t("syncConnected"));
    clearInterval(state.sync.timer);
    state.sync.timer = setInterval(() => pullSync({ silent: true }), SYNC_POLL_INTERVAL_MS);
    elements.workspaceInviteInput.value = "";
    renderSettings();
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    elements.workspaceJoin.disabled = false;
  }
}

async function migrateFromV1Now() {
  if (!syncConfigComplete() || !syncModeV2()) {
    return;
  }
  elements.migrateV1.disabled = true;
  try {
    const result = await supabaseRpcV2("gunpula_v2_migrate_from_v1", {
      p_workspace_id: state.syncConfig.workspaceId.trim(),
      p_access_hash: await syncAccessHash(),
    });
    applyRemoteState(normalizeCloudState(result));
    setSyncStatus("connected", t("migrateV1Done"));
    renderSettings();
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    elements.migrateV1.disabled = false;
  }
}

async function copyInviteCode() {
  const code = state.sync.workspace?.inviteCode || "";
  if (!code) {
    return;
  }
  try {
    await navigator.clipboard.writeText(code);
    elements.workspaceCopyInvite.textContent = t("workspaceCopied");
    setTimeout(() => {
      elements.workspaceCopyInvite.textContent = t("workspaceCopy");
    }, 1600);
  } catch {
    // Clipboard unavailable (http/no permission): the code stays visible to copy by hand.
  }
}

// Local backup: the same payload the cloud sync stores, saved as a file the
// user keeps. Restoring overwrites local data (after confirmation) and then
// propagates through the normal save/sync path.
function exportCollectionBackup() {
  const githubToken = localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  const payload = {
    exported_at: new Date().toISOString(),
    app: APP_VERSION_LABEL,
    ...cloudPayload(),
    // Carried so a restore on a fresh install brings the data-fetch token back
    // instead of forcing the user to paste it again.
    ...(githubToken ? { github_token: githubToken } : {}),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gunpula-backup-${localDateKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  if (elements.backupStatus) {
    elements.backupStatus.textContent = t("backupExported", {
      owned: collectionIds("owned").length,
      wanted: collectionIds("wanted").length,
    });
  }
}

async function importCollectionBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || typeof payload !== "object" || !payload.collection || typeof payload.collection !== "object") {
      throw new Error("invalid backup");
    }
    // Hand-edited files may carry malformed entries; owned/wanted are kit-id strings.
    const collection = normalizeCollection({
      ...payload.collection,
      owned: (Array.isArray(payload.collection.owned) ? payload.collection.owned : []).filter((id) => typeof id === "string"),
      wanted: (Array.isArray(payload.collection.wanted) ? payload.collection.wanted : []).filter((id) => typeof id === "string"),
    });
    const confirmed = window.confirm(
      t("backupImportConfirm", { owned: collection.owned.length, wanted: collection.wanted.length }),
    );
    if (!confirmed) {
      return;
    }
    recordSyncHistory("before-backup-import");
    state.collection = collection;
    if (payload.overrides && typeof payload.overrides === "object") {
      state.overrides = payload.overrides;
    }
    if (payload.series_label_overrides && typeof payload.series_label_overrides === "object") {
      state.seriesLabelOverrides = payload.series_label_overrides;
    }
    if (payload.appearance && typeof payload.appearance === "object") {
      const nextTheme = payload.appearance.theme;
      if (THEMES.some((theme) => theme.code === nextTheme)) {
        state.theme = nextTheme;
      }
      state.appIcon = String(payload.appearance.app_icon || "");
      state.homeCovers = normalizeHomeCovers(payload.appearance.home_covers);
      saveAppearance();
    }
    if (typeof payload.github_token === "string" && payload.github_token) {
      localStorage.setItem(GITHUB_TOKEN_KEY, payload.github_token);
      if (elements.githubTokenInput) elements.githubTokenInput.value = payload.github_token;
    }
    saveCollection();
    saveOverrides();
    saveSeriesLabelOverrides();
    refreshKits();
    render();
    if (elements.backupStatus) {
      elements.backupStatus.textContent = t("backupImported", {
        owned: collection.owned.length,
        wanted: collection.wanted.length,
      });
    }
  } catch {
    if (elements.backupStatus) {
      elements.backupStatus.textContent = t("backupInvalid");
    }
  }
}

function t(key, params = {}) {
  const template = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
}

function translateStaticText() {
  document.documentElement.lang = LANGUAGES.find((language) => language.code === state.language)?.htmlLang ?? "zh-CN";
  document.body.dataset.view = state.activeView;
  document.body.dataset.theme = state.theme;
  document.body.dataset.franchise = state.franchise;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });
  enhanceHelpButtons();
}

function helpTextFor(node) {
  if (!node) return "";
  if (node.dataset.help) return node.dataset.help;
  const keyed = node.querySelector("[data-i18n]");
  if (keyed?.dataset.i18n && HELP_TEXT[keyed.dataset.i18n]) return localizedHelpText(HELP_TEXT[keyed.dataset.i18n]);
  return localizedHelpText(HELP_TEXT[node.id] || HELP_TEXT[node.dataset.settingsPanel] || "");
}

function localizedHelpText(value) {
  if (!value) return "";
  if (typeof value === "string") {
    if (state.language === "zh") return value;
    const fallback = {
      ko: "이 영역은 현재 화면의 관리 기능입니다. 항목을 눌러 내용을 확인하고, 변경 가능한 정보는 공유 공간에 동기화됩니다.",
      en: "This area controls the current feature. Tap an item to inspect it; editable changes sync to the shared workspace when enabled.",
      ja: "このエリアは現在の機能を管理します。項目をタップして確認し、編集できる内容は共有スペースに同期されます。",
    };
    return fallback[state.language] || value;
  }
  return value[state.language] || value.zh || value.en || "";
}

function enhanceHelpButtons() {
  document.querySelectorAll(".help-button").forEach((button) => button.remove());
  const selectors = [
    ".home-section",
    ".updates-section",
    ".pbandai-section",
    ".collection-section",
    ".kit-section",
    ".settings-section",
    ".settings-dialog",
    "#guideDialog",
  ].join(",");
  for (const section of document.querySelectorAll(selectors)) {
    const text = helpTextFor(section);
    if (!text) continue;
    const anchor =
      section.querySelector(":scope > .home-hero h1") ||
      section.querySelector(":scope > .home-section-head h2, :scope > .section-title h2, :scope > .settings-section-head h3, :scope > h3, :scope > h2") ||
      section.querySelector("h1, h2, h3");
    if (!anchor || anchor.querySelector(".help-button")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "help-button";
    button.textContent = "?";
    button.setAttribute("aria-label", "说明");
    button.title = text;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      window.alert(text);
    });
    anchor.append(" ", button);
  }
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

function populateCorrectionSeriesSelect(franchise, selectedKey) {
  const entries = seriesEntriesForFranchise(franchise);
  elements.editSeriesKey.innerHTML = "";
  for (const [key, entry] of entries) {
    elements.editSeriesKey.append(makeOption(key, `${seriesLabelFromKey(key)} (${entry.count})`));
  }
  if (selectedKey && !entries.some(([key]) => key === selectedKey)) {
    elements.editSeriesKey.prepend(makeOption(selectedKey, seriesLabelFromKey(selectedKey)));
  }
  elements.editSeriesKey.value = selectedKey || entries[0]?.[0] || "other";
}

function fillCorrectionForm(kit) {
  const rawKit = normalizeKit(rawKitById(kit.kit_id) || kit);
  const currentSeriesKey = kitSeriesKey(kit);
  populateCorrectionSeriesSelect(kit.franchise, currentSeriesKey);
  elements.editNameZh.value = kit.names?.zh || "";
  elements.editNameKo.value = kit.names?.ko || "";
  elements.editNameEn.value = kit.names?.en || "";
  elements.editNameJa.value = kit.names?.ja || "";
  elements.editGradeCode.value = kit.grade_code;
  elements.editSubline.value = kit.subline || "";
  elements.editSeriesKey.value = currentSeriesKey;
  elements.editUniverse.value = kit.universe || "";
  elements.editCoverImageUrl.value = kit.images?.box_art_url || "";
  elements.clearCorrection.disabled = false;
  elements.correctionForm.dataset.rawNameZh = rawKit.names?.zh || "";
  elements.correctionForm.dataset.rawNameKo = rawKit.names?.ko || "";
  elements.correctionForm.dataset.rawNameEn = rawKit.names?.en || "";
  elements.correctionForm.dataset.rawNameJa = rawKit.names?.ja || "";
  elements.correctionForm.dataset.rawGradeCode = rawKit.grade_code || "";
  elements.correctionForm.dataset.rawSubline = rawKit.subline || "";
  elements.correctionForm.dataset.rawSeriesKey = kitSeriesKey(rawKit);
  elements.correctionForm.dataset.rawUniverse = rawKit.universe || "";
  elements.correctionForm.dataset.rawCoverImageUrl = rawKit.images?.box_art_url || "";
}

function resetCorrectionFormToRaw(kit) {
  const rawKit = normalizeKit(rawKitById(kit.kit_id) || kit);
  populateCorrectionSeriesSelect(rawKit.franchise, kitSeriesKey(rawKit));
  elements.editNameZh.value = rawKit.names?.zh || "";
  elements.editNameKo.value = rawKit.names?.ko || "";
  elements.editNameEn.value = rawKit.names?.en || "";
  elements.editNameJa.value = rawKit.names?.ja || "";
  elements.editGradeCode.value = rawKit.grade_code || "";
  elements.editSubline.value = rawKit.subline || "";
  elements.editSeriesKey.value = kitSeriesKey(rawKit);
  elements.editUniverse.value = rawKit.universe || "";
  elements.editCoverImageUrl.value = rawKit.images?.box_art_url || "";
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
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
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
    series_key: correctionValue(elements.editSeriesKey.value, form.rawSeriesKey),
    universe: correctionValue(elements.editUniverse.value, form.rawUniverse),
    cover_image_url: correctionValue(elements.editCoverImageUrl.value, form.rawCoverImageUrl),
  };

  const nextOverride = { ...(state.overrides[kit.kit_id] || {}) };
  for (const key of CORRECTION_FIELD_KEYS) {
    if (override[key] === undefined) {
      delete nextOverride[key];
    } else {
      nextOverride[key] = override[key];
    }
  }

  if (Object.keys(nextOverride).length) {
    state.overrides[kit.kit_id] = {
      ...nextOverride,
      updated_at: new Date().toISOString(),
    };
  } else {
    delete state.overrides[kit.kit_id];
  }

  saveOverrides();
  refreshAfterOverride(kit.kit_id);
}

function markCurrentVerified() {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  state.overrides[kit.kit_id] = {
    ...(state.overrides[kit.kit_id] || {}),
    data_status: "verified",
    reviewed_at: new Date().toISOString(),
    reviewed_by: memberName(),
    updated_at: new Date().toISOString(),
  };
  saveOverrides();
  refreshAfterOverride(kit.kit_id);
}

function clearCurrentCorrection() {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  if (state.overrides[kit.kit_id]) {
    delete state.overrides[kit.kit_id];
    saveOverrides();
    refreshAfterOverride(kit.kit_id);
    return;
  }

  resetCorrectionFormToRaw(kit);
}

function refreshAfterOverride(kitId) {
  refreshKits();
  const nextKit = displayKitById(kitId);
  state.selectedKit = nextKit;
  renderFranchiseFilters();
  renderGradeFilters();
  renderWorkFilters();
  renderSeriesAdmin();
  renderFilterSummary();
  renderKits();
  if (nextKit && elements.detailDialog.open) {
    renderDetail(nextKit);
  }
  persistViewState();
}

function exportCorrections() {
  const payload = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    overrides: state.overrides,
    series_label_overrides: state.seriesLabelOverrides,
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
  applyAppearance();
  populateGradeSelect();
  elements.searchInput.value = state.query;
  elements.datasetSummary.textContent = datasetSummary();
  renderLanguageControls();
  renderThemeControls();
  renderFranchiseFilters();
  renderSeriesControls();
  renderGradeFilters();
  renderSeriesAdmin();
  renderSettings();
  renderConsoleMode();
  renderBottomNav();
  renderHome();
  renderCollections();
  renderHomeUpdates();
  renderPBandaiProducts();
  renderMarketCenter();
  renderGuidePage();
  renderUpdateLog();
  renderFilterSummary();
  renderKits();
}

function renderCatalogDataChanged() {
  elements.datasetSummary.textContent = datasetSummary();
  renderFranchiseFilters();
  renderSeriesControls();
  renderGradeFilters();
  renderHome();
  renderCollections();
  renderHomeUpdates();
  renderPBandaiProducts();
  renderMarketCenter();
  renderGuidePage();
  renderFilterSummary();
  renderKits();
}

function renderBottomNav() {
  elements.bottomNav.querySelectorAll("button[data-view]").forEach((button) => {
    const userOpen = Boolean(elements.userDialog?.open);
    const isDiscover = button.dataset.view === "updates" && ["updates", "catalog", "pbandai"].includes(state.activeView);
    button.classList.toggle(
      "is-active",
      userOpen
        ? button.dataset.view === "me"
        : button.dataset.view === state.activeView ||
            isDiscover ||
            (button.dataset.view === "collection" && COLLECTION_TYPES.includes(state.activeView)),
    );
  });
}

function applyAppearance() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.franchise = state.franchise;
  // APP_VERSION_LABEL is the single source of truth for the version shown
  // anywhere in the UI; the static strings in index.html/i18n are fallbacks.
  document.title = `Gunpula ${APP_VERSION_LABEL}`;
  document.querySelector('meta[name="application-name"]')?.setAttribute("content", `Gunpula ${APP_VERSION_LABEL}`);
  document.querySelectorAll('[data-i18n="homeTitle"], [data-i18n="appTitle"]').forEach((node) => {
    node.textContent = APP_VERSION_LABEL;
  });
  // Signed-in users see their avatar + name in the top-left chip (tap to open
  // the user page); signed-out keeps the brand mark + version.
  const selfMember = syncModeV2() ? currentMember() : null;
  if (elements.brandVersion) {
    elements.brandVersion.textContent = selfMember ? selfMember.name || currentUserEmail().split("@")[0] : APP_VERSION_LABEL;
  }
  if (elements.brandMark && selfMember) {
    applyAvatarTo(elements.brandMark, selfMember, (selfMember.name || currentUserEmail())[0]);
  }
  if (elements.appVersionLabel) {
    elements.appVersionLabel.textContent = `Gunpula App ${APP_VERSION_LABEL}`;
  }
  if (elements.brandMark && !selfMember) {
    elements.brandMark.innerHTML = "";
    if (state.appIcon) {
      const img = document.createElement("img");
      img.src = state.appIcon;
      img.alt = APP_VERSION_LABEL;
      elements.brandMark.append(img);
    } else {
      elements.brandMark.textContent = "A";
    }
  }
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = state.appIcon || "./icons/icon.svg";
  }
}

function renderThemeControls() {
  if (!elements.themeList) {
    return;
  }
  elements.themeList.innerHTML = "";
  for (const theme of THEMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${state.theme === theme.code ? " is-active" : ""}`;
    button.textContent = theme.label[state.language] || theme.label.en;
    button.addEventListener("click", () => {
      if (!canEditSharedData()) {
        setSyncStatus("readonly", t("readOnlyHint"));
        return;
      }
      state.theme = theme.code;
      saveAppearance();
      renderThemeControls();
      applyAppearance();
    });
    elements.themeList.append(button);
  }
}

function homeMetaKey(franchise) {
  return {
    gundam: "homeGundamMeta",
    armored_core: "homeArmoredCoreMeta",
    pokemon: "homePokemonMeta",
    fate: "homeFateMeta",
    beyblade: "homeBeybladeMeta",
  }[franchise];
}

function homeImageKits(franchise) {
  return state.kits
    .filter((kit) => kit.franchise === franchise && imageCandidatesForKit(kit).length)
    .sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")))
    .slice(0, 4);
}

function openFranchiseCatalog(franchise) {
  state.franchise = franchise;
  state.activeView = "catalog";
  state.grade = "all";
  state.series = "all";
  state.itemType = "all";
  state.releaseYear = "all";
  state.limited = "all";
  state.priceMin = "";
  state.priceMax = "";
  state.selectedKit = null;
  state.activeModal = null;
  localStorage.setItem(FRANCHISE_KEY, state.franchise);
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  render();
  persistViewState({ mode: "push" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectHomeWorld(franchise) {
  if (!FRANCHISES.includes(franchise)) return;
  state.franchise = franchise;
  localStorage.setItem(FRANCHISE_KEY, state.franchise);
  render();
  persistViewState({ mode: "replace" });
}

function openHomeCoverPicker(franchise) {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  state.pendingHomeCoverFranchise = franchise;
  elements.homeCoverInput?.click();
}

function rememberViewedKit(kit) {
  if (!kit?.kit_id) {
    return;
  }
  state.recentViewed = [kit.kit_id, ...state.recentViewed.filter((id) => id !== kit.kit_id)].slice(0, 20);
  saveRecentViewed();
}

function renderHome() {
  if (!elements.homeSection) {
    return;
  }
  elements.homeSection.hidden = state.activeView !== "home";
  if (elements.homeSection.hidden) {
    return;
  }

  const counts = new Map();
  for (const kit of state.kits) {
    counts.set(kit.franchise, (counts.get(kit.franchise) || 0) + 1);
  }
  elements.homeTotal.textContent = t("records", { count: state.kits.length });
  renderWorldSection();
  elements.homeGrid.innerHTML = "";

  for (const franchise of FRANCHISES) {
    const card = document.createElement("article");
    card.tabIndex = 0;
    card.role = "button";
    card.setAttribute("aria-label", franchiseLabel(franchise));
    card.className = `home-card home-card-${franchise.replace("_", "-")}${state.franchise === franchise ? " is-active" : ""}`;
    card.addEventListener("click", (event) => {
      if (event.target.closest(".home-cover-button")) {
        return;
      }
      selectHomeWorld(franchise);
    });
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) {
        return;
      }
      event.preventDefault();
      selectHomeWorld(franchise);
    });

    const media = document.createElement("div");
    media.className = "home-card-media";
    const customCover = state.homeCovers[franchise];
    if (customCover) {
      media.classList.add("is-custom");
      const slot = document.createElement("span");
      slot.className = "home-card-cover";
      const image = document.createElement("img");
      image.src = customCover;
      image.alt = franchiseLabel(franchise);
      slot.append(image);
      media.append(slot);
    } else {
      for (const kit of homeImageKits(franchise)) {
        const slot = document.createElement("span");
        appendImageWithFallback(slot, kit, { alt: kitDisplayName(kit) });
        media.append(slot);
      }
    }
    if (!media.children.length) {
      const fallback = document.createElement("span");
      fallback.className = "home-card-fallback";
      fallback.textContent = franchiseShortLabel(franchise);
      media.append(fallback);
    }
    media.querySelectorAll("img").forEach((image) => {
      image.draggable = false;
    });

    const coverButton = document.createElement("button");
    coverButton.type = "button";
    coverButton.className = "home-cover-button";
    coverButton.setAttribute("aria-label", t("changeCover"));
    coverButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 20 8-8-4-4-8 8-2 6z"/><path d="m14 6 4 4"/></svg>`;
    coverButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openHomeCoverPicker(franchise);
    });

    const body = document.createElement("div");
    body.className = "home-card-body";
    body.innerHTML = `<strong>${escapeHtml(franchiseLabel(franchise))}</strong><span>${escapeHtml(t(homeMetaKey(franchise)))} </span><em>${escapeHtml(t("records", { count: counts.get(franchise) || 0 }))}</em>`;

    card.append(media, coverButton, body);
    elements.homeGrid.append(card);
  }
  renderHomeDashboard();
}

function worldText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[state.language] || value.zh || value.en || value.ja || value.ko || "";
}

function worldGroupsFor(franchise) {
  const atlas = state.atlasGroups || {};
  if (franchise === "gundam") return atlas.gundam_timeline || [];
  if (franchise === "beyblade") return [
    { id: "bbx", labels: { zh: "BX / UX / CX", ko: "BX / UX / CX", en: "BX / UX / CX", ja: "BX / UX / CX" }, subtitle: { zh: "主系列与限定", ko: "메인 라인과 한정", en: "Main lines and limited releases", ja: "メインラインと限定" }, kit_ids: state.kits.filter((kit) => kit.franchise === "beyblade").map((kit) => kit.kit_id) },
    { id: "parts", labels: { zh: "部件图鉴", ko: "파츠 도감", en: "Parts Atlas", ja: "パーツ図鑑" }, subtitle: { zh: "刀盘 / 齿轮 / 轴尖", ko: "블레이드 / 래칫 / 비트", en: "Blade / Ratchet / Bit", ja: "ブレード / ラチェット / ビット" }, kit_ids: [] },
  ];
  return atlas[franchise] || [];
}

function worldGroupImage(group, franchise) {
  if (group?.image) return group.image;
  if (franchise === "armored_core") {
    const kit = state.kits.find((item) => item.franchise === "armored_core" && imageCandidatesForKit(item).length);
    return kit ? imageCandidatesForKit(kit)[0] : "";
  }
  if (franchise === "beyblade") {
    const kit = state.kits.find((item) => item.franchise === "beyblade" && imageCandidatesForKit(item).length);
    return kit ? imageCandidatesForKit(kit)[0] : "";
  }
  return "";
}

function renderWorldSection() {
  if (!elements.worldSection) return;
  const world = WORLD_COPY[state.franchise] || WORLD_COPY.gundam;
  const franchiseKits = state.kits.filter((kit) => kit.franchise === state.franchise);
  const groups = worldGroupsFor(state.franchise);
  if (!state.atlasGroups) {
    ensureAtlasData().then(() => {
      if (state.activeView === "home") renderWorldSection();
    }).catch(() => {});
  }

  elements.worldSection.innerHTML = "";
  const hero = document.createElement("div");
  hero.className = `world-hero world-${state.franchise.replace("_", "-")}`;
  const copy = document.createElement("div");
  copy.className = "world-copy";
  copy.innerHTML = `<span>${escapeHtml(franchiseShortLabel(state.franchise))}</span><strong>${escapeHtml(worldText(world.title))}</strong><p>${escapeHtml(worldText(world.lead))}</p>`;
  const actions = document.createElement("div");
  actions.className = "world-actions";
  for (const action of WORLD_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = worldText(action.label);
    button.addEventListener("click", () => {
      if (action.view === "guide") openGuide(world.guideTab);
      else if (action.view === "collection") navigateToCollectionView("wanted");
      else switchToView(action.view);
    });
    actions.append(button);
  }
  const stat = document.createElement("div");
  stat.className = "world-stat";
  stat.innerHTML = `<strong>${franchiseKits.length}</strong><span>${escapeHtml(worldText({ zh: "收录", ko: "수록", en: "records", ja: "収録" }))}</span>`;
  hero.append(copy, actions, stat);

  const rail = document.createElement("div");
  rail.className = `world-rail world-rail-${world.mode}`;
  for (const group of groups.slice(0, state.franchise === "fate" ? 18 : 12)) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "world-node";
    const image = document.createElement("span");
    image.className = "world-node-art";
    const imageUrl = worldGroupImage(group, state.franchise);
    if (imageUrl) {
      const img = document.createElement("img");
      img.alt = worldText(group.labels);
      setImageFallbackChain(img, [imageUrl], () => image.classList.add("is-missing"));
      image.append(img);
    } else {
      image.classList.add("is-missing");
      image.textContent = franchiseShortLabel(state.franchise);
    }
    const text = document.createElement("span");
    text.className = "world-node-text";
    const total = (group.kit_ids || []).length || group.count || (group.works || []).length || (group.items || []).length || 0;
    text.innerHTML = `<strong>${escapeHtml(worldText(group.labels))}</strong><em>${escapeHtml([worldText(group.subtitle), total ? t("records", { count: total }) : ""].filter(Boolean).join(" · "))}</em>`;
    item.append(image, text);
    item.addEventListener("click", () => {
      if (state.franchise === "gundam") {
        state.guideTab = "timeline";
        state.activeView = "guide";
        render();
        persistViewState({ mode: "push" });
        setTimeout(() => openGundamTimelineGroup(group), 0);
      } else if (state.franchise === "beyblade" && group.id === "parts") {
        openGuide("parts");
      } else {
        state.guideTab = world.guideTab;
        state.activeView = "guide";
        render();
        persistViewState({ mode: "push" });
        setTimeout(() => openAtlasGroup(group, world.guideTab, editableCollectionMember()), 0);
      }
    });
    rail.append(item);
  }
  elements.worldSection.append(hero, rail);
}

function renderHomeDashboard() {
  renderHomeCollectionOverview();
  renderHomeRecentViewed();
}

function renderHomeCollectionOverview() {
  if (!elements.homeCollectionOverview) {
    return;
  }
  const self = editableCollectionMember();
  const ownedSelfIds = collectionIdsForMember("owned", self);
  const wantedSelfIds = collectionIdsForMember("wanted", self);
  const ownedCount = ownedSelfIds.reduce((total, kitId) => total + collectionQuantityForMember(kitId, "owned", self), 0);
  const wantedCount = wantedSelfIds.reduce((total, kitId) => total + collectionQuantityForMember(kitId, "wanted", self), 0);
  elements.homeCollectionTotal.textContent = t("records", { count: ownedCount + wantedCount });
  elements.homeCollectionOverview.innerHTML = "";
  for (const type of COLLECTION_TYPES) {
    const ids = (type === "owned" ? ownedSelfIds : wantedSelfIds).filter((kitId) => displayKitById(kitId)).slice(0, 4);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `home-collection-card is-${type}`;
    button.addEventListener("click", () => navigateToCollectionView(type));
    const label = document.createElement("strong");
    label.textContent = t(type === "owned" ? "ownedList" : "wantedList");
    const count = document.createElement("span");
    count.textContent = t("records", { count: type === "owned" ? ownedCount : wantedCount });
    const thumbs = document.createElement("div");
    thumbs.className = "home-mini-thumbs";
    for (const kitId of ids) {
      const kit = displayKitById(kitId);
      const slot = document.createElement("span");
      appendImageWithFallback(slot, kit, { alt: kitShortName(kit) });
      thumbs.append(slot);
    }
    if (!ids.length) {
      const empty = document.createElement("em");
      empty.textContent = t("homeCollectionEmpty");
      thumbs.append(empty);
    }
    button.append(label, count, thumbs);
    elements.homeCollectionOverview.append(button);
  }
}

function renderHomeRecentViewed() {
  if (!elements.homeRecentViewed) {
    return;
  }
  elements.homeRecentViewed.innerHTML = "";
  const kits = state.recentViewed.map(displayKitById).filter(Boolean).slice(0, 6);
  if (!kits.length) {
    const empty = document.createElement("div");
    empty.className = "home-empty-note";
    empty.textContent = t("recentViewedEmpty");
    elements.homeRecentViewed.append(empty);
    return;
  }
  for (const kit of kits) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "home-recent-item";
    button.addEventListener("click", () => openDetail(kit));
    const art = document.createElement("span");
    art.className = "home-recent-art";
    appendImageWithFallback(art, kit, { alt: kitShortName(kit) });
    const body = document.createElement("span");
    body.className = "home-recent-body";
    body.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><em>${escapeHtml([franchiseShortLabel(kit.franchise), seriesLabelFromKit(kit), gradeShortLabel(kit)].filter(Boolean).join(" · "))}</em>`;
    button.append(art, body);
    elements.homeRecentViewed.append(button);
  }
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

function duplicateKeyForKit(kit) {
  return [kit.franchise, kit.grade_code, kit.names?.ja || kit.names?.en || kit.kit_id]
    .join(" ")
    .toLowerCase()
    .replace(/[【】\[\]()]/g, " ")
    .replace(/\b(ver|version)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function duplicateCandidateCount() {
  return duplicateCandidateGroups().length;
}

function duplicateCandidateGroups(limit = null) {
  const groups = new Map();
  for (const kit of state.kits) {
    const key = duplicateKeyForKit(kit);
    if (key.length > 8) {
      groups.set(key, [...(groups.get(key) || []), kit]);
    }
  }
  const sorted = [...groups.entries()]
    .filter(([, kits]) => kits.length > 1)
    .filter(([key, kits]) => !kits.every((kit) => state.overrides?.[kit.kit_id]?.duplicate_ignore_key === key))
    .map(([key, kits]) => ({ key, kits }))
    .sort((a, b) => b.kits.length - a.kits.length || a.key.localeCompare(b.key));
  return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

function updateFeedEntries() {
  return feedUpdateFeedEntries(state.updateFeed);
}

function updateEntryItems(entry, franchise = null) {
  return feedUpdateEntryItems(entry, franchise);
}

function updateEntryTotal(entry, franchise = null) {
  return feedUpdateEntryTotal(entry, franchise);
}

function updateEntryPremiumBandaiTotal(entry, franchise = null) {
  return feedUpdateEntryPremiumBandaiTotal(entry, franchise);
}

function updateFeedStats(franchise = null) {
  return feedUpdateFeedStats(state.updateFeed, { franchise, updatedAt: state.updatedAt });
}

function updateItemName(item) {
  for (const language of NAME_FALLBACKS[state.language] || ["zh", "ja", "en", "ko"]) {
    if (item.names?.[language]) {
      return item.names[language];
    }
  }
  return item.kit_id;
}

function updateItemSeriesLabel(item) {
  return item.series_labels?.[state.language] ?? item.series_labels?.zh ?? item.series_labels?.en ?? item.series_key ?? "";
}

function updateChangeLabel(changeType) {
  if (changeType === "added") return t("addedBadge");
  if (changeType === "removed") return t("removedBadge");
  return t("changedBadge");
}

function updateReasonLabel(reason) {
  const key = {
    new: "reasonNew",
    removed: "reasonRemoved",
    image: "reasonImage",
    price: "reasonPrice",
    release: "reasonRelease",
    name: "reasonName",
    series: "reasonSeries",
    product_line: "reasonProductLine",
    limited: "reasonLimited",
    source: "reasonSource",
    metadata: "reasonMetadata",
  }[reason];
  return key ? t(key) : reason;
}

function updateReasonSummary(item) {
  return (item.change_reasons || []).map(updateReasonLabel).join(" ? ");
}

function updateEntryPreviewItems(entry, limit = 8, franchise = null) {
  return feedUpdateEntryPreviewItems(entry, { limit, franchise });
}

function effectiveKitDate(kit) {
  return feedEffectiveKitDate(kit, state.kitFirstSeen);
}

function releaseMonthForKit(kit) {
  return feedReleaseMonthForKit(kit, state.kitFirstSeen);
}

function releaseDateForDisplay(kit) {
  return effectiveKitDate(kit) || t("pending");
}

function defaultReleaseMonth() {
  return feedDefaultReleaseMonth(state.kits, state.kitFirstSeen);
}

function releaseItemsForMonth(month = state.releaseMonth, franchise = null) {
  return feedReleaseItemsForMonth(state.kits, {
    month,
    franchise,
    firstSeen: state.kitFirstSeen,
    nameForSort: kitShortName,
  });
}

function kitIsPremiumBandai(kit) {
  return feedKitIsPremiumBandai(kit);
}

function releaseMonthStats(month = state.releaseMonth, franchise = null) {
  return feedReleaseMonthStats(state.kits, {
    month,
    franchise,
    firstSeen: state.kitFirstSeen,
    seriesKey: kitSeriesKey,
  });
}

function weekOnSaleKits(days = 7) {
  return feedWeekOnSaleKits(state.kits, { firstSeen: state.kitFirstSeen, days });
}

function recentFeedKits(days = RECENT_UPDATE_DAYS) {
  return feedRecentFeedKits(state.updateFeed, { days, displayKitById });
}

function recentUpdateItems(limit = 6, franchise = null) {
  return feedRecentUpdateItems(state.updateFeed, { limit, franchise });
}

function renderUpdateSummaryCards(container, cards) {
  container.innerHTML = "";
  container.classList.add("is-inline");
  for (const cardInfo of cards) {
    const item = document.createElement("span");
    item.className = "update-summary-line";
    item.textContent = `${cardInfo.label} ${cardInfo.value}${cardInfo.meta ? ` · ${cardInfo.meta}` : ""}`;
    container.append(item);
  }
}

function favoriteUpdateSummaryCards(items) {
  const prefs = memberPreferences();
  const cards = [];
  const seriesCounts = new Map();
  const franchiseCounts = new Map();
  for (const kit of items) {
    if (prefs.series.includes(kitSeriesKey(kit))) {
      seriesCounts.set(kitSeriesKey(kit), (seriesCounts.get(kitSeriesKey(kit)) || 0) + 1);
    }
    if (prefs.franchises.includes(kit.franchise)) {
      franchiseCounts.set(kit.franchise, (franchiseCounts.get(kit.franchise) || 0) + 1);
    }
  }
  for (const [key, count] of [...seriesCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    cards.push({ label: favoriteSeriesLabel(key), value: `+${count}`, meta: t("watchedSeries") });
  }
  for (const [franchise, count] of [...franchiseCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.max(0, 3 - cards.length))) {
    cards.push({ label: franchiseShortLabel(franchise), value: `+${count}`, meta: t("watchedFranchise") });
  }
  return cards;
}

function renderDiscoveryChannels(mode, count) {
  if (!elements.homeUpdateSummary) return;
  elements.homeUpdateSummary.hidden = false;
  elements.homeUpdateSummary.classList.add("is-channels");
  elements.homeUpdateSummary.innerHTML = "";
  const channels = [
    { label: t("discoverCatalog"), active: state.activeView === "catalog", action: () => switchToView("catalog") },
    { label: t("recentDaysShort"), active: mode === "recent" && state.activeView === "updates", action: () => setUpdatesMode("recent"), count },
    { label: t("weekOnSaleShort"), active: mode === "week" && state.activeView === "updates", action: () => setUpdatesMode("week") },
    { label: t("discoverPremiumBandai"), active: state.activeView === "pbandai", action: () => navigateToPBandai(state.franchise), count: pbandaiItemsForFranchise(state.franchise).length },
  ];
  for (const channel of channels) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `discover-channel${channel.active ? " is-active" : ""}`;
    button.textContent = Number.isFinite(channel.count) ? `${channel.label} ${channel.count}` : channel.label;
    button.addEventListener("click", channel.action);
    elements.homeUpdateSummary.append(button);
  }
}

async function registerUpdatePeriodicSync() {
  if (!state.updateNotifications || !("serviceWorker" in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    if (!("periodicSync" in registration)) {
      return;
    }
    if ("permissions" in navigator) {
      const permission = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (permission.state !== "granted") {
        return;
      }
    }
    await registration.periodicSync.register("gunpula-update-check", { minInterval: 12 * 60 * 60 * 1000 });
  } catch {
    // Periodic sync is optional; normal app-open notifications still work.
  }
}

function renderHomeUpdates() {
  if (!elements.updatesSection) {
    return;
  }

  const isUpdateView = state.activeView === "updates";
  elements.updatesSection.classList.toggle("is-full", isUpdateView);
  elements.updatesSection.hidden = !isUpdateView;
  if (elements.updatesSection.hidden) {
    return;
  }

  state.releaseMonth = validReleaseMonth(state.releaseMonth) || defaultReleaseMonth();
  elements.updatesDateInput.value = state.releaseMonth;
  localStorage.setItem(RELEASE_MONTH_KEY, state.releaseMonth);

  const mode = state.updatesMode === "month" ? "month" : state.updatesMode === "week" ? "week" : "recent";
  elements.updatesRecentButton?.classList.toggle("is-active", mode === "recent");
  elements.updatesWeekButton?.classList.toggle("is-active", mode === "week");
  const sourceItems = mode === "recent" ? recentFeedKits() : mode === "week" ? weekOnSaleKits() : releaseItemsForMonth(state.releaseMonth);
  const items = sortByPreference(sourceItems.filter((kit) => kit.franchise === state.franchise && kitMatchesSearchQuery(kit)));
  renderDiscoveryChannels(mode, items.length);
  if (elements.sourceHealthStrip) {
    elements.sourceHealthStrip.hidden = true;
    elements.sourceHealthStrip.innerHTML = "";
  }
  if (mode !== "month") {
    elements.updatesSubtitle.textContent =
      mode === "week" ? t("weekOnSaleSummary", { count: items.length }) : t("recentDaysSummary", { days: RECENT_UPDATE_DAYS, count: items.length });
  } else {
    elements.updatesSubtitle.textContent = t("releaseMonthSummary", { month: state.releaseMonth, count: items.length });
  }
  elements.homeUpdateList.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("noReleaseItems");
    elements.homeUpdateList.append(empty);
    return;
  }

  for (const kit of items) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-update-card";
    const art = document.createElement("div");
    art.className = "home-update-art";
    appendImageWithFallback(art, kit, {
      alt: t("boxArtAlt", { name: kitDisplayName(kit) }),
      onExhausted: () => showPlaceholder(art, kit.grade_code || "?"),
    });

    const body = document.createElement("div");
    body.className = "home-update-body";
    const badges = document.createElement("div");
    badges.className = "home-update-badges";
    for (const label of [franchiseShortLabel(kit.franchise), seriesLabelFromKit(kit), gradeShortLabel(kit), kitIsPremiumBandai(kit) ? t("premiumBandai") : null].filter(Boolean)) {
      const badge = document.createElement("span");
      badge.textContent = label;
      if (label === t("premiumBandai")) badge.className = "is-premium";
      badges.append(badge);
    }
    const title = document.createElement("strong");
    title.textContent = kitShortName(kit);
    const meta = document.createElement("span");
    meta.textContent = [t("releaseDateLabel", { date: releaseDateForDisplay(kit) }), kitSeries(kit)].filter(Boolean).join(" · ");
    body.append(badges, title, meta);

    card.append(art, body);
    card.addEventListener("click", () => openDetail(kit));
    elements.homeUpdateList.append(card);
  }
}

function pbandaiItems() {
  return readPBandaiItems(state.pbandai);
}

function pbandaiFranchises() {
  return readPBandaiFranchises(state.pbandai, FRANCHISES);
}

function pbandaiItemsForFranchise(franchise = state.franchise) {
  return readPBandaiItemsForFranchise(state.pbandai, franchise);
}

function navigateToPBandai(franchise = state.franchise) {
  const available = pbandaiFranchises();
  if (available.length && !available.includes(franchise)) {
    franchise = available[0];
  }
  state.franchise = franchise;
  state.activeView = "pbandai";
  localStorage.setItem(FRANCHISE_KEY, state.franchise);
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  persistViewState({ mode: "push" });
  render();
}

function renderPBandaiProducts() {
  if (!elements.pbandaiSection) {
    return;
  }

  const availableFranchises = pbandaiFranchises();
  if (state.activeView === "pbandai" && availableFranchises.length && !availableFranchises.includes(state.franchise)) {
    state.franchise = availableFranchises[0];
  }
  const items = pbandaiItemsForFranchise(state.franchise);
  const visibleItems = state.activeView === "pbandai" ? items : [];
  elements.pbandaiSection.classList.toggle("is-full", state.activeView === "pbandai");
  elements.pbandaiSection.hidden = state.activeView !== "pbandai" || !availableFranchises.length;
  if (elements.pbandaiSection.hidden) {
    return;
  }

  const updatedAt = state.pbandai?.updated_at || visibleItems[0]?.updated_at || "unknown";
  const query = state.query.trim().toLowerCase();
  const filteredItems = visibleItems.filter((item) => pbandaiItemMatchesSearch(item, query));
  elements.pbandaiSubtitle.textContent = `${franchiseLabel(state.franchise)} · ${t("premiumBandaiUpdated", { date: String(updatedAt).slice(0, 10) })} · ${filteredItems.length}/${items.length}`;
  renderPBandaiFranchiseTabs(availableFranchises);
  elements.pbandaiList.innerHTML = "";

  if (!filteredItems.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("pbandaiUnavailable");
    elements.pbandaiList.append(empty);
    return;
  }

  for (const item of filteredItems) {
    const kit = item.kit_id ? displayKitById(item.kit_id) : null;
    const card = document.createElement("article");
    card.className = "pbandai-card";
    card.setAttribute("aria-label", `${t("pbandaiOpenProduct")}: ${item.title || item.id || item.url}`);

    const main = document.createElement("button");
    main.type = "button";
    main.className = "pbandai-card-main";
    main.disabled = !kit;
    main.addEventListener("click", () => {
      if (kit) {
        openDetail(kit);
      }
    });

    const art = document.createElement("div");
    art.className = "pbandai-art";
    const image = safePBandaiImageUrl(item);
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = item.title || t("premiumBandaiProducts");
      img.loading = "lazy";
      img.addEventListener("error", () => showPlaceholder(art, "PB"));
      art.append(img);
    } else {
      showPlaceholder(art, "PB");
    }

    const body = document.createElement("div");
    body.className = "pbandai-body";
    const badges = document.createElement("div");
    badges.className = "home-update-badges";
    for (const label of [t("premiumBandaiSource"), kit ? seriesLabelFromKit(kit) : franchiseLabel(pbandaiFranchiseForItem(item)), kit ? gradeShortLabel(kit) : null].filter(Boolean)) {
      const badge = document.createElement("span");
      badge.textContent = label;
      if (label === t("premiumBandaiSource")) badge.className = "is-premium";
      badges.append(badge);
    }
    const title = document.createElement("strong");
    title.textContent = kit ? kitShortName(kit) : item.title || item.id || item.url;
    const meta = document.createElement("span");
    meta.textContent = [kit?.release_date ? t("releaseDateLabel", { date: kit.release_date }) : null, item.price].filter(Boolean).join(" · ");
    body.append(badges, title, meta);
    main.append(art, body);
    const link = document.createElement("a");
    link.className = "pbandai-official-link";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = t("pbandaiOpenProduct");
    link.addEventListener("click", persistViewState);
    card.append(main, link);
    elements.pbandaiList.append(card);
  }
}

function pbandaiItemMatchesSearch(item, query) {
  if (!query) return true;
  const kit = item.kit_id ? displayKitById(item.kit_id) : null;
  if (kit && kitMatchesSearchQuery(kit, query)) return true;
  const haystack = [item.id, item.title, item.price, item.status, item.category, item.source, item.url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return expandedSearchTerms(query).some((term) => haystack.includes(term));
}

function renderPBandaiFranchiseTabs(franchises) {
  if (!elements.pbandaiFranchiseTabs) {
    return;
  }
  elements.pbandaiFranchiseTabs.innerHTML = "";
  const details = document.createElement("details");
  details.className = "inline-filter-panel";
  const summary = document.createElement("summary");
  summary.innerHTML = `<span class="filter-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></svg></span><span>${escapeHtml(franchiseLabel(state.franchise))}</span>`;
  const options = document.createElement("div");
  options.className = "filter-options";
  for (const franchise of franchises) {
    const count = pbandaiItemsForFranchise(franchise).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-option${state.franchise === franchise ? " is-active" : ""}`;
    button.textContent = `${franchiseShortLabel(franchise)} ${count}`;
    button.addEventListener("click", () => {
      state.franchise = franchise;
      localStorage.setItem(FRANCHISE_KEY, state.franchise);
      renderPBandaiProducts();
      persistViewState({ mode: "push" });
      details.open = false;
    });
    options.append(button);
  }
  details.append(summary, options);
  elements.pbandaiFranchiseTabs.append(details);
}

function marketSources() {
  return readMarketSources(state.marketPrices);
}

function searchRecordForKit(kit) {
  return kit?.kit_id ? state.searchIndexByKit.get(kit.kit_id) || null : null;
}

function marketRecordForKit(kit) {
  return readMarketRecordForKit(state.marketPrices, kit);
}

function marketListingsForKit(kit) {
  return readMarketListingsForKit(state.marketPrices, kit);
}

function marketSourceStatusText(source) {
  if (source.ready === true) return t("marketSourceReady");
  if (source.ready === "manual") return t("marketSourceManual");
  if (source.ready === "cache") return t("marketSourceCache");
  return t("marketSourceNeedsKeys");
}

function formatKrw(value) {
  return formatKrwValue(value, t("pending"));
}

function formatMarketDate(value) {
  return formatMarketDateValue(value, t("pending"));
}

function marketPrimaryQuery(kit) {
  const record = searchRecordForKit(kit);
  return record?.queries?.[0] || [kit?.grade_code, kitShortName(kit)].filter(Boolean).join(" ");
}

function marketSearchLinksForKit(kit, limit = 8) {
  return buildMarketSearchLinksForKit(marketSources(), marketPrimaryQuery(kit), limit);
}

function createMarketMetric(label, value, meta = "") {
  const card = document.createElement("div");
  card.className = "market-metric";
  const title = document.createElement("strong");
  title.textContent = label;
  const number = document.createElement("span");
  number.textContent = value;
  const small = document.createElement("em");
  small.textContent = meta;
  card.append(title, number, small);
  return card;
}

function renderMarketCenter() {
  if (!elements.marketSection) {
    return;
  }
  const isMarketView = state.activeView === "market";
  elements.marketSection.hidden = !isMarketView;
  if (!isMarketView) {
    return;
  }

  const summary = state.marketPrices?.summary || {};
  const fx = state.marketPrices?.exchange_rates || {};
  elements.marketSubtitle.textContent = t("marketSubtitle", {
    date: formatMarketDate(state.marketPrices?.updated_at),
    samples: summary.listing_samples || 0,
    exchange: `${fx.fetch_status || "n/a"} ${fx.date || ""}`.trim(),
  });

  elements.marketSummary.innerHTML = "";
  elements.marketSummary.append(
    createMarketMetric(t("marketSources"), summary.sources_total || marketSources().length || 0, `${t("marketApiReady")} ${summary.api_ready || 0}`),
    createMarketMetric(t("marketManualReady"), summary.manual_ready || 0, "Manual / VPS cache"),
    createMarketMetric(t("marketKeywords"), summary.keyword_records || state.searchIndex?.records?.length || 0, t("marketSearchLinks")),
    createMarketMetric(t("marketPricedKits"), summary.priced_kits || 0, `${summary.listing_samples || 0} samples`),
    createMarketMetric(t("marketFx"), fx.date || t("pending"), fx.provider || "Frankfurter"),
    createMarketMetric(t("marketImages"), summary.image_files || state.imageAssets?.image_files || 0, `${summary.image_total_mb || state.imageAssets?.total_mb || 0} MB`),
  );

  renderMarketSources();
  renderKeywordPreview();
  renderImageAssetSummary();
  renderAndroidPackageSummary();
}

function renderMarketSources() {
  elements.marketSourceGrid.innerHTML = "";
  const sources = marketSources();
  if (!sources.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("sourceHealthEmpty");
    elements.marketSourceGrid.append(empty);
    return;
  }

  for (const source of sources) {
    const card = document.createElement("article");
    card.className = `market-source-card ${marketSourceStatusClass(source)}`;
    const head = document.createElement("div");
    head.className = "market-source-head";
    const title = document.createElement("strong");
    title.textContent = source.label || source.id;
    const status = document.createElement("span");
    status.textContent = marketSourceStatusText(source);
    head.append(title, status);

    const meta = document.createElement("p");
    meta.textContent = [source.market, source.currency, source.mode].filter(Boolean).join(" · ");

    const notes = document.createElement("em");
    notes.textContent = source.missing_env?.length ? source.missing_env.join(" / ") : source.notes || "";

    card.append(head, meta, notes);
    elements.marketSourceGrid.append(card);
  }
}

function renderKeywordPreview() {
  elements.keywordPreview.innerHTML = "";
  const records = (state.searchIndex?.records || [])
    .filter((record) => record.franchise === state.franchise)
    .slice(0, 8);

  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("noMatches");
    elements.keywordPreview.append(empty);
    return;
  }

  for (const record of records) {
    const row = document.createElement("article");
    row.className = "keyword-row";
    const title = document.createElement("strong");
    title.textContent = record.display_name || record.kit_id;
    const meta = document.createElement("span");
    meta.textContent = [seriesLabelFromKey(record.series_key), record.product_line].filter(Boolean).join(" · ");
    const chips = document.createElement("div");
    chips.className = "market-chip-list";
    for (const query of (record.queries || []).slice(0, 3)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.textContent = query;
      chip.addEventListener("click", () => {
        state.query = query;
        state.activeView = "catalog";
        state.franchise = record.franchise;
        localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
        localStorage.setItem(FRANCHISE_KEY, state.franchise);
        persistViewState({ mode: "push" });
        render();
      });
      chips.append(chip);
    }
    row.append(title, meta, chips);
    elements.keywordPreview.append(row);
  }
}

function renderImageAssetSummary() {
  elements.imageAssetSummary.innerHTML = "";
  const assets = state.imageAssets || {};
  elements.imageAssetSummary.append(
    createMarketMetric(t("marketImages"), assets.image_files || 0, t("imageAssetReady", { count: assets.image_files || 0, size: assets.total_mb || 0, local: assets.catalog_records_with_local_images || 0, total: assets.catalog_records || state.kits.length })),
  );
  const roots = document.createElement("div");
  roots.className = "market-chip-list";
  for (const [root, count] of Object.entries(assets.roots || {})) {
    const chip = document.createElement("span");
    chip.textContent = `${root.replace(/^app\/assets\//, "")} ${count}`;
    roots.append(chip);
  }
  elements.imageAssetSummary.append(roots);
}

function renderAndroidPackageSummary() {
  if (!elements.androidPackageSummary) {
    return;
  }
  elements.androidPackageSummary.innerHTML = "";
  const status = state.androidPackage || {};
  elements.androidPackageSummary.append(
    createMarketMetric(
      t("androidPackage"),
      status.app_version || APP_VERSION_LABEL,
      `${status.app_id || "com.mdefitko.gunpula"} · ${status.package_mode || "debug"}`,
    ),
    createMarketMetric(
      t("androidReleaseApk"),
      status.release_build_supported ? t("androidPresent") : t("androidMissing"),
      t("androidReleaseReady", { status: status.release_build_supported ? t("androidPresent") : t("androidMissing") }),
    ),
  );
  const commands = document.createElement("div");
  commands.className = "market-chip-list";
  const links = [
    ["debug APK", status.debug_download_url],
    ["release APK", status.release_download_url],
  ].filter(([, url]) => url);
  if (links.length) {
    for (const [label, url] of links) {
      const chip = document.createElement("a");
      chip.href = url;
      chip.target = "_blank";
      chip.rel = "noreferrer";
      chip.textContent = label;
      commands.append(chip);
    }
  } else {
    for (const command of status.commands || ["npm run android:add", "npm run android:sync", "npm run android:build"]) {
      const chip = document.createElement("span");
      chip.textContent = command;
      commands.append(chip);
    }
  }
  elements.androidPackageSummary.append(commands);
}

function renderDetailMarketPanel(kit) {
  if (!elements.detailMarketPanel || !elements.detailMarketBody) {
    return;
  }
  const record = marketRecordForKit(kit);
  const searchRecord = searchRecordForKit(kit);
  const links = marketSearchLinksForKit(kit);
  const listings = marketListingsForKit(kit).slice(0, 4);
  if (!record && !searchRecord && !links.length) {
    elements.detailMarketPanel.hidden = true;
    return;
  }

  elements.detailMarketPanel.hidden = false;
  elements.detailMarketBody.innerHTML = "";

  const estimates = document.createElement("div");
  estimates.className = "market-estimates";
  estimates.append(
    createMarketMetric(t("marketNormalEstimate"), formatKrw(record?.median_krw), `${record?.samples || 0} samples`),
    createMarketMetric(t("marketConservativeEstimate"), formatKrw(record?.conservative_median_krw), "+ tax / fee"),
  );
  elements.detailMarketBody.append(estimates);

  if (!record?.samples) {
    const note = document.createElement("p");
    note.className = "market-empty-note";
    note.textContent = t("marketNoSamples");
    elements.detailMarketBody.append(note);
  }

  if (searchRecord?.queries?.length) {
    const heading = document.createElement("strong");
    heading.className = "market-mini-heading";
    heading.textContent = t("keywordQueries");
    const chips = document.createElement("div");
    chips.className = "market-chip-list";
    for (const query of searchRecord.queries.slice(0, 4)) {
      const chip = document.createElement("span");
      chip.textContent = query;
      chips.append(chip);
    }
    elements.detailMarketBody.append(heading, chips);
  }

  if (links.length) {
    const heading = document.createElement("strong");
    heading.className = "market-mini-heading";
    heading.textContent = t("marketSearchLinks");
    const row = document.createElement("div");
    row.className = "market-link-row";
    for (const { source, url } of links) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = t("marketOpenSearch", { source: source.label || source.id });
      link.addEventListener("click", persistViewState);
      row.append(link);
    }
    elements.detailMarketBody.append(heading, row);
  }

  for (const listing of listings) {
    const item = document.createElement("a");
    item.className = "market-listing-row";
    item.href = listing.url || "#";
    item.target = listing.url ? "_blank" : "";
    item.rel = listing.url ? "noreferrer" : "";
    item.innerHTML = `<strong>${escapeHtml(listing.title || listing.source)}</strong><span>${escapeHtml(formatKrw(listing.price_krw))} · ${escapeHtml(listing.source)} · ${escapeHtml(listing.condition || "")}</span>`;
    elements.detailMarketBody.append(item);
  }
}

function sourceStatusLabel(status) {
  if (status === "ok") return t("sourceOk");
  if (status === "blocked") return t("sourceBlocked");
  if (status === "error") return t("sourceError");
  return t("sourceWarning");
}

function sourceName(sourceId) {
  return state.sources.find((source) => source.source_id === sourceId)?.name || sourceId;
}

function renderSourceHealthStrip() {
  if (!elements.sourceHealthStrip) {
    return;
  }
  elements.sourceHealthStrip.innerHTML = "";
  const checks = state.sourceHealth?.checks || [];
  if (!checks.length) {
    elements.sourceHealthStrip.hidden = true;
    return;
  }
  elements.sourceHealthStrip.hidden = false;
  for (const check of checks.filter((item) => ["p_bandai_jp", "takara_tomy_beyblade_x_jp"].includes(item.source_id))) {
    const chip = document.createElement("a");
    chip.className = `source-health-chip is-${check.status}`;
    chip.href = check.url;
    chip.target = "_blank";
    chip.rel = "noreferrer";
    chip.textContent =
      check.source_id === "takara_tomy_beyblade_x_jp" && check.item_count
        ? `BBX ${sourceStatusLabel(check.status)} · ${t("sourceCatalogCount", { source: check.item_count, catalog: check.catalog_count ?? "?" })}`
        : `${sourceName(check.source_id)} · ${sourceStatusLabel(check.status)}`;
    elements.sourceHealthStrip.append(chip);
  }
}

function renderSourceHealth() {
  if (!elements.sourceHealthLog) {
    return;
  }
  elements.sourceHealthLog.innerHTML = "";
  const checks = state.sourceHealth?.checks || [];
  if (!checks.length) {
    const empty = document.createElement("div");
    empty.className = "source-health-row";
    empty.textContent = t("sourceHealthEmpty");
    elements.sourceHealthLog.append(empty);
    return;
  }
  for (const check of checks) {
    const row = document.createElement("a");
    row.className = `source-health-row is-${check.status}`;
    row.href = check.url;
    row.target = "_blank";
    row.rel = "noreferrer";
    const countText =
      check.item_count || check.catalog_count
        ? ` · ${t("sourceCatalogCount", { source: check.item_count ?? "-", catalog: check.catalog_count ?? state.sourceHealth?.catalog?.byFranchise?.beyblade ?? "-" })}`
        : "";
    row.innerHTML = `<strong>${escapeHtml(sourceName(check.source_id))}</strong><span>${escapeHtml(sourceStatusLabel(check.status))}${escapeHtml(countText)}</span><em>${escapeHtml(check.message || check.final_url || "")}</em>`;
    elements.sourceHealthLog.append(row);
  }
}

function reviewCandidates() {
  const items = [];
  const auditByKit = new Map((state.seriesAudit?.issues || []).map((issue) => [issue.kit_id, issue]));
  for (const kit of state.kits) {
    if (kit.data_status === "verified" || kit.local_override?.data_status === "verified") {
      continue;
    }
    const reasons = [];
    if (kit.data_status === "needs_review") reasons.push(t("reviewNeedsReview"));
    if (!imageCandidatesForKit(kit).length) reasons.push(t("reviewMissingImage"));
    if (!kit.series?.key || kit.series.key === "other") reasons.push(t("workSource"));
    const auditIssue = auditByKit.get(kit.kit_id);
    if (auditIssue) reasons.push(`${t("reviewSeriesAudit")}: ${auditIssue.check}`);
    if (!reasons.length) continue;
    items.push({ kit, reasons });
  }
  return items.sort((a, b) => b.reasons.length - a.reasons.length || String(b.kit.release_date || "").localeCompare(String(a.kit.release_date || ""))).slice(0, 12);
}

function renderReviewWorkbench() {
  if (!elements.reviewWorkbench) {
    return;
  }
  elements.reviewWorkbench.innerHTML = "";
  const items = reviewCandidates();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "review-empty";
    empty.textContent = t("reviewEmpty");
    elements.reviewWorkbench.append(empty);
    return;
  }
  for (const { kit, reasons } of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "review-item";
    button.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><span>${escapeHtml([franchiseShortLabel(kit.franchise), seriesLabelFromKit(kit), gradeShortLabel(kit)].join(" · "))}</span><em>${escapeHtml(reasons.join(" · "))}</em>`;
    button.addEventListener("click", () => openDetail(kit));
    elements.reviewWorkbench.append(button);
  }
}

function renderUpdateLog() {
  if (!elements.updateLog) {
    return;
  }
  elements.updateLog.innerHTML = "";

  const entries = updateFeedEntries();
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.textContent = t("noUpdateFeed");
    elements.updateLog.append(empty);
    return;
  }

  const stats = updateFeedStats();
  const summary = document.createElement("div");
  summary.className = "update-summary-grid";
  renderUpdateSummaryCards(summary, [
    { label: t("updateToday"), value: stats.today.count, meta: `${t("premiumBandai")} ${stats.today.premium} · ${t("watchedUpdates")} ${stats.today.watched}` },
    { label: t("updateWeek"), value: stats.week.count, meta: `${t("premiumBandai")} ${stats.week.premium} · ${t("watchedUpdates")} ${stats.week.watched}` },
    { label: t("updateMonth"), value: stats.month.count, meta: `${t("premiumBandai")} ${stats.month.premium} · ${t("watchedUpdates")} ${stats.month.watched}` },
  ]);
  elements.updateLog.append(summary);

  const recent = document.createElement("div");
  recent.className = "update-entry-list";
  for (const entry of entries.slice(0, 8)) {
    const row = document.createElement("article");
    row.className = "update-entry";
    const heading = document.createElement("div");
    heading.className = "update-entry-head";
    heading.innerHTML = `<strong>${escapeHtml(entry.date)}</strong><span>${escapeHtml(t("updateAdded", { count: entry.added_count || 0 }))} · ${escapeHtml(t("updateChanged", { count: entry.changed_count || 0 }))} · ${escapeHtml(t("premiumBandai"))} ${updateEntryPremiumBandaiTotal(entry)} · ${escapeHtml(t("watchedUpdates"))} ${entry.watched_count || 0}</span>`;
    row.append(heading);

    const items = updateEntryPreviewItems(entry);
    if (items.length) {
      const list = document.createElement("div");
      list.className = "update-entry-items";
      for (const item of items) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `update-chip${item.watch_tags?.length ? " is-watched" : ""}${itemIsPremiumBandai(item) ? " is-premium" : ""}`;
        chip.textContent = `${item.change_type === "changed" ? "Δ" : "+"} ${itemIsPremiumBandai(item) ? `${t("premiumBandai")} · ` : ""}${updateItemName(item)}`;
        chip.addEventListener("click", () => {
          const kit = displayKitById(item.kit_id);
          if (kit) {
            openDetail(kit);
          }
        });
        list.append(chip);
      }
      row.append(list);
    }
    recent.append(row);
  }
  elements.updateLog.append(recent);

  const footer = document.createElement("span");
  footer.textContent = `${state.updatedAt ?? "unknown"} · ${state.kits.length} · ${t("duplicateCandidates")} ${duplicateCandidateCount()}`;
  elements.updateLog.append(footer);
}

function gradeByCode() {
  return new Map(state.grades.map((grade) => [grade.code, grade]));
}

function franchiseLabel(franchise) {
  return franchiseLabelFor(franchise, state.language);
}

function franchiseShortLabel(franchise) {
  return franchiseShortLabelFor(franchise, state.language);
}

function gradeLabel(grade) {
  return gradeLabelFor(grade, state.language, t("pending"));
}

function gradeShortLabel(kit) {
  return gradeShortLabelFor(kit.grade_code, state.language);
}

function itemTypeKeyForKit(kit) {
  return itemTypeKeyForCategory(gradeByCode().get(kit.grade_code)?.category || "other");
}

function itemTypeLabel(key) {
  return itemTypeLabelFor(key, state.language);
}

function imageCandidatesForKit(kit) {
  const overrideCover = kit.local_override?.cover_image_url || kit.local_override?.image_url;
  return [...new Set([overrideCover, kit.images?.box_art_url, ...(kit.gallery_image_urls || [])].filter(Boolean))];
}

function appendImageWithFallback(container, kit, options = {}) {
  return appendImageUrlsWithFallback(container, imageCandidatesForKit(kit), options);
}

function releaseYearForKit(kit) {
  return /^\d{4}/.exec(String(effectiveKitDate(kit) || ""))?.[0] ?? null;
}

function collectionMembers() {
  state.collection = normalizeCollection(state.collection);
  const members = new Set([safeMemberName(memberName())]);
  for (const member of Object.keys(state.collection.member_items || {})) {
    members.add(safeMemberName(member));
  }
  return [...members].sort((a, b) => (a === safeMemberName(memberName()) ? -1 : b === safeMemberName(memberName()) ? 1 : a.localeCompare(b)));
}

function activeCollectionMember() {
  const value = state.collectionMemberView || "self";
  if (value === "all") {
    return "all";
  }
  if (value === "self") {
    return safeMemberName(memberName());
  }
  return safeMemberName(value);
}

function editableCollectionMember() {
  return safeMemberName(memberName());
}

function memberCollectionMap(member = editableCollectionMember()) {
  state.collection = normalizeCollection(state.collection);
  state.collection.member_items = state.collection.member_items || {};
  state.collection.member_items[member] = state.collection.member_items[member] || {};
  return state.collection.member_items[member];
}

function refreshLegacyCollectionItems() {
  state.collection.member_items = state.collection.member_items || {};
  const editableItems = state.collection.member_items[editableCollectionMember()] || {};
  state.collection.items = { ...editableItems };
  state.collection.owned = Object.entries(editableItems)
    .filter(([, entry]) => entry?.status === "owned")
    .map(([kitId]) => kitId);
  state.collection.wanted = Object.entries(editableItems)
    .filter(([, entry]) => entry?.status === "wanted")
    .map(([kitId]) => kitId);
}

function collectionEntry(kitId, member = editableCollectionMember()) {
  state.collection = normalizeCollection(state.collection);
  return kitId ? state.collection.member_items?.[member]?.[kitId] || null : null;
}

function preferredCollectionMemberForKit(kitId, type = null) {
  const activeMember = activeCollectionMember();
  if (activeMember !== "all") {
    const activeEntry = collectionEntry(kitId, activeMember);
    if (activeEntry?.status && (!type || activeEntry.status === type)) {
      return activeMember;
    }
  }

  const editableMember = editableCollectionMember();
  const editableEntry = collectionEntry(kitId, editableMember);
  if (editableEntry?.status && (!type || editableEntry.status === type)) {
    return editableMember;
  }

  const entries = collectionEntriesForKit(kitId, type);
  if (entries.length === 1) {
    return entries[0].member;
  }

  return editableMember;
}

function collectionEntriesForKit(kitId, type = null) {
  state.collection = normalizeCollection(state.collection);
  const entries = [];
  for (const [member, memberMap] of Object.entries(state.collection.member_items || {})) {
    const entry = memberMap?.[kitId];
    if (entry?.status && (!type || entry.status === type)) {
      entries.push({ member, entry });
    }
  }
  return entries;
}

function collectionQuantityForKit(kitId, member = editableCollectionMember()) {
  return clampCollectionQuantity(collectionEntry(kitId, member)?.quantity ?? 1);
}

function wantedBudgetForKits(kits) {
  return kits.reduce((total, kit) => total + (kit.price_jpy || 0) * wantedQuantityForKit(kit.kit_id), 0);
}


function baseSeriesLabel(series, language = state.language) {
  return displayBaseSeriesLabelFor(series, language, t("pending"));
}

function seriesLabelFromSeries(series, language = state.language) {
  return displaySeriesLabelForSeries(series, language, state.seriesLabelOverrides, t("pending"));
}

function seriesLabelFromKit(kit) {
  return seriesLabelFromSeries(kit.series) || kit.work_title || t("pending");
}

function seriesLabelFromKey(key) {
  if (key === "all") {
    return t("allWorks");
  }
  const sample = state.kits.find((kit) => kitSeriesKey(kit) === key);
  return sample ? seriesLabelFromKit(sample) : (state.seriesLabelOverrides[key]?.[state.language] ?? key);
}

function seriesLabelForLanguage(key, language) {
  const sample = state.kits.find((kit) => kitSeriesKey(kit) === key);
  return sample ? seriesLabelFromSeries(sample.series, language) : (state.seriesLabelOverrides[key]?.[language] ?? key);
}

function baseSeriesLabelForLanguage(key, language) {
  const sample = state.kits.find((kit) => kitSeriesKey(kit) === key);
  return sample ? baseSeriesLabel(sample.series, language) : key;
}

function kitDisplayName(kit) {
  return kitDisplayNameFor(kit, state.language);
}

function kitShortName(kit) {
  return kitShortNameFor(kit, state.language);
}

function kitSeries(kit) {
  return seriesLabelFromKit(kit) + " · " + gradeShortLabel(kit);
}

function kitMatchesSearchQuery(kit, rawQuery = state.query) {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    kit.kit_id,
    kit.franchise,
    kit.grade_code,
    kit.subline,
    kit.names.ja,
    kit.names.en,
    kit.names.zh,
    kit.names.ko,
    kitDisplayNameForLanguage(kit, "zh"),
    kitDisplayNameForLanguage(kit, "ko"),
    kitDisplayNameForLanguage(kit, "en"),
    kitDisplayNameForLanguage(kit, "ja"),
    seriesLabelFromKit(kit),
    seriesLabelFromSeries(kit.series, "zh"),
    seriesLabelFromSeries(kit.series, "ko"),
    kit.series?.key,
    kit.work_title,
    kit.universe,
    kit.release_date,
    kit.price_jpy,
    searchRecordForKit(kit)?.search_blob,
  ]
    .join(" ")
    .toLowerCase();
  return expandedSearchTerms(query).some((term) => haystack.includes(term));
}

function renderSearchTarget() {
  if (state.activeView === "updates") {
    renderHomeUpdates();
  } else if (state.activeView === "pbandai") {
    renderPBandaiProducts();
  } else {
    renderKits();
  }
}

function kitsForCurrentFranchise() {
  return state.kits.filter((kit) => kit.franchise === state.franchise);
}

function filteredKits() {
  const query = state.query.trim().toLowerCase();
  const minPrice = numericFilterValue(state.priceMin);
  const maxPrice = numericFilterValue(state.priceMax);
  const source =
    state.activeView === "owned"
      ? collectionIds("owned").map(displayKitById).filter(Boolean)
      : state.activeView === "wanted"
        ? collectionIds("wanted").map(displayKitById).filter(Boolean)
        : kitsForCurrentFranchise();
  return sortByPreference(source.filter((kit) => {
    if (activeCollectionType() && !collectionFilterMatches(kit)) {
      return false;
    }
    if (state.activeView === "catalog" && !filterHas("grade", kit.grade_code)) {
      return false;
    }
    if (state.activeView === "catalog" && !filterHas("series", kitSeriesKey(kit))) {
      return false;
    }
    if (state.activeView === "catalog" && !filterHas("itemType", itemTypeKeyForKit(kit))) {
      return false;
    }
    if (state.activeView === "catalog" && !filterHas("releaseYear", releaseYearForKit(kit))) {
      return false;
    }
    if (state.activeView === "catalog" && !filterIsAll("limited")) {
      const limited = Boolean(kit.is_limited);
      const selectedLimited = selectedFilterValues("limited");
      if (!selectedLimited.includes(limited ? "limited" : "regular")) {
        return false;
      }
    }
    if (state.activeView === "catalog" && minPrice !== null && (kit.price_jpy || 0) < minPrice) {
      return false;
    }
    if (state.activeView === "catalog" && maxPrice !== null && (kit.price_jpy || 0) > maxPrice) {
      return false;
    }
    return !query || kitMatchesSearchQuery(kit, query);
  }));
}

function collectionFilterMatches(kit) {
  const filter = state.collectionFilter || { franchise: "all", series: "all", grade: "all" };
  if (filter.franchise !== "all" && kit.franchise !== filter.franchise) {
    return false;
  }
  if (filter.series !== "all" && kitSeriesKey(kit) !== filter.series) {
    return false;
  }
  if (filter.grade !== "all" && kit.grade_code !== filter.grade) {
    return false;
  }
  return true;
}

function collectionFilterLabel() {
  const filter = state.collectionFilter || { franchise: "all", series: "all", grade: "all" };
  const parts = [];
  parts.push(filter.franchise === "all" ? t("allFranchises") : franchiseLabel(filter.franchise));
  if (filter.series !== "all") {
    parts.push(seriesLabelFromKey(filter.series));
  }
  if (filter.grade !== "all") {
    parts.push(filter.grade);
  }
  return parts.join(" / ");
}

function activeCollectionType() {
  return COLLECTION_TYPES.includes(state.activeView) ? state.activeView : null;
}

function collectionSelection(type) {
  if (!state.collectionSelection[type]) {
    state.collectionSelection[type] = new Set();
  }
  return state.collectionSelection[type];
}

function selectedCollectionIds(type) {
  pruneCollectionSelection(type);
  return [...collectionSelection(type)];
}

function pruneCollectionSelection(type) {
  const validIds = new Set(collectionIds(type));
  for (const kitId of collectionSelection(type)) {
    if (!validIds.has(kitId)) {
      collectionSelection(type).delete(kitId);
    }
  }
}

function visibleCollectionIds(kits) {
  return kits.map((kit) => kit.kit_id);
}

function toggleVisibleCollectionSelection(event) {
  const type = activeCollectionType();
  if (!type) {
    return;
  }
  const selection = collectionSelection(type);
  for (const kitId of visibleCollectionIds(filteredKits())) {
    if (event.target.checked) {
      selection.add(kitId);
    } else {
      selection.delete(kitId);
    }
  }
  renderKits();
}

function removeCollectionItems(type, kitIds) {
  if (!COLLECTION_TYPES.includes(type) || !kitIds.length) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }

  const deleteSet = new Set(kitIds);
  const member = activeCollectionMember();
  if (member === "all" && !window.confirm(t("deleteAllMembersConfirm", { count: deleteSet.size }))) {
    return;
  }
  const targetMembers = member === "all" ? collectionMembers() : [member];
  const nextMemberItems = { ...(state.collection.member_items || {}) };
  const now = new Date().toISOString();
  for (const targetMember of targetMembers) {
    const nextItems = { ...(nextMemberItems[targetMember] || {}) };
    for (const kitId of deleteSet) {
      if (nextItems[kitId]?.status === type) {
        nextItems[kitId] = { ...nextItems[kitId], status: "deleted", updated_at: now, updated_by: editableCollectionMember() };
      }
      if (state.collection.items?.[kitId]?.status === type) {
        delete state.collection.items[kitId];
      }
      collectionSelection(type).delete(kitId);
    }
    nextMemberItems[targetMember] = nextItems;
  }
  state.collection.member_items = nextMemberItems;
  refreshLegacyCollectionItems();
  state.collectionSelection[type] = new Set();

  saveCollection();
  renderCollections();
  renderKits();
  if (state.selectedKit && elements.detailDialog.open) {
    renderDetail(state.selectedKit);
  }
}

function deleteSelectedCollectionItems() {
  const type = activeCollectionType();
  if (!type) {
    return;
  }
  removeCollectionItems(type, selectedCollectionIds(type));
}

function clearActiveCollectionView() {
  const type = activeCollectionType();
  if (!type) {
    return;
  }
  const ids = collectionIds(type);
  if (!ids.length) {
    return;
  }
  const label = t(type === "owned" ? "ownedList" : "wantedList");
  if (!window.confirm(t("clearCollectionConfirm", { name: label, count: ids.length }))) {
    return;
  }
  removeCollectionItems(type, ids);
}

function renderCollectionManagement(kits) {
  const type = activeCollectionType();
  elements.collectionManagement.hidden = !type;
  if (elements.collectionHub) {
    elements.collectionHub.hidden = !type;
  }
  if (elements.collectionFilterButton) {
    elements.collectionFilterButton.hidden = !type;
  }
  if (!type && elements.collectionFilterSheet) {
    elements.collectionFilterSheet.hidden = true;
  }
  if (!type) {
    return;
  }

  renderCollectionHub(type);
  renderCollectionGroupSummary(type);
  renderCollectionFilterButton();
  pruneCollectionSelection(type);
  const editable = canEditSharedData();
  const visibleIds = visibleCollectionIds(kits);
  const total = collectionIds(type).length;
  const selection = collectionSelection(type);
  const selectedIds = selectedCollectionIds(type);
  const selectedVisibleCount = visibleIds.filter((kitId) => selection.has(kitId)).length;

  elements.collectionSelectAll.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  elements.collectionSelectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  elements.collectionSelectAll.disabled = !editable || visibleIds.length === 0;
  elements.deleteSelectedCollection.disabled = !editable || selectedIds.length === 0;
  elements.clearCollectionView.disabled = !editable || total === 0;
  elements.collectionSelectionSummary.textContent = t("selectedCount", { selected: selectedIds.length, total });
}

function renderCollectionGroupSummary(type) {
  if (!elements.collectionGroupSummary) {
    return;
  }
  elements.collectionGroupSummary.innerHTML = "";
  const allKits = collectionIds(type).map(displayKitById).filter(Boolean);
  const filter = state.collectionFilter || { franchise: "all", series: "all", grade: "all" };
  const setFilter = (next) => {
    state.collectionFilter = { ...state.collectionFilter, ...next };
    saveCollectionFilter();
    state.collectionSelection[type] = new Set();
    persistViewState({ mode: "replace" });
    renderKits();
  };

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = filter.franchise === "all" && filter.series === "all" && filter.grade === "all" ? "is-active" : "";
  reset.textContent = t("allFranchises");
  reset.addEventListener("click", () => setFilter({ franchise: "all", series: "all", grade: "all" }));
  elements.collectionGroupSummary.append(reset);

  const path = document.createElement("span");
  path.textContent = collectionFilterLabel();
  elements.collectionGroupSummary.append(path);

  const buckets = new Map();
  if (filter.franchise === "all") {
    for (const kit of allKits) {
      buckets.set(kit.franchise, (buckets.get(kit.franchise) || 0) + 1);
    }
  } else if (filter.series === "all") {
    for (const kit of allKits.filter((kit) => kit.franchise === filter.franchise)) {
      const key = kitSeriesKey(kit);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  } else {
    for (const kit of allKits.filter((kit) => kit.franchise === filter.franchise && kitSeriesKey(kit) === filter.series)) {
      buckets.set(kit.grade_code, (buckets.get(kit.grade_code) || 0) + 1);
    }
  }
  const top = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16);
  if (!allKits.length) {
    elements.collectionGroupSummary.hidden = true;
    return;
  }
  elements.collectionGroupSummary.hidden = false;
  for (const [key, count] of top) {
    const chip = document.createElement("button");
    chip.type = "button";
    const label =
      filter.franchise === "all"
        ? franchiseLabel(key)
        : filter.series === "all"
          ? seriesLabelFromKey(key)
          : key;
    chip.className =
      key === filter.franchise || key === filter.series || key === filter.grade
        ? "is-active"
        : "";
    chip.textContent = `${label} ${count}`;
    chip.addEventListener("click", () => {
      if (filter.franchise === "all") {
        setFilter({ franchise: key, series: "all", grade: "all" });
      } else if (filter.series === "all") {
        setFilter({ series: key, grade: "all" });
      } else {
        setFilter({ grade: key });
      }
    });
    elements.collectionGroupSummary.append(chip);
  }
}

function renderCollectionHub(type) {
  if (elements.collectionTypeTabs) {
    for (const button of elements.collectionTypeTabs.querySelectorAll("button[data-collection-type]")) {
      button.classList.toggle("is-active", button.dataset.collectionType === type);
    }
  }

  if (!elements.collectionMemberRow) {
    return;
  }
  elements.collectionMemberRow.innerHTML = "";
  const self = editableCollectionMember();
  const others = collectionMembers().filter((member) => member !== self);
  // Solo collections have nobody to switch to; the avatar row is pure noise then.
  if (!others.length) {
    elements.collectionMemberRow.hidden = true;
    if (state.collectionMemberView !== "self") {
      state.collectionMemberView = "self";
      localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
    }
    return;
  }
  elements.collectionMemberRow.hidden = false;

  const workspaceMembers = state.sync.workspace?.members || [];
  const memberByName = new Map(workspaceMembers.map((member) => [safeMemberName(member.name), member]));
  const options = [
    ["all", t("allMembers"), null],
    ["self", currentMember()?.name || t("currentMember"), memberByName.get(self) || currentMember()],
    ...others.map((member) => [member, member, memberByName.get(member)]),
  ];
  for (const [value, label, profile] of options) {
    const button = document.createElement("button");
    button.type = "button";
    const isActive =
      state.collectionMemberView === value ||
      (value === "self" && activeCollectionMember() === self && state.collectionMemberView !== "all") ||
      (value !== "self" && value !== "all" && activeCollectionMember() === value);
    button.className = `collection-member-circle${isActive ? " is-active" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "account-avatar member-circle-avatar";
    if (value === "all") {
      avatar.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    } else if (profile) {
      applyAvatarTo(avatar, profile, label[0]);
    } else {
      avatar.textContent = (label[0] || "?").toUpperCase();
    }
    const name = document.createElement("span");
    name.className = "member-circle-name";
    name.textContent = label;
    button.append(avatar, name);
    button.addEventListener("click", () => {
      state.collectionMemberView = value;
      localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
      state.collectionSelection[type] = new Set();
      renderKits();
    });
    elements.collectionMemberRow.append(button);
  }
}

function collectionFilterActive() {
  const filter = state.collectionFilter || { franchise: "all", series: "all", grade: "all" };
  return filter.franchise !== "all" || filter.series !== "all" || filter.grade !== "all";
}

function renderCollectionFilterButton() {
  if (!elements.collectionFilterButton) {
    return;
  }
  const sheetOpen = !elements.collectionFilterSheet?.hidden;
  elements.collectionFilterButton.classList.toggle("is-active", sheetOpen || collectionFilterActive());
}

function collectionIds(type) {
  state.collection = normalizeCollection(state.collection);
  const member = activeCollectionMember();
  if (member === "all") {
    const ids = [];
    for (const memberMap of Object.values(state.collection.member_items || {})) {
      for (const [kitId, entry] of Object.entries(memberMap || {})) {
        if (entry?.status === type) {
          ids.push(kitId);
        }
      }
    }
    return [...new Set(ids)];
  }
  return Object.entries(state.collection.member_items?.[member] || {})
    .filter(([, entry]) => entry?.status === type)
    .map(([kitId]) => kitId);
}

function collectionIdsForMember(type, member = editableCollectionMember()) {
  state.collection = normalizeCollection(state.collection);
  return Object.entries(state.collection.member_items?.[safeMemberName(member)] || {})
    .filter(([, entry]) => entry?.status === type)
    .map(([kitId]) => kitId);
}

function collectionQuantityForMember(kitId, type, member = editableCollectionMember()) {
  const entry = collectionEntry(kitId, safeMemberName(member));
  return entry?.status === type ? clampCollectionQuantity(entry.quantity ?? 1) : 0;
}

function wantedQuantityForKit(kitId, member = editableCollectionMember()) {
  if (!kitId) {
    return 1;
  }
  state.collection = normalizeCollection(state.collection);
  return clampCollectionQuantity(state.collection.member_items?.[member]?.[kitId]?.quantity ?? 1);
}

function selectedWantedQuantity() {
  const kit = state.selectedKit;
  if (!kit) {
    return 1;
  }
  const member = preferredCollectionMemberForKit(kit.kit_id, "wanted");
  return wantedQuantityForKit(kit.kit_id, member);
}

function kitInCollection(kitId, type, member = editableCollectionMember()) {
  return collectionEntry(kitId, member)?.status === type;
}

function collectionQuantityForView(kitId, type) {
  const member = activeCollectionMember();
  if (member === "all") {
    return collectionEntriesForKit(kitId, type).reduce((total, { entry }) => total + clampCollectionQuantity(entry.quantity), 0);
  }
  return clampCollectionQuantity(collectionEntry(kitId, member)?.quantity ?? 1);
}

function collectionOwnerSummary(kitId, type) {
  const member = activeCollectionMember();
  if (member === "all") {
    return collectionEntriesForKit(kitId, type)
      .map(({ member: owner, entry }) => `${owner} ×${clampCollectionQuantity(entry.quantity)}`)
      .join(" / ");
  }
  const entry = collectionEntry(kitId, member);
  return entry?.status === type ? `${member} ×${clampCollectionQuantity(entry.quantity)}` : "";
}

// Set a kit's status in the signed-in user's own collection by id (used by the 图鉴,
// which acts on kits the user isn't currently viewing in the detail dialog).
function setKitCollectionStatus(kitId, type, on) {
  if (!kitId) return;
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  const member = editableCollectionMember();
  const previous = collectionEntry(kitId, member);
  if (on) {
    memberCollectionMap(member)[kitId] = {
      status: type,
      quantity: clampCollectionQuantity(previous?.quantity ?? 1),
      updated_at: new Date().toISOString(),
      updated_by: member,
    };
  } else if (previous?.status === type) {
    memberCollectionMap(member)[kitId] = {
      ...previous,
      status: "deleted",
      updated_at: new Date().toISOString(),
      updated_by: member,
    };
  } else {
    return;
  }
  refreshLegacyCollectionItems();
  saveCollection();
  renderCollections();
  renderKits();
}

function updateSelectedWantedQuantity(value) {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  const member = preferredCollectionMemberForKit(kit.kit_id, "wanted");
  if (collectionEntry(kit.kit_id, member)?.status !== "wanted") {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }

  const current = collectionEntry(kit.kit_id, member) || {};
  memberCollectionMap(member)[kit.kit_id] = {
    ...current,
    status: "wanted",
    quantity: clampCollectionQuantity(value),
    updated_at: new Date().toISOString(),
    updated_by: member,
  };
  refreshLegacyCollectionItems();

  saveCollection();
  renderCollections();
  renderKits();
  renderDetailStatusActions(kit);
}

function saveSelectedCollectionDetails() {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  const member = preferredCollectionMemberForKit(kit.kit_id, "owned");
  const current = collectionEntry(kit.kit_id, member);
  if (!current?.status) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }

  const purchasePrice = numericFilterValue(elements.purchasePriceInput.value);
  const nextEntry = {
    ...current,
    quantity: clampCollectionQuantity(elements.collectionQuantityInput.value),
    note: elements.collectionNoteInput.value.trim(),
    storage: elements.storageLocationInput.value.trim(),
    updated_at: new Date().toISOString(),
    updated_by: member,
  };
  if (purchasePrice === null) {
    delete nextEntry.purchase_price;
  } else {
    nextEntry.purchase_price = Math.round(purchasePrice);
  }
  if (!nextEntry.note) delete nextEntry.note;
  if (!nextEntry.storage) delete nextEntry.storage;

  memberCollectionMap(member)[kit.kit_id] = nextEntry;
  refreshLegacyCollectionItems();
  saveCollection();
  renderCollections();
  renderKits();
  renderDetailStatusActions(kit);
}

function toggleKitCollection(type) {
  const kit = state.selectedKit;
  if (!kit) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }

  const targetMember = preferredCollectionMemberForKit(kit.kit_id, type);
  // collectionEntry()/memberCollectionMap() each re-normalize state.collection into a
  // fresh object, so the entry must be read BEFORE grabbing the map — evaluating it
  // inside the assignment's right side would write into an orphaned map and the
  // removal would silently vanish on the next normalize.
  const previousEntry = collectionEntry(kit.kit_id, targetMember);
  if (previousEntry?.status === type) {
    const removal = {
      ...previousEntry,
      status: "deleted",
      updated_at: new Date().toISOString(),
      updated_by: editableCollectionMember(),
    };
    memberCollectionMap(targetMember)[kit.kit_id] = removal;
  } else {
    const member = editableCollectionMember();
    const nextEntry = {
      status: type,
      quantity: collectionQuantityForKit(kit.kit_id, member),
      updated_at: new Date().toISOString(),
      updated_by: member,
    };
    memberCollectionMap(member)[kit.kit_id] = nextEntry;
  }
  refreshLegacyCollectionItems();

  saveCollection();
  renderCollections();
  renderKits();
  renderDetail(kit);
}

function renderCollections() {
  const isCatalogView = state.activeView === "catalog";
  const ownedLength = renderCollectionStrip("owned", elements.ownedStrip, elements.ownedCount, elements.ownedPanel, elements.ownedCollapse, false);
  const wantedLength = renderCollectionStrip("wanted", elements.wantedStrip, elements.wantedCount, elements.wantedPanel, elements.wantedCollapse, false);
  const ownedVisible = state.homeCollectionVisibility.owned && ownedLength > 0;
  const wantedVisible = state.homeCollectionVisibility.wanted && wantedLength > 0;
  elements.ownedPanel.hidden = !ownedVisible;
  elements.wantedPanel.hidden = !wantedVisible;
  const visibleCount = [ownedVisible, wantedVisible].filter(Boolean).length;
  elements.collectionSection.classList.toggle("is-single", visibleCount === 1);
  elements.collectionSection.classList.toggle("is-collection-view", false);
  elements.collectionSection.hidden = visibleCount === 0 || !isCatalogView;
}

function renderCollectionStrip(type, strip, countNode, panel, collapseButton, forceVisible = false) {
  const ids = collectionIds(type).filter((kitId) => displayKitById(kitId));
  state.collection[type] = ids;
  const count = ids.reduce((total, kitId) => total + collectionQuantityForView(kitId, type), 0);
  const collapsed = state.homeCollectionCollapsed[type];
  const label = t(type === "owned" ? "ownedList" : "wantedList");
  countNode.textContent = String(count);
  panel.hidden = !forceVisible && ids.length === 0;
  panel.classList.toggle("is-collapsed", collapsed);
  panel.tabIndex = ids.length > 0 ? 0 : -1;
  strip.hidden = collapsed;
  collapseButton.textContent = collapsed ? "⌄" : "⌃";
  collapseButton.setAttribute("aria-expanded", String(!collapsed));
  collapseButton.setAttribute("aria-label", t(collapsed ? "expandCollection" : "collapseCollection", { name: label }));
  strip.innerHTML = "";

  if (collapsed) {
    return ids.length;
  }

  if (!ids.length && forceVisible) {
    const empty = document.createElement("div");
    empty.className = "collection-empty";
    empty.textContent = t("noMatches");
    strip.append(empty);
    return ids.length;
  }

  for (const kitId of ids.slice(0, 24)) {
    const kit = displayKitById(kitId);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "collection-item";
    item.setAttribute("aria-label", t("detailsFor", { name: kitDisplayName(kit) }));

    const showCollectionFallback = () => {
      if (item.querySelector(".collection-fallback")) {
        return;
      }
      const fallback = document.createElement("span");
      fallback.className = "collection-fallback";
      fallback.textContent = gradeShortLabel(kit);
      item.prepend(fallback);
    };
    appendImageWithFallback(item, kit, { onExhausted: showCollectionFallback });

    const quantity = collectionQuantityForView(kitId, type);
    if (quantity > 1) {
      const badge = document.createElement("span");
      badge.className = "collection-quantity";
      badge.textContent = `×${quantity}`;
      item.append(badge);
    }
    const label = document.createElement("span");
    label.textContent = kitShortName(kit);
    item.append(label);
    item.addEventListener("click", () => openDetail(kit));
    strip.append(item);
  }
  return ids.length;
}

function renderDetailStatusActions(kit) {
  const ownedMember = preferredCollectionMemberForKit(kit.kit_id, "owned");
  const wantedMember = preferredCollectionMemberForKit(kit.kit_id, "wanted");
  const owned = collectionEntry(kit.kit_id, ownedMember)?.status === "owned";
  const wanted = collectionEntry(kit.kit_id, wantedMember)?.status === "wanted";
  const editable = canEditSharedData();
  elements.toggleOwned.classList.toggle("is-active", owned);
  elements.toggleWanted.classList.toggle("is-active", wanted);
  elements.toggleOwned.disabled = !editable;
  elements.toggleWanted.disabled = !editable;
  elements.toggleOwned.textContent = owned ? t("unmarkOwned") : t("markOwned");
  elements.toggleWanted.textContent = wanted ? t("unmarkWanted") : t("markWanted");
  elements.wantedQuantityControl.hidden = !wanted;
  elements.wantedQuantityInput.value = String(wantedQuantityForKit(kit.kit_id, wantedMember));
  elements.wantedQuantityInput.disabled = !editable;
  elements.wantedQuantityMinus.disabled = !editable || wantedQuantityForKit(kit.kit_id, wantedMember) <= 1;
  elements.wantedQuantityPlus.disabled = !editable || wantedQuantityForKit(kit.kit_id, wantedMember) >= 99;
  const entry = collectionEntry(kit.kit_id, ownedMember);
  // Collection details (purchase price, storage...) only make sense for kits
  // you actually own; for wanted-only kits the panel is noise.
  const hasCollectionEntry = owned;
  elements.collectionDetailPanel.hidden = !hasCollectionEntry;
  elements.collectionQuantityInput.value = String(collectionQuantityForKit(kit.kit_id, ownedMember));
  elements.purchasePriceInput.value = entry?.purchase_price ?? "";
  elements.storageLocationInput.value = entry?.storage ?? "";
  elements.collectionNoteInput.value = entry?.note ?? "";
  for (const input of [elements.collectionQuantityInput, elements.purchasePriceInput, elements.storageLocationInput, elements.collectionNoteInput, elements.saveCollectionDetails]) {
    input.disabled = !editable || !hasCollectionEntry;
  }
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
      state.seriesAdminLanguage = language.code;
      localStorage.setItem(LANGUAGE_KEY, state.language);
      render();
      if (state.selectedKit && elements.detailDialog.open) {
        renderDetail(state.selectedKit);
      }
      persistViewState({ mode: "replace" });
    });
    elements.languageList.append(button);
  }
}

function renderOnboardingLanguages() {
  if (!elements.onboardingLanguageList) {
    return;
  }
  elements.onboardingLanguageList.innerHTML = "";
  for (const language of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `segment-button${state.language === language.code ? " is-active" : ""}`;
    button.textContent = language.label;
    button.addEventListener("click", () => {
      state.language = language.code;
      state.seriesAdminLanguage = language.code;
      localStorage.setItem(LANGUAGE_KEY, state.language);
      render();
      renderOnboardingLanguages();
      persistViewState({ mode: "replace" });
    });
    elements.onboardingLanguageList.append(button);
  }
}

function showOnboardingIfNeeded() {
  if (!elements.onboardingDialog || getString(ONBOARDING_DONE_KEY) === "true" || state.activeModal || state.selectedKit) {
    return;
  }
  renderOnboardingLanguages();
  openDialog(elements.onboardingDialog);
}

function finishOnboarding() {
  setString(ONBOARDING_DONE_KEY, "true");
  closeDialog(elements.onboardingDialog);
}

function renderSettings() {
  renderSettingsTabs();
  renderSettingsPanels();
  state.consoleMode = state.settingsPanel === "console";
  if (elements.consoleModeToggle) {
    elements.consoleModeToggle.checked = state.consoleMode;
  }
  elements.showOwnedOnHome.checked = state.homeCollectionVisibility.owned;
  elements.showWantedOnHome.checked = state.homeCollectionVisibility.wanted;
  elements.updateNotificationToggle.checked = state.updateNotifications;
  elements.syncSupabaseUrl.value = state.syncConfig.supabaseUrl || "";
  elements.syncAnonKey.value = state.syncConfig.anonKey || "";
  elements.syncWorkspaceId.value = state.syncConfig.workspaceId || "";
  elements.syncWorkspaceSecret.value = state.syncConfig.workspaceSecret || "";
  elements.syncEditorSecret.value = state.syncConfig.editorSecret || "";
  elements.syncMemberName.value = state.syncConfig.memberName || "";
  elements.installApp.hidden = !state.installPrompt;
  elements.syncNow.disabled = !syncActive();
  elements.disconnectSync.disabled = !syncConfigComplete();
  renderAccountSection();
  renderUpdateNotificationStatus();
  renderNotificationRules();
  renderSyncStatus();
  renderSourceHealth();
  renderReviewWorkbench();
  renderDuplicateWorkbench();
  renderHiddenRecords();
  renderImageHealth();
  renderImageAssetSummary();
  renderAndroidPackageSummary();
}

const SETTINGS_TAB_LABELS = {
  account: "settingsTabAccount",
  appearance: "settingsTabAppearance",
  data: "settingsTabData",
  updates: "settingsTabUpdates",
  about: "settingsTabAbout",
  console: "settingsTabConsole",
};

const SETTINGS_MENU_ICONS = {
  account: '<circle cx="12" cy="8" r="4"/><path d="M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2"/>',
  appearance:
    '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.74 1.65-1.67 0-.43-.17-.81-.43-1.1a1.65 1.65 0 0 1 1.24-2.73H16a6 6 0 0 0 6-6c0-4.6-4.5-8.5-10-8.5Z"/>',
  data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
  updates: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
  about: '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
  console: '<path d="m4 17 6-5-6-5"/><path d="M12 19h8"/>',
};

function renderSettingsTabs() {
  if (!elements.settingsTabs) {
    return;
  }
  const onHome = state.settingsPanel === "home";
  elements.settingsTabs.hidden = !onHome;
  elements.settingsTabs.innerHTML = "";
  for (const panel of SETTINGS_PANELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.settingsTab = panel;
    button.innerHTML =
      `<span class="settings-menu-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SETTINGS_MENU_ICONS[panel] || ""}</svg></span>` +
      `<span class="settings-menu-label">${escapeHtml(t(SETTINGS_TAB_LABELS[panel]))}</span>`;
    elements.settingsTabs.append(button);
  }
}

function renderSettingsPanels() {
  if (state.settingsPanel !== "home" && !SETTINGS_PANELS.includes(state.settingsPanel)) {
    state.settingsPanel = "home";
  }
  const onHome = state.settingsPanel === "home";
  document.querySelectorAll("[data-settings-panel]").forEach((section) => {
    section.hidden = onHome || section.dataset.settingsPanel !== state.settingsPanel;
  });
  if (elements.settingsBack) {
    elements.settingsBack.hidden = false;
  }
  if (elements.settingsTitle) {
    elements.settingsTitle.textContent = onHome ? t("settings") : t(SETTINGS_TAB_LABELS[state.settingsPanel]);
  }
  if (elements.settingsTabs) {
    elements.settingsTabs.hidden = !onHome;
  }
  if (elements.datasetSummary) {
    elements.datasetSummary.hidden = !onHome;
  }
}

function currentMember() {
  return state.sync.workspace?.members?.find((member) => member.is_self) || null;
}

function memberPreferences(member = currentMember()) {
  const prefs = member?.preferences;
  return {
    ...(prefs && typeof prefs === "object" && !Array.isArray(prefs) ? prefs : {}),
    franchises: Array.isArray(prefs?.franchises) ? prefs.franchises.filter((value) => FRANCHISES.includes(value)) : [],
    series: Array.isArray(prefs?.series) ? prefs.series.map(String) : [],
    guide_works: Array.isArray(prefs?.guide_works) ? prefs.guide_works.map((value) => Number(value)).filter(Boolean) : [],
  };
}

function preferenceScoreForKit(kit) {
  const prefs = memberPreferences();
  let score = 0;
  if (prefs.franchises.includes(kit.franchise)) score += 1;
  if (prefs.series.includes(kitSeriesKey(kit))) score += 2;
  return score;
}

// Stable: favorites float up, original order preserved within each tier.
function sortByPreference(items) {
  return items
    .map((kit, index) => ({ kit, index, score: preferenceScoreForKit(kit) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.kit);
}

function guideGroupPreferenceScore(group) {
  return Math.max(0, ...group.kit_ids.map((kitId) => preferenceScoreForKit(displayKitById(kitId) || {})));
}

function applyAvatarTo(element, member, fallbackChar) {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  if (member?.avatar) {
    const img = document.createElement("img");
    img.src = member.avatar;
    img.alt = member.name || "";
    element.append(img);
  } else {
    element.textContent = (fallbackChar || member?.name?.[0] || "@").toUpperCase();
  }
}

function memberProfileBackground(member) {
  const value = memberPreferences(member).profile_background;
  return typeof value === "string" ? value : "";
}

function applyMemberCover(element, member) {
  if (!element) return;
  const background = memberProfileBackground(member);
  element.style.backgroundImage = background ? `url("${background}")` : "";
  element.classList.toggle("has-cover", Boolean(background));
}

async function saveMemberProfileFields(fields) {
  const result = await supabaseRpcV2("gunpula_v2_update_member_profile", {
    p_display_name: fields.displayName ?? null,
    p_avatar: fields.avatar ?? null,
    p_preferences: fields.preferences ?? null,
  });
  const remote = normalizeCloudState(result);
  if (remote?.workspace) {
    state.sync.workspace = remote.workspace;
  }
}

async function saveMemberDisplayNameValue(nextName, button = null) {
  const trimmed = String(nextName || "").trim();
  if (!trimmed) return;
  const previousName = currentWorkspaceMemberName();
  if (button) button.disabled = true;
  try {
    state.syncConfig.memberName = trimmed;
    saveSyncConfig();
    const renamedCollection = renameCollectionMember(previousName, trimmed);
    if (syncModeV2() && state.sync.workspace) {
      const result = await supabaseRpcV2("gunpula_v2_update_member_name", {
        p_display_name: trimmed,
      });
      const remote = normalizeCloudState(result);
      state.sync.workspace = remote?.workspace || state.sync.workspace;
      state.sync.canEdit = remote?.canEdit ?? state.sync.canEdit;
      setSyncStatus(state.sync.canEdit ? "connected" : "readonly", t("memberNameSaved"));
    } else {
      setSyncStatus("local", t("memberNameSaved"));
    }
    if (renamedCollection) saveCollection();
    renderSettings();
    renderCollections();
    renderKits();
    if (elements.userDialog?.open) renderUserPage();
    if (elements.memberDialog?.open) openMemberProfile(currentMember());
  } catch (error) {
    state.syncConfig.memberName = previousName;
    saveSyncConfig();
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleAvatarChange(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !syncModeV2() || !state.sync.workspace) {
    return;
  }
  try {
    const avatar = await imageDataUrlFromFile(file, { width: 96, height: 96, fit: "cover", format: "image/jpeg", quality: 0.82 });
    await saveMemberProfileFields({ avatar });
    renderSettings();
    applyAppearance();
    if (elements.userDialog?.open) {
      renderUserPage();
    }
    if (elements.memberDialog?.open) {
      openMemberProfile(currentMember());
    }
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  }
}

async function handleProfileBackgroundChange(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  const member = currentMember();
  if (!file || !member || !syncModeV2() || !state.sync.workspace) {
    return;
  }
  try {
    const background = await imageDataUrlFromFile(file, { width: 900, height: 360, fit: "cover", format: "image/jpeg", quality: 0.78 });
    const prefs = { ...memberPreferences(member), profile_background: background };
    member.preferences = prefs;
    await saveMemberProfileFields({ preferences: prefs });
    renderSettings();
    renderUserPage();
    openMemberProfile(currentMember());
  } catch (error) {
    setSyncStatus("error", error.message);
    renderSettings();
  }
}

let favoritesSaveTimer = null;

function toggleFavorite(kind, value) {
  const member = currentMember();
  if (!member) {
    return;
  }
  const prefs = memberPreferences(member);
  const list = prefs[kind];
  const index = list.indexOf(value);
  if (index >= 0) {
    list.splice(index, 1);
  } else {
    list.push(value);
  }
  member.preferences = { ...prefs, franchises: prefs.franchises, series: prefs.series };
  renderProfileFavorites();
  if (state.activeView === "updates") {
    renderHomeUpdates();
  }
  clearTimeout(favoritesSaveTimer);
  favoritesSaveTimer = setTimeout(() => {
    saveMemberProfileFields({ preferences: member.preferences }).catch((error) => setSyncStatus("error", error.message));
  }, 800);
}

function favoriteSeriesLabel(key) {
  const kit = state.kits.find((item) => kitSeriesKey(item) === key);
  return kit ? seriesLabelFromKit(kit) : key;
}

function renderProfileFavorites() {
  if (!elements.profileFavorites) {
    return;
  }
  const member = currentMember();
  const visible = Boolean(syncModeV2() && state.sync.workspace && member);
  elements.profileFavorites.hidden = !visible;
  if (!visible) {
    return;
  }
  const prefs = memberPreferences(member);

  elements.favoriteFranchises.innerHTML = "";
  for (const franchise of FRANCHISES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `member-chip${prefs.franchises.includes(franchise) ? " is-active" : ""}`;
    chip.textContent = franchiseShortLabel(franchise);
    chip.addEventListener("click", () => toggleFavorite("franchises", franchise));
    elements.favoriteFranchises.append(chip);
  }

  elements.favoriteSeries.innerHTML = "";
  const seen = new Set();
  const candidates = [];
  for (const franchise of prefs.franchises.length ? prefs.franchises : ["gundam"]) {
    for (const [key, entry] of seriesEntriesForFranchise(franchise).slice(0, 8)) {
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ key, label: entry.label });
      }
    }
  }
  for (const key of prefs.series) {
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ key, label: favoriteSeriesLabel(key) });
    }
  }
  for (const { key, label } of candidates) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `member-chip${prefs.series.includes(key) ? " is-active" : ""}`;
    chip.textContent = label;
    chip.addEventListener("click", () => toggleFavorite("series", key));
    elements.favoriteSeries.append(chip);
  }
}

function memberCollectionKits(memberDisplayName, status) {
  const items = state.collection.member_items?.[safeMemberName(memberDisplayName)] || {};
  return Object.entries(items)
    .filter(([, entry]) => entry?.status === status)
    .map(([kitId]) => ({ kit: displayKitById(kitId), entry: items[kitId] }))
    .filter((row) => Boolean(row.kit));
}

function fillMemberStrip(container, rows) {
  container.innerHTML = "";
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "collection-empty";
    empty.textContent = t("memberNoItems");
    container.append(empty);
    return;
  }
  for (const { kit } of rows.slice(0, 30)) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "collection-item";
    const rendered = appendImageWithFallback(item, kit, { alt: kitDisplayName(kit) });
    if (!rendered) {
      const fallback = document.createElement("span");
      fallback.className = "collection-fallback";
      fallback.textContent = kit.grade_code || "?";
      item.append(fallback);
    }
    const name = document.createElement("span");
    name.textContent = kitShortName(kit);
    item.append(name);
    item.addEventListener("click", () => openDetail(kit));
    container.append(item);
  }
}

function switchToView(view) {
  state.activeView = view;
  if (COLLECTION_TYPES.includes(view)) {
    state.lastCollectionTab = view;
  }
  state.selectedKit = null;
  state.activeModal = null;
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  persistViewState({ mode: "push" });
  render();
}

function renderUserPage() {
  const member = currentMember();
  applyMemberCover(elements.userDialogCover, member);
  elements.userDialogHead?.classList.toggle("has-cover", Boolean(memberProfileBackground(member)));
  elements.userDialogHead?.classList.toggle("is-editable", Boolean(member));
  if (elements.userDialogHead) {
    elements.userDialogHead.tabIndex = member ? 0 : -1;
  }
  applyAvatarTo(elements.userDialogAvatar, member, currentUserEmail()[0]);
  elements.userDialogName.textContent = member?.name || currentUserEmail().split("@")[0] || "member";
  elements.userDialogMeta.textContent = currentUserEmail();
  elements.userOwnedCount.textContent = String(collectionIdsForMember("owned").length);
  elements.userWantedCount.textContent = String(collectionIdsForMember("wanted").length);
  renderProfileFavorites();

  const workspace = state.sync.workspace;
  elements.userInviteLine.hidden = !workspace?.inviteCode;
  elements.userInviteCode.textContent = workspace?.inviteCode || "";
  elements.userMembers.innerHTML = "";
  for (const row of workspace?.members || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `workspace-member-row${row.is_self ? " is-self" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "account-avatar member-row-avatar";
    applyAvatarTo(avatar, row);
    const body = document.createElement("span");
    body.className = "member-row-body";
    const name = document.createElement("strong");
    name.textContent = `${row.name || "member"}${row.is_self ? ` · ${t("workspaceSelf")}` : ""}`;
    body.append(name);
    button.append(avatar, body);
    button.addEventListener("click", () => openMemberProfile(row));
    elements.userMembers.append(button);
  }

  // Populate the 图鉴 count lazily; ensureGuideData caches after the first load.
  if (elements.userGuideValue) {
    if (state.guide) {
      renderUserGuideValue();
    } else {
      ensureGuideData().then(renderUserGuideValue).catch(() => {});
    }
  }
}

function openUserPage() {
  renderUserPage();
  if (!elements.userDialog.open) {
    elements.userDialog.classList.remove("is-closing");
    openDialog(elements.userDialog);
  }
  renderBottomNav();
}

function closeUserPage(options = {}) {
  if (!elements.userDialog?.open || elements.userDialog.classList.contains("is-closing")) {
    return;
  }
  if (options.immediate) {
    elements.userDialog.classList.remove("is-closing");
    closeDialog(elements.userDialog);
    renderBottomNav();
    return;
  }
  // Mirror the slide-in with a slide-out before actually closing the dialog.
  elements.userDialog.classList.add("is-closing");
  setTimeout(() => {
    elements.userDialog.classList.remove("is-closing");
    if (elements.userDialog.open) {
      closeDialog(elements.userDialog);
    }
    renderBottomNav();
  }, 190);
}

// ---------------------------------------------------------------------------
// 图鉴 (picture book): a gallery of G Generation mobile suits, grouped by work,
// that lights up from the user's own owned/wanted collection via the kit map.
// ---------------------------------------------------------------------------
const GGET_GUIDE_WORK = /Gundam 00(?!8)|Gundam SEED|Witch from Mercury/i;

// Strip in-game variant tags so "Freedom Gundam", "Freedom Gundam (EX)" and
// "Freedom Gundam METEOR" collapse to one cell, without merging genuinely
// different suits like "Strike Gundam" vs "Aile Strike Gundam".
function guideBaseName(name) {
  return String(name || "")
    .replace(/\s*\((?:EX|METEOR)\)/gi, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .replace(/\s*\bMETEOR\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GUIDE_SPLITS_KEY = "gunpula-guide-splits-v1";
const GUIDE_SERIES_FILTER_KEY = "gunpula-guide-series-filter-v1";

function loadGuideSeriesFilters() {
  try {
    return new Set(JSON.parse(localStorage.getItem(GUIDE_SERIES_FILTER_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveGuideSeriesFilters() {
  localStorage.setItem(GUIDE_SERIES_FILTER_KEY, JSON.stringify([...(state.guideSeriesFilters || [])]));
}

function loadGuideSplits() {
  try {
    return new Set(JSON.parse(localStorage.getItem(GUIDE_SPLITS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveGuideSplits() {
  localStorage.setItem(GUIDE_SPLITS_KEY, JSON.stringify([...(state.guideSplits || [])]));
}

function guideMergeKey(unit) {
  return `${unit.work_id}::${guideBaseName(unit.name).toLowerCase()}`;
}

// Group the raw units into display cells, merging variants by base name — unless the
// user has manually split that merge key, in which case each variant stands alone.
function buildGuideGroups(units) {
  const splits = state.guideSplits || new Set();
  const groupMap = new Map();
  for (const unit of units) {
    const mergeKey = guideMergeKey(unit);
    const split = splits.has(mergeKey);
    const key = split ? `split:${unit.unit_id}` : mergeKey;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        merge_key: mergeKey,
        split,
        work_id: unit.work_id,
        work: unit.work,
        name: split ? unit.name : guideBaseName(unit.name),
        icon: unit.icon,
        rarity: unit.rarity,
        unit_ids: [],
        variants: [],
        kit_ids: new Set(),
      });
    }
    const group = groupMap.get(key);
    group.unit_ids.push(unit.unit_id);
    group.variants.push(unit.name);
    if (unit.rarity > group.rarity) {
      group.rarity = unit.rarity;
      group.icon = unit.icon; // show the highest-rarity art as the cell face
    }
    for (const kitId of unit.kit_ids) group.kit_ids.add(kitId);
  }
  return [...groupMap.values()].map((g) => ({ ...g, kit_ids: [...g.kit_ids] }));
}

function refreshGuideGroups() {
  if (state.guide) state.guide.groups = buildGuideGroups(state.guide.units);
}

async function ensureGuideData() {
  if (state.guide) return state.guide;
  if (!state.guideSplits) state.guideSplits = loadGuideSplits();
  if (!state.guideManualLit) state.guideManualLit = loadGuideManualLit();
  const [units, map, sectionsDoc] = await Promise.all([
    loadOptionalJson("../data/gget-units.json"),
    loadOptionalJson("../data/gget-kit-map.json"),
    loadOptionalJson("../data/gget-series-sections.json"),
  ]);
  if (!units?.units) {
    state.guide = { works: [], units: [], groups: [], sections: [] };
    return state.guide;
  }
  const unitKits = map?.unit_kits || {};
  const sectionWorkIds = new Set((sectionsDoc?.works || []).map((work) => Number(work.work_id)).filter(Boolean));
  const workIds = new Set([
    ...(units.works || []).filter((w) => GGET_GUIDE_WORK.test(w.name)).map((w) => Number(w.work_id)),
    ...sectionWorkIds,
  ]);
  const workName = new Map((units.works || []).map((w) => [w.work_id, w.name]));
  const rawUnits = units.units
    .filter((u) => (u.work_ids || []).some((id) => workIds.has(Number(id))))
    .map((u) => {
      const workId = Number((u.work_ids || []).find((id) => workIds.has(Number(id))));
      return {
        unit_id: u.unit_id,
        icon: u.icon,
        name: u.name,
        rarity: u.rarity,
        work_id: workId,
        work: workName.get(workId) || "",
        kit_ids: unitKits[u.unit_id] || [],
      };
    });

  const sectionByWork = new Map((sectionsDoc?.works || []).map((work) => [Number(work.work_id), work]));
  const works = [...workIds].map((id) => {
    const sectionWork = sectionByWork.get(Number(id));
    return {
      work_id: Number(id),
      name: sectionWork?.name || workName.get(id) || "",
      section: sectionWork?.section || "unavailable",
      image: sectionWork?.image || "",
    };
  }).filter((work) => work.name);
  state.guide = {
    works,
    units: rawUnits,
    groups: buildGuideGroups(rawUnits),
    iconBase: units.image_base || "",
    sections: sectionsDoc?.sections || [],
    seriesImageBase: "https://img.kusoge.xyz/ggenet/series/",
  };
  return state.guide;
}

async function ensureAtlasData() {
  if (state.atlasGroups) return state.atlasGroups;
  const doc = await loadOptionalJson("../data/atlas-groups.json");
  state.atlasGroups = doc?.franchises || {};
  return state.atlasGroups;
}

// Local cached icon first, remote source as fallback: only ~1/4 of guide unit
// icons are cached under app/assets/gget, so without this most cells hatch out.
function guideIconLocal(icon) {
  return `./assets/gget/${icon}.webp`;
}

function guideIconRemote(icon) {
  const base = state.guide?.iconBase;
  return base ? `${base}/thum_${icon}.webp` : "";
}

// Sets img.src to the local icon and, on failure, tries the remote source once
// before running onExhausted (which typically hatches the frame).
function guideIconImage(img, icon, onExhausted) {
  const remote = guideIconRemote(icon);
  img.src = guideIconLocal(icon);
  img.addEventListener("error", () => {
    if (remote && img.src !== remote && !img.dataset.triedRemote) {
      img.dataset.triedRemote = "1";
      img.src = remote;
      return;
    }
    onExhausted?.();
  });
}

// Owned / wanted kit-id sets for a workspace member.
function guideCollectionSets(member = editableCollectionMember()) {
  state.collection = normalizeCollection(state.collection);
  const memberKey = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember());
  const map = state.collection.member_items?.[memberKey] || {};
  const owned = new Set();
  const wanted = new Set();
  for (const [kitId, entry] of Object.entries(map)) {
    if (entry?.status === "owned") owned.add(kitId);
    else if (entry?.status === "wanted") wanted.add(kitId);
  }
  return { owned, wanted, memberKey };
}

const GUIDE_MANUAL_LIT_KEY = "gunpula-guide-manual-lit-v1";

function loadGuideManualLit() {
  try {
    return new Set(JSON.parse(localStorage.getItem(GUIDE_MANUAL_LIT_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveGuideManualLit() {
  localStorage.setItem(GUIDE_MANUAL_LIT_KEY, JSON.stringify([...(state.guideManualLit || [])]));
}

function guideGroupManuallyLit(group) {
  const lit = state.guideManualLit;
  return Boolean(lit && group.unit_ids.some((id) => lit.has(id)));
}

function guideGroupStatus(group, sets) {
  if (group.kit_ids.some((id) => sets.owned.has(id))) return "owned";
  if (group.kit_ids.some((id) => sets.wanted.has(id))) return "wanted";
  // A cell with no matching kit can still be lit by hand (e.g. built from spares).
  if (sets.memberKey === editableCollectionMember() && guideGroupManuallyLit(group)) return "owned";
  return "none";
}

async function openGuide(tab, member = editableCollectionMember()) {
  if (tab) state.guideTab = tab;
  state.activeGuideMember = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember());
  if (!state.guideTab) state.guideTab = "gundam";
  state.activeView = "guide";
  state.selectedKit = null;
  state.activeModal = null;
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  persistViewState({ mode: "push" });
  render();
}

async function renderGuidePage() {
  const visible = state.activeView === "guide";
  if (elements.guideDialog) elements.guideDialog.hidden = !visible;
  if (!visible) return;
  if (!state.guideTab) state.guideTab = "gundam";
  if (elements.guideTabs) {
    for (const button of elements.guideTabs.querySelectorAll("button[data-guide-tab]")) {
      button.classList.toggle("is-active", button.dataset.guideTab === state.guideTab);
    }
  }
  await renderGuideActive();
}

const GUIDE_FULL_COLOR_KEY = "gunpula-guide-full-color-v1";
const GUIDE_TABS = ["gundam", "timeline", "pokemon", "fate", "armored_core", "bbx", "parts"];

function switchGuideTab(tab) {
  if (!GUIDE_TABS.includes(tab) || tab === state.guideTab) return;
  state.guideTab = tab;
  if (elements.guideTabs) {
    for (const button of elements.guideTabs.querySelectorAll("button[data-guide-tab]")) {
      button.classList.toggle("is-active", button.dataset.guideTab === state.guideTab);
    }
  }
  renderGuideActive();
}

function setUpdatesMode(mode) {
  if (!["recent", "week", "month"].includes(mode)) return;
  state.updatesMode = mode;
  localStorage.setItem(UPDATES_MODE_KEY, state.updatesMode);
  renderHomeUpdates();
}

function bindGuideSwipe() {
  if (!elements.guideDialog || elements.guideDialog.dataset.swipeBound === "1") return;
  elements.guideDialog.dataset.swipeBound = "1";
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  elements.guideDialog.addEventListener(
    "touchstart",
    (event) => {
      startTime = 0;
      if (state.activeView !== "guide" || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!swipeZoneAllowed(touch.clientY) || pagerBlockedByTarget(event.target)) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    },
    { passive: true },
  );
  elements.guideDialog.addEventListener(
    "touchend",
    (event) => {
      if (!startTime || state.activeView !== "guide") return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const elapsed = Date.now() - startTime;
      startTime = 0;
      if (elapsed > 900 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      const index = GUIDE_TABS.indexOf(state.guideTab || "gundam");
      const next = dx < 0 ? GUIDE_TABS[index + 1] : GUIDE_TABS[index - 1];
      if (next) switchGuideTab(next);
    },
    { passive: true },
  );
}

function loadGuideFullColor() {
  return localStorage.getItem(GUIDE_FULL_COLOR_KEY) === "1";
}

// Full-color preview drops the grayscale/dim on un-owned cells so the whole
// gallery can be browsed in color; applies to both the Gundam and BBX tabs.
function applyGuideColorMode() {
  if (state.guideFullColor === undefined) state.guideFullColor = loadGuideFullColor();
  elements.guideBody?.classList.toggle("is-full-color", state.guideFullColor);
  elements.guideColorToggle?.classList.toggle("is-active", state.guideFullColor);
}

function toggleGuideFullColor() {
  state.guideFullColor = !state.guideFullColor;
  localStorage.setItem(GUIDE_FULL_COLOR_KEY, state.guideFullColor ? "1" : "0");
  applyGuideColorMode();
}

async function renderGuideActive() {
  renderGuideUserChip();
  if (state.guideTab === "bbx") {
    renderBbxGuide(await ensureBbxData());
  } else if (state.guideTab === "parts") {
    renderBbxParts(await ensureBbxData());
  } else if (state.guideTab === "timeline") {
    renderGundamTimeline(await ensureAtlasData());
  } else if (["pokemon", "fate", "armored_core"].includes(state.guideTab)) {
    renderAtlasGuide(state.guideTab, await ensureAtlasData());
  } else {
    renderGuide(await ensureGuideData());
  }
  applyGuideColorMode();
}

function renderGuideUserChip() {
  if (!elements.guideUserChip) return;
  const member = activeGuideMember();
  applyAvatarTo(elements.guideUserAvatar, member, member?.name?.[0] || "@");
  elements.guideUserName.textContent = member?.name || editableCollectionMember();
  elements.guideUserChip.onclick = () => {
    const target = activeGuideMember();
    if (target) openMemberProfile(target);
  };
}

function guideWorkDisplayName(workOrName) {
  return String(typeof workOrName === "string" ? workOrName : workOrName?.name || "")
    .replace(/^Mobile Suit Gundam\s*:?\s*/i, "")
    .replace(/^Mobile Suit\s*:?\s*/i, "")
    .trim();
}

function guideWorkFamily(workOrName) {
  const name = String(typeof workOrName === "string" ? workOrName : workOrName?.name || "").toLowerCase();
  if (name.includes("seed")) return "seed";
  if (name.includes("gundam 00") || name.includes("celestial being")) return "double_o";
  if (name.includes("wing")) return "wing";
  if (name.includes("iron-blooded")) return "iron_blooded";
  if (name.includes("witch from mercury")) return "witch";
  if (name.includes("gquuuuuux")) return "gquuuuuux";
  if (name.includes("age")) return "age";
  if (name.includes("build") || name.includes("gunpla builders")) return "build";
  if (name.includes("sd ") || name.includes("sengokuden") || name.includes("sangoku")) return "sd";
  if (name.includes("fighter g gundam")) return "g";
  if (name.includes("gundam x")) return "x";
  if (name.includes("turn a")) return "turn_a";
  if (name.includes("reconguista")) return "g_reco";
  if (name.includes("g generation") || name.includes("extreme vs") || name.includes("battle master")) return "game";
  if (
    /\b(0079|0080|0081|0083|0087|0093|f90|f91|uc|cca|msv|zeta|zz|unicorn|narrative|hathaway|crossbone|sentinel|igloo|blue destiny|lost war|missing link|thunderbolt|advance of zeta|char|v gundam|origin|mobile suit gundam)\b/.test(name)
  ) {
    return "uc";
  }
  return "other";
}

function guideFamilyLabel(key) {
  const labels = {
    all: { zh: "全部", ko: "전체", en: "All", ja: "すべて" },
    uc: { zh: "UC", ko: "UC", en: "UC", ja: "UC" },
    seed: { zh: "SEED", ko: "SEED", en: "SEED", ja: "SEED" },
    double_o: { zh: "00", ko: "00", en: "00", ja: "00" },
    wing: { zh: "W", ko: "W", en: "W", ja: "W" },
    iron_blooded: { zh: "铁血", ko: "철혈", en: "IBO", ja: "鉄血" },
    witch: { zh: "水星", ko: "수성", en: "Witch", ja: "水星" },
    gquuuuuux: { zh: "GQuuuuuuX", ko: "GQuuuuuuX", en: "GQuuuuuuX", ja: "GQuuuuuuX" },
    age: { zh: "AGE", ko: "AGE", en: "AGE", ja: "AGE" },
    build: { zh: "创战", ko: "빌드", en: "Build", ja: "ビルド" },
    sd: { zh: "SD", ko: "SD", en: "SD", ja: "SD" },
    g: { zh: "G", ko: "G", en: "G", ja: "G" },
    x: { zh: "X", ko: "X", en: "X", ja: "X" },
    turn_a: { zh: "∀", ko: "∀", en: "Turn A", ja: "∀" },
    g_reco: { zh: "G复国", ko: "G레코", en: "G-Reco", ja: "Gレコ" },
    game: { zh: "游戏", ko: "게임", en: "Games", ja: "ゲーム" },
    other: { zh: "其他", ko: "기타", en: "Other", ja: "その他" },
  };
  return labels[key]?.[state.language] || labels[key]?.zh || key;
}

function createGuideWorkArt(work, className) {
  const art = document.createElement("span");
  art.className = className;
  if (!work?.image) {
    art.classList.add("is-missing");
    return art;
  }
  const img = document.createElement("img");
  img.decoding = "async";
  img.alt = guideWorkDisplayName(work);
  setImageFallbackChain(img, [work.image], () => art.classList.add("is-missing"));
  art.append(img);
  return art;
}

function createGuideWorkCard(work, member, options = {}) {
  const progress = guideWorkProgress(work, member);
  const card = document.createElement("button");
  card.type = "button";
  card.className = `${options.cardClass || "guide-series-card"}${progress.lit ? " is-lit" : ""}`;
  card.append(createGuideWorkArt(work, options.artClass || "guide-series-art"));
  if (options.compact) {
    const text = document.createElement("span");
    text.className = "member-guide-text";
    text.innerHTML = `<strong>${escapeHtml(guideWorkDisplayName(work))}</strong><span>${progress.lit}/${progress.total}</span>`;
    card.append(text);
  } else {
    const label = document.createElement("strong");
    label.textContent = guideWorkDisplayName(work);
    const count = document.createElement("span");
    count.textContent = `${progress.lit}/${progress.total}`;
    card.append(label, count);
  }
  card.addEventListener("click", () => openGuideWork(work, member));
  return card;
}

function renderGuide(guide) {
  const member = activeGuideMember();
  const sets = guideCollectionSets(member);
  const statusByGroup = new Map(guide.groups.map((g) => [g.key, guideGroupStatus(g, sets)]));
  const litTotal = [...statusByGroup.values()].filter((s) => s !== "none").length;
  elements.guideSummary.textContent = t("guideComplete", { collected: litTotal, total: guide.groups.length });

  elements.guideBody.innerHTML = "";
  const workScore = (work) => Math.max(0, ...guide.groups.filter((g) => g.work_id === work.work_id).map(guideGroupPreferenceScore));
  const orderedWorks = [...guide.works].sort((a, b) => workScore(b) - workScore(a) || Number(a.work_id) - Number(b.work_id));
  const familyKeys = guideFamilyKeys(orderedWorks);
  renderGuideFamilyFilter(familyKeys);
  const selectedFamilies = state.guideSeriesFilters || new Set();
  const visibleFamilyKeys = selectedFamilies.size ? familyKeys.filter((key) => selectedFamilies.has(key)) : familyKeys;
  for (const familyKey of visibleFamilyKeys) {
    const works = orderedWorks.filter((work) => guideWorkFamily(work) === familyKey);
    if (!works.length) continue;
    const sectionLit = works.reduce((sum, work) => sum + guideGroupsForWork(work, member).filter((g) => statusByGroup.get(g.key) !== "none").length, 0);
    const sectionTotal = works.reduce((sum, work) => sum + guideGroupsForWork(work, member).length, 0);

    const section = document.createElement("section");
    section.className = "guide-work";
    const head = document.createElement("div");
    head.className = "guide-work-head";
    head.innerHTML = `<h3>${escapeHtml(guideFamilyLabel(familyKey))}</h3><span>${sectionLit}/${sectionTotal}</span>`;
    section.append(head);

    const grid = document.createElement("div");
    grid.className = "guide-series-grid";
    for (const work of works) {
      grid.append(createGuideWorkCard(work, member));
    }
    section.append(grid);
    elements.guideBody.append(section);
  }
}

function atlasLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[state.language] || value.zh || value.en || value.ja || value.ko || "";
}

function renderAtlasGuide(tab, atlasGroups) {
  const groups = atlasGroups?.[tab] || [];
  const member = activeGuideMember();
  const sets = guideCollectionSets(member);
  elements.guideSummary.textContent = t("guideComplete", {
    collected: groups.reduce((sum, group) => sum + (group.kit_ids || []).filter((id) => sets.owned.has(id) || sets.wanted.has(id)).length, 0),
    total: groups.reduce((sum, group) => sum + (group.kit_ids || []).length, 0),
  });
  elements.guideBody.innerHTML = "";

  const section = document.createElement("section");
  section.className = "guide-work";
  const grid = document.createElement("div");
  grid.className = "guide-series-grid guide-atlas-grid";
  for (const group of groups) {
    grid.append(createAtlasGroupCard(group, tab, member, sets));
  }
  section.append(grid);
  elements.guideBody.append(section);
}

function createAtlasGroupCard(group, tab, member, sets) {
  const kitIds = group.kit_ids || [];
  const lit = kitIds.filter((id) => sets.owned.has(id) || sets.wanted.has(id)).length;
  const card = document.createElement("button");
  card.type = "button";
  card.className = `guide-series-card atlas-group-card${lit ? " is-lit" : ""}`;

  const art = document.createElement("span");
  art.className = "guide-series-art";
  if (group.image) {
    const img = document.createElement("img");
    img.alt = atlasLabel(group.labels);
    setImageFallbackChain(img, [group.image], () => art.classList.add("is-missing"));
    art.append(img);
  } else {
    art.classList.add("is-missing");
  }
  const label = document.createElement("strong");
  label.textContent = atlasLabel(group.labels);
  const meta = document.createElement("span");
  meta.textContent = `${lit}/${kitIds.length}${atlasLabel(group.subtitle) ? ` · ${atlasLabel(group.subtitle)}` : ""}`;
  card.append(art, label, meta);
  card.addEventListener("click", () => openAtlasGroup(group, tab, member));
  return card;
}

function renderGundamTimeline(atlasGroups) {
  const groups = atlasGroups?.gundam_timeline || [];
  elements.guideSummary.textContent = `${groups.reduce((sum, group) => sum + (group.works?.length || 0), 0)} works`;
  elements.guideBody.innerHTML = "";
  const section = document.createElement("section");
  section.className = "guide-work";
  const grid = document.createElement("div");
  grid.className = "guide-series-grid guide-atlas-grid";
  for (const group of groups) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "guide-series-card atlas-group-card";
    const art = document.createElement("span");
    art.className = "guide-series-art";
    if (group.image) {
      const img = document.createElement("img");
      img.alt = atlasLabel(group.labels);
      setImageFallbackChain(img, [group.image], () => art.classList.add("is-missing"));
      art.append(img);
    } else {
      art.classList.add("is-missing");
    }
    const label = document.createElement("strong");
    label.textContent = atlasLabel(group.labels);
    const meta = document.createElement("span");
    meta.textContent = atlasLabel(group.subtitle);
    card.append(art, label, meta);
    card.addEventListener("click", () => openGundamTimelineGroup(group));
    grid.append(card);
  }
  section.append(grid);
  elements.guideBody.append(section);
}

async function openGundamTimelineGroup(group) {
  await ensureGuideData();
  elements.guideUnitArt.innerHTML = "";
  if (group.image) {
    const img = document.createElement("img");
    img.alt = atlasLabel(group.labels);
    setImageFallbackChain(img, [group.image], () => img.remove());
    elements.guideUnitArt.append(img);
  }
  elements.guideUnitName.textContent = atlasLabel(group.labels);
  elements.guideUnitMeta.textContent = atlasLabel(group.subtitle);
  elements.guideUnitVariants.innerHTML = "";
  elements.guideUnitKits.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "guide-series-grid guide-atlas-grid";
  for (const work of group.works || []) {
    grid.append(createGuideWorkCard(work, activeGuideMember()));
  }
  elements.guideUnitKits.append(grid);
  openDialog(elements.guideUnitDialog);
}

async function openAtlasGroup(group, tab, member = activeGuideMember()) {
  await ensureCatalogComplete();
  state.activeGuideMember = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember());
  const kits = (group.kit_ids || []).map(displayKitById).filter(Boolean);
  const sets = guideCollectionSets(member);
  const lit = kits.filter((kit) => sets.owned.has(kit.kit_id) || sets.wanted.has(kit.kit_id)).length;
  elements.guideUnitArt.innerHTML = "";
  if (group.image) {
    const img = document.createElement("img");
    img.alt = atlasLabel(group.labels);
    setImageFallbackChain(img, [group.image], () => img.remove());
    elements.guideUnitArt.append(img);
  }
  elements.guideUnitName.textContent = atlasLabel(group.labels);
  elements.guideUnitMeta.textContent = `${franchiseShortLabel(tab)} · ${lit}/${kits.length}${atlasLabel(group.subtitle) ? ` · ${atlasLabel(group.subtitle)}` : ""}`;
  elements.guideUnitVariants.innerHTML = "";
  appendAtlasGroupItems(group);
  elements.guideUnitKits.innerHTML = "";
  if (!kits.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoKits");
    elements.guideUnitKits.append(empty);
  } else {
    const list = document.createElement("div");
    list.className = "atlas-kit-list";
    for (const kit of kits.sort((a, b) => atlasKitScore(b, sets) - atlasKitScore(a, sets) || kitDisplayName(a).localeCompare(kitDisplayName(b)))) {
      list.append(atlasKitRow(kit, group, tab, member));
    }
    elements.guideUnitKits.append(list);
  }
  openDialog(elements.guideUnitDialog);
}

function appendAtlasGroupItems(group) {
  const items = (group.items || []).filter(Boolean);
  if (!items.length) return;
  const limit = group.id?.startsWith("gen") ? 18 : 24;
  for (const item of items.slice(0, limit)) {
    const chip = document.createElement("span");
    chip.className = "guide-variant-chip";
    chip.textContent = item;
    elements.guideUnitVariants.append(chip);
  }
  if (items.length > limit) {
    const chip = document.createElement("span");
    chip.className = "guide-variant-chip";
    chip.textContent = `+${items.length - limit}`;
    elements.guideUnitVariants.append(chip);
  }
}

function atlasKitScore(kit, sets) {
  if (sets.owned.has(kit.kit_id)) return 2;
  if (sets.wanted.has(kit.kit_id)) return 1;
  return 0;
}

function atlasKitRow(kit, group, tab, member = activeGuideMember()) {
  const row = document.createElement("div");
  row.className = "guide-kit-row";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "guide-kit-face";
  const thumb = document.createElement("span");
  thumb.className = "guide-kit-thumb";
  appendImageWithFallback(thumb, kit, { alt: kitDisplayName(kit) });
  const text = document.createElement("span");
  text.className = "guide-kit-text";
  text.innerHTML = `<strong>${escapeHtml(kitDisplayName(kit))}</strong><span>${escapeHtml(seriesLabelFromKit(kit))} · ${escapeHtml(gradeShortLabel(kit))}</span>`;
  face.append(thumb, text);
  face.addEventListener("click", () => {
    closeDialog(elements.guideUnitDialog);
    openDetail(kit);
  });
  const actions = document.createElement("span");
  actions.className = "guide-kit-actions";
  for (const type of COLLECTION_TYPES) {
    const active = kitInCollection(kit.kit_id, type, editableCollectionMember());
    const button = document.createElement("button");
    button.type = "button";
    button.className = `guide-add-button is-${type}${active ? " is-active" : ""}`;
    button.textContent = active ? t(type === "owned" ? "unmarkOwned" : "unmarkWanted") : t(type === "owned" ? "markOwned" : "markWanted");
    button.disabled = activeGuideMember()?.name && safeMemberName(activeGuideMember().name) !== editableCollectionMember();
    button.addEventListener("click", () => {
      setKitCollectionStatus(kit.kit_id, type, !active);
      openAtlasGroup(group, tab, member);
    });
    actions.append(button);
  }
  row.append(face, actions);
  return row;
}

function guideFamilyKeys(works) {
  const preferred = ["uc", "seed", "double_o", "wing", "iron_blooded", "witch", "gquuuuuux", "age", "build", "sd", "g", "x", "turn_a", "g_reco", "game", "other"];
  const available = new Set(works.map(guideWorkFamily));
  return preferred.filter((key) => available.has(key));
}

function renderGuideFamilyFilter(familyKeys) {
  const filter = document.createElement("div");
  filter.className = "guide-family-filter";
  const selected = state.guideSeriesFilters || new Set();
  const all = document.createElement("button");
  all.type = "button";
  all.className = `guide-family-chip${selected.size ? "" : " is-active"}`;
  all.textContent = guideFamilyLabel("all");
  all.addEventListener("click", () => {
    state.guideSeriesFilters = new Set();
    saveGuideSeriesFilters();
    renderGuide(state.guide);
  });
  filter.append(all);
  for (const key of familyKeys) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `guide-family-chip${selected.has(key) ? " is-active" : ""}`;
    chip.textContent = guideFamilyLabel(key);
    chip.addEventListener("click", () => {
      state.guideSeriesFilters = state.guideSeriesFilters || new Set();
      if (state.guideSeriesFilters.has(key)) state.guideSeriesFilters.delete(key);
      else state.guideSeriesFilters.add(key);
      saveGuideSeriesFilters();
      renderGuide(state.guide);
    });
    filter.append(chip);
  }
  elements.guideBody.append(filter);
}

function guideGroupsForWork(work, member = activeGuideMember()) {
  const sets = guideCollectionSets(member);
  return (state.guide?.groups || [])
    .filter((g) => g.work_id === work.work_id)
    .sort((a, b) => {
      const statusOrder = { owned: 2, wanted: 1, none: 0 };
      return (
        statusOrder[guideGroupStatus(b, sets)] - statusOrder[guideGroupStatus(a, sets)] ||
        guideGroupPreferenceScore(b) - guideGroupPreferenceScore(a) ||
        a.name.localeCompare(b.name)
      );
    });
}

function openGuideWork(work, member = activeGuideMember()) {
  state.guideUnitBack = null;
  state.activeGuideMember = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember());
  const groups = guideGroupsForWork(work, member);
  const sets = guideCollectionSets(member);
  const lit = groups.filter((group) => guideGroupStatus(group, sets) !== "none").length;
  elements.guideUnitArt.innerHTML = "";
  if (work.image) {
    const img = document.createElement("img");
    img.alt = guideWorkDisplayName(work);
    setImageFallbackChain(img, [work.image], () => img.remove());
    elements.guideUnitArt.append(img);
  }
  elements.guideUnitName.textContent = guideWorkDisplayName(work);
  elements.guideUnitMeta.textContent = `${guideFamilyLabel(guideWorkFamily(work))} · ${lit}/${groups.length}`;
  elements.guideUnitVariants.innerHTML = "";
  elements.guideUnitKits.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "guide-grid";
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoUnits");
    elements.guideUnitKits.append(empty);
    openDialog(elements.guideUnitDialog);
    return;
  }
  for (const group of groups) {
    const status = guideGroupStatus(group, sets);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `guide-cell is-${status}`;
    const art = document.createElement("span");
    art.className = "guide-cell-art";
    const img = document.createElement("img");
    img.decoding = "async";
    img.alt = group.name;
    guideIconImage(img, group.icon, () => {
      img.remove();
      art.classList.add("is-missing");
    });
    art.append(img);
    const label = document.createElement("span");
    label.className = "guide-cell-name";
    label.textContent = group.name;
    cell.append(art, label);
    if (status === "owned") cell.append(badgeEl("✓", "guide-badge-owned"));
    else if (status === "wanted") cell.append(badgeEl("★", "guide-badge-wanted"));
    cell.addEventListener("click", () => openGuideUnit(group, status, member));
    grid.append(cell);
  }
  elements.guideUnitKits.append(grid);
  openDialog(elements.guideUnitDialog);
}

function badgeEl(text, className) {
  const span = document.createElement("span");
  span.className = `guide-badge ${className}`;
  span.textContent = text;
  return span;
}

// Tapping a cell shows its merged variants and — the reverse link the user asked
// for — the matching catalog kits, each with quick add-to-owned/wanted buttons.
function openGuideUnit(group, status, member = activeGuideMember()) {
  state.activeGuideMember = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember());
  state.guideUnitBack = { workId: Number(group.work_id), member: state.activeGuideMember };
  const isSelfGuide = state.activeGuideMember === editableCollectionMember();
  elements.guideUnitArt.innerHTML = "";
  const unitImg = document.createElement("img");
  unitImg.alt = group.name;
  guideIconImage(unitImg, group.icon, () => unitImg.remove());
  elements.guideUnitArt.append(unitImg);
  elements.guideUnitName.textContent = group.name;
  const statusLabel = { owned: t("ownedList"), wanted: t("wantedList"), none: t("guideNotCollected") }[status];
  elements.guideUnitMeta.textContent = `${group.work} · ${statusLabel}`;

  elements.guideUnitVariants.innerHTML = "";
  for (const variant of [...new Set(group.variants)]) {
    const chip = document.createElement("span");
    chip.className = "guide-variant-chip";
    chip.textContent = variant;
    elements.guideUnitVariants.append(chip);
  }
  // Manual split/merge: if a base-name merge lumped in variants that shouldn't be
  // together (or vice-versa), let the user override it. Splitting a merged cell breaks
  // every variant of that base name into its own cell; re-merging undoes it.
  const canSplit = group.split || new Set(group.variants).size > 1 || state.guideSplits?.has(group.merge_key);
  if (canSplit && isSelfGuide) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "guide-split-toggle";
    const isSplit = state.guideSplits?.has(group.merge_key);
    toggle.textContent = isSplit ? t("guideMerge") : t("guideSplit");
    toggle.addEventListener("click", () => {
      state.guideSplits = state.guideSplits || new Set();
      if (isSplit) state.guideSplits.delete(group.merge_key);
      else state.guideSplits.add(group.merge_key);
      saveGuideSplits();
      refreshGuideGroups();
      state.guideUnitBack = null;
      closeDialog(elements.guideUnitDialog);
      if (state.activeView === "guide") renderGuide(state.guide);
      renderUserGuideValue();
    });
    elements.guideUnitVariants.append(toggle);
  }
  // Manual light-up: mark a cell collected by hand regardless of any matching kit.
  if (isSelfGuide) {
    const manualToggle = document.createElement("button");
    manualToggle.type = "button";
    const manuallyLit = guideGroupManuallyLit(group);
    manualToggle.className = `guide-light-toggle${manuallyLit ? " is-active" : ""}`;
    manualToggle.textContent = manuallyLit ? t("guideUnlight") : t("guideLight");
    manualToggle.addEventListener("click", () => {
      state.guideManualLit = state.guideManualLit || new Set();
      const nowLit = !guideGroupManuallyLit(group);
      for (const id of group.unit_ids) {
        if (nowLit) state.guideManualLit.add(id);
        else state.guideManualLit.delete(id);
      }
      saveGuideManualLit();
      openGuideUnit(group, guideGroupStatus(group, guideCollectionSets(member)), member);
      if (state.activeView === "guide") renderGuide(state.guide);
      renderUserGuideValue();
    });
    elements.guideUnitVariants.append(manualToggle);
  }

  const kits = group.kit_ids.map(displayKitById).filter(Boolean);
  elements.guideUnitKits.innerHTML = "";
  if (!kits.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoKits");
    elements.guideUnitKits.append(empty);
  } else {
    for (const kit of kits.slice(0, 30)) {
      elements.guideUnitKits.append(guideKitRow(kit, group, status, member));
    }
  }
  openDialog(elements.guideUnitDialog);
}

function closeGuideUnitLayer() {
  if (state.guideUnitBack) {
    const { workId, member } = state.guideUnitBack;
    const work = state.guide?.works?.find((item) => Number(item.work_id) === Number(workId));
    state.guideUnitBack = null;
    if (work) {
      openGuideWork(work, member);
      return;
    }
  }
  state.guideUnitBack = null;
  closeDialog(elements.guideUnitDialog);
}

function guideKitRow(kit, group, groupStatus, member = activeGuideMember()) {
  const sets = guideCollectionSets(member);
  const isSelfGuide = safeMemberName(typeof member === "string" ? member : member?.name || editableCollectionMember()) === editableCollectionMember();
  const row = document.createElement("div");
  row.className = "guide-kit-row";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "guide-kit-face";
  const thumb = document.createElement("span");
  thumb.className = "guide-kit-thumb";
  appendImageWithFallback(thumb, kit, { onExhausted: () => (thumb.textContent = gradeShortLabel(kit)) });
  const text = document.createElement("span");
  text.className = "guide-kit-text";
  text.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><span>${escapeHtml(seriesLabelFromKit(kit))} · ${escapeHtml(gradeShortLabel(kit))}</span>`;
  face.append(thumb, text);
  face.addEventListener("click", () => {
    // Keep the 图鉴 gallery open underneath so backing out of the kit detail
    // returns here instead of dropping all the way to the main view.
    state.guideUnitBack = null;
    closeDialog(elements.guideUnitDialog);
    openDetail(kit);
  });

  const actions = document.createElement("div");
  actions.className = "guide-kit-actions";
  const owned = sets.owned.has(kit.kit_id);
  const wanted = sets.wanted.has(kit.kit_id);
  if (isSelfGuide) {
    actions.append(
      guideAddButton(kit, "owned", owned, group, groupStatus, member),
      guideAddButton(kit, "wanted", wanted, group, groupStatus, member),
    );
  }
  row.append(face, actions);
  return row;
}

function guideAddButton(kit, type, active, group, groupStatus, member = activeGuideMember()) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `guide-add-button is-${type}${active ? " is-active" : ""}`;
  const keySuffix = type === "owned" ? "Owned" : "Wanted";
  button.textContent = active ? t(`unmark${keySuffix}`) : t(`mark${keySuffix}`);
  button.disabled = !canEditSharedData();
  button.addEventListener("click", () => {
    setKitCollectionStatus(kit.kit_id, type, !active);
    openGuideUnit(group, guideGroupStatus({ ...group, kit_ids: group.kit_ids }, guideCollectionSets(member)), member);
    if (state.activeView === "guide") renderGuide(state.guide);
    renderUserGuideValue();
  });
  return button;
}

function renderUserGuideValue() {
  if (!elements.userGuideValue || !state.guide) return;
  const sets = guideCollectionSets();
  const lit = state.guide.groups.filter((g) => guideGroupStatus(g, sets) !== "none").length;
  elements.userGuideValue.textContent = `${lit}/${state.guide.groups.length}`;
}

// ---------------------------------------------------------------------------
// BBX 图鉴 (Beyblade X picture book): each 陀螺 (top) is a Blade+Ratchet+Bit combo.
// The user marks which parts they own; a top lights up by parts completion, and
// missing parts are traced back to the product that ships them.
// ---------------------------------------------------------------------------
const BBX_OWNED_PARTS_KEY = "gunpula-bbx-owned-parts-v1";
const BBX_COMPONENT_FIELDS = [
  ["blade_id", "blade"],
  ["ratchet_id", "ratchet"],
  ["bit_id", "bit"],
  ["assist_blade_id", "assist_blade"],
  ["lock_chip_id", "lock_chip"],
  ["main_blade_id", "main_blade"],
  ["metal_blade_id", "metal_blade"],
  ["over_blade_id", "over_blade"],
];

function loadBbxOwnedParts() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BBX_OWNED_PARTS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveBbxOwnedParts() {
  localStorage.setItem(BBX_OWNED_PARTS_KEY, JSON.stringify([...(state.bbxOwnedParts || [])]));
}

// Manual override linking a catalog kit_id to a 陀螺's base_set_id, for the
// event/exclusive kits whose code can't be auto-matched. Written from both the
// 图鉴 side (link a kit into this top) and the catalog side (put this kit into a
// top), so the two entry points share one store.
const BBX_MANUAL_MAP_KEY = "gunpula-bbx-manual-map-v1";

function loadBbxManualMap() {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(BBX_MANUAL_MAP_KEY) || "{}")));
  } catch {
    return new Map();
  }
}

function saveBbxManualMap() {
  localStorage.setItem(BBX_MANUAL_MAP_KEY, JSON.stringify(Object.fromEntries(state.bbxManualMap || new Map())));
}

function bbxLocalize(names = {}) {
  return names[state.language] || names.en || names.zh || names.ja || "";
}

function bbxNormalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Canonical product code from a catalog kit_id: leading line letters + the first
// number group only, so a catalog sequence suffix (cx-13-122) or an event name
// suffix (cx00-tiga) collapses to the real set code (CX13 / CX00).
function bbxKitCode(kitId) {
  const s = String(kitId).replace(/^beyblade-x-/, "");
  const m = /^([a-z]+)-?(\d+)/i.exec(s);
  return m ? (m[1] + m[2]).toUpperCase() : bbxNormalizeCode(s);
}

// Same letters+first-number reduction for a bbx product_id / base_set_id.
function bbxSetCode(value) {
  const m = /^([A-Za-z]+)-?(\d+)/.exec(String(value || ""));
  return m ? (m[1] + m[2]).toUpperCase() : bbxNormalizeCode(value);
}

async function ensureBbxData() {
  if (state.bbx) return state.bbx;
  if (!state.bbxOwnedParts) state.bbxOwnedParts = loadBbxOwnedParts();
  if (!state.bbxManualMap) state.bbxManualMap = loadBbxManualMap();
  const db = await loadOptionalJson("../data/bbx-database.json");
  if (!db?.series) {
    state.bbx = { tops: [], lines: [], partIndex: new Map(), productByBaseSet: new Map(), partsByBaseSet: new Map(), kitsByBaseSet: new Map(), beybladeKits: [], unmatchedKitIds: [] };
    return state.bbx;
  }
  const partIndex = new Map();
  for (const list of Object.values(db.parts || {})) for (const part of list) partIndex.set(part.part_id, part);

  const productByBaseSet = new Map();
  for (const product of db.products || []) {
    if (product.base_set_id && !productByBaseSet.has(product.base_set_id)) productByBaseSet.set(product.base_set_id, product);
  }
  // Parts grouped by their source product, for "buy this to get these parts".
  const partsByBaseSet = new Map();
  for (const part of partIndex.values()) {
    if (!part.base_set_id) continue;
    if (!partsByBaseSet.has(part.base_set_id)) partsByBaseSet.set(part.base_set_id, []);
    partsByBaseSet.get(part.base_set_id).push(part);
  }

  // Every base_set_id a 陀螺 or product references, indexed by its canonical set
  // code, so a catalog kit's code can resolve to the matching base set(s).
  const baseSetsByCode = new Map();
  const addBaseSet = (code, baseSetId) => {
    if (!code || !baseSetId) return;
    if (!baseSetsByCode.has(code)) baseSetsByCode.set(code, new Set());
    baseSetsByCode.get(code).add(baseSetId);
  };
  for (const product of db.products || []) {
    addBaseSet(bbxSetCode(product.product_id), product.base_set_id);
    addBaseSet(bbxSetCode(product.base_set_id), product.base_set_id);
  }
  for (const s of db.series) addBaseSet(bbxSetCode(s.base_set_id), s.base_set_id);

  // Catalog beyblade kits mapped to their base set(s): auto by code, plus any
  // manual override. Kits that resolve to nothing are surfaced for manual linking.
  const beybladeKits = state.kits.filter((k) => k.franchise === "beyblade");
  const kitsByBaseSet = new Map();
  const unmatchedKitIds = [];
  const linkKit = (baseSetId, kitId) => {
    if (!kitsByBaseSet.has(baseSetId)) kitsByBaseSet.set(baseSetId, new Set());
    kitsByBaseSet.get(baseSetId).add(kitId);
  };
  for (const kit of beybladeKits) {
    const manual = state.bbxManualMap.get(kit.kit_id);
    const autoSets = baseSetsByCode.get(bbxKitCode(kit.kit_id));
    let linked = false;
    if (manual) {
      linkKit(manual, kit.kit_id);
      linked = true;
    }
    if (autoSets) {
      for (const bs of autoSets) linkKit(bs, kit.kit_id);
      linked = true;
    }
    if (!linked) unmatchedKitIds.push(kit.kit_id);
  }

  const tops = db.series
    .map((s) => {
      const components = BBX_COMPONENT_FIELDS.map(([field, type]) => ({ type, part_id: s[field] })).filter((c) => c.part_id);
      return {
        series_id: s.series_id,
        name: bbxLocalize(s.names) || s.model_name || s.series_id,
        base_set_id: s.base_set_id,
        components,
        order: s.collection_order ?? 9999,
        line: (s.base_set_id.match(/^[A-Za-z]+/) || ["?"])[0].toUpperCase(),
      };
    })
    .filter((t) => t.components.length)
    .sort((a, b) => a.order - b.order);

  const lines = [...new Set(tops.map((t) => t.line))];

  // Parts kept in their catalog category order for the 部品 browser, and the
  // reverse index part → 陀螺 that ship/use it (for "which top is this from").
  const partsByType = new Map();
  for (const [type, list] of Object.entries(db.parts || {})) {
    partsByType.set(type, [...list].sort((a, b) => (a.collection_order ?? 9999) - (b.collection_order ?? 9999)));
  }
  const topsByPartId = new Map();
  for (const top of tops) {
    for (const comp of top.components) {
      if (!topsByPartId.has(comp.part_id)) topsByPartId.set(comp.part_id, []);
      topsByPartId.get(comp.part_id).push(top);
    }
  }

  state.bbx = { tops, lines, partIndex, productByBaseSet, partsByBaseSet, kitsByBaseSet, beybladeKits, unmatchedKitIds, partsByType, topsByPartId };
  return state.bbx;
}

// Catalog kit_ids linked to a 陀螺 (auto-matched by code or manually mapped).
function bbxTopKitIds(top) {
  return [...(state.bbx?.kitsByBaseSet.get(top.base_set_id) || [])];
}

// Combined status: your collection (owned/wanted the linked product, like the
// Gundam guide) layered over per-part ownership. Precedence: fully owned →
// wanted → partially assembled → none.
function bbxTopStatus(top) {
  const owned = state.bbxOwnedParts || new Set();
  const have = top.components.filter((c) => owned.has(c.part_id)).length;
  const total = top.components.length;
  const sets = guideCollectionSets();
  const kitIds = bbxTopKitIds(top);
  const ownsProduct = kitIds.some((id) => sets.owned.has(id));
  const wantsProduct = kitIds.some((id) => sets.wanted.has(id));

  let status = "none";
  if (ownsProduct || (total > 0 && have === total)) status = "owned";
  else if (wantsProduct) status = "wanted";
  else if (have > 0) status = "partial";
  return { status, have, total, ownsProduct, wantsProduct };
}

function bbxProductImage(baseSetId) {
  return state.bbx?.productByBaseSet.get(baseSetId)?.image || null;
}

function bbxImageCandidates(record, preferFallback = false) {
  if (!record) return [];
  const primary = [record.image, record.image_remote].filter(Boolean);
  const fallback = [record.image_fallback].filter(Boolean);
  return [...new Set([...(preferFallback ? fallback : primary), ...(preferFallback ? primary : fallback)].filter(Boolean))];
}

function setImageFallbackChain(img, urls, onExhausted) {
  return chainImageFallbacks(img, urls, onExhausted);
}

// Ordered image candidates for a 陀螺: its product box, else the blade art (some
// gift/variant sets ship no product image), each tried before the next.
function bbxTopImageCandidates(top) {
  const urls = [];
  const product = state.bbx?.productByBaseSet.get(top.base_set_id);
  urls.push(...bbxImageCandidates(product));
  const bladeComp = top.components.find((c) => c.type === "blade");
  const blade = bladeComp ? state.bbx?.partIndex.get(bladeComp.part_id) : null;
  urls.push(...bbxImageCandidates(blade));
  return [...new Set(urls)];
}

function bbxTopArtImage(img, top, onExhausted) {
  return setImageFallbackChain(img, bbxTopImageCandidates(top), onExhausted);
}

// Part thumbnail: primary image with an optional fallback URL, then hide the
// frame if neither loads (some parts have no artwork on the source site).
function bbxPartThumb(part) {
  const frame = document.createElement("span");
  frame.className = "bbx-part-thumb";
  const urls = bbxImageCandidates(part);
  if (!urls.length) {
    frame.classList.add("is-missing");
    return frame;
  }
  const img = document.createElement("img");
  img.decoding = "async";
  img.alt = "";
  setImageFallbackChain(img, urls, () => {
    img.remove();
    frame.classList.add("is-missing");
  });
  frame.append(img);
  return frame;
}

function renderBbxGuide(bbx) {
  const total = bbx.tops.length;
  const complete = bbx.tops.filter((t) => bbxTopStatus(t).status === "owned").length;
  elements.guideSummary.textContent = t("bbxComplete", { collected: complete, total });

  elements.guideBody.innerHTML = "";
  if (!total) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoKits");
    elements.guideBody.append(empty);
    return;
  }
  for (const line of bbx.lines) {
    const tops = bbx.tops.filter((tp) => tp.line === line);
    if (!tops.length) continue;
    const lit = tops.filter((tp) => bbxTopStatus(tp).status === "owned").length;
    const section = document.createElement("section");
    section.className = "guide-work";
    const head = document.createElement("div");
    head.className = "guide-work-head";
    head.innerHTML = `<h3>${escapeHtml(line)}</h3><span>${lit}/${tops.length}</span>`;
    section.append(head);
    const grid = document.createElement("div");
    grid.className = "guide-grid";
    for (const top of tops) {
      const info = bbxTopStatus(top);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `guide-cell is-${info.status}`;
      const art = document.createElement("span");
      art.className = "guide-cell-art";
      const img = document.createElement("img");
      img.decoding = "async";
      img.alt = top.name;
      const hasArt = bbxTopArtImage(img, top, () => {
        img.remove();
        art.classList.add("is-missing");
      });
      if (hasArt) art.append(img);
      else art.classList.add("is-missing");
      const label = document.createElement("span");
      label.className = "guide-cell-name";
      label.textContent = top.name;
      cell.append(art, label);
      const badgeClass = info.status === "owned" ? "guide-badge-owned" : info.status === "wanted" ? "guide-badge-wanted" : "guide-badge-count";
      cell.append(badgeEl(`${info.have}/${info.total}`, badgeClass));
      cell.addEventListener("click", () => openBbxTop(top));
      grid.append(cell);
    }
    section.append(grid);
    elements.guideBody.append(section);
  }
}

function bbxPartTypeLabel(type) {
  return t(`bbxPart_${type}`) || type;
}

// Category-filtered parts browser (部品 tab): blade / ratchet / bit / lock chip …
// like the phstudy category page. Tapping a part opens its source 陀螺.
const BBX_PART_TYPE_ORDER = ["blade", "ratchet", "bit", "lock_chip", "assist_blade", "main_blade", "metal_blade", "over_blade"];

function renderBbxParts(bbx) {
  if (!state.bbxPartType) state.bbxPartType = "blade";
  const types = BBX_PART_TYPE_ORDER.filter((type) => (bbx.partsByType.get(type) || []).length);
  if (!types.includes(state.bbxPartType)) state.bbxPartType = types[0];
  const parts = bbx.partsByType.get(state.bbxPartType) || [];
  elements.guideSummary.textContent = t("bbxPartsCount", { count: parts.length });

  elements.guideBody.innerHTML = "";
  if (!types.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoKits");
    elements.guideBody.append(empty);
    return;
  }

  const chips = document.createElement("div");
  chips.className = "bbx-part-cats";
  for (const type of types) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `bbx-part-cat${type === state.bbxPartType ? " is-active" : ""}`;
    chip.textContent = bbxPartTypeLabel(type);
    chip.addEventListener("click", () => {
      state.bbxPartType = type;
      renderBbxParts(bbx);
      applyGuideColorMode();
    });
    chips.append(chip);
  }
  elements.guideBody.append(chips);

  const grid = document.createElement("div");
  grid.className = "guide-grid bbx-part-grid";
  for (const part of parts) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "guide-cell bbx-part-cell";
    const art = document.createElement("span");
    art.className = "guide-cell-art";
    const img = document.createElement("img");
    img.decoding = "async";
    img.alt = "";
    // Grid thumbnails are tiny: prefer the lighter app-folder image (blades' main
    // image is a heavy high-res site render), keeping the sharp one for detail.
    // Eager on purpose — loading="lazy" never fires inside a showModal() dialog.
    setImageFallbackChain(img, bbxImageCandidates(part, true), () => {
      img.remove();
      art.classList.add("is-missing");
    });
    art.append(img);
    const label = document.createElement("span");
    label.className = "guide-cell-name";
    label.textContent = bbxLocalize(part.names) || part.part_id;
    cell.append(art, label);
    const usedIn = bbx.topsByPartId.get(part.part_id)?.length || 0;
    if (usedIn) cell.append(badgeEl(String(usedIn), "guide-badge-count"));
    cell.addEventListener("click", () => openBbxPart(part));
    grid.append(cell);
  }
  elements.guideBody.append(grid);
}

// Part detail: image, stats, and the 陀螺 that ship/use this part (the reverse
// link the user asked for — "which top is this from").
function openBbxPart(part) {
  const bbx = state.bbx;
  elements.bbxPartArt.innerHTML = "";
  const img = document.createElement("img");
  img.alt = bbxLocalize(part.names) || part.part_id;
  if (setImageFallbackChain(img, bbxImageCandidates(part), () => img.remove())) {
    elements.bbxPartArt.append(img);
  }
  elements.bbxPartName.textContent = bbxLocalize(part.names) || part.part_id;
  elements.bbxPartMeta.textContent = [bbxPartTypeLabel(part.type), part.weight_g ? `${part.weight_g}g` : ""].filter(Boolean).join(" · ");

  elements.bbxPartStats.innerHTML = "";
  const stats = part.stats || {};
  const statFields = [
    ["attack", t("bbxStatAttack")],
    ["defense", t("bbxStatDefense")],
    ["stamina", t("bbxStatStamina")],
    ["burst", t("bbxStatBurst")],
    ["dash", t("bbxStatDash")],
  ];
  for (const [key, label] of statFields) {
    const value = Number(stats[key]) || 0;
    if (!value) continue;
    const chip = document.createElement("span");
    chip.className = "bbx-stat-chip";
    chip.innerHTML = `<em>${escapeHtml(label)}</em><strong>${value}</strong>`;
    elements.bbxPartStats.append(chip);
  }

  elements.bbxPartTops.innerHTML = "";
  const tops = bbx.topsByPartId.get(part.part_id) || [];
  if (!tops.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("bbxPartNoTops");
    elements.bbxPartTops.append(empty);
  } else {
    for (const top of tops.slice(0, 20)) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bbx-part-top-row";
      const thumb = document.createElement("span");
      thumb.className = "bbx-part-thumb";
      const timg = document.createElement("img");
      timg.alt = "";
      if (!bbxTopArtImage(timg, top, () => thumb.classList.add("is-missing"))) thumb.classList.add("is-missing");
      else thumb.append(timg);
      const text = document.createElement("span");
      text.className = "bbx-part-text";
      const product = bbx.productByBaseSet.get(top.base_set_id);
      text.innerHTML = `<strong>${escapeHtml(top.name)}</strong><em>${escapeHtml(product ? bbxLocalize(product.names) : top.base_set_id)}</em>`;
      row.append(thumb, text);
      row.addEventListener("click", () => {
        closeDialog(elements.bbxPartDialog);
        openBbxTop(top);
      });
      elements.bbxPartTops.append(row);
    }
  }

  openDialog(elements.bbxPartDialog);
}

function openBbxTop(top) {
  const bbx = state.bbx;
  elements.bbxTopArt.innerHTML = "";
  const heroImg = document.createElement("img");
  heroImg.alt = top.name;
  if (bbxTopArtImage(heroImg, top, () => heroImg.remove())) elements.bbxTopArt.append(heroImg);
  elements.bbxTopName.textContent = top.name;
  const product = bbx.productByBaseSet.get(top.base_set_id);
  const info = bbxTopStatus(top);
  elements.bbxTopMeta.textContent = `${product ? bbxLocalize(product.names) : top.base_set_id} · ${info.have}/${info.total}`;

  // Parts, each with an own/not-own toggle.
  elements.bbxTopParts.innerHTML = "";
  for (const comp of top.components) {
    const part = bbx.partIndex.get(comp.part_id);
    const owned = state.bbxOwnedParts?.has(comp.part_id);
    const row = document.createElement("div");
    row.className = "bbx-part-row";
    const thumb = bbxPartThumb(part);
    const text = document.createElement("span");
    text.className = "bbx-part-text";
    text.innerHTML = `<em>${escapeHtml(bbxPartTypeLabel(comp.type))}</em><strong>${escapeHtml(part ? bbxLocalize(part.names) : comp.part_id)}</strong>`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = `bbx-own-toggle${owned ? " is-active" : ""}`;
    toggle.textContent = owned ? t("bbxHave") : t("bbxHaveNot");
    toggle.addEventListener("click", () => {
      bbxSetPartOwned(comp.part_id, !owned);
      openBbxTop(top);
      renderBbxGuide(state.bbx);
    });
    row.append(thumb, text, toggle);
    elements.bbxTopParts.append(row);
  }

  // Recommendation: missing parts traced to the product(s) that ship them.
  elements.bbxTopRecommend.innerHTML = "";
  const missing = top.components.filter((c) => !state.bbxOwnedParts?.has(c.part_id));
  if (missing.length && missing.length < top.components.length) {
    const byProduct = new Map();
    for (const comp of missing) {
      const part = bbx.partIndex.get(comp.part_id);
      const setId = part?.base_set_id || top.base_set_id;
      if (!byProduct.has(setId)) byProduct.set(setId, []);
      byProduct.get(setId).push(part ? bbxLocalize(part.names) : comp.part_id);
    }
    const title = document.createElement("h3");
    title.className = "guide-unit-subhead";
    title.textContent = t("bbxBuyToComplete");
    elements.bbxTopRecommend.append(title);
    for (const [setId, partNames] of byProduct) {
      const product = bbx.productByBaseSet.get(setId);
      const card = document.createElement("div");
      card.className = "bbx-reco-card";
      const info2 = document.createElement("div");
      info2.className = "bbx-reco-info";
      info2.innerHTML = `<strong>${escapeHtml(product ? bbxLocalize(product.names) : setId)}</strong><span>${escapeHtml(partNames.join(" · "))}</span>`;
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "bbx-own-toggle";
      buy.textContent = t("bbxMarkBought");
      buy.addEventListener("click", () => {
        for (const part of bbx.partsByBaseSet.get(setId) || []) bbxSetPartOwned(part.part_id, true);
        openBbxTop(top);
        renderBbxGuide(state.bbx);
      });
      card.append(info2, buy);
      elements.bbxTopRecommend.append(card);
    }
  }

  // Reverse link: catalog kit(s) linked to this top (auto-matched or manual),
  // each with add-to-collection buttons, plus a control to link more by hand.
  elements.bbxTopKits.innerHTML = "";
  const kitIds = bbxTopKitIds(top);
  const kits = kitIds.map(displayKitById).filter(Boolean);
  if (!kits.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoKits");
    elements.bbxTopKits.append(empty);
  } else {
    for (const kit of kits.slice(0, 12)) elements.bbxTopKits.append(bbxKitRow(kit, top));
  }

  const linkBar = document.createElement("div");
  linkBar.className = "bbx-link-bar";
  const linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.className = "bbx-link-toggle";
  linkBtn.textContent = t("bbxLinkKit");
  const picker = document.createElement("div");
  picker.className = "bbx-link-picker";
  picker.hidden = true;
  linkBtn.addEventListener("click", () => {
    picker.hidden = !picker.hidden;
    if (!picker.hidden) bbxRenderLinkPicker(top, picker);
  });
  linkBar.append(linkBtn, picker);
  elements.bbxTopKits.append(linkBar);

  openDialog(elements.bbxTopDialog);
}

// A linked catalog kit inside the 陀螺 dialog: opens the kit, marks owned/wanted
// (which drives the top's collection color), and unlinks manual links. Separate
// from guideKitRow because that one refreshes the Gundam guide, not this one.
function bbxKitRow(kit, top) {
  const sets = guideCollectionSets();
  const row = document.createElement("div");
  row.className = "guide-kit-row";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "guide-kit-face";
  const thumb = document.createElement("span");
  thumb.className = "guide-kit-thumb";
  appendImageWithFallback(thumb, kit, { onExhausted: () => (thumb.textContent = gradeShortLabel(kit)) });
  const text = document.createElement("span");
  text.className = "guide-kit-text";
  text.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><span>${escapeHtml(seriesLabelFromKit(kit))} · ${escapeHtml(gradeShortLabel(kit))}</span>`;
  face.append(thumb, text);
  face.addEventListener("click", () => {
    closeDialog(elements.bbxTopDialog);
    openDetail(kit);
  });

  const actions = document.createElement("div");
  actions.className = "guide-kit-actions";
  for (const type of ["owned", "wanted"]) {
    const active = sets[type].has(kit.kit_id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `guide-add-button is-${type}${active ? " is-active" : ""}`;
    button.textContent = active ? t(`unmark${type === "owned" ? "Owned" : "Wanted"}`) : t(`mark${type === "owned" ? "Owned" : "Wanted"}`);
    button.disabled = !canEditSharedData();
    button.addEventListener("click", () => {
      setKitCollectionStatus(kit.kit_id, type, !active);
      openBbxTop(top);
      renderBbxGuide(state.bbx);
      renderUserGuideValue();
    });
    actions.append(button);
  }
  row.append(face, actions);

  if (state.bbxManualMap?.get(kit.kit_id) === top.base_set_id) {
    const unlink = document.createElement("button");
    unlink.type = "button";
    unlink.className = "bbx-unlink";
    unlink.textContent = t("bbxUnlink");
    unlink.title = t("bbxManualTag");
    unlink.addEventListener("click", async (event) => {
      event.stopPropagation();
      await bbxUnlinkKit(kit.kit_id);
      openBbxTop(top);
      renderBbxGuide(state.bbx);
    });
    row.append(unlink);
  }
  return row;
}

// Inline candidate list for manually linking a catalog kit to this 陀螺. Kits
// with no automatic match are offered first, then the rest, filtered by a text
// box on kit code or localized name.
function bbxRenderLinkPicker(top, container) {
  const bbx = state.bbx;
  container.innerHTML = "";
  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = t("bbxLinkHint");
  const search = document.createElement("input");
  search.type = "search";
  search.className = "bbx-link-search";
  search.placeholder = t("bbxLinkSearch");
  const list = document.createElement("div");
  list.className = "bbx-link-list";
  container.append(hint, search, list);

  const alreadyLinked = new Set(bbxTopKitIds(top));
  const unmatched = new Set(bbx.unmatchedKitIds);
  const candidates = bbx.beybladeKits
    .filter((k) => !alreadyLinked.has(k.kit_id))
    .sort((a, b) => (unmatched.has(b.kit_id) ? 1 : 0) - (unmatched.has(a.kit_id) ? 1 : 0));

  const draw = () => {
    const query = bbxNormalizeCode(search.value);
    const nameQuery = search.value.trim().toLowerCase();
    list.innerHTML = "";
    const shown = candidates
      .filter((k) => {
        if (!query && !nameQuery) return true;
        const codeHit = bbxKitCode(k.kit_id).includes(query);
        const nameHit = bbxLocalize(k.names).toLowerCase().includes(nameQuery);
        return codeHit || nameHit;
      })
      .slice(0, 40);
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "settings-hint";
      empty.textContent = t("bbxNoLinkCandidates");
      list.append(empty);
      return;
    }
    for (const kit of shown) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bbx-link-candidate";
      const name = document.createElement("span");
      name.textContent = bbxLocalize(kit.names) || kit.kit_id;
      if (unmatched.has(kit.kit_id)) {
        const tag = document.createElement("em");
        tag.className = "bbx-link-unmatched";
        tag.textContent = t("bbxUnlinkedTag");
        name.append(" ", tag);
      }
      row.append(name);
      row.addEventListener("click", async () => {
        await bbxLinkKitToTop(kit.kit_id, top.base_set_id);
        openBbxTop(top);
        renderBbxGuide(state.bbx);
      });
      list.append(row);
    }
  };
  search.addEventListener("input", draw);
  draw();
}

async function bbxLinkKitToTop(kitId, baseSetId) {
  state.bbxManualMap = state.bbxManualMap || new Map();
  state.bbxManualMap.set(kitId, baseSetId);
  saveBbxManualMap();
  state.bbx = null; // rebuild the kit↔top index with the new link
  await ensureBbxData();
}

async function bbxUnlinkKit(kitId) {
  if (!state.bbxManualMap?.has(kitId)) return;
  state.bbxManualMap.delete(kitId);
  saveBbxManualMap();
  state.bbx = null;
  await ensureBbxData();
}

function bbxSetPartOwned(partId, owned) {
  state.bbxOwnedParts = state.bbxOwnedParts || new Set();
  if (owned) state.bbxOwnedParts.add(partId);
  else state.bbxOwnedParts.delete(partId);
  saveBbxOwnedParts();
}

function memberGuideLitValue(memberName) {
  if (!state.guide?.groups?.length) {
    return "...";
  }
  const sets = guideCollectionSets(memberName);
  const lit = state.guide.groups.filter((group) => guideGroupStatus(group, sets) !== "none").length;
  return `${lit}/${state.guide.groups.length}`;
}

function memberProfileEditable() {
  return elements.memberDialog?.dataset.self === "1";
}

function activeMemberProfile() {
  const key = state.activeMemberProfile;
  if (!key) return currentMember();
  return (state.sync.workspace?.members || []).find((member) => safeMemberName(member.name) === key) || currentMember();
}

function activeGuideMember() {
  const key = state.activeGuideMember || editableCollectionMember();
  return (state.sync.workspace?.members || []).find((member) => safeMemberName(member.name) === key) || currentMember() || { name: key };
}

function openMemberActionSheet() {
  if (!elements.memberActionDialog || !elements.memberDialog?.open) return;
  const editable = memberProfileEditable();
  for (const button of [elements.memberActionChangeBackground, elements.memberActionChangeAvatar, elements.memberActionRename, elements.memberActionTags]) {
    if (button) button.hidden = !editable;
  }
  openDialog(elements.memberActionDialog);
}

function memberAvatarUrl(member) {
  return typeof member?.avatar === "string" ? member.avatar : "";
}

function viewMemberProfileImage(kind) {
  const member = activeMemberProfile();
  const url = kind === "avatar" ? memberAvatarUrl(member) : memberProfileBackground(member);
  closeDialog(elements.memberActionDialog);
  if (!url) {
    window.alert(t(kind === "avatar" ? "profileAvatarMissing" : "profileBackgroundMissing"));
    return;
  }
  if (elements.profileImageDialog && elements.profileImagePreview) {
    elements.profileImageTitle.textContent = t(kind === "avatar" ? "viewProfileAvatar" : "viewProfileBackground");
    elements.profileImagePreview.src = url;
    elements.profileImagePreview.alt = elements.profileImageTitle.textContent;
    openDialog(elements.profileImageDialog);
  }
}

async function renameFromMemberActionSheet() {
  if (!memberProfileEditable()) return;
  const current = currentMember()?.name || currentWorkspaceMemberName();
  const value = window.prompt(t("changeNickname"), current);
  closeDialog(elements.memberActionDialog);
  if (value === null) return;
  await saveMemberDisplayNameValue(value, elements.memberActionRename);
}

function openUserPanel(panel) {
  openUserPanelDialog(panel);
}

function openUserPanelDialog(panel) {
  if (!elements.userPanelDialog || !elements.userPanelBody) return;
  elements.userPanelTitle.textContent = panel === "friends" ? t("workspaceFriends") : panel === "guideWorks" ? t("memberGuideManage") : t("myFavorites");
  elements.userPanelBody.innerHTML = "";
  if (panel === "friends") {
    renderFriendsPanel(elements.userPanelBody);
  } else if (panel === "guideWorks") {
    renderGuideWorksPanel(elements.userPanelBody);
  } else {
    renderFavoritesPanel(elements.userPanelBody);
  }
  openDialog(elements.userPanelDialog);
}

function renderFavoritesPanel(container) {
  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = t("profileFavoritesTitle");
  container.append(hint);
  const prefs = memberPreferences(currentMember());
  const franchiseWrap = document.createElement("div");
  franchiseWrap.className = "favorite-chips";
  for (const franchise of FRANCHISES) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `member-chip${prefs.franchises.includes(franchise) ? " is-active" : ""}`;
    chip.textContent = franchiseShortLabel(franchise);
    chip.addEventListener("click", () => {
      toggleFavorite("franchises", franchise);
      renderFavoritesPanel(container);
    });
    franchiseWrap.append(chip);
  }
  const seriesWrap = document.createElement("div");
  seriesWrap.className = "favorite-chips";
  const seen = new Set();
  const candidates = [];
  for (const franchise of prefs.franchises.length ? prefs.franchises : ["gundam"]) {
    for (const [key, entry] of seriesEntriesForFranchise(franchise).slice(0, 12)) {
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ key, label: entry.label });
      }
    }
  }
  for (const key of prefs.series) {
    if (!seen.has(key)) candidates.push({ key, label: favoriteSeriesLabel(key) });
  }
  for (const { key, label } of candidates) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `member-chip${prefs.series.includes(key) ? " is-active" : ""}`;
    chip.textContent = label;
    chip.addEventListener("click", () => {
      toggleFavorite("series", key);
      renderFavoritesPanel(container);
    });
    seriesWrap.append(chip);
  }
  container.replaceChildren(hint, franchiseWrap, seriesWrap);
}

function renderFriendsPanel(container) {
  const workspace = state.sync.workspace;
  if (workspace?.inviteCode) {
    const invite = document.createElement("p");
    invite.className = "settings-hint workspace-invite-line";
    invite.innerHTML = `<span>${escapeHtml(t("workspaceInviteCode"))}</span><code>${escapeHtml(workspace.inviteCode)}</code>`;
    container.append(invite);
  }
  for (const member of workspace?.members || []) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `workspace-member-row${member.is_self ? " is-self" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "account-avatar member-row-avatar";
    applyAvatarTo(avatar, member);
    const body = document.createElement("span");
    body.className = "member-row-body";
    const name = document.createElement("strong");
    name.textContent = `${member.name || "member"}${member.is_self ? ` · ${t("workspaceSelf")}` : ""}`;
    body.append(name);
    row.append(avatar, body);
    row.addEventListener("click", () => {
      closeDialog(elements.userPanelDialog);
      openMemberProfile(member);
    });
    container.append(row);
  }
}

function guideWorkProgress(work, member = activeGuideMember()) {
  const sets = guideCollectionSets(member);
  const groups = guideGroupsForWork(work, member);
  const lit = groups.filter((group) => guideGroupStatus(group, sets) !== "none").length;
  return { lit, total: groups.length };
}

function guideWorksForMember(member) {
  const guide = state.guide;
  if (!guide?.works?.length) return [];
  const prefs = memberPreferences(member);
  const selected = prefs.guide_works
    .map((id) => guide.works.find((work) => Number(work.work_id) === Number(id)))
    .filter(Boolean);
  if (selected.length) return selected;
  const favoriteLabels = new Set(prefs.series.map((key) => favoriteSeriesLabel(key).toLowerCase()));
  const scored = guide.works.map((work) => {
    const progress = guideWorkProgress(work, member);
    const name = String(work.name || "").toLowerCase();
    const favorite = [...favoriteLabels].some((label) => label && name.includes(label.toLowerCase()));
    return { work, score: (favorite ? 1000 : 0) + progress.lit * 10 + progress.total };
  });
  return scored.sort((a, b) => b.score - a.score || Number(a.work.work_id) - Number(b.work.work_id)).slice(0, 6).map((entry) => entry.work);
}

function renderMemberGuideSeries(member) {
  if (!elements.memberGuideSeries) return;
  elements.memberGuideSeries.innerHTML = "";
  const isSelf = Boolean(member?.is_self);
  if (elements.memberGuideManage) {
    elements.memberGuideManage.hidden = !isSelf;
    elements.memberGuideManage.onclick = () => openUserPanelDialog("guideWorks");
  }
  if (!state.guide) {
    const loading = document.createElement("p");
    loading.className = "settings-hint";
    loading.textContent = "...";
    elements.memberGuideSeries.append(loading);
    return;
  }
  const works = guideWorksForMember(member);
  if (!works.length) {
    const empty = document.createElement("p");
    empty.className = "settings-hint";
    empty.textContent = t("guideNoDisplayWorks");
    elements.memberGuideSeries.append(empty);
    return;
  }
  for (const work of works) {
    elements.memberGuideSeries.append(
      createGuideWorkCard(work, member, {
        cardClass: "member-guide-card",
        artClass: "member-guide-art",
        compact: true,
      }),
    );
  }
}

function renderGuideWorksPanel(container) {
  if (!state.guide) {
    const hint = document.createElement("p");
    hint.className = "settings-hint";
    hint.textContent = "...";
    container.append(hint);
    ensureGuideData().then(() => {
      container.innerHTML = "";
      renderGuideWorksPanel(container);
    }).catch(() => {});
    return;
  }
  const member = currentMember();
  const prefs = memberPreferences(member);
  const selected = new Set(prefs.guide_works.map(Number));
  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = t("guideWorksHint");
  const grid = document.createElement("div");
  grid.className = "guide-work-picker";
  for (const work of state.guide.works) {
    const progress = guideWorkProgress(work, member);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `guide-work-pick${selected.has(Number(work.work_id)) ? " is-active" : ""}`;
    chip.innerHTML = `<strong>${escapeHtml(guideWorkDisplayName(work))}</strong><span>${progress.lit}/${progress.total}</span>`;
    chip.addEventListener("click", async () => {
      const id = Number(work.work_id);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      const nextPrefs = { ...memberPreferences(member), guide_works: [...selected] };
      member.preferences = nextPrefs;
      chip.classList.toggle("is-active", selected.has(id));
      await saveMemberProfileFields({ preferences: nextPrefs });
      if (elements.memberDialog?.open) renderMemberGuideSeries(currentMember());
    });
    grid.append(chip);
  }
  container.replaceChildren(hint, grid);
}

function openMemberProfile(member) {
  if (!elements.memberDialog) {
    return;
  }
  if (!member) {
    return;
  }
  const isSelf = Boolean(member.is_self);
  state.activeMemberProfile = safeMemberName(member.name);
  applyMemberCover(elements.memberDialogCover, member);
  elements.memberDialogHead?.classList.toggle("has-cover", Boolean(memberProfileBackground(member)));
  elements.memberDialogHead?.classList.toggle("is-editable", isSelf);
  if (elements.memberDialog) {
    elements.memberDialog.dataset.self = isSelf ? "1" : "0";
  }
  if (elements.memberDialogHead) {
    if (isSelf) {
      elements.memberDialogHead.tabIndex = 0;
      elements.memberDialogHead.setAttribute("role", "button");
      elements.memberDialogHead.title = t("profileBackgroundHint");
    } else {
      elements.memberDialogHead.removeAttribute("tabindex");
      elements.memberDialogHead.removeAttribute("role");
      elements.memberDialogHead.removeAttribute("title");
    }
  }
  applyAvatarTo(elements.memberDialogAvatar, member);
  elements.memberDialogName.textContent = member.name || "member";
  if (elements.memberEditPanel) {
    elements.memberEditPanel.hidden = true;
  }
  if (elements.memberDialogAvatar) {
    elements.memberDialogAvatar.disabled = false;
  }
  if (isSelf && elements.memberDialogNameInput) {
    elements.memberDialogNameInput.value = member.name || currentWorkspaceMemberName();
  }
  const joined = member.joined_at ? String(member.joined_at).slice(0, 10) : "";
  elements.memberDialogMeta.textContent = [t(`workspaceRole${capitalizeRole(member.role)}`), member.email, joined, `${t("pictureBook")} ${memberGuideLitValue(member.name)}`].filter(Boolean).join(" · ");

  const prefs = memberPreferences(member);
  elements.memberDialogFavorites.innerHTML = "";
  const labels = [...prefs.franchises.map((franchise) => franchiseShortLabel(franchise)), ...prefs.series.map(favoriteSeriesLabel)];
  if (!labels.length) {
    labels.push(t("memberNoFavorites"));
  }
  for (const label of labels) {
    const chip = document.createElement("span");
    chip.className = "member-chip is-static";
    chip.textContent = label;
    elements.memberDialogFavorites.append(chip);
  }
  renderMemberGuideSeries(member);

  const owned = memberCollectionKits(member.name, "owned");
  const wanted = memberCollectionKits(member.name, "wanted");
  elements.memberDialogStats.innerHTML = "";
  elements.memberDialogStats.hidden = true;
  const ownedTitle = elements.memberDialogOwned?.closest(".member-collection")?.querySelector("h3");
  const wantedTitle = elements.memberDialogWanted?.closest(".member-collection")?.querySelector("h3");
  if (ownedTitle) ownedTitle.textContent = `${t("ownedList")} ${owned.length}`;
  if (wantedTitle) wantedTitle.textContent = `${t("wantedList")} ${wanted.length}`;

  fillMemberStrip(elements.memberDialogOwned, owned);
  fillMemberStrip(elements.memberDialogWanted, wanted);
  openDialog(elements.memberDialog);
  if (!state.guide) {
    ensureGuideData()
      .then(() => {
        if (elements.memberDialog?.open) {
          openMemberProfile(isSelf ? currentMember() : member);
        }
      })
      .catch(() => {});
  }
}

function renderAccountSection() {
  if (!elements.accountSignedOut) {
    return;
  }
  const signedIn = syncModeV2();
  elements.accountSignedOut.hidden = signedIn;
  elements.accountSignedIn.hidden = !signedIn;
  if (!signedIn) {
    elements.memberNameRow.hidden = true;
    const configured = authConfigured();
    elements.accountEmail.disabled = !configured;
    elements.accountSendCode.disabled = !configured;
    if (!configured) {
      elements.accountHint.textContent = t("accountBackendMissing");
    }
    return;
  }
  const email = currentUserEmail();
  elements.accountEmailLabel.textContent = email;
  applyAvatarTo(elements.accountAvatar, currentMember(), email[0]);
  renderProfileFavorites();
  elements.memberNameRow.hidden = false;
  if (document.activeElement !== elements.memberDisplayNameInput) {
    elements.memberDisplayNameInput.value = currentWorkspaceMemberName();
  }
  const workspace = state.sync.workspace;
  elements.workspaceNone.hidden = Boolean(workspace);
  elements.workspacePanel.hidden = !workspace;
  if (!workspace) {
    elements.workspaceHint.hidden = false;
    elements.workspaceHint.textContent = t("syncNoWorkspace");
    return;
  }
  elements.workspaceHint.hidden = true;
  elements.workspaceNameLabel.textContent = workspace.name || t("sharedSync");
  elements.workspaceInviteWrap.hidden = !workspace.inviteCode;
  elements.workspaceInviteCode.textContent = workspace.inviteCode || "";
  renderWorkspaceMembers(workspace.members || []);
  elements.workspaceLeave.disabled = false;
  const canMigrate = syncConfigComplete() && workspace.role === "owner";
  elements.migrateV1.hidden = !canMigrate;
  elements.migrateV1Hint.hidden = !canMigrate;
}

function renderWorkspaceMembers(members) {
  elements.workspaceMembers.innerHTML = "";
  if (!members.length) {
    const empty = document.createElement("div");
    empty.className = "workspace-member-row";
    empty.textContent = t("workspaceMembersEmpty");
    elements.workspaceMembers.append(empty);
    return;
  }
  for (const member of members) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `workspace-member-row${member.is_self ? " is-self" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "account-avatar member-row-avatar";
    applyAvatarTo(avatar, member);
    const body = document.createElement("span");
    body.className = "member-row-body";
    const name = document.createElement("strong");
    name.textContent = `${member.name || "member"}${member.is_self ? ` · ${t("workspaceSelf")}` : ""}`;
    const meta = document.createElement("span");
    const joined = member.joined_at ? String(member.joined_at).slice(0, 10) : "";
    meta.textContent = [t(`workspaceRole${capitalizeRole(member.role)}`), member.email, joined].filter(Boolean).join(" · ");
    body.append(name, meta);
    row.append(avatar, body);
    row.addEventListener("click", () => openMemberProfile(member));
    elements.workspaceMembers.append(row);
  }
}

function capitalizeRole(role) {
  const value = String(role || "editor");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderDuplicateWorkbench() {
  if (!elements.duplicateWorkbench) {
    return;
  }
  const groups = duplicateCandidateGroups(10);
  elements.duplicateSummary.textContent = t("duplicateSummary", { count: groups.length });
  elements.duplicateWorkbench.innerHTML = "";
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "duplicate-empty";
    empty.textContent = t("duplicateEmpty");
    elements.duplicateWorkbench.append(empty);
    return;
  }
  for (const group of groups) {
    const panel = document.createElement("div");
    panel.className = "duplicate-group";
    const head = document.createElement("div");
    head.className = "duplicate-group-head";
    const label = document.createElement("strong");
    label.textContent = t("duplicateGroup", { count: group.kits.length });
    const meta = document.createElement("span");
    meta.textContent = group.kits.map((kit) => kit.grade_code).filter(Boolean).join(" / ");
    const ignoreGroup = document.createElement("button");
    ignoreGroup.type = "button";
    ignoreGroup.className = "duplicate-ignore";
    ignoreGroup.textContent = t("ignoreDuplicateGroup");
    ignoreGroup.addEventListener("click", () => ignoreDuplicateGroup(group));
    head.append(label, meta, ignoreGroup);

    const list = document.createElement("div");
    list.className = "duplicate-list";
    for (const kit of group.kits.slice(0, 6)) {
      const row = document.createElement("div");
      row.className = "duplicate-item-row";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "duplicate-item";
      button.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><span>${escapeHtml([franchiseLabel(kit.franchise), seriesLabelFromKit(kit), kit.grade_code, kit.release_date].filter(Boolean).join(" · "))}</span>`;
      button.addEventListener("click", () => openDetail(kit, { keepSettings: true }));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "duplicate-delete";
      deleteButton.textContent = t("hideDuplicateCandidate");
      deleteButton.addEventListener("click", () => hideDuplicateCandidate(kit));
      const mergeButton = document.createElement("button");
      mergeButton.type = "button";
      mergeButton.className = "duplicate-merge";
      mergeButton.textContent = t("mergeDuplicateIntoThis");
      mergeButton.addEventListener("click", () => mergeDuplicateGroup(group, kit));
      row.append(button, mergeButton, deleteButton);
      list.append(row);
    }
    panel.append(head, list);
    elements.duplicateWorkbench.append(panel);
  }
}

function mergeDuplicateGroup(group, masterKit) {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  const others = group.kits.filter((kit) => kit.kit_id !== masterKit.kit_id);
  if (!others.length || !window.confirm(t("mergeDuplicateConfirm", { name: kitShortName(masterKit), count: others.length }))) {
    return;
  }
  const now = new Date().toISOString();
  const gallery = new Set(masterKit.gallery_image_urls || []);
  const sourceUrls = new Set(masterKit.source_urls || []);
  for (const kit of group.kits) {
    for (const url of imageCandidatesForKit(kit)) gallery.add(url);
    for (const url of kit.source_urls || []) sourceUrls.add(url);
  }
  state.overrides[masterKit.kit_id] = {
    ...(state.overrides[masterKit.kit_id] || {}),
    gallery_image_urls: [...gallery],
    source_urls: [...sourceUrls],
    duplicate_merge_key: group.key,
    duplicate_merged_ids: others.map((kit) => kit.kit_id),
    duplicate_merged_at: now,
    duplicate_merged_by: memberName(),
    updated_at: now,
  };
  for (const kit of others) {
    state.overrides[kit.kit_id] = {
      ...(state.overrides[kit.kit_id] || {}),
      data_status: "hidden",
      hidden_reason: "merged_duplicate",
      merged_into: masterKit.kit_id,
      hidden_at: now,
      hidden_by: memberName(),
      updated_at: now,
    };
  }
  saveOverrides();
  refreshKits();
  render();
  setSyncStatus("saving", t("duplicateMerged"));
}

function ignoreDuplicateGroup(group) {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  if (!window.confirm(t("ignoreDuplicateConfirm", { count: group.kits.length }))) {
    return;
  }
  const now = new Date().toISOString();
  for (const kit of group.kits) {
    state.overrides[kit.kit_id] = {
      ...(state.overrides[kit.kit_id] || {}),
      duplicate_ignore_key: group.key,
      duplicate_ignored_at: now,
      duplicate_ignored_by: memberName(),
      updated_at: now,
    };
  }
  saveOverrides();
  render();
  setSyncStatus("saving", t("duplicateGroupIgnored"));
}

function hideDuplicateCandidate(kit) {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  if (!window.confirm(t("deleteDuplicateConfirm", { name: kitShortName(kit) }))) {
    return;
  }
  state.overrides[kit.kit_id] = {
    ...(state.overrides[kit.kit_id] || {}),
    data_status: "hidden",
    hidden_at: new Date().toISOString(),
    hidden_by: memberName(),
    updated_at: new Date().toISOString(),
  };
  saveOverrides();
  if (state.selectedKit?.kit_id === kit.kit_id) {
    closeDetail({ navigate: false });
  }
  refreshKits();
  render();
  setSyncStatus("saving", t("duplicateDeleted"));
}

function hiddenRecordKits() {
  return Object.entries(state.overrides || {})
    .filter(([, override]) => override?.data_status === "hidden")
    .map(([kitId]) => rawKitById(kitId))
    .filter(Boolean)
    .map((kit) => applyOverride(kit))
    .sort((a, b) => String(b.local_override?.hidden_at || b.local_override?.updated_at || "").localeCompare(String(a.local_override?.hidden_at || a.local_override?.updated_at || "")));
}

function renderHiddenRecords() {
  if (!elements.hiddenRecords) {
    return;
  }
  const kits = hiddenRecordKits();
  elements.hiddenRecords.innerHTML = "";
  if (!kits.length) {
    return;
  }
  const title = document.createElement("strong");
  title.className = "hidden-records-title";
  title.textContent = t("hiddenRecords");
  elements.hiddenRecords.append(title);
  for (const kit of kits.slice(0, 20)) {
    const row = document.createElement("div");
    row.className = "duplicate-item-row";
    const label = document.createElement("button");
    label.type = "button";
    label.className = "duplicate-item";
    label.innerHTML = `<strong>${escapeHtml(kitShortName(kit))}</strong><span>${escapeHtml([franchiseLabel(kit.franchise), seriesLabelFromKit(kit), kit.grade_code].filter(Boolean).join(" · "))}</span>`;
    label.addEventListener("click", () => openDetail(kit, { keepSettings: true }));
    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "duplicate-restore";
    restore.textContent = t("restoreHiddenRecord");
    restore.addEventListener("click", () => restoreHiddenRecord(kit));
    row.append(label, restore);
    elements.hiddenRecords.append(row);
  }
}

function restoreHiddenRecord(kit) {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  const override = { ...(state.overrides[kit.kit_id] || {}) };
  delete override.data_status;
  delete override.hidden_at;
  delete override.hidden_by;
  delete override.hidden_reason;
  delete override.merged_into;
  override.updated_at = new Date().toISOString();
  if (Object.keys(override).filter((key) => key !== "updated_at").length) {
    state.overrides[kit.kit_id] = override;
  } else {
    delete state.overrides[kit.kit_id];
  }
  saveOverrides();
  refreshKits();
  render();
  setSyncStatus("saving", t("hiddenRecordRestored"));
}

function renderSyncStatus() {
  const labelByStatus = {
    local: t("syncLocal"),
    connecting: t("syncConnecting"),
    connected: t("syncConnected"),
    readonly: t("syncReadOnly"),
    saving: t("syncSaving"),
    noworkspace: t("syncNoWorkspace"),
    error: t("syncError"),
  };
  elements.syncState.dataset.status = state.sync.status;
  elements.syncStatusText.textContent = state.sync.message || labelByStatus[state.sync.status] || t("syncLocal");
  const syncConfigured = syncActive();
  elements.issueSyncStatus.textContent = syncConfigured ? t("syncConfigured") : t("syncNotConfigured");
  if (state.syncMeta.updatedAt) {
    const date = new Date(state.syncMeta.updatedAt);
    const time = Number.isNaN(date.getTime()) ? state.syncMeta.updatedAt : date.toLocaleString();
    elements.syncHint.textContent = t("syncUpdatedBy", { name: state.syncMeta.updatedBy || "member", time });
  } else {
    elements.syncHint.textContent = state.sync.message || t("syncHint");
  }
}

function renderImageHealth() {
  if (!elements.imageHealthLog) {
    return;
  }
  elements.imageHealthLog.innerHTML = "";
  const report = state.imageHealth;
  if (!report) {
    const item = document.createElement("span");
    item.textContent = t("imageHealthUnavailable");
    elements.imageHealthLog.append(item);
    return;
  }

  const updatedAt = report.updated_at ? new Date(report.updated_at) : null;
  const date = updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toLocaleString() : report.updated_at || "unknown";
  const lines = [
    t("imageHealthReady", {
      working: report.working_kits ?? Math.max(0, (report.checked_kits || 0) - (report.kits_without_working_image || 0)),
      checked: report.checked_kits || 0,
      broken: report.broken_urls || 0,
      date,
    }),
  ];
  if (report.kits_without_working_image) {
    lines.push(t("imageHealthMissing", { count: report.kits_without_working_image }));
  }
  for (const [franchise, entry] of Object.entries(report.by_franchise || {})) {
    lines.push(`${franchiseShortLabel(franchise)} ${entry.checked_kits || 0} / ${entry.kits_without_working_image || 0}`);
  }

  for (const line of lines) {
    const item = document.createElement("span");
    item.textContent = line;
    elements.imageHealthLog.append(item);
  }
}

function renderConsoleMode() {
  const consoleVisible = state.settingsPanel === "console";
  document.querySelectorAll(".console-only").forEach((node) => {
    node.hidden = !consoleVisible || node.dataset.settingsPanel !== state.settingsPanel;
  });
  elements.correctionPanel.hidden = !consoleVisible;
  const editable = canEditSharedData();
  elements.editToggle.disabled = !editable;
  elements.saveCorrection.disabled = !editable;
  elements.markVerified.disabled = !editable;
  elements.clearCorrection.disabled = !editable;
  elements.saveSeriesLabel.disabled = !editable;
  elements.clearSeriesLabel.disabled = !editable;
  elements.seriesAdminLabel.disabled = !editable;
  elements.seriesAdminSeries.disabled = !editable;
  elements.seriesAdminLanguage.disabled = !editable;
  if (!consoleVisible) {
    elements.correctionForm.hidden = true;
  }
  if (consoleVisible) {
    renderSeriesAdmin();
  }
}

function renderFranchiseFilters() {
  elements.franchiseList.innerHTML = "";
  for (const franchise of FRANCHISES) {
    const button = document.createElement("button");
    button.type = "button";
    const active = activeCollectionType()
      ? state.collectionFilter?.franchise === franchise
      : state.franchise === franchise;
    button.className = `segment-button${active ? " is-active" : ""}`;
    button.textContent = franchiseShortLabel(franchise);
    button.addEventListener("click", () => {
      if (activeCollectionType()) {
        state.collectionFilter = { ...(state.collectionFilter || {}), franchise, series: "all", grade: "all" };
        saveCollectionFilter();
      } else {
        state.franchise = franchise;
        state.grade = "all";
        state.series = "all";
        state.itemType = "all";
        state.releaseYear = "all";
        state.limited = "all";
        localStorage.setItem(FRANCHISE_KEY, state.franchise);
      }
      state.priceMin = "";
      state.priceMax = "";
      state.selectedKit = null;
      render();
      persistViewState({ mode: "push" });
    });
    elements.franchiseList.append(button);
  }
  // Premium Bandai no longer has its own tab; PB kits live inside the gundam
  // and AC catalogs directly.
}

function seriesEntriesForFranchise(franchise) {
  const kits = state.kits.filter((kit) => kit.franchise === franchise);
  const counts = new Map();
  for (const kit of kits) {
    const key = kitSeriesKey(kit);
    const current = counts.get(key) || { count: 0, sort: kitSeriesSort(kit), label: seriesLabelFromKit(kit) };
    current.count += 1;
    current.sort = Math.min(current.sort, kitSeriesSort(kit));
    current.label = seriesLabelFromKit(kit);
    counts.set(key, current);
  }
  return [...counts.entries()].sort((a, b) => a[1].sort - b[1].sort || b[1].count - a[1].count || a[1].label.localeCompare(b[1].label));
}

function seriesCountsForCurrentFranchise() {
  return new Map(seriesEntriesForFranchise(state.franchise));
}

function renderFilterOptions(container, key, allLabel, options) {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `filter-option${filterIsAll(key) ? " is-active" : ""}`;
  allButton.dataset.filterKey = key;
  allButton.dataset.filterValue = "all";
  allButton.textContent = allLabel;
  container.append(allButton);

  const selected = new Set(selectedFilterValues(key));
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-option${selected.has(option.value) ? " is-active" : ""}`;
    button.dataset.filterKey = key;
    button.dataset.filterValue = option.value;
    button.textContent = option.label;
    container.append(button);
  }
}

function renderSeriesControls() {
  const kits = kitsForCurrentFranchise();
  const counts = seriesCountsForCurrentFranchise();
  pruneFilterValues("series", counts.keys());

  const seriesEntries = [...counts.entries()];

  elements.seriesTabs.innerHTML = "";
  elements.seriesTabs.append(makeSeriesTab("all", t("allWorks")));
  for (const [key, entry] of seriesEntries) {
    elements.seriesTabs.append(makeSeriesTab(key, entry.label));
  }

  renderFilterOptions(
    elements.seriesFilter,
    "series",
    `${t("allWorks")} (${kits.length})`,
    seriesEntries.map(([key, entry]) => ({ value: key, label: `${entry.label} (${entry.count})` })),
  );
}

function makeSeriesTab(key, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `series-tab${(key === "all" ? filterIsAll("series") : selectedFilterValues("series").includes(key)) ? " is-active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", () => {
    toggleFilterValue("series", key);
    renderSeriesControls();
    renderGradeSelect();
    renderAdvancedFilters();
    renderSeriesAdmin();
    renderFilterSummary();
    persistViewState({ mode: "push" });
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

function renderSeriesAdmin() {
  const entries = seriesEntriesForFranchise(state.franchise);
  const preferredKey = selectedFilterValues("series")[0] || entries[0]?.[0];
  if (!state.seriesAdminKey || !entries.some(([key]) => key === state.seriesAdminKey)) {
    state.seriesAdminKey = preferredKey || "other";
  }
  if (!LANGUAGES.some((language) => language.code === state.seriesAdminLanguage)) {
    state.seriesAdminLanguage = state.language;
  }

  elements.seriesAdminSeries.innerHTML = "";
  for (const [key, entry] of entries) {
    elements.seriesAdminSeries.append(makeOption(key, `${entry.label} (${entry.count})`));
  }
  if (!entries.some(([key]) => key === state.seriesAdminKey)) {
    elements.seriesAdminSeries.append(makeOption(state.seriesAdminKey, seriesLabelFromKey(state.seriesAdminKey)));
  }
  elements.seriesAdminSeries.value = state.seriesAdminKey;

  elements.seriesAdminLanguage.innerHTML = "";
  for (const language of LANGUAGES) {
    elements.seriesAdminLanguage.append(makeOption(language.code, language.label));
  }
  elements.seriesAdminLanguage.value = state.seriesAdminLanguage;
  updateSeriesAdminLabelField();
}

function updateSeriesAdminLabelField() {
  const key = state.seriesAdminKey || elements.seriesAdminSeries.value;
  const language = state.seriesAdminLanguage || elements.seriesAdminLanguage.value || state.language;
  elements.seriesAdminLabel.value = seriesLabelForLanguage(key, language);
  elements.seriesAdminSummary.textContent = `${franchiseLabel(state.franchise)} · ${seriesLabelFromKey(key)} · ${LANGUAGES.find((item) => item.code === language)?.label ?? language}`;
}

function saveCurrentSeriesLabel() {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  const key = elements.seriesAdminSeries.value;
  const language = elements.seriesAdminLanguage.value;
  const value = elements.seriesAdminLabel.value.trim();
  const baseValue = baseSeriesLabelForLanguage(key, language);

  if (!key || !language) {
    return;
  }

  if (!value || value === baseValue) {
    delete state.seriesLabelOverrides[key]?.[language];
  } else {
    state.seriesLabelOverrides[key] = {
      ...(state.seriesLabelOverrides[key] || {}),
      [language]: value,
    };
  }
  if (state.seriesLabelOverrides[key] && !Object.keys(state.seriesLabelOverrides[key]).length) {
    delete state.seriesLabelOverrides[key];
  }

  saveSeriesLabelOverrides();
  render();
  if (state.selectedKit && elements.detailDialog.open) {
    renderDetail(state.selectedKit);
  }
}

function clearCurrentSeriesLabel() {
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }
  const key = elements.seriesAdminSeries.value;
  const language = elements.seriesAdminLanguage.value;
  delete state.seriesLabelOverrides[key]?.[language];
  if (state.seriesLabelOverrides[key] && !Object.keys(state.seriesLabelOverrides[key]).length) {
    delete state.seriesLabelOverrides[key];
  }
  saveSeriesLabelOverrides();
  render();
  if (state.selectedKit && elements.detailDialog.open) {
    renderDetail(state.selectedKit);
  }
}

function exportSeriesLabels() {
  const payload = {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    series_label_overrides: state.seriesLabelOverrides,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gunpula-series-labels.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderGradeSelect() {
  const kits = kitsForCurrentFranchise().filter((kit) => filterHas("series", kitSeriesKey(kit)));
  const counts = new Map();
  for (const kit of kits) {
    counts.set(kit.grade_code, (counts.get(kit.grade_code) || 0) + 1);
  }
  pruneFilterValues("grade", counts.keys());

  const codes = [...counts.keys()].sort();
  renderFilterOptions(
    elements.gradeFilter,
    "grade",
    `${t("allProductLines")} (${kits.length})`,
    codes.map((code) => {
      const sample = kits.find((kit) => kit.grade_code === code);
      const label = sample ? gradeShortLabel(sample) : code;
      return { value: code, label: `${label} (${counts.get(code)})` };
    }),
  );
}

function renderAdvancedFilters() {
  const kits = kitsForCurrentFranchise().filter((kit) => {
    if (!filterHas("series", kitSeriesKey(kit))) return false;
    if (!filterHas("grade", kit.grade_code)) return false;
    return true;
  });

  const typeCounts = new Map();
  const yearCounts = new Map();
  const limitedCounts = new Map([
    ["limited", 0],
    ["regular", 0],
  ]);
  for (const kit of kits) {
    const type = itemTypeKeyForKit(kit);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    const limitedKey = kit.is_limited ? "limited" : "regular";
    limitedCounts.set(limitedKey, (limitedCounts.get(limitedKey) || 0) + 1);
    const year = releaseYearForKit(kit);
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }

  pruneFilterValues("itemType", typeCounts.keys());
  pruneFilterValues("releaseYear", yearCounts.keys());
  pruneFilterValues("limited", ["limited", "regular"]);

  renderFilterOptions(
    elements.itemTypeFilter,
    "itemType",
    `${t("allTypes")} (${kits.length})`,
    [...typeCounts.entries()]
      .sort((a, b) => itemTypeLabel(a[0]).localeCompare(itemTypeLabel(b[0]), state.language))
      .map(([key, count]) => ({ value: key, label: `${itemTypeLabel(key)} (${count})` })),
  );

  renderFilterOptions(
    elements.releaseYearFilter,
    "releaseYear",
    `${t("allYears")} (${kits.length})`,
    [...yearCounts.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([year, count]) => ({ value: year, label: `${year} (${count})` })),
  );

  renderFilterOptions(elements.limitedFilter, "limited", t("limitedAll"), [
    { value: "limited", label: `${t("limitedOnly")} (${limitedCounts.get("limited") || 0})` },
    { value: "regular", label: `${t("regularOnly")} (${limitedCounts.get("regular") || 0})` },
  ]);
  if (elements.priceMinInput) elements.priceMinInput.value = state.priceMin;
  if (elements.priceMaxInput) elements.priceMaxInput.value = state.priceMax;
}

function clearFilters() {
  state.series = "all";
  state.grade = "all";
  state.itemType = "all";
  state.releaseYear = "all";
  state.limited = "all";
  state.priceMin = "";
  state.priceMax = "";
  renderSeriesControls();
  renderGradeSelect();
  renderAdvancedFilters();
  renderFilterSummary();
  persistViewState({ mode: "push" });
  renderKits();
}

function renderGradeFilters() {
  renderGradeSelect();
  renderAdvancedFilters();
}

function renderWorkFilters() {
  renderSeriesControls();
}

function renderFilterSummary() {
  const gradeMap = gradeByCode();
  const summarize = (values, allLabel, labeler) => {
    if (!values.length) return allLabel;
    const labels = values.map(labeler).filter(Boolean);
    return labels.length > 2 ? `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}` : labels.join(" + ");
  };
  const gradeLabelText = summarize(selectedFilterValues("grade"), t("allProductLines"), (code) => gradeLabel(gradeMap.get(code)) || code);
  const seriesLabel = summarize(selectedFilterValues("series"), t("allWorks"), seriesLabelFromKey);
  const extra = [
    !filterIsAll("itemType") ? summarize(selectedFilterValues("itemType"), "", itemTypeLabel) : null,
    !filterIsAll("releaseYear") ? summarize(selectedFilterValues("releaseYear"), "", (year) => year) : null,
    !filterIsAll("limited") ? summarize(selectedFilterValues("limited"), "", (value) => t(value === "limited" ? "limitedOnly" : "regularOnly")) : null,
    state.priceMin ? `>=${formatPrice(Number(state.priceMin))}` : null,
    state.priceMax ? `<=${formatPrice(Number(state.priceMax))}` : null,
  ].filter(Boolean);
  elements.filterSummary.textContent = [franchiseLabel(state.franchise), seriesLabel, gradeLabelText, ...extra].join(" · ");
}

function currentRenderSignature(kits) {
  return JSON.stringify({
    view: state.activeView,
    franchise: state.franchise,
    query: state.query,
    grade: state.grade,
    series: state.series,
    itemType: state.itemType,
    releaseYear: state.releaseYear,
    limited: state.limited,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    count: kits.length,
  });
}

function renderKits() {
  const kits = filteredKits();
  const signature = currentRenderSignature(kits);
  if (state.renderSignature !== signature) {
    state.renderSignature = signature;
    state.renderLimit = KIT_RENDER_BATCH;
  }
  const visibleKits = kits.slice(0, state.renderLimit);
  const collectionType = activeCollectionType();
  const titleKey = state.activeView === "owned" ? "ownedList" : state.activeView === "wanted" ? "wantedList" : "catalogList";
  elements.sectionTitle.textContent = t(titleKey);
  elements.resultCount.textContent = t("results", { count: kits.length });
  renderCollectionManagement(kits);
  elements.kitGrid.innerHTML = "";

  if (!kits.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = t("noMatches");
    elements.kitGrid.append(empty);
    return;
  }

  for (const kit of visibleKits) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const boxArt = card.querySelector(".box-art");
    const fullName = kitDisplayName(kit);
    const name = kitShortName(kit);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", t("detailsFor", { name: fullName }));

    if (collectionType) {
      const picker = document.createElement("label");
      picker.className = "kit-select-check";
      picker.setAttribute("aria-label", t("selectItem", { name: fullName }));
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = collectionSelection(collectionType).has(kit.kit_id);
      checkbox.disabled = !canEditSharedData();
      checkbox.addEventListener("change", (event) => {
        if (event.target.checked) {
          collectionSelection(collectionType).add(kit.kit_id);
        } else {
          collectionSelection(collectionType).delete(kit.kit_id);
        }
        card.classList.toggle("is-selected", event.target.checked);
        renderCollectionManagement(kits);
      });
      picker.addEventListener("click", (event) => event.stopPropagation());
      picker.addEventListener("keydown", (event) => event.stopPropagation());
      picker.append(checkbox);
      card.append(picker);
      card.classList.toggle("is-selected", checkbox.checked);
    }

    appendImageWithFallback(boxArt, kit, {
      alt: t("boxArtAlt", { name: fullName }),
      onExhausted: () => showPlaceholder(boxArt, kit.grade_code),
    });

    const badges = card.querySelector(".kit-badges");
    for (const label of [seriesLabelFromKit(kit), gradeShortLabel(kit), kit.release_date].filter(Boolean)) {
      const badge = document.createElement("span");
      badge.textContent = label;
      badges.append(badge);
    }
    const viewType = activeCollectionType();
    const collectionLabel = viewType
      ? collectionOwnerSummary(kit.kit_id, viewType)
      : kitInCollection(kit.kit_id, "owned")
        ? `${t("markOwned")} ×${collectionQuantityForKit(kit.kit_id)}`
        : kitInCollection(kit.kit_id, "wanted")
          ? `${t("markWanted")} ×${wantedQuantityForKit(kit.kit_id)}`
          : null;
    if (collectionLabel) {
      const badge = document.createElement("span");
      badge.className = "status-badge";
      badge.textContent = collectionLabel;
      badges.append(badge);
    }
    card.querySelector("h3").textContent = name;
    card.querySelector("p").textContent = Number.isInteger(kit.price_jpy) ? formatPrice(kit.price_jpy) : "";
    card.addEventListener("click", () => openDetail(kit));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(kit);
      }
    });
    elements.kitGrid.append(card);
  }

  if (visibleKits.length < kits.length) {
    const remaining = kits.length - visibleKits.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "load-more";
    button.textContent = `${t("showMore", { count: Math.min(KIT_RENDER_BATCH, remaining) })} · ${t("showingPartial", { shown: visibleKits.length, total: kits.length })}`;
    button.addEventListener("click", () => {
      state.renderLimit += KIT_RENDER_BATCH;
      renderKits();
    });
    elements.kitGrid.append(button);
  }
}

function openDetail(kit, options = {}) {
  state.selectedKit = kit;
  state.activeModal = options.keepSettings ? "settings" : null;
  state.selectedImageIndex = 0;
  rememberViewedKit(kit);

  ensureSearchIndex(kit.franchise || state.franchise);
  renderDetail(kit);
  openDialog(elements.detailDialog);
  persistViewState({ mode: "push" });
}

function renderDetail(kit) {
  elements.detailKicker.textContent = `${seriesLabelFromKit(kit)} · ${gradeShortLabel(kit)}${kit.scale ? ` · ${kit.scale}` : ""}`;
  elements.detailTitle.textContent = kitShortName(kit);
  elements.detailSubtitle.textContent = [kit.release_date, formatPrice(kit.price_jpy)].filter((value) => value && value !== t("pending")).join(" · ");
  renderDetailStatusActions(kit);
  renderDetailMeta(kit);
  renderDetailBbxLink(kit);
  renderDetailMarketPanel(kit);
  renderDetailGallery(kit);
  fillCorrectionForm(kit);
  renderConsoleMode();

  const officialUrl = primaryOfficialUrl(kit);
  if (officialUrl) {
    elements.detailOfficialLink.href = officialUrl;
    elements.detailOfficialLink.hidden = false;
  } else {
    elements.detailOfficialLink.hidden = true;
  }
}

function closeDetail(options = {}) {
  if (options.navigate !== false && state.selectedKit) {
    window.history.back();
    return;
  }
  closeDialog(elements.detailDialog);
  state.selectedKit = null;
  persistViewState({ mode: "replace" });
}

// Catalog-side entry into the 陀螺 mapping: for a Beyblade kit, show which
// 陀螺 it feeds (auto-matched or manual) and let the user link it into a top by
// hand — the mirror of the link control inside the 图鉴 dialog.
async function renderDetailBbxLink(kit) {
  const el = elements.detailBbxLink;
  if (!el) return;
  if (kit.franchise !== "beyblade") {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = "";
  const bbx = await ensureBbxData();
  if (state.selectedKit !== kit) return; // user moved on while loading

  const title = document.createElement("h3");
  title.className = "detail-bbx-title";
  title.textContent = t("pictureBook");
  el.append(title);

  const linkedBaseSets = [...bbx.kitsByBaseSet.entries()].filter(([, set]) => set.has(kit.kit_id)).map(([bs]) => bs);
  const linkedTops = bbx.tops.filter((top) => linkedBaseSets.includes(top.base_set_id));

  if (linkedTops.length) {
    const list = document.createElement("div");
    list.className = "detail-bbx-tops";
    for (const top of linkedTops.slice(0, 12)) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "detail-bbx-top";
      chip.textContent = top.name;
      const manual = state.bbxManualMap?.get(kit.kit_id) === top.base_set_id;
      if (manual) {
        const tag = document.createElement("em");
        tag.textContent = t("bbxManualTag");
        chip.append(" ", tag);
      }
      chip.addEventListener("click", () => openBbxGuideToTop(top));
      list.append(chip);
    }
    el.append(list);
  } else {
    const hint = document.createElement("p");
    hint.className = "settings-hint";
    hint.textContent = t("guideNoKits");
    el.append(hint);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "bbx-link-toggle";
  addBtn.textContent = t("bbxAddToGuide");
  const picker = document.createElement("div");
  picker.className = "bbx-link-picker";
  picker.hidden = true;
  addBtn.addEventListener("click", () => {
    picker.hidden = !picker.hidden;
    if (!picker.hidden) bbxRenderTopPicker(kit, picker);
  });
  el.append(addBtn, picker);
}

// Inline searchable list of 陀螺 to attach this catalog kit to (catalog side).
function bbxRenderTopPicker(kit, container) {
  const bbx = state.bbx;
  container.innerHTML = "";
  const hint = document.createElement("p");
  hint.className = "settings-hint";
  hint.textContent = t("bbxPickTop");
  const search = document.createElement("input");
  search.type = "search";
  search.className = "bbx-link-search";
  search.placeholder = t("bbxLinkSearch");
  const list = document.createElement("div");
  list.className = "bbx-link-list";
  container.append(hint, search, list);

  const draw = () => {
    const codeQuery = bbxNormalizeCode(search.value);
    const nameQuery = search.value.trim().toLowerCase();
    list.innerHTML = "";
    const shown = bbx.tops
      .filter((top) => {
        if (!codeQuery && !nameQuery) return true;
        return bbxSetCode(top.base_set_id).includes(codeQuery) || top.name.toLowerCase().includes(nameQuery);
      })
      .slice(0, 40);
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "settings-hint";
      empty.textContent = t("bbxNoLinkCandidates");
      list.append(empty);
      return;
    }
    for (const top of shown) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bbx-link-candidate";
      row.textContent = top.name;
      row.addEventListener("click", async () => {
        await bbxLinkKitToTop(kit.kit_id, top.base_set_id);
        renderDetailBbxLink(kit);
      });
      list.append(row);
    }
  };
  search.addEventListener("input", draw);
  draw();
}

// Open the 图鉴 on the BBX tab focused on a specific top.
async function openBbxGuideToTop(top) {
  closeDialog(elements.detailDialog);
  await openGuide("bbx");
  openBbxTop(top);
}

function renderDetailMeta(kit) {
  const rows = [
    [t("franchise"), franchiseLabel(kit.franchise)],
    [t("workSource"), seriesLabelFromKit(kit)],
    [t("universe"), kit.universe || t("pending")],
    [t("productLine"), kit.subline && kit.subline !== kit.grade_code ? `${kit.grade_code} / ${kit.subline}` : kit.grade_code],
    [t("scale"), kit.scale || t("pending")],
    [t("release"), kit.release_date || t("pending")],
    [t("price"), formatPrice(kit.price_jpy)],
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
  updateGalleryControls(urls);
}

function selectAdjacentImage(delta) {
  if (!state.selectedKit) {
    return;
  }
  const urls = detailImages(state.selectedKit);
  if (urls.length < 2) {
    return;
  }
  selectDetailImage(urls, state.selectedImageIndex + delta);
}

function handleImagePointerStart(event) {
  state.swipeStartX = event.clientX;
  state.swipeStartY = event.clientY;
}

function handleImagePointerEnd(event) {
  if (state.swipeStartX === null || state.swipeStartY === null) {
    return;
  }

  const deltaX = event.clientX - state.swipeStartX;
  const deltaY = event.clientY - state.swipeStartY;
  clearImagePointer();

  if (Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
    return;
  }
  selectAdjacentImage(deltaX < 0 ? 1 : -1);
}

function clearImagePointer() {
  state.swipeStartX = null;
  state.swipeStartY = null;
}

function selectDetailImage(urls, index) {
  elements.detailMainImage.classList.remove("is-placeholder");
  elements.detailMainImage.innerHTML = "";
  if (!urls.length) {
    showPlaceholder(elements.detailMainImage, state.selectedKit?.grade_code || "?");
    updateGalleryControls(urls);
    return;
  }

  const safeIndex = ((index % urls.length) + urls.length) % urls.length;
  const url = urls[safeIndex] || urls[0];
  state.selectedImageIndex = safeIndex;
  const img = document.createElement("img");
  img.src = url;
  img.alt = t("mainImageAlt", { name: kitDisplayName(state.selectedKit) });
  img.addEventListener("error", () => {
    img.remove();
    if (urls[safeIndex + 1]) {
      selectDetailImage(urls, safeIndex + 1);
    } else {
      showPlaceholder(elements.detailMainImage, state.selectedKit?.grade_code || "?");
    }
  });
  elements.detailMainImage.append(img);

  for (const [thumbIndex, thumb] of [...elements.detailThumbs.children].entries()) {
    thumb.classList.toggle("is-active", thumbIndex === safeIndex);
  }
  updateGalleryControls(urls);
}

function updateGalleryControls(urls) {
  const disabled = urls.length < 2;
  elements.galleryPrev.disabled = disabled;
  elements.galleryNext.disabled = disabled;
  elements.detailMainImage.dataset.imageIndex = urls.length ? `${state.selectedImageIndex + 1} / ${urls.length}` : "";
}

function detailImages(kit) {
  return imageCandidatesForKit(kit);
}

function formatPrice(value) {
  return Number.isInteger(value) ? `¥${value.toLocaleString("ja-JP")}` : t("pending");
}

function showPlaceholder(container, gradeCode) {
  container.classList.add("is-placeholder");
  container.innerHTML = `<span>${escapeHtml(gradeCode)}</span>`;
}

function primaryOfficialUrl(kit) {
  const urls = kit.source_urls || [];
  if (state.activeView === "pbandai") {
    return urls.find((url) => /p-bandai\.jp/i.test(url)) || urls[0];
  }
  return urls[0];
}

function addReleaseBadge(container, kitOrDate) {
  const date = typeof kitOrDate === "string" ? kitOrDate : kitOrDate?.release_date;
  if (!date || container.querySelector(".release-date-badge")) {
    return;
  }
  const badge = document.createElement("span");
  badge.className = "release-date-badge";
  badge.textContent = date;
  container.append(badge);
}

function escapeHtml(value) {
  return escapeHtmlValue(value);
}

init().catch((error) => {
  document.body.innerHTML = `<main class="catalog-page"><div class="empty">${escapeHtml(error.message)}</div></main>`;
});
