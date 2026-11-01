#!/usr/bin/env node
// Hobby Atlas — ポケモンフレンダ (Pokémon Frienda) 데이터 빌더.
//
// 일본 ポケモンメザスタ 는 ゴージャススター5弾(2024-04-18)으로 끝났고, 2024-07-11 부터 후속작
// ポケモンフレンダ 가 돌고 있다. 수집품은 태그가 아니라 フレンダピック(픽). 이 스크립트는 공식 사이트
// pokemonfrienda.com 의 탄별 픽 목록과 특별 시리즈(ワンダーピック · レガシーピック ·
// スペシャルフレンダピック)를 읽어 data/atlas/pokemon-frienda.json 을 만든다.
// (얼어붙은 JP 메자스타 19탄은 mezastar-jp.json 담당이라 여기서는 다루지 않는다.)
//
//   node scripts/atlas/build_pokemon_frienda.mjs [--out=data/atlas/pokemon-frienda.json] [--report=file]
//
// 환경 변수: ATLAS_CACHE_DIR (원문 캐시, 커밋 안 함, 기본 tmp/atlas-cache/frienda),
//            ATLAS_OFFLINE=1 (캐시만), ATLAS_FRIENDA_IMAGES=0 (img/thumb 필드를 빼고 쓴다).
// Node 20+, 의존성 없음. 매너: 설명적인 User-Agent, 호스트당 1.1 초 간격, 차단되면 기록만 하고
// 이전 파일 값을 그대로 쓴다. 이미지는 URL 만 저장(핫링크), 내려받거나 다시 올리지 않는다.
//
// ID 규칙 (mz-jp: / mz-intl: 와 절대 겹치지 않게 모두 "frienda:" 접두사)
//   frienda:3-2-001   일반 픽 (인쇄 번호 그대로: 시리즈-탄-번호)
//   frienda:3-2-036A  パラレルアートピック (인쇄 번호의 A)
//   frienda:3-2-043S  いろちがい (인쇄 번호의 ★ → S, no 에는 원래 "3-2-043★")
//   frienda:3-2-W01   ワンダーピック (공식 이미지 이름)
//   frienda:3-2-L01   レガシーピック (공식 이벤트 페이지의 순서, 번호가 공개되지 않아 합성)
//   frienda:P-130     スペシャルフレンダピック (공식 이미지 번호 p130)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { politeFetch, blockedHosts, hostReport, USER_AGENT, isBlocked } from "./frienda/http.mjs";
import { SITE, parseLatestLink, parsePageSelect, parseSetPage, parseSpecialList, parseEventIndex, parseLegacyEvent, nearYear, ymd, addDays, weekdayJa } from "./frienda/parse.mjs";
import { loadPokeApi, POKEAPI_SOURCE, nfkc } from "./frienda/pokeapi.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? "1"] : [a, "1"]; }));
const OUT = path.resolve(args.out || "data/atlas/pokemon-frienda.json");
const WITH_IMAGES = process.env.ATLAS_FRIENDA_IMAGES !== "0";
const HOST = "pokemonfrienda.com";
const nowIso = () => new Date().toISOString();

const SERIES = {
  base: { prefix: "", digit: "1", ja: "", en: "Set", ko: "" },
  best_tag: { prefix: "bt", digit: "2", ja: "ベストタッグ", en: "Best Tag Set", ko: "베스트태그 " },
  ex_treasure: { prefix: "xt", digit: "3", ja: "エクストレジャー", en: "Ex Treasure Set", ko: "엑스트레저 " },
};
const seriesOfCode = (code) => Object.entries(SERIES).find(([, s]) => (code.match(/^[a-z]*/)[0]) === s.prefix)?.[0] || null;

const RARITY = {
  super_treasure: { grade: 5, ja: "スーパートレジャーポケモン（★5）" },
  treasure: { grade: 4, ja: "トレジャーポケモン（★4）" },
  normal: { grade: null, ja: "★2・★3ポケモン" },
};

const anomalies = [];
const anomaly = (where, msg) => anomalies.push({ where, msg });

async function get(url, opts = {}) {
  return politeFetch(url, { maxAgeMs: 20 * 3600e3, ...opts });
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    return null;
  }
}

function stripVolatile(d) {
  const c = JSON.parse(JSON.stringify(d));
  delete c.updated_at;
  for (const s of c.sources || []) delete s.fetched_at;
  return JSON.stringify(c);
}

