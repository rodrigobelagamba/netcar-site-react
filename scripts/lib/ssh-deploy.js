import { spawn } from 'child_process';
import { createWriteStream, existsSync, lstatSync, readdirSync, readFileSync, statSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, posix } from 'path';
import { Client } from 'ssh2';

// Runtime deliveries belong to the publisher, never to a build or dist rollback.
const TAR_EXCLUDES = ['.git', '.gitignore', '.git-commit-msg.txt',
  'entregas-data/live.json', 'entregas-data/.publish.lock',
  'entregas-data/.entregas-*', 'entregas-media/live'];

export function isDeliveryRuntimePath(path) {
  const normalized = String(path).replaceAll('\\', '/').replace(/^(\.\/)+/, '');
  return normalized === 'entregas-data/live.json'
    || normalized === 'entregas-data/.publish.lock'
    || normalized.startsWith('entregas-data/.entregas-')
    || normalized === 'entregas-media/live'
    || normalized.startsWith('entregas-media/live/');
}

// Permission changes have a narrower scope than uploads: even the delivery
// seed and directory rules must retain their runtime-managed permissions.
function excludesBuildPermissions(path) {
  return path === 'entregas-data' || path.startsWith('entregas-data/')
    || path === 'entregas-media/live' || path.startsWith('entregas-media/live/')
    || path.split('/').some((part) => ['.git', '.gitignore', '.git-commit-msg.txt'].includes(part));
}

function assertRelativeBuildPath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/')
      || /[\\\x00-\x1f\x7f]/.test(path)
      || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Caminho inválido no manifesto de permissões do build');
  }
}

/** Snapshot only public build entries, before packing; never traverse runtime. */
export function collectBuildPermissionTargets(localDir) {
  if (!lstatSync(localDir).isDirectory()) throw new Error('Diretório do build inválido');
  const targets = [];
  const walk = (relativeDir) => {
    for (const name of readdirSync(join(localDir, relativeDir)).sort()) {
      const path = relativeDir ? `${relativeDir}/${name}` : name;
      assertRelativeBuildPath(path);
      if (excludesBuildPermissions(path)) continue;
      const stat = lstatSync(join(localDir, path));
      if (!stat.isDirectory() && !stat.isFile()) {
        throw new Error(`Entrada não regular no build: ${path}`);
      }
      targets.push({ path, directory: stat.isDirectory() });
      if (stat.isDirectory()) walk(path);
    }
  };
  walk('');
  return targets;
}

function sftpCall(sftp, method, ...args) {
  return new Promise((resolve, reject) => {
    sftp[method](...args, (error, result) => error ? reject(error) : resolve(result));
  });
}

/** Equivalent to chmod a+rX, limited to the validated local build manifest. */
export async function normalizeBuildPermissions(sftp, remoteDir, targets) {
  const entries = targets.filter((target) => {
    assertRelativeBuildPath(target.path);
    if (typeof target.directory !== 'boolean') throw new Error('Tipo inválido no manifesto de permissões');
    return !excludesBuildPermissions(target.path);
  });
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  if (byPath.size !== entries.length) throw new Error('Caminhos duplicados no manifesto de permissões');
  for (const entry of entries) {
    let parent = posix.dirname(entry.path);
    while (parent !== '.') {
      if (!byPath.get(parent)?.directory) throw new Error(`Diretório ausente no manifesto: ${parent}`);
      parent = posix.dirname(parent);
    }
  }

  // The configured document root may itself be a hosting-managed symlink.
  // Resolve it once, then reject symlinks everywhere inside that exact root.
  const root = await sftpCall(sftp, 'realpath', remoteDir);
  if (typeof root !== 'string' || !root.startsWith('/') || root === '/'
      || posix.normalize(root) !== root || /[\\\x00-\x1f\x7f]/.test(root)) {
    throw new Error('Raiz remota inválida para normalização de permissões');
  }
  const rootStat = await sftpCall(sftp, 'lstat', root);
  if (!rootStat.isDirectory()) throw new Error('Raiz remota não é um diretório');

  const normalize = async ({ path, directory }) => {
    const remoteFile = posix.join(root, path);
    const stat = await sftpCall(sftp, 'lstat', remoteFile);
    if (directory ? !stat.isDirectory() : !stat.isFile()) {
      throw new Error(`Entrada remota não corresponde ao build: ${path}`);
    }
    if (!Number.isInteger(stat.mode)) throw new Error(`Permissões remotas ausentes: ${path}`);
    const currentMode = stat.mode & 0o7777;
    const nextMode = currentMode | 0o444 | (directory || (currentMode & 0o111) ? 0o111 : 0);
    if (nextMode !== currentMode) await sftpCall(sftp, 'chmod', remoteFile, nextMode);
  };

  // Validate and open parent directories before any child path is accessed.
  const directories = entries.filter((entry) => entry.directory)
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const entry of directories) await normalize(entry);

  const files = entries.filter((entry) => !entry.directory);
  let next = 0;
  let failure;
  await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
    while (!failure && next < files.length) {
      const entry = files[next++];
      try { await normalize(entry); } catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
  return entries.length;
}

