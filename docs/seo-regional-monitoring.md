# Monitoramento de SEO regional

Este documento mede as páginas de cidade pela intenção que elas devem capturar,
sem confundir resultado de marca (`netcar`, `netcar esteio`) com descoberta local.

## Depois de cada deploy regional

1. Confirmar o processamento de `/sitemap.xml` no Search Console.
2. Inspecionar `/regioes-atendidas` e as páginas de compra e venda de Canoas,
   Sapucaia do Sul, São Leopoldo, Novo Hamburgo, Cachoeirinha, Gravataí e Porto
   Alegre.
3. Solicitar indexação apenas se o teste ao vivo mostrar canonical
   autorreferente, indexação permitida e HTML atualizado.
4. Não solicitar em massa as 36 URLs: o sitemap e os links do hub cuidam da
   descoberta das demais páginas.

## Leitura semanal no Search Console

- Período principal: últimos 28 dias contra os 28 dias anteriores.
- Separar consultas de marca (`netcar`, variações e erros de digitação) das
  consultas sem marca.
- Para cada cidade, filtrar as duas páginas e acompanhar:
  impressões sem marca, cliques, CTR, posição e consulta de entrada.
- Consultas principais de compra: `seminovos + cidade`, `carros seminovos +
cidade`, `carros usados + cidade` e variações verdadeiras encontradas no GSC.
- Consultas principais de venda: `vender carro + cidade`, `comprar meu carro +
cidade`, `avaliação de carro + cidade` e variações encontradas no GSC.
- No GA4, comparar sessões orgânicas e eventos de WhatsApp/formulário por
  `regional_city_slug`, nunca apenas visualizações de página.

## Critério aos 90 dias

- Manter e aprofundar a página que ganha impressões sem marca ou conversões.
- Revisar intenção e conteúdo quando quase todas as impressões forem de marca.
- Consolidar no hub com 301 somente a página sem procura sem marca, sem lead e
  sem utilidade local comprovada.
- Não abrir novas cidades antes desta revisão.

O Perfil da Empresa no Google influencia o mapa/local pack da cidade onde a
loja existe. As páginas regionais trabalham o resultado orgânico tradicional;
elas não devem declarar filial, endereço ou retirada fora de Esteio.
