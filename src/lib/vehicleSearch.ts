import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { resolvedVehicleCategory } from "./vehicleCategory";
import { normalizeVehicleBrand } from "./vehicleBrand";
import {
  hasVehicleBrandOrigin,
  parseVehicleBrandOrigin,
  type VehicleBrandOrigin,
} from "./vehicleBrandOrigin";
import {
  parseVehicleSearchNumbers,
  type VehicleNumericFilters,
} from "./vehicleSearchNumbers";

export function normalizeVehicleSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type SearchFilters = VehicleNumericFilters & {
  category?: string;
  transmission?: string;
  fuel?: string;
  color?: string;
  seats?: number;
  brandOrigin?: VehicleBrandOrigin;
  excludedBrandOrigins?: VehicleBrandOrigin[];
};

export type ParsedVehicleSearch = {
  terms: string[];
  filters: SearchFilters;
  labels: string[];
  hints: string[];
  invalid: boolean;
};

const CATEGORIES: Record<string, string> = Object.assign(Object.create(null), {
  hatch: "HATCH",
  hatches: "HATCH",
  hatchs: "HATCH",
  hatchback: "HATCH",
  hacth: "HATCH",
  hatche: "HATCH",
  suv: "SUV",
  suvs: "SUV",
  sedan: "SEDAN",
  sedans: "SEDAN",
  seda: "SEDAN",
  sedas: "SEDAN",
  picape: "PICAPE",
  picapes: "PICAPE",
  pickup: "PICAPE",
  pickups: "PICAPE",
  utilitario: "UTILITARIO",
  utilitarios: "UTILITARIO",
  minivan: "MINIVAN",
  coupe: "COUPE",
  cupe: "COUPE",
});
const COLORS: Record<string, string> = Object.assign(Object.create(null), {
  branco: "branc",
  branca: "branc",
  brancos: "branc",
  brancas: "branc",
  preto: "pret",
  preta: "pret",
  pretos: "pret",
  pretas: "pret",
  vermelho: "vermelh",
  vermelha: "vermelh",
  vermelhos: "vermelh",
  vermelhas: "vermelh",
  prata: "prata",
  cinza: "cinza",
  azul: "azul",
  verde: "verde",
  amarelo: "amarel",
  amarela: "amarel",
  bege: "bege",
  marrom: "marrom",
});
const COLOR_LABELS: Record<string, string> = {
  branc: "Branco",
  pret: "Preto",
  vermelh: "Vermelho",
  prata: "Prata",
  cinza: "Cinza",
  azul: "Azul",
  verde: "Verde",
  amarel: "Amarelo",
  bege: "Bege",
  marrom: "Marrom",
};
const FILLER = new Set([
  "quero",
  "procuro",
  "busco",
  "buscando",
  "procurando",
  "buscar",
  "encontrar",
  "ver",
  "mostrar",
  "carro",
  "carros",
  "veiculo",
  "veiculos",
  "seminovo",
  "seminovos",
  "usado",
  "usados",
  "um",
  "uma",
  "uns",
  "umas",
  "com",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "a",
  "o",
  "os",
  "as",
  "que",
  "seja",
  "tenha",
  "por",
  "no",
  "na",
  "em",
  "ate",
  "preco",
  "valor",
  "orcamento",
  "ano",
  "modelo",
]);