/** Full-site deployments must retain the already-public /entregas feature. */
export function assertDeliveryGalleryBuild(localDir) {
  const fail = (reason) => {
    throw new Error(`Deploy bloqueado: pacote sem galeria /entregas íntegra (${reason}). Integre a galeria na branch canônica e gere um novo build; um dist antigo não pode remover a página publicada.`);
  };
  const read = (name) => {
    if (typeof name !== 'string' || name.startsWith('/') || name.includes('\\')
        || posix.normalize(name) !== name || name.startsWith('../')
        || !existsSync(join(localDir, name)) || !statSync(join(localDir, name)).isFile()) fail(`arquivo ausente ou inválido: ${name}`);
    return readFileSync(join(localDir, name), 'utf8');
  };
  const parse = (name) => {
    try { return JSON.parse(read(name)); } catch { fail(`JSON inválido: ${name}`); }
  };
  const php = read('index.php');
  if (!/\$path\s*===\s*['"]\/entregas['"]/.test(php)
      || !php.includes('/entregas/v1/seo.php') || !php.includes('entregas_inject_initial_html')) fail('rota e HTML inicial PHP');
  if (!read('.htaccess').includes('RewriteRule ^entregas/?$ index.php')) fail('rota Apache');
  const directoryRules = read('entregas/.htaccess');
  if (!/DirectorySlash\s+Off/.test(directoryRules) || !directoryRules.includes('AllowNoSlash')
      || !directoryRules.includes('^/entregas/?$')) fail('rota do diretório /entregas');
  for (const file of ['lib.php', 'seo.php', 'feed.php', 'publish.php', 'status.php']) read(`entregas/v1/${file}`);
  const seed = parse('entregas-data/seed.json');
  if (!Array.isArray(seed?.deliveries) || !seed.deliveries.length
      || seed.deliveries.some((item) => !item?.id || typeof item.imageUrl !== 'string')) fail('histórico seed vazio ou inválido');

  const manifest = parse('.vite/manifest.json');
  const galleryKey = 'src/modules/entregas/pages/EntregasPage.tsx';
  if (!manifest?.['index.html']?.isEntry || !manifest?.[galleryKey]) fail('entrada da galeria no manifest');
  const html = read('index.html');
  if (!html.includes(manifest['index.html'].file)) fail('HTML e manifest de builds diferentes');
  const visited = new Set();
  const inspect = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry || typeof entry.file !== 'string') fail(`dependência ausente: ${key}`);
    read(entry.file);
    for (const asset of [...(entry.css || []), ...(entry.assets || [])]) read(asset);
    for (const dependency of [...(entry.imports || []), ...(entry.dynamicImports || [])]) inspect(dependency);
  };
  inspect('index.html');
  if (!visited.has(galleryKey)) fail('galeria desconectada do aplicativo');
  if (![...visited].some((key) => /['"]\/entregas['"]/.test(read(manifest[key].file)))) fail('rota /entregas no JavaScript');
  return { deliveries: seed.deliveries.length, chunks: visited.size };
}

function tarSpawnArgs() {
  return [...TAR_EXCLUDES.flatMap((name) => ['--exclude', name]), '-cf', '-', '.'];
}

export function tarExcludeShellFlags() {
  return TAR_EXCLUDES.map((name) => `--exclude=${name}`).join(' ');
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSshError(error) {
  if (!error) return 'erro SSH desconhecido';
  if (typeof error === 'string') return error;
  const parts = [
    error.message,
    error.level ? `level=${error.level}` : '',
    error.code ? `code=${error.code}` : '',
    error.description ? `desc=${error.description}` : '',
  ].filter(Boolean);
  return parts.join(' | ') || String(error);
}

function connectSshOnce({ host, user, password }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => resolve(conn));
    conn.on('error', (error) => {
      reject(new Error(formatSshError(error)));
    });

    conn.connect({
      host,
      username: user,
      password,
      readyTimeout: 45000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 3,
      // KingHost às vezes falha handshake na 1ª tentativa
      tryKeyboard: false,
    });
  });
}

