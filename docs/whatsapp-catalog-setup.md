# Loja WhatsApp — catálogo automático a partir da API do site

**Fonte dos dados:** API JSON do site  
`https://www.netcarmultimarcas.com.br/api/v1/veiculos.php`

Não precisa copiar XML/CSV na mão. O estoque já está na API; o feed só traduz pro formato Meta Commerce.

Número Netcar já está na **Cloud API com coexistence** — não precisa migrar de novo.

## O que é automático vs o que é 1 clique

| Parte | Automático? |
|---|---|
| Ler estoque da API | Sim |
| Gerar CSV + XML | Sim |
| Atualizar quando carro entra/sai (endpoint ao vivo) | Sim (após deploy do PHP) |
| Meta puxar o feed de hora em hora | Sim (depois de colar a URL 1x) |
| Criar catálogo + conectar à WABA | **1x manual** no Commerce Manager |

## URLs pra colar no Commerce Manager

### Opção A — VPS (já no ar)

Serviço na VPS `191.252.212.86` (`netcar-whatsapp-catalog` + tunnel Cloudflare).

**HTTPS atual (colar no Meta):**

```
https://cir-possession-shall-various.trycloudflare.com/feeds/whatsapp-catalog.csv
```

XML:

```
https://cir-possession-shall-various.trycloudflare.com/feeds/whatsapp-catalog.xml
```

Teste local na VPS / HTTP direto:

```
http://191.252.212.86:3099/feeds/whatsapp-catalog.csv
```

**Atenção:** URL `*.trycloudflare.com` **muda** se o serviço `netcar-whatsapp-catalog-tunnel` reiniciar.  
Pra URL fixa depois: tunnel Cloudflare nomeado ou DNS apontando pra VPS.

Comandos na VPS:

```bash
systemctl status netcar-whatsapp-catalog
systemctl status netcar-whatsapp-catalog-tunnel
journalctl -u netcar-whatsapp-catalog-tunnel -n 30 | grep trycloudflare
```

Código do serviço: `scripts/vps/whatsapp-catalog-server.py` → `/opt/netcar-whatsapp-catalog/server.py`

### Opção C — site principal (após deploy KingHost)

```
https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.csv
https://www.netcarmultimarcas.com.br/feeds/whatsapp-catalog.xml
```

Meta aceita CSV ou XML. CSV é o caminho mais simples.

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
| Feed URL | `https://cir-possession-shall-various.trycloudflare.com/feeds/whatsapp-catalog.csv` |
| WhatsApp | `+55 51 9729-3118` ligado a **Catalog_Products** |
| Ícone loja | **Ativado** |
| Carrinho | **Desativado** |

### Checklist residual

1. Celular: perfil Netcar → ícone loja → ver carros
2. Quando puder: URL fixa (tunnel Cloudflare nomeado / DNS) — `trycloudflare` muda se reiniciar
3. Opcional: deploy feed também em `netcarmultimarcas.com.br/feeds/` (KingHost)

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
