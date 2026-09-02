# GMB — execução setembro/2026

Decisão 8 do plano de posicionamento. Reclame Aqui fica fora: a página não é da Netcar e a desativação já foi pedida.

## Já em produção (não refazer)

| Item | Estado | Fonte |
| --- | --- | --- |
| Dois perfis `Netcar Multimarcas - Loja 1` / `Loja 2`, mesma organização, CIDs e telefones conferidos | ok | `DIAGNOSTICO-ENTIDADES-NAP-2026-08-21.md` |
| Links do site com UTM por loja (`gbp_esteio`, `loja_1`/`loja_2`) | ok | `AUDITORIA-GBP-ESTEIO-2026-08-21.md` |
| Descrições, seis serviços fixos, fotos próprias por unidade | ok / rotina semanal | `ROTINA-FOTOS-GBP-2026-08.md` |
| Posts: Instagram → dois perfis via API oficial, CTA resolvido pelo estoque | ok (publicador em `docs/social/`) | `DEPLOY_GOOGLE_GBP_API.md` |
| Posts de cidade (Canoas, Sapucaia) com UTM por loja | ok | `GBP-POSTS-CIDADES-2026-08-24.md` |
| Avaliações: link fixo por vendedor, mensagem aprovada, resposta em 2 dias úteis | ok, manual | `ROTINA-AVALIACOES-2026-08-22.md` |

## O que esta entrega adiciona

### 1. Estoque como "Produtos" nos dois perfis

O GBP não tem API de produtos; o cadastro é manual. O script abaixo gera o CSV com tudo pronto pra copiar (nome, categoria, preço, descrição, foto, link com UTM `gbp_produtos` por loja):

```bash
node scripts/gbp-products-csv.mjs            # 20 carros mais recentes, 2 lojas
node scripts/gbp-products-csv.mjs --limit=30
```

Saída: `docs/local-seo-project/gbp-produtos.csv`.

Rotina: toda segunda, regerar, cadastrar os novos e remover no perfil os `id` que não aparecem mais no CSV. Medir em GA4 por `utm_campaign=gbp_produtos` e nos cliques WhatsApp (o site já preserva UTM até o clique).

### 2. Pedido de avaliação automático pelo iAN (48h após a entrega)

Hoje o pedido depende do vendedor. Automatizar no bot (repo AUTOADS / fila do iAN), sem mudar a mensagem aprovada:

- Gatilho: negócio marcado como **entregue** no CRM (não "vendido"), timestamp da entrega.
- Espera: 48h. Enviar entre 9h e 20h; fora disso, adia pro próximo horário válido.
- Perfil: link da unidade de referência do vendedor do negócio (tabela interna vendedor → loja). Sem vendedor mapeado, não envia e abre pendência.
  - Loja 1: `https://g.page/r/Cc8fPFNaQeZ-EBM/review`
  - Loja 2: `https://g.page/r/CZiJfIsikWyWEBM/review`
- Mensagem (aprovada em `ROTINA-AVALIACOES-2026-08-22.md`):

  > Olá, [nome]! Obrigado por escolher a Netcar. Se puder, conte no Google como foi sua experiência conosco. Sua opinião sincera ajuda outros clientes e também a nossa equipe: [link da loja].

- Um único lembrete em 4 dias se não houver resposta na conversa. Nunca pedir nota, sugerir texto ou oferecer brinde.
- Dedupe por telefone + negócio (um pedido por compra). Opt-out: qualquer resposta negativa encerra.
- Registro: só agregado por semana/vendedor/loja.

Meta: cobertura ≥ 90% dos clientes entregues em 30 dias (hoje depende de lembrar).

### 3. Perguntas e respostas (seed) — copiar nos dois perfis

Usar a conta da empresa pra publicar pergunta e resposta. Sem cidade forçada, sem promessa comercial.

1. **Aceitam carro na troca?** — Sim, inclusive com financiamento em aberto, mediante avaliação na loja ou por fotos pelo WhatsApp.
2. **Dá pra financiar?** — Sim, em até 60x com bancos e financeiras parceiras, sujeito à análise. A entrada pode ser parcelada no cartão conforme disponibilidade.
3. **Os carros têm procedência?** — Não trabalhamos com carros de leilão, locadora, sinistro, furto ou roubo. Todos passam por preparação antes da vitrine.
4. **Posso reservar um carro antes de ir?** — Sim. Escolha no site, confirme disponibilidade pelo WhatsApp e combine o horário.
5. **Qual a diferença entre as duas lojas?** — Operação integrada na Av. Presidente Vargas (nº 740 e nº 1106), a 400 m uma da outra. O estoque do site reúne as duas.
6. **Fazem a transferência?** — Sim, com despachante credenciado.

### 4. Citações externas (nome/telefone divergentes)

Auditoria pronta em `AUDITORIA-CITACOES-2026-08-22.md` (Netcar RC, R&C Veículos, telefones antigos). Correção estava pausada por decisão de 22/08. Pra retomar: seguir a coluna "ação" da auditoria; prioridade Webmotors, iCarros, OLX, Apontador/Solutudo. Cada correção usa exatamente: `Netcar Multimarcas`, `Av. Presidente Vargas, 740` / `1106`, Esteio/RS, telefones `(51) 3473-7900` (Loja 1) e `(51) 3033-3900` (Loja 2), WhatsApp `(51) 99729-3118`, site `https://www.netcarmultimarcas.com.br`.

## Cadência

| Frequência | Ação | Dono |
| --- | --- | --- |
| Diária | Responder avaliações e perguntas novas | Pós-venda |
| Semanal (seg) | Regerar CSV de produtos, atualizar os dois perfis; conferir posts automáticos | Marketing |
| Semanal | Fotos próprias por unidade (rotina existente) | Marketing |
| Mensal | Fotografar Map Pack nas 8 cidades (MEAS-001) e comparar com `BASELINE-GBP-90D-2026-08-18.md` | TI |
