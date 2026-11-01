// Merge the frozen Japanese edition (2020-2024, 19 sets + promos) into mezastar-jp.json.
// Official archive = which tags exist + ja names + images; Bulbapedia = EN species, types, exact grade,
// Gorgeous/Ultra Beast/Legacy rows, promo campaigns, release dates; mezastar-dex = stats.
import { nfkc, pad3, slug, uniq } from "./lib/util.mjs";
import { assignPrintingIds } from "./lib/ids.mjs";

export const EDITION_JP = {
  id: "mz-jp",
  name: { ja: "ポケモンメザスタ", en: "Pokémon Mezastar (Japan, 2020-2024)", ko: "포켓몬 메자스타 (일본판)", zh_hant: "寶可夢MEZASTAR（日本版）" },
  regions: { JA: { label: "JA (Japan)", printed_suffix: null, lang: "ja" } },
  id_scheme: "mz-jp:<serial> (1-001, 2-s-NNN, 3-s-NNN, 4-s-NNN, 4-s-NNNG gorgeous, 4-s-UNN ultra beast); mz-jp:<set>-L-<original serial> legacy; mz-jp:P-NNN promos (official image number) or mz-jp:P-<species>-<campaign> (Bulbapedia only). Printing ids: <tag>@JA[:<promo campaign>]",
  status: "ended 2024 (replaced by Pokémon Frienda); data frozen",
};

const SERIES = {
  base: { prefix: (v) => `${v}-`, en: (v) => `Set ${v}`, ja: (v) => `${v}弾` },
  supertag: { prefix: (v) => `2-${v}-`, en: (v) => `Super Tag Set ${v}`, ja: (v) => `スーパータッグ${v}弾` },
  doublechain: { prefix: (v) => `3-${v}-`, en: (v) => `Double Chain Set ${v}`, ja: (v) => `ダブルチェイン${v}弾` },
  gorgeousstar: { prefix: (v) => `4-${v}-`, en: (v) => `Gorgeous Star Set ${v}`, ja: (v) => `ゴージャススター${v}弾` },
};
const NUM = /^(?:\d-\d{3}|\d-\d-\d{3})$/;

function groupFromHeading(h) {
  const s = nfkc(h || "");
  if (/スーパースター/.test(s)) return "superstar";
  if (/スター/.test(s)) return "star";
  if (/★\s*2\s*[~～〜-]\s*4/.test(s)) return "normal";
  if (/とくべつ/.test(s)) return "special";
  if (/ヨコ向き/.test(s)) return "promo:horizontal";
  if (/タテ向き/.test(s)) return "promo:vertical";
  return null;
}
const groupFromGrade = (g) => (g === 6 ? "superstar" : g === 5 ? "star" : g >= 2 && g <= 4 ? "normal" : null);

