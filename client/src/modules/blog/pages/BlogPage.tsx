import { motion } from "framer-motion";
import { ExternalLink, Calendar } from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";

interface NewsItem {
  title: string;
  excerpt: string;
  link: string;
  date: string;
}

const newsItems: NewsItem[] = [
  {
    title: "Nova regra da CNH derruba preços e faz autoescolas venderem pacotes por cerca de R$ 300",
    excerpt: "Com a nova regulamentação, o processo de habilitação ficou mais acessível para os motoristas brasileiros.",
    link: "https://g1.globo.com/carros/noticia/2026/01/19/nova-regra-da-cnh-derruba-precos-e-faz-autoescolas-venderem-pacotes-por-cerca-de-r-300.ghtml",
    date: "19/01/2026"
  },
  {
    title: "Mercedes-AMG GT 63 S: como é dirigir um superesportivo com DNA de Fórmula 1",
    excerpt: "Pilotar um carro com tecnologia de Fórmula 1 nas ruas é uma experiência única.",
    link: "https://g1.globo.com/carros/noticia/2026/01/18/mercedes-amg-gt-63-s-como-e-dirigir-um-superesportivo-com-dna-de-formula-1.ghtml",
    date: "18/01/2026"
  },
  {
    title: "Novo Volkswagen Taos chega ao Brasil a partir de R$ 199.990; veja o que mudou",
    excerpt: "O novo Volkswagen Taos chega ao Brasil com visual reformulado para peitar rivais.",
    link: "https://g1.globo.com/carros/noticia/2026/01/16/volkswagen-taos-2026-preco-ficha-tecnica-versoes.ghtml",
    date: "16/01/2026"
  },
  {
    title: "Maior IPVA do Brasil passa de R$ 1 milhão; veja o mais caro de cada estado",
    excerpt: "Agora que todos os estados divulgaram as informações sobre o IPVA 2026, é possível conhecer os valores mais altos.",
    link: "https://g1.globo.com/carros/noticia/2026/01/16/maior-ipva-do-brasil-passa-de-r-1-milhao-veja-o-mais-caro-de-cada-estado.ghtml",
    date: "16/01/2026"
  },
  {
    title: "Carro Sustentável impulsiona vendas em 15,6% e soma 247 mil veículos em 2025",
    excerpt: "Volkswagen Polo, Fiat Mobi e Renault Kwid estão com desconto de IPI Verde.",
    link: "https://g1.globo.com/carros/noticia/2026/01/15/programa-carro-sustentavel-fez-vendas-aumentarem-156percent-diz-anfavea.ghtml",
    date: "15/01/2026"
  },
  {
    title: "Brasil produz 2,6 milhões de veículos em 2025, alta de 3% no ano",
    excerpt: "O país produziu 2,644 milhões de veículos no último ano.",
    link: "https://g1.globo.com/carros/noticia/2026/01/15/brasil-produz-26-milhoes-de-veiculos-em-2025-alta-3percent-no-ano.ghtml",
    date: "15/01/2026"
  },
  {
    title: "Segunda fábrica de carros da GWM no Brasil deve ser instalada no ES",
    excerpt: "Espírito Santo deve ganhar fábrica de veículos da montadora chinesa GWM.",
    link: "https://g1.globo.com/es/espirito-santo/norte-noroeste-es/noticia/2026/01/14/segunda-fabrica-de-carros-da-gwm-no-brasil-deve-ser-instalada-no-es.ghtml",
    date: "14/01/2026"
  },
  {
    title: "Toyota Yaris Cross ganha versão de entrada XR, que custa R$ 149.990",
    excerpt: "A Toyota anunciou nova versão de entrada do SUV compacto.",
    link: "https://g1.globo.com/carros/noticia/2026/01/14/toyota-yaris-cross-versao-xr.ghtml",
    date: "14/01/2026"
  },
  {
    title: "Strada, Polo, Argo, T-Cross e HB20: veja o ranking dos 5 carros mais vendidos de 2025",
    excerpt: "O Volkswagen Polo ultrapassou as vendas da Fiat Strada em alguns meses.",
    link: "https://g1.globo.com/carros/noticia/2026/01/13/veja-o-ranking-mes-a-mes-dos-5-carros-mais-vendidos-de-2025.ghtml",
    date: "13/01/2026"
  },
  {
    title: "Venda de veículos novos no Brasil tem alta de 2% em 2025",
    excerpt: "Resultado ficou abaixo da projeção do setor automotivo.",
    link: "https://g1.globo.com/carros/noticia/2026/01/13/venda-de-veiculos-novos-2026.ghtml",
    date: "13/01/2026"
  },
  {
    title: "Uber Black e Comfort têm nova lista de carros para 2026",
    excerpt: "Veja as regras e modelos permitidos para o aplicativo.",
    link: "https://g1.globo.com/carros/noticia/2026/01/13/uber-black-e-comfort-tem-nova-lista-de-carros-para-2026.ghtml",
    date: "13/01/2026"
  },
  {
    title: "Vai pagar IPVA em 2026? Confira calendário e possíveis descontos",
    excerpt: "Calendário do IPVA que pode ser pago em até 10 parcelas em 2026 em alguns estados.",
    link: "https://g1.globo.com/carros/noticia/2026/01/11/ipva-2026-confira-calendario-e-possiveis-descontos.ghtml",
    date: "11/01/2026"
  }
];

export function BlogPage() {
  useDefaultMetaTags(
    "Notícias",
    "Fique por dentro das últimas novidades do mundo automotivo. Notícias, lançamentos e tendências do mercado de carros."
  );

  return (
    <main className="flex-1 pt-8 pb-16 overflow-x-hidden max-w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-fg mb-2">Notícias</h1>
          <p className="text-gray-500">Últimas novidades do mundo automotivo</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsItems.map((item, index) => (
            <motion.a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{item.date}</span>
                </div>
                
                <h3 className="text-fg font-semibold text-base leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-3">
                  {item.title}
                </h3>
                
                <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-4">
                  {item.excerpt}
                </p>
                
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium">
                  <span>Ler mais</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </main>
  );
}
