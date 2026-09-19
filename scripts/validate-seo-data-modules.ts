#!/usr/bin/env tsx

/** Preserva a API de dados SEO após separar os chunks de blog e conteúdo. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  blogPosts,
  getBlogPost,
  contentPages,
  getContentPage,
} from "../src/data/seo/index";
import * as blogModule from "../src/data/seo/blog";
import * as contentModule from "../src/data/seo/content";
import type { BlogPost, ContentSeoPage } from "../src/data/seo/types";

function readData<T>(name: string): T {
  return JSON.parse(
    readFileSync(
      new URL(`../src/data/seo/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as T;
}

const manualPosts = readData<BlogPost[]>("blog-posts");
const autoPosts = readData<BlogPost[]>("blog-auto");
const manualSlugs = new Set(manualPosts.map((post) => post.slug));
const expectedPosts = [
  ...manualPosts,
  ...autoPosts.filter((post) => !manualSlugs.has(post.slug)),
];
const expectedContent = readData<ContentSeoPage[]>("content-pages");

assert.strictEqual(
  blogPosts,
  blogModule.blogPosts,
  "Barrel deve re-exportar o blog",
);
assert.strictEqual(getBlogPost, blogModule.getBlogPost);
assert.strictEqual(contentPages, contentModule.contentPages);
assert.strictEqual(getContentPage, contentModule.getContentPage);
assert.deepEqual(
  blogPosts,
  expectedPosts,
  "Artigos, ordem e prioridade preservados",
);
assert.deepEqual(
  contentPages,
  expectedContent,
  "Conteúdo editorial preservado",
);

for (const post of expectedPosts) {
  assert.deepEqual(
    getBlogPost(post.slug),
    post,
    `Artigo ausente: ${post.slug}`,
  );
}
for (const page of expectedContent) {
  assert.deepEqual(
    getContentPage(page.slug),
    page,
    `Página ausente: ${page.slug}`,
  );
}
assert.equal(getBlogPost("__netcar_missing_validation__"), undefined);
assert.equal(getContentPage("__netcar_missing_validation__"), undefined);

// Força uma colisão mesmo quando os JSON atuais não têm slugs repetidos.
// Executa o módulo real com dados em memória, sem alterar os arquivos de conteúdo.
const manual = Object.freeze({ slug: "same-slug", title: "Texto manual" });
const duplicateAuto = Object.freeze({
  slug: "same-slug",
  title: "Texto automático",
});
const uniqueAuto = Object.freeze({ slug: "auto-only", title: "Só automático" });
const fixtures = {
  "./blog-posts.json": Object.freeze([manual]),
  "./blog-auto.json": Object.freeze([duplicateAuto, uniqueAuto]),
};
const source = readFileSync(
  new URL("../src/data/seo/blog.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
});
const fixtureModule = { exports: {} as typeof blogModule };
runInNewContext(outputText, {
  module: fixtureModule,
  exports: fixtureModule.exports,
  require(name: string) {
    assert.ok(Object.hasOwn(fixtures, name), `Import inesperado: ${name}`);
    return fixtures[name as keyof typeof fixtures];
  },
});
assert.equal(
  fixtureModule.exports.blogPosts.length,
  2,
  "Colisão deve gerar um artigo",
);
assert.strictEqual(fixtureModule.exports.blogPosts[0], manual);
assert.strictEqual(fixtureModule.exports.blogPosts[1], uniqueAuto);
assert.strictEqual(fixtureModule.exports.getBlogPost("same-slug"), manual);
assert.strictEqual(fixtureModule.exports.getBlogPost("auto-only"), uniqueAuto);
assert.equal(fixtureModule.exports.getBlogPost("missing"), undefined);

console.log(
  `Dados SEO validados: ${blogPosts.length} artigos, ${contentPages.length} páginas, prioridade manual e slugs inexistentes.`,
);
