#!/usr/bin/env node

/**
 * Deploy parcial e transacional de docs/social para a KingHost.
 *
 * Por seguranca, o comando apenas mostra o plano ate receber --apply.
 * Nunca envia social-config.php, tokens, cache, seeds ou o restante do site.
 */

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { resolve, dirname, posix as pathPosix } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { spawn } from "child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "docs/social");

// Pacote coerente da nova publicacao Instagram -> GBP, incluindo a protecao e
// todo o fluxo OAuth/token/config que mudou junto com ela. Arquivos de segredo,
// cache, seeds e testes ficam deliberadamente fora.
const manifest = [
  "data/.htaccess",
  "lib/SocialEnv.php",
  "lib/TokenStore.php",
  "lib/OAuthStateStore.php",
  "lib/GoogleOAuth.php",
  "lib/MetaOAuth.php",
  "lib/InstagramFeedClient.php",
  "lib/GoogleLocalPostsClient.php",
  "lib/InstagramPostMediaCache.php",
  "lib/InstagramGbpPostFactory.php",
  "lib/GooglePostsStateStore.php",
  "lib/InstagramGbpPublisher.php",
  "lib/bootstrap.php",
  "lib/SocialSyncRunner.php",
  "social-config.example.php",
  "social-oauth.php",
  "outscraper-sync.php",
  "instagram-post-media.php",
  "sync-social.php",
];

function parseEnv(path) {
  if (!existsSync(path))
    throw new Error(`Arquivo de ambiente nao encontrado: ${path}`);
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function argValue(name) {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) return prefixed.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? "") : "";
}

function safeRelativePath(value) {
  const normalized = value.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized !== value ||
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    ) ||
    !manifest.includes(normalized)
  ) {
    throw new Error(`Arquivo fora do manifest permitido: ${value}`);
  }
  return normalized;
}

function safeRemoteRoot(value, label) {
  const raw = String(value ?? "");
  const candidate = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  const segments = candidate.split("/");
  if (
    candidate === "" ||
    raw !== raw.trim() ||
    raw.endsWith("//") ||
    candidate.includes("\\") ||
    candidate.startsWith("/") ||
    !/^[a-zA-Z0-9._/-]+$/.test(candidate) ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(
      `${label} deve ser um caminho relativo estrito, sem '.', '..' ou barras duplicadas.`,
    );
  }
  return candidate;
}

function quote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(stdout);
      else
        reject(
          new Error(
            stderr.trim() || stdout.trim() || `${command} falhou: ${code}`,
          ),
        );
    });
    child.stdin.end(options.input ?? "");
  });
}

function validateConnectionConfig(config) {
  if (
    !/^[a-zA-Z0-9._-]+$/.test(config.SSH_USER) ||
    config.SSH_USER.startsWith("-")
  ) {
    throw new Error("SSH_USER invalido.");
  }
  if (
    !/^[a-zA-Z0-9.-]+$/.test(config.SSH_HOST) ||
    config.SSH_HOST.startsWith("-") ||
    config.SSH_HOST.includes("..")
  ) {
    throw new Error("SSH_HOST invalido (use hostname ou IPv4 sem opcoes SSH).");
  }

  const port =
    config.SSH_PORT === undefined || config.SSH_PORT === ""
      ? 22
      : Number(config.SSH_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SSH_PORT invalido.");
  }
  return port;
}

