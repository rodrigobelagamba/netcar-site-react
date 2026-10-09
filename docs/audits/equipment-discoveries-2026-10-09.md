# Descoberta de equipamentos — 09/10/2026

Foram preservados os 10 candidatos iniciais e acrescentados 9: **19 propostas para 6 unidades**, sendo 9 classificadas como série, 3 como pacote e 7 como inferência bloqueada. Há seis funções distintas fora da taxonomia anterior, com definições sugeridas apenas no arquivo de revisão. Nada deste levantamento confirma presença física, autoriza publicação ou altera ERP, XML ou `src/data`.

Os [candidatos estruturados](equipment-candidates-2026-10-09.json) incluem identidade exata, fonte, edição/data, localizador, alegação e texto sugerido. Nos sites VW/Nissan sem data editorial, `evidence.date=2026-10-09` significa **consulta**, conforme título/localizador, nunca publicação original.

## Cobertura e três camadas

Leitura pública somente: [XML](https://www.netcarmultimarcas.com.br/automacar/xml.xml), [API](https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500&offset=0) e páginas reais no navegador. XML/API tinham 70 registros; 65 com preço positivo compõem o estoque ativo do coletor. Isso não substitui situação comercial no ERP. Foram registradas 14 pesquisas documentais: 4 com fonte compatível para pelo menos uma função, 6 ambíguas e 4 sem fonte compatível obtida. As outras 51 ativas ainda não têm pesquisa documental registrada nesta rodada. O Nivus foi controle público de uma correção existente e não é contado como nova pesquisa de fábrica. O [progresso estruturado](equipment-research-progress-2026-10-09.json) permite retomar o estoque restante.

A atualização de 17:02:38 UTC encontrou XML idêntico ao primeiro snapshot e opcionais da API inalterados nos 70 registros. SHA-256 XML: `4de1a1ba1d6f22bb4c77b22c9525278dde888385701484e8689aa4e60d34006b`; Last-Modified: 09/10/2026 16:32:57 UTC. O coletor foi executado novamente às 17:09:47 UTC e os fingerprints das 12 observações persistidas coincidiram com a identidade/opcionais anteriores.

Houve 15 tentativas iniciais de ficha pública: 14 seções completas foram vistas; **12 têm evidência estruturada persistida**, originalmente observada entre 14:06:58 e 14:07:12 de São Paulo. Após reforçar o vínculo físico da unidade, as fichas 20075, 19903, 20070 e 19587 foram efetivamente reabertas e expandidas no Chrome entre 14:24:16 e 14:24:18. Há **4 observações atuais vinculadas à identificação física e 8 históricas**, preservadas com o fingerprint anterior; estas oito não contam como prova pública atual. Fastback e Civic foram vistos antes, sem captura final individual datada, e não entraram no JSON de observações. Kicks Advance teve timeout: sua ausência pública não foi concluída. Não se declara cobertura integral do estoque nem auditoria integral de equipamentos por veículo.

[Observações públicas](equipment-public-observations-2026-10-09.json) contêm `method=rendered-dom`, `expanded=true`, descrições reais, horário, URL numérica, caminho da evidência sanitizada e `stockFingerprint`. A [evidência inicial](equipment-public-dom-2026-10-09-initial.json) e a [recaptura das quatro fichas](equipment-public-dom-2026-10-09-physical-bound.json) estão incluídas neste repositório, com caminhos `evidencePath` relativos à raiz para uso na VPS; snapshots às 17:23:55 e 17:25:08 UTC confirmaram identidade e opcionais iguais antes/depois, usando hash físico fornecido pelo coletor sem gravar a placa bruta. Os fingerprints das oito capturas históricas não foram recalculados retrospectivamente. O resolver local não forneceu descrições públicas.

A coleta rolou a página até carregar “Outros equipamentos”, acionou “Ver todos os … equipamentos” e leu também os destaques em `section[aria-labelledby="vehicle-differentials-title"] h4`. A lista completa veio do contêiner associado ao título “Outros equipamentos”; textos de apresentação e “Mostrar menos” foram descartados. Falta de carregamento não equivale a falta do item.

| Unidade e identidade cadastrada | XML / API | Ficha pública real | Resultado documental |
|---|---|---|---|
| [20075 — Renegade Longitude T270](https://www.netcarmultimarcas.com.br/veiculo/20075), 2023/2024, 1.3 AT | Flags de AEB/fadiga/sem fio/AT6/chuva/keyless negativos; ponto cego/HSA/LED sem campo próprio | 40 descrições; 9 propostas não representadas | 6 de série e 3 opcionais Dark Pack; fonte BR MY2024 |
| [20070 — Renegade Longitude](https://www.netcarmultimarcas.com.br/veiculo/20070), 2021/2021, 1.8 AT | AT genérico; AT6 negativo/ausente | 37; somente AT genérico | AT6 de série, fonte BR MY2021 |
| [19903 — T-Cross Highline Turbo](https://www.netcarmultimarcas.com.br/veiculo/19903), 2023/2024, 1.4 AT | AT genérico; AT6 negativo/ausente | 44; somente AT genérico | AT6 pela tabela específica do motor no manual MY24 |
| [19587 — Tera High Turbo](https://www.netcarmultimarcas.com.br/veiculo/19587), 2025/2026, 1.0 AT | Conexão CarPlay/Android sem fio já cadastrada; conectividade nativa sem campo próprio | 37; sem fio presente, conectividade nativa não representada | Capacidade conectada de série; serviço depende de ativação/assinatura |
| [19857 — Kicks Sense Turbo](https://www.netcarmultimarcas.com.br/veiculo/19857), 2025/2026, 1.0 AT | Sem fio negativo/ausente; duas funções traseiras sem representação própria | 36; três hipóteses não representadas | 3 inferências: fonte atual é 2026/2026 |
| [20019 — Kicks Advance Turbo](https://www.netcarmultimarcas.com.br/veiculo/20019), 2025/2026, 1.0 AT | Sem fio/360 negativos; outras funções sem representação própria | Não concluída; timeout | 4 inferências: fonte atual é 2026/2026 |
| [19788 — Nivus Highline Turbo](https://www.netcarmultimarcas.com.br/veiculo/19788), 2024/2024, 1.0 AT | AT6 depende do complemento existente | 44; AT6 já aparece | Correção pública existente verificada; não repetir proposta |
| [19924 — Song Pro GS](https://www.netcarmultimarcas.com.br/veiculo/19924), 2024/2025, 1.5 híbrido AT | XML/API coletados | 48 descrições | Sem vínculo documental exato de MY para novas funções; triagem preservada |
| [20050 — Fastback Impetus Turbo](https://www.netcarmultimarcas.com.br/veiculo/20050), 2024/2025, 1.0 AT | Cadastro bruto ainda inclui tags negadas | Visto completo: sem ACC/Park Assist e com faixa; sem registro individual final | Variante convencional/Hybrid não resolvida; triagem preservada |
| [20051 — Civic EXL](https://www.netcarmultimarcas.com.br/veiculo/20051), 2018/2018, 2.0 AT | Cadastro bruto ainda inclui teto negado | Visto completo sem teto; sem registro individual final | Folheto sem MY/data editorial explícitos; triagem preservada |
| [20073 — WR-V EX](https://www.netcarmultimarcas.com.br/veiculo/20073), 2017/2018, 1.5 AT | XML/API coletados | 26; CVT já listado | Não obtida matriz oficial exata de equipamentos MY2018 |
| [20069 — Renegade T270 Turbo](https://www.netcarmultimarcas.com.br/veiculo/20069), 2023/2024, 1.3 AT | Versão comercial incompleta | 36 descrições | Não atribuir pacote Longitude à versão não resolvida |
| [20066 — Tiggo 7 Pro Max Drive Turbo](https://www.netcarmultimarcas.com.br/veiculo/20066), 2024/2025, 1.6 AT | XML/API coletados | 54 descrições | Não obtida matriz oficial BR MY2025 1.6; material 1.5 Hybrid incompatível |
| [20052 — Cronos Drive](https://www.netcarmultimarcas.com.br/veiculo/20052), 2024/2025, 1.3 AT | XML/API coletados | 32; CVT já listado | Releases encontrados MY2023/MY2026 não comprovam novos itens MY2025 |
| [20049 — Tracker LT Turbo](https://www.netcarmultimarcas.com.br/veiculo/20049), 2024/2025, 1.0 AT | XML/API coletados | 39; AT6 já listado | Não obtida matriz oficial exata MY2025 para novos itens |

“Não representado” descreve os dados coletados, não ausência física. XML e API são camadas diferentes do mesmo cadastro; concordância entre elas não confirma fábrica. O mercado está ausente no cadastro: BR é o escopo documental proposto e deve ser confirmado para a unidade.

## Fontes e confirmação pendente

**Tera 19587.** A [FAQ oficial de conectividade Volkswagen](https://www.vw.com.br/pt/volkswagen/tecnologia/conectividade.html), consultada em 09/10/2026, liga explicitamente Tera High ao MY2026 e classifica a capacidade como série. Localizador: pergunta “Quais modelos VW oferecem conectividade nativa?”, entrada Tera; perguntas de assinatura/ativação. Falta conferir capacidade instalada, funcionamento e situação de ativação da unidade. Não prometer assinatura vigente, gratuidade, Wi-Fi de passageiros ou serviços de safras posteriores. Texto: **Conectividade nativa Volkswagen** — “Preparado para serviços conectados Volkswagen, sujeitos a ativação, assinatura e disponibilidade.”

**Renegade 20075.** [Comunicado Jeep linha 2024, 20/06/2023](https://www.media.stellantis.com/br-pt/jeep/press/jeep-renegade-chega-com-sua-linha-2024-e-versao-longitude-ganha-pacote-exclusivo): parágrafos de série, transmissão e pacote Longitude. Série: frenagem de emergência, fadiga, espelhamento sem fio, AT6, partida em rampa e faróis LED. Pacote opcional Dark Pack: ponto cego, chuva e chave presencial. Conferir cada item na unidade; três opcionais exigem prova de pacote/presença, não inferência por versão. ACC/Park Assist aparecem no cadastro e na ficha; o silêncio deste comunicado não autoriza removê-los.

**Renegade 20070.** [Comunicado linha 2021, 31/07/2020](https://www.media.stellantis.com/br-pt/jeep/press/jeep-renegade-e-compass-chegam-a-linha-2021-ainda-mais-completos), tabela Longitude 1.8 Flex AT6. A [página oficial MY2021](https://www.media.stellantis.com/br-pt/jeep/renegade-my-2021) vincula a [ficha técnica da versão](https://www.media.stellantis.com/br-pt/download-model-document/140?v=1774006197), página 1, transmissão com seis marchas. Falta confirmar identidade BR e configuração da unidade; proposta AT6.

**T-Cross 19903.** [Manual BR MY24, código 24B.5B1.TCR.66](https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-t-cross/my24/T-Cross_BR_24B.5B1.TCR_66_LOW.pdf), página impressa 333/PDF 334, tabela motor 1.4 TOTALFLEX TSI: AT6 AQ250. Colofão PDF 356: fechamento 21/07/2023, Português Brasil 08/2023. A evidência é a tabela específica do motor, não a simples menção de opcionais num manual genérico. Falta confirmar identidade e unidade; proposta AT6.

**Kicks 19857/20019.** [Matriz oficial MY26](https://www.nissan.com.br/veiculos/dst-home/kicks-my26.html), consulta 09/10/2026 sem data editorial. Localizador reproduzível no HTML: `HELIOS.components.c059D`, `grades[50021-SENSE].versions[P13C-S]` ou `grades[50021-ADVANCE].versions[P13C-A]`; `equipmentSpecs` códigos `30200-I-065` (sem fio), `30200-I-551` (alerta banco traseiro), `30200-I-552` (RAEB) e, somente Advance, `0200-I-578` (360°/MOD). A matriz declara equipamento de fábrica sistemático, motor 1.0 turbo/DCT, mas `techSpecs` “Ano de produção” é **2026/2026**, contra **2025/2026** no estoque. Portanto, sete entradas permanecem inferências. Falta matriz de fabricação 2025, ficha de configuração específica ou prova equivalente e conferência física. A página comercial corrente 2026/2027 não foi aplicada. A tentativa de obter anexos de imprensa redirecionou à página inicial; nenhum XLSX foi lido.

## Textos sugeridos, ainda sem aprovação

Para itens conhecidos, nome e benefício abaixo preservam o resolver. A ausência de benefício existente não foi preenchida com promessa nova.

| Item / aplicação | Descrição sugerida |
|---|---|
| Frenagem automática de emergência — 20075 | Pode acionar os freios em uma situação de risco detectada pelo sistema. |
| Indicador de fadiga — 20075 | Emite avisos de atenção ao motorista. |
| Android Auto e Apple CarPlay sem fio — 20075; hipótese em 19857/20019 | Integra celulares compatíveis à central por Android Auto e Apple CarPlay sem cabo. |
| Câmbio automático de 6 velocidades — 20075/20070/19903 | Sem benefício adicional no catálogo atual. |
| Alerta de ponto cego — 20075, pacote | Avisa sobre veículos detectados na região de ponto cego. |
| Sensor de chuva — 20075, pacote | Sem benefício adicional no catálogo atual. |
| Chave presencial (Keyless) — 20075, pacote | Acesso ao veículo com a chave presencial. |
| Assistente de partida em rampa — 20075, novo | Ajuda a manter o veículo parado por instantes ao iniciar uma subida. |
| Faróis de LED — 20075, novo | Iluminação principal dos faróis com tecnologia LED. |
| Alerta de objetos no banco traseiro — hipótese 19857/20019, novo | Lembrete para conferir o banco traseiro ao sair do veículo. |
| Frenagem traseira com detecção de pedestres (RAEB) — hipótese 19857/20019, novo | Pode auxiliar na frenagem durante manobras de ré ao detectar risco de colisão, respeitados os limites do sistema. |
| Visão 360° com detecção de objetos em movimento — hipótese 20019, novo | Ajuda a visualizar o entorno e alerta sobre objetos em movimento durante manobras. |

A definição de conectividade Tera consta acima. As seis definições novas estão em `item.reviewedDefinition`, como rascunho validado estruturalmente, com aliases restritos. O nome do campo não representa aprovação humana. A revisão ainda precisa confirmar presença, mercado, aplicação da fonte, texto e autorização de publicação; presença isolada não autoriza publicar. Um “não” ou adiamento deve ficar no histórico do item/unidade.

## Triagem preservada e limites

As seis hipóteses anteriores para Fastback, Civic e Song Pro continuam em `../equipment-review-2026-10-09/research-fiat-honda-byd.json`, com `eligibleForEquipmentEvidence=false`. Não foram descartadas nem promovidas a evidência exata. O [lançamento Fiat híbridos de 06/11/2024](https://www.media.stellantis.com/br-pt/fiat/press/fiat-apresenta-fastback-e-pulse-hibridos-para-combinar-performance-eficiencia-e-custo-beneficio-e-se-consolidar-como-protagonista-no-futuro-da-mobilidade) não resolve a variante do Fastback. O [folheto Honda](https://www.honda.com.br/automoveis/sites/hab/files/2019-06/%5BHONDA%5DCampanha%20Civic%202018_Folheto%20EXL_R8%20%281%29.pdf), página 15/16, não fornece ano-modelo/data editorial explícitos; o nome do arquivo não basta. O [lançamento Song Pro de julho/2024](https://www.byd.com/br/noticias-byd-brasil/a-familia-cresceu-BYD-Song-Pro-chega-ao-Brasil) não vincula suas funções ao MY2025; o [comunicado de 07/07/2025](https://www.byd.com/br/noticias-byd-brasil/byd-lanca-dolphin-mini-azul-e-song-pro-com-adas-completo) introduz ADAS no MY2026 e não pode ser retroaplicado. Acessórios portáteis exigem conferir se acompanham o seminovo.

Confirmações negativas anteriores de Fastback e Civic continuam válidas. Falta de fonte compatível permanece registrada como pendência, nunca como “veículo sem equipamento” ou “estoque revisado”. A pesquisa inicial Jeep/VW também foi mantida em `../equipment-review-2026-10-09/research-jeep-vw.json`.

## Fila de decisão desta rodada

Os números abaixo são estáveis nesta rodada. Uma resposta pode confirmar presença sem autorizar exibição. Exemplo: “20075: itens 1 e 5 presentes, inclua somente o 5; não inclua o 2”. As sete dúvidas Nissan aguardam documentação compatível antes da proposta de publicação.

1. **20075 — Frenagem automática de emergência** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
2. **20075 — Indicador de fadiga** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
3. **20075 — Android Auto e Apple CarPlay sem fio** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
4. **20075 — Câmbio automático de 6 velocidades** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
5. **20075 — Assistente de partida em rampa** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
6. **20075 — Faróis de LED** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
7. **20075 — Alerta de ponto cego** (pacote opcional). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
8. **20075 — Sensor de chuva** (pacote opcional). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
9. **20075 — Chave presencial (Keyless)** (pacote opcional). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
10. **19903 — Câmbio automático de 6 velocidades** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
11. **20070 — Câmbio automático de 6 velocidades** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
12. **19587 — Conectividade nativa Volkswagen** (série documentada). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
13. **19857 — Android Auto e Apple CarPlay sem fio** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
14. **19857 — Alerta de objetos no banco traseiro** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
15. **19857 — Frenagem traseira com detecção de pedestres (RAEB)** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
16. **20019 — Android Auto e Apple CarPlay sem fio** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
17. **20019 — Alerta de objetos no banco traseiro** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
18. **20019 — Frenagem traseira com detecção de pedestres (RAEB)** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
19. **20019 — Visão 360° com detecção de objetos em movimento** (informação insuficiente). Esse carro tem este equipamento? Se tem, quer que eu inclua no site?
