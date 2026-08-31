<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/bootstrap.php';

function expectTrue(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$caption = "Nissan Kicks impecavel\n\nAnúncio: https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299\nWhatsApp: https://wa.me/5551997293118";
$vehicleUrl = InstagramGbpPostFactory::extractVehicleUrl($caption);
expectTrue(
    $vehicleUrl === 'https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299',
    'Deve extrair somente a URL marcada como Anuncio.'
);

$captionWithoutAccent = "Anuncio: https://netcarmultimarcas.com.br/veiculo/carro-123.";
expectTrue(
    InstagramGbpPostFactory::extractVehicleUrl($captionWithoutAccent) === 'https://netcarmultimarcas.com.br/veiculo/carro-123',
    'Deve aceitar Anuncio sem acento e remover pontuacao final.'
);

$malicious = "Anúncio: https://www.netcarmultimarcas.com.br.evil.example/veiculo/carro";
expectTrue(InstagramGbpPostFactory::extractVehicleUrl($malicious) === null, 'Deve bloquear host parecido mas externo.');

$fallback = InstagramGbpPostFactory::destinationUrl(
    'Post institucional sem link de anuncio',
    'https://www.netcarmultimarcas.com.br/seminovos'
);
expectTrue($fallback['kind'] === 'fallback', 'Post sem veiculo deve continuar sendo replicado com fallback seguro.');

$tracked = InstagramGbpPostFactory::trackedUrl(
    'https://www.netcarmultimarcas.com.br/veiculo/carro-123?origem=instagram#detalhes',
    'ig_123_loja_1'
);
expectTrue(strpos($tracked, 'origem=instagram') !== false, 'Deve preservar query existente.');
expectTrue(strpos($tracked, 'utm_content=ig_123_loja_1') !== false, 'Deve incluir marcador idempotente.');
expectTrue(strpos($tracked, '#detalhes') === false, 'Nao deve enviar fragmento ao GBP.');

$media = [
    'id' => '18001234567890123',
    'caption' => $caption,
];
$loja1 = ['slug' => 'loja_1'];
$loja2 = ['slug' => 'loja_2'];
$payload1 = InstagramGbpPostFactory::payload(
    $media,
    $loja1,
    'https://www.netcarmultimarcas.com.br/social/v1/instagram-post-media.php?id=18001234567890123',
    'https://www.netcarmultimarcas.com.br/seminovos'
);
$payload2 = InstagramGbpPostFactory::payload(
    $media,
    $loja2,
    'https://www.netcarmultimarcas.com.br/social/v1/instagram-post-media.php?id=18001234567890123',
    'https://www.netcarmultimarcas.com.br/seminovos'
);
expectTrue($payload1['marker'] !== $payload2['marker'], 'Cada loja deve ter marcador proprio.');
expectTrue(
    strpos($payload1['googlePayload']['summary'], 'Anúncio:') === false,
    'Resumo no Google nao deve exibir a linha tecnica do link.'
);
expectTrue(
    $payload1['googlePayload']['callToAction']['actionType'] === 'LEARN_MORE',
    'CTA deve ser Saiba mais.'
);

$longSummary = InstagramGbpPostFactory::summary(str_repeat('á', 1600));
$summaryLength = function_exists('mb_strlen')
    ? mb_strlen($longSummary, 'UTF-8')
    : preg_match_all('/./us', $longSummary, $unusedCharacters);
expectTrue($summaryLength <= 1500, 'Resumo deve respeitar o limite do Google.');
expectTrue(preg_match('//u', $longSummary) === 1, 'Resumo truncado deve continuar sendo UTF-8 valido.');

$statePath = sys_get_temp_dir() . '/netcar-gbp-state-' . getmypid() . '.json';
$store = new GooglePostsStateStore($statePath);
$store->lock();
$state = $store->load();
$state['posts']['ig-test'] = ['publishedAt' => gmdate('c'), 'locations' => []];
$store->save($state);
$store->unlock();
$persisted = json_decode((string) file_get_contents($statePath), true);
expectTrue(isset($persisted['posts']['ig-test']), 'Estado deve ser persistido de forma valida.');
@unlink($statePath);
@unlink($statePath . '.lock');

$tokenDir = sys_get_temp_dir() . '/netcar-token-store-' . getmypid();
mkdir($tokenDir, 0700, true);
$tokenPath = $tokenDir . '/social-tokens.json';
$tokenStore = new TokenStore($tokenPath);
$tokenStore->put('google', ['refresh_token' => 'google-test']);
$tokenStore->put('meta', ['access_token' => 'meta-test', 'ig_user_id' => 'ig-test']);
$storedTokens = json_decode((string) file_get_contents($tokenPath), true);
expectTrue(
    ($storedTokens['google']['refresh_token'] ?? '') === 'google-test'
        && ($storedTokens['meta']['access_token'] ?? '') === 'meta-test',
    'TokenStore atomico deve preservar provedores escritos em sequencia.'
);
expectTrue(
    count(glob($tokenDir . '/social-tokens-*') ?: []) === 0,
    'TokenStore atomico nao deve deixar arquivos temporarios.'
);
file_put_contents($tokenPath, '{invalid-json', LOCK_EX);
$corruptStoreRejected = false;
try {
    $tokenStore->put('google', ['access_token' => 'must-not-overwrite']);
} catch (RuntimeException $error) {
    $corruptStoreRejected = strpos($error->getMessage(), 'corrompido') !== false;
}
expectTrue(
    $corruptStoreRejected && file_get_contents($tokenPath) === '{invalid-json',
    'TokenStore corrompido deve falhar sem apagar os dados existentes.'
);
@unlink($tokenPath);
@unlink($tokenPath . '.lock');
@rmdir($tokenDir);

final class FakeInstagramFeedClient extends InstagramFeedClient
{
    private array $items;

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

final class FakeGoogleLocalPostsClient extends GoogleLocalPostsClient
{
    public int $createCalls = 0;

    public function __construct()
    {
    }

    public function listTargetLocations(array $configuredLocations): array
    {
        return [
            ['slug' => 'loja_1', 'id' => '11161331340741727452', 'title' => 'Netcar Loja 1', 'parent' => 'accounts/1/locations/11161331340741727452'],
            ['slug' => 'loja_2', 'id' => '17013442122163034193', 'title' => 'Netcar Loja 2', 'parent' => 'accounts/1/locations/17013442122163034193'],
        ];
    }

    public function findByMarker(string $parent, string $marker): ?array
    {
        return null;
    }

    public function create(string $parent, array $payload): array
    {
        $this->createCalls++;
        return [
            'name' => $parent . '/localPosts/' . $this->createCalls,
            'state' => 'LIVE',
            'callToAction' => $payload['callToAction'],
        ];
    }

    public function get(string $postName): array
    {
        return ['name' => $postName, 'state' => 'LIVE'];
    }
}

final class FakeInstagramPostMediaCache extends InstagramPostMediaCache
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

$socialConfigProperty = new ReflectionProperty(SocialEnv::class, 'config');
$socialConfigProperty->setAccessible(true);
$privateDataDir = sys_get_temp_dir() . '/netcar-gbp-private-' . getmypid();
$socialConfigProperty->setValue(null, [
    'private_data_dir' => $privateDataDir,
    'google_posts' => [
        'enabled' => true,
        'not_before' => gmdate('c', time() - 60),
        'fallback_url' => 'https://www.netcarmultimarcas.com.br/seminovos',
        'locations' => [
            'loja_1' => '11161331340741727452',
            'loja_2' => '17013442122163034193',
        ],
    ],
]);

$publisherStatePath = sys_get_temp_dir() . '/netcar-gbp-publisher-' . getmypid() . '.json';
$fakeGoogle = new FakeGoogleLocalPostsClient();
$fakeMediaCache = new FakeInstagramPostMediaCache();
$publisher = new InstagramGbpPublisher(
    new FakeInstagramFeedClient([[
        'id' => '18009999999999999',
        'caption' => $caption,
        'mediaType' => 'IMAGE',
        'mediaUrl' => 'https://scontent.cdninstagram.com/example.jpg',
        'thumbnailUrl' => '',
        'permalink' => 'https://www.instagram.com/p/test/',
        'publishedAt' => gmdate('c'),
    ]]),
    $fakeGoogle,
    $fakeMediaCache,
    new GooglePostsStateStore($publisherStatePath)
);

$firstRun = $publisher->sync(false);
expectTrue($firstRun['created'] === 2, 'Primeira execucao deve criar um post por loja.');
expectTrue($fakeGoogle->createCalls === 2, 'Google deve receber exatamente duas criacoes.');
expectTrue($fakeMediaCache->cacheCalls === 1, 'A mesma imagem deve ser armazenada uma unica vez.');

$secondRun = $publisher->sync(false);
expectTrue($secondRun['pendingMedia'] === 0, 'Segunda execucao nao deve reenfileirar post live nas duas lojas.');
expectTrue($secondRun['created'] === 0, 'Segunda execucao nao deve criar novamente um post concluido.');
expectTrue($fakeGoogle->createCalls === 2, 'Segunda execucao nao pode duplicar posts.');

@unlink($publisherStatePath);
@unlink($publisherStatePath . '.lock');
@rmdir($privateDataDir);

echo "Instagram GBP sync tests: OK\n";

require __DIR__ . '/InstagramGbpHardeningTest.php';
