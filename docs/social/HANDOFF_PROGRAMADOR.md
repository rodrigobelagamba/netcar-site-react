# Handoff — integração social Netcar

**Objetivo:** Google Reviews, Instagram Stories e réplica Instagram → dois perfis Google Business Profile (GBP), usando APIs oficiais e sem Zapier.

## Regra de segurança

- Código público: `/home/USUARIO/www/social/v1/`.
- Configuração, tokens OAuth e estado operacional: `/home/USUARIO/.netcar-social/`.
- Nunca colocar `social-config.php`, `social-tokens.json` ou segredos em `/www`, `dist/`, Git ou URLs.
- Diretório privado com permissão `0700`; arquivos privados com `0600`.

## Deploy seguro

1. Faça build e envie somente código, bibliotecas, endpoints e assets:

   ```bash
   npm run build
   ```

   O build gera `dist/social/v1/`, mas não deve incluir `social-config.php`, tokens nem estado privado.

2. No KingHost, prepare a configuração fora do webroot:

   ```bash
   install -d -m 700 /home/USUARIO/.netcar-social
   test -e /home/USUARIO/.netcar-social/social-config.php || \
     install -m 600 \
       /home/USUARIO/www/social/v1/social-config.example.php \
       /home/USUARIO/.netcar-social/social-config.php
   ```

3. Edite `/home/USUARIO/.netcar-social/social-config.php` e preencha:

   - `sync.secret`: segredo do cron/sync;
   - `oauth.admin_secret`: outro segredo forte, diferente de `sync.secret`;
   - credenciais Google e Meta;
   - `google_posts.locations` com exatamente as duas lojas:

     ```php
     'locations' => [
         'loja_1' => '11161331340741727452',
         'loja_2' => '17013442122163034193',
     ],
     ```

   Mantenha o publicador inicialmente assim:

   ```php
   'enabled' => false,
   'not_before' => '',
   ```

4. Confirme que o endpoint executa PHP:

   ```bash
   curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?action=status'
   ```

## Conectar Google e Meta

`action=connect` aceita somente `POST` autenticado com `oauth.admin_secret`. Não coloque o segredo na query string. No terminal, leia-o sem eco e obtenha a URL de redirecionamento:

```bash
read -rs NETCAR_OAUTH_ADMIN_SECRET
curl -sS -X POST \
  -H "Authorization: Bearer ${NETCAR_OAUTH_ADMIN_SECRET}" \
  -D - -o /dev/null \
  'https://www.netcarmultimarcas.com.br/social/v1/social-oauth.php?provider=google&action=connect'
unset NETCAR_OAUTH_ADMIN_SECRET
```

Abra no navegador o valor do cabeçalho `Location` e conclua o login. Repita com `provider=meta`. Os callbacks usam `state` de uso único. Depois confirme apenas os booleanos de conexão no endpoint `action=status`.

Os tokens são gravados em `/home/USUARIO/.netcar-social/social-tokens.json`, nunca em `data/cache/` público.

## Sync e cron

Prefira CLI, que não exige segredo na linha de comando:

```bash
php /home/USUARIO/www/social/v1/sync-social.php
```

Quando o cron precisar selecionar uma rotina via HTTP, use `Authorization: Bearer`:

```bash
curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?reviews_only=1'

curl -fsS \
  -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
  'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?stories_only=1'
```

Armazene `NETCAR_SYNC_SECRET` em arquivo ou wrapper privado `0600`; não o grave na URL. Frequências sugeridas: reviews duas vezes ao dia e Stories a cada 15 minutos.

## Ativar Instagram → GBP

1. Com `enabled=false`, rode o dry-run:

   ```bash
   curl -fsS \
     -H "Authorization: Bearer ${NETCAR_SYNC_SECRET}" \
     'https://www.netcarmultimarcas.com.br/social/v1/sync-social.php?posts_only=1&dry_run=1'
   ```

2. Confirme no resultado as duas locations exatas e nenhum post antigo inesperado.
3. Somente no momento da virada, defina `enabled=true` e `not_before` com timestamp ISO 8601 atual. O horário precisa ser recente; isso impede replay do histórico.
4. Valide a primeira publicação natural nos dois perfis. Só então pause os Zaps antigos; não os exclua durante a transição.

O arquivo opcional `/home/USUARIO/.netcar-social/google-posts-settings.json` pode sobrescrever apenas `enabled` e `not_before`, sem alterar credenciais.

## Verificações finais

```bash
curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/google-reviews.php?page=1&limit=21'
curl -fsS 'https://www.netcarmultimarcas.com.br/social/v1/stories.php?action=list'
```

- OAuth conectado para Google e Meta.
- Reviews e Stories atualizados.
- Publicador desabilitado até o handover, depois ativo somente com `not_before` recente.
- Nenhum arquivo privado acessível por HTTP.

Detalhes: [`SOCIAL_SYNC_SETUP.md`](./SOCIAL_SYNC_SETUP.md).
