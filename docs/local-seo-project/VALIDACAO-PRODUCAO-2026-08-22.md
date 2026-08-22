# Validação de produção — deploy de 22/08/2026

Coleta: 22/08/2026, entre 10:50 e 10:55 (America/Sao_Paulo).

Commit publicado na `master`: `c5076bc`.

## Respostas HTTP

| URL | Resultado observado | Aceite |
|---|---:|---|
| `/` | 200 | aprovado |
| `/seminovos` | 200 | aprovado |
| `/seminovos-canoas` | 200 | aprovado |
| `/noticias.php` | 301 para `/blog` | aprovado |
| `/equipe.php` | 301 para `/sobre` | aprovado |
| `/backend/Netcar` | 410 | aprovado |
| `/cliente.php?id=1` | 410 | aprovado |
| `/ficha-cadastral.php?id=1` | 410 | aprovado |
| `/pagina-que-nao-existe-netcar` | 404 com `noindex, follow` | aprovado |
| `/sitemap.xml` | 200, 154 URLs | aprovado |

## Canoas

- title: `Seminovos Canoas: fotos, preços e estoque | Netcar`;
- description: estoque em Esteio, referência de cerca de 12 km, fotos, preços, financiamento e troca;
- canonical: a própria URL com HTTPS e `www`;
- H1: `Carros seminovos para Canoas: estoque perto da cidade`;
- conteúdo renderizado confirmou `Entrada parcelada no cartão` e `Despachante credenciado`;
- estoque real e transparência sobre a ausência de loja em Canoas foram preservados.

O Search Console executou o teste em tempo real às 10:55 e informou que o URL está disponível para o Google e pode ser indexado. Em seguida, a indexação foi solicitada; o Google confirmou a entrada na fila de rastreamento prioritário.

## Sapucaia do Sul

A correção do commit `7907295` foi validada no servidor público às 11:14:

- resposta HTTP 200;
- title, description, canonical e H1 correspondem ao código publicado;
- conteúdo renderizado inclui bairros, referência de distância, quatro parágrafos e quatro FAQs;
- estoque real, entrada parcelada no cartão e despachante credenciado foram preservados;
- a página declara de forma explícita que a Netcar não possui endereço em Sapucaia do Sul.

O teste em tempo real do Search Console informou que o URL está disponível para o Google, pode ser indexado e contém um breadcrumb válido. A indexação foi solicitada e o Google confirmou a inclusão na fila de rastreamento prioritário.

## São Leopoldo

A correção do commit `cd78b2e` foi validada no servidor público às 11:39:

- resposta HTTP 200;
- title, description, canonical e H1 correspondem ao código publicado;
- distância de 16 km, rota, bairros, operação integrada e quatro FAQs aparecem na versão renderizada;
- estoque real, entrada parcelada no cartão, despachante credenciado e Nethelp foram preservados;
- a página declara que os endereços físicos ficam somente em Esteio.

O teste em tempo real do Search Console confirmou que o URL está disponível para o Google, pode ser indexado e contém um breadcrumb válido. A indexação foi solicitada, e o Google confirmou a fila de rastreamento prioritário.

## Nova Santa Rita

O piloto do commit `57dde08` foi validado no servidor público entre 12:45 e 12:50:

- `/seminovos-nova-santa-rita` e `/vender-carro-nova-santa-rita` responderam HTTP 200;
- as duas URLs aparecem no sitemap público;
- title, description, canonical e H1 correspondem ao conteúdo implementado;
- a página de compra informa cerca de 16 km, acesso pela BR-386, estoque integrado e ausência de loja na cidade;
- a página de venda mantém a pré-avaliação remota e a vistoria presencial em Esteio.

O teste em tempo real do Search Console confirmou que as duas URLs estão disponíveis para o Google, podem ser indexadas e contêm breadcrumb válido. A indexação das duas páginas foi solicitada, e o Google confirmou a entrada de ambas na fila de rastreamento prioritário.

## Cachoeirinha

A correção do commit `813a0e3` foi validada no servidor público entre 13:10 e 13:15:

- `/seminovos-cachoeirinha` e `/vender-carro-cachoeirinha` responderam HTTP 200;
- as duas URLs aparecem no sitemap público;
- title, description e canonical correspondem ao conteúdo implementado;
- a página de compra preserva a distância conservadora de cerca de 15 km, o estoque real e a ausência de loja na cidade;
- a página de venda preserva a pré-avaliação remota e a vistoria presencial em Esteio.

O teste em tempo real do Search Console confirmou que as duas URLs estão disponíveis para o Google, podem ser indexadas e contêm breadcrumb válido. A indexação das duas páginas foi solicitada, e o Google confirmou a entrada de ambas na fila de rastreamento prioritário.

## Entidades das lojas

O HTML inicial contém duas entidades `AutoDealer` distintas:

| Loja | Endereço | CEP | Telefone | CID do Maps |
|---|---|---|---|---|
| Loja 1 | Av. Presidente Vargas, 740, Esteio/RS | 93260-490 | (51) 3473-7900 | `9144067949621682127` |
| Loja 2 | Av. Presidente Vargas, 1106, Esteio/RS | 93260-048 | (51) 3033-3900 | `10839197980729051544` |

Evidência: **comprovado no servidor público, na versão renderizada e no teste em tempo real do Search Console**.
