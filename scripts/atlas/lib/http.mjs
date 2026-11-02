// Polite HTTP client for the Hobby Atlas data jobs.
//
// - One descriptive User-Agent with a contact URL; never a browser UA.
// - At most one request per HOST_INTERVAL_MS per host (default 1100 ms).
// - Every raw response body is cached under ATLAS_CACHE_DIR (outside the repo, never
//   committed). A cached body younger than `ttlHours` is reused without a request.
// - When a request fails (network error, HTTP error, bot challenge), the newest cached
//   body is returned with `stale: true` if one exists; otherwise the error is thrown so
//   the caller can keep its previous output.
// - Bot challenges (Cloudflare "Just a moment", proof-of-work pages) are detected and
//   reported as failures. We never try to solve or route around them.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
export const CACHE_DIR = process.env.ATLAS_CACHE_DIR || path.join(os.tmpdir(), "hobby-atlas-cache");
const HOST_INTERVAL_MS = Number(process.env.ATLAS_HOST_INTERVAL_MS || 1100);
const OFFLINE = process.env.ATLAS_OFFLINE === "1";

const lastRequestAt = new Map();
export const requestLog = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait until this host may be contacted again (shared by every request of this process). */
export async function throttle(host) {
  const last = lastRequestAt.get(host) || 0;
  const wait = last + HOST_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

function cachePaths(url, cacheKey) {
  const host = new URL(url).host;
  const key = cacheKey || createHash("sha1").update(url).digest("hex");
  const safe = key.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const dir = path.join(CACHE_DIR, host);
  return { dir, body: path.join(dir, `${safe}.body`), meta: path.join(dir, `${safe}.meta.json`) };
}

async function readCache(paths) {
  try {
    const [body, metaText] = await Promise.all([readFile(paths.body, "utf8"), readFile(paths.meta, "utf8")]);
    const meta = JSON.parse(metaText);
    return { body, meta };
  } catch {
    return null;
  }
}

export function looksLikeBotChallenge(status, text) {
  if (status === 511) return true;
  const head = String(text || "").slice(0, 4000);
  return /<title>\s*Just a moment\.\.\.\s*<\/title>|challenges\.cloudflare\.com|cf-chl-|Verifying you are human|proof-of-work/i.test(head);
}

/**
 * Fetch a URL politely with caching.
 * @param {string} url
 * @param {{ttlHours?: number, cacheKey?: string, accept?: string, retries?: number, timeoutMs?: number}} [opts]
 * @returns {Promise<{body: string, status: number, fromCache: boolean, stale: boolean, fetchedAt: string}>}
 */
export async function politeFetch(url, opts = {}) {
  const { ttlHours = 24 * 6, cacheKey, accept = "application/json, text/html;q=0.9, */*;q=0.5", retries = 3, timeoutMs = 120000 } = opts;
  const paths = cachePaths(url, cacheKey);
  const cached = await readCache(paths);
  if (cached) {
    const ageHours = (Date.now() - Date.parse(cached.meta.fetched_at)) / 36e5;
    if (OFFLINE || ageHours < ttlHours) {
      return { body: cached.body, status: cached.meta.status, fromCache: true, stale: OFFLINE && ageHours >= ttlHours, fetchedAt: cached.meta.fetched_at };
    }
  } else if (OFFLINE) {
    throw new Error(`offline and not cached: ${url}`);
  }

  const host = new URL(url).host;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept }, signal: controller.signal, redirect: "follow" });
      const text = await res.text();
      requestLog.push({ host, status: res.status, url });
      if (looksLikeBotChallenge(res.status, text)) {
        // A challenge is a refusal: stop immediately, do not retry or work around it.
        lastError = Object.assign(new Error(`bot challenge from ${host} (HTTP ${res.status})`), { blocked: true });
        break;
      }
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        const retryAfter = Number(res.headers.get("retry-after")) || 0;
        await sleep(Math.max(retryAfter * 1000, 4000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        break;
      }
      const fetchedAt = new Date().toISOString();
      await mkdir(paths.dir, { recursive: true });
      await writeFile(paths.body, text, "utf8");
      await writeFile(paths.meta, JSON.stringify({ url, status: res.status, fetched_at: fetchedAt, bytes: text.length }), "utf8");
      return { body: text, status: res.status, fromCache: false, stale: false, fetchedAt };
    } catch (error) {
      lastError = error;
      requestLog.push({ host, status: "error", url, error: String(error?.message || error) });
      await sleep(3000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (cached) {
    console.warn(`[http] ${url} failed (${lastError?.message}); using stale cache from ${cached.meta.fetched_at}`);
    return { body: cached.body, status: cached.meta.status, fromCache: true, stale: true, fetchedAt: cached.meta.fetched_at };
  }
  throw lastError || new Error(`request failed: ${url}`);
}

export async function politeJson(url, opts = {}) {
  const res = await politeFetch(url, { accept: "application/json", ...opts });
  return { ...res, json: JSON.parse(res.body) };
}

export async function fileAgeHours(file) {
  try {
    const s = await stat(file);
    return (Date.now() - s.mtimeMs) / 36e5;
  } catch {
    return Infinity;
  }
}

export function requestSummary() {
  const byHost = {};
  for (const r of requestLog) {
    const h = (byHost[r.host] ||= { requests: 0, errors: 0 });
    h.requests++;
    if (r.status === "error" || (typeof r.status === "number" && r.status >= 400)) h.errors++;
  }
  return byHost;
}
