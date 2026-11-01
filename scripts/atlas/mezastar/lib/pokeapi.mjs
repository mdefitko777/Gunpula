// PokeAPI CSV helpers: species names in ja/ko/zh-Hant/zh-Hans/en, form-aware types,
// localised form names, and name -> species(+form) resolution used to validate official tag names.
// Data: https://github.com/PokeAPI/pokeapi (BSD-3-Clause), data/v2/csv, pinned to one commit.

import { politeFetch } from "./http.mjs";
import { nfkc } from "./util.mjs";

// Pinned so that upstream edits cannot change names/types between runs; bump deliberately.
export const POKEAPI_SHA = process.env.ATLAS_POKEAPI_SHA || "6b8db7f3cb31cfaa37cb74e5c3edff124bcba5ce";
export const POKEAPI_CSV = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_SHA}/data/v2/csv/`;
export const POKEAPI_SOURCE = {
  name: "PokeAPI species/pokemon/form/type CSV",
  url: `https://github.com/PokeAPI/pokeapi/tree/${POKEAPI_SHA}/data/v2/csv`,
  fetch_host: "raw.githubusercontent.com",
  licence: "BSD-3-Clause (PokeAPI); community-compiled data",
  role: "name validation, dex numbers, fallback names (with regional/form names), form types",
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
const stripBrackets = (s) => s.replace(/[()（）「」【】\[\]]/g, "");

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

// form_identifier (pokemon_forms.csv) -> the EN form label used in our "form" field
const CANON_FORM = {
  alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean", mega: "Mega", "mega-x": "Mega X", "mega-y": "Mega Y",
  gmax: "Gigantamax", primal: "Primal", crowned: "Crowned", ice: "Ice Rider", shadow: "Shadow Rider",
  "single-strike": "Single Strike", "rapid-strike": "Rapid Strike", origin: "Origin", complete: "Complete",
};

// Regional forms and Primal are part of the printed name on every official site
// (KR "알로라 나인테일", TC "阿羅拉九尾", JA "アローラキュウコン", EN "Alolan Ninetales").
const NAME_PREFIX = {
  Alolan: { en: "Alolan ", ko: "알로라 ", ja: "アローラ", zh_hant: "阿羅拉", zh_hans: "阿罗拉" },
  Galarian: { en: "Galarian ", ko: "가라르 ", ja: "ガラル", zh_hant: "伽勒爾", zh_hans: "伽勒尔" },
  Hisuian: { en: "Hisuian ", ko: "히스이 ", ja: "ヒスイ", zh_hant: "洗翠", zh_hans: "洗翠" },
  Paldean: { en: "Paldean ", ko: "팔데아 ", ja: "パルデア", zh_hant: "帕底亞", zh_hans: "帕底亚" },
  Primal: { en: "Primal ", ko: "원시", ja: "ゲンシ", zh_hant: "原始", zh_hans: "原始" },
};
// In-battle gimmicks (and Crowned): official names print only the species; the form field carries it.
const GIMMICK_FORM = /^(mega( [a-z])?|gigantamax|dynamax|crowned( sword| shield)?|eternamax)$/i;

