import express from 'express';
import cors from 'cors';
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from './services/config.js';
import { requireAuth } from './middleware/auth.js';
import { statusRouter } from './routes/status.js';
import { distRouter } from './routes/dist.js';
import { deployRouter } from './routes/deploy.js';
import { npmRouter } from './routes/npm.js';
import { jobsRouter } from './routes/jobs.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    workspaceRoot: config.workspaceRoot,
    workspaceExists: existsSync(config.workspaceRoot),
  });
});

app.use('/api/status', requireAuth, statusRouter);
app.use('/api/dist', requireAuth, distRouter);
app.use('/api/deploy', requireAuth, deployRouter);
app.use('/api/npm', requireAuth, npmRouter);
app.use('/api/jobs', requireAuth, jobsRouter);

const clientDist = join(config.devopsRoot, 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(config.port, () => {
  console.log(`[devops] listening on :${config.port}`);
  console.log(`[devops] workspace: ${config.workspaceRoot}`);
  if (!config.token) {
    console.warn('[devops] WARNING: DEVOPS_TOKEN is empty — API will reject authenticated routes');
  }
});
