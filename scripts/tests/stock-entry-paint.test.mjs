import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../../", import.meta.url));
const html = readFileSync(join(root, "index.html"), "utf8");
const entryScript = html.match(/<script id="netcar-entry-route">([\s\S]*?)<\/script>/)?.[1];

test("catalog entry skips the promotional splash before its first paint", () => {
  assert.ok(entryScript);
  for (const pathname of ["/seminovos", "/seminovos/"]) {
    const attrs = {};
    runInNewContext(entryScript, {
      window: { location: { pathname, search: "?marca=FIAT" } },
      document: { documentElement: { setAttribute: (key, value) => { attrs[key] = value; } } },
    });
    assert.equal(attrs["data-netcar-entry"], "stock");
  }
  assert.ok(html.indexOf('id="netcar-entry-route"') < html.indexOf('id="root"'));
  assert.match(html, /html\[data-netcar-entry="stock"\] #netcar-initial-shell\s*\{\s*display: none;/);
  assert.match(html, /html\[data-netcar-entry="stock"\] body\s*\{[^}]*background: hsl\(217 10% 95%\)/);
});

test("home/detail shells and no-JavaScript contact fallback remain available", () => {
  for (const pathname of ["/", "/veiculo/19299", "/seminovos-automaticos"]) {
    runInNewContext(entryScript, {
      window: { location: { pathname } },
      document: { documentElement: { setAttribute: () => assert.fail("Not the stock entry") } },
    });
  }
  // The opt-in attribute is only assigned by JS, never in the static HTML tag.
  assert.doesNotMatch(html.match(/<html[^>]*>/)[0], /data-netcar-entry/);
  assert.match(html, /href="tel:\+555134737900"/);
  assert.match(html, /#netcar-initial-shell\s*\{[^}]*display: flex;/);
});

test("production CSS stays render-blocking, including on repeated build steps", () => {
  const directory = mkdtempSync(join(tmpdir(), "netcar-paint-test-"));
  try {
    mkdirSync(join(directory, "scripts"));
    mkdirSync(join(directory, "dist"));
    copyFileSync(join(root, "scripts/defer-built-css.js"), join(directory, "scripts/check.mjs"));
    const builtHtml = '<html><head><link rel="stylesheet" crossorigin href="/assets/index-test.css"></head><body></body></html>';
    const builtPath = join(directory, "dist/index.html");
    writeFileSync(builtPath, builtHtml);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(process.execPath, [join(directory, "scripts/check.mjs")]);
      assert.equal(result.status, 0, result.stderr.toString());
      assert.equal(readFileSync(builtPath, "utf8"), builtHtml);
    }
    writeFileSync(builtPath, '<link rel="preload" as="style" href="/assets/index-test.css" onload="this.rel=\'stylesheet\'">');
    assert.notEqual(spawnSync(process.execPath, [join(directory, "scripts/check.mjs")]).status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
