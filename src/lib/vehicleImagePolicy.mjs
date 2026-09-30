import exclusions from "../../public/vehicle-image-exclusions.json" with { type: "json" };

const excludedStemsByVehicle = new Map(
  Object.entries(exclusions.vehicles).map(([id, entry]) => [
    id,
    new Set(entry.stems.map((stem) => stem.toLowerCase())),
  ]),
);

function imageStem(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const pathname = new URL(
      value.replace(/\\/g, "/"),
      "https://netcar.invalid/",
    ).pathname;
    return decodeURIComponent(pathname)
      .split("/")
      .pop()
      .replace(/\.(?:avif|webp|png|jpe?g)$/i, "")
      .replace(/_small$/i, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Quarantine only known wrong source files for a specific stock unit. New
 * filenames pass through immediately, including when mixed with stale images.
 * Shared by the browser and build generators; the PHP policy uses the same JSON.
 */
export function sanitizeVehicleImages(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return vehicle;
  const excludedStems = excludedStemsByVehicle.get(String(vehicle.id));
  if (!excludedStems) return vehicle;

  const blocked = (value) => excludedStems.has(imageStem(value));
  const filterImages = (values) => {
    if (!Array.isArray(values)) return values;
    const filtered = values.filter((value) => !blocked(value));
    return filtered.length === values.length ? values : filtered;
  };
  let result = vehicle;
  const replace = (key, value) => {
    if (value === vehicle[key]) return;
    if (result === vehicle) result = { ...vehicle };
    result[key] = value;
  };

  for (const key of ["images", "fullImages", "fotos"]) {
    replace(key, filterImages(vehicle[key]));
  }
  if (vehicle.imagens && typeof vehicle.imagens === "object") {
    const original = vehicle.imagens;
    let sanitized = original;
    for (const key of ["thumb", "full"]) {
      const value = filterImages(original[key]);
      if (value !== original[key]) {
        if (sanitized === original) sanitized = { ...original };
        sanitized[key] = value;
      }
    }
    replace("imagens", sanitized);
  }
  if (vehicle.imagens_site && typeof vehicle.imagens_site === "object") {
    const original = vehicle.imagens_site;
    let sanitized = original;
    for (const key of ["capa", "capa_thumb", "capa_opengraph", "galeria"]) {
      const value = key === "galeria"
        ? filterImages(original[key])
        : blocked(original[key]) ? null : original[key];
      if (value !== original[key]) {
        if (sanitized === original) sanitized = { ...original };
        sanitized[key] = value;
      }
    }
    replace("imagens_site", sanitized);
  }

  if (result === vehicle) return vehicle;
  const remaining = [
    result.images, result.fullImages, result.fotos,
    result.imagens?.thumb, result.imagens?.full, result.imagens_site?.galeria,
  ].some((values) => Array.isArray(values) && values.some(
    (value) => typeof value === "string" && value.trim() !== "",
  ))
    || ["capa", "capa_thumb", "capa_opengraph"].some(
      (key) => typeof result.imagens_site?.[key] === "string"
        && result.imagens_site[key].trim() !== "",
    );
  if (!remaining) {
    if (result.imagens_site) {
      result.imagens_site = { ...result.imagens_site, tem_fotos: 0 };
    }
    if (Object.hasOwn(result, "have_galery")) result.have_galery = 0;
  }
  return result;
}
