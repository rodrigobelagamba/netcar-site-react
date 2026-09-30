import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../deploy-local.js', import.meta.url));

for (const previous of [250, 5_000]) {
  test(`deploy CLI preserves network safeguards with a ${previous}ms initial timeout`, () => {
    const preload = `import assert from 'node:assert/strict';
      import net from 'node:net';
      net.setDefaultAutoSelectFamilyAttemptTimeout(${previous});
      const family = net.getDefaultAutoSelectFamily();
      const tls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.on('exit', () => {
        assert.equal(net.getDefaultAutoSelectFamilyAttemptTimeout(), ${Math.max(2_000, previous)});
        assert.equal(net.getDefaultAutoSelectFamily(), family);
        assert.equal(process.env.NODE_TLS_REJECT_UNAUTHORIZED, tls);
      });`;
    // Help enters the same CLI bootstrap without reading credentials, building,
    // opening SSH or uploading anything. deploy:dist invokes this same CLI.
    const result = spawnSync(process.execPath, [
      '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
      script, '--from-dist', '--help',
    ], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /deploy:dist/);
  });
}
