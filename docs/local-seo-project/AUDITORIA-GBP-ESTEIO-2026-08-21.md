# Auditoria dos Perfis da Empresa — Esteio

Coleta inicial: 21/08/2026, aproximadamente 15h24, a partir de capturas fornecidas pela Netcar em sessão autenticada do Google.

A coleta começou como etapa diagnóstica. As alterações posteriormente autorizadas e executadas estão registradas neste documento.

## Dados comprovados nas capturas

| Campo | Loja 1 | Loja 2 |
|---|---|---|
| Nome público | Netcar (Loja 1) | Netcar (Loja 2) |
| Endereço | Av. Pres. Vargas, 740, Centro, Esteio/RS, 93260-001 | Av. Pres. Vargas, 1106, Centro, Esteio/RS, 93260-001 |
| Telefone | (51) 3473-7900 | (51) 3033-3900 |
| Categoria pública exibida | Revendedora de carros usados | Revendedora de carros usados |
| Nota | 4,8 | 4,9 |
| Avaliações | 513 | 353 |
| Horário exibido na coleta | aberta, fecha às 18h | aberta, fecha às 18h |
| Site/domínio exibido | netcarmultimarcas.com.br | netcarmultimarcas.com.br |
| Interações mostradas no painel | 845 | 382 |
| Força do perfil | “Tudo certo” | “Tudo certo” |
| Gestão | perfil administrado pela conta da captura | perfil administrado pela conta da captura |

O intervalo temporal das métricas de interação não aparece nas capturas. Portanto, 845 e 382 não devem ser usados para comparar desempenho entre as lojas até confirmarmos o mesmo período em “Desempenho”.

## Achados iniciais

### 1. Nome das unidades — validar antes de editar

**Evidência:** comprovado que os nomes públicos são “Netcar (Loja 1)” e “Netcar (Loja 2)”. Nas fachadas visíveis, a marca aparece principalmente como “Netcar”; a Loja 2 também apresenta referência visual “Netcar | RC”.

**Classificação inicial:** hipótese provável de inconsistência com a representação real da marca.

O Google orienta que unidades de uma mesma empresa mantenham o mesmo nome, salvo quando a variação é usada consistentemente na fachada, no site, na papelaria e no reconhecimento público. Não alterar agora: primeiro precisamos confirmar como cada unidade é apresentada no mundo real. Se “Loja 1” e “Loja 2” forem apenas identificadores internos, o caminho mais seguro tende a ser usar o nome real da marca nos dois perfis e diferenciar as unidades pelo endereço, telefone, página e código de loja.

