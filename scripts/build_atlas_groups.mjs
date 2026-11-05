// Builds data/atlas-groups.json: the Atlas "world" cards of the Hobby Atlas app (one card per
// group with an official cover image, label and the kit_ids that belong to it).
//
// No network: everything comes from committed files, so the daily catalog refresh can run it
// and the same inputs always give the same output.
//   data/kits.json                     products
//   data/atlas-source-taxonomy.json    Pokémon species per generation (PokeAPI)
//   data/gget-series-sections.json     Gundam works (timeline groups)
//   data/atlas/fate-roster.json        Fate works, FGO chapters, servants (build_fate_roster.mjs)
//   data/atlas/atlas-covers.json       official cover images (build_atlas_covers.mjs)
//   scripts/atlas/atlas_titles.mjs     Pokémon game titles, Armored Core eras and rosters
//
// Shape (backward compatible): franchises.{pokemon,fate,armored_core}[] =
//   {id, labels{zh,ko,en,ja}, subtitle, image, kit_ids[], count, …}
// plus `kind`, `image_remote`, `cover_source`, `roster` (and per-franchise extras), and a
// top-level `channels` map with one official header image per channel, and a top-level
// `line_covers` map {<franchise>: {<grade_code | BX | UX | CX>: {image, image_remote,
// cover_source, kind: "logo" | "key_visual"}}} with the official image of each product line.
// Empty groups are left out. `--report=<file>` writes every product's group and reason (for review).
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { armoredCoreClassifier, fateClassifier, lang, madokaClassifier, MADOKA_CHARACTERS, pokemonClassifier, POKEMON_GAMES, AC_TITLES, productText } from "./atlas/lib/atlas_groups.mjs";

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
};

const catalog = await readJson("data/kits.json");
const taxonomy = await readJson("data/atlas-source-taxonomy.json");
const ggetSections = await readJson("data/gget-series-sections.json");
const fateRoster = await readJson("data/atlas/fate-roster.json");
const bbxDatabase = await readJson("data/bbx-database.json", { products: [], series: [] });
const bbxBladers = await readJson("data/atlas/bbx-bladers.json", { bladers: [] });
const coverFile = await readJson("data/atlas/atlas-covers.json", { covers: {} });
const reportArg = process.argv.find((a) => a.startsWith("--report="))?.slice(9);
const kits = (catalog.kits || []).filter((kit) => kit.data_status !== "hidden");

const covers = coverFile.covers || {};
function cover(key, fallbackKey) {
  const c = covers[key] || (fallbackKey && covers[fallbackKey]);
  if (!c) return { image: "" };
  return { image: c.image, image_remote: c.image_remote, cover_source: c.source_page };
}

const report = [];
function collect(franchise, classify, groups) {
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const kit of kits.filter((k) => k.franchise === franchise)) {
    const result = classify(kit);
    const group = byId.get(result.group);
    if (!group) throw new Error(`${franchise}: classifier returned unknown group ${result.group}`);
    group.kit_ids.push(kit.kit_id);
    report.push({ franchise, kit_id: kit.kit_id, group: result.group, reason: result.reason, names: result.names, title: productText(kit) });
  }
  return groups.map((g) => ({ ...g, count: g.kit_ids.length })).filter((g) => g.count > 0);
}

// ─────────────── Pokémon: groups named after each generation's games ───────────────
function pokemonGroups() {
  const generations = new Map((taxonomy.pokemon || []).map((g) => [g.id, g]));
  const groups = Object.entries(POKEMON_GAMES).map(([id, game]) => {
    const gen = generations.get(id);
    return {
      id,
      kind: "generation",
      generation: game.generation,
      region: game.region,
      labels: game.labels,
      subtitle: game.subtitle,
      games: game.games,
      ...cover(`pokemon:${id}`, "channel:pokemon"),
      items: (gen?.species || []).map((s) => `${s.id}. ${s.names?.en || s.slug}`),
      roster_count: gen?.species?.length || 0,
      kit_ids: [],
    };
  });
  groups.push({
    id: "pokemon_general",
    kind: "multi_generation",
    labels: lang("跨世代宝可梦周边", "여러 세대 포켓몬 굿즈", "Multi-generation goods", "複数世代のポケモングッズ"),
    subtitle: lang("同时登场多个世代的宝可梦", "여러 세대의 포켓몬이 함께 나오는 상품", "Pokémon from several generations together", "複数の世代のポケモンが一緒の商品"),
    ...cover("channel:pokemon"),
    items: [],
    kit_ids: [],
  });
  groups.push({
    id: "pokemon_common",
    kind: "common",
    labels: lang("宝可梦通用周边", "포켓몬 공통 굿즈", "General Pokémon goods", "ポケモン共通グッズ"),
    subtitle: lang("精灵球 · 标志 · 训练家 等", "몬스터볼 · 로고 · 트레이너 등", "Poké Balls, logos, trainers …", "モンスターボール・ロゴ・トレーナーなど"),
    ...cover("channel:pokemon"),
    items: [],
    kit_ids: [],
  });
  return collect("pokemon", pokemonClassifier(taxonomy.pokemon || []).classify, groups);
}

