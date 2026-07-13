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
const UPDATE_NOTIFICATION_KEY = "gunpula-catalog-update-notifications-v1";
const UPDATE_NOTIFICATION_LAST_KEY = "gunpula-catalog-update-notified-v1";
const UPDATE_NOTIFICATION_FILTER_KEY = "gunpula-catalog-update-notification-filters-v1";
const THEME_KEY = "gunpula-catalog-theme-v1";
const APP_ICON_KEY = "gunpula-catalog-app-icon-v1";
const HOME_COVER_KEY = "gunpula-catalog-home-covers-v1";
const RELEASE_MONTH_KEY = "gunpula-catalog-release-month-v1";
const SETTINGS_PANEL_KEY = "gunpula-catalog-settings-panel-v1";
const RECENT_VIEWED_KEY = "gunpula-catalog-recent-viewed-v1";
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
const PAGER_THRESHOLD_RATIO = 0.28;
const PAGER_MIN_THRESHOLD = 92;
const PAGER_ANIMATION_MS = 220;
const APP_VERSION_LABEL = "v2.0.0";

const COLLECTION_TYPES = ["owned", "wanted"];
const COLLECTION_ENTRY_STATUSES = [...COLLECTION_TYPES, "deleted"];
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

const LANGUAGES = [
  { code: "zh", label: "中", htmlLang: "zh-CN" },
  { code: "ko", label: "한", htmlLang: "ko-KR" },
  { code: "en", label: "EN", htmlLang: "en" },
  { code: "ja", label: "日", htmlLang: "ja" },
];

const FRANCHISES = ["gundam", "armored_core", "pokemon", "fate", "beyblade"];
const SETTINGS_PANELS = ["account", "appearance", "data", "updates", "about", "console"];

const FRANCHISE_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "ガンダム" },
  armored_core: { zh: "Armored Core", ko: "아머드 코어", en: "Armored Core", ja: "アーマード・コア" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  fate: { zh: "Fate", ko: "Fate", en: "Fate", ja: "Fate" },
  beyblade: { zh: "Beyblade X", ko: "베이블레이드 X", en: "Beyblade X", ja: "ベイブレードX" },
};

const FRANCHISE_SHORT_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "Gundam" },
  armored_core: { zh: "AC", ko: "AC", en: "AC", ja: "AC" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  fate: { zh: "Fate", ko: "Fate", en: "Fate", ja: "Fate" },
  beyblade: { zh: "BBX", ko: "BBX", en: "BBX", ja: "BBX" },
};

