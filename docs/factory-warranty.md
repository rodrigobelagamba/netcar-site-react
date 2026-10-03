# Carimbo de garantia de fábrica

O visual escolhido é o circular A. A integração usa um único registro principal
por unidade. A matriz schema2 contém cinco registros de conteúdo revisados e
dez pendentes, com `enabled: true` após autorização específica recebida em
03/10/2026 às 23:39:29 UTC para somente essas cinco unidades. A revisão por unidade,
fontes, consulta atual por ID e hashes da origem estão em
`docs/audits/factory-warranty-2026-10-03.json`.

| Unidade | Identidade exata da API | Ano estimado | Critério de exibição |
| --- | --- | --- | --- |
| 20066 | TIGGO 7 PRO MAX DRIVE TURBO | 2027* | Geral 3 anos; abaixo de 100.000 km |
| 19994 | ONIX PREMIER PLUS TURBO | 2027* | Geral 3 anos; abaixo de 100.000 km |
| 20038 | HB20 LIMITED | 2029* | Geral 5 anos; abaixo de 100.000 km |
| 19857 | KICKS SENSE TURBO | 2028* | Geral 3 anos; abaixo de 100.000 km |
| 19587 | TERA HIGH TURBO | 2028* | Regra geral 3 anos; sem limite |

## Regra de exibição

`factoryWarrantyStampFor` é compartilhado pelo estoque, similares e ficha.
Fora da prévia local, o resolver exige simultaneamente:

- Matriz de versão conhecida e habilitada.
- Exatamente um registro da unidade, com status `approved` e revisão não futura.
- ID, marca, versão do modelo, ano de fabricação e ano-modelo iguais ao catálogo.
- Opcional108 confirmado pelo registro e sinal atual `garantia_fabrica` na API.
- Condições conferidas e uso explicitamente conhecido, ou uma política comum
  documentada. A política comum mantém o uso real como `unknown`.
- Prazo da garantia básica do veículo e fonte identificada por URL, localização
  no documento e revisão aplicável. Não se busca o maior prazo da marca.
- Fingerprint da revisão compatível com identidade, cobertura, prazo, uso,
  regra de km, confirmação108 e fontes. Editar esses campos invalida o registro
  até uma nova revisão explícita.
- Km atual válido, sem regredir abaixo do valor revisado e abaixo do limite,
  quando houver. `unknown` não equivale a ilimitado.

Qualquer ausência, conflito, revogação, mudança incompatível ou veículo vendido
resulta em nenhum carimbo. O antigo selo por tag isolada também foi removido;
não existe caminho alternativo de exibição sem a verificação.

A API frontend conserva `diferenciais` por tag, não um ID numérico108. Portanto,
o frontend não inventa esse mapeamento: a rotina de auditoria precisa confirmar
108 no registro; o render também exige a tag atual publicada pelo adaptador.
A rotina deve confirmar essa correspondência ao produzir a matriz definitiva.

## Contrato do registro

Tipos e função canônica: `src/lib/factoryWarranty.ts`.

| Campo | Significado |
| --- | --- |
| `recordId`, `reviewedAt`, `status` | Revisão identificada, data ISO e decisão explícita |
| `vehicle` | `vehicleId`, `brand`, `modelVersion`, `manufactureYear`, `modelYear` |
| `optionalId: 108`, `optionalConfirmed: true` | Confirmação da marcação no cadastro |
| `conditionsConfirmed`, `usage` | Ateste operacional aceito e uso real; não converter desconhecido em particular |
| `commonPolicy` | Fundamento documental comum quando o uso real é desconhecido |
| `scope`, `termYears` | Cobertura principal e prazo comprovados |
| `reviewedMileageKm`, `mileage` | Km revisado; `limited` com `limitKm`, `unlimited` ou `unknown` |
| `sources[]` | ID, URL, localização, revisão e verificação estruturada da fonte específica |
| `confirmedExpiryDate` | Opcional; data efetiva documentada, nunca inferida do FAB |
| `approvedFingerprint` | Resultado de `factoryWarrantyReviewFingerprint(record)` após revisão |

O fingerprint é uma serialização canônica legível, não assinatura nem prova
independente de aprovação. A rotina deve gerá-lo somente depois da revisão;
o site jamais o regenera para aprovar uma alteração automaticamente.
IDs, nomes e anos devem usar a identidade exata do catálogo atual. Por exemplo,
`TERA HIGH` no ERP não deve ser igualado automaticamente a `TERA HIGH TURBO` na
API. No ID19587 essa correspondência foi explicitamente encerrada pela consulta
atual por ID, fabricação/modelo, km, preço e tag. A regra não cria um alias geral.

### Cobertura comum e fontes

O schema2 acrescenta `commonPolicy` com dois fundamentos distintos:

- `documented-regime-intersection`: exatamente os dois ramos documentados,
  ambos de garantia básica e com a mesma duração. Aceita os pares
  `non-commercial/commercial` ou `cpf/cnpj`, sem igualar titularidade a uso.
  O resolver calcula o menor limite quilométrico dos ramos e exige que o
  limite de exibição seja exatamente esse. Prazo diferente, ramo incompleto,
  limite desconhecido ou cobertura restrita invalidam a política.
- `documented-general-rule`: uma única regra geral expressa do manual do
  modelo. É o fundamento do Tera; não foi inventada uma tabela de uso comercial.

Os quatro tetos de 100.000 km são critérios conservadores de exibição. Não
afirmam uso comercial nem alteram o limite contratual de um proprietário
particular. BYD com prazos distintos não recebe essa política automaticamente.

