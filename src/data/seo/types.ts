// Carro real do estoque embutido numa matéria (propaganda do estoque).
export interface BlogCar {
  modelo: string;
  ano: string;
  km: string;
  preco: string;
  cambio?: string;
  combustivel?: string;
  destaque?: string;
  url: string;
  img?: string;
}

export interface BlogSection {
  type: "p" | "h2" | "ul" | "ol" | "cars";
  text?: string;
  items?: string[];
  cars?: BlogCar[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  // Data em que o texto mudou de fato. O gerador automático reescreve os posts
  // a cada rodada para refletir o estoque, então sem este campo dateModified
  // repetiria publishedAt e o site nunca informaria a atualização.
  updatedAt?: string;
  readMinutes: number;
  sections: BlogSection[];
  ctaLabel: string;
  ctaHref: string;
}

export interface CityFaq {
  q: string;
  a: string;
}

export interface CityRouteOrigin {
  /** Identificador estável usado também na medição de clique da rota. */
  id: string;
  label: string;
  /** Origem textual enviada ao Google Maps; não representa localização exata. */
  query: string;
}

export interface CitySellSeo {
  title: string;
  description: string;
  h1: string;
  intro: string;
  paragraphs: string[];
  faq: CityFaq[];
}

export interface CitySeoPage {
  slug: string;
  name: string;
  regionName: string;
  distanceKm: number;
  travelTime: string;
  routeNote: string;
  /** Pontos públicos de referência para uma rota útil, sem geolocalização do usuário. */
  routeOrigins?: CityRouteOrigin[];
  visitPlanning: string;
  /** Cidades geograficamente relacionadas. Evita malha regional all-to-all. */
  relatedSlugs: string[];
  /** Mercados próximos que podem receber um link curto no rodapé global. */
  priorityMarket?: boolean;
  title: string;
  description: string;
  h1: string;
  /** H2 editorial específico da cidade; evita landings regionais genéricas. */
  contentHeading?: string;
  intro: string;
  paragraphs: string[];
  faq: CityFaq[];
  sell: CitySellSeo;
}

// Página de conteúdo SEO institucional (financiamento, atendimento, etc.)
// Data-driven: copy fica em content-pages.json, renderizada por ContentSeoPage.
export interface ContentSeoPage {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  waText: string;
  ctaLabel: string;
  secondLabel: string;
  secondHref: string;
  sections: BlogSection[];
  faq: CityFaq[];
}

// Landing de marca/categoria gerada automaticamente a partir do estoque real
// (scripts/generate-landings.js). filterKey/filterValue alimentam a busca
// de veículos na página, garantindo conteúdo único (o estoque de verdade).
export interface LandingSeoFilters {
  marca?: string;
  /** Busca parcial no nome do modelo (ex.: "HRV" encontra todas as versões). */
  modelo?: string;
  categoria?: string;
  cambio?: string;
  combustivel?: string;
  precoMin?: number;
  precoMax?: number;
}

export interface LandingSeoPage {
  slug: string;
  type: "marca" | "categoria" | "modelo" | "faixa" | "combustivel";
  name: string;
  count: number;
  /** Página sem oferta real permanece útil, mas fica fora do índice. */
  indexable: boolean;
  /** Seleção curta para o rodapé global. */
  footerPriority: boolean;
  filters: LandingSeoFilters;
  /** Malha curta e editorial; evita ligar todas as landings entre si. */
  relatedSlugs: string[];
  title: string;
  description: string;
  h1: string;
  intro: string;
  paragraphs: string[];
  faq: CityFaq[];
}
