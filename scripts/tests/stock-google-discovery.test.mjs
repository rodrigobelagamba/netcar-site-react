import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SITE, googleResult, inspectPublicHtml, loadGoogleAccess, nextInspectionAt, parseUiObservations,
  projectVehicles, requestText, robotsAllows, runStockDiscovery, writePrivateJson } from '../lib/stock-google-discovery.mjs';
import { assertPrivateStateDirectory, monitorStockGoogle } from '../monitor-stock-google.mjs';

const at = '2026-10-29T12:00:00.000Z';
const day = (n) => new Date(Date.parse(at) + n * 86400000).toISOString();
const stock = [{ id: 42, marca: 'FIAT', modelo: 'FASTBACK IMPETUS TURBO', ano: 2025, valor: 100000,
  imagens_site: { tem_fotos: true, capa: `${SITE}/imagens/veiculos/fastback.jpg` } }];
const vehicle = projectVehicles(stock)[0];
const html = (url = vehicle.url, photo = stock[0].imagens_site.capa) => `<html><head><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"><meta property="og:image" content="${photo}"><script type="application/ld+json">${JSON.stringify({ '@type': 'Car', image: photo })}</script></head><body><h1>Fiat Fastback</h1></body></html>`;
const sitemap = (rows = stock) => `<urlset>${projectVehicles(rows).map((v) => `<url><loc>${v.url}</loc></url>`).join('')}</urlset>`;
const payload = (verdict = 'PASS') => ({ inspectionResult: { indexStatusResult: { verdict, coverageState: verdict === 'PASS' ? 'Indexed' : 'Discovered - currently not indexed', lastCrawlTime: null } } });
const fake = ({ rows = stock, verdict = 'PASS', status = 200, calls = [] } = {}) => async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).endsWith('/sitemap.xml')) return new Response(sitemap(rows));
  if (String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /');
  if (String(url).includes('/urlInspection/')) return new Response(JSON.stringify(payload(verdict)), { status });
  return new Response(html(String(url)));
};

test('baseline is not an invented arrival date; later entries become new observations', async () => {
  const first = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake() });
  assert.equal(first.state.vehicles['42'].firstSeenIsBaseline, true);
  assert.equal(first.report.counts.unknown, 1);
  assert.equal(first.report.counts.indexed, 0);
  assert.equal(first.report.inspectionQueue.length, 1);
  const rows = [...stock, { ...stock[0], id: 43 }];
  const second = await runStockDiscovery({ previous: first.state, now: day(1), loadStock: async () => rows, fetchImpl: fake({ rows }) });
  assert.equal(second.state.vehicles['42'].firstSeenAt, at);
  assert.equal(second.state.vehicles['43'].firstSeenIsBaseline, false);
  assert.equal(second.state.vehicles['43'].firstSeenAt, day(1));
});

test('source without real photos is awaiting photos, not a technical SEO error', () => {
  const waiting = projectVehicles([{ ...stock[0], imagens_site: { tem_fotos: 0, capa: `${SITE}/imagens/banner/default.png` } }])[0];
  const check = inspectPublicHtml({ html: html(waiting.url, `${SITE}/imagens/banner/default.png`), status: 200,
    vehicle: waiting, inSitemap: true, robotsAllowed: true });
  assert.equal(check.imageStatus, 'awaiting_photos');
  assert.deepEqual(check.issues, []);
  const mismatch = inspectPublicHtml({ html: html(vehicle.url, `${SITE}/imagens/banner/default.png`), status: 200,
    vehicle, inSitemap: true, robotsAllowed: true });
  assert.ok(mismatch.issues.includes('wrong_or_missing_vehicle_image'));
  const semcapa = inspectPublicHtml({ html: html(vehicle.url, `${SITE}/images/semcapa.png`), status: 200,
    vehicle, inSitemap: true, robotsAllowed: true });
  assert.ok(semcapa.issues.includes('wrong_or_missing_vehicle_image'));
});

