# Deploy — Outscraper Sync (Google Reviews, plano B)

**Contexto:** GBP API segue sem aprovação (caso `0-6283000041138`). Enquanto isso,
reviews entram via Outscraper. React e `google-reviews.php` **não mudam** —
o script grava o mesmo cache que o `sync-social.php` gravaria.

## O que subir (KingHost, via FTP)

| Arquivo no repo | Destino no servidor |
|-----------------|---------------------|
| `docs/social/outscraper-sync.php` | `/www/social/v1/outscraper-sync.php` |

## Editar no servidor

`/www/social/v1/social-config.php` — adicionar bloco antes de `'meta' =>`:

```php
// Plano B — reviews via Outscraper enquanto GBP API não aprova
'outscraper' => [
    'api_key' => 'PEGAR_COM_MARCELO', // não versionar
    'queries' => [
        'ChIJSRolPVtvGZURzx88U1pB5n4', // Loja 1 — Av. Pres. Vargas 740
        'ChIJq78McFxvGZURmIl8iyKRbJY', // Loja 2 — Av. Pres. Vargas 1106
    ],
],
```

## Validar (depois do upload)

```bash
# Import inicial — 20 reviews/loja (roda 1x)
curl "https://www.netcarmultimarcas.com.br/social/v1/outscraper-sync.php?key=SYNC_SECRET&limit=20"
# Esperado: {"success":true,"fetched":40,...}

# Site servindo cache novo
curl "https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=3"
# Esperado: stale:false, syncedAt preenchido, reviews recentes no topo
```

`SYNC_SECRET` = `sync.secret` do `social-config.php`.

## Cron

Já agendado na **VPS** (`root@191.252.212.86`, crontab root) — diário, 7 reviews/loja
(~430/mês, dentro do free tier de 500 do Outscraper). Nada a fazer no KingHost.

## Quando GBP API aprovar

1. Rodar `sync-social.php?key=...&reviews_only=1` → se `success:true`, API oficial ok
2. Remover cron da VPS (`crontab -e` → linha outscraper-sync)
3. (Opcional) remover `outscraper-sync.php` e bloco `outscraper` do config

## Detalhes técnicos

- Merge incremental: novos reviews entram no topo, antigos preservados
- Dedupe por `id` e por assinatura autor+texto (não duplica reviews legados)
- Reviews sem texto e sem foto são ignorados (card vazio)
- Avatares normalizados para 120px (padrão do seed)
- Backup automático: `google-reviews.backup.json` antes de cada gravação
- Testado local (PHP 7.4 Docker) contra API real: fotos e avatares HTTP 200
