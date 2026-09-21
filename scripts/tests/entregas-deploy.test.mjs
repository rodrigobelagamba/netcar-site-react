import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertDeliveryGalleryBuild, isDeliveryRuntimePath, tarExcludeShellFlags, deployTarViaSshPassword } from '../lib/ssh-deploy.js';

const galleryKey = 'src/modules/entregas/pages/EntregasPage.tsx';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'netcar-deploy-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (name, body = '') => { mkdirSync(join(root, name, '..'), { recursive: true }); writeFileSync(join(root, name), body); };
  put('index.php', `<?php if ($path === '/entregas') { require __DIR__.'/entregas/v1/seo.php'; entregas_inject_initial_html(); }`);
  put('.htaccess', 'RewriteRule ^entregas/?$ index.php [L,QSA]');
  put('entregas/.htaccess', 'DirectorySlash Off\nRewriteOptions AllowNoSlash\nRewriteCond %{REQUEST_URI} ^/entregas/?$');
  for (const file of ['lib.php', 'seo.php', 'feed.php', 'publish.php', 'status.php']) put('entregas/v1/' + file, '<?php');
  put('entregas-data/seed.json', JSON.stringify({ deliveries: [{ id: 'historic', imageUrl: '/entregas-media/existing.webp' }] }));
  put('index.html', '<script src="/assets/main.js"></script>');
  put('assets/main.js', 'const route="/entregas"; import("./gallery.js");');
  put('assets/gallery.js', 'export default function gallery(){}');
  put('assets/gallery.css', '.gallery{}');
  const manifest = { 'index.html': { isEntry: true, file: 'assets/main.js', dynamicImports: [galleryKey] }, [galleryKey]: { file: 'assets/gallery.js', css: ['assets/gallery.css'] } };
  const saveManifest = () => put('.vite/manifest.json', JSON.stringify(manifest));
  saveManifest();
  return { root, put, manifest, saveManifest };
}

test('complete gallery build passes; old snapshot is refused before any SSH connection', async (t) => {
  const f = fixture(t);
  assert.deepEqual(assertDeliveryGalleryBuild(f.root), { deliveries: 1, chunks: 2 });
  f.put('index.php', '<?php http_response_code(404);');
  await assert.rejects(deployTarViaSshPassword({ localDir: f.root }), /Deploy bloqueado.*rota e HTML inicial PHP/);
});

test('copied gallery files cannot conceal a disconnected or incomplete app build', (t) => {
  const f = fixture(t);
  f.manifest['index.html'].dynamicImports = [];
  f.saveManifest();
  assert.throws(() => assertDeliveryGalleryBuild(f.root), /galeria desconectada/);
  f.manifest['index.html'].dynamicImports = [galleryKey];
  f.saveManifest();
  rmSync(join(f.root, 'assets/gallery.css'));
  assert.throws(() => assertDeliveryGalleryBuild(f.root), /gallery.css/);
});

test('PHP, routing, seed, HTML and manifest must belong to a complete gallery release', (t) => {
  const f = fixture(t);
  for (const [name, body] of [['entregas-data/seed.json', '{"deliveries":[]}'], ['.htaccess', 'RewriteRule . index.php'], ['entregas/.htaccess', 'DirectorySlash On'], ['index.html', '<script src="/old.js"></script>']]) {
    const before = readFileSync(join(f.root, name));
    f.put(name, body);
    assert.throws(() => assertDeliveryGalleryBuild(f.root), /Deploy bloqueado/);
    f.put(name, before);
  }
});

test('archive and FTP selection preserve live data while allowing seed and public backend updates', (t) => {
  const f = fixture(t);
  for (const name of ['entregas-data/live.json', 'entregas-data/.publish.lock', 'entregas-data/.entregas-temporary', 'entregas-media/live/existing.webp']) {
    f.put(name, 'MUST NOT UPLOAD');
    assert.equal(isDeliveryRuntimePath(name), true);
    assert.equal(isDeliveryRuntimePath('./' + name), true);
    assert.equal(isDeliveryRuntimePath(name.replaceAll('/', '\\')), true);
  }
  for (const name of ['entregas-data/seed.json', 'entregas-data/.htaccess', 'entregas-media/archive.webp', 'entregas/v1/feed.php']) assert.equal(isDeliveryRuntimePath(name), false);
  const target = join(f.root, 'remote');
  mkdirSync(join(target, 'entregas-data'), { recursive: true });
  mkdirSync(join(target, 'entregas-media/live'), { recursive: true });
  writeFileSync(join(target, 'entregas-data/live.json'), 'REAL TWO DELIVERIES');
  writeFileSync(join(target, 'entregas-media/live/existing.webp'), 'REAL PHOTO');
  const packed = spawnSync('tar', [...tarExcludeShellFlags().split(' '), '--exclude=remote', '-cf', '-', '.'], { cwd: f.root });
  assert.equal(packed.status, 0, packed.stderr?.toString());
  const extracted = spawnSync('tar', ['-C', target, '-xf', '-'], { input: packed.stdout });
  assert.equal(extracted.status, 0, extracted.stderr?.toString());
  assert.equal(readFileSync(join(target, 'entregas-data/live.json'), 'utf8'), 'REAL TWO DELIVERIES');
  assert.equal(readFileSync(join(target, 'entregas-media/live/existing.webp'), 'utf8'), 'REAL PHOTO');
  assert.equal(readFileSync(join(target, 'entregas-data/seed.json'), 'utf8'), readFileSync(join(f.root, 'entregas-data/seed.json'), 'utf8'));
});