function resolvePinConfig(config) {
  const cliKnownHosts = argValue("--known-hosts");
  const cliFingerprint = argValue("--host-fingerprint");
  const hasCliPin = cliKnownHosts !== "" || cliFingerprint !== "";
  const knownHosts = hasCliPin
    ? cliKnownHosts
    : (config.SSH_KNOWN_HOSTS_PATH ?? "");
  const fingerprint = hasCliPin
    ? cliFingerprint
    : (config.SSH_HOST_FINGERPRINT ?? "");

  if (knownHosts !== "" && fingerprint !== "") {
    throw new Error(
      "Configure apenas SSH_KNOWN_HOSTS_PATH ou SSH_HOST_FINGERPRINT, nao ambos.",
    );
  }
  if (knownHosts !== "") {
    const path = resolve(knownHosts);
    if (
      !existsSync(path) ||
      !lstatSync(path).isFile() ||
      readFileSync(path, "utf8").trim() === ""
    ) {
      throw new Error(`known_hosts fixado ausente ou vazio: ${path}`);
    }
    return { mode: "known-hosts", path };
  }
  if (!/^SHA256:[a-zA-Z0-9+/]{43}=?$/.test(fingerprint)) {
    throw new Error(
      "Configure SSH_KNOWN_HOSTS_PATH ou um SSH_HOST_FINGERPRINT SHA256 obtido por canal confiavel.",
    );
  }
  return { mode: "fingerprint", fingerprint };
}

