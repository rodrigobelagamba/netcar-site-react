# Linha de base orgânica — extraída em 26/07/2026

Dados **medidos** no Search Console: 28 dias, tipo Web, propriedade
netcarmultimarcas.com.br. Metodologia e revisões em
[REGIONAL-SEO-MEASUREMENT.md](REGIONAL-SEO-MEASUREMENT.md).

Extração feita **no mesmo dia do deploy** que corrigiu o loop de 302 das fichas,
o sitemap sem veículos e os soft 404 de legado (ver
[SEO-RESPOSTAS-CRAWLER.md](SEO-RESPOSTAS-CRAWLER.md)). Ou seja: estes números são
o "antes" e ainda não refletem nenhuma das correções.

## Páginas de cidade

| Página | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| /seminovos-porto-alegre | 5 | 720 | 0,7% | 4,3 |
| /seminovos-cachoeirinha | 0 | 704 | 0% | 1,6 |
| /seminovos-campo-bom | 1 | 450 | 0,2% | 3,8 |
| /seminovos-novo-hamburgo | 1 | 413 | 0,2% | 1,5 |
| /seminovos-viamao | 1 | 375 | 0,3% | 4,4 |
| /seminovos-canoas | 2 | 352 | 0,6% | 3,1 |
| /seminovos-estancia-velha | 2 | 270 | 0,7% | 2,8 |
| /seminovos-sao-leopoldo | 1 | 183 | 0,5% | 4,6 |
| /seminovos-alvorada | 0 | 104 | 0% | 5,1 |
| /seminovos-gravatai | 0 | 83 | 0% | 5,3 |
| /seminovos-taquara | 0 | 65 | 0% | 5,6 |
| /seminovos-guaiba | 1 | 47 | 2,1% | 7,9 |
| /regioes-atendidas | 0 | 30 | 0% | 5,3 |
| /seminovos-montenegro | 0 | 19 | 0% | 8,4 |
| /seminovos-sapucaia-do-sul | 0 | 15 | 0% | 4,8 |
| /seminovos-bento-goncalves | 0 | 15 | 0% | 8,6 |
| /seminovos-igrejinha | 0 | 15 | 0% | 9,8 |
| /seminovos-automaticos | 0 | 14 | 0% | 4,9 |
| /seminovos-gramado | 0 | 13 | 0% | 8,8 |
| /seminovos-caxias-do-sul | 0 | 12 | 0% | 14,1 |

**Conjunto `seminovos-`: 15 cliques, 4.010 impressões, CTR 0,4%, posição 3,6.**

## Blog

| Página | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| /blog/seminovos-em-esteio-guia-completo | 0 | 115 | 0% | 7,2 |
| /blog/seminovos-vale-dos-sinos-como-comparar | 0 | 20 | 0% | 6,9 |
| /blog/seminovos-vale-do-cai-procedencia-2026 | 0 | 4 | 0% | 11,0 |
| /blog/seminovos-grande-porto-alegre-estoque-e-procedencia-2026 | 0 | 2 | 0% | 4,0 |
| /blog/seminovos-paranhana-igrejinha-taquara-2026 | 1 | 1 | 100% | 16,0 |

## Consultas por cidade

Filtro por consulta que contém o nome da cidade.

| Cidade | Cliques | Impressões | CTR | Posição |
|---|---:|---:|---:|---:|
| esteio | 170 | 1.100 | 15,4% | 3,4 |
| sapucaia | 3 | 41 | 7,3% | 4,5 |
| são leopoldo | 0 | 13 | 0% | 25,8 |
| gravataí | 0 | 6 | 0% | 25,2 |
| canoas | 1 | 5 | 20% | 55,6 |
| porto alegre | 1 | 4 | 25% | 20,8 |
| novo hamburgo | 0 | 0 | — | — |
| cachoeirinha | 0 | 0 | — | — |
| campo bom | 0 | 0 | — | — |
| estância velha | 0 | 0 | — | — |

As 9 cidades restantes (Alvorada, Viamão, Guaíba, Montenegro, Taquara,
Igrejinha, Gramado, Caxias do Sul, Bento Gonçalves) e o ranking de consultas
não-marca estão em coleta.

## URLs legadas `/seminovos/{cidade}`

0 clique e 0 impressão em 28 dias. O tráfego antigo já não passava por lá; o 301
publicado hoje serve para eliminar o soft 404 e o desperdício de rastreio, não
para recuperar cliques.

## O que estes números dizem

**O problema das cidades não é posição, é clique.** Cachoeirinha aparece na
posição 1,6 com 704 impressões e **zero** clique. Novo Hamburgo, posição 1,5 com
413 impressões e 1 clique. Estar em primeiro e não ser clicado significa que o
resultado exibido não responde ao que a pessoa procurou — title, description e
adequação de intenção, não ranking.

**As páginas rankeiam para long tail, não para o termo de cabeça.** A página
`/seminovos-canoas` tem posição média 3,1, mas a consulta "canoas" tem posição
55,6. Não é contradição: a página aparece bem em variações raras e está na
página 6 no termo que tem volume. Média alta de posição com 352 impressões e 2
cliques é sinal disso.

**Esteio é o que sustenta o site**: 170 cliques, CTR 15,4%. É a única praça com
demanda de marca e proximidade real. Toda cidade nova compete contra revendas
locais com GBP ativo.

**A regra de decisão do próprio manual já se aplica**: impressão alta com CTR
baixo por 90 dias pede teste de title e description. Essas páginas têm 4.010
impressões e 0,4%. É o próximo movimento — depois de deixar o índice reprocessar
as correções de hoje, para não misturar as duas variáveis.

**Divergência a confirmar na próxima coleta:** a página
`/seminovos-cachoeirinha` registra 704 impressões, mas o filtro de consulta
"cachoeirinha" devolve 0. As impressões da página vêm de consultas que não citam
a cidade. Descobrir quais são define se a página está atraindo a intenção certa.

## Próxima medição

Refazer esta extração 30 dias após 26/07/2026, comparando:

- fichas `/veiculo/*` indexadas (eram invisíveis: sitemap sem veículo + loop de 302);
- erros de redirecionamento em Cobertura (devem cair a zero);
- CTR das páginas de cidade contra os 0,4% de hoje;
- impressões de `/seminovos-automaticos`, que só passou a ter página própria hoje.
