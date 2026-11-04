import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import TestRenderer, { act } from "react-test-renderer";
import ts from "typescript";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import type { BlogCar, BlogPost } from "../../src/data/seo/types";
import { resolveBlogStockCars } from "../../src/lib/blogStock";
import { getBlogVehicleTarget } from "../../src/lib/blogNavigation";

const oldCard: BlogCar = {
  modelo: "Nivus antigo",
  ano: "2025",
  km: "15.000 km",
  preco: "R$ 156.900",
  url: "https://www.netcarmultimarcas.com.br/veiculo/nivus-antigo-20018",
  img: "https://www.netcarmultimarcas.com.br/imagens/antiga.jpg",
  destaque: "Oferta antiga",
};

function vehicle(id = "20018", overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    name: "VOLKSWAGEN NIVUS GTS TURBO",
    modelo: "NIVUS GTS TURBO",
    marca: "VOLKSWAGEN",
    price: 149900,
    year: 2026,
    km: 16000,
    cambio: "Automático",
    combustivel: "Flex",
    images: ["https://www.netcarmultimarcas.com.br/imagens/atual.jpg"],
    imagens_site: { tem_fotos: 1 },
    ...overrides,
  } as Vehicle;
}

const post: BlogPost = {
  slug: "escolher-seminovo",
  title: "Como escolher seu seminovo",
  description: "Orientação editorial preservada",
  publishedAt: "2026-10-01",
  readMinutes: 3,
  sections: [
    { type: "p", text: "Compare a documentação e agende uma vistoria." },
    { type: "cars", cars: [oldCard] },
  ],
  ctaHref: "/seminovos",
  ctaLabel: "Ver estoque atualizado",
};

type State = {
  data?: Vehicle[];
  isError?: boolean;
  isFetching?: boolean;
};

