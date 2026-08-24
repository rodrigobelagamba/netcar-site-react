# Rotina recorrente de ranking local

Objetivo: repetir a fotografia de Maps, Map Pack e orgânico sem mudar termos, coordenadas ou critérios entre uma rodada e outra.

## Frequência

- **Esteio:** sábado, aproximadamente 16h05, durante os quatro ciclos definidos em `EST-001`;
- **demais cidades:** uma coleta completa por mês, mantendo dispositivo desktop, idioma `pt-BR`, zoom `13z` e horário aproximado;
- **coletas extraordinárias:** somente após alteração relevante, registradas separadamente da série mensal.

Uma rodada isolada continua sendo uma fotografia. A análise usa tendência de 30, 60 e 90 dias.

## Gerar a ficha sem inventar resultados

Todas as cidades e os oito termos:

```bash
npm run local-seo:ranking-template -- --date 2026-09-23 --output docs/local-seo-project/evidencias/ranking-recorrente-2026-09-23.json
```

Somente Canoas:

```bash
npm run local-seo:ranking-template -- --date 2026-09-23 --city Canoas --output /tmp/ranking-canoas-2026-09-23.json
```

O gerador reaproveita as coordenadas centrais e os termos da linha de base de 23/08/2026. Ele cria os URLs e campos vazios; não consulta o Google e não preenche posição automaticamente.

## Como preencher cada consulta

1. Registrar `collectedAt` com data, horário e fuso.
2. Abrir o URL de Google Maps já centrado na coordenada fixa.
3. Separar itens patrocinados em `googleMaps.sponsoredResults`.
4. Registrar os resultados orgânicos do Maps na ordem observada.
5. Abrir o URL da Pesquisa e confirmar a região mostrada pelo Google.
6. Preencher os três resultados do Map Pack e depois os resultados orgânicos tradicionais.
7. Registrar Loja 1 e Loja 2 separadamente; usar `notObserved: true` quando nenhuma tiver aparecido no recorte.
8. Guardar captura de tela quando houver mudança material, anúncio misturado ou ambiguidade de perfil.

Nunca converter ausência no recorte em inexistência da empresa. Nunca contar anúncio como ranking orgânico.

## Concorrentes fixos de Canoas

R2 Motors e Dotto Veículos permanecem na lista mesmo quando não aparecem. Star, Base, Boqueirão, Macrosinos e os demais líderes observados continuam sendo registrados conforme a superfície.

## Comparação

Para cada cidade e termo, comparar:

- presença da Netcar no Top 3;
- posição de Loja 1 e Loja 2 quando visíveis;
- frequência dos concorrentes no Top 3;
- patrocinado versus orgânico;
- alteração de posição somente quando ponto, termo, dispositivo e horário forem equivalentes.

O arquivo preenchido entra em `docs/local-seo-project/evidencias/` e deve manter os URLs consultados, a data da coleta e as limitações.
