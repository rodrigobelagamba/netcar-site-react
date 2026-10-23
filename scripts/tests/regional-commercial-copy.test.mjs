import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const cities = JSON.parse(
  readFileSync(new URL("../../src/data/seo/cities.json", import.meta.url), "utf8"),
);

const focusCities = [
  { slug: "canoas", intent: "Seminovos", name: "Canoas" },
  { slug: "sapucaia-do-sul", intent: "Carros usados", name: "Sapucaia do Sul" },
  { slug: "sao-leopoldo", intent: "Seminovos", name: "São Leopoldo" },
];

test("regional titles match the observed buying intent without claiming a local branch", () => {
  for (const { slug, intent, name } of focusCities) {
    const city = cities.find((item) => item.slug === slug);
    assert.ok(city, `Existing city route missing: ${slug}`);
    assert.ok(city.title.startsWith(`${intent} perto de ${name}`));
    assert.equal(city.h1, `${intent} perto de ${name}`);
    assert.match(city.title, / \| Netcar$/);
    assert.match(city.description, /em Esteio/);
    assert.match(city.intro, /em Esteio/);
    assert.ok(city.description.includes(name));
    assert.ok(city.description.length >= 135 && city.description.length <= 165);
    assert.match(city.description, /[Ff]otos/);
    assert.match(city.description, /preços/);
    assert.doesNotMatch(
      `${city.title} ${city.description} ${city.intro}`,
      /(?:melhor|menor) preço|aprovação garantida|R\$\s*[\d.]+/i,
    );
  }
});

test("Sapucaia helps plan an integrated-store visit instead of promising a fixed-price offer", () => {
  const city = cities.find((item) => item.slug === "sapucaia-do-sul");
  const visit = city.faq.find((item) => item.q === "Preciso visitar as duas lojas para negociar?");
  assert.ok(visit);
  assert.match(visit.a, /mesma equipe/);
  assert.match(visit.a, /confirma a disponibilidade/);
  assert.match(visit.a, /endereço de Esteio/);
  assert.match(city.intro, /estoque das duas lojas/);
  assert.match(city.intro, /usado na troca/);
});

test("focused regional pages retain city-specific routes and the original buying/selling separation", () => {
  const expectedOrigins = {
    canoas: "Marechal Rondon",
    "sapucaia-do-sul": "Capão da Cruz",
    "sao-leopoldo": "Feitoria",
  };
  for (const { slug, name } of focusCities) {
    const city = cities.find((item) => item.slug === slug);
    assert.ok(city.routeOrigins.some((origin) => origin.label === expectedOrigins[slug]));
    assert.ok(city.routeOrigins.every((origin) => origin.query.includes(name)));
    assert.match(city.sell.title, /^Vender carro em /);
    assert.ok(city.faq.some((item) => /740 e 1106/.test(item.a)));
    assert.ok(city.faq.some((item) => /troca|financiamento/.test(item.q)));
  }
});