// ─────────────── Fate: FGO chapters, then the other works ───────────────
function fateGroups() {
  const servantsByChapter = new Map();
  for (const s of fateRoster.servants) {
    const ch = s.chapter || "fgo_event";
    if (!servantsByChapter.has(ch)) servantsByChapter.set(ch, []);
    servantsByChapter.get(ch).push(s);
  }
  const rosterOf = (list) => list.map((s) => ({ no: s.no, ja: s.names.ja, ko: s.names.ko || s.names.ja, en: s.names.en }));
  const servantCount = (n) => lang(`从者 ${n} 骑`, `서번트 ${n}기`, `${n} servants`, `サーヴァント ${n}騎`);
  const join = (a, b) => ({ zh: `${a.zh} · ${b.zh}`, ko: `${a.ko} · ${b.ko}`, en: `${a.en} · ${b.en}`, ja: `${a.ja}・${b.ja}` });

  const chapterGroups = fateRoster.chapters.map((c) => {
    const list = servantsByChapter.get(c.id) || [];
    return {
      id: c.id,
      kind: "fgo_chapter",
      work: "fgo",
      part: c.part,
      war_id: c.war_id,
      labels: c.labels,
      subtitle: join(fateRoster.part_labels[c.part], servantCount(list.length)),
      ...cover(`fate:${c.id}`, "fate:fgo"),
      roster: rosterOf(list),
      kit_ids: [],
    };
  });
  const eventServants = servantsByChapter.get("fgo_event") || [];
  const fgoExtra = [
    {
      id: "fgo_event",
      kind: "fgo_event",
      work: "fgo",
      labels: lang("FGO 活动·限定从者", "FGO 이벤트·한정 서번트", "FGO event & limited servants", "FGO イベント・期間限定サーヴァント"),
      subtitle: join(lang("未在主线章节召唤中登场", "메인 스토리 장 픽업에 없던 서번트", "Not on a story-chapter pickup", "メインストーリー章のピックアップ外"), servantCount(eventServants.length)),
      ...cover("fate:fgo", "channel:fate"),
      roster: rosterOf(eventServants),
      kit_ids: [],
    },
    {
      id: "fgo_fes",
      kind: "fgo_goods",
      work: "fgo",
      labels: lang("FGO Fes. · 周年周边", "FGO Fes. · 주년 굿즈", "FGO Fes. & anniversary goods", "FGO Fes.・周年グッズ"),
      subtitle: lang("没有单一从者的 Fes. 周边", "특정 서번트가 없는 Fes. 굿즈", "Fes. goods without a single servant", "特定サーヴァントのない Fes. グッズ"),
      ...cover("channel:fate", "fate:fgo"),
      roster: [],
      kit_ids: [],
    },
    {
      id: "fgo_events",
      kind: "fgo_goods",
      work: "fgo",
      labels: lang("FGO 展览 · 活动 · 门票", "FGO 전시 · 이벤트 · 티켓", "FGO exhibitions, events & tickets", "FGO 展示・イベント・チケット"),
      subtitle: lang("冬祭 · 展览会 · 实景解谜 · 联动", "겨울축제 · 전시회 · 리얼 탈출 게임 · 콜라보", "Winter Fes., exhibitions, escape games, collaborations", "冬祭り・展覧会・リアル脱出ゲーム・コラボ"),
      ...cover("channel:fate", "fate:fgo"),
      roster: [],
      kit_ids: [],
    },
    {
      id: "fgo_media",
      kind: "fgo_goods",
      work: "fgo",
      labels: lang("FGO 音乐 · 影像 · 书籍", "FGO 음반 · 영상 · 서적", "FGO music, video & books", "FGO 音楽・映像・書籍"),
      subtitle: lang("原声 · Blu-ray · 画集", "OST · 블루레이 · 화집", "Soundtracks, Blu-ray, art books", "サントラ・Blu-ray・画集"),
      ...cover("fate:fgo", "channel:fate"),
      roster: [],
      kit_ids: [],
    },
    {
      id: "fgo_common",
      kind: "fgo_goods",
      work: "fgo",
      labels: lang("FGO 综合周边", "FGO 공통 굿즈", "FGO general goods", "FGO 共通グッズ"),
      subtitle: lang("随机 · 多从者套装等", "랜덤 · 여러 서번트 세트 등", "Random and multi-servant sets", "ランダム・複数サーヴァントのセットなど"),
      ...cover("channel:fate", "fate:fgo"),
      roster: [],
      kit_ids: [],
    },
  ];
  const workGroups = fateRoster.works.map((w) => ({
    id: w.id,
    kind: "work",
    work: w.id,
    labels: w.labels,
    subtitle: w.subtitle,
    ...cover(`fate:${w.id}`, "fate:type_moon"),
    roster: w.characters.map((c) => ({ ja: c.ja, ko: c.ko, en: c.en })),
    kit_ids: [],
  }));
  const general = {
    id: "fate_general",
    kind: "unsorted",
    labels: lang("其他 Fate / TYPE-MOON 周边", "기타 Fate / TYPE-MOON 굿즈", "Other Fate / TYPE-MOON goods", "その他の Fate / TYPE-MOON グッズ"),
    subtitle: lang("无法判断作品", "작품을 알 수 없는 상품", "Work could not be identified", "作品を特定できない商品"),
    ...cover("fate:type_moon", "channel:fate"),
    roster: [],
    kit_ids: [],
  };
  return collect("fate", fateClassifier(fateRoster).classify, [...chapterGroups, ...fgoExtra, ...workGroups, general]);
}

