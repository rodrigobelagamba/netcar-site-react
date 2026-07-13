/**
 * Formatos editoriais do blog auto — inspirados em blogs automotivos (guia passo a
 * passo, ranking, mitos, FAQ, comparativo, perfil, jornada). Cada formato monta
 * título, descrição e sections de forma distinta; carros do estoque entram em
 * posições diferentes conforme o formato.
 */

const H2 = (text) => ({ type: "h2", text });
const P = (text) => ({ type: "p", text });
const UL = (items) => ({ type: "ul", items });
const OL = (items) => ({ type: "ol", items });
const CARS = (cars) => ({ type: "cars", cars });

export const FORMAT_IDS = [
  "guia",
  "mitos",
  "erros",
  "ranking",
  "faq",
  "comparativo",
  "perfil",
  "jornada",
];

const URGENCIA = [
  "Estoque rotativo: se algum exemplar chamou atenção, confirme disponibilidade antes de montar a visita.",
  "Carro bem preparado e bem precificado gira rápido. Quando achar o encaixe certo, vale reservar o test drive.",
];

const AUTORIDADE_LINES = [
  "Na Netcar, cada seminovo passa pela Fábrica de Valor — mais de 60 itens conferidos, laudo e revisão antes da vitrine.",
  "Desde 1997 em Esteio, a Netcar prepara seminovos com processo próprio (Fábrica de Valor) antes de ir pra vitrine.",
];

const SOFT_SELL_CLOSE = [
  "Monte a shortlist no estoque, escolha duas ou três fichas e fale com o consultor pra agendar a visita.",
  "Quando a lista estiver curta, o próximo passo é simples: abrir o estoque e confirmar disponibilidade.",
  "Com o perfil alinhado, vale olhar as opções reais no pátio e marcar test drive sem pressa.",
  "Filtre no site, compare os exemplares e chame no WhatsApp só com a shortlist na mão.",
];

const VISIT_TIPS = [
  "No test drive, varie rua e velocidade: partida a frio, retomada e freio em descida.",
  "Na visita, confira histórico de revisão, estado de pneus e se a documentação fecha com a ficha.",
  "Leve a shortlist impressa ou no celular — facilita comparar versão, km e equipamentos lado a lado.",
  "Pergunte sobre preparação e laudo do exemplar. Carro revisado encurta a decisão.",
];

const PRAISE_BY_KIND = {
  marca: (label) =>
    `${label} costuma agradar quem busca peça acessível, revenda previsível e opções claras de versão no mercado regional.`,
  categoria: (label) =>
    `${label} seminovo acerta quando o uso diário pede esse porte — conforto certo sem pagar o que você não vai usar.`,
  modelo: (label) =>
    `${label} entra fácil na shortlist: demanda regional boa, peças conhecidas e perfil que funciona no dia a dia do RS.`,
  faixa: (label) =>
    `Nessa faixa até ${label}, dá pra montar um pacote equilibrado: carro preparado, custo previsível e margem pra seguro e manutenção.`,
  uso: () =>
    "Quando o uso está claro, o carro certo aparece mais rápido — e a visita rende em vez de virar passeio sem fim.",
  regional: (region) =>
    `Quem pesquisa em ${region} ganha tempo filtrando estoque real em Esteio e chegando com shortlist — menos deslocamento à toa.`,
  hibrido: () =>
    "Híbrido seminovo faz sentido pra quem roda muito em cidade: resposta suave, consumo mais eficiente no trânsito e tecnologia que valoriza o pacote.",
};

function makePick(hashStr) {
  return (arr, seed) => arr[hashStr(seed) % arr.length];
}

/** Hash FNV-1a local (quando o gerador não passa hashStr). */
function defaultHashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function carsBlock(cars, h2, lead) {
  if (!cars.length) return [];
  const out = [H2(h2)];
  if (lead) out.push(P(lead));
  out.push(CARS(cars));
  return out;
}

/** Autoridade no máx. 1x e só em metade dos posts (anti-spam). */
function maybeAutoridade(slug, hashStr) {
  if (hashStr(slug + ":auth") % 2 !== 0) return [];
  const pick = makePick(hashStr);
  return [P(pick(AUTORIDADE_LINES, slug + "auth"))];
}

/**
 * Bloco financeiro só em formatos de compra que pedem conta
 * (evita o mesmo checklist em todo post).
 */
function maybeFinanceBlock(slug, hashStr, allowed) {
  if (!allowed) return [];
  if (hashStr(slug + ":fin") % 3 !== 0) return [];
  const pick = makePick(hashStr);
  const lead = pick(
    [
      "Vai financiar? Simule pelo WhatsApp e chegue sabendo a parcela:",
      "Pra fechar a conta antes de ir à loja:",
    ],
    slug + "fin"
  );
  return [
    H2("Financiamento: como fica na prática"),
    P(lead),
    UL([
      "Parcelas em 24x, 36x, 48x ou 60x",
      "Primeira parcela para 60 dias",
      "Entrada de 20% a 30%, parcelável em até 10x sem juros",
      "Cartão de crédito em até 24x",
      "Usado na troca como parte do pagamento",
    ]),
    P("Mediante análise de crédito."),
  ];
}

function softClose(slug, hashStr, extra) {
  const pick = makePick(hashStr);
  const base = pick(SOFT_SELL_CLOSE, slug + "close");
  return P(extra ? `${extra} ${base}` : base);
}

function visitTip(slug, hashStr) {
  const pick = makePick(hashStr);
  return P(pick(VISIT_TIPS, slug + "visit"));
}

function praise(kind, label, slug, hashStr) {
  const fn = PRAISE_BY_KIND[kind] || PRAISE_BY_KIND.uso;
  const line = typeof fn === "function" ? fn(label) : fn;
  return P(line);
}

