import assert from 'node:assert/strict';
import test from 'node:test';
import {
  equipmentResearchUrl,
  equipmentResearchDecisionError,
  filterEquipmentResearch,
  equipmentReviewCounts,
  equipmentReviewError,
  filterEquipmentVehicles,
  hasEquipmentAlerts,
  isEquipmentJobActive,
  safeEquipmentSourceUrl,
} from './equipment.js';

const vehicles = [
  { id: '100', brand: 'Citroën', model: 'C4', modelYear: '2024', engine: '1.6', reviewKey: 'current-a', change: 'new', findings: [{ severity: 'info', code: 'research-needed' }] },
  { id: '200', brand: 'Honda', model: 'Civic', modelYear: '2023', engine: '2.0', reviewKey: 'current-b', change: 'changed', findings: [{ severity: 'high', code: 'unit-source-conflict' }] },
  { id: '300', brand: 'Fiat', model: 'Fastback', modelYear: '2025', engine: '1.0', reviewKey: 'current-c', change: 'unchanged', findings: [{ severity: 'medium', code: 'check-source' }] },
];

test('research keeps presence, authorization and refusal as distinct per-item decisions', () => {
  assert.equal(equipmentResearchDecisionError({ status: 'presence_confirmed', present: true, note: 'Conferido' }), '');
  assert.match(equipmentResearchDecisionError({ status: 'presence_confirmed', present: true, authorizePublication: true, note: 'Conferido' }), /não autoriza/);
  const authorization = { status: 'authorized', present: true, authorizePublication: true, marketConfirmed: true,
    note: 'Aprovado este texto', confirmationReference: 'Responsável', approvedText: { name: 'Item exato', description: 'Item exato' } };
  assert.equal(equipmentResearchDecisionError(authorization), '');
  for (const patch of [{ present: false }, { authorizePublication: false }, { marketConfirmed: false },
    { confirmationReference: '' }, { approvedText: { name: '', description: 'Outro' } }]) {
    assert.ok(equipmentResearchDecisionError({ ...authorization, ...patch }));
  }
  assert.equal(equipmentResearchDecisionError({ status: 'excluded', present: true, note: 'Presente, mas não anunciar' }), '');
});

test('research filters individual decisions without turning a vehicle review into item approval', () => {
  const rows = [
    { key: 'a', status: 'pending', candidate: { identity: { id: '99', brand: 'Citroën', model: 'C4', modelYear: 2024 }, item: { label: 'Sensor de chuva' } } },
    { key: 'b', status: 'presence_confirmed', candidate: { identity: { id: '99', brand: 'Citroën', model: 'C4', modelYear: 2024 }, item: { label: 'Teto solar' } } },
  ];
  assert.deepEqual(filterEquipmentResearch(rows, 'citroen', 'pending').map((row) => row.key), ['a']);
  assert.deepEqual(filterEquipmentResearch(rows, 'teto', 'all').map((row) => row.key), ['b']);
  assert.deepEqual(filterEquipmentResearch(rows, '', 'authorized'), []);
});

test('only reviews of the current report signature count as reviewed', () => {
  const reviews = { 'previous-a': { status: 'reviewed' }, 'current-b': { status: 'reviewed' }, 'current-c': { status: 'pending' } };
  assert.deepEqual(equipmentReviewCounts(vehicles, reviews), { vehicles: 3, pending: 2, reviewed: 1, withAlerts: 2 });
  assert.deepEqual(filterEquipmentVehicles(vehicles, reviews, 'pending').map((vehicle) => vehicle.id), ['100', '300']);
  assert.deepEqual(filterEquipmentVehicles(vehicles, reviews, 'reviewed').map((vehicle) => vehicle.id), ['200']);
});

test('informational research reminders do not inflate alert counts', () => {
  assert.equal(hasEquipmentAlerts(vehicles[0]), false);
  assert.equal(hasEquipmentAlerts({}), false);
  assert.deepEqual(filterEquipmentVehicles(vehicles, {}, 'alerts').map((vehicle) => vehicle.id), ['200', '300']);
});

test('search handles accents, identity and model year while retaining the selected filter', () => {
  assert.equal(filterEquipmentVehicles(vehicles, {}, 'new', ' CITROEN ')[0]?.id, '100');
  assert.equal(filterEquipmentVehicles(vehicles, {}, 'changed', '2023')[0]?.id, '200');
  assert.equal(filterEquipmentVehicles(vehicles, {}, 'new', 'Civic').length, 0);
  assert.equal(filterEquipmentVehicles(vehicles, {}, 'all', '300')[0]?.model, 'Fastback');
});

test('research links are encoded Google queries even when data contains URL syntax', () => {
  const query = 'Civic 2024 &q=outro # javascript:alert(1)';
  const url = new URL(equipmentResearchUrl({ researchQuery: query }));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/search');
  assert.deepEqual([...url.searchParams], [['q', query]]);
  assert.equal(url.hash, '');
});

test('review sources allow HTTPS only and reject credentials and oversized values', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:pass@example.com', '//example.com', `https://example.com/${'a'.repeat(2048)}`]) {
    assert.equal(safeEquipmentSourceUrl(value), null);
  }
  assert.equal(safeEquipmentSourceUrl(' https://www.honda.com.br/catalogo.pdf '), 'https://www.honda.com.br/catalogo.pdf');
});

test('a concluded review requires a note and reopening permits an empty note', () => {
  assert.match(equipmentReviewError('reviewed', '  ', ''), /nota/);
  assert.match(equipmentReviewError('reviewed', 'a'.repeat(2001), ''), /2000/);
  assert.match(equipmentReviewError('reviewed', 'Conferido', 'http://example.com'), /HTTPS/);
  assert.equal(equipmentReviewError('reviewed', 'Conferido no catálogo, página 12', 'https://example.com/catalogo.pdf'), '');
  assert.equal(equipmentReviewError('pending', '', ''), '');
});

test('both queued and running audit jobs prevent a duplicate run', () => {
  assert.equal(isEquipmentJobActive({ status: 'queued' }), true);
  assert.equal(isEquipmentJobActive({ status: 'running' }), true);
  for (const status of ['succeeded', 'failed', undefined]) assert.equal(isEquipmentJobActive({ status }), false);
  assert.equal(isEquipmentJobActive(null), false);
});
