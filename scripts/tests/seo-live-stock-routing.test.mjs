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
const slug = "nivus-x-fastback";
const pair = { slug, left: { brand: "VOLKSWAGEN", model: "NIVUS", label: "Nivus" }, right: { brand: "FIAT", model: "FASTBACK", label: "Fastback" }, stockNote: "Confira estas unidades." };
const vehicle = (id, model, price) => ({ id, marca: model === "NIVUS" ? "VOLKSWAGEN" : "FIAT", modelo: model, valor: price, ano: 2024, km: 10000, cambio: "AUTOMATICO", imagens_site: { tem_fotos: 0 } });
const current = [vehicle("90001", "NIVUS", 120000), vehicle("90002", "FASTBACK", 125000), vehicle("90003", "FASTBACK", 126000), vehicle("90004", "FASTBACK", 0)];
current[0].imagens_site = { tem_fotos: 1, capa_thumb: "./imagens/veiculos_automacar/fixture photo (1).png" };

function fixture(apiBase) {
  const directory = mkdtempSync(join(tmpdir(), "netcar-live-seo-"));
  for (const folder of ["seo", "seo-static"]) mkdirSync(join(directory, folder));
  for (const file of ["seo-comparison.php", "seo-sitemap.php", "seo/comparison-stock.php", "seo/sitemap-stock.php", "seo/landing-stock.php", "seo/helpers.php", "vehicle-images.php", "vehicle-image-exclusions.json"]) copyFileSync(join(root, "public", file), join(directory, file));
  writeFileSync(join(directory, "netcar-config.php"), `<?php define('NETCAR_API_BASE_URL', '${apiBase}');\n`);
  writeFileSync(join(directory, "seo/comparisons.json"), JSON.stringify([pair]));
  for (const isPair of [false, true]) {
    const path = `/comparar${isPair ? `/${slug}` : ""}`;
    const template = `<!doctype html><html><head><title>Fixture ${isPair ? "pair" : "hub"}</title><link rel="canonical" href="${site}${path}"><meta property="og:image" content="${site}/images/loja1.jpg"><script type="application/ld+json">{"@type":"WebPage","name":"Preserved editorial"}</script></head><body><h1>Compare carros</h1>${isPair ? "" : "<!--netcar:comparison-examples:start--><a href='/veiculo/sold-90004'>Stale example</a><!--netcar:comparison-examples:end-->"}<!--netcar:comparison-stock:start--><a href="/veiculo/sold-90004">Stale R$ 999.999</a><!--netcar:comparison-stock:end--><p>Preserved editorial copy.</p></body></html>`;
    writeFileSync(join(directory, "seo-static", isPair ? `comparison-${slug}.html` : "page-comparar.html"), template);
  }
  writeFileSync(join(directory, "sitemap.xml"), `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}/seminovos-canoas</loc><lastmod>2026-10-01</lastmod></url><url><loc>${site}/veiculo/sold-90004</loc><lastmod>2026-10-01</lastmod></url></urlset>`);
  return directory;
}

