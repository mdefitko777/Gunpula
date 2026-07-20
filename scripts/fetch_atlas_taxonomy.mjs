import { readFile, writeFile } from "node:fs/promises";

const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });
const officialArtwork = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const generationCovers = { 1: 25, 2: 249, 3: 384, 4: 448, 5: 643, 6: 658, 7: 722, 8: 813, 9: 909 };
const regionNames = {
  kanto: lang("关都", "관동", "Kanto", "カントー"),
  johto: lang("城都", "성도", "Johto", "ジョウト"),
  hoenn: lang("丰缘", "호연", "Hoenn", "ホウエン"),
  sinnoh: lang("神奥", "신오", "Sinnoh", "シンオウ"),
  unova: lang("合众", "하나", "Unova", "イッシュ"),
  kalos: lang("卡洛斯", "칼로스", "Kalos", "カロス"),
  alola: lang("阿罗拉", "알로라", "Alola", "アローラ"),
  galar: lang("伽勒尔", "가라르", "Galar", "ガラル"),
  paldea: lang("帕底亚", "팔데아", "Paldea", "パルデア"),
};

async function json(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Gunpula Atlas taxonomy builder" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function namesFrom(list = []) {
  const byLang = new Map(list.map((item) => [item.language?.name, item.name]));
  return {
    zh: byLang.get("zh-hans") || byLang.get("zh-hant") || byLang.get("en") || "",
    ko: byLang.get("ko") || byLang.get("en") || "",
    en: byLang.get("en") || "",
    ja: byLang.get("ja") || byLang.get("ja-hrkt") || byLang.get("en") || "",
  };
}

async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        out[index] = await mapper(items[index], index);
      }
    }),
  );
  return out;
}

