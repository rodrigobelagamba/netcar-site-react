#!/usr/bin/env node

/**
 * Autoriza, uma unica vez, a chave publica do deploy social na KingHost.
 * A conexao por senha so e aceita quando a chave do host confere com o
 * fingerprint SHA-256 fixado pelo painel/known_hosts.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Client } from "ssh2";

function requiredEnv(name, trim = true) {
  const raw = String(process.env[name] ?? "");
  const value = trim ? raw.trim() : raw;
  if (value === "") throw new Error(`${name} ausente.`);
  return value;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function normalizeFingerprint(value) {
  if (!/^SHA256:[A-Za-z0-9+/]{43}=?$/.test(value)) {
    throw new Error("KINGHOST_SSH_HOST_FINGERPRINT invalido.");
  }
  return value.replace(/=+$/, "");
}

function normalizePublicKey(value) {
  const match = value.match(
    /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) ([A-Za-z0-9+/]+={0,3})(?: [A-Za-z0-9@._-]{1,128})?$/,
  );
  if (!match) throw new Error("KINGHOST_DEPLOY_PUBLIC_KEY invalida.");

  const decoded = Buffer.from(match[2], "base64");
  if (decoded.length < 32 || decoded.toString("base64") !== match[2]) {
    throw new Error("KINGHOST_DEPLOY_PUBLIC_KEY possui payload invalido.");
  }
  return `${match[1]} ${match[2]}`;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function execRemote(connection, command) {
  return new Promise((resolve, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let stdout = "";
      let stderr = "";
      stream.on("data", (chunk) => {
        stdout += chunk;
      });
      stream.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      stream.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else
          reject(new Error(stderr.trim() || `Comando remoto falhou: ${code}`));
      });
    });
  });
}

function connectPinned({ host, user, password, fingerprint }) {
  return new Promise((resolve, reject) => {
    const connection = new Client();
    let observedFingerprint = "";
    let settled = false;

    connection.once("ready", () => {
      settled = true;
      resolve(connection);
    });
    connection.once("error", (error) => {
      if (settled) return;
      if (
        observedFingerprint !== "" &&
        !constantTimeEqual(observedFingerprint, fingerprint)
      ) {
        reject(new Error("Fingerprint SSH da KingHost nao confere."));
        return;
      }
      reject(new Error(`Falha na autenticacao SSH: ${error.message}`));
    });

    connection.connect({
      host,
      port: 22,
      username: user,
      password,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      keepaliveCountMax: 2,
      hostVerifier: (hostKey) => {
        observedFingerprint = `SHA256:${createHash("sha256")
          .update(hostKey)
          .digest("base64")
          .replace(/=+$/, "")}`;
        return constantTimeEqual(observedFingerprint, fingerprint);
      },
    });
  });
}

async function main() {
  const host = requiredEnv("KINGHOST_SSH_HOST");
  const user = requiredEnv("KINGHOST_SSH_USER");
  const password = requiredEnv("KINGHOST_SSH_PASSWORD", false);
  const fingerprint = normalizeFingerprint(
    requiredEnv("KINGHOST_SSH_HOST_FINGERPRINT"),
  );
  const publicKey = normalizePublicKey(
    requiredEnv("KINGHOST_DEPLOY_PUBLIC_KEY"),
  );

  if (
    !/^[A-Za-z0-9.-]+$/.test(host) ||
    host.startsWith("-") ||
    host.includes("..")
  ) {
    throw new Error("KINGHOST_SSH_HOST invalido.");
  }
  if (!/^[A-Za-z0-9._-]+$/.test(user) || user.startsWith("-")) {
    throw new Error("KINGHOST_SSH_USER invalido.");
  }

  const release = `${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")}-${randomBytes(4).toString("hex")}`;
  const key = shellQuote(publicKey);
  const command = [
    "set -eu",
    "umask 077",
    'SSH_DIR="$HOME/.ssh"',
    'AUTHORIZED="$SSH_DIR/authorized_keys"',
    `PENDING="$SSH_DIR/.authorized_keys.pending-${release}"`,
    `BACKUP="$SSH_DIR/authorized_keys.before-netcar-${release}.bkp"`,
    'if [ -L "$SSH_DIR" ]; then echo "Diretorio .ssh inseguro." >&2; exit 1; fi',
    'mkdir -p "$SSH_DIR"',
    'chmod 700 "$SSH_DIR"',
    'if [ -L "$AUTHORIZED" ] || { [ -e "$AUTHORIZED" ] && [ ! -f "$AUTHORIZED" ]; }; then',
    '  echo "authorized_keys nao e arquivo regular." >&2',
    "  exit 1",
    "fi",
    "trap 'rm -f \"$PENDING\"' 0 1 2 15",
    'if [ -f "$AUTHORIZED" ]; then',
    '  cp -p "$AUTHORIZED" "$BACKUP"',
    '  cp -p "$AUTHORIZED" "$PENDING"',
    "else",
    '  : > "$PENDING"',
    "fi",
    `if ! grep -qxF ${key} "$PENDING" 2>/dev/null; then`,
    `  printf '%s\\n' ${key} >> "$PENDING"`,
    "fi",
    'chmod 600 "$PENDING"',
    `grep -qxF ${key} "$PENDING"`,
    'mv -f "$PENDING" "$AUTHORIZED"',
    'chmod 600 "$AUTHORIZED"',
    `grep -qxF ${key} "$AUTHORIZED"`,
    "trap - 0 1 2 15",
    'echo "authorized=true"',
  ].join("\n");

  const connection = await connectPinned({
    host,
    user,
    password,
    fingerprint,
  });
  try {
    const result = await execRemote(connection, command);
    if (result !== "authorized=true") {
      throw new Error("Confirmacao remota inesperada.");
    }
  } finally {
    connection.end();
  }

  console.log("KingHost deployment key authorized.");
}

main().catch((error) => {
  console.error(`Falha: ${error.message}`);
  process.exitCode = 1;
});
