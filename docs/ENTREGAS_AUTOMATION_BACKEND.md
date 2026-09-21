# Publicação automática de entregas

O site recebe o card final aprovado pelo fluxo do marketing, após a confirmação
da publicação no Instagram. O bot é responsável por manter uma fila persistente
e repetir somente o envio ao site se houver falha.

## Contrato

`POST https://www.netcarmultimarcas.com.br/entregas/v1/publish.php`

- Cabeçalho `Authorization: Bearer <token privado>`.
- Formulário multipart: `metadata` é uma string JSON; `image` é o arquivo final
  JPG, PNG ou WebP (até 12 MB, 16 megapixels e 8192 pixels por lado).
- `metadata.delivery_id`: ID estável opaco da entrega, de 1 a 160 caracteres
  (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`). Não usar nome, placa ou ID de sessão
  que muda em cada geração. O site publica somente o hash desse identificador.
- `metadata.instagram_media_id`: alternativa quando não houver `delivery_id`.
- `metadata.published_at`: data confirmada da publicação, ISO 8601 com timezone,
  por exemplo `2026-09-21T13:00:00Z`. O mês e dia exibidos usam America/Sao_Paulo.
- `metadata.card_crop`: opcional, `null` ou `[x, y, largura, altura]`, números
  normalizados de 0 a 1 sobre o **card final completo**, com origem no canto
  superior esquerdo. O retângulo precisa caber na imagem e ser quadrado em
  pixels (tolerância de 1 pixel). O feed devolve essa tupla como `cardCrop`.
  Omitir preserva o enquadramento anterior quando a imagem é idêntica; `null`
  restaura a foto inteira. Corrigir a imagem sem novo crop descarta o antigo.
- Outros textos não são persistidos: nome, placa, legenda livre e dados de venda
  não fazem parte desse contrato público.

Resposta 201 na primeira publicação; 200 para atualização ou repetição:

```json
{
  "ok": true,
  "id": "delivery-<24 caracteres hexadecimais>",
  "action": "created",
  "url": "https://www.netcarmultimarcas.com.br/entregas#foto=delivery-...",
  "delivery": {
    "id": "delivery-...",
    "name": "",
    "source": "marketing",
    "date": "2026-09-21",
    "year": "2026",
    "month": "09",
    "publishedAt": "2026-09-21T13:00:00Z",
    "imageUrl": "/entregas-media/live/delivery-...-hash.webp",
    "previewImageUrl": "/entregas-media/live/delivery-...-hash-640.webp"
  }
}
```

`action` pode ser `created`, `updated`, `unchanged` ou `duplicate`.
Uma correção enviada com o mesmo `delivery_id` preserva o link individual.
Bytes idênticos enviados com outro ID são reunidos em uma única foto.
Imagens corrigidas recebem nomes imutáveis novos para não ficarem presas no cache.
Alterar apenas `card_crop` preserva ID, data e todos os arquivos WebP existentes;
uma repetição com o mesmo enquadramento retorna `unchanged`.

Erros: 400 formulário incompleto, 401 token incorreto, 405 método inválido,
413 corpo acima do limite, 422 imagem/metadados inválidos e 503 indisponibilidade
temporária. O bot deve manter o mesmo ID nas tentativas, repetir falhas de rede/503
e registrar as demais para correção. Uma falha no site não deve republicar o Story.

## Configuração do servidor

PHP 7.4+ com GD/WebP. O usuário PHP precisa escrever em `entregas-data` e
`entregas-media/live`. Configurar `upload_max_filesize=12M` e `post_max_size=13M`
ou maiores no PHP da hospedagem. A validação do endpoint mantém os limites acima.

Criar `~/.netcar-entregas-config.php` **fora da pasta pública**, modo 0600:

```php
<?php
return array('token' => 'COLOCAR_UM_TOKEN_ALEATORIO_PRIVADO_DE_PELO_MENOS_32_CARACTERES');
```

O mesmo token fica somente na configuração privada do bot. Não inseri-lo em
variáveis Vite, JavaScript, logs, comandos de exemplo preenchidos ou arquivos
versionados. O endpoint aceita também `NETCAR_ENTREGAS_PUBLISH_TOKEN` no ambiente
do servidor ou `NETCAR_ENTREGAS_CONFIG_FILE` apontando ao arquivo externo.
A configuração dentro do webroot é recusada.

`GET /entregas/v1/status.php`, com o mesmo Bearer token, verifica o PHP usado
pelas requisições web, GD/WebP, limites de upload e permissões da pasta. Não
publica imagens nem exibe segredos ou caminhos. Exigir `ready: true` antes de
ativar a fila do bot. O arquivo `v1/.user.ini` define upload de 12 MB e corpo de
13 MB em CGI/FPM; a hospedagem pode levar alguns minutos para reler esse arquivo.
O status mostra o limite efetivo, que pode diferir do PHP da linha de comando.

## Dados e deploy

- `npm run entregas:seed`: gera `public/entregas-data/seed.json` a partir dos
  registros revisados e deduplicados da galeria. Executa no início do build.
- **Nunca substituir ou apagar `entregas-data/live.json` nem
  `entregas-media/live/` durante deploy.** Eles pertencem às publicações ao vivo;
  não são artefatos de build. O gerador altera somente `seed.json`.
- `GET /entregas/v1/feed.php`: `{deliveries: [...], updatedAt: ...}` das
  publicações ao vivo; o frontend mescla com o histórico empacotado. Cache de
  30 segundos. Não há token no frontend nem nomes de cliente nesse endpoint.
- `live.json` tem gravação atômica e trava exclusiva durante atualização. Caso o
  arquivo esteja corrompido, o backend recusa a gravação e preserva os bytes para
  recuperação. Fazer backup do arquivo e da pasta de mídia em conjunto.
- As variantes usam WebP, larguras 320/640/960 sem ampliar fontes pequenas, e uma
  versão integral com lado máximo 2400. O reprocessamento remove metadados da foto.
- Variantes antigas de correções são preservadas para links/cache já em uso.

## SEO

`/entregas` e `?pagina=N` entregam HTML com 24 fotos reais antes do JavaScript,
links de paginação, título e canonical próprios. React substitui esse conteúdo
dentro de `#root`. Páginas fora do intervalo respondem 404. Os filtros de mês e
ano continuam no cliente, sem gerar combinações de URLs. Há `CollectionPage`
com imagens, sem avaliações ou resultados comerciais inventados.

Executar `php scripts/tests/entregas-backend.test.php` para validar publicação,
repetições, correções, datas, variantes, proteção de dados e paginação usando
arquivos temporários isolados. Não publica fotos reais nem altera o feed do site.

## Enquadramento automático do bot

O worker `stories/delivery_gallery_sync.py` analisa a cópia durável do card final
antes do primeiro POST ao site. `stories/delivery_gallery_crop.py` usa apenas
detecção de caixas de rostos; não identifica pessoas e não guarda nomes,
embeddings ou as caixas individuais. A outbox guarda somente a tupla pública,
versão do algoritmo, hash do modelo e motivo da decisão. Retentativas reutilizam
a decisão e os mesmos bytes; a aprovação/publicação no Instagram não executa o
detector nem depende dele.

- `opencv-python-headless==4.13.0.92` está nos dois requirements do bot. O modelo
  oficial YuNet 2023mar e a licença MIT estão em `stories/models/`, incluídos pelo
  `COPY stories/` dos Dockerfiles. Não há download de modelo durante publicação.
- SHA-256 do modelo: `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`.
- Versão da geometria: `yunet-group-v1`. Analisa até 1280 pixels no lado maior,
  uma thread de CPU e orientação do bitmap igual à utilizada pelo GD.
- Candidatos a partir de 0,60; candidato abaixo de 0,85 produz fallback integral.
  Rostos minúsculos, grupo que não cabe, modelo/dependência ausente e erros também
  mantêm a foto completa. O recorte inclui margem de cabeça/ombros e limita a
  aproximação a 1,75×. Rostos ocultos ou não detectados continuam sendo uma
  limitação; a foto original fica sempre disponível.
- O frontend aplica a tupla apenas na apresentação e em Ampliar. O HTML inicial
  sem JavaScript e a opção de foto inteira preservam a imagem completa.

Para revisar uma entrega **já publicada**, no runtime do bot:

```sh
python -m stories.delivery_gallery_sync --refresh-crop delivery-<40 caracteres hexadecimais da outbox>
python -m stories.delivery_gallery_sync --refresh-crop delivery-<mesmo ID da outbox> --apply
```

O primeiro comando é somente leitura. O segundo coloca somente esse registro
existente na fila do site, preservando data, ID e imagem. O worker faz o POST; não
há chamadas a Instagram ou WhatsApp. Usar o ID interno do arquivo da outbox,
não o hash público de 24 caracteres. Nunca editar `live.json` diretamente.

## Ativação do enquadramento — 21/09/2026

- PHP `lib.php`: `52d28e69456c5b94ecb245933efe3eecd494f53872ebbf28c1e145ca10315a7a`.
  Backup com versão anterior e snapshot do live:
  `/home/netcarmultimarcas/.netcar-entregas-backups/crop-20260921182743006`.
- Bot: `/opt/stories-bot/.backups/gallery-crop-20260921-182609` contém manifest de
  hashes, arquivos anteriores do host/container, requirements e snapshot da outbox.
  Código/modelo/licença estão no host e no container; requirement persistido em
  `stories-bot.requirements.txt`. A instalação atual usou `--no-deps`, preservando
  NumPy/Pillow. Recriações devem construir a imagem a partir desses fontes e
  requirements; não reutilizar uma imagem antiga anterior à funcionalidade.
- Validação: 62 verificações PHP 7.4/GD em pasta temporária da hospedagem e 27
  testes Python no container. Foto atual e dez fotos do acervo revisadas: rostos
  completos dentro do recorte, sem caixas em logos/textos. Tempo quente no VPS
  aproximado de 0,68–0,89 segundo por card final; não afeta a aprovação.
- Uma reinicialização do bot após verificar `processing=0`, `queue=0` e
  `pending_approvals=0`. Nenhuma postagem ou mensagem de teste foi enviada.
- Worker iniciado às `2026-09-21T18:28:29Z`, configurado e sem erros registrados.
  A entrega `delivery-615c4c428886366fe15a4903` foi corrigida pelo fluxo autenticado
  com `[0, 0.139737, 0.571429, 0.321429]`; permaneceu a única entrada live, com
  o mesmo ID, publicação `2026-09-21T18:09:19Z` e imagem imutável original.

Rollback de código: conferir hashes do manifest antes de restaurar `lib.php` e
`delivery_gallery_sync.py` dos backups; reiniciar o bot somente ocioso. Modelo e
dependência podem permanecer sem uso. **Não restaurar snapshots de live/outbox
por cima de entregas posteriores.** Reverter um enquadramento deve usar metadado
`card_crop: null` no fluxo autenticado, preservando todos os outros campos.
