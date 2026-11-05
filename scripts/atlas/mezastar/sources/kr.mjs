// Korea 포켓몬태그스타 (KR printing): PHP pages on pokemontagstar.co.kr.
// stage.php lists sets in <select name="cate"> (ids are not sequential); each stage page lists
// tags under grade headings with the exact ★; stage_pop_view.php?idx=N (POST) gives front/back art.
import { politeFetch } from "../lib/http.mjs";
import { absUrl, firstCjkDate, nfkc, stripTags } from "../lib/util.mjs";

const BASE = "https://pokemontagstar.co.kr/kr/sub/";
export const KR_SOURCE = {
  name: "포켓몬태그스타 Korea official site",
  url: `${BASE}stage.php`,
  licence: "© Pokémon/Nintendo/Creatures/GAME FREAK, T-ARTS Korea/MARV. No stated terms; metadata + hotlinked image URLs only, personal use",
  role: "KR printings: Korean names, exact ★ grade, list thumbnails, front/back images (popup), release dates",
  region: "KR",
};

function parseSelect(html) {
  const sel = html.match(/<select[^>]+name="cate"[^>]*>([\s\S]*?)<\/select>/);
  if (!sel) return [];
  return [...sel[1].matchAll(/<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)].map((m) => ({ cate: Number(m[1]), label: nfkc(stripTags(m[2])) }));
}

