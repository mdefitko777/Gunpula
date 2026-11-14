// Builds the GitHub Pages copy of this repo without the big image caches.
//
// GitHub Pages refuses a site over 1 GB, and the cached product photos alone
// (app/assets/catalog, kotobukiya-ac, bbx) passed that on 2026-11-10. So the
// photos are published from separate image repos (data/image-shards.json:
// gunpula-img-1…, each its own Pages site, each kept under limit_mb), and this
// site carries only the data and the web app.
//
//   node scripts/publish_site.mjs --plan              what would move where (reads the shard repos)
//   node scripts/publish_site.mjs --sync              push new / changed / removed photos to the shards
//   node scripts/publish_site.mjs --out _site         build the site folder (after --sync, or alone)
//
// The repo itself is unchanged: scripts keep writing and reading ./assets/<dir>/… paths.
// Only the published copy of every JSON file gets those paths rewritten to the
// shard that holds the file, and data/split/manifest.json gets a content_hash of
// the rewritten files, so an app that cached the old paths downloads the new ones.
// The manifest also carries a hash per other data file (files), so the app can fetch
// just the side files that changed (announcements …) on a day the kits did not.
// The site also gets data/thumbs.json: image URL -> its small thumbnail on a shard
// (scripts/lib/thumbs.mjs; the thumbnails are app/assets/thumbs/, one of the shard dirs), and
// the inbox feeds' items get the "thumb" of their kit's cover (only in the published copy).
//
// Shard assignment is stable: a photo stays in the shard that already has it;
// a new photo goes to the first shard with room. Nothing here needs state in
// this repo — the shard repos' own file lists are the record.
//
// Pushing: git over https://github.com/<repo>.git. In GitHub Actions the
// publish-site workflow maps those URLs to per-shard deploy keys
// (url.<ssh>.insteadOf); on this PC the normal git credentials are used.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { addFeedThumbs, buildThumbMap, FEED_THUMB_FILES, REPO_THUMB_INDEX, SITE_BASE, upgradeCleartextImages, WEB_THUMB_INDEX } from "./lib/thumbs.mjs";

export const CONFIG_PATH = "data/image-shards.json";
const MB = 1024 * 1024;
const PUSH_BATCH_BYTES = 300 * MB;
// Written with every shard commit; when the shard's Pages site serves the same bytes the tree
// has, that site is up to date with every photo in the tree (Pages swaps whole builds).
const LIVE_FILE = "live.json";
const LIVE_TIMEOUT_MS = 20 * 60 * 1000;
const RAW_BASE = "https://raw.githubusercontent.com/mdefitko777/Gunpula/main/app/assets/";

