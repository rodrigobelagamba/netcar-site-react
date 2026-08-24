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
  "O estoque muda conforme os carros são vendidos. Confirme a disponibilidade antes de sair de casa.",
];

const AUTORIDADE_LINES = [
  "Antes da vitrine, cada seminovo passa pela Fábrica de Valor, onde mais de 60 itens são verificados.",
  "A Netcar atua em Esteio desde 1997 e prepara os carros na Fábrica de Valor antes de anunciá-los.",
  "Na Fábrica de Valor, a equipe verifica mais de 60 itens antes de o carro chegar ao estoque anunciado.",
  "Os seminovos são preparados pela equipe da Netcar antes de chegar às duas lojas da Av. Presidente Vargas.",
];

const SOFT_SELL_CLOSE = [
  "Escolha dois ou três carros no site, confirme a disponibilidade e combine a visita.",
  "Veja o estoque atualizado e confirme a disponibilidade antes de ir à loja.",
  "Compare as fichas dos carros disponíveis e marque o test drive pelo WhatsApp.",
  "Filtre o estoque, anote suas dúvidas e envie os carros escolhidos pelo WhatsApp.",
];

const VISIT_TIPS = [
  "No test drive, varie rua e velocidade: partida a frio, retomada e freio em descida.",
  "Na visita, confira histórico de revisão, estado de pneus e se a documentação fecha com a ficha.",
  "Leve a lista no celular para comparar versão, quilometragem e equipamentos lado a lado.",
  "Pergunte o que foi preparado e quais documentos ou consultas estão disponíveis para o carro.",
];

const PRAISE_BY_KIND = {
  marca: (label) =>
    `Nos ${label} disponíveis, compare versão, ano, quilometragem e equipamentos antes de decidir.`,
  categoria: (label) =>
    `${label} pode atender usos diferentes. Confira espaço, equipamentos e custo de manutenção em cada modelo.`,
  modelo: (label) =>
    `Ao comparar um ${label}, observe a versão, a quilometragem, os equipamentos e o histórico disponível.`,
  faixa: (label) =>
    `Até ${label}, compare o preço do carro com seguro, impostos e manutenção previstos para a versão.`,
  uso: () =>
    "Use a sua rotina para eliminar carros que não atendem ao que você precisa.",
  regional: (region) =>
    `Quem pesquisa em ${region} pode comparar o estoque em Esteio antes de organizar o deslocamento.`,
  hibrido: () =>
    "Em um híbrido seminovo, o perfil de uso, a bateria, o histórico de manutenção e a versão precisam ser avaliados juntos.",
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
      "Vai financiar? Envie os dados pelo WhatsApp para iniciar a simulação:",
      "Antes de ir à loja, você pode iniciar a simulação pelo WhatsApp:",
    ],
    slug + "fin",
  );
  return [
    H2("O que levar para a simulação"),
    P(lead),
    UL([
      "Entrada mínima de 20% (em geral 20% a 30%) — sem financiamento 100%",
      "Entrada parcelável no cartão de crédito, conforme análise",
      "Parcelas do saldo em 24x, 36x, 48x ou 60x",
      "Usado na troca como parte da entrada",
    ]),
    P(
      "Tudo mediante análise de crédito. Sem linha específica para negativados e sem aprovação garantida.",
    ),
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
        `Como escolher ${ll} seminovo em Esteio (${ctx.year})`,
        `${label} usado: passo a passo antes de fechar negócio`,
      ],
      slug + "t",
    ),
    description: `Do perfil de uso ao test drive: como escolher ${ll} seminovo com critério — e ver opções reais no estoque Netcar em Esteio.`,
    readMinutes: 7,
    sections: [
      P(
        p(
          [
            `Antes de comparar anúncios de ${ll}, defina o uso, o orçamento e os equipamentos necessários. Depois, compare os carros que estão disponíveis.`,
            `Se ${label} está na sua lista, comece pelo uso e pelo orçamento. Em seguida, confira a ficha e o histórico disponível de cada carro.`,
          ],
          slug + "i",
        ),
      ),
      H2("Passo 1 — Defina o que você precisa"),
      UL([
        "Uso diário: cidade, estrada ou misto?",
        "Quanto pode comprometer por mês (carro + seguro + combustível)?",
        "Precisa de porta-malas grande, cadeirinha, ou só você no volante?",
      ]),
      H2("Passo 2 — Entenda a faixa de preço real"),
      P(
        `Hoje, os seminovos da Netcar vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. O preço de cada ${label} muda conforme ano, versão, quilometragem e estado do veículo.`,
      ),
      praise(praiseKind, label, slug, hashStr),
      H2("Passo 3 — Documentação e procedência"),
      UL([
        "CRLV e dados do vendedor batendo",
        "Sem restrição ou pendência na transferência",
        "Documentos e consultas disponíveis para o veículo",
      ]),
      ...carsBlock(
        cars,
        "Passo 4 — Compare os carros do estoque",
        `Estes ${label} estão no estoque consultado agora. Abra a ficha para ver os dados:`,
      ),
      H2("Passo 5 — Faça o test drive"),
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
        `Compare os dados do carro, faça o test drive e leia as condições antes de decidir.`,
      ),
    ],
  };
}

