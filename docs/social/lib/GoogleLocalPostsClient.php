<?php

declare(strict_types=1);

final class GoogleLocalPostsException extends RuntimeException
{
    private int $httpStatus;

    public function __construct(string $message, int $httpStatus = 0)
    {
        parent::__construct($message, $httpStatus);
        $this->httpStatus = $httpStatus;
    }

    public function isRetryable(): bool
    {
        return $this->httpStatus === 0
            || $this->httpStatus === 408
            || $this->httpStatus === 429
            || $this->httpStatus >= 500;
    }

    public function isNotFound(): bool
    {
        return $this->httpStatus === 404;
    }
}

/** Gateway da API oficial do Google Business Profile para Local Posts. */
class GoogleLocalPostsClient
{
    // Politica comercial de 13/11/2026: novos posts somente no perfil principal.
    // Nao usar CIDs, nomes publicos ou configuracao privada antiga como destino.
    public const PUBLISHING_LOCATIONS = ['loja_1' => '11161331340741727452'];

    private GoogleOAuth $oauth;
    private ?string $accessToken = null;

    public function __construct(?GoogleOAuth $oauth = null)
    {
        $this->oauth = $oauth ?? new GoogleOAuth();
    }

    /**
     * Retorna somente o perfil principal autorizado para novas publicacoes.
     * A validacao acontece antes de qualquer escrita para evitar publicar em local errado.
     */
    public function listTargetLocations(array $configuredLocations): array
    {
        if ($configuredLocations !== self::PUBLISHING_LOCATIONS) {
            throw new RuntimeException('Publicacao GBP permitida somente no perfil principal Netcar.');
        }

        $expectedById = [];
        $normalizedLocations = [];
        $seenSlugs = [];
        foreach ($configuredLocations as $slug => $locationId) {
            $safeSlug = preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $slug));
            $safeLocationId = trim((string) $locationId);
            if ($safeSlug === '' || !preg_match('/^\d+$/', $safeLocationId)) {
                throw new RuntimeException('Slug ou ID de location Google invalido na configuracao.');
            }
            if (isset($seenSlugs[$safeSlug])) {
                throw new RuntimeException('google_posts.locations deve conter slugs unicos.');
            }
            if (isset($expectedById[$safeLocationId])) {
                throw new RuntimeException('google_posts.locations deve conter IDs unicos.');
            }

