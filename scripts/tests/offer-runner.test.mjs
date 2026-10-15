import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireSitePublishLock } from '../lib/site-publish-lock.mjs';
import { runScheduledOfferReconciliation } from '../run-offer-reconciliation.mjs';

const original = '{"offer":"before"}\n';
const after = '{"offer":"after"}\n';
const relativeOffer = 'src/data/seo/blog-auto.json';
const backupId = '2026-10-15T10-00-00-000Z-12345678-1234-1234-1234-123456789abc';

function fixture(t, options = {}) {
  const rootDir = mkdtempSync(join(tmpdir(), 'netcar-offer-runner-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  mkdirSync(join(rootDir, 'src/data/seo'), { recursive: true });
  mkdirSync(join(rootDir, 'dist/.git'), { recursive: true });
  writeFileSync(join(rootDir, relativeOffer), original);
  const calls = [];
  let applied = false;
  const execute = (command, args, opts) => {
    calls.push({ command, args, opts });
    if (command !== 'git') {
      assert.equal(opts.env.NETCAR_REUSE_SEO_BUILD_STOCK, '1');
      assert.ok(opts.env.NETCAR_SITE_LOCK_TOKEN);
      if (options.deployFails) throw new Error('mock deploy output must not be printed');
      return '';
    }
    const key = args.join(' ');
    if (key === 'rev-parse HEAD') return opts.cwd === join(rootDir, 'dist') ? 'b'.repeat(40) : 'a'.repeat(40);
    if (key === 'branch --show-current') return 'master';
    if (key === 'rev-list --count @{upstream}..HEAD') return '0';
    if (key === 'diff --cached --name-only') return options.staged ? 'somebody.txt' : '';
    if (key === 'diff --name-only -z HEAD') return '';
    if (args[0] === 'ls-files') return options.untracked || '';
    if (key === 'diff --name-only -z -- src/data/seo') return applied ? `${relativeOffer}\0` : '';
    throw new Error(`Unexpected command: ${key}`);
  };
  const loadStock = async () => {
    if (options.incomplete) throw new Error('incomplete_feed');
    return { vehicles: [{ id: 20019, valor: 149900 }], source: 'api-complete', sourceAgeMs: 0 };
  };
  const reconcile = async ({ apply, rollback }) => {
    if (rollback) {
      writeFileSync(join(rootDir, relativeOffer), original);
      applied = false;
      return { changed: true, changedFiles: [relativeOffer] };
    }
    if (apply) {
      applied = true;
      writeFileSync(join(rootDir, relativeOffer), after);
      const backupDir = join(rootDir, '.devops/offer-reconciliation/backups', backupId);
      mkdirSync(backupDir, { recursive: true });
      writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify({ files: [{
        path: relativeOffer, afterSha256: createHash('sha256').update(after).digest('hex'),
      }] }));
    }
    return { changed: true, changedFiles: [relativeOffer], backupId: apply ? backupId : undefined, summary: { pricesChanged: 1 } };
  };
  return { rootDir, calls, execute, loadStock, reconcile, emit: () => {} };
}

test('scheduled dry-run writes only private snapshot/plan, never offers, Git or deploy', async (t) => {
  const setup = fixture(t);
  const report = await runScheduledOfferReconciliation(setup);
  assert.equal(report.status, 'planned');
  assert.equal(readFileSync(join(setup.rootDir, relativeOffer), 'utf8'), original);
  assert.ok(existsSync(join(setup.rootDir, '.devops/seo-build-stock.json')));
  assert.equal(setup.calls.some(({ command }) => command !== 'git'), false);
  assert.equal(existsSync(join(setup.rootDir, '.devops/site-publish.lock')), false);
});

test('successful deploy prepares exact bytes for host Git persistence without container push', async (t) => {
  const setup = fixture(t);
  const report = await runScheduledOfferReconciliation({ ...setup, apply: true });
  assert.equal(report.status, 'deployed_pending_persistence');
  const pending = JSON.parse(readFileSync(join(setup.rootDir, '.devops/offer-reconciliation/pending-push.json')));
  assert.deepEqual(pending.changedFiles, [relativeOffer]);
  assert.equal(pending.sourceBefore, 'a'.repeat(40));
  assert.equal(pending.dist, 'b'.repeat(40));
  assert.equal(setup.calls.some(({ args }) => ['commit', 'push', 'add'].includes(args[0])), false);
});

test('incomplete inventory never reconciles or deploys', async (t) => {
  const setup = fixture(t, { incomplete: true });
  await assert.rejects(runScheduledOfferReconciliation({ ...setup, apply: true }), /incomplete_feed/);
  assert.equal(readFileSync(join(setup.rootDir, relativeOffer), 'utf8'), original);
  assert.equal(setup.calls.some(({ command }) => command !== 'git'), false);
});

test('failed build/upload restores only core backed-up offer bytes and records possible partial upload', async (t) => {
  const setup = fixture(t, { deployFails: true });
  await assert.rejects(runScheduledOfferReconciliation({ ...setup, apply: true }), (error) => {
    assert.equal(error.report.dataRollback, 'restored');
    assert.equal(error.report.productionMayHaveChanged, true);
    return true;
  });
  assert.equal(readFileSync(join(setup.rootDir, relativeOffer), 'utf8'), original);
  const pending = JSON.parse(readFileSync(join(setup.rootDir, '.devops/offer-reconciliation/pending-push.json')));
  assert.equal(pending.state, 'deployment_failed');
});

test('staged work and untracked source/public files block scheduled publication', async (t) => {
  for (const options of [{ staged: true }, { untracked: 'public/foreign.html\0' }, { untracked: 'src/foreign.ts\0' }]) {
    const setup = fixture(t, options);
    await assert.rejects(runScheduledOfferReconciliation({ ...setup, apply: true }), /staged_changes_present|untracked_publication_files_present/);
    assert.equal(setup.calls.some(({ command }) => command !== 'git'), false);
    assert.equal(readFileSync(join(setup.rootDir, relativeOffer), 'utf8'), original);
  }
});

test('existing generated autocheck metadata remains permitted and untouched', async (t) => {
  const setup = fixture(t, { untracked: 'public/arquivos/autocheck/CheckAuto_1234.meta.json\0' });
  const report = await runScheduledOfferReconciliation({ ...setup, apply: true });
  assert.equal(report.status, 'deployed_pending_persistence');
});

test('cross-process lock rejects a different owner, permits its token, and never steals a replaced lock', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'netcar-offer-lock-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const ownerEnv = {};
  const release = acquireSitePublishLock(root, ownerEnv);
  assert.throws(() => acquireSitePublishLock(root, {}), /NETCAR_SITE_PUBLISH_BUSY/);
  acquireSitePublishLock(root, { ...ownerEnv })();
  assert.ok(existsSync(join(root, '.devops/site-publish.lock')));
  writeFileSync(join(root, '.devops/site-publish.lock/token'), 'different-owner\n');
  release();
  assert.ok(existsSync(join(root, '.devops/site-publish.lock')));
  assert.equal(ownerEnv.NETCAR_SITE_LOCK_TOKEN, undefined);
});
