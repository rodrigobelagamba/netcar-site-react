<?php

declare(strict_types=1);

final class GoogleReviewsClient
{
    private GoogleOAuth $oauth;

    public function __construct(?GoogleOAuth $oauth = null)
    {
        $this->oauth = $oauth ?? new GoogleOAuth();
    }

    public function syncAll(): array
    {
        $accessToken = $this->oauth->getAccessToken();
        $locations = $this->listLocations($accessToken);
        $configuredIds = SocialEnv::get('google.location_names', []);

        if (is_array($configuredIds) && count($configuredIds) > 0) {
            $locations = array_values(array_filter(
                $locations,
                static fn($loc) => in_array($loc['name'], $configuredIds, true)
            ));
        }

        $allReviews = [];
        $totalCount = 0;
        $ratingSum = 0.0;
        $ratingWeight = 0;
        $primaryPlaceUrl = SocialEnv::get(
            'google.primary_place_url',
            'https://www.google.com/maps/place/Netcar+Multimarcas'
        );
        $writeReviewUrl = SocialEnv::get(
            'google.write_review_url',
            'https://g.page/NetcarRC/review?rc'
        );

        foreach ($locations as $location) {
            $locationReviews = $this->fetchLocationReviews($accessToken, $location['name']);
            $totalCount += (int) ($locationReviews['totalReviewCount'] ?? count($locationReviews['reviews']));

            if (!empty($locationReviews['averageRating'])) {
                $count = (int) ($locationReviews['totalReviewCount'] ?? count($locationReviews['reviews']));
                $ratingSum += (float) $locationReviews['averageRating'] * max($count, 1);
                $ratingWeight += max($count, 1);
            }

            foreach ($locationReviews['reviews'] as $review) {
                $mapped = $this->mapReview($review, $location);
                $allReviews[$mapped['id']] = $mapped;
            }

            if (!empty($location['metadata']['mapsUri'])) {
                $primaryPlaceUrl = $location['metadata']['mapsUri'];
            }
        }

        $allReviews = array_values($allReviews);
        usort($allReviews, static function ($a, $b) {
            return strcmp($b['publishedAt'] ?? '', $a['publishedAt'] ?? '');
        });

        $avgRating = $ratingWeight > 0
            ? round($ratingSum / $ratingWeight, 1)
            : 4.9;

        if ($avgRating >= 4.95) {
            $avgRating = 4.9;
        }

        return [
            'success' => true,
            'stale' => false,
            'syncedAt' => gmdate('c'),
            'summary' => [
                'rating' => $avgRating,
                'totalCount' => $totalCount > 0 ? $totalCount : count($allReviews),
                'placeUrl' => $primaryPlaceUrl,
                'writeReviewUrl' => $writeReviewUrl,
            ],
            'pagination' => [
                'page' => 1,
                'pageSize' => 21,
                'totalCount' => $totalCount > 0 ? $totalCount : count($allReviews),
                'hasMore' => count($allReviews) > 21,
            ],
            'reviews' => $allReviews,
        ];
    }

    private function listLocations(string $accessToken): array
    {
        $accountsResponse = HttpClient::get(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            ['Authorization: Bearer ' . $accessToken]
        );

        if ($accountsResponse['status'] !== 200) {
            throw new RuntimeException('Falha ao listar contas Google: ' . $accountsResponse['raw']);
        }

        $accounts = $accountsResponse['body']['accounts'] ?? [];
        $locations = [];

        foreach ($accounts as $account) {
            $accountName = $account['name'] ?? null;
            if (!$accountName) {
                continue;
            }

            $nextPageToken = null;
            do {
                $query = http_build_query(array_filter([
                    'readMask' => 'name,title,metadata,storefrontAddress',
                    'pageSize' => 100,
                    'pageToken' => $nextPageToken,
                ]));

                $url = 'https://mybusinessbusinessinformation.googleapis.com/v1/' . $accountName . '/locations?' . $query;
                $response = HttpClient::get($url, ['Authorization: Bearer ' . $accessToken]);

                if ($response['status'] !== 200) {
                    throw new RuntimeException('Falha ao listar locations Google: ' . $response['raw']);
                }

                foreach ($response['body']['locations'] ?? [] as $location) {
                    $locations[] = $location;
                }

                $nextPageToken = $response['body']['nextPageToken'] ?? null;
            } while ($nextPageToken);
        }

        return $locations;
    }

