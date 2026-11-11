# Black Friday Netcar — novembro de 2026

## Visual anterior e escopo

Base preservada: `02191bee153060b126422f1071d7bb64fb632a7e` (`origin/master` em
11/11/2026, antes desta campanha). A implementação normal das páginas deve
permanecer disponível; os elementos, textos e estilos da Black Friday só devem
ser aplicados enquanto `useBlackFridayCampaign().active` for verdadeiro.

Referência Git local: `codex/pre-black-friday-2026`. O painel DevOps foi
consultado em 11/11: `master` e `dist.builtFromSource` confirmaram essa mesma
base (`02191bee`), sem jobs ativos. Esta preparação não fez deploy.

A campanha concentra-se na home, em seminovos e na página do veículo. O visual
anterior retorna pela mesma chave, sem reverter preços, estoque, garantias,
equipamentos, conteúdo editorial nem melhorias publicadas depois desta base.
Não fazer `reset`/deploy integral do commit antigo para encerrar a campanha.

## Condições confirmadas e materiais

O responsável confirmou nesta tarefa que os quatro benefícios valem **juntos
para todo o estoque**, até 30/11/2026:

1. Transferência por conta da Netcar.
2. Entrada em até 10 vezes sem juros no cartão, sem limite adicional de valor
   para a entrada.
3. Tanque cheio.
4. Primeira parcela do financiamento em janeiro de **2027**, sujeita à análise
   de crédito.

Fonte de apresentação: vídeo `IMG_1267.MOV`, fornecido pelo responsável, com
18,62 segundos. A versão web tem aproximadamente 3,3 MB e fica em
`public/images/campaigns/black-friday-2026/black-friday-netcar-2026.mp4`; a home
oferece controles de reprodução, pôster e legendas em português. O material
original permanece preservado. O alcance conjunto dos benefícios a todo o
estoque e a ausência de limite adicional na entrada foram confirmados pelo
responsável, além da apresentação do vídeo.

Veículos já vendidos mantêm a indicação de indisponibilidade e a procura por
similares; não recebem oferta nem mensagem de Black Friday para compra daquela
unidade. O aviso geral de campanha no rodapé pode encaminhar ao estoque atual.

Na revisão visual, a vitrine de seminovos ganhou fundo preto/carvão, cards em
gelo e controles turquesa. A foto principal do veículo usa a faixa preta
original da agência em uma camada decorativa atrás do carro, mantendo o fundo
claro original. Essa composição aparece apenas na capa e não altera o arquivo da
foto, as demais imagens ou a ampliação. Todas essas mudanças obedecem à mesma
chave de campanha e desaparecem no rollback.

## Prazo e chave única

Configuração pública: `public/campaigns/black-friday-2026.json`, servida em
`/campaigns/black-friday-2026.json`.

- `enabled: true`: permite a campanha somente dentro do prazo validado.
- Início: 11/11/2026, 00:00, São Paulo (`2026-11-11T00:00:00-03:00`).
- Último dia: 30/11/2026. Encerramento exclusivo:
  `2026-12-01T00:00:00-03:00` (03:00 UTC).
- `enabled: false`: rollback visual de toda a campanha.

O provider lê esse arquivo em tempo de execução com `cache: no-store`, a cada
60 segundos e ao voltar para a aba. Um timer aplica o encerramento também em
uma aba já aberta. Configuração ausente, erro de rede, JSON inválido ou datas
divergentes deixam a campanha desativada. Não há parâmetro de URL que permita
reativar uma campanha encerrada ou desabilitada. As datas usam o relógio do
navegador; as verificações devem usar um dispositivo com a hora correta.

## Rollback manual

1. Partir do `master` mais recente para preservar outras alterações.
2. Executar `node scripts/disable-black-friday.mjs`. O comando muda somente
   `enabled` para `false` no arquivo de configuração deste checkout.
3. Executar `node --import tsx --test scripts/tests/black-friday-*.test.ts*`
   e `NETCAR_SKIP_PHOTO_BUILD=1 npm run build`.
4. Revisar `git diff` e publicar somente essa desativação pelo procedimento
   autorizado da Netcar: aprovação específica, `master`, workflow do painel,
   conferência de `/api/status`, `POST /api/deploy/local`, acompanhamento do job.
5. Confirmar que o JSON público responde com `enabled: false`; conferir home,
   seminovos e um veículo em desktop e celular. Conferir também uma aba que já
   estava aberta (atualização em até 60 segundos ou ao retomar o foco).

O script local não faz deploy. O encerramento automático pelo prazo não exige
novo deploy, mas publicar `enabled: false` depois do fim mantém o estado
operacional explícito. Os assets da campanha podem continuar no servidor sem
aparecer nas páginas.

## Verificação antes da publicação

Conferir as três páginas com campanha ativa e repetir com a chave desativada.
O modo desativado deve coincidir com a apresentação anterior, inclusive CTAs,
mensagens de WhatsApp, navegação, cores e conteúdo normal. Os testes de ciclo
de vida cobrem limites de data, erro/ausência de configuração, rollback em aba
aberta e encerramento sem recarregar. Os testes de apresentação conferem a
remoção dos blocos sazonais, os benefícios, o vídeo e o comportamento dos CTAs
dos veículos disponíveis e vendidos.

O texto das condições comerciais deve refletir os materiais e as confirmações
do responsável. A chave de campanha não altera preços nem cria condições de
financiamento no cadastro dos veículos.

## Validação desta versão

- TypeScript, build completo do projeto e build final Vite passaram.
- 15 testes da campanha passaram: fronteiras de data, falhas de configuração,
  desligamento em aba aberta, superfícies removidas, vídeo, CTAs e vendidos.
- Validações existentes do contato regional e busca do cabeçalho passaram.
- Navegador em 1440 px e 390 px: home, busca por modelo, ficha do veículo,
  condições expansíveis e links de campanha conferidos. Vídeo reproduziu até
  o fim (18,63 s no arquivo convertido), sem erro no player.
- Rollback executado pelo script e conferido no build local: as três páginas
  retornaram às superfícies e CTAs normais. A chave foi reativada depois da QA.
- Capturas de revisão ficam fora do repositório, em
  `../artifacts/black-friday-2026/`. As alterações geradas de estoque e blog
  pelo build foram excluídas do escopo desta campanha.
