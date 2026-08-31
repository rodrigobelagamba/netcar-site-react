<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

function hardExpect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function hardExpectThrows(callable $operation, string $messagePart, string $message): void
{
    try {
        $operation();
    } catch (Throwable $error) {
        if ($messagePart === '' || strpos($error->getMessage(), $messagePart) !== false) {
            return;
        }
        throw new RuntimeException($message . ' Erro inesperado: ' . $error->getMessage());
    }
    throw new RuntimeException($message);
}

function hardSetConfig(
    string $privateDir,
    string $notBefore,
    int $maxPostsPerRun = 3,
    bool $enabled = true
): void
{
    $property = new ReflectionProperty(SocialEnv::class, 'config');
    $property->setAccessible(true);
    $property->setValue(null, [
        'private_data_dir' => $privateDir,
        'meta' => ['graph_version' => 'v21.0'],
        'google_posts' => [
            'enabled' => $enabled,
            'not_before' => $notBefore,
            'max_feed_items' => 500,
            'max_posts_per_run' => $maxPostsPerRun,
            'max_activation_age_seconds' => 1800,
            'fallback_url' => 'https://www.netcarmultimarcas.com.br/seminovos',
            'locations' => [
                'loja_1' => '11161331340741727452',
                'loja_2' => '17013442122163034193',
            ],
        ],
    ]);
}

function hardMedia(string $id, int $publishedAt): array
{
    return [
        'id' => $id,
        'caption' => "Oferta {$id}\nAnúncio: https://www.netcarmultimarcas.com.br/veiculo/{$id}",
        'mediaType' => 'IMAGE',
        'mediaUrl' => 'https://scontent.cdninstagram.com/' . rawurlencode($id) . '.jpg',
        'thumbnailUrl' => '',
        'permalink' => 'https://www.instagram.com/p/' . rawurlencode($id) . '/',
        'publishedAt' => gmdate('c', $publishedAt),
    ];
}

function hardCleanupState(string $statePath, string $privateDir): void
{
    @unlink($statePath);
    @unlink($statePath . '.lock');
    @unlink($privateDir . '/google-posts-settings.json');
    @rmdir($privateDir);
}

final class HardPagedInstagramClient extends InstagramFeedClient
{
    private array $responses;
    public array $requests = [];

    public function __construct(array $responses)
    {
        parent::__construct();
        $this->responses = $responses;
    }

    protected function credentials(): array
    {
        return ['accessToken' => 'test-token', 'instagramUserId' => 'ig-test'];
    }

    protected function requestGet(string $url): array
    {
        $this->requests[] = $url;
        if (!$this->responses) {
            throw new RuntimeException('Teste solicitou uma pagina Instagram inesperada.');
        }
        return array_shift($this->responses);
    }
}

$bootstrapPrivateDir = sys_get_temp_dir() . '/netcar-hardening-bootstrap-' . getmypid();
hardSetConfig($bootstrapPrivateDir, gmdate('c', time() - 60));

$now = time();
$instagramPage1 = [
    'status' => 200,
    'body' => [
        'data' => [
            ['id' => 'newest', 'timestamp' => gmdate('c', $now), 'media_type' => 'IMAGE'],
            ['id' => 'middle', 'timestamp' => gmdate('c', $now - 30), 'media_type' => 'IMAGE'],
        ],
        'paging' => ['next' => 'https://graph.facebook.com/v21.0/ig-test/media?page=2'],
    ],
    'raw' => '',
];
$instagramPage2 = [
    'status' => 200,
    'body' => [
        'data' => [
            ['id' => 'old-eligible', 'timestamp' => gmdate('c', $now - 90), 'media_type' => 'IMAGE'],
            ['id' => 'before-cutoff', 'timestamp' => gmdate('c', $now - 300), 'media_type' => 'IMAGE'],
        ],
    ],
    'raw' => '',
];

$pagedInstagram = new HardPagedInstagramClient([$instagramPage1, $instagramPage2]);
$pagedMedia = $pagedInstagram->fetchSince($now - 120, 20);
hardExpect(count($pagedMedia) === 3, 'Feed Instagram deve paginar ate encontrar o cutoff.');
hardExpect(count($pagedInstagram->requests) === 2, 'Feed Instagram deve consultar a segunda pagina.');
hardExpect($pagedMedia[0]['id'] === 'old-eligible', 'Feed paginado deve voltar em ordem cronologica.');

