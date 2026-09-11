<?php

declare(strict_types=1);

/** Importa vinculos exatos do Instagram; nao publica nem altera posts nas redes sociais. */
class VehicleVideoSync
{
    private const STOCK_URL = 'https://www.netcarmultimarcas.com.br/api/v1/veiculos.php';
    private const STALE_AFTER = 1800;
    private const EXPIRE_AFTER = 172800;
    private InstagramFeedClient $feed;
    private InstagramPostMediaCache $mediaCache;
    private ?Closure $stockLoader;
    private Closure $clock;
    private string $cachePath;

    public function __construct(
        ?InstagramFeedClient $feed = null,
        ?InstagramPostMediaCache $mediaCache = null,
        ?callable $stockLoader = null,
        ?string $cachePath = null,
        ?callable $clock = null
    ) {
        $this->feed = $feed ?? new InstagramFeedClient();
        $this->mediaCache = $mediaCache ?? new InstagramPostMediaCache();
        $this->stockLoader = $stockLoader === null ? null : Closure::fromCallable($stockLoader);
        $this->clock = $clock === null ? static fn (): int => time() : Closure::fromCallable($clock);
        // Nao criar diretorios no construtor: dry-run nao escreve nem locks.
        $this->cachePath = $cachePath ?? SocialEnv::dataDir() . '/cache/vehicle-videos.json';
    }

    public function sync(bool $dryRun = false): array
    {
        $lock = null;
        if (!$dryRun) {
            $dir = dirname($this->cachePath);
            if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
                throw new RuntimeException('Cache de videos indisponivel.');
            }
            $lock = fopen($this->cachePath . '.lock', 'c');
            if ($lock === false) {
                throw new RuntimeException('Lock de videos indisponivel.');
            }
            if (!flock($lock, LOCK_EX | LOCK_NB)) {
                fclose($lock);
                throw new RuntimeException('Sincronizacao de videos ja esta em andamento.');
            }
        }

        try {
            try {
                $vehicles = $this->stockLoader === null ? $this->fetchVehicles() : ($this->stockLoader)();
                if (!is_array($vehicles)) {
                    throw new RuntimeException('Estoque invalido.');
                }
                foreach ($vehicles as $vehicle) {
                    if (!is_array($vehicle) || !preg_match('/^[1-9][0-9]*$/', (string) ($vehicle['id'] ?? ''))
                        || !isset($vehicle['valor']) || !is_numeric($vehicle['valor'])
                    ) {
                        throw new RuntimeException('Registro de estoque invalido.');
                    }
                }
            } catch (Throwable $error) {
                throw new RuntimeException('Falha ao consultar estoque completo; cache de videos preservado.');
            }
            try {
                $media = $this->feed->fetchRecent(500);
            } catch (Throwable $error) {
                // Respostas Meta podem conter detalhes privados: nao repassar o corpo do erro.
                throw new RuntimeException('Falha ao consultar feed Instagram; cache de videos preservado.');
            }

            $now = ($this->clock)();
            $syncedAt = gmdate('c', $now);
            $selected = [];
            $rejected = [];
            $idCounts = [];
            $urlCounts = [];
            foreach ($media as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $id = (string) ($item['id'] ?? '');
                $url = self::instagramPermalink((string) ($item['permalink'] ?? ''));
                $idCounts[$id] = ($idCounts[$id] ?? 0) + 1;
                if ($url !== null) {
                    $urlCounts[$url] = ($urlCounts[$url] ?? 0) + 1;
                }
            }

            foreach ($media as $item) {
                if (!is_array($item)) {
                    $rejected['invalid_media'] = ($rejected['invalid_media'] ?? 0) + 1;
                    continue;
                }
                $match = self::resolveVehicle($item, $vehicles);
                $id = (string) ($item['id'] ?? '');
                $url = self::instagramPermalink((string) ($item['permalink'] ?? ''));
                if (($idCounts[$id] ?? 0) > 1 || ($url !== null && ($urlCounts[$url] ?? 0) > 1)) {
                    $match = ['reason' => 'duplicate_media'];
                }
                $publishedAt = strtotime((string) ($item['publishedAt'] ?? ''));
                if ($publishedAt === false || $publishedAt > $now + 300) {
                    $match = ['reason' => 'invalid_timestamp'];
                }
                if (!isset($match['vehicle'])) {
                    $reason = $match['reason'];
                    $rejected[$reason] = ($rejected[$reason] ?? 0) + 1;
                    continue;
                }
                $vehicle = $match['vehicle'];
                $vehicleId = (string) $vehicle['id'];
                $candidate = ['media' => $item, 'vehicle' => $vehicle, 'timestamp' => $publishedAt];
                $current = $selected[$vehicleId] ?? null;
                if ($current === null || $publishedAt > $current['timestamp']
                    || ($publishedAt === $current['timestamp'] && strcmp($id, (string) $current['media']['id']) > 0)
                ) {
                    $selected[$vehicleId] = $candidate;
                }
            }

            ksort($selected, SORT_NATURAL);
            $videos = [];
            $coverFailures = 0;
            foreach ($selected as $vehicleId => $candidate) {
                $item = $candidate['media'];
                $vehicle = $candidate['vehicle'];
                $video = [
                    'vehicleId' => (string) $vehicleId,
                    'permalink' => self::instagramPermalink((string) $item['permalink']),
                    'stockPrice' => (float) $vehicle['valor'],
                    'verifiedAt' => $syncedAt,
                ];
                $model = trim((string) ($vehicle['modelo'] ?? ''));
                if ($model !== '') {
                    $video['displayModel'] = $model;
                }
                if (!$dryRun) {
                    try {
                        $this->mediaCache->cache($item);
                        $video['coverImage'] = '/social/v1/instagram-post-media.php?id=' . (string) $item['id'];
                    } catch (Throwable $error) {
                        // Um problema na capa nao impede o link correto; UI usa o fallback visual.
                        $coverFailures++;
                    }
                }
                $videos[] = $video;
            }
            $cache = ['syncedAt' => $syncedAt, 'videos' => $videos];
            if (!$dryRun) {
                $this->writeCache($cache);
            }
            return [
                'success' => true,
                'dryRun' => $dryRun,
                'syncedAt' => $syncedAt,
                'scanned' => count($media),
                'count' => count($videos),
                'coverFailures' => $coverFailures,
                'rejected' => $rejected,
                'videos' => $videos,
            ];
        } finally {
            if (is_resource($lock)) {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        }
    }

