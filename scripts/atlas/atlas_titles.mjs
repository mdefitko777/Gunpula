// Hand-kept title lists for the Atlas group builder: the Pokémon main-series games that name
// each generation, and the Armored Core game eras with the machines, corporations and
// characters that belong to them (from FromSoftware's official title line-up and the
// games' own naming: ACs, corporations and pilots are unique to their era).

const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });

// Pokémon: one group per generation, named after the generation's paired games (official
// JP / Chinese / English titles; Korean titles as released in Korea — Gen 1 and Gen 3 were
// not released in Korean, so the Korean names follow the Japanese originals).
export const POKEMON_GAMES = {
  gen1: { generation: 1, region: "kanto", labels: lang("宝可梦 红·绿", "포켓몬스터 레드·그린", "Pokémon Red & Blue", "ポケットモンスター 赤・緑"), subtitle: lang("第一世代 · 关都地区", "1세대 · 관동지방", "Generation I · Kanto", "第1世代・カントー地方"), games: lang("红·绿·蓝·皮卡丘", "레드·그린·블루·피카츄", "Red, Green, Blue, Yellow", "赤・緑・青・ピカチュウ") },
  gen2: { generation: 2, region: "johto", labels: lang("宝可梦 金·银", "포켓몬스터 금·은", "Pokémon Gold & Silver", "ポケットモンスター 金・銀"), subtitle: lang("第二世代 · 城都地区", "2세대 · 성도지방", "Generation II · Johto", "第2世代・ジョウト地方"), games: lang("金·银·水晶", "금·은·크리스탈", "Gold, Silver, Crystal", "金・銀・クリスタル") },
  gen3: { generation: 3, region: "hoenn", labels: lang("宝可梦 红宝石·蓝宝石", "포켓몬스터 루비·사파이어", "Pokémon Ruby & Sapphire", "ポケットモンスター ルビー・サファイア"), subtitle: lang("第三世代 · 丰缘地区", "3세대 · 호연지방", "Generation III · Hoenn", "第3世代・ホウエン地方"), games: lang("红宝石·蓝宝石·绿宝石", "루비·사파이어·에메랄드", "Ruby, Sapphire, Emerald", "ルビー・サファイア・エメラルド") },
  gen4: { generation: 4, region: "sinnoh", labels: lang("宝可梦 钻石·珍珠", "포켓몬스터 DP 디아루가·펄기아", "Pokémon Diamond & Pearl", "ポケットモンスター ダイヤモンド・パール"), subtitle: lang("第四世代 · 神奥地区", "4세대 · 신오지방", "Generation IV · Sinnoh", "第4世代・シンオウ地方"), games: lang("钻石·珍珠·白金", "디아루가·펄기아·Pt 기라티나", "Diamond, Pearl, Platinum", "ダイヤモンド・パール・プラチナ") },
  gen5: { generation: 5, region: "unova", labels: lang("宝可梦 黑·白", "포켓몬스터 블랙·화이트", "Pokémon Black & White", "ポケットモンスター ブラック・ホワイト"), subtitle: lang("第五世代 · 合众地区", "5세대 · 하나지방", "Generation V · Unova", "第5世代・イッシュ地方"), games: lang("黑·白·黑2·白2", "블랙·화이트·블랙2·화이트2", "Black, White, Black 2, White 2", "ブラック・ホワイト・ブラック2・ホワイト2") },
  gen6: { generation: 6, region: "kalos", labels: lang("宝可梦 X·Y", "포켓몬스터 X·Y", "Pokémon X & Y", "ポケットモンスター X・Y"), subtitle: lang("第六世代 · 卡洛斯地区", "6세대 · 칼로스지방", "Generation VI · Kalos", "第6世代・カロス地方"), games: lang("X·Y·终极红宝石·始源蓝宝石", "X·Y·오메가루비·알파사파이어", "X, Y, Omega Ruby, Alpha Sapphire", "X・Y・オメガルビー・アルファサファイア") },
  gen7: { generation: 7, region: "alola", labels: lang("精灵宝可梦 太阳·月亮", "포켓몬스터 썬·문", "Pokémon Sun & Moon", "ポケットモンスター サン・ムーン"), subtitle: lang("第七世代 · 阿罗拉地区", "7세대 · 알로라지방", "Generation VII · Alola", "第7世代・アローラ地方"), games: lang("太阳·月亮·究极之日·究极之月·Let's Go", "썬·문·울트라썬·울트라문·레츠고", "Sun, Moon, Ultra Sun, Ultra Moon, Let's Go", "サン・ムーン・ウルトラサン・ウルトラムーン・Let's Go") },
  gen8: { generation: 8, region: "galar", labels: lang("宝可梦 剑·盾", "포켓몬스터 소드·실드", "Pokémon Sword & Shield", "ポケットモンスター ソード・シールド"), subtitle: lang("第八世代 · 伽勒尔地区", "8세대 · 가라르지방", "Generation VIII · Galar", "第8世代・ガラル地方"), games: lang("剑·盾·晶灿钻石·明亮珍珠·传说 阿尔宙斯", "소드·실드·BDSP·LEGENDS 아르세우스", "Sword, Shield, BDSP, Legends: Arceus", "ソード・シールド・BDSP・LEGENDS アルセウス") },
  gen9: { generation: 9, region: "paldea", labels: lang("宝可梦 朱·紫", "포켓몬스터 스칼렛·바이올렛", "Pokémon Scarlet & Violet", "ポケットモンスター スカーレット・バイオレット"), subtitle: lang("第九世代 · 帕底亚地区", "9세대 · 팔데아지방", "Generation IX · Paldea", "第9世代・パルデア地方"), games: lang("朱·紫·传说 Z-A", "스칼렛·바이올렛·LEGENDS Z-A", "Scarlet, Violet, Legends: Z-A", "スカーレット・バイオレット・LEGENDS Z-A") },
};

