import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import { getDistCommits, getRepoStatus } from './git.js';

const STATE_DIR = join(config.workspaceRoot, '.devops');
const STATE_FILE = join(STATE_DIR, 'last-deploy.json');

/** Extrai o short hash do repo gravado na mensagem do commit de dist/ */
export function parseSourceHashFromDistSubject(subject = '') {
  const match = String(subject).match(/\/\s*([0-9a-f]{7,40})(?:\b|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function hashesMatch(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x === y || x.startsWith(y) || y.startsWith(x);
}

export function readLastDeploy() {
  try {
    if (!existsSync(STATE_FILE)) return null;
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeLastDeploy(payload) {
  mkdirSync(STATE_DIR, { recursive: true });
  const data = {
    ...payload,
    at: new Date().toISOString(),
  };
  writeFileSync(STATE_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  return data;
}

export function recordSuccessfulDeploy({ kind, distHash, distShortHash, sourceHash }) {
  const repo = getRepoStatus();
  return writeLastDeploy({
    kind,
    distHash,
    distShortHash,
    // hash do código que acabamos de tratar (sempre o HEAD atual do workspace)
    builtRepoHash: repo.fullHash,
    builtRepoShortHash: repo.shortHash,
    sourceHash: sourceHash || repo.shortHash,
    repoHash: repo.fullHash,
    repoShortHash: repo.shortHash,
  });
}

/**
 * Compara código do workspace, último build em dist/ e último deploy registrado.
 */
export function getDeployPending() {
  const repo = getRepoStatus();
  const dist = getDistCommits(1);
  const lastDeploy = readLastDeploy();

  const distHead = dist.head || null;
  const builtFromSource = distHead
    ? parseSourceHashFromDistSubject(distHead.subject)
    : null;

  // Já rodamos deploy:local neste HEAD? (mesmo sem novo artefato em dist/)
  const builtThisHead =
    Boolean(lastDeploy?.builtRepoShortHash || lastDeploy?.builtRepoHash) &&
    hashesMatch(repo.shortHash, lastDeploy.builtRepoShortHash || lastDeploy.builtRepoHash);

  const distMatchesRepo =
    Boolean(builtFromSource) && hashesMatch(repo.shortHash, builtFromSource);

  const pendingBuild =
    Boolean(repo.shortHash && repo.shortHash !== 'unknown') &&
    !builtThisHead &&
    (!dist.available || !distMatchesRepo);

  const pendingDeploy =
    Boolean(distHead?.fullHash) &&
    (!lastDeploy?.distHash || !hashesMatch(distHead.fullHash, lastDeploy.distHash));

  let message = null;
  let action = null;

  if (pendingBuild) {
    message = `Há código novo no repo (${repo.shortHash}) que ainda não foi buildado/publicado. Rode Build + deploy completo.`;
    action = 'deploy:local';
  } else if (pendingDeploy) {
    message = `Há um build em dist/ (${distHead.shortHash}) ainda não publicado na KingHost. Rode Deploy último (HEAD).`;
    action = 'deploy:dist';
  }

  return {
    pendingBuild,
    pendingDeploy,
    hasPending: pendingBuild || pendingDeploy,
    message,
    action,
    builtFromSource,
    lastDeploy,
    distHead,
  };
}
