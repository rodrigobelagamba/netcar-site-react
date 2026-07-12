import { Router } from 'express';
import { resolveDistCommit } from '../services/git.js';
import { npmRun } from '../services/runner.js';

export const deployRouter = Router();

deployRouter.post('/dist', (req, res) => {
  const hash = typeof req.body?.hash === 'string' ? req.body.hash.trim() : '';

  try {
    const commit = resolveDistCommit(hash || 'HEAD');
    const extraArgs = hash ? [hash] : [];
    const job = npmRun('deploy:dist', extraArgs);
    res.status(202).json({
      job,
      commit,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Commit inválido' });
  }
});

deployRouter.post('/local', (_req, res) => {
  const job = npmRun('deploy:local');
  res.status(202).json({ job });
});
