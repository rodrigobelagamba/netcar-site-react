/** Banner premium. Keep these rules in parity with public/home-hero.php. */
export const HOME_HERO_LIMIT = 4;

function numeric(value) {
  if (typeof value !== "number" && typeof value !== "string") return NaN;
  if (typeof value === "string" && !value.trim()) return NaN;
  if (
    typeof value === "string" &&
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  )
    return NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

export function isHomeHeroCandidate(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return false;
  const year = numeric(vehicle.year);
  const km = numeric(vehicle.km);
  return (
    numeric(vehicle.id) > 0 &&
    typeof vehicle.marca === "string" &&
    Boolean(vehicle.marca.trim()) &&
    typeof vehicle.modelo === "string" &&
    Boolean(vehicle.modelo.trim()) &&
    numeric(vehicle.price) > 100_000 &&
    Number.isInteger(year) &&
    year > 2020 &&
    km > 0 &&
    km <= 70_000 &&
    numeric(vehicle.imagens_site?.tem_fotos) > 0 &&
    typeof vehicle.imagens_site?.capa === "string" &&
    /\.png(?:$|[?#])/i.test(vehicle.imagens_site.capa.trim())
  );
}

/** Civil day in São Paulo, independent of the visitor's timezone. */
export function homeHeroRotationDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type) =>
    Number(parts.find((part) => part.type === type)?.value);
  return Math.floor(
    Date.UTC(value("year"), value("month") - 1, value("day")) / 86_400_000,
  );
}

/** Rotate the full eligible stock, not only the manually prioritized cars. */
export function selectHomeHeroVehicles(vehicles, options = {}) {
  const seen = new Set();
  const pool = vehicles
    .filter(isHomeHeroCandidate)
    .filter((vehicle) => {
      const id = String(vehicle.id).trim();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((left, right) => {
      const difference = Number(right.id) - Number(left.id);
      if (difference) return difference;
      const a = String(left.id).trim();
      const b = String(right.id).trim();
      return a < b ? -1 : a > b ? 1 : 0;
    });
  if (!pool.length) return [];
  const day = Number.isInteger(options.day)
    ? options.day
    : homeHeroRotationDay();
  const stride = pool.length > HOME_HERO_LIMIT ? HOME_HERO_LIMIT : 1;
  const offset = (((day * stride) % pool.length) + pool.length) % pool.length;
  const ordered = [...pool.slice(offset), ...pool.slice(0, offset)];
  // Preserve the image already preloaded by PHP, but never keep a sold or
  // newly ineligible unit after the live inventory refresh.
  const preferredId = String(options.preferredId ?? "").trim();
  const preferred = ordered.find(
    (vehicle) => String(vehicle.id).trim() === preferredId,
  );
  return (
    preferred
      ? [preferred, ...ordered.filter((vehicle) => vehicle !== preferred)]
      : ordered
  ).slice(0, HOME_HERO_LIMIT);
}