function article(initial: State, articlePost = post) {
  let state = initial;
  let retries = 0;
  const calls: unknown[][] = [];
  const deps: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    "@tanstack/react-router": {
      Link: ({ to, params, children, ...rest }: any) => (
        <a
          href={to === "/veiculo/$slug" ? `/veiculo/${params.slug}` : to}
          {...rest}
        >
          {children}
        </a>
      ),
    },
    "@/data/seo/blog": { blogPosts: [] },
    "@/lib/blogRelated.mjs": { relatedReading: () => [] },
    "@/lib/seminovos-search": { emptySeminovosSearch: {} },
    "@/lib/analytics": { trackBlogDiscoveryClick() {} },
    "@/lib/blogNavigation": { getBlogVehicleTarget },
    "./BlogVehicleWarranty": { BlogVehicleWarranty: () => null },
    "@/lib/blogStock": { resolveBlogStockCars },
    "@/catalog/queries/useVehiclesQuery": {
      useVehiclesQuery: (...args: unknown[]) => {
        calls.push(args);
        return {
          ...state,
          refetch: () => {
            retries += 1;
          },
        };
      },
    },
  };
  const source = ts.transpileModule(
    readFileSync(
      new URL(
        "../../src/modules/blog/components/BlogArticleBody.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(source, {
    exports,
    require(name: string) {
      assert.ok(name in deps, `Unexpected dependency ${name}`);
      return deps[name];
    },
  });
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <exports.BlogArticleBody post={articlePost} />,
    );
  });
  return {
    renderer,
    calls,
    retries: () => retries,
    text: () => JSON.stringify(renderer.toJSON()),
    update(next: State) {
      state = next;
      act(() => {
        renderer.update(<exports.BlogArticleBody post={articlePost} />);
      });
    },
    close() {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

test("mounted article updates every offer fact, removes an absent unit and restores it on return", () => {
  const page = article({ data: [vehicle()] });
  try {
    assert.equal(
      JSON.stringify(page.calls[0]),
      JSON.stringify([
        { fetchAll: true },
        { enabled: true, refreshImmediately: true },
      ]),
    );
    assert.match(page.text(), /149\.900|16\.000 km/);
    assert.match(
      page.text(),
      /NIVUS GTS TURBO|nivus-gts-turbo-2026-20018|atual\.jpg/,
    );
    assert.doesNotMatch(
      page.text(),
      /156\.900|Nivus antigo|15\.000 km|antiga\.jpg|Oferta antiga/,
    );
    page.update({ data: [vehicle("20019", { modelo: "POLO" })] });
    assert.match(
      page.text(),
      /Nenhum dos veículos desta seleção está anunciado/,
    );
    assert.doesNotMatch(page.text(), /149\.900|20018|POLO|vendid/i);
    page.update({
      data: [
        vehicle("20018", {
          price: 147900,
          km: 17000,
          year: 2027,
          cambio: "Manual",
        }),
      ],
    });
    assert.match(page.text(), /147\.900|17\.000 km|2027|Manual/);
    assert.doesNotMatch(
      page.text(),
      /149\.900|16\.000 km|2026-20018|Automático/,
    );
    assert.match(page.text(), /Compare a documentação e agende uma vistoria/);
  } finally {
    page.close();
  }
});

test("article never uses historical cards while loading or after a failed refresh and retry works", () => {
  const page = article({ isFetching: true });
  try {
    assert.match(page.text(), /Carregando veículos desta seleção/);
    assert.doesNotMatch(page.text(), /156\.900|Nenhum dos veículos|20018/);
    page.update({ data: [vehicle()], isError: true });
    assert.match(page.text(), /Não foi possível atualizar/);
    assert.doesNotMatch(
      page.text(),
      /149\.900|156\.900|Nenhum dos veículos|20018/,
    );
    act(() => {
      page.renderer.root.findByType("button").props.onClick();
    });
    assert.equal(page.retries(), 1);
    page.update({ data: [vehicle()], isError: true, isFetching: true });
    assert.equal(page.renderer.root.findByType("button").props.disabled, true);
    page.update({ data: [vehicle()] });
    assert.match(page.text(), /149\.900/);
  } finally {
    page.close();
  }
});

test("current stock overrides historical unavailable flag without restoring stale highlights or images", () => {
  const page = article(
    {
      data: [
        vehicle("20018", {
          imagens_site: { tem_fotos: 0 } as Vehicle["imagens_site"],
        }),
      ],
    },
    {
      ...post,
      sections: [{ type: "cars", cars: [{ ...oldCard, available: false }] }],
    },
  );
  try {
    assert.match(page.text(), /149\.900/);
    assert.doesNotMatch(page.text(), /antiga\.jpg|atual\.jpg|Oferta antiga/);
    page.update({ data: [vehicle("20018", { price: 0 })] });
    assert.doesNotMatch(page.text(), /149\.900|156\.900|20018|vendid/i);
  } finally {
    page.close();
  }
});

test("editorial selection only accepts canonical Netcar unit IDs and deduplicates them", () => {
  const invalid = [
    "https://other.example/veiculo/20018",
    "/veiculo/20018-extra",
    "javascript:alert(20018)",
  ];
  const cards = [
    ...invalid.map((url) => ({ ...oldCard, url })),
    oldCard,
    oldCard,
  ];
  assert.equal(resolveBlogStockCars(cards, [vehicle()]).length, 1);
  assert.deepEqual(
    resolveBlogStockCars([oldCard], [vehicle("20018", { price: Number.NaN })]),
    [],
  );
});

test("blog images from a relative live bootstrap path resolve from the site root", () => {
  for (const source of [
    "./imagens/nova.jpg",
    "imagens/nova.jpg",
    "/imagens/nova.jpg",
  ]) {
    const current = vehicle("20018", {
      imagens_site: {
        tem_fotos: 1,
        capa_thumb: source,
      } as Vehicle["imagens_site"],
    });
    assert.equal(
      resolveBlogStockCars([oldCard], [current])[0].img,
      "https://www.netcarmultimarcas.com.br/imagens/nova.jpg",
    );
  }
  const unsafe = vehicle("20018", {
    imagens_site: {
      tem_fotos: 1,
      capa_thumb: "javascript:alert(1)",
    } as Vehicle["imagens_site"],
  });
  assert.equal(resolveBlogStockCars([oldCard], [unsafe])[0].img, undefined);
});
