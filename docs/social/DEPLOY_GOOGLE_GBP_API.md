# Deploy — Google Business Profile API

**Contexto:** acesso GBP aprovado em 09/07/2026. A API oficial atende Reviews e Local Posts; Outscraper permanece apenas como fallback de Reviews até a validação.

## Pré-requisito

Ative **Google My Business API** no projeto `796541076133`:

https://console.developers.google.com/apis/api/mybusiness.googleapis.com/overview?project=796541076133

Também devem estar ativas:

- My Business Account Management API;
- My Business Business Information API.

## Configuração privada

Credenciais e tokens não ficam no deploy web. Use:

```text
/home/USUARIO/.netcar-social/social-config.php   (0600)
/home/USUARIO/.netcar-social/social-tokens.json  (0600)
```

O diretório `/home/USUARIO/.netcar-social` deve ter permissão `0700`. Nunca copie esses arquivos para `/www`, `dist` ou Git.

Em `social-config.php`, confirme o OAuth client do projeto e as duas locations exatas:

```php
'google_posts' => [
    'enabled' => false,
    'not_before' => '',
    'stock_api_url' => 'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500',
    'locations' => [
        'loja_1' => '11161331340741727452',
        'loja_2' => '17013442122163034193',
    ],
],
```

`oauth.admin_secret` deve ser forte e diferente de `sync.secret`. O início do OAuth aceita somente `POST` autenticado por `Authorization: Bearer`; nunca coloque segredo na URL.

## Validar Reviews oficiais

Prefira a execução local no servidor:

```bash
php /home/USUARIO/www/social/v1/sync-social.php
```

Ou selecione somente Reviews por HTTP, com Bearer:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?reviews_only=1'
```

Esperado: `success: true` e ausência de `errors.reviews`. Depois disso, remova o cron do Outscraper e mantenha o cron oficial.

## Validar Local Posts sem publicar

O publicador inicia desabilitado. Faça dry-run:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?posts_only=1&dry_run=1'
```

Confirme as duas lojas e o destino dos CTAs. `destinationSource=caption_url` indica uma URL explícita na legenda; `stock_reference` indica que a referência `#netcar<ID>` identificou uma única unidade ainda ativa no estoque. Sem referência exata ou com carro vendido, o publicador usa `/seminovos` e informa `fallback` em vez de inferir pela copy. No momento da virada, defina `enabled=true` e `not_before` com horário ISO 8601 atual. Um `not_before` ausente, inválido ou antigo bloqueia a ativação para evitar replay. Pause o Zapier somente após uma publicação natural aparecer corretamente nos dois perfis.

## Diagnóstico

| Erro | Ação |
|------|------|
| `invalid_client` | Conferir client ID/secret no arquivo privado |
| `403 ... API has not been used` | Ativar Google My Business API |
| `404 /v4/locations/...` | Atualizar código que monta `accounts/{id}/locations/{id}` |
| `quota 0` | Confirmar que a aprovação GBP foi aplicada ao projeto |
| location ausente/duplicada | Corrigir a lista para exatamente os dois IDs Netcar |
