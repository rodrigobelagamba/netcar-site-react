import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync, closeSync, mkdirSync, openSync, readFileSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import cron from 'node-cron';
import { config } from './config.js';
import { enqueueJob, findActiveJob, getJob } from './runner.js';

export const EQUIPMENT_CRON = '0 9 * * *';
export const EQUIPMENT_TIMEZONE = 'America/Sao_Paulo';
export const MAX_HISTORICAL_REVIEWS = 1000;
export const MAX_REVIEW_STATE_BYTES = 8 * 1024 * 1024;
const MAX_STATE_FILE_BYTES = 10 * 1024 * 1024;
const JOB_KIND = 'equipment:audit';
const REVIEW_JOB_KIND = 'equipment:review';
const HASH = /^[a-f0-9]{64}$/;
const ACTIVE = new Set(['queued', 'running']);

const objectFields = (value, allowed) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every((key) => allowed.includes(key));
const boundedText = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit &&
  !value.trim().startsWith('--') && [...value].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
const validInstant = (value) => typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const validHash = (value) => typeof value === 'string' && HASH.test(value);
const validSelector = (value) => validHash(value.key) && typeof value.vehicleId === 'string' && /^\d{1,20}$/.test(value.vehicleId) &&
  typeof value.itemKey === 'string' && /^[a-z0-9][a-z0-9_-]{0,149}$/.test(value.itemKey);

