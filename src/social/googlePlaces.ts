/** Public Google Business profiles used by both the home and vehicle pages. */
export const GOOGLE_REVIEW_STORES = [
  {
    id: "loja1",
    name: "Netcar Multimarcas",
    address: "Av. Presidente Vargas, 740",
    url: "https://maps.google.com/maps?cid=9144067949621682127",
    // Obtido no painel GBP autenticado da unidade nº 740 em 13/11/2026.
    writeReviewUrl: "https://g.page/r/Cc8fPFNaQeZ-EBM/review",
  },
  {
    id: "loja2",
    name: "Filial",
    address: "Av. Presidente Vargas, 1106",
    url: "https://maps.google.com/maps?cid=10839197980729051544",
    // Obtido no painel GBP autenticado da filial em 13/11/2026.
    writeReviewUrl: "https://g.page/r/CZiJfIsikWyWEBM/review",
  },
] as const;


/** Novas ações comerciais e pedidos de avaliação usam o perfil principal (13/11/2026). */
export const GOOGLE_PRIMARY_PROFILE = GOOGLE_REVIEW_STORES[0];