test('checks canonical, noindex response header, sitemap and robot restrictions independently', () => {
  const result = inspectPublicHtml({ html: html(`${SITE}/`), status: 200, headers: { 'x-robots-tag': 'googlebot: noindex' }, vehicle,
    inSitemap: false, robotsAllowed: false });
  assert.deepEqual(result.issues, ['missing_sitemap', 'robots_disallow', 'noindex', 'canonical_mismatch']);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /veiculo/\nAllow: /veiculo/fastback', vehicle.url), true);
  assert.equal(robotsAllows('User-agent: *\nAllow: /\nUser-agent: Googlebot\nDisallow: /veiculo/', vehicle.url), false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /api/', vehicle.url), true);
});

test('pending inspection schedule is 3, 7, 14 then weekly; unknown retries tomorrow', () => {
  const row = { firstSeenAt: at, google: { status: 'not_indexed' } };
  assert.equal(nextInspectionAt(row, at), day(3));
  assert.equal(nextInspectionAt(row, day(3)), day(7));
  assert.equal(nextInspectionAt(row, day(7)), day(14));
  assert.equal(nextInspectionAt(row, day(14)), day(21));
  assert.equal(nextInspectionAt({ ...row, google: { status: 'indexed' } }, day(4)), day(11));
  assert.equal(nextInspectionAt({ ...row, google: { status: 'unknown' } }, day(4)), day(5));
});

test('Google API receives only fixed property/public URL, with no redirects; reports contain no token', async () => {
  const calls = [];
  const first = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake({ calls }), access: { status: 'configured', token: 'secret-value' } });
  assert.equal(first.report.counts.indexed, 1);
  const googleCall = calls.find((c) => c.url.includes('/urlInspection/'));
  assert.equal(googleCall.options.redirect, 'error');
  assert.equal(googleCall.options.headers.Authorization, 'Bearer secret-value');
  assert.equal(JSON.parse(googleCall.options.body).siteUrl, 'sc-domain:netcarmultimarcas.com.br');
  assert.ok(!JSON.stringify(first).includes('secret-value'));
  const nextCalls = [];
  await runStockDiscovery({ previous: first.state, now: day(1), loadStock: async () => stock,
    fetchImpl: fake({ calls: nextCalls }), access: { status: 'configured', token: 'secret-value' } });
  assert.ok(!nextCalls.some((c) => c.url.includes('/urlInspection/')));
  assert.ok(nextCalls.some((c) => c.url === vehicle.url)); // public check still daily
});

test('auth error stops further API calls and explicitly records unknown', async () => {
  const rows = [...stock, { ...stock[0], id: 43 }]; const calls = [];
  const result = await runStockDiscovery({ now: at, loadStock: async () => rows, fetchImpl: fake({ rows, status: 401, calls }),
    access: { status: 'configured', token: 'secret' } });
  assert.equal(result.report.googleAccess, 'authentication_failed');
  assert.equal(result.report.counts.unknown, 2);
  assert.equal(calls.filter((c) => c.url.includes('/urlInspection/')).length, 1);
});

test('failed source does not mark vehicles sold or mutate previous state', async () => {
  const first = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake() });
  const saved = JSON.stringify(first.state);
  await assert.rejects(runStockDiscovery({ previous: first.state, now: day(1), loadStock: async () => { throw new Error('feed'); }, fetchImpl: fake() }));
  assert.equal(JSON.stringify(first.state), saved);
  assert.throws(() => projectVehicles([{ ...stock[0], valor: undefined }]), /invalid_stock_row/);
  assert.throws(() => projectVehicles([...stock, stock[0]]), /invalid_stock_row/);
});

test('repeated unchanged outcomes do not emit duplicate notifications', async () => {
  const first = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake(), access: { status: 'not_configured' } });
  const second = await runStockDiscovery({ previous: first.state, now: day(1), loadStock: async () => stock, fetchImpl: fake() });
  assert.equal(second.state.events.length, first.state.events.length);
  const third = await runStockDiscovery({ previous: second.state, now: day(2), loadStock: async () => stock, fetchImpl: fake(), access: { status: 'configured', token: 'token' } });
  assert.equal(third.state.events.filter((e) => e.type === 'vehicle_status' && e.googleStatus === 'indexed').length, 1);
});

test('UI observations are bounded, current URL scoped, and cannot replace a newer API observation', async () => {
  const first = await runStockDiscovery({ now: day(1), loadStock: async () => stock, fetchImpl: fake(), access: { status: 'configured', token: 'token' } });
  const ui = { schemaVersion: 1, source: 'gsc-ui', observations: [{ vehicleId: '42', url: vehicle.url, checkedAt: at, status: 'not_indexed' }] };
  const second = await runStockDiscovery({ previous: first.state, now: day(2), loadStock: async () => stock, fetchImpl: fake(), uiObservations: ui });
  assert.equal(second.state.vehicles['42'].google.source, 'gsc-api');
  assert.equal(second.state.vehicles['42'].google.status, 'indexed');
  const imported = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake(), uiObservations: ui });
  assert.equal(imported.state.vehicles['42'].google.source, 'gsc-ui');
  assert.equal(imported.report.counts.notIndexed, 1);
  assert.equal(parseUiObservations(ui, day(8)).size, 0);
  assert.throws(() => parseUiObservations({ ...ui, observations: [{ ...ui.observations[0], checkedAt: day(1) }] }, at), /future/);
  assert.throws(() => parseUiObservations({ ...ui, observations: [{ ...ui.observations[0], url: 'https://evil.test/42' }] }, at), /invalid/);
});

test('PASS is Google indexing evidence; unspecified verdict stays unknown', () => {
  assert.equal(googleResult(payload(), at).status, 'indexed');
  assert.equal(googleResult(payload('NEUTRAL'), at).status, 'not_indexed');
  assert.equal(googleResult(payload('VERDICT_UNSPECIFIED'), at).status, 'unknown');
});

