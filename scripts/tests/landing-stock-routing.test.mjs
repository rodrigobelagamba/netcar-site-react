import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { marcaLanding } from "../generate-landings.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-r", "exit(function_exists('curl_init') ? 0 : 1);"], { encoding: "utf8" }).status === 0;
const phpOnly = { skip: hasPhp ? false : "PHP CLI with cURL unavailable; set NETCAR_PHP_BINARY to exercise the real controllers" };
const soldId = "90004";
const arrivalId = "90003";

function vehicle(id, price, year = 2024) {
  return { id, marca: "CHERY", modelo: `TIGGO ${id}`, valor: price, ano: year, km: 30000, cambio: "AUTOMATICO", categoria: "SUV", imagens_site: { tem_fotos: 0 } };
}
const current = [vehicle("90001", 137900, 2023), vehicle("90002", 149900), vehicle(arrivalId, 149900), vehicle(soldId, 0, 2025)];

function fixtures(apiBase) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-landing-routing-"));
  for (const folder of ["seo", "seo-static"]) mkdirSync(join(directory, folder));
  for (const file of ["index.php", "home-hero.php", "vehicle-images.php", "vehicle-image-exclusions.json", "seo-landing.php", "seo/landing-stock.php", "seo/helpers.php", "detalhe-veiculo.php", "404.html"]) {
    copyFileSync(join(root, "public", file), join(directory, file));
  }
  copyFileSync(join(root, "index.html"), join(directory, "index.html"));
  // Only the isolated fixture points at the local mock. Production PHP is copied unchanged.
  writeFileSync(join(directory, "netcar-config.php"), `<?php define('NETCAR_API_BASE_URL', '${apiBase}');\n`);
  const profile = { minPrice: "R$ 130.000", maxPrice: "R$ 151.900", minYear: 2023, maxYear: 2025 };
  const generatedLandings = join(root, "public/seo/landings.json");
  const landing = (existsSync(generatedLandings) && JSON.parse(readFileSync(generatedLandings, "utf8")).find((item) => item.slug === "chery" && item.paragraphTemplates)) || marcaLanding("CHERY", 4, profile, 6);
  writeFileSync(join(directory, "seo/landings.json"), JSON.stringify([landing]));
  const generatedTemplate = join(root, "public/seo-static/landing-chery.html");
  const fallback = `<!doctype html><html><head><title>${landing.title}</title><meta name="description" content="Compare Chery"><link rel="canonical" href="https://www.netcarmultimarcas.com.br/comprar-chery"><script type="application/ld+json" data-netcar-landing-collection>{}</script><script type="application/ld+json" data-netcar-landing-faq>{}</script></head><body><!--netcar:landing-stock:start--><!--netcar:landing-stock:end--><!--netcar:landing-paragraphs:start--><!--netcar:landing-paragraphs:end--><!--netcar:landing-faq:start--><!--netcar:landing-faq:end--></body></html>`;
  let template = existsSync(generatedTemplate) ? readFileSync(generatedTemplate, "utf8") : fallback;
  if (!template.includes("data-netcar-landing-collection")) template = fallback;
  // Deliberately stale build content proves request-time replacement, including
  // a sold unit and an old maximum price. These are fixture data, not ID rules.
  template = template.replace(/<!--netcar:landing-stock:start-->[\s\S]*?<!--netcar:landing-stock:end-->/, `<!--netcar:landing-stock:start--><a class="blog-car" href="/veiculo/tiggo-${soldId}">Sold fixture R$ 151.900</a><!--netcar:landing-stock:end-->`)
    .replace(/<!--netcar:landing-paragraphs:start-->[\s\S]*?<!--netcar:landing-paragraphs:end-->/, "<!--netcar:landing-paragraphs:start--><p>R$ 130.000 a R$ 151.900, anos 2023 a 2025.</p><!--netcar:landing-paragraphs:end-->");
  writeFileSync(join(directory, "seo-static/landing-chery.html"), template);
  const staleBootstrap = { generatedAt: "2026-01-01T00:00:00Z", vehicles: [
    { id: "90001", marca: "CHERY", modelo: "TIGGO 90001", price: 130000, year: 2023 },
    { id: "90002", marca: "CHERY", modelo: "TIGGO 90002", price: 149900, year: 2024 },
    { id: soldId, marca: "CHERY", modelo: `TIGGO ${soldId}`, price: 151900, year: 2025 },
  ] };
  writeFileSync(join(directory, "seo/stock-bootstrap.json"), JSON.stringify(staleBootstrap));
  return directory;
}

