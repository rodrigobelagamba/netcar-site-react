import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

// This is a publication of the SAME authority used by tests and reconciliation,
// never an independently edited inventory or second source of approvals.
const source = new URL("../src/data/factoryWarrantyMatrix.json", import.meta.url);
const matrix = JSON.parse(readFileSync(source, "utf8"));
if (matrix.schemaVersion !== 2 || matrix.requireUnitBinding !== true || !Array.isArray(matrix.records)) {
  throw new Error("Matriz de garantias não habilitada para identidade estável");
}
const directory = new URL("../public/seo/", import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL("factory-warranty-registry.json", directory), `${JSON.stringify(matrix)}\n`);
console.log(`Registro publicado gerado da matriz canônica: ${matrix.records.length} registros.`);
