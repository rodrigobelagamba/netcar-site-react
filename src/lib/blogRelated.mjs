// O matcher por slug trata "quanto", "vale", "carro" e "usado" como palavra
// vazia. No post de avaliação sobra token fraco e o fallback cai em hatch,
// baixa km e serra. Estes cinco posts são o mesmo assunto: vender ou trocar.
const SALE_SLUGS = [
  "quanto-vale-meu-carro-usado",
  "onde-vender-carro-usado-regiao-porto-alegre",
  "vender-carro-financiado-como-funciona",
  "trocar-carro-financiado",
  "vender-carro-usado-ou-dar-na-troca",
];

const SALE_PILLAR = {
  href: "/compra",
  title: "Avaliar ou vender seu carro",
};

/** @returns {{ href: string, title: string }[] | null} */
export function saleReading(post, all, limit = 3) {
  if (!post || !SALE_SLUGS.includes(post.slug)) return null;
  const index = SALE_SLUGS.indexOf(post.slug);
  const siblings = [];
  for (
    let step = 1;
    siblings.length < limit - 1 && step < SALE_SLUGS.length;
    step++
  ) {
    const slug = SALE_SLUGS[(index + step) % SALE_SLUGS.length];
    const item = all.find((row) => row.slug === slug);
    if (item) siblings.push({ href: `/blog/${item.slug}`, title: item.title });
  }
  return [SALE_PILLAR, ...siblings].slice(0, limit);
}

// Assuntos editoriais reconhecidos no slug E no título. Sinônimos específicos
// aproximam artigos úteis; cidade, ano, "carro" e "comparar" não criam afinidade.
// Um assunto novo sem par reconhecido fica sem lista, nunca recebe os recentes.
const TOPIC_RULES = [
  /\b(?:financiar|financiamento|credito)\b/,
  /\b(?:verificar antes de comprar|coisas para verificar|baixa km|baixa quilometragem|poucos km|procedencia|fabrica de valor)\b/,
  /\b(?:distancia|compra remota)\b/,
  /\b(?:tabela fipe|quanto custa (?:um )?seminovo|seminovo ou zero|zero km|ate \d+ mil)\b/,
  /\b(?:urbana|urbano|para (?:a )?cidade|transito)\b/,
  /\bhatch\b/,
  /\b(?:sedan|familia|espaco|porta malas)\b/,
  /\b(?:viagem|viajar)\b/,
  /\b(?:custos alem da parcela|custa manter|custo de uso|custo de manutencao)\b/,
  /\b(?:cambio|automatico)\b/,
  /\b(?:hibrido|hibrida)\b/,
  /\b(?:picape|picapes)\b/,
  /\b(?:aplicativo|uber)\b/,
  /\b(?:transferencia|documentacao compra)\b/,
  /\bprimeiro carro\b/,
];

function postTopics(post) {
  const text = `${post.slug ?? ""} ${post.title ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return new Set(
    TOPIC_RULES.flatMap((rule, index) => (rule.test(text) ? [index] : [])),
  );
}

/** Mesmos destinos e mesma ordem no artigo React e no HTML dos buscadores. */
export function relatedReading(post, all, limit = 3) {
  const count = Number.isFinite(limit)
    ? Math.min(3, Math.max(0, Math.floor(limit)))
    : 3;
  if (!post?.slug || !count) return [];
  const sale = saleReading(post, all, count);
  if (sale) return sale;

  const topics = postTopics(post);
  if (!topics.size) return [];
  const seen = new Set([post.slug]);
  return all
    .filter((candidate) => {
      if (
        !candidate.slug ||
        seen.has(candidate.slug) ||
        SALE_SLUGS.includes(candidate.slug)
      )
        return false;
      seen.add(candidate.slug);
      return true;
    })
    .map((candidate) => ({
      post: candidate,
      score: [...postTopics(candidate)].filter((topic) => topics.has(topic))
        .length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || (a.post.slug < b.post.slug ? -1 : 1))
    .slice(0, count)
    .map(({ post: candidate }) => ({
      href: `/blog/${candidate.slug}`,
      title: candidate.title,
    }));
}
