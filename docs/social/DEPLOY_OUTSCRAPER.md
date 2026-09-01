# Deploy — Outscraper Sync (fallback de Reviews)

Use o Outscraper somente enquanto a GBP API oficial de Reviews não estiver disponível. Ele grava o mesmo cache consumido por `google-reviews.php` e não controla a publicação Instagram → GBP.

## Subir o código

Envie somente `docs/social/outscraper-sync.php` para:

```text
/home/USUARIO/www/social/v1/outscraper-sync.php
```

Não envie configuração, API key ou tokens junto com o código.

## Configurar fora do webroot

Edite `/home/USUARIO/.netcar-social/social-config.php` (`0600`) e adicione:

```php
'outscraper' => [
    'api_key' => 'OBTER_POR_CANAL_SEGURO',
    'queries' => [
        'ChIJSRolPVtvGZURzx88U1pB5n4', // Loja 1
        'ChIJq78McFxvGZURmIl8iyKRbJY', // Loja 2
    ],
],
```

O diretório `/home/USUARIO/.netcar-social` deve ter permissão `0700`. Nunca mantenha `social-config.php` em `/www`, `dist` ou Git.

## Validar

Prefira CLI, sem segredo em URL:

```bash
php /home/USUARIO/www/social/v1/outscraper-sync.php 20
```

Se for necessário testar por HTTP, use `Authorization: Bearer`:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/outscraper-sync.php?limit=20'
```

Depois valide o cache público:

```bash
curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=3'
```

## Cron

Agende no servidor por CLI; assim nenhuma credencial aparece em URL:

```cron
0 7 * * * php /home/USUARIO/www/social/v1/outscraper-sync.php 7
```

Com duas lojas e limite 7, estime o consumo antes de depender de um plano gratuito.

## Retorno à GBP API oficial

1. Rode o sync oficial por CLI ou com Bearer e `reviews_only=1`.
2. Confirme `success: true` e ausência de `errors.reviews`.
3. Remova o cron do Outscraper.
4. Opcionalmente remova o endpoint e o bloco `outscraper` do arquivo privado.

O fallback não altera `google_posts`. O publicador deve continuar com `enabled=false` até um dry-run confirmar exatamente as duas locations; na virada, use `enabled=true` e `not_before` recente.

## Comportamento

- Merge incremental e deduplicação de reviews.
- Backup de `google-reviews.json` antes da gravação.
- Reviews sem conteúdo útil são ignorados.
- O React e `google-reviews.php` permanecem inalterados.
