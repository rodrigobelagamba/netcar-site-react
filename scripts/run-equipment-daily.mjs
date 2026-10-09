import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** One existing runner job, two read/review stages. No shell, build or publish. */
export async function runEquipmentDaily({ stateDir, input, execute = executeNode, workspaceRoot = root, pathExists = existsSync }) {
  await execute(['--import', 'tsx', 'scripts/audit-vehicle-equipment.ts', '--state-dir', stateDir], workspaceRoot);
  const discover = ['--import', 'tsx', 'scripts/review-vehicle-equipment.ts', 'discover', '--input', input,
    '--expand-exact-matches', '--state-dir', stateDir];
  for (const [privateFile, flag, seed] of [
    ['research-progress.json', '--research-progress', 'equipment-research-progress-2026-10-09.json'],
    ['research-public-observations.json', '--public-observations', 'equipment-public-observations-2026-10-09.json'],
  ]) {
    // Bootstrap once. Later discoveries must preserve newer operator evidence.
    if (!pathExists(join(stateDir, privateFile))) discover.push(flag, join(workspaceRoot, 'docs', 'audits', seed));
  }
  await execute(discover, workspaceRoot);
}

async function executeNode(args, cwd) {
  await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', shell: false });
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGTERM', terminate);
    process.once('SIGINT', terminate);
    const cleanup = () => { process.off('SIGTERM', terminate); process.off('SIGINT', terminate); };
    child.once('error', (error) => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      if (code === 0) done();
      else reject(new Error(`Etapa de equipamentos não concluída (${signal || code}). Últimos resultados válidos preservados.`));
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--state-dir' || args[2] !== '--input' || !args[1] || !args[3]) {
    process.stderr.write('Informe --state-dir DIRETORIO --input BIBLIOTECA.\n');
    process.exitCode = 1;
  } else {
    runEquipmentDaily({ stateDir: resolve(args[1]), input: resolve(args[3]) }).catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
  }
}
