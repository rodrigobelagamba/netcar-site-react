import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");
const controller = read("public/index.php");
const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-v"], { encoding: "utf8" }).status === 0;
const phpOnly = {
  skip: hasPhp
    ? false
    : "PHP CLI unavailable; set NETCAR_PHP_BINARY to test the real controller",
};
const directory = realpathSync(
  mkdtempSync(join(tmpdir(), "netcar-stock-preload-")),
);
after(() => rmSync(directory, { recursive: true, force: true }));

for (const name of ["seo", ".vite"]) mkdirSync(join(directory, name));
for (const name of [
  "index.php",
  "home-hero.php",
  "vehicle-images.php",
  "vehicle-image-exclusions.json",
  "404.html",
])
  copyFileSync(join(root, "public", name), join(directory, name));
copyFileSync(join(root, "index.html"), join(directory, "index.html"));
writeFileSync(
  join(directory, "seo/stock-bootstrap.json"),
  JSON.stringify({
    generatedAt: "2026-10-24T12:00:00Z",
    vehicles: [
      {
        id: "101",
        name: "PEUGEOT 2008",
        modelo: "2008",
        marca: "PEUGEOT",
        price: 100000,
        images: ["/imagens/peugeot.jpg"],
      },
      {
        id: "102",
        name: "FIAT ARGO",
        modelo: "ARGO",
        marca: "FIAT",
        price: 80000,
        images: ["/imagens/argo.jpg"],
      },
    ],
    showroomVehicles: [
      {
        id: "101",
        name: "PEUGEOT 2008",
        modelo: "2008",
        marca: "PEUGEOT",
        price: 100000,
        images: ["/imagens/peugeot.jpg"],
      },
      {
        id: "102",
        name: "FIAT ARGO",
        modelo: "ARGO",
        marca: "FIAT",
        price: 80000,
        images: ["/imagens/argo.jpg"],
      },
      {
        id: "103",
        name: "SOLD CAR",
        modelo: "SOLD",
        price: 0,
        images: ["/imagens/sold.jpg"],
      },
    ],
  }),
);
writeFileSync(
  join(directory, ".vite/manifest.json"),
  JSON.stringify({
    "src/modules/seminovos/pages/SeminovosPage.tsx": {
      file: "assets/stock-fixture.js",
    },
  }),
);

function render(route) {
  const harness = `ob_start(); register_shutdown_function(function () {
    echo json_encode(array('status' => http_response_code() ?: 200, 'html' => ob_get_clean()));
  }); $_SERVER['REQUEST_URI'] = $argv[2]; require $argv[1];`;
  const result = spawnSync(
    php,
    ["-r", harness, join(directory, "index.php"), route],
    { encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, "");
  const response = JSON.parse(result.stdout);
  assert.equal(response.status, 200, route);
  return response.html;
}

function assertStockPreserved(html) {
  assert.match(
    html,
    /<title>Carros Seminovos e Usados em Esteio\/RS \| Netcar Multimarcas<\/title>/,
  );
  assert.match(
    html,
    /rel="canonical" href="https:\/\/www\.netcarmultimarcas\.com\.br\/seminovos"/,
  );
  assert.match(html, /rel="modulepreload"[^>]+\/assets\/stock-fixture\.js/);
  const bootstrap = JSON.parse(
    html.match(/window\.__NETCAR_STOCK__=(.*?);<\/script>/)[1],
  );
  assert.equal(bootstrap.scope, "showroom");
  assert.deepEqual(
    bootstrap.vehicles.map(({ id }) => id),
    ["101", "102", "103"],
  );
}

function assertNoSpeculativeImage(html) {
  assert.doesNotMatch(html, /<link\b[^>]*rel="preload"[^>]*as="image"/);
  assert.match(html, /<div id="netcar-initial-lcp"><\/div>/);
  assertStockPreserved(html);
}

test("PHP filter guard covers every accepted stock route search key", () => {
  const route = read("src/app/router/routes.tsx")
    .split("const seminovosRoute = createRoute(")[1]
    .split("const detalhesRoute")[0];
  const keys = [...route.matchAll(/^      (\w+):/gm)].map((match) => match[1]);
  const guard = controller
    .split("function netcar_stock_request_has_filters()")[1]
    .split("/** Veículo")[0];
  const phpKeys = [
    ...guard
      .match(/\$filterKeys = array\(([\s\S]*?)\);/)[1]
      .matchAll(/'([^']+)'/g),
  ].map((match) => match[1]);
  assert.deepEqual(phpKeys.sort(), keys.sort());
  assert.ok(keys.includes("marca") && keys.includes("busca"));
  if (process.env.CI)
    assert.ok(hasPhp, "PHP is required for preload regression coverage in CI");
});

test(
  "unfiltered and tracking-only entries retain their existing image preload",
  phpOnly,
  () => {
    for (const query of [
      "",
      "?",
      "?utm_source=instagram&utm_campaign=estoque",
      "?gclid=abc&fbclid=xyz",
      "?marca=&busca=",
      "?unknown=value",
    ]) {
      const html = render(`/seminovos${query}`);
      assert.match(html, /<link rel="preload" as="image"[^>]*peugeot\.jpg/);
      assert.match(html, /<div id="netcar-initial-lcp"><img[^>]+peugeot\.jpg/);
      assertStockPreserved(html);
    }
  },
);

test(
  "every active filter omits both speculative preload and hidden eager image",
  phpOnly,
  () => {
    for (const query of [
      "marca=FIAT",
      "modelo=ARGO",
      "busca=polo",
      "precoMin=30000",
      "precoMax=80000",
      "anoMin=2020",
      "anoMax=2025",
      "cambio=MANUAL",
      "combustivel=FLEX",
      "cor=PRETO",
      "categoria=SUV",
      "busca=nenhum-carro-corresponde",
      "utm_source=instagram&marca=FIAT",
      "precoMin=0",
      "marca=+",
    ])
      assertNoSpeculativeImage(render(`/seminovos?${query}`));
  },
);

test(
  "encoded, repeated and array filters fail closed without guessing a cover",
  phpOnly,
  () => {
    for (const query of [
      "mar%63a=FIAT",
      "marca=FIAT&marca=",
      "busca=&busca=polo",
      "marca%5B%5D=FIAT",
      "marca%5B%5D=",
      "marca[0]=FIAT",
      "busca=%26marca%3DFIAT",
      "precoMax=80000&marca=FIAT",
    ])
      assertNoSpeculativeImage(render(`/seminovos/?${query}`));
  },
);

test(
  "detail pages keep the requested car preload even with stock-like parameters",
  phpOnly,
  () => {
    for (const route of [
      "/veiculo/fiat-argo-102?marca=FIAT",
      "/veiculo/102?busca=polo&utm_source=instagram",
    ]) {
      const html = render(route);
      assert.match(html, /<link rel="preload" as="image"[^>]*argo\.jpg/);
      assert.match(html, /<div id="netcar-initial-lcp"><img[^>]+argo\.jpg/);
      assert.doesNotMatch(
        html,
        /<link rel="preload" as="image"[^>]*peugeot\.jpg/,
      );
    }
  },
);
