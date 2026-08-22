# Ativação própria de Canoas — página útil e distribuição rastreável

Data da decisão: 22/08/2026

Cidade: Canoas/RS
Destino: `https://www.netcarmultimarcas.com.br/seminovos-canoas`

## Decisão

A Netcar não fará, nesta etapa, contato com jornal, associação ou diretório para obter menção externa. A alternativa usa superfícies sob controle da empresa e não depende de mídia paga:

1. transformar o trajeto em utilidade prática na página de Canoas;
2. distribuir a página nos dois Perfis da Empresa após o deploy;
3. medir separadamente cliques de cada perfil e de cada rota;
4. manter transparência de que as duas lojas ficam em Esteio.

O banco de mídia contém entregas reais, mas os manifestos consultados não guardam a cidade do cliente. Por isso, nenhuma imagem será apresentada como entrega de Canoas sem evidência adicional e autorização.

## Implementação no site

A página oferece quatro pontos públicos de saída em Canoas — Centro, Niterói, Mathias Velho e Marechal Rondon — e abre no Google Maps a rota até:

- Loja 1: Av. Presidente Vargas, 740, Esteio;
- Loja 2: Av. Presidente Vargas, 1106, Esteio.

O texto explica que os pontos de saída são referências, que o usuário deve ajustar o endereço no Maps e que as lojas ficam a cerca de 400 m entre si, com estoque e atendimento integrados.

Cada clique de rota gera `regional_cta_click` com `regional_city_slug=canoas` e uma ação que identifica loja e origem. Exemplos:

- `route_loja_1_from_centro`;
- `route_loja_2_from_mathias_velho`.

O gerador de HTML para crawlers replica a utilidade sem depender do React: apresenta os quatro pontos de saída e dois links de rota por ponto. O validador do build exige os oito links antes de liberar o pacote de produção.

## Publicações gratuitas após o deploy

### Perfil Loja 1

URL:

`https://www.netcarmultimarcas.com.br/seminovos-canoas?utm_source=google&utm_medium=organic&utm_campaign=canoas_visita&utm_content=gbp_loja1`

Texto-base:

> Está em Canoas e quer comparar seminovos antes de sair? Consulte o estoque real, escolha os carros e abra a rota até a Netcar Loja 1, em Esteio. A página também mostra a Loja 2, que funciona com o mesmo estoque e atendimento integrado. Confirme a disponibilidade antes da visita.

### Perfil Loja 2

URL:

`https://www.netcarmultimarcas.com.br/seminovos-canoas?utm_source=google&utm_medium=organic&utm_campaign=canoas_visita&utm_content=gbp_loja2`

Texto-base:

> Para quem sai de Canoas: veja fotos, preços e veículos disponíveis antes do deslocamento. Abra a rota até a Netcar Loja 2, em Esteio, e confirme pelo WhatsApp onde estão os carros selecionados. As duas lojas trabalham de forma integrada.

Usar foto recente da respectiva unidade. Não usar foto de entrega como prova de cidade.

## Métricas e janela de avaliação

| Métrica                                          | Fonte          | Leitura inicial                           |
| ------------------------------------------------ | -------------- | ----------------------------------------- |
| sessões com `utm_campaign=canoas_visita`         | GA4            | 7, 14 e 28 dias após publicação           |
| divisão entre `gbp_loja1` e `gbp_loja2`          | GA4            | identifica qual perfil distribui melhor   |
| cliques `route_*`                                | GA4/GTM        | mede intenção de visita por origem e loja |
| `whatsapp_click` com `regional_city_slug=canoas` | GA4            | mede contato iniciado na página           |
| impressões e cliques não marcados da URL         | Search Console | comparar após 28–60 dias                  |

## Limite da estratégia

Esta ativação melhora utilidade, relevância orgânica, distribuição e medição. Ela não cria backlink externo e não elimina a vantagem de proximidade de concorrentes com endereço em Canoas. Não há base para prometer ganho de posição no Map Pack.
