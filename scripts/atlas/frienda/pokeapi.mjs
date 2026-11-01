// PokeAPI CSV 로 フレンダピック 의 일본어 이름을 도감 번호 · 폼 · 타입 · 다국어 이름으로 바꾼다.
// 데이터: https://github.com/PokeAPI/pokeapi (BSD-3-Clause), data/v2/csv.
//
// 일본어 이름 해석 순서 (NFKC, 공백 · 「・」 무시):
//   1. 폼 전체 이름과 일치 (メガメタグロス, メガリザードンＸ, ブラックキュレム …)
//   2. 지방 접두사 + 종 이름 (アローラナッシー → exeggutor-alola)
//   3. 종 이름 + 괄호 폼 (ギラティナ（オリジンフォルム）, フーパ（ときはなたれしフーパ）)
//   4. キョダイマックス + 종 이름 → -gmax
//   5. 그 밖에는 포함된 가장 긴 종 이름 (キャプテンピカチュウ → 25, 나머지는 variant 로 남김)
//   「＆」 로 이어진 タッグわざピック 은 첫 포켓몬이 주인공, 나머지는 partners.

import { politeFetch } from "./http.mjs";

export const POKEAPI_CSV = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";
export const POKEAPI_SOURCE = {
  name: "PokeAPI CSV (pokemon_species_names, pokemon, pokemon_types, types, pokemon_forms, pokemon_form_names)",
  url: "https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv",
  host: "raw.githubusercontent.com",
  licence: "BSD-3-Clause (PokeAPI); community-compiled data",
  role: "dex number from the official Japanese pick name; en/ko/zh_hant names; form-aware types (not Frienda-verified)",
};

const LANG = { ja_hrkt: 1, ko: 3, zh_hant: 4, en: 9, ja: 11 };
const REGION = { アローラ: "alola", ガラル: "galar", ヒスイ: "hisui", パルデア: "paldea" };
// PokeAPI 에 ko / zh_hant 폼 이름이 없는 지방 폼(パルデア · ヒスイ 등)에 붙일 공식 표기
const REGION_FORM = {
  alola: { ko: "알로라의 모습", zh_hant: "阿羅拉的樣子" },
  galar: { ko: "가라르의 모습", zh_hant: "伽勒爾的樣子" },
  hisui: { ko: "히스이의 모습", zh_hant: "洗翠的樣子" },
  paldea: { ko: "팔데아의 모습", zh_hant: "帕底亞的樣子" },
};
// 폼이 아닌 수식어(variant) 번역. 모르는 수식어는 기본 이름 그대로 두고 variant 필드에만 남긴다.
const VARIANT_NAMES = {
  黒い: { en: "Black", ko: "검은", zh_hant: "黑色" },
  白い: { en: "White", ko: "하얀", zh_hant: "白色" },
  キャプテン: { en: "Captain", ko: "캡틴", zh_hant: "隊長" },
};

export const nfkc = (s) => String(s ?? "").normalize("NFKC");
const norm = (s) => nfkc(s).replace(/[\s・·.．:：]/g, "");

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

