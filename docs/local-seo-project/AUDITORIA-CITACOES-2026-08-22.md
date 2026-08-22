# Auditoria de citações externas e NAP — Netcar Multimarcas

Coleta: 22/08/2026, das 14h30 às 14h42, no fuso America/Sao_Paulo.

Escopo: conferência pública de portais de veículos, redes sociais, agregadores e diretórios encontrados para a Netcar. O objetivo é corrigir dados controláveis e priorizar fontes que clientes realmente utilizam. A NaPista foi mantida fora desta demanda por decisão anterior da Netcar.

## Resultado executivo

O cadastro ativo da AutoCarro está coerente com a Loja 2 e não exige alteração. A Webmotors identifica corretamente a marca e Esteio, mas não expõe endereço e telefone suficientes para validar o NAP interno pela superfície pública.

As três correções prioritárias são:

1. associar o telefone da Loja 1 ao endereço 740 no Facebook;
2. remover o CEP único da linha que reúne as duas lojas no Instagram;
3. substituir `Whatsapp Online 24h` por `Netcar Multimarcas` no Linktree e organizar os links de conversão.

Essas correções não exigem Google Ads, mídia paga nem deploy do site. Dependem apenas de acesso administrativo às respectivas contas. Não há evidência suficiente para afirmar que isoladamente mudarão o ranking; o ganho esperado é reduzir ambiguidade de entidade, melhorar confiança e atribuição e evitar informação conflitante para o cliente.

## NAP canônico

| Entidade | Endereço | CEP | Telefone |
|---|---|---|---|
| Netcar Multimarcas — Loja 1 | Av. Presidente Vargas, 740, Esteio/RS | 93260-490 | (51) 3473-7900 |
| Netcar Multimarcas — Loja 2 | Av. Presidente Vargas, 1106, Esteio/RS | 93260-048 | (51) 3033-3900 |
| Operação integrada | duas lojas a aproximadamente 400 m, com estoque e atendimento compartilhados | não usar um CEP único para os dois endereços | WhatsApp (51) 99729-3118 |

Site canônico: `https://www.netcarmultimarcas.com.br`.

## Matriz de citações observadas

