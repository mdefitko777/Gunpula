// Classification behind data/atlas-groups.json (pure functions, no IO; used by
// scripts/build_atlas_groups.mjs and scripts/atlas/test_atlas_groups.mjs).
//
// Every franchise follows the same idea: first establish what belongs to each series (the
// roster: servants and characters per Fate work / FGO chapter, species per Pokémon
// generation, machines and corporations per Armored Core era), then find those names in the
// product title and put the product in the group its names belong to. A title that names
// the work outright ("Fate/Zero", "ARMORED CORE VI", "スカーレット・バイオレット") wins over
// the characters it shows.
import { buildMatcher, compactKey, containsAny } from "./textmatch.mjs";
import { AC_TITLES, POKEMON_FORM_WORDS, POKEMON_GAMES, POKEMON_GEN_WORDS, POKEMON_NAME_STOPLIST, POKEMON_TRAINERS } from "../atlas_titles.mjs";

export const lang = (zh, ko, en, ja) => ({ zh, ko, en, ja });

export function productText(kit) {
  return [...new Set([kit.names?.ja, kit.names?.en, kit.names?.zh, kit.names?.ko].filter(Boolean))].join(" / ");
}

const uniq = (list) => [...new Set(list.filter(Boolean))];

// ─────────────────────────────── Fate ───────────────────────────────

const CLASS_WORDS = {
  saber: ["saber", "セイバー", "세이버", "剑阶"],
  archer: ["archer", "アーチャー", "아처", "弓阶"],
  lancer: ["lancer", "ランサー", "랜서", "枪阶"],
  rider: ["rider", "ライダー", "라이더", "骑阶"],
  caster: ["caster", "キャスター", "캐스터", "术阶"],
  assassin: ["assassin", "アサシン", "어새신", "杀阶"],
  berserker: ["berserker", "バーサーカー", "버서커", "狂阶"],
  ruler: ["ruler", "ルーラー", "룰러"],
  avenger: ["avenger", "アヴェンジャー", "어벤저"],
  moonCancer: ["mooncancer", "moon cancer", "ムーンキャンサー", "문캔서"],
  alterEgo: ["alterego", "alter ego", "アルターエゴ", "얼터에고"],
  foreigner: ["foreigner", "フォーリナー", "포리너"],
  pretender: ["pretender", "プリテンダー", "프리텐더"],
  shielder: ["shielder", "シールダー", "실더"],
};
const CLASS_KEYS = Object.entries(CLASS_WORDS).flatMap(([cls, words]) => words.map((w) => [compactKey(w), cls]));
const classNear = (before, after) => {
  for (const [key, cls] of CLASS_KEYS) if (before.endsWith(key) || after.startsWith(key)) return cls;
  return null;
};

function aniplexCodes(kit) {
  const urls = [kit.images?.box_art_url, ...(kit.gallery_image_urls || []), ...(kit.source_urls || [])];
  const codes = [];
  for (const u of urls) {
    const m = String(u || "").match(/\/items\/title-[A-Za-z]\/([^/]+)\/([^/]+)/);
    if (m) codes.push(m[1].toLowerCase(), `${m[1]}/${m[2]}`.toLowerCase());
  }
  return uniq(codes);
}

