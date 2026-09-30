import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import {
  getDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { configurePublicationNetwork } from "../publish-icheck-metadata.mjs";

const publisher = new URL("../publish-icheck-metadata.mjs", import.meta.url);
const release = new URL("../deploy-icheck-release.mjs", import.meta.url);

test("i-CHECK publication allows slower dual-stack attempts without weakening network safeguards", () => {
  const previous = getDefaultAutoSelectFamilyAttemptTimeout();
  const family = getDefaultAutoSelectFamily();
  const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    for (const initial of [250, 5_000]) {
      setDefaultAutoSelectFamilyAttemptTimeout(initial);
      configurePublicationNetwork();
      assert.equal(
        getDefaultAutoSelectFamilyAttemptTimeout(),
        Math.max(2_000, initial),
      );
      assert.equal(getDefaultAutoSelectFamily(), family);
      assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);
    }
  } finally {
    setDefaultAutoSelectFamilyAttemptTimeout(previous);
  }
});

for (const script of [publisher, release]) {
  test(`importing ${fileURLToPath(script).split("/").pop()} leaves the hosting process network policy unchanged`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import assert from 'node:assert/strict';
         import net from 'node:net';
         net.setDefaultAutoSelectFamilyAttemptTimeout(250);
         const family = net.getDefaultAutoSelectFamily();
         const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
         await import(${JSON.stringify(script.href)});
         assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 250);
         assert.equal(net.getDefaultAutoSelectFamily(), family);
         assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);`,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
  });
}

function fixtures(directory) {
  const metadataDirectory = join(directory, "metadata");
  const distDirectory = join(directory, "dist");
  const releaseMetadata = join(distDirectory, "arquivos", "autocheck");
  for (const path of [
    metadataDirectory,
    releaseMetadata,
    join(distDirectory, "assets"),
    join(distDirectory, ".vite"),
  ]) mkdirSync(path, { recursive: true });
  const name = "CheckAuto_ABC1D23_1234.meta.json";
  const metadata = JSON.stringify({
    schemaVersion: 2,
    vehicleId: "100",
    placa: "ABC1D23",
    pdf: "CheckAuto_ABC1D23_1234.pdf",
    source: "unavailable",
    available: false,
    history: [null, null, null, null],
  });
  for (const path of [metadataDirectory, releaseMetadata])
    writeFileSync(join(path, name), metadata);
  writeFileSync(join(distDirectory, "assets", "fixture.js"), "// fixture\n");
  writeFileSync(join(distDirectory, ".htaccess"), "# fixture\n");
  writeFileSync(join(distDirectory, ".vite", "manifest.json"), "{}");
  writeFileSync(
    join(distDirectory, "index.html"),
    '<script src="/assets/fixture.js"></script>',
  );
  return { metadataDirectory, distDirectory };
}

function networkPreload(initial) {
  return `import assert from 'node:assert/strict';
    import net from 'node:net';
    import childProcess from 'node:child_process';
    import { createHash } from 'node:crypto';
    import { createRequire, syncBuiltinESMExports } from 'node:module';
    const require = createRequire(${JSON.stringify(publisher.href)});
    const { Client } = require('ssh2');
    net.setDefaultAutoSelectFamilyAttemptTimeout(${initial});
    const family = net.getDefaultAutoSelectFamily();
    const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const events = [];
    const keyType = Buffer.from('ssh-ed25519');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(keyType.length);
    const key = Buffer.concat([length, keyType, Buffer.alloc(32, 7)]);
    const fingerprint = 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
    Object.assign(process.env, {
      SSH_HOST: 'icheck-fixture.invalid',
      SSH_PORT: '22',
      SSH_USER: 'fixture',
      SSH_DIR: 'www',
      SSH_PASSWORD: 'synthetic-test-value',
      SSH_HOST_FINGERPRINT: fingerprint,
    });
    const assertPolicy = () => {
      assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), ${Math.max(2_000, initial)});
      assert.equal(net.getDefaultAutoSelectFamily(), family);
      assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);
    };
    // No executable, real key, DNS lookup or socket is used by this test.
    childProcess.spawnSync = (command, args, options) => {
      assertPolicy();
      assert.equal(command, 'ssh-keyscan');
      assert.deepEqual(args, ['-T', '15', '-p', '22', '-t', 'ed25519,ecdsa,rsa', 'icheck-fixture.invalid']);
      assert.equal(options.timeout, 20000);
      events.push('keyscan');
      return { status: 0, stdout: 'icheck-fixture.invalid ssh-ed25519 ' + key.toString('base64') + '\\n', stderr: '' };
    };
    syncBuiltinESMExports();
    net.Socket.prototype.connect = () => { throw new Error('Unexpected real socket'); };
    globalThis.fetch = () => { throw new Error('Unexpected real fetch'); };
    Client.prototype.connect = function(config) {
      assertPolicy();
      assert.equal(config.host, 'icheck-fixture.invalid');
      assert.equal(config.readyTimeout, 30000);
      assert.equal(config.keepaliveInterval, 10000);
      assert.deepEqual(config.algorithms.serverHostKey, ['ssh-ed25519']);
      assert.equal(config.hostVerifier(key), true);
      assert.equal(config.hostVerifier(Buffer.from('wrong-host-key')), false);
      assert.equal(config.forceIPv4, undefined);
      assert.equal(config.forceIPv6, undefined);
      events.push('ssh');
      queueMicrotask(() => this.emit('error', Object.assign(new Error('synthetic timeout'), { code: 'ETIMEDOUT' })));
      return this;
    };
    Client.prototype.end = function() { events.push('end'); return this; };
    process.on('exit', () => {
      assertPolicy();
      assert.deepEqual(events, ['keyscan', 'ssh', 'end']);
      process.stdout.write(JSON.stringify({ networkPolicyVerified: true }) + '\\n');
    });`;
}

for (const initial of [250, 5_000]) {
  for (const mode of ["publisher", "release", "check-connection"]) {
    test(`i-CHECK ${mode} CLI applies policy before networking with a ${initial}ms initial timeout`, () => {
      const directory = mkdtempSync(join(tmpdir(), "netcar-icheck-publication-network-"));
      try {
        const { metadataDirectory, distDirectory } = fixtures(directory);
        const script = mode === "publisher" ? publisher : release;
        const args = mode === "check-connection"
          ? ["--check-connection"]
          : [`--directory=${mode === "publisher" ? metadataDirectory : distDirectory}`];
        // Do not pass deployment credentials or external Node preload hooks.
        const env = Object.fromEntries(Object.entries(process.env).filter(
          ([name]) => !name.startsWith("SSH_") && name !== "NODE_OPTIONS",
        ));
        const result = spawnSync(process.execPath, [
          "--import", `data:text/javascript,${encodeURIComponent(networkPreload(initial))}`,
          fileURLToPath(script), ...args,
        ], { encoding: "utf8", timeout: 10_000, env });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /"stage":"ssh_connect","code":"ETIMEDOUT"/);
        assert.doesNotMatch(result.stderr, /AssertionError|synthetic-test-value/);
        assert.deepEqual(JSON.parse(result.stdout.trim().split("\n").at(-1)), {
          networkPolicyVerified: true,
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}
