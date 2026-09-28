import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createEquipmentRouter } from '../routes/equipment.js';
import {
  createEquipmentService, localAuditTime, MAX_HISTORICAL_REVIEWS, MAX_REVIEW_STATE_BYTES,
} from '../services/equipment.js';

const KEY = 'a'.repeat(64);
const NEW_KEY = 'b'.repeat(64);
function report(reviewKey = KEY) {
  return {
    schemaVersion: 1, generatedAt: '2026-09-28T10:01:00.000Z',
    inputSource: 'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php',
    catalogFingerprint: 'c'.repeat(64),
    counts: { vehicles: 1, new: 1, changed: 0, unchanged: 0, withAlerts: 1 },
    vehicles: [{ id: '20050', brand: 'FIAT', model: 'FASTBACK IMPETUS TURBO', modelYear: 2025,
      engine: '1.0', transmission: 'AUTOMATICO', reviewKey, change: 'new',
      findings: [{ code: 'needs-review', severity: 'info', message: 'Conferir cadastro.' }],
      inventoryDescriptions: ['Park Assist'], displayedDescriptions: ['Assistência de faixa'],
      confirmationIds: ['unit-20050'], researchQuery: 'FIAT Fastback Impetus 2025 catálogo Brasil' }],
  };
}

function harness(t, { now = '2026-09-28T09:59:00.000Z', defaultEnabled = false } = {}) {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'netcar-equipment-api-'));
  const stateDir = join(workspaceRoot, '.devops', 'equipment');
  mkdirSync(stateDir, { recursive: true });
  let date = new Date(now);
  const jobs = new Map();
  const options = [];
  const cronTasks = [];
  const runner = {
    findActiveJob: (kind) => [...jobs.values()].find((job) => job.kind === kind && ['queued', 'running'].includes(job.status)),
    getJob: (id) => jobs.get(id) || null,
    enqueueJob: (opts) => {
      const job = { id: `job-${options.length + 1}`, label: opts.label, kind: opts.meta.kind,
        status: 'queued', createdAt: date.getTime(), startedAt: null, finishedAt: null, exitCode: null, error: null };
      options.push(opts);
      jobs.set(job.id, job);
      return { ...job };
    },
  };
  const cronApi = {
    createTask: (expression, callback, opts) => {
      const task = { expression, callback, opts, active: false, destroyed: false,
        start() { this.active = true; }, stop() { this.active = false; },
        destroy() { this.active = false; this.destroyed = true; },
        getNextRun() { return this.active ? new Date('2026-09-29T10:00:00Z') : null; } };
      cronTasks.push(task);
      return task;
    },
  };
  const services = [];
  const createService = (overrides = {}) => {
    const service = createEquipmentService({ workspaceRoot, stateDir, defaultEnabled,
      clock: () => date, runner, cronApi, ...overrides });
    services.push(service);
    return service;
  };
  t.after(() => {
    services.forEach((service) => service.stop());
    rmSync(workspaceRoot, { recursive: true, force: true });
  });
  const saveReport = (value = report()) => writeFileSync(join(stateDir, 'report.json'), JSON.stringify(value), { mode: 0o600 });
  return { service: createService(), createService, workspaceRoot, stateDir, jobs, options, cronTasks, saveReport,
    setTime: (value) => { date = new Date(value); },
    complete: (id, status = 'succeeded') => {
      const job = jobs.get(id);
      Object.assign(job, { status, startedAt: date.getTime(), finishedAt: date.getTime(), exitCode: status === 'succeeded' ? 0 : 1 });
      options[Number(id.split('-')[1]) - 1].onComplete({ ...job });
    },
  };
}

test('daily clock uses São Paulo day and hour, independent of UTC day', () => {
  assert.deepEqual(localAuditTime(new Date('2026-09-29T01:00:00Z')), { day: '2026-09-28', hour: 22 });
  assert.deepEqual(localAuditTime(new Date('2026-09-28T10:00:00Z')), { day: '2026-09-28', hour: 7 });
});

