import { Router } from 'express';
import { getJob, listJobs, subscribeJobLog } from '../services/runner.js';

export const jobsRouter = Router();

jobsRouter.get('/', (req, res) => {
  const limit = Number(req.query.limit) || 20;
  res.json({ jobs: listJobs(limit) });
});

jobsRouter.get('/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job não encontrado' });
    return;
  }
  res.json({ job });
});

jobsRouter.get('/:id/stream', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job não encontrado' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('status', { status: job.status, exitCode: job.exitCode });

  if (job.status === 'succeeded' || job.status === 'failed') {
    send('done', { status: job.status, exitCode: job.exitCode });
  }

  let finished = job.status === 'succeeded' || job.status === 'failed';

  const unsubscribe = subscribeJobLog(req.params.id, (chunk) => {
    send('log', { chunk });
    const latest = getJob(req.params.id);
    if (
      !finished &&
      latest &&
      (latest.status === 'succeeded' || latest.status === 'failed')
    ) {
      finished = true;
      send('status', { status: latest.status, exitCode: latest.exitCode });
      send('done', { status: latest.status, exitCode: latest.exitCode });
    }
  });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
