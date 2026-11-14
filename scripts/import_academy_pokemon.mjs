// Korean releases of Takara Tomy's Pokémon toys from 아카데미과학 (academy.co.kr), their Korean
// licensee: 몬콜레 (MonColle, also the older EMC / EHP / ESP lines), 포켓피스, 말랑콕콕, 포코피아 …
//
//   node scripts/import_academy_pokemon.mjs        (npm run import:academy-pokemon)
//
// Rules in lib/kr-pokemon-shops.mjs: a MonColle listing of a figure the catalog has joins that
// record (won price, source); the rest become academy-<product_no> records. Only the shop search for
// "포켓몬" is read (431 products in 22 pages of 20 on 2026-11-14): the product page adds nothing
// the list lacks (no JAN, no release date), so it is not requested. The S{YY}{nnn} product code
// gives the release year. robots.txt allows /product/search.html. Not academyhobby.co.kr, a retailer.
import { readFile, writeFile } from "node:fs/promises";
import { KIT_ALIASES_PATH, retiredKitIds } from "./lib/catalog-cleanup.mjs";
import {
  academyKind,
  academyReleaseDate,
  ACADEMY_SEARCH,
  ACADEMY_SOURCE_ID,
  applyListings,
  buildIndex,
  matchAcademy,
  ownRecord,
  parseAcademyList,
} from "./lib/kr-pokemon-shops.mjs";
import { createPoliteFetcher } from "./lib/polite-fetch.mjs";
import { mergeCatalog } from "./lib/pokemon-store-kr.mjs";

const CATALOG_PATH = "data/kits.json";
const MAX_PAGES = 40;
// A run that sees far fewer products than the catalog holds read a broken answer.
const MIN_SHARE_OF_PREVIOUS = 0.5;

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

async function main() {
  const fetcher = createPoliteFetcher();
  const first = parseAcademyList(await fetcher.text(`${ACADEMY_SEARCH}&page=1`));
  if (!first.products.length) throw new Error("The search page lists no products (markup change or not the shop).");
  const products = new Map(first.products.map((product) => [product.productNo, product]));
  for (let page = 2; page <= Math.min(first.pages, MAX_PAGES); page += 1) {
    const { products: found, pages } = parseAcademyList(await fetcher.text(`${ACADEMY_SEARCH}&page=${page}`));
    if (!found.length) break;
    for (const product of found) products.set(product.productNo, product);
    // The pager shows ten pages at a time.
    if (pages > first.pages) first.pages = pages;
  }

  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const previousOwn = catalog.kits.filter((kit) => kit.kit_id.startsWith("academy-")).length;
  if (products.size < previousOwn * MIN_SHARE_OF_PREVIOUS) {
    throw new Error(`Only ${products.size} products read (the catalog has ${previousOwn} records of its own); leaving the catalog untouched.`);
  }
  const aliasDoc = await readJson(KIT_ALIASES_PATH, { aliases: {}, excluded: {} });
  const index = buildIndex(catalog.kits);
  const entries = [...products.values()].map((product) => {
    const ownId = `academy-${product.productNo}`;
    return {
      ownId,
      match: matchAcademy(index, product)?.kit || null,
      join: { sourceId: ACADEMY_SOURCE_ID, url: product.url, price: product.price, jan: null, name: product.name },
      record: {
        ...ownRecord({
          kitId: ownId,
          sourceId: ACADEMY_SOURCE_ID,
          kind: academyKind(product),
          name: product.name,
          image: product.image,
          releaseDate: academyReleaseDate(product),
          price: product.price,
          jan: null,
          url: product.url,
          tags: ["academy", "takara tomy"],
          notes: "Imported from 아카데미과학 (academy.co.kr), the Korean licensee of Takara Tomy's Pokémon toys; the year comes from its S{YY} product code.",
        }),
        // The shop's own code (S26077), as printed on the box.
        number: product.code,
        academy_kr: { code: product.code, sold_out: product.soldOut },
      },
    };
  });

  const { kits, aliases, joined, own } = applyListings(catalog.kits, entries, { retired: retiredKitIds(aliasDoc) });
  await writeFile(CATALOG_PATH, `${JSON.stringify({ ...catalog, updated_at: today(), kits: mergeCatalog(kits, []) }, null, 2)}\n`, "utf8");
  if (Object.keys(aliases).length) {
    aliasDoc.aliases = { ...aliasDoc.aliases, ...aliases };
    await writeFile(KIT_ALIASES_PATH, `${JSON.stringify(aliasDoc, null, 2)}\n`, "utf8");
  }
  const byGrade = entries.filter((entry) => !entry.match).reduce((acc, entry) => ({ ...acc, [entry.record.grade_code]: (acc[entry.record.grade_code] || 0) + 1 }), {});
  console.log(
    `${ACADEMY_SOURCE_ID}: ${products.size} products in ${first.pages} pages; ${joined} joined catalog records, ` +
      `${own} records of its own ${JSON.stringify(byGrade)}, ${Object.keys(aliases).length} moved to a catalog record.`,
  );
}

if (/(^|[\\/])import_academy_pokemon\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(`${ACADEMY_SOURCE_ID}: ${error.message}`);
    process.exit(1);
  });
}
