# Backlog priorizado

O estado operacional fica em `project.json`. Esta visão explica o resultado esperado e a sequência recomendada.

| ID | Prioridade | Cidade | Entrega | Estado | Dependência | Critério principal |
|---|---|---|---|---|---|---|
| PROJ-001 | P0 | Todas | Estruturar projeto, métricas e sprint | concluído | nenhuma | arquivos validados no repositório canônico |
| TECH-001 | P0 | Todas | Confirmar 301/410 e metadados em produção | concluído | nenhuma | 200/301/404/410, canonicals e `noindex` validados no servidor em 22/08/2026 |
| ENTITY-001 | P0 | Esteio | Confirmar schema das duas lojas em produção | concluído | nenhuma | duas entidades `AutoDealer`, CEPs, telefones e CIDs confirmados em produção em 22/08/2026 |
| GBP-001 | P0 | Esteio | Auditar integralmente os dois perfis | em andamento | campos internos dos perfis | categorias, serviços, produtos, fotos e NAP documentados |
| MEAS-001 | P0 | Esteio/Sapucaia/Canoas | Criar linha de base recorrente | em andamento | GSC, GA4 e CRM | GBP de 90 dias arquivado; demais canais pendentes |
| GBP-002 | P1 | Esteio | Criar URLs UTM específicas por loja | concluído | GBP-001 | URLs salvas e reconfirmadas nos dois perfis em 21/08/2026 |
| GBP-003 | P1 | Esteio | Explicar a operação integrada nos dois perfis | concluído | texto aprovado | descrições salvas e reabertas para conferência em 21/08/2026 |
| GBP-004 | P1 | Esteio | Cadastrar serviços permanentes nos dois perfis | verificar produção | revisão do Google | seis serviços enviados igualmente; “Despachante credenciado” reconfirmado nos dois editores em 22/08/2026; confirmar publicação pública |
| STORE-001 | P3 | Esteio | Reavaliar página própria da Loja 1 | backlog | mudança operacional futura | criar somente se existir utilidade própria comprovada |
| STORE-002 | P3 | Esteio | Reavaliar página própria da Loja 2 | backlog | mudança operacional futura | criar somente se existir utilidade própria comprovada |
| REV-001 | P1 | Regional | Implantar rotina ética de avaliações | backlog | processo de atendimento | cadência registrada, sem seleção indevida de clientes |
| PERF-001 | P1 | Todas | Corrigir o primeiro lote de LCP/INP | verificar produção | janela de campo de 28 dias | Lighthouse pós-deploy: Home 100 mobile/desktop e Canoas 98 mobile; aguardar Core Web Vitals |
| SAP-001 | P1 | Sapucaia | Reforçar página local com utilidade e prova real | em andamento | deploy e prova autorizada | GSC auditado; conteúdo local reforçado no código em 22/08; produção ainda pendente |
| CAN-001 | P1 | Canoas | Reforçar página local com utilidade e prova real | em andamento | nova medição e materiais locais | produção validada e indexação solicitada em 22/08; aguardar 14–28 dias e prova autorizada |
| CAN-002 | P1 | Canoas | Monitorar R2 Motors, Dotto e líderes observados | em andamento | repetição mensal no mesmo ponto | perfis e sites registrados em 21/08; primeira fotografia de 8 termos em Search, Map Pack e Maps registrada em 22/08 |
| CIT-001 | P2 | Esteio/Sapucaia/Canoas | Conquistar citações locais legítimas | backlog | lista de parceiros | menções indexáveis e coerentes, sem compra de link artificial |
| INT-001 | P2 | Regional | Interligar cidades, modelos e estoque | backlog | páginas revisadas | links úteis por intenção e sem páginas órfãs |
| NSR-001 | P2 | Nova Santa Rita | Validar demanda antes de ampliar conteúdo | backlog | GSC/CRM 60–90 dias | decisão baseada em impressões, leads e vendas |
| EXP-001 | P3 | Demais cidades | Reavaliar expansão | backlog | resultado das fases 1–3 | prioridade recalculada com dados atuais |

## Convenção de estados

- `concluído`: resultado entregue e validado;
- `verificar produção`: implementação existe, mas falta prova no ambiente público;
- `pronto`: pode iniciar quando a equipe decidir;
- `backlog`: ainda depende da sequência, material ou decisão indicada;
- `bloqueado`: não pode avançar sem uma dependência explícita.