// ─────────────── Armored Core: game eras ───────────────
function armoredCoreGroups() {
  const groups = AC_TITLES.map((t) => ({
    id: t.id,
    kind: "game_era",
    labels: t.labels,
    subtitle: t.subtitle,
    games: t.games,
    ...cover(`armored_core:${t.id}`, "channel:armored_core"),
    roster: t.roster.filter((n) => /[^\x00-\x7f]/.test(n)).slice(0, 12),
    kit_ids: [],
  }));
  groups.push({
    id: "ac_general",
    kind: "unsorted",
    labels: lang("跨作品 / 其他", "작품 공통 / 기타", "Cross-title / other", "作品横断 / その他"),
    subtitle: lang("无法判断游戏世代", "게임 세대를 알 수 없는 상품", "Game era could not be identified", "ゲーム世代を特定できない商品"),
    ...cover("channel:armored_core"),
    roster: [],
    kit_ids: [],
  });
  return collect("armored_core", armoredCoreClassifier().classify, groups);
}

// ─────────────── 魔法少女まどか☆マギカ: characters ───────────────
function madokaGroups() {
  const groups = MADOKA_CHARACTERS.map((c) => ({
    id: c.id,
    kind: "character",
    labels: c.labels,
    subtitle: lang("", "", "", ""),
    ...cover(`madoka:${c.id}`, "channel:madoka"),
    kit_ids: [],
  }));
  groups.push({
    id: "madoka_ensemble",
    kind: "ensemble",
    labels: lang("多人", "여러 캐릭터", "Several characters", "複数キャラクター"),
    subtitle: lang("一件商品里有好几位角色", "한 상품에 여러 캐릭터", "Several characters in one product", "一つの商品に複数のキャラクター"),
    ...cover("channel:madoka"),
    kit_ids: [],
  });
  groups.push({
    id: "madoka_general",
    kind: "unsorted",
    labels: lang("套装 · 其他", "세트 · 기타", "Sets / other", "セット・その他"),
    subtitle: lang("一番赏、盲盒等没写明角色的商品", "제일복권 · 트레이딩처럼 캐릭터가 적혀 있지 않은 상품", "Lotteries, trading sets and others with no character named", "一番くじ・トレーディングなどキャラクター名のない商品"),
    ...cover("channel:madoka"),
    kit_ids: [],
  });
  // No official cover per character: show the newest product picture of that character.
  const byId = new Map(kits.map((k) => [k.kit_id, k]));
  return collect("madoka", madokaClassifier().classify, groups).map((g) => {
    if (g.image) return g;
    const newest = g.kit_ids
      .map((id) => byId.get(id))
      .filter((k) => k?.images?.box_art_url)
      .sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")))[0];
    return newest ? { ...g, image: newest.images.box_art_url, cover_source: "newest product picture" } : g;
  });
}

