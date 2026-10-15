import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { acquireSitePublishLock } from '../lib/site-publish-lock.mjs';

function fixture(t, content = 'node -e "require(\'fs\').writeFileSync(\'generated\',\'ok\')"') {
  const root = mkdtempSync(join(tmpdir(), 'netcar-offer-build-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts/lib'), { recursive: true });
  for (const name of ['run-locked-build.mjs', 'lib/site-publish-lock.mjs']) {
    copyFileSync(new URL(`../${name}`, import.meta.url), join(root, 'scripts', name));
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'build:content': content } }));
  const env = { ...process.env };
  delete env.NETCAR_SITE_LOCK_TOKEN;
  const run = () => spawnSync(process.execPath, [join(root, 'scripts/run-locked-build.mjs')], { env, encoding: 'utf8' });
  return { root, env, run };
}

test('a competing build is blocked before any generated file is written', (t) => {
  const { root, run } = fixture(t);
  const release = acquireSitePublishLock(root, {});
  try {
    const result = run();
    assert.equal(result.status, 75);
    assert.match(result.stderr, /NETCAR_SITE_PUBLISH_BUSY/);
    assert.equal(existsSync(join(root, 'generated')), false);
  } finally { release(); }
});

test('a deploy child inherits ownership and does not release its parent lock', (t) => {
  const { root, env, run } = fixture(t);
  const release = acquireSitePublishLock(root, env);
  try {
    assert.equal(run().status, 0);
    assert.equal(existsSync(join(root, 'generated')), true);
    assert.equal(existsSync(join(root, '.devops/site-publish.lock')), true);
  } finally { release(); }
});

test('a failed build preserves its failure status and releases its own lock', (t) => {
  const { root, run } = fixture(t, 'node -e "process.exit(5)"');
  assert.equal(run().status, 5);
  assert.equal(existsSync(join(root, '.devops/site-publish.lock')), false);
});
