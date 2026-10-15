# Reconciliação de preço e disponibilidade das ofertas

O estoque público continua sendo a fonte por **ID exato**. Os cards salvos em
`src/data/seo/**/*.json` antes conservavam o preço e a disponibilidade da publicação
original; o build atualizava as vitrines, mas não esses cards editoriais. A rotina
agora reconcilia apenas os campos comerciais das ofertas e preserva textos, URLs,
SEO, fichas e histórico. Não altera preços no ERP.

## Fonte e validação

`scripts/lib/seo-stock-source.js` lê a API existente sem filtros até comprovar o
fim da paginação, confirma os IDs/preços em uma segunda passagem e recusa IDs
duplicados, campos inválidos, estoque vazio, erros de leitura e redução superior
a 20% frente ao manifesto anterior. Esse limite interrompe a publicação para
revisão; não transforma falha em venda. Valor zero identifica vendido; ID ausente
só é conclusivo após uma leitura completa validada.

Os CLIs usam timeout mínimo de conexão de 2 segundos, sem reduzir valor maior já
configurado, e até 3 tentativas apenas para falhas transitórias de transporte;
HTTP, TLS, JSON, schema e completude não são repetidos. Cada requisição continua
limitada a 20 segundos, com as duas passagens completas e interrupção segura.

Um snapshot público reduzido fica em `.devops/seo-build-stock.json`, válido por
15 minutos e identificado como `api-complete`. O runner usa a mesma fonte e
`NETCAR_REUSE_SEO_BUILD_STOCK=1` mantém esse snapshot no build. Snapshot expirado
ou incompleto interrompe o processo, sem refetch silencioso e sem retirar tudo.

## Comandos locais

```bash
node scripts/reconcile-offers.mjs --dry-run
node scripts/reconcile-offers.mjs --apply
node scripts/reconcile-offers.mjs --rollback <backupId>
npm run offers:test
```

O dry-run do reconciliador não altera as ofertas. Aplicar o mesmo snapshot pela
segunda vez devolve `changed: false`. O backup em
`.devops/offer-reconciliation/backups/<backupId>/` contém os originais e seus
hashes; rollback recusa sobrescrever edições posteriores.

## Job existente e concorrência

O único ponto de entrada permanece `scripts/weekly-persist.sh`. A rotina não
executa `generate-blog` e não publica textos novos. Em cada rodada:

1. Adquire `.devops/site-publish.lock` e executa `git pull --ff-only` no host.
2. Reutiliza o container temporário e os mounts de deploy existentes para ler o
   snapshot completo e reconciliar as ofertas.
3. Executa o deploy existente, incluindo seus testes/build, com o mesmo snapshot.
4. No **host**, `persist-reconciled-offers.py` valida HEAD, índice e hashes,
   commita somente os caminhos JSON reconciliados com `git commit --only` e faz
   push usando o acesso GitHub já existente. Não leva essa credencial ao container.

O runner recusa alterações rastreadas alheias, índice preparado, commits locais
não enviados e arquivos não rastreados em `src/` ou `public/`. As exceções são os
dois manifestos gerados de estoque/LCP e os metadados autocheck já produzidos
pelo build. Nenhum arquivo de outra tarefa entra no commit automático.

O build, o deploy, o reconciliador, o cron e o sync Git do workflow compartilham
o mesmo protocolo `mkdir`/token. Um filho pode herdar o token do dono; processos
independentes não o ultrapassam. O workflow libera a trava antes de disparar um
job independente no painel. Travas interrompidas não são tomadas automaticamente:
antes de remover uma trava órfã, confirmar que não há workflow, job no painel,
container do cron ou processo de deploy em execução. Nunca publicar o token.

`weekly-persist.sh --dry-run` mantém o lock, consulta a fonte e grava somente
snapshot, plano e log privados. Não faz pull, modifica ofertas, deploy ou commit.

O reconciliador é idempotente. O job ainda executa o build/deploy quando não há
diferença nos cards, pois as vitrines de cidades/seleções também dependem do
estoque e dos geradores existentes; `offersChanged: false` distingue esse caso.

## Agenda e instalação

Escolha operacional: **segunda, quarta e sexta às 07h, America/Sao_Paulo**.
O instalador verifica os arquivos de fuso da VPS e não modifica fuso nem
diretivas de outros jobs. A linha anterior deve existir exatamente uma vez:

```cron
0 6 * * 1 /opt/netcar-site-react/scripts/weekly-persist.sh >> /var/log/netcar-weekly.log 2>&1
```

Após a implantação confirmada, executar na VPS, como root:

```bash
cd /opt/netcar-site-react
bash scripts/install-offer-schedule.sh --dry-run
bash scripts/install-offer-schedule.sh --apply
bash scripts/weekly-persist.sh --dry-run
```

A linha substituída será:

```cron
0 7 * * 1,3,5 /opt/netcar-site-react/scripts/weekly-persist.sh >> /var/log/netcar-weekly.log 2>&1
```

Repetir `--apply` não duplica o job. Linha ausente, duplicada ou variante ambígua
é recusada. Todo o restante do crontab permanece byte a byte. O backup privado
fica em `/opt/netcar-deploy-backups/offer-schedule/`, diretórios 0700 e arquivos
0600; o caminho é retornado pelo instalador. A reversão exige que o crontab atual
corresponda ao hash instalado, preservando alterações posteriores:

```bash
bash scripts/install-offer-schedule.sh --restore <diretorio-do-backup>
bash scripts/install-offer-schedule.sh --apply --restore <diretorio-do-backup>
```

## Evidência, falhas e reversão

O stdout do job registra fases, contagens, `offersChanged`, versões e resultado.
Logs detalhados e relatórios ficam privados em
`.devops/offer-reconciliation/runs/`, com permissão 0600. Não registrar payload
integral de veículos, placas, credenciais ou conteúdo de outros cron jobs.

O relatório distingue `sourceBefore` (HEAD durante o build), `sourceAfter`
(commit posterior que persiste os dados), `dist` e `previousDist`. A gravação
do painel conserva o hash real da origem do build e identifica o commit de
dados separadamente; merge/sync Git não comprova implantação.

Uma falha de build/upload restaura os JSON do backup somente quando seus hashes
continuam iguais aos aplicados. Upload pode ter sido parcial: não há rollback
automático de produção. O marcador `pending-push.json` bloqueia novo cron e
`reset --hard` do workflow até a revisão. O relatório conserva `previousDist`
para o rollback via `POST /api/deploy/dist` com `{ "hash": "<previousDist>" }`.
Depois, verificar o job e as páginas públicas; reverter fonte Git separadamente.

Se apenas o push falhar, o commit e marcador ficam preservados. Após resolver a
causa usando o acesso existente, adquirir a trava e repetir a persistência no
host; estado `committed` reenvia o mesmo commit, sem gerar outro:

```bash
cd /opt/netcar-site-react
source scripts/lib/site-publish-lock.sh
netcar_site_lock_acquire "$PWD" 0
trap netcar_site_lock_release EXIT
python3 scripts/persist-reconciled-offers.py --apply
```

Estado `deployment_failed` exige verificar/recuperar produção antes de remover
o marcador. Não apagar marcadores ou travas para contornar trabalho em andamento.
Não mudar acessos, credenciais, publisher AUTOADS, anúncios, garantias,
roteamento, bancos ERP nem agendas de outros projetos.
