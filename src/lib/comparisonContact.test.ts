import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonVehicleLabel,
  comparisonWhatsAppMessage,
} from "./comparisonContact";
import { extractVehicleIdFromSlug } from "./slug";
import { buildWhatsAppUrl, SITE_WHATSAPP_PREFIX } from "./whatsappMessages";

const first = {
  id: "19801",
  name: "Honda HR-V EX",
  marca: "Honda",
  modelo: "HR-V EX",
  year: 2022,
  placa: "ABC1D23",
};
const second = { ...first, id: "19802", placa: "DEF4G56" };

test("carros com mesmo modelo e ano chegam com referências e fichas distintas", () => {
  const message = comparisonWhatsAppMessage([first, second]);
  assert.ok(message.startsWith(SITE_WHATSAPP_PREFIX));
  assert.match(message, /comparei estes carros/);
  assert.match(message, /Código: 19801\nPlaca: ABC-XX23/);
  assert.match(message, /Código: 19802\nPlaca: DEF-XX56/);
  assert.ok(!message.includes(first.placa));
  assert.ok(!message.includes(second.placa));

  const links = [...message.matchAll(/^Ficha: (.+)$/gm)].map(
    (match) => new URL(match[1]),
  );
  assert.equal(links.length, 2);
  for (const [index, link] of links.entries()) {
    assert.equal(link.origin, "https://www.netcarmultimarcas.com.br");
    assert.equal(
      extractVehicleIdFromSlug(link.pathname),
      [first.id, second.id][index],
    );
  }
});

test("contato individual leva somente a unidade escolhida e respeita o número da API", () => {
  const message = comparisonWhatsAppMessage([second]);
  const link = new URL(buildWhatsAppUrl(" (51) 98888-7777 ", message));
  assert.equal(link.origin, "https://wa.me");
  assert.equal(link.pathname, "/5551988887777");
  assert.equal(link.searchParams.get("text"), message);
  assert.match(message, /quero mais informações sobre este carro/);
  assert.match(message, /Honda HR-V EX 2022/);
  assert.match(message, /Código: 19802/);
  assert.ok(!message.includes(first.id));
  assert.ok(!message.includes("comparei estes carros"));
});

test("unidade sem placa continua identificada pelo código e pela ficha", () => {
  const vehicle = { ...first, placa: undefined };
  const message = comparisonWhatsAppMessage([vehicle]);
  assert.match(message, /Código: 19801/);
  assert.match(message, /\/veiculo\/hr-v-ex-2022-19801/);
  assert.ok(!message.includes("Placa:"));
  assert.ok(!message.includes("undefined"));
});

test("mensagem não carrega quilometragem ou condições de troca do estoque", () => {
  const vehicle = { ...first, km: 12345, preco_com_troca: 98765 };
  const message = comparisonWhatsAppMessage([vehicle]);
  assert.doesNotMatch(message, /\bkm\b|quilometragem|troca|12345|98765/i);
  assert.equal(
    comparisonVehicleLabel({ ...first, marca: undefined, modelo: undefined }),
    "Honda HR-V EX 2022",
  );
});
