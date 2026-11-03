export function saleReading(
  post: { slug?: string } | null | undefined,
  all: Array<{ slug: string; title: string }>,
  limit?: number,
): Array<{ href: string; title: string }> | null;

export function relatedReading(
  post: { slug?: string; title?: string } | null | undefined,
  all: Array<{ slug: string; title: string }>,
  limit?: number,
): Array<{ href: string; title: string }>;
