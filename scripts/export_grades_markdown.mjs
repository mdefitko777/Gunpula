import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataFile = resolve(__dirname, "..", "data", "grades.json");
const data = JSON.parse(readFileSync(dataFile, "utf8"));

const formatScales = (scales) => scales.join(", ");
const grades = [...data.grades].sort((a, b) => {
  const byCategory = a.category.localeCompare(b.category);
  return byCategory || a.code.localeCompare(b.code);
});

console.log("| Code | 中文 | English | Category | Scale | Status |");
console.log("|---|---|---|---|---|---|");

for (const grade of grades) {
  console.log(
    `| ${grade.code} | ${grade.name_zh} | ${grade.name_en} | ${grade.category} | ${formatScales(
      grade.typical_scale,
    )} | ${grade.status} |`,
  );
}
