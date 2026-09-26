import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  collectBuildPermissionTargets,
  isDeliveryRuntimePath,
} from "../lib/ssh-deploy.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const controller = read("public/index.php");
const htaccess = read("public/.htaccess");
const slugs = [
  "jeep-compass-x-honda-hr-v",
  "chevrolet-tracker-x-hyundai-creta",
  "volkswagen-nivus-x-fiat-fastback",
  "volkswagen-tera-x-volkswagen-t-cross",
];
const site = "https://www.netcarmultimarcas.com.br";
const comparisonEntry = "src/modules/seo/pages/ComparisonLandingPage.tsx";
const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-v"], { encoding: "utf8" }).status === 0;
const phpOnly = {
  skip: hasPhp
    ? false
    : "PHP CLI unavailable; set NETCAR_PHP_BINARY to exercise the real controller",
};
const fixtures = [];

after(() => {
  for (const directory of fixtures)
    rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "netcar-comparison-routing-"));
  fixtures.push(directory);
  for (const path of ["seo-static", "seo", ".vite"])
    mkdirSync(join(directory, path));
  copyFileSync(join(root, "public/index.php"), join(directory, "index.php"));
  copyFileSync(join(root, "index.html"), join(directory, "index.html"));
  copyFileSync(join(root, "public/404.html"), join(directory, "404.html"));
  for (const slug of [null, ...slugs]) {
    const route = slug ? `/comparar/${slug}` : "/comparar";
    const file = slug ? `comparison-${slug}.html` : "page-comparar.html";
    writeFileSync(
      join(directory, "seo-static", file),
      `<!doctype html><title>Comparison ${slug || "hub"}</title><meta name="description" content="Fixture comparison"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${site}${route}">`,
    );
  }
  writeFileSync(
    join(directory, "seo/stock-bootstrap.json"),
    JSON.stringify({
      generatedAt: "2026-09-26T00:00:00Z",
      vehicles: [{ id: "available-vehicle", price: 90000 }],
      showroomVehicles: [
        { id: "available-vehicle", price: 90000 },
        { id: "sold-vehicle", price: 0 },
      ],
    }),
  );
  writeFileSync(
    join(directory, ".vite/manifest.json"),
    JSON.stringify({
      [comparisonEntry]: {
        file: "assets/comparison-landing.js",
        imports: ["_shared.js"],
      },
      "src/modules/seo/pages/ComparadorPage.tsx": {
        file: "assets/comparison-hub.js",
      },
      "_shared.js": { file: "assets/shared.js" },
    }),
  );
  return directory;
}