function formatMitos(ctx) {
  const { label, kind, slug, cars, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  const praiseKind = kind === "categoria" ? "categoria" : "marca";
  return {
    title: `${label} seminovo: 5 ideias que merecem ser conferidas`,
    description: `O que é mito e o que precisa ser conferido ao comprar ${ll} usado. Veja também unidades disponíveis no estoque da Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Algumas ideias se repetem na hora de comprar ${ll} usado. Vale separar o que pode ser conferido do que é apenas opinião.`,
      ),
      H2('Mito 1: "Quanto mais barato, melhor o negócio"'),
      P(
        "Preço baixo, sozinho, não explica o estado do carro. Compare versão, quilometragem, histórico disponível, preparação e custo de manutenção.",
      ),
      H2('Mito 2: "Se está bonito por fora, está tudo certo"'),
      P(
        "A aparência é apenas uma parte da avaliação. Documentos, funcionamento, estrutura e test drive também precisam ser conferidos.",
      ),
      H2('Mito 3: "Todo usado é igual — só muda o ano"'),
      P(
        `Dois ${label} do mesmo ano podem ter históricos diferentes: um com revisão em dia, outro com uso mais intenso. O exemplar importa tanto quanto o modelo.`,
      ),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        "Carros disponíveis para comparar",
        `Estes ${label} aparecem no estoque consultado agora, com ficha e fotos:`,
      ),
      H2('Mito 4: "Financiar seminovo sempre sai caro demais"'),
      P(
        "Depende da entrada, do prazo, da taxa aprovada e do perfil de crédito. Compare o custo total das condições aprovadas, não apenas a parcela.",
      ),
      H2('Mito 5: "Particular sempre sai mais barato que loja"'),
      P(
        "A compra de particular e a compra em loja têm custos e responsabilidades diferentes. Compare documentação, forma de pagamento, troca, garantia e o trabalho envolvido em cada caminho.",
      ),
      ...maybeAutoridade(slug, hashStr),
      H2("Conclusão"),
      softClose(
        slug,
        hashStr,
        `Antes de decidir, confira os dados disponíveis, a quilometragem, a documentação e faça o test drive.`,
      ),
    ],
  };
}

