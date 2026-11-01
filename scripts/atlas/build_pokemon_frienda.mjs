#!/usr/bin/env node
// Hobby Atlas — ポケモンフレンダ (Pokémon Frienda) 데이터 빌더.
//
// 일본 ポケモンメザスタ 는 ゴージャススター5弾(2024-04-18)으로 끝났고, 2024-07-11 부터 후속작
// ポケモンフレンダ 가 돌고 있다. 수집품은 태그가 아니라 フレンダピック(픽). 이 스크립트는 공식 사이트
// pokemonfrienda.com 의 탄별 픽 목록과 특별 시리즈(ワンダーピック · レガシーピック ·
// スペシャルフレンダピック), 픽 메커닉(テラスタル · Zワザ · メガシンカ · ダイマックス · タッグわざ),
// 프로모 캠페인 페이지를 읽어 data/atlas/pokemon-frienda.json 을 만든다.
// (얼어붙은 JP 메자스타 19탄은 mezastar-jp.json 담당이라 여기서는 다루지 않는다.)
//
//   node scripts/atlas/build_pokemon_frienda.mjs [--out=data/atlas/pokemon-frienda.json] [--report=file]
//
// 환경 변수: ATLAS_CACHE_DIR (원문 캐시, 커밋 안 함, 기본 tmp/atlas-cache/frienda),
//            ATLAS_OFFLINE=1 (캐시만),
//            ATLAS_FRIENDA_IMAGES=1 (img/thumb 이미지 URL 을 넣는다. 기본은 넣지 않음:
//            사이트 이용 약관 https://pokemonfrienda.com/policy/ 이 다른 사이트의 직링크를 삼가 달라고 한다).
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
import {
  SITE, ENDED_RE, MECHANICS, parseLatestLink, parsePageSelect, parseSetPage, parseSpecialList, parseEventIndex, parseLegacyEvent, parseCampaign,
  mechanicMentions, mechanicsIn, splitQualifier, nearYear, addDays, weekdayJa,
} from "./frienda/parse.mjs";
import { loadPokeApi, POKEAPI_SOURCE, nfkc } from "./frienda/pokeapi.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? "1"] : [a, "1"]; }));
const OUT = path.resolve(args.out || "data/atlas/pokemon-frienda.json");
const WITH_IMAGES = process.env.ATLAS_FRIENDA_IMAGES === "1";
const HOST = "pokemonfrienda.com";
const nowIso = () => new Date().toISOString();
const KEEP_RATIO = 0.6; // 새로 읽은 픽이 이전 파일의 60% 미만이면 이전 값을 지킨다

const SERIES = {
  base: { prefix: "", digit: "1", ja: "", en: "Set", ko: "" },
  best_tag: { prefix: "bt", digit: "2", ja: "ベストタッグ", en: "Best Tag Set", ko: "베스트태그 " },
  ex_treasure: { prefix: "xt", digit: "3", ja: "エクストレジャー", en: "Ex Treasure Set", ko: "엑스트레저 " },
};
const prefixOf = (code) => code.match(/^[a-z]*/)[0];
// 모르는 접두사(새 시리즈)는 버리지 않고 접두사 자체를 시리즈 키로 쓴다 (anomaly 로 알린다).
const seriesOfCode = (code) => Object.entries(SERIES).find(([, s]) => prefixOf(code) === s.prefix)?.[0] || prefixOf(code);
const seriesInfo = (key) => SERIES[key] || { prefix: key, digit: null, en: `${key.toUpperCase()} Set`, ko: `${key.toUpperCase()} ` };

const RARITY = {
  super_treasure: { grade: 5, ja: "スーパートレジャーポケモン（★5）" },
  treasure: { grade: 4, ja: "トレジャーポケモン（★4）" },
  normal: { grade: null, ja: "★2・★3ポケモン" },
};

const anomalies = [];
const anomaly = (where, msg) => anomalies.push({ where, msg });

const EVENT_FETCH = { maxAgeMs: 7 * 86400e3, isFinal: (t) => ENDED_RE.test(t) };
// 프로모 캠페인 후보: 제목에 픽 배포를 뜻하는 말이 있고, 레거시 · 원더(따로 처리)나 대회 · 티켓이 아닌 것
const CAMPAIGN_RE = /ピック|スタンプラリー/;
const CAMPAIGN_SKIP_RE = /レガシーピック|ワンダーピック|サポートポケモンチケット|オンライン大会|店頭大会/;

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