function parseStage(html, url) {
  const label = nfkc(stripTags((html.match(/<p class="sub-content-cm-txt"[^>]*>([\s\S]*?)<\/p>/) || [])[1] || "")) || null;
  const editor = (html.match(/<div class="stage-con01"[\s\S]*?<div class="editor">([\s\S]*?)<\/div>/) || [])[1] || "";
  const date = firstCjkDate(editor);
  const listImg = (html.match(/<a href="([^"]+\.(?:jpg|png))"[^>]*download="[^"]*태그리스트/) || [])[1] || null;
  const heads = [...html.matchAll(/<p class="cm-border-txt">([\s\S]*?)<\/p>/g)].map((m) => ({ at: m.index, heading: nfkc(stripTags(m[1])) }));
  const rows = [];
  const re = /<a href="([^"]*stage_pop\.php\?idx=(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const inner = m[3];
    const img = (inner.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const tit = (inner.match(/<h4 class="tag-list-tit">([\s\S]*?)<\/h4>/) || [])[1];
    const txt = (inner.match(/<p class="tag-list-txt">([\s\S]*?)<\/p>/) || [])[1];
    const h = heads.filter((e) => e.at < m.index).pop();
    rows.push({
      idx: Number(m[2]),
      heading: h ? h.heading : null,
      serial_raw: stripTags(tit || ""),
      serial: nfkc(stripTags(tit || "")),
      name: nfkc(stripTags(txt || "")),
      img_thumb: absUrl(img, url),
      url: absUrl(m[1], url),
    });
  }
  return { label, date, listImg: absUrl(listImg, url), rows };
}

function parsePopup(html, url) {
  const front = (html.match(/<img[^>]+src="([^"]+)"[^>]*alt="앞면"/) || html.match(/<img[^>]+alt="앞면"[^>]*src="([^"]+)"/) || [])[1];
  const back = (html.match(/<img[^>]+src="([^"]+)"[^>]*alt="뒷면"/) || html.match(/<img[^>]+alt="뒷면"[^>]*src="([^"]+)"/) || [])[1];
  return { img_front: absUrl(front, url), img_back: absUrl(back, url) };
}

/**
 * known: Map idx -> {img_front, img_back} from the previous output, so popups are fetched only for new tags.
 * popups: "all" | "new" | "none"
 */
// 서포트 포켓몬 티켓 (support Pokémon tickets): htp13.php lists the tickets. Only the live list items
// count: the ones inside an HTML comment are template leftovers showing Taiwan/HK MEZASTAR tickets
// (支援寶可夢券), not Korean releases. One request.
export function parseSupportTickets(html, url) {
  const list = (html.match(/<ul class="ticket-list">([\s\S]*?)<\/ul>/) || [])[1] || "";
  const retiredSpans = [...list.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => [m.index, m.index + m[0].length]);
  const out = [];
  for (const m of list.matchAll(/<li class="list-item">([\s\S]*?)<\/li>/g)) {
    const img = (m[1].match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const name = nfkc(stripTags((m[1].match(/<p class="list-item-txt">([\s\S]*?)<\/p>/) || [])[1] || ""));
    if (!img || !name) continue;
    const abs = absUrl(img, url);
    const file = abs.split("/").pop().replace(/\.[a-z]+$/i, "");
    if (retiredSpans.some(([a, b]) => m.index > a && m.index < b)) continue;
    out.push({ id: `mz-support:KR:${file}`, region: "KR", name, image: abs, status: "current", url });
  }
  return out;
}

export async function fetchKR({ known = new Map(), popups = "new" } = {}) {
  const first = await politeFetch(`${BASE}stage.php`);
  let stale = first.stale;
  const cates = parseSelect(first.text);
  if (!cates.length) throw new Error("KR: <select name=cate> not found");
  const sets = [], rows = [];
  for (const c of cates) {
    const url = `${BASE}stage.php?cate=${c.cate}`;
    const r = await politeFetch(url);
    stale ||= r.stale;
    const p = parseStage(r.text, url);
    sets.push({ cate: c.cate, label: c.label, page_label: p.label, date: p.date, list_img: p.listImg, url });
    p.rows.forEach((row, i) => rows.push({ region: "KR", page: c.cate, pos: i, ...row }));
  }
  let popupFetched = 0, popupReused = 0, popupFailed = 0;
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.idx)) continue;
    seen.add(row.idx);
    const k = known.get(row.idx);
    if (popups !== "all" && k && k.img_front) { Object.assign(row, { img_front: k.img_front, img_back: k.img_back || null }); popupReused++; continue; }
    if (popups === "none") continue;
    const url = `${BASE}stage_pop_view.php?idx=${row.idx}`;
    try {
      const r = await politeFetch(url, { method: "POST", body: "", maxAgeMs: 30 * 86400e3 });
      Object.assign(row, parsePopup(r.text, url));
      popupFetched++;
    } catch (e) {
      popupFailed++;
      if (/blocked/i.test(e.message)) break;
    }
  }
  for (const row of rows) {
    const twin = rows.find((x) => x.idx === row.idx && x.img_front);
    if (!row.img_front && twin) Object.assign(row, { img_front: twin.img_front, img_back: twin.img_back });
  }
  let support = null;
  try {
    const url = `${BASE}htp13.php`;
    support = parseSupportTickets((await politeFetch(url)).text, url);
  } catch {
    support = null; // keep the previous list (build.mjs)
  }
  return { sets, rows, stale, support, popups: { fetched: popupFetched, reused: popupReused, failed: popupFailed } };
}

/** Official current tickets + curated ones (support-kr.json): curated info (move, type, dex) is added to an
 *  official ticket of the same name; a curated ticket the site no longer lists becomes a "past" ticket
 *  with no picture (the app shows the Pokémon's official artwork). */
export function mergeSupport(official, curated) {
  const out = official.map((t) => {
    const c = curated.find((x) => x.name === t.name);
    return c ? { ...t, move: c.move, type: c.type, dex: c.dex } : t;
  });
  for (const c of curated) {
    if (out.some((t) => t.name === c.name)) continue;
    out.push({ id: `mz-support:KR:dex${c.dex}`, region: "KR", name: c.name, move: c.move, type: c.type, dex: c.dex, image: null, status: "past", url: "https://pokemontagstar.co.kr/kr/sub/htp13.php" });
  }
  return out;
}
