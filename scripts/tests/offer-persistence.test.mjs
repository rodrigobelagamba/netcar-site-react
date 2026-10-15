import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('offer persistence: isolated Git commits, guarded failures and push retry', () => {
  const suite = fileURLToPath(new URL('./test_offer_persistence.py', import.meta.url));
  const result = spawnSync('python3', [suite, '-v'], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    timeout: 60_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
