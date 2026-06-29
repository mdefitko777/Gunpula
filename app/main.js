const LANGUAGE_KEY = "gunpula-catalog-language-v1";
const FRANCHISE_KEY = "gunpula-catalog-franchise-v1";
const OVERRIDE_KEY = "gunpula-catalog-overrides-v1";
const SERIES_LABEL_OVERRIDE_KEY = "gunpula-catalog-series-labels-v1";
const VIEW_STATE_KEY = "gunpula-catalog-view-state-v1";
const CONSOLE_MODE_KEY = "gunpula-catalog-console-mode-v1";
const COLLECTION_KEY = "gunpula-catalog-collection-v1";
const SYNC_CONFIG_KEY = "gunpula-catalog-sync-config-v1";
const SYNC_META_KEY = "gunpula-catalog-sync-meta-v1";
const ACTIVE_VIEW_KEY = "gunpula-catalog-active-view-v1";
const COLLECTION_HOME_VISIBILITY_KEY = "gunpula-catalog-home-collection-visibility-v1";
const COLLECTION_HOME_COLLAPSE_KEY = "gunpula-catalog-home-collection-collapse-v1";
const UPDATE_NOTIFICATION_KEY = "gunpula-catalog-update-notifications-v1";
const UPDATE_NOTIFICATION_LAST_KEY = "gunpula-catalog-update-notified-v1";
const SYNC_POLL_INTERVAL_MS = 15000;
const SYNC_SAVE_DEBOUNCE_MS = 700;

const COLLECTION_TYPES = ["owned", "wanted"];

const LANGUAGES = [
  { code: "zh", label: "中", htmlLang: "zh-CN" },
  { code: "ko", label: "한", htmlLang: "ko-KR" },
  { code: "en", label: "EN", htmlLang: "en" },
  { code: "ja", label: "日", htmlLang: "ja" },
];

const FRANCHISES = ["gundam", "armored_core", "pokemon", "beyblade"];

const FRANCHISE_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "ガンダム" },
  armored_core: { zh: "Armored Core", ko: "아머드 코어", en: "Armored Core", ja: "アーマード・コア" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  beyblade: { zh: "Beyblade X", ko: "베이블레이드 X", en: "Beyblade X", ja: "ベイブレードX" },
};

const FRANCHISE_SHORT_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "Gundam" },
  armored_core: { zh: "AC", ko: "AC", en: "AC", ja: "AC" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  beyblade: { zh: "BBX", ko: "BBX", en: "BBX", ja: "BBX" },
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
  SH_FIGUARTS: { zh: "SHF", ko: "SHF", en: "SHF", ja: "SHF" },
  GUNDAM_MERCH: { zh: "周边", ko: "굿즈", en: "Goods", ja: "グッズ" },
  POKE_GASHAPON: { zh: "扭蛋", ko: "가샤폰", en: "Gashapon", ja: "ガシャポン" },
  POKEPLA: { zh: "拼装", ko: "프라모델", en: "Model Kit", ja: "プラモ" },
  BEYBLADE_X: { zh: "BBX", ko: "BBX", en: "BBX", ja: "BBX" },
  AC30MM: { zh: "30MM", ko: "30MM", en: "30MM", ja: "30MM" },
  ACVI: { zh: "V.I.", ko: "V.I.", en: "V.I.", ja: "V.I." },
};

const MODEL_GRADE_CATEGORIES = new Set(["core", "core_subline", "historical", "one_hundred", "plastic_model", "sd", "special"]);

