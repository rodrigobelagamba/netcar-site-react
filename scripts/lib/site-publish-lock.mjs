import { mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** One lock shared by the host cron, CI synchronization and container deploys. */
export function acquireSitePublishLock(rootDir, env = process.env) {
  const stateDir = join(rootDir, '.devops');
  const lockDir = join(stateDir, 'site-publish.lock');
  const tokenFile = join(lockDir, 'token');
  const inherited = env.NETCAR_SITE_LOCK_TOKEN;
  const busy = () => Object.assign(new Error('NETCAR_SITE_PUBLISH_BUSY'), { code: 'NETCAR_SITE_PUBLISH_BUSY', exitCode: 75 });
  if (inherited) {
    let existing;
    try { existing = readFileSync(tokenFile, 'utf8').trim(); } catch { throw busy(); }
    if (existing !== inherited) throw busy();
    return () => {};
  }
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  try { mkdirSync(lockDir, { mode: 0o700 }); } catch (error) {
    if (error.code === 'EEXIST') throw busy();
    throw error;
  }
  const token = randomUUID();
  try { writeFileSync(tokenFile, `${token}\n`, { flag: 'wx', mode: 0o600 }); } catch (error) {
    try { rmdirSync(lockDir); } catch {}
    throw error;
  }
  env.NETCAR_SITE_LOCK_TOKEN = token;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // Never remove another owner's lock; stale locks require operator inspection.
    try {
      let current;
      try { current = readFileSync(tokenFile, 'utf8').trim(); } catch { return; }
      if (current !== token) return;
      unlinkSync(tokenFile);
      rmdirSync(lockDir);
    } finally {
      if (env.NETCAR_SITE_LOCK_TOKEN === token) delete env.NETCAR_SITE_LOCK_TOKEN;
    }
  };
}
