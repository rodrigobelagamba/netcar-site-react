import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const controller = read("public/index.php");
const htaccess = read("public/.htaccess");
const directoryRules = read("public/tablet/.htaccess");
const entry = "src/modules/tablet/pages/TabletPage.tsx";
const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-v"], { encoding: "utf8" }).status === 0;
const phpOnly = { skip: hasPhp ? false : "PHP CLI unavailable; set NETCAR_PHP_BINARY to test the real controller" };
const fixtures = [];

after(() => {
  for (const directory of fixtures) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "netcar-tablet-routing-"));
  fixtures.push(directory);
  for (const folder of ["seo", ".vite"]) mkdirSync(join(directory, folder));
  for (const name of ["index.php", "vehicle-images.php", "vehicle-image-exclusions.json", "404.html"])
    copyFileSync(join(root, "public", name), join(directory, name));
  copyFileSync(join(root, "index.html"), join(directory, "index.html"));
  writeFileSync(join(directory, "seo/stock-bootstrap.json"), JSON.stringify({
    generatedAt: "2026-10-01T12:00:00Z",
    vehicles: [{ id: "available-tablet-car", price: 80000 }],
    showroomVehicles: [{ id: "available-tablet-car", price: 80000 }, { id: "sold-tablet-car", price: 0 }],
  }));
  writeFileSync(join(directory, ".vite/manifest.json"), JSON.stringify({
    [entry]: { file: "assets/tablet-fixture.js", imports: ["_shared.js"] },
    "_shared.js": { file: "assets/shared-fixture.js" },
  }));
  return directory;
}

function renderPhp(route) {
  const harness = `ob_start(); register_shutdown_function(function () {
    $html = ob_get_clean();
    echo json_encode(array('status' => http_response_code() ?: 200, 'html' => $html));
  }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  const result = spawnSync(php, ["-r", harness, join(fixture(), "index.php"), route], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("tablet entry bypasses the old directory before real-file routing", () => {
  const rule = "RewriteRule ^tablet/$ index.php [L,QSA]";
  assert.ok(htaccess.includes(rule));
  assert.ok(htaccess.indexOf(rule) < htaccess.indexOf("RewriteCond %{REQUEST_FILENAME} -f"));
  assert.doesNotMatch(htaccess, /^\s*RewriteCond %\{REQUEST_FILENAME\} -d\s*$/m);
  const pattern = new RegExp(rule.split(" ")[1]);
  assert.ok(pattern.test("tablet/"));
  for (const path of ["tablet/images/car.jpg", "tablet/api.php", "tablet/carrotb-car.html", "tablets/"])
    assert.equal(pattern.test(path), false, path);
});

test("only exact old tablet entry aliases redirect and preserve query filters", () => {
  const rule = "RewriteRule ^tablet/(index\\.php|seminovos\\.html)$ /tablet/ [R=302,L]";
  assert.ok(htaccess.includes(rule));
  assert.ok(htaccess.includes("RewriteRule ^tablet$ /tablet/ [R=302,L]"));
  assert.ok(htaccess.indexOf(rule) < htaccess.indexOf("RewriteCond %{REQUEST_FILENAME} -f"));
  const pattern = new RegExp(rule.split(" ")[1]);
  for (const path of ["tablet/index.php", "tablet/seminovos.html"]) assert.ok(pattern.test(path), path);
  for (const path of ["tablet/index.php/extra", "tablet/images/index.php", "tablet/seminovosXhtml", "seminovos.html"])
    assert.equal(pattern.test(path), false, path);
});

test("tablet has isolated route metadata, noindex in HTML and HTTP header", () => {
  assert.match(controller, /'\/tablet' => \[[\s\S]*?'canonical' => 'https:\/\/www\.netcarmultimarcas\.com\.br\/tablet\/'[\s\S]*?'robots' => 'noindex, follow'/);
  assert.match(controller, /if \(\$path === '\/tablet'\) \{\s*header\('X-Robots-Tag: noindex, follow'\);/);
  assert.ok(controller.includes(`if ($path === '/tablet') return '${entry}';`));
  assert.ok(controller.includes("|| $path === '/tablet'"));
  // Only the showroom may include sold records; tablet gets the available payload.
  const stockFunction = controller.split("function netcar_stock_bootstrap_script($path)")[1].split("/** Veículo")[0];
  assert.ok(stockFunction.includes("'scope' => $path === '/seminovos' ? 'showroom' : 'available'"));
  assert.ok(!stockFunction.includes("'/tablet'"));
});

test("legacy tablet directory routes locally when Apache replaces parent rules", () => {
  assert.match(directoryRules, /RewriteEngine On/);
  assert.ok(directoryRules.includes("RewriteRule ^$ /index.php [END,QSA]"));
  const aliasRule = "RewriteRule ^(index\\.php|seminovos\\.html)$ /tablet/ [R=302,L]";
  assert.ok(directoryRules.includes(aliasRule));
  assert.ok(directoryRules.includes("RewriteRule ^ https://www.netcarmultimarcas.com.br%{REQUEST_URI} [R=301,L]"));
  assert.ok(directoryRules.indexOf(aliasRule) < directoryRules.indexOf("RewriteRule ^carrotb-"));
  // Existing car links and static HTML aliases stay untouched.
  assert.ok(directoryRules.includes("RewriteRule ^carrotb-(.*)\\.html$ tablet_carro.php?id=$1"));
  assert.ok(directoryRules.includes("RewriteCond %{REQUEST_FILENAME}\\.html -f"));
  assert.ok(directoryRules.includes("RewriteRule ^(.*)$ $1.html"));
  const aliases = new RegExp(aliasRule.split(" ")[1]);
  for (const path of ["images/car.jpg", "tablet_carro.php", "carrotb-123.html", "index.php/extra"])
    assert.equal(aliases.test(path), false, path);
});

test("PHP fixture contains the production dependencies", () => {
  const directory = fixture();
  assert.equal(readFileSync(join(directory, "index.php"), "utf8"), controller);
  assert.equal(readFileSync(join(directory, "vehicle-images.php"), "utf8"), read("public/vehicle-images.php"));
});

test("PHP serves tablet with noindex, correct preload and available stock only", phpOnly, () => {
  for (const route of ["/tablet", "/tablet/", "/tablet/?precoMax=100000"]) {
    const { status, html } = renderPhp(route);
    assert.equal(status, 200, route);
    assert.match(html, /<title>Estoque para atendimento \| Netcar<\/title>/);
    assert.match(html, /<meta name="robots" content="noindex, follow"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.netcarmultimarcas\.com\.br\/tablet\/"/);
    assert.match(html, /rel="modulepreload"[^>]+\/assets\/tablet-fixture\.js/);
    assert.match(html, /"scope":"available"/);
    assert.match(html, /available-tablet-car/);
    assert.doesNotMatch(html, /sold-tablet-car/);
  }
});

test("PHP still rejects unknown tablet subpaths", phpOnly, () => {
  for (const route of ["/tablet/missing", "/tablet-not-found", "/tablet/../admin"]) {
    assert.equal(renderPhp(route).status, 404, route);
  }
});
