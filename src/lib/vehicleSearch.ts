import type { Vehicle } from "@/catalog/endpoints/vehicles";

export function normalizeVehicleSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mesma busca livre na lupa e no estoque, inclusive com palavras combinadas. */
export function matchesVehicleSearch(
  vehicle: Partial<Vehicle>,
  term: string,
): boolean {
  const words = normalizeVehicleSearch(term).split(" ").filter(Boolean);
  if (!words.length) return true;

  const text = normalizeVehicleSearch(
    [
      vehicle.marca,
      vehicle.modelo,
      vehicle.name,
      vehicle.cor,
      vehicle.combustivel,
      vehicle.cambio,
      vehicle.motor,
      vehicle.placa,
      vehicle.year,
      vehicle.price,
      vehicle.valor_formatado,
    ]
      .filter((value) => value != null)
      .join(" "),
  );
  const vehicleWords = text.split(" ");
  // Letras/números isolados são modelos, não pedaços de outras palavras:
  // "T-Cross" não deve encontrar "Toyota Corolla Cross" por causa do T.
  return words.every((word) =>
    word.length === 1 ? vehicleWords.includes(word) : text.includes(word),
  );
}
