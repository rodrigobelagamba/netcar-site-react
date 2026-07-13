import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';

function git(args, cwd = config.workspaceRoot) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export function getRepoStatus() {
  const cwd = config.workspaceRoot;

  let branch = 'unknown';
  let shortHash = 'unknown';
  let fullHash = 'unknown';
  let subject = '';
  let dirty = false;

  try {
    branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    fullHash = git(['rev-parse', 'HEAD']);
    shortHash = git(['rev-parse', '--short', 'HEAD']);
    subject = git(['log', '-1', '--pretty=%s']);
    dirty = Boolean(git(['status', '--porcelain']));
  } catch {
    // workspace may not be a git checkout in some setups
  }

  return { branch, shortHash, fullHash, subject, dirty, path: cwd };
}

export function getDistCommits(limit = 30) {
  const distPath = join(config.workspaceRoot, 'dist');
  const gitDir = join(distPath, '.git');

  if (!existsSync(gitDir)) {
    return { available: false, commits: [], error: 'dist/ não tem repositório Git de builds' };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  try {
    const raw = git(
      ['log', `--max-count=${safeLimit}`, '--pretty=format:%H%x09%h%x09%ci%x09%s'],
      distPath
    );

    const commits = raw
      ? raw.split('\n').filter(Boolean).map((line) => {
          const [fullHash, shortHash, date, ...rest] = line.split('\t');
          return {
            fullHash,
            shortHash,
            date,
            subject: rest.join('\t'),
          };
        })
      : [];

    let head = null;
    if (commits.length > 0) {
      head = commits[0];
    }

    return { available: true, commits, head };
  } catch (error) {
    return {
      available: false,
      commits: [],
      error: error.message || 'Falha ao ler git de dist/',
    };
  }
}

export function resolveDistCommit(ref = 'HEAD') {
  const distPath = join(config.workspaceRoot, 'dist');
  if (!existsSync(join(distPath, '.git'))) {
    throw new Error('dist/ não tem repositório Git de builds');
  }

  const fullHash = git(['rev-parse', '--verify', `${ref}^{commit}`], distPath);
  const shortHash = git(['rev-parse', '--short', fullHash], distPath);
  const subject = git(['log', '-1', '--pretty=%s', fullHash], distPath);
  return { fullHash, shortHash, subject };
}
