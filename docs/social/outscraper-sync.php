<?php

declare(strict_types=1);

/**
 * Outscraper Sync — Google Reviews (plano B, sem GBP API)
 *
 * Puxa reviews das 2 lojas Netcar via Outscraper e grava no mesmo
 * cache que sync-social.php: data/cache/google-reviews.json
 * React não muda nada — google-reviews.php continua servindo.
 *
 * Uso:
 *   GET /social/v1/outscraper-sync.php?key=SYNC_SECRET            (10 reviews/loja)
 *   GET /social/v1/outscraper-sync.php?key=SYNC_SECRET&limit=20   (import inicial)
 *   php outscraper-sync.php [limit]                               (CLI)
 *
 * Cron sugerido (1x/dia, ~600 reviews/mês com limit=10 — ajustar p/ free tier 500):
 *   0 7 * * * curl -s "https://www.netcarmultimarcas.com.br/social/v1/outscraper-sync.php?key=SECRET&limit=8"
 *
 * Config em social-config.php:
 *   'outscraper' => [
 *       'api_key' => 'SUA_API_KEY',          // app.outscraper.cloud → Profile → API token
 *       'queries' => [                       // place_id / CID / google_id / endereço
 *           'ChIJSRolPVtvGZURzx88U1pB5n4',   // Loja 1 — Av. Pres. Vargas 740 (504 reviews)
 *           'ChIJq78McFxvGZURmIl8iyKRbJY',   // Loja 2 — Av. Pres. Vargas 1106 (350 reviews)
 *       ],
 *   ],
 */

header('Content-Type: application/json; charset=utf-8');

$configFile = __DIR__ . '/social-config.php';
$config = is_file($configFile) ? require $configFile : [];

$syncSecret = $config['sync']['secret'] ?? '';
$apiKey = $config['outscraper']['api_key'] ?? '';
$queries = $config['outscraper']['queries'] ?? [
    'ChIJSRolPVtvGZURzx88U1pB5n4', // Loja 1
    'ChIJq78McFxvGZURmIl8iyKRbJY', // Loja 2
];

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    $key = (string) ($_GET['key'] ?? '');
    if ($syncSecret === '' || !hash_equals($syncSecret, $key)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Chave inválida']);
        exit;
    }
}

if ($apiKey === '') {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'outscraper.api_key ausente em social-config.php']);
    exit;
}

$limit = $isCli
    ? max(1, min(100, (int) ($argv[1] ?? 10)))
    : max(1, min(100, (int) ($_GET['limit'] ?? 10)));

$dataDir = __DIR__ . '/data';
$cacheDir = $dataDir . '/cache';
$cacheFile = $cacheDir . '/google-reviews.json';
$backupFile = $cacheDir . '/google-reviews.backup.json';
$seedFile = $dataDir . '/google-reviews.seed.json';

// ---------------------------------------------------------------------------

function outscraperFetch(string $apiKey, array $queries, int $reviewsLimit): array
{
    $params = [
        'reviewsLimit' => $reviewsLimit,
        'sort' => 'newest',
        'language' => 'pt',
        'async' => 'false',
    ];

    $qs = http_build_query($params);
    foreach ($queries as $q) {
        $qs .= '&query=' . rawurlencode($q);
    }

    $ch = curl_init('https://api.outscraper.cloud/maps/reviews-v3?' . $qs);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['X-API-KEY: ' . $apiKey],
        CURLOPT_TIMEOUT => 120,
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Falha cURL Outscraper: ' . $err);
    }

    $body = json_decode($raw, true);
    if ($status !== 200 || !is_array($body)) {
        throw new RuntimeException('Outscraper HTTP ' . $status . ': ' . substr((string) $raw, 0, 500));
    }

    // async=false → resposta direta em "data"
    $places = $body['data'] ?? [];
    if (!is_array($places)) {
        throw new RuntimeException('Resposta Outscraper sem "data": ' . substr((string) $raw, 0, 500));
    }

    return $places;
}

