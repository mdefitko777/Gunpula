// Minimal MediaWiki API client (Fandom) + wikitext infobox helpers.
import { politeJson } from "./http.mjs";
import { assertFandomAllowed } from "./policy.mjs";

/**
 * Run an action=query request and follow `continue` until done.
 * `onBatch(json)` receives each response. Returns {requests, stale}.
 */
export async function queryAll(host, params, onBatch, { maxRequests = 400, ttlHours = 24 * 6, label = "" } = {}) {
  if (/fandom\.com$/.test(host)) assertFandomAllowed(host);
  let cont = {};
  let requests = 0;
  let stale = false;
  for (;;) {
    const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params, ...cont });
    const res = await politeJson(`https://${host}/api.php?${qs}`, { ttlHours });
    stale ||= res.stale;
    requests++;
    if (res.json.error) throw new Error(`${host} API error: ${res.json.error.code} ${res.json.error.info}`);
    onBatch(res.json);
    if (!res.json.continue) break;
    cont = res.json.continue;
    if (requests >= maxRequests) throw new Error(`${host}: more than ${maxRequests} requests, aborting`);
    if (requests % 20 === 0) console.log(`[${label || host}] ${requests} requests`);
  }
  return { requests, stale };
}

export function pageText(page) {
  return page?.revisions?.[0]?.slots?.main?.content ?? page?.revisions?.[0]?.content ?? "";
}

/** Return the body of the first `{{<nameRe> ...}}` template (without braces), brace-depth aware. */
export function extractTemplate(wikitext, nameRe) {
  const re = new RegExp(`\\{\\{\\s*(?:Template:)?(?:${nameRe.source})`, "i");
  const m = re.exec(wikitext || "");
  if (!m) return null;
  let depth = 0;
  const w = wikitext;
  for (let i = m.index; i < w.length - 1; i++) {
    if (w[i] === "{" && w[i + 1] === "{") {
      depth++;
      i++;
    } else if (w[i] === "}" && w[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return w.slice(m.index + 2, i - 1);
    }
  }
  return null;
}

function splitTop(body) {
  const parts = [];
  let cur = "";
  let d = 0;
  let l = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const n = body[i + 1];
    if (c === "{" && n === "{") { d++; cur += "{{"; i++; continue; }
    if (c === "}" && n === "}") { d--; cur += "}}"; i++; continue; }
    if (c === "[" && n === "[") { l++; cur += "[["; i++; continue; }
    if (c === "]" && n === "]") { l--; cur += "]]"; i++; continue; }
    if (c === "|" && d === 0 && l === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/** Template parameters as a lower-case keyed object (raw values). */
export function templateParams(body) {
  const out = {};
  for (const part of splitTop(body || "").slice(1)) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

/** Strip wiki markup: templates, links, refs, html, bold/italic. */
export function cleanWiki(s) {
  return String(s || "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/\[ref:[^\]]*\]/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:[^\s\]]+\s*([^\]]*)\]/g, "$1")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve page titles through redirects (50 per request). Returns Map(from -> to) for those that redirect. */
export async function resolveRedirects(host, titles, { ttlHours = 24 * 30 } = {}) {
  if (/fandom\.com$/.test(host)) assertFandomAllowed(host);
  const out = new Map();
  const missing = new Set();
  const list = [...new Set(titles)].filter(Boolean);
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    const qs = new URLSearchParams({ action: "query", format: "json", formatversion: "2", redirects: "1", titles: chunk.join("|") });
    const res = await politeJson(`https://${host}/api.php?${qs}`, { ttlHours });
    const q = res.json.query || {};
    const norm = new Map((q.normalized || []).map((n) => [n.from, n.to]));
    const redir = new Map((q.redirects || []).map((r) => [r.from, r.to]));
    for (const p of q.pages || []) if (p.missing) missing.add(p.title);
    for (const t of chunk) {
      let cur = norm.get(t) || t;
      let hops = 0;
      while (redir.has(cur) && hops++ < 5) cur = redir.get(cur);
      if (cur !== t && !missing.has(cur)) out.set(t, cur);
    }
  }
  return { redirects: out, missing };
}
