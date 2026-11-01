// Hong Kong Pokémon MEZASTAR (EN printing, shared with SG/MY/ID): static HTML on world.pokemonmezastar.com.
import { politeFetch } from "../lib/http.mjs";
import { absUrl, monthIndex, nfkc, stripTags, ymd } from "../lib/util.mjs";

const BASE = "https://world.pokemonmezastar.com/hk/";
export const HK_SOURCE = {
  name: "Pokémon MEZASTAR Hong Kong official site (English; same tags as SG/MY/ID)",
  url: `${BASE}tag/`,
  licence: "© Pokémon/Nintendo/Creatures/GAME FREAK, T-ARTS/MARV. No stated terms; metadata + hotlinked image URLs only, personal use",
  role: "EN printings: English names, grade group, front images; release dates from the news list",
  region: "EN",
};

function parseTagPage(html, url) {
  const label = stripTags((html.match(/<h3 class="tag-content_heding_title"[^>]*>\s*<b[^>]*>([\s\S]*?)<\/b>/) || [])[1] || "") || null;
  const versions = [];
  for (const m of html.matchAll(/<div class="version">\s*<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const id = (m[1].match(/(\d+)\/?$/) || [])[1] || null;
    versions.push({ pageId: id, label: stripTags(m[2]), url: absUrl(m[1], url) });
  }
  const events = [];
  for (const m of html.matchAll(/<h4 class="tag-sub_title[^"]*"[^>]*>([\s\S]*?)<\/h4>/g)) events.push({ at: m.index, heading: stripTags(m[1]) });
  const rows = [];
  for (const m of html.matchAll(/<li[^>]*class="[^"]*tag-all_list_child[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    const inner = m[1];
    const no = (inner.match(/<p class="tag-no">([\s\S]*?)<\/p>/) || [])[1];
    const name = (inner.match(/<p class="tag-name">([\s\S]*?)<\/p>/) || [])[1];
    const img = (inner.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    const h = events.filter((e) => e.at < m.index).pop();
    rows.push({ heading: h ? h.heading : null, serial_raw: stripTags(no || ""), serial: nfkc(stripTags(no || "")), name: nfkc(stripTags(name || "")), img_front: absUrl(img, url) });
  }
  return { label, versions, rows };
}

function parseNews(html) {
  const items = [];
  for (const m of html.matchAll(/<a[^>]+href="([^"]*news\/article\/(\d+)\/?)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = stripTags(m[3]);
    const d = text.match(/(20\d{2})\.(\d{2})\.(\d{2})/);
    if (!d) continue;
    const title = text.slice(text.indexOf(d[0]) + d[0].length).replace(/^\s*(IMPORTANT\s+)?(NEWS|EVENTS?|IMPORTANT)\s+/, "").trim();
    items.push({ id: m[2], date: ymd(d[1], d[2], d[3]), title, url: absUrl(m[1], BASE + "news/") });
  }
  return items;
}

// "Galaxy Version 3 - Launching October 2nd!" / "Stardust Version 4 - Begins Rolling Out Tuesday, December 30th!"
function launchFromTitle(n) {
  const v = n.title.match(/\b(Stardust|Galaxy|[A-Z][a-z]+)\s+Version\s+(\d+)\b/);
  const when = n.title.match(/(?:Launching|Rolling Out|Arrives?|Starting|Begins)\b[^A-Za-z0-9]*(?:on\s+)?(?:[A-Z][a-z]+day,?\s+)?([A-Z][a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/);
  const legacy = /Legacy Meza Tags/i.test(n.title);
  if (!when || (!v && !legacy)) return null;
  const mo = monthIndex(when[1]);
  if (!mo) return null;
  const [py, pm] = n.date.split("-").map(Number);
  const year = mo < pm - 6 ? py + 1 : py;
  return { kind: legacy ? "legacy" : "launch", series: v ? v[1].toLowerCase() : null, version: v ? Number(v[2]) : null, date: ymd(year, mo, when[2]), posted: n.date, url: n.url, title: n.title };
}

export async function fetchHK() {
  const first = await politeFetch(`${BASE}tag/`);
  let stale = first.stale;
  const cur = parseTagPage(first.text, `${BASE}tag/`);
  const pages = [{ pageId: null, label: cur.label, url: `${BASE}tag/`, rows: cur.rows }];
  const seenIds = new Set();
  for (const v of cur.versions) {
    if (!v.pageId || seenIds.has(v.pageId)) continue;
    seenIds.add(v.pageId);
    const r = await politeFetch(v.url);
    stale ||= r.stale;
    const p = parseTagPage(r.text, v.url);
    pages.push({ pageId: v.pageId, label: p.label || v.label, switcher_label: v.label, url: v.url, rows: p.rows });
  }
  const rows = [];
  for (const p of pages) p.rows.forEach((r, i) => rows.push({ region: "EN", page: p.pageId || "current", pos: i, ...r }));
  // News list (for release dates); stop at the first page without articles.
  const news = [];
  let newsOk = true;
  for (let page = 1; page <= 8; page++) {
    try {
      const r = await politeFetch(page === 1 ? `${BASE}news/` : `${BASE}news/?page_id=${page}`);
      const items = parseNews(r.text);
      if (!items.length) break;
      news.push(...items);
      if (!new RegExp(`page_id=${page + 1}\\b`).test(r.text)) break;
    } catch (e) {
      newsOk = false;
      break;
    }
  }
  const events = news.map(launchFromTitle).filter(Boolean);
  return { pages: pages.map(({ rows: _r, ...p }) => p), rows, news, events, newsOk, stale };
}
