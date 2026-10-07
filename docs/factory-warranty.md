# Carimbo de garantia de fábrica

O visual escolhido é o circular A. A integração usa um único registro principal
por unidade. A matriz schema2 contém dez registros principais revisados e
seis pendentes, com `enabled: true`: sete coberturas gerais e três de motor e
câmbio. Das cinco unidades autorizadas em 03/10/2026 às 23:39:29 UTC, quatro
mantêm seus registros originais; a exibição do Tiggo7 20066 foi substituída
pela revisão individual de motor e câmbio em 05/10. BYD19924 e Tracker20049
foram incorporados em 05/10 após a pesquisa resolver suas condições específicas. A revisão
por unidade, fontes, consultas atuais por ID e hashes da origem estão em
`docs/audits/factory-warranty-2026-10-03.json` e
`docs/audits/factory-warranty-2026-10-05.json`. O BYD tem uma cobertura de bateria
de tração revisada separadamente. Os Tiggo8 20029/20041 têm apenas motor e
câmbio aprovados, conforme `docs/audits/factory-warranty-tiggo-powertrain-2026-10-05.json`.
A revisão posterior do Tiggo7 está em
`docs/audits/factory-warranty-tiggo7-powertrain-2026-10-05.json`; o adendo preserva
sua revisão geral anterior e confirma que os outros 14 registros não mudaram.

| Unidade | Identidade exata da API | Ano estimado | Critério de exibição |
| --- | --- | --- | --- |
| 20066 | TIGGO 7 PRO MAX DRIVE TURBO — motor e câmbio | 2029* | Prazo original de 5 anos; uso não comercial atestado para a unidade; sem limite de km |
| 19994 | ONIX PREMIER PLUS TURBO | 2027* | Geral 3 anos; abaixo de 100.000 km |
| 20038 | HB20 LIMITED | 2029* | Geral 5 anos; abaixo de 100.000 km |
| 19857 | KICKS SENSE TURBO | 2028* | Geral 3 anos; abaixo de 100.000 km |
| 19587 | TERA HIGH TURBO | 2028* | Regra geral 3 anos; sem limite |
| 19924 | SONG PRO GS | 2030* | Geral 6 anos; uso não comercial confirmado; sem limite |
| 19924 | SONG PRO GS — bateria de tração | 2032* | Cobertura separada de 8 anos; uso não comercial confirmado; condições e exclusões do manual |
| 20049 | TRACKER LT TURBO | 2027* | Geral 3 anos; exceção R8C/R8Z excluída para a unidade; abaixo de 100.000 km |
| 20029 / 20041 | TIGGO 8 MAX DRIVE TURBO — motor e câmbio | 2028* | Prazo original de 5 anos; uso não comercial atestado para ambas; sem limite de km |
| 20075 | RENEGADE LONGITUDE T270 TURBO | 2028* | Geral 5 anos; uso particular e ausência de limite de km atestados especificamente para a unidade |

O Renegade20075 foi incluído em 07/10/2026, preservando os 15 registros anteriores.
O comunicado oficial Jeep/Stellantis de 19/04/2024 comprova o prazo de cinco
anos para o Renegade MY2024; uso particular, quilometragem ilimitada e condições
de manual/manutenção vêm do ateste operacional específico da unidade. Não são
condições extraídas desse comunicado nem uma regra para outros Jeep. A auditoria
`docs/audits/factory-warranty-renegade-20075-2026-10-07.json` separa essas fontes
e registra a correspondência individual entre o nome do XML e o nome completo
da API. O ano2028 é a estimativa FAB2023+5, sem data exata de vencimento.

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
fontes, políticas e identidades cadastradas e as revisões documentais.

O fingerprint v2 inclui a política completa e a verificação das fontes;
fingerprints antigos e matrizes schema1 não são aceitos. Ele não é recalculado
durante o render.

A normalização de origem trouxe, por engano, a pendência Honda na linha Tera.
A integração usa a entrada VW específica de `coverage-review.json`, confirmada
em `rules_us_vw.json`, e registra a correção no relatório versionado. Os arquivos
de origem foram preservados. As duas unidades Honda continuam pendentes pela
cláusula histórica MY2024; não foram promovidas por uma revisão textual genérica.

A matriz tem um único registro principal por veículo. Não importar várias
linhas principais de bateria, motor e veículo com o mesmo ID. O texto geral
“Garantia de fábrica” aceita apenas `scope: basic-vehicle`.

### Bateria de tração separada

