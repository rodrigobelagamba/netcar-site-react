import { existsSync, readFileSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const devopsRoot = resolve(__dirname, '../..');

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(devopsRoot, '.env'));

function resolveWorkspaceRoot() {
  const raw = process.env.WORKSPACE_ROOT || '..';
  const absolute = isAbsolute(raw) ? raw : resolve(devopsRoot, raw);
  return resolve(absolute);
}

export const config = {
  devopsRoot,
  workspaceRoot: resolveWorkspaceRoot(),
  port: Number(process.env.PORT || 3090),
  token: process.env.DEVOPS_TOKEN || '',
  jobTimeoutMs: Number(process.env.JOB_TIMEOUT_MS || 45 * 60 * 1000),
  isProd: process.env.NODE_ENV === 'production',
};

export const NPM_ALLOWLIST = [
  'deploy:dist',
  'deploy:local',
  'build',
  'generate-blog',
  'generate-landings',
  'generate-sitemap',
  'seo:generate',
  'catalog:whatsapp',
  'lint',
];

export const SECRET_PATHS = {
  envLocal: '.env.local',
  envProduction: '.env.production',
  socialConfig: join('docs', 'social', 'social-config.php'),
};
