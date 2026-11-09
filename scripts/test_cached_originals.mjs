import assert from "node:assert/strict";
import { dropCachedOriginals, urlHash } from "./lib/cached-originals.mjs";

const original = "https://alter-web.jp/uploads/products/20190719141141_gcfb6vEB.jpg";
const other = "https://alter-web.jp/uploads/products/20190719140232_qtFHut1h.jpg";
assert.equal(urlHash(original), "ddf6931224");

const kit = {
  gallery_image_urls: ["./assets/catalog/madoka/alter-madoka-258-01-ddf6931224.jpg", original, other],
};
assert.equal(dropCachedOriginals(kit), 1);
assert.deepEqual(kit.gallery_image_urls, ["./assets/catalog/madoka/alter-madoka-258-01-ddf6931224.jpg", other]);
assert.deepEqual(kit.images.cached_from, [original], "the original URL is kept out of the gallery");
assert.equal(dropCachedOriginals(kit), 0, "idempotent");

const remoteOnly = { gallery_image_urls: [original, other] };
assert.equal(dropCachedOriginals(remoteOnly), 0);
assert.deepEqual(remoteOnly.gallery_image_urls, [original, other]);

console.log("cached originals: ok");
