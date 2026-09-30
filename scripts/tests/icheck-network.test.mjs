import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  getDefaultAutoSelectFamily,
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import PDFDocument from "@react-pdf/pdfkit";
import { configureIcheckNetwork } from "../sync-icheck-metadata.mjs";

const script = new URL("../sync-icheck-metadata.mjs", import.meta.url);
const vehicle = {
  id: "100",
  placa: "ABC1D23",
  pdf: "CheckAuto_ABC1D23_1234.pdf",
};
const metaName = vehicle.pdf.replace(/\.pdf$/, ".meta.json");

async function withDirectory(callback) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-icheck-network-test-"));
  try {
    await callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runCli(preload, outputDir) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      `data:text/javascript,${encodeURIComponent(preload)}`,
      fileURLToPath(script),
      `--output-dir=${outputDir}`,
    ],
    { encoding: "utf8", timeout: 15_000 },
  );
}

// Same synthetic certificate format used by the ingestion regressions; no live PDF.
async function certificate() {
  const pdf = new PDFDocument({ size: [595, 842], margin: 0, compress: false });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });
  pdf.font("Helvetica").fontSize(12);
  const draw = (text, x, y) => pdf.text(text, x, 842 - y, { lineBreak: false });
  draw("CERTIFICADO DE PROCEDÊNCIA VEICULAR", 40, 780);
  draw("Placa: ABC-XX23", 40, 750);
  draw("Data: 14/09/2026 13:22:10", 270, 750);
  draw("Histórico do Veículo", 40, 690);
  ["Leilão", "Sinistro / Perda", "Roubo / Furto", "Informações Estaduais"].forEach(
    (label, index) => {
      draw("Sem Registro", 295, 650 - index * 35);
      draw(label, 40, 650 - index * 35);
    },
  );
  pdf.end();
  return finished;
}

test("i-CHECK allows 2s for dual-stack attempts without lowering an existing higher timeout or changing TLS", () => {
  const previous = getDefaultAutoSelectFamilyAttemptTimeout();
  const familySelection = getDefaultAutoSelectFamily();
  const tlsVerification = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try {
    setDefaultAutoSelectFamilyAttemptTimeout(250);
    configureIcheckNetwork();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 2_000);
    assert.equal(getDefaultAutoSelectFamily(), familySelection);
    assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tlsVerification);
    setDefaultAutoSelectFamilyAttemptTimeout(5_000);
    configureIcheckNetwork();
    assert.equal(getDefaultAutoSelectFamilyAttemptTimeout(), 5_000);
    assert.equal(getDefaultAutoSelectFamily(), familySelection);
    assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tlsVerification);
  } finally {
    setDefaultAutoSelectFamilyAttemptTimeout(previous);
  }
});

test("importing i-CHECK does not change the hosting process network policy", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import assert from 'node:assert/strict';
       import net from 'node:net';
       net.setDefaultAutoSelectFamilyAttemptTimeout(250);
       const family = net.getDefaultAutoSelectFamily();
       const tlsVerification = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
       await import(${JSON.stringify(script.href)});
       assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 250);
       assert.equal(net.getDefaultAutoSelectFamily(), family);
       assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tlsVerification);`,
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test("the standalone CLI applies connection policy to inventory and PDF fetches while keeping their safeguards", async () => {
  const pdf = await certificate();
  await withDirectory(async (directory) => {
    const preload = `import assert from 'node:assert/strict';
      import net from 'node:net';
      net.setDefaultAutoSelectFamilyAttemptTimeout(250);
      const family = net.getDefaultAutoSelectFamily();
      const tlsVerification = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      const timeout = AbortSignal.timeout.bind(AbortSignal);
      const signals = new Set();
      const requests = [];
      AbortSignal.timeout = (milliseconds) => {
        assert.equal(milliseconds, 45000);
        const signal = timeout(milliseconds);
        signals.add(signal);
        return signal;
      };
      globalThis.fetch = async (url, options) => {
        assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 2000);
        assert.equal(net.getDefaultAutoSelectFamily(), family);
        assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tlsVerification);
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.signal.aborted, false);
        assert.equal(signals.delete(options.signal), true);
        const parsed = new URL(url);
        assert.equal(parsed.origin, 'https://www.netcarmultimarcas.com.br');
        if (parsed.pathname === '/api/v1/veiculos.php') {
          requests.push('inventory');
          return Response.json({success: true, total: 1, data: [${JSON.stringify(vehicle)}]});
        }
        assert.equal(parsed.pathname, '/arquivos/autocheck/${vehicle.pdf}');
        requests.push('pdf');
        return new Response(Buffer.from(${JSON.stringify(pdf.toString("base64"))}, 'base64'), {
          headers: {'content-type': 'application/pdf'}
        });
      };
      process.on('exit', () => assert.deepEqual(requests, ['inventory', 'pdf']));`;
    const result = runCli(preload, directory);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.generated, 1);
    assert.equal(summary.unavailable, 0);
    const metadata = JSON.parse(readFileSync(join(directory, metaName), "utf8"));
    assert.equal(metadata.source, "checkauto-pdf");
    assert.equal(metadata.identity.verified, true);
    assert.equal(metadata.allClear, true);
    assert.deepEqual(readdirSync(directory), [metaName]);
  });
});

test("CLI inventory timeouts stop after three attempts without touching existing files or leaking raw errors", async () => {
  await withDirectory(async (directory) => {
    const original = '{"source":"checkauto-pdf","available":true}\n';
    const originalPdf = Buffer.from("%PDF- original published certificate");
    writeFileSync(join(directory, metaName), original);
    writeFileSync(join(directory, vehicle.pdf), originalPdf);
    const preload = `import assert from 'node:assert/strict';
      import net from 'node:net';
      net.setDefaultAutoSelectFamilyAttemptTimeout(250);
      const signals = new Set();
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), 2000);
        assert.equal(new URL(url).pathname, '/api/v1/veiculos.php');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal instanceof AbortSignal);
        signals.add(options.signal);
        calls++;
        throw new TypeError('private-response https://user:secret@example.invalid', {
          cause: new AggregateError([
            Object.assign(new Error('private transport detail'), {code: 'ETIMEDOUT'})
          ])
        });
      };
      process.on('exit', () => process.stdout.write(JSON.stringify({calls, signals: signals.size})));`;
    const result = runCli(preload, directory);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.stdout), { calls: 3, signals: 3 });
    assert.equal(
      result.stderr.trim(),
      'i-CHECK synchronization failed: {"stage":"inventory","code":"ETIMEDOUT","page":1,"attempts":3}',
    );
    assert.equal(readFileSync(join(directory, metaName), "utf8"), original);
    assert.deepEqual(readFileSync(join(directory, vehicle.pdf)), originalPdf);
    assert.deepEqual(readdirSync(directory).sort(), [metaName, vehicle.pdf].sort());
  });
});
