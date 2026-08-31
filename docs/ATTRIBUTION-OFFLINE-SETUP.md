# Atribuição offline: operação e segurança

Este pipeline reconcilia, em arquivos locais privados, quatro fontes:

1. o clique no WhatsApp registrado pelo site (`wa_clicks_log.jsonl`);
2. a primeira mensagem e sessões obtidas da Evolution;
3. o negócio do CRM;
4. a venda do ERP.

Ele não envia conversões automaticamente ao GA4, Google Ads ou Meta. O arquivo
`conversoes_confirmadas.csv` é uma fila auditável para uma integração de upload
separada e controlada. Uma linha `ready_with_ad_id` tem identificador de mídia e
match forte de venda (`business_id_exact` ou `customer_id_time`, com confiança
`high`/`medium`). `review_match_evidence` e `missing_ad_click_identifier` exigem
revisão e não devem ser importadas às cegas.

## 1. Checkout e ambiente local

Use um checkout em disco local, fora de Dropbox, iCloud ou `Library/CloudStorage`.
O instalador recusa checkouts nessas pastas para evitar sincronização acidental de
PII e dependência de caminhos pessoais.

```bash
cp .env.attribution.example .env.attribution
chmod 600 .env.attribution
python3 -m pip install pymysql psycopg2-binary
```

Preencha `.env.attribution`. O parser não executa o arquivo como shell e variáveis
já exportadas têm precedência. Nunca use prefixo `VITE_` para chaves privadas:
variáveis `VITE_*` entram no bundle público.

Valide sem acessar API ou banco:

```bash
scripts/atribuicao_diaria.sh --env-file "$PWD/.env.attribution" --dry-run
echo $?
```

O comando deve imprimir `dry-run OK` e terminar com status `0`. O runner exige
caminhos absolutos para os diretórios configuráveis, usa `umask 077`, lock por PID,
retries limitados, logs diários e retenção.

## 2. Transporte da Evolution

`EVO_BASE_URL` deve ser HTTPS. HTTP remoto é rejeitado por padrão;
`EVO_ALLOW_INSECURE_HTTP=1` existe somente para desenvolvimento isolado.

Quando a Evolution só está exposta em HTTP no VPS, use o túnel SSH temporário:

```dotenv
EVO_SSH_TARGET=usuario@vps.example.com
EVO_SSH_IDENTITY_FILE=/Users/seu-usuario/.ssh/id_ed25519
EVO_SSH_LOCAL_PORT=18080
EVO_SSH_REMOTE_PORT=8080
```

Nesse modo o runner abre `ssh -L 127.0.0.1:18080:127.0.0.1:8080`, substitui
`EVO_BASE_URL` somente no processo e encerra o túnel ao finalizar. HTTP é aceito
sem a flag de desenvolvimento apenas nesse loopback associado a
`EVO_SSH_TARGET`; a chave e o conteúdo trafegam dentro do SSH. Use chave sem
prompt e host já presente em `known_hosts`, pois o LaunchAgent não é interativo.

## 3. Log do site e credenciais

`wa_clicks_sync.py` usa `Authorization: Bearer` e `X-WA-Log-Token` sobre HTTPS.
Somente se o endpoint legado ainda não aceitar cabeçalho, habilite conscientemente
`WA_LOG_ALLOW_QUERY_TOKEN=1`; isso faz fallback após 401/403 e aumenta o risco de
o token aparecer em logs de proxy. Migre o endpoint e volte a `0`.

Tokens Meta também seguem em `Authorization`, não na URL. Credenciais Google e
dos bancos vêm exclusivamente do ambiente. Se uma chave já esteve hardcoded ou
em histórico Git, removê-la do arquivo não basta: revogue/rotacione a chave e,
quando aplicável, saneie o histórico e logs antigos.

MySQL e PostgreSQL exigem `sslmode=require`, `verify-ca` ou `verify-full`. Prefira
`verify-full` e configure `CRM_SSL_CA`/`PGSSLROOTCERT`. `require` cifra, mas não
valida a identidade do servidor.

