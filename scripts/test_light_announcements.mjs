// The light announcement runs (refresh-announcements.yml, ANNOUNCEMENT_LIGHT=1 in
// fetch_bandai_announcements.mjs): which sources they read, how few detail pages they
// take, and that a run that found nothing new leaves announcements.json as it was.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DETAIL_PAGES_PER_HOST, LIGHT_RUN_DETAILS, planDetailFetches } from "./lib/announcement-details.mjs";
import { LIGHT_SOURCE_IDS, stampAnnouncements } from "./lib/official-announcements.mjs";

const TODAY = "2026-11-14";

// --- Sources: the makers' own lists, nothing that reads YouTube or a shop's goods pages.
assert.ok(LIGHT_SOURCE_IDS.includes("gundam_official_news"));
assert.ok(LIGHT_SOURCE_IDS.includes("premium_bandai_new_items"));
assert.ok(LIGHT_SOURCE_IDS.includes("tamashii_schedule"));
for (const id of LIGHT_SOURCE_IDS) {
  assert.doesNotMatch(id, /youtube|kotobukiya|corocoro|hamusuke|figsoku|hjweb|live|lineup/, `${id} belongs to the daily run`);
}
// Every light source is one the fetcher knows (it also refuses unknown ids at start).
const fetcher = readFileSync(new URL("./fetch_bandai_announcements.mjs", import.meta.url), "utf8");
const scheduleIds = { tamashii_reveals: "TAMASHII_REVEALS_SOURCE_ID", tamashii_schedule: "TAMASHII_SCHEDULE_SOURCE_ID" };
for (const id of LIGHT_SOURCE_IDS) {
  assert.ok(fetcher.includes(`id: "${id}"`) || fetcher.includes(`id: ${scheduleIds[id]}`), `${id} is a source of the fetcher`);
}

// --- Detail pages: new records only, two per host.
const tamashii = (id, day) => ({ id: `tamashii-${id}`, source_url: `https://tamashiiweb.com/item/${id}/`, announced_at: day });
const records = [16301, 16302, 16303, 16304].map((id, index) => tamashii(id, `2026-11-1${index}`));
const read = { page_url: "https://tamashiiweb.com/item/16290/", fetched_at: "2026-10-01", extractor_version: 1, description: ["x"], release_month: "2027-03" };
const stored = { "tamashii-16290": read, "tamashii-16291": { ...read, page_url: "https://tamashiiweb.com/item/16291/", error: "HTTP 500", retry_after: "2026-11-01" } };
const all = [...records, tamashii(16290, "2026-11-01"), tamashii(16291, "2026-11-01")];

const daily = planDetailFetches(all, stored, TODAY);
assert.equal(daily.length, DETAIL_PAGES_PER_HOST, "the daily run also refreshes and retries");
assert.ok(daily.some((item) => item.reason === "refresh") && daily.some((item) => item.reason === "retry"));

const light = planDetailFetches(all, stored, TODAY, LIGHT_RUN_DETAILS);
assert.deepEqual(light.map((item) => item.id), ["tamashii-16304", "tamashii-16303"], "newest new records first, two per host");
assert.ok(light.every((item) => item.reason === "new"));
// A page the run already has (a new コトブキヤ goods page) is still free.
const kotobukiya = { id: "kotobukiya-1", source_url: "https://shop.kotobukiya.co.jp/shop/g/g4934054000001/", announced_at: TODAY };
assert.equal(planDetailFetches([kotobukiya], {}, TODAY, { ...LIGHT_RUN_DETAILS, preloaded: new Set(["kotobukiya-1"]) }).length, 1);

// --- The stamp: a run that found nothing keeps the file byte for byte.
const body = { sources: [{ source_id: "gundam_official_news" }], fetch_errors: [], announcements: [{ id: "a", announced_at: "2026-11-13" }] };
const previous = { updated_at: "2026-11-13T18:17:48.015Z", ...body };
const now = "2026-11-14T03:10:00.000Z";
assert.equal(stampAnnouncements(previous, structuredClone(body), now).updated_at, previous.updated_at);
assert.deepEqual(Object.keys(stampAnnouncements(previous, body, now)), ["updated_at", "sources", "fetch_errors", "announcements"]);
const changed = { ...body, announcements: [...body.announcements, { id: "b", announced_at: TODAY }] };
assert.equal(stampAnnouncements(previous, changed, now).updated_at, now);
assert.equal(stampAnnouncements({ ...body, fetch_errors: [{ source_id: "x", message: "503" }], updated_at: previous.updated_at }, body, now).updated_at, now, "an error that went away is a change");
assert.equal(stampAnnouncements(null, body, now).updated_at, now);
assert.equal(stampAnnouncements(body, body, now).updated_at, now, "a file without a stamp gets one");

console.log("light announcements: ok");
