import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  metadataForPublication,
  deploymentConfiguration,
  pinnedHostAlgorithms,
  safeDiagnostic,
} from "./publish-icheck-metadata.mjs";
import {
  prepareRelease,
  restoreMutableFiles,
  checkConnection,
} from "./deploy-icheck-release.mjs";

const certificate = {
  schemaVersion: 2,
  vehicleId: "19932",
  placa: "JBT8I78",
  pdf: "CheckAuto_JBT8I78_1022.pdf",
  source: "checkauto-pdf",
  sourceSha256: "a".repeat(64),
  available: true,
  history: ["leilao", "sinistro", "roubo", "estaduais"].map((key) => ({
    key,
    status: "Sem Registro",
  })),
};
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "icheck-publication-test-"));
  return {
    directory,
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("publisher rejects substituted identities and local source paths", () => {
  const { directory, cleanup } = fixture();
  try {
    const path = join(directory, "CheckAuto_JBT8I78_1022.meta.json");
    writeFileSync(path, JSON.stringify(certificate));
    assert.equal(metadataForPublication(directory).length, 1);
    writeFileSync(
      path,
      JSON.stringify({
        ...certificate,
        pdf: certificate.pdf.replace(/\.pdf$/, ".PDF"),
      }),
    );
    assert.equal(metadataForPublication(directory).length, 1);
    for (const change of [
      { pdf: "other.pdf" },
      { sourcePath: "/private/customer.xml" },
      { placa: "../../bad" },
      { sourceSha256: null },
    ]) {
      writeFileSync(path, JSON.stringify({ ...certificate, ...change }));
      assert.throws(() => metadataForPublication(directory));
    }
    writeFileSync(
      path,
      JSON.stringify({
        ...certificate,
        available: false,
        source: "unavailable",
        sourceSha256: null,
        history: certificate.history.map((h) => ({
          ...h,
          status: null,
          riskLevel: "unavailable",
        })),
      }),
    );
    assert.equal(metadataForPublication(directory)[0].data.available, false);
  } finally {
    cleanup();
  }
});

test("release contains no certificate PDF or catalog API and switches shell last", () => {
  const { directory, cleanup } = fixture();
  const write = (file, content) => {
    mkdirSync(join(directory, file, ".."), { recursive: true });
    writeFileSync(join(directory, file), content);
  };
  try {
    write("assets/app-a.js", "export const tested=true");
    write(".htaccess", "# preserved routes");
    write(".vite/manifest.json", "{}");
    write("index.html", '<script src="/assets/app-a.js"></script>');
    write("api/v1/veiculos.php", "unrelated API");
    write(
      "arquivos/autocheck/CheckAuto_JBT8I78_1022.pdf",
      "ORIGINAL MUST NOT BE UPLOADED",
    );
    write(
      "arquivos/autocheck/CheckAuto_JBT8I78_1022.meta.json",
      JSON.stringify(certificate),
    );
    write(
      "arquivos/autocheck/Legacy.meta.json",
      JSON.stringify({ schemaVersion: 1 }),
    );
    const { entries, release } = prepareRelease(directory);
    assert.equal(entries.at(-1).path, "index.html");
    assert.equal(release.metadataCount, 1);
    assert.ok(entries.some((entry) => entry.path === ".vite/manifest.json"));
    assert.ok(
      entries.every(
        (entry) =>
          !entry.path.endsWith(".pdf") && !entry.path.startsWith("api/"),
      ),
    );
    assert.ok(!entries.some((entry) => entry.path.includes("Legacy")));
  } finally {
    cleanup();
  }
});

test("SSH publication fails closed without a pinned destination", () => {
  assert.throws(
    () =>
      deploymentConfiguration({
        SSH_HOST: "unconfigured.invalid",
        SSH_PASSWORD: "fixture",
        SSH_KNOWN_HOSTS_PATH: "/nonexistent/fixture",
      }),
    { code: "PIN_NOT_CONFIGURED" },
  );
  assert.throws(() => deploymentConfiguration({ SSH_DIR: "../other-site" }), {
    code: "INVALID_CONFIGURATION",
  });
});

test("explicit mounted SSH identity takes precedence over a legacy password", () => {
  const { directory, cleanup } = fixture();
  try {
    const keyPath = join(directory, "id_netcar");
    writeFileSync(keyPath, "test-only-key");
    const hostKey = fixtureHostKey("ssh-rsa");
    const configuration = deploymentConfiguration(
      {
        SSH_HOST_FINGERPRINT: hostKey.pin,
        SSH_KEY_PATH: keyPath,
        SSH_PASSWORD: "legacy-password",
      },
      { scanHostKeys: () => hostKey.line },
    );
    assert.equal(configuration.ssh.privateKey.toString(), "test-only-key");
    assert.equal(configuration.ssh.password, undefined);
  } finally {
    cleanup();
  }
});

test("rollback restores through temporary rename and reports failed public paths", async () => {
  const calls = [];
  const sftp = {
    writeFile(path, bytes, options, callback) {
      calls.push({ method: "write", path, content: bytes.toString() });
      callback(null);
    },
    ext_openssh_rename(source, target, callback) {
      calls.push({ method: "rename", source, target });
      callback(
        target.endsWith("blocked.meta.json")
          ? new Error("private connection details")
          : null,
      );
    },
    unlink(path, callback) {
      calls.push({ method: "unlink", path });
      callback(
        path.endsWith("missing.meta.json")
          ? Object.assign(new Error("missing"), { code: 2 })
          : null,
      );
    },
  };
  const failures = await restoreMutableFiles(sftp, "www", [
    { path: "index.html", bytes: Buffer.from("previous shell") },
    { path: ".htaccess", bytes: Buffer.from("previous routes") },
    {
      path: "arquivos/autocheck/blocked.meta.json",
      bytes: Buffer.from("previous metadata"),
    },
    { path: "arquivos/autocheck/missing.meta.json", bytes: null },
  ]);
  assert.deepEqual(failures, ["arquivos/autocheck/blocked.meta.json"]);
  assert(
    calls
      .filter((entry) => entry.method === "write")
      .every((entry) => /\.icheck-[a-z0-9-]+\.tmp$/.test(entry.path)),
  );
  assert(
    calls.some(
      (entry) => entry.method === "rename" && entry.target === "www/index.html",
    ),
  );
  assert(
    calls.some(
      (entry) => entry.method === "rename" && entry.target === "www/.htaccess",
    ),
  );
  assert(
    calls.some(
      (entry) => entry.method === "unlink" && /\.tmp$/.test(entry.path),
    ),
    "failed rename cleans its temporary file",
  );
  assert.equal(
    JSON.stringify(failures).includes("private connection details"),
    false,
  );
});

function fixtureHostKey(type, suffix = "fixture") {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(Buffer.byteLength(type));
  const key = Buffer.concat([length, Buffer.from(type), Buffer.from(suffix)]);
  return {
    key,
    pin: `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`,
    line: `fixture.invalid ${type} ${key.toString("base64")}`,
  };
}

test("SSH negotiates only the key algorithm matching the trusted fingerprint", () => {
  const rsa = fixtureHostKey("ssh-rsa");
  const ed25519 = fixtureHostKey("ssh-ed25519");
  const scanned = `${ed25519.line}\n${rsa.line}`;
  assert.deepEqual(pinnedHostAlgorithms(scanned, [rsa.pin]), [
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
  ]);
  assert.deepEqual(pinnedHostAlgorithms(scanned, [ed25519.pin]), [
    "ssh-ed25519",
  ]);
  assert.throws(
    () => pinnedHostAlgorithms(scanned, [`SHA256:${"A".repeat(43)}`]),
    { code: "HOST_KEY_PIN_MISMATCH" },
  );
  assert.throws(
    () =>
      pinnedHostAlgorithms(rsa.line.replace(" ssh-rsa ", " ssh-ed25519 "), [
        rsa.pin,
      ]),
    { code: "HOST_KEY_PIN_MISMATCH" },
  );
  const config = deploymentConfiguration(
    { SSH_HOST_FINGERPRINT: rsa.pin, SSH_PASSWORD: "fixture" },
    { scanHostKeys: () => scanned },
  );
  assert.deepEqual(config.ssh.algorithms.serverHostKey, [
    "rsa-sha2-512",
    "rsa-sha2-256",
    "ssh-rsa",
  ]);
  assert.equal(config.ssh.hostVerifier(rsa.key), true);
  assert.equal(
    config.ssh.hostVerifier(ed25519.key),
    false,
    "scan discovery never trusts an unpinned key",
  );
});

test("connection preflight only opens SSH/SFTP and reads directory metadata", async () => {
  const calls = [];
  const sftp = {
    stat(path, callback) {
      calls.push(`stat:${path}`);
      callback(null, { isDirectory: () => true });
    },
    end() {
      calls.push("sftp:end");
    },
  };
  class ClientFixture extends EventEmitter {
    connect() {
      calls.push("connect");
      queueMicrotask(() => this.emit("ready"));
    }
    sftp(callback) {
      calls.push("sftp");
      callback(null, sftp);
    }
    end() {
      calls.push("end");
    }
  }
  const result = await checkConnection(
    { ssh: {}, remoteDirectory: "www/arquivos/autocheck" },
    { createClient: () => new ClientFixture() },
  );
  assert.equal(result.success, true);
  assert.deepEqual(calls, [
    "connect",
    "sftp",
    "stat:www",
    "stat:www/arquivos/autocheck",
    "sftp:end",
    "end",
  ]);
});

test("diagnostics distinguish safe connection stages without exposing server error text", () => {
  const secret = "password=/private/secret";
  assert.deepEqual(
    safeDiagnostic(
      Object.assign(
        new Error(`All configured authentication methods failed ${secret}`),
        { icheckStage: "ssh_connect" },
      ),
    ),
    { stage: "ssh_connect", code: "AUTHENTICATION_FAILED" },
  );
  assert.deepEqual(
    safeDiagnostic(
      Object.assign(new Error(`Host denied (verification failed) ${secret}`), {
        icheckStage: "ssh_connect",
      }),
    ),
    { stage: "ssh_connect", code: "HOST_KEY_REJECTED" },
  );
  assert.deepEqual(
    safeDiagnostic({ code: 3, message: secret, icheckStage: "sftp_stat" }),
    { stage: "sftp_stat", code: "SFTP_PERMISSION_DENIED" },
  );
  assert.equal(
    JSON.stringify(
      safeDiagnostic({ code: secret, icheckStage: secret, message: secret }),
    ).includes(secret),
    false,
  );
});
