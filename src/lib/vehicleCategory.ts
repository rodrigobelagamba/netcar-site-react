type VehicleCategoryInput = {
  marca?: string;
  modelo?: string;
  name?: string;
  categoria?: string;
};

function normalized(value: unknown): string {
  return String(value || "")
    .trim()
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Correções estreitas para classificações comprovadamente erradas na fonte.
 * O restante continua vindo do campo categoria da API; quando o cadastro for
 * corrigido no Automacar, estas regras mantêm exatamente o mesmo resultado.
 */
export function resolvedVehicleCategory(vehicle: VehicleCategoryInput): string {
  const brand = normalized(vehicle.marca);
  const model = normalized(vehicle.modelo || vehicle.name);

  if (/\b(RENEGADE|KICKS)\b/.test(model)) return "SUV";
  if (brand === "HONDA" && /^CITY\b/.test(model) && !/\bHATCH\b/.test(model)) {
    return "SEDAN";
  }

  return normalized(vehicle.categoria);
}
