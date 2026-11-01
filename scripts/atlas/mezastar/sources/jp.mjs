// Japan ポケモンメザスタ (JA printing, 2020-2024, frozen): Takara Tomy A.R.T.S. archive pages.
import { politeFetch } from "../lib/http.mjs";
import { absUrl, nfkc, stripTags } from "../lib/util.mjs";

const BASE = "https://www.takaratomy-arts.co.jp/specials/pokemonmezastar/new/";
export const JP_SOURCE = {
  name: "ポケモンメザスタ official archive (Takara Tomy A.R.T.S.)",
  url: BASE,
  licence: "© Pokémon/Nintendo/Creatures/GAME FREAK, T-ARTS/MARV. No stated terms; metadata + hotlinked image URLs only, personal use",
  role: "JA printings: Japanese names, grade group, kira flag, full and thumbnail images, promo (スペシャルタグ) list",
  region: "JA",
};

// page code -> [series, version, ordinal]
export const JP_PAGES = [
  ...[1, 2, 3, 4].map((v, i) => [String(v), "base", v, i + 1]),
  ...[1, 2, 3, 4, 5].map((v, i) => [`st${v}`, "supertag", v, 5 + i]),
  ...[1, 2, 3, 4, 5].map((v, i) => [`dc${v}`, "doublechain", v, 10 + i]),
  ...[1, 2, 3, 4, 5].map((v, i) => [`gs${v}`, "gorgeousstar", v, 15 + i]),
];

function parsePage(html, url) {
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const setName = nfkc((title.match(/【(.*?)】/) || [])[1] || "") || null;
  const heads = [...html.matchAll(/<h4 class="tag_ttl[^"]*"[^>]*>([\s\S]*?)<\/h4>/g)].map((m) => ({ at: m.index, heading: nfkc(stripTags(m[1])) }));
  const rows = [];
  const re = /<li(?:\s+class="([^"]*)")?>\s*<a href="([^"]+)"[^>]*>\s*<img src="([^"]+)" alt="([^"]*)">\s*<\/a>\s*<p>\s*<span>([^<]*)<\/span>\s*<br>([^<]*)<\/p>/g;
  for (const m of html.matchAll(re)) {
    const h = heads.filter((e) => e.at < m.index).pop();
    rows.push({
      heading: h ? h.heading : null,
      serial: nfkc(m[5]),
      name: nfkc(stripTags(m[6])),
      kira: /kirakira/.test(m[1] || ""),
      img_front: absUrl(m[2], url),
      img_thumb: absUrl(m[3], url),
    });
  }
  return { setName, rows };
}

export async function fetchJP() {
  const pages = [], rows = [];
  let stale = false;
  for (const [code, series, version, ordinal] of JP_PAGES) {
    const url = `${BASE}${code}.html`;
    const r = await politeFetch(url, { maxAgeMs: 30 * 86400e3 });
    stale ||= r.stale;
    const p = parsePage(r.text, url);
    pages.push({ code, series, version, ordinal, url, set_name: p.setName, count: p.rows.length });
    p.rows.forEach((row, i) => rows.push({ region: "JA", page: code, pos: i, ...row }));
  }
  const surl = `${BASE}special/`;
  const r = await politeFetch(surl, { maxAgeMs: 30 * 86400e3 });
  stale ||= r.stale;
  const sp = parsePage(r.text, surl);
  pages.push({ code: "special", series: "promo", version: null, ordinal: 100, url: surl, set_name: "スペシャルタグ", count: sp.rows.length });
  sp.rows.forEach((row, i) => rows.push({ region: "JA", page: "special", pos: i, ...row }));
  return { pages, rows, stale };
}
