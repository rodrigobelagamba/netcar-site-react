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
