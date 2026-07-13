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
                    || in_array($loc['reviewsParent'] ?? '', $configuredIds, true)
            ));
        } else {
            // Sem lista explícita: só lojas Netcar (evita contas extras tipo "academia")
            $locations = array_values(array_filter(
                $locations,
                static function ($loc) {
                    $title = (string) ($loc['title'] ?? '');
                    return stripos($title, 'netcar') !== false;
                }
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
            $parent = $location['reviewsParent'] ?? $location['name'];
            $locationReviews = $this->fetchLocationReviews($accessToken, $parent);
            $totalCount += (int) ($locationReviews['totalReviewCount'] ?? count($locationReviews['reviews']));

            if (!empty($locationReviews['averageRating'])) {
                $count = (int) ($locationReviews['totalReviewCount'] ?? count($locationReviews['reviews']));
                $ratingSum += (float) $locationReviews['averageRating'] * max($count, 1);
                $ratingWeight += max($count, 1);
            }

            foreach ($locationReviews['reviews'] as $review) {
                $mapped = $this->mapReview($review, $location, $accessToken);
                if ($mapped === null) {
                    continue;
                }
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

    /**
     * Business Information API devolve name=locations/{id}.
     * Reviews API v4 exige parent=accounts/{id}/locations/{id}.
     */
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
                    $locName = (string) ($location['name'] ?? '');
                    if ($locName === '') {
                        continue;
                    }

                    if (strpos($locName, 'accounts/') === 0) {
                        $location['reviewsParent'] = $locName;
                    } else {
                        $locationId = preg_replace('#^locations/#', '', $locName);
                        $location['reviewsParent'] = $accountName . '/locations/' . $locationId;
                    }

                    $locations[] = $location;
                }

                $nextPageToken = $response['body']['nextPageToken'] ?? null;
            } while ($nextPageToken);
        }

        return $locations;
    }

    private function fetchLocationReviews(string $accessToken, string $reviewsParent): array
    {
        $reviews = [];
        $nextPageToken = null;
        $averageRating = null;
        $totalReviewCount = 0;

        do {
            $query = http_build_query(array_filter([
                'pageSize' => 50,
                'pageToken' => $nextPageToken,
                'orderBy' => 'updateTime desc',
            ]));

            $url = 'https://mybusiness.googleapis.com/v4/' . $reviewsParent . '/reviews?' . $query;
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

    private function mapReview(array $review, array $location, string $accessToken): ?array
    {
        $ratingMap = [
            'ONE' => 1,
            'TWO' => 2,
            'THREE' => 3,
            'FOUR' => 4,
            'FIVE' => 5,
        ];

        $rating = $ratingMap[$review['starRating'] ?? 'FIVE'] ?? 5;
        // Mesma regra do Outscraper: site só publica 4★+ com texto
        if ($rating < 4) {
            return null;
        }

        $text = trim($review['comment'] ?? '');
        if ($text === '') {
            return null;
        }

        $remotePhotoUrl = $this->extractReviewPhotoUrl($review);
        $publishedAt = $review['createTime'] ?? null;
        $reviewId = (string) ($review['reviewId'] ?? ($review['name'] ?? uniqid('review_', true)));
        $photoUrl = ReviewPhotoCache::resolve($reviewId, $remotePhotoUrl, $accessToken);

        $variant = $photoUrl ? 'photo' : 'text';

        return [
            'id' => $reviewId,
            'authorName' => $review['reviewer']['displayName'] ?? 'Cliente',
            'authorPhotoUrl' => $this->normalizeMediaUrl($review['reviewer']['profilePhotoUrl'] ?? null),
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
            $n = max(1, (int) floor($diff / 86400));
            return $n === 1 ? 'há 1 dia' : 'há ' . $n . ' dias';
        }
        if ($diff < 86400 * 30) {
            $n = max(1, (int) floor($diff / (86400 * 7)));
            return $n === 1 ? 'há uma semana' : 'há ' . $n . ' semanas';
        }
        if ($diff < 86400 * 365) {
            $n = max(1, (int) floor($diff / (86400 * 30)));
            return $n === 1 ? 'há um mês' : 'há ' . $n . ' meses';
        }

        $n = max(1, (int) floor($diff / (86400 * 365)));
        return $n === 1 ? 'há um ano' : 'há ' . $n . ' anos';
    }

    private function extractReviewPhotoUrl(array $review): ?string
    {
        if (!empty($review['reviewMediaItems']) && is_array($review['reviewMediaItems'])) {
            foreach ($review['reviewMediaItems'] as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $url = $item['thumbnailUrl'] ?? null;
                if ($url) {
                    return $this->normalizeMediaUrl($url);
                }
            }
        }

        if (!empty($review['reviewPhotoUrls']) && is_array($review['reviewPhotoUrls'])) {
            return $this->normalizeMediaUrl($review['reviewPhotoUrls'][0] ?? null);
        }

        return null;
    }

    private function normalizeMediaUrl($url): ?string
    {
        if (!$url || !is_string($url)) {
            return null;
        }

        $url = trim($url);
        if ($url === '' || !preg_match('#^https?://#i', $url)) {
            return null;
        }

        return $url;
    }
}
