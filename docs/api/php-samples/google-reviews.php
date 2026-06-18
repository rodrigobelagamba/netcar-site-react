<?php
/**
 * Google Reviews API — Netcar
 *
 * GET /api/v1/google-reviews.php
 * GET /api/v1/google-reviews.php?page=2&limit=21
 *
 * Lê cache JSON (sync-social.php) e pagina no servidor.
 * Fallback: backup → seed com stale=true.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data';
$cacheDir = $dataDir . '/cache';
$cacheFile = $cacheDir . '/google-reviews.json';
$seedFile = $dataDir . '/google-reviews.seed.json';
$backupFile = $cacheDir . '/google-reviews.backup.json';

$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = max(1, min(50, (int) ($_GET['limit'] ?? 21)));

function loadJsonFile(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function normalizeReviewsResponse(array $data, bool $stale = false, int $page = 1, int $limit = 21): array
{
    $reviews = $data['reviews'] ?? [];

    $reviews = array_values(array_filter($reviews, static function ($review) {
        return is_array($review) && empty($review['hidden']);
    }));

    usort($reviews, static function ($a, $b) {
        $aPinned = !empty($a['pinned']) ? 1 : 0;
        $bPinned = !empty($b['pinned']) ? 1 : 0;

        if ($aPinned !== $bPinned) {
            return $bPinned <=> $aPinned;
        }

        $aDate = $a['publishedAt'] ?? '';
        $bDate = $b['publishedAt'] ?? '';
        return strcmp($bDate, $aDate);
    });

    $totalCount = count($reviews);
    if (!empty($data['summary']['totalCount'])) {
        $totalCount = max($totalCount, (int) $data['summary']['totalCount']);
    }

    $offset = ($page - 1) * $limit;
    $pageReviews = array_slice($reviews, $offset, $limit);
    $loadedCount = min($offset + count($pageReviews), count($reviews));

    return [
        'success' => true,
        'stale' => $stale,
        'syncedAt' => $data['syncedAt'] ?? null,
        'summary' => $data['summary'] ?? [
            'rating' => 4.9,
            'totalCount' => $totalCount,
            'placeUrl' => 'https://www.google.com/maps/place/Netcar+Multimarcas',
            'writeReviewUrl' => 'https://g.page/NetcarRC/review?rc',
        ],
        'pagination' => [
            'page' => $page,
            'pageSize' => $limit,
            'totalCount' => $totalCount,
            'hasMore' => $loadedCount < count($reviews) || count($reviews) < $totalCount,
        ],
        'reviews' => $pageReviews,
    ];
}

$stale = false;
$data = loadJsonFile($cacheFile);

if ($data === null) {
    $data = loadJsonFile($backupFile);
    if ($data !== null) {
        $stale = true;
    }
}

if ($data === null) {
    $data = loadJsonFile($seedFile);
    $stale = true;
}

if ($data === null) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'message' => 'Reviews cache unavailable',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode(
    normalizeReviewsResponse($data, $stale, $page, $limit),
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
