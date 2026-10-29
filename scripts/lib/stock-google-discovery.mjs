import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fetchCompleteSeoStock } from './seo-stock-source.js';
import { generateVehicleSlug } from './vehicle-sitemap-urls.js';

export const SITE = 'https://www.netcarmultimarcas.com.br';
export const PROPERTY = 'sc-domain:netcarmultimarcas.com.br';
const DAY = 86_400_000;
const MAX_BYTES = 8 * 1024 * 1024;
const AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const instant = (value) => { if (!Number.isFinite(Date.parse(value))) throw new Error('invalid_timestamp'); return value; };
const decode = (value = '') => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const genericImage = (url) => /(?:\/banner\/|placeholder|sem[-_]?(?:foto|capa)|logo|default[-_]?car|no[-_]?image)/i.test(url || '');

export function emptyDiscoveryState(at) {
  return { schemaVersion: 1, baselineAt: instant(at), lastSuccessfulRunAt: null, vehicles: {}, events: [], accessSignature: null };
}

export function validateDiscoveryState(state) {
  if (state?.schemaVersion !== 1 || !state.vehicles || Array.isArray(state.vehicles) || !Array.isArray(state.events)) throw new Error('invalid_discovery_state');
  instant(state.baselineAt);
  if (state.lastSuccessfulRunAt) instant(state.lastSuccessfulRunAt);
  for (const [id, row] of Object.entries(state.vehicles)) {
    if (!/^\d+$/.test(id) || row.id !== id || !isVehicleUrl(row.url)) throw new Error('invalid_discovery_vehicle');
    instant(row.firstSeenAt);
    instant(row.lastSeenAt);
    if (row.nextCheckAt) instant(row.nextCheckAt);
  }
  return state;
}

export function isVehicleUrl(url) {
  try { const u = new URL(url); return u.origin === SITE && /^\/veiculo\/[a-z0-9-]+-\d+$/.test(u.pathname) && !u.search && !u.hash; } catch { return false; }
}

export function projectVehicles(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new Error('invalid_stock_size');
  const seen = new Set();
  const active = [];
  for (const row of rows) {
    const id = String(row?.id ?? '');
    if (!/^\d+$/.test(id) || seen.has(id) || !Number.isFinite(Number(row.valor)) || Number(row.valor) < 0) throw new Error('invalid_stock_row');
    seen.add(id);
    if (Number(row.valor) === 0) continue;
    const url = `${SITE}/veiculo/${generateVehicleSlug(row)}`;
    if (!isVehicleUrl(url) || !row.modelo) throw new Error('invalid_vehicle_url');
    const images = [row.imagens_site?.capa_opengraph, row.imagens_site?.capa, ...(row.imagens?.thumb || [])]
      .filter((x) => typeof x === 'string' && x.trim()).map((x) => new URL(x, SITE).href);
    const photos = [false, 0, '0'].includes(row.imagens_site?.tem_fotos) ? [] : images.filter((x) => !genericImage(x));
    active.push({ id, url, name: `${row.marca || ''} ${row.modelo} ${row.ano || ''}`.trim(), photoUrls: photos });
  }
  if (!active.length) throw new Error('empty_active_stock');
  return active;
}

export function sitemapVehicleUrls(xml) {
  if (!/<urlset\b/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('invalid_sitemap');
  const urls = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map((m) => decode(m[1].trim()));
  if (!urls.length || urls.some((url) => { try { return new URL(url).origin !== SITE; } catch { return true; } })) throw new Error('invalid_sitemap_urls');
  return new Set(urls.filter(isVehicleUrl));
}

/** Googlebot or wildcard groups, longest rule wins; allow wins equal length. */
export function robotsAllows(text, url) {
  const groups = [];
  let group = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const match = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase(), value = match[2].trim();
    if (key === 'user-agent') {
      if (!group || group.rules.length) { group = { agents: [], rules: [] }; groups.push(group); }
      group.agents.push(value.toLowerCase());
    } else if (group && value) group.rules.push({ allow: key === 'allow', value });
  }
  const exact = groups.filter((g) => g.agents.includes('googlebot'));
  const applicable = exact.length ? exact : groups.filter((g) => g.agents.includes('*'));
  const pathname = new URL(url).pathname + new URL(url).search;
  const rules = applicable.flatMap((g) => g.rules).filter((rule) => {
    const escaped = rule.value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    return new RegExp(`^${escaped}`).test(pathname);
  }).sort((a, b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}

function attributes(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3]);
  return out;
}

