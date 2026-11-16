import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import sharp from "sharp";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const controller = readFileSync(resolve(root, "public/index.php"), "utf8");
const surfaces = readFileSync(resolve(root, "src/features/black-friday/CampaignSurfaces.tsx"), "utf8");
const enabled = {
  id: "black-friday-2026", enabled: true,
  startsAt: "2026-11-11T00:00:00-03:00", endsAt: "2026-12-01T00:00:00-03:00",
};
const start = Date.parse(enabled.startsAt) / 1000;
const end = Date.parse(enabled.endsAt) / 1000;
const phpCommand = process.env.PHP_BIN || "php";
const nativePhp = spawnSync(phpCommand, ["-v"], { encoding: "utf8" }).status === 0;
const moduleRoot = process.env.PHP_WASM_MODULE_ROOT;
const hasPhp = nativePhp || Boolean(moduleRoot);
let php;

before(async () => {
  if (nativePhp || !moduleRoot) return;
  const importRuntime = (name) => import(pathToFileURL(resolve(moduleRoot, `@php-wasm/${name}/index.js`)).href);
  const [{ loadNodeRuntime }, { PHP }] = await Promise.all([importRuntime("node"), importRuntime("universal")]);
  php = new PHP(await loadNodeRuntime("8.2", { emscriptenOptions: { processId: process.pid } }));
});

after(async () => { await php?.exit(); });

async function runPhp(code) {
  if (nativePhp) {
    const result = spawnSync(phpCommand, ["-r", code], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout);
  }
  const result = await php.run({ code: `<?php ${code}` });
  assert.equal(result.errors, "");
  return result.json;
}

function controllerFunction(name) {
  const start = controller.indexOf(`function ${name}(`);
  const next = controller.indexOf("\nfunction ", start + 1);
  assert.ok(start >= 0 && next > start, `${name} must exist in the real controller`);
  return controller.slice(start, next);
}

const functions = [
  "netcar_black_friday_config", "netcar_black_friday_active", "netcar_prepend_critical_head_markup",
].map(controllerFunction).join("\n");
const branchStart = controller.indexOf("if ($isHome && $blackFridayActive) {");
const branchEnd = controller.indexOf("\n// Imagens críticas", branchStart);
assert.ok(branchStart >= 0 && branchEnd > branchStart);
const homeBranch = controller.slice(branchStart, branchEnd);
const phpValue = (value) => `json_decode(base64_decode('${Buffer.from(JSON.stringify(value)).toString("base64")}'), true)`;
const phpOptions = { skip: hasPhp ? false : "PHP CLI or PHP_WASM_MODULE_ROOT is required for execution" };

test("PHP controller syntax remains valid", phpOptions, async () => {
  const encoded = Buffer.from(controller).toString("base64");
  assert.equal(await runPhp(`token_get_all(base64_decode('${encoded}'), TOKEN_PARSE); echo 'true';`), true);
});

test("PHP bootstrap validates the same approved flag and date boundaries", phpOptions, async () => {
  const inputs = [enabled, { ...enabled, enabled: false }, null, {}, { ...enabled, enabled: "true" },
    { ...enabled, id: "another-campaign" }, { ...enabled, endsAt: "2026-12-31T00:00:00-03:00" }];
  const results = await runPhp(`
    ${functions}
    $file = tempnam(sys_get_temp_dir(), 'campaign-');
    $results = array();
    foreach (${phpValue(inputs)} as $input) {
      file_put_contents($file, json_encode($input));
      $config = netcar_black_friday_config($file);
      $states = array();
      foreach (array(${start - 1}, ${start}, ${end - 1}, ${end}) as $now) {
        $states[] = netcar_black_friday_active($config, $now);
      }
      $results[] = array('config' => $config, 'states' => $states);
    }
    unlink($file);
    $results[] = netcar_black_friday_config($file);
    echo json_encode($results);
  `);
  assert.deepEqual(results[0], { config: enabled, states: [false, true, true, false] });
  assert.deepEqual(results[1].states, [false, false, false, false]);
  for (const result of results.slice(2, -1)) {
    assert.equal(result.config, null);
    assert.deepEqual(result.states, [false, false, false, false]);
  }
  assert.equal(results.at(-1), null);
});

