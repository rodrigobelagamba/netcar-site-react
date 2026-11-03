import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";
import { relatedReading, saleReading } from "../../src/lib/blogRelated.mjs";

const sale = [
  { slug: "quanto-vale-meu-carro-usado", title: "Quanto vale meu carro usado?" },
  { slug: "onde-vender-carro-usado-regiao-porto-alegre", title: "Onde vender carro usado?" },
  { slug: "vender-carro-financiado-como-funciona", title: "Vender carro financiado" },
  { slug: "trocar-carro-financiado", title: "Como trocar carro financiado" },
  { slug: "vender-carro-usado-ou-dar-na-troca", title: "Vender sozinho ou dar na troca?" },
];

const noise = [
  { slug: "hatch-seminovo-cidade-esteio-2026", title: "Hatch seminovo na cidade" },
  { slug: "seminovo-baixa-km-esteio-2026", title: "Seminovo de baixa km" },
  { slug: "seminovo-para-viagem-serra-rs-2026", title: "Seminovo para a serra" },
];

test("post de avaliação aponta para a compra e para a venda, não para hatch", () => {
  const links = saleReading(sale[0], [...sale, ...noise]);
  assert.deepEqual(
    links.map((item) => item.href),
    [
      "/compra",
      "/blog/onde-vender-carro-usado-regiao-porto-alegre",
      "/blog/vender-carro-financiado-como-funciona",
    ],
  );
});

test("post de financiamento segue para a troca, não para o começo da lista", () => {
  const links = saleReading(sale[2], [...sale, ...noise]);
  assert.deepEqual(
    links.map((item) => item.href),
    [
      "/compra",
      "/blog/trocar-carro-financiado",
      "/blog/vender-carro-usado-ou-dar-na-troca",
    ],
  );
});

test("os cinco posts de venda ficam no mesmo grupo", () => {
  for (const post of sale) {
    const hrefs = saleReading(post, [...sale, ...noise]).map((item) => item.href);
    assert.equal(hrefs[0], "/compra");
    assert.equal(hrefs.length, 3);
    assert.equal(hrefs.some((href) => href.includes("hatch")), false);
    assert.equal(hrefs.some((href) => href.includes("serra")), false);
    assert.equal(hrefs.includes(`/blog/${post.slug}`), false);
  }
});

test("post fora da venda não entra no grupo fixo", () => {
  assert.equal(saleReading(noise[0], [...sale, ...noise]), null);
});

const remoteBuying = [
  { slug: "comprar-carro-a-distancia", title: "Como comprar carro à distância" },
  { slug: "compra-remota-documentos", title: "Documentos para compra remota" },
];

test("assunto sem outro artigo útil não é preenchido com posts recentes", () => {
  const pickup = { slug: "picape-para-trabalho", title: "Picape para trabalho" };
  assert.deepEqual(relatedReading(pickup, [pickup, ...noise, ...sale]), []);
});

test("os dois artigos de compra à distância se indicam sem completar três links", () => {
  for (const [index, post] of remoteBuying.entries()) {
    const other = remoteBuying[1 - index];
    assert.deepEqual(relatedReading(post, [...remoteBuying, ...noise]), [
      { href: `/blog/${other.slug}`, title: other.title },
    ]);
  }
});

test("o título identifica o assunto mesmo quando o slug não o descreve", () => {
  const post = { slug: "orientacao-17", title: "Compra remota: cuidados e documentos" };
  const other = { slug: "orientacao-28", title: "Comprar à distância com segurança" };
  assert.deepEqual(relatedReading(post, [post, other, ...noise]), [
    { href: "/blog/orientacao-28", title: other.title },
  ]);
});

test("cidade, ano e palavras genéricas não ligam SUV a aplicativo nem híbrido a troca", () => {
  const suv = { slug: "suv-seminovo-ate-100-mil-grande-poa-2026", title: "SUV na Grande POA em 2026" };
  const app = { slug: "carro-para-aplicativo-grande-poa-2026", title: "Carro para aplicativo na Grande POA" };
  const hybrid = { slug: "seminovo-hibrido-vale-a-pena-2026", title: "Quando escolher um híbrido?" };
  const trade = { slug: "quando-trocar-de-carro-sinais", title: "Quando trocar de carro em 2026?" };
  assert.deepEqual(relatedReading(suv, [suv, app]), []);
  assert.deepEqual(relatedReading(hybrid, [hybrid, trade]), []);
});

