import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isCarclickSourcePath, tarExcludeShellFlags } from '../lib/ssh-deploy.js';

const rules = readFileSync(new URL('../../public/.htaccess', import.meta.url), 'utf8');
test('Carclick keeps its original importer URL and transforms before the file bypass', () => {
  const route = rules.indexOf('RewriteRule ^feeds/carclick\\.xml$ feeds/carclick.php [L]');
  assert.ok(route > rules.indexOf('RewriteCond %{HTTPS} off'));
  const fileBypass = rules.indexOf('RewriteCond %{REQUEST_FILENAME} -f');
  assert.ok(fileBypass === -1 || route < fileBypass);
  assert.ok(route > -1);
  for (const file of ['carclick.xml', 'carclick.php', 'carclick-description.php', 'carclick-warranty.php']) {
    assert.ok(rules.slice(0, route).includes(`RewriteCond %{DOCUMENT_ROOT}/feeds/${file} -f`));
  }
});
test('both deployment transports preserve the runtime supplier XML', () => {
  assert.equal(isCarclickSourcePath('feeds/carclick.xml'), true);
  assert.equal(isCarclickSourcePath('feeds\\carclick.xml'), true);
  assert.equal(isCarclickSourcePath('./feeds/carclick.xml'), true);
  assert.equal(isCarclickSourcePath('feeds/carclick.php'), false);
  assert.equal(isCarclickSourcePath('feeds/carclick-warranty.json'), false);
  assert.ok(tarExcludeShellFlags().includes('--exclude=feeds/carclick.xml'));
  const deploy = readFileSync(new URL('../deploy-local.js', import.meta.url), 'utf8');
  assert.ok(deploy.includes('!isCarclickSourcePath(relative(distPath, file))'));
});
test('the controller reads its supplier file directly and never overwrites it', () => {
  const controller = readFileSync(new URL('../../public/feeds/carclick.php', import.meta.url), 'utf8');
  assert.ok(controller.includes("netcar_carclick_read_source(__DIR__ . '/carclick.xml')"));
  assert.doesNotMatch(controller, /file_put_contents|fwrite|unlink\(|rename\(|https:\/\/.*carclick\.xml/);
  assert.ok(controller.includes('http_response_code(503)'));
});
