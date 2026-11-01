// PokeAPI CSV helpers: species names in ja/ko/zh-Hant/zh-Hans/en, form-aware types,
// and name -> species resolution used to validate official tag names.
// Data: https://github.com/PokeAPI/pokeapi (BSD-3-Clause), data/v2/csv.

import { politeFetch } from "./http.mjs";
import { nfkc } from "./util.mjs";

export const POKEAPI_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
export const POKEAPI_SOURCE = {
  name: "PokeAPI species/pokemon/type CSV",
  url: "https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv",
  fetch_host: "raw.githubusercontent.com",
  licence: "BSD-3-Clause (PokeAPI); community-compiled data",
  role: "name validation, dex numbers, fallback names, form types",
};

const LANG = { ja_hrkt: 1, ko: 3, zh_hant: 4, en: 9, ja: 11, zh_hans: 12 };

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const normEn = (s) => nfkc(s).replace(/[’`]/g, "'").replace(/\s+/g, " ").toLowerCase();
const normCjk = (s) => nfkc(s).replace(/[\s・·.．]/g, "");

const FORM_SUFFIX = [
  [/^alolan$/i, "alola"], [/^galarian$/i, "galar"], [/^hisuian$/i, "hisui"], [/^paldean$/i, "paldea"],
  [/^mega x$/i, "mega-x"], [/^mega y$/i, "mega-y"], [/^mega$/i, "mega"], [/^primal$/i, "primal"],
  [/^gigantamax$/i, "gmax"], [/^crowned( sword| shield)?$/i, "crowned"], [/^origin( forme?)?$/i, "origin"],
  [/^ice rider$/i, "ice"], [/^shadow rider$/i, "shadow"], [/^single strike( style)?$/i, "single-strike"],
  [/^rapid strike( style)?$/i, "rapid-strike"], [/^dusk( forme?)?$/i, "dusk"], [/^midnight( forme?)?$/i, "midnight"],
  [/^complete( forme?)?$/i, "complete"], [/^10% forme?$/i, "10"], [/^resolute( forme?)?$/i, "resolute"],
  [/^therian( forme?)?$/i, "therian"], [/^sky( forme?)?$/i, "sky"], [/^eternamax$/i, "eternamax"],
  [/^black$/i, "black"], [/^white$/i, "white"], [/^dawn wings$/i, "dawn"], [/^dusk mane$/i, "dusk"],
  [/^ultra$/i, "ultra"], [/^hero( of many battles)?$/i, null], [/^(dynamax|legacy|regular special)$/i, null],
];

export async function loadPokeApi() {
  const get = async (f) => parseCsv((await politeFetch(POKEAPI_CSV + f, { maxAgeMs: 7 * 86400e3, accept: "text/csv,*/*" })).text);
  const [names, pokemon, ptypes, types] = [
    await get("pokemon_species_names.csv"),
    await get("pokemon.csv"),
    await get("pokemon_types.csv"),
    await get("types.csv"),
  ];
  const species = new Map(); // dex -> {ja, ja_hrkt, ko, zh_hant, zh_hans, en}
  for (const r of names) {
    const id = Number(r.pokemon_species_id), lang = Number(r.local_language_id);
    const key = Object.keys(LANG).find((k) => LANG[k] === lang);
    if (!key) continue;
    if (!species.has(id)) species.set(id, {});
    species.get(id)[key] = r.name;
  }
  const typeName = new Map(types.map((t) => [Number(t.id), t.identifier[0].toUpperCase() + t.identifier.slice(1)]));
  const typesOf = new Map();
  for (const r of ptypes) {
    const id = Number(r.pokemon_id);
    if (!typesOf.has(id)) typesOf.set(id, []);
    typesOf.get(id)[Number(r.slot) - 1] = typeName.get(Number(r.type_id));
  }
  const byIdent = new Map(), formsOfSpecies = new Map(), identOfSpecies = new Map();
  for (const p of pokemon) {
    const id = Number(p.id), sid = Number(p.species_id);
    byIdent.set(p.identifier, id);
    if (!formsOfSpecies.has(sid)) formsOfSpecies.set(sid, []);
    formsOfSpecies.get(sid).push({ id, identifier: p.identifier });
    if (p.is_default === "1") identOfSpecies.set(sid, p.identifier);
  }
  const indexes = {};
  for (const lang of Object.keys(LANG)) {
    const m = new Map();
    for (const [id, n] of species) if (n[lang]) m.set(lang === "en" ? normEn(n[lang]) : normCjk(n[lang]), id);
    indexes[lang] = m;
  }
  const cjkList = {};
  for (const lang of ["ja", "ja_hrkt", "ko", "zh_hant", "zh_hans"]) {
    cjkList[lang] = [...indexes[lang].entries()].sort((a, b) => b[0].length - a[0].length);
  }

  /** "Alolan Ninetales" / "Charizard Mega X" / "Zygarde (Complete Forme)" -> {dex, form} */
  function resolveEn(name) {
    if (!name) return null;
    let s = nfkc(name).replace(/[’`]/g, "'");
    const forms = [];
    s = s.replace(/\(([^)]*)\)/g, (_, f) => { forms.push(f.trim()); return " "; }).replace(/\s+/g, " ").trim();
    const words = s.split(" ");
    for (let len = words.length; len >= 1; len--) {
      for (let start = 0; start + len <= words.length; start++) {
        const cand = normEn(words.slice(start, start + len).join(" "));
        const id = indexes.en.get(cand);
        if (id) {
          const rest = [...words.slice(0, start), ...words.slice(start + len)].join(" ").trim();
          const form = [rest, ...forms].filter(Boolean).join(" ").trim() || null;
          return { dex: id, form };
        }
      }
    }
    return null;
  }

  /** Longest species name contained in a CJK/Korean string. */
  function resolveLocal(name, lang) {
    if (!name) return null;
    const s = normCjk(name);
    if (indexes[lang].has(s)) return { dex: indexes[lang].get(s), exact: true };
    const langs = lang === "ja" ? ["ja", "ja_hrkt"] : [lang];
    for (const L of langs) for (const [n, id] of cjkList[L]) if (n.length >= 2 && s.includes(n)) return { dex: id, exact: false, matched: n };
    return null;
  }

  function speciesIdent(dex) {
    const ids = (formsOfSpecies.get(dex) || []).map((f) => f.identifier);
    if (!ids.length) return null;
    let p = ids[0];
    for (const x of ids) while (!x.startsWith(p)) p = p.slice(0, -1);
    return p.replace(/-+$/, "") || ids[0];
  }

  function formPokemonId(dex, form) {
    const base = identOfSpecies.get(dex);
    if (!base) return null;
    const roots = [...new Set([speciesIdent(dex), base].filter(Boolean))];
    const tryIdent = (suf) => { for (const r of roots) { const id = byIdent.get(`${r}-${suf}`); if (id) return id; } return null; };
    if (form) {
      const parts = form.split(/\s+(?=(?:Mega|Gigantamax|Dynamax|Crowned|Primal)\b)|,\s*/);
      for (const f of [form, ...parts]) {
        for (const [re, suf] of FORM_SUFFIX) {
          if (re.test(f.trim())) {
            if (suf === null) break;
            const id = tryIdent(suf);
            if (id) return id;
          }
        }
        const sl = f.toLowerCase().replace(/\b(forme?|style|mode|size|cloak)\b/g, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (sl && tryIdent(sl)) return tryIdent(sl);
      }
    }
    return byIdent.get(base);
  }

  function typesFor(dex, form) {
    const id = formPokemonId(dex, form);
    return id ? (typesOf.get(id) || []).filter(Boolean) : [];
  }

  /** All distinct type combos across a species' forms (for tolerant checks). */
  function typeCombos(dex) {
    return (formsOfSpecies.get(dex) || []).map((f) => (typesOf.get(f.id) || []).filter(Boolean).join("/"));
  }

  const name = (dex, lang) => species.get(dex)?.[lang] || (lang === "ja" ? species.get(dex)?.ja_hrkt : undefined) || null;

  /** Does an official local name agree with the species? (containment, NFKC, ignores spaces) */
  function nameAgrees(dex, lang, official) {
    if (!official) return true;
    const exp = [name(dex, lang), lang === "ja" ? species.get(dex)?.ja_hrkt : null].filter(Boolean);
    if (!exp.length) return true;
    const o = lang === "en" ? normEn(official) : normCjk(official);
    return exp.some((e) => o.includes(lang === "en" ? normEn(e) : normCjk(e)));
  }

  return { species, resolveEn, resolveLocal, typesFor, typeCombos, name, nameAgrees, size: species.size };
}
