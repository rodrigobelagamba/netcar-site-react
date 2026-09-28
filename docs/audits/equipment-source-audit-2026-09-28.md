# Auditoria de origem dos equipamentos — 28/09/2026

Escopo: leitura de XML e APIs públicas, consulta do código local; nenhuma alteração no ERP, XML, API ou produção. Os anexos JSON não contêm placas, chassi, Renavam, contatos ou credenciais.

## Origem do Park Assist e teto do T-Cross 19903

- A listagem `https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500` e o detalhe `https://www.netcarmultimarcas.com.br/api/v1/veiculos/id/19903` retornam explicitamente `park_assist` (“Park Assist (Estaciona Sozinha)”) e `teto_solar` (“Teto Solar”) em `opcionais`.
- `src/catalog/endpoints/vehicles.ts` copia as tags e descrições da API; `src/modules/detalhes/lib/vehicleHighlights.ts` apenas selecionava os destaques por `hasTag`. Esses dois equipamentos não foram inferidos a partir do ano/modelo.
- A resposta pública `https://www.netcarmultimarcas.com.br/api/v1/anuncio.php?id=19903`, decodificada de base64, não menciona Park Assist nem teto. Ela não é a origem desses destaques.
- O bootstrap público `https://www.netcarmultimarcas.com.br/seo/stock-bootstrap.json` contém `opcionais: []` para esse carro; portanto não originou esses itens por cache desatualizado.
- O responsável confirmou na conversa que a unidade possui os equipamentos. Não há motivo para removê-los como se fossem ausentes.

### Divergência real de nomenclatura entre XML e API

Fonte XML identificada em auditoria local anterior e consultada novamente: `https://www.netcarmultimarcas.com.br/automacar/xml.xml`.

| Tag do 19903 | XML atual | API atual |
| --- | --- | --- |
| `park_assist` | `1` | presente |
| `teto_panoramico` | `1` | ausente |
| `teto_solar` | `0` | presente |

Na coleta, o XML informava `Last-Modified: Mon, 28 Sep 2026 16:26:27 GMT` (13h26 local). A API ainda devolvia teto solar às 13h29, inclusive em GET com parâmetro de cache-busting e `Cache-Control: no-cache`. Como o XML foi atualizado durante esta conversa, isso pode ser atraso de integração; não é prova suficiente de um erro permanente de mapeamento. A correção deve conferir a sincronização da origem, sem criar uma regra global que torne todo teto solar panorâmico.

Foram comparadas as 112 tags do catálogo em todos os 69 veículos presentes nas duas fontes (60 disponíveis e 9 com preço zero). Apenas o 19903 divergiu, nessas duas tags. Evidência completa sanitizada: `equipment-xml-api-2026-09-28.json`.

O importador do XML e a implementação `/api/v1/veiculos.php` não estão versionados neste repositório. O PHP público da ficha consulta a API por cURL, não o XML.

## Taxonomia e repetições

O catálogo `https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?action=opcionais` possui 112 tags (`nome`, não `descricao`, nessa resposta). Dessas, 93 estão usadas nos 60 veículos disponíveis. O inventário normalizado com descrições e frequências está em `equipment-catalog-2026-09-28.json`.

- 60/60 veículos repetem `air_bag` e `air_bag_duplo`.
- 34/60 possuem as quatro tags genéricas/frontais/laterais/cortina simultaneamente.
- 33/60 repetem `piloto_automatico` e `controle_velocidade`.
- 13/60 possuem ar-condicionado, digital e dual zone simultaneamente.
- 2/60 possuem as duas tags de ABS simultaneamente.

### Armadilhas de nomes e aliases

