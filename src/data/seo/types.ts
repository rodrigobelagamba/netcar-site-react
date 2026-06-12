export interface BlogSection {
  type: "p" | "h2" | "ul" | "ol";
  text?: string;
  items?: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readMinutes: number;
  sections: BlogSection[];
  ctaLabel: string;
  ctaHref: string;
}

export interface CityFaq {
  q: string;
  a: string;
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
  distanceKm: number;
  travelTime: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  paragraphs: string[];
  faq: CityFaq[];
  sell: CitySellSeo;
}
