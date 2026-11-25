# Descrições do Carclick

Autorização: em 29/10/2026 o responsável aprovou o texto com Nethelp, retirou
quilometragem da descrição e pediu a alteração no próprio XML distribuído.
Em 25/11/2026 o responsável pediu também a correção dos JPG ausentes na galeria do CarClick.

## Onde roda

URL de importação preservada: `https://www.netcarmultimarcas.com.br/feeds/carclick.xml`.

- `public/.htaccess`: reescreve internamente somente essa URL para `feeds/carclick.php`.
- `public/feeds/carclick.php`: lê o arquivo local `feeds/carclick.xml` recebido do
  exportador original e entrega as descrições e galerias do CarClick.
- `public/feeds/carclick-description.php`: texto aprovado, validação XML e alteração
  de `OBSERVACAO` em cada registro `veiculo`.
- `public/feeds/carclick-warranty.php`: seleciona somente afirmações de garantia
  aprovadas e compatíveis com a unidade, a fonte atual e o relógio.
- `public/feeds/carclick-photos.php` compara o ID e a placa da unidade com o estoque
  atual. Para cada AVIF da galeria sem equivalente no feed, acrescenta o nome
  relativo do JPG após a última foto preenchida, se houver um JPEG válido. A capa
  e as fotos existentes mantêm sua posição. O JPG do Automacar tem prioridade.
  Quando ele falta, o mesmo endereço pode servir um dos originais conferidos de
  `public/images/carclick-gallery/`. Uma galeria retirada do estoque deixa de
  fornecer complementos na próxima leitura dos dados atuais.

Não existe cron novo: a transformação acontece em cada consulta do importador.
Carros que entrarem no próximo arquivo de origem recebem a descrição padrão na
próxima leitura, sem deploy. O intervalo de exportação original e de importação
da ClickGarage ainda não foi determinado; não prometer atualização imediata.

O caminho/processo produtor do arquivo bruto não foi localizado nas fontes
disponíveis. Esta mudança atua no processo que **serve** esse mesmo feed, sem
substituir o exportador, mudar sua agenda ou criar outra URL na ClickGarage.

## Texto e limites

O texto inclui modelo, atestes de procedência fornecidos pelo responsável,
Netcar desde 1997, preparação própria, Nethelp e convite para informar modelo
e ano do usado na troca. Não inclui preço, quilometragem, telefone, e-mail,
URL, endereço, códigos internos nem equipamentos inferidos.

Garantia pode substituir a abertura, mas a cobertura deve ser explícita.
Motor/câmbio não se torna cobertura geral. Datas estimadas pela fabricação não
são apresentadas como vencimentos efetivos. Falta de comprovação ou falha na
consulta atual apenas omite a chamada de garantia; o carro continua no feed.
Novas afirmações de equipamento ou mudança editorial exigem revisão própria.

## Atualização da garantia e acompanhamento

O texto padrão de um carro novo é gerado na consulta do XML. A abertura de
garantia depende também de uma projeção já publicada das aprovações canônicas:

- `scripts/generate-carclick-warranty.ts` usa os mesmos resolvers de garantia do
  site e o snapshot completo e recente produzido pelo build existente. Não
  consulta outro estoque nem cria aprovações.
- `npm run feeds:carclick-warranty` gera
  `public/feeds/carclick-warranty.json`. Esse comando já faz parte do build,
  depois da preparação do estoque e do registro canônico. Executá-lo sozinho
  com snapshot ausente ou antigo não habilita garantias; a saída fica sem
  afirmações aprovadas.
- `src/data/carclick-warranty-model-aliases.json` registra somente diferenças
  de nome XML/API conferidas por unidade e vinculadas à identidade física em
  hash. Não autoriza retirar sufixos genericamente nem deduzir versões.
- Em cada consulta, `carclick-warranty.php` confere a projeção publicada contra
  o registro canônico, os dados atuais e a validade. Uma divergência omite
  somente a afirmação de garantia, preservando o carro e a descrição padrão.

O acompanhamento pertence à automação existente **Carimbos e entradas do
estoque Netcar (CARIMBO)**. A conferência do feed ocorre uma vez por dia, após
09:00 no fuso `America/Sao_Paulo`, aproveitando a coleta já realizada. Ela não
gera novamente os textos nem substitui a transformação feita pela hospedagem.

Um carro novo pode ser elegível por uma regra canônica já aprovada, sem mudar
o arquivo do registro de garantias. Mesmo nesse caso, se a unidade ainda não
estiver no manifesto publicado, o CARIMBO deve regenerar e publicar a projeção
pelo build e deploy existentes. Não é necessário alterar a regra ou o registro
apenas para provocar esse build. Se também houver uma publicação de garantia
em andamento, incluir a projeção nesse mesmo fluxo, sem deploy concorrente ou
duplicado. Até a publicação ser comprovada, o carro continua com o texto padrão.

## Conferência

Cabeçalhos públicos de diagnóstico:

- `X-Netcar-Carclick-Descriptions: v1`
- `X-Netcar-Carclick-Vehicles`: quantidade preservada da origem.
- `X-Netcar-Carclick-Warranties`: descrições com garantia aprovada.
- `X-Netcar-Carclick-Added-Photos` informa quantos JPGs foram acrescentados na resposta.
- `X-Netcar-Carclick-Source-SHA256`: hash do arquivo bruto lido, sem seus valores.

A conferência compara todos os registros e campos, descontando as alterações
aprovadas em `OBSERVACAO` e nos campos de foto complementados. Inclui campos
desconhecidos e atributos, sem expor placa,
chassi ou Renavam. Esses valores não entram em logs, exemplos ou Git.

XML inválido, vazio, truncado, com entidade externa ou códigos duplicados retorna
503 com `Retry-After`, nunca um estoque vazio com status de sucesso. A resposta
não usa cache que possa manter garantia vencida ou descrição antiga.

Testes: `php scripts/tests/carclick-description.test.php` e
`node --test scripts/tests/carclick-routing.test.mjs`, além dos testes de garantia
do feed, de `php scripts/tests/carclick-photos.test.php` e do build de produção. A CI executa PHP de verdade; teste ignorado por
falta de PHP local não é aprovação para publicar.

## Reversão

Remover somente a regra `^feeds/carclick\\.xml$` em `public/.htaccess` e publicar
pelo fluxo DevOps existente. A URL volta a servir o arquivo bruto intacto. Não
substituir o XML por um backup antigo, pois preços e estoque podem ter mudado.
Os arquivos auxiliares sem a regra não alteram a importação.

## Limite da comprovação

XML público correto comprova a entrega do feed. Aceitação e texto renderizado em
Autocarro, Webmotors, NaPista ou Mercado Livre dependem da próxima importação e
devem ser conferidos separadamente. Não acionar importação em massa apenas para
antecipar a verificação, nem afirmar publicação nos portais só pelo HTTP 200.