async function renderController(directory, controller, route) {
  const harness = `ob_start(); register_shutdown_function(function () { $html = ob_get_clean(); echo json_encode(array('status' => http_response_code() ?: 200, 'html' => $html)); }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  return new Promise((resolve, reject) => {
    const child = spawn(php, ["-d", "display_errors=stderr", "-r", harness, join(directory, controller), route]);
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Live SEO controller exceeded test deadline")); }, 12000);
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

test("live stock routing precedes stale files and uses bounded successful HTTP caching", () => {
  const read = (file) => readFileSync(join(root, file), "utf8");
  const htaccess = read("public/.htaccess");
  assert.ok(htaccess.indexOf("RewriteRule ^sitemap\\.xml$ seo-sitemap.php [L]") < htaccess.indexOf("RewriteCond %{REQUEST_FILENAME} -f"));
  assert.ok(htaccess.includes("RewriteRule ^comparar/?$ seo-comparison.php [L]"));
  assert.ok(htaccess.includes("RewriteRule ^comparar/([a-z0-9-]+)/?$ seo-comparison.php [L]"));
  const vary = htaccess.match(/<If "[^\n]*comparar[^\n]*">([\s\S]*?)<\/If>/)?.[1];
  assert.match(vary || "", /Header always merge Vary "User-Agent"/);
  assert.ok(htaccess.includes("/+comparar(?:/[a-z0-9-]+)?/?[? ]"), "UA variance applies to both normal and crawler hub/pair responses");
  for (const file of ["public/seo-comparison.php", "public/seo-sitemap.php"]) {
    const source = read(file);
    assert.match(source, /Cache-Control: public, max-age=60, s-maxage=60, must-revalidate/);
    assert.match(source, /Cache-Control: no-store/);
    assert.match(source, /http_response_code\(503\)/);
    assert.match(source, /Retry-After: 60/);
    assert.ok(source.indexOf("exit;") < source.indexOf("Cache-Control: public"));
  }
  const generator = read("scripts/generate-seo-assets.js");
  assert.match(generator, /join\(publicDir, "seo", "comparisons.json"\)/);
  assert.equal((generator.match(/<!--netcar:comparison-stock:start-->/g) || []).length, 2);
  assert.match(generator, /<!--netcar:comparison-examples:start-->/);
});

test("live SEO PHP render and XML unit checks", phpOnly, () => {
  const result = spawnSync(php, [join(root, "scripts/tests/seo-live-stock.test.php")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /38 checks passed/);
});

test("real controllers reconcile stale build artifacts on every complete API read", phpOnly, async (t) => {
  let mode = "current";
  const requests = [];
  const api = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const offset = Number(url.searchParams.get("offset"));
    requests.push(offset);
    response.setHeader("Content-Type", "application/json");
    if (mode === "failure" || (mode === "partial" && offset > 0)) return response.writeHead(503).end('{}');
    if (mode === "malformed") return response.writeHead(200).end('bad JSON');
    const source = mode === "sold" ? current.map((item) => ({ ...item, valor: 0 })) : mode === "empty" ? [] : current;
    const data = source.slice(offset, offset + 2);
    response.writeHead(data.length ? 200 : 404).end(JSON.stringify({ success: data.length > 0, data, total_results: data.length, ...(data.length ? {} : { message: "Nenhum carro encontrado" }) }));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const directory = fixture(`http://127.0.0.1:${api.address().port}/api/v1`);
  const artifacts = ["sitemap.xml", "seo-static/page-comparar.html", `seo-static/comparison-${slug}.html`];
  const before = artifacts.map((file) => readFileSync(join(directory, file), "utf8"));
  t.after(async () => { await new Promise((resolve) => api.close(resolve)); rmSync(directory, { recursive: true, force: true }); });

  for (const route of ["/comparar?veiculo=90004&utm_source=google", `/comparar/${slug}/?gclid=example`]) {
    requests.length = 0;
    const result = await renderController(directory, "seo-comparison.php", route);
    assert.equal(result.status, 200);
    assert.doesNotMatch(result.html, /90004|999\.999|Stale/);
    assert.match(result.html, /Preserved editorial copy/);
    assert.match(result.html, /"name":"Preserved editorial"/);
    assert.match(result.html, /\/veiculo\/fastback-2024-90002/);
    const photo = `${site}/imagens/veiculos_automacar/fixture%20photo%20%281%29.png`;
    assert.ok(result.html.includes(`<img src="${photo}"`), "actual controller resolves the API photo against site root, not the nested route");
    if (route.startsWith(`/comparar/${slug}`)) assert.ok(result.html.includes(`property="og:image" content="${photo}"`));
    assert.deepEqual(requests, [0, 2, 4], "one complete read, no per-car API request");
    const canonical = result.html.match(/rel="canonical" href="([^"]+)"/)[1];
    assert.equal(canonical, site + route.split("?")[0].replace(/\/$/, ""));
    const schema = JSON.parse(result.html.match(/data-netcar-comparison-stock>(.*?)<\/script>/s)[1]);
    assert.equal(schema.numberOfItems, route.startsWith(`/comparar/${slug}`) ? 2 : 3);
    for (const { url } of schema.itemListElement) assert.ok(result.html.includes(`href="${url}"`));
  }
  requests.length = 0;
  const sitemap = await renderController(directory, "seo-sitemap.php", "/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.html, /fastback-2024-90003/);
  assert.doesNotMatch(sitemap.html, /90004/);
  assert.match(sitemap.html, /<lastmod>2026-10-01<\/lastmod>/);
  assert.deepEqual(requests, [0, 2, 4]);

  for (const broken of ["failure", "partial", "malformed", "empty"]) {
    mode = broken;
    for (const [controller, route] of [["seo-comparison.php", "/comparar"], ["seo-sitemap.php", "/sitemap.xml"]]) {
      const result = await renderController(directory, controller, route);
      assert.equal(result.status, 503, `${controller} ${broken} cannot turn incomplete data into unavailable stock`);
      assert.doesNotMatch(result.html, /90004|90001|<urlset|ItemList|class="blog-car"/);
    }
  }
  mode = "sold";
  const sold = await renderController(directory, "seo-comparison.php", `/comparar/${slug}`);
  assert.equal(sold.status, 200);
  assert.match(sold.html, /data-comparison-stock="empty"/);
  assert.match(sold.html, /numberOfItems":0/);
  const soldMap = await renderController(directory, "seo-sitemap.php", "/sitemap.xml");
  assert.equal(soldMap.status, 200);
  assert.doesNotMatch(soldMap.html, /\/veiculo\//);
  for (const route of ["/comparar/not-published", "/comparar/../../sitemap.xml", "/comparar/invalid.php"]) {
    requests.length = 0;
    assert.equal((await renderController(directory, "seo-comparison.php", route)).status, 404);
    assert.deepEqual(requests, [], "invalid routes do not query stock");
  }
  assert.deepEqual(artifacts.map((file) => readFileSync(join(directory, file), "utf8")), before, "runtime never overwrites generated files");
});
