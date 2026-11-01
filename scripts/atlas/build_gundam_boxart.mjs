#!/usr/bin/env node
// Gundam box-art picker for Hobby Atlas.
//
// For every gundam item in data/split/kits-gundam.json, pick the image URL that shows
// the retail package (箱絵 / パッケージ) so the app can show it first. The catalog's
// `images.box_art_url` is usually a product photo despite its name.
//
// How a package image is recognised (checked by eye on ~500 samples, 2026-11-01):
//   * BANDAI SPIRITS product pages (www.bandaispirits.co.jp/products) list the kit's
//     images on bandai-a.akamaihd.net as <p-bandai item id>_1.._N. Once a kit is on
//     sale the box scan is added as the LAST image (older MG pages put it FIRST).
//     Upcoming kits have product photos only.
//   * Those images are padded to a white square, so a flat box scan shows up as a
//     full-width (or full-height) rectangle between symmetric pure-white bands, while
//     product photos fill the square with a studio background. A tiny built-in
//     baseline-JPEG decoder reads the 200 px "m" size and tests exactly that, plus a
//     box-like aspect ratio. Padded group photos ("集合イメージ") on a studio background
//     are the remaining look-alikes; the share of flat blocks sets the confidence.
//   * Premium Bandai items use the same CDN; p-bandai.jp answers bots with a JS
//     challenge, so the image count is found with HEAD probes on the CDN instead.
//     Only plastic kits are looked at (decals, cards, videos and goods have no box).
//   * Bandai Candy (食玩) pages carry the package in <p class="specPkg"> (pkg.png); a
//     sub-item linked as page#id uses the specPkg of its own section.
//   * Gashapon: 【箱売】 sets show the shipping box as image _1 (older items: _2), found
//     by a box-pair pixel check; other capsule sets get the machine's DP card (台紙)
//     with kind "dp", since capsule toys have no box.
//   * Gunplapedia infobox box art (joined by JAN) would cover older kits, but its image
//     host answers non-browser clients with a Cloudflare challenge; the join only runs
//     when a one-request probe gets an image back.
//   * Not covered: TAMASHII figures (no package shots published), WEB取説 / Bandai Hobby
//     Site images (bandai-hobby.net: HTML or expiring signed URLs).
//
// Output: data/atlas/gundam-boxart.json, compact JSON, hotlinked URLs only:
//   {schema:1, updated_at, kinds{}, sources[], not_covered{}, boxart:{kit_id:{url, source,
//    confidence: high|medium|low, kind?: "dp"|"maybe"}}, stats:{kits, with_box, with_dp,
//    with_maybe, premium_bandai, by_grade:{grade:{kits, with_box, with_dp?, with_maybe?}},
//    by_source}}
// Only entries WITHOUT a kind are box art (confidence high or medium). kind "dp" is a
// gashapon DP card; kind "maybe" is a low-confidence pick (~4 in 5 are boxes) that the app
// must not show as box art. The file's "kinds" field says the same.
// Akamai URLs use the 500 px "/b/" size; replace "/b/" with "/xl/" for 1200 px.
//
// Network: one descriptive UA, <= 1 request per second per host (slots are reserved
// before sleeping, so concurrent workers queue), every answer cached under ATLAS_CACHE_DIR
// (default tmp/atlas-cache/gundam-boxart, gitignored); product pages are cached as the few
// tags the pickers read, not as whole HTML. 401/403/429/451, challenge pages and images
// that come back as HTML are refusals: never cached, the kit keeps the previous file's
// entry, and after 3 of them the host gets no more requests this run. Offline, over-budget
// and 5xx answers also keep the previous entry. With --guard (CI) the file is not written
// when any host refused us or the entry count fell more than 5% (--allow-drop overrides).
//
// Usage:
//   node scripts/atlas/build_gundam_boxart.mjs [--budget=N] [--check=N] [--offline]
//        [--only=bs,pb,candy,gashapon,gunplapedia] [--out=FILE] [--report=FILE]
//        [--kits=FILE] [--guard] [--allow-drop] [--workers=N]
//   node scripts/atlas/test_gundam_boxart.mjs   # offline self-test

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const MIN_GAP_MS = Number(process.env.ATLAS_MIN_GAP_MS || 1050);
const TIMEOUT_MS = Number(process.env.ATLAS_TIMEOUT_MS || 30000);
const CACHE_DIR = path.resolve(process.env.ATLAS_CACHE_DIR || path.join(ROOT, "tmp", "atlas-cache", "gundam-boxart"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "1"] : [a, "1"];
  }),
);
const OFFLINE = args.offline === "1" || process.env.ATLAS_OFFLINE === "1";
// Max live (uncached) requests per host in one run; the rest wait for the next run.
const BUDGET = Number(args.budget || process.env.ATLAS_BUDGET || 4000);
const TODAY = (args.today || new Date().toISOString()).slice(0, 10);

const DAY = 86400000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Polite HTTP with an on-disk cache: <cache>/<host>/<sha1(method+url)>.{body,meta.json}
// (GET keys are sha1(url) so research-time caches are reused as-is.)

const lastHit = new Map();
const hostStats = new Map();
function hs(host) {
  if (!hostStats.has(host))
    hostStats.set(host, { live: 0, cached: 0, errors: 0, skipped_budget: 0, blocked: 0, unexpected: 0, probe_blocked: 0, skipped_blocked: 0 });
  return hostStats.get(host);
}
export const hostReport = () => Object.fromEntries([...hostStats.entries()].sort());

// A host that answers like this is refusing us (or showing a bot wall), not saying
// "this item has no image": the answer is unknown, never cached, and the kit keeps its
// previous entry. After BLOCK_TRIP such answers the host gets no more requests this run.
const BLOCKED_STATUS = new Set([401, 403, 429, 451]);
const BLOCK_TRIP = Number(process.env.ATLAS_BLOCK_TRIP || 3);
const CHALLENGE_RE =
  /cf-chl|challenge-platform|cf_chl_opt|<title>\s*Just a moment|Attention Required! \| Cloudflare|g-recaptcha|h-captcha|hcaptcha\.com|_Incapsula_Resource|Incapsula incident|awswaf|AwsWafIntegration|<title>\s*Access Denied|Request unsuccessful|Pardon Our Interruption|px-captcha|datadome/i;

/**
 * Why a response is a refusal rather than an answer, or null when it is a real answer.
 * expect: "image" (a 200 must be image/*) or a RegExp a real 200 HTML page contains.
 * Returns {kind: "blocked"|"unexpected", why}.
 */
