# Netcar — padronização da identidade digital em 13/11/2026

Repositório: `rodrigobelagamba/netcar-site-react`. Branch de preparação:
`codex/netcar-identity-nov13`, a partir de `7436be9777ae33b217f0cc9cf8037f2280474d9c`.
Este documento distingue alterações no Google, preparação local e publicação do
site. Horários de interface estão registrados como exibidos em São Paulo.

**Orientação final do usuário:** retirar **“Matriz”** como nome ou rótulo público.
A unidade do nº **740** deve ser apresentada como **Netcar Multimarcas**; o nº
**1106** pode continuar identificado como **Filial** (“filial pode deixar”). Essa
correção substitui os rótulos Matriz/Filial da primeira prévia, sem mudar endereços,
identificadores, histórico ou métricas. O nome já enviado ao Google permanece
exatamente **Netcar Multimarcas**, sem “Matriz”, e não exige outra renomeação.
Nomes de arquivos de evidência com `matriz` foram preservados como referências
históricas da coleta, não como nomes a publicar.

**Regra comercial adicional registrada:** novas ações comerciais, pedidos de
avaliação e publicações no Google devem ser direcionados ao perfil principal do
nº **740**, para concentrar seu protagonismo comercial. Os novos convites gerais
não devem apresentar um seletor de unidades. Essa orientação substitui a escolha
de unidade proposta na primeira prévia. A Filial permanece ativa, com rotas e
localização próprias; avaliações existentes mantêm seus destinos e atribuições
verdadeiros. O total observado de **897 avaliações** continua sendo das duas
unidades, sem reapresentá-lo como exclusivo do perfil principal. A regra está
registrada nos AGENTS.md do repositório e da pasta agregadora.

## A. Resultado executivo e estado da entrega

A unidade principal foi identificada no cadastro Google existente pelo endereço Av.
Presidente Vargas, 740, e por seus identificadores administrativo, CID e Place ID.
Após conferir as dependências de locais do Google Ads, foi alterado **somente o
nome** para **Netcar Multimarcas**. O primeiro retorno indicou análise pendente,
com estimativa de até dez minutos. Na conferência final autenticada, o Google
informou que a revisão estava demorando mais e que a publicação poderia levar
**até sete dias**: o nome atual ainda era Netcar Multimarcas - Loja 1 e o nome
Netcar Multimarcas permanecia pendente. A alteração foi **enviada para análise**,
sem aprovação ou publicação comprovadas; não foi reenviada. A filial do nº 1106 continua ativa, com cadastro e nome
preservados.

O site está preparado e validado localmente. O usuário aprovou expressamente a
publicação em 13/11/2026: **“Sim, pode colocar no ar”**. O fluxo de publicação
está em andamento; commit, job e resultado público serão registrados no fechamento.
As alterações incluem maior destaque editorial para a
Netcar Multimarcas do nº 740, identificação clara da Filial, novos convites de
avaliação dirigidos ao perfil principal e preservação dos links de rota e históricos
e atribuição explícita do total de avaliações às unidades. O nome institucional
já estava correto em `WebSite`, títulos e metadados gerais. Não houve migração de
domínio, recriação de contas nem alteração de campanha ou gasto.

O Search Console foi auditado na propriedade existente, com linha de base,
inspeção da home indexada e teste ao vivo da versão pública anterior ao deploy.
Facebook e Instagram já tinham nome, site e endereço institucional coerentes.
Catálogo Meta e WABA tiveram limitações de permissão para leitura administrativa;
isso não demonstra defeito nos serviços.

**Fechamento a completar pelo responsável pela execução:**

| Verificação final | Estado registrado nesta versão |
|---|---|
| Nome no GBP após processamento | **Enviado para análise; pendente do Google**, que informou até sete dias. Nome atual ainda Loja 1; proposta Netcar Multimarcas. Evidência `gbp-name-final-pending.txt/jpg`; não reenviar |
| Associações Ads após pedido de nome | Rechecadas: ambos os grupos continuam manuais com dois locais; nº 740 e nº 1106 aprovados no grupo Netcar RC. Nome Google ainda pendente, portanto nome antigo é esperado. Zero alterações Ads; `ads-group-final.txt` e `ads-groups-final.txt` |
| Commit/PR da alteração do site | Ainda não informado nesta versão |
| Aprovação e publicação do site | Aprovação específica recebida; **alterado em rascunho**, com fluxo de publicação em andamento |
| Job DevOps e verificação pública | A completar após execução do fluxo aprovado; não confundir preparação com sucesso do job |
| GSC após publicação e solicitações de indexação | Ainda não executados/registrados nesta versão |
| Google Maps público | Perfis conferidos pelos mesmos CIDs: nº 740 aberto, 4,9/534; nº 1106 ativo, 4,9/363. Principal ainda mostra Loja 1 enquanto aguarda análise; contatos, links e fotos/vídeos conferidos |

