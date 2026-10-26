import assert from "node:assert/strict";
import { test } from "node:test";
import { buildVehiclePhotoCaptions } from "../../src/modules/detalhes/lib/vehiclePhotoCaptions";
import type { EquipmentVehicle } from "../../src/lib/vehicleEquipment";

const unit: EquipmentVehicle = {
  id: "19898",
  marca: "HONDA",
  modelo: "HRV TOURING TURBO",
  year: 2024,
  motor: "1.5",
  cambio: "AUTOMATICO",
};
const image = (suffix: string) =>
  `https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/25072026HRV%20TOURING%20JCI5J59${suffix}.avif`;

test("captions follow reviewed filenames after gallery reordering", () => {
  const images = [image("12"), image("6"), image("10")];
  assert.deepEqual(buildVehiclePhotoCaptions(unit, images), [
    "Volante e comandos",
    "Desenho da frente",
    "Vista traseira",
  ]);
  assert.deepEqual(images, [image("12"), image("6"), image("10")]);
});

test("photo captions cannot be transported to other units or model years", () => {
  for (const other of [
    undefined,
    { ...unit, id: "19854" },
    { ...unit, year: 2025 },
    { ...unit, modelo: "HRV EX" },
    { ...unit, marca: "VOLKSWAGEN" },
  ]) {
    assert.deepEqual(buildVehiclePhotoCaptions(other, [image("12")]), [
      "",
    ]);
  }
});

test("new and malformed photo names do not receive unreviewed captions", () => {
  assert.deepEqual(
    buildVehiclePhotoCaptions(unit, [image("99"), image("12").replace("JCI5J59", "OTHER"), "%E0%A4%A"]),
    ["", "", ""],
  );
});

test("equipment wording follows the shared resolver, including explicit absence", () => {
  const pictures = [image("11"), image("2"), image("4"), image("5")];
  assert.deepEqual(buildVehiclePhotoCaptions(unit, pictures), [
    "Bancos e acabamento interno",
    "Seletor de câmbio e console",
    "Multimídia e climatização",
    "Comandos de partida e volante",
  ]);
  assert.deepEqual(buildVehiclePhotoCaptions({
    ...unit,
    opcionais: ["bancos_de_couro", "cambio_cvt", "ar_condicionado_digital", "botao"],
  }, pictures), [
    "Conforto dos bancos em couro",
    "Câmbio CVT, sem trocas manuais",
    "Multimídia e ar digital",
    "Partida por botão",
  ]);
  assert.equal(buildVehiclePhotoCaptions({
    ...unit,
    opcionais: ["bancos_de_couro", "Sem bancos em couro"],
  }, [image("11")])[0], "Bancos e acabamento interno");
});

const advance: EquipmentVehicle = {
  ...unit,
  id: "19854",
  modelo: "HRV ADVANCE TURBO",
};
const advanceImage = (suffix: string) =>
  `https://www.netcarmultimarcas.com.br/imagens/veiculos_automacar/15062026HRV%20JCN8I74${suffix}.avif`;

test("all 13 reviewed Advance photos have captions and its detail sequence stays independent", () => {
  const gallery = ["CAPA", "6", "7", "9", "10", "8", "11", "1", "12", "2", "3", "4", "5"].map(advanceImage);
  const captions = buildVehiclePhotoCaptions(advance, gallery);
  assert.equal(captions.length, 13);
  assert.ok(captions.every(Boolean));
  // These are different photos from the Touring files with the same suffixes.
  assert.deepEqual(buildVehiclePhotoCaptions(advance, [
    advanceImage("5"), advanceImage("3"), advanceImage("4"),
  ]), [
    "Cabine vista pela porta",
    "Tela e climatização",
    "Comandos junto ao volante",
  ]);
  assert.deepEqual(buildVehiclePhotoCaptions(advance, [
    advanceImage("CAPA").replace(".avif", ".png"),
    advanceImage("CAPA_small") + "?v=1#photo",
  ]), [captions[0], captions[0]]);
});

test("Advance captions require exact unit, version, year and reviewed filename", () => {
  for (const other of [
    { ...advance, id: "19898" },
    { ...advance, modelo: "HRV TOURING TURBO" },
    { ...advance, year: 2025 },
    { ...advance, marca: "VOLKSWAGEN" },
  ]) {
    assert.deepEqual(buildVehiclePhotoCaptions(other, [advanceImage("3")]), [""]);
  }
  assert.deepEqual(buildVehiclePhotoCaptions(advance, [
    image("3"),
    advanceImage("3").replace("15062026", "16062026"),
    advanceImage("3").replace("JCN8I74", "OTHER"),
    advanceImage("99"),
    "%E0%A4%A",
  ]), ["", "", "", "", ""]);
  assert.deepEqual(buildVehiclePhotoCaptions(unit, [advanceImage("3")]), [""]);
});

test("Advance equipment captions retain a visual fallback when current facts disappear", () => {
  const pictures = ["10", "11", "12", "2", "3", "4"].map(advanceImage);
  const equipped: EquipmentVehicle = {
    ...advance,
    opcionais: ["camera_de_re", "bancos_de_couro", "comandos_no_volante", "cambio_cvt", "sem-_fio", "botao"],
  };
  assert.deepEqual(buildVehiclePhotoCaptions(equipped, pictures), [
    "Traseira e para-choque",
    "Bancos em couro claro",
    "Comandos no volante",
    "Câmbio CVT ao alcance",
    "Android Auto e Apple CarPlay",
    "Partida por botão",
  ]);
  assert.deepEqual(buildVehiclePhotoCaptions(advance, pictures), [
    "Traseira e para-choque",
    "Bancos e acabamento claro",
    "Volante e instrumentos",
    "Seletor de câmbio e console",
    "Tela e climatização",
    "Comandos junto ao volante",
  ]);
  assert.equal(buildVehiclePhotoCaptions({
    ...equipped,
    opcionais: [...equipped.opcionais!, "Sem bancos em couro"],
  }, [advanceImage("11")])[0], "Bancos e acabamento claro");
  assert.doesNotMatch(buildVehiclePhotoCaptions(equipped,
    ["2", "3", "4", "12"].map(advanceImage)).join(" "), /ACC|adaptativo|indu[çc][ãa]o|dual zone/i);
});