// ---------------------------------------------------------------- 수집

async function crawl() {
  const pages = { sets: [], wonder: null, special: null, legacy: [], fetched_at: null, errors: [] };
  const home = await get(SITE);
  pages.fetched_at = home.fetchedAt;
  const latestUrl = parseLatestLink(home.text, SITE) || abs("/new/");
  const latest = await get(latestUrl);
  const links = parsePageSelect(latest.text, latestUrl);
  if (!links.length) throw new Error(`no set list on ${latestUrl}`);
  for (const l of links) {
    const m = l.href.match(/\/new\/([a-z]*\d+)\.html$/);
    if (m) {
      try {
        const r = l.href === latestUrl ? latest : await get(l.href);
        pages.sets.push({ code: m[1], url: l.href, label: l.label, page: parseSetPage(r.text, l.href), latest: l.href === latestUrl });
      } catch (e) {
        pages.errors.push(`${l.href}: ${e.message}`);
        pages.sets.push({ code: m[1], url: l.href, label: l.label, page: null, error: e.message });
      }
    } else if (/\/new\/wonder\/?$/.test(l.href)) {
      pages.wonder = { url: l.href, items: await safeList(l.href, pages) };
    } else if (/\/new\/special\/?$/.test(l.href)) {
      pages.special = { url: l.href, items: await safeList(l.href, pages) };
    }
  }
  // レガシーピック 이벤트 페이지
  try {
    const evUrl = new URL("/event/", SITE).href;
    const ev = await get(evUrl);
    for (const e of parseEventIndex(ev.text, evUrl).filter((x) => /レガシーピック/.test(x.title))) {
      try {
        const r = await get(e.href, { maxAgeMs: 7 * 86400e3 });
        pages.legacy.push({ url: e.href, ...parseLegacyEvent(r.text, e.href) });
      } catch (err) {
        pages.errors.push(`${e.href}: ${err.message}`);
      }
    }
  } catch (e) {
    pages.errors.push(`event index: ${e.message}`);
  }
  return pages;
}

const abs = (p) => new URL(p, SITE).href;