O campo opcional `supplementalCoverages` aceita nesta versão um único registro
de `scope: traction-battery`, com status, revisão, ateste, uso particular,
prazo, km, fontes e fingerprint próprios. O fingerprint suplementar também
vincula a aprovação principal; alterar os dados da unidade exige nova revisão
da cobertura. Acrescentar bateria não altera o fingerprint principal. A revisão
posterior de motor e câmbio do Tiggo7 tem seu próprio fingerprint e histórico. Suplemento pendente, duplicado, revogado ou incompatível suprime
somente seu selo; duplicidade ou revogação da unidade principal suprime ambos.

`resolveFactoryTractionBatteryWarranty` valida a identidade, flag, fontes e
ateste do principal, mas não herda seu prazo final ou teto quilométrico.
Assim, a garantia geral pode terminar antes da bateria. Cada cobertura exige
data efetiva confirmada no seu próprio ano final estimado. Ausência de dados,
regressão de km ou mudança incompatível da unidade bloqueiam ambas.

O retorno da bateria tem escopo obrigatório e um rótulo explícito de **bateria
de tração** em SVG, texto legível e nome acessível. Na ficha, os selos ficam
lado a lado; no card, o segundo fica no rodapé para preservar a foto e o selo
principal. A nota explica que a revenda não reinicia os prazos. A aprovação
do Song Pro19924 não cria regra para todo BYD ou para baterias de outros tipos;
o prazo não promete substituição gratuita irrestrita nem ausência de desgaste.

### Motor e câmbio dos Tiggo8 e Tiggo7

Os registros principais dos IDs20029/20041 têm escopo `powertrain`, prazo de
cinco anos e uso particular confirmado individualmente em 05/10. O resolver
`resolveFactoryPowertrainWarranty` exige uso particular explícito, sem política
comum, e todos os gates de identidade, fontes, data, km, flag e fingerprint.
O helper usa os mesmos dados originais do catálogo; não há prazo por marca.
O fingerprint específico também vincula o subtipo motor/transmissão, a
referência do ateste individual e o rótulo aprovado; os fingerprints gerais
não mudam. A matriz mantém um único registro principal por ID; as duas
pendências gerais ficam separadas na auditoria. Acrescentar outro principal
do mesmo ID bloqueia todos os seus selos, mesmo com escopo diferente.
A fonte é o manual B09999T8006, janeiro/2024, páginas10-3/10-4, aplicável ao
Tiggo8 Max Drive brasileiro2023/2024. São 36 meses originais mais24 meses
complementares de motor/transmissão, totalizando60 meses; não são cinco anos
novos desde a revenda. A fonte e o ateste constam da auditoria versionada.

Um único carimbo circular mostra **Motor e câmbio até2028***, sem legenda
externa repetida. A ressalva curta informa: “*Ano estimado pela fabricação.
Prazo original e condições conforme manual da montadora.” O link “Consultar
manual” identifica o documento; detalhes da revisão permanecem na auditoria. O valor2028 é a estimativa
FAB2023+5, sem inventar uma data efetiva. Em2028, a cobertura também exigirá
vencimento real confirmado e ainda vigente.

O resolver geral continua limitado a `basic-vehicle`: esses dois Tiggo não
recebem selo geral. A regra geral de três anos/estimativa2026 permanece
registrada na auditoria como inelegível sem vencimento efetivo comprovado.
Na revisão posterior de 05/10, o Tiggo7 Pro Max Drive 20066 recebeu um único
registro principal `powertrain`, após o proprietário confirmar individualmente
que não teve uso comercial. A fonte própria é o manual **B09999T7303**, janeiro
de 2024/1, ligado pelo portal oficial ao modelo brasileiro2024/2025, páginas
PDF298/299 (impressas10-3/10-4). O prazo total de cinco anos usa FAB2024 para
estimar **2029***; a revenda não reinicia esse prazo. Não há data efetiva
inventada, e em2029 a exibição exigirá vencimento real confirmado e não vencido.
O fingerprint vincula o ateste `Sentinel_288a06854d888191ba9530283b115526`, o
subtipo motor/transmissão, o rótulo e o link próprio do manual em `#page=298`.

A revisão geral anterior do Tiggo7, estimada em2027, fica somente no histórico
do adendo. A substituição de exibição não declara essa garantia geral expirada.
Revogação, mudança incompatível ou falha da nova revisão ocultam o selo, sem
reativar automaticamente a revisão geral antiga. Não se acrescenta segundo
registro principal nem segundo selo para o Tiggo7. A nota curta aprovada e o
link “Consultar manual” são exatamente os mesmos componentes dos Tiggo8.
Os outros14 registros, os seis selos gerais restantes e a bateria BYD foram
preservados. Extensões e bateria genérica continuam sem caminho de selo produtivo.