$limitedRecent = new HardPagedInstagramClient([$instagramPage1]);
$recentMedia = $limitedRecent->fetchRecent(2);
hardExpect(count($recentMedia) === 2, 'fetchRecent deve aceitar atingir seu limite normal.');
hardExpect(count($limitedRecent->requests) === 1, 'fetchRecent deve parar sem buscar pagina extra ao atingir o limite.');

$strictCutoff = new HardPagedInstagramClient([$instagramPage1]);
hardExpectThrows(
    static function () use ($strictCutoff, $now): void {
        $strictCutoff->fetchSince($now - 120, 2);
    },
    'excedeu o limite seguro',
    'Busca com cutoff nao pode truncar silenciosamente o feed.'
);

class HardPagedGoogleClient extends GoogleLocalPostsClient
{
    public array $requests = [];

    public function __construct()
    {
    }

    protected function requestGet(string $url): array
    {
        $this->requests[] = $url;
        $parts = parse_url($url);
        parse_str((string) ($parts['query'] ?? ''), $query);
        $host = (string) ($parts['host'] ?? '');
        $path = (string) ($parts['path'] ?? '');

        if ($host === 'mybusinessaccountmanagement.googleapis.com') {
            if (($query['pageToken'] ?? '') === '') {
                return $this->ok([
                    'accounts' => [['name' => 'accounts/1']],
                    'nextPageToken' => 'accounts-page-2',
                ]);
            }
            if (($query['pageToken'] ?? '') === 'accounts-page-2') {
                return $this->ok(['accounts' => [['name' => 'accounts/2']]]);
            }
        }

        if ($host === 'mybusinessbusinessinformation.googleapis.com'
            && strpos($path, '/accounts/1/locations') !== false
        ) {
            return $this->ok(['locations' => [['name' => 'locations/999', 'title' => 'Outra loja']]]);
        }

        if ($host === 'mybusinessbusinessinformation.googleapis.com'
            && strpos($path, '/accounts/2/locations') !== false
        ) {
            if (($query['pageToken'] ?? '') === '') {
                return $this->ok([
                    'locations' => [[
                        'name' => 'locations/17013442122163034193',
                        'title' => 'Netcar Loja 2',
                    ]],
                    'nextPageToken' => 'locations-page-2',
                ]);
            }
            if (($query['pageToken'] ?? '') === 'locations-page-2') {
                return $this->ok(['locations' => [[
                    'name' => 'locations/11161331340741727452',
                    'title' => 'Netcar Loja 1',
                ]]]);
            }
        }

        throw new RuntimeException('URL Google inesperada no teste: ' . $url);
    }

    private function ok(array $body): array
    {
        return ['status' => 200, 'body' => $body, 'raw' => ''];
    }
}

$locationConfig = [
    'loja_1' => '11161331340741727452',
    'loja_2' => '17013442122163034193',
];
$pagedGoogle = new HardPagedGoogleClient();
$targetLocations = $pagedGoogle->listTargetLocations($locationConfig);
hardExpect(count($targetLocations) === 2, 'Google deve encontrar exatamente as duas locations configuradas.');
hardExpect($targetLocations[0]['slug'] === 'loja_1', 'Locations devem manter a ordem da configuracao.');
hardExpect($targetLocations[1]['slug'] === 'loja_2', 'Segunda location deve manter a ordem da configuracao.');
hardExpect(count($pagedGoogle->requests) === 5, 'Google deve paginar contas e locations ate encontrar as duas lojas.');
hardExpect(
    count(array_filter($pagedGoogle->requests, static function (string $url): bool {
        return strpos($url, 'pageToken=accounts-page-2') !== false;
    })) === 1,
    'accounts.list deve usar o nextPageToken.'
);

$invalidGoogle = new HardPagedGoogleClient();
hardExpectThrows(
    static function () use ($invalidGoogle): void {
        $invalidGoogle->listTargetLocations([
            'Loja 1' => '11161331340741727452',
            'loja1' => '17013442122163034193',
        ]);
    },
    'slugs unicos',
    'Configuracao deve rejeitar slugs que colidem depois da normalizacao.'
);
hardExpect(count($invalidGoogle->requests) === 0, 'Configuracao invalida deve falhar antes de consultar o Google.');

$duplicateIdGoogle = new HardPagedGoogleClient();
hardExpectThrows(
    static function () use ($duplicateIdGoogle): void {
        $duplicateIdGoogle->listTargetLocations([
            'loja_1' => '11161331340741727452',
            'loja_2' => '11161331340741727452',
        ]);
    },
    'IDs unicos',
    'Configuracao deve rejeitar IDs de location duplicados.'
);

