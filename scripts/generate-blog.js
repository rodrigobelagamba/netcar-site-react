#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE BLOG — publica automaticamente, com ROTAÇÃO e ACÚMULO.
 *
 * Linha editorial: voz de consultor especialista da Netcar. Conteúdo útil de
 * verdade (80%) com persuasão sutil embutida na prosa (autoridade, prova social,
 * escassez honesta) e 1–2 carros REAIS do estoque entrando como "recomendação"
 * — não como vitrine de panfleto.
 *
 * A cada execução (1 pauta nova/semana, MAX_NEW_PER_RUN):
 *   - Mantém os posts já publicados e ATUALIZA dados dinâmicos (preços, carros).
 *   - Publica a próxima pauta ainda não usada do pool (derivado do estoque real).
 *
 * Ângulo/abertura/veredito variam por slug (determinístico — não muda a cada
 * rodada, evitando churn no git) para nenhuma matéria ficar igual à outra.
 *
 * Histórico vive em src/data/seo/blog-auto.json (precisa persistir entre
 * execuções — ver docs/AUTOMACAO-SEO.md, seção VPS/Docker).
 *
 * Uso: node scripts/generate-blog.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeTextFile } from "./lib/write-text-file.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const OUT = join(rootDir, "src", "data", "seo", "blog-auto.json");
const MANUAL = join(rootDir, "src", "data", "seo", "blog-posts.json");

const SITE = "https://www.netcarmultimarcas.com.br";
const API_URL = `${SITE}/api/v1/veiculos.php?limit=500`;
const YEAR = new Date().getFullYear();

const MAX_NEW_PER_RUN = 1; // pautas novas por execução (depois do lote inicial)
const INITIAL_BATCH = 6; // lote inicial quando não há histórico
const FEATURED = 2; // carros embutidos por matéria

