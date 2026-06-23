#!/usr/bin/env node

/**
 * Copia a chave SSH pública para o servidor (uma vez).
 * Depois disso, npm run deploy:local não pede senha.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const env = {
    SSH_HOST: 'netcarmultimarcas.com.br',
    SSH_USER: 'netcarmultimarcas',
    SSH_PASSWORD: '',
    SSH_KEY_PATH: '',
  };

  const envPath = join(rootDir, '.env.local');
  if (!existsSync(envPath)) return env;

  readFileSync(envPath, 'utf-8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...parts] = trimmed.split('=');
      const value = parts.join('=').trim();
      if (key in env) env[key] = value;
    });

  return env;
}

function hasCommand(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'pipe', shell: true });
    return true;
  } catch {
    return false;
  }
}

function resolveKeyPath(configured) {
  if (configured && existsSync(configured)) return configured;
  const defaults = ['id_ed25519', 'id_rsa'].map((name) => join(homedir(), '.ssh', name));
  return defaults.find((path) => existsSync(path)) || '';
}

const env = loadEnvLocal();
const keyPath = resolveKeyPath(env.SSH_KEY_PATH);
const pubPath = `${keyPath}.pub`;
const remote = `${env.SSH_USER}@${env.SSH_HOST}`;

if (!keyPath || !existsSync(pubPath)) {
  console.error('❌ Chave SSH não encontrada. Gere com: ssh-keygen -t ed25519');
  process.exit(1);
}

console.log(`🔑 Usando chave: ${keyPath}`);
console.log(`🌐 Servidor: ${remote}`);
console.log('');

if (env.SSH_PASSWORD && hasCommand('sshpass')) {
  console.log('📤 Copiando chave com SSH_PASSWORD (sshpass)...');
  execSync(
    `sshpass -e ssh-copy-id -i ${JSON.stringify(pubPath)} -o StrictHostKeyChecking=accept-new ${remote}`,
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, SSHPASS: env.SSH_PASSWORD },
    }
  );
} else {
  console.log('📤 Copiando chave (digite a senha SSH uma última vez)...');
  execSync(
    `ssh-copy-id -i ${JSON.stringify(pubPath)} -o StrictHostKeyChecking=accept-new ${remote}`,
    { stdio: 'inherit', shell: true }
  );
}

console.log('\n✅ Pronto! Teste: ssh -o BatchMode=yes ' + remote + ' "echo ok"');
console.log('   Depois: npm run deploy:local');