Se uma fonte não oferece TLS, não rebaixe o transporte. Use
`ATTRIBUTION_SKIP_CRM=1` ou `ATTRIBUTION_SKIP_SALES=1`. A opção legada
`ATTRIBUTION_SKIP_DATABASES=1` continua equivalente a pular ambas. O job termina
com sucesso, marca a fonte como `skipped_unavailable` e
`coverage_is_partial=true` no JSON de auditoria, e não inventa negócios ou vendas.
Um snapshot CSV explicitamente fornecido ainda pode ser usado mesmo com a consulta
ao banco correspondente desativada.

### Receptor versionado no VPS

O código canônico do receptor é `scripts/vps/wa-log-server.py`; no servidor ele
é instalado como `/opt/wa-log/server.py` e executado pelo container `wa-log`.
Antes de substituir o arquivo, valide-o em um container temporário, faça backup
com data/hora e só então reinicie ou recrie o container. O receptor atual:

- aceita o `wa_ref` Crockford e os formatos legados;
- valida e persiste `click_id`, `wa_ref` e contexto comercial allowlisted;
- não persiste mensagem livre nem telefone;
- aceita leitura autenticada por `Authorization: Bearer` ou
  `X-WA-Log-Token`; query token só é aceito quando
  `WA_LOG_ALLOW_QUERY_TOKEN=1` também está habilitado no receptor;
- restringe CORS aos dois domínios de produção.

Depois de atualizar o receptor, mantenha `WA_LOG_ALLOW_QUERY_TOKEN=0`. Se o token
já apareceu em arquivo ou histórico Git, rotacione-o no container e no ambiente
privado do pipeline; não basta apagar a ocorrência antiga.

## 4. Contrato de reconciliação

A prioridade é:

1. `click_id` forte (`nc_` + 32 hex) exato;
2. `wa_ref` + janela temporal;
3. ID de negócio/cliente entre CRM e ERP;
4. telefone normalizado + janela, explicitamente marcado como fallback.

O `wa_ref` novo aceita uma letra de origem (`M`, `G`, `O`, `D`, `S`, `R` ou `U`)
e sete caracteres Crockford `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`. Formatos legados
de 1–5 dígitos ou quatro alfanuméricos continuam legíveis. A Evolution nunca
inventa `click_id` copiando `wa_ref`: o identificador forte só aparece após o
match com o log próprio.

Cada linha inclui métodos, número de candidatos, delta temporal e confiança por
etapa, além de `match_method` e `confidence` ponta a ponta. Etapas ausentes reduzem
a confiança total. Um `click_id` não padronizado só casa dentro da janela. Venda
por fallback temporal nunca pode anteceder o lead.

O resumo `atribuicao_whatsapp_audit.json` separa também a cobertura das
identidades (`identity_coverage`) e a data mais recente de cada fonte
(`freshness`). Isso evita interpretar todo o histórico como falha da versão
atual: cliques legados sem `click_id` e conversas anteriores ao deploy continuam
no período de retenção, mas não comprovam nem invalidam o contrato novo.

Para aceitar um deploy de atribuição em produção, faça um único teste controlado
com consentimento de medição: abra uma ficha, clique no WhatsApp e envie a
mensagem predefinida sem retirar a referência final. Depois rode o pipeline e
confirme no JSON, sem expor a mensagem ou o telefone, que aumentaram
`site_clicks_with_strong_click_id`, `evolution_leads_with_new_wa_ref` e
`matched_totals.click`. Os testes sintéticos protegem o código; esse teste
controlado comprova a integração real com o aplicativo e a Evolution.

`traffic_source` descreve aquisição (`utm_source`, mídia etc.); `wa_source`
descreve o marcador/origem observado no WhatsApp. Eles permanecem separados.
Campanha, UTMs, `gclid`/`gbraid`/`wbraid`/`fbclid`, landing page, referrer,
veículo, intenção, loja e vendedor são preservados quando a fonte os fornece.

Uma conversa WhatsApp não equivale a um lead vitalício. A extração cria nova
sessão ao observar novo `wa_ref`, novo contexto CTWA ou inatividade maior que
`ATTRIBUTION_SESSION_GAP_HOURS` (padrão: 168 h). `EVOLUTION_MESSAGE_LIMIT` limita
o histórico consultado por JID; faça um `--full` após aumentar esse valor em um
backfill controlado.