/** Contexto comum a todos os formatos */
function baseCtx(raw) {
  return {
    slug: raw.slug,
    label: raw.label, // "Fiat", "SUV", "seminovo"
    kind: raw.kind, // marca | categoria | geral
    cars: raw.cars || [],
    stock: raw.stock,
    ctaHref: raw.ctaHref,
    ctaLabel: raw.ctaLabel,
    year: raw.year,
    brl: raw.brl,
    hashStr: raw.hashStr,
    pick: makePick(raw.hashStr),
  };
}

// ---- Marca / categoria: 8 formatos distintos ----

function formatGuia(ctx) {
  const { label, kind, slug, cars, stock, brl, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  const praiseKind = kind === "categoria" ? "categoria" : "marca";
  return {
    title: p(
      [
        `Guia completo: como escolher ${ll} seminovo em Esteio (${ctx.year})`,
        `${label} usado: passo a passo antes de fechar negócio`,
      ],
      slug + "t"
    ),
    description: `Do perfil de uso ao test drive: como escolher ${ll} seminovo com critério — e ver opções reais no estoque Netcar em Esteio.`,
    readMinutes: 7,
    sections: [
      P(
        p(
          [
            `Comprar ${ll} seminovo rende mais quando o perfil de uso vem antes do anúncio. Este roteiro é o que a gente usa na loja pra orientar cliente em Esteio e na Grande POA.`,
            `Se ${label} está na sua lista, siga a ordem: uso → faixa → procedência → visita. Assim a shortlist fica objetiva.`,
          ],
          slug + "i"
        )
      ),
      H2("Passo 1 — Defina o que você precisa de verdade"),
      UL([
        "Uso diário: cidade, estrada ou misto?",
        "Quanto pode comprometer por mês (carro + seguro + combustível)?",
        "Precisa de porta-malas grande, cadeirinha, ou só você no volante?",
      ]),
      H2("Passo 2 — Entenda a faixa de preço real"),
      P(
        `Hoje, seminovos na Netcar vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. ${label} costuma aparecer em faixas intermediárias — o exemplar certo equilibra ano, km e versão.`
      ),
      praise(praiseKind, label, slug, hashStr),
      H2("Passo 3 — Documentação e procedência"),
      UL([
        "CRLV e dados do vendedor batendo",
        "Sem restrição ou pendência na transferência",
        "Histórico de donos coerente com a km",
      ]),
      ...carsBlock(
        cars,
        "Passo 4 — Veja exemplos reais no estoque",
        `Estes ${label} já passaram pela nossa conferência. Clique pra ficha completa:`
      ),
      H2("Passo 5 — Test drive com olho clínico"),
      OL([
        "Partida a frio: motor liso, sem fumaça",
        "Retomada em subida e frenagem em descida",
        "Ruídos em buracos e curvas fechadas",
        "Painel, ar, vidros e central multimídia",
      ]),
      visitTip(slug, hashStr),
      ...maybeAutoridade(slug, hashStr),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Resumo"),
      softClose(
        slug,
        hashStr,
        `Bom ${ll} seminovo = procedência + revisão + preço coerente.`
      ),
    ],
  };
}

function formatMitos(ctx) {
  const { label, kind, slug, cars, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  const praiseKind = kind === "categoria" ? "categoria" : "marca";
  return {
    title: `${label} seminovo: 5 mitos que fazem você errar na compra`,
    description: `Verdade ou mito sobre ${ll} usado? Clareza pra decidir melhor em Esteio — com ${label} reais no estoque Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Tem conversa repetida na hora de comprar ${ll} usado — e muito mito atrasa uma boa escolha. Separamos papo de bar de fato útil, com olhar de quem vê carro passar todo dia na loja.`
      ),
      H2('Mito 1: "Quanto mais barato, melhor o negócio"'),
      P(
        "Preço baixo sem laudo e sem histórico é loteria. Economia na compra pode virar oficina depois. O custo total inclui procedência, revisão e revenda futura."
      ),
      H2('Mito 2: "Se está bonito por fora, está tudo certo"'),
      P(
        "Acabamento impecável ajuda, mas não substitui inspeção. Por isso preparação técnica e test drive pesam mais que brilho na vitrine."
      ),
      H2('Mito 3: "Todo usado é igual — só muda o ano"'),
      P(
        `Dois ${label} do mesmo ano podem ter históricos diferentes: um com revisão em dia, outro com uso mais intenso. O exemplar importa tanto quanto o modelo.`
      ),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        "Na prática: estes exemplares no nosso pátio",
        `Sem achismo — estes ${label} estão com ficha e fotos reais:`
      ),
      H2('Mito 4: "Financiar seminovo sempre sai caro demais"'),
      P(
        "Depende do prazo, da entrada e do perfil. Simular antes evita surpresa — e parcela bem montada cabe no orçamento sem sufocar."
      ),
      H2('Mito 5: "Particular sempre sai mais barato que loja"'),
      P(
        "Particular pode parecer mais barato na etiqueta. Revenda preparada entrega processo, documentação e caminho de financiamento/troca no mesmo lugar — muitas vezes o custo-benefício final equilibra."
      ),
      ...maybeAutoridade(slug, hashStr),
      H2("Conclusão"),
      softClose(
        slug,
        hashStr,
        `Comprar ${ll} seminovo com critério é olhar laudo, km, donos e test drive.`
      ),
    ],
  };
}

