#!/usr/bin/env node

// Operacao limitada: sincroniza os videos do site sem executar o publicador GBP.
// Credenciais permanecem no ambiente privado do painel, nunca nos argumentos/logs.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const timeoutMs = 5 * 60 * 1000;
class SafeOperationError extends Error {}
const fail = (message) => { throw new SafeOperationError(message); };
const quote = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`;

function argumentsForRun(args) {
  if (args.some((arg) => !['--dry-run', '--status', '--help'].includes(arg))
    || new Set(args).size !== args.length
    || (args.includes('--status') && args.includes('--dry-run'))
    || (args.includes('--help') && args.length !== 1)) {
    fail('Use somente --dry-run, --status ou nenhum argumento.');
  }
  return { help: args.includes('--help'), status: args.includes('--status'), dryRun: args.includes('--dry-run') };
}

function configuration() {
  let source;
  try { source = readFileSync(join(root, '.env.local'), 'utf8'); }
  catch { fail('Ambiente privado de deploy indisponivel.'); }
  const env = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  const value = (name, fallback = '') => process.env[name] || env[name] || fallback;
  const host = value('SSH_HOST');
  const username = value('SSH_USER');
  const port = Number(value('SSH_PORT', '22'));
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host) || host.includes('..')
    || !/^[a-zA-Z0-9_][a-zA-Z0-9._-]*$/.test(username)
    || !Number.isInteger(port) || port < 1 || port > 65535) fail('Configuracao de conexao SSH invalida.');

  const remoteRoot = value('SSH_DIR', 'www').replace(/\/$/, '');
  if (!/^[a-zA-Z0-9_./-]+$/.test(remoteRoot) || remoteRoot.startsWith('-')
    || remoteRoot.split('/').some((part, index) => part === '.' || part === '..' || (part === '' && index !== 0))) fail('Diretorio remoto invalido.');
  const php = value('SSH_PHP_BIN', 'php');
  if (!/^(?:\/[a-zA-Z0-9_.-]+)*\/?php[0-9.]*$/.test(php)) fail('Executavel PHP invalido.');

  const password = value('SSH_PASSWORD');
  const keyPath = value('SSH_KEY_PATH') || ['id_netcar', 'id_ed25519', 'id_rsa'].map((name) => join(homedir(), '.ssh', name)).find(existsSync);
  let privateKey;
  if (!password && keyPath) {
    try { privateKey = readFileSync(keyPath); } catch { fail('Chave SSH de deploy indisponivel.'); }
  }
  if (!password && !privateKey) fail('Autenticacao SSH de deploy indisponivel.');

  const pins = [];
  const fingerprint = value('SSH_HOST_FINGERPRINT');
  if (fingerprint) {
    if (!/^SHA256:[a-zA-Z0-9+/]{43}=?$/.test(fingerprint)) fail('Fingerprint SSH invalido.');
    pins.push(fingerprint.replace(/=+$/, ''));
  } else {
    const explicitKnownHosts = value('SSH_KNOWN_HOSTS_PATH');
    const knownHosts = explicitKnownHosts || join(homedir(), '.ssh', 'known_hosts');
    if (explicitKnownHosts && !existsSync(knownHosts)) fail('Arquivo known_hosts configurado indisponivel.');
    if (existsSync(knownHosts)) {
      const lookup = spawnSync('ssh-keygen', ['-F', port === 22 ? host : `[${host}]:${port}`, '-f', knownHosts], { encoding: 'utf8', timeout: 10_000 });
      for (const line of (lookup.stdout || '').split(/\r?\n/)) {
        if (!line || line.startsWith('#') || line.startsWith('@')) continue;
        const key = line.trim().split(/\s+/)[2];
        if (key) pins.push(`SHA256:${createHash('sha256').update(Buffer.from(key, 'base64')).digest('base64').replace(/=+$/, '')}`);
      }
      if (explicitKnownHosts && pins.length === 0) fail('Host SSH ausente do known_hosts configurado.');
    }
  }
  return {
    remoteRoot, php,
    ssh: {
      host, username, port, ...(password ? { password } : { privateKey }),
      readyTimeout: 45_000, keepaliveInterval: 10_000, keepaliveCountMax: 3,
      ...(pins.length ? { hostVerifier: (key) => pins.includes(`SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`) } : {}),
    },
  };
}

function statusCode(socialRoot) {
  // Filtragem ocorre na KingHost: comandos de cron podem conter segredos.
  return `$root = ${JSON.stringify(socialRoot)};
