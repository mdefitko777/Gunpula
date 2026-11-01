// Polite HTTP client for the Hobby Atlas data jobs.
//
// - One descriptive User-Agent with a contact URL; no browser impersonation.
// - At most one request per MIN_GAP_MS per host (default 1.1 s).
// - Every raw response body is cached on disk (ATLAS_CACHE_DIR, never committed).
//   Fresh cache hits make no request; on failure a stale cache entry is used.
// - A bot check (403/429/503/511, Cloudflare "Just a moment", challenge pages) is
//   recorded as "blocked" and never retried with different headers.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const MIN_GAP_MS = Number(process.env.ATLAS_MIN_GAP_MS || 1100);
const TIMEOUT_MS = Number(process.env.ATLAS_TIMEOUT_MS || 30000);

export const CACHE_DIR = path.resolve(process.env.ATLAS_CACHE_DIR || "tmp/atlas-cache/mezastar");
export const OFFLINE = process.env.ATLAS_OFFLINE === "1";

const lastHit = new Map(); // host -> timestamp of last request start
const hostLog = new Map(); // host -> { requests, cached, stale, errors, blocked, lastError }

export class BlockedError extends Error {
  constructor(url, status, reason) {
    super(`blocked ${status} ${reason} ${url}`);
    this.name = "BlockedError";
    this.url = url;
    this.status = status;
    this.reason = reason;
  }
}

function log(host) {
  if (!hostLog.has(host)) hostLog.set(host, { requests: 0, cached: 0, stale: 0, errors: 0, blocked: false, lastError: null, oldest: null });
  return hostLog.get(host);
}

/** Oldest fetch time among the responses served for a host in this run (live or cached). */
export function hostOldest(host) {
  return hostLog.get(host)?.oldest || null;
}
function seen(L, fetchedAt) {
  if (fetchedAt && (!L.oldest || fetchedAt < L.oldest)) L.oldest = fetchedAt;
}

export function hostReport() {
  return Object.fromEntries([...hostLog.entries()].sort());
}

export function blockedHosts() {
  return [...hostLog.entries()].filter(([, v]) => v.blocked).map(([k]) => k);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(host) {
  const prev = lastHit.get(host) || 0;
  const wait = prev + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

function cacheKey(method, url, body) {
  const h = createHash("sha1").update(`${method} ${url}\n${body || ""}`).digest("hex");
  const u = new URL(url);
  const slug = (u.hostname + u.pathname + u.search).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
  return path.join(CACHE_DIR, u.hostname, `${slug}.${h.slice(0, 12)}`);
}

async function readCache(file) {
  try {
    const meta = JSON.parse(await readFile(`${file}.meta.json`, "utf8"));
    const body = await readFile(`${file}.body`);
    return { meta, body };
  } catch {
    return null;
  }
}

async function writeCache(file, meta, body) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.body`, body);
  await writeFile(`${file}.meta.json`, JSON.stringify(meta));
}

const CHALLENGE_RE = /Just a moment\.\.\.|cf-chl-|challenge-platform|cf_chl_opt|Attention Required! \| Cloudflare|captcha/i;

function detectBlock(status, text) {
  if ([403, 429, 503, 511].includes(status)) return `HTTP ${status}`;
  if (status < 400 && text && text.length < 200000 && CHALLENGE_RE.test(text.slice(0, 20000))) return "challenge page";
  return null;
}

/**
 * Fetch a URL politely. Returns { status, text, fromCache, stale, fetchedAt }.
 * opts: method, body (string), headers, maxAgeMs (cache freshness), accept404.
 */
export async function politeFetch(url, opts = {}) {
  const method = opts.method || "GET";
  const body = opts.body || null;
  const maxAgeMs = opts.maxAgeMs ?? 12 * 3600 * 1000;
  const host = new URL(url).hostname;
  const L = log(host);
  const file = cacheKey(method, url, body);
  const cached = await readCache(file);
  if (cached && (OFFLINE || Date.now() - Date.parse(cached.meta.fetchedAt) < maxAgeMs)) {
    L.cached++;
    seen(L, cached.meta.fetchedAt);
    return { status: cached.meta.status, text: cached.body.toString("utf8"), fromCache: true, stale: false, fetchedAt: cached.meta.fetchedAt };
  }
  if (OFFLINE) throw new Error(`offline and no cache for ${url}`);
  if (L.blocked) {
    // Host already blocked during this run: do not keep knocking.
    if (cached) {
      L.stale++;
      seen(L, cached.meta.fetchedAt);
      return { status: cached.meta.status, text: cached.body.toString("utf8"), fromCache: true, stale: true, fetchedAt: cached.meta.fetchedAt };
    }
    throw new BlockedError(url, 0, "host blocked earlier in this run");
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle(host);
    L.requests++;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const headers = {
        "User-Agent": USER_AGENT,
        Accept: opts.accept || "text/html,application/json;q=0.9,*/*;q=0.8",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(opts.headers || {}),
      };
      const res = await fetch(url, { method, headers, body, signal: ac.signal, redirect: "follow" });
      const buf = Buffer.from(await res.arrayBuffer());
      const text = buf.toString("utf8");
      const block = res.headers.get("cf-mitigated") === "challenge" ? `Cloudflare challenge (HTTP ${res.status})` : detectBlock(res.status, text);
      if (block) {
        L.blocked = true;
        L.lastError = `${block} ${url}`;
        if (cached) {
          L.stale++;
          seen(L, cached.meta.fetchedAt);
          return { status: cached.meta.status, text: cached.body.toString("utf8"), fromCache: true, stale: true, fetchedAt: cached.meta.fetchedAt };
        }
        throw new BlockedError(url, res.status, block);
      }
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (res.status >= 400 && !(opts.accept404 && res.status === 404)) {
        const e = new Error(`HTTP ${res.status} ${url}`);
        e.status = res.status;
        e.fatal = true;
        throw e;
      }
      const fetchedAt = new Date().toISOString();
      seen(L, fetchedAt);
      await writeCache(file, { url, method, status: res.status, fetchedAt, contentType: res.headers.get("content-type") }, buf);
      return { status: res.status, text, fromCache: false, stale: false, fetchedAt };
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      lastErr = err;
      L.errors++;
      L.lastError = `${err.message || err}`.slice(0, 200);
      if (err.fatal) break;
      await sleep(2000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (cached) {
    L.stale++;
    seen(L, cached.meta.fetchedAt);
    return { status: cached.meta.status, text: cached.body.toString("utf8"), fromCache: true, stale: true, fetchedAt: cached.meta.fetchedAt };
  }
  throw lastErr || new Error(`fetch failed ${url}`);
}

export async function fetchJson(url, opts = {}) {
  const r = await politeFetch(url, { accept: "application/json", ...opts });
  return { ...r, json: JSON.parse(r.text) };
}