function formatErros(ctx) {
  const { label, slug, cars, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `7 erros ao comprar ${ll} usado (e como evitar cada um)`,
    description: `Erros clássicos na compra de ${ll} seminovo — e o que fazer em vez disso. Com destaques do estoque Netcar em Esteio.`,
    readMinutes: 7,
    sections: [
      P(
        `A gente vê comprador chegar na loja depois de quase fechar no impulso um ${ll}. Estes são os deslizes mais comuns — e o antídoto de cada um.`
      ),
      H2("Erro 1 — Comprar no impulso pelo anúncio"),
      P("Foto bonita não paga IPVA. Visite, peça ficha e laudo. Carro bom aguenta pergunta."),
      H2("Erro 2 — Ignorar a quilometragem versus idade"),
      P("50 mil km em 3 anos é história diferente de 50 mil em 8. Cruze km, ano e tipo de uso."),
      H2("Erro 3 — Não fazer test drive longo o suficiente"),
      P("Cinco minutos no quarteirão não revela câmbio cansado nem freio vibrando. Rode 15–20 min em ruas variadas."),
      H2("Erro 4 — Fechar sem simular financiamento"),
      P("Parcela surpresa mata o sonho. Simule com renda real antes de emocionar."),
      ...carsBlock(
        cars,
        "Em vez de errar: comece por estes modelos conferidos",
        `Estes ${label} já passaram pelo nosso processo — mais clareza na shortlist:`
      ),
      H2("Erro 5 — Esquecer custo de manutenção"),
      P("IPVA, seguro, pneu, revisão: some tudo. O carro certo é o que cabe no mês inteiro, não só na entrada."),
      H2("Erro 6 — Não verificar documentação"),
      P("Restrição, multa, dados divergentes: cada um atrasa a transferência. Confira antes de fechar."),
      H2("Erro 7 — Comparar só preço, não valor"),
      P("Valor = preço + procedência + preparação + pós-venda. Por isso revenda preparada existe."),
      ...maybeAutoridade(slug, hashStr),
      H2("Próximo passo"),
      softClose(slug, hashStr, `Evitou os erros?`),
    ],
  };
}

function formatRanking(ctx) {
  const { label, kind, slug, cars, stock, brl, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  const n = cars.length;
  const praiseKind = kind === "categoria" ? "categoria" : "marca";
  return {
    title: p(
      [
        `${n > 0 ? n + " " : ""}${label} seminovos que se destacam no estoque agora (${ctx.year})`,
        `Curadoria: ${ll} seminovos em Esteio que valem test drive`,
      ],
      slug + "t"
    ),
    description: `Seleção editorial de ${label} no estoque real da Netcar: critérios, faixas de preço e modelos que encaixam bem na visita em Esteio.`,
    readMinutes: 6,
    sections: [
      P(
        `Isto não é nota inventada — é curadoria de pátio. Olhamos procedência, km, preparação, preço versus mercado e procura na região. Estes ${label} se destacaram esta semana.`
      ),
      H2("Como escolhemos os destaques"),
      UL([
        "Passou pela Fábrica de Valor (60+ itens)",
        "Quilometragem coerente com o ano",
        "Preço alinhado ao mercado regional",
        "Encaixe real com o que o cliente da região busca",
      ]),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        `Os ${label} em destaque agora`,
        n
          ? `${n} ${label} selecionados abaixo — clique pra ver fotos, ficha e disponibilidade:`
          : `Confira os ${label} disponíveis no estoque:`
      ),
      P(p(URGENCIA, slug + "u")),
      H2("Faixa de preço de referência"),
      P(
        `Seminovos na Netcar hoje: ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Seu ${ll} ideal provavelmente está no meio dessa faixa — dependendo de ano e versão.`
      ),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Quer ver mais opções?"),
      softClose(
        slug,
        hashStr,
        `A curadoria muda conforme entra carro novo no pátio.`
      ),
    ],
  };
}

function formatFaq(ctx) {
  const { label, slug, cars, stock, brl, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `${label} seminovo: perguntas que todo mundo faz (com resposta direta)`,
    description: `Dúvidas frequentes sobre ${ll} usado em Esteio: preço, financiamento, troca — e onde ver ${label} no estoque Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Reunimos as perguntas que mais aparecem no WhatsApp e na loja sobre ${ll} seminovo. Resposta curta — e no final, exemplos reais do estoque.`
      ),
      H2(`Quanto custa um ${ll} seminovo em ${ctx.year}?`),
      P(
        `Depende de ano, versão e km. No estoque geral da Netcar, seminovos vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Veja a ficha de cada ${label} pra preço exato.`
      ),
      H2(`Como escolher um bom ${ll} usado?`),
      P(
        "Foque no exemplar: histórico de revisão, laudo, km coerente e test drive. Revenda preparada encurta essa conferência."
      ),
      H2("Vale financiar ou pagar à vista?"),
      P(
        "À vista dá margem na negociação; financiamento preserva caixa. Com entrada de 20–30% parcelável e 1ª parcela em 60 dias, muita gente equilibra as duas coisas."
      ),
      H2("Posso dar meu carro na troca?"),
      P(
        "Sim — inclusive financiado. Avaliamos seu usado e o valor entra na negociação do seminovo escolhido."
      ),
      H2("Como sei se ainda está disponível?"),
      P(
        "Estoque muda com frequência. O jeito mais rápido: abrir a ficha abaixo ou chamar no WhatsApp com o nome do carro."
      ),
      ...carsBlock(cars, `${label} no estoque — confira`, null),
      ...maybeAutoridade(slug, hashStr),
      H2("Onde fica a Netcar?"),
      P("Esteio/RS, Av. Presidente Vargas — duas lojas. Agende visita e test drive."),
      softClose(slug, hashStr),
    ],
  };
}

