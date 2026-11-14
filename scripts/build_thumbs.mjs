// Makes the 400 px WebP thumbnails the app shows in its tiles (scripts/lib/thumbs.mjs says why).
//
//   node scripts/build_thumbs.mjs --repo                 every photo in app/assets/{catalog,kotobukiya-ac,bbx,announcements}
//                                                        -> app/assets/thumbs/repo/ (publish job; not committed, cached)
//   node scripts/build_thumbs.mjs --fetch [--minutes=8] [--limit=5000]
//                                                        remote covers, feeds and new items first
//                                                        -> app/assets/thumbs/web/ (thumbs.yml, daily; committed)
//   node scripts/build_thumbs.mjs --plan                 how many are missing, no network
//
// --repo regenerates only photos whose bytes (or THUMB_RECIPE) changed (app/assets/thumbs/repo/index.json
// keeps "<recipe>:<sha1 of the photo>") and removes thumbnails of photos that are gone. --fetch reads each remote cover once
// with the bot's rules (robots.txt, one request per host at a time >= 1.1 s apart, a host that
// answers 403/429/503 or a page instead of a picture is left for the run); 404/410 are written to
// the index and retried after 30 days. Needs Python with Pillow.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadRobots, robotsAllows } from "./lib/robots.mjs";
import { createHostStops } from "./lib/official-announcements.mjs";
import {
  feedKitIds,
  makeThumbs,
  REPO_SOURCE_DIRS,
  REPO_THUMB_INDEX,
  repoThumbRel,
  THUMB_RECIPE,
  THUMB_ROOT,
  thumbCandidates,
  WEB_THUMB_INDEX,
  webThumbFile,
} from "./lib/thumbs.mjs";

const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const HOST_GAP_MS = 1100;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const RETRY_FAILED_DAYS = 30;
const BATCH = 400;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function listRepoPhotos() {
  const files = [];
  for (const dir of REPO_SOURCE_DIRS) {
    const root = path.join("app", "assets", dir);
    if (!existsSync(root)) continue;
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(?:jpe?g|png|gif|webp)$/i.test(entry.name)) continue;
      const abs = path.join(entry.parentPath ?? entry.path, entry.name);
      files.push(path.relative(path.join("app", "assets"), abs).split(path.sep).join("/"));
    }
  }
  return files.sort();
}

// index: { "<dir>/<file>": sha1 of the photo } -> which photos need a (new) thumbnail, which thumbnails go.
export function planRepoThumbs(photos, index, thumbExists) {
  const make = [];
  for (const [rel, sha] of photos) if (index[rel] !== sha || !thumbExists(rel)) make.push(rel);
  const drop = Object.keys(index).filter((rel) => !photos.has(rel));
  return { make, drop };
}

async function buildRepo() {
  const index = await readJson(REPO_THUMB_INDEX, {});
  const photos = new Map();
  for (const rel of await listRepoPhotos()) photos.set(rel, `${THUMB_RECIPE}:${createHash("sha1").update(await readFile(path.join("app", "assets", rel))).digest("hex")}`);
  const target = (rel) => path.join("app", "assets", repoThumbRel(rel));
  const { make, drop } = planRepoThumbs(photos, index, (rel) => existsSync(target(rel)));
  for (const rel of drop) {
    await rm(target(rel), { force: true });
    delete index[rel];
  }
  let made = 0;
  const failed = [];
  for (let i = 0; i < make.length; i += BATCH) {
    const part = make.slice(i, i + BATCH);
    const results = makeThumbs(part.map((rel) => ({ src: path.join("app", "assets", rel), dst: target(rel) })));
    for (const [j, rel] of part.entries()) {
      if (results[j]?.ok) {
        index[rel] = photos.get(rel);
        made += 1;
      } else {
        // The thumbnail of the photo's previous bytes would still be published to the shards.
        await rm(target(rel), { force: true });
        delete index[rel];
        failed.push(`${rel}: ${results[j]?.error || "no answer"}`);
      }
    }
    console.log(`repo thumbnails: ${Math.min(i + BATCH, make.length)}/${make.length}`);
    await writeJson(REPO_THUMB_INDEX, sortKeys(index));
  }
  await writeJson(REPO_THUMB_INDEX, sortKeys(index));
  console.log(`Repo photos: ${photos.size}, thumbnails made ${made}, removed ${drop.length}, failed ${failed.length}.`);
  for (const line of failed.slice(0, 20)) console.log(`  failed ${line}`);
}

async function candidates() {
  const kits = [];
  for (const name of (await readdir("data/split")).filter((n) => /^kits-.+\.json$/.test(n)).sort()) kits.push(...(await readJson(path.join("data/split", name), {})).kits || []);
  const boxart = (await readJson("data/atlas/gundam-boxart.json", {})).boxart || {};
  const firstSeen = (await readJson("data/kit-first-seen.json", {})).dates || {};
  const feedIds = feedKitIds((await readJson("data/atlas/notify-feed.json", {})).entries || []);
  feedKitIds(((await readJson("data/update-feed-lite.json", {})).entries || []).slice(0, 7), feedIds);
  const restockIds = new Set(Object.keys((await readJson("data/atlas/restocks.json", {})).by_kit || {}));
  const announcements = (await readJson("data/announcements.json", {})).announcements || [];
  return thumbCandidates({ kits, boxart, firstSeen, feedIds, restockIds, announcements });
}

