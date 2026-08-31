# Social Sync — Google Reviews, Instagram e GBP

Integração sem EmbedSocial e sem Zapier, baseada nas APIs oficiais do Google e da Meta.

## Arquitetura

```text
Google Business Profile API ─┐
Instagram Graph API ─────────┼─> sync-social.php (cron)
                             │
                             ├─> cache público de Reviews/Stories
                             └─> Local Posts nas duas locations GBP

/home/USUARIO/.netcar-social/
  social-config.php
  social-tokens.json
  oauth-states.json
  instagram-gbp-posts.json
  google-posts-settings.json (opcional)
```

Somente caches sem credenciais podem permanecer em `/home/USUARIO/www/social/v1/data/`. Configuração, tokens e estado operacional ficam fora do document root.

## 1. Subir o código

Após o build, envie o conteúdo de `dist/social/v1/` para `/home/USUARIO/www/social/v1/`. Confirme antes do upload que o diretório gerado não contém `social-config.php`, tokens ou arquivos de estado.

Requisitos: PHP 7.4+ e HTTPS. Preserve a proteção de `data/.htaccess`.

## 2. Criar a configuração privada

```bash
install -d -m 700 /home/USUARIO/.netcar-social
test -e /home/USUARIO/.netcar-social/social-config.php || \
  install -m 600 \
    /home/USUARIO/www/social/v1/social-config.example.php \
    /home/USUARIO/.netcar-social/social-config.php
```

Edite o arquivo privado com:

- `sync.secret` para sync/cron;
- `oauth.admin_secret` distinto para iniciar OAuth;
- `google.client_id`, `google.client_secret` e redirect URI;
- `meta.app_id`, `meta.app_secret` e redirect URI;
- `google_posts.locations` contendo exatamente dois slugs e dois IDs únicos.

O caminho padrão privado já é `/home/USUARIO/.netcar-social`. Não crie cópia real da configuração em `/www` ou `dist`.

## 3. Google e Meta

Google:

- habilite My Business Account Management, Business Information e Google My Business API;
- use uma conta Owner/Manager das duas lojas;
- autorize o escopo `https://www.googleapis.com/auth/business.manage`;
- cadastre o callback `https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=callback`.

Meta:

- use app Business com Instagram Graph API;
- vincule a Página Facebook ao perfil profissional `@netcar_rc`;
- cadastre o callback `https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=meta&action=callback`.

## 4. OAuth protegido

O status é público e retorna somente estado de conexão. O início de OAuth exige `POST` e `Authorization: Bearer <oauth.admin_secret>`:

```bash
read -rs NETCAR_OAUTH_ADMIN_SECRET
curl -sS -X POST \
  -H "Authorization: Bearer ${NETCAR_OAUTH_ADMIN_SECRET}" \
  -D - -o /dev/null \
  'https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=connect'
unset NETCAR_OAUTH_ADMIN_SECRET
```

Abra o `Location` retornado no navegador e repita com `provider=meta`. Nunca envie `oauth.admin_secret` por query string e não reutilize `sync.secret` para essa função.

Tokens ficam em `/home/USUARIO/.netcar-social/social-tokens.json`, com permissão `0600`.

## 5. Sync

CLI é a opção preferida:

```bash
php /home/USUARIO/www/social/v1/sync-social.php
```

Para execução HTTP, envie o segredo no cabeçalho:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?stories_only=1'
```

Use reviews duas vezes ao dia e Stories a cada 15 minutos. O sync de Stories também verifica posts; enquanto o publicador estiver desabilitado, ele apenas informa `skipped`.

## 6. Réplica Instagram → dois perfis GBP

Configuração inicial obrigatória:

```php
'google_posts' => [
    'enabled' => false,
    'not_before' => '',
    'locations' => [
        'loja_1' => '11161331340741727452',
        'loja_2' => '17013442122163034193',
    ],
],
```

O cliente recusa configuração diferente de exatamente duas locations únicas. Antes de ativar:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?posts_only=1&dry_run=1'
```

No handover, defina `enabled=true` e um `not_before` ISO 8601 atual, dentro da janela recente de ativação. Isso evita republicar posts antigos. Valide a primeira publicação nas duas lojas antes de pausar o Zapier.

## 7. APIs públicas

```bash
curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=21'
curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/stories.php?action=list'
```

- `GET /google-reviews.php?page=N&limit=21`: reviews paginados.
- `GET /stories.php?action=list`: Stories ativos.
- `GET /story-media.php?url=...`: mídia servida pelo domínio Netcar.
- `GET /instagram-post-media.php?...`: mídia validada dos Local Posts.

Nenhum desses endpoints deve expor credenciais ou tokens.
