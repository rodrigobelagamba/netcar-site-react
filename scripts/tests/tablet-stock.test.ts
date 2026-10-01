import assert from "node:assert/strict";
import { test } from "node:test";
import type { Vehicle } from "../../src/catalog/endpoints/vehicles";
import {
  DEFAULT_TABLET_FILTERS,
  filterTabletVehicles,
  getTabletFilterErrors,
  type TabletFilters,
} from "../../src/modules/tablet/lib/tabletStock";

function vehicle(id: string, fields: Partial<Vehicle> = {}): Vehicle {
  return {
    id,
    name: "Volkswagen T-Cross",
    marca: "Volkswagen",
    modelo: "T-Cross",
    cambio: "AUTOMÁTICO",
    slug: `t-cross-2024-abc-xx12-${id}`,
    price: 100000,
    year: 2024,
    km: 20000,
    images: [],
    ...fields,
  };
}

const filters = (overrides: Partial<TabletFilters> = {}): TabletFilters => ({
  ...DEFAULT_TABLET_FILTERS,
  ...overrides,
});
const ids = (vehicles: Vehicle[]): string[] => vehicles.map((item) => item.id);

test("ranges de preço, modelo e km são inclusivos e combináveis", () => {
  const stock = [
    vehicle("min", { price: 80000, year: 2020, km: 0 }),
    vehicle("max", { price: 100000, year: 2024, km: 50000 }),
    vehicle("price", { price: 100001 }),
    vehicle("year", { year: 2019 }),
    vehicle("km", { km: 50001 }),
  ];
  assert.deepEqual(
    ids(
      filterTabletVehicles(
        stock,
        filters({
          precoMin: "80000",
          precoMax: "100000",
          anoMin: "2020",
          anoMax: "2024",
          kmMin: "0",
          kmMax: "50000",
        }),
      ),
    ),
    ["min", "max"],
  );
});

test("limites de um lado só e valores decimais não perdem precisão", () => {
  const stock = [
    vehicle("a", { price: 80000.49 }),
    vehicle("b", { price: 80000.5 }),
  ];
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ precoMin: "80000,50" }))),
    ["b"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ precoMax: " 80000.49 " }))),
    ["a"],
  );
});

test("vendidos e preços inválidos nunca entram no estoque do tablet", () => {
  const stock = [0, -1, NaN, Infinity, null, undefined, "100000"].map(
    (price, index) => vehicle(String(index), { price: price as number }),
  );
  stock.push(vehicle("active"));
  assert.deepEqual(ids(filterTabletVehicles(stock, filters())), ["active"]);
});

test("km zero é válido; km ausente ou inválido não atende um filtro ativo", () => {
  const stock = [
    vehicle("zero", { km: 0 }),
    ...[null, undefined, NaN, Infinity, -1, "0"].map((km, index) =>
      vehicle(String(index), { km: km as number }),
    ),
  ];
  assert.equal(filterTabletVehicles(stock, filters()).length, stock.length);
  assert.deepEqual(ids(filterTabletVehicles(stock, filters({ kmMax: "0" }))), [
    "zero",
  ]);
  assert.deepEqual(ids(filterTabletVehicles(stock, filters({ kmMin: "0" }))), [
    "zero",
  ]);
});

test("ano ausente ou inválido não atende um filtro ativo", () => {
  const stock = [
    vehicle("valid"),
    ...[null, undefined, NaN, Infinity, -1, 0, 2023.5, "2024"].map(
      (year, index) => vehicle(String(index), { year: year as number }),
    ),
  ];
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ anoMin: "2020" }))),
    ["valid"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ anoMax: "2024" }))),
    ["valid"],
  );
});

test("busca combina tokens de marca, modelo e ano sem acentos ou hífens", () => {
  const stock = [
    vehicle("vw"),
    vehicle("citroen", {
      marca: "CITROËN",
      modelo: "C4 Cactus",
      name: "CITROËN C4 CACTUS",
      year: 2020,
    }),
  ];
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ search: "2024 cross VOLKS" }))),
    ["vw"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ search: "T Cross" }))),
    ["vw"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ search: " citroen 2020 " }))),
    ["citroen"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ search: "cactus 2024" }))),
    [],
  );
});