| Fonte | Situação observada | Divergência | Evidência | Prioridade | Ação | Estado |
|---|---|---|---|---|---|---|
| [AutoCarro](https://m.autocarro.com.br/netcar-rc) | `NETCAR`, nº 1106, Esteio; (51) 3033-3900 e WhatsApp com os dígitos atuais; 56 veículos e atualização em 22/08 | nenhuma no cadastro ativo; o WhatsApp aparece agrupado como `9972-93118`, mas contém os dígitos corretos | comprovado na página e no botão `Fones` | nenhuma | manter e monitorar | conferido |
| [Webmotors](https://www.webmotors.com.br/carros/rs/loja.netcarrc-veiculos-ltda-3468461) | `NETCAR` e inventário em Esteio/RS | endereço e telefone não são exibidos na superfície pública consultada | comprovado para nome/cidade; sem evidência suficiente para o NAP interno | média | conferir dados cadastrais na próxima sessão administrativa do portal | pendente de acesso |
| [Facebook](https://www.facebook.com/NetcarRC) | `Netcar RC`; endereço público nº 740; telefone público (51) 3033-3900; apresentação cita 740 e 1106 | o telefone da Loja 2 está associado ao endereço da Loja 1 | comprovado na página pública | alta | trocar o telefone da localização 740 para (51) 3473-7900 | pendente de login |
| [Instagram](https://www.instagram.com/netcar_rc/) | endereço público `Av Presidente Vargas, 740 e 1106, Esteio 93260-048` | o CEP da Loja 2 parece atender também o nº 740 na linha compartilhada | comprovado na página pública | alta | usar `Av. Presidente Vargas, 740 e 1106 · Esteio/RS`, sem CEP único | pendente de login como `@netcar_rc` |
| [Linktree](https://linktr.ee/netcar_rc) | título público `Whatsapp Online 24h`; WhatsApp e site em HTTP; somente a rota da Loja 1; link de Spotify em destaque | identidade da página não é Netcar e a Loja 2 não possui rota | comprovado na página pública | alta | aplicar a estrutura de links definida abaixo | pendente de login |
| [AppLocal](https://applocal.com.br/empresa/netcar-multimarcas/esteio/rs/8733005) | nº 1106 associado a São Sebastião e CEP 93260-000; cadastro não verificado | bairro e CEP incorretos para a Loja 2 | comprovado no resultado público; mecanismo de correção existe, mas a página impôs desafio Cloudflare | média | reivindicar/alterar para Centro, 93260-048, telefone da Loja 2, site e WhatsApp | pendente |
| [Creditas — correspondentes, abril/2026](https://assets.ctfassets.net/n3x4bsh5l2so/mXVtQMKmS5LhWDwIOQasj/82658fc413e1673e501acece064d7d69/Correspondentes_Bancarios_Creditas-Abril_2026.pdf) | entidade ativa no nº 740, Tamandaré, CEP 93260-490; telefone (51) 99887-9281 | endereço está correto; WhatsApp está desatualizado | comprovado no documento do parceiro | média | solicitar ao contato comercial da Creditas a troca pelo WhatsApp atual | pendente do relacionamento comercial |
| [Justos](https://justos.com.br/concessionarias/esteio/tres-portos) | duas lojas com `Av. Getúlio Vargas`, CEPs e avaliações antigas | rua, CEP e dados reputacionais desatualizados | comprovado na página agregadora | baixa | solicitar atualização somente se houver canal de correção; não priorizar sobre superfícies controláveis | sem canal identificado |
| [Econodata](https://www.econodata.com.br/consulta-empresa/12999974000100-netcar-multimarcas-ltda) | antigo CNPJ do nº 1106 aparece como baixado desde 09/12/2025 | não é uma citação comercial ativa; é um registro histórico correto para aquela pessoa jurídica | comprovado na página cadastral | nenhuma | não solicitar que o registro baixado seja apresentado como ativo | sem ação |

### Resultados históricos

Buscas ainda recuperam anúncios antigos da AutoCarro, Mercado Livre, NaPista e versões antigas do próprio domínio com telefone ou logradouro anteriores. Isso comprova persistência no índice, não erro do cadastro ativo atual. Corrigir a fonte atual e aguardar novo rastreamento é mais seguro do que tentar controlar todas as cópias de anúncios encerrados.

Classificação do possível efeito desses resíduos no ranking local: **hipótese fraca**. Eles podem gerar ambiguidade, mas não há evidência causal suficiente.

## Conteúdo exato das correções prioritárias

### Facebook

Manter a página como presença da marca e manter os dois endereços no texto de apresentação. Como o campo público de localização está no nº 740, o telefone mostrado junto dele deve ser:

`(51) 3473-7900`

Não criar uma página duplicada para a Loja 2 apenas para SEO. Se futuramente a Meta permitir cadastrar as duas localizações reais sob a mesma marca, cada localização deve receber seu próprio endereço e telefone.

### Instagram

Linha de localização recomendada:

`Av. Presidente Vargas, 740 e 1106 · Esteio/RS`

Não usar um CEP único na linha compartilhada. Caso a interface permita duas localizações completas, registrar separadamente:

- Loja 1 — Av. Presidente Vargas, 740 — CEP 93260-490;
- Loja 2 — Av. Presidente Vargas, 1106 — CEP 93260-048.

### Linktree

Título:

`Netcar Multimarcas`

Descrição:

`Seminovos em Esteio/RS desde 1997 · Lojas 1 e 2 na Av. Presidente Vargas`

Ordem recomendada:

1. **Ver seminovos** — `https://www.netcarmultimarcas.com.br/seminovos?utm_source=instagram&utm_medium=organic_social&utm_campaign=link_bio&utm_content=estoque`
2. **Falar no WhatsApp** — `https://wa.me/5551997293118?text=Ol%C3%A1%21%20Vim%20pelo%20Instagram%20da%20Netcar.`
3. **Como chegar — Loja 1** — `https://www.google.com/maps?cid=9144067949621682127&hl=pt-BR`
4. **Como chegar — Loja 2** — `https://www.google.com/maps?cid=10839197980729051544&hl=pt-BR`
5. **Venda seu carro** — `https://www.netcarmultimarcas.com.br/compra?utm_source=instagram&utm_medium=organic_social&utm_campaign=link_bio&utm_content=venda_seu_carro`

O link de Spotify pode permanecer abaixo das ações comerciais, mas não deve ocupar o espaço principal. Os links de site e WhatsApp devem usar HTTPS.

### AppLocal

Solicitação recomendada para o cadastro existente, sem criar duplicata:

- nome: Netcar Multimarcas — Loja 2;
- endereço: Av. Presidente Vargas, 1106, Centro, Esteio/RS;
- CEP: 93260-048;
- telefone: (51) 3033-3900;
- WhatsApp: (51) 99729-3118;
- site: https://www.netcarmultimarcas.com.br.

## Prioridade operacional

| Ordem | Entrega | Impacto esperado | Esforço | Custo de mídia | Dependência | Prazo de avaliação |
|---|---|---|---|---|---|---|
| 1 | Facebook: alinhar telefone e endereço | alto para consistência e atendimento; efeito de ranking não comprovado | baixo | R$ 0 | login administrativo Meta | conferir em 24–72 h |
| 2 | Instagram: remover CEP compartilhado | alto para clareza dos dois endereços | baixo | R$ 0 | login como `@netcar_rc` | conferir imediatamente e em 72 h |
| 3 | Linktree: corrigir identidade, rotas e UTMs | alto para conversão e mensuração do Instagram | baixo | R$ 0 | login Linktree | medir cliques em 7–30 dias |
| 4 | AppLocal: reivindicar e corrigir cadastro | médio para consistência externa | baixo/médio | R$ 0 | validação do diretório | conferir em 7–30 dias |
| 5 | Creditas: atualizar WhatsApp no cadastro do parceiro | médio para atendimento e consistência | baixo | R$ 0 | contato comercial | próxima publicação mensal |
| 6 | Justos e agregadores sem controle | baixo | potencialmente alto | R$ 0 | canal de correção | revisar trimestralmente |

## O que não fazer

- não criar perfis ou endereços duplicados;
- não usar escritório virtual ou endereço sem operação real;
- não transformar um CEP em CEP compartilhado pelas duas lojas;
- não tentar ocultar o CNPJ antigo corretamente identificado como baixado;
- não comprar pacotes de links ou cadastros automáticos em centenas de diretórios;
- não tratar a presença de uma inconsistência como causa comprovada do ranking.

## Conclusão e confiança

- AutoCarro ativo coerente: **comprovado**;
- Facebook, Instagram, Linktree, AppLocal, Creditas e Justos com as divergências registradas: **comprovado** nas superfícies consultadas;
- NAP interno completo da Webmotors: **sem evidência suficiente**;
- ganho de clareza e redução de contatos no número errado: **forte evidência**;
- impacto positivo direto no ranking do Map Pack: **hipótese provável**, sem causalidade demonstrada;
- necessidade de anúncio pago: **não existe** para estas ações;
- necessidade de deploy: **não existe** para estas ações externas.