// Words that put a product in one generation on their own: game titles, regions, and the
// gimmicks introduced by a generation's games (Mega Evolution, Gigantamax, Terastal …).
export const POKEMON_GEN_WORDS = {
  gen1: ["カントー地方", "関東地方", "관동지방", "kanto region", "赤・緑", "ファイアレッド", "リーフグリーン"],
  gen2: ["ジョウト", "성도지방", "johto", "ポケットモンスター金・銀", "金銀編", "gold and silver", "クリスタル版", "ハートゴールド", "ソウルシルバー", "heartgold", "soulsilver"],
  gen3: ["ホウエン", "호연지방", "hoenn", "ルビー・サファイア", "ruby and sapphire", "エメラルド版"],
  gen4: ["シンオウ", "신오지방", "sinnoh", "ダイヤモンド・パール", "ブリリアントダイヤモンド", "シャイニングパール", "brilliant diamond", "shining pearl", "プラチナ版"],
  gen5: ["イッシュ", "하나지방", "unova", "ポケットモンスターブラック・ホワイト", "ポケモンbw", "pokemon black and white", "ブラック2", "ホワイト2"],
  gen6: ["カロス", "칼로스", "kalos", "ポケットモンスターxy", "ポケモンxy", "ムービーxy", "pokemon x and y", "pokemon x & y", "オメガルビー", "アルファサファイア", "メガシンカ", "메가진화", "mega evolution"],
  gen7: ["アローラ地方", "알로라지방", "alola region", "サン・ムーン", "サン＆ムーン", "サンアンドムーン", "sun & moon", "sun and moon", "썬·문", "썬&문", "ウルトラサン", "ウルトラムーン", "ピカブイ", "let's go pikachu", "let's go eevee", "let's go! ピカチュウ", "let's go! イーブイ", "zワザ"],
  gen8: ["ガラル", "가라르", "galar", "ソード・シールド", "ソードシールド", "소드·실드", "소드 실드", "sword and shield", "sword & shield", "キョダイマックス", "거다이맥스", "gigantamax", "ダイマックス", "다이맥스", "dynamax", "legends アルセウス", "legendsアルセウス", "legends arceus", "레전드 아르세우스", "ヒスイ", "히스이", "hisui"],
  gen9: ["パルデア", "팔데아", "paldea", "スカーレット・バイオレット", "スカーレットバイオレット", "스칼렛·바이올렛", "스칼렛 바이올렛", "scarlet & violet", "scarlet and violet", "テラスタル", "테라스탈", "terastal", "キタカミ", "ブルーベリー学園", "legends z-a", "legendsz-a", "レジェンズz-a", "ミアレ", "lumiose", "ポケモンホライズン", "ホライズン", "포켓몬스터 호라이즌", "pokemon horizons", "ライジングボルテッカーズ"],
};