function formatComparativo(ctx) {
  const { label, slug, cars, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Comprar ${ll} de particular ou na loja? Comparativo honesto`,
    description: `Particular x revenda na hora de comprar ${ll} seminovo: quando cada caminho faz sentido. Veja ${label} revisados na Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Na dúvida entre anúncio de particular e seminovo de loja, a decisão não é só preço — é tempo, processo e o que vem depois. Comparativo direto aplicado a ${label}.`
      ),
      H2("Particular: quando pode valer"),
      UL([
        "Conhece o dono e o histórico de verdade",
        "Disposto a organizar revisão por conta própria",
        "Tem mecânico de confiança pra inspecionar antes",
      ]),
      H2("Particular: o que exige mais de você"),
      UL([
        "Conferência de laudo e documentação por conta",
        "Burocracia e prazo na transferência",
        "Negociação e test drive sem estrutura de loja",
      ]),
      H2("Revenda preparada: o que muda"),
      UL([
        "Inspeção antes da vitrine (na Netcar: Fábrica de Valor, 60+ itens)",
        "Documentação conferida",
        "Financiamento, troca e simulação no mesmo lugar",
        "Respaldo pós-venda",
      ]),
      ...carsBlock(
        cars,
        `${label} revisados na Netcar — veja lado a lado`,
        `Compare estes exemplares já preparados — ficha, foto e preço real:`
      ),
      H2("Conta final: não é só o valor do carro"),
      P(
        "Some tempo, conferência técnica e caminho de financiamento/troca. Muitas vezes loja fica competitiva quando você coloca tudo na planilha."
      ),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Veredito"),
      softClose(
        slug,
        hashStr,
        p(
          [
            `Se quer tranquilidade na compra de ${ll}, revenda preparada encurta o caminho.`,
            `Particular exige mais expertise; loja entrega processo. Para ${label}, o estoque ajuda a decidir com calma.`,
          ],
          slug + "v"
        )
      ),
    ],
  };
}

function formatPerfil(ctx) {
  const { label, kind, slug, cars, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  const praiseKind = kind === "categoria" ? "categoria" : "marca";
  return {
    title: p(
      [
        `Qual ${ll} seminovo combina com você? Guia por perfil`,
        `${label} usado: qual versão faz sentido pro seu dia a dia`,
      ],
      slug + "t"
    ),
    description: `Perfil urbano, família ou estrada: qual ${ll} seminovo escolher em Esteio. Exemplos reais do estoque Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Não existe ${ll} "melhor do mundo" — existe o melhor pro seu uso. Agrupamos cenários reais de quem compra na região e o que observar em cada um.`
      ),
      H2("Perfil 1 — Só cidade, poucos km por dia"),
      P(
        "Priorize consumo, manutenção acessível e facilidade de estacionar. Versões compactas e automáticas aliviam o trânsito da Grande POA."
      ),
      H2("Perfil 2 — Família com criança ou bagagem"),
      P(
        "Porta-malas, espaço traseiro e segurança (airbag, ISOFIX) pesam mais que potência. Confira estado de bancos e fixação."
      ),
      H2("Perfil 3 — Estrada e viagem frequente"),
      P(
        "Estabilidade, conforto em velocidade de estrada e motor folgado na subida. Veja pneus, freio e ruído de rodagem no test drive longo."
      ),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        `${label} que atendem esses perfis — no estoque`,
        `Estes modelos aparecem bastante pra quem se encaixa nos perfis acima:`
      ),
      H2("Automático ou manual pro seu caso?"),
      P(
        "Cidade pura → automático costuma agradar. Orçamento mais enxuto → manual de entrada. Estrada mista → depende do gosto e do bolso."
      ),
      visitTip(slug, hashStr),
      ...maybeAutoridade(slug, hashStr),
      H2("Encontrou seu perfil?"),
      softClose(
        slug,
        hashStr,
        `Cruze perfil, orçamento e estoque com o consultor.`
      ),
    ],
  };
}

function formatJornada(ctx) {
  const { label, slug, cars, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Da pesquisa ao volante: jornada de quem compra ${ll} seminovo`,
    description: `Cronograma real de compra de ${ll} usado — pesquisa, visita, test drive, financiamento e retirada. Com ${label} do estoque Netcar.`,
    readMinutes: 7,
    sections: [
      P(
        `Comprar ${ll} seminovo não precisa ser corrida — mas ter ordem ajuda. Esta é a jornada que orientamos na Netcar, do primeiro Google ao carro na garagem.`
      ),
      H2("Semana 1 — Pesquisa e orçamento"),
      OL([
        "Defina teto de parcela ou valor total",
        "Liste 2–3 modelos/versões que atendem sua rotina",
        "Compare preços no estoque real (não só tabela genérica)",
      ]),
      H2("Semana 2 — Contato e pré-seleção"),
      OL([
        "Peça ficha, fotos e histórico dos favoritos",
        "Simule financiamento pelo WhatsApp",
        "Separe 2–3 carros pra visitar num dia só",
      ]),
      ...carsBlock(
        cars,
        "Exemplos pra começar sua shortlist",
        `Estes ${label} estão no estoque e costumam entrar na shortlist:`
      ),
      H2("Semana 3 — Visita e test drive"),
      P(
        "Reserve 30–40 min por carro. Leve documento, faça percurso variado e pergunte sobre revisão e laudo."
      ),
      visitTip(slug, hashStr),
      H2("Semana 4 — Fechamento"),
      OL([
        "Confirme documentação e condições da proposta",
        "Assine financiamento ou pagamento",
        "Agende retirada e primeiros cuidados pós-compra",
      ]),
      ...maybeAutoridade(slug, hashStr),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Pronto pra começar?"),
      softClose(
        slug,
        hashStr,
        `Dá pra encurtar essa jornada em uma visita bem planejada.`
      ),
    ],
  };
}

const SUBJECT_FORMATS = {
  guia: formatGuia,
  mitos: formatMitos,
  erros: formatErros,
  ranking: formatRanking,
  faq: formatFaq,
  comparativo: formatComparativo,
  perfil: formatPerfil,
  jornada: formatJornada,
};

/** Escolhe formato estável pelo slug (não muda entre rodadas). */
export function formatIdForSlug(slug, hashStr) {
  return FORMAT_IDS[hashStr(slug + ":fmt") % FORMAT_IDS.length];
}

