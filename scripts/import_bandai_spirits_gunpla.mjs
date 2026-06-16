import { readFile, writeFile } from "node:fs/promises";

const BASE_URL = "https://www.bandaispirits.co.jp";
const SOURCE_ID = "bandai_spirits_products_jp";
const RESULT_PATH = "/products/search/result.php";
const FIRST_PAGE_URL = `${BASE_URL}${RESULT_PATH}?search=true&free=&category=1`;

const EXCLUDED_TITLE_PATTERNS = [
  /ガンダムデカール/,
  /デカール/,
  /オプションパーツ/,
  /ビルダーズパーツ/,
  /アクションベース/,
  /カスタマイズ/,
  /ウェポン/,
  /エフェクトパーツ/,
  /マーキングシール/,
  /LEDユニット/,
  /工具/,
  /塗料/,
];

const GRADE_RULES = [
  { code: "PGU", subline: "PG Unleashed", pattern: /^PG\s+UNLEASHED\b/i },
  { code: "MGEX", subline: "MGEX", pattern: /^MGEX\b/i },
  { code: "MGSD", subline: "MGSD", pattern: /^MGSD\b/i },
  { code: "RE100", subline: "RE/100", pattern: /^RE\/100\b/i },
  { code: "FM", subline: "Full Mechanics", pattern: /^(?:FULL MECHANICS|1\/100\s+FULL MECHANICS)\b/i },
  { code: "HIRM", subline: "Hi-Resolution Model", pattern: /^Hi-Resolution Model\b/i },
  { code: "PG", subline: "PG", pattern: /^PG\b/i },
  { code: "RG", subline: "RG", pattern: /^RG\b/i },
  { code: "MG", subline: "MG", pattern: /^MG\b/i },
  { code: "EG", subline: "Entry Grade", pattern: /^(?:ENTRY GRADE|EG)\b/i },
  { code: "HG", subline: null, pattern: /^HG(?:UC|AC|CE|FC|AW|CC|BD(?::R)?|GBB|GTO|IBO|WFM|UC|UC|AGE|BUILD|GQuuuuuuX)?\b/i },
  { code: "SDEX", subline: "SD EX-Standard", pattern: /^(?:SDEX|SDガンダム\s*EXスタンダード|SDガンダム\s*EX-STANDARD)\b/i },
  { code: "SDCS", subline: "SD Cross Silhouette", pattern: /^(?:SDCS|SDガンダム\s*クロスシルエット)\b/i },
  { code: "SDW", subline: "SD Gundam World", pattern: /^(?:SDW|SDガンダムワールド|SDガンダム\s*ワールドヒーローズ)\b/i },
  { code: "SD", subline: "SD", pattern: /^(?:BB戦士|SDガンダム|SD 三国創傑伝)\b/i },
  { code: "HAROPLA", subline: "HaroPla", pattern: /^(?:ハロプラ|HAROPLA)\b/i },
  { code: "MEGA", subline: "Mega Size Model", pattern: /^(?:メガサイズモデル|MEGA SIZE MODEL)\b/i },
  { code: "UCHG", subline: "U.C. Hard Graph", pattern: /^(?:U\.C\.ハードグラフ|U\.C\. HARD GRAPH)\b/i },
  { code: "EX", subline: "EX Model", pattern: /^(?:EXモデル|EX MODEL)\b/i },
  { code: "FG", subline: "First Grade", pattern: /^(?:FG|FIRST GRADE)\b/i },
  { code: "AG", subline: "Advanced Grade", pattern: /^(?:AG|ADVANCED GRADE)\b/i },
  { code: "BMC", subline: "Best Mecha Collection", pattern: /^(?:ベストメカコレクション|BEST MECHA COLLECTION)\b/i },
  { code: "HY2M", subline: "HY2M", pattern: /^HY2M\b/i },
  { code: "LM", subline: "Limited Model", pattern: /^(?:LM|LIMITED MODEL)\b/i },
  { code: "NG", subline: "No Grade", pattern: /^(?:1\/144|1\/100|1\/60|1\/550)\b/i },
];

