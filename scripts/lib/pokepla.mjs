// Pokémon PLAMO COLLECTION (ポケプラ) helpers for import_bandai_collectibles.mjs.
//
// Until 2026-11 the 2022+ Pokepla records came only from global.bandai-hobby.net,
// whose CloudFront answers 403 to the importer's self-identifying user-agent, and
// bandai-hobby.net answers its 404 page outside Japan. The catalog therefore
// froze at the 22 overseas "Pokémon Model Kit" items of 2019-2021 plus 24 global
// records without release dates. The official BANDAI SPIRITS product search
// (bandaispirits.co.jp, plain HTML, no robots.txt) lists every Pokepla kit since
// 2010 with its Japanese name, release day, tax-included price and product images,
// so it is now the primary Pokepla source. Everything here is pure (strings in,
// strings out) so it can be unit-tested.

const NFKC = (value) => String(value ?? "").normalize("NFKC");

// Line words, longest first within each table. Applied after species names, so a
// species never gets cut by a line word.
// Phrases that contain a species name, replaced before the species are.
const PRE_TERMS = [
  ["ビクティニと白き英雄", { en: "Victini and the White Hero", ko: "비크티니와 백의 영웅", zh: "比克提尼与白色英雄" }],
  ["ビクティニと黒き英雄", { en: "Victini and the Black Hero", ko: "비크티니와 흑의 영웅", zh: "比克提尼与黑色英雄" }],
];

const TERMS = [
  ["ポケモンプラモコレクション", { en: "Pokémon PLAMO COLLECTION", ko: "포켓몬 프라모 컬렉션", zh: "宝可梦 PLAMO COLLECTION" }],
  ["ポケモン・ザ・ムービーXY", { en: "Pokémon the Movie XY", ko: "포켓몬스터 XY 극장판", zh: "宝可梦 XY 剧场版" }],
  ["ポケモン・ザ・ムービー", { en: "Pokémon the Movie", ko: "포켓몬스터 극장판", zh: "宝可梦 剧场版" }],
  ["カセキポケモンシリーズ", { en: "FOSSIL POKÉMON SERIES", ko: "화석 포켓몬 시리즈", zh: "化石宝可梦系列" }],
  ["プラモコレクション", { en: "PLAMO COLLECTION", ko: "프라모 컬렉션", zh: "PLAMO COLLECTION" }],
  ["セレクトシリーズ", { en: "SELECT SERIES", ko: "셀렉트 시리즈", zh: "SELECT SERIES" }],
  ["おすわりポーズ", { en: "Sitting Pose", ko: "앉은 포즈", zh: "坐姿" }],
  ["おやすみポーズ", { en: "Sleeping Pose", ko: "잠자는 포즈", zh: "睡姿" }],
  ["バトルポーズ", { en: "Battle Pose", ko: "배틀 포즈", zh: "对战姿势" }],
  ["ポケラマはじめよう", { en: "Let's Start Pokérama", ko: "포케라마 시작하자", zh: "开始宝可拉玛" }],
  ["ポケラマつくろう", { en: "Let's Make Pokérama", ko: "포케라마 만들자", zh: "制作宝可拉玛" }],
  ["進化シリーズ", { en: "EVOLUTION SERIES", ko: "진화 시리즈", zh: "进化系列" }],
  ["進化セット", { en: "Evolution Set", ko: "진화 세트", zh: "进化套装" }],
  ["バトルVer.", { en: "Battle Ver.", ko: "배틀 Ver.", zh: "对战 Ver." }],
  ["VSセット", { en: "VS Set", ko: "VS 세트", zh: "VS 套装" }],
  ["サトシの", { en: "Ash's ", ko: "지우의 ", zh: "小智的" }],
  ["クイック!!", { en: "QUICK!!", ko: "퀵!!", zh: "QUICK!!" }],
  ["クイック‼", { en: "QUICK!!", ko: "퀵!!", zh: "QUICK!!" }],
  ["クイック", { en: "QUICK!!", ko: "퀵!!", zh: "QUICK!!" }],
  ["セット", { en: " Set", ko: " 세트", zh: " 套装" }],
  ["ブラック", { en: "Black ", ko: "블랙", zh: "黑" }],
  ["ホワイト", { en: "White ", ko: "화이트", zh: "白" }],
  ["黒い", { en: "Black ", ko: "검은 ", zh: "黑色" }],
  ["赤い", { en: "Red ", ko: "빨간 ", zh: "红色" }],
  ["メガ", { en: "Mega ", ko: "메가", zh: "超级" }],
  ["ポケモン", { en: "Pokémon", ko: "포켓몬", zh: "宝可梦" }],
];

