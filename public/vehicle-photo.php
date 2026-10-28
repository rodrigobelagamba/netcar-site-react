<?php
// Opt-in variants for vehicle detail photos. Encoding happens during the build,
// never on a visitor's request. Missing/stale variants retain the existing image.
if (!isset($_GET['src']) || !is_string($_GET['src'])
    || (isset($_GET['w']) && !is_scalar($_GET['w']))) {
    http_response_code(400);
    exit;
}
$src = isset($_GET['src']) && is_string($_GET['src']) ? rawurldecode($_GET['src']) : '';
$src = str_replace('\\', '/', $src);
$width = isset($_GET['w']) ? max(200, min((int) $_GET['w'], 2400)) : 1600;
$root = rtrim($_SERVER['DOCUMENT_ROOT'], '/');

function netcar_photo_source_matches($root, $path, $mtime, $bytes)
{
    if (!is_string($path) || strpos($path, '..') !== false
        || !preg_match('#^/(imagens|images)/#', $path)) return false;
    $file = realpath($root . $path);
    return $file !== false && strpos($file, $root . '/') === 0 && is_file($file)
        && (int) filemtime($file) === (int) $mtime && (int) filesize($file) === (int) $bytes;
}

$variant = null;
if ($src !== '' && strpos($src, '..') === false
    && preg_match('#^/(imagens|images)/.*\.(png|jpe?g|webp)$#i', $src)) {
    // Read only this photo's small record, not the entire inventory per request.
    $manifestPath = __DIR__ . '/seo/vehicle-photo-variants/' . hash('sha256', $src) . '.json';
    if (is_file($manifestPath) && filesize($manifestPath) <= 32 * 1024) {
        $manifest = json_decode((string) file_get_contents($manifestPath), true);
        if (is_array($manifest) && ($manifest['schemaVersion'] ?? null) === 1) {
            $variant = $manifest['entries'][$src][(string) $width] ?? null;
        }
    }
}

if (is_array($variant)
    && netcar_photo_source_matches($root, $src,
        $variant['requestedSourceMtime'] ?? 0, $variant['requestedSourceBytes'] ?? 0)
    && netcar_photo_source_matches($root, $variant['sourcePath'] ?? null,
        $variant['sourceMtime'] ?? 0, $variant['sourceBytes'] ?? 0)
    && preg_match('#^/images/vehicle-photo-variants/[a-f0-9]{64}\.avif$#', $variant['file'] ?? '')
    && (int) ($variant['bytes'] ?? 0) > 0
    && (int) $variant['bytes'] <= (int) ($variant['budgetBytes'] ?? 0)) {
    $file = realpath($root . $variant['file']);
    if ($file !== false && strpos($file, $root . '/images/vehicle-photo-variants/') === 0
        && is_file($file) && filesize($file) === (int) $variant['bytes']) {
        $etag = '"' . basename($file, '.avif') . '"';
        header('Content-Type: image/avif');
        // Source photos can be replaced by the XML importer without a site build.
        header('Cache-Control: public, max-age=3600');
        header('ETag: ' . $etag);
        if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && $_SERVER['HTTP_IF_NONE_MATCH'] === $etag) {
            http_response_code(304);
            exit;
        }
        header('Content-Length: ' . filesize($file));
        readfile($file);
        exit;
    }
}

// Keep temporary misses short-lived so a later build can provide the AVIF.
define('NETCAR_IMAGE_CACHE_CONTROL', 'public, max-age=300');
require __DIR__ . '/img.php';
