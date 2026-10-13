// Exercise the actual Alpine image without credentials or external requests.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

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
  console.log('Chromium: renderização e expansão verificadas.');
} finally {
  await browser?.close();
}
