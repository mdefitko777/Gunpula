import { readFile, writeFile } from "node:fs/promises";

const CATALOG_FILE = "data/kits.json";

const HTML_ENTITY_MAP = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  nu: "ν",
  xi: "Ξ",
  zeta: "Ζ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  times: "×",
};

const SERIES = [
  {
    key: "sangoku",
    sort: 20,
    labels: { zh: "三国", en: "Sangoku", ja: "三国", ko: "삼국" },
    universe: "SD",
    pattern: /三国|三國|三国創傑伝|三国伝|関羽ガンダム|孫権ガンダム|曹操ガンダム|劉備ガンダム|諸葛亮|司馬懿|呂布|張飛|趙雲|貂蝉|馬超|黄忠|董卓|SANGOKU/i,
  },
  {
    key: "seed",
    sort: 30,
    labels: { zh: "SEED", en: "SEED", ja: "SEED", ko: "SEED" },
    universe: "CE",
    pattern: /SEED|DESTINY|FREEDOM|ASTRAY|STARGAZER|スターゲイザー|デスティニー|フリーダム|ジャスティス|インパルス|アカツキ|ストライク|イージス|デュエル|バスター|ブリッツ|プロヴィデンス|カラミティ|フォビドゥン|レイダー|アストレイ|ジン|シグー|ゲイツ|ウィンダム|ムラサメ|ブラックナイトスコード|ソードストライカー|ランチャーストライカー|エールストライカー|ストライカーパック|プラウドディフェンダー|アークエンジェル/i,
  },
  {
    key: "double_o",
    sort: 40,
    labels: { zh: "00", en: "00", ja: "00", ko: "00" },
    universe: "AD",
    pattern: /Gundam 00(?![0-9])|ガンダム00(?![0-9])|ダブルオー|00クアンタ|クアンタ|エクシア|デュナメス|キュリオス|ヴァーチェ|ナドレ|アストレア|ケルディム|アリオス|セラヴィー|セラフィム|オーライザー|ジンクス|ティエレン|スサノオ|フラッグ|スローネ|アルケー|アヘッド|ガデッサ|ガラッゾ|リボーンズ|ブレイヴ|GNアームズ|1\.5（アイズ）|1\.5ガンダム|Awakening of the Trailblazer/i,
  },
  {
    key: "w",
    sort: 50,
    labels: { zh: "W", en: "W", ja: "W", ko: "W" },
    universe: "AC",
    pattern: /Gundam Wing|Endless Waltz|G-UNIT|ガンダムW|ウイング|デスサイズ|ヘビーアームズ|サンドロック|シェンロン|アルトロン|トールギス|エピオン|リーオー|マグアナック|ヴァイエイト|メリクリウス|エアリーズ|ジェミナス|ヒイロ・ユイ/i,
  },
  {
    key: "ibo",
    sort: 60,
    labels: { zh: "铁血", en: "Iron-Blooded Orphans", ja: "鉄血", ko: "철혈" },
    universe: "Post Disaster",
    pattern: /Iron-Blooded Orphans|鉄血|バルバトス|グシオン|キマリス|グレイズ|フラウロス|バエル|ヴィダール|百里|百錬|マンロディ|ロディ|マルコシアス|アスタロト|ダンタリオン|レギンレイズ|グリムゲルデ/i,
  },
  {
    key: "witch",
    sort: 70,
    labels: { zh: "水星", en: "Witch", ja: "水星", ko: "수성" },
    universe: "Ad Stella",
    pattern: /Witch from Mercury|水星の魔女|エアリアル|ルブリス|キャリバーン|ファラクト|ディランザ|デミ|ベギル|ミカエリス|シュバルゼッテ|ガンヴォルヴァ|ザウォート|ダリルバルデ|グエル・ジェターク/i,
  },
  {
    key: "gqux",
    sort: 80,
    labels: { zh: "GQX", en: "GQuuuuuuX", ja: "GQuuuuuuX", ko: "GQuuuuuuX" },
    universe: "unknown",
    pattern: /GQuuuuuuX|ジークアクス|GFreD|白いガンダム|赤いガンダム|軽キャノン/i,
  },
  {
    key: "uc_first",
    sort: 100,
    labels: { zh: "初代", en: "0079", ja: "初代", ko: "초대" },
    universe: "UC",
    pattern: /Mobile Suit Gundam$|RX-78|ガンダム\(アニメカラー|ガンダム\(ロールアウト|ガンダム\(ハードポイント|＜SIDE MS＞\s*ガンダム$|Gファイター|Gアーマー|ホワイトベース|マゼラ・アタック|ガンキャノン|ガンタンク|シャア専用|シャア・アズナブル|ザク|グフ|ドム|ズゴック|ゲルググ|ジオング|アッガイ|ゾック|ギャン|ジム|ボール|ララァ専用|ビグ・ザム|コア・ブースター|ドップ|ギガン|プロトタイプガンダム|ガンダムEX|復讐のレクイエム/i,
  },
  {
    key: "zeta",
    sort: 110,
    labels: { zh: "Z", en: "Z", ja: "Z", ko: "Z" },
    universe: "UC",
    pattern: /Mobile Suit Z Gundam|Zガンダム|Ζ|ゼータ|ZII|スーパーガンダム|Gディフェンサー|ガンダムMk-II|ガンダムMk-Ⅱ|ボリノーク・サマーン|百式|リック・ディアス|メタス|ネモ|ハイザック|マラサイ|バーザム|アッシマー|ギャプラン|ジ・O|ディジェ|ガルバルディ/i,
  },
  {
    key: "zz",
    sort: 120,
    labels: { zh: "ZZ", en: "ZZ", ja: "ZZ", ko: "ZZ" },
    universe: "UC",
    pattern: /Mobile Suit Gundam ZZ|ZZ|ダブルゼータ|ゲーマルク|ゲー・ドライ|ハンマ・ハンマ|キュベレイ|ドーベン・ウルフ|ザクIII|バウ|クィン・マンサ|ドライセン|ズサ/i,
  },
  {
    key: "cca",
    sort: 130,
    labels: { zh: "逆夏", en: "CCA", ja: "逆シャア", ko: "역샤아" },
    universe: "UC",
    pattern: /Char's Counterattack|逆襲のシャア|ベルトーチカ・チルドレン|νガンダム|Hi-ν|サザビー|ナイチンゲール|サイコ・ドーガ|ヤクト・ドーガ|ギラ・ドーガ|α・アジール|リ・ガズィ|ジェガン/i,
  },
  {
    key: "unicorn",
    sort: 140,
    labels: { zh: "UC", en: "Unicorn", ja: "UC", ko: "UC" },
    universe: "UC",
    pattern: /Unicorn|ユニコーン|バンシィ|フェネクス|シナンジュ|クシャトリヤ|ジェスタ|リゼル|デルタプラス|デルタガンダム|シルヴァ・バレト|ローゼン・ズール|ギラ・ズール|ネェル・アーガマ|バイアラン・カスタム/i,
  },
  {
    key: "hathaway",
    sort: 150,
    labels: { zh: "闪哈", en: "Hathaway", ja: "閃ハサ", ko: "섬하사" },
    universe: "UC",
    pattern: /Hathaway|閃光のハサウェイ|Ξガンダム|クスィーガンダム|ペーネロペー|メッサー/i,
  },
  {
    key: "f91",
    sort: 160,
    labels: { zh: "F91", en: "F91", ja: "F91", ko: "F91" },
    universe: "UC",
    pattern: /F91|ビギナ・ギナ|デナン|ベルガ|ヘビーガン/i,
  },
  {
    key: "victory",
    sort: 170,
    labels: { zh: "V", en: "V", ja: "V", ko: "V" },
    universe: "UC",
    pattern: /Mobile Suit V Gundam|Vガンダム|Ｖダッシュ|Vダッシュ|ヴィクトリー|V2|セカンドV|ガンイージ/i,
  },
  {
    key: "g",
    sort: 180,
    labels: { zh: "G", en: "G", ja: "G", ko: "G" },
    universe: "FC",
    pattern: /Mobile Fighter G Gundam|Gガンダム|ゴッドガンダム|シャイニングガンダム|マスターガンダム|ノーベルガンダム|ドラゴンガンダム|ガンダムローズ|マックスター|マンダラガンダム|デビルガンダム|クーロンガンダム|風雲再起/i,
  },
  {
    key: "x",
    sort: 190,
    labels: { zh: "X", en: "X", ja: "X", ko: "X" },
    universe: "AW",
    pattern: /Gundam X|ガンダムX|ガンダムダブルエックス|エアマスター|レオパルド|ベルティゴ|ヴァサーゴ|Gファルコン/i,
  },
  {
    key: "turn_a",
    sort: 200,
    labels: { zh: "∀", en: "Turn A", ja: "∀", ko: "턴에이" },
    universe: "CC",
    pattern: /Turn A|∀|ターンエー|ターンX|スモー|カプル/i,
  },
  {
    key: "g_reco",
    sort: 210,
    labels: { zh: "G复国", en: "G-Reco", ja: "Gレコ", ko: "G레코" },
    universe: "Regild Century",
    pattern: /Reconguista|Gのレコンギスタ|G-セルフ|Ｇ-セルフ|G-アルケイン|G-ルシファー|グリモア|マックナイフ|ジャハナム|カバカーリー/i,
  },
  {
    key: "build",
    sort: 220,
    labels: { zh: "创战", en: "Build", ja: "ビルド", ko: "빌드" },
    universe: "Build",
    pattern: /Gundam Build|Build Fighters|Build Divers|Build Metaverse|ビルド|ダイバー|コアガンダム|アースリィ|ユーラヴェン|ベアッガイ|プチッガイ|ふみな|トライオン|アメイジング|フェニーチェ|スクランブル|ラーガンダム|プルタイン|ティフォエウス/i,
  },
  {
    key: "age",
    sort: 230,
    labels: { zh: "AGE", en: "AGE", ja: "AGE", ko: "AGE" },
    universe: "AG",
    pattern: /Gundam AGE|ガンダムAGE|AGE-|ガフラン|ゼダス|Gエグゼス|ジェノアス|ダナジン|レギルス|ギラーガ|ゼイドラ|ファルシア|クランシェ|アデル/i,
  },
  {
    key: "aoz",
    sort: 240,
    labels: { zh: "AOZ", en: "AOZ", ja: "A.O.Z", ko: "AOZ" },
    universe: "UC",
    pattern: /Advance of Zeta|A\.O\.Z|TR-1|TR-6|ヘイズル|ウーンドウォート|ハイゼンスレイ|フルドド/i,
  },
  {
    key: "narrative",
    sort: 242,
    labels: { zh: "NT", en: "Narrative", ja: "NT", ko: "NT" },
    universe: "UC",
    pattern: /Mobile Suit Gundam Narrative|Narrative Gundam|機動戦士ガンダムNT|ナラティブ|フェネクス|シナンジュ・スタイン|ディジェ(?:（ナラティブ| \(Narrative)|ナラティブ Ver/i,
  },
  {
    key: "moon",
    sort: 244,
    labels: { zh: "Moon", en: "Moon", ja: "ムーン", ko: "문" },
    universe: "UC",
    pattern: /Moon Gundam|ムーンガンダム|バルギル/i,
  },
  {
    key: "origin",
    sort: 246,
    labels: { zh: "Origin", en: "Origin", ja: "ORIGIN", ko: "Origin" },
    universe: "UC",
    pattern: /THE ORIGIN|Origin|オリジン|局地型ガンダム|ブグ|ザクI(?!I)|ザク・ハーフキャノン/i,
  },
  {
    key: "sentinel",
    sort: 250,
    labels: { zh: "Sentinel", en: "Sentinel", ja: "センチネル", ko: "센티넬" },
    universe: "UC",
    pattern: /Sentinel|Sガンダム|Ex-S|FAZZ|Zプラス|ゼータプラス|ディープストライカー|ガンダムMk-V|ゼク・アイン|ネロ/i,
  },
  {
    key: "crossbone",
    sort: 260,
    labels: { zh: "海盗", en: "Crossbone", ja: "クロスボーン", ko: "크로스본" },
    universe: "UC",
    pattern: /Crossbone|クロスボーン|ゴーストガンダム|ファントムガンダム|アンカーガンダム|鋼鉄の7人/i,
  },
  {
    key: "thunderbolt",
    sort: 270,
    labels: { zh: "雷霆宙域", en: "Thunderbolt", ja: "サンダーボルト", ko: "썬더볼트" },
    universe: "UC",
    pattern: /Thunderbolt|サンダーボルト|フルアーマー・ガンダム|サイコ・ザク|アトラスガンダム/i,
  },
  {
    key: "0083",
    sort: 280,
    labels: { zh: "0083", en: "0083", ja: "0083", ko: "0083" },
    universe: "UC",
    pattern: /0083|Stardust Memory|GP01|GP02|GP03|ガーベラ|デンドロビウム|ステイメン|ノイエ・ジール|ドラッツェ|ザメル/i,
  },
  {
    key: "0080",
    sort: 290,
    labels: { zh: "0080", en: "0080", ja: "0080", ko: "0080" },
    universe: "UC",
    pattern: /0080|War in the Pocket|アレックス|NT-1|ケンプファー|ハイゴッグ|ズゴックE|ザクII改/i,
  },
  {
    key: "08ms",
    sort: 300,
    labels: { zh: "08MS", en: "08MS", ja: "08小隊", ko: "08소대" },
    universe: "UC",
    pattern: /08th MS Team|08小隊|Ez-8|陸戦型|グフカスタム/i,
  },
  {
    key: "msv",
    sort: 310,
    labels: { zh: "MSV", en: "MSV", ja: "MSV", ko: "MSV" },
    universe: "UC",
    pattern: /MSV|G-3ガンダム|フルアーマーガンダム|パーフェクトガンダム|ジョニー・ライデン|シン・マツナガ|高機動型ザク/i,
  },
  {
    key: "sd",
    sort: 320,
    labels: { zh: "SD", en: "SD", ja: "SD", ko: "SD" },
    universe: "SD",
    pattern: /SD Gundam|SD|BB戦士|武者|頑駄無|騎士ガンダム|ナイトガンダム|サタンガンダム|コマンドガンダム|フェニックスガンダム/i,
  },
  {
    key: "pokemon",
    sort: 400,
    labels: { zh: "宝可梦", en: "Pokemon", ja: "ポケモン", ko: "포켓몬" },
    universe: "Pokemon",
    pattern: /Pokemon|Pokémon|ポケモン|PokePla/i,
  },
  {
    key: "armored_core",
    sort: 410,
    labels: { zh: "AC", en: "Armored Core", ja: "AC", ko: "AC" },
    universe: "Armored Core",
    pattern: /Armored Core|ARMORED CORE|アーマード・コア|アーマードコア/i,
  },
  {
    key: "beyblade_limited",
    sort: 420,
    labels: { zh: "限定", en: "Limited", ja: "限定", ko: "한정" },
    universe: "BEYBLADE X",
    pattern: /限定|イベント|B4ストア|タカラトミーモール|メタルコート|Ver\./i,
  },
  {
    key: "beyblade_bx",
    sort: 421,
    labels: { zh: "BX", en: "BX", ja: "BX", ko: "BX" },
    universe: "BEYBLADE X",
    pattern: /^BX-/i,
  },
  {
    key: "beyblade_ux",
    sort: 422,
    labels: { zh: "UX", en: "UX", ja: "UX", ko: "UX" },
    universe: "BEYBLADE X",
    pattern: /^UX-/i,
  },
  {
    key: "beyblade_cx",
    sort: 423,
    labels: { zh: "CX", en: "CX", ja: "CX", ko: "CX" },
    universe: "BEYBLADE X",
    pattern: /^CX-/i,
  },
  {
    key: "option",
    sort: 900,
    labels: { zh: "配件", en: "Option", ja: "オプション", ko: "옵션" },
    universe: "Accessory",
    pattern: /Accessory|Option Set|武器セット|武装セット|オプション|パーツセット|バックパックセット|台座|スタンド|ファンネル|シルエット/i,
  },
  {
    key: "mixed",
    sort: 910,
    labels: { zh: "混合", en: "Mixed", ja: "複合作品", ko: "혼합" },
    universe: "Mixed",
    pattern: /Mixed Gundam Works|SELECTION|MEMORIAL|OPERATION|REVIVE|セット|SET/i,
  },
];

const DEFAULT_SERIES = {
  key: "other",
  sort: 999,
  labels: { zh: "其他", en: "Other", ja: "その他", ko: "기타" },
  universe: "unknown",
};

const NON_GUNDAM_SERIES_KEYS = new Set(["pokemon", "armored_core", "beyblade_limited", "beyblade_bx", "beyblade_ux", "beyblade_cx"]);

function isGundamSeries(series) {
  return !NON_GUNDAM_SERIES_KEYS.has(series.key);
}

const TITLE_PRIORITY_SERIES = new Set([
  "seed",
  "double_o",
  "w",
  "ibo",
  "witch",
  "gqux",
  "zeta",
  "zz",
  "cca",
  "unicorn",
  "hathaway",
  "f91",
  "victory",
  "g",
  "x",
  "turn_a",
  "g_reco",
  "age",
  "aoz",
  "narrative",
  "moon",
  "origin",
  "sentinel",
  "crossbone",
  "thunderbolt",
  "0083",
  "0080",
  "08ms",
  "msv",
]);

const GUNDAM_WORK_UNIT_RULES = [
  { key: "build", pattern: /HGBF|HGBD|HGBD:R|Gundam Build|Build Fighters|Build Divers|Build Metaverse|ビルド|ダイバー|コアガンダム|アースリィ|マーズフォー|ヴィートルー|メルクワン|ユーラヴェン|ネプテイト|プルタイン|ラーガンダム|ベアッガイ|プチッガイ|ふみな|トライオン|アメイジング|フェニーチェ|スクランブル|ティフォエウス|AGEIIマグナム/i },
  { key: "sangoku", pattern: /三国|三國|三国創傑伝|三国伝|SDW HEROES.*(?:関羽|孫権|曹操|劉備|諸葛亮|司馬懿|呂布|張飛|趙雲|貂蝉|馬超|黄忠|董卓|信長|悟空|三蔵|佐助|才蔵|軍馬)/i },
  { key: "crossbone", pattern: /Crossbone|クロスボーン|ガンダムX-?1|ガンダムX-?2|ガンダムX-?3|フルクロス|ゴーストガンダム|ファントムガンダム|アンカーガンダム/i },
  { key: "sentinel", pattern: /Sentinel|Sガンダム|Ex-S|FAZZ|Zプラス|ゼータプラス|ディープストライカー|ガンダムMk-V|ゼク・アイン/i },
  { key: "narrative", pattern: /Mobile Suit Gundam Narrative|Narrative Gundam|機動戦士ガンダムNT|ナラティブガンダム|フェネクス|シナンジュ・スタイン.*(?:NT|ナラティブ)|ナラティブ Ver/i },
  { key: "moon", pattern: /Moon Gundam|ムーンガンダム|バルギル/i },
  { key: "origin", pattern: /THE ORIGIN|オリジン|局地型ガンダム|ブグ|ザクI(?!I)|ザク・ハーフキャノン|シャア専用ザクII.*ORIGIN/i },
  { key: "gqux", pattern: /GQuuuuuuX|ジークアクス|GFreD|白いガンダム|赤いガンダム|軽キャノン|\(GQ\)|（GQ）|シャリア専用リック・ドム\(GQ\)|ザク\(GQ\)/i },
  { key: "seed", pattern: /SEED|DESTINY|FREEDOM|ASTRAY|STARGAZER|スターゲイザー|ライジングフリーダム|イモータルジャスティス|マイティーストライクフリーダム|ストライクフリーダム|インフィニットジャスティス|デスティニー|インパルス|アカツキ|ストライク|イージス|デュエル|バスター|ブリッツ|プロヴィデンス|カラミティ|フォビドゥン|レイダー|アストレイ|ブラックナイトスコード|ジン|シグー|ゲイツ|ウィンダム|ムラサメ|ソードストライカー|ランチャーストライカー|エールストライカー|ストライカーパック|プラウドディフェンダー|アークエンジェル/i },
  { key: "double_o", pattern: /Gundam 00(?![0-9])|ガンダム00(?![0-9])|ダブルオー|00クアンタ|クアンタ|エクシア|デュナメス|キュリオス|ヴァーチェ|ナドレ|アストレア|ケルディム|アリオス|セラヴィー|セラフィム|オーライザー|ジンクス|ティエレン|スサノオ|フラッグ|スローネ|アルケー|アヘッド|ガデッサ|ガラッゾ|リボーンズ|ブレイヴ|GNアームズ|1\.5（アイズ）|1\.5ガンダム/i },
  { key: "w", pattern: /Gundam Wing|ガンダムW|Endless Waltz|\bEW\b|G-UNIT|ウイング|デスサイズ|ヘビーアームズ|サンドロック|シェンロン|アルトロン|トールギス|エピオン|リーオー|マグアナック|ヴァイエイト|メリクリウス|エアリーズ|ジェミナス|グリープ|ヒイロ・ユイ/i },
  { key: "ibo", pattern: /Iron-Blooded Orphans|鉄血|バルバトス|グシオン|キマリス|グレイズ|フラウロス|バエル|ヴィダール|百里|百錬|マンロディ|ロディ|マルコシアス|アスタロト|ダンタリオン|レギンレイズ|グリムゲルデ/i },
  { key: "witch", pattern: /Witch from Mercury|水星の魔女|エアリアル|ルブリス|キャリバーン|ファラクト|ディランザ|デミ|ベギル|ミカエリス|シュバルゼッテ|ガンヴォルヴァ|ザウォート|ダリルバルデ|グエル・ジェターク/i },
  { key: "cca", pattern: /Char's Counterattack|逆襲のシャア|ベルトーチカ・チルドレン|νガンダム|Hi-ν|サザビー|ナイチンゲール|ヤクト・ドーガ|ギラ・ドーガ|α・アジール|リ・ガズィ|ジェガン|ハイパー・メガ・バズーカ・ランチャー/i },
  { key: "hathaway", pattern: /Hathaway|閃光のハサウェイ|Ξガンダム|クスィーガンダム|ペーネロペー|メッサー|グスタフ・カール/i },
  { key: "thunderbolt", pattern: /Thunderbolt|サンダーボルト|フルアーマー・ガンダム|サイコ・ザク|アトラスガンダム/i },
  { key: "0083", pattern: /0083|Stardust Memory|GP0[123]|ガーベラ|デンドロビウム|ステイメン|ノイエ・ジール|ドラッツェ|ザメル/i },
  { key: "0080", pattern: /0080|War in the Pocket|アレックス|NT-1|ケンプファー|ハイゴッグ|ズゴックE|ザクII改/i },
  { key: "08ms", pattern: /08th MS Team|08小隊|Ez-8|陸戦型|グフカスタム/i },
  { key: "zz", pattern: /ZZ|ダブルゼータ|フルアーマーZZ|強化型ZZ|クィン・マンサ|キュベレイ|ドーベン・ウルフ|ザクIII|バウ|ドライセン|ズサ|ハンマ・ハンマ|ゲーマルク/i },
  { key: "zeta", pattern: /Zガンダム|Ζ|ゼータガンダム|ZII|サイコ・ガンダム|ガンダムMk-II|ガンダムMk-Ⅱ|百式|リック・ディアス|メタス|ネモ|ハイザック|マラサイ|バーザム|ギャプラン|アッシマー|ジ・O|ディジェ/i },
  { key: "g", pattern: /Mobile Fighter G Gundam|Gガンダム|ゴッドガンダム|シャイニングガンダム|マスターガンダム|ノーベルガンダム|ドラゴンガンダム|ガンダムローズ|マックスター|マンダラガンダム|デビルガンダム|クーロンガンダム|風雲再起/i },
  { key: "g_reco", pattern: /Reconguista|Gのレコンギスタ|G-セルフ|Ｇ-セルフ|G-アルケイン|G-ルシファー|グリモア|マックナイフ|ジャハナム|カバカーリー/i },
  { key: "x", pattern: /Gundam X(?!-?[123])|ガンダムX(?!-?[123])|ガンダムダブルエックス|ダブルエックス|エアマスター|レオパルド|ベルティゴ|ヴァサーゴ|Gファルコン/i },
];

const REPLACEMENTS = {
  en: [
    ["機動戦士ガンダム", "Mobile Suit Gundam"],
    ["新機動戦記ガンダムW", "New Mobile Report Gundam Wing"],
    ["鉄血のオルフェンズ", "Iron-Blooded Orphans"],
    ["水星の魔女", "The Witch from Mercury"],
    ["逆襲のシャア", "Char's Counterattack"],
    ["ベルトーチカ・チルドレン", "Beltorchika's Children"],
    ["ポケットの中の戦争", "War in the Pocket"],
    ["閃光のハサウェイ", "Hathaway"],
    ["三国創傑伝", "Sangoku Soketsuden"],
    ["三国伝", "Sangokuden"],
    ["マイティーストライクフリーダム", "Mighty Strike Freedom"],
    ["ストライクフリーダム", "Strike Freedom"],
    ["インフィニットジャスティス", "Infinite Justice"],
    ["イモータルジャスティス", "Immortal Justice"],
    ["ライジングフリーダム", "Rising Freedom"],
    ["プロヴィデンス", "Providence"],
    ["デスティニー", "Destiny"],
    ["インパルス", "Impulse"],
    ["フリーダム", "Freedom"],
    ["ジャスティス", "Justice"],
    ["ストライク", "Strike"],
    ["イージス", "Aegis"],
    ["デュエル", "Duel"],
    ["バスター", "Buster"],
    ["ブリッツ", "Blitz"],
    ["アストレイ", "Astray"],
    ["アカツキ", "Akatsuki"],
    ["ウイング", "Wing"],
    ["デスサイズ", "Deathscythe"],
    ["ヘビーアームズ", "Heavyarms"],
    ["サンドロック", "Sandrock"],
    ["シェンロン", "Shenlong"],
    ["トールギス", "Tallgeese"],
    ["エピオン", "Epyon"],
    ["エクシア", "Exia"],
    ["デュナメス", "Dynames"],
    ["キュリオス", "Kyrios"],
    ["ヴァーチェ", "Virtue"],
    ["ナドレ", "Nadleeh"],
    ["アストレア", "Astraea"],
    ["ケルディム", "Cherudim"],
    ["アリオス", "Arios"],
    ["セラヴィー", "Seravee"],
    ["セラフィム", "Seraphim"],
    ["クアンタ", "Qan[T]"],
    ["バルバトス", "Barbatos"],
    ["グシオン", "Gusion"],
    ["キマリス", "Kimaris"],
    ["グレイズ", "Graze"],
    ["バエル", "Bael"],
    ["ヴィダール", "Vidar"],
    ["マルコシアス", "Marchosias"],
    ["ユニコーン", "Unicorn"],
    ["バンシィ", "Banshee"],
    ["フェネクス", "Phenex"],
    ["シナンジュ", "Sinanju"],
    ["クシャトリヤ", "Kshatriya"],
    ["サザビー", "Sazabi"],
    ["ナイチンゲール", "Nightingale"],
    ["ケンプファー", "Kampfer"],
    ["キュベレイ", "Qubeley"],
    ["ガンダムMk-II", "Gundam Mk-II"],
    ["百式", "Hyaku Shiki"],
    ["ジ・O", "The O"],
    ["ゼータ", "Zeta"],
    ["ダブルゼータ", "Double Zeta"],
    ["ブルーディスティニー", "Blue Destiny"],
    ["クロスボーン", "Crossbone"],
    ["ガンダム", "Gundam"],
    ["ザク", "Zaku"],
    ["グフ", "Gouf"],
    ["ドム", "Dom"],
    ["ゲルググ", "Gelgoog"],
    ["ジム", "GM"],
    ["ボール", "Ball"],
    ["シャア専用", "Char's Custom"],
    ["量産型", "Mass Production Type"],
    ["高機動型", "High Mobility Type"],
    ["専用", "Custom"],
    ["オプションセット", "Option Set"],
    ["オプションパーツセット", "Option Parts Set"],
    ["拡張セット", "Expansion Set"],
    ["武器セット", "Weapon Set"],
    ["武装セット", "Armament Set"],
    ["パーツセット", "Parts Set"],
    ["台座セット", "Base Set"],
    ["スタンドセット", "Stand Set"],
    ["セット", "Set"],
    ["限定", "Limited"],
    ["抽選販売", "Lottery Sale"],
    ["プレミアムバンダイ", "Premium Bandai"],
    ["発売分", "Release"],
    ["発送分", "Shipping Batch"],
    ["仕様", "Type"],
    ["重塗装", "Heavy Paint"],
    ["塗装", "Paint"],
    ["クリアカラー", "Clear Color"],
    ["リアルタイプ", "Real Type"],
    ["アニメカラー", "Anime Color"],
    ["ハードポイント", "Hardpoint"],
    ["装備", "Equipment"],
    ["発動", "Activated"],
    ["再販", "Reissue"],
    ["リバイバル版", "Revival Ver."],
    ["最終決戦", "Final Battle"],
    ["二次", "Second"],
    ["2次", "Second"],
    ["初音ミク", "Hatsune Miku"],
    ["ポケモン", "Pokemon"],
    ["プラモデル", "Model Kit"],
    ["ガシャポン", "Gashapon"],
    ["ガシャポン戦士", "Gashapon Senshi"],
    ["アーマード・コア", "Armored Core"],
    ["アーマードコア", "Armored Core"],
  ],
  zh: [
    ["機動戦士ガンダム", "机动战士高达"],
    ["新機動戦記ガンダムW", "新机动战记高达W"],
    ["鉄血のオルフェンズ", "铁血孤儿"],
    ["水星の魔女", "水星的魔女"],
    ["逆襲のシャア", "逆袭的夏亚"],
    ["ベルトーチカ・チルドレン", "贝托蒂嘉的子嗣"],
    ["ポケットの中の戦争", "口袋里的战争"],
    ["閃光のハサウェイ", "闪光的哈萨维"],
    ["三国創傑伝", "三国创杰传"],
    ["三国伝", "三国传"],
    ["マイティーストライクフリーダム", "威能强袭自由"],
    ["ストライクフリーダム", "强袭自由"],
    ["インフィニットジャスティス", "无限正义"],
    ["イモータルジャスティス", "不朽正义"],
    ["ライジングフリーダム", "升腾自由"],
    ["プロヴィデンス", "天帝"],
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
    ["セラフィム", "炽天使"],
    ["クアンタ", "量子型"],
    ["バルバトス", "巴巴托斯"],
    ["グシオン", "古辛"],
    ["キマリス", "锡蒙利"],
    ["グレイズ", "格雷兹"],
    ["バエル", "巴耶力"],
    ["ヴィダール", "维达尔"],
    ["マルコシアス", "马可西亚斯"],
    ["ユニコーン", "独角兽"],
    ["バンシィ", "报丧女妖"],
    ["フェネクス", "菲尼克斯"],
    ["シナンジュ", "新安洲"],
    ["クシャトリヤ", "刹帝利"],
    ["サザビー", "沙扎比"],
    ["ナイチンゲール", "夜莺"],
    ["ケンプファー", "京宝梵"],
    ["キュベレイ", "卡碧尼"],
    ["ガンダムMk-II", "高达Mk-II"],
    ["百式", "百式"],
    ["ジ・O", "The O"],
    ["ゼータ", "Zeta"],
    ["ダブルゼータ", "ZZ"],
    ["ブルーディスティニー", "蓝色命运"],
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
    ["オプションセット", "选配套装"],
    ["オプションパーツセット", "选配零件套装"],
    ["拡張セット", "扩展套装"],
    ["武器セット", "武器套装"],
    ["武装セット", "武装套装"],
    ["パーツセット", "零件套装"],
    ["台座セット", "底座套装"],
    ["スタンドセット", "支架套装"],
    ["セット", "套装"],
    ["限定", "限定"],
    ["抽選販売", "抽选贩售"],
    ["プレミアムバンダイ", "Premium Bandai"],
    ["発売分", "发售批次"],
    ["発送分", "发货批次"],
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
    ["二次", "第二批"],
    ["2次", "第二批"],
    ["初音ミク", "初音未来"],
    ["ポケモン", "宝可梦"],
    ["Pokemon", "宝可梦"],
    ["Pokémon", "宝可梦"],
    ["プラモデル", "拼装模型"],
    ["Model Kit", "拼装模型"],
    ["ガシャポン", "扭蛋"],
    ["Gashapon", "扭蛋"],
    ["ガシャポン戦士", "扭蛋战士"],
    ["アーマード・コア", "装甲核心"],
    ["アーマードコア", "装甲核心"],
    ["Armored Core", "装甲核心"],
  ],
  ko: [
    ["機動戦士ガンダム", "기동전사 건담"],
    ["新機動戦記ガンダムW", "신기동전기 건담W"],
    ["鉄血のオルフェンズ", "철혈의 오펀스"],
    ["水星の魔女", "수성의 마녀"],
    ["逆襲のシャア", "역습의 샤아"],
    ["ベルトーチカ・チルドレン", "벨토치카 칠드런"],
    ["ポケットの中の戦争", "주머니 속의 전쟁"],
    ["閃光のハサウェイ", "섬광의 하사웨이"],
    ["三国創傑伝", "삼국창걸전"],
    ["三国伝", "삼국전"],
    ["マイティーストライクフリーダム", "마이티 스트라이크 프리덤"],
    ["ストライクフリーダム", "스트라이크 프리덤"],
    ["インフィニットジャスティス", "인피니트 저스티스"],
    ["イモータルジャスティス", "이모탈 저스티스"],
    ["ライジングフリーダム", "라이징 프리덤"],
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
    ["セラフィム", "세라핌"],
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
    ["百式", "백식"],
    ["ジ・O", "디 오"],
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
    ["オプションセット", "옵션 세트"],
    ["オプションパーツセット", "옵션 파츠 세트"],
    ["拡張セット", "확장 세트"],
    ["武器セット", "무기 세트"],
    ["武装セット", "무장 세트"],
    ["パーツセット", "파츠 세트"],
    ["台座セット", "베이스 세트"],
    ["スタンドセット", "스탠드 세트"],
    ["セット", "세트"],
    ["限定", "한정"],
    ["抽選販売", "추첨 판매"],
    ["プレミアムバンダイ", "프리미엄 반다이"],
    ["発売分", "발매분"],
    ["発送分", "배송분"],
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
    ["二次", "2차"],
    ["2次", "2차"],
    ["初音ミク", "하츠네 미쿠"],
    ["ポケモン", "포켓몬"],
    ["Pokemon", "포켓몬"],
    ["Pokémon", "포켓몬"],
    ["プラモデル", "프라모델"],
    ["Model Kit", "프라모델"],
    ["ガシャポン", "가샤폰"],
    ["Gashapon", "가샤폰"],
    ["ガシャポン戦士", "가샤폰 전사"],
    ["アーマード・コア", "아머드 코어"],
    ["アーマードコア", "아머드 코어"],
    ["Armored Core", "아머드 코어"],
  ],
  ja: [
    ["Pokemon", "ポケモン"],
    ["Pokémon", "ポケモン"],
    ["Model Kit", "プラモデル"],
    ["Quick!!", "クイック!!"],
    ["Gashapon", "ガシャポン"],
    ["Armored Core", "アーマード・コア"],
  ],
};

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => HTML_ENTITY_MAP[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanupName(value, lang) {
  let text = decodeHtml(value)
    .replace(/＜SIDE MS＞\s*/g, "")
    .replace(/<SIDE MS>\s*/gi, "")
    .replace(/【([^】]+)】/g, lang === "en" ? "[$1]" : "【$1】")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .replace(/\s+([)\]】])/g, "$1")
    .replace(/([(\[【])\s+/g, "$1")
    .trim();

  if (lang === "en") {
    text = text
      .replace(/・/g, " ")
      .replace(/～/g, " - ")
      .replace(/（/g, " (")
      .replace(/）/g, ")")
      .replace(/([A-Za-z0-9\]])Gundam/g, "$1 Gundam")
      .replace(/Gundam([A-Za-z0-9])/g, "Gundam $1")
      .replace(/([A-Za-z0-9])\[/g, "$1 [")
      .replace(/専用/g, "Custom")
      .replace(/\s+/g, " ")
      .trim();
  }

  return text;
}

function translateName(baseName, lang) {
  let text = cleanupName(baseName, lang);
  const replacements = [...(REPLACEMENTS[lang] ?? [])].sort((a, b) => b[0].length - a[0].length);
  for (const [source, target] of replacements) {
    text = text.replace(new RegExp(escapeRegExp(source), "g"), target);
  }

  if (lang === "zh") {
    text = text.replace(/\bCORE\b/g, "CORE").replace(/\bSet\b/g, "套装");
  }
  if (lang === "ko") {
    text = text.replace(/\bCORE\b/g, "CORE").replace(/\bSet\b/g, "세트");
  }
  if (lang === "en") {
    text = text.replace(/ガンダム/g, "Gundam");
  }

  return cleanupName(text, lang) || cleanupName(baseName, lang);
}

function sourceName(kit) {
  const names = kit.names ?? {};
  return decodeHtml(names.ja || names.en || names.zh || names.ko || kit.kit_id);
}

function seriesForKit(kit) {
  if (kit.franchise === "pokemon") {
    return SERIES.find((series) => series.key === "pokemon");
  }
  if (kit.franchise === "armored_core") {
    return SERIES.find((series) => series.key === "armored_core");
  }
  if (kit.franchise === "beyblade") {
    const text = [kit.names?.ja, kit.names?.en, kit.names?.zh, kit.names?.ko, kit.subline, ...(kit.tags ?? [])].map(decodeHtml).join(" ");
    if (kit.is_limited || SERIES.find((series) => series.key === "beyblade_limited").pattern.test(text)) {
      return SERIES.find((series) => series.key === "beyblade_limited");
    }
    if (/^UX-/i.test(text)) {
      return SERIES.find((series) => series.key === "beyblade_ux");
    }
    if (/^CX-/i.test(text)) {
      return SERIES.find((series) => series.key === "beyblade_cx");
    }
    return SERIES.find((series) => series.key === "beyblade_bx");
  }

  const names = kit.names ?? {};
  const titleText = [names.ja, names.en, names.zh, names.ko].map(decodeHtml).join(" ");
  const classificationText = [titleText, kit.subline, kit.grade_code, ...(kit.tags ?? [])].map(decodeHtml).join(" ");
  const workText = [kit.work_title, kit.universe].map(decodeHtml).join(" ");
  const gundamSeries = SERIES.filter(isGundamSeries);
  const sangoku = gundamSeries.find((series) => series.key === "sangoku");
  if (sangoku.pattern.test(classificationText)) {
    return sangoku;
  }

  const unitMatch = GUNDAM_WORK_UNIT_RULES.find((rule) => rule.pattern.test(classificationText));
  if (unitMatch) {
    return gundamSeries.find((series) => series.key === unitMatch.key) ?? DEFAULT_SERIES;
  }

  const titleMatch = gundamSeries.find((series) => TITLE_PRIORITY_SERIES.has(series.key) && series.pattern.test(titleText));
  if (titleMatch) {
    return titleMatch;
  }

  const workMatch = gundamSeries.find((series) => series.pattern.test(workText));
  if (workMatch) {
    return workMatch;
  }

  return gundamSeries.find((series) => series.pattern.test(classificationText)) ?? DEFAULT_SERIES;
}

function workTitleForSeries(series, kit) {
  if (!series || series.key === "other") {
    return kit.work_title || null;
  }
  return series.labels?.en || series.labels?.zh || series.key;
}

function localizeKit(kit) {
  const baseName = sourceName(kit);
  const names = {
    ja: translateName(kit.names?.ja || baseName, "ja"),
    en: translateName(kit.names?.en || baseName, "en"),
    zh: translateName(kit.names?.zh || baseName, "zh"),
    ko: translateName(kit.names?.ko || baseName, "ko"),
  };
  const series = seriesForKit({ ...kit, names });

  return {
    ...kit,
    names,
    series: {
      key: series.key,
      sort: series.sort,
      labels: series.labels,
    },
    universe: series.universe || kit.universe || null,
    work_title: workTitleForSeries(series, kit),
  };
}

const catalog = JSON.parse(await readFile(CATALOG_FILE, "utf8"));
const kits = catalog.kits.map(localizeKit);
const missingNames = kits.filter((kit) => ["ja", "en", "zh", "ko"].some((lang) => !kit.names?.[lang]));
const missingSeries = kits.filter((kit) => !kit.series?.key);

if (missingNames.length || missingSeries.length) {
  throw new Error(`Localization incomplete: missing names ${missingNames.length}, missing series ${missingSeries.length}`);
}

await writeFile(CATALOG_FILE, `${JSON.stringify({ ...catalog, kits }, null, 2)}\n`, "utf8");
console.log(`Localized ${kits.length} records with four-language names and compact series labels.`);