    /** @return array{reason:string,vehicle?:array} */
    public static function resolveVehicle(array $media, array $vehicles): array
    {
        if (($media['mediaType'] ?? '') !== 'VIDEO'
            || !preg_match('/^[0-9]+$/', (string) ($media['id'] ?? ''))
            || self::instagramPermalink((string) ($media['permalink'] ?? '')) === null
        ) {
            return ['reason' => 'invalid_video'];
        }
        $caption = (string) ($media['caption'] ?? '');
        $ids = [];
        preg_match_all('/(?<![\pL\pN_])#netcar([1-9][0-9]*)(?![\pL\pN_])/iu', $caption, $tags);
        foreach ($tags[1] as $id) {
            $ids[(string) $id] = true;
        }
        // Aceitar somente URLs exatas derivadas de registros do estoque, nunca um nome parecido.
        preg_match_all('~https?://[^\s<>"\x27]+~iu', $caption, $links);
        foreach ($links[0] as $link) {
            $link = rtrim($link, '.,;:!?)]}*');
            $path = self::netcarPath($link);
            if ($path === null) {
                continue;
            }
            $matchingIds = [];
            foreach ($vehicles as $vehicle) {
                if (is_array($vehicle) && in_array($path, self::vehiclePaths($vehicle), true)) {
                    $matchingIds[(string) ($vehicle['id'] ?? '')] = true;
                }
            }
            if ($matchingIds === [] && (strpos($path, '/veiculo/') === 0 || strpos($path, '/detalhe-') === 0)) {
                return ['reason' => 'vehicle_url_unresolved'];
            }
            foreach ($matchingIds as $id => $_) {
                $ids[(string) $id] = true;
            }
        }
        if (count($ids) !== 1) {
            return ['reason' => count($ids) === 0 ? 'vehicle_reference_missing' : 'vehicle_reference_ambiguous'];
        }
        $id = (string) array_key_first($ids);
        $matches = array_values(array_filter($vehicles, static fn ($vehicle): bool =>
            is_array($vehicle) && (string) ($vehicle['id'] ?? '') === $id
        ));
        // Mesmo registros identicos repetidos sao ambiguos; nao selecionar arbitrariamente.
        if (count($matches) !== 1) {
            return ['reason' => count($matches) > 1 ? 'stock_record_ambiguous' : 'vehicle_not_active'];
        }
        $vehicle = $matches[0];
        $price = is_numeric($vehicle['valor'] ?? null) ? (float) $vehicle['valor'] : 0;
        if (!is_finite($price) || $price <= 0 || in_array(strtolower(trim((string) ($vehicle['status'] ?? ''))), ['vendido', 'sold', 'inativo'], true)) {
            return ['reason' => 'vehicle_not_active'];
        }
        $priceReason = self::priceReason($caption, $price);
        if ($priceReason !== null) {
            return ['reason' => $priceReason];
        }
        return ['reason' => 'exact_vehicle_reference', 'vehicle' => $vehicle];
    }

