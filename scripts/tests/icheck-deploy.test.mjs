import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { collectBuildPermissionTargets, isCertificatePdfPath, tarExcludeShellFlags } from '../lib/ssh-deploy.js';

const certificate = 'arquivos/autocheck/CheckAuto_ABC1D23_1000.pdf';
const metadata = 'arquivos/autocheck/CheckAuto_ABC1D23_1000.meta.json';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'netcar-icheck-deploy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (base, name, body) => {
    mkdirSync(dirname(join(base, name)), { recursive: true });
    writeFileSync(join(base, name), body);
  };
  return { root, put };
}

test('certificate PDFs are recognized in archive and FTP paths, metadata is not', () => {
  for (const name of [certificate, `./${certificate}`, certificate.replaceAll('/', '\\')]) {
    assert.equal(isCertificatePdfPath(name), true);
  }
  for (const name of [metadata, 'arquivos/outros/manual.pdf', 'arquivos/autocheck/nested/file.pdf', 'assets/main.js']) {
    assert.equal(isCertificatePdfPath(name), false);
  }
});

test('a full-site deploy keeps the published CheckAuto certificate and still ships fresh metadata', (t) => {
  const f = fixture(t);
  const build = join(f.root, 'dist');
  const remote = join(f.root, 'remote');
  f.put(build, certificate, 'STALE NETCAR DOSSIER');
  f.put(build, metadata, '{"schemaVersion":2}');
  f.put(build, 'index.html', '<script src="/assets/main.js"></script>');
  f.put(remote, certificate, 'OFFICIAL CERTIFICATE');

  const packed = spawnSync('tar', [...tarExcludeShellFlags().split(' '), '-cf', '-', '.'], { cwd: build });
  assert.equal(packed.status, 0, packed.stderr?.toString());
  const extracted = spawnSync('tar', ['-C', remote, '-xf', '-'], { input: packed.stdout });
  assert.equal(extracted.status, 0, extracted.stderr?.toString());

  assert.equal(readFileSync(join(remote, certificate), 'utf8'), 'OFFICIAL CERTIFICATE');
  assert.equal(readFileSync(join(remote, metadata), 'utf8'), '{"schemaVersion":2}');
  assert.equal(readFileSync(join(remote, 'index.html'), 'utf8'), '<script src="/assets/main.js"></script>');
  const permissionPaths = collectBuildPermissionTargets(build).map((entry) => entry.path);
  assert.ok(!permissionPaths.includes(certificate));
  assert.ok(permissionPaths.includes(metadata));
});
