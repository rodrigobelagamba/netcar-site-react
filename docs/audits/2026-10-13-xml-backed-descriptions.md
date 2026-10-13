# Descrições alinhadas ao cadastro — 13/10/2026

O responsável autorizou corrigir as descrições tomando o XML como referência.
A releitura comparou os 63 veículos ativos do XML, da API e das fichas públicas:
as listas estruturadas coincidiam com os 2.348 equipamentos resolvidos, mas 23
das 24 descrições livres continham 73 ocorrências sem respaldo ou contraditórias.
Isso não significa 73 defeitos físicos: parte das afirmações simplesmente não
tem campo correspondente na exportação. A correção limita o que o site afirma.

## Origem e decisão

- XML: `https://www.netcarmultimarcas.com.br/automacar/xml.xml`, coletado em
  2026-10-13T19:53:23Z; SHA-256
  `f4c4f589b39ca67bbbb9b12df20eb68d65f84a603ac8d5daaf4122f51cbf6834`.
- API: `https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500&offset=0`.
  Todos os 2.701 opcionais da API correspondiam a marcações positivas do XML.
- As 73 ocorrências foram confirmadas no texto público: 3 contradições diretas,
  22 marcações ausentes, 47 afirmações sem campo exportado e 1 nota editorial.
- O texto livre de `anuncio.php` deixa de ser consumido pela ficha. A descrição
  passa a usar identidade, motor, combustível e câmbio do cadastro, além dos
  rótulos de equipamentos do resolver compartilhado. Não há filtragem parcial
  por palavras nem inferência de características pelo modelo.
- Todas as 63 fichas recebem essa apresentação; as 39 sem texto livre também
  podem exibir seus dados estruturados. A expansão acessível é preservada.
- XML, API e ERP não foram alterados. Correções revisadas por unidade continuam
  prevalecendo: Renegade 20075 sem Park Assist e com os cinco itens confirmados,
  Fastback 20050, Civic 20051 e a correção documental de câmbio do Nivus 19788.

## Regressões verificadas

Argo 19687 exibe automático/CVT; ix35 19653, direção hidráulica e bancos em couro.
HR-V Advance 19854 não recebe bancos aquecidos, estabilidade ou partida em rampa
por texto livre. T-Cross 19750 e HR-V 19898 não ganham duas zonas a partir de ar
digital. A nota editorial do City 19688 deixa de ter caminho de renderização.

Os testes também cobrem alterações posteriores no cadastro, negativos explícitos,
isolamento da confirmação por identidade física, ausência de dados e tentativa
de contaminar a descrição com texto GPT. Fixture de regressão sanitizada com
sete veículos; nenhum identificador físico bruto, preço ou contato.

Validação local: `npm run stock:test-equipment` (108 passaram; 3 testes PHP
indisponíveis neste ambiente), os 6 testes de `vehicle-description.test.tsx`,
`npm run lint` e `npm run build`. O CI executa também as verificações PHP.

## Escopo de publicação

Base `2241301`: o blog automático desse commit já estava publicado, confirmado
pela igualdade integral dos dez posts no asset público `blog-DW1AZSdN.js`.
Nenhuma alteração de blog integra esta correção. A rotina diária existente na
VPS permanece responsável pela auditoria; não foi criado agendamento no Codex.