final class HardRepeatedPostTokenGoogleClient extends GoogleLocalPostsClient
{
    public int $requests = 0;

    public function __construct()
    {
    }

    protected function requestGet(string $url): array
    {
        $this->requests++;
        return [
            'status' => 200,
            'body' => ['localPosts' => [], 'nextPageToken' => 'repeated-token'],
            'raw' => '',
        ];
    }
}

$repeatedPostToken = new HardRepeatedPostTokenGoogleClient();
hardExpectThrows(
    static function () use ($repeatedPostToken): void {
        $repeatedPostToken->findByMarker('accounts/1/locations/1', 'utm_content=missing');
    },
    'repetiu o token',
    'Reconciliacao deve abortar quando o Google repete o token de paginacao.'
);
hardExpect($repeatedPostToken->requests === 2, 'Token repetido deve ser detectado na segunda pagina.');

$oauthPath = sys_get_temp_dir() . '/netcar-oauth-state-' . getmypid() . '.json';
$oauthStates = new OAuthStateStore($oauthPath);
$googleState = $oauthStates->issue('google');
$metaState = $oauthStates->issue('meta');
hardExpect((bool) preg_match('/^[a-f0-9]{64}$/', $googleState), 'Nonce OAuth deve ser criptograficamente aleatorio.');
hardExpect($oauthStates->consume($googleState, 'meta') === false, 'Nonce OAuth nao pode trocar de provider.');
hardExpect($oauthStates->consume($googleState, 'google') === false, 'Nonce OAuth usado com provider errado deve ser invalidado.');
hardExpect($oauthStates->consume($metaState, 'meta') === true, 'Nonce OAuth valido deve ser aceito uma vez.');
hardExpect($oauthStates->consume($metaState, 'meta') === false, 'Nonce OAuth nao pode ser reutilizado.');
@unlink($oauthPath);
@unlink($oauthPath . '.lock');

final class HardInspectableMediaCache extends InstagramPostMediaCache
{
    public function existingIsValid(array $meta, string $dir): bool
    {
        return $this->isExistingCacheValid($meta, $dir);
    }

    public function writeMeta(string $path, string $json): void
    {
        $this->writeMetadataAtomically($path, $json);
    }
}

function hardPngChunk(string $type, string $data): string
{
    return pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
}

function hardTestPng(): string
{
    $width = 300;
    $height = 300;
    $raw = '';
    for ($y = 0; $y < $height; $y++) {
        $row = "\0";
        for ($x = 0; $x < $width; $x++) {
            $row .= chr(($x + $y) % 256) . chr(($x * 3) % 256) . chr(($y * 5) % 256);
        }
        $raw .= $row;
    }
    $header = pack('NNCCCCC', $width, $height, 8, 2, 0, 0, 0);
    return "\x89PNG\r\n\x1A\n"
        . hardPngChunk('IHDR', $header)
        . hardPngChunk('IDAT', gzcompress($raw, 6))
        . hardPngChunk('IEND', '');
}

$cacheValidationDir = sys_get_temp_dir() . '/netcar-media-cache-' . getmypid();
mkdir($cacheValidationDir, 0700, true);
$cacheImagePath = $cacheValidationDir . '/ig-cache.png';
$cacheImage = hardTestPng();
file_put_contents($cacheImagePath, $cacheImage, LOCK_EX);
$cacheMeta = [
    'file' => 'ig-cache.png',
    'contentType' => 'image/png',
    'contentSha256' => hash('sha256', $cacheImage),
];
$inspectableCache = new HardInspectableMediaCache();
hardExpect(
    $inspectableCache->existingIsValid($cacheMeta, $cacheValidationDir),
    'Cache existente valido deve passar por hash, magic bytes e dimensoes.'
);
$badHashMeta = $cacheMeta;
$badHashMeta['contentSha256'] = str_repeat('0', 64);
hardExpect(
    !$inspectableCache->existingIsValid($badHashMeta, $cacheValidationDir),
    'Cache existente com hash divergente deve ser rejeitado.'
);
file_put_contents($cacheImagePath, str_repeat('x', 1024), LOCK_EX);
hardExpect(
    !$inspectableCache->existingIsValid($cacheMeta, $cacheValidationDir),
    'Cache existente com magic bytes invalidos deve ser rejeitado.'
);
$atomicMetaPath = $cacheValidationDir . '/ig-cache.json';
$atomicMetaJson = (string) json_encode($cacheMeta, JSON_UNESCAPED_SLASHES);
$inspectableCache->writeMeta($atomicMetaPath, $atomicMetaJson);
hardExpect(
    file_get_contents($atomicMetaPath) === $atomicMetaJson,
    'Metadata deve ser promovida integralmente por escrita atomica.'
);
hardExpect(count(glob($cacheValidationDir . '/ig-meta-*') ?: []) === 0, 'Metadata atomica nao deve deixar temporarios.');
@unlink($atomicMetaPath);
@unlink($cacheImagePath);
@rmdir($cacheValidationDir);