// FGO goods that name no single servant, by kind. `codes` are Aniplex+ catalogue folders
// (title-H/fgo/<folder>/…); the first kind that matches wins.
export const FGO_GOODS_KINDS = [
  {
    id: "fgo_media",
    why: "music / video / book",
    codes: ["fgo/ost", "fgo/fgo_bdbox_ost", "fgo/jyutaku_", "fgc/jk", "fgc/1-2set"],
    patterns: ["original soundtrack", "サウンドトラック", "サントラ", "album", "アルバム", "blu-ray", "dvd", "画集", "art works", "artworks", "設定資料", "material", "memories", "アンソロジー", "コミック", "ドラマcd", "主題歌", "ボーカル", "trailer's trail", "ムービー集"],
  },
  {
    id: "fgo_fes",
    why: "FGO Fes. / anniversary",
    codes: ["fgo/fgofes"],
    patterns: ["fgo fes", "fate/grand order fes", "anniversary", "周年"],
  },
  {
    id: "fgo_events",
    why: "exhibition / event / ticket / collaboration",
    codes: ["fgo/exhibition", "fgo/winterfes", "fgo/aj20", "fgo/tckt", "fgo/fgomart", "fgo/otss", "fgo/dramalogue", "fgo/fate241231", "fgo/tsutaya", "fgo/nazomaru", "fgo/fgl-shiire", "fgo/sairinten", "fgo/yunyu"],
    patterns: ["チケット", "ticket", "展覧会", "原画展", "exhibition", "冬祭り", "winter fes", "animejapan", "anime japan", "京まふ", "リアル脱出", "謎特異点", "キャラバン", "caravan", "コラボ", "collaboration", "カフェ", "cafe", "dramalogue", "the stage", "舞台", "ミュージカル", "musical", "コンサート", "concert", "over the same sky", "under the same sky", "fgo mart", "grail league", "dream striker", "事後通販"],
  },
];

