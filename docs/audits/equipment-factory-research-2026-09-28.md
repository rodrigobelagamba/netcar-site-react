# Pesquisa de equipamentos de fábrica — 28/09/2026

Pesquisa pontual, somente de leitura, para conferir os casos levantados pela auditoria XML/API. Não certifica fisicamente os veículos nem conclui a revisão de todo o estoque. Nenhuma fonte abaixo autoriza transferir opcionais de pacote para todas as unidades da mesma versão.

## Resultado por unidade

| Unidade / mercado brasileiro | Evidência | Conclusão e ação segura |
| --- | --- | --- |
| 19788 — Nivus Highline 1.0, modelo 2024 | Manual oficial VW MY24, código 24C.5B1.NIV.66, página 293: transmissão automática de seis marchas, AQ 250, na tabela do motor 1.0 TSI. | A tag `cambio_sete` contradiz a especificação oficial. Conferir/corrigir o cadastro de origem; não converter indiscriminadamente outras tags de sete marchas. |
| 20050 — Fastback Impetus Turbo 1.0, fabricação 2024/modelo 2025 | Comunicado oficial Stellantis de 06/11/2024 apresenta a linha 2025 e a entrada do T200 Hybrid. Informa quatro airbags: dois frontais e dois laterais com proteção de cabeça e tórax. Lista AEB, assistência de permanência em faixa e comutação automática de faróis; a versão Impetus acrescenta sensores dianteiros de estacionamento. | Não contar tags genéricas/frontais/laterais/cortina como seis airbags. O responsável confirmou nesta conversa ausência de Park Assist e ACC e presença da assistência de permanência em faixa **nesta unidade**. Registro separado de confirmação, sem atribuir isso à matriz de fábrica. Confirmar se esta unidade é Hybrid antes de aplicar matriz específica dessa motorização. |
| 20051 — Civic EXL 2.0, modelo 2018 | Não foi localizada, nesta pesquisa, uma matriz oficial Honda Brasil acessível que identifique inequivocamente EXL 2018 e seus equipamentos de série/opcionais. | O responsável esclareceu nesta conversa que a única correção nesta unidade é a ausência de teto solar/panorâmico. Não acrescentar assistência de faixa ao Civic: a confirmação desse recurso foi somente para o Fastback. Quantidade de airbags continua sem complemento documental; demais equipamentos preservados conforme cadastro. |
| 19903 — T-Cross Highline 1.4, modelo 2024 | API e XML informam Park Assist. O responsável confirmou Park Assist e teto nesta unidade. Manual oficial VW MY24 abrange diferentes versões e equipamentos, sem garantir presença em cada veículo. | Preservar os dois equipamentos confirmados. Quantidade de airbags não foi enriquecida por inferência. Resolver separadamente a divergência XML/API entre teto panorâmico e solar registrada na auditoria de origem. |

## Fontes primárias consultadas

1. [VW — Manual Nivus MY24](https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-nivus/my24/24C_5B1_NIV_66_manual_de_instrucoes_nivus.pdf), página 293, dados técnicos. A identificação MY24 está na pasta oficial e no código do documento.
2. [Fiat/Stellantis — Fastback e Pulse híbridos, linha 2025](https://www.media.stellantis.com/br-pt/fiat/press/fiat-apresenta-fastback-e-pulse-hibridos-para-combinar-performance-eficiencia-e-custo-beneficio-e-se-consolidar-como-protagonista-no-futuro-da-mobilidade), 06/11/2024. Identifica expressamente a linha 2025, não apenas o ano de publicação.
3. [Fiat — Manual Fastback 2024/2025](https://servicos.fiat.com.br/content/dam/fiat/products/handbooks/376/2025/handbook-fastback-2024_2025.pdf), edição identificada em 10/10/2024. O trecho indexado E-27/E-28 descreve Cruise Control de velocidade selecionada. A leitura integral pelo extrator não foi concluída (limite de tamanho/HTTP 403); não se usa ausência no trecho como prova da inexistência de outro sistema.
4. [VW — Manual T-Cross MY24](https://www.vw.com.br/idhub/content/dam/onehub_pkw/importers/br/literatura-de-bordo/manual-t-cross/my24/T-Cross_BR_24B.5B1.TCR_66_LOW.pdf), código 24B.5B1.TCR.66. Página 6 explica a abrangência de versões e a necessidade de verificar o equipamento da unidade.

O [lançamento do T-Cross de 2019](https://newsroom-br.itd.vw.com.br/news/118) distingue equipamentos de série e pacotes opcionais, mas não é matriz do modelo 2024. O [comunicado de 16/05/2024](https://newsroom-br.itd.vw.com.br/news/2141) se refere ao novo T-Cross, linha 2025: o ano da notícia não deve ser confundido com o ano-modelo. Igualmente, o [Fastback anunciado em 28/06/2025](https://www.media.stellantis.com/br-pt/fiat/press/fiat-fastback-aprimora-design-conforto-e-tecnologia-na-linha-2026) é linha 2026 e não foi aplicado à unidade 20050.

## Regra de aprovação de enriquecimento

- Registrar marca, modelo, versão, motor, ano-modelo, mercado BR, equipamento, URL e data da pesquisa.
- **Série confirmada:** exigir fonte oficial correspondente à combinação exata; registrar a origem adicional sem apagar os dados brutos.
- **Opcional/pacote:** exigir confirmação daquela unidade (documento de fabricação, registro conferido ou confirmação responsável), além do catálogo que define o pacote.
- **Pendente:** não acrescentar ao anúncio. A falta de menção em uma lista resumida ou manual multiversões também não autoriza remoção automática.
- **Divergência comprovada:** preservar o registro bruto e gerar pendência rastreável para correção na origem, sem criar aliases globais que escondam o problema.
- Não somar categorias de airbags, inferir abertura de teto panorâmico, transformar sensor em Park Assist ou controle de velocidade em ACC.

Esta rodada não encontrou base suficiente para adicionar automaticamente novos equipamentos de série às quatro unidades. Após a conferência visual da tabela técnica, foi registrada uma única correção local homologada: no Nivus Highline Turbo 2024, motor 1.0 e câmbio automático, substituir a afirmação conflitante de sete marchas por seis. A regra exige identidade exata e a presença do item conflitante; não altera XML/API nem acrescenta transmissão a cadastros sem essa informação. Os demais pontos exigem o vínculo documental ou conferência da unidade indicado acima.
