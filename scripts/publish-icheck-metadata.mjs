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

export function deploymentConfiguration(env = process.env) {
  const host = env.SSH_HOST || "netcarmultimarcas.com.br";
  const username = env.SSH_USER || "netcarmultimarcas";
  const root = (env.SSH_DIR || "www").replace(/\/$/, "");
  if (
    !/^[A-Za-z0-9.-]+$/.test(host) ||
    !/^[A-Za-z0-9_-]+$/.test(username) ||
    !/^[A-Za-z0-9_/-]+$/.test(root) ||
    root.includes("..") ||
    root.startsWith("-")
  ) {
    throw new Error("Configuração de destino inválida.");
  }
  const pins = [];
  if (env.SSH_HOST_FINGERPRINT)
    pins.push(env.SSH_HOST_FINGERPRINT.replace(/=+$/, ""));
  const known =
    env.SSH_KNOWN_HOSTS_PATH || join(homedir(), ".ssh", "known_hosts");
  if (!pins.length && existsSync(known)) {
    const result = spawnSync("ssh-keygen", ["-F", host, "-f", known], {
      encoding: "utf8",
    });
    for (const line of (result.stdout || "").split(/\r?\n/)) {
      if (!line || line.startsWith("#") || line.startsWith("@")) continue;
      const key = line.trim().split(/\s+/)[2];
      if (key)
        pins.push(
          `SHA256:${createHash("sha256").update(Buffer.from(key, "base64")).digest("base64").replace(/=+$/, "")}`,
        );
    }
  }
  if (!pins.length || pins.some((p) => !/^SHA256:[A-Za-z0-9+/]{43}$/.test(p))) {
    throw new Error("Fingerprint SSH do destino não configurado.");
  }
  const keyPath =
    env.SSH_KEY_PATH ||
    (!env.SSH_PASSWORD
      ? ["id_netcar", "id_ed25519"]
          .map((name) => join(homedir(), ".ssh", name))
          .find(existsSync)
      : undefined);
  const privateKey = keyPath ? readFileSync(keyPath) : undefined;
  if (!env.SSH_PASSWORD && !privateKey)
    throw new Error("Credencial de deploy indisponível.");
  return {
    remoteDirectory: posix.join(root, "arquivos/autocheck"),
    ssh: {
      host,
      username,
      ...(privateKey ? { privateKey } : { password: env.SSH_PASSWORD }),
      readyTimeout: 30_000,
      keepaliveInterval: 10_000,
      hostVerifier: (key) =>
        pins.includes(
          `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`,
        ),
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
  try {
    await new Promise((resolvePromise, reject) => {
      connection.once("ready", resolvePromise);
      connection.once("error", reject);
      connection.connect(config.ssh);
    });
    sftp = await invoke(connection, "sftp");
    let uploaded = 0;
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
  const files = metadataForPublication(resolve(options.directory));
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
  main().catch(() => {
    // Erros de conexão/servidor podem incluir detalhes privados; não os retransmitir no CI.
    console.error(
      "Publicação dos metadados falhou. Certificados de origem preservados.",
    );
    process.exitCode = 1;
  });
}