const ITEM_TYPE_LABELS = {
  plastic_model: { zh: "拼装", ko: "프라모델", en: "Model kit", ja: "プラモデル" },
  tamashii_figure: { zh: "成品", ko: "완성품", en: "Figure", ja: "完成品" },
  gashapon: { zh: "扭蛋", ko: "가샤폰", en: "Gashapon", ja: "ガシャポン" },
  shokugan: { zh: "食玩", ko: "식완", en: "Shokugan", ja: "食玩" },
  battle_toy: { zh: "战斗玩具", ko: "배틀 토이", en: "Battle toy", ja: "バトルトイ" },
  other: { zh: "其他", ko: "기타", en: "Other", ja: "その他" },
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
    itemType: "商品类型",
    allTypes: "全部类型",
    releaseYear: "发售年份",
    allYears: "全部年份",
    limitedStatus: "限定状态",
    limitedAll: "全部",
    limitedOnly: "限定",
    regularOnly: "普通",
    priceRange: "价格区间",
    priceMin: "最低",
    priceMax: "最高",
    clearFilters: "清除筛选",
    workSource: "系列",
    catalogList: "目录",
    settings: "设置",
    closeSettings: "关闭设置",
    language: "语言",
    consoleMode: "控制台模式",
    homeDisplay: "主页显示",
    showOwnedOnHome: "主页显示已购买",
    showWantedOnHome: "主页显示想要",
    ownedList: "已购买",
    wantedList: "想要",
    markOwned: "已购买",
    unmarkOwned: "取消已购买",
    markWanted: "想要",
    unmarkWanted: "取消想要",
    wantedQuantity: "想要数量",
    collectionDetails: "收藏信息",
    collectionQuantity: "数量",
    purchasePrice: "购买价",
    storageLocation: "存放位置",
    collectionNote: "备注",
    saveCollectionDetails: "保存收藏信息",
    selectVisible: "全选当前",
    selectItem: "选择 {name}",
    selectedCount: "已选 {selected}/{total}",
    deleteSelected: "删除选中",
    clearCollection: "全部删除",
    clearCollectionConfirm: "要删除{name}里的 {count} 条吗？",
    collapseCollection: "折叠{name}",
    expandCollection: "展开{name}",
    shoppingTotal: "预算 {total}",
    duplicateCandidates: "疑似重复",
    recentUpdates: "最近更新",
    viewAllUpdates: "全部记录",
    latestUpdate: "最新 {date}",
    premiumBandai: "PB",
    updateRecentEmpty: "暂无可显示的更新",
    addedBadge: "新增",
    changedBadge: "变更",
    removedBadge: "移除",
    updateLog: "更新记录",
    updateToday: "本日",
    updateWeek: "本周",
    updateMonth: "本月",
    watchedUpdates: "SEED / 00",
    updateAdded: "新增 {count}",
    updateChanged: "变更 {count}",
    updateRemoved: "移除 {count}",
    noUpdateFeed: "还没有更新摘要",
    updateFeedEmpty: "最近没有新增记录",
    updateNotification: "更新通知",
    updateNotificationHint: "开启后，应用打开时会提醒新数据；SEED / 00 会优先提示。",
    notificationEnabled: "通知已开启",
    notificationDisabled: "通知未开启",
    notificationDenied: "系统拒绝了通知权限",
    notificationUnsupported: "当前浏览器不支持通知",
    notificationSeedTitle: "SEED / 00 有新更新",
    notificationUpdateTitle: "模型库已更新",
    notificationUpdateBody: "{date} · 新增 {added} · 变更 {changed}",
    decreaseWantedQuantity: "减少想要数量",
    increaseWantedQuantity: "增加想要数量",
    previousImage: "上一张",
    nextImage: "下一张",
    sharedSync: "共享同步",
    syncLocal: "本地模式",
    syncConnecting: "连接中",
    syncConnected: "已同步",
    syncReadOnly: "只读同步",
    syncError: "同步异常",
    syncSaving: "正在上传",
    syncSaved: "已上传",
    supabaseUrl: "Supabase URL",
    supabaseAnonKey: "Anon key",
    workspaceId: "共享空间 ID",
    workspaceSecret: "共享密码",
    editorSecret: "编辑密码",
    memberName: "你的名字",
    saveSyncConfig: "保存并连接",
    syncNow: "立即同步",
    disconnectSync: "断开云同步",
    installApp: "安装到手机",
    appUpdate: "应用更新",
    refreshAppCache: "检查更新",
    refreshAppHint: "清理程序缓存并重新载入最新版本，不会删除收藏。",
    refreshAppBusy: "正在更新...",
    refreshAppDone: "缓存已清理，正在重载。",
    refreshAppError: "更新失败，请稍后再试。",
    syncHint: "同一个共享空间 ID 会共用收藏、更正和系列名；编辑密码控制谁能改。",
    syncConfigured: "云端已配置",
    syncNotConfigured: "未配置云端",
    syncUpdatedBy: "最后同步：{name} · {time}",
    readOnlyHint: "当前只有查看权限，不能修改收藏或更正。",
    cloudSetupMissing: "Supabase 还没建表，请先执行 docs/supabase-setup.sql。",
    appHealth: "最大问题",
    issueInstall: "安卓安装",
    issueInstallStatus: "已支持 PWA",
    issueSync: "两人数据互通",
    issueImages: "官方图片稳定性",
    issueImagesStatus: "已启用本机图片缓存",
    imageHealth: "图片健康",
    imageHealthReady: "可用 {working}/{checked} · 坏链接 {broken} · 更新 {date}",
    imageHealthMissing: "无可用图 {count}",
    imageHealthUnavailable: "还没有图片检查报告",
    issueRefresh: "官方数据更新",
    issueRefreshStatus: "已提供定时刷新工作流",
    issueConflict: "冲突处理",
    issueConflictStatus: "后同步覆盖，保留历史",
    officialPage: "官方商品页",
    manualCorrection: "手动更正",
    seriesAdmin: "系列名称",
    displayLanguage: "显示语言",
    seriesName: "系列名",
    saveSeriesName: "保存系列名",
    clearSeriesName: "清除本语言",
    exportSeriesNames: "导出系列名",
    nameZh: "中文名",
    nameKo: "韩文名",
    nameEn: "英文名",
    nameJa: "日文名",
    subline: "子系列",
    universe: "宇宙 / 纪年",
    coverImageUrl: "封面图 URL",
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
    itemType: "상품 유형",
    allTypes: "전체 유형",
    releaseYear: "발매 연도",
    allYears: "전체 연도",
    limitedStatus: "한정 여부",
    limitedAll: "전체",
    limitedOnly: "한정",
    regularOnly: "일반",
    priceRange: "가격 범위",
    priceMin: "최저",
    priceMax: "최고",
    clearFilters: "필터 지우기",
    workSource: "시리즈",
    catalogList: "목록",
    settings: "설정",
    closeSettings: "설정 닫기",
    language: "언어",
    consoleMode: "콘솔 모드",
    homeDisplay: "홈 표시",
    showOwnedOnHome: "홈에 구매함 표시",
    showWantedOnHome: "홈에 원함 표시",
    ownedList: "구매함",
    wantedList: "원함",
    markOwned: "구매함",
    unmarkOwned: "구매함 해제",
    markWanted: "원함",
    unmarkWanted: "원함 해제",
    wantedQuantity: "원하는 수량",
    collectionDetails: "컬렉션 정보",
    collectionQuantity: "수량",
    purchasePrice: "구매가",
    storageLocation: "보관 위치",
    collectionNote: "메모",
    saveCollectionDetails: "컬렉션 정보 저장",
    selectVisible: "현재 목록 전체 선택",
    selectItem: "{name} 선택",
    selectedCount: "{selected}/{total} 선택됨",
    deleteSelected: "선택 삭제",
    clearCollection: "전체 삭제",
    clearCollectionConfirm: "{name}의 {count}개 항목을 삭제할까요?",
    collapseCollection: "{name} 접기",
    expandCollection: "{name} 펼치기",
    shoppingTotal: "예산 {total}",
    duplicateCandidates: "중복 후보",
    recentUpdates: "최근 업데이트",
    viewAllUpdates: "전체 기록",
    latestUpdate: "최신 {date}",
    premiumBandai: "PB",
    updateRecentEmpty: "표시할 업데이트가 없습니다",
    addedBadge: "신규",
    changedBadge: "변경",
    removedBadge: "삭제",
    updateLog: "업데이트 기록",
    updateToday: "오늘",
    updateWeek: "이번 주",
    updateMonth: "이번 달",
    watchedUpdates: "SEED / 00",
    updateAdded: "신규 {count}",
    updateChanged: "변경 {count}",
    updateRemoved: "삭제 {count}",
    noUpdateFeed: "업데이트 요약이 없습니다",
    updateFeedEmpty: "최근 신규 기록이 없습니다",
    updateNotification: "업데이트 알림",
    updateNotificationHint: "켜면 앱을 열 때 새 데이터를 알려줍니다. SEED / 00은 우선 알림됩니다.",
    notificationEnabled: "알림 켜짐",
    notificationDisabled: "알림 꺼짐",
    notificationDenied: "시스템에서 알림 권한을 거부했습니다",
    notificationUnsupported: "현재 브라우저는 알림을 지원하지 않습니다",
    notificationSeedTitle: "SEED / 00 업데이트",
    notificationUpdateTitle: "모델 DB 업데이트",
    notificationUpdateBody: "{date} · 신규 {added} · 변경 {changed}",
    decreaseWantedQuantity: "원하는 수량 줄이기",
    increaseWantedQuantity: "원하는 수량 늘리기",
    previousImage: "이전 이미지",
    nextImage: "다음 이미지",
    sharedSync: "공유 동기화",
    syncLocal: "로컬 모드",
    syncConnecting: "연결 중",
    syncConnected: "동기화됨",
    syncReadOnly: "읽기 전용",
    syncError: "동기화 오류",
    syncSaving: "업로드 중",
    syncSaved: "업로드됨",
    supabaseUrl: "Supabase URL",
    supabaseAnonKey: "Anon key",
    workspaceId: "공유 공간 ID",
    workspaceSecret: "공유 비밀번호",
    editorSecret: "편집 비밀번호",
    memberName: "내 이름",
    saveSyncConfig: "저장하고 연결",
    syncNow: "지금 동기화",
    disconnectSync: "클라우드 해제",
    installApp: "휴대폰에 설치",
    appUpdate: "앱 업데이트",
    refreshAppCache: "업데이트 확인",
    refreshAppHint: "앱 캐시를 비우고 최신 버전을 다시 불러옵니다. 컬렉션은 삭제되지 않습니다.",
    refreshAppBusy: "업데이트 중...",
    refreshAppDone: "캐시를 비웠습니다. 다시 불러옵니다.",
    refreshAppError: "업데이트에 실패했습니다. 잠시 후 다시 시도하세요.",
    syncHint: "같은 공유 공간 ID는 컬렉션, 수정, 시리즈 이름을 공유합니다. 편집 비밀번호가 수정 권한을 제어합니다.",
    syncConfigured: "클라우드 설정됨",
    syncNotConfigured: "클라우드 미설정",
    syncUpdatedBy: "마지막 동기화: {name} · {time}",
    readOnlyHint: "현재 읽기 전용 권한이라 컬렉션이나 수정 내용을 변경할 수 없습니다.",
    cloudSetupMissing: "Supabase 테이블이 없습니다. docs/supabase-setup.sql을 먼저 실행하세요.",
    appHealth: "주요 문제",
    issueInstall: "Android 설치",
    issueInstallStatus: "PWA 지원됨",
    issueSync: "두 사람 데이터 공유",
    issueImages: "공식 이미지 안정성",
    issueImagesStatus: "로컬 이미지 캐시 사용",
    imageHealth: "이미지 상태",
    imageHealthReady: "사용 가능 {working}/{checked} · 깨진 링크 {broken} · 업데이트 {date}",
    imageHealthMissing: "사용 가능한 이미지 없음 {count}",
    imageHealthUnavailable: "이미지 검사 보고서가 아직 없습니다",
    issueRefresh: "공식 데이터 업데이트",
    issueRefreshStatus: "예약 갱신 워크플로 제공",
    issueConflict: "충돌 처리",
    issueConflictStatus: "나중 동기화 우선, 기록 보관",
    officialPage: "공식 상품 페이지",
    manualCorrection: "수동 수정",
    seriesAdmin: "시리즈 이름",
    displayLanguage: "표시 언어",
    seriesName: "시리즈명",
    saveSeriesName: "시리즈명 저장",
    clearSeriesName: "이 언어 초기화",
    exportSeriesNames: "시리즈명 내보내기",
    nameZh: "중국어 이름",
    nameKo: "한국어 이름",
    nameEn: "영어 이름",
    nameJa: "일본어 이름",
    subline: "하위 시리즈",
    universe: "세계관 / 연표",
    coverImageUrl: "커버 이미지 URL",
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
    itemType: "Item type",
    allTypes: "All types",
    releaseYear: "Release year",
    allYears: "All years",
    limitedStatus: "Limited status",
    limitedAll: "All",
    limitedOnly: "Limited",
    regularOnly: "Regular",
    priceRange: "Price range",
    priceMin: "Min",
    priceMax: "Max",
    clearFilters: "Clear filters",
    workSource: "Series",
    catalogList: "Catalog",
    settings: "Settings",
    closeSettings: "Close settings",
    language: "Language",
    consoleMode: "Console mode",
    homeDisplay: "Home display",
    showOwnedOnHome: "Show owned on home",
    showWantedOnHome: "Show wanted on home",
    ownedList: "Owned",
    wantedList: "Wanted",
    markOwned: "Owned",
    unmarkOwned: "Remove owned",
    markWanted: "Wanted",
    unmarkWanted: "Remove wanted",
    wantedQuantity: "Wanted quantity",
    collectionDetails: "Collection details",
    collectionQuantity: "Quantity",
    purchasePrice: "Purchase price",
    storageLocation: "Storage location",
    collectionNote: "Note",
    saveCollectionDetails: "Save collection details",
    selectVisible: "Select visible",
    selectItem: "Select {name}",
    selectedCount: "Selected {selected}/{total}",
    deleteSelected: "Delete selected",
    clearCollection: "Delete all",
    clearCollectionConfirm: "Delete {count} items from {name}?",
    collapseCollection: "Collapse {name}",
    expandCollection: "Expand {name}",
    shoppingTotal: "Budget {total}",
    duplicateCandidates: "Duplicate candidates",
    recentUpdates: "Recent Updates",
    viewAllUpdates: "All Updates",
    latestUpdate: "Latest {date}",
    premiumBandai: "PB",
    updateRecentEmpty: "No updates to show",
    addedBadge: "Added",
    changedBadge: "Changed",
    removedBadge: "Removed",
    updateLog: "Update log",
    updateToday: "Today",
    updateWeek: "This week",
    updateMonth: "This month",
    watchedUpdates: "SEED / 00",
    updateAdded: "Added {count}",
    updateChanged: "Changed {count}",
    updateRemoved: "Removed {count}",
    noUpdateFeed: "No update summary yet",
    updateFeedEmpty: "No recent additions",
    updateNotification: "Update notifications",
    updateNotificationHint: "When enabled, the app notifies you after new data loads. SEED / 00 is prioritized.",
    notificationEnabled: "Notifications on",
    notificationDisabled: "Notifications off",
    notificationDenied: "Notifications are blocked by the system",
    notificationUnsupported: "Notifications are not supported here",
    notificationSeedTitle: "SEED / 00 update",
    notificationUpdateTitle: "Catalog updated",
    notificationUpdateBody: "{date} · Added {added} · Changed {changed}",
    decreaseWantedQuantity: "Decrease wanted quantity",
    increaseWantedQuantity: "Increase wanted quantity",
    previousImage: "Previous image",
    nextImage: "Next image",
    sharedSync: "Shared sync",
    syncLocal: "Local mode",
    syncConnecting: "Connecting",
    syncConnected: "Synced",
    syncReadOnly: "Read-only sync",
    syncError: "Sync error",
    syncSaving: "Uploading",
    syncSaved: "Uploaded",
    supabaseUrl: "Supabase URL",
    supabaseAnonKey: "Anon key",
    workspaceId: "Workspace ID",
    workspaceSecret: "Shared password",
    editorSecret: "Editor password",
    memberName: "Your name",
    saveSyncConfig: "Save and connect",
    syncNow: "Sync now",
    disconnectSync: "Disconnect cloud",
    installApp: "Install on phone",
    appUpdate: "App update",
    refreshAppCache: "Check for update",
    refreshAppHint: "Clears app caches and reloads the latest version. Collections stay untouched.",
    refreshAppBusy: "Updating...",
    refreshAppDone: "Cache cleared. Reloading.",
    refreshAppError: "Update failed. Try again later.",
    syncHint: "The same workspace ID shares collections, corrections, and series names. The editor password controls write access.",
    syncConfigured: "Cloud configured",
    syncNotConfigured: "Cloud not configured",
    syncUpdatedBy: "Last sync: {name} · {time}",
    readOnlyHint: "You currently have read-only access, so collection and correction edits are disabled.",
    cloudSetupMissing: "Supabase tables are missing. Run docs/supabase-setup.sql first.",
    appHealth: "Main risks",
    issueInstall: "Android install",
    issueInstallStatus: "PWA ready",
    issueSync: "Two-person sync",
    issueImages: "Official image stability",
    issueImagesStatus: "Local image cache enabled",
    imageHealth: "Image health",
    imageHealthReady: "Working {working}/{checked} · broken links {broken} · updated {date}",
    imageHealthMissing: "No working image {count}",
    imageHealthUnavailable: "No image check report yet",
    issueRefresh: "Official data updates",
    issueRefreshStatus: "Scheduled refresh workflow added",
    issueConflict: "Conflict handling",
    issueConflictStatus: "Latest sync wins, history kept",
    officialPage: "Official product page",
    manualCorrection: "Manual correction",
    seriesAdmin: "Series names",
    displayLanguage: "Display language",
    seriesName: "Series name",
    saveSeriesName: "Save series name",
    clearSeriesName: "Clear language",
    exportSeriesNames: "Export series names",
    nameZh: "Chinese name",
    nameKo: "Korean name",
    nameEn: "English name",
    nameJa: "Japanese name",
    subline: "Subline",
    universe: "Universe / era",
    coverImageUrl: "Cover image URL",
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
    itemType: "商品タイプ",
    allTypes: "すべてのタイプ",
    releaseYear: "発売年",
    allYears: "すべての年",
    limitedStatus: "限定状態",
    limitedAll: "すべて",
    limitedOnly: "限定",
    regularOnly: "通常",
    priceRange: "価格帯",
    priceMin: "最小",
    priceMax: "最大",
    clearFilters: "絞り込み解除",
    workSource: "シリーズ",
    catalogList: "一覧",
    settings: "設定",
    closeSettings: "設定を閉じる",
    language: "言語",
    consoleMode: "コンソールモード",
    homeDisplay: "ホーム表示",
    showOwnedOnHome: "ホームに購入済みを表示",
    showWantedOnHome: "ホームに欲しいを表示",
    ownedList: "購入済み",
    wantedList: "欲しい",
    markOwned: "購入済み",
    unmarkOwned: "購入済み解除",
    markWanted: "欲しい",
    unmarkWanted: "欲しい解除",
    wantedQuantity: "欲しい数",
    collectionDetails: "コレクション情報",
    collectionQuantity: "数量",
    purchasePrice: "購入価格",
    storageLocation: "保管場所",
    collectionNote: "メモ",
    saveCollectionDetails: "コレクション情報を保存",
    selectVisible: "表示中を全選択",
    selectItem: "{name} を選択",
    selectedCount: "{selected}/{total} 選択中",
    deleteSelected: "選択を削除",
    clearCollection: "すべて削除",
    clearCollectionConfirm: "{name} から {count} 件を削除しますか？",
    collapseCollection: "{name} を折りたたむ",
    expandCollection: "{name} を展開",
    shoppingTotal: "予算 {total}",
    duplicateCandidates: "重複候補",
    recentUpdates: "最近の更新",
    viewAllUpdates: "すべて",
    latestUpdate: "最新 {date}",
    premiumBandai: "PB",
    updateRecentEmpty: "表示できる更新はありません",
    addedBadge: "追加",
    changedBadge: "変更",
    removedBadge: "削除",
    updateLog: "更新履歴",
    updateToday: "本日",
    updateWeek: "今週",
    updateMonth: "今月",
    watchedUpdates: "SEED / 00",
    updateAdded: "追加 {count}",
    updateChanged: "変更 {count}",
    updateRemoved: "削除 {count}",
    noUpdateFeed: "更新サマリーはまだありません",
    updateFeedEmpty: "最近の追加はありません",
    updateNotification: "更新通知",
    updateNotificationHint: "オンにすると、アプリ起動時に新データを通知します。SEED / 00を優先します。",
    notificationEnabled: "通知オン",
    notificationDisabled: "通知オフ",
    notificationDenied: "通知権限が拒否されています",
    notificationUnsupported: "このブラウザは通知に対応していません",
    notificationSeedTitle: "SEED / 00 更新",
    notificationUpdateTitle: "カタログ更新",
    notificationUpdateBody: "{date} · 追加 {added} · 変更 {changed}",
    decreaseWantedQuantity: "欲しい数を減らす",
    increaseWantedQuantity: "欲しい数を増やす",
    previousImage: "前の画像",
    nextImage: "次の画像",
    sharedSync: "共有同期",
    syncLocal: "ローカルモード",
    syncConnecting: "接続中",
    syncConnected: "同期済み",
    syncReadOnly: "読み取り専用",
    syncError: "同期エラー",
    syncSaving: "アップロード中",
    syncSaved: "アップロード済み",
    supabaseUrl: "Supabase URL",
    supabaseAnonKey: "Anon key",
    workspaceId: "共有スペース ID",
    workspaceSecret: "共有パスワード",
    editorSecret: "編集パスワード",
    memberName: "あなたの名前",
    saveSyncConfig: "保存して接続",
    syncNow: "今すぐ同期",
    disconnectSync: "クラウド解除",
    installApp: "スマホにインストール",
    appUpdate: "アプリ更新",
    refreshAppCache: "更新を確認",
    refreshAppHint: "アプリのキャッシュを削除して最新版を読み込みます。コレクションは消えません。",
    refreshAppBusy: "更新中...",
    refreshAppDone: "キャッシュを削除しました。再読み込みします。",
    refreshAppError: "更新に失敗しました。後でもう一度お試しください。",
    syncHint: "同じ共有スペース ID はコレクション、修正、シリーズ名を共有します。編集パスワードで変更権限を制御します。",
    syncConfigured: "クラウド設定済み",
    syncNotConfigured: "クラウド未設定",
    syncUpdatedBy: "最終同期: {name} · {time}",
    readOnlyHint: "現在は読み取り専用のため、コレクションや修正は変更できません。",
    cloudSetupMissing: "Supabase テーブルがありません。先に docs/supabase-setup.sql を実行してください。",
    appHealth: "主な課題",
    issueInstall: "Android インストール",
    issueInstallStatus: "PWA 対応済み",
    issueSync: "2人のデータ共有",
    issueImages: "公式画像の安定性",
    issueImagesStatus: "ローカル画像キャッシュ有効",
    imageHealth: "画像状態",
    imageHealthReady: "使用可 {working}/{checked} · リンク切れ {broken} · 更新 {date}",
    imageHealthMissing: "使用できる画像なし {count}",
    imageHealthUnavailable: "画像チェックレポートはまだありません",
    issueRefresh: "公式データ更新",
    issueRefreshStatus: "定期更新ワークフロー追加",
    issueConflict: "競合処理",
    issueConflictStatus: "後の同期を優先、履歴保持",
    officialPage: "公式商品ページ",
    manualCorrection: "手動修正",
    seriesAdmin: "シリーズ名",
    displayLanguage: "表示言語",
    seriesName: "シリーズ名",
    saveSeriesName: "シリーズ名を保存",
    clearSeriesName: "この言語をクリア",
    exportSeriesNames: "シリーズ名を出力",
    nameZh: "中国語名",
    nameKo: "韓国語名",
    nameEn: "英語名",
    nameJa: "日本語名",
    subline: "サブシリーズ",
    universe: "世界観 / 年代",
    coverImageUrl: "カバー画像 URL",
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

const INITIAL_VIEW_STATE = loadSavedViewState();

const state = {
  rawKits: [],
  kits: [],
  grades: [],
  sources: [],
  imageHealth: null,
  updateFeed: null,
  overrides: {},
  seriesLabelOverrides: {},
  collection: { owned: [], wanted: [] },
  homeCollectionVisibility: loadHomeCollectionVisibility(),
  homeCollectionCollapsed: loadHomeCollectionCollapsed(),
  updateNotifications: localStorage.getItem(UPDATE_NOTIFICATION_KEY) === "true",
  collectionSelection: { owned: new Set(), wanted: new Set() },
  syncConfig: loadSyncConfig(),
  syncMeta: loadSyncMeta(),
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
  },
  activeView: INITIAL_VIEW_STATE.view || localStorage.getItem(ACTIVE_VIEW_KEY) || "catalog",
  activeModal: INITIAL_VIEW_STATE.modal || null,
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
  swipeStartX: null,
  swipeStartY: null,
};