class HardFeedClient extends InstagramFeedClient
{
    private array $items;
    public array $cutoffs = [];

    public function __construct(array $items)
    {
        $this->items = $items;
    }

    public function fetchRecent(int $limit = 25): array
    {
        return $this->fetchSince(0, $limit);
    }

    public function fetchSince(int $notBefore, int $maxItems = 500): array
    {
        $this->cutoffs[] = $notBefore;
        $eligible = array_values(array_filter($this->items, static function (array $item) use ($notBefore): bool {
            $publishedAt = strtotime((string) ($item['publishedAt'] ?? ''));
            return $publishedAt !== false && ($notBefore <= 0 || $publishedAt >= $notBefore);
        }));
        usort($eligible, static function (array $a, array $b): int {
            return strcmp((string) $a['publishedAt'], (string) $b['publishedAt']);
        });
        return array_slice($eligible, 0, $maxItems);
    }
}

final class HardFailingFeedClient extends InstagramFeedClient
{
    public function __construct()
    {
    }

    public function fetchRecent(int $limit = 25): array
    {
        return $this->fetchSince(0, $limit);
    }

    public function fetchSince(int $notBefore, int $maxItems = 500): array
    {
        throw new RuntimeException('Falha simulada na primeira descoberta Instagram.');
    }
}

class HardGoogleClient extends GoogleLocalPostsClient
{
    public int $createCalls = 0;
    public array $createdParents = [];
    public ?string $permanentFailureLocationId = null;
    public ?string $timeoutAfterCreateLocationId = null;
    public string $createdState = 'LIVE';
    public bool $forceGetNotFound = false;
    private bool $timeoutRaised = false;
    private array $remotes = [];

    public function __construct()
    {
    }

    public function listTargetLocations(array $configuredLocations): array
    {
        return [
            [
                'slug' => 'loja_1',
                'id' => '11161331340741727452',
                'title' => 'Netcar Loja 1',
                'parent' => 'accounts/1/locations/11161331340741727452',
            ],
            [
                'slug' => 'loja_2',
                'id' => '17013442122163034193',
                'title' => 'Netcar Loja 2',
                'parent' => 'accounts/1/locations/17013442122163034193',
            ],
        ];
    }

    public function findByMarker(string $parent, string $marker): ?array
    {
        foreach ($this->remotes as $remote) {
            $url = (string) ($remote['callToAction']['url'] ?? '');
            if (strpos($url, $marker) !== false) {
                return $remote;
            }
        }
        return null;
    }

    public function create(string $parent, array $payload): array
    {
        $this->createCalls++;
        $this->createdParents[] = $parent;
        $remote = [
            'name' => $parent . '/localPosts/test-' . $this->createCalls,
            'state' => $this->createdState,
            'callToAction' => $payload['callToAction'],
        ];

        if ($this->permanentFailureLocationId !== null
            && strpos($parent, $this->permanentFailureLocationId) !== false
        ) {
            throw new GoogleLocalPostsException('Falha permanente simulada.', 400);
        }

        $this->remotes[$remote['name']] = $remote;
        if (!$this->timeoutRaised
            && $this->timeoutAfterCreateLocationId !== null
            && strpos($parent, $this->timeoutAfterCreateLocationId) !== false
        ) {
            $this->timeoutRaised = true;
            throw new GoogleLocalPostsException('Timeout apos POST simulado.', 504);
        }

        return $remote;
    }

    public function get(string $postName): array
    {
        if ($this->forceGetNotFound) {
            throw new GoogleLocalPostsException('404 simulado ao consultar post.', 404);
        }
        if (!isset($this->remotes[$postName])) {
            throw new GoogleLocalPostsException('Post remoto nao encontrado no teste.', 404);
        }
        return $this->remotes[$postName];
    }
}

