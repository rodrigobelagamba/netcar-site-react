import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { collectBuildPermissionTargets, normalizeBuildPermissions } from '../lib/ssh-deploy.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'netcar-permissions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), 'public build fixture');
  };
  return { root, put };
}

function mockSftp(entries = {}) {
  const calls = [];
  const files = { '/hosting/www': { type: 'directory', mode: 0o755 }, ...entries };
  return {
    calls,
    realpath(path, callback) {
      calls.push(['realpath', path]);
      callback(null, '/hosting/www');
    },
    lstat(path, callback) {
      calls.push(['lstat', path]);
      const entry = files[path];
      if (!entry) return callback(new Error(`Unexpected remote path: ${path}`));
      callback(null, {
        mode: entry.mode,
        isDirectory: () => entry.type === 'directory',
        isFile: () => entry.type === 'file',
      });
    },
    chmod(path, mode, callback) {
      calls.push(['chmod', path, mode]);
      callback(null);
    },
  };
}

test('permission manifest excludes all delivery data, live media and Git without dropping public neighbors', (t) => {
  const f = fixture(t);
  for (const path of ['index.php', '.htaccess', 'assets/app.js',
    'entregas-data/seed.json', 'entregas-data/.htaccess', 'entregas-data/private/nested.json',
    'entregas-media/live/image.webp', 'entregas-media/archive.webp',
    'entregas-media/lively/public.webp', 'entregas-data-backup/public.json',
    '.git/config', '.gitignore', '.git-commit-msg.txt']) f.put(path);
  const paths = collectBuildPermissionTargets(f.root).map((entry) => entry.path);
  assert.deepEqual(paths, ['.htaccess', 'assets', 'assets/app.js',
    'entregas-data-backup', 'entregas-data-backup/public.json', 'entregas-media',
    'entregas-media/archive.webp', 'entregas-media/lively', 'entregas-media/lively/public.webp', 'index.php']);
});

test('local symlinks are rejected, without traversing excluded runtime directories', (t) => {
  const f = fixture(t);
  mkdirSync(join(f.root, 'entregas-media'));
  symlinkSync('/private-not-a-build-directory', join(f.root, 'entregas-data'));
  symlinkSync('/private-not-a-build-directory', join(f.root, 'entregas-media/live'));
  assert.deepEqual(collectBuildPermissionTargets(f.root), [{ path: 'entregas-media', directory: true }]);
  symlinkSync('/private-not-a-build-directory', join(f.root, 'assets'));
  assert.throws(() => collectBuildPermissionTargets(f.root), /Entrada não regular.*assets/);
});

test('SFTP applies additive a+rX only to build paths, preserving write and execute bits', async () => {
  const sftp = mockSftp({
    '/hosting/www/assets': { type: 'directory', mode: 0o700 },
    '/hosting/www/assets/app.js': { type: 'file', mode: 0o600 },
    '/hosting/www/task.php': { type: 'file', mode: 0o700 },
    '/hosting/www/group.txt': { type: 'file', mode: 0o660 },
    '/hosting/www/ready.txt': { type: 'file', mode: 0o644 },
    '/hosting/www/.env': { type: 'file', mode: 0o600 },
  });
  const total = await normalizeBuildPermissions(sftp, 'www', [
    { path: 'assets/app.js', directory: false },
    { path: 'assets', directory: true },
    { path: 'task.php', directory: false },
    { path: 'group.txt', directory: false },
    { path: 'ready.txt', directory: false },
    { path: 'entregas-data', directory: true },
    { path: 'entregas-data/seed.json', directory: false },
    { path: 'entregas-media/live', directory: true },
  ]);
  assert.equal(total, 5);
  assert.deepEqual(sftp.calls.filter(([method]) => method === 'chmod'), [
    ['chmod', '/hosting/www/assets', 0o755],
    ['chmod', '/hosting/www/assets/app.js', 0o644],
    ['chmod', '/hosting/www/task.php', 0o755],
    ['chmod', '/hosting/www/group.txt', 0o664],
  ]);
  assert.ok(!sftp.calls.some(([, path]) => path.includes('entregas-') || path.endsWith('/.env')));
  const parentCheck = sftp.calls.findIndex(([method, path]) => method === 'lstat' && path.endsWith('/assets'));
  const childCheck = sftp.calls.findIndex(([method, path]) => method === 'lstat' && path.endsWith('/app.js'));
  assert.ok(parentCheck < childCheck);
});

test('invalid and incomplete manifests fail before making any SFTP call', async () => {
  for (const path of ['../private', '/private', 'a/../private', './a', 'a//b', 'a\\b', 'a\nb']) {
    const sftp = mockSftp();
    await assert.rejects(normalizeBuildPermissions(sftp, 'www', [{ path, directory: false }]), /Caminho inválido/);
    assert.deepEqual(sftp.calls, []);
  }
  const sftp = mockSftp();
  await assert.rejects(normalizeBuildPermissions(sftp, 'www', [{ path: 'missing/file', directory: false }]), /Diretório ausente/);
  assert.deepEqual(sftp.calls, []);
});

test('remote symlinks cannot redirect permissions outside the build root or into runtime', async () => {
  for (const directory of [true, false]) {
    const sftp = mockSftp({ '/hosting/www/assets': { type: 'symlink', mode: 0o777 } });
    const targets = [{ path: 'assets', directory }];
    if (directory) targets.push({ path: 'assets/private', directory: false });
    await assert.rejects(normalizeBuildPermissions(sftp, 'www', targets), /não corresponde ao build/);
    assert.ok(!sftp.calls.some(([method]) => method === 'chmod'));
    assert.ok(!sftp.calls.some(([, path]) => path.endsWith('/private')));
  }
});

test('SFTP permission errors fail the deployment', async () => {
  const sftp = mockSftp({ '/hosting/www/index.php': { type: 'file', mode: 0o600 } });
  sftp.chmod = (_path, _mode, callback) => callback(new Error('Permission denied'));
  await assert.rejects(normalizeBuildPermissions(sftp, 'www', [{ path: 'index.php', directory: false }]), /Permission denied/);
});
