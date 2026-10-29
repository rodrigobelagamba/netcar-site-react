function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function canonicalModel(value) {
  return normalized(value)
    .replace(/^H\s*R\s*V(?=\s|$)/, "HRV")
    .replace(/^W\s*R\s*V(?=\s|$)/, "WRV")
    .replace(/^T\s*CROSS(?=\s|$)/, "T CROSS")
    .replace(/^TIGGO\s*5\s*X(?=\s|$)/, "TIGGO 5X");
}

/**
 * Match a model family or full version at the start of the model field.
 * Only known spacing aliases are collapsed: HB20S is not HB20 and CROSSFOX
 * is not FOX. Category filters still distinguish families such as Onix/Plus.
 * The optional brand supports records whose fallback name includes the brand.
 */
export function matchesLandingModel(value, filter, brand = "") {
  let model = normalized(value);
  const brandPrefix = normalized(brand);
  if (brandPrefix && model.startsWith(`${brandPrefix} `)) {
    model = model.slice(brandPrefix.length + 1);
  }
  model = canonicalModel(model);
  const prefix = canonicalModel(filter);
  return Boolean(
    prefix && (model === prefix || model.startsWith(`${prefix} `)),
  );
}
