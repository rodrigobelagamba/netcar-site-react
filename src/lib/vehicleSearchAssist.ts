import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { matchesVehicleBrand } from "./vehicleBrand";
import {
  matchesVehicleSearch,
  normalizeVehicleSearch,
  parseVehicleSearch,
} from "./vehicleSearch";

type Suggestion = { query: string; label: string; detail?: string };
export type VehicleSearchAssist = {
  labels: string[];
  suggestions: Suggestion[];
  guidance?: string;
  uncertain: boolean;
  invalid: boolean;
};

const VOCABULARY = [
  ["Hatch", "Categoria"],
  ["SUV", "Categoria"],
  ["Sedã", "Categoria"],
  ["Picape", "Categoria"],
  ["Utilitário", "Categoria"],
  ["Minivan", "Categoria"],
  ["Cupê", "Categoria"],
  ["Automático", "Câmbio"],
  ["Manual", "Câmbio"],
  ["Mecânico", "Câmbio manual"],
  ["Flex", "Combustível"],
  ["Gasolina", "Combustível"],
  ["Diesel", "Combustível"],
  ["Elétrico", "Combustível"],
  ["Híbrido", "Combustível"],
  ["Chineses", "Origem da marca"],
  ["Alemães", "Origem da marca"],
  ["Alemão", "Origem da marca"],
  ["Italiano", "Origem da marca"],
  ["Barato", "Até R$ 80.000"],
] as const;

const displayLabel = (label: string) =>
  label.charAt(0).toLocaleUpperCase("pt-BR") + label.slice(1);

const sameFilterValue = (left: unknown, right: unknown): boolean =>
  Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length &&
      left.every((value, index) => value === right[index])
    : left === right;

