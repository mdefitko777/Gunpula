// Tile colours of the Atlas covers: the app's 종류 / 세대 tiles are full-bleed squares (logo on its
// own brand colour, no white box), so every cover gets `bg` (#RRGGBB) and `fg` ("light" = white
// text / icons read better on bg, "dark" = black) next to it in data/atlas/atlas-covers.json.
//
// bg is chosen from the cached file only (no network):
//   edge   the outer border is opaque and nearly one colour → that colour (the logo then blends in)
//   mean   the border is opaque but busy (key visual, photo) → its average colour
//   brand  the border is transparent and data/atlas/brand-colors.json has a colour for the key
//   tint   the border is transparent → the logo's main colour (not white / black / grey) as a pale
//          tint (deep for a light logo); white for a black logo, never grey
// build_atlas_covers.mjs runs this for every cover on each run (`--colors-only` for just this step).
//
// PNG is decoded here with node:zlib (most covers; keeps the daily path and the tests free of
// Python); JPEG / WebP / GIF go through Python + Pillow, which the covers job already needs.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = "89504e470d0a1a0a";
// Border ring width in pixels: 2 px so JPEG ringing on the very edge does not decide alone.
const RING = 2;
// A border pixel counts as opaque from this alpha; the border is opaque when 95 % of it is.
const OPAQUE_ALPHA = 250;
const OPAQUE_SHARE = 0.95;
// "Nearly one colour": 90 % of the border within this RGB distance of its median colour.
const UNIFORM_DISTANCE = 28;
const UNIFORM_SHARE = 0.9;
// Tint: the main colour's hue at this lightness, with at least this saturation; deep for a
// light logo.
const TINT_LIGHTNESS = 0.9;
const DEEP_TINT_LIGHTNESS = 0.2;
const TINT_MIN_SATURATION = 0.45;
// Without a chromatic colour (a black or grey logo on transparency) the tile is white, not grey;
// a white logo gets the dark tile the covers job already puts behind white logos.
const LIGHT_NEUTRAL_BG = "#ffffff";
const DARK_NEUTRAL_BG = "#16181d";
// The logo reads on its tile when this share of its pixels has at least this contrast ratio to it.
const LEGIBLE_CONTRAST = 1.6;
const LEGIBLE_SHARE = 0.15;

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Non-interlaced PNG (any colour type, bit depth 1–16, palette + tRNS) → {width, height, data}
 * with data = RGBA bytes. Throws on what it does not handle (interlaced files go to Pillow).
 */
export function decodePng(buffer) {
  if (buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) throw new Error("not a PNG");
  let width = 0;
  let height = 0;
  let depth = 0;
  let type = 0;
  let palette = null;
  let trns = null;
  const idat = [];
  for (let at = 8; at + 8 <= buffer.length; ) {
    const length = buffer.readUInt32BE(at);
    const name = buffer.toString("latin1", at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (name === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      type = body[9];
      if (body[12]) throw new Error("interlaced PNG");
    } else if (name === "PLTE") palette = body;
    else if (name === "tRNS") trns = body;
    else if (name === "IDAT") idat.push(body);
    else if (name === "IEND") break;
    at += 12 + length;
  }
  if (!width || !height || !(type in CHANNELS)) throw new Error("unsupported PNG");
  const raw = inflateSync(Buffer.concat(idat));
  const bitsPerPixel = CHANNELS[type] * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const lines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? lines[out + x - bpp] : 0;
      const up = y ? lines[out - stride + x] : 0;
      const upLeft = y && x >= bpp ? lines[out - stride + x - bpp] : 0;
      const value = raw[src + x];
      const predicted = filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : filter === 4 ? paeth(left, up, upLeft) : 0;
      lines[out + x] = (value + predicted) & 255;
    }
  }
  // Sample n of a line as stored (palette index, or 0 … 2^depth - 1), then scaled to 0–255.
  const rawSample = (y, n) => {
    const row = y * stride;
    if (depth === 8) return lines[row + n];
    if (depth === 16) return lines.readUInt16BE(row + n * 2);
    const bit = n * depth;
    return (lines[row + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  const top = (1 << depth) - 1;
  const sample = (y, n) => Math.round((rawSample(y, n) * 255) / top);
  const data = new Uint8Array(width * height * 4);
  const n = CHANNELS[type];
  // tRNS of a grey image names the one grey value that is transparent.
  const grayKey = trns && type === 0 ? trns.readUInt16BE(0) : -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (type === 3) {
        const i = rawSample(y, x);
        data.set([palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], trns && i < trns.length ? trns[i] : 255], o);
      } else if (type === 0 || type === 4) {
        const g = sample(y, x * n);
        const alpha = type === 4 ? sample(y, x * n + 1) : rawSample(y, x) === grayKey ? 0 : 255;
        data.set([g, g, g, alpha], o);
      } else {
        data.set([sample(y, x * n), sample(y, x * n + 1), sample(y, x * n + 2), type === 6 ? sample(y, x * n + 3) : 255], o);
      }
    }
  }
  return { width, height, data };
}

// Pillow → "<width> <height>\n" + RGBA bytes on stdout.
const PY_RGBA = String.raw`
import sys
from PIL import Image
im = Image.open(sys.argv[1])
im.load()
im = im.convert("RGBA")
out = sys.stdout.buffer
out.write(("%d %d\n" % im.size).encode())
out.write(im.tobytes())
`;

