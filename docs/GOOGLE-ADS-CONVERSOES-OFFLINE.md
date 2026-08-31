# Google Ads — exportação segura de vendas confirmadas

Coleta técnica: **31/08/2026**. Fontes oficiais do Google no fim deste documento.

## O que foi implementado

O script [`scripts/export_google_ads_offline.py`](../scripts/export_google_ads_offline.py)
transforma o CSV enriquecido de atribuição em um lote para revisão e importação
no **Google Ads Data Manager**.

Ele **não acessa nem envia dados ao Google**. Nenhuma credencial é necessária
para gerar o lote.

São criados quatro arquivos locais:

| Arquivo | Uso |
| --- | --- |
| `google_ads_offline_ready.csv` | Vendas confirmadas, com correspondência forte e válidas, prontas para mapear no Data Manager. |
| `google_ads_offline_rejected.csv` | Linhas bloqueadas para revisão: número, fingerprint e motivo da rejeição, sem o conteúdo bruto. |
| `google_ads_offline_manifest.json` | Contagens, hashes, premissas e identificação auditável do lote. |
| `google_ads_offline_applied_ids.template.txt` | Order IDs do lote; só devem entrar no ledger definitivo depois da confirmação do Google. |

Os arquivos recebem permissão local `0600`. O diretório de saída não deve ser
publicado no site nem versionado no Git.

## Por que o formato usa Data Manager

O Google recomenda o Data Manager para importações offline atuais. A
documentação de 2026 também orienta novas automações ao **Data Manager API**;
o Google Ads API ficou como caminho legado sujeito às regras de migração e
allowlist. Portanto, este exportador não cria uma dependência nova no método
legado de cinco colunas.

O CSV usa apenas campos aceitos/mapeáveis pelo Data Manager:

| Coluna gerada | Destino no Data Manager |
| --- | --- |
| `Conversion action` | Conversion action |
| `Conversion date and time` | Conversion date and time |
| `Conversion value` | Conversion value |
| `Currency` | Currency |
| `Order ID` | Order ID / Transaction ID |
| `Event source` | Event source |
| `GCLID` | GCLID |
| `GBRAID` | GBRAID |
| `WBRAID` | WBRAID |

Os cabeçalhos podem ser ligados aos campos acima na etapa de mapeamento da
conexão do Data Manager.

## Como gerar

Exemplo com o nome **exato** da ação já criada no Google Ads:

```bash
python3 scripts/export_google_ads_offline.py \
  --input .local/attribution/atribuicao_whatsapp_leads_enriquecido.csv \
  --output-dir .local/attribution/google-ads-offline-export \
  --conversion-action "Venda confirmada Netcar"
```

Também é possível fornecer o nome por `GOOGLE_ADS_CONVERSION_ACTION`. O nome e
a capitalização precisam coincidir exatamente com a ação da conta.

Opções úteis:

```text
--timezone America/Sao_Paulo     fuso para datas sem offset
--date-only-time 12:00:00        horário assumido quando o ERP fornece só a data
--max-age-days 90                janela máxima do lote
--event-source IN_STORE          origem do evento confirmado
--applied-ledger ARQUIVO         exclui IDs já confirmados como importados
--strict                         retorna código 2 se houver qualquer rejeição
--allow-missing-value            permite valor vazio; não é o padrão
```

Por segurança, o CSV precisa conter um campo explícito de venda confirmada
(`virou_venda`, por padrão) e os campos `sale_match_method` e
`sale_match_confidence` produzidos pelo enriquecimento. O script não presume
que toda linha é venda nem que uma coincidência por telefone comprova a venda.

## Regras aplicadas

1. Só entram linhas marcadas como venda confirmada.
2. A correspondência da venda deve ter confiança `high` ou `medium` **e** usar
   um método forte aprovado: `business_id_exact`, `customer_id_time` ou uma
   chave exata equivalente de negócio, cliente, venda ou transação.
3. `phone_time_fallback`, `phone_only_fallback`, qualquer outro método não
   aprovado e qualquer confiança `low` ficam no arquivo de rejeições para
   revisão; nunca entram no lote pronto.
4. CSV legado sem `sale_match_method` ou `sale_match_confidence` também é
   rejeitado com segurança. Ele precisa ser reprocessado pelo enriquecimento;
   o exportador não inventa evidência retroativa.
5. É obrigatório haver ao menos um entre GCLID, GBRAID e WBRAID.
6. GCLID pode coexistir com um BRAID na mesma conversão.
7. GBRAID e WBRAID juntos na mesma linha são rejeitados, pois não devem ser
   enviados simultaneamente para uma conversão.
8. Os identificadores são preservados com a capitalização original.
9. A data sai em ISO 8601 com offset, por exemplo
   `2026-08-31T12:00:00-03:00`.
10. Se o ERP tiver apenas a data, o horário configurado em `--date-only-time` é
   assumido e contado no manifesto para revisão.
11. Conversões futuras ou anteriores à janela configurada são rejeitadas.
12. Valor ausente é rejeitado, salvo uso explícito de `--allow-missing-value`.
13. Linhas conflitantes com a mesma identidade são retiradas do lote; o script
    não escolhe silenciosamente uma delas.

## PII: o que não sai do pipeline

O exportador usa uma lista fechada de colunas. Ele não exporta:

- nome;
- telefone;
- e-mail;
- JID ou conteúdo de conversa;
- vendedor ou cliente do CRM;
- placa, CPF ou endereço;
- ID bruto da venda/CRM.

