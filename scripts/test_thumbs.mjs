// Tile thumbnails (scripts/lib/thumbs.mjs, build_thumbs.mjs, publish_site.mjs): where they are
// written, which remote covers are copied first, and the data/thumbs.json the app reads
// (contract: gunpula-thumbs-v1 — exact image URL -> thumbnail URL on an image shard, plus rules).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pendingUrls, planRepoThumbs } from "./build_thumbs.mjs";
import {
  buildThumbMap,
  coverOf,
  feedKitIds,
  httpsImageUrl,
  makeThumbs,
  pythonWithPillow,
  repoThumbRel,
  ruleThumb,
  thumbCandidates,
  upgradeCleartextImages,
  wantsWebThumb,
  webThumbFile,
} from "./lib/thumbs.mjs";
import { repoThumbsMade, rewriteAssetUrls, thumbUrls } from "./publish_site.mjs";

const AKAMAI = "https://bandai-a.akamaihd.net/bc/img/model/b/1000256190_1.jpg";

// --- Paths and rules.
assert.equal(repoThumbRel("catalog/pokemon/a-01-b6e76f25b4.jpg"), "thumbs/repo/catalog/pokemon/a-01-b6e76f25b4.jpg.webp", "x.jpg and x.png never share a thumbnail");
assert.match(webThumbFile(AKAMAI), /^bandai-a\.akamaihd\.net\/[0-9a-f]{16}\.webp$/);
assert.equal(webThumbFile(AKAMAI), webThumbFile(AKAMAI), "stable: the same URL is never copied twice");
assert.equal(
  ruleThumb("https://cdn.rebrickable.com/media/sets/31209-1.jpg"),
  "https://cdn.rebrickable.com/media/thumbs/sets/31209-1.jpg/250x250p.jpg",
);
assert.equal(ruleThumb(AKAMAI), null);

// --- Cleartext: Android shows no http:// picture; page links stay as they are.
assert.equal(httpsImageUrl("http://image.toast.com/a/b.jpg"), "https://image.toast.com/a/b.jpg");
assert.equal(httpsImageUrl(AKAMAI), AKAMAI);
{
  const text = JSON.stringify({ img: "http://images.goodsmile.info/cgm/x/large/07fa.jpg", q: "http://a.example/p.png?w=1", page: "http://www.goodsmile.info/en/product/1", ok: AKAMAI });
  const { text: out, upgraded } = upgradeCleartextImages(text);
  assert.equal(upgraded, 2);
  const doc = JSON.parse(out);
  assert.equal(doc.img, "https://images.goodsmile.info/cgm/x/large/07fa.jpg");
  assert.equal(doc.q, "https://a.example/p.png?w=1");
  assert.equal(doc.page, "http://www.goodsmile.info/en/product/1");
}

// --- The cover the app shows (pickCover in hobby-atlas-v3 lib/data/gunpula.dart).
{
  const kit = { kit_id: "k", images: { box_art_url: "https://a.example/box.jpg" }, gallery_image_urls: ["https://a.example/g1.jpg"] };
  assert.equal(coverOf(kit, { k: { url: "https://b.example/art.jpg" } }), "https://b.example/art.jpg", "box art first");
  assert.equal(coverOf(kit, { k: { url: "https://b.example/art.jpg", kind: "maybe" } }), "https://a.example/box.jpg", "never a 'maybe'");
  assert.equal(coverOf({ ...kit, images: { box_art_url: "https://x.bandai-hobby.net/a.jpg" } }, {}), "https://a.example/g1.jpg", "a dead box art");
  assert.equal(coverOf({ kit_id: "e" }, {}), "");
}

// --- Which remote covers get a copy.
assert.equal(wantsWebThumb(AKAMAI), true);
assert.equal(wantsWebThumb("http://image.toast.com/a/b.jpg"), true);
assert.equal(wantsWebThumb("./assets/catalog/a.jpg"), false, "repo photos get theirs in the publish job");
assert.equal(wantsWebThumb("https://mdefitko777.github.io/gunpula-img-1/catalog/a.jpg"), false);
assert.equal(wantsWebThumb("https://raw.githubusercontent.com/mdefitko777/Gunpula/main/app/assets/catalog/a.jpg"), false);
assert.equal(wantsWebThumb("https://cdn.rebrickable.com/media/sets/1-1.jpg"), false, "rebrickable has its own");
assert.equal(wantsWebThumb("https://www.example.com/products/1"), false, "not a picture");
assert.equal(wantsWebThumb("http://a.example/img/123"), false, "published as http://, so a https:// key would never be looked up");

