#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "dist", "index.html");
const html = readFileSync(htmlPath, "utf8");
// Mantém o nome do comando para compatibilidade com o pipeline de deploy.
// O CSS estrutural precisa estar aplicado antes da primeira pintura do React.
// Convertê-lo em preload/onload permitia pintar o catálogo sem estilos (FOUC).
const stylesheets = html.match(/<link rel="stylesheet" crossorigin href="[^"]+\.css">/g) || [];
if (stylesheets.length === 0 || /as="style"[^>]*onload=/.test(html)) {
  throw new Error("CSS principal não encontrado no dist/index.html");
}
console.log(`CSS principal preservado antes da pintura: ${stylesheets.length} arquivo(s).`);