function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function titleCase(s) {
  return String(s || "").toLowerCase().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase()).trim();
}
function brl(n) {
  return "R$ " + Math.round(n).toLocaleString("pt-BR");
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
// Hash determinístico (FNV-1a) para escolher variantes de forma estável por slug.
function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick(arr, seed) {
  return arr[hashStr(seed) % arr.length];
}

const H2 = (text) => ({ type: "h2", text });
const P = (text) => ({ type: "p", text });
const UL = (items) => ({ type: "ul", items });
const CARS = (cars) => ({ type: "cars", cars });

// ---------- Estoque real → cards de carro ----------

function imgUrl(p) {
  if (!p) return undefined;
  const s = String(p).replace(/^\.\//, "").replace(/^\//, "");
  return `${SITE}/${encodeURI(s)}`;
}
// valor_formatado da API pode vir com HTML (<span>R$</span>) — tira tags.
function cleanPrice(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
// Replica src/lib/slug.ts (maskPlate + generateVehicleSlug) para gerar a URL
// interna real do app: /veiculo/{modelo}-{ano}-{placa}-{id}.
function maskPlate(placa) {
  if (!placa) return "";
  const clean = String(placa).replace(/\s/g, "").toUpperCase().replace(/-/g, "");
  if (clean.length < 5) return clean;
  const prefixo = clean.substring(0, 3);
  const digs = clean.match(/\d/g);
  const ult = digs && digs.length >= 2 ? digs.slice(-2).join("") : clean.slice(-2);
  return `${prefixo}-xx${ult}`;
}
function vehicleSlug(v) {
  const parts = [];
  if (v.modelo) {
    let modelo = String(v.modelo).trim();
    if (v.marca && modelo.toLowerCase().startsWith(String(v.marca).toLowerCase())) {
      modelo = modelo.substring(String(v.marca).length).trim();
    }
    const mslug = modelo
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (mslug) parts.push(mslug);
  }
  if (v.ano) parts.push(String(v.ano));
  if (v.placa) {
    const pslug = maskPlate(v.placa).toLowerCase();
    if (pslug) parts.push(pslug);
  }
  if (v.id) parts.push(String(v.id));
  return parts.join("-");
}
function carUrl(v) {
  if (!v.id) return `${SITE}/seminovos`;
  return `${SITE}/veiculo/${encodeURI(vehicleSlug(v))}`;
}
function carCard(v) {
  const marca = titleCase(v.marca);
  const modelo = `${marca} ${titleCase(v.modelo)}`.replace(/\s+/g, " ").trim();
  const ano =
    v.ano_fabricacao && v.ano && Number(v.ano_fabricacao) !== Number(v.ano)
      ? `${v.ano_fabricacao}/${v.ano}`
      : `${v.ano || ""}`;
  return {
    modelo,
    ano: ano.trim(),
    km: v.km > 0 ? `${v.km.toLocaleString("pt-BR")} km` : "",
    preco: v.valor > 0 ? cleanPrice(v.valor_formatado) || brl(v.valor) : "",
    cambio: v.cambio ? titleCase(v.cambio) : undefined,
    combustivel: v.combustivel || undefined,
    destaque: v.destaque || undefined,
    url: carUrl(v),
    img: imgUrl(v.capa),
  };
}
// Seleciona até n carros que batem o filtro, priorizando com foto e menor km.
function featuredCars(list, pred, n = FEATURED) {
  const arr = list.filter(pred).slice();
  arr.sort((a, b) => {
    const ia = a.capa ? 0 : 1;
    const ib = b.capa ? 0 : 1;
    if (ia !== ib) return ia - ib;
    return (a.km || 1e12) - (b.km || 1e12);
  });
  return arr.slice(0, n).map(carCard);
}
const sameMarca = (name) => (v) => v.marca.toLowerCase() === String(name).toLowerCase();
const sameCategoria = (name) => (v) => v.categoria.toLowerCase() === String(name).toLowerCase();
const isAuto = (v) => /autom/i.test(v.cambio);

// ---------- Persuasão (honesta) reutilizável ----------

const URGENCIA = [
  "Estoque de seminovo é rotativo: o exemplar que está na vitrine hoje pode ter dono amanhã. Se algum te interessou, vale checar a disponibilidade antes de vir.",
  "Carro bom com procedência e preço justo raramente fica parado. Quando achar o seu, confirme se ainda está disponível pelo WhatsApp.",
  "Os modelos com selo costumam ser os primeiros a sair. Vale garantir o test drive antes que vire história.",
];
const AUTORIDADE =
  "Cada carro da Netcar passa pela Fábrica de Valor: mais de 60 itens conferidos, laudo e revisão antes de ir pra vitrine. Você compra com respaldo, não no escuro.";

// Bloco de financiamento com a oferta REAL — leve, não panfleto.
const FINANCE_BULLETS = [
  "Parcelas em 24x, 36x, 48x ou 60x",
  "Primeira parcela só para 60 dias",
  "Entrada de 20% a 30%, que dá pra dividir em até 10x sem juros",
  "Opção de financiar pelo cartão de crédito em até 24x",
  "Seu usado avaliado na troca como parte do pagamento",
];
function financeSections(seed) {
  const lead = pick(
    [
      "E se for financiar, a conta não precisa assustar. Na Netcar dá pra simular pelo WhatsApp e já chegar sabendo a parcela:",
      "Quer dividir? As condições são diretas, sem letra miúda:",
      "Pra quem vai financiar, vale conhecer as opções antes de decidir:",
    ],
    seed + "fin"
  );
  return [
    H2("Se for financiar"),
    P(lead),
    UL(FINANCE_BULLETS),
    P("Tudo mediante análise de crédito — simule com seus dados reais para receber a parcela certa antes de visitar a loja."),
  ];
}
// Recomendação editorial: carros entram aqui, com um lead contextual + nudge.
function recomendaSection(cars, lead, seed) {
  if (!cars.length) return [];
  const titulo = pick(
    [
      "A recomendação da nossa equipe",
      "O que vale o seu test drive agora",
      "Selecionados a dedo pra essa pauta",
      "Direto da nossa vitrine — enquanto durar",
    ],
    seed + "rec"
  );
  const out = [H2(titulo)];
  if (lead) out.push(P(lead));
  out.push(CARS(cars));
  out.push(P(pick(URGENCIA, seed + "urg")));
  return out;
}

// ---------- Pool de temas ----------

function temaMarca(name, stock, priority) {
  const m = titleCase(name);
  const slug = slugify(`${m} usado em esteio vale a pena ${YEAR}`);
  const cars = featuredCars(stock.cars, sameMarca(name));
  const selos = [...new Set(cars.map((c) => c.destaque).filter(Boolean))].slice(0, 2);

  const title = pick(
    [
      `${m} usado em Esteio vale a pena em ${YEAR}?`,
      `Comprar ${m} seminovo em Esteio: o guia honesto de ${YEAR}`,
      `${m} seminovo: o que ninguém te conta antes de comprar`,
    ],
    slug
  );
  const description = `Guia de quem entende: o que pesa de verdade num ${m} usado em Esteio e região, faixas de preço, financiamento — e os ${m} que valem o test drive agora na Netcar.`;

  const intro = pick(
    [
      `Procurar um ${m} usado na região de Porto Alegre é fácil; achar um ${m} com procedência e preço que faça sentido é outra história. Como quem vê dezenas passarem pela loja toda semana, a gente te conta onde olhar.`,
      `Tem ${m} pra todo gosto rodando por aí — e justamente por isso aparece muito anúncio que esconde problema. Esse guia é o atalho pra você não cair em furada.`,
      `Se o ${m} está na sua lista, senta que esse texto vale a leitura: o que checar, quanto custa hoje e quais ${m} a gente tem prontos pra rodar — sem enrolação.`,
    ],
    slug
  );

  const porque = pick(
    [
      `Quem escolhe ${m} normalmente quer um carro que não dá dor de cabeça: peça acessível, mecânico em qualquer esquina e boa revenda. No usado é onde isso mais pesa no bolso.`,
      `O ${m} é um dos mais procurados de quem compra usado na região — e procura alta significa preço estável e revenda rápida no dia em que você quiser trocar de novo.`,
      `Robustez, economia ou revenda: cada um tem seu motivo pra preferir ${m}. No seminovo, todos eles continuam valendo — desde que o exemplar tenha história limpa.`,
    ],
    slug + "porque"
  );

  const recLead = pick(
    [
      `Pra sair da teoria: estes ${m} estão revisados e prontos no nosso pátio agora. Clique pra ver foto, ficha e preço do dia.`,
      `Em vez de tabela genérica, comece pelo que existe de verdade. Estes ${m} passaram pela nossa conferência e estão disponíveis:`,
    ],
    slug + "reclead"
  );

  const sections = [
    P(intro),
    H2(`Por que um ${m} usado faz sentido`),
    P(porque),
    P(AUTORIDADE),
    ...recomendaSection(cars, recLead, slug),
    H2("Na hora de avaliar, não deixe passar"),
    UL([
      "Histórico de manutenção e procedência (peça o laudo)",
      "Motor, câmbio e suspensão sem ruído ou vazamento",
      "Quilometragem coerente com o ano",
      "Documentação em dia, sem restrição",
      "Test drive em velocidades diferentes",
    ]),
  ];

  if (selos.length) {
    sections.push(
      P(`Vários dos nossos ${m} chegam com selos como ${selos.join(" e ")} — não é enfeite: é carro escolhido a dedo e que costuma sair rápido.`)
    );
  }

  sections.push(
    H2(`Quanto custa um ${m} seminovo hoje`),
    P(
      `O valor varia por modelo, ano e versão. No estoque atual da Netcar os seminovos vão de ${brl(stock.minPrice)} a ${brl(
        stock.maxPrice
      )} entre todas as marcas — e os ${m} costumam ter saída rápida, então o preço do dia é o que vale.`
    ),
    ...financeSections(slug),
    H2("Veredito"),
    P(
      pick(
        [
          `Um ${m} usado vale a pena quando vem com procedência, revisão e condições claras — e é exatamente assim que ele sai da Netcar. Veja os ${m} disponíveis antes que o seu favorito ache outro dono.`,
          `No fim, o bom ${m} não é o mais barato do anúncio: é o que tem histórico, revisão e respaldo. Na Netcar você encontra os dois — confira o estoque enquanto está fresco.`,
        ],
        slug + "ver"
      )
    )
  );

  return {
    priority,
    slug,
    title,
    description,
    readMinutes: 6,
    sections,
    ctaLabel: `Ver ${m} no estoque`,
    ctaHref: `/comprar-${slugify(name)}`,
  };
}

function temaCategoria(name, stock, priority) {
  const c = name;
  const cl = name.toLowerCase();
  const slug = slugify(`melhor ${cl} seminovo esteio ${YEAR}`);
  const cars = featuredCars(stock.cars, sameCategoria(name));

  const title = pick(
    [
      `Melhor ${cl} seminovo para a família em Esteio (${YEAR})`,
      `Como escolher um ${cl} seminovo em Esteio sem se arrepender (${YEAR})`,
      `${titleCase(cl)} seminovo: o que olhar antes de assinar (${YEAR})`,
    ],
    slug
  );
  const description = `Guia honesto para escolher um ${cl} seminovo com bom custo-benefício em Esteio e região — espaço, consumo, manutenção e os ${cl} que valem o test drive na Netcar.`;

  const intro = pick(
    [
      `O ${cl} é a categoria preferida de quem precisa de espaço sem abrir mão de conforto. Mas tem detalhe que separa o ${cl} que vale a pena do que vira dor de cabeça — e é nisso que a gente entra.`,
      `Decidiu que o próximo carro vai ser um ${cl}? Ótima escolha. Agora vem a parte difícil: escolher o certo. Veja o que realmente importa num ${cl} usado.`,
    ],
    slug
  );

  const recLead = pick(
    [
      `Antes da teoria, olhe o que já está no pátio — revisado e com preço do dia:`,
      `Pra deixar concreto: estes ${cl} passaram pela nossa conferência e estão disponíveis agora.`,
    ],
    slug + "reclead"
  );

  const sections = [
    P(intro),
    H2(`Por que tanta gente escolhe um ${cl}`),
    P(
      `O ${cl} combina porta-malas, conforto de viagem e robustez no dia a dia. É uma das categorias que mais saem na Netcar — e procura alta costuma significar boa revenda lá na frente.`
    ),
    P(AUTORIDADE),
    ...recomendaSection(cars, recLead, slug),
    H2(`O que olhar num ${cl} usado`),
    UL([
      "Consumo real de combustível",
      "Custo de manutenção e preço de peças",
      "Estado de pneus, freios e suspensão",
      "Histórico de revisões e procedência",
      "Espaço interno e porta-malas pra sua rotina",
    ]),
    H2("Automático ou manual?"),
    P(
      `A maioria dos ${cl} seminovos hoje é automática — ajuda no trânsito e valoriza na revenda. O manual aparece nas versões de entrada e sai um pouco mais barato.`
    ),
    H2("Faixas de preço"),
    P(
      `No estoque atual os valores vão de ${brl(stock.minPrice)} a ${brl(
        stock.maxPrice
      )}. A maior parte fica na faixa intermediária, onde costuma estar o melhor custo-benefício.`
    ),
    ...financeSections(slug),
    H2("Veredito"),
    P(
      `O melhor ${cl} é o que cabe no orçamento, tem procedência e foi revisado antes da venda. Veja os ${cl} da Netcar e agende um test drive antes que o seu favorito saia.`
    ),
  ];

  return {
    priority,
    slug,
    title,
    description,
    readMinutes: 6,
    sections,
    ctaLabel: `Ver ${cl} no estoque`,
    ctaHref: `/comprar-${slugify(c)}`,
  };
}

function temaPrecos(stock, priority) {
  const slug = slugify(`quanto custa seminovo esteio ${YEAR}`);
  const cars = featuredCars(stock.cars, (v) => v.valor > 0);
  return {
    priority,
    slug,
    title: `Quanto custa um seminovo em Esteio em ${YEAR}? (preços reais)`,
    description: `Faixas de preço reais de seminovos em Esteio, do carro de entrada ao SUV. Veja quanto custa, exemplos do estoque e como financiar na Netcar.`,
    readMinutes: 5,
    sections: [
      P(
        `"Quanto custa um seminovo?" é a primeira pergunta de quem vai trocar de carro — e a resposta honesta não vem de tabela genérica, vem do estoque real de uma loja da região. Então vamos aos números de verdade.`
      ),
      H2("Faixas de preço no estoque agora"),
      P(
        `Na Netcar, em Esteio, os seminovos disponíveis vão de ${brl(stock.minPrice)} a ${brl(
          stock.maxPrice
        )}. A maior parte está na faixa intermediária — geralmente onde mora o melhor custo-benefício.`
      ),
      P(AUTORIDADE),
      ...recomendaSection(
        cars,
        "Pra você ver na prática o que esse valor compra hoje:",
        slug
      ),
      H2("O que faz o preço variar"),
      P(
        "Ano e quilometragem pesam, mas procedência, histórico de manutenção, número de donos e a preparação do veículo influenciam tanto o valor quanto o risco. Barato sem história costuma sair caro depois."
      ),
      ...financeSections(slug),
      H2("Veredito"),
      P(
        "Há opção pra cada orçamento — e o estoque muda toda semana. Veja os preços atualizados e fale com um consultor antes que a faixa que te interessa mude."
      ),
    ],
    ctaLabel: "Ver estoque com preços",
    ctaHref: "/seminovos",
  };
}

function temaChecklist(stock, priority) {
  const slug = slugify("checklist comprar seminovo o que verificar");
  const cars = featuredCars(stock.cars, (v) => v.valor > 0);
  return {
    priority,
    slug,
    title: "Checklist: 10 itens para conferir antes de comprar um seminovo",
    description:
      "Os 10 pontos que separam um bom negócio de uma dor de cabeça na compra de usado. Guia prático da Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P(
        "Comprar seminovo de particular tem risco real — e o barato costuma sair caro. Esse checklist reúne os 10 itens pra conferir antes de fechar negócio, e mostra por que comprar de uma revenda preparada resolve a maior parte deles de antemão."
      ),
      H2("Documentação e histórico"),
      UL(["Documento sem restrição e multas", "Histórico de donos e procedência", "Chassi batendo com o documento"]),
      H2("Mecânica"),
      UL(["Motor sem ruído ou vazamento", "Câmbio engatando suave", "Suspensão sem barulho"]),
      H2("Estrutura e segurança"),
      UL([
        "Lataria e pintura sem batida mal reparada",
        "Pneus e freios em bom estado",
        "Airbag, ABS e cintos funcionando",
        "Test drive em diferentes velocidades",
      ]),
      H2("O atalho: comprar de quem já fez o checklist"),
      P(AUTORIDADE),
      ...recomendaSection(
        cars,
        "Estes, por exemplo, já passaram por tudo isso e estão prontos:",
        slug
      ),
      H2("Veredito"),
      P("Carro revisado, documentação limpa e respaldo de loja: é isso que separa economia de prejuízo. Veja o estoque revisado da Netcar."),
    ],
    ctaLabel: "Ver estoque revisado",
    ctaHref: "/seminovos",
  };
}

function temaTroca(priority) {
  const slug = slugify("vender carro usado ou dar na troca");
  return {
    priority,
    slug,
    title: "Vender o usado por conta própria ou dar na troca? A conta real",
    description:
      "Quanto você recebe, tempo, risco e burocracia: a comparação honesta entre vender seu carro sozinho e dar na troca. Avalie na Netcar.",
    readMinutes: 5,
    sections: [
      P("Vender o usado sozinho pra tentar tirar mais, ou dar na troca e resolver de uma vez? Os dois têm prós — e o que decide é quanto você valoriza tempo e tranquilidade."),
      H2("Quanto você realmente recebe"),
      P(
        "A venda particular pode render um pouco mais no papel, mas custa tempo, anúncios, estranhos no seu carro e risco na transferência. A troca entrega praticidade e abate na hora do próximo — e o valor pode entrar como parte da entrada."
      ),
      H2("Tempo, risco e burocracia"),
      UL([
        "Particular: anúncios, contatos, test drives com desconhecidos e transferência por sua conta",
        "Troca: avaliação na loja, sem exposição, documentação conduzida pela revenda",
      ]),
      H2("Carro financiado dá pra trocar?"),
      P("Dá. A revenda calcula a quitação do saldo e o valor líquido entra como parte do pagamento no seminovo escolhido. Menos dor de cabeça, tudo numa negociação só."),
      H2("Veredito"),
      P("Se você valoriza tempo e segurança — ou já achou o próximo carro — a troca quase sempre compensa. Traga seu usado pra uma avaliação sem compromisso na Netcar."),
    ],
    ctaLabel: "Avaliar meu carro",
    ctaHref: "/compra",
  };
}

function temaAutomatico(stock, priority) {
  const slug = slugify("cambio automatico vale a pena seminovo");
  const cars = featuredCars(stock.cars, isAuto);
  return {
    priority,
    slug,
    title: "Câmbio automático vale a pena num seminovo? Sem achismo",
    description:
      "Automático x manual num usado: consumo, manutenção, revenda e conforto, sem achismo. Veja automáticos revisados no estoque da Netcar.",
    readMinutes: 5,
    sections: [
      P("O automático dominou o mercado, mas num seminovo a decisão tem nuances de custo e manutenção que ninguém comenta no anúncio. Vamos ao que pesa de verdade."),
      H2("Vantagens do automático"),
      UL(["Mais conforto no trânsito de cidade", "Melhor valor de revenda", "Tendência de mercado — mais procura, sai mais rápido"]),
      H2("Quando o manual ainda compensa"),
      UL(["Preço de compra menor", "Manutenção geralmente mais barata", "Versões de entrada mais acessíveis"]),
      H2("Manutenção: o ponto que separa o joio do trigo"),
      P(
        "No usado, o segredo é o histórico do câmbio automático (trocas de óleo em dia). Um automático bem cuidado é tão confiável quanto o manual — e a preparação da loja é o que te dá essa garantia."
      ),
      P(AUTORIDADE),
      ...recomendaSection(
        cars,
        "Estes automáticos já passaram pela nossa conferência e estão prontos:",
        slug
      ),
      H2("Veredito"),
      P("Se você roda muito em cidade e pensa na revenda, o automático compensa. Veja os automáticos revisados na Netcar antes que saiam."),
    ],
    ctaLabel: "Ver automáticos",
    ctaHref: "/seminovos-automaticos",
  };
}

function temaPrimeiroCarro(stock, priority) {
  const slug = slugify("melhor primeiro carro seminovo esteio");
  const baratos = stock.cars
    .filter((v) => v.valor > 0)
    .slice()
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 6);
  const cars = featuredCars(baratos, () => true);
  return {
    priority,
    slug,
    title: "Qual o melhor primeiro carro seminovo pra começar bem?",
    description:
      "Guia pro primeiro carro: modelos econômicos, baratos de manter e seguros. Veja opções de entrada no estoque da Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P("O primeiro carro precisa ser econômico, barato de manter e fácil de revender — porque dali a pouco vem a próxima troca. Veja como escolher um bom seminovo pra começar sem comprometer o orçamento."),
      H2("O que priorizar no primeiro carro"),
      UL([
        "Consumo baixo de combustível",
        "Seguro e manutenção acessíveis",
        "Peças fáceis de encontrar",
        "Boa revenda pra próxima troca",
      ]),
      H2("Hatch é a melhor porta de entrada"),
      P("Compactos são mais baratos pra comprar, abastecer e estacionar — ideais pra quem está começando a dirigir e não quer susto no fim do mês."),
      ...recomendaSection(
        cars,
        "Estes são alguns dos mais em conta no nosso estoque agora — bons candidatos a primeiro carro:",
        slug
      ),
      ...financeSections(slug),
      H2("Veredito"),
      P("O melhor primeiro carro é o econômico e revisado, com parcela que cabe no bolso. Veja as opções de entrada na Netcar enquanto ainda estão disponíveis."),
    ],
    ctaLabel: "Ver estoque",
    ctaHref: "/seminovos",
  };
}