/** Monta artigo completo para marca ou categoria. */
export function buildSubjectArticle(raw) {
  const ctx = baseCtx(raw);
  const fmt = raw.formatId || formatIdForSlug(raw.slug, raw.hashStr);
  const builder = SUBJECT_FORMATS[fmt] || formatGuia;
  const body = builder(ctx);
  return {
    slug: raw.slug,
    ...body,
    ctaLabel: raw.ctaLabel,
    ctaHref: raw.ctaHref,
  };
}

// ---- Temas dedicados (formato fixo, estrutura própria) ----

/**
 * Formato regional agrupado. Uma matéria cobre cidades com a mesma intenção e
 * entrega roteiro próprio; evita clonar uma página para cada município.
 * Cards sempre chegam do estoque consultado pelo gerador.
 */
export function buildRegionalStockArticle({
  slug,
  region,
  cities,
  angle,
  cars,
  ctaHref,
  ctaLabel,
}) {
  const cityList = cities.join(", ");
  const isRemote = angle === "remoto";
  return {
    slug,
    title: isRemote
      ? `Comprar seminovo à distância: roteiro para ${region}`
      : `Seminovos em ${region}: estoque e procedência`,
    description: isRemote
      ? `Como filtrar estoque, conferir procedência e organizar a visita saindo de ${cityList}.`
      : `Como comparar estoque real e procedência ao buscar seminovo em ${cityList}.`,
    readMinutes: 7,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        isRemote
          ? `Quem está em ${cityList} pode adiantar a pesquisa sem tentar fechar tudo por mensagem. O objetivo do contato remoto é comparar veículos reais, registrar dúvidas e chegar à visita com uma lista curta.`
          : `Buscar seminovo em ${region} exige comparar exemplares, não repetir a mesma busca para cada cidade. Este roteiro serve para quem está em ${cityList} e quer separar estoque real de anúncio genérico.`
      ),
      H2("Comece no estoque oficial"),
      UL([
        "Defina uso, orçamento total e itens obrigatórios",
        "Separe dois ou três veículos que resolvam a mesma necessidade",
        "Compare versão, ano, quilometragem e equipamentos",
        "Confirme disponibilidade perto da visita",
      ]),
      ...carsBlock(
        cars,
        "Exemplos do estoque consultado agora",
        "Dados abaixo vêm do estoque oficial no momento da geração. Abra a ficha e confirme disponibilidade:"
      ),
      H2("Confiança precisa de evidência"),
      UL([
        "Empresa, endereço e canais oficiais identificáveis",
        "Documentação e histórico disponível explicados sem promessa vaga",
        "Processo de preparação que o consultor consiga detalhar",
        "Test drive e proposta completa antes da decisão",
      ]),
      H2(isRemote ? "O que adiantar antes do deslocamento" : "Como montar uma comparação útil"),
      OL(
        isRemote
          ? [
              "Envie as URLs dos veículos escolhidos no site",
              "Peça confirmação dos dados e documentos necessários",
              "Se houver troca, informe modelo, ano, km e financiamento em aberto",
              "Agende a visita para validar carro, test drive e proposta",
            ]
          : [
              "Registre os dados comprováveis de cada exemplar",
              "Liste dúvidas de documentação, preparação e pós-venda",
              "Faça test drive dos finalistas no mesmo dia quando possível",
              "Compare condição total registrada na proposta",
            ]
      ),
      H2("O que não fechar só por mensagem"),
      P(
        "Foto e vídeo ajudam na triagem, mas não substituem inspeção, test drive e leitura da proposta. Simulação não é aprovação; avaliação por fotos não é valor final."
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Próximo passo"),
      P(
        angle === "remoto"
          ? "Quem vem de fora ganha tempo chegando em Esteio com shortlist. Veja o estoque, escolha os candidatos e organize a visita."
          : "Veja o estoque atualizado no site, escolha os candidatos e só então organize o contato e a visita."
      ),
    ],
  };
}

export function buildPrecosArticle({ slug, cars, stock, brl, ctaHref, ctaLabel, hashStr = defaultHashStr }) {
  return {
    slug,
    title: `Quanto custa um seminovo em Esteio em ${stock.year || new Date().getFullYear()}? Guia de preços reais`,
    description:
      "Faixas de preço por perfil de comprador, o que inclui o valor e exemplos do estoque Netcar — sem tabela genérica.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Pergunta clássica: quanto custa um seminovo? Resposta honesta não cabe num número único — cabe em faixas, perfil de uso e estado do exemplar. Vamos por partes."
      ),
      H2("Três faixas que aparecem no pátio"),
      UL([
        `Entrada (primeiro carro, uso urbano): a partir de ${brl(stock.minPrice)}`,
        "Intermediário (melhor custo-benefício): faixa central do estoque",
        `Premium (SUV, pickup, seminovo recente): até ${brl(stock.maxPrice)}`,
      ]),
      H2("O que entra no preço além do adesivo"),
      UL([
        "Ano, km e versão",
        "Histórico de manutenção e número de donos",
        "Preparação e itens revisados antes da venda",
        "Demanda na região (modelo que sai rápido vs. encalhado)",
      ]),
      ...carsBlock(cars, "Exemplos reais em cada faixa", "Três seminovos do estoque atual — clique pra ver qual faixa cada um representa:"),
      H2("Como não pagar a mais"),
      OL([
        "Simule financiamento antes da visita",
        "Compare exemplares similares (ano/km)",
        "Peça laudo e histórico",
        "Desconfie de outlier muito barato",
      ]),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Próximo passo"),
      P("Preços mudam conforme entra carro novo. Veja o estoque atualizado e fale com consultor."),
    ],
  };
}