/** Local suggestions only: selecting one still submits the shared search query. */
export function getVehicleSearchAssist(
  value: string,
  vehicles: readonly Partial<Vehicle>[] = [],
): VehicleSearchAssist {
  const query = value.trim();
  const parsed = parseVehicleSearch(query);
  const result: VehicleSearchAssist = {
    labels: [],
    suggestions: [],
    uncertain: false,
    invalid: parsed.invalid,
  };
  if (!query) {
    result.suggestions = ["Hatch", "SUV", "Automático"].map((example) => ({
      query: example,
      label: example,
      detail: "Exemplo de busca",
    }));
    return result;
  }
  if (query.length > 120) {
    result.uncertain = true;
    result.guidance =
      "Use até 120 caracteres para que a busca considere o texto completo.";
    return result;
  }
  if (parsed.invalid) {
    result.uncertain = true;
    result.guidance =
      parsed.hints.find((hint) => hint.includes("contradizem")) ||
      "Confira os limites e as unidades da busca antes de continuar.";
    return result;
  }

  // Inspect residual words, so supported numeric operators and brand-origin
  // exclusions are not mistaken for unsupported generic negation or OR.
  const residual = parsed.terms.join(" ");
  if (parsed.terms.includes("ou")) {
    result.uncertain = true;
    result.guidance =
      "Ainda não combino alternativas com “ou”. Busque uma opção por vez.";
    return result;
  }
  if (/\b(?:nao|sem|exceto|excluindo|excluir|tirando|menos)\b/.test(residual)) {
    result.uncertain = true;
    result.guidance =
      "Ainda não interpreto essa exclusão. Aceito exclusão de marcas por origem; para outros casos, informe o que deseja incluir.";
    return result;
  }
  const normalized = normalizeVehicleSearch(query);
  if (
    /\b(?:baix[ao]s?\s*(?:km|quilometragem)|poucos?\s*(?:km|quilometros)|quilometragem\s+baixa)\b/.test(
      normalized,
    )
  ) {
    result.uncertain = true;
    result.guidance =
      "Para baixa quilometragem, informe o máximo de km que aceita. Não escolhi um limite por você.";
    return result;
  }
  if (/\b(?:menor preco|mais em conta|mais nov[oa]s?)\b/.test(normalized)) {
    result.uncertain = true;
    result.guidance =
      "Essa frase não altera a ordenação. Use o seletor de ordenação do estoque ou informe um limite na busca.";
    return result;
  }

  const add = (suggestion: Suggestion) => {
    if (result.suggestions.length >= 4 || suggestion.query.length > 120) return;
    const key = normalizeVehicleSearch(suggestion.query);
    if (
      key === normalized ||
      result.suggestions.some(
        (item) =>
          normalizeVehicleSearch(item.query) === key ||
          item.label === suggestion.label,
      )
    )
      return;
    if (!parseVehicleSearch(suggestion.query).invalid)
      result.suggestions.push(suggestion);
  };

  // An isolated unitless budget has two useful interpretations. Require the
  // parser to classify it as an amount, preserving numeric model/year names.
  if (
    /^(?:at[eé]\s*)?\d[\d.,]*(?:\s*(?:mil|k))?$/i.test(query) &&
    parsed.terms.length === 0 &&
    parsed.filters.priceMax != null &&
    Object.keys(parsed.filters).length === 1
  ) {
    const amount = parsed.filters.priceMax.toLocaleString("pt-BR");
    add({
      query: `até R$ ${amount}`,
      label: `Até R$ ${amount}`,
      detail: "Preço máximo",
    });
    add({
      query: `até ${amount} km`,
      label: `Até ${amount} km`,
      detail: "Quilometragem máxima",
    });
    result.uncertain = true;
    result.guidance = `Por enquanto, filtro preços até R$ ${amount}. Você quis dizer preço ou quilometragem?`;
    return result;
  }

  const lastWord = /([\p{L}]+)$/u.exec(query);
  if (lastWord) {
    const fragment = normalizeVehicleSearch(lastWord[1]);
    const prefix = query.slice(0, lastWord.index);
    const amountSuffix = /\d[\d.,]*(?:\s*(?:mil|k))?\s*(?:de\s*)?$/i.exec(
      prefix,
    );
    // A lone q already signals an incomplete unit; k alone is also a complete
    // thousands suffix and must keep that existing meaning.
    if (amountSuffix && fragment.length >= 1 && fragment !== "k") {
      for (const unit of ["quilometragem", "quilômetros", "km", "reais"]) {
        if (
          !normalizeVehicleSearch(unit).startsWith(fragment) ||
          normalizeVehicleSearch(unit) === fragment
        )
          continue;
        const completed = prefix + unit;
        const interpretation = parseVehicleSearch(completed);
        // Explicit incompatible dimensions make the shared parser reject a
        // completion (for example, R$ 50000 quilometragem).
        if (interpretation.invalid) continue;
        const beforeAmount = parseVehicleSearch(
          prefix.slice(0, amountSuffix.index),
        );
        if (
          !Object.entries(beforeAmount.filters).every(([key, bound]) =>
            sameFilterValue(
              interpretation.filters[
                key as keyof typeof interpretation.filters
              ],
              bound,
            ),
          )
        )
          continue;
        add({
          query: completed,
          label: interpretation.labels.map(displayLabel).join(" · "),
          detail:
            unit === "reais" ? "Confirmar preço" : "Confirmar quilometragem",
        });
      }
      if (result.suggestions.length) {
        result.uncertain = true;
        result.guidance =
          "Complete a unidade para confirmar o significado do valor.";
        return result;
      }
    }
  }

  const complete = (
    replacement: string,
    detail: string,
    brand = false,
    vehicle?: Partial<Vehicle>,
  ) => {
    const words = Array.from(query.matchAll(/\S+/g));
    for (const word of words) {
      const start = word.index!;
      const fragment = query.slice(start);
      const normalizedFragment = normalizeVehicleSearch(fragment);
      if (
        normalizedFragment.length < 2 ||
        (!normalizeVehicleSearch(replacement).startsWith(normalizedFragment) &&
          !(brand && matchesVehicleBrand(replacement, fragment)))
      )
        continue;
      const prefix = query.slice(0, start);
      const completed = prefix + replacement;
      const candidate = parseVehicleSearch(completed);
      const prefixFilters = parseVehicleSearch(prefix).filters;
      if (
        candidate.invalid ||
        !Object.entries(prefixFilters).every(([key, bound]) =>
          sameFilterValue(
            candidate.filters[key as keyof typeof candidate.filters],
            bound,
          ),
        )
      )
        continue;
      if (vehicle && !matchesVehicleSearch(vehicle, candidate)) continue;
      add({ query: completed, label: completed, detail });
      break;
    }
  };

  // Stable vocabulary works before the catalog has loaded. Catalog completions
  // only use actual brand/model values and retain every preceding restriction.
  for (const [word, detail] of VOCABULARY) complete(word, detail);
  for (const vehicle of vehicles) {
    if (vehicle.marca)
      complete(vehicle.marca, "Marca no estoque", true, vehicle);
    if (vehicle.modelo)
      complete(vehicle.modelo, "Modelo no estoque", false, vehicle);
    if (result.suggestions.length >= 4) break;
  }

  const textKnown =
    parsed.terms.length === 0 ||
    vehicles.some((vehicle) =>
      matchesVehicleSearch(vehicle, { ...parsed, filters: {} }),
    );
  result.labels = parsed.labels
    .filter((label) => textKnown || !label.startsWith("Busca:"))
    .map(displayLabel);
  if (!textKnown) {
    result.uncertain = true;
    result.guidance = result.suggestions.length
      ? "Escolha uma sugestão para completar esse trecho da busca."
      : "Ainda não reconheci parte da busca. Confira a marca ou o modelo e escreva os limites com unidades.";
  } else if (parsed.hints.length) {
    result.guidance = parsed.hints.join(" ");
  }
  return result;
}