export function inspectPublicHtml({ html, status, headers = {}, vehicle, inSitemap, robotsAllowed }) {
  const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/gi)].map((m) => attributes(m[0]));
  const canonical = tags.find((t) => t.rel?.toLowerCase() === 'canonical')?.href || null;
  const metas = tags.filter((t) => /^(robots|googlebot)$/i.test(t.name || '')).map((t) => t.content || '').join(',');
  const robots = `${metas},${headers['x-robots-tag'] || ''}`;
  const og = tags.find((t) => t.property === 'og:image')?.content || null;
  let car = null;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node['@type'] === 'Car' || (Array.isArray(node['@type']) && node['@type'].includes('Car'))) car = node;
    for (const value of Object.values(node)) if (value && typeof value === 'object') Array.isArray(value) ? value.forEach(visit) : visit(value);
  };
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(m[1])); } catch { /* malformed JSON is reported as missing Car */ }
  }
  const images = (Array.isArray(car?.image) ? car.image : [car?.image]).map((x) => typeof x === 'string' ? x : x?.url).filter(Boolean);
  const imageStatus = !vehicle.photoUrls.length ? 'awaiting_photos' :
    (og && images.length && [og, ...images].every((x) => !genericImage(x)) ? 'vehicle_image_present' : 'wrong_or_missing_vehicle_image');
  const issues = [];
  if (status !== 200) issues.push(`http_${status}`);
  if (!inSitemap) issues.push('missing_sitemap');
  if (!robotsAllowed) issues.push('robots_disallow');
  if (/(?:^|[:,\s])(?:noindex|none)(?:[,\s]|$)/i.test(robots)) issues.push('noindex');
  if (canonical !== vehicle.url) issues.push('canonical_mismatch');
  if (!/<h1\b[^>]*>\s*\S/i.test(html) || !car) issues.push('missing_vehicle_content');
  if (imageStatus === 'wrong_or_missing_vehicle_image') issues.push(imageStatus);
  return { checkedAt: null, status, inSitemap, canonical, robotsAllowed, noindex: issues.includes('noindex'),
    carSchemaPresent: !!car, imageStatus, ogImage: og, carImages: images.slice(0, 3), issues };
}

export function googleResult(payload, at) {
  const result = payload?.inspectionResult?.indexStatusResult;
  if (!result || typeof result.verdict !== 'string') throw new Error('invalid_google_result');
  return { source: 'gsc-api', status: result.verdict === 'PASS' ? 'indexed' : ['NEUTRAL', 'FAIL'].includes(result.verdict) ? 'not_indexed' : 'unknown',
    checkedAt: at, verdict: result.verdict, coverageState: result.coverageState || null,
    lastCrawlTime: result.lastCrawlTime || null, googleCanonical: result.googleCanonical || null,
    userCanonical: result.userCanonical || null, indexingState: result.indexingState || null,
    robotsTxtState: result.robotsTxtState || null, pageFetchState: result.pageFetchState || null };
}

