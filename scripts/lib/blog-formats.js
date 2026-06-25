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
  "Estoque rotativo: o que está na vitrine hoje pode sair amanhã. Se algum chamou atenção, confirme disponibilidade antes de vir.",
  "Carro bem preparado e bem precificado não fica parado. Quando bater o olho no certo, vale reservar o test drive.",
];

const AUTORIDADE =
  "Na Netcar, cada seminovo passa pela Fábrica de Valor — mais de 60 itens conferidos, laudo e revisão antes da vitrine.";

function makePick(hashStr) {
  return (arr, seed) => arr[hashStr(seed) % arr.length];
}

function carsBlock(cars, h2, lead) {
  if (!cars.length) return [];
  const out = [H2(h2)];
  if (lead) out.push(P(lead));
  out.push(CARS(cars));
  return out;
}

function financeBlock(seed, hashStr) {
  const pick = makePick(hashStr);
  const lead = pick(
    [
      "Vai financiar? Simule pelo WhatsApp e chegue sabendo a parcela:",
      "Pra fechar a conta antes de ir à loja:",
    ],
    seed + "fin"
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
  const { label, slug, cars, stock, brl, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: p(
      [
        `Guia completo: como escolher ${ll} seminovo em Esteio (${ctx.year})`,
        `${label} usado: passo a passo antes de fechar negócio`,
      ],
      slug + "t"
    ),
    description: `Do primeiro contato ao test drive: o que verificar num ${ll} seminovo, quanto custa e quais ${label} estão no estoque da Netcar agora.`,
    readMinutes: 7,
    sections: [
      P(
        p(
          [
            `Comprar ${ll} seminovo sem plano é receita pra pagar caro ou levar problema escondido. Este guia segue a ordem que a gente usa na loja quando orienta cliente — do perfil de uso ao fechamento.`,
            `Se ${label} está na sua lista, use este roteiro antes de ir a qualquer vitrine. Vale pra Esteio e região metropolitana.`,
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
        `Hoje, seminovos na Netcar vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. ${label} costuma ficar na faixa intermediária — desconfie de preço muito abaixo do mercado sem laudo.`
      ),
      H2("Passo 3 — Documentação e procedência"),
      UL([
        "CRLV e CPF do vendedor batendo",
        "Sem restrição, multa ou pendência oculta",
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
      P(AUTORIDADE),
      ...financeBlock(slug, ctx.hashStr),
      H2("Resumo"),
      P(
        p(
          [
            `Bom ${ll} seminovo = procedência + revisão + preço coerente. Na Netcar você encurta o caminho — veja o estoque e agende test drive.`,
            `Seguiu os passos? Falta só escolher o exemplar. Confira os ${label} disponíveis.`,
          ],
          slug + "f"
        )
      ),
    ],
  };
}

function formatMitos(ctx) {
  const { label, slug, cars, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `${label} seminovo: 5 mitos que fazem você errar na compra`,
    description: `Verdade ou mito sobre ${ll} usado? Desmistificamos o que mais confunde compradores em Esteio — e mostramos ${label} reais no estoque.`,
    readMinutes: 6,
    sections: [
      P(
        `Tem conversa repetida na hora de comprar ${ll} usado — e muito mito vira decisão ruim. Separamos o que é papo de bar de o que é fato, com olhar de quem vê carro passar todo dia na loja.`
      ),
      H2('Mito 1: "Quanto mais barato, melhor o negócio"'),
      P(
        "Preço baixo sem laudo e sem histórico é loteria. Economia na compra vira oficina depois. O custo total inclui procedência, revisão e revenda futura."
      ),
      H2('Mito 2: "Se está bonito por fora, está tudo certo"'),
      P(
        "Pintura nova pode esconder batida. Interior impecável não garante câmbio saudável. Por isso inspeção técnica pesa mais que brilho na vitrine."
      ),
      H2('Mito 3: "Todo usado é igual — só muda o ano"'),
      P(
        `Dois ${label} do mesmo ano podem ter históricos opostos: um revisado em concessionária, outro rodando sem manutenção. O exemplar importa tanto quanto o modelo.`
      ),
      ...carsBlock(
        cars,
        "Na prática: estes exemplares no nosso pátio",
        `Sem achismo — estes ${label} estão disponíveis com ficha e fotos reais:`
      ),
      H2('Mito 4: "Financiar seminovo sempre sai caro demais"'),
      P(
        "Depende do prazo, da entrada e do perfil. Simular antes evita surpresa — e parcela bem montada cabe no orçamento sem sufocar."
      ),
      H2('Mito 5: "Particular sempre sai mais barato que loja"'),
      P(
        "Particular pode parecer mais barato, mas sem revisão, sem garantia e com burocracia sua. Revenda preparada entrega respaldo — e muitas vezes o custo-benefício final é melhor."
      ),
      P(AUTORIDADE),
      ...financeBlock(slug, ctx.hashStr),
      H2("Conclusão"),
      P(`Comprar ${ll} seminovo com critério é ignorar mito e olhar fato: laudo, km, donos, test drive. Veja os ${label} da Netcar.`),
    ],
  };
}

function formatErros(ctx) {
  const { label, slug, cars, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `7 erros ao comprar ${ll} usado (e como evitar cada um)`,
    description: `Erros clássicos na compra de ${ll} seminovo — e o que fazer em vez disso. Com destaques do estoque Netcar em Esteio.`,
    readMinutes: 7,
    sections: [
      P(
        `A gente vê comprador chegar na loja depois de quase cair em armadilha com ${ll}. Estes são os erros mais comuns — e o antídoto de cada um.`
      ),
      H2("Erro 1 — Comprar no impulso pelo anúncio"),
      P("Foto bonita não paga IPVA. Visite, ligue, peça laudo. Carro bom aguenta pergunta."),
      H2("Erro 2 — Ignorar a quilometragem versus idade"),
      P("50 mil km em 3 anos é história diferente de 50 mil em 8. Cruze km, ano e tipo de uso."),
      H2("Erro 3 — Não fazer test drive longo o suficiente"),
      P("Cinco minutos no quarteirão não revela câmbio cansado nem freio vibrando. Rode 15–20 min em ruas variadas."),
      H2("Erro 4 — Fechar sem simular financiamento"),
      P("Parcela surpresa mata o sonho. Simule com renda real antes de emocionar."),
      ...carsBlock(
        cars,
        "Em vez de errar: comece por estes modelos conferidos",
        `Estes ${label} já passaram pelo nosso processo — menos risco, mais clareza:`
      ),
      H2("Erro 5 — Esquecer custo de manutenção"),
      P("IPVA, seguro, pneu, revisão: some tudo. Carro barato com peça cara não é economia."),
      H2("Erro 6 — Não verificar documentação"),
      P("Restrição, multa, chassi divergente: cada um vira dor de cabeça na transferência."),
      H2("Erro 7 — Comparar só preço, não valor"),
      P("Valor = preço + procedência + preparação + pós-venda. Por isso revenda certificada existe."),
      P(AUTORIDADE),
      H2("Próximo passo"),
      P(`Evitou os erros? Veja ${label} revisados no estoque e marque test drive.`),
    ],
  };
}

function formatRanking(ctx) {
  const { label, slug, cars, stock, brl, pick: p } = ctx;
  const ll = label.toLowerCase();
  const n = cars.length;
  return {
    title: p(
      [
        `${n > 0 ? n : ""} ${label} seminovos que se destacam no estoque agora (${ctx.year})`,
        `Ranking: melhores ${ll} seminovos em Esteio nesta semana`,
      ],
      slug + "t"
    ),
    description: `Seleção editorial de ${label} no estoque real da Netcar: critérios, faixas de preço e os modelos que valem test drive em Esteio.`,
    readMinutes: 6,
    sections: [
      P(
        `Ranking de blog não é nota inventada — é curadoria. Olhamos procedência, km, preparação, preço versus mercado e procura na região. Estes ${label} se destacaram no pátio esta semana.`
      ),
      H2("Como escolhemos os destaques"),
      UL([
        "Passou pela Fábrica de Valor (60+ itens)",
        "Quilometragem coerente com o ano",
        "Preço alinhado ao mercado regional",
        "Procura real de quem visita a loja",
      ]),
      ...carsBlock(
        cars,
        `Os ${label} em destaque agora`,
        n
          ? `Temos ${n} ${label} selecionados abaixo — clique pra ver fotos, ficha e disponibilidade:`
          : `Confira os ${label} disponíveis no estoque:`
      ),
      P(p(URGENCIA, slug + "u")),
      H2("Faixa de preço de referência"),
      P(
        `Seminovos na Netcar hoje: ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Seu ${ll} ideal provavelmente está no meio dessa faixa — dependendo de ano e versão.`
      ),
      ...financeBlock(slug, ctx.hashStr),
      H2("Quer ver mais opções?"),
      P(`Ranking muda conforme entra carro novo no pátio. Veja todos os ${label} do estoque atualizado.`),
    ],
  };
}

function formatFaq(ctx) {
  const { label, slug, cars, stock, brl, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `${label} seminovo: perguntas que todo mundo faz (com resposta direta)`,
    description: `Dúvidas frequentes sobre ${ll} usado em Esteio: preço, financiamento, garantia, troca — e onde ver ${label} disponíveis na Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Reunimos as perguntas que mais aparecem no WhatsApp e na loja sobre ${ll} seminovo. Resposta curta, sem enrolação — e no final, exemplos reais do estoque.`
      ),
      H2(`Quanto custa um ${ll} seminovo em ${ctx.year}?`),
      P(
        `Depende de ano, versão e km. No estoque geral da Netcar, seminovos vão de ${brl(stock.minPrice)} a ${brl(stock.maxPrice)}. Simule ou veja a ficha de cada ${label} pra preço exato.`
      ),
      H2(`${label} usado dá problema?`),
      P(
        "Depende do exemplar, não só da marca. Histórico de revisão, laudo e inspeção técnica separam o bom do problemático. Revenda preparada reduz esse risco."
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
        "Estoque muda todo dia. O jeito mais rápido: clique no modelo abaixo ou chame no WhatsApp com o nome do carro."
      ),
      ...carsBlock(cars, `${label} disponíveis agora — confira`, null),
      H2("Tem garantia?"),
      P(AUTORIDADE + " Consultor detalha cobertura na proposta."),
      H2("Onde fica a Netcar?"),
      P("Esteio/RS, Av. Presidente Vargas — duas lojas. Agende visita e test drive."),
    ],
  };
}

function formatComparativo(ctx) {
  const { label, slug, cars, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Comprar ${ll} de particular ou na loja? Comparativo honesto`,
    description: `Particular x revenda na hora de comprar ${ll} seminovo: prós, contras e quando cada opção faz sentido. Veja ${label} revisados na Netcar.`,
    readMinutes: 6,
    sections: [
      P(
        `Na dúvida entre anúncio de particular e seminovo de loja, a decisão não é só preço — é risco, tempo e o que vem depois. Comparativo direto aplicado a ${label}.`
      ),
      H2("Particular: quando pode valer"),
      UL([
        "Conhece o dono e o histórico de verdade",
        "Disposto a assumir revisão por conta própria",
        "Tem mecânico de confiança pra inspecionar antes",
      ]),
      H2("Particular: onde dói"),
      UL([
        "Sem garantia ou laudo padronizado",
        "Burocracia e risco na transferência",
        "Test drive com estranhos e negociação cansativa",
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
        "Some tempo, risco, revisão eventual e revenda futura. Muitas vezes loja fica competitiva quando você coloca tudo na planilha."
      ),
      ...financeBlock(slug, ctx.hashStr),
      H2("Veredito"),
      P(
        p(
          [
            `Se quer tranquilidade na compra de ${ll}, revenda preparada encurta o caminho. Veja os ${label} do estoque.`,
            `Particular exige expertise; loja entrega processo. Para ${label}, confira o que temos prontos.`,
          ],
          slug + "v"
        )
      ),
    ],
  };
}

function formatPerfil(ctx) {
  const { label, slug, cars, pick: p } = ctx;
  const ll = label.toLowerCase();
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
        `Não existe ${ll} "melhor do mundo" — existe o melhor pro seu uso. Agrupamos cenários reais de quem compra na região e indicamos o que observar em cada um.`
      ),
      H2("Perfil 1 — Só cidade, poucos km por dia"),
      P(
        "Priorize consumo, manutenção barata e facilidade de estacionar. Versões compactas e automáticas aliviam trânsito."
      ),
      H2("Perfil 2 — Família com criança ou bagagem"),
      P(
        "Porta-malas, espaço traseiro e segurança (airbag, ISOFIX) pesam mais que potência. Confira estado de bancos e fixação."
      ),
      H2("Perfil 3 — Estrada e viagem frequente"),
      P(
        "Estabilidade, conforto em 100 km/h e motor que não force na subida. Veja pneus, freio e ruído de rodagem no test drive longo."
      ),
      ...carsBlock(
        cars,
        `${label} que atendem esses perfis — no estoque hoje`,
        `Estes modelos aparecem bastante pra quem se encaixa nos perfis acima:`
      ),
      H2("Automático ou manual pro seu caso?"),
      P(
        "Cidade pura → automático costuma valer. Orçamento apertado → manual de entrada. Estrada mista → depende do gosto e do bolso."
      ),
      P(AUTORIDADE),
      ...financeBlock(slug, ctx.hashStr),
      H2("Encontrou seu perfil?"),
      P(`Veja todos os ${label} e marque test drive com o consultor — ele cruza perfil, orçamento e estoque.`),
    ],
  };
}

function formatJornada(ctx) {
  const { label, slug, cars, pick: p } = ctx;
  const ll = label.toLowerCase();
  return {
    title: `Da pesquisa ao volante: jornada de quem compra ${ll} seminovo`,
    description: `Cronograma real de compra de ${ll} usado — pesquisa, visita, test drive, financiamento e retirada. Com ${label} do estoque Netcar.`,
    readMinutes: 7,
    sections: [
      P(
        `Comprar ${ll} seminovo não precisa ser corrida contra o relógio — mas ter ordem ajuda. Esta é a jornada que clientes da Netcar seguem, do primeiro Google ao carro na garagem.`
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
        `Estes ${label} estão disponíveis e são frequentes na shortlist de clientes:`
      ),
      H2("Semana 3 — Visita e test drive"),
      P(
        "Reserve 30–40 min por carro. Leve documento, faça percurso variado e não tenha vergonha de perguntar sobre revisão e laudo."
      ),
      H2("Semana 4 — Fechamento"),
      OL([
        "Confirme documentação e condições de garantia",
        "Assine financiamento ou pagamento",
        "Agende retirada e primeiros cuidados pós-compra",
      ]),
      P(AUTORIDADE),
      ...financeBlock(slug, ctx.hashStr),
      H2("Pronto pra começar?"),
      P(`Dá pra encurtar essa jornada em uma visita bem planejada. Veja ${label} no estoque e fale com a equipe.`),
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

export function buildPrecosArticle({ slug, cars, stock, brl, ctaHref, ctaLabel }) {
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
      P(AUTORIDADE),
      H2("Próximo passo"),
      P("Preços mudam conforme entra carro novo. Veja o estoque atualizado e fale com consultor."),
    ],
  };
}

export function buildChecklistArticle({ slug, cars, ctaHref, ctaLabel }) {
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
      P(AUTORIDADE),
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

export function buildAutomaticoArticle({ slug, cars, ctaHref, ctaLabel }) {
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
      P(AUTORIDADE),
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
      P(AUTORIDADE),
      H2("Pronto pro primeiro carro?"),
      P("Veja estoque de entrada e leve alguém experiente no test drive — ou confie no processo da loja."),
    ],
  };
}
