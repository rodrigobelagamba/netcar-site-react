#!/usr/bin/env node
/** Build-only AVIFs: higher-quality masters, bounded by the current WebP bytes.
 * A failed inventory read never replaces a valid manifest. Per-photo failures
 * fall back to the existing public img.php endpoint; originals are untouched. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { configureSeoStockNetwork, fetchCompleteSeoStock } from './lib/seo-stock-source.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.netcarmultimarcas.com.br';
const STOCK = '/imagens/veiculos_automacar/';
const CACHE = join(ROOT, '.cache/vehicle-photo-variants');
const OUTPUT = join(ROOT, 'public/images/vehicle-photo-variants');
const MANIFEST = join(ROOT, 'public/seo/vehicle-photo-variants.json');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const qualities = { hero: [70, 65, 60], gallery: [65, 60, 55] };
const widths = { hero: [480, 640, 768, 960, 1280], gallery: [320, 480, 640, 768, 960] };
const emptyManifest = () => ({ schemaVersion: 1, entries: {} });

async function json(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}
async function atomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

export function sourcePath(value) {
  try {
    const url = new URL(value, `${SITE}/`);
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== SITE || url.search || !path.startsWith(STOCK) ||
        path.includes('..') || /[\\\x00-\x1f%]/.test(path)) return null;
    return /\.(png|jpe?g|webp|avif)$/i.test(path) ? path : null;
  } catch { return null; }
}

export function photoJobs(vehicles) {
  const jobs = new Map();
  for (const vehicle of vehicles) {
    const id = String(vehicle.id);
    const cover = sourcePath(vehicle.imagens_site?.capa);
    if (cover && /\.png$/i.test(cover)) jobs.set(cover, { id, kind: 'hero', requested: cover, original: cover });
    for (const item of Array.isArray(vehicle.imagens_site?.galeria) ? vehicle.imagens_site.galeria : []) {
      const original = sourcePath(item);
      if (!original || !/\.avif$/i.test(original) || original.includes('/big/')) continue;
      const requested = original.replace(STOCK, `${STOCK}big/`).replace(/\.avif$/i, '.jpg');
      jobs.set(requested, { id, kind: 'gallery', requested, original });
    }
  }
  return [...jobs.values()];
}

/** Cache bodies by their actual SHA, never trust an unchanged URL as freshness. */
async function download(url, { conditional = true } = {}) {
  const key = sha(url), metaPath = join(CACHE, `${key}.json`);
  const previous = conditional ? await json(metaPath) : null;
  let cached;
  if (previous && /^[a-f0-9]{64}$/.test(previous.sha || '')) {
    try {
      cached = await readFile(join(CACHE, `${previous.sha}.body`));
      if (sha(cached) !== previous.sha) cached = null;
    } catch { cached = null; }
  }
  const headers = { Accept: 'image/webp,image/*;q=0.8', 'Cache-Control': 'no-cache' };
  if (cached && previous.etag) headers['If-None-Match'] = previous.etag;
  else if (cached && previous.modified) headers['If-Modified-Since'] = previous.modified;
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000), redirect: 'error' });
      if ((response.status >= 500 || response.status === 429 || response.status === 408) && attempt === 0) {
        await response.body?.cancel();
        const retrySeconds = Math.min(30, Math.max(1, Number(response.headers.get('retry-after')) || 1));
        await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000));
        continue;
      }
      break;
    } catch {
      if (attempt === 1) throw new Error('photo-network');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (response.status === 304 && cached) return { ...previous, data: cached };
  if (!response.ok) { await response.body?.cancel(); throw new Error(`photo-http-${response.status}`); }
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > 30 * 1024 * 1024) throw new Error('photo-size');
  const modified = response.headers.get('last-modified');
  const record = {
    sha: sha(data), bytes: data.length, modified,
    mtime: Math.floor(Date.parse(modified || '') / 1000) || 0,
    etag: response.headers.get('etag'),
  };
  await atomic(join(CACHE, `${record.sha}.body`), data);
  await atomic(metaPath, JSON.stringify(record));
  return { ...record, data };
}

