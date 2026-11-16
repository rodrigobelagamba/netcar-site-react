# Nomes de cores na ficha do veículo

## Autorização contínua de 16/11/2026

O responsável autorizou o ROTINAS a conferir o XML atual, pesquisar o nome de
fábrica a partir da cor padrão e aplicar/publicar somente cores confirmadas na
ficha do site, acompanhando também os veículos novos, como nos carimbos de
garantia. Não pedir nova aprovação de publicação por unidade dentro deste escopo.
Essa autorização não é confirmação física da pintura de nenhum carro.

A cor da API/XML/ERP permanece intacta, inclusive nos filtros, feeds e laudos.
Somente o valor “Cor” da ficha usa o resolver compartilhado
src/lib/vehicleColor.ts. Um nome validado substitui o texto genérico na ficha;
ausência, incompatibilidade ou ambiguidade mantém a string original.
Nenhuma imagem é recolorida. Não alterar preços, equipamentos ou outras tarefas.

## Evidência

Cada confirmação no registro src/data/vehicle-color-confirmations.json vincula
ID e chave física opaca, marca/modelo/versão, fabricação/ano-modelo, motor,
câmbio, combustível e cor original. Mudança nesses dados invalida a aplicação.
Há dois fundamentos distintos, identificados em verificationBasis:

1. unit-evidence: código de pintura, documento individual de fábrica ou
   confirmação explícita do responsável. Não inventar um ateste nem converter
   uma aprovação de publicação em confirmação do tom.
2. catalog-match: correspondência documental única entre a cor do XML e a
   paleta completa oficial da montadora para a versão e ano-modelo brasileiros
   exatos. Usa evidence.kind=catalog-unique-match, verifiedBy=catalog-review e
   evidence.catalog com mercado BR, escopo exato, complete=true, todas as cores
   da paleta e URLs HTTPS das fontes primárias. O resolver exige uma única cor
   compatível e nome idêntico ao registro. Isso é uma inferência documental do
   nome comercial, não autenticação física da pintura.

Paleta de outro ano/país/versão, anúncio de terceiro ou foto não bastam.
Uma fonte citando apenas um tom não demonstra exclusividade. Se houver duas
tintas compatíveis com a cor genérica (por exemplo, dois brancos), manter a cor
original até obter evidência que resolva a diferença. Considerar séries,
opções de pintura e configurações bicolores quando afetarem a identificação.
Uma divergência entre XML e API impede a aplicação até reconciliação.

Guardar fontes, escopo, alternativas e justificativa na auditoria; o JSON do
frontend contém só informações públicas e referências opacas de autorização.
Não guardar placa, VIN, contatos, documentos ou nomes de pessoas no registro.
Evidência documental integral privada permanece fora do repositório.

## ROTINAS e entradas de estoque

Usar a automação existente carimbos-e-entradas-do-estoque-netcar, no chat ROTINAS.
Nos ciclos de 08h, 11h, 14h, 17h, 19h e 22h (America/Sao_Paulo):

- Ler XML atual e API completa sem cache, comparar cor padrão e identidade e
  detectar entradas, alterações e confirmações incompatíveis.
- Reutilizar pesquisa oficial compatível, mas gerar confirmação vinculada à
  unidade atual; não transportar atestes físicos entre carros.
- Pesquisar entradas e pendências sem fonte suficiente. Registrar estado mínimo,
  fontes e assinaturas para evitar repetir a mesma pesquisa/aviso a cada ciclo.
  Uma leitura parcial ou falha não substitui o estado anterior.
- Publicar as confirmações concluídas no mesmo ciclo, isolando somente cores
  autorizadas e preservando alterações alheias. Não bloquear confirmações válidas
  porque outra unidade permanece ambígua.

A auditoria scripts/audit-vehicle-equipment.ts já produz color, colorReviewKey,
colorChange e researchQuery, sem invalidar revisões de equipamentos. Reutilizar
essa infraestrutura; não criar outro cron/importador/coletor na VPS.
Respeitar as restrições de interface do ROTINAS: Chrome pessoal somente nas
janelas de 08h, 19h e 22h; pesquisa/API e navegador isolado em segundo plano
podem funcionar nos demais ciclos.

## Publicação, validação e reversão

Executar testes de cor/auditoria, lint, typecheck e build. Levar apenas a mudança
autorizada a master; aguardar Deploy DevOps panel, conferir commit e jobs ativos
em GET /api/status e usar POST /api/deploy/local. Acompanhar o mesmo job até o
término e verificar o nome renderizado na ficha pública, além de HTML/assets.
Sucesso de CI/build sozinho não comprova publicação.

Reimportar o XML não apaga confirmações nem as transfere para outro carro.
Reversão: retirar o registro específico ou reverter somente a release de cores,
preservando o histórico e mudanças de outras tarefas.
