# Expointer e revisão das páginas regionais

Coleta: 05/09/2026. Verificações públicas regionais entre aproximadamente 19h25 e 19h32 (Brasília). Código-base auditado: master `1c4a905`. Escopo: páginas públicas e código; não foram acessados dados privados de Search Console, Analytics ou CRM.

## Resultado e decisão

A base técnica das páginas regionais está acessível. O maior ajuste imediato é facilitar a decisão do cliente: mostrar o estoque e o contato antes de textos longos e levar quem quer vender diretamente à pré-avaliação. Isso é uma oportunidade de conversão; não foi medida perda de vendas causada pelo layout.

Nesta entrega foi implementada somente a nova `/expointer-esteio`, com ligação no hub de regiões, estoque real, troca, visita e rotas até os dois endereços de Esteio. As mudanças regionais abaixo são recomendações para a próxima etapa; não foram aplicadas em massa.

## O que foi verificado

- 19 cidades × duas intenções (comprar um seminovo / vender para a loja): 38 URLs.
- 76 requisições: cada URL com User-Agent de visitante e Googlebot. Todas responderam HTTP 200, canonical autorreferente e diretiva que permite indexação. JSON-LD válido nos documentos analisados.
- As 38 URLs aparecem no sitemap e no hub `/regioes-atendidas`.
- No HTML destinado ao crawler: H1 único, oito links para fichas de veículos e dois endereços reais em Esteio. Nenhuma filial fictícia detectada.
- Amostra de 19 links internos em Canoas sem 404.
- Duas cidades inexistentes usadas para teste retornaram 404/noindex, tanto para visitante quanto para Googlebot.
- O servidor diferencia o cache por User-Agent. O conteúdo regional principal vem da mesma fonte usada pelo React e pelo HTML gerado.

**Limite importante:** simular o User-Agent não é observar uma visita real do Googlebot. HTTP 200, sitemap e `index, follow` não comprovam indexação, posição, tráfego ou ausência de ação manual. Nenhuma melhora de ranking é atribuída a este teste.

## Ajustes priorizados

| Ordem | Achado e evidência | Mudança proposta | Benefício e como verificar |
|---|---|---|---|
| 1 | Em Alvorada, `src/data/seo/cities.json` promete filtro por quilometragem. O contrato de busca em `src/lib/seminovos-search.ts` não possui esse filtro. **Bug de informação comprovado.** | Retirar apenas a promessa de filtro por km; manter informação de quilometragem onde realmente aparece na ficha. Não restaurar filtro removido pelo usuário. | Conteúdo fiel à experiência. Validar texto e busca. |
| 2 | `RegionalActionCtas.tsx` usa `href="#"` quando o telefone não vem da API; `src/components/QuickSellForm.tsx` não prossegue sem número. **Falha condicional comprovada no código**, não indisponibilidade observada: a API respondeu normalmente na coleta. | Usar o número comercial confirmado como fallback, ou mostrar erro claro com alternativa de contato. | Evitar clique aparentemente funcional que não abre atendimento. Testar API lenta e falha simulada sem enviar mensagem. |
| 3 | `SellCityLandingPage.tsx` envia o botão de venda a `/compra`, embora já tenha formulário local. Antes do formulário há oito carros e outras seções. **Navegação adicional comprovada; impacto comercial ainda não medido.** | Botão “Pedir avaliação do meu carro” → âncora local `#pre-avaliacao`. Formulário antes do estoque de troca. Preservar cidade e critérios de compra direta. | Menos etapas. Medir `sell_evaluation` e contato por sessão na página de venda; clique não é venda concluída. |
| 4 | `CityLandingPage.tsx` coloca vários parágrafos, links e observação de rota antes dos botões. **Estrutura comprovada; efeito na conversão é hipótese.** | Título + introdução curta + “Ver seminovos” e “Falar com a Netcar” + estoque. Procedência, rota e dúvidas abaixo. | Acesso mais rápido aos carros. Comparar cliques em estoque, fichas e WhatsApp por sessão, separado por cidade/dispositivo. |
| 5 | `RegionalVisitPlanner.tsx` retorna `null` sem `routeOrigins`; 11 cidades não têm esses dados. O HTML gerado repete a omissão. **Lacuna funcional comprovada.** | Fallback usando cidade/RS como origem editável no Maps até cada loja de Esteio. Usar bairros somente se conhecidos. | Mais segurança para planejar a viagem. Testar as duas rotas em todas as cidades; não inventar minutos precisos. |
| 6 | Títulos/descrições de várias cidades apresentam minutos fixos; São Leopoldo usa “Reserve o carro pelo WhatsApp”, mas a política de reserva exige sinal e termo. **Redação comprovada; não há prova de prejuízo no ranking.** | Priorizar cidade, seminovos e loja em Esteio no título. Tempo estimado no planejamento de rota, com origem e variação. Usar “Confirme a disponibilidade antes de vir”. | Mensagem coerente e menos expectativa errada. Avaliar CTR por consulta/página e posição comparáveis, sem atribuir causalidade só ao antes/depois. |
| 7 | Há frases como “não uma lista genérica criada apenas para mencionar a cidade” (São Leopoldo), “não promessas para todos os bairros” (Sapucaia) e “sem transformar essa conversa em oferta garantida” (venda em Gravataí). **Texto comprovado; parecer artificial é julgamento editorial.** | Substituir explicações defensivas por informação útil: estoque, como adiantar troca, o que confirmar antes de sair. | Tom mais humano. Revisão manual e comparação de engajamento, sem prometer ranking por reescrever frases. |
| 8 | `RegionalTrustSignals.tsx` enfatiza condições comerciais. A política de seleção poderia aparecer de modo mais claro e breve. **Oportunidade editorial.** | Um bloco curto de procedência com link para `/como-selecionamos-nossos-carros`; i-CHECK somente nas fichas que o possuem. Não inflar Nethelp nem prometer garantia ampliada. | Dar motivo concreto para viajar a Esteio. Medir leitura do bloco, visita ao processo de seleção e avanço para ficha/contato. |