const NAME_FALLBACKS = {
  zh: ["zh", "ja", "en", "ko"],
  ko: ["ko", "ja", "en", "zh"],
  en: ["en", "ja", "zh", "ko"],
  ja: ["ja", "en", "zh", "ko"],
};

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff]/;
const DISPLAY_NAME_REPLACEMENTS = {
  zh: [
    ["機動戦士ガンダム", "机动战士高达"],
    ["新機動戦記ガンダムW", "新机动战记高达W"],
    ["鉄血のオルフェンズ", "铁血的奥尔芬斯"],
    ["水星の魔女", "水星的魔女"],
    ["逆襲のシャア", "逆袭的夏亚"],
    ["閃光のハサウェイ", "闪光的哈萨维"],
    ["ポケットの中の戦争", "口袋里的战争"],
    ["マイティーストライクフリーダム", "强袭自由高达二式"],
    ["ストライクフリーダム", "强袭自由"],
    ["ライジングフリーダム", "升扬自由"],
    ["イモータルジャスティス", "不朽正义"],
    ["インフィニットジャスティス", "无限正义"],
    ["プロヴィデンス", "神意"],
    ["デスティニー", "命运"],
    ["インパルス", "脉冲"],
    ["フリーダム", "自由"],
    ["ジャスティス", "正义"],
    ["ストライク", "强袭"],
    ["イージス", "圣盾"],
    ["デュエル", "决斗"],
    ["バスター", "暴风"],
    ["ブリッツ", "迅雷"],
    ["アストレイ", "异端"],
    ["アカツキ", "晓"],
    ["ランチャーストライカー", "炮战强袭背包"],
    ["ソードストライカー", "剑战强袭背包"],
    ["ウイング", "飞翼"],
    ["デスサイズ", "死神"],
    ["ヘビーアームズ", "重武装"],
    ["サンドロック", "沙漠"],
    ["シェンロン", "神龙"],
    ["トールギス", "托鲁基斯"],
    ["エピオン", "艾比安"],
    ["エクシア", "能天使"],
    ["デュナメス", "力天使"],
    ["キュリオス", "主天使"],
    ["ヴァーチェ", "德天使"],
    ["ナドレ", "娜德雷"],
    ["アストレア", "正义女神"],
    ["ケルディム", "智天使"],
    ["アリオス", "堕天使"],
    ["セラヴィー", "炽天使"],
    ["クアンタ", "量子型"],
    ["バルバトス", "巴巴托斯"],
    ["グシオン", "古辛"],
    ["キマリス", "锡蒙力"],
    ["グレイズ", "格雷兹"],
    ["バエル", "巴耶力"],
    ["ヴィダール", "维达尔"],
    ["マルコシアス", "马可西亚斯"],
    ["ユニコーン", "独角兽"],
    ["バンシィ", "报丧女妖"],
    ["フェネクス", "凤凰"],
    ["シナンジュ", "新安洲"],
    ["クシャトリヤ", "刹帝利"],
    ["サザビー", "沙扎比"],
    ["ナイチンゲール", "夜莺"],
    ["ケンプファー", "京宝梵"],
    ["キュベレイ", "卡碧尼"],
    ["ガンダムMk-II", "高达 Mk-II"],
    ["グレート・ジオング", "大吉翁号"],
    ["ジオング", "吉翁号"],
    ["ハイパー・メガ・バズーカ・ランチャー", "超级米加火箭炮发射器"],
    ["Gディフェンサー", "G防卫者"],
    ["メッサーラ", "梅萨拉"],
    ["ハンブラビ", "汉布拉比"],
    ["メッサー", "梅萨"],
    ["キケロガ", "奇克罗加"],
    ["シャリア・ブル", "夏利亚·布尔"],
    ["アリュゼウス", "阿琉泽乌斯"],
    ["グスタフ・カール", "古斯塔夫·卡尔"],
    ["百式", "百式"],
    ["ゼータ", "Zeta"],
    ["ダブルゼータ", "ZZ"],
    ["ブルーディスティニー", "苍蓝命运"],
    ["クロスボーン", "海盗"],
    ["GUNDAM", "高达"],
    ["Gundam", "高达"],
    ["ガンダム", "高达"],
    ["ザク", "扎古"],
    ["グフ", "老虎"],
    ["ドム", "大魔"],
    ["ゲルググ", "勇士"],
    ["ジム", "吉姆"],
    ["ボール", "铁球"],
    ["シャア専用", "夏亚专用"],
    ["量産型", "量产型"],
    ["高機動型", "高机动型"],
    ["専用", "专用"],
    ["抽選販売", "抽选贩售"],
    ["プレミアムバンダイ", "Premium Bandai"],
    ["発売分", "发售批次"],
    ["発送分", "发货批次"],
    ["オプションパーツセット", "选配零件套装"],
    ["オプションセット", "选配套装"],
    ["拡張セット", "扩展套装"],
    ["武器セット", "武器套装"],
    ["武装セット", "武装套装"],
    ["パーツセット", "零件套装"],
    ["台座セット", "底座套装"],
    ["スタンドセット", "支架套装"],
    ["セット", "套装"],
    ["限定", "限定"],
    ["仕様", "规格"],
    ["重塗装", "重涂装"],
    ["塗装", "涂装"],
    ["クリアカラー", "透明色"],
    ["リアルタイプ", "真实比例"],
    ["アニメカラー", "动画配色"],
    ["ハードポイント", "硬点"],
    ["装備", "装备"],
    ["発動", "发动"],
    ["再販", "再贩"],
    ["リバイバル版", "复刻版"],
    ["最終決戦", "最终决战"],
    ["ポケットモンスター", "宝可梦"],
    ["ポケモン", "宝可梦"],
    ["ガシャポン", "扭蛋"],
    ["カプキャラ", "胶囊角色"],
    ["つまんでつなげてますこっと", "串联挂件"],
    ["はさむんです", "夹夹饰"],
    ["スイング", "吊饰"],
    ["ラバーマスコット", "橡胶挂件"],
    ["フィギュア", "手办"],
    ["イーブイフレンズ", "伊布朋友"],
    ["サン＆ムーン", "太阳&月亮"],
    ["クレスト", "克雷斯特"],
    ["レイレナード", "雷雷纳德"],
    ["ミラージュ", "幻影"],
    ["ラインアーク", "Line Ark"],
    ["ホワイト・グリント", "白色闪光"],
    ["スティールヘイズ", "钢铁迷雾"],
    ["ロックスミス", "锁匠"],
    ["オープンフェイス", "开脸"],
    ["ミルクトゥース", "乳牙"],
    ["ライガーテイル", "虎尾"],
    ["ナイトフォール", "夜幕"],
    ["ハングドマン", "倒吊人"],
    ["ヴェンジェンス", "复仇"],
    ["オラクル", "神谕"],
    ["サンシャイン", "阳光"],
    ["フィードバック", "反馈"],
    ["近接突撃型", "近接突击型"],
    ["強襲型", "强袭型"],
    ["軽量級", "轻量级"],
    ["再戦", "再战"],
    ["コトブキヤショップ限定品", "寿屋店铺限定"],
    ["ランダムブースター", "随机补充包"],
    ["ストリングランチャー", "拉绳发射器"],
    ["メタルコート", "金属涂层"],
    ["アプリ・イベント限定", "App/活动限定"],
    ["タカラトミーモール", "Takara Tomy Mall"],
    ["ストームペガシス", "风暴天马"],
    ["グローリーワルキューレ", "荣耀女武神"],
    ["サムライセイバー", "武士军刀"],
    ["ドランブレイブ", "勇气龙"],
    ["ドレイクブレイブ", "勇气飞龙"],
    ["ホーネットフォート", "黄蜂堡垒"],
    ["クラーケンリグル", "海妖咆哮"],
    ["ブラック", "黑"],
    ["グリーン", "绿"],
    ["ブルー", "蓝"],
    ["オレンジ", "橙"],
    ["イエロー", "黄"],
    ["Nendoroid", "黏土人"],
    ["POP UP PARADE", "POP UP PARADE"],
    ["Saber", "剑阶"],
    ["Lancer", "枪阶"],
    ["Archer", "弓阶"],
    ["Rider", "骑阶"],
    ["Caster", "术阶"],
    ["Assassin", "杀阶"],
    ["Berserker", "狂阶"],
    ["Ruler", "尺阶"],
    ["Avenger", "仇阶"],
    ["Foreigner", "降临者"],
    ["Altria", "阿尔托莉雅"],
    ["Artoria", "阿尔托莉雅"],
    ["Jeanne d'Arc", "贞德"],
    ["Morgan", "摩根"],
    ["Scáthach", "斯卡哈"],
    ["Skadi", "斯卡蒂"],
    ["Mélusine", "妖兰"],
    ["Koyanskaya of Light", "光之高扬斯卡娅"],
    ["Minamoto-no-Raikou", "源赖光"],
    ["Katsushika Hokusai", "葛饰北斋"],
    ["Mysterious Alter Ego Λ", "谜之Alter Ego Λ"],
    ["Final Ascension", "最终再临"],
    ["Travel Portrait", "旅行肖像"],
    ["Bunny Ver.", "兔女郎Ver."],
    ["Ver.", "Ver."],
    ["・", "·"],
    ["（", "("],
    ["）", ")"],
  ],
  ko: [
    ["機動戦士ガンダム", "기동전사 건담"],
    ["新機動戦記ガンダムW", "신기동전기 건담W"],
    ["鉄血のオルフェンズ", "철혈의 오펀스"],
    ["水星の魔女", "수성의 마녀"],
    ["逆襲のシャア", "역습의 샤아"],
    ["閃光のハサウェイ", "섬광의 하사웨이"],
    ["ポケットの中の戦争", "주머니 속의 전쟁"],
    ["マイティーストライクフリーダム", "마이티 스트라이크 프리덤"],
    ["ストライクフリーダム", "스트라이크 프리덤"],
    ["ライジングフリーダム", "라이징 프리덤"],
    ["イモータルジャスティス", "이모탈 저스티스"],
    ["インフィニットジャスティス", "인피니트 저스티스"],
    ["プロヴィデンス", "프로비던스"],
    ["デスティニー", "데스티니"],
    ["インパルス", "임펄스"],
    ["フリーダム", "프리덤"],
    ["ジャスティス", "저스티스"],
    ["ストライク", "스트라이크"],
    ["イージス", "이지스"],
    ["デュエル", "듀얼"],
    ["バスター", "버스터"],
    ["ブリッツ", "블리츠"],
    ["アストレイ", "아스트레이"],
    ["アカツキ", "아카츠키"],
    ["ランチャーストライカー", "런처 스트라이커"],
    ["ソードストライカー", "소드 스트라이커"],
    ["ウイング", "윙"],
    ["デスサイズ", "데스사이즈"],
    ["ヘビーアームズ", "헤비암즈"],
    ["サンドロック", "샌드록"],
    ["シェンロン", "셴롱"],
    ["トールギス", "톨기스"],
    ["エピオン", "에피온"],
    ["エクシア", "엑시아"],
    ["デュナメス", "듀나메스"],
    ["キュリオス", "큐리오스"],
    ["ヴァーチェ", "버체"],
    ["ナドレ", "나드레"],
    ["アストレア", "아스트레아"],
    ["ケルディム", "켈딤"],
    ["アリオス", "아리오스"],
    ["セラヴィー", "세라비"],
    ["クアンタ", "퀀터"],
    ["バルバトス", "발바토스"],
    ["グシオン", "구시온"],
    ["キマリス", "키마리스"],
    ["グレイズ", "그레이즈"],
    ["バエル", "바알"],
    ["ヴィダール", "비다르"],
    ["マルコシアス", "마르코시아스"],
    ["ユニコーン", "유니콘"],
    ["バンシィ", "밴시"],
    ["フェネクス", "페넥스"],
    ["シナンジュ", "시난주"],
    ["クシャトリヤ", "크샤트리아"],
    ["サザビー", "사자비"],
    ["ナイチンゲール", "나이팅게일"],
    ["ケンプファー", "캠퍼"],
    ["キュベレイ", "큐베레이"],
    ["ガンダムMk-II", "건담 Mk-II"],
    ["グレート・ジオング", "그레이트 지옹"],
    ["ジオング", "지옹"],
    ["ハイパー・メガ・バズーカ・ランチャー", "하이퍼 메가 바주카 런처"],
    ["Gディフェンサー", "G 디펜서"],
    ["メッサーラ", "멧사라"],
    ["ハンブラビ", "함브라비"],
    ["メッサー", "멧사"],
    ["キケロガ", "키케로가"],
    ["シャリア・ブル", "샤리아 불"],
    ["アリュゼウス", "아류제우스"],
    ["グスタフ・カール", "구스타프 칼"],
    ["百式", "백식"],
    ["ゼータ", "제타"],
    ["ダブルゼータ", "더블 제타"],
    ["ブルーディスティニー", "블루 데스티니"],
    ["クロスボーン", "크로스본"],
    ["GUNDAM", "건담"],
    ["Gundam", "건담"],
    ["ガンダム", "건담"],
    ["ザク", "자쿠"],
    ["グフ", "구프"],
    ["ドム", "돔"],
    ["ゲルググ", "겔구그"],
    ["ジム", "짐"],
    ["ボール", "볼"],
    ["シャア専用", "샤아 전용"],
    ["量産型", "양산형"],
    ["高機動型", "고기동형"],
    ["専用", "전용"],
    ["抽選販売", "추첨 판매"],
    ["プレミアムバンダイ", "프리미엄 반다이"],
    ["発売分", "발매분"],
    ["発送分", "배송분"],
    ["オプションパーツセット", "옵션 파츠 세트"],
    ["オプションセット", "옵션 세트"],
    ["拡張セット", "확장 세트"],
    ["武器セット", "무기 세트"],
    ["武装セット", "무장 세트"],
    ["パーツセット", "파츠 세트"],
    ["台座セット", "베이스 세트"],
    ["スタンドセット", "스탠드 세트"],
    ["セット", "세트"],
    ["限定", "한정"],
    ["仕様", "사양"],
    ["重塗装", "중도장"],
    ["塗装", "도장"],
    ["クリアカラー", "클리어 컬러"],
    ["リアルタイプ", "리얼 타입"],
    ["アニメカラー", "애니메 컬러"],
    ["ハードポイント", "하드 포인트"],
    ["装備", "장비"],
    ["発動", "발동"],
    ["再販", "재판"],
    ["リバイバル版", "리바이벌판"],
    ["最終決戦", "최종 결전"],
    ["ポケットモンスター", "포켓몬스터"],
    ["ポケモン", "포켓몬"],
    ["ガシャポン", "가샤폰"],
    ["カプキャラ", "캡캐라"],
    ["つまんでつなげてますこっと", "집어서 연결 마스코트"],
    ["はさむんです", "끼우는 마스코트"],
    ["スイング", "스윙"],
    ["ラバーマスコット", "러버 마스코트"],
    ["フィギュア", "피규어"],
    ["イーブイフレンズ", "이브이 프렌즈"],
    ["サン＆ムーン", "썬&문"],
    ["クレスト", "크레스트"],
    ["レイレナード", "레이레너드"],
    ["ミラージュ", "미라주"],
    ["ラインアーク", "라인아크"],
    ["ホワイト・グリント", "화이트 글린트"],
    ["スティールヘイズ", "스틸 헤이즈"],
    ["ロックスミス", "록스미스"],
    ["オープンフェイス", "오픈 페이스"],
    ["ミルクトゥース", "밀크투스"],
    ["ライガーテイル", "라이거 테일"],
    ["ナイトフォール", "나이트폴"],
    ["ハングドマン", "행드맨"],
    ["ヴェンジェンス", "벤전스"],
    ["オラクル", "오라클"],
    ["サンシャイン", "선샤인"],
    ["フィードバック", "피드백"],
    ["近接突撃型", "근접 돌격형"],
    ["強襲型", "강습형"],
    ["軽量級", "경량급"],
    ["再戦", "재전"],
    ["コトブキヤショップ限定品", "코토부키야샵 한정"],
    ["ランダムブースター", "랜덤 부스터"],
    ["ストリングランチャー", "스트링 런처"],
    ["メタルコート", "메탈 코트"],
    ["アプリ・イベント限定", "앱/이벤트 한정"],
    ["タカラトミーモール", "타카라토미몰"],
    ["ストームペガシス", "스톰 페가시스"],
    ["グローリーワルキューレ", "글로리 발키리"],
    ["サムライセイバー", "사무라이 세이버"],
    ["ドランブレイブ", "드랜 브레이브"],
    ["ドレイクブレイブ", "드레이크 브레이브"],
    ["ホーネットフォート", "호넷 포트"],
    ["クラーケンリグル", "크라켄 리글"],
    ["ブラック", "블랙"],
    ["グリーン", "그린"],
    ["ブルー", "블루"],
    ["オレンジ", "오렌지"],
    ["イエロー", "옐로"],
    ["Nendoroid", "넨도로이드"],
    ["POP UP PARADE", "POP UP PARADE"],
    ["Saber", "세이버"],
    ["Lancer", "랜서"],
    ["Archer", "아처"],
    ["Rider", "라이더"],
    ["Caster", "캐스터"],
    ["Assassin", "어새신"],
    ["Berserker", "버서커"],
    ["Ruler", "룰러"],
    ["Avenger", "어벤저"],
    ["Foreigner", "포리너"],
    ["Altria", "알트리아"],
    ["Artoria", "알트리아"],
    ["Jeanne d'Arc", "잔 다르크"],
    ["Morgan", "모르간"],
    ["Scáthach", "스카사하"],
    ["Skadi", "스카디"],
    ["Mélusine", "멜뤼진"],
    ["Koyanskaya of Light", "빛의 코얀스카야"],
    ["Minamoto-no-Raikou", "미나모토노 라이코"],
    ["Katsushika Hokusai", "가쓰시카 호쿠사이"],
    ["Mysterious Alter Ego Λ", "수수께끼의 얼터에고 Λ"],
    ["Final Ascension", "최종재림"],
    ["Travel Portrait", "트래블 포트레이트"],
    ["Bunny Ver.", "버니 Ver."],
    ["Ver.", "Ver."],
    ["・", " "],
    ["（", "("],
    ["）", ")"],
  ],
};
for (const replacements of Object.values(DISPLAY_NAME_REPLACEMENTS)) {
  replacements.sort((a, b) => b[0].length - a[0].length);
}

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
  AC_SHOKUGAN: { zh: "食玩", ko: "식완", en: "Shokugan", ja: "食玩" },
  AC_SMP: { zh: "SMP", ko: "SMP", en: "SMP", ja: "SMP" },
  FATE_SCALE: { zh: "手办", ko: "피규어", en: "Figure", ja: "フィギュア" },
  FATE_ACTION: { zh: "可动", ko: "액션", en: "Action", ja: "可動" },
  NENDOROID: { zh: "黏土人", ko: "넨도", en: "Nendoroid", ja: "ねんどろ" },
  ICHIBAN_KUJI: { zh: "一番赏", ko: "이치방쿠지", en: "Kuji", ja: "一番くじ" },
  FATE_GASHAPON: { zh: "扭蛋", ko: "가샤폰", en: "Gashapon", ja: "ガシャポン" },
  FATE_PRIZE: { zh: "景品", ko: "경품", en: "Prize", ja: "景品" },
  FATE_GOODS: { zh: "周边", ko: "굿즈", en: "Goods", ja: "グッズ" },
  POKE_PLUSH: { zh: "毛绒", ko: "인형", en: "Plush", ja: "ぬいぐるみ" },
  POKE_GOODS: { zh: "周边", ko: "굿즈", en: "Goods", ja: "グッズ" },
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
  overrides: {},
  seriesLabelOverrides: {},
  collection: { owned: [], wanted: [] },
  homeCollectionVisibility: loadHomeCollectionVisibility(),
  homeCollectionCollapsed: loadHomeCollectionCollapsed(),
  collectionMemberView: localStorage.getItem(COLLECTION_MEMBER_VIEW_KEY) || "self",
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
  settingsPanel: SETTINGS_PANELS.includes(localStorage.getItem(SETTINGS_PANEL_KEY)) ? localStorage.getItem(SETTINGS_PANEL_KEY) : "account",
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
  homeUpdateSummary: document.querySelector("#homeUpdateSummary"),
  sourceHealthStrip: document.querySelector("#sourceHealthStrip"),
  homeUpdateList: document.querySelector("#homeUpdateList"),
  homeSection: document.querySelector("#homeSection"),
  homeCoverInput: document.querySelector("#homeCoverInput"),
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
  collectionMemberFilter: document.querySelector("#collectionMemberFilter"),
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

