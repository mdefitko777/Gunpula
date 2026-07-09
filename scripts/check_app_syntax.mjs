import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Parses the browser ES modules without executing them (no DOM here).
// Requires: node --experimental-vm-modules scripts/check_app_syntax.mjs
const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = ["app/main.js", "app/i18n.js", "app/auth.js", "app/sync-config.js"];

let failed = false;
for (const file of files) {
  const source = await readFile(resolve(rootDir, file), "utf8");
  try {
    new vm.SourceTextModule(source, { identifier: file });
    console.log(`${file}: syntax OK`);
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error.message}`);
  }
}

if (failed) {
  process.exit(1);
}
