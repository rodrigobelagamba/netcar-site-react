import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { generateVehicleSlug } from "@/lib/slug";
import { vehicleWhatsAppRef } from "@/lib/vehicleWhatsAppRef";
import { siteWhatsAppMessage, withVehicleRef } from "@/lib/whatsappMessages";

type ComparisonVehicle = Pick<
  Vehicle,
  "id" | "name" | "marca" | "modelo" | "year" | "placa"
>;

export function comparisonVehicleLabel(vehicle: ComparisonVehicle): string {
  return `${vehicle.marca || ""} ${vehicle.modelo || vehicle.name} ${vehicle.year || ""}`
    .trim()
    .replace(/\s+/g, " ");
}

/** Identifica cada unidade, inclusive quando modelo e ano são iguais. */
export function comparisonWhatsAppMessage(
  vehicles: readonly ComparisonVehicle[],
): string {
  const intro = siteWhatsAppMessage(
    vehicles.length === 1
      ? "quero mais informações sobre este carro"
      : vehicles.length > 1
        ? "comparei estes carros e quero ajuda para escolher entre eles"
        : "quero ajuda para escolher um carro do estoque",
  );

  const references = vehicles.map((vehicle) =>
    [
      withVehicleRef(
        `${comparisonVehicleLabel(vehicle)}\nCódigo: ${vehicle.id}`,
        vehicleWhatsAppRef(vehicle),
      ),
      `Ficha: https://www.netcarmultimarcas.com.br/veiculo/${generateVehicleSlug(vehicle)}`,
    ].join("\n"),
  );

  return [intro, ...references].join("\n\n");
}

/** Link direto que abre o comparador já preenchido com os mesmos veículos. */
export function comparisonShareUrl(
  vehicles: readonly Pick<Vehicle, "id">[],
): string {
  const ids = [
    ...new Set(
      vehicles
        .map((vehicle) => String(vehicle.id || "").trim())
        .filter((id) => /^[1-9][0-9]*$/.test(id)),
    ),
  ];
  if (ids.length === 0) {
    return "https://www.netcarmultimarcas.com.br/comparar";
  }
  return `https://www.netcarmultimarcas.com.br/comparar?ids=${encodeURIComponent(ids.join(","))}`;
}

/** Mensagem neutra para compartilhar o comparativo com família ou amigos no WhatsApp. */
export function comparisonShareWhatsAppUrl(
  vehicles: readonly ComparisonVehicle[],
): string {
  const names = vehicles.map((vehicle) => comparisonVehicleLabel(vehicle));
  const summary =
    names.length > 0
      ? `Estou comparando estas opções na Netcar: ${names.join(" x ")}.`
      : "Veja esta comparação de seminovos na Netcar:";
  const text = `${summary}\n${comparisonShareUrl(vehicles)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
