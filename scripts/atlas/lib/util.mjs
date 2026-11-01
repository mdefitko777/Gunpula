// Shared helpers for the Hobby Atlas data jobs: file IO, normalisation keys.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const ATLAS_DATA = path.join(REPO_ROOT, "data", "atlas");
export const repoPath = (...parts) => path.join(REPO_ROOT, ...parts);

export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export async function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}

const stripVolatile = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { updated_at, generated_at, ...rest } = value;
  return rest;
};

/**
 * Write compact JSON. When `skipIfSame` (default) and only `updated_at`/`generated_at` would
 * change, the file is left untouched so weekly runs do not create empty-diff commits.
 * Returns {path, bytes, written}.
 */
export async function writeCompactJson(file, value, { skipIfSame = true } = {}) {
  const text = JSON.stringify(value);
  if (skipIfSame) {
    const previous = await readJson(file, null);
    if (previous && JSON.stringify(stripVolatile(previous)) === JSON.stringify(stripVolatile(value))) {
      const prevText = await readFile(file, "utf8");
      return { path: file, bytes: Buffer.byteLength(prevText), written: false };
    }
  }
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, file);
  return { path: file, bytes: Buffer.byteLength(text), written: true };
}

export const nfkc = (s) => String(s ?? "").normalize("NFKC");

// Dash-like characters that appear inside model numbers in Japanese text.
const DASHES = /[‐-―−ー－⁃˗]/g;
// Same without the katakana long-vowel mark (ー is part of names, e.g. ゼータ, ダブルオー).
const NAME_DASHES = /[‐-―−－⁃˗]/g;

/** Model number key: NFKC, upper case, unified dashes, no spaces. */
export function modelKey(s) {
  return nfkc(s).toUpperCase().replace(DASHES, "-").replace(/\s+/g, "").replace(/[［\[]/g, "[").replace(/[］\]]/g, "]");
}

// Spelling aliases applied before separators are removed. Order matters.
const NAME_ALIASES = [
  [/ダブルゼータ/g, "zz"],
  [/ゼータ/g, "z"],
  [/ζ/g, "z"],
  [/ダブルオー/g, "00"],
  [/ターンエー/g, "∀"],
  [/ターンエックス/g, "turnx"],
  [/ターンx/g, "turnx"],
  [/hi[-‐－⁻]?ν|ハイニュー/g, "hiν"],
  [/ニュー(?=ガンダム)/g, "ν"],
  [/ジ[・･]?o(?![a-z])/g, "ジオ"],
  [/ジ[・･]オ(?!ン)/g, "ジオ"],
  [/クシー(?=ガンダム)/g, "ξ"],
  [/(?<![ァ-ヶ])オーガンダム/g, "oガンダム"],
  [/ヴ[ィイ]クトリーツー/g, "v2"],
  [/ヴ[ィイ]クトリー(?=ガンダム|ダッシュ)/g, "v"],
  [/vダッシュ/g, "v-dash"],
  [/ガンダムエックス/g, "ガンダムx"],
  [/(?<![a-zァ-ヶ])wガンダム/g, "ウイングガンダム"], // "Wガンダムゼロ(EW版)"
  [/(?<![a-zァ-ヶ])gガンダム/g, "ゴッドガンダム"], // God Gundam is sold as "Gガンダム"
  [/旧型?ザク(?!i)/g, "ザクi"],
  [/モビル(?=ジン|シグー|バク[ゥウ]|ディン|グーン)/g, ""], // small kana are already enlarged here
  [/イージーエイト/g, "ez8"],
  [/デスサイズh(?![a-z])/g, "デスサイズヘル"],
  [/ガンダムmk-?/g, "ガンダムmk"],
  [/マークツー|マーク2/g, "mk2"],
  [/[ⅰ-ⅿ]/g, (c) => c.normalize("NFKC")],
];

/**
 * Name key used for exact and contains matching: NFKC, lower case, spelling aliases,
 * roman numerals II/III -> 2/3, separators and brackets removed.
 */
export function nameKey(s) {
  let x = nfkc(s)
    .toLowerCase()
    .replace(NAME_DASHES, "-")
    // small vowel kana spelled either way (クィン・マンサ / クインマンサ)
    .replace(/[ァィゥェォ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
  for (const [re, to] of NAME_ALIASES) x = x.replace(re, to);
  x = x.replace(/[\s・･·\-_.,:：;!！?？'"“”‘’「」『』()（）\[\]［］{}<>＜＞〈〉《》~～〜=＝+＋&＆/／\\|★☆♪#＃*※]/g, "");
  x = x
    .replace(/mkiii/g, "mk3").replace(/mkii/g, "mk2").replace(/mkiv/g, "mk4").replace(/mkv(?![a-z])/g, "mk5")
    .replace(/(?<![a-z])iii/g, "3").replace(/(?<![a-z])ii/g, "2");
  return x;
}

export const hasJapanese = (s) => /[぀-ヿ一-鿿]/.test(String(s || ""));

export function uniq(arr) {
  return [...new Set(arr.filter((v) => v !== undefined && v !== null && v !== ""))];
}

export function countBy(arr, fn) {
  const out = {};
  for (const item of arr) {
    const k = fn(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
