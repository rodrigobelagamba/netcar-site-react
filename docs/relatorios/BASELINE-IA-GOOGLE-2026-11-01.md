# Linha de base — IA do Google e concorrência

Data: 01/11/2026. Lugar do mapa: Esteio (centro aproximado -29,851, -51,179). A busca web do Google (google.com/search) devolveu captcha para o navegador automatizado. O mapa foi lido no Google Maps com essa coordenada. O orgânico abaixo é o que a busca indexada devolveu, não a posição exata do mapa.

A resposta colada da IA (Ponto Um, G7, Velasques na Presidente Vargas) não bate com o mapa. G7 Automóveis está em Bagé e Pelotas. Ponto Um não aparece; a loja próxima é a PontoCar, na Vargas 500, com 3 avaliações. Velasques não apareceu nesta coleta.

## Mapa em Esteio

### revenda de carros esteio

| Ordem | Quem | Nota | Onde |
| --- | --- | --- | --- |
| Anúncio | Netcar Multimarcas - Loja 1 | 4,9 (529) | Av. Presidente Vargas, 740 |
| Anúncio | R2 Motors | 4,9 (279) | Av. Boqueirão, 1645 |
| Lista | ALX Veículos | 4,8 (227) | Av. Pres. Vargas, 820 |
| Lista | Fernando Motors | 3,9 (139) | Av. Getúlio Vargas, 520 |
| Lista | Telmo Multimarcas | 4,7 (323) | Av. Pres. Vargas, 234 |
| Lista | Netcar Multimarcas - Loja 1 | 4,9 (529) | de novo, orgânico |

A Netcar entra. A IA que ignorou a loja não está lendo este mapa. Quem compete na mesma avenida, de verdade: ALX (820), Telmo (234), Fernando Motors (Getúlio Vargas, 520), Marcauto (1166, site próprio), Carioca Multimarcas (1146), Figueiredo (3644).

### seminovos esteio

Anúncios: R2 Motors e Netcar Loja 1, mais anúncio do site netcarmultimarcas.com.br. Na lista orgânica: Netcar Loja 1, Fernando Motors, Netcar Loja 2, Telmo, ALX, L&M Veículos.

## Orgânico (busca indexada, sem posição de mapa)

| Consulta | Netcar | Quem fica na frente ou ao lado |
| --- | --- | --- |
| netcar esteio | Home, contato, compra, seminovos, sobre | A própria Netcar ocupa o resultado |
| netcar multimarcas | As mesmas páginas | Sem concorrente no topo desta coleta |
| netcar rc | Não separado nesta coleta; o mapa usa NetcarRC como nome da ficha | Diretórios ainda chamam a loja de NetcarRC |
| revenda de carros em esteio | Home, /seminovos e /contato | Marcauto e Carioca, na mesma avenida |
| seminovos esteio | Home e /seminovos | Figueiredo, Monteiro Veículos, Mobiauto (agregador) |
| loja de carros usados esteio | Não isolada; o mapa da query vizinha mostra ALX, Telmo e Fernando antes da segunda aparição da Netcar | ALX, Telmo, Fernando Motors |
| carros seminovos avenida presidente vargas esteio | Não isolada | Marcauto 1166, Carioca 1146, Figueiredo 3644 |
| revenda de carros porto alegre | Não | Plus Veículos (4,9 / 530), Motorclass, Savar, Empório, GarageCar, N7 Motors, Fideliti. A Netcar não é loja de Porto Alegre |
| revenda de carros canoas | Não | Dotto, Thiago Veículos, Sinoscar, Turauto, Fabinho. Estão dentro de Canoas |
| seminovos canoas | Não isolada | Mesmo grupo de Canoas |
| carros usados novo hamburgo | Não isolada | Lojas de Novo Hamburgo, não medidas uma a uma nesta rodada |
| localiza seminovos | Não | seminovos.localiza.com e a loja da Av. Ipiranga (4,2 / 493) |
| carro de locadora vale a pena | A página da Netcar existe, mas quem domina o tema é a Localiza e a Quatro Rodas | Localiza escreve o próprio artigo "vale a pena" |

## IA

A resposta colada em 01/11 não cita a Netcar e inventa lojas na Presidente Vargas. No mesmo dia, o mapa em Esteio mostra a Netcar em primeiro no anúncio e de novo na lista, com 529 avaliações e nota 4,9 na Loja 1. A falha da IA não é falta de review.

## Sinais prejudiciais conferidos

| Sinal | Estado em 01/11 |
| --- | --- |
| https://netcar-rc.com.br, www e http | 200. HTML de 16/04/2016, 78 bytes, meta refresh para http://netcarmultimarcas.com.br/ |
| Pasta desse arquivo na conta SSH | Não está em /home/netcarmultimarcas. O host cai no vhost padrão do Apache. O .htaccess do site não alcança esse domínio |
| http://netcarmultimarcas.com.br | 301 para https://www |
| /contato.php | 301 para /contato |
| contato@netcar-rc.com.br na home | 0 ocorrência |
| sameAs da home | Só Instagram e Facebook. Os CID do mapa estão em hasMap, não em sameAs |
| Getúlio Vargas no site da Netcar | Não. Aparece em documento interno de concorrente (Dotto, Movida) e em diretório de terceiro (Justos) |

## O que só se corrige fora daqui

- Google Business: o nome público das fichas ainda é lido como NetcarRC em diretório. As duas lojas precisam do mesmo nome do site e do site canônico https://www.netcarmultimarcas.com.br. Isso é clique no painel do Google.
- KingHost: apontar netcar-rc.com.br para a pasta www do site, ou trocar o index de 2016 do vhost padrão. A conta SSH não enxerga esse arquivo.
- Justos e infoaboutcompanies: Getúlio Vargas, CEP 93260-001, horário 8h30, domínio velho.
- Reclame Aqui: página não verificada "Netcar Multimarcas - Esteio RS" mistura reclamação da Net Car de Taubaté.

## Nota

Adiada. O plano mede de novo depois do deploy autorizado. Sem esse deploy, a nota de campo não existe.