Cada ramo referencia `sourceIds` existentes, vinculados ao mesmo `reviewId`.
A fonte exige `verification.status: verified`, código/edição presente na
revisão, ano-modelo aplicável e revisão datada. Textos como “revisão pendente”
não são evidência válida, mesmo com fingerprint recalculado. Campos de
verificação não são prova independente: a revisão documental correspondente
deve existir no registro de auditoria. O build testa a correspondência entre
as cinco fontes, políticas e identidades cadastradas e essa revisão.

O fingerprint v2 inclui a política completa e a verificação das fontes;
fingerprints antigos e matrizes schema1 não são aceitos. Ele não é recalculado
durante o render.

A normalização de origem trouxe, por engano, a pendência Honda na linha Tera.
A integração usa a entrada VW específica de `coverage-review.json`, confirmada
em `rules_us_vw.json`, e registra a correção no relatório versionado. Os arquivos
de origem foram preservados. As duas unidades Honda continuam pendentes pela
cláusula histórica MY2024; não foram promovidas por uma revisão textual genérica.

A matriz tem um único registro principal por veículo. Não importar várias
linhas de bateria, motor e veículo como selos separados. O texto geral
“Garantia de fábrica” aceita apenas `scope: basic-vehicle`. Uma cobertura
restrita ou extensão ainda não ganha esse título; deve aguardar revisão do
rótulo e do registro principal, sem substituir a regra apenas pela marca.

## Ano estimado e vigência

O ano exibido é fabricação + prazo da unidade revisada, com a nota:

> *Ano estimado pela fabricação. Vencimento exato, cobertura e limite de km conforme manual da montadora.

Ano-modelo não substitui fabricação. O cálculo não cria uma data31/12.
Se o ano estimado for anterior ao atual, não exibir. No próprio ano final,
exigir uma data de vencimento confirmada e não vencida; sem isso, não exibir.
Uma data de vencimento já vencida sempre bloqueia, inclusive quando o ano
estimado ainda é futuro.

## Novos XMLs e mudanças

O gate roda no próprio render, com o catálogo atual e a matriz versionada.
Um veículo novo não recebe prazo por marca/ano. Alteração de versão/anos,
retirada da flag, km atingindo o limite e registros conflitantes suprimem o
carimbo sem depender de um Mac conectado ou de um novo build. A coleta/rotina
read-only pode sugerir registros para revisão; não altera ERP, feed ou matriz
aprovada automaticamente. Uma nova aprovação da matriz exige versão e release.

## Validação e publicação pendente

`npm run stock:test-warranty` cobre os cenários de bloqueio e integra o início
do build. Rodar também TypeScript, lint dos arquivos alterados, build e prévia
nas larguras360/390/768/1024/1440. A prévia exige
`DEV && VITE_WARRANTY_PREVIEW=1` e apenas abre o interruptor de release em memória.
Usa os mesmos registros e todos os bloqueios, inclusive flag, identidade e km.
O fixture antigo limitado ao ID Tera foi removido. Desabilitar a matriz remove
todos os carimbos; habilitá-la não aprova registros pendentes nem veículos novos.

Para publicar as cinco unidades revisadas, após aprovação específica de publicação:

1. Integrar apenas o delta do carimbo sobre o master vigente. Preservar WIP,
   commits de outras tarefas e proteções atuais de certificados/galeria.
   Não publicar este snapshot antigo inteiro nem reaplicar patches antigos.
2. Conferir fila do painel em `/api/jobs` e `/api/status` antes da sincronização;
   a concorrência do workflow não cobre todos os jobs iniciados no painel.
3. O workflow `.github/workflows/devops-deploy.yml` usa `ref: master`,
   `deploy_social: none` e `publish_site: true` para sincronizar e publicar.
   O nome correto é `publish_site`, não `public_site`.
   `publish_site: false` faz só sincronização. Não há input de somente build.
4. O workflow com `true` já chama o deploy pelo painel: não duplicar o POST.
   Ele resolve a branch no momento da execução; conferir o SHA realmente
   sincronizado, não assumir que é o SHA original do dispatch.
5. Acompanhar o job até `succeeded` e relacionar `repo.fullHash`, `dist.head`,
   `dist.builtFromSource`, `pending.lastDeploy` e assets públicos. Build ou
   workflow verde isolado não prova publicação correta.
6. Conferir elegíveis, indeterminados, vendidos, flag removida e ficha/estoque
   reais. Não anunciar ganho comercial ou SEO antes de medição posterior.

A execução e o resultado da publicação são registrados separadamente; a
autorização e o build, isoladamente, não comprovam publicação concluída.

## Próximos veículos e revisão periódica

A automação existente “Validar garantias dos veículos” está habilitada para
08h e 14h em `America/Sao_Paulo`, a partir de 04/10/2026. A consulta de sua
configuração em 03/10 não mostrou execução anterior. Essa tarefa usa o Mac
conectado para coletar e revisar candidatos; não altera cadastro, site, matriz
nem publica. Falta de Mac impede a rodada de revisão, não desliga o gate do site.

Um novo marcado108 continua sem selo até receber identidade, regra e fontes
compatíveis em registro revisado. Atualizar a matriz exige commit, testes e
release aprovado. Remover a tag, mudar identidade ou atingir o limite na API
suprime o selo quando o catálogo atualizado é carregado pelo cliente. Isso
não é promessa de push em tempo real nem de interrupção de uma aba já aberta
antes do próximo carregamento/refetch. Falha da API preserva o comportamento
de cache do catálogo; o resolver não consulta ERP diretamente.