    private function fetchLocationReviews(string $accessToken, string $locationName): array
    {
        $reviews = [];
        $nextPageToken = null;
        $averageRating = null;
        $totalReviewCount = 0;

        do {
            $query = http_build_query(array_filter([
                'pageSize' => 50,
                'pageToken' => $nextPageToken,
            ]));

            $url = 'https://mybusiness.googleapis.com/v4/' . $locationName . '/reviews?' . $query;
            $response = HttpClient::get($url, ['Authorization: Bearer ' . $accessToken]);

            if ($response['status'] !== 200) {
                throw new RuntimeException('Falha ao buscar reviews Google: ' . $response['raw']);
            }

            $body = $response['body'] ?? [];
            $averageRating = $body['averageRating'] ?? $averageRating;
            $totalReviewCount = (int) ($body['totalReviewCount'] ?? $totalReviewCount);

            foreach ($body['reviews'] ?? [] as $review) {
                $reviews[] = $review;
            }

            $nextPageToken = $body['nextPageToken'] ?? null;
        } while ($nextPageToken);

        return [
            'reviews' => $reviews,
            'averageRating' => $averageRating,
            'totalReviewCount' => $totalReviewCount,
        ];
    }

    private function mapReview(array $review, array $location): array
    {
        $ratingMap = [
            'ONE' => 1,
            'TWO' => 2,
            'THREE' => 3,
            'FOUR' => 4,
            'FIVE' => 5,
        ];

        $rating = $ratingMap[$review['starRating'] ?? 'FIVE'] ?? 5;
        $text = trim($review['comment'] ?? '');
        $photoUrl = null;

        if (!empty($review['reviewPhotoUrls']) && is_array($review['reviewPhotoUrls'])) {
            $photoUrl = $this->sanitizeGoogleMediaUrl($review['reviewPhotoUrls'][0] ?? null);
        }

        $variant = $photoUrl ? 'photo' : 'text';
        $publishedAt = $review['createTime'] ?? null;
        $reviewId = $review['reviewId'] ?? ($review['name'] ?? uniqid('review_'));

        return [
            'id' => (string) $reviewId,
            'authorName' => $review['reviewer']['displayName'] ?? 'Cliente',
            'authorPhotoUrl' => $this->sanitizeGoogleMediaUrl($review['reviewer']['profilePhotoUrl'] ?? null),
            'rating' => $rating,
            'text' => $text,
            'relativeTime' => $this->formatRelativeTime($publishedAt),
            'publishedAt' => $publishedAt,
            'photoUrl' => $photoUrl,
            'largePhotoUrl' => $photoUrl,
            'reviewUrl' => $location['metadata']['mapsUri'] ?? SocialEnv::get('google.primary_place_url'),
            'variant' => $variant,
            'locationTitle' => $location['title'] ?? null,
        ];
    }

    private function formatRelativeTime(?string $isoDate): string
    {
        if (!$isoDate) {
            return '';
        }

        $timestamp = strtotime($isoDate);
        if ($timestamp === false) {
            return '';
        }

        $diff = time() - $timestamp;
        if ($diff < 86400) {
            return 'hoje';
        }
        if ($diff < 86400 * 7) {
            return 'há ' . max(1, (int) floor($diff / 86400)) . ' dias';
        }
        if ($diff < 86400 * 30) {
            return 'há ' . max(1, (int) floor($diff / (86400 * 7))) . ' semanas';
        }
        if ($diff < 86400 * 365) {
            return 'há ' . max(1, (int) floor($diff / (86400 * 30))) . ' meses';
        }

        return 'há ' . max(1, (int) floor($diff / (86400 * 365))) . ' anos';
    }

    /**
     * Imagens em googleusercontent.com não podem ser hotlinked fora do Google.
     */
    private function sanitizeGoogleMediaUrl($url)
    {
        if (!$url || !is_string($url)) {
            return null;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            return $url;
        }

        $host = strtolower($host);
        if ($host === 'lh3.googleusercontent.com' || strpos($host, '.googleusercontent.com') !== false) {
            return null;
        }

        return $url;
    }
}
