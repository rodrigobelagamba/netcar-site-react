# Vídeos por unidade

## Funcionamento atual

O registro `src/modules/detalhes/lib/vehicleInstagramVideos.ts` associa cada
publicação ao **ID exato da unidade**. A confirmação não é feita somente pelo
modelo, ano, nome do arquivo ou semelhança da imagem.

- O card aparece acima da galeria apenas para uma unidade com preço positivo e
  associação única, conferida.
- A capa é uma imagem local do vídeo daquela unidade. Não há embed, autoplay ou
  carregamento de mídia da Meta antes do clique.
- O clique abre a publicação no Instagram em outra aba; não é uma reprodução
  medida nem um lead. `vehicle_video_click` depende do consentimento de analytics.
- Novas associações ainda exigem atualizar o registro, validar e publicar o site.
- Alterações nas publicações externas não são detectadas automaticamente.

## Conferência de 05/09/2026 (horário de Brasília)

Foram cruzadas 150 publicações recentes do feed público com 67 registros do
estoque, dos quais 61 tinham preço positivo. Não é uma auditoria de todo o
histórico do Instagram. A evidência de unidade é a hashtag `#netcar<ID>` ou a
URL exata do anúncio na legenda; carrosséis e associações apenas pelo modelo
foram excluídos.

Fontes públicas:

- Estoque: <https://www.netcarmultimarcas.com.br/api/v1/veiculos.php?limit=500>
- Feed: <https://embedsocial.com/api/get_socialfeed_posts/951a68df727d7b108a27d44dc06c3180210e760c/11/0>
  (último segmento é offset, de 0 a 135 em passos de 15).

### Associações liberadas nesta versão

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

## Próxima integração proposta — ainda não implementada

O AUTOADS deve ser a origem do vínculo; Instagram e YouTube são destinos de
publicação, não duas formas concorrentes de identificar o carro.

1. Na preparação, manter `listing.id`, arquivo final e hash do vídeo.
2. Somente após a confirmação da plataforma, registrar ID da unidade, provedor,
   ID e URL permanente da publicação, data, hash e capa extraída do vídeo real.
3. Sincronizar esses dados e a capa com um endpoint autenticado do site. Publicar
   apenas os campos públicos necessários; nunca manifestos internos ou tokens.
4. O site consulta o registro por unidade e verifica o estoque ativo. Para uma
   unidade com ambos os destinos, preservar um card principal, sem duplicação.
5. Novos vídeos passam a entrar como dados, sem deploy por associação. Falhas,
   URLs removidas, unidades ambíguas ou divergência de oferta ficam pendentes.

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