Fonte: [Diretrizes para representar sua empresa no Google](https://support.google.com/business/answer/3038177?hl=pt-BR).

**Confirmação da empresa em 21/08/2026:** a marca usada é “Netcar Multimarcas”, e “Loja 1”/“Loja 2” são diferenciações reais usadas para orientar os clientes entre as duas unidades na mesma avenida. O site também apresenta as unidades dessa forma, e o schema usa “Netcar Multimarcas - Loja 1” e “Netcar Multimarcas - Loja 2”.

**Recomendação atualizada:** padronizar os nomes dos perfis como `Netcar Multimarcas - Loja 1` e `Netcar Multimarcas - Loja 2`, aproximando Google, site e dados estruturados. A alteração pode passar por revisão do Google e só deve ser enviada com autorização específica.

### 2. Página de destino e mensuração por loja

**Evidência inicial:** as capturas mostravam que ambos os perfis apontavam para o mesmo domínio/página genérica, mas não exibiam a URL completa.

**Verificação autenticada:** comprovado que os dois campos “Site” usavam `https://www.netcarmultimarcas.com.br/` sem parâmetros de identificação.

Em 21/08/2026, as duas URLs foram atualizadas com UTMs específicas, mantendo a mesma página de destino. Isso permite separar os acessos e eventos originados em cada perfil sem criar páginas ou operações artificiais por loja.

### 3. Categorias

**Evidência:** comprovado que os dois perfis exibem publicamente “Revendedora de carros usados”.

**Classificação:** comprovado para a categoria pública; sem evidência suficiente sobre categorias secundárias.

A categoria parece coerente com a atividade principal. Ainda precisamos abrir a edição para confirmar se ela é a categoria principal e quais categorias adicionais estão cadastradas. As duas unidades devem compartilhar a principal se prestam o mesmo serviço.

### 4. Reputação

**Evidência:** Loja 1 com 513 avaliações e nota 4,8; Loja 2 com 353 avaliações e nota 4,9.

**Classificação:** comprovado.

É uma base forte, mas a captura não mostra a velocidade de avaliações nos últimos 30, 60 e 90 dias, nem cidades mencionadas. Esses dados ainda serão coletados antes de recomendar metas de cadência.

### 5. Indicador “Força do perfil”

**Evidência:** ambos aparecem como “Tudo certo”.

**Classificação:** comprovado que os perfis passaram pelo indicador de completude; sem evidência de que isso represente força de ranking.

O próprio Google descreve esse indicador como uma ajuda para encontrar campos ou conteúdos ausentes. Ranking local continua dependendo principalmente de relevância, distância e proeminência. Portanto, “Tudo certo” não encerra a auditoria.

Fontes: [Gerenciar a força do perfil](https://support.google.com/business/answer/15691556?hl=pt-BR) e [Melhorar a classificação local](https://support.google.com/business/answer/7091?hl=pt-BR).

### 6. Oportunidades visíveis no painel

- Loja 1: o Google solicita confirmação de horário especial e sugere fotos recentes;
- Loja 2: o Google sugere adicionar perfis de redes sociais e mostra atividade recente de foto;
- ambas possuem acesso a produtos, serviços, posts, avaliações, fotos e desempenho.

Essas sugestões não comprovam, isoladamente, uma deficiência de ranking. Serão tratadas como itens de conferência.

## Próxima coleta necessária

Para concluir a primeira parte da auditoria, abrir **Editar perfil** em cada loja e registrar:

1. nome da empresa;
2. categoria principal e todas as categorias adicionais;
3. descrição da empresa;
4. telefone principal e adicionais;
5. URL completa do site;
6. perfis de redes sociais;
7. horário normal e horários especiais;
8. serviços cadastrados;
9. produtos/veículos cadastrados;
10. data das fotos e posts mais recentes.

Depois, abrir **Desempenho**, selecionar o mesmo período para as duas lojas e exportar ou capturar buscas, visualizações, rotas, ligações e cliques no site.

## Coleta autenticada concluída

Em 21/08/2026, após acesso de leitura ao gerenciador com os dois perfis verificados, foram confirmados os seguintes campos internos:

| Campo | Loja 1 | Loja 2 |
|---|---|---|
| Categoria principal | Revendedora de carros usados | Revendedora de carros usados |
| Categoria secundária | Concessionária | Concessionária |
| Site | https://www.netcarmultimarcas.com.br/ | https://www.netcarmultimarcas.com.br/ |
| Link de produtos/serviços | https://netcarmultimarcas.com.br/seminovos | https://netcarmultimarcas.com.br/seminovos |
| Instagram cadastrado | http://instagram.com/netcar_rc/ | https://www.instagram.com/netcar_rc/ |
| Nome curto | NetcarRC | netcarrc-loja-2 |
| Telefone principal | (51) 3473-7900 | (51) 3033-3900 |
| Telefones adicionais | (51) 3033-3900 e (51) 99729-3118 | (51) 3473-7900 e (51) 99729-3118 |
| WhatsApp | +55 51 99729-3118 | +55 51 99729-3118 |
| Data de abertura cadastrada | 06/10/1997 | 11/01/1997 |
| Horário normal | seg.–sex. 9h–18h; sáb. 9h–16h30; dom. fechado | igual à Loja 1 |
| Áreas de cobertura | 13 municípios além de Esteio | iguais à Loja 1 |

As descrições são semelhantes, mas citam corretamente os respectivos números 740 e 1106. A interface resumida sugeria ausência de redes sociais na Loja 2, porém a abertura do editor confirmou Instagram, Facebook e X já cadastrados.

## Ordem das correções

1. **Conferir as redes sociais da Loja 2** — concluído; Instagram, Facebook e X já estavam cadastrados.
2. **Padronizar os nomes das unidades** — alterar para “Netcar Multimarcas - Loja 1” e “Netcar Multimarcas - Loja 2”, após autorização para envio ao Google.
3. **Validar as datas de abertura por endereço** — as duas datas são diferentes e podem representar a marca, não cada unidade.
4. **Manter os contatos integrados, conferindo apenas sua exatidão** — os telefones cruzados e o WhatsApp compartilhado são coerentes com a operação conjunta confirmada pela Netcar.
5. **Confirmar a operação nas áreas de cobertura** — manter somente cidades em que a Netcar efetivamente entrega ou atende o cliente no local.
6. **Manter o site e o estoque compartilhados** — páginas próprias por loja foram descartadas neste momento; UTMs podem ser usadas apenas para identificar a origem do clique.

## Alterações executadas em 21/08/2026

### Nomes dos perfis

- Loja 1: `Netcar (Loja 1)` → `Netcar Multimarcas - Loja 1`;
- Loja 2: `Netcar (Loja 2)` → `Netcar Multimarcas - Loja 2`.

Os dois envios foram salvos e o Gerenciador de Perfis passou a exibir imediatamente os novos nomes, ambos com estado “Confirmado” e sem atualização do Google pendente. A superfície pública da Pesquisa ainda pode manter o nome anterior durante a propagação.

### Redes sociais da Loja 2

Ao abrir o editor, foram encontrados três perfis já cadastrados:

- X: `https://twitter.com/netcar_rc`;
- Facebook: `https://www.facebook.com/@NetcarRC`;
- Instagram: `https://www.instagram.com/netcar_rc/`.

Como o Instagram já estava presente, nenhuma alteração redundante foi enviada. A sugestão “Adicionar perfis de redes sociais” exibida no painel estava desatualizada em relação aos dados internos.

### Descrições dos perfis

As descrições foram atualizadas para explicar a operação integrada sem sugerir estoques ou estruturas comerciais independentes. Depois de salvar, cada texto foi reaberto no editor autenticado e conferido integralmente.

- Loja 1: `Netcar Multimarcas é uma revenda de veículos seminovos e usados em Esteio/RS, com atuação desde 1997. Esta unidade fica na Av. Presidente Vargas, 740. Nossas duas lojas estão na mesma avenida, a cerca de 400 m, e funcionam de forma integrada: estoque, equipe e atendimento são compartilhados, e qualquer veículo pode ser apresentado ou negociado em ambas. Trabalhamos com veículos selecionados, financiamento, avaliação do usado na troca, entrada parcelada no cartão, despachante credenciado e pós-venda Nethelp.`
- Loja 2: `Netcar Multimarcas é uma revenda de veículos seminovos e usados em Esteio/RS, com atuação desde 1997. Esta unidade fica na Av. Presidente Vargas, 1106. Nossas duas lojas estão na mesma avenida, a cerca de 400 m, e funcionam de forma integrada: estoque, equipe e atendimento são compartilhados, e qualquer veículo pode ser apresentado ou negociado em ambas. Trabalhamos com veículos selecionados, financiamento, avaliação do usado na troca, entrada parcelada no cartão, despachante credenciado e pós-venda Nethelp.`

Em 22/08/2026, a expressão `garantia de até 2 anos`, ainda visível nas descrições públicas, foi removida dos dois perfis conforme orientação da Netcar. Os textos acima foram salvos e reabertos nos dois editores autenticados. A superfície pública pode manter a versão anterior enquanto o Google processa a atualização.

Evidência: **comprovado nos editores autenticados dos dois Perfis da Empresa em 22/08/2026**.

### URLs de site com identificação por perfil

- Loja 1: `https://www.netcarmultimarcas.com.br/?utm_source=google&utm_medium=organic&utm_campaign=gbp_esteio&utm_content=loja_1`
- Loja 2: `https://www.netcarmultimarcas.com.br/?utm_source=google&utm_medium=organic&utm_campaign=gbp_esteio&utm_content=loja_2`

As duas URLs responderam com HTTP 200, sem redirecionamento que removesse os parâmetros. O site contém GA4 (`G-MGPNBDNQ9G`) e o código da aplicação captura `utm_source`, `utm_medium`, `utm_campaign` e `utm_content`, preservando a origem também no rastreamento dos cliques para WhatsApp.

Evidência: **comprovado nos dois editores autenticados e no código do site em 21/08/2026**. Após salvar, cada perfil foi aberto novamente em uma sessão nova e manteve sua respectiva URL.

### Produtos e serviços

Em 21/08/2026, os dois atalhos “Editar produtos” e “Editar serviços” foram abertos em sessão autenticada, sem envio de alterações.

| Item | Loja 1 | Loja 2 | Evidência |
|---|---|---|---|
| Catálogo de Produtos do GBP | vazio; tela inicial mostra “Começar” | vazio; tela inicial mostra “Começar” | comprovado |
| Produtos cadastrados manualmente | nenhum encontrado | nenhum encontrado | comprovado |
| Fonte automática visível no editor | nenhuma | nenhuma | comprovado na interface; não comprova inexistência de integrações externas à conta |
| Serviços personalizados | nenhum encontrado | nenhum encontrado | comprovado |
| Categoria exibida no editor de serviços | Revendedora de carros usados | Revendedora de carros usados | comprovado |
| Link de produtos/serviços | `/seminovos` | `/seminovos` | comprovado anteriormente no editor do perfil |

O repositório do site contém um feed dinâmico para o catálogo do WhatsApp e dados estruturados `Car` nas páginas de veículos. Esses recursos ajudam o site e o rastreamento, mas não alimentam automaticamente o editor de Produtos do Perfil da Empresa.

Segundo a documentação atual do Google, produtos podem ser adicionados manualmente pelo Product Editor. A integração automática pelo aplicativo de inventário local exige país e tipo de varejo elegíveis; o Brasil não aparece entre os países suportados. Os anúncios de veículos via Merchant Center também não estão disponíveis no Brasil e, além disso, constituem mídia paga. Fontes: [Product Editor](https://support.google.com/business/answer/9124203?hl=en), [elegibilidade para inventário local](https://support.google.com/business/answer/13261672?hl=en) e [disponibilidade de anúncios de veículos](https://support.google.com/google-ads/answer/11189169?hl=pt-BR).

**Decisão recomendada para Produtos:** não cadastrar veículos individualmente nos dois perfis enquanto não houver uma rotina automática e confiável. O estoque é compartilhado e muda rapidamente; duplicar cadastros manuais aumenta o risco de mostrar carros vendidos ou informações divergentes.

**Serviços enviados em 21/08/2026:** após aprovação explícita da Netcar, foram cadastrados nos dois perfis:

- Venda de veículos seminovos e usados;
- Avaliação do usado na troca;
- Financiamento de veículos;
- Pós-venda Nethelp;
- Despachante credenciado (nome alterado em 22/08/2026 por orientação da Netcar);
- Entrada parcelada no cartão.

“Garantia de até dois anos” foi deliberadamente excluída da lista de serviços. Os dois editores confirmaram os seis itens e informaram que a edição está com revisão pendente, podendo levar até um dia para publicação. Nenhum produto ou veículo foi cadastrado.

Em 22/08/2026, “Despachante próprio” foi renomeado para “Despachante credenciado” nos dois editores autenticados, por orientação da Netcar; o novo nome foi reaberto e confirmado em ambos.

Evidência: **comprovado nos dois editores autenticados em 21 e 22/08/2026**.

## Validação pública e editorial de 22/08/2026

Coleta: 22/08/2026, 13:57–14:16 (America/Sao_Paulo), no Google Maps e nos editores autenticados.

| Campo | Loja 1 | Loja 2 | Evidência |
|---|---|---|---|
| Nome público | Netcar Multimarcas - Loja 1 | Netcar Multimarcas - Loja 2 | comprovado no Maps |
| Categoria pública | Revendedora de carros usados | Revendedora de carros usados | comprovado no Maps |
| Categoria adicional | Concessionária | Concessionária | comprovado no editor |
| Nota e avaliações | 4,8 e 514 | 4,9 e 355 | comprovado no Maps |
| Endereço | Av. Pres. Vargas, 740, CEP 93260-490 | Av. Pres. Vargas, 1106, CEP 93260-048 | comprovado no Maps e editor |
| Telefone principal | (51) 3473-7900 | (51) 3033-3900 | comprovado no Maps |
| Site | UTM `loja_1` | UTM `loja_2` | comprovado no Maps e editor |
| WhatsApp/agendamento | (51) 99729-3118 | (51) 99729-3118 | comprovado no Maps e editor |
| Horário | seg.–sex. 9h–18h; sáb. 9h–16h30 | igual | comprovado no Maps e editor |
| Foto mais recente indicada | 2 dias | 29 dias | comprovado no Maps |
| Postagem visível | publicada no mesmo dia | publicada no mesmo dia | comprovado no Maps |
| Serviços personalizados | os seis itens cadastrados | os mesmos seis itens cadastrados | comprovado no editor |
| Produtos manuais | nenhum | nenhum | comprovado na auditoria anterior; decisão mantida |

Os seis serviços aparecem integralmente nos dois editores, sob a categoria principal, sem aviso de revisão ou rejeição. O Google Maps não criou uma seção pública com os nomes personalizados; exibe o link compartilhado de produtos e serviços para `/seminovos` e os atributos gerais `Compras na loja`, `Entrega` e `Produtos usados`. A ausência da lista nessa superfície é uma escolha de apresentação do Google e não invalida o cadastro comprovado.

Na Loja 2, o resumo do perfil ainda sugere adicionar redes sociais e o Maps não mostra a seção pública de perfis. A abertura do formulário confirmou, porém, os três endereços preenchidos corretamente: X, Facebook e Instagram. Nenhum cadastro duplicado foi enviado.

A busca administrativa também exibiu um resultado patrocinado da própria Netcar com `gad_campaignid=12642940447`. Isso é forte evidência de campanha ativa, mas não altera a decisão de que anúncios não são necessários para executar o projeto orgânico.

## Contexto operacional confirmado

A Netcar informou que as duas lojas estão a aproximadamente 400 m, na mesma avenida, e funcionam como uma única operação. Estoque, equipe, vendedores e atendimento são compartilhados; um veículo localizado em uma unidade pode ser apresentado e vendido pela outra. A Loja 2 é fisicamente menor, o que torna natural uma diferença de fluxo, vendas e avaliações.

Consequências para a estratégia:

- não estabelecer meta de igualdade de avaliações ou vendas entre os perfis;
- não criar páginas separadas que sugiram estoques ou operações independentes;
- acompanhar o GBP principalmente no consolidado da marca;
- preservar endereço, telefone principal, rota e fotos próprias de cada ponto físico;
- usar descrições que expliquem a integração e reduzam confusão para o cliente.