function formatErros(ctx) {
  const { label, slug, cars, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `7 erros ao comprar ${ll} usado (e como evitar cada um)`,
    description: `Sete pontos que merecem atenção na compra de ${ll} seminovo, com unidades disponíveis na Netcar em Esteio.`,
    readMinutes: 7,
    sections: [
      P(
        `Alguns erros aparecem com frequência na compra de ${ll}. A maioria pode ser evitada com comparação, documentos e test drive.`,
      ),
      H2("Erro 1 — Comprar no impulso pelo anúncio"),
      P(
        "A foto ajuda a selecionar, mas não substitui a ficha, os documentos disponíveis, a visita e o test drive.",
      ),
      H2("Erro 2 — Ignorar a quilometragem versus idade"),
      P(
        "50 mil km em 3 anos é história diferente de 50 mil em 8. Cruze km, ano e tipo de uso.",
      ),
      H2("Erro 3 — Não fazer test drive longo o suficiente"),
      P(
        "Faça um percurso que permita observar câmbio, freios, direção, suspensão e alertas no painel.",
      ),
      H2("Erro 4 — Fechar sem simular financiamento"),
      P(
        "Inicie a simulação com dados reais e compare as condições aprovadas antes de assumir uma parcela.",
      ),
      ...carsBlock(
        cars,
        "Carros do estoque para comparar",
        `Estes ${label} aparecem no estoque consultado agora:`,
      ),
      H2("Erro 5 — Esquecer custo de manutenção"),
      P(
        "IPVA, seguro, pneu, revisão: some tudo. O carro certo é o que cabe no mês inteiro, não só na entrada.",
      ),
      H2("Erro 6 — Não verificar documentação"),
      P(
        "Restrição, multa, dados divergentes: cada um atrasa a transferência. Confira antes de fechar.",
      ),
      H2("Erro 7 — Comparar somente o preço anunciado"),
      P(
        "Compare também versão, quilometragem, documentos disponíveis, estado do carro, preparação e condições da venda.",
      ),
      ...maybeAutoridade(slug, hashStr),
      H2("Use esta lista na comparação"),
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
        `${label} seminovos disponíveis em Esteio`,
      ],
      slug + "t",
    ),
    description: `Veja ${label} no estoque consultado da Netcar e compare ano, versão, quilometragem, preço e equipamentos.`,
    readMinutes: 6,
    sections: [
      P(
        `Esta lista usa o estoque consultado no momento da geração. Compare os dados de cada ${label} e confirme a disponibilidade antes da visita.`,
      ),
      H2("Como escolhemos os destaques"),
      UL([
        "Carro disponível no estoque consultado",
        "Ano e quilometragem informados na ficha",
        "Preço publicado no site",
        "Fotos e equipamentos apresentados no anúncio",
      ]),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        `Os ${label} em destaque agora`,
        n
          ? `${n} ${label} selecionados abaixo. Abra a ficha para ver fotos, dados e disponibilidade:`
          : `Confira os ${label} disponíveis no estoque:`,
      ),
      P(p(URGENCIA, slug + "u")),
      H2("Faixa de preço de referência"),
      P(
        `O estoque consultado vai de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. O valor de um ${ll} muda conforme ano, versão, quilometragem e estado do veículo.`,
      ),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Quer ver mais opções?"),
      softClose(
        slug,
        hashStr,
        `A lista muda quando carros entram ou são vendidos.`,
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
        `Reunimos as perguntas que mais aparecem no WhatsApp e na loja sobre ${ll} seminovo. As respostas são diretas e usam os carros do estoque como referência.`,
      ),
      H2(`Quanto custa um ${ll} seminovo em ${ctx.year}?`),
      P(
        `Depende de ano, versão e km. No estoque geral da Netcar, seminovos vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Veja a ficha de cada ${label} para conferir o preço.`,
      ),
      H2(`Como escolher um bom ${ll} usado?`),
      P(
        "Foque no exemplar: versão, quilometragem, histórico disponível, documentos, estado do carro e test drive.",
      ),
      H2("Vale financiar ou pagar à vista?"),
      P(
        "Compare o valor à vista com o custo total das condições de financiamento aprovadas. A entrada mínima é de 20% e pode ser parcelada no cartão, conforme disponibilidade e análise.",
      ),
      H2("Posso dar meu carro na troca?"),
      P(
        "Sim — inclusive financiado. Avaliamos seu usado e o valor entra na negociação do seminovo escolhido.",
      ),
      H2("Como sei se ainda está disponível?"),
      P(
        "Estoque muda com frequência. O jeito mais rápido: abrir a ficha abaixo ou chamar no WhatsApp com o nome do carro.",
      ),
      ...carsBlock(cars, `${label} no estoque — confira`, null),
      ...maybeAutoridade(slug, hashStr),
      H2("Onde fica a Netcar?"),
      P(
        "Esteio/RS, Av. Presidente Vargas — duas lojas. Agende visita e test drive.",
      ),
      softClose(slug, hashStr),
    ],
  };
}

