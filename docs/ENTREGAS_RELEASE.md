# Entregas — publicação e operação

Página pública: https://www.netcarmultimarcas.com.br/entregas

Publicação autorizada pelo usuário e ativada em 21/09/2026 às **11:19:23 BRT**
(14:19:23 UTC). Item **Entregas** incluído no menu desktop, menu mobile e rodapé.
O acervo inicial contém **1.447 fotos**, com filtros de mês/ano, 24 fotos por lote,
links individuais e álbum da data mais recente à mais antiga. Os destaques do
topo têm curadoria e legendas comerciais: “Histórias reais”, “Mais uma conquista”
e “Sonho realizado”.

## Automação ativada

O bot de Stories foi atualizado às 11:05:51 BRT e sua configuração privada foi
habilitada depois da verificação do endpoint web. Fluxo em produção:

1. Gerar e aprovar o card de **Entrega / Carro vendido** no fluxo existente.
2. Usar a opção de publicação pelo robô no Instagram.
3. Depois de receber a confirmação do Instagram, o robô guarda uma cópia do
   **card final com template** na fila persistente e envia ao site.
4. O site gera as variantes WebP e acrescenta a foto ao feed. A página incorpora
   novas publicações sem novo build. A fila repete somente o envio ao site em
   caso de falha; IDs estáveis e hashes evitam duplicação nas novas tentativas.

Enviar uma imagem avulsa ao WhatsApp, postar diretamente no aplicativo Instagram
ou usar a opção 2 de preparação para postagem manual não confirma uma publicação
pelo robô e **não aciona essa integração**. A importação do histórico dos destaques
foi pontual. Não há leitura contínua de todos os grupos ou pastas de destaques.

Configuração do site fora do webroot, modo 0600:
`/home/netcarmultimarcas/.netcar-entregas-config.php`.
Configuração do bot no volume persistente, modo 0600:
`/data/netcar/delivery_gallery_config.json`.
Nenhum token deve entrar no JavaScript, Git, logs ou documentação.
Contrato, limites e manutenção em [ENTREGAS_AUTOMATION_BACKEND.md](ENTREGAS_AUTOMATION_BACKEND.md).

## Verificação em produção

- Página principal: HTTP 200, HTML inicial com 24 fotos, metadados e canonical.
- `/entregas` e `/entregas/` respondem diretamente 200, com canonical único sem
  barra. A regra local foi validada em Apache isoladamente e depois em produção,
  mantendo feed, autenticação e bloqueio dos arquivos internos.
- Página 2: HTTP 200, 24 fotos e canonical próprio; página 61: sete fotos.
- Página fora do intervalo: HTTP 404; sitemap inclui a galeria.
- Feed público: HTTP 200. No momento da ativação não havia novos cards ao vivo.
- Status sem token: HTTP 401. Status autenticado: HTTP 200, `ready=true`,
  GD/WebP habilitado, escrita disponível, upload 12 MiB, POST 13 MiB.
- O mesmo status foi consultado de dentro do container do bot, com TLS e
  autenticação válidos: HTTP 200, `ready=true`.
- Bot ativo, configuração habilitada, zero itens pendentes, enviados ou inválidos
  na fila inicial. Nenhuma postagem ou mensagem artificial foi enviada no teste.
- Navegador público em desktop e 390 × 844: menu, legendas, imagem integral do
  destaque, 24 → 48 fotos ao carregar mais, sem imagens carregadas quebradas ou
  rolagem horizontal. A primeira publicação real futura ainda não ocorreu durante
  esta verificação; o envio e as repetições foram exercitados em testes isolados.

Antes da ativação passaram build/TypeScript, ESLint do módulo, seis testes da
biblioteca da galeria, cinco do importador, 46 verificações PHP com GD/WebP e cinco
verificações de endpoints isolados. O bot passou 326 verificações de smoke e 20
testes da integração, sem chamadas externas nos testes. O pacote remoto teve seus
5.050 arquivos conferidos por hash antes da ativação.

## Release e recuperação

Release: `20260921-entregas-141245-585beb6d`.
SHA-256 do pacote:
`585beb6dcb81fada5071781301fb2e8042867bb7d3694e0be7080fa955f1c163`.

Diretório privado de release e backup no servidor do site:
`/home/netcarmultimarcas/.netcar-entregas-releases/20260921-entregas-141245-585beb6d`.
Contém `activated.json`, `stage.json`, `manage.php` e `backup/manifest.json` com
os arquivos anteriores. A ativação preservou dados ao vivo e configurações.
O rollback confere se os arquivos ainda pertencem à release antes de restaurar;
não deve sobrescrever uma implantação posterior.