## B. Inventário antes/depois, evidência e status

| Serviço ou página | Antes | Depois / resultado preparado | Justificativa | Evidência | Status / prioridade |
|---|---|---|---|---|---|
| Perfil Google principal — nº 740 | Netcar Multimarcas - Loja 1; nº 740; perfil existente verificado | Nome enviado: **Netcar Multimarcas**; mesmos identificadores; Google informou até sete dias de revisão | Nome institucional solicitado, sem acrescentar palavras promocionais | `gbp-matriz-before.*`, `gbp-name-final-pending.txt/jpg` e confirmação autenticada | **Enviado para análise**, ainda pendente / alta |
| Perfil Google da filial | Netcar Multimarcas - Loja 2; nº 1106; perfil verificado | Cadastro, nome e operação mantidos | Filial continua aberta; não há autorização para renomeá-la ou fechá-la automaticamente | `gbp-filial-before.txt`, painel autenticado | **Auditado** / preservação |
| Google Maps público | Mesmos estabelecimentos identificados pelos CIDs existentes | Nº 740 aberto, 4,9 e 534 avaliações; nº 1106 ativo, 4,9 e 363. Telefones, site com UTM própria, WhatsApp e fotos/vídeos visíveis conferidos; nome principal ainda Loja 1 durante análise | Confirmar a apresentação real dos dois locais sem criar novo perfil ou reenviar a edição | `maps-primary-final.txt/jpg`, `maps-branch-final.txt/jpg` | **Auditado e verificado publicamente**; nome novo ainda pendente / alta |
| Google Ads — origem | Conta `4230048532`, todos os locais selecionados | Origem e vínculo preservados; nenhum filtro por nome antigo encontrado na origem inspecionada | Renomeação não deve retirar a matriz da sincronização | `ads-source-before.txt` | **Auditado** / alta |
| Google Ads — grupos | Dois grupos manuais, dois locais em cada; cinco associações observadas | Rechecagem após envio do nome: grupos LOFT e Netcar RC ainda manuais com dois locais; nº 740 e nº 1106 aprovados no grupo Netcar RC; zero edições Ads | Seleções manuais e fonte geral preservam o estabelecimento; nome Google continua pendente | Evidências iniciais Ads, `ads-group-final.txt`, `ads-groups-final.txt` | **Auditado e rechecado após pedido**, sem afirmar aprovação do novo nome / alta |
| Home e marca geral | WebSite único, titles e `og:site_name` já usam Netcar Multimarcas | Preservados, com títulos específicos por página | Manter identidade coerente sem tornar todos os títulos iguais | `public-audit.json`, HTML normal/crawler, código | **Auditado** / preservação |
| Cabeçalho, contato, sobre, rodapé e localização | Rótulos Loja 1/Loja 2; primeira prévia usou Matriz/Filial | **Netcar Multimarcas** no nº 740, em primeiro lugar e destacada no contato; **Filial** no nº 1106 com endereço, telefone e acesso próprios | Atender à correção final do usuário, retirando “Matriz” como nome/rótulo público | Diff; imagens iniciais `site-contato-desktop.jpg` e `site-contato-mobile.jpg` anteriores à correção nominal | **Alterado em rascunho** / alta |
| Rotas, páginas regionais e veículos | Alguns links buscavam o nome antigo; rótulos misturavam perfil e rota | Perfil por CID confirmado; Como chegar por endereço completo; localização do veículo preservada | Cada ação precisa levar à unidade correta | Helpers, testes de galeria/contato, QA local | **Alterado em rascunho** / alta |
| Dados estruturados locais | Matriz chamada Netcar Multimarcas - Loja 1 em React, HTML inicial, gerador e PHP | Matriz como Netcar Multimarcas; dois AutoDealer e IDs estáveis; filial preservada | Paridade entre conteúdo e representações técnicas | `schema-prepared.html`, `schema-validator-result.*`, validadores SEO | **Alterado em rascunho** / alta |
| Organization e perfis físicos | `sameAs` institucional incluía os dois Maps | `sameAs` institucional mantém redes oficiais; cada AutoDealer mantém seu `hasMap` | Separar marca comum e estabelecimentos reais; o estado anterior não era erro sintático comprovado | Diff e Schema Markup Validator | **Alterado em rascunho** / média |
| Avaliações do site | 4,9 e 897 avaliações somadas das unidades; destino global acabava na filial; primeira prévia propunha escolha de unidade | Escopo agregado e atribuição individual mantidos; novos pedidos de avaliação apontam ao perfil principal do nº 740, sem seletor | Aplicar a regra comercial final preservando a verdade sobre avaliações já existentes | `integrations-social-readonly.json`, PHP, UI e teste de atribuição | **Alterado em rascunho** / alta |
| Links para avaliar | Link global legado e links de perfil confundidos com avaliação | CTA de novo pedido usa link oficial do perfil principal; link da filial fica documentado e destinos individuais/históricos são preservados | Concentrar novos convites no principal sem inventar Place IDs nem reatribuir avaliações | `gbp-matriz-review-link.txt`, `gbp-filial-review-link.txt`, `src/social/googlePlaces.ts` | **Alterado em rascunho** / alta |
| Novas publicações e ações comerciais Google | Réplica existente contemplava as duas unidades | Regra operacional passa a direcionar novas ações ao nº 740; implementação/conferência do fluxo existente tratada separadamente | Concentrar o esforço comercial no perfil principal, preservando histórico e operação da Filial | AGENTS.md do repositório e pasta agregadora; auditoria do fluxo de posts | Regra registrada; adequação do fluxo em conferência / alta |
| Domínio, canonical e redirects | Principal HTTPS/www atual; legado redireciona caminhos por 301 | Preservados; nenhuma migração necessária demonstrada | Mudança de nome não exige mudança de endereço | `public-audit.json`, snapshots HTTP | **Auditado** / preservação |
| Sitemap e lastmod | 233 URLs válidas; gerador podia preservar data antiga de página institucional modificada | Registro de 13/11 apenas para `/`, `/sobre` e `/contato`, sem reduzir data posterior nem renovar outras URLs | Refletir alteração editorial efetiva | `page-lastmods.json`, helper compartilhado e testes | **Alterado em rascunho** / média |
| Search Console | Propriedade existente e home indexada | Linha de base e teste ao vivo registrados; sem ferramenta Mudança de endereço | Medir e conferir o site, sem confundir com priorização de perfil Maps | Arquivos `gsc-*.txt` | **Auditado** / alta |
| GSC — ações manuais e segurança | Relatórios existentes consultados | Ambos informaram **“Nenhum problema foi detectado”** | Registrar o diagnóstico real, sem inferir penalização a partir de URLs não indexadas | `gsc-manual-actions.txt`, `gsc-security-issues.txt` | **Auditado** / preservação |
| Facebook e Instagram | Netcar Multimarcas; nº 740; site atual; `@netcar_rc` | Preservados | Já coerentes com o objetivo | `integrations-meta-readonly.json` | **Auditado** / preservação |
| GA4, GTM e pixel | Propriedade e IDs existentes | Identificadores, eventos, consentimento e convenções preservados | Renomeação editorial não exige nova medição | `measurement-public.json`, código, build/validador de tracking | **Auditado** no código/público / preservação |
| WhatsApp/WABA e catálogo Meta | Número público coerente; integrações existentes documentadas | Nenhuma alteração; leitura administrativa parcialmente recusada pelas permissões do token | Não recriar integração nem interpretar falta de acesso como falha | Graph `#100` catálogo/feed e `#200` WABA em `integrations-meta-readonly.json` | **Aguardando acesso** / média |
| CarClick, estoque e feeds | Endpoints existentes e dados comerciais ativos | Preservados; amostra HTTP/XML íntegra | Não mudar IDs dos veículos, URLs de feed, contratos ou razão social | `public-audit.json` | **Auditado** / preservação |
| Diretórios secundários | Cylex associa nome antigo/nº 740 ao telefone da filial; outro diretório usa nome/domínio legados | Proposta de correção depende de painel e verificação do cadastro | Divergência pública observada não autoriza contato externo nem edição sem acesso | `external_directory_observations` no JSON público | **Aguardando acesso** / baixa |
| Merchant Center, Apple/Bing/Waze e outros | Presença administrativa não estabelecida nesta auditoria | Nenhuma conta ou cadastro novo | Auditar somente serviços efetivamente usados e acessíveis | Inventário de integrações | **Aguardando acesso**, se aplicável / baixa |

