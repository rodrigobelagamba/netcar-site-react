# Loja WhatsApp — catálogo automático a partir da API do site

**Branch / commit:** `master` (a partir de `ea85b03`)  
**Fonte dos dados:** API JSON do site  
`https://www.netcarmultimarcas.com.br/api/v1/veiculos.php`

Não precisa copiar XML/CSV na mão. O estoque já está na API; o feed só traduz pro formato Meta Commerce.

Número Netcar já está na **Cloud API com coexistence** — não precisa migrar de novo.

---

## HANDOFF — o que o programador DEVE fazer

**Objetivo:** tirar o feed do tunnel Cloudflare temporário (`trycloudflare`) e publicar URL **fixa** no site KingHost. Sem isso, se o tunnel reiniciar a loja do WhatsApp para de atualizar.

### Por que é obrigatório

| Situação hoje | Risco |
|---|---|
| Meta puxa `*.trycloudflare.com/...` | URL muda se o serviço de tunnel reiniciar |
| Feed PHP ainda **não** está no ar em `netcarmultimarcas.com.br/feeds/` | Deploy KingHost ainda não rodou com estes arquivos |

### 1. Pull da master

```bash
git fetch origin
git checkout master
git pull origin master
```

### 2. Deploy KingHost (build + upload)

Garantir `.env.local` na raiz (ver `.env.local.example`):

```env
DEPLOY_METHOD=ssh
SSH_HOST=netcarmultimarcas.com.br
SSH_USER=netcarmultimarcas
SSH_DIR=www/
# SSH_KEY_PATH=...  ou  SSH_PASSWORD=...
```

```bash
npm run deploy:local
```

Isso roda `npm run build` (inclui `catalog:whatsapp`) e sobe `dist/` + `public/feeds/` + `.htaccess` pra KingHost.

Arquivos que **precisam** existir em produção:

- `www/feeds/whatsapp-catalog.php`
- `www/feeds/whatsapp-catalog.csv` (snapshot; o rewrite manda pro PHP)
- `www/feeds/whatsapp-catalog.xml`
- regras em `www/.htaccess` para `/feeds/whatsapp-catalog.csv` e `.xml` → PHP

### 3. Validar URL fixa (gate)

```bash
curl -sI "https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.csv" | head -20
curl -s "https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.csv" | head -n 2
```

**OK se:**
- `Content-Type: text/csv`
- 1ª linha = header `id,title,description,...`
- ~60 linhas de produtos (estoque ativo)

**Falha se:** HTML do site / 404 / SPA React.

### 4. Trocar URL do feed no Commerce Manager

