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

$cleanVehicleCaption = "🚗 NISSAN KICKS S 1.6 2019/2020 — *R$ 76.900,00*\n\nChama no WhatsApp do perfil.\n\n#nissankicks #netcar #netcar19299";
$stockFixture = [
    [
        'id' => '19299',
        'marca' => 'NISSAN',
        'modelo' => 'KICKS S',
        'ano' => 2020,
        'valor' => 76900,
        'placa' => 'IZN2I88',
    ],
    [
        'id' => '19979',
        'marca' => 'CHEVROLET',
        'modelo' => 'CRUZE LT HB',
        'ano' => 2014,
        'valor' => 0,
        'placa' => 'JCA4J56',
    ],
];
$resolvedFromStock = NetcarStockVehicleDestinationResolver::resolveFromVehicles(
    $cleanVehicleCaption,
    $stockFixture
);
expectTrue(
    $resolvedFromStock === 'https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299',
    'Referencia limpa do AutoADS deve resolver a unidade exata no estoque oficial.'
);
$resolvedDestination = InstagramGbpPostFactory::destinationUrl(
    $cleanVehicleCaption,
    'https://www.netcarmultimarcas.com.br/seminovos',
    $resolvedFromStock
);
expectTrue(
    $resolvedDestination['kind'] === 'vehicle' && $resolvedDestination['source'] === 'stock_reference',
    'CTA resolvido pelo estoque deve continuar apontando para a ficha do carro.'
);
expectTrue(
    strpos(InstagramGbpPostFactory::summary($cleanVehicleCaption), '#netcar19299') === false,
    'Referencia tecnica nao deve aparecer no texto publico do Google.'
);

$similarStock = array_merge($stockFixture, [[
    'id' => '29999',
    'marca' => 'NISSAN',
    'modelo' => 'KICKS S',
    'ano' => 2020,
    'valor' => 76900,
    'placa' => 'ABC1D23',
]]);
expectTrue(
    NetcarStockVehicleDestinationResolver::resolveFromVehicles($cleanVehicleCaption, $similarStock) === $resolvedFromStock,
    'Outro carro equivalente nao pode sequestrar a referencia exata do anuncio.'
);
expectTrue(
    NetcarStockVehicleDestinationResolver::resolveFromVehicles(
        'CRUZE LT HB 2014 #netcar19979',
        $stockFixture
    ) === null,
    'Referencia de carro vendido deve cair no fallback.'
);
expectTrue(
    NetcarStockVehicleDestinationResolver::resolveFromVehicles(
        'Comparativo #netcar19299 #netcar29999',
        $similarStock
    ) === null,
    'Post com mais de uma referencia deve cair no fallback.'
);
$ambiguousResolution = NetcarStockVehicleDestinationResolver::resolveDetailedFromVehicles(
    'Comparativo #netcar19299 #netcar29999',
    $similarStock
);
expectTrue(
    $ambiguousResolution['url'] === null
        && $ambiguousResolution['reason'] === 'vehicle_reference_ambiguous',
    'Fallback deve explicar quando a legenda contem referencias conflitantes.'
);
expectTrue(
    NetcarStockVehicleDestinationResolver::resolveFromVehicles(
        'Post institucional sem preco nem veiculo',
        $stockFixture
    ) === null,
    'Post institucional nao pode ser confundido com anuncio de veiculo.'
);

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

final class FakeVehicleDestinationResolver implements VehicleDestinationResolver
{
    public int $resolveCalls = 0;

    public function resolve(string $caption): array
    {
        $this->resolveCalls++;
        return [
            'url' => 'https://www.netcarmultimarcas.com.br/veiculo/kicks-s-2020-izn-xx88-19299',
            'reason' => 'stock_reference',
        ];
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

$cleanResolver = new FakeVehicleDestinationResolver();
$cleanPublisher = new InstagramGbpPublisher(
    new FakeInstagramFeedClient([[
        'id' => '18008888888888888',
        'caption' => $cleanVehicleCaption,
        'mediaType' => 'IMAGE',
        'mediaUrl' => 'https://scontent.cdninstagram.com/clean-example.jpg',
        'thumbnailUrl' => '',
        'permalink' => 'https://www.instagram.com/p/clean-test/',
        'publishedAt' => gmdate('c'),
    ]]),
    $fakeGoogle,
    $fakeMediaCache,
    new GooglePostsStateStore(sys_get_temp_dir() . '/netcar-gbp-clean-' . getmypid() . '.json'),
    $cleanResolver
);
$cleanDryRun = $cleanPublisher->sync(true);
expectTrue($cleanResolver->resolveCalls === 1, 'Veiculo deve ser resolvido uma vez por post, nao uma vez por loja.');
expectTrue(
    count($cleanDryRun['items']) === 2
        && $cleanDryRun['items'][0]['destinationSource'] === 'stock_reference'
        && $cleanDryRun['items'][0]['destinationReason'] === 'stock_reference'
        && $cleanDryRun['items'][0]['destinationWarning'] === null
        && strpos($cleanDryRun['items'][0]['trackedUrl'], '/veiculo/kicks-s-2020-izn-xx88-19299') !== false,
    'Dry-run deve mostrar o CTA direto mesmo quando a legenda do Instagram nao contem URL.'
);

$dryRun = $publisher->sync(true);
expectTrue($dryRun['dryRun'] === true, 'Dry-run deve se identificar explicitamente.');
expectTrue($dryRun['created'] === 0, 'Dry-run nao pode reportar criacao.');
expectTrue($fakeGoogle->createCalls === 0, 'Dry-run nao pode executar POST no Google.');
expectTrue($fakeMediaCache->cacheCalls === 0, 'Dry-run nao pode baixar ou gravar midia.');
expectTrue(!is_file($publisherStatePath), 'Dry-run nao pode gravar estado operacional.');

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
