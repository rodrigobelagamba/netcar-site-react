import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import postcss from "postcss";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function classes(element) {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  const attribute = opening.attributes.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === "className",
  );
  assert.ok(attribute?.initializer && ts.isStringLiteral(attribute.initializer));
  return new Set(attribute.initializer.text.split(/\s+/));
}

for (const [path, expectedCount] of [
  ["src/design-system/components/layout/IanBot.tsx", 1],
  ["src/modules/compra/pages/CompraPage.tsx", 2],
]) {
  test(`${path}: each iAN image has a square, non-shrinking circular crop`, () => {
    const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const portraits = [];
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "img") {
        const src = node.attributes.properties.find(
          (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === "src",
        );
        if (src?.getText().includes("/images/ian.webp")) portraits.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    assert.equal(portraits.length, expectedCount);

    for (const image of portraits) {
      assert.ok(ts.isJsxElement(image.parent));
      const frame = classes(image.parent);
      for (const name of ["aspect-square", "shrink-0", "overflow-hidden", "rounded-full"]) {
        assert.ok(frame.has(name), `Missing crop-frame class: ${name}`);
      }
      const photo = classes(image);
      for (const name of ["block", "w-full", "h-full", "rounded-full", "object-cover"]) {
        assert.ok(photo.has(name), `Missing portrait class: ${name}`);
      }
    }
  });
}

test("mobile overflow guard does not override explicitly sized image heights", () => {
  const css = postcss.parse(read("src/index.css"));
  let checked = 0;
  css.walkRules((rule) => {
    if (!rule.selector.includes("img:not(.social-story-cover)")) return;
    assert.equal(rule.parent.type, "atrule");
    assert.equal(rule.parent.params, "(max-width: 393px)");
    const declarations = rule.nodes.filter((node) => node.type === "decl");
    assert.ok(declarations.some((declaration) => declaration.prop === "max-width" && declaration.value === "100%"));
    assert.ok(!declarations.some((declaration) => declaration.prop === "height"));
    checked += 1;
  });
  assert.equal(checked, 1);
});

const aboutPath = "src/modules/sobre/pages/SobrePage.tsx";
const about = ts.createSourceFile(aboutPath, read(aboutPath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findAboutImages(alt) {
  const images = [];
  const visit = (node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "img"
        && node.attributes.properties.some((prop) => ts.isJsxAttribute(prop)
          && prop.name.getText() === "alt" && prop.initializer?.text === alt)) images.push(node);
    ts.forEachChild(node, visit);
  };
  visit(about);
  return images;
}

test("about hero preserves a square image inside its circular frame", () => {
  const [hero] = findAboutImages("Netcar Multimarcas");
  assert.ok(hero);
  for (const name of ["block", "aspect-square", "w-full", "h-full", "rounded-full", "object-cover"])
    assert.ok(classes(hero).has(name), name);
  for (const name of ["aspect-square", "rounded-full", "overflow-hidden"])
    assert.ok(classes(hero.parent).has(name), name);
});

test("each store thumbnail uses its own branch in src, srcset, fallback and link", () => {
  for (const number of [1, 2]) {
    const images = findAboutImages(`Miniatura Loja ${number}`);
    assert.equal(images.length, 1);
    const [image] = images;
    const source = image.getText();
    assert.ok(source.includes(`optimizeStockImage(loja${number}Image, 320)`));
    assert.ok(source.includes(`stockImageSrcSet(loja${number}Image, [200, 320])`));
    assert.ok(source.includes(`e.currentTarget.src = "/images/loja${number}.webp"`));
    assert.ok(classes(image.parent).has("right-3"), "mobile thumbnail stays inside its card");
    assert.ok(!classes(image.parent).has("-right-6"));
    let link = image.parent;
    while (link && !(ts.isJsxElement(link) && link.openingElement.tagName.getText() === "motion.a")) link = link.parent;
    assert.ok(link);
    assert.ok(link.openingElement.getText().includes(`buildLojaMapsUrl("Loja${number}")`));
  }
});
