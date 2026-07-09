# Fix — Gerenciador `/admin/` sumiu (vira site React)

**Data:** 2026-07-09

## Sintoma

`https://www.netcarmultimarcas.com.br/admin/` abre o site React (título "Seminovos em Esteio…") em vez do painel/gerenciador PHP.

## Causa

Commit `0a6d552` (27/06) removeu `RewriteCond %{REQUEST_FILENAME} -d` do `.htaccess` para destravar rotas SPA (`/seminovos`, `/veiculo/*`) bloqueadas por pastas legadas.

Efeito colateral: pasta real `/admin/` no docroot deixou de ser servida e caiu no fallback SPA (`index.php`).

`robots.txt` já tinha `Disallow: /admin/` — confirma que o path sempre foi o gerenciador.

## Fix no código (esta branch)

`public/.htaccess` — excluir `admin` e `api` do rewrite SPA:

```apache
RewriteRule ^(admin|api)(/|$) - [L]
```

`scripts/deploy-local.sh` — `mirror --delete` não apaga mais `admin/`, `api/`, `social/`.

## Deploy

1. Subir `.htaccess` novo (de `dist/` após build, ou `public/.htaccess` direto no docroot).
2. Testar: `https://www.netcarmultimarcas.com.br/admin/`

### Se ainda abrir o React

Pasta `/admin/` **não existe mais** no servidor (possível apagão por deploy com `--delete`).

Restaurar no KingHost:

1. Painel KingHost → Backup / File Manager
2. Restaurar pasta `www/admin/` (ou `public_html/admin/`) de backup **antes de 27/06/2026**
3. Confirmar que existe `admin/index.php` (ou login equivalente)
4. Retestar `/admin/`

## Validação

```bash
# Deve ser o gerenciador (NÃO título "Seminovos em Esteio")
curl -sS "https://www.netcarmultimarcas.com.br/admin/" | head -c 500

# SPA continua ok
curl -sS -o /dev/null -w "%{http_code}\n" "https://www.netcarmultimarcas.com.br/seminovos"
curl -sS -o /dev/null -w "%{http_code}\n" "https://www.netcarmultimarcas.com.br/veiculo/qualquer"
```