Às 11:30:31 BRT foi aplicado um ajuste separado de roteamento, limitado ao novo
`public/entregas/.htaccess`, também copiado em `dist`. Ele permite que o Apache
sirva a página sem acrescentar barra por causa da pasta física dos endpoints.
As duas formas respondem 200 para não inverter redirecionamentos antigos em cache.
SHA-256 do arquivo:
`e8f3a2db2f917db4029557945c05faeb71a74b1fe19b07fef5404f8675f53cb9`.
Backup/manifesto:
`/home/netcarmultimarcas/.netcar-entregas-backups/routing-20260921-143031-dfb8a5`.
Para rollback completo, remover primeiro esse arquivo filho **somente se ainda
tiver esse SHA**, pois ele não existia antes; em seguida restaurar a release
principal. Manter esse `.htaccess` nos próximos pacotes de publicação.

Backup do bot no VPS:
`/opt/stories-bot/.deploy-backups/entregas-20260921T140505Z/`.
O utilitário `rollback-runtime.py` desse diretório exige ausência de trabalhos
ativos e preserva a fila e a configuração. O container foi reiniciado após
conferir fila e aprovações vazias; não houve recriação do container.

**Em futuros deploys, preservar `entregas-data/live.json`,
`entregas-media/live/`, a fila do bot e as duas configurações privadas.** Fazer
backup conjunto de índice e mídia ao vivo. O seed do acervo é um artefato de
build separado dos novos cards publicados.

Esta publicação habilita rastreamento e indexação; não comprova que o Google já
indexou a página nem representa promessa de posição ou vendas adicionais.

## Revisão visual — 21/09/2026, 14:25:29 BRT

Publicada a revisão solicitada pelo usuário: grade alinhada com miniaturas
quadradas e cantos arredondados; opções “Mais perto” e “Foto inteira”; foco nos
grupos usando geometria local das imagens, sem regravar os originais. O mapa tem
1.228 enquadramentos para 1.236 imagens locais, com fallback integral quando não
há geometria segura. Detalhes e reprodução em `ENTREGAS_PREVIEW.md`.

No celular, o visualizador usa a tela inteira, com ações compactas sobrepostas,
zoom até 4×, arraste, pinça e duplo toque. O botão Ampliar usa o enquadramento do
grupo quando disponível; Foto inteira restaura o estado inicial. O componente
da página do veículo recebeu a chamada “Histórias de quem já escolheu a Netcar”,
com três fotos reais e um link para o álbum, após a seção Fábrica de Valor.
A consulta ao feed ganhou três tentativas limitadas e recuperação ao voltar a
conexão, mantendo uma ação explícita de tentar novamente em falha persistente.

Release incremental: `20260921-entregas-171932-4a77c532`.
SHA-256: `4a77c53267f3e047dfcac5dde7179c1999769b9e3e505af94e9e8dc6e0bf2659`.
Pacote de 921.115 bytes: 74 arquivos JS, dois CSS, `index.html` e manifesto Vite.
O processo verificou também os 16 assets reutilizados, conferiu o baseline da
release anterior e publicou somente 76 assets e os dois índices. PHP, rotas,
acervo, dados ao vivo e configurações ficaram fora do pacote.

Backup e manifesto da revisão:
`/home/netcarmultimarcas/.netcar-entregas-releases/20260921-entregas-171932-4a77c532`.
O `manage.php` desse diretório oferece rollback guardado desta revisão para a
versão das 11h30, sem desfazer o roteamento ou a automação da galeria.

Verificações concluídas: TypeScript, ESLint dos componentes alterados, build Vite
e pós-processamento de CSS/PHP; seis testes do acervo, seis da geometria das
miniaturas e cinco do foco do visualizador. Navegador em desktop, 390 × 844 e
844 × 390: modos de foto, ampliação, arraste, restauração, troca de imagem e CTA.
Em produção, os cinco bundles principais consultados responderam 200 e tiveram
hash idêntico ao build; a galeria manteve HTML inicial com 24 fotos e feed 200.
O caminho da página pública `/veiculo/argo-drive-2024-19687` até a galeria e a
foto ampliada no celular foi verificado após a ativação.

## Chamada no veículo — 21/09/2026, 14:38:49 BRT

A chamada da galeria foi movida para o bloco de preço e contato, logo abaixo do
botão de WhatsApp. O formato compacto mostra três fotos circulares e o título
“Veja quem já escolheu a Netcar”, com link para `/entregas`. A chamada anterior
após Fábrica de Valor foi removida. A alteração não associa as fotos de clientes
ao veículo específico da página.