$cache = [];
foreach (['stories', 'vehicle-videos'] as $name) {
  $path = $root . '/data/cache/' . $name . '.json';
  $data = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
  $date = is_array($data) ? ($data['syncedAt'] ?? null) : null;
  $cache[$name] = ['available' => is_array($data), 'syncedAt' => is_string($date) && preg_match('/^\\d{4}-\\d{2}-\\d{2}T[0-9:+.Z-]+$/', $date) ? $date : null];
}
$lines = []; $exit = 1;
if (function_exists('exec')) { @exec('crontab -l 2>/dev/null', $lines, $exit); }
$schedules = [];
foreach ($lines as $line) {
  if (strpos(ltrim($line), '#') === 0 || strpos($line, 'sync-social.php') === false) continue;
  if (!preg_match('/^\\s*((?:[0-9*,\\/-]+\\s+){4}[0-9*,\\/-]+|@[a-z]+)\\s+/', $line, $match)) continue;
  $types = strpos($line, 'vehicle_videos_only') !== false || strpos($line, '--vehicle-videos-only') !== false ? ['videos']
    : (strpos($line, 'reviews_only') !== false ? ['reviews']
    : (strpos($line, 'posts_only') !== false ? ['posts']
    : (strpos($line, 'stories_only') !== false ? ['stories', 'posts', 'videos'] : ['reviews', 'stories', 'posts', 'videos'])));
  $schedules[] = ['schedule' => preg_replace('/\\s+/', ' ', trim($match[1])), 'routines' => $types];
}
echo json_encode(['success' => true, 'statusOnly' => true, 'cache' => $cache, 'cronReadable' => $exit === 0, 'schedules' => $schedules], JSON_UNESCAPED_SLASHES);`;
}

async function execute(config, mode) {
  let Client;
  try { ({ Client } = await import('ssh2')); } catch { fail('Dependencia SSH de deploy indisponivel.'); }
  const socialRoot = `${config.remoteRoot}/social/v1`;
  const command = mode.status
    ? `${quote(config.php)} -r ${quote(statusCode(socialRoot))}`
    : `${quote(config.php)} ${quote(`${socialRoot}/sync-social.php`)} --vehicle-videos-only${mode.dryRun ? ' --dry-run' : ''}`;
  return new Promise((resolvePromise, reject) => {
    const connection = new Client();
    let complete = false;
    const finish = (error, result) => {
      if (complete) return;
      complete = true;
      clearTimeout(timer);
      connection.end();
      if (error) reject(new SafeOperationError(error)); else resolvePromise(result);
    };
    const timer = setTimeout(() => { connection.destroy(); finish('Sincronizacao excedeu cinco minutos.'); }, timeoutMs);
    connection.on('error', () => finish('Falha na conexao SSH de deploy.'));
    connection.on('close', () => { if (!complete) finish('Conexao SSH encerrada antes da confirmacao.'); });
    connection.on('ready', () => connection.exec(command, (error, stream) => {
      if (error) { finish('Nao foi possivel iniciar a rotina remota.'); return; }
      let output = '';
      stream.on('data', (chunk) => {
        output += chunk;
        if (output.length > 2_000_000) { stream.close(); finish('Resposta remota excedeu o limite permitido.'); }
      });
      stream.stderr.on('data', () => {}); // Mensagens da API podem conter tokens; nunca retransmitir.
      stream.on('close', (code) => {
        if (code !== 0) { finish('Rotina remota falhou; consulte o estado privado da integracao.'); return; }
        let result;
        try { result = JSON.parse(output); } catch { finish('Rotina remota nao devolveu JSON valido.'); return; }
        finish(null, result);
      });
    }));
    try { connection.connect(config.ssh); } catch { finish('Configuracao SSH recusada.'); }
  });
}

function summary(result, mode) {
  if (result?.success !== true) fail('Rotina nao confirmou sucesso.');
  if (mode.status) {
    if (result.statusOnly !== true) fail('Consulta nao confirmou modo somente leitura.');
    const cache = {};
    for (const name of ['stories', 'vehicle-videos']) {
      const entry = result.cache?.[name];
      cache[name] = {
        available: entry?.available === true,
        syncedAt: typeof entry?.syncedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[0-9:+.Z-]+$/.test(entry.syncedAt) ? entry.syncedAt : null,
      };
    }
    const schedules = Array.isArray(result.schedules) ? result.schedules.filter((entry) => (
      typeof entry?.schedule === 'string' && /^(?:[0-9*,\/-]+ ){4}[0-9*,\/-]+$|^@[a-z]+$/.test(entry.schedule)
    )).map((entry) => ({
      schedule: entry.schedule,
      routines: Array.isArray(entry.routines) ? entry.routines.filter((name) => ['reviews', 'stories', 'posts', 'videos'].includes(name)) : [],
    })) : [];
    return { success: true, statusOnly: true, cache, cronReadable: result.cronReadable === true, schedules };
  }
  if (result.reviews !== null || result.stories !== null || result.posts !== null
    || result.vehicleVideos?.success !== true || result.vehicleVideos.dryRun !== mode.dryRun) fail('Resposta nao confirmou sincronizacao exclusiva dos videos.');
  const videos = { success: true, dryRun: mode.dryRun };
  for (const [key, value] of Object.entries(result.vehicleVideos)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) videos[key] = value;
  }
  const syncedAt = typeof result.syncedAt === 'string' && /^\d{4}-\d{2}-\d{2}T[0-9:+.Z-]+$/.test(result.syncedAt) ? result.syncedAt : null;
  return { success: true, syncedAt, vehicleVideos: videos };
}

try {
  const mode = argumentsForRun(process.argv.slice(2));
  if (mode.help) {
    console.log('npm run social:sync-vehicle-videos [-- --dry-run | -- --status]\nSincroniza apenas videos dos carros; --status consulta caches e agendas sem alterar estado.');
  } else {
    const config = configuration();
    console.log(JSON.stringify(summary(await execute(config, mode), mode), null, 2));
  }
} catch (error) {
  // Todas as mensagens sao definidas acima; dados/erros brutos de SSH e PHP ficam privados.
  console.error(JSON.stringify({ success: false, error: error instanceof SafeOperationError ? error.message : 'Falha operacional na rotina de videos.' }));
  process.exitCode = 1;
}