export function parseUiObservations(input, at) {
  if (input == null) return new Map();
  if (input.schemaVersion !== 1 || input.source !== 'gsc-ui' || !Array.isArray(input.observations) || input.observations.length > 500) throw new Error('invalid_ui_observations');
  const map = new Map();
  for (const observation of input.observations) {
    const id = String(observation.vehicleId ?? '');
    if (!/^\d+$/.test(id) || !isVehicleUrl(observation.url) || !observation.url.endsWith(`-${id}`) || map.has(id) ||
      !['indexed', 'not_indexed', 'unknown'].includes(observation.status)) throw new Error('invalid_ui_observation');
    const timestamp = Date.parse(instant(observation.checkedAt));
    if (timestamp > Date.parse(at) + 5 * 60_000) throw new Error('future_ui_observation');
    if (Date.parse(at) - timestamp > 7 * DAY) continue;
    const safe = { source: 'gsc-ui', status: observation.status, checkedAt: observation.checkedAt };
    for (const key of ['coverageState', 'lastCrawlTime', 'googleCanonical', 'userCanonical', 'indexingState', 'robotsTxtState', 'pageFetchState']) {
      if (observation[key] == null) safe[key] = null;
      else if (typeof observation[key] === 'string' && observation[key].length <= 500) safe[key] = observation[key];
      else throw new Error('invalid_ui_observation_field');
    }
    map.set(id, { url: observation.url, google: safe });
  }
  return map;
}

export function nextInspectionAt(row, now) {
  const at = Date.parse(now), first = Date.parse(row.firstSeenAt);
  if (!row.google || row.google.status === 'unknown' || row.google.error) return new Date(at + DAY).toISOString();
  if (row.google.status === 'indexed') return new Date(at + 7 * DAY).toISOString();
  for (const day of [3, 7, 14]) if (first + day * DAY > at) return new Date(first + day * DAY).toISOString();
  return new Date(at + 7 * DAY).toISOString();
}

function pendingBand(row, at) {
  if (row.google?.status !== 'not_indexed') return null;
  const days = Math.floor((Date.parse(at) - Date.parse(row.firstSeenAt)) / DAY);
  return days >= 14 ? 14 : days >= 7 ? 7 : days >= 3 ? 3 : 0;
}

function latestGoogleEvidence(row) {
  return [row.google, row.lastKnownGoogle]
    .filter((result) => result && ['gsc-api', 'gsc-ui'].includes(result.source) && !result.error && Number.isFinite(Date.parse(result.checkedAt)))
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0] || null;
}

function emit(state, key, value, at) {
  const signature = digest(value);
  const target = key === 'google_access' ? state : state.vehicles[key];
  const field = key === 'google_access' ? 'accessSignature' : 'lastEmittedSignature';
  if (target[field] === signature) return;
  target[field] = signature;
  state.events.push({ id: digest({ key, value, at }), key, at, ...value });
  state.events = state.events.slice(-1000);
}