function buildPool(stock) {
  const pool = [];
  let p = 100;
  pool.push(temaPrecos(stock, p++));
  pool.push(temaChecklist(stock, p++));
  if (stock.topMarca) pool.push(temaMarca(stock.topMarca.name, stock, p++));
  if (stock.topCategoria) pool.push(temaCategoria(stock.topCategoria.name, stock, p++));
  pool.push(temaPrimeiroCarro(stock, p++));
  pool.push(temaTroca(p++));
  pool.push(temaAutomatico(stock, p++));
  for (const [name] of stock.marcas.slice(1)) {
    pool.push(temaMarca(name, stock, p++));
  }
  for (const [name] of stock.categorias.slice(1)) {
    pool.push(temaCategoria(name, stock, p++));
  }
  const bySlug = new Map();
  for (const t of pool.sort((a, b) => a.priority - b.priority)) {
    if (!bySlug.has(t.slug)) bySlug.set(t.slug, t);
  }
  return [...bySlug.values()];
}

async function fetchStock() {
  const res = await fetch(API_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) throw new Error("resposta inválida");
  const v = json.data.filter((x) => Number(x.valor) > 0);
  const tally = (field) => {
    const m = new Map();
    for (const x of v) {
      const k = (x[field] || "").trim();
      if (k) m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const prices = v.map((x) => Number(x.valor)).filter((n) => n > 0);
  const marcas = tally("marca").filter(([, c]) => c >= 3);
  const categorias = tally("categoria").filter(([, c]) => c >= 3);
  const cars = v.map((x) => ({
    id: x.id,
    placa: x.placa,
    marca: (x.marca || "").trim(),
    modelo: (x.modelo || "").trim(),
    ano: x.ano,
    ano_fabricacao: x.ano_fabricacao,
    valor: Number(x.valor) || 0,
    valor_formatado: x.valor_formatado,
    km: Number(x.km) || 0,
    cambio: (x.cambio || "").trim(),
    combustivel: (x.combustivel || "").trim(),
    categoria: (x.categoria || "").trim(),
    capa: (x.imagens_site && (x.imagens_site.capa || x.imagens_site.capa_opengraph)) || null,
    destaque:
      Array.isArray(x.diferenciais) && x.diferenciais[0] ? x.diferenciais[0].descricao : null,
  }));
  return {
    total: v.length,
    minPrice: prices.length ? Math.min(...prices) : 30000,
    maxPrice: prices.length ? Math.max(...prices) : 150000,
    marcas,
    categorias,
    cars,
    topMarca: marcas[0] ? { name: marcas[0][0], count: marcas[0][1] } : null,
    topCategoria: categorias[0] ? { name: categorias[0][0], count: categorias[0][1] } : null,
  };
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return fallback;
  }
}

async function main() {
  let stock;
  try {
    stock = await fetchStock();
  } catch (err) {
    console.warn(`Aviso: API indisponível (${err.message}). blog-auto.json mantido.`);
    return;
  }

  const manualSlugs = new Set(readJson(MANUAL, []).map((p) => p.slug));
  const existing = readJson(OUT, []);
  const existingBySlug = new Map(existing.map((p) => [p.slug, p]));

  const pool = buildPool(stock).filter((t) => !manualSlugs.has(t.slug));

  const finalize = (tema, publishedAt) => ({
    slug: tema.slug,
    title: tema.title,
    description: tema.description,
    publishedAt,
    readMinutes: tema.readMinutes,
    sections: tema.sections,
    ctaLabel: tema.ctaLabel,
    ctaHref: tema.ctaHref,
  });

  const out = [];

  if (existing.length === 0) {
    pool.slice(0, INITIAL_BATCH).forEach((tema, i) => {
      out.push(finalize(tema, daysAgo(i * 4)));
    });
    console.log(`Primeira execução: ${out.length} posts iniciais.`);
  } else {
    let added = 0;
    for (const tema of pool) {
      if (existingBySlug.has(tema.slug)) {
        out.push(finalize(tema, existingBySlug.get(tema.slug).publishedAt));
      } else if (added < MAX_NEW_PER_RUN) {
        out.push(finalize(tema, today()));
        added++;
      }
    }
    console.log(`Rodada: ${added} tema(s) novo(s) publicado(s), ${out.length} no total.`);
  }

  out.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const json = JSON.stringify(out, null, 2) + "\n";
  const wrote = writeTextFile(OUT, json);
  const pendentes = pool.length - out.length;
  console.log(
    `Blog: ${out.length} publicados | ${pendentes} pauta(s) na fila | estoque ${stock.total}${wrote ? "" : " (sem alteração no arquivo)"}.`
  );
}

main().catch((err) => {
  console.error("Erro ao gerar blog:", err);
  process.exit(0);
});