const GRADE_PREFIX_ORDER = ["PGU", "MGEX", "MGSD", "RE100", "HIRM", "MEGA", "HAROPLA", "UCHG", "SDEX", "SDCS", "SDW"];

const DEFAULT_SCALE_BY_GRADE = {
  AG: "1/144",
  BMC: "1/144",
  EG: "1/144",
  FG: "1/144",
  FM: "1/100",
  HG: "1/144",
  HIRM: "1/100",
  MG: "1/100",
  MGEX: "1/100",
  PG: "1/60",
  PGU: "1/60",
  RE100: "1/100",
  RG: "1/144",
  SG: "1/200",
};

const WORK_RULES = [
  { title: "Mobile Suit Gundam SEED Freedom", universe: "CE", pattern: /ライジングフリーダム|イモータルジャスティス|マイティーストライクフリーダム|ブラックナイトスコード|ゲルググメナース|ギャンシュトローム|SEED FREEDOM/i },
  { title: "Mobile Suit Gundam SEED Eclipse", universe: "CE", pattern: /エクリプスガンダム|SEED ECLIPSE/i },
  { title: "Mobile Suit Gundam SEED C.E.73 Stargazer", universe: "CE", pattern: /スターゲイザー|ストライクノワール|ヴェルデバスター|ブルデュエル|ドレッドノート|シグーディープアームズ|105ダガー|スローターダガー|ケルベロスバクゥ|シビリアンアストレイ|ストライクE/i },
  { title: "Mobile Suit Gundam SEED Destiny", universe: "CE", pattern: /デスティニー|インパルス|ストライクフリーダム|インフィニットジャスティス|セイバーガンダム|ガイアガンダム|アビスガンダム|カオスガンダム|ブレイズザク|ザクウォーリア|ザクファントム|グフイグナイテッド|レジェンドガンダム|アカツキ|ムラサメ|デストロイ|ウィンダム|ダガーL|DESTINY/i },
  { title: "Mobile Suit Gundam SEED Astray", universe: "CE", pattern: /アストレイ|ASTRAY|レッドフレーム|ブルーフレーム|ゴールドフレーム/i },
  { title: "Mobile Suit Gundam SEED", universe: "CE", pattern: /SEED|ストライクガンダム|ストライクルージュ|エールストライク|スカイグラスパー|イージス|デュエル|バスター|ブリッツ|フリーダムガンダム|ジャスティスガンダム|プロヴィデンス|カラミティ|フォビドゥン|レイダー|ハイペリオンガンダム|ストライクダガー|モビルディン|モビルグーン|モビルスーツゲイツ|ラゴゥ|バクゥ|シグー|M1アストレイ|モビルジン|ジンハイマニューバ|ジン タイプ インサージェント/i },
  { title: "Mobile Suit Gundam 00", universe: "AD", pattern: /ガンダム00|ダブルオー|エクシア|デュナメス|キュリオス|ヴァーチェ|ナドレ|アストレア|ケルディム|アリオス|セラヴィー|セラフィム|オーライザー|トランザムライザー|クアンタ|ジンクス|ティエレン|スサノオ|フラッグ|GN-|スローネ|アルケー|アヘッド|イナクト|ガデッサ|ガラッゾ|マスラオ|リボーンズ|ハルート|サバーニャ|ラファエル|ブレイヴ|1\.5|アイズ|オーガンダム|ガッデス|GNアーチャー/i },
  { title: "Mobile Suit Gundam: The Witch from Mercury", universe: "Ad Stella", pattern: /水星の魔女|エアリアル|ルブリス|キャリバーン|ファラクト|ディランザ|デミ|ベギル|ミカエリス|ガンダムシュバルゼッテ|ガンヴォルヴァ|ハインドリー|ザウォート|ティックバラン|ミラソウル|ダリルバルデ/i },
  { title: "Mobile Suit Gundam GQuuuuuuX", universe: "unknown", pattern: /GQuuuuuuX|ジークアクス|アリュゼウス|白いガンダム|赤いガンダム|GFreD|エグザベ|軽キャノン|ガンダムザガン|ガンダムジリウス/i },
  { title: "Mobile Suit Gundam: Iron-Blooded Orphans", universe: "Post Disaster", pattern: /鉄血|バルバトス|グシオン|キマリス|グレイズ|フラウロス|バエル|ヴィダール|百里|百錬|マンロディ|モンキーロディ|ロディ|ジークルーネ|シュヴァルベ|マルコシアス|アスモデウス|端白星|グレモリー|アスタロト|ダンタリオン|ウヴァル|レギンレイズ|ヘルムヴィーゲ|漏影|辟邪|ハシュマル|獅電|ゲイレール|ユーゴー|グリムゲルデ|MSオプションセット|モビルワーカー/i },
  { title: "Mobile Suit Gundam AGE", universe: "AG", pattern: /ガンダムAGE|AGE-|ガフラン|ゼダス|Gエグゼス|ジェノアス|ダナジン|レギルス|ギラーガ|ゼイドラ|バクト|ドラド|ファルシア|シャルドール|クランシェ|アデル|クロノス|Gサイフォス/i },
  { title: "New Mobile Report Gundam Wing: G-Unit", universe: "AC", pattern: /ガンダムグリープ|ジェミナス|アスクレプオス|ハイドラガンダム|エルオーブースター/i },
  { title: "Mobile Suit Gundam Wing Endless Waltz", universe: "AC", pattern: /Endless Waltz|\bEW\b|ウイングガンダムゼロ|Wガンダムゼロカスタム|ウイングゼロカスタム|ヘビーアームズ改|サンドロック改|デスサイズヘル|アルトロン|ナタク|サーペント/i },
  { title: "Mobile Suit Gundam Wing", universe: "AC", pattern: /ウイングガンダム|デスサイズ|ヘビーアームズ|サンドロック|シェンロン|トールギス|エピオン|リーオー|マグアナック|ヴァイエイト|メリクリウス/i },
  { title: "Mobile Fighter G Gundam", universe: "FC", pattern: /Gガンダム|Ｇガンダム|ゴッドガンダム|シャイニングガンダム|マスターガンダム|ノーベルガンダム|ライジングガンダム|ボルトガンダム|ガンダムシュピーゲル|ドラゴンガンダム|ガンダムローズ|マックスター|マンダラガンダム|デビルガンダム|デスアーミー/i },
  { title: "After War Gundam X", universe: "AW", pattern: /ガンダムX|ガンダムダブルエックス|ガンダムエアマスター|ガンダムレオパルド|ベルティゴ|ガンダムヴァサーゴ|ガンダムアシュタロン/i },
  { title: "Turn A Gundam", universe: "CC", pattern: /∀|ターンエー|ターンX|スモー|カプル/i },
  { title: "Gundam Reconguista in G", universe: "Regild Century", pattern: /Gのレコンギスタ|G-セルフ|G-アルケイン|G-ルシファー|カットシー|ジャイオーン|モンテーロ|グリモア(?!レッドベレー)|マックナイフ|ジャハナム|ジャスティマ|ダハック|エルフ・ブルック|カバカーリー/i },
  { title: "Gundam Build Series", universe: "Build", pattern: /HGBD|HGBD:R|ビルド|ビギニング|ベアッガイ|すーぱーふみな|ふみな|トライオン|ダイバー|リライジング|コアガンダム|プチッガイ|ウォドムポッド|ユーラヴェン|エルドラ|テルティウム|アースリィ|ジュピターヴ|メルクワン|ネプテイト|サタニクス|ゼルトザーム|ジャスティスナイト|TRYAGE|ν-ジオン|G-エルス|ラヴファントム|シャイニングブレイク|グリモアレッドベレー|ブレイジングガンダム|ヘリオス|リヴランスヘブン|バルバタウロス|神バーニング|ティフォエウス|プルタイン|ラーガンダム|ザラキエル|トロハチ|アメイジング|フェニーチェ|スクランブル|トライバーニング|クロスボーンガンダム魔王|ユニバースブースター|Ez-SR|フォーエバーガンダム|ガンプラスターターセット|ガンプラバトル/i },
  { title: "Gundam EXA", universe: "unknown", pattern: /エクストリームガンダム/i },
  { title: "Advance of Zeta", universe: "UC", pattern: /ADVANCE OF Z|A\.O\.Z|TR-1|TR-6|ヘイズル|ウーンドウォート|ハイゼンスレイ|フルドド|ホビー・ハイザック/i },
  { title: "Mobile Suit Gundam Narrative", universe: "UC", pattern: /ナラティブガンダム|ガンダムNT/i },
  { title: "Mobile Suit Moon Gundam", universe: "UC", pattern: /ムーンガンダム|バルギル/i },
  { title: "Gundam Sentinel", universe: "UC", pattern: /Sガンダム|Ｓガンダム|スペリオルガンダム|Ex-S|FAZZ|ＦＡＺＺ|ゼータプラス|Zプラス|ディープストライカー|ゼク・アイン|ゼクアイン|ネロ/i },
  { title: "Mobile Suit Crossbone Gundam", universe: "UC", pattern: /クロスボーン|ゴーストガンダム|ファントムガンダム/i },
  { title: "Mobile Suit Gundam F90/MSV", universe: "UC", pattern: /ガンダムF90|ガンダムF-90|F90III|ミッションパック|ガンダム4号機|ガンダム5号機|ガンダム7号機/i },
  { title: "Mobile Suit Gundam Side Story: The Blue Destiny", universe: "UC", pattern: /ブルーディスティニー|イフリート改|ペイルライダー|ユウ・カジマ/i },
  { title: "Mobile Suit Gundam Side Story: Missing Link", universe: "UC", pattern: /イフリート・シュナイド|スレイヴ・レイス|ピクシー|トーリスリッター/i },
  { title: "Mobile Suit Gundam Twilight Axis", universe: "UC", pattern: /トリスタン|ザクIII改/i },
  { title: "Mobile Suit Gundam: Requiem for Vengeance", universe: "UC", pattern: /復讐のレクイエム|ガンダムEX/i },
  { title: "Mobile Suit Gundam MS IGLOO", universe: "UC", pattern: /ヅダ|ヒルドルブ/i },
  { title: "Gundam Thunderbolt", universe: "UC", pattern: /サンダーボルト|フルアーマー・ガンダム|サイコ・ザク|アトラスガンダム/i },
  { title: "Mobile Suit Gundam: The Origin", universe: "UC", pattern: /THE ORIGIN|オリジン|局地型ガンダム|ブグ/i },
  { title: "Mobile Suit Gundam Hathaway", universe: "UC", pattern: /閃光のハサウェイ|Ξガンダム|ペーネロペー|メッサー|グスタフ・カール/i },
  { title: "Mobile Suit Gundam Unicorn", universe: "UC", pattern: /ユニコーン|バンシィ|フェネクス|シナンジュ|クシャトリヤ|ジェスタ|リゼル|デルタプラス|デルタガンダム|デルタカイ|デルタザイン|シルヴァ・バレト|バイアラン・カスタム|ロト|アンクシャ|ゼー・ズール|ベースジャバー|ジェガン.*エコーズ|ジェガン.*Ｄ型|ジェガン.*D型|ジェガン.*ゼネラル・レビル|ド・ダイ改|ローゼン・ズール|ギラ・ズール|シュツルム・ガルス/i },
  { title: "Mobile Suit Gundam: Char's Counterattack", universe: "UC", pattern: /逆襲のシャア|CCA-MSV|νガンダム|ニューガンダム|RX-93|Hi-ν|サザビー|ナイチンゲール|ヤクト・ドーガ|ギラ・ドーガ|α・アジール|アルパアジール|サイコ・ドーガ|スタークジェガン|プロト・スタークジェガン|リ・ガズィ|ジェガン/i },
  { title: "Mobile Suit Gundam Silhouette Formula 91", universe: "UC", pattern: /クラスターガンダム|RXF-91|ネオガンダム|Gキャノンマグナ|ビギナゼラ|ハーディガン/i },
  { title: "Mobile Suit Gundam F91", universe: "UC", pattern: /F91|Ｆ９１|ビギナ・ギナ|ビギナギナ|デナン|ベルガ|ヘビーガン|ダギイルス|ジーキャノン|ジェガン.*F91|ジェガン.*Ｆ９１/i },
  { title: "Mobile Suit V Gundam", universe: "UC", pattern: /Vガンダム|ヴィクトリー|V2|Ｖ２|Vダッシュ|セカンドV|シャッコー|ガンイージ|ガンブラスター|ゾリディア|アビゴル|シャイターン|コンティオ|ジャベリン|ゾロアット|ジェムズガン|トムリアット/i },
  { title: "Mobile Suit Gundam 0083: Stardust Memory", universe: "UC", pattern: /0083|GP-?01|GP-?02|GP-?03|ガーベラ|デンドロビウム|ステイメン|ドラッツェ|ヴァルヴァロ|ノイエジール/i },
  { title: "Mobile Suit Gundam 0080: War in the Pocket", universe: "UC", pattern: /0080|ドラケン|アレックス|NT-1|ケンプファー|ハイゴッグ|ズゴックE|ザクII改/i },
  { title: "Mobile Suit Gundam: The 08th MS Team", universe: "UC", pattern: /08小隊|Ez-8|Ez8|陸戦型|グフカスタム/i },
  { title: "Mobile Suit Gundam ZZ", universe: "UC", pattern: /ZZ|ダブルゼータ|ハンマ・ハンマ|ハンマハンマ|キュベレイ|ドーベン・ウルフ|ドーベンウルフ|ザクIII|バウ|ゲーマルク|クィン・マンサ|ガルスJ|R・ジャジャ|Rジャジャ|ドライセン|ズサ|ガザC|ガザD|ガズR\/L|ガ・ゾウム|ドワッジ|リゲルグ|アイザック|シュツルム・ディアス/i },
  { title: "Mobile Suit Z Gundam", universe: "UC", pattern: /Zガンダム|Ζ|ゼータガンダム|ZII|ＺＩＩ|ゼッツー|ガンダムMk-II|ガンダムMk-?2|ガンダムMK2|百式|メガ・バズーカ|リック・ディアス|リックディアス|メタス|ネモ|ハイザック|マラサイ|バーザム|バイアラン|アッシマー|ガブスレイ|ギャプラン|ハンブラビ|バウンド・ドック|パラス・アテネ|パラスアテネ|ジ・O|ジ・オ|サイコ・ガンダム|サイコガンダム|ボリノーク・サマーン|ガルバルディ|ディジェ|ガンダムMk-V|スーパーガンダム|グリプス戦役|Gディフェンサー|フライングアーマー|武器セット\(Z\)/i },
  { title: "Mobile Suit Gundam MSV", universe: "UC", pattern: /G-3ガンダム|フルアーマーガンダム|ガンダムフルアーマータイプ|パーフェクトガンダム|プロトタイプガンダム|ギャン・クリーガー|ジョニー・ライデン|シン・マツナガ|高機動型ザク|ゾゴック|ジュアッグ|アッグガイ|アッグ/i },
  { title: "G-Saviour", universe: "UC", pattern: /ジーセイバー/i },
  { title: "Gunpla Accessory / Display Base", universe: "Accessory", pattern: /MSエフェクト|MSスパイク|MSバーニア|カタパルトベース|MS CAGE|拡張エフェクト|ファンネルエフェクト|ガンプラバトルアームアームズ|ガンダムカスタムセット|武器セット/i },
  { title: "Mobile Suit Gundam", universe: "UC", pattern: /RX-78|ONE YEAR WAR|ガンダム Ver\.|ガンダムVer\.|G30th|G40|ガンダムV作戦|リアルタイプ ガンダム|キャスバル専用ガンダム|(?:^|[ 　])ガンダム(?:$|[ 　（(「])|ガンダムRX|ホワイトベース|Gファイター|Gアーマー|コア・ブースター|コアブースター|ミデア|ドダイ|グラブロ|ララァ専用|ビグザム|ビグロ|ブラウ・ブロ|アッザム|マゼラアタック|ガンキャノン|ガンタンク|シャア専用|ザク|グフ|ドム|ズゴック|ゲルググ|ジオング|アッガイ|ゾック|ギャン|ゴッグ|ジム|ボール|ヴァッフ/i },
  { title: "SD Gundam", universe: "SD", pattern: /SD|BB戦士|三国創傑伝|ワールドヒーローズ|クロスシルエット|武者|頑駄無|騎士ガンダム|ナイトガンダム|将頑駄無/i },
];

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value) {
  return new URL(value, BASE_URL).href;
}

