// Simplified Chinese names (names.zh) for the Pokémon tag / pick atlases, next to the official
// Traditional names (names.zh_hant) the sources give: data/atlas/mezastar-intl.json,
// mezastar-jp.json (scripts/atlas/mezastar/build.mjs) and pokemon-frienda.json
// (scripts/atlas/build_pokemon_frienda.mjs). Until 2026-11-11 these had zh_hant only, so the
// app's Chinese UI showed 超夢 / 故勒頓 next to products named 超梦 / 故勒顿, and a Simplified
// search found no tag.
//
// Pokémon names come from data/i18n/zh/pokemon.json (official zh-Hans names from PokeAPI, the
// same glossary the catalog's product names use), matched by the Japanese name — whole name
// first, then the glossary translation (forms such as アローラ / ガラル / (れんげきのかた)) —
// and by dex number when neither covers it. Set and edition titles are a short hand map. No
// network; both builds call addSimplifiedNames() before comparing with the previous output, and
//   node scripts/atlas/pokemon_zh_names.mjs [files...]
// adds them to the committed files (default: the three above).
import { readFileSync, writeFileSync } from "node:fs";
import { loadGlossary, normKey, translateName } from "../lib/zh-names.mjs";

const DEFAULT_FILES = ["data/atlas/mezastar-intl.json", "data/atlas/mezastar-jp.json", "data/atlas/pokemon-frienda.json"];
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/;

// Traditional → Simplified for the words in set / edition titles (星塵第1彈 → 星尘第1弹). A title
// with a Traditional-only character outside this list gets no zh (reported) rather than a guess.
const TITLE_WORDS = [
  ["寶可夢", "宝可梦"],
  ["星塵", "星尘"],
  ["銀河", "银河"],
  ["彈", "弹"],
  ["活動", "活动"],
  ["卡匣", "卡匣"],
  ["日本版", "日本版"],
];
// Characters that differ between the scripts and may appear in a title (TITLE_WORDS sources).
const HANT_ONLY = /[寶夢塵銀彈動際標準傳說幻]/;

/** data/i18n/zh/pokemon.json → { exact: Map(normKey(ja) → zh), byDex: Map(dex → zh), glossary } */
export function loadPokemonZh(dir) {
  const doc = JSON.parse(readFileSync(`${dir || "data/i18n/zh"}/pokemon.json`, "utf8"));
  const exact = new Map();
  const byDex = new Map();
  for (const term of doc.terms || []) {
    if (!term?.ja || !term.zh || term.official === false) continue;
    const key = normKey(term.ja);
    if (!exact.has(key)) exact.set(key, term.zh);
    const dex = /#0*(\d+)/.exec(term.note || "")?.[1];
    if (dex && !byDex.has(Number(dex))) byDex.set(Number(dex), term.zh);
  }
  return { exact, byDex, glossary: loadGlossary("pokemon", dir) };
}

// Form words of the printed names that the glossary pairs alone do not teach (a Frienda pick
// prints 烏波 (帕底亞的樣子) where the glossary has 帕底亚乌波): PokeAPI zh-Hant / zh-Hans form names.
const SEED_PAIRS = [
  ["阿羅拉", "阿罗拉"],
  ["伽勒爾", "伽勒尔"],
  ["帕底亞", "帕底亚"],
  ["洗翠", "洗翠"],
  ["的樣子", "的样子"],
  ["形態", "形态"],
  ["超級", "超级"],
  ["一擊流", "一击流"],
  ["連擊流", "连击流"],
  ["白色", "白色"],
  ["黑色", "黑色"],
  ["隊長", "队长"],
];

/** A tag / pick's glossary names, best first: the Japanese name whole, then translated, then the species of [dex]. */
export function glossaryCandidates(ja, dex, ctx) {
  const out = [];
  if (ja) {
    const whole = ctx.exact.get(normKey(ja));
    if (whole) out.push(whole);
    const translated = translateName(ja, ctx.glossary);
    if (translated.complete && !KANA.test(translated.zh)) out.push(translated.zh);
  }
  const species = ctx.byDex.get(Number(dex));
  if (species) out.push(species);
  return [...new Set(out)];
}

const shape = (text) => [...String(text).normalize("NFKC").replace(/\s/g, "")];

/**
 * Is [zh] the same printed name as [hant], character for character? The Japanese name does not
 * always say what the Traditional printing says (ウーラオス for 武道熊師(一擊流), ピカチュウ&ミュウツー
 * for 皮卡丘, a dex fallback 皮卡丘 for 隊長皮卡丘), so a glossary name is used only then.
 */
export function sameShape(hant, zh) {
  return shape(hant).length === shape(zh).length;
}

/**
 * Traditional → Simplified characters seen in [pairs] ([hant, zh] of the same shape), majority per character.
 * Some official names differ between the scripts, not only the characters (流氓熊貓 / 霸道熊猫, 狐大盜 /
 * 猾大狐, 死神板 / 迭失板), and one species has many printings: counted per printing, the Frienda pairs
 * of 2026-11-11 taught 流→霸 (so 連擊流 would become 连击霸). So a vote is one distinct name, the
 * character itself wins a tie, and a changed character needs two votes ([trusted] pairs count twice).
 */