const elements = {
  datasetSummary: document.querySelector("#datasetSummary"),
  sectionTitle: document.querySelector("#sectionTitle"),
  bottomNav: document.querySelector("#bottomNav"),
  settingsOpen: document.querySelector("#settingsOpen"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsClose: document.querySelector("#settingsClose"),
  consoleModeToggle: document.querySelector("#consoleModeToggle"),
  showOwnedOnHome: document.querySelector("#showOwnedOnHome"),
  showWantedOnHome: document.querySelector("#showWantedOnHome"),
  syncState: document.querySelector("#syncState"),
  syncStatusText: document.querySelector("#syncStatusText"),
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
  issueSyncStatus: document.querySelector("#issueSyncStatus"),
  updateLog: document.querySelector("#updateLog"),
  imageHealthLog: document.querySelector("#imageHealthLog"),
  updatesSection: document.querySelector("#updatesSection"),
  updatesSubtitle: document.querySelector("#updatesSubtitle"),
  updatesOpenSettings: document.querySelector("#updatesOpenSettings"),
  homeUpdateSummary: document.querySelector("#homeUpdateSummary"),
  homeUpdateList: document.querySelector("#homeUpdateList"),
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
  collectionSelectAll: document.querySelector("#collectionSelectAll"),
  collectionSelectionSummary: document.querySelector("#collectionSelectionSummary"),
  deleteSelectedCollection: document.querySelector("#deleteSelectedCollection"),
  clearCollectionView: document.querySelector("#clearCollectionView"),
  searchInput: document.querySelector("#searchInput"),
  filterSummary: document.querySelector("#filterSummary"),
  franchiseList: document.querySelector("#franchiseList"),
  languageList: document.querySelector("#languageList"),
  seriesTabs: document.querySelector("#seriesTabs"),
  gradeSelect: document.querySelector("#gradeSelect"),
  seriesSelect: document.querySelector("#seriesSelect"),
  itemTypeSelect: document.querySelector("#itemTypeSelect"),
  releaseYearSelect: document.querySelector("#releaseYearSelect"),
  limitedSelect: document.querySelector("#limitedSelect"),
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
};

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function loadOptionalJson(path) {
  try {
    return await loadJson(path);
  } catch {
    return null;
  }
}

function preferredLanguage() {
  const language = localStorage.getItem(LANGUAGE_KEY);
  return LANGUAGES.some((item) => item.code === language) ? language : null;
}

function loadSavedViewState() {
  let stored = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || "{}");
    stored = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    stored = {};
  }

  const storedLanguage = preferredLanguage() || stored.language;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  if (!hash) {
    return { ...stored, language: storedLanguage };
  }

  const fromHash = {};
  fromHash.language = params.get("lang") || params.get("language") || storedLanguage || stored.language;
  fromHash.franchise = params.get("franchise") || stored.franchise;
  fromHash.series = params.get("series") || "all";
  fromHash.grade = params.get("grade") || "all";
  fromHash.itemType = params.get("type") || "all";
  fromHash.releaseYear = params.get("year") || "all";
  fromHash.limited = params.get("limited") || "all";
  fromHash.priceMin = params.get("min") || "";
  fromHash.priceMax = params.get("max") || "";
  fromHash.query = params.get("q") || params.get("query") || "";
  fromHash.kit = params.has("kit") ? params.get("kit") : null;
  fromHash.view = params.get("view") || "catalog";
  fromHash.modal = params.get("modal") || null;

  return fromHash;
}