// Inside the Capacitor shell the bundled ../data snapshot is frozen at build
// time, so prefer the live GitHub Pages copy and fall back to the bundle offline.
const REMOTE_DATA_BASE = "https://mdefitko777.github.io/Gunpula/";

function isNativeShell() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function loadJson(path) {
  if (isNativeShell() && path.startsWith("../")) {
    try {
      return await fetchJson(`${REMOTE_DATA_BASE}${path.slice(3)}`);
    } catch {
      // Offline or Pages unreachable: use the bundled snapshot below.
    }
  }
  return fetchJson(path);
}

async function loadOptionalJson(path) {
  try {
    return await loadJson(path);
  } catch {
    return null;
  }
}

// Startup loads only the active franchise's catalog slice; the rest streams in
// after first render. Falls back to the monolithic kits.json when split files
// are unavailable (e.g. older deployments or partial offline caches).
let catalogCompletion = null;
const searchIndexPromises = new Map();

async function loadInitialKitsDoc() {
  const manifest = await loadOptionalJson("../data/split/manifest.json");
  const franchises = Object.keys(manifest?.franchises || {});
  if (!franchises.length) {
    return { doc: await loadJson("../data/kits.json"), pendingFranchises: [] };
  }
  const first = franchises.includes(state.franchise) ? state.franchise : franchises.includes("gundam") ? "gundam" : franchises[0];
  const doc = await loadOptionalJson(`../data/split/kits-${first}.json`);
  if (!doc?.kits) {
    return { doc: await loadJson("../data/kits.json"), pendingFranchises: [] };
  }
  return { doc, pendingFranchises: franchises.filter((franchise) => franchise !== first) };
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
    render();
  })().catch(() => {
    catalogCompletion = null;
  });
}

