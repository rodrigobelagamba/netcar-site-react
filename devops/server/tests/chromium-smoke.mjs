// Exercise the actual Alpine image without credentials or external requests.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { readRenderedEquipment } from '../../../scripts/lib/equipmentPublicBrowser.mjs';

let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    env: { PATH: process.env.PATH, LANG: 'pt_BR.UTF-8', TZ: 'America/Sao_Paulo' },
  });
  const page = await browser.newPage();
  await page.setContent('<main><h1>Conferência semanal</h1><button>Expandir</button><ul hidden><li>Câmbio CVT</li></ul></main><script>document.querySelector("button").onclick=()=>document.querySelector("ul").hidden=false</script>');
  await page.click('button');
  assert.equal(await page.$eval('li', (element) => element.innerText), 'Câmbio CVT');
  assert.equal(await page.$eval('ul', (element) => element.hidden), false);

  const others = '<section><div><div><h2>Outros equipamentos</h2></div></div><span>Ar-condicionado</span></section>';
  await page.setContent(`
    <section><h3 id="vehicle-differentials-title">Destaques</h3><article>
      <p>Manobras</p><h4>Câmera de ré</h4><p>Exibe a área traseira.</p>
    </article></section>${others}
    <section><h3>Descrição do veículo</h3><div><h4>Equipamentos</h4>
      <ul><li>Câmera de ré</li><li>Ar-condicionado</li></ul></div>
      <button aria-expanded="true">Ler menos</button>
    </section>`);
  const legacy = await page.evaluate(readRenderedEquipment);
  assert.equal(legacy.ready, true);
  assert.equal(legacy.presentation, 'legacy');
  assert.deepEqual(legacy.equipmentNames, ['Câmera de ré', 'Ar-condicionado']);
  assert.deepEqual(legacy.highlights, [{ name: 'Câmera de ré', category: 'Manobras', benefit: 'Exibe a área traseira.' }]);

  const editorialHtml = `
    <section data-equipment-presentation="editorial"><h3 id="vehicle-differentials-title">Destaques</h3><article>
      <p>Manobras</p><h4>Mais apoio nas manobras</h4>
      <p data-equipment-benefit>A imagem e os avisos ajudam nas manobras.</p>
      <p><span data-equipment-label>Câmera de ré</span><span aria-hidden="true"> · </span>
        <span data-equipment-label>Sensor de estacionamento</span>
        <span data-equipment-label hidden>Equipamento oculto</span></p>
    </article></section>
    <section><div><div><h2>Outros equipamentos</h2></div></div>
      <span>Ar-condicionado</span><span>Câmera de ré</span>
    </section>`;
  await page.setContent(editorialHtml);
  const editorial = await page.evaluate(readRenderedEquipment);
  assert.equal(editorial.ready, true, 'The explicit editorial layout no longer requires a repeated description');
  assert.equal(editorial.presentation, 'editorial');
  assert.equal(editorial.descriptionText, '');
  assert.deepEqual(editorial.equipmentNames, ['Câmera de ré', 'Sensor de estacionamento', 'Ar-condicionado', 'Câmera de ré'],
    'Group labels are inventory facts; duplicates remain visible to the audit and hidden labels do not count');
  assert.deepEqual(editorial.highlights, [{ name: 'Mais apoio nas manobras', category: 'Manobras', benefit: 'A imagem e os avisos ajudam nas manobras.' }]);

  await page.setContent(editorialHtml.replace(' data-equipment-presentation="editorial"', ''));
  assert.equal((await page.evaluate(readRenderedEquipment)).ready, false,
    'A missing legacy description cannot silently become an editorial presentation');
  await page.setContent('<section data-equipment-presentation="editorial"><h2>Detalhes</h2></section>');
  const empty = await page.evaluate(readRenderedEquipment);
  assert.equal(empty.ready, true, 'Units without equipment can finish and let the comparator check the empty inventory');
  assert.deepEqual(empty.equipmentNames, []);
  console.log('Chromium: renderização, expansão e extração de equipamentos nos layouts legado e editorial verificadas.');
} finally {
  await browser?.close();
}
