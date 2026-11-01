// Self-test for scripts/atlas/build_gundam_boxart.mjs (no network):
//   node scripts/atlas/test_gundam_boxart.mjs
import assert from "node:assert/strict";
import { decodeJpegLuma, letterbox, isDeadUrl, kitJans, confidenceFor, boxPairShot, isKitName } from "./build_gundam_boxart.mjs";

const b64 = (s) => Buffer.from(s, "base64");

// 48x48 baseline 4:2:0 JPEG: white bands rows 0-11 and 36-47, random colour noise between.
const BASELINE =
  "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";
// Same picture saved as a progressive JPEG (unsupported -> null).
const PROGRESSIVE =
  "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";
// 16x16 grayscale (single component) JPEG: dark (60) vertical stripe in columns 4-11.
const GRAY =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/wAALCAAQABABAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APdv+DsP/mgf/c1f+4ij/g08/wCa+f8Acq/+5ej/AIOw/wDmgf8A3NX/ALiKP+DTz/mvn/cq/wDuXr//2Q==";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

{
  const img = decodeJpegLuma(b64(BASELINE));
  assert.ok(img, "baseline decodes");
  assert.equal(img.width, 48);
  assert.equal(img.height, 48);
  const Y = (x, y) => img.data[y * 48 + x];
  near(Y(24, 3), 255, 4, "white band");
  near(Y(5, 20), 41, 6, "noise luma (5,20) vs PIL");
  near(Y(30, 25), 72, 6, "noise luma (30,25) vs PIL");
  near(Y(44, 33), 85, 6, "noise luma (44,33) vs PIL");
  const lb = letterbox(img);
  assert.equal(lb.shape, "landscape");
  near(lb.bands[0], 12, 1, "top band");
  near(lb.bands[1], 12, 1, "bottom band");
}
assert.equal(decodeJpegLuma(b64(PROGRESSIVE)), null, "progressive is unsupported");
{
  const img = decodeJpegLuma(b64(GRAY));
  assert.ok(img, "grayscale decodes");
  near(img.data[8 * 16 + 8], 60, 6, "stripe");
  near(img.data[8 * 16 + 0], 255, 6, "background");
}
assert.equal(decodeJpegLuma(Buffer.from("not a jpeg")), null);

// Synthetic luminance images for the detector.
function synth(W, H, paint) {
  const data = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = paint(x, y);
    if (v !== undefined) data[y * W + x] = v;
  }
  return { width: W, height: H, data };
}
// Busy "art" texture for synthetic boxes (flat fills look like studio backgrounds).
const art = (x, y) => 40 + ((x * 37 + y * 101 + ((x * y) % 17) * 13) % 150);
// Landscape box: full width, rows 38..161 inked.
assert.equal(letterbox(synth(200, 200, (x, y) => (y >= 38 && y < 162 ? art(x, y) : undefined))).shape, "landscape");
// Portrait box: full height, columns 30..169 inked.
assert.equal(letterbox(synth(200, 200, (x, y) => (x >= 30 && x < 170 ? art(x, y) : undefined))).shape, "portrait");
// Portrait-framed product photo: same white padding, but a flat studio background.
{
  const lb = letterbox(synth(200, 200, (x, y) => (x >= 30 && x < 170 ? (x > 80 && x < 120 && y > 40 && y < 160 ? art(x, y) : 200 + (y >> 5)) : undefined)));
  assert.equal(lb.framed, "portrait");
  assert.equal(lb.shape, null);
}
// Studio product photo: background fills the square.
assert.equal(letterbox(synth(200, 200, (x, y) => 120 + ((x + y) % 7))).shape, null);
// Product on white: object in the middle, margins on all four sides.
assert.equal(letterbox(synth(200, 200, (x, y) => (x > 50 && x < 150 && y > 20 && y < 180 ? 60 : undefined))).shape, null);
// White-bordered landscape box (6 px white side margins inside the box): soft landscape.
{
  const lb = letterbox(synth(200, 200, (x, y) => (y >= 37 && y < 163 && x >= 6 && x < 197 ? art(x, y) : undefined)));
  assert.equal(lb.shape, "landscape");
  assert.equal(lb.soft, true);
}
// Box art that is white along its top: lopsided bands, but a straight full-width bottom edge.
assert.equal(letterbox(synth(200, 200, (x, y) => (y >= 70 && y < 190 ? art(x, y) : undefined))).shape, "landscape");
// Lopsided margins with a ragged edge (subject on a white sweep): rejected.
assert.equal(letterbox(synth(200, 200, (x, y) => (y >= 70 && y < 190 - (x % 40) ? art(x, y) : undefined))).shape, null);

