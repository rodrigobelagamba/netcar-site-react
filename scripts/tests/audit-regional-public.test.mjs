import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareCity,
  decodeHtml,
  inspectHtml,
  mapLimit,
  runAudit,
  SITE,
  USER_AGENTS,
} from "../audit-regional-public.mjs";

const city = {
  slug: "cidade-teste",
  name: "Cidade Teste",
  title: "Carros & preços | Netcar",
  description: "Fotos, preços e troca.",
  h1: "Carros perto de Cidade Teste",
};
const pageUrl = `${SITE}/seminovos-${city.slug}`;
const vehicleUrl = `${SITE}/veiculo/automovel-teste-12345`;
const head = `<title>Carros &amp; preços | Netcar</title><meta content='Fotos, preços e troca.' name='description'><link href='${pageUrl}' rel='canonical'>`;
const stock = `<a data-regional-action='view_stock' href='#estoque-regional'>Ver carros e preços</a><section id='estoque-regional'><section><a href='${vehicleUrl}'>Carro</a></section><a href='/seminovos'>Estoque</a></section>`;
const shell = `<html><head>${head}</head><body><div id='root'></div><script>const sample='<h1>not rendered</h1>';</script></body></html>`;
const crawler = `<html><head>${head}</head><body><h1>${city.h1}</h1>${stock}</body></html>`;
const response = (html, extra = {}) => ({
  status: 200,
  finalUrl: pageUrl,
  contentType: "text/html; charset=UTF-8",
  document: inspectHtml(html, pageUrl),
  ...extra,
});

test("parses attribute order, entities and nested stock section without fake script H1", () => {
  const result = compareCity(city, response(shell), response(crawler));
  assert.equal(result.passed, true);
  assert.equal(result.parity.normalH1Count, 0);
  assert.equal(result.parity.crawlerH1Count, 1);
  assert.equal(result.parity.renderedDomChecked, false);
  assert.deepEqual(result.crawler.document.stockVehicleUrls, [vehicleUrl]);
  assert.deepEqual(result.crawler.document.stockCatalogUrls, ["/seminovos"]);
});

test("fails duplicate target, wrong anchor and mismatched title rather than hiding errors", () => {
  const html = crawler
    .replace("</body>", "<div id='estoque-regional'></div></body>")
    .replace("href='#estoque-regional'", "href='/seminovos'")
    .replace("Carros &amp; preços | Netcar", "Wrong title");
  const result = compareCity(city, response(shell), response(html));
  assert.equal(result.passed, false);
  assert.ok(
    result.errors.includes("crawler:stock_target_missing_or_duplicate"),
  );
  assert.ok(result.errors.includes("crawler:stock_cta_mismatch"));
  assert.ok(result.errors.includes("crawler:title_source_mismatch"));
});

test("detects noindex in either meta attribute order and response header, including none", () => {
  for (const markup of [
    '<meta content="NOINDEX, follow" name="robots">',
    "<meta name=Googlebot content=none>",
  ]) {
    assert.equal(inspectHtml(`${head}${markup}`, pageUrl).hasNoindex, true);
  }
  assert.equal(
    inspectHtml(head, pageUrl, { xRobotsTag: "googlebot: noindex" }).hasNoindex,
    true,
  );
  assert.equal(
    inspectHtml(head, pageUrl, { xRobotsTag: "index, follow" }).hasNoindex,
    false,
  );
});

test("detects missing or duplicated metadata and no internal vehicle links", () => {
  const html = crawler
    .replace(head, `${head}<title>Duplicate</title>`)
    .replace(vehicleUrl, "https://other.example/veiculo/test-12345");
  const result = compareCity(city, response(shell), response(html));
  assert.ok(result.errors.includes("crawler:title_source_mismatch"));
  assert.ok(result.errors.includes("crawler:invalid_vehicle_links"));
});

test("HTTP failure and redirect are failures, not indexing conclusions", () => {
  const result = compareCity(
    city,
    response(shell, { status: 404 }),
    response(crawler, { finalUrl: `${SITE}/` }),
  );
  assert.ok(result.errors.includes("normal:http_404"));
  assert.ok(result.errors.includes("crawler:unexpected_redirect"));
});

test("entity decoder rejects invalid code points", () => {
  assert.equal(decodeHtml("A&#32;&amp;&#x1F697;"), "A &🚗");
  assert.equal(decodeHtml("&#x110000;"), "&#x110000;");
});

test("limits all parallel operations to two and preserves order", async () => {
  let active = 0;
  let maximum = 0;
  const result = await mapLimit([1, 2, 3, 4], 2, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((done) => setTimeout(done, 4));
    active -= 1;
    return value * 2;
  });
  assert.equal(maximum, 2);
  assert.deepEqual(result, [2, 4, 6, 8]);
  await assert.rejects(
    mapLimit([1], 3, async () => 1),
    /Concurrency/,
  );
});

test("full mocked audit uses truthful UAs, deduplicates stock URLs and checks catalog", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, userAgent: options.headers["User-Agent"] });
    const html =
      url === pageUrl
        ? options.headers["User-Agent"] === USER_AGENTS.crawler
          ? crawler
          : shell
        : `<html><head><title>Stock</title><link rel="canonical" href="${url}"></head></html>`;
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  };
  const result = await runAudit({ cities: [city], fetchImpl });
  assert.equal(result.passed, true);
  assert.equal(result.stockUrlChecks.length, 2);
  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => !/googlebot/i.test(call.userAgent)));
  assert.equal(
    result.stockUrlChecks.every((entry) => entry.availabilityChecked === false),
    true,
  );
});

test("records known pre-JS stock shell canonical separately and requires correct crawler canonical", async () => {
  const fetchImpl = async (url, options) => {
    const isCrawler = options.headers["User-Agent"] === USER_AGENTS.crawler;
    const html =
      url === pageUrl
        ? isCrawler
          ? crawler
          : shell
        : `<html><head><link rel="canonical" href="${isCrawler ? url : `${SITE}/`}"></head><body>${isCrawler ? "" : '<div id="root"></div>'}</body></html>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  };
  const result = await runAudit({ cities: [city], fetchImpl });
  assert.equal(result.passed, true);
  assert.ok(
    result.stockUrlChecks.every((entry) =>
      entry.warnings.includes(
        "normal:app_shell_has_home_canonical_before_javascript",
      ),
    ),
  );
  const brokenFetch = async (url, options) => {
    if (url === pageUrl) return fetchImpl(url, options);
    return new Response(`<link rel="canonical" href="${SITE}/">`, {
      headers: { "content-type": "text/html" },
    });
  };
  const broken = await runAudit({ cities: [city], fetchImpl: brokenFetch });
  assert.equal(broken.passed, false);
  assert.ok(
    broken.stockUrlChecks.every((entry) =>
      entry.errors.includes("crawler:canonical_mismatch"),
    ),
  );
});
