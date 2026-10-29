import assert from 'node:assert/strict';
import test from 'node:test';
import { auditStockHubCoverage } from '../audit-stock-hub-coverage.mjs';

const at = '2026-10-29T14:00:00.000Z';
const row = (overrides = {}) => ({ id: 1, marca: 'HONDA', modelo: 'CITY EX', price: 99000, categoria: 'HATCH', ...overrides });
const hub = { slug: 'honda-city', marca: 'HONDA', modelo: 'CITY', name: 'Honda City', category: 'SEDAN' };
const options = { hubs: [hub], brandGuides: { HONDA: { intro: 'Honda' } }, modelGuides: { 'honda-city': { intro: 'City' } } };
const snapshot = (vehicles = [row()]) => ({ generatedAt: at, vehicles });

test('uses generator category correction and only reports whitelisted public fields', () => {
  const result = auditStockHubCoverage(snapshot([row({ placa: 'PRIVATE-PLATE', chassi: 'PRIVATE-VIN', renavam: 'PRIVATE-RENAVAM' })]), options);
  assert.equal(result.status, 'covered');
  assert.equal(result.counts.covered, 1);
  assert.deepEqual(result.vehicles[0].hubSlugs, ['honda-city']);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|placa|chassi|renavam|price|valor/);
});

test('unknown families and missing brand guides stay pending without guessing a slug', () => {
  const result = auditStockHubCoverage(snapshot([row({ marca: 'NEW BRAND', modelo: 'NEW FULL FAMILY TURBO' })]), options);
  assert.equal(result.status, 'needs_review');
  assert.equal(result.vehicles[0].status, 'none');
  assert.deepEqual(result.vehicles[0].hubSlugs, []);
  assert.deepEqual(result.missingBrandGuides, ['NEW BRAND']);
});

test('overlapping family prefixes are detected and do not count as covered', () => {
  const result = auditStockHubCoverage(snapshot(), { ...options, hubs: [hub, { ...hub, slug: 'honda-city-ex', modelo: 'CITY EX' }] });
  assert.equal(result.vehicles[0].status, 'multiple');
  assert.equal(result.counts.covered, 0);
  assert.deepEqual(result.missingModelGuides, ['honda-city-ex']);
});

test('a single match is still flagged when explicit hatch enters a sedan hub', () => {
  const result = auditStockHubCoverage(snapshot([row({ modelo: 'CITY HATCH EX' })]), options);
  assert.equal(result.status, 'needs_review');
  assert.equal(result.counts.covered, 1);
  assert.deepEqual(result.vehicles[0].warnings, [{ code: 'body_style_requires_review', slug: 'honda-city' }]);
});

test('fingerprint is stable across input ordering, date, price and private metadata', () => {
  const first = auditStockHubCoverage(snapshot([row(), row({ id: 2 })]), options);
  const second = auditStockHubCoverage({ generatedAt: '2026-10-30T14:00:00.000Z', vehicles: [row({ id: 2, price: 100000 }), row({ placa: 'not-part-of-fingerprint' })] }, options);
  assert.equal(first.fingerprint, second.fingerprint);
  const changed = auditStockHubCoverage(snapshot([row({ modelo: 'CITY HATCH' }), row({ id: 2 })]), options);
  assert.notEqual(first.fingerprint, changed.fingerprint);
});

test('invalid, empty, partial and duplicate snapshots fail closed', () => {
  for (const input of [null, [], snapshot([]), { vehicles: [row()] }, { ...snapshot(), complete: false },
    { ...snapshot(), total: 2 }, snapshot([row(), row()]), snapshot([row({ price: 0 })]),
    snapshot([row({ id: 'PRIVATE' })]), snapshot([row({ modelo: '' })])]) {
    assert.throws(() => auditStockHubCoverage(input, options));
  }
});
