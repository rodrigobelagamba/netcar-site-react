#!/usr/bin/env tsx

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Vehicle } from "../src/catalog/endpoints/vehicles";
import { getBootstrapVehicles } from "../src/lib/stockBootstrap";
import { sortShowroomVehicles } from "../src/lib/showroomStock";

type StockManifest = {
  vehicles?: Vehicle[];
  showroomVehicles?: Vehicle[];
};

const manifest = JSON.parse(
  readFileSync(
    new URL("../public/seo/stock-bootstrap.json", import.meta.url),
    "utf8",
  ),
) as StockManifest;
const available = manifest.vehicles || [];
const showroom = manifest.showroomVehicles || [];

assert.ok(available.length > 0, "bootstrap disponível está vazio");
assert.ok(
  showroom.length > available.length,
  "showroom perdeu veículos ativos",
);
assert.equal(
  new Set(available.map((vehicle) => String(vehicle.id))).size,
  available.length,
  "bootstrap disponível contém IDs duplicados",
);
assert.equal(
  new Set(showroom.map((vehicle) => String(vehicle.id))).size,
  showroom.length,
  "showroom contém IDs duplicados",
);
assert.ok(
  available.every((vehicle) => Number(vehicle.price) > 0),
  "bootstrap SEO contém vendido",
);
assert.deepEqual(
  showroom.slice(0, available.length).map((vehicle) => vehicle.id),
  available.map((vehicle) => vehicle.id),
  "showroom não começa pelo estoque ativo na mesma ordem",
);
assert.ok(
  showroom
    .slice(available.length)
    .every((vehicle) => Number(vehicle.price) <= 0),
  "showroom mistura vendidos entre os ativos",
);

const fixture = (id: string, model: string, price: number): Vehicle => ({
  id,
  name: model,
  modelo: model,
  slug: id,
  price,
  year: 2025,
  km: 0,
  images: [],
});
const sortFixture = [
  fixture("sold-z", "Zeta vendido", 0),
  fixture("active-b", "Beta ativo", 120000),
  fixture("sold-a", "Alfa vendido", 0),
  fixture("active-c", "Charlie ativo", 90000),
];

sortFixture[1].destaque = 1;
sortFixture[1].year = 2024;
sortFixture[3].promocao = 1;

const expectedSorts = {
  recomendados: ["active-b", "active-c", "sold-a", "sold-z"],
  "ano-desc": ["active-c", "active-b", "sold-a", "sold-z"],
  az: ["sold-a", "active-b", "active-c", "sold-z"],
  "preco-asc": ["active-c", "active-b", "sold-a", "sold-z"],
  "preco-desc": ["active-b", "active-c", "sold-a", "sold-z"],
} as const;

for (const [sortBy, expectedIds] of Object.entries(expectedSorts)) {
  const sorted = sortShowroomVehicles(
    sortFixture,
    sortBy as keyof typeof expectedSorts,
  );
  assert.deepEqual(
    sorted.map((vehicle) => vehicle.id),
    expectedIds,
    `${sortBy}: ordem do showroom divergiu`,
  );
}

const previousWindow = globalThis.window;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __NETCAR_STOCK__: { scope: "showroom", vehicles: sortFixture },
  },
});
try {
  assert.equal(getBootstrapVehicles()?.length, 2, "hook padrão expõe vendidos");
  assert.equal(
    getBootstrapVehicles({ includeSold: true })?.length,
    4,
    "showroom não recebe vendidos do bootstrap",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      __NETCAR_STOCK__: {
        scope: "available",
        vehicles: sortFixture.filter((vehicle) => Number(vehicle.price) > 0),
      },
    },
  });
  assert.equal(
    getBootstrapVehicles({ includeSold: true }),
    undefined,
    "bootstrap active-only foi aceito como showroom completo",
  );
} finally {
  if (previousWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
}

console.log(
  `Showroom validado: ${available.length} ativos + ${showroom.length - available.length} vendidos, sem vazamento no bootstrap padrão.`,
);
