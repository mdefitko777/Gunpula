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

const FGO_CHAPTER_LABELS = {
  fgo_100: lang("特异点 F 冬木", "특이점 F 후유키", "Singularity F · Fuyuki", "特異点F 冬木"),
  fgo_101: lang("第一特异点 奥尔良", "제1특이점 오를레앙", "Singularity I · Orleans", "第一特異点 オルレアン"),
  fgo_102: lang("第二特异点 七丘之城", "제2특이점 세프템", "Singularity II · Septem", "第二特異点 セプテム"),
  fgo_103: lang("第三特异点 俄刻阿诺斯", "제3특이점 오케아노스", "Singularity III · Okeanos", "第三特異点 オケアノス"),
  fgo_104: lang("第四特异点 伦敦", "제4특이점 런던", "Singularity IV · London", "第四特異点 ロンドン"),
  fgo_105: lang("第五特异点 北美神话大战", "제5특이점 북미 신화대전", "Singularity V · E Pluribus Unum", "第五特異点 北米神話大戦"),
  fgo_106: lang("第六特异点 卡美洛", "제6특이점 카멜롯", "Singularity VI · Camelot", "第六特異点 キャメロット"),
  fgo_107: lang("第七特异点 巴比伦尼亚", "제7특이점 바빌로니아", "Singularity VII · Babylonia", "第七特異点 バビロニア"),
  fgo_108: lang("终局特异点 所罗门", "종국특이점 솔로몬", "Final Singularity · Solomon", "終局特異点 ソロモン"),
  fgo_201: lang("亚种特异点 I 新宿", "아종특이점 I 신주쿠", "Pseudo-Singularity I · Shinjuku", "亜種特異点I 新宿"),
  fgo_202: lang("亚种特异点 II 雅戈泰", "아종특이점 II 아가르타", "Pseudo-Singularity II · Agartha", "亜種特異点II アガルタ"),
  fgo_203: lang("英灵剑豪七番胜负 下总国", "영령검호 시모사", "Epic of Remnant · Shimousa", "英霊剣豪七番勝負 下総国"),
  fgo_204: lang("亚种特异点 IV 塞勒姆", "아종특이점 IV 세일럼", "Pseudo-Singularity IV · Salem", "亜種特異点IV セイレム"),
  fgo_301: lang("Lostbelt No.1 阿纳斯塔西娅", "이문대 No.1 아나스타샤", "Lostbelt No.1 · Anastasia", "Lostbelt No.1 アナスタシア"),
  fgo_302: lang("Lostbelt No.2 诸神黄昏", "이문대 No.2 괴터데머룽", "Lostbelt No.2 · Gotterdammerung", "Lostbelt No.2 ゲッテルデメルング"),
  fgo_303: lang("Lostbelt No.3 SIN", "이문대 No.3 SIN", "Lostbelt No.3 · SIN", "Lostbelt No.3 SIN"),
  fgo_304: lang("Lostbelt No.4 创世灭亡轮回", "이문대 No.4 유가 크셰트라", "Lostbelt No.4 · Yuga Kshetra", "Lostbelt No.4 ユガ・クシェートラ"),
  fgo_305: lang("Lostbelt No.5 亚特兰蒂斯", "이문대 No.5 아틀란티스", "Lostbelt No.5 · Atlantis", "Lostbelt No.5 アトランティス"),
  fgo_306: lang("Lostbelt No.5 奥林波斯", "이문대 No.5 올림포스", "Lostbelt No.5 · Olympus", "Lostbelt No.5 オリュンポス"),
  fgo_307: lang("地狱界曼荼罗 平安京", "지옥계만다라 헤이안쿄", "Heian-kyo", "地獄界曼荼羅 平安京"),
  fgo_308: lang("Lostbelt No.6 妖精圆桌领域", "이문대 No.6 아발론 르 페이", "Lostbelt No.6 · Avalon le Fae", "Lostbelt No.6 アヴァロン・ル・フェ"),
  fgo_309: lang("通古斯卡 圣域", "퉁구스카 생추어리", "Tunguska Sanctuary", "ツングースカ・サンクチュアリ"),
  fgo_310: lang("死想显现界域 特劳姆", "사상현현계역 트라움", "Traum", "死想顕現界域 トラオム"),
  fgo_311: lang("Lostbelt No.7 纳维·米克特兰", "이문대 No.7 나우이 믹틀란", "Lostbelt No.7 · Nahui Mictlan", "Lostbelt No.7 ナウイ・ミクトラン"),
  fgo_402: lang("奏章 I Paper Moon", "주장 I 페이퍼 문", "Ordeal Call I · Paper Moon", "奏章I ペーパームーン"),
  fgo_403: lang("奏章 II Id", "주장 II 이드", "Ordeal Call II · Id", "奏章II イド"),
};

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
    id: "pokemon_general",
    labels: lang("全世代周边", "전 세대 굿즈", "All-generation goods", "全世代グッズ"),
    subtitle: lang("没有固定宝可梦或游戏世代", "특정 포켓몬/세대가 없는 상품", "Goods without a single species or generation", "特定のポケモン・世代を持たない商品"),
    image: "",
    items: [],
    kit_ids: [],
    count: 0,
  });
  const byId = new Map(groups.map((group) => [group.id, group]));
  const regionHints = [
    ["gen1", /kanto|カントー|関都|관동|关都|關都|red|green|blue|yellow/i],
    ["gen2", /johto|ジョウト|城都|성도|gold|silver|crystal/i],
    ["gen3", /hoenn|ホウエン|丰缘|豐緣|호연|ruby|sapphire|emerald/i],
    ["gen4", /sinnoh|シンオウ|神奥|神奧|신오|diamond|pearl|platinum/i],
    ["gen5", /unova|イッシュ|合众|合眾|하나|black|white/i],
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
      groupId = regionHints.find(([, pattern]) => pattern.test(rawText))?.[0] || null;
    }
    if (!groupId) {
      for (const [id, speciesNames] of speciesNamesByGeneration) {
        if (speciesNames.some((name) => text.includes(name))) {
          groupId = id;
          break;
        }
      }
    }
    const group = byId.get(groupId || "pokemon_general");
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
    labels: FGO_CHAPTER_LABELS[chapter.id] || namesFor(chapter.labels),
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
    id: "fate_general",
    labels: lang("Fate / FGO 角色周边", "Fate / FGO 캐릭터 굿즈", "Fate / FGO character goods", "Fate / FGO キャラクターグッズ"),
    subtitle: lang("没有固定章节归属", "특정 장에 속하지 않는 상품", "Goods without a fixed chapter", "特定の章に属さない商品"),
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
    const group = matchChapter(kit) || matchWork(kit) || unsorted;
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
    id: "ac_general",
    labels: lang("跨作机体 / 周边", "크로스 타이틀 기체 / 굿즈", "Cross-title machines / goods", "作品横断機体 / グッズ"),
    subtitle: lang("没有固定游戏世代", "특정 게임 세대 없음", "No single game era", "特定のゲーム世代なし"),
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
