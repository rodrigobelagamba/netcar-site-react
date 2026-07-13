export function requireAuth(req, res, next) {
  const expected = process.env.DEVOPS_TOKEN || '';
  if (!expected) {
    res.status(503).json({
      error: 'DEVOPS_TOKEN não configurado. Defina em devops/.env ou /opt/netcar-secrets/devops.env',
    });
    return;
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';

  if (!token || token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
