# Social Sync — Google Reviews + Instagram (sem EmbedSocial)

> **Handoff para deploy:** leia primeiro [`HANDOFF_PROGRAMADOR.md`](./HANDOFF_PROGRAMADOR.md) — checklist do que o programador deve fazer na branch `feat/netcar-social-widgets`.

Substitui EmbedSocial por **APIs oficiais** + cache PHP no KingHost.

## Arquitetura

```
Google Business Profile API ──┐
                              ├── sync-social.php (cron)
Instagram Graph API ──────────┘
              ↓
   data/cache/google-reviews.json
   data/cache/stories.json
              ↓
   google-reviews.php / stories.php  →  React
```

---

## 1. Deploy dos arquivos PHP

Copie `docs/social/` para `/social/v1/` no KingHost (ou use `dist/social/v1/` após o build).

**PHP 7.4+** no servidor (KingHost dedicada). O código não usa sintaxe exclusiva do PHP 8.

| Arquivo | Função |
|---------|--------|
| `lib/*` | Clientes Google/Meta |
| `social-config.php` | Credenciais (copiar do `.example`) |
| `social-oauth.php` | Conectar Google + Instagram |
| `sync-social.php` | Cron — puxa dados |
| `google-reviews.php` | API pública reviews |
| `stories.php` | API pública stories |
| `data/` | cache + seeds |

---

## 2. Google Cloud (Reviews — 2 lojas)

1. Crie projeto em [Google Cloud Console](https://console.cloud.google.com/)
2. Ative billing (grátis na prática para este uso)
3. Solicite acesso **Business Profile API** ([formulário Google](https://developers.google.com/my-business/content/prereqs))
4. Crie credenciais **OAuth 2.0 Web**:
   - Redirect URI: `https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=callback`
5. Copie `client_id` e `client_secret` para `social-config.php`

**Conta Google:** use login **Owner/Manager** das **duas lojas** (Loja 1 + Loja 2 Esteio).

---

## 3. Meta / Instagram (@netcar_rc)

1. Crie app em [developers.facebook.com](https://developers.facebook.com/)
2. Tipo **Business**
3. Adicione produto **Instagram Graph API**
4. Vincule **Página Facebook** ↔ **@netcar_rc** (Business/Creator)
5. OAuth redirect: `https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=meta&action=callback`
6. Copie `app_id` e `app_secret` para `social-config.php`

---

## 4. Configurar `social-config.php`

```bash
cp social-config.example.php social-config.php
# Edite com credenciais reais + sync.secret forte
```

---

## 5. Obter tokens (1x — login manual)

Abra no browser (logado como admin):

```
https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=connect
https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=meta&action=connect
```

Verificar status:

```
https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?action=status
```

Tokens salvos em `data/cache/social-tokens.json` (não versionar).

---

## 6. Primeiro sync

```bash
php sync-social.php
# ou HTTP:
curl "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=SEU_SYNC_SECRET"
```

---

## 7. Cron KingHost

```cron
# Reviews — 2x/dia
0 6,18 * * * curl -s "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=SECRET&reviews_only=1"

# Stories — a cada 15 min (expiram em 24h)
*/15 * * * * curl -s "https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?key=SECRET&stories_only=1"
```

---

## 8. Testar API

```bash
curl "https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=21"
curl "https://www.netcarmultimarcas.com.br/social/v1/stories.php?action=list"
```

---

## O que o React usa

Base: `VITE_SOCIAL_API_BASE_URL` (padrão `https://www.netcarmultimarcas.com.br/social/v1`)

- `GET /social/v1/google-reviews.php?page=N&limit=21` — paginação "Carregar mais"
- `GET /social/v1/stories.php?action=list` — stories ativos
- Fallback local: `/data/*.seed.json` se cache indisponível

**EmbedSocial pode ser removido** após primeiro sync OK.
