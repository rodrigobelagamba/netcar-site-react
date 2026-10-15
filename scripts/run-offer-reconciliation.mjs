#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { acquireSitePublishLock } from './lib/site-publish-lock.mjs';
import { fetchCompleteSeoStock } from './lib/seo-stock-source.js';
import { writeSeoBuildStockSnapshot } from './lib/seo-stock-cache.js';
import { runOfferReconciliation } from './reconcile-offers.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedTrackedFiles = new Set(['public/seo/home-lcp.json', 'public/seo/stock-bootstrap.json']);
const offerPath = (path) => /^src\/data\/seo\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.json$/.test(path);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const writePrivateJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

/** Execute one run. Dependencies are injectable only through this JS API for isolated tests. */
export async function runScheduledOfferReconciliation({
  rootDir = defaultRoot,
  apply = false,
  loadStock = fetchCompleteSeoStock,
  reconcile = runOfferReconciliation,
  execute = execFileSync,
  emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`),
} = {}) {
  const release = acquireSitePublishLock(rootDir);
  process.once('exit', release);
  const stateDir = join(rootDir, '.devops', 'offer-reconciliation');
  const runsDir = join(stateDir, 'runs');
  mkdirSync(runsDir, { recursive: true, mode: 0o700 });
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  const reportPath = join(runsDir, `${runId}.json`);
  const logPath = join(runsDir, `${runId}.log`);
  const logFd = openSync(logPath, 'wx', 0o600);
  const pendingPushPath = join(stateDir, 'pending-push.json');
  const report = { runId, mode: apply ? 'apply' : 'dry-run', startedAt: new Date().toISOString(), status: 'running' };
  let reconciliation;
  let deployed = false;
  const git = (args, cwd = rootDir) => execute('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', logFd] }).trim();
  const phase = (name) => { report.phase = name; emit({ runId, phase: name }); writePrivateJson(reportPath, report); };
  try {
    if (existsSync(pendingPushPath)) throw new Error('previous_offer_commit_needs_push');
    report.sourceBefore = git(['rev-parse', 'HEAD']);
    report.previousDist = existsSync(join(rootDir, 'dist', '.git')) ? git(['rev-parse', 'HEAD'], join(rootDir, 'dist')) : null;
    if (apply) {
      const branch = git(['branch', '--show-current']);
      if (!['master', 'main'].includes(branch)) throw new Error('scheduled_reconciliation_requires_default_branch');
      if (git(['diff', '--cached', '--name-only'])) throw new Error('staged_changes_present');
      if (git(['rev-list', '--count', '@{upstream}..HEAD']) !== '0') throw new Error('unpushed_commits_present');
      const dirty = git(['diff', '--name-only', '-z', 'HEAD']).split('\0').filter(Boolean);
      if (dirty.some((path) => !generatedTrackedFiles.has(path))) throw new Error('unrelated_local_changes_present');
      const untrackedPublished = git(['ls-files', '--others', '--exclude-standard', '-z', '--', 'src', 'public'])
        .split('\0').filter(Boolean);
      if (untrackedPublished.some((path) => !/^public\/arquivos\/autocheck\/[a-zA-Z0-9_-]+\.meta\.json$/.test(path))) {
        throw new Error('untracked_publication_files_present');
      }
    }
    phase('read_complete_inventory');
    const snapshot = await loadStock({ rootDir });
    writeSeoBuildStockSnapshot(rootDir, snapshot.vehicles, snapshot);
    phase('reconcile_offers');
    reconciliation = await reconcile({ rootDir, apply, snapshotFromBuild: true });
    if (!Array.isArray(reconciliation.changedFiles) || reconciliation.changedFiles.some((path) => !offerPath(path))) {
      throw new Error('unexpected_reconciliation_path');
    }
    report.summary = reconciliation.summary;
    report.offersChanged = reconciliation.changed;
    report.changedFiles = reconciliation.changedFiles;
    report.backupId = reconciliation.backupId || null;
    if (!apply) {
      report.status = 'planned';
      return report;
    }
    // generate-landings and every following generator use this validated snapshot.
    // No blog generation or text regeneration runs in this scheduled pipeline.
    writePrivateJson(pendingPushPath, {
      runId, sourceBefore: report.sourceBefore, previousDist: report.previousDist,
      changedFiles: reconciliation.changedFiles, backupId: report.backupId, state: 'deploying',
    });
    phase('build_and_deploy');
    execute(process.execPath, ['scripts/deploy-local.js'], {
      cwd: rootDir,
      env: { ...process.env, NETCAR_REUSE_SEO_BUILD_STOCK: '1' },
      stdio: ['ignore', logFd, logFd],
    });
    deployed = true;
    report.dist = git(['rev-parse', 'HEAD'], join(rootDir, 'dist'));
    report.deployedAt = new Date().toISOString();
    if (git(['rev-parse', 'HEAD']) !== report.sourceBefore) throw new Error('source_changed_during_deploy');
    // Commit only bytes produced by this reconciliation, never someone else's index.
    if (git(['diff', '--cached', '--name-only'])) throw new Error('staged_changes_present');
    const changedFiles = reconciliation.changedFiles;
    if (changedFiles.length) {
      const manifest = JSON.parse(readFileSync(join(stateDir, 'backups', reconciliation.backupId, 'manifest.json'), 'utf8'));
      const actualDirty = git(['diff', '--name-only', '-z', '--', 'src/data/seo']).split('\0').filter(Boolean).sort();
      if (JSON.stringify(actualDirty) !== JSON.stringify([...changedFiles].sort())) throw new Error('offer_files_changed_after_reconciliation');
      for (const file of manifest.files) {
        if (!changedFiles.includes(file.path) || sha256(readFileSync(join(rootDir, file.path))) !== file.afterSha256) {
          throw new Error('offer_files_changed_after_reconciliation');
        }
      }
    }
    phase('prepare_host_persistence');
    // The host owns the existing GitHub credentials. Do not mount those into
    // this container or introduce a second credential path.
    writePrivateJson(pendingPushPath, {
      runId, sourceBefore: report.sourceBefore, dist: report.dist,
      changedFiles, backupId: report.backupId, state: 'ready',
    });
    report.status = 'deployed_pending_persistence';
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = /^[a-z][a-z0-9_]+$/.test(error?.message || '') ? error.message : 'scheduled_reconciliation_failed';
    report.productionMayHaveChanged = report.phase === 'build_and_deploy' || deployed;
    if (!deployed && reconciliation?.backupId) {
      try {
        await reconcile({ rootDir, rollback: reconciliation.backupId });
        report.dataRollback = 'restored';
      } catch { report.dataRollback = 'needs_review'; }
    }
    if (existsSync(pendingPushPath)) {
      const pending = JSON.parse(readFileSync(pendingPushPath, 'utf8'));
      if (pending.runId === runId) writePrivateJson(pendingPushPath, { ...pending, state: 'deployment_failed', error: report.error });
    }
    // Host persistence retains a private marker. CI refuses to reset this state.
    // An upload can be partial: never automatically roll production back here.
    throw Object.assign(new Error(report.error), { report });
  } finally {
    report.finishedAt = new Date().toISOString();
    writePrivateJson(reportPath, report);
    emit({ runId, status: report.status, summary: report.summary, sourceBefore: report.sourceBefore,
      sourceAfter: report.sourceAfter, dist: report.dist, previousDist: report.previousDist,
      backupId: report.backupId, error: report.error, dataRollback: report.dataRollback,
      productionMayHaveChanged: report.productionMayHaveChanged, offersChanged: report.offersChanged });
    closeSync(logFd);
    process.removeListener('exit', release);
    release();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !['--apply', '--dry-run'].includes(arg))) {
    process.stderr.write('invalid_scheduled_reconciliation_argument\n');
    process.exitCode = 1;
  } else {
    runScheduledOfferReconciliation({ apply: args.includes('--apply') }).catch((error) => {
      process.stderr.write(`${error.code === 'NETCAR_SITE_PUBLISH_BUSY' ? error.code : error.report?.error || 'scheduled_reconciliation_failed'}\n`);
      process.exitCode = error.exitCode || 1;
    });
  }
}