assert.deepEqual([...feedKitIds([{ added: [{ kit_id: "a" }], changed: [{ kit_id: "b", x: { kit_id: "c" } }] }])].sort(), ["a", "b", "c"]);
{
  const today = new Date("2026-11-14T00:00:00Z");
  const kit = (id, url, extra = {}) => ({ kit_id: id, images: { box_art_url: url }, ...extra });
  const kits = [
    kit("old", "https://h1.example/old.jpg", { release_date: "2019-01-01" }),
    kit("feed", "https://h1.example/feed.jpg", { release_date: "2020-01-01" }),
    kit("new", "https://h2.example/new.jpg"),
    kit("soon", "http://h2.example/soon.jpg", { release_date: "2027-01" }),
    kit("restock", "https://h1.example/restock.jpg", { release_date: "2018-05-01" }),
    kit("dup", "https://h1.example/feed.jpg"),
    kit("local", "./assets/catalog/x.jpg"),
    kit("lego", "https://cdn.rebrickable.com/media/sets/2-1.jpg"),
  ];
  const urls = thumbCandidates({
    kits,
    firstSeen: { new: "2026-11-13", old: "2024-01-01", feed: "2024-02-01", restock: "2023-01-01" },
    feedIds: new Set(["feed"]),
    restockIds: new Set(["restock"]),
    announcements: [{ thumbnail_url: "https://gundam-official.com/a.jpg" }, { thumbnail_url: "../app/assets/announcements/b.jpg" }],
    today,
  });
  assert.deepEqual(urls, [
    "https://gundam-official.com/a.jpg",
    "https://h1.example/feed.jpg",
    "https://h2.example/new.jpg",
    "https://h2.example/soon.jpg",
    "https://h1.example/restock.jpg",
    "https://h1.example/old.jpg",
  ]);
  const index = { thumbs: { "https://h1.example/feed.jpg": "h1.example/x.webp" }, failed: { "https://h2.example/new.jpg": { status: 404, at: "2026-11-01" }, "https://h1.example/old.jpg": { status: 404, at: "2026-09-01" } } };
  assert.deepEqual(pendingUrls(urls, index, today), ["https://gundam-official.com/a.jpg", "https://h2.example/soon.jpg", "https://h1.example/restock.jpg", "https://h1.example/old.jpg"], "a 404 is asked again after 30 days");
}

// --- Repo thumbnails: only changed or missing ones are made, gone photos lose theirs.
{
  const photos = new Map([["catalog/a.jpg", "s1"], ["catalog/b.jpg", "s2"], ["bbx/c.png", "s3"]]);
  const plan = planRepoThumbs(photos, { "catalog/a.jpg": "s1", "catalog/b.jpg": "old", "bbx/c.png": "s3", "catalog/gone.jpg": "s9" }, (rel) => rel !== "bbx/c.png");
  assert.deepEqual(plan, { make: ["catalog/b.jpg", "bbx/c.png"], drop: ["catalog/gone.jpg"] });
}

