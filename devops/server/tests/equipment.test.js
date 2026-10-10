import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

function harness(t, { now = '2026-09-28T11:59:00.000Z', defaultEnabled = false } = {}) {
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
        getNextRun() { return this.active ? new Date('2026-09-29T12:00:00Z') : null; } };
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
      options[Number(id.split('-')[1]) - 1].onComplete?.({ ...job });
    },
  };
}

test('daily clock uses São Paulo day and hour, independent of UTC day', () => {
  assert.deepEqual(localAuditTime(new Date('2026-09-29T01:00:00Z')), { day: '2026-09-28', hour: 22 });
  assert.deepEqual(localAuditTime(new Date('2026-09-28T10:00:00Z')), { day: '2026-09-28', hour: 7 });
});

test('scheduler starts at 09:00, persists attempts, and deduplicates actual queued/running jobs', (t) => {
  const h = harness(t, { defaultEnabled: true });
  h.service.start();
  assert.equal(h.options.length, 0);
  assert.equal(h.cronTasks[0].expression, '0 9 * * *');
  assert.equal(h.cronTasks[0].opts.timezone, 'America/Sao_Paulo');
  assert.equal(h.cronTasks[0].opts.noOverlap, true);
  h.setTime('2026-09-28T12:00:00Z');
  const job = h.service.attemptScheduled();
  assert.equal(h.options.length, 1);
  assert.equal(h.service.getState().schedule.lastAttempt, '2026-09-28T12:00:00.000Z');
  assert.deepEqual(h.options[0].args, ['scripts/run-equipment-daily.mjs', '--state-dir', h.stateDir, '--input', join(h.workspaceRoot, 'docs', 'equipment-research-library.json')]);
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
  h.setTime('2026-09-29T12:00:00Z');
  restarted.attemptScheduled();
  assert.equal(h.options.length, 2);
});