function currentViewState() {
  return {
    language: state.language,
    franchise: state.franchise,
    series: state.series,
    grade: state.grade,
    itemType: state.itemType,
    releaseYear: state.releaseYear,
    limited: state.limited,
    priceMin: state.priceMin,
    priceMax: state.priceMax,
    query: state.query,
    kit: state.selectedKit?.kit_id || null,
    view: state.activeView,
    modal: state.activeModal,
  };
}

function viewStateUrl(viewState) {
  localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState));

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
  state.series = viewState.series || "all";
  state.grade = viewState.grade || "all";
  state.itemType = viewState.itemType || "all";
  state.releaseYear = viewState.releaseYear || "all";
  state.limited = viewState.limited || "all";
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
    if (!elements.detailDialog.open) {
      elements.detailDialog.showModal();
    }
  } else if (elements.detailDialog.open) {
    elements.detailDialog.close();
  }
  if (state.activeModal === "settings") {
    renderSettings();
    if (!elements.settingsDialog.open) {
      elements.settingsDialog.showModal();
    }
  } else if (elements.settingsDialog.open) {
    elements.settingsDialog.close();
  }
  persistViewState();
}

async function init() {
  const [gradesDoc, kitsDoc, sourcesDoc, imageHealthDoc, updateFeedDoc] = await Promise.all([
    loadJson("../data/grades.json"),
    loadJson("../data/kits.json"),
    loadJson("../data/sources.json"),
    loadOptionalJson("../data/image-health.json"),
    loadOptionalJson("../data/update-feed.json"),
  ]);

  state.grades = gradesDoc.grades;
  state.rawKits = kitsDoc.kits;
  state.sources = sourcesDoc.sources;
  state.imageHealth = imageHealthDoc;
  state.updateFeed = updateFeedDoc;
  state.overrides = loadOverrides();
  state.seriesLabelOverrides = loadSeriesLabelOverrides();
  state.collection = loadCollection();
  state.updatedAt = kitsDoc.updated_at;
  refreshKits();
  normalizeState();
  state.selectedKit = state.pendingKitId ? displayKitById(state.pendingKitId) : null;

  bindEvents();
  registerPwa();
  if (syncConfigComplete()) {
    await connectSync({ silent: true });
  }
  render();
  if (state.selectedKit) {
    renderDetail(state.selectedKit);
    elements.detailDialog.showModal();
  }
  if (state.activeModal === "settings") {
    renderSettings();
    elements.settingsDialog.showModal();
  }
  seedInitialOverlayHistory();
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
  if (!["catalog", "owned", "wanted"].includes(state.activeView)) {
    state.activeView = "catalog";
  }
  if (!["all", "limited", "regular"].includes(state.limited)) {
    state.limited = "all";
  }
  if (state.activeModal && state.activeModal !== "settings") {
    state.activeModal = null;
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

function loadSeriesLabelOverrides() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SERIES_LABEL_OVERRIDE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadConsoleMode() {
  return localStorage.getItem(CONSOLE_MODE_KEY) === "true";
}

function loadHomeCollectionVisibility() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLECTION_HOME_VISIBILITY_KEY) || "{}");
    return {
      owned: parsed.owned !== false,
      wanted: parsed.wanted !== false,
    };
  } catch {
    return { owned: true, wanted: true };
  }
}

function saveHomeCollectionVisibility() {
  localStorage.setItem(COLLECTION_HOME_VISIBILITY_KEY, JSON.stringify(state.homeCollectionVisibility));
}

function loadHomeCollectionCollapsed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLECTION_HOME_COLLAPSE_KEY) || "{}");
    return {
      owned: parsed.owned === true,
      wanted: parsed.wanted === true,
    };
  } catch {
    return { owned: false, wanted: false };
  }
}

