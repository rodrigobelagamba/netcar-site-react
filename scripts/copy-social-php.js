#!/usr/bin/env node
/**
 * Copia endpoints sociais para dist/social/v1/ (deploy KingHost junto com o site).
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'docs/social');
const dest = join(root, 'dist/social/v1');

if (!existsSync(join(root, 'dist'))) {
  console.warn('copy-social-php: dist/ não existe — rode npm run build primeiro');
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
mkdirSync(join(dest, 'lib'), { recursive: true });
mkdirSync(join(dest, 'data/cache'), { recursive: true });

const files = [
  'google-reviews.php',
  'stories.php',
  'social-oauth.php',
  'sync-social.php',
  'outscraper-sync.php',
  'review-media.php',
  'social-config.example.php',
];

for (const file of files) {
  cpSync(join(src, file), join(dest, file));
}

const socialConfig = join(src, 'social-config.php');
if (existsSync(socialConfig)) {
  cpSync(socialConfig, join(dest, 'social-config.php'));
  console.log('social-config.php copiado para dist/social/v1/');
}

cpSync(join(src, 'lib'), join(dest, 'lib'), { recursive: true });
cpSync(join(src, 'data/google-reviews.seed.json'), join(dest, 'data/google-reviews.seed.json'));
cpSync(join(src, 'data/stories.seed.json'), join(dest, 'data/stories.seed.json'));

console.log('Social PHP copiado para dist/social/v1/');
