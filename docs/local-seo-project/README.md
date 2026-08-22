# Projeto Netcar — Crescimento Local Orgânico

Este é o ponto central para planejar, implementar e medir o crescimento local da Netcar Multimarcas. O projeto usa `netcar-organic-demand` como base canônica do site e transforma o diagnóstico de 21/08/2026 em trabalho executável.

## Objetivo

Aumentar a presença da Netcar no Google Maps, no Map Pack e nos resultados orgânicos sem depender de anúncios pagos. As três frentes iniciais são:

1. defender e ampliar a presença em Esteio;
2. ganhar relevância regional em Sapucaia do Sul;
3. construir presença sustentável em Canoas, monitorando especialmente R2 Motors e Dotto Veículos.

Anúncios podem ser avaliados separadamente para gerar demanda imediata, mas não são dependência deste projeto e não corrigem ranking orgânico ou ranking do Google Maps.

## Fontes de verdade

- [Relatório de SEO local](../../../outputs/netcar-local-seo-2026-08-21/relatorio-seo-local-netcar-2026-08-21.md)
- [Planilha de dados](../../../outputs/netcar-local-seo-2026-08-21/netcar-seo-local-dados-2026-08-21.xlsx)
- [Backlog](./BACKLOG.md)
- [Roadmap](./ROADMAP.md)
- [Sprint 01](./SPRINT-01.md)
- [Métricas](./METRICS.md)
- [Linha de base GBP de 90 dias](./BASELINE-GBP-90D-2026-08-18.md)
- [Decisões](./DECISIONS.md)
- [Estado legível por máquina](./project.json)

## Como trabalharemos em parceria

O Codex pode analisar o código, implementar páginas e componentes, criar automações de validação, testar, documentar e organizar o backlog. A Netcar participa das decisões comerciais e fornece os dados que não estão no código: acesso ou exportações de GBP/GSC/GA4, fotos atuais, particularidades de cada loja, depoimentos autorizados e evidências reais de atendimento por cidade.

Nenhum conteúdo será publicado como fato sem evidência. Não serão usados endereço falso, perfil duplicado, escritório virtual, avaliações incentivadas de forma indevida ou páginas quase idênticas trocando apenas o nome da cidade.

## Estado inicial

O código já contém páginas regionais, marcação estruturada para as duas lojas, redirecionamentos/retornos para URLs antigas e validações de SEO no build. Esses itens não serão refeitos: entram como “implementado, aguardando verificação em produção”.

Para consultar o estado do projeto:

```bash
npm run local-seo:status
npm run local-seo:validate
```
