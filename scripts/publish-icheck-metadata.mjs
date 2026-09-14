#!/usr/bin/env node
// Publica somente os resultados derivados. Nunca altera certificados PDF.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Client } from "ssh2";

export function metadataForPublication(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".meta.json"))
    .map((name) => {
      if (
        !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.meta\.json$/.test(name) ||
        name.includes("..")
      )
        throw new Error("Nome de metadado inválido.");
      const bytes = readFileSync(join(directory, name));
      const data = JSON.parse(bytes.toString("utf8"));
      if (
        data.schemaVersion !== 2 ||
        !/^\d+$/.test(String(data.vehicleId)) ||
        !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(data.placa || "") ||
        typeof data.pdf !== "string" ||
        !/\.pdf$/i.test(data.pdf) ||
        data.pdf.replace(/\.pdf$/i, ".meta.json") !== name ||
        !Array.isArray(data.history) ||
        data.history.length !== 4 ||
        !["checkauto-pdf", "unavailable"].includes(data.source) ||
        (data.available === true &&
          !/^[a-f0-9]{64}$/.test(data.sourceSha256 || "")) ||
        data.sourcePath
      )
        throw new Error(`Metadado fora do contrato: ${name}`);
      return { name, bytes, data };
    });
}

export function envFile(file) {
  if (!file || !existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!m) return [];
        return [[m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]];
      }),
  );
}