export async function loadPokeApi() {
  const get = async (f) => parseCsv((await politeFetch(POKEAPI_CSV + f, { maxAgeMs: 30 * 86400e3, accept: "text/csv,*/*" })).text);
  const [names, pokemon, ptypes, types, pforms, pformNames] = [
    await get("pokemon_species_names.csv"),
    await get("pokemon.csv"),
    await get("pokemon_types.csv"),
    await get("types.csv"),
    await get("pokemon_forms.csv"),
    await get("pokemon_form_names.csv"),
  ];
  const species = new Map(); // dex -> {ja, ja_hrkt, ko, zh_hant, zh_hans, en}
  const langKey = (id) => Object.keys(LANG).find((k) => LANG[k] === Number(id));
  for (const r of names) {
    const id = Number(r.pokemon_species_id), key = langKey(r.local_language_id);
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
  const byIdent = new Map(), formsOfSpecies = new Map(), identOfSpecies = new Map(), speciesOfPokemon = new Map();
  for (const p of pokemon) {
    const id = Number(p.id), sid = Number(p.species_id);
    byIdent.set(p.identifier, id);
    speciesOfPokemon.set(id, sid);
    if (!formsOfSpecies.has(sid)) formsOfSpecies.set(sid, []);
    formsOfSpecies.get(sid).push({ id, identifier: p.identifier });
    if (p.is_default === "1") identOfSpecies.set(sid, p.identifier);
  }
  // localised form names: pokemon id -> {lang: form name} (from the pokemon's default form), and
  // species -> [{ident, pid, names}] for recognising form markers inside official local names
  const formNameRows = new Map();
  for (const r of pformNames) {
    const key = langKey(r.local_language_id);
    if (!key || !r.form_name) continue;
    if (!formNameRows.has(r.pokemon_form_id)) formNameRows.set(r.pokemon_form_id, {});
    formNameRows.get(r.pokemon_form_id)[key] = r.form_name;
  }
  const formNamesOfPokemon = new Map(), localForms = new Map();
  for (const f of pforms) {
    const names = formNameRows.get(f.id);
    const pid = Number(f.pokemon_id), sid = speciesOfPokemon.get(pid);
    if (!names || !f.form_identifier || !sid) continue;
    if (f.is_default === "1" && !formNamesOfPokemon.has(pid)) formNamesOfPokemon.set(pid, names);
    if (!localForms.has(sid)) localForms.set(sid, []);
    localForms.get(sid).push({ ident: f.form_identifier, pid, names });
  }
  const canonForm = (ident, en, dex) => {
    if (CANON_FORM[ident]) return CANON_FORM[ident];
    const sp = species.get(dex)?.en;
    const s = en ? nfkc(en).replace(sp ? new RegExp(`\\s*\\b${sp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*`) : /$^/, " ").replace(/\s+(Form|Forme|Style|Mode|Cloak)$/i, "").trim() : "";
    return s || ident.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  };

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

  /** Form marker left over around the species name in a local name ("阿羅拉", "（連擊流）", "騎白馬的樣子"). */
  function localForm(dex, rest, lang) {
    const r = stripBrackets(rest);
    if (!r) return null;
    const L = lang === "ja_hrkt" ? "ja" : lang;
    for (const [form, p] of Object.entries(NAME_PREFIX)) if (p[L] && r.includes(normCjk(p[L]))) return form;
    for (const f of localForms.get(dex) || []) {
      const fn = f.names[L] || (L === "ja" ? f.names.ja_hrkt : null);
      if (!fn) continue;
      const n = stripBrackets(normCjk(fn));
      if (n && n.length >= 2 && (r.includes(n) || (r.length >= 2 && n.includes(r)))) return canonForm(f.ident, f.names.en, dex);
    }
    return null;
  }

  /** Longest species name contained in a CJK/Korean string, plus the form marker if one is recognised. */
  function resolveLocal(name, lang) {
    if (!name) return null;
    const s = normCjk(name);
    if (indexes[lang].has(s)) return { dex: indexes[lang].get(s), exact: true, form: null };
    const langs = lang === "ja" ? ["ja", "ja_hrkt"] : [lang];
    for (const L of langs) for (const [n, id] of cjkList[L]) if (n.length >= 2 && s.includes(n)) return { dex: id, exact: false, matched: n, form: localForm(id, s.replace(n, ""), L) };
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

  /** PokeAPI species name, NFKC-normalised (full-width Ｑ/Ｚ -> Q/Z, as on the official sites). */
  const name = (dex, lang) => nfkc(species.get(dex)?.[lang] || (lang === "ja" ? species.get(dex)?.ja_hrkt : undefined) || null);

  /**
   * Fallback display name for a tag of species `dex` in form `form`, following the official naming:
   * regional forms and Primal are prefixed; Mega/Gigantamax/Dynamax/Crowned print the species only;
   * other forms (riders, styles, Kyurem Black/White, ...) get the PokeAPI form name in brackets (not EN).
   */
  function displayName(dex, form, lang) {
    const base = name(dex, lang);
    if (!base || !form) return base;
    const f = nfkc(form);
    const pre = Object.entries(NAME_PREFIX).find(([k]) => k.toLowerCase() === f.toLowerCase());
    if (pre) return pre[1][lang] ? `${pre[1][lang]}${base}` : base;
    if (GIMMICK_FORM.test(f) || lang === "en") return base;
    const pid = formPokemonId(dex, f);
    if (!pid || pid === byIdent.get(identOfSpecies.get(dex))) return base;
    const fnRaw = formNamesOfPokemon.get(pid)?.[lang] || (lang === "ja" ? formNamesOfPokemon.get(pid)?.ja_hrkt : null);
    if (!fnRaw) return base;
    const fn = nfkc(fnRaw);
    return normCjk(fn).includes(normCjk(base)) ? fn : `${base} (${fn})`;
  }

  /** Does an official local name agree with the species? (containment, NFKC, ignores spaces) */
  function nameAgrees(dex, lang, official) {
    if (!official) return true;
    const exp = [species.get(dex)?.[lang], lang === "ja" ? species.get(dex)?.ja_hrkt : null].filter(Boolean);
    if (!exp.length) return true;
    const o = lang === "en" ? normEn(official) : normCjk(official);
    return exp.some((e) => o.includes(lang === "en" ? normEn(e) : normCjk(e)));
  }

  /**
   * Distinct type combos of the forms a printed name would not reveal (to flag form-unknown tags):
   * in-battle changes and regional forms are skipped (official names always print the region).
   */
  function lookTypeCombos(dex) {
    const out = new Set();
    for (const f of formsOfSpecies.get(dex) || []) {
      if (/-(mega(-[a-z])?|gmax|primal|eternamax|totem.*|starter)$|-(alola|galar|hisui|paldea)(-|$)/.test(f.identifier)) continue;
      out.add((typesOf.get(f.id) || []).filter(Boolean).join("/"));
    }
    return [...out];
  }

  return { species, resolveEn, resolveLocal, typesFor, typeCombos, lookTypeCombos, name, displayName, nameAgrees, size: species.size };
}