test('startup catches up once after 09:00 and failure preserves the last report', (t) => {
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
  for (const [path, body] of [['', undefined], ['/run', {}], ['/schedule', { enabled: true }], ['/reviews', {}], ['/research/decisions', {}],
    ['/research/prepare', {}], ['/research/proposal', undefined], ['/research/apply', {}], ['/research/publication', {}]]) {
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

function saveResearch(h) {
  const candidate = { identity: { id: '20050', brand: 'FIAT', model: 'FASTBACK IMPETUS TURBO', manufactureYear: 2024, modelYear: 2025, engine: '1.0', transmission: 'AUTOMATICO', market: 'BR' },
    item: { key: 'rain-sensor', label: 'Sensor de chuva', tag: 'sensor_de_chuva' }, classification: 'standard',
    evidence: { url: 'https://www.fiat.com.br/fixture', title: 'Exemplo', date: '2024-01-01', locator: 'p. 1', claim: 'Teste de fonte.' } };
  writeFileSync(join(h.stateDir, 'research-review.json'), JSON.stringify({ schemaVersion: 1, events: [], revisions: [{ key: KEY, candidate, active: true, status: 'pending', contextBlockers: [] }] }));
  writeFileSync(join(h.stateDir, 'research-discovery.json'), JSON.stringify({ schemaVersion: 1, observedAt: '2026-09-28T11:00:00Z', snapshotSha256: NEW_KEY,
    counts: { inventoryCompared: 1, withResearchCandidates: 1, withoutCompatibleSourceRecorded: 0, publicRendered: 0 }, vehicles: [{ id: '20050', identity: candidate.identity, sourceStatus: 'research_candidates_recorded', candidates: [] }] }));
}

test('research reads dated discovery and item decisions separately from whole-vehicle reviews', (t) => {
  const h = harness(t); h.saveReport(); saveResearch(h);
  const state = h.service.getState();
  assert.equal(state.research.revisions[0].status, 'pending');
  assert.equal(state.research.discovery.observedAt, '2026-09-28T11:00:00Z');
  assert.deepEqual(state.reviews, {});
  writeFileSync(join(h.stateDir, 'research-review.json'), '{broken');
  assert.match(h.service.getState().research.error, /research-review.json/);
  assert.equal(h.service.getState().research.discovery, null);
  assert.equal(h.service.getState().report.vehicles[0].id, '20050');
  assert.equal(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'), '{broken');
});

test('specific item decision enqueues only safe CLI decide and serializes against the audit', (t) => {
  const h = harness(t); saveResearch(h);
  const decision = { key: KEY, vehicleId: '20050', itemKey: 'rain-sensor', status: 'authorized', note: 'Responsável confirmou.',
    present: true, authorizePublication: true, marketConfirmed: true, confirmationReference: 'Conferência do responsável em 28/09',
    approvedText: { name: 'Sensor de chuva', description: 'Sensor de chuva' } };
  for (const change of [{ key: NEW_KEY }, { vehicleId: '20051' }, { itemKey: 'other-item' }]) {
    assert.throws(() => h.service.decideResearch({ ...decision, ...change }), (error) => error.status === 409);
  }
  for (const change of [{ present: false }, { authorizePublication: false }, { marketConfirmed: false },
    { confirmationReference: undefined }, { approvedText: undefined }, { command: 'deploy:local' },
    { status: 'presence_confirmed' }, { note: '--help' }]) {
    assert.throws(() => h.service.decideResearch({ ...decision, ...change }), (error) => error.status === 400);
  }
  const before = readFileSync(join(h.stateDir, 'research-review.json'), 'utf8');
  const job = h.service.decideResearch(decision);
  assert.equal(h.options.length, 1);
  const args = h.options[0].args;
  assert.equal(args[3], 'decide');
  assert.equal(args[args.indexOf('--vehicle-id') + 1], '20050');
  assert.equal(args[args.indexOf('--item-key') + 1], 'rain-sensor');
  assert.ok(args.includes('--approved-name')); assert.ok(args.includes('--confirmation-reference'));
  assert.ok(!args.includes('apply')); assert.ok(!args.includes('deploy'));
  assert.throws(() => h.service.run(), (error) => error.status === 409 && error.job.id === job.id);
  assert.throws(() => h.service.decideResearch(decision), (error) => error.status === 409);
  assert.equal(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'), before, 'only the CLI may record the decision under its own lock');
  h.complete(job.id);
  h.service.run();
  assert.throws(() => h.service.decideResearch(decision), (error) => error.status === 409);
});

test('VPS scheduler does not catch up at the retired seven oclock time', (t) => {
  const h = harness(t, { defaultEnabled: true, now: '2026-09-28T10:00:00Z' });
  h.service.start();
  assert.equal(h.options.length, 0);
  h.setTime('2026-09-28T11:59:59Z');
  assert.equal(h.service.attemptScheduled(), null);
  h.setTime('2026-09-28T12:00:00Z');
  assert.ok(h.service.attemptScheduled());
  assert.equal(h.cronTasks.length, 1);
});


test('research panel retains valid history beyond 2000 revisions without discarding decisions', (t) => {
  const h = harness(t);
  const revisions = Array.from({ length: 2001 }, (_, index) => ({
    key: (index + 1).toString(16).padStart(64, '0'), active: index === 2000, status: 'excluded',
    candidate: { identity: { id: '99999', brand: 'FIAT', model: 'SYNTHETIC HISTORY', modelYear: 2025 }, item: { key: 'rain-sensor', label: 'Sensor de chuva' } },
    decision: { note: 'Historical synthetic refusal', present: true, authorizePublication: false },
  }));
  const file = join(h.stateDir, 'research-review.json');
  const bytes = JSON.stringify({ schemaVersion: 1, revisions, events: [] });
  writeFileSync(file, bytes);
  const result = h.service.getState();
  assert.equal(result.research.error, null);
  assert.equal(result.research.revisions.length, 1);
  assert.equal(result.research.revisions[0].key, revisions[2000].key);
  assert.equal(readFileSync(file, 'utf8'), bytes, 'reader must preserve every historical decision');
});


test('a review crossing 09:00 triggers exactly one scheduled catch-up after completion', (t) => {
  const h = harness(t, { defaultEnabled: true, now: '2026-09-28T11:59:00Z' });
  writeFileSync(join(h.stateDir, 'research-review.json'), JSON.stringify({ schemaVersion: 1, events: [], revisions: [{
    key: KEY, active: true, status: 'pending', candidate: { identity: { id: '99999' }, item: { key: 'rain-sensor' } },
  }] }));
  h.service.start();
  const review = h.service.decideResearch({ key: KEY, vehicleId: '99999', itemKey: 'rain-sensor', status: 'excluded', note: 'Synthetic item-specific refusal' });
  h.setTime('2026-09-28T12:00:00Z');
  assert.equal(h.service.attemptScheduled(), null, 'daily job waits for the active review');
  assert.equal(h.options.length, 1);
  h.complete(review.id);
  assert.equal(h.options.length, 2);
  assert.equal(h.options[1].meta.kind, 'equipment:audit');
  assert.equal(h.service.getState().schedule.lastAttempt, '2026-09-28T12:00:00.000Z');
  assert.equal(h.service.attemptScheduled(), null);
  h.complete('job-2');
  assert.equal(h.service.attemptScheduled(), null);
  assert.equal(h.options.length, 2, 'only one daily audit may follow');
});

// These fixtures live only inside the temporary harness. The service should
// enqueue the CLI, never alter the source registry or private ledger itself.
function canonicalProposalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalProposalValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalProposalValue(value[key])]));
  return value;
}

function signResearchProposal(proposal) {
  const contents = { ...proposal };
  delete contents.proposalSha256;
  return { ...contents, proposalSha256: createHash('sha256')
    .update(JSON.stringify(canonicalProposalValue(contents))).digest('hex') };
}

function saveResearchOperation(h, { applied = false, status = 'authorized' } = {}) {
  saveResearch(h);
  const ledger = JSON.parse(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'));
  const revision = ledger.revisions[0];
  Object.assign(revision, {
    status, stockFingerprint: 'c'.repeat(64), generation: 1,
    firstSeenAt: '2026-09-28T11:00:00.000Z', lastSeenAt: '2026-09-28T11:30:00.000Z',
    answeredAt: '2026-09-28T11:31:00.000Z',
    decision: { note: 'Confirmação sintética desta unidade e deste item.', present: true,
      authorizePublication: true, marketConfirmed: true, sourceIdentityConfirmed: false,
      confirmationReference: 'chat:synthetic:20050:rain-sensor',
      approvedText: { name: 'Sensor de chuva', description: 'Sensor de chuva' } },
  });
  const { id, ...match } = revision.candidate.identity;
  Object.assign(revision.candidate.evidence, { kind: 'exact-equipment', match });
  const proposal = signResearchProposal({
    schemaVersion: 1, proposalOnly: true,
    generatedAt: '2026-09-28T11:32:00.000Z', snapshotObservedAt: '2026-09-28T11:30:00.000Z',
    baseSha256: 'd'.repeat(64), decisionSha256: 'e'.repeat(64),
    includedKeys: [KEY], blocked: [], limitations: ['Synthetic proposal for service regression tests.'],
    reviewBindings: [{ key: KEY, identity: structuredClone(revision.candidate.identity),
      stockFingerprint: revision.stockFingerprint, sourceIdentityConfirmed: false }],
    confirmationDocument: { schemaVersion: 1, records: [{
      schemaVersion: 2, id: 'synthetic-unit-20050', approved: true,
      marketSource: 'responsible-confirmation', source: 'responsible-confirmation',
      confirmedAt: '2026-09-28', claim: 'Synthetic regression record.',
      match: { ...match, vehicleId: id, physicalIdentityKey: 'f'.repeat(64) },
      presentTags: ['sensor_de_chuva'], absentTags: [],
    }] },
  });
  if (applied) revision.application = { proposalSha256: proposal.proposalSha256,
    beforeSha256: proposal.baseSha256, afterSha256: 'f'.repeat(64), appliedAt: '2026-09-28T11:33:00.000Z' };
  const saveLedger = () => writeFileSync(join(h.stateDir, 'research-review.json'), JSON.stringify(ledger), { mode: 0o600 });
  const saveProposal = (value = proposal) => writeFileSync(join(h.stateDir, 'research-proposal.json'), JSON.stringify(value), { mode: 0o600 });
  saveLedger(); saveProposal();
  return { ledger, revision, proposal, saveLedger, saveProposal };
}

function publicationInput(overrides = {}) {
  return { key: KEY, vehicleId: '20050', itemKey: 'rain-sensor', commit: 'a'.repeat(40),
    publicUrl: 'https://www.netcarmultimarcas.com.br/veiculo/20050',
    evidenceReference: 'Synthetic DOM proof for unit 20050.',
    reversalReference: 'Synthetic receipt identifies the exact item to revert.', ...overrides };
}

test('research prepare accepts only an empty object and enqueues the fixed CLI without changing files', (t) => {
  const h = harness(t);
  const fixture = saveResearchOperation(h);
  const before = readFileSync(join(h.stateDir, 'research-review.json'), 'utf8');
  for (const input of [undefined, null, [], 'prepare', { command: 'deploy:local' }, { stateDir: '/tmp/other' }, { stock: 'alternate.json' }]) {
    assert.throws(() => h.service.prepareResearch(input), (error) => error.status === 400);
  }
  assert.equal(h.options.length, 0);
  const job = h.service.prepareResearch({});
  assert.equal(job.id, 'job-1');
  assert.equal(h.options[0].command, process.execPath);
  assert.equal(h.options[0].cwd, h.workspaceRoot);
  assert.equal(h.options[0].meta.kind, 'equipment:review');
  assert.deepEqual(h.options[0].args, ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'prepare', '--state-dir', h.stateDir]);
  assert.equal(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'), before);
  assert.deepEqual(h.service.getResearchProposal(), fixture.proposal);
});

test('research proposal is read only after schema and canonical digest validation', (t) => {
  const h = harness(t);
  assert.throws(() => h.service.getResearchProposal(), (error) => error.status === 404);
  const fixture = saveResearchOperation(h);
  const reordered = Object.fromEntries(Object.entries(fixture.proposal).reverse());
  reordered.reviewBindings[0].identity = Object.fromEntries(Object.entries(reordered.reviewBindings[0].identity).reverse());
  fixture.saveProposal(reordered);
  assert.deepEqual(h.service.getResearchProposal(), fixture.proposal, 'JSON key order does not change a canonical digest');

  const invalid = [
    { ...fixture.proposal, proposalSha256: NEW_KEY },
    { ...fixture.proposal, confirmationDocument: { records: [] } },
    signResearchProposal({ ...fixture.proposal, schemaVersion: 2 }),
    signResearchProposal({ ...fixture.proposal, proposalOnly: false }),
    signResearchProposal({ ...fixture.proposal, generatedAt: 'yesterday' }),
    signResearchProposal({ ...fixture.proposal, snapshotObservedAt: '2026-09-28' }),
    signResearchProposal({ ...fixture.proposal, baseSha256: 'd'.repeat(63) }),
    signResearchProposal({ ...fixture.proposal, decisionSha256: 'E'.repeat(64) }),
    signResearchProposal({ ...fixture.proposal, includedKeys: [KEY, KEY] }),
    signResearchProposal({ ...fixture.proposal, includedKeys: ['invalid'] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [fixture.proposal.reviewBindings[0], fixture.proposal.reviewBindings[0]] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [{ ...fixture.proposal.reviewBindings[0], key: NEW_KEY }] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [{ ...fixture.proposal.reviewBindings[0], identity: { id: 'not-a-unit' } }] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [{ ...fixture.proposal.reviewBindings[0], stockFingerprint: 'invalid' }] }),
    signResearchProposal({ ...fixture.proposal, reviewBindings: [{ ...fixture.proposal.reviewBindings[0], sourceIdentityConfirmed: 'true' }] }),
    signResearchProposal({ ...fixture.proposal, blocked: {} }),
    signResearchProposal({ ...fixture.proposal, confirmationDocument: { records: {} } }),
    signResearchProposal({ ...fixture.proposal, command: 'deploy:local' }),
  ];
  for (const [index, proposal] of invalid.entries()) {
    fixture.saveProposal(proposal);
    const original = readFileSync(join(h.stateDir, 'research-proposal.json'), 'utf8');
    assert.throws(() => h.service.getResearchProposal(), (error) => error.status === 503, `invalid proposal ${index}`);
    assert.equal(readFileSync(join(h.stateDir, 'research-proposal.json'), 'utf8'), original, 'invalid proposal remains available for investigation');
  }
  assert.equal(h.options.length, 0);
});

test('research apply requires the exact current nonempty proposal and preserves the ledger until CLI execution', (t) => {
  const h = harness(t);
  assert.throws(() => h.service.applyResearch({ proposalSha256: KEY }), (error) => error.status === 409);
  const fixture = saveResearchOperation(h);
  const request = { proposalSha256: fixture.proposal.proposalSha256 };
  for (const input of [null, [], {}, { proposalSha256: 'invalid' }, { ...request, command: 'deploy:local' }, { ...request, stateDir: '/tmp/other' }]) {
    assert.throws(() => h.service.applyResearch(input), (error) => error.status === 400);
  }
  assert.throws(() => h.service.applyResearch({ proposalSha256: NEW_KEY }), (error) => error.status === 409);
  const empty = signResearchProposal({ ...fixture.proposal, includedKeys: [], reviewBindings: [] });
  fixture.saveProposal(empty);
  assert.throws(() => h.service.applyResearch({ proposalSha256: empty.proposalSha256 }), (error) => error.status === 409);
  fixture.saveProposal({ ...fixture.proposal, confirmationDocument: { records: [] } });
  assert.throws(() => h.service.applyResearch(request), (error) => error.status === 503, 'tampered contents cannot be applied using the old hash');
  fixture.saveProposal();
  const before = readFileSync(join(h.stateDir, 'research-review.json'), 'utf8');
  const job = h.service.applyResearch(request);
  assert.equal(job.id, 'job-1');
  assert.equal(h.options[0].command, process.execPath);
  assert.equal(h.options[0].cwd, h.workspaceRoot);
  assert.equal(h.options[0].meta.kind, 'equipment:review');
  assert.deepEqual(h.options[0].args, ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'apply',
    '--proposal-sha256', fixture.proposal.proposalSha256, '--state-dir', h.stateDir]);
  assert.equal(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'), before);
});

test('research apply rejects stale or unapproved revisions and mismatched proposal bindings', (t) => {
  const h = harness(t);
  const changes = [
    (revision) => { revision.active = false; },
    (revision) => { revision.status = 'presence_confirmed'; },
    (revision) => { revision.status = 'published'; },
    (revision) => { revision.invalidatedAt = '2026-09-28T11:34:00.000Z'; },
    (revision) => { revision.unitAbsentSince = '2026-09-28T11:34:00.000Z'; },
    (revision) => { revision.supersededBy = NEW_KEY; },
    (revision) => { revision.key = NEW_KEY; },
    (revision) => { revision.candidate.identity.id = '20051'; },
    (revision) => { revision.candidate.identity.modelYear = 2026; },
    (revision) => { revision.stockFingerprint = NEW_KEY; },
    (revision) => { revision.decision.sourceIdentityConfirmed = true; },
    (revision) => { revision.decision.present = false; },
    (revision) => { revision.decision.authorizePublication = false; },
    (revision) => { revision.decision.marketConfirmed = false; },
    (revision) => { revision.decision.present = 'true'; },
    (revision) => { delete revision.decision.confirmationReference; },
    (revision) => { delete revision.decision.approvedText; },
  ];
  for (const [index, change] of changes.entries()) {
    const fixture = saveResearchOperation(h);
    change(fixture.revision); fixture.saveLedger();
    assert.throws(() => h.service.applyResearch({ proposalSha256: fixture.proposal.proposalSha256 }),
      (error) => error.status === 409, `changed revision ${index}`);
  }
  assert.equal(h.options.length, 0, 'no invalid approval may enter the execution queue');
});

test('research publication requires exact selectors and existing application evidence', (t) => {
  const h = harness(t);
  const input = publicationInput();
  saveResearchOperation(h);
  assert.throws(() => h.service.recordResearchPublication(input), (error) => error.status === 409);
  const changes = [
    (revision) => { revision.active = false; },
    (revision) => { revision.status = 'presence_confirmed'; },
    (revision) => { revision.status = 'excluded'; },
    (revision) => { revision.invalidatedAt = '2026-09-28T11:34:00.000Z'; },
    (revision) => { revision.unitAbsentSince = '2026-09-28T11:34:00.000Z'; },
    (revision) => { revision.supersededBy = NEW_KEY; },
    (revision) => { revision.decision.authorizePublication = false; },
    (revision) => { revision.decision.authorizePublication = 'true'; },
    (revision) => { revision.application.proposalSha256 = 'invalid'; },
    (revision) => { revision.application.beforeSha256 = 'invalid'; },
    (revision) => { revision.application.afterSha256 = 'invalid'; },
    (revision) => { revision.application.appliedAt = 'yesterday'; },
    (revision) => { revision.application.appliedAt = '2026-09-28'; },
  ];
  for (const [index, change] of changes.entries()) {
    const fixture = saveResearchOperation(h, { applied: true });
    change(fixture.revision); fixture.saveLedger();
    assert.throws(() => h.service.recordResearchPublication(input), (error) => error.status === 409, `invalid application ${index}`);
  }
  saveResearchOperation(h, { applied: true });
  for (const change of [{ key: NEW_KEY }, { vehicleId: '20051', publicUrl: 'https://www.netcarmultimarcas.com.br/veiculo/20051' }, { itemKey: 'another-item' }]) {
    assert.throws(() => h.service.recordResearchPublication({ ...input, ...change }), (error) => error.status === 409);
  }
  assert.equal(h.options.length, 0);
});

test('research publication validates commit, unit URL and bounded references before queueing', (t) => {
  const h = harness(t);
  saveResearchOperation(h, { applied: true });
  const input = publicationInput();
  for (const value of [null, [], {}, 'record-publication']) {
    assert.throws(() => h.service.recordResearchPublication(value), (error) => error.status === 400);
  }
  for (const change of [
    { key: 'invalid' }, { vehicleId: 'not-a-unit' }, { itemKey: '--help' },
    { commit: 'a'.repeat(39) }, { commit: 'A'.repeat(40) }, { commit: 'not-a-commit' },
    { publicUrl: 'http://www.netcarmultimarcas.com.br/veiculo/20050' },
    { publicUrl: 'https://example.com/veiculo/20050' },
    { publicUrl: 'https://www.netcarmultimarcas.com.br/veiculo/20051' },
    { publicUrl: 'https://token@www.netcarmultimarcas.com.br/veiculo/20050' },
    { publicUrl: 'https://www.netcarmultimarcas.com.br/veiculo/20050?other=true' },
    { publicUrl: 'https://www.netcarmultimarcas.com.br/veiculo/20050#other' },
    { publicUrl: 'https://www.netcarmultimarcas.com.br:444/veiculo/20050' },
    { evidenceReference: '' }, { evidenceReference: '--help' }, { evidenceReference: 'x'.repeat(2001) },
    { evidenceReference: 'invalid\u0000reference' }, { reversalReference: ' ' },
    { reversalReference: '--state-dir' }, { reversalReference: 'x'.repeat(2001) },
    { command: 'deploy:local' }, { stateDir: '/tmp/other' }, { verifiedAt: '2026-09-28T11:34:00Z' },
  ]) {
    assert.throws(() => h.service.recordResearchPublication({ ...input, ...change }), (error) => error.status === 400);
  }
  assert.equal(h.options.length, 0);
  const before = readFileSync(join(h.stateDir, 'research-review.json'), 'utf8');
  h.service.recordResearchPublication(input);
  assert.equal(h.options[0].meta.kind, 'equipment:review');
  assert.equal(h.options[0].command, process.execPath);
  assert.equal(h.options[0].cwd, h.workspaceRoot);
  assert.deepEqual(h.options[0].args, ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'record-publication',
    '--key', input.key, '--vehicle-id', input.vehicleId, '--item-key', input.itemKey,
    '--commit', input.commit, '--public-url', input.publicUrl, '--evidence-reference', input.evidenceReference,
    '--reversal-reference', input.reversalReference, '--state-dir', h.stateDir]);
  assert.equal(readFileSync(join(h.stateDir, 'research-review.json'), 'utf8'), before, 'service must not manufacture a publication receipt');
});

test('applied confirmed and published revisions can record publication without another equipment authorization', (t) => {
  const h = harness(t);
  for (const status of ['confirmed', 'published']) {
    saveResearchOperation(h, { applied: true, status });
    const job = h.service.recordResearchPublication(publicationInput());
    assert.equal(h.options.at(-1).args[3], 'record-publication');
    h.complete(job.id);
  }
  assert.equal(h.options.length, 2);
});

test('all research operations share the audit and review queue and honor the enqueue lock', (t) => {
  const h = harness(t);
  const fixture = saveResearchOperation(h, { applied: true });
  const operations = [
    () => h.service.prepareResearch({}),
    () => h.service.applyResearch({ proposalSha256: fixture.proposal.proposalSha256 }),
    () => h.service.recordResearchPublication(publicationInput()),
  ];
  for (const start of operations) {
    const job = start();
    for (const blocked of [...operations, () => h.service.run(), () => h.service.decideResearch({
      key: KEY, vehicleId: '20050', itemKey: 'rain-sensor', status: 'excluded', note: 'Synthetic refusal.',
    })]) {
      assert.throws(blocked, (error) => error.status === 409 && error.job?.id === job.id);
    }
    h.jobs.get(job.id).status = 'running';
    for (const operation of operations) assert.throws(operation, (error) => error.status === 409 && error.job?.id === job.id);
    h.complete(job.id);
  }
  const audit = h.service.run();
  for (const operation of operations) assert.throws(operation, (error) => error.status === 409 && error.job?.id === audit.id);
  h.complete(audit.id);
  const count = h.options.length;
  writeFileSync(join(h.stateDir, 'enqueue.lock'), 'synthetic existing owner', { mode: 0o600 });
  for (const operation of operations) assert.throws(operation, (error) => error.status === 409);
  assert.equal(h.options.length, count);
});

test('each new research job crossing 09:00 releases one daily catch-up on completion', (t) => {
  for (const name of ['prepare', 'apply', 'publication']) {
    const h = harness(t, { defaultEnabled: true, now: '2026-09-28T11:59:00Z' });
    const fixture = saveResearchOperation(h, { applied: true });
    h.service.start();
    const job = name === 'prepare' ? h.service.prepareResearch({})
      : name === 'apply' ? h.service.applyResearch({ proposalSha256: fixture.proposal.proposalSha256 })
        : h.service.recordResearchPublication(publicationInput());
    h.setTime('2026-09-28T12:00:00Z');
    assert.equal(h.service.attemptScheduled(), null);
    assert.equal(h.options.length, 1);
    h.complete(job.id, name === 'prepare' ? 'failed' : 'succeeded');
    assert.equal(h.options.length, 2, `${name} completion must release the daily audit`);
    assert.equal(h.options[1].meta.kind, 'equipment:audit');
    h.complete('job-2');
    assert.equal(h.service.attemptScheduled(), null);
    assert.equal(h.options.length, 2);
  }
});

test('authenticated research operation routes return proposal or accepted jobs and reject invalid writes', async (t) => {
  const h = harness(t);
  const fixture = saveResearchOperation(h, { applied: true });
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
  const base = `http://127.0.0.1:${server.address().port}/api/equipment/research`;
  const request = (path, body) => fetch(`${base}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer local-test-token', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const response = await request('proposal');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { proposal: fixture.proposal });
  for (const [path, body] of [['prepare', { command: 'deploy:local' }], ['apply', {}], ['publication', publicationInput({ command: 'deploy:local' })]]) {
    assert.equal((await request(path, body)).status, 400);
  }
  for (const [path, body] of [['prepare', {}], ['apply', { proposalSha256: fixture.proposal.proposalSha256 }], ['publication', publicationInput()]]) {
    const accepted = await request(path, body);
    assert.equal(accepted.status, 202, path);
    const { job } = await accepted.json();
    assert.equal(typeof job.id, 'string');
    const conflict = await request(path, body);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).job.id, job.id);
    h.complete(job.id);
  }
  assert.equal(h.options.length, 3);
  assert.ok(h.options.every((option) => option.meta.kind === 'equipment:review'));
  rmSync(join(h.stateDir, 'research-proposal.json'));
  assert.equal((await request('proposal')).status, 404);
  fixture.saveProposal({ ...fixture.proposal, proposalSha256: NEW_KEY });
  assert.equal((await request('proposal')).status, 503);
  assert.equal(h.options.length, 3);
});
