export const emptySeminovosSearch = {
  marca: undefined,
  modelo: undefined,
  precoMin: undefined,
  precoMax: undefined,
  anoMin: undefined,
  anoMax: undefined,
  cambio: undefined,
  cor: undefined,
  categoria: undefined,
} as const;

export const automaticSeminovosSearch = {
  ...emptySeminovosSearch,
  cambio: "Automatico" as const,
};
