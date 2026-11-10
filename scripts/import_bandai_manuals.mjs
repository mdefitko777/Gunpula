import { readFile, writeFile } from "node:fs/promises";

// Official assembly manuals (BANDAI HOBBY 説明書, manual.bandai-hobby.net): the app opens
// a kit's manual in its own viewer page — only the link, the manual stays on Bandai's site.
//
// `--fetch` (npm run manuals:fetch) reads the manual list (20 per page, newest first)
// politely: this bot's user-agent, one page per 1.1 s, a 403 / 429 / 503 stops the run.
// The full list (~2500 manuals, 2013 onwards) is read at most once a week (--force to
// read anyway); data/manuals.json keeps it.
//
// Without --fetch (npm run manuals, an offline derive step of import:data) each record
// whose name matches a manual (same normalized name; the release month breaks ties) gets
// `manual_id`. Records that match none get no button in the app.

const CATALOG_PATH = "data/kits.json";
const STORE_PATH = "data/manuals.json";
const BASE = "https://manual.bandai-hobby.net";
const BOT_UA = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const GAP_MS = 1100;
const REFRESH_DAYS = 7;
const MAX_PAGES = 400;

const decode = (s) =>
  String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** One list page → [{id, name, name_en, date, code, category}] */
export function parseManualList(html) {
  const out = [];
  for (const m of html.matchAll(/<a href="\/menus\/detail\/(\d+)">([\s\S]*?)<\/a>/g)) {
    const block = m[2];
    const nameBlock = /<div class="bl_result_name">([\s\S]*?)<\/div>/.exec(block)?.[1] || "";
    const nameEn = decode(/<span class="bl_result_name_en">([\s\S]*?)<\/span>/.exec(nameBlock)?.[1]);
    const name = decode(nameBlock.replace(/<span class="bl_result_name_en">[\s\S]*?<\/span>/, "").replace(/<[^>]+>/g, " "));
    if (!name) continue;
    const dateText = /<dt>発売日<\/dt>\s*<dd>([^<]*)<\/dd>/.exec(block)?.[1] || "";
    const d = /(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?/.exec(dateText);
    const date = d ? `${d[1]}-${d[2].padStart(2, "0")}${d[3] ? `-${d[3].padStart(2, "0")}` : ""}` : null;
    const code = /bandai-hobby\.net\/images\/(\d+)\.jpg/.exec(block)?.[1] || null;
    const category = /\/images\/categories\/(\d+)\./.exec(block)?.[1] || null;
    out.push({ id: Number(m[1]), name, name_en: nameEn || null, date, code, category });
  }
  return out;
}

/** Name key shared by manuals and catalog records: NFKC, no spaces / brackets / punctuation. */
export function nameKey(name) {
  return String(name || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*(?:再販|限定|受注)[^\]]*\]/g, "")
    .replace(/[\s・･·\-‐–—_:：,，.。'"“”「」『』()（）［］\[\]〈〉<>／/]/g, "");
}

/**
 * Name key without the colour / finish / shop variant: "[クリアカラー]", "ゴールドコーティングVer.",
 * "ガンダムベース限定" … A variant is built from the same runners, so it shares the base kit's manual.
 */
export function baseKey(name) {
  const n = String(name || "")
    .normalize("NFKC")
    .replace(/\[[^\]]*\]|［[^］]*］/g, "")
    .replace(/[(（][^)）]*(?:カラー|クリア|コーティング|メタリック|ver\.?)[^)）]*[)）]/gi, "")
    .replace(/(?:ゴールド|シルバー|メタリック|メッキ|スペシャル)\s*(?:コーティング|フィニッシュ)\s*(?:Ver\.?)?/gi, "")
    .replace(/(?:ガンダムベース|イベント|プレミアムバンダイ|THE GUNDAM BASE)\s*限定/gi, "");
  return nameKey(n);
}

