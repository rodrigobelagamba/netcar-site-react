import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-r", "exit(function_exists('curl_init') ? 0 : 1);"], { encoding: "utf8" }).status === 0;
const phpOnly = { skip: hasPhp ? false : "PHP CLI with cURL unavailable; set NETCAR_PHP_BINARY" };
const site = "https://www.netcarmultimarcas.com.br";
const routes = new Map([
  ["/vender-carro-campo-bom", "sell-city-campo-bom.html"],
  ["/seminovos-campo-bom", "city-campo-bom.html"],
  ["/blog/fixture-article", "blog-fixture-article.html"],
  ["/carro-de-locadora-vale-a-pena", "page-carro-de-locadora-vale-a-pena.html"],
  ["/expointer-esteio", "page-expointer-esteio.html"],
]);
const vehicle = (id, price) => ({ id: String(id), marca: "VOLKSWAGEN", modelo: `MODELO ${id}`, valor: price, ano: 2026, km: 10000, cambio: "AUTOMATICO", imagens_site: { tem_fotos: 1, capa_thumb: `./imagens/photo ${id}.png` } });
const initialStock = [vehicle(20018, 156900), vehicle(20019, 129900), vehicle(20021, 0)];
const updatedStock = [vehicle(20019, 127900), vehicle(20020, 139900), vehicle(20021, 0)];
function fixture(apiBase) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-showcase-stock-"));
  for (const folder of ["seo", "seo-static"]) mkdirSync(join(directory, folder));
  for (const file of ["seo-showcase.php", "seo/showcase-stock.php", "seo/comparison-stock.php", "seo/landing-stock.php", "seo/helpers.php", "vehicle-images.php", "vehicle-image-exclusions.json"]) copyFileSync(join(root, "public", file), join(directory, file));
  writeFileSync(join(directory, "netcar-config.php"), `<?php define('NETCAR_API_BASE_URL', '${apiBase}');\n`);
  for (const [route, file] of routes) {
    const config = { version: 1, mode: route.startsWith("/blog/") ? "ids" : "selection", ids: ["20018", "20019"], heading: "Veículos atuais", limit: 8, order: "api" };
    const marker = Buffer.from(JSON.stringify(config)).toString("base64");
    writeFileSync(join(directory, "seo-static", file), `<!doctype html><html><head><title>Editorial</title><link rel="canonical" href="${site}${route}"><script type="application/ld+json">{"@type":"WebPage","name":"Preserved schema"}</script></head><body><p>Preserved editorial.</p><!--netcar:showcase:${marker}:start--><a href="/veiculo/old-20018">Stale R$ 999.999</a><!--netcar:showcase:end--></body></html>`);
  }
  return directory;
}
async function render(directory, route) {
  const harness = `ob_start(); register_shutdown_function(function () { $html = ob_get_clean(); echo json_encode(array('status' => http_response_code() ?: 200, 'html' => $html)); }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  return new Promise((resolve, reject) => {
    const child = spawn(php, ["-d", "display_errors=stderr", "-r", harness, join(directory, "seo-showcase.php"), route]);
    let stdout = "", stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Showcase controller exceeded test deadline")); }, 12000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timeout);
      try { assert.equal(code, 0, stderr); assert.equal(stderr, ""); resolve(JSON.parse(stdout)); }
      catch (error) { reject(error); }
    });
  });
}
function schema(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1])).find((item) => item["@type"] === "ItemList");
}

test("all generated showcase routes use live controller and direct artifacts cannot bypass it", () => {
  const htaccess = readFileSync(join(root, "public/.htaccess"), "utf8");
  for (const rule of [
    "RewriteRule ^blog/([^/]+)/?$ seo-showcase.php [L]",
    "RewriteRule ^seminovos-([a-z0-9-]+)/?$ seo-showcase.php [L]",
    "RewriteRule ^vender-carro-([a-z0-9-]+)/?$ seo-showcase.php [L]",
    "RewriteRule ^regioes-atendidas/?$ seo-showcase.php [L]",
  ]) assert.ok(htaccess.includes(rule), rule);
  assert.match(htaccess, /RewriteRule \^\([^\n]*expointer-esteio[^\n]*seo-showcase\.php \[L\]/);
  const direct = htaccess.indexOf("RewriteRule ^seo-static/[^/]+\\.html$ seo-showcase.php [L]");
  assert.ok(direct >= 0 && direct < htaccess.indexOf("RewriteCond %{REQUEST_FILENAME} -f"), "artifact rewrite precedes existing-file short circuit");
  const shellHeaders = htaccess.match(/<Files "index.php">([\s\S]*?)<\/Files>/)[1];
  assert.match(shellHeaders, /Header always set Cache-Control "no-store"/);
  assert.doesNotMatch(shellHeaders, /Cache-Control "public/);
  const controller = readFileSync(join(root, "public/seo-showcase.php"), "utf8");
  assert.match(controller, /Cache-Control: no-store/);
  assert.doesNotMatch(controller, /Cache-Control: public/);
  assert.match(controller, /Vary: User-Agent/);
  assert.match(controller, /http_response_code\(503\)/);
  assert.match(controller, /Retry-After: 60/);
});

test("showcase PHP unit checks", phpOnly, () => {
  const result = spawnSync(php, [join(root, "scripts/tests/showcase-stock.test.php")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /Showcase live stock PHP: \d+ checks passed/);
});

test("showcase controller replaces stale regional/article offers after entry, removal and price update", phpOnly, async (t) => {
  let mode = "initial";
  const requests = [];
  const api = createServer((request, response) => {
    const offset = Number(new URL(request.url, "http://localhost").searchParams.get("offset"));
    requests.push(offset);
    response.setHeader("Content-Type", "application/json");
    if (mode === "failure" || (mode === "partial" && offset > 0)) return response.writeHead(503).end('{}');
    if (mode === "malformed") return response.writeHead(200).end('bad JSON');
    const source = mode === "empty" ? [] : mode === "zero" ? updatedStock.map((row) => ({ ...row, valor: 0 })) : mode === "initial" ? initialStock : updatedStock;
    const data = source.slice(offset, offset + 2);
    response.writeHead(data.length ? 200 : 404).end(JSON.stringify({ success: data.length > 0, data, total_results: data.length, ...(data.length ? {} : { message: "Nenhum carro encontrado" }) }));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const directory = fixture(`http://127.0.0.1:${api.address().port}/api/v1`);
  const before = [...routes.values()].map((file) => readFileSync(join(directory, "seo-static", file), "utf8"));
  t.after(async () => { await new Promise((resolve) => api.close(resolve)); rmSync(directory, { recursive: true, force: true }); });
  for (const route of routes.keys()) {
    mode = "initial";
    const initial = await render(directory, route);
    assert.equal(initial.status, 200);
    assert.match(initial.html, /156\.900/);
    mode = "updated";
    requests.length = 0;
    const current = await render(directory, route + "/?utm_source=fixture");
    assert.equal(current.status, 200);
    assert.doesNotMatch(current.html, /20018|20021|156\.900|129\.900|999\.999|Stale/);
    assert.match(current.html, /127\.900/);
    assert.match(current.html, /Preserved editorial\./);
    assert.match(current.html, /"name":"Preserved schema"/);
    assert.ok(current.html.includes(`rel="canonical" href="${site}${route}"`));
    assert.ok(current.html.includes(`${site}/imagens/photo%2020019.png`));
    assert.deepEqual(requests, [0, 2, 3], "all pages read to terminal pagination once per request");
    const currentSchema = schema(current.html);
    assert.equal(currentSchema.numberOfItems, route.startsWith("/blog/") ? 1 : 2);
    if (route.startsWith("/blog/")) assert.doesNotMatch(current.html, /20020/);
    else assert.match(current.html, /20020/);
    for (const { url } of currentSchema.itemListElement) assert.ok(current.html.includes(`href="${url}"`));
  }
  // Outages must not take down unrelated editorial pages; old offer fragments
  // without the new manifest must never silently fall back to stale prices.
  const editorialFile = join(directory, "seo-static", "page-politica-editorial.html");
  writeFileSync(editorialFile, '<html><head><title>Editorial only</title></head><body>Editorial-only content.</body></html>');
  mode = "failure";
  requests.length = 0;
  const editorialOnly = await render(directory, "/politica-editorial");
  assert.equal(editorialOnly.status, 200);
  assert.match(editorialOnly.html, /Editorial-only content/);
  assert.deepEqual(requests, [], "no stock dependency on editorial-only page");
  writeFileSync(editorialFile, '<html><head><title>Old build</title></head><body><a class="blog-car" href="/veiculo/old-20018">R$ 156.900</a></body></html>');
  const oldBuild = await render(directory, "/politica-editorial");
  assert.equal(oldBuild.status, 503, "an older template cannot bypass current-stock reconciliation");
  assert.doesNotMatch(oldBuild.html, /20018|156\.900/);
  for (const broken of ["failure", "partial", "malformed", "empty"]) {
    mode = broken;
    const result = await render(directory, "/vender-carro-campo-bom");
    assert.equal(result.status, 503, `${broken} must not be accepted as no stock`);
    assert.doesNotMatch(result.html, /20018|20019|ItemList|class="blog-car"/);
  }
  mode = "zero";
  const zero = await render(directory, "/vender-carro-campo-bom");
  assert.equal(zero.status, 200);
  assert.equal(schema(zero.html).numberOfItems, 0);
  assert.doesNotMatch(zero.html, /class="blog-car"|vendido/i);
  for (const invalid of ["/blog/missing", "/vender-carro-missing", "/blog/../../netcar-config.php", "/blog/%2e%2e/private", "/blog/fixture-article.php"]) {
    requests.length = 0;
    assert.equal((await render(directory, invalid)).status, 404, invalid);
    assert.deepEqual(requests, []);
  }
  requests.length = 0;
  assert.equal((await render(directory, "/seo-static/sell-city-campo-bom.html")).status, 301, "direct generated URL redirects to its live canonical");
  assert.deepEqual(requests, [], "canonical redirect does not fetch inventory");
  assert.deepEqual([...routes.values()].map((file) => readFileSync(join(directory, "seo-static", file), "utf8")), before, "runtime never changes generated or source files");
});