export function buildChecklistArticle({ slug, cars, ctaHref, ctaLabel, hashStr = defaultHashStr }) {
  return {
    slug,
    title: "Checklist definitivo antes de comprar seminovo (imprima e leve)",
    description:
      "Lista completa: documentação, mecânica, estrutura, elétrica e test drive. Guia pilar Netcar, Esteio/RS.",
    readMinutes: 8,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Use este checklist na visita — de particular ou loja. Cada item marcado reduz chance de levar problema pra casa."
      ),
      H2("Bloco A — Documentação"),
      OL([
        "CRLV em dia e coerente com o vendedor",
        "Consulta de restrição, multa e sinistro",
        "Chassi e motor batendo com documento",
        "Número de proprietários faz sentido?",
      ]),
      H2("Bloco B — Exterior e estrutura"),
      OL([
        "Pintura uniforme, sem onda ou remendos",
        "Vidros com marca original",
        "Pneus com desgaste parecido nos quatro",
        "Faróis e lanternas íntegros",
      ]),
      H2("Bloco C — Mecânica"),
      OL([
        "Vazamento embaixo do motor",
        "Ruído em marcha lenta e retomada",
        "Câmbio suave (auto ou manual)",
        "Freio reto, sem vibração",
      ]),
      H2("Bloco D — Interior e elétrica"),
      OL([
        "Ar condicionado gelando",
        "Vidros, travas, central",
        "Airbag sem luz de alerta acesa",
        "Odômetro coerente com desgaste",
      ]),
      H2("Bloco E — Test drive"),
      OL([
        "Mínimo 15 minutos, ruas e lombadas",
        "Subida, descida e frenagem forte",
        "Ruído de suspensão em curva",
      ]),
      ...carsBlock(
        cars,
        "Quer pular metade do checklist?",
        "Estes seminovos já passaram pela Fábrica de Valor — inspeção feita antes de chegar na vitrine:"
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Salvou o checklist?"),
      P("Leve na visita. Ou comece por estoque já revisado na Netcar."),
    ],
  };
}

export function buildTrocaArticle({ slug, ctaHref, ctaLabel }) {
  return {
    slug,
    title: "Vender sozinho ou dar na troca? Tabela comparativa",
    description:
      "Lado a lado: quanto você recebe, tempo gasto, risco e burocracia em cada caminho. Avalie seu usado na Netcar.",
    readMinutes: 5,
    ctaLabel,
    ctaHref,
    sections: [
      P("Duas estradas, dois custos escondidos. Tabela mental pra decidir sem ilusão."),
      H2("Venda particular"),
      UL([
        "Potencial: preço um pouco acima em anúncio bem feito",
        "Custo de tempo: fotos, respostas, visitas, transferência",
        "Risco: golpe, pagamento, carro parado na rua",
        "Prazo: imprevisível (semanas ou meses)",
      ]),
      H2("Troca na revenda"),
      UL([
        "Potencial: valor justo de mercado na hora",
        "Custo de tempo: uma visita, uma negociação",
        "Risco: baixo — processo conduzido pela loja",
        "Prazo: mesmo dia em muitos casos",
      ]),
      H2("Financiado? Troca ainda funciona"),
      P("Calculamos quitação do saldo; valor líquido entra no seminovo novo. Uma negociação, zero exposição."),
      H2("Quando cada um ganha"),
      P(
        "Particular: sobra tempo, tem paciência e mecânico de confiança. Troca: quer resolver rápido, já escolheu o próximo carro ou valoriza segurança."
      ),
      H2("Próximo passo"),
      P("Traga seu usado pra avaliação sem compromisso — saiba quanto entra na troca hoje."),
    ],
  };
}

export function buildAutomaticoArticle({ slug, cars, ctaHref, ctaLabel, hashStr = defaultHashStr }) {
  return {
    slug,
    title: "Automático ou manual no seminovo? Comparativo técnico",
    description:
      "Consumo, manutenção, revenda e conforto — lado a lado. Automáticos revisados no estoque Netcar.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P("A decisão não é religiosa — é matemática de uso, bolso e revenda. Comparativo direto."),
      H2("Automático"),
      UL([
        "Conforto urbano superior",
        "Revenda melhor na maioria dos segmentos",
        "Exige histórico de troca de fluido do câmbio",
        "Consumo um pouco maior em alguns modelos",
      ]),
      H2("Manual"),
      UL([
        "Preço de entrada menor",
        "Manutenção geralmente mais simples",
        "Controle total — pra quem gosta",
        "Revenda mais lenta em alguns nichos",
      ]),
      H2("No usado, o diferencial é histórico"),
      P(
        "Automático mal cuidado assusta; automático com revisão documentada tranquiliza. Manual mal usado (embreagem estourada) também aparece — test drive longo revela."
      ),
      ...carsBlock(cars, "Automáticos revisados no estoque", "Exemplos com câmbio auto já conferido:"),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Qual escolher?"),
      P("Cidade + revenda → automático. Orçamento apertado + controle → manual. Na dúvida, test drive nos dois."),
    ],
  };
}

export function buildPrimeiroCarroArticle({ slug, cars, hashStr, ctaHref, ctaLabel }) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        "Primeiro carro seminovo: guia do zero (sem pegadinha)",
        "Comprando o primeiro carro usado: o que ninguém te avisou",
      ],
      slug + "t"
    ),
    description:
      "Primeiro carro: orçamento real, modelos seguros, financiamento e opções de entrada no estoque Netcar, Esteio.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Primeiro carro não precisa ser o mais bonito — precisa ser o que não quebra o orçamento nem a paciência. Roteiro pra quem nunca comprou usado."
      ),
      H2("Regra 1 — Parcela total, não só do carro"),
      P("Some seguro, combustível e manutenção. Regra prática: parcela do carro ≤ 25% da renda líquida (se financiar)."),
      H2("Regra 2 — Hatch compacto quase sempre acerta"),
      P("Barato de manter, fácil de estacionar, peça abundante. Ideal pra aprender a dirigir sem susto."),
      H2("Regra 3 — Desconfie de 'oportunidade única'"),
      P("Pressa é tática de vendedor desonesto. Carro bom aguenta uma segunda visita."),
      ...carsBlock(
        cars,
        "Porta de entrada: estes estão no pátio agora",
        "Alguns dos mais acessíveis e revisados — bons candidatos a primeiro carro:"
      ),
      H2("Regra 4 — Simule antes de emocionar"),
      P("WhatsApp, documentos, parcela real. Depois visite."),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Pronto pro primeiro carro?"),
      P("Veja estoque de entrada e leve alguém experiente no test drive — ou confie no processo da loja."),
    ],
  };
}