final class HardChangedLocationGoogleClient extends HardGoogleClient
{
    public function listTargetLocations(array $configuredLocations): array
    {
        return [
            [
                'slug' => 'loja_1',
                'id' => '11161331340741727452',
                'title' => 'Netcar Loja 1',
                'parent' => 'accounts/1/locations/11161331340741727452',
            ],
            [
                'slug' => 'loja_2',
                'id' => '99999999999999999999',
                'title' => 'Netcar Loja 2 nova',
                'parent' => 'accounts/1/locations/99999999999999999999',
            ],
        ];
    }
}

final class HardMediaCache extends InstagramPostMediaCache
{
    public int $cacheCalls = 0;

    public function cache(array $media): string
    {
        $this->cacheCalls++;
        return $this->publicUrl((string) $media['id']);
    }

    public function publicUrl(string $mediaId): string
    {
        return 'https://www.netcarmultimarcas.com.br/social/v1/instagram-post-media.php?id=' . rawurlencode($mediaId);
    }
}

// Um estado parcialmente concluido (Loja 1 live) ainda precisa publicar na Loja 2.
$missingPrivateDir = sys_get_temp_dir() . '/netcar-missing-location-private-' . getmypid();
$missingStatePath = sys_get_temp_dir() . '/netcar-missing-location-' . getmypid() . '.json';
$missingCutoff = time() - 120;
$missingMedia = hardMedia('missing-location', time() - 30);
hardSetConfig($missingPrivateDir, gmdate('c', $missingCutoff));
$missingStore = new GooglePostsStateStore($missingStatePath);
$missingStore->lock();
$missingStore->save([
    'activationCutoff' => gmdate('c', $missingCutoff),
    'lastDiscoveryAt' => gmdate('c'),
    'posts' => [
        'missing-location' => [
            'instagramPermalink' => $missingMedia['permalink'],
            'publishedAt' => $missingMedia['publishedAt'],
            'source' => $missingMedia,
            'locations' => [
                'loja_1' => ['status' => 'live', 'googleState' => 'LIVE'],
            ],
        ],
    ],
]);
$missingStore->unlock();
$missingGoogle = new HardGoogleClient();
$missingPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$missingMedia]),
    $missingGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($missingStatePath)
);
$missingResult = $missingPublisher->sync(false);
hardExpect($missingResult['created'] === 1, 'Post com apenas uma loja live deve criar a location ausente.');
hardExpect($missingResult['alreadyLive'] === 1, 'Post parcial deve preservar a loja que ja esta live.');
hardExpect(
    strpos($missingGoogle->createdParents[0] ?? '', '17013442122163034193') !== false,
    'Retry parcial deve escrever somente na Loja 2 ausente.'
);
hardCleanupState($missingStatePath, $missingPrivateDir);

// Trocar o ID por tras de um slug invalida somente a location alterada e exige novo handover.
$changedPrivateDir = sys_get_temp_dir() . '/netcar-changed-location-private-' . getmypid();
$changedStatePath = sys_get_temp_dir() . '/netcar-changed-location-' . getmypid() . '.json';
$changedCutoff = time() - 60;
$changedMedia = hardMedia('changed-location', time() - 10);
hardSetConfig($changedPrivateDir, gmdate('c', $changedCutoff));
$changedStore = new GooglePostsStateStore($changedStatePath);
$changedStore->lock();
$changedStore->save([
    'activationCutoff' => gmdate('c', $changedCutoff),
    'activationCompletedAt' => gmdate('c'),
    'lastDiscoveryAt' => gmdate('c'),
    'publisherEnabled' => true,
    'locationFingerprint' => [
        'loja_1' => '11161331340741727452',
        'loja_2' => '17013442122163034193',
    ],
    'posts' => [
        'changed-location' => [
            'instagramPermalink' => $changedMedia['permalink'],
            'publishedAt' => $changedMedia['publishedAt'],
            'source' => $changedMedia,
            'locations' => [
                'loja_1' => [
                    'status' => 'live',
                    'googleState' => 'LIVE',
                    'locationId' => '11161331340741727452',
                ],
                'loja_2' => [
                    'status' => 'live',
                    'googleState' => 'LIVE',
                    'locationId' => '17013442122163034193',
                ],
            ],
        ],
    ],
]);
$changedStore->unlock();
$changedGoogle = new HardChangedLocationGoogleClient();
$changedPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$changedMedia]),
    $changedGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($changedStatePath)
);
$changedResult = $changedPublisher->sync(false);
hardExpect($changedResult['created'] === 1, 'Troca de ID deve recriar somente a location alterada.');
hardExpect(
    strpos($changedGoogle->createdParents[0] ?? '', '99999999999999999999') !== false,
    'Troca de ID deve escrever exclusivamente no novo destino validado.'
);
$changedState = json_decode((string) file_get_contents($changedStatePath), true);
hardExpect(
    ($changedState['locationFingerprint']['loja_2'] ?? '') === '99999999999999999999',
    'Estado deve persistir o novo fingerprint slug para ID.'
);
hardCleanupState($changedStatePath, $changedPrivateDir);

