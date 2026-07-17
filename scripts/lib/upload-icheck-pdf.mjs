import { Client } from "ssh2";
import { readFileSync, statSync } from "node:fs";

function connectSsh({ host, user, password, privateKey }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolve(conn));
    conn.on("error", reject);
    const config = {
      host,
      username: user,
      readyTimeout: 30000,
    };
    if (privateKey) config.privateKey = privateKey;
    else config.password = password;
    conn.connect(config);
  });
}

function execRemote(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let stderr = "";
      let stdout = "";
      stream.on("data", (chunk) => {
        stdout += chunk;
      });
      stream.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      stream.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || stdout.trim() || `exit ${code}`));
          return;
        }
        resolve(stdout);
      });
    });
  });
}

/**
 * Backup remoto `.bak` e sobrescreve o PDF em arquivos/autocheck/.
 */
export async function uploadIcheckPdf({
  localPath,
  remoteFileName,
  host,
  user,
  password,
  privateKey,
  remoteBaseDir,
  onProgress,
}) {
  const report = (msg) => onProgress?.(msg);
  const remoteDir = String(remoteBaseDir || "www").replace(/\/$/, "");
  const remotePath = `${remoteDir}/arquivos/autocheck/${remoteFileName}`;
  const tmpName = `.icheck-upload-${Date.now()}.pdf`;

  report(`   Conectando ${user}@${host}…`);
  const conn = await connectSsh({ host, user, password, privateKey });

  try {
    report("   Enviando PDF via SFTP…");
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
    });

    await new Promise((resolve, reject) => {
      sftp.fastPut(localPath, tmpName, (err) => (err ? reject(err) : resolve()));
    });
    sftp.end();

    report("   Backup .bak + replace no servidor…");
    await execRemote(
      conn,
      [
        `mkdir -p ${remoteDir}/arquivos/autocheck`,
        `if [ -f ${remotePath} ]; then cp -f ${remotePath} ${remotePath}.bak; fi`,
        `mv -f $HOME/${tmpName} ${remotePath}`,
        `chmod 644 ${remotePath}`,
      ].join(" && "),
    );

    report(
      `   Remoto atualizado: ${remotePath} (${(statSync(localPath).size / 1024).toFixed(0)} KB)`,
    );
  } finally {
    conn.end();
  }
}

export function loadDeployEnv(env = process.env) {
  const host = env.SSH_HOST || env.DEPLOY_SSH_HOST;
  const user = env.SSH_USER || env.DEPLOY_SSH_USER;
  const password = env.SSH_PASSWORD || env.DEPLOY_SSH_PASSWORD;
  const keyPath =
    env.SSH_KEY || env.SSH_KEY_PATH || env.DEPLOY_SSH_KEY || env.DEPLOY_SSH_KEY_PATH;
  const remoteBaseDir =
    env.SSH_REMOTE_DIR ||
    env.DEPLOY_REMOTE_DIR ||
    env.SSH_DIR ||
    env.DEPLOY_SSH_DIR ||
    "www";
  const privateKey = keyPath ? readFileSync(keyPath) : undefined;

  if (!host || !user || (!password && !privateKey)) {
    throw new Error(
      "Deploy precisa de SSH_HOST, SSH_USER e SSH_PASSWORD (ou SSH_KEY). Veja .env.local / secrets.",
    );
  }

  return {
    host,
    user,
    password,
    privateKey,
    remoteBaseDir: String(remoteBaseDir).replace(/\/$/, ""),
  };
}