function formatComparativo(ctx) {
  const { label, slug, cars, pick: p, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Comprar ${ll} de particular ou na loja: o que muda`,
    description: `Particular x revenda na hora de comprar ${ll} seminovo: documentos, pagamento, troca, garantia e responsabilidades.`,
    readMinutes: 6,
    sections: [
      P(
        `Na compra de particular ou em loja, não compare apenas o preço. Documentação, pagamento, troca, garantia e o trabalho de conferir o carro também entram na decisão.`,
      ),
      H2("Particular: quando pode valer"),
      UL([
        "Conhece o dono e consegue conferir o histórico informado",
        "Disposto a organizar revisão por conta própria",
        "Tem mecânico de confiança para inspecionar antes",
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
        `${label} disponíveis na Netcar`,
        `Compare ficha, fotos, ano, quilometragem e preço dos carros consultados:`,
      ),
      H2("Conta final: não é só o valor do carro"),
      P(
        "Considere o tempo de conferência, a documentação, as formas de pagamento e a possibilidade de troca. Depois, compare as propostas registradas.",
      ),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Como escolher entre os dois caminhos"),
      softClose(
        slug,
        hashStr,
        p(
          [
            `Escolha o caminho em que você consegue conferir o carro, os documentos e as condições com clareza.`,
            `Compare os carros e as condições completas antes de decidir onde comprar seu ${label}.`,
          ],
          slug + "v",
        ),
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
        `${label} usado: qual versão atende melhor ao seu dia a dia`,
      ],
      slug + "t",
    ),
    description: `Perfil urbano, família ou estrada: como escolher ${ll} seminovo em Esteio a partir do estoque atual.`,
    readMinutes: 6,
    sections: [
      P(
        `A escolha de um ${ll} depende do uso, do orçamento e dos equipamentos necessários. Veja o que observar em três rotinas comuns.`,
      ),
      H2("Perfil 1 — Só cidade, poucos km por dia"),
      P(
        "Priorize consumo, manutenção acessível e facilidade de estacionar. Versões compactas e automáticas aliviam o trânsito da Grande POA.",
      ),
      H2("Perfil 2 — Família com criança ou bagagem"),
      P(
        "Porta-malas, espaço traseiro e segurança (airbag, ISOFIX) pesam mais que potência. Confira estado de bancos e fixação.",
      ),
      H2("Perfil 3 — Estrada e viagem frequente"),
      P(
        "Estabilidade, conforto em velocidade de estrada e motor folgado na subida. Veja pneus, freio e ruído de rodagem no test drive longo.",
      ),
      praise(praiseKind, label, slug, hashStr),
      ...carsBlock(
        cars,
        `${label} que atendem esses perfis — no estoque`,
        `Veja os carros disponíveis e confira quais atendem aos itens que você definiu:`,
      ),
      H2("Automático ou manual para o seu uso?"),
      P(
        "No trânsito, muita gente prefere automático. O manual pode ter preço de entrada e manutenção diferentes. Compare a versão e faça o test drive dos dois.",
      ),
      visitTip(slug, hashStr),
      ...maybeAutoridade(slug, hashStr),
      H2("Encontrou seu perfil?"),
      softClose(
        slug,
        hashStr,
        `Envie os carros escolhidos e suas dúvidas para o consultor.`,
      ),
    ],
  };
}

function formatJornada(ctx) {
  const { label, slug, cars, hashStr } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Da pesquisa à visita: como comprar ${ll} seminovo`,
    description: `Organize a compra de ${ll} usado: pesquisa, visita, test drive, proposta e documentos. Veja carros do estoque Netcar.`,
    readMinutes: 7,
    sections: [
      P(
        `Organizar a pesquisa evita começar do zero na loja. Defina o orçamento, compare os carros disponíveis e leve as dúvidas para a visita.`,
      ),
      H2("1. Pesquisa e orçamento"),
      OL([
        "Defina teto de parcela ou valor total",
        "Liste 2–3 modelos/versões que atendem sua rotina",
        "Compare os preços dos carros disponíveis, não apenas uma tabela de referência",
      ]),
      H2("2. Contato e seleção"),
      OL([
        "Peça ficha, fotos e histórico dos favoritos",
        "Simule financiamento pelo WhatsApp",
        "Separe dois ou três carros para visitar no mesmo dia",
      ]),
      ...carsBlock(
        cars,
        "Carros para começar a comparação",
        `Estes ${label} aparecem no estoque consultado agora:`,
      ),
      H2("3. Visita e test drive"),
      P(
        "Faça um percurso que permita observar o carro e pergunte quais documentos, consultas e informações de preparação estão disponíveis.",
      ),
      visitTip(slug, hashStr),
      H2("4. Proposta e documentos"),
      OL([
        "Confirme documentação e condições da proposta",
        "Assine financiamento ou pagamento",
        "Agende retirada e primeiros cuidados pós-compra",
      ]),
      ...maybeAutoridade(slug, hashStr),
      ...maybeFinanceBlock(slug, hashStr, true),
      H2("Antes de marcar a visita"),
      softClose(
        slug,
        hashStr,
        `Confirme a disponibilidade dos carros antes de organizar a visita.`,
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
      ? `Como filtrar o estoque, conferir as informações dos carros e organizar a visita saindo de ${cityList}.`
      : `Como comparar os carros disponíveis ao buscar seminovo em ${cityList}.`,
    readMinutes: 7,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        isRemote
          ? `Antes de sair de ${cityList}, use o site para escolher os carros e anotar as dúvidas. O contato remoto serve para confirmar informações e organizar a visita, não para substituir o test drive.`
          : `Quem está em ${cityList} pode consultar o mesmo estoque da Netcar em Esteio. Compare cada unidade pela versão, quilometragem, preço e informações disponíveis.`,
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
        "Carros encontrados no estoque",
        "Abra a ficha para ver os dados de cada unidade e confirmar a disponibilidade:",
      ),
      H2("O que conferir sobre a loja e o carro"),
      UL([
        "Empresa, endereço e canais oficiais identificáveis",
        "Documentos, consultas e histórico disponíveis para o veículo",
        "Preparação do carro explicada pelo consultor",
        "Test drive e proposta completa antes da decisão",
      ]),
      H2(
        isRemote
          ? "O que adiantar antes do deslocamento"
          : "Como montar uma comparação útil",
      ),
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
              "Faça test drive dos carros escolhidos quando possível",
              "Compare condição total registrada na proposta",
            ],
      ),
      H2("O que não fechar só por mensagem"),
      P(
        "Foto e vídeo ajudam na triagem, mas não substituem inspeção, test drive e leitura da proposta. Simulação não é aprovação; avaliação por fotos não é valor final.",
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Para organizar a visita"),
      P(
        angle === "remoto"
          ? "Quem vem de fora pode adiantar a comparação. Veja o estoque, escolha os carros e organize a visita."
          : "Veja o estoque atualizado no site, escolha os candidatos e só então organize o contato e a visita.",
      ),
    ],
  };
}

