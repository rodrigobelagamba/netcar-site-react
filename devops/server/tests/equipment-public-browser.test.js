import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicEquipmentBrowserEnv, isAllowedPublicEquipmentRequest } from '../../../scripts/lib/equipmentPublicBrowser.mjs';

const request = (url, overrides = {}) => ({ url, method: 'GET', resourceType: 'fetch', ...overrides });

test('public equipment browser only permits read-only requests to exact public Netcar hosts', () => {
  assert.equal(isAllowedPublicEquipmentRequest(request('https://www.netcarmultimarcas.com.br/api/v1/veiculos/id/20075')), true);
  assert.equal(isAllowedPublicEquipmentRequest(request('https://netcarmultimarcas.com.br/veiculo/20075', { resourceType: 'document' })), true);
  assert.equal(isAllowedPublicEquipmentRequest(request('https://www.netcarmultimarcas.com.br/assets/index-test.js', { resourceType: 'script' })), true);
  for (const url of [
    'http://www.netcarmultimarcas.com.br/api/v1/veiculos/id/20075',
    'https://www.netcarmultimarcas.com.br.attacker.invalid/api/v1/veiculos/id/20075',
    'https://private.netcarmultimarcas.com.br/api/v1/veiculos/id/20075',
    'https://www.netcarmultimarcas.com.br:8443/api/v1/veiculos/id/20075',
    'https://token@www.netcarmultimarcas.com.br/api/v1/veiculos/id/20075',
    'https://www.netcarmultimarcas.com.br/api/deploy/local',
    'file:///private/credential.json', 'data:text/html,<script>fetch("secret")</script>',
  ]) assert.equal(isAllowedPublicEquipmentRequest(request(url)), false);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    assert.equal(isAllowedPublicEquipmentRequest(request('https://www.netcarmultimarcas.com.br/api/v1/veiculos/id/20075', { method })), false);
  }
});

test('browser suppresses media and analytics instead of collecting them', () => {
  for (const resourceType of ['image', 'font', 'media', 'websocket', 'eventsource']) {
    assert.equal(isAllowedPublicEquipmentRequest(request('https://www.netcarmultimarcas.com.br/assets/file', { resourceType })), false);
  }
  assert.equal(isAllowedPublicEquipmentRequest(request('https://www.netcarmultimarcas.com.br/api/v1/analytics.php')), false);
  assert.equal(isAllowedPublicEquipmentRequest(request('https://www.google-analytics.com/collect')), false);
  assert.equal(isAllowedPublicEquipmentRequest(request('data:text/css,body{color:black}', { resourceType: 'stylesheet' })), true);
});

test('browser process receives only allowlisted environment and a temporary home', () => {
  const env = buildPublicEquipmentBrowserEnv('/tmp/audit-private', {
    PATH: '/usr/bin:/bin', HOME: '/real/home', TMPDIR: '/real/tmp', LANG: 'pt_BR.UTF-8', TZ: 'America/Sao_Paulo',
    DEVOPS_TOKEN: 'do-not-inherit', SSH_AUTH_SOCK: '/ssh-agent', NODE_OPTIONS: '--require=/secret', OTHER_CREDENTIAL: 'secret',
  });
  assert.deepEqual(env, { PATH: '/usr/bin:/bin', HOME: '/tmp/audit-private', TMPDIR: '/tmp/audit-private', LANG: 'pt_BR.UTF-8', TZ: 'America/Sao_Paulo' });
});
