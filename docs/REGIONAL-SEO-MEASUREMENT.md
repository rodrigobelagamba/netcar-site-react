# Medição de SEO regional — Netcar

Este documento define a linha de base e a revisão mensal da expansão orgânica.
Não preencher resultados com estimativas: usar Search Console, GA4 e CRM/iAN.

## Escopo geográfico

### Núcleo metropolitano

Esteio, Canoas, Sapucaia do Sul, São Leopoldo, Novo Hamburgo, Porto Alegre,
Gravataí e Cachoeirinha.

### Vale do Paranhana e Hortênsias

Taquara, Igrejinha, Gramado e Canela.

### Serra

Caxias do Sul e Bento Gonçalves.

## Linha de base (antes da publicação)

Registrar os últimos 90 dias e salvar a data de extração.

> Linha de base medida: [BASELINE-SEO-2026-07.md](BASELINE-SEO-2026-07.md)
> (26/07/2026, 28 dias) — extraída antes de o índice reprocessar as correções de
> rastreio daquele dia.

### Search Console

Exportar em **Desempenho > Resultados da pesquisa**:

1. Tipo de pesquisa: Web.
2. Período: últimos 3 meses.
3. País: Brasil.
4. Exportar consultas e páginas em CSV.
5. Criar filtros separados para:
   - nome de cada cidade;
   - `seminovos`, `carros usados`, `revenda`, `vender carro`;
   - consultas de marca (`Netcar`) e sem marca.

Campos mínimos por cidade:

- impressões;
- cliques;
- CTR;
- posição média;
- principais consultas;
- principais páginas.

### GA4

Criar exploração com:

- dimensões: `Landing page + query string`, `Session source / medium`,
  `City`, `Region`, `wa_source`, `wa_page_type`;
- métricas: sessões, sessões engajadas, visualizações, `view_item`,
  `regional_stock_click`, `whatsapp_click` e usuários;
- filtro de páginas:
  - `/regioes-atendidas`;
  - `/seminovos-*`;
  - `/vender-carro-*`;
  - `/comprar-*`;
  - `/veiculo/*`.

O campo geográfico do GA4 é sinal auxiliar. A cidade da landing indica interesse
naquela região, não comprova residência nem município da venda. A cidade do
cliente depende de informação declarada no atendimento/CRM, quando disponível.

### Jornada regional implementada em 26/09/2026

O contexto `regional_city_slug` acompanha a última página regional consultada
durante a navegação no site. `regional_origin_path` informa essa página, sem
parâmetros de URL. Exemplos: `canoas` e `/seminovos-canoas`.

| Etapa | Evento/recorte | Leitura correta |
|---|---|---|
| Entrada orgânica na página regional | Sessão Organic Search com landing regional | Visita; não morador confirmado da cidade |
| Clique para o estoque completo | `regional_stock_click` | Avanço de navegação |
| Abertura da ficha pelo card | `vehicle_card_open` | Interesse em um veículo |
| Ficha carregada com dados reais | `view_item` | Veículo efetivamente exibido |
| Tentativa de contato | `whatsapp_click` | Clique para abrir WhatsApp; não comprova mensagem recebida |

Um visitante pode abrir a ficha diretamente no card da página regional, sem
passar pelo estoque completo. Esse caminho também deve entrar na análise.
Usar exploração de funil/sequência e usuários ou sessões, não apenas dividir
totais soltos de eventos. Separar mobile/desktop, período e canal de aquisição.

Regras para evitar números inflados:

- `regional_cta_click` e `regional_stock_click` descrevem o mesmo gesto nos
  botões de estoque; não somar os dois como dois avanços.
- `vehicle_card_open` e `view_item` são etapas distintas, não dois contatos.
- `whatsapp_click` não é lead qualificado, visita agendada ou venda. Essas
  conclusões dependem do atendimento. Suporte/Nethelp permanece separado.