## Ano estimado e vigência

O ano exibido é fabricação + prazo da unidade revisada, com a nota:

> *Estimativa pela fabricação e documentação oficial da montadora. Validade, cobertura e km conforme manual do modelo/ano.

A referência aos documentos oficiais se aplica somente aos registros revisados
aceitos pelo resolver, com fonte compatível com o modelo/ano. É uma estimativa
apresentada pela Netcar, não um certificado emitido pela montadora. A nota usa
10,5 px na aplicação compacta, preserva a cor de contraste e fica no rodapé;
o desenho circular, o tamanho do selo e sua posição junto à foto não mudam.

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

Os cards entregam ao gate o objeto original do catálogo, separado dos valores
de apresentação. Substituir ano ausente pelo ano atual ou km ausente por zero
para compor a interface nunca serve de evidência para o carimbo. A ausência
dos dados originais ou um ID diferente do card também bloqueia a exibição.
Um aumento normal de km, ainda abaixo do teto, mantém o registro elegível;
regressão, ausência, valor inválido ou chegada ao teto bloqueiam o selo.

## Validação e publicação pendente

`npm run stock:test-warranty` cobre os cenários de bloqueio e integra o início
do build. Rodar também TypeScript, lint dos arquivos alterados, build e prévia
nas larguras360/390/768/1024/1440. A prévia exige
`DEV && VITE_WARRANTY_PREVIEW=1` e apenas abre o interruptor de release em memória.
Usa os mesmos registros e todos os bloqueios, inclusive flag, identidade e km.
O fixture antigo limitado ao ID Tera foi removido. Desabilitar a matriz remove
todos os carimbos; habilitá-la não aprova registros pendentes nem veículos novos.

Para publicar os registros revisados, após aprovação específica de publicação:

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
08h e 14h em `America/Sao_Paulo`, a partir de 04/10/2026. Configuração conferida
em 05/10/2026; o horário da última execução registrado pela automação não
comprova, isoladamente, conclusão da pesquisa. Essa tarefa usa o Mac
conectado para coletar e revisar candidatos; não altera cadastro, site, matriz
nem publica. Falta de Mac impede a rodada de revisão, não desliga o gate do site.

Um novo marcado108 continua sem selo até receber identidade, regra e fontes
compatíveis em registro revisado. Atualizar a matriz exige commit, testes e
release aprovado. Remover a tag, mudar identidade ou atingir o limite na API
suprime o selo quando o catálogo atualizado é carregado pelo cliente. Isso
não é promessa de push em tempo real nem de interrupção de uma aba já aberta
antes do próximo carregamento/refetch. Falha da API preserva o comportamento
de cache do catálogo; o resolver não consulta ERP diretamente.

### Quando uma mudança fica visível

O recebimento do XML e sua propagação à API são externos a este checkout;
não há aqui um evento de chegada nem prazo comprovado dessa etapa. Depois
que a API muda, o estoque usa cache com `staleTime` de cinco minutos, que não
é um intervalo de polling. O bootstrap agenda uma atualização após 15 segundos;
busca pode atualizar ao montar/reativar. A ficha usa `staleTime` de um minuto,
sem atualização periódica. Uma aba já aberta não tem prazo máximo garantido
para refletir a alteração sem um novo carregamento/refetch aplicável.

A auditoria de Equipamentos da VPS reaproveita a consulta e a fila existentes
para apresentar pendências de garantia. A agenda conferida em 05/10/2026 roda
às 07h em `America/Sao_Paulo`; em operação normal, uma alteração já disponível
na API será examinada na rodada diária seguinte (até cerca de 24 horas), ou
antes por **Executar agora**. Falhas preservam o relatório anterior e não
equivalem a nova conferência. A pesquisa documental das 08h/14h tem outra
função e depende de sua execução no Mac; não é um aviso a cada importação.

Novo ID marcado, mudança de identidade, FAB/MY, km, flag ou regra relevante
abre uma nova pendência auditável. Alterações de km podem reabrir a conferência
sem retirar um selo ainda compatível. Marcar a pendência como revisada não
aprova o registro nem publica um carimbo. O veículo permanece no catálogo
normalmente; apenas a exibição da garantia depende do gate.

Não existe entrega push dessa fila. Para reduzir a latência ao ritmo de
duas/três importações diárias, a integração mínima futura seria enfileirar
a mesma auditoria após o importador existente confirmar uma atualização
bem-sucedida. O ponto de integração desse importador ainda precisa ser
identificado; não foi criado coletor, serviço ou credencial adicional.
