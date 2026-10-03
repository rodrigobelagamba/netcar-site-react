import { normalizeVehicleBrand } from "./vehicleBrand";

export type VehicleBrandOrigin = "chinese" | "german" | "italian";

// Brand origin, NOT the assembly country or current shareholder's nationality.
// Explicit registry: unknown brands must not silently satisfy an exclusion.
// Primary sources for the supported origins:
// https://www.byd.com/eu/blog/Hello-we-are-BYD
// https://www.cheryinternational.com/my/aboutchery_my/introduction_my/index.shtml
// https://www.volkswagen-newsroom.com/de/geschichte-3693
// https://www.stellantis.com/en/brands/fiat
const ORIGIN_BRANDS: Record<VehicleBrandOrigin, ReadonlySet<string>> = {
  chinese: new Set(["byd", "chery"]),
  german: new Set(["volkswagen"]),
  italian: new Set(["fiat"]),
};
// Preserve the other known brands from the existing stock registry. They are
// outside all three supported origins; an absent brand remains unknown.
const OTHER_BRANDS = new Set([
  "renault",
  "peugeot",
  "chevrolet",
  "hyundai",
  "nissan",
  "ford",
  "honda",
  "jeep",
  "toyota",
  "citroen",
]);

export function hasVehicleBrandOrigin(
  brand: unknown,
  origin: VehicleBrandOrigin,
): boolean | undefined {
  const canonical = normalizeVehicleBrand(brand);
  for (const [registeredOrigin, brands] of Object.entries(ORIGIN_BRANDS)) {
    if (brands.has(canonical)) return registeredOrigin === origin;
  }
  if (OTHER_BRANDS.has(canonical)) return false;
  return undefined;
}

export function hasChineseBrandOrigin(brand: unknown): boolean | undefined {
  return hasVehicleBrandOrigin(brand, "chinese");
}

const ORIGIN_WORDS: Record<VehicleBrandOrigin, string> = {
  chinese: "(?:chines(?:a|as|es)?|(?:da\\s+)?china)",
  german: "(?:alem(?:ao|a|aes|as)|(?:da\\s+)?alemanha)",
  italian: "(?:italian[oa]s?|(?:da\\s+)?italia)",
};
const ORIGIN_PATTERN = `(?:${Object.values(ORIGIN_WORDS).join("|")})`;
const NOUNS =
  "(?:(?:carros?|veiculos?|marcas?|modelos?|fabricantes?|os|as|um|uma|de|origem|que|seja|sejam)\\s+)*";

function originOf(word: string): VehicleBrandOrigin {
  return Object.entries(ORIGIN_WORDS).find(([, pattern]) =>
    new RegExp(`^${pattern}$`).test(word),
  )![0] as VehicleBrandOrigin;
}

export function parseVehicleBrandOrigin(text: string): {
  remaining: string;
  brandOrigin?: VehicleBrandOrigin;
  excludedBrandOrigins: VehicleBrandOrigin[];
  invalid: boolean;
} {
  let brandOrigin: VehicleBrandOrigin | undefined;
  const excluded = new Set<VehicleBrandOrigin>();
  let invalid = false;
  const setOrigin = (origin: VehicleBrandOrigin) => {
    if (brandOrigin && brandOrigin !== origin) invalid = true;
    else brandOrigin = origin;
    return " ";
  };
  const excludeOrigins = (phrase: string) => {
    for (const match of phrase.matchAll(
      new RegExp(`\\b${ORIGIN_PATTERN}\\b`, "g"),
    )) {
      excluded.add(originOf(match[0]));
    }
    return " ";
  };
  // Consume each negation together with its target(s), preserving unsupported
  // negations of attributes such as "alemão não automático" as residual text.
  let remaining = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  remaining = remaining.replace(
    new RegExp(
      `\\b(?:nao(?:\\s+(?:quero|seja|sejam))?|sem|menos|exceto|excluindo|excluir|tirando|nem)[\\s-]+${NOUNS}${ORIGIN_PATTERN}(?:\\s*(?:,|\\be\\b|\\bnem\\b|\\bou\\b)\\s*${NOUNS}${ORIGIN_PATTERN})*\\b`,
      "g",
    ),
    excludeOrigins,
  );
  remaining = remaining.replace(
    new RegExp(`\\b${ORIGIN_PATTERN}\\s+nao\\b(?=\\s*(?:$|[,;.?!]))`, "g"),
    excludeOrigins,
  );
  remaining = remaining.replace(
    new RegExp(`\\b${NOUNS}(${ORIGIN_PATTERN})\\b`, "g"),
    (_, word: string) => setOrigin(originOf(word)),
  );
  if (brandOrigin && excluded.has(brandOrigin)) invalid = true;
  return {
    remaining,
    brandOrigin,
    excludedBrandOrigins: [...excluded],
    invalid,
  };
}
