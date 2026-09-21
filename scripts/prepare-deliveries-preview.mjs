import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Read-only import of a bounded sample from Netcar's existing public archive.
// Images remain on Netcar's server; this script never downloads their bodies.
const site = 'https://www.netcarmultimarcas.com.br/';
const endpoint = new URL('api/v1/depoimentos.php', site);
const output = fileURLToPath(new URL('../src/modules/entregas/data/deliveries-preview.json', import.meta.url));

async function readPage(offset, limit) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ action: 'list', offset: String(offset), limit: String(limit) }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Archive returned ${response.status}`);
  const body = await response.json();
  if (!body.success || !Array.isArray(body.data)) throw new Error('Unexpected archive response');
  return body;
}

function cleanText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  const name = cleanText(value);
  const folded = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Some recent archive entries use a month as the name. Do not pretend these
  // are customer names or infer an identity from a photograph/filename.
  const monthLabel = /^(?:jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)(?:\s*\/?\s*\d{2,4})?$/;
  return monthLabel.test(folded) || /^\d+$/.test(folded) ? '' : name;
}

function parseArchiveDate(value) {
  const raw = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? raw : null;
}

function normalizeRecord(record) {
  if (!record.imagem_link || !record.imagem) return null;
  const imageUrl = new URL(record.imagem_link, site);
  if (imageUrl.origin !== new URL(site).origin || !/\.(?:jpe?g|png|webp)$/i.test(imageUrl.pathname)) return null;
  const date = parseArchiveDate(record.data);
  return {
    id: String(record.id),
    name: normalizeName(record.nome),
    imageUrl: imageUrl.href,
    date,
    year: date?.slice(0, 4) ?? null,
    month: date?.slice(5, 7) ?? null,
  };
}

const overview = await readPage(0, 1);
const total = Number(overview.total_results);
if (!Number.isInteger(total) || total < 1) throw new Error('Missing archive count');
const requestedPages = [
  { offset: Math.max(0, total - 96), limit: 96 },
  { offset: Math.min(1600, Math.max(0, total - 96)), limit: 96 },
  { offset: Math.min(1000, Math.max(0, total - 24)), limit: 24 },
  { offset: Math.min(500, Math.max(0, total - 24)), limit: 24 },
];
const pages = await Promise.all(requestedPages.map(({ offset, limit }) => readPage(offset, limit)));
const seenIds = new Set();
const seenImages = new Set();
let deliveries = pages.flatMap(page => page.data).map(normalizeRecord).filter(record => {
  if (!record || seenIds.has(record.id) || seenImages.has(record.imageUrl)) return false;
  seenIds.add(record.id);
  seenImages.add(record.imageUrl);
  return true;
});

let unavailableImages = 0;
if (process.argv.includes('--check-images')) {
  const queue = [...deliveries];
  const validIds = new Set();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const delivery = queue.shift();
      try {
        const response = await fetch(delivery.imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) validIds.add(delivery.id);
      } catch { /* A failed image is excluded from this preview only. */ }
    }
  }));
  unavailableImages = deliveries.length - validIds.size;
  deliveries = deliveries.filter(delivery => validIds.has(delivery.id));
}

deliveries.sort((a, b) => (b.date || '').localeCompare(a.date || '') || Number(b.id) - Number(a.id));
const dates = deliveries.map(delivery => delivery.date).filter(Boolean).sort();
const snapshot = {
  metadata: {
    capturedAt: new Date().toISOString(),
    source: `${endpoint.href}?action=list`,
    totalArchiveRecords: total,
    snapshotCount: deliveries.length,
    namedCount: deliveries.filter(delivery => delivery.name).length,
    oldestDate: dates[0] || null,
    newestDate: dates.at(-1) || null,
    dateMeaning: 'archive-record-date',
    sampleOnly: true,
    imageAvailabilityChecked: process.argv.includes('--check-images'),
    unavailableImages,
    pages: requestedPages,
  },
  deliveries,
};
await mkdir(new URL('../src/modules/entregas/data/', import.meta.url), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify(snapshot.metadata, null, 2));
