<?php
/**
 * Proxy e cache de mídia dos Stories da Netcar.
 *
 * GET /social/v1/story-media.php?url=https%3A%2F%2Fscontent...
 *
 * Evita que Safari, bloqueadores de conteúdo e redes móveis precisem buscar
 * capas diretamente nos domínios do Instagram/Facebook.
 */

declare(strict_types=1);

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Resource-Policy: same-origin');

function storyMediaFail(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode([
        'success' => false,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function storyMediaHostAllowed(string $host): bool
{
    $host = strtolower(rtrim($host, '.'));
    $allowedSuffixes = ['cdninstagram.com', 'fbcdn.net'];

    foreach ($allowedSuffixes as $suffix) {
        if ($host === $suffix) {
            return true;
        }

        $needle = '.' . $suffix;
        if (strlen($host) > strlen($needle) && substr($host, -strlen($needle)) === $needle) {
            return true;
        }
    }

    return false;
}

function storyMediaServe(string $file, string $contentType): void
{
    $size = filesize($file);
    if ($size === false || $size <= 0) {
        storyMediaFail(502, 'Cached media is empty');
    }

    $start = 0;
    $end = $size - 1;
    $status = 200;
    $range = $_SERVER['HTTP_RANGE'] ?? '';

    if ($range !== '' && preg_match('/^bytes=(\d*)-(\d*)$/', trim($range), $matches)) {
        $rawStart = $matches[1];
        $rawEnd = $matches[2];

        if ($rawStart === '' && $rawEnd === '') {
            header('Content-Range: bytes */' . $size);
            storyMediaFail(416, 'Invalid byte range');
        }

        if ($rawStart === '') {
            $suffixLength = max(1, (int) $rawEnd);
            $start = max(0, $size - $suffixLength);
        } else {
            $start = (int) $rawStart;
        }

        if ($rawStart !== '' && $rawEnd !== '') {
            $end = min($end, (int) $rawEnd);
        }

        if ($start > $end || $start >= $size) {
            header('Content-Range: bytes */' . $size);
            storyMediaFail(416, 'Requested range is unavailable');
        }

        $status = 206;
    }

    $length = $end - $start + 1;
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . $length);
    header('Accept-Ranges: bytes');
    header('Cache-Control: public, max-age=3600, stale-while-revalidate=86400');
    header('ETag: "' . hash_file('sha256', $file) . '"');

    if ($status === 206) {
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
        exit;
    }

    $handle = fopen($file, 'rb');
    if ($handle === false) {
        storyMediaFail(502, 'Unable to open cached media');
    }

    if ($start > 0) {
        fseek($handle, $start);
    }

    $remaining = $length;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, min(8192, $remaining));
        if ($chunk === false || $chunk === '') {
            break;
        }
        echo $chunk;
        $remaining -= strlen($chunk);
    }

    fclose($handle);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    header('Allow: GET, HEAD');
    storyMediaFail(405, 'Method not allowed');
}

$url = trim((string) ($_GET['url'] ?? ''));
if ($url === '' || strlen($url) > 4096) {
    storyMediaFail(400, 'Invalid media URL');
}

$parts = parse_url($url);
if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
    storyMediaFail(400, 'Only HTTPS media URLs are accepted');
}

if (!storyMediaHostAllowed((string) $parts['host'])) {
    storyMediaFail(403, 'Media host is not allowed');
}

$cacheDir = __DIR__ . '/data/cache/story-media';
if (!is_dir($cacheDir) && !mkdir($cacheDir, 0755, true) && !is_dir($cacheDir)) {
    storyMediaFail(503, 'Media cache is unavailable');
}

// URLs assinadas mudam com o tempo. Uma limpeza eventual evita acúmulo no servidor.
if (mt_rand(1, 100) === 1) {
    $cutoff = time() - 172800;
    foreach (glob($cacheDir . '/*') ?: [] as $candidate) {
        if (is_file($candidate) && filemtime($candidate) < $cutoff) {
            @unlink($candidate);
        }
    }
}

$cacheKey = hash('sha256', $url);
$cacheFile = $cacheDir . '/' . $cacheKey . '.bin';
$metaFile = $cacheDir . '/' . $cacheKey . '.json';

if (is_file($cacheFile) && is_file($metaFile)) {
    $meta = json_decode((string) file_get_contents($metaFile), true);
    if (is_array($meta) && !empty($meta['contentType'])) {
        storyMediaServe($cacheFile, (string) $meta['contentType']);
    }
}

if (!function_exists('curl_init')) {
    storyMediaFail(503, 'HTTP media client is unavailable');
}

$temporaryFile = tempnam($cacheDir, 'story-');
if ($temporaryFile === false) {
    storyMediaFail(503, 'Unable to create media cache file');
}

$output = fopen($temporaryFile, 'wb');
if ($output === false) {
    @unlink($temporaryFile);
    storyMediaFail(503, 'Unable to write media cache');
}

$downloaded = 0;
$maxBytes = 50 * 1024 * 1024;
$curl = curl_init($url);
if ($curl === false) {
    fclose($output);
    @unlink($temporaryFile);
    storyMediaFail(503, 'Unable to initialize HTTP media client');
}

$options = [
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_FAILONERROR => false,
    CURLOPT_USERAGENT => 'Mozilla/5.0 Netcar Story Media Cache',
    CURLOPT_HTTPHEADER => ['Accept: image/*,video/*;q=0.9,*/*;q=0.1'],
    CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use ($output, &$downloaded, $maxBytes): int {
        $length = strlen($chunk);
        $downloaded += $length;

        if ($downloaded > $maxBytes) {
            return 0;
        }

        $written = fwrite($output, $chunk);
        return $written === false ? 0 : $written;
    },
];

if (defined('CURLOPT_PROTOCOLS') && defined('CURLPROTO_HTTPS')) {
    $options[CURLOPT_PROTOCOLS] = CURLPROTO_HTTPS;
}

curl_setopt_array($curl, $options);
$success = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$contentType = (string) curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
$curlError = curl_error($curl);
if (PHP_VERSION_ID < 80000) {
    curl_close($curl);
}
fclose($output);

$contentType = strtolower(trim(explode(';', $contentType)[0] ?? ''));
$allowedType = strpos($contentType, 'image/') === 0 || strpos($contentType, 'video/') === 0;
$downloadSize = is_file($temporaryFile) ? filesize($temporaryFile) : 0;

if ($success === false || $status !== 200 || !$allowedType || $downloadSize === false || $downloadSize <= 0) {
    @unlink($temporaryFile);
    storyMediaFail(502, $curlError !== '' ? 'Unable to fetch story media' : 'Invalid story media response');
}

if (!rename($temporaryFile, $cacheFile)) {
    @unlink($temporaryFile);
    storyMediaFail(503, 'Unable to publish cached media');
}

file_put_contents($metaFile, json_encode([
    'contentType' => $contentType,
    'fetchedAt' => gmdate('c'),
], JSON_UNESCAPED_SLASHES));

storyMediaServe($cacheFile, $contentType);
