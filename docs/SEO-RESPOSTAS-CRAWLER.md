# Contrato de respostas por URL — crawler e usuário

O site serve HTML diferente para bot e para pessoa (dynamic rendering via
`.htaccess` por User-Agent). Este documento fixa **qual status e qual conteúdo
cada estado de URL deve devolver**. Alterar `public/.htaccess`,
`public/detalhe-veiculo.php` ou `public/seo-pagina.php` sem respeitar a tabela
abaixo reintroduz erros que já custaram indexação.

Quem serve o quê:

```
Requisição
   │
   ├─ bot (Googlebot, WhatsApp, curl…) ─┬─ /                     → seo-pagina.php
   │                                    ├─ /veiculo/{slug}       → detalhe-veiculo.php
   │                                    ├─ /seminovos-{cidade}   → seo-static/city-*.html
   │                                    ├─ /comprar-{slug}       → seo-static/landing-*.html
   │                                    ├─ /vender-carro-{cid}   → seo-static/sell-city-*.html
   │                                    ├─ /blog/{slug}          → seo-static/blog-*.html
   │                                    └─ /financiamento, /atendimento-24h,
   │                                       /move-brasil, /seminovos-automaticos
   │                                                             → seo-static/page-*.html
   │
   └─ pessoa ─────────────────────────── index.html (SPA React)
```

## Ficha de veículo — `/veiculo/{slug}`

O estado vem da API `/api/v1/veiculos/id/{id}`. Três estados, três respostas
diferentes, e a distinção entre eles é o ponto crítico.

| Estado | API responde | Bot recebe | Pessoa recebe |
|---|---|---|---|
| À venda | 200, `valor > 0` | 200 com ficha completa e schema `InStock` | Ficha React |
| Vendido, ainda no estoque (≈5 dias) | 200, `valor = 0` | 200 com `noindex, follow` e schema `SoldOut` | Ficha com selo de vendido |
| Removido da API | 404 | **410** com página "já foi vendido" | `VehicleUnavailablePage` |
| API instável | timeout, 5xx, 429 | **503** com `Retry-After: 3600` | Skeleton e retry |

### Invariantes

**Nunca responder redirect para a própria URL.** Era o bug original: veículo
removido devolvia `Location: /veiculo/{id}`, e como o `.htaccess` manda todo bot
de volta ao PHP, cada carro vendido virava um 302 infinito. O Googlebot
registrava isso como "erro de redirecionamento" e parava de rastrear.

**Só 200 e 404 da API são conclusivos.** Qualquer outra resposta é instabilidade
e precisa virar 503, nunca 410. Devolver 410 num timeout tira do índice um carro
que está à venda.

**410, não 404, para carro removido.** O carro existiu e não volta; 410 acelera a
saída do índice. A página nomeia o carro a partir do slug (não temos mais os
dados da API) e leva para estoque e categorias.

**Título sempre com marca, modelo, ano, km e preço.** Antes era
`Creta prestige 2018 iyo-70` — fragmento de placa não é o que a pessoa digita no
Google. Formato atual: `Hyundai Creta Prestige 2018 · 155 mil km — R$ 89.900 |
Netcar Multimarcas Esteio`. O km diferencia dois carros do mesmo modelo e ano.

**O corpo entregue ao bot precisa ser a ficha, não um resumo.** Ficha técnica,
opcionais, preparação, endereço e links internos para estoque e cidades. A versão
antiga tinha 128 caracteres e era tratada como página vazia.

## Legado e URLs quebradas

| Padrão | Resposta | Motivo |
|---|---|---|
| `/{pagina}.html` e `.php` | 301 para a rota React | Extensão legada caía no shell do SPA e virava NotFound |
| `/seminovos/{cidade}` | 301 para `/seminovos-{cidade}` | Formato antigo com barra; o canônico é com hífen |
| `/seminovos/{outro}` sem extensão | 301 para `/seminovos` | A checagem de ponto preserva arquivos reais da pasta legada |
| `/not-found.html` | 410 | Estava em 302 para si mesmo, contando como erro de redirecionamento |
| `/detalhe-produto-*` | 301 para `/seminovos` | Fichas do site de 2016 |

## Prerender: a regra do `-f`

Toda regra que aponta para um arquivo de `seo-static/` **precisa** de
`RewriteCond %{DOCUMENT_ROOT}/seo-static/<arquivo>-$1.html -f`.

Sem isso, uma URL que casa com o padrão mas não tem arquivo gerado cai no
fallback do SPA e o bot recebe o `index.html` com o título da home — soft 404 e
conteúdo duplicado. Foi o que aconteceu com `/seminovos-automaticos`: casava com
`^seminovos-([a-z0-9-]+)$` e apontava para um `city-automaticos.html` inexistente.

## Como verificar depois de cada deploy

```bash
UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
S="https://www.netcarmultimarcas.com.br"

# Carro à venda: 200 e título com marca e preço
curl -s -A "$UA" "$S/veiculo/<slug-de-carro-a-venda>" | grep -o "<title>[^<]*</title>"

# Carro removido: precisa ser 410, nunca 302
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -A "$UA" \
  "$S/veiculo/creta-prestige-2018-iyo-xx70-19801"

# Legado de cidade: 301 para o canônico com hífen
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" "$S/seminovos/canoas"

# Automáticos: título próprio, não o da home
curl -s -A "$UA" "$S/seminovos-automaticos" | grep -o "<title>[^<]*</title>"

# Sitemap: precisa listar os veículos
curl -s "$S/sitemap.xml" | grep -c "/veiculo/"
```

Se o último comando devolver `0`, pare o deploy: o sitemap subiu sem estoque e o
Google vai perder as fichas. Ver a seção de sitemap em `AUTOMACAO-SEO.md`.

## Armadilha de PHP

`curl_close()` é no-op desde o PHP 8.0 e emite `Deprecated` no 8.5. O aviso conta
como output, e depois de qualquer output **todo `header()` e
`http_response_code()` falha silenciosamente** — inclusive o 301 canônico. Por
isso a chamada está atrás de `if (PHP_VERSION_ID < 80000)`. Ao mexer em
`detalhe-veiculo.php`, confirme que nada imprime antes dos headers.

Para testar PHP localmente sem instalar nada no sistema:

```bash
curl -fsSL https://dl.static-php.dev/static-php-cli/common/php-8.5.8-cli-macos-aarch64.tar.gz \
  | tar xz -C /tmp
/tmp/php -l public/detalhe-veiculo.php          # sintaxe
/tmp/php -S 127.0.0.1:8899 -t public            # servidor com a API real
```
