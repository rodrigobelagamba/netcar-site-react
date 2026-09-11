<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

function expectVideo(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function videoFixture(string $caption, string $id = '18001234567890123', string $date = '2026-09-11T10:00:00Z'): array
{
    return [
        'id' => $id,
        'caption' => $caption,
        'mediaType' => 'VIDEO',
        'permalink' => 'https://www.instagram.com/reel/reel_' . $id . '/',
        'thumbnailUrl' => 'https://scontent.cdninstagram.com/example.jpg',
        'publishedAt' => $date,
    ];
}

$stock = [
    ['id' => '19299', 'marca' => 'NISSAN', 'modelo' => 'KICKS S', 'ano' => 2020, 'valor' => 76900, 'placa' => 'IZN2I88', 'link' => 'detalhe-produto-kicks-s-2020-IZN-xx88-preto.html'],
    ['id' => '19974', 'marca' => 'JEEP', 'modelo' => 'RENEGADE', 'ano' => 2022, 'valor' => 99900, 'placa' => 'ABC1D23'],
    ['id' => '19979', 'marca' => 'CHEVROLET', 'modelo' => 'CRUZE LT HB', 'ano' => 2014, 'valor' => 0, 'placa' => 'JCA4J56'],
];
$cases = [
    ['#netcar19299', 'exact_vehicle_reference'],
    ['R$ 76.900,00 #NETCAR19299', 'exact_vehicle_reference'],
    ['R$ 76900 #netcar19299', 'exact_vehicle_reference'],
    ['R$ 76.900 #netcar19299 #netcar19299', 'exact_vehicle_reference'],
    ['R$ 76.901 #netcar19299', 'advertised_price_mismatch'],
    ['R$ 102.900 #netcar19974', 'advertised_price_mismatch'],
    ['R$ 102.900 por R$ 99.900 #netcar19974', 'advertised_price_mismatch'],
    ['R$ 99,9mil #netcar19974', 'advertised_price_unreadable'],
    ['R$ consultar #netcar19974', 'advertised_price_unreadable'],
    ['#netcar19979', 'vehicle_not_active'],
    ['#netcar99999', 'vehicle_not_active'],
    ['NISSAN KICKS S 2020 R$ 76.900', 'vehicle_reference_missing'],
    ['prefix#netcar19299', 'vehicle_reference_missing'],
    ['#netcar19299extra', 'vehicle_reference_missing'],
    ['#netcar19299 #netcar19974', 'vehicle_reference_ambiguous'],
    ['#netcar19299 #netcar99999', 'vehicle_reference_ambiguous'],
    ['https://www.netcarmultimarcas.com.br/veiculo/19299', 'exact_vehicle_reference'],
    ['Anúncio: https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299.', 'exact_vehicle_reference'],
    ['Anúncio: https://netcarmultimarcas.com.br/detalhe-produto-kicks-s-2020-IZN-xx88-preto.html', 'exact_vehicle_reference'],
    ['Anúncio: https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299?utm_source=instagram', 'exact_vehicle_reference'],
    ['https://www.netcarmultimarcas.com.br/veiculo/outro-carro-19299', 'vehicle_url_unresolved'],
    ['#netcar19299 https://www.netcarmultimarcas.com.br/veiculo/19974', 'vehicle_reference_ambiguous'],
    ['#netcar19299 https://www.netcarmultimarcas.com.br/veiculo/99999', 'vehicle_url_unresolved'],
    ['https://www.netcarmultimarcas.com.br.evil.example/veiculo/19299', 'vehicle_reference_missing'],
    ['https://www.netcarmultimarcas.com.br@evil.example/veiculo/19299', 'vehicle_reference_missing'],
];
foreach ($cases as [$caption, $reason]) {
    expectVideo(VehicleVideoSync::resolveVehicle(videoFixture($caption), $stock)['reason'] === $reason, 'Associacao incorreta: ' . $caption);
}
expectVideo(VehicleVideoSync::resolveVehicle(videoFixture('#netcar19299'), array_merge($stock, [$stock[0]]))['reason'] === 'stock_record_ambiguous', 'Duplicata identica de estoque deve ser recusada.');
$duplicateSold = $stock[0];
$duplicateSold['valor'] = 0;
expectVideo(VehicleVideoSync::resolveVehicle(videoFixture('#netcar19299'), array_merge($stock, [$duplicateSold]))['reason'] === 'stock_record_ambiguous', 'Duplicata vendida/ativa deve ser recusada.');
foreach (['https://instagram.com.evil.example/reel/test/', 'https://www.instagram.com@evil.example/reel/test/', 'javascript:alert(1)', 'https://www.instagram.com/stories/test/', 'http://www.instagram.com/reel/test/'] as $url) {
    $item = videoFixture('#netcar19299');
    $item['permalink'] = $url;
    expectVideo(VehicleVideoSync::resolveVehicle($item, $stock)['reason'] === 'invalid_video', 'Permalink inseguro deve ser recusado.');
}
$image = videoFixture('#netcar19299');
$image['mediaType'] = 'IMAGE';
expectVideo(VehicleVideoSync::resolveVehicle($image, $stock)['reason'] === 'invalid_video', 'Imagem nao pode ser publicada como video.');

class VideoTestFeed extends InstagramFeedClient
{
    public array $items;
    public bool $fail = false;
    public int $calls = 0;
    public function __construct(array $items) { $this->items = $items; }
    public function fetchRecent(int $limit = 25): array
    {
        $this->calls++;
        expectVideo($limit === 500, 'Deve consultar os 500 posts recentes.');
        if ($this->fail) { throw new RuntimeException('private-token-must-not-leak'); }
        return $this->items;
    }
}
class VideoTestMedia extends InstagramPostMediaCache
{
    public int $calls = 0;
    public bool $fail = false;
    public function cache(array $media): string
    {
        $this->calls++;
        if ($this->fail) { throw new RuntimeException('thumbnail-unavailable'); }
        return 'https://www.netcarmultimarcas.com.br/social/v1/instagram-post-media.php?id=' . $media['id'];
    }
}
class VideoFailingRename extends VehicleVideoSync
{
    protected function activateCache(string $temporary, string $target): void
    {
        if (substr($target, -5) === '.json') {
            throw new RuntimeException('Simulated failed rename');
        }
        parent::activateCache($temporary, $target);
    }
}
class VideoPagedStock extends VehicleVideoSync
{
    public array $pages = [];
    public array $requests = [];
    protected function requestStockPage(string $url): array
    {
        $this->requests[] = $url;
        return array_shift($this->pages) ?? ['status' => 500, 'body' => null];
    }
}

$directory = sys_get_temp_dir() . '/netcar-vehicle-video-test-' . bin2hex(random_bytes(5));
$cachePath = $directory . '/cache/vehicle-videos.json';
$now = strtotime('2026-09-11T12:00:00Z');
$feed = new VideoTestFeed([
    videoFixture('#netcar19299', '18001234567890120', '2026-09-09T10:00:00Z'),
    videoFixture('#netcar19299', '18001234567890123'),
    videoFixture('R$ 102.900 #netcar19974', '18001234567890124'),
]);
$mediaCache = new VideoTestMedia();
$sync = new VehicleVideoSync($feed, $mediaCache, static fn (): array => $stock, $cachePath, static fn (): int => $now);
$dry = $sync->sync(true);
expectVideo($dry['dryRun'] && $dry['count'] === 1 && $dry['videos'][0]['permalink'] === $feed->items[1]['permalink'], 'Deve escolher apenas video mais recente valido por unidade.');
expectVideo(!file_exists($directory) && $mediaCache->calls === 0, 'Dry-run nao pode criar arquivos/diretorios/locks nem baixar capas.');
$live = $sync->sync();
expectVideo($live['success'] && $mediaCache->calls === 1, 'Live deve guardar somente a capa selecionada.');
expectVideo($live['videos'][0]['stockPrice'] === 76900.0 && $live['videos'][0]['verifiedAt'] === gmdate('c', $now), 'Publicar preco exato em reais e data verificada.');
expectVideo($live['videos'][0]['coverImage'] === '/social/v1/instagram-post-media.php?id=18001234567890123', 'Capa deve apontar para o cache local por ID numerico.');
$original = file_get_contents($cachePath);
$public = VehicleVideoSync::publicResponse($cachePath, $now);
expectVideo($public !== null && $public['success'] && !$public['stale'] && count($public['videos']) === 1, 'Leitura publica deve servir cache fresco.');
expectVideo(!isset($public['rejected']) && !isset($public['videos'][0]['caption']), 'Resposta publica nao pode revelar diagnosticos nem legendas.');
expectVideo(VehicleVideoSync::publicResponse($cachePath, $now + 1801)['stale'], 'Cache deve sinalizar atraso apos 30min.');
expectVideo(VehicleVideoSync::publicResponse($cachePath, $now + 172801)['videos'] === [], 'Cache expirado apos 48h deve retornar sucesso vazio para nao reativar fallback.');

$feed->fail = true;
try { $sync->sync(); expectVideo(false, 'Falha feed deve interromper sync.'); } catch (RuntimeException $error) {
    expectVideo(strpos($error->getMessage(), 'preservado') !== false && strpos($error->getMessage(), 'private-token') === false, 'Falha feed deve ser sanitizada.');
}
expectVideo(file_get_contents($cachePath) === $original, 'Falha Meta deve preservar ultimo cache.');
$feed->fail = false;
$badStock = new VehicleVideoSync($feed, $mediaCache, static function (): array { throw new RuntimeException('down'); }, $cachePath, static fn (): int => $now);
try { $badStock->sync(); expectVideo(false, 'Falha estoque deve interromper.'); } catch (RuntimeException $error) { expectVideo(strpos($error->getMessage(), 'preservado') !== false, 'Falha estoque deve ser explicita.'); }
expectVideo(file_get_contents($cachePath) === $original, 'Falha estoque deve preservar ultimo cache.');

$heldLock = fopen($cachePath . '.lock', 'c');
flock($heldLock, LOCK_EX);
$callsBefore = $feed->calls;
try { $sync->sync(); expectVideo(false, 'Concorrencia deve falhar.'); } catch (RuntimeException $error) { expectVideo(strpos($error->getMessage(), 'andamento') !== false, 'Lock deve prevenir segundo sync.'); }
expectVideo($feed->calls === $callsBefore, 'Segundo sync nao deve executar chamadas externas.');
flock($heldLock, LOCK_UN);
fclose($heldLock);

$failedWrite = new VideoFailingRename($feed, $mediaCache, static fn (): array => $stock, $cachePath, static fn (): int => $now);
try { $failedWrite->sync(); expectVideo(false, 'Falha rename deve interromper.'); } catch (RuntimeException $error) { expectVideo($error->getMessage() === 'Simulated failed rename', 'Deve simular falha ao ativar cache.'); }
expectVideo(file_get_contents($cachePath) === $original, 'Falha atomica nao pode truncar cache atual.');
expectVideo(count(glob(dirname($cachePath) . '/vehicle-videos-*') ?: []) === 0, 'Falha atomica nao pode deixar temporarios.');

// Nova publicacao entra na proxima execucao sem deploy; removida ou vendida sai.
$feed->items = [videoFixture('#netcar19974', '18001234567890130')];
$newSync = $sync->sync();
expectVideo($newSync['count'] === 1 && $newSync['videos'][0]['vehicleId'] === '19974', 'Novo vinculo deve substituir cache sem deploy.');
$feed->items = [videoFixture('#netcar19979', '18001234567890131')];
expectVideo($sync->sync()['count'] === 0 && VehicleVideoSync::publicResponse($cachePath, $now)['videos'] === [], 'Video vendido nao deve sobreviver via cache anterior.');
$feed->items = [videoFixture('#netcar19299', '18001234567890132')];
$mediaCache->fail = true;
$withoutCover = $sync->sync();
expectVideo($withoutCover['count'] === 1 && $withoutCover['coverFailures'] === 1 && !isset($withoutCover['videos'][0]['coverImage']), 'Falha capa deve manter apenas permalink, sem URL temporaria Meta.');
$mediaCache->fail = false;

$first = videoFixture('#netcar19299', '18001234567890140');
$second = videoFixture('#netcar19974', '18001234567890141');
$second['permalink'] = $first['permalink'];
$feed->items = [$first, $second];
expectVideo($sync->sync(true)['count'] === 0, 'Mesmo permalink associado a duas unidades deve ser rejeitado.');
$feed->items = [$first, $first];
expectVideo($sync->sync(true)['count'] === 0, 'ID Meta duplicado deve ser rejeitado.');
$feed->items = [videoFixture('#netcar19299', '18001234567890142'), videoFixture('#netcar19299', '18001234567890143')];
$tie1 = $sync->sync(true)['videos'];
$feed->items = array_reverse($feed->items);
expectVideo($sync->sync(true)['videos'] === $tie1, 'Empate de timestamp deve ter resultado deterministico independente da ordem.');

// Paginacao nunca considera total_results como total geral e nao aceita estoque parcial.
$paged = new VideoPagedStock($feed, $mediaCache, null, $cachePath, static fn (): int => $now);
$paged->pages = [
    ['status' => 200, 'body' => ['success' => true, 'data' => [$stock[0]], 'total_results' => 1]],
    ['status' => 200, 'body' => ['success' => true, 'data' => [$stock[1]], 'total_results' => 1]],
    ['status' => 404, 'body' => ['success' => false, 'data' => [], 'total_results' => 0]],
];
expectVideo($paged->sync(true)['count'] === 1 && count($paged->requests) === 3 && strpos($paged->requests[2], 'offset=2') !== false, 'Buscar todas as paginas ate fim vazio confirmado.');
$beforePartial = file_get_contents($cachePath);
$paged->pages = [
    ['status' => 200, 'body' => ['success' => true, 'data' => [$stock[0]]]],
    ['status' => 502, 'body' => null],
];
try { $paged->sync(); expectVideo(false, 'Pagina parcial deve falhar.'); } catch (RuntimeException $error) { expectVideo(strpos($error->getMessage(), 'preservado') !== false, 'Falha pagina deve preservar cache.'); }
expectVideo(file_get_contents($cachePath) === $beforePartial, 'Estoque parcial nao pode apagar vinculos.');

// O endpoint aplica whitelist mesmo que o cache seja adulterado ou tenha campos privados.
$unsafeCache = ['syncedAt' => gmdate('c', $now), 'token' => 'secret', 'videos' => [array_merge($live['videos'][0], ['caption' => 'private', 'coverImage' => 'https://scontent.cdninstagram.com/expires.jpg'])]];
file_put_contents($cachePath, json_encode($unsafeCache));
$sanitized = VehicleVideoSync::publicResponse($cachePath, $now);
expectVideo(!isset($sanitized['token']) && !isset($sanitized['videos'][0]['caption']) && !isset($sanitized['videos'][0]['coverImage']), 'Publico deve omitir campos privados e capas externas.');
$unsafeCache['videos'][] = $unsafeCache['videos'][0];
file_put_contents($cachePath, json_encode($unsafeCache));
expectVideo(VehicleVideoSync::publicResponse($cachePath, $now)['videos'] === [], 'ID duplicado no cache nao deve ser publicado.');
file_put_contents($cachePath, '{broken');
expectVideo(VehicleVideoSync::publicResponse($cachePath, $now)['stale'], 'Cache corrompido pode usar backup atomico com stale.');

foreach (glob(dirname($cachePath) . '/*') ?: [] as $path) { unlink($path); }
rmdir(dirname($cachePath));
rmdir($directory);
echo "Vehicle video sync tests: OK\n";
