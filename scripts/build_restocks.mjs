// Hobby Atlas: data/atlas/restocks.json — restock / resale (再販 · 재판매) events per kit, so the
// app can tell a user that a kit they like or own is being sold again.
//
// Offline: reads what the importers and clean_catalog.mjs already wrote (rules in
// scripts/lib/restocks.mjs):
//   data/sale-pages.json     folded Premium Bandai / Tamashii sale pages (再販, N次発送, 抽選, 発送分)
//   data/announcements.json  PB new items marked 再販, Tamashii 再販 topics, GUNDAM.INFO / BANDAI SPIRITS 再販 news
//   data/kits.json + data/kit-aliases.json   the live catalog the events point at
//   --before=path            (or RESTOCK_BEFORE_PATH) kits.json before today's import: BANDAI
//                            SPIRITS kits whose release month moved a year later, and 포켓몬스토어
//                            products back on sale, count as a retail restock
// The previous output keeps each event's first-seen day, so scripts/atlas/build_notify_feed.mjs
// can file new events under the day they appeared (reason "restock").
//
//   node scripts/build_restocks.mjs [--before=kits-before.json] [--today=YYYY-MM-DD] [--output=…]
//   node scripts/build_restocks.mjs --scan-git[=300]   also backfill data/sale-pages.json from the
//                                                      git history of data/kits.json (folded pages
//                                                      that were once published) and data/pbandai.json
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { KIT_ALIASES_PATH, resolveAlias } from "./lib/catalog-cleanup.mjs";
import {
  buildRestockDoc,
  eventFromSalePage,
  eventsFromAnnouncements,
  eventsFromCatalogShift,
  pbShipEstimator,
  productIndex,
  sameRestockContent,
} from "./lib/restocks.mjs";
import { readSalePages, salePageFromKit, seoulToday, upsertSalePage, writeSalePages } from "./lib/sale-pages.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUTPUT = "data/atlas/restocks.json";

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
  } catch {
    return fallback;
  }
}

function git(args, maxBuffer = 16 * 1024 * 1024) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer, stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * Backfill: every folded PB / Tamashii page that some earlier data/kits.json still held
 * (oldest commit first, so the newest copy of a page wins), plus PB listing titles in
 * data/pbandai.json. Returns the number of pages added or updated.
 */
