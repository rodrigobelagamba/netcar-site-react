import { createRequire } from 'node:module';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const requireDevops = createRequire(new URL('../../devops/package.json', import.meta.url));
const PUBLIC_ORIGIN = 'https://www.netcarmultimarcas.com.br';
const PUBLIC_HOSTS = new Set(['www.netcarmultimarcas.com.br', 'netcarmultimarcas.com.br']);
const BLOCKED_TYPES = new Set(['image', 'font', 'media', 'websocket', 'eventsource']);
const VEHICLE_TIMEOUT_MS = 60_000;

/** The anonymous audit browser cannot contact other sites or submit requests. */
export function isAllowedPublicEquipmentRequest({ url, method, resourceType }) {
  if (!['GET', 'HEAD'].includes(method) || BLOCKED_TYPES.has(resourceType)) return false;
  let parsed;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol === 'data:') return resourceType === 'stylesheet';
  if (parsed.protocol !== 'https:' || !PUBLIC_HOSTS.has(parsed.hostname) || parsed.port || parsed.username || parsed.password) return false;
  if (/(?:analytics|telemetry|tracking|pixel|collect)(?:[/.?_-]|$)/i.test(parsed.pathname)) return false;
  return /^\/(?:assets\/|api\/v1\/|seo\/|veiculo\/)/.test(parsed.pathname);
}

/** Do not inherit the service's tokens, SSH settings, or real home directory. */
export function buildPublicEquipmentBrowserEnv(privateDir, source = process.env) {
  return {
    PATH: source.PATH || '/usr/local/bin:/usr/bin:/bin',
    HOME: privateDir,
    TMPDIR: privateDir,
    LANG: source.LANG || 'C.UTF-8',
    TZ: source.TZ || 'America/Sao_Paulo',
  };
}

function safeError(category, vehicleId) {
  const error = new Error(`public-equipment:${category}${vehicleId ? `:vehicle-${vehicleId}` : ''}`);
  error.code = category;
  return error;
}

const remaining = (deadline) => Math.max(1, deadline - Date.now());

// Exported so the Chromium smoke test exercises the same DOM extraction as the audit.
export function readRenderedEquipment() {
  const visible = (node) => Boolean(node && node.getClientRects().length && !node.closest('[hidden]'));
  const headings = [...document.querySelectorAll('h2,h3')];
  const description = headings.find((node) => node.textContent.trim() === 'Descrição do veículo')?.closest('section');
  const otherHeading = headings.find((node) => node.textContent.trim() === 'Outros equipamentos');
  const others = otherHeading?.parentElement?.parentElement?.parentElement;
  const hero = document.getElementById('vehicle-differentials-title')?.closest('section');
  const editorial = Boolean(document.querySelector('[data-equipment-presentation="editorial"]'));
  const cards = [...(hero?.querySelectorAll('article') || [])].filter(visible);
  const highlights = cards.map((card) => ({
    name: card.querySelector('h4')?.innerText.trim() || '',
    category: card.querySelector('p')?.textContent.trim() || '',
    benefit: (card.querySelector('[data-equipment-benefit]') || card.querySelector('p:last-child'))?.innerText.trim() || '',
  }));
  const highlightedNames = cards.flatMap((card) => {
    const labels = [...card.querySelectorAll('[data-equipment-label]')];
    // Editorial titles describe benefits; each visible canonical label is a fact.
    // Preserve duplicates for the comparator to report, including across sections.
    if (labels.length) return labels.filter(visible).map((node) => node.innerText.trim()).filter(Boolean);
    return [card.querySelector('h4')?.innerText.trim() || ''].filter(Boolean);
  });
  const otherNames = [...(others?.querySelectorAll('span') || [])].filter(visible).map((node) => node.innerText.trim()).filter(Boolean);
  const equipmentNames = [...highlightedNames, ...otherNames];
  const descriptionExpanded = description?.querySelector('button')?.getAttribute('aria-expanded') === 'true';
  const otherButton = others?.querySelector('button');
  const othersExpanded = !otherButton || otherButton.getAttribute('aria-expanded') === 'true';
  const descriptionItems = description
    ? [...description.querySelectorAll('h4')].filter((node) => node.innerText.trim() !== 'Dados do veículo')
      .flatMap((node) => [...node.parentElement.querySelectorAll('li')].filter(visible).map((item) => item.innerText.trim()))
    : [];
  const descriptionText = descriptionExpanded || (editorial && description) ? description.innerText.trim() : '';
  const servedAssets = [...new Set([
    ...[...document.scripts].map((node) => node.getAttribute('src')),
    ...[...document.querySelectorAll('link[rel="modulepreload"]')].map((node) => node.getAttribute('href')),
  ].filter((value) => /^\/assets\/[\w.-]+\.(?:js|css)$/.test(value || '')))];
  return {
    ready: Boolean((editorial || (descriptionText && descriptionExpanded)) && othersExpanded && (editorial || equipmentNames.length)),
    presentation: editorial ? 'editorial' : 'legacy',
    descriptionText, equipmentNames, highlights, servedAssets,
    // Compare the two rendered sections only to detect an intermediate React render.
    matchingRenderedCounts: editorial || equipmentNames.length === descriptionItems.length,
  };
}

