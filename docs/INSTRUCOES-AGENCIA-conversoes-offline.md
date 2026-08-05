# Netcar — Conversões Offline Meta (instruções agência)

## Objetivo

Hoje o Meta otimiza por "conversa iniciada" — barata, mas 32% 65+ com baixa conversão.
Com conversões offline, o algoritmo aprende **quem COMPRA** (núcleo real: 35–54 anos, ticket médio R$ 92 mil) e passa a entregar esse perfil.

## Arquivo anexo

`meta_offline_conversions_vendas_90dias.csv` — 118 vendas reais dos últimos 90 dias (ERP Automacar), com telefone, data e valor da venda.

## Como subir (Meta Events Manager)

1. Events Manager → Fontes de dados → **Criar conjunto de eventos offline** (ex.: "Netcar Vendas Loja")
2. Upload do CSV. Mapeamento das colunas:
   - `phone` → Telefone (já com DDI 55)
   - `event_name` → Nome do evento (Purchase)
   - `event_time` → Data/hora do evento (YYYY-MM-DD)
   - `value` → Valor
   - `currency` → Moeda (BRL)
   - `country` → País
3. **Associar o conjunto offline às campanhas** de veículos (ou à conta de anúncios)
4. Taxa de match esperada: 60–80% (telefones celulares BR costumam casar bem)

## Rotina semanal (obrigatória)

- Toda segunda: Netcar envia CSV atualizado (últimos 90 dias, incremental)
- Agência sobe no mesmo conjunto de eventos (dedupe é automático por telefone+data)

## Fase 2 (depois de 2–3 semanas de dados)

- Trocar otimização das campanhas de "conversas" para **conversão offline** (ou criar campanha-teste com esse objetivo)
- Meta precisa de ~15–25 conversões/semana para sair da fase de aprendizado — com 118 vendas/90 dias (~9/semana), manter otimização híbrida no início

## Restante do ajuste tático (já alinhado)

- Manter campanha nova (VIE 04-08-2026) — mix etário do dia 04/08 já saiu correto (65+ = 10%)
- Excluir 65+ apenas na **prospecção fria** (manter em remarketing)
- Geo: RS + região metropolitana
- Validar mix etário após 7 dias de campanha nova (amostra de 1 dia é pequena)

## Dúvidas técnicas

Marcelo (Netcar TI) — o CSV é regenerado direto do ERP, formato pode ser ajustado se o Events Manager reclamar de alguma coluna.