function ingestSearchIndex(doc, franchise = null) {
  const records = doc?.records || [];
  if (!state.searchIndex) {
    state.searchIndex = { schema_version: 1, updated_at: doc?.updated_at || null, records: [] };
  }
  const byId = new Map((state.searchIndex.records || []).map((record) => [record.kit_id, record]));
  for (const record of records) {
    byId.set(record.kit_id, record);
    state.searchIndexByKit.set(record.kit_id, record);
  }
  state.searchIndex.records = [...byId.values()];
  state.searchIndex.updated_at = doc?.updated_at || state.searchIndex.updated_at;
  if (franchise) {
    state.loadedSearchFranchises.add(franchise);
  }
}

function ensureSearchIndex(franchise = state.franchise) {
  if (franchise && state.loadedSearchFranchises.has(franchise)) {
    return Promise.resolve(state.searchIndex);
  }
  const key = franchise || "all";
  if (!searchIndexPromises.has(key)) {
    const promise = loadOptionalJson(franchise ? `../data/search/search-${franchise}.json` : "../data/search-index.json")
      .then(async (doc) => {
        const nextDoc = doc?.records ? doc : await loadOptionalJson("../data/search-index.json");
        if (!nextDoc?.records) {
          searchIndexPromises.delete(key);
          return null;
        }
        ingestSearchIndex(nextDoc, doc?.records ? franchise : null);
        if (!doc?.records) {
          for (const item of FRANCHISES) {
            state.loadedSearchFranchises.add(item);
          }
        }
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
  const values = Array.isArray(value)
    ? value
    : String(value || "all")
        .split(",")
        .map((item) => item.trim());
  const filtered = [...new Set(values.filter((item) => item && item !== "all"))];
  return filtered.length ? filtered.join(",") : "all";
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
    elements.detailDialog.showModal();
  }
  if (state.activeModal === "settings") {
    renderSettings();
    elements.settingsDialog.showModal();
  }
  seedInitialOverlayHistory();
  completeCatalogInBackground(initialCatalog.pendingFranchises);
  if (state.query.trim()) {
    ensureSearchIndex();
  }
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
  if (!["home", "catalog", "updates", "pbandai", "owned", "wanted"].includes(state.activeView)) {
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

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  return THEMES.some((item) => item.code === theme) ? theme : "atlas";
}

function saveTheme() {
  localStorage.setItem(THEME_KEY, state.theme);
}

function loadAppIcon() {
  return localStorage.getItem(APP_ICON_KEY) || "";
}

function saveAppIcon() {
  if (state.appIcon) {
    localStorage.setItem(APP_ICON_KEY, state.appIcon);
  } else {
    localStorage.removeItem(APP_ICON_KEY);
  }
}

function loadHomeCovers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_COVER_KEY) || "{}");
    return normalizeHomeCovers(parsed);
  } catch {
    return {};
  }
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
    localStorage.setItem(HOME_COVER_KEY, JSON.stringify(covers));
  } else {
    localStorage.removeItem(HOME_COVER_KEY);
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
  try {
    const parsed = JSON.parse(localStorage.getItem(UPDATE_NOTIFICATION_FILTER_KEY) || "{}");
    return { ...DEFAULT_NOTIFICATION_FILTERS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_NOTIFICATION_FILTERS };
  }
}

