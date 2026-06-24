# Medir tráfego de IA (ChatGPT, Perplexity, Claude, Gemini...)

Objetivo: saber quando as IAs citam a Netcar e mandam visitas pro site.

## O que já está no código (`index.html`)
Um script detecta o `referrer`/`utm_source` de IAs e empurra o evento
**`ai_referral`** no `dataLayer`, com:
- `ai_source` — qual IA (ChatGPT, Perplexity, Claude, Gemini, Copilot, Grok)
- `ai_referrer` — URL de origem

> Limite real: só captura a parcela que chega **com** referrer/UTM. Boa parte
> do tráfego de IA vem "sem referrer" (dark traffic) e é invisível a qualquer
> ferramenta sem detecção no servidor. Mesmo assim, o evento mostra tendência.

## Passo 1 — GTM (GTM-M8MZRTL9): criar variável + acionador + tag

1. **Variável** da camada de dados:
   - Variáveis → Nova → *Variável da camada de dados* → nome do DLV: `ai_source` → salvar como "DLV - ai_source".
2. **Acionador**:
   - Acionadores → Novo → *Evento personalizado* → nome do evento: `ai_referral` → salvar como "Evt - ai_referral".
3. **Tag GA4** (evento):
   - Tags → Nova → *GA4 Event* → usar a tag de configuração GA4 existente.
   - Event name: `ai_referral`
   - Parâmetro: `ai_source` = `{{DLV - ai_source}}`
   - Acionador: "Evt - ai_referral" → salvar e **publicar o container**.

## Passo 2 — GA4: ver os dados
- Em **Relatórios → Engajamento → Eventos** aparecerá `ai_referral`.
- Para detalhar por IA: **Administrador → Definições personalizadas → Criar
  dimensão personalizada** → Nome `ai_source`, escopo Evento, parâmetro `ai_source`.
- Depois, em *Explorar*, monte um relatório livre com a dimensão `ai_source`.

## Passo 3 — Canal "Tráfego IA" (recupera quem chega por referrer)
Independente do evento acima, crie um grupo de canais para acquisição:
- **GA4 → Administrador → Configurações de exibição → Grupos de canais → Criar**
- Nome: `Tráfego IA`
- Regra: `Origem da sessão` corresponde a regex:
  ```
  chatgpt|openai|perplexity|claude\.ai|gemini\.google|copilot\.microsoft|grok|x\.ai|you\.com|deepseek|meta\.ai
  ```
- **Arraste o canal para ACIMA de "Referral"** (senão o Referral captura antes).

## Passo 4 — Cruzar com IA Overviews do Google
O tráfego de "AI Overviews" do Google chega como *Organic*. Para vê-lo:
- **Search Console → Desempenho → filtro "Aspecto da pesquisa"** (recursos de IA),
  quando disponível para a propriedade.

## Teste rápido
Abra o site com `?utm_source=chatgpt.com` no fim da URL e confira no GTM Preview
se o evento `ai_referral` dispara com `ai_source = Chatgpt`.
