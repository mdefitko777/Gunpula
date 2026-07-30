import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  BANDAI_HOBBY_NEWS_URL,
  BANDAI_HOBBY_YOUTUBE_FEED_URL,
  mergeAnnouncementRecords,
  parseBandaiHobbyNews,
  parseBandaiYoutubeFeed,
} from "./lib/bandai-announcements.mjs";

const OUTPUT_PATH = "data/announcements.json";
const IMAGE_DIR = "app/assets/announcements";

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "user-agent": "Gunpula announcement monitor (+https://github.com/mdefitko777/Gunpula)",
      accept: "text/html,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja-JP,ja;q=0.9,en;q=0.6",
    },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function readPrevious() {
  try {
    const previous = JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
    previous.announcements = (previous.announcements || []).filter((record) =>
      record.source_url !== BANDAI_HOBBY_NEWS_URL
      && record.source_url !== "https://bandai-hobby.net/news/"
      && record.source_url !== "https://internal-preview.bandai-hobby.net/news/"
    );
    return previous;
  } catch {
    return { announcements: [] };
  }
}

async function cacheAnnouncementImages(records) {
  await mkdir(IMAGE_DIR, { recursive: true });
  for (const record of records) {
    if (!/^https?:/i.test(record.thumbnail_url || "")) continue;
    try {
      const response = await fetch(record.thumbnail_url, {
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": "Gunpula announcement image cache" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      const extension = /png/i.test(contentType) ? "png" : /webp/i.test(contentType) ? "webp" : "jpg";
      const filename = `${record.id.replace(/[^a-z0-9_-]/gi, "_")}.${extension}`;
      await writeFile(`${IMAGE_DIR}/${filename}`, Buffer.from(await response.arrayBuffer()));
      record.thumbnail_url = `../app/assets/announcements/${filename}`;
    } catch (error) {
      console.warn(`${record.id}: image cache failed (${error.message})`);
    }
  }
  const used = new Set(records
    .map((record) => record.thumbnail_url)
    .filter((url) => String(url || "").startsWith("../app/assets/announcements/"))
    .map((url) => basename(url)));
  for (const filename of await readdir(IMAGE_DIR)) {
    if (!used.has(filename)) await unlink(`${IMAGE_DIR}/${filename}`);
  }
}

const previous = await readPrevious();
const errors = [];
const incoming = [];

for (const source of [
  { id: "bandai_hobby_news", url: BANDAI_HOBBY_NEWS_URL, parse: parseBandaiHobbyNews },
  { id: "bandai_hobby_youtube", url: BANDAI_HOBBY_YOUTUBE_FEED_URL, parse: parseBandaiYoutubeFeed },
]) {
  try {
    const records = source.parse(await fetchText(source.url));
    incoming.push(...records);
    console.log(`${source.id}: ${records.length} Gundam announcement records`);
  } catch (error) {
    errors.push({ source_id: source.id, message: error.message });
    console.warn(`${source.id}: ${error.message}`);
  }
}

const announcements = mergeAnnouncementRecords(previous.announcements, incoming);
await cacheAnnouncementImages(announcements);
await writeFile(OUTPUT_PATH, `${JSON.stringify({
  updated_at: new Date().toISOString(),
  sources: [
    { source_id: "bandai_hobby_news", name: "BANDAI SPIRITS", url: BANDAI_HOBBY_NEWS_URL },
    { source_id: "bandai_hobby_youtube", name: "BANDAI Hobby Site YouTube", url: BANDAI_HOBBY_YOUTUBE_FEED_URL },
  ],
  fetch_errors: errors,
  announcements,
}, null, 2)}\n`);

console.log(`Wrote ${announcements.length} announcements to ${OUTPUT_PATH}`);
