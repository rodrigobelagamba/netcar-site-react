<?php

declare(strict_types=1);

require_once __DIR__ . '/lib/bootstrap.php';

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Cross-Origin-Resource-Policy: cross-origin');
header('Access-Control-Allow-Origin: *');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit('Method not allowed');
}

$id = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($_GET['id'] ?? ''));
if ($id === '') {
    http_response_code(400);
    exit('Missing id');
}

$dir = SocialEnv::dataDir() . '/media/instagram-posts';
$metaPath = $dir . '/' . $id . '.json';
$meta = is_file($metaPath) ? json_decode((string) file_get_contents($metaPath), true) : null;
if (!is_array($meta) || empty($meta['file']) || empty($meta['contentType'])) {
    http_response_code(404);
    exit('Not found');
}

$fileName = basename((string) $meta['file']);
$path = $dir . '/' . $fileName;
$contentType = (string) $meta['contentType'];
if (!is_file($path) || !in_array($contentType, ['image/jpeg', 'image/png'], true)) {
    http_response_code(404);
    exit('Not found');
}

$size = filesize($path);
if ($size === false || $size <= 0) {
    http_response_code(404);
    exit('Not found');
}

header('Content-Type: ' . $contentType);
header('Content-Length: ' . $size);
header('Cache-Control: public, max-age=31536000, immutable');
header('ETag: "' . hash_file('sha256', $path) . '"');

if ($method === 'HEAD') {
    exit;
}

readfile($path);
