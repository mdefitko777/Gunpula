import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Stages the Capacitor webDir: app/ + data/ side by side so the app's
// relative ../data fetches keep working inside the native shell.
// Heavy files stay out of the APK: the shell prefers live GitHub Pages data,
// kits.json is redundant with data/split, the search index is lazy-loaded,
// and app/assets holds cached images no catalog record references.
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wwwDir = resolve(rootDir, "www");

const EXCLUDED_FILES = new Set(["market_secrets.local.json", "kits.json", "search-index.json"]);
const EXCLUDED_DIRS = new Set([resolve(rootDir, "app", "assets")]);

await rm(wwwDir, { recursive: true, force: true });
await mkdir(wwwDir, { recursive: true });

const stageFilter = (source) => !EXCLUDED_FILES.has(basename(source)) && !EXCLUDED_DIRS.has(resolve(source));

await cp(resolve(rootDir, "app"), resolve(wwwDir, "app"), { recursive: true, filter: stageFilter });
await cp(resolve(rootDir, "data"), resolve(wwwDir, "data"), { recursive: true, filter: stageFilter });
await cp(
  resolve(rootDir, "app", "assets", "announcements"),
  resolve(wwwDir, "app", "assets", "announcements"),
  { recursive: true, force: true },
).catch(() => {});

await writeFile(
  resolve(wwwDir, "index.html"),
  [
    "<!doctype html>",
    '<html lang="zh-CN">',
    '  <head><meta charset="utf-8" /><script>window.location.replace("./app/index.html" + window.location.hash);</script></head>',
    '  <body><a href="./app/index.html">Gunpula</a></body>',
    "</html>",
    "",
  ].join("\n"),
);

console.log("Staged Capacitor webDir at www/ (app + data).");
