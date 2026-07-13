import { spawn } from 'child_process';
import { createWriteStream, readFileSync, statSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'ssh2';

const TAR_EXCLUDES = ['.git', '.gitignore', '.git-commit-msg.txt'];

function tarSpawnArgs() {
  return [...TAR_EXCLUDES.flatMap((name) => ['--exclude', name]), '-cf', '-', '.'];
}

export function tarExcludeShellFlags() {
  return TAR_EXCLUDES.map((name) => `--exclude=${name}`).join(' ');
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function connectSsh({ host, user, password }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);

    conn.connect({
      host,
      username: user,
      password,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
    });
  });
}

function execRemote(conn, command, onProgress) {
  const report = (message) => onProgress?.(message);

  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stderr = '';
      let stdout = '';

      stream.on('data', (chunk) => {
        stdout += chunk;
      });

      stream.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      stream.on('close', (code) => {
        if (code !== 0) {
          const details = stderr.trim() || stdout.trim();
          reject(new Error(details || `comando remoto exit ${code}`));
          return;
        }
        resolve();
      });
    });
  });
}

function openSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}

function createLocalTarArchive(localDir, onProgress) {
  const report = (message) => onProgress?.(message);
  const tmpPath = join(tmpdir(), `netcar-deploy-${Date.now()}.tar`);

  return new Promise((resolve, reject) => {
    const out = createWriteStream(tmpPath);
    const tar = spawn('tar', tarSpawnArgs(), {
      cwd: localDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let tarStderr = '';
    let packed = 0;
    let lastLog = Date.now();

    tar.stderr.on('data', (chunk) => {
      tarStderr += chunk;
    });

    tar.stdout.on('data', (chunk) => {
      packed += chunk.length;
      const now = Date.now();
      if (now - lastLog >= 2000) {
        report(`   Compactando… ${formatMb(packed)}`);
        lastLog = now;
      }
    });

    tar.stdout.pipe(out);

    out.on('error', reject);
    tar.on('error', reject);

    tar.on('close', (code) => {
      if (code !== 0) {
        try {
          unlinkSync(tmpPath);
        } catch (e) {}
        reject(new Error(tarStderr.trim() || `tar local exit ${code}`));
      }
    });

    out.on('finish', () => {
      const size = statSync(tmpPath).size;
      report(`   Pacote pronto: ${formatMb(size)}`);
      resolve(tmpPath);
    });
  });
}

function uploadViaSftp(sftp, localPath, remotePath, onProgress) {
  const report = (message) => onProgress?.(message);
  const totalSize = statSync(localPath).size;
  let lastLog = Date.now();

  return new Promise((resolve, reject) => {
    sftp.fastPut(
      localPath,
      remotePath,
      {
        concurrency: 16,
        chunkSize: 64 * 1024,
        step: (transferred) => {
          const now = Date.now();
          if (now - lastLog >= 1500) {
            const pct = totalSize ? Math.min(100, Math.round((transferred / totalSize) * 100)) : 0;
            report(`   Upload ${pct}% (${formatMb(transferred)} / ${formatMb(totalSize)})`);
            lastLog = now;
          }
        },
      },
      (err) => {
        if (err) reject(err);
        else {
          report(`   Upload 100% (${formatMb(totalSize)})`);
          resolve();
        }
      }
    );
  });
}

/**
 * Deploy dist/ via SSH com senha (SFTP — estável no Windows, sem travar no stdin).
 */
export async function deployTarViaSshPassword({
  host,
  user,
  password,
  remoteDir,
  localDir,
  onProgress,
}) {
  const report = (message) => onProgress?.(message);
  const remotePath = String(remoteDir || 'www').replace(/\/$/, '');
  const remoteTarName = `.netcar-deploy-${Date.now()}.tar`;

  let localTarPath = '';
  let conn;

  try {
    report('   Gerando pacote local…');
    localTarPath = await createLocalTarArchive(localDir, onProgress);

    report('   Conectando ao servidor…');
    conn = await connectSsh({ host, user, password });

    report('   Enviando via SFTP…');
    const sftp = await openSftp(conn);
    await uploadViaSftp(sftp, localTarPath, remoteTarName, onProgress);
    sftp.end();

    report('   Extraindo no servidor…');
    await execRemote(
      conn,
      [
        `mkdir -p ${remotePath}`,
        // --no-same-permissions: evita tar aplicar mode 700 do '.' do dist (Apache 403 no .htaccess)
        `tar -C ${remotePath} --no-same-owner --no-same-permissions -xf $HOME/${remoteTarName}`,
        `rm -f $HOME/${remoteTarName}`,
        `chmod 755 ${remotePath}`,
        `chmod -R a+rX ${remotePath}`,
      ].join(' && '),
      onProgress
    );

    report(`   Deploy finalizado (${formatMb(statSync(localTarPath).size)} enviados)`);
  } finally {
    if (localTarPath) {
      try {
        unlinkSync(localTarPath);
      } catch (e) {}
    }
    if (conn) {
      conn.end();
    }
  }
}

/**
 * Instala chave pública no authorized_keys (substitui ssh-copy-id sem sshpass).
 */
export async function installSshPublicKey({ host, user, password, publicKeyPath }) {
  const publicKey = readFileSync(publicKeyPath, 'utf-8').trim();
  if (!publicKey) {
    throw new Error('Arquivo .pub vazio');
  }

  const escapedKey = publicKey.replace(/'/g, `'\\''`);
  const remoteCommand =
    "mkdir -p ~/.ssh && chmod 700 ~/.ssh && " +
    `grep -qxF '${escapedKey}' ~/.ssh/authorized_keys 2>/dev/null || ` +
    `echo '${escapedKey}' >> ~/.ssh/authorized_keys && ` +
    'chmod 600 ~/.ssh/authorized_keys';

  const conn = await connectSsh({ host, user, password });
  try {
    await execRemote(conn, remoteCommand);
  } finally {
    conn.end();
  }
}