export function refusal(status, contentType, body, expect) {
  if (BLOCKED_STATUS.has(status)) return { kind: "blocked", why: `${status} ${String(contentType).split(";")[0]}`.trim() };
  if (status !== 200) return null;
  if (expect === "image") return /^image\//i.test(contentType) ? null : { kind: "blocked", why: `200 ${String(contentType).split(";")[0] || "?"} instead of an image` };
  if (!body || !/html|^text\//i.test(contentType)) return null;
  const s = body.toString("utf8");
  if (CHALLENGE_RE.test(s)) return { kind: "blocked", why: "challenge page" };
  if (expect instanceof RegExp && !expect.test(s)) return { kind: "unexpected", why: "page without the expected markup" };
  return null;
}

/** Fragments never reach the server; one cache entry per page. */
const stripHash = (url) => {
  const u = new URL(url);
  u.hash = "";
  return u.href;
};

function cachePath(method, url) {
  const key = method === "GET" ? url : `${method} ${url}`;
  const h = createHash("sha1").update(key).digest("hex");
  return path.join(CACHE_DIR, new URL(url).hostname, h);
}

async function readCached(file, wantBody) {
  try {
    const meta = JSON.parse(await readFile(`${file}.meta.json`, "utf8"));
    const body = wantBody ? await readFile(`${file}.body`) : null;
    return { meta, body };
  } catch {
    return null;
  }
}

/** Reserve this host's next slot first, then sleep, so concurrent workers queue up. */
export async function throttle(host) {
  const now = Date.now();
  const at = Math.max(now, (lastHit.get(host) || 0) + MIN_GAP_MS);
  lastHit.set(host, at);
  if (at > now) await sleep(at - now);
}

const tripped = (host) => hs(host).blocked >= BLOCK_TRIP;

/**
 * Fetch with cache. Returns {status, contentType, length, body (Buffer|null), fetchedAt, cached}
 * or null when the answer is unknown (offline, over budget, network error, 5xx, refused or
 * challenged) and nothing usable is cached.
 * maxAgeDays: cached entries younger than this are used without a request.
 * expect: see refusal(). extract: (html) => smaller text kept in the cache instead of the
 * page (callers parse both forms the same way). probe: a refusal is expected and harmless
 * (counted apart, never trips the host).
 */
export async function fetchCached(rawUrl, { method = "GET", maxAgeDays = 30, expect, extract, probe = false } = {}) {
  const url = stripHash(rawUrl);
  const host = new URL(url).hostname;
  const file = cachePath(method, url);
  const wantBody = method === "GET";
  let cached = await readCached(file, wantBody);
  // Refusals cached by older versions of this script are not answers: ignore them.
  if (cached && (BLOCKED_STATUS.has(cached.meta.status) || (!cached.meta.extracted && refusal(cached.meta.status, cached.meta.content_type || "", cached.body, expect)))) cached = null;
  const fresh = cached && Date.now() - Date.parse(cached.meta.fetched_at) < maxAgeDays * DAY;
  const asResult = (c, isCached) => ({
    status: c.meta.status,
    contentType: c.meta.content_type || "",
    length: c.meta.length ?? c.meta.bytes ?? null,
    body: c.body,
    location: c.meta.location,
    fetchedAt: c.meta.fetched_at,
    cached: isCached,
  });
  const stale = () => (cached ? asResult(cached, true) : null);
  if (cached && (fresh || OFFLINE)) {
    hs(host).cached++;
    return asResult(cached, true);
  }
  if (tripped(host)) {
    hs(host).skipped_blocked++;
    return stale();
  }
  if (OFFLINE || hs(host).live >= BUDGET) {
    hs(host).skipped_budget++;
    return stale();
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    hs(host).live++;
    await throttle(host);
    if (tripped(host)) {
      hs(host).live--; // another worker tripped the host while this one waited
      hs(host).skipped_blocked++;
      return stale();
    }
    try {
      const res = await fetch(url, {
        method,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: wantBody ? "*/*" : "image/*,*/*;q=0.5" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      let body = wantBody ? Buffer.from(await res.arrayBuffer()) : null;
      const contentType = res.headers.get("content-type") || "";
      if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await sleep(5000 * attempt);
        continue;
      }
      const ref = refusal(res.status, contentType, body, expect);
      if (ref) {
        const s = hs(host);
        if (probe) s.probe_blocked++;
        else s[ref.kind]++;
        s.last_refusal = ref.why;
        return stale();
      }
      if (res.status >= 500) {
        hs(host).errors++; // transient: never cached; callers keep the previous answer
        return stale();
      }
      const meta = {
        url,
        method,
        status: res.status,
        content_type: contentType,
        length: body ? body.length : Number(res.headers.get("content-length") || 0) || null,
        location: res.headers.get("location") || undefined,
        fetched_at: new Date().toISOString(),
      };
      if (extract && body && res.status === 200) {
        body = Buffer.from(extract.fn(body.toString("utf8")), "utf8");
        meta.extracted = extract.id;
      }
      await mkdir(path.dirname(file), { recursive: true });
      if (body) await writeFile(`${file}.body`, body);
      await writeFile(`${file}.meta.json`, JSON.stringify(meta));
      return { status: meta.status, contentType: meta.content_type, length: meta.length, body, location: meta.location, fetchedAt: meta.fetched_at, cached: false };
    } catch (err) {
      if (attempt < 3) {
        await sleep(3000 * attempt);
        continue;
      }
      hs(host).errors++;
      return stale(); // network error: unknown, not "missing"
    }
  }
  return null;
}

/** fetchCached + follow up to 3 same-site redirects. */
export async function fetchFollow(url, opts = {}) {
  let u = url;
  for (let i = 0; i < 4; i++) {
    const r = await fetchCached(u, opts);
    if (!r || ![301, 302, 303, 307, 308].includes(r.status) || !r.location) return r ? { ...r, finalUrl: u } : r;
    const next = new URL(r.location, u);
    if (next.hostname.split(".").slice(-2).join(".") !== new URL(u).hostname.split(".").slice(-2).join(".")) return { ...r, finalUrl: u };
    u = next.href;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Minimal baseline-JPEG luminance decoder (no dependencies).
// Only what the box detector needs: the Y channel of baseline (SOF0/SOF1) Huffman JPEGs.
// Progressive / arithmetic JPEGs return null (the caller treats the image as unknown).

const ZIGZAG = new Int32Array([
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
]);
const IDCT_COS = (() => {
  const t = new Float64Array(64);
  for (let x = 0; x < 8; x++) for (let u = 0; u < 8; u++) t[x * 8 + u] = (u === 0 ? Math.SQRT1_2 : 1) * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
  return t;
})();

function buildHuffman(bits, vals) {
  // canonical Huffman tables: maxcode / valptr / mincode per code length (ITU T.81 F.2.2.3)
  const maxcode = new Int32Array(18).fill(-1);
  const valptr = new Int32Array(17);
  const mincode = new Int32Array(17);
  let code = 0;
  let k = 0;
  for (let l = 1; l <= 16; l++) {
    valptr[l] = k;
    mincode[l] = code;
    code += bits[l - 1];
    k += bits[l - 1];
    maxcode[l] = bits[l - 1] ? code - 1 : -1;
    code <<= 1;
  }
  return { maxcode, valptr, mincode, vals };
}

export function decodeJpegLuma(buf) {
  const d = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8) return null;
  const qt = [];
  const dcT = [];
  const acT = [];
  let frame = null;
  let restart = 0;
  let p = 2;
  while (p + 3 < d.length) {
    if (d[p] !== 0xff) return null;
    const marker = d[p + 1];
    if (marker === 0xff) {
      p++;
      continue;
    }
    p += 2;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (marker === 0xd9) break;
    const len = (d[p] << 8) | d[p + 1];
    const seg = p + 2;
    const end = p + len;
    if (marker === 0xdb) {
      let q = seg;
      while (q < end) {
        const pq = d[q] >> 4;
        const tq = d[q] & 15;
        q++;
        const table = new Int32Array(64);
        for (let i = 0; i < 64; i++) {
          table[i] = pq ? (d[q] << 8) | d[q + 1] : d[q];
          q += pq ? 2 : 1;
        }
        qt[tq] = table;
      }
    } else if (marker === 0xc4) {
      let q = seg;
      while (q < end) {
        const tc = d[q] >> 4;
        const th = d[q] & 15;
        q++;
        const bits = d.subarray(q, q + 16);
        q += 16;
        let n = 0;
        for (let i = 0; i < 16; i++) n += bits[i];
        const vals = d.slice(q, q + n);
        q += n;
        (tc === 0 ? dcT : acT)[th] = buildHuffman(bits, vals);
      }
    } else if (marker === 0xc0 || marker === 0xc1) {
      const height = (d[seg + 1] << 8) | d[seg + 2];
      const width = (d[seg + 3] << 8) | d[seg + 4];
      const nc = d[seg + 5];
      const comps = [];
      for (let i = 0; i < nc; i++) {
        const o = seg + 6 + i * 3;
        comps.push({ id: d[o], h: d[o + 1] >> 4, v: d[o + 1] & 15, tq: d[o + 2], pred: 0 });
      }
      if (!width || !height || !comps.length) return null;
      frame = { width, height, comps };
    } else if (marker >= 0xc2 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return null; // progressive, lossless or arithmetic coding: unsupported
    } else if (marker === 0xdd) {
      restart = (d[seg] << 8) | d[seg + 1];
    } else if (marker === 0xda) {
      if (!frame) return null;
      const ns = d[seg];
      const scomps = [];
      for (let i = 0; i < ns; i++) {
        const c = frame.comps.find((x) => x.id === d[seg + 1 + i * 2]);
        if (!c) return null;
        const t = d[seg + 2 + i * 2];
        c.dc = dcT[t >> 4];
        c.ac = acT[t & 15];
        scomps.push(c);
      }
      if (scomps.some((c) => !c.dc || !c.ac || !qt[c.tq])) return null;
      try {
        return decodeScan(d, end, frame, scomps, qt, restart);
      } catch {
        return null;
      }
    }
    p = end;
  }
  return null;
}

function decodeScan(d, start, frame, scomps, qt, restart) {
  const { width, height, comps } = frame;
  const hmax = Math.max(...comps.map((c) => c.h));
  const vmax = Math.max(...comps.map((c) => c.v));
  const out = new Uint8Array(width * height);
  const luma = comps[0];
  let pos = start;
  let bitBuf = 0;
  let bitCnt = 0;
  let hitMarker = false;
  const readBit = () => {
    if (bitCnt === 0) {
      let b = 0;
      if (!hitMarker && pos < d.length) {
        b = d[pos++];
        if (b === 0xff) {
          if (d[pos] === 0) pos++;
          else {
            hitMarker = true;
            pos--;
            b = 0;
          }
        }
      }
      bitBuf = b;
      bitCnt = 8;
    }
    bitCnt--;
    return (bitBuf >> bitCnt) & 1;
  };
  const receive = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | readBit();
    return v;
  };
  const extend = (v, n) => (n === 0 ? 0 : v < 1 << (n - 1) ? v - (1 << n) + 1 : v);
  const decodeHuff = (t) => {
    let code = 0;
    for (let l = 1; l <= 16; l++) {
      code = (code << 1) | readBit();
      if (t.maxcode[l] >= 0 && code <= t.maxcode[l]) return t.vals[t.valptr[l] + code - t.mincode[l]];
    }
    return 0;
  };
  const coef = new Float64Array(64);
  const tmp = new Float64Array(64);
  const decodeBlock = (c, keep, bx, by) => {
    coef.fill(0);
    const q = qt[c.tq];
    const t = decodeHuff(c.dc);
    c.pred += extend(receive(t), t);
    coef[0] = c.pred * q[0];
    for (let k = 1; k < 64; ) {
      const rs = decodeHuff(c.ac);
      const r = rs >> 4;
      const s = rs & 15;
      if (s === 0) {
        if (r === 15) {
          k += 16;
          continue;
        }
        break;
      }
      k += r;
      if (k > 63) break;
      coef[ZIGZAG[k]] = extend(receive(s), s) * q[k];
      k++;
    }
    if (!keep) return;
    // separable 8x8 inverse DCT: rows (u -> x), then columns (v -> y)
    for (let v = 0; v < 8; v++)
      for (let x = 0; x < 8; x++) {
        let s = 0;
        for (let u = 0; u < 8; u++) s += IDCT_COS[x * 8 + u] * coef[v * 8 + u];
        tmp[v * 8 + x] = s;
      }
    for (let y = 0; y < 8; y++) {
      const py = by + y;
      if (py >= height) break;
      for (let x = 0; x < 8; x++) {
        const px = bx + x;
        if (px >= width) continue;
        let s = 0;
        for (let v = 0; v < 8; v++) s += IDCT_COS[y * 8 + v] * tmp[v * 8 + x];
        const val = Math.round(s / 4 + 128);
        out[py * width + px] = val < 0 ? 0 : val > 255 ? 255 : val;
      }
    }
  };
  const restartNow = () => {
    bitCnt = 0;
    hitMarker = false;
    while (pos + 1 < d.length && !(d[pos] === 0xff && d[pos + 1] >= 0xd0 && d[pos + 1] <= 0xd7)) pos++;
    pos += 2;
    for (const c of scomps) c.pred = 0;
  };
  let n = 0;
  if (scomps.length === 1) {
    const c = scomps[0];
    const bw = Math.ceil(Math.ceil((width * c.h) / hmax) / 8);
    const bh = Math.ceil(Math.ceil((height * c.v) / vmax) / 8);
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        if (restart && n && n % restart === 0) restartNow();
        decodeBlock(c, c === luma, bx * 8, by * 8);
        n++;
      }
    return c === luma ? { width, height, data: out } : null;
  }
  const mcux = Math.ceil(width / (8 * hmax));
  const mcuy = Math.ceil(height / (8 * vmax));
  for (let my = 0; my < mcuy; my++)
    for (let mx = 0; mx < mcux; mx++) {
      if (restart && n && n % restart === 0) restartNow();
      for (const c of scomps)
        for (let v = 0; v < c.v; v++) for (let h = 0; h < c.h; h++) decodeBlock(c, c === luma, (mx * c.h + h) * 8, (my * c.v + v) * 8);
      n++;
    }
  return { width, height, data: out };
}

// ---------------------------------------------------------------------------
// Box detector. BANDAI product images are padded to a white square; a scanned
// box front shows up as a full-width (landscape box) or full-height (portrait box)
// rectangle with symmetric pure-white bands, while product photos fill the square
// with a studio background. Returns {shape: "landscape"|"portrait"|null, bands, aspect}.

const FLAT_MAX = 0.18;

export function letterbox(img, { thr = 240, frac = 0.97 } = {}) {
  const { width: W, height: H, data } = img;
  const rowWhite = (y) => {
    let n = 0;
    for (let x = 0; x < W; x++) if (data[y * W + x] >= thr) n++;
    return n / W;
  };
  const colWhite = (x) => {
    let n = 0;
    for (let y = 0; y < H; y++) if (data[y * W + x] >= thr) n++;
    return n / H;
  };
  let t = 0;
  while (t < H && rowWhite(t) >= frac) t++;
  let b = 0;
  while (b < H - t && rowWhite(H - 1 - b) >= frac) b++;
  let l = 0;
  while (l < W && colWhite(l) >= frac) l++;
  let r = 0;
  while (r < W - l && colWhite(W - 1 - r) >= frac) r++;
  const m = Math.max(2, Math.round(W * 0.02));
  const sym = (a, c) => Math.abs(a - c) <= Math.max(m, 0.2 * (a + c));
  // A box whose own art is white along one side (e.g. HG Witch from Mercury) widens that
  // band; accept it when the narrower band ends in a straight, full-width box edge.
  const rowInk = (y) => 1 - rowWhite(y);
  const colInk = (x) => 1 - colWhite(x);
  const edgeRow = (y0, dir) => Math.min(rowInk(y0 + dir * 2), rowInk(y0 + dir * 3)) >= 0.9;
  const edgeCol = (x0, dir) => Math.min(colInk(x0 + dir * 2), colInk(x0 + dir * 3)) >= 0.9;
  const landEdge = t <= b ? edgeRow(t, 1) : edgeRow(H - 1 - b, -1);
  const portEdge = l <= r ? edgeCol(l, 1) : edgeCol(W - 1 - r, -1);
  const landscape = Math.min(t, b) >= 2 * m && l <= m && r <= m && Math.max(t, b) < H * 0.45 && (sym(t, b) || landEdge);
  const portrait = !landscape && Math.min(l, r) >= 2 * m && t <= m && b <= m && Math.max(l, r) < W * 0.45 && (sym(l, r) || portEdge);
  const aspect = Math.round(((W - l - r) / Math.max(1, H - t - b)) * 100) / 100;
  // White-bordered box art (HG Witch from Mercury): the side columns are white too, but
  // the top/bottom bands stay deep, symmetric and give a typical box aspect ratio.
  const soft = !landscape && !portrait && Math.min(t, b) >= 6 * m && Math.max(l, r) <= 2 * m && sym(t, b) && aspect >= 1.2 && aspect <= 2;
  // Product photos shot in portrait/landscape framing are padded the same way, but most of
  // their 8x8 blocks are flat studio background; box art is busy (measured: boxes <= 0.12,
  // padded product photos >= 0.24 of blocks with std < 2.5).
  let blocks = 0;
  let flat = 0;
  for (let by = t + 4; by + 8 <= H - b - 4; by += 8)
    for (let bx = l + 4; bx + 8 <= W - r - 4; bx += 8) {
      let s1 = 0;
      let s2 = 0;
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const v = data[(by + y) * W + bx + x];
          s1 += v;
          s2 += v * v;
        }
      blocks++;
      if (s2 / 64 - (s1 / 64) ** 2 < 2.5 * 2.5) flat++;
    }
  const smooth = blocks ? Math.round((flat / blocks) * 100) / 100 : 1;
  const framed = landscape || soft ? "landscape" : portrait ? "portrait" : null;
  // Gunpla boxes are 1.24–1.85 wide (landscape) or 0.55–0.84 (portrait). Near-square
  // frames (photo collages, card sheets) and very tall ones (merch photos) are not boxes.
  const boxAspect = framed === "landscape" ? aspect >= 1.2 : framed === "portrait" ? aspect >= 0.5 : false;
  const shape = framed && boxAspect && smooth < FLAT_MAX ? framed : null;
  return { shape, framed, soft, smooth, bands: [t, b, l, r], aspect };
}