async function renderHome(config, now, isHome = true) {
  return runPhp(`
    ${functions}
    $bannerRequests = 0;
    function netcar_get_active_banner_url() { global $bannerRequests; $bannerRequests++; return null; }
    function netcar_get_build_home_lcp() { return array('id'=>'fixture', 'day'=>'fixture-day', 'image'=>'/images/fixture.png', 'hero'=>array('id'=>'fixture')); }
    function netcar_home_rotation_day() { return 'fixture-day'; }
    function netcar_banner_variant($url, $width) { return $url . '?w=' . $width; }
    $file = tempnam(sys_get_temp_dir(), 'campaign-');
    file_put_contents($file, json_encode(${phpValue(config)}));
    $blackFridayConfig = netcar_black_friday_config($file);
    unlink($file);
    $blackFridayActive = netcar_black_friday_active($blackFridayConfig, ${now});
    $isHome = ${isHome ? "true" : "false"};
    $html = '<html><head><meta name="viewport" content="width=device-width"></head><body><div id="netcar-initial-lcp"></div></body></html>';
    ${homeBranch}
    echo json_encode(array('html'=>$html, 'bannerRequests'=>$bannerRequests));
  `);
}

test("active campaign skips the unused car hero and preloads the image actually rendered by React", phpOptions, async () => {
  const result = await renderHome(enabled, start + 1);
  assert.equal(result.bannerRequests, 0, "Campaign home must not wait on the ordinary banner source");
  assert.match(result.html, /rel="preload"[^>]+title-v2\.webp/);
  assert.match(surfaces, /src=\{`\$\{MEDIA\}\/title-v2\.webp`\}/);
  assert.doesNotMatch(result.html, /fixture\.png|__NETCAR_HOME_HERO__|data-netcar-home-lcp|<img/);
});

test("rollback, invalid config and expiry restore the normal home image/preload", phpOptions, async () => {
  for (const [config, now] of [[{ ...enabled, enabled: false }, start + 1], [enabled, end], [enabled, start - 1], [null, start + 1]]) {
    const result = await renderHome(config, now);
    assert.equal(result.bannerRequests, 1);
    assert.match(result.html, /__NETCAR_HOME_HERO__/);
    assert.match(result.html, /rel="preload"[^>]+fixture\.png/);
    assert.match(result.html, /rel="preload"[^>]+data-netcar-home-lcp/);
    assert.match(result.html, /<img[^>]+fixture\.png/);
    assert.doesNotMatch(result.html, /title-v2\.webp/);
  }
  const otherRoute = await renderHome(enabled, start + 1, false);
  assert.equal(otherRoute.bannerRequests, 0);
  assert.doesNotMatch(otherRoute.html, /rel="preload"|fixture\.png|title-v2/);
});

test("ordinary home skeleton ignores campaign preloads after rollback or failed refresh", () => {
  const source = readFileSync(resolve(root, "src/modules/home/pages/HomePage.tsx"), "utf8");
  const ast = ts.createSourceFile("HomePage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reader = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "readInitialHomeLcpImage");
  assert.ok(reader);
  const compiled = ts.transpileModule(`${reader.getText(ast)}\nreadInitialHomeLcpImage();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const campaign = { rel: "preload", as: "image", fetchpriority: "high", href: "/campaign-title.webp" };
  const hero = { rel: "preload", as: "image", fetchpriority: "high", href: "/normal-hero.webp", "data-netcar-home-lcp": "", imagesrcset: "/normal-hero-small.webp 480w", imagesizes: "50vw" };
  const read = (links) => runInNewContext(compiled, {
    document: {
      querySelector(selector) {
        const attributes = [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
        const link = links.find((item) => attributes.every(([, name, value]) => name in item && (value === undefined || item[name] === value)));
        return link ? { href: link.href, getAttribute: (name) => link[name] ?? null } : null;
      },
    },
  });
  assert.equal(read([campaign]), null, "Campaign art must not become a car placeholder");
  const normal = read([campaign, hero]);
  assert.equal(normal.src, hero.href);
  assert.equal(normal.srcSet, hero.imagesrcset);
  assert.equal(normal.sizes, hero.imagesizes);
  assert.equal(read([]), null);
});

test("campaign image variants decode at the same dimensions with lower transfer size", async () => {
  for (const [originalName, optimizedName] of [
    ["title.png", "title-v2.webp"], ["poster.jpg", "poster-v2.webp"], ["ribbon-turquoise.png", "ribbon-turquoise-v2.webp"],
  ]) {
    const original = readFileSync(resolve(root, "public/images/campaigns/black-friday-2026", originalName));
    const optimized = readFileSync(resolve(root, "public/images/campaigns/black-friday-2026", optimizedName));
    const [before, after] = await Promise.all([sharp(original).metadata(), sharp(optimized).metadata()]);
    assert.equal(after.format, "webp");
    assert.equal(after.width, before.width);
    assert.equal(after.height, before.height);
    assert.equal(after.hasAlpha, before.hasAlpha);
    assert.ok(optimized.length < original.length, optimizedName);
  }
});
