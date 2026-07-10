# Fix — Gerenciador `/sistema/` (e `/admin/`) sumiu (vira site React)

**Data:** 2026-07-09 · atualizado 2026-07-10

## Sintoma

`https://www.netcarmultimarcas.com.br/sistema/` (ou `/admin/`) abre o site React
em vez do painel/gerenciador PHP.

## Causa

Commit `0a6d552` (27/06) removeu `RewriteCond %{REQUEST_FILENAME} -d` do `.htaccess`
para destravar rotas SPA (`/seminovos`, `/veiculo/*`) bloqueadas por pastas legadas.

Efeito colateral: pastas reais `/sistema/` e `/admin/` no docroot deixaram de ser
servidas e caíram no fallback SPA (`index.php`).

Path real do gerenciador Netcar: **`/sistema/`** (não só `/admin/`).

## Fix no código

`public/.htaccess` — excluir `admin`, `sistema` e `api` do rewrite SPA:

```apache
RewriteRule ^(admin|sistema|api)(/|$) - [L]
```

`scripts/deploy-local.sh` — `mirror --delete` não apaga mais `admin/`, `sistema/`,
`api/`, `social/`.

`public/robots.txt` — `Disallow: /sistema/`.

## Deploy

1. Subir `.htaccess` novo (de `dist/` após build, ou `public/.htaccess` direto no docroot).
2. Testar: `https://www.netcarmultimarcas.com.br/sistema/`

### Se ainda abrir o React

Pasta `/sistema/` **não existe mais** no servidor (possível apagão por deploy com `--delete`).

Restaurar no KingHost:

1. Painel KingHost → Backup / File Manager
2. Restaurar pasta `www/sistema/` (ou `public_html/sistema/`) de backup **antes de 27/06/2026**
3. Confirmar que existe `sistema/index.php` (ou login equivalente)
4. Retestar `/sistema/`

## Validação

```bash
# Deve ser o gerenciador (NÃO título "Seminovos em Esteio")
curl -sS "https://www.netcarmultimarcas.com.br/sistema/" | head -c 500

# SPA continua ok
curl -sS -o /dev/null -w "%{http_code}\n" "https://www.netcarmultimarcas.com.br/seminovos"
curl -sS -o /dev/null -w "%{http_code}\n" "https://www.netcarmultimarcas.com.br/veiculo/qualquer"
```
