# Descoberta e revisão de equipamentos — Netcar

## Contrato e limites

A rotina reutiliza a auditoria e a fila serial do DevOps na VPS. A mesma agenda
passa a executar às **09h, America/Sao_Paulo**. Não há agendamento no Codex,
segundo cron, importador novo, escrita no ERP ou publicação automática.

O XML/API continuam sendo a origem. O importador XML→API é externo a este
repositório; a rotina só lê suas saídas. O resolver compartilhado continua sendo
`src/lib/vehicleEquipment.ts`. A complementação aprovada continua no registro
`src/data/vehicle-equipment-confirmations.json`.

Há três atividades distintas:

1. Auditoria do estoque, das identidades e da apresentação calculada.
2. Descobertas documentadas de `docs/equipment-research-library.json`, aplicáveis
   somente a marca/versão/ano-modelo/motor/câmbio exatos, e observação dos documentos
   oficiais dessa biblioteca. Trechos novos são triagem documental, não prova de
   presença. Novas tecnologias não precisam existir na taxonomia.
3. Pesquisa documental ampliada e conferência física pelo responsável. A VPS não
   dispõe de um pesquisador autônomo capaz de buscar e validar toda a internet.
   Unidades sem fonte compatível entram na fila; não são declaradas auditadas.

O monitor de documentos só acompanha fontes cadastradas e sinaliza mudanças de
texto; não transforma mudanças de página ou um manual genérico em equipamentos.
A biblioteca pode ser ampliada por pesquisa oficial datada e revisada, sem
acrescentar nada ao anúncio. A primeira pesquisa está em
`docs/audits/equipment-discoveries-2026-10-09.md`.

## Evidência e três camadas

Cada candidato registra identidade, fabricação/ano-modelo, mercado documental,
classificação, fonte HTTPS, edição/data, localizador e alegação. Mercado ausente
no feed permanece desconhecido até ateste explícito do responsável.

Classes: `standard` (série documentada), `package` (pacote/opcional), `accessory`
(instalação posterior documentada), `inference` (insuficiente/contraditória).
Manual “se equipado”, configuração de outro ano, foto de botão ou pré-disposição
não comprovam presença. Incerteza e manual genérico bloqueiam a aplicação.

O relatório compara XML, API e observação pública. O resultado do resolver local
não é chamado de ficha pública. Para verificar a ficha, abrir `/veiculo/ID`,
rolar até equipamentos e expandir a lista completa. Registrar as descrições,
horário e `discoveryVehicleFingerprint` do cadastro conferido. Observação antiga
(mais de 24h) ou vinculada a outro cadastro não comprova a apresentação atual.

As comparações distinguem item no XML ausente da apresentação (inclusive
supressões intencionais, que devem ser revisadas), candidato documental fora do
XML, equipamento novo fora da taxonomia e item já exibido ou sinônimo. Não
confluir ACC/piloto comum, alerta/intervenção, câmera traseira/360° nem
conectividade disponível/assinatura ativa.

## Decisão do Marcelo

Para cada unidade e item: **“Esse carro tem este equipamento? Se tem, quer que eu
inclua no site?”** Apresentar nome/benefício sugerido, classificação, fonte e o que
falta conferir. A resposta aponta ID + item; um OK genérico nunca aprova a fila.

Estados persistentes: descoberto, aguardando confirmação, presença confirmada,
inclusão autorizada, não incluir, publicado e invalidado. “Está presente, mas não
quero anunciar” é válido. Respostas parciais atualizam somente as chaves citadas.
O painel registra cada decisão com referência, data e texto. Nenhum botão faz
`apply`, commit ou deploy. A autorização de exibir não substitui o fluxo de
publicação com verificação pública.

No CLI, `presence_confirmed` não autoriza; `authorized` exige presença, permissão,
ateste de mercado, referência específica e texto aprovado; `excluded`/`rejected`
não adicionam ausência ao catálogo nem removem itens. `deferred` aguarda
conferência. O status legado `confirmed` sem referência/texto não é exportável.

## Identidade, precedência e histórico

A chave de revisão inclui o candidato/evidência, identidade e equipamentos
relevantes. Preço, fotos, horário de coleta e ordem dos opcionais não reabrem uma
pergunta. Mudança relevante invalida a revisão; saída e retorno observados não
herdam aprovação. `reopen` exige registrar pedido explícito do responsável.
As respostas anteriores, rejeições, textos e referências ficam no histórico.

A confirmação v2 exige ID, marca, versão, fabricação, ano-modelo, motor, câmbio,
mercado BR atestado e `physicalIdentityKey`. Essa chave deriva do ID e da placa
normalizada já fornecida pela API; os registros de revisão guardam somente o hash. Dado de mercado contraditório bloqueia a aplicação.
Aprovações legadas são preservadas. Definições novas e sinônimos revisados ficam
na taxonomia complementar da unidade, sem aliases globais e sem duplicatas.
Assim, nomes novos não dependem da lista limitada de tags do ERP.