export async function loadPokeApi() {
  // fetchedAt: CSV 를 실제로 받은 시각 중 가장 늦은 것 (캐시에서 읽으면 그때 받은 시각)
  let fetchedAt = null;
  const get = async (f) => {
    const r = await politeFetch(POKEAPI_CSV + f, { maxAgeMs: 7 * 86400e3, accept: "text/csv,*/*" });
    if (r.fetchedAt && (!fetchedAt || r.fetchedAt > fetchedAt)) fetchedAt = r.fetchedAt;
    return parseCsv(r.text);
  };
  const speciesNames = await get("pokemon_species_names.csv");
  const pokemon = await get("pokemon.csv");
  const ptypes = await get("pokemon_types.csv");
  const types = await get("types.csv");
  const forms = await get("pokemon_forms.csv");
  const formNames = await get("pokemon_form_names.csv");

  // 종 이름: dex -> { ja, ja_hrkt, ko, zh_hant, en }
  const species = new Map();
  for (const r of speciesNames) {
    const key = Object.keys(LANG).find((k) => LANG[k] === Number(r.local_language_id));
    if (!key) continue;
    const id = Number(r.pokemon_species_id);
    if (!species.has(id)) species.set(id, {});
    species.get(id)[key] = r.name;
  }
  // 일본어 종 이름 색인 (긴 이름 먼저: 부분 일치에서 짧은 이름이 이기지 않게)
  const jaIndex = new Map();
  for (const [id, n] of species) for (const k of ["ja", "ja_hrkt"]) if (n[k]) jaIndex.set(norm(n[k]), id);
  const jaList = [...jaIndex.entries()].sort((a, b) => b[0].length - a[0].length);

  // 타입
  const typeName = new Map(types.map((t) => [Number(t.id), t.identifier[0].toUpperCase() + t.identifier.slice(1)]));
  const typesOf = new Map();
  for (const r of ptypes) {
    const id = Number(r.pokemon_id);
    if (!typesOf.has(id)) typesOf.set(id, []);
    typesOf.get(id)[Number(r.slot) - 1] = typeName.get(Number(r.type_id));
  }
  const pokemonById = new Map(pokemon.map((p) => [Number(p.id), p]));
  const defaultPokemon = new Map();
  for (const p of pokemon) if (p.is_default === "1") defaultPokemon.set(Number(p.species_id), Number(p.id));

  // 폼: species -> [{ pokemon_id, form_identifier, names{lang:{form, pokemon}} }]
  const fnames = new Map();
  for (const r of formNames) {
    const key = Object.keys(LANG).find((k) => LANG[k] === Number(r.local_language_id));
    if (!key) continue;
    const id = Number(r.pokemon_form_id);
    if (!fnames.has(id)) fnames.set(id, {});
    fnames.get(id)[key] = { form: r.form_name || "", pokemon: r.pokemon_name || "" };
  }
  const formsOfSpecies = new Map();
  for (const f of forms) {
    const p = pokemonById.get(Number(f.pokemon_id));
    if (!p) continue;
    const sid = Number(p.species_id);
    if (!formsOfSpecies.has(sid)) formsOfSpecies.set(sid, []);
    formsOfSpecies.get(sid).push({
      pokemon_id: Number(f.pokemon_id),
      identifier: f.identifier,
      form_identifier: f.form_identifier || "",
      is_default: f.is_default === "1" && p.is_default === "1",
      names: fnames.get(Number(f.id)) || {},
    });
  }
  // 폼 전체 이름 색인 (メガメタグロス 처럼 종 이름을 품은 일본어 폼 이름)
  const fullFormIndex = new Map();
  for (const [sid, list] of formsOfSpecies) {
    for (const f of list) {
      const jn = f.names.ja?.form || f.names.ja_hrkt?.form;
      const sn = species.get(sid)?.ja;
      if (jn && sn && norm(jn).includes(norm(sn)) && norm(jn) !== norm(sn)) fullFormIndex.set(norm(jn), { sid, f });
    }
  }

  const findForm = (sid, pred) => (formsOfSpecies.get(sid) || []).find(pred) || null;
  const formByJa = (sid, label) => {
    const l = norm(label);
    if (!l) return null;
    return findForm(sid, (f) => !f.is_default && [f.names.ja?.form, f.names.ja_hrkt?.form].some((x) => x && norm(x) === l))
      || findForm(sid, (f) => [f.names.ja?.form, f.names.ja_hrkt?.form].some((x) => x && norm(x) === l));
  };

  function containedSpecies(s) {
    for (const [n, id] of jaList) if (n.length >= 2 && s.includes(n)) return { dex: id, matched: n };
    return null;
  }

  /** 일본어 픽 이름 하나 -> { dex, form?, variant?, pokemon_id, how } | null */
  function resolveOne(raw) {
    let s = norm(raw);
    if (!s) return null;
    // 괄호 안 폼 이름
    let paren = null;
    s = s.replace(/[(（]([^)）]*)[)）]/g, (_, x) => { paren = (paren ? paren + " " : "") + x; return ""; });
    if (jaIndex.has(s) && !paren) return { dex: jaIndex.get(s), pokemon_id: defaultPokemon.get(jaIndex.get(s)), how: "exact" };
    if (fullFormIndex.has(s)) {
      const { sid, f } = fullFormIndex.get(s);
      return { dex: sid, form: f.form_identifier || null, pokemon_id: f.pokemon_id, how: "form-name", variant: paren || undefined };
    }
    for (const [pre, suf] of Object.entries(REGION)) {
      if (s.startsWith(pre) && jaIndex.has(s.slice(pre.length))) {
        const sid = jaIndex.get(s.slice(pre.length));
        // パルデアケンタロス 처럼 지방 폼이 여럿이면 첫 번째(コンバット種)를 쓴다.
        const f = findForm(sid, (x) => x.form_identifier === suf) || findForm(sid, (x) => x.form_identifier.startsWith(`${suf}-`));
        if (f) return { dex: sid, form: f.form_identifier, pokemon_id: f.pokemon_id, how: "region", variant: paren || undefined };
      }
    }
    if (s.startsWith("キョダイマックス") && jaIndex.has(s.slice(8))) {
      const sid = jaIndex.get(s.slice(8));
      const f = findForm(sid, (x) => x.form_identifier === "gmax");
      if (f) return { dex: sid, form: "gmax", pokemon_id: f.pokemon_id, how: "gmax" };
    }
    if (jaIndex.has(s)) {
      const sid = jaIndex.get(s);
      const f = paren ? formByJa(sid, paren) : null;
      if (f && !f.is_default) return { dex: sid, form: f.form_identifier || null, pokemon_id: f.pokemon_id, how: "paren-form" };
      // 기본 폼 이름이거나(みどりのめん) 폼이 아닌 수식어(ステラテラスタル, リコのテラパゴス)
      return { dex: sid, pokemon_id: f?.pokemon_id || defaultPokemon.get(sid), how: f ? "paren-default-form" : "species+label", variant: f ? undefined : paren };
    }
    const c = containedSpecies(s) || (paren ? containedSpecies(norm(paren)) : null);
    if (c) {
      const rest = s.replace(c.matched, "");
      const variant = [rest, paren].filter(Boolean).join(" ") || undefined;
      return { dex: c.dex, pokemon_id: defaultPokemon.get(c.dex), how: "contains", variant };
    }
    return null;
  }

  /** 픽 이름 (＆ 로 이은 タッグ 포함) 해석 */
  function resolveJa(raw) {
    const parts = nfkc(raw).split(/[&＆]/).map((x) => x.trim()).filter(Boolean);
    const main = resolveOne(parts[0]);
    if (!main) return null;
    const partners = parts.slice(1).map(resolveOne).filter(Boolean).map((p) => p.dex);
    return partners.length ? { ...main, partners } : main;
  }

  function typesFor(pokemonId, dex) {
    const t = (typesOf.get(pokemonId) || typesOf.get(defaultPokemon.get(dex)) || []).filter(Boolean);
    return t;
  }

  /** en/ko/zh_hant 이름. 폼이 있으면 PokeAPI 폼 이름을, 아는 수식어(黒い 등)면 번역을 붙인다. */
  function namesFor(dex, pokemonId, variant) {
    const sp = species.get(dex) || {};
    const f = pokemonId && pokemonId !== defaultPokemon.get(dex)
      ? (formsOfSpecies.get(dex) || []).find((x) => x.pokemon_id === pokemonId && x.form_identifier)
      : null;
    const out = {};
    for (const lang of ["en", "ko", "zh_hant"]) {
      const base = sp[lang];
      if (!base) continue;
      const fn = f?.names?.[lang];
      if (lang === "en" && fn?.pokemon) out[lang] = fn.pokemon;
      else if (fn?.form && norm(fn.form).includes(norm(base))) out[lang] = fn.form;
      else if (fn?.form) out[lang] = `${base} (${fn.form})`;
      else if (f && lang !== "en" && REGION_FORM[f.form_identifier.split("-")[0]]) out[lang] = `${base} (${REGION_FORM[f.form_identifier.split("-")[0]][lang]})`;
      else out[lang] = base;
      const v = VARIANT_NAMES[String(variant || "").trim()];
      if (v) out[lang] = lang === "zh_hant" ? `${v[lang]}${out[lang]}` : `${v[lang]} ${out[lang]}`;
    }
    return out;
  }

  const speciesJa = (dex) => species.get(dex)?.ja || null;

  return { size: species.size, fetchedAt, resolveJa, typesFor, namesFor, speciesJa };
}
