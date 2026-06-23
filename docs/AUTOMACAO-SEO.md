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

## 2. Blog (automático, PUBLICA sozinho)

`scripts/generate-blog.js`:
- Gera posts **completos** (título, seções h2/p/ul, CTA) parametrizados por
  dados reais do estoque (marca/categoria mais forte, faixas de preço).
- Escreve `src/data/seo/blog-auto.json` e **publica direto** — datas
  escalonadas (1 post a cada ~4 dias) para o blog parecer contínuo.
- O loader mescla `blog-posts.json` (manuais) + `blog-auto.json` (auto);
  **manuais têm prioridade** no slug (nunca sobrescreve conteúdo humano).

Posts atuais: guia da marca top, melhor categoria, "quanto custa um seminovo",
financiamento no RS, checklist de compra, troca x venda. Adicionar novo tema =
nova função em `generate-blog.js`.

**Rodar:** `npm run generate-blog`

> Nota de qualidade: os artigos usam dados reais e estrutura própria para
> "fazer sentido" e evitar texto vazio. Para subir ainda mais a qualidade,
> trocar os parágrafos por geração via LLM (mesma ideia do StackPick
> `pipeline/editorial.py`), mantendo a publicação automática.

## 3. Cidades (já existente)

`cities.json` → `/seminovos-{cidade}` + `/vender-carro-{cidade}` + estático + sitemap.
Mesmo padrão; editado à mão porque o copy local é específico por cidade.

## Manutenção

- Limiares de estoque: `MIN_MARCA` / `MIN_CATEGORIA` em `generate-landings.js`.
- Novas pautas perenes de blog: array em `generate-blog-drafts.js`.
- Tudo roda no build; para rodar só os geradores, use os scripts npm acima.
