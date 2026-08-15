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
  fixture("active-a", "Alfa ativo", 90000),
];

for (const sortBy of ["az", "za", "preco-asc", "preco-desc"] as const) {
  const sorted = sortShowroomVehicles(sortFixture, sortBy);
  assert.deepEqual(
    sorted.map((vehicle) => Number(vehicle.price) <= 0),
    [false, false, true, true],
    `${sortBy}: vendido saiu do fim`,
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
