// Tile thumbnails (scripts/lib/thumbs.mjs, build_thumbs.mjs, publish_site.mjs): where they are
// written, which remote covers are copied first, and the data/thumbs.json the app reads
// (contract: gunpula-thumbs-v1 — exact image URL -> thumbnail URL on an image shard, plus rules).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { downloadPath, fetchHost, pendingUrls, planRepoThumbs, thumbDigest, webTwins } from "./build_thumbs.mjs";
import { createHostStops } from "./lib/official-announcements.mjs";
import {
  addFeedThumbs,
  crossHostTwins,
  buildThumbMap,
  coverOf,
  feedKitIds,
  httpsImageUrl,
  makeThumbs,
  pythonWithPillow,
  repoThumbRel,
  ruleThumb,
  smallImageOf,
  thumbCandidates,
  THUMB_RULES,
  upgradeCleartextImages,
  wantsWebThumb,
  webThumbFile,
} from "./lib/thumbs.mjs";
import { repoThumbsMade, rewriteAssetUrls, stampManifest, thumbUrls, writeFeedThumbs } from "./publish_site.mjs";

const AKAMAI = "https://bandai-a.akamaihd.net/bc/img/model/b/1000256190_1.jpg";

// --- Paths and rules.
assert.equal(repoThumbRel("catalog/pokemon/a-01-b6e76f25b4.jpg"), "thumbs/repo/catalog/pokemon/a-01-b6e76f25b4.jpg.webp", "x.jpg and x.png never share a thumbnail");
assert.match(webThumbFile(AKAMAI), /^bandai-a\.akamaihd\.net\/[0-9a-f]{16}\.webp$/);
assert.equal(webThumbFile(AKAMAI), webThumbFile(AKAMAI), "stable: the same URL is never copied twice");
{
  // A thumbnail made again gets a new name, so phones that cached the old picture load the new one.
  const a = webThumbFile(AKAMAI, Buffer.from("yoshi"));
  const b = webThumbFile(AKAMAI, Buffer.from("ux-22"));
  assert.match(a, /^bandai-a\.akamaihd\.net\/[0-9a-f]{16}-[0-9a-f]{8}\.webp$/);
  assert.notEqual(a, b);
  assert.ok(a.startsWith(webThumbFile(AKAMAI).slice(0, -".webp".length)), "the URL part stays");
  assert.equal(thumbDigest(a), a.slice(-13, -5));
  assert.equal(thumbDigest(webThumbFile(AKAMAI)), null, "older names carry no digest");
}

// --- Covers of two hosts with one thumbnail (2026-11-14: UX-22 showed stds.jp's LEGO Yoshi).
{
  const twins = crossHostTwins([
    { url: "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/UX22_list.png", digest: "aa" },
    { url: "https://stds.jp/wp-content/uploads/2026/11/lego-yoshi.webp", digest: "aa" },
    { url: "https://bandai-a.akamaihd.net/bc/img/model/b/1.jpg", digest: "bb" },
    { url: "https://bandai-a.akamaihd.net/bc/img/model/b/2.jpg", digest: "bb" },
    { url: "https://bandai-a.akamaihd.net/bc/img/model/b/3.jpg", digest: null },
  ]);
  assert.deepEqual([...twins].sort(), ["https://beyblade.takaratomy.co.jp/beyblade-x/lineup/_image/UX22_list.png", "https://stds.jp/wp-content/uploads/2026/11/lego-yoshi.webp"]);
}

