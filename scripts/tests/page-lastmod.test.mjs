import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePageLastmod } from "../lib/page-lastmod.js";

const site = "https://www.netcarmultimarcas.com.br";

test("identity pages advance an old persisted sitemap date to their real editorial change", () => {
  for (const path of ["/", "/sobre", "/contato"]) {
    assert.equal(resolvePageLastmod(site + path, "2026-06-24", "2026-12-10"), "2026-11-13");
    assert.equal(resolvePageLastmod(site + path, undefined, "2026-12-10"), "2026-11-13");
  }
});

test("a later real update is never rolled back to the identity change", () => {
  assert.equal(resolvePageLastmod(site + "/contato", "2026-11-20", "2026-12-10"), "2026-11-20");
});

test("unrelated pages retain their existing date and first-build fallback", () => {
  for (const path of ["/seminovos", "/compra", "/veiculo/exemplo", "/blog/exemplo"]) {
    assert.equal(resolvePageLastmod(site + path, "2026-06-24", "2026-12-10"), "2026-06-24");
    assert.equal(resolvePageLastmod(site + path, undefined, "2026-12-10"), "2026-12-10");
  }
});