/**
 * Guia por teto de preço (SEO de intenção "seminovo até X mil").
 * Evita overlap com manuais de SUV/categoria específica.
 */
export function buildFaixaPrecoArticle({
  slug,
  maxPrice,
  label,
  cars,
  hashStr,
  ctaHref,
  ctaLabel,
}) {
  const pick = makePick(hashStr);
  const maxLabel = label || `R$ ${Math.round(maxPrice / 1000)} mil`;
  return {
    slug,
    title: pick(
      [
        `Seminovo até ${maxLabel} em Esteio: o que cabe no orçamento`,
        `Carro seminovo até ${maxLabel}: como filtrar sem se perder`,
      ],
      slug + "t"
    ),
    description: `Como escolher seminovo até ${maxLabel} com estoque real em Esteio — checklist de preço, km e procedência.`,
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        `Busca por seminovo até ${maxLabel} costuma misturar anúncio antigo e preço que não fecha na visita. O caminho curto: filtrar estoque real, cruzar km/ano e só então agendar test drive.`
      ),
      H2("O que cabe bem nessa faixa"),
      P(
        `Até ${maxLabel}, o pátio costuma mostrar hatch, sedan compacto e SUV de entrada com ótimo custo-benefício. Dá pra montar pacote equilibrado: carro preparado, custo previsível e margem pra seguro.`
      ),
      praise("faixa", maxLabel, slug, hashStr),
      H2("Três filtros antes do WhatsApp"),
      UL([
        "Preço anunciado × histórico de revisão (não só “aceito troca”).",
        "Km coerente com o ano — alinhe expectativa de uso.",
        "Documentação e procedência claros antes de falar em parcela.",
      ]),
      ...carsBlock(
        cars,
        `Opções até ${maxLabel} no pátio agora`,
        "Recorte do estoque Netcar nesta faixa — compare e escolha 2 ou 3 pra visitar:"
      ),
      visitTip(slug, hashStr),
      H2("Financiamento: simule o total, não só a parcela"),
      P(
        "Some seguro, IPVA e manutenção. Se a parcela “cabe” mas o total aperta, ajuste entrada ou prazo — o consultor ajuda a fechar a conta."
      ),
      ...maybeAutoridade(slug, hashStr),
      H2(`Pronto pra filtrar até ${maxLabel}?`),
      softClose(slug, hashStr, `Abra o estoque com o teto de preço.`),
    ],
  };
}

/**
 * Guia por modelo com volume no estoque (ex.: T-Cross, Nivus, Creta).
 */
export function buildModeloArticle({ slug, modelo, cars, hashStr, ctaHref, ctaLabel }) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        `${modelo} seminovo em Esteio: por que entra na shortlist`,
        `Comprar ${modelo} usado: o que confere na visita`,
      ],
      slug + "t"
    ),
    description: `${modelo} seminovo em Esteio: quando faz sentido, o que olhar na visita e opções reais no estoque Netcar.`,
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        `${modelo} seminovo aparece muito em busca local — e com razão: é modelo que o cliente da região reconhece. Aqui o filtro é estoque real em Esteio: versão, km e preço lado a lado.`
      ),
      H2(`Por que ${modelo} costuma agradar`),
      praise("modelo", modelo, slug, hashStr),
      P(
        `No dia a dia do RS, ${modelo} entrega o que a maioria precisa: uso misto cidade/estrada, peça conhecida e revenda previsível. A decisão fina fica no exemplar — ano, km e equipamentos.`
      ),
      H2("O que conferir na visita (sem drama)"),
      UL([
        "Histórico de manutenção e revisão em dia.",
        "Estado de freios, suspensão e pneus.",
        "Test drive em rua e velocidade — conforto e alinhamento.",
      ]),
      visitTip(slug, hashStr),
      ...carsBlock(
        cars,
        `${modelo} no estoque agora`,
        `Unidades ${modelo} no pátio Netcar — compare preço e km:`
      ),
      H2("Troca e financiamento"),
      P(
        "Se vai dar o atual na troca, leve avaliação atualizada. Financiamento: simule entrada + prazo antes de fechar no modelo."
      ),
      ...maybeAutoridade(slug, hashStr),
      H2(`Ver ${modelo} no estoque`),
      softClose(slug, hashStr, `Filtre pelo modelo e escolha duas unidades.`),
    ],
  };
}

/**
 * Intenção de uso: família, baixa km, cidade, viagem.
 */
