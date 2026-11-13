# Destino das novas publicações no Google

Decisão do responsável em 13/11/2026: concentrar novas interações comerciais no perfil principal **Netcar Multimarcas**, na Av. Presidente Vargas, 740.

- Identificador administrativo GBP de publicação: `11161331340741727452`.
- Slug de atribuição/deduplicação preservado: `loja_1`.
- A filial `17013442122163034193` continua ativa. Seus registros, avaliações, permissões e publicações anteriores não são removidos nem migrados.

`GoogleLocalPostsClient::PUBLISHING_LOCATIONS` é a allowlist autoritativa. `InstagramGbpPublisher` a aplica depois de ler a configuração privada, portanto uma configuração antiga com duas lojas não pode reativar a réplica da filial. O gateway também rejeita qualquer criação para outro ID. Os validadores do dry-run e do controle operacional exigem um único destino, o principal.

O primeiro sync natural depois da atualização pode reduzir o fingerprint de destinos de dois para um. Quando o ID remanescente é o mesmo, preserva cutoff, ativação concluída, descoberta, marcadores UTM, tentativas e estado dos posts. Não exige novo handover, não zera estado e não libera publicações anteriores ao cutoff. Retries já elegíveis do principal mantêm suas regras. Pendências da filial ficam no histórico e não são publicadas, tentadas novamente ou tratadas como falha do destino atual. A retenção automática não apaga registros que ainda contenham histórico da filial.

A coleta de avaliações mantém os dois estabelecimentos e a atribuição real de cada comentário. A política de publicação não muda `google.location_names`, OAuth, cron, orçamento, IDs de Analytics ou mensagens a clientes.

Para validar sem publicar, usar exclusivamente o modo `posts_only=1&dry_run=1` ou `InstagramGbpPublisher::sync(true)`. O dry-run confirma um item por post elegível com `location=loja_1`, `created=0` e nenhum download de mídia ou escrita de estado. A autenticação pode renovar o token OAuth normalmente. Não chamar sync geral como teste: reviews/stories podem atualizar caches mesmo com dry-run.

A rotina de fotos é uma lista de candidatas, sem API de publicação: `gbp-photo-routine.mjs` mantém validação do histórico de ambas as unidades e sugere novas fotos somente do endereço nº 740. `gbp-products-csv.mjs` apenas gera material manual e agora gera somente o perfil principal. Nenhum dos dois autoriza publicar fotos da filial como se fossem do endereço nº 740.

Retorno: uma reversão de código anterior pode reabrir a réplica para a filial. Qualquer mudança futura de destino exige decisão específica do responsável e validação de cutoff/estado; não executar reativação ou apagar histórico como procedimento de retorno.