// Same canonical JSON ordering as the CLI proposal digest. This checks the
// private preview at the API boundary; the CLI revalidates stock/base/decisions.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}

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
    let discovery = null;
    let researchReviews = [];
    let researchError = null;
    try {
      discovery = readJson('research-discovery.json', null);
      if (discovery !== null && (discovery.schemaVersion !== 1 || !Number.isFinite(Date.parse(discovery.observedAt)) || !Array.isArray(discovery.vehicles) || !discovery.counts || !HASH.test(discovery.snapshotSha256)))
        throw new EquipmentError(503, 'Relatório de pesquisa inválido. Preserve o arquivo para investigação.');
      const ledger = readResearchLedger();
      researchReviews = ledger.revisions.filter((revision) => revision.active || revision.publication).map((revision) => ({
        key: revision.key, candidate: revision.candidate, status: revision.status, active: revision.active,
        contextBlockers: revision.contextBlockers, askedAt: revision.askedAt, answeredAt: revision.answeredAt,
        decision: revision.decision, publication: revision.publication,
        invalidatedAt: revision.invalidatedAt, invalidationReason: revision.invalidationReason,
      }));
    } catch (error) { researchError = error.message; discovery = null; }
    return { schedule, report, reviews, research: { discovery, revisions: researchReviews, error: researchError } };
  }

  function readResearchLedger() {
    const ledger = readJson('research-review.json', { schemaVersion: 1, revisions: [], events: [] });
    if (ledger?.schemaVersion !== 1 || !Array.isArray(ledger.revisions) || ledger.revisions.length > 10000 ||
      !ledger.revisions.every((revision) => revision && HASH.test(revision.key) && typeof revision.active === 'boolean' &&
        ['pending', 'presence_confirmed', 'authorized', 'published', 'excluded', 'confirmed', 'rejected', 'deferred'].includes(revision.status) &&
        /^\d{1,20}$/.test(revision.candidate?.identity?.id) && typeof revision.candidate?.item?.key === 'string'))
      throw new EquipmentError(503, 'Histórico de pesquisa inválido; preserve o arquivo para investigação.');
    return ledger;
  }

  function activeEquipmentJob() {
    return runner.findActiveJob(JOB_KIND) || runner.findActiveJob(REVIEW_JOB_KIND);
  }

  function enqueueResearchCli(label, args) {
    return runner.enqueueJob({ label, command: process.execPath, args,
      cwd: workspaceRoot, meta: { kind: REVIEW_JOB_KIND },
      // A review may overlap 09:00. The existing daily dedupe catches up once.
      onComplete: () => { if (started) attemptScheduled(); },
    });
  }

  function researchOperation(action) {
    return withStateLock(() => {
      const active = activeEquipmentJob();
      if (active) throw new EquipmentError(409, 'Uma rotina de equipamentos está em andamento. Aguarde.', active);
      return action();
    });
  }

  function getResearchProposal() {
    const proposal = readJson('research-proposal.json', null);
    if (proposal === null) throw new EquipmentError(404, 'Nenhuma proposta preparada. Execute prepare primeiro.');
    const fields = ['schemaVersion', 'proposalOnly', 'generatedAt', 'snapshotObservedAt', 'baseSha256', 'includedKeys',
      'decisionSha256', 'proposalSha256', 'limitations', 'reviewBindings', 'blocked', 'confirmationDocument'];
    const identity = (value) => objectFields(value, ['id', 'brand', 'model', 'manufactureYear', 'modelYear', 'engine', 'transmission', 'market']) &&
      typeof value.id === 'string' && /^\d{1,20}$/.test(value.id) && ['brand', 'model', 'engine', 'transmission'].every((key) => boundedText(value[key], 400)) &&
      value.market === 'BR' && Number.isInteger(value.modelYear) && value.modelYear >= 1900 && value.modelYear <= 2100 &&
      (value.manufactureYear === undefined || (Number.isInteger(value.manufactureYear) && value.manufactureYear >= 1900 && value.manufactureYear <= 2100));
    const strings = (value) => Array.isArray(value) && value.length <= 2000 && value.every((entry) => boundedText(entry, 2000));
    if (!objectFields(proposal, fields) || proposal.schemaVersion !== 1 || proposal.proposalOnly !== true ||
      !validInstant(proposal.generatedAt) || !validInstant(proposal.snapshotObservedAt) ||
      !['baseSha256', 'decisionSha256', 'proposalSha256'].every((key) => validHash(proposal[key])) ||
      !Array.isArray(proposal.includedKeys) || proposal.includedKeys.length > 2000 || !proposal.includedKeys.every(validHash) ||
      new Set(proposal.includedKeys).size !== proposal.includedKeys.length || !strings(proposal.limitations) ||
      !Array.isArray(proposal.reviewBindings) || proposal.reviewBindings.length !== proposal.includedKeys.length ||
      !proposal.reviewBindings.every((binding) => objectFields(binding, ['key', 'identity', 'stockFingerprint', 'sourceIdentityConfirmed']) &&
        validHash(binding.key) && proposal.includedKeys.includes(binding.key) && identity(binding.identity) &&
        validHash(binding.stockFingerprint) && typeof binding.sourceIdentityConfirmed === 'boolean') ||
      new Set(proposal.reviewBindings.map((binding) => binding.key)).size !== proposal.includedKeys.length ||
      !Array.isArray(proposal.blocked) || proposal.blocked.length > 10000 || !proposal.blocked.every((entry) =>
        objectFields(entry, ['key', 'reasons', 'itemDraft']) && validHash(entry.key) && strings(entry.reasons) &&
        (entry.itemDraft === undefined || (objectFields(entry.itemDraft, ['key', 'label', 'proposedTag', 'status']) &&
          boundedText(entry.itemDraft.key, 150) && boundedText(entry.itemDraft.label, 400) &&
          entry.itemDraft.proposedTag === null && entry.itemDraft.status === 'taxonomy_review_required'))) ||
      !proposal.confirmationDocument || typeof proposal.confirmationDocument !== 'object' || Array.isArray(proposal.confirmationDocument) ||
      !Array.isArray(proposal.confirmationDocument.records) || proposal.confirmationDocument.records.length > 2000)
      throw new EquipmentError(503, 'Proposta de equipamentos inválida. Preserve o arquivo e prepare novamente.');
    const { proposalSha256, ...contents } = proposal;
    if (createHash('sha256').update(canonical(contents)).digest('hex') !== proposalSha256)
      throw new EquipmentError(503, 'Hash da proposta inválido. Preserve o arquivo e prepare novamente.');
    return proposal;
  }

  function prepareResearch(input) {
    if (!objectFields(input, [])) throw new EquipmentError(400, 'Envie um objeto vazio para preparar a proposta.');
    return researchOperation(() => enqueueResearchCli('Preparar proposta de equipamentos',
      ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'prepare', '--state-dir', stateDir]));
  }

  function applyResearch(input) {
    if (!objectFields(input, ['proposalSha256']) || !validHash(input.proposalSha256))
      throw new EquipmentError(400, 'Informe somente o hash exato da proposta revisada.');
    return researchOperation(() => {
      let proposal;
      try { proposal = getResearchProposal(); } catch (error) {
        if (error.status === 404) throw new EquipmentError(409, 'Prepare e confira uma proposta antes de aplicar.');
        throw error;
      }
      if (proposal.proposalSha256 !== input.proposalSha256 || !proposal.includedKeys.length)
        throw new EquipmentError(409, 'A proposta mudou ou não contém itens autorizados. Prepare e confira novamente.');
      const ledger = readResearchLedger();
      for (const binding of proposal.reviewBindings) {
        const revision = ledger.revisions.find((entry) => entry.key === binding.key);
        if (!revision?.active || revision.invalidatedAt || revision.unitAbsentSince || revision.supersededBy ||
          !['authorized', 'confirmed'].includes(revision.status) || revision.decision?.authorizePublication !== true ||
          revision.decision?.present !== true || revision.decision?.marketConfirmed !== true ||
          !boundedText(revision.decision?.confirmationReference, 2000) ||
          !boundedText(revision.decision?.approvedText?.name, 400) || !boundedText(revision.decision?.approvedText?.description, 2000) ||
          canonical(revision.candidate.identity) !== canonical(binding.identity) || revision.stockFingerprint !== binding.stockFingerprint ||
          revision.decision?.sourceIdentityConfirmed !== binding.sourceIdentityConfirmed)
          throw new EquipmentError(409, 'Uma decisão ou identidade da proposta mudou. Prepare e confira novamente.');
      }
      return enqueueResearchCli('Aplicar proposta autorizada de equipamentos',
        ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'apply', '--proposal-sha256', input.proposalSha256, '--state-dir', stateDir]);
    });
  }

  function recordResearchPublication(input) {
    const fields = ['key', 'vehicleId', 'itemKey', 'commit', 'publicUrl', 'evidenceReference', 'reversalReference'];
    if (!objectFields(input, fields) || !validSelector(input) || typeof input.commit !== 'string' || !/^[a-f0-9]{40}$/.test(input.commit) ||
      !boundedText(input.publicUrl, 2048) || !boundedText(input.evidenceReference, 2000) || !boundedText(input.reversalReference, 2000))
      throw new EquipmentError(400, 'Informe unidade, item, commit completo e referências de publicação e reversão.');
    try {
      const url = new URL(input.publicUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'www.netcarmultimarcas.com.br' || url.port || url.username || url.password ||
        url.search || url.hash || url.pathname !== `/veiculo/${input.vehicleId}`) throw new Error('Invalid URL');
    } catch { throw new EquipmentError(400, 'Use a URL HTTPS exata da ficha pública desta unidade.'); }
    return researchOperation(() => {
      const revision = readResearchLedger().revisions.find((entry) => entry.key === input.key && entry.active &&
        entry.candidate.identity.id === input.vehicleId && entry.candidate.item.key === input.itemKey);
      if (!revision || revision.invalidatedAt || revision.unitAbsentSince || revision.supersededBy ||
        !['authorized', 'confirmed', 'published'].includes(revision.status) || revision.decision?.authorizePublication !== true ||
        !revision.application || !['proposalSha256', 'beforeSha256', 'afterSha256'].every((key) => validHash(revision.application[key])) ||
        !validInstant(revision.application.appliedAt))
        throw new EquipmentError(409, 'A revisão específica precisa estar autorizada e aplicada antes de registrar publicação.');
      return enqueueResearchCli(`Registrar publicação de equipamento #${input.vehicleId}: ${input.itemKey}`,
        ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'record-publication', '--key', input.key,
          '--vehicle-id', input.vehicleId, '--item-key', input.itemKey, '--commit', input.commit, '--public-url', input.publicUrl,
          '--evidence-reference', input.evidenceReference.trim(), '--reversal-reference', input.reversalReference.trim(), '--state-dir', stateDir]);
    });
  }

  function run(reason = 'manual') {
    return withStateLock(() => {
      const active = activeEquipmentJob();
      if (active) throw new EquipmentError(409, 'Já existe auditoria em execução ou na fila.', active);
      const attemptedAt = clock().toISOString();
      const state = { ...readScheduler(), lastAttempt: attemptedAt, lastJob: null, reason, error: null };
      // Record before enqueueing so a process crash cannot cause endless daily retries.
      writeJson('scheduler.json', state);
      runtimeError = null;
      try {
        const job = runner.enqueueJob({
          label: 'Auditoria e descoberta de equipamentos',
          command: process.execPath,
          args: ['scripts/run-equipment-daily.mjs', '--state-dir', stateDir, '--input', join(workspaceRoot, 'docs', 'equipment-research-library.json')],
          cwd: workspaceRoot,
          meta: { kind: JOB_KIND },
          onComplete: (completed) => {
            try {
              withStateLock(() => writeJson('scheduler.json', {
                ...state,
                lastJob: publicJobSummary(completed),
                error: completed.status === 'failed'
                  ? 'A rotina falhou. Os últimos resultados válidos de cada etapa foram preservados; consulte o log e as datas.' : null,
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
      if (current.hour < 9 || (state.lastAttempt && localAuditTime(new Date(state.lastAttempt)).day === current.day))
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

  function decideResearch(input) {
    const allowed = ['key', 'vehicleId', 'itemKey', 'status', 'note', 'present', 'authorizePublication', 'marketConfirmed',
      'sourceIdentityConfirmed', 'confirmationReference', 'approvedText'];
    const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit && !value.startsWith('--');
    if (!input || Array.isArray(input) || Object.keys(input).some((key) => !allowed.includes(key)) ||
      !HASH.test(input.key) || !/^\d{1,20}$/.test(input.vehicleId) || !/^[a-z0-9][a-z0-9_-]{0,149}$/.test(input.itemKey) ||
      !['presence_confirmed', 'authorized', 'excluded', 'rejected', 'deferred'].includes(input.status) || !text(input.note, 2000) ||
      ['present', 'authorizePublication', 'marketConfirmed', 'sourceIdentityConfirmed'].some((key) => input[key] !== undefined && typeof input[key] !== 'boolean'))
      throw new EquipmentError(400, 'Informe unidade, item, decisão e nota específicos.');
    if (input.confirmationReference !== undefined && !text(input.confirmationReference, 2000))
      throw new EquipmentError(400, 'Referência da confirmação inválida.');
    if (input.approvedText !== undefined && (!input.approvedText || Array.isArray(input.approvedText) ||
      Object.keys(input.approvedText).some((key) => !['name', 'description'].includes(key)) ||
      !text(input.approvedText.name, 400) || !text(input.approvedText.description, 2000)))
      throw new EquipmentError(400, 'Informe o nome e a descrição exatos aprovados.');
    if (input.status === 'authorized' && (!input.present || !input.authorizePublication || !input.marketConfirmed || !input.confirmationReference || !input.approvedText))
      throw new EquipmentError(400, 'Autorizar inclusão exige presença, mercado brasileiro, referência e texto exato aprovados separadamente.');
    if (input.status === 'presence_confirmed' && (!input.present || input.authorizePublication))
      throw new EquipmentError(400, 'Confirmar presença não autoriza publicação.');
    if (['excluded', 'rejected', 'deferred'].includes(input.status) && input.authorizePublication)
      throw new EquipmentError(400, 'Esta decisão não pode autorizar publicação.');
    return withStateLock(() => {
      const active = activeEquipmentJob();
      if (active) throw new EquipmentError(409, 'Uma rotina de equipamentos está em andamento. Aguarde antes de decidir.', active);
      const revision = readResearchLedger().revisions.find((entry) => entry.key === input.key && entry.active &&
        entry.candidate.identity.id === input.vehicleId && entry.candidate.item.key === input.itemKey);
      if (!revision || revision.status === 'published' || revision.invalidatedAt)
        throw new EquipmentError(409, 'A unidade ou a revisão mudou. Atualize o painel antes de decidir.');
      const args = ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'decide', '--key', input.key,
        '--vehicle-id', input.vehicleId, '--item-key', input.itemKey, '--status', input.status, '--note', input.note.trim(), '--state-dir', stateDir];
      for (const [key, flag] of [['present', '--present'], ['authorizePublication', '--authorize-publication'],
        ['marketConfirmed', '--confirm-market'], ['sourceIdentityConfirmed', '--confirm-source-identity']]) if (input[key]) args.push(flag);
      if (input.confirmationReference) args.push('--confirmation-reference', input.confirmationReference.trim());
      if (input.approvedText) args.push('--approved-name', input.approvedText.name.trim(), '--approved-description', input.approvedText.description.trim());
      return enqueueResearchCli(`Decisão de equipamento #${input.vehicleId}: ${input.itemKey}`, args);
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

  return { getState, run, setSchedule, review, decideResearch, prepareResearch, getResearchProposal, applyResearch,
    recordResearchPublication, start, stop, attemptScheduled };
}

export const equipmentService = createEquipmentService();