// O cutoff exclui posts antigos e o limite por execucao escoa backlog sem perda.
$backlogPrivateDir = sys_get_temp_dir() . '/netcar-backlog-private-' . getmypid();
$backlogStatePath = sys_get_temp_dir() . '/netcar-backlog-' . getmypid() . '.json';
$backlogCutoff = time() - 120;
$oldMedia = hardMedia('before-handover', $backlogCutoff - 60);
$backlogItems = [
    $oldMedia,
    hardMedia('eligible-1', $backlogCutoff + 10),
    hardMedia('eligible-2', $backlogCutoff + 30),
    hardMedia('eligible-3', $backlogCutoff + 50),
];
hardSetConfig($backlogPrivateDir, gmdate('c', $backlogCutoff), 1);
$backlogGoogle = new HardGoogleClient();
$backlogPublisher = new InstagramGbpPublisher(
    new HardFeedClient($backlogItems),
    $backlogGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($backlogStatePath)
);
$backlogFirst = $backlogPublisher->sync(false);
hardExpect($backlogFirst['pendingMedia'] === 3, 'Primeira execucao deve descobrir os tres posts elegiveis.');
hardExpect($backlogFirst['backlogMedia'] === 2, 'Limite de um post deve deixar dois itens no backlog.');
hardExpect($backlogFirst['created'] === 2, 'Um item do backlog deve ser publicado nas duas lojas.');
$backlogState = json_decode((string) file_get_contents($backlogStatePath), true);
hardExpect(!isset($backlogState['posts']['before-handover']), 'Post anterior ao cutoff nao pode entrar no estado.');
$backlogSecond = $backlogPublisher->sync(false);
hardExpect($backlogSecond['pendingMedia'] === 2, 'Segunda execucao deve continuar do backlog restante.');
hardExpect($backlogSecond['backlogMedia'] === 1, 'Backlog deve diminuir a cada execucao.');
hardExpect($backlogGoogle->createCalls === 4, 'Duas execucoes devem criar dois posts, cada um em duas lojas.');
hardCleanupState($backlogStatePath, $backlogPrivateDir);

// Erro 4xx fica visivel em todas as execucoes, mas nao bloqueia posts novos nem repete POST.
$errorPrivateDir = sys_get_temp_dir() . '/netcar-persistent-error-private-' . getmypid();
$errorStatePath = sys_get_temp_dir() . '/netcar-persistent-error-' . getmypid() . '.json';
$errorCutoff = time() - 120;
$errorMedia = hardMedia('permanent-error', time() - 20);
hardSetConfig($errorPrivateDir, gmdate('c', $errorCutoff));
$errorGoogle = new HardGoogleClient();
$errorGoogle->permanentFailureLocationId = '17013442122163034193';
$errorPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$errorMedia]),
    $errorGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($errorStatePath)
);
$errorFirst = $errorPublisher->sync(false);
hardExpect($errorFirst['success'] === false, 'Erro permanente deve falhar visivelmente na primeira execucao.');
hardExpect($errorGoogle->createCalls === 2, 'Primeira execucao deve tentar cada loja uma unica vez.');
$persistentState = json_decode((string) file_get_contents($errorStatePath), true);
hardExpect(
    ($persistentState['posts']['permanent-error']['locations']['loja_2']['attempts'] ?? 0) === 1,
    'Falha de criacao deve registrar exatamente uma tentativa.'
);
$errorSecond = $errorPublisher->sync(false);
hardExpect($errorSecond['success'] === false, 'Erro persistente deve continuar visivel nas execucoes seguintes.');
hardExpect($errorSecond['pendingMedia'] === 0, 'Erro permanente nao deve consumir vaga do backlog de retries.');
hardExpect($errorGoogle->createCalls === 2, 'Erro permanente nao pode repetir o POST automaticamente.');
hardExpect(!empty($errorSecond['errors'][0]['persistent']), 'Resposta deve identificar o erro persistente.');
hardCleanupState($errorStatePath, $errorPrivateDir);