const JAPANESE = /[぀-ヿ㐀-鿿]/;
const KANJI = /[㐀-鿿]/g;

export function buildSpeciesIndex(taxonomyPokemon = []) {
  const species = [];
  for (const generation of taxonomyPokemon) {
    for (const entry of generation.species || []) {
      if (entry?.names?.ja) species.push({ id: entry.id, names: entry.names });
    }
  }
  // Longest Japanese name first, so ミュウツー wins over ミュウ.
  species.sort((a, b) => b.names.ja.length - a.names.ja.length);
  return species;
}

/** Normalized Japanese title: NFKC, ‼ spelled !!, collapsed spaces. */
export function cleanPokeplaTitle(title) {
  return NFKC(title)
    .replace(/‼/g, "!!")
    .replace(/\s+/g, " ")
    .trim();
}

function speciesIn(text, speciesIndex, lang) {
  const found = [];
  let rest = text;
  for (const entry of speciesIndex) {
    const name = entry.names[lang];
    if (!name) continue;
    const pattern = lang === "ja" ? new RegExp(escapeRegExp(name), "g") : new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi");
    if (pattern.test(rest)) {
      found.push(entry.id);
      rest = rest.replace(pattern, " ");
    }
  }
  return found.sort((a, b) => a - b);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Which Pokepla line a Japanese or English title belongs to. */
export function pokeplaLine(title) {
  const text = NFKC(title);
  if (/クイック|quick/i.test(text)) return /lite/i.test(text) ? "quick_lite" : "quick";
  if (/\bBIG\b/i.test(text)) return "big";
  if (/カセキ|fossil/i.test(text)) return "fossil";
  if (/進化|evolution/i.test(text)) return "evolution";
  if (/セレクト|select/i.test(text)) return "select";
  return "other";
}

export function pokeplaSubline(title) {
  switch (pokeplaLine(title)) {
    case "quick":
    case "quick_lite":
      return "Pokemon Model Kit Quick!!";
    case "big":
      return "Pokemon Model Kit BIG";
    case "fossil":
      return "Pokemon Fossil Pokemon Series";
    case "select":
      return "Pokemon PLAMO COLLECTION SELECT SERIES";
    case "evolution":
      return "Pokemon PLAMO COLLECTION EVOLUTION SERIES";
    default:
      return "Pokemon Model Kit";
  }
}

/** Every catalogue number in the title (No.36+No.38, 11＋13＋17, 52 …). */
function pokeplaNumbers(title, line) {
  const text = NFKC(title).replace(/\(.*?\)/g, " ");
  if (line === "quick" || line === "big") {
    const after = /(?:クイック|quick|BIG)\s*!*\s*((?:\d+\s*\+\s*)*\d+)/i.exec(text);
    return after ? after[1].split("+").map((n) => Number(n)) : [];
  }
  const numbers = [...text.matchAll(/No\.?\s*(\d{1,2})|(\d{1,2})(?=\s*(?:\+|セレクト|select|進化|evolution|$|\s))/gi)]
    .map((match) => [match[0], match[1] ?? match[2]])
    .map(([, n]) => Number(n))
    .filter((n) => n > 0 && n < 100);
  return [...new Set(numbers)];
}

function modifiers(title) {
  const text = NFKC(title);
  const found = [];
  if (/黒い|black/i.test(text)) found.push("black");
  if (/赤い|red /i.test(text)) found.push("red");
  if (/メガ|mega/i.test(text)) found.push("mega");
  if (/おすわり|sitting/i.test(text)) found.push("sitting");
  if (/おやすみ|goodnight|sleeping/i.test(text)) found.push("sleeping");
  if (/バトルポーズ|battle pose/i.test(text)) found.push("battle");
  return found;
}

/**
 * A product identity shared by the Japanese BANDAI SPIRITS title and the English
 * titles the Bandai Hobby global/satellite pages used, so a record imported from
 * those pages keeps its kit_id when the Japanese source takes over.
 *   quick:29  big:2  select:52  quick_lite:25  select:-:384:black
 */
export function pokeplaIdentity(title, speciesIndex) {
  const text = NFKC(title);
  const line = pokeplaLine(text);
  const numbers = pokeplaNumbers(text, line);
  const lang = JAPANESE.test(text.replace(/ポケモン|プラモデル|プラモコレクション/g, "")) ? "ja" : "en";
  const species = speciesIn(text, speciesIndex, lang);
  const lineKey = line === "other" ? "select" : line;
  if (numbers.length === 1 && line !== "quick_lite") return `${lineKey}:${numbers[0]}`;
  if (numbers.length > 1) return `${lineKey}:${numbers.join("+")}`;
  return [lineKey, "-", species.join("+"), ...modifiers(text)].join(":");
}

/**
 * Line + Pokémon + variant, without the catalogue number. The overseas "Pokémon
 * Model Kit GENGAR" pages carry no number, so they are matched to the Japanese
 * "45 セレクトシリーズ ゲンガー" by this key when exactly one product has it.
 */
export function pokeplaSpeciesKey(title, speciesIndex) {
  const text = NFKC(title);
  const line = pokeplaLine(text);
  const lang = JAPANESE.test(text.replace(/ポケモン|プラモデル|プラモコレクション/g, "")) ? "ja" : "en";
  const species = speciesIn(text, speciesIndex, lang);
  if (!species.length) return null;
  return [line === "other" ? "select" : line, species.join("+"), ...modifiers(text)].join(":");
}

/** Japanese, English, Korean and Chinese display names for a Japanese title. */
export function pokeplaNames(title, speciesIndex) {
  const ja = cleanPokeplaTitle(title);
  const names = { ja, en: null, ko: null, zh: null };
  for (const lang of ["en", "ko", "zh"]) {
    let text = ja;
    for (const [source, target] of PRE_TERMS) {
      text = text.replace(new RegExp(escapeRegExp(source), "g"), ` ${target[lang]} `);
    }
    for (const entry of speciesIndex) {
      if (entry.names[lang]) text = text.replace(new RegExp(escapeRegExp(entry.names.ja), "g"), ` ${entry.names[lang]} `);
    }
    for (const [source, target] of TERMS) {
      text = text.replace(new RegExp(escapeRegExp(source), "g"), ` ${target[lang]} `);
    }
    text = text
      .replace(/[「」]/g, " ")
      .replace(/No\.?\s*(\d)/g, "No.$1")
      .replace(/!!(\d)/g, "!! $1")
      .replace(/\s*&\s*/g, " & ")
      .replace(/\s*\+\s*/g, "+")
      .replace(/\s*\(\s*/g, " (")
      .replace(/\s*\)/g, ")")
      .replace(/\s+/g, " ")
      .trim();
    if (lang === "ko") text = text.replace(/(메가|블랙|화이트) /g, "$1");
    if (lang === "zh") text = text.replace(/(超级|黑色|红色|小智的|黑|白) /g, "$1");
    // Only a fully translated name is used; the rest is left to localize_catalog.mjs.
    names[lang] = JAPANESE.test(lang === "zh" ? text.replace(KANJI, "") : text) ? null : text;
  }
  return names;
}