function formatRelativeTime(?int $timestamp): string
{
    if (!$timestamp) {
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

function mapOutscraperReview(array $r, string $placeUrl): ?array
{
    $text = trim((string) ($r['review_text'] ?? ''));
    $rating = (int) ($r['review_rating'] ?? 0);
    if ($rating < 1) {
        return null;
    }

    $timestamp = isset($r['review_timestamp']) ? (int) $r['review_timestamp'] : null;

    $photoUrl = null;
    if (!empty($r['review_img_urls']) && is_array($r['review_img_urls'])) {
        $photoUrl = $r['review_img_urls'][0] ?? null;
    } elseif (!empty($r['review_img_url'])) {
        $photoUrl = $r['review_img_url'];
    }
    if ($photoUrl && !preg_match('#^https?://#i', (string) $photoUrl)) {
        $photoUrl = null;
    }

    // Sem texto e sem foto = card vazio no site — pular
    if ($text === '' && !$photoUrl) {
        return null;
    }

    $authorPhoto = $r['author_image'] ?? ($r['author_img'] ?? null);
    if ($authorPhoto && !preg_match('#^https?://#i', (string) $authorPhoto)) {
        $authorPhoto = null;
    }
    if ($authorPhoto) {
        // Outscraper entrega avatar 64px; site usa 120px (padrão do seed)
        $authorPhoto = preg_replace('/=s\d+-/', '=s120-', (string) $authorPhoto);
    }

    return [
        'id' => (string) ($r['review_id'] ?? ($r['review_pagination_id'] ?? md5(($r['author_title'] ?? '') . $text))),
        'authorName' => (string) ($r['author_title'] ?? 'Cliente'),
        'authorPhotoUrl' => $authorPhoto,
        'rating' => $rating,
        'text' => $text,
        'relativeTime' => formatRelativeTime($timestamp),
        'publishedAt' => $timestamp ? gmdate('c', $timestamp) : null,
        'photoUrl' => $photoUrl,
        'largePhotoUrl' => $photoUrl,
        'reviewUrl' => (string) ($r['review_link'] ?? $placeUrl),
        'variant' => $photoUrl ? 'photo' : 'text',
    ];
}

/** Assinatura p/ dedupe entre IDs Outscraper e IDs legados (EmbedSocial/GBP). */
function reviewSignature(array $review): string
{
    $name = mb_strtolower(trim((string) ($review['authorName'] ?? '')));
    $text = mb_strtolower(preg_replace('/\s+/u', ' ', trim((string) ($review['text'] ?? ''))));
    return $name . '|' . mb_substr($text, 0, 80);
}

function loadJson(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    return is_array($decoded) ? $decoded : null;
}

// ---------------------------------------------------------------------------

try {
    $places = outscraperFetch($apiKey, $queries, $limit);

    $defaultPlaceUrl = 'https://maps.google.com/maps?cid=10839197980729051544';
    $newReviews = [];
    $totalCount = 0;
    $ratingSum = 0.0;
    $ratingWeight = 0;

    foreach ($places as $place) {
        if (!is_array($place)) {
            continue;
        }

        $placeUrl = $defaultPlaceUrl;
        if (!empty($place['location_link'])) {
            $placeUrl = (string) $place['location_link'];
        }

        $placeTotal = (int) ($place['reviews'] ?? 0);
        $totalCount += $placeTotal;

        if (!empty($place['rating']) && $placeTotal > 0) {
            $ratingSum += (float) $place['rating'] * $placeTotal;
            $ratingWeight += $placeTotal;
        }

        foreach ($place['reviews_data'] ?? [] as $r) {
            if (!is_array($r)) {
                continue;
            }
            $mapped = mapOutscraperReview($r, $placeUrl);
            if ($mapped !== null) {
                $newReviews[] = $mapped;
            }
        }
    }

    if (count($newReviews) === 0) {
        throw new RuntimeException('Outscraper retornou 0 reviews — cache mantido.');
    }

    // Base existente: cache → backup → seed
    $existing = loadJson($cacheFile) ?? loadJson($backupFile) ?? loadJson($seedFile) ?? [];
    $existingReviews = is_array($existing['reviews'] ?? null) ? $existing['reviews'] : [];

    // Merge: novos primeiro, dedupe por id e por assinatura autor+texto
    $seenIds = [];
    $seenSigs = [];
    $merged = [];

    foreach (array_merge($newReviews, $existingReviews) as $review) {
        if (!is_array($review)) {
            continue;
        }
        $id = (string) ($review['id'] ?? '');
        $sig = reviewSignature($review);

        if (($id !== '' && isset($seenIds[$id])) || isset($seenSigs[$sig])) {
            continue;
        }
        $seenIds[$id] = true;
        $seenSigs[$sig] = true;
        $merged[] = $review;
    }

    $avgRating = $ratingWeight > 0 ? round($ratingSum / $ratingWeight, 1) : 4.9;
    if ($avgRating >= 4.95) {
        $avgRating = 4.9;
    }

    $summary = $existing['summary'] ?? [];
    $payload = [
        'success' => true,
        'stale' => false,
        'syncedAt' => gmdate('c'),
        'summary' => [
            'rating' => $avgRating,
            'totalCount' => max($totalCount, count($merged)),
            'placeUrl' => $summary['placeUrl'] ?? $defaultPlaceUrl,
            'writeReviewUrl' => $summary['writeReviewUrl'] ?? 'https://search.google.com/local/writereview?placeid=ChIJq78McFxvGZURmIl8iyKRbJY',
        ],
        'reviews' => $merged,
    ];

    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0775, true);
    }

    if (is_file($cacheFile)) {
        copy($cacheFile, $backupFile);
    }

    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (file_put_contents($cacheFile, $json, LOCK_EX) === false) {
        throw new RuntimeException('Falha ao gravar ' . $cacheFile);
    }

    echo json_encode([
        'success' => true,
        'syncedAt' => $payload['syncedAt'],
        'fetched' => count($newReviews),
        'added' => count($merged) - count($existingReviews) > 0 ? count($merged) - count($existingReviews) : 0,
        'cacheTotal' => count($merged),
        'googleTotal' => $payload['summary']['totalCount'],
        'rating' => $avgRating,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