async function safeList(url, pages) {
  try {
    return parseSpecialList((await get(url)).text, url);
  } catch (e) {
    pages.errors.push(`${url}: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- 조립

function setNames(series, n, label) {
  const s = SERIES[series];
  return { ja: label, en: `${s.en} ${n}`, ko: `${s.ko}${n}탄` };
}

function pickId(no) {
  return `frienda:${nfkc(no).replace(/★|☆/g, "S").replace(/\s+/g, "")}`;
}

function build(pages, api, prev) {
  const prevPicks = new Map((prev?.picks || []).map((p) => [p.id, p]));
  const prevBySet = new Map();
  for (const p of prev?.picks || []) {
    if (!prevBySet.has(p.set)) prevBySet.set(p.set, []);
    prevBySet.get(p.set).push(p);
  }
  const sets = [];
  const picks = [];
  const byId = new Map();
  const add = (p) => {
    if (!p.id.startsWith("frienda:")) throw new Error(`bad id ${p.id}`);
    if (byId.has(p.id)) {
      anomaly(p.id, `duplicate id (${byId.get(p.id).names.ja} / ${p.names.ja}); later one renamed`);
      let k = 2;
      while (byId.has(`${p.id}~${k}`)) k++;
      p.id = `${p.id}~${k}`;
    }
    byId.set(p.id, p);
    picks.push(p);
  };

  const resolve = (name, where) => {
    const r = api.resolveJa(name);
    if (!r) anomaly(where, `could not resolve Pokémon name 「${name}」`);
    return r;
  };
  const enrich = (p, name) => {
    const r = resolve(name, p.id);
    if (r) {
      p.dex = r.dex;
      if (r.form) p.form = r.form;
      if (r.variant) p.variant = r.variant;
      if (r.partners) p.partners = r.partners;
      p.types = api.typesFor(r.pokemon_id, r.dex);
      p.names = { ja: name, ...api.namesFor(r.dex, r.pokemon_id) };
    } else {
      p.dex = null;
      p.types = [];
      p.names = { ja: name };
    }
    return p;
  };
  const withImg = (p, img, thumb) => {
    if (WITH_IMAGES && img) p.img = img;
    if (WITH_IMAGES && thumb) p.thumb = thumb;
    return p;
  };

  // --- 본편 탄 (오래된 순서로 정렬해 ordinal 부여)
  const main = pages.sets
    .map((s) => ({ ...s, series: seriesOfCode(s.code), n: Number(s.code.match(/\d+$/)[0]) }))
    .filter((s) => s.series);
  const releaseOf = (s) => s.page?.start_from_assets || prev?.sets?.find((x) => x.id === `frienda:${s.code}`)?.release_date || null;
  main.sort((a, b) => (releaseOf(a) || "9999").localeCompare(releaseOf(b) || "9999") || a.code.localeCompare(b.code));

  const codeToSet = new Map(); // "3-2" -> set id
  const labelToSet = new Map();
  main.forEach((s, i) => {
    const id = `frienda:${s.code}`;
    labelToSet.set(nfkc(s.label), id);
    const set = { id, ordinal: i + 1, kind: "main", series: s.series, series_no: s.n, code: null, names: setNames(s.series, s.n, s.label), release_date: null, date_src: null, end_date: null, url: s.url };
    if (s.page?.pamphlet) set.pamphlet = s.page.pamphlet;
    sets.push(set);
    const prevSet = prev?.sets?.find((x) => x.id === id);

    // 픽
    let list = s.page?.picks || [];
    const prevList = prevBySet.get(id) || [];
    if (!s.page || (prevList.length && list.length < prevList.length * 0.6)) {
      anomaly(id, s.page ? `parsed ${list.length} picks, previous file had ${prevList.length}; kept previous` : `page failed (${s.error}); kept previous`);
      for (const p of prevList) add(p);
      if (prevSet) Object.assign(set, { code: prevSet.code, release_date: prevSet.release_date, date_src: prevSet.date_src, end_date: prevSet.end_date, end_src: prevSet.end_src, pamphlet: prevSet.pamphlet });
      if (set.code) codeToSet.set(set.code, id);
      set._kept = true;
      return;
    }
    const codes = new Map();
    for (const it of list) {
      const m = nfkc(it.no).match(/^(\d+-\d+)-\d{3}/);
      if (m) codes.set(m[1], (codes.get(m[1]) || 0) + 1);
    }
    set.code = [...codes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (set.code) codeToSet.set(set.code, id);
    if (set.code && set.code[0] !== SERIES[s.series].digit) anomaly(id, `pick numbers ${set.code}-xxx do not match series ${s.series}`);

    const baseByNum = new Map(); // "3-2-036" -> pick
    const pending = [];
    for (const it of list) {
      const no = nfkc(it.no).trim();
      const m = no.match(/^(\d+-\d+-\d{3})([A-Z]?)(★|☆)?$/);
      if (!m) {
        anomaly(id, `unexpected pick number "${it.no}" (${it.name})`);
        continue;
      }
      const kind = m[3] ? "shiny" : m[2] === "A" ? "parallel" : m[2] ? "variant" : "standard";
      const p = { id: pickId(no), set: id, no: it.no, kind };
      if (["super_treasure", "treasure", "normal"].includes(it.group)) p.rarity = it.group;
      p._num = m[1];
      p._name = it.name;
      enrich(p, it.name);
      if (it.orientation) p.orientation = it.orientation;
      if (/_kira\./.test(it.file)) p.kira = true;
      if (it.is_new) p.new = true;
      withImg(p, it.img, it.thumb);
      p.url = `${s.url}#friendapick`;
      if (kind === "standard") baseByNum.set(m[1], p);
      pending.push(p);
    }
    for (const p of pending) {
      if (p.kind !== "standard") {
        const base = baseByNum.get(p._num);
        if (base) {
          // A/★ 는 같은 번호 원본의 등급을 따른다
          p.base = base.id;
          if (base.rarity) p.rarity = base.rarity;
          if (base.dex !== p.dex) anomaly(p.id, `differs from base ${base.id} (${base.names.ja} vs ${p.names.ja})`);
        }
        // 원본 번호가 목록에 없으면 묶음(h3)의 등급을 그대로 쓴다. いろちがい 묶음의 071★ 같은 픽은 등급 미공개.
      }
      if (p.rarity && RARITY[p.rarity].grade) p.grade = RARITY[p.rarity].grade;
      delete p._num;
      delete p._name;
      add(orderPick(p));
    }

    // 날짜: 탄 시작과 함께 바뀌는 그림 이름(YYMMDD) + 본문 「M月D日（木）から稼動する「탄」」 + 실시 기간
    const start = s.page.start_from_assets;
    if (start) {
      set.release_date = start;
      set.date_src = "official-page-asset-date";
      const t = s.page.launch_text.find((x) => nfkc(x.label) === nfkc(s.label));
      if (t) {
        const iso = nearYear(t.month, t.day, start);
        if (iso === start) set.date_src = "official-text";
        else anomaly(id, `launch text says ${iso}, page assets say ${start}`);
      }
      if (weekdayJa(start) !== "木") anomaly(id, `release ${start} is not a Thursday (${weekdayJa(start)})`);
    } else if (prevSet?.release_date) {
      set.release_date = prevSet.release_date;
      set.date_src = prevSet.date_src;
    } else anomaly(id, "no release date found");
    if (s.page.end_date) {
      set.end_date = s.page.end_date;
      set.end_src = "official-text";
    }
    set._page = s.page;
    set._latest = s.latest;
  });

  // 이웃 탄으로 날짜 검증 · 보충
  for (let i = 0; i < sets.length; i++) {
    const cur = sets[i], next = sets[i + 1];
    if (!next || !next.release_date) continue;
    const inferredEnd = addDays(next.release_date, -1);
    if (cur.end_date && cur.end_date !== inferredEnd) anomaly(cur.id, `ends ${cur.end_date} but next set starts ${next.release_date}`);
    if (!cur.end_date) {
      cur.end_date = inferredEnd;
      cur.end_src = "next-set-start";
    }
  }

  // --- ワンダーピック
  const pickupsBySet = new Map(sets.filter((s) => s._page).map((s) => [s.id, s._page.pickups]));
  const announced = (setId, name, kindRe) => {
    for (const pk of pickupsBySet.get(setId) || []) {
      if (!kindRe.test(`${pk.title} ${pk.text}`)) continue;
      if (!pk.names.some((n) => nfkc(n) === nfkc(name))) continue;
      const rel = sets.find((x) => x.id === setId)?.release_date;
      return { date: pk.month && rel ? nearYear(pk.month, pk.day, rel) : null, star5: /★\s*[5５]/.test(`${pk.title} ${pk.text}`), img: pk.img };
    }
    return null;
  };
  const special = [];
  if (pages.wonder?.items) {
    special.push({ id: "frienda:wonder", kind: "wonder", names: { ja: "ワンダーピック", en: "Wonder Picks", ko: "원더 픽" }, url: pages.wonder.url });
    for (const it of pages.wonder.items) {
      const code = it.file.replace(/\.webp$/, "");
      const m = code.match(/^(\d+-\d+)-W(\d+)$/);
      if (!m) {
        anomaly("frienda:wonder", `unexpected wonder image ${it.file}`);
        continue;
      }
      const from = codeToSet.get(m[1]) || null;
      const p = { id: `frienda:${code}`, set: "frienda:wonder", no: it.no || "W", kind: "wonder", rarity: "super_treasure", grade: 5 };
      enrich(p, it.name);
      if (from) p.from_set = from;
      else anomaly(p.id, `wonder pick code ${m[1]} matches no main set`);
      const a = from ? announced(from, it.name, /ワンダー/) : null;
      p.grade_src = a?.star5 ? "official-text" : prevPicks.get(p.id)?.grade_src || "series-rule";
      if (a?.date || prevPicks.get(p.id)?.release_date) p.release_date = a?.date || prevPicks.get(p.id).release_date;
      if (it.orientation) p.orientation = it.orientation;
      if (it.is_new) p.new = true;
      withImg(p, it.img, it.thumb);
      p.url = pages.wonder.url;
      add(orderPick(p));
    }
  } else if (prev) carry(prev, "frienda:wonder", special, add);

  // --- レガシーピック (공식 이벤트 페이지 + 이벤트 페이지가 없는 탄은 탄 페이지 ピックアップ)
  const legacyEntries = []; // { set, date, name, img, url, src }
  for (const ev of pages.legacy) {
    const setId = ev.set_label ? labelToSet.get(nfkc(ev.set_label)) : null;
    if (!setId) {
      anomaly(ev.url, `legacy event "${ev.title}" matches no set`);
      continue;
    }
    ev.picks.forEach((x) => legacyEntries.push({ set: setId, date: ev.start_date, name: x.name, img: x.img, url: ev.url, star5: true }));
  }
  for (const s of sets) {
    if (!s._page) continue;
    if (legacyEntries.some((e) => e.set === s.id)) continue;
    for (const pk of s._page.pickups) {
      if (!/レガシーピック/.test(`${pk.title} ${pk.text}`)) continue;
      const names = pk.names.filter((n) => !/ピック|マーク|[!！?？]/.test(n) && api.resolveJa(n));
      for (const n of names) legacyEntries.push({ set: s.id, date: pk.month ? nearYear(pk.month, pk.day, s.release_date) : null, name: n, img: pk.img, url: `${s.url}#pickup`, star5: /★\s*[5５]/.test(pk.text) });
    }
  }
  if (legacyEntries.length || pages.legacy.length) {
    special.push({ id: "frienda:legacy", kind: "legacy", names: { ja: "レガシーピック", en: "Legacy Picks", ko: "레거시 픽" }, url: legacyEntries.find((e) => /\/event\//.test(e.url))?.url || null });
    const counter = new Map();
    legacyEntries.sort((a, b) => (sets.find((s) => s.id === a.set)?.ordinal || 0) - (sets.find((s) => s.id === b.set)?.ordinal || 0));
    for (const e of legacyEntries) {
      const code = sets.find((s) => s.id === e.set)?.code;
      if (!code) continue;
      const n = (counter.get(code) || 0) + 1;
      counter.set(code, n);
      const p = { id: `frienda:${code}-L${String(n).padStart(2, "0")}`, set: "frienda:legacy", no: "L", kind: "legacy", rarity: "super_treasure", grade: 5, grade_src: e.star5 ? "official-text" : "series-rule" };
      enrich(p, e.name);
      p.from_set = e.set;
      if (e.date) p.release_date = e.date;
      // 금박 재판의 원본: 앞선 탄의 スーパートレジャー 일반 픽 또는 ワンダーピック 중 도감 번호 · 폼 · 수식어가 같은 가장 이른 것
      const ord = (q) => sets.find((s) => s.id === (q.from_set || q.set))?.ordinal || 0;
      const here = sets.find((s) => s.id === e.set)?.ordinal || 0;
      const orig = picks
        .filter((q) => ((q.kind === "standard" && q.rarity === "super_treasure") || q.kind === "wonder") && q.dex && q.dex === p.dex && q.form === p.form && q.variant === p.variant && ord(q) < here)
        .sort((a, b) => ord(a) - ord(b))[0];
      if (orig) p.reprint_of = orig.id;
      withImg(p, e.img, null);
      p.url = e.url;
      add(orderPick(p));
    }
  } else if (prev) carry(prev, "frienda:legacy", special, add);

  // --- スペシャルフレンダピック (프로모)
  if (pages.special?.items) {
    special.push({ id: "frienda:special", kind: "special", names: { ja: "スペシャルフレンダピック", en: "Special Frienda Picks (promos)", ko: "스페셜 프렌다 픽 (프로모)" }, url: pages.special.url });
    for (const it of pages.special.items) {
      const m = it.file.match(/^p(\d+)(?:-[A-Za-z0-9]+)?\.webp$/i); // p053-ayNdxXS8.webp 같은 캐시 꼬리표 허용
      if (!m) {
        anomaly("frienda:special", `unexpected special image ${it.file}`);
        continue;
      }
      const p = { id: `frienda:P-${m[1].padStart(3, "0")}`, set: "frienda:special", no: it.no || "P", kind: "special" };
      enrich(p, it.name);
      if (it.orientation) p.orientation = it.orientation;
      if (it.is_new) p.new = true;
      withImg(p, it.img, it.thumb);
      p.url = pages.special.url;
      add(orderPick(p));
    }
  } else if (prev) carry(prev, "frienda:special", special, add);

  // 특별 시리즈 ordinal 은 101 부터 (본편 탄이 늘어나도 바뀌지 않게)
  special.forEach((s, i) => sets.push({ id: s.id, ordinal: 101 + ["frienda:wonder", "frienda:legacy", "frienda:special"].indexOf(s.id), kind: s.kind, names: s.names, url: s.url }));

  // 개수
  for (const s of sets) {
    const mine = picks.filter((p) => p.set === s.id);
    const by = (k) => mine.reduce((o, p) => (p[k] ? ((o[p[k]] = (o[p[k]] || 0) + 1), o) : o), {});
    s.counts = { total: mine.length, by_kind: by("kind"), ...(s.kind === "main" ? { by_rarity: by("rarity") } : {}) };
    if (s.kind !== "main") {
      const from = by("from_set");
      if (Object.keys(from).length) s.counts.by_from_set = from;
    }
    delete s._page;
    delete s._latest;
    delete s._kept;
  }
  return { sets: sets.map((s) => ordered(s, SET_ORDER)), picks, prevPicks };
}

function carry(prev, setId, special, add) {
  const s = prev.sets?.find((x) => x.id === setId);
  if (!s) return;
  special.push({ id: s.id, kind: s.kind, names: s.names, url: s.url });
  for (const p of prev.picks.filter((q) => q.set === setId)) add(p);
  anomaly(setId, "list unavailable; kept previous picks");
}

const PICK_ORDER = ["id", "set", "no", "kind", "rarity", "grade", "grade_src", "dex", "form", "variant", "partners", "types", "names", "base", "reprint_of", "from_set", "release_date", "orientation", "kira", "new", "img", "thumb", "url"];
const SET_ORDER = ["id", "ordinal", "kind", "series", "series_no", "code", "names", "release_date", "date_src", "end_date", "end_src", "url", "pamphlet", "counts"];
const orderPick = (p) => ordered(p, PICK_ORDER);
function ordered(obj, keys) {
  const o = {};
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) o[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in o) && obj[k] !== undefined && obj[k] !== null) o[k] = obj[k];
  return o;
}