function saveUpdateNotificationFilters() {
  localStorage.setItem(UPDATE_NOTIFICATION_FILTER_KEY, JSON.stringify(state.updateNotificationFilters));
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
  const legacyItems = collection.items && typeof collection.items === "object" ? { ...collection.items } : {};
  const memberItems = collection.member_items && typeof collection.member_items === "object" ? structuredClone(collection.member_items) : {};
  const self = safeMemberName(memberName());
  const now = new Date().toISOString();
  for (const kitId of Array.isArray(collection.owned) ? collection.owned : []) {
    if (!legacyItems[kitId]) {
      legacyItems[kitId] = { status: "owned", updated_at: now, updated_by: "local" };
    }
  }
  for (const kitId of Array.isArray(collection.wanted) ? collection.wanted : []) {
    if (!legacyItems[kitId]) {
      legacyItems[kitId] = { status: "wanted", quantity: 1, updated_at: now, updated_by: "local" };
    }
  }

  // Legacy collections used only `items` / `owned` / `wanted`. Migrate those
  // once, but never let stale legacy mirrors recreate member entries after a delete.
  if (Object.keys(memberItems).length === 0) {
    for (const [kitId, entry] of Object.entries(legacyItems)) {
      if (!entry?.status) {
        continue;
      }
      memberItems[self] = memberItems[self] || {};
      memberItems[self][kitId] = entry;
    }
  }

  const normalizedMemberItems = {};
  for (const [member, memberMap] of Object.entries(memberItems)) {
    const memberKey = safeMemberName(member);
    if (!memberKey || !memberMap || typeof memberMap !== "object") {
      continue;
    }
    for (const [kitId, entry] of Object.entries(memberMap)) {
      if (!entry?.status || !COLLECTION_ENTRY_STATUSES.includes(entry.status)) {
        continue;
      }
      const normalizedEntry = normalizeCollectionEntry(entry, now, memberKey);
      normalizedMemberItems[memberKey] = normalizedMemberItems[memberKey] || {};
      normalizedMemberItems[memberKey][kitId] = normalizedEntry;
    }
  }

  const owned = [];
  const wanted = [];
  const normalizedItems = {};
  for (const [kitId, entry] of Object.entries(normalizedMemberItems[self] || {})) {
    normalizedItems[kitId] = entry;
    if (entry.status === "owned") {
      owned.push(kitId);
    }
    if (entry.status === "wanted") {
      wanted.push(kitId);
    }
  }

  return { owned: [...new Set(owned)], wanted: [...new Set(wanted)], items: normalizedItems, member_items: normalizedMemberItems };
}

function safeMemberName(value) {
  return String(value || "member").trim() || "member";
}

function normalizeCollectionEntry(entry, now = new Date().toISOString(), member = "member") {
  const normalized = {
    status: COLLECTION_ENTRY_STATUSES.includes(entry.status) ? entry.status : "wanted",
    updated_at: entry.updated_at || now,
    updated_by: entry.updated_by || member,
    quantity: clampCollectionQuantity(entry.quantity ?? entry.wanted_quantity ?? 1),
  };
  if (entry.note) normalized.note = String(entry.note);
  if (entry.storage) normalized.storage = String(entry.storage);
  const purchasePrice = numericFilterValue(entry.purchase_price);
  if (purchasePrice !== null) normalized.purchase_price = Math.round(purchasePrice);
  return normalized;
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

function saveSyncHistory() {
  localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(state.syncHistory.slice(0, SYNC_HISTORY_LIMIT)));
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
  renderConsoleMode();
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
  elements.settingsTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-settings-tab]");
    if (!button) {
      return;
    }
    state.settingsPanel = button.dataset.settingsTab;
    state.consoleMode = state.settingsPanel === "console";
    saveConsoleMode();
    localStorage.setItem(SETTINGS_PANEL_KEY, state.settingsPanel);
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
  elements.accountSendCode.addEventListener("click", accountSendCode);
  elements.accountVerify.addEventListener("click", accountVerifyCode);
  elements.accountEmail.addEventListener("keydown", (event) => {
    if (event.key === "Enter") accountSendCode();
  });
  elements.accountCode.addEventListener("keydown", (event) => {
    if (event.key === "Enter") accountVerifyCode();
  });
  elements.accountSignOut.addEventListener("click", accountSignOutNow);
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
  elements.refreshAppCache.addEventListener("click", refreshAppCache);
  elements.updateNotificationToggle.addEventListener("change", toggleUpdateNotifications);
  elements.updatesOpenSettings.addEventListener("click", () => {
    openSettings();
    requestAnimationFrame(() => elements.updateLog?.scrollIntoView({ block: "start", behavior: "smooth" }));
  });
  elements.updatesDateInput?.addEventListener("change", (event) => {
    state.releaseMonth = event.target.value || defaultReleaseMonth();
    localStorage.setItem(RELEASE_MONTH_KEY, state.releaseMonth);
    state.updatesMode = "month";
    localStorage.setItem(UPDATES_MODE_KEY, state.updatesMode);
    renderHomeUpdates();
  });
  elements.updatesRecentButton?.addEventListener("click", () => {
    state.updatesMode = "recent";
    localStorage.setItem(UPDATES_MODE_KEY, state.updatesMode);
    renderHomeUpdates();
  });
  elements.searchInput.addEventListener("focus", () => ensureSearchIndex(), { once: false });
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    ensureSearchIndex();
    persistViewState();
    renderKits();
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
    applyViewState(loadSavedViewState());
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && syncConfigComplete()) {
      pullSync({ silent: true });
    }
  });
  bindRadialMenu();

  populateGradeSelect();
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
  if (elements.detailDialog.open || elements.settingsDialog.open) {
    return false;
  }
  if (!(target instanceof Element)) {
    return false;
  }
  return !target.closest("dialog, input, textarea, select, option");
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
  if (state.activeView === "catalog" && !state.pager.blockedByTarget && absX > PAGER_START_DISTANCE && absX > absY * 1.15) {
    clearTimeout(state.radial.timer);
    state.radial.timer = null;
    startPagerGesture(deltaX);
    updatePagerGesture(deltaX);
    if (event.cancelable) event.preventDefault();
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
    openFranchiseCatalog(selected);
  }
}

function cancelRadialPress() {
  clearTimeout(state.radial.timer);
  state.radial.timer = null;
  state.radial.active = false;
  state.radial.touchId = null;
  state.radial.selected = null;
  state.radial.target = null;
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
  const centerX = Math.min(Math.max(x, 112), window.innerWidth - 112);
  const centerY = Math.min(Math.max(y, 112), window.innerHeight - 112);
  state.radial.active = true;
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
  FRANCHISES.forEach((franchise, index) => {
    const centerAngle = -90 + index * (360 / FRANCHISES.length);
    const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
    segment.setAttribute("class", "radial-segment");
    segment.dataset.franchise = franchise;
    segment.setAttribute("d", donutSegmentPath(110, 110, 104, 42, centerAngle - 36, centerAngle + 36));
    svg.append(segment);

    const angle = centerAngle;
    const radian = (angle * Math.PI) / 180;
    const label = document.createElement("span");
    label.className = "radial-label";
    label.dataset.franchise = franchise;
    label.style.left = `${110 + Math.cos(radian) * 74}px`;
    label.style.top = `${110 + Math.sin(radian) * 74}px`;
    label.textContent = franchiseShortLabel(franchise);
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
  if (Math.hypot(dx, dy) < RADIAL_SELECT_DISTANCE) {
    state.radial.selected = null;
  } else {
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const index = Math.floor(((angle + 126 + 360) % 360) / (360 / FRANCHISES.length));
    state.radial.selected = FRANCHISES[index];
  }
  elements.radialMenu.querySelectorAll(".radial-segment, .radial-label").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.franchise === state.radial.selected);
  });
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
  for (const value of values) {
    const time = Date.parse(value || "");
    if (Number.isFinite(time)) {
      return time;
    }
  }
  return 0;
}

