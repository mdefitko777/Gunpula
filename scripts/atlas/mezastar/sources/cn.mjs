// Mainland China 宝可梦明耀之星 (SC). Used ONLY to fill the exact ★2/3/4 grade of international tags
// (and as a cross-check); no SC printings are emitted. Next.js SSR: <script id="__NEXT_DATA__">.
import { politeFetch } from "../lib/http.mjs";
import { nfkc, pad3 } from "../lib/util.mjs";

const PAGE = "https://www.pokemonmezastar.com.cn/chuckInformation";
const SEED_ID = "1744104805287008"; // 星光第1弹, used when the bare page has no set list
export const CN_SOURCE = {
  name: "宝可梦明耀之星 mainland China official site (__NEXT_DATA__)",
  url: `${PAGE}?id=${SEED_ID}`,
  licence: "© Pokémon/Nintendo/Creatures/GAME FREAK, T-ARTS/MARV. No stated terms; used for exact grades only",
  role: "exact ★ grade for every numbered international tag (cross-check only; known data-entry errors are normalised and logged)",
};

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error("CN: __NEXT_DATA__ missing");
  return JSON.parse(m[1]).props?.pageProps || {};
}

export function normaliseCnCode(raw) {
  const m = nfkc(raw || "").match(/^(\d)\s*-\s*(\d+)\s*-\s*(\d+)/);
  if (!m) return { serial: null, clean: false };
  const serial = `${m[1]}-${m[2]}-${pad3(m[3])}`;
  return { serial, clean: nfkc(raw) === `${serial} SC` };
}

export async function fetchCN() {
  const first = await politeFetch(`${PAGE}?id=${SEED_ID}`);
  let stale = first.stale;
  const pp0 = nextData(first.text);
  const sets = (pp0.bulletTypeList || []).map((b) => ({ id: String(b.id), name: nfkc(b.name), sort: b.sortNum }));
  if (!sets.length) throw new Error("CN: bulletTypeList empty");
  const rows = [];
  for (const s of sets) {
    let pp = pp0;
    if (s.id !== SEED_ID) {
      const r = await politeFetch(`${PAGE}?id=${s.id}`);
      stale ||= r.stale;
      pp = nextData(r.text);
    }
    for (const g of pp.bulletTypeGroupList || []) {
      const grade = Number((nfkc(g.name).match(/★\s*(\d)/) || [])[1]) || null;
      for (const x of g.illustratedGuides || []) {
        if (String(x.bulletTypeId) !== s.id) continue;
        const n = normaliseCnCode(x.codeNumber);
        rows.push({ set: s.name, set_id: s.id, group: nfkc(g.name), grade, code_raw: x.codeNumber, serial: n.serial, code_clean: n.clean, name: nfkc(x.name) });
      }
    }
  }
  return { sets, rows, stale };
}
