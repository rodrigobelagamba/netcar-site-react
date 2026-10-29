import assert from "node:assert/strict";
import test from "node:test";
import {
  marcaLanding,
  categoriaLanding,
  hybridLanding,
  modelLanding,
} from "../generate-landings.js";
import {
  resolveLandingFaq,
  resolveLandingParagraphs,
} from "../../src/lib/landingStockCopy.mjs";

const staleProfile = {
  minPrice: "R$ 137.900",
  maxPrice: "R$ 151.900",
  minYear: 2023,
  maxYear: 2025,
};
const current = [
  { valor: 137900, ano: 2023 },
  { valor: 149900, ano: 2024 },
  { valor: 149900, ano: 2024 },
  { valor: 0, ano: 2025 },
];

test("all brand/category variants derive ranges from current offers, never the build profile", () => {
  for (const make of [marcaLanding, categoriaLanding]) {
    for (let variant = 0; variant < 9; variant += 1) {
      const landing = make("TEST", 4, staleProfile, variant);
      assert.doesNotMatch(
        JSON.stringify(landing.paragraphs),
        /151\.900|2025|137\.900/,
      );
      const copy = resolveLandingParagraphs(landing, current).join(" ");
      assert.match(copy, /R\$ 137\.900/);
      assert.match(copy, /R\$ 149\.900/);
      assert.match(copy, /2023/);
      assert.match(copy, /2024/);
      assert.doesNotMatch(copy, /151\.900|2025|\{\{/);
    }
  }
});

test("normalized prices, new vehicles and singleton ranges update without rebuilding", () => {
  const landing = marcaLanding("TEST", 4, staleProfile, 6);
  const copy = resolveLandingParagraphs(landing, [
    { price: 123456, year: 2026 },
  ]).join(" ");
  assert.match(copy, /R\$ 123\.456 a R\$ 123\.456/);
  assert.match(copy, /2026 a 2026/);
  assert.doesNotMatch(copy, /151\.900|2025/);
});

test("empty, failed and incomplete current stock use neutral fallback, not stale numeric facts", () => {
  const landing = marcaLanding("TEST", 4, staleProfile, 0);
  for (const stock of [
    [],
    null,
    [{ price: 0, year: 2025 }],
    [{ price: 100000, year: NaN }],
  ]) {
    assert.deepEqual(
      resolveLandingParagraphs(landing, stock),
      landing.paragraphs,
    );
  }
  assert.notEqual(
    resolveLandingFaq(landing, [current[0]])[0].a,
    resolveLandingFaq(landing, [])[0].a,
  );
  assert.equal(
    resolveLandingFaq(landing, null)[0].a,
    resolveLandingFaq(landing, [])[0].a,
  );
  assert.deepEqual(
    resolveLandingFaq(landing, []).slice(1),
    landing.faq.slice(1),
  );
});

test("fixed budget copy and questions stay intact when availability is unknown", () => {
  const landing = {
    type: "faixa",
    paragraphs: ["Filtro até R$ 80 mil"],
    faq: [
      { q: "Todos são automáticos?", a: "O filtro seleciona automáticos." },
    ],
  };
  assert.deepEqual(resolveLandingParagraphs(landing, null), landing.paragraphs);
  assert.deepEqual(resolveLandingFaq(landing, null), landing.faq);
});

test("hybrid metadata, introduction and FAQ no longer freeze commercial facts", () => {
  const landing = hybridLanding(
    current.map((vehicle) => ({ ...vehicle, combustivel: "HIBRIDO" })),
  );
  const copy = resolveLandingParagraphs(landing, current).join(" ");
  assert.match(
    copy,
    /3 híbridos de 2023 a 2024, entre R\$ 137\.900 e R\$ 149\.900/,
  );
  assert.doesNotMatch(
    JSON.stringify([landing.intro, landing.description, landing.faq]),
    /137\.900|149\.900|3 unidades|3 carros/,
  );
});

test("model years follow current units and disappear when the stock cannot be confirmed", () => {
  const landing = modelLanding({
    slug: "nissan-kicks", marca: "NISSAN", modelo: "KICKS", name: "Nissan Kicks",
  }, [{ marca: "NISSAN", modelo: "KICKS", valor: 90000, ano: 2022 }]);
  const range = resolveLandingParagraphs(landing, [
    { price: 100000, year: 2023 }, { price: 140000, year: 2026 },
    { price: 0, year: 2021 },
  ])[0];
  assert.match(range, /2023 a 2026/);
  assert.doesNotMatch(range, /2021|2022|\{\{/);
  const single = resolveLandingParagraphs(landing, [{ price: 140000, year: 2026 }])[0];
  assert.match(single, /de 2026 nesta seleção/);
  assert.doesNotMatch(single, /2026 a 2026/);
  for (const unavailable of [null, [], [{ price: 140000 }]]) {
    assert.deepEqual(resolveLandingParagraphs(landing, unavailable), landing.paragraphs);
  }
});
