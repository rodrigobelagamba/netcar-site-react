# Vídeos por unidade

## Funcionamento atual

O sincronizador `docs/social/lib/VehicleVideoSync.php` consulta as 500 publicações
mais recentes da conta Instagram já conectada à integração social e cruza os
vídeos com o estoque oficial completo. Usa **ID exato da unidade**, identificado
por `#netcar<ID>` ou pelo link exato do anúncio na legenda. Não infere pelo modelo.

- O card aparece acima da galeria apenas para uma unidade com preço positivo e
  associação única, conferida.
- A capa é uma imagem local do vídeo daquela unidade. Não há embed, autoplay ou
  carregamento de mídia da Meta antes do clique.
- O clique abre a publicação no Instagram em outra aba; não é uma reprodução
  medida nem um lead. `vehicle_video_click` depende do consentimento de analytics.
- Novos vídeos entram como dados em `/social/v1/vehicle-videos.php`, sem novo deploy.
- A rotina existente de Stories também sincroniza os vídeos. Falhas de Reviews,
  Stories ou Google Posts não impedem a execução independente dessa etapa.
- Apenas vídeos de unidades ativas com referência inequívoca são selecionados.
  Preços anunciados divergentes, carrosséis e referências ambíguas são excluídos.
  A página também oculta o vídeo se o preço do carro mudou desde a sincronização.
- Cada sincronização substitui o conjunto anterior: publicações removidas da
  janela consultada e carros vendidos deixam de fazer parte do resultado.
- As capas são guardadas no site pelo cache de mídia existente. Se uma capa falha,
  continua disponível o link de vídeo sem capa; nenhum carregamento prévio na Meta.
- Falha do Instagram/estoque preserva o último cache íntegro. Acima de 48 horas
  sem atualização, o endpoint retorna lista vazia. A página consulta a API ao
  abrir e a cada cinco minutos enquanto está aberta.
- Os nove vínculos antigos em `vehicleInstagramVideos.ts` são reserva para falha
  da API. Uma resposta válida vazia nunca restaura esse cadastro antigo.

## Operação

As credenciais Meta e a rotina social existentes são reutilizadas. Não é
necessário entregar tokens ao navegador nem mudar o publicador AUTOADS.

Para uma nova publicação, incluir `#netcar19978` (substituindo pelo ID correto)
ou o link exato do anúncio. Depois que o Reel estiver publicado, a próxima
sincronização o inclui automaticamente se a unidade e a oferta conferirem.

O painel DevOps permite executar o script `social:sync-vehicle-videos`. Ele usa
o SSH já configurado e executa somente a atualização dos vídeos do site, sem
publicar no Instagram ou no Google. Pela CLI da hospedagem:

```sh
php social/v1/sync-social.php --vehicle-videos-only --dry-run
php social/v1/sync-social.php --vehicle-videos-only
```

O GET público de `vehicle-videos.php` apenas lê dados; não inicia sincronizações.
O modo HTTP `sync-social.php?vehicle_videos_only=1` exige a autenticação social
existente. O token do painel DevOps é separado dessa autenticação.

Verificação: `npm run stock:validate-video`, `php docs/social/tests/VehicleVideoSyncTest.php`
e `npm run build`. O endpoint público informa `syncedAt` e `stale`; erros detalhados
de sincronização não são expostos nele.

## Histórico: conferência manual de 05/09/2026 (horário de Brasília)

Foram cruzadas 150 publicações recentes do feed público com 67 registros do
estoque, dos quais 61 tinham preço positivo. Não é uma auditoria de todo o
histórico do Instagram. A evidência de unidade é a hashtag `#netcar<ID>` ou a
URL exata do anúncio na legenda; carrosséis e associações apenas pelo modelo
foram excluídos.

Fontes públicas:

- Estoque: <https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500>
- Feed: <https://embedsocial.com/api/get_socialfeed_posts/951a68df727d7b108a27d44dc06c3180210e760c/11/0>
  (último segmento é offset, de 0 a 135 em passos de 15).