| Tag | Descrição atual da origem | Tratamento prudente |
| --- | --- | --- |
| `freios_abs` | Freios ABS EBD | Não decidir sobre EBD apenas pelo nome da tag. |
| `freios_abs_com_ebd` | Freios ABS | A descrição não confirma EBD, apesar da tag. |
| `som_radio` | Bluetooth | Não renomear automaticamente para rádio. |
| `vidros_verdes` | Retrovisor com Pisca | Não inferir vidros verdes. |
| `sem-_fio` | Android Auto e Apple CarPlay SEM FIO | Normalizar hífen e preservar especificidade. |
| `franagem_emergencia` | Frenagem Automático de Emergência | Alias com erro ortográfico; não confundir alerta com frenagem. |
| `indcador_fadiga` | Indicador de Fadiga | Alias com erro ortográfico. |
| `porta_automatica`, `porta_mala`, `porta_malas_eletrico` | Três variações de porta-malas automático/elétrico | Consolidar sem prometer sensor de pé. |
| `controle_velocidade` | Controlador de Velocidade | Não elevar para ACC sem tag explícita. |
| `teto_panoramico` | Teto Panorâmico | Não prometer abertura/ventilação; pode ser fixo. |
| `z360` | Z360 | Nome ambíguo; não transformar em câmera 360 sem confirmação. |

### Quantidades de airbags e lugares

Nos 60 disponíveis, a API devolveu `airbag: null` e `lugares: 0`. Não existem tags explícitas de seis, sete ou oito airbags no catálogo atual ou no XML: apenas `air_bag`, `air_bag_duplo`, `air_bag_lateral` e `air_bag_cortina` booleanos. Não somar essas tags para inventar quantidade.

O XML tem `cinco_lugares` (fora do catálogo/API atual), verdadeiro em 28/69 unidades; `sete_lugares` é verdadeiro em 2/69, sem conflito entre ambos. Os dois sete-lugares disponíveis são 20029 (Tiggo 8 Max Drive 2024) e 19960 (Commander Overland 2023). Quantidade de airbags deve vir de registro explícito confiável ou pesquisa oficial da exata versão/ano/mercado com fonte registrada.

## Pontos que consomem opcionais

| Superfície | Arquivo | Comportamento observado antes da revisão |
| --- | --- | --- |
| Destaques e lista visual | `src/modules/detalhes/pages/DetalhesPage.tsx`, `src/modules/detalhes/lib/vehicleHighlights.ts` | Rankings separados e supressão parcial por destaque; repete famílias. |
| Página i-CHECK | `src/modules/detalhes/pages/ICheckLaudoPage.tsx` | Copia descrições cruas da API. |
| PDF baixado no navegador | `src/reports/icheck/downloadICheckReportPdf.ts` | Copia descrições cruas da API. |
| PDF gerado por script | `scripts/generate-icheck-report.mjs` | Copia descrições cruas da API. |
| HTML público/crawler da ficha | `public/detalhe-veiculo.php` | API por cURL, limpeza de ponto inicial, mostra as primeiras 30 descrições sem ranking/agrupamento. |
| Bootstrap de estoque | `scripts/generate-seo-assets.js` | Omite opcionais deliberadamente; o detalhe carrega a API. |

`VehicleSchemaOrg` e comparador não expõem a lista completa de opcionais. A consistência deve usar um contrato comum de catálogo/ranking, inclusive no PHP e PDFs, evitando que crawler e cliente vejam informações contraditórias.

## Recomendações

1. Resolver canônico único: aliases explícitos, peso global, família/especificidade, fonte e supressão rastreável.
2. Excluir redundâncias de ficha apenas quando o dado já está efetivamente exibido; manter o registro bruto de origem.
3. Preservar características diferentes (controle de tração não é estabilidade; alerta não é frenagem; câmera não é Park Assist).
4. Não usar anúncios de outro carro para capacidades ou equipamentos da família inteira. Pesquisa oficial deve delimitar modelo, versão, ano e mercado; opcionais de pacote dependem de prova da unidade.
5. Novas tags desconhecidas não devem ser descartadas nem interpretadas com promessas novas: usar descrição de origem, baixo peso e auditoria.
6. Tratar a divergência teto solar/panorâmico do 19903 como sincronização/nomenclatura a conferir, não remoção do equipamento confirmado pelo responsável.

Esta auditoria verifica consistência dos dados e do código, não inspeciona fisicamente os 60 carros nem certifica todo equipamento informado pelo cadastro.
# Rechecagem posterior durante a implementação

Na consulta posterior de 28/09/2026, a API pública já retornou `teto_panoramico` para a unidade 19903, em concordância com o XML. A ficha local também exibiu "Teto panorâmico". Portanto, a divergência registrada abaixo foi transitória; não foi criada uma correção fixa nem alterada a API para esse teto. Os JSONs da auditoria preservam o retrato e horário originais.