Release incremental: `20260921-entregas-173821-7cac9926`.
Ativação: 21/09/2026 às 14:38:49 BRT (17:38:49 UTC).
SHA-256: `7cac9926f86158a8d2618bb542a1096b73fd2a8555ca6256f578f5598b462a78`.
Pacote de 914.863 bytes: 74 JS, um CSS, `index.html` e manifesto Vite.
Os 77 arquivos do pacote e os 17 assets reutilizados foram conferidos por hash
no estágio e novamente em produção. O baseline correspondeu à revisão das
14:25:29 BRT; `index.php`, os dois arquivos de roteamento, backend, fotos, dados
ao vivo e configurações ficaram fora do pacote. Assets antigos foram mantidos.

Backup privado dos dois índices anteriores e manifesto:
`/home/netcarmultimarcas/.netcar-entregas-releases/20260921-entregas-173821-7cac9926/backup/`.
O rollback dessa revisão retorna à versão das 14:25:29 BRT e recusa sobrescrever
arquivos alterados por uma publicação posterior:

```sh
node /tmp/netcar-entregas-incremental.mjs --rollback --release 20260921-entregas-173821-7cac9926
```

Validações locais: TypeScript, ESLint dos dois componentes, diff, build Vite e
pós-processamento CSS/PHP; navegação visual em desktop de 1.280 px e celular de
390 px, incluindo o link para a galeria. Após ativação, a URL exata
`https://www.netcarmultimarcas.com.br/veiculo/argo-drive-2024-jcl-xx85-19687`
respondeu HTTP 200 sem redirecionamento e referenciou o novo bundle principal.
O bundle principal, o CSS e `DetalhesPage-CPfOr7AZ.js` responderam 200 com hashes
idênticos ao build; o último contém o novo título da chamada. Em navegador
público de 390 × 844, a chamada ficou visível abaixo do contato na primeira tela,
com as três fotos carregadas. O clique abriu `/entregas` com o título correto e
24 fotos, e o retorno à página do carro funcionou. Os hashes dos dois backups
também foram conferidos. Relatórios locais da implantação:
`/tmp/netcar-entregas-incremental-20260921T173821Z/production-verification.json`
e `http-verification.json` no mesmo diretório.

## Enquadramento automático — 21/09/2026, 15:39:58 BRT

A primeira entrega automática não tinha enquadramento no mapa estático. O bot
agora calcula `card_crop` sobre o card final congelado e persiste a decisão na
fila; o PHP publica `cardCrop` no feed. O álbum e o botão Ampliar usam essas
coordenadas sem uma nova compilação por foto. Ausência ou geometria inválida
mantém a foto inteira na grade. A detecção roda no VPS com YuNet/OpenCV, sem
serviço externo de imagem, identificação de pessoas ou alteração do original.

O registro `delivery-615c4c428886366fe15a4903` recebeu
`[0,0.139737,0.571429,0.321429]` pelo próprio worker. Os dois rostos foram
detectados, com margens para cabeça/ombros. Permanecem o mesmo ID, a publicação
`2026-09-21T18:09:19Z`, as URLs e os bytes das imagens. O feed continua com uma
entrega automática e o álbum com 1.448 fotos. Uma amostra de dez imagens do
acervo também foi revisada; detecção incerta mantém o enquadramento inteiro.
Contrato, runtime, testes e backups do PHP/bot estão em
`ENTREGAS_AUTOMATION_BACKEND.md`.

Durante a preparação, outro deploy (`b37649a`, remoção do Bruno) substituiu os
índices e rotas que continham a galeria. As guardas recusaram essa divergência;
o pacote preparado `20260921-entregas-181643-e6eabfc2` não foi ativado. Foram
integrados os cinco arquivos alterados entre `b43556e` e `b37649a`, preservando
a remoção do Bruno, o blog atualizado e os ajustes dos scripts de deploy.
Os metadados de estoque/i-CHECK regenerados por aquela publicação não foram
substituídos. A baseline foi comparada com o artefato efetivamente publicado
em `netcar-devops:/workspace/dist`, HEAD `b37649a`, em vez do build diferente
no Mac. Noventa e quatro arquivos foram verificados sem divergências.

Release integrada: `20260921-entregas-183614-ee142fa0`.
Ativação: 15:39:58 BRT (18:39:58 UTC).
SHA-256: `ee142fa05faa570c902c551ec9e6449a0c900f19856e004f9330bb380e48b816`.
Pacote de 941.237 bytes, 81 arquivos: 76 assets e cinco entradas mutáveis
(`index.php`, `index.html`, manifesto Vite, `.htaccess` e `sitemap.xml`).
A ativação copiou 75 assets, verificou um já existente e preservou os demais.
O sitemap mantém as 161 URLs do deploy anterior, com apenas `/entregas` reposta.
Backend, fotos e dados ao vivo ficaram fora do pacote frontend.