// Game characters (protagonists, champions, rivals, gym leaders) of each generation's games,
// as products name them (JP / EN / KO). Kept to names that are not ordinary words.
export const POKEMON_TRAINERS = {
  gen1: ["ロケット団", "Team Rocket", "로켓단", "サカキ", "Giovanni", "비주기", "タケシ", "カスミ", "ナツメ", "Sabrina", "エリカ"],
  gen2: ["ヒビキ", "コトネ", "ミカン", "Jasmine", "アカネ", "Whitney"],
  gen3: ["ダイゴ", "Steven", "성호", "ミクリ", "Wallace", "ハルカ", "ユウキ", "ヒガナ", "Zinnia"],
  gen4: ["シロナ", "Cynthia", "난천", "コウキ", "デンジ", "Volkner", "ナタネ", "スモモ", "アカギ", "Cyrus"],
  gen5: ["カミツレ", "Elesa", "카밀레", "トウコ", "トウヤ", "ゲーチス", "Ghetsis", "チェレン", "ギーマ", "Grimsley"],
  gen6: ["セレナ", "Serena", "세레나", "コルニ", "Korrina", "カルネ", "Diantha", "フラダリ", "Lysandre"],
  gen7: ["リーリエ", "Lillie", "릴리에", "グラジオ", "Gladion", "ルザミーネ", "Lusamine", "アセロラ", "Acerola", "ククイ", "Kukui", "グズマ", "Guzma", "ミヅキ", "Mizuki", "Selene"],
  gen8: ["マリィ", "Marnie", "ダンデ", "Leon", "단델", "キバナ", "Raihan", "ルリナ", "Nessa", "ソニア", "Sonia", "ネズ", "Piers", "ユウリ", "Gloria", "セキ", "Adaman"],
  gen9: ["ネモ", "Nemona", "네모", "ペパー", "Arven", "페퍼", "ナンジャモ", "Iono", "모야모", "ピーニャ", "Giacomo", "피나", "グルーシャ", "Grusha", "オモダカ", "Geeta", "アオキ", "Larry", "ゼイユ", "Carmine", "スグリ", "Kieran", "メロコ", "Mela", "シュウメイ", "Atticus", "オルティガ", "Ortega", "リコ", "Liko", "리코", "ロイ", "Roy", "フリード", "Friede"],
};

// A regional form / Mega written right before or after a species name.
export const POKEMON_FORM_WORDS = [
  ["gen7", ["アローラ", "알로라", "alolan", "alola"]],
  ["gen8", ["ガラル", "가라르", "galarian", "galar", "ヒスイ", "히스이", "hisuian", "hisui", "キョダイマックス", "거다이맥스", "gigantamax", "キョダイ"]],
  ["gen9", ["パルデア", "팔데아", "paldean", "paldea", "テラスタル", "테라스탈", "terastal"]],
  ["gen6", ["メガ", "메가", "mega", "ゲンシ", "원시", "primal"]],
];

// Species names that are also ordinary words in product titles; only matched in another
// language or with a dex number. (ラッキー/럭키 = Chansey but also "lucky".)
export const POKEMON_NAME_STOPLIST = new Set(["ラッキー", "럭키", "lucky"]);