1. [Commerce Manager](https://business.facebook.com/commerce) → business **Netcar**
2. Catálogo **Catalog_Products** (`840925975586000`)
3. **Fontes de dados** → feed **Netcar Seminovos WhatsApp** (`1317841283872681`)
4. **Configurações** do feed → alterar URL para:

```
https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.csv
```

5. Salvar → **Recarregar arquivo de dados** (ou esperar o ciclo horário)
6. Confirmar que **Produtos** continua ~60 e sem erro de fetch

### 5. Conferir WhatsApp (já feito; só validar)

| Item | Esperado |
|---|---|
| WABA / número | `+55 51 9729-3118` |
| Catálogo ligado | **Catalog_Products** |
| Ícone da loja | Ativado |
| Carrinho | Desativado |

Teste no celular: perfil Netcar → ícone loja → carros com preço.

### 6. Depois do deploy estável (opcional)

Na VPS `191.252.212.86`, pode desligar o tunnel temporário (só depois da URL KingHost validada no Meta):

```bash
systemctl disable --now netcar-whatsapp-catalog-tunnel
# manter o serviço Python só se ainda quiser fallback local:
# systemctl status netcar-whatsapp-catalog
```

---

## O que é automático vs o que é 1 clique

| Parte | Automático? |
|---|---|
| Ler estoque da API | Sim |
| Gerar CSV + XML no build | Sim |
| Atualizar quando carro entra/sai (endpoint PHP ao vivo) | Sim **após deploy KingHost** |
| Meta puxar o feed de hora em hora | Sim (URL correta no Commerce Manager) |
| Criar catálogo + conectar à WABA | Já feito (2026-07-09) |

## URLs

### Produção (alvo — após deploy KingHost)

```
https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.csv
https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.xml
```

### Temporário VPS (não usar como definitivo)

Serviço na VPS `191.252.212.86` (`netcar-whatsapp-catalog` + tunnel Cloudflare quick).

```
https://cir-possession-shall-various.trycloudflare.com/feeds/whatsapp-catalog.csv
http://191.252.212.86:3099/feeds/whatsapp-catalog.csv
```

**Atenção:** URL `*.trycloudflare.com` **muda** se o tunnel reiniciar. Só fallback até o passo 4 do handoff.

```bash
systemctl status netcar-whatsapp-catalog
systemctl status netcar-whatsapp-catalog-tunnel
journalctl -u netcar-whatsapp-catalog-tunnel -n 30 | grep trycloudflare
```

Código VPS: `scripts/vps/whatsapp-catalog-server.py` → `/opt/netcar-whatsapp-catalog/server.py`

## No repo

| Arquivo | Função |
|---|---|
| `public/feeds/whatsapp-catalog.php` | Feed **ao vivo** (API → CSV/XML) |
| `scripts/generate-whatsapp-catalog-feed.js` | Gera CSV/XML estáticos no build |
| `scripts/lib/whatsapp-catalog.js` | Mapeamento compartilhado |
| `public/feeds/whatsapp-catalog.csv` | Snapshot estático (fallback) |
| `public/feeds/whatsapp-catalog.xml` | Snapshot XML estático |

```bash
npm run catalog:whatsapp   # regenera CSV + XML estáticos
```

Também roda no `npm run build`. O `.htaccess` redireciona `.csv` / `.xml` pro PHP ao vivo, então em produção a URL “estática” sempre reflete o estoque atual.

## Status (feito em 2026-07-09 via browser)

| Item | Valor |
|---|---|
| Business | Netcar (`1712744040111540`) |
| Catálogo | **Catalog_Products** (`840925975586000`) |
| Feed | **Netcar Seminovos WhatsApp** (`1317841283872681`) |
| Produtos | **60** (sync horário) |
| Feed URL atual (temporário) | `https://cir-possession-shall-various.trycloudflare.com/feeds/whatsapp-catalog.csv` |
| WhatsApp | `+55 51 9729-3118` ligado a **Catalog_Products** |
| Ícone loja | **Ativado** |
| Carrinho | **Desativado** |

### Checklist residual (programador)

1. **Obrigatório:** deploy KingHost + trocar URL do feed (seção HANDOFF acima)
2. Celular: perfil Netcar → ícone loja → ver carros
3. Depois da URL KingHost ok no Meta: desligar tunnel VPS temporário

## Campos

| Coluna Meta | Origem API |
|---|---|
| `id` | `id` |
| `title` | marca + modelo + ano |
| `description` | km, motor, câmbio, combustível, cor |
| `availability` | `in stock` |
| `condition` | `used` |
| `price` | `valor` → `49900.00 BRL` |
| `link` | `/veiculo/{slug}` |
| `image_link` | capa JPG/PNG HTTPS |
| `brand` | `marca` |
| `additional_image_link` | até 9 fotos |

Vendidos (`valor <= 0`) saem do feed sozinhos no próximo fetch da Meta.

## Custo

| Ação | Meta cobra? |
|---|---|
| Catálogo + sync feed | Não |
| Cliente abre loja / manda msg | Não |
| Template marketing em massa | Sim |

## Troubleshooting

| Sintoma | Checar |
|---|---|
| URL devolve HTML do site | Deploy do PHP + `.htaccess` ainda não foi |
| Itens pendentes | Revisão Meta; imagem HTTPS em aba anônima |
| Loja sumiu | `is_catalog_visible` + catálogo ligado à WABA |
| Não conecta | Tipo deve ser **E-commerce** |

## Fora desta fase

- Push `items_batch` (precisa Catalog ID + System User token)
- Mensagens Single/Multi-Product no chat
- Catálogo Vehicles (ads Facebook)