test('scheduler starts at 07:00, persists attempts, and deduplicates actual queued/running jobs', (t) => {
  const h = harness(t, { defaultEnabled: true });
  h.service.start();
  assert.equal(h.options.length, 0);
  assert.equal(h.cronTasks[0].expression, '0 7 * * *');
  assert.equal(h.cronTasks[0].opts.timezone, 'America/Sao_Paulo');
  assert.equal(h.cronTasks[0].opts.noOverlap, true);
  h.setTime('2026-09-28T10:00:00Z');
  const job = h.service.attemptScheduled();
  assert.equal(h.options.length, 1);
  assert.equal(h.service.getState().schedule.lastAttempt, '2026-09-28T10:00:00.000Z');
  assert.deepEqual(h.options[0].args, ['--import', 'tsx', 'scripts/audit-vehicle-equipment.ts', '--state-dir', h.stateDir]);
  assert.equal(h.options[0].cwd, h.workspaceRoot);
  assert.throws(() => h.service.run(), (error) => error.status === 409 && error.job.id === job.id);
  assert.equal(h.service.attemptScheduled(), null);
  h.jobs.get(job.id).status = 'running';
  assert.equal(h.service.getState().schedule.lastJob.status, 'running');
  assert.throws(() => h.service.run(), (error) => error.status === 409);
  h.complete(job.id);
  h.service.stop();
  const restarted = h.createService();
  restarted.start();
  assert.equal(h.options.length, 1, 'same-day restart must not queue again');
  h.setTime('2026-09-29T10:00:00Z');
  restarted.attemptScheduled();
  assert.equal(h.options.length, 2);
});

test('startup catches up once after 07:00 and failure preserves the last report', (t) => {
  const h = harness(t, { defaultEnabled: true, now: '2026-09-28T15:00:00Z' });
  h.saveReport();
  const previous = readFileSync(join(h.stateDir, 'report.json'), 'utf8');
  h.service.start();
  assert.equal(h.options.length, 1);
  h.complete('job-1', 'failed');
  assert.match(h.service.getState().schedule.error, /falhou/);
  assert.equal(readFileSync(join(h.stateDir, 'report.json'), 'utf8'), previous);
  assert.equal(h.service.getState().report.vehicles[0].id, '20050');
  h.service.stop();
  h.createService().start();
  assert.equal(h.options.length, 1, 'failure must not create a restart retry loop');
});

test('interrupted persisted job is reported failed and is not duplicated after restart', (t) => {
  const h = harness(t, { defaultEnabled: true, now: '2026-09-28T15:00:00Z' });
  h.service.start();
  h.service.stop();
  h.jobs.clear();
  const restarted = h.createService();
  restarted.start();
  const state = restarted.getState();
  assert.equal(h.options.length, 1);
  assert.equal(state.schedule.lastJob.status, 'failed');
  assert.match(state.schedule.error, /interrompida/);
  restarted.run();
  assert.equal(h.options.length, 2, 'operator may explicitly retry');
});

test('pause survives restart and enabling performs only one current-day catch-up', (t) => {
  const h = harness(t, { now: '2026-09-28T15:00:00Z' });
  h.service.start();
  assert.equal(h.options.length, 0);
  h.service.setSchedule(false);
  h.service.stop();
  const restarted = h.createService({ defaultEnabled: true });
  restarted.start();
  assert.equal(restarted.getState().schedule.enabled, false);
  assert.equal(restarted.getState().schedule.nextRun, null);
  restarted.setSchedule(true);
  assert.equal(h.options.length, 1);
  restarted.setSchedule(true);
  assert.equal(h.options.length, 1);
  assert.equal(statSync(h.stateDir).mode & 0o777, 0o700);
  assert.equal(statSync(join(h.stateDir, 'settings.json')).mode & 0o777, 0o600);
  assert.equal(statSync(join(h.stateDir, 'scheduler.json')).mode & 0o777, 0o600);
});

test('crash between recording an attempt and enqueueing is visible without a retry loop', (t) => {
  const h = harness(t, { defaultEnabled: true, now: '2026-09-28T15:00:00Z' });
  writeFileSync(join(h.stateDir, 'scheduler.json'), JSON.stringify({
    schemaVersion: 1, lastAttempt: '2026-09-28T14:00:00Z', lastJob: null, reason: 'scheduled', error: null,
  }));
  h.service.start();
  assert.match(h.service.getState().schedule.error, /antes de entrar na fila/);
  assert.equal(h.options.length, 0);
});