- A implementação emite uma vez por gesto em cada destino GA4 direto/Data
  Layer. A configuração publicada do GTM deve continuar sem uma segunda tag
  GA4 para o mesmo evento; testes locais não certificam a configuração remota.

Consentimento e limites:

- O contexto de jornada fica somente em memória após o aceite. Não cria
  cookie, localStorage, sessionStorage nem identificador adicional.
- Ao consultar outra cidade, a cidade de interesse muda. Isso não reescreve
  campanha/origem de aquisição nem usa a atribuição de 30 dias como interesse
  regional atual.
- Revogar o consentimento descarta a jornada e limpa imediatamente os defaults
  de cidade, origem e consentimento no GA4/Data Layer, mesmo sem navegar. O GA4
  recebe apenas uma atualização de configuração (`update: true`), sem novo
  `page_view`. Sem aceite, mantém-se apenas o contexto da página atual já
  existente, sem carregar sua cidade para a próxima.
- Recarregar o site/abrir uma nova aba não recupera essa jornada da persistência.
  Portanto, ela não é uma contagem completa de toda navegação entre abas.
- Os novos parâmetros não recompõem eventos antigos. Comparar a série após a
  publicação e confirmar recebimento no GA4 antes de concluir desempenho.

`regional_city_slug` já é a dimensão de evento **Cidade regional**. Para
inspecionar a URL regional de origem em relatórios personalizados, cadastrar
`regional_origin_path` no escopo Evento, se ainda não existir. O cadastro exige
acesso ao GA4 e não é realizado pelo deploy do site.

Regressão automática: `npm run tracking:validate:gbp` cobre região → estoque →
ficha → WhatsApp, troca de cidade, origem de aquisição preservada, revogação,
novo aceite, ausência de persistência extra e não emissão de lead/venda.

Referência da limpeza sem nova visualização: [configuração `update` do Google
Analytics](https://developers.google.com/analytics/devguides/collection/ga4/reference/config#update).

### CRM / iAN

Registrar em cada conversa:

- cidade declarada;
- página/origem (`wa_source`);
- intenção (compra, venda, troca, financiamento);
- veículo de interesse;
- qualificado ou spam;
- visita agendada;
- proposta;
- venda concluída.

DDI diferente de `+55` deve ser tratado antes do LLM, para não contaminar
relatórios de lead regional.

## Dashboard mensal

Uma linha por cidade:

| Período | Cidade | Impressões não-brand | Cliques orgânicos | Posição | Sessões engajadas | Fichas vistas | Contatos válidos | Visitas | Vendas |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|

Separar:

- **leading indicators:** indexação, impressões, posição, cliques e fichas;
- **resultado comercial:** contatos válidos, visitas, propostas e vendas.

Não somar spam internacional como lead.

## Gates

### 30 dias

- páginas publicadas, canônicas e no sitemap;
- eventos visíveis no DebugView;
- zero erro de cobertura relevante;
- linha de base salva.

### 90 dias

- todas as cidades novas com impressões não-brand;
- consultas e páginas sem canibalização evidente;
- primeira revisão de títulos, FAQs e links internos baseada em consultas reais.

### 180 dias

- crescimento de cliques regionais contra a linha de base;
- Taquara, Igrejinha e Gramado avançando em long-tails;
- Caxias e Bento acumulando links, impressões e conteúdo de apoio;
- contatos válidos identificados por cidade.

### 365 dias

- revisar páginas sem tração;
- consolidar ou remover conteúdo raso;
- ampliar cidades somente onde houver sinais de demanda ou clientes reais.

## Regra de decisão

Uma página não deve ser reescrita semanalmente. Revisar após:

- 90 dias com impressões e CTR baixo: testar title/description;
- 90 dias sem impressões: revisar indexação, intenção e links;
- boa posição e poucos contatos: revisar oferta/jornada;
- contatos e nenhuma visita: revisar negociação remota, não SEO.