// Near-square frame (photo collage / card sheet): framed, but not a box aspect.
{
  const lb = letterbox(synth(200, 200, (x, y) => (y >= 12 && y < 188 ? art(x, y) : undefined)));
  assert.equal(lb.framed, "landscape");
  assert.equal(lb.shape, null);
}
// Very tall portrait frame (merch photo): not a box.
assert.equal(letterbox(synth(200, 200, (x, y) => (x >= 64 && x < 136 ? art(x, y) : undefined))).shape, null);

// Confidence tiers from the flat-block share.
assert.equal(confidenceFor({ smooth: 0.01 }, "high"), "high");
assert.equal(confidenceFor({ smooth: 0.08 }, "high"), "medium");
assert.equal(confidenceFor({ smooth: 0.15 }, "high"), "low");
assert.equal(confidenceFor({ smooth: 0.01, soft: true }, "high"), "medium");
assert.equal(confidenceFor({ smooth: 0.08 }, "medium"), "low");

// Box-sold gashapon: two solid boxes side by side vs one figure.
assert.equal(boxPairShot(synth(200, 200, (x, y) => (y >= 50 && y < 150 && ((x >= 10 && x < 95) || (x >= 105 && x < 190)) ? 120 : undefined))).box, true);
assert.equal(boxPairShot(synth(200, 200, (x, y) => (Math.abs(x - 100) < 20 + ((y * 7) % 30) && y > 15 && y < 185 ? 90 : undefined))).box, false);

// Premium Bandai kit names (full-width, spaced slashes) vs goods.
assert.ok(isKitName("ＨＧ 1 / 144 ガンダムジェミナス０１用アサルトブースター＆高機動型ユニット 拡張セット【再販】"));
assert.ok(isKitName("ＢＢ戦士 ３５０ 伊達政宗頑駄無"));
assert.ok(isKitName("1 / 100 ガンダムエックス【２０２６年９月発送】"));
assert.ok(isKitName("Figure-rise Standard スレッタ・マーキュリー"));
assert.ok(!isKitName("ガンダムデカールＤＸ 01 機動戦士ガンダム 地球連邦軍MS・ジオン軍MS用【1 / 144スケール推奨】"));
assert.ok(!isKitName("SDガンダム外伝NEO 禁じられた魔法 竜人の巫女"));
assert.ok(!isKitName("STRICT-G NANGA『機動戦士ガンダム』RX-78-2 GUNDAM SHIELD SLEEPING BAG"));
assert.ok(!isKitName("METAL ROBOT魂 νガンダム専用 HWS & ディスプレイパーツセット"));
assert.ok(!isKitName("ガンダムカードゲーム ブースターパック Dual Impact[GD02]"));

assert.ok(isDeadUrl("https://d3bk8pkqsprcvh.cloudfront.net/a.jpg?Expires=1&Signature=x"));
assert.ok(isDeadUrl("https://bandai-hobby.net/images/1.jpg"));
assert.ok(isDeadUrl("http://internal-pbn/x.jpg"));
assert.ok(isDeadUrl("./assets/catalog/gundam/x.jpg"));
assert.ok(!isDeadUrl("https://bandai-a.akamaihd.net/bc/img/model/b/1000252373_10.jpg"));

assert.deepEqual(kitJans({ kit_id: "hg-hg-1-144-4580886844760000", source_urls: [] }), ["4580886844760"]);
assert.deepEqual(kitJans({ kit_id: "x", source_urls: ["https://gashapon.jp/products/detail.php?jan_code=4549660547853000"] }), ["4549660547853"]);
assert.deepEqual(kitJans({ kit_id: "hg-4580886844761000", source_urls: [] }), [], "bad check digit");

console.log("test_gundam_boxart: ok");
