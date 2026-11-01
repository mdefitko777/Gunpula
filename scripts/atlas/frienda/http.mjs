// Hobby Atlas — ポケモンフレンダ 데이터용 예의 바른 HTTP 클라이언트.
//
// - 연락처가 들어간 User-Agent 하나만 쓴다. 브라우저 흉내는 하지 않는다.
// - 호스트마다 MIN_GAP_MS(기본 1.1 초)에 한 번만 요청한다. 마지막 요청 시각을 캐시 폴더의
//   .throttle/<host> 에도 적어서, 같은 캐시를 쓰는 다른 프로세스와 동시에 돌아도 간격을 지킨다.
// - 응답 원문은 ATLAS_CACHE_DIR 에 저장한다(커밋하지 않음). 신선한 캐시는 요청하지 않고,
//   요청이 실패하면 오래된 캐시라도 쓴다.
// - 봇 차단(Cloudflare challenge 헤더 · 페이지, 429/503/511, 같은 호스트의 403 이 3 번)은 "blocked" 로
//   기록하고, 헤더를 바꿔 다시 시도하지 않는다. 한 번의 평범한 403(예: 디렉터리 목록 금지)은
//   그 URL 만 실패시킨다.
// - opts.isFinal(text) 가 참인 캐시(끝난 이벤트 페이지)는 나이와 상관없이 다시 받지 않는다.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const USER_AGENT = "HobbyAtlasDataBot/1.0 (+https://github.com/mdefitko777/Gunpula)";
const MIN_GAP_MS = Number(process.env.ATLAS_MIN_GAP_MS || 1100);
const TIMEOUT_MS = Number(process.env.ATLAS_TIMEOUT_MS || 30000);

export const CACHE_DIR = path.resolve(process.env.ATLAS_CACHE_DIR || "tmp/atlas-cache/frienda");
export const OFFLINE = process.env.ATLAS_OFFLINE === "1";

const lastHit = new Map(); // host -> 마지막 요청 시각
const THROTTLE_DIR = path.join(CACHE_DIR, ".throttle");
const hostLog = new Map(); // host -> { requests, cached, stale, errors, blocked, last_error }

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
  if (!hostLog.has(host)) hostLog.set(host, { requests: 0, cached: 0, stale: 0, errors: 0, not_found: 0, forbidden: 0, blocked: false, last_error: null });
  return hostLog.get(host);
}

export const hostReport = () => Object.fromEntries([...hostLog.entries()].sort());
export const blockedHosts = () => [...hostLog.entries()].filter(([, v]) => v.blocked).map(([k]) => k);
export const isBlocked = (host) => Boolean(hostLog.get(host)?.blocked);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(host) {
  const file = path.join(THROTTLE_DIR, host);
  let last = lastHit.get(host) || 0;
  try {
    last = Math.max(last, Number(await readFile(file, "utf8")) || 0);
  } catch {
    // 처음이거나 읽을 수 없으면 이 프로세스의 기록만 쓴다.
  }
  const wait = last + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  await markHit(host);
}

// 요청 시작과 응답 끝 모두에 기록한다: 간격을 앞 응답이 끝난 때부터 재서 초당 1 회를 넘지 않게.
async function markHit(host) {
  const now = Date.now();
  lastHit.set(host, now);
  try {
    await mkdir(THROTTLE_DIR, { recursive: true });
    await writeFile(path.join(THROTTLE_DIR, host), String(now));
  } catch {
    // 기록 실패는 무시 (프로세스 안의 간격은 그대로 지킨다)
  }
}

