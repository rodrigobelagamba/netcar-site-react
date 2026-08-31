<?php

declare(strict_types=1);

/** Le as publicacoes recentes do feed do Instagram Business da Netcar. */
class InstagramFeedClient
{
    private MetaOAuth $oauth;
    private string $graphVersion;

    public function __construct(?MetaOAuth $oauth = null)
    {
        $this->oauth = $oauth ?? new MetaOAuth();
        $this->graphVersion = (string) SocialEnv::get('meta.graph_version', 'v21.0');
    }

    public function fetchRecent(int $limit = 25): array
    {
        return $this->fetchSince(0, $limit);
    }

    /**
     * Pagina ate alcancar o cutoff. Se o limite de seguranca for insuficiente,
     * falha de forma visivel em vez de perder publicacoes silenciosamente.
     */
    public function fetchSince(int $notBefore, int $maxItems = 500): array
    {
        $maxItems = max(1, min(1000, $maxItems));
        $credentials = $this->credentials();
        $accessToken = $credentials['accessToken'];
        $igUserId = $credentials['instagramUserId'];

        $query = http_build_query([
            'fields' => 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
            'limit' => min(100, $maxItems),
            'access_token' => $accessToken,
        ]);

        $media = [];
        $seenIds = [];
        $url = 'https://graph.facebook.com/' . $this->graphVersion . '/' . rawurlencode($igUserId) . '/media?' . $query;
        $reachedCutoff = false;
        $pages = 0;

        while ($url !== '' && !$reachedCutoff) {
            $this->assertGraphUrl($url);
            $response = $this->requestGet($url);
            if ($response['status'] !== 200 || !is_array($response['body'])) {
                throw new RuntimeException('Falha ao buscar feed Instagram: ' . (string) ($response['raw'] ?? 'HTTP invalido'));
            }

            $pageItems = $response['body']['data'] ?? [];
            foreach ($pageItems as $item) {
                if (!is_array($item) || empty($item['id']) || empty($item['timestamp'])) {
                    continue;
                }

                $timestamp = strtotime((string) $item['timestamp']);
                if ($timestamp === false) {
                    continue;
                }
                if ($timestamp < $notBefore) {
                    $reachedCutoff = true;
                    break;
                }

                $mediaId = (string) $item['id'];
                if (isset($seenIds[$mediaId])) {
                    continue;
                }
                $seenIds[$mediaId] = true;
                $media[] = [
                    'id' => $mediaId,
                    'caption' => trim((string) ($item['caption'] ?? '')),
                    'mediaType' => strtoupper((string) ($item['media_type'] ?? 'IMAGE')),
                    'mediaUrl' => (string) ($item['media_url'] ?? ''),
                    'thumbnailUrl' => (string) ($item['thumbnail_url'] ?? ''),
                    'permalink' => (string) ($item['permalink'] ?? ''),
                    'publishedAt' => (string) $item['timestamp'],
                ];

                if (count($media) >= $maxItems) {
                    break;
                }
            }

            $pages++;
            $next = (string) ($response['body']['paging']['next'] ?? '');
            if (count($media) >= $maxItems && !$reachedCutoff && $next !== '') {
                // fetchRecent()/fetchSince(0) pede apenas os N itens mais recentes;
                // nesse modo atingir o limite e parar e o comportamento esperado.
                if ($notBefore > 0) {
                    throw new RuntimeException(
                        'Feed Instagram excedeu o limite seguro antes do cutoff; aumente google_posts.max_feed_items.'
                    );
                }
                $url = '';
                continue;
            }
            if ($pages >= 20 && !$reachedCutoff && $next !== '') {
                throw new RuntimeException('Feed Instagram excedeu o limite de paginas do sincronizador.');
            }
            $url = $next;
        }

        // Publica em ordem cronologica quando mais de um item chega entre crons.
        usort($media, static function (array $a, array $b): int {
            return strcmp($a['publishedAt'], $b['publishedAt']);
        });

        return $media;
    }

    /** @return array{accessToken:string,instagramUserId:string} */
    protected function credentials(): array
    {
        return [
            'accessToken' => $this->oauth->getAccessToken(),
            'instagramUserId' => $this->oauth->getInstagramUserId(),
        ];
    }

    protected function requestGet(string $url): array
    {
        return HttpClient::get($url);
    }

    private function assertGraphUrl(string $url): void
    {
        $parts = parse_url($url);
        if (!is_array($parts)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || strtolower((string) ($parts['host'] ?? '')) !== 'graph.facebook.com'
        ) {
            throw new RuntimeException('URL de paginacao Instagram invalida.');
        }
    }
}