// --- data/thumbs.json as the publish job writes it.
{
  const config = { dirs: ["catalog", "kotobukiya-ac", "bbx", "thumbs"], shards: [{ url: "https://mdefitko777.github.io/gunpula-img-1/" }, { url: "https://mdefitko777.github.io/gunpula-img-3/" }] };
  const assign = new Map([
    ["catalog/pokemon/a b.jpg", 0],
    ["thumbs/repo/catalog/pokemon/a b.jpg.webp", 1],
    ["thumbs/repo/announcements/n.png.webp", 1],
    ["thumbs/web/bandai-a.akamaihd.net/0123456789abcdef.webp", 1],
  ]);
  const raw = (rel) => `https://raw.githubusercontent.com/mdefitko777/Gunpula/main/app/assets/${rel}`;
  // As buildSite: a shard URL when a shard holds the photo, else the raw fallback.
  const urlFor = (rel) => (assign.has(rel) ? `${config.shards[assign.get(rel)].url}${rel.split("/").map(encodeURIComponent).join("/")}` : raw(rel));
  const map = buildThumbMap({
    repoIndex: { "catalog/pokemon/a b.jpg": "s", "announcements/n.png": "s", "bbx/unsynced.png": "s", "catalog/raw.jpg": "s" },
    webIndex: { [AKAMAI]: "bandai-a.akamaihd.net/0123456789abcdef.webp", "https://h.example/not-on-a-shard.jpg": "h.example/1111111111111111.webp" },
    ...thumbUrls(config, assign, urlFor),
  });
  assert.equal(map.schema, "gunpula-thumbs-v1");
  assert.equal(map.generated_at, undefined, "no timestamp: its manifest hash changes only with the map");
  assert.equal(map.max_side, 400);
  assert.equal(map.rules[0].thumb_suffix, "/250x250p.jpg");
  assert.deepEqual(map.thumbs, {
    "https://mdefitko777.github.io/Gunpula/app/assets/announcements/n.png": "https://mdefitko777.github.io/gunpula-img-3/thumbs/repo/announcements/n.png.webp",
    "https://mdefitko777.github.io/gunpula-img-1/catalog/pokemon/a%20b.jpg": "https://mdefitko777.github.io/gunpula-img-3/thumbs/repo/catalog/pokemon/a%20b.jpg.webp",
    [AKAMAI]: "https://mdefitko777.github.io/gunpula-img-3/thumbs/web/bandai-a.akamaihd.net/0123456789abcdef.webp",
  });
  assert.ok(!JSON.stringify(map).includes("raw.githubusercontent.com"), "no thumbnail is served from raw");
  // The key is the very string the rewritten JSON carries.
  const published = rewriteAssetUrls(JSON.stringify({ box_art_url: "./assets/catalog/pokemon/a b.jpg" }), config.dirs, urlFor).text;
  assert.ok(map.thumbs[JSON.parse(published).box_art_url]);
}

// --- A sync without the repo thumbnails made would delete them from the shards.
{
  const shards = [new Map([["catalog/a.jpg", {}]]), new Map([["thumbs/repo/catalog/a.jpg.webp", {}]])];
  assert.equal(repoThumbsMade(shards, false), false);
  assert.equal(repoThumbsMade(shards, true), true);
  assert.equal(repoThumbsMade([new Map([["catalog/a.jpg", {}]])], false), true, "first run: nothing to lose");
}

// --- A real thumbnail, when Pillow is installed (the publish and thumbs workflows install it).
if (pythonWithPillow()) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gunpula-thumb-test-"));
  try {
    const src = path.join(dir, "src.png");
    const small = path.join(dir, "small.jpg");
    const cmyk = path.join(dir, "cmyk.jpg");
    const script = [
      "import sys",
      "from PIL import Image",
      "Image.new('RGBA', (1200, 600), (255, 0, 0, 128)).save(sys.argv[1])",
      "Image.new('RGB', (300, 120), (0, 0, 255)).save(sys.argv[2])",
      "Image.new('CMYK', (900, 450), (0, 255, 255, 0)).save(sys.argv[3])",
    ].join("\n");
    const made = spawnSync(pythonWithPillow(), ["-I", "-c", script, src, small, cmyk], { encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    const out = (name) => path.join(dir, "out", name);
    const [ok, bad, tiny, print] = makeThumbs([
      { src, dst: out("a.webp") },
      { src: path.join(dir, "missing.jpg"), dst: out("b.webp") },
      { src: small, dst: out("c.webp") },
      { src: cmyk, dst: out("d.webp") },
    ]);
    assert.deepEqual([ok.ok, ok.width, ok.height], [true, 400, 200], "longest side 400, aspect kept");
    assert.ok(bad.error, "a broken source is reported, the batch goes on");
    assert.ok(!existsSync(`${out("b.webp")}.tmp`));
    assert.deepEqual([tiny.ok, tiny.width, tiny.height], [true, 300, 120], "never upscaled");
    assert.deepEqual([print.ok, print.width, print.height], [true, 400, 200], "a CMYK print file becomes an RGB thumbnail");
    const look = ["import sys", "from PIL import Image", "for f in sys.argv[1:]:", "    im = Image.open(f)", "    print(im.format, im.mode, im.getpixel((10, 10)))"].join("\n");
    const seen = spawnSync(pythonWithPillow(), ["-I", "-c", look, out("a.webp"), out("d.webp")], { encoding: "utf8" }).stdout.trim().split(/\r?\n/);
    assert.match(seen[0], /^WEBP RGBA \(\d+, \d+, \d+, 1[23]\d\)$/, "transparency kept");
    assert.match(seen[1], /^WEBP RGB \(2[3-5]\d, \d{1,2}, \d{1,2}\)$/, "CMYK magenta+yellow comes out red");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
} else {
  console.log("test_thumbs: Pillow not installed, real thumbnail skipped");
}

console.log("test_thumbs: ok");
