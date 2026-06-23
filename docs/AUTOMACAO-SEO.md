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

## 2. Blog (semi-automático, NÃO publica sozinho)

`scripts/generate-blog-drafts.js`:
- Combina pautas de **alta intenção de compra** com dados reais (marca/categoria
  mais forte do estoque).
- Escreve `src/data/seo/blog-drafts.json` com título, query-alvo, outline e
  parágrafo-semente.
- **Não publica.** Fluxo: revisar/expandir o rascunho → mover o post pronto para
  `blog-posts.json` (que é o que o site renderiza e indexa).

Por que não auto-publicar: post raso gerado em massa é penalizado pelo Google
(scaled content). O rascunho acelera; a qualidade final é humana (ou LLM revisado).

**Rodar:** `npm run blog:drafts`

### Evoluir para rascunho com LLM (opcional)
Trocar o `seedParagraph`/outline por chamada a uma API LLM (mesma ideia do
StackPick `pipeline/editorial.py`): gerar o texto completo do rascunho, mantendo
o gate de **revisão humana antes de publicar**.

## 3. Cidades (já existente)

`cities.json` → `/seminovos-{cidade}` + `/vender-carro-{cidade}` + estático + sitemap.
Mesmo padrão; editado à mão porque o copy local é específico por cidade.

## Manutenção

- Limiares de estoque: `MIN_MARCA` / `MIN_CATEGORIA` em `generate-landings.js`.
- Novas pautas perenes de blog: array em `generate-blog-drafts.js`.
- Tudo roda no build; para rodar só os geradores, use os scripts npm acima.