// Remote covers still to fetch: not copied yet and not a recent 404.
export function pendingUrls(urls, index, today = new Date()) {
  const cutoff = today.getTime() - RETRY_FAILED_DAYS * 24 * 60 * 60 * 1000;
  return urls.filter((url) => !index.thumbs?.[url] && !(index.failed?.[url] && Date.parse(index.failed[url].at) > cutoff));
}

async function fetchHost(host, urls, { deadline, stops, tmp, index, downloads }) {
  const robots = await loadRobots(host, { userAgent: USER_AGENT });
  let last = Date.now();
  if (robots.disallowAll) {
    console.log(`${host}: robots.txt ${robots.status}; ${urls.length} covers left`);
    return;
  }
  for (const url of urls) {
    if (Date.now() > deadline) break;
    if (!robotsAllows(robots, url)) continue;
    try {
      stops.check(url);
    } catch (error) {
      console.log(`${error.message}; the rest of its covers wait for the next run`);
      break;
    }
    const wait = last + HOST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(30000) });
      last = Date.now();
      stops.record(url, response.status);
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !type.startsWith("image/")) {
        // Unread bodies keep the connection busy until garbage collection.
        await response.body?.cancel().catch(() => {});
        if (response.status === 404 || response.status === 410) index.failed[url] = { status: response.status, at: new Date().toISOString().slice(0, 10) };
        // A page instead of the picture: a bot check or a login wall, so leave the host alone.
        else if (response.ok) stops.stop(url, `a ${type || "non-image"} answer`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_SOURCE_BYTES) continue;
      const src = path.join(tmp, `${downloads.length}`);
      await writeFile(src, bytes);
      downloads.push({ url, src, bytes: bytes.length });
    } catch (error) {
      console.log(`${host}: ${error.message}`);
    }
  }
}

async function fetchWeb({ minutes, limit }) {
  const index = await readJson(WEB_THUMB_INDEX, {});
  index.thumbs ||= {};
  index.failed ||= {};
  const todo = pendingUrls(await candidates(), index).slice(0, limit);
  const byHost = new Map();
  for (const url of todo) {
    const host = new URL(url).host;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }
  console.log(`Remote covers to copy: ${todo.length} on ${byHost.size} hosts (${[...byHost].map(([h, u]) => `${h} ${u.length}`).join(", ")})`);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "gunpula-thumbs-"));
  const downloads = [];
  const stops = createHostStops();
  const deadline = Date.now() + minutes * 60 * 1000;
  try {
    await Promise.all([...byHost].map(([host, urls]) => fetchHost(host, urls, { deadline, stops, tmp, index, downloads })));
    let sourceBytes = 0;
    let made = 0;
    for (let i = 0; i < downloads.length; i += BATCH) {
      const part = downloads.slice(i, i + BATCH);
      const results = makeThumbs(part.map((item) => ({ src: item.src, dst: path.join(THUMB_ROOT, "web", webThumbFile(item.url)) })));
      part.forEach((item, j) => {
        if (!results[j]?.ok) return;
        index.thumbs[item.url] = webThumbFile(item.url);
        sourceBytes += item.bytes;
        made += 1;
      });
    }
    console.log(`Copied ${made} remote covers (${(sourceBytes / 1024 / 1024).toFixed(1)} MB of originals); ${pendingUrls(await candidates(), index).length} left.`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
    await writeJson(WEB_THUMB_INDEX, {
      note: "Remote cover -> its 400 px WebP thumbnail under app/assets/thumbs/web/ (scripts/build_thumbs.mjs --fetch). failed: 404/410 answers, retried after 30 days.",
      thumbs: sortKeys(index.thumbs),
      failed: sortKeys(index.failed),
    });
  }
}

async function plan() {
  const repoIndex = await readJson(REPO_THUMB_INDEX, {});
  const photos = await listRepoPhotos();
  const webIndex = await readJson(WEB_THUMB_INDEX, {});
  const urls = await candidates();
  const pending = pendingUrls(urls, webIndex);
  const hosts = {};
  for (const url of pending) hosts[new URL(url).host] = (hosts[new URL(url).host] || 0) + 1;
  console.log(`Repo photos ${photos.length}, with thumbnail ${photos.filter((rel) => repoIndex[rel]).length}.`);
  console.log(`Remote covers ${urls.length}, copied ${Object.keys(webIndex.thumbs || {}).length}, failed ${Object.keys(webIndex.failed || {}).length}, pending ${pending.length}:`);
  for (const [host, count] of Object.entries(hosts).sort((a, b) => b[1] - a[1])) console.log(`  ${host} ${count}`);
}

function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const argv = process.argv.slice(2);
  const option = (name, fallback) => Number(argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1] ?? fallback);
  if (argv.includes("--repo")) await buildRepo();
  else if (argv.includes("--fetch")) await fetchWeb({ minutes: option("minutes", 8), limit: option("limit", 5000) });
  else await plan();
}

if (/(^|[\\/])build_thumbs\.mjs$/.test(process.argv[1] || "")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
