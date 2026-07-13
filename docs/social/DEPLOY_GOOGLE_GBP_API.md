# Deploy — Google Reviews via GBP API (oficial)

**Contexto:** acesso GBP aprovado (09/07/2026). Outscraper fica de fallback até sync oficial OK.

## Pré-requisito (1 clique)

Ativar **Google My Business API** no projeto `796541076133`:

https://console.developers.google.com/apis/api/mybusiness.googleapis.com/overview?project=796541076133

Botão **ENABLE / ATIVAR**. Sem isso o sync autentica mas reviews retornam 403.

APIs já usadas e OK:
- My Business Account Management
- My Business Business Information

## O que muda no código

`GoogleReviewsClient.php`:
- Monta parent correto `accounts/{id}/locations/{id}` (Business Information devolve só `locations/{id}`)
- Filtra lojas com "Netcar" no título (ignora contas extras)
- Só importa **4★+ com texto** (igual Outscraper)
- Grava **todos** os reviews no cache (paginação no `google-reviews.php`)

## Deploy

1. Merge/deploy desta branch (painel DevOps → Build + deploy completo)
2. Confirmar `client_secret` no KingHost = OAuth client do projeto (já corrigido se era `GOCSPX-ogF…`)
3. Testar:

```bash
curl "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=SYNC_SECRET&reviews_only=1"
# Esperado: success true, sem errors.reviews
```

4. Trocar cron na VPS (remover Outscraper, usar oficial):

```cron
0 6,18 * * * curl -s "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=SYNC_SECRET&reviews_only=1"
```

## Se ainda falhar

| Erro | Ação |
|------|------|
| `invalid_client` | Secret errado em `social-config.php` |
| `403 … My Business API has not been used` | Ativar link acima |
| `404 /v4/locations/…` | Código antigo sem prefixo `accounts/` — precisa deste deploy |
| `quota 0` | Pedido GBP ainda não aplicado — raro pós-aprovação |