function extract(regex, text) {
  const match = regex.exec(text);
  return match ? decodeHtml(match[1]) : null;
}

function parseMaxPage(html) {
  const pages = [...html.matchAll(/paging=(\d+)/g)].map((match) => Number(match[1]));
  return Math.max(1, ...pages);
}

function parseCards(html) {
  return html
    .split('<div class="m_panel__listItem">')
    .slice(1)
    .map((block) => {
      const href = extract(/href="([^"]*\/products\/search\/detail\.php[^"]+)"/, block);
      const imageUrl = extract(/<img src="([^"]+)"/, block);
      const imageAlt = extract(/<img[^>]+alt="([^"]*)"/, block);
      const title = extract(/<div class="m_cardA__title">([\s\S]*?)<\/div>/, block);
      const releaseText = extract(/<div class="m_cardA__date">([\s\S]*?)<\/div>/, block);
      const priceText = extract(/<div class="m_cardA__price">([\s\S]*?)<\/div>/, block);

      if (!href || !title) {
        return null;
      }

      return {
        source_url: absoluteUrl(href),
        image_url: imageUrl ? absoluteUrl(imageUrl) : null,
        image_alt: imageAlt,
        title,
        release_text: releaseText,
        price_text: priceText,
      };
    })
    .filter(Boolean);
}

