import { readFile, writeFile } from "node:fs/promises";

const file = new URL("../public/campaigns/black-friday-2026.json", import.meta.url);
const config = JSON.parse(await readFile(file, "utf8"));
if (config.id !== "black-friday-2026" || typeof config.enabled !== "boolean") {
  throw new Error("Configuração inesperada; nenhuma alteração realizada.");
}
await writeFile(file, `${JSON.stringify({ ...config, enabled: false }, null, 2)}\n`);
console.log("Black Friday desativada neste checkout. Publique esta configuração pelo fluxo Netcar para aplicar ao site público.");
