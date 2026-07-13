import { Router } from 'express';
import { getDistCommits } from '../services/git.js';

export const distRouter = Router();

distRouter.get('/commits', (req, res) => {
  const limit = Number(req.query.limit) || 30;
  const result = getDistCommits(limit);
  if (!result.available) {
    res.status(404).json(result);
    return;
  }
  res.json(result);
});
