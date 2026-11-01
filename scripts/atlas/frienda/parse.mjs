// pokemonfrienda.com 의 정적 HTML 파서 (의존성 없음, 정규식).
//
// 페이지 종류
//   /new/<code>.html   さいしんだん情報: #friendapick 의 <h3> 묶음 (スーパートレジャー / トレジャー /
//                      ★2・★3 / パラレルアートピック / いろちがいのポケモン) 아래 <li class="grid__item …">
//   /new/wonder/       ワンダーピック (#specialfriendapick, 이미지 이름이 3-2-W01 처럼 탄 코드를 품음)
//   /new/special/      スペシャルフレンダピック (#specialfriendapick, 이미지 이름 p001 … p130)
//   /event/            이벤트 목록 → 레거시픽 이벤트 페이지 (/event/eXXXXl/), 프로모 캠페인 페이지
// 마크업은 탄마다 줄바꿈이 달라서 모두 공백에 관대하게 읽는다.

export const SITE = "https://pokemonfrienda.com/";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decode(s = "") {
  return String(s)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** 상대 경로 → 절대 URL (★ 같은 비 ASCII 는 퍼센트 인코딩). */
export const abs = (href, base) => new URL(href, base).href;

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
};

function section(html, id) {
  const re = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</section>`, "i");
  return html.match(re)?.[1] || null;
}

function gridItems(fragment, baseUrl) {
  const out = [];
  const re = /<li\s+class="grid__item([^"]*)"\s*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(fragment))) {
    const cls = m[1].trim().split(/\s+/).filter(Boolean);
    const body = m[2];
    const a = body.match(/<a\b[^>]*>/i)?.[0] || "";
    const img = body.match(/<img\b[^>]*>/i)?.[0] || "";
    const ps = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => decode(x[1]));
    const full = attr(a, "data-img");
    const thumb = attr(img, "src");
    out.push({
      no: ps[0] || "",
      name: ps[1] || decode(attr(img, "alt") || ""),
      alt: decode(attr(img, "alt") || ""),
      img: full ? abs(full, baseUrl) : null,
      thumb: thumb ? abs(thumb, baseUrl) : null,
      file: (full || thumb || "").split("/").pop(),
      orientation: cls.includes("is-vertical") ? "vertical" : cls.includes("is-horizontal") ? "horizontal" : null,
      is_new: cls.includes("is-new"),
      cls: cls.filter((c) => /^is-(st|sp)$/.test(c)),
    });
  }
  return out;
}

/** 탄 페이지의 「ほかの「だん」を見る」 목록: [{ href, label }] (최신 → 오래된 순서) */
export function parsePageSelect(html, baseUrl) {
  const block = html.match(/<ul class="toggleList toggleList--pageSelect">([\s\S]*?)<\/ul>/i)?.[1] || "";
  return [...block.matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: abs(m[1], baseUrl), label: decode(m[2]) }));
}

/** 홈의 글로벌 내비 「さいしんだん情報」 링크 */
export function parseLatestLink(html, baseUrl) {
  const m = html.match(/globalNav__item--new"[^>]*>\s*<a\s+href="([^"]+)"/i);
  return m ? abs(m[1], baseUrl) : null;
}

// ---------------------------------------------------------------- 날짜

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const WEEKDAY_JA = "日月火水木金土";
export const weekdayJa = (iso) => WEEKDAY_JA[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/** 「M月D日（木）」 의 연도를 기준일에 가장 가까운 해로 정한다. */
export function nearYear(month, day, refIso) {
  const ref = Date.parse(`${refIso}T00:00:00Z`);
  const y0 = Number(refIso.slice(0, 4));
  let best = null;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    const iso = ymd(y, month, day);
    const d = Math.abs(Date.parse(`${iso}T00:00:00Z`) - ref);
    if (!best || d < best.d) best = { iso, d };
  }
  return best.iso;
}

function fullDates(text) {
  return [...text.matchAll(/(20\d\d)年\s*(\d{1,2})月\s*(\d{1,2})日/g)].map((m) => ymd(m[1], m[2], m[3]));
}

// ---------------------------------------------------------------- 탄 페이지

const GROUPS = [
  [/スーパートレジャー/, "super_treasure"],
  [/^トレジャー/, "treasure"],
  [/★\s*2|★\s*3/, "normal"],
  [/パラレルアート/, "parallel"],
  [/いろちがい/, "shiny"],
];

/**
 * さいしんだん情報 페이지 하나.
 * 반환: { label, picks[], asset_dates{}, start_from_assets, end_date, launch_text[], pickups[] }
 */
export function parseSetPage(html, pageUrl) {
  const label = decode(html.match(/<title>\s*【([^】]+)】/)?.[1] || "");
  const out = { label, picks: [], asset_dates: {}, start_from_assets: null, end_date: null, launch_text: [], pickups: [], recommend: [], introduces: [], pamphlet: null };

  const sec = section(html, "friendapick");
  if (sec) {
    const parts = sec.split(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    for (let i = 1; i < parts.length; i += 2) {
      const heading = decode(parts[i]);
      const group = GROUPS.find(([re]) => re.test(heading))?.[1] || "other";
      for (const it of gridItems(parts[i + 1], pageUrl)) out.picks.push({ ...it, group, heading });
    }
  }

  // 탄 시작일: 탄 시작과 함께 바뀌는 그림(トレーナーピック/フレンダサークル/ウィークリースタンプ/ミッション)의 YYMMDD
  const counts = new Map();
  for (const m of html.matchAll(/img_(trainer|friendacircle|weeklystamp|mission)(\d{2})(\d{2})(\d{2})/g)) {
    const iso = ymd(2000 + Number(m[2]), Number(m[3]), Number(m[4]));
    out.asset_dates[m[1]] = iso;
  }
  for (const iso of Object.values(out.asset_dates)) counts.set(iso, (counts.get(iso) || 0) + 1);
  out.start_from_assets = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;

  // 탄 종료일: トレーナーピックとくてん 의 「実施期間 YYYY年M月D日（水）まで」
  const tp = section(html, "trainerpick") || "";
  const ends = [...tp.matchAll(/実施期間[\s\S]{0,200}?(20\d\d)年(\d{1,2})月(\d{1,2})日[^<]{0,6}まで/g)].map((m) => ymd(m[1], m[2], m[3]));
  out.end_date = ends.sort().pop() || null;

  // 본문에 「M月D日（木）から稼動する「ラベル」」 이 있으면 날짜 확인용으로 남긴다.
  const flat = decode(html);
  for (const m of flat.matchAll(/(\d{1,2})月(\d{1,2})日（.）から稼[動働]する「([^」]+)」/g)) out.launch_text.push({ month: Number(m[1]), day: Number(m[2]), label: m[3] });

  // ピックアップ: 레거시픽 · 원더픽 공지 (이름과 날짜)
  const pk = section(html, "pickup") || "";
  for (const item of pk.split(/<div class="contents__item"/i).slice(1)) {
    const title = decode(item.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    const text = [...item.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => decode(x[1])).join(" ");
    const imgSrc = item.match(/srcset="([^",\s]+)/i)?.[1] || item.match(/<img\b[^>]*src="([^"]+)"/i)?.[1] || null;
    const href = item.match(/<a\b[^>]*href="([^"#][^"]*)"/i)?.[1] || null;
    const date = text.match(/(\d{1,2})月(\d{1,2})日（.）(?:から|より)/) || title.match(/(\d{1,2})月(\d{1,2})日（.）(?:から|より)/);
    out.pickups.push({
      title,
      text,
      img: imgSrc ? abs(imgSrc, pageUrl) : null,
      href: href && !/^javascript:/i.test(href) ? abs(href, pageUrl) : null,
      month: date ? Number(date[1]) : null,
      day: date ? Number(date[2]) : null,
      names: [...new Set([...`${title} ${text}`.matchAll(/「([^」]+)」/g)].map((x) => x[1]))],
    });
  }
  // 注目のフレンダピック: 픽 메커닉(テラスタル · Zワザ · メガシンカ · ダイマックス …) 설명
  const rec = section(html, "recommend") || "";
  for (const item of rec.split(/<div class="contents__item"/i).slice(1)) {
    const title = decode(item.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
    const text = [...item.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => decode(x[1])).join(" ");
    out.recommend.push({ title, text });
  }
  // 「…ピック」新登場 / 初登場 문장 (메커닉이 처음 나온 탄). ピックアップ 에는 지난 탄 공지가 남아 있기도
  // 해서 빌더는 가장 이른 탄을 쓴다.
  for (const sent of decode(`${rec} ${pk}`).split(/(?<=[！!。])/)) {
    if (!/新登場|初登場/.test(sent)) continue;
    for (const k of mechanicsIn(sent)) if (!out.introduces.includes(k)) out.introduces.push(k);
  }
  const pdf = html.match(/href="([^"]+PMFR_BOOK[^"]*\.pdf)"/i)?.[1];
  if (pdf) out.pamphlet = abs(pdf, pageUrl);
  return out;
}

/** ワンダーピック / スペシャルフレンダピック 목록 */
export function parseSpecialList(html, pageUrl) {
  const sec = section(html, "specialfriendapick");
  return sec ? gridItems(sec, pageUrl) : [];
}

/** /event/ 목록: [{ href, title }] */
export function parseEventIndex(html, baseUrl) {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>") > 0 ? html.indexOf("</main>") : undefined);
  const out = [];
  for (const m of main.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = decode(m[2].replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, "$1 "));
    if (/^e[0-9a-z]+\/?$/i.test(m[1]) || /\/event\/e[0-9a-z]+\/?$/i.test(m[1])) out.push({ href: abs(m[1], baseUrl), title: t });
  }
  return out;
}

/** 레거시픽 이벤트 페이지: { title, set_label, start_date, picks[{ name, img }] } */
export function parseLegacyEvent(html, pageUrl) {
  const title = decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  // 시리즈 이름은 바뀌므로(1~5だん → ベストタッグ → エクストレジャー → …) 「…Nだん」 토큰을 통째로 잡는다.
  const set_label = title.match(/([^\s「」『』、。！]*?\d+だん)/)?.[1] || null;
  const flat = decode(html);
  const start = flat.match(/開催期間\s*(20\d\d)年(\d{1,2})月(\d{1,2})日/);
  const picks = [];
  for (const m of html.matchAll(/<picture>\s*<source[^>]*srcset="([^",\s]+)[^"]*"[^>]*>\s*<img\b[^>]*alt="([^"]*レガシーピック[^"]*)"[^>]*>/gi)) {
    const name = decode(m[2]).match(/「([^」]+)」\s*$/)?.[1];
    if (name) picks.push({ name, img: abs(m[1], pageUrl) });
  }
  return { title, set_label, start_date: start ? ymd(start[1], start[2], start[3]) : null, picks, dates: fullDates(flat) };
}

// ---------------------------------------------------------------- 프로모 캠페인

export const ENDED_RE = /このイベント・キャンペーンは終了/;

/**
 * 프로모 캠페인 이벤트 페이지 (/event/eXXXX/): { title, start_date, ended, mentions[{ kind_ja, name }] }
 * mentions 는 「…ピック」 바로 뒤의 「이름」 만 읽는다 (장식 문구 속 포켓몬 이름은 무시).
 */
export function parseCampaign(html, pageUrl) {
  const title = decode(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const i = html.indexOf("<main");
  const j = html.indexOf("</main>");
  const body = i >= 0 ? html.slice(i, j > i ? j : undefined) : html;
  const flat = decode(body.replace(/<img\b[^>]*>/gi, " "));
  const start = flat.match(/(?:実施日|開催期間|配布期間|実施期間|応募期間|配布日)\s*[:：]?\s*(20\d\d)年\s*(\d{1,2})月\s*(\d{1,2})日/) || flat.match(/(20\d\d)年\s*(\d{1,2})月\s*(\d{1,2})日/);
  const mentions = [];
  const seen = new Set();
  const push = (kind_ja, name) => {
    const key = name.normalize("NFKC");
    if (seen.has(key)) return;
    seen.add(key);
    mentions.push({ kind_ja, name });
  };
  for (const src of [title, flat]) {
    for (const m of src.matchAll(/([^\s「」『』、。！!？?]*ピック)[^「」『』。！!]{0,10}?「([^」]+)」((?:\s*(?:か|と|、|・|や)\s*「[^」]+」)*)/g)) {
      push(m[1], m[2]);
      // 「ホウオウ」か「ルギア」 처럼 이어진 이름
      for (const x of m[3].matchAll(/「([^」]+)」/g)) push(m[1], x[1]);
    }
  }
  // 날짜가 본문에 없으면 이벤트 id(eYYMMDD…)의 날짜를 쓰고 date_src 로 표시한다
  let start_date = start ? ymd(start[1], start[2], start[3]) : null;
  let date_src = start ? "official-text" : null;
  const idm = pageUrl.match(/\/event\/e(\d{2})(\d{2})(\d{2})/);
  if (!start_date && idm && Number(idm[2]) >= 1 && Number(idm[2]) <= 12 && Number(idm[3]) >= 1 && Number(idm[3]) <= 31) {
    start_date = ymd(2000 + Number(idm[1]), Number(idm[2]), Number(idm[3]));
    date_src = "event-id";
  }
  return { title, start_date, date_src, ended: ENDED_RE.test(flat), mentions };
}

// ---------------------------------------------------------------- 픽 메커닉

/** 공식 문구의 픽 메커닉. 키가 데이터의 mechanic 값이다. */
export const MECHANICS = {
  tera: { ja: "テラスタルピック", en: "Terastal pick", ko: "테라스탈 픽" },
  zmove: { ja: "Zワザピック", en: "Z-Move pick", ko: "Z기술 픽" },
  mega: { ja: "メガシンカピック", en: "Mega Evolution pick", ko: "메가진화 픽" },
  dynamax: { ja: "ダイマックスピック", en: "Dynamax pick", ko: "다이맥스 픽" },
  gmax: { ja: "キョダイマックスできるピック", en: "Gigantamax pick", ko: "거다이맥스 픽" },
  tag: { ja: "タッグわざピック", en: "Tag Move pick (two Pokémon on one pick)", ko: "태그 기술 픽" },
};
const MECH_RE = [[/キョダイマックス/g, "gmax"], [/ダイマックス/g, "dynamax"], [/メガシンカ/g, "mega"], [/Z\s*ワザ/g, "zmove"], [/テラスタル/g, "tera"], [/タッグわざ/g, "tag"]];

/** 문자열 속 메커닉 키워드 (キョダイマックス 를 먼저 지워 ダイマックス 와 겹치지 않게) */
export function mechanicsIn(raw) {
  let t = String(raw).normalize("NFKC");
  const out = [];
  for (const [re, k] of MECH_RE) {
    if (t.match(re)) {
      out.push(k);
      t = t.replace(re, "");
    }
  }
  return out;
}

export const TERA_TYPES = { ノーマル: "normal", ほのお: "fire", みず: "water", くさ: "grass", でんき: "electric", こおり: "ice", かくとう: "fighting", どく: "poison", じめん: "ground", ひこう: "flying", エスパー: "psychic", むし: "bug", いわ: "rock", ゴースト: "ghost", ドラゴン: "dragon", あく: "dark", はがね: "steel", フェアリー: "fairy", ステラ: "stellar" };
const QUAL_RE = /[（(]([^（()）]*?)(テラスタル|キョダイマックス|ダイマックス)[)）]/;

/** 「サーナイト（フェアリーテラスタル）」 → { name: "サーナイト", mechanic: "tera", tera: "fairy" } */
export function splitQualifier(name) {
  const q = String(name).normalize("NFKC").match(QUAL_RE);
  if (!q) return { name: String(name).normalize("NFKC") };
  const mechanic = q[2] === "テラスタル" ? "tera" : q[2] === "キョダイマックス" ? "gmax" : "dynamax";
  return { name: String(name).normalize("NFKC").replace(q[0], "").trim(), mechanic, tera: mechanic === "tera" ? TERA_TYPES[q[1]] || null : null };
}

/**
 * 공지 문구(제목 + 본문)에서 「이름」 별 메커닉을 읽는다. 반환: [{ name, mechanic?, tera? }] (등장 순서)
 *   1. 이름 안 수식어: 「カビゴン（ステラテラスタル）」, 괄호 없는 モジャンボ（ダイマックス）
 *   2. 이름 바로 앞 키워드: キョダイマックスできる「ゲンガー」、メガシンカピック「シャンデラ」
 *   3. 문장 단위: 키워드가 한 종류뿐인 문장의 이름들. 이름이 없는 문장(「この3枚はどれもテラスタル…」)은
 *      바로 앞 문장의 이름에, 앞 문장이 없으면(제목) 다음 이름 문장에 적용한다.
 */
export function mechanicMentions(raw) {
  const text = String(raw).normalize("NFKC");
  const out = new Map();
  const put = (rawName, mech, strong) => {
    const q = splitQualifier(rawName);
    let m = out.get(q.name);
    if (!m) out.set(q.name, (m = { name: q.name }));
    if (q.mechanic) {
      m.mechanic = q.mechanic;
      m.strong = true;
    } else if (mech && (!m.mechanic || (strong && !m.strong))) {
      m.mechanic = mech;
      if (strong) m.strong = true;
    }
    if (q.tera) m.tera = q.tera;
  };
  // 1b. 「」 밖의 이름 + 수식어
  for (const m of text.replace(/「[^」]*」/g, " ").matchAll(/([ァ-ヶー]{2,})[（(]([^（()）]*?)(テラスタル|キョダイマックス|ダイマックス)[)）]/g)) put(`${m[1]}（${m[2]}${m[3]}）`);
  let lastNames = [];
  let pending = null;
  for (const sent of text.split(/(?<=[！!。])/)) {
    const names = [];
    const re = /「([^」]+)」/g;
    let m;
    let from = 0;
    while ((m = re.exec(sent))) {
      const before = sent.slice(Math.max(from, m.index - 24), m.index);
      from = m.index + m[0].length;
      const direct = mechanicsIn(before).at(-1) || null;
      put(m[1], direct, Boolean(direct));
      names.push(splitQualifier(m[1]).name);
    }
    const kws = mechanicsIn(sent.replace(/「[^」]*」/g, ""));
    if (names.length) {
      const k = kws.length === 1 ? kws[0] : !kws.length && pending ? pending : null;
      if (k) for (const n of names) put(n, k);
      lastNames = names;
      pending = null;
    } else if (kws.length === 1) {
      if (lastNames.length) for (const n of lastNames) put(n, kws[0]);
      else pending = kws[0];
    }
  }
  return [...out.values()].map(({ strong, ...m }) => m);
}
