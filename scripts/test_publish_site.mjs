import assert from "node:assert/strict";
import { gitBlobSha, loadConfig, planShards, rewriteAssetUrls } from "./publish_site.mjs";

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
console.log("publish_site tests passed.");