export function learnCharMap(pairs, trusted = []) {
  const votes = new Map();
  const vote = (hant, zh, weight) => {
    const a = shape(hant);
    const b = shape(zh);
    a.forEach((ch, i) => {
      const v = votes.get(ch) ?? votes.set(ch, new Map()).get(ch);
      v.set(b[i], (v.get(b[i]) || 0) + weight);
    });
  };
  for (const [hant, zh] of trusted) vote(hant, zh, 2);
  const distinct = new Map(pairs.map(([hant, zh]) => [`${hant}\u0000${zh}`, [hant, zh]]));
  for (const [hant, zh] of distinct.values()) vote(hant, zh, 1);
  const map = new Map();
  for (const [ch, v] of votes) {
    const [to, n] = [...v].sort((x, y) => y[1] - x[1] || (x[0] === ch ? -1 : y[0] === ch ? 1 : 0))[0];
    if (to === ch || n >= 2) map.set(ch, to);
  }
  return map;
}

/** [hant] converted by [charMap]; null when a CJK character was never seen (no guessing). */
export function convertByChars(hant, charMap) {
  let out = "";
  for (const ch of String(hant).normalize("NFKC")) {
    if (charMap.has(ch)) out += charMap.get(ch);
    else if (/[\p{Script=Han}]/u.test(ch)) return null;
    else out += ch;
  }
  return out;
}

/** "九尾 (阿羅拉的樣子)": the species of [dex] for the leading name, the rest converted by [charMap]. */
export function speciesWithForm(hant, dex, ctx, charMap) {
  const m = /^([^\s(（]+)(.*)$/u.exec(String(hant));
  const species = ctx.byDex.get(Number(dex));
  if (!m || !m[2] || !species || !sameShape(m[1], species)) return null;
  const rest = convertByChars(m[2], charMap);
  return rest == null ? null : species + rest;
}

/** Set / edition title in Traditional → Simplified, or null when a character is not covered. */
export function titleZh(hant) {
  if (!hant) return null;
  let out = String(hant);
  for (const [from, to] of TITLE_WORDS) out = out.split(from).join(to);
  return HANT_ONLY.test(out) ? null : out;
}

function withZh(names, zh) {
  // zh right after zh_hant, so the file stays readable
  const out = {};
  for (const [key, value] of Object.entries(names)) {
    if (key === "zh") continue;
    out[key] = value;
    if (key === "zh_hant" && zh) out.zh = zh;
  }
  return out;
}

/**
 * Adds names.zh in place wherever names.zh_hant is. Tags / picks (they carry a dex): the
 * glossary name when it has the printed name's shape (超夢 → 超梦, 阿羅拉九尾 → 阿罗拉九尾),
 * else the printed name converted with the characters those pairs taught (九尾 (阿羅拉的樣子)
 * → 九尾 (阿罗拉的样子)). Sets and the edition: the title map. Returns { added, missing: [text] }.
 */
export function addSimplifiedNames(doc, ctx = loadPokemonZh()) {
  const slots = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const key of ["names", "name"]) {
      const names = node[key];
      if (!names || typeof names !== "object" || !names.zh_hant) continue;
      // Frienda campaign picks keep the Japanese name next to names (node.ja)
      const candidate = "dex" in node ? glossaryCandidates(names.ja || node.ja, node.dex, ctx).find((zh) => sameShape(names.zh_hant, zh)) : null;
      slots.push({ node, key, names, pokemon: "dex" in node, candidate });
    }
    for (const [key, value] of Object.entries(node)) if (key !== "names" && key !== "name") visit(value);
  };
  visit(doc);
  const charMap = learnCharMap(slots.filter((s) => s.candidate).map((s) => [s.names.zh_hant, s.candidate]), SEED_PAIRS);
  let added = 0;
  const missing = [];
  for (const slot of slots) {
    const hant = slot.names.zh_hant;
    const zh = slot.pokemon
      ? slot.candidate || convertByChars(hant, charMap) || speciesWithForm(hant, slot.node.dex, ctx, charMap)
      : titleZh(hant);
    if (!zh) missing.push(hant);
    if ((slot.names.zh || null) !== (zh || null)) added += 1;
    slot.node[slot.key] = withZh(slot.names, zh);
  }
  return { added, missing: [...new Set(missing)] };
}

function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const ctx = loadPokemonZh();
  for (const file of files.length ? files : DEFAULT_FILES) {
    const text = readFileSync(file, "utf8");
    const doc = JSON.parse(text);
    const { added, missing } = addSimplifiedNames(doc, ctx);
    const out = JSON.stringify(doc) + (/\n$/.test(text) ? "\n" : "");
    if (out.replace(/\r?\n$/, "") !== text.replace(/\r?\n$/, "")) writeFileSync(file, out, "utf8");
    console.log(`${file}: ${added} names.zh added or changed${missing.length ? `; no zh for ${missing.length}: ${missing.slice(0, 10).join(", ")}` : ""}`);
  }
}

if (/(^|[\\/])pokemon_zh_names\.mjs$/.test(process.argv[1] || "")) main();