async function connectSsh({ host, user, password, retries = 3 }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await connectSshOnce({ host, user, password });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastError || new Error('Falha SSH sem detalhe');
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

async function pruneRemoteTeamPhotos(conn, remotePath, localDir, onProgress) {
  const teamDir = join(localDir, 'team');
  if (!existsSync(teamDir)) return;

  const keep = readdirSync(teamDir).filter(
    (name) => statSync(join(teamDir, name)).isFile() && /^[A-Za-z0-9._-]+$/.test(name)
  );
  if (!keep.length) return;

  const keepList = keep.join(' ');
  onProgress?.('   Removendo fotos de equipe que saíram do build…');
  await execRemote(
    conn,
    `cd ${remotePath}/team && for f in *; do [ -f "$f" ] || continue; case " ${keepList} " in *" $f "*) ;; *) rm -f -- "$f" ;; esac; done`,
    onProgress
  );
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
  assertDeliveryGalleryBuild(localDir);
  const permissionTargets = collectBuildPermissionTargets(localDir);
  const report = (message) => onProgress?.(message);
  const remotePath = String(remoteDir || 'www').replace(/\/$/, '');
  const remoteTarName = `.netcar-deploy-${Date.now()}.tar`;

  let localTarPath = '';
  let conn;
  let sftp;

  try {
    report('   Gerando pacote local…');
    localTarPath = await createLocalTarArchive(localDir, onProgress);

    if (!password) {
      throw new Error(
        'SSH_PASSWORD vazio — configure no .env.local / secrets do devops',
      );
    }

    report('   Conectando ao servidor…');
    try {
      conn = await connectSsh({ host, user, password });
    } catch (error) {
      throw new Error(`Falha ao conectar SSH: ${formatSshError(error)}`);
    }

    report('   Enviando via SFTP…');
    sftp = await openSftp(conn);
    await uploadViaSftp(sftp, localTarPath, remoteTarName, onProgress);

    report('   Extraindo no servidor…');
    await execRemote(
      conn,
      [
        `mkdir -p ${remotePath}`,
        // --no-same-permissions: evita tar aplicar mode 700 do '.' do dist (Apache 403 no .htaccess)
        `tar -C ${remotePath} --no-same-owner --no-same-permissions -xf $HOME/${remoteTarName}`,
        `rm -f $HOME/${remoteTarName}`,
        `chmod 755 ${remotePath}`,
      ].join(' && '),
      onProgress
    );

    report('   Ajustando permissões dos arquivos do build via SFTP…');
    const normalized = await normalizeBuildPermissions(sftp, remotePath, permissionTargets);
    report(`   Permissões verificadas: ${normalized} arquivos e diretórios do build`);

    await pruneRemoteTeamPhotos(conn, remotePath, localDir, onProgress);

    report(`   Deploy finalizado (${formatMb(statSync(localTarPath).size)} enviados)`);
  } finally {
    if (sftp) sftp.end();
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
