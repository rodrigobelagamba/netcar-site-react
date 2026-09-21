# Galeria de entregas

Rota: `/entregas`. Versão preparada para publicação autorizada em 21/09/2026;
o estado operacional da implantação fica em `ENTREGAS_RELEASE.md`. A página usa o
header/footer existentes, navegação visual com filtros combinados de mês/ano
sempre visíveis, grade regular com miniaturas quadradas e arredondadas, lotes de
24 fotos e visualizador acessível com teclado, swipe, ampliação, compartilhamento
e retorno de foco. “Mais perto” destaca as pessoas; “Foto inteira” preserva o
enquadramento original nas miniaturas. No celular a imagem usa a tela inteira,
com controles compactos sobrepostos em vez de um painel grande de informações.

## Inventário consultado em 21/09/2026

Três consultas de metadados à API pública (`list` e `gallery`) confirmaram
2.565 registros, 2.515 referências a imagens e 2.482 URLs de imagem únicas;
50 registros não têm imagem. Os registros com imagem vão de 07/10/2013 a
22/08/2025, com oito sem data válida. A contagem de URLs não comprova a
disponibilidade de cada arquivo nem deduplica fotos iguais em URLs diferentes.
O inventário completo dos grupos de WhatsApp ainda não foi feito. A seleção
exibida tem 1.447 registros: 217 do acervo, seis do marketing e
1.224 do Instagram visíveis após a revisão de duplicatas. Foram percorridas
as 14 pastas de clientes do perfil; vídeos e artes sem foto de entrega ficaram
fora do álbum. Essas contagens representam registros fotográficos, não um total
comprovado de clientes ou vendas diferentes.

## Dados e imagens

O arquivo `src/modules/entregas/data/deliveries-preview.json` é uma seleção real
de 217 registros do endpoint público de depoimentos, capturada em 19/09/2026.
121 têm nomes aproveitáveis. Datas são datas do cadastro do acervo, não datas de
compra verificadas. Nomes vazios ou preenchidos com meses não foram inventados.
O álbum e a navegação seguem a data, da mais recente à mais antiga; registros
sem data ficam no fim e empates preservam a ordem da fonte. As fotos em destaque
no topo têm curadoria e não alteram a ordem cronológica do álbum.
Algumas imagens recentes são capturas de stories, preservadas como recebidas.

Em 21/09/2026 foram acrescentadas seis fotos do fluxo de entregas do marketing,
publicadas nos Stories entre 16 e 19/09/2026. São os arquivos `foto_tratada.png`
da automação, sem a arte do card e com o tratamento de placas já aplicado na
origem. Uma segunda versão da mesma foto foi excluída após inspeção visual.
Recibos de publicação e hashes da origem estão em
`entregas-marketing-provenance.json`. O servidor foi acessado somente para leitura.

O lote fica em `src/modules/entregas/data/deliveries-recent.json` e precede o
histórico no álbum. Esse lote elevou a seleção a 223 fotos, antes da importação
do Instagram descrita abaixo. Os nomes não constam nos recibos; as seis fotos
permanecem sem nome. A legenda anterior “Carlos e Tiago” em `mkt-2769a3fe` foi
uma inferência inadequada e foi removida.

Em 21/09/2026 o usuário indicou a foto `instagram-43c91a37b90fb585124bab7e`
para mostrar Tiago em um dos destaques do topo, sem atribuir nome de cliente
ao registro da entrega. Depois, a pedido do usuário, as três legendas do topo
passaram a ser “Histórias reais”, “Mais uma conquista” e “Sonho realizado”.
A navegação do lote continua visual e por período.
A data exibida é a de publicação, não de compra.
Os arquivos locais em `public/entregas-media/` conservam o enquadramento completo
em WebP, com versões de 320, 640 e 960 pixels. O recorte das miniaturas é apenas
visual; o visualizador abre a foto inteira.

Na revisão visual de 21/09/2026 foram calculados 1.228 enquadramentos para as
1.236 imagens locais, usando apenas retângulos de rostos do macOS Vision. O mapa
`delivery-card-crops.json` guarda tuplas normalizadas `[x,y,width,height]`, sem
nomes, identificação ou características biométricas. A geometria conserva os
retângulos detectados e margens para cabeça/ombros. Oito fontes sem recorte seguro
e os registros remotos sem mapa usam a foto inteira. Os arquivos de imagem não
são regravados. `python3 scripts/prepare-delivery-card-crops.py` reproduz o mapa
localmente, sem adicionar um detector ao navegador.

