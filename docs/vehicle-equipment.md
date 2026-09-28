# Equipamentos: origem, relevância e verificação

## Regra de apresentação

`src/lib/vehicleEquipment.ts` é a fonte única de ordenação e deduplicação para a ficha, os destaques e os relatórios i-CHECK. Os pesos dos 112 tipos auditados ficam em `src/data/vehicle-equipment-catalog.json`; peso maior aparece primeiro. Não criar mapas locais de prioridade.

O ranking considera utilidade e diferenciação na compra: quantidade comprovada de airbags, ACC, frenagem automática, sete lugares e Park Assist no topo; teto, câmeras e conforto relevante vêm antes de equipamentos básicos e documentos. ABS, travas e airbags genéricos não devem ocupar todos os destaques só por serem itens de segurança.

Itens já explicados nos destaques não se repetem na lista. Câmbio automático e motor turbo genéricos não reaparecem quando a informação já está explícita na ficha. Recursos específicos (ex.: quantidade de marchas) não são descartados como se fossem sinônimos do câmbio genérico.

Descrições explícitas têm precedência sobre tags legadas. Desconhecidos continuam visíveis, no final, sem benefícios inventados. Não converter sensores em Park Assist, controlador de velocidade em ACC, multimídia em CarPlay sem fio, nem teto panorâmico em teto com abertura.

## Pesquisa obrigatória antes de complementar um cadastro

1. Identificar marca, modelo, **versão**, motor, mercado brasileiro e **ano-modelo**, não apenas fabricação ou data da notícia.
2. Pesquisar catálogo/ficha técnica oficial daquela combinação. Um manual multiversões explica como usar recursos, mas não prova que todos sejam de série. Não usar anúncios de outras lojas como comprovação.
3. Registrar URL, data de revisão, página/tabela aplicável, identidade exata e conclusão em `docs/audits/`. Guardar também lacunas e divergências; não chamar uma revisão pontual de auditoria completa dos equipamentos de fábrica.
4. Só cadastrar complemento em `src/data/vehicle-equipment-evidence.json` quando a fonte comprovar **item de série** para a combinação exata. A regra exige aprovação explícita e não deve aceitar faixas de anos, famílias genéricas ou versão incompleta.
5. Pacotes e acessórios opcionais exigem confirmação **da unidade**: cadastro conferido, documento de fabricação ou responsável. Jamais propagar a confirmação de um carro para os demais da versão.
6. Se houver dúvida, não acrescentar o equipamento. Falta de menção em um manual ou lista resumida também não prova ausência. Solicitar conferência no cadastro de origem.
7. Preservar XML/API brutos. Correções locais devem ter prova, escopo restrito e teste contra modelos/anos/motores diferentes. Encaminhar a divergência para correção na integração/ERP, que não pertence a este repositório.

Não somar categorias de airbags para deduzir quantidade. Usar número somente se explícito ou comprovado. É permitido reunir categorias já informadas (frontais, laterais, cortina) sem deduzir seis ou oito bolsas.

## Confirmações de uma unidade

Registrar confirmações do responsável em `src/data/vehicle-equipment-confirmations.json`, com data, declaração e identidade completa: código, marca, modelo/versão, ano-modelo, motor e câmbio. Manter um registro ativo por unidade. A confirmação não é evidência de equipamento de série e nunca se estende a outro código, mesmo da mesma versão.

Essa camada prevalece sobre XML/API desatualizados, sem modificar os dados brutos. Presenças e ausências usam identidades canônicas do catálogo e deixam a evidência rastreável no resultado. Não ampliar uma resposta para equipamentos que o responsável não confirmou.

Confirmado em 28/09/2026: Fastback 20050 tem assistência de permanência em faixa, mas não Park Assist nem piloto adaptativo. No Civic 20051, a única correção confirmada é a ausência de teto solar/panorâmico; não acrescentar assistência de faixa nem alterar os demais equipamentos. Piloto convencional e sensores de estacionamento não são equivalentes a ACC e Park Assist.

## Novos veículos e novas tags

O site **não pesquisa a internet nem acrescenta equipamentos automaticamente** quando recebe um carro. Itens ainda não verificados permanecem como informados pelo cadastro. Ao revisar uma nova combinação de modelo/ano/versão, repetir o procedimento acima; uma evidência antiga não certifica todo o veículo.

Ao surgir uma tag nova, conferir o significado na taxonomia real da API, adicionar peso explícito e testes, sem adivinhar pelo nome. Há aliases históricos contraintuitivos (documentados na auditoria de 28/09/2026).

A rotina diária do DevOps gerencia essa conferência: coleta o cadastro, sinaliza mudanças/divergências e mantém pareceres por conteúdo auditado. Não acrescenta equipamentos ou publica automaticamente. Operação, limites e ativação em `docs/equipment-daily-audit.md`.

## SEO e testes

O HTML para crawlers usa um snapshot de equipamentos gerado pelo mesmo resolver. Só pode aproveitá-lo quando a assinatura do cadastro atual coincide; dados alterados precisam de novo build e não devem receber complementos antigos. O manifesto schema 2 identifica também as unidades com confirmação: em caso de divergência nessas unidades, a lista de equipamentos SEO é omitida até a regeneração, em vez de republicar informações já negadas. Manifesto ausente, inválido ou antigo também omite a lista. Nas demais unidades, um snapshot desatualizado pode usar a lista bruta conservadora. Os demais dados da página não são removidos.

Executar `npm run stock:test-equipment`, `npm run lint` e `npm run build`. Conferir a ficha no navegador. Não publicar sem aprovação; seguir as instruções de deploy do projeto.

## Limite da auditoria de 28/09/2026

Foram comparados XML/API de 69 registros, catalogadas 112 tags e criados testes com 60 veículos ativos. A pesquisa de fábrica foi **pontual**, priorizando T-Cross 19903, Nivus 19788, Fastback 20050 e Civic 20051. Isso não é certificação física nem revisão de todos os catálogos do estoque.
