import { kitName, loadCatalog, normalizeText, printTable } from "./lib/catalog.mjs";

const { kits } = loadCatalog();
const args = process.argv.slice(2);
const filters = {
  grade: null,
  status: null,
  term: [],
};

for (const arg of args) {
  if (arg.startsWith("--grade=")) {
    filters.grade = arg.slice("--grade=".length).toUpperCase();
  } else if (arg.startsWith("--status=")) {
    filters.status = arg.slice("--status=".length);
  } else {
    filters.term.push(arg);
  }
}

const term = normalizeText(filters.term.join(" "));
const matches = kits.filter((kit) => {
  if (filters.grade && kit.grade_code !== filters.grade) {
    return false;
  }
  if (filters.status && kit.data_status !== filters.status) {
    return false;
  }
  if (!term) {
    return true;
  }

  const haystack = [
    kit.kit_id,
    kit.grade_code,
    kit.subline,
    kit.scale,
    kit.names.ja,
    kit.names.en,
    kit.names.zh,
    kit.universe,
    kit.work_title,
    ...(kit.tags ?? []),
  ]
    .map(normalizeText)
    .join(" ");

  return haystack.includes(term);
});

if (!matches.length) {
  console.log("No kits matched.");
  process.exit(0);
}

printTable(
  ["Kit ID", "Grade", "Scale", "Name", "Universe", "Status"],
  matches.map((kit) => [kit.kit_id, kit.grade_code, kit.scale, kitName(kit), kit.universe, kit.data_status]),
);