O `Order ID` começa com `nc_` e é um SHA-256 determinístico truncado. O ID bruto
que serviu de base nunca aparece no arquivo. O CSV de rejeições também não
repete o conteúdo da linha: mostra somente a posição, uma fingerprint e o
motivo técnico.

## Deduplicação e idempotência

O Google recomenda um Order ID único para controlar duplicidade. Neste projeto:

- a mesma venda e a mesma ação geram sempre o mesmo `Order ID`;
- duas execuções iguais geram o mesmo CSV pronto e o mesmo `batch_id`;
- duplicatas idênticas ficam uma vez no lote;
- duplicatas conflitantes são removidas e enviadas para revisão;
- o script **não marca nada como importado automaticamente**.

Depois que o Google Ads confirmar o sucesso do lote, acrescente os IDs do
arquivo `.template.txt` ao ledger permanente, preservando os lotes anteriores:

```bash
touch .local/attribution/google_ads_offline_applied_ids.txt
grep '^nc_' .local/attribution/google-ads-offline-export/google_ads_offline_applied_ids.template.txt \
  >> .local/attribution/google_ads_offline_applied_ids.txt
sort -u .local/attribution/google_ads_offline_applied_ids.txt \
  -o .local/attribution/google_ads_offline_applied_ids.txt
chmod 600 .local/attribution/google_ads_offline_applied_ids.txt
```

Nas execuções futuras, passe:

```bash
--applied-ledger .local/attribution/google_ads_offline_applied_ids.txt
```

Não atualize o ledger antes de verificar o relatório de importação. Uma prévia
ou um arquivo apenas gerado não significa que a conversão foi aplicada.

## Revisão antes da importação

1. Abra `google_ads_offline_manifest.json` e confirme `ready_rows`,
   `rejected_rows`, `braid_rows` e `assumed_date_only_time_rows`.
2. Analise todos os motivos no CSV de rejeições. Consulte o CSV enriquecido
   original apenas no ambiente privado para corrigir a fonte.
3. Confirme na conta o nome exato da ação de conversão.
4. Se houver GBRAID ou WBRAID, configure a contagem da ação como **Every**. A
   documentação oficial informa que ações `One` não aceitam BRAID.
5. Conecte o arquivo pelo Data Manager (Google Sheets, HTTPS, SFTP ou outro
   conector disponível) e faça o mapeamento da tabela acima.
6. Use a prévia, aplique o lote e verifique **Uploads** e **Diagnostics**.
7. Só então consolide os Order IDs no ledger.

O processamento costuma levar 24–48 horas. Conversões baseadas em GBRAID ou
WBRAID podem levar até 72 horas para aparecer nos relatórios.

## O que falta para upload automático

Este escopo termina na geração revisável. Upload automático é uma etapa
separada e exige, no mínimo:

- ação de conversão offline criada e configurada na conta correta;
- projeto Google Cloud com Data Manager API habilitada;
- cliente OAuth 2.0 e autorização de uma conta com permissão no Google Ads;
- identificação de login/operating account, destination e conversion action;
- política segura para guardar e rotacionar refresh token e client secret;
- definição operacional de quando uma venda está definitivamente confirmada;
- tratamento de respostas parciais, reprocessamento e confirmação do ledger;
- validação de consentimento e políticas aplicáveis à conta.

Essas credenciais **não estão no script, na documentação nem no Git**. Quando a
conta e a ação estiverem definidas, um uploader separado poderá consumir o CSV
pronto e usar o Data Manager API. Ele deverá registrar a resposta por Order ID
antes de atualizar o ledger.

## Testes

```bash
python3 scripts/test_export_google_ads_offline.py
```

Os testes cobrem GCLID/GBRAID/WBRAID, fuso, moeda brasileira, ausência de PII,
duplicata idêntica, conflito, ledger, janela de 90 dias, modo estrito e o
bloqueio de fallback por telefone, baixa confiança e CSV legado sem evidência.

## Fontes oficiais consultadas

- [Prepare your data for import — Google Ads Data Manager Help](https://support.google.com/google-ads-data-manager/answer/14184381): campos, formatos de data, janela de 90 dias, GBRAID/WBRAID e conectores.
- [How to upgrade offline imports — Google Ads Help](https://support.google.com/google-ads/answer/15479791): Order ID, BRAIDs, GCLID e configuração `Every` para ações com BRAID.
- [Import conversions from ad clicks using files — Google Ads Help](https://support.google.com/google-ads/answer/7014069): nome exato da ação, fuso, processamento e diagnóstico.
- [Fix discrepancies and errors in offline conversion imports — Google Ads Help](https://support.google.com/google-ads/answer/13321563): prazo de processamento de GBRAID/WBRAID e migração de API.
- [Send events — Data Manager API](https://developers.google.com/data-manager/api/devguides/events/send-events): `transactionId`, identificadores e requisitos do evento.
- [Google Ads offline field mappings — Data Manager API](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/upgrade/field-mappings): mapeamento de GCLID/GBRAID/WBRAID, timestamp, valor, moeda e Order ID.
- [ConversionUploadError — Google Ads API](https://developers.google.com/google-ads/api/reference/rpc/v22/ConversionUploadErrorEnum.ConversionUploadError): erros de BRAID simultâneo, ação `One`, Order ID repetido e PII em Order ID.