/** Build the Fate classifier from data/atlas/fate-roster.json. */
export function fateClassifier(roster) {
  const servants = new Map(roster.servants.map((s) => [s.no, s]));
  const entries = [];
  const firstTokens = new Map(); // token -> Set(base)
  const addFirst = (token, base, minLen) => {
    const key = compactKey(token);
    if ([...key].length < minLen) return;
    if (!firstTokens.has(key)) firstTokens.set(key, { token, bases: new Set(), refs: [] });
    firstTokens.get(key).bases.add(base);
  };
  const isKanji = (s) => /^[一-鿿]+$/.test(s.replace(/[・･\s]/g, ""));
  for (const s of roster.servants) {
    const ref = { type: "servant", no: s.no };
    const n = s.names;
    const names = uniq([n.ja, n.ja_original, n.en, n.en_original, ...(n.zh || []), n.zh_tw, n.ko, ...(s.aliases || [])]);
    for (const name of names) entries.push({ key: name, ref });
    // Japanese names romanised with or without long vowels: "Sei Shounagon" / "Sei Shonagon".
    const shortVowels = String(n.en || "").replace(/ou/g, "o").replace(/uu/g, "u");
    if (shortVowels !== n.en && /[ぁ-んァ-ヶ一-鿿]/.test(n.ja || "")) entries.push({ key: shortVowels, ref });
    // "ジャンヌ・ダルク〔オルタ〕" is also written "ジャンヌ・オルタ" / "Jeanne Alter".
    for (const name of [n.ja, n.en]) {
      if (!name) continue;
      const variant = name.match(/[〔(（]([^〕)）]+)[〕)）]\s*$/)?.[1];
      const head = name.replace(/[〔(（].*$/, "").trim().split(/[・･\s]/)[0];
      if (variant && head && [...head].length >= 3) entries.push({ key: `${head}${variant}`, ref });
    }
    // "Okita Souji" is also "Souji Okita".
    const en = String(n.en || "").replace(/\s*\(.*\)\s*$/, "");
    const parts = en.split(/\s+/);
    if (parts.length === 2 && isKanji(n.ja || "")) entries.push({ key: `${parts[1]} ${parts[0]}`, ref });
    // First names ("マシュ", "Mash") when only one servant base starts with them.
    const jaHead = String(n.ja || "").replace(/〔.*$/, "").split(/[・･]/);
    // Only for given-name + family-name servants (the JP name has a middle dot), so titles
    // such as "First Hassan" or "Great Statue God" do not turn "First" into a name.
    if (jaHead.length > 1) {
      addFirst(jaHead[0], s.base, 3);
      if (parts.length > 1 && /^[A-Z][a-z]+$/.test(parts[0]) && !/^(the|king|queen|lady|mysterious|space|great|demon|saint|super|little|young)$/i.test(parts[0])) addFirst(parts[0], s.base, 4);
    }
  }
  const classWordKeys = new Set(CLASS_KEYS.map(([k]) => k));
  for (const [key, slot] of firstTokens) {
    if (slot.bases.size !== 1 || classWordKeys.has(key)) continue;
    const base = [...slot.bases][0];
    const owner = roster.servants.filter((s) => s.base === base).sort((a, b) => a.no - b.no)[0];
    entries.push({ key: slot.token, ref: { type: "servant", no: owner.no } });
  }
  for (const c of roster.fgo.characters || []) {
    const ref = { type: "fgo_char", chapter: c.chapter, name: c.ja };
    for (const name of uniq([c.ja, c.en, c.zh, c.ko, ...(c.aliases || [])])) entries.push({ key: name, ref });
  }
  for (const w of roster.works) {
    for (const c of w.characters) {
      const ref = { type: "char", work: w.id, name: c.ja, weak: Boolean(c.weak) };
      for (const name of uniq([c.ja, c.en, c.zh, c.ko, ...(c.aliases || [])])) entries.push({ key: name, ref });
    }
  }
  const matcher = buildMatcher(entries);

  const works = roster.works.map((w) => ({ ...w, tagSet: new Set((w.tags || []).map((t) => t.toLowerCase())) }));
  const fgoStrong = ["fate/grand order", "fate grand order", "fgo", "fate/grand carnival", "グランドカーニバル", "grand carnival"];
  const fgoWeak = roster.fgo.patterns.filter((p) => !fgoStrong.includes(p));
  const fgoTags = new Set(roster.fgo.tags.map((t) => t.toLowerCase()));
  const chapterTitles = roster.chapters.map((c) => [c.id, c.title_patterns || []]);

  // Which work the product says it is. A work named in the title beats a store tag, which
  // beats the Aniplex+ catalogue folder (Aniplex files some collaboration goods, e.g.
  // "衛宮さんちの今日のごはん" or "事件簿" items sold at FGO Fes., under its FGO folder).
  function workEvidence(kit, text, codes) {
    const tags = (kit.tags || []).map((t) => String(t).toLowerCase());
    // "Fate/Accel Zero Order" is an FGO event, not Fate/Zero.
    const titleText = text.replace(/accel\s*zero\s*order/gi, "");
    const byTitle = works.filter((w) => containsAny(titleText, w.patterns)).map((w) => w.id);
    const byTag = works.filter((w) => tags.some((t) => w.tagSet.has(t))).map((w) => w.id);
    const byCode = works.filter((w) => (w.aniplex || []).some((c) => codes.includes(c))).map((w) => w.id);
    const ladder = [
      [containsAny(text, fgoStrong), "fgo", "FGO named in the title"],
      [byTitle.length, byTitle[0], `${byTitle[0]} named in the title`],
      [byTag.length, byTag[0], `store tag ${byTag[0]}`],
      [tags.some((t) => fgoTags.has(t)), "fgo", "store tag fate/grand order"],
      [byCode.length, byCode[0], `Aniplex+ catalogue ${byCode[0]}`],
      [roster.fgo.aniplex.some((c) => codes.includes(c)), "fgo", "Aniplex+ FGO catalogue"],
      [containsAny(text, fgoWeak), "fgo", "FGO terms in the title"],
    ];
    const step = ladder.find(([hit]) => hit);
    return step ? { work: step[1], reason: step[2] } : { work: null, reason: "" };
  }

  function resolveServant(hit) {
    const cands = hit.refs.filter((r) => r.type === "servant").map((r) => servants.get(r.no)).filter(Boolean);
    if (!cands.length) return null;
    const cls = classNear(hit.before, hit.after);
    const pool = cls ? cands.filter((s) => s.class === cls) : [];
    const servant = (pool.length ? pool : cands).sort((a, b) => a.no - b.no)[0];
    return { servant, classNamed: pool.length > 0 };
  }

  /** → { group, work, reason, names[] } */
  function classify(kit) {
    const text = productText(kit);
    const codes = aniplexCodes(kit);
    const ev = workEvidence(kit, text, codes);
    const hits = matcher.findAll(text);
    const found = [];
    for (const hit of hits) {
      const resolved = resolveServant(hit);
      if (resolved) {
        const { servant, classNamed } = resolved;
        found.push({ kind: "servant", name: servant.names.ja, chapter: servant.chapter || "fgo_event", origin: servant.origin_work, classNamed });
        continue;
      }
      const fgoChar = hit.refs.find((r) => r.type === "fgo_char");
      if (fgoChar) {
        found.push({ kind: "fgo_char", name: fgoChar.name, chapter: fgoChar.chapter, origin: "fgo" });
        continue;
      }
      const char = hit.refs.find((r) => r.type === "char");
      if (char) found.push({ kind: "char", name: char.name, origin: char.work, weak: char.weak });
    }
    // A bare "セイバー" next to an FGO servant is that servant's class, not Fate/stay night.
    if (found.some((f) => f.kind === "servant")) found.splice(0, found.length, ...found.filter((f) => !f.weak));
    const names = uniq(found.map((f) => f.name));

    let work = ev.work;
    let reason = ev.reason;
    if (!work && found.some((f) => f.classNamed)) {
      // "セイバー／アルトリア・ペンドラゴン", "Ruler / Jeanne d'Arc": class + true name is how
      // FGO goods name a servant (other works call them just "セイバー").
      work = "fgo";
      reason = "FGO-style class / servant name";
    }
    if (!work && found.length) {
      // No work named: use where the characters come from (FGO servants whose origin is
      // another work count for that work).
      const nonFgo = found.find((f) => f.origin && f.origin !== "fgo");
      work = nonFgo?.origin || "fgo";
      reason = `characters (${names.slice(0, 3).join(", ")}) belong to ${work}`;
    }
    if (!work) return { group: "fate_general", work: null, reason: "no work, character or catalogue code found", names };
    if (work !== "fgo") return { group: work, work, reason, names };

    for (const [id, pats] of chapterTitles) {
      if (pats.length && (containsAny(text, pats) || pats.some((p) => codes.includes(p)))) return { group: id, work, reason: `FGO title names chapter ${id}`, names };
    }
    const votes = new Map();
    const firstAt = new Map();
    found.forEach((f, i) => {
      // Non-servant characters only vote when they belong to a chapter (Olga Marie → Fuyuki);
      // the protagonist or Fou say nothing about the chapter.
      const ch = f.kind === "servant" ? f.chapter || "fgo_event" : f.kind === "fgo_char" ? f.chapter : null;
      if (!ch) return;
      votes.set(ch, (votes.get(ch) || 0) + 1);
      if (!firstAt.has(ch)) firstAt.set(ch, i);
    });
    if (votes.size) {
      const ranked = [...votes].sort((a, b) => (a[0] === "fgo_event") - (b[0] === "fgo_event") || b[1] - a[1] || firstAt.get(a[0]) - firstAt.get(b[0]));
      const [ch] = ranked[0];
      return { group: ch, work, reason: ch === "fgo_event" ? `event/limited servants (${names.slice(0, 3).join(", ")})` : `servants (${names.slice(0, 3).join(", ")}) appear in ${ch}`, names };
    }
    // No servant named: sort FGO-wide goods by what they are (Aniplex+ folder or title).
    for (const kind of FGO_GOODS_KINDS) {
      if (kind.codes.some((c) => codes.some((code) => code.startsWith(c))) || containsAny(text, kind.patterns)) return { group: kind.id, work, reason: `no single servant; ${kind.why}`, names };
    }
    return { group: "fgo_common", work, reason: "FGO goods without a single named servant", names };
  }
  return { classify, matcherSize: matcher.size };
}