export function buildPrecosArticle({
  slug,
  cars,
  stock,
  brl,
  ctaHref,
  ctaLabel,
  hashStr = defaultHashStr,
}) {
  return {
    slug,
    title: `Quanto custa um seminovo em Esteio em ${stock.year || new Date().getFullYear()}?`,
    description:
      "Veja como ano, versão, quilometragem e estado influenciam o preço, com exemplos do estoque da Netcar.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "O preço de um seminovo muda conforme modelo, versão, ano, quilometragem, estado e demanda. As faixas abaixo usam o estoque consultado no momento da atualização.",
      ),
      H2("Três faixas que aparecem no pátio"),
      UL([
        `Entrada (primeiro carro, uso urbano): a partir de ${brl(stock.minPrice)}`,
        "Faixa intermediária: valores entre o menor e o maior preço do estoque",
        `Premium (SUV, pickup, seminovo recente): até ${brl(stock.maxPrice)}`,
      ]),
      H2("O que entra no preço além do adesivo"),
      UL([
        "Ano, km e versão",
        "Histórico de manutenção e número de donos",
        "Preparação e itens revisados antes da venda",
        "Demanda na região (modelo que sai rápido vs. encalhado)",
      ]),
      ...carsBlock(
        cars,
        "Carros em cada faixa de preço",
        "Abra a ficha dos carros abaixo para comparar os valores e os dados:",
      ),
      H2("Como não pagar a mais"),
      OL([
        "Simule financiamento antes da visita",
        "Compare exemplares similares (ano/km)",
        "Peça laudo e histórico",
        "Entenda por que um carro está muito abaixo de unidades semelhantes",
      ]),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Veja os preços do estoque atual"),
      P(
        "Preços mudam conforme entra carro novo. Veja o estoque atualizado e fale com consultor.",
      ),
    ],
  };
}

export function buildChecklistArticle({
  slug,
  cars,
  ctaHref,
  ctaLabel,
  hashStr = defaultHashStr,
}) {
  return {
    slug,
    title: "Checklist para conferir antes de comprar um seminovo",
    description:
      "Lista prática de documentação, estrutura, mecânica, elétrica e test drive para usar na visita.",
    readMinutes: 8,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Use esta lista na visita, seja a compra de particular ou em loja. Se tiver dúvida sobre algum item, peça avaliação profissional.",
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
        "Carros disponíveis na Netcar",
        "Estes seminovos passaram pela Fábrica de Valor antes de chegar à vitrine. Ainda assim, confira a ficha e faça o test drive:",
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Salvou o checklist?"),
      P("Salve a lista no celular e use durante a visita."),
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
      P(
        "Venda particular e troca na loja têm diferenças de preço, tempo, exposição e documentação. Compare o que pesa mais no seu caso.",
      ),
      H2("Venda particular"),
      UL([
        "Potencial: preço um pouco acima em anúncio bem feito",
        "Custo de tempo: fotos, respostas, visitas, transferência",
        "Risco: golpe, pagamento, carro parado na rua",
        "Prazo: imprevisível (semanas ou meses)",
      ]),
      H2("Troca na revenda"),
      UL([
        "Potencial: proposta da loja após vistoria",
        "Custo de tempo: uma visita, uma negociação",
        "Exposição: negociação e documentação conduzidas com a loja",
        "Prazo: depende da vistoria, dos documentos e do acordo",
      ]),
      H2("Financiado? Troca ainda funciona"),
      P(
        "O saldo para quitação é calculado na negociação. A diferença pode entrar na compra de outro carro, conforme avaliação e acordo.",
      ),
      H2("Qual caminho faz mais sentido"),
      P(
        "A venda particular exige tempo para anunciar, mostrar o carro e cuidar do pagamento. A troca concentra avaliação, documentação e compra do próximo carro na mesma negociação.",
      ),
      H2("Para pedir uma avaliação"),
      P(
        "Envie os dados do usado e combine a vistoria. A proposta final depende da avaliação presencial e dos documentos.",
      ),
    ],
  };
}