O fluxo automático entrega agora o enquadramento no campo público `cardCrop`
de cada registro, no mesmo formato normalizado do acervo. O álbum e o botão
Ampliar do visualizador usam essa geometria sem depender de uma nova compilação
do site ou de acrescentar o ID ao mapa estático. Dados ausentes ou inválidos
mantêm a foto inteira na grade, em vez de cortar com uma posição genérica.
O arquivo completo e o link da entrega continuam os mesmos.

Para atualizar a amostra: `node scripts/prepare-deliveries-preview.mjs --check-images`.
É uma leitura pública, sem alterações no servidor ou downloads do corpo das fotos.
As miniaturas usam o `img.php` já existente, WebP responsivo e lazy loading.
O visualizador conserva o arquivo original completo e o link para abri-lo.

## Escopo e funcionamento

- A navegação cobre esta seleção e as novas publicações automáticas, não os 2.565
  registros do banco inteiro. A busca é por mês e ano, sem reconhecimento facial.
- Compartilhar usa `#foto=ID`; há metadados sociais da galeria, sem uma página
  de SEO separada para cada cliente ou foto.
- O topo tem destaques escolhidos; o álbum permanece em ordem decrescente por data.
- O site mescla o acervo inicial com `/entregas/v1/feed.php`, sem novo build a cada
  card. O servidor entrega HTML inicial com 24 fotos e links `?pagina=N`.
- Os filtros ficam em memória, sem criar combinações rastreáveis de endereços.
- A rota permite indexação, tem canonical, metadados próprios, sitemap, menu e rodapé.
- A página individual de veículo inclui “Veja quem já escolheu a Netcar” logo
  abaixo dos botões de contato, troca e comparação. O cartão inteiro abre o álbum,
  com três fotos reais em miniaturas circulares. Essa chamada não atribui a entrega
  ao veículo específico nem importa o índice completo da galeria nessa página.
- Atualizações temporariamente indisponíveis são repetidas até três vezes; ao
  recuperar a conexão, a página consulta o feed novamente. Se a falha persistir,
  o acervo continua acessível e há uma ação explícita de tentar novamente.
- O backend aceita somente o card final e metadados técnicos de publicação. Não
  associa comprador/veículo nem implementa painel ou medição nova nesta entrega.

O acervo antigo foi importado pontualmente. As seis fotos recentes iniciais vieram
 dos arquivos da automação; os destaques foram recuperados pelo navegador autenticado.
A nova integração e sua configuração estão em `ENTREGAS_AUTOMATION_BACKEND.md`.

### Importação dos destaques do Instagram

Em 21/09/2026 foram percorridas as 14 pastas de clientes no navegador autenticado,
da primeira à última publicação disponível de cada pasta. Os arquivos foram
exportados pelo inventário de mídia observado da página e inspecionados em folhas
de contato, sem inferir nomes das pessoas. A fonte foi preservada, inclusive a
arte original dos stories. O acervo recuperado inclui fotos de 2019 a 2026.

| Pasta | Referências de fotos aprovadas | Datas de publicação |
| --- | ---: | --- |
| CLIENTES | 60 | 2019-04-03 a 2022-10-31 |
| CLIENTES II | 98 | 2022-09-08 a 2023-02-11 |
| CLIENTES III | 99 | 2023-02-17 a 2023-06-30 |
| CLIENTES IV | 99 | 2023-07-01 a 2023-10-24 |
| CLIENTES V | 94 | 2023-10-21 a 2024-02-17 |
| CLIENTES VI | 93 | 2024-02-22 a 2024-06-11 |
| CLIENTES VII | 100 | 2024-06-07 a 2024-09-19 |
| CLIENTE VIII | 92 | 2024-09-19 a 2024-12-13 |
| CLIENTES IX | 96 | 2024-12-14 a 2025-05-06 |
| CLIENTES X | 93 | 2025-05-03 a 2025-08-13 |
| CLIENTES XI | 90 | 2025-08-14 a 2025-11-11 |
| CLIENTES XII | 98 | 2025-11-10 a 2026-03-02 |
| CLIENTESXIII | 84 | 2026-03-02 a 2026-06-20 |
| CLIENTES XIV | 76 | 2026-06-22 a 2026-09-19 |

