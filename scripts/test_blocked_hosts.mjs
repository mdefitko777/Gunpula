// Hosts that refuse the bot (2026-11-14): what each importer does instead of asking
// again. bsp-prize.jp full-size pictures → listing thumbnails; ホビーサーチ → Bushiroad
// Creative's own catalog (fixture: its REST answer of 2026-11-14, trimmed to three items
// and the fields read); Pokémon Center → no retry after a refusal; market sources
// refused twice → a week's rest.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { banprestoCover, isBspFullSize } from "./lib/bsp-prize.mjs";
import {
  bushiroadFiguresUrl,
  bushiroadMediaSource,
  bushiroadMediaUrl,
  parseBushiroadFigures,
} from "./lib/bushiroad-creative.mjs";
import { worthRetrying } from "./import_pokemon_center_jp.mjs";
import { isResting, nextRetryAfter, sourceStatus, unhealthySince, UNHEALTHY } from "./fetch_wanted_market_listings.mjs";

// --- bsp-prize.jp: the thumbnail is the cover, a copy already made of a full-size picture stays.
const FOLDER = "https://bsp-prize.jp/files/%E5%85%B1%E6%9C%89%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80/item";
const THUMB = "https://bsp-prize.jp/files_thumbnail/%E5%85%B1%E6%9C%89%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80/item/2022.03/2596551.png/250w_250h.png";
assert.equal(isBspFullSize(`${FOLDER}/2022.03/2596551.png`), true);
assert.equal(isBspFullSize(THUMB), false);
assert.equal(isBspFullSize("https://www.bsp-prize.jp/files/x.jpg"), false, "only the host that refuses");
assert.equal(banprestoCover(THUMB, undefined), THUMB, "a new record");
assert.equal(
  banprestoCover(THUMB, { images: { box_art_url: `${FOLDER}/2022.03/2596551.png` }, gallery_image_urls: [`${FOLDER}/2022.03/2596551.png`] }),
  THUMB,
  "a stored remote full-size cover is replaced",
);
const copied = {
  images: {
    box_art_url: "./assets/catalog/madoka/banpresto-madoka-2725382-01-4a916d34d7.jpg",
    cached_from: [`${FOLDER}/2026.02/2725382b.jpg`],
  },
};
assert.equal(banprestoCover(THUMB, copied), `${FOLDER}/2026.02/2725382b.jpg`, "relink turns it back into the copy");
assert.equal(banprestoCover(THUMB, { images: { box_art_url: "./assets/catalog/madoka/x-01-0000000000.jpg", cached_from: [THUMB] } }), THUMB);

// --- Bushiroad Creative: Fate figures from the figure list, picture from media/<id>.
const figures = JSON.parse(readFileSync(new URL("./fixtures/bushiroad-creative-figures.json", import.meta.url), "utf8"));
const fate = parseBushiroadFigures(figures);
assert.equal(fate.length, 1, "WIND BREAKER and ずんだもん are other titles");
assert.deepEqual(fate[0], {
  key: "99655",
  name: "BUSHIROAD THE BOX TVアニメ『Fate/strange Fake』 コレクションフィギュアRICH",
  series: "",
  line: "BUSHIROAD THE BOX",
  url: "https://bushiroad-creative.com/items/99655/",
  media_id: 101268,
  price_jpy: 660,
  release_date: "2026-10",
  is_limited: false,
});
// Filed under another title but TYPE-MOON's: still Fate.
const elsewhere = { ...figures[1], acf: { ...figures[1].acf, i_title: 9999, i_copyright: "©TYPE-MOON / FGO PROJECT" } };
assert.equal(parseBushiroadFigures([elsewhere]).length, 1);
assert.deepEqual(parseBushiroadFigures({ code: "rest_no_route" }), [], "an error object is no list");
assert.equal(bushiroadFiguresUrl(2), "https://bushiroad-creative.com/wp-json/wp/v2/items?goodsc=46&per_page=100&page=2&_fields=id,link,title,acf");
assert.equal(bushiroadMediaUrl(101268), "https://bushiroad-creative.com/wp-json/wp/v2/media/101268?_fields=id,source_url");
const media = { id: 101268, source_url: "https://bushiroad-creative.com/wordpress/wp-content/uploads/2026/06/05173346/Fate_figure_Rich_POP.jpg" };
assert.equal(bushiroadMediaSource(media), media.source_url);
assert.equal(bushiroadMediaSource({ source_url: "https://elsewhere.example/a.jpg" }), "");

// --- Pokémon Center: a refusal is not asked again in the same run.
assert.equal(worthRetrying(Object.assign(new Error("HTTP 403"), { status: 403 })), false);
assert.equal(worthRetrying(Object.assign(new Error("HTTP 429"), { status: 429 })), false);
assert.equal(worthRetrying(Object.assign(new Error("HTTP 500"), { status: 500 })), true);
assert.equal(worthRetrying(new Error("This operation was aborted")), true, "a timeout");

// --- Market: refused on two runs in a row → resting a week, then asked once more.
const day1 = "2026-11-11T20:10:00.000Z";
const day2 = "2026-11-12T20:10:00.000Z";
assert.equal(nextRetryAfter("refused", { attempted: 9, errors: 4 }, day1), null, "a first refusal may be a hiccup");
const rest = nextRetryAfter("refused", { status: "refused", since: day1 }, day2);
assert.equal(rest, "2026-11-19T20:10:00.000Z");
const stored = { status: "refused", since: day1, retry_after: rest };
assert.equal(isResting(stored, "2026-11-15T20:10:00.000Z"), true);
assert.equal(isResting(stored, "2026-11-19T20:10:00.000Z"), false, "asked again on the day");
assert.equal(isResting({ status: "ok" }, day2), false);
assert.equal(sourceStatus({ attempted: 0, matched: 0, errors: 0, skipped: "resting" }), "resting");
assert.equal(UNHEALTHY.has("resting"), false, "no warning while it rests");
assert.equal(nextRetryAfter("resting", stored, "2026-11-15T20:10:00.000Z"), rest, "carried while resting");
assert.equal(unhealthySince("resting", stored, "2026-11-15T20:10:00.000Z"), day1);
assert.equal(unhealthySince("refused", { ...stored, status: "resting" }, "2026-11-19T20:10:00.000Z"), day1, "one spell");
assert.equal(nextRetryAfter("refused", { ...stored, status: "resting" }, "2026-11-19T20:10:00.000Z"), "2026-11-26T20:10:00.000Z");
assert.equal(nextRetryAfter("ok", { ...stored, status: "resting" }, "2026-11-19T20:10:00.000Z"), null, "back to daily");

console.log("blocked hosts: ok");