// ─────────────────────────────── Pokémon ───────────────────────────────

export function pokemonClassifier(taxonomyPokemon) {
  const genOf = new Map();
  const entries = [];
  for (const generation of taxonomyPokemon) {
    for (const sp of generation.species || []) {
      genOf.set(sp.id, generation.id);
      const ref = { id: sp.id, gen: generation.id, name: sp.names?.ja || sp.names?.en };
      for (const name of uniq(Object.values(sp.names || {}))) {
        if (POKEMON_NAME_STOPLIST.has(name) || POKEMON_NAME_STOPLIST.has(String(name).toLowerCase())) continue;
        entries.push({ key: name, ref });
      }
    }
  }
  for (const [gen, names] of Object.entries(POKEMON_TRAINERS)) {
    for (const name of names) entries.push({ key: name, ref: { id: 0, gen, name, trainer: true } });
  }
  const matcher = buildMatcher(entries);
  const formKeys = POKEMON_FORM_WORDS.flatMap(([gen, words]) => words.map((w) => [compactKey(w), gen]));
  const genWords = Object.entries(POKEMON_GEN_WORDS).map(([gen, words]) => [gen, words]);

  // Series names that contain a species name without being about that species.
  const SERIES_WORDS = /イーブイフレンズ|이브이\s*프렌즈|eevee\s*friends/gi;
  function classify(kit) {
    const text = productText(kit).replace(SERIES_WORDS, " ");
    for (const [gen, words] of genWords) {
      if (containsAny(text, words)) {
        const hits = matcher.findAll(text).map((h) => h.refs[0].name);
        return { group: gen, reason: `names the ${gen} games/region`, names: uniq(hits) };
      }
    }
    const hits = matcher.findAll(text);
    const found = hits.map((h) => {
      const ref = h.refs[0];
      const form = ref.trainer ? null : formKeys.find(([k]) => h.before.endsWith(k) || h.after.startsWith(k) || h.after.replace(/^no/, "").startsWith(k));
      return { name: ref.name, id: ref.id, gen: form ? form[1] : ref.gen, form: form?.[0] };
    });
    // Pokémon Center plush titles start with the National Dex number ("29 ぬいぐるみ …").
    if (!found.length) {
      const dex = text.match(/^\s*0*(\d{1,4})\s+ぬいぐるみ/);
      if (dex && genOf.has(Number(dex[1]))) return { group: genOf.get(Number(dex[1])), reason: `dex number ${dex[1]}`, names: [] };
      return { group: "pokemon_common", reason: "no single Pokémon named", names: [] };
    }
    const gens = uniq(found.map((f) => f.gen));
    const names = uniq(found.map((f) => f.name));
    if (gens.length === 1) return { group: gens[0], reason: `species ${names.slice(0, 3).join(", ")}`, names };
    return { group: "pokemon_general", reason: `species from ${gens.join(", ")}`, names };
  }
  return { classify, matcherSize: matcher.size };
}

