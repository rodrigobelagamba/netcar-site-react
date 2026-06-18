# Handoff — Widgets sociais Netcar (sem EmbedSocial)

**Branch:** `feat/netcar-social-widgets`  
**Objetivo:** Google Reviews (2 lojas GBP) + Instagram Stories via APIs oficiais, cache PHP KingHost, widgets React.

---

## O que já está pronto (nesta branch)

| Área | Status |
|------|--------|
| Widgets React (`NetcarGoogleReviewsSection`, `NetcarStoriesSection`) | ✅ |
| Paginação "Carregar mais" (21 reviews por página) | ✅ |
| Endpoints PHP (`google-reviews.php`, `stories.php`, `social-oauth.php`, `sync-social.php`) | ✅ |
| Lib PHP Google + Meta/Instagram | ✅ |
| Build copia PHP → `dist/api/v1/` (`scripts/copy-social-php.js`) | ✅ |
| Flag `VITE_USE_NETCAR_SOCIAL=true` (`.env.example`) | ✅ |
| Credenciais OAuth preparadas localmente (ver abaixo) | ✅ arquivo local, não versionado |

---

## O que o programador DEVE fazer (ordem)

### 1. Merge / checkout

```bash
git fetch origin
git checkout feat/netcar-social-widgets
```

### 2. Criar `social-config.php` no servidor (NÃO commitar)

Copiar template e preencher secrets (obter `client_secret` / `app_secret` / `sync.secret` com gestor TI ou Meta/Google Console):

```bash
cp docs/api/php-samples/social-config.example.php docs/api/php-samples/social-config.php
```

**IDs já definidos (públicos):**

| Campo | Valor |
|-------|--------|
| Google GCP project | `fabled-skein-484500-g7` (My Project 62332) |
| Google OAuth Client ID | `796541076133-rtjj5ibs0m04rfs5ae7o59eik4pao963.apps.googleusercontent.com` |
| Google redirect URI | `https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?provider=google&action=callback` |
| Meta app | **AutoAds Analyst** — App ID `1864158561129535` |
| Meta redirect URI | `https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?provider=meta&action=callback` (já cadastrado no app) |
| Instagram username | `netcar_rc` |
| Instagram Graph user_id | `17841402339444396` |

**Secrets:** `google.client_secret`, `meta.app_secret`, `sync.secret` → **nunca** no Git. Gestor tem cópia local de `social-config.php` pronta para deploy.

**Google Cloud — conferir antes do deploy:**
- APIs ativas: My Business Account Management, My Business Business Information, Google My Business API
- OAuth consent com escopo `https://www.googleapis.com/auth/business.manage`
- Redirect URI de produção cadastrado no OAuth Client

**Meta — app já configurado:**
- Produtos: Login Facebook, Instagram Graph API, API Marketing
- Modo **desenvolvimento** (OAuth ok para admins/testadores do app)

### 3. Build + deploy KingHost

```bash
# .env.production com VITE_USE_NETCAR_SOCIAL=true
npm run build
```

O build gera `dist/` incluindo `dist/api/v1/` (PHP + lib). Se existir `social-config.php` local, é copiado automaticamente.

**Deploy FTP** (`.env.local` na raiz do projeto):

```env
FTP_SERVER=...
FTP_USERNAME=...
FTP_PASSWORD=...
FTP_SERVER_DIR=/www/
```

```bash
npm run deploy:local
```

**Manual:** subir conteúdo de `dist/api/v1/` para `/www/api/v1/` no KingHost. Garantir que PHP executa nessa pasta (não cair no fallback SPA do React).

**Validar após deploy:**

```bash
curl -s "https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?action=status"
# esperado: JSON (não HTML 404)
```

### 4. OAuth — conectar contas (1x, browser admin)

Logado como **Owner/Manager** das 2 lojas Google e admin da Page/Instagram Netcar:

1. Google:  
   `https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?provider=google&action=connect`

2. Meta/Instagram:  
   `https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?provider=meta&action=connect`

3. Status:  
   `https://www.netcarmultimarcas.com.br/api/v1/social-oauth.php?action=status`  
   → `google.connected: true`, `meta.connected: true`

Tokens gravados em `data/cache/social-tokens.json` no servidor (não versionar).

### 5. Primeiro sync

```bash
curl -s "https://www.netcarmultimarcas.com.br/api/v1/sync-social.php?key=SEU_SYNC_SECRET"
```

Resposta esperada: `reviews.count`, `stories.count`, `success: true`.

### 6. Cron KingHost

```cron
# Reviews — 2x/dia (Loja 1 + Loja 2 agregadas)
0 6,18 * * * curl -s "https://www.netcarmultimarcas.com.br/api/v1/sync-social.php?key=SEU_SYNC_SECRET&reviews_only=1"

# Stories — 15 min (expiram em 24h)
*/15 * * * * curl -s "https://www.netcarmultimarcas.com.br/api/v1/sync-social.php?key=SEU_SYNC_SECRET&stories_only=1"
```

### 7. Testes finais

```bash
# Reviews paginados
curl -s "https://www.netcarmultimarcas.com.br/api/v1/google-reviews.php?page=1&limit=21"

# Stories
curl -s "https://www.netcarmultimarcas.com.br/api/v1/stories.php?action=list"
```

**Site:**
- Home e Detalhes: seção reviews + stories
- Botão "Carregar mais" carrega página 2, 3…
- Sem EmbedSocial no fetch (flag `VITE_USE_NETCAR_SOCIAL=true`)

### 8. Limpeza (após sync OK)

- Remover scripts EmbedSocial do HTML se ainda existirem
- Opcional: remover `public/embedsocial-bridge.php` e adapters legados
- Confirmar `.env.production` com `VITE_USE_NETCAR_SOCIAL=true` no deploy do front

---

## Arquivos importantes

| Caminho | Função |
|---------|--------|
| `docs/api/php-samples/` | Fonte PHP (copiada no build) |
| `docs/api/SOCIAL_SYNC_SETUP.md` | Detalhes técnicos OAuth/API |
| `docs/social-design-spec.md` | Spec visual vs EmbedSocial |
| `src/design-system/components/patterns/social/` | Componentes UI |
| `src/api/endpoints/googleReviews.ts` | Fetch reviews |
| `src/api/endpoints/stories.ts` | Fetch stories |
| `scripts/copy-social-php.js` | Copia PHP no build |

---

## Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| `/api/v1/*.php` retorna HTML (index React) | PHP não deployado ou `.htaccess` roteando tudo pro SPA |
| Google OAuth 403 / API error | Business Profile API não aprovada ou conta sem Manager das lojas |
| Meta "ig_user_id ausente" | Page Facebook sem `@netcar_rc` vinculado como Business |
| Stories vazio | Nenhum story ativo nas últimas 24h (normal) |
| Reviews só de 1 loja | Conta OAuth sem acesso à 2ª location; ver `google.location_names` no config |

---

## Contato / credenciais

Solicitar ao gestor TI cópia de `social-config.php` (com secrets) ou valores de `client_secret`, `app_secret` e `sync.secret` por canal seguro.

Documentação completa: [`SOCIAL_SYNC_SETUP.md`](./SOCIAL_SYNC_SETUP.md)