function scanGitHistory(salePages, aliases, firstSeen, limit) {
  const wanted = new Set(Object.keys(aliases).filter((id) => /^(?:pbandai-wb|tamashii)-\d+$/.test(id)));
  const commits = git(["log", "--first-parent", `-n${limit}`, "--format=%H %cI", "--", "data/kits.json"])
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(" "))
    .reverse();
  let changed = 0;
  for (const [sha, at] of commits) {
    let doc;
    try {
      doc = JSON.parse(git(["show", `${sha}:data/kits.json`], 1024 * 1024 * 1024));
    } catch (error) {
      console.warn(`  ${sha.slice(0, 8)}: ${String(error.message).split("\n")[0]}`);
      continue;
    }
    for (const kit of doc.kits || []) {
      if (!wanted.has(kit.kit_id)) continue;
      const page = salePageFromKit(kit, { to: resolveAlias(aliases, kit.kit_id), firstSeen: firstSeen[kit.kit_id] || at.slice(0, 10) });
      if (upsertSalePage(salePages, kit.kit_id, page)) changed += 1;
    }
  }
  return changed;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = Object.fromEntries(args.filter((a) => a.startsWith("--") && a.includes("=")).map((a) => a.slice(2).split(/=(.*)/s).slice(0, 2)));
  const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")).map((a) => a.slice(2)));
  const today = opt.today || seoulToday();
  const output = opt.output || OUTPUT;
  const beforePath = opt.before || process.env.RESTOCK_BEFORE_PATH || "";

  const catalog = await readJson("data/kits.json", { kits: [] });
  const aliases = (await readJson(KIT_ALIASES_PATH, {}))?.aliases || {};
  const announcements = (await readJson("data/announcements.json", {}))?.announcements || [];
  const firstSeen = (await readJson("data/kit-first-seen.json", {}))?.dates || {};
  const previous = await readJson(output, null);
  const salePages = await readSalePages(resolve(ROOT, "data/sale-pages.json"));

  if (flags.has("scan-git") || opt["scan-git"]) {
    const limit = Number(opt["scan-git"] || 300);
    let changed = scanGitHistory(salePages, aliases, firstSeen, limit);
    // PB listing titles (data/pbandai.json) of folded items
    for (const item of (await readJson("data/pbandai.json", {}))?.items || []) {
      if (!aliases[item.kit_id] || !item.title) continue;
      const kit = {
        kit_id: item.kit_id,
        names: { ja: item.title },
        price_jpy: Number(String(item.price || "").replace(/[^\d]/g, "")) || null,
        source_urls: [item.url],
        source_refs: [{ source_id: "premium_bandai_jp", url: item.url }],
      };
      if (upsertSalePage(salePages, item.kit_id, salePageFromKit(kit, { to: resolveAlias(aliases, item.kit_id), firstSeen: firstSeen[item.kit_id] || today }))) changed += 1;
    }
    await writeSalePages(salePages, { changed: changed > 0, path: resolve(ROOT, "data/sale-pages.json"), today });
    console.log(`Backfilled data/sale-pages.json: ${changed} pages added or updated, ${Object.keys(salePages.pages).length} in total.`);
  }

  const kits = catalog.kits || [];
  const kitsById = new Map(kits.map((kit) => [kit.kit_id, kit]));
  const events = [];
  const tally = { sale_page: 0, pb_news: 0, tamashii_news: 0, official_news: 0, catalog: 0 };
  const estimate = pbShipEstimator(salePages.pages);
  for (const [pageId, page] of Object.entries(salePages.pages)) {
    const target = aliases[pageId] ? resolveAlias(aliases, pageId) : page.to;
    const keeper = target && target !== pageId ? kitsById.get(target) : null;
    const event = eventFromSalePage(pageId, page, keeper, estimate);
    if (event) events.push(event);
  }
  events.push(...eventsFromAnnouncements(announcements, { kitsById, aliases, index: productIndex(kits), salePages: salePages.pages }));
  if (beforePath) {
    try {
      const before = JSON.parse(await readFile(resolve(beforePath), "utf8"));
      events.push(...eventsFromCatalogShift(before.kits, kits, today));
    } catch (error) {
      console.warn(`--before=${beforePath}: ${error.message}`);
    }
  }
  for (const event of events) tally[event.source] = (tally[event.source] || 0) + 1;

  const doc = buildRestockDoc({ events, previous: previous?.schema === 1 ? previous : null, today, kitsById });
  const changed = !sameRestockContent(previous, doc);
  if (!changed) {
    doc.updated_at = previous.updated_at;
    doc.generated_at = previous.generated_at;
  }
  // One event per line: readable diffs, still compact.
  const { events: list, by_kit: byKit, ...head } = doc;
  const headText = JSON.stringify(head).slice(0, -1);
  const text = `${headText},"events":[\n${list.map((event) => JSON.stringify(event)).join(",\n")}\n],"by_kit":${JSON.stringify(byKit)}}\n`;
  if (changed) {
    await mkdir(dirname(resolve(ROOT, output)), { recursive: true });
    await writeFile(resolve(ROOT, output), text, "utf8");
  }
  const loud = doc.events.filter((event) => !event.quiet && event.seen === today).length;
  console.log(
    `${changed ? "Wrote" : "Unchanged"} ${output}: ${doc.events.length} events for ${Object.keys(byKit).length} kits ` +
      `${JSON.stringify(doc.counts)}; candidates ${JSON.stringify(tally)}; ${loud} new today worth a notification.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
