/** Individually reviewed manufacturer sources approved on 2026-10-22.
 * Exact URLs and brands only: this does not approve a host, directory or unit.
 */
const reviewedSources: ReadonlyArray<readonly [string, string]> = [
  ["nissan", "https://brazil.nissannews.com/pt-BR/releases/novo-nissan-kicks-ative-sua-atitude"],
  ["peugeot", "https://www.media.stellantis.com/uploads/br/model-document/ft_peugeot_suv2008_my2223_v2-62bb19ce7a713.pdf"],
  ["peugeot", "https://www.media.stellantis.com/uploads/br/model-document/fichatecnicapeugeot2008my2425-695bcce52dbda.pdf"],
];

export function isReviewedEquipmentSource(url: URL, normalizedBrand: string): boolean {
  return reviewedSources.some(([brand, href]) => brand === normalizedBrand && href === url.href);
}