function saveHomeCollectionCollapsed() {
  localStorage.setItem(COLLECTION_HOME_COLLAPSE_KEY, JSON.stringify(state.homeCollectionCollapsed));
}

function loadCollection() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLLECTION_KEY) || "{}");
    return normalizeCollection(parsed);
  } catch {
    return { owned: [], wanted: [] };
  }
}

function clampCollectionQuantity(value) {
  const quantity = Math.trunc(Number(value));
  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }
  return Math.min(quantity, 99);
}

function normalizeCollection(collection = {}) {
  const items = collection.items && typeof collection.items === "object" ? { ...collection.items } : {};
  const now = new Date().toISOString();
  for (const kitId of Array.isArray(collection.owned) ? collection.owned : []) {
    if (!items[kitId]) {
      items[kitId] = { status: "owned", updated_at: now, updated_by: "local" };
    }
  }
  for (const kitId of Array.isArray(collection.wanted) ? collection.wanted : []) {
    if (!items[kitId]) {
      items[kitId] = { status: "wanted", quantity: 1, updated_at: now, updated_by: "local" };
    }
  }
  const owned = [];
  const wanted = [];
  const normalizedItems = {};
  for (const [kitId, entry] of Object.entries(items)) {
    const common = {
      updated_at: entry.updated_at || now,
      updated_by: entry.updated_by || "local",
      quantity: clampCollectionQuantity(entry.quantity ?? entry.wanted_quantity ?? 1),
    };
    if (entry.note) common.note = String(entry.note);
    if (entry.storage) common.storage = String(entry.storage);
    const purchasePrice = numericFilterValue(entry.purchase_price);
    if (purchasePrice !== null) common.purchase_price = Math.round(purchasePrice);
    if (entry?.status === "owned") {
      normalizedItems[kitId] = {
        ...common,
        status: "owned",
      };
      owned.push(kitId);
    }
    if (entry?.status === "wanted") {
      normalizedItems[kitId] = {
        ...common,
        status: "wanted",
      };
      wanted.push(kitId);
    }
  }
  return { owned: [...new Set(owned)], wanted: [...new Set(wanted)], items: normalizedItems };
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

function saveOverrides(options = {}) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(state.overrides, null, 2));
  if (!options.skipSync) {
    scheduleCloudSave("overrides");
  }
}

function saveSeriesLabelOverrides(options = {}) {
  localStorage.setItem(SERIES_LABEL_OVERRIDE_KEY, JSON.stringify(state.seriesLabelOverrides, null, 2));
  if (!options.skipSync) {
    scheduleCloudSave("series");
  }
}

function saveConsoleMode() {
  localStorage.setItem(CONSOLE_MODE_KEY, String(state.consoleMode));
}

function saveCollection(options = {}) {
  state.collection = normalizeCollection(state.collection);
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(state.collection));
  if (!options.skipSync) {
    scheduleCloudSave("collection");
  }
}

function saveSyncConfig() {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(state.syncConfig));
}

function saveSyncMeta() {
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(state.syncMeta));
}