### Identificação dos dois estabelecimentos

| Campo | Netcar Multimarcas — nº 740 | Filial — nº 1106 |
|---|---|---|
| Endereço confirmado | Av. Presidente Vargas, 740, Centro, Esteio/RS | Av. Presidente Vargas, 1106, Centro, Esteio/RS |
| Telefone publicado | (51) 3473-7900 | (51) 3033-3900 |
| Identificador administrativo GBP | `11161331340741727452` | `17013442122163034193` |
| CID | `9144067949621682127` | `10839197980729051544` |
| Place ID observado no Ads | `ChIJSRolPVtvGZURzx88U1pB5n4` | `ChIJq78McFxvGZURmIl8iyKRbJY` |
| Abrir perfil | [Perfil da Netcar Multimarcas](https://maps.google.com/maps?cid=9144067949621682127) | [Perfil da Filial](https://maps.google.com/maps?cid=10839197980729051544) |
| Link oficial de avaliação documentado | [Destino dos novos convites — Netcar Multimarcas](https://g.page/r/Cc8fPFNaQeZ-EBM/review) | [Referência histórica da Filial](https://g.page/r/CZiJfIsikWyWEBM/review), sem uso nos novos convites gerais |

CID, Place ID e ID administrativo foram conferidos em suas próprias fontes e não
convertidos uns nos outros. WhatsApp compartilhado: (51) 99729-3118. O site mantém
estoque e atendimento integrados e informa que o cliente deve confirmar onde
está o veículo antes da visita. CEPs, coordenadas e horários não foram alterados
por inferência. O cadastro jurídico e as condições comerciais foram preservados.

Na conferência pública direta dos CIDs, o nº 740 continuava aberto, com telefone
(51) 3473-7900, site identificado por UTM da loja 1, WhatsApp e fotos/vídeos
visíveis; o nome ainda continha Loja 1 porque a edição permanecia em análise.
O nº 1106 continuava ativo, com telefone (51) 3033-3900, site com UTM da loja 2,
WhatsApp e fotos/vídeos visíveis. As contagens observadas eram 534 e 363 avaliações,
ambas com nota 4,9. Não houve mudança adicional no Maps nem criação de outro
perfil; Maps e GBP representam os mesmos cadastros existentes.

### Conferência de dependências do Google Ads

A origem seleciona todos os locais. O vínculo existente foi observado desde
28/07/2022. Os grupos `7128994256` (**[LOFT] NETCAR - Display_campaign**) e
`7129203003` (**Netcar RC - Lojas 1 e 2**) são manuais e continham dois locais cada.
Nomes administrativos dos grupos foram mantidos.

As cinco associações ativadas observadas foram: origem geral no nível da conta;
origem geral na campanha **[Voren] NETCAR - P.Max** (`16513569585`); grupo LOFT
na campanha **[LOFT] NETCAR - Display** (`672976983`); grupo das duas lojas na
P.Max; e esse mesmo grupo em **[Voren] Netcar teste local** (`23928310983`). A
listagem mostrada não registrou associação adicional no nível de grupo de anúncios;
isso descreve a evidência exibida, sem afirmar ausência absoluta fora da visão.

O acesso Google inicial exigiu ativação de verificação em duas etapas. Uma conta
alternativa autorizada pelo usuário permitiu a leitura. Não se alterou autenticação,
permissão, origem, grupo, associação, orçamento, lance, segmentação ou objetivo.

Após o envio da alteração de nome, os dois grupos continuavam manuais com dois
locais. No grupo Netcar RC, os nºs 740 e 1106 estavam aprovados. Essa rechecagem
confirma continuidade após o pedido, enquanto o nome ainda aguardava análise;
não certifica um estado posterior à aprovação do nome pelo Google.

## C. Arquivos, configurações e integrações alterados

A implementação detalhada e os comandos de validação estão em
[site-implementation.md](./site-implementation.md). Esta versão ainda não associa
um commit de publicação ao trabalho; o campo de fechamento deve receber o commit
real, PR e job somente após a execução e conferência.

| Conjunto | Arquivos principais | Resultado |
|---|---|---|
| Marca técnica | `index.html`, `src/components/seo/SchemaOrg.tsx`, `scripts/generate-seo-assets.js`, `public/seo/helpers.php` | Nome da matriz e relações entre marca/unidades coerentes nos caminhos de renderização |
| Apresentação institucional | Header, Footer, Localizacao, ContatoPage, SobrePage, storeGallery, HomeSelectionPromise, ComoSelecionamosPage, RegionalVisitPlanner | Rótulos finais Netcar Multimarcas/Filial, destaque editorial do nº 740 e continuidade do nº 1106; retirar “Matriz” da apresentação pública |
| Perfil, rota e avaliação | `src/lib/formatters.ts`, `src/social/googlePlaces.ts` | Novos pedidos de avaliação para o principal; perfis/rotas específicos e IDs técnicos preservados |
| Avaliações visíveis | `src/social/types.ts`, ReviewsSummaryHeader, GoogleRatingBadge, NetcarGoogleReviewsSection, ReviewDetailModal, ReviewPhotoLightbox, GoogleReviewsHighlight, RegionalTrustSignals | Escopo conjunto e atribuição individual explícitos; CTA para o principal sem escolha de unidade |
| API de avaliações | `docs/social/lib/GoogleReviewsClient.php`, `docs/social/google-reviews.php` | Summary geral sempre aponta ao CID e link oficial do principal, inclusive com cache/configuração antiga; `units`, contagens e destinos históricos individuais das duas lojas preservados |
| Datas significativas | `src/data/seo/page-lastmods.json`, `scripts/lib/page-lastmod.js`, `scripts/generate-sitemap.js` e gerador SEO | Lastmod apenas das três páginas institucionais modificadas |
| Verificação | Testes de galeria, header, CTA de avaliação, confiança regional, lastmod, `GoogleReviewsAttributionTest.php`; validadores SEO e contato | Conferir destino principal dos novos convites, preservação da atribuição histórica e datas |
| Google Business Profile | Campo nome do perfil administrativo da matriz | Única alteração cadastral externa desta tarefa até esta versão |

IDs preservados: GA4 `G-MGPNBDNQ9G`, propriedade documentada `312862966`; GTM
`GTM-M8MZRTL9`; conversão pública Google `AW-990807847`; Meta pixel
`367657940934075`; Facebook `133367103393243`; Instagram `17841402339444396`.
Catálogo `840925975586000` e feed `1317841283872681` permanecem os existentes,
sem recriação. Nomes administrativos antigos não foram confundidos com marca pública.

As marcações `loja1`, `loja2`, `Loja1`, `Loja2`, `loja-1`, `loja-2`, `loja_1` e
`loja_2` permanecem nos contratos de código, fragmentos, schema e eventos. Antes
da nova regra comercial, a réplica Instagram → GBP usava os dois IDs administrativos
e UTMs por unidade em `utm_content=ig_<id>_loja_1|loja_2`. O histórico permanece
intacto; as novas publicações devem ter apenas o perfil principal como destino,
conforme a regra registrada e a adequação do fluxo existente. Não foram colocadas UTMs em links internos ou
canônicos. URLs oficiais contendo `NetcarRC` foram preservadas.

## D. Validação, evidências e procedimento de retorno

### Validação já concluída

- Build final com `NETCAR_SKIP_PHOTO_BUILD=1`, TypeScript e lint aprovados,
  incluindo estoque, garantia, vídeos, contatos, catálogo e medição existentes.
  Os avisos anteriores de tamanho de chunks não impediram a compilação.
- Na primeira versão, 26 testes de galeria, 11 de escolha/atribuição regional/lastmod
  e cinco de header foram aprovados; `git diff --check` aprovado. Os testes finais
  devem refletir o CTA de avaliação para o principal, que substitui o seletor.
- PHP: lint dos arquivos afetados e teste de atribuição aprovados em 7.4.33 e
  8.5.12, sem warnings nos resultados, usando runtime temporário. Evidência:
  `php-validation.json`.
- Após a regra de destino principal, o teste de avaliações passou novamente em
  PHP 7.4 e 8.5: configuração antiga apontando à filial, cache legado, backup
  desatualizado e fallback sem resumo produzem somente os links principais no
  summary. Contagens/nota agregadas, metadados das unidades e `reviewUrl`
  individuais permanecem intactos. Evidência: `php-review-primary-validation.json`.
- Schema Markup Validator na versão preparada: **zero erros e zero avisos**.
  Isso verifica a marcação, sem garantir nome exibido, ranking ou estrelas.
- QA local inicial de desktop/celular conferiu marca, destaque do nº 740, filial
  acessível, contatos e a primeira proposta de escolha da unidade para avaliação.
  A conferência final deve refletir Netcar Multimarcas/Filial e novos pedidos de
  avaliação para o principal, sem seletor de unidades.
- Conferência das fotos: **nenhum arquivo de imagem foi removido**. Foram
  verificadas **nove fotos da unidade do nº 740 e cinco fotos da Filial do nº
  1106**. A mudança de nome/rótulo preserva esses ativos reais e suas galerias.
- Produção antes do deploy: home e sete variantes não canônicas conferidas;
  variantes redirecionam por **301**, em um salto, para HTTPS/www atual.
  Legado preserva caminhos internos de contato, sobre, estoque, blog e veículo,
  incluindo UTMs e filtro `marca=Jeep`; amostras chegam a HTTP 200.
- Sitemap público válido com 233 URLs, sem duplicatas, host incorreto ou query;
  robots permite páginas públicas na amostra. Canonicals excluem UTMs.
  Estoque e dois veículos respondem 200 com títulos/canônicos específicos.
  CarClick e WhatsApp XML válidos e 200, WhatsApp com 68 itens na coleta.
- Home no GSC: indexada, último rastreamento exibido em **13/11/2026 11:46:58**,
  Googlebot Smartphone, canonical inspecionado. Teste ao vivo às **14:07**
  informou disponibilidade para o Google. O sitemap registrado foi lido em
  12/11 com 231 URLs, enquanto a amostra pública atual tem 233; não se tratou
  essa diferença temporal como falha confirmada.
- Os relatórios GSC de **Ações manuais** e **Problemas de segurança** informaram
  **“Nenhum problema foi detectado”**, conforme `gsc-manual-actions.txt` e
  `gsc-security-issues.txt`.
- `/contato` também estava indexada antes do deploy, com canonical declarado
  correspondente à URL inspecionada selecionada pelo Google, rastreamento
  permitido, busca bem-sucedida e indexação permitida. Último crawl exibido:
  **05/11/2026 05:06:25**, Googlebot Smartphone. O campo Sitemaps dessa inspeção
  mostrou **“Erro temporário de processamento”**, embora a visão global do
  sitemap já estivesse íntegra. Trata-se de limite pontual da inspeção anterior,
  não de falha de deploy demonstrada. Evidência: `gsc-contato-before.txt`.

A inspeção GSC acima é da produção anterior à mudança do site. A prévia local,
o build e o Schema Markup Validator não substituem a futura conferência pública.
Não foi usado o Rich Results Test para validar o nome `WebSite`; esse recurso
não é verificado por esse teste. Esta versão não registra um novo resultado do
Rich Results Test nem pedido de indexação posterior à publicação.

### Evidências

Os arquivos brutos permanecem no diretório local
`output/identity-2026-11-13/` da pasta agregadora Netcar Site, fora do código
publicado. Este relatório não replica credenciais, e-mails de clientes, cookies
nem os textos pessoais das avaliações.

| Frente | Evidências principais |
|---|---|
| HTTP, domínios, schema e feeds | `public-audit.json`, `public-audit.md`, snapshots `crawler-*.html` e HTML por domínio/caminho |
| Integrações | `integrations-audit.md`, `integrations-meta-readonly.json`, `integrations-social-readonly.json`, `measurement-public.json` |
| GBP antes, nome e avaliação | `gbp-matriz-before.*`, `gbp-matriz-pending.*`, `gbp-name-final-pending.txt/jpg`, `gbp-filial-before.txt`, `gbp-*-review-link.txt` |
| Maps público por CID | `maps-primary-final.txt/jpg`, `maps-branch-final.txt/jpg` |
| Ads | `ads-source-before.txt`, `ads-location-groups-before.txt`, `ads-manual-group-before.txt`, `ads-location-associations-before.txt`, `ads-group-final.txt`, `ads-groups-final.txt` |
| GSC | `gsc-performance-3months.*`, `gsc-brand-3months.txt`, `gsc-nonbrand-3months.txt`, `gsc-home-indexed-before.txt`, `gsc-home-live-before.txt`, `gsc-contato-before.txt`, `gsc-sitemap-before.txt` |
| Cobertura do índice | `gsc-indexing-before.txt` |
| Ações manuais e segurança | `gsc-manual-actions.txt`, `gsc-security-issues.txt` |
| Métricas GBP | `gbp-matriz-*-aug-oct.txt`, `gbp-filial-*-aug-oct.txt` |
| Validação local | `php-validation.json`, `php-review-primary-validation.json`, `schema-validator-result.*`, `site-contato-desktop.jpg`, `site-contato-mobile.jpg`, `site-reviews-choice-desktop.jpg` (prévia inicial) |

### Publicação e retorno

A aprovação específica prevista no AGENTS.md foi recebida em 13/11/2026. O fluxo
autorizado deve levar somente este escopo para master, aguardar o workflow DevOps,
conferir o commit e ausência de tarefas ativas em `/api/status`, iniciar um único
job `/api/deploy/local`, acompanhar seu ID e verificar site público e status final.
Sucesso de build ou GitHub isoladamente não certifica publicação.

Antes do deploy, reverter consiste em retirar apenas o diff desta branch, sem
afetar outras tarefas. Depois, reverter o commit aprovado pelo mesmo fluxo de
publicação, preservando alterações posteriores. Não apagar caches, OAuth ou contas.
Os campos adicionais de resumo são compatíveis com o cache anterior; `units` será
preenchido no próximo sync existente. Não executar `sync-social.php` só como teste
de avaliações: o mesmo runner pode publicar posts do fluxo Instagram → GBP.

Reversão de código não reverte automaticamente o nome do Google, análise da
plataforma, rastreamento ou indexação. Uma eventual reversão do nome deve editar o
mesmo cadastro existente, sem recriar perfil nem mexer na filial.

## E. Pendências objetivas, linha de base e acompanhamento

1. **Processamento do GBP:** o Google manteve a proposta pendente e informou até
   sete dias. Aguardar processamento sem reenviar; depois verificar o mesmo CID
   e registrar aprovação/visibilidade somente quando comprovadas.
2. **Ads após processamento do nome:** a rechecagem após o pedido já confirmou
   grupos com dois locais e ambos aprovados. Após eventual aprovação do novo nome,
   confirmar sua atualização no Ads, sem recriar associações nem remover a Filial.
3. **Site:** concluir o deploy expressamente aprovado da versão já preparada e
   testada, registrando commit, job e verificação pública real.
4. **GSC após deploy:** inspecionar home, sobre e contato modificados, comparar
   versão indexada/teste ao vivo e solicitar indexação dessas poucas URLs quando
   cabível; registrar cada pedido sem afirmar processamento concluído.
5. **Catálogo e WABA:** usar uma sessão administrativa existente com permissão de
   leitura para confirmar configuração/nome; não ampliar permissões, recriar
   integração ou trocar número automaticamente.
6. **Diretórios:** confirmar acesso ao cadastro e a divergência específica antes
   de corrigir; nenhum contato externo foi enviado. Outros serviços só entram
   na revisão se sua presença real e acesso forem confirmados.
7. **Novas publicações Google:** adequação do fluxo existente para apenas o perfil
   principal em implementação; registrar diff, testes e configuração final antes
   da ativação. Nenhum sync foi acionado para testar essa mudança. O responsável
   pela execução completará o resultado final nesta documentação.

### Linha de base do Search Console

Propriedade `sc-domain:netcarmultimarcas.com.br`, Pesquisa Web,
**11/08–10/11/2026** conforme período exibido. Não confundir posição média do site
com posição de uma loja no Maps.

| Recorte | Cliques | Impressões | CTR | Posição média |
|---|---:|---:|---:|---:|
| Total da propriedade | 1.821 | 66.229 | 2,7% | 8,3 |
| Consultas correspondentes à regex de marca | 948 | 5.094 | 18,6% | 3,2 |
| Demais consultas visíveis que não correspondem à regex | 235 | 22.553 | 1,0% | 10,3 |

Regex utilizada: `(?i)net[ -]*car|rc ve[ií]culos esteio`. O último recorte **não é
estritamente genérico**: pode conter variações de marca, como `nectar` e
`rcveiculos`, não capturadas pelo filtro. A soma dos recortes de consultas não
iguala o total da propriedade porque há consultas omitidas/anonimizadas e
limitações de agregação. Não converter o resíduo em demanda genérica estimada.

### Cobertura do índice observada no GSC

A tela registrou **237 páginas indexadas** e **2.407 não indexadas**, distribuídas
em dez motivos. Esses números incluem URLs históricas e exclusões intencionais;
não representam 2.407 defeitos atuais do site.

| Motivo exibido | URLs |
|---|---:|
| Página com redirecionamento | 1.149 |
| Excluída por noindex | 279 |
| Não encontrado (404) | 234 |
| Bloqueada por robots.txt | 76 |
| Cópia sem canonical selecionado pelo usuário | 19 |
| Alternativa com canonical adequado | 3 |
| Outro problema 4xx | 1 |
| Rastreada, mas não indexada | 624 |
| Detectada, mas não indexada | 9 |
| Erro de redirecionamento, validação exibida como aprovada | 13 |

A renomeação não autoriza remover redirecionamentos, noindex ou bloqueios
intencionais em massa. Eventuais URLs problemáticas exigem diagnóstico por URL,
com confronto entre histórico e resposta atual; esse saneamento geral permanece
fora do escopo desta mudança de identidade. As páginas institucionais alteradas
e amostras comerciais foram verificadas separadamente.

### Linha de base dos Perfis da Empresa

Período **agosto–outubro/2026**, 92 dias. Valores conforme telas específicas de
desempenho, chamadas, rotas e site, sem supor que todos os indicadores tenham
composição ou deduplicação idênticas.

| Métrica exibida | Unidade nº 740 — Netcar Multimarcas | Unidade nº 1106 — Filial |
|---|---:|---:|
| Interações | 442 | 209 |
| Visualizações do perfil | 9.399 | 6.309 |
| Pesquisas que exibiram o perfil | 2.872 | 2.181 |
| Cliques para ligar | 10 | 9 |
| Solicitações de rota | 248 | 139 |
| Cliques para o site | 170 | 55 |

Visualizações não foram somadas como pessoas únicas entre perfis. Cliques para
ligar não comprovam ligações atendidas; rotas não comprovam visitas; cliques para
site não comprovam leads ou vendas. Esta auditoria não atribuiu contatos
qualificados, visitas ou vendas sem dados de CRM correspondentes.

### Proposta de comparação em 30, 60 e 90 dias

Usar a data efetiva de aplicação/publicação como marco de cada frente. Se o marco
for 13/11/2026, revisões sugeridas: **13/12/2026, 12/01/2027 e 11/02/2027**.
São propostas, não automações criadas.

| Janela | Comparação proposta | Cuidado de interpretação |
|---|---|---|
| 30 dias | Confirmar nome público, links, indexação das páginas, continuidade dos grupos Ads e primeiras tendências de cliques/rotas | Separar atraso de processamento e redistribuição entre unidades de crescimento total |
| 60 dias | Comparar marca, consultas fora da regex, tráfego por `utm_content`, avanço para estoque e contatos efetivamente recebidos | Manter filtros e períodos comparáveis; registrar campanhas, feriados e mudanças de estoque |
| 90 dias | Avaliar matriz, filial e total nas métricas aditivas apropriadas, qualidade de contatos, visitas/vendas verificadas e clareza/tempo de atendimento | Não somar públicos como pessoas únicas nem atribuir causalidade à renomeação isolada |

O sucesso deve incluir clareza e continuidade da operação. Crescimento da matriz
acompanhado de queda equivalente da filial pode representar redistribuição.
Nenhum ganho de ranking, estrelas ou prazo de indexação foi prometido.

## F. O que estava correto e foi preservado

- Nome institucional **Netcar Multimarcas**, logotipos, fotos reais, identidade
  visual, conteúdos comerciais úteis, procedência, preparação e Nethelp.
  Nenhum arquivo de imagem removido; conferidas nove fotos do nº 740 e cinco do
  nº 1106. “Matriz” deixa de ser rótulo público; “Filial” permanece por orientação
  expressa do usuário.
- Duas unidades reais em Esteio, seus endereços/contatos separados, estoque e
  atendimento integrados; filial ativa, sem ocultação, fusão ou fechamento.
- Histórico e identificadores dos perfis, avaliações legítimas e atribuição dos
  clientes. Nenhuma avaliação foi criada, transferida ou atribuída a veículo.
- Organização e estabelecimentos locais distintos, `parentOrganization` existente,
  `@id` estáveis, legalName separado e condições comerciais/jurídicas intactas.
- Domínio principal, redirects 301 do legado, slugs funcionais, canonical,
  robots, sitemap e propriedade Search Console; sem migração fictícia ou remoção
  de URLs da filial.
- Contas, permissões, integrações, OAuth, GA4/GTM, eventos, conversões, pixel,
  catálogo, número WhatsApp, coexistência, webhooks e fornecedores existentes.
- Contas/anúncios e grupos Ads, inclusive nomes administrativos históricos;
  `@netcar_rc`, URLs contendo `NetcarRC` e marcadores técnicos por loja.
- Alterações alheias: trabalho em clone isolado da master atual; snapshots de
  estoque/blog/autocheck gerados pelo build e fora do escopo retirados do diff.
- Nenhuma campanha iniciada, gasto modificado, assinatura criada, mensagem a
  cliente/terceiro enviada ou automação recorrente criada nesta tarefa.

### Fontes oficiais que orientaram as decisões

Observações do site e dos painéis acima são evidências da execução; os documentos
abaixo explicam as regras e limites, sem prometer resultado comercial:

- [Nomes e representação no Perfil da Empresa](https://support.google.com/business/answer/3038177?hl=pt-BR).
- [Grupos de locais no Google Ads](https://support.google.com/google-ads/answer/9288588).
- [Nomes de site e WebSite](https://developers.google.com/search/docs/appearance/site-names?hl=pt-br).
- [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business), [AutoDealer](https://schema.org/AutoDealer) e [parentOrganization](https://schema.org/parentOrganization).
- [Avaliações da própria empresa e resultados orgânicos](https://developers.google.com/search/docs/appearance/structured-data/review-snippet).
- [Canonicalização](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) e [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [Inspeção de URL](https://support.google.com/webmasters/answer/9012289) e [Mudança de endereço](https://support.google.com/webmasters/answer/9370220).
- [Metadata dos perfis: mapsUri e newReviewUri](https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations#Metadata).
- [Desempenho do Perfil da Empresa](https://support.google.com/business/answer/9918094) e [parâmetros de campanha](https://support.google.com/analytics/answer/10917952).
