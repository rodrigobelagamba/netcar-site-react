#!/usr/bin/env node
// Release restrita ao frontend e metadados i-CHECK. PDFs e API do catálogo ficam preservados.
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "ssh2";
import {
  deploymentConfiguration,
  envFile,
  metadataForPublication,
} from "./publish-icheck-metadata.mjs";

const call = (object, method, ...args) =>
  new Promise((res, rej) => {
    object[method](...args, (error, value) =>
      error ? rej(error) : res(value),
    );
  });
const digest = (data) => createHash("sha256").update(data).digest("hex");
const walk = (root, relative = "") =>
  readdirSync(join(root, relative), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(root, posix.join(relative, e.name))
      : [posix.join(relative, e.name)],
  );

export function prepareRelease(distDirectory) {
  const stage = mkdtempSync(join(tmpdir(), "netcar-icheck-release-"));
  const entries = [];
  const add = (path, bytes, mutable = false) =>
    entries.push({ path, bytes, mutable });
  try {
    for (const path of walk(join(distDirectory, "assets"))) {
      if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.includes(".."))
        throw new Error("Asset inválido.");
      add(`assets/${path}`, readFileSync(join(distDirectory, "assets", path)));
    }
    // Somente os JSONs schema2 reconstruídos nesta versão. Os sidecars legados de
    // veículos fora do inventário não são reimplantados com resultados antigos.
    const jsonDirectory = join(stage, "metadata");
    mkdirSync(jsonDirectory);
    const input = join(distDirectory, "arquivos/autocheck");
    for (const name of readdirSync(input).filter((p) =>
      p.endsWith(".meta.json"),
    )) {
      const bytes = readFileSync(join(input, name));
      if (JSON.parse(bytes.toString()).schemaVersion === 2)
        writeFileSync(join(jsonDirectory, name), bytes);
    }
    const metas = metadataForPublication(jsonDirectory);
    if (!metas.length) throw new Error("Release sem metadados validados.");
    for (const file of metas)
      add(`arquivos/autocheck/${file.name}`, file.bytes, true);
    for (const path of [".htaccess", ".vite/manifest.json"])
      add(path, readFileSync(join(distDirectory, path)), true);
    const html = readFileSync(join(distDirectory, "index.html"));
    if (!html.toString().includes("/assets/"))
      throw new Error("HTML sem assets compilados.");
    const release = {
      feature: "icheck-consultation-results-v2",
      generatedAt: new Date().toISOString(),
      metadataCount: metas.length,
      indexSha256: digest(html),
    };
    add("icheck-release.json", Buffer.from(JSON.stringify(release)), true);
    add("index.html", html, true); // troca do shell por último, com dependências já disponíveis
    return { entries, release };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

async function ensureDirectory(sftp, path, mode = 0o700) {
  let current = path.startsWith("/") ? "/" : "";
  for (const piece of path.split("/").filter(Boolean)) {
    current = posix.join(current, piece);
    try {
      await call(sftp, "mkdir", current, { mode });
    } catch (error) {
      if (!(await call(sftp, "stat", current)).isDirectory()) throw error;
    }
  }
}

async function atomicWrite(sftp, target, bytes) {
  const temporary = posix.join(
    posix.dirname(target),
    `.icheck-${randomUUID()}.tmp`,
  );
  try {
    await call(sftp, "writeFile", temporary, bytes, { mode: 0o644 });
    await call(sftp, "ext_openssh_rename", temporary, target);
  } catch (error) {
    await call(sftp, "unlink", temporary).catch(() => {});
    throw error;
  }
}

/** Restore public files without ever truncating a live document. Return only public relative paths. */
export async function restoreMutableFiles(sftp, root, previous) {
  const failedPaths = [];
  for (const old of [...previous].reverse()) {
    const target = posix.join(root, old.path);
    try {
      if (old.bytes === null) {
        try {
          await call(sftp, "unlink", target);
        } catch (error) {
          if (error.code !== 2) throw error;
        }
      } else await atomicWrite(sftp, target, old.bytes);
    } catch {
      failedPaths.push(old.path);
    }
  }
  return failedPaths;
}

export async function deployRelease(bundle, config) {
  const connection = new Client();
  let sftp;
  const backup = `.netcar-icheck-backups/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const root = posix.dirname(posix.dirname(config.remoteDirectory));
  const previous = [];
  const attemptedMutable = new Set();
  try {
    await new Promise((res, rej) => {
      connection.once("ready", res);
      connection.once("error", rej);
      connection.connect(config.ssh);
    });
    sftp = await call(connection, "sftp");
    await ensureDirectory(sftp, backup);
    // Backup fora do www antes de alterar qualquer documento público mutável.
    for (const entry of bundle.entries.filter((e) => e.mutable)) {
      let bytes = null;
      try {
        bytes = await call(sftp, "readFile", posix.join(root, entry.path));
      } catch (error) {
        if (error.code !== 2) throw error;
      }
      previous.push({ path: entry.path, bytes });
      if (bytes !== null) {
        const target = posix.join(backup, entry.path);
        await ensureDirectory(sftp, posix.dirname(target));
        await call(sftp, "writeFile", target, bytes, { mode: 0o600 });
      }
    }
    for (const entry of bundle.entries) {
      const final = posix.join(root, entry.path);
      await ensureDirectory(sftp, posix.dirname(final), 0o755);
      if (entry.mutable) attemptedMutable.add(entry.path);
      await atomicWrite(sftp, final, entry.bytes);
    }
    const verification = await call(
      sftp,
      "readFile",
      posix.join(root, "index.html"),
    );
    if (digest(verification) !== bundle.release.indexSha256)
      throw new Error("Shell remoto diverge do build.");
    return {
      success: true,
      uploadedFiles: bundle.entries.length,
      metadataCount: bundle.release.metadataCount,
      backup,
    };
  } catch (error) {
    // Reverte somente os arquivos mutáveis dessa release. Assets com hash são
    // aditivos e podem permanecer sem interferir no shell anterior.
    const failedRollbackPaths = sftp
      ? await restoreMutableFiles(
          sftp,
          root,
          previous.filter((entry) => attemptedMutable.has(entry.path)),
        )
      : [];
    if (failedRollbackPaths.length) {
      const failure = new Error("Release failed and rollback was incomplete", {
        cause: error,
      });
      failure.failedRollbackPaths = failedRollbackPaths;
      throw failure;
    }
    throw error;
  } finally {
    sftp?.end();
    connection.end();
  }
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const m = arg.match(/^--(directory|env-file)=(.+)$/);
      if (!m) throw new Error("Argumento inválido.");
      return [m[1], m[2]];
    }),
  );
  const bundle = prepareRelease(resolve(args.directory || "dist"));
  const config = deploymentConfiguration({
    ...envFile(args["env-file"]),
    ...process.env,
  });
  console.log(JSON.stringify(await deployRelease(bundle, config)));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      "Release i-CHECK falhou; confira o backup privado antes de repetir.",
    );
    if (
      Array.isArray(error.failedRollbackPaths) &&
      error.failedRollbackPaths.length
    ) {
      // Only bundle-relative public filenames are reported; never log SSH errors, credentials or remote home paths.
      console.error(
        JSON.stringify({
          rollbackIncomplete: true,
          failedPaths: error.failedRollbackPaths,
        }),
      );
    }
    process.exitCode = 1;
  });
}