// ─────────────────────────────── Armored Core ───────────────────────────────

export function armoredCoreClassifier() {
  const titleEntries = [];
  const rosterEntries = [];
  for (const t of AC_TITLES) {
    for (const k of t.titles) titleEntries.push({ key: k, ref: t.id });
    for (const k of t.roster) rosterEntries.push({ key: k, ref: t.id });
  }
  const titleMatcher = buildMatcher(titleEntries);
  const rosterMatcher = buildMatcher(rosterEntries);
  function classify(kit) {
    const text = [productText(kit), kit.subline, ...(kit.tags || [])].filter(Boolean).join(" / ");
    const titled = titleMatcher.findAll(text).map((h) => h.refs[0]);
    if (titled.length) return { group: titled[0], reason: "title names the game", names: [] };
    const hits = rosterMatcher.findAll(text);
    const eras = uniq(hits.map((h) => h.refs[0]));
    if (eras.length === 1) return { group: eras[0], reason: `machines/corporations of ${eras[0]}`, names: uniq(hits.map((h) => h.key)) };
    if (eras.length > 1) return { group: "ac_general", reason: `names from ${eras.join(", ")}`, names: uniq(hits.map((h) => h.key)) };
    return { group: "ac_general", reason: "no game, machine or corporation named", names: [] };
  }
  return { classify };
}

export { POKEMON_GAMES, AC_TITLES };
