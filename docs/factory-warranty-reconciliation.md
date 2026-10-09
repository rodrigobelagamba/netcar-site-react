# Reconciliação de garantias — 09/10/2026

## Estado desta implementação

Esta alteração implementa a aplicação automática de regras aprovadas e o gate
de exibição no site. **Não comprova, sozinha, a rotina completa de XML até a
conferência agendada e o DOM público.** A agenda existente das 08h/14h/18h não foi
localizada e não foi criada uma segunda automação. O importador XML/PHP não está
neste repositório; `rodrigobelagamba/netcar-site-api` contém somente o README.

## Causa e fonte de autoridade

O XML/API atualizava o catálogo, enquanto o site consultava uma matriz estática
por ID. Uma correção do motor não resolvia o `pending` da matriz. Além disso,
o gate antigo não comparava motor nem identidade estável da unidade.

A autoridade permanece **`src/data/factoryWarrantyMatrix.json`**. Os registros
individuais guardam as decisões técnicas/operacionais existentes. A seção
`automation.rules` identifica regras reutilizáveis, aprovadas e versionadas,
com correspondência exata de marca, versão, motor, câmbio, fabricação e modelo.
Não há coletor novo nem banco independente de aprovações.

`scripts/generate-factory-warranty-registry.mjs` publica uma cópia dessa mesma
autoridade em `/seo/factory-warranty-registry.json` durante o build. Não editar
essa cópia gerada. A listagem, semelhantes e ficha consultam o mesmo documento.

`reconcileFactoryWarrantyVehicle()` cria um registro efetivo para uma nova unidade
somente quando uma regra aprovada corresponde integralmente aos dados atuais.
Esse registro é derivado de forma determinística, sem fingir uma revisão técnica
nova. O auditor existente executa a mesma função e conserva assinaturas, resultado,
motivo e histórico no relatório privado já existente. Não é necessário publicar
outro bundle apenas para uma nova unidade coberta por uma regra já publicada.

## Precedência e identidade

1. Revogação, reprovação ou pendência manual de um registro não é sobrescrita
   pela automação. A unidade conhecida sob outro ID também exige revisão.
2. A aprovação individual continua presa ao ID **e** à chave opaca da unidade,
   ao motor/câmbio e à identidade documental. Nenhum fallback visual corrige dados.
3. Os fatos atuais vêm da API alimentada pelo importador existente. Não há escrita
   em XML, cadastro, ERP ou regra comercial. Divergência XML/API deve ser resolvida
   na origem ou mediante correspondência individual documentada; não há alias geral.
4. A regra aprovada fornece cobertura/prazo/condições e não substitui fatos ausentes.
   Mudanças exigem nova avaliação; editar regra/fonte sem renovar a revisão a invalida.

A projeção compartilhada usa SHA256 do VIN válido; se o VIN estiver ausente, usa
SHA256 da placa completa válida. VIN presente inválido não cai para placa. Uma
troca de identificador requer revisão conservadora. VIN e placa brutos não são
adicionados ao registro de garantias nem ao relatório privado. A migração das dez
aprovações preserva a cobertura e vincula a unidade atualmente correspondente;
os registros históricos não tinham chave estável e não passam a ter uma observação
retroativa de VIN/placa. O baseline anterior permanece no arquivo de auditoria.

## Regras reutilizáveis iniciais

Correspondências exatas, sem intervalos de anos ou famílias de marca:

| Modelo da API | FAB/MY | Motor/câmbio | Base |
| --- | --- | --- | --- |
| ONIX PREMIER PLUS TURBO | 2024/2025 | 1.0/AUTOMATICO | Registro documental 19994; 3 anos, abaixo de 100 mil km |
| HB20 LIMITED | 2024/2025 | 1.0/MANUAL | Registro documental 20038; 5 anos, abaixo de 100 mil km |
| KICKS SENSE TURBO | 2025/2026 | 1.0/AUTOMATICO | Registro documental 19857; 3 anos, abaixo de 100 mil km |
| KICKS ADVANCE TURBO | 2025/2026 | 1.0/AUTOMATICO | Revisão 20019 de09/10; 3 anos, abaixo de 100 mil km |
| TERA HIGH TURBO | 2025/2026 | 1.0/AUTOMATICO | Registro documental 19587; 3 anos, sem limite |

