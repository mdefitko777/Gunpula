// Checks for the tile colours of the Atlas covers (scripts/atlas/lib/cover_colors.mjs): the PNG
// decoder and the bg / fg rules, on small PNGs written here (no network, no Python).
// Run: node scripts/atlas/test_cover_colors.mjs
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { contrast, coverColors, coverFileColors, decodePng, foregroundFor, fromHex, readImagePixels } from "./lib/cover_colors.mjs";

let checks = 0;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])));
  return Buffer.concat([head, body, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * PNG from rows of samples (each row: array of bytes as stored, already packed). Every row uses
 * filter (row index % 5), so all five filters go through the decoder.
 */
function encodePng({ width, height, depth = 8, type, rows, palette, trns }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = type;
  const bpp = Math.max(1, ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type] * depth) >> 3);
  const out = [];
  rows.forEach((row, y) => {
    const filter = y % 5;
    const prev = y ? rows[y - 1] : row.map(() => 0);
    out.push(filter);
    row.forEach((v, x) => {
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      const predicted = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0;
      out.push((v - predicted) & 255);
    });
  });
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    ...(palette ? [chunk("PLTE", Buffer.from(palette))] : []),
    ...(trns ? [chunk("tRNS", Buffer.from(trns))] : []),
    chunk("IDAT", deflateSync(Buffer.from(out))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** RGBA PNG of size w×h where paint(x, y) gives [r, g, b, a]. */
function rgbaPng(width, height, paint) {
  const rows = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => paint(x, y)).flat());
  return encodePng({ width, height, type: 6, rows });
}

const RED = [229, 0, 18, 255];
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];
const inLogo = (x, y) => x >= 6 && x < 34 && y >= 6 && y < 18;
const decode = (png) => decodePng(png);

// ── Decoder: RGBA with all filters, palette + tRNS, 16-bit grey, 1-bit grey ──
{
  const png = rgbaPng(9, 7, (x, y) => [x * 20, y * 30, (x * y) % 256, 255 - x * 10]);
  const img = decode(png);
  assert.equal(img.width, 9);
  assert.equal(img.height, 7);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) assert.deepEqual([...img.data.subarray((y * 9 + x) * 4, (y * 9 + x) * 4 + 4)], [x * 20, y * 30, (x * y) % 256, 255 - x * 10]);
  checks++;

  const paletted = decode(encodePng({ width: 3, height: 2, type: 3, palette: [255, 0, 0, 0, 0, 255, 9, 9, 9], trns: [255, 128], rows: [[0, 1, 2], [2, 1, 0]] }));
  assert.deepEqual([...paletted.data.subarray(0, 12)], [255, 0, 0, 255, 0, 0, 255, 128, 9, 9, 9, 255]);
  checks++;

  // 16-bit grey keeps the high byte; tRNS names the transparent grey.
  const grey16 = decode(encodePng({ width: 2, height: 1, depth: 16, type: 0, trns: [0x12, 0x34], rows: [[0xff, 0xff, 0x12, 0x34]] }));
  assert.deepEqual([...grey16.data], [255, 255, 255, 255, 0x12, 0x12, 0x12, 0]);
  checks++;

  // 1-bit grey: 0b10100000 → white, black, white.
  const grey1 = decode(encodePng({ width: 3, height: 1, depth: 1, type: 0, rows: [[0b10100000]] }));
  assert.deepEqual([...grey1.data], [255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  checks++;

  const interlaced = encodePng({ width: 1, height: 1, type: 6, rows: [[1, 2, 3, 4]] });
  interlaced[8 + 8 + 12] = 1; // IHDR interlace byte (CRC is not checked by the decoder)
  assert.throws(() => decodePng(interlaced), /interlaced/);
  assert.throws(() => decodePng(Buffer.from("not a png")), /not a PNG/);
  checks++;
}

// ── fg: WCAG contrast decides white or black text ──
assert.equal(foregroundFor("#000000"), "light");
assert.equal(foregroundFor("#16181d"), "light");
assert.equal(foregroundFor("#ffffff"), "dark");
assert.equal(foregroundFor("#ffe101"), "dark");
assert.equal(foregroundFor("#e50012"), "light");
assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 1e-9);
checks += 6;

// ── bg rules ──
{
  // Opaque, one-colour border (a logo on its own panel): that colour, the logo blends in.
  const panel = decode(rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? WHITE : [7, 30, 120, 255])));
  assert.deepEqual(coverColors(panel), { bg: "#071e78", fg: "light", bg_from: "edge" });
  // A brand colour never replaces an opaque border.
  assert.equal(coverColors(panel, "#ff0000").bg_from, "edge");
  checks += 2;

  // Opaque but busy border (key visual): its mean colour.
  const busy = decode(rgbaPng(40, 24, (x, y) => ((x + y) % 2 ? WHITE : BLACK)));
  const mean = coverColors(busy);
  assert.equal(mean.bg_from, "mean");
  const [r, g, b] = fromHex(mean.bg);
  assert.ok(r > 100 && r < 160 && r === g && g === b, `mean of black / white is mid grey, got ${mean.bg}`);
  checks += 2;

  // Transparent border, red logo: a pale red tint (coloured, not grey), black text.
  const redLogo = decode(rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? RED : CLEAR)));
  const tint = coverColors(redLogo);
  assert.equal(tint.bg_from, "tint");
  assert.equal(tint.fg, "dark");
  const [tr, tg, tb] = fromHex(tint.bg);
  assert.ok(tr > 230 && tr - tg > 25 && Math.abs(tg - tb) < 12, `pale red, got ${tint.bg}`);
  // … unless brand-colors.json has a colour for it.
  assert.deepEqual(coverColors(redLogo, "#FFFFFF"), { bg: "#ffffff", fg: "dark", bg_from: "brand" });
  checks += 4;

  // Black logo on transparency: white, not grey. White logo: the dark tile.
  assert.equal(coverColors(decode(rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? BLACK : CLEAR)))).bg, "#ffffff");
  assert.deepEqual(coverColors(decode(rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? WHITE : CLEAR)))), { bg: "#16181d", fg: "light", bg_from: "tint" });
  checks += 2;

  // Light chromatic logo (pale yellow on transparency): the deep tint of its hue, white text.
  const pale = coverColors(decode(rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? [250, 240, 150, 255] : CLEAR))));
  assert.equal(pale.fg, "light");
  const [pr, pg, pb] = fromHex(pale.bg);
  assert.ok(pr < 110 && pr >= pb && pg > pb, `deep yellow, got ${pale.bg}`);
  checks += 2;
}

// ── Files: a cached PNG is read without Python; a JPEG without Pillow gives null (kept as is) ──
{
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-cover-colors-"));
  try {
    const png = path.join(dir, "logo.png");
    writeFileSync(png, rgbaPng(40, 24, (x, y) => (inLogo(x, y) ? RED : CLEAR)));
    assert.equal(readImagePixels(png).width, 40);
    assert.equal(coverFileColors(png, "#70BBE9").bg, "#70bbe9");
    const jpg = path.join(dir, "cover.jpg");
    writeFileSync(jpg, Buffer.from("ffd8ffe000104a464946", "hex"));
    assert.equal(coverFileColors(jpg), null);
    assert.equal(coverFileColors(path.join(dir, "missing.png")), null);
    checks += 4;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`cover colors: ${checks} checks passed`);