test("busca não indexa placa, ID ou slug privados", () => {
  const stock = [
    vehicle("123456", { placa: "ABC1D23", slug: "private-slug-abc1d23" }),
  ];
  for (const search of ["ABC1D23", "123456", "private"]) {
    assert.deepEqual(filterTabletVehicles(stock, filters({ search })), []);
  }
});

test("marca e câmbio são filtros exatos normalizados e combinados", () => {
  const stock = [
    vehicle("auto"),
    vehicle("manual", { cambio: "MANUAL" }),
    vehicle("fiat", { marca: "FIAT" }),
  ];
  assert.deepEqual(
    ids(
      filterTabletVehicles(
        stock,
        filters({ marca: "volkswagen", cambio: " automatico " }),
      ),
    ),
    ["auto"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ marca: "volks" }))),
    [],
  );
});

test("intervalos invertidos informam erro e não retornam resultados", () => {
  const input = filters({
    precoMin: "90000",
    precoMax: "80000",
    anoMin: "2024",
    anoMax: "2020",
    kmMin: "100",
    kmMax: "0",
  });
  const errors = getTabletFilterErrors(input);
  assert.deepEqual(Object.keys(errors).sort(), ["ano", "km", "preco"]);
  assert.match(errors.preco!, /mínimo/);
  assert.deepEqual(filterTabletVehicles([vehicle("a")], input), []);
});

test("limites malformados não são ignorados silenciosamente", () => {
  for (const precoMin of [
    "NaN",
    "Infinity",
    "-1",
    "10abc",
    "R$ 1000",
    "1.000,00",
    "1e4",
  ]) {
    const input = filters({ precoMin });
    assert.ok(getTabletFilterErrors(input).preco, precoMin);
    assert.deepEqual(filterTabletVehicles([vehicle("a")], input), [], precoMin);
  }
  assert.ok(getTabletFilterErrors(filters({ anoMax: "2024.5" })).ano);
  assert.ok(getTabletFilterErrors(filters({ kmMax: "-100" })).km);
  assert.deepEqual(
    getTabletFilterErrors(
      filters({ precoMin: " ", kmMax: "0", anoMin: "2024" }),
    ),
    {},
  );
});

test("ordenações numéricas mantêm empates estáveis e desconhecidos ao final", () => {
  const stock = [
    vehicle("a", { price: 90000, year: 2020, km: 10000 }),
    vehicle("b", { price: 80000, year: 2024, km: 0 }),
    vehicle("tie", { price: 90000, year: 2020, km: 10000 }),
    vehicle("unknown", {
      year: null as unknown as number,
      km: null as unknown as number,
    }),
  ];
  assert.deepEqual(ids(filterTabletVehicles(stock, filters())), [
    "b",
    "a",
    "tie",
    "unknown",
  ]);
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ sort: "price-desc" }))),
    ["unknown", "a", "tie", "b"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ sort: "year-desc" }))),
    ["b", "a", "tie", "unknown"],
  );
  assert.deepEqual(
    ids(filterTabletVehicles(stock, filters({ sort: "km-asc" }))),
    ["b", "a", "tie", "unknown"],
  );
});

test("ordenação por nome ignora caixa e acentos sem alterar o estoque ou filtros", () => {
  const a = Object.freeze(vehicle("a", { name: "Ágile" }));
  const b = Object.freeze(vehicle("b", { name: "agile" }));
  const z = Object.freeze(vehicle("z", { name: "Zafira" }));
  const stock = Object.freeze([z, a, b]);
  const input = Object.freeze(filters({ sort: "name" }));
  const output = filterTabletVehicles(stock, input);
  assert.deepEqual(ids(output), ["a", "b", "z"]);
  assert.deepEqual(stock, [z, a, b]);
  assert.equal(output[0], a);
  assert.notEqual(output, stock);
  assert.equal(input.sort, "name");
});
