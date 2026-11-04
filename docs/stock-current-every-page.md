# Estoque atual em todas as vitrines

Correção de 04/11/2026.

## Causa e evidência

O XML e a API concordavam em 72 IDs (65 disponíveis). O ID 20018 já não
constava em nenhum dos dois e sua ficha respondia HTTP 410. Mesmo assim,
44 páginas ainda ofereciam o veículo por R$ 156.900: 20 regionais de seminovos,
19 regionais de compra e cinco páginas de conteúdo. Os cards eram HTML do
último build. O bootstrap do navegador também era de 03/11, protegido por
cache compartilhado de até cinco minutos. Os artigos mantinham cards no JSON
editorial sem reconciliação em tempo de acesso.

## Contrato de atualização

- XML → integração/API permanece a fonte existente. Esta mudança não modifica
  ERP, XML, cadastros, equipamentos, garantias nem agendamentos.
- As vitrines consultam a API completa em cada nova resposta HTML. Usam o
  leitor paginado existente, com limite de oito segundos e recusa de respostas
  parciais, duplicadas, malformadas ou vazias sem confirmação suficiente.
- Regionais de compra/venda, conteúdo, Expointer e seleções gerais recebem
  novos IDs conforme seus filtros. Cards e ItemList usam a mesma seleção.
- Artigos preservam a seleção editorial por ID. Preço, ano, km, câmbio, foto
  e URL vêm do registro atual. Ausentes são retirados; retornos reaparecem.
  Artigos não passam a anunciar unidades sem relação com sua seleção.
- O bootstrap de home, estoque, tablet, comparações, regionais e artigos é
  atual. A URL legada `/seo/stock-bootstrap.json` passa pelo controlador vivo.
  Registros de valor zero explicitamente existentes na API permanecem no
  showroom histórico; ausência nunca cria registro vendido nem SoldOut.
- Falha da API não restaura snapshot ou banner antigo. Crawlers recebem 503
  e Retry-After; navegador pode tentar novamente. Artigos e regionais retiram
  ofertas quando a revalidação falha. Seleção vazia confirmada é distinta.
- Apache e PHP impedem cache do shell e das vitrines vivas. Assets continuam
  com sua política existente. Acesso direto aos templates SEO redireciona
  para a URL pública canônica, sem expor HTML comercial antigo.
- React revalida na entrada e a cada 60 segundos. A atualização depende de
  a integração existente tornar a mudança do XML visível na API; não há um
  segundo cron ou necessidade de republicar o site para cada veículo.

## Validação

`npm run stock:test-pages` cobre controladores reais com API simulada,
entrada/saída/reentrada, alterações, paginação, falha, cards e schemas.
PHP com cURL é obrigatório no CI. A suíte também exercita artigos, regionais
e automáticos em React. Testes de preload, tablet, comparação e banner
preservam o comportamento existente com a fonte atual.

Executar também `npm run offers:test`, `npm run stock:test-search`,
`npm run lint` e `npm run build`. Conferir em produção HTML navegador/bot,
bootstrap, cache, link direto aos templates, preços e ausência do ID retirado
em todas as páginas antes afetadas. Não confundir CI com publicação.

## Publicação e reversão

Usar o fluxo Git do projeto, integrar somente este delta sobre master e
aguardar CI. Conferir `/api/jobs` e `/api/status`; executar uma única vez
`devops-deploy.yml`, ref `master`, `deploy_social=none`, `publish_site=true`.
Esse workflow já inicia o deploy no painel; não duplicar POST.

Base verificada em 04/11 às 12:12 UTC: fonte
`a5f026be4b21b0bfe29266ef005a46bbf588188d`, artefato anterior
`eb6a9b06f1984d49ca354e4131154c622867141d`.
Reversão imediata: `/api/deploy/dist` com `{ "hash": "<artefato anterior>" }`,
acompanhar job e conferir produção. Reversão da fonte por `git revert` do
commit desta correção, preservando commits posteriores. O artefato anterior
restaura também a divergência e serve apenas como contingência.

Registrar SHA integrado, CI, job, artefato, `builtFromSource` e verificação
pública no relatório de publicação. Nenhuma alegação de que um veículo foi
vendido decorre desta correção.
