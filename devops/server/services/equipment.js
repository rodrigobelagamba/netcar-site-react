import { randomUUID } from 'node:crypto';
import {
  chmodSync, closeSync, mkdirSync, openSync, readFileSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import cron from 'node-cron';
import { config } from './config.js';
import { enqueueJob, findActiveJob, getJob } from './runner.js';

export const EQUIPMENT_CRON = '0 7 * * *';
export const EQUIPMENT_TIMEZONE = 'America/Sao_Paulo';
export const MAX_HISTORICAL_REVIEWS = 1000;
export const MAX_REVIEW_STATE_BYTES = 8 * 1024 * 1024;
const MAX_STATE_FILE_BYTES = 10 * 1024 * 1024;
const JOB_KIND = 'equipment:audit';
const HASH = /^[a-f0-9]{64}$/;
const ACTIVE = new Set(['queued', 'running']);

export class EquipmentError extends Error {
  constructor(status, message, job) {
    super(message);
    this.status = status;
    if (job) this.job = job;
  }
}

export function localAuditTime(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: EQUIPMENT_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function publicJobSummary(job) {
  if (!job) return null;
  return Object.fromEntries([
    'id', 'label', 'status', 'createdAt', 'startedAt', 'finishedAt', 'exitCode',
  ].map((key) => [key, job[key] ?? null]).concat([
    ['error', job.status === 'failed' ? 'Auditoria não concluída. Consulte o log do job.' : null],
  ]));
}

function validReport(report) {
  const strings = (values) => Array.isArray(values) && values.every((value) => typeof value === 'string');
  return report?.schemaVersion === 1 && typeof report.generatedAt === 'string' && Number.isFinite(Date.parse(report.generatedAt)) &&
    typeof report.inputSource === 'string' && HASH.test(report.catalogFingerprint) &&
    report.counts && ['vehicles', 'new', 'changed', 'unchanged', 'withAlerts'].every((key) =>
      Number.isSafeInteger(report.counts[key]) && report.counts[key] >= 0) &&
    Array.isArray(report.vehicles) && report.vehicles.length === report.counts.vehicles &&
    report.vehicles.every((vehicle) => vehicle && HASH.test(vehicle.reviewKey) &&
      /^\d+$/.test(String(vehicle.id)) &&
      ['brand', 'model', 'engine', 'transmission', 'researchQuery'].every((key) => typeof vehicle[key] === 'string') &&
      (vehicle.modelYear === null || ['string', 'number'].includes(typeof vehicle.modelYear)) &&
      ['new', 'changed', 'unchanged'].includes(vehicle.change) &&
      strings(vehicle.inventoryDescriptions) && strings(vehicle.displayedDescriptions) &&
      strings(vehicle.confirmationIds) && Array.isArray(vehicle.findings) &&
      vehicle.findings.every((finding) => finding && typeof finding.code === 'string' &&
        typeof finding.message === 'string' && ['high', 'medium', 'info'].includes(finding.severity)));
}

function retainedReviews(reviews, currentKeys) {
  const entries = Object.entries(reviews);
  const current = entries.filter(([key]) => currentKeys.has(key));
  const historical = entries.filter(([key]) => !currentKeys.has(key))
    .sort(([keyA, a], [keyB, b]) =>
      (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || keyA.localeCompare(keyB))
    .slice(0, MAX_HISTORICAL_REVIEWS);
  const ledger = (count) => ({ schemaVersion: 1,
    reviews: Object.fromEntries([...current, ...historical.slice(0, count)]) });
  const fits = (count) => Buffer.byteLength(`${JSON.stringify(ledger(count), null, 2)}\n`, 'utf8') <= MAX_REVIEW_STATE_BYTES;
  // Never discard a decision still attached to current inventory. Under the
  // stock limit this leaves room for history; oversized legacy state fails
  // explicitly instead of producing a file the reader can no longer open.
  if (!fits(0)) throw new EquipmentError(413, 'Revisões atuais excedem o limite do histórico. Reduza as anotações antes de salvar.');
  if (fits(historical.length)) return ledger(historical.length);
  // Keep the largest newest-first prefix that fits. Binary search avoids
  // repeatedly serializing a large ledger once per removed historical entry.
  let low = 0;
  let high = historical.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }
  return ledger(low);
}

/** One service per DevOps process. The CLI also locks its report production. */
export function createEquipmentService({
  workspaceRoot = config.workspaceRoot,
  stateDir = join(workspaceRoot, '.devops', 'equipment'),
  defaultEnabled = config.equipmentCronEnabled,
  clock = () => new Date(),
  cronApi = cron,
  runner = { enqueueJob, findActiveJob, getJob },
} = {}) {
  let task = null;
  let started = false;
  let runtimeError = null;

  function ensureDirectory() {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    chmodSync(stateDir, 0o700);
  }

  function readJson(name, fallback) {
    try {
      const file = join(stateDir, name);
      if (statSync(file).size > MAX_STATE_FILE_BYTES) throw new Error('Too large');
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return fallback;
      throw new EquipmentError(503, `Estado de equipamentos indisponível (${name}). Preserve o arquivo e verifique a rotina.`);
    }
  }

  function writeJson(name, value) {
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_FILE_BYTES)
      throw new EquipmentError(413, 'O estado de equipamentos excede o limite de armazenamento.');
    ensureDirectory();
    const temporary = join(stateDir, `.${name}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, serialized, { mode: 0o600, flag: 'wx' });
      renameSync(temporary, join(stateDir, name));
    } finally {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }

  // This lock protects short synchronous state transactions only. It is never
  // held during network requests or the audit subprocess; runner/CLI own those.
  function withStateLock(action) {
    ensureDirectory();
    const file = join(stateDir, 'enqueue.lock');
    let descriptor;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        descriptor = openSync(file, 'wx', 0o600);
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // A crashed writer cannot hold this synchronous transaction indefinitely.
        if (attempt === 0 && Date.now() - statSync(file).mtimeMs > 60_000) {
          unlinkSync(file);
          continue;
        }
        throw new EquipmentError(409, 'Estado de equipamentos em atualização. Tente novamente.');
      }
    }
    try {
      return action();
    } finally {
      closeSync(descriptor);
      unlinkSync(file);
    }
  }

  function readSettings() {
    const saved = readJson('settings.json', null);
    if (saved === null) return { enabled: defaultEnabled };
    if (saved.schemaVersion !== 1 || typeof saved.enabled !== 'boolean')
      throw new EquipmentError(503, 'Configuração de equipamentos inválida; agendamento interrompido.');
    return saved;
  }

  function readScheduler() {
    const saved = readJson('scheduler.json', { schemaVersion: 1, lastAttempt: null, lastJob: null, error: null });
    if (saved?.schemaVersion !== 1 || (saved.lastAttempt !== null && !Number.isFinite(Date.parse(saved.lastAttempt))))
      throw new EquipmentError(503, 'Histórico do agendamento inválido; agendamento interrompido.');
    return saved;
  }

  function readReport() {
    const report = readJson('report.json', null);
    if (report !== null && !validReport(report))
      throw new EquipmentError(503, 'Relatório de equipamentos inválido. Execute uma nova auditoria.');
    return report;
  }

  function readReviews() {
    const saved = readJson('reviews.json', { schemaVersion: 1, reviews: {} });
    if (saved?.schemaVersion !== 1 || !saved.reviews || typeof saved.reviews !== 'object' || Array.isArray(saved.reviews))
      throw new EquipmentError(503, 'Histórico de revisões inválido; nenhuma revisão foi sobrescrita.');
    return saved.reviews;
  }

  function getSchedule() {
    const { enabled } = readSettings();
    const saved = readScheduler();
    const current = saved.lastJob?.id ? runner.getJob(saved.lastJob.id) : null;
    return {
      enabled,
      cron: EQUIPMENT_CRON,
      timezone: EQUIPMENT_TIMEZONE,
      nextRun: enabled ? task?.getNextRun()?.toISOString() || null : null,
      lastAttempt: saved.lastAttempt,
      lastJob: current ? publicJobSummary(current) : saved.lastJob,
      error: runtimeError || saved.error || null,
    };
  }

  function getState() {
    let schedule;
    try { schedule = getSchedule(); } catch (error) {
      schedule = { enabled: false, cron: EQUIPMENT_CRON, timezone: EQUIPMENT_TIMEZONE,
        nextRun: null, lastAttempt: null, lastJob: null, error: error.message };
    }
    let report = null;
    let reviews = {};
    try { report = readReport(); } catch (error) { schedule.error = error.message; }
    try {
      const saved = readReviews();
      // Keep history on disk, but expose decisions only for this exact report's
      // current fingerprints. Changed inventory must show as pending again.
      reviews = Object.fromEntries((report?.vehicles || [])
        .filter((vehicle) => Object.hasOwn(saved, vehicle.reviewKey))
        .map((vehicle) => [vehicle.reviewKey, saved[vehicle.reviewKey]]));
    } catch (error) { schedule.error = error.message; }
    return { schedule, report, reviews };
  }

  function run(reason = 'manual') {
    return withStateLock(() => {
      const active = runner.findActiveJob(JOB_KIND);
      if (active) throw new EquipmentError(409, 'Já existe auditoria em execução ou na fila.', active);
      const attemptedAt = clock().toISOString();
      const state = { ...readScheduler(), lastAttempt: attemptedAt, lastJob: null, reason, error: null };
      // Record before enqueueing so a process crash cannot cause endless daily retries.
      writeJson('scheduler.json', state);
      runtimeError = null;
      try {
        const job = runner.enqueueJob({
          label: 'Auditoria de equipamentos',
          command: process.execPath,
          args: ['--import', 'tsx', 'scripts/audit-vehicle-equipment.ts', '--state-dir', stateDir],
          cwd: workspaceRoot,
          meta: { kind: JOB_KIND },
          onComplete: (completed) => {
            try {
              withStateLock(() => writeJson('scheduler.json', {
                ...state,
                lastJob: publicJobSummary(completed),
                error: completed.status === 'failed'
                  ? 'A última auditoria falhou. O relatório anterior foi preservado; consulte o log.' : null,
              }));
            } catch {
              runtimeError = 'Não foi possível registrar o resultado da auditoria.';
            }
          },
        });
        writeJson('scheduler.json', { ...state, lastJob: publicJobSummary(job) });
        return job;
      } catch (error) {
        writeJson('scheduler.json', { ...state, error: 'Não foi possível iniciar a auditoria.' });
        throw new EquipmentError(503, 'Não foi possível iniciar a auditoria. Verifique o painel.');
      }
    });
  }

  function attemptScheduled() {
    try {
      if (!readSettings().enabled) return null;
      const state = readScheduler();
      const current = localAuditTime(clock());
      if (current.hour < 7 || (state.lastAttempt && localAuditTime(new Date(state.lastAttempt)).day === current.day))
        return null;
      return run('scheduled');
    } catch (error) {
      if (error.status !== 409) runtimeError = error.message;
      return null;
    }
  }

  function setSchedule(enabled) {
    if (typeof enabled !== 'boolean') throw new EquipmentError(400, 'enabled deve ser booleano.');
    withStateLock(() => writeJson('settings.json', {
      schemaVersion: 1, enabled, updatedAt: clock().toISOString(),
    }));
    runtimeError = null;
    if (enabled) {
      task?.start();
      if (started) attemptScheduled();
    } else task?.stop();
    return getSchedule();
  }

  function review(input) {
    const { reviewKey, status, note, sourceUrl } = input || {};
    if (typeof reviewKey !== 'string' || !HASH.test(reviewKey) || !['reviewed', 'pending'].includes(status))
      throw new EquipmentError(400, 'Revisão ou status inválido.');
    if (typeof note !== 'string' || note.length > 2000 || (status === 'reviewed' && !note.trim()))
      throw new EquipmentError(400, 'Informe uma nota de até 2.000 caracteres para concluir a revisão.');
    if (sourceUrl !== undefined && (typeof sourceUrl !== 'string' || sourceUrl.length > 2048))
      throw new EquipmentError(400, 'URL da fonte inválida.');
    const cleanUrl = sourceUrl?.trim();
    if (cleanUrl) {
      try {
        const parsed = new URL(cleanUrl);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Invalid URL');
      } catch { throw new EquipmentError(400, 'Use uma URL HTTPS sem credenciais.'); }
    }
    return withStateLock(() => {
      const report = readReport();
      if (!report?.vehicles.some((vehicle) => vehicle.reviewKey === reviewKey))
        throw new EquipmentError(409, 'O cadastro mudou ou o relatório não está disponível. Atualize antes de revisar.');
      const reviews = readReviews();
      const saved = { status, note: note.trim(), ...(cleanUrl ? { sourceUrl: cleanUrl } : {}), updatedAt: clock().toISOString() };
      writeJson('reviews.json', retainedReviews(
        { ...reviews, [reviewKey]: saved }, new Set(report.vehicles.map((vehicle) => vehicle.reviewKey)),
      ));
      return saved;
    });
  }

  function start() {
    if (started) return;
    started = true;
    task = cronApi.createTask(EQUIPMENT_CRON, attemptScheduled, {
      // noOverlap covers the callback, not a subprocess. run() also checks the
      // runner's complete queued/running set before enqueueing an audit.
      name: 'netcar-equipment-audit', timezone: EQUIPMENT_TIMEZONE, noOverlap: true,
    });
    try {
      // The runner is in-memory. An old queued/running job cannot be reported as
      // active forever after the container restarts, nor retried every restart.
      withStateLock(() => {
        const saved = readScheduler();
        if (ACTIVE.has(saved.lastJob?.status) && !runner.getJob(saved.lastJob.id)) {
          writeJson('scheduler.json', { ...saved,
            lastJob: { ...saved.lastJob, status: 'failed', finishedAt: clock().getTime(),
              error: 'Auditoria interrompida durante reinício do painel.' },
            error: 'A auditoria anterior foi interrompida. Execute novamente para atualizar o relatório.',
          });
        } else if (saved.lastAttempt && !saved.lastJob && !saved.error) {
          writeJson('scheduler.json', { ...saved,
            error: 'A auditoria anterior foi interrompida antes de entrar na fila. Execute novamente.',
          });
        }
      });
      if (readSettings().enabled) {
        task.start();
        attemptScheduled();
      }
    } catch (error) { runtimeError = error.message; }
  }

  function stop() {
    task?.destroy();
    task = null;
    started = false;
  }

  return { getState, run, setSchedule, review, start, stop, attemptScheduled };
}

export const equipmentService = createEquipmentService();