async function materializeKnownHosts(pin, host, port) {
  if (pin.mode === "known-hosts") {
    return { path: pin.path, cleanup: () => {} };
  }

  const directory = mkdtempSync(resolve(tmpdir(), "netcar-known-hosts-"));
  chmodSync(directory, 0o700);
  try {
    const scan = await run("ssh-keyscan", [
      "-T",
      "15",
      "-p",
      String(port),
      "-t",
      "ed25519,ecdsa,rsa",
      host,
    ]);
    const candidates = scan
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith("#"));
    const matches = [];

    for (let index = 0; index < candidates.length; index += 1) {
      const candidatePath = resolve(directory, `candidate-${index}`);
      writeFileSync(candidatePath, `${candidates[index]}\n`, { mode: 0o600 });
      const details = await run("ssh-keygen", [
        "-E",
        "sha256",
        "-lf",
        candidatePath,
      ]);
      const found = details.match(/SHA256:[a-zA-Z0-9+/=]+/)?.[0];
      if (found === pin.fingerprint) matches.push(candidates[index]);
    }

    if (matches.length === 0) {
      throw new Error(
        `Nenhuma chave apresentada por ${host}:${port} corresponde ao fingerprint SSH fixado.`,
      );
    }

    const path = resolve(directory, "known_hosts");
    writeFileSync(path, `${matches.join("\n")}\n`, { mode: 0o600 });
    return {
      path,
      cleanup: () => rmSync(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

async function runPublisherDryRun({ config, pin, port, remoteRoot, phpBin }) {
  if (process.argv.includes("--apply") || argValue("--files") !== "") {
    throw new Error(
      "--publisher-dry-run nao pode ser combinado com --apply ou --files.",
    );
  }

  const pinnedHosts = await materializeKnownHosts(pin, config.SSH_HOST, port);
  const destination = `${config.SSH_USER}@${config.SSH_HOST}`;
  const portArgs = port === 22 ? [] : ["-p", String(port)];
  const commonSshArgs = [
    "-i",
    config.SSH_KEY_PATH,
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${pinnedHosts.path}`,
    "-o",
    "ConnectTimeout=15",
    "-o",
    "LogLevel=ERROR",
  ];

  try {
    const syncPath = pathPosix.join(remoteRoot, "social/v1/sync-social.php");
    const phpCode = [
      '$_GET["posts_only"] = "1";',
      '$_GET["dry_run"] = "1";',
      `require ${JSON.stringify(syncPath)};`,
    ].join(" ");
    const stdout = await run("ssh", [
      ...commonSshArgs,
      ...portArgs,
      destination,
      `${quote(phpBin)} -r ${quote(phpCode)}`,
    ]);

    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      throw new Error("Dry-run remoto nao devolveu JSON valido.");
    }

    const posts = result?.posts;
    if (
      result?.success !== true ||
      !posts ||
      posts.success !== true ||
      posts.dryRun !== true ||
      posts.created !== 0
    ) {
      throw new Error(
        "Dry-run remoto nao confirmou execucao segura sem criacao.",
      );
    }

    const expectedLocations = new Map([
      ["loja_1", "11161331340741727452"],
      ["loja_2", "17013442122163034193"],
    ]);
    const locations = Array.isArray(posts.locations) ? posts.locations : [];
    const returnedSlugs = new Set(
      locations.map((location) => String(location?.slug ?? "")),
    );
    const returnedIds = new Set(
      locations.map((location) => String(location?.id ?? "")),
    );
    if (
      locations.length !== expectedLocations.size ||
      returnedSlugs.size !== expectedLocations.size ||
      returnedIds.size !== expectedLocations.size ||
      locations.some(
        (location) =>
          expectedLocations.get(String(location?.slug ?? "")) !==
          String(location?.id ?? ""),
      )
    ) {
      throw new Error(
        "Dry-run nao encontrou exatamente as duas locations Netcar.",
      );
    }

    const items = Array.isArray(posts.items) ? posts.items : [];
    if (items.length !== Number(posts.eligibleMedia ?? 0) * 2) {
      throw new Error(
        "Dry-run nao gerou exatamente dois destinos por post elegivel.",
      );
    }

    const mediaLocations = new Map();
    const safeItems = items.map((item) => {
      const slug = String(item?.location ?? "");
      const mediaId = String(item?.instagramMediaId ?? "");
      const destinationKind = String(item?.destinationKind ?? "");
      if (
        mediaId === "" ||
        !expectedLocations.has(slug) ||
        item?.action !== "would_create" ||
        !["vehicle", "fallback"].includes(destinationKind)
      ) {
        throw new Error("Dry-run retornou location ou acao inesperada.");
      }
      const slugs = mediaLocations.get(mediaId) ?? new Set();
      if (slugs.has(slug)) {
        throw new Error("Dry-run repetiu a mesma location para um post.");
      }
      slugs.add(slug);
      mediaLocations.set(mediaId, slugs);
      let tracked;
      try {
        tracked = new URL(String(item?.trackedUrl ?? ""));
      } catch {
        throw new Error("Dry-run retornou CTA invalido.");
      }
      if (
        tracked.protocol !== "https:" ||
        !["netcarmultimarcas.com.br", "www.netcarmultimarcas.com.br"].includes(
          tracked.hostname,
        ) ||
        tracked.searchParams.get("utm_source") !== "google_business_profile" ||
        tracked.searchParams.get("utm_medium") !== "organic_social" ||
        tracked.searchParams.get("utm_campaign") !== "instagram_replica" ||
        !String(tracked.searchParams.get("utm_content") ?? "").endsWith(
          `_${slug}`,
        )
      ) {
        throw new Error(
          "Dry-run retornou CTA fora do dominio ou sem atribuicao esperada.",
        );
      }

      return {
        instagramMediaId: mediaId,
        publishedAt: String(item.publishedAt ?? ""),
        location: slug,
        destinationKind,
        trackedUrl: tracked.toString(),
        action: item.action,
      };
    });
    if (
      [...mediaLocations.values()].some(
        (slugs) => slugs.size !== expectedLocations.size,
      )
    ) {
      throw new Error("Dry-run nao confirmou as duas lojas em cada post.");
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          enabled: posts.enabled === true,
          dryRun: true,
          notBefore: posts.notBefore,
          feedChecked: posts.feedChecked,
          eligibleMedia: posts.eligibleMedia,
          locations,
          items: safeItems,
        },
        null,
        2,
      ),
    );
  } finally {
    pinnedHosts.cleanup();
  }
}

async function runPublisherControl({
  config,
  pin,
  port,
  remoteRoot,
  phpBin,
  action,
}) {
  if (
    !["activate", "pause"].includes(action) ||
    process.argv.includes("--apply") ||
    argValue("--files") !== ""
  ) {
    throw new Error("Controle do publicador recebeu parametros incompatíveis.");
  }

  const pinnedHosts = await materializeKnownHosts(pin, config.SSH_HOST, port);
  const destination = `${config.SSH_USER}@${config.SSH_HOST}`;
  const portArgs = port === 22 ? [] : ["-p", String(port)];
  const controlScript = readFileSync(
    resolve(root, "scripts/social-publisher-control.php"),
    "utf8",
  );
  const socialRoot = pathPosix.join(remoteRoot, "social/v1");
  const commonSshArgs = [
    "-i",
    config.SSH_KEY_PATH,
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${pinnedHosts.path}`,
    "-o",
    "ConnectTimeout=15",
    "-o",
    "LogLevel=ERROR",
  ];

  try {
    const stdout = await run(
      "ssh",
      [
        ...commonSshArgs,
        ...portArgs,
        destination,
        `${quote(phpBin)} -- ${quote(socialRoot)} ${quote(action)}`,
      ],
      { input: controlScript },
    );
    let result;
    try {
      result = JSON.parse(stdout);
    } catch {
      throw new Error(
        "Controle remoto do publicador nao devolveu JSON valido.",
      );
    }
    if (
      result?.success !== true ||
      result?.action !== action ||
      result?.enabled !== (action === "activate") ||
      (action === "activate" && result?.created !== 0)
    ) {
      throw new Error(
        "Controle remoto do publicador nao confirmou o estado pedido.",
      );
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    pinnedHosts.cleanup();
  }
}

function buildTransactionScript({
  selected,
  remoteRoot,
  stageRoot,
  backupRoot,
  release,
  phpBin,
  healthUrls,
}) {
  const publicRoot = pathPosix.join(remoteRoot, "social/v1");
  const pendingPaths = selected.map(
    (relative) => `${pathPosix.join(publicRoot, relative)}.pending-${release}`,
  );

  const cleanupPending = pendingPaths
    .map((path) => `  rm -f ${quote(path)} || CLEANUP_RC=1`)
    .join("\n");

  const rollback = selected
    .map((relative) => {
      const target = pathPosix.join(publicRoot, relative);
      const backup = pathPosix.join(backupRoot, "files", relative);
      const marker = pathPosix.join(
        backupRoot,
        "markers",
        `${relative}.existed`,
      );
      const restore = `${target}.rollback-${release}`;
      return [
        `  if [ -f ${quote(marker)} ]; then`,
        `    cp -p ${quote(backup)} ${quote(restore)} || ROLLBACK_RC=1`,
        `    mv -f ${quote(restore)} ${quote(target)} || ROLLBACK_RC=1`,
        "  else",
        `    rm -f ${quote(target)} || ROLLBACK_RC=1`,
        "  fi",
        `  rm -f ${quote(`${target}.pending-${release}`)} ${quote(restore)} || ROLLBACK_RC=1`,
      ].join("\n");
    })
    .join("\n");

  const prepare = selected
    .map((relative) => {
      const source = pathPosix.join(stageRoot, "payload", relative);
      const target = pathPosix.join(publicRoot, relative);
      const pending = `${target}.pending-${release}`;
      const backup = pathPosix.join(backupRoot, "files", relative);
      const marker = pathPosix.join(
        backupRoot,
        "markers",
        `${relative}.existed`,
      );
      return [
        `test -f ${quote(source)}`,
        `mkdir -p ${quote(pathPosix.dirname(target))} ${quote(pathPosix.dirname(backup))} ${quote(pathPosix.dirname(marker))}`,
        `if [ -L ${quote(target)} ] || { [ -e ${quote(target)} ] && [ ! -f ${quote(target)} ]; }; then`,
        `  echo ${quote(`Destino remoto nao e arquivo regular: ${target}`)} >&2`,
        "  exit 1",
        "fi",
        `if [ -f ${quote(target)} ]; then`,
        `  cp -p ${quote(target)} ${quote(backup)}`,
        `  touch ${quote(marker)}`,
        "fi",
        `cp ${quote(source)} ${quote(pending)}`,
        `chmod 0644 ${quote(pending)}`,
      ].join("\n");
    })
    .join("\n");

  const replace = selected
    .map((relative) => {
      const target = pathPosix.join(publicRoot, relative);
      return `mv -f ${quote(`${target}.pending-${release}`)} ${quote(target)}`;
    })
    .join("\n");

  const postDeployLint = selected
    .filter((relative) => relative.endsWith(".php"))
    .map(
      (relative) =>
        `${quote(phpBin)} -l ${quote(pathPosix.join(publicRoot, relative))} >/dev/null`,
    )
    .join("\n");

  const postDeployHealth = healthUrls
    .map(
      (url) =>
        `curl -fsS --connect-timeout 10 --max-time 30 ${quote(url)} >/dev/null`,
    )
    .join("\n");

  return [
    "set -eu",
    "umask 077",
    "COMMIT_STARTED=0",
    "cleanup_pending() {",
    "  CLEANUP_RC=0",
    cleanupPending,
    '  return "$CLEANUP_RC"',
    "}",
    "rollback() {",
    "  set +e",
    "  ROLLBACK_RC=0",
    '  echo "Deploy falhou; restaurando todo o conjunto anterior..." >&2',
    rollback,
    '  if [ "$ROLLBACK_RC" -ne 0 ]; then',
    '    echo "ATENCAO: rollback remoto incompleto; preserve o backup e revise manualmente." >&2',
    "  fi",
    '  return "$ROLLBACK_RC"',
    "}",
    "on_exit() {",
    "  RC=$?",
    "  trap - 0 1 2 15",
    '  if [ "$RC" -ne 0 ]; then',
    '    if [ "$COMMIT_STARTED" = "1" ]; then rollback || true; else cleanup_pending || true; fi',
    "  fi",
    '  exit "$RC"',
    "}",
    "trap on_exit 0",
    "trap 'exit 129' 1",
    "trap 'exit 130' 2",
    "trap 'exit 143' 15",
    `test -d ${quote(pathPosix.join(stageRoot, "payload"))}`,
    `if [ -e ${quote(backupRoot)} ]; then echo ${quote(`Backup remoto ja existe: ${backupRoot}`)} >&2; exit 1; fi`,
    `mkdir -p ${quote(pathPosix.join(backupRoot, "files"))} ${quote(pathPosix.join(backupRoot, "markers"))}`,
    prepare,
    "COMMIT_STARTED=1",
    replace,
    postDeployLint,
    healthUrls.length > 0 ? "command -v curl >/dev/null 2>&1" : "",
    postDeployHealth,
    "COMMIT_STARTED=0",
    `rm -rf ${quote(stageRoot)}`,
    "trap - 0 1 2 15",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const envFile = resolve(
    argValue("--env-file") || resolve(root, ".env.local"),
  );
  const config = parseEnv(envFile);
  const identityArgument = argValue("--identity");
  if (identityArgument) config.SSH_KEY_PATH = resolve(identityArgument);
  for (const key of ["SSH_HOST", "SSH_USER", "SSH_DIR"]) {
    if (!config[key]) throw new Error(`${key} ausente no arquivo de ambiente.`);
  }
  if (!config.SSH_KEY_PATH) {
    throw new Error(
      "Configure SSH_KEY_PATH (senha interativa nao e aceita neste deploy).",
    );
  }
  config.SSH_KEY_PATH = resolve(config.SSH_KEY_PATH);
  if (
    !existsSync(config.SSH_KEY_PATH) ||
    !lstatSync(config.SSH_KEY_PATH).isFile()
  ) {
    throw new Error(
      "Configure uma SSH_KEY_PATH valida (senha interativa nao e aceita neste deploy).",
    );
  }

  const port = validateConnectionConfig(config);
  const pin = resolvePinConfig(config);
  const remoteRoot = safeRemoteRoot(config.SSH_DIR, "SSH_DIR");
  const expectedRoot = safeRemoteRoot(
    config.SSH_EXPECTED_ROOT || "www",
    "SSH_EXPECTED_ROOT",
  );
  if (remoteRoot !== expectedRoot) {
    throw new Error(
      `SSH_DIR deve ser exatamente o root permitido (${expectedRoot}).`,
    );
  }

  const phpBin = String(config.SSH_PHP_BIN || "php");
  if (
    !/^(?:[a-zA-Z0-9._-]+|\/[a-zA-Z0-9._/-]+)$/.test(phpBin) ||
    phpBin.includes("..")
  ) {
    throw new Error("SSH_PHP_BIN invalido.");
  }

  const publisherDryRun = process.argv.includes("--publisher-dry-run");
  const publisherControl = argValue("--publisher-control");
  if (publisherDryRun && publisherControl !== "") {
    throw new Error("Escolha apenas uma operacao do publicador por execucao.");
  }
  if (publisherDryRun) {
    await runPublisherDryRun({ config, pin, port, remoteRoot, phpBin });
    return;
  }
  if (publisherControl !== "") {
    await runPublisherControl({
      config,
      pin,
      port,
      remoteRoot,
      phpBin,
      action: publisherControl,
    });
    return;
  }

  const selectedArg = argValue("--files");
  const selectedList = selectedArg
    ? selectedArg.split(",").map((item) => safeRelativePath(item.trim()))
    : manifest;
  const selected = [...new Set(selectedList)];
  if (selected.length === 0) throw new Error("Nenhum arquivo selecionado.");
  for (const relative of selected) {
    const localPath = resolve(sourceRoot, relative);
    if (
      !localPath.startsWith(`${sourceRoot}/`) ||
      !existsSync(localPath) ||
      !lstatSync(localPath).isFile()
    ) {
      throw new Error(`Arquivo local ausente ou nao regular: ${relative}`);
    }
  }

  console.log("Deploy social parcial:");
  console.log(
    `  destino: ${remoteRoot}/social/v1 (root permitido: ${expectedRoot})`,
  );
  console.log(
    `  host key: ${pin.mode === "known-hosts" ? "known_hosts fixado" : "fingerprint SHA256 fixado"}`,
  );
  for (const relative of selected) console.log(`  social/v1/${relative}`);
  if (!process.argv.includes("--apply")) {
    console.log(
      "\nDry-run concluido. Nenhum arquivo foi enviado. Use --apply para executar.",
    );
    return;
  }

  const destination = `${config.SSH_USER}@${config.SSH_HOST}`;
  const release = `${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}-${randomBytes(4).toString("hex")}`;
  const stageRoot = `.netcar-social-deploys/staging/${release}`;
  const backupRoot = `.netcar-social-backups/${release}`;
  const lockRoot = ".netcar-social-deploy.lock";
  const isFullRelease =
    selected.length === manifest.length &&
    manifest.every((relative) => selected.includes(relative));
  const healthUrls = isFullRelease
    ? [
        "https://www.netcarmultimarcas.com.br/social/v1/stories.php",
        "https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=1",
      ]
    : [];
  const transactionScript = buildTransactionScript({
    selected,
    remoteRoot,
    stageRoot,
    backupRoot,
    release,
    phpBin,
    healthUrls,
  });
  await run("sh", ["-n"], { input: transactionScript });
  const pinnedHosts = await materializeKnownHosts(pin, config.SSH_HOST, port);
  const portArgs = port === 22 ? [] : ["-p", String(port)];
  const scpPortArgs = port === 22 ? [] : ["-P", String(port)];
  const commonSshArgs = [
    "-i",
    config.SSH_KEY_PATH,
    "-o",
    "BatchMode=yes",
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "StrictHostKeyChecking=yes",
    "-o",
    `UserKnownHostsFile=${pinnedHosts.path}`,
    "-o",
    "ConnectTimeout=15",
    "-o",
    "LogLevel=ERROR",
  ];
  const ssh = (command) =>
    run("ssh", [...commonSshArgs, ...portArgs, destination, command]);

  let stageCreated = false;
  let remoteLockAcquired = false;
  try {
    await ssh(
      [
        "set -eu",
        `if ! mkdir ${quote(lockRoot)}; then`,
        '  echo "Outro deploy social ja possui o lock remoto." >&2',
        "  exit 1",
        "fi",
        `if ! printf '%s\\n' ${quote(release)} > ${quote(pathPosix.join(lockRoot, "owner"))}; then`,
        `  rmdir ${quote(lockRoot)} || true`,
        "  exit 1",
        "fi",
      ].join("\n"),
    );
    remoteLockAcquired = true;

    const protectedParents = [
      remoteRoot,
      pathPosix.join(remoteRoot, "social"),
      pathPosix.join(remoteRoot, "social/v1"),
      ...selected.map((relative) =>
        pathPosix.dirname(pathPosix.join(remoteRoot, "social/v1", relative)),
      ),
    ];
    await ssh(
      [
        "set -eu",
        ...[...new Set(protectedParents)].map(
          (directory) =>
            `if [ -L ${quote(directory)} ]; then echo ${quote(`Diretorio remoto nao pode ser symlink: ${directory}`)} >&2; exit 1; fi`,
        ),
        `test -d ${quote(pathPosix.join(remoteRoot, "social/v1"))}`,
      ].join("\n"),
    );

    const stageDirectories = [
      ...new Set(
        selected.map((relative) =>
          pathPosix.dirname(pathPosix.join(stageRoot, "payload", relative)),
        ),
      ),
    ];
    await ssh(
      [
        "set -eu",
        "umask 077",
        `if [ -e ${quote(stageRoot)} ] || [ -e ${quote(backupRoot)} ]; then`,
        `  echo ${quote(`Release remoto ja existe: ${release}`)} >&2`,
        "  exit 1",
        "fi",
        `mkdir -p ${stageDirectories.map(quote).join(" ")}`,
      ].join("\n"),
    );
    stageCreated = true;

    for (const relative of selected) {
      const localPath = resolve(sourceRoot, relative);
      const stagedPath = pathPosix.join(stageRoot, "payload", relative);
      await run("scp", [
        ...commonSshArgs,
        ...scpPortArgs,
        localPath,
        `${destination}:${stagedPath}`,
      ]);
      console.log(`Preparado: social/v1/${relative}`);
    }

    await ssh(
      `chmod 0644 ${selected.map((relative) => quote(pathPosix.join(stageRoot, "payload", relative))).join(" ")}`,
    );

    const phpFiles = selected.filter((relative) => relative.endsWith(".php"));
    if (phpFiles.length > 0) {
      await ssh(
        [
          "set -eu",
          `command -v ${quote(phpBin)} >/dev/null 2>&1`,
          ...phpFiles.map(
            (relative) =>
              `${quote(phpBin)} -l ${quote(pathPosix.join(stageRoot, "payload", relative))} >/dev/null`,
          ),
        ].join("\n"),
      );
      console.log(`Lint PHP remoto aprovado (${phpFiles.length} arquivos).`);
    }

    await ssh(transactionScript);
    stageCreated = false;

    console.log(
      "Deploy concluido como um conjunto; rollback automatico estava armado durante a troca.",
    );
    console.log(`Backup remoto: ${backupRoot}`);
  } catch (error) {
    if (stageCreated) {
      try {
        await ssh(`rm -rf ${quote(stageRoot)}`);
      } catch (cleanupError) {
        console.error(
          `Aviso: nao foi possivel limpar o staging remoto ${stageRoot}: ${cleanupError.message}`,
        );
      }
    }
    throw error;
  } finally {
    if (remoteLockAcquired) {
      try {
        await ssh(
          [
            "set -eu",
            `test -d ${quote(lockRoot)} && test ! -L ${quote(lockRoot)}`,
            `test "$(cat ${quote(pathPosix.join(lockRoot, "owner"))})" = ${quote(release)}`,
            `rm -f ${quote(pathPosix.join(lockRoot, "owner"))}`,
            `rmdir ${quote(lockRoot)}`,
          ].join("\n"),
        );
      } catch (lockError) {
        console.error(
          `Aviso: lock remoto preservado para revisao: ${lockError.message}`,
        );
      }
    }
    pinnedHosts.cleanup();
  }
}

main().catch((error) => {
  console.error(`Falha: ${error.message}`);
  process.exitCode = 1;
});