async function expandVisibleSections(page) {
  return page.evaluate(() => {
    const descriptionHeading = [...document.querySelectorAll('h3')]
      .find((node) => node.textContent.trim() === 'Descrição do veículo');
    const buttons = [...document.querySelectorAll('button')];
    for (const button of buttons) {
      const text = button.textContent.trim();
      if (text === 'Ler mais' || /^Ver todos os \d+ equipamentos$/.test(text)) button.click();
    }
    if (descriptionHeading) descriptionHeading.scrollIntoView({ block: 'center' });
    else window.scrollBy(0, Math.max(400, window.innerHeight * 0.75));
  });
}

async function readStablePage(page, deadline, detailLoaded) {
  let signature = '';
  let stableSince = 0;
  let lastObservation;
  while (Date.now() < deadline) {
    await expandVisibleSections(page);
    const observed = await page.evaluate(readRenderedEquipment);
    const next = JSON.stringify(observed);
    if (detailLoaded() && observed.ready) {
      if (next === signature) {
        if (Date.now() - stableSince >= 800) {
          // A persistent disagreement belongs in the audit result, not a hidden retry.
          const { ready, matchingRenderedCounts, ...result } = observed;
          return { observedAt: new Date().toISOString(), ...result };
        }
      } else {
        signature = next;
        stableSince = Date.now();
      }
      lastObservation = observed;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(150, remaining(deadline))));
  }
  throw safeError(lastObservation ? 'render-unstable' : 'render-incomplete');
}

/** One browser, one ephemeral context at a time; callers never receive raw pages. */
export async function createPublicEquipmentBrowser() {
  let privateDir;
  try { privateDir = await mkdtemp(join(tmpdir(), 'netcar-equipment-browser-')); }
  catch { throw safeError('browser-launch-failed'); }
  let browser;
  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium-browser');
    await access(executablePath);
    // createRequire also follows NODE_PATH=/app/node_modules in the VPS image.
    const puppeteer = requireDevops('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      userDataDir: join(privateDir, 'profile'),
      env: buildPublicEquipmentBrowserEnv(privateDir),
      dumpio: false,
      timeout: 30_000,
      protocolTimeout: 10_000,
      args: [
        '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update',
        '--disable-default-apps', '--disable-extensions', '--disable-sync', '--metrics-recording-only',
        '--no-first-run', '--no-default-browser-check',
        '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
      ],
    });
  } catch {
    if (browser) await browser.close().catch(() => {});
    await rm(privateDir, { recursive: true, force: true }).catch(() => {});
    throw safeError('browser-launch-failed');
  }

  let closed = false;
  let queue = Promise.resolve();
  let closing;
  async function observeOne(vehicleId) {
    if (closed) throw safeError('browser-closed', vehicleId);
    const deadline = Date.now() + VEHICLE_TIMEOUT_MS;
    let context;
    let timeout;
    const observePage = async () => {
      context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 1366, height: 1000 });
      await page.setCacheEnabled(false);
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const allowed = isAllowedPublicEquipmentRequest({ url: request.url(), method: request.method(), resourceType: request.resourceType() });
        void (allowed ? request.continue() : request.abort('blockedbyclient')).catch(() => {});
      });
      let detailLoaded = false;
      page.on('requestfinished', (request) => {
        try {
          const url = new URL(request.url());
          if (PUBLIC_HOSTS.has(url.hostname) && url.pathname === `/api/v1/veiculos/id/${vehicleId}` && request.response()?.ok()) detailLoaded = true;
        } catch { /* No raw request information is persisted. */ }
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const attemptDeadline = attempt === 0 ? Math.min(deadline, Date.now() + 30_000) : deadline;
        detailLoaded = false;
        try {
          if (attempt === 0) await page.goto(`${PUBLIC_ORIGIN}/veiculo/${vehicleId}`, { waitUntil: 'domcontentloaded', timeout: remaining(attemptDeadline) });
          else await page.reload({ waitUntil: 'domcontentloaded', timeout: remaining(attemptDeadline) });
          return await readStablePage(page, attemptDeadline, () => detailLoaded);
        } catch {
          if (attempt === 1 || Date.now() >= deadline) throw safeError('observation-failed', vehicleId);
        }
      }
      throw safeError('observation-failed', vehicleId);
    };
    try {
      return await Promise.race([
        observePage(),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(safeError('observation-timeout', vehicleId)), VEHICLE_TIMEOUT_MS);
        }),
      ]);
    } catch {
      throw safeError('observation-failed', vehicleId);
    } finally {
      clearTimeout(timeout);
      if (context) await context.close().catch(() => {});
    }
  }

  return {
    observe(vehicleId) {
      if (typeof vehicleId !== 'string' || !/^\d{1,12}$/.test(vehicleId)) return Promise.reject(safeError('invalid-vehicle-id'));
      const observation = queue.then(() => observeOne(vehicleId));
      queue = observation.catch(() => {});
      return observation;
    },
    close() {
      if (!closing) {
        closed = true;
        closing = (async () => {
          // Closing Chromium first interrupts a pending page read on cancellation.
          await browser.close().catch(() => {});
          await queue.catch(() => {});
          try { await rm(privateDir, { recursive: true, force: true }); }
          catch { throw safeError('browser-cleanup-failed'); }
        })();
      }
      return closing;
    },
  };
}
