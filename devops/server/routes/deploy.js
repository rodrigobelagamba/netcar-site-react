import { Router } from 'express';
import { getDistCommits, resolveDistCommit } from '../services/git.js';
import { recordSuccessfulDeploy } from '../services/deploy-state.js';
import { npmRun } from '../services/runner.js';

export const deployRouter = Router();

deployRouter.post('/dist', (req, res) => {
  const hash = typeof req.body?.hash === 'string' ? req.body.hash.trim() : '';

  try {
    const commit = resolveDistCommit(hash || 'HEAD');
    const extraArgs = hash ? [hash] : [];
    const job = npmRun('deploy:dist', extraArgs, {
      meta: { kind: 'deploy:dist', distHash: commit.fullHash },
      onSuccess: () => {
        recordSuccessfulDeploy({
          kind: 'deploy:dist',
          distHash: commit.fullHash,
          distShortHash: commit.shortHash,
          sourceHash: commit.subject.match(/\/\s*([0-9a-f]+)\s*$/i)?.[1] || null,
        });
      },
    });
    res.status(202).json({
      job,
      commit,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Commit inválido' });
  }
});

deployRouter.post('/local', (_req, res) => {
  const job = npmRun('deploy:local', [], {
    meta: { kind: 'deploy:local' },
    onSuccess: () => {
      const dist = getDistCommits(1);
      if (dist.head) {
        recordSuccessfulDeploy({
          kind: 'deploy:local',
          distHash: dist.head.fullHash,
          distShortHash: dist.head.shortHash,
          sourceHash: dist.head.subject.match(/\/\s*([0-9a-f]+)\s*$/i)?.[1] || null,
        });
      }
    },
  });
  res.status(202).json({ job });
});
