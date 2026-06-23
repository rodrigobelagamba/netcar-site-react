# Automação SEO — Netcar

Sistema **data-driven**: páginas e pautas nascem dos dados reais (estoque via API),
não de texto escrito à mão um a um. Objetivo: capturar busca **não-marca**
("volkswagen usado esteio", "suv seminovo", "como financiar carro usado") sem
criar conteúdo vazio (thin/AI slop).

## Visão geral

```
API de veículos (/api/v1/veiculos.php)
        │
        ├─ generate-landings.js   → src/data/seo/landings.json   (marca/categoria)
        ├─ generate-sitemap.js    → public/sitemap.xml           (veículos)
        ├─ generate-seo-assets.js → public/seo-static/*.html     (HTML p/ crawler)
        │                           + sitemap final (estático+veículos+cidades+landings)
        └─ generate-blog-drafts.js→ src/data/seo/blog-drafts.json (RASCUNHOS, não publica)
```

Tudo (menos blog) roda no `npm run build`. Se a API cair, cada gerador
preserva o JSON anterior — build nunca quebra por causa disso.

## 1. Landings de marca/categoria (automático, publica)

`scripts/generate-landings.js`:
- Lê a API, conta carros por **marca** e **categoria**.
- Cria landing só para filtros com estoque suficiente (marca ≥ 3, categoria ≥ 3).
  Sem estoque = sem página (evita thin content).
- Gera `src/data/seo/landings.json`.

Cada landing vira:
- Rota React `/comprar-{slug}` (`EstoqueLandingPage.tsx`) — H1 + intro + FAQ +
  **grid do estoque real filtrado** (conteúdo único de verdade) + CTA WhatsApp 24/7.
- HTML estático `seo-static/landing-{slug}.html` servido a crawlers via `.htaccess`.
- Entrada no `sitemap.xml`.
- Link no rodapé (descoberta/indexação).

Adicionar carro de uma marca nova ao estoque → próximo build cria a landing sozinho.

**Rodar isolado:** `npm run generate-landings`

## 2. Blog (automático, PUBLICA sozinho, com ROTAÇÃO + ACÚMULO)

`scripts/generate-blog.js`:
- Pool grande de pautas: uma por **marca** (com ≥3 carros), uma por
  **categoria** + perenes (financiamento, checklist, troca, preços, automático,
  primeiro carro). Hoje ~17 pautas na fila.
- A cada execução:
  - **Mantém** todos os posts já publicados (nada some) e **atualiza os dados**
    dinâmicos deles (preços/contagem do estoque).
  - **Publica `MAX_NEW_PER_RUN` tema(s) novo(s)** ainda não usados, com data de hoje.
  - Primeira execução sem histórico: publica um **lote inicial** (`INITIAL_BATCH`,
    hoje 6) com datas escalonadas, para o blog já nascer cheio.
- Escreve `src/data/seo/blog-auto.json`. O loader mescla com `blog-posts.json`
  (manuais); **manuais têm prioridade** no slug (nunca sobrescreve humano).

Ritmo: **1 post novo por execução**. Rodando **1x por semana**, o blog cresce
~1 post/semana e leva ~4 meses para esgotar a fila atual — quando esgota, segue
atualizando os dados dos existentes.

**Rodar manual:** `npm run generate-blog`

> O `blog-auto.json` precisa **persistir entre execuções** (é o histórico). Ver
> a seção VPS/Docker abaixo.

> Qualidade: artigos usam dados reais + estrutura própria para "fazer sentido".
> Para subir o nível, trocar os parágrafos por geração via LLM mantendo a
> publicação automática.

## 4. Agendamento semanal (VPS + Docker) — para o programador

Objetivo: rodar **build + deploy 1x por semana** sem ninguém tocar. Assim o
gerador de blog/landings reflete o estoque e publica a pauta da semana.

### Pré-requisitos
- VPS com Docker (pode ser a mesma do StackPick, `191.252.212.86`).
- Acesso de deploy à KingHost: **SSH** (recomendado) ou **FTP**.
- Repositório clonado/atualizado na VPS, ou clonado a cada run.

### Variáveis (definir na VPS, NUNCA commitar)
O deploy lê `.env.local` (ver `scripts/deploy-local.js`):
```
DEPLOY_METHOD=ssh           # ou ftp
SSH_USER=netcarmultimarcas
SSH_DIR=www/
# ou, se FTP:
# FTP_SERVER=...; FTP_USERNAME=...; FTP_PASSWORD=...; FTP_SERVER_DIR=/www/
```
Mais `.env.production` (já no repo) com as VITE_*.

### Dockerfile sugerido (`docker/blog-cron/Dockerfile`)
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git openssh-client tar
WORKDIR /app
# o repo é montado como volume em /app (ver compose)
CMD ["npm","run","deploy:local"]   # build (gera blog/landings) + deploy
```

### docker-compose + cron (exemplo)
Montar o repo como volume para o `blog-auto.json` **persistir** entre execuções:
```yaml
services:
  netcar-weekly:
    build: ./docker/blog-cron
    volumes:
      - /opt/netcar-site-react:/app           # repo persistente (histórico do blog)
      - /opt/netcar-secrets/.env.local:/app/.env.local:ro
```
O container roda `npm run weekly` (= `generate-blog` + `deploy:local`):
```dockerfile
CMD ["npm","run","weekly"]
```
Agendar no host (crontab) — **segunda-feira 06:00**:
```cron
0 6 * * 1 cd /opt/netcar-site-react && git pull --ff-only && docker compose run --rm netcar-weekly >> /var/log/netcar-weekly.log 2>&1
```

### O que cada run faz
1. `git pull` (pega ajustes de código).
2. `npm run weekly`:
   - `generate-blog.js` → publica **1 pauta nova** da fila (acumula no histórico).
   - `deploy:local` → `npm run build` (landings + sitemap + HTML estático) +
     deploy SSH/FTP para a KingHost.
3. `blog-auto.json` é atualizado **no volume** (persiste o histórico).

> Importante: `generate-blog` roda **só aqui** (rodada semanal), não no `build`.
> Assim builds de teste do programador não inflam o blog — só o cron publica.

> Importante: o blog **acumula** porque o `blog-auto.json` fica no volume
> persistente. Se rodar em ambiente efêmero (CI limpo a cada vez), o blog
> recomeça do lote inicial — por isso a VPS com volume é o caminho certo.

### Versionamento no Git

**Não versionar** (`.gitignore`): `public/seo-static/`, `public/sitemap.xml`,
`src/data/seo/landings.json` — regenerados a cada `npm run build`.

**Versionar** (estado editorial): `src/data/seo/blog-auto.json` (histórico do blog
automático), `blog-posts.json`, `cities.json`.

### Opcional: commitar só o histórico do blog após weekly

```bash
git add src/data/seo/blog-auto.json \
  && git commit -m "chore(blog): rodada semanal automática" \
  && git push
```

## 5. Cidades (já existente)

`cities.json` → `/seminovos-{cidade}` + `/vender-carro-{cidade}` + estático + sitemap.
Mesmo padrão; editado à mão porque o copy local é específico por cidade.

## Manutenção

- Limiares de estoque: `MIN_MARCA` / `MIN_CATEGORIA` em `generate-landings.js`.
- Ritmo do blog: `MAX_NEW_PER_RUN` e `INITIAL_BATCH` em `generate-blog.js`.
- Novas pautas de blog: adicionar função `tema*` e incluí-la em `buildPool()`.
- Tudo roda no build; para rodar só os geradores, use os scripts npm acima.