function cacheFile(method, url, body) {
  const h = createHash("sha1").update(`${method} ${url}\n${body || ""}`).digest("hex");
  const u = new URL(url);
  const slug = (u.pathname + u.search).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
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

// 오류 응답 본문에서만 보는 challenge 표시. 정상(2xx) 페이지는 <title> 만 본다:
// 평범한 페이지에도 "captcha" 문구나 Cloudflare 스크립트가 들어 있을 수 있어서.
const CHALLENGE_RE = /Just a moment\.\.\.|cf-chl-|cf_chl_opt|\/cdn-cgi\/challenge-platform\/h\/|Attention Required! \| Cloudflare|g-recaptcha|h-captcha|captcha-delivery/i;
const CHALLENGE_TITLE_RE = /<title>\s*(?:Just a moment\.\.\.|Attention Required! \| Cloudflare)/i;

function detectBlock(res, text, L) {
  const status = res.status;
  if (res.headers.get("cf-mitigated") === "challenge") return `Cloudflare challenge (HTTP ${status})`;
  const head = (text || "").slice(0, 20000);
  if (status >= 400 && CHALLENGE_RE.test(head)) return `challenge page (HTTP ${status})`;
  if (status < 400 && CHALLENGE_TITLE_RE.test(head)) return "challenge page";
  if ([429, 503, 511].includes(status)) return `HTTP ${status}`;
  if (status === 403 && ++L.forbidden >= 3) return "HTTP 403 (3 times on this host)";
  return null;
}

const fromCache = (L, c, stale) => {
  if (stale) L.stale++;
  else L.cached++;
  return { status: c.meta.status, text: c.body.toString("utf8"), fromCache: true, stale, fetchedAt: c.meta.fetchedAt };
};

/**
 * URL 을 예의 바르게 가져온다. { status, text, fromCache, stale, fetchedAt } 를 돌려준다.
 * opts: maxAgeMs(캐시 신선도), accept, accept404(404 를 예외 대신 status 로 돌려줌).
 */
export async function politeFetch(url, opts = {}) {
  const method = opts.method || "GET";
  const body = opts.body || null;
  const maxAgeMs = opts.maxAgeMs ?? 12 * 3600e3;
  const host = new URL(url).hostname;
  const L = log(host);
  const file = cacheFile(method, url, body);
  const cached = await readCache(file);
  const fresh = cached && (OFFLINE || Date.now() - Date.parse(cached.meta.fetchedAt) < maxAgeMs || (opts.isFinal && cached.meta.status < 400 && opts.isFinal(cached.body.toString("utf8"))));
  if (fresh) return fromCache(L, cached, false);
  if (OFFLINE) throw new Error(`offline and no cache for ${url}`);
  if (L.blocked) {
    // 이번 실행에서 이미 막힌 호스트는 더 두드리지 않는다.
    if (cached) return fromCache(L, cached, true);
    throw new BlockedError(url, 0, "host blocked earlier in this run");
  }
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle(host);
    L.requests++;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        body,
        signal: ac.signal,
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: opts.accept || "text/html,application/json;q=0.9,*/*;q=0.8",
          ...(opts.headers || {}),
        },
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const text = buf.toString("utf8");
      const block = detectBlock(res, text, L);
      if (block) {
        L.blocked = true;
        L.last_error = `${block} ${url}`;
        if (cached) return fromCache(L, cached, true);
        throw new BlockedError(url, res.status, block);
      }
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (res.status === 404 && opts.accept404) {
        L.not_found++;
        return { status: 404, text: "", fromCache: false, stale: false, fetchedAt: new Date().toISOString() };
      }
      if (res.status >= 400) {
        const e = new Error(`HTTP ${res.status} ${url}`);
        e.status = res.status;
        e.fatal = true;
        throw e;
      }
      const fetchedAt = new Date().toISOString();
      await writeCache(file, { url, method, status: res.status, fetchedAt, contentType: res.headers.get("content-type") }, buf);
      return { status: res.status, text, fromCache: false, stale: false, fetchedAt };
    } catch (err) {
      if (err instanceof BlockedError) throw err;
      lastErr = err;
      L.errors++;
      L.last_error = `${err.message || err}`.slice(0, 200);
      if (err.fatal) break;
      await sleep(2000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
      await markHit(host);
    }
  }
  if (cached) return fromCache(L, cached, true);
  throw lastErr || new Error(`fetch failed ${url}`);
}

export async function fetchJson(url, opts = {}) {
  const r = await politeFetch(url, { accept: "application/json", ...opts });
  return { ...r, json: JSON.parse(r.text) };
}
