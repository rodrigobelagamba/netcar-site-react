# Rotina semanal de fotos e medição do GBP

Início: 22/08/2026. Duração inicial: 30 dias. Perfis: Netcar Multimarcas - Loja 1 e Netcar Multimarcas - Loja 2.

## Objetivo

Manter fotos próprias e recentes de cada endereço e medir, sem atribuição causal prematura, se a presença da Loja 1 e da Loja 2 muda no Maps e no Map Pack de Esteio.

## Calendário fixo

| Ciclo | Data | Horário | Ação |
|---|---|---|---|
| 0 | 22/08/2026 | 16h05 | linha de base e primeiro envio |
| 1 | 29/08/2026 | 16h05 | conferir aprovação, selecionar fotos novas e repetir ranking |
| 2 | 05/09/2026 | 16h05 | selecionar fotos novas e repetir ranking |
| 3 | 12/09/2026 | 16h05 | selecionar fotos novas e repetir ranking |
| 4 | 19/09/2026 | 16h05 | selecionar fotos novas e repetir ranking |
| fechamento | 22/09/2026 | 16h05 | comparar 30 dias e decidir se a rotina continua |

Fuso: America/Sao_Paulo. Localização de busca: Centro de Esteio, mantendo o mesmo dispositivo e a mesma configuração de localização sempre que possível.

## Fonte das fotos

Banco canônico local sincronizado pelo Dropbox:

`DEPTO. TI/AUTOADS/squads/netcar-cronograma/media_bank`

O arquivo `index.json` identifica `unidade=loja1` ou `unidade=loja2`. O lote inicialmente usado foi `lojas_20260815`.

## Fluxo semanal

1. Executar `npm run local-seo:gbp-photos`.
2. Considerar somente imagens novas e identificadas para a unidade correta.
3. Abrir e revisar visualmente cada candidata antes de publicar.
4. Não publicar automaticamente arquivos com pessoas, documentos, telas, placas legíveis, promoções vencidas, garantias ou métricas sem validação.
5. Publicar uma ou duas fotos por perfil. Não duplicar a mesma imagem nos dois perfis.
6. Registrar o envio em `evidencias/gbp-photo-log.csv`, incluindo o estado exibido pelo Google.
7. Conferir novamente o estado na semana seguinte. `Pendente` significa processamento, não rejeição.

Arquivos em quarentena editorial podem ser usados somente após revisão visual humana específica. A quarentena do cronograma do Instagram não representa, por si só, uma reprovação do Google.

## Consultas de ranking

Repetir separadamente no resultado da Pesquisa, no Map Pack e no Google Maps:

- loja de carros em Esteio;
- revenda de veículos em Esteio;
- carros seminovos em Esteio;
- carros usados em Esteio;
- comprar carro em Esteio;
- veículos seminovos em Esteio;
- loja de veículos em Esteio;
- carros à venda em Esteio.

Para cada consulta, registrar os três primeiros do Map Pack, os primeiros resultados orgânicos do Maps, a posição aproximada de cada perfil da Netcar, localização, data e horário. Anúncios ficam em coluna separada.

## Critério de leitura

Não atribuir uma variação semanal às fotos isoladamente. Após quatro ciclos, comparar frequência no Top 3, perfil da Netcar selecionado, posição média quando visível e interações consolidadas da marca. Distância, concorrência e personalização continuam sendo fatores de confusão.
