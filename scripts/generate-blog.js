#!/usr/bin/env node

/**
 * AUTOMAÇÃO DE BLOG — publica automaticamente, com ROTAÇÃO e ACÚMULO.
 *
 * Pool grande de pautas (uma por marca, uma por categoria + perenes). A cada
 * execução:
 *   - Mantém todos os posts já publicados (não some nada) e ATUALIZA os dados
 *     dinâmicos deles (preços, carros em destaque, contagem do estoque).
 *   - Publica os PRÓXIMOS temas ainda não usados, com data de hoje.
 *
 * Cada matéria tem cara editorial (ângulo/abertura/veredito variam por pauta,
 * de forma determinística pelo slug — não muda a cada rodada) e EMBUTE carros
 * reais do estoque como propaganda (cards com foto, preço e link pro veículo).
 *
 * Primeira execução (sem histórico): publica um lote inicial com datas
 * escalonadas. Depois, cada rodada semanal adiciona MAX_NEW_PER_RUN tema(s).
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

// Quantos temas novos publicar por execução (depois do lote inicial).
const MAX_NEW_PER_RUN = 1;
// Tamanho do lote inicial quando ainda não há histórico.
const INITIAL_BATCH = 6;

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
function carUrl(link) {
  if (!link) return `${SITE}/seminovos`;
  return `${SITE}/${encodeURI(String(link).replace(/^\//, ""))}`;
}
// valor_formatado da API pode vir com HTML (<span>R$</span>) — tira tags.
function cleanPrice(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
    url: carUrl(v.link),
    img: imgUrl(v.capa),
  };
}
// Seleciona até n carros que batem o filtro, priorizando com foto e menor km.
function featuredCars(list, pred, n = 3) {
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

// Bloco de financiamento com a oferta REAL (sem promessa de "sem entrada").
const FINANCE_BULLETS = [
  "Financiamento em 24x, 36x, 48x ou 60x",
  "Primeira parcela para 60 dias",
  "Entrada de 20% a 30%, parcelável em até 10x sem juros",
  "Financiamento também pelo cartão de crédito em até 24x",
  "Avaliamos seu usado na troca como parte do pagamento",
];
function financeSections(seed) {
  const lead = pick(
    [
      "Antes de escolher, vale entender como fica a conta. Na Netcar você simula pelo WhatsApp e já chega à loja sabendo a parcela:",
      "A parte do dinheiro costuma travar a decisão — então aqui vai sem rodeio. As condições na Netcar:",
      "Financiar não precisa ser um bicho de sete cabeças. Na prática, funciona assim:",
    ],
    seed + "fin"
  );
  return [
    H2("Como fica o financiamento"),
    P(lead),
    UL(FINANCE_BULLETS),
    P("Tudo mediante análise de crédito. Simule com seus dados reais para receber a parcela exata antes de visitar a loja."),
  ];
}
function carsSection(cars, seed) {
  if (!cars.length) return [];
  const titulo = pick(
    ["No nosso pátio agora", "Direto da vitrine da Netcar", "Pra você já ir olhando", "Opções reais no estoque hoje"],
    seed + "cars"
  );
  return [H2(titulo), CARS(cars)];
}

// ---------- Pool de temas ----------
// Cada tema retorna {slug,title,description,readMinutes,sections,ctaLabel,ctaHref,priority}.

function temaMarca(name, stock, priority) {
  const m = titleCase(name);
  const slug = slugify(`${m} usado em esteio vale a pena ${YEAR}`);
  const cars = featuredCars(stock.cars, sameMarca(name), 3);
  const selos = [...new Set(cars.map((c) => c.destaque).filter(Boolean))].slice(0, 3);
  const angle = hashStr(slug) % 2;

  const title = pick(
    [
      `${m} usado em Esteio vale a pena em ${YEAR}?`,
      `Comprar ${m} seminovo em Esteio: o que pesar em ${YEAR}`,
    ],
    slug
  );
  const description = `Guia direto para quem procura ${m} seminovo em Esteio e região: o que olhar, faixas de preço, financiamento e os ${m} disponíveis agora na Netcar.`;

  const intro = pick(
    [
      `Procurar um ${m} usado na região de Porto Alegre é fácil; achar um ${m} com procedência e preço justo é que separa o bom negócio da dor de cabeça. Esse guia vai direto ao ponto.`,
      `O ${m} é um dos carros que mais saem por aqui — e justamente por isso aparece muito anúncio duvidoso. Veja como escolher um ${m} seminovo sem cair em furada.`,
      `Se o ${m} está na sua lista, este texto é pra você: o que checar, quanto custa e quais ${m} a Netcar tem prontos pra rodar agora em Esteio.`,
    ],
    slug
  );

  const sections = [P(intro)];

  if (angle === 0) {
    sections.push(
      H2(`Por que o ${m} é uma aposta segura no usado`),
      P(
        `Peças acessíveis, rede de assistência ampla e boa revenda fazem do ${m} um dos preferidos de quem compra seminovo no Rio Grande do Sul. Na prática, isso significa menos surpresa no bolso e mais facilidade na hora de vender depois.`
      ),
      ...carsSection(cars, slug),
      H2(`O que conferir antes de fechar`),
      UL([
        "Histórico de manutenção e procedência (peça o laudo)",
        "Motor, câmbio e suspensão sem ruído ou vazamento",
        "Quilometragem coerente com o ano",
        "Documentação em dia, sem restrição",
        "Lataria e pintura sem sinal de batida mal reparada",
      ])
    );
  } else {
    sections.push(
      H2(`Os ${m} que separamos pra você`),
      P(
        `Em vez de teoria, comece pelo que existe de verdade no pátio. Estes ${m} estão revisados e prontos — clique pra ver fotos, ficha e preço atualizado:`
      ),
      ...(cars.length ? [CARS(cars)] : []),
      H2(`Na hora de avaliar, olhe isto`),
      UL([
        "Estado real de motor e câmbio (test drive ajuda)",
        "Pneus, freios e itens de segurança funcionando",
        "Histórico de revisões e número de donos",
        "Procedência e documentação sem pendência",
      ])
    );
  }

  if (selos.length) {
    sections.push(
      P(`Vários dos nossos ${m} chegam com selos como ${selos.join(", ")} — sinal de carro bem cuidado e escolhido a dedo pela Fábrica de Valor.`)
    );
  }

  sections.push(
    H2(`Quanto custa um ${m} seminovo hoje`),
    P(
      `O valor varia por modelo, ano e versão. No estoque atual da Netcar os seminovos vão de ${brl(stock.minPrice)} a ${brl(
        stock.maxPrice
      )} entre todas as marcas — e os ${m} costumam ter saída rápida, então vale conferir o preço do dia.`
    ),
    ...financeSections(slug),
    H2("Veredito"),
    P(
      pick(
        [
          `Um ${m} usado vale a pena quando vem com procedência, revisão e condições claras — e é exatamente assim que ele sai da Netcar. Veja os ${m} disponíveis e fale com um consultor.`,
          `No fim, o bom ${m} não é o mais barato do anúncio: é o que tem histórico, revisão e respaldo. Na Netcar você encontra os dois. Confira o estoque de ${m}.`,
        ],
        slug
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
  const cars = featuredCars(stock.cars, sameCategoria(name), 3);
  const angle = hashStr(slug) % 2;

  const title = pick(
    [
      `Melhor ${cl} seminovo para famílias em Esteio (${YEAR})`,
      `Como escolher um ${cl} seminovo em Esteio sem errar (${YEAR})`,
    ],
    slug
  );
  const description = `Guia para escolher um ${cl} seminovo com bom custo-benefício em Esteio e região: espaço, consumo, manutenção, faixas de preço e os ${cl} disponíveis na Netcar.`;

  const intro = pick(
    [
      `O ${cl} é uma das categorias preferidas das famílias na região de Esteio. Espaço, conforto e revenda boa — mas tem detalhe que faz diferença na hora de escolher.`,
      `Se você decidiu que o próximo carro vai ser um ${cl}, falta a parte difícil: escolher o certo. Veja o que pesa de verdade num ${cl} seminovo.`,
    ],
    slug
  );

  const sections = [P(intro)];

  if (angle === 0) {
    sections.push(
      H2(`Por que tanta gente escolhe um ${cl}`),
      P(
        `O ${cl} combina porta-malas, conforto de viagem e robustez no dia a dia. É uma das categorias que mais saem na Netcar, com opções de várias marcas e faixas de preço.`
      ),
      ...carsSection(cars, slug),
      H2(`O que olhar num ${cl} usado`),
      UL([
        "Consumo real de combustível",
        "Custo de manutenção e preço de peças",
        "Estado de pneus, freios e suspensão",
        "Histórico de revisões e procedência",
        "Espaço interno e porta-malas para sua rotina",
      ])
    );
  } else {
    sections.push(
      H2(`Comece pelos ${cl} que já temos`),
      P(`Antes da teoria, veja o que está no pátio agora — revisado e com preço atualizado:`),
      ...(cars.length ? [CARS(cars)] : []),
      H2(`Automático ou manual?`),
      P(
        `A maioria dos ${cl} seminovos hoje é automática, o que ajuda no trânsito e valoriza na revenda. O manual aparece em versões de entrada e sai um pouco mais barato.`
      )
    );
  }

  sections.push(
    H2("Faixas de preço"),
    P(
      `No estoque atual os valores vão de ${brl(stock.minPrice)} a ${brl(
        stock.maxPrice
      )}. A maior parte fica na faixa intermediária, onde costuma estar o melhor custo-benefício.`
    ),
    ...financeSections(slug),
    H2("Veredito"),
    P(
      `O melhor ${cl} é o que cabe no orçamento, tem procedência e foi revisado antes da venda. Veja os ${cl} da Netcar e agende um test drive.`
    )
  );

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
  const cars = featuredCars(stock.cars, (v) => v.valor > 0, 3);
  return {
    priority,
    slug,
    title: `Quanto custa um seminovo em Esteio em ${YEAR}?`,
    description: `Faixas de preço reais de seminovos em Esteio: do carro de entrada ao SUV. Veja quanto custa, exemplos do estoque e como financiar na Netcar.`,
    readMinutes: 5,
    sections: [
      P(
        `"Quanto custa um seminovo?" é a primeira pergunta de quem vai trocar de carro. A melhor referência não é tabela genérica — é o estoque real de uma loja da região.`
      ),
      H2("Faixas de preço no estoque atual"),
      P(
        `Na Netcar, em Esteio, os seminovos disponíveis vão de ${brl(stock.minPrice)} a ${brl(
          stock.maxPrice
        )}. A maior parte está na faixa intermediária, onde costuma estar o melhor custo-benefício.`
      ),
      ...carsSection(cars, slug),
      H2("O que faz o preço variar"),
      P(
        "Ano e quilometragem pesam, mas procedência, histórico de manutenção, número de donos e a preparação do veículo influenciam tanto o valor quanto o risco da compra."
      ),
      ...financeSections(slug),
      H2("Veredito"),
      P(
        "Há opção para cada orçamento. Veja o estoque completo da Netcar com preços atualizados e fale com um consultor para simular a parcela."
      ),
    ],
    ctaLabel: "Ver estoque com preços",
    ctaHref: "/seminovos",
  };
}

function temaChecklist(stock, priority) {
  const slug = slugify("checklist comprar seminovo o que verificar");
  const cars = featuredCars(stock.cars, (v) => v.valor > 0, 2);
  return {
    priority,
    slug,
    title: "Checklist: 10 itens para conferir antes de comprar um seminovo",
    description:
      "Os 10 pontos que separam um bom negócio de uma dor de cabeça na compra de usado. Guia prático da Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P(
        "Comprar seminovo de particular tem risco real. Este checklist reúne os 10 itens que você precisa conferir antes de fechar negócio — e por que uma revenda preparada reduz a maior parte deles."
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
      H2("Por que comprar de revenda reduz risco"),
      P(
        "Na Netcar, todo seminovo passa pela Fábrica de Valor com mais de 60 itens verificados, laudo e pós-venda. Boa parte do checklist acima já vem resolvida."
      ),
      ...carsSection(cars, slug),
      H2("Veredito"),
      P("Carro revisado, documentação limpa e respaldo de loja: é isso que separa economia de prejuízo. Veja o estoque revisado da Netcar."),
    ],
    ctaLabel: "Ver estoque revisado",
    ctaHref: "/seminovos",
  };
}

function temaTroca(priority) {
  return {
    priority,
    slug: slugify("vender carro usado ou dar na troca"),
    title: "Vender o usado por conta própria ou dar na troca?",
    description:
      "A conta real entre vender seu carro sozinho e dar na troca: quanto você recebe, tempo, risco e burocracia. Avalie na Netcar.",
    readMinutes: 5,
    sections: [
      P("Vender o usado sozinho para tentar tirar mais, ou dar na troca e resolver de uma vez? Veja a conta real de cada caminho."),
      H2("Quanto você realmente recebe"),
      P(
        "A venda particular pode render um pouco mais, mas custa tempo, anúncios e risco. A troca entrega praticidade e abate na hora do próximo carro — e o valor pode entrar como parte da entrada."
      ),
      H2("Tempo, risco e burocracia"),
      UL([
        "Particular: anúncios, contatos e transferência por sua conta",
        "Troca: avaliação na loja, sem exposição, documentação conduzida pela revenda",
      ]),
      H2("Carro financiado dá para trocar?"),
      P("Sim. A revenda calcula a quitação do saldo e o valor líquido entra como parte do pagamento no seminovo escolhido."),
      H2("Veredito"),
      P("Se você valoriza tempo e segurança — ou já achou o próximo carro — a troca compensa. Avalie seu usado na Netcar sem compromisso."),
    ],
    ctaLabel: "Avaliar meu carro",
    ctaHref: "/compra",
  };
}

function temaAutomatico(stock, priority) {
  const slug = slugify("cambio automatico vale a pena seminovo");
  const cars = featuredCars(stock.cars, isAuto, 3);
  return {
    priority,
    slug,
    title: "Câmbio automático vale a pena num seminovo?",
    description:
      "Automático x manual num carro usado: consumo, manutenção, revenda e conforto. Veja exemplos automáticos no estoque da Netcar.",
    readMinutes: 5,
    sections: [
      P("O automático dominou o mercado, mas num seminovo a decisão tem nuances de custo e manutenção. Veja o que pesa de verdade."),
      H2("Vantagens do automático"),
      UL(["Mais conforto no trânsito de cidade", "Melhor valor de revenda", "Tendência de mercado — mais procura"]),
      H2("Quando o manual ainda compensa"),
      UL(["Preço de compra menor", "Manutenção geralmente mais barata", "Versões de entrada mais acessíveis"]),
      ...carsSection(cars, slug),
      H2("Manutenção: o ponto de atenção"),
      P(
        "No usado, verifique o histórico do câmbio automático (trocas de óleo em dia). Um automático bem cuidado é tão confiável quanto o manual — e a preparação da loja ajuda a garantir isso."
      ),
      H2("Veredito"),
      P("Se você roda muito em cidade e pensa na revenda, o automático compensa. Veja os automáticos revisados na Netcar."),
    ],
    ctaLabel: "Ver automáticos",
    ctaHref: "/seminovos-automaticos",
  };
}

function temaPrimeiroCarro(stock, priority) {
  const slug = slugify("melhor primeiro carro seminovo esteio");
  // Mais baratos primeiro (carro de entrada).
  const baratos = stock.cars
    .filter((v) => v.valor > 0)
    .slice()
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 6);
  const cars = featuredCars(baratos, () => true, 3);
  return {
    priority,
    slug,
    title: "Qual o melhor primeiro carro seminovo para começar?",
    description:
      "Guia para o primeiro carro: modelos econômicos, baratos de manter e seguros. Veja opções de entrada no estoque da Netcar, em Esteio/RS.",
    readMinutes: 5,
    sections: [
      P("O primeiro carro precisa ser econômico, barato de manter e fácil de revender. Veja como escolher um bom seminovo para começar — sem comprometer o orçamento."),
      H2("O que priorizar no primeiro carro"),
      UL([
        "Consumo baixo de combustível",
        "Seguro e manutenção acessíveis",
        "Peças fáceis de encontrar",
        "Boa revenda para a próxima troca",
      ]),
      ...carsSection(cars, slug),
      H2("Hatch é a melhor porta de entrada"),
      P("Compactos são mais baratos para comprar, abastecer e estacionar — ideais para quem está começando a dirigir."),
      ...financeSections(slug),
      H2("Veredito"),
      P("O melhor primeiro carro é o econômico e revisado, com parcela que cabe no bolso. Veja as opções de entrada no estoque da Netcar."),
    ],
    ctaLabel: "Ver estoque",
    ctaHref: "/seminovos",
  };
}

function buildPool(stock) {
  const pool = [];
  let p = 100;
  // Perenes de maior valor primeiro
  pool.push(temaPrecos(stock, p++));
  pool.push(temaChecklist(stock, p++));
  // Marca/categoria top entram cedo
  if (stock.topMarca) pool.push(temaMarca(stock.topMarca.name, stock, p++));
  if (stock.topCategoria) pool.push(temaCategoria(stock.topCategoria.name, stock, p++));
  pool.push(temaPrimeiroCarro(stock, p++));
  pool.push(temaTroca(p++));
  pool.push(temaAutomatico(stock, p++));
  // Demais marcas (rotação ao longo das semanas)
  for (const [name] of stock.marcas.slice(1)) {
    pool.push(temaMarca(name, stock, p++));
  }
  // Demais categorias
  for (const [name] of stock.categorias.slice(1)) {
    pool.push(temaCategoria(name, stock, p++));
  }
  // Dedup por slug mantendo menor prioridade
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
    link: x.link,
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
  const existing = readJson(OUT, []); // posts já publicados (com publishedAt)
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
    // Primeira vez: lote inicial com datas escalonadas retroativas
    pool.slice(0, INITIAL_BATCH).forEach((tema, i) => {
      out.push(finalize(tema, daysAgo(i * 4)));
    });
    console.log(`Primeira execução: ${out.length} posts iniciais.`);
  } else {
    let added = 0;
    for (const tema of pool) {
      if (existingBySlug.has(tema.slug)) {
        // Já publicado: mantém data original, atualiza conteúdo (dados frescos)
        out.push(finalize(tema, existingBySlug.get(tema.slug).publishedAt));
      } else if (added < MAX_NEW_PER_RUN) {
        // Novo tema desta rodada
        out.push(finalize(tema, today()));
        added++;
      }
      // demais ficam pendentes para próximas rodadas
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