Backup das cinco entradas:
`/home/netcarmultimarcas/.netcar-entregas-releases/20260921-entregas-183614-ee142fa0/backup/`.
Baseline e comparação independente:
`/tmp/netcar-entregas-bruno-baseline-20260921/coordinated-baseline.json`.
Manifesto e relatórios locais:
`/tmp/netcar-entregas-incremental-20260921T183614Z/`.
Rollback guardado, que retorna às entradas da publicação anterior do Bruno:

```sh
node /tmp/netcar-entregas-incremental.mjs --rollback --release 20260921-entregas-183614-ee142fa0
```

Validações: TypeScript, ESLint, 13 testes de feed/visualizador e 16 verificações
do pacote/guardas. Backend: 27 testes Python e 62 verificações PHP, incluindo
repetição de envio, crop quadrado, atualização sem regravar imagem e ausência
de duplicata. Prévia do build e produção conferidas visualmente: grade com a
foto nova próxima às duas pessoas; celular 390 × 844 com Ampliar e retorno à
foto inteira; chamada para entregas no Argo; página Sobre sem nome/foto do Bruno.
Nenhuma mensagem de WhatsApp ou postagem no Instagram foi enviada para testes.

Conferência final às 18:42:27 UTC: os 81 arquivos, 16 assets retidos e cinco
backups correspondem aos hashes esperados. Galeria, Argo e Sobre respondem
HTTP 200; sitemap contém 162 URLs; feed mantém o crop; `lib.php` e o roteamento
interno de entregas permanecem íntegros. Relatórios `verification-readonly-server.json`
e `verification-readonly-http.json` na pasta local da release.

Para o próximo deploy, partir desta versão integrada: um build antigo sem o
módulo de entregas remove novamente a rota e a chamada, mesmo que os arquivos
de mídia e o bot continuem presentes. As guardas de hashes devem permanecer
ativas para detectar outra publicação concorrente antes de trocar os índices.

## Integração permanente — recuperação de 21/09/2026

Os deploys completos partem de `origin/master`, sincronizado no VPS em
`/opt/netcar-site-react` e montado como `/workspace`. As primeiras publicações
da galeria eram pacotes isolados: o módulo ainda não estava nessa branch.
Por isso, builds posteriores de outras correções substituíram `index.php` e
os índices JavaScript por versões sem a galeria, causando 404 sem apagar fotos.

A recuperação integra código, endpoints, menu, chamadas na home e nos veículos,
acervo revisado e enquadramentos na mesma base das demais alterações. Preserva
a remoção de Bruno da equipe e a correção de pintura inicial do estoque.
O build e o deploy validam a presença das rotas Apache/PHP, do módulo da galeria
alcançável pelo aplicativo e do seed; um pacote incompleto é recusado.

Os arquivos de imagem são conteúdo persistente da hospedagem e não entram no
Git. O seed é reproduzível com `npm run entregas:seed`; os dados novos e suas
imagens são excluídos explicitamente dos uploads e dos rollbacks de dist.
Um checkout limpo usa os mesmos endereços públicos de mídia já publicados.
Para desenvolvimento local, copiar o acervo existente ou apontar a mídia para
a hospedagem; nunca substituir `live.json` por uma cópia local.

Recuperação ativada às **16:44:37 BRT / 19:44:37 UTC**. Release
`20260921-entregas-194354-33b02662`, SHA-256
`33b026628604c971ae6259ebed017751ef7f26faf18be2b0ffb2bbfb0004f58e`.
Código integrado e publicado em `origin/master`: `caa7056`.
Pacote incremental de 942.637 bytes: 79 assets e cinco arquivos de entrada.
Verificação independente: 84 arquivos, 16 assets retidos e cinco backups íntegros;
backend, configurações e mídia preservados. Galeria, home e Argo responderam200.
Sitemap preserva as 161 URLs anteriores e acrescenta `/entregas`.

Validação: build completo, TypeScript, ESLint dos arquivos alterados, 13 testes
de galeria/foco, quatro de preservação de deploy e quatro da correção de pintura
do estoque. Um checkout sem mídia gera os 1.447 registros; o build antigo sem
galeria é recusado antes de conectar ao site. VPS canônico confirmado em master
com o módulo e as guardas. No navegador público em desktop e390px, chamada da
home com três fotos carregadas e link funcional, chamada no Argo,1.449 registros
visíveis e as duas fotos automáticas com enquadramento; ampliação móvel verificada.
