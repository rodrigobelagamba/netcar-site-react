import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configureSeoStockNetwork } from './lib/seo-stock-source.js';
import { loadGoogleAccess, readDiscoveryState, runStockDiscovery, writePrivateJson } from './lib/stock-google-discovery.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function canonicalDestination(path) {
  let ancestor = resolve(path);
  const suffix = [];
  while (true) {
    try {
      lstatSync(ancestor);
    } catch (error) {
      if (error.code !== 'ENOENT' || ancestor === dirname(ancestor)) throw new Error('private_state_directory_required');
      suffix.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
      continue;
    }
    try { return resolve(realpathSync(ancestor), ...suffix); }
    catch { throw new Error('private_state_directory_required'); }
  }
}

export function assertPrivateStateDirectory(directory, workspaceRoot = rootDir) {
  const absolute = resolve(directory), workspace = resolve(workspaceRoot);
  const canonical = canonicalDestination(absolute), canonicalRoot = canonicalDestination(workspace);
  const inside = (candidate, parent) => candidate === parent || candidate.startsWith(parent + '/');
  if (absolute === workspace || canonical === canonicalRoot ||
      ['public', 'dist'].some((part) => inside(absolute, join(workspace, part)) ||
        inside(canonical, canonicalDestination(join(workspace, part))))) throw new Error('private_state_directory_required');
  return absolute;
}

export async function monitorStockGoogle({ stateDir, observationsFile, force = false, env = process.env,
  run = runStockDiscovery, now = new Date().toISOString() } = {}) {
  const directory = assertPrivateStateDirectory(stateDir || join(rootDir, '.devops', 'equipment', 'seo-discovery'));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, '.running');
  // A stale lock is deliberately explicit: don't race a slow prior process.
  try { mkdirSync(lock, { mode: 0o700 }); } catch { throw new Error('discovery_already_running_or_stale_lock'); }
  try {
    const previous = readDiscoveryState(join(directory, 'state.json'));
    const inputFile = observationsFile || join(directory, 'gsc-ui-observations.json');
    let uiObservations;
    if (existsSync(inputFile)) {
      const metadata = lstatSync(inputFile);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 1024 * 1024) throw new Error('invalid_ui_observations_file');
      uiObservations = JSON.parse(readFileSync(inputFile, 'utf8'));
    }
    const access = await loadGoogleAccess({ env });
    const { state, report } = await run({ previous, now, rootDir, access, force, uiObservations });
    writePrivateJson(join(directory, 'state.json'), state);
    writePrivateJson(join(directory, 'report.json'), report);
    writePrivateJson(join(directory, 'run-status.json'), { schemaVersion: 1, at: now, status: 'completed', googleAccess: report.googleAccess });
    return report;
  } catch {
    writePrivateJson(join(directory, 'run-status.json'), { schemaVersion: 1, at: now, status: 'failed',
      reason: 'Monitor não concluiu a leitura. Estado anterior preservado; conferir fontes e configuração privada.' });
    // Upstream errors may include request URLs or credential-bearing payloads.
    throw new Error('discovery_run_failed_previous_state_preserved');
  } finally { rmdirSync(lock); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = {};
  let valid = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') options.force = true;
    else if (['--state-dir', '--observations-file'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
      options[args[i] === '--state-dir' ? 'stateDir' : 'observationsFile'] = resolve(args[++i]);
    } else valid = false;
  }
  if (!valid) { process.stderr.write('Use --state-dir DIRETORIO_PRIVADO [--observations-file ARQUIVO] [--force].\n'); process.exitCode = 1; }
  else {
    configureSeoStockNetwork();
    monitorStockGoogle(options).then((report) => {
      process.stdout.write(`${JSON.stringify({ status: report.status, counts: report.counts, googleAccess: report.googleAccess })}\n`);
    }).catch(() => { process.stderr.write('Monitor SEO não concluído; consulte run-status.json no diretório privado.\n'); process.exitCode = 1; });
  }
}
