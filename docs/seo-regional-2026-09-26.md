# Ajustes regionais — 26/09/2026

Publicação aprovada pelo responsável em 26/09/2026, após revisão da prévia.
Base: master `30a84de`. Worktree isolada para preservar as alterações das outras
tarefas. O resultado do deploy deve ser confirmado no painel e no site público.

## Evidência que orientou os ajustes

Consulta autenticada no Search Console em 26/09/2026, propriedade
`sc-domain:netcarmultimarcas.com.br`, pesquisa Web, período 28/08–24/09/2026,
sem filtro de dispositivo ou país. Filtro por consultas contendo o texto da
cidade; aba Páginas. Posição é média orgânica, não posição no Google Maps.

| Filtro de consulta | Cliques / impressões da propriedade | Página de compra exibida | Cliques / impressões / posição da página |
|---|---:|---|---:|
| canoas | 0 / 69 | /seminovos-canoas | 0 / 68 / 17,7 |
| sapucaia | 1 / 190 | /seminovos-sapucaia-do-sul | 0 / 144 / 9,2 |
| nova santa rita | 0 / 13 | /seminovos-nova-santa-rita | 0 / 12 / 9,6 |
| leopoldo | 0 / 168 | /seminovos-sao-leopoldo | 0 / 159 / 20,2 |
| gravata | 0 / 77 | /seminovos-gravatai | 0 / 77 / 15,5 |

Fonte: [Search Console — desempenho](https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Anetcarmultimarcas.com.br&start_date=20260828&end_date=20260924).
As linhas de página e os totais da propriedade têm agregações diferentes e não
precisam somar o mesmo valor. Os filtros misturam intenções. O clique de Sapucaia
foi para a home; isso sozinho não prova canibalização. Nova Santa Rita tem amostra
pequena. A janela inclui dias anteriores e posteriores à publicação regional de
12/09; não permite atribuir evolução apenas àquela mudança.

Conclusão de trabalho: as páginas corretas já recebem impressões. Melhorar as
URLs existentes é mais fundamentado que criar versões duplicadas. CTR baixo e
posição média são sinais para testar, não prova da causa de poucas vendas.

## Escopo implementado

1. Títulos, descrições, H1 e introduções específicos para Canoas, Sapucaia do Sul,
   Nova Santa Rita, São Leopoldo e Gravataí. Linguagem de compra, preços e troca,
   identificando Esteio como localização real. Sem prometer posição ou endereço
   na cidade pesquisada.
2. Botão principal das páginas regionais: “Ver carros e preços”; subtítulo
   “Estoque das duas lojas em Esteio”. Mantidas as opções de WhatsApp e venda.
3. Vitrine regional busca atualização ao abrir a página; usa o estoque completo,
   aplica os critérios de disponibilidade e ordena alfabeticamente antes do
   limite de oito cards. HTML rastreável segue a mesma ordenação/seleção.
4. Falha na atualização não é apresentada como estoque vazio. Anúncios já
   carregados permanecem visíveis, com aviso e opção de tentar novamente.
5. Removidas contagens congeladas no build dos atalhos de seleção. Links e
   eventos existentes foram preservados. Nova Santa Rita incluída na navegação
   regional das páginas de seleção de estoque.
6. Cidade de interesse acompanha página regional → estoque → ficha → WhatsApp
   após consentimento, somente em memória. Não equivale à residência do cliente.
   Ver [contrato de medição](./REGIONAL-SEO-MEASUREMENT.md).

Não alterados: URLs/canonicals, endereço físico, home, conteúdo específico de
Esteio, critérios de compra direta versus troca, layout da ficha dos veículos,
campanhas, Google Business Profile ou configurações publicadas do GA4/GTM.
O componente compartilhado e a geração de vitrines também beneficiam as demais
páginas regionais, inclusive as vitrines de troca nas páginas de venda.

## Validação e publicação

- Build completo e validadores do projeto aprovados.
- Testes de vitrine (`npx tsx --test scripts/tests/regional-stock-preview.test.tsx`):
  estoque completo/A–Z antes do limite, carregamento, erro,
  nova tentativa, preservação de cards, inclusão de Nova Santa Rita e remoção de
  contagens antigas, paridade entre os filtros/ordenação do React e do HTML gerado.
- Oito testes existentes de atualização/busca de estoque também aprovados
  (`node --test scripts/tests/stock-search-refresh.test.mjs`).
- Testes de medição: jornada com aceite, mudança de região, aquisição preservada,
  revogação na mesma página e novo aceite, sem armazenamento adicional nem
  conversões de venda. A limpeza alcança os parâmetros mantidos nos destinos de
  medição, não apenas a memória local.
- Prévia de Canoas conferida em desktop e celular. As cinco páginas foram
  verificadas em 390 × 844 sem transbordamento horizontal; títulos, descrições e
  canonicals corretos. Conferidos acesso ao estoque, abertura de ficha, destino
  do WhatsApp e novo link de Nova Santa Rita na seleção de automáticos.
- Metadados i-CHECK e snapshots de estoque gerados incidentalmente pelo build
  ficam fora do pacote de alterações de código desta etapa.
- Publicar somente após aprovação, pelo procedimento Netcar DevOps; conferir
  a versão no site público, não apenas o sucesso do build.

## Como avaliar o efeito

Após publicação, registrar data e commit. Confirmar os eventos no GA4 antes de
analisar o funil. Comparar janelas completas de 28 dias, por página, consulta,
dispositivo e canal Organic Search. Consultar o Search Console semanalmente
para detectar problemas; avaliar tendência após 4–8 semanas e mais tempo nos
recortes de poucas impressões, sem tratar esse prazo como garantia.

Separar: impressões/posição/CTR no Google, visita orgânica, abertura de ficha,
clique no WhatsApp e resultado declarado no atendimento. Não somar eventos que
descrevem o mesmo gesto nem chamar clique de lead qualificado ou venda.

Esses ajustes não medem nem comprovam crescimento no Map Pack. Uma nova
medição de Google Maps exige pontos de busca controlados por cidade.