// Armored Core game eras (official title line-up).
export const AC_TITLES = [
  {
    id: "ac1",
    labels: lang("装甲核心 (初代)", "아머드 코어 (초대)", "Armored Core (1997)", "アーマード・コア (初代)"),
    subtitle: lang("PROJECT PHANTASMA · MASTER OF ARENA", "PROJECT PHANTASMA · MASTER OF ARENA", "Project Phantasma · Master of Arena", "プロジェクトファンタズマ・マスターオブアリーナ"),
    games: ["ARMORED CORE (1997)", "PROJECT PHANTASMA (1997)", "MASTER OF ARENA (1999)"],
    titles: ["project phantasma", "プロジェクトファンタズマ", "master of arena", "マスターオブアリーナ"],
    roster: ["ナインボール", "nineball", "ナインボール・セラフ", "nineball seraph", "セラフ", "ハスラー・ワン", "hustler one", "ファンタズマ", "フォグシャドウ", "fog shadow", "クローム", "ムラクモ", "murakumo", "スティンガー", "stinger"],
  },
  {
    id: "ac2",
    labels: lang("装甲核心 2", "아머드 코어 2", "Armored Core 2", "アーマード・コア2"),
    subtitle: lang("ANOTHER AGE", "ANOTHER AGE", "Another Age", "アナザーエイジ"),
    games: ["ARMORED CORE 2 (2000)", "ANOTHER AGE (2001)"],
    titles: ["armored core 2", "armoredcore2", "アーマード・コア2", "アーマードコア2", "another age", "アナザーエイジ"],
    roster: ["ジオ・マトリクス", "zio matrix", "エムロード", "emeraude", "バレーナ", "balena", "レオス・クライン", "leos klein", "フライトナーズ", "flightnerds"],
  },
  {
    id: "ac3",
    labels: lang("装甲核心 3", "아머드 코어 3", "Armored Core 3", "アーマード・コア3"),
    subtitle: lang("SILENT LINE · NEXUS · NINE BREAKER · FORMULA FRONT · LAST RAVEN", "SILENT LINE · NEXUS · NINE BREAKER · FORMULA FRONT · LAST RAVEN", "Silent Line · Nexus · Nine Breaker · Formula Front · Last Raven", "サイレントライン・ネクサス・ナインブレイカー・フォーミュラフロント・ラストレイヴン"),
    games: ["ARMORED CORE 3 (2002)", "SILENT LINE (2003)", "NEXUS (2004)", "NINE BREAKER (2004)", "FORMULA FRONT (2004)", "LAST RAVEN (2005)"],
    titles: ["armored core 3", "armoredcore3", "アーマード・コア3", "アーマードコア3", "silent line", "サイレントライン", "nexus", "ネクサス", "nine breaker", "ナインブレイカー", "formula front", "フォーミュラフロント", "last raven", "ラストレイヴン"],
    roster: ["ミラージュ", "mirage", "クレスト", "crest", "キサラギ", "kisaragi", "ファシネイター", "fascinator", "ジナイーダ", "zinaida", "ジャック・O", "jack-o", "フォックスアイ", "fox eye", "エヴァンジェ", "evangile", "オラクル", "エグザイル", "exile", "アストライアー", "ナインブレイカー", "c01-gaea", "c02-uranus", "cr-c75u2"],
  },
  {
    id: "ac4",
    labels: lang("装甲核心 4", "아머드 코어 4", "Armored Core 4", "アーマード・コア4"),
    subtitle: lang("for Answer", "for Answer", "for Answer", "フォーアンサー"),
    games: ["ARMORED CORE 4 (2006)", "ARMORED CORE for Answer (2008)"],
    titles: ["armored core 4", "armoredcore4", "アーマード・コア4", "アーマードコア4", "for answer", "フォーアンサー"],
    roster: ["ホワイト・グリント", "white glint", "ラインアーク", "line ark", "lineark", "レイレナード", "rayleonard", "アリーヤ", "aaliyah", "シュープリス", "supplice", "オルレア", "ローゼンタール", "rosenthal", "ノブリス・オブリージュ", "noblesse oblige", "オーメル", "omer", "アスピナ", "aspina", "bff", "インテリオル", "interior union", "アルゼブラ", "algebra", "ステイシス", "stasis", "ストレイド", "strayed", "アンサング", "unsung", "type-lahire", "タイプ-オーギル", "type-ogil", "アームズフォート", "arms fort", "サンシャイン", "sunshine", "gan01", "フラジール", "fragile", "クラースナヤ", "krasnaya", "バルバロイ", "テルス", "tellus", "マザーウィル", "mother will", "アンビエント", "ambient", "カラード", "collared"],
  },
  {
    id: "acv",
    labels: lang("装甲核心 V", "아머드 코어 V", "Armored Core V", "アーマード・コアV"),
    subtitle: lang("VERDICT DAY", "VERDICT DAY", "Verdict Day", "ヴァーディクトデイ"),
    games: ["ARMORED CORE V (2012)", "ARMORED CORE VERDICT DAY (2013)"],
    titles: ["armored core v ", "armored core v.", "armoredcorev ", "acv", "アーマード・コアv", "アーマードコアv", "verdict day", "ヴァーディクトデイ", "ヴァーディクト・デイ"],
    roster: ["ハングドマン", "hanged man", "kt-104", "perun", "ヴェンジェンス", "vengeance", "ucr-10", "matsukaze", "マツカゼ", "オーバード・ウェポン", "overed weapon", "ファットマン", "fatman", "ストライダー", "strider", "マリシャス", "malicious", "ジェネレーション", "kt-202", "lam-01"],
  },
  {
    id: "ac6",
    labels: lang("装甲核心 VI 境界天火", "아머드 코어 VI 파이어즈 오브 루비콘", "Armored Core VI: Fires of Rubicon", "アーマード・コアVI ファイアーズオブルビコン"),
    subtitle: lang("FIRES OF RUBICON", "FIRES OF RUBICON", "Fires of Rubicon", "ファイアーズオブルビコン"),
    games: ["ARMORED CORE VI FIRES OF RUBICON (2023)"],
    titles: ["armored core vi", "armoredcorevi", "アーマード・コアvi", "アーマードコアvi", "fires of rubicon", "ファイアーズオブルビコン", "30mm armored core"],
    roster: ["バルテウス", "balteus", "ナイトフォール", "nightfall", "スティールヘイズ", "steel haze", "ナハトライアー", "nachtreiher", "schneider", "シュナイダー", "アーキバス", "arquebus", "ベイラム", "balam", "メランダー", "melander", "ロックスミス", "lockesmith", "ルビコン", "rubicon", "アイビス", "ibis", "エア", "ラスティ", "rusty", "ハンドラー・ウォルター", "handler walter", "ヴェスパー", "vespers", "レッドガン", "redgun", "エルカノ", "elcano", "大豊", "dafeng", "タキガワ", "takigawa", "ve-40a", "vp-40s", "bd-011", "aap07"],
  },
];
