#!/usr/bin/env node

/**
 * Deploy a partir do Git de dist/ — sem rebuild.
 *
 * Uso:
 *   npm run deploy:dist              → último commit
 *   npm run deploy:dist -- <hash>    → commit anterior
 *   npm run deploy:dist -- --help
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const deployLocal = join(__dirname, 'deploy-local.js');

const extraArgs = process.argv.slice(2);
const child = spawn(process.execPath, [deployLocal, '--from-dist', ...extraArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
