import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Router } from 'express';
import { config, NPM_ALLOWLIST } from '../services/config.js';
import { npmRun } from '../services/runner.js';

export const npmRouter = Router();

npmRouter.get('/scripts', (_req, res) => {
  const pkgPath = join(config.workspaceRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    res.status(404).json({ error: 'package.json não encontrado no workspace' });
    return;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const all = Object.keys(pkg.scripts || {});
    const allowed = NPM_ALLOWLIST.filter((name) => all.includes(name));
    res.json({ allowed, all });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

npmRouter.post('/run', (req, res) => {
  const script = typeof req.body?.script === 'string' ? req.body.script.trim() : '';
  if (!script || !NPM_ALLOWLIST.includes(script)) {
    res.status(400).json({
      error: 'Script não permitido',
      allowlist: NPM_ALLOWLIST,
    });
    return;
  }

  if (script === 'deploy:dist' || script === 'deploy:local') {
    res.status(400).json({
      error: `Use POST /api/deploy/${script === 'deploy:dist' ? 'dist' : 'local'} para deploys`,
    });
    return;
  }

  const job = npmRun(script);
  res.status(202).json({ job });
});
