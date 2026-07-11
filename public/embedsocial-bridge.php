<?php
/**
 * Bridge temporário EmbedSocial → JSON normalizado
 * Usado até google-reviews.php / stories.php estarem no ar na KingHost.
 *
 * GET /embedsocial-bridge.php?type=reviews|stories
 * GET /embedsocial-bridge.php?path=pro_hashtag/{ref}/  (retorna HTML bruto)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const REVIEWS_REF = '811726996bfe08c76a3bd507a02fcebb16fc6ad1';
const STORIES_REF = 'b86f52e1790e82bd3b547af9c36814370d2526d7';

function fetchHtml(string $path): ?string
{
    $url = 'https://embedsocial.com/api/' . ltrim($path, '/');
    $context = stream_context_create([
        'http' => [
            'timeout' => 15,
            'header' => "User-Agent: NetcarSocialBridge/1.0\r\n",
        ],
    ]);

    $html = @file_get_contents($url, false, $context);
    return is_string($html) && strlen($html) > 1000 ? $html : null;
}

function decodeWindowJson(string $html, string $varName): ?array
{
    $pattern = '/window\.' . preg_quote($varName, '/') . '\s*=\s*\'((?:\\\\\'|[^\'])*)\'/s';
    if (!preg_match($pattern, $html, $matches)) {
        return null;
    }

    $raw = $matches[1];
    $raw = preg_replace_callback('/\\\\u([0-9a-fA-F]{4})/', static function ($m) {
        return mb_convert_encoding(pack('H*', $m[1]), 'UTF-8', 'UCS-2BE');
    }, $raw);
    $raw = str_replace('\\/', '/', $raw);

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function unesc(?string $url): ?string
{
    if (!$url) {
        return null;
    }
    return str_replace('\\/', '/', $url);
}

function respond(array $payload, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$path = $_GET['path'] ?? '';
$type = $_GET['type'] ?? '';

if ($path !== '') {
    header('Content-Type: text/html; charset=utf-8');
    $html = fetchHtml($path);
    if ($html === null) {
        http_response_code(502);
        echo 'EmbedSocial unavailable';
        exit;
    }
    echo $html;
    exit;
}

if ($type === 'reviews') {
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $html = fetchHtml('pro_hashtag/' . REVIEWS_REF . '/');
    if ($html === null) {
        respond(['success' => false, 'message' => 'EmbedSocial reviews unavailable'], 502);
    }

    $widget = decodeWindowJson($html, 'widget') ?? [];
    $widgetId = $widget['id'] ?? null;

    $googleSources = array_values(array_filter(
        $widget['sources'] ?? [],
        static fn($s) => ($s['sourceType'] ?? '') === 'google'
    ));
    $primary = $googleSources[0] ?? ($widget['sources'][0] ?? []);

    $total = 0;
    foreach ($googleSources as $source) {
        $total += (int) ($source['numOfPosts'] ?? 0);
    }
    if ($total === 0) {
        foreach ($widget['sources'] ?? [] as $source) {
            $total += (int) ($source['numOfPosts'] ?? 0);
        }
    }

    $media = [];
    $totalNumMedias = 0;

    if ($page > 1 && $widgetId) {
        $pageUrl = 'https://embedsocial.com/api/widget_items/' . rawurlencode((string) $widgetId) . '/?page=' . $page;
        $pageJson = @file_get_contents($pageUrl, false, stream_context_create([
            'http' => [
                'timeout' => 15,
                'header' => "User-Agent: NetcarSocialBridge/1.0\r\n",
            ],
        ]));

        if (is_string($pageJson)) {
            $payload = json_decode($pageJson, true);
            if (is_array($payload)) {
                $media = $payload['media'] ?? [];
                $totalNumMedias = (int) ($payload['totalNumMedias'] ?? 0);
            }
        }
    } else {
        $media = decodeWindowJson($html, 'widgetMedia') ?? [];

        if ($widgetId) {
            $pageUrl = 'https://embedsocial.com/api/widget_items/' . rawurlencode((string) $widgetId) . '/?page=1';
            $pageJson = @file_get_contents($pageUrl, false, stream_context_create([
                'http' => [
                    'timeout' => 15,
                    'header' => "User-Agent: NetcarSocialBridge/1.0\r\n",
                ],
            ]));

            if (is_string($pageJson)) {
                $payload = json_decode($pageJson, true);
                if (is_array($payload)) {
                    $totalNumMedias = (int) ($payload['totalNumMedias'] ?? 0);
                }
            }
        }
    }

    if ($totalNumMedias > 0) {
        $total = $totalNumMedias;
    }

    $reviews = [];
    foreach ($media as $item) {
        $caption = trim($item['caption'] ?? $item['formattedCaption'] ?? '');
        $mediaType = $item['type'] ?? 'text';
        $variant = 'text';
        $photo = null;
        $largePhoto = null;

        if (in_array($mediaType, ['image', 'carousel'], true)) {
            $imageSource = $item['largeImage']['source'] ?? $item['image']['source'] ?? ($item['carousel'][0]['source'] ?? null);
            if ($imageSource && strpos($imageSource, '/a/ACg8') === false) {
                $variant = 'photo';
                $photo = unesc($item['image']['source'] ?? $imageSource);
                $largePhoto = unesc($item['largeImage']['source'] ?? $photo);
            }
        } elseif (!empty($item['pinStatus'])) {
            $variant = 'dark';
        }

        $reviews[] = [
            'id' => (string) ($item['id'] ?? uniqid('r')),
            'authorName' => $item['authorName'] ?? 'Cliente',
            'authorPhotoUrl' => unesc($item['profilePhotoUrl'] ?? null),
            'rating' => (int) ($item['rating'] ?? 5),
            'text' => $caption,
            'relativeTime' => $item['formattedDate'] ?? $item['mediaCreatedOn'] ?? '',
            'photoUrl' => $photo,
            'largePhotoUrl' => $largePhoto,
            'reviewUrl' => unesc($item['mediaLink'] ?? $item['sourceLink'] ?? null),
            'variant' => $variant,
        ];
    }

    $reviews = array_slice($reviews, 0, 20);

    respond([
        'success' => true,
        'stale' => false,
        'syncedAt' => gmdate('c'),
        'summary' => [
            'rating' => 4.9,
            'totalCount' => $total,
            'placeUrl' => unesc($primary['sourceLink'] ?? '') ?: 'https://www.google.com/maps/place/Netcar+Multimarcas',
            'writeReviewUrl' => unesc($primary['leaveAReviewLink'] ?? '') ?: 'https://g.page/NetcarRC/review?rc',
        ],
        'pagination' => [
            'page' => $page,
            'pageSize' => 20,
            'totalCount' => $total,
            'hasMore' => false,
            'widgetId' => $widgetId !== null ? (string) $widgetId : null,
        ],
        'reviews' => $reviews,
    ]);
}

if ($type === 'stories') {
    $html = fetchHtml('pro_story_widget/' . STORIES_REF . '/');
    if ($html === null) {
        respond(['success' => false, 'message' => 'EmbedSocial stories unavailable'], 502);
    }

    if (!preg_match('/stories:\s*(\[[\s\S]*?\])\s*,?\s*\n/', $html, $matches)) {
        respond(['success' => false, 'message' => 'Stories payload not found'], 502);
    }

    $rawStories = json_decode($matches[1], true);
    if (!is_array($rawStories)) {
        respond(['success' => false, 'message' => 'Invalid stories JSON'], 502);
    }

    $first = $rawStories[0] ?? [];
    $username = $first['sourceUsername'] ?? 'netcar_rc';
    $stories = [];

    foreach ($rawStories as $story) {
        $id = (string) ($story['storyId'] ?? $story['id'] ?? uniqid('s'));
        $cover = unesc($story['mediaUrl'] ?? $story['largeMediaUrl'] ?? $story['thumbnailUrl'] ?? $story['smallMediaUrl'] ?? '');
        $full = unesc($story['largeMediaUrl'] ?? $story['mediaUrl'] ?? $cover);

        $stories[] = [
            'id' => $id,
            'title' => $story['sourceName'] ?? 'Netcar',
            'coverImage' => $cover,
            'relativeTime' => $story['createdOnFormated'] ?? '',
            'items' => [[
                'id' => $id,
                'type' => ($story['mediaType'] ?? '') === 'VIDEO' ? 'video' : 'image',
                'url' => $full,
                'previewUrl' => $cover,
                'durationMs' => 5000,
                'caption' => $story['name'] ?? null,
            ]],
        ];
    }

    respond([
        'success' => true,
        'stale' => false,
        'syncedAt' => gmdate('c'),
        'profile' => [
            'username' => $username,
            'displayName' => $first['sourceName'] ?? 'Netcar',
            'avatarUrl' => unesc($first['sourceImage'] ?? '') ?: '/images/Logotipo7_1768863597989.png',
            'followUrl' => 'https://www.instagram.com/' . $username,
        ],
        'stories' => $stories,
    ]);
}

respond(['success' => false, 'message' => 'Use type=reviews or type=stories'], 400);