// ─────────────── BEYBLADE X: bladers (who uses the bey, data/atlas/bbx-bladers.json) ───────────────
// A product belongs to every blader whose blade (or CX main / metal / over blade) it contains, so a
// random booster or a shared blade can be in several groups. Catalog kit id = beyblade-x-<product id>.
// Kits the parts database doesn't list (event / store limited BX-00, newest releases) are matched by
// the blade name in the product name instead (コバルトドラグーン2-60C メタルコート:ブラック).
function beybladeGroups() {
  const byName = (bbxBladers.bladers || [])
    .flatMap((b) => b.blades.map((x) => ({ name: x.name_ja, id: b.id })))
    .filter((x) => x.name)
    .sort((a, c) => c.name.length - a.name.length);
  const namedBladers = (kit) => {
    const text = String(kit.names?.ja || "");
    const hit = byName.find((x) => text.includes(x.name));
    return hit ? new Set(byName.filter((x) => x.name === hit.name).map((x) => x.id)) : new Set();
  };
  const catalogIds = new Set(kits.filter((k) => k.franchise === "beyblade").map((k) => k.kit_id));
  const seriesBySet = new Map();
  for (const s of bbxDatabase.series || []) (seriesBySet.get(s.base_set_id) || seriesBySet.set(s.base_set_id, []).get(s.base_set_id)).push(s);
  const productParts = (product) =>
    new Set((seriesBySet.get(product.base_set_id) || []).flatMap((s) => [s.blade_id, s.main_blade_id, s.metal_blade_id, s.over_blade_id]).filter(Boolean));
  const products = (bbxDatabase.products || [])
    .map((p) => ({ product: p, kitId: `beyblade-x-${String(p.product_id).toLowerCase()}`, parts: productParts(p) }))
    .filter((p) => catalogIds.has(p.kitId));
  const listed = new Set(products.map((p) => p.kitId));
  const unlisted = kits.filter((k) => k.franchise === "beyblade" && !listed.has(k.kit_id));
  return (bbxBladers.bladers || [])
    .map((b) => {
      const ids = new Set(b.blades.flatMap((x) => [...(x.blade_ids || [x.blade_id]), ...(x.main_blade_ids || []), ...(x.metal_blade_ids || []), ...(x.over_blade_ids || [])]));
      const mine = products.filter((p) => [...p.parts].some((id) => ids.has(id)));
      const byNameKits = unlisted.filter((k) => namedBladers(k).has(b.id));
      const newest = [...mine].sort((a, c) => String(c.product.release_date || "").localeCompare(String(a.product.release_date || "")))[0];
      return {
        id: b.id,
        kind: "blader",
        labels: lang(b.names.zh, b.names.ko, b.names.en, b.names.ja),
        subtitle: lang(b.team || "", b.team || "", b.team || "", b.team || ""),
        image: newest ? newest.product.image || newest.product.image_remote || "" : "",
        cover_source: "newest product picture",
        blades: b.blades.map((x) => x.name_ja),
        kit_ids: [...mine.map((p) => p.kitId), ...byNameKits.map((k) => k.kit_id)],
      };
    })
    .map((g) => ({ ...g, count: g.kit_ids.length }))
    .filter((g) => g.count > 0)
    .sort((a, c) => c.count - a.count);
}