// Same id git gives a file (git hash-object), so local files compare with the shard trees.
export function gitBlobSha(buffer) {
  return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

// local: Map(shardPath -> {size, sha}); shards: [Map(shardPath -> {size, sha})]
// Returns per-shard {add: [path], remove: [path]}, the final path -> shard index map, and
// photos that fit nowhere.
export function planShards(local, shards, limitBytes) {
  const assign = new Map();
  const used = shards.map(() => 0);
  const changes = shards.map(() => ({ add: [], remove: [] }));
  shards.forEach((files, index) => {
    for (const [file, remote] of files) {
      const mine = local.get(file);
      if (!mine || assign.has(file)) {
        changes[index].remove.push(file);
        continue;
      }
      assign.set(file, index);
      used[index] += mine.size;
      if (mine.sha !== remote.sha) changes[index].add.push(file);
    }
  });
  const unplaced = [];
  for (const file of [...local.keys()].sort()) {
    if (assign.has(file)) continue;
    const size = local.get(file).size;
    const index = used.findIndex((bytes) => bytes + size <= limitBytes);
    if (index < 0) {
      unplaced.push(file);
      continue;
    }
    assign.set(file, index);
    used[index] += size;
    changes[index].add.push(file);
  }
  for (const change of changes) {
    change.add.sort();
    change.remove.sort();
  }
  return { assign, used, changes, unplaced };
}

// "./assets/<dir>/<rest>" (as written in the catalog JSON) -> shard URL, when that file has a shard.
export function rewriteAssetUrls(text, dirs, urlFor) {
  const pattern = new RegExp(`"\\./assets/((?:${dirs.map(escapeRegExp).join("|")})/[^"\\\\]+)"`, "g");
  let rewritten = 0;
  let missing = 0;
  const out = text.replace(pattern, (whole, rel) => {
    const url = urlFor(rel);
    if (!url) {
      missing += 1;
      return whole;
    }
    rewritten += 1;
    return JSON.stringify(url);
  });
  return { text: out, rewritten, missing };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadConfig(file = CONFIG_PATH) {
  const config = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(config.shards) || !config.shards.length) throw new Error(`${file}: no shards`);
  if (!Array.isArray(config.dirs) || !config.dirs.length) throw new Error(`${file}: no dirs`);
  return config;
}

// Every photo under app/assets/<dir>/ (manifest JSON files stay in the repo only).
async function listLocal(dirs) {
  const files = new Map();
  for (const dir of dirs) {
    const root = path.join("app", "assets", dir);
    if (!existsSync(root)) continue;
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.name.endsWith(".json")) continue;
      const abs = path.join(entry.parentPath ?? entry.path, entry.name);
      const rel = path.relative(path.join("app", "assets"), abs).split(path.sep).join("/");
      const buffer = await readFile(abs);
      files.set(rel, { size: buffer.length, sha: gitBlobSha(buffer), abs });
    }
  }
  return files;
}

async function listShard(shard, dirs) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "Gunpula-publish-site" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${shard.repo}/git/trees/main?recursive=1`, { headers });
  if (!response.ok) throw new Error(`${shard.repo}: file list ${response.status}`);
  const doc = await response.json();
  if (doc.truncated) throw new Error(`${shard.repo}: file list truncated — split the shard`);
  const files = new Map();
  let live = null;
  for (const item of doc.tree || []) {
    if (item.type === "blob" && item.path === LIVE_FILE) live = item.sha;
    if (item.type !== "blob" || !dirs.some((dir) => item.path.startsWith(`${dir}/`))) continue;
    files.set(item.path, { size: item.size, sha: item.sha });
  }
  return { files, live };
}

function git(cwd, args, input) {
  return execFileSync("git", args, { cwd, input, encoding: "utf8", maxBuffer: 256 * MB, stdio: ["pipe", "pipe", "inherit"] }).trim();
}

// Commit adds/removes onto the shard without downloading its photos (blobless clone + index plumbing,
// write-tree --missing-ok so git does not prefetch the shard's photos), in pushes of at most
// PUSH_BATCH_BYTES. Every commit also rewrites live.json; returns its last blob id.
async function pushShard(shard, change, local, shardNumber) {
  let liveSha = null;
  const work = await mkdtemp(path.join(os.tmpdir(), "gunpula-shard-"));
  try {
    git(work, ["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", `https://github.com/${shard.repo}.git`, "repo"]);
    const repo = path.join(work, "repo");
    git(repo, ["read-tree", "HEAD"]);
    const batches = [];
    let batch = { add: [], bytes: 0 };
    for (const file of change.add) {
      const size = local.get(file).size;
      if (batch.add.length && batch.bytes + size > PUSH_BATCH_BYTES) {
        batches.push(batch);
        batch = { add: [], bytes: 0 };
      }
      batch.add.push(file);
      batch.bytes += size;
    }
    batches.push(batch);
    batches[0].remove = change.remove;
    for (const [index, part] of batches.entries()) {
      const lines = [];
      if (part.add.length) {
        const shas = git(repo, ["hash-object", "-w", "--no-filters", "--stdin-paths"], `${part.add.map((file) => path.resolve(local.get(file).abs)).join("\n")}\n`).split("\n");
        part.add.forEach((file, i) => lines.push(`100644 ${shas[i]}\t${file}`));
      }
      for (const file of part.remove || []) lines.push(`0 ${"0".repeat(40)}\t${file}`);
      if (!lines.length && !change.markerOnly) continue;
      const marker = `${JSON.stringify({ published_at: new Date().toISOString(), shard: shardNumber, add: part.add.length, remove: (part.remove || []).length })}\n`;
      liveSha = git(repo, ["hash-object", "-w", "--no-filters", "--stdin"], marker);
      lines.push(`100644 ${liveSha}\t${LIVE_FILE}`);
      git(repo, ["update-index", "--index-info"], `${lines.join("\n")}\n`);
      const tree = git(repo, ["write-tree", "--missing-ok"]);
      const message = `Photos: +${part.add.length} −${(part.remove || []).length}${batches.length > 1 ? ` (part ${index + 1}/${batches.length})` : ""}\n\nPublished by mdefitko777/Gunpula scripts/publish_site.mjs (shard ${shardNumber}).`;
      const commit = git(repo, ["commit-tree", tree, "-p", "HEAD", "-m", message]);
      git(repo, ["update-ref", "HEAD", commit]);
      git(repo, ["push", "--quiet", "origin", "HEAD:main"]);
      console.log(`${shard.repo}: pushed +${part.add.length} −${(part.remove || []).length} (${(part.bytes / MB).toFixed(1)} MB)`);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return liveSha;
}