Essas regras usam política documental comum, sem presumir uso privado ou CPF.
A flag é o ateste da conferência do manual; manutenção, exclusões e início real
continuam sujeitos à documentação. A flag não cria data exata de vencimento.
Tracker (exclusões R8C/R8Z), BYD, Tiggo e Renegade continuam individuais. Bateria
e motor/câmbio não se convertem em cobertura integral. Título, visual e ressalvas
aprovados não foram alterados.

## Cache e proteção antes da exibição

- Cada render reconcilia os dados e passa pelo resolver documental canônico.
- API de veículos e registro publicado são consultados a cada 60s em abas ativas,
  com `no-store`. A ficha revalida ao abrir e ao recuperar foco/conexão.
- Snapshot de build/cache não ganha data nova de observação. Sem observação
  original recente, o anúncio aparece e o carimbo aguarda a API.
- Falha transitória conserva os dados e o histórico. O selo tem tolerância
  limitada: janela de 4min45s mais o relógio de até15s, total de até5min em aba
  ativa. Uma aba suspensa é reavaliada ao voltar; o navegador pode suspender timers.
- Retirada da flag, motor/identidade divergente, limite de km e expiração passam
  pelo gate na próxima resposta válida. Remoção explícita/404 na ficha suprime
  imediatamente o carimbo, sem usar a tolerância de falha de rede.
- O prazo parte da primeira entrega quando documentado. FAB+anos continua
  estimativa; no ano final exige vencimento real confirmado. Datas usam São Paulo.
- Esse intervalo começa na informação **publicada pela API**. Não mede nem
  garante a latência do importador ou de caches anteriores à API.

## Reuso da rotina e histórico

Entrada existente: `npm run stock:audit-equipment -- --state-dir <diretorio-privado>`
ou `POST /api/equipment/run` com `{}` pelo painel autenticado. O processo usa a
mesma fila, locks, três tentativas limitadas e gravação atômica. A programação de
equipamentos das 07h foi preservada; ela não é a agenda de garantias informada pelo
responsável. Não instalar outra agenda enquanto a original não for identificada.

O relatório guarda `warrantyHistory` (até20 estados por chave de unidade), os
fingerprints de dados/regra e `newWarrantyAlerts`. Usar somente esses alertas novos
para notificações: pendência relevante, incompatibilidade ou regressão de km;
repetição idêntica não renotifica. Ausência da coleção é `unknown`, nunca venda.
Uma leitura inválida, vazia, duplicada ou na fronteira de500 itens não substitui
o relatório anterior. Uma redução de km em unidade automaticamente derivada é
detectável pelo histórico do auditor; um navegador sem histórico não pode provar
uma observação anterior e avalia os fatos correntes pela regra documental.

O auditor compara o carimbo **esperado** pelo gate. Não é prova de presença no
DOM. A automação existente ainda deve ligar sua leitura XML completa e a auditoria
às verificações de lista/ficha e consumir os alertas. O hook após importação só
pode ser instalado quando o código e disparador do importador forem localizados.

## Kicks 20019 e pendência de integração

Manual oficial Nissan MY2026 MPPT-P13C00 v3 revalidado em09/10/2026:36 meses,
CPF sem limite e CNPJ100 mil km; interseção conservadora3 anos/100 mil km.
Motor HR10DDT999cm³ é compatível com a correção1.0. Estimativa possível2028*,
sem data exata de início/vencimento e sem estender regra a toda Nissan.

Às13:31 BRT, XML/API indicavam KICKS ADVANCE. A API depois passou a informar
KICKS ADVANCE TURBO, enquanto o XML das13:38:46 ainda dizia KICKS ADVANCE.
A conferência final das14:02:20 BRT comparou o hash da placa completa nas duas
fontes e todos os campos relevantes. A Nissan comprova Advance1.0turbo125cv;
“TURBO” é um descritor compatível dessa mesma unidade, sem conflito material de
versão. A revisão individual aceita o nome exato da API sem afirmar quem o alterou
nem criar um alias geral. Registro e regra exata foram aprovados localmente,
com estimativa2028* e datas reais desconhecidas. Evidência completa em
`docs/audits/factory-warranty-kicks-20019-2026-10-09.json`. O candidato preliminar
que preservava o nome anterior está guardado como histórico e não prevalece
sobre a decisão posterior documentada.

A nova regra só corresponde ao nome literal KICKS ADVANCE TURBO, motor1.0,
câmbioAUTOMATICO e FAB/MY2025/2026, com chave de unidade própria e flag atual.
Nenhuma outra geração, versão, motor1.6 ou ano é incluído por essa revisão.

## Verificação desta entrega