// Confidence from the flat-block share: in the eye-checked samples every pick under 0.06
// was a box, 0.06–0.12 had ~2% group-photo look-alikes, 0.12–0.18 about one in four.
const LEVELS = ["high", "medium", "low"];
export function confidenceFor(a, base) {
  let i = LEVELS.indexOf(base);
  if (a.soft) i++;
  if (a.smooth >= 0.12) i = 2;
  else if (a.smooth >= 0.06) i++;
  return LEVELS[Math.min(2, i)];
}

// Box-sold gashapon sets are shot as two boxes (front + back) on white: one wide, solid
// band of ink about half the image tall. A single figure is taller and less solid.
// Measured on 52 eye-checked images: boxes solid >= 0.55 (one 0.44), figures <= 0.53.
export function boxPairShot(img, thr = 235) {
  const { width: W, height: H, data } = img;
  let x0 = W;
  let x1 = -1;
  let y0 = H;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[y * W + x] < thr) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { box: false };
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  let solidRows = 0;
  for (let y = y0; y <= y1; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) if (data[y * W + x] < thr) c++;
    if (c / bw >= 0.6) solidRows++;
  }
  const solid = solidRows / bh;
  return { box: solid >= 0.5 && bh / H <= 0.56 && bw / W >= 0.74, solid: Math.round(solid * 100) / 100, bw: bw / W, bh: bh / H };
}

