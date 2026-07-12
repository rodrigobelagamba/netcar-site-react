import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { config } from './config.js';

/** @typedef {'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'} JobStatus */

/**
 * @typedef {object} Job
 * @property {string} id
 * @property {string} label
 * @property {string} command
 * @property {string[]} args
 * @property {JobStatus} status
 * @property {string} log
 * @property {number} createdAt
 * @property {number|null} startedAt
 * @property {number|null} finishedAt
 * @property {number|null} exitCode
 * @property {string|null} error
 */

/** @type {Map<string, Job>} */
const jobs = new Map();

/** @type {Job[]} */
const queue = [];

let activeJobId = null;

const MAX_LOG_CHARS = 800_000;
const MAX_JOBS = 40;

function trimJobs() {
  if (jobs.size <= MAX_JOBS) return;
  const sorted = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  while (jobs.size > MAX_JOBS && sorted.length) {
    const old = sorted.shift();
    if (!old || old.id === activeJobId || old.status === 'queued' || old.status === 'running') {
      continue;
    }
    jobs.delete(old.id);
  }
}

function appendLog(job, chunk) {
  job.log += chunk;
  if (job.log.length > MAX_LOG_CHARS) {
    job.log = job.log.slice(job.log.length - MAX_LOG_CHARS);
  }
  for (const listener of job.listeners || []) {
    try {
      listener(chunk);
    } catch {
      // ignore broken SSE clients
    }
  }
}

function ensureListeners(job) {
  if (!job.listeners) job.listeners = new Set();
}

/**
 * @param {{ label: string, command: string, args?: string[], cwd?: string, env?: Record<string, string>, meta?: object, onSuccess?: (job: Job) => void }} opts
 */
export function enqueueJob(opts) {
  const job = {
    id: randomUUID(),
    label: opts.label,
    command: opts.command,
    args: opts.args || [],
    cwd: opts.cwd || config.workspaceRoot,
    env: opts.env || {},
    meta: opts.meta || null,
    onSuccess: opts.onSuccess || null,
    status: /** @type {JobStatus} */ ('queued'),
    log: '',
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    error: null,
    listeners: new Set(),
  };

  jobs.set(job.id, job);
  queue.push(job);
  trimJobs();
  pump();
  return publicJob(job);
}

export function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

export function getJobInternal(id) {
  return jobs.get(id) || null;
}

export function listJobs(limit = 20) {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(publicJob);
}

export function subscribeJobLog(id, listener) {
  const job = jobs.get(id);
  if (!job) return () => {};
  ensureListeners(job);
  job.listeners.add(listener);
  if (job.log) listener(job.log);
  return () => job.listeners.delete(listener);
}

function publicJob(job) {
  return {
    id: job.id,
    label: job.label,
    command: [job.command, ...job.args].join(' '),
    status: job.status,
    log: job.log,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    error: job.error,
  };
}

function pump() {
  if (activeJobId) return;
  const next = queue.shift();
  if (!next) return;
  runJob(next);
}

function runJob(job) {
  activeJobId = job.id;
  job.status = 'running';
  job.startedAt = Date.now();
  appendLog(job, `$ ${job.command} ${job.args.join(' ')}\n`);

  const child = spawn(job.command, job.args, {
    cwd: job.cwd,
    env: { ...process.env, ...job.env, FORCE_COLOR: '0' },
    shell: false,
    windowsHide: true,
  });

  job.child = child;

  const timer = setTimeout(() => {
    appendLog(job, `\n[devops] timeout após ${config.jobTimeoutMs}ms — encerrando\n`);
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  }, config.jobTimeoutMs);

  child.stdout.on('data', (buf) => appendLog(job, buf.toString('utf-8')));
  child.stderr.on('data', (buf) => appendLog(job, buf.toString('utf-8')));

  child.on('error', (err) => {
    clearTimeout(timer);
    job.status = 'failed';
    job.error = err.message;
    job.finishedAt = Date.now();
    appendLog(job, `\n[devops] erro ao iniciar: ${err.message}\n`);
    activeJobId = null;
    job.child = null;
    pump();
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    job.exitCode = code;
    job.finishedAt = Date.now();
    job.status = code === 0 ? 'succeeded' : 'failed';
    if (code !== 0) {
      job.error = `exit ${code}`;
    }
    appendLog(job, `\n[devops] finalizado com código ${code}\n`);

    if (code === 0 && typeof job.onSuccess === 'function') {
      try {
        job.onSuccess(job);
      } catch (err) {
        appendLog(job, `\n[devops] aviso ao registrar deploy: ${err.message}\n`);
      }
    }

    activeJobId = null;
    job.child = null;
    pump();
  });
}

export function npmRun(script, extraArgs = [], opts = {}) {
  const args = ['run', script];
  if (extraArgs.length) {
    args.push('--', ...extraArgs);
  }
  return enqueueJob({
    label: `npm run ${script}${extraArgs.length ? ` -- ${extraArgs.join(' ')}` : ''}`,
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    cwd: config.workspaceRoot,
    meta: opts.meta,
    onSuccess: opts.onSuccess,
  });
}