/** Official promo image number: '.../img/p014.png?v1' -> 14, '.../img/p137-wxfQcSV7XQ2Z.png' -> 137. */
export function promoFile(url) {
  const file = (url || "").split(/[?#]/)[0].split("/").pop().replace(/\.\w+$/, "");
  const m = file.match(/^p(\d+)/i);
  return { file, no: m ? Number(m[1]) : null };
}

export function mergeJp({ jp, bulba, md, poke, reg = null }) {
  const sets = new Map(), tags = new Map(), setAnoms = new Map();
  const sa = (sid, a) => { if (!setAnoms.has(sid)) setAnoms.set(sid, []); setAnoms.get(sid).push(a); };
  const ensureTag = (id, init) => {
    if (!tags.has(id)) tags.set(id, { id, sets: new Set(), printings: [], anomalies: [], names: {}, ...init });
    return tags.get(id);
  };

  for (const p of jp.pages) {
    const id = p.series === "promo" ? "mz-jp:promo" : `mz-jp:${p.series}-${p.version}`;
    const b = bulba?.sets.find((s) => s.series === p.series && s.version === p.version);
    sets.set(id, {
      id, ordinal: p.ordinal, series: p.series, version: p.version, code: p.code,
      names: p.series === "promo" ? { ja: "スペシャルタグ", en: "Promotional tags" } : { ja: p.set_name || SERIES[p.series].ja(p.version), en: SERIES[p.series].en(p.version) },
      releases: [{ region: "JA", local_name: p.set_name, date: b?.date || null, url: p.url, wiki: b?.url || (p.series === "promo" ? bulba?.promo?.url : null) }],
      bulba: b,
    });
    if (p.series !== "promo" && p.set_name && p.set_name !== SERIES[p.series].ja(p.version)) sa(id, `official page title '${p.set_name}' differs from the expected '${SERIES[p.series].ja(p.version)}'`);
  }
  const setOfPage = (code) => [...sets.values()].find((s) => s.code === code);

  // ---- official rows ----------------------------------------------------------------
  const inSetPromos = [];
  for (const r of jp.rows) {
    const set = setOfPage(r.page);
    const grp = groupFromHeading(r.heading);
    const printing = { region: "JA", name: r.name, img_front: r.img_front, img_thumb: r.img_thumb, kira: r.kira || undefined };
    if (r.page === "special" || r.serial === "P") {
      const pf = promoFile(r.img_front);
      const id = pf.no != null ? `mz-jp:P-${pad3(pf.no)}` : `mz-jp:P-${slug(pf.file)}`;
      // in-set specials (DC3_sp_Nyaoha.png) are named by file; on the special-tag page every image is pNNN
      if (pf.no == null && r.page === "special") sa(set.id, `promo image '${pf.file}' has no p<number> name; id taken from the file name`);
      const t = ensureTag(id, { serial: "P", kind: "promo", grade_group: "promo", promo_no: pf.no });
      t.orientation = grp === "promo:horizontal" ? "horizontal" : grp === "promo:vertical" ? "vertical" : t.orientation;
      t.sets.add(set.id);
      t.printings.push(printing);
      if (r.page !== "special") inSetPromos.push({ tag: t, set });
      continue;
    }
    if (!NUM.test(r.serial)) { sa(set.id, `official entry '${r.serial}' '${r.name}' has an unrecognised serial`); continue; }
    const t = ensureTag(`mz-jp:${r.serial}`, { serial: r.serial, kind: "standard" });
    t.sets.add(set.id);
    t.printings.push(printing);
    t.group_official = grp;
    if (!r.serial.startsWith(SERIES[set.series].prefix(set.version))) sa(set.id, `serial ${r.serial} does not carry this set's prefix`);
  }

  // ---- Bulbapedia set lists --------------------------------------------------------
  const dexEn = (n) => poke.resolveEn(n);
  /** species of a tag before enrichment: its Bulbapedia row, else the official ja name */
  const tagDex = (t) => (t.bulba && dexEn(t.bulba.species)?.dex) || poke.resolveLocal(t.printings.find((p) => p.name)?.name, "ja")?.dex || null;
  for (const set of sets.values()) {
    const b = set.bulba;
    if (!b) { if (set.series !== "promo" && bulba) sa(set.id, "no Bulbapedia set list"); continue; }
    if (b.duplicate_rows) sa(set.id, `Bulbapedia page repeats ${b.duplicate_rows} set-list rows (deduplicated)`);
    const bPromos = [];
    for (const row of b.rows) {
      if (row.no === "P") { bPromos.push(row); continue; }
      if (row.no === "L") {
        const prefix = SERIES[set.series].prefix(b.version).replace(/-$/, "");
        const orig = row.page && NUM.test(row.page) ? row.page : null;
        const t = ensureTag(`mz-jp:${prefix}-L-${orig || slug(row.species)}`, { serial: null, kind: "legacy", grade_group: "legacy" });
        t.sets.add(set.id);
        t.reprint_of = orig ? `mz-jp:${orig}` : null;
        t.bulba = row;
        if (!t.printings.length) t.printings.push({ region: "JA", name: null, src: "bulbapedia" });
        continue;
      }
      let m;
      if ((m = row.no.match(/^(\d-\d-\d{3})G$/))) {
        const t = ensureTag(`mz-jp:${row.no}`, { serial: row.no, kind: "gorgeous", base: `mz-jp:${m[1]}` });
        t.sets.add(set.id);
        t.bulba = row;
        if (!t.printings.length) t.printings.push({ region: "JA", name: null, src: "bulbapedia" });
        continue;
      }
      if (/^\d-\d-U\d{2}$/.test(row.no)) {
        const t = ensureTag(`mz-jp:${row.no}`, { serial: row.no, kind: "standard", grade_group: "ultra_beast" });
        t.sets.add(set.id);
        t.bulba = row;
        if (!t.printings.length) t.printings.push({ region: "JA", name: null, src: "bulbapedia" });
        continue;
      }
      const t = tags.get(`mz-jp:${row.no}`);
      if (!t) { sa(set.id, `Bulbapedia row ${row.no} ${row.species} is not on the official page`); continue; }
      if (t.bulba && t.bulba.species !== row.species) t.anomalies.push(`Bulbapedia lists ${row.no} twice (${t.bulba.species} / ${row.species})`);
      t.bulba ||= row;
    }
    // in-set promos (e.g. DC3 starters): align by species, in order
    const mine = inSetPromos.filter((x) => x.set.id === set.id);
    for (const row of bPromos) {
      const d = dexEn(row.species)?.dex;
      const hit = mine.find((x) => !x.tag.bulba && poke.resolveLocal(x.tag.printings[0].name, "ja")?.dex === d);
      if (hit) { hit.tag.bulba = row; hit.tag.promo_campaign = row.page && row.page !== set.bulba?.title?.replace(/ \(Mezastar\)$/, "") ? row.page : undefined; }
      else sa(set.id, `Bulbapedia in-set promo ${row.species} not matched to the official page`);
    }
  }

  // ---- promo page alignment (per species, in chronological order) -----------------------
  if (bulba?.promo) {
    const official = [...tags.values()].filter((t) => t.kind === "promo" && t.sets.has("mz-jp:promo")).sort((a, b) => (a.promo_no ?? 1e9) - (b.promo_no ?? 1e9));
    const byDex = new Map();
    for (const t of official) {
      const d = poke.resolveLocal(t.printings[0].name, "ja")?.dex || 0;
      if (!byDex.has(d)) byDex.set(d, []);
      byDex.get(d).push(t);
    }
    const bRows = bulba.promo.rows;
    const used = new Map();
    let extra = 0;
    for (const row of bRows) {
      if (row.no !== "P") {
        // promotional variant of a numbered tag -> extra printing on that tag, if the species agrees
        const d = dexEn(row.species)?.dex || null;
        const listed = tags.get(`mz-jp:${row.no}`);
        let t = listed;
        if (listed && d && tagDex(listed) && tagDex(listed) !== d) {
          // Bulbapedia data error (Chespin, Braixen and Greninja are all listed as 3-4-034):
          // re-home the row to the one tag of that species in the same set, else skip it
          const prefix = (row.no.match(/^(\d-(?:\d-)?)/) || [])[1] || "";
          const re = new RegExp(`^${prefix}\\d{3}$`);
          const cands = [...tags.values()].filter((x) => x.kind === "standard" && re.test(x.serial || "") && tagDex(x) === d);
          t = cands.length === 1 ? cands[0] : null;
          const what = `Bulbapedia lists the '${row.page}' promo variant of ${row.species} as ${row.no}, which is ${listed.bulba?.species || listed.printings[0].name}`;
          if (t) t.anomalies.push(`${what}; re-assigned to ${t.serial} by species`);
          else sa("mz-jp:promo", `${what}; no unique ${row.species} tag in that set, variant skipped`);
        }
        if (!t) {
          if (!listed) sa("mz-jp:promo", `Bulbapedia promo variant ${row.no} ${row.species} has no matching tag`);
          continue;
        }
        if (t.printings.some((p) => p.variant === (row.page || "promo"))) {
          sa("mz-jp:promo", `Bulbapedia lists the '${row.page}' variant of ${t.serial} twice (deduplicated)`);
          continue;
        }
        t.printings.push({ region: "JA", variant: row.page || "promo", name: null, src: "bulbapedia" });
        continue;
      }
      const d = dexEn(row.species)?.dex || 0;
      const list = byDex.get(d) || [];
      const k = used.get(d) || 0;
      if (k < list.length) {
        used.set(d, k + 1);
        list[k].bulba = row;
        list[k].promo_campaign = row.page || undefined;
      } else {
        extra++;
        const base = `mz-jp:P-${slug(row.species)}-${slug(row.page || "promo")}`;
        let id = base;
        for (let n = 2; tags.has(id); n++) id = `${base}-${n}`;
        const t = ensureTag(id, { serial: "P", kind: "promo", grade_group: "promo", promo_campaign: row.page || undefined });
        t.sets.add("mz-jp:promo");
        t.bulba = row;
        t.printings.push({ region: "JA", name: null, src: "bulbapedia" });
        t.anomalies.push("listed on Bulbapedia but not on the official special-tag page (no image)");
      }
    }
    const bCount = new Map();
    for (const row of bRows) if (row.no === "P") { const d = dexEn(row.species)?.dex || 0; bCount.set(d, (bCount.get(d) || 0) + 1); }
    for (const [d, list] of byDex) {
      const k = used.get(d) || 0;
      if (d && (bCount.get(d) || 0) !== list.length)
        for (const t of list.slice(0, k)) t.anomalies.push(`promo campaign matched by order but uncertain (official ${list.length} vs Bulbapedia ${bCount.get(d) || 0} promos of this species)`);
      for (const t of list.slice(k)) t.anomalies.push("official promo without a matching Bulbapedia promo row (species/order alignment)");
      if (d === 0) for (const t of list) t.anomalies.push(`official name '${t.printings[0].name}' not resolved to a species`);
    }
  }

  // ---- enrichment ----------------------------------------------------------------------
  for (const t of tags.values()) {
    const official = t.printings.find((p) => p.name && p.src !== "bulbapedia");
    const base = t.base ? tags.get(t.base) : t.reprint_of ? tags.get(t.reprint_of) : null;
    const baseName = base?.printings.find((p) => p.name)?.name || null;
    const b = t.bulba;
    let res = b ? dexEn(b.species) : null;
    if (b && !res) t.anomalies.push(`Bulbapedia species '${b.species}' not found in PokeAPI`);
    const jaName = official?.name || baseName;
    if (!res && jaName) { const r = poke.resolveLocal(jaName, "ja"); if (r) res = { dex: r.dex, form: null }; }
    t.dex = res?.dex || null;
    t.form = res?.form || null;
    if (!t.dex) t.anomalies.push("species not resolved");
    if (b && jaName && t.dex) {
      const jd = poke.resolveLocal(jaName, "ja")?.dex;
      if (jd && jd !== t.dex) t.anomalies.push(`official ja '${jaName}' (#${jd}) vs Bulbapedia '${b.species}' (#${t.dex})`);
    }
    for (const p of t.printings) if (!p.name && (baseName || jaName)) { p.name = baseName || jaName; p.name_from = base ? "base tag" : undefined; }
    for (const p of t.printings) if (!p.name && t.dex) { p.name = poke.displayName(t.dex, t.form, "ja"); p.name_from = "PokeAPI"; }
    if (official && t.dex && !poke.nameAgrees(t.dex, "ja", official.name)) t.anomalies.push(`JA name '${official.name}' does not contain PokeAPI ja '${poke.name(t.dex, "ja")}'`);

    // fallback names follow the official style: regional/Primal prefix, other forms in brackets
    const derived = (lang) => (t.dex ? poke.displayName(t.dex, t.form, lang) : null);
    t.names = { ja: jaName || derived("ja"), en: b?.species || derived("en"), ko: derived("ko"), zh_hant: derived("zh_hant") };
    t.names_derived = ["ja", "en", "ko", "zh_hant"].filter((l) => t.names[l] && !(l === "ja" ? official || baseName : l === "en" ? b : false));

    // grade
    const mdj = t.serial ? md.jp.get(t.serial.replace(/G$/, "")) : null;
    const gB = b?.grade ?? null, gM = mdj?.grade ?? null;
    if (t.kind === "promo") t.grade = gB;
    else t.grade = gB ?? gM ?? null;
    t.grade_src = gB ? "Bulbapedia" : gM ? "mezastar-dex" : null;
    if (gB && gM && gB !== gM && t.kind !== "gorgeous") t.anomalies.push(`grade: Bulbapedia ★${gB} vs mezastar-dex ★${gM}`);
    if (!t.grade_group) {
      const og = t.group_official;
      t.grade_group = og && og !== "special" ? og : groupFromGrade(t.grade) || og || null;
      if (og === "special") t.special = true;
    }
    if (t.kind === "gorgeous" && !t.grade_group) t.grade_group = groupFromGrade(t.grade);
    if (t.kind === "standard" && t.grade && t.group_official && t.group_official !== "special" && groupFromGrade(t.grade) !== t.group_official)
      t.anomalies.push(`grade ★${t.grade} does not fit official group '${t.group_official}'`);
    if (t.kind === "standard" && !b && t.grade_group !== "ultra_beast") t.anomalies.push("no Bulbapedia row (types/grade missing)");

    // types
    const typeForm = /^(mega( [a-z])?|gigantamax|dynamax|primal)$/i.test(t.form || "") ? null : t.form;
    t.types = b?.types?.length ? b.types : t.dex ? poke.typesFor(t.dex, typeForm) : [];
    t.types_src = b?.types?.length ? "Bulbapedia" : t.types.length ? "PokeAPI" : null;
    if (b?.types?.length && t.dex) {
      const combos = poke.typeCombos(t.dex);
      if (combos.length && !combos.includes(b.types.join("/")) && !combos.includes([...b.types].reverse().join("/")))
        t.anomalies.push(`types: Bulbapedia ${b.types.join("/")} not among PokeAPI forms (${uniq(combos).join(", ")})`);
    }
    if (mdj && t.kind !== "gorgeous") {
      t.stats = mdj.stats;
      t.move = mdj.move;
      if (mdj.name && b?.species && poke.resolveEn(mdj.name)?.dex !== t.dex) t.anomalies.push(`mezastar-dex JP stats are for '${mdj.name}'`);
    }
  }

  // ---- output --------------------------------------------------------------------------
  const ordOf = new Map([...sets.values()].map((s) => [s.id, s.ordinal]));
  const KIND = { standard: 0, gorgeous: 1, legacy: 2, promo: 3 };
  const outSets = [...sets.values()].sort((a, b) => a.ordinal - b.ordinal).map((s) => {
    const inSet = [...tags.values()].filter((t) => t.sets.has(s.id));
    const byKind = {};
    for (const t of inSet) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
    return {
      id: s.id, ordinal: s.ordinal, series: s.series, names: s.names, releases: s.releases,
      counts: { total: inSet.length, ...byKind, by_region: { JA: inSet.filter((t) => t.printings.some((p) => p.img_front)).length } },
      anomalies: setAnoms.get(s.id),
    };
  });
  const outTags = [...tags.values()]
    .map((t) => {
      const setsSorted = [...t.sets].sort((a, b) => ordOf.get(a) - ordOf.get(b));
      const printings = assignPrintingIds(t.id, t.printings.map((p) => ({
        id: null, region: "JA", variant: p.variant, name: p.name, name_from: p.name_from, img_front: p.img_front, img_thumb: p.img_thumb, kira: p.kira, src: p.src,
      })), { reg });
      return {
        id: t.id, serial: t.serial, kind: t.kind, grade: t.grade, grade_src: t.grade_src, grade_group: t.grade_group, special: t.special,
        dex: t.dex, form: t.form, types: t.types, orientation: t.orientation, names: t.names, names_derived: t.names_derived,
        sets: setsSorted, base: t.base, reprint_of: t.reprint_of, promo_campaign: t.promo_campaign,
        printings, stats: t.stats, move: t.move, anomalies: uniq(t.anomalies),
        _s: [ordOf.get(setsSorted[0]) ?? 999, KIND[t.kind] ?? 9, t.promo_no ?? 0, t.id],
      };
    })
    .sort((a, b) => {
      for (let i = 0; i < 4; i++) if (a._s[i] !== b._s[i]) return a._s[i] < b._s[i] ? -1 : 1;
      return 0;
    })
    .map(({ _s, ...t }) => t);
  return { sets: outSets, tags: outTags };
}