function filterLabels(filters: SearchFilters): string[] {
  const labels: string[] = [];
  const originLabels: Record<VehicleBrandOrigin, string> = {
    chinese: "chinesas",
    german: "alemãs",
    italian: "italianas",
  };
  if (filters.brandOrigin)
    labels.push(`Marcas ${originLabels[filters.brandOrigin]}`);
  for (const origin of filters.excludedBrandOrigins || []) {
    labels.push(`Exceto marcas ${originLabels[origin]}`);
  }
  if (filters.category)
    labels.push(
      { HATCH: "Hatch", SUV: "SUV", SEDAN: "Sedã", PICAPE: "Picape" }[
        filters.category
      ] || filters.category,
    );
  if (filters.transmission)
    labels.push(
      filters.transmission === "automatico" ? "Automático" : "Manual",
    );
  if (filters.fuel)
    labels.push(
      {
        flex: "Flex",
        gasolina: "Gasolina",
        diesel: "Diesel",
        eletrico: "Elétrico",
        hibrido: "Híbrido",
      }[filters.fuel] || filters.fuel,
    );
  if (filters.color) labels.push(COLOR_LABELS[filters.color]);
  if (filters.seats) labels.push(`${filters.seats} lugares`);
  const number = (n: number) => n.toLocaleString("pt-BR");
  for (const field of ["price", "year", "km"] as const) {
    const min = filters[`${field}Min`];
    const max = filters[`${field}Max`];
    const format = (n: number) =>
      field === "price"
        ? `R$ ${number(n)}`
        : field === "km"
          ? `${number(n)} km`
          : String(n);
    const prefix = field === "year" ? "Modelo " : "";
    if (min != null && min === max) labels.push(`${prefix}${format(min)}`);
    else if (min != null && max != null)
      labels.push(`${prefix}${format(min)} a ${format(max)}`);
    else if (max != null) labels.push(`${prefix}até ${format(max)}`);
    else if (min != null) labels.push(`${prefix}a partir de ${format(min)}`);
  }
  return labels;
}