            $seenSlugs[$safeSlug] = true;
            $expectedById[$safeLocationId] = $safeSlug;
            $normalizedLocations[] = [
                'slug' => $safeSlug,
                'id' => $safeLocationId,
            ];
        }

        $found = [];
        $seenAccounts = [];
        $seenAccountPageTokens = [];
        $accountsPageToken = null;
        $accountPages = 0;
        do {
            $accountPages++;
            if ($accountPages > 50) {
                throw new RuntimeException('Listagem de contas Google excedeu o limite de paginas.');
            }
            $accountsQuery = http_build_query($this->withoutEmptyValues([
                'pageSize' => 20,
                'pageToken' => $accountsPageToken,
            ]));
            $accountsResponse = $this->requestGet(
                'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?' . $accountsQuery
            );
            $this->assertSuccess($accountsResponse, 'listar contas Google');

            foreach ($accountsResponse['body']['accounts'] ?? [] as $account) {
                $accountName = (string) ($account['name'] ?? '');
                if ($accountName === '' || isset($seenAccounts[$accountName])) {
                    continue;
                }
                $seenAccounts[$accountName] = true;

                $locationsPageToken = null;
                $seenLocationPageTokens = [];
                $locationPages = 0;
                do {
                    $locationPages++;
                    if ($locationPages > 100) {
                        throw new RuntimeException('Listagem de locations Google excedeu o limite de paginas.');
                    }
                    $query = http_build_query($this->withoutEmptyValues([
                        'readMask' => 'name,title,metadata,storefrontAddress',
                        'pageSize' => 100,
                        'pageToken' => $locationsPageToken,
                    ]));
                    $response = $this->requestGet(
                        'https://mybusinessbusinessinformation.googleapis.com/v1/' . $accountName . '/locations?' . $query
                    );
                    $this->assertSuccess($response, 'listar locations Google');

                    foreach ($response['body']['locations'] ?? [] as $location) {
                        $locationName = (string) ($location['name'] ?? '');
                        $locationId = preg_replace('#^locations/#', '', $locationName);
                        if (!isset($expectedById[$locationId])) {
                            continue;
                        }

                        $slug = $expectedById[$locationId];
                        $found[$slug] = [
                            'slug' => $slug,
                            'id' => $locationId,
                            'title' => (string) ($location['title'] ?? $slug),
                            'parent' => $accountName . '/locations/' . $locationId,
                        ];
                    }

                    $locationsPageToken = $response['body']['nextPageToken'] ?? null;
                    if (is_string($locationsPageToken) && $locationsPageToken !== '') {
                        if (isset($seenLocationPageTokens[$locationsPageToken])) {
                            throw new RuntimeException('Google repetiu o token de paginacao de locations.');
                        }
                        $seenLocationPageTokens[$locationsPageToken] = true;
                    }
                } while (is_string($locationsPageToken) && $locationsPageToken !== '');
            }

            $accountsPageToken = $accountsResponse['body']['nextPageToken'] ?? null;
            if (is_string($accountsPageToken) && $accountsPageToken !== '') {
                if (isset($seenAccountPageTokens[$accountsPageToken])) {
                    throw new RuntimeException('Google repetiu o token de paginacao de contas.');
                }
                $seenAccountPageTokens[$accountsPageToken] = true;
            }
        } while (is_string($accountsPageToken) && $accountsPageToken !== '');

        $missing = array_diff(array_values($expectedById), array_keys($found));
        if ($missing) {
            throw new RuntimeException('Locations Google nao encontradas: ' . implode(', ', $missing));
        }

        $ordered = [];
        foreach ($normalizedLocations as $configuredLocation) {
            if (isset($found[$configuredLocation['slug']])) {
                $ordered[] = $found[$configuredLocation['slug']];
            }
        }

        return $ordered;
    }

    public function findByMarker(string $parent, string $marker): ?array
    {
        $nextPageToken = null;
        $seenPageTokens = [];
        $pages = 0;
        do {
            $pages++;
            if ($pages > 100) {
                throw new RuntimeException('Listagem de posts Google excedeu o limite de paginas.');
            }
            $query = http_build_query(array_filter([
                'pageSize' => 100,
                'pageToken' => $nextPageToken,
            ]));
            $response = $this->requestGet(
                'https://mybusiness.googleapis.com/v4/' . $parent . '/localPosts?' . $query
            );
            $this->assertSuccess($response, 'listar posts Google');

            foreach ($response['body']['localPosts'] ?? [] as $post) {
                $url = (string) ($post['callToAction']['url'] ?? '');
                if ($url !== '' && strpos($url, $marker) !== false) {
                    return $post;
                }
            }

            $nextPageToken = $response['body']['nextPageToken'] ?? null;
            if (is_string($nextPageToken) && $nextPageToken !== '') {
                if (isset($seenPageTokens[$nextPageToken])) {
                    throw new RuntimeException('Google repetiu o token de paginacao de posts.');
                }
                $seenPageTokens[$nextPageToken] = true;
            }
        } while (is_string($nextPageToken) && $nextPageToken !== '');

        return null;
    }

    public function create(string $parent, array $payload): array
    {
        if (!preg_match('#^accounts/[0-9]+/locations/11161331340741727452$#', $parent)) {
            throw new RuntimeException('Criacao GBP permitida somente no perfil principal Netcar.');
        }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Nao foi possivel codificar o post do Google.');
        }

        $response = HttpClient::post(
            'https://mybusiness.googleapis.com/v4/' . $parent . '/localPosts',
            $json,
            array_merge($this->authHeaders(), ['Content-Type: application/json'])
        );
        $this->assertSuccess($response, 'criar post Google', [200, 201]);

        return $response['body'];
    }

    public function get(string $postName): array
    {
        $response = $this->requestGet(
            'https://mybusiness.googleapis.com/v4/' . ltrim($postName, '/')
        );
        $this->assertSuccess($response, 'consultar post Google');

        return $response['body'];
    }

    private function authHeaders(): array
    {
        if ($this->accessToken === null) {
            $this->accessToken = $this->oauth->getAccessToken();
        }

        return ['Authorization: Bearer ' . $this->accessToken];
    }

    protected function requestGet(string $url): array
    {
        return HttpClient::get($url, $this->authHeaders());
    }

    private function withoutEmptyValues(array $values): array
    {
        return array_filter($values, static function ($value): bool {
            return $value !== null && $value !== '';
        });
    }

    private function assertSuccess(array $response, string $operation, array $accepted = [200]): void
    {
        $status = (int) ($response['status'] ?? 0);
        if (in_array($status, $accepted, true) && is_array($response['body'])) {
            return;
        }

        $detail = '';
        if (is_array($response['body'])) {
            $detail = (string) ($response['body']['error']['message'] ?? '');
        }
        if ($detail === '') {
            $detail = 'HTTP ' . $status;
        }

        throw new GoogleLocalPostsException('Falha ao ' . $operation . ': ' . $detail, $status);
    }
}