async function renderController(directory, name, route = "/comprar-chery") {
  // Async execution leaves Node free to answer the real PHP cURL requests.
  const harness = `ob_start(); register_shutdown_function(function () {
    $html = ob_get_clean();
    echo json_encode(array('status' => http_response_code() ?: 200, 'html' => $html));
  }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(php, ["-d", "display_errors=stderr", "-r", harness, join(directory, name), route], { cwd: directory });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("PHP controller exceeded the test deadline")); }, 12000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "", "controllers must not emit PHP warnings/errors");
  return JSON.parse(result.stdout);
}

function bootstrap(html) {
  const payload = html.match(/window\.__NETCAR_STOCK__=([\s\S]*?);<\/script>/)?.[1];
  return payload ? JSON.parse(payload) : null;
}

test("real landing controllers reconcile initial HTML and bootstrap against the current API", phpOnly, async (t) => {
  let mode = "current";
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const offset = Number(url.searchParams.get("offset"));
    requests.push({ path: url.pathname, offset });
    response.setHeader("Content-Type", "application/json");
    if (mode === "failure" || (mode === "partial" && offset > 0)) {
      response.writeHead(503).end(JSON.stringify({ success: false, data: [], total_results: 0 }));
      return;
    }
    const rows = current.slice(offset, offset + 2); // Exercise server-capped pagination.
    response.writeHead(rows.length ? 200 : 404).end(JSON.stringify({ success: rows.length > 0, data: rows, total_results: rows.length, ...(rows.length ? {} : { message: "Nenhum carro encontrado" }) }));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const directory = fixtures(`http://127.0.0.1:${server.address().port}/api/v1`);
  const preservedFiles = ["detalhe-veiculo.php", "seo/stock-bootstrap.json", "seo-static/landing-chery.html"];
  const before = new Map(preservedFiles.map((file) => [file, readFileSync(join(directory, file))]));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });

  await t.test("browser first paint contains current prices and new arrivals without the sold build record", async () => {
    requests.length = 0;
    const result = await renderController(directory, "index.php");
    assert.equal(result.status, 200);
    const initial = bootstrap(result.html);
    assert.equal(initial.scope, "available");
    assert.deepEqual(initial.vehicles.map(({ id, price }) => [id, price]), [["90001", 137900], ["90002", 149900], [arrivalId, 149900]]);
    assert.doesNotMatch(result.html, new RegExp(soldId));
    assert.doesNotMatch(result.html, /151900|151\.900/);
    assert.deepEqual(requests.map(({ offset }) => offset), [0, 2, 4], "one complete per-request read is reused by bootstrap/preload consumers");
    assert.ok(requests.every(({ path }) => path === "/api/v1/veiculos.php"));
  });

  await t.test("crawler cards, live range and ItemList all describe the same three current vehicles", async () => {
    const result = await renderController(directory, "seo-landing.php");
    assert.equal(result.status, 200);
    assert.equal((result.html.match(/class="blog-car"/g) || []).length, 3);
    assert.match(result.html, /R\$ 137\.900/);
    assert.match(result.html, /R\$ 149\.900/);
    assert.doesNotMatch(result.html, new RegExp(`${soldId}|151900|151\\.900|130\\.000`));
    const collection = JSON.parse(result.html.match(/<script[^>]*data-netcar-landing-collection[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(collection.mainEntity.numberOfItems, 3);
    assert.deepEqual(collection.mainEntity.itemListElement.map(({ url }) => url.match(/-([0-9]+)$/)[1]), ["90001", "90002", arrivalId]);
  });

  for (const failure of ["failure", "partial"]) {
    await t.test(`${failure} API response never restores stale offers or reports a false sold-out selection`, async () => {
      mode = failure;
      const browser = await renderController(directory, "index.php");
      assert.equal(browser.status, 200);
      assert.equal(bootstrap(browser.html), null);
      assert.doesNotMatch(browser.html, /90004|151900|151\.900/);
      const crawler = await renderController(directory, "seo-landing.php");
      assert.equal(crawler.status, 503);
      assert.match(crawler.html, /Não foi possível atualizar o estoque/);
      assert.doesNotMatch(crawler.html, /Nenhum veículo|vendido|SoldOut|90004|151\.900|ItemList/);
    });
  }

  await t.test("unknown landing keeps HTTP404 without consulting inventory", async () => {
    requests.length = 0;
    for (const controller of ["index.php", "seo-landing.php"]) {
      assert.equal((await renderController(directory, controller, "/comprar-missing-fixture")).status, 404);
    }
    assert.deepEqual(requests, []);
  });

  await t.test("request-time reconciliation preserves the historical detail controller and stored build artifacts", () => {
    for (const file of preservedFiles) assert.deepEqual(readFileSync(join(directory, file)), before.get(file), file);
    assert.deepEqual(readFileSync(join(directory, "detalhe-veiculo.php")), readFileSync(join(root, "public/detalhe-veiculo.php")));
  });
});
