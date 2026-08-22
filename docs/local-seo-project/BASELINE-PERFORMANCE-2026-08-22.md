# Baseline de desempenho após o deploy

Coleta: 22/08/2026, 10:57–10:58 (America/Sao_Paulo).

Ferramenta: Lighthouse 12.8.2, Chrome 151, modo simulado. Os resultados de laboratório ajudam a detectar regressões, mas não substituem os dados de campo do Core Web Vitals, cuja janela móvel pode levar 28 dias para refletir o deploy.

| Página | Perfil | Performance | FCP | LCP | TBT | CLS | TTFB |
|---|---|---:|---:|---:|---:|---:|---:|
| Home | mobile | 100 | 0,92 s | 1,03 s | 0 ms | 0,020 | 86 ms |
| Home | desktop | 100 | 0,41 s | 0,49 s | 0 ms | 0,010 | 67 ms |
| Canoas | mobile | 98 | 1,00 s | 2,29 s | 0 ms | 0,020 | 292 ms |

Conclusão: o primeiro lote publicado não apresentou regressão de conversão ou bloqueio de JavaScript em laboratório. Não há evidência para uma nova alteração ampla imediata. Canoas ainda permite uma economia pequena em resposta inicial e formato de imagem, mas o ganho estimado é insuficiente para justificar uma mudança de risco antes da janela de campo.

Decisão: acompanhar o relatório de Core Web Vitals por 28 dias e repetir o Lighthouse nos mesmos três perfis após qualquer novo deploy relevante.