// ---------------------------------------------------------------- 실행

async function main() {
  const prev = await readPrevious();
  let pages;
  const officialSource = {
    name: "ポケモンフレンダ official site (Takara Tomy A.R.T.S. / Marvelous)",
    url: SITE,
    host: HOST,
    licence: "© Pokémon / Nintendo / Creatures / GAME FREAK; site content © Marvelous / T-ARTS. Site terms (https://pokemonfrienda.com/policy/) reserve all rights and ask other sites not to hotlink images or videos. Facts + image URLs only, for personal non-commercial use; images are never copied or rehosted",
    role: "set list (さいしんだん情報), pick numbers, Japanese names, grade group (★5/★4/★2-3), parallel-art/shiny variants, orientation, kira flag, image URLs, set start/end dates, ワンダーピック / レガシーピック / スペシャルフレンダピック lists",
    status: "ok",
  };
  try {
    pages = await crawl();
  } catch (e) {
    officialSource.status = isBlocked(HOST) ? "blocked" : "error";
    officialSource.error = String(e.message || e).slice(0, 300);
    console.error(`[frienda] official site unavailable: ${officialSource.error}`);
    if (prev) {
      console.error("[frienda] keeping previous file unchanged");
      await writeReport({ kept_previous: true, blocked_hosts: blockedHosts(), hosts: hostReport(), error: officialSource.error });
      return;
    }
    throw e;
  }
  if (pages.errors.length) {
    officialSource.status = "partial";
    officialSource.error = pages.errors.join("; ").slice(0, 500);
  }
  officialSource.fetched_at = pages.fetched_at;
  officialSource.pages = 2 + pages.sets.length + (pages.wonder ? 1 : 0) + (pages.special ? 1 : 0) + pages.legacy.length;

  const api = await loadPokeApi();
  const { sets, picks } = build(pages, api, prev);
  const mains = sets.filter((s) => s.kind === "main");
  const latest = mains.at(-1);
  const nextGuess = latest?.end_date ? addDays(latest.end_date, 1) : null;

  const data = {
    schema: 1,
    updated_at: nowIso(),
    game: "frienda",
    edition: {
      id: "frienda",
      names: { ja: "ポケモンフレンダ", en: "Pokémon Frienda", ko: "포켓몬 프렌다" },
      region: "JP",
      started: mains[0]?.release_date || null,
      // 공식 공지: 「ポケモンメザスタシリーズ」は「ポケモンメザスタゴージャススター5弾」をもって稼動終了
      predecessor: { id: "mz-jp", names: { ja: "ポケモンメザスタ", en: "Pokémon Mezastar" }, last_set: "ゴージャススター5弾", last_release: "2024-04-18", status: "ended", notice: "https://www.takaratomy-arts.co.jp/specials/pokemonmezastar/" },
      collectible: { ja: "フレンダピック", en: "Frienda Pick" },
      id_scheme: "frienda:<printed no> for set picks (★ → S), frienda:<set code>-W<nn> wonder (official image name), frienda:<set code>-L<nn> legacy (synthetic: order on the official event page), frienda:P-<nnn> special/promo (official image number). Never overlaps mz-jp: / mz-intl:",
      notes: [
        "Mezastar link (1だん): ゴージャススター5弾 ながれぼしタグ and GS1–4 ★6/★5 tags can be scanned as support Pokémon; Mezastar memory tags transfer to トレーナーピック. Tags themselves are not Frienda picks.",
        "ポケモンセンターバージョン (Pokémon Center / Pokémon Store cabinets, from ベストタッグ2だん) dispenses the same picks as normal cabinets; only cosmetics and charms differ.",
        "Types come from PokeAPI for the resolved form (not verified against Frienda; tera/special picks may differ). Exact ★2 vs ★3 is not published on the official list (rarity 'normal' = ★2・★3).",
      ],
    },
    // next_set_expected = 최신 탄 실시 기간 다음 날 (추정). 새 탄 페이지가 공개되면 sets 에 자동으로 들어온다.
    latest: latest ? { set: latest.id, names: latest.names, release_date: latest.release_date, end_date: latest.end_date, next_set_expected: nextGuess } : null,
    sources: [
      officialSource,
      { ...POKEAPI_SOURCE, status: "ok", fetched_at: nowIso() },
      {
        name: "Bulbapedia (MediaWiki API)",
        url: "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Frienda",
        host: "bulbapedia.bulbagarden.net",
        licence: "CC BY-NC-SA 2.5",
        role: "would add English set names, exact ★2/★3 grades and Frienda-specific types; not used",
        status: "blocked",
        error: "Cloudflare challenge (HTTP 403) for the descriptive bot User-Agent on 2026-11-01; not bypassed",
      },
    ],
    sets,
    picks,
  };
  if (pages && prev && stripVolatile(prev) === stripVolatile(data)) {
    console.log(`[frienda] unchanged (${picks.length} picks)`);
  } else {
    await mkdir(path.dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(data));
    console.log(`[frienda] wrote ${path.relative(process.cwd(), OUT)} (${picks.length} picks)`);
  }
  const text = JSON.stringify(data);
  const metrics = {
    sets: sets.map((s) => ({ id: s.id, ja: s.names.ja, release_date: s.release_date || null, end_date: s.end_date || null, date_src: s.date_src || null, counts: s.counts })),
    picks: picks.length,
    by_kind: picks.reduce((o, p) => ((o[p.kind] = (o[p.kind] || 0) + 1), o), {}),
    dex_resolved: picks.filter((p) => p.dex).length,
    names: Object.fromEntries(["ja", "en", "ko", "zh_hant"].map((l) => [l, picks.filter((p) => p.names?.[l]).length])),
    types: picks.filter((p) => p.types?.length).length,
    images: picks.filter((p) => p.img).length,
    thumbs: picks.filter((p) => p.thumb).length,
    forms: picks.filter((p) => p.form).map((p) => `${p.id} ${p.names.ja} → ${p.form}`),
    variants: picks.filter((p) => p.variant).map((p) => `${p.id} ${p.names.ja} → ${p.dex} (${p.variant})`),
    bytes: Buffer.byteLength(text),
    gzip: gzipSync(text).length,
    latest: data.latest,
  };
  await writeReport({ blocked_hosts: blockedHosts(), hosts: hostReport(), anomalies, metrics, user_agent: USER_AGENT });
  console.log(JSON.stringify({ picks: metrics.picks, by_kind: metrics.by_kind, dex: metrics.dex_resolved, names: metrics.names, images: metrics.images, bytes: metrics.bytes, gzip: metrics.gzip, anomalies: anomalies.length, blocked: blockedHosts() }));
}

async function writeReport(r) {
  if (!args.report) return;
  await mkdir(path.dirname(path.resolve(args.report)), { recursive: true });
  await writeFile(args.report, JSON.stringify(r, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
