import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVehicleEditorialSummary } from "../../src/modules/detalhes/lib/vehicleEditorialSummary";

test("unit context reflects current engine, power and mileage without repeating equipment", () => {
  const common = { year: 2024, motor: "1.5", potencia: "177" };
  assert.equal(
    buildVehicleEditorialSummary({
      ...common,
      modelo: "HRV ADVANCE TURBO",
      km: 59000,
    }),
    "Motor 1.5 de 177 cv nesta unidade com 59 mil km.",
  );
  assert.equal(
    buildVehicleEditorialSummary({
      ...common,
      modelo: "HRV TOURING TURBO",
      km: 58975,
    }),
    "Motor 1.5 de 177 cv nesta unidade com 58 mil km.",
  );
  const context = buildVehicleEditorialSummary({
    ...common,
    km: 58975,
    opcionais: ["piloto_adaptativo", "unico_dono", "bancos_de_couro"],
  });
  assert.doesNotMatch(
    context,
    /ACC|adaptativo|turbo|único|couro|potente|baixo|apenas/i,
  );
});

test("missing fields never inherit claims from model names or previously rendered vehicles", () => {
  assert.equal(
    buildVehicleEditorialSummary({
      motor: "2.0 turbo",
      potencia: "250",
      km: 42000,
    }),
    "Motor 2.0 turbo de 250 cv nesta unidade com 42 mil km.",
  );
  assert.equal(
    buildVehicleEditorialSummary({
      modelo: "2.0 turbo 250 cv único dono",
      year: 2024,
    }),
    "Conheça os diferenciais desta unidade ano-modelo 2024.",
  );
  assert.equal(buildVehicleEditorialSummary({ modelo: "Touring 177 cv" }), "");
  assert.equal(buildVehicleEditorialSummary(undefined), "");
  assert.equal(buildVehicleEditorialSummary(null), "");
});

test("zero and invalid numeric data are omitted without changing the explicit power unit", () => {
  for (const km of [0, "0", -1, "não informado", NaN, Infinity]) {
    assert.equal(buildVehicleEditorialSummary({ km }), "");
  }
  for (const potencia of [0, "0", -1, "N/A", "177 cv turbo", NaN, Infinity]) {
    assert.equal(buildVehicleEditorialSummary({ potencia }), "");
  }
  assert.equal(
    buildVehicleEditorialSummary({ potencia: "200 hp" }),
    "Potência de 200 hp nesta unidade.",
  );
  assert.equal(
    buildVehicleEditorialSummary({ potencia: "177 cv", km: "58975" }),
    "Potência de 177 cv nesta unidade com 58 mil km.",
  );
  assert.equal(
    buildVehicleEditorialSummary({ motor: " 1.5 ", km: 59000 }),
    "Motor 1.5 nesta unidade com 59 mil km.",
  );
});

test("single-owner context requires the same exact current differential tag used by the page", () => {
  const vehicle = {
    modelo: "HRV TOURING TURBO",
    motor: "1.5",
    potencia: "177",
    km: 58975,
  };
  assert.equal(
    buildVehicleEditorialSummary({
      ...vehicle,
      diferenciais: [{ tag: "unico_dono" }],
    }),
    "Motor 1.5 de 177 cv nesta unidade de único dono com 58 mil km.",
  );
  for (const diferenciais of [undefined, null, [], [{ tag: "unico" }]]) {
    assert.doesNotMatch(
      buildVehicleEditorialSummary({ ...vehicle, diferenciais }),
      /único dono/,
    );
  }
  assert.doesNotMatch(
    buildVehicleEditorialSummary({ ...vehicle, modelo: "Touring único dono" }),
    /único dono/,
  );
});

test("editorial mileage follows the catalog visibility and rounding rules", () => {
  for (const [km, expected] of [
    [9_999, "Esta unidade tem 9.999 km."],
    [10_000, "Esta unidade tem 10 mil km."],
    [25_999, "Esta unidade tem 25 mil km."],
    [89_999, "Esta unidade tem 89 mil km."],
    [90_000, ""],
    [99_106, ""],
  ] as const) {
    assert.equal(buildVehicleEditorialSummary({ km }), expected);
    assert.equal(buildVehicleEditorialSummary({ km: String(km) }), expected);
  }
});

test("hidden mileage does not leak into the Tracker summary or erase supplied facts", () => {
  const tracker = {
    modelo: "TRACKER LT TURBO",
    motor: "1.4",
    potencia: "153",
    year: 2018,
    km: 99_106,
  };
  assert.equal(
    buildVehicleEditorialSummary(tracker),
    "Motor 1.4 de 153 cv nesta unidade.",
  );
  assert.equal(
    buildVehicleEditorialSummary({
      ...tracker,
      diferenciais: [{ tag: "unico_dono" }],
    }),
    "Motor 1.4 de 153 cv nesta unidade de único dono.",
  );
  assert.equal(
    buildVehicleEditorialSummary({ year: 2018, km: 99_106 }),
    "Conheça os diferenciais desta unidade ano-modelo 2018.",
  );
});
