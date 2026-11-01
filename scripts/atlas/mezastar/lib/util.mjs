import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s) {
  if (!s) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export const stripTags = (s) => decodeEntities(String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const nfkc = (s) => (s == null ? s : String(s).normalize("NFKC").trim());

export const pad3 = (n) => String(n).padStart(3, "0");

export function ymd(y, m, d) {
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if (!yy || !mm || !dd || mm > 12 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** First date written as 2026年9月24日 or 2026년 8월 03일 (full-width digits allowed). */
export function firstCjkDate(text) {
  const t = nfkc(stripTags(text || ""));
  const m = t.match(/(20\d{2})\s*[年년]\s*(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]/);
  return m ? ymd(m[1], m[2], m[3]) : null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function monthIndex(name) {
  const n = String(name || "").toLowerCase().slice(0, 3);
  const i = MONTHS.findIndex((m) => m.startsWith(n));
  return i >= 0 ? i + 1 : null;
}

/** "April 18, 2024" -> 2024-04-18 */
export function enDate(text) {
  const m = String(text || "").match(/([A-Z][a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (!m) return null;
  const mo = monthIndex(m[1]);
  return mo ? ymd(m[3], mo, m[2]) : null;
}

export const slug = (s) =>
  nfkc(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const sha8 = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 8);

export function absUrl(src, base) {
  if (!src) return null;
  try {
    return new URL(decodeEntities(src.trim()), base).href;
  } catch {
    return null;
  }
}

export async function readJsonMaybe(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/** Remove null/undefined/empty-array/empty-object members recursively (keeps 0 and false). */
export function prune(v) {
  if (Array.isArray(v)) return v.map(prune).filter((x) => x !== undefined);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      const p = prune(x);
      if (p === undefined || p === null) continue;
      if (Array.isArray(p) && p.length === 0) continue;
      if (p && typeof p === "object" && !Array.isArray(p) && Object.keys(p).length === 0) continue;
      o[k] = p;
    }
    return o;
  }
  return v === undefined ? undefined : v;
}

export async function writeCompactJson(file, obj) {
  await mkdir(path.dirname(file), { recursive: true });
  const text = JSON.stringify(obj);
  await writeFile(file, text + "\n", "utf8");
  return { bytes: Buffer.byteLength(text) + 1, gzip: gzipSync(text).length };
}

export const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ""))];

/** Split a MediaWiki template body on top-level pipes (ignores pipes inside {{ }} and [[ ]]). */
export function splitTemplateArgs(body) {
  const out = [];
  let depth = 0, cur = "";
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; cur += two; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; cur += two; i++; continue; }
    if (body[i] === "|" && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Find every {{Name|...}} template occurrence (balanced braces). Returns arg arrays (without the name). */
export function findTemplates(text, name) {
  const res = [];
  const needle = "{{" + name;
  let i = 0;
  while ((i = text.indexOf(needle, i)) >= 0) {
    const after = text[i + needle.length];
    if (after !== "|" && after !== "}") { i += needle.length; continue; }
    let depth = 0, j = i;
    for (; j < text.length - 1; j++) {
      if (text[j] === "{" && text[j + 1] === "{") { depth++; j++; }
      else if (text[j] === "}" && text[j + 1] === "}") { depth--; j++; if (depth === 0) break; }
    }
    const inner = text.slice(i + 2, j - 1);
    const args = splitTemplateArgs(inner);
    args.shift();
    res.push(args);
    i = j + 1;
  }
  return res;
}