// ---------------------------------------------------------------------------
// Catalog helpers

const AKAMAI = "https://bandai-a.akamaihd.net/bc/img/model";
const AKAMAI_RE = /bandai-a\.akamaihd\.net\/+bc\/img\/model\/(?:xl|b|m|s)\/(\d+)_(\d+)\.jpg/;
const akamaiUrl = (id, i, size = "b") => `${AKAMAI}/${size}/${id}_${i}.jpg`;
const BS_DETAIL_RE = /^https:\/\/www\.bandaispirits\.co\.jp\/products\/search\/detail\.php\?prd_id=\d+/;
const CANDY_RE = /^https:\/\/www\.bandai\.co\.jp\/candy\//;

// Hosts / URL shapes that never load for a plain client (no Referer, no cookies).
const DEAD_URL = [
  /internal-pbn/i,
  /[?&]Expires=/, // expired CloudFront signatures (bandai-hobby.net product images)
  /^https?:\/\/www\.goodsmile\.com\//, // 503 bot wall
  /^https?:\/\/([a-z0-9-]+\.)*bandai-hobby\.net\//, // 403 / HTML instead of images
  /^https?:\/\/pokemon\.hgodo\.com\//, // 302 to a login page
];
export const isDeadUrl = (u) => !/^https:\/\//.test(String(u)) || DEAD_URL.some((re) => re.test(u));

function akamaiIdFrom(urls) {
  for (const u of urls || []) {
    const m = String(u).match(AKAMAI_RE);
    if (m) return m[1];
  }
  return null;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  const t = Date.parse(s.length === 7 ? `${s}-01` : s.length === 4 ? `${s}-01-01` : s);
  return Number.isNaN(t) ? null : (Date.parse(TODAY) - t) / DAY;
}

// Re-check cadence: settled (released > 1 year) items rarely change.
function pageTtl(kit) {
  const age = daysSince(kit.release_date);
  return age !== null && age > 365 ? 120 : 7;
}

// ---------------------------------------------------------------------------
// Image analysis (akamai product images are white-padded squares; "m" = 200 px)

const analysisCache = new Map();
async function analyzeAkamai(id, i, analyse = letterbox) {
  const key = `${id}_${i}_${analyse.name}`;
  if (analysisCache.has(key)) return analysisCache.get(key);
  const r = await fetchCached(akamaiUrl(id, i, "m"), { maxAgeDays: 180, expect: "image" });
  let out;
  if (!r) out = { unknown: true };
  else if (r.status !== 200 || !/^image\/jpe?g/.test(r.contentType || "image/jpeg")) out = { missing: true, status: r.status };
  else {
    const img = decodeJpegLuma(r.body);
    out = img ? analyse(img) : { unknown: true };
  }
  analysisCache.set(key, out);
  return out;
}

/**
 * Given the ordered image indices of one akamai item, return the package image:
 * the LAST image if it is a white-padded box scan, else the FIRST (older MG pages).
 * opts.first=false skips the first-image fallback; opts.maxSmooth tightens the
 * flat-background limit.
 */
