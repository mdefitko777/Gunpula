import { readFile, writeFile } from "node:fs/promises";

const catalog = JSON.parse(await readFile("data/kits.json", "utf8"));
const taxonomy = JSON.parse(await readFile("data/atlas-source-taxonomy.json", "utf8"));
const ggetSections = JSON.parse(await readFile("data/gget-series-sections.json", "utf8"));
const kits = catalog.kits || [];

const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });
const itemText = (kit) =>
  [kit.names?.en, kit.names?.ja, kit.names?.zh, kit.names?.ko, kit.work_title, kit.universe, kit.subline, kit.grade_code, ...(kit.tags || [])]
    .filter(Boolean)
    .join(" ");
const normalized = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[&＆]/g, " and ")
    .replace(/['’.\-_:：/()[\]【】!！★☆]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const imageOf = (kit) => kit?.images?.box_art_url || kit?.gallery_image_urls?.[0] || "";

function namesFor(label, fallback = "") {
  if (!label) return lang(fallback, fallback, fallback, fallback);
  return {
    zh: label.zh || label.en || fallback,
    ko: label.ko || label.en || fallback,
    en: label.en || label.zh || fallback,
    ja: label.ja || label.en || fallback,
  };
}

function prefixDex(text) {
  const match = String(text || "").match(/(?:^|\s|[「【])(?:no\.?\s*)?0*([1-9]\d{0,3})(?=\s|[.:：\-]|$)/i);
  return match ? Number(match[1]) : null;
}

function pokemonGroups() {
  const speciesToGeneration = new Map();
  const speciesNamesByGeneration = new Map();
  for (const generation of taxonomy.pokemon || []) {
    const names = [];
    for (const species of generation.species || []) {
      speciesToGeneration.set(species.id, generation.id);
      for (const value of Object.values(species.names || {})) {
        const token = normalized(value);
        if (token && token.length > 1) names.push(token);
      }
      if (species.slug) names.push(normalized(species.slug));
    }
    speciesNamesByGeneration.set(generation.id, [...new Set(names)]);
  }

  const groups = (taxonomy.pokemon || []).map((generation) => ({
    id: generation.id,
    labels: namesFor(generation.labels, `Generation ${generation.generation}`),
    subtitle: generation.subtitle || lang(generation.region, generation.region, generation.region, generation.region),
    image: generation.image,
    items: (generation.species || []).map((species) => `${species.id}. ${species.names?.en || species.slug}`),
    kit_ids: [],
    count: 0,
  }));
  groups.push({
    id: "pokemon_unsorted",
    labels: lang("宝可梦 未校对", "포켓몬 미분류", "Pokemon Unsorted", "ポケモン 未分類"),
    subtitle: lang("没有明确 species / 游戏世代", "명확한 포켓몬/세대 없음", "Needs species or game tag", "species / 世代タグ待ち"),
    image: "",
    items: [],
    kit_ids: [],
    count: 0,
  });
  const byId = new Map(groups.map((group) => [group.id, group]));
  const versionHints = [
    ["gen6", /\bxy\b|xy|カロス|kalos/i],
    ["gen7", /sun|moon|サン|ムーン|アローラ|alola/i],
    ["gen8", /sword|shield|ソード|シールド|galar|ガラル/i],
    ["gen9", /scarlet|violet|スカーレット|バイオレット|paldea|パルデア/i],
  ];
  for (const kit of kits.filter((item) => item.franchise === "pokemon" && item.data_status !== "hidden")) {
    const rawText = itemText(kit);
    const text = normalized(rawText);
    const dex = prefixDex([kit.names?.en, kit.names?.ja, kit.names?.zh, kit.names?.ko].filter(Boolean).join(" "));
    let groupId = dex ? speciesToGeneration.get(dex) : null;
    if (!groupId) {
      groupId = versionHints.find(([, pattern]) => pattern.test(rawText))?.[0] || null;
    }
    if (!groupId) {
      for (const [id, speciesNames] of speciesNamesByGeneration) {
        if (speciesNames.some((name) => text.includes(name))) {
          groupId = id;
          break;
        }
      }
    }
    const group = byId.get(groupId || "pokemon_unsorted");
    group.kit_ids.push(kit.kit_id);
    group.count += 1;
    if (!group.image) group.image = imageOf(kit);
  }
  return groups;
}

function keywordMatcher(entries) {
  return (kit) => {
    const text = ` ${normalized(itemText(kit))} `;
    return entries.find((entry) => (entry.aliases || []).some((alias) => text.includes(` ${normalized(alias)} `)));
  };
}

function fateGroups() {
  const chapters = (taxonomy.fate?.fgo_chapters || []).map((chapter) => ({
    id: chapter.id,
    labels: namesFor(chapter.labels),
    subtitle: { zh: chapter.age || "FGO", ko: chapter.age || "FGO", en: chapter.age || "FGO", ja: chapter.age || "FGO" },
    image: chapter.image || "",
    aliases: chapter.aliases || [],
    items: chapter.items || [],
    kit_ids: [],
    count: 0,
  }));
  const works = (taxonomy.fate?.works || []).map((work) => ({
    id: work.id,
    labels: namesFor(work.labels),
    subtitle: lang("Fate 作品", "Fate 작품", "Fate work", "Fate 作品"),
    image: "",
    aliases: work.aliases || [],
    items: [],
    kit_ids: [],
    count: 0,
  }));
  const unsorted = {
    id: "fate_unsorted",
    labels: lang("Fate / FGO 未校对", "Fate / FGO 미분류", "Fate / FGO Unsorted", "Fate / FGO 未分類"),
    subtitle: lang("待补角色/章节关键词", "캐릭터/장 키워드 필요", "Needs character/chapter keywords", "キャラ/章キーワード待ち"),
    image: "",
    aliases: [],
    items: [],
    kit_ids: [],
    count: 0,
  };
  const groups = [...works, ...chapters, unsorted];
  const matchWork = keywordMatcher(works);
  const matchChapter = keywordMatcher(chapters);
  for (const kit of kits.filter((item) => item.franchise === "fate" && item.data_status !== "hidden")) {
    const group = matchWork(kit) || matchChapter(kit) || unsorted;
    group.kit_ids.push(kit.kit_id);
    group.count += 1;
    if (!group.image) group.image = imageOf(kit);
  }
  return groups;
}

function armoredCoreGroups() {
  const groups = (taxonomy.armored_core || []).map((game) => ({
    id: game.id,
    labels: namesFor(game.labels),
    subtitle: lang("游戏世代", "게임 세대", "Game era", "ゲーム世代"),
    image: "",
    aliases: game.aliases || [],
    items: game.items || [],
    kit_ids: [],
    count: 0,
  }));
  const unsorted = {
    id: "ac_unsorted",
    labels: lang("AC 未校对", "AC 미분류", "AC Unsorted", "AC 未分類"),
    subtitle: lang("待确认游戏来源", "게임 출처 확인 필요", "Needs game source", "ゲーム出典待ち"),
    image: "",
    aliases: [],
    items: [],
    kit_ids: [],
    count: 0,
  };
  const match = keywordMatcher(groups);
  for (const kit of kits.filter((item) => item.franchise === "armored_core" && item.data_status !== "hidden")) {
    const group = match(kit) || unsorted;
    group.kit_ids.push(kit.kit_id);
    group.count += 1;
    if (!group.image) group.image = imageOf(kit);
  }
  return [...groups, unsorted];
}

function gundamTimeline() {
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
  const labels = {
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
  return Object.entries(labels)
    .map(([id, groupLabels]) => {
      const groupWorks = works.filter((work) => family(work.name) === id);
      return {
        id,
        labels: groupLabels,
        subtitle: lang(`${groupWorks.length} 个作品`, `${groupWorks.length}개 작품`, `${groupWorks.length} works`, `${groupWorks.length}作品`),
        count: groupWorks.length,
        image: groupWorks.find((work) => work.image)?.image || "",
        works: groupWorks.map((work) => ({ work_id: work.work_id, name: work.name, image: work.image || "" })),
      };
    })
    .filter((group) => group.count);
}

const output = {
  updated_at: new Date().toISOString().slice(0, 10),
  source: "Generated from data/kits.json, data/atlas-source-taxonomy.json, and data/gget-series-sections.json",
  franchises: {
    gundam_timeline: gundamTimeline(),
    pokemon: pokemonGroups(),
    fate: fateGroups(),
    armored_core: armoredCoreGroups(),
  },
};

await writeFile("data/atlas-groups.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `atlas groups: pokemon ${output.franchises.pokemon.length}, fate ${output.franchises.fate.length}, ac ${output.franchises.armored_core.length}, gundam timeline ${output.franchises.gundam_timeline.length}`,
);