Em 09/10/2026, branch `codex/warranty-reconciliation`, baseada em
`c76f883afcb84e86d704e1c047208b0679178529`:

- `npm run build`: aprovado, incluindo 467 testes de garantias e as verificações
  existentes de SEO, catálogo, atribuição e entrega dos arquivos.
- `npx tsx --test scripts/tests/equipment-audit.test.ts`: 46 testes aprovados.
- `npx tsc --noEmit`: aprovado.
- Revisão adicional encontrou e corrigiu um bypass de bloqueio por mudança de ID:
  os três tipos de carimbo e o auditor agora respeitam o resultado da reconciliação
  antes de resolver a cobertura. Testes confirmam que motor/câmbio dos Tiggo e
  bateria BYD continuam independentes da cobertura geral.
- Cobertura de regressão: nova unidade compatível, motor/ano/identidade divergentes,
  documentação ausente, limite de km, expiração, flag retirada, regra alterada,
  leitura parcial ou inválida, falha de rede, concorrência, repetição e carimbo
  ausente/indevido. A Kicks 20019 usa a evidência real de 09/10.
- Auditoria real às 14:10:01 BRT: 70 linhas da API validadas antes do filtro de
  disponibilidade; 65 anúncios ativos; Kicks 20019 `eligible`, 5.100 km,
  revisão `reviewed-v2-20261009-20019`. A aprovação resolveu sua pendência,
  sem gerar novo alerta repetido.
- Repetição às 14:17:45 BRT, com o código final: 65 anúncios inalterados,
  Kicks elegível e zero novos alertas de garantia.

Conferências no navegador em 09/10/2026 (BRT):

| Endereço | Horário | Resultado |
| --- | --- | --- |
| `http://127.0.0.1:5180/seminovos?busca=kicks` | 14:10:44 | Kicks Advance e Sense com carimbo 2028*, Kicks S vendido sem selo; captura `output/warranty-routine/local-kicks-list.jpg` na pasta agregadora |
| `http://127.0.0.1:5180/veiculo/kicks-advance-turbo-2026-tqr-xx49-20019` | 14:09:48 | Carimbo 2028* e ressalva visíveis; captura `output/warranty-routine/local-kicks-20019-approved.jpg` |
| `https://www.netcarmultimarcas.com.br/seminovos?busca=kicks` | 14:11:12 | Estado anterior à publicação: Advance com 5.100 km, ainda sem selo; Sense com selo; captura `output/warranty-routine/public-kicks-before.jpg` |
| `https://www.netcarmultimarcas.com.br/veiculo/kicks-advance-2026-tqr-xx49-20019` | 14:11–14:13 | Navegação iniciada pelo card público; leitura do DOM interrompida por timeout do navegador. Resultado da ficha pública inconclusivo |

As capturas locais antecedem o último reforço do bloqueio de ID, que não altera
o resultado da Kicks. O build final posterior passou nos mesmos cenários de UI.
Não houve publicação desta alteração. A latência pública e a presença dos dois
carimbos após deploy ainda precisam ser medidas; os 60s/5min acima são limites
do código e dos testes, não uma medição de produção.

Para a próxima entrada, uma unidade com identidade própria, dados completos,
flag atual e correspondência exata a uma das cinco regras aprovadas recebe
validação derivada e carimbo após a resposta válida da API e do registro. Qualquer
ambiguidade fica sem carimbo e com motivo específico. O auditor conserva o
histórico e emite somente pendências novas; falta conectar esse processamento
e a prova visual à automação original das 08h/14h/18h.

Bloqueios remanescentes: identificar o ID/local da automação original; localizar
o código/disparador do importador para avaliar o hook pós-XML; obter aprovação
específica desta publicação conforme `AGENTS.md`. Não foi criada outra agenda,
e não se considera a rotina completa implementada.

## Publicação e reversão

Usar exclusivamente o fluxo documentado: master aprovado → workflow do painel →
SHA correto em `/api/status` e fila livre → `/api/deploy/local` → job terminal →
HTML/assets e DOM público. Não considerar build ou workflow como publicação.

Para reverter, reverter somente o commit desta alteração e publicar pelo mesmo
fluxo. A matriz original fica preservada no baseline e o histórico privado não
deve ser apagado. Uma reversão volta ao gate anterior, sem proteção estável de
unidade/motor; se houver suspeita de selo incorreto, desabilitar primeiro a matriz
canônica e publicar essa decisão explícita em vez de reativar cobertura duvidosa.