function refreshKits() {
  state.kits = state.rawKits.map((kit) => applyOverride(kit));
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

  return {
    ...normalized,
    names,
    series,
    images,
    gallery_image_urls: galleryImageUrls,
    grade_code: Object.hasOwn(override, "grade_code") ? override.grade_code : normalized.grade_code,
    subline: Object.hasOwn(override, "subline") ? override.subline : normalized.subline,
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

function openSettings() {
  state.activeModal = "settings";
  renderSettings();
  if (!elements.settingsDialog.open) {
    elements.settingsDialog.showModal();
  }
  persistViewState({ mode: "push" });
}

function closeSettings(options = {}) {
  if (options.navigate !== false && state.activeModal === "settings") {
    window.history.back();
    return;
  }
  if (elements.settingsDialog.open) {
    elements.settingsDialog.close();
  }
  state.activeModal = null;
  persistViewState({ mode: "replace" });
}

function bindEvents() {
  elements.settingsOpen.addEventListener("click", openSettings);
  elements.settingsClose.addEventListener("click", closeSettings);
  elements.consoleModeToggle.addEventListener("change", (event) => {
    state.consoleMode = event.target.checked;
    saveConsoleMode();
    renderConsoleMode();
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
    const nextView = button.dataset.view;
    if (nextView === "settings") {
      openSettings();
      return;
    }
    state.activeView = nextView;
    state.selectedKit = null;
    state.activeModal = null;
    localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
    persistViewState({ mode: "push" });
    render();
  });
  elements.collectionSelectAll.addEventListener("change", toggleVisibleCollectionSelection);
  elements.deleteSelectedCollection.addEventListener("click", deleteSelectedCollectionItems);
  elements.clearCollectionView.addEventListener("click", clearActiveCollectionView);
  elements.saveSyncConfig.addEventListener("click", saveAndConnectSync);
  elements.syncNow.addEventListener("click", () => pullSync({ force: true }));
  elements.disconnectSync.addEventListener("click", disconnectSync);
  elements.installApp.addEventListener("click", installPwa);
  elements.refreshAppCache.addEventListener("click", refreshAppCache);
  elements.updateNotificationToggle.addEventListener("change", toggleUpdateNotifications);
  elements.updatesOpenSettings.addEventListener("click", () => {
    openSettings();
    requestAnimationFrame(() => elements.updateLog?.scrollIntoView({ block: "start", behavior: "smooth" }));
  });
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    persistViewState();
    renderKits();
  });
  elements.seriesSelect.addEventListener("change", (event) => {
    state.series = event.target.value;
    renderSeriesControls();
    renderGradeSelect();
    renderAdvancedFilters();
    renderSeriesAdmin();
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  elements.gradeSelect.addEventListener("change", (event) => {
    state.grade = event.target.value;
    renderGradeSelect();
    renderAdvancedFilters();
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  elements.itemTypeSelect.addEventListener("change", (event) => {
    state.itemType = event.target.value;
    renderAdvancedFilters();
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  elements.releaseYearSelect.addEventListener("change", (event) => {
    state.releaseYear = event.target.value;
    renderAdvancedFilters();
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  elements.limitedSelect.addEventListener("change", (event) => {
    state.limited = event.target.value;
    renderFilterSummary();
    persistViewState({ mode: "push" });
    renderKits();
  });
  for (const input of [elements.priceMinInput, elements.priceMaxInput]) {
    input.addEventListener("change", () => {
      state.priceMin = elements.priceMinInput.value.trim();
      state.priceMax = elements.priceMaxInput.value.trim();
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
  elements.wantedQuantityMinus.addEventListener("click", () => updateSelectedWantedQuantity(wantedQuantityForKit(state.selectedKit?.kit_id) - 1));
  elements.wantedQuantityPlus.addEventListener("click", () => updateSelectedWantedQuantity(wantedQuantityForKit(state.selectedKit?.kit_id) + 1));
  elements.wantedQuantityInput.addEventListener("change", (event) => updateSelectedWantedQuantity(event.target.value));
  elements.saveCollectionDetails.addEventListener("click", saveSelectedCollectionDetails);
  elements.editToggle.addEventListener("click", () => {
    elements.correctionForm.hidden = !elements.correctionForm.hidden;
  });
  elements.saveCorrection.addEventListener("click", saveCurrentCorrection);
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
    applyViewState(loadSavedViewState());
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && syncConfigComplete()) {
      pullSync({ silent: true });
    }
  });

  populateGradeSelect();
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
  maybeShowUpdateNotification();
}

async function maybeShowUpdateNotification() {
  const entry = latestUpdateEntry();
  if (!state.updateNotifications || !entry || updateEntryTotal(entry) <= 0 || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const signature = updateNotificationSignature(entry);
  if (!signature || localStorage.getItem(UPDATE_NOTIFICATION_LAST_KEY) === signature) {
    return;
  }

  const watched = Number(entry.watched_count || 0);
  const title = watched > 0 ? t("notificationSeedTitle") : t("notificationUpdateTitle");
  const body = t("notificationUpdateBody", {
    date: entry.date,
    added: entry.added_count || 0,
    changed: entry.changed_count || 0,
  });
  const options = {
    body,
    tag: `gunpula-update-${entry.date}`,
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

function cloudPayload() {
  return {
    schema_version: 1,
    collection: normalizeCollection(state.collection),
    overrides: state.overrides,
    series_label_overrides: state.seriesLabelOverrides,
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
  };
}

async function readRemoteState() {
  const result = await supabaseRpc("gunpula_get_state", {
    p_workspace_id: state.syncConfig.workspaceId.trim(),
    p_access_hash: await syncAccessHash(),
  });
  return normalizeCloudState(result);
}

async function writeRemoteState(reason = "manual") {
  if (!syncConfigComplete() || state.sync.inFlight) {
    return;
  }
  state.sync.inFlight = true;
  setSyncStatus("saving", t("syncSaving"));
  try {
    const result = await supabaseRpc("gunpula_save_state", {
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
  if (state.sync.suppress || !syncConfigComplete()) {
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
  if (!syncConfigComplete()) {
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
  if (!syncConfigComplete()) {
    setSyncStatus("local", t("syncLocal"));
    return;
  }
  if (!options.silent) {
    setSyncStatus("connecting", t("syncConnecting"));
  }
  try {
    const remote = await readRemoteState();
    if (!remote) {
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
  state.sync.suppress = true;
  state.collection = normalizeCollection(remote.payload?.collection || {});
  state.overrides = remote.payload?.overrides && typeof remote.payload.overrides === "object" ? remote.payload.overrides : {};
  state.seriesLabelOverrides =
    remote.payload?.series_label_overrides && typeof remote.payload.series_label_overrides === "object"
      ? remote.payload.series_label_overrides
      : {};
  state.syncMeta = {
    revision: remote.revision,
    updatedAt: remote.updatedAt,
    updatedBy: remote.updatedBy,
  };
  state.sync.canEdit = remote.canEdit;
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
  return !syncConfigComplete() || state.sync.canEdit;
}

function t(key, params = {}) {
  const template = TRANSLATIONS[state.language]?.[key] ?? TRANSLATIONS.zh[key] ?? key;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), template);
}

function translateStaticText() {
  document.documentElement.lang = LANGUAGES.find((language) => language.code === state.language)?.htmlLang ?? "zh-CN";
  document.body.dataset.view = state.activeView;
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
  populateGradeSelect();
  elements.searchInput.value = state.query;
  elements.datasetSummary.textContent = datasetSummary();
  renderLanguageControls();
  renderFranchiseFilters();
  renderSeriesControls();
  renderGradeFilters();
  renderSeriesAdmin();
  renderSettings();
  renderConsoleMode();
  renderBottomNav();
  renderCollections();
  renderHomeUpdates();
  renderUpdateLog();
  renderFilterSummary();
  renderKits();
}

function renderBottomNav() {
  elements.bottomNav.querySelectorAll("button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });
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
    .replace(/【[^】]+】|\[[^\]]+\]|\([^)]*\)/g, " ")
    .replace(/\b(ver|version|clear|color|limited|special|edition|metallic|gloss|coating)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function duplicateCandidateCount() {
  const counts = new Map();
  for (const kit of state.kits) {
    const key = duplicateKeyForKit(kit);
    if (key.length > 8) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

function updateFeedEntries() {
  return Array.isArray(state.updateFeed?.entries) ? [...state.updateFeed.entries].sort((a, b) => String(b.date).localeCompare(String(a.date))) : [];
}

function updateEntryItems(entry, franchise = null) {
  const matchesFranchise = (item) => !franchise || item.franchise === franchise;
  return {
    added: (entry.added || []).filter(matchesFranchise),
    changed: (entry.changed || []).filter(matchesFranchise),
    removed: (entry.removed || []).filter(matchesFranchise),
  };
}

function updateEntryTotal(entry, franchise = null) {
  if (!franchise) {
    return Number(entry.added_count || 0) + Number(entry.changed_count || 0);
  }
  const items = updateEntryItems(entry, franchise);
  return items.added.length + items.changed.length;
}

function itemIsPremiumBandai(item) {
  const text = [
    item.is_premium_bandai,
    item.kit_id,
    item.grade_code,
    item.subline,
    ...Object.values(item.names || {}),
    ...(item.source_urls || []),
  ]
    .filter(Boolean)
    .join(" ");
  return item.is_premium_bandai === true || /p-bandai\.jp|premium\s*bandai|p-?bandai|プレミアムバンダイ|プレバン|pb\s*限定|pb限定/i.test(text);
}

function updateEntryPremiumBandaiTotal(entry, franchise = null) {
  if (!franchise && Number.isFinite(Number(entry.premium_bandai_count))) {
    return Number(entry.premium_bandai_count || 0);
  }
  const items = updateEntryItems(entry, franchise);
  const seen = new Set();
  let count = 0;
  for (const item of [...items.added, ...items.changed]) {
    if (!item?.kit_id || seen.has(item.kit_id) || !itemIsPremiumBandai(item)) {
      continue;
    }
    seen.add(item.kit_id);
    count += 1;
  }
  return count;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayDiff(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  if (!from || !to) {
    return Infinity;
  }
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function updateFeedStats(franchise = null) {
  const entries = updateFeedEntries();
  const anchorDate = localDateKey();
  const monthKey = anchorDate.slice(0, 7);
  const sumFor = (predicate) =>
    entries.filter(predicate).reduce(
      (total, entry) => {
        const items = updateEntryItems(entry, franchise);
        total.count += updateEntryTotal(entry, franchise);
        total.added += items.added.length;
        total.changed += items.changed.length;
        total.watched += [...items.added, ...items.changed].filter((item) => item.watch_tags?.length).length;
        total.premium += updateEntryPremiumBandaiTotal(entry, franchise);
        return total;
      },
      { count: 0, added: 0, changed: 0, watched: 0, premium: 0 },
    );

  return {
    latestDate: entries[0]?.date || state.updateFeed?.updated_at || state.updatedAt,
    today: sumFor((entry) => entry.date === anchorDate),
    week: sumFor((entry) => dayDiff(entry.date, anchorDate) >= 0 && dayDiff(entry.date, anchorDate) <= 6),
    month: sumFor((entry) => String(entry.date || "").startsWith(monthKey)),
  };
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

function updateEntryPreviewItems(entry, limit = 8, franchise = null) {
  const byKey = new Map();
  const items = updateEntryItems(entry, franchise);
  const watched = [...items.added, ...items.changed].filter((item) => item.watch_tags?.length);
  const premium = [...items.added, ...items.changed].filter(itemIsPremiumBandai);
  for (const item of [...watched, ...premium, ...items.added, ...items.changed]) {
    byKey.set(`${item.change_type}:${item.kit_id}`, item);
  }
  return [...byKey.values()].slice(0, limit);
}

function recentUpdateItems(limit = 6, franchise = null) {
  const seen = new Set();
  const items = [];
  for (const entry of updateFeedEntries()) {
    for (const item of updateEntryPreviewItems(entry, 16, franchise)) {
      if (!item?.kit_id || seen.has(item.kit_id)) {
        continue;
      }
      seen.add(item.kit_id);
      items.push({ ...item, date: entry.date });
      if (items.length >= limit) {
        return items;
      }
    }
  }
  return items;
}

function renderUpdateSummaryCards(container, cards) {
  container.innerHTML = "";
  for (const cardInfo of cards) {
    const card = document.createElement("div");
    card.className = "update-summary-card";
    card.innerHTML = `<strong>${escapeHtml(cardInfo.label)}</strong><span>${cardInfo.value}</span><em>${escapeHtml(cardInfo.meta)}</em>`;
    container.append(card);
  }
}

function renderHomeUpdates() {
  if (!elements.updatesSection) {
    return;
  }

  const entries = updateFeedEntries();
  elements.updatesSection.hidden = state.activeView !== "catalog" || !entries.length;
  if (elements.updatesSection.hidden) {
    return;
  }

  const visibleEntries = entries.filter((entry) => updateEntryTotal(entry, state.franchise) > 0);
  const latest = visibleEntries[0] || entries[0];
  const stats = updateFeedStats(state.franchise);
  const latestItems = updateEntryItems(latest, state.franchise);
  elements.updatesSubtitle.textContent = `${t("latestUpdate", { date: visibleEntries[0]?.date || stats.latestDate || latest.date })} · ${t("updateAdded", { count: latestItems.added.length })} · ${t("updateChanged", { count: latestItems.changed.length })}`;
  renderUpdateSummaryCards(elements.homeUpdateSummary, [
    { label: t("updateToday"), value: stats.today.count, meta: `${t("premiumBandai")} ${stats.today.premium} · ${t("watchedUpdates")} ${stats.today.watched}` },
    { label: t("updateWeek"), value: stats.week.count, meta: `${t("premiumBandai")} ${stats.week.premium} · ${t("watchedUpdates")} ${stats.week.watched}` },
    { label: t("updateMonth"), value: stats.month.count, meta: `${t("premiumBandai")} ${stats.month.premium} · ${t("watchedUpdates")} ${stats.month.watched}` },
    { label: t("premiumBandai"), value: stats.month.premium, meta: t("updateMonth") },
  ]);

  elements.homeUpdateList.innerHTML = "";
  const items = recentUpdateItems(6, state.franchise);
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("updateRecentEmpty");
    elements.homeUpdateList.append(empty);
    return;
  }

  for (const item of items) {
    const kit = displayKitById(item.kit_id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "home-update-card";
    card.disabled = !kit;
    const art = document.createElement("div");
    art.className = "home-update-art";
    if (kit) {
      appendImageWithFallback(art, kit, {
        alt: t("boxArtAlt", { name: kitDisplayName(kit) }),
        onExhausted: () => showPlaceholder(art, item.grade_code || "?"),
      });
    } else {
      showPlaceholder(art, item.grade_code || "?");
    }

    const body = document.createElement("div");
    body.className = "home-update-body";
    const badges = document.createElement("div");
    badges.className = "home-update-badges";
    for (const label of [updateChangeLabel(item.change_type), itemIsPremiumBandai(item) ? t("premiumBandai") : null, ...(item.watch_tags || [])].filter(Boolean)) {
      const badge = document.createElement("span");
      badge.textContent = label;
      if (label === t("premiumBandai")) badge.className = "is-premium";
      badges.append(badge);
    }
    const title = document.createElement("strong");
    title.textContent = kit ? kitShortName(kit) : updateItemName(item);
    const meta = document.createElement("span");
    meta.textContent = [item.date, kit ? kitSeries(kit) : [updateItemSeriesLabel(item), item.grade_code].filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
    body.append(badges, title, meta);

    card.append(art, body);
    card.addEventListener("click", () => {
      if (kit) {
        openDetail(kit);
      }
    });
    elements.homeUpdateList.append(card);
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
  return FRANCHISE_LABELS[franchise]?.[state.language] ?? FRANCHISE_LABELS[franchise]?.en ?? franchise;
}

function franchiseShortLabel(franchise) {
  return FRANCHISE_SHORT_LABELS[franchise]?.[state.language] ?? FRANCHISE_SHORT_LABELS[franchise]?.en ?? franchiseLabel(franchise);
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

function itemTypeKeyForKit(kit) {
  const category = gradeByCode().get(kit.grade_code)?.category || "other";
  if (MODEL_GRADE_CATEGORIES.has(category)) {
    return "plastic_model";
  }
  return ITEM_TYPE_LABELS[category] ? category : "other";
}

function itemTypeLabel(key) {
  return ITEM_TYPE_LABELS[key]?.[state.language] ?? ITEM_TYPE_LABELS[key]?.en ?? key;
}

function imageCandidatesForKit(kit) {
  const overrideCover = kit.local_override?.cover_image_url || kit.local_override?.image_url;
  return [...new Set([overrideCover, kit.images?.box_art_url, ...(kit.gallery_image_urls || [])].filter(Boolean))];
}

function appendImageWithFallback(container, kit, options = {}) {
  const urls = imageCandidatesForKit(kit);
  if (!urls.length) {
    options.onExhausted?.();
    return false;
  }

  const img = document.createElement("img");
  img.alt = options.alt || "";
  img.loading = options.loading || "lazy";
  let index = 0;
  const tryNext = () => {
    if (index >= urls.length) {
      img.remove();
      options.onExhausted?.();
      return;
    }
    img.src = urls[index];
    index += 1;
  };
  img.addEventListener("error", tryNext);
  container.append(img);
  tryNext();
  return true;
}

function releaseYearForKit(kit) {
  return /^\d{4}/.exec(String(kit.release_date || ""))?.[0] ?? null;
}

function numericFilterValue(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return null;
  }
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function collectionEntry(kitId) {
  state.collection = normalizeCollection(state.collection);
  return kitId ? state.collection.items?.[kitId] || null : null;
}

function collectionQuantityForKit(kitId) {
  return clampCollectionQuantity(collectionEntry(kitId)?.quantity ?? 1);
}

function wantedBudgetForKits(kits) {
  return kits.reduce((total, kit) => total + (kit.price_jpy || 0) * wantedQuantityForKit(kit.kit_id), 0);
}

function kitSeriesKey(kit) {
  return kit.series?.key || "other";
}

function kitSeriesSort(kit) {
  return Number.isFinite(kit.series?.sort) ? kit.series.sort : 999;
}

function baseSeriesLabel(series, language = state.language) {
  return series?.labels?.[language] ?? series?.labels?.zh ?? series?.labels?.en ?? series?.key ?? t("pending");
}

function seriesLabelFromSeries(series, language = state.language) {
  const key = series?.key;
  return (key && state.seriesLabelOverrides[key]?.[language]) || baseSeriesLabel(series, language);
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
  const minPrice = numericFilterValue(state.priceMin);
  const maxPrice = numericFilterValue(state.priceMax);
  const source =
    state.activeView === "owned"
      ? collectionIds("owned").map(displayKitById).filter(Boolean)
      : state.activeView === "wanted"
        ? collectionIds("wanted").map(displayKitById).filter(Boolean)
        : kitsForCurrentFranchise();
  return source.filter((kit) => {
    if (state.activeView === "catalog" && state.grade !== "all" && kit.grade_code !== state.grade) {
      return false;
    }
    if (state.activeView === "catalog" && state.series !== "all" && kitSeriesKey(kit) !== state.series) {
      return false;
    }
    if (state.activeView === "catalog" && state.itemType !== "all" && itemTypeKeyForKit(kit) !== state.itemType) {
      return false;
    }
    if (state.activeView === "catalog" && state.releaseYear !== "all" && releaseYearForKit(kit) !== state.releaseYear) {
      return false;
    }
    if (state.activeView === "catalog" && state.limited !== "all") {
      const limited = Boolean(kit.is_limited);
      if ((state.limited === "limited" && !limited) || (state.limited === "regular" && limited)) {
        return false;
      }
    }
    if (state.activeView === "catalog" && minPrice !== null && (kit.price_jpy || 0) < minPrice) {
      return false;
    }
    if (state.activeView === "catalog" && maxPrice !== null && (kit.price_jpy || 0) > maxPrice) {
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
  const nextItems = { ...(state.collection.items || {}) };
  for (const kitId of deleteSet) {
    if (nextItems[kitId]?.status === type) {
      delete nextItems[kitId];
    }
    collectionSelection(type).delete(kitId);
  }
  state.collection.items = nextItems;
  state.collection[type] = (Array.isArray(state.collection[type]) ? state.collection[type] : []).filter((kitId) => !deleteSet.has(kitId));

  saveCollection();
  renderCollections();
  renderKits();
  if (state.selectedKit && elements.detailDialog.open) {
    renderDetailStatusActions(state.selectedKit);
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
  if (!type) {
    return;
  }

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

function collectionIds(type) {
  state.collection = normalizeCollection(state.collection);
  return state.collection[type] || [];
}

function wantedQuantityForKit(kitId) {
  if (!kitId) {
    return 1;
  }
  state.collection = normalizeCollection(state.collection);
  return clampCollectionQuantity(state.collection.items?.[kitId]?.quantity ?? 1);
}

function kitInCollection(kitId, type) {
  return collectionIds(type).includes(kitId);
}

function updateSelectedWantedQuantity(value) {
  const kit = state.selectedKit;
  if (!kit || !kitInCollection(kit.kit_id, "wanted")) {
    return;
  }
  if (!canEditSharedData()) {
    setSyncStatus("readonly", t("readOnlyHint"));
    return;
  }

  const current = state.collection.items?.[kit.kit_id] || {};
  state.collection.items = {
    ...(state.collection.items || {}),
    [kit.kit_id]: {
      ...current,
      status: "wanted",
      quantity: clampCollectionQuantity(value),
      updated_at: new Date().toISOString(),
      updated_by: memberName(),
    },
  };

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
  const current = collectionEntry(kit.kit_id);
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
    updated_by: memberName(),
  };
  if (purchasePrice === null) {
    delete nextEntry.purchase_price;
  } else {
    nextEntry.purchase_price = Math.round(purchasePrice);
  }
  if (!nextEntry.note) delete nextEntry.note;
  if (!nextEntry.storage) delete nextEntry.storage;

  state.collection.items = {
    ...(state.collection.items || {}),
    [kit.kit_id]: nextEntry,
  };
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

  if (kitInCollection(kit.kit_id, type)) {
    state.collection.items = {
      ...(state.collection.items || {}),
      [kit.kit_id]: { status: null, updated_at: new Date().toISOString(), updated_by: memberName() },
    };
  } else {
    const nextEntry = {
      status: type,
      quantity: collectionQuantityForKit(kit.kit_id),
      updated_at: new Date().toISOString(),
      updated_by: memberName(),
    };
    state.collection.items = {
      ...(state.collection.items || {}),
      [kit.kit_id]: nextEntry,
    };
  }

  saveCollection();
  renderCollections();
  renderKits();
  renderDetailStatusActions(kit);
}

function renderCollections() {
  const ownedLength = renderCollectionStrip("owned", elements.ownedStrip, elements.ownedCount, elements.ownedPanel, elements.ownedCollapse);
  const wantedLength = renderCollectionStrip("wanted", elements.wantedStrip, elements.wantedCount, elements.wantedPanel, elements.wantedCollapse);
  const ownedVisible = state.homeCollectionVisibility.owned && ownedLength > 0;
  const wantedVisible = state.homeCollectionVisibility.wanted && wantedLength > 0;
  elements.ownedPanel.hidden = !ownedVisible;
  elements.wantedPanel.hidden = !wantedVisible;
  const visibleCount = [ownedVisible, wantedVisible].filter(Boolean).length;
  elements.collectionSection.classList.toggle("is-single", visibleCount === 1);
  elements.collectionSection.hidden = visibleCount === 0 || state.activeView !== "catalog";
}

function renderCollectionStrip(type, strip, countNode, panel, collapseButton) {
  const ids = collectionIds(type).filter((kitId) => displayKitById(kitId));
  state.collection[type] = ids;
  const count = ids.reduce((total, kitId) => total + collectionQuantityForKit(kitId), 0);
  const collapsed = state.homeCollectionCollapsed[type];
  const label = t(type === "owned" ? "ownedList" : "wantedList");
  countNode.textContent = String(count);
  panel.hidden = ids.length === 0;
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

    const quantity = collectionQuantityForKit(kitId);
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
  const owned = kitInCollection(kit.kit_id, "owned");
  const wanted = kitInCollection(kit.kit_id, "wanted");
  const editable = canEditSharedData();
  elements.toggleOwned.classList.toggle("is-active", owned);
  elements.toggleWanted.classList.toggle("is-active", wanted);
  elements.toggleOwned.disabled = !editable;
  elements.toggleWanted.disabled = !editable;
  elements.toggleOwned.textContent = owned ? t("unmarkOwned") : t("markOwned");
  elements.toggleWanted.textContent = wanted ? t("unmarkWanted") : t("markWanted");
  elements.wantedQuantityControl.hidden = !wanted;
  elements.wantedQuantityInput.value = String(wantedQuantityForKit(kit.kit_id));
  elements.wantedQuantityInput.disabled = !editable;
  elements.wantedQuantityMinus.disabled = !editable || wantedQuantityForKit(kit.kit_id) <= 1;
  elements.wantedQuantityPlus.disabled = !editable || wantedQuantityForKit(kit.kit_id) >= 99;
  const entry = collectionEntry(kit.kit_id);
  const hasCollectionEntry = owned || wanted;
  elements.collectionDetailPanel.hidden = !hasCollectionEntry;
  elements.collectionQuantityInput.value = String(collectionQuantityForKit(kit.kit_id));
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

function renderSettings() {
  elements.consoleModeToggle.checked = state.consoleMode;
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
  elements.syncNow.disabled = !syncConfigComplete();
  elements.disconnectSync.disabled = !syncConfigComplete();
  renderUpdateNotificationStatus();
  renderSyncStatus();
  renderImageHealth();
}

function renderSyncStatus() {
  const labelByStatus = {
    local: t("syncLocal"),
    connecting: t("syncConnecting"),
    connected: t("syncConnected"),
    readonly: t("syncReadOnly"),
    saving: t("syncSaving"),
    error: t("syncError"),
  };
  elements.syncState.dataset.status = state.sync.status;
  elements.syncStatusText.textContent = state.sync.message || labelByStatus[state.sync.status] || t("syncLocal");
  const syncConfigured = syncConfigComplete();
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
  elements.seriesAdminPanel.hidden = !state.consoleMode;
  elements.correctionPanel.hidden = !state.consoleMode;
  const editable = canEditSharedData();
  elements.editToggle.disabled = !editable;
  elements.saveCorrection.disabled = !editable;
  elements.clearCorrection.disabled = !editable;
  elements.saveSeriesLabel.disabled = !editable;
  elements.clearSeriesLabel.disabled = !editable;
  elements.seriesAdminLabel.disabled = !editable;
  elements.seriesAdminSeries.disabled = !editable;
  elements.seriesAdminLanguage.disabled = !editable;
  if (!state.consoleMode) {
    elements.correctionForm.hidden = true;
  }
  if (state.consoleMode) {
    renderSeriesAdmin();
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
    button.textContent = `${franchiseShortLabel(franchise)} ${counts.get(franchise) || 0}`;
    button.addEventListener("click", () => {
      state.franchise = franchise;
      state.grade = "all";
      state.series = "all";
      state.itemType = "all";
      state.releaseYear = "all";
      state.limited = "all";
      state.priceMin = "";
      state.priceMax = "";
      state.selectedKit = null;
      localStorage.setItem(FRANCHISE_KEY, state.franchise);
      render();
      persistViewState({ mode: "push" });
    });
    elements.franchiseList.append(button);
  }
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

function renderSeriesControls() {
  const kits = kitsForCurrentFranchise();
  const counts = seriesCountsForCurrentFranchise();
  if (state.series !== "all" && !counts.has(state.series)) {
    state.series = "all";
  }

  const seriesEntries = [...counts.entries()];

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
  const preferredKey = state.series !== "all" ? state.series : entries[0]?.[0];
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

function renderAdvancedFilters() {
  const kits = kitsForCurrentFranchise().filter((kit) => {
    if (state.series !== "all" && kitSeriesKey(kit) !== state.series) return false;
    if (state.grade !== "all" && kit.grade_code !== state.grade) return false;
    return true;
  });

  const typeCounts = new Map();
  const yearCounts = new Map();
  for (const kit of kits) {
    const type = itemTypeKeyForKit(kit);
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    const year = releaseYearForKit(kit);
    if (year) {
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
  }

  if (state.itemType !== "all" && !typeCounts.has(state.itemType)) {
    state.itemType = "all";
  }
  if (state.releaseYear !== "all" && !yearCounts.has(state.releaseYear)) {
    state.releaseYear = "all";
  }

  elements.itemTypeSelect.innerHTML = "";
  elements.itemTypeSelect.append(makeOption("all", `${t("allTypes")} (${kits.length})`));
  for (const [key, count] of [...typeCounts.entries()].sort((a, b) => itemTypeLabel(a[0]).localeCompare(itemTypeLabel(b[0]), state.language))) {
    elements.itemTypeSelect.append(makeOption(key, `${itemTypeLabel(key)} (${count})`));
  }
  elements.itemTypeSelect.value = state.itemType;

  elements.releaseYearSelect.innerHTML = "";
  elements.releaseYearSelect.append(makeOption("all", `${t("allYears")} (${kits.length})`));
  for (const [year, count] of [...yearCounts.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    elements.releaseYearSelect.append(makeOption(year, `${year} (${count})`));
  }
  elements.releaseYearSelect.value = state.releaseYear;

  elements.limitedSelect.innerHTML = "";
  elements.limitedSelect.append(makeOption("all", t("limitedAll")));
  elements.limitedSelect.append(makeOption("limited", t("limitedOnly")));
  elements.limitedSelect.append(makeOption("regular", t("regularOnly")));
  elements.limitedSelect.value = state.limited;
  elements.priceMinInput.value = state.priceMin;
  elements.priceMaxInput.value = state.priceMax;
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
  const gradeLabelText =
    state.grade === "all"
      ? t("allProductLines")
      : gradeLabel(gradeMap.get(state.grade)) || state.grade;
  const seriesLabel = seriesLabelFromKey(state.series);
  const extra = [
    state.itemType !== "all" ? itemTypeLabel(state.itemType) : null,
    state.releaseYear !== "all" ? state.releaseYear : null,
    state.limited !== "all" ? t(state.limited === "limited" ? "limitedOnly" : "regularOnly") : null,
    state.priceMin ? `>=${formatPrice(Number(state.priceMin))}` : null,
    state.priceMax ? `<=${formatPrice(Number(state.priceMax))}` : null,
  ].filter(Boolean);
  elements.filterSummary.textContent = [franchiseLabel(state.franchise), seriesLabel, gradeLabelText, ...extra].join(" · ");
}

function renderKits() {
  const kits = filteredKits();
  const collectionType = activeCollectionType();
  const titleKey = state.activeView === "owned" ? "ownedList" : state.activeView === "wanted" ? "wantedList" : "catalogList";
  elements.sectionTitle.textContent = t(titleKey);
  elements.resultCount.textContent =
    state.activeView === "wanted"
      ? `${t("results", { count: kits.length })} · ${t("shoppingTotal", { total: formatPrice(wantedBudgetForKits(kits)) })}`
      : t("results", { count: kits.length });
  renderCollectionManagement(kits);
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
    for (const label of [seriesLabelFromKit(kit), gradeShortLabel(kit)]) {
      const badge = document.createElement("span");
      badge.textContent = label;
      badges.append(badge);
    }
    const collectionLabel = kitInCollection(kit.kit_id, "owned")
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
  state.activeModal = null;
  state.selectedImageIndex = 0;

  renderDetail(kit);
  elements.detailDialog.showModal();
  persistViewState({ mode: "push" });
}

function renderDetail(kit) {
  elements.detailKicker.textContent = `${seriesLabelFromKit(kit)} · ${gradeShortLabel(kit)}${kit.scale ? ` · ${kit.scale}` : ""}`;
  elements.detailTitle.textContent = kitShortName(kit);
  elements.detailSubtitle.textContent = [kit.release_date, formatPrice(kit.price_jpy)].filter((value) => value && value !== t("pending")).join(" · ");
  renderDetailStatusActions(kit);
  renderDetailMeta(kit);
  renderDetailGallery(kit);
  fillCorrectionForm(kit);
  renderConsoleMode();

  const officialUrl = kit.source_urls?.[0];
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
  if (elements.detailDialog.open) {
    elements.detailDialog.close();
  }
  state.selectedKit = null;
  persistViewState({ mode: "replace" });
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
