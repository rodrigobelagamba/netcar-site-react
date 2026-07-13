#!/usr/bin/env node

/**
 * Gera feeds estáticos do estoque Netcar no formato Meta Commerce (E-commerce)
 * para a loja do WhatsApp Business.
 *
 * Fonte: API JSON do site (não precisa copiar XML na mão).
 *
 * Uso: node scripts/generate-whatsapp-catalog-feed.js
 * Saída:
 *   public/feeds/whatsapp-catalog.csv
 *   public/feeds/whatsapp-catalog.xml
 *
 * Em produção, preferir o endpoint ao vivo:
 *   /feeds/whatsapp-catalog.php?format=csv|xml
 * (sempre lê a API na hora — sem rebuild).
 */

import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";
import {
  buildCatalogRows,
  fetchVehicles,
  rowsToCsv,
  rowsToXml,
} from "./lib/whatsapp-catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT_DIR = join(rootDir, "public", "feeds");
const OUT_CSV = join(OUT_DIR, "whatsapp-catalog.csv");
const OUT_XML = join(OUT_DIR, "whatsapp-catalog.xml");

async function main() {
  const vehicles = await fetchVehicles();
  const { rows, skipped } = buildCatalogRows(vehicles);

  mkdirSync(OUT_DIR, { recursive: true });
  const wroteCsv = writeTextFile(OUT_CSV, rowsToCsv(rows));
  const wroteXml = writeTextFile(OUT_XML, rowsToXml(rows));

  console.log(
    `[whatsapp-catalog] ${rows.length} produtos, ${skipped} ignorados`
  );
  console.log(
    `[whatsapp-catalog] CSV → ${OUT_CSV}${wroteCsv ? "" : " (sem mudanças)"}`
  );
  console.log(
    `[whatsapp-catalog] XML → ${OUT_XML}${wroteXml ? "" : " (sem mudanças)"}`
  );
}

main().catch((err) => {
  // Build no container às vezes falha em fetch transitório; feed vivo é o PHP.
  // Não derruba deploy — mantém CSV/XML já em public/feeds/.
  console.warn(
    "[whatsapp-catalog] aviso (seguindo build):",
    err.message || err
  );
  process.exit(0);
});