test('real UI evidence supersedes a later missing-access placeholder but not newer API evidence', async () => {
  const first = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake() });
  const second = await runStockDiscovery({ previous: first.state, now: day(1), loadStock: async () => stock, fetchImpl: fake() });
  const observedAt = new Date(Date.parse(day(1)) - 60_000).toISOString();
  const ui = { schemaVersion: 1, source: 'gsc-ui', observations: [{ vehicleId: '42', url: vehicle.url, checkedAt: observedAt, status: 'not_indexed' }] };
  const imported = await runStockDiscovery({ previous: second.state, now: day(1), loadStock: async () => stock, fetchImpl: fake(), uiObservations: ui });
  assert.equal(imported.state.vehicles['42'].google.source, 'gsc-ui');
  assert.equal(imported.report.counts.notIndexed, 1);
  const historical = await runStockDiscovery({ previous: imported.state, now: day(4), loadStock: async () => stock, fetchImpl: fake(), uiObservations: ui });
  assert.equal(historical.state.vehicles['42'].google.status, 'unknown');
  assert.equal(historical.report.counts.notIndexed, 0);
  assert.equal(historical.report.inspectionQueue[0].lastKnownGoogle.checkedAt, observedAt);
  assert.equal(historical.report.inspectionQueue[0].lastKnownGoogle.status, 'not_indexed');
  const apiKnown = structuredClone(second.state);
  apiKnown.vehicles['42'].lastKnownGoogle = { source: 'gsc-api', status: 'indexed', checkedAt: day(1) };
  const rejected = await runStockDiscovery({ previous: apiKnown, now: day(1), loadStock: async () => stock, fetchImpl: fake(), uiObservations: ui });
  assert.equal(rejected.state.vehicles['42'].google.status, 'unknown');
  assert.equal(rejected.report.inspectionQueue[0].lastKnownGoogle.source, 'gsc-api');
});

test('private state rejects served roots, missing descendants and symlink aliases before mutation', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'seo-private-path-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const workspace = join(directory, 'workspace');
  mkdirSync(join(workspace, 'public'), { recursive: true, mode: 0o755 });
  mkdirSync(join(workspace, 'dist'), { mode: 0o755 });
  symlinkSync(join(workspace, 'public'), join(directory, 'public-alias'));
  symlinkSync(join(workspace, 'dist'), join(directory, 'dist-alias'));
  symlinkSync(workspace, join(directory, 'workspace-alias'));
  for (const destination of [workspace, join(workspace, 'public'), join(workspace, 'public', 'private'),
    join(workspace, 'dist'), join(workspace, 'dist', 'private'), join(directory, 'public-alias', 'missing', 'private'),
    join(directory, 'dist-alias', 'missing'), join(directory, 'workspace-alias', 'public', 'missing')]) {
    assert.throws(() => assertPrivateStateDirectory(destination, workspace), /private_state_directory_required/);
  }
  assert.equal(existsSync(join(workspace, 'public', 'private')), false);
  assert.equal(statSync(join(workspace, 'public')).mode & 0o777, 0o755);
  assert.equal(assertPrivateStateDirectory(join(workspace, '.devops', 'seo-discovery'), workspace), join(workspace, '.devops', 'seo-discovery'));
});

test('requests reject credential leakage, unexpected domains, and oversize responses', async () => {
  await assert.rejects(requestText(`${SITE}/`, { token: 'secret' }), /disallowed_destination/);
  await assert.rejects(requestText('https://evil.test/', {}), /disallowed_destination/);
  await assert.rejects(requestText(`${SITE}/`, { fetchImpl: async () => new Response('x', { headers: { 'Content-Length': '99999999' } }) }), /too_large/);
});

test('credential files require private permissions and only fixed OAuth endpoint is used', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gsc-creds-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'creds.json');
  writeFileSync(file, JSON.stringify({ client_id: 'id', client_secret: 'secret', refresh_token: 'refresh' }), { mode: 0o600 });
  const access = await loadGoogleAccess({ env: { NETCAR_GSC_CREDENTIALS_FILE: file }, fetchImpl: async (url, opts) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token'); assert.equal(opts.redirect, 'error');
    return new Response(JSON.stringify({ access_token: 'fresh' }));
  } });
  assert.equal(access.token, 'fresh');
  assert.deepEqual(await loadGoogleAccess({ env: {} }), { status: 'not_configured' });
});

test('private atomic files and failed run preserve last successful ledger', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'gsc-state-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = await runStockDiscovery({ now: at, loadStock: async () => stock, fetchImpl: fake() });
  writePrivateJson(join(dir, 'state.json'), result.state);
  assert.equal(statSync(join(dir, 'state.json')).mode & 0o777, 0o600);
  const before = readFileSync(join(dir, 'state.json'), 'utf8');
  await assert.rejects(monitorStockGoogle({ stateDir: dir, env: {}, now: day(1), run: async () => { throw new Error('a sensitive failure'); } }), /previous_state_preserved/);
  assert.equal(readFileSync(join(dir, 'state.json'), 'utf8'), before);
  const status = readFileSync(join(dir, 'run-status.json'), 'utf8');
  assert.ok(!status.includes('sensitive'));
  assert.equal(JSON.parse(status).status, 'failed');
});