// Se houver timeout depois do POST, o marcador remoto reconcilia sem duplicar publicacao.
$timeoutPrivateDir = sys_get_temp_dir() . '/netcar-timeout-private-' . getmypid();
$timeoutStatePath = sys_get_temp_dir() . '/netcar-timeout-' . getmypid() . '.json';
$timeoutCutoff = time() - 120;
$timeoutMedia = hardMedia('timeout-after-post', time() - 20);
hardSetConfig($timeoutPrivateDir, gmdate('c', $timeoutCutoff));
$timeoutGoogle = new HardGoogleClient();
$timeoutGoogle->timeoutAfterCreateLocationId = '11161331340741727452';
$timeoutPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$timeoutMedia]),
    $timeoutGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($timeoutStatePath)
);
$timeoutFirst = $timeoutPublisher->sync(false);
hardExpect($timeoutFirst['success'] === false, 'Timeout apos POST deve ser reportado como erro retryable.');
hardExpect($timeoutGoogle->createCalls === 2, 'Primeira execucao deve fazer no maximo um POST por loja.');
$timeoutState = json_decode((string) file_get_contents($timeoutStatePath), true);
hardExpect(
    ($timeoutState['posts']['timeout-after-post']['locations']['loja_1']['attempts'] ?? 0) === 1,
    'Timeout depois do POST nao pode incrementar a mesma tentativa duas vezes.'
);
$timeoutState['posts']['timeout-after-post']['locations']['loja_1']['nextAttemptAt'] = gmdate('c', time() - 1);
file_put_contents(
    $timeoutStatePath,
    (string) json_encode($timeoutState, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    LOCK_EX
);
$timeoutSecond = $timeoutPublisher->sync(false);
hardExpect($timeoutSecond['success'] === true, 'Retry deve reconciliar o post remoto criado antes do timeout.');
hardExpect($timeoutSecond['reconciled'] === 1, 'Retry deve localizar a publicacao pelo marcador UTM.');
hardExpect($timeoutGoogle->createCalls === 2, 'Reconciliacao nao pode executar um segundo POST para a mesma loja.');
$reconciledState = json_decode((string) file_get_contents($timeoutStatePath), true);
hardExpect(
    ($reconciledState['posts']['timeout-after-post']['locations']['loja_1']['attempts'] ?? 0) === 1,
    'Reconciliacao remota deve preservar o contador de uma unica tentativa.'
);
hardCleanupState($timeoutStatePath, $timeoutPrivateDir);

// Um GET 404 de post salvo deve reconciliar pelo marcador antes de cogitar novo POST.
$notFoundPrivateDir = sys_get_temp_dir() . '/netcar-get-404-private-' . getmypid();
$notFoundStatePath = sys_get_temp_dir() . '/netcar-get-404-' . getmypid() . '.json';
$notFoundCutoff = time() - 120;
$notFoundMedia = hardMedia('get-404-reconcile', time() - 20);
hardSetConfig($notFoundPrivateDir, gmdate('c', $notFoundCutoff));
$notFoundGoogle = new HardGoogleClient();
$notFoundGoogle->createdState = 'PROCESSING';
$notFoundPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$notFoundMedia]),
    $notFoundGoogle,
    new HardMediaCache(),
    new GooglePostsStateStore($notFoundStatePath)
);
$notFoundFirst = $notFoundPublisher->sync(false);
hardExpect($notFoundFirst['created'] === 2, 'Cenario 404 deve iniciar com um post PROCESSING por loja.');
$notFoundState = json_decode((string) file_get_contents($notFoundStatePath), true);
foreach (['loja_1', 'loja_2'] as $slug) {
    $notFoundState['posts']['get-404-reconcile']['locations'][$slug]['nextAttemptAt'] = gmdate('c', time() - 1);
}
file_put_contents(
    $notFoundStatePath,
    (string) json_encode($notFoundState, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
    LOCK_EX
);
$notFoundGoogle->forceGetNotFound = true;
$notFoundSecond = $notFoundPublisher->sync(false);
hardExpect($notFoundSecond['success'] === true, 'GET 404 deve cair na reconciliacao segura pelo marcador.');
hardExpect($notFoundSecond['reconciled'] === 2, 'GET 404 deve reconciliar as duas lojas pelo marcador.');
hardExpect($notFoundGoogle->createCalls === 2, 'GET 404 com marcador remoto nao pode duplicar POST.');
hardCleanupState($notFoundStatePath, $notFoundPrivateDir);

// O cutoff so e confirmado depois de uma primeira descoberta completa.
$activationPrivateDir = sys_get_temp_dir() . '/netcar-activation-cutoff-private-' . getmypid();
$activationStatePath = sys_get_temp_dir() . '/netcar-activation-cutoff-' . getmypid() . '.json';
$activationMedia = hardMedia('activation-cutoff', time() - 10);
hardSetConfig($activationPrivateDir, gmdate('c', time() - 60));
$failedActivationPublisher = new InstagramGbpPublisher(
    new HardFailingFeedClient(),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
hardExpectThrows(
    static function () use ($failedActivationPublisher): void {
        $failedActivationPublisher->sync(false);
    },
    'Falha simulada',
    'Falha na primeira descoberta deve interromper a ativacao.'
);
$failedActivationState = is_file($activationStatePath)
    ? json_decode((string) file_get_contents($activationStatePath), true)
    : [];
hardExpect(
    empty($failedActivationState['activationCutoff']),
    'Falha na descoberta nao pode persistir um cutoff como se a ativacao tivesse concluido.'
);

hardSetConfig($activationPrivateDir, gmdate('c', time() - 7200));
$staleAfterFailurePublisher = new InstagramGbpPublisher(
    new HardFeedClient([$activationMedia]),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
hardExpectThrows(
    static function () use ($staleAfterFailurePublisher): void {
        $staleAfterFailurePublisher->sync(false);
    },
    'Ativacao bloqueada',
    'Retry tardio apos falha deve revalidar e bloquear cutoff antigo.'
);

hardSetConfig($activationPrivateDir, gmdate('c', time() - 60));
$completedActivationPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$activationMedia]),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
$completedActivationPublisher->sync(false);
$completedActivationState = json_decode((string) file_get_contents($activationStatePath), true);
hardExpect(
    !empty($completedActivationState['activationCompletedAt']),
    'Descoberta completa deve confirmar explicitamente a ativacao.'
);

hardSetConfig($activationPrivateDir, (string) $completedActivationState['activationCutoff'], 3, false);
$pausedPublisher = new InstagramGbpPublisher(
    new HardFeedClient([$activationMedia]),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
$pausedResult = $pausedPublisher->sync(false);
hardExpect(!empty($pausedResult['skipped']), 'Publisher desativado deve continuar sem publicar.');
$pausedState = json_decode((string) file_get_contents($activationStatePath), true);
hardExpect(
    ($pausedState['publisherEnabled'] ?? null) === false,
    'Pausa deve ser persistida para exigir um novo handover na reativacao.'
);

hardSetConfig($activationPrivateDir, gmdate('c', time() - 7200));
$unsafeResumePublisher = new InstagramGbpPublisher(
    new HardFeedClient([$activationMedia]),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
hardExpectThrows(
    static function () use ($unsafeResumePublisher): void {
        $unsafeResumePublisher->sync(false);
    },
    'Ativacao bloqueada',
    'Reativacao depois de uma pausa deve recusar o cutoff antigo.'
);

$safeResumeCutoff = time() - 30;
hardSetConfig($activationPrivateDir, gmdate('c', $safeResumeCutoff));
$safeResumePublisher = new InstagramGbpPublisher(
    new HardFeedClient([$activationMedia]),
    new HardGoogleClient(),
    new HardMediaCache(),
    new GooglePostsStateStore($activationStatePath)
);
$safeResumePublisher->sync(false);
$resumedState = json_decode((string) file_get_contents($activationStatePath), true);
hardExpect(
    ($resumedState['publisherEnabled'] ?? null) === true,
    'Reativacao segura deve marcar o publisher como ativo.'
);
hardExpect(
    strtotime((string) ($resumedState['activationCutoff'] ?? '')) === $safeResumeCutoff,
    'Reativacao segura deve substituir o cutoff do handover anterior.'
);
hardCleanupState($activationStatePath, $activationPrivateDir);

@rmdir($bootstrapPrivateDir);

echo "Instagram GBP hardening tests: OK\n";