/** Deterministic, local interpretation: no requests/AI calls per keystroke. */
export function parseVehicleSearch(term: string): ParsedVehicleSearch {
  const normalized = term
    .slice(0, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const numeric = parseVehicleSearchNumbers(normalized);
  const filters: SearchFilters = numeric.filters;
  // Store-defined meaning of "barato". Intersect with explicit limits rather
  // than widening a customer's lower budget (e.g. "barato até 50 mil").
  const withoutBudgetAlias = numeric.remaining.replace(
    /\b(?:mais\s+)?barat[oa]s?\b/g,
    () => {
      filters.priceMax = Math.min(filters.priceMax ?? Infinity, 80_000);
      return " ";
    },
  );
  const origin = parseVehicleBrandOrigin(withoutBudgetAlias);
  if (origin.brandOrigin) filters.brandOrigin = origin.brandOrigin;
  if (origin.excludedBrandOrigins.length)
    filters.excludedBrandOrigins = origin.excludedBrandOrigins;
  let remaining = origin.remaining;

  remaining = remaining.replace(
    /\b([2-9])\s*(?:lugares|assentos)\b/g,
    (_, count) => {
      filters.seats = Number(count);
      return " ";
    },
  );
  remaining = remaining
    .replace(
      /\bcambio\s+(?:automatico|automaticos|automatica|automaticas|aut|cvt)\b/g,
      "automatico",
    )
    .replace(
      /\b(?:cambio|transmissao|marchas?)\s+(?:manual|manuais|mecanic[oa]s?)\b/g,
      "manual",
    );
  const terms = normalizeVehicleSearch(remaining)
    .replace(/\bg m\b/g, "gm")
    .replace(/\bv w\b/g, "vw")
    .replace(/\bgeneral motors\b/g, "chevrolet")
    .replace(/\bcaoa chery\b/g, "chery")
    .split(" ")
    .filter(Boolean)
    .flatMap((word) => {
      if (CATEGORIES[word]) {
        filters.category = CATEGORIES[word];
        return [];
      }
      if (/^(automatic[oa]s?|automatic|automtico|auto|aut|cvt)$/.test(word)) {
        filters.transmission = "automatico";
        return [];
      }
      if (/^(manual|manuais|mecanic[oa]s?)$/.test(word)) {
        filters.transmission = "manual";
        return [];
      }
      if (/^(flex|gasolina|diesel|eletric[oa]s?|hibrid[oa]s?)$/.test(word)) {
        filters.fuel = word.startsWith("eletric")
          ? "eletrico"
          : word.startsWith("hibrid")
            ? "hibrido"
            : word;
        return [];
      }
      if (COLORS[word]) {
        filters.color = COLORS[word];
        return [];
      }
      return FILLER.has(word) ? [] : [normalizeVehicleBrand(word)];
    });
  const labels = filterLabels(filters);
  if (terms.length) labels.unshift(`Busca: ${terms.join(" ")}`);
  return {
    terms,
    filters,
    labels,
    hints: numeric.hints,
    invalid:
      numeric.invalid ||
      origin.invalid ||
      (filters.priceMin != null &&
        filters.priceMax != null &&
        filters.priceMin > filters.priceMax),
  };
}

// One edit/adjacent transposition in long alphabetic words only. Never relax
// budgets, model numbers, years, or short names such as Ka / C3 / T-Cross.
function closeWord(query: string, actual: string): boolean {
  if (
    query.length < 5 ||
    !/^[a-z]+$/.test(query) ||
    !/^[a-z]+$/.test(actual) ||
    Math.abs(query.length - actual.length) > 1
  )
    return false;
  let i = 0;
  while (i < query.length && query[i] === actual[i]) i++;
  if (query.length === actual.length) {
    return (
      query.slice(i + 1) === actual.slice(i + 1) ||
      (query[i] === actual[i + 1] &&
        query[i + 1] === actual[i] &&
        query.slice(i + 2) === actual.slice(i + 2))
    );
  }
  return query.length > actual.length
    ? query.slice(i + 1) === actual.slice(i)
    : query.slice(i) === actual.slice(i + 1);
}

/** Shared by the magnifier and inventory; parse once before filtering a list. */
export function matchesVehicleSearch(
  vehicle: Partial<Vehicle>,
  term: string | ParsedVehicleSearch,
): boolean {
  const { terms, filters, invalid } =
    typeof term === "string" ? parseVehicleSearch(term) : term;
  if (invalid) return false;
  if (
    filters.brandOrigin &&
    hasVehicleBrandOrigin(vehicle.marca, filters.brandOrigin) !== true
  )
    return false;
  if (
    filters.excludedBrandOrigins?.some(
      (origin) => hasVehicleBrandOrigin(vehicle.marca, origin) !== false,
    )
  )
    return false;
  for (const field of ["price", "year", "km"] as const) {
    const min = filters[`${field}Min`];
    const max = filters[`${field}Max`];
    if (min == null && max == null) continue;
    if (
      (min != null && !Number.isFinite(min)) ||
      (max != null && !Number.isFinite(max))
    )
      return false;
    const value = vehicle[field];
    if (
      value == null ||
      !Number.isFinite(value) ||
      value < 0 ||
      (field !== "km" && value === 0)
    )
      return false;
    if ((min != null && value < min) || (max != null && value > max))
      return false;
  }
  const category = resolvedVehicleCategory(vehicle);
  if (
    filters.category &&
    (category === "PICKUP" ? "PICAPE" : category) !== filters.category
  )
    return false;
  if (filters.transmission) {
    const transmission = normalizeVehicleSearch(vehicle.cambio);
    // Automated gearboxes are not silently promoted to conventional automatic.
    if (
      filters.transmission === "automatico"
        ? !/\b(automatic[oa]|cvt|dsg|dct)\b/.test(transmission)
        : !/\b(?:manual|mecanic[oa])\b/.test(transmission) ||
          /automatiz|robotiz|dualogic|easytronic|i motion/.test(transmission)
    )
      return false;
  }
  if (filters.fuel) {
    const fuel = normalizeVehicleSearch(vehicle.combustivel);
    if (filters.fuel === "eletrico" && /hibrid|gasolina|flex|diesel/.test(fuel))
      return false;
    if (!fuel.includes(filters.fuel.replace(/o$/, ""))) return false;
  }
  if (
    filters.color &&
    !normalizeVehicleSearch(vehicle.cor).startsWith(filters.color)
  )
    return false;
  if (filters.seats && vehicle.lugares !== filters.seats) return false;
  const words = normalizeVehicleSearch(
    [
      vehicle.marca,
      normalizeVehicleBrand(vehicle.marca),
      vehicle.modelo,
      vehicle.name,
      vehicle.cor,
      vehicle.combustivel,
      vehicle.cambio,
      vehicle.motor,
      vehicle.placa,
      vehicle.year,
    ]
      .filter((value) => value != null)
      .join(" "),
  ).split(" ");
  return terms.every((term) =>
    words.some((word) =>
      term.length === 1 || /\d/.test(term)
        ? word === term
        : word.startsWith(term) || closeWord(term, word),
    ),
  );
}