export function buildAutomaticoArticle({
  slug,
  cars,
  ctaHref,
  ctaLabel,
  hashStr = defaultHashStr,
}) {
  return {
    slug,
    title: "Automático ou manual no seminovo? Comparativo técnico",
    description:
      "Compare funcionamento, manutenção, conforto e uso entre câmbios automático e manual em um seminovo.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "A escolha depende do trânsito que você enfrenta, do orçamento e do histórico de manutenção do carro. Compare as diferenças antes do test drive.",
      ),
      H2("Automático"),
      UL([
        "Evita trocas manuais de marcha no trânsito",
        "Tem funcionamento e manutenção diferentes conforme o tipo de câmbio",
        "Pede atenção ao plano de manutenção indicado pela fabricante",
        "O consumo varia conforme motor, câmbio, peso e trajeto",
      ]),
      H2("Manual"),
      UL([
        "Pode ter preço de entrada diferente na mesma linha",
        "Usa embreagem e exige trocas de marcha pelo motorista",
        "O custo de manutenção depende do modelo e do estado do conjunto",
        "A oferta e a procura variam conforme o segmento",
      ]),
      H2("No usado, o diferencial é histórico"),
      P(
        "Nos dois casos, confira o histórico disponível e faça o test drive. Observe trancos, ruídos, embreagem, engates e alertas no painel.",
      ),
      ...carsBlock(
        cars,
        "Automáticos disponíveis no estoque",
        "Abra a ficha para conferir versão, quilometragem, preço e equipamentos:",
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Qual escolher?"),
      P(
        "Compare o custo, a manutenção prevista e o uso diário. Se ainda tiver dúvida, faça o test drive nos dois tipos.",
      ),
    ],
  };
}

export function buildPrimeiroCarroArticle({
  slug,
  cars,
  hashStr,
  ctaHref,
  ctaLabel,
}) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        "Primeiro carro seminovo: o que conferir antes de comprar",
        "Como escolher o primeiro carro usado",
      ],
      slug + "t",
    ),
    description:
      "Primeiro carro: como organizar orçamento, uso, seguro, manutenção, financiamento e test drive.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Na primeira compra, comece pelo orçamento completo e pelo uso. Preço do carro, seguro, impostos, combustível e manutenção precisam caber juntos.",
      ),
      H2("1. Calcule o custo mensal, não apenas a parcela"),
      P(
        "Some parcela, seguro, combustível, impostos e uma reserva para manutenção. O limite precisa respeitar o seu orçamento real.",
      ),
      H2("2. Escolha o tipo de carro pelo uso"),
      P(
        "Hatch, sedan e SUV têm diferenças de espaço, consumo, seguro e manutenção. Compare o que você realmente precisa no dia a dia.",
      ),
      H2("3. Não decida apenas pela pressa"),
      P(
        "Confirme a ficha, os documentos disponíveis, as condições da proposta e faça o test drive antes de fechar.",
      ),
      ...carsBlock(
        cars,
        "Carros em faixas de entrada no estoque",
        "Compare os dados e os custos de cada opção. Estar nesta lista não significa que o carro serve para todo primeiro comprador:",
      ),
      H2("4. Simule antes da visita"),
      P(
        "Envie os dados pelo WhatsApp e compare as condições aprovadas. A simulação depende da análise de crédito.",
      ),
      ...maybeAutoridade(slug, defaultHashStr),
      H2("Antes de escolher o primeiro carro"),
      P(
        "Veja o estoque, selecione alguns carros e leve suas dúvidas para a visita. Se achar necessário, peça também uma avaliação técnica independente.",
      ),
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
        `Carro seminovo até ${maxLabel}: como comparar o estoque`,
      ],
      slug + "t",
    ),
    description: `Como escolher seminovo até ${maxLabel} no estoque atual em Esteio: preço, km e procedência.`,
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        `Ao buscar seminovo até ${maxLabel}, confira se o anúncio está atualizado. Depois compare ano, versão, quilometragem e equipamentos antes de agendar o test drive.`,
      ),
      H2("O que cabe bem nessa faixa"),
      P(
        `Os tipos de carro disponíveis até ${maxLabel} mudam com o estoque. Além do preço, reserve espaço no orçamento para seguro, impostos e manutenção.`,
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
        "Abra as fichas abaixo e escolha dois ou três carros para conhecer:",
      ),
      visitTip(slug, hashStr),
      H2("Financiamento: simule o total, não só a parcela"),
      P(
        "Some seguro, IPVA e manutenção. Compare o custo total das condições aprovadas e ajuste entrada ou prazo somente se fizer sentido no seu orçamento.",
      ),
      ...maybeAutoridade(slug, hashStr),
      H2(`Antes de escolher até ${maxLabel}`),
      softClose(slug, hashStr, `Abra o estoque com o teto de preço.`),
    ],
  };
}

