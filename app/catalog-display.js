export const LANGUAGES = [
  { code: "zh", label: "中", htmlLang: "zh-CN" },
  { code: "ko", label: "한", htmlLang: "ko-KR" },
  { code: "en", label: "EN", htmlLang: "en" },
  { code: "ja", label: "日", htmlLang: "ja" },
];

export const FRANCHISES = ["gundam", "armored_core", "pokemon", "fate", "beyblade"];
export const SETTINGS_PANELS = ["account", "appearance", "data", "updates", "about", "console"];

export const FRANCHISE_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "ガンダム" },
  armored_core: { zh: "Armored Core", ko: "아머드 코어", en: "Armored Core", ja: "アーマード・コア" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  fate: { zh: "Fate", ko: "Fate", en: "Fate", ja: "Fate" },
  beyblade: { zh: "Beyblade X", ko: "베이블레이드 X", en: "Beyblade X", ja: "ベイブレードX" },
};

export const FRANCHISE_SHORT_LABELS = {
  gundam: { zh: "高达", ko: "건담", en: "Gundam", ja: "Gundam" },
  armored_core: { zh: "AC", ko: "AC", en: "AC", ja: "AC" },
  pokemon: { zh: "宝可梦", ko: "포켓몬", en: "Pokemon", ja: "ポケモン" },
  fate: { zh: "Fate", ko: "Fate", en: "Fate", ja: "Fate" },
  beyblade: { zh: "BBX", ko: "BBX", en: "BBX", ja: "BBX" },
};

export const SEARCH_ALIAS_GROUPS = [
  ["freedom", "フリーダム", "프리덤", "自由"],
  ["strike", "ストライク", "스트라이크", "强袭", "強襲"],
  ["destiny", "デスティニー", "데스티니", "命运", "命運"],
  ["justice", "ジャスティス", "저스티스", "正义", "正義"],
  ["exia", "エクシア", "엑시아", "能天使"],
  ["unicorn", "ユニコーン", "유니콘", "独角兽", "獨角獸"],
  ["sazabi", "サザビー", "사자비", "沙扎比"],
  ["pikachu", "ピカチュウ", "피카츄", "皮卡丘"],
  ["saber", "セイバー", "세이버", "阿尔托莉雅", "阿爾托莉雅", "artoria", "アルトリア"],
  ["nendoroid", "ねんどろいど", "넨도로이드", "黏土人"],
  ["beyblade", "ベイブレード", "베이블레이드", "爆旋陀螺", "bbx"],
];

export const NAME_FALLBACKS = {
  zh: ["zh", "ja", "en", "ko"],
  ko: ["ko", "ja", "en", "zh"],
  en: ["en", "ja", "zh", "ko"],
  ja: ["ja", "en", "zh", "ko"],
};