    public static function instagramPermalink(string $url): ?string
    {
        $parts = parse_url($url);
        if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https'
            || !in_array(strtolower((string) ($parts['host'] ?? '')), ['instagram.com', 'www.instagram.com'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])
            || !preg_match('~^/(reel|p)/([A-Za-z0-9_-]+)/?$~D', (string) ($parts['path'] ?? ''), $match)
        ) {
            return null;
        }
        return 'https://www.instagram.com/' . $match[1] . '/' . $match[2] . '/';
    }

    /** Le apenas campos publicos; nunca carrega configuracao ou faz chamadas de rede. */
    public static function publicResponse(string $cachePath, ?int $now = null): ?array
    {
        $now = $now ?? time();
        $backup = false;
        $data = self::readCache($cachePath);
        if ($data === null) {
            $data = self::readCache($cachePath . '.backup');
            $backup = true;
        }
        if ($data === null) {
            return null;
        }
        $synced = strtotime($data['syncedAt']);
        $expired = $synced > $now + 300 || $now - $synced > self::EXPIRE_AFTER;
        $videos = [];
        $seen = [];
        foreach ($expired ? [] : $data['videos'] as $video) {
            if (!is_array($video)) {
                continue;
            }
            $id = (string) ($video['vehicleId'] ?? '');
            $url = self::instagramPermalink((string) ($video['permalink'] ?? ''));
            $verified = strtotime((string) ($video['verifiedAt'] ?? ''));
            $price = $video['stockPrice'] ?? null;
            if (!preg_match('/^[1-9][0-9]*$/', $id) || $url === null || $verified === false
                || $verified > $now + 300 || $now - $verified > self::EXPIRE_AFTER
                || !is_numeric($price) || !is_finite((float) $price) || (float) $price <= 0
            ) {
                continue;
            }
            if (isset($seen[$id])) {
                // Cache corrompido com ID duplicado nao pode escolher o primeiro vinculo.
                unset($videos[$id]);
                continue;
            }
            $seen[$id] = true;
            $entry = ['vehicleId' => $id, 'permalink' => $url, 'stockPrice' => (float) $price, 'verifiedAt' => gmdate('c', $verified)];
            $cover = (string) ($video['coverImage'] ?? '');
            if (preg_match('~^/social/v1/instagram-post-media\.php\?id=[0-9]+$~D', $cover)) {
                $entry['coverImage'] = $cover;
            }
            if (is_string($video['displayModel'] ?? null) && trim($video['displayModel']) !== '') {
                $entry['displayModel'] = trim($video['displayModel']);
            }
            $videos[$id] = $entry;
        }
        return [
            'success' => true,
            'stale' => $backup || $expired || $now - $synced > self::STALE_AFTER,
            'syncedAt' => gmdate('c', $synced),
            'videos' => array_values($videos),
        ];
    }

    private static function priceReason(string $caption, float $stockPrice): ?string
    {
        // Cada R$ deve ter um valor brasileiro completo. Precos antigos/parcelas conflitantes exigem revisao.
        preg_match_all('/R\$\s*([^\s*\n]+)/iu', $caption, $mentions);
        foreach ($mentions[1] as $raw) {
            $raw = rtrim($raw, '.;!?)');
            if (!preg_match('/^(?:[0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)(?:,[0-9]{2})?$/D', $raw)) {
                return 'advertised_price_unreadable';
            }
            $price = (float) str_replace(',', '.', str_replace('.', '', $raw));
            if (abs($price - $stockPrice) >= 0.005) {
                return 'advertised_price_mismatch';
            }
        }
        if (stripos($caption, 'R$') !== false && $mentions[1] === []) {
            return 'advertised_price_unreadable';
        }
        return null;
    }

    private static function netcarPath(string $url): ?string
    {
        $parts = parse_url($url);
        if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['https', 'http'], true)
            || !in_array(strtolower((string) ($parts['host'] ?? '')), ['netcarmultimarcas.com.br', 'www.netcarmultimarcas.com.br'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])
        ) {
            return null;
        }
        return rtrim((string) ($parts['path'] ?? ''), '/');
    }

    private static function vehiclePaths(array $vehicle): array
    {
        $id = (string) ($vehicle['id'] ?? '');
        if (!preg_match('/^[1-9][0-9]*$/', $id)) {
            return [];
        }
        $paths = ['/veiculo/' . $id];
        $canonical = NetcarStockVehicleDestinationResolver::resolveFromVehicles('#netcar' . $id, [$vehicle]);
        if ($canonical !== null) {
            $paths[] = (string) parse_url($canonical, PHP_URL_PATH);
        }
        // O frontend remove a marca no inicio do modelo e descarta pontuacao.
        $model = trim((string) ($vehicle['modelo'] ?? ''));
        $brand = trim((string) ($vehicle['marca'] ?? ''));
        if ($brand !== '' && strncasecmp($model, $brand, strlen($brand)) === 0) {
            $model = trim(substr($model, strlen($brand)));
        }
        if (function_exists('iconv')) {
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $model);
            $model = is_string($ascii) ? $ascii : $model;
        }
        $model = preg_replace('/[^a-z0-9\s-]/', '', strtolower($model));
        $model = trim((string) preg_replace('/[\s-]+/', '-', $model), '-');
        $slug = $model === '' ? [] : [$model];
        if ((int) ($vehicle['ano'] ?? 0) > 0) {
            $slug[] = (string) $vehicle['ano'];
        }
        $plate = strtoupper((string) preg_replace('/[\s-]/', '', (string) ($vehicle['placa'] ?? '')));
        if ($plate !== '') {
            $slug[] = strtolower(strlen($plate) >= 5 ? substr($plate, 0, 3) . '-xx' . substr($plate, -2) : $plate);
        }
        $slug[] = $id;
        $paths[] = '/veiculo/' . implode('-', $slug);
        $legacy = trim((string) ($vehicle['link'] ?? ''));
        if ($legacy !== '') {
            $legacyUrl = strpos($legacy, '://') === false ? 'https://www.netcarmultimarcas.com.br/' . ltrim($legacy, './') : $legacy;
            $legacyPath = self::netcarPath($legacyUrl);
            if ($legacyPath !== null && strpos($legacyPath, '/detalhe-') === 0) {
                $paths[] = $legacyPath;
            }
        }
        return array_values(array_unique($paths));
    }

    protected function fetchVehicles(): array
    {
        $vehicles = [];
        // A API informa total_results da pagina, nao do estoque: buscar ate pagina vazia.
        for ($page = 0; $page < 100; $page++) {
            $response = $this->requestStockPage(self::STOCK_URL . '?limit=100&offset=' . count($vehicles));
            $body = $response['body'] ?? null;
            // A API oficial retorna 404 com lista vazia ao terminar o estoque.
            if (($response['status'] ?? 0) === 404 && is_array($body) && ($body['success'] ?? null) === false
                && ($body['data'] ?? null) === [] && ($body['total_results'] ?? null) === 0
            ) {
                return $vehicles;
            }
            if (($response['status'] ?? 0) !== 200 || !is_array($body) || ($body['success'] ?? false) !== true
                || !isset($body['data']) || !is_array($body['data']) || array_values($body['data']) !== $body['data']
                || count($body['data']) > 100
            ) {
                throw new RuntimeException('Resposta do estoque invalida.');
            }
            if ($body['data'] === []) {
                return $vehicles;
            }
            $vehicles = array_merge($vehicles, $body['data']);
        }
        throw new RuntimeException('Limite de paginacao do estoque atingido; sincronizacao adiada.');
    }

    protected function requestStockPage(string $url): array
    {
        $curl = curl_init($url);
        if ($curl === false) {
            throw new RuntimeException('Cliente HTTP indisponivel.');
        }
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $raw = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        return ['status' => $status, 'body' => is_string($raw) ? json_decode($raw, true) : null];
    }

    protected function writeCache(array $cache): void
    {
        $json = json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (self::readCache($this->cachePath) !== null) {
            $this->writeAtomically($this->cachePath . '.backup', (string) file_get_contents($this->cachePath));
        }
        $this->writeAtomically($this->cachePath, $json);
    }

    protected function writeAtomically(string $target, string $json): void
    {
        $temporary = tempnam(dirname($target), 'vehicle-videos-');
        if ($temporary === false) {
            throw new RuntimeException('Arquivo temporario de videos indisponivel.');
        }
        try {
            $bytes = file_put_contents($temporary, $json, LOCK_EX);
            if ($bytes !== strlen($json)) {
                throw new RuntimeException('Falha ao gravar cache de videos.');
            }
            @chmod($temporary, 0644);
            $this->activateCache($temporary, $target);
        } finally {
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }

    protected function activateCache(string $temporary, string $target): void
    {
        if (!rename($temporary, $target)) {
            throw new RuntimeException('Falha ao ativar cache de videos.');
        }
    }

    private static function readCache(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        $raw = file_get_contents($path);
        $data = $raw === false ? null : json_decode($raw, true);
        return is_array($data) && is_string($data['syncedAt'] ?? null)
            && strtotime($data['syncedAt']) !== false && is_array($data['videos'] ?? null) ? $data : null;
    }
}
