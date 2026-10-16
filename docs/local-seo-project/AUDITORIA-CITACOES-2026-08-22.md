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

## Adendo 03/09/2026 — novas fontes e execução

Nova varredura pública em 03/09/2026. Nenhum item da matriz original foi executado até esta data (todos dependiam de login). Fontes novas encontradas:

| Fonte | Situação observada | Divergência | Ação | Canal | Estado |
|---|---|---|---|---|---|
| [Mobiauto](https://www.mobiauto.com.br/comprar/estoque/netcar-rc-veiculos-ltda-17341) | `Netcar Veículos Ltda`, **0 veículos**, texto com nº 740 + telefone (051) 3500-7338, bloco de endereço com nº 1106 e CEP 93260-490 (CEP da Loja 1 no nº da Loja 2) | perfil morto com telefone antigo e NAP misturado; cliente que chega vê loja "sem estoque" | reativar com feed de estoque **ou** pedir remoção do perfil. Não deixar vazio | login lojista Mobiauto / suporte | pendente de login |
| [Listamais](https://www.listamais.com.br/local/cad_idDDQffDZ/netcar-multimarcas-loja-de-carro-em-esteio-rs) | nº 1106, logradouro `Avenida Presidente Vargas Pres`, CEP 93260-000, sem bairro | CEP genérico e logradouro duplicado | formulário "Sugerir edição" preenchido em 03/09 com os dados corretos; envio bloqueado por reCAPTCHA de imagem | e-mail `atendimento@listamais.com.br` (texto abaixo) | pendente de envio manual |
| [ListaTudo](https://listatudo.com.br/rio-grande-do-sul/porto-alegre-e-regiao/esteio/carros-e-outros-veiculos/compra-venda-e-aluguel/revendedores-e-pecas-para-automoveis-importados/netcar-multimarcas/) | nº 1106, Centro, **CEP 93260-454**, categoria "Revendedores e Peças para Automóveis Importados" | CEP errado e categoria errada | pedir correção para CEP 93260-048 e categoria "Revendedora de carros usados/seminovos" | formulário de contato da página | pendente |
| [Diário Cidade — CNPJ 02.237.969](https://www.diariocidade.com/rs/esteio/guia/netcar-rc-veiculos-02237969000106/) | `Netcar-rc Veiculos`, nº 740, Tamandaré, CEP 93260-490, (51) 3473-7900 | só o nome fantasia antigo; NAP correto | baixa prioridade; agregador de Receita Federal, sem canal de edição confiável | — | sem ação |
| [Diário Cidade — CNPJ 12.999.974](https://www.diariocidade.com/rs/esteio/guia/netcar-multimarcas-12999974000100/) | nº 1106, CEP 93260-003, telefone (51) 9974-0881 | CNPJ baixado em 12/2025; telefone desconhecido | não solicitar reativação. Se o diretório oferecer "empresa encerrada", marcar | — | sem ação |
| [NaPista](https://napista.com.br/busca/carro/vendedor-netcar_multimarcas_02230106) | `Netcar Multimarcas`, nº 1106, Centro; estoque ativo (6 ofertas 2025) | nenhuma | manter | — | conferido |
| [Webmotors](https://www.webmotors.com.br/carros/rs/loja.netcarrc-veiculos-ltda-3468461) | slug da loja ainda é `netcarrc-veiculos-ltda` | nome da loja no portal segue a razão social antiga | pedir ao gerente de conta Webmotors renomear a loja para `Netcar Multimarcas` (o slug pode não mudar) | atendimento lojista Webmotors | pendente |
| [Facebook](https://www.facebook.com/NetcarRC) | nome `Netcar RC`, e-mail público `contato@netcar-rc.com.br` | além do telefone (item original), o **nome** e o **e-mail** estão na marca antiga | renomear página para `Netcar Multimarcas`, e-mail para `contato@netcarmultimarcas.com.br`. A URL `/NetcarRC` pode ficar | login Meta Business | pendente de login |

### Site (executado em 03/09)

`SchemaOrg.tsx`: `alternateName` passou a listar `Netcar Esteio`, `Netcar RC` e `Netcar Veículos`; `sameAs` ganhou LinkedIn, as duas fichas do Maps (cid) e a loja na NaPista. Objetivo: o Google juntar os perfis com nome antigo à mesma entidade. Entra no próximo deploy.

### E-mail pronto — Listamais

Para: `atendimento@listamais.com.br`
Assunto: `Correção de cadastro — Netcar Multimarcas (Esteio/RS) — cad_id2283326`

> Olá. Sou responsável pela Netcar Multimarcas e peço correção do cadastro https://www.listamais.com.br/local/cad_idDDQffDZ/netcar-multimarcas-loja-de-carro-em-esteio-rs:
>
> - Nome: Netcar Multimarcas - Loja 2
> - Endereço: Avenida Presidente Vargas, 1106 — Centro — Esteio/RS — CEP 93260-048 (hoje consta "Avenida Presidente Vargas Pres" e CEP 93260-000)
> - Telefone: (51) 3033-3900 · WhatsApp: (51) 99729-3118
> - E-mail: contato@netcarmultimarcas.com.br
> - Site: https://www.netcarmultimarcas.com.br
>
> Obrigado.

### E-mail pronto — ListaTudo (formulário da página)

> Correção de cadastro: CEP correto é 93260-048 (consta 93260-454). Categoria correta: revenda de carros seminovos/usados (não "importados"). Telefone (51) 3033-3900, site https://www.netcarmultimarcas.com.br. Responsável: Netcar Multimarcas, contato@netcarmultimarcas.com.br.

### Ordem sugerida de execução (30 min com os logins)

1. Facebook: nome, e-mail e telefone do nº 740 (item 1 original + adendo).
2. Instagram: linha de endereço sem CEP único.
3. Linktree: título e links (estrutura já definida acima).
4. Mobiauto: reativar estoque ou remover perfil.
5. Webmotors: renomear loja.
6. Listamais e ListaTudo: enviar os textos acima.

### Execução 03/09 via conta marcelo@netcarmultimarcas.com.br

- **GBP**: 2 lojas confirmadas (Loja 1 fid 9144067949621682127, Loja 2 fid 10839197980729051544). Coleção de produtos "Nossos Carros Seminovos" já ativa. GBP **não tem import CSV** de produtos e cada item exige upload de foto (não aceita URL) — mass-add por automação foi descartado (frágil, baixo ROI, estoque gira). `docs/local-seo-project/gbp-produtos.csv` fica disponível pra add manual de carros-herói, se quiserem.
- **GSC**: propriedade `sc-domain:netcarmultimarcas.com.br` acessível pela conta. Amostragem de landings (`/seminovos-canoas`, `/seminovos-nova-santa-rita`, `/seminovos-bento-goncalves`) = todas "O URL está no Google" (indexadas). Reindex manual não é necessário e gastaria a cota diária. Property total: 308 indexadas / 3.590 não indexadas (maioria = fichas de veículo já vendidas/rotacionadas, esperado).
- **netcar-rc.com.br**: roda em docroot separado (index.html 2016, `meta refresh` pra http não-www). FTP `netcarmultimarcas` só alcança `www/` do site principal — não dá pra trocar o meta refresh por 301 sem o FTP/painel daquele domínio.

### Páginas de proximidade — avaliação

Ideia de páginas por empresa/convênio: **não recomendado**. Sem oferta real vira thin content, usa nome de marca alheia e tem volume de busca ~0. A proximidade já está coberta pelas city pages (distância, tempo, rota BR-116, bairros em `routeOrigins`). O lever real de "quem trabalha perto" é **operação comercial** (feirão no estacionamento da empresa, avaliação do usado no horário de almoço), não nova URL.

## Conclusão e confiança

- AutoCarro ativo coerente: **comprovado**;
- Facebook, Instagram, Linktree, AppLocal, Creditas e Justos com as divergências registradas: **comprovado** nas superfícies consultadas;
- NAP interno completo da Webmotors: **sem evidência suficiente**;
- ganho de clareza e redução de contatos no número errado: **forte evidência**;
- impacto positivo direto no ranking do Map Pack: **hipótese provável**, sem causalidade demonstrada;
- necessidade de anúncio pago: **não existe** para estas ações;
- necessidade de deploy: **não existe** para estas ações externas.

