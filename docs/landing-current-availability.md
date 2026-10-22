# Disponibilidade atual nas seleções /comprar-*

Correção de 22/10/2026. A seleção Chery mostrava quatro unidades no HTML e no
bootstrap do último build; a API já marcava uma delas como vendida. O React
atualizava os cards, mas os parágrafos mantinham preços e anos do build.

## Contrato

- O build continua gerando rotas, conteúdo editorial e templates pelo fluxo
  existente. Marcadores delimitam cards, parágrafos e FAQ; os schemas recebem
  identificadores próprios. O validador do build exige esses marcadores.
- Em cada pedido a `/comprar-*`, PHP consulta a API existente até o término
  explícito da paginação. Recusa erros, duplicatas e respostas incompletas;
  o orçamento máximo de leitura é de 8 segundos. Não usa estoque antigo como
  fallback nem mantém uma nova rotina de atualização ou cache persistente.
- Crawlers recebem cards, faixa e ItemList da mesma seleção atual. Falha de
  consulta responde 503 com Retry-After; não indica venda ou seleção vazia.
- O navegador recebe bootstrap atual com campos públicos, incluindo entradas
  posteriores ao build. Se a consulta falhar, o bootstrap antigo é omitido e
  o React carrega/tenta novamente pela API normal.
- Apache e PHP usam `Cache-Control: no-store` somente nas seleções. As outras
  políticas de cache e os cabeçalhos de segurança permanecem iguais.
- React recalcula os templates de preço/ano com os mesmos veículos dos cards.
  Falha de atualização conserva o aviso/retry existente e retira a faixa
  numérica e ItemList sem confirmação. Seleção vazia confirmada é um estado
  separado. O caminho SPA pode conservar cards previamente carregados durante
  a atualização; os textos acompanham esses cards e ficam neutros em erro.
- Fichas históricas vendidas, ERP, fonte, credenciais, dados comerciais e
  agendamentos não foram alterados. A filtragem usa disponibilidade, sem ID
  de veículo fixado no código.

## Validação

```sh
npm run stock:test-landings
NETCAR_PHP_BINARY=/caminho/php node --test scripts/tests/landing-stock-routing.test.mjs
/caminho/php scripts/tests/landing-stock.test.php
npm run offers:test
npm run stock:test-search
npm run build
```

Verificar também Apache real (as regras Header podem sobrescrever o PHP),
HTML de navegador/Googlebot, bootstrap, CollectionPage, faixa após a API e
ficha histórica vendida. No caso observado: três Chery, R$ 137.900–149.900,
anos 2023–2024; a ficha vendida conserva seu estado SoldOut.

## Publicação e reversão

Usar o fluxo autorizado do projeto: push de fonte a master, aguardar sucesso
`Deploy DevOps panel` e confirmar a versão no painel; verificar jobs ativos,
iniciar uma única execução `/api/deploy/local`, acompanhar seu ID e verificar
as respostas públicas. Não confundir sync Git com publicação do site.

Base anterior: fonte `618f62cdd3e6c21dc2291131679ade2d01aecbb2`, artefato
`2eee88189fc5669d52d6c70f4713c4c4a251bc75`. Reversão imediata pelo endpoint
`/api/deploy/dist` com esse hash, seguida de verificação pública. Para reverter
fonte, usar `git revert` do commit desta correção e o mesmo fluxo; preservar
commits posteriores, sem reset forçado. Restaurar o artefato anterior também
restaura a divergência de estoque anterior e deve ser medida de contingência.
