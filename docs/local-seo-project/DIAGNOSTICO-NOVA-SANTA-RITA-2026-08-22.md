# Diagnóstico de oportunidade — Nova Santa Rita

Coleta: 22/08/2026, 11:43–11:50 (America/Sao_Paulo).

## Conclusão executiva

A Netcar não possuía página para Nova Santa Rita e o Search Console não registrou impressões de consultas contendo o nome da cidade. Portanto, não existe tração própria comprovada nem base para estimar volume mensal a partir do GSC.

Mesmo assim, há evidência suficiente para um teste controlado: o Google sugere as consultas `revenda de carros nova santa rita` e `revenda de carros nova santa rita rs`; o trajeto da região central até a Loja 1 marcou 15,5 km e 16 minutos; e os resultados orgânicos observados foram dominados por portais de anúncios, não por uma grande quantidade de revendas locais com sites fortes.

Decisão: criar uma página-piloto útil e medir durante 60–90 dias. A decisão não significa que exista volume alto; significa que proximidade, intenção sugerida e concorrência orgânica observada justificam um experimento de baixo custo.

## Evidências coletadas

| Sinal | Resultado | Classificação |
|---|---|---|
| Consultas contendo `nova santa rita` no GSC, últimos 3 meses | 0 cliques e 0 impressões | comprovado |
| Consultas contendo `nova santa rita` em toda a janela disponível | 0 cliques e 0 impressões | comprovado |
| Página regional existente antes da correção | não existia | comprovado |
| Google Autocomplete | sugere `revenda de carros nova santa rita` e a variação com `rs` | comprovado |
| Centro até Loja 1 | 15,5 km e 16 min via BR-386 na coleta | comprovado |
| Oferta no resultado da Webmotors para a cidade | um anúncio local observado | forte evidência de oferta local pequena naquele portal |
| Oferta no resultado da OLX para a cidade | 21 anúncios observados no rastreamento | forte evidência de mercado de classificados, não de revendas estruturadas |
| Volume mensal da palavra-chave | indisponível sem Planejador de Palavras-chave ou ferramenta equivalente | sem evidência suficiente |
| Vendas e leads da Netcar provenientes da cidade | não fornecidos | sem evidência suficiente |

## Resultados orgânicos observados

- [Webmotors — carros em Nova Santa Rita](https://www.webmotors.com.br/carros/rs-nova-santa-rita);
- [OLX — carros em Nova Santa Rita](https://www.olx.com.br/autos-e-pecas/carros-vans-e-utilitarios/flex/estado-rs/regioes-de-porto-alegre-torres-e-santa-cruz-do-sul/grande-porto-alegre/nova-santa-rita);
- [Seminovos Carburgo — página regional](https://www.seminovoscarburgo.com.br/revenda-de-carros-usados-e-seminovos-com-qualidade-garantida-em-nova-santa-rita-rs?page=8);
- páginas programáticas da Webmotors e Mobiauto para marca, ano e categoria.

Esses resultados foram observados na pesquisa orgânica. Não representam uma coleta do Map Pack simulada a partir do centro da cidade.

## Proximidade e rota

O [trajeto consultado no Google Maps](https://www.google.com/maps/dir/Centro,+Nova+Santa+Rita+-+RS/Av.+Pres.+Vargas,+740,+Esteio+-+RS) indicou 15,5 km e 16 minutos via BR-386, com trânsito normal. A página usa cerca de 16 km e 20 minutos como referência conservadora.

O Centro foi confirmado em páginas oficiais da [Sala do Empreendedor de Nova Santa Rita](https://saladoempreendedor.novasantarita.rs.gov.br/empresas/viabilidade-e-zoneamento). Não foram encontrados, nesta coleta, dados municipais suficientemente claros para publicar uma lista extensa de bairros; por isso a página não inventa referências locais.

## Diagnóstico por categoria

| Categoria | Diagnóstico | Confiança |
|---|---|---|
| Proximidade | Nova Santa Rita está praticamente à mesma distância que São Leopoldo | comprovado |
| Fator estrutural | a Netcar não possui endereço na cidade e não deve concorrer no Maps como loja local | comprovado |
| Relevância | não havia página nem associação temática específica | comprovado |
| Demanda | autocomplete indica intenção de revenda, mas o volume é desconhecido | forte evidência da intenção; sem evidência de volume |
| Conteúdo local | oportunidade de explicar rota, estoque e planejamento sem criar página-porta | forte evidência |
| Autoridade externa | a nova URL começa sem backlinks | hipótese provável até o primeiro relatório de Links |
| Reputação local | não existem provas publicadas de clientes da cidade | sem evidência suficiente |

## Página-piloto implementada

- rota `/seminovos-nova-santa-rita` com estoque real;
- página complementar `/vender-carro-nova-santa-rita`;
- distância e acesso pela BR-386;
- filtros, confirmação de disponibilidade e planejamento da visita;
- explicação de que as duas lojas compartilham estoque, equipe e atendimento;
- declaração clara de que a Netcar não possui unidade em Nova Santa Rita;
- title, description, H1, conteúdo e FAQs originais;
- inclusão no sitemap, hub de regiões e links regionais gerados pelo projeto.

## Critério para manter ou rebaixar a prioridade

Medir 60–90 dias após indexação. Manter investimento se surgirem impressões genéricas, cliques qualificados, leads ou vendas identificadas. Se a URL permanecer sem impressões e sem conversões, mantê-la factual e indexável, mas retirar a cidade da prioridade operacional em vez de multiplicar conteúdo.

Fontes operacionais: [Search Console](https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Anetcarmultimarcas.com.br), [Google Autocomplete](https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&q=revenda%20de%20carros%20nova%20santa%20rita) e [Google Maps](https://www.google.com/maps/dir/Centro,+Nova+Santa+Rita+-+RS/Av.+Pres.+Vargas,+740,+Esteio+-+RS).
