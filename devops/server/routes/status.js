import { existsSync } from 'fs';
import { join } from 'path';
import { Router } from 'express';
import { config, SECRET_PATHS } from '../services/config.js';
import { getDistCommits, getRepoStatus } from '../services/git.js';
import { getDeployPending } from '../services/deploy-state.js';
import { listJobs } from '../services/runner.js';

export const statusRouter = Router();

statusRouter.get('/', (_req, res) => {
  const repo = getRepoStatus();
  const dist = getDistCommits(1);
  const pending = getDeployPending();

  const secrets = {};
  for (const [key, rel] of Object.entries(SECRET_PATHS)) {
    secrets[key] = existsSync(join(config.workspaceRoot, rel));
  }

  res.json({
    workspaceRoot: config.workspaceRoot,
    repo,
    dist: {
      available: dist.available,
      head: dist.head || null,
      error: dist.error || null,
      builtFromSource: pending.builtFromSource,
    },
    pending,
    secrets,
    activeJobs: listJobs(5).filter((j) => j.status === 'running' || j.status === 'queued'),
  });
});
