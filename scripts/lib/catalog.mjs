import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(rootDir, relativePath), "utf8"));
}

export function loadCatalog() {
  const gradesDoc = readJson("data/grades.json");
  const kitsDoc = readJson("data/kits.json");
  const sourcesDoc = readJson("data/sources.json");
  return {
    gradesDoc,
    kitsDoc,
    sourcesDoc,
    grades: gradesDoc.grades,
    kits: kitsDoc.kits,
    sources: sourcesDoc.sources,
    gradeByCode: new Map(gradesDoc.grades.map((grade) => [grade.code, grade])),
    sourceById: new Map(sourcesDoc.sources.map((source) => [source.source_id, source])),
  };
}

export function kitName(kit) {
  return kit.names.en || kit.names.zh || kit.names.ja || kit.kit_id;
}

export function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

export function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

export function printTable(headers, rows) {
  const widths = headers.map((header, index) => {
    const values = rows.map((row) => String(row[index] ?? ""));
    return Math.max(String(header).length, ...values.map((value) => value.length));
  });

  const renderRow = (row) => row.map((cell, index) => String(cell ?? "").padEnd(widths[index])).join("  ");
  console.log(renderRow(headers));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(renderRow(row));
  }
}

export function isDateLike(value) {
  return value === null || /^\d{4}(-\d{2}){0,2}$/.test(value);
}