/** kit → manual id: exact name key, else the base kit of a colour variant; the closest release month breaks ties. */
export function matchManuals(kits, manuals) {
  const byKey = new Map();
  const byBase = new Map();
  const add = (map, key, m) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  };
  for (const m of manuals) {
    for (const key of new Set([nameKey(m.name), nameKey(m.name_en)])) add(byKey, key, m);
    // only plain manuals stand in for a variant (not another variant's)
    if (baseKey(m.name) === nameKey(m.name)) add(byBase, baseKey(m.name), m);
  }
  const month = (d) => (d ? Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7) || 1) : null);
  const out = new Map();
  for (const kit of kits) {
    const exact = byKey.get(nameKey(kit.names?.ja)) || byKey.get(nameKey(kit.names?.en));
    const isVariant = baseKey(kit.names?.ja) !== nameKey(kit.names?.ja);
    const candidates = exact || (isVariant ? byBase.get(baseKey(kit.names?.ja)) : null) || [];
    if (!candidates.length) continue;
    const km = month(kit.release_date);
    const best = [...candidates].sort((a, b) => {
      const da = km == null || month(a.date) == null ? 0 : Math.abs(month(a.date) - km);
      const db = km == null || month(b.date) == null ? 0 : Math.abs(month(b.date) - km);
      return da - db || b.id - a.id;
    })[0];
    // A same-named reissue years apart is the same kit (same manual); a far-off date with
    // several candidates is left to the closest.
    out.set(kit.kit_id, best.id);
  }
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchList(store) {
  const manuals = new Map((store.manuals || []).map((m) => [m.id, m]));
  let pages = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    await sleep(GAP_MS);
    const response = await fetch(`${BASE}/?page=${page}`, { headers: { "User-Agent": BOT_UA }, redirect: "manual", signal: AbortSignal.timeout(30000) });
    if ([403, 429, 503].includes(response.status)) {
      console.warn(`manual list answered ${response.status} on page ${page}; keeping what was read.`);
      return { manuals, pages, complete: false };
    }
    // past the last page the site redirects to the top
    if (response.status !== 200) break;
    const items = parseManualList(await response.text());
    if (!items.length) break;
    pages += 1;
    for (const m of items) manuals.set(m.id, m);
  }
  return { manuals, pages, complete: true };
}

async function main() {
  const args = process.argv.slice(2);
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const store = JSON.parse(await readFile(STORE_PATH, "utf8").catch(() => "{}"));
  store.schema = 1;
  store.note = "Official assembly manuals listed on manual.bandai-hobby.net (scripts/import_bandai_manuals.mjs). The app links to /menus/detail/<id>.";

  if (args.includes("--fetch")) {
    const due = !store.read_at || Date.now() - Date.parse(store.read_at) > REFRESH_DAYS * 86400000;
    if (due || args.includes("--force")) {
      const { manuals, pages, complete } = await fetchList(store);
      store.manuals = [...manuals.values()].sort((a, b) => b.id - a.id);
      if (complete) store.read_at = new Date().toISOString().slice(0, 10);
      await writeFile(STORE_PATH, `${JSON.stringify(store, null, 1)}\n`, "utf8");
      console.log(`Manuals: read ${pages} list pages, ${store.manuals.length} manuals.`);
    } else {
      console.log(`Manuals: list read on ${store.read_at}; next read after ${REFRESH_DAYS} days.`);
    }
  }

  const matched = matchManuals(catalog.kits, store.manuals || []);
  let changed = 0;
  for (const kit of catalog.kits) {
    const id = matched.get(kit.kit_id) ?? null;
    if ((kit.manual_id ?? null) === id) continue;
    if (id == null) delete kit.manual_id;
    else kit.manual_id = id;
    changed += 1;
  }
  if (changed) await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`Manuals: ${matched.size} records linked to a manual (${changed} changed).`);
}

// Run as a script (the test imports the helpers only).
if (/(^|[\\/])import_bandai_manuals\.mjs$/.test(process.argv[1] || "")) await main();
