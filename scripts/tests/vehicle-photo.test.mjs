/**
 * Executes the real endpoints under PHP 7.4/GD without a production server.
 * Run: PHP_WASM_MODULE_ROOT=/path/to/node_modules node scripts/tests/vehicle-photo.test.mjs
 * Runtime dependencies: @php-wasm/node and @php-wasm/universal (no project install required).
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import sharp from "sharp";
import { tsImport } from "tsx/esm/api";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const moduleRoot = process.env.PHP_WASM_MODULE_ROOT;
const importRuntime = (name) => import(moduleRoot
  ? pathToFileURL(resolve(moduleRoot, `@php-wasm/${name}/index.js`)).href
  : `@php-wasm/${name}`);
const { loadNodeRuntime } = await importRuntime("node");
const { PHP } = await importRuntime("universal");
const php = new PHP(await loadNodeRuntime("7.4", { emscriptenOptions: { processId: process.pid } }));
const root = "/www";
const requested = "/imagens/photo preview.jpg";
const master = "/imagens/photo master.png";
const avif = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#336699" } }).avif().toBuffer();
const digest = createHash("sha256").update(avif).digest("hex");
const variantPath = `/images/vehicle-photo-variants/${digest}.avif`;
const sourceDigest = createHash("sha256").update(requested).digest("hex");
const manifestPath = `${root}/seo/vehicle-photo-variants/${sourceDigest}.json`;
let manifest;
let checks = 0;
const failures = [];
const { stockDetailAvifSrcSet, stockImageSrcSet } = await tsImport("../../src/lib/images.ts", import.meta.url);

await php.run({ code: `<?php
  mkdir('/www/imagens', 0777, true);
  mkdir('/www/images/vehicle-photo-variants', 0777, true);
  mkdir('/www/seo/vehicle-photo-variants', 0777, true);
  mkdir('/outside', 0777, true);
` });
for (const name of ["vehicle-photo.php", "img.php"]) {
  php.writeFile(`${root}/${name}`, await readFile(resolve(repo, "public", name)));
}

async function reset() {
  const response = await php.run({ code: `<?php
    $image = imagecreatetruecolor(600, 400);
    imagefilledrectangle($image, 0, 0, 599, 399, imagecolorallocate($image, 30, 100, 190));
    imagefilledrectangle($image, 0, 0, 250, 220, imagecolorallocate($image, 200, 30, 80));
    imagepng($image, '${root}${master}');
    imagejpeg($image, '${root}${requested}', 90);
    imagedestroy($image);
    touch('${root}${master}', 1700000000);
    touch('${root}${requested}', 1700000000);
    clearstatcache();
    echo json_encode(array('requested' => filesize('${root}${requested}'), 'master' => filesize('${root}${master}')));
  ` });
  assert.equal(response.errors, "");
  const bytes = response.json;
  php.writeFile(`${root}${variantPath}`, avif);
  manifest = {
    schemaVersion: 1,
    entries: {
      [requested]: {
        "320": {
          requestedSourceMtime: 1700000000, requestedSourceBytes: bytes.requested,
          sourcePath: master, sourceMtime: 1700000000, sourceBytes: bytes.master,
          file: variantPath, bytes: avif.length, budgetBytes: avif.length,
        },
      },
    },
  };
  saveManifest();
}

function saveManifest() { php.writeFile(manifestPath, JSON.stringify(manifest)); }
function entry() { return manifest.entries[requested]["320"]; }
function header(response, name) {
  const key = Object.keys(response.headers).find((key) => key.toLowerCase() === name.toLowerCase());
  const value = response.headers[key];
  return Array.isArray(value) ? value.join(", ") : value;
}
async function request(query = { src: requested, w: 320 }, etag = "", endpoint = "vehicle-photo.php") {
  const args = Buffer.from(JSON.stringify(query)).toString("base64");
  const tag = Buffer.from(etag).toString("base64");
  return php.run({ code: `<?php
    error_reporting(E_ALL);
    ini_set('display_errors', 'stderr');
    $_SERVER['DOCUMENT_ROOT'] = '${root}';
    $_SERVER['HTTP_IF_NONE_MATCH'] = base64_decode('${tag}');
    $_GET = json_decode(base64_decode('${args}'), true);
    require '${root}/${endpoint}';
  ` });
}
async function isFallback(label, query) {
  const response = await request(query);
  assert.equal(response.httpStatusCode, 200, label);
  assert.equal(response.errors, "", label);
  assert.equal(header(response, "content-type"), "image/webp", label);
  assert.equal(header(response, "cache-control"), "public, max-age=300", label);
  assert.ok(response.bytes.length > 0, label);
  assert.notDeepEqual(Buffer.from(response.bytes), avif, label);
  return response;
}
async function check(name, fn) {
  checks++;
  try { await reset(); await fn(); console.log(`ok ${checks} - ${name}`); }
  catch (error) { failures.push(name); console.error(`not ok ${checks} - ${name}\n${error.stack || error}`); }
}

await check("PHP 7.4 parses both endpoints with GD/WebP but no AVIF encoder", async () => {
  const result = await php.run({ code: "<?php token_get_all(file_get_contents('/www/vehicle-photo.php'), TOKEN_PARSE); token_get_all(file_get_contents('/www/img.php'), TOKEN_PARSE); echo json_encode(array(PHP_VERSION, function_exists('imagewebp'), function_exists('imageavif')));" });
  assert.match(result.json[0], /^7\.4\./);
  assert.equal(result.json[1], true);
  assert.equal(result.json[2], false);
});
await check("fresh bounded variant serves exact bytes, MIME, ETag and finite cache", async () => {
  const result = await request();
  assert.equal(result.errors, "");
  assert.equal(result.httpStatusCode, 200);
  assert.equal(header(result, "content-type"), "image/avif");
  assert.equal(header(result, "cache-control"), "public, max-age=3600");
  assert.equal(header(result, "etag"), `"${digest}"`);
  assert.equal(Number(header(result, "content-length")), avif.length);
  assert.deepEqual(Buffer.from(result.bytes), avif);
});
await check("a matching ETag returns 304 only while both sources remain current", async () => {
  const cached = await request(undefined, `"${digest}"`);
  assert.equal(cached.httpStatusCode, 304);
  assert.equal(cached.bytes.length, 0);
  entry().sourceMtime--;
  saveManifest();
  const stale = await request(undefined, `"${digest}"`);
  assert.equal(stale.httpStatusCode, 200);
  assert.equal(header(stale, "content-type"), "image/webp");
});
await check("missing photo shard retains exact legacy payload but shortens cache", async () => {
  // A complete legacy manifest must not substitute for the bounded photo shard.
  php.writeFile(`${root}/seo/vehicle-photo-variants.json`, JSON.stringify(manifest));
  await php.run({ code: `<?php unlink('${manifestPath}');` });
  const result = await isFallback("missing shard");
  const legacy = await request(undefined, "", "img.php");
  assert.deepEqual(Buffer.from(result.bytes), Buffer.from(legacy.bytes));
  assert.equal(header(legacy, "cache-control"), "public, max-age=31536000, immutable");
});
await check("the decoded source selects its own bounded shard without scanning other photos", async () => {
  const encoded = await request({ src: requested.replaceAll(" ", "%20"), w: 320 });
  assert.equal(header(encoded, "content-type"), "image/avif");
  assert.deepEqual(Buffer.from(encoded.bytes), avif);
  const valid = JSON.stringify(manifest);
  php.writeFile(manifestPath, valid.padEnd(32 * 1024, " "));
  assert.equal(header(await request(), "content-type"), "image/avif");
  php.writeFile(manifestPath, valid.padEnd(32 * 1024 + 1, " "));
  await isFallback("oversized photo shard");
  manifest.entries = { "/imagens/another-photo.jpg": manifest.entries[requested] };
  saveManifest();
  await isFallback("wrong photo record in shard");
});
await check("invalid JSON, future schema and missing width safely fall back", async () => {
  php.writeFile(manifestPath, "{broken json");
  await isFallback("invalid JSON");
  manifest.schemaVersion = 2; saveManifest();
  await isFallback("future schema");
  manifest.schemaVersion = 1; saveManifest();
  await isFallback("missing width", { src: requested, w: 480 });
});
await check("source timestamp and byte changes invalidate both requested and master sources", async () => {
  for (const field of ["requestedSourceMtime", "requestedSourceBytes", "sourceMtime", "sourceBytes"]) {
    const before = entry()[field]; entry()[field]++; saveManifest();
    await isFallback(field);
    entry()[field] = before;
  }
});
await check("over-budget, missing and size-mismatched variants never serve AVIF", async () => {
  entry().budgetBytes = avif.length - 1; saveManifest();
  await isFallback("over-budget");
  entry().budgetBytes = avif.length; saveManifest();
  php.writeFile(`${root}${variantPath}`, Buffer.concat([avif, Buffer.from([0])]));
  await isFallback("size mismatch");
  await php.run({ code: `<?php unlink('${root}${variantPath}');` });
  await isFallback("missing variant");
});
await check("manifest paths cannot escape source or variant directories", async () => {
  entry().sourcePath = "/outside/secret.jpg"; saveManifest();
  await isFallback("untrusted source directory");
  entry().sourcePath = master; entry().file = "/images/../outside/secret.avif"; saveManifest();
  await isFallback("variant traversal");
});
await check("symlinked sources and variants cannot read files outside the document root", async () => {
  await php.run({ code: `<?php
    copy('${root}${master}', '/outside/master.png');
    touch('/outside/master.png', 1700000000);
    @unlink('/www/imagens/escaped.png');
    symlink('/outside/master.png', '/www/imagens/escaped.png');
  ` });
  entry().sourcePath = "/imagens/escaped.png"; saveManifest();
  await isFallback("source symlink");
  entry().sourcePath = master; saveManifest();
  await php.run({ code: `<?php
    copy('${root}${variantPath}', '/outside/variant.avif');
    unlink('${root}${variantPath}');
    symlink('/outside/variant.avif', '${root}${variantPath}');
  ` });
  await isFallback("variant symlink");
  await php.run({ code: `<?php unlink('${root}${variantPath}');` });
});
await check("invalid requests fail closed without PHP warnings or source disclosure", async () => {
  for (const query of [
    {}, { src: "/imagens/../secret.jpg", w: 320 },
    { src: "/outside/secret.jpg", w: 320 },
    { src: "https://example.com/imagens/photo.jpg", w: 320 },
    { src: "/imagens/secret.php", w: 320 },
    { src: [requested], w: 320 },
    { src: requested, w: [320] },
  ]) {
    const response = await request(query);
    assert.ok(response.httpStatusCode >= 400 && response.httpStatusCode < 500,
      JSON.stringify({ query, status: response.httpStatusCode, errors: response.errors, body: response.text.slice(0, 300) }));
    assert.equal(response.errors, "", JSON.stringify(query));
    assert.equal(response.bytes.length, 0, JSON.stringify(query));
  }
});
await check("deleted requested and master source files cannot serve an older AVIF", async () => {
  await php.run({ code: `<?php unlink('${root}${master}');` });
  await isFallback("deleted master");
  await php.run({ code: `<?php unlink('${root}${requested}');` });
  const response = await request();
  assert.equal(response.httpStatusCode, 404);
  assert.equal(response.bytes.length, 0);
});

const controller = await readFile(resolve(repo, "public/index.php"), "utf8");
function controllerFunction(name) {
  const start = controller.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = controller.indexOf("\nfunction ", start + 1);
  assert.ok(next > start, `${name} has a following declaration`);
  return controller.slice(start, next);
}
function htmlTags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map(([tag]) => Object.fromEntries(
    [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value.replaceAll("&amp;", "&").replaceAll("&quot;", '"')]),
  ));
}
await check("PHP detail preloads, initial picture and React variants share mobile/desktop URLs", async () => {
  const cover = "https://www.netcarmultimarcas.com.br/imagens/fixture%20photo.png";
  const fixture = Buffer.from(JSON.stringify({ vehicles: [{ id: "101", name: "Fixture car", images: [cover] }] })).toString("base64");
  const functions = ["netcar_stock_critical_vehicle", "netcar_vehicle_cover", "netcar_detail_photo_srcset", "netcar_stock_critical_preload", "netcar_stock_initial_lcp", "netcar_banner_variant"].map(controllerFunction).join("\n");
  const result = await php.run({ code: `<?php
    ${functions}
    function netcar_stock_bootstrap_value() { return json_decode(base64_decode('${fixture}'), true); }
    function netcar_stock_request_has_filters() { return false; }
    echo json_encode(array(
      'detailPreload' => netcar_stock_critical_preload('/veiculo/fixture-car-101'),
      'detailInitial' => netcar_stock_initial_lcp('/veiculo/fixture-car-101'),
      'stockPreload' => netcar_stock_critical_preload('/seminovos'),
      'stockInitial' => netcar_stock_initial_lcp('/seminovos'),
      'homePreload' => netcar_stock_critical_preload('/'),
      'homeInitial' => netcar_stock_initial_lcp('/')
    ));
  ` });
  assert.equal(result.errors, "");
  const rendered = result.json;
  const preloads = htmlTags(rendered.detailPreload, "link");
  const sources = htmlTags(rendered.detailInitial, "source");
  assert.equal(preloads.length, 2);
  assert.equal(sources.length, 3);
  for (const [index, widths, media, sizes] of [
    [0, [480, 640, 960], "(max-width: 1023px)", "100vw"],
    [1, [480, 640, 768, 960, 1280], "(min-width: 1024px)", "70vw"],
  ]) {
    const expected = stockDetailAvifSrcSet(cover, widths);
    assert.equal(preloads[index].type, "image/avif");
    assert.equal(preloads[index].media, media);
    assert.equal(preloads[index].imagesizes, sizes);
    assert.equal(preloads[index].imagesrcset, expected);
    assert.equal(sources[index].type, "image/avif");
    assert.equal(sources[index].media, media);
    assert.equal(sources[index].sizes, sizes);
    assert.equal(sources[index].srcset, expected);
  }
  // Unsupported AVIF skips both typed preloads and typed sources; mobile then
  // selects this WebP source, while desktop uses the unchanged img fallback.
  assert.equal(sources[2].type, undefined);
  assert.equal(sources[2].media, "(max-width: 1023px)");
  const absolute = (srcset) => srcset.split(", ").map((candidate) => {
    const [url, descriptor] = candidate.split(" ");
    return `${new URL(url, "https://www.netcarmultimarcas.com.br").href} ${descriptor}`;
  }).join(", ");
  assert.equal(absolute(sources[2].srcset), stockImageSrcSet(cover, [480, 640, 960]));
  const initialImg = htmlTags(rendered.detailInitial, "img")[0];
  assert.equal(absolute(initialImg.srcset), stockImageSrcSet(cover, [480, 640, 768, 960, 1280]));
  assert.equal(htmlTags(rendered.stockPreload, "link").length, 1);
  assert.doesNotMatch(rendered.stockPreload + rendered.stockInitial, /vehicle-photo\.php|image\/avif|<picture/);
  assert.equal(rendered.homePreload, "");
  assert.equal(rendered.homeInitial, "");
});

console.log(`1..${checks}`);
console.log(`${checks - failures.length}/${checks} vehicle-photo endpoint checks passed (PHP 7.4).`);
// PHP-WASM's runtime worker can keep Node alive after the final response.
process.exit(failures.length ? 1 : 0);
