import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Stages the Capacitor webDir: app/ + data/ side by side so the app's
// relative ../data fetches keep working inside the native shell.
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const wwwDir = resolve(rootDir, "www");

const EXCLUDED_FILES = new Set(["market_secrets.local.json"]);

await rm(wwwDir, { recursive: true, force: true });
await mkdir(wwwDir, { recursive: true });

await cp(resolve(rootDir, "app"), resolve(wwwDir, "app"), { recursive: true });
await cp(resolve(rootDir, "data"), resolve(wwwDir, "data"), {
  recursive: true,
  filter: (source) => !EXCLUDED_FILES.has(basename(source)),
});

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