### Associações do cadastro de reserva

| Unidade | Modelo | Reel |
| --- | --- | --- |
| 19739 | HR-V EX | <https://www.instagram.com/reel/Dc3r9k7in-R/> |
| 19884 | Fastback Impetus | <https://www.instagram.com/reel/Dc1HOgyj5Y7/> |
| 19953 | Tiggo 5X Pro | <https://www.instagram.com/reel/DcyQddbiakp/> |
| 19299 | Kicks S | <https://www.instagram.com/reel/DcrVs8fAnVu/> |
| 19965 | Onix LT | <https://www.instagram.com/reel/DcoB720kcXO/> |
| 19868 | Creta Prestige | <https://www.instagram.com/reel/Dcl-eieFueP/> |
| 19973 | EcoSport Freestyle | <https://www.instagram.com/reel/DcjxxliEtT1/> |
| 19962 | Captur Zen | <https://www.instagram.com/reel/DcgU5OlgJLQ/> |
| 19901 | Tracker Premier | <https://www.instagram.com/reel/DceCDR5Cjlo/> |

### Pendências comerciais — não publicar sem revisar

| Unidade | Publicação | Preço na legenda | Preço no estoque na coleta |
| --- | --- | --- | --- |
| Renegade 19974 | <https://www.instagram.com/reel/DczUL-hjnM-/> | R$ 102.900 | R$ 99.900 |
| Kicks 19839 | <https://www.instagram.com/reel/Dci0kZiDCRI/> | R$ 102.900 | R$ 99.900 |
| City 19688 | <https://www.instagram.com/reel/Dcg8X1hFKNP/> | R$ 109.900 | R$ 105.900 |

Essas publicações não foram editadas. Conferir a oferta na legenda e no vídeo
antes de liberar o vínculo.

## Integração futura com manifestos AUTOADS/YouTube

A integração direta com manifestos AUTOADS/YouTube continua sendo uma evolução
possível. A atualização automática pelo feed Instagram descrita acima já utiliza
a referência de unidade que o AUTOADS publica nas legendas.

1. Na preparação, manter `listing.id`, arquivo final e hash do vídeo.
2. Somente após a confirmação da plataforma, registrar ID da unidade, provedor,
   ID e URL permanente da publicação, data, hash e capa extraída do vídeo real.
3. Sincronizar esses dados e a capa com um endpoint autenticado do site. Publicar
   apenas os campos públicos necessários; nunca manifestos internos ou tokens.
4. O site consulta o registro por unidade e verifica o estoque ativo. Para uma
   unidade com ambos os destinos, preservar um card principal, sem duplicação.
5. Preservar a entrada de novos vínculos como dados, sem deploy por associação,
   com as mesmas verificações de unidade ativa e oferta.

### Cuidados encontrados no AUTOADS

- Os manifestos já guardam `listing.id`, arquivo e hash. O publicador do Reel
  pode gravar `media_id`, `permalink` e estado específico da publicação.
- Conferir `destinations.instagram.reel.status`, não somente o estado geral:
  uma falha nos Stories não significa que o Reel falhou.
- Para YouTube, ID/URL podem existir antes do processamento terminar. Exigir
  publicação confirmada, processamento concluído e privacidade pública.
- A cópia local de alguns manifestos está atrasada em relação ao feed público.
  O arquivo `published_content.jsonl` examinado não tem unidade/permalink
  suficientes e não deve ser utilizado sozinho como ponte.
- A capa precisa passar a fazer parte do registro; esse campo não existia nos
  manifestos examinados.
- Publicações fora do AUTOADS precisam de um cadastro manual com ID da unidade
  e link, sujeito às mesmas conferências. Não inferir pelo nome do modelo.

Não há publicação automática no Instagram/YouTube nem alteração no AUTOADS
incluída nesta entrega do site.