test('review requires evidence note, persists, and cannot certify changed inventory', (t) => {
  const h = harness(t);
  h.saveReport();
  const input = { reviewKey: KEY, status: 'reviewed', note: 'Responsável conferiu os itens.', sourceUrl: 'https://www.fiat.com.br/catalogo' };
  assert.throws(() => h.service.review({ ...input, note: ' ' }), (error) => error.status === 400);
  assert.throws(() => h.service.review({ ...input, note: 'x'.repeat(2001) }), (error) => error.status === 400);
  for (const sourceUrl of ['http://example.com', 'javascript:alert(1)', 'https://token@example.com', 'x'.repeat(2049)]) {
    assert.throws(() => h.service.review({ ...input, sourceUrl }), (error) => error.status === 400);
  }
  const originalReport = readFileSync(join(h.stateDir, 'report.json'), 'utf8');
  h.service.review(input);
  assert.equal(h.createService().getState().reviews[KEY].note, input.note);
  assert.equal(statSync(join(h.stateDir, 'reviews.json')).mode & 0o777, 0o600);
  assert.equal(h.options.length, 0, 'review must not enqueue build or deploy');
  assert.equal(readFileSync(join(h.stateDir, 'report.json'), 'utf8'), originalReport);
  h.saveReport(report(NEW_KEY));
  assert.deepEqual(h.service.getState().reviews, {}, 'old approval is not displayed on the new fingerprint');
  assert.throws(() => h.service.review(input), (error) => error.status === 409);
  const stored = JSON.parse(readFileSync(join(h.stateDir, 'reviews.json'), 'utf8'));
  assert.equal(stored.reviews[KEY].status, 'reviewed', 'audit history stays on disk');
});

test('invalid state fails visibly without overwriting review history', (t) => {
  const h = harness(t);
  h.saveReport();
  writeFileSync(join(h.stateDir, 'reviews.json'), '{broken');
  assert.match(h.service.getState().schedule.error, /reviews.json/);
  assert.throws(() => h.service.review({ reviewKey: KEY, status: 'reviewed', note: 'Conferido.' }), (error) => error.status === 503);
  assert.equal(readFileSync(join(h.stateDir, 'reviews.json'), 'utf8'), '{broken');
  writeFileSync(join(h.stateDir, 'scheduler.json'), '{broken');
  h.service.start();
  assert.equal(h.options.length, 0);
  assert.match(h.service.getState().schedule.error, /reviews.json|scheduler.json/);
});

test('review retention preserves current decisions and only the newest 1,000 historical fingerprints', (t) => {
  const h = harness(t);
  const currentReport = report();
  currentReport.vehicles.push({ ...currentReport.vehicles[0], id: '20051', reviewKey: NEW_KEY });
  Object.assign(currentReport.counts, { vehicles: 2, new: 2, withAlerts: 2 });
  h.saveReport(currentReport);
  const historicalKey = (index) => index.toString(16).padStart(64, '0');
  const reviews = Object.fromEntries(Array.from({ length: MAX_HISTORICAL_REVIEWS + 5 }, (_, index) => [
    historicalKey(index + 1), { status: 'reviewed', note: `Anterior ${index + 1}`,
      updatedAt: new Date(Date.parse('2025-01-01T00:00:00Z') + index * 1000).toISOString() },
  ]));
  reviews[KEY] = { status: 'reviewed', note: 'Atual, mesmo com revisão antiga.', updatedAt: '2024-01-01T00:00:00Z' };
  writeFileSync(join(h.stateDir, 'reviews.json'), JSON.stringify({ schemaVersion: 1, reviews }));
  h.service.review({ reviewKey: NEW_KEY, status: 'reviewed', note: 'Conferência atual preservada.' });
  const stored = JSON.parse(readFileSync(join(h.stateDir, 'reviews.json'), 'utf8')).reviews;
  assert.equal(Object.keys(stored).length, MAX_HISTORICAL_REVIEWS + 2);
  assert.equal(stored[KEY].note, 'Atual, mesmo com revisão antiga.');
  assert.equal(stored[NEW_KEY].note, 'Conferência atual preservada.');
  assert.equal(stored[historicalKey(5)], undefined);
  assert.equal(stored[historicalKey(6)].note, 'Anterior 6');
  assert.equal(stored[historicalKey(1005)].note, 'Anterior 1005');
  assert.equal(h.service.getState().schedule.error, null);
});