test("cidade de atendimento, preço de 99 mil e manual do proprietário não criam assuntos falsos", () => {
  const cases = [
    [
      { slug: "atendimento-na-cidade", title: "Horários de atendimento na cidade" },
      { slug: "mobilidade-urbana", title: "Mobilidade urbana no trânsito" },
    ],
    [
      { slug: "carro-ate-99-mil", title: "Ofertas de carros até 99 mil" },
      { slug: "carro-para-uber", title: "Como escolher carro para Uber" },
    ],
    [
      { slug: "manual-do-proprietario", title: "Como consultar o manual do proprietário" },
      { slug: "cambio-automatico", title: "Cuidados com o câmbio automático" },
    ],
  ];
  for (const [post, other] of cases) {
    assert.deepEqual(relatedReading(post, [post, other]), [], post.slug);
  }
});

test("baixa quilometragem e checklist de compra têm uma relação editorial", () => {
  const lowKm = { slug: "seminovo-poucos-km", title: "Como avaliar baixa quilometragem" };
  const checklist = { slug: "o-que-verificar-antes-de-comprar-seminovo", title: "Checklist de compra" };
  assert.deepEqual(relatedReading(lowKm, [lowKm, checklist, ...sale]), [
    { href: `/blog/${checklist.slug}`, title: checklist.title },
  ]);
  assert.deepEqual(relatedReading(checklist, [lowKm, checklist]), [
    { href: `/blog/${lowKm.slug}`, title: lowKm.title },
  ]);
});

test("não inclui o próprio artigo nem repete destinos e limita a três resultados estáveis", () => {
  const post = { slug: "baixa-km-principal", title: "Baixa km: avaliação" };
  const peers = ["d", "b", "a", "c"].map((suffix) => ({
    slug: `baixa-km-${suffix}`,
    title: `Baixa quilometragem ${suffix}`,
  }));
  const corpus = [post, peers[0], peers[1], post, ...peers];
  const links = relatedReading(post, corpus, 20);
  assert.equal(links.length, 3);
  assert.equal(new Set(links.map((item) => item.href)).size, 3);
  assert.ok(!links.some((item) => item.href === `/blog/${post.slug}`));
  assert.deepEqual(relatedReading(post, [...corpus].reverse(), 20), links);
  assert.equal(relatedReading(post, corpus, 2).length, 2);
  assert.deepEqual(relatedReading(post, corpus, 0), []);
});

test("a seleção compartilhada preserva a regra dos cinco artigos de venda", () => {
  for (const post of sale) {
    const corpus = [...noise, ...remoteBuying, ...sale];
    assert.deepEqual(relatedReading(post, corpus), saleReading(post, corpus));
    assert.equal(relatedReading(post, corpus, 10).length, 3);
  }
});

test("venda sem irmãos publicados mantém só o destino institucional", () => {
  assert.deepEqual(relatedReading(sale[0], [sale[0], ...noise]), [
    { href: "/compra", title: "Avaliar ou vender seu carro" },
  ]);
});

