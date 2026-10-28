import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import {
  optimizeStockImage,
  stockDetailAvifSrcSet,
  stockGalleryPreviewSource,
  stockImageSrcSet,
} from "../../src/lib/images";

const origin = "https://www.netcarmultimarcas.com.br";

test("detail variants preserve encoded photo identity and responsive widths", () => {
  const source = `${origin}/imagens/veiculos_automacar/fixture%20photo%20(1).png`;
  const variants = stockDetailAvifSrcSet(source, [480, 640, 960])!.split(", ");
  assert.equal(variants.length, 3);
  for (const [index, candidate] of variants.entries()) {
    const [href, descriptor] = candidate.split(" ");
    const url = new URL(href, origin);
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, "/vehicle-photo.php");
    assert.equal(decodeURIComponent(url.searchParams.get("src")!), new URL(source).pathname.replaceAll("%20", " "));
    assert.equal(url.searchParams.get("w"), String([480, 640, 960][index]));
    assert.equal(url.searchParams.get("v"), "1");
    assert.equal(descriptor, `${[480, 640, 960][index]}w`);
  }
});

test("unhandled sources keep their existing image instead of advertising a broken AVIF endpoint", () => {
  for (const source of [null, undefined, "", "/imagens/photo.avif", "/images/logo.svg", "data:image/png;base64,AAAA", "/other/photo.jpg"]) {
    assert.equal(stockDetailAvifSrcSet(source, [480, 960]), undefined, String(source));
  }
});

test("foreign photo hosts do not receive requests to the Netcar-only endpoint", () => {
  for (const source of [
    "https://cdn.example/imagens/photo.jpg",
    "https://user:password@www.netcarmultimarcas.com.br/imagens/photo.jpg",
    "https://www.netcarmultimarcas.com.br:8443/imagens/photo.jpg",
  ]) assert.equal(stockDetailAvifSrcSet(source, [640]), undefined);
});

test("gallery previews and legacy Home/stock image URLs remain available unchanged", () => {
  const original = `${origin}/imagens/veiculos_automacar/fixture.avif`;
  const preview = stockGalleryPreviewSource(original);
  assert.equal(preview, `${origin}/imagens/veiculos_automacar/big/fixture.jpg`);
  const expected = `${origin}/img.php?src=%2Fimagens%2Fveiculos_automacar%2Fbig%2Ffixture.jpg&w=640`;
  assert.equal(optimizeStockImage(preview, 640), expected);
  assert.equal(stockImageSrcSet(preview, [640]), undefined);
  assert.equal(stockImageSrcSet(preview, [480, 640]), `${expected.replace("w=640", "w=480")} 480w, ${expected} 640w`);
  assert.match(stockDetailAvifSrcSet(preview, [640])!, /vehicle-photo\.php/);
  assert.equal(original, `${origin}/imagens/veiculos_automacar/fixture.avif`);
});

test("the two-column mobile gallery requests the same responsive size in AVIF and WebP", () => {
  const path = new URL("../../src/modules/detalhes/pages/DetalhesPage.tsx", import.meta.url);
  const ast = ts.createSourceFile(path.pathname, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const gallery = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "GalleryItem");
  assert.ok(gallery, "GalleryItem exists");
  const sizes = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (tag === "source" || tag === "img") {
        const attribute = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "sizes");
        assert.ok(attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isStringLiteral(attribute.initializer), `${tag} has explicit responsive sizes`);
        sizes.set(tag, attribute.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(gallery);
  assert.equal(sizes.size, 2);
  assert.equal(sizes.get("source"), sizes.get("img"), "format selection must not change the downloaded width");
  assert.ok(sizes.get("source")!.startsWith("(max-width: 1023px) 50vw,"), "mobile grid occupies half the viewport");
});
