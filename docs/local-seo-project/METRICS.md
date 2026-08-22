# Métricas e linha de base

## Linha de base observada em 21/08/2026

| Indicador | Esteio | Sapucaia | Canoas | Observação |
|---|---:|---:|---:|---|
| Aparições da Netcar no Google Maps | 8/8 | 0/8 | 0/8 | Consultas simuladas a partir do centro da cidade. |
| Posição média no Maps quando visível | 3,75 | N/D | N/D | Média aproximada, não garantia de posição futura. |
| Aparições no Map Pack | 0/8 | 0/8 | 0/8 | O recorte deve ser repetido em grade geográfica. |
| Aparições orgânicas | 7/8 | 0/8 | 0/8 | Em Esteio, média aproximada de 1,57 quando visível. |

Outros indicadores iniciais:

- Google Business Profile: cerca de 513 avaliações na loja da Av. Presidente Vargas, 740, e 353 na loja da Av. Presidente Vargas, 1106, no momento da coleta;
- Core Web Vitals de campo: avaliação reprovada, com LCP aproximado de 3,8 s, INP de 348 ms e CLS de 0,01;
- fora de Esteio, a ausência de endereço físico é uma limitação estrutural para Maps/Map Pack e não pode ser eliminada apenas com páginas locais.

## Avaliações: linha de base de 22/08/2026

| Perfil | Nota | Total | Novas em até 30 dias | Novas em até 60 dias | Novas em até 90 dias |
|---|---:|---:|---:|---:|---:|
| Loja 1 | 4,8 | 514 | 6 | 15 | 17 |
| Loja 2 | 4,9 | 355 | 4 | 5 | 8 |
| Marca | — | 869 | 10 | 20 | 25 |

As janelas são aproximações baseadas nas datas relativas do Google Maps. Avaliações marcadas como editadas foram excluídas desses totais, porque podem ter sido publicadas originalmente fora da janela. A medição recorrente deve usar a variação semanal dos totais por perfil. Procedimento e links oficiais: `ROTINA-AVALIACOES-2026-08-22.md`.

## Identificação dos acessos vindos dos perfis

Configuração aplicada em 21/08/2026:

| Perfil | `utm_source` | `utm_medium` | `utm_campaign` | `utm_content` |
|---|---|---|---|---|
| Loja 1 | google | organic | gbp_esteio | loja_1 |
| Loja 2 | google | organic | gbp_esteio | loja_2 |

No GA4, analisar sessões e eventos com campanha `gbp_esteio`, comparando a dimensão de conteúdo manual do anúncio (`utm_content`) entre `loja_1` e `loja_2`. Para WhatsApp, o rastreamento próprio do site também registra `utm_content`, permitindo relacionar o clique à unidade de origem sem tratar as lojas como funis comerciais independentes.

## GA4: linha de base de 25/07 a 21/08/2026

| Indicador | Resultado | Leitura correta |
|---|---:|---|
| Sessões totais | 16.407 | todos os canais |
| Sessões de Organic Search | 919 | 5,6% das sessões |
| Sessões orgânicas engajadas | 707 | taxa de 76,93% |
| `whatsapp_click` total | 3.085 | contato iniciado, não venda |
| `whatsapp_click` de Organic Search | 69 | atribuído ao canal da sessão |
| Visualizações das páginas regionais com `seminovos-` | 118 | inclui cidades prioritárias, outras cidades e `/seminovos-automaticos` |
| Visualizações orgânicas das páginas regionais | 19 | volume ainda muito baixo |

O relatório completo separa canal, cidade geográfica estimada e caminho da página: `BASELINE-GA4-2026-07-25-A-2026-08-21.md`. A dimensão por título não deve ser usada na rotina porque alterações históricas de título fragmentam uma mesma URL.

Em 22/08/2026 foi criada a dimensão personalizada de evento `Cidade regional`, ligada ao parâmetro `regional_city_slug` que o site já envia. Ela permitirá agrupar eventos futuros pela cidade-alvo da página sem depender apenas da geografia estimada do IP. Não é retroativa e não exigiu deploy.

## GSC: páginas locais em 90 dias

Janela comum: 21/05/2026 a 20/08/2026, Pesquisa Web.

| Cidade/página | Cliques | Impressões | Posição média agregada | Observação |
|---|---:|---:|---:|---|
| Esteio | N/D | N/D | N/D | Home e estoque não foram isolados nesta coleta de páginas locais |
| Sapucaia do Sul | 2 | 941 | 2,2 | 99,7% das impressões visíveis eram de marca |
| Canoas | 2 | 835 | 3,9 | 97,5% das impressões visíveis eram de marca |
| São Leopoldo | 1 | 341 | 9,1 | 60 impressões genéricas visíveis |
| Nova Santa Rita | N/D | N/D | N/D | piloto publicado após a janela |
| Cachoeirinha | 0 | 1.370 | 2,1 | 98,9% das impressões visíveis eram de marca |
| Gravataí | 0 | 196 | 12,3 | 65 impressões comerciais locais visíveis |
| Porto Alegre | 9 | 1.917 | 4,0 | 98,7% das impressões visíveis eram de marca |

Posição média agregada não será tratada como ranking genérico local quando a página for exibida majoritariamente para a própria marca.

## Placar principal

| Métrica | Fonte | Frequência | Corte | Responsável |
|---|---|---|---|---|
| Posição em grade para 8 termos por cidade | ferramenta de geo-grid ou coleta documentada | mensal | cidade, termo, ponto e loja | SEO/Codex |
| Participação no Top 3 do Maps | mesma coleta de geo-grid | mensal | cidade e termo | SEO/Codex |
| Impressões, cliques, CTR e posição orgânica | Google Search Console | mensal | página, consulta e cidade-alvo | Netcar + Codex |
| Ligações, rotas e cliques no site pelo GBP | desempenho do Perfil da Empresa | mensal | perfil da loja | Netcar |
| Avaliações novas e velocidade | Google Business Profile | semanal/mensal | perfil da loja | Atendimento |
| Leads qualificados e vendas por cidade | CRM ou planilha comercial | mensal | origem e município | Comercial |
| LCP, INP e CLS | PageSpeed Insights/CrUX | mensal e após deploy | template/página | Desenvolvimento |
| Citações e links locais conquistados | registro de evidências | mensal | domínio, cidade e URL | Marketing |

## Regras de leitura

- comparar sempre a mesma malha de pontos, termos, idioma, dispositivo e horário aproximado;
- guardar captura, URL e data de cada coleta;
- avaliar tendência de 30, 60 e 90 dias, não uma consulta isolada;
- separar Maps, Map Pack e orgânico;
- não atribuir causalidade a uma alteração sem período e controle mínimos de comparação.

## Critério de sucesso inicial (90 dias)

- Esteio: aumentar a presença no Top 3 do Maps/Map Pack sem perder a liderança orgânica;
- Sapucaia: obter primeiras impressões e cliques consistentes para páginas/consultas locais e ampliar a cobertura geográfica observada;
- Canoas: gerar crescimento orgânico mensurável, criar prova local real e estabelecer comparação recorrente com R2 Motors e Dotto Veículos;
- técnico: melhorar os templates prioritários até aprovação ou tendência clara de aprovação nos Core Web Vitals.