const componentPath = "src/modules/blog/components/BlogArticleBody.tsx";
const { outputText: componentSource } = ts.transpileModule(
  readFileSync(new URL(`../../${componentPath}`, import.meta.url), "utf8"),
  {
    fileName: componentPath,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
);

function articleFixture(post) {
  return {
    description: "Orientação para escolher seu próximo carro.",
    publishedAt: "2026-10-01",
    readMinutes: 3,
    sections: [],
    ctaHref: "/seminovos",
    ctaLabel: "Ver estoque",
    ...post,
  };
}

function loadArticle(corpus) {
  const module = { exports: {} };
  const dependencies = {
    "react/jsx-runtime": jsxRuntime,
    "@tanstack/react-router": { Link: "router-link" },
    "@/lib/seminovos-search": { emptySeminovosSearch: {} },
    "@/lib/analytics": { trackBlogDiscoveryClick() {} },
    "@/lib/blogNavigation": { getBlogVehicleTarget: () => null },
    "@/lib/blogRelated.mjs": { relatedReading, saleReading },
    "@/data/seo/blog": { blogPosts: corpus },
    "./BlogVehicleWarranty": { BlogVehicleWarranty: () => null },
  };
  runInNewContext(componentSource, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports.BlogArticleBody;
}

function renderedReading(renderer) {
  const navs = renderer.root.findAllByProps({ "aria-label": "Leia também" });
  assert.ok(navs.length <= 1, "o artigo não pode duplicar a navegação relacionada");
  if (!navs.length) return [];
  return navs[0].findAllByType("router-link").map((node) => {
    assert.ok(["/compra", "/blog/$slug"].includes(node.props.to));
    if (node.props.to === "/blog/$slug") assert.ok(node.props.params?.slug);
    return {
      href: node.props.to === "/compra" ? "/compra" : `/blog/${node.props.params.slug}`,
      title: node.children.join(""),
    };
  });
}

test("o React usa a seleção compartilhada após o CTA, com rotas de blog e compra válidas", () => {
  const corpus = [...sale, ...remoteBuying, ...noise];
  const Article = loadArticle(corpus);
  for (const post of [sale[0], remoteBuying[0]]) {
    let renderer;
    try {
      act(() => { renderer = TestRenderer.create(React.createElement(Article, { post: articleFixture(post) })); });
      assert.deepEqual(renderedReading(renderer), relatedReading(post, corpus));
      const children = renderer.toJSON().children;
      assert.equal(children.at(-1).type, "nav");
      assert.ok(JSON.stringify(children.at(-2)).includes("Veja também na Netcar"));
    } finally {
      act(() => renderer?.unmount());
    }
  }
});

test("o React omite o bloco vazio e preserva o CTA quando não há assunto relacionado", () => {
  const post = { slug: "picape-sozinha", title: "Picape para trabalho" };
  const Article = loadArticle([post, ...noise]);
  let renderer;
  try {
    act(() => { renderer = TestRenderer.create(React.createElement(Article, { post: articleFixture(post) })); });
    assert.deepEqual(renderedReading(renderer), []);
    assert.ok(JSON.stringify(renderer.toJSON()).includes("Veja também na Netcar"));
  } finally {
    act(() => renderer?.unmount());
  }
});

if (process.env.NETCAR_VERIFY_GENERATED_SEO === "1") {
  test("todos os artigos gerados têm os mesmos links, textos e ordem do React", () => {
    const readJson = (name) => JSON.parse(readFileSync(new URL(`../../src/data/seo/${name}`, import.meta.url), "utf8"));
    const manual = readJson("blog-posts.json");
    const auto = readJson("blog-auto.json");
    const corpus = [...manual, ...auto.filter((post) => !manual.some((item) => item.slug === post.slug))];
    const Article = loadArticle(corpus);
    const decode = (value) => value.replace(/&(?:quot|lt|gt|amp);/g, (entity) => ({
      "&quot;": '"', "&lt;": "<", "&gt;": ">", "&amp;": "&",
    })[entity]);
    for (const post of corpus) {
      const html = readFileSync(new URL(`../../public/seo-static/blog-${post.slug}.html`, import.meta.url), "utf8");
      const navs = [...html.matchAll(/<nav\b[^>]*aria-label="Leia também"[^>]*>([\s\S]*?)<\/nav>/g)];
      assert.ok(navs.length <= 1, `${post.slug}: navegação SEO duplicada`);
      const actual = navs.length ? [...navs[0][1].matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
        href: decode(match[1]), title: decode(match[2]),
      })) : [];
      let renderer;
      try {
        act(() => { renderer = TestRenderer.create(React.createElement(Article, { post: articleFixture({ ...post, sections: [] }) })); });
        assert.deepEqual(actual, relatedReading(post, corpus), `${post.slug}: seleção estática divergente`);
        assert.deepEqual(actual, renderedReading(renderer), `${post.slug}: React e HTML SEO divergentes`);
        assert.equal(navs.length, actual.length ? 1 : 0, `${post.slug}: bloco vazio`);
      } finally {
        act(() => renderer?.unmount());
      }
    }
  });
}
