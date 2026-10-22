const PROFILE_FIELDS = ["minPrice", "maxPrice", "minYear", "maxYear", "count"];

// Templates preserve editorial wording, while commercial values are always
// derived from the same current selection used to render the vehicle cards.
export const LANDING_PROFILE_TOKENS = Object.fromEntries(
  PROFILE_FIELDS.map((field) => [field, `{{${field}}}`]),
);

export function resolveLandingParagraphs(landing, vehicles) {
  const fallback = landing.paragraphs;
  if (!Array.isArray(landing.paragraphTemplates) || !Array.isArray(vehicles)) {
    return fallback;
  }
  const available = vehicles.filter((vehicle) => {
    const price = Number(vehicle.price ?? vehicle.valor);
    return Number.isFinite(price) && price > 0;
  });
  if (!available.length) return fallback;

  const prices = available.map((vehicle) =>
    Number(vehicle.price ?? vehicle.valor),
  );
  const years = available.map((vehicle) => Number(vehicle.year ?? vehicle.ano));
  const formatPrice = (value) =>
    `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
  const completeYears = years.every(
    (year) => Number.isFinite(year) && year > 0,
  );
  const profile = {
    minPrice: formatPrice(Math.min(...prices)),
    maxPrice: formatPrice(Math.max(...prices)),
    minYear: completeYears ? Math.min(...years) : null,
    maxYear: completeYears ? Math.max(...years) : null,
    count: available.length,
  };
  let complete = true;
  const paragraphs = landing.paragraphTemplates.map((template) =>
    template.replace(/\{\{([^{}]+)\}\}/g, (_, field) => {
      if (!PROFILE_FIELDS.includes(field) || profile[field] === null) {
        complete = false;
        return "";
      }
      return String(profile[field]);
    }),
  );
  return complete ? paragraphs : fallback;
}

export function resolveLandingFaq(landing, vehicles) {
  if (!["marca", "categoria", "combustivel"].includes(landing.type))
    return landing.faq;
  if (
    Array.isArray(vehicles) &&
    vehicles.some((vehicle) => {
      const price = Number(vehicle.price ?? vehicle.valor);
      return Number.isFinite(price) && price > 0;
    })
  )
    return landing.faq;

  return landing.faq.map((item, index) =>
    index === 0
      ? {
          ...item,
          a: "Consulte o estoque atualizado nesta página ou fale com a equipe para confirmar a disponibilidade.",
        }
      : item,
  );
}
