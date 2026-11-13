# Identidade Netcar — implementação local de 13/11/2026

Base: `7436be97` de `origin/master`, clone isolado do repositório
`rodrigobelagamba/netcar-site-react`, branch `codex/netcar-identity-nov13`.
Este relatório descreve a versão preparada; commit, publicação e verificação
externa são registrados na auditoria geral.

## Apresentação e destino das novas interações

A unidade da Av. Presidente Vargas, 740 aparece como **Netcar Multimarcas**.
A unidade do nº 1106 pode continuar identificada como **Filial**. Os nomes de
endereço, fotos e cadastros próprios distinguem as duas unidades.

Conforme a orientação final do responsável, os novos pedidos de avaliação e
botões institucionais de Google direcionam ao perfil principal do nº 740.
Essa regra não altera a origem de avaliações já publicadas, nem os links de
localização e rota específicos da filial.

## Inventário e decisões

| Item | Antes | Versão preparada | Estado |
| --- | --- | --- | --- |
| Nome institucional | WebSite, cabeçalho, títulos e og:site_name já usavam Netcar Multimarcas | Preservados; títulos descritivos por página continuam iguais | Preservado |
| Unidade nº 740 no schema | Netcar Multimarcas - Loja 1 nos quatro caminhos de renderização | Netcar Multimarcas; mesmos @id, branchCode, endereço, contato e URL | Alterado em rascunho |
| Filial nº 1106 no schema | AutoDealer próprio: Netcar Multimarcas - Loja 2 | Nome cadastral e parentOrganization preservados | Preservado |
| Equivalência de entidades | Organization.sameAs incluía os dois perfis Maps | Instagram/Facebook permanecem na organização; hasMap continua em cada unidade | Alterado em rascunho |
| Contato, rodapé, sobre, mapa, galerias e páginas regionais | Rótulos Loja 1/Loja 2 | Netcar Multimarcas e Filial, com endereços explícitos; destaque comercial do nº 740 | Alterado em rascunho |
| Artigos existentes | Dois parágrafos qualificavam a unidade do nº 740 | Nome institucional ou unidade nº 740; restante dos artigos preservado | Alterado em rascunho |
| Perfil vs. rota | Busca textual pelo nome antigo | Abertura do perfil por CID confirmado; Como chegar usa /maps/dir/ com endereço completo | Alterado em rascunho |
| Novas avaliações | Link global legado sem identificação clara de unidade | Botão direto para o link oficial de escrever avaliação do perfil principal nº 740; endereço visível | Alterado em rascunho |
| Botões gerais Google | Algumas telas ligavam total conjunto ao destino da última filial | Novas interações gerais vão ao perfil principal; total conjunto continua identificado como das duas unidades quando comprovado | Alterado em rascunho |
| Depoimentos existentes | Avaliações das duas unidades, com reviewUrl/locationTitle individuais | Texto, nota, origem, fotos e links individuais preservados; sem fallback global que mudava sua atribuição | Preservado e corrigido |
| Contatos do rodapé | Endereço desaparecia se a API não retornasse dados | Fallback com os dois endereços já confirmados | Alterado em rascunho |
| HTML para crawlers | Dois números juntos e somente um telefone | Endereços e telefone próprio da filial explícitos | Alterado em rascunho |
| Datas no sitemap | Data antiga persistida para páginas SPA alteradas | Mínimo versionado de 13/11/2026 somente para /, /sobre e /contato, usado pelos dois geradores | Alterado em rascunho |

## Identificadores e links confirmados

| Unidade | Perfil | Escrever avaliação |
| --- | --- | --- |
| Netcar Multimarcas — nº 740 | `https://maps.google.com/maps?cid=9144067949621682127` | `https://g.page/r/Cc8fPFNaQeZ-EBM/review` |
| Filial — nº 1106 | `https://maps.google.com/maps?cid=10839197980729051544` | `https://g.page/r/CZiJfIsikWyWEBM/review` |

Links de escrever avaliação obtidos nos respectivos painéis GBP autenticados em
13/11/2026. Não foram derivados de CID ou Place ID. `GOOGLE_PRIMARY_PROFILE`
centraliza o destino do nº 740 para novas ações comerciais e avaliações.
O cadastro da filial permanece disponível para localização e para preservar a
atribuição das experiências anteriores; ele não é usado como CTA institucional
para novas avaliações.

## Preservações

- IDs loja1/loja2, Loja1/Loja2, loja-1/loja-2 e loja_1/loja_2 permanecem estáveis.
- CEPs, coordenadas, horários, telefones, WhatsApp e endereços conferidos não foram
  adivinhados nem transferidos entre unidades.
- WebSite único, canonical, domínio, URLs, verificações, Analytics, GTM, Meta,
  consentimento, formulários e eventos de conversão não foram recriados.
- Não havia aggregateRating na marcação existente. Nenhuma nota, avaliação ou
  atribuição foi fabricada.
- URLs oficiais NetcarRC, dados históricos, IDs internos e o topônimo verdadeiro
  Parque da Matriz em Cachoeirinha permanecem. Não houve substituição global.
- Nenhuma foto foi removida ou alterada. Duas galerias de lojas, imagens de
  veículos, fotos de clientes, ativos e regras de carregamento permanecem.
  Fachadas public/images/loja1.webp e loja2.webp têm os mesmos hashes no dist.
- Nethelp, política comercial, garantias, contratos e razão social preservados.

## Validação

- Build completo com `NETCAR_SKIP_PHOTO_BUILD=1 npm run build`, incluindo
  TypeScript, SEO, estoque, garantias, tracking, GBP, contatos regionais e catálogo.
- `npm run lint` e `git diff --check`.
- 26 testes de galeria/perfis/rotas; 3 testes do CTA principal e preservação de
  origem; 2 testes de botões regionais/escopo; 3 testes de lastmod.
- 5 testes existentes do cabeçalho e verificação do CID principal no validador de
  contato regional.
- Validador SEO confere nomes das entidades e proíbe perfis locais em
  Organization.sameAs.
- Datas posteriores ao mínimo versionado não retrocedem; URLs fora do registro
  mantêm sua data. O build não usa prioridade entre lojas para canonical/sitemap.
- Prévia de dist: `http://127.0.0.1:4173/`, enquanto o processo estiver ativo.
  Verificação visual e publicação pertencem à auditoria geral.
- Testes PHP específicos são registrados pela auditoria de integrações.

Artefatos de estoque, blog automático e autocheck gerados fora do escopo foram
retirados do diff. Imagens não foram excluídas nessa limpeza. Os diretórios
ignorados de dist/SEO estático permanecem para a prévia local.

## Retorno

Antes da publicação, descartar somente o diff desta branch. Após commit aprovado,
reverter esse commit pelo fluxo DevOps, preservando mudanças posteriores alheias.
Reverter o código não reverte automaticamente análise, indexação nem o nome do
Google. A auditoria geral registra o estado real dessas etapas externas.
