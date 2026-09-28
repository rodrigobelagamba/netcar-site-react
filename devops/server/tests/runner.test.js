import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { enqueueJob, findActiveJob, getJob } from '../services/runner.js';

test('spawn failure completes once and keeps following jobs serial', async () => {
  let failureCompletions = 0;
  const failed = enqueueJob({ label: 'missing test command', command: '/nonexistent/netcar-runner-test',
    onComplete: () => { failureCompletions++; } });
  const second = enqueueJob({ label: 'serial blocker', command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 120)'] });
  const third = enqueueJob({ label: 'equipment queue check', command: process.execPath,
    args: ['-e', 'process.exit(0)'], meta: { kind: 'equipment:audit' } });
  assert.equal(findActiveJob('equipment:audit').id, third.id);
  const deadline = Date.now() + 5000;
  while (['queued', 'running'].includes(getJob(third.id).status) && Date.now() < deadline) await delay(10);
  assert.equal(failureCompletions, 1);
  assert.equal(getJob(failed.id).status, 'failed');
  assert.equal(getJob(second.id).status, 'succeeded');
  assert.equal(getJob(third.id).status, 'succeeded');
  assert.ok(getJob(third.id).startedAt >= getJob(second.id).finishedAt, 'spawn error must not pump the queue twice');
  assert.equal(findActiveJob('equipment:audit'), null);
});