// ─────────────── LEGO: one group per Rebrickable top-level theme (work_title) ───────────────
function legoGroups() {
  const ko = JSON.parse(readFileSync("data/lego/theme-labels-ko.json", "utf8")).labels;
  const byTheme = new Map();
  for (const k of kits.filter((x) => x.franchise === "lego")) {
    const theme = k.work_title || "Other";
    (byTheme.get(theme) || byTheme.set(theme, []).get(theme)).push(k);
  }
  return [...byTheme.entries()]
    .map(([theme, list]) => {
      const newest = [...list]
        .filter((k) => k.images?.box_art_url)
        .sort((a, b) => String(b.release_date || "").localeCompare(String(a.release_date || "")) || (b.tags?.length || 0) - (a.tags?.length || 0))[0];
      return {
        id: `lego_${theme.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other"}`,
        kind: "theme",
        labels: lang(theme, ko[theme] || theme, theme, theme),
        subtitle: lang("", "", "", ""),
        image: newest?.images.box_art_url || "",
        cover_source: "newest set picture (Rebrickable)",
        kit_ids: list.map((k) => k.kit_id),
        count: list.length,
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ─────────────── Gundam timeline (unchanged: GGEN series logos per work) ───────────────
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
        kind: "timeline",
        labels: groupLabels,
        subtitle: lang(`${groupWorks.length} 个作品`, `${groupWorks.length}개 작품`, `${groupWorks.length} works`, `${groupWorks.length}作品`),
        count: groupWorks.length,
        image: groupWorks.find((work) => work.image)?.image || "",
        cover_source: "G Generation series logo (official game asset) via soshage.com GGET",
        works: groupWorks.map((work) => ({ work_id: work.work_id, name: work.name, image: work.image || "" })),
      };
    })
    .filter((group) => group.count);
}

function channels() {
  const ch = (id, label) => ({ label, ...cover(`channel:${id}`) });
  return {
    gundam: ch("gundam", lang("高达", "건담", "Gundam", "ガンダム")),
    beyblade: ch("beyblade", lang("战斗陀螺 X", "베이블레이드 X", "BEYBLADE X", "ベイブレードエックス")),
    pokemon: ch("pokemon", lang("宝可梦", "포켓몬", "Pokémon", "ポケモン")),
    fate: ch("fate", lang("Fate", "Fate", "Fate", "Fate")),
    armored_core: ch("armored_core", lang("装甲核心", "아머드 코어", "Armored Core", "アーマード・コア")),
    madoka: ch("madoka", lang("魔法少女小圆", "마도카 마기카", "Madoka Magica", "まどか☆マギカ")),
    lego: ch("lego", lang("乐高", "레고", "LEGO", "レゴ")),
  };
}

// "종류별 도감" cards: official logo / key visual per product line, from the covers keyed
// line:<franchise>:<grade_code> (BEYBLADE X: line:beyblade:BX|UX|CX). Curated in
// scripts/atlas/lib/line_covers.mjs, downloaded by build_atlas_covers.mjs.
function lineCovers() {
  const out = {};
  for (const [key, c] of Object.entries(covers).sort(([a], [b]) => a.localeCompare(b))) {
    const m = key.match(/^line:([a-z_]+):([A-Za-z0-9_]+)$/);
    if (!m || !c.image) continue;
    (out[m[1]] ||= {})[m[2]] = { image: c.image, image_remote: c.image_remote, cover_source: c.source_page, kind: c.kind || "logo" };
  }
  return out;
}

const output = {
  updated_at: catalog.updated_at || "",
  source:
    "Generated from data/kits.json, data/atlas-source-taxonomy.json (PokeAPI species), data/gget-series-sections.json, data/atlas/fate-roster.json (Atlas Academy + Mooncell + hand-kept works) and data/atlas/atlas-covers.json by scripts/build_atlas_groups.mjs",
  channels: channels(),
  line_covers: lineCovers(),
  franchises: {
    gundam_timeline: gundamTimeline(),
    pokemon: pokemonGroups(),
    fate: fateGroups(),
    armored_core: armoredCoreGroups(),
    madoka: madokaGroups(),
    beyblade: beybladeGroups(),
    lego: legoGroups(),
  },
};

await writeFile("data/atlas-groups.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
if (reportArg) await writeFile(reportArg, `${JSON.stringify(report, null, 1)}\n`, "utf8");
const summary = (list) => list.map((g) => `${g.id}:${g.count}`).join(" ");
console.log(`atlas groups: pokemon ${output.franchises.pokemon.length}, fate ${output.franchises.fate.length}, ac ${output.franchises.armored_core.length}, gundam timeline ${output.franchises.gundam_timeline.length}`);
for (const f of ["pokemon", "fate", "armored_core", "madoka", "beyblade"]) console.log(`  ${f}: ${summary(output.franchises[f])}`);