## Cobertura cidade a cidade

Todas as páginas da tabela passaram nos testes de status/canonical citados. A coluna de prioridade é recomendação de execução baseada na proximidade e na utilidade da página, **não ranking atual nem volume de busca medido**. As 19 páginas de venda também compartilham o ajuste de formulário/CTA descrito acima.

| Cidade | Páginas verificadas | Principal ajuste específico |
|---|---|---|
| Canoas | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-canoas) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-canoas) | Prioridade inicial: estoque/contato mais cedo; retirar tempo rígido dos metadados. |
| Nova Santa Rita | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-nova-santa-rita) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-nova-santa-rita) | Prioridade inicial: separar visualmente compra, venda direta e troca; manter rotas e pré-avaliação contextualizadas. |
| Sapucaia do Sul | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-sapucaia-do-sul) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-sapucaia-do-sul) | Prioridade inicial: simplificar texto defensivo sobre distância e aproximar CTA do título. |
| São Leopoldo | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-sao-leopoldo) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-sao-leopoldo) | Prioridade inicial: trocar promessa de reserva por confirmação de disponibilidade; retirar comentário sobre “lista genérica”. |
| Novo Hamburgo | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-novo-hamburgo) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-novo-hamburgo) | Dar motivo concreto para a viagem: seleção, documentos e negociação antecipada. Explicar garantia sem ampliar cobertura. |
| Gravataí | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-gravatai) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-gravatai) | Harmonizar estimativas de viagem; encurtar linguagem defensiva na venda e destacar pré-avaliação. |
| Cachoeirinha | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-cachoeirinha) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-cachoeirinha) | Estoque/contato antes dos parágrafos; manter escolha real da origem de rota. |
| Porto Alegre | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-porto-alegre) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-porto-alegre) | Não resumir todos os bairros a um tempo fixo; adiantar escolha do carro e troca antes da viagem. |
| Alvorada | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-alvorada) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-alvorada) | Corrigir promessa de filtro por km; incluir rotas. |
| Viamão | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-viamao) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-viamao) | Incluir rotas e roteiro de atendimento antes do deslocamento. |
| Guaíba | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-guaiba) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-guaiba) | Incluir rotas; confirmar carro e horário antes da viagem. |
| Campo Bom | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-campo-bom) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-campo-bom) | Incluir rotas e apresentar o estoque antes dos detalhes de acesso. |
| Estância Velha | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-estancia-velha) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-estancia-velha) | Incluir rotas; facilitar envio dos dados do usado sem trocar de página. |
| Montenegro | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-montenegro) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-montenegro) | Incluir rotas e orientação de pré-avaliação antes da viagem. |
| Taquara | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-taquara) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-taquara) | Incluir rotas; oferecer confirmação remota de disponibilidade e documentos. |
| Igrejinha | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-igrejinha) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-igrejinha) | Incluir rotas; reduzir risco de viagem improdutiva com conversa prévia. |
| Gramado | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-gramado) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-gramado) | Incluir rotas; maior foco em carro específico e agendamento, não apenas visita genérica. |
| Caxias do Sul | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-caxias-do-sul) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-caxias-do-sul) | Incluir rotas; conteúdo prático para escolher à distância. Menor prioridade que vizinhas de Esteio até existir demanda comprovada. |
| Bento Gonçalves | [Comprar](https://www.netcarmultimarcas.com.br/seminovos-bento-goncalves) / [Vender](https://www.netcarmultimarcas.com.br/vender-carro-bento-goncalves) | Incluir rotas; orientar fotos, documentos e confirmação antes da viagem. Mesma ressalva de prioridade. |

## Como atrair clientes de outras cidades sem páginas artificiais

O argumento deve ser: “Encontre o carro que você procura, confira a procedência e adiante a negociação antes de vir a Esteio.” Não fingir presença física em Canoas, Novo Hamburgo ou outra cidade.

Exemplo de primeira dobra para Canoas:

> **Seminovos para quem está em Canoas**
>
> Veja os carros das duas lojas da Netcar, em Esteio. Escolha os que interessam e fale com a equipe para adiantar a troca ou combinar sua visita.
>
> **Ver seminovos** · **Falar com a Netcar**

Depois: estoque real → seleção/procedência → rota ajustável → dúvidas específicas. Na venda direta: critérios → pré-avaliação → como funciona a vistoria → rota. Não aplicar os limites de compra direta à troca.

Eu não criaria novas páginas por cidade antes de corrigir essas experiências. Páginas quase iguais que só encaminham ao mesmo destino entram no risco descrito pelo Google como [doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse). Isso é prevenção, não diagnóstico de penalidade na Netcar.

## SEO e mensuração: próxima validação

1. Search Console: filtrar URLs regionais e consultas com cidades; exportar cliques, impressões, CTR e posição por página/consulta/dispositivo, comparando 28 dias completos com período anterior. Separar termos de marca e não marca. A cidade citada na consulta não comprova onde o usuário está.
2. Inspecionar URLs prioritárias: canonical escolhido pelo Google, última leitura e motivo de exclusão. Acessibilidade técnica sozinha não substitui esse passo.
3. Analytics: visitas regionais → ficha do carro → WhatsApp/pré-avaliação. Deduplicar contatos. Não chamar clique de lead confirmado ou venda.
4. Avaliar resultado comercial com atendimentos qualificados e vendas identificáveis. Se amostra pequena, ampliar janela; não concluir efeito por poucos cliques.
5. Médio prazo: estudar HTML inicial com conteúdo para todos os visitantes, reduzindo manutenção de duas renderizações. O Google considera [dynamic rendering um workaround, não solução duradoura](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering). A arquitetura atual não apresentou bloqueio crítico nos testes desta entrega.

## Expointer: publicação e manutenção

- URL permanente: `/expointer-esteio`; não substitui a home nem `/seminovos`.
- Conteúdo compartilhado: `src/data/seo/expointer.json`, usado pelo React e gerador HTML. Atualizar essa fonte a cada edição, sem criar cópias anuais quase iguais.
- Datas de 2026 identificadas como tal, sem afirmar “feira acontecendo agora” depois do término. Fonte: [Expointer oficial](https://www.expointer.rs.gov.br/). Acessos: [orientação do Governo do RS](https://www.estado.rs.gov.br/saiba-as-rotas-e-os-meios-de-transporte-para-chegar-a-expointer-2026). Fontes consultadas em 05/09/2026.
- Atendimento nas lojas fora do parque; não há declaração de parceria ou estande. Horários da loja não são confundidos com a visitação da feira.
- Estoque e rotas rastreados pelos eventos regionais existentes, com tipo `event_landing` e `landing_slug=expointer-esteio`. WhatsApp tem contexto de Expointer e intenções separadas de troca/visita. Consentimento existente preservado.
- SEO incluído em rota React, controlador PHP, regra Apache para crawler, preload de componente, bootstrap de estoque, canonical, sitemap e link no hub de regiões. WebPage/Breadcrumb sem declarar a Netcar organizadora do evento.
- Build completo e validadores de SEO, roteamento, estoque e atribuição passaram. Configuração privada de produção não foi copiada para o worktree de teste; o deploy deve usar o checkout/configuração habitual. PHP/Apache não disponíveis no ambiente de teste: regras verificadas por código/validadores, com conferência HTTP da nova rota a fazer após deploy.
- Nova página não promete posicionar nesta edição, que acaba em 06/09. O [Google não garante indexação imediata](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl). O resultado orgânico exige acompanhamento; divulgar nos canais próprios seria uma ação separada, ainda não executada.

### Conferência depois do deploy

- Abrir a URL de produção em celular e desktop, incluindo acesso direto e pelo hub.
- Conferir HTTP 200, canonical, título, estoque, links de troca e rotas.
- Conferir HTML para Googlebot e URL única no sitemap.
- Inspecionar a URL no Search Console, sem prometer indexação.
- Validar eventos de estoque/rota e WhatsApp com teste identificado, sem confundir teste com lead.
