import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gitBlobSha, isSideDataFile, loadConfig, planShards, rewriteAssetUrls, stampManifest } from "./publish_site.mjs";

// Same id as `git hash-object` (echo hello | git hash-object --stdin).
assert.equal(gitBlobSha(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");

const f = (size, sha = `s${size}`) => ({ size, sha });
{
  // Kept photos stay put, changed ones are re-sent to the same shard, gone ones are removed,
  // new ones fill the first shard with room, and what fits nowhere is reported.
  const local = new Map([
    ["catalog/a.jpg", f(40)],
    ["catalog/b.jpg", f(30, "new")],
    ["catalog/c.jpg", f(50)],
    ["catalog/d.jpg", f(20)],
    ["catalog/e.jpg", f(200)],
  ]);
  const shards = [
    new Map([["catalog/a.jpg", f(40)], ["catalog/gone.jpg", f(10)]]),
    new Map([["catalog/b.jpg", f(30, "old")], ["catalog/a.jpg", f(40)]]),
  ];
  const plan = planShards(local, shards, 100);
  assert.equal(plan.assign.get("catalog/a.jpg"), 0);
  assert.equal(plan.assign.get("catalog/b.jpg"), 1);
  assert.deepEqual(plan.changes[0], { add: ["catalog/c.jpg"], remove: ["catalog/gone.jpg"] });
  assert.deepEqual(plan.changes[1], { add: ["catalog/b.jpg", "catalog/d.jpg"], remove: ["catalog/a.jpg"] }, "a duplicate copy is dropped");
  assert.deepEqual(plan.unplaced, ["catalog/e.jpg"]);
  assert.deepEqual(plan.used, [90, 50]);
}
{
  // Running the plan again on its own result changes nothing.
  const local = new Map([["bbx/x.png", f(10)], ["bbx/y.png", f(10)]]);
  const first = planShards(local, [new Map(), new Map()], 15);
  const after = [new Map(), new Map()];
  for (const [file, index] of first.assign) after[index].set(file, local.get(file));
  const second = planShards(local, after, 15);
  assert.deepEqual(second.changes, [{ add: [], remove: [] }, { add: [], remove: [] }]);
  assert.deepEqual([...second.assign], [...first.assign]);
}
{
  const urls = new Map([["catalog/fate/a b.jpg", "https://x.example/img-1/catalog/fate/a%20b.jpg"]]);
  const text = JSON.stringify({
    images: { box_art_url: "./assets/catalog/fate/a b.jpg", other: "./assets/catalog/fate/none.jpg" },
    atlas: "./assets/atlas/covers/k.jpg",
    remote: "https://www.example.com/assets/catalog/x.jpg",
  });
  const result = rewriteAssetUrls(text, ["catalog", "bbx"], (rel) => urls.get(rel) || null);
  const doc = JSON.parse(result.text);
  assert.equal(doc.images.box_art_url, "https://x.example/img-1/catalog/fate/a%20b.jpg");
  assert.equal(doc.images.other, "./assets/catalog/fate/none.jpg", "no shard has it -> unchanged");
  assert.equal(doc.atlas, "./assets/atlas/covers/k.jpg", "folders that stay on the site are untouched");
  assert.equal(doc.remote, "https://www.example.com/assets/catalog/x.jpg");
  assert.equal(result.rewritten, 1);
  assert.equal(result.missing, 1);
}
{
  const config = await loadConfig();
  assert.ok(config.limit_mb < 1000, "each shard must stay under the 1 GB Pages limit");
  assert.ok(config.site_limit_mb < 1000);
  for (const shard of config.shards) assert.match(shard.url, /^https:\/\/[^/]+\/[^/]+\/$/);
}
{
  assert.ok(isSideDataFile("announcements.json"));
  assert.ok(isSideDataFile("announcement-details.json"));
  assert.ok(isSideDataFile("atlas/mezastar-jp.json"));
  assert.ok(isSideDataFile("split/kit-aliases.json"));
  assert.ok(!isSideDataFile("split/kits-gundam.json"), "kit files are covered by content_hash");
  assert.ok(!isSideDataFile("split/manifest.json"));
  assert.ok(!isSideDataFile("search/search-lego.json"));
  assert.ok(!isSideDataFile("README.md"));
}
{
  // The manifest gets a hash per side file; content_hash still covers only data/split, so a change
  // to announcements.json alone moves files["announcements.json"] and nothing else.
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "gunpula-site-"));
  try {
    const put = async (rel, text) => {
      await mkdir(path.dirname(path.join(dataDir, rel)), { recursive: true });
      await writeFile(path.join(dataDir, rel), text);
    };
    await put("split/manifest.json", JSON.stringify({ updated_at: "2026-11-11", total: 1 }));
    await put("split/kits-gundam.json", "[]");
    await put("split/kit-aliases.json", "{}");
    await put("search/search-gundam.json", "[]");
    await put("announcements.json", '{"items":[]}');
    await put("atlas/restocks.json", "[]");
    const first = await stampManifest(dataDir, ["https://x.example/img-1/"]);
    const contentHash = createHash("sha256");
    for (const [name, text] of [["kit-aliases.json", "{}"], ["kits-gundam.json", "[]"]]) contentHash.update(`${name}\0`).update(text).update("\0");
    assert.equal(first.content_hash, contentHash.digest("hex").slice(0, 16), "content_hash is computed as before");
    assert.deepEqual(first.image_shards, ["https://x.example/img-1/"]);
    assert.deepEqual(Object.keys(first.files), ["announcements.json", "atlas/restocks.json", "split/kit-aliases.json"]);
    assert.equal(first.files["announcements.json"], createHash("sha256").update('{"items":[]}').digest("hex").slice(0, 16));
    assert.deepEqual(JSON.parse(await readFile(path.join(dataDir, "split/manifest.json"), "utf8")), first, "written to the published manifest");

    await put("announcements.json", '{"items":[{"id":"new"}]}');
    const second = await stampManifest(dataDir, ["https://x.example/img-1/"]);
    assert.equal(second.content_hash, first.content_hash);
    assert.notEqual(second.files["announcements.json"], first.files["announcements.json"]);
    assert.equal(second.files["atlas/restocks.json"], first.files["atlas/restocks.json"]);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}
console.log("publish_site tests passed.");
