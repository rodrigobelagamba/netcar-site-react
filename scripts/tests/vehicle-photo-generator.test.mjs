import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main, sourcePath, photoJobs, sameGeometry, clearDownloadedPhotoBodies } from '../generate-vehicle-photo-variants.mjs';

const prefix = '/imagens/veiculos_automacar/';
test('source allowlist rejects foreign origins and encoded traversal', () => {
  assert.equal(sourcePath(`.${prefix}CAR%20COVER.png`), `${prefix}CAR COVER.png`);
  for (const input of [
    `https://elsewhere.example${prefix}CAR.png`, `${prefix}CAR.png?redirect=1`,
    `${prefix}%252e%252e/secret.png`, `${prefix}CAR%5Csecret.png`,
    '/images/unrelated.png', `${prefix}CAR.svg`, null,
  ]) assert.equal(sourcePath(input), null);
});
test('gallery budget is the existing big JPEG but the master remains original AVIF', () => {
  const jobs = photoJobs([{ id: '123', imagens_site: {
    capa: `.${prefix}CAR COVER.png`,
    galeria: [`.${prefix}CAR FRONT.avif`, `.${prefix}CAR FRONT.avif`, `${prefix}big/IGNORE.avif`],
  } }]);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[1], { id: '123', kind: 'gallery', requested: `${prefix}big/CAR FRONT.jpg`, original: `${prefix}CAR FRONT.avif` });
});
test('JPEG sibling selection rejects dimension or EXIF orientation conflicts', () => {
  const avif = { width: 1024, height: 768 };
  assert.equal(sameGeometry(avif, { ...avif, orientation: 1 }), true);
  assert.equal(sameGeometry(avif, { width: 952, height: 714 }), false);
  assert.equal(sameGeometry(avif, { ...avif, orientation: 2 }), false);
  assert.equal(sameGeometry(avif, { ...avif, orientation: 6 }), false);
});
test('malformed galleries do not become unintended download requests', () => {
  assert.deepEqual(photoJobs([{ id: '123', imagens_site: { galeria: { arbitrary: 'value' } } }]), []);
});
test('invalid CI sample limits fail before any inventory request', async () => {
  const previous = process.env.NETCAR_PHOTO_BUILD_LIMIT;
  try {
    for (const value of ['0', '-1', '1.5', 'many', '']) {
      process.env.NETCAR_PHOTO_BUILD_LIMIT = value;
      await assert.rejects(main([]), /photo-arguments/);
    }
  } finally {
    if (previous === undefined) delete process.env.NETCAR_PHOTO_BUILD_LIMIT;
    else process.env.NETCAR_PHOTO_BUILD_LIMIT = previous;
  }
});
test('download cleanup preserves encoded cache, metadata and unrelated paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'netcar-photo-cleanup-'));
  const hash = 'a'.repeat(64), linkHash = 'b'.repeat(64), directoryHash = 'c'.repeat(64);
  try {
    for (const name of [`${hash}.body`, `${hash}.avif`, `${hash}.avif.json`, `${hash}.json`, 'original.jpg', 'unrelated.body']) {
      await writeFile(join(directory, name), name);
    }
    await symlink(join(directory, 'original.jpg'), join(directory, `${linkHash}.body`));
    await mkdir(join(directory, `${directoryHash}.body`));
    assert.equal(await clearDownloadedPhotoBodies(directory), 1);
    assert.equal((await readdir(directory)).length, 7);
    assert.equal(await readFile(join(directory, `${hash}.avif`), 'utf8'), `${hash}.avif`);
    assert.equal(await readFile(join(directory, 'original.jpg'), 'utf8'), 'original.jpg');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
