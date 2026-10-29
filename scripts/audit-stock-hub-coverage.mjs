#!/usr/bin/env node

// Read-only coverage check for the existing CARIMBO daily review. Reuses a
// complete snapshot already collected by the workflow; no API request or write.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modelLanding } from './generate-landings.js';
import { MODEL_HUBS } from './lib/stock-model-hubs.mjs';
import { BRAND_BUYER_GUIDES } from './lib/brand-buyer-guides.mjs';
import { MODEL_BUYER_GUIDES } from './lib/model-buyer-guides.mjs';

const normalized = (value) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

function publicStock(input) {
  if (!input || !Array.isArray(input.vehicles) || !input.vehicles.length ||
      !Number.isFinite(Date.parse(input.generatedAt || '')) || input.complete === false ||
      (input.total != null && Number(input.total) !== input.vehicles.length)) {
    throw new Error('complete_nonempty_stock_snapshot_required');
  }
  const seen = new Set();
  return input.vehicles.map((vehicle) => {
    const id = String(vehicle?.id ?? '');
    const brand = typeof vehicle?.marca === 'string' ? vehicle.marca.trim() : '';
    const model = typeof vehicle?.modelo === 'string' ? vehicle.modelo.trim() : '';
    const price = Number(vehicle?.valor ?? vehicle?.price);
    if (!/^\d{1,12}$/.test(id) || seen.has(id) || !brand || !model ||
        brand.length > 80 || model.length > 180 || !Number.isFinite(price) || price <= 0) {
      throw new Error('invalid_or_duplicate_stock_record');
    }
    seen.add(id);
    // Whitelist only. Never serialize source objects, plates, links or media.
    return { id, marca: brand, modelo: model,
      categoria: normalized(vehicle.categoria), valor: price };
  }).sort((left, right) => left.id.localeCompare(right.id, 'en', { numeric: true }));
}

/** Snapshot completeness is the caller's responsibility; this is not a crawler. */
export function auditStockHubCoverage(input, {
  hubs = MODEL_HUBS, brandGuides = BRAND_BUYER_GUIDES, modelGuides = MODEL_BUYER_GUIDES,
} = {}) {
  const stock = publicStock(input);
  if (!Array.isArray(hubs) || !hubs.length || new Set(hubs.map((hub) => hub.slug)).size !== hubs.length ||
      hubs.some((hub) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(hub.slug || '') || !hub.marca || !hub.modelo)) {
    throw new Error('invalid_hub_registry');
  }
  const brands = [...new Set(stock.map((vehicle) => normalized(vehicle.marca)))].sort();
  const missingBrandGuides = brands.filter((brand) => !own(brandGuides, brand));
  const missingModelGuides = hubs.filter((hub) => !own(modelGuides, hub.slug)).map((hub) => hub.slug).sort();
  const vehicles = stock.map((vehicle) => {
    // Use the exact generator's brand, model-boundary and category rules.
    const matches = hubs.filter((hub) => modelLanding(hub, [vehicle]).count === 1);
    const warnings = matches.filter((hub) => !hub.categoria &&
      /\bHATCH\b/.test(normalized(vehicle.modelo)) && normalized(hub.category) === 'SEDAN')
      .map((hub) => ({ code: 'body_style_requires_review', slug: hub.slug }));
    return { id: vehicle.id, marca: vehicle.marca, modelo: vehicle.modelo,
      status: matches.length === 0 ? 'none' : matches.length === 1 ? 'covered' : 'multiple',
      hubSlugs: matches.map((hub) => hub.slug).sort(), warnings };
  });
  const fingerprint = createHash('sha256').update(JSON.stringify(stable({
    // Price changes do not create a new model-family task. Live stock handles price.
    stock: stock.map(({ valor, ...vehicle }) => vehicle),
    hubs: [...hubs].sort((a, b) => a.slug.localeCompare(b.slug)), brandGuides, modelGuides,
  }))).digest('hex');
  const counts = { vehicles: vehicles.length, brands: brands.length,
    covered: vehicles.filter((vehicle) => vehicle.status === 'covered').length,
    none: vehicles.filter((vehicle) => vehicle.status === 'none').length,
    multiple: vehicles.filter((vehicle) => vehicle.status === 'multiple').length,
    warnings: vehicles.reduce((count, vehicle) => count + vehicle.warnings.length, 0),
    missingBrandGuides: missingBrandGuides.length, missingModelGuides: missingModelGuides.length };
  return { schemaVersion: 1, sourceGeneratedAt: input.generatedAt, fingerprint,
    status: counts.none || counts.multiple || counts.warnings || counts.missingBrandGuides || counts.missingModelGuides
      ? 'needs_review' : 'covered',
    counts, missingBrandGuides, missingModelGuides, vehicles,
    notice: 'Coverage applies only to the supplied snapshot. It does not prove current API completeness, publication, indexing or ranking.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--input' || !args[1] || args[1].startsWith('--')) {
      throw new Error('usage');
    }
    const inputPath = resolve(args[1]);
    const info = statSync(inputPath);
    if (!info.isFile() || info.size > 25 * 1024 * 1024) throw new Error('invalid_input_file');
    const report = auditStockHubCoverage(JSON.parse(readFileSync(inputPath, 'utf8')));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    // Avoid exposing source content or paths in parser error strings.
    process.stderr.write('Cobertura não conferida. Use --input JSON com snapshot completo, datado e não vazio; nenhum arquivo foi alterado.\n');
    process.exitCode = 1;
  }
}