async function pokemonGenerations() {
  const generations = [];
  for (let id = 1; id <= 9; id += 1) {
    const generation = await json(`https://pokeapi.co/api/v2/generation/${id}/`);
    const species = await mapLimit(generation.pokemon_species || [], 16, async (entry) => {
      const speciesId = Number(entry.url.match(/pokemon-species\/(\d+)\//)?.[1]);
      const detail = await json(entry.url);
      return {
        id: speciesId,
        slug: entry.name,
        names: namesFrom(detail.names),
      };
    });
    generations.push({
      id: `gen${id}`,
      generation: id,
      labels: namesFrom(generation.names),
      region: generation.main_region?.name || "",
      subtitle: regionNames[generation.main_region?.name] || lang(generation.main_region?.name || "", generation.main_region?.name || "", generation.main_region?.name || "", generation.main_region?.name || ""),
      image: officialArtwork(generationCovers[id]),
      version_groups: (generation.version_groups || []).map((group) => group.name),
      species: species.filter(Boolean).sort((a, b) => a.id - b.id),
    });
  }
  return generations;
}

const fgoMainWarIds = [100, 101, 102, 103, 104, 105, 106, 107, 108, 201, 202, 203, 204, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 402, 403];
const fgoChapterAliases = {
  100: ["fuyuki", "emiya"],
  101: ["orleans", "jeanne", "jalter"],
  102: ["septem", "nero", "romulus"],
  103: ["okeanos", "drake", "medea", "heracles"],
  104: ["london", "mordred", "jack", "frankenstein"],
  105: ["e pluribus unum", "cu alter", "nightingale", "edison"],
  106: ["camelot", "bedivere", "lancelot", "gawain", "tristan", "ozymandias"],
  107: ["babylonia", "gilgamesh", "ereshkigal", "ishtar", "enkidu", "quetzal"],
  108: ["solomon", "goetia", "romani"],
  201: ["shinjuku", "moriarty", "salter", "saber alter"],
  202: ["agartha", "scheherazade", "penthesilea"],
  203: ["shimousa", "musashi", "muramasa", "raikou", "shuten", "tomoe"],
  204: ["salem", "abby", "abigail", "circe"],
  301: ["anastasia", "kadoc", "ivan"],
  302: ["gotterdammerung", "skadi", "brynhild", "sigurd"],
  303: ["sin", "qin", "shi huang", "consort yu"],
  304: ["yugakshetra", "arjuna", "karna", "ashiya douman", "durga", "kama"],
  305: ["atlantis", "orion", "mandricardo", "achilles"],
  306: ["olympus", "caenis", "dioscuri", "europa"],
  307: ["heian", "ibuki", "watanabe", "murasaki"],
  308: ["avalon", "fae", "morgan", "oberon", "vortigern", "melusine", "barghest", "baobhan", "altria caster", "castoria", "lady avalon"],
  309: ["tunguska", "koyanskaya"],
  310: ["traum", "charlemagne", "moriarty", "kriemhild"],
  311: ["nahui", "mictlan", "kukulkan", "tezcatlipoca", "tlaloc", "quetzal"],
  402: ["paper moon", "durga", "kali", "sion"],
  403: ["gehenna", "monte cristo", "avenger"],
};

async function fgoChapters() {
  const basicWars = await json("https://api.atlasacademy.io/export/NA/basic_war.json");
  const byId = new Map(basicWars.map((war) => [Number(war.id), war]));
  const chapters = await mapLimit(fgoMainWarIds, 5, async (id) => {
    const basic = byId.get(id) || {};
    let nice = {};
    try {
      nice = await json(`https://api.atlasacademy.io/nice/NA/war/${id}`);
    } catch {
      nice = {};
    }
    const name = String(basic.longName || basic.name || nice.longName || nice.name || `War ${id}`).replace(/\n+/g, " ").trim();
    return {
      id: `fgo_${id}`,
      war_id: id,
      labels: { zh: name, ko: name, en: name, ja: name },
      age: basic.age || nice.age || "",
      image: nice.banner || "",
      aliases: fgoChapterAliases[id] || [],
      items: (nice.spots || []).map((spot) => spot.name).filter(Boolean),
    };
  });
  return chapters;
}

const fateWorks = [
  { id: "stay_night", labels: lang("Fate/stay night", "Fate/stay night", "Fate/stay night", "Fate/stay night"), aliases: ["stay night", "rin tohsaka", "sakura matou", "shirou", "emiya", "saber alter", "saber lily", "garden of avalon"] },
  { id: "zero", labels: lang("Fate/Zero", "Fate/Zero", "Fate/Zero", "Fate/Zero"), aliases: ["fate/zero", "iskandar", "kiritsugu", "kirei", "waver", "el-melloi"] },
  { id: "prisma", labels: lang("魔法少女伊莉雅", "프리즈마 이리야", "Prisma Illya", "プリズマ☆イリヤ"), aliases: ["prisma", "illya", "illyasviel", "miyu", "kuro"] },
  { id: "extra", labels: lang("Fate/EXTRA", "Fate/EXTRA", "Fate/EXTRA", "Fate/EXTRA"), aliases: ["extra", "ccc", "meltryllis", "passionlip", "bb "] },
  { id: "apocrypha", labels: lang("Fate/Apocrypha", "Fate/Apocrypha", "Fate/Apocrypha", "Fate/Apocrypha"), aliases: ["apocrypha", "saber of red", "astolfo", "mordred", "semiramis"] },
  { id: "type_moon", labels: lang("型月其他", "타입문 기타", "Type-Moon Other", "TYPE-MOON その他"), aliases: ["tsukihime", "arcueid", "ciel", "shiki", "ryougi", "mahoyo", "aoko", "alice"] },
];

const armoredCoreGames = [
  {
    id: "ac1",
    labels: lang("装甲核心 初代系", "아머드 코어 초대계", "Armored Core 1 era", "アーマード・コア初代系"),
    aliases: ["project phantasma", "master of arena"],
    items: ["Armored Core", "Project Phantasma", "Master of Arena"],
  },
  {
    id: "ac2",
    labels: lang("装甲核心 2 系", "아머드 코어 2 계열", "Armored Core 2 era", "アーマード・コア2系"),
    aliases: ["armored core 2", "another age"],
    items: ["Armored Core 2", "Another Age"],
  },
  {
    id: "ac3",
    labels: lang("装甲核心 3 / NX / LR", "아머드 코어 3 / NX / LR", "Armored Core 3 / NX / LR", "アーマード・コア3 / NX / LR"),
    aliases: ["armored core 3", "silent line", "nexus", "last raven", "nine breaker", "formula front", "crest", "mirage", "kisaragi"],
    items: ["Armored Core 3", "Silent Line", "Nexus", "Nine Breaker", "Formula Front", "Last Raven"],
  },
  {
    id: "ac4",
    labels: lang("装甲核心 4 / fA", "아머드 코어 4 / fA", "Armored Core 4 / fA", "アーマード・コア4 / fA"),
    aliases: ["armored core 4", "for answer", "white glint", "lineark", "rayleonard", "rosenthal", "noblesse oblige"],
    items: ["Armored Core 4", "For Answer"],
  },
  {
    id: "acv",
    labels: lang("装甲核心 V / VD", "아머드 코어 V / VD", "Armored Core V / VD", "アーマード・コアV / VD"),
    aliases: ["armored core v", "verdict day"],
    items: ["Armored Core V", "Verdict Day"],
  },
  {
    id: "ac6",
    labels: lang("装甲核心 VI", "아머드 코어 VI", "Armored Core VI", "アーマード・コアVI"),
    aliases: ["armored core vi", "fires of rubicon", "30mm armored core", "balteus", "nightfall", "steel haze", "melander", "orbiter", "wrecker", "nachtreiher", "arquebus", "balam", "rubicon"],
    items: ["Fires of Rubicon", "BALTEUS", "Nightfall", "Steel Haze", "MELANDER", "ORBiter"],
  },
];

const taxonomy = {
  updated_at: new Date().toISOString().slice(0, 10),
  sources: {
    pokemon: "https://pokeapi.co/api/v2/generation/{id}/",
    fgo: "https://api.atlasacademy.io/export/NA/basic_war.json + /nice/NA/war/{id}",
    armored_core: "Manual game-era taxonomy from the public Armored Core release structure.",
  },
  pokemon: await pokemonGenerations(),
  fate: {
    fgo_chapters: await fgoChapters(),
    works: fateWorks,
  },
  armored_core: armoredCoreGames,
};

// Keep a quick audit count in the file so bad fetches are obvious in review.
taxonomy.counts = {
  pokemon_generations: taxonomy.pokemon.length,
  pokemon_species: taxonomy.pokemon.reduce((sum, generation) => sum + generation.species.length, 0),
  fgo_chapters: taxonomy.fate.fgo_chapters.length,
  ac_eras: taxonomy.armored_core.length,
};

await writeFile("data/atlas-source-taxonomy.json", `${JSON.stringify(taxonomy, null, 2)}\n`, "utf8");
console.log(`atlas taxonomy: ${JSON.stringify(taxonomy.counts)}`);

// Smoke check: PokeAPI currently has 1025 species through Gen IX.
if (taxonomy.counts.pokemon_species < 1000 || taxonomy.counts.fgo_chapters < 20) {
  throw new Error(`taxonomy fetch looks incomplete: ${JSON.stringify(taxonomy.counts)}`);
}