async function boundedResponse(response) {
  if (Number(response.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('response_too_large');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('response_too_large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString('utf8');
}

export async function requestText(url, { fetchImpl = fetch, token, method = 'GET', body, headers = {} } = {}) {
  const parsed = new URL(url);
  const google = ['https://oauth2.googleapis.com', 'https://searchconsole.googleapis.com'].includes(parsed.origin);
  if (parsed.username || parsed.password || (parsed.origin !== SITE && !google) || (token && !google)) throw new Error('disallowed_destination');
  const response = await fetchImpl(url, { method, body, redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const text = await boundedResponse(response);
  return { status: response.status, text, headers: { 'x-robots-tag': response.headers.get('x-robots-tag') || '' } };
}

/** No scope grants, browser-cookie access or credentials in reports. */
export async function loadGoogleAccess({ env = process.env, fetchImpl = fetch } = {}) {
  if (env.NETCAR_GSC_ACCESS_TOKEN) return { status: 'configured', token: env.NETCAR_GSC_ACCESS_TOKEN };
  const file = env.NETCAR_GSC_CREDENTIALS_FILE;
  if (!file) return { status: 'not_configured' };
  try {
    if (!isAbsolute(file)) throw new Error('invalid_private_file');
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32_768 || (stat.mode & 0o077)) throw new Error('invalid_private_file');
    const credentials = JSON.parse(readFileSync(file, 'utf8'));
    if (credentials.access_token && typeof credentials.access_token === 'string') return { status: 'configured', token: credentials.access_token };
    if (![credentials.client_id, credentials.client_secret, credentials.refresh_token].every((x) => typeof x === 'string' && x)) throw new Error('invalid_private_file');
    const response = await requestText('https://oauth2.googleapis.com/token', { fetchImpl, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: credentials.client_id, client_secret: credentials.client_secret,
        refresh_token: credentials.refresh_token, grant_type: 'refresh_token' }).toString() });
    if (response.status !== 200) return { status: 'authentication_failed' };
    const payload = JSON.parse(response.text);
    return typeof payload.access_token === 'string' ? { status: 'configured', token: payload.access_token } : { status: 'authentication_failed' };
  } catch { return { status: 'authentication_failed' }; }
}

export async function runStockDiscovery({ previous, now = new Date().toISOString(), rootDir, fetchImpl = fetch,
  loadStock, access = { status: 'not_configured' }, force = false, uiObservations } = {}) {
  instant(now);
  const state = previous ? structuredClone(validateDiscoveryState(previous)) : emptyDiscoveryState(now);
  const observations = parseUiObservations(uiObservations, now);
  if (state.lastSuccessfulRunAt && Date.parse(now) < Date.parse(state.lastSuccessfulRunAt)) throw new Error('clock_went_backwards');
  const stock = projectVehicles(loadStock ? await loadStock() :
    (await fetchCompleteSeoStock({ rootDir, apiUrl: `${SITE}/api/v1/veiculos.php?limit=500`,
      fetchImpl: (url, opts) => fetchImpl(url, { ...opts, redirect: 'error' }) })).vehicles);
  const [sitemapResponse, robotsResponse] = await Promise.all([
    requestText(`${SITE}/sitemap.xml`, { fetchImpl }), requestText(`${SITE}/robots.txt`, { fetchImpl }),
  ]);
  if (sitemapResponse.status !== 200 || robotsResponse.status !== 200) throw new Error('discovery_sources_unavailable');
  const sitemap = sitemapVehicleUrls(sitemapResponse.text);
  const activeIds = new Set(stock.map((v) => v.id));
  // Absence in a verified full snapshot means unavailable, not proof of sale.
  for (const row of Object.values(state.vehicles)) if (!activeIds.has(row.id)) row.active = false;
  let checks = 0, googleChecks = 0, accessStatus = access.status;
  const deadline = Date.now() + 5 * 60_000;
  const initial = !state.lastSuccessfulRunAt;
  for (const vehicle of stock) {
    if (Date.now() >= deadline) throw new Error('discovery_deadline_exceeded');
    const prior = state.vehicles[vehicle.id];
    const changedUrl = prior && prior.url !== vehicle.url;
    const row = prior || { id: vehicle.id, firstSeenAt: now, firstSeenIsBaseline: initial, lastEmittedSignature: null };
    const revived = prior?.active === false;
    if (changedUrl) { row.previousUrl = row.url; row.google = null; row.lastKnownGoogle = null; row.nextCheckAt = null; }
    Object.assign(row, { url: vehicle.url, name: vehicle.name, active: true, lastSeenAt: now });
    state.vehicles[vehicle.id] = row;
    const observation = observations.get(vehicle.id);
    const latestEvidence = latestGoogleEvidence(row);
    if (observation?.url === vehicle.url && (!latestEvidence || Date.parse(observation.google.checkedAt) > Date.parse(latestEvidence.checkedAt))) {
      row.google = observation.google;
      row.nextCheckAt = nextInspectionAt(row, observation.google.checkedAt);
    }
    const inspectDue = force || changedUrl || revived || !row.nextCheckAt || Date.parse(row.nextCheckAt) <= Date.parse(now);
    checks++;
    try {
      const response = await requestText(vehicle.url, { fetchImpl, headers: { 'User-Agent': AGENT } });
      row.public = { ...inspectPublicHtml({ html: response.text, status: response.status, headers: response.headers,
        vehicle, inSitemap: sitemap.has(vehicle.url), robotsAllowed: robotsAllows(robotsResponse.text, vehicle.url) }), checkedAt: now };
    } catch { row.public = { checkedAt: now, issues: ['public_check_unavailable'], imageStatus: 'unknown' }; }
    if (inspectDue && access.token && accessStatus === 'configured') {
      try {
        googleChecks++;
        const result = await requestText('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
          fetchImpl, token: access.token, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectionUrl: vehicle.url, siteUrl: PROPERTY, languageCode: 'pt-BR' }),
        });
        if (result.status === 401 || result.status === 403) { accessStatus = 'authentication_failed'; throw new Error('authentication_failed'); }
        if (result.status === 429) { accessStatus = 'quota_exceeded'; throw new Error('quota_exceeded'); }
        if (result.status !== 200) throw new Error('inspection_unavailable');
        row.google = googleResult(JSON.parse(result.text), now);
      } catch { row.lastKnownGoogle = row.google?.status && row.google.status !== 'unknown' ? row.google : row.lastKnownGoogle;
        row.google = { status: 'unknown', checkedAt: now, error: 'inspection_unavailable' }; }
    } else if (inspectDue && !(row.google?.source === 'gsc-ui' && Date.parse(now) - Date.parse(row.google.checkedAt) < DAY)) {
      row.lastKnownGoogle = row.google?.status && row.google.status !== 'unknown' ? row.google : row.lastKnownGoogle;
      row.google = { status: 'unknown', checkedAt: now, error: accessStatus };
    }
    if (inspectDue) row.nextCheckAt = nextInspectionAt(row, now);
    const value = { type: 'vehicle_status', vehicleId: vehicle.id, url: row.url, publicIssues: row.public.issues,
      imageStatus: row.public.imageStatus, googleStatus: row.google.status, pendingBandDays: pendingBand(row, now) };
    // The initial clean snapshot isn't 66 alerts. Baseline problems are useful.
    if (!initial || value.publicIssues.length || (value.pendingBandDays ?? 0) > 0) emit(state, vehicle.id, value, now);
    else row.lastEmittedSignature = digest(value);
  }
  emit(state, 'google_access', { type: 'google_access', status: accessStatus }, now);
  state.lastSuccessfulRunAt = now;
  const active = Object.values(state.vehicles).filter((v) => v.active);
  const report = { schemaVersion: 1, generatedAt: now, status: accessStatus === 'configured' ? 'checked' : 'google_access_required',
    googleAccess: accessStatus, counts: { active: active.length, checked: checks, googleInspections: googleChecks,
      indexed: active.filter((v) => v.google?.status === 'indexed').length,
      notIndexed: active.filter((v) => v.google?.status === 'not_indexed').length,
      unknown: active.filter((v) => !v.google || v.google.status === 'unknown').length,
      withPublicIssues: active.filter((v) => v.public?.issues?.length).length,
      awaitingPhotos: active.filter((v) => v.public?.imageStatus === 'awaiting_photos').length },
    vehicles: active, events: state.events,
    inspectionQueue: active.filter((v) => v.google?.status === 'unknown' || !v.nextCheckAt || Date.parse(v.nextCheckAt) <= Date.parse(now))
      .map((v) => ({ vehicleId: v.id, url: v.url, name: v.name, firstSeenAt: v.firstSeenAt,
        firstSeenIsBaseline: v.firstSeenIsBaseline, lastInspectionAt: v.google?.checkedAt || null,
        lastKnownGoogle: latestGoogleEvidence(v) })),
    limits: ['Primeira observação não é data de entrada histórica.', 'Teste HTTP e sitemap não comprovam indexação.',
      'Status Google reflete a consulta datada da versão indexada; não é teste ao vivo.',
      'Nenhuma solicitação de indexação, alteração de estoque ou publicação é executada.',
      'Eventos são resultados locais para o monitor consumir; não são mensagens enviadas.'] };
  return { state, report };
}

export function writePrivateJson(file, value) {
  const data = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(data) > MAX_BYTES) throw new Error('discovery_state_too_large');
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  chmodSync(dirname(file), 0o700);
  const temp = join(dirname(file), `.${randomUUID()}.tmp`);
  try { writeFileSync(temp, data, { mode: 0o600, flag: 'wx' }); renameSync(temp, file); }
  finally { try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}

export function readDiscoveryState(file) {
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw new Error('invalid_discovery_state');
    return validateDiscoveryState(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('invalid_discovery_state'); }
}
