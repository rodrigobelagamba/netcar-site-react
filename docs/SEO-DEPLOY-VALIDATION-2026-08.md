# Validação SEO pós-deploy — agosto/2026

## O que este deploy resolve

- HTTP 404 real para rotas inexistentes, com página útil e `noindex`.
- HTTP 410 para `cliente.php`, `clientes.php`, `ficha-cadastral.php`, `/backend/*` e legado definitivamente removido.
- 301 de `noticias.php|html` para `/blog` e `equipe.php|html` para `/sobre`.
- `title`, description, canonical e Open Graph por rota no HTML inicial de qualquer navegador.
- HTML pré-renderizado rastreável para páginas fixas, regionais, blog e veículos.
- Telefone e WhatsApp clicáveis no HTML inicial e nas páginas/rodapé.
- Eventos `phone_click`, `contact_form_submit`, `generate_lead`, `whatsapp_click`, `view_item` e avaliação de usado no `dataLayer`.
- Imagem de LCP estável no HTML inicial, com o mesmo preload/srcset responsivo
  usado pelo React; placeholders, serviços e fachadas em WebP.
- Rodapé, consultas e imagens abaixo da dobra carregados somente perto da viewport.

## Search Console após o deploy

1. Inspecionar `/`, `/seminovos`, `/seminovos-porto-alegre` e um veículo ativo; testar URL publicada e solicitar indexação somente se o HTML/canonical estiver correto.
2. Inspecionar `/noticias.php`: deve mostrar redirecionamento permanente para `/blog`.
3. Inspecionar `/backend/Netcar`, `/cliente.php?id=1` e `/ficha-cadastral.php?id=1`: devem mostrar `410 Gone`.
4. Inspecionar uma URL inventada, como `/pagina-que-nao-existe-netcar`: deve mostrar `404 Not Found` e `noindex`.
5. Reenviar `https://www.netcarmultimarcas.com.br/sitemap.xml`; não criar outro sitemap.
6. A remoção temporária do Search Console só é necessária para resultado sensível/urgente. Para o restante, 301/410 é o sinal definitivo e deve permanecer acessível ao crawler.
7. Acompanhar semanalmente “Soft 404”, “Página com redirecionamento” e “Rastreada, não indexada”. Core Web Vitals usa janela móvel de 28 dias.

## Renderização React

React continua sendo a camada de interação. O servidor agora entrega o head correto para qualquer User-Agent, reduzindo a principal divergência que existia. O conteúdo completo das páginas SEO continua pré-renderizado para crawlers enquanto filtros, estoque e formulários permanecem no app.

Ser React não é um problema por si só: o risco era depender do JavaScript para
descobrir metadados, contatos, erros e a imagem principal. Esses sinais agora
existem no HTML/HTTP antes da montagem do app.

Próxima evolução arquitetural, sem urgência de migração: gerar o mesmo corpo pré-renderizado dentro do `#root` e hidratar o React sobre ele. Só deve ser feito com teste de hidratação e CLS; trocar a arquitetura às pressas criaria mais risco que benefício.

## PageSpeed

- Rodar mobile e desktop na home e em um veículo logo após o deploy.
- Comparar LCP, INP, CLS, TTFB, bytes de imagem e JavaScript não utilizado.
- O Lighthouse de laboratório muda imediatamente. Os dados CrUX/Core Web Vitals só confirmam a melhora depois que visitas reais entrarem na janela de 28 dias.