function newerByTimestamp(left, right, fields = ["updated_at"]) {
  const leftTime = timestampMs(...fields.map((field) => left?.[field]));
  const rightTime = timestampMs(...fields.map((field) => right?.[field]));
  return leftTime >= rightTime ? left : right;
}

function mergeCollectionState(localCollection, remoteCollection) {
  const local = normalizeCollection(localCollection || {});
  const remote = normalizeCollection(remoteCollection || {});
  const merged = { member_items: {} };
  const members = new Set([...Object.keys(local.member_items || {}), ...Object.keys(remote.member_items || {})]);
  for (const member of members) {
    const kitIds = new Set([...Object.keys(local.member_items?.[member] || {}), ...Object.keys(remote.member_items?.[member] || {})]);
    for (const kitId of kitIds) {
      const next = newerByTimestamp(local.member_items?.[member]?.[kitId], remote.member_items?.[member]?.[kitId]);
      if (!next) {
        continue;
      }
      merged.member_items[member] = merged.member_items[member] || {};
      merged.member_items[member][kitId] = next;
    }
  }
  return normalizeCollection(merged);
}

function mergeTimestampedMap(localMap = {}, remoteMap = {}) {
  const merged = {};
  for (const key of new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})])) {
    const next = newerByTimestamp(localMap?.[key], remoteMap?.[key], ["updated_at", "hidden_at", "reviewed_at"]);
    if (next && Object.keys(next).length) {
      merged[key] = next;
    }
  }
  return merged;
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
  const previousName = currentWorkspaceMemberName();
  elements.saveMemberDisplayName.disabled = true;
  try {
    state.syncConfig.memberName = nextName;
    saveSyncConfig();
    const renamedCollection = renameCollectionMember(previousName, nextName);
    if (syncModeV2() && state.sync.workspace) {
      const result = await supabaseRpcV2("gunpula_v2_update_member_name", {
        p_display_name: nextName,
      });
      const remote = normalizeCloudState(result);
      state.sync.workspace = remote?.workspace || state.sync.workspace;
      state.sync.canEdit = remote?.canEdit ?? state.sync.canEdit;
      setSyncStatus(state.sync.canEdit ? "connected" : "readonly", t("memberNameSaved"));
    } else {
      setSyncStatus("local", t("memberNameSaved"));
    }
    if (renamedCollection) {
      saveCollection();
    }
    renderSettings();
    renderCollections();
    renderKits();
  } catch (error) {
    state.syncConfig.memberName = previousName;
    saveSyncConfig();
    setSyncStatus("error", error.message);
    renderSettings();
  } finally {
    elements.saveMemberDisplayName.disabled = false;
  }
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
  const payload = {
    exported_at: new Date().toISOString(),
    app: APP_VERSION_LABEL,
    ...cloudPayload(),
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
  renderUpdateLog();
  renderFilterSummary();
  renderKits();
}

function renderBottomNav() {
  elements.bottomNav.querySelectorAll("button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView || (state.activeView === "pbandai" && button.dataset.view === "catalog"));
  });
}