// True once the shard's Pages site serves the live.json the tree has (so every photo in the tree is up).
async function waitLive(shard, expectedSha, timeoutMs = LIVE_TIMEOUT_MS) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(`${shard.url}${LIVE_FILE}?t=${Date.now()}`, { cache: "no-store" });
      if (response.ok && gitBlobSha(Buffer.from(await response.arrayBuffer())) === expectedSha) return true;
    } catch {}
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}

async function dirSize(root) {
  let total = 0;
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) total += (await stat(path.join(entry.parentPath ?? entry.path, entry.name))).size;
  }
  return total;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 256 * MB }).split("\0").filter(Boolean);
}

export async function buildSite(outDir, config, assign) {
  const out = path.resolve(outDir);
  if (!out.startsWith(path.resolve(".") + path.sep)) throw new Error(`--out must be inside the repo: ${outDir}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const skip = config.dirs.map((dir) => `app/assets/${dir}/`);
  const excluded = (file) => (config.site_exclude || []).some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));
  const encode = (rel) => rel.split("/").map(encodeURIComponent).join("/");
  // A photo no live shard holds (no room, or not synced) is served from the repo itself.
  const urlFor = (rel) =>
    assign.has(rel) ? `${config.shards[assign.get(rel)].url}${encode(rel)}` : existsSync(path.join("app", "assets", rel)) ? `${RAW_BASE}${encode(rel)}` : null;
  let rewritten = 0;
  let missing = 0;
  let upgraded = 0;
  // Only tracked files: nothing local-only (secrets, work files) can reach the site.
  for (const file of trackedFiles()) {
    if (file.startsWith(".github/") || skip.some((prefix) => file.startsWith(prefix)) || excluded(file)) continue;
    const target = path.join(out, file);
    await mkdir(path.dirname(target), { recursive: true });
    if (file.endsWith(".json") && (file.startsWith("data/") || file.startsWith("app/"))) {
      const text = await readFile(file, "utf8");
      if (text.includes("./assets/") || text.includes('"http://')) {
        const result = rewriteAssetUrls(text, config.dirs, urlFor);
        const secure = upgradeCleartextImages(result.text);
        rewritten += result.rewritten;
        missing += result.missing;
        upgraded += secure.upgraded;
        await writeFile(target, secure.text);
        continue;
      }
    }
    await cp(file, target);
  }
  const { map, ...thumbs } = await writeThumbMap(path.join(out, "data", "thumbs.json"), config, assign, urlFor);
  const feedThumbs = await writeFeedThumbs(path.join(out, "data"), map);
  await stampManifest(path.join(out, "data"), config.shards.map((shard) => shard.url));
  return { rewritten, missing, upgraded, thumbs, feedThumbs, bytes: await dirSize(out) };
}

// Adds "thumb" to the site copies of the inbox feeds (lib/thumbs.mjs FEED_THUMB_FILES), looked up in
// the site's own (already rewritten) kits and box art, so it is the thumbnail of the cover the app shows.
export async function writeFeedThumbs(dataDir, map) {
  const readJson = async (rel, fallback) => {
    const file = path.join(dataDir, rel);
    return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : fallback;
  };
  const kitsById = new Map();
  const splitDir = path.join(dataDir, "split");
  const splitNames = existsSync(splitDir) ? (await readdir(splitDir)).filter((name) => /^kits-.+\.json$/.test(name)).sort() : [];
  for (const name of splitNames) for (const kit of (await readJson(`split/${name}`, {})).kits || []) kitsById.set(kit.kit_id, kit);
  const boxart = (await readJson("atlas/gundam-boxart.json", {})).boxart || {};
  const aliases = (await readJson("split/kit-aliases.json", {})).aliases || {};
  const results = [];
  for (const rel of FEED_THUMB_FILES) {
    const file = path.join(dataDir, rel);
    if (!existsSync(file)) continue;
    const text = await readFile(file, "utf8");
    const doc = JSON.parse(text);
    const counts = addFeedThumbs(doc, { kitsById, boxart, aliases, map });
    // Same layout as the generator wrote (update-feed-lite.json is indented, notify-feed.json is not).
    const next = `${JSON.stringify(doc, null, /^\{\r?\n/.test(text) ? 2 : 0)}\n`;
    await writeFile(file, next);
    results.push({ file: rel, ...counts, before: Buffer.byteLength(text), after: Buffer.byteLength(next) });
  }
  return results;
}

// Only thumbnails a live shard holds (assign) go in; a photo in a shard dir is keyed by the URL
// its JSON now carries, an announcement picture by the app's resolveAsset of ../app/assets/….
export function thumbUrls(config, assign, urlFor) {
  const encode = (rel) => rel.split("/").map(encodeURIComponent).join("/");
  const shardDir = (rel) => config.dirs.includes(rel.split("/")[0]);
  return {
    originalUrl: (rel) => (shardDir(rel) ? urlFor(rel) : `${SITE_BASE}app/assets/${rel}`),
    thumbUrl: (rel) => (assign.has(rel) ? `${config.shards[assign.get(rel)].url}${encode(rel)}` : null),
  };
}

// The repo photos' thumbnails are made by the publish job, not committed: a checkout that has not
// made them (a sync from this PC) would otherwise remove every one of them from the shards.
export function repoThumbsMade(shardFiles, indexExists = existsSync(REPO_THUMB_INDEX)) {
  return indexExists || !shardFiles.some((files) => [...files.keys()].some((file) => file.startsWith("thumbs/repo/")));
}

async function writeThumbMap(target, config, assign, urlFor) {
  const readIndex = async (file) => (existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {});
  const repoIndex = await readIndex(REPO_THUMB_INDEX);
  const webIndex = (await readIndex(WEB_THUMB_INDEX)).thumbs || {};
  const map = buildThumbMap({ repoIndex, webIndex, ...thumbUrls(config, assign, urlFor) });
  await writeFile(target, `${JSON.stringify(map)}\n`);
  return { map, entries: Object.keys(map.thumbs).length, repoPhotos: Object.keys(repoIndex).length, web: Object.keys(webIndex).length, bytes: (await stat(target)).size };
}

// Data files the app may fetch on their own: every JSON under data/ except the per-channel kit
// files (content_hash covers them), the manifest itself and the web app's search files.
export function isSideDataFile(rel) {
  return rel.endsWith(".json") && !/^split\/(kits-[^/]+|manifest)\.json$/.test(rel) && !rel.startsWith("search/");
}

// { "<path under data/>": first 16 hex of sha256 } over the bytes as served (after the photo path
// rewrite), keyed like the app's aux file names ("announcements.json", "atlas/restocks.json"), so
// the app can also check a download against it (a stale CDN copy or the raw fallback differs).
// 84 files on 2026-11-12: the manifest grows from 0.6 KB to 4.8 KB (1.9 KB gzipped). Listing only
// what the app reads today would be smaller but would miss the next file the app starts reading.
export async function sideFileHashes(dataDir) {
  const names = [];
  for (const entry of await readdir(dataDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const rel = path.relative(dataDir, path.join(entry.parentPath ?? entry.path, entry.name)).split(path.sep).join("/");
    if (isSideDataFile(rel)) names.push(rel);
  }
  const files = {};
  for (const rel of names.sort()) files[rel] = createHash("sha256").update(await readFile(path.join(dataDir, rel))).digest("hex").slice(0, 16);
  return files;
}

// The app re-downloads the split files only when content_hash (with updated_at and total) changes.
// Until files existed, a change to a side file alone (2 new announcements on 2026-11-12) did not
// reach the app before the kits changed too.
export async function stampManifest(dataDir, imageShards) {
  const manifestPath = path.join(dataDir, "split", "manifest.json");
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const hash = createHash("sha256");
  const splitDir = path.join(dataDir, "split");
  for (const name of (await readdir(splitDir)).filter((n) => n !== "manifest.json" && n.endsWith(".json")).sort()) {
    hash.update(`${name}\0`).update(await readFile(path.join(splitDir, name))).update("\0");
  }
  manifest.content_hash = hash.digest("hex").slice(0, 16);
  manifest.image_shards = imageShards;
  manifest.files = await sideFileHashes(dataDir);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function summary(lines) {
  console.log(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) return writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
}

async function main() {
  const argv = process.argv.slice(2);
  const sync = argv.includes("--sync");
  const planOnly = argv.includes("--plan");
  const outIndex = argv.indexOf("--out");
  const outDir = outIndex >= 0 ? argv[outIndex + 1] : null;
  const config = await loadConfig();
  const limit = config.limit_mb * MB;

  if (sync) {
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    // The shards follow main only: syncing from another (older) branch would delete photos main still uses.
    if (branch !== "main") throw new Error(`--sync only on main (this checkout is on ${branch}).`);
  }
  const local = await listLocal(config.dirs);
  const listed = [];
  for (const shard of config.shards) listed.push(await listShard(shard, config.dirs));
  const remote = listed.map((entry) => entry.files);
  if (sync && !repoThumbsMade(remote)) {
    throw new Error(`No ${REPO_THUMB_INDEX}: run node scripts/build_thumbs.mjs --repo first, or this sync deletes the repo photos' thumbnails from the shards.`);
  }
  const plan = planShards(local, remote, limit);
  const errors = [];
  const warnings = [];
  const notLive = [];

  const lines = ["### Image shards", "", "| shard | photos | MB | +add | −remove |", "| --- | ---: | ---: | ---: | ---: |"];
  config.shards.forEach((shard, i) => {
    const count = [...plan.assign.values()].filter((v) => v === i).length;
    lines.push(`| ${shard.repo} | ${count} | ${(plan.used[i] / MB).toFixed(0)} / ${config.limit_mb} | ${plan.changes[i].add.length} | ${plan.changes[i].remove.length} |`);
  });
  const free = plan.used.reduce((sum, bytes) => sum + Math.max(0, limit - bytes), 0);
  lines.push("", `Local photos: ${local.size}, free space left in shards: ${(free / MB).toFixed(0)} MB.`);
  if (plan.unplaced.length) errors.push(`${plan.unplaced.length} photos fit in no shard (first: ${plan.unplaced[0]}) — add a shard to ${CONFIG_PATH}.`);
  else if (free < (config.low_space_mb ?? 300) * MB) warnings.push(`Only ${(free / MB).toFixed(0)} MB left in the image shards — add a shard to ${CONFIG_PATH} soon.`);

  if (planOnly) {
    await summary(lines);
    return;
  }

  // New and changed photos first; removals only once the new site (which no longer uses them) is built.
  const liveSha = listed.map((entry) => entry.live);
  if (sync) {
    for (const [i, shard] of config.shards.entries()) {
      const change = plan.changes[i];
      const holds = [...plan.assign.values()].includes(i);
      if (!change.add.length && !(holds && !liveSha[i])) continue;
      liveSha[i] = await pushShard(shard, { add: change.add, remove: [], markerOnly: !change.add.length }, local, i + 1);
    }
  } else {
    // Without --sync, publish only what the shards already hold (the rest is served from the repo).
    for (const [i, change] of plan.changes.entries()) for (const file of change.add) if (!remote[i].has(file)) plan.assign.delete(file);
    if (plan.changes.some((change) => change.add.length)) warnings.push("Shards are behind the repo (run with --sync); unsynced photos are served from raw.githubusercontent.com.");
  }
  // Every run (not just the one that pushed): each shard that holds photos must be live with its
  // current tree, else the site that is up stays (it keeps working) and the next run tries again.
  const checks = await Promise.all(
    config.shards.map(async (shard, i) => {
      if (![...plan.assign.values()].includes(i)) return null;
      if (!liveSha[i]) return `${shard.repo}: no ${LIVE_FILE} yet (run with --sync on main).`;
      return (await waitLive(shard, liveSha[i])) ? null : `${shard.repo}: its Pages site did not serve the latest photos within ${LIVE_TIMEOUT_MS / 60000} minutes (Pages build still running or failed?).`;
    }),
  );
  notLive.push(...checks.filter(Boolean).map((text) => `${text} Site not published this time.`));

  // A shard without room still publishes (those photos come from the repo) but fails the job so it
  // is noticed; a site over the size limit or with a shard not live is not published at all.
  let deployable = false;
  if (outDir) {
    const site = await buildSite(outDir, config, plan.assign);
    lines.push("", `Site: ${(site.bytes / MB).toFixed(0)} MB (limit ${config.site_limit_mb} MB), ${site.rewritten} photo paths pointed at shards, ${site.missing} left as ./assets/ (file missing in the repo too), ${site.upgraded} http:// pictures changed to https://.`);
    lines.push("", `Thumbnails: data/thumbs.json ${site.thumbs.entries} entries (${(site.thumbs.bytes / 1024).toFixed(0)} KB) from ${site.thumbs.repoPhotos} repo photos and ${site.thumbs.web} remote covers.`);
    for (const feed of site.feedThumbs) {
      lines.push("", `Feed thumbs: data/${feed.file} ${feed.withThumb} of ${feed.items} items (+${((feed.after - feed.before) / 1024).toFixed(0)} KB).`);
    }
    if (site.bytes > config.site_limit_mb * MB) errors.push(`Site is ${(site.bytes / MB).toFixed(0)} MB, over ${config.site_limit_mb} MB — not published. Move another folder into the shards (dirs in ${CONFIG_PATH}).`);
    else if (notLive.length) errors.push(...notLive);
    else deployable = true;
  }
  if (sync && deployable) {
    for (const [i, shard] of config.shards.entries()) {
      if (plan.changes[i].remove.length) await pushShard(shard, { add: [], remove: plan.changes[i].remove }, local, i + 1);
    }
  }
  if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `deployable=${deployable}\n`, { flag: "a" });

  for (const warning of warnings) lines.push("", `⚠️ ${warning}`);
  for (const error of errors) lines.push("", `❌ ${error}`);
  await summary(lines);
  for (const warning of warnings) console.log(`::warning::${warning}`);
  for (const error of errors) console.log(`::error::${error}`);
  if (errors.length) process.exitCode = 1;
}

if (/(^|[\\/])publish_site\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
