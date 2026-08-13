#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = join(root, "dist", "index.html");
const html = readFileSync(htmlPath, "utf8");
const stylesheetPattern = /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g;
let replacements = 0;

const optimized = html.replace(stylesheetPattern, (tag, href) => {
  replacements += 1;
  return [
    `<link rel="preload" as="style" crossorigin href="${href}" onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript>${tag}</noscript>`,
  ].join("\n    ");
});

if (replacements === 0) {
  throw new Error("CSS principal não encontrado no dist/index.html");
}

writeFileSync(htmlPath, optimized);
console.log(`CSS não bloqueante aplicado: ${replacements} arquivo(s).`);
