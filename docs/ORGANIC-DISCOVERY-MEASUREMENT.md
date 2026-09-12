# Descoberta orgânica e avanço para o estoque

## Contrato da navegação

Páginas de marca priorizam seus próprios modelos com estoque indexável. Os
demais links relacionados continuam como alternativas, com limite de quatro.
Os destinos e critérios de estoque são os mesmos da geração das páginas.

| Interação | Evento GA4 | Contexto para análise |
|---|---|---|
| Marca → seleção relacionada | `regional_cta_click` | `regional_action=related_selection_{slug}` e página de origem |
| Artigo → ficha do carro | `vehicle_card_open` | `card_source=blog_article`, exemplar e contexto do artigo |
| Artigo → estoque/seleção/serviço comercial | `blog_discovery_click` | contexto do artigo e destino |

O contexto do artigo usa três parâmetros de evento:

- `article_slug`: identificador público do artigo de origem.
- `article_placement`: `vehicle_card` ou `article_cta`.
- `target_path`: caminho público do destino, sem query string ou fragmento.

`page_path` contém `/blog/{slug}` e `page_type` contém `blog_post`. A origem de
aquisição existente é preservada; uma navegação interna não ganha UTMs novas.
Os cards próprios do blog reutilizam o evento de abertura de ficha, sem emitir
um segundo evento de descoberta para o mesmo gesto.
Fichas da Netcar abrem pelo roteador interno para preservar a fila de medição
durante a navegação; links externos mantêm o comportamento nativo do navegador.

A nova medição do blog exige consentimento aceito. Os links relacionados usam
o fluxo regional existente, sob o Consent Mode do site. Não há alteração do
carregamento das tags, das escolhas de privacidade ou do rastreio de WhatsApp.
Esses eventos são sinais de navegação, não conversas, leads ou vendas; não devem
ser marcados como conversão comercial em Google Ads ou Meta.

## Configuração e leitura no GA4

Propriedade: **Netcar|RC – GA4**, `312862966`; fluxo `G-MGPNBDNQ9G`.
Registrar `article_slug`, `article_placement` e `target_path` como dimensões no
escopo Evento, sem duplicar definições existentes. `regional_action` já estava
cadastrado como **Ação regional** na inspeção de 12/09/2026.

Para uma exploração de conteúdo, usar as três dimensões acima, Nome do evento
e Grupo principal de canais da sessão, com Contagem de eventos e Total de
usuários. Filtrar os eventos `vehicle_card_open` e `blog_discovery_click` e,
para leitura orgânica, o canal Organic Search. Uma abertura de ficha vinda de
outra área do site não deve ser atribuída a um artigo sem `article_slug`.

Na exploração regional, usar **Ação regional**, página de origem, Nome do
evento e Total de usuários; selecionar ações iniciadas por `related_selection_`.
A contagem de eventos não é uma contagem de pessoas ou sessões únicas.

Os dados novos precisam ser processados pelo GA4. O cadastro de dimensões não
reconstrói o contexto de interações antigas. A confirmação de eventos no
Realtime demonstra recebimento, não crescimento comercial.

## Avaliação de resultado

1. Search Console: impressões, cliques, CTR e posição por página e família de
   consultas; separar consultas de marca Netcar das genéricas. Consultas são
   agregadas e não identificam individualmente o comprador.
2. GA4: entradas orgânicas, avanço de artigo/seleção para ficha e cliques de
   contato. Confirmar períodos, canal e comparabilidade antes de concluir.
3. Atendimento/CRM: conversas efetivamente recebidas, qualificação, visitas e
   vendas. Não inferir essas etapas de um clique nem somar eventos sobrepostos.

Na consulta de 12/09, a janela 01–11/09 tinha 438 sessões, com 135 em
`(not set)` (30,82%). A causa não foi estabelecida. Essa lacuna deve acompanhar
qualquer interpretação por origem. O pipeline offline existente é documentado
em [ATTRIBUTION-OFFLINE-SETUP.md](./ATTRIBUTION-OFFLINE-SETUP.md); esta entrega
não certifica a integração operacional do CRM/ERP nem envia conversões offline.

Fontes: [parâmetros e dimensões no GA4](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters)
e [dimensões personalizadas](https://support.google.com/analytics/answer/14240153?hl=pt-BR).
