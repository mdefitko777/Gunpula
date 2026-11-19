// import_goodsmile_fate.mjs on stub pages: the two Good Smile sites fail apart. goodsmile.com under
// maintenance (2026-11-19) keeps its records and leaves a note while the legacy goodsmile.info
// listing is still written; a legacy page not read keeps its record; both failing fails the step.
//   node scripts/test_goodsmile_fate.mjs
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { main, parseCards } from "./import_goodsmile_fate.mjs";

const LIST = `
<a href="https://www.goodsmile.info/en/product/8394/Scathach.html?utm_campaign=fgo">
  <div class="matomeproduct figure"><img src="//images.goodsmile.info/cgm/images/product/20190101/8394/a.jpg" alt="Scathach">
  <span class="infosection"><span class="hitTypeName figure">Figure</span><span class="itemName">Lancer/Scathach</span><span class="itemCmp">Good Smile Company</span></span></div>
</a>
<a href="https://www.goodsmile.info/en/product/9001/Mash.html?utm_campaign=fgo">
  <div class="matomeproduct nendoroid"><img src="//images.goodsmile.info/cgm/images/product/20200101/9001/a.jpg" alt="Mash">
  <span class="infosection"><span class="hitTypeName nendoroid">Nendoroid</span><span class="itemName">Nendoroid Shielder/Mash Kyrielight</span></span></div>
</a>`;
const DETAIL = `<h1>Lancer/Scathach</h1><dl><dt>Price</dt><dd>16,000 yen</dd><dt>Release Date</dt><dd>2019/05</dd></dl>
<img src="https://images.goodsmile.info/cgm/images/product/20190101/8394/b.jpg">`;
const MAINTENANCE = "www.goodsmile.com/robots.txt 503 (under maintenance: disallow all)";

assert.equal(parseCards(LIST).length, 2);

async function setup(kits) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fate-"));
  const paths = { catalogPath: path.join(dir, "kits.json"), aliasesPath: path.join(dir, "aliases.json"), notesPath: path.join(dir, "notes.txt") };
  await writeFile(paths.catalogPath, JSON.stringify({ updated_at: "2026-11-18", kits }));
  await writeFile(paths.notesPath, "");
  return paths;
}

const globalKit = { kit_id: "goodsmile-fate-g1144549", franchise: "fate", names: { en: "POP UP PARADE Saber" }, price_jpy: 5000 };
const oldMash = { kit_id: "goodsmile-fate-9001", franchise: "fate", names: { en: "Nendoroid Shielder/Mash Kyrielight" }, price_jpy: 4800, gallery_image_urls: ["x", "y"] };

// goodsmile.com under maintenance: legacy written, the global record kept, one note, no failure.
{
  const paths = await setup([globalKit, oldMash]);
  const requested = [];
  const fetchText = async (url) => {
    requested.push(url);
    if (url.startsWith("https://www.goodsmile.com/")) throw new Error(MAINTENANCE);
    if (url.includes("/9001/")) throw new Error("www.goodsmile.info stopped this run (HTTP 503 for …)");
    return url.includes("/product/") ? DETAIL : LIST;
  };
  await main({ ...paths, fetchText, log: () => {} });
  const { kits } = JSON.parse(await readFile(paths.catalogPath, "utf8"));
  const byId = Object.fromEntries(kits.map((kit) => [kit.kit_id, kit]));
  assert.equal(byId["goodsmile-fate-8394"].price_jpy, 16000, "the legacy page read is written");
  assert.equal(byId["goodsmile-fate-8394"].release_date, "2019-05");
  assert.deepEqual(byId["goodsmile-fate-9001"], oldMash, "a legacy page not read keeps its record");
  assert.deepEqual(byId["goodsmile-fate-g1144549"], globalKit, "the global record is kept");
  assert.equal(await readFile(paths.notesPath, "utf8"), `import:fate good_smile_fate_global: ${MAINTENANCE}\n`);
  assert.equal(requested.filter((url) => url.startsWith("https://www.goodsmile.com/")).length, 1, "the global store is not asked again");
}

// Both sites down: the step fails and the catalog stays as it was.
{
  const paths = await setup([globalKit]);
  const before = await readFile(paths.catalogPath, "utf8");
  await assert.rejects(main({ ...paths, fetchText: async () => { throw new Error("HTTP 503"); }, log: () => {} }), /Both Good Smile sites failed/);
  assert.equal(await readFile(paths.catalogPath, "utf8"), before);
  assert.equal(await readFile(paths.notesPath, "utf8"), "");
}

console.log("test_goodsmile_fate: ok");
