# Publicações locais no Google — Canoas e Sapucaia do Sul

Coleta, publicação e revisão: 24/08/2026, entre 09h e 10h27, fuso America/Sao_Paulo.

## Publicações confirmadas

| Perfil | Cidade | Página citada no texto | Botão e destino rastreável | Foto | Estado final conferido |
|---|---|---|---|---|---|
| Netcar Multimarcas - Loja 1 | Canoas | `netcarmultimarcas.com.br/seminovos-canoas` | Saiba mais → `https://www.netcarmultimarcas.com.br/seminovos-canoas?utm_source=google&utm_medium=organic&utm_campaign=gbp_canoas&utm_content=loja_1_post` | showroom interno da Loja 1 | publicado |
| Netcar Multimarcas - Loja 1 | Sapucaia do Sul | `netcarmultimarcas.com.br/seminovos-sapucaia-do-sul` | Saiba mais → `https://www.netcarmultimarcas.com.br/seminovos-sapucaia-do-sul?utm_source=google&utm_medium=organic&utm_campaign=gbp_sapucaia&utm_content=loja_1_post` | visão geral interna da Loja 1 | publicado |
| Netcar Multimarcas - Loja 2 | Canoas | `netcarmultimarcas.com.br/seminovos-canoas` | Saiba mais → `https://www.netcarmultimarcas.com.br/seminovos-canoas?utm_source=google&utm_medium=organic&utm_campaign=gbp_canoas&utm_content=loja_2_post` | showroom interno da Loja 2 | publicado; alteração do botão em análise às 10h27 |
| Netcar Multimarcas - Loja 2 | Sapucaia do Sul | `netcarmultimarcas.com.br/seminovos-sapucaia-do-sul` | Saiba mais → `https://www.netcarmultimarcas.com.br/seminovos-sapucaia-do-sul?utm_source=google&utm_medium=organic&utm_campaign=gbp_sapucaia&utm_content=loja_2_post` | fachada/área interna da Loja 2 | publicado; alteração do botão em análise às 10h27 |

## Validação

- Os quatro cards foram conferidos no gerenciador do Perfil da Empresa com foto e texto visíveis.
- As publicações de cada loja foram mantidas separadas; a opção de copiar automaticamente para o outro perfil não foi usada.
- Cópias de teste que ficaram somente com imagem foram excluídas após a versão correta ser confirmada.
- Em 24/08/2026 às 10h27, o botão nativo `Saiba mais` foi gravado nos quatro posts com UTMs diferentes por cidade e loja.
- As quatro URLs foram reconferidas diretamente no formulário de edição depois do salvamento e estavam completas e corretas.
- Loja 1: os dois botões já voltaram a aparecer como publicados na listagem. Loja 2: os dois posts estavam com a alteração pendente de análise do Google na última conferência.

## Rastreamento preparado no site

O site agora preserva as dimensões abaixo nos eventos de entrada regional, cliques em CTAs, telefone, formulário e WhatsApp:

- `regional_city_slug`: `canoas` ou `sapucaia-do-sul`;
- `traffic_campaign`: `gbp-canoas` ou `gbp-sapucaia`;
- `traffic_content`: `loja_1_post` ou `loja_2_post`;
- `gbp_profile`: `loja_1` ou `loja_2`;
- `traffic_source`, `traffic_utm_source` e `traffic_medium` para separar Google orgânico de outras origens.

A validação automatizada está em `scripts/validate-gbp-attribution.ts` e faz parte do build. Assim, uma regressão que remova cidade, campanha ou loja interrompe a validação antes do deploy.

No GA4, foi criada em 24/08/2026 a dimensão personalizada `Loja de origem no Google`, com escopo de evento e parâmetro `gbp_profile`. A configuração já está ativa; o site precisa do próximo deploy para começar a enviar esse novo parâmetro em produção.

## Próxima medição

Comparar em 7, 14 e 30 dias:

- visualizações e interações dos perfis;
- cliques no site e solicitações de rota;
- presença da Netcar no Map Pack e no Google Maps para consultas de Canoas e Sapucaia do Sul;
- acessos às páginas `/seminovos-canoas` e `/seminovos-sapucaia-do-sul` no GA4 e no Search Console.

Não atribuir mudança de ranking apenas às publicações. Distância, avaliações, concorrência e personalização continuam sendo fatores de confusão.
