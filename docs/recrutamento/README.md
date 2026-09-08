# Vaga de Consultor — publicação autorizada

Marcelo aprovou o deploy em 08/09/2026 e pediu o link “Trabalhe conosco” somente no rodapé do site. Data original confirmada por Marcelo: **01/09/2026**.

- Oportunidade: `https://www.netcarmultimarcas.com.br/vagas/consultor-vendas-seminovos/`.
- Candidatura: `/vagas/consultor-vendas-seminovos/candidatura/`, servida no domínio Netcar por proxy PHP.
- Envio: `/vagas/consultor-vendas-seminovos/enviar`, JSON que comporta currículo de 5 MiB.
- Backend e painel atualizados em `recruitment-form/`; preservam Cloudflare Pages e KV existentes. Ver README próprio.
- Descoberta gratuita: JobPosting com datePosted 2026-09-01, canonical, sitemap e links nos rodapés React e HTML. Sem inclusão no cabeçalho principal ou banners.
- Uma vaga presencial em Esteio; cidades dos candidatos no texto. Sem salário numérico ou prazo de inscrição inventado.

## Conteúdo aprovado

Título “Consultor”; experiência em veículos e carteira ativa obrigatórias; fixo e comissões; estoque selecionado e giro rápido; reputação, tradição e experiência no mercado; carteira de clientes da revenda.

## Operação

Deploy do site pelo fluxo existente VPS/KingHost. Formulário no Cloudflare Pages, com `ADMIN_KEY` e notificações existentes preservados. Não alterar cronograma de Instagram, AutoADS ou anúncios pagos nesta tarefa.

A URL antiga `https://netcar-rc.com.br/fabrica/?page=vaga` permanece pelo Fábrica. A nova página e seu formulário evitam esse redirecionamento ao Pages. Não houve alteração no código ou banco do Fábrica.

Ao preencher a vaga, encerrar candidaturas e retirar JobPosting e URL do sitemap. Solicitar indexação no Search Console após validar a publicação. A marcação não garante exibição no Google Vagas.

Fontes oficiais: https://developers.google.com/search/docs/appearance/structured-data/job-posting?hl=pt-br e https://developers.google.com/search/apis/indexing-api/v3/quickstart?hl=pt-br.