async function pickAkamaiPackage(id, indices, sourcePrefix, { first: allowFirst = true, maxSmooth = FLAT_MAX } = {}) {
  if (!indices.length) return { none: "no-images" };
  const last = indices[indices.length - 1];
  const first = indices[0];
  const ok = (a) => a.shape && a.smooth < maxSmooth;
  let unknown = false;
  if (indices.length >= 2 || !allowFirst) {
    const a = await analyzeAkamai(id, last);
    if (ok(a)) return { url: akamaiUrl(id, last), source: `${sourcePrefix}_last`, confidence: confidenceFor(a, "high"), shape: a.shape };
    unknown ||= !!a.unknown;
  }
  if (allowFirst && (first !== last || indices.length === 1)) {
    const a = await analyzeAkamai(id, first);
    if (ok(a)) return { url: akamaiUrl(id, first), source: `${sourcePrefix}_first`, confidence: confidenceFor(a, "medium"), shape: a.shape };
    unknown ||= !!a.unknown;
  }
  return unknown ? { unknown: true } : { none: "no-letterboxed-image" };
}

// --- BANDAI SPIRITS product pages -----------------------------------------

// Only the slider <img> tags are kept in the cache (a product page is ~120 KB).
const BS_SLIDER_RE = /l_productsSlider__item"><img src="([^"]+)"/g;
export const BS_EXTRACT = {
  id: "bs-slider-1",
  fn: (html) => `<!--atlas:bs-slider-1-->\n${[...html.matchAll(BS_SLIDER_RE)].map((m) => `<li class="l_productsSlider__item"><img src="${m[1]}"></li>`).join("\n")}\n`,
};

async function pickBandaiSpirits(kit) {
  const page = (kit.source_urls || []).find((u) => BS_DETAIL_RE.test(u));
  if (!page) return null;
  const r = await fetchFollow(page, { maxAgeDays: pageTtl(kit), expect: /l_productsSlider/, extract: BS_EXTRACT });
  if (!r) return { unknown: true };
  if (r.status !== 200 || !r.body) return { none: `page-${r.status}` };
  const html = r.body.toString("utf8");
  const slider = [...html.matchAll(BS_SLIDER_RE)].map((m) => m[1].match(AKAMAI_RE)).filter(Boolean);
  if (!slider.length) return { none: "no-slider" };
  const id = slider[0][1];
  const indices = slider.filter((m) => m[1] === id).map((m) => Number(m[2]));
  return pickAkamaiPackage(id, indices, "bandai_spirits");
}

// --- Premium Bandai items (p-bandai.jp serves a JS challenge to bots, so count the
//     akamai images directly: galloping HEAD probes on the 100 px size) -------------

async function akamaiExists(id, i, ttl) {
  const r = await fetchCached(akamaiUrl(id, i, "s"), { method: "HEAD", maxAgeDays: ttl, expect: "image" });
  if (!r) return null;
  return r.status === 200;
}

async function akamaiCount(id, ttl) {
  let lo = 1;
  let hi = 2;
  for (;;) {
    const e = await akamaiExists(id, hi, ttl);
    if (e === null) return null;
    if (!e) break;
    lo = hi;
    hi *= 2;
    if (hi > 32) return lo;
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const e = await akamaiExists(id, mid, ttl);
    if (e === null) return null;
    if (e) lo = mid;
    else hi = mid;
  }
  return lo;
}

// Premium Bandai also sells decals, cards, videos, books, games and apparel under the
// Gundam label; their last image is a sheet, a card or a product shot, never a box.
// Only plastic kits (and kit option sets) are looked at.
const KIT_NAME = /(?:^|[^A-Z])(?:HG|HGUC|HGBC|HGBF|HGBD|HGCE|HGAC|MG|MGEX|MGSD|RG|PG|RE\/100|EG|SD|SDW|SDCS|SDEX|BB戦士|EXモデル|EX STANDARD)(?![A-Z])|(?:^|[^\d])1\/(?:1|48|60|100|144|220|400|550)(?!\d)|ガンプラ|プラモ|オプションパーツ|ビルダーズパーツ|メカニクス|Figure-rise/i;
const NOT_KIT_NAME = /デカール|カード|ブースターパック|BOOSTER PACK|外伝|コマンド戦記|DVD|Blu-ray|ブルーレイ|PlayStation|Switch|Steam|記録全集|アートグラフィックス|アクリル|STRICT-G|Tシャツ|パーカー|ジャケット|フィギュア|ROBOT魂|METAL/i;
export function isKitName(name) {
  const n = String(name || "").normalize("NFKC").replace(/\s*\/\s*/g, "/");
  return KIT_NAME.test(n) && !NOT_KIT_NAME.test(n);
}

async function pickPremiumBandai(kit) {
  if (kit.images?.box_art_source_id !== "p_bandai_wayback") return null;
  if (!isKitName(kit.names?.ja || kit.names?.en)) return { none: "pb-not-a-kit" };
  const id = akamaiIdFrom([...(kit.gallery_image_urls || []), kit.images?.box_art_url]) || (String(kit.kit_id).match(/^pbandai-wb-(\d{10})$/) || [])[1];
  if (!id) return { none: "no-item-id" };
  const n = await akamaiCount(id, pageTtl(kit) > 7 ? 120 : 14);
  if (n === null) return { unknown: true };
  // Premium Bandai items still in production end on a product shot, often on a dark
  // studio background; every eye-checked box here had a flat share under 0.06, and none
  // of the first-image fallbacks was a box.
  return pickAkamaiPackage(id, Array.from({ length: n }, (_, i) => i + 1), "premium_bandai", { first: false, maxSmooth: 0.06 });
}

// --- Bandai Candy (食玩): <p class="specPkg"><img src="pkg.png"> ---------------
// Unreleased items show a shared "NOW PRINTING" PNG (17,694 or 20,761 bytes); skip
// anything that small.
// One page can sell several items (main kit + option parts set ...). The catalog then
// links each sub-item as page#<id>, and each item's section (from the element with that
// id up to the next item block) has its own specPkg. Without a fragment the first
// specPkg on the page is the main item's.

const CANDY_PLACEHOLDER_MAX = 25000;
const CANDY_TOKEN_RE = /<([a-z]+)\b([^>]*?\sid="([^"]+)"[^>]*)>|class="specPkg"[^>]*>\s*<img[^>]+src="([^"]+)"/g;
const CANDY_BLOCK_CLASS = /\bclass="[^"]*\b(?:specialBlock|itemDetail|itemImagesBlock|itemInfoBlock)\b/;
/** Ordered tokens: {id, block} for elements with an id, {pkg} for specPkg images. */
export function candyTokens(html) {
  const out = [];
  for (const m of html.matchAll(CANDY_TOKEN_RE)) {
    if (m[4]) out.push({ pkg: m[4] });
    else out.push({ id: m[3], block: /^(?:article|section)$/i.test(m[1]) || CANDY_BLOCK_CLASS.test(m[2]) });
  }
  return out;
}
// Only the tokens are kept in the cache (a candy page is ~270 KB).
export const CANDY_EXTRACT = {
  id: "candy-tokens-1",
  fn: (html) =>
    `<!--atlas:candy-tokens-1-->\n${candyTokens(html)
      .map((t) => (t.pkg ? `<p class="specPkg"><img src="${t.pkg}"></p>` : `<${t.block ? "article" : "div"} id="${t.id}">`))
      .join("\n")}\n`,
};
/** src of the item's package image: the first specPkg, or the first one in #fragment's section. */
export function candyPkgSrc(html, fragment) {
  const toks = candyTokens(html);
  if (!fragment) return toks.find((t) => t.pkg)?.pkg ?? null;
  const start = toks.findIndex((t) => t.id === fragment);
  if (start < 0) return { none: "fragment-not-found" };
  for (const t of toks.slice(start + 1)) {
    if (t.pkg) return t.pkg;
    if (t.block && t.id !== fragment) break; // next item starts: this one has no package
  }
  return null;
}

async function pickCandy(kit) {
  const page = (kit.source_urls || []).find((u) => CANDY_RE.test(u));
  if (!page) return null;
  let fragment = new URL(page).hash.slice(1);
  try {
    fragment = decodeURIComponent(fragment);
  } catch {}
  const r = await fetchFollow(page, { maxAgeDays: pageTtl(kit), expect: /class="specPkg"/, extract: CANDY_EXTRACT });
  if (!r) return { unknown: true };
  if (r.status !== 200 || !r.body) return { none: `page-${r.status}` };
  const src = candyPkgSrc(r.body.toString("utf8"), fragment);
  if (src?.none) return src;
  if (!src) return { none: "no-specPkg" };
  const url = new URL(src, stripHash(r.finalUrl || page)).href;
  const h = await fetchCached(url, { method: "HEAD", maxAgeDays: pageTtl(kit), expect: "image" });
  if (!h) return { unknown: true };
  if (h.status !== 200 || !/^image\//.test(h.contentType)) return { none: `pkg-${h.status}` };
  if (h.length && h.length <= CANDY_PLACEHOLDER_MAX) return { none: "pkg-placeholder" };
  return { url, source: "bandai_candy_pkg", confidence: "high", shape: "package" };
}

// --- Gashapon ---------------------------------------------------------------
// 【箱売】 products (Premium Bandai box sets of capsule figures): the shipping box is shot
// as a front + back pair on white. Newer items show it as image _1, older ones as _2
// (their _1 is a figure), so both are checked with boxPairShot().
// Capsule sets (ガシャポン戦士f etc.): image _1 of the set is the DP card (台紙) shown on
// the machine. Capsule toys have no box, so this is reported with kind "dp".

async function pickGashapon(kit) {
  const src = kit.images?.box_art_source_id || "";
  if (!src.startsWith("bandai_gashapon")) return null;
  const urls = [kit.images?.box_art_url, ...(kit.gallery_image_urls || [])];
  const id = akamaiIdFrom(urls);
  if (!id) return { none: "no-akamai-set-image" };
  if (/箱売/.test(kit.names?.ja || "")) {
    let unknown = false;
    for (const i of [1, 2]) {
      const a = await analyzeAkamai(id, i, boxPairShot);
      if (a.box) return { url: akamaiUrl(id, i), source: "gashapon_box", confidence: "medium", shape: "package" };
      if (a.missing) break;
      unknown ||= !!a.unknown;
    }
    return unknown ? { unknown: true } : { none: "no-box-shot" };
  }
  const exists = await akamaiExists(id, 1, 120);
  if (exists === null) return { unknown: true };
  if (!exists) return { none: "set-image-404" };
  return { url: akamaiUrl(id, 1), source: "gashapon_dp", confidence: "medium", kind: "dp" };
}

// --- Gunplapedia (gunpla.fandom.com) infobox box art joined by JAN ------------------
// The wiki's files live on static.wikia.nocookie.net, which answers non-browser clients
// with a Cloudflare challenge (checked 2026-11-01). We probe one file first and only use
// the join when that probe returns an image, so a blocked host costs a single request.

const FANDOM_API = "https://gunpla.fandom.com/api.php";
const FANDOM_PROBE = "https://static.wikia.nocookie.net/gunplabuilders/images/c/c7/HGIBO_Hyakuri_boxart.jpg/revision/latest?cb=20170409134851";

function eanOk(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(s[i]) * (i % 2 ? 3 : 1);
  return (10 - (t % 10)) % 10 === Number(s[12]);
}
export function kitJans(kit) {
  const hay = [kit.kit_id, ...(kit.source_urls || [])].join(" ");
  return [...new Set([...hay.matchAll(/(?<!\d)(4[59]\d{11})(?:000)?(?!\d)/g)].map((m) => m[1]).filter(eanOk))];
}

/** Body of the first {{Plamo Infobox ...}} template, nested templates included. */
export function plamoInfobox(text) {
  const start = text.search(/\{\{\s*Plamo[ _]Infobox/i);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth++;
      i++;
    } else if (text[i] === "}" && text[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

async function gunplapediaJanIndex(report) {
  // A refused probe is expected (it is not cached and does not count as a block).
  const probe = await fetchCached(FANDOM_PROBE, { method: "HEAD", maxAgeDays: 7, expect: "image", probe: true });
  const ps = hostStats.get(new URL(FANDOM_PROBE).hostname);
  report.probe = probe ? `${probe.status} ${probe.contentType.split(";")[0]}` : ps?.probe_blocked ? `refused (${ps.last_refusal})` : OFFLINE ? "not probed (offline)" : "no answer";
  if (!probe || probe.status !== 200 || !/^image\//.test(probe.contentType)) return null;
  const base = `${FANDOM_API}?action=query&format=json&formatversion=2&generator=allpages&gapnamespace=0&gaplimit=50&gapfilterredir=nonredirects&prop=revisions&rvprop=content&rvslots=main&rvsection=0`;
  const fileByJan = new Map();
  let cont = null;
  for (let i = 0; i < 200; i++) {
    const url = cont ? `${base}&gapcontinue=${encodeURIComponent(cont)}&continue=${encodeURIComponent("gapcontinue||")}` : base;
    const r = await fetchCached(url, { maxAgeDays: 30 });
    if (!r || r.status !== 200) return null;
    const j = JSON.parse(r.body.toString("utf8"));
    for (const p of j.query?.pages || []) {
      const text = p.revisions?.[0]?.slots?.main?.content || "";
      const box = plamoInfobox(text);
      const file = box.match(/\|\s*image\s*=\s*([^|}\n]+)/i)?.[1]?.trim();
      const jans = (box.match(/\|\s*JAN(?:\/ISBN)?\s*=\s*([^|}]+)/i)?.[1] || "").match(/\d{13}/g) || [];
      if (file) for (const jan of jans) if (!fileByJan.has(jan)) fileByJan.set(jan, file.replace(/^(File|Image):/i, ""));
    }
    cont = j.continue?.gapcontinue;
    if (!cont) break;
  }
  const files = [...new Set(fileByJan.values())];
  const info = new Map();
  for (let i = 0; i < files.length; i += 50) {
    const titles = files.slice(i, i + 50).map((f) => `File:${f}`).join("|");
    const url = `${FANDOM_API}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cmime&titles=${encodeURIComponent(titles)}`;
    const r = await fetchCached(url, { maxAgeDays: 30 });
    if (!r || r.status !== 200) continue;
    const j = JSON.parse(r.body.toString("utf8"));
    const norm = new Map((j.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of j.query?.pages || []) {
      const ii = p.imageinfo?.[0];
      if (!ii?.url) continue;
      const from = (norm.get(p.title) || p.title).replace(/^File:/, "");
      info.set(from, ii);
      info.set(p.title.replace(/^File:/, ""), ii);
    }
  }
  const byJan = new Map();
  for (const [jan, file] of fileByJan) {
    const ii = info.get(file) || info.get(file.replace(/_/g, " "));
    if (!ii) continue;
    const boxName = /box|package|pkg|パッケージ/i.test(file);
    byJan.set(jan, { url: ii.url.replace(/\/revision\/latest\?/, "/revision/latest/scale-to-width-down/640?"), boxName, w: ii.width, h: ii.height });
  }
  report.files = byJan.size;
  return byJan;
}

// ---------------------------------------------------------------------------
// URL health sample: status + content-type without Referer / cookies.

/** Every k-th entry of each source, in the order given (pass catalog order: deterministic). */
export function healthPlan(entries, perSource) {
  const bySource = new Map();
  for (const [kitId, e] of entries) {
    if (!bySource.has(e.source)) bySource.set(e.source, []);
    bySource.get(e.source).push([kitId, e]);
  }
  const plan = new Map();
  for (const [source, list] of [...bySource].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const step = Math.max(1, Math.floor(list.length / perSource));
    plan.set(source, list.filter((_, i) => i % step === 0).slice(0, perSource));
  }
  return plan;
}

async function healthSample(entries, perSource) {
  const out = {};
  for (const [source, sample] of healthPlan(entries, perSource)) {
    let ok = 0;
    let checked = 0;
    for (const [, e] of sample) {
      const r = await fetchCached(e.url, { method: "HEAD", maxAgeDays: 7, expect: "image" });
      if (!r) continue;
      checked++;
      if (r.status === 200 && /^image\//.test(r.contentType)) ok++;
    }
    out[source] = { checked, ok };
  }
  return out;
}

// ---------------------------------------------------------------------------

const SOURCES = [
  {
    id: "bandai_spirits_last",
    name: "BANDAI SPIRITS 商品情報 (bandaispirits.co.jp/products) — last slider image",
    url: "https://www.bandaispirits.co.jp/products/",
    method: "Last image of the product slider, accepted only when it is a white-padded box scan with a box-like aspect ratio (pixel check). Confidence high/medium/low from the share of flat background blocks; low picks are emitted as kind 'maybe' (not box art). Hotlinked from bandai-a.akamaihd.net; '/b/' 500px, swap to '/xl/' for 1200px.",
    licence: "© SOTSU・SUNRISE / BANDAI SPIRITS. Official product images, hotlinked only, not rehosted.",
  },
  {
    id: "bandai_spirits_first",
    name: "BANDAI SPIRITS 商品情報 — first slider image",
    url: "https://www.bandaispirits.co.jp/products/",
    method: "Older pages (mostly MG and 1/100 old kits) put the box first; used when the last image is not a box and the first one passes the same pixel check. Confidence at most medium (low ones are kind 'maybe').",
    licence: "© SOTSU・SUNRISE / BANDAI SPIRITS. Hotlinked only.",
  },
  {
    id: "premium_bandai_last",
    name: "Premium Bandai item images (bandai-a.akamaihd.net) — last image",
    url: "https://p-bandai.jp/",
    method: "Plastic kits only (by name). Image count found by HEAD probes on the CDN (p-bandai.jp item pages are behind a JS challenge, not used); last image accepted after the pixel check with a stricter flat-background limit.",
    licence: "© SOTSU・SUNRISE / BANDAI SPIRITS / BANDAI NAMCO. Hotlinked only.",
  },
  {
    id: "bandai_candy_pkg",
    name: "Bandai Candy ガンダム食玩 (bandai.co.jp/candy/gundam) — specPkg image",
    url: "https://www.bandai.co.jp/candy/gundam/",
    method: "The item's package block (<p class=\"specPkg\">, usually pkg.png): the first one on the page, or, for a sub-item linked as page#id, the first one in that item's own section. NOW PRINTING placeholders (<= 25 KB) are skipped. Large PNG (~0.3–0.5 MB).",
    licence: "© SOTSU・SUNRISE / BANDAI. Hotlinked only.",
  },
  {
    id: "gashapon_box",
    name: "Gashapon 【箱売】 products (Premium Bandai box sets) — box photo",
    url: "https://gashapon.jp/",
    method: "Box-sold capsule sets: image _1 (newer items) or _2 (older items) shows the shipping box front and back; accepted only when the pixel check finds a wide, solid pair of boxes.",
    licence: "© SOTSU・SUNRISE / BANDAI. Hotlinked only.",
  },
  {
    id: "gashapon_dp",
    name: "Gashapon capsule sets (gashapon.jp) — DP card",
    url: "https://gashapon.jp/",
    method: "Capsule toys have no box; image _1 of the set is the machine's DP card (台紙). Entries carry kind \"dp\".",
    licence: "© SOTSU・SUNRISE / BANDAI. Hotlinked only.",
  },
  {
    id: "gunplapedia_jan",
    name: "Gunplapedia (gunpla.fandom.com) infobox box art, joined by JAN",
    url: "https://gunpla.fandom.com/",
    method: "Only used when static.wikia.nocookie.net serves images to non-browser clients (one HEAD probe per run); it answered with a Cloudflare challenge (403) when this was written, so no entries come from here.",
    licence: "Wiki text CC BY-SA 3.0; box art © SOTSU・SUNRISE / BANDAI SPIRITS. Hotlinked only.",
  },
];

const NOT_COVERED = {
  tamashii_figures: "tamashiiweb.com product pages show figure photos only; no package shots are published (METAL BUILD, METAL ROBOT魂, ROBOT魂, S.H.Figuarts).",
  web_manual: "WEB取説 (manual.bandai-hobby.net) thumbnails live on bandai-hobby.net, which returns HTML instead of images to plain clients.",
  bandai_hobby_site: "bandai-hobby.net product images are CloudFront-signed URLs that expire within hours.",
  mobile_suit_ensemble: "MOBILE SUIT ENSEMBLE items link only per-figure gashapon.jp images; no set DP card URL in the catalog.",
  premium_bandai_merch: "Premium Bandai decals, cards, videos, books, games and apparel: no box image (their images are sheets, cards or product shots).",
};

// What an entry is. The app shows only plain entries (no kind) as box art.
export const KINDS = {
  box: "No kind field: the retail package (箱絵), confidence high or medium. Show it as the box art.",
  dp: "kind \"dp\": a gashapon DP card (台紙) shown on the machine. Capsule toys have no box; show it as the set image, not as a box.",
  maybe: "kind \"maybe\": a low-confidence pick (about 4 in 5 were boxes when checked by eye; the rest are group photos, product shots or decal sheets). Never show it as box art; at most as an ordinary gallery image.",
};

/** The output entry for a picker result; low-confidence picks become kind "maybe". */
export function toEntry(r) {
  const e = { url: r.url, source: r.source, confidence: r.confidence };
  if (r.kind) e.kind = r.kind;
  else if (r.confidence === "low") e.kind = "maybe";
  return e;
}

/**
 * Reasons not to write the file (CI passes --guard): a host refused us, served unexpected
 * pages en masse, or the entry count fell more than 5% below the previous file.
 */
export function guardReasons({ hosts, prevCount, count, allowDrop = false }) {
  const out = [];
  for (const [host, s] of Object.entries(hosts)) {
    if (s.blocked > 0) out.push(`${host}: ${s.blocked} refused (${s.last_refusal || "?"})`);
    if (s.unexpected > 20) out.push(`${host}: ${s.unexpected} pages without the expected markup`);
  }
  if (!allowDrop && prevCount > 0 && count < prevCount * 0.95) out.push(`entries ${prevCount} -> ${count} (more than 5% fewer)`);
  return out;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Equality for "did anything but the timestamp / URL-check counts change?". */
const comparable = (body) => JSON.stringify({ ...body, updated_at: null, sources: (body.sources || []).map(({ url_check, ...s }) => s) });

async function main() {
  const rawBudget = args.budget ?? process.env.ATLAS_BUDGET;
  if (rawBudget !== undefined && !/^\d+$/.test(String(rawBudget))) throw new Error(`--budget must be a whole number, got ${JSON.stringify(rawBudget)}`);
  const kitsFile = path.resolve(ROOT, args.kits || path.join("data", "split", "kits-gundam.json"));
  const outFile = path.resolve(ROOT, args.out || path.join("data", "atlas", "gundam-boxart.json"));
  const only = args.only ? new Set(String(args.only).split(",")) : null;
  const want = (f) => !only || only.has(f);
  const checkPerSource = Number(args.check ?? 30);
  const guard = args.guard === "1";

  const catalog = await readJson(kitsFile);
  if (!catalog?.kits?.length) throw new Error(`no kits in ${kitsFile}`);
  const kits = catalog.kits.filter((k) => k.franchise === "gundam");
  const prev = await readJson(outFile);
  const prevBox = prev?.boxart || {};

  const report = { gunplapedia: {}, reasons: {}, carried_over: 0, started: new Date().toISOString() };
  const fandom = want("gunplapedia") ? await gunplapediaJanIndex(report.gunplapedia) : null;

  const picks = new Map();
  let next = 0;
  let done = 0;
  const pickers = [
    ["bs", pickBandaiSpirits],
    ["pb", pickPremiumBandai],
    ["candy", pickCandy],
    ["gashapon", pickGashapon],
  ];
  async function worker() {
    while (next < kits.length) {
      const kit = kits[next++];
      let result = null;
      for (const [fam, fn] of pickers) {
        if (!want(fam)) continue;
        const r = await fn(kit);
        if (r) {
          result = r;
          break;
        }
      }
      if ((!result || !result.url) && fandom) {
        const hit = kitJans(kit).map((j) => fandom.get(j)).find(Boolean);
        if (hit && !isDeadUrl(hit.url)) result = { url: hit.url, source: "gunplapedia_jan", confidence: hit.boxName ? "medium" : "low" };
      }
      if (result?.url && !isDeadUrl(result.url)) {
        picks.set(kit.kit_id, toEntry(result));
      } else if (result?.unknown && prevBox[kit.kit_id]) {
        // over budget / offline / host refused: keep the last known answer
        const p = prevBox[kit.kit_id];
        picks.set(kit.kit_id, p.kind || p.confidence !== "low" ? p : { ...p, kind: "maybe" });
        report.carried_over++;
      } else {
        const why = result?.none || (result?.unknown ? "unknown" : "no-source");
        report.reasons[why] = (report.reasons[why] || 0) + 1;
      }
      if (++done % 250 === 0) console.log(`[boxart] ${done}/${kits.length} kits, ${picks.size} picked`);
    }
  }
  await Promise.all(Array.from({ length: Number(args.workers || 6) }, worker));

  // Catalog order from here on (stable output and a deterministic health sample).
  const ordered = kits.filter((k) => picks.has(k.kit_id)).map((k) => [k.kit_id, picks.get(k.kit_id)]);
  // Health sample per source; a source whose sample mostly fails is dropped this run.
  const checks = checkPerSource > 0 ? await healthSample(ordered, checkPerSource) : {};
  const dropped = new Set();
  for (const [source, c] of Object.entries(checks)) {
    if (c.checked >= 5 && c.ok / c.checked < 0.9) {
      dropped.add(source);
      c.dropped = true;
    }
  }
  const boxart = Object.fromEntries(ordered.filter(([, e]) => !dropped.has(e.source)));

  const byGrade = {};
  const bySource = {};
  for (const kit of kits) {
    const g = (byGrade[kit.grade_code || "?"] ||= { kits: 0, with_box: 0 });
    g.kits++;
    const e = boxart[kit.kit_id];
    if (!e) continue;
    if (e.kind) g[`with_${e.kind}`] = (g[`with_${e.kind}`] || 0) + 1;
    else g.with_box++;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  }
  const entries = Object.values(boxart);
  const countKind = (k) => entries.filter((e) => (e.kind || "box") === k).length;
  // Premium Bandai plastic kits (by name) vs those with a box: the rest is a known gap.
  const pbItems = kits.filter((k) => k.images?.box_art_source_id === "p_bandai_wayback");
  const pbKits = pbItems.filter((k) => isKitName(k.names?.ja || k.names?.en));
  const pbBox = pbKits.filter((k) => boxart[k.kit_id] && !boxart[k.kit_id].kind).length;
  const sources = SOURCES.map((s) => ({
    ...s,
    entries: bySource[s.id] || 0,
    ...(checks[s.id] ? { url_check: checks[s.id] } : {}),
    ...(s.id === "gunplapedia_jan" ? { status: fandom ? "ok" : "not used" } : {}),
  }));
  const body = {
    schema: 1,
    updated_at: null,
    kinds: KINDS,
    sources,
    not_covered: {
      ...NOT_COVERED,
      premium_bandai_kits: `${pbKits.length - pbBox} of ${pbKits.length} Premium Bandai plastic kits have no box image: their last CDN image is a product shot (item pages are behind a JS challenge, and their first images were never boxes in the checked samples).`,
    },
    boxart,
    stats: {
      kits: kits.length,
      with_box: countKind("box"),
      with_dp: countKind("dp"),
      with_maybe: countKind("maybe"),
      premium_bandai: { items: pbItems.length, kits: pbKits.length, with_box: pbBox },
      by_grade: byGrade,
      by_source: bySource,
    },
  };

  // Keep updated_at (and the file) unchanged when only the timestamp or the URL-check
  // counts would move.
  const same = !!prev && comparable(prev) === comparable(body);
  const hosts = hostReport();
  const blockedBy = guard ? guardReasons({ hosts, prevCount: Object.keys(prevBox).length, count: entries.length, allowDrop: args["allow-drop"] === "1" }) : [];
  const write = !same && blockedBy.length === 0;
  body.updated_at = same || !write ? prev?.updated_at ?? null : new Date().toISOString();
  if (write) {
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, `${JSON.stringify(body)}\n`);
  }
  const summary = {
    changed: write,
    guard: blockedBy,
    kits: kits.length,
    picked: entries.length,
    previous: Object.keys(prevBox).length,
    with_box: body.stats.with_box,
    with_dp: body.stats.with_dp,
    with_maybe: body.stats.with_maybe,
    by_source: bySource,
    url_checks: checks,
    reasons: report.reasons,
    carried_over: report.carried_over,
    gunplapedia: report.gunplapedia,
    hosts,
  };
  console.log(JSON.stringify(summary, null, 1));
  if (blockedBy.length) console.log(`::warning::Gundam box art not written: ${blockedBy.join("; ")}`);
  if (args.report) await writeFile(path.resolve(args.report), JSON.stringify(summary, null, 1));
}

const isMain = (() => {
  try {
    return !!process.argv[1] && realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
