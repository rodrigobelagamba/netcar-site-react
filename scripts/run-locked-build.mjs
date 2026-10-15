#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireSitePublishLock } from './lib/site-publish-lock.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let release;
try {
  // Cover all generators, including the first snapshot write. A deploy or the
  // scheduled runner can pass its existing ownership to this child process.
  release = acquireSitePublishLock(rootDir);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'build:content'], { cwd: rootDir, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.code === 'NETCAR_SITE_PUBLISH_BUSY' ? error.code : 'NETCAR_BUILD_FAILED');
  process.exitCode = error.exitCode || 1;
} finally {
  // On abrupt process termination this is deliberately not recovered: another
  // generator/upload child could still be alive. Operators inspect stale locks.
  release?.();
}
