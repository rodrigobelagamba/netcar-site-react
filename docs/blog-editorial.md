# Guia editorial — Blog Netcar Multimarcas

Guia para geração de artigos do blog (humana ou por agente). O blog existe para atrair busca orgânica de quem quer **comprar** ou **vender** seminovo na Grande Porto Alegre, Vale dos Sinos, Vale do Caí e Serra Gaúcha e converter primeiro pelo site, depois por WhatsApp/visita.

## Onde os artigos moram

- Conteúdo: `src/data/seo/blog-posts.json` (array de `BlogPost`)
- Backlog de pautas: `src/data/seo/blog-topics.json`
- Tipos: `src/data/seo/types.ts`
- Render: `src/modules/blog/components/BlogArticleBody.tsx`
- O build (`npm run build`) regenera `public/sitemap.xml` e os HTML estáticos de `public/seo-static/` automaticamente via `scripts/generate-seo-assets.js`.

## Processo para publicar um artigo novo

1. Pegar a primeira pauta com `"status": "pendente"` em `blog-topics.json`.
2. Escrever o artigo seguindo as regras abaixo.
3. Adicionar o objeto ao FINAL do array em `blog-posts.json`.
4. Marcar a pauta como `"status": "publicado"` em `blog-topics.json`.
5. Validar: `npm ci && npm run build` deve passar sem erro.
6. Commit + push em branch `blog/<slug>` e abrir PR para `master`.
7. NUNCA fazer deploy. Deploy é manual após merge do PR.

## Schema do artigo (obrigatório)

```json
{
  "slug": "kebab-case-igual-ao-topico",
  "title": "Até 60 caracteres, keyword no início",
  "description": "120 a 155 caracteres. Resume o artigo e cita região quando natural.",
  "publishedAt": "AAAA-MM-DD (data do dia)",
  "readMinutes": 5,
  "sections": [
    { "type": "p", "text": "..." },
    { "type": "h2", "text": "..." },
    { "type": "ul", "items": ["...", "..."] },
    { "type": "ol", "items": ["...", "..."] }
  ],
  "ctaLabel": "Texto do botão",
  "ctaHref": "/seminovos"
}
```

- Tipos de seção permitidos: `p`, `h2`, `ul`, `ol`. Nada de HTML, markdown ou links dentro do texto.
- `ctaHref` permitidos: `/seminovos`, `/compra`, `/financiamento-sem-entrada`, `/seminovos-automaticos`, `/contato`.
- Intent `compra` → CTA `/seminovos`. Intent `venda` → CTA `/compra`. Intent `financiamento` → CTA `/financiamento-sem-entrada`.
- CTA deve apontar primeiro para página do próprio site. WhatsApp entra depois, na página de destino; não usar link externo como CTA principal.

## Estrutura recomendada

- 600 a 900 palavras (`readMinutes` 4–7).
- Abertura: 1–2 parágrafos respondendo direto a dúvida da busca.
- 3 a 5 blocos `h2` com parágrafos curtos e listas.
- Fechamento: parágrafo conectando com a Netcar sem forçar venda.

## Voz e estilo

- Consultor experiente de loja, não vendedor agressivo nem robô.
- Frases curtas. Português do RS, sem regionalismo caricato.
- PROIBIDO clichê de IA: "Em um mundo cada vez mais...", "Nesse sentido...", "É importante ressaltar...", "Vale lembrar que...", emojis, exclamações em sequência.
- Falar de valores em faixas realistas (ex: "na faixa de R$ 70 a 90 mil"), nunca preço exato de modelo específico.
- Citar Grande POA / região metropolitana / Esteio quando natural — é SEO local.

## Conteúdo regional sem doorway page

Cidade ou região precisa mudar a utilidade do artigo, não só título e topônimo. Artigo regional deve ter pelo menos **dois elementos próprios**:

- conjunto coerente de cidades e contexto de deslocamento, uso ou mercado;
- roteiro remoto antes da visita;
- seleção derivada do estoque real naquele momento;
- checklist específico por uso regional (cidade, estrada, trabalho, família);
- orientação verificável sobre avaliação, troca, documentos ou confiança;
- ativo reaproveitável: checklist, roteiro, FAQ, comparação ou série social.

Regras anti-thin:

- Não gerar um artigo por cidade trocando apenas nome, distância e introdução.
- Agrupar cidades por região/intenção quando resposta for igual.
- Não copiar texto das páginas de cidade. Blog aprofunda dúvida; página local atende navegação local.
- Não afirmar volume de clientes, preferência regional, prazo de viagem ou demanda sem fonte.
- Não criar história de cliente, depoimento, nota, rating ou resultado de negociação.
- Não usar cidade sem relação editorial real. Se conteúdo funciona igual no país inteiro, cidade não pertence ao título.
- Cada artigo regional precisa ter uma keyword principal e uma intenção. Variações de cidades entram no texto com naturalidade, sem listas repetitivas.
- Se duas pautas respondem mesma dúvida, consolidar na mais forte e redirecionar editorialmente; não publicar ambas.

## Estoque real e conteúdo automático

- Cards de veículos só podem vir da API oficial usada por `scripts/generate-blog.js`.
- URL de veículo deve apontar para domínio/site da Netcar.
- Disponibilidade, preço, km, ano e versão são dados voláteis: atualizar na geração e orientar confirmação no estoque.
- Nunca escrever “temos”, “disponível hoje” ou preço exato fora de bloco abastecido pela API atual.
- Sem resposta válida da API, manter arquivo existente; não fabricar fallback editorial com veículos fictícios.
- Artigo manual pode explicar como consultar estoque, mas não deve fixar modelo/preço como disponível.
- Formato regional automático deve agrupar cidades relacionadas, entregar roteiro/checklist próprio e usar no máximo poucos cards relevantes. Região não vira multiplicador de páginas.

## Fatos da Netcar (usar somente estes — NÃO inventar)

- Netcar Multimarcas, em Esteio/RS, desde 1997.
- Duas unidades na Av. Presidente Vargas (matriz e filial), acesso pela BR-116.
- Estoque multimarcas: hatch, sedan, SUV e picape.
- Veículos passam pela "Fábrica de Valor" (processo próprio de preparação) antes da vitrine.
- Pós-venda com NetHelp.
- Financiamento em até 60x; aceita troca inclusive com financiamento em aberto.
- Compra usados: nacionais até 7 anos, origem RS, sem passagem por leilão.
- Atendimento pelo iAN (assistente virtual) no WhatsApp.
- NÃO prometer: entrega em domicílio, garantia específica em meses, taxa de juros, aprovação garantida.
- NÃO inventar: prazo de pagamento/entrega/avaliação, taxa, entrada, parcela, rating, volume de clientes, depoimento ou caso de sucesso.
- Condição financeira ou comercial só entra quando validada em fonte oficial vigente e deve trazer ressalva aplicável. Na dúvida, remover número.

## SEO

- Keyword da pauta no `title`, na `description` e no primeiro parágrafo.
- `slug` deve ser exatamente o da pauta em `blog-topics.json`.
- Um artigo por vez. Qualidade > volume.
- Não repetir tema já existente em `blog-posts.json` (conferir antes).
- Para pauta regional, preencher `region`, `cities` e `asset` em `blog-topics.json`.
- Antes de publicar: pesquisar duplicidade por intenção, validar fatos voláteis, abrir todos CTAs internos e conferir se artigo não depende da página de cidade para fazer sentido.
