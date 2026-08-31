#!/usr/bin/env node

/**
 * Deploy atomico e parcial de docs/social para a KingHost.
 *
 * Por seguranca, o comando apenas mostra o plano ate receber --apply.
 * Nunca envia social-config.php, tokens, cache, seeds ou o restante do site.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, posix as pathPosix } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'docs/social');

const manifest = [
  'data/.htaccess',
  'lib/InstagramFeedClient.php',
  'lib/GoogleLocalPostsClient.php',
  'lib/InstagramPostMediaCache.php',
  'lib/InstagramGbpPostFactory.php',
  'lib/GooglePostsStateStore.php',
  'lib/InstagramGbpPublisher.php',
  'instagram-post-media.php',
  'lib/bootstrap.php',
  'lib/SocialSyncRunner.php',
  'sync-social.php',
];

function parseEnv(path) {
  if (!existsSync(path)) throw new Error(`Arquivo de ambiente nao encontrado: ${path}`);
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function argValue(name) {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function safeRelativePath(value) {
  const normalized = value.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!manifest.includes(normalized) || normalized.includes('..')) {
    throw new Error(`Arquivo fora do manifest permitido: ${value}`);
  }
  return normalized;
}

function quote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
        if (code === 0) resolvePromise(stdout);
      else reject(new Error(stderr.trim() || stdout.trim() || `${command} falhou: ${code}`));
    });
  });
}

const envFile = resolve(argValue('--env-file') || resolve(root, '.env.local'));
const config = parseEnv(envFile);
const identityArgument = argValue('--identity');
if (identityArgument) config.SSH_KEY_PATH = resolve(identityArgument);
for (const key of ['SSH_HOST', 'SSH_USER', 'SSH_DIR']) {
  if (!config[key]) throw new Error(`${key} ausente no arquivo de ambiente.`);
}
if (!config.SSH_KEY_PATH || !existsSync(config.SSH_KEY_PATH)) {
  throw new Error('Configure uma SSH_KEY_PATH valida (senha interativa nao e aceita neste deploy atomico).');
}

const selectedArg = argValue('--files');
const selected = selectedArg
  ? selectedArg.split(',').map((item) => safeRelativePath(item.trim()))
  : manifest;
for (const relative of selected) {
  const localPath = resolve(sourceRoot, relative);
  if (!localPath.startsWith(sourceRoot + '/') || !existsSync(localPath)) {
    throw new Error(`Arquivo local ausente: ${relative}`);
  }
}

const remoteRoot = config.SSH_DIR.replaceAll('\\', '/').replace(/\/$/, '');
if (!/^[a-zA-Z0-9._/-]+$/.test(remoteRoot) || remoteRoot === '' || remoteRoot === '/') {
  throw new Error('SSH_DIR invalido ou amplo demais.');
}

console.log('Deploy social parcial:');
for (const relative of selected) console.log(`  social/v1/${relative}`);
if (!process.argv.includes('--apply')) {
  console.log('\nDry-run concluido. Nenhum arquivo foi enviado. Use --apply para executar.');
  process.exit(0);
}

const release = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const backupRoot = `.netcar-social-backups/${release}`;
const destination = `${config.SSH_USER}@${config.SSH_HOST}`;
const portArgs = config.SSH_PORT ? ['-p', String(config.SSH_PORT)] : [];
const commonSshArgs = [
  '-i', config.SSH_KEY_PATH,
  '-o', 'BatchMode=yes',
  '-o', 'StrictHostKeyChecking=accept-new',
  '-o', 'ConnectTimeout=15',
];

for (const relative of selected) {
  const localPath = resolve(sourceRoot, relative);
  const remotePath = pathPosix.join(remoteRoot, 'social/v1', relative);
  const temporaryPath = `${remotePath}.upload-${release}`;
  const backupPath = pathPosix.join(backupRoot, relative);

  await run('ssh', [
    ...commonSshArgs,
    ...portArgs,
    destination,
    `mkdir -p ${quote(pathPosix.dirname(remotePath))} ${quote(pathPosix.dirname(backupPath))} && `
      + `if [ -f ${quote(remotePath)} ]; then cp -p ${quote(remotePath)} ${quote(backupPath)}; fi`,
  ]);
  const scpPortArgs = config.SSH_PORT ? ['-P', String(config.SSH_PORT)] : [];
  await run('scp', [
    ...commonSshArgs,
    ...scpPortArgs,
    localPath,
    `${destination}:${temporaryPath}`,
  ]);
  await run('ssh', [
    ...commonSshArgs,
    ...portArgs,
    destination,
    `chmod 0644 ${quote(temporaryPath)} && mv -f ${quote(temporaryPath)} ${quote(remotePath)}`,
  ]);
  console.log(`Enviado: social/v1/${relative}`);
}
console.log(`Backup remoto: ${backupRoot}`);
