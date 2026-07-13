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

O campo geográfico do GA4 é sinal auxiliar. A cidade comercial deve vir da
landing acessada, da mensagem contextual e do CRM/iAN.

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