/**
 * Guia por modelo com volume no estoque (ex.: T-Cross, Nivus, Creta).
 */
export function buildModeloArticle({
  slug,
  modelo,
  cars,
  hashStr,
  ctaHref,
  ctaLabel,
}) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        `${modelo} seminovo em Esteio: o que comparar`,
        `Comprar ${modelo} usado: o que confere na visita`,
      ],
      slug + "t",
    ),
    description: `${modelo} seminovo em Esteio: quando faz sentido, o que olhar na visita e opções reais no estoque Netcar.`,
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        `Esta página reúne unidades do ${modelo} encontradas no estoque consultado. Compare versão, ano, quilometragem, preço e equipamentos.`,
      ),
      H2(`Por que ${modelo} costuma agradar`),
      praise("modelo", modelo, slug, hashStr),
      P(
        `Mesmo dentro do mesmo modelo, ano, versão, quilometragem e equipamentos mudam bastante. A decisão precisa considerar o exemplar e o seu uso.`,
      ),
      H2("O que conferir na visita"),
      UL([
        "Histórico de manutenção e revisão em dia.",
        "Estado de freios, suspensão e pneus.",
        "Test drive em rua e velocidade — conforto e alinhamento.",
      ]),
      visitTip(slug, hashStr),
      ...carsBlock(
        cars,
        `${modelo} no estoque agora`,
        `Unidades ${modelo} no pátio Netcar — compare preço e km:`,
      ),
      H2("Troca e financiamento"),
      P(
        "Se vai dar o atual na troca, leve avaliação atualizada. Financiamento: simule entrada + prazo antes de fechar no modelo.",
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
export function buildUsoArticle({
  slug,
  uso,
  cars,
  hashStr,
  ctaHref,
  ctaLabel,
}) {
  const pick = makePick(hashStr);
  const copy = {
    familia: {
      title: [
        "Carro para família: como comparar espaço e orçamento",
        "Seminovo familiar em Esteio: o que priorizar",
      ],
      desc: "Carro para família: compare espaço, segurança e custo com opções do estoque Netcar em Esteio.",
      lead: "Família muda o critério: porta-malas, bancos traseiros e custo mensal pesam mais que design.",
      h2a: "O que a família precisa no dia a dia",
      pa: "Confira espaço para cadeirinha, acesso às portas traseiras e porta-malas. Compare as medidas e teste a acomodação na visita.",
      h2b: "Custo mensal além da parcela",
      pb: "Seguro, combustível e pneus sobem com porte. Vale simular dois portes no mesmo orçamento e escolher o que mantém folga no mês.",
      praiseExtra:
        "Leve em conta quem vai usar o banco traseiro, o volume de bagagem e o custo mensal do carro.",
    },
    "baixa-km": {
      title: [
        "Seminovo com baixa km: quando o prêmio faz sentido",
        "Carro usado com poucos km: o que checar",
      ],
      desc: "Seminovo baixa km em Esteio: como comparar odômetro, preço e procedência no estoque atual.",
      lead: "Quilometragem baixa chama atenção, mas precisa ser analisada junto com o ano, o estado do carro e o histórico disponível.",
      h2a: "Km baixo com histórico em dia",
      pa: "Peça os registros disponíveis e observe se o desgaste de volante, bancos, pneus e pedais combina com a quilometragem informada.",
      h2b: "Quando pagar a mais",
      pb: "Compare o valor com unidades semelhantes de mesma versão e ano. Quilometragem é um fator, não uma justificativa isolada para pagar mais.",
      praiseExtra:
        "Antes de decidir, confirme os dados do anúncio e faça o test drive.",
    },
    cidade: {
      title: [
        "Hatch seminovo para a cidade: o que comparar",
        "Carro para uso urbano em Esteio e Grande POA",
      ],
      desc: "Hatch e compacto seminovo para a cidade: consumo, manobra e opções no estoque Netcar.",
      lead: "Para uso urbano, tamanho, visibilidade, consumo e facilidade para estacionar costumam pesar na escolha.",
      h2a: "Prioridades na cidade",
      pa: "Observe raio de giro, visibilidade e consumo informado para a versão. Compare também o tamanho do carro com sua garagem e suas vagas habituais.",
      h2b: "Quando o SUV compacto ainda encaixa",
      pb: "Um SUV compacto pode entrar na comparação quando altura do solo e espaço forem importantes. Confira seguro, pneus e consumo antes de decidir.",
      praiseExtra:
        "Faça o test drive no tipo de trânsito mais parecido possível com a sua rotina.",
    },
    viagem: {
      title: [
        "Seminovo para viagem e Serra: conforto e porta-malas",
        "Carro para viagem no RS: o que conferir",
      ],
      desc: "Seminovo para viagem e Serra Gaúcha: conforto, estabilidade e opções do estoque em Esteio.",
      lead: "Para viagens, confira espaço, posição de dirigir, pneus, freios, suspensão e o histórico de manutenção disponível.",
      h2a: "Checklist antes da estrada",
      pa: "Confira pneus, freios, ar-condicionado e histórico de revisão disponível. Use o test drive para observar transmissão, direção e ruídos.",
      h2b: "Porte certo para viajar pelo RS",
      pb: "Hatch, sedan e SUV atendem viagens de formas diferentes. Compare espaço, estabilidade, consumo e custo de manutenção na versão escolhida.",
      praiseExtra:
        "Leve a bagagem e o número de passageiros em conta antes de escolher o porte.",
    },
  }[uso] || {
    title: [
      "Como escolher um seminovo pelo uso",
      "Escolher seminovo pelo uso real",
    ],
    desc: "Escolha um seminovo a partir do uso e compare carros disponíveis na Netcar em Esteio.",
    lead: "Comece pelo uso antes de escolher marca ou modelo.",
    h2a: "Defina o uso principal",
    pa: "Cidade, família, viagem ou km baixo mudam categoria e orçamento.",
    h2b: "Compare no estoque",
    pb: "Compare duas ou três unidades disponíveis usando os mesmos critérios.",
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
      ...carsBlock(
        cars,
        "Carros disponíveis para comparar",
        "Veja os dados das unidades abaixo e compare com o uso que você definiu:",
      ),
      visitTip(slug, hashStr),
      ...maybeAutoridade(slug, hashStr),
      H2("Depois de montar a lista"),
      softClose(slug, hashStr),
    ],
  };
}

