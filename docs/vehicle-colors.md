# Nomes de cores por unidade

A cor da API/XML/ERP continua intacta, inclusive nos filtros. A ficha pode exibir
`COR ORIGINAL (Nome oficial)` somente pelo resolver `src/lib/vehicleColor.ts`.
O registro versionado `src/data/vehicle-color-confirmations.json` começa vazio:
a aprovação visual de 15/11/2026 não confirmou a tinta de nenhuma unidade.
Nenhum candidato de catálogo foi promovido a fato.

## Evidência e autorização
Cada registro requer ID e chave física opaca, marca/modelo/versão, fabricação,
ano-modelo, motor, câmbio, cor original, nome oficial, comprovação individual
(código de pintura, documento de fábrica ou confirmação explícita do dono),
referência pública opaca da evidência e referência pública opaca da autorização.
A evidência integral fica no histórico privado; nomes de pessoas, links internos
ou notas privadas não entram no registro entregue ao navegador. verifiedBy
indica apenas o papel owner/document-review, nunca o nome de uma pessoa.
Não guardar placa, VIN, contatos ou documentos pessoais neste JSON público.
Catálogo prova que uma tinta existia naquela versão, não qual tinta este carro usa.
Apenas aprovar a aparência da prévia não confirma a pintura do veículo.

## Rotina existente
A auditoria `scripts/audit-vehicle-equipment.ts`, já chamada pelo wrapper diário,
conserva cor e chave física minimizadas e inclui a resolução de cor no relatório e
em chave de revisão própria da cor, sem invalidar pareceres de equipamentos.
Unidade nova, mudança relevante de identidade/cor ou registro
reabre a análise. O campo `color.researchQuery` prepara pesquisa exata; o achado
visível explica que ainda é necessário pesquisar e comprovar a unidade.
Não há novo cron/coletor nem pesquisa irrestrita automática. A auditoria não escreve
na origem, aprova, publica ou transforma candidato em cor oficial.

## Validação e reversão
Testar com `node --import tsx --test scripts/tests/vehicle-color.test.ts`, testes
da auditoria, lint, typecheck e build conforme os guias. Conferir ficha pública
após release, sem confundir CI com deploy. A ausência de registro ou qualquer
incompatibilidade mantém somente a cor original. Reimportar o XML não apaga o
registro e não transporta confirmação para outra unidade.
Reversão: retirar o registro específico (preservando histórico Git) ou reverter
apenas a release de cor. Não fazer reset de mudanças de outras tarefas.
Esta primeira entrega não altera SEO ou laudos: mantêm a cor genérica verdadeira.
