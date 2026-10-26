# Equipamentos: conflitos confirmados e proteção da importação

Autorização do responsável em 26/10/2026: corrigir os erros confirmados,
incorporar a verificação ao cron existente e publicar. O escopo não inclui
remoção de suspeitas sem comprovação, alteração do XML/ERP ou inclusão automática
de outros equipamentos.

Foram triados 73 registros públicos (61 com preço positivo, 12 com preço zero),
com pesquisa documental direcionada. Não se certificou fisicamente todo o estoque.
A auditoria pública de equipamentos é uma verificação de consistência com o
cadastro; não comprova a configuração de fábrica nem o funcionamento dos itens.

## Correções aprovadas

| Identidade brasileira exata | Alegação contestada | Evidência e decisão |
| --- | --- | --- |
| Honda HRV EX, modelo2018, 1.8, automático; unidade19739 | Chave presencial; Android Auto; Apple CarPlay | [Honda: linha2020](https://saladeimprensa.honda.com.br/releases/honda-lanca-linha-2020-do-hr-v), 09/05/2019: Smart Entry inédito na Touring2020; conectividade Android Auto/CarPlay como novidade da EX2020. Reter as alegações incompatíveis com a configuração original até confirmação específica de eventual instalação posterior. |
| Volkswagen Nivus Highline Turbo, modelo2024, 1.0, automático; unidade19788 | Assistência de permanência em faixa | [Volkswagen: lançamento do Novo Nivus2025](https://www.vwnews.com.br/news/2260), seção “Segurança e estilo com novos pacotes Outfit e ADAS”: Lane Assist no novo pacote ADAS da linha2025. Não transportar a configuração2025 para2024. |
| Jeep Compass Longitude T270 Turbo, modelo2022, 1.3, automático; unidade19379 | Tração AWD/integral | [Catálogo oficial MY2022](https://www.media.stellantis.com/br-pt/jeep/jeep-compass-my-2022), [ficha Longitude T270 AT6, p.1](https://www.media.stellantis.com/br-pt/download-model-document/133?v=1774006099): “Tração: Dianteira”. Retirar a alegação de tração integral; não acrescentar itens inferidos ao cadastro. |

As alegações foram observadas nas fichas públicas, não somente no resultado local
do resolver. A regra se limita às identidades documentadas acima; não abrange
outras versões, motores, anos-modelo ou mercados. Uma incompatibilidade de fábrica
não demonstra por si só ausência física de um acessório instalado posteriormente.
Uma confirmação individual aprovada, compatível e rastreável pode prevalecer.

## Pendências, sem autorização de exclusão

- ACC nos Renegades20094/20075: confirmar por documentação exata/unidade.
- Assistência de faixa no Tucson19963 e AEB no Compass19379: não concluir ausência
  pela omissão em comunicados resumidos.
- Equipamentos do ix3519653 e conectividade sem fio dos HR-V19854/19898: fontes
  específicas ainda insuficientes para uma decisão negativa.
- HB20Limited20038: resolver a abreviação da versão; o catálogo LimitedPlus2025
  possui SmartKey, portanto não apagar por generalização.

## Controles de preservação

Android Auto/CarPlay do CivicEXL2018 são equipamentos legítimos segundo o
[catálogo Honda2018, pp.4/7](https://www.honda.com.br/automoveis/sites/hab/files/2019-04/%5BHONDA%5DCampanha%20Civic%202018_Folheto%20EXL_R8.pdf).
O [catálogo NissanKicks2026](https://www.nissan-cdn.net/content/dam/Nissan/br/site/veiculos/kicks-my26/documentos/ficha_tecnica.pdf)
confirma ACC nas versões Sense/Advance. As confirmações anteriores do Fastback20050,
Civic20051, Renegade20075 e T-Cross19903 permanecem válidas em seus próprios escopos.

## Operação e limites

A mesma rotina das09h identifica conflitos documentados e itens sensíveis sem
respaldo, incluindo registros vendidos na conferência de equipamentos. Pesquisa
e decisões de inclusão continuam separadas e restritas ao fluxo existente; não
há segundo cron, pesquisa irrestrita automática, mensagem externa ou deploy do
site pela auditoria. Uma mudança no feed não deve apagar decisões anteriores.

O manifesto SEO schema4 exige cadastro idêntico ao snapshot gerado pelo resolver;
ausência ou divergência omite a lista de equipamentos, em vez de republicar as
alegações brutas. Testar importação repetida, novos IDs, exceções individuais,
outros anos/versões e preservação das confirmações anteriores antes do release.
