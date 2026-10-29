import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEquipmentDaily } from '../../../scripts/run-equipment-daily.mjs';

test('daily job audits, discovers and checks the public weekly gate through fixed commands', async () => {
  const calls = [];
  await runEquipmentDaily({ stateDir: '/workspace/.devops/equipment', input: '/workspace/docs/equipment-research-library.json', workspaceRoot: '/workspace',
    execute: async (args, cwd) => { calls.push({ args, cwd }); } });
  assert.equal(calls.length, 4);
  assert.equal(calls[0].args[2], 'scripts/audit-vehicle-equipment.ts');
  assert.equal(calls[1].args[2], 'scripts/review-vehicle-equipment.ts');
  assert.equal(calls[1].args[3], 'discover');
  assert.ok(calls[1].args.includes('--expand-exact-matches'));
  assert.ok(calls[1].args.includes('--research-progress'));
  assert.ok(calls[1].args.includes('--public-observations'));
  assert.equal(calls[1].cwd, '/workspace');
  assert.deepEqual(calls[2], { args: ['--import', 'tsx', 'scripts/audit-equipment-public.ts', '--state-dir', '/workspace/.devops/equipment'], cwd: '/workspace' });
  assert.deepEqual(calls[3], { args: ['scripts/monitor-stock-google.mjs', '--state-dir', '/workspace/.devops/equipment/seo-discovery'], cwd: '/workspace' });
  assert.ok(!calls.some(({ args }) => args.some((value) => /^(?:apply|deploy|build|decide|publish)/.test(value))));
});

test('manual audit forces only the public check, keeping discovery and review safeguards', async () => {
  const calls = [];
  await runEquipmentDaily({ stateDir: '/private', input: '/library.json', forcePublic: true,
    execute: async (args) => calls.push(args) });
  assert.equal(calls.length, 4);
  assert.ok(!calls[0].includes('--force') && !calls[1].includes('--force'));
  assert.deepEqual(calls[2], ['--import', 'tsx', 'scripts/audit-equipment-public.ts', '--state-dir', '/private', '--force']);
});

test('bootstrap evidence never replaces existing private research or public observations', async () => {
  const calls = [];
  await runEquipmentDaily({ stateDir: '/workspace/.devops/equipment', input: '/library.json', workspaceRoot: '/workspace',
    pathExists: () => true, execute: async (args) => calls.push(args) });
  assert.ok(!calls[1].includes('--research-progress'));
  assert.ok(!calls[1].includes('--public-observations'));
  const firstOnly = [];
  await runEquipmentDaily({ stateDir: '/workspace/.devops/equipment', input: '/library.json', workspaceRoot: '/workspace',
    pathExists: (path) => path.endsWith('research-progress.json'), execute: async (args) => firstOnly.push(args) });
  assert.ok(!firstOnly[1].includes('--research-progress'));
  assert.ok(firstOnly[1].includes('--public-observations'));
});

test('audit failure never runs discovery or changes its previous successful state', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'equipment-daily-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'research-discovery.json');
  writeFileSync(file, '{"last":"successful"}\n');
  let calls = 0;
  await assert.rejects(runEquipmentDaily({ stateDir: dir, input: '/library.json', execute: async () => { calls++; throw new Error('audit failed'); } }), /audit failed/);
  assert.equal(calls, 2); // source failure still permits the independent SEO stage
  assert.equal(readFileSync(file, 'utf8'), '{"last":"successful"}\n');
});

test('discovery failure fails the combined job while retaining each last successful artifact', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'equipment-daily-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const audit = join(dir, 'report.json'); const discovery = join(dir, 'research-discovery.json');
  writeFileSync(discovery, 'previous discovery');
  await assert.rejects(runEquipmentDaily({ stateDir: dir, input: '/library.json', execute: async (args) => {
    if (args[2].includes('audit-')) writeFileSync(audit, 'current valid audit');
    else throw new Error('research failed');
  } }), /research failed/);
  assert.equal(readFileSync(audit, 'utf8'), 'current valid audit');
  assert.equal(readFileSync(discovery, 'utf8'), 'previous discovery');
});

test('public check failure preserves completed source reports and review decisions', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'equipment-daily-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const reviews = join(dir, 'reviews.json');
  writeFileSync(reviews, '{"reviewed":"preserve"}');
  let stages = 0;
  await assert.rejects(runEquipmentDaily({ stateDir: dir, input: '/library.json', execute: async (args) => {
    stages++;
    if (args[2] === 'scripts/audit-vehicle-equipment.ts') writeFileSync(join(dir, 'report.json'), 'valid audit');
    else if (args[2] === 'scripts/review-vehicle-equipment.ts') writeFileSync(join(dir, 'research-stock.json'), 'valid source snapshot');
    else throw new Error('public check incomplete');
  } }), /public check incomplete/);
  assert.equal(stages, 4);
  assert.equal(readFileSync(join(dir, 'report.json'), 'utf8'), 'valid audit');
  assert.equal(readFileSync(join(dir, 'research-stock.json'), 'utf8'), 'valid source snapshot');
  assert.equal(readFileSync(reviews, 'utf8'), '{"reviewed":"preserve"}');
});

test('SEO failure cannot fail completed equipment work', async () => {
  const calls = [];
  await runEquipmentDaily({ stateDir: '/private', input: '/library.json', execute: async (args) => {
    calls.push(args);
    if (args[0] === 'scripts/monitor-stock-google.mjs') throw new Error('Google unavailable');
  } });
  assert.equal(calls.length, 4);
});
