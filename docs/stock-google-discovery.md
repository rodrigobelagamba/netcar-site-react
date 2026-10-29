# Acompanhamento do estoque no Google

O monitor consulta o estoque e as páginas públicas, sem alterar cadastro, sitemap,
anúncio ou indexação. A etapa `scripts/monitor-stock-google.mjs` integra o runner
diário existente `run-equipment-daily.mjs`; não há cron adicional. Seus erros não
bloqueiam equipamentos/garantia e seus arquivos ficam separados.

## Execução e estado

```sh
node scripts/monitor-stock-google.mjs --state-dir /diretorio/privado/seo-discovery
```

O diretório padrão é `.devops/equipment/seo-discovery`. Arquivos são privados
(diretório 700, JSON 600), gravados por substituição atômica. Nunca versionar estado
ou credenciais. `state.json` contém a observação anterior; `report.json` contém o
resultado e `inspectionQueue`; `run-status.json` informa se a última tentativa
terminou. Uma falha não deve ser confundida com relatório atualizado.

O primeiro estoque lido vira uma **linha de base**: `firstSeenIsBaseline=true`.
`firstSeenAt` é a primeira observação pelo monitor, não a entrada histórica da
unidade. Ausência em leitura completa marca indisponível, sem afirmar venda.

Diariamente são verificados sitemap, HTTP, canonical, robots, conteúdo da ficha e
imagem. A classificação `awaiting_photos` não é erro de SEO: a origem ainda não
oferece foto real. Imagem não genérica na origem e genérica/ausente no SEO gera
pendência. Isso é uma verificação de metadados, não inspeção visual das fotos.

A consulta Google ocorre na primeira leitura, em 3/7/14 dias para pendências e,
depois, semanalmente. Indexados são revistos semanalmente; erros/ausência de acesso
são revistos no dia seguinte. São intervalos operacionais, não promessa do Google.
`--force` força nova conferência; não solicita indexação.

`events` é uma fila local limitada aos últimos mil eventos. O consumidor mantém os
IDs já comunicados e notifica apenas mudança relevante ou ação necessária. Registrar
um evento não significa que uma mensagem foi enviada. O monitor não tem canal de
mensagens nem credenciais de WhatsApp.

## Acesso opcional à API

Sem credenciais, o monitor funciona para conferência pública e informa Google
`unknown`; nunca converte HTTP200 ou sitemap em prova de indexação. O acesso usa
somente a API de inspeção, propriedade `sc-domain:netcarmultimarcas.com.br`.

Configurar `NETCAR_GSC_CREDENTIALS_FILE` com caminho absoluto de um JSON privado
600, contendo `client_id`, `client_secret`, `refresh_token` de acesso já autorizado.
Também aceita `access_token` no arquivo ou `NETCAR_GSC_ACCESS_TOKEN` para execução
pontual. Tokens expirados não são renovados no modo access_token. Não colocar token
em argumentos de comando, logs, repositório ou frontend. O monitor não concede
permissões nem registra aplicativos. O escopo mínimo de leitura é
`https://www.googleapis.com/auth/webmasters.readonly`.

A API consulta o registro do índice, não faz teste ao vivo nem solicita inclusão.
Google Indexing API para empregos/transmissões não é usada para veículos.

## Observações obtidas pelo Search Console no Chrome

Enquanto não houver API configurada, uma leitura real da inspeção individual pode
ser importada pelo arquivo privado `gsc-ui-observations.json` no diretório de
estado, ou por `--observations-file /caminho/privado.json`. Conta correta:
`marcelo@netcarmultimarcas.com.br`.

```json
{
  "schemaVersion": 1,
  "source": "gsc-ui",
  "observations": [
    {
      "vehicleId": "42",
      "url": "https://www.netcarmultimarcas.com.br/veiculo/modelo-2025-42",
      "checkedAt": "2026-10-29T12:00:00.000Z",
      "status": "not_indexed",
      "coverageState": "Detectada, mas não indexada no momento",
      "lastCrawlTime": null
    }
  ]
}
```

Exemplo de formato apenas; não importar o exemplo como resultado. Status permitidos:
`indexed`, `not_indexed`, `unknown`. Usar somente a URL realmente inspecionada e a
data dessa leitura, não o teste ao vivo ou a data de um relatório agregado. Só
aceita URLs atuais do estoque e observações com até 7 dias; ignora mais antigas.
Uma observação UI nunca substitui um resultado API mais recente. Erro de acesso
não deve apagar a última observação válida: ela fica em `lastKnownGoogle`.

O heartbeat existente pode consumir `inspectionQueue` e inspecionar um pequeno lote
no Chrome. Não tentar contornar cotas/CAPTCHA, não extrair cookies ou criar outro
agendamento. Solicitação manual de indexação é ação separada e não é executada
por este monitor.

## Verificação

```sh
node --test scripts/tests/stock-google-discovery.test.mjs devops/server/tests/equipment-daily-run.test.js
```

Referências oficiais: [inspeção](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
e [solicitação de rastreamento](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
