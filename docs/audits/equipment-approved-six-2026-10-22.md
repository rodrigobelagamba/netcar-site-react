# Equipamentos autorizados — 22/10/2026

Escopo restrito a seis complementos. A biblioteca mantém seus 19 candidatos
anteriores e acrescenta os seis abaixo como documentação; isso não transfere
aprovação a outra unidade. Não inclui os 29 candidatos não apresentados nem
os sete itens anteriores de Renegade 20094 e Civic 20083.

| Unidade e identidade conferida | Complementos |
| --- | --- |
| Nissan Kicks Exclusive 20090, fabricação/modelo 2021/2022, 1.6 automático | 6 airbags; câmera 360° |
| Peugeot 2008 Active T200 20068, fabricação/modelo 2025/2025, 1.0 turbo automático | Controle de estabilidade; assistente de partida em rampa |
| Peugeot 2008 Style 20092, fabricação/modelo 2022/2023, 1.6 automático | Airbags laterais; ISOFIX |

## Evidência de configuração

- Kicks: [comunicado Nissan de 25/02/2021](https://brazil.nissannews.com/pt-BR/releases/novo-nissan-kicks-ative-sua-atitude).
  Seis airbags na Sense, herdados por Sense CVT, Advance e Exclusive; visão 360°
  explicitamente na Exclusive. A página identifica o anexo técnico Kicks 2022.
  Não inclui os opcionais do Pack Tech.
- Active: [matriz brasileira MY24/25](https://www.media.stellantis.com/uploads/br/model-document/fichatecnicapeugeot2008my2425-695bcce52dbda.pdf),
  página 2, coluna Active Turbo 200 CVT: ESP e Hill Assist de série. O
  [comunicado de 07/08/2024](https://www.media.stellantis.com/br-pt/peugeot/press/novo-peugeot-2008-design-magnetico-com-atitude-sofisticacao-e-tecnologia)
  corrobora os itens na gama; o vínculo explícito ao ano-modelo está na matriz.
- Style: [matriz brasileira MY2022/2023](https://www.media.stellantis.com/uploads/br/model-document/ft_peugeot_suv2008_my2223_v2-62bb19ce7a713.pdf),
  página 1, coluna Style 1.6 AT: airbags laterais e ISOFIX. O comunicado de
  lançamento não substitui essa tabela para comprovar os dois itens.

Os PDFs foram lidos e suas colunas conferidas em 22/10/2026. Nas entradas da
biblioteca cuja data é 22/10, ela representa a revisão documental, não a
publicação da montadora. A origem oficial e a configuração documentada não
substituem os atestes específicos da unidade.

## Decisões e identidade

Os seis itens foram apresentados na mensagem
`Sentinel_0caf1629f4bc8191a5bb0ec3aed80b1c` e autorizados na resposta direta
`Sentinel_441767da06048191bb81bce2462b2fa0`. O responsável reafirmou a publicação
em `Sentinel_61d0909dd050819186acff54690c4d82` e
`Sentinel_864a0e24391c819182d6b13861f6ef42`.

Em 22/10/2026 às 11:07 BRT, respondeu “publica” em
`Sentinel_2aee3a1842dc8191b1d3d950931034bc`, diretamente à pergunta
`Sentinel_34ceea1829448191be454a22d1338a75`, que solicitou o ajuste restrito das
três fontes e a confirmação de que essas três unidades eram versões
originalmente comercializadas no Brasil. O registro operacional referencia
essa resposta no contexto da pergunta combinada, sem alegar documento
individual adicional.

Na Active, XML `2008 ACTIVE T200` e API `2008 ACTIVE T200 TURBO` diferem apenas
pelo sufixo apoiado em `motor_turbo:true` no XML. ID, marca, fabricação,
ano-modelo, motor e câmbio coincidem. A revisão individual usa o mecanismo
existente `sourceIdentityConfirmed`, sem normalização global ou alteração do
cadastro de origem; vínculo físico e demais validadores continuam obrigatórios.

O responsável corrigiu Stepway 20095 para automático/CVT e retirou cortina da
Active no XML de 22/10 às 13:18:59 UTC; as duas correções foram conferidas nas
fichas públicas. Este trabalho não as desfaz nem remove outro equipamento.

## Aplicação e verificação

Aplicação, hashes da proposta, recibos, vínculo físico e verificação pública
ficam no histórico privado do fluxo existente. Este documento e a biblioteca
não são prova de publicação. A proposta deve incluir exatamente os seis pares,
e a aplicação na VPS precede o commit das confirmações e o deploy.