export function buildUsoArticle({ slug, uso, cars, hashStr, ctaHref, ctaLabel }) {
  const pick = makePick(hashStr);
  const copy = {
    familia: {
      title: ["Carro pra família seminovo: espaço sem estourar orçamento", "Seminovo familiar em Esteio: o que priorizar"],
      desc: "Carro pra família: espaço, segurança e custo — com opções reais no estoque Netcar em Esteio.",
      lead: "Família muda o critério: porta-malas, bancos traseiros e custo mensal pesam mais que design.",
      h2a: "O que família realmente precisa",
      pa: "Espaço pra cadeirinha, acesso fácil às portas traseiras e porta-malas que aguenta mala + mercado. SUV compacto e sedan médio costumam encaixar muito bem nesse perfil.",
      h2b: "Custo mensal além da parcela",
      pb: "Seguro, combustível e pneus sobem com porte. Vale simular dois portes no mesmo orçamento e escolher o que mantém folga no mês.",
      praiseExtra: "Pra família, o carro certo é o que chega inteiro no fim do dia — conforto e previsibilidade de custo.",
    },
    "baixa-km": {
      title: ["Seminovo com baixa km: quando o prêmio faz sentido", "Carro usado com poucos km: o que checar"],
      desc: "Seminovo baixa km em Esteio: como ler odômetro, preço e procedência com estoque real.",
      lead: "Baixa km atrai — e o prêmio faz sentido quando o histórico vem limpo e a preparação está clara.",
      h2a: "Km baixo com histórico em dia",
      pa: "Odômetro baixo + revisão documentada é combinação forte. Peça o histórico e confira se o uso declarado fecha com o estado do carro.",
      h2b: "Quando pagar a mais",
      pb: "Faz sentido se o gap de preço vs unidade similar com mais km for menor que o custo estimado de manutenção adiantada — e se a ficha estiver completa.",
      praiseExtra: "Unidade com poucos km e preparação séria costuma ser shortlist rápida na loja.",
    },
    cidade: {
      title: ["Hatch seminovo pra cidade: econômico e prático", "Carro pra uso urbano em Esteio e Grande POA"],
      desc: "Hatch e compacto seminovo pra cidade: consumo, manobra e opções no estoque Netcar.",
      lead: "Uso urbano premia carro ágil, econômico e fácil de estacionar — o pacote certo pra trânsito da Grande POA.",
      h2a: "Prioridades na cidade",
      pa: "Raio de giro, visibilidade e consumo no para-e-anda. Hatch e compacto costumam acertar sem pagar porte que você não usa.",
      h2b: "Quando o SUV compacto ainda encaixa",
      pb: "Se tem garagem alta ou estrada de terra leve no fim de semana, SUV de entrada entra na disputa com ótimo equilíbrio cidade/estrada.",
      praiseExtra: "Na cidade, o seminovo certo reduz fadiga no trânsito e custo no posto.",
    },
    viagem: {
      title: ["Seminovo pra viagem e Serra: conforto e porta-malas", "Carro pra viagem no RS: o que levar na shortlist"],
      desc: "Seminovo pra viagem e Serra Gaúcha: conforto, estabilidade e estoque real em Esteio.",
      lead: "Viagem longa e Serra pedem freio/suspensão em dia, porta-malas útil e motor folgado na subida.",
      h2a: "Checklist antes da estrada",
      pa: "Pneus, freios, ar-condicionado e histórico de revisão. Na Serra, transmissão e refrigeração importam — o test drive revela.",
      h2b: "Porte certo pro roteiro RS",
      pb: "SUV compacto e sedan médio cobrem a maioria dos roteiros do estado com conforto e custo equilibrados.",
      praiseExtra: "Pra quem viaja, o seminovo certo é o que chega descansado — e volta sem susto.",
    },
  }[uso] || {
    title: ["Seminovo sob medida: como escolher pelo uso", "Escolher seminovo pelo uso real"],
    desc: "Escolha seminovo pelo uso — com estoque real Netcar em Esteio.",
    lead: "Uso define a shortlist melhor que marca sozinha.",
    h2a: "Defina o uso principal",
    pa: "Cidade, família, viagem ou km baixo mudam categoria e orçamento.",
    h2b: "Compare no estoque",
    pb: "Duas ou três unidades reais batem qualquer lista genérica da internet.",
    praiseExtra: "Quando o uso está claro, a visita rende.",
  };

  return {
    slug,
    title: pick(copy.title, slug + "t"),
    description: copy.desc,
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(copy.lead),
      H2(copy.h2a),
      P(copy.pa),
      H2(copy.h2b),
      P(copy.pb),
      P(copy.praiseExtra),
      praise("uso", uso, slug, hashStr),
      ...carsBlock(cars, "Opções alinhadas a esse uso", "Recorte do estoque Netcar pra essa intenção:"),
      visitTip(slug, hashStr),
      ...maybeAutoridade(slug, hashStr),
      H2("Próximo passo"),
      softClose(slug, hashStr),
    ],
  };
}

/**
 * Híbrido seminovo — só quando há unidades no estoque (venda sutil, zero detração).
 */
export function buildHibridoArticle({ slug, cars, hashStr, ctaHref, ctaLabel }) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        "Seminovo híbrido em Esteio: quando faz sentido",
        "Carro híbrido usado: guia prático pra Grande POA",
      ],
      slug + "t"
    ),
    description:
      "Híbrido seminovo em Esteio: perfil de uso, o que conferir na visita e opções reais no estoque Netcar.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Híbrido seminovo atrai quem roda muito em cidade e quer resposta suave no trânsito. Em Esteio, a conversa certa começa pelo uso — não por moda."
      ),
      praise("hibrido", "híbrido", slug, hashStr),
      H2("Quando o híbrido encaixa bem"),
      UL([
        "Muitos km em trânsito urbano (para-e-anda).",
        "Busca por conforto e tecnologia no pacote.",
        "Orçamento alinhado a seminovos de porte médio/alto.",
      ]),
      H2("O que olhar na visita"),
      UL([
        "Histórico de revisão e bateria conforme orientação da marca.",
        "Test drive em cidade: retomada, silêncio e modos de condução.",
        "Documentação e procedência iguais a qualquer seminovo.",
      ]),
      visitTip(slug, hashStr),
      ...carsBlock(
        cars,
        "Híbridos no estoque agora",
        "Exemplares híbridos consultados no estoque oficial — confirme disponibilidade na ficha:"
      ),
      ...maybeAutoridade(slug, hashStr),
      H2("Próximo passo"),
      softClose(
        slug,
        hashStr,
        "Se o perfil de uso combina, vale comparar os híbridos do pátio lado a lado."
      ),
    ],
  };
}