/** Pixels of a cached cover, or null when it cannot be decoded here (no Pillow for a JPEG …). */
export function readImagePixels(file, python = null) {
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 8).toString("hex") === PNG_SIGNATURE) {
    try {
      return decodePng(bytes);
    } catch {
      // Interlaced or odd PNGs fall through to Pillow.
    }
  }
  if (!python) return null;
  const res = spawnSync(python, ["-I", "-c", PY_RGBA, file], { maxBuffer: 256 * 1024 * 1024 });
  if (res.status !== 0) return null;
  const newline = res.stdout.indexOf(10);
  const [width, height] = res.stdout.toString("latin1", 0, newline).split(" ").map(Number);
  return { width, height, data: new Uint8Array(res.stdout.subarray(newline + 1)) };
}

export const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
export const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** WCAG 2 relative luminance of a #RRGGBB colour. */
export function luminance(hex) {
  const [r, g, b] = fromHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** "light" when white text has the higher WCAG contrast on bg, else "dark". */
export function foregroundFor(hex) {
  const l = luminance(hex);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? "light" : "dark";
}

function borderPixels({ width, height, data }) {
  const ring = Math.max(1, Math.min(RING, Math.floor(Math.min(width, height) / 4)));
  const out = [];
  for (let y = 0; y < height; y++) {
    const edgeRow = y < ring || y >= height - ring;
    for (let x = 0; x < width; x++) {
      if (!edgeRow && x >= ring && x < width - ring) {
        x = width - ring - 1;
        continue;
      }
      const o = (y * width + x) * 4;
      out.push([data[o], data[o + 1], data[o + 2], data[o + 3]]);
    }
  }
  return out;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (pixels) => [0, 1, 2].map((c) => pixels.reduce((sum, p) => sum + p[c], 0) / pixels.length);

/** Border of the image: {opaque, uniform, color} (color = mean of the border, or of its main colour when uniform). */
export function edgeColor(image) {
  const border = borderPixels(image);
  const opaque = border.filter((p) => p[3] >= OPAQUE_ALPHA);
  if (opaque.length < border.length * OPAQUE_SHARE) return { opaque: false, uniform: false, color: null };
  const mid = [0, 1, 2].map((c) => median(opaque.map((p) => p[c])));
  const close = opaque.filter((p) => distance(p, mid) <= UNIFORM_DISTANCE);
  const uniform = close.length >= opaque.length * UNIFORM_SHARE;
  return { opaque: true, uniform, color: toHex(mean(uniform ? close : opaque)) };
}

function rgbToHsl([r, g, b]) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => v * 255);
}

/**
 * Main chromatic colour of the visible pixels (white, black and greys left out), as #RRGGBB,
 * or "" when the image has none. Pixels are counted in 4-bit-per-channel buckets.
 */
export function dominantColor({ data }) {
  const buckets = new Map();
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < 128) continue;
    const px = [data[o], data[o + 1], data[o + 2]];
    const max = Math.max(...px);
    const min = Math.min(...px);
    if (max < 48 || min > 224 || max - min < 40) continue;
    const key = ((px[0] >> 4) << 8) | ((px[1] >> 4) << 4) | (px[2] >> 4);
    const bucket = buckets.get(key) || buckets.set(key, { n: 0, sum: [0, 0, 0] }).get(key);
    bucket.n++;
    for (let c = 0; c < 3; c++) bucket.sum[c] += px[c];
  }
  let best = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  return best ? toHex(best.sum.map((v) => v / best.n)) : "";
}

/** The colour's hue as a tint at `lightness` (pale by default; never grey). */
export function tintOf(hex, lightness = TINT_LIGHTNESS) {
  const [h, s] = rgbToHsl(fromHex(hex));
  return toHex(hslToRgb([h, Math.min(0.9, Math.max(TINT_MIN_SATURATION, s)), lightness]));
}

/** WCAG contrast ratio of two #RRGGBB colours. */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Share of the visible pixels that stand out from bg. Measured on the transparent logos
 * (2026-11-20): every one of them is at 0.26 (yellow Mixels letters, black rim) or more on its
 * pale tint; a white logo on transparency would be near 0 and gets a deep tile instead.
 */
export function legibleShare({ data }, bg) {
  let visible = 0;
  let standsOut = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < 128) continue;
    visible++;
    if (contrast(toHex([data[o], data[o + 1], data[o + 2]]), bg) >= LEGIBLE_CONTRAST) standsOut++;
  }
  return visible ? standsOut / visible : 1;
}

/** {bg, fg, bg_from} for decoded pixels; `brand` is the curated colour of this cover, if any. */
export function coverColors(image, brand = "") {
  const edge = edgeColor(image);
  let bg;
  let from;
  if (edge.opaque) [bg, from] = [edge.color, edge.uniform ? "edge" : "mean"];
  else if (brand) [bg, from] = [brand.toLowerCase(), "brand"];
  else {
    const main = dominantColor(image);
    bg = main ? tintOf(main) : LIGHT_NEUTRAL_BG;
    // A light logo would vanish on a pale tile: the same hue, deep, instead.
    if (legibleShare(image, bg) < LEGIBLE_SHARE) bg = main ? tintOf(main, DEEP_TINT_LIGHTNESS) : DARK_NEUTRAL_BG;
    from = "tint";
  }
  return { bg, fg: foregroundFor(bg), bg_from: from };
}

/** coverColors of a cached file, or null when the file is missing or cannot be decoded here. */
export function coverFileColors(file, brand = "", python = null) {
  if (!existsSync(file)) return null;
  const image = readImagePixels(file, python);
  return image ? coverColors(image, brand) : null;
}