/**
 * Híbrido seminovo — só quando há unidades no estoque (venda sutil, zero detração).
 */
export function buildHibridoArticle({
  slug,
  cars,
  hashStr,
  ctaHref,
  ctaLabel,
}) {
  const pick = makePick(hashStr);
  return {
    slug,
    title: pick(
      [
        "Seminovo híbrido em Esteio: quando faz sentido",
        "Carro híbrido usado: o que comparar na Grande POA",
      ],
      slug + "t",
    ),
    description:
      "Híbrido seminovo em Esteio: perfil de uso, o que conferir na visita e opções reais no estoque Netcar.",
    readMinutes: 6,
    ctaLabel,
    ctaHref,
    sections: [
      P(
        "Antes de escolher um híbrido seminovo, considere o tipo de trajeto, a versão, o histórico de manutenção e as informações disponíveis sobre a bateria.",
      ),
      praise("hibrido", "híbrido", slug, hashStr),
      H2("Quando o híbrido encaixa bem"),
      UL([
        "Rotina e quilometragem percorrida em trânsito urbano",
        "Custo de seguro, manutenção e eventuais componentes específicos",
        "Orçamento disponível para a versão e o ano escolhidos",
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
        "Exemplares híbridos consultados no estoque oficial — confirme disponibilidade na ficha:",
      ),
      ...maybeAutoridade(slug, hashStr),
      H2("Antes de marcar o test drive"),
      softClose(
        slug,
        hashStr,
        "Compare os híbridos disponíveis e confirme as informações de cada unidade antes da visita.",
      ),
    ],
  };
}
