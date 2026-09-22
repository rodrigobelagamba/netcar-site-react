# Conversão e conteúdo rastreável — 22/09/2026

Status: implementado e validado localmente; publicação dos três itens aprovada.
Push e deploy aguardam confirmação do escopo preexistente em master (ver abaixo).
Base: `master` em `4284f52`. Branch: `codex/seo-conversion-2026-09-22`.

## Escopo aprovado: itens 1, 2 e 3

1. Comparador: acesso à ficha e WhatsApp individual; identificação inequívoca
   das unidades no contato individual e conjunto (modelo/ano, código, placa
   mascarada quando disponível, URL pública). Mantidos os eventos existentes,
   limite de quatro veículos e ausência de quilometragem na comparação.
2. Páginas existentes por modelo/perfil/orçamento: estoque real antes dos textos
   longos, ordem A–Z, links mantendo filtros, estados de carregamento e falha,
   descrições duráveis e correção da falsa indisponibilidade com uma unidade.
   Corrigido também o espaçamento sob o cabeçalho no celular. Nenhuma URL nova.
3. `/compra` e `/blog`: alinhamento de títulos e conteúdo HTML para rastreadores
   com as páginas React; índice do blog gerado da mesma coleção de artigos.
   Critérios de compra direta e exceção para troca preservados.

## Validação

- Build completo (`npm run build`) aprovado.
- TypeScript, geração/validação SEO e build Vite novamente aprovados após QA visual.
- 4 testes de mensagens do comparador e 4 de textos/filtros das landings aprovados.
- Renderização PHP de `/compra` e `/blog` validada em PHP 7.4 e 8.2.
- Validadores de rastreamento, atribuição e contatos regionais aprovados.
- Comparador e landing de automáticos até R$ 80 mil conferidos em celular e desktop.
- CTA da landing manteve os filtros no estoque: 6 disponíveis; vitrine também
  mostrou 8 vendidos, conforme comportamento preexistente de `/seminovos`.
  A diferença entre 6 e 14 não foi tratada como erro de filtragem.
- WhatsApp conferido pelo destino/mensagem, sem enviar conversa.

## Prévia e publicação

Prévia local: `http://127.0.0.1:4188/comparar` e
`http://127.0.0.1:4188/comprar-automaticos-ate-80-mil`.

O clone independente foi necessário porque o worktree compartilhado falhou com
`mmap failed: Operation canceled`. Não publicar outros checkouts ou alterações
de outras tarefas junto desta entrega. Os arquivos de estoque/iCHECK gerados
incidentalmente no teste foram retirados do diff; o build da VPS os regenera.

## Conferência pré-publicação

O painel informa último deploy completo em `62891a1`, embora existam publicações
incrementais posteriores da galeria. `master` está em `4284f52`; entre as versões
há mudanças de outras tarefas (galeria, avaliações e foto da entrega do Tiago na
home). A comparação do módulo público da galeria confirma equivalência com a
versão local, ignorando hashes de imports. Não foi possível confirmar a mesma
equivalência para a home. Um deploy completo da master inclui essas mudanças.
Não publicar esse conjunto adicional sem esclarecer a aprovação; não reverter
ou remover mudanças das outras tarefas para contornar o problema.

Publicar usando o procedimento do `AGENTS.md` após resolver essa confirmação.
Sem promessa de ranking ou aumento de leads: os efeitos precisam ser medidos
após publicação, separando cliques, contatos e vendas.
