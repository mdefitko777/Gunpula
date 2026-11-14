// Image search data (scripts/imgsim/*.py, .github/workflows/imgsim.yml): which catalog images are indexed, the
// vectors file installed apps parse, the two manifests (imgsim.json for installed apps, imgsim-v2.json with the
// B/16 model) and the daily "upload only what changed" rule. The checks are Python (scripts/imgsim/test_imgsim_lib.py)
// because the pipeline is; they need no numpy or model.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PY_CHECK = "import sys; assert sys.version_info >= (3, 9)";

const python = ["python3", "python"].find((py) => spawnSync(py, ["-I", "-c", PY_CHECK], { encoding: "utf8" }).status === 0);
if (python) {
  // -B / PYTHONDONTWRITEBYTECODE: no __pycache__ left in the checkout
  const res = spawnSync(python, ["-I", "-B", path.join(ROOT, "scripts", "imgsim", "test_imgsim_lib.py"), ROOT], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  process.stdout.write(res.stdout);
} else {
  console.log("test_imgsim: Python 3.9+ not found, skipped");
}

console.log("test_imgsim: ok");
