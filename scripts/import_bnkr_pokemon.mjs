// Korean releases of Bandai's Pokémon products from 반다이남코코리아몰 (www.bnkrmall.co.kr), the
// Bandai Namco Korea official mall: 포켓프라, 프라코로, 나노블럭, 포켓몬 스케일 월드, 깜짝에그 …
//
//   node scripts/import_bnkr_pokemon.mjs        (npm run import:bnkr-pokemon)
//
// Rules in lib/kr-pokemon-shops.mjs: a listing of a product the catalog has joins that record
// (won price, JAN, source); the rest become bnkr-<gno> records. One run reads the mall search for
// "포켓몬" (7 pages of 40 on 2026-11-14) and the product page of every listing not read before (the
// JAN is its 모델명; about 260 pages the first time, about 5 minutes). robots.txt allows the paths
// read (it disallows /nmanager/, /cscenter/, /member/); the terms page sits under /cscenter/, and
// the owner decided on 2026-11-14 to treat the mall as allowed. A refused product page stops the
// product pages for the run; the listings are still written.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import {
  applyListings,
  BNKR_BASE,
  BNKR_SEARCH,
  BNKR_SOURCE_ID,
  bnkrKind,
  buildIndex,
  listingKey,
  matchBnkr,
  ownRecord,
  parseBnkrDetail,
  parseBnkrList,
} from "./lib/kr-pokemon-shops.mjs";
import { createPoliteFetcher } from "./lib/polite-fetch.mjs";
import { mergeCatalog } from "./lib/pokemon-store-kr.mjs";

const CATALOG_PATH = "data/kits.json";
// Product pages read before, by gno: { jan, maker, image, read_at }.
const DETAILS_PATH = "data/kr-shops/bnkr-details.json";
const MAX_PAGES = 15;
const MAX_DETAILS = Number(process.env.BNKR_MAX_DETAILS || 300);
// "포켓몬" also finds other series' products that mention it in passing.
const POKEMON = /포켓몬|포켓프라|피카츄|나노블럭/;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

const productUrl = (gno) => `${BNKR_BASE}/goods/detail.do?gno=${gno}`;

async function main() {
  const fetcher = createPoliteFetcher();
  const first = parseBnkrList(await fetcher.text(`${BNKR_SEARCH}&pageNum=1`));
  if (!first.products.length) throw new Error("The search page lists no products (markup change or not the mall).");
  const products = new Map(first.products.map((product) => [product.gno, product]));
  for (let page = 2; page <= Math.min(first.pages, MAX_PAGES); page += 1) {
    for (const product of parseBnkrList(await fetcher.text(`${BNKR_SEARCH}&pageNum=${page}`)).products) products.set(product.gno, product);
  }
  const listings = [...products.values()].filter((product) => POKEMON.test(`${product.name} ${product.series || ""}`) && bnkrKind(product));

  const store = await readJson(DETAILS_PATH, { details: {} });
  const details = store.details || {};
  let read = 0;
  for (const product of listings.filter((item) => !details[item.gno]).slice(0, MAX_DETAILS)) {
    try {
      const detail = parseBnkrDetail(await fetcher.text(productUrl(product.gno)));
      details[product.gno] = { ...detail, read_at: today() };
      read += 1;
    } catch (error) {
      // The mall asked us to stop: no further page this run. A listing without its page is
      // matched by name and gets its JAN on a later run.
      console.warn(`${BNKR_SOURCE_ID}: product pages stopped (${error.message}).`);
      break;
    }
  }
  // What was read stays read.
  await mkdir(path.dirname(DETAILS_PATH), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(details).sort(([a], [b]) => Number(a) - Number(b)));
  await writeFile(DETAILS_PATH, `${JSON.stringify({ note: "반다이남코코리아몰 product pages read by scripts/import_bnkr_pokemon.mjs (모델명 = JAN), by gno.", details: sorted }, null, 1)}\n`);

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const aliasDoc = await readJson(KIT_ALIASES_PATH, { aliases: {}, excluded: {} });
  const index = buildIndex(catalog.kits);
  const existing = new Set(catalog.kits.map((kit) => kit.kit_id));

  // "QUICK!! 17 꼬부기" and "… [KR]" are one product: one entry per key.
  const groups = new Map();
  for (const product of listings) {
    const jan = details[product.gno]?.jan || null;
    const key = listingKey(product, jan);
    (groups.get(key) || groups.set(key, []).get(key)).push({ product, jan });
  }
  const entries = [];
  for (const members of groups.values()) {
    members.sort((a, b) => Number(a.product.gno) - Number(b.product.gno));
    const ownId = members.map(({ product }) => `bnkr-${product.gno}`).find((id) => existing.has(id)) || `bnkr-${members[0].product.gno}`;
    const { product, jan } = members.find(({ product: item }) => `bnkr-${item.gno}` === ownId) || members[0];
    const url = productUrl(product.gno);
    const name = product.name.replace(/\s*\[단품\]\s*/g, " ").trim();
    const image = details[product.gno]?.image || product.image;
    const match = members.map((member) => matchBnkr(index, member.product, member.jan)).find(Boolean)?.kit || null;
    entries.push({
      ownId,
      match,
      join: { sourceId: BNKR_SOURCE_ID, url, price: product.price, jan, name },
      record: ownRecord({
        kitId: ownId,
        sourceId: BNKR_SOURCE_ID,
        kind: bnkrKind(product),
        name,
        image,
        // The mall shows no release date; the month its picture was uploaded is when it was listed.
        releaseDate: product.listed?.slice(0, 7) || null,
        price: product.price,
        jan,
        url,
        tags: ["bandai namco korea"],
        notes: "Imported from 반다이남코코리아몰 (bnkrmall.co.kr), Bandai Namco Korea's official mall; release_date is the listing month.",
      }),
    });
  }

  const { kits, aliases, joined, own } = applyListings(catalog.kits, entries, { retired: retiredKitIds(aliasDoc) });
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: mergeCatalog(kits, []) }, null, 2)}\n`, "utf8");
  if (Object.keys(aliases).length) {
    aliasDoc.aliases = { ...aliasDoc.aliases, ...aliases };
    await writeFile(KIT_ALIASES_PATH, `${JSON.stringify(aliasDoc, null, 2)}\n`, "utf8");
  }
  const byGrade = entries.filter((entry) => !entry.match).reduce((acc, entry) => ({ ...acc, [entry.record.grade_code]: (acc[entry.record.grade_code] || 0) + 1 }), {});
  console.log(
    `${BNKR_SOURCE_ID}: ${products.size} search results, ${listings.length} Pokémon listings (${groups.size} products), ${read} product pages read; ` +
      `${joined} joined catalog records, ${own} records of its own ${JSON.stringify(byGrade)}, ${Object.keys(aliases).length} moved to a catalog record.`,
  );
}

if (/(^|[\\/])import_bnkr_pokemon\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`${BNKR_SOURCE_ID}: ${error.message}`);
    process.exit(1);
  });
}