async function crawl(prev) {
  const pages = { sets: [], wonder: null, special: null, legacy: [], legacy_failed: false, campaigns: [], campaigns_failed: false, fetched_at: null, errors: [] };
  const home = await get(SITE);
  pages.fetched_at = home.fetchedAt;
  let latestUrl = parseLatestLink(home.text, SITE);
  if (!latestUrl) {
    // /new/ 자체는 디렉터리라 403 이다. 이전 파일의 최신 탄이나 1だん 페이지에도 같은 탄 목록이 있다.
    const prevLatest = prev?.sets?.find((s) => s.id === prev?.latest?.set)?.url;
    latestUrl = prevLatest || abs("/new/1.html");
    anomaly("crawl", `home navigation link to the latest set is missing; used ${latestUrl}`);
  }
  const latest = await get(latestUrl);
  const links = parsePageSelect(latest.text, latestUrl);
  if (!links.length) throw new Error(`no set list on ${latestUrl}`);
  for (const l of links) {
    const m = l.href.match(/\/new\/([a-z]*\d+)\.html$/);
    if (m) {
      try {
        const r = l.href === latestUrl ? latest : await get(l.href);
        pages.sets.push({ code: m[1], url: l.href, label: l.label, page: parseSetPage(r.text, l.href) });
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
  // 이벤트 목록 → レガシーピック 이벤트 페이지 + 프로모 캠페인 페이지 (끝난 이벤트는 캐시를 계속 쓴다)
  let events = null;
  try {
    const evUrl = abs("/event/");
    events = parseEventIndex((await get(evUrl)).text, evUrl);
  } catch (e) {
    pages.errors.push(`event index: ${e.message}`);
    pages.legacy_failed = true;
    pages.campaigns_failed = true;
  }
  for (const e of (events || []).filter((x) => /レガシーピック/.test(x.title))) {
    try {
      const r = await get(e.href, EVENT_FETCH);
      pages.legacy.push({ url: e.href, ...parseLegacyEvent(r.text, e.href) });
    } catch (err) {
      pages.errors.push(`${e.href}: ${err.message}`);
      pages.legacy_failed = true;
    }
  }
  for (const e of (events || []).filter((x) => CAMPAIGN_RE.test(x.title) && !CAMPAIGN_SKIP_RE.test(x.title))) {
    try {
      const r = await get(e.href, EVENT_FETCH);
      pages.campaigns.push({ url: e.href, id: e.href.match(/\/event\/([^/]+)\/?$/)?.[1] || e.href, index_title: e.title, ...parseCampaign(r.text, e.href) });
    } catch (err) {
      pages.errors.push(`${e.href}: ${err.message}`);
      pages.campaigns_failed = true;
    }
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
  const s = seriesInfo(series);
  return { ja: label, en: `${s.en} ${n}`, ko: `${s.ko}${n}탄` };
}

function pickId(no) {
  return `frienda:${nfkc(no).replace(/★|☆/g, "S").replace(/\s+/g, "")}`;
}

// 이름 · 폼에서 바로 알 수 있는 메커닉 (メガ… 폼, キョダイマックス 폼, ＆ 로 이은 タッグわざピック)
const nameMechanic = (r) => (r?.form?.startsWith("mega") ? "mega" : r?.form === "gmax" ? "gmax" : r?.partners?.length ? "tag" : null);

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
  const setMechanic = (p, mech, tera) => {
    if (!mech) return;
    if (p.mechanic && p.mechanic !== mech) {
      anomaly(p.id, `mechanic ${p.mechanic} kept, official text also says ${mech}`);
      return;
    }
    p.mechanic = mech;
    if (tera) p.tera = tera;
  };
  const enrich = (p, name) => {
    const r = resolve(name, p.id);
    if (r) {
      p.dex = r.dex;
      if (r.form) p.form = r.form;
      if (r.variant) p.variant = r.variant;
      if (r.partners) p.partners = r.partners;
      p.types = api.typesFor(r.pokemon_id, r.dex);
      p.names = { ja: name, ...api.namesFor(r.dex, r.pokemon_id, r.variant) };
      setMechanic(p, nameMechanic(r));
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
  const ordOf = (setId) => sets.find((s) => s.id === setId)?.ordinal || 0;

  // --- 본편 탄 (오래된 순서로 정렬해 ordinal 부여)
  const main = pages.sets.map((s) => ({ ...s, series: seriesOfCode(s.code), n: Number(s.code.match(/\d+$/)[0]) }));
  for (const pre of new Set(main.filter((s) => !SERIES[s.series]).map((s) => s.series))) {
    const labels = main.filter((s) => s.series === pre).map((s) => s.label).join(", ");
    anomaly(`frienda:${pre}`, `unknown series prefix "${pre}" (${labels}); included with generic en/ko names — add it to SERIES in build_pokemon_frienda.mjs`);
  }
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
    const list = s.page?.picks || [];
    const prevList = prevBySet.get(id) || [];
    if (!s.page || (prevList.length && list.length < prevList.length * KEEP_RATIO)) {
      anomaly(id, s.page ? `parsed ${list.length} picks, previous file had ${prevList.length}; kept previous` : `page failed (${s.error}); kept previous`);
      for (const p of prevList) add(p);
      if (prevSet) Object.assign(set, { code: prevSet.code, release_date: prevSet.release_date, date_src: prevSet.date_src, end_date: prevSet.end_date, end_src: prevSet.end_src, pamphlet: prevSet.pamphlet });
      if (set.code) codeToSet.set(set.code, id);
      return;
    }
    const codes = new Map();
    for (const it of list) {
      const m = nfkc(it.no).match(/^(\d+-\d+)-\d{3}/);
      if (m) codes.set(m[1], (codes.get(m[1]) || 0) + 1);
    }
    set.code = [...codes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (set.code) codeToSet.set(set.code, id);
    const digit = SERIES[s.series]?.digit;
    if (set.code && digit && set.code[0] !== digit) anomaly(id, `pick numbers ${set.code}-xxx do not match series ${s.series}`);

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
    }

    // 注目のフレンダピック 의 메커닉 (テラスタル · Zワザ · メガシンカ · ダイマックス): 같은 탄의 일반 픽에 도감 번호로
    // 붙이고, 같은 번호의 パラレル / いろちがい 에도 붙인다. 공식 문구가 말한 픽에만 있다 (없음 ≠ 메커닉 없음).
    for (const rec of s.page.recommend || []) {
      const whole = `${rec.title}！ ${rec.text}`;
      const grade = /★\s*[5５]/.test(whole) ? "super_treasure" : /★\s*[4４]/.test(whole) ? "treasure" : null;
      const byPick = new Map();
      for (const mm of mechanicMentions(whole)) {
        if (!mm.mechanic) continue;
        const r = api.resolveJa(mm.name);
        if (!r) continue;
        let cands = pending.filter((p) => p.kind === "standard" && p.dex === r.dex);
        if (cands.length > 1 && r.form && !r.form.startsWith("mega")) cands = cands.filter((p) => p.form === r.form).length ? cands.filter((p) => p.form === r.form) : cands;
        if (cands.length > 1 && grade) cands = cands.filter((p) => p.rarity === grade).length ? cands.filter((p) => p.rarity === grade) : cands;
        if (!cands.length) {
          anomaly(id, `注目 「${mm.name}」 (${mm.mechanic}) matches no pick in this set`);
          continue;
        }
        if (cands.length > 1) anomaly(id, `注目 「${mm.name}」 matches ${cands.map((p) => p.id).join(", ")}; used the first`);
        byPick.set(cands[0].id, { pick: cands[0], ...mm });
      }
      for (const { pick, mechanic, tera } of byPick.values()) {
        for (const p of pending.filter((q) => q === pick || q.base === pick.id)) setMechanic(p, mechanic, tera);
      }
    }
    for (const p of pending) add(orderPick(p));

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
  const labelsLongFirst = [...labelToSet.keys()].sort((a, b) => b.length - a.length);
  const setOfText = (t) => {
    const n = nfkc(t);
    const l = labelsLongFirst.find((x) => n.includes(x));
    return l ? labelToSet.get(l) : null;
  };

  const special = [];
  // 새로 만든 특별 시리즈 픽이 이전 파일보다 크게 줄었으면(페이지 일부 실패 · 마크업 변경) 이전 값을 지킨다.
  const commit = (setId, fresh, why) => {
    const prevList = prevBySet.get(setId) || [];
    if (why || (prevList.length && fresh.length < prevList.length * KEEP_RATIO)) {
      if (prev && carry(prev, setId, special, add, why || `parsed ${fresh.length} picks, previous file had ${prevList.length}`)) return false;
    }
    for (const p of fresh) add(orderPick(p));
    return true;
  };

  // --- ワンダーピック
  // 목록 이름은 「リザードン」 처럼 종 이름뿐이라, 같은 탄 ピックアップ 공지의 이름(「メガリザードンX」 「黒いレックウザ」)을
  // 도감 번호로 W 순서대로 맞춘다. 공지 이름이 모자라면(일러스트 2종) 같은 공지 이름을 다시 쓴다.
  const wonderMentions = new Map(); // set id -> [{ name, dex, date, star5, mechanic, tera, href, uses }]
  for (const s of sets) {
    if (!s._page) continue;
    const list = [];
    for (const pk of s._page.pickups) {
      const whole = `${pk.title}！ ${pk.text}`;
      if (!/ワンダー/.test(whole)) continue;
      const mech = new Map(mechanicMentions(whole).map((m) => [m.name, m]));
      const date = pk.month && s.release_date ? nearYear(pk.month, pk.day, s.release_date) : null;
      for (const raw of pk.names) {
        const q = splitQualifier(raw);
        const r = api.resolveJa(q.name);
        if (!r) continue;
        const mm = mech.get(q.name) || {};
        list.push({ name: q.name, dex: r.dex, date, star5: /★\s*[5５]/.test(whole), mechanic: mm.mechanic || q.mechanic || null, tera: mm.tera || q.tera || null, href: pk.href, uses: 0 });
      }
    }
    wonderMentions.set(s.id, list);
  }
  if (pages.wonder?.items) {
    const fresh = [];
    for (const it of pages.wonder.items) {
      const code = it.file.replace(/\.webp$/, "");
      const m = code.match(/^(\d+-\d+)-W(\d+)$/);
      if (!m) {
        anomaly("frienda:wonder", `unexpected wonder image ${it.file}`);
        continue;
      }
      const id = `frienda:${code}`;
      const from = codeToSet.get(m[1]) || null;
      if (!from) anomaly(id, `wonder pick code ${m[1]} matches no main set`);
      fresh.push({ id, from, it, w: Number(m[2]) });
    }
    // 같은 탄 안에서는 W 번호 순서로 공지 이름을 배정한다 (목록은 최신 탄부터라 탄 순서는 그대로 둔다)
    const order = [...fresh].sort((a, b) => (a.from || "").localeCompare(b.from || "") || a.w - b.w);
    for (const f of order) {
      const r = api.resolveJa(f.it.name);
      const ms = wonderMentions.get(f.from) || [];
      const pv = prevPicks.get(f.id);
      let mt = null;
      if (r) {
        mt = ms.find((x) => !x.uses && nfkc(x.name) === nfkc(f.it.name)) || ms.find((x) => !x.uses && x.dex === r.dex) || [...ms].reverse().find((x) => x.dex === r.dex) || null;
        if (mt) mt.uses++;
      }
      // 공지가 사라진 경우(탄 페이지 실패 · 공지 교체) 이전 파일의 공식 이름을 이어 쓴다
      const carried = !mt && pv?.dex && r && pv.dex === r.dex && pv.names?.ja !== f.it.name ? pv : null;
      f.name = mt?.name || carried?.names.ja || f.it.name;
      f.mt = mt;
      f.pv = pv;
      f.carried = carried;
    }
    const sameName = new Map();
    for (const f of order) {
      const k = `${f.from} ${nfkc(f.name)}`;
      sameName.set(k, [...(sameName.get(k) || []), f]);
    }
    const wonderPicks = [];
    for (const f of fresh) {
      const p = { id: f.id, set: "frienda:wonder", no: f.it.no || "W", kind: "wonder", rarity: "super_treasure", grade: 5 };
      enrich(p, f.name);
      if (f.from) p.from_set = f.from;
      const siblings = sameName.get(`${f.from} ${nfkc(f.name)}`) || [];
      if (siblings.length > 1) p.art = siblings.indexOf(f) + 1; // 같은 픽의 일러스트 여러 종 (예: 3だん 黒いレックウザ 2종)
      p.grade_src = f.mt?.star5 ? "official-text" : f.pv?.grade_src || "series-rule";
      const date = f.mt?.date || f.pv?.release_date;
      if (date) p.release_date = date;
      if (f.mt) setMechanic(p, f.mt.mechanic, f.mt.tera);
      else if (f.carried?.mechanic) setMechanic(p, f.carried.mechanic, f.carried.tera);
      if (f.mt?.href || f.carried?.event) p.event = f.mt?.href || f.carried.event;
      if (!f.mt && !f.carried && f.from && wonderMentions.has(f.from)) anomaly(p.id, `no ワンダーピック announcement on the ${f.from} page names 「${f.it.name}」`);
      if (f.it.orientation) p.orientation = f.it.orientation;
      if (f.it.is_new) p.new = true;
      withImg(p, f.it.img, f.it.thumb);
      p.url = pages.wonder.url;
      wonderPicks.push(p);
    }
    if (commit("frienda:wonder", wonderPicks)) special.push({ id: "frienda:wonder", kind: "wonder", names: { ja: "ワンダーピック", en: "Wonder Picks", ko: "원더 픽" }, url: pages.wonder.url });
  } else if (prev) carry(prev, "frienda:wonder", special, add, "list unavailable");

  // --- レガシーピック (공식 이벤트 페이지 + 이벤트 페이지가 없는 탄은 탄 페이지 ピックアップ)
  // 이벤트 목록이나 레거시 이벤트 페이지가 하나라도 실패하면 이전 파일의 레거시 픽을 그대로 쓴다
  // (ピックアップ 대체 경로가 다른 이미지 · 순서로 픽을 다시 만들어 id 가 흔들리지 않게).
  if (pages.legacy_failed && prevBySet.get("frienda:legacy")?.length) {
    carry(prev, "frienda:legacy", special, add, "event index or a legacy event page failed");
  } else {
    if (pages.legacy_failed) anomaly("frienda:legacy", "event index or a legacy event page failed and there is no previous file; built from what was read");
    const legacyEntries = []; // { set, date, name, img, url, star5 }
    for (const ev of pages.legacy) {
      const setId = (ev.set_label && labelToSet.get(nfkc(ev.set_label))) || setOfText(ev.title);
      if (!setId) {
        anomaly(ev.url, `legacy event "${ev.title}" matches no set`);
        continue;
      }
      if (!ev.picks.length) anomaly(ev.url, `legacy event "${ev.title}" lists no picks`);
      ev.picks.forEach((x) => legacyEntries.push({ set: setId, date: ev.start_date, name: x.name, img: x.img, url: ev.url, star5: true }));
    }
    for (const s of sets) {
      if (!s._page) continue;
      if (legacyEntries.some((e) => e.set === s.id)) continue;
      for (const pk of s._page.pickups) {
        if (!/レガシーピック/.test(`${pk.title} ${pk.text}`)) continue;
        if (setOfText(`${pk.title} ${pk.text}`) && setOfText(`${pk.title} ${pk.text}`) !== s.id) continue; // 지난 탄 공지가 남아 있는 것
        const names = pk.names.filter((n) => !/ピック|マーク|[!！?？]/.test(n) && api.resolveJa(n));
        // ピックアップ 그림은 여러 픽을 묶은 배너라 픽 이미지로 쓰지 않는다.
        for (const n of names) legacyEntries.push({ set: s.id, date: pk.month ? nearYear(pk.month, pk.day, s.release_date) : null, name: n, img: null, url: `${s.url}#pickup`, event: pk.href, star5: /★\s*[5５]/.test(pk.text) });
      }
    }
    if (legacyEntries.length || pages.legacy.length) {
      const fresh = [];
      const counter = new Map();
      legacyEntries.sort((a, b) => ordOf(a.set) - ordOf(b.set));
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
        const ord = (q) => ordOf(q.from_set || q.set);
        const here = ordOf(e.set);
        const orig = picks
          .filter((q) => ((q.kind === "standard" && q.rarity === "super_treasure") || q.kind === "wonder") && q.dex && q.dex === p.dex && q.form === p.form && q.variant === p.variant && ord(q) < here)
          .sort((a, b) => ord(a) - ord(b) || a.id.localeCompare(b.id))[0];
        if (orig) p.reprint_of = orig.id;
        if (e.event) p.event = e.event;
        withImg(p, e.img, null);
        p.url = e.url;
        fresh.push(p);
      }
      if (commit("frienda:legacy", fresh)) special.push({ id: "frienda:legacy", kind: "legacy", names: { ja: "レガシーピック", en: "Legacy Picks", ko: "레거시 픽" }, url: legacyEntries.find((e) => /\/event\//.test(e.url))?.url || null });
    } else if (prev) carry(prev, "frienda:legacy", special, add, "no legacy picks found");
  }

  // --- スペシャルフレンダピック (프로모)
  if (pages.special?.items) {
    const fresh = [];
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
      fresh.push(p);
    }
    if (commit("frienda:special", fresh)) special.push({ id: "frienda:special", kind: "special", names: { ja: "スペシャルフレンダピック", en: "Special Frienda Picks (promos)", ko: "스페셜 프렌다 픽 (프로모)" }, url: pages.special.url });
  } else if (prev) carry(prev, "frienda:special", special, add, "list unavailable");

  // --- 프로모 캠페인 (공식 이벤트 페이지). 목록의 P 번호와는 잇지 않는다: 목록에는 종 이름뿐이라
  //     (예: リザードン 9장) 어느 캠페인의 픽인지 공식 정보로 정할 수 없다.
  let campaigns = [];
  if (pages.campaigns_failed && prev) {
    campaigns = prev.sets?.find((s) => s.id === "frienda:special")?.campaigns || [];
    anomaly("frienda:special", "event index or a campaign page failed; kept previous campaigns");
  } else {
    for (const c of pages.campaigns) {
      const cp = [];
      for (const m of c.mentions) {
        const q = splitQualifier(m.name);
        const r = api.resolveJa(q.name);
        if (!r) continue;
        const kind = m.kind_ja.match(/(?:スペシャル|スーパートレジャー|トレジャー|ベストタッグ|タッグわざ|メガシンカ|Zワザ|テラスタル|ダイマックス|フレンダ).*ピック$/)?.[0] || m.kind_ja;
        const e = { ja: q.name, kind_ja: kind, dex: r.dex };
        if (r.form) e.form = r.form;
        if (r.variant) e.variant = r.variant;
        if (r.partners) e.partners = r.partners;
        const mech = q.mechanic || nameMechanic(r) || mechanicsIn(kind)[0] || null;
        if (mech) e.mechanic = mech;
        e.names = api.namesFor(r.dex, r.pokemon_id, r.variant);
        cp.push(e);
      }
      if (!cp.length) continue;
      campaigns.push({ id: c.id, title: c.title || c.index_title, start_date: c.start_date, end_date: c.end_date || undefined, date_src: c.date_src === "event-id" ? "event-id" : undefined, ended: c.ended || undefined, url: c.url, picks: cp });
    }
    campaigns.sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999") || a.id.localeCompare(b.id));
  }
  // 「終了しました」 배너가 없어도 공식 기간이 지났으면 끝난 캠페인 (일본 날짜 기준)
  const todayJst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  campaigns = campaigns.map((c) => (!c.ended && c.end_date && c.end_date < todayJst ? { ...c, ended: true } : c));

  // 특별 시리즈 ordinal 은 101 부터 (본편 탄이 늘어나도 바뀌지 않게)
  special.forEach((s) => {
    const entry = { id: s.id, ordinal: 101 + ["frienda:wonder", "frienda:legacy", "frienda:special"].indexOf(s.id), kind: s.kind, names: s.names, url: s.url };
    if (s.id === "frienda:special" && campaigns.length) entry.campaigns = campaigns;
    sets.push(entry);
  });

  // 개수
  for (const s of sets) {
    const mine = picks.filter((p) => p.set === s.id);
    const by = (k) => mine.reduce((o, p) => (p[k] ? ((o[p[k]] = (o[p[k]] || 0) + 1), o) : o), {});
    s.counts = { total: mine.length, by_kind: by("kind"), ...(s.kind === "main" ? { by_rarity: by("rarity") } : {}) };
    const mech = by("mechanic");
    if (Object.keys(mech).length) s.counts.by_mechanic = mech;
    if (s.kind !== "main") {
      const from = by("from_set");
      if (Object.keys(from).length) s.counts.by_from_set = from;
    }
  }

  // 메커닉 용어집: 처음 나온 탄 = 공식 「新登場 / 初登場」 문장이 있는 가장 이른 탄, 없으면 이 데이터에서 처음 보인 탄
  const prevMech = new Map((prev?.edition?.mechanics || []).map((m) => [m.id, m]));
  const mechanics = Object.entries(MECHANICS).map(([mid, m]) => {
    const intro = sets.filter((s) => s._page?.introduces?.includes(mid)).sort((a, b) => a.ordinal - b.ordinal)[0];
    const seen = picks.filter((p) => p.mechanic === mid && p.set !== "frienda:special").map((p) => sets.find((s) => s.id === (p.from_set || p.set))).filter(Boolean).sort((a, b) => a.ordinal - b.ordinal)[0];
    const o = { id: mid, ...m, picks: picks.filter((p) => p.mechanic === mid).length };
    // 탄 페이지가 실패해 이번에 못 읽은 경우를 위해 이전 파일 값과 비교해 더 이른 쪽을 쓴다
    const pv = prevMech.get(mid);
    const cands = [intro && { introduced: intro.id, intro_src: "official-text" }, pv?.introduced && { introduced: pv.introduced, intro_src: pv.intro_src }, seen && { introduced: seen.id, intro_src: "first-seen-in-data" }]
      .filter((x) => x && ordOf(x.introduced))
      .sort((a, b) => (a.intro_src === "official-text" ? 0 : 1) - (b.intro_src === "official-text" ? 0 : 1) || ordOf(a.introduced) - ordOf(b.introduced));
    if (cands[0]) Object.assign(o, cands[0]);
    return o;
  });
  for (const s of sets) delete s._page;
  return { sets: sets.map((s) => ordered(s, SET_ORDER)), picks, mechanics, campaigns };
}

function carry(prev, setId, special, add, why) {
  const s = prev.sets?.find((x) => x.id === setId);
  if (!s) return false;
  special.push({ id: s.id, kind: s.kind, names: s.names, url: s.url });
  for (const p of prev.picks.filter((q) => q.set === setId)) add(p);
  anomaly(setId, `${why}; kept previous picks`);
  return true;
}

const PICK_ORDER = ["id", "set", "no", "kind", "rarity", "grade", "grade_src", "dex", "form", "variant", "partners", "mechanic", "tera", "types", "names", "art", "base", "reprint_of", "from_set", "release_date", "orientation", "kira", "new", "img", "thumb", "url", "event"];
const SET_ORDER = ["id", "ordinal", "kind", "series", "series_no", "code", "names", "release_date", "date_src", "end_date", "end_src", "url", "pamphlet", "counts", "campaigns"];
const orderPick = (p) => ordered(p, PICK_ORDER);
function ordered(obj, keys) {
  const o = {};
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) o[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in o) && !k.startsWith("_") && obj[k] !== undefined && obj[k] !== null) o[k] = obj[k];
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
    licence: "© Pokémon / Nintendo / Creatures / GAME FREAK; site content © Marvelous / T-ARTS. Site terms (https://pokemonfrienda.com/policy/) reserve all rights and ask other sites not to hotlink images or videos. Facts and links to official pages only, for personal non-commercial use; images are never copied or rehosted",
    role: "set list (さいしんだん情報), pick numbers, Japanese names, grade group (★5/★4/★2-3), parallel-art/shiny variants, orientation, kira flag, set start/end dates, ワンダーピック / レガシーピック / スペシャルフレンダピック lists, pick mechanics (注目のフレンダピック / ピックアップ text), promo campaign pages",
    images: WITH_IMAGES ? "included (ATLAS_FRIENDA_IMAGES=1)" : "omitted: the site asks other sites not to hotlink; build with ATLAS_FRIENDA_IMAGES=1 to add img/thumb URLs",
    status: "ok",
  };
  try {
    pages = await crawl(prev);
  } catch (e) {
    officialSource.status = isBlocked(HOST) ? "blocked" : "error";
    officialSource.error = String(e.message || e).slice(0, 300);
    console.error(`[frienda] official site unavailable: ${officialSource.error}`);
    if (prev) {
      console.error("[frienda] keeping previous file unchanged");
      await writeReport({ kept_previous: true, blocked_hosts: blockedHosts(), hosts: hostReport(), anomalies, error: officialSource.error });
      return;
    }
    throw e;
  }
  if (pages.errors.length) {
    officialSource.status = "partial";
    officialSource.error = pages.errors.join("; ").slice(0, 500);
  }
  officialSource.fetched_at = pages.fetched_at;
  officialSource.pages = 2 + pages.sets.length + (pages.wonder ? 1 : 0) + (pages.special ? 1 : 0) + 1 + pages.legacy.length + pages.campaigns.length;

  const api = await loadPokeApi();
  const { sets, picks, mechanics, campaigns } = build(pages, api, prev);
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
      special_series: [
        { id: "frienda:wonder", ja: "ワンダーピック", en: "Wonder Picks", note: "★5 event picks, each tied to the set whose event dispensed them (from_set); name, form, mechanic and date come from that set's ピックアップ announcement (the list itself shows only species names); 'art' numbers multiple illustrations of one pick" },
        { id: "frienda:legacy", ja: "レガシーピック", en: "Legacy Picks", note: "gold-foil (ゴールドクリアラメ) ★5 reprints from ベストタッグ1だん on; reprint_of links the earlier pick with the same dex/form/variant" },
        { id: "frienda:special", ja: "スペシャルフレンダピック", en: "Special Frienda Picks", note: "promos (P); campaign pages list スペシャルメガシンカピック / スペシャルタッグわざピック / スペシャルベストタッグわざピック / スペシャルトレジャーピック etc. under sets[frienda:special].campaigns" },
        { id: "parallel", ja: "パラレルアートピック", en: "Parallel art", note: "kind 'parallel', printed number ending in A, from ベストタッグ3だん" },
        { id: "shiny", ja: "いろちがいのポケモン", en: "Shiny", note: "kind 'shiny', printed number ending in ★ (id S)" },
      ],
      mechanics,
      notes: [
        "Mezastar link (1だん): ゴージャススター5弾 ながれぼしタグ and GS1–4 ★6/★5 tags can be scanned as support Pokémon; Mezastar memory tags transfer to トレーナーピック. Tags themselves are not Frienda picks. No Mezastar series is running in Japan.",
        "ポケモンセンターバージョン (Pokémon Center / Pokémon Store cabinets, from ベストタッグ2だん) dispenses the same picks as normal cabinets; only cosmetics and charms differ.",
        "'mechanic' (tera / zmove / mega / dynamax / gmax / tag) is set only where the official 注目のフレンダピック / ピックアップ text or the pick name states it; a missing mechanic does not mean the pick has none. 'tera' gives the tera type when the text names it.",
        "Types come from PokeAPI for the resolved form (not verified against Frienda; tera/special picks may differ). Exact ★2 vs ★3 is not published on the official list (rarity 'normal' = ★2・★3).",
        "Frienda is released only in Japan: names.en / names.ko of the edition, sets and special series are descriptive translations, not official titles; show names.ja first. Pokémon names in en / ko / zh_hant are the official species names (PokeAPI).",
        "Promo campaigns: 'ended' comes from the official 終了 banner or from the official end date (end_date, JST) having passed; a campaign without either may still be running while stocks last.",
        WITH_IMAGES ? "img/thumb are hotlinked official image URLs; the site terms ask other sites not to hotlink." : "Image URLs are omitted because the official site asks other sites not to hotlink images; 'url' links each pick's official list page.",
      ],
    },
    // next_set_expected = 최신 탄 실시 기간 다음 날 (추정). 새 탄 페이지가 공개되면 sets 에 자동으로 들어온다.
    latest: latest ? { set: latest.id, names: latest.names, release_date: latest.release_date, end_date: latest.end_date, next_set_expected: nextGuess } : null,
    sources: [officialSource, { ...POKEAPI_SOURCE, status: "ok", fetched_at: api.fetchedAt || nowIso() }],
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
    by_mechanic: picks.reduce((o, p) => (p.mechanic ? ((o[p.mechanic] = (o[p.mechanic] || 0) + 1), o) : o), {}),
    mechanics: mechanics.map((m) => `${m.id} ${m.ja}: ${m.picks} picks, introduced ${m.introduced || "?"} (${m.intro_src || "-"})`),
    mechanic_picks: picks.filter((p) => p.mechanic).map((p) => `${p.id} ${p.names.ja} → ${p.mechanic}${p.tera ? `/${p.tera}` : ""}`),
    wonder: picks.filter((p) => p.kind === "wonder").map((p) => `${p.id} ${p.names.ja}${p.form ? ` [${p.form}]` : ""}${p.variant ? ` [${p.variant}]` : ""}${p.art ? ` art ${p.art}` : ""} ${p.release_date || "no date"} ${p.grade_src}`),
    wonder_dates: `${picks.filter((p) => p.kind === "wonder" && p.release_date).length}/${picks.filter((p) => p.kind === "wonder").length}`,
    wonder_grade_official: `${picks.filter((p) => p.kind === "wonder" && p.grade_src === "official-text").length}/${picks.filter((p) => p.kind === "wonder").length}`,
    legacy_reprint_linked: `${picks.filter((p) => p.kind === "legacy" && p.reprint_of).length}/${picks.filter((p) => p.kind === "legacy").length}`,
    campaigns: campaigns.map((c) => `${c.start_date || "?"} ${c.id} ${c.picks.map((p) => `${p.kind_ja}「${p.ja}」${p.mechanic ? `(${p.mechanic})` : ""}`).join(" ")}`),
    dex_resolved: picks.filter((p) => p.dex).length,
    names: Object.fromEntries(["ja", "en", "ko", "zh_hant"].map((l) => [l, picks.filter((p) => p.names?.[l]).length])),
    types: picks.filter((p) => p.types?.length).length,
    images: picks.filter((p) => p.img).length,
    thumbs: picks.filter((p) => p.thumb).length,
    forms: picks.filter((p) => p.form).map((p) => `${p.id} ${p.names.ja} → ${p.form}`),
    variants: picks.filter((p) => p.variant).map((p) => `${p.id} ${p.names.ja} → ${p.dex} (${p.variant}) ${p.names.en}`),
    bytes: Buffer.byteLength(text),
    gzip: gzipSync(text).length,
    latest: data.latest,
  };
  await writeReport({ blocked_hosts: blockedHosts(), hosts: hostReport(), anomalies, metrics, user_agent: USER_AGENT });
  console.log(JSON.stringify({ picks: metrics.picks, by_kind: metrics.by_kind, by_mechanic: metrics.by_mechanic, campaigns: campaigns.length, dex: metrics.dex_resolved, names: metrics.names, images: metrics.images, bytes: metrics.bytes, gzip: metrics.gzip, anomalies: anomalies.length, blocked: blockedHosts() }));
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