async function original(path) {
  const record = await download(new URL(path, SITE).href);
  if (record.mtime <= 0) throw new Error('photo-mtime');
  const metadata = await sharp(record.data, { limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1 ||
      (metadata.orientation && metadata.orientation !== 1)) throw new Error('photo-format');
  return { ...record, metadata, path };
}

export function sameGeometry(left, right) {
  return left.width === right.width && left.height === right.height &&
    (!left.orientation || left.orientation === 1) && (!right.orientation || right.orientation === 1);
}

async function encode(source, width, quality) {
  const actualWidth = Math.min(width, source.metadata.width);
  const legacy = sha(JSON.stringify(['vehicle-photo-v1', sharp.versions, source.sha, width, quality]));
  const recipe = sha(JSON.stringify(['vehicle-photo-v2-effort4', sharp.versions, source.sha, actualWidth, quality]));
  const cacheFile = join(CACHE, `${recipe}.avif`);
  for (const cachedFile of [join(CACHE, `${legacy}.avif`), cacheFile]) {
    try {
      const data = await readFile(cachedFile);
      const meta = await json(`${cachedFile}.json`);
      if (meta?.sha === sha(data)) return { data, width: meta.width, height: meta.height };
    } catch { /* Generate an absent or invalid cache entry. */ }
  }
  const { data, info } = await sharp(source.data, { limitInputPixels: 40_000_000 })
    .resize({ width: actualWidth, withoutEnlargement: true, kernel: 'lanczos3' })
    .avif({ quality, effort: 4, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });
  await atomic(cacheFile, data);
  await atomic(`${cacheFile}.json`, JSON.stringify({ sha: sha(data), width: info.width, height: info.height }));
  return { data, width: info.width, height: info.height };
}

async function variants(job) {
  const requested = await original(job.requested);
  let source = job.original === job.requested ? requested : await original(job.original);
  if (job.kind === 'gallery') {
    try {
      const jpeg = await original(job.original.replace(/\.avif$/i, '.jpg'));
      if (sameGeometry(jpeg.metadata, source.metadata)) source = jpeg;
    } catch { /* The observed AVIF remains the source if its JPEG sibling is absent. */ }
  }
  const entries = {};
  let budgetsRead = 0, encoded = 0;
  for (const width of widths[job.kind]) {
    try {
      const proxy = new URL('/img.php', SITE);
      proxy.searchParams.set('src', new URL(job.requested, SITE).pathname);
      proxy.searchParams.set('w', String(width));
      // img.php budget must remain WebP even after the AVIF feature is deployed.
      const baseline = await download(proxy.href);
      const baselineMeta = await sharp(baseline.data).metadata();
      if (baselineMeta.format !== 'webp') continue;
      budgetsRead++;
      for (const quality of qualities[job.kind]) {
        const candidate = await encode(source, width, quality);
        encoded++;
        if (candidate.data.length > baseline.bytes) continue;
        const name = `${sha(candidate.data)}.avif`;
        await atomic(join(OUTPUT, name), candidate.data);
        entries[String(width)] = {
          file: `/images/vehicle-photo-variants/${name}`,
          sourcePath: source.path, sourceMtime: source.mtime, sourceBytes: source.bytes,
          requestedSourceMtime: requested.mtime, requestedSourceBytes: requested.bytes,
          width: candidate.width, height: candidate.height,
          bytes: candidate.data.length, budgetBytes: baseline.bytes,
        };
        break;
      }
    } catch { /* A single unsupported width keeps the existing image fallback. */ }
  }
  if (!budgetsRead || !encoded) throw new Error('photo-no-valid-encodes');
  return entries;
}

async function inventory() {
  const photos = new Map();
  const accepted = await fetchCompleteSeoStock({ rootDir: ROOT, fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    if (response.ok) {
      const payload = await response.clone().json();
      for (const row of payload.data || []) photos.set(String(row.id), {
        id: row.id, imagens_site: { capa: row.imagens_site?.capa, galeria: row.imagens_site?.galeria },
      });
    }
    return response;
  } });
  return accepted.vehicles.filter((row) => Number(row.valor) > 0).map((row) => photos.get(String(row.id)));
}

export async function main(args = process.argv.slice(2)) {
  const vehicle = args.find((arg) => arg.startsWith('--vehicle='))?.slice(10);
  const limitText = args.find((arg) => arg.startsWith('--limit='))?.slice(8);
  if (args.some((arg) => !/^--(vehicle|limit)=\d+$/.test(arg)) ||
      (limitText !== undefined && Number(limitText) < 1)) throw new Error('photo-arguments');
  configureSeoStockNetwork();
  sharp.concurrency(1);
  await mkdir(CACHE, { recursive: true });
  let vehicles = await inventory();
  if (vehicle) vehicles = vehicles.filter((row) => String(row.id) === vehicle);
  if (limitText) vehicles = vehicles.slice(0, Number(limitText));
  if (!vehicles.length) throw new Error('photo-empty-selection');
  const jobs = photoJobs(vehicles), previous = await json(MANIFEST, emptyManifest());
  if (!jobs.length) throw new Error('photo-no-sources');
  if (previous.schemaVersion !== 1 || !previous.entries || typeof previous.entries !== 'object') throw new Error('photo-invalid-manifest');
  const entries = vehicle || limitText ? { ...previous.entries } : {};
  let index = 0, processed = 0, failed = 0;
  const failureReasons = {};
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      delete entries[job.requested];
      try {
        const result = await variants(job);
        processed++;
        if (Object.keys(result).length) entries[job.requested] = result;
      } catch (error) {
        failed++;
        const reason = /^photo-[a-z0-9-]+$/.test(error?.message || '') ? error.message : 'photo-processing';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
    }
  }));
  if (jobs.length && !processed) throw new Error('photo-all-sources-failed');
  const count = Object.values(entries).reduce((sum, row) => sum + Object.keys(row).length, 0);
  // Clear records for processed photos that no longer have a valid variant.
  // Keeping an old shard here would bypass the newly measured byte budget.
  const requestedPaths = new Set([...Object.keys(entries), ...jobs.map((job) => job.requested)]);
  for (const requested of requestedPaths) {
    const row = entries[requested] || {};
    await atomic(join(ROOT, 'public/seo/vehicle-photo-variants', `${sha(requested)}.json`),
      JSON.stringify({ schemaVersion: 1, entries: { [requested]: row } }));
  }
  await atomic(MANIFEST, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), entries }, null, 2)}\n`);
  console.log(`Vehicle photos: ${vehicles.length} vehicles, ${processed} photos, ${failed} skipped, ${count} variants.`);
  if (failed) console.log(`Vehicle photo skips: ${JSON.stringify(failureReasons)}`);
  return { vehicles: vehicles.length, processed, failed, count };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Vehicle photos: generation failed; previous manifest preserved.'); process.exitCode = 1; });
}
