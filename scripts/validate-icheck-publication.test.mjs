import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  metadataForPublication,
  deploymentConfiguration,
} from "./publish-icheck-metadata.mjs";
import {
  prepareRelease,
  restoreMutableFiles,
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
    /Fingerprint/,
  );
  assert.throws(
    () => deploymentConfiguration({ SSH_DIR: "../other-site" }),
    /destino/,
  );
});

test("explicit mounted SSH identity takes precedence over a legacy password", () => {
  const { directory, cleanup } = fixture();
  try {
    const keyPath = join(directory, "id_netcar");
    writeFileSync(keyPath, "test-only-key");
    const configuration = deploymentConfiguration({
      SSH_HOST_FINGERPRINT: `SHA256:${"A".repeat(43)}`,
      SSH_KEY_PATH: keyPath,
      SSH_PASSWORD: "legacy-password",
    });
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