function renderPhp(route, directory = fixture()) {
  // The real controller runs against only local fixtures; comparison requests
  // never need the banner API or an external inventory request.
  const harness = `ob_start(); register_shutdown_function(function () {
    $html = ob_get_clean();
    echo json_encode(array('status' => http_response_code() ?: 200, 'html' => $html));
  }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  const result = spawnSync(
    php,
    ["-r", harness, join(directory, "index.php"), route],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("crawler pair routes require their published HTML and precede the real 404 rule", () => {
  const rule =
    "RewriteRule ^comparar/([a-z0-9-]+)/?$ seo-static/comparison-$1.html [L]";
  const position = htaccess.indexOf(rule);
  assert.ok(position > 0);
  const block = htaccess.slice(
    htaccess.lastIndexOf("\n\n", position),
    position,
  );
  assert.match(block, /HTTP_USER_AGENT.*Googlebot/);
  assert.match(block, /HTTP_USER_AGENT.*WhatsApp/);
  assert.match(
    block,
    /RewriteCond %\{DOCUMENT_ROOT\}\/seo-static\/comparison-\$1\.html -f/,
  );
  const missingRule = htaccess.match(
    /RewriteRule (\^\(blog\/\[\^\/\]\+\|comparar\/[^\n]+) - \[R=404,L\]/,
  )?.[1];
  assert.ok(
    missingRule,
    "missing comparison route must return 404 for crawlers",
  );
  assert.ok(position < htaccess.indexOf(missingRule));
  const routePattern = new RegExp(rule.split(" ")[1]);
  for (const slug of slugs) {
    assert.equal(routePattern.exec(`comparar/${slug}`)?.[1], slug);
    assert.equal(routePattern.exec(`comparar/${slug}/`)?.[1], slug);
  }
  for (const route of [
    "comparar/",
    "comparar/a/b",
    "comparar/../secrets",
    "comparar/foo.php",
  ]) {
    assert.equal(routePattern.test(route), false);
  }
  assert.ok(new RegExp(missingRule).test("comparar/modelo-inexistente"));
});

test("normal route uses static metadata, its own chunk and available-stock bootstrap", () => {
  assert.ok(
    controller.includes("'#^/comparar/([a-z0-9-]+)$#' => 'comparison-%s.html'"),
  );
  assert.ok(controller.includes(comparisonEntry));
  const bootstrap = controller.slice(
    controller.indexOf("function netcar_route_uses_stock_bootstrap"),
    controller.indexOf("function netcar_stock_bootstrap_value"),
  );
  assert.ok(bootstrap.includes("$path === '/comparar'"));
  assert.ok(bootstrap.includes("#^/comparar/[a-z0-9-]+$#"));
  assert.ok(
    controller.includes("return is_file($fullPath) ? $fullPath : null;"),
  );
  assert.ok(
    controller.includes(
      "if (!netcar_is_valid_spa_route($path)) {\n    netcar_render_error(404);",
    ),
  );
  assert.ok(controller.includes("parse_url($requestUri, PHP_URL_PATH)"));
});

test("both deploy transports include all generated comparison documents automatically", () => {
  const directory = fixture();
  const sshTargets = collectBuildPermissionTargets(directory).map(
    (target) => target.path,
  );
  const deploy = read("scripts/deploy-local.js");
  const functionSource = deploy.slice(
    deploy.indexOf("function getAllDistFiles("),
    deploy.indexOf("async function uploadDist("),
  );
  const files = runInNewContext(
    `${functionSource}; getAllDistFiles(directory)`,
    { directory, readdirSync, statSync, join },
  );
  for (const slug of slugs) {
    const path = `seo-static/comparison-${slug}.html`;
    assert.ok(sshTargets.includes(path));
    assert.ok(files.includes(join(directory, path)));
    assert.equal(isDeliveryRuntimePath(path), false);
  }
});

test(
  "PHP serves each published pair with canonical metadata and matching preloads",
  phpOnly,
  () => {
    const directory = fixture();
    for (const slug of slugs) {
      const { status, html } = renderPhp(`/comparar/${slug}`, directory);
      assert.equal(status, 200);
      assert.ok(html.includes(`<title>Comparison ${slug}</title>`));
      assert.ok(
        html.includes(`rel="canonical" href="${site}/comparar/${slug}"`),
      );
      assert.match(
        html,
        /rel="modulepreload" crossorigin href="\/assets\/comparison-landing\.js"/,
      );
      assert.match(
        html,
        /rel="modulepreload" crossorigin href="\/assets\/shared\.js"/,
      );
      assert.match(html, /window\.__NETCAR_STOCK__=/);
      assert.match(html, /"scope":"available"/);
      assert.match(html, /available-vehicle/);
      assert.doesNotMatch(html, /sold-vehicle|comparison-hub\.js/);
      assert.doesNotMatch(html, /rel="preload" as="image"/);
    }
  },
);

test(
  "PHP consolidates trailing slashes and attribution queries without noindex",
  phpOnly,
  () => {
    const route = `/comparar/${slugs[0]}`;
    for (const suffix of [
      "/",
      "?utm_source=google&veiculo=19801",
      "/?gclid=example",
      "?_escaped_fragment_=",
    ]) {
      const { status, html } = renderPhp(route + suffix);
      assert.equal(status, 200);
      assert.ok(html.includes(`rel="canonical" href="${site}${route}"`));
      assert.match(html, /name="robots" content="index, follow/);
      assert.doesNotMatch(html, /noindex/);
    }
  },
);

test(
  "PHP returns real 404 for unpublished or malformed pairs even with tracking queries",
  phpOnly,
  () => {
    const directory = fixture();
    for (const route of [
      "/comparar/modelo-inexistente",
      "/comparar/modelo-inexistente?utm_source=google",
      "/comparar/foo/bar",
      "/comparar/%2e%2e/private",
      "/comparar/invalid.php",
    ]) {
      const { status, html } = renderPhp(route, directory);
      assert.equal(status, 404, route);
      assert.match(html, /noindex/);
      assert.doesNotMatch(html, /window\.__NETCAR_STOCK__/);
    }
    rmSync(join(directory, `seo-static/comparison-${slugs[0]}.html`));
    assert.equal(renderPhp(`/comparar/${slugs[0]}`, directory).status, 404);
  },
);

test(
  "PHP preserves the original comparison hub and its selection query",
  phpOnly,
  () => {
    const { status, html } = renderPhp("/comparar?veiculo=19801");
    assert.equal(status, 200);
    assert.ok(html.includes(`rel="canonical" href="${site}/comparar"`));
    assert.match(html, /assets\/comparison-hub\.js/);
    assert.doesNotMatch(html, /assets\/comparison-landing\.js|noindex/);
    assert.match(html, /window\.__NETCAR_STOCK__/);
  },
);