export const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff]/;
export const DISPLAY_NAME_REPLACEMENTS = {
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

export const GRADE_SHORT_LABELS = {
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

export const MODEL_GRADE_CATEGORIES = new Set(["core", "core_subline", "historical", "one_hundred", "plastic_model", "sd", "special"]);

export const ITEM_TYPE_LABELS = {
  plastic_model: { zh: "拼装", ko: "프라모델", en: "Model kit", ja: "プラモデル" },
  tamashii_figure: { zh: "成品", ko: "완성품", en: "Figure", ja: "完成品" },
  gashapon: { zh: "扭蛋", ko: "가샤폰", en: "Gashapon", ja: "ガシャポン" },
  shokugan: { zh: "食玩", ko: "식완", en: "Shokugan", ja: "食玩" },
  battle_toy: { zh: "战斗玩具", ko: "배틀 토이", en: "Battle toy", ja: "バトルトイ" },
  other: { zh: "其他", ko: "기타", en: "Other", ja: "その他" },
};

export const TITLE_PREFIX_PATTERNS = [
  /^FW\s+(?:GUNDAM|高达|건담)\s+CONVERGE(?:[:：]CORE| CORE| EX\d+| #)?\s*/i,
  /^MOBILE SUIT ENSEMBLE(?:\s+mecha)?\s*/i,
  /^机动战士高达\s*/i,
  /^機動戦士ガンダム\s*/i,
  /^기동전사 건담\s*/i,
  /^Mobile Suit Gundam\s*/i,
  /^SDW HEROES\s*/i,
  /^BB戦士\d*\s*/i,
];


export function franchiseLabelFor(franchise, language) {
  return FRANCHISE_LABELS[franchise]?.[language] ?? FRANCHISE_LABELS[franchise]?.en ?? franchise;
}

export function franchiseShortLabelFor(franchise, language) {
  return FRANCHISE_SHORT_LABELS[franchise]?.[language] ?? FRANCHISE_SHORT_LABELS[franchise]?.en ?? franchiseLabelFor(franchise, language);
}

export function gradeLabelFor(grade, language, pendingLabel = "") {
  if (!grade) return pendingLabel;
  if (language === "zh") return grade.name_zh || grade.name_en || grade.code;
  return grade.name_en || grade.name_zh || grade.code;
}

export function gradeShortLabelFor(gradeCode, language) {
  return GRADE_SHORT_LABELS[gradeCode]?.[language] ?? GRADE_SHORT_LABELS[gradeCode]?.en ?? gradeCode;
}

export function itemTypeKeyForCategory(category = "other") {
  if (MODEL_GRADE_CATEGORIES.has(category)) return "plastic_model";
  return ITEM_TYPE_LABELS[category] ? category : "other";
}

export function itemTypeLabelFor(key, language) {
  return ITEM_TYPE_LABELS[key]?.[language] ?? ITEM_TYPE_LABELS[key]?.en ?? key;
}

export function numericFilterValue(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function kitSeriesKey(kit) {
  return kit?.series?.key || "other";
}

export function kitSeriesSort(kit) {
  return Number.isFinite(kit?.series?.sort) ? kit.series.sort : 999;
}

export function baseSeriesLabelFor(series, language, pendingLabel = "") {
  return series?.labels?.[language] ?? series?.labels?.zh ?? series?.labels?.en ?? series?.key ?? pendingLabel;
}

export function seriesLabelForSeries(series, language, overrides = {}, pendingLabel = "") {
  const key = series?.key;
  return (key && overrides[key]?.[language]) || baseSeriesLabelFor(series, language, pendingLabel);
}

export function cleanDisplayName(value) {
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

export function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyDisplayNameReplacements(value, language) {
  let text = cleanDisplayName(value);
  const replacements = DISPLAY_NAME_REPLACEMENTS[language];
  if (!text || !replacements) return text;
  for (const [source, target] of replacements) {
    text = text.replace(new RegExp(escapePattern(source), "g"), target);
  }
  return cleanDisplayName(text)
    .replace(/\s+([)\]】])/g, "$1")
    .replace(/([(\[【])\s+/g, "$1")
    .trim();
}

export function expandedSearchTerms(query) {
  const cleaned = String(query || "").trim().toLowerCase();
  if (!cleaned) return [];
  const terms = new Set([cleaned]);
  for (const group of SEARCH_ALIAS_GROUPS) {
    if (group.some((term) => term.toLowerCase().includes(cleaned) || cleaned.includes(term.toLowerCase()))) {
      for (const term of group) terms.add(term.toLowerCase());
    }
  }
  return [...terms];
}

export function kitDisplayNameForLanguage(kit, language) {
  const names = kit?.names || {};
  if (language === "zh" || language === "ko") {
    const direct = cleanDisplayName(names[language]);
    const translatedDirect = applyDisplayNameReplacements(direct, language);
    if (translatedDirect && (translatedDirect !== direct || !JAPANESE_TEXT_PATTERN.test(translatedDirect))) return translatedDirect;
    const english = applyDisplayNameReplacements(names.en, language);
    if (english && !JAPANESE_TEXT_PATTERN.test(english)) return english;
    const japanese = applyDisplayNameReplacements(names.ja, language);
    if (japanese) return japanese;
  }
  for (const code of NAME_FALLBACKS[language] ?? NAME_FALLBACKS.zh) {
    if (names[code]) return cleanDisplayName(names[code]);
  }
  return kit?.kit_id;
}

export function kitDisplayNameFor(kit, language) {
  for (const code of NAME_FALLBACKS[language] ?? NAME_FALLBACKS.zh) {
    const name = kitDisplayNameForLanguage(kit, code);
    if (name) return name;
  }
  return kit?.kit_id;
}

export function kitShortNameFor(kit, language) {
  let name = kitDisplayNameFor(kit, language);
  for (const pattern of TITLE_PREFIX_PATTERNS) {
    name = name.replace(pattern, "");
  }
  return name.trim() || kitDisplayNameFor(kit, language);
}