test('UTF-8 retention also caps bytes before the ledger becomes unreadable', (t) => {
  const h = harness(t);
  h.saveReport();
  const reviews = Object.fromEntries(Array.from({ length: 750 }, (_, index) => [
    (index + 1).toString(16).padStart(64, '0'), {
      status: 'reviewed', note: '界'.repeat(2000), sourceUrl: `https://example.com/${'界'.repeat(2000)}`,
      updatedAt: new Date(Date.parse('2025-01-01T00:00:00Z') + index * 1000).toISOString(),
    },
  ]));
  const file = join(h.stateDir, 'reviews.json');
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, reviews }, null, 2));
  assert.ok(statSync(file).size > MAX_REVIEW_STATE_BYTES);
  assert.ok(statSync(file).size < 10 * 1024 * 1024);
  h.service.review({ reviewKey: KEY, status: 'reviewed', note: 'A revisão atual deve permanecer.' });
  assert.ok(statSync(file).size <= MAX_REVIEW_STATE_BYTES);
  const stored = JSON.parse(readFileSync(file, 'utf8')).reviews;
  assert.equal(stored[KEY].note, 'A revisão atual deve permanecer.');
  assert.equal(stored['1'.padStart(64, '0')], undefined);
  assert.ok(stored[(750).toString(16).padStart(64, '0')]);
  assert.equal(h.service.getState().schedule.error, null);
});

test('partial vehicle identity remains visible for review', (t) => {
  const h = harness(t);
  const incomplete = report();
  incomplete.vehicles[0].modelYear = null;
  incomplete.vehicles[0].findings = [{ code: 'incomplete-identity', severity: 'high', message: 'Ano-modelo não informado.' }];
  h.saveReport(incomplete);
  const state = h.service.getState();
  assert.equal(state.schedule.error, null);
  assert.equal(state.report.vehicles[0].modelYear, null);
  assert.equal(state.report.vehicles[0].findings[0].severity, 'high');
});

test('all equipment endpoints require Bearer authentication and validate writes', async (t) => {
  const h = harness(t);
  h.saveReport();
  const previousToken = process.env.DEVOPS_TOKEN;
  process.env.DEVOPS_TOKEN = 'local-test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.DEVOPS_TOKEN;
    else process.env.DEVOPS_TOKEN = previousToken;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/equipment', requireAuth, createEquipmentRouter(h.service));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}/api/equipment`;
  const request = (path = '', body, authenticated = true) => fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(authenticated ? { Authorization: 'Bearer local-test-token' } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  for (const [path, body] of [['', undefined], ['/run', {}], ['/schedule', { enabled: true }], ['/reviews', {}]]) {
    assert.equal((await request(path, body, false)).status, 401);
  }
  assert.equal(h.options.length, 0);
  assert.equal((await request()).status, 200);
  assert.equal((await request('/run', { command: 'deploy:local' })).status, 400);
  assert.equal((await request('/schedule', { enabled: 'true' })).status, 400);
  assert.equal((await request('/schedule', { enabled: false, cron: '* * * * *' })).status, 400);
  const scheduleResponse = await request('/schedule', { enabled: false });
  assert.equal(scheduleResponse.status, 200);
  assert.equal((await scheduleResponse.json()).schedule.enabled, false);
  const runResponse = await request('/run', {});
  assert.equal(runResponse.status, 202);
  assert.equal((await runResponse.json()).job.id, 'job-1');
  assert.equal((await request('/run', {})).status, 409);
  const reviewResponse = await request('/reviews', { reviewKey: KEY, status: 'reviewed', note: 'Conferido.' });
  assert.equal(reviewResponse.status, 200);
  assert.equal((await reviewResponse.json()).review.status, 'reviewed');
  assert.equal((await request('/reviews', { reviewKey: NEW_KEY, status: 'reviewed', note: 'Conferido.' })).status, 409);
});
