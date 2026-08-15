#!/usr/bin/env tsx

/**
 * Prova que o filtro usado pela SPA enxerga o mesmo estoque e as mesmas
 * categorias que o gerador estático. Evita mostrar uma contagem ao Google e
 * outra ao cliente quando o XML traz aliases ou categorias incorretas.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { landingPages, matchesLandingFilters } from "../src/data/seo/index";
import { resolvedVehicleCategory } from "../src/lib/vehicleCategory";

type StockVehicle = Parameters<typeof matchesLandingFilters>[0] & {
  id?: string | number;
};

const stockPayload = JSON.parse(
  readFileSync(
    new URL("../public/seo/stock-bootstrap.json", import.meta.url),
    "utf8",
  ),
) as { vehicles?: StockVehicle[] };
const vehicles = (stockPayload.vehicles || []).filter(
  (vehicle) => Number(vehicle.price || 0) > 0,
);

assert.equal(
  resolvedVehicleCategory({
    marca: "Jeep",
    modelo: "Renegade Longitude",
    categoria: "HATCH",
  }),
  "SUV",
);
assert.equal(
  resolvedVehicleCategory({
    marca: "Nissan",
    modelo: "Kicks Advance",
    categoria: "HATCH",
  }),
  "SUV",
);
assert.equal(
  resolvedVehicleCategory({
    marca: "Honda",
    modelo: "City EXL",
    categoria: "HATCH",
  }),
  "SEDAN",
);
assert.equal(
  resolvedVehicleCategory({
    marca: "Honda",
    modelo: "City Hatch EXL",
    categoria: "HATCH",
  }),
  "HATCH",
);

assert.equal(
  matchesLandingFilters(
    { marca: "Honda", modelo: "HR-V Advance", price: 100000 },
    { marca: "HONDA", modelo: "HRV" },
  ),
  true,
);
assert.equal(
  matchesLandingFilters(
    { marca: "Volkswagen", modelo: "T-Cross Highline", price: 100000 },
    { marca: "VOLKSWAGEN", modelo: "T CROSS" },
  ),
  true,
);

for (const landing of landingPages) {
  const count = vehicles.filter((vehicle) =>
    matchesLandingFilters(vehicle, landing.filters),
  ).length;
  assert.equal(
    count,
    landing.count,
    `comprar-${landing.slug}: contagem React (${count}) diverge do HTML (${landing.count})`,
  );
}

console.log(
  `Demanda validada em runtime: ${landingPages.length} landings e ${vehicles.length} veículos com paridade React/HTML.`,
);
