<?php
/**
 * Stories API — Netcar
 *
 * GET /social/v1/stories.php?action=list
 *
 * Lê cache JSON e retorna profile + stories ativas/não expiradas.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = $_GET['action'] ?? 'list';

if ($action !== 'list') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid action. Use action=list',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$dataDir = __DIR__ . '/data';
$cacheDir = $dataDir . '/cache';
$cacheFile = $cacheDir . '/stories.json';
$seedFile = $dataDir . '/stories.seed.json';
$backupFile = $cacheDir . '/stories.backup.json';

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

function filterActiveStories(array $stories): array
{
    $now = time();

    return array_values(array_filter($stories, static function ($story) use ($now) {
        if (!is_array($story) || empty($story['items'])) {
            return false;
        }

        if (!empty($story['expiresAt'])) {
            $expires = strtotime($story['expiresAt']);
            if ($expires !== false && $expires < $now) {
                return false;
            }
        }

        return true;
    }));
}

function normalizeStoriesResponse(array $data, bool $stale = false): array
{
    $stories = filterActiveStories($data['stories'] ?? []);

    return [
        'success' => true,
        'stale' => $stale,
        'syncedAt' => $data['syncedAt'] ?? null,
        'profile' => $data['profile'] ?? [
            'username' => 'netcar_rc',
            'displayName' => 'Netcar',
            'avatarUrl' => '/images/Logotipo7_1768863597989.png',
            'followUrl' => 'https://www.instagram.com/netcar_rc',
        ],
        'stories' => $stories,
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
        'message' => 'Stories cache unavailable',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

echo json_encode(
    normalizeStoriesResponse($data, $stale),
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);
