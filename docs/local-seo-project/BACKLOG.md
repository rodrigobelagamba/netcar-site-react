# Backlog priorizado

O estado operacional fica em `project.json`. Esta visão explica o resultado esperado e a sequência recomendada.

| ID | Prioridade | Cidade | Entrega | Estado | Dependência | Critério principal |
|---|---|---|---|---|---|---|
| PROJ-001 | P0 | Todas | Estruturar projeto, métricas e sprint | concluído | nenhuma | arquivos validados no repositório canônico |
| TECH-001 | P0 | Todas | Confirmar 301/410 e metadados em produção | concluído | nenhuma | 200/301/404/410, canonicals e `noindex` validados no servidor em 22/08/2026 |
| ENTITY-001 | P0 | Esteio | Confirmar schema das duas lojas em produção | concluído | nenhuma | duas entidades `AutoDealer`, CEPs, telefones e CIDs confirmados em produção em 22/08/2026 |
| GBP-001 | P0 | Esteio | Auditar integralmente os dois perfis | concluído | nenhuma | campos internos e públicos conferidos nos dois perfis em 22/08/2026 |
| MEAS-001 | P0 | Esteio/Sapucaia/Canoas/São Leopoldo/Nova Santa Rita/Cachoeirinha/Gravataí/Porto Alegre | Criar linha de base recorrente | em andamento | GSC, GA4 e CRM | GBP de 90 dias arquivado; demais canais pendentes |
| GBP-002 | P1 | Esteio | Criar URLs UTM específicas por loja | concluído | GBP-001 | URLs salvas e reconfirmadas nos dois perfis em 21/08/2026 |
| GBP-003 | P1 | Esteio | Explicar a operação integrada nos dois perfis | concluído | texto aprovado | descrições salvas e reabertas para conferência em 21/08/2026 |
| GBP-004 | P1 | Esteio | Cadastrar serviços permanentes nos dois perfis | concluído | nenhuma | os mesmos seis serviços aparecem nos dois editores; Maps não renderiza a lista personalizada |
| STORE-001 | P3 | Esteio | Reavaliar página própria da Loja 1 | backlog | mudança operacional futura | criar somente se existir utilidade própria comprovada |
| STORE-002 | P3 | Esteio | Reavaliar página própria da Loja 2 | backlog | mudança operacional futura | criar somente se existir utilidade própria comprovada |
| REV-001 | P1 | Regional | Implantar rotina ética de avaliações | concluído | acompanhamento semanal | links oficiais validados, processo existente padronizado e linha de base de 30/60/90 dias registrada em 22/08/2026 |
| PERF-001 | P1 | Todas | Corrigir o primeiro lote de LCP/INP | verificar produção | janela de campo de 28 dias | Lighthouse pós-deploy: Home 100 mobile/desktop e Canoas 98 mobile; aguardar Core Web Vitals |
| SAP-001 | P1 | Sapucaia | Reforçar página local com utilidade e prova real | em andamento | nova medição e prova autorizada | produção validada e indexação solicitada em 22/08; aguardar 14–28 dias e prova local |
| CAN-001 | P1 | Canoas | Reforçar página local com utilidade e prova real | em andamento | nova medição e materiais locais | produção validada e indexação solicitada em 22/08; aguardar 14–28 dias e prova autorizada |
| CAN-002 | P1 | Canoas | Monitorar R2 Motors, Dotto e líderes observados | em andamento | repetição mensal no mesmo ponto | perfis e sites registrados em 21/08; primeira fotografia de 8 termos em Search, Map Pack e Maps registrada em 22/08 |
| SLP-001 | P1 | São Leopoldo | Reforçar página para consultas genéricas locais | em andamento | nova medição e prova local | produção validada e indexação solicitada em 22/08; aguardar 14–28 dias |
| CIT-001 | P2 | Esteio/Sapucaia/Canoas/São Leopoldo/Nova Santa Rita/Cachoeirinha/Gravataí | Padronizar e conquistar citações locais legítimas | backlog | retomada autorizada pela Netcar | auditoria concluída; correções externas não serão executadas nesta sequência por decisão de 22/08 |
| INT-001 | P2 | Regional | Interligar cidades, modelos e estoque | verificar produção | deploy da master | páginas locais ligam a seis seleções com estoque; landings ligam aos quatro mercados prioritários mais próximos; React, HTML crawler e build validados |
| NSR-001 | P1 | Nova Santa Rita | Publicar e medir página-piloto local | em andamento | medição 60–90 dias | compra e venda validadas em produção e enviadas à fila de indexação em 22/08; acompanhar tração |
| CCH-001 | P1 | Cachoeirinha | Reforçar página para consultas comerciais genéricas | em andamento | nova medição e prova local | produção validada e indexação solicitada em 22/08; repetir GSC em 14–28 dias |
| GRA-001 | P1 | Gravataí | Reforçar página para consultas de seminovos | em andamento | nova medição e prova local | produção validada e indexação solicitada em 22/08; repetir GSC em 14–28 dias |
| POA-001 | P2 | Porto Alegre | Corrigir distância e qualificar a página sem ampliar prioridade | em andamento | nova medição, leads e vendas | produção validada e indexação solicitada em 22/08; medir em 28–60 dias |
| EXP-001 | P3 | Porto Alegre | Reavaliar expansão | em andamento | GA4, CRM e nova janela do GSC | GSC atual indica médio prazo; confirmar com leads e vendas |

## Convenção de estados

- `concluído`: resultado entregue e validado;
- `verificar produção`: implementação existe, mas falta prova no ambiente público;
- `pronto`: pode iniciar quando a equipe decidir;
- `backlog`: ainda depende da sequência, material ou decisão indicada;
- `bloqueado`: não pode avançar sem uma dependência explícita.