// --- Hosts download at the same time: each cover keeps its own bytes. Until 2026-11-14 the
//     temporary file was named after downloads.length, so two hosts wrote the same file.
{
  const tmp = await mkdtemp(path.join(os.tmpdir(), "gunpula-thumbs-race-"));
  try {
    const urls = { "a.example": "https://a.example/img/ux22.png", "b.example": "https://b.example/img/yoshi.webp" };
    const fetchImpl = async (url) => {
      if (url.endsWith("/robots.txt")) return new Response("", { status: 404 });
      // b answers first, a a moment later: both writes are pending at the same time.
      await new Promise((resolve) => setTimeout(resolve, url.includes("a.example") ? 5 : 0));
      return new Response(Buffer.from(`picture of ${url}`), { status: 200, headers: { "content-type": "image/png" } });
    };
    const downloads = [];
    const shared = { deadline: Date.now() + 60000, stops: createHostStops(), tmp, index: { failed: {} }, downloads, fetchImpl, gapMs: 0 };
    await Promise.all(Object.entries(urls).map(([host, url]) => fetchHost(host, [url], shared)));
    assert.equal(downloads.length, 2);
    assert.notEqual(downloads[0].src, downloads[1].src, "one temporary file per cover");
    for (const item of downloads) {
      assert.equal(item.src, downloadPath(tmp, item.url));
      assert.equal(await readFile(item.src, "utf8"), `picture of ${item.url}`, "the file holds this cover's bytes");
      assert.equal(item.sha, createHash("sha1").update(`picture of ${item.url}`).digest("hex"));
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// --- --plan / --purge-twins: only thumbnails from before the fix are suspects. Since then two
//     hosts with one photo are a real twin (left out, they would be downloaded every day).
{
  const root = await mkdtemp(path.join(os.tmpdir(), "gunpula-thumbs-twins-"));
  try {
    const thumbs = {
      "https://beyblade.takaratomy.co.jp/ux22.png": "beyblade.takaratomy.co.jp/fb1f0e2b87937723.webp",
      "https://stds.jp/yoshi.webp": "stds.jp/efb5fd4b6294225c.webp",
      "https://bandai-a.akamaihd.net/bc/img/model/b/1.jpg": "bandai-a.akamaihd.net/aaaaaaaaaaaaaaaa-0123abcd.webp",
      "https://gashapon.jp/images/1.jpg": "gashapon.jp/bbbbbbbbbbbbbbbb-0123abcd.webp",
    };
    for (const [url, file] of Object.entries(thumbs)) {
      await mkdir(path.dirname(path.join(root, "web", file)), { recursive: true });
      await writeFile(path.join(root, "web", file), url.includes("akamaihd") || url.includes("gashapon") ? "same photo" : "yoshi");
    }
    assert.deepEqual(await webTwins({ thumbs }, root), ["https://beyblade.takaratomy.co.jp/ux22.png", "https://stds.jp/yoshi.webp"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
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

// --- "thumb" on the inbox feeds' items (site copies of notify-feed.json and update-feed-lite.json).
{
  const SHARD = "https://mdefitko777.github.io/gunpula-img-3/";
  const RAW = "https://raw.githubusercontent.com/mdefitko777/Gunpula/main/app/assets/";
  const map = {
    rules: THUMB_RULES,
    thumbs: {
      [AKAMAI]: `${SHARD}thumbs/web/bandai-a.akamaihd.net/0123456789abcdef.webp`,
      [`${SHARD}catalog/a.jpg`]: `${SHARD}thumbs/repo/catalog/a.jpg.webp`,
      "https://h.example/broken.jpg": `${RAW}thumbs/web/h.example/1.webp`,
    },
  };
  assert.equal(smallImageOf(AKAMAI, map), map.thumbs[AKAMAI]);
  assert.equal(smallImageOf("https://cdn.rebrickable.com/media/sets/75466-1.jpg", map), "https://cdn.rebrickable.com/media/thumbs/sets/75466-1.jpg/250x250p.jpg");
  assert.equal(smallImageOf("https://h.example/no-thumb.jpg", map), null, "never the full-size picture");
  assert.equal(smallImageOf("https://h.example/broken.jpg", map), null, "never raw.githubusercontent.com");
  assert.equal(smallImageOf("", map), null);

  const kits = [
    { kit_id: "pb", images: { box_art_url: AKAMAI } },
    { kit_id: "local", images: { box_art_url: `${SHARD}catalog/a.jpg` } },
    { kit_id: "lego-75466-1", images: { box_art_url: "https://cdn.rebrickable.com/media/sets/75466-1.jpg" } },
    { kit_id: "unsynced", images: { box_art_url: `${RAW}catalog/b.jpg` } },
    { kit_id: "plain", images: { box_art_url: "https://h.example/no-thumb.jpg" } },
    { kit_id: "gundam", images: { box_art_url: "https://h.example/no-thumb.jpg" } },
    { kit_id: "new-id", images: { box_art_url: AKAMAI } },
  ];
  const kitsById = new Map(kits.map((kit) => [kit.kit_id, kit]));
  const doc = {
    entries: [
      {
        added: [{ kit_id: "pb" }, { kit_id: "lego-75466-1" }, { kit_id: "gone" }, { kit_id: "plain", thumb: "stale" }],
        changed: [{ kit_id: "local" }, { kit_id: "unsynced" }, { kit_id: "gundam" }, { kit_id: "old-id" }],
        removed: [{ kit_id: "pb" }],
      },
    ],
  };
  const counts = addFeedThumbs(doc, { kitsById, boxart: { gundam: { url: AKAMAI } }, aliases: { "old-id": "new-id" }, map });
  assert.deepEqual(counts, { items: 8, withThumb: 5 });
  const thumbOf = (list, id) => doc.entries[0][list].find((item) => item.kit_id === id).thumb;
  assert.equal(thumbOf("added", "pb"), map.thumbs[AKAMAI]);
  assert.equal(thumbOf("added", "lego-75466-1"), "https://cdn.rebrickable.com/media/thumbs/sets/75466-1.jpg/250x250p.jpg", "Rebrickable's own small size");
  assert.equal(thumbOf("changed", "local"), `${SHARD}thumbs/repo/catalog/a.jpg.webp`);
  assert.equal(thumbOf("changed", "gundam"), map.thumbs[AKAMAI], "the box art the app picks over box_art_url");
  assert.equal(thumbOf("changed", "old-id"), map.thumbs[AKAMAI], "a merged kit follows its alias");
  for (const [list, id] of [["added", "gone"], ["added", "plain"], ["changed", "unsynced"]]) {
    assert.ok(!("thumb" in doc.entries[0][list].find((item) => item.kit_id === id)), `${id}: no thumbnail, no field`);
  }
  assert.equal(doc.entries[0].removed[0].thumb, undefined, "only the lists the app reads");
  const text = JSON.stringify(doc);
  assert.ok(!text.includes("raw.githubusercontent.com") && !text.includes(`"thumb":"${AKAMAI}"`));
  for (const item of [...doc.entries[0].added, ...doc.entries[0].changed]) {
    if (item.thumb) assert.match(item.thumb, /\/thumbs\/(?:repo|web)\/.+\.webp$|\/250x250p\.jpg$/, "a small picture only");
  }

  // As the publish job runs it: the site's rewritten kits, both feeds, layout kept.
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "gunpula-feed-thumbs-"));
  try {
    const put = async (rel, value) => {
      await mkdir(path.dirname(path.join(dataDir, rel)), { recursive: true });
      await writeFile(path.join(dataDir, rel), value);
    };
    await put("split/kits-gundam.json", JSON.stringify({ kits: kits.slice(0, 2) }));
    await put("split/kits-lego.json", JSON.stringify({ kits: [kits[2]] }));
    await put("split/kit-aliases.json", JSON.stringify({ aliases: {} }));
    const feed = { entries: [{ added: [{ kit_id: "pb" }, { kit_id: "none" }], changed: [{ kit_id: "lego-75466-1" }] }] };
    await put("atlas/notify-feed.json", `${JSON.stringify(feed)}\n`);
    await put("update-feed-lite.json", `${JSON.stringify(feed, null, 2)}\n`);
    const results = await writeFeedThumbs(dataDir, map);
    assert.deepEqual(results.map(({ file, items, withThumb }) => [file, items, withThumb]), [["atlas/notify-feed.json", 3, 2], ["update-feed-lite.json", 3, 2]]);
    const notify = await readFile(path.join(dataDir, "atlas/notify-feed.json"), "utf8");
    const lite = await readFile(path.join(dataDir, "update-feed-lite.json"), "utf8");
    assert.ok(!notify.includes("\n "), "notify-feed.json stays on one line");
    assert.ok(lite.startsWith("{\n  "), "update-feed-lite.json stays indented");
    assert.equal(JSON.parse(notify).entries[0].added[0].thumb, map.thumbs[AKAMAI]);
    assert.equal(JSON.parse(lite).entries[0].changed[0].thumb, "https://cdn.rebrickable.com/media/thumbs/sets/75466-1.jpg/250x250p.jpg");
    assert.equal(results[0].after - results[0].before, Buffer.byteLength(notify) - Buffer.byteLength(`${JSON.stringify(feed)}\n`));
    // buildSite stamps the manifest after this step: its files hashes are of the copies with "thumb", so the
    // app fetches both feeds again when a thumbnail moves shard or a cover changes.
    await put("split/manifest.json", "{}\n");
    const manifest = await stampManifest(dataDir, []);
    for (const [rel, text] of [["atlas/notify-feed.json", notify], ["update-feed-lite.json", lite]]) {
      assert.equal(manifest.files[rel], createHash("sha256").update(text).digest("hex").slice(0, 16), `${rel} hashed as served`);
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
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