O complemento autorizado prevalece sobre XML/API e sobrevive à reimportação.
Base manual incompatível, ausência anterior ou atualização concorrente bloqueiam
a proposta. Não se apagam equipamentos por ausência em documento ou decisão de
não anunciar um candidato. Contradições voltam à revisão.

**Identidade física:** trocar a placa mantendo o ID e a descrição invalida a
aprovação v2. Placa ausente/inválida bloqueia nova aplicação; a mesma placa
normalizada mantém o complemento após reimportação. Uma placa fornecida que
contradiga o hash bloqueia sua utilização. Não se migram confirmações legadas
para uma identidade física sem nova revisão explícita; esse conflito bloqueia
a proposta com `legacy_confirmation_physical_binding_review_required`.

O hash não prova posse, funcionamento ou autenticidade do cadastro. Se a origem
reutilizar incorretamente tanto ID quanto placa, a conferência do responsável
continua necessária. Não foi feita consulta por chassi ou criado acesso externo.

## Operação

```sh
# Mesma tarefa da VPS: auditoria, descoberta e observação de fontes em sequência.
node scripts/run-equipment-daily.mjs --state-dir .devops/equipment --input docs/equipment-research-library.json

# Execução de descoberta/revisão isolada, sem publicação:
npm run stock:review-equipment -- discover --input docs/equipment-research-library.json --expand-exact-matches
npm run stock:review-equipment -- list

# Marcar somente uma pergunta efetivamente apresentada:
npm run stock:review-equipment -- mark-asked --key CHAVE --vehicle-id ID --item-key ITEM

# Registrar presença sem autorização:
npm run stock:review-equipment -- decide --key CHAVE --vehicle-id ID --item-key ITEM --status presence_confirmed --present --note 'Declaração específica' --confirmation-reference 'referência à resposta'

# Lote explícito permite aprovação parcial; cada resposta identifica chave/ID/item.
npm run stock:review-equipment -- decide-batch --input /caminho/decisoes-exatas.json

# Depois das decisões específicas: proposta, revisão de diff e aplicação local.
npm run stock:review-equipment -- prepare
npm run stock:review-equipment -- apply --proposal-sha256 HASH_DA_PROPOSTA
```

`discover` aceita `--public-observations` e `--research-progress`; esses arquivos
são evidência sanitizada de conferência e pesquisa, não uma declaração de presença.
A fila prioriza mudanças, recém-chegados e anos mais recentes, avançando também
nas unidades sem pesquisa. Contagens separam estoque comparado, fontes registradas,
buscas sem fonte, ambiguidade e fichas realmente conferidas.

`prepare` não altera o catálogo. `apply` relê XML/API, exige observação de até 15
minutos e confere hashes da proposta, das decisões e da base. Uma nova edição
concorrente exige outra proposta; nunca sobrescrever trabalho alheio.
Gravação usa trava, rename atômico e journal com bytes anterior/posterior. Falha
interrompida bloqueia operações até `recover-apply`; estados desconhecidos
exigem investigação. Recibo privado contém os hashes para reversão revisada.

Após aplicação autorizada: testar/build, publicar somente o delta aprovado pelo
procedimento DevOps do projeto, acompanhar o job e verificar ficha/HTML/assets.
`record-publication` exige chave/ID/item, commit completo, URL `/veiculo/ID`,
referência à prova pública e referência de reversão. Só então marca `published`.
A reversão é explícita e revisada; não há remoção automática.

## Persistência e implantação

Todos os estados operacionais ficam em `.devops/equipment/` (700, arquivos 600),
no volume persistente já existente da VPS. Incluir no backup já adotado. Os
relatórios não guardam placas/chassi/contatos, corpo integral XML/API ou segredos.
Histórico inválido, grande demais ou trava desconhecida falham conservadoramente;
não limpar estado para fazer uma execução passar.

O workflow `Deploy DevOps panel` instala o painel/rotina na VPS, mas não instala
as dependências do checkout raiz. Nesta primeira implantação, o job autorizado
`POST /api/deploy/local` executa `npm ci --include=dev`, testa/builda e publica o
resolver/SEO, sem acrescentar equipamentos. Aguardar esse job antes de executar
a descoberta manual. Conferir commit, agenda9h e job real; build/CI isolados não
comprovam a publicação. O cron não instala dependências nem publica o site.
Verificar que nenhuma confirmação real foi acrescentada antes do OK do Marcelo.

```sh
npm run stock:test-equipment-review
node --import tsx --test scripts/tests/equipment-discovery.test.ts scripts/tests/equipment-source-watch.test.ts
npm run stock:test-equipment
npm run stock:test-equipment-audit
npm --prefix devops test
node --test devops/client/src/equipment.test.js
npm --prefix devops run build
npm run lint
npm run build
```

Os testes usam unidades sintéticas: item desconhecido/sinônimos, pacotes, manual
genérico, mudança de ano/FAB/mercado, identidade ambígua, aprovação parcial,
recusa de exibição, reimportação, repetição, concorrência e recuperação. A
verificação final com equipamento real aguarda a decisão específica do Marcelo.
