#!/usr/bin/env node
// Validate MEZASTAR data files: schema basics, unique tag/printing ids, aliases, and (with
// --against=<git ref>) that every id published in that revision still resolves.
//
//   node scripts/atlas/mezastar/check.mjs data/atlas/mezastar-intl.json data/atlas/mezastar-jp.json [--against=HEAD]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkOutput } from "./lib/ids.mjs";

const args = process.argv.slice(2);
const against = (args.find((a) => a.startsWith("--against=")) || "").split("=")[1] || null;
const files = args.filter((a) => !a.startsWith("--"));
let failed = false;
for (const file of files) {
  let out;
  try { out = JSON.parse(readFileSync(file, "utf8")); } catch (e) { console.error(`${file}: unreadable (${e.message})`); failed = true; continue; }
  const errors = [];
  if (out.schema !== 1 || !Array.isArray(out.sets) || !Array.isArray(out.tags) || !out.tags.length || !Array.isArray(out.sources) || !out.sources.length) errors.push("bad top-level shape");
  for (const s of out.sources || []) if (!s.name || !s.url || !s.licence) errors.push(`source without name/url/licence: ${JSON.stringify(s).slice(0, 80)}`);
  let prev = null;
  if (against) {
    const rel = path.relative(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(), path.resolve(file)).split(path.sep).join("/");
    try { prev = JSON.parse(execFileSync("git", ["show", `${against}:${rel}`], { encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] })); } catch { prev = null; }
  }
  errors.push(...checkOutput(out, prev));
  const printings = out.tags.reduce((n, t) => n + t.printings.length, 0);
  if (errors.length) { failed = true; for (const e of errors) console.error(`${file}: ${e}`); }
  else console.log(`${file}: ok (${out.tags.length} tags, ${printings} printings, ${Object.keys(out.aliases || {}).length} aliases${prev ? `, all ids of ${against} still resolve` : ""})`);
}
process.exit(failed ? 1 : 0);
