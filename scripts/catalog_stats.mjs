import { countBy, loadCatalog, printTable } from "./lib/catalog.mjs";

const { grades, kits } = loadCatalog();

console.log(`Grades: ${grades.length}`);
console.log(`Kits: ${kits.length}`);

function printCounts(title, rows) {
  console.log(`\n${title}`);
  printTable(["Value", "Count"], rows);
}

printCounts("By grade", countBy(kits, (kit) => kit.grade_code));
printCounts("By scale", countBy(kits, (kit) => kit.scale));
printCounts("By universe", countBy(kits, (kit) => kit.universe));
printCounts("By data status", countBy(kits, (kit) => kit.data_status));