const fingerprintOf = (key) =>
  `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
const HOST_ALGORITHMS = {
  "ssh-ed25519": ["ssh-ed25519"],
  "ecdsa-sha2-nistp256": ["ecdsa-sha2-nistp256"],
  "ecdsa-sha2-nistp384": ["ecdsa-sha2-nistp384"],
  "ecdsa-sha2-nistp521": ["ecdsa-sha2-nistp521"],
  "ssh-rsa": ["rsa-sha2-512", "rsa-sha2-256", "ssh-rsa"],
};
function stagedError(code, stage) {
  return Object.assign(new Error(code), { code, icheckStage: stage });
}
export function withDiagnosticStage(error, stage) {
  if (!error.icheckStage) error.icheckStage = stage;
  return error;
}
export function safeDiagnostic(error, fallbackStage = "configuration") {
  const stages = [
    "arguments",
    "prepare_metadata",
    "prepare_release",
    "configuration",
    "host_key_scan",
    "ssh_connect",
    "sftp_open",
    "sftp_stat",
    "backup",
    "upload",
    "verify",
    "rollback",
  ];
  const knownCodes = [
    "EACCES",
    "ENOENT",
    "ENOTDIR",
    "EISDIR",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "HOST_KEY_PIN_MISMATCH",
    "HOST_KEY_SCAN_FAILED",
    "PIN_NOT_CONFIGURED",
    "INVALID_CONFIGURATION",
    "CREDENTIAL_UNAVAILABLE",
  ];
  let code = knownCodes.includes(error?.code) ? error.code : "UNCLASSIFIED";
  if (typeof error?.code === "number")
    code =
      {
        2: "SFTP_NO_SUCH_FILE",
        3: "SFTP_PERMISSION_DENIED",
        4: "SFTP_FAILURE",
        8: "SFTP_UNSUPPORTED",
      }[error.code] || "SFTP_ERROR";
  if (
    code === "UNCLASSIFIED" &&
    /All configured authentication methods failed/i.test(String(error?.message))
  )
    code = "AUTHENTICATION_FAILED";
  if (
    code === "UNCLASSIFIED" &&
    /Host denied|host key.*(?:fail|reject)|verification failed/i.test(
      String(error?.message),
    )
  )
    code = "HOST_KEY_REJECTED";
  if (
    code === "UNCLASSIFIED" &&
    /no matching host key format|handshake failed/i.test(String(error?.message))
  )
    code = "SSH_HANDSHAKE_FAILED";
  const stage = stages.includes(error?.icheckStage)
    ? error.icheckStage
    : stages.includes(fallbackStage)
      ? fallbackStage
      : "configuration";
  return { stage, code };
}

/** The scan is untrusted discovery: only a key matching a preconfigured pin may select algorithms. */
export function pinnedHostAlgorithms(lines, pins) {
  const algorithms = new Set();
  for (const line of String(lines || "").split(/\r?\n/)) {
    if (
      !line.trim() ||
      line.trim().startsWith("#") ||
      line.trim().startsWith("@")
    )
      continue;
    const [, advertisedType, encoded] = line.trim().split(/\s+/);
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) continue;
    const key = Buffer.from(encoded, "base64");
    if (key.length < 4 || !pins.includes(fingerprintOf(key))) continue;
    const length = key.readUInt32BE(0);
    if (length > key.length - 4) continue;
    const keyType = key.subarray(4, 4 + length).toString("ascii");
    if (advertisedType !== keyType || !HOST_ALGORITHMS[keyType]) continue;
    for (const algorithm of HOST_ALGORITHMS[keyType]) algorithms.add(algorithm);
  }
  if (!algorithms.size)
    throw stagedError("HOST_KEY_PIN_MISMATCH", "host_key_scan");
  return [...algorithms];
}
function scanHostKeys(host, port) {
  const result = spawnSync(
    "ssh-keyscan",
    ["-T", "15", "-p", String(port), "-t", "ed25519,ecdsa,rsa", host],
    {
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.error || !result.stdout?.trim())
    throw stagedError("HOST_KEY_SCAN_FAILED", "host_key_scan");
  return result.stdout;
}

export function deploymentConfiguration(env = process.env, dependencies = {}) {
  const host = env.SSH_HOST || "netcarmultimarcas.com.br";
  const username = env.SSH_USER || "netcarmultimarcas";
  const root = (env.SSH_DIR || "www").replace(/\/$/, "");
  const port = env.SSH_PORT ? Number(env.SSH_PORT) : 22;
  if (
    !/^[A-Za-z0-9.-]+$/.test(host) ||
    host.startsWith("-") ||
    host.includes("..") ||
    !/^[A-Za-z0-9_-]+$/.test(username) ||
    username.startsWith("-") ||
    !/^[A-Za-z0-9_/-]+$/.test(root) ||
    root.includes("..") ||
    root.startsWith("-") ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw stagedError("INVALID_CONFIGURATION", "configuration");
  const pins = [];
  let trustedLines = "";
  if (env.SSH_HOST_FINGERPRINT)
    pins.push(env.SSH_HOST_FINGERPRINT.replace(/=+$/, ""));
  const known =
    env.SSH_KNOWN_HOSTS_PATH || join(homedir(), ".ssh", "known_hosts");
  if (!pins.length && existsSync(known)) {
    const lookup = port === 22 ? host : `[${host}]:${port}`;
    const result = spawnSync("ssh-keygen", ["-F", lookup, "-f", known], {
      encoding: "utf8",
    });
    trustedLines = result.stdout || "";
    for (const line of trustedLines.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("@")) continue;
      const key = line.trim().split(/\s+/)[2];
      if (key) pins.push(fingerprintOf(Buffer.from(key, "base64")));
    }
  }
  if (
    !pins.length ||
    pins.some((pin) => !/^SHA256:[A-Za-z0-9+/]{43}$/.test(pin))
  )
    throw stagedError("PIN_NOT_CONFIGURED", "configuration");
  const keyPath =
    env.SSH_KEY_PATH ||
    (!env.SSH_PASSWORD
      ? ["id_netcar", "id_ed25519"]
          .map((name) => join(homedir(), ".ssh", name))
          .find(existsSync)
      : undefined);
  const privateKey = keyPath ? readFileSync(keyPath) : undefined;
  if (!env.SSH_PASSWORD && !privateKey)
    throw stagedError("CREDENTIAL_UNAVAILABLE", "configuration");
  dependencies.onStage?.("host_key_scan");
  const candidates =
    trustedLines || (dependencies.scanHostKeys || scanHostKeys)(host, port);
  const algorithms = pinnedHostAlgorithms(candidates, pins);
  return {
    remoteDirectory: posix.join(root, "arquivos/autocheck"),
    ssh: {
      host,
      port,
      username,
      ...(privateKey ? { privateKey } : { password: env.SSH_PASSWORD }),
      readyTimeout: 30_000,
      keepaliveInterval: 10_000,
      algorithms: { serverHostKey: algorithms },
      hostVerifier: (key) => pins.includes(fingerprintOf(key)),
    },
  };
}

const invoke = (target, method, ...args) =>
  new Promise((resolvePromise, reject) => {
    target[method](...args, (error, result) =>
      error ? reject(error) : resolvePromise(result),
    );
  });

export async function publishMetadata(files, config) {
  const connection = new Client();
  let sftp;
  let stage = "ssh_connect";
  try {
    await new Promise((resolvePromise, reject) => {
      connection.once("ready", resolvePromise);
      connection.once("error", reject);
      connection.connect(config.ssh);
    });
    stage = "sftp_open";
    sftp = await invoke(connection, "sftp");
    let uploaded = 0;
    stage = "upload";
    for (const { name, bytes } of files) {
      const final = posix.join(config.remoteDirectory, name);
      const temporary = posix.join(
        config.remoteDirectory,
        `.icheck-${randomUUID()}.tmp`,
      );
      await invoke(sftp, "writeFile", temporary, bytes, { mode: 0o644 });
      try {
        // OpenSSH rename substitui atomicamente sem deixar JSON parcial público.
        await invoke(sftp, "ext_openssh_rename", temporary, final);
      } catch (error) {
        await invoke(sftp, "unlink", temporary).catch(() => {});
        throw error;
      }
      uploaded += 1;
    }
    return { uploaded };
  } catch (error) {
    throw withDiagnosticStage(error, stage);
  } finally {
    sftp?.end();
    connection.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (const arg of args) {
    const m = arg.match(/^--(directory|env-file)=(.+)$/);
    if (!m)
      throw new Error(
        "Use --directory=pasta e, opcionalmente, --env-file=arquivo.",
      );
    options[m[1]] = m[2];
  }
  if (!options.directory)
    throw new Error("Informe a pasta de metadados recém-gerados.");
  let files;
  try {
    files = metadataForPublication(resolve(options.directory));
  } catch (error) {
    throw withDiagnosticStage(error, "prepare_metadata");
  }
  if (!files.length) throw new Error("Nenhum metadado validado para publicar.");
  const config = deploymentConfiguration({
    ...envFile(options["env-file"]),
    ...process.env,
  });
  const result = await publishMetadata(files, config);
  console.log(JSON.stringify({ success: true, ...result }));
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    // Erros de conexão/servidor podem incluir detalhes privados; não os retransmitir no CI.
    console.error(
      "Publicação dos metadados falhou. Certificados de origem preservados.",
    );
    console.error(JSON.stringify(safeDiagnostic(error)));
    process.exitCode = 1;
  });
}
