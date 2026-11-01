// pokemonfrienda.com 의 정적 HTML 파서 (의존성 없음, 정규식).
//
// 페이지 종류
//   /new/<code>.html   さいしんだん情報: #friendapick 의 <h3> 묶음 (スーパートレジャー / トレジャー /
//                      ★2・★3 / パラレルアートピック / いろちがいのポケモン) 아래 <li class="grid__item …">
//   /new/wonder/       ワンダーピック (#specialfriendapick, 이미지 이름이 3-2-W01 처럼 탄 코드를 품음)
//   /new/special/      スペシャルフレンダピック (#specialfriendapick, 이미지 이름 p001 … p130)
//   /event/            이벤트 목록 → 레거시픽 이벤트 페이지 (/event/eXXXXl/)
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
  const out = { label, picks: [], asset_dates: {}, start_from_assets: null, end_date: null, launch_text: [], pickups: [], pamphlet: null };

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
    const date = text.match(/(\d{1,2})月(\d{1,2})日（.）(?:から|より)/) || title.match(/(\d{1,2})月(\d{1,2})日（.）(?:から|より)/);
    out.pickups.push({
      title,
      text,
      img: imgSrc ? abs(imgSrc, pageUrl) : null,
      month: date ? Number(date[1]) : null,
      day: date ? Number(date[2]) : null,
      names: [...new Set([...`${title} ${text}`.matchAll(/「([^」]+)」/g)].map((x) => x[1]))],
    });
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
  const set_label = title.match(/((?:ベストタッグ|エクストレジャー)?\d+だん)/)?.[1] || null;
  const flat = decode(html);
  const start = flat.match(/開催期間\s*(20\d\d)年(\d{1,2})月(\d{1,2})日/);
  const picks = [];
  for (const m of html.matchAll(/<picture>\s*<source[^>]*srcset="([^",\s]+)[^"]*"[^>]*>\s*<img\b[^>]*alt="([^"]*レガシーピック[^"]*)"[^>]*>/gi)) {
    const name = decode(m[2]).match(/「([^」]+)」\s*$/)?.[1];
    if (name) picks.push({ name, img: abs(m[1], pageUrl) });
  }
  return { title, set_label, start_date: start ? ymd(start[1], start[2], start[3]) : null, picks, dates: fullDates(flat) };
}
