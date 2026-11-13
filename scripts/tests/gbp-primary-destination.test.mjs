import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

function runScript(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [...args, path.join(root, script)], {
    cwd: root, encoding: 'utf8', ...options,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('photo candidates use the principal while keeping both units in historical validation', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'netcar-gbp-photos-'));
  try {
    const history = readFileSync(path.join(root, 'docs/local-seo-project/evidencias/gbp-photo-log.csv'), 'utf8');
    const [header, ...rows] = history.trim().split(/\r?\n/);
    const idIndex = header.split(';').indexOf('media_bank_id');
    const past = rows.map((row) => ({ id: row.split(';')[idIndex] }));
    const candidate = {
      tipo_midia: 'foto', disponivel: true, qa_class: 'A', manual_review_required: false,
      catalogado_em: '2026-11-13', arquivo: 'fixture.jpg',
    };
    writeFileSync(path.join(directory, 'index.json'), JSON.stringify({ midias: [
      ...past,
      { ...candidate, id: 'principal-candidate', unidade: 'loja1' },
      { ...candidate, id: 'branch-candidate', unidade: 'loja2' },
      { ...candidate, id: 'unreviewed-candidate', unidade: 'loja1', manual_review_required: true },
    ] }));
    const options = { env: { ...process.env, NETCAR_MEDIA_BANK_PATH: directory } };
    const output = runScript('scripts/gbp-photo-routine.mjs', [], options);
    assert.match(output, /Netcar Multimarcas — nº 740/);
    assert.match(output, /principal-candidate/);
    assert.doesNotMatch(output, /branch-candidate|unreviewed-candidate|Matriz/);
    assert.match(output, /11161331340741727452/);
    assert.match(output, new RegExp(`Publicações registradas: ${rows.length}`));

    // Removing one historical branch asset must still fail validation.
    const branchId = rows.find((row) => row.split(';')[2] === 'loja2').split(';')[idIndex];
    writeFileSync(path.join(directory, 'index.json'), JSON.stringify({ midias: past.filter((item) => item.id !== branchId) }));
    const invalid = spawnSync(process.execPath, [path.join(root, 'scripts/gbp-photo-routine.mjs'), '--validate'], options);
    assert.equal(invalid.status, 1);
    assert.match(String(invalid.stderr), /histórico não encontrada/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('manual product CSV preserves its schema and emits one principal row per car', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'netcar-gbp-products-'));
  try {
    const mockPath = path.join(directory, 'mock-fetch.mjs');
    const out = path.join(directory, 'products.csv');
    const fixture = { data: [
      { id: '2', marca: 'Fiat', modelo: 'Argo', ano: 2024, placa: 'ABC1234', valor: 65000, imagens_site: { capa: '/photos/2.jpg' } },
      { id: '1', marca: 'Ford', modelo: 'Ka', ano: 2020, placa: 'DEF5678', valor: 50000, imagens_site: { capa: '/photos/1.jpg' } },
    ] };
    writeFileSync(mockPath, `globalThis.fetch = async (url) => {
      if (url !== 'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500') throw new Error('Unexpected network request');
      return { ok: true, json: async () => (${JSON.stringify(fixture)}) };
    };`);
    const result = spawnSync(process.execPath, [
      '--import', mockPath, path.join(root, 'scripts/gbp-products-csv.mjs'), `--out=${out}`,
    ], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const [header, ...rows] = readFileSync(out, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    assert.equal(header, 'loja,id,nome_produto,categoria,preco_brl,descricao,foto_url,botao,link_utm');
    assert.equal(rows.length, fixture.data.length);
    for (const row of rows) {
      assert.match(row, /^Netcar Multimarcas,/);
      assert.match(row, /utm_content=loja_1$/);
      assert.doesNotMatch(row, /loja_2|Loja 2|Matriz/);
    }
    assert.match(rows[0], /^Netcar Multimarcas,2,/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