function parseReleaseDate(value) {
  const text = String(value ?? "");
  const year = /(\d{4})年/.exec(text)?.[1];
  if (!year) {
    return null;
  }

  const month = /(\d{1,2})月/.exec(text)?.[1]?.padStart(2, "0");
  const day = /(\d{1,2})日/.exec(text)?.[1]?.padStart(2, "0");

  if (month && day) {
    return `${year}-${month}-${day}`;
  }
  if (month) {
    return `${year}-${month}`;
  }
  return year;
}

function parsePrice(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function inferGrade(title) {
  if (EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return null;
  }

  for (const rule of GRADE_RULES) {
    const match = rule.pattern.exec(title);
    if (!match) {
      continue;
    }

    let subline = rule.subline;
    if (rule.code === "HG") {
      subline = /^([A-Z][A-Z0-9:]+)\b/i.exec(title)?.[1]?.toUpperCase() ?? "HG";
    }
    return { grade_code: rule.code, subline };
  }

  return null;
}

function inferScale(title, gradeCode) {
  const explicitScale = /(\d+\/\d+)/.exec(title)?.[1];
  if (explicitScale) {
    return explicitScale;
  }
  if (["SD", "SDEX", "SDCS", "SDW", "MGSD", "HAROPLA"].includes(gradeCode)) {
    return "non-scale";
  }
  return DEFAULT_SCALE_BY_GRADE[gradeCode] ?? "various";
}

function inferWork(title) {
  for (const rule of WORK_RULES) {
    if (rule.pattern.test(title)) {
      return { work_title: rule.title, universe: rule.universe };
    }
  }
  return { work_title: null, universe: null };
}

function deriveGalleryImageUrls(imageUrl) {
  if (!imageUrl) {
    return [];
  }
  if (!/_\d+\.(?:jpg|jpeg|png|webp)$/i.test(imageUrl)) {
    return [imageUrl];
  }
  return Array.from({ length: 10 }, (_, index) => imageUrl.replace(/_\d+(\.(?:jpg|jpeg|png|webp))$/i, `_${index + 1}$1`));
}

function slugifyTitle(value) {
  const ascii = String(value)
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return ascii || "kit";
}

function kitIdFor(card, gradeCode) {
  const productId = /prd_id=(\d+)/.exec(card.source_url)?.[1] ?? slugifyTitle(card.title);
  const gradePrefix = GRADE_PREFIX_ORDER.includes(gradeCode) ? gradeCode.toLowerCase() : gradeCode.toLowerCase();
  return `${gradePrefix}-${slugifyTitle(card.title)}-${productId}`;
}

function toKit(card) {
  const grade = inferGrade(card.title);
  if (!grade) {
    return null;
  }

  const releaseDate = parseReleaseDate(card.release_text);
  const priceJpy = parsePrice(card.price_text);
  const work = inferWork(card.title);
  const galleryImageUrls = deriveGalleryImageUrls(card.image_url);

  return {
    kit_id: kitIdFor(card, grade.grade_code),
    franchise: "gundam",
    grade_code: grade.grade_code,
    subline: grade.subline,
    number: null,
    scale: inferScale(card.title, grade.grade_code),
    names: {
      ja: card.title,
      en: null,
      zh: null,
      ko: null,
    },
    images: {
      box_art_url: card.image_url,
      box_art_source_id: card.image_url ? SOURCE_ID : null,
    },
    gallery_image_urls: galleryImageUrls,
    universe: work.universe,
    work_title: work.work_title,
    release_date: releaseDate,
    price_jpy: priceJpy,
    is_limited: /限定|イベント|抽選|プレミアムバンダイ|ガンダムベース/.test(card.title),
    data_status: "needs_review",
    source_urls: [card.source_url],
    source_refs: [
      {
        source_id: SOURCE_ID,
        url: card.source_url,
        fields: ["names", "grade_code", "subline", "scale", "release_date", "price_jpy", "images", "gallery_image_urls", "work_title", "universe"],
        confidence: "high",
      },
    ],
    tags: ["gunpla", "bandai spirits import"],
    notes: card.release_text ? `Imported from BANDAI SPIRITS product search. Release text: ${card.release_text}.` : "Imported from BANDAI SPIRITS product search.",
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Gunpula catalog importer (+https://github.com/mdefitko777/Gunpula)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      if (response.ok) {
        return response.text();
      }
      lastError = new Error(`Failed to fetch ${url}: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(1000 * attempt);
  }

  throw lastError;
}

function pageUrl(page) {
  return `${BASE_URL}${RESULT_PATH}?paging=${page}&dsp_cnt=20&sort=salesdate&order=desc&category=1`;
}

async function main() {
  const maxPagesArg = process.argv.find((arg) => arg.startsWith("--max-pages="));
  const maxPagesOverride = maxPagesArg ? Number(maxPagesArg.split("=")[1]) : null;

  const firstHtml = await fetchText(FIRST_PAGE_URL);
  const maxPage = maxPagesOverride || parseMaxPage(firstHtml);
  const cards = parseCards(firstHtml);

  console.log(`Found ${maxPage} BANDAI SPIRITS Gunpla result pages.`);
  console.log(`Fetched page 1/${maxPage}: ${cards.length} cards.`);

  for (let page = 2; page <= maxPage; page += 1) {
    await sleep(250);
    const html = await fetchText(pageUrl(page));
    const pageCards = parseCards(html);
    cards.push(...pageCards);
    console.log(`Fetched page ${page}/${maxPage}: ${pageCards.length} cards.`);
  }

  const kits = [];
  const seenIds = new Set();
  let skipped = 0;

  for (const card of cards) {
    const kit = toKit(card);
    if (!kit) {
      skipped += 1;
      continue;
    }
    if (seenIds.has(kit.kit_id)) {
      skipped += 1;
      continue;
    }
    seenIds.add(kit.kit_id);
    kits.push(kit);
  }

  kits.sort((a, b) => {
    const dateCompare = String(b.release_date ?? "").localeCompare(String(a.release_date ?? ""));
    if (dateCompare) {
      return dateCompare;
    }
    return a.names.ja.localeCompare(b.names.ja, "ja");
  });

  const doc = {
    schema_version: 1,
    updated_at: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()),
    scope: "Individual Gunpla kit catalog imported from Japanese official BANDAI SPIRITS product search. Records are needs_review until field-level human checks are complete.",
    kits,
  };

  await writeFile("data/kits.json", `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`Imported ${kits.length} kit records. Skipped ${skipped} non-kit/accessory/duplicate records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
