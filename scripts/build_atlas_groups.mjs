import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
const ggetSections = JSON.parse(await readFile("data/gget-series-sections.json", "utf8"));
const kits = catalog.kits || [];

const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });
const textOf = (kit) =>
  [
    kit.kit_id,
    kit.names?.en,
    kit.names?.ja,
    kit.names?.zh,
    kit.names?.ko,
    kit.work_title,
    kit.universe,
    kit.subline,
    kit.grade_code,
    ...(kit.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const imageOf = (kit) => kit?.images?.box_art_url || kit?.gallery_image_urls?.[0] || "";

function groupKits(franchise, groups, fallbackId = "other") {
  const out = groups.map((group) => ({ ...group, kit_ids: [], count: 0, image: group.image || "" }));
  const fallback = out.find((group) => group.id === fallbackId);
  for (const kit of kits.filter((item) => item.franchise === franchise && item.data_status !== "hidden")) {
    const text = textOf(kit);
    const hit = out.find((group) => group.match?.some((pattern) => pattern.test(text))) || fallback;
    if (!hit) continue;
    hit.kit_ids.push(kit.kit_id);
    hit.count += 1;
    if (!hit.image) hit.image = imageOf(kit);
  }
  return out.filter((group) => group.count || !group.hideWhenEmpty).map(({ match, ...group }) => group);
}

function pokemonGeneration(kit) {
  const text = [kit.kit_id, kit.names?.ja, kit.names?.en, kit.names?.zh, kit.names?.ko].filter(Boolean).join(" ");
  const dex = Number(text.match(/(?:^|[^\d])([1-9]\d{0,3})(?=\s|[-_]|$)/)?.[1]);
  if (dex) {
    if (dex <= 151) return "gen1";
    if (dex <= 251) return "gen2";
    if (dex <= 386) return "gen3";
    if (dex <= 493) return "gen4";
    if (dex <= 649) return "gen5";
    if (dex <= 721) return "gen6";
    if (dex <= 809) return "gen7";
    if (dex <= 905) return "gen8";
    if (dex <= 1025) return "gen9";
  }
  const lower = text.toLowerCase();
  if (/pikachu|eevee|mewtwo|mew|gengar|charizard|magikarp|カントー|kanto/.test(lower)) return "gen1";
  if (/lugia|ho-oh|johto|ジョウト/.test(lower)) return "gen2";
  if (/rayquaza|gardevoir|groudon|kyogre|hoenn|ホウエン/.test(lower)) return "gen3";
  if (/piplup|garchomp|lucario|riolu|sinnoh|シンオウ/.test(lower)) return "gen4";
  if (/reshiram|zekrom|unova|イッシュ/.test(lower)) return "gen5";
  if (/greninja|xy|kalos|カロス/.test(lower)) return "gen6";
  if (/sun|moon|alola|サン|ムーン|アローラ/.test(lower)) return "gen7";
  if (/scorbunny|sword|shield|galar|ソード|シールド|ガラル/.test(lower)) return "gen8";
  if (/scarlet|violet|paldea|スカーレット|バイオレット|パルデア/.test(lower)) return "gen9";
  return "other";
}

function buildPokemonGroups() {
  const groups = [
    ["gen1", "第一世代", "1세대", "Gen I", "第1世代", "Kanto"],
    ["gen2", "第二世代", "2세대", "Gen II", "第2世代", "Johto"],
    ["gen3", "第三世代", "3세대", "Gen III", "第3世代", "Hoenn"],
    ["gen4", "第四世代", "4세대", "Gen IV", "第4世代", "Sinnoh"],
    ["gen5", "第五世代", "5세대", "Gen V", "第5世代", "Unova"],
    ["gen6", "第六世代", "6세대", "Gen VI", "第6世代", "Kalos"],
    ["gen7", "第七世代", "7세대", "Gen VII", "第7世代", "Alola"],
    ["gen8", "第八世代", "8세대", "Gen VIII", "第8世代", "Galar"],
    ["gen9", "第九世代", "9세대", "Gen IX", "第9世代", "Paldea"],
    ["other", "未分世代", "미분류", "Unsorted", "未分類", "Manual review"],
  ].map(([id, zh, ko, en, ja, subtitle]) => ({
    id,
    labels: lang(zh, ko, en, ja),
    subtitle: lang(subtitle, subtitle, subtitle, subtitle),
    kit_ids: [],
    count: 0,
    image: "",
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const kit of kits.filter((item) => item.franchise === "pokemon" && item.data_status !== "hidden")) {
    const group = byId.get(pokemonGeneration(kit)) || byId.get("other");
    group.kit_ids.push(kit.kit_id);
    group.count += 1;
    if (!group.image) group.image = imageOf(kit);
  }
  return groups.filter((group) => group.count);
}

const fateGroups = [
  {
    id: "fgo_lb6",
    labels: lang("FGO 妖精圆桌领域", "FGO 요정원탁영역", "FGO Lostbelt 6", "FGO 妖精円卓領域"),
    subtitle: lang("阿瓦隆・勒・菲", "아발론 르 페이", "Avalon le Fae", "アヴァロン・ル・フェ"),
    match: [/morgan|oberon|vortigern|melusine|barghest|baobhan|altria caster|castoria|lady avalon|妖精/],
  },
  {
    id: "fgo_orleans",
    labels: lang("FGO 奥尔良", "FGO 오를레앙", "FGO Orleans", "FGO オルレアン"),
    subtitle: lang("第一特异点", "제1특이점", "Singularity 1", "第一特異点"),
    match: [/jeanne|jalter|alter.*jeanne|ジャンヌ/],
  },
  {
    id: "fgo_babylonia",
    labels: lang("FGO 巴比伦尼亚", "FGO 바빌로니아", "FGO Babylonia", "FGO バビロニア"),
    subtitle: lang("第七特异点", "제7특이점", "Singularity 7", "第七特異点"),
    match: [/gilgamesh|ereshkigal|ishtar|enkidu|quetzal|ティアマト/],
  },
  {
    id: "fgo_shimousa",
    labels: lang("FGO 下总国", "FGO 시모사", "FGO Shimousa", "FGO 下総国"),
    subtitle: lang("亚种特异点", "아종특이점", "Pseudo-Singularity", "亜種特異点"),
    match: [/musashi|muramasa|raikou|shuten|tomoe|柳生|源頼光/],
  },
  {
    id: "fgo_india",
    labels: lang("FGO 印度异闻带", "FGO 인도 이문대", "FGO Lostbelt 4", "FGO インド異聞帯"),
    subtitle: lang("创世灭亡轮回", "창세멸망윤회", "Yuga Kshetra", "ユガ・クシェートラ"),
    match: [/arjuna|karna|ashiya douman|durga|kama|ガネーシャ/],
  },
  {
    id: "stay_night",
    labels: lang("Fate/stay night", "Fate/stay night", "Fate/stay night", "Fate/stay night"),
    subtitle: lang("本传", "본편", "Original routes", "本編"),
    match: [/stay night|rin tohsaka|sakura matou|shirou|archer.*emiya|saber alter|saber lily|garden of avalon/],
  },
  {
    id: "zero",
    labels: lang("Fate/Zero", "Fate/Zero", "Fate/Zero", "Fate/Zero"),
    subtitle: lang("第四次圣杯战争", "제4차 성배전쟁", "Fourth Holy Grail War", "第四次聖杯戦争"),
    match: [/fate\/zero|iskandar|kiritsugu|kirei|waver|el-melloi/],
  },
  {
    id: "prisma",
    labels: lang("魔法少女伊莉雅", "프리즈마 이리야", "Prisma Illya", "プリズマ☆イリヤ"),
    subtitle: lang("kaleid liner", "kaleid liner", "kaleid liner", "kaleid liner"),
    match: [/prisma|illya|illyasviel|miyu|kuro/],
  },
  {
    id: "extra",
    labels: lang("Fate/EXTRA", "Fate/EXTRA", "Fate/EXTRA", "Fate/EXTRA"),
    subtitle: lang("EXTRA / CCC", "EXTRA / CCC", "EXTRA / CCC", "EXTRA / CCC"),
    match: [/extra|ccc|bb |meltryllis|passionlip/],
  },
  {
    id: "type_moon",
    labels: lang("型月其他", "타입문 기타", "Type-Moon Other", "TYPE-MOON その他"),
    subtitle: lang("月姬 / 空境 / 魔夜", "월희 / 공의 경계 / 마밤", "Tsukihime / KnK / Mahoyo", "月姫 / 空の境界 / まほよ"),
    match: [/tsukihime|arcueid|ciel|shiki|ryougi|mahoyo|aoko|alice|魔法使い/],
  },
  {
    id: "fgo_other",
    labels: lang("FGO 其他", "FGO 기타", "FGO Other", "FGO その他"),
    subtitle: lang("待细分章节", "세부 장 분류 대기", "Needs chapter tags", "章分類待ち"),
    match: [/fate \/ grand order|fgo|shielder|mash|nero|tamamo|oda nobunaga|okita|anastasia|koyanskaya|sei shonagon|erice|kadoc|monte cristo|charlemagne|takasugi|saber|lancer|archer|rider|caster|assassin|berserker|ruler|avenger|foreigner|pretender|alter ego/],
  },
  {
    id: "other",
    labels: lang("Fate 未分类", "Fate 미분류", "Fate Unsorted", "Fate 未分類"),
    subtitle: lang("待人工校对", "수동 확인 필요", "Manual review", "手動確認待ち"),
    hideWhenEmpty: true,
  },
];

const acGroups = [
  {
    id: "ac6",
    labels: lang("装甲核心 VI", "아머드 코어 VI", "Armored Core VI", "アーマード・コアVI"),
    subtitle: lang("境界天火", "루비콘의 화염", "Fires of Rubicon", "ファイアーズオブルビコン"),
    match: [/armored core vi|fires of rubicon|30mm armored core|balteus|nightfall|steel haze|melander|orbiter|wrecker|nachtreiher|arquebus|balam|rubicon/],
  },
  {
    id: "acv",
    labels: lang("装甲核心 V / VD", "아머드 코어 V / VD", "Armored Core V / VD", "アーマード・コアV / VD"),
    subtitle: lang("V 系", "V 계열", "V era", "V系"),
    match: [/armored core v\b|verdict day|\bacv\b|\bvd\b/],
  },
  {
    id: "ac4",
    labels: lang("装甲核心 4 / fA", "아머드 코어 4 / fA", "Armored Core 4 / fA", "アーマード・コア4 / fA"),
    subtitle: lang("N 污染时代", "넥스트 시대", "NEXT era", "NEXT時代"),
    match: [/armored core 4|for answer|\bfa\b|white glint|lineark|rayleonard|rosenthal|noblesse oblige/],
  },
  {
    id: "ac3",
    labels: lang("装甲核心 3 系", "아머드 코어 3 계열", "Armored Core 3 era", "アーマード・コア3系"),
    subtitle: lang("3 / Silent Line / Nexus / Last Raven", "3 / SL / NX / LR", "3 / SL / NX / LR", "3 / SL / NX / LR"),
    match: [/armored core 3|silent line|nexus|last raven|crest|mirage|kisaragi/],
  },
  {
    id: "ac_legacy",
    labels: lang("装甲核心 旧作", "아머드 코어 구작", "Armored Core Legacy", "アーマード・コア旧作"),
    subtitle: lang("初代 / 2 / AA", "초대 / 2 / AA", "AC1 / AC2 / AA", "初代 / 2 / AA"),
    match: [/armored core(?! vi)|master of arena|project phantasma|another age/],
  },
  {
    id: "other",
    labels: lang("AC 未分类", "AC 미분류", "AC Unsorted", "AC 未分類"),
    subtitle: lang("待人工校对", "수동 확인 필요", "Manual review", "手動確認待ち"),
  },
];

function buildGundamTimeline() {
  const family = (name) => {
    const s = String(name || "").toLowerCase();
    if (s.includes("seed")) return "seed";
    if (s.includes("gundam 00") || s.includes("celestial being")) return "double_o";
    if (s.includes("wing")) return "wing";
    if (s.includes("iron-blooded")) return "iron_blooded";
    if (s.includes("witch from mercury")) return "witch";
    if (s.includes("gquuuuuux")) return "gquuuuuux";
    if (s.includes("age")) return "age";
    if (s.includes("build") || s.includes("gunpla builders")) return "build";
    if (s.includes("fighter g gundam")) return "g";
    if (s.includes("gundam x")) return "x";
    if (s.includes("turn a")) return "turn_a";
    if (s.includes("reconguista")) return "g_reco";
    if (s.includes("sd ") || s.includes("sangoku") || s.includes("sengokuden")) return "sd";
    return "uc";
  };
  const familyLabels = {
    uc: lang("宇宙世纪 UC", "우주세기 UC", "Universal Century", "宇宙世紀 UC"),
    seed: lang("SEED 宇宙", "SEED 우주", "Cosmic Era", "コズミック・イラ"),
    double_o: lang("00 宇宙", "00 우주", "Anno Domini", "西暦"),
    wing: lang("W 宇宙", "W 우주", "After Colony", "アフターコロニー"),
    iron_blooded: lang("铁血宇宙", "철혈 우주", "Post Disaster", "ポスト・ディザスター"),
    witch: lang("水星宇宙", "수성 우주", "Ad Stella", "アド・ステラ"),
    gquuuuuux: lang("GQuuuuuuX", "GQuuuuuuX", "GQuuuuuuX", "GQuuuuuuX"),
    age: lang("AGE 宇宙", "AGE 우주", "Advanced Generation", "アドバンスド・ジェネレーション"),
    build: lang("创战 / Build", "빌드", "Build", "ビルド"),
    g: lang("G 武斗传", "G 건담", "Future Century", "未来世紀"),
    x: lang("X 宇宙", "X 우주", "After War", "アフターウォー"),
    turn_a: lang("∀ 宇宙", "∀ 우주", "Correct Century", "正暦"),
    g_reco: lang("G 复国", "G 레코", "Regild Century", "リギルド・センチュリー"),
    sd: lang("SD / 三国", "SD / 삼국", "SD / Sangoku", "SD / 三国"),
  };
  const works = ggetSections.works || [];
  return Object.entries(familyLabels).map(([id, labels]) => {
    const familyWorks = works.filter((work) => family(work.name) === id);
    return {
      id,
      labels,
      subtitle: lang(`${familyWorks.length} 个作品`, `${familyWorks.length}개 작품`, `${familyWorks.length} works`, `${familyWorks.length}作品`),
      count: familyWorks.length,
      image: familyWorks.find((work) => work.image)?.image || "",
      works: familyWorks.map((work) => ({
        work_id: work.work_id,
        name: work.name,
        image: work.image || "",
      })),
    };
  }).filter((group) => group.count);
}

const output = {
  updated_at: new Date().toISOString().slice(0, 10),
  source: "Generated from data/kits.json and data/gget-series-sections.json",
  franchises: {
    gundam_timeline: buildGundamTimeline(),
    pokemon: buildPokemonGroups(),
    fate: groupKits("fate", fateGroups),
    armored_core: groupKits("armored_core", acGroups),
  },
};

await writeFile("data/atlas-groups.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `atlas groups: pokemon ${output.franchises.pokemon.length}, fate ${output.franchises.fate.length}, ac ${output.franchises.armored_core.length}, gundam timeline ${output.franchises.gundam_timeline.length}`,
);