As 1.272 referências aprovadas resultaram em
1.230 registros do Instagram, após reunir
42 repetições reconhecidas por hash ou nome estável do arquivo.
Seis outras repetições visuais foram mapeadas em `delivery-duplicates.json`:
cinco usam a foto do marketing e uma usa a versão original do Instagram. Assim,
1.224 registros do Instagram aparecem na galeria; os originais importados
continuam no índice com sua proveniência. Os links antigos resolvem para a
versão mantida. Um destino ausente nunca oculta a foto disponível.

O inventário e as exclusões revisadas estão em
`docs/entregas-instagram-import-audit.json`. Vídeos não foram importados como
fotos. Três artes sem fotografia e um repost repetido foram excluídos antes da
importação. A revisão não comprova uma deduplicação visual exaustiva com as
2.482 URLs do banco legado inteiro.

O importador local `scripts/import-instagram-deliveries.py` lê manifestos de
arquivos já baixados; ele não acessa o Instagram nem usa credenciais. Mantém
`deliveries-instagram.json` separado, gera WebP responsivo em até 320, 640 e 960
pixels, sem ampliar imagens pequenas, e preserva a foto inteira no visualizador.
Repetir o mesmo lote não duplica os registros nem substitui nomes ou legendas
editados. A data é a de publicação do Instagram, convertida para o fuso da Netcar
quando há horário e fuso na origem; não é uma data de compra comprovada.

### Entrada de novas entregas

Receber foto → escolher Entrega / Carro vendido → gerar e validar versões →
enviar card ao grupo → publicar no Instagram. Ao receber um `media_id` válido,
o bot congela uma cópia do **card final com template** e a coloca na fila persistente
`DATA_DIR/delivery_gallery_outbox`. O worker envia ao site e repete somente esse
passo se necessário, sem publicar novamente no Instagram. A identidade vem do hash
da foto original (fallback no recibo Instagram); não depende de nome ou placa.

A opção 2, que separa arquivo para postagem manual, não sincroniza automaticamente:
separar o card não confirma que a publicação ocorreu. Sem configuração privada,
a fila permanece guardada e não envia. O worker relê a configuração a cada ciclo.
A ativação efetivamente verificada é registrada em `ENTREGAS_RELEASE.md`.

## Vínculo com comprador e veículo

O esquema atual do banco analítico foi confirmado em 21/09/2026, somente com
consultas de esquema e contagens: `fato_venda.seqveiculo` referencia
`dim_veiculo.seqveiculo`; `fato_venda.codgeralcomprador` referencia
`dim_cliente.codgeral`. Estão disponíveis `datavenda`, nome/primeiro nome do
cliente e marca, modelo, placa e anos do veículo. Nas 35 vendas de setembro
até a consulta, todas têm cliente com nome, veículo e placa vinculados.
A sincronização consultada ocorreu em 21/09/2026 às 03:00.

O fluxo da foto ainda não grava `seqveiculo` nem comprador. A integração precisa
receber um código de veículo/placa ou selecionar uma venda, resolver o vínculo
internamente e guardar `session_id → seqveiculo → comprador`. Validar antes a
correspondência entre o código público do estoque e o código do ERP.
O nome público da legenda deve continuar editável: comprador, vendedor e demais
pessoas presentes na foto são papéis diferentes. `datavenda` não comprova a data
de entrega e deve ficar separada da data de publicação. Nenhuma associação nova
de comprador/veículo foi realizada nesta prévia. A legenda incorreta “Carlos e
Tiago” foi removida; a foto indicada pelo usuário para o destaque de Tiago não
estabelece quem é o comprador.

## Verificação

`tsc --noEmit`, ESLint do módulo, testes `tsx --test
src/modules/entregas/lib/deliveries.test.ts` e `vite build`. Revisão visual e
interação no navegador em desktop e celular. A implantação e as verificações
no site público são registradas em `ENTREGAS_RELEASE.md`.
