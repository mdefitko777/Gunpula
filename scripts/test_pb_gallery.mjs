import assert from "node:assert/strict";
import { applyCounts, countPhotos, pbItemId, photoUrl } from "./pb_gallery.mjs";

const naion = {
  kit_id: "pbandai-wb-1000252948",
  images: {
    box_art_url: "./assets/catalog/gundam/pbandai-wb-1000252948-01-db970b6dd3.jpg",
    box_art_source_id: "p_bandai_wayback",
    cached_from: ["https://bandai-a.akamaihd.net/bc/img/model/b/1000252948_1.jpg"],
  },
  gallery_image_urls: ["./assets/catalog/gundam/pbandai-wb-1000252948-01-db970b6dd3.jpg"],
};
assert.equal(pbItemId(naion), "1000252948");
assert.equal(pbItemId({ kit_id: "x", images: { box_art_source_id: "bandai_spirits_products_jp" } }), null, "only archived P-Bandai records");

assert.equal(applyCounts([naion], { counts: { 1000252948: { n: 9 } } }), 1);
assert.equal(naion.gallery_image_urls.length, 9, "the cached cover + photos 2..9");
assert.equal(naion.gallery_image_urls[1], photoUrl("1000252948", 2));
assert.equal(applyCounts([naion], { counts: { 1000252948: { n: 9 } } }), 0, "idempotent");

// BANDAI SPIRITS search record sold at Premium Bandai: the importer guessed _1 … _10
const guessed = Array.from({ length: 10 }, (_, i) => photoUrl("1000150943", i + 1));
const retail = {
  kit_id: "hg-x",
  is_premium_bandai: true,
  images: { box_art_url: guessed[0], box_art_source_id: "bandai_spirits_products_jp" },
  gallery_image_urls: ["./assets/catalog/gundam/hg-x-01-aaaaaaaaaa.jpg", ...guessed],
};
assert.equal(pbItemId(retail), "1000150943");
assert.equal(applyCounts([retail], { counts: { 1000150943: { n: 6 } } }), 1);
assert.deepEqual(retail.gallery_image_urls, ["./assets/catalog/gundam/hg-x-01-aaaaaaaaaa.jpg", ...guessed.slice(0, 6)], "photos 7–10 do not exist");
assert.equal(applyCounts([retail], { counts: { 1000150943: { n: 12 } } }), 1);
assert.equal(retail.gallery_image_urls.at(-1), photoUrl("1000150943", 12), "more than ten are added");
assert.equal(pbItemId({ kit_id: "y", images: { box_art_url: guessed[0], box_art_source_id: "bandai_spirits_products_jp" } }), null, "retail-only records are left alone");

for (const total of [1, 2, 3, 9, 16, 17]) {
  const asked = [];
  const n = await countPhotos(async (i) => {
    asked.push(i);
    return i <= total;
  });
  assert.equal(n, total, `count ${total}`);
  assert.ok(asked.length <= 10, `few requests for ${total}`);
}
assert.equal(await countPhotos(async () => null), null, "a refusal stops the count");

console.log("pb gallery: ok");