function applyAppearance() {
  document.body.dataset.theme = state.theme;
  // APP_VERSION_LABEL is the single source of truth for the version shown
  // anywhere in the UI; the static strings in index.html/i18n are fallbacks.
  document.title = `Gunpula ${APP_VERSION_LABEL}`;
  document.querySelector('meta[name="application-name"]')?.setAttribute("content", `Gunpula ${APP_VERSION_LABEL}`);
  document.querySelectorAll('[data-i18n="homeTitle"], [data-i18n="appTitle"]').forEach((node) => {
    node.textContent = APP_VERSION_LABEL;
  });
  if (elements.brandVersion) {
    elements.brandVersion.textContent = APP_VERSION_LABEL;
  }
  if (elements.appVersionLabel) {
    elements.appVersionLabel.textContent = `Gunpula App ${APP_VERSION_LABEL}`;
  }
  if (elements.brandMark) {
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
  elements.homeGrid.innerHTML = "";

  for (const franchise of FRANCHISES) {
    const card = document.createElement("article");
    card.tabIndex = 0;
    card.role = "button";
    card.setAttribute("aria-label", franchiseLabel(franchise));
    card.className = `home-card home-card-${franchise.replace("_", "-")}`;
    card.addEventListener("click", (event) => {
      if (event.target.closest(".home-cover-button")) {
        return;
      }
      openFranchiseCatalog(franchise);
    });
    card.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) {
        return;
      }
      event.preventDefault();
      openFranchiseCatalog(franchise);
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
    coverButton.textContent = t("changeCover");
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

function renderHomeDashboard() {
  renderHomeCollectionOverview();
  renderHomeRecentViewed();
}

function renderHomeCollectionOverview() {
  if (!elements.homeCollectionOverview) {
    return;
  }
  const ownedCount = collectionIds("owned").reduce((total, kitId) => total + collectionQuantityForView(kitId, "owned"), 0);
  const wantedCount = collectionIds("wanted").reduce((total, kitId) => total + collectionQuantityForView(kitId, "wanted"), 0);
  elements.homeCollectionTotal.textContent = t("records", { count: ownedCount + wantedCount });
  elements.homeCollectionOverview.innerHTML = "";
  for (const type of COLLECTION_TYPES) {
    const ids = collectionIds(type).filter((kitId) => displayKitById(kitId)).slice(0, 4);
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
  return (item.change_reasons || []).map(updateReasonLabel).join(" · ");
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

function validReleaseMonth(value) {
  const match = /^\d{4}-\d{2}$/.exec(String(value || ""));
  return match ? match[0] : "";
}

// Kits without an official release_date (common for Pokemon goods) fall back
// to the date they were first seen in the catalog, so they still appear in
// the monthly updates view instead of vanishing.
function effectiveKitDate(kit) {
  return kit.release_date || state.kitFirstSeen?.[kit.kit_id] || null;
}

function releaseMonthForKit(kit) {
  return validReleaseMonth(String(effectiveKitDate(kit) || "").slice(0, 7));
}

function releaseDateForDisplay(kit) {
  return effectiveKitDate(kit) || t("pending");
}

function defaultReleaseMonth() {
  const current = localDateKey().slice(0, 7);
  const months = [...new Set(state.kits.map(releaseMonthForKit).filter(Boolean))].sort();
  return months.find((month) => month >= current) || months.at(-1) || current;
}

function releaseItemsForMonth(month = state.releaseMonth, franchise = null) {
  const target = validReleaseMonth(month) || defaultReleaseMonth();
  return state.kits
    .filter((kit) => releaseMonthForKit(kit) === target && (!franchise || kit.franchise === franchise))
    .sort((a, b) => {
      const date = String(a.release_date || "").localeCompare(String(b.release_date || ""));
      if (date) return date;
      return kitShortName(a).localeCompare(kitShortName(b), state.language);
    });
}

function kitIsPremiumBandai(kit) {
  return itemIsPremiumBandai({
    kit_id: kit.kit_id,
    grade_code: kit.grade_code,
    subline: kit.subline,
    names: kit.names,
    source_urls: kit.source_urls,
    is_premium_bandai: kit.is_premium_bandai,
  });
}

function releaseMonthStats(month = state.releaseMonth, franchise = null) {
  const items = releaseItemsForMonth(month, franchise);
  return {
    count: items.length,
    premium: items.filter(kitIsPremiumBandai).length,
    watched: items.filter((kit) => ["seed", "double_o"].includes(kitSeriesKey(kit))).length,
    franchises: new Set(items.map((kit) => kit.franchise)).size,
  };
}

// Kits added/changed in the update feed during the last `days` days,
// anchored on the newest feed entry so the list never goes empty when the
// daily refresh lags.
function recentFeedKits(days = RECENT_UPDATE_DAYS) {
  const entries = updateFeedEntries();
  if (!entries.length) {
    return [];
  }
  const newestMs = Date.parse(`${entries[0].date}T00:00:00`);
  const cutoffMs = newestMs - (days - 1) * 86400000;
  const seen = new Set();
  const results = [];
  for (const entry of entries) {
    const entryMs = Date.parse(`${entry.date}T00:00:00`);
    if (!Number.isFinite(entryMs) || entryMs < cutoffMs) {
      break;
    }
    const items = updateEntryItems(entry);
    for (const item of [...items.added, ...items.changed]) {
      if (!item?.kit_id || seen.has(item.kit_id)) {
        continue;
      }
      seen.add(item.kit_id);
      const kit = displayKitById(item.kit_id);
      if (kit) {
        results.push(kit);
      }
    }
  }
  return results;
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

  const recentMode = state.updatesMode !== "month";
  elements.updatesRecentButton?.classList.toggle("is-active", recentMode);
  const items = recentMode ? recentFeedKits() : releaseItemsForMonth(state.releaseMonth);
  if (recentMode) {
    elements.updatesSubtitle.textContent = t("recentDaysSummary", { days: RECENT_UPDATE_DAYS, count: items.length });
    renderUpdateSummaryCards(elements.homeUpdateSummary, [
      { label: t("recentDaysShort"), value: items.length, meta: updateFeedEntries()[0]?.date || "" },
      { label: t("premiumBandai"), value: items.filter(kitIsPremiumBandai).length, meta: t("openPremiumBandai") },
      { label: t("watchedUpdates"), value: items.filter((kit) => ["seed", "double_o"].includes(kitSeriesKey(kit))).length, meta: "SEED / 00" },
      { label: t("franchise"), value: new Set(items.map((kit) => kit.franchise)).size, meta: t("records", { count: state.kits.length }) },
    ]);
  } else {
    const stats = releaseMonthStats(state.releaseMonth);
    elements.updatesSubtitle.textContent = t("releaseMonthSummary", { month: state.releaseMonth, count: items.length });
    renderUpdateSummaryCards(elements.homeUpdateSummary, [
      { label: t("releaseMonth"), value: stats.count, meta: state.releaseMonth },
      { label: t("premiumBandai"), value: stats.premium, meta: t("openPremiumBandai") },
      { label: t("watchedUpdates"), value: stats.watched, meta: "SEED / 00" },
      { label: t("franchise"), value: stats.franchises, meta: t("records", { count: state.kits.length }) },
    ]);
  }
  elements.sourceHealthStrip.hidden = true;

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
  const doc = state.pbandai;
  const items = Array.isArray(doc) ? doc : Array.isArray(doc?.items) ? doc.items : [];
  return items
    .filter((item) => item && item.url)
    .slice()
    .sort((a, b) => {
      const aRank = a.fetch_status === "ok" ? 0 : 1;
      const bRank = b.fetch_status === "ok" ? 0 : 1;
      return aRank - bRank || String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
}

function pbandaiFranchiseForItem(item) {
  if (item.franchise) {
    return item.franchise === "gunpla" ? "gundam" : item.franchise;
  }
  if (item.category === "gunpla") {
    return "gundam";
  }
  if (item.category === "armored_core") {
    return "armored_core";
  }
  const kit = item.kit_id ? displayKitById(item.kit_id) : null;
  return kit?.franchise || "";
}

function pbandaiFranchises() {
  return [...new Set(pbandaiItems().map(pbandaiFranchiseForItem).filter((franchise) => FRANCHISES.includes(franchise)))];
}

function pbandaiItemsForFranchise(franchise = state.franchise) {
  return pbandaiItems()
    .filter((item) => pbandaiFranchiseForItem(item) === franchise)
    .sort((a, b) => {
      const kitA = a.kit_id ? displayKitById(a.kit_id) : null;
      const kitB = b.kit_id ? displayKitById(b.kit_id) : null;
      const date = String(kitB?.release_date || "").localeCompare(String(kitA?.release_date || ""));
      if (date) return date;
      return String(a.title || a.id).localeCompare(String(b.title || b.id), state.language);
    });
}

function navigateToPBandai(franchise = state.franchise) {
  const available = pbandaiFranchises();
  state.franchise = available.includes(franchise) ? franchise : available[0] || state.franchise;
  state.activeView = "pbandai";
  state.selectedKit = null;
  state.activeModal = null;
  localStorage.setItem(FRANCHISE_KEY, state.franchise);
  localStorage.setItem(ACTIVE_VIEW_KEY, state.activeView);
  render();
  persistViewState({ mode: "push" });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function safePBandaiImageUrl(item) {
  const image = String(item.image || "").trim();
  if (!image || /^https?:\/\/([^/]+\.)?p-bandai\.jp\//i.test(image)) {
    return "";
  }
  return image;
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
  elements.pbandaiSubtitle.textContent = `${franchiseLabel(state.franchise)} · ${t("premiumBandaiUpdated", { date: String(updatedAt).slice(0, 10) })} · ${items.length} · ${t("pbandaiInternalHint")}`;
  renderPBandaiFranchiseTabs(availableFranchises);
  elements.pbandaiList.innerHTML = "";

  if (!visibleItems.length) {
    const empty = document.createElement("div");
    empty.className = "home-update-empty";
    empty.textContent = t("pbandaiUnavailable");
    elements.pbandaiList.append(empty);
    return;
  }

  for (const item of visibleItems) {
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

function renderPBandaiFranchiseTabs(franchises) {
  if (!elements.pbandaiFranchiseTabs) {
    return;
  }
  elements.pbandaiFranchiseTabs.innerHTML = "";
  for (const franchise of franchises) {
    const count = pbandaiItemsForFranchise(franchise).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${state.franchise === franchise ? " is-active" : ""}`;
    button.textContent = `${franchiseShortLabel(franchise)} ${count}`;
    button.addEventListener("click", () => {
      state.franchise = franchise;
      localStorage.setItem(FRANCHISE_KEY, state.franchise);
      renderPBandaiProducts();
      persistViewState({ mode: "push" });
    });
    elements.pbandaiFranchiseTabs.append(button);
  }
}

// Only sources that produce automated data are shown in the app. Manual-link /
// jump-search-only marketplaces are hidden everywhere (source grid + detail
// search links) since they can't populate prices on their own.
const DISPLAYED_MARKET_SOURCES = new Set(["naver_shop", "bunjang", "joongna"]);

function marketSources() {
  return [...(state.marketPrices?.sources || [])]
    .filter((source) => DISPLAYED_MARKET_SOURCES.has(source.id))
    .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));
}

function searchRecordForKit(kit) {
  return kit?.kit_id ? state.searchIndexByKit.get(kit.kit_id) || null : null;
}

function marketRecordForKit(kit) {
  return kit?.kit_id ? state.marketPrices?.by_kit?.[kit.kit_id] || null : null;
}

function marketListingsForKit(kit) {
  if (!kit?.kit_id) {
    return [];
  }
  return (state.marketPrices?.listings || []).filter((listing) => listing.kit_id === kit.kit_id);
}

function marketSourceStatusText(source) {
  if (source.ready === true) return t("marketSourceReady");
  if (source.ready === "manual") return t("marketSourceManual");
  if (source.ready === "cache") return t("marketSourceCache");
  return t("marketSourceNeedsKeys");
}

function marketSourceStatusClass(source) {
  if (source.ready === true) return "is-ready";
  if (source.ready === "manual") return "is-manual";
  if (source.ready === "cache") return "is-cache";
  return "is-missing";
}

function formatKrw(value) {
  return Number.isFinite(Number(value)) ? `₩${Number(value).toLocaleString("ko-KR")}` : t("pending");
}

function formatMarketDate(value) {
  return String(value || t("pending")).slice(0, 10);
}

function marketPrimaryQuery(kit) {
  const record = searchRecordForKit(kit);
  return record?.queries?.[0] || [kit?.grade_code, kitShortName(kit)].filter(Boolean).join(" ");
}

function marketSearchUrl(source, query) {
  const template = source?.search_url_template;
  if (!template || !query) {
    return "";
  }
  return template.replace("{query}", encodeURIComponent(query));
}

function marketSearchLinksForKit(kit, limit = 8) {
  const query = marketPrimaryQuery(kit);
  return marketSources()
    .map((source) => ({ source, url: marketSearchUrl(source, query) }))
    .filter((item) => item.url)
    .slice(0, limit);
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
  img.decoding = "async";
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
  return /^\d{4}/.exec(String(effectiveKitDate(kit) || ""))?.[0] ?? null;
}

function numericFilterValue(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return null;
  }
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
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

function cleanDisplayName(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyDisplayNameReplacements(value, language) {
  let text = cleanDisplayName(value);
  const replacements = DISPLAY_NAME_REPLACEMENTS[language];
  if (!text || !replacements) {
    return text;
  }
  for (const [source, target] of replacements) {
    text = text.replace(new RegExp(escapePattern(source), "g"), target);
  }
  return cleanDisplayName(text)
    .replace(/\s+([)\]】])/g, "$1")
    .replace(/([(\[【])\s+/g, "$1")
    .trim();
}

function kitDisplayNameForLanguage(kit, language) {
  const names = kit.names || {};
  if (language === "zh" || language === "ko") {
    const direct = cleanDisplayName(names[language]);
    const translatedDirect = applyDisplayNameReplacements(direct, language);
    if (translatedDirect && (translatedDirect !== direct || !JAPANESE_TEXT_PATTERN.test(translatedDirect))) {
      return translatedDirect;
    }
    const english = applyDisplayNameReplacements(names.en, language);
    if (english && !JAPANESE_TEXT_PATTERN.test(english)) {
      return english;
    }
    const japanese = applyDisplayNameReplacements(names.ja, language);
    if (japanese) {
      return japanese;
    }
  }
  for (const code of NAME_FALLBACKS[language] ?? NAME_FALLBACKS.zh) {
    if (names[code]) {
      return cleanDisplayName(names[code]);
    }
  }
  return kit.kit_id;
}

function kitDisplayName(kit) {
  for (const code of NAME_FALLBACKS[state.language] ?? NAME_FALLBACKS.zh) {
    const name = kitDisplayNameForLanguage(kit, code);
    if (name) {
      return name;
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
  if (!type) {
    return;
  }

  renderCollectionMemberFilter(type);
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

function renderCollectionMemberFilter(type) {
  if (!elements.collectionMemberFilter) {
    return;
  }
  elements.collectionMemberFilter.innerHTML = "";
  const options = [
    ["all", t("allMembers")],
    ["self", t("currentMember")],
    ...collectionMembers()
      .filter((member) => member !== editableCollectionMember())
      .map((member) => [member, member]),
  ];
  for (const [value, label] of options) {
    const button = document.createElement("button");
    button.type = "button";
    const isActive =
      state.collectionMemberView === value ||
      (value === "self" && activeCollectionMember() === editableCollectionMember()) ||
      (value !== "self" && value !== "all" && activeCollectionMember() === value);
    button.className = `member-chip${isActive ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      state.collectionMemberView = value;
      localStorage.setItem(COLLECTION_MEMBER_VIEW_KEY, state.collectionMemberView);
      state.collectionSelection[type] = new Set();
      renderKits();
    });
    elements.collectionMemberFilter.append(button);
  }
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
  if (collectionEntry(kit.kit_id, targetMember)?.status === type) {
    memberCollectionMap(targetMember)[kit.kit_id] = {
      ...collectionEntry(kit.kit_id, targetMember),
      status: "deleted",
      updated_at: new Date().toISOString(),
      updated_by: editableCollectionMember(),
    };
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
  renderAndroidPackageSummary();
}

function renderSettingsTabs() {
  if (!elements.settingsTabs) {
    return;
  }
  elements.settingsTabs.innerHTML = "";
  const labels = {
    account: "settingsTabAccount",
    appearance: "settingsTabAppearance",
    data: "settingsTabData",
    updates: "settingsTabUpdates",
    about: "settingsTabAbout",
    console: "settingsTabConsole",
  };
  for (const panel of SETTINGS_PANELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.settingsTab = panel;
    button.className = state.settingsPanel === panel ? "is-active" : "";
    button.textContent = t(labels[panel]);
    elements.settingsTabs.append(button);
  }
}

function renderSettingsPanels() {
  if (!SETTINGS_PANELS.includes(state.settingsPanel)) {
    state.settingsPanel = "account";
  }
  document.querySelectorAll("[data-settings-panel]").forEach((section) => {
    section.hidden = section.dataset.settingsPanel !== state.settingsPanel;
  });
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
  elements.accountAvatar.textContent = (email[0] || "@").toUpperCase();
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
    const row = document.createElement("div");
    row.className = `workspace-member-row${member.is_self ? " is-self" : ""}`;
    const name = document.createElement("strong");
    name.textContent = `${member.name || "member"}${member.is_self ? ` · ${t("workspaceSelf")}` : ""}`;
    const meta = document.createElement("span");
    const joined = member.joined_at ? String(member.joined_at).slice(0, 10) : "";
    meta.textContent = [t(`workspaceRole${capitalizeRole(member.role)}`), member.email, joined].filter(Boolean).join(" · ");
    row.append(name, meta);
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
      row.append(button, deleteButton);
      list.append(row);
    }
    panel.append(head, list);
    elements.duplicateWorkbench.append(panel);
  }
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
    button.className = `segment-button${state.franchise === franchise ? " is-active" : ""}`;
    button.textContent = franchiseShortLabel(franchise);
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
  elements.detailDialog.showModal();
  persistViewState({ mode: "push" });
}

function renderDetail(kit) {
  elements.detailKicker.textContent = `${seriesLabelFromKit(kit)} · ${gradeShortLabel(kit)}${kit.scale ? ` · ${kit.scale}` : ""}`;
  elements.detailTitle.textContent = kitShortName(kit);
  elements.detailSubtitle.textContent = [kit.release_date, formatPrice(kit.price_jpy)].filter((value) => value && value !== t("pending")).join(" · ");
  renderDetailStatusActions(kit);
  renderDetailMeta(kit);
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