A coleta da Evolution usa `EVOLUTION_MAX_FAILURE_RATE_PERCENT=10` como limite
seguro padrão. Se todas as conversas da fila falharem, o checkpoint e o CSV
anteriores são preservados e o processo termina com status diferente de zero.
Em falha parcial, sessões válidas e checkpoint são gravados; se a taxa superar o
limite configurado, o processo também termina com erro para alertar a operação.
As contagens agregadas (`queued`, `succeeded`, `failed`, taxa, limite e estado do
checkpoint) ficam em `evolution_attribution_audit.json`, sem telefone ou JID.

Cada número do WhatsApp deve apontar para sua própria instância Evolution e usar
um checkpoint separado. Misturar o número comercial com o Nethelp produz um
relatório tecnicamente válido, mas mede conversas do funil errado.

Datas ISO sem timezone são interpretadas em `ATTRIBUTION_SOURCE_TIMEZONE`
(`America/Sao_Paulo` por padrão); epochs são UTC. Telefones fixos não recebem o
nono dígito de celular.

## 5. Execução e arquivos

Execução manual completa:

```bash
scripts/atribuicao_diaria.sh --env-file "$PWD/.env.attribution"
```

Ordem: sincronizar cliques, extrair sessões Evolution, enriquecer CRM/ERP e,
opcionalmente, tirar snapshot de campanhas. Defina
`ATTRIBUTION_RUN_CAMPAIGN_SNAPSHOT=1` para a última etapa; ela é independente do
fechamento de conversão e requer as credenciais das plataformas selecionadas.

Por padrão, saídas ficam fora do repositório, em
`~/Library/Application Support/Netcar/attribution/`, e logs em
`~/Library/Logs/Netcar Attribution/`, com diretórios `0700` e arquivos `0600`.
`.local/attribution/` é apenas um fallback explícito para teste e também está no
`.gitignore`:

- `wa_clicks_log.jsonl` e checkpoint de sincronização;
- `atribuicao_whatsapp_leads.csv` e checkpoint Evolution;
- `evolution_attribution_audit.json` (contagens agregadas da coleta Evolution);
- `atribuicao_whatsapp_leads_enriquecido.csv`;
- `atribuicao_whatsapp_audit.json` (resumo agregado/pseudonimizado);
- `conversoes_confirmadas.csv` (fila, sem upload automático);
- `logs/attribution-AAAA-MM-DD.log`.

O CSV detalhado contém PII: telefone, JID, nome, mensagem inicial, possível cidade,
veículo, vendedor e IDs comerciais. Limite o acesso ao operador responsável,
aplique a base legal/política de retenção da empresa e não anexe esses arquivos a
issues, chats ou commits. O JSON de auditoria não inclui valores crus, mas declara
os campos de PII, retenção e controle de acesso.

Para teste sem banco, use snapshots:

```bash
python3 scripts/atribuicao_enrich.py \
  --evolution-csv /tmp/evolution.csv \
  --click-log /tmp/clicks.jsonl \
  --crm-csv /tmp/crm.csv \
  --sales-csv /tmp/vendas.csv \
  --output /tmp/enriquecido.csv \
  --audit-output /tmp/audit.json \
  --confirmed-conversions-output /tmp/conversoes.csv
```

Execute também os contratos sintéticos sem rede:

```bash
python3 scripts/validate-attribution-offline.py
npm run tracking:validate:attribution
```

Eles cobrem sessionização, formatos novo/legado de `wa_ref`, separação de fonte,
telefone fixo/celular, timezone, janela de IDs fracos, venda anterior ao lead,
TLS/HTTP, transporte do token, JSON array/JSONL, retenção, atomicidade e export de
conversões confirmadas.

## 6. LaunchAgent

Depois do dry-run com status `0`:

```bash
scripts/install_attribution_launchagent.sh \
  --env-file "$PWD/.env.attribution" --dry-run
scripts/install_attribution_launchagent.sh \
  --env-file "$PWD/.env.attribution" \
  --hour 3 --minute 15
```

O plist grava o caminho absoluto do checkout local atual. Para executar logo após
instalar, acrescente `--run-now`. Para remover:

```bash
scripts/install_attribution_launchagent.sh --uninstall
```

Consulte o estado com `launchctl print gui/$(id -u)/com.netcar.atribuicao` e os
logs em `~/Library/Logs/Netcar Attribution/`. O instalador reutiliza o label
legado `com.netcar.atribuicao`, descarrega a definição antiga e substitui seu
plist, evitando dois jobs concorrentes.
